/**
 * class-management.js
 * Feature Controller / Orchestrator for Class Management.
 */

import { renderTopBar } from "/element/topbar.js";
import { renderSidebar } from "/element/sidebar.js";
import { requireAuth } from "/assets/js/auth-guard.js";
import {
  fetchClasses,
  fetchMentors,
  fetchPlanningItems,
  saveRemedialClass,
  saveNewClass,
  updateClassDoc,
  deleteClassDoc,
  FALLBACK_CLASSES,
} from "./class-management.repository.js";
import {
  computeHealthScore,
  renderSummary,
  renderClassTable,
  renderPagination,
  renderCalendar,
  renderStatusBreakdown,
  renderAtRiskClasses,
  renderMeetingProgress,
  populateFilterOptions,
  openDetailModal,
  closeDetailModal,
  openAddClassModal,
  closeAddClassModal,
  openPlanningModal,
  closePlanningModal,
  showToast,
} from "./class-management.ui.js";

// State
let classesState = [];
let selectedClassIds = new Set();
let currentSort = { field: "startDate", dir: "asc" };
let currentFilters = {
  search: "",
  status: "",
  mentor: "",
  pic: "",
  location: "",
  type: "",
  stall: "",
  dateFrom: "",
  dateTo: "",
};
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let currentView = "table";
let currentPage = 1;
let pageSize = 10;

let mentorsData = [];
let remedialClassesData = [];
let selectedRemedialClass = null;
let selectedRemedialMentor = null;

let planningUnscheduled = [];
let planningScheduled = [];

/**
 * Filter & Sort pipeline
 */
function applyFilters() {
  let list = classesState.map((c) => ({
    ...c,
    healthScore: computeHealthScore(c),
  }));

  if (currentFilters.search) {
    const q = currentFilters.search.toLowerCase();
    list = list.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.location || "").toLowerCase().includes(q) ||
        (c.type || "").toLowerCase().includes(q) ||
        (c.pic && (c.pic.name || "").toLowerCase().includes(q))
    );
  }

  if (currentFilters.status) {
    list = list.filter((c) => (c.status || "").toLowerCase() === currentFilters.status.toLowerCase());
  }

  if (currentFilters.mentor) {
    const q = currentFilters.mentor.toLowerCase();
    list = list.filter(
      (c) =>
        Array.isArray(c.mentors) &&
        c.mentors.some((m) => (m.name || "").toLowerCase().includes(q))
    );
  }

  if (currentFilters.pic) {
    const q = currentFilters.pic.toLowerCase();
    list = list.filter((c) => c.pic && (c.pic.name || "").toLowerCase().includes(q));
  }

  if (currentFilters.location) {
    list = list.filter((c) => (c.location || "").toLowerCase() === currentFilters.location.toLowerCase());
  }

  if (currentFilters.type) {
    list = list.filter((c) => (c.type || "").toLowerCase() === currentFilters.type.toLowerCase());
  }

  if (currentFilters.stall === "active") {
    list = list.filter((c) => c.status !== "Stall");
  } else if (currentFilters.stall === "stall") {
    list = list.filter((c) => c.status === "Stall");
  }

  if (currentFilters.dateFrom) {
    const from = new Date(currentFilters.dateFrom).getTime();
    list = list.filter((c) => (c.startDate ? new Date(c.startDate).getTime() >= from : true));
  }

  if (currentFilters.dateTo) {
    const to = new Date(currentFilters.dateTo).getTime();
    list = list.filter((c) => (c.startDate ? new Date(c.startDate).getTime() <= to : true));
  }

  // Sorting
  list.sort((a, b) => {
    const dir = currentSort.dir === "asc" ? 1 : -1;
    if (currentSort.field === "name") {
      return dir * String(a.name || "").localeCompare(String(b.name || ""));
    }
    if (currentSort.field === "status") {
      return dir * String(a.status || "").localeCompare(String(b.status || ""));
    }
    if (currentSort.field === "startDate") {
      const da = a.startDate ? new Date(a.startDate).getTime() : 0;
      const db = b.startDate ? new Date(b.startDate).getTime() : 0;
      return dir * (da - db);
    }
    if (currentSort.field === "health") {
      return dir * ((a.healthScore || 0) - (b.healthScore || 0));
    }
    return dir * String(a.name || "").localeCompare(String(b.name || ""));
  });

  return list;
}

