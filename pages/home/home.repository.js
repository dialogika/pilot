// pages/home/home.repository.js
// =====================================================================
// HOME DATA ACCESS — the ONLY Home module that talks to Firebase.
//
// RULES:
//  - Every Firestore/Auth read & write for Home lives here.
//  - NO DOM manipulation, NO rendering, NO toast/modal here.
//  - Uses the single Firebase init from assets/js/firebase-config.js.
//  - Returns plain data; the orchestrator decides what to render.
// =====================================================================

import { auth, db, functions } from "../../assets/js/firebase-config.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import {
  collection,
  query,
  where,
  getDoc,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getMs } from "../../assets/js/utils.js";

const STATUS = {
  pending: "pending",
  active: "active",
  approved: "Approved",
  rejected: "Rejected",
  partiallyApproved: "Partially Approved",
};

/* ------------------------------------------------------------------ */
/* Current user                                                        */
/* ------------------------------------------------------------------ */

/**
 * Read the user's Firestore document.
 * @param {string} uid
 * @returns {Promise<Object|null>} user data or null
 */
export async function getUserDoc(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

/**
 * Resolve a position id string into a readable name.
 * Mirrors legacy resolvePositionName: try positions/position docs,
 * then scan the positions collection.
 * @param {string} rawValue
 * @returns {Promise<string|null>}
 */
export async function resolvePositionName(rawValue) {
  if (!rawValue || String(rawValue).trim().length < 10 || String(rawValue).includes(" ")) {
    return null;
  }
  const key = String(rawValue).trim();
  const getName = (d) => d && (d.name || d.title || d.position || d.label);

  for (const coll of ["positions", "position"]) {
    try {
      const snap = await getDoc(doc(db, coll, key));
      if (snap.exists()) {
        const name = getName(snap.data());
        if (name) return name;
      }
    } catch (e) {
      console.warn(`Failed to read ${coll}/${key}:`, e);
    }
  }

  try {
    const listSnap = await getDocs(collection(db, "positions"));
    let matched = null;
    listSnap.forEach((ds) => {
      if (matched) return;
      const d = ds.data() || {};
      if (d.id === key || d.position_id === key || d._id === key || ds.id === key) {
        const name = getName(d);
        if (name) matched = name;
      }
    });
    if (matched) return matched;
  } catch (e) {
    console.warn("Failed to scan positions:", e);
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Presence (Who is Online)                                            */
/* ------------------------------------------------------------------ */

/**
 * Write the current user's presence marker (merge).
 * @param {{uid:string, name:string, photo:string}} user
 */
export function updatePresence(user) {
  if (!user || !user.uid) return;
  return setDoc(
    doc(db, "user_presence", user.uid),
    {
      user_id: user.uid,
      name: user.name || "",
      photo: user.photo || "",
      last_active_at: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Subscribe to all presence docs and call `onUsers(users)` on every change.
 * Each user: { uid, name, photo, lastActive: Date|null, isActive: bool }.
 * @param {(users:Array)=>void} onUsers
 * @returns {()=>void} unsubscribe
 */
export function subscribeOnlineUsers(onUsers) {
  const colRef = collection(db, "user_presence");
  return onSnapshot(
    colRef,
    (snapshot) => {
      const now = new Date();
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const oneHourMs = 60 * 60 * 1000;

      const users = [];
      snapshot.forEach((ds) => {
        const data = ds.data() || {};
        const ts = data.last_active_at;
        let lastActive = null;
        if (ts && typeof ts.toDate === "function") lastActive = ts.toDate();
        if (!lastActive || lastActive < startOfDay) return;
        const diff = now.getTime() - lastActive.getTime();
        users.push({
          uid: ds.id,
          name: data.name || "",
          photo: data.photo || "",
          lastActive,
          isActive: diff <= oneHourMs,
        });
      });

      users.sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime());
      onUsers(users);
    },
    (error) => console.error("Failed to listen to online users:", error),
  );
}

/* ------------------------------------------------------------------ */
/* Announcements                                                       */
/* ------------------------------------------------------------------ */

const ANNOUNCEMENT_COLORS = {
  info: "#0d6efd",
  update: "#108a00",
  warning: "#f1ac15",
  urgent: "#e7181b",
};

/**
 * Subscribe to active announcements, dept-filtered + sorted.
 * @param {string} userDept  user's department (lowercased)
 * @param {(items:Array)=>void} onItems
 * @returns {()=>void} unsubscribe
 */
export function subscribeAnnouncements(userDept, onItems) {
  const q = query(collection(db, "announcements"), where("active", "==", true));
  return onSnapshot(
    q,
    (snapshot) => {
      const dept = String(userDept || "").toLowerCase().trim();
      let items = [];
      snapshot.forEach((ds) => {
        const data = ds.data() || {};
        const targetName = String(data.target_department_name || "").toLowerCase().trim();
        if (!targetName || targetName === dept) {
          items.push({ id: ds.id, ...data });
        }
      });

      items.sort((a, b) => {
        if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
        const at = a.created_at?.toDate ? a.created_at.toDate().getTime() : 0;
        const bt = b.created_at?.toDate ? b.created_at.toDate().getTime() : 0;
        return bt - at;
      });
      items = items.slice(0, 5);
      onItems(items);
    },
    (error) => console.error("Failed to load announcements for home:", error),
  );
}

export { ANNOUNCEMENT_COLORS };

/* ------------------------------------------------------------------ */
/* Daily report approvals                                              */
/* ------------------------------------------------------------------ */

function extractUserIdentifiers(raw) {
  const list = [];
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  arr.forEach((item) => {
    if (!item) return;
    if (typeof item === "string") {
      list.push(item.toLowerCase().trim());
    } else if (typeof item === "object") {
      if (item.uid) list.push(String(item.uid).toLowerCase().trim());
      if (item.id) list.push(String(item.id).toLowerCase().trim());
      if (item.userId) list.push(String(item.userId).toLowerCase().trim());
      if (item.name) list.push(String(item.name).toLowerCase().trim());
      if (item.email) list.push(String(item.email).toLowerCase().trim());
      if (item.value) list.push(String(item.value).toLowerCase().trim());
    }
  });
  return list;
}

/**
 * Check if a daily report document is targeted to or involves the current user.
 */
function isReportTargetedToUser(data, myAliases, userRole, userDept) {
  if (!myAliases || !myAliases.length) return false;

  // 1. Author/submitter
  const authorId = String(data.user_id || data.userId || data.author_id || "").toLowerCase().trim();
  if (authorId && myAliases.includes(authorId)) return true;

  // 2. Creator
  const createdList = extractUserIdentifiers(data.created_by || data.createdBy);
  if (createdList.some((u) => myAliases.includes(u))) return true;

  // 3. Report To (Target Supervisors)
  const reportList = extractUserIdentifiers(data.report_to || data.reportTo);

  const tasksArr = Array.isArray(data.tasks) ? data.tasks : [];
  tasksArr.forEach((t) => {
    if (!t) return;
    extractUserIdentifiers(t.report_to || t.reportTo).forEach((x) => {
      reportList.push(x);
    });
    extractUserIdentifiers(t.created_by || t.createdBy).forEach((x) => {
      createdList.push(x);
    });
  });

  if (reportList.length > 0) {
    // If specific report_to is defined, ONLY those listed in report_to receive/see it
    return reportList.some((u) => myAliases.includes(u));
  }

  // If report has no explicit report_to, only author/assignee and creator can see it
  return false;
}

/**
 * Subscribe to pending daily reports, strictly filtered by report_to + sorted.
 * @param {string} userDept
 * @param {(reports:Array)=>void} onReports  each report: { id, data }
 * @param {string} [userRole]
 * @param {Array<string>} [myAliases]
 * @returns {()=>void} unsubscribe
 */
export function subscribeDailyReports(userDept, onReports, userRole, myAliases = []) {
  const q = query(
    collection(db, "intern_dailyreport"),
    where("status", "in", [
      "Pending",
      "Pending Review",
      "pending",
      "pending review",
      "Partially Approved",
      "partially approved",
      "Partially_Approved",
      "partially_approved",
    ]),
  );
  return onSnapshot(
    q,
    async (snapshot) => {
      const reports = [];
      snapshot.forEach((ds) => {
        const data = ds.data() || {};
        // Only include if targeted to the current user (in report_to / author / creator)
        if (!isReportTargetedToUser(data, myAliases, userRole, userDept)) {
          return;
        }
        reports.push({ id: ds.id, data });
      });

      reports.sort((a, b) => {
        const aTime = getMs(a.data.submitted_at || a.data.submittedAt || a.data.report_date);
        const bTime = getMs(b.data.submitted_at || b.data.submittedAt || b.data.report_date);
        return (bTime || 0) - (aTime || 0);
      });

      onReports(reports);
    },
    (error) => {
      console.error("Error loading daily reports:", error);
      onReports([]);
    },
  );
}

/**
 * Backfill task points from the tasks collection when a task lacks them.
 * @param {Object} task
 * @returns {Promise<Object>} task with points possibly filled
 */
async function backfillTaskPoints(task) {
  const t = { ...task };
  if (Number(t.points) <= 0 && task.task_id) {
    try {
      const snap = await getDoc(doc(db, "tasks", task.task_id));
      if (snap.exists()) {
        const p = Number(snap.data().points) || 0;
        if (p > 0) t.points = p;
      }
    } catch (e) {
      console.warn("Gagal backfill points quest:", task.task_id, e);
    }
  }
  return t;
}

async function updateTaskDocStatus(taskId, patch) {
  if (!taskId) return;
  let updated = false;
  try {
    await updateDoc(doc(db, "tasks", taskId), patch);
    updated = true;
  } catch (_) {}
  if (!updated) {
    try {
      await updateDoc(doc(db, "quests", taskId), patch);
    } catch (_) {}
  }
}

/**
 * Approve all tasks of a report.
 * @param {string} reportId
 * @param {{uid:string, name:string}} reviewer
 */
export async function approveReport(reportId, reviewer) {
  const reportSnap = await getDoc(doc(db, "intern_dailyreport", reportId));
  const reportData = reportSnap.exists() ? reportSnap.data() || {} : {};
  const tasks = Array.isArray(reportData.tasks) ? reportData.tasks : [];
  const updatedTasks = await Promise.all(
    tasks.map(async (task) => ({ ...(await backfillTaskPoints(task)), status: STATUS.approved })),
  );
  await updateDoc(doc(db, "intern_dailyreport", reportId), {
    tasks: updatedTasks,
    status: STATUS.approved,
    reviewer_id: reviewer.uid,
    reviewer_name: reviewer.name,
    reviewed_at: serverTimestamp(),
  });

  const taskIds = Array.isArray(reportData.task_ids) ? reportData.task_ids : [];
  const idsToApprove = new Set();
  tasks.forEach((t) => {
    if (t.task_id) idsToApprove.add(t.task_id);
    if (t.id) idsToApprove.add(t.id);
  });
  taskIds.forEach((id) => idsToApprove.add(id));

  await Promise.all(
    Array.from(idsToApprove).map((tid) =>
      updateTaskDocStatus(tid, {
        status: STATUS.approved,
        last_approved_at: serverTimestamp(),
        last_approved_by: reviewer.uid || "",
      }),
    ),
  );
}

/**
 * Approve the selected tasks (by index) of a report.
 * @param {string} reportId
 * @param {Array} tasks
 * @param {Array<number>} selectedIndices
 * @param {{uid:string, name:string}} reviewer
 */
export async function submitApproveIndividual(reportId, tasks, selectedIndices, reviewer) {
  const updatedTasks = await Promise.all(
    tasks.map(async (task, idx) => {
      const isNewlySelected = selectedIndices.includes(idx);
      const currentStatus = task.status || STATUS.pending;
      if (isNewlySelected) {
        const base = await backfillTaskPoints(task);
        return { ...base, status: STATUS.approved };
      }
      return { ...task, status: currentStatus };
    }),
  );
  const allApproved = updatedTasks.length > 0 && updatedTasks.every((t) => String(t.status).toLowerCase() === "approved");
  const allRejected = updatedTasks.length > 0 && updatedTasks.every((t) => String(t.status).toLowerCase() === "rejected");
  const anyApproved = updatedTasks.some((t) => String(t.status).toLowerCase() === "approved");
  const anyPending = updatedTasks.some((t) => {
    const s = String(t.status || "").toLowerCase();
    return s === "pending" || s === "pending review" || s === "";
  });

  let reportStatus = STATUS.partiallyApproved;
  if (allApproved) reportStatus = STATUS.approved;
  else if (allRejected) reportStatus = STATUS.rejected;
  else if (!anyApproved && anyPending) reportStatus = STATUS.pending;
  else reportStatus = STATUS.partiallyApproved;

  await updateDoc(doc(db, "intern_dailyreport", reportId), {
    tasks: updatedTasks,
    status: reportStatus,
    reviewer_id: reviewer.uid,
    reviewer_name: reviewer.name,
    reviewed_at: serverTimestamp(),
  });

  await Promise.all(
    updatedTasks.map(async (t) => {
      const tid = t.task_id || t.id;
      if (!tid) return;
      const s = String(t.status || "").toLowerCase();
      if (s === "approved") {
        await updateTaskDocStatus(tid, {
          status: STATUS.approved,
          last_approved_at: serverTimestamp(),
          last_approved_by: reviewer.uid || "",
        });
      } else if (s === "rejected") {
        await updateTaskDocStatus(tid, {
          status: STATUS.rejected,
          rejection_reason: "Ditolak dalam review individual",
          last_reported_at: null,
          last_reported_by: null,
        });
      }
    }),
  );
}

/**
 * Reject the selected tasks (by index) of a report with an optional reason.
 * @param {string} reportId
 * @param {Array} tasks
 * @param {Array<number>} selectedIndices
 * @param {string} reason
 * @param {{uid:string, name:string}} reviewer
 */
export async function submitRejectIndividual(reportId, tasks, selectedIndices, reason, reviewer) {
  const updatedTasks = tasks.map((task, idx) => {
    const isNewlySelected = selectedIndices.includes(idx);
    const currentStatus = task.status || STATUS.pending;
    if (isNewlySelected) {
      return {
        ...task,
        status: STATUS.rejected,
        rejection_reason: reason || "",
        feedback: reason || "",
      };
    }
    return { ...task, status: currentStatus };
  });

  const allApproved = updatedTasks.length > 0 && updatedTasks.every((t) => String(t.status).toLowerCase() === "approved");
  const allRejected = updatedTasks.length > 0 && updatedTasks.every((t) => String(t.status).toLowerCase() === "rejected");
  const anyPending = updatedTasks.some((t) => {
    const s = String(t.status || "").toLowerCase();
    return s === "pending" || s === "pending review" || s === "";
  });

  let reportStatus = STATUS.partiallyApproved;
  if (allApproved) reportStatus = STATUS.approved;
  else if (allRejected) reportStatus = STATUS.rejected;
  else if (anyPending) reportStatus = STATUS.partiallyApproved;
  else reportStatus = STATUS.partiallyApproved;

  await updateDoc(doc(db, "intern_dailyreport", reportId), {
    tasks: updatedTasks,
    status: reportStatus,
    reviewer_id: reviewer.uid,
    reviewer_name: reviewer.name,
    reviewed_at: serverTimestamp(),
    ...(reason ? { rejection_reason: reason } : {}),
  });

  await Promise.all(
    updatedTasks.map(async (t, idx) => {
      const isNewlySelected = selectedIndices.includes(idx);
      if (!isNewlySelected) return;
      const tid = t.task_id || t.id;
      if (!tid) return;
      await updateTaskDocStatus(tid, {
        status: STATUS.rejected,
        rejection_reason: reason || "",
        last_reported_at: null,
        last_reported_by: null,
      });
    }),
  );
}

/**
 * Reject a report with an optional reason.
 * @param {string} reportId
 * @param {string} reason
 * @param {{uid:string, name:string}} reviewer
 */
export async function rejectReport(reportId, reason, reviewer) {
  const reportSnap = await getDoc(doc(db, "intern_dailyreport", reportId));
  const reportData = reportSnap.exists() ? reportSnap.data() || {} : {};
  const tasks = Array.isArray(reportData.tasks) ? reportData.tasks : [];
  const taskIds = Array.isArray(reportData.task_ids) ? reportData.task_ids : [];

  await updateDoc(doc(db, "intern_dailyreport", reportId), {
    status: STATUS.rejected,
    reviewer_id: reviewer.uid,
    reviewer_name: reviewer.name,
    reviewed_at: serverTimestamp(),
    rejection_reason: reason || "",
  });

  const idsToRevert = new Set();
  tasks.forEach((t) => {
    if (t.task_id) idsToRevert.add(t.task_id);
    if (t.id) idsToRevert.add(t.id);
  });
  taskIds.forEach((id) => idsToRevert.add(id));

  await Promise.all(
    Array.from(idsToRevert).map((tid) =>
      updateTaskDocStatus(tid, {
        status: STATUS.rejected,
        rejection_reason: reason || "",
        last_reported_at: null,
        last_reported_by: null,
      }),
    ),
  );
}

/**
 * Load a map of uid -> display name for task "who did this" labels.
 * @returns {Promise<Object>}
 */
export async function loadUsersNameMap() {
  const map = {};
  try {
    const snap = await getDocs(collection(db, "users"));
    snap.forEach((ds) => {
      const u = ds.data() || {};
      map[ds.id] = u.name || u.email || ds.id;
    });
  } catch (e) {
    console.warn("Gagal memuat data users:", e);
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* Pending user registrations                                          */
/* ------------------------------------------------------------------ */

/**
 * Subscribe to pending user registrations.
 * @param {(users:Array)=>void} onUsers  each user: { id, ...data }
 * @returns {()=>void} unsubscribe
 */
export function subscribePendingUsers(onUsers) {
  const q = query(collection(db, "pending_users"), where("is_approved", "==", false));
  return onSnapshot(
    q,
    (snapshot) => {
      const users = [];
      snapshot.forEach((ds) => users.push({ id: ds.id, ...ds.data() }));
      onUsers(users);
    },
    (error) => {
      console.error("Error loading pending users:", error);
      onUsers([]);
    },
  );
}

/**
 * Approve a pending user: copy doc to users + delete pending record.
 * Done via the `approvePendingUser` callable Cloud Function because the
 * `users` collection rules forbid client-side create (`allow create: if false`)
 * — only the Admin SDK may create a user doc, so role/approved_by stay safe.
 * @param {string} userId
 * @param {{uid:string, name:string}} approver
 */
export async function approvePendingUser(userId, approver) {
  const call = httpsCallable(functions, "approvePendingUser");
  try {
    const result = await call({ userId });
    return result.data;
  } catch (error) {
    const code = error?.code || "";
    if (code === "functions/permission-denied")
      throw new Error("Anda tidak berhak menyetujui registrasi (hanya owner/admin/team).");
    if (code === "functions/unauthenticated")
      throw new Error("Silakan login ulang untuk menyetujui registrasi.");
    if (code === "functions/not-found")
      throw new Error("Registrasi pengguna tidak ditemukan.");
    throw new Error(error?.message || "Gagal menyetujui pengguna.");
  }
}

export async function setUserRole(userIdOrEmail, role) {
  let targetUid = String(userIdOrEmail || "").trim();
  if (targetUid.includes("@")) {
    try {
      const q = query(collection(db, "users"), where("email", "==", targetUid));
      const snap = await getDocs(q);
      if (!snap.empty) {
        targetUid = snap.docs[0].id;
      }
    } catch (_) {}
  }
  const call = httpsCallable(functions, "setUserRole");
  try {
    const result = await call({ userId: targetUid, uid: targetUid, role });
    // Also update firestore doc for full sync
    try {
      await updateDoc(doc(db, "users", targetUid), {
        role: role,
        "access.role_id": role,
      });
    } catch (_) {}
    return result.data;
  } catch (error) {
    throw new Error(error?.message || "Gagal mengubah role pengguna.");
  }
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export { auth, db };