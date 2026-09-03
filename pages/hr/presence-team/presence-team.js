// pages/hr/presence-team/presence-team.js
// =====================================================================
// PRESENCE TEAM ORCHESTRATOR
// Coordinates auth, app shell (topbar/sidebar), repository, and UI.
// Handles business rules, aggregation, exports, and pagination state.
// =====================================================================

import { requireAuth } from "../../../assets/js/auth-guard.js";
import { renderTopbar } from "../../../assets/js/components/topbar/topbar.js";
import { renderSidebar } from "../../../assets/js/components/sidebar/sidebar.js";
import * as repo from "./presence-team.repository.js";
import * as ui from "./presence-team.ui.js";

// ── State ─────────────────────────────────────────────────────────────
let allStaffUsers = [];
let selectedDateRawRecords = [];
let dailyAggregatedRows = [];
let monthlyRecapCache = [];
let totalHoursCache = [];
let allAttendanceRawRecords = [];

let unsubscribeDaily = null;
let unsubscribeTotal = null;

// Pagination state (10 items per page, conditional)
const paginationState = {
  daily: { page: 1, rowsPerPage: 10 },
  monthly: { page: 1, rowsPerPage: 10 },
  total: { page: 1, rowsPerPage: 10 },
};

// ── Helpers ───────────────────────────────────────────────────────────
function getTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