/**
 * Re-renders all components based on filtered state
 */
function updateAll() {
  const filtered = applyFilters();
  renderSummary(filtered);

  // Pagination calculations
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * pageSize;
  const pagedClasses = filtered.slice(startIndex, startIndex + pageSize);

  renderClassTable(
    pagedClasses,
    selectedClassIds,
    (id, isChecked) => {
      if (isChecked) selectedClassIds.add(id);
      else selectedClassIds.delete(id);
    },
    handleOpenDetail,
    totalItems
  );

  renderPagination(
    { currentPage, pageSize, totalItems },
    (newPage) => {
      currentPage = newPage;
      updateAll();
    },
    (newPageSize) => {
      pageSize = newPageSize;
      currentPage = 1;
      updateAll();
    }
  );

  renderCalendar(filtered, calYear, calMonth, handleOpenDetail);
  renderStatusBreakdown(filtered);
  renderAtRiskClasses(filtered, handleOpenDetail);
  renderMeetingProgress(filtered);
}

/**
 * Opens detail modal
 */
function handleOpenDetail(id) {
  const classItem = classesState.find((c) => c.id === id);
  if (!classItem) return;

  openDetailModal(
    classItem,
    async (classId, newComment) => {
      // Save comment
      classItem.comment = newComment;
      try {
        if (classItem.docId) {
          await updateClassDoc(classItem.docId, { comment: newComment });
        }
        showToast("Catatan kelas berhasil diperbarui", "success");
      } catch (err) {
        console.error("Failed to update class comment:", err);
        showToast("Catatan disimpan lokal", "success");
      }
      closeDetailModal();
      updateAll();
    },
    async (classId, className) => {
      // Delete class
      if (!confirm(`Hapus kelas "${className || ""}"?`)) return;
      try {
        if (classItem.docId) {
          await deleteClassDoc(classItem.docId);
        }
        classesState = classesState.filter((c) => c.id !== classId);
        selectedClassIds.delete(classId);
        showToast("Kelas berhasil dihapus", "success");
      } catch (err) {
        console.error("Failed to delete class:", err);
        classesState = classesState.filter((c) => c.id !== classId);
        showToast("Kelas dihapus dari daftar lokal", "success");
      }
      closeDetailModal();
      updateAll();
    }
  );
}

/**
 * Remedial Helpers
 */
function getRemedialClassLabel(item) {
  if (!item) return "";
  const d = item.data || {};
  return d.name || d.class_name || item.id;
}

function getMentorLabel(item) {
  if (!item) return "";
  const d = item.data || {};
  return d.name || d.full_name || d.mentor_name || item.id;
}

function fillRemedialParentFields(item) {
  const d = item ? item.data || {} : {};
  const productName = document.getElementById("remedialProductName");
  const productId = document.getElementById("remedialProductId");
  const meetingTotal = document.getElementById("remedialMeetingTotal");
  const startDate = document.getElementById("remedialStartDate");
  const typeEl = document.getElementById("remedialType");
  const locationEl = document.getElementById("remedialLocation");

  if (productName) productName.value = d.productName || d.product_name || "";
  if (productId) productId.value = d.productId || d.product_id || "";
  if (meetingTotal) meetingTotal.value = d.meeting_total || d.meetingTotal || "8";
  if (startDate) startDate.value = d.date || d.start_date || d.startDate || "";
  if (typeEl) typeEl.value = d.type || "Online";
  if (locationEl) locationEl.value = d.location || "";
}

function renderSearchDropdown(listEl, items, labelFn) {
  listEl.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "px-3 py-2 text-xs text-slate-400";
    empty.textContent = "Tidak ada data ditemukan.";
    listEl.appendChild(empty);
    return;
  }
  items.forEach((item) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "search-dropdown-item w-full text-left";
    row.textContent = labelFn(item);
    row.addEventListener("click", () => {
      const input = listEl.previousElementSibling;
      if (input && input instanceof HTMLInputElement) {
        input.value = labelFn(item);
      }
      if (listEl.id === "remedialClassList") {
        selectedRemedialClass = item;
        fillRemedialParentFields(item);
        const err = document.getElementById("remedialClassError");
        if (err) err.classList.add("hidden");
      } else {
        selectedRemedialMentor = item;
        const err = document.getElementById("remedialMentorError");
        if (err) err.classList.add("hidden");
      }
      listEl.classList.add("hidden");
    });
    listEl.appendChild(row);
  });
}

