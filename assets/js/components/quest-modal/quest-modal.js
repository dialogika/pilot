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

let currentTab = "daily"; // 'daily' | 'quest'
let currentUserUid = "";
let currentUserName = "";
let currentUserPos = "";
let currentRole = "";
let currentDept = "";
let usersMap = {};
let departmentsCache = [];
let positionsCache = [];
let questTasks = {};
let checkedTaskIds = new Set();
let selectedDeleteTaskIds = new Set();
let currentBoardCache = null;
let isInitialized = false;

/**
 * Build a deduplicated user list from usersMap (which may have dual keys: docId + uid).
 * Each user appears once, keyed by their canonical docId.
 */
/**
 * Build a deduplicated user list from usersMap.
 * Each user appears once, keyed by their canonical docId (or uid).
 */
function getUniqueUsersList() {
  const seen = new Set();
  const list = [];
  Object.keys(usersMap).forEach((key) => {
    const u = usersMap[key];
    if (!u) return;
    const canonical = u.docId || u.uid || key;
    if (seen.has(canonical)) return;
    seen.add(canonical);
    list.push({ id: canonical, ...u });
  });
  return list;
}

/**
 * Given a user key (docId, uid, or email), return all known IDs for that user
 * (docId, uid, email, aliases) so assign_to contains all aliases.
 */
function getUserAllIds(key) {
  if (!key) return [];
  const ids = new Set();
  ids.add(key);
  const keyLower = String(key).toLowerCase();
  ids.add(keyLower);

  const u = usersMap[key] || usersMap[keyLower];
  if (u) {
    if (u.docId) {
      ids.add(u.docId);
      ids.add(String(u.docId).toLowerCase());
    }
    if (u.uid) {
      ids.add(u.uid);
      ids.add(String(u.uid).toLowerCase());
    }
    if (u.email) {
      ids.add(u.email);
      ids.add(String(u.email).toLowerCase());
    }
    if (Array.isArray(u.allAliases)) {
      u.allAliases.forEach((a) => {
        if (a) {
          ids.add(a);
          ids.add(String(a).toLowerCase());
        }
      });
    }
  }

  // Also check across all users in usersMap in case key matches docId, uid, email, or name
  Object.values(usersMap).forEach((user) => {
    if (!user) return;
    const uName = String(user.name || user.displayName || user.username || "").toLowerCase();
    if (
      user.docId === key ||
      String(user.docId).toLowerCase() === keyLower ||
      user.uid === key ||
      String(user.uid).toLowerCase() === keyLower ||
      String(user.email).toLowerCase() === keyLower ||
      (uName && uName === keyLower)
    ) {
      if (user.docId) {
        ids.add(user.docId);
        ids.add(String(user.docId).toLowerCase());
      }
      if (user.uid) {
        ids.add(user.uid);
        ids.add(String(user.uid).toLowerCase());
      }
      if (user.email) {
        ids.add(user.email);
        ids.add(String(user.email).toLowerCase());
      }
      if (user.name) {
        ids.add(user.name);
        ids.add(String(user.name).toLowerCase());
      }
      if (Array.isArray(user.allAliases)) {
        user.allAliases.forEach((a) => {
          if (a) {
            ids.add(a);
            ids.add(String(a).toLowerCase());
          }
        });
      }
    }
  });

  return Array.from(ids);
}

/**
 * Get all known IDs for the current logged-in user.
 */
