// pages/hr/company-position/company-position.ui.js
// =====================================================================
// COMPANY POSITION UI MODULE
// Handles DOM rendering, grid/list presentation, expandable descriptions,
// modal lifecycle, and form population.
// Pure UI module: NO direct Firestore queries.
// =====================================================================

export const COLOR_PALETTE = [
  "linear-gradient(135deg, #667eea, #764ba2)", // Indigo / Purple (RS)
  "linear-gradient(135deg, #ff9a9e, #fecfef)", // Rose / Pink (PD)
  "linear-gradient(135deg, #38f9d7, #43e97b)", // Mint / Green (PM)
  "linear-gradient(135deg, #fa709a, #fee140)", // Coral / Gold (CE)
  "linear-gradient(135deg, #6a11cb, #2575fc)", // Deep Blue / Violet (AM)
  "linear-gradient(135deg, #f093fb, #f5576c)", // Pink / Crimson (AK)
  "linear-gradient(135deg, #5ee7df, #b490ca)", // Teal / Lavender (DH)
  "linear-gradient(135deg, #475569, #64748b)", // Slate / Charcoal (CC)
  "linear-gradient(135deg, #f6d365, #fda085)", // Warm Amber / Orange (BT)
  "linear-gradient(135deg, #a1c4fd, #c2e9fb)", // Sky Blue
  "linear-gradient(135deg, #d4fc79, #96e6a1)", // Lime
  "linear-gradient(135deg, #84fab0, #8fd3f4)", // Ocean
];

const DEFAULT_DEPT_COLORS = {
  happy: "#f59e0b",
  closing: "#10b981",
  team: "#8b5cf6",
  branding: "#3b82f6",
  rebuy: "#ef4444",
};

/**
 * Get background color for a department badge.
 * @param {string} deptKey
 * @param {Object} colorMap
 * @returns {string}
 */
export function getDepartmentColor(deptKey, colorMap = {}) {
  if (!deptKey) return "#94a3b8";
  if (colorMap[deptKey]) return colorMap[deptKey];
  const normalized = deptKey.toLowerCase().trim();
  return DEFAULT_DEPT_COLORS[normalized] || "#6366f1";
}

/**
 * Render position cards into Grid container.
 * @param {Array} items
 * @param {Object} deptLabelMap
 * @param {Object} deptColorMap
 * @param {Object} handlers - { onEdit: (id) => void, onDelete: (id) => void }
 */
