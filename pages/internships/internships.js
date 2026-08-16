// pages/internships/internships.js
// =====================================================================
// INTERNSHIPS ORCHESTRATOR — coordinates auth, shell, repository and UI.
//
// Flow:
//   requireAuth() → renderTopbar/renderSidebar
//       ↓
//   internships.repository.js (data access)
//       ↓
//   internships.ui.js (rendering + events)
//
// Rules:
//  - No Firestore queries here (use internships.repository.js).
//  - No raw DOM rendering of data here (use internships.ui.js).
//  - This file decides WHEN things happen and wires repo → ui.
// =====================================================================

import { requireAuth } from "../../assets/js/auth-guard.js";
import { renderTopbar } from "../../assets/js/components/topbar/topbar.js";
import { renderSidebar } from "../../assets/js/components/sidebar/sidebar.js";
import * as repo from "./internships.repository.js";
import * as ui from "./internships.ui.js";

let internshipsAll = [];
let positionsMap = {};
let departmentsMap = {};
let state = {
  search: "",
  statusFilter: "",
  rowsPerPage: 10,
  page: 1,
};

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

async function initializeInternships() {
  try {
    // 1. Auth boundary.
    const { user, role } = await requireAuth();

    // 2. Shared shell.
    renderTopbar({ user, role });
    renderSidebar({ role, activePage: "internships" });

    // 3. Wire events before first render (delegation handles dynamic rows).
    wireEventHandlers();

    // 4. Load data.
    await loadInternships();

    console.log("Internships initialized");
  } catch (error) {
    console.error("Failed to initialize Internships:", error);
  }
}

/* ------------------------------------------------------------------ */
/* Data loading                                                        */
/* ------------------------------------------------------------------ */

async function loadInternships() {
  ui.showTableLoading();
  try {
    const [positions, departments, interns] = await Promise.all([
      repo.loadPositionsMap(),
      repo.loadDepartmentsMap(),
      repo.listInterns(),
    ]);
    positionsMap = positions;
    departmentsMap = departments;

    // Resolve position key -> label for filtering/display.
    internshipsAll = interns.map((u) => ({
      ...u,
      position: u.positionKey && positionsMap[u.positionKey] ? positionsMap[u.positionKey] : u.positionKey,
    }));

    state.page = 1;
    ui.renderStats(internshipsAll);
    ui.renderTable(internshipsAll, state);
  } catch (error) {
    console.error("Error loading internship users", error);
    ui.notifyError("Gagal memuat data internship.");
  }
}

/* ------------------------------------------------------------------ */
/* Writes (add / edit / delete / promote)                              */
/* ------------------------------------------------------------------ */

async function handleAdd(event) {
  event.preventDefault();
  const form = ui.readAddForm();
  if (!form.name) {
    ui.notifyError("Nama wajib diisi.");
    return;
  }

  const payload = {};
  payload.name = form.name;
  payload.role = "Internship";
  payload.internshipStatus = form.status;

  const startVal = form.startDate ? new Date(form.startDate) : null;
  const endVal = form.endDate ? new Date(form.endDate) : null;
  if (startVal && !isNaN(startVal.getTime())) payload.internshipStartDate = startVal;
  if (endVal && !isNaN(endVal.getTime())) payload.internshipEndDate = endVal;

  const posKey = form.positionKey || "";
  const department = form.department;
  if (posKey) payload.position = posKey;
  if (department) payload.department = department;
  if (posKey || department) {
    payload.employment = {
      position: posKey || null,
      department: department || null,
    };
  }

  if (form.mode) payload.mode = form.mode;
  if (form.address) payload.address = form.address;

  const birthVal = form.birthDate ? new Date(form.birthDate) : null;
  if (birthVal && !isNaN(birthVal.getTime())) payload.birth = birthVal;

  if (form.campus) payload.campus = form.campus;
  if (form.phone) payload.phone = form.phone;
  if (form.email) payload.email = form.email;

  if (form.instagram || form.linkedin) {
    payload.socials = {
      instagram: form.instagram || "",
      linkedin: form.linkedin || "",
    };
  }

  ui.setBusy("internshipAddSubmit", true, "Menyimpan...");
  try {
    await repo.addIntern(payload);
    ui.hideModal("internshipAddModal");
    ui.notifySuccess("Intern berhasil ditambahkan.");
    await loadInternships();
  } catch (e) {
    console.error("Error adding internship user", e);
    ui.notifyError("Gagal menambahkan intern.");
  } finally {
    ui.setBusy("internshipAddSubmit", false);
  }
}

