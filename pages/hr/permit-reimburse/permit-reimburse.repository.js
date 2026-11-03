// pages/hr/permit-reimburse/permit-reimburse.repository.js
// =====================================================================
// DATA ACCESS LAYER: PERMIT & REIMBURSE MANAGEMENT
// Pure Firestore & Storage integration. Zero DOM manipulation.
// =====================================================================

import { db } from "/assets/js/firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  downloadExportFile,
  calcDateRange,
  formatDateIndo,
  extractTimestamp,
} from "../../../assets/js/utils/export-helper.js";

const withTimeout = (promise, ms = 10000) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Firestore request timeout")), ms)
    )
  ]);

const userPhotoCache = {};
const userEmailCache = {};

/**
 * Normalizes permit document from Firestore.
 */
export function mapPermitDoc(id, data = {}) {
  let createdAtMs = 0;
  if (data.created_at_ms || data.createdAtMs) {
    createdAtMs = Number(data.created_at_ms || data.createdAtMs);
  } else if (data.created_at && typeof data.created_at.toMillis === "function") {
    createdAtMs = data.created_at.toMillis();
  } else if (data.created_at && typeof data.created_at.seconds === "number") {
    createdAtMs = data.created_at.seconds * 1000;
  } else if (data.created_at) {
    const parsed = new Date(data.created_at).getTime();
    if (!Number.isNaN(parsed)) createdAtMs = parsed;
  }

  return {
    id,
    user_id: data.user_id || data.userId || "",
    user_name: data.user_name || data.userName || data.name || "Karyawan",
    user_email: data.user_email || data.userEmail || data.email || "",
    user_photo: data.user_photo || data.userPhoto || data.photo || "",
    division: data.division || data.department || data.user_position || "",
    permit_type: data.permit_type || data.type || "full-day",
    permit_start_hour: data.permit_start_hour || "",
    permit_end_hour: data.permit_end_hour || "",
    permit_hours: data.permit_hours || data.permit_time_range || "",
    start_date: data.start_date || data.startDate || "",
    end_date: data.end_date || data.endDate || data.start_date || "",
    reason: data.reason || data.notes || data.alasan || "",
    status: (data.status || "pending").toLowerCase(),
    evidence_url: data.evidence_url || data.attachment_url || data.evidenceUrl || "",
    reimburse_id: data.reimburse_id || null,
    approved_by: data.approved_by || null,
    approved_by_name: data.approved_by_name || "",
    approved_at: data.approved_at || null,
    rejected_by: data.rejected_by || null,
    rejected_by_name: data.rejected_by_name || "",
    rejected_at: data.rejected_at || null,
    rejection_reason: data.rejection_reason || "",
    created_at: data.created_at || data.createdAt || "",
    created_at_ms: createdAtMs
  };
}

const WORK_DAYS = new Set([0, 2, 4, 6]); // 0=Minggu, 2=Selasa, 4=Kamis, 6=Sabtu

function parseDateForCalc(val) {
  if (!val) return new Date();
  if (typeof val === "object" && typeof val.toDate === "function") return val.toDate();
  if (typeof val === "number") return new Date(val);
  const parts = String(val).split("-");
  if (parts.length === 3) {
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  const d = new Date(String(val));
  if (isNaN(d.getTime())) return new Date();
  return d;
}

export function generateDailyEntries(startDate, endDate) {
  const start = parseDateForCalc(startDate);
  const end = parseDateForCalc(endDate || startDate);
  const entries = [];
  const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (current <= last) {
    if (WORK_DAYS.has(current.getDay())) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, "0");
      const d = String(current.getDate()).padStart(2, "0");
      entries.push({ date: `${y}-${m}-${d}`, status: "pending" });
    }
    current.setDate(current.getDate() + 1);
  }
  return entries;
}

