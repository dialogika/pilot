/**
 * Generate Certificate Repository
 * Handles Firestore 'certificate_logs' CRUD and legacy localStorage migration.
 */

import { auth, db } from "../../../assets/js/firebase-config.js";
import {
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    doc,
    setDoc,
    deleteDoc,
    writeBatch,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const CERT_LOG_STORAGE_KEY = 'dlg_certificate_logs_v1';
export const CERT_LOG_COLLECTION = 'certificate_logs';
export const CERT_LOG_FETCH_LIMIT = 2000;

export function generateLogId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }
    return `cert-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Persist or merge a single certificate log into Firestore.
 * @param {Object} payload 
 */
export async function persistCertificateLog(payload) {
    if (!payload || !payload.id) {
        throw new Error('Payload log ID is required');
    }
    const user = auth.currentUser;
    const enriched = {
        ...payload,
        createdByUid: user?.uid || '',
        createdByEmail: user?.email || '',
        serverCreatedAt: serverTimestamp()
    };
    await setDoc(doc(db, CERT_LOG_COLLECTION, payload.id), enriched, { merge: true });
}

/**
 * Migrate legacy logs stored in localStorage to Firestore.
 */
export async function migrateLocalLogsToFirestoreIfNeeded() {
    let parsed = [];
    try {
        const raw = localStorage.getItem(CERT_LOG_STORAGE_KEY);
        parsed = raw ? JSON.parse(raw) : [];
    } catch (error) {
        parsed = [];
    }

    if (!Array.isArray(parsed) || !parsed.length) return;

    const rows = parsed
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({ ...item, id: String(item.id || generateLogId()) }));

    const chunkSize = 10;
    for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        await Promise.all(chunk.map((item) => persistCertificateLog(item)));
    }

    try {
        localStorage.removeItem(CERT_LOG_STORAGE_KEY);
    } catch (error) { }
}

/**
 * Fetch certificate logs from Firestore ordered by createdAtMs descending.
 * @param {number} fetchLimit 
 * @returns {Promise<Array>}
 */
export async function fetchCertificateLogsFromFirestore(fetchLimit = CERT_LOG_FETCH_LIMIT) {
    const snap = await getDocs(
        query(
            collection(db, CERT_LOG_COLLECTION),
            orderBy('createdAtMs', 'desc'),
            limit(fetchLimit)
        )
    );
    const rows = [];
    snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data) {
            rows.push({
                ...data,
                id: data.id || docSnap.id
            });
        }
    });
    return rows;
}

/**
 * Delete a single certificate log by ID.
 * @param {string} logId 
 */
export async function deleteCertificateLogById(logId) {
    if (!logId) return;
    await deleteDoc(doc(db, CERT_LOG_COLLECTION, logId));
}

/**
 * Delete multiple certificate logs by IDs using batched writes (up to 450 items per batch).
 * @param {string[]} logIds 
 */
export async function deleteCertificateLogsByIds(logIds) {
    const uniqueIds = Array.from(new Set((logIds || []).filter(Boolean)));
    if (!uniqueIds.length) return;
    const batchSize = 450;
    for (let i = 0; i < uniqueIds.length; i += batchSize) {
        const chunk = uniqueIds.slice(i, i + batchSize);
        const batch = writeBatch(db);
        chunk.forEach((id) => {
            batch.delete(doc(db, CERT_LOG_COLLECTION, id));
        });
        await batch.commit();
    }
}
