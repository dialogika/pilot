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
import { toast, setButtonBusy } from "../../assets/js/ui.js";

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
        : sections.overdue.map((t) => card(t, "overdue", ctx)).join("");
    el(p + "OverdueButton")?.classList.toggle("d-none", sections.overdue.length === 0);
  }
  if (todayList) {
    todayList.innerHTML =
      sections.today.length === 0
        ? emptyState("No quests for today.")
        : sections.today.map((t) => card(t, "today", ctx)).join("");
  }
  if (upcomingList) {
    upcomingList.innerHTML =
      sections.upcoming.length === 0
        ? emptyState("No upcoming quests.")
        : sections.upcoming.map((t) => card(t, "upcoming", ctx)).join("");
  }
}

/* ------------------------------------------------------------------ */
/* Task card                                                           */
/* ------------------------------------------------------------------ */

function emptyState(text) {
  return '<p class="quest-empty">' + escapeHtml(text) + "</p>";
}

function getAssignList(task) {
  if (!task.assign_to) return [];
  return Array.isArray(task.assign_to) ? task.assign_to.slice() : [task.assign_to];
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
  const assign = getAssignList(task);

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
  const max = 4;
  assign.slice(0, max).forEach((uid) => {
    const user = ctx.users && ctx.users[uid] ? ctx.users[uid] : { uid, name: uid };
    avatars += avatar(user);
  });
  if (assign.length > max) {
    avatars += '<span class="quest-avatar-more">+' + (assign.length - max) + "</span>";
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

  let actions = "";
  if (category !== "upcoming") {
    actions +=
      '<button type="button" class="quest-check-btn" data-check="' + id + '"' + (locked || done ? " disabled" : "") + '><i class="bi bi-check"></i></button>';
  }
  actions +=
    '<button type="button" class="quest-card-link-btn" data-detail="' + id + '"><i class="bi bi-eye"></i> Detail</button>';
  if (task.isOwner) {
    actions +=
      '<button type="button" class="quest-card-link-btn quest-warn" data-edit="' + id + '"><i class="bi bi-pencil"></i> Edit</button>';
    actions +=
      '<button type="button" class="quest-card-link-btn quest-danger" data-delete="' + id + '"><i class="bi bi-trash"></i> Delete</button>';
  }

  return (
    '<div class="quest-card ' + lockClass + '" style="border-left-color:' + borderColor(task, category) + ';" data-task-id="' + id + '">' +
    '<div class="quest-card-main">' +
    '<div class="quest-card-title-row"><h3 class="quest-card-title">' + title + "</h3>" + prioHtml + lockBadge + "</div>" +
    deadlineHtml +
    '<p class="quest-card-desc">' + desc + "</p>" +
    '<div class="quest-card-meta">' +
    (avatars ? '<div class="quest-card-avatars">' + avatars + "</div>" : "") +
    tags +
    pointsHtml +
    "</div>" +
    "</div>" +
    '<div class="quest-card-actions">' + actions + "</div>" +
    "</div>"
  );
}

function claimBadge(text, cls) {
  return '<span class="quest-claim-badge ' + cls + '">' + text + "</span>";
}

function avatar(user) {
  const name = user.name || user.email || user.uid || "U";
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase();
  if (user.photo) {
    return '<span class="quest-avatar"><img src="' + escapeHtml(user.photo) + '" alt="' + escapeHtml(name) + '" title="' + escapeHtml(name) + '" /></span>';
  }
  return '<span class="quest-avatar" title="' + escapeHtml(name) + '">' + escapeHtml(initials || "U") + "</span>";
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
  el("questAssignSelect").innerHTML = (refs.users || [])
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
  el("questSideDueDate").value = isEdit && task && task.due_date ? String(task.due_date).slice(0, 10) : "";

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
  const descHtml = task.description && String(task.description).replace(/<[^>]*>/g, "").trim().length > 0
    ? task.description
    : '<em style="color:#94a3b8">No description</em>';
  const deptNames = (task.departments || []).map((d) => d && d.name).filter(Boolean);
  const posNames = (task.positions || []).map((p) => p && p.name).filter(Boolean);
  const tags = task.tags || [];
  const assign = getAssignList(task);

  const prioColor = priority === "urgent" ? "#dc2626" : priority === "medium" ? "#f59e0b" : "#16a34a";
  const prioLabel = priority === "urgent" ? "High" : priority === "medium" ? "Medium" : "Normal";
  const statusText = task.status || "Initiate";
  const statusColor = /reported|done|complete/i.test(statusText) ? "#16a34a" : /overdue|late/i.test(statusText) ? "#dc2626" : "#64748b";

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
  if (!checkedTasks.length) {
    container.innerHTML = '<p class="quest-empty">Belum ada quest yang dicentang. Centang quest terlebih dahulu di board.</p>';
  } else {
    container.innerHTML = checkedTasks
      .map((t, i) => {
        return (
          '<div class="quest-report-item" data-task-id="' + t.id + '">' +
          '<div style="flex:1;min-width:0">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem">' +
          '<span class="quest-report-item-title">' + (i + 1) + ". " + escapeHtml(t.title || "Untitled") + "</span>" +
          '<span class="quest-report-item-points">' + (t.points || 0) + " Point</span>" +
          "</div>" +
          '<textarea rows="2" class="quest-report-item-detail" data-detail-for="' + t.id + '" placeholder="Detail pekerjaan (opsional)..."></textarea>' +
          "</div>" +
          "</div>"
        );
      })
      .join("");
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
  el("reportTasksContainer").querySelectorAll(".quest-report-item").forEach((item) => {
    const id = item.getAttribute("data-task-id");
    const input = item.querySelector("[data-detail-for]");
    if (id && input) details[id] = input.value.trim();
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

export function closeById(target) {
  if (target === "questDetailModal") closeModal("questDetailModal");
  else if (target === "questFormModal") closeModal("questFormModal");
  else if (target === "dailyReportModal") closeModal("dailyReportModal");
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