function getMonthKeyFromDate(dateKey) {
  const d = new Date(dateKey + "T00:00:00");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthRangeFromMonthKey(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const f = (x) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(
      x.getDate(),
    ).padStart(2, "0")}`;
  return { startKey: f(start), endKey: f(end) };
}

function parseTimeToSeconds(t) {
  if (!t) return null;
  const [h, m, s] = String(t).split(":").map(Number);
  if ([h, m, s].some(Number.isNaN)) return null;
  return h * 3600 + m * 60 + s;
}

function formatMinutes(sec) {
  if (sec == null || sec < 0) return "-";
  const mins = Math.floor(sec / 60);
  return `${Math.floor(mins / 60)} Jam ${mins % 60} Menit`;
}

function getStaffPhoto(uid) {
  const f = allStaffUsers.find((u) => u.id === uid);
  return f ? f.photo || "" : "";
}

function getStaffName(uid) {
  const f = allStaffUsers.find((u) => u.id === uid);
  return f ? f.name : "Tanpa Nama";
}

function exportToXlsx(rows, sheetName, fileName) {
  if (!window.XLSX) {
    console.error("SheetJS (XLSX) library not available.");
    return;
  }
  const ws = window.XLSX.utils.json_to_sheet(rows);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, sheetName);
  window.XLSX.writeFile(wb, fileName);
}

// ── Daily Aggregation ─────────────────────────────────────────────────
function aggregateDailyRows(dateKey) {
  const map = new Map();
  selectedDateRawRecords.forEach((r) => {
    if (!r.user_id) return;
    if (!map.has(r.user_id)) {
      map.set(r.user_id, {
        loginTime: null,
        logoutTime: null,
        loginSec: null,
        logoutSec: null,
      });
    }
    const row = map.get(r.user_id);
    const sec = parseTimeToSeconds(r.time);
    if (r.type === "login" && (row.loginSec == null || sec < row.loginSec)) {
      row.loginSec = sec;
      row.loginTime = r.time || "-";
    }
    if (r.type === "logout" && (row.logoutSec == null || sec > row.logoutSec)) {
      row.logoutSec = sec;
      row.logoutTime = r.time || "-";
    }
  });

  const merged = allStaffUsers.map((user) => {
    const hit = map.get(user.id);
    let status = "Tidak Hadir";
    let totalSeconds = null;
    let loginLabel = "-";
    let logoutLabel = "-";
    let isValidPair = false;

    if (hit && hit.loginTime) {
      loginLabel = hit.loginTime;
      if (hit.logoutTime) {
        logoutLabel = hit.logoutTime;
        if (
          hit.logoutSec != null &&
          hit.loginSec != null &&
          hit.logoutSec >= hit.loginSec
        ) {
          totalSeconds = hit.logoutSec - hit.loginSec;
          isValidPair = true;
          status = "Present";
        } else {
          status = "Tidak Valid";
        }
      } else {
        status = "Tidak Valid (Belum Clock Out)";
      }
    }

    return {
      ...user,
      date: dateKey,
      loginTime: loginLabel,
      logoutTime: logoutLabel,
      totalSeconds,
      totalLabel: totalSeconds != null ? formatMinutes(totalSeconds) : "-",
      status,
      isValidPair,
      sortValue: hit?.loginSec ?? -1,
    };
  });

  merged.sort((a, b) => b.sortValue - a.sortValue);
  return merged;
}

function updateDailyKpis(rows, dateKey) {
  const present = rows.filter((r) => r.status === "Present").length;
  const pending = rows.filter((r) =>
    r.status.startsWith("Tidak Valid"),
  ).length;
  const absent = rows.filter((r) => r.status === "Tidak Hadir").length;

  ui.updateKpis({
    total: rows.length,
    present,
    pending,
    absent,
    dateKey,
  });
}

function renderDailyTable() {
  ui.renderDailyAttendanceTable(dailyAggregatedRows, {
    page: paginationState.daily.page,
    rowsPerPage: paginationState.daily.rowsPerPage,
    onPageChange: (newPage) => {
      paginationState.daily.page = newPage;
      renderDailyTable();
    },
  });
}

function setupDailyAttendanceSubscription(dateKey) {
  if (unsubscribeDaily) {
    unsubscribeDaily();
    unsubscribeDaily = null;
  }

  ui.setDailyLoading(true);

  unsubscribeDaily = repo.subscribeDailyAttendance(
    dateKey,
    (records) => {
      selectedDateRawRecords = records;
      dailyAggregatedRows = aggregateDailyRows(dateKey);
      paginationState.daily.page = 1;
      renderDailyTable();
      updateDailyKpis(dailyAggregatedRows, dateKey);
      ui.setDailyLoading(false);
    },
    (err) => {
      console.error("Realtime daily attendance error:", err);
      const summaryEl = document.getElementById("summaryText");
      if (summaryEl) summaryEl.textContent = "Gagal memuat realtime presensi.";
      ui.setDailyLoading(false);
    },
  );
}

// ── Monthly Recap ─────────────────────────────────────────────────────
async function loadMonthlyRecapData(monthKey) {
  const { startKey, endKey } = getMonthRangeFromMonthKey(monthKey);
  try {
    const rawRecords = await repo.fetchMonthlyAttendanceRecords(startKey, endKey);
    const allowed = new Set(allStaffUsers.map((u) => u.id));
    const byUD = new Map();

    rawRecords.forEach((d) => {
      if (!d.user_id || !d.date || !d.type || !allowed.has(d.user_id)) return;
      const key = `${d.user_id}__${d.date}`;
      if (!byUD.has(key)) {
        byUD.set(key, {
          user_id: d.user_id,
          name: d.name || "Tanpa Nama",
          loginSec: null,
          logoutSec: null,
        });
      }
      const row = byUD.get(key);
      const sec = parseTimeToSeconds(d.time);
      if (d.type === "login" && (row.loginSec == null || sec < row.loginSec)) {
        row.loginSec = sec;
      }
      if (d.type === "logout" && (row.logoutSec == null || sec > row.logoutSec)) {
        row.logoutSec = sec;
      }
    });

    const perStaff = new Map();
    byUD.forEach((v) => {
      if (
        v.loginSec == null ||
        v.logoutSec == null ||
        v.logoutSec < v.loginSec
      ) {
        return;
      }
      const dur = v.logoutSec - v.loginSec;
      const ex = perStaff.get(v.user_id) || {
        name: v.name,
        total: 0,
        days: 0,
      };
      ex.total += dur;
      ex.days++;
      perStaff.set(v.user_id, ex);
    });

    monthlyRecapCache = Array.from(perStaff.entries())
      .map(([uid, v]) => ({
        userId: uid,
        name: v.name,
        photo: getStaffPhoto(uid),
        total: v.total,
        attendanceDays: v.days,
      }))
      .sort((a, b) => b.total - a.total);

    paginationState.monthly.page = 1;
    renderMonthlyTable();
  } catch (err) {
    console.error("Gagal memuat rekap bulanan:", err);
  }
}

function renderMonthlyTable() {
  ui.renderMonthlyRecapTable(monthlyRecapCache, {
    page: paginationState.monthly.page,
    rowsPerPage: paginationState.monthly.rowsPerPage,
    formatMinutes,
    onPageChange: (newPage) => {
      paginationState.monthly.page = newPage;
      renderMonthlyTable();
    },
  });
}

// ── Total Jam & Gamification ──────────────────────────────────────────
function buildTotalHoursFromRecords(records) {
  const allowed = new Set(allStaffUsers.map((u) => u.id));
  const byUD = new Map();

  records.forEach((d) => {
    if (!d.user_id || !d.date || !d.type || !allowed.has(d.user_id)) return;
    const key = `${d.user_id}__${d.date}`;
    if (!byUD.has(key)) {
      byUD.set(key, {
        user_id: d.user_id,
        name: d.name || "Tanpa Nama",
        loginSec: null,
        logoutSec: null,
      });
    }
    const row = byUD.get(key);
    const sec = parseTimeToSeconds(d.time);
    if (d.type === "login" && (row.loginSec == null || sec < row.loginSec)) {
      row.loginSec = sec;
    }
    if (d.type === "logout" && (row.logoutSec == null || sec > row.logoutSec)) {
      row.logoutSec = sec;
    }
  });

  const perStaff = new Map();
  byUD.forEach((v) => {
    if (
      v.loginSec == null ||
      v.logoutSec == null ||
      v.logoutSec < v.loginSec
    ) {
      return;
    }
    const dur = v.logoutSec - v.loginSec;
    const ex = perStaff.get(v.user_id) || {
      name: v.name,
      total: 0,
      days: 0,
    };
    ex.total += dur;
    ex.days++;
    perStaff.set(v.user_id, ex);
  });

  totalHoursCache = Array.from(perStaff.entries())
    .map(([uid, v]) => ({
      userId: uid,
      name: v.name,
      photo: getStaffPhoto(uid),
      total: v.total,
      days: v.days,
    }))
    .sort((a, b) => b.total - a.total);

  allAttendanceRawRecords = records;
}

function renderTotalHoursTable() {
  ui.renderTotalHoursTable(totalHoursCache, {
    page: paginationState.total.page,
    rowsPerPage: paginationState.total.rowsPerPage,
    formatMinutes,
    onPageChange: (newPage) => {
      paginationState.total.page = newPage;
      renderTotalHoursTable();
    },
  });
}

function setupTotalHoursSubscription() {
  if (unsubscribeTotal) {
    unsubscribeTotal();
    unsubscribeTotal = null;
  }

  unsubscribeTotal = repo.subscribeAllAttendance(
    (records) => {
      buildTotalHoursFromRecords(records);
      paginationState.total.page = 1;
      renderTotalHoursTable();

      const gamiFilter = document.getElementById("gamiMonthFilter");
      const activeMonth =
        gamiFilter?.value || getMonthKeyFromDate(getTodayKey());
      calculateAndRenderGamification(activeMonth);
    },
    (err) => {
      console.error("Realtime total hours error:", err);
    },
  );
}

// ── Gamification Logic ────────────────────────────────────────────────
function getWorkDaysInMonth(monthKey) {
  // Tue, Thu, Sat, Sun (dow: 0=Sun, 2=Tue, 4=Thu, 6=Sat) - matching legacy
  const [y, m] = monthKey.split("-").map(Number);
  const days = [];
  const d = new Date(y, m - 1, 1);
  while (d.getMonth() === m - 1) {
    const dow = d.getDay();
    if ([0, 2, 4, 6].includes(dow)) {
      days.push(
        `${y}-${String(m).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      );
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function computeStreakSegs(att) {
  const segs = [];
  let i = 0;
  while (i < att.length) {
    if (att[i] !== 1) {
      segs.push({
        start: i,
        end: i,
        type: att[i] === -1 ? "future" : "absent",
        len: 1,
      });
      i++;
    } else {
      let j = i;
      while (j < att.length && att[j] === 1) j++;
      const len = j - i;
      segs.push({
        start: i,
        end: j - 1,
        type: len >= 2 ? "streak" : "present",
        len,
      });
      i = j;
    }
  }
  return segs;
}

function calcBestStreak(att) {
  let best = 0;
  let cur = 0;
  att.forEach((v) => {
    cur = v === 1 ? cur + 1 : 0;
    best = Math.max(best, cur);
  });
  return best;
}

function calcCurrentStreak(att) {
  let c = 0;
  let i = att.length - 1;
  while (i >= 0 && att[i] === -1) i--;
  while (i >= 0 && att[i] === 1) {
    c++;
    i--;
  }
  return c;
}

function calculateAndRenderGamification(monthKey) {
  if (!allStaffUsers.length) return;

  const { startKey, endKey } = getMonthRangeFromMonthKey(monthKey);
  const workDays = getWorkDaysInMonth(monthKey);
  const todayKey = getTodayKey();
  const allowed = new Set(allStaffUsers.map((u) => u.id));

  const presentMap = new Map();
  const byUD = new Map();

  allAttendanceRawRecords.forEach((d) => {
    if (!d.user_id || !d.date || !d.type || !allowed.has(d.user_id)) return;
    if (d.date < startKey || d.date > endKey) return;
    const key = `${d.user_id}__${d.date}`;
    if (!byUD.has(key)) {
      byUD.set(key, {
        user_id: d.user_id,
        loginSec: null,
        logoutSec: null,
      });
    }
    const row = byUD.get(key);
    const sec = parseTimeToSeconds(d.time);
    if (d.type === "login" && (row.loginSec == null || sec < row.loginSec)) {
      row.loginSec = sec;
    }
    if (d.type === "logout" && (row.logoutSec == null || sec > row.logoutSec)) {
      row.logoutSec = sec;
    }
  });

  byUD.forEach((v, key) => {
    const [uid] = key.split("__");
    if (
      v.loginSec == null ||
      v.logoutSec == null ||
      v.logoutSec < v.loginSec
    ) {
      return;
    }
    const date = key.split("__")[1];
    if (!presentMap.has(uid)) presentMap.set(uid, new Set());
    presentMap.get(uid).add(date);
  });

  // Earliest login per date
  const dateEarliest = new Map();
  byUD.forEach((v, key) => {
    const [uid, date] = key.split("__");
    if (
      v.loginSec == null ||
      v.logoutSec == null ||
      v.logoutSec < v.loginSec
    ) {
      return;
    }
    if (!dateEarliest.has(date)) dateEarliest.set(date, []);
    dateEarliest.get(date).push({ uid, loginSec: v.loginSec });
  });

  const earlyStreakMap = new Map();
  const earlyCountMap = new Map();
  allStaffUsers.forEach((u) => earlyStreakMap.set(u.id, 0));
  allStaffUsers.forEach((u) => earlyCountMap.set(u.id, 0));

  const pastWorkDays = workDays.filter((d) => d <= todayKey).sort();
  const earlyConsec = new Map();
  allStaffUsers.forEach((u) => earlyConsec.set(u.id, 0));

  pastWorkDays.forEach((date) => {
    const attendees = dateEarliest.get(date) || [];
    if (!attendees.length) {
      allStaffUsers.forEach((u) => earlyConsec.set(u.id, 0));
      return;
    }
    const minSec = Math.min(...attendees.map((a) => a.loginSec));
    const earliestUids = new Set(
      attendees.filter((a) => a.loginSec === minSec).map((a) => a.uid),
    );
    allStaffUsers.forEach((u) => {
      if (earliestUids.has(u.id)) {
        earlyConsec.set(u.id, earlyConsec.get(u.id) + 1);
        earlyStreakMap.set(u.id, earlyConsec.get(u.id));
        earlyCountMap.set(u.id, (earlyCountMap.get(u.id) || 0) + 1);
      } else {
        earlyConsec.set(u.id, 0);
      }
    });
  });

  const userData = allStaffUsers.map((u) => {
    const myPresent = presentMap.get(u.id) || new Set();
    const att = workDays.map((d) => {
      if (d > todayKey) return -1;
      return myPresent.has(d) ? 1 : 0;
    });
    const segs = computeStreakSegs(att);
    const bs = calcBestStreak(att);
    const cs = calcCurrentStreak(att);
    const tp = att.filter((v) => v === 1).length;
    const pc = att.filter((v) => v !== -1).length;
    const es = earlyStreakMap.get(u.id) || 0;
    const ec = earlyCountMap.get(u.id) || 0;
    return { ...u, att, segs, bs, cs, tp, pc, es, ec };
  });

  const sortedUsers = [...userData].sort(
    (a, b) => b.tp - a.tp || b.bs - a.bs,
  );

  ui.renderGamificationView({
    sortedUsers,
    workDays,
    todayKey,
  });
}

// ── Export Actions ────────────────────────────────────────────────────
function handleExportDailyXlsx() {
  const filterDateInput = document.getElementById("filterDate");
  const dateKey = filterDateInput?.value || getTodayKey();
  const rows = dailyAggregatedRows
    .filter((r) => r.isValidPair)
    .map((r) => ({
      Tanggal: dateKey,
      Nama_Team: r.name,
      Clock_In: r.loginTime,
      Clock_Out: r.logoutTime,
      Total_Jam_Kerja: r.totalLabel,
      Status: r.status,
    }));
  exportToXlsx(rows, "Presensi Harian", `presensi-team-${dateKey}.xlsx`);
}

function handleExportMonthlyXlsx() {
  const recapMonthFilter = document.getElementById("recapMonthFilter");
  const mk = recapMonthFilter?.value || getMonthKeyFromDate(getTodayKey());
  const rows = monthlyRecapCache.map((r) => ({
    Bulan: mk,
    Nama_Team: r.name,
    Hari_Hadir: r.attendanceDays,
    Total_Jam_Kerja: formatMinutes(r.total),
  }));
  exportToXlsx(rows, "Rekap Bulanan", `rekap-bulanan-team-${mk}.xlsx`);
}

function handleExportTotalJamXlsx() {
  const rows = totalHoursCache.map((r) => ({
    Nama_Team: r.name,
    Total_Hari_Hadir: r.days,
    Total_Jam_Kerja: formatMinutes(r.total),
  }));
  exportToXlsx(rows, "Total Jam Team", "total-jam-team.xlsx");
}

// ── Gamification Tabs ─────────────────────────────────────────────────
function setupGamificationTabs() {
  const tabButtons = document.querySelectorAll(".gami-tab");
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const tabProgress = document.getElementById("gamiTabProgress");
      const tabLeaderboard = document.getElementById("gamiTabLeaderboard");
      const tabLegend = document.getElementById("gamiTabLegend");

      if (tabProgress) tabProgress.classList.add("hidden");
      if (tabLeaderboard) tabLeaderboard.classList.add("hidden");
      if (tabLegend) tabLegend.classList.add("hidden");

      const tabId = btn.dataset.tab;
      if (tabId === "progress" && tabProgress) tabProgress.classList.remove("hidden");
      if (tabId === "leaderboard" && tabLeaderboard) tabLeaderboard.classList.remove("hidden");
      if (tabId === "legend" && tabLegend) tabLegend.classList.remove("hidden");
    });
  });
}

