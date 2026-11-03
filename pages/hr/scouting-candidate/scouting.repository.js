// pilot/pages/hr/scouting-candidate/scouting.repository.js
// =====================================================================
// REPOSITORY: Scouting Candidate
//
// Responsibilities:
// - Firestore operations on collections `talents`, `users`, `roles`, `position`/`positions`
// - Firebase Storage upload for talent avatars (`talent-avatars/`)
// - Export talent list to Excel spreadsheet with embedded images
//
// Rules:
// - NO DOM manipulation or UI rendering
// =====================================================================

import { db, storage } from "../../../assets/js/firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  arrayUnion,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

export const TALENTS_COLLECTION = "talents";

/**
 * Fetch all talents from the `talents` collection.
 * @returns {Promise<Array<Object>>}
 */
export async function listTalents() {
  const snap = await getDocs(collection(db, TALENTS_COLLECTION));
  const talents = [];
  snap.forEach((docSnap) => {
    talents.push({
      id: docSnap.id,
      ...docSnap.data(),
    });
  });
  return talents;
}

/**
 * Fetch a single talent document by ID.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getTalentById(id) {
  if (!id) return null;
  const docRef = doc(db, TALENTS_COLLECTION, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Create a new talent record in Firestore.
 * @param {Object} payload
 * @returns {Promise<string>} Created document ID
 */
export async function createTalent(payload) {
  const talentsRef = collection(db, TALENTS_COLLECTION);
  const newDocRef = doc(talentsRef);
  const nowIso = new Date().toISOString();

  const baseStatus =
    payload.recruitment_status && payload.recruitment_status.current
      ? payload.recruitment_status
      : {
          current: "radar",
          history: [{ status: "radar", date: nowIso }],
        };

  const data = {
    basic_info: payload.basic_info || null,
    scouting_info: payload.scouting_info || null,
    recruitment_status: baseStatus,
    contact_info: payload.contact_info || null,
    availability: payload.availability || null,
    education: payload.education || null,
    organizations: payload.organizations || [],
    work: payload.work || null,
    events: payload.events || [],
    routines: payload.routines || null,
    experience: payload.experience || null,
    profiling: payload.profiling || null,
    devices: payload.devices || null,
    interview_notes: payload.interview_notes || null,
    logs: payload.logs || [],
    score_fit:
      typeof payload.score_fit === "number" ? payload.score_fit : null,
    priority: payload.priority || "medium",
    created_at: serverTimestamp(),
  };

  await setDoc(newDocRef, data);
  return newDocRef.id;
}

/**
 * Update an existing talent document.
 * @param {string} talentId
 * @param {Object} payload
 * @returns {Promise<void>}
 */
export async function updateTalent(talentId, payload) {
  if (!talentId) return;
  const docRef = doc(db, TALENTS_COLLECTION, talentId);
  await updateDoc(docRef, {
    basic_info: payload.basic_info,
    scouting_info: payload.scouting_info,
  });
}

/**
 * Update talent recruitment status and log the change.
 * @param {string} talentId
 * @param {string} newStatus
 * @param {string} [actorName]
 * @returns {Promise<void>}
 */
export async function updateTalentStatus(talentId, newStatus, actorName) {
  if (!talentId) return;
  const ref = doc(db, TALENTS_COLLECTION, talentId);
  const nowIso = new Date().toISOString();
  const logEntry = {
    action: "status_change",
    to: newStatus,
    by: actorName || null,
    date: nowIso,
  };
  await updateDoc(ref, {
    "recruitment_status.current": newStatus,
    "recruitment_status.history": arrayUnion({
      status: newStatus,
      date: nowIso,
    }),
    logs: arrayUnion(logEntry),
  });
}

/**
 * Update talent due date / interview due date.
 * @param {string} talentId
 * @param {string} dueIso
 * @param {string} [actorName]
 * @returns {Promise<void>}
 */
export async function updateTalentDueDate(talentId, dueIso, actorName) {
  if (!talentId) return;
  const ref = doc(db, TALENTS_COLLECTION, talentId);
  const nowIso = new Date().toISOString();
  const logEntry = {
    action: "due_set",
    due: dueIso || null,
    by: actorName || null,
    date: nowIso,
  };
  await updateDoc(ref, {
    "scouting_info.interview_due": dueIso || null,
    logs: arrayUnion(logEntry),
  });
}

/**
 * Delete a talent document by ID.
 * @param {string} talentId
 * @returns {Promise<void>}
 */
