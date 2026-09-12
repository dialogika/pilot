// pages/hr/recruitment-dashboard/recruitment-dashboard.js
// =====================================================================
// RECRUITMENT SPECIALIST / DASHBOARD ORCHESTRATOR
// Coordinates authentication, shell rendering, repository data calls,
// and UI presentation for the Recruitment Specialist feature.
//
// Flow:
//   requireAuth() → renderTopbar / renderSidebar / renderRightbarRecruit
//       ↓
//   recruitment-dashboard.repository.js (data access)
//       ↓
//   recruitment-dashboard.ui.js (rendering + events)
// =====================================================================

import { requireAuth } from "/assets/js/auth-guard.js";
import { renderTopbar } from "/assets/js/components/topbar/topbar.js";
import { renderSidebar } from "/assets/js/components/sidebar/sidebar.js";
import { renderRightbarRecruit } from "/element/rightbar-recruit.js?v=2.0.0";

import {
  SECTION_CONFIG,
  loadUsersMap,
  loadPositionsMap,
  resolveInterviewerNames,
  resolvePositionName,
  fetchSectionMembers,
  fetchAllScreening,
  loadRecruitmentNotes,
  saveRecruitmentNotes,
} from "./recruitment-dashboard.repository.js";

import {
  renderGreeting,
  renderSectionTitle,
  renderMetricCards,
  renderNotesText,
  openNotesModal,
  getNotesInputValue,
  closeNotesModal,
  setNotesSaveLoading,
  setModalLoading,
  renderModalTable,
  renderUpcomingInterviews,
  renderOverdueInterviews,
  renderPlatformJobposting,
  setCalendarText,
  updateFilterButtonStates,
} from "./recruitment-dashboard.ui.js";

// ── State ───────────────────────────────────────────────────────────

let currentUser = null;
let activeSection = "team";
let activeInterviewRole = "all";

const today = new Date();
const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let rangeStart = startOfMonth;
let rangeEnd = today;

const dashboardState = {
  candidatesBySection: { team: [], mentor: [], internship: [] },
  headCountRows: [],
  contractEndingRows: [],
  offboardingRows: [],
};

// ── Date helpers ────────────────────────────────────────────────────

function normalizeInternshipDate(value) {
  if (!value) return null;
  let dateObj = null;
  if (typeof value.toDate === "function") {
    dateObj = value.toDate();
  } else if (value instanceof Date) {
    dateObj = value;
  } else if (typeof value === "string" || typeof value === "number") {
    let tmp = null;
    if (typeof value === "string") {
      const trimmed = value.trim();
      const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
      tmp = m
        ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
        : new Date(trimmed);
    } else {
      tmp = new Date(value);
    }
    if (!isNaN(tmp.getTime())) dateObj = tmp;
  }
  if (!dateObj || isNaN(dateObj.getTime())) return null;
  return dateObj;
}

function normalizeRangeDates(startDate, endDate) {
  if (!startDate || !endDate) return { s: null, e: null };
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return { s: null, e: null };
  s.setHours(0, 0, 0, 0);
  e.setHours(23, 59, 59, 999);
  return { s, e };
}

function isDateInRange(dateObj, s, e) {
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return false;
  if (!(s instanceof Date) || !(e instanceof Date)) return false;
  return dateObj >= s && dateObj <= e;
}

function isUserActiveInRange(startDateObj, endDateObj, s, e) {
  if (!(s instanceof Date) || !(e instanceof Date)) return true;
  const hasStart = startDateObj instanceof Date && !isNaN(startDateObj.getTime());
  const hasEnd = endDateObj instanceof Date && !isNaN(endDateObj.getTime());
  if (!hasStart && !hasEnd) return true;
  if (hasStart && startDateObj > e) return false;
  if (hasEnd && endDateObj < s) return false;
  return true;
}

function isInSelectedRange(dateObj) {
  const { s, e } = normalizeRangeDates(rangeStart, rangeEnd);
  return s && e ? isDateInRange(dateObj, s, e) : true;
}

function normalizeStatus(value) {
  if (!value) return "";
  return value.toString().trim().toLowerCase();
}

