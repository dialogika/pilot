// pages/quest/quest.js
// =====================================================================
// QUEST ORCHESTRATOR — coordinates auth, shell, repository and UI.
//
// Flow:
//   requireAuth() → renderTopbar/renderSidebar
//       ↓
//   quest.repository.js (data access)
//       ↓
//   quest.ui.js (rendering + events)
//
// Rules:
//  - No Firestore queries here (use quest.repository.js).
//  - No raw DOM rendering of data here (use quest.ui.js).
//  - This file decides WHEN things happen and wires repo → ui.
// =====================================================================

import { requireAuth } from "../../assets/js/auth-guard.js";
import { renderTopbar } from "../../assets/js/components/topbar/topbar.js";
import { renderSidebar } from "../../assets/js/components/sidebar/sidebar.js";
import * as repo from "./quest.repository.js";
import * as ui from "./quest.ui.js";

let currentUser = null;
let currentRole = "";
let currentDept = "";
let currentTab = "main";
let usersMap = {}; // uid -> {name, role, department, photo}
let currentUserName = "";
let checkedTaskIds = new Set(); // task ids checked for daily report
let questTasks = {}; // id -> normalized task
let currentUserUid = "";
let departmentsCache = [];
let positionsCache = [];

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

async function initializeQuest() {
  try {
    // 1. Auth boundary.
    const { user, role } = await requireAuth();
    currentUser = user;
    currentRole = role;
    currentUserUid = user.uid;

    // 2. Shared shell.
    renderTopbar({ user, role });
    renderSidebar({ role, activePage: "my-tasks" });

    // 3. Supporting data (users, departments, positions).
    usersMap = await repo.loadUsersMap();
    departmentsCache = await repo.loadDepartments();
    positionsCache = await repo.loadPositions();
    const userInfo = usersMap[user.uid] || {};
    currentUserName = userInfo.name || user.displayName || user.email || "";
    currentDept = String(userInfo.department || "").trim();

    // 4. Wire events.
    wireEventHandlers();

    // 5. Load board.
    await loadBoard();

    console.log("Quest initialized");
  } catch (error) {
    console.error("Failed to initialize Quest:", error);
    ui.notifyError(
      "Gagal memuat Quest: " + (error && error.message ? error.message : error),
    );
  }
}

/* ------------------------------------------------------------------ */
/* Board loading                                                       */
/* ------------------------------------------------------------------ */

async function loadBoard() {
  ui.showBoardLoading();
  try {
    const rows = await repo.listQuestTasks();
    const positionsMap = {};
    positionsCache.forEach((p) => (positionsMap[p.id] = p.name));

    // Reset task cache each load (refreshes from server).
    questTasks = {};
    const normalized = rows.map(({ id, data }) =>
      normalizeTask(id, data, departmentsCache, positionsMap),
    );
    questTasks = normalized.reduce((acc, t) => {
      acc[t.id] = t;
      return acc;
    }, {});

    const board = buildBoard(normalized, currentTab);
    ui.renderBoard(currentTab, board, {
      users: usersMap,
      currentUid: currentUserUid,
      currentRole,
    });
  } catch (error) {
    console.error("Failed to load quest tasks:", error);
    ui.showBoardError(error && error.message ? error.message : String(error));
  }
}

/**
 * Normalize a raw task row into a render-friendly object, applying
 * role-based visibility exactly as the legacy board did.
 */
function normalizeTask(id, data, departments, positionsMap) {
  const task = { ...data, id };
  task.title = data.title || "Untitled Quest";
  task.points =
    typeof data.points === "number"
      ? data.points
      : data.points
        ? Number(data.points) || 0
        : 0;
  task.descText = stripHtml(data.description || "");
  task.isSide = isSideQuestTask(data);
  task.deptId = firstDeptId(data.departments);
  task.posId = firstPosId(data.positions);
  task.isOwner =
    data.created_by && String(data.created_by) === String(currentUserUid);
  task.departments = Array.isArray(data.departments)
    ? data.departments
    : data.departments
      ? [data.departments]
      : [];
  task.positions = Array.isArray(data.positions)
    ? data.positions
    : data.positions
      ? [data.positions]
      : [];
  task.dueDateMs = toMs(
    data.due_date ||
      data.dueDate ||
      data.deadline_date ||
      data.deadlineDate ||
      data.date ||
      data.start_date ||
      data.startDate,
  );
  task.questDeadlinePassed = questDeadlinePassed(task);
  task.lockState = computeLockState(task);
  return task;
}

