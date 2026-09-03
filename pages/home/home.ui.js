// pages/home/home.ui.js
// =====================================================================
// HOME PRESENTATION — renders data and wires events. NO Firebase queries.
//
// RULES:
//  - Receives plain data from the orchestrator / repository.
//  - All DOM reads/writes + event listeners live here.
//  - No collection/doc/get*/onSnapshot calls in this file.
// =====================================================================

import {
  toast,
  confirmDialog,
  showModal,
  hideModal,
  setButtonBusy,
} from "../../assets/js/ui.js";
import { formatDateID, stripHtml, escapeHtml } from "../../assets/js/utils.js";
import { ANNOUNCEMENT_COLORS } from "./home.repository.js";

/* ------------------------------------------------------------------ */
/* Welcome header                                                      */
/* ------------------------------------------------------------------ */

export function renderWelcome(name, role, position) {
  const greetingEl = document.getElementById("welcomeMessage");
  if (greetingEl) greetingEl.innerText = formatGreeting(name);

  const roleBadge = document.getElementById("dashboard-role-badge");
  if (roleBadge) {
    roleBadge.textContent = role ? role[0].toUpperCase() + role.slice(1) : "-";
  }

  const positionBadge = document.getElementById("dashboard-position-badge");
  if (positionBadge) {
    positionBadge.textContent = "" + (position || "Member");
  }

  adjustFeatureGridByDivision(role, position);
}

function resolveDivisionGroup(position = "") {
  const pos = String(position).trim().toLowerCase();

  // Happy / HR
  if (
    pos.includes("recruitment") ||
    pos.includes("people dev") ||
    pos.includes("human capital") ||
    pos.includes("hr") ||
    pos.includes("happy")
  ) {
    return "sect-hr";
  }

  // Rebuy / Product / Class
  if (
    pos.includes("product manager") ||
    pos.includes("admin kelas") ||
    pos.includes("mentor") ||
    pos.includes("class")
  ) {
    return "sect-product";
  }

  // Closing / Marketing
  if (
    pos.includes("marketing") ||
    pos.includes("community") ||
    pos.includes("sales") ||
    pos.includes("advertiser") ||
    pos.includes("closing")
  ) {
    return "sect-marketing";
  }

  // Branding
  if (
    pos.includes("creator") ||
    pos.includes("branding") ||
    pos.includes("design") ||
    pos.includes("website") ||
    pos.includes("writer") ||
    pos.includes("editor")
  ) {
    return "sect-branding";
  }

  return "";
}

export function adjustFeatureGridByDivision(role, position) {
  const container = document.getElementById("appsOverviewContainer");
  if (!container) return;

  const roleLower = String(role || "").trim().toLowerCase();
  const posLower = String(position || "").trim().toLowerCase();
  
  // Leadership & Management see all divisions
  if (
    roleLower === "owner" ||
    roleLower === "admin" ||
    roleLower === "team" ||
    posLower === "chief executive officer" ||
    posLower === "ceo" ||
    posLower === "super administrator" ||
    posLower === "co-founder"
  ) {
    const allSections = ["sect-hr", "sect-marketing", "sect-product", "sect-branding"];
    allSections.forEach((id) => {
      const sect = document.getElementById(id);
      if (sect) {
        sect.style.display = "block";
        sect.style.opacity = "1";
      }
    });
    return;
  }

  const primarySectId = resolveDivisionGroup(position);
  if (!primarySectId) {
    return;
  }

  const primarySect = document.getElementById(primarySectId);
  if (primarySect) {
    primarySect.style.display = "block";
    container.insertBefore(primarySect, container.firstChild);

    const header = primarySect.querySelector("h5");
    if (header && !header.querySelector(".my-division-badge")) {
      const badge = document.createElement("span");
      badge.className = "badge bg-primary ms-2 my-division-badge";
      badge.style.fontSize = "11px";
      badge.style.verticalAlign = "middle";
      badge.style.borderRadius = "20px";
      badge.style.padding = "4px 10px";
      badge.textContent = "Divisi Anda";
      header.appendChild(badge);
    }
  }

  const allSections = ["sect-hr", "sect-marketing", "sect-product", "sect-branding"];
  allSections.forEach((id) => {
    if (id !== primarySectId) {
      const sect = document.getElementById(id);
      if (sect) {
        sect.style.display = "none";
      }
    }
  });
}

