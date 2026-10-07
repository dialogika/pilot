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


export function renderFilterRoleOptions(rolesMap = {}, users = []) {
  const select = $("um-filter-role");
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">All Role</option>';

  const roleMap = new Map();

  // Canonical system roles
  VALID_ROLES.forEach((r) => {
    roleMap.set(r.toLowerCase(), r.charAt(0).toUpperCase() + r.slice(1));
  });

  // Roles from rolesMap if available
  if (rolesMap) {
    Object.values(rolesMap).forEach((r) => {
      if (typeof r === "string" && r.trim()) {
        roleMap.set(r.trim().toLowerCase(), r.trim());
      }
    });
  }

  // Any distinct roles present in loaded users
  if (Array.isArray(users)) {
    users.forEach((u) => {
      if (u.role && typeof u.role === "string" && u.role.trim()) {
        const val = u.role.trim().toLowerCase();
        if (!roleMap.has(val)) {
          const formatted = u.role
            .trim()
            .split(/\s+/)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(" ");
          roleMap.set(val, formatted);
        }
      }
    });
  }

  roleMap.forEach((label, val) => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = label;
    select.appendChild(opt);
  });

  if (current && roleMap.has(current.toLowerCase())) {
    select.value = current.toLowerCase();
  }
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

  const statusFilter = $("filterStatus");
  const sortFilter = $("filterSort");
  const datePreset = $("filterDatePreset");

  const notifyChange = () => {
    callback({
      role: roleFilter ? roleFilter.value : "",
      status: statusFilter ? statusFilter.value : "",
      sort: sortFilter ? sortFilter.value : "recent",
      datePreset: datePreset ? datePreset.value : "last90",
    });
  };

  if (roleFilter) roleFilter.addEventListener("change", notifyChange);
  if (statusFilter) statusFilter.addEventListener("change", notifyChange);
  if (sortFilter) sortFilter.addEventListener("change", notifyChange);
  if (datePreset) {
    datePreset.addEventListener("change", () => {
      if (datePreset.value === "custom") {
        showModalOverlay("customRangeOverlay");
      } else {
        notifyChange();
      }
    });
  }

  const customApply = $("customRangeApply");
  if (customApply) {
    customApply.addEventListener("click", () => {
      hideModalOverlay("customRangeOverlay");
      notifyChange();
    });
  }
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
/* ------------------------------------------------------------------ */
/* Select all checkbox                                                */
/* ------------------------------------------------------------------ */

export function wireSelectAllCheckbox() {
  const selectAll = $("selectAllCheckbox");
  const tbody = $("um-tbody");
  if (selectAll && tbody) {
    selectAll.addEventListener("change", () => {
      const checkboxes = tbody.querySelectorAll(".row-checkbox");
      checkboxes.forEach((cb) => (cb.checked = selectAll.checked));
    });
    tbody.addEventListener("change", (e) => {
      if (e.target.classList.contains("row-checkbox")) {
        const checkboxes = tbody.querySelectorAll(".row-checkbox");
        const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
        selectAll.checked = checkboxes.length > 0 && allChecked;
      }
    });
  }
}

/* ------------------------------------------------------------------ */
/* Export handlers & generators                                       */
/* ------------------------------------------------------------------ */

export function setExportHandlers({ onExportPdf, onExportExcel }) {
  const btn = $("exportButton");
  const menu = $("exportMenu");
  const pdfBtn = $("exportPdfBtn");
  const excelBtn = $("exportExcelBtn");

  if (btn && menu) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.toggle("hidden");
    });
    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target) && !btn.contains(e.target)) {
        menu.classList.add("hidden");
      }
    });
  }

  if (pdfBtn && onExportPdf) {
    pdfBtn.addEventListener("click", () => {
      if (menu) menu.classList.add("hidden");
      onExportPdf();
    });
  }

  if (excelBtn && onExportExcel) {
    excelBtn.addEventListener("click", () => {
      if (menu) menu.classList.add("hidden");
      onExportExcel();
    });
  }
}

