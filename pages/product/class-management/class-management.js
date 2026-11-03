/**
 * class-management.js
 * Feature Controller / Orchestrator for Class Management.
 */

import { renderTopBar } from "/element/topbar.js";
import { renderSidebar } from "/element/sidebar.js";
import { requireAuth } from "/assets/js/auth-guard.js";
import { confirmDialog, alertDialog } from "/assets/js/ui.js";
import {
  fetchClasses,
  fetchMentors,
  fetchPlanningItems,
  saveRemedialClass,
  saveNewClass,
  updateClassDoc,
  deleteClassDoc,
  exportClassManagementData,
  FALLBACK_CLASSES,
  fetchRemedialReports,
  saveRemedialReport,
  updateRemedialStatusDoc,
  updateRemedialScheduleDoc,
  deleteRemedialReportDoc,
  addRemedialCommentDoc,
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
  initClassExportModal,
  showToast,
  mountSidebarClassErdButton,
  initClassErdModalControls,
  positionGlider,
  getRemedialStatusStyle,
  getClickUpStatusMeta,
  formatClickUpPhone,
  formatClickUpDate,
  parseItemDateKey,
  parseItemTimeStr,
  getClassDates,
  getItemCommentCount,
  renderClickUpMeetingBadges,
  renderClickUpMentorBadge,
  renderRemedialKPIs,
  renderRemedialBoard,
  renderRemedialCalendar,
  renderRemedialList,
  openRemedialScheduleModal,
  renderScheduleClassSuggestions,
  closeRemedialScheduleModal,
  openRemedialDayAgendaModal,
  closeRemedialDayAgendaModal,
  openClickupCommentPopup,
  closeClickupCommentPopup,
  renderRemedialCommentsList,
  updateCommentCountInTable,
  populateRemedialMentorDropdown,
  openRemedialSubmissionModal,
  closeRemedialSubmissionModal,
} from "./class-management.ui.js";

// State: Classes
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

// State: Remedial Management
let activeMainView = "classes"; // "classes" | "remedial"
let remedialSubView = "board"; // "board" | "calendar" | "list"
let remedialReports = [];
let remedialCalYear = new Date().getFullYear();
let remedialCalMonth = new Date().getMonth();
let remedialDateMode = "schedule"; // "schedule" | "created"
let showCheckupLayer = true;
let activeScheduleItemId = null;
let activeCommentItemId = null;
let collapsedRemedialGroups = new Set();
let adminSelectedMeetings = new Set();
let itiAdminPhone = null;

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
      const confirmed = await confirmDialog(`Hapus kelas "${className || ""}"?`, {
        title: "Hapus Kelas",
        confirmText: "Ya, Hapus"
      });
      if (!confirmed) return;
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
 * ==========================================================================
 * Dedicated Remedial Management Orchestrator (Board, Calendar, List & Modals)
 * ==========================================================================
 */

function toggleAdminMeetingDropdown(forceState) {
  const panel = document.getElementById("adminMeetingDropdownPanel");
  const toggle = document.getElementById("adminMeetingDropdownToggle");
  const chevron = document.getElementById("adminMeetingDropdownChevron");
  if (!panel) return;
  const shouldOpen = typeof forceState === "boolean" ? forceState : panel.classList.contains("hidden");
  if (shouldOpen) {
    panel.classList.remove("hidden");
    toggle?.setAttribute("aria-expanded", "true");
    if (chevron) chevron.style.transform = "rotate(180deg)";
  } else {
    panel.classList.add("hidden");
    toggle?.setAttribute("aria-expanded", "false");
    if (chevron) chevron.style.transform = "rotate(0deg)";
  }
}

function updateAdminMeetingDropdownUI() {
  const label = document.getElementById("adminMeetingDropdownLabel");
  const badge = document.getElementById("adminMeetingDropdownBadge");
  const footerCount = document.getElementById("adminMeetingDropdownFooterCount");
  const tagsContainer = document.getElementById("adminSelectedMeetingsTagsContainer");
  const pillsList = document.getElementById("adminSelectedMeetingsPillsList");
  const errEl = document.getElementById("errRemedialMeeting");

  if (adminSelectedMeetings.size > 0 && errEl) {
    errEl.classList.add("hidden");
  }

  const sorted = Array.from(adminSelectedMeetings).sort((a, b) => a - b);
  const count = sorted.length;

  if (count === 0) {
    if (label) {
      label.textContent = "Pilih pertemuan yang tidak bisa dihadiri...";
      label.className = "text-xs text-slate-400 font-medium truncate";
    }
    if (badge) badge.classList.add("hidden");
    if (footerCount) footerCount.textContent = "Belum ada pertemuan dipilih";
    if (tagsContainer) tagsContainer.classList.add("hidden");
    if (pillsList) pillsList.innerHTML = "";
  } else {
    const text =
      count === 1
        ? `Pertemuan ${sorted[0]}`
        : `${count} Pertemuan: Pertemuan ${sorted.join(", ")}`;
    if (label) {
      label.textContent = text;
      label.className = "text-xs text-slate-800 font-semibold truncate";
    }
    if (badge) {
      badge.textContent = `${count} dipilih`;
      badge.classList.remove("hidden");
    }
    if (footerCount) {
      footerCount.textContent = `${count} pertemuan dipilih`;
    }

    if (pillsList) {
      pillsList.innerHTML = sorted
        .map(
          (num) => `
        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-900 text-[11px] font-semibold">
          <span>P ${num}</span>
          <button type="button" class="btn-admin-remove-tag text-sky-400 hover:text-rose-600 transition p-0.5 rounded cursor-pointer leading-none font-bold" data-meeting="${num}" title="Hapus pertemuan ${num}">
            &times;
          </button>
        </span>
      `
        )
        .join("");

      pillsList.querySelectorAll(".btn-admin-remove-tag").forEach((btn) => {
        btn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const num = parseInt(btn.dataset.meeting, 10);
          adminSelectedMeetings.delete(num);
          syncAdminCheckboxStates();
          updateAdminMeetingDropdownUI();
        });
      });
    }
    if (tagsContainer) tagsContainer.classList.remove("hidden");
  }
}

