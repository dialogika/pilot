// pages/hr/users-management/users-management.ui.js
// =====================================================================
// USERS MANAGEMENT UI — rendering, DOM manipulation, event handling.
//
// Rules:
//  - NO Firestore queries here (use repository).
//  - Pure view logic; receives plain data, renders into DOM.
//  - Uses toast from shared ui.js for notifications.
// =====================================================================

import { escapeHtml } from "../../../assets/js/utils.js";
import { toast } from "../../../assets/js/ui.js";
import { VALID_ROLES } from "./users-management.repository.js";

function $(id) {
  return document.getElementById(id);
}

/* ------------------------------------------------------------------ */
/* Modal show/hide — legacy: fixed inset-0 bg-black/40 + hidden class  */
/* ------------------------------------------------------------------ */

function showModalOverlay(id) {
  const el = $(id);
  if (!el) return;
  el.classList.remove("hidden");
  el.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function hideModalOverlay(id) {
  const el = $(id);
  if (!el) return;
  el.classList.add("hidden");
  el.style.display = "none";
  document.body.style.overflow = "";
}

// Expose to window for inline onclick handlers (legacy compatibility)
window.hideModal = hideModalOverlay;

/* ------------------------------------------------------------------ */
/* Role badge styling — maps new 7-tier + legacy display names        */
/* ------------------------------------------------------------------ */

function getRoleBadgeClass(role) {
  const r = String(role || "").toLowerCase().trim();
  // Legacy aliases: Super Team, Sub Team, Employee, Internship, etc.
  if (r.includes("super") || r === "owner") return "bg-indigo-100 text-indigo-600";
  if (r.includes("sub") || r === "team") return "bg-teal-100 text-teal-600";
  if (r === "admin") return "bg-indigo-100 text-indigo-700";
  if (r === "staff" || r.includes("employee")) return "bg-pink-100 text-pink-600";
  if (r === "intern" || r.includes("internship")) return "bg-slate-100 text-slate-600";
  if (r === "mentor") return "bg-amber-100 text-amber-700";
  if (r === "member" || r.includes("client")) return "bg-sky-100 text-sky-600";
  if (r === "owner") return "bg-red-100 text-red-700";
  return "bg-sky-100 text-sky-600";
}

/* ------------------------------------------------------------------ */
/* Build a single table row — legacy visual (px-6 py-4, badges)       */
/* Spec: no Created At column (7 cols total), no shield icon          */
/* ------------------------------------------------------------------ */

function buildRow(user, positionsMap) {
  const tr = document.createElement("tr");
  tr.className = "hover:bg-slate-50 transition";
  tr.setAttribute("data-user-id", user.id);

  const roleBadge = getRoleBadgeClass(user.role);
  const displayName = escapeHtml(user.name || user.email || "Unknown");
  let positionLabel = user.position || "-";
  if (positionsMap && positionsMap[user.position]) {
    positionLabel = positionsMap[user.position];
  }
  const avatar = escapeHtml(user.avatar || `https://i.pravatar.cc/150?u=${user.id}`);
  const email = escapeHtml(user.email || "-");
  const roleLabel = escapeHtml(user.role || "member");
  const status = user.status || "Active";
  const statusClass = status === "Active"
    ? "bg-green-500 text-white"
    : "bg-red-500 text-white";

  tr.innerHTML = `
    <td class="px-6 py-4 sticky left-0 bg-white z-10">
      <input type="checkbox" class="row-checkbox rounded">
    </td>
    <td class="px-6 py-4 flex items-center gap-3 sticky left-10 bg-white z-10">
      <img src="${avatar}" class="w-10 h-10 rounded-full object-cover flex-shrink-0" alt="">
      <span class="font-semibold text-slate-800">${displayName}</span>
    </td>
    <td class="px-6 py-4 text-slate-500">${email}</td>
    <td class="px-6 py-4 text-start">
      <span class="bg-blue-100 text-blue-600 px-3 py-1 rounded-md text-xs font-bold whitespace-nowrap">${escapeHtml(positionLabel)}</span>
    </td>
    <td class="px-6 py-4 text-center">
      <span class="${roleBadge} px-3 py-1 rounded-md text-xs font-bold whitespace-nowrap">${roleLabel}</span>
    </td>
    <td class="px-6 py-4 text-center">
      <span class="${statusClass} px-3 py-1 rounded-md text-[10px] font-medium whitespace-nowrap">
        <i class="fas fa-circle text-[3px] mr-1"></i> ${escapeHtml(status)}
      </span>
    </td>
    <td class="px-6 py-4 text-right">
      <div class="flex justify-end gap-3 text-slate-400">
        <button class="hover:text-blue-500" data-action="edit" data-user-id="${user.id}" title="Edit"><i class="fas fa-pen"></i></button>
        <button class="hover:text-red-500" data-action="delete" data-user-id="${user.id}" title="Delete"><i class="fas fa-trash"></i></button>
      </div>
    </td>`;

  return tr;
}

/* ------------------------------------------------------------------ */
/* Public: render table rows                                           */
/* ------------------------------------------------------------------ */

export function renderTable(users, rolesMap, positionsMap) {
  const tbody = $("um-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-12">
          <div class="text-4xl text-slate-300 mb-3"><i class="bi bi-people"></i></div>
          <div class="text-slate-500 font-medium">No users found</div>
        </td>
      </tr>`;
    return;
  }

  users.forEach((u) => tbody.appendChild(buildRow(u, positionsMap)));
}

/* ------------------------------------------------------------------ */
/* Public: render skeleton loading                                      */
/* ------------------------------------------------------------------ */

export function renderSkeleton() {
  const tbody = $("um-tbody");
  if (!tbody) return;
  const rows = Array.from(
    { length: 5 },
    () => `
    <tr class="animate-pulse">
      <td class="px-6 py-4"><div class="w-4 h-4 bg-slate-200 rounded"></div></td>
      <td class="px-6 py-4"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-slate-200 rounded-full"></div><div class="w-24 h-4 bg-slate-200 rounded"></div></div></td>
      <td class="px-6 py-4"><div class="w-32 h-4 bg-slate-200 rounded"></div></td>
      <td class="px-6 py-4"><div class="w-16 h-6 bg-slate-200 rounded-md"></div></td>
      <td class="px-6 py-4"><div class="w-16 h-6 bg-slate-200 rounded-md mx-auto"></div></td>
      <td class="px-6 py-4"><div class="w-14 h-5 bg-slate-200 rounded-md mx-auto"></div></td>
      <td class="px-6 py-4"><div class="w-12 h-4 bg-slate-200 rounded mx-auto"></div></td>
    </tr>`
  );
  tbody.innerHTML = rows.join("");
}

/* ------------------------------------------------------------------ */
/* Public: render empty table (no data at all)                          */
/* ------------------------------------------------------------------ */

export function renderEmptyTable() {
  const tbody = $("um-tbody");
  if (!tbody) return;
  tbody.innerHTML = `
    <tr>
      <td colspan="7" class="text-center py-12">
        <div class="text-4xl text-slate-300 mb-3"><i class="bi bi-inbox"></i></div>
        <div class="text-slate-500 font-medium">No users available</div>
      </td>
    </tr>`;
}

/* ------------------------------------------------------------------ */
/* Public: render error state                                           */
/* ------------------------------------------------------------------ */

export function renderError(message) {
  const tbody = $("um-tbody");
  if (!tbody) return;
  tbody.innerHTML = `
    <tr>
      <td colspan="7" class="text-center py-12">
        <div class="text-3xl text-amber-500 mb-3"><i class="bi bi-exclamation-triangle"></i></div>
        <div class="text-slate-600">${escapeHtml(message)}</div>
      </td>
    </tr>`;
}

/* ------------------------------------------------------------------ */
/* Public: render pagination controls — legacy footer style             */
/* ------------------------------------------------------------------ */

export function renderPagination(info) {
  const container = $("um-pagination");
  if (!container) return;

  const { currentPage, totalRows, rowsPerPage, totalPages } = info;
  const start = totalRows === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const end = Math.min(currentPage * rowsPerPage, totalRows);

  const left = `<p class="text-slate-500 font-medium">Showing ${start} - ${end} of ${totalRows} entries</p>`;

  let pages = "";
  // Prev
  pages += `<button data-page="prev" ${currentPage <= 1 ? "disabled" : ""} class="w-8 h-8 flex items-center justify-center ${currentPage <= 1 ? "text-slate-300 opacity-40 cursor-not-allowed" : "text-slate-400 hover:text-slate-600"}"><i class="fas fa-chevron-left text-xs"></i></button>`;
  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }
  for (let i = startPage; i <= endPage; i++) {
    const active = i === currentPage;
    pages += `<button data-page="${i}" class="w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold ${active ? "btn-dlg-blue text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"}">${i}</button>`;
  }
  pages += `<button data-page="next" ${currentPage >= totalPages ? "disabled" : ""} class="w-8 h-8 flex items-center justify-center ${currentPage >= totalPages ? "text-slate-300 opacity-40 cursor-not-allowed" : "text-slate-400 hover:text-slate-600"}"><i class="fas fa-chevron-right text-xs"></i></button>`;

  container.innerHTML = `${left}<div class="flex items-center gap-1">${pages}</div>`;

  // Sync external rows-per-page selector if present (legacy has it above table)
  const rowsSel = $("um-rows-per-page");
  if (rowsSel && rowsSel.value !== String(rowsPerPage)) {
    rowsSel.value = String(rowsPerPage);
  }
}

/* ------------------------------------------------------------------ */
/* Public: role & position dropdown helpers                             */
/* ------------------------------------------------------------------ */

export function renderRoleOptions(rolesMap) {
  const select = $("um-role");
  if (!select) return;
  const current = select.value;
  select.innerHTML = "";
  const roles = Object.values(rolesMap);
  if (roles.length === 0) {
    VALID_ROLES.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r.charAt(0).toUpperCase() + r.slice(1);
      select.appendChild(opt);
    });
  } else {
    roles.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r.charAt(0).toUpperCase() + r.slice(1);
      select.appendChild(opt);
    });
  }
  if (current) select.value = current;
}

export function renderPositionOptions(positionsMap) {
  const select = $("um-position");
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">— Select Position —</option>';
  Object.entries(positionsMap).forEach(([id, label]) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = label;
    select.appendChild(opt);
  });
  if (current) select.value = current;
}

/* ------------------------------------------------------------------ */
/* Public: populate filter role dropdown                                */
/* ------------------------------------------------------------------ */

export function renderFilterRoleOptions(rolesMap) {
  const select = $("um-filter-role");
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">All Role</option>';
  const roles = Object.values(rolesMap);
  if (roles.length === 0) {
    VALID_ROLES.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r.charAt(0).toUpperCase() + r.slice(1);
      select.appendChild(opt);
    });
  } else {
    roles.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r.charAt(0).toUpperCase() + r.slice(1);
      select.appendChild(opt);
    });
  }
  if (current) select.value = current;
}

/* ------------------------------------------------------------------ */
/* Public: modal title & submit label                                   */
/* ------------------------------------------------------------------ */

export function updateModalTitle(title) {
  const el = $("modal-title");
  if (el) el.textContent = title;
}

export function updateSubmitButtonLabel(label) {
  const btn = $("um-submit-btn");
  if (btn) btn.textContent = label;
}

/* ------------------------------------------------------------------ */
/* Public: populate edit form + edit-mode field visibility              */
/* ------------------------------------------------------------------ */

export function setEditModeFields(isEdit) {
  const displayWrap = $("field-display-name");
  const passwordWrap = $("field-password");
  if (displayWrap) displayWrap.style.display = isEdit ? "none" : "";
  if (passwordWrap) passwordWrap.style.display = isEdit ? "none" : "";
}

export function populateEditForm(data) {
  const f = (id, val) => {
    const el = $(id);
    if (el) el.value = val || "";
  };
  f("um-fullname", data.fullName);
  f("um-display-name", data.displayName);
  f("um-email", data.email);
  f("um-role", data.role);
  f("um-position", data.position);
  f("um-department", data.department);
  f("um-phone", data.phone || "");
  if ($("um-status") && data.status) $("um-status").value = data.status;
  if ($("um-password")) $("um-password").value = data.password || "";
}

/* ------------------------------------------------------------------ */
/* Public: read form data                                               */
/* ------------------------------------------------------------------ */

export function getFormData() {
  return {
    fullName: ($("um-fullname") || {}).value || "",
    displayName: ($("um-display-name") || {}).value || "",
    email: ($("um-email") || {}).value || "",
    role: ($("um-role") || {}).value || "staff",
    position: ($("um-position") || {}).value || "",
    department: ($("um-department") || {}).value || "",
    phone: ($("um-phone") || {}).value || "",
    status: ($("um-status") || {}).value || "Active",
    password: ($("um-password") || {}).value || "",
  };
}

/* ------------------------------------------------------------------ */
/* Public: set delete label                                             */
/* ------------------------------------------------------------------ */

export function setDeleteUserLabel(user) {
  const el = $("delete-user-label");
  if (el) el.textContent = user ? `${user.name || user.email}` : "";
}

/* ------------------------------------------------------------------ */
/* Public: event wiring helpers                                         */
/* ------------------------------------------------------------------ */

export function setSearchInputHandler(callback) {
  const el = $("um-search");
  if (!el) return;
  let debounceTimer;
  el.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => callback(el.value.trim()), 300);
  });
}

export function setFiltersChangeHandler(callback) {
  const roleFilter = $("um-filter-role");
  if (roleFilter) {
    roleFilter.addEventListener("change", () => {
      callback({ role: roleFilter.value });
    });
  }
  // Legacy extras: also wire filterStatus / filterSort / filterDatePreset as role/trigger if needed (no-op for style parity)
}

export function setAddUserClickHandler(callback) {
  const btn = $("um-add-user-btn");
  if (btn) btn.addEventListener("click", callback);
}

export function setRowsPerPageChangeHandler(callback) {
  // Primary selector is now in the toolbar (um-rows-per-page)
  const sel = $("um-rows-per-page");
  if (sel) {
    sel.addEventListener("change", () => {
      callback(parseInt(sel.value, 10) || 10);
    });
    return;
  }
  // Fallback: delegated on pagination container (legacy double-render case)
  const container = $("um-pagination");
  if (!container) return;
  container.addEventListener("change", (e) => {
    if (e.target.id === "um-rows-per-page") {
      callback(parseInt(e.target.value, 10) || 10);
    }
  });
}

export function setPrevPageHandler(callback) {
  const container = $("um-pagination");
  if (!container) return;
  container.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-page="prev"]');
    if (btn && !btn.disabled) callback();
  });
}

export function setNextPageHandler(callback) {
  const container = $("um-pagination");
  if (!container) return;
  container.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-page="next"]');
    if (btn && !btn.disabled) callback();
  });
}

export function setPageNumberClickHandler(callback) {
  const container = $("um-pagination");
  if (!container) return;
  container.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-page]");
    if (!btn) return;
    const val = btn.dataset.page;
    if (val === "prev" || val === "next") return;
    const page = parseInt(val, 10);
    if (!isNaN(page) && !btn.classList.contains("btn-dlg-blue")) {
      callback(page);
    }
  });
}

export function setTableActionHandler(callback) {
  const tbody = $("um-tbody");
  if (!tbody) return;
  tbody.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const userId = btn.dataset.userId;
    if (action && userId) callback(action, userId);
  });
}

export function setAddModalSaveHandler(callback) {
  const btn = $("um-submit-btn");
  if (btn) btn.addEventListener("click", callback);
}

export function setEditModalSaveHandler(callback) {
  // Shared save button — orchestrator decides add vs edit
}

export function setDeleteConfirmHandler(callback) {
  const btn = $("um-confirm-delete-btn");
  if (btn) btn.addEventListener("click", callback);
}

/* ------------------------------------------------------------------ */
/* Public: modal show/hide wrappers                                     */
/* ------------------------------------------------------------------ */

export function showAddEditModal() {
  showModalOverlay("add-edit-modal");
}

export function hideAddEditModal() {
  hideModalOverlay("add-edit-modal");
}

export function showDeleteModal() {
  showModalOverlay("delete-confirm-modal");
}

export function hideDeleteModal() {
  hideModalOverlay("delete-confirm-modal");
}

/* ------------------------------------------------------------------ */
/* Public: wire close buttons on modals                                */
/* ------------------------------------------------------------------ */

export function wireModalCloseButtons() {
  document.querySelectorAll(".um-modal-close, [data-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-close");
      if (target) {
        hideModalOverlay(target);
        return;
      }
      const overlay = btn.closest(".fixed.inset-0");
      if (overlay && overlay.id) hideModalOverlay(overlay.id);
      // Fallback: search up to .fixed parent
      const fallback = btn.closest("[id$='-modal']");
      if (fallback) hideModalOverlay(fallback.id);
    });
  });
  // Click overlay background to close
  ["add-edit-modal", "delete-confirm-modal"].forEach((id) => {
    const overlay = $(id);
    if (!overlay) return;
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) hideModalOverlay(id);
    });
  });
  // Also support legacy customRange overlay
  const custom = $("customRangeOverlay");
  if (custom) {
    custom.addEventListener("click", (e) => {
      if (e.target === custom) {
        custom.classList.add("hidden");
        custom.style.display = "none";
      }
    });
    const cancel = $("customRangeCancel");
    if (cancel) cancel.addEventListener("click", () => {
      custom.classList.add("hidden");
      custom.style.display = "none";
    });
  }
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export function notifySuccess(message) {
  toast(message, "success");
}

export function notifyError(message) {
  toast(message, "error");
}
