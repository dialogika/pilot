// assets/js/components/report-modal/report-modal.js
// =====================================================================
// REPORT MODAL ORCHESTRATOR — coordinates data repository, UI and state
// for the Quest Report Approval Board.
//
// Rules:
//  - No direct Firestore queries (use report-modal.repository.js).
//  - No raw DOM HTML rendering (use report-modal.ui.js).
// =====================================================================

import { auth } from "../../firebase-config.js";
import { getCurrentRole } from "../../auth-guard.js";
import * as repo from "./report-modal.repository.js";
import * as ui from "./report-modal.ui.js";

let allReports = [];
let currentReports = [];
let currentQuestTab = "daily"; // 'daily' | 'quest' | 'project'
let usersMap = {};
let isInitialized = false;
let activeDetailReport = null;

let currentSortKey = "date";
let currentSortDir = "desc";
let pageSize = 20;

function extractUserIdentifiers(raw) {
  const list = [];
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  arr.forEach((item) => {
    if (!item) return;
    if (typeof item === "string") {
      list.push(item.toLowerCase().trim());
    } else if (typeof item === "object") {
      if (item.uid) list.push(String(item.uid).toLowerCase().trim());
      if (item.id) list.push(String(item.id).toLowerCase().trim());
      if (item.userId) list.push(String(item.userId).toLowerCase().trim());
      if (item.name) list.push(String(item.name).toLowerCase().trim());
      if (item.email) list.push(String(item.email).toLowerCase().trim());
      if (item.value) list.push(String(item.value).toLowerCase().trim());
    }
  });
  return list;
}

function isReportVisibleToUser(r, myAliases, userRole) {
  if (!myAliases || !myAliases.length) return true;

  // 1. Author/Assignee
  const authorId = String(r.authorId || "").toLowerCase().trim();
  if (authorId && myAliases.includes(authorId)) return true;
  const assignees = extractUserIdentifiers(r.assignees);
  if (assignees.some((u) => myAliases.includes(u))) return true;

  // 2. Creator
  const creators = extractUserIdentifiers(r.createdBy);
  if (creators.some((u) => myAliases.includes(u))) return true;

  // 3. Report To (Target Supervisor)
  const reportToList = extractUserIdentifiers(r.reportTo);
  if (reportToList.length > 0) {
    return reportToList.some((u) => myAliases.includes(u));
  }

  // If report has no explicit report_to, only author/assignee and creator can see it
  return false;
}

function parseDateValue(s) {
  const parts = String(s || "").split("-");
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const dt = new Date(y, m, d);
  return isNaN(dt.getTime()) ? null : dt;
}

function isWithinPeriod(dateStr, period) {
  if (!period || period === "all") return true;
  const dt = parseDateValue(dateStr);
  if (!dt) return true;
  const now = new Date();
  const diffMs = now.getTime() - dt.getTime();
  const days = diffMs / (24 * 60 * 60 * 1000);
  if (period === "daily") return days <= 1;
  if (period === "weekly") return days <= 7;
  if (period === "monthly") return days <= 30;
  if (period === "3month") return days <= 90;
  if (period === "6month") return days <= 180;
  if (period === "yearly") return days <= 365;
  return true;
}

function normalizeQuestType(qt) {
  const s = String(qt || "").toLowerCase();
  if (s.includes("project")) return "Project";
  if (s.includes("main") || s.includes("daily")) return "Daily";
  return "Quest";
}

/**
 * Recalculate stats for the cards.
 */
function updateStatsAndBadges() {
  let requested = 0;
  let approved = 0;
  let rejected = 0;
  let pending = 0;

  const breakdown = { daily: 0, quest: 0, project: 0 };
  const currentTabNorm = currentQuestTab === "main" ? "daily" : currentQuestTab === "side" ? "quest" : currentQuestTab;

  allReports.forEach((r) => {
    const qType = normalizeQuestType(r.questType);
    // Breakdown total counts regardless of tab
    if (qType === "Daily") breakdown.daily++;
    else if (qType === "Quest") breakdown.quest++;
    else if (qType === "Project") breakdown.project++;

    // Tab specific stats
    if (currentTabNorm === "daily" && qType !== "Daily") return;
    if (currentTabNorm === "quest" && qType !== "Quest") return;
    if (currentTabNorm === "project" && qType !== "Project") return;

    requested++;
    if (r.status === "approved") approved++;
    else if (r.status === "rejected") rejected++;
    else pending++;
  });

  const tabTotal = currentTabNorm === "daily" ? breakdown.daily : currentTabNorm === "quest" ? breakdown.quest : breakdown.project;

  ui.renderStats(
    { requested, approved, rejected, pending, breakdown },
    tabTotal
  );
}

