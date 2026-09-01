// pages/internships/internships.ui.js
// =====================================================================
// INTERNSHIPS UI — rendering, DOM manipulation, event handling, modal
// interactions.
//
// RULES:
//  - NO Firestore queries here (use internships.repository.js).
//  - Pure view logic; receives plain data, renders into DOM.
//  - Reuses shared ui.js (showModal/hideModal/toast/confirmDialog) and
//    utils.js (escapeHtml, getMs, truncateText).
// =====================================================================

import { escapeHtml, getMs } from "../../assets/js/utils.js";
import { toast, showModal, hideModal, confirmDialog, setButtonBusy } from "../../assets/js/ui.js";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function el(id) {
  return document.getElementById(id);
}

/**
 * Convert a Date-like value into an input[type=date] string (YYYY-MM-DD).
 * @param {any} value
 * @returns {string}
 */
function toInputDateValue(value) {
  const ms = getMs(value);
  if (ms == null) return "";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return yyyy + "-" + mm + "-" + dd;
}

/**
 * Format a Date-like value as "dd Mon yyyy".
 * @param {any} value
 * @returns {string}
 */
function formatDateValue(value) {
  const ms = getMs(value);
  if (ms == null) return "";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return String(d.getDate()).padStart(2, "0") + " " + months[d.getMonth()] + " " + d.getFullYear();
}

