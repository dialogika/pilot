// pages/quest/quest.ui.js
// =====================================================================
// QUEST UI — rendering, DOM manipulation, event handling, loading/
// empty/error states, modal interactions.
//
// RULES:
//  - NO Firestore queries here (use quest.repository.js).
//  - Pure view logic; receives plain data, renders into DOM.
// =====================================================================

import { getMs, escapeHtml, formatDateID } from "../../assets/js/utils.js";
import { toast, setButtonBusy, confirmDialog } from "../../assets/js/ui.js";
import { createRichEditor } from "../../assets/js/components/rich-editor/rich-editor.js";

let reportEditorInstances = {};

/* ------------------------------------------------------------------ */
/* State helpers                                                       */
/* ------------------------------------------------------------------ */

function el(id) {
  return document.getElementById(id);
}

/* ------------------------------------------------------------------ */
/* Custom modal helpers (modals use [hidden] attr, not Bootstrap)       */
/* ------------------------------------------------------------------ */

function openModal(id) {
  const node = el(id);
  if (node) node.hidden = false;
}

function closeModal(id) {
  const node = el(id);
  if (node) node.hidden = true;
}

/* ------------------------------------------------------------------ */
/* Board render                                                        */
/* ------------------------------------------------------------------ */

/**
 * Toggle active tab and show the matching panel.
 * @param {'main'|'side'} tab
 */
export function setActiveTab(tab) {
  const isSide = tab === "side";
  el("questMainPanel")?.classList.toggle("d-none", isSide);
  el("questSidePanel")?.classList.toggle("d-none", !isSide);
  el("questTabMain")?.classList.toggle("quest-tab-active", !isSide);
  el("questTabSide")?.classList.toggle("quest-tab-active", isSide);
  if (el("questPageTitle")) {
    el("questPageTitle").textContent = isSide ? "Quest" : "Daily";
  }
}

/**
 * Render a full board (overdue/today/upcoming) into the active panel.
 * @param {'main'|'side'} tab
 * @param {{overdue:Array, today:Array, upcoming:Array}} sections
 * @param {Object} ctx { users, currentUid, currentRole }
 */
function renderTableHead() {
  return `
    <div class="dg-quest-table-head">
      <span class="dg-col-name">Name</span>
      <span class="dg-col-time">Due Date</span>
      <span class="dg-col-prio">Priority</span>
      <span class="dg-col-points">Points</span>
      <span class="dg-col-assign">Assignee</span>
      <span class="dg-col-report">Report To</span>
      <span class="dg-col-status">Status</span>
      <span class="dg-col-actions text-end">Actions</span>
    </div>
  `;
}

export function renderBoard(tab, sections, ctx) {
  const isSide = tab === "side";
  const p = isSide ? "questSide" : "quest";

  const overdueList = el(p + "OverdueList");
  const todayList = el(p + "TodayList");
  const upcomingList = el(p + "UpcomingList");

  if (overdueList) {
    overdueList.innerHTML =
      sections.overdue.length === 0
        ? emptyState("No overdue quests.")
        : `<div class="dg-quest-table-wrap">${renderTableHead()}<div class="dg-quest-table-rows">${sections.overdue.map((t) => card(t, "overdue", ctx)).join("")}</div></div>`;
    el(p + "OverdueButton")?.classList.toggle("d-none", sections.overdue.length === 0);
  }
  if (todayList) {
    todayList.innerHTML =
      sections.today.length === 0
        ? emptyState("No quests for today.")
        : `<div class="dg-quest-table-wrap">${renderTableHead()}<div class="dg-quest-table-rows">${sections.today.map((t) => card(t, "today", ctx)).join("")}</div></div>`;
  }

  const submitBtn = el(isSide ? "questSideDailyReportBtn" : "questDailyReportBtn");
  if (submitBtn) {
    const hasMyTodayTasks = (sections.today || []).some(
      (t) => Boolean(t.isAssignee && !t.isApproved)
    );
    submitBtn.classList.toggle("d-none", !hasMyTodayTasks);
  }
  if (upcomingList) {
    upcomingList.innerHTML =
      sections.upcoming.length === 0
        ? emptyState("No upcoming quests.")
        : `<div class="dg-quest-table-wrap">${renderTableHead()}<div class="dg-quest-table-rows">${sections.upcoming.map((t) => card(t, "upcoming", ctx)).join("")}</div></div>`;
  }
}

/* ------------------------------------------------------------------ */
/* Task card                                                           */
/* ------------------------------------------------------------------ */

function emptyState(text) {
  return '<p class="quest-empty">' + escapeHtml(text) + "</p>";
}

