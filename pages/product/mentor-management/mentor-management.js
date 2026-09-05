// pages/product/mentor-management/mentor-management.js
// =====================================================================
// MENTOR MANAGEMENT ORCHESTRATOR
// Coordinates authentication, shared shell, repository (data layer),
// and UI (presentation layer).
//
// Rules:
//  - No direct Firestore queries here (use mentor-management.repository.js).
//  - No raw DOM element creation here (use mentor-management.ui.js).
//  - This file wires user interaction, state, and repository together.
// =====================================================================

import { requireAuth } from "/assets/js/auth-guard.js";
import { renderTopbar } from "/assets/js/components/topbar/topbar.js";
import { renderSidebar } from "/assets/js/components/sidebar/sidebar.js";
import * as repo from "./mentor-management.repository.js";
import * as ui from "./mentor-management.ui.js";

let currentUser = null;
let currentRole = null;
let mentorsAll = [];
let availableClasses = [];
let selectedMentorIds = new Set();
let editingMentorDocId = null;
let currentAssignMentorId = null;

let currentSort = { field: "name", dir: "asc" };
let currentFilters = {
  search: "",
  rating: "",
  location: "",
  teaching: "",
  status: "",
  availability: "",
  contract: "",
};

let pagination = {
  page: 1,
  pageSize: 10,
  total: 0,
};

/**
 * Initialize Mentor Management page lifecycle
 */
async function initializeMentorManagement() {
  try {
    // 1. Authenticate user & extract role
    const authResult = await requireAuth();
    currentUser = authResult.user;
    currentRole = authResult.role;

    // 2. Render shared application shell
    renderTopbar({ user: currentUser, role: currentRole });
    renderSidebar({ role: currentRole, activePage: "mentor-management" });

    // 3. Load mentor data from repository
    await loadMentorData();

    // 4. Setup all UI event handlers
    setupEventListeners();

    // 5. Initialize Lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  } catch (error) {
    console.error("[Mentor Management] Initialization error:", error);
  }
}

/**
 * Load mentors and classes from repository
 */
async function loadMentorData() {
  try {
    const [mentors, classes] = await Promise.all([
      repo.getMentors(),
      repo.getAvailableClasses(),
    ]);

    mentorsAll = mentors;
    availableClasses = classes;

    ui.populateLocationFilter(mentorsAll);
    applyAndRender();
  } catch (err) {
    console.error("[Mentor Management] Error loading data:", err);
  }
}

/**
 * Filter & sort dataset based on state
 */