function resetRemedialForm() {
  selectedRemedialClass = null;
  selectedRemedialMentor = null;
  const ids = [
    "remedialClassSearch",
    "remedialMentorSearch",
    "remedialClassName",
    "remedialProductName",
    "remedialProductId",
    "remedialStartDate",
    "remedialMeetingTotal",
    "remedialLocation",
    "remedialReason",
  ];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const typeEl = document.getElementById("remedialType");
  if (typeEl) typeEl.value = "Online";

  [
    "remedialClassNameError",
    "remedialClassError",
    "remedialMentorError",
    "remedialMeetingTotalError",
    "remedialReasonError",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add("hidden");
      el.textContent = "";
    }
  });

  const cList = document.getElementById("remedialClassList");
  if (cList) cList.classList.add("hidden");
  const mList = document.getElementById("remedialMentorList");
  if (mList) mList.classList.add("hidden");
}

function validateRemedialForm() {
  let valid = true;
  const nameInput = document.getElementById("remedialClassName");
  const meetingTotalInput = document.getElementById("remedialMeetingTotal");
  const reasonInput = document.getElementById("remedialReason");
  const classError = document.getElementById("remedialClassError");
  const mentorError = document.getElementById("remedialMentorError");
  const nameError = document.getElementById("remedialClassNameError");
  const meetingTotalError = document.getElementById("remedialMeetingTotalError");
  const reasonError = document.getElementById("remedialReasonError");

  const remedialName = nameInput ? nameInput.value.trim() : "";
  const meetingTotal = parseInt(meetingTotalInput ? meetingTotalInput.value || "0" : "0", 10) || 0;
  const remedialReason = reasonInput ? reasonInput.value.trim() : "";

  if (!remedialName) {
    if (nameError) {
      nameError.textContent = "Nama kelas wajib diisi";
      nameError.classList.remove("hidden");
    }
    valid = false;
  } else if (nameError) {
    nameError.classList.add("hidden");
  }

  if (!selectedRemedialClass) {
    if (classError) {
      classError.textContent = "Silakan pilih kelas parent";
      classError.classList.remove("hidden");
    }
    valid = false;
  } else if (classError) {
    classError.classList.add("hidden");
  }

  if (!selectedRemedialMentor) {
    if (mentorError) {
      mentorError.textContent = "Silakan pilih mentor";
      mentorError.classList.remove("hidden");
    }
    valid = false;
  } else if (mentorError) {
    mentorError.classList.add("hidden");
  }

  if (meetingTotal < 0) {
    if (meetingTotalError) {
      meetingTotalError.textContent = "Total meeting tidak boleh negatif";
      meetingTotalError.classList.remove("hidden");
    }
    valid = false;
  } else if (meetingTotalError) {
    meetingTotalError.classList.add("hidden");
  }

  if (!remedialReason) {
    if (reasonError) {
      reasonError.textContent = "Alasan remedial wajib diisi";
      reasonError.classList.remove("hidden");
    }
    valid = false;
  } else if (reasonError) {
    reasonError.classList.add("hidden");
  }

  return valid;
}