/** Greeting based on current hour. */
function formatGreeting(name = "") {
  const hour = new Date().getHours();
  let greeting = "Hello";
  if (hour >= 5 && hour < 12) greeting = "Good Morning";
  else if (hour >= 12 && hour < 17) greeting = "Good Afternoon";
  else if (hour >= 17 && hour < 21) greeting = "Good Evening";
  else greeting = "Good Night";
  const firstName = name ? name.split(" ")[0] : "";
  return firstName ? `${greeting}, ${firstName}!` : greeting;
}

/* ------------------------------------------------------------------ */
/* Who is Online                                                       */
/* ------------------------------------------------------------------ */

/**
 * Render the online users avatar list + active badge.
 * @param {Array} users  from repository (already sorted, me-first handled by caller)
 * @param {string|null} currentUid
 */
export function renderOnlineUsers(users, currentUid) {
  const container = document.getElementById("onlineUsersContainer");
  const badge = document.getElementById("onlineActiveBadge");
  if (!container || !badge) return;

  let me = null;
  const others = [];
  users.forEach((u) => (u.uid === currentUid ? (me = u) : others.push(u)));
  const ordered = me ? [me, ...others] : others;

  const activeCount = users.filter((u) => u.isActive).length;
  badge.innerText = activeCount + " Active";

  container.innerHTML = "";
  ordered.forEach((u) => {
    const ringStyle = u.isActive ? "background:#0B2B6A;" : "background:transparent;";
    const src =
      u.photo && u.photo.trim()
        ? u.photo
        : "https://i.pravatar.cc/150?u=" + encodeURIComponent(u.uid || u.name || "");
    const statusDot = u.isActive ? '<div class="online-status-dot"></div>' : "";

    const div = document.createElement("div");
    div.className = "avatar-wrapper";
    div.title = u.name || "";
    div.style.cursor = "pointer";
    div.innerHTML = `
      <div class="avatar-ring" style="${ringStyle}"></div>
      <div class="avatar-mask">
        <img src="${src}" alt="${escapeHtml(u.name || "")}" class="avatar-img">
      </div>
      ${statusDot}
    `;
    container.appendChild(div);
  });
}

/* ------------------------------------------------------------------ */
/* Announcements                                                       */
/* ------------------------------------------------------------------ */

/**
 * Render the announcement banner cards.
 * @param {Array} items  from repository (filtered, sorted, top 5)
 */
export function renderAnnouncements(items) {
  const section = document.getElementById("announcementBannerSection");
  const container = document.getElementById("announcementBannerContainer");
  if (!section || !container) return;

  if (items.length === 0) {
    section.style.display = "none";
    container.innerHTML = "";
    return;
  }

  section.style.display = "block";
  container.innerHTML = "";

  items.forEach((announcement) => {
    const color = ANNOUNCEMENT_COLORS[announcement.type || "info"] || "#0d6efd";
    const fullText = stripHtml(announcement.content || "");
    const isLong = fullText.length > 140;
    const preview = isLong ? fullText.slice(0, 140) + "..." : fullText;
    const dateLabel = announcement.created_at?.toDate
      ? formatDateID(announcement.created_at.toDate())
      : "-";
    const targetLabel = announcement.target_department_name || "All Employees";

    const div = document.createElement("div");
    div.className =
      "p-3 rounded-3 bg-white shadow-sm d-flex justify-content-between align-items-start";
    div.style.borderLeft = "5px solid " + color;
    div.style.cursor = "pointer";
    div.innerHTML = `
      <div style="min-width:0; overflow-wrap:anywhere; word-break:break-all;">
        <div class="fw-bold small">
          ${announcement.pinned ? '<i class="bi bi-pin-angle-fill text-primary me-1"></i>' : ""}
          ${escapeHtml(announcement.title || "Untitled")}
        </div>
        <div class="text-muted small mb-1">${escapeHtml(preview)}</div>
        <div class="d-flex flex-wrap align-items-center gap-2 text-muted" style="font-size:11px;">
          <span><i class="bi bi-calendar-event me-1"></i>${escapeHtml(dateLabel)}</span>
          <span><i class="bi bi-people me-1"></i>${escapeHtml(targetLabel)}</span>
        </div>
      </div>
      ${isLong ? '<span class="text-primary small fw-semibold flex-shrink-0 ms-2">Lihat detail</span>' : ""}
    `;
    div.addEventListener("click", () => openAnnouncementDetail(announcement, color));
    container.appendChild(div);
  });
}