function resolveUser(rawId, usersMap) {
  if (!rawId) return null;
  if (typeof rawId === "object" && rawId !== null && (rawId.name || rawId.uid || rawId.docId)) {
    return rawId;
  }
  const strId = String(rawId).trim();
  if (!strId) return null;
  const strLower = strId.toLowerCase();

  let user = usersMap ? (usersMap[strId] || usersMap[strLower]) : null;
  if (!user && usersMap) {
    const allUsers = Object.values(usersMap);
    for (const u of allUsers) {
      if (!u) continue;
      const uDocId = String(u.docId || u.id || "").toLowerCase();
      const uUid = String(u.uid || "").toLowerCase();
      const uEmail = String(u.email || "").toLowerCase();
      const uName = String(u.name || u.displayName || u.full_name || "").toLowerCase();
      const uAliases = Array.isArray(u.allAliases) ? u.allAliases.map((a) => String(a).toLowerCase()) : [];

      if (
        (uDocId && uDocId === strLower) ||
        (uUid && uUid === strLower) ||
        (uEmail && uEmail === strLower) ||
        (uAliases.length && uAliases.includes(strLower)) ||
        (uName && uName === strLower)
      ) {
        user = u;
        break;
      }
    }
  }

  return user || { uid: strId, name: strId, photo: "" };
}

function getAssignList(task, ctx) {
  if (!task.assign_to) return [];
  const raw = Array.isArray(task.assign_to) ? task.assign_to.slice() : [task.assign_to];
  const usersMap = ctx?.users;
  const seen = new Set();
  const unique = [];

  raw.forEach((uid) => {
    if (!uid) return;
    const user = resolveUser(uid, usersMap);
    const canonicalKey = String(
      user.docId || user.uid || user.id || user.email || user.name || uid
    ).toLowerCase();
    if (!seen.has(canonicalKey)) {
      seen.add(canonicalKey);
      unique.push(user.docId || user.uid || uid);
    }
  });
  return unique;
}

function getReportToList(task, ctx) {
  if (!task.report_to) return [];
  const raw = Array.isArray(task.report_to) ? task.report_to.slice() : [task.report_to];
  const usersMap = ctx?.users;
  const seen = new Set();
  const unique = [];

  raw.forEach((uid) => {
    if (!uid) return;
    const user = resolveUser(uid, usersMap);
    const canonicalKey = String(
      user.docId || user.uid || user.id || user.email || user.name || uid
    ).toLowerCase();
    if (!seen.has(canonicalKey)) {
      seen.add(canonicalKey);
      unique.push(user.docId || user.uid || uid);
    }
  });
  return unique;
}

function priorityStyle(priority) {
  const p = String(priority || "").toLowerCase();
  if (p === "urgent") return { label: "High", color: "#dc2626" };
  if (p === "medium") return { label: "Medium", color: "#f59e0b" };
  if (p === "normal") return { label: "Normal", color: "#16a34a" };
  return null;
}

function borderColor(task, category) {
  const p = String(task.priority || "").toLowerCase();
  if (category === "overdue") return "#dc2626";
  if (task.questDeadlinePassed) return "#dc2626";
  if (p === "urgent") return "#f97316";
  if (p === "high") return "#ef4444";
  if (p === "low") return "#9ca3af";
  return "#3b82f6";
}

function badgeBg(category) {
  if (category === "overdue") return "#dc2626";
  if (category === "upcoming") return "#16a34a";
  return "#2563eb";
}

