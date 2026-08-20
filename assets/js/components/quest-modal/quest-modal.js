// assets/js/components/quest-modal/quest-modal.js
// =====================================================================
// QUEST MODAL ORCHESTRATOR — coordinates auth, data repository, and UI
// for the in-page Daily & Quest Modal component.
//
// Flow:
//   openQuestModal({ initialTab: 'daily'|'quest' })
//       ↓
//   ensure DOM mounted & auth context initialized
//       ↓
//   loadBoard() → repo.listQuestTasks() → normalize → ui.renderBoard()
//
// Rules:
//  - No direct Firestore queries (use quest-modal.repository.js).
//  - No direct HTML string rendering (use quest-modal.ui.js).
// =====================================================================

import { auth } from "../../firebase-config.js";
import * as repo from "./quest-modal.repository.js";
import * as ui from "./quest-modal.ui.js";
import { getSidebarCounts } from "../sidebar/sidebar.repository.js";
import { applyCounts } from "../sidebar/sidebar.ui.js";

let currentTab = "daily"; // 'daily' | 'quest'
let currentUserUid = "";
let currentUserName = "";
let currentRole = "";
let currentDept = "";
let usersMap = {};
let departmentsCache = [];
let positionsCache = [];
let questTasks = {};
let checkedTaskIds = new Set();
let isInitialized = false;

/**
 * Initialize event listeners once for the modal.
 */
export function initQuestModal() {
  if (isInitialized) return;
  ui.ensureQuestModalDOM();
  wireEventHandlers();
  isInitialized = true;
}

/**
 * Open the Daily & Quest Modal overlay.
 * @param {{ initialTab?: 'daily'|'quest' }} [opts]
 */
export async function openQuestModal(opts = {}) {
  initQuestModal();
  currentTab = opts.initialTab === "quest" ? "quest" : "daily";

  ui.showModalOverlay();
  ui.setActiveTab(currentTab);
  ui.showBoardLoading();

  try {
    // 1. Identify user context
    const u = auth.currentUser;
    if (u) {
      currentUserUid = u.uid;
      currentUserName = u.displayName || u.email || "User";
    }

    // 2. Load supporting data if not cached
    if (!departmentsCache.length || !Object.keys(usersMap).length) {
      const [users, depts, pos] = await Promise.all([
        repo.loadUsersMap(),
        repo.loadDepartments(),
        repo.loadPositions(),
      ]);
      usersMap = users;
      departmentsCache = depts;
      positionsCache = pos;

      if (currentUserUid && usersMap[currentUserUid]) {
        const info = usersMap[currentUserUid];
        currentUserName = info.name || currentUserName;
        currentRole = info.role || "";
        currentDept = String(info.department || "").trim();
      }
    }

    // 3. Load and render board
    await loadBoard();

    // 4. If autoOpenReport requested, open the daily report modal directly
    if (opts.autoOpenReport) {
      handleOpenDailyReport();
    }
  } catch (error) {
    console.error("Failed to load Quest modal:", error);
    ui.showBoardError(error && error.message ? error.message : String(error));
  }
}

/**
 * Close the Daily & Quest Modal overlay.
 */
export function closeQuestModal() {
  ui.hideModalOverlay();
}

/* ------------------------------------------------------------------ */
/* Board Loading & Rendering                                           */
/* ------------------------------------------------------------------ */