async function handleSaveRemedial() {
  const saveBtn = document.getElementById("btnSaveRemedial");
  if (!saveBtn || !validateRemedialForm()) return;

  const nameInput = document.getElementById("remedialClassName");
  const remedialName = nameInput.value.trim();
  const parentData = selectedRemedialClass.data || {};
  const mentorName = getMentorLabel(selectedRemedialMentor);
  const startDate = (document.getElementById("remedialStartDate")?.value || "").trim();
  const type = (document.getElementById("remedialType")?.value || "Online").trim();
  const location = (document.getElementById("remedialLocation")?.value || "").trim();
  const meetingTotal = parseInt(document.getElementById("remedialMeetingTotal")?.value || "0", 10) || 0;
  const remedialReason = (document.getElementById("remedialReason")?.value || "").trim();
  const productName = (document.getElementById("remedialProductName")?.value || "").trim();
  const productId = (document.getElementById("remedialProductId")?.value || "").trim();
  const parentClassName = getRemedialClassLabel(selectedRemedialClass);
  const parentLevel = parseInt(parentData.remedial_level || parentData.remedialLevel || "0", 10) || 0;
  const remedialLevel = parentLevel + 1;
  const rootClassDocId = parentData.root_class_doc_id || parentData.rootClassDocId || selectedRemedialClass.id;

  saveBtn.disabled = true;
  saveBtn.textContent = "Menyimpan...";

  try {
    const mentorInitials = mentorName
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);

    const payload = {
      name: remedialName,
      class_name: remedialName,
      variant: "remedial",
      is_remedial: true,
      parent_class_doc_id: selectedRemedialClass.id,
      parent_class_name: parentClassName,
      root_class_doc_id: rootClassDocId,
      remedial_level: remedialLevel,
      remedial_reason: remedialReason,
      productName,
      product_name: productName,
      productId,
      product_id: productId,
      mentorId: selectedRemedialMentor.id,
      mentor_id: selectedRemedialMentor.id,
      mentorName,
      mentor_name: mentorName,
      mentor: mentorName,
      mentors: [{ id: selectedRemedialMentor.id, name: mentorName, initials: mentorInitials }],
      status: "Soon",
      class_status: "Soon",
      meeting_done: 0,
      meeting_total: meetingTotal,
      meetingDone: 0,
      meetingTotal,
      current_joined: 0,
      type,
      location,
      date: startDate,
      start_date: startDate,
      startDate,
      time: "",
    };

    await saveRemedialClass(payload, selectedRemedialClass.id);
    showToast("Kelas remedial berhasil dibuat", "success");

    // Close modal & reload data
    const modal = document.getElementById("remedialModal");
    if (modal) modal.classList.remove("open");

    classesState = await fetchClasses();
    remedialClassesData = classesState.map((c) => ({ id: c.docId || c.id, data: c }));
    populateFilterOptions(classesState);
    updateAll();
  } catch (err) {
    console.error("Failed to save remedial class:", err);
    showToast("Gagal menyimpan remedial: " + err.message, "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Simpan";
  }
}

/**
 * Export to CSV
 */