function card(task, category, ctx) {
  const id = task.id;
  const title = escapeHtml(task.title || "Untitled Quest");
  const desc = escapeHtml(task.descText || "No description provided.");
  const dueText = escapeHtml(task.deadline_time || "");
  const priority = priorityStyle(task.priority);
  const assign = getAssignList(task, ctx);
  const reportTo = getReportToList(task, ctx);

  const lockState = task.lockState || { claimed: false, done: false };
  const locked = lockState.claimed;
  const done = lockState.done;
  const lockClass = locked ? "quest-locked" : done ? "quest-done" : "";
  const lockBadge = locked
    ? claimBadge("🔒 Claimed by " + escapeHtml(lockState.claimedBy || "someone"), "quest-claim-badge-locked")
    : done
      ? claimBadge("✓ Reported", "quest-claim-badge-success")
      : "";

  let avatars = "";
  const max = 3;
  assign.slice(0, max).forEach((uid) => {
    const user = ctx.users && ctx.users[uid] ? ctx.users[uid] : { uid, name: uid };
    avatars += avatar(user);
  });
  if (assign.length > max) {
    avatars += '<span class="quest-avatar-more">+' + (assign.length - max) + "</span>";
  }

  let reportAvatars = "";
  reportTo.slice(0, max).forEach((uid) => {
    const user = ctx.users && ctx.users[uid] ? ctx.users[uid] : { uid, name: uid };
    reportAvatars += avatar(user, "report");
  });
  if (reportTo.length > max) {
    reportAvatars += '<span class="quest-avatar-more quest-avatar-more-report">+' + (reportTo.length - max) + "</span>";
  }

  let tags = "";
  (task.tags || []).forEach((t) => {
    if (t) tags += '<span class="quest-card-tag">' + escapeHtml(String(t)) + "</span>";
  });

  const pointsHtml = task.points > 0 ? '<span class="quest-card-points">' + task.points + " Point</span>" : "";
  const prioHtml = priority
    ? '<span class="quest-card-badge" style="background:' + priority.color + "20;color:" + priority.color + ';">' + escapeHtml(priority.label) + "</span>"
    : "";
  const recurHtml = task.recur ? " <i class='bi bi-arrow-repeat'></i>" : "";
  const deadlineHtml = dueText ? '<span class="quest-card-deadline" style="background:' + badgeBg(category) + ';"><i class="bi bi-clock"></i>' + escapeHtml(dueText) + recurHtml + "</span>" : "";

  const isSuperAdminOrOwner =
    ctx.currentRole === "owner" || ctx.currentRole === "super-admin";
  const canDelete =
    isSuperAdminOrOwner ||
    task.isOwner ||
    (task.isReportTo && !task.isAssignee);

  const isSelected = Boolean(
    ctx.selectedForDelete && ctx.selectedForDelete.has(id),
  );
  const selectedClass = isSelected ? " is-selected" : "";

  const isAssignee = Boolean(task.isAssignee);
  const isApproved = Boolean(task.isApproved);
  const isRejected = !isApproved && Boolean(task.isRejected);
  const isReported = !isApproved && !isRejected && Boolean(
    task.isReported || (isAssignee && task.lockState?.done)
  );

  let leftControl = "";
  if (canDelete) {
    leftControl += `<label class="dg-quest-select-task-box" title="Centang untuk pilih & hapus massal">
      <input type="checkbox" class="dg-quest-select-checkbox" data-select-task="${id}" ${isSelected ? "checked" : ""} />
      <span class="dg-quest-checkbox-custom"></span>
    </label>`;
  }

  const isWorkerAssignee = Boolean(
    category !== "upcoming" &&
      task.isAssignee &&
      (!task.isOwner || task.isSelfAssigned),
  );

  if (isWorkerAssignee) {
    if (isApproved) {
      leftControl += `<button type="button" class="dg-quest-check-btn is-approved" title="Tugas telah disetujui (Approved)" disabled><i class="bi bi-patch-check-fill"></i></button>`;
    } else if (isReported) {
      leftControl += `<button type="button" class="dg-quest-check-btn is-reported" title="Laporan sudah dikirim (Menunggu Review)" disabled><i class="bi bi-send-check"></i></button>`;
    } else {
      const isChecked = task.isChecked ? " checked" : "";
      leftControl += `<button type="button" class="dg-quest-check-btn${isChecked}" data-check="${id}" title="Centang untuk laporan"><i class="bi bi-check-lg"></i></button>`;
    }
  }

  let rightActions = `<button type="button" class="dg-quest-link-btn" data-detail="${id}" title="Detail"><i class="bi bi-eye"></i> Detail</button>`;

  if (canDelete) {
    rightActions += `<button type="button" class="dg-quest-link-btn dg-warn" data-edit="${id}" title="Edit"><i class="bi bi-pencil"></i> Edit</button>`;
    rightActions += `<button type="button" class="dg-quest-link-btn dg-danger" data-delete="${id}" title="Hapus"><i class="bi bi-trash"></i> Hapus</button>`;
  }

  const assignNames = assign
    .slice(0, 2)
    .map((uid) => (ctx.users && ctx.users[uid] ? ctx.users[uid].name || ctx.users[uid].email || uid : uid))
    .join(", ") + (assign.length > 2 ? ` +${assign.length - 2}` : "");

  const reportNames = reportTo
    .slice(0, 2)
    .map((uid) => (ctx.users && ctx.users[uid] ? ctx.users[uid].name || ctx.users[uid].email || uid : uid))
    .join(", ") + (reportTo.length > 2 ? ` +${reportTo.length - 2}` : "");

  const assignGroup = avatars
    ? `<div class="dg-quest-meta-item dg-quest-meta-assign" title="Assign To: ${escapeHtml(assignNames)}"><div class="dg-quest-avatars">${avatars}</div><span class="dg-quest-meta-name">${escapeHtml(assignNames)}</span></div>`
    : "";
  const reportGroup = reportAvatars
    ? `<div class="dg-quest-meta-item dg-quest-meta-report" title="Report To: ${escapeHtml(reportNames)}"><div class="dg-quest-avatars dg-quest-avatars-report">${reportAvatars}</div><span class="dg-quest-meta-name dg-quest-meta-name-report">${escapeHtml(reportNames)}</span></div>`
    : "";

  let statusBadge = "";
  const taskStatusLower = String(task.user_status || "").toLowerCase();
  if (isApproved || taskStatusLower === "approved" || taskStatusLower.includes("approv")) {
    statusBadge = '<span class="dg-quest-badge dg-quest-badge-approved" title="Status: Approved"><i class="bi bi-patch-check-fill"></i> Approved</span>';
  } else if (isRejected || taskStatusLower === "rejected" || taskStatusLower.includes("reject")) {
    statusBadge = `<span class="dg-quest-badge dg-quest-badge-rejected" title="${escapeHtml(task.rejectionReason ? 'Alasan: ' + task.rejectionReason : 'Ditolak')}"><i class="bi bi-x-circle-fill"></i> Rejected</span>`;
  } else if (isReported || taskStatusLower === "reported" || taskStatusLower.includes("report")) {
    statusBadge = '<span class="dg-quest-badge dg-quest-badge-reported" title="Status: Reported"><i class="bi bi-send-check"></i> Reported</span>';
  } else {
    statusBadge = '<span class="dg-quest-badge dg-quest-badge-todo" title="Status: To Do"><i class="bi bi-circle"></i> To Do</span>';
  }

  const cardDoneClass = (isAssignee && isApproved)
    ? " dg-quest-approved"
    : (isAssignee && isRejected)
    ? " dg-quest-rejected"
    : (isAssignee && isReported)
    ? " dg-quest-done"
    : "";

  return `
    <div class="dg-quest-card ${lockClass}${selectedClass}${cardDoneClass}" style="border-left-color:${borderColor(task, category)};" data-task-id="${id}" data-can-delete="${canDelete ? "true" : "false"}">
      <div class="dg-col-name dg-quest-card-name-col">
        ${leftControl ? `<div class="dg-quest-card-left">${leftControl}</div>` : ""}
        <div class="dg-quest-title-wrap">
          <h4 class="dg-quest-card-title" title="${escapeHtml(title)}">${title}</h4>
          ${tags ? `<div class="dg-quest-tags-wrap">${tags}</div>` : ""}
        </div>
        ${isRejected && isWorkerAssignee ? `<span class="badge bg-danger bg-opacity-10 text-danger border border-danger ms-1" style="font-size:0.65rem;font-weight:600;vertical-align:middle;padding:0.15rem 0.4rem;border-radius:0.35rem;" title="Catatan Revisi: ${escapeHtml(task.rejectionReason || 'Ditolak')}"><i class="bi bi-exclamation-triangle-fill me-1"></i>Perlu Revisi</span>` : ""}
      </div>
      <div class="dg-col-time">
        ${deadlineHtml || '<span class="dg-quest-col-empty">-</span>'}
      </div>
      <div class="dg-col-prio">
        ${prioHtml || '<span class="dg-quest-col-empty">-</span>'}
      </div>
      <div class="dg-col-points">
        ${pointsHtml || '<span class="dg-quest-col-empty">-</span>'}
      </div>
      <div class="dg-col-assign">
        ${assignGroup || '<span class="dg-quest-col-empty">-</span>'}
      </div>
      <div class="dg-col-report">
        ${reportGroup || '<span class="dg-quest-col-empty">-</span>'}
      </div>
      <div class="dg-col-status">
        ${statusBadge || lockBadge || '<span class="dg-quest-col-empty">-</span>'}
      </div>
      <div class="dg-col-actions dg-quest-card-actions">
        ${rightActions}
      </div>
    </div>
  `;
}