/** Populate + show the announcement detail modal. */
function openAnnouncementDetail(announcement, color) {
  const badgeEl = document.getElementById("announcementDetailBadge");
  const titleEl = document.getElementById("announcementDetailTitle");
  const targetEl = document.getElementById("announcementDetailTarget");
  const dateEl = document.getElementById("announcementDetailDate");
  const contentEl = document.getElementById("announcementDetailContent");
  if (!badgeEl || !titleEl || !contentEl) return;

  const type = announcement.type || "info";
  badgeEl.textContent = type.toUpperCase();
  badgeEl.style.backgroundColor = color;
  badgeEl.style.color = "#fff";
  titleEl.textContent = announcement.title || "Untitled";
  if (targetEl) targetEl.textContent = announcement.target_department_name || "All Employees";
  if (dateEl)
    dateEl.textContent = announcement.created_at?.toDate
      ? formatDateID(announcement.created_at.toDate())
      : "-";
  contentEl.innerHTML =
    announcement.content || "<span class='text-muted'>No content.</span>";
  showModal("announcementDetailModal");
}

/* ------------------------------------------------------------------ */
/* Daily report approvals                                              */
/* ------------------------------------------------------------------ */

/**
 * Render the pending daily-report list.
 * @param {Array} reports  from repository (dept-filtered, sorted)
 */
export function renderDailyReports(reports) {
  const list = document.getElementById("dailyReportList");
  const badge = document.getElementById("dailyReportBadge");
  if (!list || !badge) return;

  list.innerHTML = "";
  if (reports.length === 0) {
    list.innerHTML =
      '<p class="text-muted small mb-0">Tidak ada laporan perlu persetujuan.</p>';
    badge.textContent = "0";
    return;
  }

  badge.textContent = reports.length;
  reports.forEach((report) => {
    const data = report.data;
    const item = document.createElement("div");
    item.className =
      "p-3 bg-light rounded-3 d-flex justify-content-between align-items-center";
    item.style.cursor = "pointer";
    item.innerHTML = `
      <div>
        <p class="fw-bold mb-0 small">${escapeHtml(data.name || "No Name")}</p>
        <small class="text-muted" style="font-size:0.7rem">
          ${escapeHtml(data.date_label || data.report_date || "-")} | ${escapeHtml(data.position || "-")}
        </small>
      </div>
      <button type="button" class="btn btn-sm btn-dark rounded-pill px-3 daily-report-review-btn">
        Review
      </button>
    `;
    item.addEventListener("click", (e) => {
      if (e.target.closest(".daily-report-review-btn")) {
        e.stopPropagation();
        openDailyReportModal(report.id, data);
      }
    });
    list.appendChild(item);
  });
}

/**
 * Populate + show the daily-report detail modal, wire approve/reject.
 * @param {string} reportId
 * @param {Object} data
 */