function getFilteredAndSortedMentors() {
  let list = mentorsAll.map((m) => ({ ...m, score: ui.computeScore(m) }));

  // Search filter
  if (currentFilters.search) {
    const q = currentFilters.search.toLowerCase();
    list = list.filter(
      (m) =>
        (m.fullName || "").toLowerCase().includes(q) ||
        (m.nickName || "").toLowerCase().includes(q) ||
        (m.location || "").toLowerCase().includes(q)
    );
  }

  // Rating minimum filter
  if (currentFilters.rating) {
    const minRating = parseFloat(currentFilters.rating);
    list = list.filter((m) => (m.rating || 0) >= minRating);
  }

  // Location filter
  if (currentFilters.location) {
    list = list.filter((m) => (m.location || "") === currentFilters.location);
  }

  // Teaching filter
  if (currentFilters.teaching) {
    list = list.filter((m) => (m.teaching || "") === currentFilters.teaching);
  }

  // Status filter
  if (currentFilters.status) {
    list = list.filter((m) => (m.status || "") === currentFilters.status);
  }

  // Availability filter
  if (currentFilters.availability === "available") {
    list = list.filter((m) => ui.isAvailableMentor(m));
  } else if (currentFilters.availability === "busy") {
    list = list.filter((m) => !ui.isAvailableMentor(m));
  }

  // Contract filter
  if (currentFilters.contract === "lt30") {
    list = list.filter((m) => {
      const meta = ui.getContractMeta(m);
      return meta.daysLeft !== null && meta.daysLeft >= 0 && meta.daysLeft <= 30;
    });
  } else if (currentFilters.contract === "expired") {
    list = list.filter((m) => {
      const meta = ui.getContractMeta(m);
      return meta.daysLeft !== null && meta.daysLeft < 0;
    });
  }

  // Sorting
  list.sort((a, b) => {
    const dir = currentSort.dir === "asc" ? 1 : -1;
    if (currentSort.field === "name") {
      return (
        dir * String(a.fullName || "").localeCompare(String(b.fullName || ""))
      );
    }
    if (currentSort.field === "nick") {
      return (
        dir * String(a.nickName || "").localeCompare(String(b.nickName || ""))
      );
    }
    if (currentSort.field === "rating") {
      return dir * ((a.rating || 0) - (b.rating || 0));
    }
    if (currentSort.field === "teaching") {
      return (
        dir * String(a.teaching || "").localeCompare(String(b.teaching || ""))
      );
    }
    if (currentSort.field === "type") {
      return dir * String(a.type || "").localeCompare(String(b.type || ""));
    }
    if (currentSort.field === "activeClasses") {
      return dir * ((a.activeClasses || 0) - (b.activeClasses || 0));
    }
    if (currentSort.field === "totalClasses") {
      return dir * ((a.totalClasses || 0) - (b.totalClasses || 0));
    }
    if (currentSort.field === "location") {
      return (
        dir * String(a.location || "").localeCompare(String(b.location || ""))
      );
    }
    if (currentSort.field === "status") {
      return dir * String(a.status || "").localeCompare(String(b.status || ""));
    }
    if (currentSort.field === "contract") {
      const da = a.contractEnd ? new Date(a.contractEnd).getTime() : 0;
      const db = b.contractEnd ? new Date(b.contractEnd).getTime() : 0;
      return dir * (da - db);
    }
    if (currentSort.field === "score") {
      return dir * ((a.score || 0) - (b.score || 0));
    }
    return (
      dir * String(a.fullName || "").localeCompare(String(b.fullName || ""))
    );
  });

  return list;
}

/**
 * Re-render all sections with current state
 */