function claimBadge(text, cls) {
  return '<span class="quest-claim-badge ' + cls + '">' + text + "</span>";
}

function avatar(user, type = "assign") {
  const name = user.name || user.email || user.uid || "U";
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase();
  const isReport = type === "report";
  const cls = isReport ? "quest-avatar quest-avatar-report" : "quest-avatar";
  const title = (isReport ? "Report to: " : "Assigned to: ") + name;
  if (user.photo) {
    return '<span class="' + cls + '" title="' + escapeHtml(title) + '"><img src="' + escapeHtml(user.photo) + '" alt="' + escapeHtml(name) + '" /></span>';
  }
  return '<span class="' + cls + '" title="' + escapeHtml(title) + '">' + escapeHtml(initials || "U") + "</span>";
}

/* ------------------------------------------------------------------ */
/* Loading / empty / error states                                      */
/* ------------------------------------------------------------------ */

export function showBoardLoading() {
  ["questOverdueList", "questTodayList", "questUpcomingList", "questSideTodayList", "questSideUpcomingList"].forEach((id) => {
    const node = el(id);
    if (node) node.innerHTML = '<p class="quest-empty">Loading...</p>';
  });
}

export function showBoardError(message) {
  const node = el("questTodayList");
  if (node) node.innerHTML = '<p class="quest-empty" style="color:#dc2626">Gagal memuat quest: ' + escapeHtml(message) + "</p>";
}

/* ------------------------------------------------------------------ */
/* Quest form                                                          */
/* ------------------------------------------------------------------ */