function getCurrentUserAllIds() {
  const ids = new Set();
  const currentUid = auth.currentUser?.uid || currentUserUid;
  const currentEmail = auth.currentUser?.email;

  if (currentUid) {
    ids.add(currentUid);
    ids.add(String(currentUid).toLowerCase());
  }
  if (currentEmail) {
    ids.add(currentEmail);
    ids.add(String(currentEmail).toLowerCase());
  }
  if (currentUserUid) {
    ids.add(currentUserUid);
    ids.add(String(currentUserUid).toLowerCase());
  }

  // Look up current user strictly in usersMap by uid, docId, or email
  let matchedUser = null;
  if (currentUid && (usersMap[currentUid] || usersMap[String(currentUid).toLowerCase()])) {
    matchedUser = usersMap[currentUid] || usersMap[String(currentUid).toLowerCase()];
  } else if (currentEmail && (usersMap[currentEmail] || usersMap[String(currentEmail).toLowerCase()])) {
    matchedUser = usersMap[currentEmail] || usersMap[String(currentEmail).toLowerCase()];
  } else {
    for (const u of Object.values(usersMap)) {
      if (!u) continue;
      if (
        (currentUid && (u.uid === currentUid || u.docId === currentUid)) ||
        (currentEmail && String(u.email || "").toLowerCase() === String(currentEmail).toLowerCase())
      ) {
        matchedUser = u;
        break;
      }
    }
  }

  if (matchedUser) {
    if (matchedUser.docId) {
      ids.add(matchedUser.docId);
      ids.add(String(matchedUser.docId).toLowerCase());
    }
    if (matchedUser.uid) {
      ids.add(matchedUser.uid);
      ids.add(String(matchedUser.uid).toLowerCase());
    }
    if (matchedUser.email) {
      ids.add(matchedUser.email);
      ids.add(String(matchedUser.email).toLowerCase());
    }
    if (matchedUser.name) {
      ids.add(matchedUser.name);
      ids.add(String(matchedUser.name).toLowerCase());
    }
    if (Array.isArray(matchedUser.allAliases)) {
      matchedUser.allAliases.forEach((a) => {
        if (a) {
          ids.add(a);
          ids.add(String(a).toLowerCase());
        }
      });
    }
  }

  return Array.from(ids);
}

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
 * @param {{ initialTab?: 'daily'|'quest', autoOpenReport?: boolean }} [opts]
 */