export function generateDailyEntriesCount(startDate, count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n === 0 || !startDate) return [];
  const start = parseDateForCalc(startDate);
  const entries = [];
  const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const maxIterations = n * 10 + 30;
  let iterations = 0;
  while (entries.length < n && iterations < maxIterations) {
    if (WORK_DAYS.has(current.getDay())) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, "0");
      const d = String(current.getDate()).padStart(2, "0");
      entries.push({ date: `${y}-${m}-${d}`, status: "pending" });
    }
    current.setDate(current.getDate() + 1);
    iterations++;
  }
  return entries;
}

/**
 * Normalizes reimburse document from Firestore.
 */
export function mapReimburseDoc(id, data = {}) {
  let createdAtMs = 0;
  if (data.created_at_ms || data.createdAtMs) {
    createdAtMs = Number(data.created_at_ms || data.createdAtMs);
  } else if (data.created_at && typeof data.created_at.toMillis === "function") {
    createdAtMs = data.created_at.toMillis();
  } else if (data.created_at && typeof data.created_at.seconds === "number") {
    createdAtMs = data.created_at.seconds * 1000;
  } else if (data.created_at) {
    const parsed = new Date(data.created_at).getTime();
    if (!Number.isNaN(parsed)) createdAtMs = parsed;
  }

  const sd = data.start_date || data.permit_date || data.date || "";
  const ed = data.end_date || data.start_date || data.permit_date || data.date || "";
  const storedDays = Number(data.total_days ?? data.days ?? data.reimburse_days ?? 0);
  const storedHours = Number(data.total_hours ?? data.hours ?? data.reimburse_hours ?? 0);

  let dailyEntries = data.dailyEntries || data.timeline || null;
  if (!dailyEntries || !Array.isArray(dailyEntries) || dailyEntries.length === 0) {
    if (storedDays > 0 && sd) {
      dailyEntries = generateDailyEntriesCount(sd, storedDays);
      if (String(data.status || "pending").toLowerCase() === "completed") {
        dailyEntries.forEach((entry) => (entry.status = "completed"));
      }
    } else if (sd) {
      dailyEntries = generateDailyEntries(sd, ed);
      if (String(data.status || "pending").toLowerCase() === "completed") {
        dailyEntries.forEach((entry) => (entry.status = "completed"));
      }
    } else {
      dailyEntries = [];
    }
  }

  return {
    id,
    user_id: data.user_id || data.userId || "",
    user_name: data.user_name || data.userName || data.name || "Karyawan",
    user_email: data.user_email || data.email || "",
    user_photo: data.user_photo || data.photo || "",
    permit_id: data.permit_id || "",
    start_date: sd,
    end_date: ed,
    permit_date: sd,
    days: storedDays || 1,
    total_days: storedDays || 1,
    hours: storedHours,
    total_hours: storedHours,
    dailyEntries: Array.isArray(dailyEntries) ? dailyEntries : [],
    status: (data.status || "pending").toLowerCase(),
    related: data.related || {},
    reason: data.reason || (data.related && data.related.reason) || "",
    type: data.type || (data.related && (data.related.permit_type || data.related.type)) || "",
    notes: data.notes || "",
    created_at: data.created_at || data.createdAt || "",
    created_at_ms: createdAtMs,
    completed_at: data.completed_at || null
  };
}

/**
 * Subscribes to realtime updates of permits.
 * @param {Function} onNext 
 * @param {Function} onError 
 * @returns {Function} Unsubscribe function
 */
export function subscribeToPermits(onNext, onError) {
  try {
    const q = query(collection(db, "permits"), orderBy("created_at", "desc"));
    return onSnapshot(
      q,
      (snapshot) => {
        const list = [];
        snapshot.forEach((docSnap) => {
          list.push(mapPermitDoc(docSnap.id, docSnap.data()));
        });
        onNext(list);
      },
      (error) => {
        console.warn("[PermitRepo] OrderBy fallback for permits:", error);
        // Fallback without orderBy
        return onSnapshot(
          collection(db, "permits"),
          (snapshot) => {
            const list = [];
            snapshot.forEach((docSnap) => {
              list.push(mapPermitDoc(docSnap.id, docSnap.data()));
            });
            list.sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0));
            onNext(list);
          },
          onError
        );
      }
    );
  } catch (error) {
    console.error("[PermitRepo] subscribeToPermits exception:", error);
    onError?.(error);
    return () => {};
  }
}