async function handleEdit(event) {
  event.preventDefault();
  const form = ui.readEditForm();
  if (!form.userId) return;

  const updates = {};
  updates.name = form.name;
  updates.internshipStatus = form.status;

  const startVal = form.startDate ? new Date(form.startDate) : null;
  const endVal = form.endDate ? new Date(form.endDate) : null;
  if (startVal && !isNaN(startVal.getTime())) updates.internshipStartDate = startVal;
  else updates.internshipStartDate = null;
  if (endVal && !isNaN(endVal.getTime())) updates.internshipEndDate = endVal;
  else updates.internshipEndDate = null;

  const posKey = form.positionKey || "";
  const department = form.department;
  updates.position = posKey || null;
  updates.department = department || null;
  updates["employment.position"] = posKey || null;
  updates["employment.department"] = department || null;

  updates.mode = form.mode || null;
  updates.address = form.address || null;

  const birthVal = form.birthDate ? new Date(form.birthDate) : null;
  if (birthVal && !isNaN(birthVal.getTime())) updates.birth = birthVal;

  updates.campus = form.campus || null;
  updates.phone = form.phone || null;
  updates.email = form.email || null;
  updates["socials.instagram"] = form.instagram || "";
  updates["socials.linkedin"] = form.linkedin || "";

  ui.setBusy("internshipEditSubmit", true, "Menyimpan...");
  try {
    await repo.updateIntern(form.userId, updates);
    ui.hideModal("internshipEditModal");
    ui.notifySuccess("Data intern berhasil diperbarui.");
    await loadInternships();
  } catch (e) {
    console.error("Error updating internship user", e);
    ui.notifyError("Gagal memperbarui data intern.");
  } finally {
    ui.setBusy("internshipEditSubmit", false);
  }
}

async function handleDelete(userId) {
  const user = internshipsAll.find((u) => u.id === userId);
  const ok = await ui.confirmDelete("Hapus data intern ini dari Intern Management?");
  if (!ok) return;
  try {
    await repo.deleteIntern(userId);
    ui.notifySuccess("Data intern dihapus.");
    await loadInternships();
  } catch (e) {
    console.error("Error deleting internship user", e);
    ui.notifyError("Gagal menghapus data intern.");
  }
}

async function handlePromote(event) {
  event.preventDefault();
  const form = ui.readPromoteForm();
  if (!form.userId || !form.division) {
    ui.notifyError("Pilih divisi tujuan!");
    return;
  }
  const user = internshipsAll.find((u) => u.id === form.userId);
  if (!user) {
    ui.notifyError("Data peserta internship tidak ditemukan.");
    return;
  }

  ui.setBusy("promoteSubmit", true, "Menyimpan...");
  try {
    const created = await repo.promoteToTeam(user, form.division);
    if (!created) {
      ui.notifyError("Peserta internship ini sudah menjadi anggota tim.");
      return;
    }
    ui.hideModal("promoteToTeamModal");
    ui.notifySuccess("Peserta internship berhasil dipromosikan menjadi anggota tim!");
    await loadInternships();
  } catch (error) {
    console.error("Error promoting internship user to team", error);
    ui.notifyError("Gagal mempromosikan peserta internship.");
  } finally {
    ui.setBusy("promoteSubmit", false);
  }
}