let bulkMode = null; // null | 'archive' | 'delete'
let selectedTaskIds = {};

/**
 * Synchronize the dynamic action button (Approve all vs Archive All / Delete All with Exit).
 */
function syncBulkActionButton() {
  const wrap = document.getElementById("dgReportActionBtnWrap");
  if (!wrap) return;

  const topArchiveBtn = document.getElementById("dgReportTopArchiveBtn");
  const topDeleteBtn = document.getElementById("dgReportTopDeleteBtn");

  if (topArchiveBtn) topArchiveBtn.classList.toggle("active", bulkMode === "archive");
  if (topDeleteBtn) topDeleteBtn.classList.toggle("active", bulkMode === "delete");

  if (!bulkMode) {
    wrap.innerHTML = `
      <button type="button" class="dg-report-btn-approve-all" id="dgReportApproveAllBtn">
        <i class="bi bi-check-all"></i> Approve all
      </button>
    `;
    document.getElementById("dgReportApproveAllBtn")?.addEventListener("click", handleApproveAll);
    return;
  }

  const selectedCount = Object.keys(selectedTaskIds).filter((k) => !!selectedTaskIds[k]).length;
  const isArchive = bulkMode === "archive";
  const label = isArchive ? "Archive All" : "Delete All";
  const icon = isArchive ? "bi-archive" : "bi-trash";
  const cls = isArchive ? "btn-archive" : "btn-delete";

  wrap.innerHTML = `
    <div class="dg-report-btn-bulk-dynamic ${cls}">
      <button type="button" class="dg-report-btn-bulk-exit" id="dgReportBulkExitBtn">Exit</button>
      <span id="dgReportBulkActionTrigger" style="cursor:pointer;">
        <i class="bi ${icon}"></i> ${label} (${selectedCount})
      </span>
    </div>
  `;

  document.getElementById("dgReportBulkExitBtn")?.addEventListener("click", () => {
    bulkMode = null;
    selectedTaskIds = {};
    syncBulkActionButton();
    applyFiltersAndRender();
  });

  document.getElementById("dgReportBulkActionTrigger")?.addEventListener("click", async () => {
    const selected = Object.keys(selectedTaskIds).filter((k) => !!selectedTaskIds[k]);
    if (!selected.length) {
      alert("Pilih setidaknya satu baris tugas terlebih dahulu.");
      return;
    }
    if (bulkMode === "archive") {
      if (confirm(`Yakin ingin mengarsipkan ${selected.length} tugas yang dipilih?`)) {
        await repo.bulkArchiveTasks(selected);
        bulkMode = null;
        selectedTaskIds = {};
        syncBulkActionButton();
        await refreshReportsData();
      }
    } else if (bulkMode === "delete") {
      if (confirm(`Yakin ingin menghapus ${selected.length} tugas yang dipilih?`)) {
        await repo.bulkDeleteTasks(selected);
        bulkMode = null;
        selectedTaskIds = {};
        syncBulkActionButton();
        await refreshReportsData();
      }
    }
  });
}

/**
 * Refresh full reports data from repository.
 */
async function refreshReportsData() {
  const rawReports = await repo.loadReportsData();
  const user = auth.currentUser;
  let myAliases = [];
  let userRole = "";
  if (user) {
    userRole = await getCurrentRole();
    const uInfo =
      usersMap[user.uid] || usersMap[String(user.uid).toLowerCase()] || {};
    myAliases = [
      user.uid,
      user.email,
      user.displayName,
      uInfo.name,
    ]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase().trim());
  }
  allReports = rawReports.filter((r) =>
    isReportVisibleToUser(r, myAliases, userRole),
  );
  updateStatsAndBadges();
  applyFiltersAndRender();
  syncSidebarCounts();
}

/**
 * Filter and sort report items according to controls.
 */