function formatDate(date) {
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Data extraction helpers ─────────────────────────────────────────

function getFirstAvailable(data, paths) {
  for (const path of paths) {
    const parts = path.split(".");
    let c = data;
    for (const p of parts)
      c = c && c[p] !== undefined ? c[p] : undefined;
    if (c !== undefined && c !== null && c !== "") return c;
  }
  return "";
}

function getDashboardDate(data, paths) {
  const r = getFirstAvailable(data, paths);
  return normalizeInternshipDate(r);
}

function getCreatedDate(data) {
  return getDashboardDate(data, [
    "created_at", "createdAt", "created", "submitted_at", "submittedAt",
    "registered_at", "date", "timestamp",
  ]);
}

function getMemberStartDate(data) {
  return getDashboardDate(data, [
    "startDate", "start_date", "contractStart", "contract_start",
    "employment.startDate", "employment.start_date",
    "internshipStartDate", "internship.startDate",
  ]);
}

function getMemberEndDate(data) {
  return getDashboardDate(data, [
    "endDate", "end_date", "contractEnd", "contract_end",
    "contract.endDate", "employment.endDate", "employment.end_date",
    "internshipEndDate", "internship.endDate",
  ]);
}

function getCandidateName(data) {
  return (
    getFirstAvailable(data, [
      "fullName", "full_name", "name", "nama",
      "basic_info.full_name", "scouting_info.full_name", "email",
    ]) || "Tanpa Nama"
  );
}

function getCandidatePosition(data, section) {
  return (
    getFirstAvailable(data, [
      "position_name", "positionName", "job_position",
      "scouting_info.position_name", "internship.position_name",
      "internship.position", "internship.position_id",
      "position_id", "position", "scouting_info.position_id",
      "scouting_info.position", "employment.position",
      "employment.position_name", "employment.position_id",
      "division", "department", "role_name",
    ]) || SECTION_CONFIG[section]?.label || "-"
  );
}

function getRecruitmentCurrent(data) {
  const r = data.recruitment_status || data.recruitment_system || {};
  return normalizeStatus(r.current || data.status || data.stage || "screening");
}

function getInterviewDateTime(data) {
  const rs = data.recruitment_status || data.recruitment_system || {};
  const raw =
    rs.interview_schedule ||
    rs.due_date ||
    data.interview_schedule ||
    data.interviewSchedule ||
    data.interview_date ||
    data.due_date;
  return normalizeInternshipDate(raw);
}

function getInterviewerUids(data) {
  const raw = getFirstAvailable(data, [
    "interviewers", "recruitment_status.interviewers",
    "interviewer", "interviewerName", "interviewer_name",
    "recruitment_status.interviewer",
  ]);
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (raw && typeof raw === "string") return [raw];
  return [];
}

function getMemberName(data) {
  return (
    getFirstAvailable(data, [
      "name", "fullName", "full_name", "displayName",
      "nama_lengkap", "nickName", "email",
    ]) || "Tanpa Nama"
  );
}

function getMemberPosition(data, section) {
  return (
    getFirstAvailable(data, [
      "position_name", "position", "position_id",
      "internship.position", "internship.position_name", "internship.position_id",
      "employment.position", "employment.position_name", "employment.position_id",
      "department", "division", "type", "teaching",
    ]) || SECTION_CONFIG[section]?.label || "-"
  );
}

function isActiveMember(data) {
  const s = normalizeStatus(data.status || data.internshipStatus || "");
  return !["inactive", "resigned", "left", "graduate", "graduated", "nonaktif"].includes(s);
}

function isOffboardedMember(data) {
  const s = normalizeStatus(data.status || data.internshipStatus || "");
  return ["inactive", "resigned", "left", "graduate", "graduated", "nonaktif"].includes(s);
}

function getFirstName(value) {
  const full = (value || "").toString().trim();
  if (!full) return "Tanpa Nama";
  const parts = full.split(/\s+/).filter(Boolean);
  return parts[0] || full;
}

// ── Row builders ────────────────────────────────────────────────────

function memberRow(docItem, section) {
  const d = docItem.data || {};
  const rawPos = getMemberPosition(d, section);
  return {
    id: docItem.id,
    name: getMemberName(d),
    role: SECTION_CONFIG[section]?.label || section,
    position: resolvePositionName(rawPos),
    photo: d.photo || d.photoURL || d.avatar || "",
    startDateObj: getMemberStartDate(d),
    endDateObj: getMemberEndDate(d),
    data: d,
  };
}

function candidateRow(docItem, section) {
  const d = docItem.data || {};
  const name = getCandidateName(d);
  const rawPos = getCandidatePosition(d, section);
  return {
    id: docItem.id,
    section,
    sectionLabel: SECTION_CONFIG[section]?.label || section,
    name,
    firstName: getFirstName(name),
    position: resolvePositionName(rawPos),
    interviewerUids: getInterviewerUids(d),
    status: getRecruitmentCurrent(d),
    createdAt: getCreatedDate(d),
    interviewSchedule: getInterviewDateTime(d),
    photo:
      d.photo || d.avatar || (d.basic_info && d.basic_info.avatar_url) || "",
    platform: (
      (d.internship && d.internship.platform) ||
      d.platform ||
      (d.basic_info && d.basic_info.platform) ||
      ""
    )
      .toString()
      .trim(),
    data: d,
  };
}

// ── Platform mapping ────────────────────────────────────────────────

function mapPlatform(raw) {
  const p = String(raw || "").trim().toLowerCase();
  if (p.includes("linkedin")) return "LinkedIn";
  if (p.includes("instagram")) return "Instagram";
  if (p.includes("website dialogika") || p.includes("dialogika"))
    return "Website Dialogika";
  if (p.includes("website msib") || p.includes("msib")) return "Website MSIB";
  return "Other";
}

// ── Dashboard data processing ───────────────────────────────────────

async function processScreeningData() {
  const rawData = await fetchAllScreening();
  Object.entries(rawData).forEach(([s, rows]) => {
    dashboardState.candidatesBySection[s] = rows.map((i) => candidateRow(i, s));
  });
}

async function processSectionSummary() {
  const { s, e } = normalizeRangeDates(rangeStart, rangeEnd);
  const rawMembers = await fetchSectionMembers(activeSection);
  const members = rawMembers.map((i) => memberRow(i, activeSection));

  const active = members.filter(
    (r) =>
      isActiveMember(r.data) &&
      isUserActiveInRange(r.startDateObj, r.endDateObj, s, e)
  );
  const endingSoon = active.filter((r) => {
    if (!r.endDateObj) return false;
    return s && e ? isDateInRange(r.endDateObj, s, e) : true;
  });
  const offboarded = members.filter((r) => {
    if (!isOffboardedMember(r.data)) return false;
    if (!r.endDateObj) return true;
    return s && e ? isDateInRange(r.endDateObj, s, e) : true;
  });

  const candidates = dashboardState.candidatesBySection[activeSection] || [];
  const applicants = candidates.filter(
    (r) => !r.createdAt || isInSelectedRange(r.createdAt)
  );

  dashboardState.headCountRows = active;
  dashboardState.contractEndingRows = endingSoon;
  dashboardState.offboardingRows = offboarded;

  renderMetricCards({
    headCount: active.length,
    applicants: applicants.length,
    contractEnding: endingSoon.length,
    offboarding: offboarded.length,
  });
}

function getInterviewPool(sectionFilter) {
  const now = new Date();
  const sections =
    sectionFilter === "all" ? Object.keys(SECTION_CONFIG) : [sectionFilter];
  return sections
    .flatMap((s) => dashboardState.candidatesBySection[s] || [])
    .filter((r) => normalizeStatus(r.status) === "interview")
    .filter(
      (r) =>
        r.interviewSchedule instanceof Date &&
        !isNaN(r.interviewSchedule.getTime())
    )
    .filter((r) => r.interviewSchedule >= now)
    .sort((a, b) => a.interviewSchedule - b.interviewSchedule);
}

function processUpcomingInterviews() {
  const rows = getInterviewPool(activeInterviewRole).map((row) => ({
    ...row,
    interviewerNames: resolveInterviewerNames(row.interviewerUids),
  }));
  renderUpcomingInterviews(rows);
}

function processOverdueInterviews() {
  const now = new Date();
  const todayMid = new Date();
  todayMid.setHours(0, 0, 0, 0);

  const rows = Object.keys(SECTION_CONFIG)
    .flatMap((s) => dashboardState.candidatesBySection[s] || [])
    .filter((r) => normalizeStatus(r.status) === "interview")
    .filter(
      (r) =>
        r.interviewSchedule instanceof Date &&
        !isNaN(r.interviewSchedule.getTime())
    )
    .filter((r) => r.interviewSchedule < now)
    .map((r) => ({
      ...r,
      interviewerNames: resolveInterviewerNames(rowInterviewerUids(r)),
      lateDays: Math.max(
        1,
        Math.floor((todayMid - r.interviewSchedule) / 86400000)
      ),
    }))
    .sort((a, b) => b.lateDays - a.lateDays);

  renderOverdueInterviews(rows);
}

function rowInterviewerUids(r) {
  return r.interviewerUids || [];
}

function processPlatformJobposting() {
  const platforms = [
    "LinkedIn",
    "Instagram",
    "Website Dialogika",
    "Website MSIB",
    "Other",
  ];
  const counts = Object.fromEntries(platforms.map((l) => [l, 0]));
  const candidates = dashboardState.candidatesBySection.internship || [];

  candidates.forEach((r) => {
    if (r.createdAt && !isInSelectedRange(r.createdAt)) return;
    const mapped = mapPlatform(r.platform);
    counts[mapped] += 1;
  });

  const total = platforms.reduce((s, l) => s + counts[l], 0);
  renderPlatformJobposting(counts, total);
}

// ── Modal openers ───────────────────────────────────────────────────

function renderRowsModal(title, rows) {
  const isAllTime = !rangeStart || !rangeEnd;
  const { s, e } = normalizeRangeDates(rangeStart, rangeEnd);
  const subtitle =
    isAllTime
      ? "All Time"
      : s && e
        ? `${formatDate(s)} - ${formatDate(e)}`
        : "";
  const ctx = setModalLoading(title, subtitle);
  if (!ctx) return;
  renderModalTable(
    ctx,
    [
      { key: "name", label: "Nama" },
      { key: "role", label: "Section" },
      { key: "position", label: "Posisi" },
    ],
    rows
  );
}

function openHeadCountModal() {
  renderRowsModal(
    `Head Count (${SECTION_CONFIG[activeSection].label})`,
    dashboardState.headCountRows
  );
}

function openApplicantsModal() {
  const rows = (dashboardState.candidatesBySection[activeSection] || [])
    .filter((r) => !r.createdAt || isInSelectedRange(r.createdAt))
    .map((r) => ({ name: r.name, role: r.sectionLabel, position: r.position }));
  renderRowsModal(
    `Applicants (${SECTION_CONFIG[activeSection].label})`,
    rows
  );
}

function openOnLeaveModal() {
  renderRowsModal(
    `Kontrak Akan Berakhir (${SECTION_CONFIG[activeSection].label})`,
    dashboardState.contractEndingRows
  );
}

function openOffboardingModal() {
  renderRowsModal(
    `Off Boarding (${SECTION_CONFIG[activeSection].label})`,
    dashboardState.offboardingRows
  );
}

// ── Card click → modal ──────────────────────────────────────────────

function attachCardOpen(cardId, fn) {
  const el = document.getElementById(cardId);
  if (!el) return;
  el.addEventListener("click", fn);
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  });
}