function exportToCsv(list) {
  const headers = [
    "Class Name",
    "Status",
    "Start Date",
    "Location",
    "Type",
    "PIC",
    "Notify",
    "Mentor",
    "Meeting Done",
    "Meeting Total",
    "Attendance (%)",
    "Delay",
    "Reschedule",
    "Health Score",
    "Group Link",
  ];
  const rows = list.map((c) => {
    const mentorNames = Array.isArray(c.mentors)
      ? c.mentors.map((m) => m.name || "").join(" / ")
      : "";
    const done = c.meeting ? c.meeting.done || 0 : 0;
    const total = c.meeting ? c.meeting.total || 0 : 0;
    const attendance = typeof c.attendanceRate === "number" ? c.attendanceRate : 0;
    const delay = typeof c.delayCount === "number" ? c.delayCount : 0;
    const reschedule = typeof c.rescheduleCount === "number" ? c.rescheduleCount : 0;
    const hs = c.healthScore !== undefined ? c.healthScore : computeHealthScore(c);
    return [
      c.name || "",
      c.status || "",
      c.startDate || "",
      c.location || "",
      c.type || "",
      c.pic && c.pic.name ? c.pic.name : "",
      c.notify && c.notify.name ? c.notify.name : "",
      mentorNames,
      String(done),
      String(total),
      String(attendance),
      String(delay),
      String(reschedule),
      hs.toFixed(1),
      c.groupLink || "",
    ];
  });

  const csvContent = [headers]
    .concat(rows)
    .map((row) =>
      row
        .map((field) => {
          if (field === null || field === undefined) return "";
          const s = String(field);
          if (s.includes(",") || s.includes('"') || s.includes("\n")) {
            return '"' + s.replace(/"/g, '""') + '"';
          }
          return s;
        })
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `class-management-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("File CSV berhasil diunduh", "success");
}

/**
 * Main Initialization
 */
document.addEventListener("DOMContentLoaded", async () => {
  // 1. Auth Guard
  const user = await requireAuth();
  if (!user) return;

  // 2. Mount App Shell
  const topbarMount = document.getElementById("dg-topbar-mount");
  if (topbarMount) renderTopBar(topbarMount);

  const sidebarMount = document.getElementById("dg-sidebar-mount");
  if (sidebarMount) renderSidebar(sidebarMount);

  // 3. Load Data from Repository
  classesState = await fetchClasses();
  mentorsData = await fetchMentors();
  remedialClassesData = classesState.map((c) => ({ id: c.docId || c.id, data: c }));

  populateFilterOptions(classesState);
  updateAll();

  // 4. Bind Search & Filter Listeners
  const searchInput = document.getElementById("searchClass");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      currentFilters.search = searchInput.value.trim();
      currentPage = 1;
      updateAll();
    });
  }

  const filterStatus = document.getElementById("filterStatus");
  if (filterStatus) {
    filterStatus.addEventListener("change", () => {
      currentFilters.status = filterStatus.value;
      currentPage = 1;
      updateAll();
    });
  }

  const filterMentor = document.getElementById("filterMentor");
  if (filterMentor) {
    filterMentor.addEventListener("change", () => {
      currentFilters.mentor = filterMentor.value;
      currentPage = 1;
      updateAll();
    });
  }

  const filterPic = document.getElementById("filterPic");
  if (filterPic) {
    filterPic.addEventListener("change", () => {
      currentFilters.pic = filterPic.value;
      currentPage = 1;
      updateAll();
    });
  }

  const filterLocation = document.getElementById("filterLocation");
  if (filterLocation) {
    filterLocation.addEventListener("change", () => {
      currentFilters.location = filterLocation.value;
      currentPage = 1;
      updateAll();
    });
  }

  const filterType = document.getElementById("filterType");
  if (filterType) {
    filterType.addEventListener("change", () => {
      currentFilters.type = filterType.value;
      currentPage = 1;
      updateAll();
    });
  }

  const filterStall = document.getElementById("filterStall");
  if (filterStall) {
    filterStall.addEventListener("change", () => {
      currentFilters.stall = filterStall.value;
      currentPage = 1;
      updateAll();
    });
  }

  const filterDateFrom = document.getElementById("filterDateFrom");
  if (filterDateFrom) {
    filterDateFrom.addEventListener("change", () => {
      currentFilters.dateFrom = filterDateFrom.value;
      currentPage = 1;
      updateAll();
    });
  }

  const filterDateTo = document.getElementById("filterDateTo");
  if (filterDateTo) {
    filterDateTo.addEventListener("change", () => {
      currentFilters.dateTo = filterDateTo.value;
      currentPage = 1;
      updateAll();
    });
  }

  const toggleFilter = document.getElementById("btnToggleFilter");
  const filterPanel = document.getElementById("filterPanel");
  if (toggleFilter && filterPanel) {
    toggleFilter.addEventListener("click", () => {
      filterPanel.classList.toggle("hidden");
    });
  }

  // 5. Sort Headers
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
      const sortLabel = document.getElementById("sortLabel");
      if (sortLabel) {
        const arrow = currentSort.dir === "asc" ? "↑" : "↓";
        let label = field;
        if (field === "startDate") label = "Start Date";
        if (field === "status") label = "Status";
        if (field === "name") label = "Name";
        if (field === "health") label = "Health";
        sortLabel.textContent = `${label} ${arrow}`;
      }
      currentPage = 1;
      updateAll();
    });
  });

  // 6. Check All Checkbox
  const checkAll = document.getElementById("checkAllClass");
  if (checkAll) {
    checkAll.addEventListener("change", () => {
      selectedClassIds.clear();
      if (checkAll.checked) {
        applyFilters().forEach((c) => selectedClassIds.add(c.id));
      }
      updateAll();
    });
  }

  // 7. Export Dropdown & CSV
  const btnExportMenu = document.getElementById("btnExportMenu");
  const exportDropdown = document.getElementById("exportDropdown");
  const btnExportCsv = document.getElementById("btnExportCsv");
  const btnExportExcel = document.getElementById("btnExportExcel");

  if (btnExportMenu && exportDropdown) {
    btnExportMenu.addEventListener("click", () => {
      exportDropdown.classList.toggle("hidden");
    });
    document.addEventListener("click", (e) => {
      if (!exportDropdown.contains(e.target) && !btnExportMenu.contains(e.target)) {
        exportDropdown.classList.add("hidden");
      }
    });
  }

  if (btnExportCsv) {
    btnExportCsv.addEventListener("click", () => {
      exportToCsv(applyFilters());
      if (exportDropdown) exportDropdown.classList.add("hidden");
    });
  }
  if (btnExportExcel) {
    btnExportExcel.addEventListener("click", () => {
      exportToCsv(applyFilters());
      if (exportDropdown) exportDropdown.classList.add("hidden");
    });
  }

  // 8. View Toggle: Table vs Calendar
  const btnVT = document.getElementById("btnViewTable");
  const btnVC = document.getElementById("btnViewCalendar");
  const tableEl = document.getElementById("tableView");
  const calEl = document.getElementById("calendarView");

  function setView(view) {
    currentView = view;
    if (view === "calendar") {
      if (tableEl) tableEl.classList.add("hidden");
      if (calEl) calEl.classList.remove("hidden");
      if (btnVT) btnVT.classList.remove("bg-slate-900", "text-white");
      if (btnVT) btnVT.classList.add("bg-white", "text-slate-700");
      if (btnVC) btnVC.classList.remove("bg-white", "text-slate-700");
      if (btnVC) btnVC.classList.add("bg-slate-900", "text-white");
    } else {
      if (tableEl) tableEl.classList.remove("hidden");
      if (calEl) calEl.classList.add("hidden");
      if (btnVT) btnVT.classList.add("bg-slate-900", "text-white");
      if (btnVT) btnVT.classList.remove("bg-white", "text-slate-700");
      if (btnVC) btnVC.classList.add("bg-white", "text-slate-700");
      if (btnVC) btnVC.classList.remove("bg-slate-900", "text-white");
    }
  }

  if (btnVT) btnVT.addEventListener("click", () => setView("table"));
  if (btnVC) btnVC.addEventListener("click", () => setView("calendar"));

  // 9. Calendar Navigation
  const calPrev = document.getElementById("calPrev");
  const calNext = document.getElementById("calNext");
  const calTodayBtn = document.getElementById("calToday");

  if (calPrev) {
    calPrev.addEventListener("click", () => {
      calMonth--;
      if (calMonth < 0) {
        calMonth = 11;
        calYear--;
      }
      renderCalendar(applyFilters(), calYear, calMonth, handleOpenDetail);
    });
  }
  if (calNext) {
    calNext.addEventListener("click", () => {
      calMonth++;
      if (calMonth > 11) {
        calMonth = 0;
        calYear++;
      }
      renderCalendar(applyFilters(), calYear, calMonth, handleOpenDetail);
    });
  }
  if (calTodayBtn) {
    calTodayBtn.addEventListener("click", () => {
      const now = new Date();
      calYear = now.getFullYear();
      calMonth = now.getMonth();
      renderCalendar(applyFilters(), calYear, calMonth, handleOpenDetail);
    });
  }

  // 10. Remedial Modal
  const btnOpenRemedial = document.getElementById("btnOpenRemedial");
  const remedialModal = document.getElementById("remedialModal");
  const btnCloseRemedial = document.getElementById("btnCloseRemedial");
  const remedialClassSearch = document.getElementById("remedialClassSearch");
  const remedialMentorSearch = document.getElementById("remedialMentorSearch");
  const btnSaveRemedial = document.getElementById("btnSaveRemedial");

  if (btnOpenRemedial) {
    btnOpenRemedial.addEventListener("click", () => {
      resetRemedialForm();
      if (remedialModal) remedialModal.classList.add("open");
    });
  }
  if (btnCloseRemedial && remedialModal) {
    btnCloseRemedial.addEventListener("click", () => {
      remedialModal.classList.remove("open");
    });
    remedialModal.addEventListener("click", (e) => {
      if (e.target === remedialModal) remedialModal.classList.remove("open");
    });
  }

  if (remedialClassSearch) {
    const filterClassSearch = () => {
      const q = (remedialClassSearch.value || "").toLowerCase();
      const list = document.getElementById("remedialClassList");
      if (!list) return;
      const filtered = remedialClassesData.filter((item) =>
        getRemedialClassLabel(item).toLowerCase().includes(q)
      );
      renderSearchDropdown(list, filtered, getRemedialClassLabel);
      list.classList.remove("hidden");
      selectedRemedialClass = null;
      fillRemedialParentFields(null);
    };
    remedialClassSearch.addEventListener("input", filterClassSearch);
    remedialClassSearch.addEventListener("focus", filterClassSearch);
  }

  if (remedialMentorSearch) {
    const filterMentorSearch = () => {
      const q = (remedialMentorSearch.value || "").toLowerCase();
      const list = document.getElementById("remedialMentorList");
      if (!list) return;
      const filtered = mentorsData.filter((item) =>
        getMentorLabel(item).toLowerCase().includes(q)
      );
      renderSearchDropdown(list, filtered, getMentorLabel);
      list.classList.remove("hidden");
      selectedRemedialMentor = null;
    };
    remedialMentorSearch.addEventListener("input", filterMentorSearch);
    remedialMentorSearch.addEventListener("focus", filterMentorSearch);
  }

  if (btnSaveRemedial) {
    btnSaveRemedial.addEventListener("click", handleSaveRemedial);
  }

  // Click outside search dropdowns
  document.addEventListener("click", (e) => {
    const classList = document.getElementById("remedialClassList");
    const mentorList = document.getElementById("remedialMentorList");
    const classInput = document.getElementById("remedialClassSearch");
    const mentorInput = document.getElementById("remedialMentorSearch");
    if (classList && classInput && !classList.contains(e.target) && e.target !== classInput) {
      classList.classList.add("hidden");
    }
    if (mentorList && mentorInput && !mentorList.contains(e.target) && e.target !== mentorInput) {
      mentorList.classList.add("hidden");
    }
  });

  // 11. Add Class Modal
  const btnOpenAddClass = document.getElementById("btnOpenAddClass");
  const btnCloseAddClass = document.getElementById("btnCloseAddClass");
  const btnAddClassCancel = document.getElementById("btnAddClassCancel");
  const addClassModal = document.getElementById("addClassModal");

  if (btnOpenAddClass) {
    btnOpenAddClass.addEventListener("click", () => {
      openAddClassModal(async (newClassData) => {
        try {
          const newDocId = await saveNewClass(newClassData);
          classesState.unshift({
            ...newClassData,
            id: newDocId || `c_${Date.now()}`,
            docId: newDocId,
            meeting: { done: newClassData.meeting_done, total: newClassData.meeting_total },
          });
          showToast("Kelas baru berhasil didaftarkan", "success");
        } catch (err) {
          console.error("Failed to add class:", err);
          classesState.unshift({
            ...newClassData,
            id: `c_${Date.now()}`,
            meeting: { done: newClassData.meeting_done, total: newClassData.meeting_total },
          });
          showToast("Kelas ditambahkan ke daftar lokal", "success");
        }
        closeAddClassModal();
        updateAll();
      });
    });
  }

  if (btnCloseAddClass) btnCloseAddClass.addEventListener("click", closeAddClassModal);
  if (btnAddClassCancel) btnAddClassCancel.addEventListener("click", closeAddClassModal);
  if (addClassModal) {
    addClassModal.addEventListener("click", (e) => {
      if (e.target === addClassModal) closeAddClassModal();
    });
  }

  // 12. Detail Modal tabs & close
  const btnCloseDetail = document.getElementById("btnCloseDetail");
  const detailModal = document.getElementById("classDetailModal");
  if (btnCloseDetail) btnCloseDetail.addEventListener("click", closeDetailModal);
  if (detailModal) {
    detailModal.addEventListener("click", (e) => {
      if (e.target === detailModal) closeDetailModal();
    });
  }

  document.querySelectorAll("#detailTabList button[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      if (tab) {
        document.querySelectorAll("#detailTabList button").forEach((b) => {
          b.classList.remove("tab-pill-active");
          b.classList.add("tab-pill-inactive");
        });
        btn.classList.add("tab-pill-active");
        btn.classList.remove("tab-pill-inactive");

        ["overview", "schedule", "attendance", "members", "files"].forEach((t) => {
          const panel = document.getElementById(`tab-${t}`);
          if (panel) {
            if (t === tab) panel.classList.remove("hidden");
            else panel.classList.add("hidden");
          }
        });
      }
    });
  });
});