function truncate(text, maxLen) {
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

/* ------------------------------------------------------------------ */
/* Status derivation (mirrors legacy getInternshipDisplayStatus)        */
/* ------------------------------------------------------------------ */

/**
 * Derive display status { label, type } for an intern row.
 * @param {Object} u normalized intern row
 * @returns {{label:string, type:string}}
 */
export function getInternshipDisplayStatus(u) {
  const base = String(u.status || "").toLowerCase();
  const end = u.endDateObj instanceof Date && !Number.isNaN(u.endDateObj.getTime()) ? u.endDateObj : null;
  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (base === "inactive") return { label: "Inactive", type: "danger" };
  if (base === "left") return { label: "Left", type: "danger" };
  if (base === "graduate") return { label: "Graduate", type: "success" };
  if (!end) return { label: u.status || "Active", type: "success" };

  const endMid = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const diffDays = Math.round((endMid - todayMid) / 86400000);
  if (diffDays < 0) return { label: "Graduate", type: "success" };
  if (diffDays <= 20) return { label: "On Leave", type: "warning" };
  return { label: "Active", type: "success" };
}

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

/**
 * Render the four stat cards (total/active/on leave/left + trends).
 * @param {Array} list normalized intern rows
 */
export function renderStats(list) {
  const totalEl = el("statsCardTotalCount");
  const totalDeltaEl = el("statsCardTotalDelta");
  const activeEl = el("statsCardActiveCount");
  const onLeaveEl = el("statsCardOnLeaveCount");
  const onLeavePctEl = el("statsCardOnLeavePct");
  const leftEl = el("statsCardLeftCount");
  const leftPctEl = el("statsCardLeftPct");
  if (!totalEl || !totalDeltaEl || !activeEl || !onLeaveEl || !onLeavePctEl || !leftEl || !leftPctEl) return;

  const now = new Date();
  const total = list.length;
  let activeCount = 0;
  let onLeaveCount = 0;
  let leftCount = 0;
  let newLast3Months = 0;
  let newPrev3Months = 0;

  const threeMonthsMs = 90 * 24 * 60 * 60 * 1000;
  const last3Start = new Date(now.getTime() - threeMonthsMs);
  const prev3Start = new Date(now.getTime() - 2 * threeMonthsMs);

  list.forEach((u) => {
    const s = getInternshipDisplayStatus(u).label;
    if (s === "Active") activeCount += 1;
    else if (s === "On Leave") onLeaveCount += 1;
    else if (s === "Left") leftCount += 1;

    const t = getMs(u.startDateObj);
    if (t != null) {
      if (t >= last3Start.getTime() && t <= now.getTime()) newLast3Months += 1;
      else if (t >= prev3Start.getTime() && t < last3Start.getTime()) newPrev3Months += 1;
    }
  });

  totalEl.textContent = String(total);

  let totalDeltaText = "0%";
  let totalDeltaIcon = "";
  if (newPrev3Months === 0 && newLast3Months > 0) {
    totalDeltaText = "+100%";
    totalDeltaIcon = '<i class="fas fa-arrow-up ms-1"></i>';
  } else if (newPrev3Months > 0) {
    const diff = ((newLast3Months - newPrev3Months) / newPrev3Months) * 100;
    const rounded = Math.round(diff * 10) / 10;
    if (rounded > 0) {
      totalDeltaText = "+" + rounded + "%";
      totalDeltaIcon = '<i class="fas fa-arrow-up ms-1"></i>';
    } else if (rounded < 0) {
      totalDeltaText = String(rounded) + "%";
      totalDeltaIcon = '<i class="fas fa-arrow-down ms-1"></i>';
    } else {
      totalDeltaText = "0%";
    }
  }
  totalDeltaEl.innerHTML = (totalDeltaText + " " + totalDeltaIcon).trim();

  activeEl.textContent = String(activeCount);

  onLeaveEl.textContent = String(onLeaveCount);
  const onLeavePct = total > 0 ? Math.round((onLeaveCount / total) * 1000) / 10 : 0;
  const onLeaveSign = onLeavePct >= 0 ? "+" : "";
  onLeavePctEl.innerHTML = onLeaveSign + onLeavePct + '% <i class="fas fa-arrow-' + (onLeavePct >= 0 ? 'up' : 'down') + ' ms-1"></i>';

  leftEl.textContent = String(leftCount);
  const leftPct = total > 0 ? Math.round((leftCount / total) * 1000) / 10 : 0;
  const leftSign = leftPct >= 0 ? "+" : "";
  leftPctEl.innerHTML = leftSign + leftPct + '% <i class="fas fa-arrow-' + (leftPct >= 0 ? 'up' : 'down') + ' ms-1"></i>';
}

/* ------------------------------------------------------------------ */
/* Table                                                               */
/* ------------------------------------------------------------------ */

/**
 * Filter + sort + paginate and render the interns table.
 * @param {Array} list normalized intern rows
 * @param {{search:string, statusFilter:string, rowsPerPage:number, page:number}} state
 */
export function renderTable(list, state) {
  const tbody = el("internshipTableBody");
  const paginationInfo = el("internshipPaginationInfo");
  const prevBtn = el("internshipPrevPage");
  const nextBtn = el("internshipNextPage");
  if (!tbody || !paginationInfo || !prevBtn || !nextBtn) return;

  let data = list.slice();
  if (state.search) {
    const q = state.search.toLowerCase();
    data = data.filter(
      (u) =>
        (u.name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.position || "").toLowerCase().includes(q),
    );
  }
  if (state.statusFilter) {
    const target = state.statusFilter;
    data = data.filter((u) => getInternshipDisplayStatus(u).label === target);
  }

  const statusOrderPriority = (u) => {
    const v = getInternshipDisplayStatus(u).label.toLowerCase();
    if (v === "active") return 0;
    if (v === "on leave") return 1;
    if (v === "graduate") return 2;
    return 3;
  };
  data.sort((a, b) => {
    const pa = statusOrderPriority(a);
    const pb = statusOrderPriority(b);
    if (pa !== pb) return pa - pb;
    return (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase(), "id");
  });

  const total = data.length;
  const perPage = state.rowsPerPage;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (state.page > totalPages) state.page = totalPages;
  const startIndex = (state.page - 1) * perPage;
  const endIndex = Math.min(startIndex + perPage, total);
  const pageItems = data.slice(startIndex, endIndex);

  tbody.innerHTML = "";
  if (total === 0) {
    tbody.innerHTML = '<tr><td colspan="14" class="text-center text-muted py-5">Belum ada data internship.</td></tr>';
  } else {
    pageItems.forEach((u) => tbody.appendChild(buildRow(u)));
  }

  paginationInfo.textContent =
    total === 0 ? "Showing 0 entries" : "Showing " + (startIndex + 1) + " - " + endIndex + " of " + total + " entries";

  prevBtn.disabled = state.page <= 1;
  nextBtn.disabled = state.page >= totalPages;
  prevBtn.classList.toggle("opacity-50", prevBtn.disabled);
  nextBtn.classList.toggle("opacity-50", nextBtn.disabled);
}

function buildRow(u) {
  const statusInfo = getInternshipDisplayStatus(u);
  const statusClass =
    statusInfo.type === "danger"
      ? "badge-soft-danger"
      : statusInfo.type === "warning"
        ? "badge-soft-warning"
        : "badge-soft-success";

  const promoteHtml = u.promotedToTeam
    ? '<span class="badge bg-success" style="font-size: 0.75rem;"><i class="fas fa-check me-1"></i>Team Member</span>'
    : '<button type="button" class="btn-action shadow-sm internship-promote-btn" data-user-id="' +
      escapeHtml(u.id) +
      '" title="Promosikan ke Team"><i class="fas fa-arrow-up"></i></button>';

  const tr = document.createElement("tr");
  tr.innerHTML =
    '<td class="ps-4 internship-col-name">' +
    '<div class="d-flex align-items-center gap-3">' +
    '<div class="internship-avatar"><img src="' + escapeHtml(u.avatar) + '" alt=""></div>' +
    '<div><div class="fw-bold text-dark mb-0">' + escapeHtml(u.name || "-") + "</div></div>" +
    "</div></td>" +
    '<td class="internship-col-status"><span class="badge-soft ' + statusClass + '">' +
    '<i class="fas fa-circle" style="font-size: 6px;"></i> ' + escapeHtml(statusInfo.label) +
    "</span></td>" +
    "<td>" + escapeHtml(u.endDate || formatDateValue(u.endDateObj) || "-") + "</td>" +
    '<td><span class="badge-soft badge-soft-primary">' + escapeHtml(u.position || "-") + "</span></td>" +
    '<td><span class="badge-soft badge-soft-secondary">' + escapeHtml(u.department || "-") + "</span></td>" +
    "<td>" + escapeHtml(u.mode || "-") + "</td>" +
    "<td>" + escapeHtml(truncate(u.address || "-", 20)) + "</td>" +
    "<td>" + escapeHtml(u.birthDate || formatDateValue(u.birthDateObj) || "-") + "</td>" +
    "<td>" + escapeHtml(u.campus || "-") + "</td>" +
    "<td>" + escapeHtml(u.phone || "-") + "</td>" +
    "<td>" + escapeHtml(u.email || "-") + "</td>" +
    "<td>" + escapeHtml(truncate(u.instagram || "-", 17)) + "</td>" +
    "<td>" + escapeHtml(truncate(u.linkedin || "-", 17)) + "</td>" +
    '<td class="text-end pe-4">' +
    '<div class="d-flex justify-content-end gap-2">' +
    promoteHtml +
    '<button type="button" class="btn-action shadow-sm internship-edit-btn" data-user-id="' +
    escapeHtml(u.id) +
    '"><i class="fas fa-edit"></i></button>' +
    '<button type="button" class="btn-action shadow-sm text-danger internship-delete-btn" data-user-id="' +
    escapeHtml(u.id) +
    '"><i class="fas fa-trash-alt"></i></button>' +
    "</div></td>";
  return tr;
}

/* ------------------------------------------------------------------ */
/* Modals (Bootstrap)                                                  */
/* ------------------------------------------------------------------ */

function fillPositionSelect(select, positionsMap) {
  select.innerHTML = '<option value="">Select position</option>';
  Object.keys(positionsMap || {}).forEach((key) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = positionsMap[key];
    select.appendChild(opt);
  });
}