export async function openQuestModal(opts = {}) {
  initQuestModal();
  currentTab = opts.initialTab === "quest" ? "quest" : "daily";

  ui.showModalOverlay();
  ui.setActiveTab(currentTab);
  ui.showBoardLoading();

  try {
    // 1. Ensure Firebase Auth state is resolved
    if (!auth.currentUser) {
      await new Promise((resolve) => {
        const unsub = auth.onAuthStateChanged((user) => {
          unsub();
          resolve(user);
        });
      });
    }

    const u = auth.currentUser;
    if (u) {
      currentUserUid = u.uid;
      currentUserName = u.displayName || u.email || "User";
      try {
        const tokenRes = await u.getIdTokenResult(true);
        if (tokenRes && tokenRes.claims && tokenRes.claims.role) {
          currentRole = tokenRes.claims.role;
        }
      } catch (_) {}
    }

    // 2. Load supporting data (always ensure usersMap is fresh)
    const [users, depts, pos] = await Promise.all([
      repo.loadUsersMap().catch((e) => {
        console.warn("quest-modal: loadUsersMap failed", e);
        return {};
      }),
      repo.loadDepartments().catch((e) => {
        console.warn("quest-modal: loadDepartments failed", e);
        return [];
      }),
      repo.loadPositions().catch((e) => {
        console.warn("quest-modal: loadPositions failed", e);
        return [];
      }),
    ]);
    usersMap = users || {};
    departmentsCache = depts || [];
    positionsCache = pos || [];

    if (currentUserUid) {
      const info =
        usersMap[currentUserUid] ||
        usersMap[String(currentUserUid).toLowerCase()] ||
        (u && u.email ? usersMap[String(u.email).toLowerCase()] : null);
      if (info) {
        currentUserName = info.name || currentUserName;
        if (!currentRole) currentRole = info.role || "";
        currentDept = String(info.department || "").trim();
        currentUserPos = String(info.position || "").trim();
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
      normalizeTask(id, data, departmentsCache, positionsMap),
    );
    questTasks = normalized.reduce((acc, t) => {
      acc[t.id] = t;
      return acc;
    }, {});

    // Diagnostic logging for debugging assign_to visibility
    const myIds = getCurrentUserAllIds();
    console.log("[QuestModal] Current user IDs (all aliases):", myIds);
    console.log("[QuestModal] Total tasks loaded:", rows.length);
    rows.forEach(({ id, data }) => {
      console.log(`[QuestModal] Task "${data.title}" (${id}) | assign_to:`, data.assign_to, "| created_by:", data.created_by);
    });

    const board = buildBoard(normalized, currentTab);
    currentBoardCache = board;

    // Clean up selected ids that no longer exist
    const currentTaskIds = new Set(normalized.map((t) => t.id));
    selectedDeleteTaskIds.forEach((id) => {
      if (!currentTaskIds.has(id)) selectedDeleteTaskIds.delete(id);
    });

    ui.renderBoard(currentTab, board, {
      users: usersMap,
      currentUid: currentUserUid,
      currentRole,
      selectedForDelete: selectedDeleteTaskIds,
    });
    updateBulkUI();
  } catch (error) {
    console.error("Failed to load quest tasks:", error);
    ui.showBoardError(error && error.message ? error.message : String(error));
  }
}

function normalizeTask(id, data, departments, positionsMap) {
  const task = { ...data, id };
  task.title =
    data.title || (isSideQuestTask(data) ? "Untitled Quest" : "Untitled Daily");
  task.points =
    typeof data.points === "number" ? data.points : Number(data.points) || 0;
  task.descText = stripHtml(data.description || "");
  task.isSide = isSideQuestTask(data);
  task.deptId = firstDeptId(data.departments);
  const myAliases = getCurrentUserAllIds().map((x) => String(x).toLowerCase().trim());
  const createdByRaw = data.created_by || data.createdBy || "";
  task.isOwner = Boolean(
    createdByRaw &&
      myAliases.some(
        (uk) => String(createdByRaw).toLowerCase().trim() === uk,
      ),
  );

  const assignList = (Array.isArray(data.assign_to)
    ? data.assign_to
    : data.assign_to
      ? [data.assign_to]
      : []
  ).map((x) => String(x).toLowerCase().trim());

  const currentUidLower = String(currentUserUid || auth.currentUser?.uid || "").toLowerCase().trim();
  const currentEmailLower = String(auth.currentUser?.email || "").toLowerCase().trim();

  const isDirectAssignee =
    assignList.length > 0 &&
    assignList.some((uid) => {
      const cleanUid = String(uid).toLowerCase().trim();
      return (
        (currentUidLower && cleanUid === currentUidLower) ||
        (currentEmailLower && cleanUid === currentEmailLower)
      );
    });

  task.isSelfAssigned = Boolean(task.isOwner && isDirectAssignee);
  task.isAssignee = isDirectAssignee;

  const reportList = (Array.isArray(data.report_to)
    ? data.report_to
    : data.report_to
      ? [data.report_to]
      : []
  ).map((x) => String(x).toLowerCase().trim());
  task.isReportTo = reportList.some((uid) => myAliases.includes(uid));
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
      data.start_date,
  );
  task.questDeadlinePassed = questDeadlinePassed(task);
  task.lockState = computeLockState(task);
  task.isChecked = checkedTaskIds.has(id);

  const normStatus = String(data.status || data.task_status || data.Status || "").toLowerCase();
  const isApproved = normStatus === "approved";
  const isRejected = normStatus === "rejected";
  const reportedToday = !isRejected && !isApproved && isReportedToday(data, myAliases);
  task.isApproved = isApproved;
  task.isRejected = isRejected;
  task.rejectionReason = data.rejection_reason || "";
  task.isReported = !isRejected && !isApproved && (reportedToday || normStatus === "reported" || normStatus === "pending review");
  return task;
}

