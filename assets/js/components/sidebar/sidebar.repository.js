// assets/js/components/sidebar/sidebar.repository.js
// =====================================================================
// SIDEBAR DATA ACCESS — the ONLY sidebar module that talks to Firebase.
//
// Responsibilities:
//  - Compute live smart-filter counts (Main Quest / Side Quest /
//    Project / Report) from the Quest feature collections `tasks` and
//    `quest_reports`.
//
// RULES:
//  - NO DOM manipulation, NO rendering here.
//  - Uses the single Firebase init from assets/js/firebase-config.js.
//  - This is the documented (and only) place the shared sidebar reads
//    Quest feature data — see the SMART_FILTERS contract in
//    sidebar.config.js. If the Quest collections change, update the
//    contract + this module together, never the UI.
// =====================================================================

import { auth, db } from "../../firebase-config.js";
import {
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  listQuestTasks,
  getUserAliases,
  loadUsersMap,
  toMs,
} from "../quest-modal/quest-modal.repository.js";

function normalizeStatus(raw) {
  let s = "";
  if (typeof raw === "string") s = raw;
  else if (raw && typeof raw === "object") s = raw.name || raw.label || "";
  return String(s || "").trim().toLowerCase().replace(/[\s_]/g, "");
}

function timeKey(v) {
  if (!v) return "";
  if (v.toDate && typeof v.toDate === "function") {
    const d = v.toDate();
    if (!isNaN(d.getTime())) return d.toISOString();
    return "";
  }
  if (typeof v === "number") {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString();
    return "";
  }
  return String(v);
}

function isSideQuestTask(data) {
  const qt = String(data.quest_type || "")
    .toLowerCase()
    .replace(/[\s_]/g, "");
  if (qt === "side" || qt === "sidequest" || qt === "side-quest" || qt === "quest") return true;
  if (qt === "main" || qt === "mainquest" || qt === "daily") return false;
  const t = String(data.type || data.status || "")
    .toLowerCase()
    .replace(/[\s_]/g, "");
  if (t === "side" || t === "sidequest" || t === "side-quest" || t === "quest") return true;
  if (t === "main" || t === "mainquest" || t === "daily") return false;
  if (data.task_status) return true;
  return false;
}

function dayKey(date) {
  return (
    date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
  );
}

function normalizeRecurUnit(recur) {
  const unit =
    recur && (recur.unit || recur.type || recur.frequency)
      ? String(recur.unit || recur.type || recur.frequency).toLowerCase()
      : "";
  if (unit === "daily") return "day";
  if (unit === "weekly") return "week";
  if (unit === "monthly") return "month";
  const weekdays =
    recur &&
    (recur.weekdays || recur.days || recur.repeat_on || recur.repeatOn);
  if (weekdays && Array.isArray(weekdays) && weekdays.length) return "week";
  const monthlyDates =
    recur && (recur.monthly_dates || recur.monthlyDates || recur.dates);
  if (monthlyDates && Array.isArray(monthlyDates) && monthlyDates.length)
    return "month";
  return unit;
}

function normalizeNumberList(value) {
  if (!value) return [];
  if (!Array.isArray(value) && typeof value === "object") {
    const keys = Object.keys(value);
    const allNumeric =
      keys.length > 0 && keys.every((k) => !isNaN(parseInt(k, 10)));
    if (allNumeric) {
      const vals = [];
      keys.forEach((k) => {
        const v = value[k];
        if (typeof v === "number") vals.push(v);
        else if (typeof v === "string") vals.push(parseInt(v, 10));
        else if (v && typeof v === "object")
          vals.push(parseInt(v.value || v.day || v.date || v.id, 10));
      });
      return vals.filter((n) => !isNaN(n));
    }
  }
  const arr = Array.isArray(value) ? value : [value];
  return arr
    .map((item) => {
      if (typeof item === "number") return item;
      if (typeof item === "string") return parseInt(item, 10);
      if (item && typeof item === "object")
        return parseInt(item.value || item.day || item.date || item.id, 10);
      return NaN;
    })
    .filter((n) => !isNaN(n));
}