// ── Wire Controls ─────────────────────────────────────────────────────
function wireEventListeners() {
  const filterDateInput = document.getElementById("filterDate");
  const recapMonthFilter = document.getElementById("recapMonthFilter");
  const gamiMonthFilter = document.getElementById("gamiMonthFilter");

  const btnExportXlsx = document.getElementById("btnExportXlsx");
  const btnExportMonthlyRecapXlsx = document.getElementById(
    "btnExportMonthlyRecapXlsx",
  );
  const btnExportInternshipTotalXlsx = document.getElementById(
    "btnExportInternshipTotalXlsx",
  );

  if (filterDateInput) {
    filterDateInput.addEventListener("change", () => {
      const val = filterDateInput.value || getTodayKey();
      setupDailyAttendanceSubscription(val);
    });
  }

  if (recapMonthFilter) {
    recapMonthFilter.addEventListener("change", () => {
      const val =
        recapMonthFilter.value || getMonthKeyFromDate(getTodayKey());
      loadMonthlyRecapData(val);
    });
  }

  if (gamiMonthFilter) {
    gamiMonthFilter.addEventListener("change", () => {
      const val =
        gamiMonthFilter.value || getMonthKeyFromDate(getTodayKey());
      calculateAndRenderGamification(val);
    });
  }

  if (btnExportXlsx) {
    btnExportXlsx.addEventListener("click", handleExportDailyXlsx);
  }

  if (btnExportMonthlyRecapXlsx) {
    btnExportMonthlyRecapXlsx.addEventListener("click", handleExportMonthlyXlsx);
  }

  if (btnExportInternshipTotalXlsx) {
    btnExportInternshipTotalXlsx.addEventListener(
      "click",
      handleExportTotalJamXlsx,
    );
  }

  setupGamificationTabs();
}

