// pages/announcement/announcement.ui.js
// =====================================================================
// ANNOUNCEMENT UI — pure rendering & DOM interaction for Announcement.
//
// RULES:
//  - NO Firebase imports here.
//  - NO direct database operations here.
//  - All DOM queries and updates live here.
// =====================================================================

let currentSelectedType = "info";

/**
 * Populate department options in the target select dropdown.
 * @param {Array<{id: string, name: string}>} departments
 */
export function populateDepartmentOptions(departments = []) {
  const select = document.getElementById("announcementTargetSelect");
  if (!select) return;

  // Keep first option ("All Employees")
  select.innerHTML = '<option value="">All Employees</option>';

  departments.forEach((dep) => {
    const opt = document.createElement("option");
    opt.value = dep.id;
    opt.textContent = dep.name;
    select.appendChild(opt);
  });
}

/**
 * Convert Firestore timestamp or Date to formatted locale string.
 * @param {any} ts
 * @returns {string}
 */
export function formatTimestamp(ts) {
  if (!ts) return "-";
  if (typeof ts.toDate === "function") {
    return ts.toDate().toLocaleString("id-ID");
  }
  if (ts instanceof Date) {
    return ts.toLocaleString("id-ID");
  }
  if (typeof ts === "number") {
    return new Date(ts).toLocaleString("id-ID");
  }
  return String(ts);
}

/**
 * Render the announcements list based on current filters and sorting.
 * @param {Array<Object>} allAnnouncements
 * @param {{ onEdit: (id: string) => void, onDelete: (id: string, title: string) => void }} actions
 */
