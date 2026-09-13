// pages/branding/piket-branding/piket-branding.repository.js
// ================================================================
// PIKET BRANDING — REPOSITORY
// Semua akses Firestore ada di sini.
// Tidak ada DOM manipulation, tidak ada UI logic.
// ================================================================

import { db } from '../../../assets/js/firebase-config.js';
import {
    collection,
    addDoc,
    getDoc,
    getDocs,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ── Collections ───────────────────────────────────────────────────────
const COLL_TYPES     = 'duty_types';
const COLL_SCHEDULES = 'duty_schedules';
const COLL_USERS     = 'users';

// ── Real-time Listeners ───────────────────────────────────────────────

/**
 * Subscribe ke duty_types (realtime).
 * @returns {function} unsubscribe
 */
export function subscribeTypes(onData, onError) {
    return onSnapshot(
        collection(db, COLL_TYPES),
        (snapshot) => {
            const types = [];
            snapshot.forEach(s => types.push({ id: s.id, ...s.data() }));
            types.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            onData(types);
        },
        onError,
    );
}

/**
 * Subscribe ke duty_schedules diurutkan start_date desc (realtime).
 * @returns {function} unsubscribe
 */
export function subscribeSchedules(onData, onError) {
    return onSnapshot(
        query(collection(db, COLL_SCHEDULES), orderBy('start_date', 'desc')),
        (snapshot) => {
            const schedules = [];
            snapshot.forEach(s => schedules.push({ id: s.id, ...s.data() }));
            onData(schedules);
        },
        onError,
    );
}

// ── One-shot Reads ────────────────────────────────────────────────────

/**
 * Mengambil data user yang sedang login.
 */
export async function getCurrentUser(uid) {
    try {
        const snap = await getDoc(doc(db, COLL_USERS, uid));
        return snap.exists() ? snap.data() : {};
    } catch (e) {
        console.error('[piket-branding.repo] getCurrentUser failed:', e);
        return {};
    }
}

/**
 * Mengambil semua user dengan status Active, diurutkan nama.
 */
export async function getActiveUsers() {
    try {
        const snap = await getDocs(collection(db, COLL_USERS));
        const users = [];
        snap.forEach(s => {
            const d = s.data() || {};
            const status = String(d.status || 'Active').toLowerCase();
            if (status !== 'active') return;
            users.push({
                id: s.id,
                name: d.name || d.fullName || d.email || 'Tanpa Nama',
                email: d.email || '',
                photo: d.photo || '',
            });
        });
        users.sort((a, b) => a.name.localeCompare(b.name));
        return users;
    } catch (e) {
        console.error('[piket-branding.repo] getActiveUsers failed:', e);
        return [];
    }
}

// ── Schedule Mutations ────────────────────────────────────────────────

/**
 * Membuat jadwal piket baru.
 */
export async function createSchedule(payload, createdByUid) {
    return addDoc(collection(db, COLL_SCHEDULES), {
        ...payload,
        created_at: serverTimestamp(),
        created_by: createdByUid,
    });
}

/**
 * Memperbarui jadwal piket yang sudah ada.
 */
export async function updateSchedule(id, payload) {
    return updateDoc(doc(db, COLL_SCHEDULES, id), payload);
}

/**
 * Menghapus jadwal piket secara permanen.
 */
export async function deleteSchedule(id) {
    return deleteDoc(doc(db, COLL_SCHEDULES, id));
}

// ── Type Mutations ────────────────────────────────────────────────────

/**
 * Menambah jenis piket baru.
 */
export async function createType(payload, createdByUid) {
    return addDoc(collection(db, COLL_TYPES), {
        ...payload,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        created_by: createdByUid,
    });
}

/**
 * Toggle aktif/nonaktif jenis piket.
 */
export async function toggleTypeActive(id, isActive, updatedByUid) {
    return updateDoc(doc(db, COLL_TYPES, id), {
        is_active: isActive,
        updated_at: serverTimestamp(),
        updated_by: updatedByUid,
    });
}

/**
 * Seed default duty types jika koleksi kosong.
 * Menggunakan slug sebagai document ID agar idempoten (tidak menduplikasi dokumen).
 * Hanya dipanggil oleh admin.
 */
export async function seedDefaultTypes(defaultTypes, createdByUid) {
    try {
        await Promise.all(
            defaultTypes.map(item =>
                setDoc(doc(db, COLL_TYPES, item.slug), {
                    ...item,
                    created_at: serverTimestamp(),
                    updated_at: serverTimestamp(),
                    created_by: createdByUid,
                }, { merge: true }),
            ),
        );
    } catch (e) {
        console.error('[piket-branding.repo] seedDefaultTypes failed:', e);
    }
}

/**
 * Membersihkan dokumen duplikat jenis piket jika ada di Firestore.
 * Menyisakan satu dokumen kanonikal per jenis (berdasarkan slug/nama).
 */
export async function cleanupDuplicateTypes(types) {
    try {
        const seen = new Map();
        const duplicateIds = [];
        types.forEach(t => {
            const key = (t.slug || t.name || '').trim().toLowerCase();
            if (key) {
                if (seen.has(key)) {
                    duplicateIds.push(t.id);
                } else {
                    seen.set(key, t.id);
                }
            }
        });
        if (duplicateIds.length > 0) {
            await Promise.all(duplicateIds.map(id => deleteDoc(doc(db, COLL_TYPES, id))));
        }
    } catch (e) {
        console.error('[piket-branding.repo] cleanupDuplicateTypes failed:', e);
    }
}
