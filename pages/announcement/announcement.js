// pages/announcement/announcement.js
// =====================================================================
// ANNOUNCEMENT ORCHESTRATOR — coordinates auth, shell, repository and UI.
//
// Flow:
//   requireAuth() → renderTopbar/renderSidebar (activePage: "announcement")
//       ↓
//   announcement.repository.js (data access & realtime sync)
//       ↓
//   announcement.ui.js (rendering & modal handling)
//
// Rules:
//  - No Firestore queries here (use announcement.repository.js).
//  - No raw DOM rendering here (use announcement.ui.js).
//  - Coordinates lifecycle, user events, and SweetAlert notifications.
// =====================================================================

import { requireAuth } from "/assets/js/auth-guard.js";
import { renderTopbar } from "/assets/js/components/topbar/topbar.js";
import { renderSidebar } from "/assets/js/components/sidebar/sidebar.js";
import * as repo from "./announcement.repository.js";
import * as ui from "./announcement.ui.js";

let currentUser = null;
let currentRole = null;
let allAnnouncements = [];
let departmentsList = [];
let unsubscribeAnnouncements = null;

/**
 * Main initialization entry point.
 */
async function initializeAnnouncement() {
  try {
    // 1. Auth Guard Boundary
    const authState = await requireAuth();
    if (!authState) return;

    currentUser = authState.user;
    currentRole = authState.role;

    // 2. Mount App Shell Components
    renderTopbar({ user: currentUser, role: currentRole });
    renderSidebar({ role: currentRole, activePage: "announcement" });

    // 3. Render Loading State & Fetch Departments
    ui.renderLoadingState();
    departmentsList = await repo.fetchDepartments();
    ui.populateDepartmentOptions(departmentsList);

    // 4. Bind Form, Filters, and Action Events
    bindEventHandlers();

    // 5. Subscribe to Realtime Announcements
    listenToAnnouncements();

    console.log("Announcement feature successfully initialized.");
  } catch (error) {
    console.error("Failed to initialize Announcement page:", error);
    ui.renderErrorState(error.message || "Failed to load announcements.");
  }
}

/**
 * Realtime subscription handler.
 */
function listenToAnnouncements() {
  if (unsubscribeAnnouncements) {
    unsubscribeAnnouncements();
  }

  unsubscribeAnnouncements = repo.subscribeAnnouncements(
    (items) => {
      allAnnouncements = items;
      renderCurrentList();
    },
    (error) => {
      ui.renderErrorState(error.message || "Failed to load announcements.");
    }
  );
}

/**
 * Re-render list with current filters.
 */
function renderCurrentList() {
  ui.renderAnnouncementList(allAnnouncements, {
    onEdit: handleEditAnnouncement,
    onDelete: handleDeleteAnnouncement,
  });
}

/**
 * Handle opening the edit modal.
 * @param {string} id
 */
function handleEditAnnouncement(id) {
  const item = allAnnouncements.find((a) => a.id === id);
  if (!item) return;
  ui.openEditModal(item);
}

/**
 * Handle opening the delete confirmation modal.
 * @param {string} id
 * @param {string} title
 */
function handleDeleteAnnouncement(id, title) {
  ui.openDeleteModal(id, title);
}

/**
 * Save announcement action (Create or Update).
 */
async function handleSaveAnnouncement() {
  const formData = ui.getAnnouncementFormData();

  if (!formData.title) {
    if (window.Swal) {
      window.Swal.fire({
        title: "Peringatan",
        text: "Judul announcement wajib diisi.",
        icon: "warning",
      });
    } else {
      alert("Judul announcement wajib diisi.");
    }
    return;
  }

  ui.setSavingState(true);

  try {
    await repo.saveAnnouncementDoc(formData.id, formData, currentUser);
    ui.closeAnnouncementModal();

    if (window.Swal) {
      window.Swal.fire({
        title: "Berhasil!",
        text: "Announcement berhasil disimpan.",
        icon: "success",
        timer: 2000,
        timerProgressBar: true,
      });
    }
  } catch (e) {
    console.error("Failed to save announcement:", e);
    if (window.Swal) {
      window.Swal.fire({
        title: "Gagal",
        text: "Gagal menyimpan announcement: " + e.message,
        icon: "error",
      });
    } else {
      alert("Gagal menyimpan announcement: " + e.message);
    }
  } finally {
    ui.setSavingState(false);
  }
}

/**
 * Confirm delete announcement action.
 */
async function handleConfirmDelete() {
  const id = document.getElementById("deleteAnnouncementId")?.value;
  if (!id) return;

  const itemData = allAnnouncements.find((a) => a.id === id);

  try {
    await repo.deleteAnnouncementDoc(id, itemData, currentUser);
    ui.closeDeleteModal();

    if (window.Swal) {
      window.Swal.fire({
        title: "Terhapus!",
        text: "Announcement berhasil dihapus.",
        icon: "success",
        timer: 2000,
        timerProgressBar: true,
      });
    }
  } catch (e) {
    console.error("Failed to delete announcement:", e);
    if (window.Swal) {
      window.Swal.fire({
        title: "Gagal",
        text: "Gagal menghapus: " + e.message,
        icon: "error",
      });
    } else {
      alert("Gagal menghapus: " + e.message);
    }
  }
}

/**
 * Wire all interactive DOM event handlers.
 */
function bindEventHandlers() {
  // 1. Create Announcement Button
  const createBtn = document.getElementById("btnCreateAnnouncement");
  if (createBtn) {
    createBtn.addEventListener("click", () => ui.openCreateModal());
  }

  // 2. Filter Dropdowns
  const filterType = document.getElementById("filterTypeSelect");
  if (filterType) {
    filterType.addEventListener("change", () => renderCurrentList());
  }

  const filterStatus = document.getElementById("filterStatusSelect");
  if (filterStatus) {
    filterStatus.addEventListener("change", () => renderCurrentList());
  }

  // 3. Type Pills in Modal
  document.querySelectorAll(".type-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const type = pill.getAttribute("data-type") || "info";
      ui.selectAnnouncementType(type);
    });
  });

  // 4. Rich text editor buttons
  document.querySelectorAll("[data-editor-cmd]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cmd = btn.getAttribute("data-editor-cmd");
      if (cmd) ui.applyRichFormat(cmd);
    });
  });

  // 5. Save Button
  const saveBtn = document.getElementById("announcementSaveButton");
  if (saveBtn) {
    saveBtn.addEventListener("click", handleSaveAnnouncement);
  }

  // 6. Delete Confirm Button
  const confirmDeleteBtn = document.getElementById("btnConfirmDeleteAnnouncement");
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", handleConfirmDelete);
  }

  // 7. Cleanup listener on unload
  window.addEventListener("unload", () => {
    if (unsubscribeAnnouncements) {
      unsubscribeAnnouncements();
    }
  });
}

// Start Orchestration on DOM Ready
document.addEventListener("DOMContentLoaded", initializeAnnouncement);