// ── Core dashboard refresh ──────────────────────────────────────────

async function refreshDashboard() {
  try {
    renderSectionTitle(SECTION_CONFIG[activeSection]?.title || "Recruitment");
    await loadUsersMap();
    await loadPositionsMap();
    await processScreeningData();
    await processSectionSummary();
    processUpcomingInterviews();
    processPlatformJobposting();
    processOverdueInterviews();
    updateFilterButtonStates(!rangeStart || !rangeEnd);
  } catch (err) {
    console.warn("[RecruitmentDashboard] Error during refreshDashboard:", err);
  }
}

// ── Filter actions ──────────────────────────────────────────────────

function setAllTimeMode() {
  rangeStart = null;
  rangeEnd = null;
  setCalendarText("All Time");
  const fpInput = document.getElementById("calendarPicker");
  if (fpInput && fpInput._flatpickr) fpInput._flatpickr.clear();
  refreshDashboard();
}

function resetFilter() {
  rangeStart = startOfMonth;
  rangeEnd = today;
  setCalendarText(`${formatDate(startOfMonth)} - ${formatDate(today)}`);
  const fpInput = document.getElementById("calendarPicker");
  if (fpInput && fpInput._flatpickr)
    fpInput._flatpickr.setDate([startOfMonth, today], false);
  refreshDashboard();
}

