// pages/hr/permit-reimburse/permit-reimburse.js
// =====================================================================
// ORCHESTRATOR LAYER: PERMIT & REIMBURSE MANAGEMENT
// Coordinates Auth, Realtime Subscriptions, Presentation, and Actions.
// =====================================================================

import { requireAuth } from "/assets/js/auth-guard.js";
import { renderTopbar } from "/assets/js/components/topbar/topbar.js";
import { renderSidebar } from "/assets/js/components/sidebar/sidebar.js";

import * as repo from "./permit-reimburse.repository.js";
import * as ui from "./permit-reimburse.ui.js";

// --- State ---
let currentUser = null;
let currentRole = null;
let allPermits = [];
let allReimburse = [];
let groupedReimburse = [];

let activeTab = "permit"; // 'permit' | 'reimburse'
let permitSearchQuery = "";
let permitStatusFilter = "all";
let reimburseSearchQuery = "";

const permitPaginationState = {
  totalItems: 0,
  pageSize: 10,
  currentPage: 1
};

const reimbursePaginationState = {
  totalItems: 0,
  pageSize: 10,
  currentPage: 1
};

// Modal action states
let currentActionPermitId = null;
let currentReimbursePayload = null;
let activeGroupDetailKey = null;

const WORK_DAYS = new Set([1, 2, 3, 4, 5]); // Mon-Fri

function getActorName() {
  if (currentUser?.displayName) return currentUser.displayName;
  if (currentUser?.email) return currentUser.email.split("@")[0];
  return "HR Team";
}

