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

import { auth, db } from "../../assets/js/firebase-config.js";
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

/**
 * Subscribe to pending daily reports, dept-filtered + sorted.
 * @param {string} userDept
 * @param {(reports:Array)=>void} onReports  each report: { id, data }
 * @returns {()=>void} unsubscribe
 */
export function subscribeDailyReports(userDept, onReports) {
  const q = query(
    collection(db, "intern_dailyreport"),
    where("status", "in", [
      "Pending",
      "Pending Review",
      "pending",
      "pending review",
    ]),
  );
  return onSnapshot(
    q,
    async (snapshot) => {
      const dept = String(userDept || "").toLowerCase().trim();
      const reports = [];
      snapshot.forEach((ds) => {
        const data = ds.data();
        let reportDept = "";
        if (Array.isArray(data.departments) && data.departments.length > 0) {
          const arr = data.departments.map((d) => String(d).toLowerCase().trim());
          reportDept = dept && arr.includes(dept) ? dept : arr[0] || "";
        } else {
          reportDept = String(
            data.department || data.internship_department || data.team_department || "",
          ).toLowerCase().trim();
        }
        if (!dept || !reportDept || reportDept !== dept) return;
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
      const approved = selectedIndices.includes(idx);
      const base = approved ? await backfillTaskPoints(task) : { ...task };
      return { ...base, status: approved ? STATUS.approved : STATUS.rejected };
    }),
  );
  const allApproved = updatedTasks.length > 0 && updatedTasks.every((t) => t.status === STATUS.approved);
  const allRejected = updatedTasks.length > 0 && updatedTasks.every((t) => t.status === STATUS.rejected);
  let reportStatus = STATUS.partiallyApproved;
  if (allApproved) reportStatus = STATUS.approved;
  else if (allRejected) reportStatus = STATUS.rejected;

  await updateDoc(doc(db, "intern_dailyreport", reportId), {
    tasks: updatedTasks,
    status: reportStatus,
    reviewer_id: reviewer.uid,
    reviewer_name: reviewer.name,
    reviewed_at: serverTimestamp(),
  });
}

/**
 * Reject a report with an optional reason.
 * @param {string} reportId
 * @param {string} reason
 * @param {{uid:string, name:string}} reviewer
 */
export async function rejectReport(reportId, reason, reviewer) {
  await updateDoc(doc(db, "intern_dailyreport", reportId), {
    status: STATUS.rejected,
    reviewer_id: reviewer.uid,
    reviewer_name: reviewer.name,
    reviewed_at: serverTimestamp(),
    rejection_reason: reason || "",
  });
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
 * @param {string} userId
 * @param {{uid:string, name:string}} approver
 */
export async function approvePendingUser(userId, approver) {
  const pendingRef = doc(db, "pending_users", userId);
  const snap = await getDoc(pendingRef);
  if (!snap.exists()) throw new Error("User not found in pending list.");
  const data = snap.data();
  data.is_approved = true;
  data.status = STATUS.active;
  data.approved_by = { uid: approver.uid, name: approver.name, timestamp: serverTimestamp() };
  await setDoc(doc(db, "users", userId), data);
  await deleteDoc(pendingRef);
}

/**
 * Reject a pending user: delete the pending record.
 * @param {string} userId
 */
export async function rejectPendingUser(userId) {
  const pendingRef = doc(db, "pending_users", userId);
  const snap = await getDoc(pendingRef);
  if (!snap.exists()) throw new Error("User not found in pending list.");
  await deleteDoc(pendingRef);
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export { auth };