function isReportedToday(data, myAliases) {
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
  return true;
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

    const normStatus = String(task.status || "")
      .toLowerCase()
      .replace(/[\s_]/g, "");
    const normTaskStatus = String(task.task_status || "")
      .toLowerCase()
      .replace(/[\s_]/g, "");
    const isComplete =
      /complete|done/.test(normStatus) || /complete|done/.test(normTaskStatus);
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
  if (!currentUserUid && !auth.currentUser) return true;
  const roleLower = String(currentRole || "").toLowerCase();
  const isAdmin = ["owner", "admin", "super-admin", "superadmin"].includes(roleLower);
  if (isAdmin) return true;

  const myAliases = getCurrentUserAllIds().map((x) => String(x).toLowerCase());

  const assignList = (Array.isArray(task.assign_to)
    ? task.assign_to
    : task.assign_to
      ? [task.assign_to]
      : []
  ).map((x) => String(x).toLowerCase());

  const reportList = (Array.isArray(task.report_to)
    ? task.report_to
    : task.report_to
      ? [task.report_to]
      : []
  ).map((x) => String(x).toLowerCase());

  const isAssignee = assignList.some((uid) => myAliases.includes(uid));
  const isReporter = reportList.some((uid) => myAliases.includes(uid));
  const isCreator = task.created_by && myAliases.includes(String(task.created_by).toLowerCase());

  // 1. If user is explicitly assigned, reported to, or created the task -> ALWAYS VISIBLE
  if (isAssignee || isReporter || isCreator) {
    return true;
  }

  // 2. If task has specific assignees and current user is NOT in the list -> HIDE IT
  if (assignList.length > 0 && !isAssignee) {
    return false;
  }

  // 3. For department-wide / unassigned tasks, filter by department if role is staff
  const isStaff = roleLower === "staff";
  if (isStaff && currentDept) {
    const depts = task.departments;
    if (!depts || !depts.length) return true;
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
      const usersList = getUniqueUsersList();
      ui.openQuestForm(
        "create",
        null,
        {
          departments: departmentsCache,
          positions: positionsCache,
          users: usersList,
          currentUserId: currentUserUid,
          userDept: currentDept,
        },
        currentTab,
      );
      return;
    }

    // Toggle multi-select checkbox for bulk delete
    const selectCheckbox = e.target.closest(".dg-quest-select-checkbox");
    if (selectCheckbox && selectCheckbox.dataset.selectTask) {
      toggleSelectTask(selectCheckbox.dataset.selectTask);
      return;
    }

    // Bulk action bar buttons
    if (e.target.closest("#dgQuestSelectAllBtn")) {
      toggleSelectAll();
      return;
    }

    if (e.target.closest("#dgQuestClearSelectBtn")) {
      clearSelection();
      return;
    }

    if (e.target.closest("#dgQuestBulkDeleteBtn")) {
      handleBulkDelete();
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
        const usersList = getUniqueUsersList();
        ui.openQuestForm(
          "edit",
          task,
          {
            departments: departmentsCache,
            positions: positionsCache,
            users: usersList,
            currentUserId: currentUserUid,
          },
          currentTab,
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

    // Quest / Daily Form submit button click
    if (e.target.closest("#dgQuestFormSubmit")) {
      e.preventDefault();
      handleQuestFormSubmit(e);
      return;
    }
  });

  // Delegated Form submit handler
  document.addEventListener("submit", (e) => {
    if (e.target && (e.target.id === "dgQuestForm" || e.target.closest("#dgQuestForm"))) {
      e.preventDefault();
      handleQuestFormSubmit(e);
    }
  });
}

function switchTab(tab) {
  currentTab = tab;
  selectedDeleteTaskIds.clear();
  ui.setActiveTab(tab);
  loadBoard();
}

function getDeletableTaskIds(board) {
  if (!board) return [];
  const deletable = [];
  const allTasks = [
    ...(board.overdue || []),
    ...(board.today || []),
    ...(board.upcoming || []),
  ];
  const roleLower = String(currentRole || "").toLowerCase();
  const isAdmin = ["owner", "admin", "super-admin", "superadmin"].includes(roleLower);

  allTasks.forEach((t) => {
    if (isAdmin || t.isOwner) {
      deletable.push(t.id);
    }
  });
  return deletable;
}

function updateBulkUI() {
  const deletableIds = currentBoardCache ? getDeletableTaskIds(currentBoardCache) : [];
  ui.updateBulkActionBar(selectedDeleteTaskIds.size, deletableIds.length);
  ui.syncCardSelections(selectedDeleteTaskIds);
}

function toggleSelectTask(taskId) {
  if (!taskId) return;
  if (selectedDeleteTaskIds.has(taskId)) {
    selectedDeleteTaskIds.delete(taskId);
  } else {
    selectedDeleteTaskIds.add(taskId);
  }
  updateBulkUI();
}

function toggleSelectAll() {
  const deletableIds = currentBoardCache ? getDeletableTaskIds(currentBoardCache) : [];
  if (deletableIds.length === 0) {
    ui.notifyError("Tidak ada task yang dapat dipilih pada tab ini.");
    return;
  }

  const allSelected = deletableIds.every((id) => selectedDeleteTaskIds.has(id));
  if (allSelected) {
    deletableIds.forEach((id) => selectedDeleteTaskIds.delete(id));
  } else {
    deletableIds.forEach((id) => selectedDeleteTaskIds.add(id));
  }
  updateBulkUI();
}

function clearSelection() {
  selectedDeleteTaskIds.clear();
  updateBulkUI();
}

