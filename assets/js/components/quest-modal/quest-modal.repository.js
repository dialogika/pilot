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
  writeBatch,
  serverTimestamp,
  arrayUnion,
  deleteField,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getMs } from "../../utils.js";

export function isReportedToday(data, myAliases) {
  if (!data) return false;
  const normStatus = String(data.status || data.task_status || data.Status || "").toLowerCase();
  if (normStatus === "rejected" || normStatus === "approved" || normStatus.includes("approv") || normStatus.includes("reject")) return false;
  if (data.user_status && (String(data.user_status).toLowerCase() === "approved" || String(data.user_status).toLowerCase() === "rejected")) return false;

  const msAppr = getMs(data.last_approved_at || data.approved_at);
  const msRej = getMs(data.last_rejected_at || data.rejected_at);
  const msRep = getMs(data.last_reported_at);

  if (msAppr && msRep && msAppr >= msRep) return false;
  if (msRej && msRep && msRej >= msRep) return false;

  // Check per-user rejection in rejected_users
  if (data.rejected_users && myAliases && myAliases.length > 0) {
    const isUserRejected = Object.keys(data.rejected_users).some((uid) => myAliases.includes(String(uid).toLowerCase().trim()));
    if (isUserRejected) return false;
  }

  const lrb = data.last_reported_by;
  const lra = data.last_reported_at;
  if (!Array.isArray(lrb) || !lrb.length || !lra) return false;
  const ms = getMs(lra);
  if (!ms) return false;
  const reported = new Date(ms);
  const today = new Date();
  const isToday =
    reported.getFullYear() === today.getFullYear() &&
    reported.getMonth() === today.getMonth() &&
    reported.getDate() === today.getDate();
  if (!isToday) return false;

  if (myAliases && myAliases.length > 0) {
    const reportedByList = lrb.map((x) => String(x).toLowerCase().trim());
    return reportedByList.some((uid) => myAliases.includes(uid));
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export { auth, storage };

/* ------------------------------------------------------------------ */
/* Tasks (shared collection; Quest-owned operations)                   */
/* ------------------------------------------------------------------ */

/**
 * Helper to fetch all possible aliases for a user (docId, uid, email, full name, etc.)
 * Strictly matches the target user's record without fuzzy-matching other users.
 * @param {string} uid
 * @returns {Promise<Array<string>>}
 */
export async function getUserAliases(uid) {
  const aliases = new Set();
  const currentUid = uid || auth.currentUser?.uid || "";
  const currentEmail = auth.currentUser?.email || "";
  const currentDisplayName = auth.currentUser?.displayName || "";

  if (currentUid) {
    aliases.add(currentUid);
    aliases.add(String(currentUid).toLowerCase().trim());
  }
  if (currentEmail) {
    aliases.add(currentEmail);
    aliases.add(String(currentEmail).toLowerCase().trim());
  }
  if (currentDisplayName) {
    aliases.add(currentDisplayName);
    aliases.add(String(currentDisplayName).toLowerCase().trim());
    aliases.add(String(currentDisplayName).toLowerCase().replace(/[\s_-]+/g, ""));
  }

  try {
    const usersMap = await loadUsersMap();
    const matchedUsers = new Set();

    // 1. Direct lookup by key in usersMap
    const searchKeys = [
      currentUid,
      String(currentUid).toLowerCase().trim(),
      currentEmail,
      String(currentEmail).toLowerCase().trim(),
      currentDisplayName,
      String(currentDisplayName).toLowerCase().trim(),
      String(currentDisplayName).toLowerCase().replace(/[\s_-]+/g, ""),
    ].filter(Boolean);

    searchKeys.forEach((k) => {
      if (usersMap[k]) {
        matchedUsers.add(usersMap[k]);
      }
    });

    // 2. Exact match on uid, docId, email, or normalized name
    if (!matchedUsers.size) {
      Object.values(usersMap).forEach((u) => {
        if (!u) return;
        const uDocId = u.docId ? String(u.docId).toLowerCase().trim() : "";
        const uUid = u.uid ? String(u.uid).toLowerCase().trim() : "";
        const uEmail = u.email ? String(u.email).toLowerCase().trim() : "";
        const uName = u.name ? String(u.name).toLowerCase().trim() : "";
        const uNameNoSpace = uName.replace(/[\s_-]+/g, "");

        const uidTarget = String(currentUid).toLowerCase().trim();
        const emailTarget = String(currentEmail).toLowerCase().trim();
        const nameTarget = String(currentDisplayName).toLowerCase().trim();
        const nameTargetNoSpace = nameTarget.replace(/[\s_-]+/g, "");

        if (
          (uidTarget && (uDocId === uidTarget || uUid === uidTarget)) ||
          (emailTarget && uEmail === emailTarget) ||
          (nameTarget && nameTarget.length >= 3 && (uName === nameTarget || (uNameNoSpace && uNameNoSpace === nameTargetNoSpace)))
        ) {
          matchedUsers.add(u);
        }
      });
    }

    // 3. Collect only the exact aliases of the matched user record
    matchedUsers.forEach((u) => {
      if (u.docId) {
        aliases.add(u.docId);
        aliases.add(String(u.docId).toLowerCase().trim());
        aliases.add(String(u.docId).toLowerCase().replace(/[\s_-]+/g, ""));
      }
      if (u.uid) {
        aliases.add(u.uid);
        aliases.add(String(u.uid).toLowerCase().trim());
      }
      if (u.email) {
        aliases.add(u.email);
        aliases.add(String(u.email).toLowerCase().trim());
      }
      if (u.name) {
        aliases.add(u.name);
        aliases.add(String(u.name).toLowerCase().trim());
        aliases.add(String(u.name).toLowerCase().replace(/[\s_-]+/g, ""));
      }
      if (Array.isArray(u.allAliases)) {
        u.allAliases.forEach((a) => {
          if (a) {
            aliases.add(a);
            aliases.add(String(a).toLowerCase().trim());
            aliases.add(String(a).toLowerCase().replace(/[\s_-]+/g, ""));
          }
        });
      }
    });
  } catch (e) {
    console.warn("quest-modal.repository: getUserAliases lookup error:", e);
  }

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
  let questsGlobalSucceeded = false;
  try {
    const snap = await getDocs(collection(db, "quests"));
    addSnap(snap);
    questsGlobalSucceeded = true;
  } catch (err) {
    console.warn("[QuestModal] Global 'quests' read restricted, attempting targeted user queries...", err);
  }

  // 2. Try global collection fetch on "tasks" (legacy & shared tasks)
  try {
    const snapTasks = await getDocs(collection(db, "tasks"));
    addSnap(snapTasks);
  } catch (err) {
    console.warn("[QuestModal] Global 'tasks' read restricted, attempting targeted user queries...", err);
  }

  // 3. Targeted queries across all user aliases if global read failed or for thoroughness
  if (auth.currentUser) {
    const aliases = await getUserAliases(auth.currentUser.uid);
    for (const alias of aliases) {
      if (!questsGlobalSucceeded) {
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

      // Targeted tasks fallback
      try {
        const qTasks = query(
          collection(db, "tasks"),
          where("assign_to", "array-contains", alias),
        );
        const snapT = await getDocs(qTasks);
        addSnap(snapT);
      } catch (_) {}

      try {
        const qTasksCreator = query(
          collection(db, "tasks"),
          where("created_by", "==", alias),
        );
        const snapTC = await getDocs(qTasksCreator);
        addSnap(snapTC);
      } catch (_) {}
    }
  }

  // 4. Cross-reference latest intern_dailyreport statuses strictly for the CURRENT user
  const myAliases = auth.currentUser ? await getUserAliases(auth.currentUser.uid) : [];
  const myAliasSet = new Set(myAliases.map((a) => String(a).toLowerCase().trim()));
  if (auth.currentUser) {
    if (auth.currentUser.uid) myAliasSet.add(auth.currentUser.uid.toLowerCase().trim());
    if (auth.currentUser.email) myAliasSet.add(auth.currentUser.email.toLowerCase().trim());
    if (auth.currentUser.displayName) myAliasSet.add(auth.currentUser.displayName.toLowerCase().trim());
  }

  try {
    const dailySnap = await getDocs(collection(db, "intern_dailyreport"));
    const dailyDocs = [];
    dailySnap.forEach((docSnap) => {
      dailyDocs.push({ id: docSnap.id, data: docSnap.data() || {} });
    });

    // Sort ascending so newer reports overwrite older reports
    function getDocSortTime(d) {
      if (!d) return 0;
      const t = getMs(d.created_at || d.timestamp || d.submitted_at);
      if (t) return t;
      if (d.date) {
        const dt = getMs(d.date);
        if (dt) return dt;
      }
      if (d.report_date) {
        const rdt = new Date(d.report_date).getTime();
        if (!isNaN(rdt) && rdt > 0) return rdt;
      }
      return Date.now();
    }
    dailyDocs.sort((a, b) => getDocSortTime(a.data) - getDocSortTime(b.data));

    const taskReportStatusMap = {};
    dailyDocs.forEach(({ data: ddata }) => {
      const authorId = String(ddata.user_id || ddata.userId || ddata.author_id || "").toLowerCase().trim();
      const authorEmail = String(ddata.email || "").toLowerCase().trim();
      const authorName = String(ddata.name || ddata.user_name || "").toLowerCase().trim();
      const authorNameNoSpace = authorName.replace(/[\s_-]+/g, "");

      const docStatus = String(ddata.status || "").trim();
      const tasks = Array.isArray(ddata.tasks) ? ddata.tasks : [];
      tasks.forEach((t) => {
        const tid = String(t.task_id || t.taskId || t.id || "").trim();
        const tTitle = String(t.title || t.task || "").toLowerCase().trim();
        const whoList = Array.isArray(t.who_did_this) ? t.who_did_this.map((w) => String(w).toLowerCase().trim()) : [];

        const isMyReport =
          !auth.currentUser ||
          whoList.some((w) => myAliasSet.has(w)) ||
          (authorId && (myAliasSet.has(authorId) || myAliasSet.has(authorId.replace(/[\s_-]+/g, "")))) ||
          (authorEmail && (myAliasSet.has(authorEmail) || myAliasSet.has(authorEmail.replace(/[\s_-]+/g, "")))) ||
          (authorName && (myAliasSet.has(authorName) || (authorNameNoSpace && Array.from(myAliasSet).some((a) => a.replace(/[\s_-]+/g, "") === authorNameNoSpace))));

        const rawTStatus = String(t.status || "").toLowerCase().trim();
        const rawDocStatus = docStatus.toLowerCase().trim();
        
        let finalStatus = "Reported";
        if (rawTStatus.includes("approv") || (rawDocStatus === "approved" && !rawTStatus.includes("reject"))) {
          finalStatus = "Approved";
        } else if (rawTStatus.includes("reject") || (rawDocStatus === "rejected" && !rawTStatus.includes("approv"))) {
          finalStatus = "Rejected";
        } else {
          finalStatus = "Reported";
        }

        const reason = t.rejection_reason || t.feedback || ddata.rejection_reason || ddata.feedback || "";
        const entry = { status: finalStatus, reason, isMyReport: Boolean(isMyReport), authorId };

        if (tid) {
          const existing = taskReportStatusMap[tid];
          if (
            !existing ||
            (!existing.isMyReport && isMyReport) ||
            (existing.status !== "Approved" && finalStatus === "Approved") ||
            (existing.status !== "Approved" && finalStatus === "Rejected")
          ) {
            taskReportStatusMap[tid] = entry;
          }
        }
        if (tTitle) {
          const existing = taskReportStatusMap[tTitle];
          if (
            !existing ||
            (!existing.isMyReport && isMyReport) ||
            (existing.status !== "Approved" && finalStatus === "Approved") ||
            (existing.status !== "Approved" && finalStatus === "Rejected")
          ) {
            taskReportStatusMap[tTitle] = entry;
          }
        }
      });
    });

    // Also cross-reference legacy/root quest_reports
    try {
      const qrSnap = await getDocs(collection(db, "quest_reports"));
      const qrDocs = [];
      qrSnap.forEach((ds) => qrDocs.push({ id: ds.id, data: ds.data() || {} }));
      qrDocs.sort((a, b) => {
        const aTime = getMs(a.data.created_at || a.data.timestamp || a.data.submitted_at || a.data.date || 0) || 0;
        const bTime = getMs(b.data.created_at || b.data.timestamp || b.data.submitted_at || b.data.date || 0) || 0;
        return aTime - bTime;
      });

      qrDocs.forEach(({ data: qdata }) => {
        const authorId = String(qdata.submittedBy || qdata.user_id || qdata.userId || qdata.authorId || "").toLowerCase().trim();
        const authorEmail = String(qdata.email || "").toLowerCase().trim();
        const authorName = String(qdata.name || qdata.user_name || "").toLowerCase().trim();
        const isMyReport =
          !auth.currentUser ||
          (authorId && myAliasSet.has(authorId)) ||
          (authorEmail && myAliasSet.has(authorEmail)) ||
          (authorName && myAliasSet.has(authorName));

        const tid = String(qdata.task_id || qdata.taskId || "").trim();
        const tTitle = String(qdata.title || qdata.task || "").toLowerCase().trim();
        const appr = String(qdata.approval_status || qdata.approvalStatus || qdata.status || "").trim();
        const reason = qdata.feedback || qdata.rejection_reason || "";
        if (appr) {
          const entry = { status: appr, reason, isMyReport: Boolean(isMyReport) };
          if (tid) {
            const existing = taskReportStatusMap[tid];
            if (!existing || (!existing.isMyReport && isMyReport) || (existing.status !== "Approved" && appr.toLowerCase().includes("approv")) || (existing.status !== "Approved" && appr.toLowerCase().includes("reject"))) {
              taskReportStatusMap[tid] = entry;
            }
          }
          if (tTitle) {
            const existing = taskReportStatusMap[tTitle];
            if (!existing || (!existing.isMyReport && isMyReport) || (existing.status !== "Approved" && appr.toLowerCase().includes("approv")) || (existing.status !== "Approved" && appr.toLowerCase().includes("reject"))) {
              taskReportStatusMap[tTitle] = entry;
            }
          }
        }
      });
    } catch (_) {}

    rows.forEach((row) => {
      const data = row.data || {};
      const tid = String(row.id || "").trim();
      const titleLower = String(data.task || data.task_name || data.title || "").toLowerCase().trim();
      let reportStatus = taskReportStatusMap[tid] || (titleLower ? taskReportStatusMap[titleLower] : null);

      if (!reportStatus && titleLower) {
        const foundKey = Object.keys(taskReportStatusMap).find((k) => {
          if (!k || k.length < 4) return false;
          return titleLower.includes(k) || k.includes(titleLower);
        });
        if (foundKey) {
          reportStatus = taskReportStatusMap[foundKey];
        }
      }

      const directStatus = String(data.status || data.task_status || data.Status || "").toLowerCase();
      const userRejection = data.rejected_users && Object.keys(data.rejected_users).some((uid) => myAliasSet.has(String(uid).toLowerCase().trim()));
      const userRejectionData = userRejection
        ? Object.entries(data.rejected_users).find(([uid]) => myAliasSet.has(String(uid).toLowerCase().trim()))?.[1]
        : null;

      // Per-user approval detection (multi-assignee): approved_users[uid] mirrors rejected_users[uid]
      const userApproval = data.approved_users && Object.keys(data.approved_users).some(
        (uid) => myAliasSet.has(String(uid).toLowerCase().trim())
      );

      const msRej = getMs(data.last_rejected_at || data.rejected_at);
      const msRep = getMs(data.last_reported_at);
      const isRejectionNewerThanReport = Boolean(msRej && msRep && msRej >= msRep);

      const hasTaskRejection =
        userRejection ||
        directStatus === "rejected" ||
        directStatus.includes("reject") ||
        isRejectionNewerThanReport ||
        Boolean(data.rejection_reason || data.feedback);

      const taskRejectionReason =
        (userRejectionData && userRejectionData.reason) || data.rejection_reason || data.feedback || "Ditolak dalam review";
      const isReported = isReportedToday(data, myAliases);

      // Priority 1: explicit per-user approval flag (approved_users[uid]) – most reliable
      if (userApproval) {
        row.data.user_status = "Approved";
        row.data.rejection_reason = "";
      } else if (userRejection) {
        row.data.user_status = "Rejected";
        row.data.rejection_reason = taskRejectionReason;
      } else if (reportStatus) {
        // Priority 2: status from intern_dailyreport cross-reference
        const stLower = String(reportStatus.status || "").toLowerCase();
        if (stLower.includes("reject")) {
          row.data.user_status = "Rejected";
          row.data.rejection_reason = reportStatus.reason || taskRejectionReason;
        } else if (stLower.includes("approv")) {
          row.data.user_status = "Approved";
          row.data.rejection_reason = "";
        } else if (stLower.includes("pend") || stLower.includes("report") || stLower.includes("partial")) {
          if (hasTaskRejection) {
            row.data.user_status = "Rejected";
            row.data.rejection_reason = taskRejectionReason;
          } else {
            row.data.user_status = "Reported";
            row.data.rejection_reason = "";
          }
        } else if (hasTaskRejection) {
          row.data.user_status = "Rejected";
          row.data.rejection_reason = taskRejectionReason;
        } else {
          row.data.user_status = "To Do";
          row.data.rejection_reason = "";
        }
      } else {
        // Priority 3: fallback to task-level signals
        const isPersonallyApproved = directStatus.includes("approv");

        if (isPersonallyApproved) {
          row.data.user_status = "Approved";
          row.data.rejection_reason = "";
        } else if (hasTaskRejection) {
          row.data.user_status = "Rejected";
          row.data.rejection_reason = taskRejectionReason;
        } else if (isReported) {
          row.data.user_status = "Reported";
          row.data.rejection_reason = "";
        } else {
          row.data.user_status = "To Do";
          row.data.rejection_reason = "";
        }
      }
    });
  } catch (e) {
    console.warn("[QuestModal] Could not cross-reference intern_dailyreport:", e);
    // Even if cross-reference fails, run approved_users/rejected_users check via normalizeTask
  }

  // Final pass: apply approved_users / rejected_users from task doc data
  // This runs outside try-catch so it's always executed even if intern_dailyreport fetch failed
  rows.forEach((row) => {
    if (row.data.user_status && row.data.user_status !== "To Do") return; // already resolved
    const data = row.data || {};
    const directStatus = String(data.status || data.task_status || data.Status || "").toLowerCase();
    // Check approved_users[uid] per-user (most reliable for multi-assignee)
    const userApproval = data.approved_users && Object.keys(data.approved_users).some(
      (uid) => myAliasSet.has(String(uid).toLowerCase().trim())
    );
    const userRejection = data.rejected_users && Object.keys(data.rejected_users).some(
      (uid) => myAliasSet.has(String(uid).toLowerCase().trim())
    );
    if (userApproval) {
      row.data.user_status = "Approved";
      row.data.rejection_reason = "";
    } else if (userRejection || directStatus.includes("reject")) {
      row.data.user_status = "Rejected";
      row.data.rejection_reason = data.rejection_reason || data.feedback || "";
    } else if (directStatus.includes("approv")) {
      row.data.user_status = "Approved";
      row.data.rejection_reason = "";
    }
  });

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
 * Delete multiple quest tasks in batch.
 * @param {string[]} taskIds
 */
export async function deleteTasks(taskIds) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) return;
  // Firestore batches support up to 500 operations per batch
  const chunkSize = 400;
  for (let i = 0; i < taskIds.length; i += chunkSize) {
    const chunk = taskIds.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach((id) => {
      batch.delete(doc(db, "quests", id));
    });
    await batch.commit();
  }
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
  const cleanWho = (Array.isArray(whoDidThis) ? whoDidThis : [whoDidThis])
    .map((x) => String(x).trim())
    .filter(Boolean);

  const authUid = auth.currentUser ? auth.currentUser.uid : "";
  const allWho = Array.from(new Set([...cleanWho, authUid].filter(Boolean)));

  const patch = {
    status: "reported",
    last_reported_at: serverTimestamp(),
  };

  if (allWho.length > 0) {
    patch.last_reported_by = arrayUnion(...allWho);
    allWho.forEach((uid) => {
      patch[`rejected_users.${uid}`] = deleteField();
    });
  }

  patch.rejection_reason = deleteField();
  patch.feedback = deleteField();
  patch.last_rejected_at = deleteField();
  patch.last_rejected_by = deleteField();

  let updated = false;
  try {
    await updateDoc(doc(db, "tasks", taskId), patch);
    updated = true;
  } catch (_) {}

  if (!updated) {
    try {
      await updateDoc(doc(db, "quests", taskId), patch);
    } catch (err) {
      console.warn("[QuestModal] markTaskReported skipped or restricted by security rules:", taskId, err);
    }
  }
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
  const authUser = auth.currentUser;
  const uid = (authUser && authUser.uid) || payload.user_id || "";
  const cleanPayload = JSON.parse(
    JSON.stringify({
      ...payload,
      user_id: uid,
      status: payload.status || "Pending Review",
    }),
  );
  cleanPayload.created_at = serverTimestamp();
  const refDoc = await addDoc(collection(db, "intern_dailyreport"), cleanPayload);
  return refDoc.id;
}

/* ------------------------------------------------------------------ */
/* Supporting reads (users / departments / positions)                  */
/* ------------------------------------------------------------------ */

/**
 * Load a map of uid -> { name, role, department, photo }.
 * @returns {Promise<Object>}
 */
/**
 * Load a map of uid/docId/email -> { name, role, department, photo, allAliases, ... }.
 * @returns {Promise<Object>}
 */
export async function loadUsersMap() {
  const map = {};
  
  // Load positions map to resolve position IDs (e.g. random ID -> "Website Development")
  const posMap = {};
  for (const colName of ["positions", "position"]) {
    try {
      const posSnap = await getDocs(collection(db, colName));
      posSnap.forEach((pDoc) => {
        const pData = pDoc.data() || {};
        const pName = pData.name || pData.title || pData.label || pData.position || "";
        if (pName) {
          posMap[pDoc.id] = pName;
          if (pData.id) posMap[pData.id] = pName;
        }
      });
    } catch (e) {}
  }

  // Load departments map to resolve department IDs
  const deptMap = {};
  for (const colName of ["departments", "department"]) {
    try {
      const deptSnap = await getDocs(collection(db, colName));
      deptSnap.forEach((dDoc) => {
        const dData = dDoc.data() || {};
        const dName = dData.name || dData.label || dData.title || "";
        if (dName) {
          deptMap[dDoc.id] = dName;
          if (dData.id) deptMap[dData.id] = dName;
        }
      });
    } catch (e) {}
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

      let deptRaw = d.department || d.department_name || d.dept || (d.employment && d.employment.department) || (Array.isArray(d.departments) ? d.departments[0] : "") || "";
      let dept = typeof deptRaw === "object" && deptRaw ? (deptRaw.name || deptRaw.id || "") : String(deptRaw || "");
      if (dept && deptMap[dept]) {
        dept = deptMap[dept];
      }

      const name = d.full_name || d.name || d.displayName || d.nama || d.nickname || d.username || d.email || "Unknown";
      const photo = d.photo || d.photoURL || d.photoUrl || d.candidatePhoto || d.avatar || d.avatar_url || d.picture || d.profileImage || d.image || "";
      const email = String(d.email || "").trim();
      const authUid = d.uid || d.userId || d.user_id || d.id || ds.id;

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

      const userDepts = [];
      if (dept) userDepts.push(dept);
      if (deptRaw && deptRaw !== dept) userDepts.push(String(deptRaw));
      if (Array.isArray(d.departments)) {
        d.departments.forEach((deptItem) => {
          if (typeof deptItem === "object" && deptItem) userDepts.push(deptItem.name || deptItem.id || "");
          else if (deptItem) {
            userDepts.push(deptMap[deptItem] || deptItem);
          }
        });
      }

      const allAliases = Array.from(
        new Set([
          ds.id,
          String(ds.id).toLowerCase(),
          authUid,
          String(authUid).toLowerCase(),
          email,
          email.toLowerCase(),
          d.userId,
          d.user_id,
          d.id,
          name,
        ].filter(Boolean))
      );

      const userData = {
        name,
        role: d.role || (d.access && d.access.role_id) || (d.access && d.access.role) || "",
        role_title: d.role_title || d.job_title || d.title || "",
        department: dept,
        departments: userDepts.length ? userDepts : (dept ? [dept] : []),
        position: pos,
        position_name: d.position_name || "",
        positions: userPositions,
        employment: d.employment || {},
        photo: String(photo || "").trim(),
        docId: ds.id,
        uid: authUid,
        email: email,
        allAliases,
      };

      // Index across all potential key identifiers
      allAliases.forEach((alias) => {
        if (alias) {
          map[alias] = userData;
          map[String(alias).toLowerCase()] = userData;
        }
      });
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
  const seen = new Set();
  for (const colName of ["departments", "department"]) {
    try {
      const snap = await getDocs(collection(db, colName));
      snap.forEach((ds) => {
        const d = ds.data() || {};
        const name = d.name || d.label || d.title || ds.id;
        const key = String(name || ds.id).toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          rows.push({ id: ds.id, name: name });
        }
      });
    } catch (e) {}
  }
  return rows;
}

/**
 * Load all positions as [{ id, name }].
 * @returns {Promise<Array>}
 */
export async function loadPositions() {
  const rows = [];
  const seen = new Set();
  for (const colName of ["positions", "position"]) {
    try {
      const snap = await getDocs(collection(db, colName));
      snap.forEach((ds) => {
        const d = ds.data() || {};
        const name = d.name || d.label || d.title || d.position || ds.id;
        const key = String(name || ds.id).toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          rows.push({ id: ds.id, name: name });
        }
      });
    } catch (e) {}
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