function applyFiltersAndRender() {
  const searchInput = document.getElementById("dgReportSearchInput");
  const periodSelect = document.getElementById("dgReportPeriodSelect");
  const statusSelect = document.getElementById("dgReportStatusSelect");
  const pageSizeSelect = document.getElementById("dgReportPageSizeSelect");

  const q = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const period = periodSelect ? periodSelect.value : "all";
  const statusFilter = statusSelect ? statusSelect.value : "all";
  const ps = pageSizeSelect ? parseInt(pageSizeSelect.value, 10) : pageSize;
  if (!isNaN(ps) && ps > 0) pageSize = ps;

  const filtered = [];
  const currentTabNorm = currentQuestTab === "main" ? "daily" : currentQuestTab === "side" ? "quest" : currentQuestTab;

  allReports.forEach((r) => {
    const qType = normalizeQuestType(r.questType);
    if (currentTabNorm === "daily" && qType !== "Daily") return;
    if (currentTabNorm === "quest" && qType !== "Quest") return;
    if (currentTabNorm === "project" && qType !== "Project") return;

    const text = `${r.task || ""} ${r.reportPreview || ""}`.toLowerCase();
    if (q && !text.includes(q)) return;
    if (!isWithinPeriod(r.date, period)) return;
    if (statusFilter !== "all" && r.status !== statusFilter) return;

    filtered.push(r);
  });

  filtered.sort((a, b) => {
    const dir = currentSortDir === "asc" ? 1 : -1;
    const ka = a[currentSortKey];
    const kb = b[currentSortKey];
    if (currentSortKey === "date") {
      const da = parseDateValue(ka);
      const db = parseDateValue(kb);
      const ta = da ? da.getTime() : 0;
      const tb = db ? db.getTime() : 0;
      if (ta < tb) return -1 * dir;
      if (ta > tb) return 1 * dir;
      return 0;
    }
    const sa = String(ka || "").toLowerCase();
    const sb = String(kb || "").toLowerCase();
    if (sa < sb) return -1 * dir;
    if (sa > sb) return 1 * dir;
    return 0;
  });

  currentReports = filtered;
  const visible = filtered.slice(0, pageSize);

  ui.renderTable(
    visible,
    usersMap,
    {
      onOpenDetail: (report, mode) => {
        activeDetailReport = report;
        ui.openDetailModal(report, mode, usersMap);
      },
      onToggleSelect: (taskId, isChecked) => {
        selectedTaskIds[taskId] = isChecked;
        syncBulkActionButton();
      },
      onApprove: async (report) => {
        await handleApprove(report);
      },
      onReject: async (report) => {
        activeDetailReport = report;
        ui.openDetailModal(report, "feedback", usersMap);
      },
    },
    !!bulkMode,
    selectedTaskIds
  );

  updateStatsAndBadges();
}

/**
 * Handle approving a report.
 */
async function handleApprove(report) {
  try {
    report.status = "approved";
    applyFiltersAndRender();
    await repo.persistApprovalStatus(report, "approved", "");
    syncSidebarCounts();
  } catch (err) {
    console.error("Failed to approve report:", err);
    report.status = "pending";
    applyFiltersAndRender();
    alert("Gagal menyetujui laporan: " + (err.message || String(err)));
  }
}

/**
 * Handle rejecting a report with feedback.
 */
async function handleRejectWithFeedback(report, feedbackText) {
  try {
    report.status = "rejected";
    applyFiltersAndRender();
    await repo.persistApprovalStatus(report, "rejected", feedbackText);
    ui.closeDetailModal();
    syncSidebarCounts();
  } catch (err) {
    console.error("Failed to reject report:", err);
    report.status = "pending";
    applyFiltersAndRender();
    alert("Gagal menolak laporan: " + (err.message || String(err)));
  }
}

/**
 * Approve all currently visible reports.
 */
async function handleApproveAll() {
  if (!currentReports.length) return;
  const toApprove = currentReports.filter((r) => r.status !== "approved");
  if (!toApprove.length) {
    alert("Semua laporan pada filter ini sudah berstatus Approved.");
    return;
  }

  for (const r of toApprove) {
    r.status = "approved";
    try {
      await repo.persistApprovalStatus(r, "approved", "");
    } catch (e) {
      console.warn("Failed to approve report:", r.id, e);
      r.status = "pending";
    }
  }

  applyFiltersAndRender();
  syncSidebarCounts();
}

/**
 * Sync sidebar counts live.
 */