async function handleBulkDelete() {
  const count = selectedDeleteTaskIds.size;
  if (count === 0) {
    ui.notifyError("Pilih minimal satu task untuk dihapus.");
    return;
  }

  const msg = count === 1
    ? "Apakah Anda yakin ingin menghapus 1 task yang dipilih?"
    : `Apakah Anda yakin ingin menghapus ${count} task yang dipilih secara massal? Tindakan ini tidak dapat dibatalkan.`;

  if (!confirm(msg)) return;

  ui.setBulkDeleteButtonBusy(true);
  try {
    const idsToDelete = Array.from(selectedDeleteTaskIds);
    await repo.deleteTasks(idsToDelete);
    ui.notifySuccess(`${idsToDelete.length} task berhasil dihapus.`);
    selectedDeleteTaskIds.clear();
    await loadBoard();
    refreshShellCounts();
  } catch (err) {
    console.error("Failed to bulk delete tasks:", err);
    ui.notifyError("Gagal menghapus task: " + (err && err.message ? err.message : err));
  } finally {
    ui.setBulkDeleteButtonBusy(false);
  }
}

function toggleChecked(taskId) {
  if (checkedTaskIds.has(taskId)) {
    checkedTaskIds.delete(taskId);
  } else {
    checkedTaskIds.add(taskId);
  }
  const btn = document.querySelector(
    `.dg-quest-check-btn[data-check="${taskId}"]`,
  );
  if (btn) {
    btn.classList.toggle("checked", checkedTaskIds.has(taskId));
  }
}