/**
 * Apply the legacy role-based visibility rules.
 * Returns true when the task is visible to the current user.
 */
function isVisible(task) {
  const isStaff = currentRole === "staff";
  if (!currentUserUid) return true;

  if (isStaff) {
    // Staff: show all quests in the same department; no department → nothing.
    if (!currentDept) return false;
    const depts = task.departments;
    if (!depts.length) return true;
    const deptLower = currentDept.toLowerCase();
    const hasDeptData = depts.some((d) => d && (d.id || d.name));
    if (!hasDeptData) return true;
    return depts.some((d) => {
      if (!d) return false;
      const id = d.id || d.department_id || d.departmentId || "";
      const name =
        d.name || d.department_name || d.departmentName || d.department || "";
      return (
        (id && String(id).toLowerCase() === deptLower) ||
        (name && String(name).toLowerCase() === deptLower)
      );
    });
  }

  // Other roles: filter by assign_to (valid UIDs only); creator always sees.
  const assignList = Array.isArray(task.assign_to)
    ? task.assign_to
    : task.assign_to
      ? [task.assign_to]
      : [];
  const hasValidUID = assignList.some(
    (uid) => typeof uid === "string" && uid.length >= 20,
  );
  const isCreator =
    task.created_by && String(task.created_by) === String(currentUserUid);
  if (
    hasValidUID &&
    assignList.length > 0 &&
    assignList.indexOf(currentUserUid) === -1 &&
    !isCreator
  ) {
    return false;
  }
  return true;
}

function buildBoard(tasks, tab) {
  const isSide = tab === "side";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = dayKey(today);

  const overdue = [];
  const todayList = [];
  const upcomingList = [];

  tasks.forEach((task) => {
    if (task.project_id || task.projectId) return; // project tasks are out of scope
    if (task.isSide !== isSide) return; // filter by tab
    if (!isVisible(task)) return; // role visibility
    if (task.archived || task.is_archived) return;

    const normStatus = String(task.status || task.Status || "")
      .toLowerCase()
      .replace(/[\s_]/g, "");
    const normTaskStatus = String(task.task_status || task.taskStatus || "")
      .toLowerCase()
      .replace(/[\s_]/g, "");
    const isComplete =
      /complete|done/.test(normStatus) || /complete|done/.test(normTaskStatus);
    if (isComplete) return;

    // Non-recurring: no date → today; past → today; future → upcoming.
    let matchedDay;
    let nextKey = null;
    if (!task.recur) {
      if (!task.dueDateMs) {
        matchedDay = "today";
      } else {
        const k = dayKey(new Date(task.dueDateMs));
        if (k <= todayKey) matchedDay = "today";
        else {
          matchedDay = "upcoming";
          nextKey = k;
        }
      }
    } else {
      nextKey = findNextOccurrenceKey(task.recur, today, 62);
      matchedDay = nextKey === todayKey ? "today" : nextKey ? "upcoming" : null;
    }

    // Overdue detection: side quests whose deadline passed and not reported.
    if (task.questDeadlinePassed) {
      overdue.push(task);
      return;
    }

    if (matchedDay === "today") todayList.push(task);
    else if (matchedDay === "upcoming")
      upcomingList.push({ task, nextKey: nextKey || 99999999 });
  });

  // Sort upcoming by next occurrence, then deadline_time.
  upcomingList.sort((a, b) => {
    if (a.nextKey !== b.nextKey) return a.nextKey - b.nextKey;
    const at = a.task.deadline_time || "00:00";
    const bt = b.task.deadline_time || "00:00";
    return at < bt ? -1 : at > bt ? 1 : 0;
  });

  return {
    overdue,
    today: todayList,
    upcoming: upcomingList.slice(0, 2).map((x) => x.task),
  };
}

/* ------------------------------------------------------------------ */
/* Daily report                                                        */
/* ------------------------------------------------------------------ */

