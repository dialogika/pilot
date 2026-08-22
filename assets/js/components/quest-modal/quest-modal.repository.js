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

import { auth, db, storage } from "../../firebase-config.js";
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
import { getMs } from "../../utils.js";

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export { auth, storage };

/* ------------------------------------------------------------------ */
/* Tasks (shared collection; Quest-owned operations)                   */
/* ------------------------------------------------------------------ */

/**
 * Resolve all aliases for a user (Auth UID, Firestore User Doc ID, Email).
 * @param {string} [uid]
 * @returns {Promise<Array<string>>}
 */
export async function getUserAliases(uid) {
  const aliases = new Set();
  if (uid) aliases.add(uid);
  if (auth.currentUser) {
    if (auth.currentUser.uid) aliases.add(auth.currentUser.uid);
    if (auth.currentUser.email) aliases.add(auth.currentUser.email);
  }

  try {
    const usersMap = await loadUsersMap();
    Object.keys(usersMap).forEach((k) => {
      const u = usersMap[k];
      if (u) {
        const matches =
          (u.uid && aliases.has(u.uid)) ||
          (u.email && aliases.has(u.email)) ||
          aliases.has(k);
        if (matches) {
          aliases.add(k);
          if (u.uid) aliases.add(u.uid);
          if (u.email) aliases.add(u.email);
        }
      }
    });
  } catch (_) {}

  return Array.from(aliases);
}

/**
 * Load all quest tasks.
 * Returns the raw query snapshot iterated by the caller-free helper.
 * @param {()=>void} [onDone] internal
 */
export async function listQuestTasks() {
  const rows = [];
  const seenIds = new Set();

  function addSnap(snap) {
    if (!snap) return;
    snap.forEach((ds) => {
      if (!seenIds.has(ds.id)) {
        seenIds.add(ds.id);
        rows.push({ id: ds.id, data: ds.data() || {} });
      }
    });
  }

  // 1. Try global collection fetch on "quests"
  let globalSucceeded = false;
  try {
    const snap = await getDocs(collection(db, "quests"));
    addSnap(snap);
    globalSucceeded = true;
  } catch (err) {
    console.warn("[QuestModal] Global 'quests' read restricted, attempting targeted user queries...", err);
  }

  // 2. If global read failed, query across all user aliases
  if (!globalSucceeded && auth.currentUser) {
    const aliases = await getUserAliases(auth.currentUser.uid);
    for (const alias of aliases) {
      try {
        const qAssign = query(
          collection(db, "quests"),
          where("assign_to", "array-contains", alias),
        );
        const snapAssign = await getDocs(qAssign);
        addSnap(snapAssign);
      } catch (e) {}

      try {
        const qReport = query(
          collection(db, "quests"),
          where("report_to", "array-contains", alias),
        );
        const snapReport = await getDocs(qReport);
        addSnap(snapReport);
      } catch (e) {}

      try {
        const qCreator = query(
          collection(db, "quests"),
          where("created_by", "==", alias),
        );
        const snapCreator = await getDocs(qCreator);
        addSnap(snapCreator);
      } catch (e) {}
    }
  }

  // 3. Fallback: If no rows found, also check "tasks" collection
  if (rows.length === 0) {
    try {
      const snapTasks = await getDocs(collection(db, "tasks"));
      addSnap(snapTasks);
    } catch (_) {
      if (auth.currentUser) {
        const aliases = await getUserAliases(auth.currentUser.uid);
        for (const alias of aliases) {
          try {
            const qTasks = query(
              collection(db, "tasks"),
              where("assign_to", "array-contains", alias),
            );
            const snapT = await getDocs(qTasks);
            addSnap(snapT);
          } catch (_) {}
        }
      }
    }
  }

  return rows;
}

async function shrinkDataUrl(dataUrl, maxW = 600, quality = 0.5) {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxW) {
          h = Math.round((h * maxW) / w);
          w = maxW;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch (e) {
      resolve(dataUrl);
    }
  });
}

/**
 * Ensure data:image/... in HTML description is compressed (< 30 KB) for reliable Firestore storage.
 * @param {string} html
 * @returns {Promise<string>}
 */