export const DEPARTMENT_POSITIONS_MAP = {
  "happy": [
    "Recruitment Specialist",
    "People Development"
  ],
  "rebuy": [
    "Product Manager",
    "Admin Kelas"
  ],
  "team": [
    "Chief Executive Officer",
    "Department Head",
    "Human Capital Management"
  ],
  "branding": [
    "Content Creator",
    "Branding Team",
    "Design Specialist",
    "Website Development",
    "Content Writer",
    "Video Editor"
  ],
  "closing": [
    "Admin Marketing",
    "Community Management",
    "Marketing Strategy",
    "Sales Department",
    "Digital Advertiser"
  ]
};

export function populatePositionsForDept(deptKey, currentPosId, positionsList = []) {
  const posSelect = el("questPosSelect");
  if (!posSelect) return;
  posSelect.innerHTML = '<option value="">Select Position</option>';

  const cleanKey = String(deptKey || "").trim().toLowerCase();
  if (!cleanKey) return;

  const mapped = DEPARTMENT_POSITIONS_MAP[cleanKey];
  const added = {};

  if (Array.isArray(mapped) && mapped.length > 0) {
    mapped.forEach((pName) => {
      const opt = document.createElement("option");
      opt.value = pName;
      opt.textContent = pName;
      posSelect.appendChild(opt);
      added[pName.toLowerCase()] = true;
    });
  }

  // Only add positions from positionsList IF they explicitly belong to this department
  (positionsList || []).forEach((p) => {
    const pDept = String(p.department || p.department_name || p.departmentId || "").toLowerCase();
    if (pDept === cleanKey) {
      const pName = p.name || p.id;
      if (!added[String(pName).toLowerCase()]) {
        const opt = document.createElement("option");
        opt.value = p.id || pName;
        opt.textContent = pName;
        posSelect.appendChild(opt);
        added[String(pName).toLowerCase()] = true;
      }
    }
  });

  if (currentPosId) {
    posSelect.value = currentPosId;
  }
}

export function openQuestForm(mode, task, refs) {
  const isEdit = mode === "edit";
  el("questFormTitle").textContent = isEdit ? "Edit Quest" : "Add New Quest";
  el("questFormSubmit").textContent = isEdit ? "Save Changes" : "Add to-do";

  // Populate departments
  const defaultDepts = ["happy", "rebuy", "team", "branding", "closing"];
  const seenDepts = {};
  let deptOptions = '<option value="">Select Department</option>';
  defaultDepts.forEach((dKey) => {
    deptOptions += `<option value="${escapeHtml(dKey)}">${escapeHtml(dKey)}</option>`;
    seenDepts[dKey.toLowerCase()] = true;
  });
  (refs.departments || []).forEach((d) => {
    const key = String(d.name || d.id).toLowerCase();
    if (!seenDepts[key]) {
      deptOptions += `<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)}</option>`;
      seenDepts[key] = true;
    }
  });
  el("questDeptSelect").innerHTML = deptOptions;

  const initialDept = isEdit && task && task.deptId ? task.deptId : "";
  el("questDeptSelect").value = initialDept;

  populatePositionsForDept(initialDept, isEdit && task && task.posId ? task.posId : "", refs.positions || []);

  el("questDeptSelect").onchange = (e) => {
    populatePositionsForDept(e.target.value, "", refs.positions || []);
  };
  const validUsers = (refs.users || []).filter(
    (u) => u && u.id && Boolean((u.uid && u.uid !== "unknown") || u.docId || u.email),
  );
  el("questAssignSelect").innerHTML = validUsers
    .map((u) => '<option value="' + escapeHtml(u.id) + '">' + escapeHtml(u.name || u.email || u.id) + "</option>")
    .join("");

  // Fill values when editing
  el("questNameInput").value = isEdit && task ? task.title || "" : "";
  el("questDescEditor").value = isEdit && task ? stripHtml(task.description || "") : "";
  el("questDeptSelect").value = isEdit && task && task.deptId ? task.deptId : "";
  el("questPosSelect").value = isEdit && task && task.posId ? task.posId : "";
  el("questDeadlineTime").value = isEdit && task ? task.deadline_time || "" : "";
  el("questPointSelect").value = isEdit && task && task.points ? String(task.points) : "1";
  el("questPrioritySelect").value = isEdit && task && task.priority ? task.priority : "normal";
  el("questTagsInput").value = isEdit && task && task.tags ? task.tags.join(", ") : "";
  
  const todayYMD = new Date().toISOString().split("T")[0];
  const sideDateEl = el("questSideDueDate");
  if (sideDateEl) {
    sideDateEl.min = todayYMD;
    sideDateEl.value = isEdit && task && task.due_date ? String(task.due_date).slice(0, 10) : "";
  }

  if (isEdit && task && task.assign_to) {
    const assign = Array.isArray(task.assign_to) ? task.assign_to : [task.assign_to];
    Array.from(el("questAssignSelect").options).forEach((opt) => {
      opt.selected = assign.indexOf(opt.value) !== -1;
    });
  } else {
    Array.from(el("questAssignSelect").options).forEach((opt) => (opt.selected = false));
  }

  openModal("questFormModal");
}