// ── Notes handlers ──────────────────────────────────────────────────

async function handleSaveNotes() {
  const content = getNotesInputValue();
  try {
    setNotesSaveLoading(true);
    await saveRecruitmentNotes(
      content,
      currentUser ? currentUser.email || currentUser.uid || null : null
    );
    renderNotesText(content);
    closeNotesModal();
  } catch (error) {
    console.error("Failed to save recruitment notes:", error);
  } finally {
    setNotesSaveLoading(false);
  }
}

// ── Event wiring ────────────────────────────────────────────────────

function initializeSectionSwitcher() {
  const sw = document.getElementById("sectionSwitcher");
  if (!sw || sw.dataset.bound === "true") return;
  sw.dataset.bound = "true";

  sw.addEventListener("click", async (e) => {
    const btn = e.target.closest(".section-tab[data-section]");
    if (!btn) return;
    activeSection = btn.dataset.section || "team";
    sw.querySelectorAll(".section-tab").forEach((i) =>
      i.classList.toggle("active", i === btn)
    );
    await refreshDashboard();
  });
}

function initializeInterviewTabs() {
  const tabs = document.getElementById("interviewTabs");
  if (!tabs || tabs.dataset.bound === "true") return;
  tabs.dataset.bound = "true";

  tabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".interview-tab[data-role]");
    if (!btn) return;
    activeInterviewRole = btn.dataset.role || "all";
    tabs
      .querySelectorAll(".interview-tab")
      .forEach((i) => i.classList.toggle("active", i === btn));
    processUpcomingInterviews();
  });
}