export async function processDescriptionImages(html) {
  if (!html || typeof html !== "string" || !html.includes("data:image/")) {
    return html;
  }

  try {
    const parser = new DOMParser();
    const docParsed = parser.parseFromString(html, "text/html");
    const imgEls = docParsed.querySelectorAll('img[src^="data:image/"]');
    if (!imgEls.length) return html;

    for (let i = 0; i < imgEls.length; i++) {
      const img = imgEls[i];
      const dataUrl = img.getAttribute("src");
      if (!dataUrl) continue;

      // Compress to lightweight JPEG (< 30 KB)
      const shrunk = await shrinkDataUrl(dataUrl, 600, 0.5);
      img.setAttribute("src", shrunk);
    }

    return docParsed.body.innerHTML;
  } catch (e) {
    console.warn("quest-modal: processDescriptionImages error", e);
    return html;
  }
}

/**
 * Create a new quest task.
 * @param {Object} payload
 * @returns {Promise<string>} new doc id
 */
export async function createTask(payload) {
  let desc = payload.description || "";
  if (desc && desc.includes("data:image/")) {
    desc = await processDescriptionImages(desc);
  }

  const uid = auth.currentUser ? auth.currentUser.uid : (payload.created_by || "");
  const assigned = Array.isArray(payload.assign_to) && payload.assign_to.length > 0
    ? payload.assign_to
    : (payload.assign_to ? [payload.assign_to] : (uid ? [uid] : []));

  const p = {
    title: String(payload.title || "").trim(),
    description: desc,
    status: payload.status || "Initiate",
    priority: payload.priority || "normal",
    points: typeof payload.points === "number" ? payload.points : Number(payload.points) || 0,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    assign_to: assigned,
    notify_to: Array.isArray(payload.notify_to) && payload.notify_to.length > 0 ? payload.notify_to : assigned,
    report_to: Array.isArray(payload.report_to) ? payload.report_to : [],
    departments: Array.isArray(payload.departments) ? payload.departments : [],
    positions: Array.isArray(payload.positions) ? payload.positions : [],
    created_by: uid,
    created_by_name: payload.created_by_name || (auth.currentUser ? (auth.currentUser.displayName || auth.currentUser.email || "") : ""),
    created_at: serverTimestamp(),
  };

  if (payload.type) p.type = payload.type;
  if (payload.quest_type) p.quest_type = payload.quest_type;
  if (payload.deadline_time) p.deadline_time = payload.deadline_time;
  if (payload.due_date) p.due_date = payload.due_date;
  if (payload.start_date) p.start_date = payload.start_date;
  if (payload.start_time) p.start_time = payload.start_time;
  if (payload.project_id) p.project_id = payload.project_id;
  if (payload.list_id) p.list_id = payload.list_id;

  if (payload.recur && typeof payload.recur === "object") {
    p.recur = payload.recur;
  }

  try {
    const refDoc = await addDoc(collection(db, "quests"), p);
    return refDoc.id;
  } catch (err) {
    console.error("[QuestModal] addDoc to quests failed:", err, "Payload:", p);
    throw err;
  }
}

/**
 * Update an existing quest task (partial).
 * @param {string} taskId
 * @param {Object} patch
 */
export async function updateTask(taskId, patch) {
  const p = { ...patch };
  if (p.description && p.description.includes("data:image/")) {
    p.description = await processDescriptionImages(p.description);
  }
  Object.keys(p).forEach((k) => {
    if (p[k] === undefined) delete p[k];
  });
  try {
    await updateDoc(doc(db, "quests", taskId), p);
  } catch (err) {
    console.error("[QuestModal] updateDoc to quests failed:", err, "Payload:", p);
    throw err;
  }
}

/**
 * Delete a quest task.
 * @param {string} taskId
 */
export async function deleteTask(taskId) {
  await deleteDoc(doc(db, "quests", taskId));
}

/**
 * Toggle a task's complete status (legacy: Complete / Initiate).
 * @param {string} taskId
 * @param {string} status
 */