function syncAdminCheckboxStates() {
  document.querySelectorAll("#adminMeetingCheckboxList .admin-meeting-check-label").forEach((lbl) => {
    const num = parseInt(lbl.dataset.meeting, 10);
    const input = lbl.querySelector(".admin-meeting-check-input");
    const isChecked = adminSelectedMeetings.has(num);
    if (input) input.checked = isChecked;
    if (isChecked) {
      lbl.classList.add("checked");
    } else {
      lbl.classList.remove("checked");
    }
  });
}

function clearAdminMeetingSelection() {
  adminSelectedMeetings.clear();
  syncAdminCheckboxStates();
  updateAdminMeetingDropdownUI();
}

function openNewRemedialModal(defaultStatus = "REQUEST", defaultScheduleDate = "") {
  clearAdminMeetingSelection();
  toggleAdminMeetingDropdown(false);
  openRemedialSubmissionModal(defaultStatus, defaultScheduleDate);
}

async function handleRemedialFormSubmit(e) {
  e.preventDefault();
  const nameInput = document.getElementById("remedialFormName");
  const phoneInput = document.getElementById("remedialFormPhone");
  const classInput = document.getElementById("remedialFormClass");
  const mentorSelect = document.getElementById("remedialFormMentor");
  const statusSelect = document.getElementById("remedialFormStatus");
  const dateInput = document.getElementById("remedialFormScheduleDate");
  const reasonInput = document.getElementById("remedialFormReason");

  const nameVal = (nameInput?.value || "").trim();
  let phoneVal = (phoneInput?.value || "").trim();
  if (itiAdminPhone && itiAdminPhone.isValidNumber()) {
    phoneVal = itiAdminPhone.getNumber();
  }
  const classVal = (classInput?.value || "").trim();
  const mentorVal = mentorSelect?.value || "";
  const statusVal = statusSelect?.value || "REQUEST";
  const dateVal = dateInput?.value || null;
  const reasonVal = (reasonInput?.value || "").trim();

  let hasError = false;
  const showErr = (id, msg) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = msg;
      el.classList.remove("hidden");
    }
  };
  const hideErr = (id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  };

  if (!nameVal) {
    showErr("errRemedialName", "Nama member wajib diisi.");
    hasError = true;
  } else {
    hideErr("errRemedialName");
  }

  if (!phoneVal) {
    showErr("errRemedialPhone", "Nomor WhatsApp wajib diisi.");
    hasError = true;
  } else {
    hideErr("errRemedialPhone");
  }

  if (!mentorVal) {
    showErr("errRemedialMentor", "Pilih mentor.");
    hasError = true;
  } else {
    hideErr("errRemedialMentor");
  }

  if (adminSelectedMeetings.size === 0) {
    showErr("errRemedialMeeting", "Pilih minimal 1 pertemuan yang tidak dihadiri.");
    hasError = true;
  } else {
    hideErr("errRemedialMeeting");
  }

  if (!reasonVal) {
    showErr("errRemedialReason", "Alasan remedial wajib diisi.");
    hasError = true;
  } else {
    hideErr("errRemedialReason");
  }

  if (hasError) return;

  const sortedMeetings = Array.from(adminSelectedMeetings).sort((a, b) => a - b);
  const meetingMissedStr = sortedMeetings.map((n) => `Pertemuan ${n}`).join(", ");

  const newReport = {
    name: nameVal,
    nama: nameVal,
    phone: phoneVal,
    whatsapp: phoneVal,
    email: "",
    group_whatsapp: classVal,
    class_name: classVal,
    mentor_name: mentorVal,
    mentor_id: "",
    meeting_number: sortedMeetings[0],
    meeting_numbers: sortedMeetings,
    meeting_missed: meetingMissedStr,
    reason: reasonVal,
    status: statusVal,
    schedule_date: dateVal,
    scheduled_date: dateVal,
    source: "internal_form",
    comments: [],
    comments_count: 0,
    created_at: new Date().toISOString(),
  };

  const saveBtn = document.getElementById("btnSaveRemedial");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Menyimpan...";
  }

  try {
    const docId = await saveRemedialReport(newReport);
    newReport.id = docId || "rem-" + Date.now();
    remedialReports.unshift(newReport);
    closeRemedialSubmissionModal();
    updateAllRemedialViews();
    showToast("Pengajuan remedial berhasil disimpan ke board!", "success");
  } catch (err) {
    console.error("Gagal simpan remedial:", err);
    newReport.id = "rem-local-" + Date.now();
    remedialReports.unshift(newReport);
    closeRemedialSubmissionModal();
    updateAllRemedialViews();
    showToast("Disimpan ke board lokal", "success");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> Simpan Pengajuan`;
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

async function loadRemedialReportsData() {
  try {
    remedialReports = await fetchRemedialReports();
  } catch (err) {
    console.warn("Using sample remedial reports:", err);
  }
  updateAllRemedialViews();
}

function getFilteredRemedialReports() {
  const searchVal = (document.getElementById("searchRemedial")?.value || "").toLowerCase().trim();
  const filterMentor = document.getElementById("filterRemedialMentor")?.value || "";
  const filterMeeting = document.getElementById("filterRemedialMeeting")?.value || "";

  return remedialReports.filter((item) => {
    if (searchVal) {
      const currentClass = item.group_whatsapp || item.class_name || "";
      const target = `${item.name} ${currentClass} ${item.phone} ${item.mentor_name} ${item.reason} ${item.meeting_missed}`.toLowerCase();
      if (!target.includes(searchVal)) return false;
    }
    if (filterMentor && item.mentor_name !== filterMentor) {
      return false;
    }
    if (filterMeeting) {
      const mTarget = parseInt(filterMeeting, 10);
      const matchesMeeting = Array.isArray(item.meeting_numbers)
        ? item.meeting_numbers.includes(mTarget)
        : parseInt(item.meeting_number, 10) === mTarget || String(item.meeting_missed || "").includes(filterMeeting);
      if (!matchesMeeting) return false;
    }
    return true;
  });
}

function updateAllRemedialViews() {
  const counts = {
    REQUEST: 0,
    CONTACT: 0,
    PROCESS: 0,
    SCHEDULE: 0,
    STALL: 0,
    COMPLETE: 0,
  };
  remedialReports.forEach((item) => {
    const s = (item.status || "REQUEST").toUpperCase();
    if (counts[s] !== undefined) counts[s]++;
  });
  renderRemedialKPIs(counts);

  const filtered = getFilteredRemedialReports();

  if (remedialSubView === "board") {
    renderRemedialBoard(
      filtered,
      handleUpdateRemedialStatus,
      handleOpenRemedialComments,
      handleDeleteRemedial,
      handleOpenRemedialSchedule
    );
  } else if (remedialSubView === "calendar") {
    renderRemedialCalendar(
      filtered,
      remedialCalYear,
      remedialCalMonth,
      remedialDateMode,
      showCheckupLayer,
      classesState,
      handleDayClick,
      handleOpenRemedialSchedule,
      (dateKey) => openNewRemedialModal("SCHEDULE", `${dateKey}T19:00`),
      handleOpenRemedialSchedule
    );
  } else if (remedialSubView === "list") {
    renderRemedialList(
      filtered,
      collapsedRemedialGroups,
      (statusKey) => {
        if (collapsedRemedialGroups.has(statusKey)) {
          collapsedRemedialGroups.delete(statusKey);
        } else {
          collapsedRemedialGroups.add(statusKey);
        }
        updateAllRemedialViews();
      },
      handleUpdateRemedialStatus,
      handleOpenRemedialComments,
      handleOpenRemedialSchedule,
      handleOpenRemedialSchedule,
      (statusKey) => openNewRemedialModal(statusKey)
    );
  }

  if (window.lucide) window.lucide.createIcons();
}

function switchMainView(view, isInitial = false) {
  activeMainView = view;
  const classesViewEl = document.getElementById("classesView");
  const remedialViewEl = document.getElementById("remedialView");
  const btnViewClasses = document.getElementById("btnViewClasses");
  const btnOpenRemedial = document.getElementById("btnOpenRemedial");
  const mainGlider = document.getElementById("mainViewGlider");

  if (view === "remedial") {
    if (classesViewEl) classesViewEl.classList.add("hidden");
    if (remedialViewEl) {
      remedialViewEl.classList.remove("hidden");
      remedialViewEl.classList.remove("view-slide-from-left", "view-slide-from-right", "view-fade-enter");
      if (!isInitial) {
        void remedialViewEl.offsetWidth;
        remedialViewEl.classList.add("view-slide-from-right");
        if (window.scrollY > 140) {
          window.scrollTo({ top: 90, behavior: "smooth" });
        }
      }
    }

    if (mainGlider && btnOpenRemedial) {
      mainGlider.className = "absolute rounded-xl pointer-events-none bg-sky-600 shadow-md shadow-sky-600/30";
      positionGlider(mainGlider, btnOpenRemedial, isInitial);
    }
    if (btnOpenRemedial) {
      btnOpenRemedial.classList.add("is-active");
      btnOpenRemedial.className =
        "relative z-10 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 cursor-pointer text-white active:scale-95 is-active";
      const icon = btnOpenRemedial.querySelector("i, svg");
      if (icon) {
        icon.setAttribute("class", "w-3.5 h-3.5 transition-colors duration-200 text-white");
        icon.style.color = "#ffffff";
        icon.style.stroke = "#ffffff";
      }
    }
    if (btnViewClasses) {
      btnViewClasses.classList.remove("is-active");
      btnViewClasses.className =
        "relative z-10 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 cursor-pointer text-slate-600 hover:text-slate-900 active:scale-95";
      const icon = btnViewClasses.querySelector("i, svg");
      if (icon) {
        icon.setAttribute("class", "w-3.5 h-3.5 transition-colors duration-200 text-slate-500");
        icon.style.color = "#64748b";
        icon.style.stroke = "#64748b";
      }
    }

    if (!remedialReports.length) {
      loadRemedialReportsData();
    } else {
      updateAllRemedialViews();
    }

    requestAnimationFrame(() => {
      syncRemedialSubViewGlider(true);
    });

    try {
      history.replaceState(null, "", "?view=remedial");
    } catch (e) {}
  } else {
    if (remedialViewEl) remedialViewEl.classList.add("hidden");
    if (classesViewEl) {
      classesViewEl.classList.remove("hidden");
      classesViewEl.classList.remove("view-slide-from-left", "view-slide-from-right", "view-fade-enter");
      if (!isInitial) {
        void classesViewEl.offsetWidth;
        classesViewEl.classList.add("view-slide-from-left");
        if (window.scrollY > 140) {
          window.scrollTo({ top: 90, behavior: "smooth" });
        }
      }
    }

    if (mainGlider && btnViewClasses) {
      mainGlider.className = "absolute rounded-xl pointer-events-none bg-white shadow-sm";
      positionGlider(mainGlider, btnViewClasses, isInitial);
    }
    if (btnViewClasses) {
      btnViewClasses.classList.add("is-active");
      btnViewClasses.className =
        "relative z-10 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 cursor-pointer text-slate-900 active:scale-95 is-active";
      const icon = btnViewClasses.querySelector("i, svg");
      if (icon) {
        icon.setAttribute("class", "w-3.5 h-3.5 transition-colors duration-200 text-slate-700");
        icon.style.color = "#334155";
        icon.style.stroke = "#334155";
      }
    }
    if (btnOpenRemedial) {
      btnOpenRemedial.classList.remove("is-active");
      btnOpenRemedial.className =
        "relative z-10 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 cursor-pointer text-slate-600 hover:text-slate-900 active:scale-95";
      const icon = btnOpenRemedial.querySelector("i, svg");
      if (icon) {
        icon.setAttribute("class", "w-3.5 h-3.5 transition-colors duration-200 text-sky-600");
        icon.style.color = "#0284c7";
        icon.style.stroke = "#0284c7";
      }
    }

    try {
      history.replaceState(null, "", window.location.pathname);
    } catch (e) {}

    updateAll();
  }

  if (window.lucide) window.lucide.createIcons();
}

function syncRemedialSubViewGlider(isInitial = false) {
  const subGlider = document.getElementById("remedialSubViewGlider");
  let activeBtn = document.getElementById("btnRemedialSubViewBoard");
  if (remedialSubView === "calendar") {
    activeBtn = document.getElementById("btnRemedialSubViewCalendar");
  } else if (remedialSubView === "list") {
    activeBtn = document.getElementById("btnRemedialSubViewList");
  }
  if (subGlider && activeBtn) {
    positionGlider(subGlider, activeBtn, isInitial);
  }
}

function switchRemedialSubView(subView, isInitial = false) {
  remedialSubView = subView;
  const boardEl = document.getElementById("remedialBoardContainer");
  const calEl = document.getElementById("remedialCalendarContainer");
  const listEl = document.getElementById("remedialListContainer");
  const btnBoard = document.getElementById("btnRemedialSubViewBoard");
  const btnCal = document.getElementById("btnRemedialSubViewCalendar");
  const btnList = document.getElementById("btnRemedialSubViewList");
  const subGlider = document.getElementById("remedialSubViewGlider");

  const setBtnState = (btn, isActive) => {
    if (!btn) return;
    const icon = btn.querySelector("i, svg");
    if (isActive) {
      btn.classList.add("is-active");
      btn.className =
        "relative z-10 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 text-slate-900 cursor-pointer active:scale-95 is-active";
      if (icon) {
        icon.setAttribute("class", "w-3.5 h-3.5 transition-colors duration-200 text-sky-600");
        icon.style.color = "#0284c7";
        icon.style.stroke = "#0284c7";
      }
    } else {
      btn.classList.remove("is-active");
      btn.className =
        "relative z-10 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 text-slate-600 hover:text-slate-900 cursor-pointer active:scale-95";
      if (icon) {
        icon.setAttribute("class", "w-3.5 h-3.5 transition-colors duration-200 text-slate-400");
        icon.style.color = "#94a3b8";
        icon.style.stroke = "#94a3b8";
      }
    }
  };

  if (subView === "calendar") {
    if (boardEl) boardEl.classList.add("hidden");
    if (listEl) listEl.classList.add("hidden");
    if (calEl) {
      calEl.classList.remove("hidden");
      calEl.classList.remove("view-slide-from-left", "view-slide-from-right", "view-fade-enter");
      if (!isInitial) {
        void calEl.offsetWidth;
        calEl.classList.add("view-slide-from-right");
      }
    }

    if (subGlider && btnCal) {
      subGlider.className = "absolute rounded-xl bg-white shadow-sm pointer-events-none";
      positionGlider(subGlider, btnCal, isInitial);
    }
    setBtnState(btnBoard, false);
    setBtnState(btnCal, true);
    setBtnState(btnList, false);

    try {
      history.replaceState(null, "", "?view=remedial&subview=calendar");
    } catch (e) {}
  } else if (subView === "list") {
    if (boardEl) boardEl.classList.add("hidden");
    if (calEl) calEl.classList.add("hidden");
    if (listEl) {
      listEl.classList.remove("hidden");
      listEl.classList.remove("view-slide-from-left", "view-slide-from-right", "view-fade-enter");
      if (!isInitial) {
        void listEl.offsetWidth;
        listEl.classList.add("view-slide-from-right");
      }
    }

    if (subGlider && btnList) {
      subGlider.className = "absolute rounded-xl bg-white shadow-sm pointer-events-none";
      positionGlider(subGlider, btnList, isInitial);
    }
    setBtnState(btnBoard, false);
    setBtnState(btnCal, false);
    setBtnState(btnList, true);

    try {
      history.replaceState(null, "", "?view=remedial&subview=list");
    } catch (e) {}
  } else {
    if (calEl) calEl.classList.add("hidden");
    if (listEl) listEl.classList.add("hidden");
    if (boardEl) {
      boardEl.classList.remove("hidden");
      boardEl.classList.remove("view-slide-from-left", "view-slide-from-right", "view-fade-enter");
      if (!isInitial) {
        void boardEl.offsetWidth;
        boardEl.classList.add("view-slide-from-left");
      }
    }

    if (subGlider && btnBoard) {
      subGlider.className = "absolute rounded-xl bg-white shadow-sm pointer-events-none";
      positionGlider(subGlider, btnBoard, isInitial);
    }
    setBtnState(btnBoard, true);
    setBtnState(btnCal, false);
    setBtnState(btnList, false);

    try {
      history.replaceState(null, "", "?view=remedial");
    } catch (e) {}
  }

  updateAllRemedialViews();
}

function setupRemedialDragAndDrop() {
  document.querySelectorAll(".remedial-col").forEach((col) => {
    const colStatus = col.getAttribute("data-status");

    col.ondragover = (e) => {
      e.preventDefault();
      col.classList.add("drag-over");
    };
    col.ondragleave = () => {
      col.classList.remove("drag-over");
    };
    col.ondrop = async (e) => {
      e.preventDefault();
      col.classList.remove("drag-over");
      const itemId = e.dataTransfer.getData("text/plain");
      if (itemId && colStatus) {
        await handleUpdateRemedialStatus(itemId, colStatus);
      }
    };
  });
}

async function handleUpdateRemedialStatus(itemId, newStatus) {
  const item = remedialReports.find((r) => r.id === itemId);
  if (!item) return;

  item.status = newStatus;
  updateAllRemedialViews();

  try {
    await updateRemedialStatusDoc(itemId, newStatus);
    showToast(`Status ${item.name} berhasil diubah ke ${newStatus}`, "success");
  } catch (err) {
    console.warn("Gagal update status di Firestore:", err);
    showToast(`Status diubah ke ${newStatus} (lokal)`, "success");
  }
}

async function handleDeleteRemedial(itemId, name) {
  const confirmed = await confirmDialog(`Hapus pengajuan remedial untuk ${name || "member ini"}?`);
  if (!confirmed) return;

  remedialReports = remedialReports.filter((r) => r.id !== itemId);
  updateAllRemedialViews();

  try {
    await deleteRemedialReportDoc(itemId);
    showToast("Pengajuan remedial berhasil dihapus", "success");
  } catch (err) {
    console.warn("Gagal menghapus dari Firestore:", err);
    showToast("Pengajuan dihapus dari board lokal", "success");
  }
}

function handleOpenRemedialSchedule(itemId) {
  const item = remedialReports.find((r) => r.id === itemId);
  if (!item) return;
  activeScheduleItemId = itemId;

  openRemedialScheduleModal(
    item,
    classesState,
    (chosenClass, targetDate, timeStr) => {
      // Pick suggestion
    },
    async (id, newDate, newStatus) => {
      item.schedule_date = newDate;
      item.scheduled_date = newDate;
      item.status = newStatus;
      closeRemedialScheduleModal();
      updateAllRemedialViews();

      try {
        await updateRemedialScheduleDoc(id, newDate, newStatus);
        showToast(`Jadwal untuk ${item.name} berhasil disimpan!`, "success");
      } catch (err) {
        console.warn("Gagal update jadwal ke Firestore:", err);
        showToast("Jadwal disimpan secara lokal.", "success");
      }
    },
    async (id, name) => {
      closeRemedialScheduleModal();
      await handleDeleteRemedial(id, name);
    },
    (id) => {
      handleOpenRemedialComments(id);
    },
    () => {
      activeScheduleItemId = null;
    }
  );
}

function handleOpenRemedialComments(itemId) {
  const item = remedialReports.find((r) => r.id === itemId);
  if (!item) return;
  activeCommentItemId = itemId;

  openClickupCommentPopup(
    item,
    async (id, text) => {
      const topbarName = document.querySelector(
        "#topbarContainer .user-name, header .user-name, .font-bold"
      )?.textContent?.trim();
      const authorName = topbarName || "Tim Dialogika";
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, "0");
      const mins = String(now.getMinutes()).padStart(2, "0");
      const timeStr = `Today at ${hours}:${mins}`;

      const newCmt = {
        id: "cmt-" + Date.now(),
        author: authorName,
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80",
        time: timeStr,
        text: text,
        thumbs_up: 0,
        smile: 0,
      };

      if (!Array.isArray(item.comments)) item.comments = [];
      item.comments.push(newCmt);
      item.comments_count = item.comments.length;

      renderRemedialCommentsList(item, handleCommentReaction, handleCommentReply);
      updateCommentCountInTable(item.id, item.comments.length);

      try {
        await addRemedialCommentDoc(item.id, newCmt, item.comments);
      } catch (e) {
        console.warn("Gagal simpan komentar:", e);
      }
    },
    handleCommentReaction,
    handleCommentReply,
    () => {
      activeCommentItemId = null;
    }
  );
}

async function handleCommentReaction(itemId, commentId, reactionType) {
  const item = remedialReports.find((r) => r.id === itemId);
  if (!item || !Array.isArray(item.comments)) return;
  const cmt = item.comments.find((c) => c.id === commentId);
  if (!cmt) return;
  cmt[reactionType] = (cmt[reactionType] || 0) + 1;
  renderRemedialCommentsList(item, handleCommentReaction, handleCommentReply);
  try {
    await addRemedialCommentDoc(item.id, null, item.comments);
  } catch (e) {}
}

function handleCommentReply(author) {
  // Focus handled in UI helper
}

function handleDayClick(dateKey) {
  const dayRemedial = remedialReports.filter((item) => {
    const k = parseItemDateKey(item, remedialDateMode);
    if (remedialDateMode === "schedule") {
      const s = String(item.status || "REQUEST").toUpperCase();
      const isScheduledStatus = s === "SCHEDULE" || s === "COMPLETE";
      return isScheduledStatus && k === dateKey;
    }
    return k === dateKey;
  });

  const dayClasses = [];
  if (Array.isArray(classesState)) {
    classesState.forEach((c) => {
      const dates = getClassDates(c);
      if (dates.includes(dateKey)) {
        dayClasses.push(c);
      }
    });
  }

  openRemedialDayAgendaModal(
    dateKey,
    dayRemedial,
    dayClasses,
    (id) => handleOpenRemedialSchedule(id),
    (dt) => openNewRemedialModal("SCHEDULE", `${dt}T19:00`),
    () => {}
  );
}

function copyRemedialPublicLink() {
  const publicUrl = "https://dialogika.co/remedial.html";
  navigator.clipboard
    .writeText(publicUrl)
    .then(() => {
      showToast("Link form publik remedial berhasil disalin ke clipboard!", "success");
    })
    .catch(() => {
      showToast("Link: " + publicUrl, "success");
    });
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
  if (sidebarMount) {
    renderSidebar(sidebarMount);
    mountSidebarClassErdButton();
    initClassErdModalControls();
  }

  // 3. Load Data from Repository
  classesState = await fetchClasses();
  mentorsData = await fetchMentors();
  remedialClassesData = classesState.map((c) => ({ id: c.docId || c.id, data: c }));

  // Populate mentor lists for remedial dropdown & filter
  const allMentorNames = new Set();
  if (Array.isArray(mentorsData)) {
    mentorsData.forEach((m) => {
      const n = typeof m === "string" ? m : m?.name;
      if (n) allMentorNames.add(n);
    });
  }
  if (Array.isArray(classesState)) {
    classesState.forEach((c) => {
      if (Array.isArray(c.mentors)) {
        c.mentors.forEach((m) => {
          const n = typeof m === "string" ? m : m?.name;
          if (n) allMentorNames.add(n);
        });
      }
    });
  }
  populateRemedialMentorDropdown(Array.from(allMentorNames).sort());

  populateFilterOptions(classesState);
  updateAll();

  // Load Remedial Reports
  await loadRemedialReportsData();

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

  // 7. Standard Export Modal Controls
  const exportControls = initClassExportModal();
  const exportForm = document.getElementById("exportClassForm");
  if (exportForm && exportControls) {
    exportForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      exportControls.setLoading(true);
      try {
        const formData = exportControls.getFormData();
        await exportClassManagementData(formData);
        const modalEl = document.getElementById("exportClassModal");
        if (modalEl && window.bootstrap) {
          bootstrap.Modal.getInstance(modalEl)?.hide();
        }
      } catch (err) {
        console.error("Export class management error:", err);
        showToast("Gagal mengekspor data kelas: " + err.message, "error");
      } finally {
        exportControls.setLoading(false);
      }
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

  // 10. Dedicated Remedial Management Wiring
  // 10.1 Main View Switcher (Daftar Kelas vs Kelas Remedial)
  const btnViewClasses = document.getElementById("btnViewClasses");
  const btnOpenRemedial = document.getElementById("btnOpenRemedial");

  if (btnViewClasses) {
    btnViewClasses.addEventListener("click", () => switchMainView("classes"));
  }
  if (btnOpenRemedial) {
    btnOpenRemedial.addEventListener("click", () => switchMainView("remedial"));
  }

  // 10.2 Sub-View Switcher (Board, Calendar, List)
  const btnRemedialBoard = document.getElementById("btnRemedialSubViewBoard");
  const btnRemedialCalendar = document.getElementById("btnRemedialSubViewCalendar");
  const btnRemedialList = document.getElementById("btnRemedialSubViewList");

  if (btnRemedialBoard) {
    btnRemedialBoard.addEventListener("click", () => switchRemedialSubView("board"));
  }
  if (btnRemedialCalendar) {
    btnRemedialCalendar.addEventListener("click", () => switchRemedialSubView("calendar"));
  }
  if (btnRemedialList) {
    btnRemedialList.addEventListener("click", () => switchRemedialSubView("list"));
  }

  // 10.3 Remedial Filters & Actions
  const searchRemedial = document.getElementById("searchRemedial");
  if (searchRemedial) {
    searchRemedial.addEventListener("input", () => updateAllRemedialViews());
  }

  const filterRemMentor = document.getElementById("filterRemedialMentor");
  if (filterRemMentor) {
    filterRemMentor.addEventListener("change", () => updateAllRemedialViews());
  }

  const filterRemMeeting = document.getElementById("filterRemedialMeeting");
  if (filterRemMeeting) {
    filterRemMeeting.addEventListener("change", () => updateAllRemedialViews());
  }

  const btnCopyLink = document.getElementById("btnCopyRemedialLink");
  if (btnCopyLink) {
    btnCopyLink.addEventListener("click", copyRemedialPublicLink);
  }

  const btnOpenAddRem = document.getElementById("btnOpenAddRemedial");
  if (btnOpenAddRem) {
    btnOpenAddRem.addEventListener("click", () => openNewRemedialModal("REQUEST"));
  }

  const btnListQuickAdd = document.getElementById("btnListQuickAddRemedial");
  if (btnListQuickAdd) {
    btnListQuickAdd.addEventListener("click", () => openNewRemedialModal("REQUEST"));
  }

  // Quick add button in board columns
  document.querySelectorAll(".remedial-col .btn-quick-add").forEach((btn) => {
    btn.addEventListener("click", () => {
      const col = btn.closest(".remedial-col");
      const status = col?.getAttribute("data-status") || "REQUEST";
      openNewRemedialModal(status);
    });
  });

  // 10.4 Remedial Calendar Controls
  const btnRemCalToday = document.getElementById("btnRemedialCalToday");
  const btnRemCalPrev = document.getElementById("btnRemedialCalPrev");
  const btnRemCalNext = document.getElementById("btnRemedialCalNext");
  const calDateModeSelect = document.getElementById("remedialCalDateMode");
  const btnToggleCheckup = document.getElementById("btnToggleCheckupLayer");
  const btnToggleUnscheduled = document.getElementById("btnToggleUnscheduledPanel");
  const unscheduledPanel = document.getElementById("remedialUnscheduledPanel");

  if (btnRemCalPrev) {
    btnRemCalPrev.addEventListener("click", () => {
      remedialCalMonth--;
      if (remedialCalMonth < 0) {
        remedialCalMonth = 11;
        remedialCalYear--;
      }
      updateAllRemedialViews();
    });
  }
  if (btnRemCalNext) {
    btnRemCalNext.addEventListener("click", () => {
      remedialCalMonth++;
      if (remedialCalMonth > 11) {
        remedialCalMonth = 0;
        remedialCalYear++;
      }
      updateAllRemedialViews();
    });
  }
  if (btnRemCalToday) {
    btnRemCalToday.addEventListener("click", () => {
      const now = new Date();
      remedialCalYear = now.getFullYear();
      remedialCalMonth = now.getMonth();
      updateAllRemedialViews();
    });
  }

  if (calDateModeSelect) {
    calDateModeSelect.addEventListener("change", (e) => {
      remedialDateMode = e.target.value;
      updateAllRemedialViews();
    });
  }

  if (btnToggleCheckup) {
    btnToggleCheckup.addEventListener("click", () => {
      showCheckupLayer = !showCheckupLayer;
      const badge = btnToggleCheckup.querySelector("span:last-child");
      if (badge) {
        badge.textContent = showCheckupLayer ? "ON" : "OFF";
        badge.className = showCheckupLayer
          ? "text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800"
          : "text-[9px] font-black px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500";
      }
      updateAllRemedialViews();
    });
  }

  if (btnToggleUnscheduled && unscheduledPanel) {
    btnToggleUnscheduled.addEventListener("click", () => {
      unscheduledPanel.classList.toggle("hidden");
    });
  }

  // 10.5 Admin Meeting Checkbox Dropdown
  const meetingDropdownToggle = document.getElementById("adminMeetingDropdownToggle");
  const btnSelectAllMeetings = document.getElementById("btnAdminSelectAllMeetings");
  const btnClearDropdownMeetings = document.getElementById("btnAdminClearDropdownMeetings");
  const btnCloseMeetingDropdown = document.getElementById("btnAdminCloseMeetingDropdown");
  const btnClearAllTags = document.getElementById("btnAdminClearAllTags");

  if (meetingDropdownToggle) {
    meetingDropdownToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleAdminMeetingDropdown();
    });
  }

  if (btnSelectAllMeetings) {
    btnSelectAllMeetings.addEventListener("click", (e) => {
      e.stopPropagation();
      for (let i = 1; i <= 12; i++) adminSelectedMeetings.add(i);
      syncAdminCheckboxStates();
      updateAdminMeetingDropdownUI();
    });
  }

  if (btnClearDropdownMeetings) {
    btnClearDropdownMeetings.addEventListener("click", (e) => {
      e.stopPropagation();
      clearAdminMeetingSelection();
    });
  }

  if (btnCloseMeetingDropdown) {
    btnCloseMeetingDropdown.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleAdminMeetingDropdown(false);
    });
  }

  if (btnClearAllTags) {
    btnClearAllTags.addEventListener("click", (e) => {
      e.stopPropagation();
      clearAdminMeetingSelection();
    });
  }

  document.querySelectorAll("#adminMeetingCheckboxList .admin-meeting-check-label").forEach((lbl) => {
    lbl.addEventListener("click", (e) => {
      e.stopPropagation();
      const num = parseInt(lbl.dataset.meeting, 10);
      if (adminSelectedMeetings.has(num)) {
        adminSelectedMeetings.delete(num);
      } else {
        adminSelectedMeetings.add(num);
      }
      syncAdminCheckboxStates();
      updateAdminMeetingDropdownUI();
    });
  });

  // Click outside admin meeting dropdown panel
  document.addEventListener("click", (e) => {
    const panel = document.getElementById("adminMeetingDropdownPanel");
    const toggle = document.getElementById("adminMeetingDropdownToggle");
    if (panel && !panel.classList.contains("hidden")) {
      if (!panel.contains(e.target) && !toggle?.contains(e.target)) {
        toggleAdminMeetingDropdown(false);
      }
    }
  });

  // 10.6 Remedial Submission Form
  const internalRemedialForm = document.getElementById("internalRemedialForm");
  if (internalRemedialForm) {
    internalRemedialForm.addEventListener("submit", handleRemedialFormSubmit);
  }

  const phoneInput = document.getElementById("remedialFormPhone");
  if (phoneInput && window.intlTelInput) {
    itiAdminPhone = window.intlTelInput(phoneInput, {
      initialCountry: "id",
      preferredCountries: ["id", "my", "sg"],
      separateDialCode: true,
      utilsScript: "https://cdn.jsdelivr.net/npm/intl-tel-input@23.1.0/build/js/utils.js",
    });
  }

  // Setup drag and drop for board columns
  setupRemedialDragAndDrop();

  // 10.7 Schedule Modal Controls
  const btnCloseRemSched = document.getElementById("btnCloseRemedialScheduleModal");
  const btnCancelRemSched = document.getElementById("btnCancelRemedialSchedule");
  if (btnCloseRemSched) btnCloseRemSched.addEventListener("click", closeRemedialScheduleModal);
  if (btnCancelRemSched) btnCancelRemSched.addEventListener("click", closeRemedialScheduleModal);

  // 10.8 Day Agenda Modal Controls
  const btnCloseDayAgenda = document.getElementById("btnCloseDayAgendaModal");
  const btnCloseDayAgendaFoot = document.getElementById("btnCloseDayAgendaFooter");
  if (btnCloseDayAgenda) btnCloseDayAgenda.addEventListener("click", closeRemedialDayAgendaModal);
  if (btnCloseDayAgendaFoot) btnCloseDayAgendaFoot.addEventListener("click", closeRemedialDayAgendaModal);

  // 10.9 Check URL query params on load (e.g. ?view=remedial or ?view=remedial&subview=calendar)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("view") === "remedial") {
    switchMainView("remedial", true);
    const sub = urlParams.get("subview");
    if (sub && ["board", "calendar", "list"].includes(sub)) {
      switchRemedialSubView(sub, true);
    }
  } else {
    switchMainView("classes", true);
  }

  // 10.10 Window Resize handler for gliders
  window.addEventListener("resize", () => {
    const mainGlider = document.getElementById("mainViewGlider");
    const activeMainBtn =
      activeMainView === "remedial"
        ? document.getElementById("btnOpenRemedial")
        : document.getElementById("btnViewClasses");
    if (mainGlider && activeMainBtn) {
      positionGlider(mainGlider, activeMainBtn, true);
    }
    if (activeMainView === "remedial") {
      syncRemedialSubViewGlider(true);
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