function applyAndRender() {
  const filteredList = getFilteredAndSortedMentors();
  pagination.total = filteredList.length;

  // Ensure current page is within valid range
  const maxPage = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  if (pagination.page > maxPage) {
    pagination.page = maxPage;
  }

  // 1. KPI summary cards
  ui.renderSummary(filteredList);

  // 2. Table
  ui.renderMentorTable(filteredList, pagination, selectedMentorIds, {
    onToggleCheck: (id, checked) => {
      if (checked) selectedMentorIds.add(id);
      else selectedMentorIds.delete(id);
      updateCheckAllState();
    },
    onDetail: (id) => {
      const mentor = mentorsAll.find((m) => m.id === id);
      if (mentor) {
        ui.openDetailModal(mentor, {
          onAssign: (mId) => openAssignModal(mId),
        });
      }
    },
    onEdit: (id) => {
      const mentor = mentorsAll.find((m) => m.id === id);
      if (mentor) {
        editingMentorDocId = mentor.id;
        ui.openAddMentorModal(mentor);
      }
    },
    onAssign: (id) => openAssignModal(id),
  });

  // 3. Table Pagination
  ui.renderPagination(
    pagination,
    (newPage) => {
      pagination.page = newPage;
      applyAndRender();
    },
    (newSize) => {
      pagination.pageSize = newSize;
      pagination.page = 1;
      applyAndRender();
    }
  );

  // 4. Performance Ranking side widget
  ui.renderRanking(filteredList);

  // 5. Reminders side widget
  ui.renderReminders(filteredList);

  // Update check all checkbox in table header
  updateCheckAllState();

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function updateCheckAllState() {
  const checkAll = document.getElementById("checkAllMentor");
  if (!checkAll) return;
  const filtered = getFilteredAndSortedMentors();
  if (filtered.length === 0) {
    checkAll.checked = false;
    checkAll.indeterminate = false;
  } else {
    const allSelected = filtered.every((m) => selectedMentorIds.has(m.id));
    const someSelected = filtered.some((m) => selectedMentorIds.has(m.id));
    checkAll.checked = allSelected;
    checkAll.indeterminate = !allSelected && someSelected;
  }
}

function openAssignModal(mentorId) {
  currentAssignMentorId = mentorId;
  const mentor = mentorsAll.find((m) => m.id === mentorId);
  if (!mentor) return;

  ui.openAssignModal(mentor, availableClasses, async (mId, classId, note) => {
    try {
      const cls = availableClasses.find((c) => c.id === classId);
      alert(
        `Mentor ${mentor.fullName || mentor.nickName} berhasil di-assign ke ${
          cls ? cls.name : "kelas"
        }.`
      );
      ui.closeAssignModal();
    } catch (e) {
      console.error("[Mentor Management] Assign error:", e);
      alert("Terjadi kesalahan saat assign mentor.");
    }
  });
}

/**
 * Handle saving new mentor or updating existing mentor
 */
async function handleSaveMentor() {
  const saveBtn = document.getElementById("btnAddMentorSave");
  const fullNameInput = document.getElementById("addMentorFullName");
  const nickNameInput = document.getElementById("addMentorNickName");
  const whatsappInput = document.getElementById("addMentorWhatsapp");
  const locationInput = document.getElementById("addMentorLocation");
  const ratingInput = document.getElementById("addMentorRating");
  const teachingSelect = document.getElementById("addMentorTeaching");
  const typeSelect = document.getElementById("addMentorType");
  const statusSelect = document.getElementById("addMentorStatus");
  const contractEndInput = document.getElementById("addMentorContractEnd");
  const feeOnlineInput = document.getElementById("addMentorFeeOnline");
  const feeOfflineInput = document.getElementById("addMentorFeeOffline");
  const notesInput = document.getElementById("addMentorContractNotes");
  const bankNameInput = document.getElementById("addMentorBankName");
  const accountNumberInput = document.getElementById("addMentorAccountNumber");
  const accountHolderNameInput = document.getElementById(
    "addMentorAccountHolderName"
  );

  const isEdit = Boolean(editingMentorDocId);

  if (!fullNameInput) return;
  const fullName = fullNameInput.value.trim();
  if (!fullName) {
    ui.setAddMentorError("Nama lengkap wajib diisi.");
    fullNameInput.focus();
    return;
  }
  if (fullName.includes("/")) {
    ui.setAddMentorError("Nama lengkap tidak boleh mengandung karakter '/'.");
    fullNameInput.focus();
    return;
  }

  const docId = fullName.replace(/\s+/g, " ").trim();
  const nickName = nickNameInput ? nickNameInput.value.trim() : "";
  const whatsappRaw = whatsappInput ? whatsappInput.value.trim() : "";
  const whatsappNumber = repo.sanitizePhoneNumber(whatsappRaw);
  const location = locationInput ? locationInput.value.trim() : "";
  const ratingRaw = ratingInput ? parseFloat(ratingInput.value) || 0 : 0;
  const rating = Math.min(5, Math.max(0, ratingRaw));
  const teaching = teachingSelect ? teachingSelect.value : "Both";
  const type = typeSelect ? typeSelect.value : "Online";
  const status = statusSelect ? statusSelect.value : "active";
  const contractEnd = contractEndInput ? contractEndInput.value : "";
  const feeOnline = feeOnlineInput ? Math.max(0, parseFloat(feeOnlineInput.value) || 0) : 0;
  const feeOffline = feeOfflineInput ? Math.max(0, parseFloat(feeOfflineInput.value) || 0) : 0;
  const contractNotes = notesInput ? notesInput.value.trim() : "";
  const bankName = bankNameInput ? bankNameInput.value.trim() : "";
  const accountNumber = accountNumberInput ? accountNumberInput.value.trim() : "";
  const accountHolderName = accountHolderNameInput
    ? accountHolderNameInput.value.trim() || fullName
    : fullName;

  if (whatsappRaw && !whatsappNumber) {
    ui.setAddMentorError("Nomor WhatsApp hanya boleh berisi angka.");
    whatsappInput.focus();
    return;
  }

  const availabilityResult = ui.collectAvailabilityFromForm();
  if (availabilityResult.hasPartial) {
    ui.setAddMentorError(
      "Setiap slot availability harus berisi hari, jam mulai, dan jam selesai."
    );
    return;
  }
  if (availabilityResult.hasInvalidRange) {
    ui.setAddMentorError(
      "Jam selesai harus lebih besar dari jam mulai pada availability."
    );
    return;
  }

  const existingMentor = isEdit
    ? mentorsAll.find((m) => m.id === editingMentorDocId)
    : null;

  const payload = {
    fullName,
    nickName: nickName || fullName.split(" ")[0] || "",
    whatsapp: repo.buildWhatsappLink(whatsappNumber),
    whatsappNumber,
    location,
    rating: parseFloat(rating.toFixed(1)),
    teaching,
    type,
    activeClasses: existingMentor ? existingMentor.activeClasses || 0 : 0,
    totalClasses: existingMentor ? existingMentor.totalClasses || 0 : 0,
    status,
    contractEnd: contractEnd || null,
    contractDurationMonths: existingMentor
      ? existingMentor.contractDurationMonths || null
      : null,
    lastActiveDays: existingMentor ? existingMentor.lastActiveDays || 0 : 0,
    completionRate: existingMentor ? existingMentor.completionRate || 0 : 0,
    attendanceRate: existingMentor ? existingMentor.attendanceRate || 0 : 0,
    complaintCount: existingMentor ? existingMentor.complaintCount || 0 : 0,
    avgFeedback: existingMentor
      ? existingMentor.avgFeedback || rating
      : rating,
    totalEarning: existingMentor ? existingMentor.totalEarning || 0 : 0,
    pendingPayment: existingMentor ? existingMentor.pendingPayment || 0 : 0,
    feeOnline,
    feeOffline,
    availability: availabilityResult.list,
    classHistory: existingMentor ? existingMentor.classHistory || [] : [],
    contractNotes,
    bankName,
    accountNumber,
    accountHolderName,
  };

  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Menyimpan...";
    }

    await repo.saveMentor(docId, payload, isEdit, editingMentorDocId);

    ui.closeAddMentorModal();
    editingMentorDocId = null;
    await loadMentorData();
    alert(
      isEdit ? "Data mentor berhasil diperbarui." : "Mentor baru berhasil ditambahkan."
    );
  } catch (err) {
    console.error("[Mentor Management] Save error:", err);
    ui.setAddMentorError(
      "Gagal menyimpan mentor. Silakan periksa koneksi atau izin database."
    );
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? "Simpan Perubahan" : "Simpan Mentor";
    }
  }
}