function openDailyReportModal() {
  const checked = Array.from(checkedTaskIds)
    .map((id) => questTasks[id])
    .filter(Boolean);
  ui.openDailyReportModal(checked, currentUserName, currentUserUid);
}

async function submitDailyReport() {
  const checkedIds = ui.collectCheckedIds();
  if (!checkedIds.length) {
    ui.notifyError(
      "Belum ada quest yang dicentang. Silakan centang quest terlebih dahulu.",
    );
    return;
  }
  const details = ui.collectReportDetails();

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  const deptSet = {};
  const tasksDetail = [];
  let totalPoints = 0;
  let claimedByOthers = false;

  checkedIds.forEach((id) => {
    const task = questTasks[id];
    if (!task) return;
    if (isClaimedByOthers(task)) {
      claimedByOthers = true;
      return;
    }
    (task.departments || []).forEach((d) => {
      if (d && d.name) deptSet[d.name] = true;
    });
    totalPoints += task.points;
    tasksDetail.push({
      task_id: id,
      title: task.title || "Untitled",
      points: task.points,
      detail: details[id] || "",
      who_did_this: [currentUserUid],
    });
  });

  if (claimedByOthers) {
    ui.notifyError(
      "Ada quest yang sudah diklaim orang lain hari ini. Hapus centang quest tersebut untuk melanjutkan.",
    );
    return;
  }
  if (!tasksDetail.length) {
    ui.notifyError("Tidak ada quest yang valid untuk direport.");
    return;
  }

  const deptArray = Object.keys(deptSet);
  const payload = {
    date: now.toISOString(),
    date_label: now.toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    report_date: yyyy + "-" + mm + "-" + dd,
    user_id: currentUserUid,
    name: currentUserName,
    departments: deptArray,
    department: deptArray.length ? deptArray[0] : "",
    tasks: tasksDetail,
    task_ids: checkedIds.slice(),
    total_points: totalPoints,
    status: "Pending Review",
  };

  ui.setReportSubmitBusy(true, "Submitting...");
  try {
    await repo.submitDailyReport(payload);
    // Mark each reported task.
    await Promise.all(
      checkedIds.map((id) => repo.markTaskReported(id, [currentUserUid])),
    );
    ui.notifySuccess("Report berhasil dikirim!");
    ui.closeDailyReportModal();
    checkedTaskIds.clear();
    await loadBoard();
  } catch (error) {
    console.error("Failed to submit daily report:", error);
    ui.notifyError(
      "Gagal mengirim report: " +
        (error && error.message ? error.message : error),
    );
  } finally {
    ui.setReportSubmitBusy(false, "Submit Report");
  }
}

function isClaimedByOthers(task) {
  const lrb = task.last_reported_by;
  const lra = task.last_reported_at;
  if (!Array.isArray(lrb) || !lrb.length || !lra) return false;
  const rd = toMs(lra);
  if (!rd) return false;
  const reported = new Date(rd);
  const today = new Date();
  const isToday =
    reported.getFullYear() === today.getFullYear() &&
    reported.getMonth() === today.getMonth() &&
    reported.getDate() === today.getDate();
  if (!isToday) return false;
  return !(currentUserUid && lrb.indexOf(currentUserUid) !== -1);
}

/* ------------------------------------------------------------------ */
/* Task CRUD                                                           */
/* ------------------------------------------------------------------ */

function openQuestFormForNew() {
  ui.openQuestForm("new", null, refs());
}

function openQuestFormForEdit(taskId) {
  const task = questTasks[taskId];
  if (!task) return;
  ui.openQuestForm("edit", task, refs());
}

function refs() {
  return {
    users: Object.keys(usersMap).map((uid) => ({ id: uid, ...usersMap[uid] })),
    departments: departmentsCache,
    positions: positionsCache,
  };
}