export function openDailyReportModal(reportId, data) {
  const modalEl = document.getElementById("dailyReportModal");
  if (!modalEl) return;

  document.getElementById("modalReportId").value = reportId;
  document.getElementById("modalReportName").textContent = data.name || "-";
  document.getElementById("modalReportNameDetail").textContent = data.name || "-";

  const reportDeptName =
    data.department ||
    (Array.isArray(data.departments) && data.departments.length > 0 ? data.departments[0] : "-");
  const reportPosition = data.position || "";
  document.getElementById("modalReportPosition").textContent = reportPosition || "-";
  document.getElementById("modalReportDeptPos").textContent =
    reportDeptName + " / " + (reportPosition || "-");
  document.getElementById("modalReportDate").textContent =
    data.date_label || data.report_date || "-";

  let photoUrl = data.photo_url || data.photo || data.profile_photo;
  const photoEl = document.getElementById("modalReportPhoto");
  photoEl.src =
    photoUrl || "https://i.pravatar.cc/150?u=" + encodeURIComponent(data.name || "user");

  const tasksList = document.getElementById("modalReportTasks");
  tasksList.innerHTML = "";
  document.getElementById("modalReportId").dataset.tasks = JSON.stringify(data.tasks || []);

  if (Array.isArray(data.tasks)) {
    data.tasks.forEach((task, index) => {
      const li = document.createElement("li");
      li.className = "d-flex align-items-start mb-3 pb-2 border-bottom";
      const detailHtml = task.detail || task.note || "";
      const isHtml = /<[a-z][\s\S]*>/i.test(detailHtml);
      const pointsLabel = task.points ? `<span class="badge bg-warning bg-opacity-25 text-dark ms-2" style="font-size:0.75rem;">${task.points} Pt</span>` : "";

      const taskStatus = String(task.status || "").toLowerCase();
      let statusBadge = "";
      if (taskStatus === "approved") {
        statusBadge = `<span class="badge bg-success bg-opacity-10 text-success border border-success ms-2" style="font-size:0.75rem;"><i class="bi bi-check-circle-fill me-1"></i>Approved</span>`;
      } else if (taskStatus === "rejected") {
        statusBadge = `<span class="badge bg-danger bg-opacity-10 text-danger border border-danger ms-2" style="font-size:0.75rem;"><i class="bi bi-x-circle-fill me-1"></i>Rejected</span>`;
      }

      const renderedDetail = isHtml
        ? `<div class="daily-report-task-detail mt-1 text-muted" style="max-width:100%; word-break:break-word; overflow-x:hidden;">${detailHtml}</div>`
        : `<div class="text-muted small mt-1" style="word-break:break-word; white-space:pre-line;">${escapeHtml(detailHtml)}</div>`;

      const isApproved = taskStatus === "approved";
      const isRejected = taskStatus === "rejected";

      li.innerHTML = `
        <div class="form-check mt-1 me-2 task-check-container" style="display:none;">
          <input class="form-check-input task-approve-checkbox" type="checkbox" value="${index}" id="taskCheck_${index}" ${isApproved ? "checked disabled" : isRejected ? "disabled" : ""}>
        </div>
        <span class="badge bg-primary rounded-pill me-2 mt-1 task-badge" style="min-width:24px;">${index + 1}</span>
        <div style="flex:1; min-width:0; overflow-wrap:break-word;">
          <div class="fw-bold text-dark d-flex align-items-center flex-wrap">${escapeHtml(task.title || task.task || "-")} ${pointsLabel} ${statusBadge}</div>
          ${renderedDetail}
        </div>
      `;
      tasksList.appendChild(li);
    });
  }

  const globalRejectBtn = document.getElementById("btnRejectReport");
  if (globalRejectBtn) globalRejectBtn.style.display = "inline-block";
  isIndividualRejectMode = false;

  renderApproveButtons();
  showModal("dailyReportModal");
}

/** Render the default "Approve All / Select Task" action buttons. */
function renderApproveButtons() {
  const container = document.getElementById("approveButtonsContainer");
  if (!container) return;
  container.innerHTML = `
    <button type="button" class="btn btn-success rounded-pill px-4 me-2" id="btnApproveAll">Approve All</button>
    <button type="button" class="btn btn-outline-success rounded-pill px-4" id="btnApproveIndividual">Select Task</button>
  `;
}

/* ------------------------------------------------------------------ */
/* Pending user registrations                                          */
/* ------------------------------------------------------------------ */

/**
 * Render the pending-registrations table.
 * @param {Array} users  from repository
 */