/**
 * Setup DOM event listeners
 */
function setupEventListeners() {
  const searchInput = document.getElementById("searchMentor");
  const filterRating = document.getElementById("filterRating");
  const filterLocation = document.getElementById("filterLocation");
  const filterTeaching = document.getElementById("filterTeaching");
  const filterStatus = document.getElementById("filterStatus");
  const filterAvailability = document.getElementById("filterAvailability");
  const filterContract = document.getElementById("filterContract");
  const btnToggleFilter = document.getElementById("btnToggleFilter");
  const filterPanel = document.getElementById("filterPanel");
  const sortLabel = document.getElementById("sortLabel");
  const checkAll = document.getElementById("checkAllMentor");
  const btnAddMentor = document.getElementById("btnAddMentor");
  const btnBulkAssign = document.getElementById("btnBulkAssign");
  const btnBulkStatus = document.getElementById("btnBulkStatus");
  const btnExportMenu = document.getElementById("btnExportMenu");
  const exportDropdown = document.getElementById("exportDropdown");
  const btnExportCsv = document.getElementById("btnExportCsv");
  const btnExportExcel = document.getElementById("btnExportExcel");
  const btnCloseDetail = document.getElementById("btnCloseDetail");
  const btnCloseAssign = document.getElementById("btnCloseAssign");
  const btnAssignCancel = document.getElementById("btnAssignCancel");
  const btnCloseAddMentor = document.getElementById("btnCloseAddMentor");
  const btnAddMentorCancel = document.getElementById("btnAddMentorCancel");
  const btnAddMentorSave = document.getElementById("btnAddMentorSave");
  const btnAddAvailabilitySlot = document.getElementById("btnAddAvailabilitySlot");
  const addMentorWhatsapp = document.getElementById("addMentorWhatsapp");

  // Search input live filter
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      currentFilters.search = searchInput.value.trim();
      pagination.page = 1;
      applyAndRender();
    });
  }

  // Filter panel toggle
  if (btnToggleFilter && filterPanel) {
    btnToggleFilter.addEventListener("click", () => {
      filterPanel.classList.toggle("hidden");
    });
  }

  // Filter dropdown listeners
  if (filterRating) {
    filterRating.addEventListener("change", () => {
      currentFilters.rating = filterRating.value;
      pagination.page = 1;
      applyAndRender();
    });
  }
  if (filterLocation) {
    filterLocation.addEventListener("change", () => {
      currentFilters.location = filterLocation.value;
      pagination.page = 1;
      applyAndRender();
    });
  }
  if (filterTeaching) {
    filterTeaching.addEventListener("change", () => {
      currentFilters.teaching = filterTeaching.value;
      pagination.page = 1;
      applyAndRender();
    });
  }
  if (filterStatus) {
    filterStatus.addEventListener("change", () => {
      currentFilters.status = filterStatus.value;
      pagination.page = 1;
      applyAndRender();
    });
  }
  if (filterAvailability) {
    filterAvailability.addEventListener("change", () => {
      currentFilters.availability = filterAvailability.value;
      pagination.page = 1;
      applyAndRender();
    });
  }
  if (filterContract) {
    filterContract.addEventListener("change", () => {
      currentFilters.contract = filterContract.value;
      pagination.page = 1;
      applyAndRender();
    });
  }

  // Table header sorting
  document.querySelectorAll("th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const field = th.getAttribute("data-sort");
      if (!field) return;
      if (currentSort.field === field) {
        currentSort.dir = currentSort.dir === "asc" ? "desc" : "asc";
      } else {
        currentSort.field = field;
        currentSort.dir = "asc";
      }
      if (sortLabel) {
        const arrow = currentSort.dir === "asc" ? "↑" : "↓";
        sortLabel.textContent = `${
          field.charAt(0).toUpperCase() + field.slice(1)
        } ${arrow}`;
      }
      applyAndRender();
    });
  });

  // Check all checkbox
  if (checkAll) {
    checkAll.addEventListener("change", () => {
      const filtered = getFilteredAndSortedMentors();
      if (checkAll.checked) {
        filtered.forEach((m) => selectedMentorIds.add(m.id));
      } else {
        selectedMentorIds.clear();
      }
      applyAndRender();
    });
  }

  // Bulk Assign
  if (btnBulkAssign) {
    btnBulkAssign.addEventListener("click", () => {
      if (!selectedMentorIds.size) {
        alert("Pilih minimal satu mentor terlebih dahulu.");
        return;
      }
      const firstId = Array.from(selectedMentorIds)[0];
      openAssignModal(firstId);
    });
  }

  // Bulk Status
  if (btnBulkStatus) {
    btnBulkStatus.addEventListener("click", async () => {
      if (!selectedMentorIds.size) {
        alert("Pilih minimal satu mentor terlebih dahulu.");
        return;
      }
      const status = prompt(
        "Masukkan status baru untuk mentor terpilih (active / inactive / on_leave):"
      );
      if (!status) return;
      const normalized = status.toLowerCase().trim();
      if (!["active", "inactive", "on_leave"].includes(normalized)) {
        alert("Status tidak valid. Gunakan 'active', 'inactive', atau 'on_leave'.");
        return;
      }

      try {
        await repo.bulkUpdateStatus(Array.from(selectedMentorIds), normalized);
        await loadMentorData();
        alert(
          `Status berhasil diperbarui menjadi '${normalized}' untuk ${selectedMentorIds.size} mentor.`
        );
      } catch (e) {
        console.error("[Mentor Management] Bulk status error:", e);
        alert("Terjadi kesalahan saat memperbarui status.");
      }
    });
  }

  // Export Menu
  if (btnExportMenu && exportDropdown) {
    btnExportMenu.addEventListener("click", (e) => {
      e.stopPropagation();
      exportDropdown.classList.toggle("hidden");
    });
    document.addEventListener("click", (e) => {
      if (
        !exportDropdown.contains(e.target) &&
        e.target !== btnExportMenu &&
        !btnExportMenu.contains(e.target)
      ) {
        exportDropdown.classList.add("hidden");
      }
    });
  }

  if (btnExportCsv) {
    btnExportCsv.addEventListener("click", () => {
      exportToCsv(getFilteredAndSortedMentors());
      if (exportDropdown) exportDropdown.classList.add("hidden");
    });
  }
  if (btnExportExcel) {
    btnExportExcel.addEventListener("click", () => {
      exportToCsv(getFilteredAndSortedMentors());
      if (exportDropdown) exportDropdown.classList.add("hidden");
    });
  }

  // Add Mentor Modal
  if (btnAddMentor) {
    btnAddMentor.addEventListener("click", () => {
      editingMentorDocId = null;
      ui.openAddMentorModal(null);
    });
  }
  if (btnCloseAddMentor)
    btnCloseAddMentor.addEventListener("click", () => ui.closeAddMentorModal());
  if (btnAddMentorCancel)
    btnAddMentorCancel.addEventListener("click", () => ui.closeAddMentorModal());
  if (btnAddMentorSave) {
    btnAddMentorSave.addEventListener("click", () => handleSaveMentor());
  }
  if (btnAddAvailabilitySlot) {
    btnAddAvailabilitySlot.addEventListener("click", () => {
      ui.addAvailabilitySlot("", "", "");
    });
  }
  if (addMentorWhatsapp) {
    addMentorWhatsapp.addEventListener("input", () => {
      const cleaned = repo.sanitizePhoneNumber(addMentorWhatsapp.value);
      if (addMentorWhatsapp.value !== cleaned) {
        addMentorWhatsapp.value = cleaned;
      }
    });
  }

  // Detail Modal
  if (btnCloseDetail) {
    btnCloseDetail.addEventListener("click", () => ui.closeDetailModal());
  }
  document.querySelectorAll("#detailTabList button[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      if (tabId) ui.setActiveTab(tabId);
    });
  });

  // Assign Modal
  if (btnCloseAssign)
    btnCloseAssign.addEventListener("click", () => ui.closeAssignModal());
  if (btnAssignCancel)
    btnAssignCancel.addEventListener("click", () => ui.closeAssignModal());

  // Modal Backdrop click to close
  [
    document.getElementById("mentorDetailModal"),
    document.getElementById("assignModal"),
    document.getElementById("addMentorModal"),
  ].forEach((backdrop) => {
    if (backdrop) {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) backdrop.classList.remove("open");
      });
    }
  });
}

function exportToCsv(list) {
  if (!list.length) return;
  const headers = [
    "Full Name",
    "Nick Name",
    "WhatsApp",
    "Rating",
    "Teaching",
    "Type",
    "Active Classes",
    "Total Classes",
    "Location",
    "Status",
    "Contract End",
    "Score",
  ];
  const rows = list.map((m) => [
    `"${m.fullName || ""}"`,
    `"${m.nickName || ""}"`,
    `"${m.whatsappNumber || m.whatsapp || ""}"`,
    (m.rating || 0).toFixed(1),
    `"${m.teaching || ""}"`,
    `"${m.type || ""}"`,
    String(m.activeClasses || 0),
    String(m.totalClasses || 0),
    `"${m.location || ""}"`,
    `"${m.status || ""}"`,
    `"${m.contractEnd || ""}"`,
    ui.computeScore(m).toFixed(2),
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mentor-management.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Kick off when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  initializeMentorManagement();
});