export async function toggleTask(taskId, status) {
  await updateDoc(doc(db, "quests", taskId), { status });
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
  await updateDoc(doc(db, "quests", taskId), patch);
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
  
  // Load positions map to resolve position IDs (e.g. random ID -> "Website Development")
  const posMap = {};
  try {
    const posSnap = await getDocs(collection(db, "positions"));
    posSnap.forEach((pDoc) => {
      const pData = pDoc.data() || {};
      const pName = pData.name || pData.title || pData.label || pData.position || "";
      if (pName) {
        posMap[pDoc.id] = pName;
        if (pData.id) posMap[pData.id] = pName;
      }
    });
  } catch (e) {
    console.warn("quest-modal: failed to cache positions in loadUsersMap", e);
  }

  try {
    const snap = await getDocs(collection(db, "users"));
    snap.forEach((ds) => {
      const d = ds.data() || {};
      let posRaw = d.position || (d.employment && d.employment.position) || d.position_name || d.job_position || d.role_title || "";
      let pos = typeof posRaw === "object" && posRaw ? (posRaw.name || posRaw.title || posRaw.id || "") : String(posRaw || "");
      if (pos && posMap[pos]) {
        pos = posMap[pos];
      }

      const deptRaw = d.department || d.department_name || d.dept || (d.employment && d.employment.department) || (Array.isArray(d.departments) ? d.departments[0] : "") || "";
      const dept = typeof deptRaw === "object" && deptRaw ? (deptRaw.name || deptRaw.id || "") : String(deptRaw || "");
      const name = d.full_name || d.name || d.displayName || d.nama || d.nickname || d.username || d.email || "Unknown";
      const photo = d.photo || d.photoURL || d.photoUrl || d.candidatePhoto || d.avatar || d.avatar_url || d.picture || d.profileImage || d.image || "";

      const userPositions = [];
      if (pos) userPositions.push(pos);
      if (posRaw && posRaw !== pos) userPositions.push(String(posRaw));
      if (Array.isArray(d.positions)) {
        d.positions.forEach((p) => {
          if (typeof p === "object" && p) userPositions.push(p.name || p.title || p.id || "");
          else if (p) {
            userPositions.push(posMap[p] || p);
          }
        });
      }

      const userData = {
        name,
        role: d.role || (d.access && d.access.role_id) || "",
        role_title: d.role_title || d.job_title || d.title || "",
        department: dept,
        departments: Array.isArray(d.departments) ? d.departments : (dept ? [dept] : []),
        position: pos,
        position_name: d.position_name || "",
        positions: userPositions,
        employment: d.employment || {},
        photo: String(photo || "").trim(),
        docId: ds.id,
        uid: d.uid || ds.id,
        email: d.email || "",
      };

      map[ds.id] = userData;
      if (d.uid && d.uid !== ds.id) {
        map[d.uid] = userData;
      }
    });
  } catch (e) {
    console.warn("quest-modal: failed to load users map", e);
  }
  return map;
}

/**
 * Load all departments as [{ id, name }].
 * @returns {Promise<Array>}
 */
export async function loadDepartments() {
  const rows = [];
  try {
    let snap = null;
    try {
      snap = await getDocs(collection(db, "department"));
    } catch (_) {
      snap = await getDocs(collection(db, "departments"));
    }
    if (snap) {
      snap.forEach((ds) => {
        const d = ds.data() || {};
        rows.push({ id: ds.id, name: d.name || d.label || d.title || ds.id });
      });
    }
  } catch (e) {
    console.warn("quest-modal: loadDepartments failed, using defaults", e);
  }
  return rows;
}

/**
 * Load all positions as [{ id, name }].
 * @returns {Promise<Array>}
 */
export async function loadPositions() {
  const rows = [];
  try {
    let snap = null;
    try {
      snap = await getDocs(collection(db, "position"));
    } catch (_) {
      snap = await getDocs(collection(db, "positions"));
    }
    if (snap) {
      snap.forEach((ds) => {
        const d = ds.data() || {};
        rows.push({ id: ds.id, name: d.name || d.label || d.title || d.position || ds.id });
      });
    }
  } catch (e) {
    console.warn("quest-modal: loadPositions failed, using defaults", e);
  }
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

export { getMs };
