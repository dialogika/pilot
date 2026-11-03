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
import {
    downloadExportFile,
    calcDateRange,
    formatDateIndo,
    extractTimestamp,
} from "../../../assets/js/utils/export-helper.js";

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

/**
 * Exports Certificate Logs data to Excel or CSV.
 * @param {Object} options
 * @param {string} [options.format="xlsx"]
 * @param {string} [options.rangeType="all"]
 * @param {string} [options.startDate]
 * @param {string} [options.endDate]
 * @param {string} [options.monthValue]
 * @param {string|number} [options.weekValue]
 * @param {string} [options.status=""] - Filter transactionType (individual, batch)
 * @returns {Promise<{ count: number, filename: string }>}
 */
export async function exportCertificateData({
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

    const logs = await fetchCertificateLogsFromFirestore(10000);

    const filtered = logs.filter((item) => {
        if (status && status !== "" && String(item.transactionType || "").toLowerCase() !== status.toLowerCase()) {
            return false;
        }
        if (start && end) {
            let ts = item.createdAtMs;
            if (!ts) {
                ts = extractTimestamp(item.createdAt || item.certificateDate);
            }
            if (!ts) return false;
            const itemDate = new Date(ts);
            if (itemDate < start || itemDate > end) return false;
        }
        return true;
    });

    const columns = [
        { header: "No", key: "no", width: 8 },
        { header: "No Invoice", key: "invoice", width: 18 },
        { header: "Nama Penerima", key: "recipientName", width: 28 },
        { header: "Program / Kelas", key: "className", width: 26 },
        { header: "Tanggal Sertifikat", key: "certificateDate", width: 18 },
        { header: "Tipe Transaksi", key: "transactionType", width: 16 },
        { header: "Format Export", key: "exportFormat", width: 14 },
        { header: "Waktu Pembuatan", key: "createdAt", width: 22 },
        { header: "File Reference", key: "fileReference", width: 24 },
    ];

    const rows = filtered.map((item, idx) => ({
        no: idx + 1,
        invoice: item.invoice || "-",
        recipientName: item.recipientName || "-",
        className: item.className || "-",
        certificateDate: item.certificateDate || "-",
        transactionType: (item.transactionType || "individual").toUpperCase(),
        exportFormat: (item.exportFormat || "svg").toUpperCase(),
        createdAt: item.createdAt || "-",
        fileReference: item.fileReference || "-",
    }));

    const filename = `Data_Log_Sertifikat_${periodLabel}`;
    await downloadExportFile({
        filename,
        sheetName: "Log Sertifikat",
        columns,
        rows,
        format,
    });

    return { count: rows.length, filename };
}