async function saveQuestForm() {
  const form = ui.readQuestForm(currentTab);
  if (!form.title) {
    ui.notifyError("Quest Title wajib diisi.");
    return;
  }
  if (!form.assignTo.length) {
    ui.notifyError("Quest harus di-assign ke minimal satu user.");
    return;
  }
  if (!form.points) {
    ui.notifyError("Quest tidak punya nilai.");
    return;
  }

  const deptSelected = form.deptId
    ? [{ id: form.deptId, name: form.deptName }]
    : [];
  const positionSelected = form.posId
    ? [{ id: form.posId, name: form.posName }]
    : [];

  const basePayload = {
    title: form.title,
    description: form.description,
    priority: form.priority || "normal",
    deadline_time: form.deadline_time,
    points: form.points,
    departments: deptSelected,
    positions: positionSelected,
    assign_to: form.assignTo,
    notify_to: form.assignTo,
    tags: form.tags,
    reminder_mode: "",
    reminder_dates: [],
    recur: null,
    status: "Initiate",
    quest_type: currentTab === "side" ? "side" : "main",
    created_by: currentUserUid,
    created_by_name: currentUserName,
  };

  if (currentTab === "side" && form.due_date) {
    basePayload.due_date = form.due_date;
  }

  const editingId = currentEditingTaskId;
  try {
    if (editingId) {
      delete basePayload.created_by;
      delete basePayload.created_by_name;
      delete basePayload.created_at;
      await repo.updateTask(editingId, basePayload);
    } else {
      await repo.createTask(basePayload);
    }
    ui.closeQuestForm();
    currentEditingTaskId = null;
    ui.notifySuccess(
      editingId ? "Quest berhasil diperbarui." : "Quest berhasil disimpan.",
    );
    await loadBoard();
  } catch (error) {
    console.error("Failed to save quest:", error);
    ui.notifyError(
      "Gagal menyimpan quest: " +
        (error && error.message ? error.message : error),
    );
  }
}

let currentEditingTaskId = null;

async function deleteQuestTask(taskId) {
  const task = questTasks[taskId];
  const ok = await uiConfirm(
    "Hapus quest ini?",
    'Quest "' + (task ? task.title : "") + '" akan dihapus permanen.',
  );
  if (!ok) return;
  try {
    await repo.deleteTask(taskId);
    checkedTaskIds.delete(taskId);
    ui.notifySuccess("Quest dihapus.");
    await loadBoard();
  } catch (error) {
    console.error("Failed to delete quest:", error);
    ui.notifyError(
      "Gagal menghapus quest: " +
        (error && error.message ? error.message : error),
    );
  }
}

/* ------------------------------------------------------------------ */
/* Event wiring                                                        */
/* ------------------------------------------------------------------ */

function wireEventHandlers() {
  // Tabs
  el("questTabMain").addEventListener("click", () => {
    switchTab("main");
    currentEditingTaskId = null;
    openQuestFormForNew();
  });

  el("questTabSide").addEventListener("click", () => {
    switchTab("side");
    currentEditingTaskId = null;
    openQuestFormForNew();
  });

  // Add / daily report buttons
  el("questAddButton").addEventListener("click", () => {
    currentEditingTaskId = null;
    openQuestFormForNew();
  });
  el("questDailyReportBtn").addEventListener("click", openDailyReportModal);
  el("questSideDailyReportBtn").addEventListener("click", openDailyReportModal);
  el("submitReportBtn").addEventListener("click", submitDailyReport);

  // Overdue scroll
  el("questOverdueButton").addEventListener("click", () => {
    el("questOverdueList").scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });

  // Modal close buttons
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () =>
      ui.closeById(btn.getAttribute("data-close")),
    );
  });

  // Form submit
  el("questForm").addEventListener("submit", (e) => {
    e.preventDefault();
    saveQuestForm();
  });

  // Delegated card actions (check / detail / edit / delete)
  document.body.addEventListener("click", (e) => {
    const check = e.target.closest("[data-check]");
    if (check) {
      e.preventDefault();
      e.stopPropagation();
      toggleChecked(check.getAttribute("data-check"));
      return;
    }
    const detail = e.target.closest("[data-detail]");
    if (detail) {
      e.preventDefault();
      e.stopPropagation();
      openDetail(detail.getAttribute("data-detail"));
      return;
    }
    const edit = e.target.closest("[data-edit]");
    if (edit) {
      e.preventDefault();
      e.stopPropagation();
      currentEditingTaskId = edit.getAttribute("data-edit");
      openQuestFormForEdit(currentEditingTaskId);
      return;
    }
    const del = e.target.closest("[data-delete]");
    if (del) {
      e.preventDefault();
      e.stopPropagation();
      deleteQuestTask(del.getAttribute("data-delete"));
    }
  });
}