export async function deleteTalentById(talentId) {
  if (!talentId) return;
  const ref = doc(db, TALENTS_COLLECTION, talentId);
  await deleteDoc(ref);
}

/**
 * Add a custom log entry to a talent.
 * @param {string} talentId
 * @param {Object} logEntry
 * @returns {Promise<void>}
 */
export async function addTalentLog(talentId, logEntry) {
  if (!talentId) return;
  const ref = doc(db, TALENTS_COLLECTION, talentId);
  const nowIso = new Date().toISOString();
  const entry = { ...logEntry, date: logEntry.date || nowIso };
  await updateDoc(ref, {
    logs: arrayUnion(entry),
  });
}

/**
 * Upload candidate photo to Firebase Storage.
 * @param {Blob|File} fileOrBlob
 * @param {string} [originalName]
 * @returns {Promise<string|null>} Download URL
 */
export async function uploadCandidateImage(fileOrBlob, originalName = "photo.jpg") {
  if (!fileOrBlob) return null;
  const safeName = originalName.replace(/[^\w.\-]/g, "_");
  const path = `talent-avatars/${Date.now()}-${safeName}`;
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, fileOrBlob);
  return await getDownloadURL(fileRef);
}

/**
 * Load all users for the assignment lookup.
 * @returns {Promise<Object>} Map of userId => { name, photo }
 */
export async function loadAssignUsers() {
  const usersMap = {};
  try {
    const snap = await getDocs(collection(db, "users"));
    snap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const id = docSnap.id;
      const name = data.displayName || data.name || data.email || "User";
      const photo =
        data.photo ||
        data.photoURL ||
        data.avatar_url ||
        data.avatar ||
        null;
      usersMap[id] = { name, photo };
    });
  } catch (err) {
    console.warn("Could not load users collection:", err);
  }
  return usersMap;
}

/**
 * Load candidate roles from `roles` collection.
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export async function loadCandidateRoles() {
  const roles = [];
  try {
    const snap = await getDocs(collection(db, "roles"));
    snap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const name = data.name || data.label || data.title || "Role";
      roles.push({ id: docSnap.id, name });
    });
  } catch (err) {
    console.warn("Could not load roles collection:", err);
  }
  return roles;
}

/**
 * Load candidate positions from `position` or fallback `positions` collection.
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export async function loadCandidatePositions() {
  const positions = [];
  try {
    let snap = await getDocs(collection(db, "position"));
    if (snap.empty) {
      snap = await getDocs(collection(db, "positions"));
    }
    snap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const name =
        data.name ||
        data.label ||
        data.title ||
        data.position ||
        "Unknown Position";
      positions.push({ id: docSnap.id, name });
    });
  } catch (err) {
    console.warn("Could not load position collection:", err);
  }
  return positions;
}

/**
 * Format a talent date string/timestamp.
 * @param {*} value
 * @param {boolean} withTime
 * @returns {string}
 */
export function formatTalentDate(value, withTime = false) {
  if (!value) return "";
  try {
    const dateValue =
      typeof value.toDate === "function" ? value.toDate() : new Date(value);
    if (isNaN(dateValue.getTime())) return "";
    return withTime
      ? dateValue.toLocaleString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : dateValue.toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        });
  } catch (_) {
    return "";
  }
}

/**
 * Fetch image as Base64 for Excel export.
 * @param {string} url
 * @param {Map} imageCache
 * @returns {Promise<{ base64: string, extension: string }|null>}
 */
async function fetchImageAsBase64(url, imageCache) {
  const cacheKey = (url || "").trim();
  if (!cacheKey) return null;
  if (imageCache.has(cacheKey)) return imageCache.get(cacheKey);

  const loader = (async () => {
    try {
      const response = await fetch(cacheKey, { mode: "cors" });
      if (!response.ok) return null;
      const blob = await response.blob();
      const normalized = (blob.type || "").toLowerCase();
      let extension = "jpeg";
      if (normalized.includes("png")) extension = "png";
      else if (normalized.includes("gif")) extension = "gif";

      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result || "");
        reader.onerror = () => reject(new Error("READ_FAILED"));
        reader.readAsDataURL(blob);
      });
      const base64 =
        typeof dataUrl === "string" ? dataUrl.split(",")[1] || "" : "";
      if (!base64) return null;
      return { base64, extension };
    } catch (_) {
      return null;
    }
  })();

  imageCache.set(cacheKey, loader);
  return loader;
}

