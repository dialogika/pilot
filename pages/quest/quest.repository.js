// pages/quest/quest.repository.js
// =====================================================================
// QUEST DATA ACCESS — the ONLY Quest module that talks to Firebase.
//
// RULES:
//  - Every Firestore/Auth/Storage read & write for Quest lives here.
//  - NO DOM manipulation, NO rendering, NO toast/modal here.
//  - Uses the single Firebase init from assets/js/firebase-config.js.
//  - Returns plain data; the orchestrator decides what to render.
//
// SCOPE: Quest Board, Quest Reports (quest_reports), Daily Report
//        (intern_dailyreport) + supporting reads (users/departments/positions).
//        `tasks` is shared with Projects (documented; no shared abstraction).
// =====================================================================

import { auth, db, storage } from "../../assets/js/firebase-config.js";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getMs } from "../../assets/js/utils.js";

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export { auth, storage };

/* ------------------------------------------------------------------ */
/* Tasks (shared collection; Quest-owned operations)                   */
/* ------------------------------------------------------------------ */

/**
 * Load all quest tasks.
 * Returns the raw query snapshot iterated by the caller-free helper.
 * @param {()=>void} [onDone] internal
 */
export async function listQuestTasks() {
  const snap = await getDocs(collection(db, "tasks"));
  const rows = [];
  snap.forEach((ds) => rows.push({ id: ds.id, data: ds.data() || {} }));
  return rows;
}

/**
 * Create a new quest task.
 * @param {Object} payload
 * @returns {Promise<string>} new doc id
 */
export async function createTask(payload) {
  const p = { ...payload, created_at: serverTimestamp(), status: payload.status || "Initiate" };
  const refDoc = await addDoc(collection(db, "tasks"), p);
  return refDoc.id;
}

/**
 * Update an existing quest task (partial).
 * @param {string} taskId
 * @param {Object} patch
 */
export async function updateTask(taskId, patch) {
  await updateDoc(doc(db, "tasks", taskId), patch);
}

/**
 * Delete a quest task.
 * @param {string} taskId
 */
export async function deleteTask(taskId) {
  await deleteDoc(doc(db, "tasks", taskId));
}

/**
 * Toggle a task's complete status (legacy: Complete / Initiate).
 * @param {string} taskId
 * @param {string} status
 */
export async function toggleTask(taskId, status) {
  await updateDoc(doc(db, "tasks", taskId), { status });
}

/**
 * Mark a task reported + who did it.
 * @param {string} taskId
 * @param {Array<string>} whoDidThis
 */
export async function markTaskReported(taskId, whoDidThis = []) {
  const patch = { status: "reported" };
  if (Array.isArray(whoDidThis) && whoDidThis.length > 0) {
    patch.last_reported_by = whoDidThis;
    patch.last_reported_at = serverTimestamp();
  }
  await updateDoc(doc(db, "tasks", taskId), patch);
}

/* ------------------------------------------------------------------ */
/* Quest Reports (quest_reports)                                       */
/* ------------------------------------------------------------------ */

/**
 * Create a side-quest completion report.
 * @param {{taskId:string, content:string, files:Array}} payload
 */
export async function createQuestReport(payload) {
  await addDoc(collection(db, "quest_reports"), {
    taskId: payload.taskId,
    content: payload.content,
    files: payload.files || [],
    submittedAt: new Date().toISOString(),
    submittedBy: auth.currentUser ? auth.currentUser.uid : "unknown",
  });
}

/**
 * Upload report files to Storage (reports/{taskId}/...).
 * @param {string} taskId
 * @param {FileList|Array} files
 * @returns {Promise<Array>} [{name, url, type}]
 */
export async function uploadReportFiles(taskId, files) {
  const result = [];
  if (!files || !files.length) return result;
  for (const file of files) {
    const path = "reports/" + taskId + "/" + Date.now() + "_" + file.name;
    const sRef = ref(storage, path);
    await uploadBytes(sRef, file);
    const url = await getDownloadURL(sRef);
    result.push({ name: file.name, url, type: file.type });
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Daily Report (intern_dailyreport)                                   */
/* ------------------------------------------------------------------ */

/**
 * Submit a daily report.
 * @param {Object} payload {date,date_label,user_id,name,departments,tasks,total_points}
 * @returns {Promise<string>} new doc id
 */
export async function submitDailyReport(payload) {
  const p = {
    ...payload,
    status: payload.status || "Pending Review",
    created_at: serverTimestamp(),
  };
  const refDoc = await addDoc(collection(db, "intern_dailyreport"), p);
  return refDoc.id;
}

/* ------------------------------------------------------------------ */
/* Supporting reads (users / departments / positions)                  */
/* ------------------------------------------------------------------ */

/**
 * Load a map of uid -> { name, role, department, photo }.
 * @returns {Promise<Object>}
 */
export async function loadUsersMap() {
  const map = {};
  const snap = await getDocs(collection(db, "users"));
  snap.forEach((ds) => {
    const d = ds.data() || {};
    map[ds.id] = {
      name: d.full_name || d.displayName || d.name || d.email || d.username || "",
      role: d.role || "",
      department: d.department || "",
      photo: d.photo || d.photoURL || d.avatar || "",
    };
  });
  return map;
}

/**
 * Load all departments as [{ id, name }].
 * @returns {Promise<Array>}
 */
export async function loadDepartments() {
  const snap = await getDocs(collection(db, "departments"));
  const rows = [];
  snap.forEach((ds) => {
    const d = ds.data() || {};
    rows.push({ id: ds.id, name: d.name || d.label || d.title || ds.id });
  });
  return rows;
}

/**
 * Load all positions as [{ id, name }].
 * @returns {Promise<Array>}
 */
export async function loadPositions() {
  const snap = await getDocs(collection(db, "positions"));
  const rows = [];
  snap.forEach((ds) => {
    const d = ds.data() || {};
    rows.push({ id: ds.id, name: d.name || d.label || d.title || ds.id });
  });
  return rows;
}

/**
 * Resolve a raw position value into a readable name.
 * @param {string} raw
 * @param {Object} positionsMap
 * @returns {string}
 */
export function resolvePositionName(raw, positionsMap) {
  if (!raw || raw === "-") return "-";
  if (positionsMap && positionsMap[raw]) return positionsMap[raw];
  return raw;
}

/* ------------------------------------------------------------------ */
/* Date helpers (repository-neutral)                                   */
/* ------------------------------------------------------------------ */

/**
 * Normalize a date-like value to epoch ms.
 * @param {any} value
 * @returns {number|null}
 */
export function toMs(value) {
  return getMs(value);
}