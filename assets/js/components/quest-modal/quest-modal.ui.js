// assets/js/components/quest-modal/quest-modal.ui.js
// =====================================================================
// QUEST MODAL UI — Pure rendering, DOM manipulation, event handling,
// loading/empty/error states, sub-modal interactions for Daily & Quest.
//
// RULES:
//  - NO Firestore queries here (use quest-modal.repository.js).
//  - Pure view logic; receives plain data, renders into DOM.
// =====================================================================

import { escapeHtml, formatDateID } from "../../utils.js";
import { toast, setButtonBusy } from "../../ui.js";

function el(id) {
  return document.getElementById(id);
}

/**
 * Ensure the Quest Modal DOM structure exists in the page body.
 */
export function ensureQuestModalDOM() {
  if (el("dgQuestModalOverlay")) return;

  // Dynamically ensure the stylesheet is loaded
  if (!document.querySelector('link[href*="quest-modal.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/assets/js/components/quest-modal/quest-modal.css";
    document.head.appendChild(link);
  }

  const container = document.createElement("div");
  container.id = "dgQuestModalMount";
  container.innerHTML = `
    <!-- Main Quest Modal Overlay -->
    <div id="dgQuestModalOverlay" class="dg-quest-modal-overlay">
      <div class="dg-quest-modal-dialog">
        <!-- Header -->
        <div class="dg-quest-modal-header">
          <div class="dg-quest-modal-title-area">
            <div class="dg-quest-modal-icon-badge">
              <i class="bi bi-bullseye" id="dgQuestModalHeaderIcon"></i>
            </div>
            <div class="dg-quest-modal-title-text">
              <h2 id="dgQuestModalTitle">Daily &amp; Quest</h2>
              <p id="dgQuestModalSubtitle">Fokus, ringkas, dan pantau aktivitas harian Anda</p>
            </div>
          </div>
          <div class="dg-quest-modal-actions">
            <button type="button" id="dgQuestOverdueBtn" class="dg-quest-btn-icon text-danger d-none" title="Overdue">
              <i class="bi bi-clock-history"></i>
            </button>
            <button type="button" id="dgQuestAddBtn" class="dg-quest-btn-icon dg-quest-btn-add" title="Tambah Baru">
              <i class="bi bi-plus-lg"></i>
            </button>
            <button type="button" id="dgQuestModalCloseBtn" class="dg-quest-btn-close" title="Tutup">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        <!-- Tabs Bar -->
        <div class="dg-quest-tabs-bar">
          <button type="button" class="dg-quest-tab-btn active" id="dgQuestTabDaily" data-tab="daily">
            <i class="bi bi-bullseye"></i> Daily
          </button>
          <button type="button" class="dg-quest-tab-btn" id="dgQuestTabQuest" data-tab="quest">
            <i class="bi bi-stars"></i> Quest
          </button>
        </div>

        <!-- Body with Panels -->
        <div class="dg-quest-modal-body">
          <!-- DAILY PANEL -->
          <div id="dgDailyPanel">
            <section class="dg-quest-section" id="dgDailyOverdueSection">
              <div class="dg-quest-section-head">
                <div>
                  <h3 class="dg-quest-section-title text-danger">Overdue</h3>
                  <p class="dg-quest-section-sub">Daily yang melewati deadline.</p>
                </div>
              </div>
              <div id="dgDailyOverdueList" class="dg-quest-card-list"></div>
            </section>

            <section class="dg-quest-section">
              <div class="dg-quest-section-head">
                <div>
                  <h3 class="dg-quest-section-title">Today</h3>
                  <p class="dg-quest-section-sub">Daily yang dikerjakan untuk hari ini.</p>
                </div>
                <button type="button" id="dgDailySubmitReportBtn" class="dg-quest-btn-submit-report">
                  <i class="bi bi-file-earmark-text"></i> Submit Report
                </button>
              </div>
              <div id="dgDailyTodayList" class="dg-quest-card-list"></div>
            </section>

            <section class="dg-quest-section">
              <div class="dg-quest-section-head">
                <div>
                  <h3 class="dg-quest-section-title">Upcoming</h3>
                  <p class="dg-quest-section-sub">Maksimal 2 daily berikutnya.</p>
                </div>
              </div>
              <div id="dgDailyUpcomingList" class="dg-quest-card-list"></div>
            </section>
          </div>

          <!-- QUEST PANEL -->
          <div id="dgQuestPanel" class="d-none">
            <section class="dg-quest-section" id="dgQuestOverdueSection">
              <div class="dg-quest-section-head">
                <div>
                  <h3 class="dg-quest-section-title text-danger">Overdue</h3>
                  <p class="dg-quest-section-sub">Quest yang melewati deadline.</p>
                </div>
              </div>
              <div id="dgQuestOverdueList" class="dg-quest-card-list"></div>
            </section>

            <section class="dg-quest-section">
              <div class="dg-quest-section-head">
                <div>
                  <h3 class="dg-quest-section-title">Today</h3>
                  <p class="dg-quest-section-sub">Quest yang dikerjakan untuk hari ini.</p>
                </div>
                <button type="button" id="dgQuestSubmitReportBtn" class="dg-quest-btn-submit-report">
                  <i class="bi bi-file-earmark-text"></i> Submit Report
                </button>
              </div>
              <div id="dgQuestTodayList" class="dg-quest-card-list"></div>
            </section>

            <section class="dg-quest-section">
              <div class="dg-quest-section-head">
                <div>
                  <h3 class="dg-quest-section-title">Upcoming</h3>
                  <p class="dg-quest-section-sub">Maksimal 2 quest berikutnya.</p>
                </div>
              </div>
              <div id="dgQuestUpcomingList" class="dg-quest-card-list"></div>
            </section>
          </div>
        </div>
      </div>
    </div>

    <!-- Task Detail Sub-Modal -->
    <div id="dgQuestDetailModal" class="dg-quest-submodal" hidden>
      <div class="dg-quest-submodal-dialog">
        <div class="dg-quest-submodal-head">
          <h3 id="dgQuestDetailTitle" class="dg-quest-submodal-title">Detail</h3>
          <button type="button" class="dg-quest-btn-close" data-close="dgQuestDetailModal"><i class="bi bi-x-lg"></i></button>
        </div>
        <div id="dgQuestDetailBody" class="dg-quest-submodal-body"></div>
      </div>
    </div>

    <!-- Task Create / Edit Sub-Modal -->
    <div id="dgQuestFormModal" class="dg-quest-submodal" hidden>
      <div class="dg-quest-submodal-dialog dg-quest-form-dialog">
        <div class="dg-quest-submodal-head">
          <div class="dg-quest-form-head">
            <span class="dg-quest-form-head-icon"><i class="bi bi-bullseye"></i></span>
            <div class="dg-quest-form-head-text">
              <h3 id="dgQuestFormTitle" class="dg-quest-submodal-title">Add New Quest</h3>
              <p id="dgQuestFormSubtitle">Lengkapi detail quest di bawah ini</p>
            </div>
          </div>
          <button type="button" class="dg-quest-btn-close" data-close="dgQuestFormModal"><i class="bi bi-x-lg"></i></button>
        </div>
        <form id="dgQuestForm" class="dg-quest-submodal-body">
          <input type="hidden" id="dgQuestFormId" />

          <!-- Step 1: Title -->
          <div id="dgQuestStep1" class="dg-quest-step">
            <label class="form-label small fw-bold mb-1">Quest Title</label>
            <input type="text" id="dgQuestNameInput" class="form-control form-control-sm" placeholder="What needs to be done?" />
          </div>

          <!-- Description -->
          <div id="dgQuestDescStep" class="dg-quest-step dg-quest-step-locked">
            <label class="form-label small fw-bold mb-1">Description</label>
            <textarea id="dgQuestDescEditor" class="form-control form-control-sm" rows="2" placeholder="Add a description for this quest..."></textarea>
          </div>

          <!-- Step 2: Department + Position -->
          <div id="dgQuestStep2" class="dg-quest-step dg-quest-step-locked row g-2">
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">Department</label>
              <select id="dgQuestDeptSelect" class="form-select form-select-sm" disabled>
                <option value="">Select Department</option>
              </select>
            </div>
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">Position</label>
              <select id="dgQuestPosSelect" class="form-select form-select-sm" disabled>
                <option value="">Select Position</option>
              </select>
            </div>
          </div>

          <!-- Step 3: Assign To -->
          <div id="dgQuestStep3" class="dg-quest-step dg-quest-step-locked">
            <label class="form-label small fw-bold mb-1">Assign To</label>
            <div class="dg-quest-tag-selector">
              <div class="dg-quest-tag-selector-control" id="dgQuestAssignControl" role="button">
                <div class="dg-quest-tag-selected-list">
                  <span id="dgQuestAssignButtonLabel" class="dg-quest-placeholder">Select users...</span>
                </div>
                <i class="bi bi-chevron-down dg-quest-caret"></i>
              </div>
              <div id="dgQuestAssignDropdown" class="dg-quest-assign-dropdown" style="display:none;">
                <input type="text" id="dgQuestAssignSearch" class="dg-quest-assign-search" placeholder="Search user..." />
                <div id="dgQuestAssignList" class="dg-quest-assign-list"></div>
              </div>
            </div>
          </div>

          <!-- Step 4: Deadline / Points / Urgency -->
          <div id="dgQuestStep4" class="dg-quest-step dg-quest-step-locked row g-2">
            <div class="col-md-4">
              <label class="form-label small fw-bold mb-1">Deadline Time</label>
              <input type="time" id="dgQuestDeadlineTime" class="form-control form-control-sm" />
            </div>
            <div class="col-md-4">
              <label class="form-label small fw-bold mb-1">Task Point</label>
              <select id="dgQuestPointSelect" class="form-select form-select-sm">
                <option value="">Select point...</option>
                <option value="1">1 - Easy</option>
                <option value="2">2 - Medium</option>
                <option value="3">3 - Hard</option>
              </select>
            </div>
            <div class="col-md-4">
              <label class="form-label small fw-bold mb-1">Urgent</label>
              <select id="dgQuestUrgencySelect" class="form-select form-select-sm">
                <option value="">Select urgency...</option>
                <option value="urgent">High</option>
                <option value="medium">Medium</option>
                <option value="normal">Normal</option>
              </select>
            </div>
          </div>

          <!-- Due Date (side quest only) -->
          <div id="dgQuestSideDueRow" class="dg-quest-step" style="display:none;">
            <label class="form-label small fw-bold mb-1">Due Date</label>
            <input type="date" id="dgQuestSideDueDate" class="form-control form-control-sm" />
          </div>

          <!-- Step 5: Recurring -->
          <div id="dgQuestStep5" class="dg-quest-step dg-quest-step-locked">
            <label class="form-label small fw-bold mb-1">Recurring</label>
            <div class="dg-quest-recur-card">
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <span class="small fw-bold text-secondary">Repeat every</span>
                <input type="number" id="dgQuestRecurIntervalInput" min="1" max="7" value="1" class="form-control form-control-sm" style="width:64px;" />
                <select id="dgQuestRecurUnitSelect" class="form-select form-select-sm" style="width:auto;">
                  <option value="week" selected>Week</option>
                  <option value="month">Month</option>
                </select>
                <button type="button" id="dgQuestRecurEverydayBtn" class="btn btn-sm btn-outline-secondary">Everyday</button>
              </div>
              <div id="dgQuestRecurWeeklyContainer" class="mt-2">
                <label class="form-label small fw-bold mb-1">Repeat on</label>
                <div class="d-flex gap-1 flex-wrap">
                  <button type="button" class="btn btn-sm dg-quest-recur-day" data-day="0">Su</button>
                  <button type="button" class="btn btn-sm dg-quest-recur-day" data-day="1">Mo</button>
                  <button type="button" class="btn btn-sm dg-quest-recur-day" data-day="2">Tu</button>
                  <button type="button" class="btn btn-sm dg-quest-recur-day" data-day="3">We</button>
                  <button type="button" class="btn btn-sm dg-quest-recur-day" data-day="4">Th</button>
                  <button type="button" class="btn btn-sm dg-quest-recur-day" data-day="5">Fr</button>
                  <button type="button" class="btn btn-sm dg-quest-recur-day" data-day="6">Sa</button>
                </div>
              </div>
              <div id="dgQuestRecurMonthlyContainer" class="mt-2" style="display:none;">
                <label class="form-label small fw-bold mb-1">Repeat on date</label>
                <div class="d-flex gap-1 flex-wrap" id="dgQuestRecurMonthlyDatesList"></div>
              </div>
            </div>
          </div>
        </form>
        <div class="dg-quest-submodal-foot">
          <button type="button" class="btn btn-sm btn-secondary" data-close="dgQuestFormModal">Cancel</button>
          <button type="submit" form="dgQuestForm" id="dgQuestFormSubmit" class="btn btn-sm btn-primary px-3">Create Quest</button>
        </div>
      </div>
    </div>

    <!-- Daily Report Sub-Modal -->
    <div id="dgDailyReportModal" class="dg-quest-submodal" hidden>
      <div class="dg-quest-submodal-dialog">
        <div class="dg-quest-submodal-head">
          <h3 class="dg-quest-submodal-title"><i class="bi bi-file-earmark-text text-success me-1"></i> Submit Daily Report</h3>
          <button type="button" class="dg-quest-btn-close" data-close="dgDailyReportModal"><i class="bi bi-x-lg"></i></button>
        </div>
        <div class="dg-quest-submodal-body">
          <div class="row g-2 mb-3">
            <div class="col-6">
              <label class="form-label small fw-bold mb-1">Tanggal</label>
              <input type="text" id="dgReportDateInput" class="form-control form-control-sm bg-light" readonly />
            </div>
            <div class="col-6">
              <label class="form-label small fw-bold mb-1">Nama</label>
              <input type="text" id="dgReportNameInput" class="form-control form-control-sm bg-light" readonly />
            </div>
          </div>
          <div class="mb-3">
            <label class="form-label small fw-bold mb-1">Department</label>
            <input type="text" id="dgReportDeptInput" class="form-control form-control-sm bg-light" readonly />
          </div>
          <label class="form-label small fw-bold mb-2">Pekerjaan yang Dilaporkan:</label>
          <div id="dgReportTasksContainer" class="d-flex flex-column gap-2"></div>
        </div>
        <div class="dg-quest-submodal-foot">
          <button type="button" class="btn btn-sm btn-secondary" data-close="dgDailyReportModal">Batal</button>
          <button type="button" id="dgSubmitReportBtn" class="btn btn-sm btn-success px-4">Kirim Laporan</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);
}

/* ------------------------------------------------------------------ */
/* Modal Open / Close                                                  */
/* ------------------------------------------------------------------ */

export function showModalOverlay() {
  ensureQuestModalDOM();
  const overlay = el("dgQuestModalOverlay");
  if (overlay) {
    overlay.classList.add("show");
    document.body.style.overflow = "hidden";
  }
}

export function hideModalOverlay() {
  const overlay = el("dgQuestModalOverlay");
  if (overlay) {
    overlay.classList.remove("show");
    document.body.style.overflow = "";
  }
}

function openSubModal(id) {
  const node = el(id);
  if (node) node.hidden = false;
}

function closeSubModal(id) {
  const node = el(id);
  if (node) node.hidden = true;
}

/* ------------------------------------------------------------------ */
/* Tab Switching                                                       */
/* ------------------------------------------------------------------ */

export function setActiveTab(tab) {
  const isDaily = tab === "daily";
  el("dgDailyPanel")?.classList.toggle("d-none", !isDaily);
  el("dgQuestPanel")?.classList.toggle("d-none", isDaily);

  el("dgQuestTabDaily")?.classList.toggle("active", isDaily);
  el("dgQuestTabQuest")?.classList.toggle("active", !isDaily);

  if (el("dgQuestModalHeaderIcon")) {
    el("dgQuestModalHeaderIcon").className = isDaily ? "bi bi-bullseye" : "bi bi-stars";
  }
  if (el("dgQuestModalTitle")) {
    el("dgQuestModalTitle").textContent = isDaily ? "Daily" : "Quest";
  }
}

/* ------------------------------------------------------------------ */
/* Render Board Sections                                               */
/* ------------------------------------------------------------------ */

export function renderBoard(tab, sections, ctx) {
  const isDaily = tab === "daily";
  const prefix = isDaily ? "dgDaily" : "dgQuest";

  const overdueList = el(prefix + "OverdueList");
  const todayList = el(prefix + "TodayList");
  const upcomingList = el(prefix + "UpcomingList");
  const overdueSection = el(prefix + "OverdueSection");

  if (overdueList) {
    overdueList.innerHTML =
      sections.overdue.length === 0
        ? emptyState(`Tidak ada ${isDaily ? "daily" : "quest"} overdue.`)
        : sections.overdue.map((t) => card(t, "overdue", ctx, tab)).join("");
    if (overdueSection) {
      overdueSection.style.display = sections.overdue.length === 0 ? "none" : "block";
    }
  }

  if (todayList) {
    todayList.innerHTML =
      sections.today.length === 0
        ? emptyState(`Tidak ada ${isDaily ? "daily" : "quest"} untuk hari ini.`)
        : sections.today.map((t) => card(t, "today", ctx, tab)).join("");
  }

  if (upcomingList) {
    upcomingList.innerHTML =
      sections.upcoming.length === 0
        ? emptyState(`Tidak ada ${isDaily ? "daily" : "quest"} berikutnya.`)
        : sections.upcoming.map((t) => card(t, "upcoming", ctx, tab)).join("");
  }
}

function emptyState(text) {
  return `<p class="dg-quest-empty-msg">${escapeHtml(text)}</p>`;
}

function priorityStyle(priority) {
  const p = String(priority || "").toLowerCase();
  if (p === "urgent" || p === "high") return { label: "High", color: "#dc2626" };
  if (p === "medium") return { label: "Medium", color: "#f59e0b" };
  if (p === "normal") return { label: "Normal", color: "#16a34a" };
  return null;
}

function borderColor(task, category) {
  const p = String(task.priority || "").toLowerCase();
  if (category === "overdue" || task.questDeadlinePassed) return "#dc2626";
  if (p === "urgent" || p === "high") return "#f97316";
  if (p === "medium") return "#f59e0b";
  return "#3b82f6";
}

function deadlineBg(category) {
  if (category === "overdue") return "#dc2626";
  if (category === "upcoming") return "#16a34a";
  return "#2563eb";
}

function getAssignList(task) {
  if (!task.assign_to) return [];
  return Array.isArray(task.assign_to) ? task.assign_to.slice() : [task.assign_to];
}

function card(task, category, ctx, tab) {
  const id = task.id;
  const title = escapeHtml(task.title || (tab === "daily" ? "Untitled Daily" : "Untitled Quest"));
  const desc = escapeHtml(task.descText || "Tidak ada deskripsi.");
  const dueText = escapeHtml(task.deadline_time || "");
  const priority = priorityStyle(task.priority);
  const assign = getAssignList(task);

  const lockState = task.lockState || { claimed: false, done: false };
  const locked = lockState.claimed;
  const done = lockState.done || /reported|done|complete/i.test(task.status);
  const doneClass = done ? "dg-quest-done" : "";

  let avatars = "";
  const max = 4;
  assign.slice(0, max).forEach((uid) => {
    const user = ctx.users && ctx.users[uid] ? ctx.users[uid] : { uid, name: uid };
    avatars += renderAvatar(user);
  });
  if (assign.length > max) {
    avatars += `<span class="dg-quest-avatar">+${assign.length - max}</span>`;
  }

  let tags = "";
  (task.tags || []).forEach((t) => {
    if (t) tags += `<span class="dg-quest-tag">${escapeHtml(String(t))}</span>`;
  });

  const pointsHtml = task.points > 0 ? `<span class="dg-quest-points">${task.points} Pt</span>` : "";
  const prioHtml = priority
    ? `<span class="dg-quest-badge" style="background:${priority.color}20;color:${priority.color};">${escapeHtml(priority.label)}</span>`
    : "";
  const recurHtml = task.recur ? " <i class='bi bi-arrow-repeat'></i>" : "";
  const deadlineHtml = dueText
    ? `<span class="dg-quest-deadline" style="background:${deadlineBg(category)};"><i class="bi bi-clock"></i> ${escapeHtml(dueText)}${recurHtml}</span>`
    : "";

  let actions = "";
  if (category !== "upcoming") {
    const isChecked = task.isChecked ? " checked" : "";
    actions += `<button type="button" class="dg-quest-check-btn${isChecked}" data-check="${id}" title="Centang untuk laporan" ${done ? "disabled" : ""}><i class="bi bi-check-lg"></i></button>`;
  }

  actions += `<button type="button" class="dg-quest-link-btn" data-detail="${id}"><i class="bi bi-eye"></i> Detail</button>`;

  if (task.isOwner || ctx.currentRole === "super-admin" || ctx.currentRole === "admin") {
    actions += `<button type="button" class="dg-quest-link-btn dg-warn" data-edit="${id}"><i class="bi bi-pencil"></i> Edit</button>`;
    actions += `<button type="button" class="dg-quest-link-btn dg-danger" data-delete="${id}"><i class="bi bi-trash"></i> Hapus</button>`;
  }

  return `
    <div class="dg-quest-card ${doneClass}" style="border-left-color:${borderColor(task, category)};" data-task-id="${id}">
      <div class="dg-quest-card-main">
        <div class="dg-quest-card-title-row">
          <h4 class="dg-quest-card-title">${title}</h4>
          ${prioHtml}
          ${done ? '<span class="dg-quest-badge" style="background:#dcfce7;color:#15803d;">✓ Reported</span>' : ""}
        </div>
        ${deadlineHtml}
        <p class="dg-quest-card-desc">${desc}</p>
        <div class="dg-quest-card-meta">
          ${avatars ? `<div class="dg-quest-avatars">${avatars}</div>` : ""}
          ${tags}
          ${pointsHtml}
        </div>
      </div>
      <div class="dg-quest-card-actions">
        ${actions}
      </div>
    </div>
  `;
}

function renderAvatar(user) {
  const name = user.name || user.email || user.uid || "U";
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase();
  if (user.photo) {
    return `<span class="dg-quest-avatar"><img src="${escapeHtml(user.photo)}" alt="${escapeHtml(name)}" title="${escapeHtml(name)}" /></span>`;
  }
  return `<span class="dg-quest-avatar" title="${escapeHtml(name)}">${escapeHtml(initials || "U")}</span>`;
}

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
  const posSelect = el("dgQuestPosSelect");
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

/* ------------------------------------------------------------------ */
/* Form Sub-Modal                                                      */
/* ------------------------------------------------------------------ */

let formRecurState = { unit: "week", interval: 1, weekdays: [], monthlyDates: [] };
let formAssignPool = [];
let formEditOpen = false;

function getFilteredAssignPool() {
  const deptSelect = el("dgQuestDeptSelect");
  const posSelect = el("dgQuestPosSelect");
  const deptVal = deptSelect ? String(deptSelect.value || "").trim().toLowerCase() : "";
  const deptText = deptSelect && deptSelect.selectedOptions[0]
    ? deptSelect.selectedOptions[0].text.trim().toLowerCase()
    : "";
  const posVal = posSelect ? String(posSelect.value || "").trim().toLowerCase() : "";
  const posText = posSelect && posSelect.selectedOptions[0]
    ? posSelect.selectedOptions[0].text.trim().toLowerCase()
    : "";

  // Map position id -> name (and name -> name) so users whose stored position
  // is an id (e.g. "gtebWhJ7db4xxHQxI67t") still match the selected position.
  const posNameById = {};
  const posNames = new Set();
  (positionsRef || []).forEach((p) => {
    const pName = String(p.name || p.id || "").trim().toLowerCase();
    if (pName) {
      posNames.add(pName);
      if (p.id) posNameById[String(p.id).trim().toLowerCase()] = pName;
    }
  });

  let pool = formAssignPool;
  if (deptVal) {
    pool = pool.filter((u) => {
      const ud = String(u.department || "").trim().toLowerCase();
      return ud === deptVal || (deptText && ud === deptText);
    });
  }
  if (posVal) {
    const posMatched = pool.filter((u) => {
      const raw = String(u.position || "").trim().toLowerCase();
      // Resolve the user's stored position to a canonical name if possible.
      const upName = posNameById[raw] || raw;
      return (
        raw === posVal ||
        upName === posText ||
        (posText && upName === posText)
      );
    });
    // Only enforce the position filter when it actually matches someone;
    // otherwise fall back to the department-filtered pool (positions may be
    // stored by id or by name depending on the source).
    if (posMatched.length > 0) pool = posMatched;
  }
  return pool;
}

function wireFormEvents() {
  if (el("dgQuestFormModal") && el("dgQuestFormModal").dataset.wired) return;
  const modal = el("dgQuestFormModal");
  if (!modal) return;
  modal.dataset.wired = "1";

  // Step 1: title gates everything below it
  el("dgQuestNameInput").addEventListener("input", syncQuestStepGating);

  // Step 2: department -> position cascade
  el("dgQuestDeptSelect").addEventListener("change", (e) => {
    populatePositionsForDept(e.target.value, "", positionsRef);
    renderAssignList(getAssignRenderPool());
    updateAssignLabel();
    syncQuestStepGating();
  });
  el("dgQuestPosSelect").addEventListener("change", (e) => {
    renderAssignList(getAssignRenderPool());
    updateAssignLabel();
    syncQuestStepGating();
  });

  // Step 3: assign dropdown
  el("dgQuestAssignControl").addEventListener("click", (e) => {
    e.stopPropagation();
    const dd = el("dgQuestAssignDropdown");
    if (!dd) return;
    const open = dd.style.display === "block";
    dd.style.display = open ? "none" : "block";
    if (!open) {
      const search = el("dgQuestAssignSearch");
      if (search) {
        search.value = "";
        renderAssignList(getAssignRenderPool());
        search.focus();
      }
    }
  });
  el("dgQuestAssignSearch").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    const filtered = getAssignRenderPool().filter(
      (u) => !q || String(u.name || u.email || u.id).toLowerCase().indexOf(q) !== -1
    );
    renderAssignList(filtered);
  });
  el("dgQuestAssignList").addEventListener("click", (e) => {
    const cb = e.target.closest("input[type='checkbox']");
    if (!cb) return;
    updateAssignLabel();
    syncQuestStepGating();
  });

  // Close the assign dropdown when clicking outside of it
  document.addEventListener("click", (e) => {
    const dd = el("dgQuestAssignDropdown");
    const control = el("dgQuestAssignControl");
    if (!dd || !control) return;
    if (!control.contains(e.target) && !dd.contains(e.target)) {
      dd.style.display = "none";
    }
  });

  // Step 4 fields
  el("dgQuestPointSelect").addEventListener("change", syncQuestStepGating);
  el("dgQuestUrgencySelect").addEventListener("change", syncQuestStepGating);

  // Step 5: recurring controls
  el("dgQuestRecurIntervalInput").addEventListener("input", updateRecurInterval);
  el("dgQuestRecurUnitSelect").addEventListener("change", updateRecurUnit);
  el("dgQuestRecurEverydayBtn").addEventListener("click", toggleRecurEveryday);
  document.querySelectorAll("#dgQuestFormModal .dg-quest-recur-day").forEach((btn) => {
    btn.addEventListener("click", () => toggleRecurWeekday(parseInt(btn.dataset.day, 10)));
  });
  el("dgQuestRecurMonthlyDatesList").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.date) return;
    toggleRecurMonthlyDate(parseInt(btn.dataset.date, 10));
  });
}

// Keep a reference to the last loaded positions so the cascade works even if
// refs are not passed again on a subsequent open.
let positionsRef = [];

export function openQuestForm(mode, task, refs, tab) {
  const isEdit = mode === "edit";
  const isSide = tab === "quest"; // "daily" => main quest, "quest" => side quest
  formEditOpen = isEdit;

  wireFormEvents();

  el("dgQuestFormId").value = isEdit && task ? task.id : "";
  el("dgQuestFormTitle").textContent = isEdit
    ? (isSide ? "Edit Side Quest" : "Edit Quest")
    : (isSide ? "Add New Side Quest" : "Add New Quest");
  el("dgQuestFormSubtitle").textContent = isSide
    ? "Satu kali (non-berulang) dengan tanggal due date"
    : "Lengkapi detail quest di bawah ini";
  el("dgQuestFormSubmit").textContent = isEdit ? "Update Quest" : "Create Quest";

  positionsRef = (refs && refs.positions) || [];

  // Department + Position selects
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
  el("dgQuestDeptSelect").innerHTML = deptOptions;

  const initialDept = isEdit && task && task.deptId ? task.deptId : "";
  el("dgQuestDeptSelect").value = initialDept;
  populatePositionsForDept(initialDept, isEdit && task && task.posId ? task.posId : "", positionsRef);

  // Assign list pool + pre-select
  formAssignPool = (refs.users || []).slice();
  const selectedAssign = isEdit && task && task.assign_to
    ? (Array.isArray(task.assign_to) ? task.assign_to : [task.assign_to])
    : [];
  renderAssignList(getAssignRenderPool(), selectedAssign);
  updateAssignLabel();

  // Deadline / points / urgency / due date
  el("dgQuestDeadlineTime").value = isEdit && task ? task.deadline_time || "" : "";
  let pointsVal = isEdit && task && task.points ? task.points : 1;
  if (pointsVal > 3) pointsVal = 3;
  if (pointsVal < 1) pointsVal = 1;
  el("dgQuestPointSelect").value = String(pointsVal);
  el("dgQuestUrgencySelect").value = isEdit && task && task.priority ? task.priority : "normal";
  el("dgQuestSideDueDate").value =
    isEdit && task && task.due_date ? String(task.due_date).slice(0, 10) : "";

  // Recurring state (main quest only)
  formRecurState = { unit: "week", interval: 1, weekdays: [], monthlyDates: [] };
  if (!isSide) {
    const r = isEdit && task && task.recur ? task.recur : null;
    if (r) {
      formRecurState.unit = r.unit === "month" ? "month" : "week";
      formRecurState.interval = typeof r.interval === "number" ? r.interval : 1;
      formRecurState.weekdays = Array.isArray(r.weekdays) ? r.weekdays.slice() : [];
      formRecurState.monthlyDates = Array.isArray(r.monthly_dates) ? r.monthly_dates.slice() : [];
    } else {
      formRecurState.weekdays = [new Date().getDay()];
    }
  }

  // Show/hide recurring vs due date based on tab
  const recurBlock = el("dgQuestStep5");
  const dueRow = el("dgQuestSideDueRow");
  if (recurBlock) recurBlock.style.display = isSide ? "none" : "";
  if (dueRow) dueRow.style.display = isSide ? "" : "none";

  renderRecurState();
  syncQuestStepGating();
  openSubModal("dgQuestFormModal");
}

export function closeQuestForm() {
  closeSubModal("dgQuestFormModal");
}

function setStepEnabled(stepId, enabled, forceOpen) {
  const node = el(stepId);
  if (!node) return;
  const active = forceOpen || enabled;
  node.classList.toggle("dg-quest-step-locked", !active);
  node.querySelectorAll("input, select, textarea, button").forEach((f) => {
    f.disabled = !active;
  });
}

function syncQuestStepGating() {
  const title = (el("dgQuestNameInput") || {}).value || "";
  const dept = (el("dgQuestDeptSelect") || {}).value || "";
  const pos = (el("dgQuestPosSelect") || {}).value || "";
  const hasAssign = (el("dgQuestAssignList") || { querySelectorAll: () => [] })
    .querySelectorAll("input[type='checkbox']:checked").length > 0;

  const hasTitle = !!title.trim();
  const hasDeptPos = hasTitle && !!dept && !!pos;
  const hasAssignAll = hasDeptPos && hasAssign;

  setStepEnabled("dgQuestDescStep", hasTitle, formEditOpen);
  setStepEnabled("dgQuestStep2", hasTitle, formEditOpen);
  setStepEnabled("dgQuestStep3", hasDeptPos, formEditOpen);
  setStepEnabled("dgQuestStep4", hasAssignAll, formEditOpen);
  setStepEnabled("dgQuestStep5", hasAssignAll, formEditOpen);
}

function getAssignRenderPool() {
  const filtered = getFilteredAssignPool();
  if (!formEditOpen) return filtered;
  // In edit mode keep previously-assigned users visible even if their dept/pos
  // no longer matches the current selection.
  const poolIds = new Set(filtered.map((u) => String(u.id)));
  const selected = Array.from(
    (el("dgQuestAssignList") || { querySelectorAll: () => [] }).querySelectorAll(
      "input[type='checkbox']:checked"
    )
  ).map((cb) => cb.value);
  const missing = formAssignPool.filter(
    (u) => selected.indexOf(String(u.id)) !== -1 && !poolIds.has(String(u.id))
  );
  return filtered.concat(missing);
}

function renderAssignList(users, preselected = []) {
  const list = el("dgQuestAssignList");
  if (!list) return;
  // Preserve current checks when re-rendering (e.g. search) unless explicitly provided
  if (!preselected.length) {
    preselected = Array.from(
      list.querySelectorAll("input[type='checkbox']:checked")
    ).map((cb) => cb.value);
  }
  if (!users.length) {
    list.innerHTML = '<div class="text-muted small p-2">No users available.</div>';
    return;
  }
  list.innerHTML = users
    .map((u) => {
      const name = u.name || u.email || u.id || "User";
      const initials = name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0] || "")
        .join("")
        .toUpperCase();
      const checked = preselected.indexOf(String(u.id)) !== -1 ? "checked" : "";
      const photo = u.photo
        ? `<img src="${escapeHtml(u.photo)}" alt="" class="dg-quest-assign-avatar" />`
        : `<span class="dg-quest-assign-avatar">${escapeHtml(initials || "U")}</span>`;
      return `
        <label class="dg-quest-assign-option">
          <input type="checkbox" value="${escapeHtml(String(u.id))}" ${checked} />
          ${photo}
          <span class="dg-quest-assign-name">${escapeHtml(name)}</span>
        </label>`;
    })
    .join("");
}

function updateAssignLabel() {
  const label = el("dgQuestAssignButtonLabel");
  const list = el("dgQuestAssignList");
  if (!label || !list) return;
  const selected = list.querySelectorAll("input[type='checkbox']:checked");
  const count = selected.length;
  label.textContent = count > 0
    ? `${count} user${count > 1 ? "s" : ""} selected`
    : "Select users...";
}

function renderRecurState() {
  el("dgQuestRecurIntervalInput").value = String(formRecurState.interval);
  el("dgQuestRecurUnitSelect").value = formRecurState.unit;
  const weekly = el("dgQuestRecurWeeklyContainer");
  const monthly = el("dgQuestRecurMonthlyContainer");
  if (weekly) weekly.style.display = formRecurState.unit === "week" ? "" : "none";
  if (monthly) monthly.style.display = formRecurState.unit === "month" ? "" : "none";
  renderRecurWeekdays();
  renderRecurMonthlyDates();
}

function renderRecurWeekdays() {
  document.querySelectorAll("#dgQuestFormModal .dg-quest-recur-day").forEach((btn) => {
    const day = parseInt(btn.dataset.day, 10);
    const active = formRecurState.weekdays.indexOf(day) !== -1;
    btn.classList.toggle("active", active);
  });
  const everyday = el("dgQuestRecurEverydayBtn");
  if (everyday) {
    everyday.classList.toggle("active", formRecurState.weekdays.length === 7);
  }
}

function toggleRecurWeekday(day) {
  const limit = Math.max(1, Math.min(7, formRecurState.interval || 1));
  const idx = formRecurState.weekdays.indexOf(day);
  if (idx !== -1) {
    formRecurState.weekdays.splice(idx, 1);
  } else {
    if (formRecurState.weekdays.length >= limit) formRecurState.weekdays = [];
    formRecurState.weekdays.push(day);
  }
  renderRecurWeekdays();
}

function toggleRecurEveryday() {
  const everyday = el("dgQuestRecurEverydayBtn");
  const isActive = everyday && everyday.classList.contains("active");
  if (isActive) {
    formRecurState.weekdays = [];
  } else {
    formRecurState.weekdays = [0, 1, 2, 3, 4, 5, 6];
    formRecurState.interval = 7;
    el("dgQuestRecurIntervalInput").value = "7";
  }
  renderRecurState();
}

function updateRecurInterval() {
  const val = parseInt(el("dgQuestRecurIntervalInput").value, 10);
  formRecurState.interval = Number.isNaN(val) ? 1 : Math.max(1, Math.min(31, val));
  const limit = formRecurState.unit === "week" ? 7 : 31;
  if (formRecurState.weekdays.length > limit) formRecurState.weekdays = formRecurState.weekdays.slice(0, limit);
  if (formRecurState.monthlyDates.length > limit) formRecurState.monthlyDates = formRecurState.monthlyDates.slice(0, limit);
  renderRecurState();
}

function updateRecurUnit() {
  formRecurState.unit = el("dgQuestRecurUnitSelect").value || "week";
  renderRecurState();
}

function renderRecurMonthlyDates() {
  const list = el("dgQuestRecurMonthlyDatesList");
  if (!list) return;
  const limit = Math.max(1, Math.min(31, formRecurState.interval || 1));
  const selected = new Set(formRecurState.monthlyDates);
  list.innerHTML = "";
  for (let d = 1; d <= 31; d++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.date = String(d);
    btn.className = "btn btn-sm dg-quest-recur-date" + (selected.has(d) ? " active" : "");
    btn.textContent = String(d);
    list.appendChild(btn);
  }
}

function toggleRecurMonthlyDate(date) {
  const limit = Math.max(1, Math.min(31, formRecurState.interval || 1));
  const idx = formRecurState.monthlyDates.indexOf(date);
  if (idx !== -1) {
    formRecurState.monthlyDates.splice(idx, 1);
  } else {
    if (formRecurState.monthlyDates.length >= limit) formRecurState.monthlyDates = [];
    formRecurState.monthlyDates.push(date);
  }
  renderRecurMonthlyDates();
}

export function readQuestForm(tab) {
  const isSide = tab === "quest"; // "daily" => main quest, "quest" => side quest
  const deptSelect = el("dgQuestDeptSelect");
  const posSelect = el("dgQuestPosSelect");
  const assignList = el("dgQuestAssignList");
  const assignTo = assignList
    ? Array.from(assignList.querySelectorAll("input[type='checkbox']:checked")).map(
        (cb) => cb.value
      )
    : [];

  let recur = null;
  if (!isSide) {
    const hasPattern =
      (formRecurState.unit === "week" && formRecurState.weekdays.length > 0) ||
      (formRecurState.unit === "month" && formRecurState.monthlyDates.length > 0);
    if (hasPattern) {
      recur = {
        unit: formRecurState.unit,
        interval: Math.max(1, formRecurState.interval || 1),
        weekdays: formRecurState.unit === "week" ? formRecurState.weekdays.slice() : [],
        monthly_dates: formRecurState.unit === "month" ? formRecurState.monthlyDates.slice() : [],
      };
    }
  }

  return {
    id: el("dgQuestFormId").value,
    title: el("dgQuestNameInput").value.trim(),
    description: el("dgQuestDescEditor").value.trim(),
    deptId: deptSelect ? deptSelect.value : "",
    posId: posSelect ? posSelect.value : "",
    deptName: deptSelect && deptSelect.selectedOptions[0] ? deptSelect.selectedOptions[0].text : "",
    posName: posSelect && posSelect.selectedOptions[0] ? posSelect.selectedOptions[0].text : "",
    assignTo,
    deadline_time: el("dgQuestDeadlineTime").value,
    points: parseInt(el("dgQuestPointSelect").value, 10) || 0,
    priority: el("dgQuestUrgencySelect").value || "normal",
    tags: [],
    due_date: isSide ? el("dgQuestSideDueDate").value : "",
    type: isSide ? "side" : "main",
    quest_type: isSide ? "side" : "main",
    recur,
  };
}

/* ------------------------------------------------------------------ */
/* Detail Sub-Modal                                                    */
/* ------------------------------------------------------------------ */

export function openQuestDetail(task, ctx, tab) {
  el("dgQuestDetailTitle").textContent = task.title || (tab === "daily" ? "Detail Daily" : "Detail Quest");
  const body = el("dgQuestDetailBody");

  const deadlineTime = task.deadline_time || "—";
  const priority = String(task.priority || "normal").toLowerCase();
  const points = task.points || 0;
  const descHtml =
    task.description && String(task.description).replace(/<[^>]*>/g, "").trim().length > 0
      ? task.description
      : '<em style="color:#94a3b8">Tidak ada deskripsi.</em>';
  const deptNames = (task.departments || []).map((d) => d && d.name).filter(Boolean);
  const posNames = (task.positions || []).map((p) => p && p.name).filter(Boolean);
  const tags = task.tags || [];
  const assign = getAssignList(task);

  const prioColor = priority === "urgent" || priority === "high" ? "#dc2626" : priority === "medium" ? "#f59e0b" : "#16a34a";
  const prioLabel = priority === "urgent" || priority === "high" ? "High" : priority === "medium" ? "Medium" : "Normal";
  const statusText = task.status || "Initiate";
  const statusColor = /reported|done|complete/i.test(statusText) ? "#16a34a" : "#64748b";

  let assignees = "";
  if (assign.length) {
    assignees =
      '<div class="small fw-bold text-muted mt-3 mb-1">Ditugaskan Kepada:</div><div style="display:flex;flex-wrap:wrap;gap:0.4rem">' +
      assign.slice(0, 4).map((uid) => {
        const u = ctx.users && ctx.users[uid] ? ctx.users[uid] : { uid, name: uid };
        const nm = u.name || u.email || uid;
        const init = nm.split(" ").slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
        const inner = u.photo
          ? `<img src="${escapeHtml(u.photo)}" style="width:1.25rem;height:1.25rem;border-radius:50%;object-fit:cover" alt="" />`
          : `<span style="width:1.25rem;height:1.25rem;border-radius:50%;background:#dbeafe;color:#2563eb;font-size:0.55rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center">${escapeHtml(init)}</span>`;
        return `<span style="display:inline-flex;align-items:center;gap:0.4rem;border-radius:999px;border:1px solid #e2e8f0;background:#fff;padding:0.15rem 0.6rem 0.15rem 0.2rem;font-size:0.75rem">${inner} ${escapeHtml(nm)}</span>`;
      }).join("") +
      (assign.length > 4 ? `<span class="dg-quest-tag">+${assign.length - 4} lainnya</span>` : "") +
      "</div>";
  }

  let tagsHtml = "";
  if (tags.length) {
    tagsHtml =
      '<div class="small fw-bold text-muted mt-3 mb-1">Tags:</div><div style="display:flex;flex-wrap:wrap;gap:0.4rem">' +
      tags.map((t) => `<span class="dg-quest-tag">${escapeHtml(String(t))}</span>`).join("") +
      "</div>";
  }

  body.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;">
      <span class="dg-quest-badge" style="background:${statusColor}1a;color:${statusColor}">● ${escapeHtml(statusText)}</span>
      <span class="dg-quest-badge" style="background:${prioColor}1a;color:${prioColor}"><i class="bi bi-flag"></i> ${escapeHtml(prioLabel)}</span>
      ${points > 0 ? `<span class="dg-quest-points">${points} Point</span>` : ""}
      ${task.recur ? "<span class='text-primary small fw-semibold'><i class='bi bi-arrow-repeat'></i> Berulang harian</span>" : ""}
    </div>
    <div class="row g-2 mt-2">
      <div class="col-4">
        <div class="p-2 border rounded bg-light">
          <div class="text-muted" style="font-size:10px;text-transform:uppercase;">Deadline</div>
          <div class="fw-bold small">${escapeHtml(deadlineTime)}</div>
        </div>
      </div>
      <div class="col-4">
        <div class="p-2 border rounded bg-light">
          <div class="text-muted" style="font-size:10px;text-transform:uppercase;">Department</div>
          <div class="fw-bold small">${deptNames.length ? escapeHtml(deptNames.join(", ")) : "—"}</div>
        </div>
      </div>
      <div class="col-4">
        <div class="p-2 border rounded bg-light">
          <div class="text-muted" style="font-size:10px;text-transform:uppercase;">Position</div>
          <div class="fw-bold small">${posNames.length ? escapeHtml(posNames.join(", ")) : "—"}</div>
        </div>
      </div>
    </div>
    ${assignees}
    ${tagsHtml}
    <div class="small fw-bold text-muted mt-3 mb-1">Deskripsi / Catatan:</div>
    <div class="p-3 border rounded bg-light small" style="line-height:1.6">${descHtml}</div>
  `;

  openSubModal("dgQuestDetailModal");
}

export function closeQuestDetail() {
  closeSubModal("dgQuestDetailModal");
}

/* ------------------------------------------------------------------ */
/* Daily Report Sub-Modal                                              */
/* ------------------------------------------------------------------ */

export function openDailyReportModal(checkedTasks, userName) {
  const now = new Date();
  el("dgReportDateInput").value = now.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  el("dgReportNameInput").value = userName || "Intern";

  const deptSet = {};
  checkedTasks.forEach((t) => {
    (t.departments || []).forEach((d) => {
      if (d && d.name) deptSet[d.name] = true;
    });
  });
  el("dgReportDeptInput").value = Object.keys(deptSet).length ? Object.keys(deptSet).join(", ") : "—";

  const container = el("dgReportTasksContainer");
  if (!checkedTasks.length) {
    container.innerHTML =
      '<p class="dg-quest-empty-msg">Belum ada item yang dicentang. Silakan centang to-do Anda terlebih dahulu di board.</p>';
  } else {
    container.innerHTML = checkedTasks
      .map((t, i) => `
        <div class="dg-quest-report-item" data-task-id="${t.id}">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
              <span class="dg-quest-report-item-title">${i + 1}. ${escapeHtml(t.title || "Untitled")}</span>
              <span class="dg-quest-report-item-points">${t.points || 0} Pt</span>
            </div>
            <textarea rows="2" class="dg-quest-report-item-detail" data-detail-for="${t.id}" placeholder="Catatan / bukti pengerjaan (opsional)..."></textarea>
          </div>
        </div>
      `)
      .join("");
  }

  openSubModal("dgDailyReportModal");
}

export function closeDailyReportModal() {
  closeSubModal("dgDailyReportModal");
}

export function setReportSubmitBusy(busy, label) {
  setButtonBusy(el("dgSubmitReportBtn"), busy, label || "Mengirim...");
}

export function collectReportDetails() {
  const details = {};
  el("dgReportTasksContainer")?.querySelectorAll(".dg-quest-report-item").forEach((item) => {
    const id = item.getAttribute("data-task-id");
    const input = item.querySelector("[data-detail-for]");
    if (id && input) details[id] = input.value.trim();
  });
  return details;
}

export function collectCheckedIds() {
  const ids = [];
  el("dgReportTasksContainer")?.querySelectorAll(".dg-quest-report-item").forEach((item) => {
    ids.push(item.getAttribute("data-task-id"));
  });
  return ids;
}

/* ------------------------------------------------------------------ */
/* Feedback & Helpers                                                 */
/* ------------------------------------------------------------------ */

export function showBoardLoading() {
  ["dgDailyOverdueList", "dgDailyTodayList", "dgDailyUpcomingList", "dgQuestOverdueList", "dgQuestTodayList", "dgQuestUpcomingList"].forEach((id) => {
    const node = el(id);
    if (node) node.innerHTML = '<p class="dg-quest-empty-msg">Memuat data...</p>';
  });
}

export function showBoardError(msg) {
  const node = el("dgDailyTodayList");
  if (node) node.innerHTML = `<p class="dg-quest-empty-msg text-danger">Gagal memuat: ${escapeHtml(msg)}</p>`;
}

export function notifySuccess(msg) {
  toast(msg, "success");
}

export function notifyError(msg) {
  toast(msg, "error");
}

export function closeSubModalById(modalId) {
  closeSubModal(modalId);
}

function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  return (tmp.textContent || tmp.innerText || "").trim();
}