export function renderAnnouncementList(allAnnouncements = [], { onEdit, onDelete }) {
  const container = document.getElementById("announcementList");
  if (!container) return;

  const typeFilter = document.getElementById("filterTypeSelect")?.value || "all";
  const statusFilter = document.getElementById("filterStatusSelect")?.value || "active";

  let items = [...allAnnouncements];

  if (typeFilter !== "all") {
    items = items.filter((a) => (a.type || "info") === typeFilter);
  }

  if (statusFilter !== "all") {
    const wantActive = statusFilter === "active";
    items = items.filter((a) => (a.active !== undefined ? !!a.active : true) === wantActive);
  }

  // Sort pinned first, then newest created_at
  items.sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    const aTime = a.created_at?.toDate ? a.created_at.toDate().getTime() : 0;
    const bTime = b.created_at?.toDate ? b.created_at.toDate().getTime() : 0;
    return bTime - aTime;
  });

  container.innerHTML = "";

  if (items.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center text-muted py-5">
        <i class="bi bi-bell-slash fs-1 d-block mb-2 text-secondary opacity-50"></i>
        Belum ada announcement.
      </div>`;
    return;
  }

  items.forEach((a) => {
    const type = a.type || "info";
    const createdAt = formatTimestamp(a.created_at);
    const targetLabel = a.target_department_name || "All Employees";
    const isActive = a.active !== undefined ? !!a.active : true;

    // Strip HTML for content preview
    const tmp = document.createElement("div");
    tmp.innerHTML = a.content || "";
    const plainText = (tmp.textContent || "").trim();

    const col = document.createElement("div");
    col.className = "col-md-6 col-lg-4";
    col.innerHTML = `
      <div class="announcement-card type-${type} p-3">
        <div class="type-strip"></div>
        <div class="ps-2 d-flex flex-column h-100">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <span class="type-badge">${type}</span>
            <div class="d-flex align-items-center gap-2 announcement-actions">
              ${a.pinned ? '<i class="bi bi-pin-angle-fill text-primary" title="Pinned"></i>' : ""}
              <i class="bi bi-pencil-square text-secondary" data-action="edit" data-id="${a.id}" title="Edit"></i>
              <i class="bi bi-trash3 text-danger" data-action="delete" data-id="${a.id}" title="Delete"></i>
            </div>
          </div>
          <h6 class="fw-bold mb-1 announcement-title">${escapeHtml(a.title || "Untitled")}</h6>
          <p class="announcement-content-preview mb-3 flex-grow-1">${escapeHtml(plainText || "No content.")}</p>
          <div class="d-flex justify-content-between align-items-center small announcement-footer pt-2">
            <span class="announcement-target-label"><i class="bi bi-people me-1"></i>${escapeHtml(targetLabel)}</span>
            <span class="badge ${isActive ? "badge-status-active" : "badge-status-inactive"}">
              ${isActive ? "Active" : "Inactive"}
            </span>
          </div>
          <div class="announcement-time-label mt-2">
            <i class="bi bi-clock me-1"></i>${createdAt}
          </div>
        </div>
      </div>
    `;

    // Wire action clicks
    const editBtn = col.querySelector('[data-action="edit"]');
    if (editBtn) {
      editBtn.addEventListener("click", () => onEdit(a.id));
    }

    const deleteBtn = col.querySelector('[data-action="delete"]');
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => onDelete(a.id, a.title || "Untitled"));
    }

    container.appendChild(col);
  });
}

/**
 * Render loading state.
 */
export function renderLoadingState() {
  const container = document.getElementById("announcementList");
  if (!container) return;
  container.innerHTML = `
    <div class="col-12 text-center text-muted py-5">
      <div class="spinner-border text-primary mb-3" role="status" style="width: 2rem; height: 2rem;"></div>
      <div>Loading announcements...</div>
    </div>`;
}

/**
 * Render error state.
 * @param {string} msg
 */
export function renderErrorState(msg = "Failed to load announcements.") {
  const container = document.getElementById("announcementList");
  if (!container) return;
  container.innerHTML = `
    <div class="col-12 text-center text-danger py-5">
      <i class="bi bi-exclamation-triangle fs-1 d-block mb-2"></i>
      <div>${escapeHtml(msg)}</div>
    </div>`;
}

/**
 * Select active announcement type pill in modal.
 * @param {string} type
 */
export function selectAnnouncementType(type = "info") {
  currentSelectedType = type;
  const input = document.getElementById("announcementTypeInput");
  if (input) input.value = type;

  document.querySelectorAll(".type-pill").forEach((pill) => {
    pill.classList.remove("active-pill");
    if (pill.getAttribute("data-type") === type) {
      pill.classList.add("active-pill");
    }
  });
}

/**
 * Apply rich text formatting command (bold, italic, list).
 * @param {string} command
 */
export function applyRichFormat(command) {
  const editor = document.getElementById("announcementContentInput");
  if (!editor) return;
  editor.focus();
  document.execCommand(command, false, null);
}

/**
 * Open create announcement modal.
 */
export function openCreateModal() {
  const titleEl = document.getElementById("announcementModalTitle");
  if (titleEl) titleEl.innerText = "Create Announcement";

  document.getElementById("announcementId").value = "";
  document.getElementById("announcementTitleInput").value = "";
  document.getElementById("announcementContentInput").innerHTML = "";
  document.getElementById("announcementTargetSelect").value = "";
  document.getElementById("announcementPinnedInput").checked = false;
  document.getElementById("announcementActiveInput").checked = true;

  selectAnnouncementType("info");

  const modalEl = document.getElementById("announcementModal");
  if (modalEl && window.bootstrap) {
    const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

/**
 * Open edit announcement modal.
 * @param {Object} data
 */
export function openEditModal(data) {
  if (!data) return;

  const titleEl = document.getElementById("announcementModalTitle");
  if (titleEl) titleEl.innerText = "Edit Announcement";

  document.getElementById("announcementId").value = data.id || "";
  document.getElementById("announcementTitleInput").value = data.title || "";
  document.getElementById("announcementContentInput").innerHTML = data.content || "";
  document.getElementById("announcementTargetSelect").value = data.target_department || "";
  document.getElementById("announcementPinnedInput").checked = !!data.pinned;
  document.getElementById("announcementActiveInput").checked =
    data.active !== undefined ? !!data.active : true;

  selectAnnouncementType(data.type || "info");

  const modalEl = document.getElementById("announcementModal");
  if (modalEl && window.bootstrap) {
    const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

/**
 * Close create/edit modal.
 */
export function closeAnnouncementModal() {
  const modalEl = document.getElementById("announcementModal");
  if (modalEl && window.bootstrap) {
    const modal = window.bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
  }
}

/**
 * Open delete confirmation modal.
 * @param {string} id
 * @param {string} title
 */
export function openDeleteModal(id, title) {
  document.getElementById("deleteAnnouncementId").value = id;
  document.getElementById("deleteAnnouncementTitle").innerText = title || "";

  const modalEl = document.getElementById("deleteAnnouncementModal");
  if (modalEl && window.bootstrap) {
    const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

/**
 * Close delete confirmation modal.
 */
export function closeDeleteModal() {
  const modalEl = document.getElementById("deleteAnnouncementModal");
  if (modalEl && window.bootstrap) {
    const modal = window.bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
  }
}

/**
 * Read form data from Create/Edit modal.
 * @returns {{ id: string, title: string, content: string, type: string, target_department: string, target_department_name: string, pinned: boolean, active: boolean }}
 */
export function getAnnouncementFormData() {
  const id = document.getElementById("announcementId")?.value || "";
  const title = (document.getElementById("announcementTitleInput")?.value || "").trim();
  const content = (document.getElementById("announcementContentInput")?.innerHTML || "").trim();
  const targetDeptSelect = document.getElementById("announcementTargetSelect");
  const targetDeptId = targetDeptSelect?.value || "";
  const targetDeptName =
    targetDeptId && targetDeptSelect?.selectedOptions?.length
      ? targetDeptSelect.selectedOptions[0].textContent
      : "";
  const pinned = document.getElementById("announcementPinnedInput")?.checked || false;
  const active = document.getElementById("announcementActiveInput")?.checked || false;
  const type = document.getElementById("announcementTypeInput")?.value || currentSelectedType || "info";

  return {
    id,
    title,
    content,
    type,
    target_department: targetDeptId,
    target_department_name: targetDeptName,
    pinned,
    active,
  };
}

/**
 * Toggle saving state on the save button.
 * @param {boolean} isSaving
 */
export function setSavingState(isSaving) {
  const btn = document.getElementById("announcementSaveButton");
  if (!btn) return;
  btn.disabled = isSaving;
  btn.innerHTML = isSaving
    ? '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Saving...'
    : "Save";
}

/**
 * Helper to escape HTML characters.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