/**
 * Subscribes to realtime updates of reimburse.
 * @param {Function} onNext 
 * @param {Function} onError 
 * @returns {Function} Unsubscribe function
 */
export function subscribeToReimburse(onNext, onError) {
  try {
    const q = query(collection(db, "reimburse"), orderBy("created_at", "desc"));
    return onSnapshot(
      q,
      (snapshot) => {
        const list = [];
        snapshot.forEach((docSnap) => {
          list.push(mapReimburseDoc(docSnap.id, docSnap.data()));
        });
        onNext(list);
      },
      (error) => {
        console.warn("[PermitRepo] OrderBy fallback for reimburse:", error);
        return onSnapshot(
          collection(db, "reimburse"),
          (snapshot) => {
            const list = [];
            snapshot.forEach((docSnap) => {
              list.push(mapReimburseDoc(docSnap.id, docSnap.data()));
            });
            list.sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0));
            onNext(list);
          },
          onError
        );
      }
    );
  } catch (error) {
    console.error("[PermitRepo] subscribeToReimburse exception:", error);
    onError?.(error);
    return () => {};
  }
}

/**
 * Resolves user email from users collection with caching.
 */
export async function resolveUserEmail(userId, fallbackData = {}) {
  if (fallbackData?.user_email) return fallbackData.user_email;
  if (!userId) return "";
  if (userEmailCache[userId] !== undefined) return userEmailCache[userId];

  try {
    const snap = await withTimeout(getDoc(doc(db, "users", userId)), 5000);
    if (snap.exists()) {
      const u = snap.data() || {};
      const email = u.email || u.user_email || "";
      userEmailCache[userId] = email;
      return email;
    }
  } catch (e) {
    console.warn("[PermitRepo] Gagal resolve email user:", e);
  }
  userEmailCache[userId] = "";
  return "";
}

/**
 * Resolves user photo from users collection with caching.
 */
export async function resolveUserPhoto(userId) {
  if (!userId) return "";
  if (userPhotoCache[userId] !== undefined) return userPhotoCache[userId];

  try {
    const snap = await withTimeout(getDoc(doc(db, "users", userId)), 5000);
    if (snap.exists()) {
      const u = snap.data() || {};
      const photo = u.photo || u.photo_url || u.photoURL || u.profile?.photo || "";
      userPhotoCache[userId] = photo;
      return photo;
    }
  } catch (e) {
    console.warn("[PermitRepo] Gagal resolve photo user:", e);
  }
  userPhotoCache[userId] = "";
  return "";
}

/**
 * Approves a permit and optionally creates a reimburse record.
 */
export async function approvePermit(permitId, { approvedBy, approvedByName, reimburseData = null }) {
  const permitRef = doc(db, "permits", permitId);
  const updatePayload = {
    status: "approved",
    approved_by: approvedBy || null,
    approved_by_name: approvedByName || "Admin",
    approved_at: new Date().toISOString()
  };

  await updateDoc(permitRef, updatePayload);

  if (reimburseData) {
    const reimbursePayload = {
      permit_id: permitId,
      user_id: reimburseData.user_id || "",
      user_name: reimburseData.user_name || "",
      user_photo: reimburseData.user_photo || "",
      start_date: reimburseData.permit_date || "",
      end_date: reimburseData.permit_date || "",
      total_days: Number(reimburseData.reimburse_days || 1),
      total_hours: Number(reimburseData.reimburse_hours || 0),
      dailyEntries: generateDailyEntriesCount(
        reimburseData.permit_date,
        Number(reimburseData.reimburse_days || 1)
      ),
      status: "pending",
      created_at: new Date().toISOString(),
      created_at_ms: Date.now()
    };
    await addDoc(collection(db, "reimburse"), reimbursePayload);
  }

  return { success: true };
}

/**
 * Rejects a permit.
 */