async function syncSidebarCounts() {
  try {
    const sidebarMount = document.getElementById("dg-sidebar-mount") || document.getElementById("sidebarContainer");
    if (!sidebarMount) return;
    const { getSidebarCounts } = await import("../sidebar/sidebar.repository.js");
    const { applyCounts } = await import("../sidebar/sidebar.ui.js");
    const counts = await getSidebarCounts();
    applyCounts(sidebarMount, counts);
  } catch (e) {
    console.warn("Report modal: failed to sync counts", e);
  }
}

/**
 * Bind DOM event listeners.
 */
function wireEvents() {
  // Close buttons
  document.getElementById("dgReportCloseBtn")?.addEventListener("click", () => {
    ui.hideModalOverlay();
  });
  document.getElementById("dgReportModalOverlay")?.addEventListener("click", (e) => {
    if (e.target.id === "dgReportModalOverlay") ui.hideModalOverlay();
  });

  // Bulk Archive & Delete toggle buttons on Header
  document.getElementById("dgReportTopArchiveBtn")?.addEventListener("click", () => {
    bulkMode = bulkMode === "archive" ? null : "archive";
    selectedTaskIds = {};
    syncBulkActionButton();
    applyFiltersAndRender();
  });

  document.getElementById("dgReportTopDeleteBtn")?.addEventListener("click", () => {
    bulkMode = bulkMode === "delete" ? null : "delete";
    selectedTaskIds = {};
    syncBulkActionButton();
    applyFiltersAndRender();
  });

  // Tab switching
  document.querySelectorAll(".dg-report-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentQuestTab = btn.getAttribute("data-quest-tab") || "side";
      ui.setActiveTab(currentQuestTab);
      applyFiltersAndRender();
    });
  });

  // Filters
  document.getElementById("dgReportSearchInput")?.addEventListener("input", applyFiltersAndRender);
  document.getElementById("dgReportPeriodSelect")?.addEventListener("change", applyFiltersAndRender);
  document.getElementById("dgReportStatusSelect")?.addEventListener("change", applyFiltersAndRender);
  document.getElementById("dgReportPageSizeSelect")?.addEventListener("change", applyFiltersAndRender);

  // Table Sort headers
  document.querySelectorAll(".dg-report-table th[data-sort-key]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.getAttribute("data-sort-key");
      if (!key) return;
      if (currentSortKey === key) {
        currentSortDir = currentSortDir === "asc" ? "desc" : "asc";
      } else {
        currentSortKey = key;
        currentSortDir = "asc";
      }
      applyFiltersAndRender();
    });
  });

  // Approve All button
  document.getElementById("dgReportApproveAllBtn")?.addEventListener("click", handleApproveAll);

  // Sub-modal detail controls
  document.getElementById("dgReportDetailCloseBtn")?.addEventListener("click", ui.closeDetailModal);
  document.getElementById("dgReportDetailCancelBtn")?.addEventListener("click", ui.closeDetailModal);
  document.getElementById("dgReportDetailOverlay")?.addEventListener("click", (e) => {
    if (e.target.id === "dgReportDetailOverlay") ui.closeDetailModal();
  });

  document.getElementById("dgReportDetailApproveBtn")?.addEventListener("click", async () => {
    if (activeDetailReport) {
      await handleApprove(activeDetailReport);
      ui.closeDetailModal();
    }
  });

  document.getElementById("dgReportDetailSubmitFeedbackBtn")?.addEventListener("click", async () => {
    if (activeDetailReport) {
      const feedback = ui.getDetailFeedbackText();
      await handleRejectWithFeedback(activeDetailReport, feedback);
    }
  });
}

/**
 * Initialize the Report Modal component.
 */
export function initReportModal() {
  if (isInitialized) return;
  ui.ensureReportModalDOM();
  wireEvents();
  isInitialized = true;
}

/**
 * Open the Report Modal directly.
 */
export async function openReportModal(opts = {}) {
  initReportModal();
  currentQuestTab = opts.initialTab || "daily";
  ui.setActiveTab(currentQuestTab);
  ui.showModalOverlay();

  try {
    usersMap = await repo.loadUsersMap();
    await refreshReportsData();
  } catch (err) {
    console.error("Failed to load reports data:", err);
    alert("Gagal memuat data report: " + (err.message || String(err)));
  }
}