function fillDepartmentSelect(select, departmentsMap) {
  select.innerHTML = '<option value="">Select department</option>';
  Object.values(departmentsMap || {}).forEach((label) => {
    const opt = document.createElement("option");
    opt.value = label;
    opt.textContent = label;
    select.appendChild(opt);
  });
}

/**
 * Open the Add Intern modal with populated dropdowns.
 * @param {Object} positionsMap
 * @param {Object} departmentsMap
 */
export function openAddModal(positionsMap, departmentsMap) {
  const posSelect = el("internshipAddPosition");
  const depSelect = el("internshipAddDepartment");
  if (!posSelect || !depSelect) return;
  fillPositionSelect(posSelect, positionsMap);
  fillDepartmentSelect(depSelect, departmentsMap);

  el("internshipAddName").value = "";
  el("internshipAddStatus").value = "Active";
  el("internshipAddStartDate").value = "";
  el("internshipAddEndDate").value = "";
  posSelect.value = "";
  depSelect.value = "";
  el("internshipAddMode").value = "";
  el("internshipAddAddress").value = "";
  el("internshipAddBirthDate").value = "";
  el("internshipAddCampus").value = "";
  el("internshipAddPhone").value = "";
  el("internshipAddEmail").value = "";
  el("internshipAddInstagram").value = "";
  el("internshipAddLinkedin").value = "";

  showModal("internshipAddModal");
}

/**
 * Open the Edit Intern modal pre-filled with the intern's data.
 * @param {Object} user normalized intern row
 * @param {Object} positionsMap
 * @param {Object} departmentsMap
 */