function switchTab(tab) {
  currentTab = tab;
  ui.setActiveTab(tab);
  loadBoard();
}

function toggleChecked(taskId) {
  if (checkedTaskIds.has(taskId)) checkedTaskIds.delete(taskId);
  else checkedTaskIds.add(taskId);
  const btn = document.querySelector('[data-check="' + taskId + '"]');
  if (btn) btn.classList.toggle("quest-checked", checkedTaskIds.has(taskId));
}

function openDetail(taskId) {
  const task = questTasks[taskId];
  if (!task) {
    ui.notifyError("Data quest tidak ditemukan.");
    return;
  }
  ui.openQuestDetail(task, { users: usersMap });
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function el(id) {
  return document.getElementById(id);
}

function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  return (tmp.textContent || tmp.innerText || "").trim();
}

function isSideQuestTask(data) {
  const qt = String(data.quest_type || "")
    .toLowerCase()
    .replace(/[\s_]/g, "");
  if (qt === "side" || qt === "sidequest" || qt === "side-quest") return true;
  if (qt === "main" || qt === "mainquest") return false;
  const t = String(data.type || data.status || "")
    .toLowerCase()
    .replace(/[\s_]/g, "");
  if (t === "side" || t === "sidequest" || t === "side-quest") return true;
  if (data.task_status) return true;
  return false;
}

function firstDeptId(departments) {
  if (!Array.isArray(departments)) return "";
  const d = departments.find((x) => x);
  return d && (d.id || d.department_id || d.departmentId || "");
}

function firstPosId(positions) {
  if (!Array.isArray(positions)) return "";
  const p = positions.find((x) => x);
  return p && (p.id || p.position_id || "");
}

function questDeadlinePassed(task) {
  if (!task.isSide) return false;
  const status = String(task.status || task.Status || "")
    .toLowerCase()
    .replace(/[\s_]/g, "");
  if (/complete|done|reported/.test(status)) return false;
  if (task.archived || task.is_archived) return false;
  const ms = task.dueDateMs;
  if (!ms) return false;
  const due = new Date(ms);
  const tm = String(task.deadline_time || "").match(/^(\d{1,2}):(\d{2})/);
  if (tm) due.setHours(parseInt(tm[1], 10), parseInt(tm[2], 10), 0, 0);
  else due.setHours(23, 59, 59, 999);
  return due.getTime() < Date.now();
}

function toMs(value) {
  return repo.toMs(value);
}

function dayKey(date) {
  return (
    date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
  );
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

function computeLockState(task) {
  const result = { claimed: false, done: false, claimedBy: "" };
  const lrb = task.last_reported_by;
  const lra = task.last_reported_at;
  if (!Array.isArray(lrb) || !lrb.length || !lra) return result;
  const ms = toMs(lra);
  if (!ms) return result;
  const reported = new Date(ms);
  const today = new Date();
  const isToday =
    reported.getFullYear() === today.getFullYear() &&
    reported.getMonth() === today.getMonth() &&
    reported.getDate() === today.getDate();
  if (!isToday) return result;
  if (currentUserUid && lrb.indexOf(currentUserUid) !== -1) {
    result.done = true;
  } else {
    result.claimed = true;
    result.claimedBy =
      lrb
        .map((uid) => (usersMap[uid] && usersMap[uid].name) || uid)
        .join(", ") || "someone";
  }
  return result;
}

function uiConfirm(title, text) {
  return new Promise((resolve) => {
    import("https://cdn.jsdelivr.net/npm/sweetalert2@11").then(
      ({ default: Swal }) => {
        Swal.fire({
          title,
          text,
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#dc2626",
          cancelButtonColor: "#64748b",
          confirmButtonText: "Hapus",
          cancelButtonText: "Batal",
        }).then((r) => resolve(!!r.isConfirmed));
      },
    );
  });
}

initializeQuest();