function parseDateForCalc(val) {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function dayDiffInclusive(a, b) {
  const current = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const last = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  let count = 0;
  while (current <= last) {
    if (WORK_DAYS.has(current.getDay())) count++;
    current.setDate(current.getDate() + 1);
  }
  return Math.max(1, count);
}

function parseTimeToMinutes(val) {
  if (!val) return null;
  const parts = String(val).trim().split(":");
  if (parts.length !== 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function calcPermitHours(rangeStr) {
  if (!rangeStr) return 0;
  const parts = String(rangeStr).split("-").map((s) => s.trim());
  if (parts.length !== 2) return 0;
  const start = parseTimeToMinutes(parts[0]);
  const end = parseTimeToMinutes(parts[1]);
  if (start === null || end === null) return 0;
  const diff = end - start;
  if (diff <= 0) return 0;
  return Math.round((diff / 60) * 2) / 2;
}

// --- Grouping Reimburse ---
function buildGroupedReimburse(records) {
  const map = new Map();
  records.forEach((item) => {
    const key = item.user_id || item.user_name || item.id;
    if (!map.has(key)) {
      map.set(key, {
        key,
        user_id: item.user_id || "",
        user_name: item.user_name || "-",
        user_photo: item.user_photo || "",
        items: [],
        total_days: 0,
        total_hours: 0,
        pending_days: 0,
        pending_hours: 0,
        completed_days: 0,
        completed_hours: 0,
        status: "completed"
      });
    }
    const group = map.get(key);
    const hours = Number(item.hours ?? item.total_hours ?? item.reimburse_hours ?? 0) || 0;
    group.items.push(item);

    const entries = item.dailyEntries || [];
    if (entries.length > 0) {
      const pendingCount = entries.filter((e) => e.status !== "completed" && !e.completed).length;
      const completedCount = entries.filter((e) => e.status === "completed" || e.completed).length;
      const totalEntries = pendingCount + completedCount;

      group.total_days += totalEntries;
      group.pending_days += pendingCount;
      group.completed_days += completedCount;

      if (totalEntries > 0 && hours > 0) {
        const hoursPerEntry = hours / totalEntries;
        group.pending_hours += hoursPerEntry * pendingCount;
        group.completed_hours += hoursPerEntry * completedCount;
      }
    } else {
      const d = Number(item.days ?? item.reimburse_days ?? 1);
      const isDone = item.status === "completed";
      group.total_days += d;
      if (isDone) {
        group.completed_days += d;
        group.completed_hours += hours;
      } else {
        group.pending_days += d;
        group.pending_hours += hours;
      }
    }
  });

  map.forEach((group) => {
    group.total_hours = group.pending_hours + group.completed_hours;
    if (group.pending_days > 0) {
      group.status = "pending";
    }
  });

  return Array.from(map.values());
}

// --- Email Templates ---
function buildApproveEmailTemplate(permit, actorName, includeReimburse, days = 1, hours = 0) {
  const name = permit?.user_name || "Rekan";
  const startSlash = ui.formatDateSlash(permit?.start_date) || "-";
  const jenis = ui.getPermitJenisLabel(permit);

  let reimburseText = "";
  if (includeReimburse) {
    reimburseText = `\nPengajuan ini dicatat untuk penggantian jam kerja (Reimburse) sebanyak ${days} hari (${hours} jam). Silakan sesuaikan jadwal penggantian sesuai kesepakatan bersama supervisor.\n`;
  }

  return `Halo ${name},

Pengajuan izin Anda telah disetujui:
- Tanggal Izin: ${startSlash}
- Jenis Izin: ${jenis}
- Status: Disetujui (Approved)
${reimburseText}
Terima kasih,
${actorName}
Dialogika Team`;
}

function buildRejectEmailTemplate(permit, actorName, reason = "") {
  const name = permit?.user_name || "Rekan";
  const startSlash = ui.formatDateSlash(permit?.start_date) || "-";
  const alasanText = reason ? `\nAlasan penolakan: ${reason}\n` : "";

  return `Halo ${name},

Mohon maaf, pengajuan izin Anda untuk tanggal ${startSlash} belum dapat disetujui.${alasanText}
Silakan hubungi HR atau supervisor terkait untuk koordinasi lebih lanjut.

Terima kasih,
${actorName}
Dialogika Team`;
}

function buildMailtoUrl(to, subject, body) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// --- Tab Switching ---
function switchTab(tabName) {
  activeTab = tabName;

  const permitTabBtn = document.getElementById("permitTabBtn");
  const reimburseTabBtn = document.getElementById("reimburseTabBtn");
  const permitPanel = document.getElementById("permitTabPanel");
  const reimbursePanel = document.getElementById("reimburseTabPanel");

  if (tabName === "permit") {
    permitTabBtn?.classList.add("active");
    reimburseTabBtn?.classList.remove("active");
    permitPanel?.classList.remove("hidden");
    reimbursePanel?.classList.add("hidden");
    applyPermitFilters();
  } else {
    reimburseTabBtn?.classList.add("active");
    permitTabBtn?.classList.remove("active");
    reimbursePanel?.classList.remove("hidden");
    permitPanel?.classList.add("hidden");
    applyReimburseFilters();
  }
}

// --- Permit Filtering & Pagination ---
function applyPermitFilters() {
  const q = permitSearchQuery.trim().toLowerCase();
  const status = permitStatusFilter;

  const filtered = allPermits.filter((p) => {
    const matchStatus = status === "all" || p.status === status;
    const matchQuery =
      !q ||
      [p.user_name, p.division, p.reason, p.permit_type].some((field) =>
        String(field || "").toLowerCase().includes(q)
      );
    return matchStatus && matchQuery;
  });

  permitPaginationState.totalItems = filtered.length;
  const totalPages = Math.ceil(filtered.length / permitPaginationState.pageSize) || 1;
  if (permitPaginationState.currentPage > totalPages) {
    permitPaginationState.currentPage = totalPages;
  }

  const startIndex = (permitPaginationState.currentPage - 1) * permitPaginationState.pageSize;
  const paginated = filtered.slice(startIndex, startIndex + permitPaginationState.pageSize);

  ui.renderPermitsTable(paginated, {
    onApprove: handleInitiateApprove,
    onReject: handleInitiateReject,
    onDelete: handleInitiateDelete,
    onReapprove: handleReapprove,
    onRereject: handleRereject
  });

  ui.renderPagination(
    permitPaginationState,
    (newPage) => {
      permitPaginationState.currentPage = newPage;
      applyPermitFilters();
    },
    "permitPaginationWrap",
    "permitPaginationInfo",
    "permitPaginationControls"
  );
}

// --- Reimburse Filtering & Pagination ---
function applyReimburseFilters() {
  const q = reimburseSearchQuery.trim().toLowerCase();

  const filtered = groupedReimburse.filter((g) => {
    return !q || g.user_name.toLowerCase().includes(q);
  });

  reimbursePaginationState.totalItems = filtered.length;
  const totalPages = Math.ceil(filtered.length / reimbursePaginationState.pageSize) || 1;
  if (reimbursePaginationState.currentPage > totalPages) {
    reimbursePaginationState.currentPage = totalPages;
  }

  const startIndex = (reimbursePaginationState.currentPage - 1) * reimbursePaginationState.pageSize;
  const paginated = filtered.slice(startIndex, startIndex + reimbursePaginationState.pageSize);

  ui.renderReimburseTable(paginated, {
    onOpenDetail: handleOpenReimburseDetail
  });

  ui.renderPagination(
    reimbursePaginationState,
    (newPage) => {
      reimbursePaginationState.currentPage = newPage;
      applyReimburseFilters();
    },
    "reimbursePaginationWrap",
    "reimbursePaginationInfo",
    "reimbursePaginationControls"
  );
}

// --- Action Handlers ---
function handleInitiateApprove(permitId) {
  const permit = allPermits.find((p) => p.id === permitId);
  if (!permit) return;

  currentActionPermitId = permitId;
  currentReimbursePayload = null;

  // Open Choice modal (Apakah mendapatkan reimburse?)
  ui.openModal("approveChoiceModal");
}

function handleApproveChoiceNo() {
  ui.closeModal("approveChoiceModal");
  currentReimbursePayload = null;
  openApproveDraftModal();
}

function handleApproveChoiceYes() {
  ui.closeModal("approveChoiceModal");
  const permit = allPermits.find((p) => p.id === currentActionPermitId);
  if (!permit) return;

  // Open detail days/hours modal
  const start = parseDateForCalc(permit.start_date);
  const end = parseDateForCalc(permit.end_date || permit.start_date);
  const defaultDays = Math.max(1, dayDiffInclusive(start, end));
  const defaultHours = calcPermitHours(permit.permit_hours || "");

  const daysInput = document.getElementById("reimburseDaysInput");
  const hoursInput = document.getElementById("reimburseHoursInput");
  if (daysInput) daysInput.value = String(defaultDays);
  if (hoursInput) hoursInput.value = String(defaultHours);

  ui.openModal("permitReimburseDetailModal");
}

function handleConfirmReimburseDetail() {
  const daysInput = document.getElementById("reimburseDaysInput");
  const hoursInput = document.getElementById("reimburseHoursInput");
  const permit = allPermits.find((p) => p.id === currentActionPermitId);

  const days = parseInt(daysInput?.value, 10) || 1;
  const hours = parseFloat(hoursInput?.value) || 0;

  currentReimbursePayload = {
    user_id: permit?.user_id || "",
    user_name: permit?.user_name || "Karyawan",
    user_email: permit?.user_email || "",
    user_photo: permit?.user_photo || "",
    permit_date: permit?.start_date || "",
    reimburse_days: days,
    reimburse_hours: hours,
    timeline: []
  };

  ui.closeModal("permitReimburseDetailModal");
  openApproveDraftModal(true, days, hours);
}

function openApproveDraftModal(includeReimburse = false, days = 1, hours = 0) {
  const permit = allPermits.find((p) => p.id === currentActionPermitId);
  if (!permit) return;

  const draft = buildApproveEmailTemplate(permit, getActorName(), includeReimburse, days, hours);
  const ta = document.getElementById("approveEmailTextarea");
  if (ta) ta.value = draft;

  ui.openModal("approveEmailModal");
}

async function handleSendApproveEmail() {
  if (!currentActionPermitId) return;
  const permit = allPermits.find((p) => p.id === currentActionPermitId);
  if (!permit) return;

  const ta = document.getElementById("approveEmailTextarea");
  const body = ta?.value || "";

  try {
    const toEmail = await repo.resolveUserEmail(permit.user_id, permit);
    if (toEmail) {
      const subject = `Izin Approved - ${permit.user_name} | ${ui.formatDateSlash(permit.start_date)}`;
      window.open(buildMailtoUrl(toEmail, subject, body), "_blank");
    }

    await repo.approvePermit(currentActionPermitId, {
      approvedBy: currentUser?.uid,
      approvedByName: getActorName(),
      reimburseData: currentReimbursePayload
    });

    ui.closeModal("approveEmailModal");
    ui.showToast("Persetujuan izin berhasil diproses.");
    currentActionPermitId = null;
    currentReimbursePayload = null;
  } catch (error) {
    console.error("[PermitOrchestrator] Gagal approve permit:", error);
    ui.showToast("Gagal memproses persetujuan izin.", "error");
  }
}

function handleInitiateReject(permitId) {
  const permit = allPermits.find((p) => p.id === permitId);
  if (!permit) return;

  currentActionPermitId = permitId;
  const draft = buildRejectEmailTemplate(permit, getActorName());
  const ta = document.getElementById("rejectEmailTextarea");
  if (ta) ta.value = draft;

  ui.openModal("rejectEmailModal");
}

async function handleSendRejectEmail() {
  if (!currentActionPermitId) return;
  const permit = allPermits.find((p) => p.id === currentActionPermitId);
  if (!permit) return;

  const ta = document.getElementById("rejectEmailTextarea");
  const body = ta?.value || "";

  try {
    const toEmail = await repo.resolveUserEmail(permit.user_id, permit);
    if (toEmail) {
      const subject = `Izin Ditolak - ${permit.user_name} | ${ui.formatDateSlash(permit.start_date)}`;
      window.open(buildMailtoUrl(toEmail, subject, body), "_blank");
    }

    await repo.rejectPermit(currentActionPermitId, {
      rejectedBy: currentUser?.uid,
      rejectedByName: getActorName(),
      reason: "Tidak disetujui oleh HR/Manajemen."
    });

    ui.closeModal("rejectEmailModal");
    ui.showToast("Penolakan izin berhasil diproses.");
    currentActionPermitId = null;
  } catch (error) {
    console.error("[PermitOrchestrator] Gagal reject permit:", error);
    ui.showToast("Gagal memproses penolakan izin.", "error");
  }
}

function handleInitiateDelete(permitId) {
  currentActionPermitId = permitId;
  ui.openModal("deleteConfirmModal");
}

async function handleConfirmDelete() {
  if (!currentActionPermitId) return;
  try {
    await repo.deletePermit(currentActionPermitId);
    ui.closeModal("deleteConfirmModal");
    ui.showToast("Pengajuan izin berhasil dihapus.");
    currentActionPermitId = null;
  } catch (error) {
    console.error("[PermitOrchestrator] Gagal delete permit:", error);
    ui.showToast("Gagal menghapus pengajuan izin.", "error");
  }
}

async function handleReapprove(permitId) {
  currentActionPermitId = permitId;
  document.querySelectorAll(".action-dropdown-menu.show").forEach((m) => m.classList.remove("show"));
  handleInitiateApprove(permitId);
}

async function handleRereject(permitId) {
  currentActionPermitId = permitId;
  document.querySelectorAll(".action-dropdown-menu.show").forEach((m) => m.classList.remove("show"));
  handleInitiateReject(permitId);
}

// --- Reimburse Detail Modal Handlers ---
function handleOpenReimburseDetail(groupKey) {
  const group = groupedReimburse.find((g) => g.key === groupKey);
  if (!group) return;

  activeGroupDetailKey = groupKey;

  const nameEl = document.getElementById("reimburseDetailName");
  const subtitleEl = document.getElementById("reimburseDetailSubtitle");
  const totalDaysEl = document.getElementById("reimburseDetailTotalDays");
  const totalHoursEl = document.getElementById("reimburseDetailTotalHours");
  const timelineEl = document.getElementById("reimburseDetailTimeline");

  if (nameEl) nameEl.textContent = `Detail Reimburse – ${group.user_name}`;
  if (subtitleEl) subtitleEl.textContent = `Pending: ${group.pending_days || 0} hari – Completed: ${group.completed_days || 0} hari`;
  if (totalDaysEl) totalDaysEl.textContent = String(group.pending_days !== undefined ? group.pending_days : group.total_days);
  if (totalHoursEl) totalHoursEl.textContent = String(group.pending_hours !== undefined ? group.pending_hours : group.total_hours);

  if (timelineEl) {
    const pendingDaysList = [];
    const completedDaysList = [];

    const items = group.items || [];
    items.forEach((item) => {
      const entries = item.dailyEntries || [];
      entries.forEach((entry) => {
        const dayObj = { item, entry };
        if (entry.status === "completed") {
          completedDaysList.push(dayObj);
        } else {
          pendingDaysList.push(dayObj);
        }
      });
    });

    pendingDaysList.sort((a, b) => String(a.entry.date).localeCompare(String(b.entry.date)));
    completedDaysList.sort((a, b) => String(a.entry.date).localeCompare(String(b.entry.date)));

    const renderDayItem = (item, entry, dotClass, isPending) => {
      const dateLabel = ui.formatDailyDate(entry.date);
      const jenis = ui.getPermitJenisLabel(item.related || item);
      const reason = (item.related && item.related.reason) ? item.related.reason : (item.reason || "-");

      const statusBadge = isPending
        ? `<span class="badge-status badge-pending" style="padding: 3px 10px; font-size: 10px;">PENDING</span>`
        : `<span class="badge-status badge-approved" style="padding: 3px 10px; font-size: 10px;">COMPLETED</span>`;

      const actionBtn = isPending
        ? `<button type="button" class="btn-complete-day" data-reimburse-id="${item.id}" data-date="${entry.date}">Complete</button>`
        : `<span class="text-xs text-slate-400 fst-italic">Selesai</span>`;

      return `
        <div class="timeline-row-item">
          <div class="timeline-left-col">
            <div class="timeline-dot ${dotClass}"></div>
            <div class="timeline-v-line"></div>
          </div>
          <div class="timeline-body-col">
            <div class="d-flex align-items-center flex-wrap gap-2">
              <span class="text-xs font-bold text-slate-800">${dateLabel}</span>
              ${statusBadge}
              <span class="badge bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-0.5 rounded-full">${jenis}</span>
            </div>
            <p class="text-xs text-slate-600 mt-1 mb-2 leading-relaxed">${ui.escapeHtml(reason)}</p>
            <div class="d-flex justify-content-end">
              ${actionBtn}
            </div>
          </div>
        </div>
      `;
    };

    const pendingHtml = pendingDaysList.map((d) => renderDayItem(d.item, d.entry, "timeline-dot-amber", true)).join("");
    const completedHtml = completedDaysList.map((d) => renderDayItem(d.item, d.entry, "timeline-dot-emerald", false)).join("");

    const pendingHeader = `
      <div class="d-flex align-items-center justify-content-between mt-3 mb-2">
        <h4 class="text-xs font-bold text-slate-800 m-0">Pending Reimburse</h4>
        <span class="text-xs text-slate-500">Total Hari: ${group.pending_days || 0}</span>
      </div>
    `;

    const completedHeader = `
      <div class="d-flex align-items-center justify-content-between mt-4 mb-2">
        <h4 class="text-xs font-bold text-slate-800 m-0">Completed Reimburse</h4>
        <span class="text-xs text-slate-500">Total Hari: ${group.completed_days || 0}</span>
      </div>
    `;

    timelineEl.innerHTML = `
      ${pendingHeader}
      ${pendingHtml || '<div class="text-xs text-slate-400 py-2">Tidak ada pending reimburse.</div>'}
      ${completedHeader}
      ${completedHtml || '<div class="text-xs text-slate-400 py-2">Belum ada reimburse completed.</div>'}
    `;

    timelineEl.querySelectorAll(".btn-complete-day").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const rId = btn.dataset.reimburseId;
        const dStr = btn.dataset.date;
        btn.disabled = true;
        btn.textContent = "Menyimpan...";
        try {
          await repo.markReimburseDayCompleted(rId, dStr, getActorName(), currentUser?.uid);
          ui.showToast(`Reimburse tanggal ${ui.formatDailyDate(dStr)} telah selesai.`);
          handleOpenReimburseDetail(activeGroupDetailKey);
        } catch (err) {
          console.error("[PermitOrchestrator] Gagal complete reimburse day:", err);
          ui.showToast("Gagal menyelesaikan reimburse harian.", "error");
          btn.disabled = false;
          btn.textContent = "Complete";
        }
      });
    });
  }

  ui.openModal("reimburseDetailModal");
}