export async function rejectPermit(permitId, { rejectedBy, rejectedByName, reason = "" }) {
  await updateDoc(doc(db, "permits", permitId), {
    status: "rejected",
    rejected_by: rejectedBy || null,
    rejected_by_name: rejectedByName || "Admin",
    rejected_at: new Date().toISOString(),
    rejection_reason: reason
  });
  return { success: true };
}

/**
 * Deletes a permit document.
 */
export async function deletePermit(permitId) {
  await deleteDoc(doc(db, "permits", permitId));
  return { success: true };
}

/**
 * Marks a specific reimburse day/entry as completed.
 */
export async function markReimburseDayCompleted(reimburseId, dateStr, actorName = "Admin", actorUid = null) {
  const reimburseRef = doc(db, "reimburse", reimburseId);
  const snap = await getDoc(reimburseRef);
  if (!snap.exists()) return { success: false };

  const data = snap.data() || {};
  let entries = data.dailyEntries || null;
  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    const sd = data.start_date || data.permit_date || data.date || "";
    const ed = data.end_date || data.start_date || "";
    const storedDays = Number(data.total_days ?? data.days ?? 0) || 0;
    if (storedDays > 0 && sd) {
      entries = generateDailyEntriesCount(sd, storedDays);
    } else if (sd) {
      entries = generateDailyEntries(sd, ed);
    } else {
      entries = [];
    }
  } else {
    entries = entries.slice();
  }

  let found = false;
  entries.forEach((e) => {
    if (e.date === dateStr && e.status !== "completed") {
      e.status = "completed";
      found = true;
    }
  });

  if (!found) return { success: false };

  const allCompleted = entries.every((e) => e.status === "completed");
  const updatePayload = {
    dailyEntries: entries
  };

  if (allCompleted) {
    updatePayload.status = "completed";
    updatePayload.completed_by = actorUid || null;
    updatePayload.completed_by_name = actorName;
    updatePayload.completed_at = new Date().toISOString();
  }

  await updateDoc(reimburseRef, updatePayload);

  // Add synthetic attendance
  try {
    const userId = data.user_id || "";
    const userName = data.user_name || "";
    const userPhoto = data.user_photo || "";
    const permitType = String(
      (data.related && (data.related.permit_type || data.related.type)) || data.type || ""
    ).toLowerCase();
    const REIMBURSE_HOURS = permitType.includes("half") ? 3 : 6;

    const startHour = 9;
    const endHour = startHour + REIMBURSE_HOURS;
    const loginTime = `${String(startHour).padStart(2, "0")}:00:00`;
    const logoutTime = `${String(endHour).padStart(2, "0")}:00:00`;

    const loginPayload = {
      user_id: userId,
      name: userName,
      photo: userPhoto,
      date: dateStr,
      time: loginTime,
      type: "login",
      source: "reimburse",
      reimburse_id: reimburseId,
      is_synthetic: true,
      created_at: new Date()
    };

    const logoutPayload = {
      user_id: userId,
      name: userName,
      photo: userPhoto,
      date: dateStr,
      time: logoutTime,
      type: "logout",
      source: "reimburse",
      reimburse_id: reimburseId,
      is_synthetic: true,
      created_at: new Date()
    };

    await addDoc(collection(db, "user_attendance"), loginPayload);
    await addDoc(collection(db, "user_attendance"), logoutPayload);
  } catch (err) {
    console.warn("[PermitRepo] Gagal menambahkan user_attendance sintetis:", err);
  }

  return { success: true, allCompleted };
}

/**
 * Exports Permit and/or Reimburse data based on filter parameters.
 */