// ── Initialization ────────────────────────────────────────────────────
export async function initialize() {
  try {
    const { user, role } = await requireAuth();

    renderTopbar({ user, role });
    renderSidebar({ role, activePage: "presence-team" });

    const todayKey = getTodayKey();
    const todayMonth = getMonthKeyFromDate(todayKey);

    const filterDateInput = document.getElementById("filterDate");
    const recapMonthFilter = document.getElementById("recapMonthFilter");
    const gamiMonthFilter = document.getElementById("gamiMonthFilter");

    if (filterDateInput) filterDateInput.value = todayKey;
    if (recapMonthFilter) recapMonthFilter.value = todayMonth;
    if (gamiMonthFilter) gamiMonthFilter.value = todayMonth;

    wireEventListeners();

    // 1. Load active staff users
    allStaffUsers = await repo.loadStaffUsers();

    // 2. Realtime daily attendance
    setupDailyAttendanceSubscription(todayKey);

    // 3. Monthly recap
    await loadMonthlyRecapData(todayMonth);

    // 4. Realtime total hours and gamification
    setupTotalHoursSubscription();

    console.log("Presence Team feature initialized successfully");
  } catch (err) {
    console.error("Init presence-team gagal:", err);
    const summaryEl = document.getElementById("summaryText");
    if (summaryEl) summaryEl.textContent = "Gagal inisialisasi data presensi.";
    ui.setDailyLoading(false);
  }
}

// Auto-run if loaded as script
initialize();