// --- Setup Global Listeners ---
function setupEventListeners() {
  // Tab buttons
  document.getElementById("permitTabBtn")?.addEventListener("click", () => switchTab("permit"));
  document.getElementById("reimburseTabBtn")?.addEventListener("click", () => switchTab("reimburse"));

  // Permit Filters
  const permitSearch = document.getElementById("permitSearchInput");
  if (permitSearch) {
    permitSearch.addEventListener("input", (e) => {
      permitSearchQuery = e.target.value || "";
      permitPaginationState.currentPage = 1;
      applyPermitFilters();
    });
  }

  const permitStatus = document.getElementById("permitStatusFilter");
  if (permitStatus) {
    permitStatus.addEventListener("change", (e) => {
      permitStatusFilter = e.target.value || "all";
      permitPaginationState.currentPage = 1;
      applyPermitFilters();
    });
  }

  // Reimburse Search
  const reimburseSearch = document.getElementById("reimburseSearchInput");
  if (reimburseSearch) {
    reimburseSearch.addEventListener("input", (e) => {
      reimburseSearchQuery = e.target.value || "";
      reimbursePaginationState.currentPage = 1;
      applyReimburseFilters();
    });
  }

  // Modal Closures
  document.querySelectorAll(".modal-close-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modal = btn.closest(".modal-backdrop");
      if (modal) ui.closeModal(modal.id);
    });
  });

  // Approve Flow Modals
  document.getElementById("btnApproveChoiceNo")?.addEventListener("click", handleApproveChoiceNo);
  document.getElementById("btnApproveChoiceYes")?.addEventListener("click", handleApproveChoiceYes);
  document.getElementById("btnProceedReimburseDetail")?.addEventListener("click", handleConfirmReimburseDetail);
  document.getElementById("btnSendApproveEmail")?.addEventListener("click", handleSendApproveEmail);
  document.getElementById("btnSendRejectEmail")?.addEventListener("click", handleSendRejectEmail);
  document.getElementById("btnConfirmDeletePermit")?.addEventListener("click", handleConfirmDelete);

  // Close dropdown on outside click
  document.addEventListener("click", () => {
    document.querySelectorAll(".action-dropdown-menu.show").forEach((m) => m.classList.remove("show"));
  });
}

