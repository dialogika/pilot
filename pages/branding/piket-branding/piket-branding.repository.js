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
import {
    downloadExportFile,
    calcDateRange,
    formatDateIndo,
    extractTimestamp,
} from '../../../assets/js/utils/export-helper.js';

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

/**
 * Exports Piket Branding schedule data to Excel or CSV.
 * @param {Object} options
 * @param {string} [options.format="xlsx"]
 * @param {string} [options.rangeType="all"]
 * @param {string} [options.startDate]
 * @param {string} [options.endDate]
 * @param {string} [options.monthValue]
 * @param {string|number} [options.weekValue]
 * @param {string} [options.status=""] - Filter schedule status (active, completed, cancelled)
 * @returns {Promise<{ count: number, filename: string }>}
 */
export async function exportPiketData({
    format = "xlsx",
    rangeType = "all",
    startDate,
    endDate,
    monthValue,
    weekValue,
    status = "",
}) {
    const { start, end, label: periodLabel } = calcDateRange({
        rangeType,
        startDate,
        endDate,
        monthValue,
        weekValue,
    });

    const [schedSnap, typeSnap] = await Promise.all([
        getDocs(collection(db, COLL_SCHEDULES)),
        getDocs(collection(db, COLL_TYPES)),
    ]);

    const typeMap = new Map();
    typeSnap.forEach((s) => {
        const d = s.data() || {};
        typeMap.set(s.id, d.name || s.id);
    });

    const schedules = [];
    schedSnap.forEach((s) => schedules.push({ id: s.id, ...s.data() }));

    const filtered = schedules.filter((item) => {
        if (status && status !== "") {
            const itemStatus = String(item.status || "scheduled").toLowerCase();
            const filterStatus = status.toLowerCase();
            if (filterStatus === "active" || filterStatus === "scheduled") {
                if (itemStatus !== "scheduled" && itemStatus !== "active") return false;
            } else if (itemStatus !== filterStatus) {
                return false;
            }
        }
        if (start && end) {
            let ts = extractTimestamp(item.start_date || item.created_at);
            if (ts) {
                const itemDate = new Date(ts);
                if (itemDate < start || itemDate > end) return false;
            }
        }
        return true;
    });

    const columns = [
        { header: "No", key: "no", width: 8 },
        { header: "Judul Piket", key: "title", width: 28 },
        { header: "Jenis Piket", key: "typeName", width: 22 },
        { header: "Tanggal Mulai", key: "startDate", width: 18 },
        { header: "Tanggal Selesai", key: "endDate", width: 18 },
        { header: "Status", key: "status", width: 16 },
        { header: "Deskripsi", key: "description", width: 35 },
        { header: "Anggota Bertugas & Peran", key: "assignments", width: 45 },
        { header: "Tanggal Dibuat", key: "createdAt", width: 18 },
    ];

    const rows = filtered.map((item, idx) => {
        const typeName = item.type_name || typeMap.get(item.type_id) || "-";
        const assignments = Array.isArray(item.assignments) ? item.assignments : [];
        const assignStr = assignments
            .map((a) => `${a.role_name || "Petugas"}: ${a.user_name || "-"}`)
            .join(" | ");

        return {
            no: idx + 1,
            title: item.title || "-",
            typeName,
            startDate: item.start_date ? formatDateIndo(item.start_date) : "-",
            endDate: item.end_date ? formatDateIndo(item.end_date) : "-",
            status: (item.status || "scheduled").toUpperCase(),
            description: item.description || "-",
            assignments: assignStr || "-",
            createdAt: item.created_at ? formatDateIndo(item.created_at) : "-",
        };
    });

    const filename = `Data_Piket_Branding_${periodLabel}`;
    await downloadExportFile({
        filename,
        sheetName: "Piket Branding",
        columns,
        rows,
        format,
    });

    return { count: rows.length, filename };
}