export function closeQuestForm() {
  closeModal("questFormModal");
}

export function readQuestForm(tab) {
  const dept = el("questDeptSelect").value;
  const pos = el("questPosSelect").value;
  return {
    title: el("questNameInput").value.trim(),
    description: el("questDescEditor").value.trim(),
    deptId: dept,
    posId: pos,
    deptName: el("questDeptSelect").selectedOptions[0]?.text || "",
    posName: el("questPosSelect").selectedOptions[0]?.text || "",
    assignTo: Array.from(el("questAssignSelect").selectedOptions).map((o) => o.value),
    deadline_time: el("questDeadlineTime").value,
    points: parseInt(el("questPointSelect").value, 10) || 0,
    priority: el("questPrioritySelect").value,
    tags: el("questTagsInput").value.split(",").map((t) => t.trim()).filter(Boolean),
    due_date: tab === "side" ? el("questSideDueDate").value : "",
  };
}

/* ------------------------------------------------------------------ */
/* Quest detail                                                        */
/* ------------------------------------------------------------------ */

export function openQuestDetail(task, ctx) {
  el("questDetailTitle").textContent = task.title || "Untitled Quest";
  const body = el("questDetailBody");

  const deadlineTime = task.deadline_time || "—";
  const priority = String(task.priority || "normal").toLowerCase();
  const points = task.points || 0;
  const rawDesc = String(task.description || "").trim();
  const hasDesc = Boolean(
    rawDesc &&
    rawDesc !== "<p><br></p>" &&
    rawDesc !== "<br>" &&
    (rawDesc.includes("<img") || rawDesc.includes("data:image/") || rawDesc.replace(/<[^>]*>/g, "").trim().length > 0)
  );
  const descHtml = hasDesc
    ? rawDesc
    : '<em style="color:#94a3b8">Tidak ada deskripsi.</em>';
  const deptNames = (task.departments || []).map((d) => d && d.name).filter(Boolean);
  const posNames = (task.positions || []).map((p) => p && p.name).filter(Boolean);
  const tags = task.tags || [];
  const assign = getAssignList(task, ctx);

  const prioColor = priority === "urgent" ? "#dc2626" : priority === "medium" ? "#f59e0b" : "#16a34a";
  const prioLabel = priority === "urgent" ? "High" : priority === "medium" ? "Medium" : "Normal";
  const isAssignee = Boolean(task.isAssignee);
  const isApproved = Boolean(task.isApproved);
  const isRejected = !isApproved && Boolean(task.isRejected);
  const isReported = !isApproved && !isRejected && Boolean(task.isReported || (isAssignee && task.lockState?.done));

  const taskStatusLower = String(task.user_status || "").toLowerCase();
  const isShowRejected = isRejected || taskStatusLower === "rejected" || taskStatusLower.includes("reject");
  const isShowApproved = isApproved || taskStatusLower === "approved" || taskStatusLower.includes("approv");
  const isShowReported = isReported || taskStatusLower === "reported" || taskStatusLower.includes("report");

  const statusText = isShowApproved
    ? "Approved"
    : isShowRejected
    ? "Rejected"
    : isShowReported
    ? "Reported"
    : "To Do";

  const statusColor = isShowApproved
    ? "#16a34a"
    : isShowRejected
    ? "#dc2626"
    : isShowReported
    ? "#0284c7"
    : "#64748b";

  const rejectionReason = (isRejected ? task.rejectionReason : "") || task.rejectionReason || "";
  let rejectionFeedbackHtml = "";
  if (isShowRejected) {
    rejectionFeedbackHtml =
      '<div style="margin-top:0.75rem;border-radius:0.75rem;border:1.5px solid #fecaca;background:#fff5f5;padding:0.75rem 1rem;">' +
      '<div style="display:flex;align-items:center;gap:0.45rem;margin-bottom:0.35rem;">' +
      '<i class="bi bi-exclamation-octagon-fill" style="color:#dc2626;font-size:1rem;"></i>' +
      '<span style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#dc2626;">Komentar Penolakan / Catatan Revisi</span>' +
      "</div>" +
      '<div style="font-size:0.82rem;line-height:1.6;color:#1e293b;word-break:break-word;">' +
      (rejectionReason ? escapeHtml(rejectionReason) : '<em style="color:#64748b">Laporan tugas ini ditolak oleh reviewer dan memerlukan revisi. Silakan perbaiki dan laporkan kembali.</em>') +
      "</div></div>";
  }

  let assignees = "";
  if (assign.length) {
    assignees =
      '<div class="quest-label" style="margin-top:0.75rem">Assigned To</div><div style="display:flex;flex-wrap:wrap;gap:0.4rem">' +
      assign.slice(0, 4).map((uid) => {
        const u = ctx.users && ctx.users[uid] ? ctx.users[uid] : { uid, name: uid };
        const nm = u.name || u.email || uid;
        const init = nm.split(" ").slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
        const inner = u.photo
          ? '<img src="' + escapeHtml(u.photo) + '" style="width:1.25rem;height:1.25rem;border-radius:50%;object-fit:cover" alt="" />'
          : '<span style="width:1.25rem;height:1.25rem;border-radius:50%;background:#dbeafe;color:#2563eb;font-size:0.55rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center">' + escapeHtml(init) + "</span>";
        return '<span style="display:inline-flex;align-items:center;gap:0.4rem;border-radius:999px;border:1px solid #e2e8f0;background:#fff;padding:0.15rem 0.6rem 0.15rem 0.2rem;font-size:0.7rem">' + inner + " " + escapeHtml(nm) + "</span>";
      }).join("") +
      (assign.length > 4 ? '<span class="quest-card-tag">+' + (assign.length - 4) + " lainnya</span>" : "") +
      "</div>";
  }

  let tagsHtml = "";
  if (tags.length) {
    tagsHtml =
      '<div class="quest-label" style="margin-top:0.75rem">Tags</div><div style="display:flex;flex-wrap:wrap;gap:0.4rem">' +
      tags.map((t) => '<span class="quest-card-tag">' + escapeHtml(String(t)) + "</span>").join("") +
      "</div>";
  }

  let recurHtml = "";
  if (task.recur) {
    recurHtml = "<p style='font-size:0.8rem;color:#1d4ed8'>🔁 Quest berulang</p>";
  }

  body.innerHTML =
    '<div style="display:flex;flex-wrap:wrap;gap:0.5rem">' +
    '<span class="quest-card-badge" style="background:' + statusColor + "1a;color:" + statusColor + '"><span style="width:0.4rem;height:0.4rem;border-radius:50%;background:' + statusColor + '"></span>' + escapeHtml(statusText) + "</span>" +
    '<span class="quest-card-badge" style="background:' + prioColor + "1a;color:" + prioColor + '"><i class="bi bi-flag"></i> ' + escapeHtml(prioLabel) + "</span>" +
    (points > 0 ? '<span class="quest-card-points">' + points + " Point</span>" : "") +
    "</div>" +
    rejectionFeedbackHtml +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(8rem,1fr));gap:0.5rem;margin-top:0.75rem">' +
    infoCard("Deadline", escapeHtml(deadlineTime)) +
    infoCard("Department", deptNames.length ? escapeHtml(deptNames.join(", ")) : "<em style='color:#94a3b8'>—</em>") +
    infoCard("Position", posNames.length ? escapeHtml(posNames.join(", ")) : "<em style='color:#94a3b8'>—</em>") +
    "</div>" +
    assignees +
    tagsHtml +
    recurHtml +
    '<div class="quest-label" style="margin-top:0.75rem">Description</div>' +
    '<div style="font-size:0.82rem;line-height:1.6;background:#f8fafc;border:1px solid #f1f5f9;border-radius:0.75rem;padding:0.75rem 1rem">' + descHtml + "</div>" +
    '<div class="quest-label" style="margin-top:0.75rem">Report</div>' +
    '<div id="questReportSection">' + reportSummary(task) + "</div>";

  openModal("questDetailModal");
}