export function renderPositionsGrid(items, deptLabelMap = {}, deptColorMap = {}, handlers = {}) {
  const grid = document.getElementById("positionsGrid");
  if (!grid) return;

  if (!items || items.length === 0) {
    grid.innerHTML = `
      <div class="col-12 text-center py-5 text-slate-400">
        <i class="fas fa-briefcase text-4xl mb-3 block opacity-50"></i>
        <p class="text-sm font-medium">No company positions found.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = items
    .map((item, index) => {
      const color = COLOR_PALETTE[index % COLOR_PALETTE.length];
      const deptLabel = deptLabelMap[item.department] || item.department || "";
      const deptColor = getDepartmentColor(item.department, deptColorMap);

      const deptBadge = deptLabel
        ? `<span class="badge rounded-pill text-white font-bold text-[10px] px-2.5 py-1" style="background-color: ${deptColor};">
            ${deptLabel.toUpperCase()}
           </span>`
        : "";

      const jobdeskText = item.jobdesk || "No description provided.";
      const isLongText = jobdeskText.length > 80 || jobdeskText.includes("\n");

      return `
        <div class="col-xl-4 col-lg-4 col-md-6">
          <div class="candidate-card">
            <!-- Card Header -->
            <div class="d-flex align-items-center gap-3 mb-3">
              <div class="avatar-box" style="background: ${color}">
                ${item.initials}
              </div>
              <div class="min-w-0 flex-grow-1">
                <h3 class="role-title text-truncate mb-0">${item.name}</h3>
                <span class="head-count-tag">Head Count: ${item.headCount}</span>
              </div>
            </div>

            <!-- Job Description Preview -->
            <div class="jobdesk-wrapper">
              <div class="jobdesk-text">${jobdeskText}</div>
              ${
                isLongText
                  ? `<a href="javascript:void(0)" class="toggle-jobdesk">Show more</a>`
                  : ""
              }
            </div>

            <!-- Metrics Info Group -->
            <div class="info-group">
              <div class="info-item">
                <span class="info-label">Active</span>
                <span class="info-value">${item.activeCount} person</span>
              </div>
              <div class="info-item">
                <span class="info-label">Applicant</span>
                <span class="info-value">${item.applicantCount} person</span>
              </div>
            </div>

            <!-- Card Footer -->
            <div class="d-flex justify-content-between align-items-center mt-3 pt-2">
              <div class="d-flex flex-column align-items-start gap-1">
                ${deptBadge}
                <span class="status-pill ${item.statusClass}">
                  ${item.status}
                </span>
              </div>
              <div class="dropdown card-action-dropdown">
                <button
                  class="card-action-btn dropdown-toggle"
                  type="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                  title="Actions"
                >
                  <i class="fas fa-ellipsis-v"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-end shadow-sm border-0 rounded-3">
                  <li>
                    <button class="dropdown-item edit-pos-btn py-2 text-sm" type="button" data-id="${item.id}">
                      <i class="fas fa-pen text-slate-400 mr-2 text-xs"></i> Edit
                    </button>
                  </li>
                  <li>
                    <button class="dropdown-item delete-pos-btn py-2 text-sm text-red-600 hover:text-red-700" type="button" data-id="${item.id}">
                      <i class="fas fa-trash mr-2 text-xs"></i> Delete
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  attachCardEvents(grid, handlers);
}

/**
 * Render position rows into List table container.
 * @param {Array} items
 * @param {Object} deptLabelMap
 * @param {Object} handlers - { onEdit: (id) => void, onDelete: (id) => void }
 */
export function renderPositionsList(items, deptLabelMap = {}, handlers = {}) {
  const tbody = document.getElementById("positionsTableBody");
  if (!tbody) return;

  if (!items || items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-5 text-slate-400">
          No company positions found.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items
    .map((item) => {
      const deptLabel = deptLabelMap[item.department] || item.department || "-";
      return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-xs">
          <td class="px-4 py-3 font-semibold text-slate-800">${item.name}</td>
          <td class="px-3 py-3 text-center">${item.headCount}</td>
          <td class="px-4 py-3 text-slate-600 max-w-[200px]">
            <div class="jobdesk-text text-truncate" style="max-width: 200px;">${item.jobdesk || "-"}</div>
            ${
              item.jobdesk && item.jobdesk.length > 30
                ? `<a href="javascript:void(0)" class="toggle-jobdesk text-blue-500 font-semibold text-[11px]">Show more</a>`
                : ""
            }
          </td>
          <td class="px-3 py-3 text-center">
            <span class="status-pill ${item.statusClass}">
              ${item.status}
            </span>
          </td>
          <td class="px-3 py-3 text-center font-medium">${item.activeCount}</td>
          <td class="px-3 py-3 text-center font-medium">${item.applicantCount}</td>
          <td class="px-4 py-3 text-slate-600">${deptLabel}</td>
          <td class="px-4 py-3 text-end whitespace-nowrap">
            <button type="button" class="btn btn-sm btn-outline-secondary edit-pos-btn me-1 px-2 py-1" data-id="${item.id}" title="Edit">
              <i class="fas fa-edit"></i>
            </button>
            <button type="button" class="btn btn-sm btn-outline-danger delete-pos-btn px-2 py-1" data-id="${item.id}" title="Delete">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  attachTableEvents(tbody, handlers);
}

/**
 * Attach delegated events to grid elements (expand text, edit, delete).
 */
function attachCardEvents(container, handlers) {
  container.querySelectorAll(".toggle-jobdesk").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const textEl = btn.previousElementSibling;
      if (!textEl) return;
      const isExpanded = textEl.classList.toggle("expanded");
      btn.textContent = isExpanded ? "Show less" : "Show more";
    });
  });

  container.querySelectorAll(".edit-pos-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      if (handlers.onEdit) handlers.onEdit(id);
    });
  });

  container.querySelectorAll(".delete-pos-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      if (handlers.onDelete) handlers.onDelete(id);
    });
  });
}

/**
 * Attach events to table list elements.
 */
function attachTableEvents(tbody, handlers) {
  tbody.querySelectorAll(".toggle-jobdesk").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const textEl = btn.previousElementSibling;
      if (!textEl) return;
      const isTruncated = textEl.classList.toggle("text-truncate");
      btn.textContent = isTruncated ? "Show more" : "Show less";
    });
  });

  tbody.querySelectorAll(".edit-pos-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      if (handlers.onEdit) handlers.onEdit(id);
    });
  });

  tbody.querySelectorAll(".delete-pos-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      if (handlers.onDelete) handlers.onDelete(id);
    });
  });
}