function findNextOccurrenceKey(recur, fromDate, maxDays) {
  const unit = normalizeRecurUnit(recur);
  if (unit === "day") return dayKey(fromDate);
  const weekdays = normalizeNumberList(
    recur.weekdays || recur.days || recur.repeat_on || recur.repeatOn,
  );
  const monthlyDates = normalizeNumberList(
    recur.monthly_dates || recur.monthlyDates || recur.dates,
  );
  if (
    (!weekdays || !weekdays.length) &&
    (!monthlyDates || !monthlyDates.length)
  ) {
    return dayKey(fromDate);
  }
  for (let offset = 0; offset <= maxDays; offset++) {
    const candidate = new Date(
      fromDate.getFullYear(),
      fromDate.getMonth(),
      fromDate.getDate(),
    );
    candidate.setDate(candidate.getDate() + offset);
    if (unit === "week" && weekdays.indexOf(candidate.getDay()) !== -1)
      return dayKey(candidate);
    if (unit === "month" && monthlyDates.indexOf(candidate.getDate()) !== -1)
      return dayKey(candidate);
  }
  if (weekdays.length > 0 || monthlyDates.length > 0) return dayKey(fromDate);
  return null;
}

function isTaskAssignedToUser(data, myAliases, roleLower, userDept) {
  if (!myAliases || !myAliases.length) return false;

  const assignList = (Array.isArray(data.assign_to)
    ? data.assign_to
    : data.assign_to
      ? [data.assign_to]
      : []
  ).map((x) => String(x).toLowerCase().trim());

  // If explicit assignees exist, the logged-in user MUST be one of the assignees
  if (assignList.length > 0) {
    return assignList.some((uid) => myAliases.includes(uid));
  }

  // If unassigned (open to department)
  const depts = Array.isArray(data.departments) ? data.departments : [];
  if (!depts.length) {
    return false;
  }

  if (!userDept) return false;
  const deptLower = String(userDept).toLowerCase().trim();
  return depts.some((d) => {
    if (!d) return false;
    const id = d.id || d.department_id || "";
    const name = d.name || d.department_name || d.department || "";
    return (
      (id && String(id).toLowerCase().trim() === deptLower) ||
      (name && String(name).toLowerCase().trim() === deptLower)
    );
  });
}

function isReportedToday(data, myAliases) {
  if (!data) return false;
  const normStatus = String(data.status || data.task_status || "").toLowerCase();
  if (normStatus === "rejected" || normStatus === "approved" || normStatus.includes("approv") || normStatus.includes("reject")) return false;
  if (data.user_status && (String(data.user_status).toLowerCase() === "approved" || String(data.user_status).toLowerCase() === "rejected")) return false;
  const msAppr = toMs(data.last_approved_at || data.approved_at);
  const msRej = toMs(data.last_rejected_at || data.rejected_at);
  const msRep = toMs(data.last_reported_at);
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
  const ms = toMs(lra);
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

function isReportTargetedToUser(data, myAliases) {
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
    return reportList.some((u) => myAliases.includes(u));
  }

  return false;
}

/**
 * Compute the sidebar smart-filter counts.
 * @returns {Promise<{mainQuest:number,sideQuest:number,project:number,report:number}>}
 */