// --- Initialization ---
async function init() {
  try {
    // Normalize URL trailing slash in browser address bar
    if (window.location.pathname.endsWith("/") && window.location.pathname.length > 1) {
      const cleanPath = window.location.pathname.replace(/\/+$/, "") + window.location.search + window.location.hash;
      window.history.replaceState(null, "", cleanPath);
    }

    const { user, role } = await requireAuth();
    currentUser = user;
    currentRole = role;

    // Mount Shared Shell
    renderTopbar({ user, role });
    renderSidebar({ role, activePage: "permit-reimburse" });

    setupEventListeners();

    // Subscribe to Live Permits
    repo.subscribeToPermits(
      (permitsList) => {
        allPermits = permitsList;
        applyPermitFilters();
      },
      (err) => {
        console.error("[PermitOrchestrator] Error loading permits:", err);
      }
    );

    // Subscribe to Live Reimburse
    repo.subscribeToReimburse(
      async (reimburseList) => {
        // Hydrate photos if needed
        for (const item of reimburseList) {
          if (!item.user_photo && item.user_id) {
            item.user_photo = await repo.resolveUserPhoto(item.user_id);
          }
        }
        allReimburse = reimburseList;
        groupedReimburse = buildGroupedReimburse(reimburseList);
        applyReimburseFilters();

        if (activeGroupDetailKey) {
          handleOpenReimburseDetail(activeGroupDetailKey);
        }
      },
      (err) => {
        console.error("[PermitOrchestrator] Error loading reimburse:", err);
      }
    );
  } catch (error) {
    console.error("[PermitOrchestrator] Init error:", error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
