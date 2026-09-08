// pages/hr/exit-interview/exit-interview.js
// =====================================================================
// EXIT INTERVIEW ORCHESTRATOR
// Coordinates auth, access control, app shell (topbar/sidebar),
// repository data access, and UI interaction.
// =====================================================================

import { requireAuth } from "../../../assets/js/auth-guard.js";
import { renderTopbar } from "../../../assets/js/components/topbar/topbar.js";
import { renderSidebar } from "../../../assets/js/components/sidebar/sidebar.js";
import * as repo from "./exit-interview.repository.js";
import * as ui from "./exit-interview.ui.js";

// Toggle access restriction (true = enforced, matches legacy)
const ENFORCE_ACCESS_RESTRICTION = true;

// ── State ─────────────────────────────────────────────────────────────
let cachedItems = [];
let unsubscribeListener = null;

// Pagination state (6 cards per page for 3-column grid)
const paginationState = {
  page: 1,
  rowsPerPage: 6,
};

function renderList() {
  ui.renderExitInterviewList(cachedItems, {
    page: paginationState.page,
    rowsPerPage: paginationState.rowsPerPage,
    onPageChange: (newPage) => {
      paginationState.page = newPage;
      renderList();
    },
  });
}

// ── Submission Handler ────────────────────────────────────────────────
async function handleSubmitExitInterview() {
  const contentInput = document.getElementById("exitContentInput");
  const content = contentInput?.value?.trim() || "";

  if (!content) {
    if (window.Swal) {
      window.Swal.fire({
        title: "Peringatan",
        text: "Tulisan tidak boleh kosong.",
        icon: "warning",
      });
    } else {
      alert("Tulisan tidak boleh kosong.");
    }
    return;
  }

  ui.setSubmitButtonLoading(true);

  try {
    await repo.createExitInterview(content);
    ui.closeCreateModal();

    if (window.Swal) {
      window.Swal.fire({
        title: "Terkirim!",
        text: "Exit interview berhasil di-submit secara anonim.",
        icon: "success",
        timer: 2000,
        timerProgressBar: true,
        showConfirmButton: false,
      });
    }
  } catch (err) {
    console.error("Failed to submit exit interview:", err);
    if (window.Swal) {
      window.Swal.fire({
        title: "Gagal",
        text: "Gagal mengirim exit interview: " + err.message,
        icon: "error",
      });
    } else {
      alert("Gagal mengirim exit interview: " + err.message);
    }
  } finally {
    ui.setSubmitButtonLoading(false);
  }
}

// ── Delete Handler ────────────────────────────────────────────────────
function handleConfirmDelete(id) {
  if (window.Swal) {
    window.Swal.fire({
      title: "Hapus Exit Interview?",
      text: "Data yang dihapus tidak bisa dikembalikan.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: "#e7181b",
    }).then(async (result) => {
      if (result.isConfirmed) {
        await executeDelete(id);
      }
    });
  } else if (confirm("Hapus Exit Interview? Data tidak bisa dikembalikan.")) {
    executeDelete(id);
  }
}

async function executeDelete(id) {
  try {
    await repo.deleteExitInterview(id);
    if (window.Swal) {
      window.Swal.fire({
        title: "Terhapus!",
        icon: "success",
        timer: 1500,
        timerProgressBar: true,
        showConfirmButton: false,
      });
    }
  } catch (err) {
    console.error("Failed to delete exit interview:", err);
    if (window.Swal) {
      window.Swal.fire({
        title: "Gagal",
        text: "Gagal menghapus data: " + err.message,
        icon: "error",
      });
    } else {
      alert("Gagal menghapus data: " + err.message);
    }
  }
}

// ── Event Wireup ──────────────────────────────────────────────────────
function wireEventListeners() {
  const btnCreate = document.getElementById("btnCreateExitInterview");
  if (btnCreate) {
    btnCreate.addEventListener("click", () => ui.openCreateModal());
  }

  const exitSaveButton = document.getElementById("exitSaveButton");
  if (exitSaveButton) {
    exitSaveButton.addEventListener("click", handleSubmitExitInterview);
  }

  const contentInput = document.getElementById("exitContentInput");
  const charCount = document.getElementById("exitCharCount");
  if (contentInput && charCount) {
    contentInput.addEventListener("input", () => {
      charCount.textContent = String(contentInput.value.length);
    });
  }

  // Event delegation for delete buttons
  document.addEventListener("click", (e) => {
    const trashIcon = e.target.closest(".exit-delete-icon");
    if (!trashIcon) return;
    const id = trashIcon.getAttribute("data-id");
    if (id) {
      handleConfirmDelete(id);
    }
  });

  window.addEventListener("unload", () => {
    if (unsubscribeListener) unsubscribeListener();
  });
}

// ── Lifecycle Initialization ──────────────────────────────────────────
export async function initialize() {
  try {
    const { user, role } = await requireAuth();

    // Access restriction check
    if (ENFORCE_ACCESS_RESTRICTION) {
      const isAllowed = await repo.checkUserPositionAccess(user?.uid, role);
      if (!isAllowed) {
        const mainContent = document.querySelector(".dg-main");
        if (mainContent) mainContent.innerHTML = "";

        if (window.Swal) {
          window.Swal.fire({
            title: "Akses Ditolak",
            text: "Halaman ini hanya bisa diakses oleh Head of Department Happy Team / People Development",
            icon: "error",
            confirmButtonText: "Kembali",
            allowOutsideClick: false,
          }).then(() => {
            window.location.href = "/home";
          });
        } else {
          alert("Akses Ditolak: Halaman ini hanya bisa diakses oleh Head of Department Happy Team.");
          window.location.href = "/home";
        }
        return;
      }
    }

    renderTopbar({ user, role });
    renderSidebar({ role, activePage: "exit-interview" });

    wireEventListeners();

    ui.showLoadingState();

    // Subscribe to real-time updates from Firestore
    unsubscribeListener = repo.subscribeExitInterviews(
      (items) => {
        cachedItems = items;
        renderList();
      },
      (err) => {
        console.error("Real-time listener error:", err);
        const detail = err?.message || err?.code || String(err);
        ui.showErrorState(`Gagal memuat submission exit interview: ${detail}`);
      },
    );

    console.log("Exit Interview feature initialized successfully");
  } catch (err) {
    console.error("Init exit-interview failed:", err);
    ui.showErrorState("Terjadi kesalahan saat inisialisasi halaman.");
  }
}

// Auto-run if loaded as module
initialize();