export function getTalentTimestamp(talent) {
  if (!talent) return null;
  const createdAt = talent.created_at;
  if (createdAt) {
    if (typeof createdAt.toMillis === "function") return createdAt.toMillis();
    if (typeof createdAt.toDate === "function") return createdAt.toDate().getTime();
    if (createdAt.seconds) return createdAt.seconds * 1000;
    if (typeof createdAt === "number") return createdAt;
    if (typeof createdAt === "string") {
      const parsed = Date.parse(createdAt);
      if (!isNaN(parsed)) return parsed;
    }
  }
  const history = talent.recruitment_status?.history;
  if (Array.isArray(history) && history.length > 0 && history[0]?.date) {
    const parsed = Date.parse(history[0].date);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
}

/**
 * Export scouting talent records to Excel (.xlsx) or CSV (.csv).
 * Supports ExcelJS with embedded candidate photos for XLSX, and fast UTF-8 CSV.
 * @param {Object} options
 * @param {Array<Object>} options.talents
 * @param {string} options.format 'xlsx' | 'csv'
 * @param {Object} options.assignUsersMap
 * @param {string} options.periodLabel
 * @returns {Promise<void>}
 */
export async function exportScoutingTalents({
  talents = [],
  format = "xlsx",
  assignUsersMap = {},
  periodLabel = "Semua_Data",
}) {
  if (!talents || !talents.length) {
    throw new Error("Tidak ada data scouting talent untuk diexport.");
  }

  const fileNameBase = `Scouting_Candidate_${periodLabel}`;

  const statusDisplayMap = {
    radar: "Radar",
    contacted: "Contacted",
    followup: "Follow Up",
    "follow up": "Follow Up",
    "follow_up": "Follow Up",
    replied: "Respond",
    respond: "Respond",
    interview: "Interview",
    ojt: "On Job Test",
    "on job test": "On Job Test",
    decision: "Decision",
    accepted: "Accepted",
    accept: "Accepted",
    rejected: "Rejected",
    reject: "Rejected",
  };

  const rowsData = talents.map((t, index) => {
    const basic = t.basic_info || {};
    const scouting = t.scouting_info || {};
    const contact = t.contact_info || {};
    const recruitment = t.recruitment_status || {};
    const rawStatus = (recruitment.current || "radar").toString().trim().toLowerCase();
    const statusLabel = statusDisplayMap[rawStatus] || rawStatus.toUpperCase();

    const assignedIds = Array.isArray(scouting.assigned_to)
      ? scouting.assigned_to.filter(Boolean)
      : [];
    const assignNames = assignedIds
      .map((uid) => assignUsersMap[uid]?.name || "")
      .filter(Boolean)
      .join(", ");

    return {
      no: index + 1,
      id: t.id || "",
      photoUrl: basic.avatar_url || "",
      nama: basic.full_name || scouting.full_name || "Tanpa Nama",
      whatsapp: contact.whatsapp || "-",
      email: contact.email || "-",
      kota: contact.address || basic.address || "-",
      role: scouting.role_name || basic.current_role || "-",
      posisi: scouting.position_name || "-",
      platform: (scouting.channel_type || "-").toUpperCase(),
      linkProfile: scouting.channel_url || "-",
      status: statusLabel,
      assignedTo: assignNames || "-",
      tanggalInput: formatTalentDate(t.created_at, false),
      tanggalInterview: recruitment.due_date || recruitment.interview_schedule || formatTalentDate(scouting.interview_due, true) || "-",
    };
  });

  if (format === "xlsx") {
    // If ExcelJS is available, use it to embed images and format neatly
    if (window.ExcelJS) {
      const workbook = new window.ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Scouting Candidate");
      worksheet.columns = [
        { header: "No", key: "no", width: 6 },
        { header: "Foto", key: "foto", width: 14 },
        { header: "ID Talenta", key: "id", width: 22 },
        { header: "Nama Kandidat", key: "nama", width: 24 },
        { header: "No. WhatsApp", key: "whatsapp", width: 18 },
        { header: "Email", key: "email", width: 26 },
        { header: "Kota / Domisili", key: "kota", width: 20 },
        { header: "Posisi", key: "posisi", width: 22 },
        { header: "Sub Team / Role", key: "role", width: 20 },
        { header: "Platform Channel", key: "platform", width: 16 },
        { header: "Link Channel", key: "linkProfile", width: 34 },
        { header: "Status", key: "status", width: 16 },
        { header: "PIC (Assigned To)", key: "assignedTo", width: 24 },
        { header: "Tanggal Input", key: "tanggalInput", width: 18 },
        { header: "Jadwal Interview", key: "tanggalInterview", width: 22 },
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0B2B6A" },
      };
      headerRow.height = 28;

      const imageCache = new Map();
      for (const item of rowsData) {
        const row = worksheet.addRow({
          no: item.no,
          foto: item.photoUrl ? "" : "No Image",
          id: item.id,
          nama: item.nama,
          whatsapp: item.whatsapp,
          email: item.email,
          kota: item.kota,
          posisi: item.posisi,
          role: item.role,
          platform: item.platform,
          linkProfile: item.linkProfile,
          status: item.status,
          assignedTo: item.assignedTo,
          tanggalInput: item.tanggalInput,
          tanggalInterview: item.tanggalInterview,
        });
        row.height = 60;
        row.alignment = { vertical: "middle", wrapText: true };
      }

      for (let i = 0; i < rowsData.length; i += 1) {
        const item = rowsData[i];
        const rowNumber = i + 2;
        const photoCell = worksheet.getCell("B" + rowNumber);
        photoCell.alignment = { vertical: "middle", horizontal: "center" };
        if (!item.photoUrl) continue;
        const imageData = await fetchImageAsBase64(item.photoUrl, imageCache);
        if (!imageData) {
          photoCell.value = "No Image";
          continue;
        }
        try {
          const imageId = workbook.addImage({
            base64: imageData.base64,
            extension: imageData.extension,
          });
          worksheet.addImage(imageId, {
            tl: { col: 1.1, row: rowNumber - 1 + 0.1 },
            ext: { width: 70, height: 70 },
          });
          photoCell.value = "";
        } catch (_) {
          photoCell.value = "No Image";
        }
      }

      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.alignment =
            rowNumber === 1
              ? { vertical: "middle", horizontal: "center" }
              : { vertical: "middle", wrapText: true };
          cell.border = {
            top: { style: "thin", color: { argb: "FFD1D5DB" } },
            left: { style: "thin", color: { argb: "FFD1D5DB" } },
            bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
            right: { style: "thin", color: { argb: "FFD1D5DB" } },
          };
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileNameBase}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }

    // Fallback if ExcelJS is not present, use SheetJS (xlsx)
    if (window.XLSX) {
      const sheetData = rowsData.map((r) => ({
        No: r.no,
        "ID Talenta": r.id,
        "Nama Kandidat": r.nama,
        "No. WhatsApp": r.whatsapp,
        Email: r.email,
        "Kota / Domisili": r.kota,
        Posisi: r.posisi,
        "Sub Team / Role": r.role,
        "Platform Channel": r.platform,
        "Link Channel": r.linkProfile,
        Status: r.status,
        "PIC (Assigned To)": r.assignedTo,
        "Tanggal Input": r.tanggalInput,
        "Jadwal Interview": r.tanggalInterview,
      }));
      const ws = window.XLSX.utils.json_to_sheet(sheetData);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, "Scouting Candidate");
      window.XLSX.writeFile(wb, `${fileNameBase}.xlsx`);
      return;
    }

    throw new Error("Library export Excel (ExcelJS/XLSX) tidak tersedia.");
  } else {
    // Format is CSV
    const csvRows = rowsData.map((r) => ({
      No: r.no,
      "ID Talenta": r.id,
      "Nama Kandidat": r.nama,
      "No. WhatsApp": r.whatsapp,
      Email: r.email,
      "Kota / Domisili": r.kota,
      Posisi: r.posisi,
      "Sub Team / Role": r.role,
      "Platform Channel": r.platform,
      "Link Channel": r.linkProfile,
      Status: r.status,
      "PIC (Assigned To)": r.assignedTo,
      "Tanggal Input": r.tanggalInput,
      "Jadwal Interview": r.tanggalInterview,
    }));

    let csvContent = "\uFEFF";
    if (window.XLSX) {
      const ws = window.XLSX.utils.json_to_sheet(csvRows);
      csvContent += window.XLSX.utils.sheet_to_csv(ws);
    } else {
      const headers = Object.keys(csvRows[0]);
      csvContent += headers.join(",") + "\n";
      csvRows.forEach((row) => {
        const line = headers
          .map((h) => {
            let str = String(row[h] || "");
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
              str = '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
          })
          .join(",");
        csvContent += line + "\n";
      });
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileNameBase}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * Backward compatibility: Export scouting talent records to Excel (.xlsx) using ExcelJS.
 * @param {Array<Object>} talents
 * @param {Object} assignUsersMap
 * @returns {Promise<void>}
 */
export async function exportScoutingToExcel(talents, assignUsersMap = {}) {
  return exportScoutingTalents({
    talents,
    format: "xlsx",
    assignUsersMap,
    periodLabel: "All",
  });
}

