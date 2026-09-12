// pages/branding/content-schedule/content-schedule.repository.js
// ===================================================================
// BRANDING CONTENT SCHEDULE — REPOSITORY LAYER
// Seluruh akses Firestore diisolasi di sini. Tidak ada manipulasi DOM.
// Koleksi:
//   - branding_content  (CRUD utama rencana konten & milestones)
//   - duty_schedules    (Read-only cross-reference untuk kalender)
// ===================================================================

import { db } from '../../../assets/js/firebase-config.js';
import {
    collection,
    doc,
    addDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const COLL_CONTENT  = 'branding_content';
const COLL_DUTY     = 'duty_schedules';

// ── Real-time Listeners ───────────────────────────────────────────

/**
 * Berlangganan snapshot realtime koleksi branding_content.
 * @param {function} callback  Dipanggil dengan array dokumen setiap ada perubahan.
 * @param {function} onError   Dipanggil jika terjadi error pada listener.
 * @returns {function} Fungsi unsubscribe.
 */
export function subscribeBrandingContent(callback, onError) {
    return onSnapshot(
        collection(db, COLL_CONTENT),
        (snapshot) => {
            const items = [];
            snapshot.forEach(snap => items.push({ id: snap.id, ...snap.data() }));
            callback(items);
        },
        (err) => {
            console.error('[content-schedule.repo] subscribeBrandingContent error:', err);
            if (onError) onError(err);
        }
    );
}

/**
 * Berlangganan snapshot realtime koleksi duty_schedules.
 * @param {function} callback  Dipanggil dengan array dokumen setiap ada perubahan.
 * @param {function} onError   Dipanggil jika terjadi error pada listener.
 * @returns {function} Fungsi unsubscribe.
 */
export function subscribeDutySchedules(callback, onError) {
    return onSnapshot(
        collection(db, COLL_DUTY),
        (snapshot) => {
            const items = [];
            snapshot.forEach(snap => items.push({ id: snap.id, ...snap.data() }));
            callback(items);
        },
        (err) => {
            console.error('[content-schedule.repo] subscribeDutySchedules error:', err);
            if (onError) onError(err);
        }
    );
}

// ── Single-Document Fetch ─────────────────────────────────────────

/**
 * Mengambil satu dokumen konten berdasarkan ID.
 * @param {string} id  Firestore document ID di koleksi branding_content.
 * @returns {object|null}  Data dokumen beserta id, atau null jika tidak ditemukan.
 */
export async function getContentById(id) {
    try {
        const snap = await getDoc(doc(db, COLL_CONTENT, id));
        if (snap.exists()) return { id: snap.id, ...snap.data() };
        return null;
    } catch (e) {
        console.error('[content-schedule.repo] getContentById failed:', e);
        throw e;
    }
}

// ── CRUD Operations ───────────────────────────────────────────────

/**
 * Membuat dokumen konten baru di koleksi branding_content.
 * @param {object} contentData  Data konten (title, description, priority, milestones, status).
 * @param {string} userId       UID pengguna yang sedang login (untuk field created_by).
 * @returns {string}  ID dokumen yang baru dibuat.
 */
export async function createContent(contentData, userId) {
    try {
        const ref = await addDoc(collection(db, COLL_CONTENT), {
            ...contentData,
            created_by: userId,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
        });
        return ref.id;
    } catch (e) {
        console.error('[content-schedule.repo] createContent failed:', e);
        throw e;
    }
}

/**
 * Memperbarui dokumen konten yang sudah ada.
 * @param {string} id           Firestore document ID.
 * @param {object} contentData  Field-field yang akan diperbarui.
 */
export async function updateContent(id, contentData) {
    try {
        await updateDoc(doc(db, COLL_CONTENT, id), {
            ...contentData,
            updated_at: serverTimestamp(),
        });
    } catch (e) {
        console.error('[content-schedule.repo] updateContent failed:', e);
        throw e;
    }
}

/**
 * Menghapus dokumen konten secara permanen.
 * @param {string} id  Firestore document ID.
 */
export async function deleteContent(id) {
    try {
        await deleteDoc(doc(db, COLL_CONTENT, id));
    } catch (e) {
        console.error('[content-schedule.repo] deleteContent failed:', e);
        throw e;
    }
}

/**
 * Memperbarui status satu milestone pada konten tertentu.
 * Jika semua milestone selesai, status konten secara keseluruhan juga diperbarui menjadi 'completed'.
 * @param {string} contentId      Firestore document ID konten.
 * @param {number} milestoneIndex Index milestone dalam array milestones.
 * @param {string} status         Status baru ('completed' | 'pending').
 */
export async function updateMilestoneStatus(contentId, milestoneIndex, status) {
    try {
        const snap = await getDoc(doc(db, COLL_CONTENT, contentId));
        if (!snap.exists()) throw new Error('Content document not found');

        const data     = snap.data();
        const milestones = [...(data.milestones || [])];

        if (!milestones[milestoneIndex]) throw new Error('Milestone index out of range');
        milestones[milestoneIndex].status = status;

        const allCompleted = milestones.every(m => m.status === 'completed');
        const updates = {
            milestones,
            updated_at: serverTimestamp(),
        };
        if (allCompleted) updates.status = 'completed';

        await updateDoc(doc(db, COLL_CONTENT, contentId), updates);
    } catch (e) {
        console.error('[content-schedule.repo] updateMilestoneStatus failed:', e);
        throw e;
    }
}