export async function exportPermitReimburseData({
  scope = "permit",
  format = "xlsx",
  periodMode = "month",
  statusFilter = "all",
  monthVal = "",
  weekStart = "",
  weekEnd = "",
  allPermits = [],
  allReimburse = []
}) {
  let startStr = "";
  let endStr = "";
  let periodLabel = "";

  if (periodMode === "all") {
    startStr = "";
    endStr = "";
    periodLabel = "Semua_Data";
  } else if (periodMode === "month") {
    if (!monthVal) {
      throw new Error("Pilih bulan terlebih dahulu.");
    }
    const parts = monthVal.split("-");
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const lastDay = new Date(year, month, 0).getDate();
    startStr = `${monthVal}-01`;
    endStr = `${monthVal}-${String(lastDay).padStart(2, "0")}`;
    periodLabel = `Bulan_${monthVal}`;
  } else {
    startStr = weekStart;
    endStr = weekEnd;
    if (!startStr || !endStr) {
      throw new Error("Pilih rentang tanggal minggu terlebih dahulu.");
    }
    periodLabel = `Minggu_${startStr}_sd_${endStr}`;
  }

  function extractDateString(val) {
    if (!val) return "";
    if (typeof val === "object" && typeof val.toDate === "function") {
      const d = val.toDate();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    if (val instanceof Date) {
      return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, "0")}-${String(val.getDate()).padStart(2, "0")}`;
    }
    if (typeof val === "number") {
      const d = new Date(val);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return str.slice(0, 10);
    }
    const parsed = new Date(str);
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
    }
    return "";
  }

  function isDateInRange(dateVal, sStr, eStr) {
    if (!sStr && !eStr) return true;
    const targetStr = extractDateString(dateVal);
    if (!targetStr) return false;
    if (sStr && targetStr < sStr) return false;
    if (eStr && targetStr > eStr) return false;
    return true;
  }

  const includePermits = scope === "permit" || scope === "all";
  const includeReimburse = scope === "reimburse" || scope === "all";

  // Filter Permits
  const filteredPermits = allPermits.filter((p) => {
    if (statusFilter && statusFilter !== "all" && String(p.status || "").toLowerCase() !== statusFilter) {
      return false;
    }
    const startDate = p.start_date || "";
    const endDate = p.end_date || p.start_date || "";
    const createdAt = p.created_at || "";

    const matchStart = isDateInRange(startDate, startStr, endStr);
    const matchEnd = isDateInRange(endDate, startStr, endStr);
    const matchCreated = isDateInRange(createdAt, startStr, endStr);

    const startStrExt = extractDateString(startDate);
    const endStrExt = extractDateString(endDate);
    const overlap = startStrExt && endStrExt && startStrExt <= endStr && endStrExt >= startStr;

    return matchStart || matchEnd || matchCreated || overlap;
  });

  // Filter Reimburse
  const filteredReimburse = allReimburse.filter((r) => {
    const startDate = r.start_date || "";
    const endDate = r.end_date || r.start_date || "";
    const matchStart = isDateInRange(startDate, startStr, endStr);
    const matchEnd = isDateInRange(endDate, startStr, endStr);
    const hasEntryInRange = (r.dailyEntries || []).some((e) => isDateInRange(e.date, startStr, endStr));
    return matchStart || matchEnd || hasEntryInRange;
  });

  const permitDataRows = [];
  if (includePermits) {
    filteredPermits.forEach((p, idx) => {
      const startFull = formatDateIndo(p.start_date);
      const endFull = formatDateIndo(p.end_date || p.start_date);
      let izinDate = startFull || "-";
      if (startFull && endFull && endFull !== startFull) {
        izinDate = `${startFull} - ${endFull}`;
      }
      permitDataRows.push({
        no: idx + 1,
        created_at: formatDateIndo(p.created_at) || "-",
        user_name: p.user_name || "-",
        user_position: p.user_position || p.division || "-",
        izin_date: izinDate,
        permit_type: p.permit_hours ? `${p.permit_type} (${p.permit_hours})` : (p.permit_type || "-"),
        reason: p.reason || "-",
        status: String(p.status || "Pending").toUpperCase(),
        approver: p.approved_by_name || p.rejected_by_name || "-",
        approval_date: formatDateIndo(p.approved_at || p.rejected_at) || "-",
        evidence_url: p.attachment_url || p.evidence_url || "-"
      });
    });
  }

  const reimburseSummaryRows = [];
  if (includeReimburse) {
    filteredReimburse.forEach((r, idx) => {
      reimburseSummaryRows.push({
        no: idx + 1,
        user_name: r.user_name || "-",
        start_date: r.start_date || "-",
        end_date: r.end_date || r.start_date || "-",
        total_days: Number(r.total_days ?? r.days ?? r.reimburse_days ?? 0),
        total_hours: Number(r.total_hours ?? r.hours ?? r.reimburse_hours ?? 0),
        status: String(r.status || "pending").toUpperCase(),
        completed_by: r.completed_by_name || "-",
        reason: (r.related && r.related.reason) || r.reason || "-"
      });
    });
  }

  const totalRowsCount = permitDataRows.length + reimburseSummaryRows.length;
  if (totalRowsCount === 0) {
    throw new Error("Tidak ada data pada periode dan filter yang dipilih.");
  }

  let fileScope = "Izin_Reimburse";
  let columns = [];
  let rowsData = [];
  let sheetName = "Data Izin & Reimburse";

  if (scope === "permit") {
    fileScope = "Data_Izin";
    sheetName = "Data Izin";
    columns = [
      { header: "No", key: "no", width: 6 },
      { header: "Tanggal Pengajuan", key: "created_at", width: 20 },
      { header: "Nama Karyawan", key: "user_name", width: 24 },
      { header: "Posisi / Divisi", key: "user_position", width: 22 },
      { header: "Tanggal Izin", key: "izin_date", width: 26 },
      { header: "Jenis Izin", key: "permit_type", width: 20 },
      { header: "Alasan Izin", key: "reason", width: 36 },
      { header: "Status", key: "status", width: 14 },
      { header: "Disetujui/Ditolak Oleh", key: "approver", width: 24 },
      { header: "Tanggal Approval", key: "approval_date", width: 20 },
      { header: "Link Lampiran", key: "evidence_url", width: 30 }
    ];
    rowsData = permitDataRows;
  } else if (scope === "reimburse") {
    fileScope = "Data_Reimburse";
    sheetName = "Ringkasan Reimburse";
    columns = [
      { header: "No", key: "no", width: 6 },
      { header: "Nama Karyawan", key: "user_name", width: 24 },
      { header: "Tanggal Mulai", key: "start_date", width: 16 },
      { header: "Tanggal Selesai", key: "end_date", width: 16 },
      { header: "Total Hari", key: "total_days", width: 12 },
      { header: "Total Jam", key: "total_hours", width: 12 },
      { header: "Status", key: "status", width: 14 },
      { header: "Diselesaikan Oleh", key: "completed_by", width: 24 },
      { header: "Alasan / Keterangan", key: "reason", width: 36 }
    ];
    rowsData = reimburseSummaryRows;
  } else {
    // Both: if XLSX multi-sheet or combined
    fileScope = "Data_Izin_Reimburse";
    if (format === "xlsx" && window.XLSX && permitDataRows.length > 0 && reimburseSummaryRows.length > 0) {
      const wb = window.XLSX.utils.book_new();
      const wsPermit = window.XLSX.utils.json_to_sheet(permitDataRows);
      const wsReimburse = window.XLSX.utils.json_to_sheet(reimburseSummaryRows);
      window.XLSX.utils.book_append_sheet(wb, wsPermit, "Data Izin");
      window.XLSX.utils.book_append_sheet(wb, wsReimburse, "Data Reimburse");
      const fileName = `Dialogika_${fileScope}_${periodLabel}.xlsx`;
      window.XLSX.writeFile(wb, fileName);
      return { count: totalRowsCount, filename: fileName };
    } else {
      columns = [
        { header: "No", key: "no", width: 6 },
        { header: "Nama Karyawan", key: "user_name", width: 24 },
        { header: "Tanggal Pengajuan / Mulai", key: "created_at", width: 22 },
        { header: "Status", key: "status", width: 14 },
        { header: "Keterangan", key: "reason", width: 36 }
      ];
      rowsData = permitDataRows.length > 0 ? permitDataRows : reimburseSummaryRows;
    }
  }

  const filename = `Dialogika_${fileScope}_${periodLabel}`;
  await downloadExportFile({
    filename,
    sheetName,
    columns,
    rowsData,
    format
  });

  return { count: rowsData.length, filename };
}