export function exportToExcel(users, positionsMap) {
  const headers = ["Name", "Email", "Position", "Role", "Status", "Phone", "Department"];
  const rows = users.map((u) => {
    let positionLabel = u.position || "-";
    if (positionsMap && positionsMap[u.position]) {
      positionLabel = positionsMap[u.position];
    }
    return [
      `"${(u.name || u.displayName || "").replace(/"/g, '""')}"`,
      `"${(u.email || "").replace(/"/g, '""')}"`,
      `"${positionLabel.replace(/"/g, '""')}"`,
      `"${(u.role || "").replace(/"/g, '""')}"`,
      `"${(u.status || "Active").replace(/"/g, '""')}"`,
      `"${(u.phone || u.phoneNumber || "").replace(/"/g, '""')}"`,
      `"${(u.department || "").replace(/"/g, '""')}"`,
    ];
  });

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `users-management_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportToPdf(users, positionsMap) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    window.print();
    return;
  }
  const rowsHtml = users
    .map((u) => {
      let positionLabel = u.position || "-";
      if (positionsMap && positionsMap[u.position]) {
        positionLabel = positionsMap[u.position];
      }
      return `
        <tr>
          <td style="padding:8px; border:1px solid #ddd;">${escapeHtml(u.name || u.displayName || "-")}</td>
          <td style="padding:8px; border:1px solid #ddd;">${escapeHtml(u.email || "-")}</td>
          <td style="padding:8px; border:1px solid #ddd;">${escapeHtml(positionLabel)}</td>
          <td style="padding:8px; border:1px solid #ddd;">${escapeHtml(u.role || "-")}</td>
          <td style="padding:8px; border:1px solid #ddd;">${escapeHtml(u.status || "Active")}</td>
        </tr>`;
    })
    .join("");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Users Management - Export</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          h2 { margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th { background-color: #f3f4f6; padding: 8px; border: 1px solid #ddd; text-align: left; }
        </style>
      </head>
      <body>
        <h2>Users Management</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Position</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 300);
}

/**
 * Initialize Users Management Export Modal UI controls.
 */
export function initUsersExportModal() {
  const modalEl = $("exportUsersModal");
  if (!modalEl) return null;

  const currentYearMonth = new Date().toISOString().substring(0, 7);
  const monthInput = modalEl.querySelector(".export-month-input");
  const weekMonthInput = modalEl.querySelector(".export-week-month-input");

  if (monthInput && !monthInput.value) monthInput.value = currentYearMonth;
  if (weekMonthInput && !weekMonthInput.value) weekMonthInput.value = currentYearMonth;

  let currentFormat = "xlsx";
  let currentRange = "all";

  const btnXlsx = modalEl.querySelector('[data-format="xlsx"]');
  const btnCsv = modalEl.querySelector('[data-format="csv"]');
  const downloadBtnText = modalEl.querySelector(".download-btn-text");
  const helpMonthText = modalEl.querySelector(".export-help-month");
  const helpWeekText = modalEl.querySelector(".export-help-week");

  const setFormat = (fmt) => {
    currentFormat = fmt === "csv" ? "csv" : "xlsx";
    if (btnXlsx) btnXlsx.classList.toggle("active", currentFormat === "xlsx");
    if (btnCsv) btnCsv.classList.toggle("active", currentFormat === "csv");
    if (downloadBtnText) {
      downloadBtnText.textContent =
        currentFormat === "xlsx" ? "Download Excel (.xlsx)" : "Download CSV (.csv)";
    }
    if (helpMonthText) {
      helpMonthText.textContent = `Semua user yang terdaftar pada bulan yang dipilih akan dimasukkan ke dalam file ${currentFormat.toUpperCase()}.`;
    }
    if (helpWeekText) {
      helpWeekText.textContent = `Semua user yang terdaftar pada minggu yang dipilih akan dimasukkan ke dalam file ${currentFormat.toUpperCase()}.`;
    }
  };

  const rangeBtnAll = modalEl.querySelector('[data-range="all"]');
  const rangeBtnMonth = modalEl.querySelector('[data-range="month"]');
  const rangeBtnWeek = modalEl.querySelector('[data-range="week"]');
  const sectionAll = modalEl.querySelector(".section-all-picker");
  const sectionMonth = modalEl.querySelector(".section-month-picker");
  const sectionWeek = modalEl.querySelector(".section-week-picker");

  const setRange = (rType) => {
    currentRange = ["all", "month", "week"].includes(rType) ? rType : "all";
    if (rangeBtnAll) rangeBtnAll.classList.toggle("active", currentRange === "all");
    if (rangeBtnMonth) rangeBtnMonth.classList.toggle("active", currentRange === "month");
    if (rangeBtnWeek) rangeBtnWeek.classList.toggle("active", currentRange === "week");

    if (sectionAll) sectionAll.style.display = currentRange === "all" ? "block" : "none";
    if (sectionMonth) sectionMonth.style.display = currentRange === "month" ? "block" : "none";
    if (sectionWeek) sectionWeek.style.display = currentRange === "week" ? "block" : "none";
  };

  if (btnXlsx) btnXlsx.onclick = () => setFormat("xlsx");
  if (btnCsv) btnCsv.onclick = () => setFormat("csv");
  if (rangeBtnAll) rangeBtnAll.onclick = () => setRange("all");
  if (rangeBtnMonth) rangeBtnMonth.onclick = () => setRange("month");
  if (rangeBtnWeek) rangeBtnWeek.onclick = () => setRange("week");

  setFormat("xlsx");
  setRange("all");

  return {
    getFormData: () => {
      const weekSelect = modalEl.querySelector(".export-week-select");
      const statusFilter = modalEl.querySelector(".export-status-filter");
      return {
        format: currentFormat,
        rangeType: currentRange,
        month: monthInput?.value || currentYearMonth,
        weekMonth: weekMonthInput?.value || currentYearMonth,
        week: parseInt(weekSelect?.value || "1", 10),
        status: (statusFilter?.value || "").toLowerCase().trim(),
      };
    },
    setLoading: (loading) => {
      const submitBtn = modalEl.querySelector('button[type="submit"]');
      if (!submitBtn) return;
      if (loading) {
        submitBtn.disabled = true;
        submitBtn.dataset.origHtml = submitBtn.innerHTML;
        submitBtn.innerHTML =
          '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Memproses...';
      } else {
        submitBtn.disabled = false;
        if (submitBtn.dataset.origHtml) {
          submitBtn.innerHTML = submitBtn.dataset.origHtml;
        }
      }
    },
    closeModal: () => {
      if (window.bootstrap) {
        const bsModal = bootstrap.Modal.getInstance(modalEl);
        if (bsModal) bsModal.hide();
      }
    },
  };
}

/**
 * Mounts the Database Mapping button exclusively to the sidebar
 * when Users Management is active.
 */
export function mountSidebarUsersManagementErdButton() {
  const sidebarWrapper = document.querySelector("#dg-sidebar-mount .sidebar-scroll-wrapper");
  if (!sidebarWrapper) return;

  // Prevent duplicate mounts
  if (document.getElementById("sidebarBtnUsersManagementErd")) return;

  const linkEl = document.createElement("a");
  linkEl.href = "javascript:void(0)";
  linkEl.className = "sidebar-link";
  linkEl.id = "sidebarBtnUsersManagementErd";
  linkEl.setAttribute("data-bs-toggle", "modal");
  linkEl.setAttribute("data-bs-target", "#usersManagementErdModal");
  linkEl.setAttribute("role", "button");
  linkEl.innerHTML = `
    <i class="bi bi-database text-blue-600"></i>
    <span>Database</span>
    <span class="sidebar-badge">
      <span class="badge bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">ERD</span>
    </span>
  `;

  // Place inside MAIN NAVIGATION right after "My Stuff" (or right before "SYSTEM" category)
  const links = Array.from(sidebarWrapper.querySelectorAll(".sidebar-link"));
  const myStuffLink = links.find((link) => link.textContent.includes("My Stuff"));

  if (myStuffLink) {
    myStuffLink.insertAdjacentElement("afterend", linkEl);
  } else {
    const navCategories = Array.from(sidebarWrapper.querySelectorAll(".nav-category"));
    const systemCategory = navCategories.find((cat) => cat.textContent.trim().toUpperCase() === "SYSTEM");
    if (systemCategory) {
      sidebarWrapper.insertBefore(linkEl, systemCategory);
    } else {
      const logoutBtn = document.getElementById("logoutBtn");
      if (logoutBtn) {
        sidebarWrapper.insertBefore(linkEl, logoutBtn);
      } else {
        sidebarWrapper.appendChild(linkEl);
      }
    }
  }
}

/**
 * Initializes Users Management ERD modal tabs, search, filters, SVG connectors & copy button.
 */
export function initUsersManagementErdModalControls() {
  const modalEl = document.getElementById("usersManagementErdModal");
  if (!modalEl) return;

  // 1. Tab switching
  const tabVisualBtn = document.getElementById("tabBtnUsersManagementErdVisual");
  const tabDictBtn = document.getElementById("tabBtnUsersManagementErdDict");
  const tabSqlBtn = document.getElementById("tabBtnUsersManagementErdSql");

  const tabVisualContent = document.getElementById("usersManagementErdTabVisualContent");
  const tabDictContent = document.getElementById("usersManagementErdTabDictContent");
  const tabSqlContent = document.getElementById("usersManagementErdTabSqlContent");

  const tabBtns = [tabVisualBtn, tabDictBtn, tabSqlBtn];

  function switchTab(targetTab) {
    tabBtns.forEach((btn) => {
      if (!btn) return;
      const t = btn.getAttribute("data-tab");
      btn.classList.toggle("active", t === targetTab);
    });

    if (tabVisualContent) tabVisualContent.style.display = targetTab === "visual" ? "block" : "none";
    if (tabDictContent) tabDictContent.style.display = targetTab === "dictionary" ? "block" : "none";
    if (tabSqlContent) tabSqlContent.style.display = targetTab === "sql" ? "block" : "none";

    if (targetTab === "visual") {
      setTimeout(drawUsersManagementErdRelations, 60);
    }
  }

  tabVisualBtn?.addEventListener("click", () => switchTab("visual"));
  tabDictBtn?.addEventListener("click", () => switchTab("dictionary"));
  tabSqlBtn?.addEventListener("click", () => switchTab("sql"));

  // 2. Kamus Data Search & Filter
  const searchInput = document.getElementById("usersManagementErdDictSearchInput");
  const tableFilter = document.getElementById("usersManagementErdDictTableFilter");
  const dictTableBody = document.getElementById("usersManagementErdDictTableBody");
  const countBadge = document.getElementById("usersManagementErdDictCountBadge");

  function filterDictionaryRows() {
    if (!dictTableBody) return;
    const q = (searchInput?.value || "").toLowerCase().trim();
    const selectedTable = tableFilter?.value || "all";
    const rows = dictTableBody.querySelectorAll("tr");
    let visibleCount = 0;

    rows.forEach((row) => {
      const rowTable = row.getAttribute("data-table");
      const text = row.textContent.toLowerCase();
      const matchTable = selectedTable === "all" || rowTable === selectedTable;
      const matchQuery = !q || text.includes(q);

      if (matchTable && matchQuery) {
        row.style.display = "";
        visibleCount++;
      } else {
        row.style.display = "none";
      }
    });

    if (countBadge) {
      countBadge.textContent = `${visibleCount} Kolom`;
    }
  }

  searchInput?.addEventListener("input", filterDictionaryRows);
  tableFilter?.addEventListener("change", filterDictionaryRows);

  // 3. Copy SQL Script
  const copySqlBtn = document.getElementById("btnCopyUsersManagementSqlScript");
  const copySqlText = document.getElementById("btnCopyUsersManagementSqlText");
  const sqlContent = document.getElementById("usersManagementSqlScriptContent");

  copySqlBtn?.addEventListener("click", () => {
    if (!sqlContent) return;
    const text = sqlContent.textContent;
    navigator.clipboard.writeText(text).then(() => {
      if (copySqlText) {
        const originalText = copySqlText.textContent;
        copySqlText.textContent = "Tersalin!";
        setTimeout(() => {
          copySqlText.textContent = originalText;
        }, 2000);
      }
    }).catch((err) => {
      console.warn("Clipboard copy failed:", err);
    });
  });

  // 4. Copy Docs Path
  const copyDocsBtn = document.getElementById("btnCopyUsersManagementDocsPath");
  copyDocsBtn?.addEventListener("click", () => {
    const docPath = "docs/USERS-DATABASE-MAPPING.md";
    navigator.clipboard.writeText(docPath).then(() => {
      const origHtml = copyDocsBtn.innerHTML;
      copyDocsBtn.innerHTML = '<i class="bi bi-check-circle-fill text-emerald-600"></i> Path Tersalin!';
      setTimeout(() => {
        copyDocsBtn.innerHTML = origHtml;
      }, 2000);
    });
  });

  // 5. Dynamic SVG Bezier Relation Connector Lines
  const wrapper = document.getElementById("usersManagementErdDiagramWrapper");
  const svgGroup = document.getElementById("usersManagementErdPathsGroup");
  const originAnchor = document.getElementById("erdOriginUsersManagementUsersId");

  function getBezierPoint(t, p0, p1, p2, p3) {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;
    return {
      x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
      y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
    };
  }

  const relationConfigs = [
    {
      id: "roles",
      targetAnchor: document.getElementById("erdTargetUsersManagementRolesId"),
      card: document.getElementById("cardUsersManagementRoles"),
      color: "#10b981",
      marker: "url(#usersManagementErdArrowEmerald)",
      label: "1 : N (user_id)",
      y1Offset: -10,
      tBadge: 0.35,
    },
    {
      id: "employment",
      targetAnchor: document.getElementById("erdTargetUsersManagementEmploymentId"),
      card: document.getElementById("cardUsersManagementEmployment"),
      color: "#3b82f6",
      marker: "url(#usersManagementErdArrowBlue)",
      label: "1 : N (user_id)",
      y1Offset: -3,
      tBadge: 0.58,
    },
    {
      id: "logs",
      targetAnchor: document.getElementById("erdTargetUsersManagementLogsId"),
      card: document.getElementById("cardUsersManagementLogs"),
      color: "#f59e0b",
      marker: "url(#usersManagementErdArrowAmber)",
      label: "1 : N (user_id)",
      y1Offset: 4,
      tBadge: 0.42,
    },
    {
      id: "security",
      targetAnchor: document.getElementById("erdTargetUsersManagementSecurityId"),
      card: document.getElementById("cardUsersManagementSecurity"),
      color: "#8b5cf6",
      marker: "url(#usersManagementErdArrowPurple)",
      label: "1 : N (user_id)",
      y1Offset: 11,
      tBadge: 0.65,
    },
  ];

  let currentActiveRel = "all";

  function drawUsersManagementErdRelations() {
    if (!wrapper || !svgGroup || !originAnchor) return;

    const wrapRect = wrapper.getBoundingClientRect();
    if (wrapRect.width === 0 || wrapRect.height === 0) return;

    if (window.innerWidth < 1024) {
      svgGroup.innerHTML = "";
      return;
    }

    const origRect = originAnchor.getBoundingClientRect();

    // Origin point: Right edge center of users.id row
    const x1 = origRect.right - wrapRect.left;
    const y1 = origRect.top + origRect.height / 2 - wrapRect.top;

    let svgHtml = "";

    relationConfigs.forEach((cfg) => {
      if (!cfg.targetAnchor) return;
      const tgtRect = cfg.targetAnchor.getBoundingClientRect();
      if (tgtRect.width === 0) return;

      const isSideBySide = tgtRect.left > origRect.left + 50;
      let d = "";
      let midX = 0;
      let midY = 0;

      if (isSideBySide) {
        // Target: Left edge center of child user_id row
        const x2 = tgtRect.left - wrapRect.left;
        const y2 = tgtRect.top + tgtRect.height / 2 - wrapRect.top;
        const startY = y1 + (cfg.y1Offset || 0);
        const dx = Math.max(40, (x2 - x1) * 0.45);
        d = `M ${x1} ${startY} C ${x1 + dx} ${startY}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

        const p0 = { x: x1, y: startY };
        const p1 = { x: x1 + dx, y: startY };
        const p2 = { x: x2 - dx, y: y2 };
        const p3 = { x: x2, y: y2 };
        const badgePos = getBezierPoint(cfg.tBadge || 0.5, p0, p1, p2, p3);
        midX = badgePos.x;
        midY = badgePos.y;
      } else {
        // Stacked (Mobile view)
        const x1B = origRect.left + origRect.width / 2 - wrapRect.left;
        const y1B = origRect.bottom - wrapRect.top;
        const x2T = tgtRect.left + tgtRect.width / 2 - wrapRect.left;
        const y2T = tgtRect.top - wrapRect.top;
        const dy = Math.max(25, (y2T - y1B) * 0.4);
        d = `M ${x1B} ${y1B} C ${x1B} ${y1B + dy}, ${x2T} ${y2T - dy}, ${x2T} ${y2T}`;
        midX = (x1B + x2T) / 2;
        midY = (y1B + y2T) / 2;
      }

      const isCurrentActive = currentActiveRel === "all" || currentActiveRel === cfg.id;
      const opacity = isCurrentActive ? 1 : 0.12;
      const strokeWidth = isCurrentActive && currentActiveRel !== "all" ? 3 : 2;

      svgHtml += `
        <g class="erd-relation-path-group" data-rel-id="${cfg.id}" style="opacity: ${opacity};">
          <!-- Glow halo -->
          <path d="${d}" stroke="${cfg.color}" stroke-width="7" fill="none" opacity="0.18" stroke-linecap="round" />
          <!-- Animated connecting line -->
          <path d="${d}" stroke="${cfg.color}" stroke-width="${strokeWidth}" fill="none" 
            marker-start="url(#usersManagementErdDotStart)" marker-end="${cfg.marker}" 
            stroke-dasharray="6 3" class="erd-relation-path" />
          <!-- Center badge -->
          <g transform="translate(${midX}, ${midY})">
            <rect x="-34" y="-9" width="68" height="18" rx="6" fill="#ffffff" stroke="${cfg.color}" stroke-width="1.5" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.1))" />
            <text x="0" y="3.5" text-anchor="middle" font-size="9" font-family="'JetBrains Mono', monospace" font-weight="700" fill="${cfg.color}">
              1 : N
            </text>
          </g>
        </g>
      `;
    });

    svgGroup.innerHTML = svgHtml;

    // Attach click to each SVG path group
    svgGroup.querySelectorAll(".erd-relation-path-group").forEach((grp) => {
      grp.addEventListener("click", () => {
        const relId = grp.getAttribute("data-rel-id");
        if (relId) setActiveRelation(relId === currentActiveRel ? "all" : relId);
      });
    });
  }

  function setActiveRelation(relId) {
    currentActiveRel = relId;

    // Update Pills
    document.querySelectorAll(".erd-rel-pill").forEach((pill) => {
      const pRel = pill.getAttribute("data-rel");
      if (pRel === relId) {
        pill.classList.add("active");
      } else {
        pill.classList.remove("active");
      }
    });

    // Update Card Highlight states
    relationConfigs.forEach((cfg) => {
      if (!cfg.card) return;
      if (relId === "all") {
        cfg.card.classList.remove("relation-highlight", "relation-faded");
      } else if (cfg.id === relId) {
        cfg.card.classList.add("relation-highlight");
        cfg.card.classList.remove("relation-faded");
      } else {
        cfg.card.classList.remove("relation-highlight");
        cfg.card.classList.add("relation-faded");
      }
    });

    drawUsersManagementErdRelations();
  }

  // Relation Filter Pills Click
  document.querySelectorAll(".erd-rel-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const rel = pill.getAttribute("data-rel") || "all";
      setActiveRelation(rel);
    });
  });

  // Modal Shown Event Listener
  if (modalEl) {
    modalEl.addEventListener("shown.bs.modal", () => {
      setTimeout(drawUsersManagementErdRelations, 80);
    });
  }

  // Tab switch redraw
  tabVisualBtn?.addEventListener("click", () => {
    setTimeout(drawUsersManagementErdRelations, 80);
  });

  // Window resize redraw (debounced)
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawUsersManagementErdRelations, 100);
  });

  // Initial draw
  setTimeout(drawUsersManagementErdRelations, 300);
}