async function loadBoard() {
  ui.showBoardLoading();
  try {
    const rows = await repo.listQuestTasks();
    const positionsMap = {};
    positionsCache.forEach((p) => (positionsMap[p.id] = p.name));

    questTasks = {};
    const normalized = rows.map(({ id, data }) =>
      normalizeTask(id, data, departmentsCache, positionsMap)
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

function normalizeTask(id, data, departments, positionsMap) {
  const task = { ...data, id };
  task.title = data.title || (isSideQuestTask(data) ? "Untitled Quest" : "Untitled Daily");
  task.points = typeof data.points === "number" ? data.points : Number(data.points) || 0;
  task.descText = stripHtml(data.description || "");
  task.isSide = isSideQuestTask(data);
  task.deptId = firstDeptId(data.departments);
  task.posId = firstPosId(data.positions);
  task.isOwner = data.created_by && String(data.created_by) === String(currentUserUid);
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
      data.start_date
  );
  task.questDeadlinePassed = questDeadlinePassed(task);
  task.lockState = computeLockState(task);
  task.isChecked = checkedTaskIds.has(id);
  return task;
}

function buildBoard(tasks, tab) {
  const isQuestTab = tab === "quest";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = dayKey(today);

  const overdue = [];
  const todayList = [];
  const upcomingList = [];

  tasks.forEach((task) => {
    if (task.project_id || task.projectId) return;
    if (task.isSide !== isQuestTab) return;
    if (!isVisible(task)) return;
    if (task.archived || task.is_archived) return;

    const normStatus = String(task.status || "").toLowerCase().replace(/[\s_]/g, "");
    const normTaskStatus = String(task.task_status || "").toLowerCase().replace(/[\s_]/g, "");
    const isComplete = /complete|done/.test(normStatus) || /complete|done/.test(normTaskStatus);
    if (isComplete) return;

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

    if (task.questDeadlinePassed) {
      overdue.push(task);
      return;
    }

    if (matchedDay === "today") todayList.push(task);
    else if (matchedDay === "upcoming")
      upcomingList.push({ task, nextKey: nextKey || 99999999 });
  });

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

function isVisible(task) {
  const isStaff = currentRole === "staff";
  if (!currentUserUid) return true;

  if (isStaff) {
    if (!currentDept) return false;
    const depts = task.departments;
    if (!depts.length) return true;
    const deptLower = currentDept.toLowerCase();
    const hasDeptData = depts.some((d) => d && (d.id || d.name));
    if (!hasDeptData) return true;
    return depts.some((d) => {
      if (!d) return false;
      const id = d.id || d.department_id || "";
      const name = d.name || d.department_name || d.department || "";
      return (
        (id && String(id).toLowerCase() === deptLower) ||
        (name && String(name).toLowerCase() === deptLower)
      );
    });
  }

  const assignList = Array.isArray(task.assign_to)
    ? task.assign_to
    : task.assign_to
      ? [task.assign_to]
      : [];
  const hasValidUID = assignList.some(
    (uid) => typeof uid === "string" && uid.length >= 20
  );
  const isCreator = task.created_by && String(task.created_by) === String(currentUserUid);
  if (hasValidUID && assignList.length > 0 && assignList.indexOf(currentUserUid) === -1 && !isCreator) {
    return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Event Handlers Wire                                                 */
/* ------------------------------------------------------------------ */

function wireEventHandlers() {
  // Modal overlay close buttons
  document.addEventListener("click", (e) => {
    const closeBtn = e.target.closest("#dgQuestModalCloseBtn");
    if (closeBtn) {
      closeQuestModal();
      return;
    }

    // Close when clicking overlay backdrop outside the dialog
    if (e.target.id === "dgQuestModalOverlay") {
      closeQuestModal();
      return;
    }

    // Sub-modal close button
    const subCloseBtn = e.target.closest("[data-close]");
    if (subCloseBtn) {
      const targetId = subCloseBtn.getAttribute("data-close");
      ui.closeSubModalById(targetId);
      return;
    }

    // Tab switching
    const tabBtn = e.target.closest(".dg-quest-tab-btn");
    if (tabBtn && tabBtn.dataset.tab) {
      switchTab(tabBtn.dataset.tab);
      return;
    }

    // Add new button
    if (e.target.closest("#dgQuestAddBtn")) {
      const usersList = Object.keys(usersMap).map((id) => ({
        id,
        name: usersMap[id].name || id,
        email: usersMap[id].email || "",
        photo: usersMap[id].photo || "",
        department: usersMap[id].department || "",
        position: usersMap[id].position || "",
      }));
      ui.openQuestForm(
        "create",
        null,
        { departments: departmentsCache, positions: positionsCache, users: usersList },
        currentTab
      );
      return;
    }

    // Check / toggle task for daily report
    const checkBtn = e.target.closest(".dg-quest-check-btn");
    if (checkBtn && checkBtn.dataset.check) {
      toggleChecked(checkBtn.dataset.check);
      return;
    }

    // Task Detail
    const detailBtn = e.target.closest("[data-detail]");
    if (detailBtn && detailBtn.dataset.detail) {
      const taskId = detailBtn.dataset.detail;
      const task = questTasks[taskId];
      if (task) {
        ui.openQuestDetail(task, { users: usersMap }, currentTab);
      }
      return;
    }

    // Task Edit
    const editBtn = e.target.closest("[data-edit]");
    if (editBtn && editBtn.dataset.edit) {
      const taskId = editBtn.dataset.edit;
      const task = questTasks[taskId];
      if (task) {
        const usersList = Object.keys(usersMap).map((id) => ({
          id,
          name: usersMap[id].name || id,
          email: usersMap[id].email || "",
          photo: usersMap[id].photo || "",
          department: usersMap[id].department || "",
          position: usersMap[id].position || "",
        }));
        ui.openQuestForm(
          "edit",
          task,
          { departments: departmentsCache, positions: positionsCache, users: usersList },
          currentTab
        );
      }
      return;
    }

    // Task Delete
    const deleteBtn = e.target.closest("[data-delete]");
    if (deleteBtn && deleteBtn.dataset.delete) {
      const taskId = deleteBtn.dataset.delete;
      confirmDeleteTask(taskId);
      return;
    }

    // Submit Report trigger from header
    if (
      e.target.closest("#dgDailySubmitReportBtn") ||
      e.target.closest("#dgQuestSubmitReportBtn")
    ) {
      handleOpenDailyReport();
      return;
    }

    // Submit Daily Report confirmation button
    if (e.target.closest("#dgSubmitReportBtn")) {
      handleSubmitDailyReport();
      return;
    }
  });

  // Form submit handler
  const form = document.getElementById("dgQuestForm");
  if (form) {
    form.addEventListener("submit", handleQuestFormSubmit);
  }
}

function switchTab(tab) {
  currentTab = tab;
  ui.setActiveTab(tab);
  loadBoard();
}

function toggleChecked(taskId) {
  if (checkedTaskIds.has(taskId)) {
    checkedTaskIds.delete(taskId);
  } else {
    checkedTaskIds.add(taskId);
  }
  const btn = document.querySelector(`.dg-quest-check-btn[data-check="${taskId}"]`);
  if (btn) {
    btn.classList.toggle("checked", checkedTaskIds.has(taskId));
  }
}

async function handleQuestFormSubmit(e) {
  e.preventDefault();
  const formValues = ui.readQuestForm(currentTab);
  if (!formValues.title) {
    ui.notifyError("Judul wajib diisi.");
    return;
  }
  if (formValues.assignTo.length === 0) {
    ui.notifyError("Quest harus di-assign ke minimal satu user.");
    return;
  }
  if (!formValues.points || formValues.points === 0) {
    ui.notifyError("Quest tidak punya nilai.");
    return;
  }

  const isSide = currentTab === "quest"; // daily => main, quest => side
  const payload = {
    title: formValues.title,
    description: formValues.description,
    points: formValues.points,
    priority: formValues.priority || "normal",
    tags: formValues.tags || [],
    deadline_time: formValues.deadline_time,
    due_date: isSide ? formValues.due_date : "",
    type: isSide ? "side" : "main",
    quest_type: isSide ? "side" : "main",
    recur: isSide ? null : formValues.recur,
    departments: formValues.deptId
      ? [{ id: formValues.deptId, name: formValues.deptName || formValues.deptId }]
      : [],
    positions: formValues.posId
      ? [{ id: formValues.posId, name: formValues.posName || formValues.posId }]
      : [],
    assign_to: formValues.assignTo,
    notify_to: formValues.assignTo.slice(),
  };

  try {
    if (formValues.id) {
      await repo.updateTask(formValues.id, payload);
      ui.notifySuccess(
        `${isSide ? "Quest" : "Daily"} berhasil diperbarui!`
      );
    } else {
      payload.created_by = currentUserUid;
      payload.created_by_name = currentUserName;
      payload.status = "Initiate";
      await repo.createTask(payload);
      ui.notifySuccess(
        `${isSide ? "Quest" : "Daily"} berhasil ditambahkan!`
      );
    }

    ui.closeQuestForm();
    await loadBoard();
    refreshShellCounts();
  } catch (err) {
    console.error("Failed to save quest:", err);
    ui.notifyError("Gagal menyimpan: " + (err && err.message ? err.message : err));
  }
}

async function confirmDeleteTask(taskId) {
  if (confirm("Apakah Anda yakin ingin menghapus item ini?")) {
    try {
      await repo.deleteTask(taskId);
      ui.notifySuccess("Item berhasil dihapus.");
      await loadBoard();
      refreshShellCounts();
    } catch (err) {
      console.error("Failed to delete task:", err);
      ui.notifyError("Gagal menghapus: " + (err && err.message ? err.message : err));
    }
  }
}

function handleOpenDailyReport() {
  const checked = Array.from(checkedTaskIds)
    .map((id) => questTasks[id])
    .filter(Boolean);
  ui.openDailyReportModal(checked, currentUserName);
}

async function handleSubmitDailyReport() {
  const checkedIds = ui.collectCheckedIds();
  if (!checkedIds.length) {
    ui.notifyError("Belum ada item yang dicentang.");
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

  checkedIds.forEach((id) => {
    const task = questTasks[id];
    if (!task) return;
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

  const deptArray = Object.keys(deptSet);
  const payload = {
    date: now.toISOString(),
    date_label: now.toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    report_date: `${yyyy}-${mm}-${dd}`,
    user_id: currentUserUid,
    name: currentUserName,
    departments: deptArray,
    department: deptArray.length ? deptArray[0] : "",
    tasks: tasksDetail,
    task_ids: checkedIds.slice(),
    total_points: totalPoints,
    status: "Pending Review",
  };

  ui.setReportSubmitBusy(true, "Mengirim...");
  try {
    await repo.submitDailyReport(payload);
    await Promise.all(
      checkedIds.map((id) => repo.markTaskReported(id, [currentUserUid]))
    );
    ui.notifySuccess("Laporan harian berhasil dikirim!");
    ui.closeDailyReportModal();
    checkedTaskIds.clear();
    await loadBoard();
    refreshShellCounts();
  } catch (err) {
    console.error("Failed to submit daily report:", err);
    ui.notifyError(
      "Gagal mengirim laporan: " + (err && err.message ? err.message : err)
    );
  } finally {
    ui.setReportSubmitBusy(false);
  }
}

function refreshShellCounts() {
  const mount = document.getElementById("dg-sidebar-mount");
  if (mount) {
    getSidebarCounts()
      .then((counts) => {
        applyCounts(mount, counts);
      })
      .catch(() => {});
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  return (tmp.textContent || tmp.innerText || "").trim();
}

function isSideQuestTask(data) {
  const qt = String(data.quest_type || "").toLowerCase().replace(/[\s_]/g, "");
  if (qt === "side" || qt === "sidequest" || qt === "side-quest") return true;
  if (qt === "main" || qt === "mainquest") return false;
  const t = String(data.type || data.status || "").toLowerCase().replace(/[\s_]/g, "");
  if (t === "side" || t === "sidequest" || t === "side-quest") return true;
  if (data.task_status) return true;
  return false;
}

function firstDeptId(departments) {
  if (!Array.isArray(departments)) return "";
  const d = departments.find((x) => x);
  return d && (d.id || d.department_id || "");
}

function firstPosId(positions) {
  if (!Array.isArray(positions)) return "";
  const p = positions.find((x) => x);
  return p && (p.id || p.position_id || "");
}

function questDeadlinePassed(task) {
  if (!task.isSide) return false;
  const status = String(task.status || "").toLowerCase().replace(/[\s_]/g, "");
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
  return repo.getMs(value);
}

function dayKey(date) {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

function findNextOccurrenceKey(recur, fromDate, maxDays) {
  const unit = normalizeRecurUnit(recur);
  if (unit === "day") return dayKey(fromDate);
  const weekdays = normalizeNumberList(
    recur.weekdays || recur.days || recur.repeat_on || recur.repeatOn
  );
  const monthlyDates = normalizeNumberList(
    recur.monthly_dates || recur.monthlyDates || recur.dates
  );
  if ((!weekdays || !weekdays.length) && (!monthlyDates || !monthlyDates.length)) {
    return dayKey(fromDate);
  }
  for (let offset = 0; offset <= maxDays; offset++) {
    const candidate = new Date(
      fromDate.getFullYear(),
      fromDate.getMonth(),
      fromDate.getDate()
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
    recur && (recur.weekdays || recur.days || recur.repeat_on || recur.repeatOn);
  if (weekdays && Array.isArray(weekdays) && weekdays.length) return "week";
  const monthlyDates =
    recur && (recur.monthly_dates || recur.monthlyDates || recur.dates);
  if (monthlyDates && Array.isArray(monthlyDates) && monthlyDates.length) return "month";
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
      lrb.map((uid) => (usersMap[uid] && usersMap[uid].name) || uid).join(", ") ||
      "someone";
  }
  return result;
}