/**
 * Populate department options in Select elements.
 * @param {HTMLSelectElement} selectEl
 * @param {Object} deptLabelMap
 * @param {string} [selectedValue]
 */
export function populateDepartmentSelect(selectEl, deptLabelMap = {}, selectedValue = "") {
  if (!selectEl) return;
  selectEl.innerHTML = '<option value="">Select department</option>';
  Object.keys(deptLabelMap).forEach((key) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = deptLabelMap[key];
    if (selectedValue && (selectedValue === key || selectedValue === deptLabelMap[key])) {
      opt.selected = true;
    }
    selectEl.appendChild(opt);
  });
}

/**
 * Populate department filter dropdown in Filter Bar.
 * @param {HTMLSelectElement} selectEl
 * @param {Object} deptLabelMap
 */
export function populateDepartmentFilter(selectEl, deptLabelMap = {}) {
  if (!selectEl) return;
  selectEl.innerHTML = '<option value="All">All Department</option>';
  Object.keys(deptLabelMap).forEach((key) => {
    const opt = document.createElement("option");
    opt.value = deptLabelMap[key];
    opt.textContent = deptLabelMap[key];
    selectEl.appendChild(opt);
  });
}

/**
 * Form helpers for Add Position Modal.
 */
export function resetAddPositionForm() {
  const el = (id) => document.getElementById(id);
  if (el("positionAddName")) el("positionAddName").value = "";
  if (el("positionAddDepartment")) el("positionAddDepartment").value = "";
  if (el("positionAddHeadCount")) el("positionAddHeadCount").value = "0";
  if (el("positionAddActive")) el("positionAddActive").value = "0";
  if (el("positionAddApplicant")) el("positionAddApplicant").value = "0";
  if (el("positionAddJobdesk")) el("positionAddJobdesk").value = "";
  if (el("positionAddStatus")) el("positionAddStatus").value = "Open";
}

export function getAddPositionFormData() {
  const el = (id) => document.getElementById(id);
  return {
    name: el("positionAddName")?.value.trim() || "",
    department: el("positionAddDepartment")?.value || "",
    headCount: parseInt(el("positionAddHeadCount")?.value || 0, 10),
    activeCount: parseInt(el("positionAddActive")?.value || 0, 10),
    applicantCount: parseInt(el("positionAddApplicant")?.value || 0, 10),
    jobdesk: el("positionAddJobdesk")?.value.trim() || "",
    status: el("positionAddStatus")?.value || "Open",
  };
}

/**
 * Form helpers for Edit Position Modal.
 */
export function populateEditPositionForm(item, deptLabelMap = {}) {
  const el = (id) => document.getElementById(id);
  if (el("positionEditId")) el("positionEditId").value = item.id;
  if (el("positionEditName")) el("positionEditName").value = item.name || "";
  if (el("positionEditHeadCount")) el("positionEditHeadCount").value = item.headCount ?? 0;
  if (el("positionEditActive")) el("positionEditActive").value = item.activeCount ?? 0;
  if (el("positionEditApplicant")) el("positionEditApplicant").value = item.applicantCount ?? 0;
  if (el("positionEditJobdesk")) el("positionEditJobdesk").value = item.jobdesk || "";
  if (el("positionEditStatus")) el("positionEditStatus").value = item.status || "Open";

  const deptSelect = el("positionEditDepartment");
  if (deptSelect) {
    populateDepartmentSelect(deptSelect, deptLabelMap, item.department);
  }
}

export function getEditPositionFormData() {
  const el = (id) => document.getElementById(id);
  return {
    id: el("positionEditId")?.value || "",
    name: el("positionEditName")?.value.trim() || "",
    department: el("positionEditDepartment")?.value || "",
    headCount: parseInt(el("positionEditHeadCount")?.value || 0, 10),
    activeCount: parseInt(el("positionEditActive")?.value || 0, 10),
    applicantCount: parseInt(el("positionEditApplicant")?.value || 0, 10),
    jobdesk: el("positionEditJobdesk")?.value.trim() || "",
    status: el("positionEditStatus")?.value || "Open",
  };
}
