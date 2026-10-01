// pages/hr/exit-interview/exit-interview.repository.js
// =====================================================================
// EXIT INTERVIEW REPOSITORY
// The data access layer for the Exit Interview feature.
// ONLY communicates with Firebase Firestore (exit_interviews, users).
// NO DOM manipulation or rendering here.
// =====================================================================

import { db } from "../../../assets/js/firebase-config.js";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  downloadExportFile,
  calcDateRange,
  formatDateIndo,
  extractTimestamp,
} from "../../../assets/js/utils/export-helper.js";

const EXIT_COLLECTION = "exit_interviews";

// Posisi yang diizinkan mengakses Exit Interview
export const ALLOWED_POSITIONS = [
  "gtebWhJ7db4xxHQxI67t",
  "Head of Department of Happy Team",
  "3jlfwya0KQuAk5Twkike",
];

/**
 * Subscribes to real-time updates of exit interview submissions.
 * Ordered by created_at descending.
 * @param {function(Array): void} onUpdate - Callback with list of items
 * @param {function(Error): void} onError - Error callback
 * @returns {function(): void} Unsubscribe function
 */
export function subscribeExitInterviews(onUpdate, onError) {
  const colRef = collection(db, EXIT_COLLECTION);
  let q;
  try {
    q = query(colRef, orderBy("created_at", "desc"));
  } catch (e) {
    q = colRef;
  }

  const handleSnapshot = (snapshot) => {
    const items = [];
    snapshot.forEach((docSnap) => {
      items.push({ id: docSnap.id, ...docSnap.data() });
    });

    // In-memory sort by created_at desc as a robust guarantee
    items.sort((a, b) => {
      const tA = a.created_at?.toMillis
        ? a.created_at.toMillis()
        : a.created_at?.seconds
          ? a.created_at.seconds * 1000
          : new Date(a.created_at || 0).getTime();
      const tB = b.created_at?.toMillis
        ? b.created_at.toMillis()
        : b.created_at?.seconds
          ? b.created_at.seconds * 1000
          : new Date(b.created_at || 0).getTime();
      return tB - tA;
    });

    onUpdate(items);
  };

  return onSnapshot(
    q,
    handleSnapshot,
    (err) => {
      console.warn("Ordered query failed, falling back to base collection:", err);
      // Fallback: try plain collection query without orderBy in case index or field types fail
      onSnapshot(
        colRef,
        handleSnapshot,
        (fallbackErr) => {
          console.error("Base collection query also failed:", fallbackErr);
          if (typeof onError === "function") onError(fallbackErr);
        },
      );
    },
  );
}

/**
 * Creates a new anonymous exit interview submission.
 * Intentionally does NOT store user_id, name, or photo to preserve anonymity.
 * @param {string} content - Submission content
 * @returns {Promise<string>} Created document ID
 */
export async function createExitInterview(content) {
  const docRef = await addDoc(collection(db, EXIT_COLLECTION), {
    content: String(content).trim(),
    created_at: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Deletes an exit interview document by its ID.
 * @param {string} id - Document ID
 * @returns {Promise<void>}
 */
export async function deleteExitInterview(id) {
  await deleteDoc(doc(db, EXIT_COLLECTION, id));
}

/**
 * Checks whether a user has an allowed position or administrative privileges.
 * @param {string} userId - User UID
 * @param {string} [role] - User custom claim role
 * @returns {Promise<boolean>}
 */
export async function checkUserPositionAccess(userId, role = null) {
  // Allow owner and admin roles directly
  if (role === "owner" || role === "admin") return true;

  if (!userId) return false;

  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) return false;

    const data = userDoc.data() || {};
    const pos = data?.employment?.position || data?.position;

    return ALLOWED_POSITIONS.includes(pos);
  } catch (err) {
    console.error("Repository: Error checking user position access:", err);
    return false;
  }
}

/**
 * Export exit interview submissions based on modal filters.
 * @param {Object} options
 * @param {string} [options.format="xlsx"]
 * @param {string} [options.rangeType="all"]
 * @param {string} [options.startDate]
 * @param {string} [options.endDate]
 * @param {string} [options.monthValue]
 * @param {string|number} [options.weekValue]
 * @returns {Promise<{ count: number, filename: string }>}
 */
export async function exportExitInterviewData({
  format = "xlsx",
  rangeType = "all",
  startDate,
  endDate,
  monthValue,
  weekValue,
}) {
  const { start, end, label: periodLabel } = calcDateRange({
    rangeType,
    startDate,
    endDate,
    monthValue,
    weekValue,
  });

  const snap = await getDocs(
    query(collection(db, EXIT_COLLECTION), orderBy("created_at", "desc")),
  );

  const raw = [];
  snap.forEach((d) => {
    raw.push({ id: d.id, ...d.data() });
  });

  const filtered = raw.filter((item) => {
    if (start && end) {
      const ts = extractTimestamp(item.created_at);
      if (!ts) return false;
      const itemDate = new Date(ts);
      if (itemDate < start || itemDate > end) return false;
    }
    return true;
  });

  const columns = [
    { header: "No", key: "no", width: 8 },
    { header: "ID Submission", key: "id", width: 24 },
    { header: "Tanggal Submission", key: "createdAt", width: 22 },
    { header: "Isi Exit Interview / Feedback", key: "content", width: 60 },
  ];

  const rows = filtered.map((item, idx) => ({
    no: idx + 1,
    id: item.id,
    createdAt: formatDateIndo(item.created_at, true) || "-",
    content: item.content || "-",
  }));

  const filename = `Data_Exit_Interview_${periodLabel}`;
  await downloadExportFile({
    filename,
    sheetName: "Exit Interview",
    columns,
    rows,
    format,
  });

  return { count: rows.length, filename };
}