function infoCard(label, value) {
  return '<div style="border-radius:0.75rem;border:1px solid #f1f5f9;background:#f8fafc;padding:0.6rem 0.75rem">' +
    '<div style="font-size:0.6rem;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;font-weight:600;margin-bottom:0.2rem">' + label + "</div>" +
    '<div style="font-size:0.82rem;font-weight:600;color:#334155">' + value + "</div></div>";
}

function reportSummary(task) {
  const by = task.last_reported_by;
  if (by && Array.isArray(by) && by.length) {
    return '<p style="font-size:0.78rem;color:#15803d;margin:0">Reported by ' + escapeHtml(by.join(", ")) + "</p>";
  }
  return '<p style="font-size:0.78rem;color:#94a3b8;margin:0;font-style:italic">Belum ada laporan.</p>';
}

export function closeQuestDetail() {
  closeModal("questDetailModal");
}

/* ------------------------------------------------------------------ */
/* Daily report modal                                                  */
/* ------------------------------------------------------------------ */

export function openDailyReportModal(checkedTasks, userName, userUid) {
  const now = new Date();
  el("reportDateInput").value = now.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  el("reportNameInput").value = userName || "Intern";

  // Departments from checked tasks
  const deptSet = {};
  checkedTasks.forEach((t) => {
    (t.departments || []).forEach((d) => {
      if (d && d.name) deptSet[d.name] = true;
    });
  });
  el("reportDeptInput").value = Object.keys(deptSet).length ? Object.keys(deptSet).join(", ") : "—";

  const container = el("reportTasksContainer");
  // Clean up any existing instances first
  Object.values(reportEditorInstances).forEach((inst) => {
    try {
      if (inst && typeof inst.destroy === "function") inst.destroy();
    } catch (_) {}
  });
  reportEditorInstances = {};

  if (!checkedTasks.length) {
    container.innerHTML =
      '<p class="text-muted small mb-0">Belum ada item yang dicentang. Silakan centang to-do Anda terlebih dahulu di board.</p>';
  } else {
    container.innerHTML = checkedTasks
      .map((t, i) => {
        return (
          '<div class="quest-report-item" data-task-id="' + t.id + '">' +
          '<div style="flex:1;min-width:0;width:100%;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;margin-bottom:0.5rem;">' +
          '<span class="quest-report-item-title">' + (i + 1) + ". " + escapeHtml(t.title || "Untitled") + "</span>" +
          '<span class="quest-report-item-points">' + (t.points || 0) + " Point</span>" +
          "</div>" +
          '<div class="quest-report-editor-wrap" data-editor-task-id="' + t.id + '"></div>' +
          "</div>" +
          "</div>"
        );
      })
      .join("");

    checkedTasks.forEach((t) => {
      const editorWrap = container.querySelector(
        '.quest-report-editor-wrap[data-editor-task-id="' + t.id + '"]',
      );
      if (editorWrap) {
        const editor = createRichEditor(editorWrap, {
          placeholder: "Catatan / bukti pengerjaan (opsional)...",
          showFooter: true,
        });
        if (editor) {
          reportEditorInstances[t.id] = editor;
        }
      }
    });
  }

  openModal("dailyReportModal");
}