export async function getSidebarCounts() {
  const counts = { mainQuest: 0, sideQuest: 0, project: 0, report: 0 };

  try {
    let myAliases = [];
    let roleLower = "";
    let userDept = "";

    const user = auth.currentUser;
    if (user) {
      if (user.uid) myAliases.push(String(user.uid).toLowerCase().trim());
      if (user.email) myAliases.push(String(user.email).toLowerCase().trim());
      if (user.displayName) myAliases.push(String(user.displayName).toLowerCase().trim());

      try {
        const fetchedAliases = await getUserAliases(user.uid);
        (fetchedAliases || []).forEach((a) => {
          if (a) myAliases.push(String(a).toLowerCase().trim());
        });
      } catch (_) {}

      try {
        const tokenRes = await user.getIdTokenResult();
        if (tokenRes && tokenRes.claims && tokenRes.claims.role) {
          roleLower = String(tokenRes.claims.role).toLowerCase();
        }
      } catch (_) {}

      try {
        const usersMap = await loadUsersMap();
        const userInfo =
          usersMap[user.uid] ||
          usersMap[String(user.uid).toLowerCase()] ||
          (user.email ? usersMap[String(user.email).toLowerCase()] : null);
        if (userInfo) {
          if (userInfo.name) myAliases.push(String(userInfo.name).toLowerCase().trim());
          if (userInfo.full_name) myAliases.push(String(userInfo.full_name).toLowerCase().trim());
          if (userInfo.username) myAliases.push(String(userInfo.username).toLowerCase().trim());
          if (!roleLower && userInfo.role) roleLower = String(userInfo.role).toLowerCase();
          userDept = String(userInfo.department || "").trim();
        }
      } catch (_) {}

      myAliases = Array.from(new Set(myAliases.filter(Boolean)));
    }

    const taskRows = await listQuestTasks().catch(() => []);
    let totalMain = 0;
    let totalSide = 0;
    const completeIds = [];
    const completeSet = {};

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayKey = dayKey(today);

    taskRows.forEach((row) => {
      const data = row.data || {};
      // Projects are excluded from quest counts (mirrors legacy).
      if (data.project_id || data.projectId) return;

      const archived = !!(data.archived || data.is_archived);
      if (archived) return;

      const normStatus = normalizeStatus(data.status);
      const normTaskStatus = normalizeStatus(data.task_status);
      const isComplete =
        normStatus === "complete" ||
        normStatus === "done" ||
        normTaskStatus === "complete" ||
        normTaskStatus === "done";

      if (isComplete) {
        completeIds.push(row.id);
        completeSet[row.id] = true;
        return;
      }

      // Only count tasks that are assigned to the currently logged in user to execute
      if (!isTaskAssignedToUser(data, myAliases, roleLower, userDept)) {
        return;
      }

      const isSide = isSideQuestTask(data);
      const dueDateMs = toMs(
        data.due_date ||
          data.dueDate ||
          data.deadline_date ||
          data.deadlineDate ||
          data.date ||
          data.start_date ||
          data.startDate,
      );

      const userStatusLower = String(data.user_status || "").toLowerCase();
      const assignList = (Array.isArray(data.assign_to)
        ? data.assign_to
        : data.assign_to
          ? [data.assign_to]
          : []
      ).map((x) => String(x).toLowerCase().trim());
      const isSingleAssignee = assignList.length <= 1;

      const userApproval =
        data.approved_users &&
        Object.keys(data.approved_users).some((uid) =>
          myAliases.includes(String(uid).toLowerCase().trim())
        );

      const isApproved =
        userApproval ||
        Boolean(data.isApproved) ||
        userStatusLower === "approved" ||
        userStatusLower.includes("approv") ||
        (isSingleAssignee &&
          (normStatus === "approved" ||
            normStatus.includes("approv") ||
            normTaskStatus === "approved" ||
            normTaskStatus.includes("approv")));

      const isRejected =
        !isApproved &&
        (userStatusLower === "rejected" ||
          userStatusLower.includes("reject") ||
          normStatus === "rejected" ||
          normStatus.includes("reject") ||
          normTaskStatus === "rejected" ||
          normTaskStatus.includes("reject"));

      const reportedToday =
        !isApproved &&
        !isRejected &&
        (Boolean(data.isReported) ||
          userStatusLower === "reported" ||
          userStatusLower.includes("report") ||
          userStatusLower.includes("pend") ||
          isReportedToday(data, myAliases));

      // If task is already approved or reported today by this user, it's done -> do not notify/count
      if (isApproved || reportedToday) {
        return;
      }

      if (!isSide) {
        // --- Daily (Main Quest) ---
        let matchedDay = null;
        let nextKey = null;

        if (!data.recur) {
          if (!dueDateMs) {
            matchedDay = "today";
          } else {
            const k = dayKey(new Date(dueDateMs));
            if (k <= todayKey) matchedDay = "today";
            else matchedDay = "upcoming";
          }
        } else {
          nextKey = findNextOccurrenceKey(data.recur, today, 62);
          matchedDay = nextKey === todayKey ? "today" : nextKey ? "upcoming" : null;
        }

        // Only count if due today / overdue
        if (matchedDay === "today") {
          totalMain++;
        }
      } else {
        // --- Quest (Side Quest) ---
        let isUpcoming = false;
        if (dueDateMs) {
          const k = dayKey(new Date(dueDateMs));
          if (k > todayKey) isUpcoming = true;
        }
        if (!isUpcoming) {
          totalSide++;
        }
      }
    });

    counts.mainQuest = totalMain;
    counts.sideQuest = totalSide;
    counts.project = 0;

    // --- Report Pending Approval (100% matched with Report Modal) ---
    let pendingCount = 0;
    try {
      const { loadReportsData } = await import(
        "../report-modal/report-modal.repository.js"
      );
      const allReps = await loadReportsData();
      allReps.forEach((r) => {
        const st = String(r.status || "").toLowerCase();
        if (st === "pending" || st === "pending review") {
          const reportToList = extractUserIdentifiers(r.reportTo);
          if (reportToList.length > 0) {
            if (reportToList.some((u) => myAliases.includes(u))) {
              pendingCount++;
            }
          }
        }
      });
    } catch (e) {
      console.warn("sidebar: failed to compute reports count:", e);
    }

    counts.report = pendingCount;
  } catch (e) {
    console.warn("sidebar: failed to refresh counts:", e);
  }

  return counts;
}