export function openEditModal(user, positionsMap, departmentsMap) {
  const posSelect = el("internshipEditPosition");
  const depSelect = el("internshipEditDepartment");
  if (!posSelect || !depSelect || !user) return;
  fillPositionSelect(posSelect, positionsMap);
  fillDepartmentSelect(depSelect, departmentsMap);

  el("internshipEditUserId").value = user.id;
  el("internshipEditName").value = user.name || "";
  el("internshipEditStatus").value = user.status || "Active";
  el("internshipEditStartDate").value = toInputDateValue(user.startDateObj);
  el("internshipEditEndDate").value = toInputDateValue(user.endDateObj);
  posSelect.value = user.positionKey || "";
  depSelect.value = user.department || "";
  el("internshipEditMode").value = user.mode || "";
  el("internshipEditAddress").value = user.address || "";
  el("internshipEditBirthDate").value = toInputDateValue(user.birthDateObj);
  el("internshipEditCampus").value = user.campus || "";
  el("internshipEditPhone").value = user.phone || "";
  el("internshipEditEmail").value = user.email || "";
  el("internshipEditInstagram").value = user.instagram || "";
  el("internshipEditLinkedin").value = user.linkedin || "";

  showModal("internshipEditModal");
}

/**
 * Open the Promote-to-Team modal for an intern.
 * @param {string} userId
 */
export function openPromoteModal(userId) {
  el("promoteUserId").value = userId || "";
  el("promoteDivisionSelect").value = "";
  showModal("promoteToTeamModal");
}

/* ------------------------------------------------------------------ */
/* Form readers                                                        */
/* ------------------------------------------------------------------ */

/**
 * Read the Add Intern form into a plain payload (dates kept as strings;
 * the orchestrator converts to Date objects before writing).
 * @returns {Object}
 */
export function readAddForm() {
  return {
    name: el("internshipAddName").value.trim(),
    status: el("internshipAddStatus").value,
    startDate: el("internshipAddStartDate").value,
    endDate: el("internshipAddEndDate").value,
    positionKey: el("internshipAddPosition").value,
    department: el("internshipAddDepartment").value.trim(),
    mode: el("internshipAddMode").value,
    address: el("internshipAddAddress").value.trim(),
    birthDate: el("internshipAddBirthDate").value,
    campus: el("internshipAddCampus").value.trim(),
    phone: el("internshipAddPhone").value.trim(),
    email: el("internshipAddEmail").value.trim(),
    instagram: el("internshipAddInstagram").value.trim(),
    linkedin: el("internshipAddLinkedin").value.trim(),
  };
}

/**
 * Read the Edit Intern form into a plain object of values.
 * @returns {Object}
 */
export function readEditForm() {
  return {
    userId: el("internshipEditUserId").value,
    name: el("internshipEditName").value.trim(),
    status: el("internshipEditStatus").value,
    startDate: el("internshipEditStartDate").value,
    endDate: el("internshipEditEndDate").value,
    positionKey: el("internshipEditPosition").value,
    department: el("internshipEditDepartment").value.trim(),
    mode: el("internshipEditMode").value,
    address: el("internshipEditAddress").value.trim(),
    birthDate: el("internshipEditBirthDate").value,
    campus: el("internshipEditCampus").value.trim(),
    phone: el("internshipEditPhone").value.trim(),
    email: el("internshipEditEmail").value.trim(),
    instagram: el("internshipEditInstagram").value.trim(),
    linkedin: el("internshipEditLinkedin").value.trim(),
  };
}

/**
 * Read the Promote-to-Team form.
 * @returns {{userId:string, division:string}}
 */
export function readPromoteForm() {
  return {
    userId: el("promoteUserId").value,
    division: el("promoteDivisionSelect").value,
  };
}

/* ------------------------------------------------------------------ */
/* Loading / empty / notifications                                     */
/* ------------------------------------------------------------------ */

/**
 * Show a loading placeholder in the table body.
 */
export function showTableLoading() {
  const tbody = el("internshipTableBody");
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="14" class="text-center text-muted py-5">Loading...</td></tr>';
  }
}

export function notifySuccess(message) {
  toast(message, "success");
}

export function notifyError(message) {
  toast(message, "error");
}

/**
 * Confirm a destructive action via the shared confirm dialog.
 * @param {string} message
 * @returns {Promise<boolean>}
 */
export function confirmDelete(message) {
  return confirmDialog(message, { title: "Konfirmasi", confirmText: "Hapus", danger: true });
}

/**
 * Set a button busy state.
 * @param {string} id button element id
 * @param {boolean} busy
 * @param {string} label
 */
export function setBusy(id, busy, label) {
  setButtonBusy(el(id), busy, label);
}

export { hideModal };