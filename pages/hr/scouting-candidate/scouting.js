// pilot/pages/hr/scouting-candidate/scouting.js
// =====================================================================
// ORCHESTRATOR: Scouting Candidate
//
// Responsibilities:
// - Feature lifecycle & authentication guard
// - Mounting Shell Topbar, Sidebar, and Floating Rightbar
// - State management for talents, users map, filter, sort, and view mode
// - Event orchestration for CRUD, status changes, image upload, and Excel export
// =====================================================================

import { requireAuth } from "../../../assets/js/auth-guard.js";
import { renderTopbar } from "../../../assets/js/components/topbar/topbar.js";
import { renderSidebar } from "../../../assets/js/components/sidebar/sidebar.js";
import { renderRightbarRecruit } from "../../../element/rightbar-recruit.js";

import * as ScoutingRepo from "./scouting.repository.js";
import * as ScoutingUI from "./scouting.ui.js";

const state = {
  talents: [],
  assignUsersMap: {},
  roles: [],
  positions: [],
  currentEditingTalentId: null,
  currentAvatarUrl: null,
  pendingCompressedPhoto: null,
  pendingCompressedFileName: null,
  currentView: "grid",
  filterState: {
    search: "",
    status: "all",
    sort: "newest",
  },
  pagination: {
    page: 1,
    pageSize: 6,
  },
  modalInstance: null,
};

/**
 * Filter and sort talents based on active state.
 * @returns {Array<Object>}
 */
function getFilteredTalents() {
  let result = state.talents.slice();

  // Filter out records without radar in history (matching legacy logic)
  result = result.filter((t) => {
    const recruitment = t.recruitment_status || {};
    const history = Array.isArray(recruitment.history)
      ? recruitment.history
      : [];
    return history.some((item) => {
      const status = item?.status ? item.status.toString().toLowerCase() : "";
      return status === "radar";
    });
  });

  // 1. Search filter
  const term = state.filterState.search.toLowerCase().trim();
  if (term) {
    result = result.filter((t) => {
      const basic = t.basic_info || {};
      const scouting = t.scouting_info || {};
      const name = (basic.full_name || scouting.full_name || "").toLowerCase();
      const role = (basic.current_role || scouting.role_name || "").toLowerCase();
      const pos = (scouting.position_name || "").toLowerCase();
      return name.includes(term) || role.includes(term) || pos.includes(term);
    });
  }

  // 2. Status filter
  const statusFilter = state.filterState.status.toLowerCase();
  if (statusFilter !== "all" && statusFilter !== "") {
    result = result.filter((t) => {
      const recruitment = t.recruitment_status || {};
      const current = (recruitment.current || "radar").toLowerCase();
      const mapped = ScoutingUI.mapToFilterStatus(current);
      return mapped === statusFilter;
    });
  }

  // 3. Sorting
  const sort = state.filterState.sort;
  result.sort((a, b) => {
    const nameA = (a.basic_info?.full_name || a.scouting_info?.full_name || "").toLowerCase();
    const nameB = (b.basic_info?.full_name || b.scouting_info?.full_name || "").toLowerCase();
    const dateA = a.created_at?.toDate ? a.created_at.toDate().getTime() : 0;
    const dateB = b.created_at?.toDate ? b.created_at.toDate().getTime() : 0;

    if (sort === "name-asc") return nameA.localeCompare(nameB, "id");
    if (sort === "name-desc") return nameB.localeCompare(nameA, "id");
    if (sort === "oldest") return dateA - dateB;
    return dateB - dateA; // newest default
  });

  return result;
}

/**
 * Apply filters and update the view with pagination.
 */