export function renderPendingUsers(users) {
  const section = document.getElementById("pendingApprovalsSection");
  const tbody = document.getElementById("pendingUsersTableBody");
  if (!section || !tbody) return;

  section.style.display = "block";
  tbody.innerHTML = "";

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="5" class="text-center text-muted">No pending registrations.</td></tr>
    `;
    return;
  }

  users.forEach((u) => {
    let regDate = "-";
    if (u.registered_at && typeof u.registered_at.toDate === "function") {
      regDate = u.registered_at.toDate().toLocaleString("id-ID");
    }
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="d-flex align-items-center">
          <img src="${escapeHtml(u.photo || "https://i.pravatar.cc/150")}"
               class="rounded-circle me-2" width="35" height="35" style="object-fit: cover;">
          <strong>${escapeHtml(u.name || "No Name")}</strong>
        </div>
      </td>
      <td>${escapeHtml(u.email || "-")}</td>
      <td><span class="badge bg-secondary">${escapeHtml(u.employment?.position || "-")}</span></td>
      <td class="small text-muted">${escapeHtml(regDate)}</td>
      <td>
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-sm btn-success rounded-pill px-3" data-approve-pending="${u.id}">Approve</button>
          <button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-3" data-reject-pending="${u.id}">Reject</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ------------------------------------------------------------------ */
/* Notifications & feedback                                            */
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

export function setReportActionBusy(busy, label = "Menyimpan...") {
  const btn = document.getElementById("btnApproveAll");
  if (btn) setButtonBusy(btn, busy, label);
}

let isIndividualRejectMode = false;

export function showRejectModal(isIndividual = false) {
  isIndividualRejectMode = isIndividual;
  const input = document.getElementById("rejectReasonInput");
  if (input) input.value = "";
  showModal("rejectReportModal");
}

export function isIndividualReject() {
  return isIndividualRejectMode;
}

export function getRejectReason() {
  return (document.getElementById("rejectReasonInput")?.value || "").trim();
}

export function hideDailyReportModal() {
  hideModal("dailyReportModal");
}

export function hideRejectModal() {
  hideModal("rejectReportModal");
}

/* ------------------------------------------------------------------ */
/* Individual task approval mode                                       */
/* ------------------------------------------------------------------ */

export function renderIndividualMode() {
  document.querySelectorAll(".task-check-container").forEach((el) => (el.style.display = "block"));
  document.querySelectorAll(".task-badge").forEach((el) => (el.style.display = "none"));
  document.querySelectorAll(".task-approve-checkbox:not(:disabled)").forEach((cb) => (cb.checked = false));

  const globalRejectBtn = document.getElementById("btnRejectReport");
  if (globalRejectBtn) globalRejectBtn.style.display = "none";

  const container = document.getElementById("approveButtonsContainer");
  if (container) {
    container.innerHTML = `
      <button type="button" class="btn btn-secondary rounded-pill px-4 me-2" id="btnCancelIndividual">Cancel</button>
      <button type="button" class="btn btn-outline-danger rounded-pill px-4 me-2" id="btnRejectIndividual">Reject Selected</button>
      <button type="button" class="btn btn-success rounded-pill px-4" id="btnSubmitIndividual">Approve Selected</button>
    `;
  }
}

export function renderCancelIndividual() {
  document.querySelectorAll(".task-check-container").forEach((el) => (el.style.display = "none"));
  document.querySelectorAll(".task-badge").forEach((el) => (el.style.display = "inline-block"));

  const globalRejectBtn = document.getElementById("btnRejectReport");
  if (globalRejectBtn) globalRejectBtn.style.display = "inline-block";

  isIndividualRejectMode = false;
  renderApproveButtons();
}

export function getSelectedTaskIndices() {
  return Array.from(document.querySelectorAll(".task-approve-checkbox"))
    .filter((cb) => cb.checked && !cb.disabled)
    .map((cb) => parseInt(cb.value));
}

export function getOpenReportId() {
  return document.getElementById("modalReportId")?.value || "";
}

export function getOpenReportTasks() {
  try {
    return JSON.parse(document.getElementById("modalReportId")?.dataset.tasks || "[]");
  } catch (e) {
    return [];
  }
}