function attachFilterButtons() {
  const allTimeBtn = document.getElementById("btnAllTime");
  const resetBtn = document.getElementById("btnResetFilter");
  if (allTimeBtn) allTimeBtn.addEventListener("click", setAllTimeMode);
  if (resetBtn) resetBtn.addEventListener("click", resetFilter);
}

function attachNotesHandlers() {
  const editBtn = document.getElementById("editRecruitmentNotesBtn");
  const saveBtn = document.getElementById("saveRecruitmentNotesBtn");
  if (editBtn) editBtn.addEventListener("click", openNotesModal);
  if (saveBtn) saveBtn.addEventListener("click", handleSaveNotes);
}

function attachCardModals() {
  attachCardOpen("headCountCard", openHeadCountModal);
  attachCardOpen("applicantsCard", openApplicantsModal);
  attachCardOpen("onLeaveCard", openOnLeaveModal);
  attachCardOpen("offboardingCard", openOffboardingModal);
}

function initializeFlatpickr() {
  const calendarButton = document.querySelector(".btn-weekly");
  if (!calendarButton) return;
  flatpickr("#calendarPicker", {
    mode: "range",
    dateFormat: "Y-m-d",
    positionElement: calendarButton,
    defaultDate: [startOfMonth, today],
    onChange: (selectedDates) => {
      if (selectedDates.length === 2) {
        rangeStart = selectedDates[0];
        rangeEnd = selectedDates[1];
        setCalendarText(`${formatDate(rangeStart)} - ${formatDate(rangeEnd)}`);
        refreshDashboard();
      }
    },
  });
  setCalendarText(`${formatDate(startOfMonth)} - ${formatDate(today)}`);
}

// ── Entry point ─────────────────────────────────────────────────────

async function initialize() {
  try {
    // 1. Auth boundary
    const { user, role } = await requireAuth();
    currentUser = user;

    // 2. Shared shell
    renderTopbar({ user, role });
    renderSidebar({ role, activePage: "dashboard" });
    renderRightbarRecruit();
    if (window.lucide) {
      window.lucide.createIcons();
    }

    // 3. Greeting
    renderGreeting();

    // 4. Load notes
    const notesContent = await loadRecruitmentNotes();
    renderNotesText(notesContent);

    // 5. Wire events
    attachNotesHandlers();
    attachCardModals();
    attachFilterButtons();
    initializeSectionSwitcher();
    initializeInterviewTabs();
    initializeFlatpickr();

    // 6. Initial data load
    await refreshDashboard();
  } catch (error) {
    console.error("[RecruitmentDashboard] Initialization failed:", error);
  }
}

initialize();