function applyFiltersAndRender() {
  const filtered = getFilteredTalents();
  const totalRows = filtered.length;
  const pageSize = state.pagination.pageSize || 12;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  if (state.pagination.page > totalPages) state.pagination.page = totalPages;
  if (state.pagination.page < 1) state.pagination.page = 1;

  const startIndex = (state.pagination.page - 1) * pageSize;
  const pageItems = filtered.slice(startIndex, startIndex + pageSize);

  ScoutingUI.renderTalents(pageItems, state.assignUsersMap);

  ScoutingUI.renderPagination(
    {
      currentPage: state.pagination.page,
      totalRows,
      rowsPerPage: pageSize,
      totalPages,
    },
    (newPage) => {
      state.pagination.page = newPage;
      applyFiltersAndRender();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  );
}

/**
 * Switch view mode between Grid and List.
 * @param {'grid'|'list'} mode
 */
function setViewMode(mode) {
  state.currentView = mode;
  const gridContainer = document.getElementById("gridView");
  const listContainer = document.getElementById("listView");
  const gridBtn = document.getElementById("viewGridBtn");
  const listBtn = document.getElementById("viewListBtn");

  if (mode === "list") {
    if (gridContainer) gridContainer.classList.add("d-none");
    if (listContainer) listContainer.classList.remove("d-none");
    if (gridBtn) gridBtn.classList.remove("active");
    if (listBtn) listBtn.classList.add("active");
  } else {
    if (gridContainer) gridContainer.classList.remove("d-none");
    if (listContainer) listContainer.classList.add("d-none");
    if (gridBtn) gridBtn.classList.add("active");
    if (listBtn) listBtn.classList.remove("active");
  }
}

/**
 * Load talent data from Firestore.
 */
async function loadTalents() {
  try {
    state.talents = await ScoutingRepo.listTalents();
    applyFiltersAndRender();
  } catch (error) {
    console.error("Failed to load talents:", error);
  }
}

/**
 * Open the Add Candidate modal.
 */
function handleOpenAddModal() {
  state.currentEditingTalentId = null;
  state.currentAvatarUrl = null;
  state.pendingCompressedPhoto = null;
  state.pendingCompressedFileName = null;

  const form = document.getElementById("candidateAddForm");
  if (form) form.reset();

  const modalEl = document.getElementById("candidateAddModal");
  if (modalEl) {
    const title = modalEl.querySelector(".modal-title");
    if (title) title.textContent = "Tambah Kandidat";
  }

  ScoutingUI.renderAssignUsersDropdown(state.assignUsersMap, []);
  ScoutingUI.setPhotoState("idle", "Belum ada foto");

  const photoBox = document.getElementById("candidatePhotoUpload");
  if (photoBox) {
    photoBox.style.backgroundImage = "";
    photoBox.classList.remove("has-photo");
  }

  if (state.modalInstance) state.modalInstance.show();
}

/**
 * Open the Edit Candidate modal with preloaded data.
 * @param {string} talentId
 */
async function handleOpenEditModal(talentId) {
  try {
    const talent = await ScoutingRepo.getTalentById(talentId);
    if (!talent) {
      alert("Data kandidat tidak ditemukan.");
      return;
    }

    state.currentEditingTalentId = talentId;
    const basic = talent.basic_info || {};
    const scouting = talent.scouting_info || {};
    const name = basic.full_name || scouting.full_name || "";
    const roleId = scouting.role_id || "";
    const roleName = basic.current_role || scouting.role_name || "";
    const positionId = scouting.position_id || "";
    const positionName = scouting.position_name || "";
    const channelType = scouting.channel_type || "";
    const channelUrl = scouting.channel_url || "";
    const assignedTo = Array.isArray(scouting.assigned_to)
      ? scouting.assigned_to.filter(Boolean)
      : [];
    const avatarUrl = basic.avatar_url || null;

    state.currentAvatarUrl = avatarUrl;
    state.pendingCompressedPhoto = null;
    state.pendingCompressedFileName = null;

    const nameInput = document.getElementById("candidateNameInput");
    if (nameInput) nameInput.value = name;

    const roleSelect = document.getElementById("candidateRoleInput");
    if (roleSelect) {
      let selectedRoleId = "";
      if (roleId && Array.from(roleSelect.options).some((o) => o.value === roleId)) {
        selectedRoleId = roleId;
      } else if (roleName) {
        const match = Array.from(roleSelect.options).find((o) => o.textContent === roleName);
        if (match) selectedRoleId = match.value;
      }
      roleSelect.value = selectedRoleId;
    }

    const posSelect = document.getElementById("candidatePositionSelect");
    if (posSelect) {
      let selectedPosId = "";
      if (positionId && Array.from(posSelect.options).some((o) => o.value === positionId)) {
        selectedPosId = positionId;
      } else if (positionName) {
        const match = Array.from(posSelect.options).find((o) => o.textContent === positionName);
        if (match) selectedPosId = match.value;
      }
      posSelect.value = selectedPosId;
    }

    const channelSelect = document.getElementById("candidateChannelTypeSelect");
    if (channelSelect) channelSelect.value = channelType || "instagram";

    const urlInput = document.getElementById("candidateChannelUrlInput");
    if (urlInput) urlInput.value = channelUrl;

    ScoutingUI.renderAssignUsersDropdown(state.assignUsersMap, assignedTo);

    const photoBox = document.getElementById("candidatePhotoUpload");
    if (photoBox) {
      if (avatarUrl) {
        photoBox.style.backgroundImage = `url(${avatarUrl})`;
        photoBox.classList.add("has-photo");
        ScoutingUI.setPhotoState("ready", "Foto tersimpan");
      } else {
        photoBox.style.backgroundImage = "";
        photoBox.classList.remove("has-photo");
        ScoutingUI.setPhotoState("idle", "Belum ada foto");
      }
    }

    const modalEl = document.getElementById("candidateAddModal");
    if (modalEl) {
      const title = modalEl.querySelector(".modal-title");
      if (title) title.textContent = "Edit Kandidat";
    }

    if (state.modalInstance) state.modalInstance.show();
  } catch (error) {
    console.error("Failed to load talent for edit:", error);
    alert("Gagal memuat data kandidat untuk diedit.");
  }
}

/**
 * Handle form submit to add or edit candidate.
 * @param {Event} event
 */
async function handleSubmitCandidateForm(event) {
  event.preventDefault();
  const isEdit = !!state.currentEditingTalentId;

  const name = document.getElementById("candidateNameInput").value.trim();
  if (!name) {
    alert("Nama kandidat wajib diisi.");
    return;
  }

  const roleSelect = document.getElementById("candidateRoleInput");
  const roleId = roleSelect ? roleSelect.value || null : null;
  const role = roleSelect && roleSelect.selectedIndex > -1 ? roleSelect.options[roleSelect.selectedIndex].text : "";

  const posSelect = document.getElementById("candidatePositionSelect");
  const positionId = posSelect ? posSelect.value || null : null;
  const positionName = posSelect && posSelect.selectedIndex > -1 ? posSelect.options[posSelect.selectedIndex].text : null;

  const channelType = document.getElementById("candidateChannelTypeSelect").value || null;
  const channelUrl = document.getElementById("candidateChannelUrlInput").value.trim();

  const assignValue = document.getElementById("candidateAssignInput").value || "";
  const assignUserIds = assignValue ? assignValue.split(",").filter(Boolean) : [];

  const submitBtn = event.target.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  try {
    let avatarUrl = state.currentAvatarUrl || null;
    if (state.pendingCompressedPhoto) {
      ScoutingUI.setPhotoState("processing", "Mengupload foto...");
      avatarUrl = await ScoutingRepo.uploadCandidateImage(
        state.pendingCompressedPhoto,
        state.pendingCompressedFileName || "photo.jpg"
      );
    }

    const payload = {
      basic_info: {
        full_name: name,
        current_role: role,
        avatar_url: avatarUrl || null,
      },
      scouting_info: {
        role_id: roleId,
        role_name: role,
        position_id: positionId,
        position_name: positionName,
        channel_type: channelType,
        channel_url: channelUrl || null,
        assigned_to: assignUserIds,
      },
    };

    if (isEdit && state.currentEditingTalentId) {
      await ScoutingRepo.updateTalent(state.currentEditingTalentId, payload);
    } else {
      await ScoutingRepo.createTalent(payload);
    }

    if (state.modalInstance) state.modalInstance.hide();
    await loadTalents();
    alert(isEdit ? "Data kandidat berhasil diperbarui." : "Data kandidat berhasil disimpan.");
  } catch (error) {
    console.error("Failed to save candidate:", error);
    alert("Gagal menyimpan data kandidat: " + error.message);
    ScoutingUI.setPhotoState("error", "Gagal menyimpan foto");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

/**
 * Handle deleting candidate with confirmation.
 * @param {string} talentId
 */
async function handleDeleteCandidate(talentId) {
  if (!talentId) return;
  const ok = confirm("Hapus kandidat ini dari daftar scouting?");
  if (!ok) return;

  try {
    await ScoutingRepo.deleteTalentById(talentId);
    await loadTalents();
  } catch (error) {
    console.error("Failed to delete talent:", error);
    alert("Gagal menghapus kandidat: " + error.message);
  }
}

/**
 * Handle status dropdown change on candidate card/row.
 * @param {string} talentId
 * @param {string} newStatus
 */
async function handleStatusChange(talentId, newStatus) {
  if (!talentId || !newStatus) return;
  try {
    await ScoutingRepo.updateTalentStatus(talentId, newStatus, "Admin");
    const talent = state.talents.find((t) => t.id === talentId);
    if (talent) {
      if (!talent.recruitment_status) talent.recruitment_status = {};
      talent.recruitment_status.current = newStatus;
    }
  } catch (error) {
    console.error("Failed to update status:", error);
    alert("Gagal memperbarui status: " + error.message);
  }
}

/**
 * Handle due date change on list row input.
 * @param {string} talentId
 * @param {string} dueIso
 */
async function handleDueDateChange(talentId, dueIso) {
  if (!talentId) return;
  try {
    await ScoutingRepo.updateTalentDueDate(talentId, dueIso, "Admin");
    const talent = state.talents.find((t) => t.id === talentId);
    if (talent) {
      if (!talent.scouting_info) talent.scouting_info = {};
      talent.scouting_info.interview_due = dueIso;
    }
  } catch (error) {
    console.error("Failed to update due date:", error);
  }
}

/**
 * Handle exporting scouting talents to Excel.
 */
async function handleExportExcel() {
  const btn = document.getElementById("btnExportExcel");
  if (!btn) return;
  const prevHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML =
    '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Exporting...';

  try {
    const filtered = getFilteredTalents();
    await ScoutingRepo.exportScoutingToExcel(filtered, state.assignUsersMap);
  } catch (error) {
    console.error("Excel export error:", error);
    alert("Gagal mengekspor data: " + error.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = prevHtml;
  }
}

/**
 * Wire DOM event listeners.
 */
function wireEvents() {
  const modalEl = document.getElementById("candidateAddModal");
  if (modalEl && window.bootstrap) {
    state.modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
  }

  // View toggle buttons
  const gridBtn = document.getElementById("viewGridBtn");
  const listBtn = document.getElementById("viewListBtn");
  if (gridBtn) gridBtn.addEventListener("click", () => setViewMode("grid"));
  if (listBtn) listBtn.addEventListener("click", () => setViewMode("list"));

  // Search input
  const searchInput = document.getElementById("candidateSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.filterState.search = e.target.value;
      state.pagination.page = 1;
      applyFiltersAndRender();
    });
  }

  // Status filter
  const statusFilter = document.getElementById("candidateStatusFilter");
  if (statusFilter) {
    statusFilter.addEventListener("change", (e) => {
      state.filterState.status = e.target.value;
      state.pagination.page = 1;
      applyFiltersAndRender();
    });
  }

  // Sort dropdown
  const sortSelect = document.getElementById("candidateSortSelect");
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      state.filterState.sort = e.target.value;
      state.pagination.page = 1;
      applyFiltersAndRender();
    });
  }

  // Add Candidate button
  const addBtn = document.getElementById("btnAddCandidate");
  if (addBtn) addBtn.addEventListener("click", handleOpenAddModal);

  // Candidate Add / Edit Form
  const form = document.getElementById("candidateAddForm");
  if (form) form.addEventListener("submit", handleSubmitCandidateForm);

  // Export Excel button
  const exportBtn = document.getElementById("btnExportExcel");
  if (exportBtn) exportBtn.addEventListener("click", handleExportExcel);

  // Photo upload box & input
  const photoBox = document.getElementById("candidatePhotoUpload");
  const photoInput = document.getElementById("candidateImageUrlInput");
  if (photoBox && photoInput) {
    photoBox.addEventListener("click", () => photoInput.click());

    photoInput.addEventListener("change", async () => {
      const file = photoInput.files && photoInput.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        alert("Ukuran file maksimal 5MB.");
        photoInput.value = "";
        ScoutingUI.setPhotoState("error", "Ukuran melebihi 5MB");
        return;
      }
      try {
        ScoutingUI.setPhotoState("processing", "Memproses foto...");
        const blob = await ScoutingUI.compressImage(file);
        state.pendingCompressedPhoto = blob;
        state.pendingCompressedFileName = (file.name || "photo.jpg")
          .replace(/[^\w.\-]/g, "_")
          .replace(/\.\w+$/, ".jpg");
        const previewUrl = URL.createObjectURL(blob);
        photoBox.style.backgroundImage = `url(${previewUrl})`;
        photoBox.classList.add("has-photo");
        ScoutingUI.setPhotoState("ready", "Foto siap disimpan");
      } catch (err) {
        console.error("Photo processing failed:", err);
        ScoutingUI.setPhotoState("error", "Gagal memproses foto");
      }
    });
  }

  // Assign dropdown toggle & search
  const assignDisplay = document.getElementById("assignDisplay");
  const assignDropdown = document.getElementById("assignDropdown");
  const assignSearch = document.getElementById("assignUserSearch");
  const assignUsersContainer = document.getElementById("candidateAssignUsers");

  if (assignDisplay && assignDropdown) {
    assignDisplay.addEventListener("click", (e) => {
      e.stopPropagation();
      assignDropdown.classList.toggle("open");
      if (assignDropdown.classList.contains("open") && assignSearch) {
        assignSearch.focus();
      }
    });

    document.addEventListener("click", (e) => {
      if (!assignDropdown.contains(e.target)) {
        assignDropdown.classList.remove("open");
      }
    });
  }

  if (assignSearch) {
    assignSearch.addEventListener("input", () => {
      const term = assignSearch.value.toLowerCase();
      const items = document.querySelectorAll(".assign-user-item");
      items.forEach((it) => {
        const name = (it.dataset.name || "").toLowerCase();
        it.style.display = name.includes(term) ? "" : "none";
      });
    });
  }

  if (assignUsersContainer) {
    assignUsersContainer.addEventListener("click", (e) => {
      const item = e.target.closest(".assign-user-item");
      if (!item) return;
      const cb = item.querySelector('input[type="checkbox"]');
      if (e.target !== cb && cb) {
        cb.checked = !cb.checked;
      }
      item.classList.toggle("active", cb.checked);

      const selected = [];
      const items = assignUsersContainer.querySelectorAll(".assign-user-item");
      items.forEach((it) => {
        const box = it.querySelector('input[type="checkbox"]');
        if (box && box.checked) selected.push(it.dataset.userId);
      });
      ScoutingUI.updateAssignDisplay(state.assignUsersMap, selected);
    });
  }

  // Event delegation on grid container and list table
  const mainContainer = document.querySelector(".dg-main");
  if (mainContainer) {
    mainContainer.addEventListener("click", (e) => {
      const editBtn = e.target.closest(".candidate-edit-btn");
      const deleteBtn = e.target.closest(".candidate-delete-btn");

      if (editBtn) {
        handleOpenEditModal(editBtn.getAttribute("data-id"));
        return;
      }
      if (deleteBtn) {
        handleDeleteCandidate(deleteBtn.getAttribute("data-id"));
      }
    });

    mainContainer.addEventListener("change", (e) => {
      const statusSelect = e.target.closest(".status-select");
      const dueInput = e.target.closest(".due-input");

      if (statusSelect) {
        const talentId = statusSelect.getAttribute("data-talent-id");
        handleStatusChange(talentId, statusSelect.value);
        return;
      }
      if (dueInput) {
        const talentId = dueInput.getAttribute("data-talent-id");
        handleDueDateChange(talentId, dueInput.value ? new Date(dueInput.value).toISOString() : "");
      }
    });
  }
}

/**
 * Initialize Scouting Candidate page.
 */
async function init() {
  try {
    // 1. Initial UI wiring
    wireEvents();
    if (typeof renderRightbarRecruit === "function") {
      renderRightbarRecruit();
    }

    // 2. Auth Guard
    const authResult = await requireAuth();
    if (!authResult) return;

    const { user, role } = authResult;

    // 3. Mount Shell Topbar & Sidebar
    renderTopbar({ user, role: role || "member" });
    renderSidebar({ role: role || "member", activePage: "scouting-candidate" });

    // 4. Load Auxiliary Lookups
    const [assignUsers, roles, positions] = await Promise.all([
      ScoutingRepo.loadAssignUsers(),
      ScoutingRepo.loadCandidateRoles(),
      ScoutingRepo.loadCandidatePositions(),
    ]);

    state.assignUsersMap = assignUsers;
    state.roles = roles;
    state.positions = positions;

    ScoutingUI.populateRolesSelect(roles);
    ScoutingUI.populatePositionsSelect(positions);
    ScoutingUI.renderAssignUsersDropdown(assignUsers, []);

    // 5. Load Talents
    await loadTalents();
  } catch (error) {
    console.error("Initialization error in scouting-candidate:", error);
  }
}

// Start on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