async function handleQuestFormSubmit(e) {
  if (e && typeof e.preventDefault === "function") {
    e.preventDefault();
  }

  if (!auth.currentUser) {
    await new Promise((resolve) => {
      const unsub = auth.onAuthStateChanged((u) => {
        unsub();
        resolve(u);
      });
    });
  }

  if (!auth.currentUser) {
    ui.notifyError("Sesi login tidak ditemukan. Silakan login kembali di halaman login.");
    return;
  }

  // Force-refresh token to ensure newly assigned custom claims (role) are active in Firestore rules
  try {
    const tokenRes = await auth.currentUser.getIdTokenResult(true);
    console.log("[QuestModal] Auth User:", auth.currentUser.uid, "Claims Role:", tokenRes?.claims?.role);
  } catch (tErr) {
    console.warn("[QuestModal] Token refresh warning:", tErr);
  }

  const formValues = ui.readQuestForm(currentTab);
  if (!formValues.title) {
    ui.notifyError("Judul wajib diisi.");
    return;
  }

  const submitBtn = document.getElementById("dgQuestFormSubmit");
  const origBtnText = submitBtn ? submitBtn.textContent : "";
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";
  }

  const expandedAssignTo = new Set();
  (formValues.assignTo || []).forEach((id) => {
    if (id) {
      expandedAssignTo.add(String(id));
      expandedAssignTo.add(String(id).toLowerCase());
    }
    getUserAllIds(id).forEach((alias) => {
      if (alias) {
        expandedAssignTo.add(String(alias));
        expandedAssignTo.add(String(alias).toLowerCase());
      }
    });
  });

  const expandedReportTo = new Set();
  (formValues.reportTo || []).forEach((id) => {
    if (id) {
      expandedReportTo.add(String(id));
      expandedReportTo.add(String(id).toLowerCase());
    }
    getUserAllIds(id).forEach((alias) => {
      if (alias) {
        expandedReportTo.add(String(alias));
        expandedReportTo.add(String(alias).toLowerCase());
      }
    });
  });

  const rawPayload = {
    title: formValues.title,
    description: formValues.description,
    points: formValues.points,
    priority: formValues.priority,
    tags: formValues.tags,
    deadline_time: formValues.deadline_time,
    due_date: formValues.due_date,
    start_date: formValues.start_date || null,
    start_time: formValues.start_time || null,
    type: formValues.type,
    quest_type: formValues.type === "side" ? "side" : "main",
    recur: formValues.recur || null,
    departments: formValues.deptId
      ? [{ id: formValues.deptId, name: formValues.deptName }]
      : [],
    positions: formValues.posId
      ? [{ id: formValues.posId, name: formValues.posName }]
      : [],
    assign_to: Array.from(expandedAssignTo),
    report_to: Array.from(expandedReportTo),
  };

  // Sanitize payload to prevent undefined field values in Firestore
  const payload = {};
  Object.keys(rawPayload).forEach((k) => {
    if (rawPayload[k] !== undefined) {
      payload[k] = rawPayload[k];
    }
  });

  try {
    if (formValues.id) {
      await repo.updateTask(formValues.id, payload);
      ui.notifySuccess(
        `${currentTab === "daily" ? "Daily" : "Quest"} berhasil diperbarui!`,
      );
    } else {
      payload.created_by = currentUserUid || (auth.currentUser ? auth.currentUser.uid : "") || "unknown";
      await repo.createTask(payload);
      ui.notifySuccess(
        `${currentTab === "daily" ? "Daily" : "Quest"} berhasil ditambahkan!`,
      );
    }

    ui.closeQuestForm();
    await loadBoard();
    refreshShellCounts();
  } catch (err) {
    console.error("Failed to save quest:", err);
    ui.notifyError(
      "Gagal menyimpan: " + (err && err.message ? err.message : err),
    );
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = origBtnText;
    }
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
      ui.notifyError(
        "Gagal menghapus: " + (err && err.message ? err.message : err),
      );
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

  // Ensure fresh token if available
  if (auth.currentUser) {
    try {
      await auth.currentUser.getIdToken(true);
    } catch (_) {}
  }

  const activeUid = (auth.currentUser && auth.currentUser.uid) || currentUserUid || "";
  const activeName = currentUserName || (auth.currentUser ? (auth.currentUser.displayName || auth.currentUser.email) : "User") || "User";

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  const deptSet = {};
  const tasksDetail = [];
  let totalPoints = 0;
  const reportToSet = new Set();
  const createdBySet = new Set();

  checkedIds.forEach((id) => {
    const task = questTasks[id];
    if (!task) return;
    (task.departments || []).forEach((d) => {
      if (d && d.name) deptSet[d.name] = true;
    });

    const rto = Array.isArray(task.report_to)
      ? task.report_to
      : task.report_to
      ? [task.report_to]
      : [];
    rto.forEach((u) => {
      if (u) reportToSet.add(String(u));
    });

    if (task.created_by) createdBySet.add(String(task.created_by));
    if (task.createdBy) createdBySet.add(String(task.createdBy));

    const pts = typeof task.points === "number" ? task.points : Number(task.points) || 0;
    totalPoints += pts;
    tasksDetail.push({
      task_id: id,
      title: task.title || "Untitled",
      points: pts,
      detail: details[id] || "",
      who_did_this: [activeUid],
      report_to: rto,
      created_by: task.created_by || task.createdBy || "",
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
    user_id: activeUid,
    name: activeName,
    position: currentUserPos || "",
    departments: deptArray,
    department: deptArray.length ? deptArray[0] : "",
    report_to: Array.from(reportToSet),
    created_by: Array.from(createdBySet),
    tasks: tasksDetail,
    task_ids: checkedIds.slice(),
    total_points: totalPoints,
    status: "Pending Review",
  };

  ui.setReportSubmitBusy(true, "Mengirim...");
  try {
    await repo.submitDailyReport(payload);
    try {
      await Promise.all(
        checkedIds.map((id) => repo.markTaskReported(id, [currentUserUid])),
      );
    } catch (markErr) {
      console.warn("Could not mark task reported in tasks collection:", markErr);
    }
    ui.notifySuccess("Laporan harian berhasil dikirim!");
    ui.closeDailyReportModal();
    checkedTaskIds.clear();
    await loadBoard();
    refreshShellCounts();
  } catch (err) {
    console.error("Failed to submit daily report:", err);
    ui.notifyError(
      "Gagal mengirim laporan: " + (err && err.message ? err.message : err),
    );
  } finally {
    ui.setReportSubmitBusy(false);
  }
}

async function refreshShellCounts() {
  const mount = document.getElementById("dg-sidebar-mount");
  if (mount) {
    try {
      const { getSidebarCounts } = await import("../sidebar/sidebar.repository.js");
      const { applyCounts } = await import("../sidebar/sidebar.ui.js");
      const counts = await getSidebarCounts();
      applyCounts(mount, counts);
    } catch (e) {}
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
  const status = String(task.status || "")
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
  if (typeof repo.toMs === "function") return repo.toMs(value);
  if (typeof repo.getMs === "function") return repo.getMs(value);
  return null;
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