/* ------------------------------------------------------------------ */
/* Event wiring                                                        */
/* ------------------------------------------------------------------ */

function wireEventHandlers() {
  const rowsSelect = document.getElementById("internshipRowsPerPage");
  const searchInput = document.getElementById("internshipSearchInput");
  const prevBtn = document.getElementById("internshipPrevPage");
  const nextBtn = document.getElementById("internshipNextPage");
  const editForm = document.getElementById("internshipEditForm");
  const addForm = document.getElementById("internshipAddForm");
  const promoteForm = document.getElementById("promoteToTeamForm");
  const addBtn = document.getElementById("internshipAddBtn");
  const cardTotal = document.getElementById("internshipCardTotal");
  const cardActive = document.getElementById("internshipCardActive");
  const cardOnLeave = document.getElementById("internshipCardOnLeave");
  const cardLeft = document.getElementById("internshipCardLeft");

  if (rowsSelect) {
    rowsSelect.value = String(state.rowsPerPage);
    rowsSelect.addEventListener("change", () => {
      const v = parseInt(rowsSelect.value, 10);
      if (!isNaN(v) && [10, 20, 50, 100].includes(v)) {
        state.rowsPerPage = v;
        state.page = 1;
        ui.renderTable(internshipsAll, state);
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      state.search = searchInput.value || "";
      state.page = 1;
      ui.renderTable(internshipsAll, state);
    });
  }

  function setStatusFilter(value) {
    state.statusFilter = value || "";
    state.page = 1;
    ui.renderTable(internshipsAll, state);
  }

  if (cardTotal) {
    cardTotal.style.cursor = "pointer";
    cardTotal.addEventListener("click", () => setStatusFilter(""));
  }
  if (cardActive) {
    cardActive.style.cursor = "pointer";
    cardActive.addEventListener("click", () => setStatusFilter("Active"));
  }
  if (cardOnLeave) {
    cardOnLeave.style.cursor = "pointer";
    cardOnLeave.addEventListener("click", () => setStatusFilter("On Leave"));
  }
  if (cardLeft) {
    cardLeft.style.cursor = "pointer";
    cardLeft.addEventListener("click", () => setStatusFilter("Left"));
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (state.page > 1) {
        state.page -= 1;
        ui.renderTable(internshipsAll, state);
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      const perPage = state.rowsPerPage;
      const totalPages = Math.max(1, Math.ceil(internshipsAll.length / perPage));
      if (state.page < totalPages) {
        state.page += 1;
        ui.renderTable(internshipsAll, state);
      }
    });
  }

  if (editForm) editForm.addEventListener("submit", handleEdit);
  if (addForm) addForm.addEventListener("submit", handleAdd);
  if (promoteForm) promoteForm.addEventListener("submit", handlePromote);

  if (addBtn) {
    addBtn.addEventListener("click", () => ui.openAddModal(positionsMap, departmentsMap));
  }

  // Delegated row actions (edit / delete / promote).
  document.addEventListener("click", async (e) => {
    const editBtn = e.target.closest(".internship-edit-btn");
    const deleteBtn = e.target.closest(".internship-delete-btn");
    const promoteBtn = e.target.closest(".internship-promote-btn");

    if (promoteBtn) {
      const userId = promoteBtn.getAttribute("data-user-id");
      if (userId) ui.openPromoteModal(userId);
      return;
    }
    if (editBtn) {
      const userId = editBtn.getAttribute("data-user-id");
      const user = internshipsAll.find((u) => u.id === userId);
      if (user) ui.openEditModal(user, positionsMap, departmentsMap);
      return;
    }
    if (deleteBtn) {
      const userId = deleteBtn.getAttribute("data-user-id");
      if (userId) await handleDelete(userId);
    }
  });
}

// Boot on DOM ready.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeInternships);
} else {
  initializeInternships();
}