export function closeDailyReportModal() {
  closeModal("dailyReportModal");
}

export function setReportSubmitBusy(busy, label) {
  setButtonBusy(el("submitReportBtn"), busy, label || "Menyimpan...");
}

export function collectReportDetails() {
  const details = {};
  el("reportTasksContainer")?.querySelectorAll(".quest-report-item").forEach((item) => {
    const id = item.getAttribute("data-task-id");
    if (!id) return;
    if (reportEditorInstances[id]) {
      const html = reportEditorInstances[id].getHTML();
      details[id] = html ? html.trim() : "";
    } else {
      const input = item.querySelector("[data-detail-for]");
      if (input) details[id] = input.value.trim();
    }
  });
  return details;
}

export function collectCheckedIds() {
  const ids = [];
  el("reportTasksContainer").querySelectorAll(".quest-report-item").forEach((item) => {
    ids.push(item.getAttribute("data-task-id"));
  });
  return ids;
}

/* ------------------------------------------------------------------ */
/* Notifications / confirmations                                       */
/* ------------------------------------------------------------------ */

export function notifySuccess(message) {
  toast(message, "success");
}

export function notifyError(message) {
  toast(message, "error");
}

export async function confirmAction(message, danger = false) {
  return confirmDialog(message, { danger });
}

export function updateBulkActionBar(selectedCount, totalDeletableCount) {
  const bulkBar = el("questBulkBar");
  if (!bulkBar) return;

  if (selectedCount > 0) {
    bulkBar.classList.remove("d-none");
    const countText = el("questBulkCountText");
    if (countText) countText.textContent = `${selectedCount} task dipilih`;
    const deleteCount = el("questBulkDeleteCount");
    if (deleteCount) deleteCount.textContent = selectedCount;

    const selectAllBtnText = el("questSelectAllBtnText");
    if (selectAllBtnText) {
      if (totalDeletableCount > 0 && selectedCount >= totalDeletableCount) {
        selectAllBtnText.textContent = "Batal Pilih Semua";
      } else {
        selectAllBtnText.textContent = "Pilih Semua";
      }
    }
  } else {
    bulkBar.classList.add("d-none");
  }
}

export function syncCardSelections(selectedSet) {
  document.querySelectorAll(".quest-card").forEach((cardNode) => {
    const taskId = cardNode.getAttribute("data-task-id");
    const checkbox = cardNode.querySelector(".dg-quest-select-checkbox");
    const isSelected = Boolean(taskId && selectedSet.has(taskId));

    cardNode.classList.toggle("is-selected", isSelected);
    if (checkbox) {
      checkbox.checked = isSelected;
    }
  });
}

export function setBulkDeleteButtonBusy(busy) {
  const btn = el("questBulkDeleteBtn");
  if (btn) {
    btn.disabled = busy;
    if (busy) {
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Menghapus...';
    } else {
      const deleteCount = el("questBulkDeleteCount");
      const count = deleteCount ? deleteCount.textContent : "0";
      btn.innerHTML = `<i class="bi bi-trash3-fill"></i> Hapus Terpilih (<span id="questBulkDeleteCount">${count}</span>)`;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Helper                                                              */
/* ------------------------------------------------------------------ */

function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  return (tmp.textContent || tmp.innerText || "").trim();
}

// Re-export for orchestrator convenience
export { getMs, formatDateID };