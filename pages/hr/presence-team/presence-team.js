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
let allPresenceUsers = [];
let allStaffUsers = [];
// Independent category filters per table (preserves user preference per section)
let dailyCategory = "team";    // 'team' | 'intern' | 'all'
let monthlyCategory = "team";  // 'team' | 'intern' | 'all'
let totalCategory = "team";    // 'team' | 'intern' | 'all'
let gamiCategory = "team";     // 'team' | 'intern' | 'all'

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
function getActiveUsers(category = "team") {
  if (category === "all") return allPresenceUsers;
  return allPresenceUsers.filter((u) => u.category === category);
}

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
  const parts = String(t).trim().split(":").map(Number);
  if (parts.length === 2) {
    if (isNaN(parts[0]) || isNaN(parts[1])) return null;
    return parts[0] * 3600 + parts[1] * 60;
  }
  if (parts.length === 3) {
    if (parts.some(isNaN)) return null;
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return null;
}

function formatMinutes(sec) {
  if (sec == null || sec < 0) return "-";
  const mins = Math.floor(sec / 60);
  return `${Math.floor(mins / 60)} Jam ${mins % 60} Menit`;
}

function getStaffPhoto(uid) {
  const f = allPresenceUsers.find((u) => u.id === uid);
  return f ? f.photo || "" : "";
}

function getStaffName(uid) {
  const f = allPresenceUsers.find((u) => u.id === uid);
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
function aggregateDailyRows(dateKey, category = dailyCategory) {
  const map = new Map();
  selectedDateRawRecords.forEach((r) => {
    const uid = r.user_id || r.userId || r.uid;
    if (!uid) return;
    if (!map.has(uid)) {
      map.set(uid, {
        loginTime: null,
        logoutTime: null,
        loginSec: null,
        logoutSec: null,
      });
    }
    const row = map.get(uid);

    const rawType = String(r.type || r.status || "").trim().toLowerCase();
    const isLogin =
      rawType === "login" ||
      rawType === "clock_in" ||
      rawType === "check_in" ||
      rawType === "in" ||
      rawType.includes("login") ||
      rawType.includes("masuk");
    const isLogout =
      rawType === "logout" ||
      rawType === "clock_out" ||
      rawType === "clock-out" ||
      rawType === "check_out" ||
      rawType === "check-out" ||
      rawType === "out" ||
      rawType.includes("out") ||
      rawType.includes("pulang") ||
      rawType.includes("keluar") ||
      rawType === "locked-logout";

    const sec = parseTimeToSeconds(r.time);
    if (isLogin) {
      if (sec != null && (row.loginSec == null || sec < row.loginSec)) {
        row.loginSec = sec;
        row.loginTime = r.time || "-";
      } else if (!row.loginTime || row.loginTime === "-") {
        row.loginTime = r.time || "-";
      }
    }
    if (isLogout) {
      if (sec != null && (row.logoutSec == null || sec > row.logoutSec)) {
        row.logoutSec = sec;
        row.logoutTime = r.time || "-";
      } else if (!row.logoutTime || row.logoutTime === "-") {
        row.logoutTime = r.time || "-";
      }
    }

    // Direct check-out/logout fields on the same document (if written as fields)
    const directLogout =
      r.clock_out || r.check_out || r.logout_time || r.logoutTime || r.checkout;
    if (directLogout) {
      const dSec = parseTimeToSeconds(directLogout);
      if (dSec != null && (row.logoutSec == null || dSec > row.logoutSec)) {
        row.logoutSec = dSec;
        row.logoutTime = directLogout;
      } else if (!row.logoutTime || row.logoutTime === "-") {
        row.logoutTime = directLogout;
      }
    }
    const directLogin =
      r.clock_in || r.check_in || r.login_time || r.loginTime || r.checkin;
    if (directLogin) {
      const lSec = parseTimeToSeconds(directLogin);
      if (lSec != null && (row.loginSec == null || lSec < row.loginSec)) {
        row.loginSec = lSec;
        row.loginTime = directLogin;
      } else if (!row.loginTime || row.loginTime === "-") {
        row.loginTime = directLogin;
      }
    }
  });

  const activeUsers = getActiveUsers(category);
  const merged = activeUsers.map((user) => {
    const hit = map.get(user.id);
    let status = "Tidak Hadir";
    let totalSeconds = null;
    let loginLabel = "-";
    let logoutLabel = "-";
    let isValidPair = false;

    if (hit) {
      if (hit.loginTime && hit.loginTime !== "-") loginLabel = hit.loginTime;
      if (hit.logoutTime && hit.logoutTime !== "-") logoutLabel = hit.logoutTime;

      if (
        hit.loginTime &&
        hit.logoutTime &&
        hit.loginTime !== "-" &&
        hit.logoutTime !== "-"
      ) {
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
      } else if (hit.loginTime && hit.loginTime !== "-") {
        status = "Tidak Valid (Belum Clock Out)";
      } else if (hit.logoutTime && hit.logoutTime !== "-") {
        status = "Tidak Valid (Hanya Clock Out)";
      }
    }

    const lateness = repo.calculateLateness(dateKey, loginLabel);

    let combinedSeconds = null;
    if (totalSeconds != null) {
      combinedSeconds =
        totalSeconds + (lateness.isLate ? (lateness.lateSeconds || 0) : 0);
    }

    return {
      ...user,
      date: dateKey,
      status,
      loginTime: loginLabel,
      logoutTime: logoutLabel,
      totalSeconds,
      totalLabel: totalSeconds != null ? formatMinutes(totalSeconds) : "-",
      combinedSeconds,
      combinedLabel: combinedSeconds != null ? formatMinutes(combinedSeconds) : "-",
      isLate: lateness.isLate,
      lateFormatted: lateness.lateFormatted,
      lateTotalHoursFormatted: lateness.lateTotalHoursFormatted,
      lateSeconds: lateness.lateSeconds,
      lateHours: lateness.lateHours,
      lateMinutes: lateness.lateMinutes,
      lateHoursDecimal: lateness.lateHoursDecimal,
      lateMinutesDecimal: lateness.lateMinutesDecimal,
      scheduleLabel: lateness.scheduleLabel,
      isValidPair,
      sortValue: hit?.loginSec ?? -1,
    };
  });

  merged.sort((a, b) => b.sortValue - a.sortValue);
  return merged;
}

function updateDailyKpis(rows, dateKey, category = dailyCategory) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const present = safeRows.filter((r) => r.status === "Present").length;
  const totalWorkSeconds = safeRows.reduce(
    (sum, r) => sum + (r.totalSeconds || 0),
    0,
  );
  const totalWorkHoursFormatted = formatMinutes(totalWorkSeconds);

  const lateRows = safeRows.filter((r) => r.isLate);
  const lateCount = lateRows.length;
  const totalLateSeconds = lateRows.reduce(
    (sum, r) => sum + (r.lateSeconds || 0),
    0,
  );
  const lateH = Math.floor(totalLateSeconds / 3600);
  const lateM = Math.floor((totalLateSeconds % 3600) / 60);
  const totalLateHoursFormatted =
    totalLateSeconds > 0
      ? lateH > 0
        ? `${lateH} Jam ${lateM} Menit`
        : `${lateM} Menit`
      : "0 Menit";

  const pending = safeRows.filter(
    (r) =>
      r.status &&
      (r.status.startsWith("Tidak Valid") ||
        r.status.startsWith("Belum Clock Out")),
  ).length;
  const absent = safeRows.filter((r) => r.status === "Tidak Hadir").length;

  ui.updateKpis({
    total: safeRows.length,
    present,
    totalWorkHoursFormatted,
    lateCount,
    totalLateHoursFormatted,
    pending,
    absent,
    dateKey,
    category,
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

  let normDate = String(dateKey || "").trim();
  if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(normDate)) {
    const [d, m, y] = normDate.split(/[\/\-]/);
    normDate = `${y}-${m}-${d}`;
  }

  ui.setDailyLoading(true);

  // Safety timer to prevent spinner from running indefinitely
  const safetyTimer = setTimeout(() => {
    ui.setDailyLoading(false);
  }, 3500);

  unsubscribeDaily = repo.subscribeDailyAttendance(
    normDate,
    (records) => {
      clearTimeout(safetyTimer);
      try {
        selectedDateRawRecords = records || [];
        dailyAggregatedRows = aggregateDailyRows(normDate, dailyCategory);
        paginationState.daily.page = 1;
        renderDailyTable();
        updateDailyKpis(dailyAggregatedRows, normDate, dailyCategory);
      } catch (err) {
        console.error("Realtime daily attendance processing error:", err);
      } finally {
        ui.setDailyLoading(false);
      }
    },
    (err) => {
      clearTimeout(safetyTimer);
      console.error("Realtime daily attendance error:", err);
      const summaryEl = document.getElementById("summaryText");
      if (summaryEl) summaryEl.textContent = "Gagal memuat realtime presensi.";
      ui.setDailyLoading(false);
    },
  );
}

// ── Monthly Recap ─────────────────────────────────────────────────────
async function loadMonthlyRecapData(monthKey, category = monthlyCategory) {
  const { startKey, endKey } = getMonthRangeFromMonthKey(monthKey);
  try {
    const rawRecords = await repo.fetchMonthlyAttendanceRecords(startKey, endKey);
    const activeUsers = getActiveUsers(category);
    const activeUserMap = new Map(activeUsers.map((u) => [u.id, u]));
    const allowed = new Set(activeUsers.map((u) => u.id));
    const byUD = new Map();

    rawRecords.forEach((d) => {
      const uid = d.user_id || d.userId || d.uid;
      if (!uid || !d.date || !allowed.has(uid)) return;
      const key = `${uid}__${d.date}`;
      if (!byUD.has(key)) {
        byUD.set(key, {
          user_id: uid,
          name: d.name || "Tanpa Nama",
          date: d.date,
          loginSec: null,
          logoutSec: null,
          loginTime: null,
        });
      }
      const row = byUD.get(key);
      const rawType = String(d.type || d.status || "").trim().toLowerCase();
      const isLogin =
        rawType === "login" ||
        rawType === "clock_in" ||
        rawType === "check_in" ||
        rawType === "in";
      const isLogout =
        rawType === "logout" ||
        rawType === "clock_out" ||
        rawType === "check_out" ||
        rawType === "out" ||
        rawType.includes("out");

      const sec = parseTimeToSeconds(d.time);
      if (isLogin && sec != null && (row.loginSec == null || sec < row.loginSec)) {
        row.loginSec = sec;
        row.loginTime = d.time;
      }
      if (isLogout && sec != null && (row.logoutSec == null || sec > row.logoutSec)) {
        row.logoutSec = sec;
      }

      const directLogout =
        d.clock_out || d.check_out || d.logout_time || d.logoutTime || d.checkout;
      if (directLogout) {
        const dSec = parseTimeToSeconds(directLogout);
        if (dSec != null && (row.logoutSec == null || dSec > row.logoutSec)) {
          row.logoutSec = dSec;
        }
      }
      const directLogin =
        d.clock_in || d.check_in || d.login_time || d.loginTime || d.checkin;
      if (directLogin) {
        const lSec = parseTimeToSeconds(directLogin);
        if (lSec != null && (row.loginSec == null || lSec < row.loginSec)) {
          row.loginSec = lSec;
          row.loginTime = directLogin;
        }
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
      const userObj = activeUserMap.get(v.user_id) || {};
      const ex = perStaff.get(v.user_id) || {
        name: userObj.name || v.name,
        category: userObj.category || "team",
        total: 0,
        days: 0,
        lateCount: 0,
        totalLateSeconds: 0,
      };

      const lateness = repo.calculateLateness(v.date, v.loginTime);
      if (lateness.isLate) {
        ex.lateCount++;
        ex.totalLateSeconds += lateness.lateSeconds;
      }

      ex.total += dur;
      ex.days++;
      perStaff.set(v.user_id, ex);
    });

    monthlyRecapCache = Array.from(perStaff.entries())
      .map(([uid, v]) => {
        const totalLateHours = Math.floor(v.totalLateSeconds / 3600);
        const totalLateMins = Math.floor((v.totalLateSeconds % 3600) / 60);
        let lateFormattedHours = "0 Menit";
        if (v.totalLateSeconds > 0) {
          lateFormattedHours =
            totalLateHours > 0
              ? `${totalLateHours} Jam ${totalLateMins} Menit`
              : `${totalLateMins} Menit`;
        }
        const totalEffective = v.total;
        const totalCombined = v.total + v.totalLateSeconds;
        return {
          userId: uid,
          name: v.name,
          category: v.category,
          photo: getStaffPhoto(uid),
          total: totalEffective,
          totalCombined,
          attendanceDays: v.days,
          lateCount: v.lateCount,
          totalLateSeconds: v.totalLateSeconds,
          totalLateMinutes: Math.round(v.totalLateSeconds / 60),
          totalLateHoursDecimal: Number((v.totalLateSeconds / 3600).toFixed(2)),
          lateFormattedHours,
        };
      })
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
function buildTotalHoursFromRecords(records, category = totalCategory) {
  const activeUsers = getActiveUsers(category);
  const activeUserMap = new Map(activeUsers.map((u) => [u.id, u]));
  const allowed = new Set(activeUsers.map((u) => u.id));
  const byUD = new Map();

  records.forEach((d) => {
    const uid = d.user_id || d.userId || d.uid;
    if (!uid || !d.date || !allowed.has(uid)) return;
    const key = `${uid}__${d.date}`;
    if (!byUD.has(key)) {
      byUD.set(key, {
        user_id: uid,
        name: d.name || "Tanpa Nama",
        loginSec: null,
        logoutSec: null,
      });
    }
    const row = byUD.get(key);
    const rawType = String(d.type || d.status || "").trim().toLowerCase();
    const isLogin =
      rawType === "login" ||
      rawType === "clock_in" ||
      rawType === "check_in" ||
      rawType === "in";
    const isLogout =
      rawType === "logout" ||
      rawType === "clock_out" ||
      rawType === "check_out" ||
      rawType === "out" ||
      rawType.includes("out");

    const sec = parseTimeToSeconds(d.time);
    if (isLogin && sec != null && (row.loginSec == null || sec < row.loginSec)) {
      row.loginSec = sec;
    }
    if (isLogout && sec != null && (row.logoutSec == null || sec > row.logoutSec)) {
      row.logoutSec = sec;
    }

    const directLogout =
      d.clock_out || d.check_out || d.logout_time || d.logoutTime || d.checkout;
    if (directLogout) {
      const dSec = parseTimeToSeconds(directLogout);
      if (dSec != null && (row.logoutSec == null || dSec > row.logoutSec)) {
        row.logoutSec = dSec;
      }
    }
    const directLogin =
      d.clock_in || d.check_in || d.login_time || d.loginTime || d.checkin;
    if (directLogin) {
      const lSec = parseTimeToSeconds(directLogin);
      if (lSec != null && (row.loginSec == null || lSec < row.loginSec)) {
        row.loginSec = lSec;
      }
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
    const userObj = activeUserMap.get(v.user_id) || {};
    const ex = perStaff.get(v.user_id) || {
      name: userObj.name || v.name,
      category: userObj.category || "team",
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
      category: v.category,
      photo: getStaffPhoto(uid),
      total: v.total,
      days: v.days,
    }))
    .sort((a, b) => b.total - a.total);

  allAttendanceRawRecords = records;
  return totalHoursCache;
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
      allAttendanceRawRecords = records || [];
      buildTotalHoursFromRecords(allAttendanceRawRecords, totalCategory);
      paginationState.total.page = 1;
      renderTotalHoursTable();

      const gamiFilter = document.getElementById("gamiMonthFilter");
      const activeMonth =
        gamiFilter?.value || getMonthKeyFromDate(getTodayKey());
      calculateAndRenderGamification(activeMonth, gamiCategory);
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

function calculateAndRenderGamification(monthKey, category = gamiCategory) {
  const activeUsers = getActiveUsers(category);
  if (!activeUsers.length) {
    const gamiCards = document.getElementById("gamiCards");
    const gamiEmpty = document.getElementById("gamiEmpty");
    const gamiLeaderboard = document.getElementById("gamiLeaderboard");
    const gamiLdrEmpty = document.getElementById("gamiLdrEmpty");
    if (gamiCards) gamiCards.innerHTML = "";
    if (gamiEmpty) gamiEmpty.classList.remove("hidden");
    if (gamiLeaderboard) gamiLeaderboard.innerHTML = "";
    if (gamiLdrEmpty) gamiLdrEmpty.classList.remove("hidden");
    return;
  }

  const { startKey, endKey } = getMonthRangeFromMonthKey(monthKey);
  const workDays = getWorkDaysInMonth(monthKey);
  const todayKey = getTodayKey();
  const allowed = new Set(activeUsers.map((u) => u.id));

  const presentMap = new Map();
  const byUD = new Map();

  allAttendanceRawRecords.forEach((d) => {
    const uid = d.user_id || d.userId || d.uid;
    if (!uid || !d.date || !allowed.has(uid)) return;
    if (d.date < startKey || d.date > endKey) return;
    const key = `${uid}__${d.date}`;
    if (!byUD.has(key)) {
      byUD.set(key, {
        user_id: uid,
        loginSec: null,
        logoutSec: null,
      });
    }
    const row = byUD.get(key);
    const rawType = String(d.type || d.status || "").trim().toLowerCase();
    const isLogin =
      rawType === "login" ||
      rawType === "clock_in" ||
      rawType === "check_in" ||
      rawType === "in";
    const isLogout =
      rawType === "logout" ||
      rawType === "clock_out" ||
      rawType === "check_out" ||
      rawType === "out" ||
      rawType.includes("out");

    const sec = parseTimeToSeconds(d.time);
    if (isLogin && sec != null && (row.loginSec == null || sec < row.loginSec)) {
      row.loginSec = sec;
    }
    if (isLogout && sec != null && (row.logoutSec == null || sec > row.logoutSec)) {
      row.logoutSec = sec;
    }

    const directLogout =
      d.clock_out || d.check_out || d.logout_time || d.logoutTime || d.checkout;
    if (directLogout) {
      const dSec = parseTimeToSeconds(directLogout);
      if (dSec != null && (row.logoutSec == null || dSec > row.logoutSec)) {
        row.logoutSec = dSec;
      }
    }
    const directLogin =
      d.clock_in || d.check_in || d.login_time || d.loginTime || d.checkin;
    if (directLogin) {
      const lSec = parseTimeToSeconds(directLogin);
      if (lSec != null && (row.loginSec == null || lSec < row.loginSec)) {
        row.loginSec = lSec;
      }
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
  activeUsers.forEach((u) => earlyStreakMap.set(u.id, 0));
  activeUsers.forEach((u) => earlyCountMap.set(u.id, 0));

  const pastWorkDays = workDays.filter((d) => d <= todayKey).sort();
  const earlyConsec = new Map();
  activeUsers.forEach((u) => earlyConsec.set(u.id, 0));

  pastWorkDays.forEach((date) => {
    const attendees = dateEarliest.get(date) || [];
    if (!attendees.length) {
      activeUsers.forEach((u) => earlyConsec.set(u.id, 0));
      return;
    }
    const minSec = Math.min(...attendees.map((a) => a.loginSec));
    const earliestUids = new Set(
      attendees.filter((a) => a.loginSec === minSec).map((a) => a.uid),
    );
    activeUsers.forEach((u) => {
      if (earliestUids.has(u.id)) {
        earlyConsec.set(u.id, earlyConsec.get(u.id) + 1);
        earlyStreakMap.set(u.id, earlyConsec.get(u.id));
        earlyCountMap.set(u.id, (earlyCountMap.get(u.id) || 0) + 1);
      } else {
        earlyConsec.set(u.id, 0);
      }
    });
  });

  const userData = activeUsers.map((u) => {
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
    .filter((r) => r.loginTime && r.loginTime !== "-")
    .map((r) => ({
      Tanggal: dateKey,
      Kategori: r.category === "intern" ? "Intern" : "Team",
      Nama_Team: r.name,
      Clock_In: r.loginTime,
      Clock_Out: r.logoutTime || "-",
      Jadwal_Masuk: r.scheduleLabel || "-",
      Status_Masuk: r.isLate
        ? "Terlambat"
        : r.loginTime !== "-"
          ? "Tepat Waktu"
          : "-",
      Keterlambatan: r.isLate ? r.lateFormatted : "-",
      Total_Jam_Keterlambatan: r.isLate ? r.lateTotalHoursFormatted : "0 Menit",
      Total_Jam_Keterlambatan_Desimal: r.isLate ? r.lateHoursDecimal : 0,
      Total_Jam_Kerja_Efektif: r.totalLabel || "-",
      Total_Jam_Kerja_Ditambah_Telat: r.combinedLabel || "-",
      Status: r.status,
    }));
  exportToXlsx(
    rows,
    "Presensi Harian",
    `presensi-${dailyCategory}-${dateKey}.xlsx`,
  );
}

function handleExportMonthlyXlsx() {
  const recapMonthFilter = document.getElementById("recapMonthFilter");
  const mk = recapMonthFilter?.value || getMonthKeyFromDate(getTodayKey());
  const rows = monthlyRecapCache.map((r) => ({
    Bulan: mk,
    Kategori: r.category === "intern" ? "Intern" : "Team",
    Nama: r.name,
    Hari_Hadir: r.attendanceDays,
    Frekuensi_Terlambat: r.lateCount ? `${r.lateCount}x` : "0x (Tepat Waktu)",
    Total_Keterlambatan: r.lateFormattedHours || "0 Menit",
    Total_Jam_Keterlambatan_Desimal: r.totalLateHoursDecimal || 0,
    Total_Jam_Kerja_Efektif: formatMinutes(r.total),
    Total_Jam_Kerja_Ditambah_Telat: formatMinutes(r.totalCombined),
  }));
  exportToXlsx(
    rows,
    "Rekap Bulanan",
    `rekap-bulanan-${monthlyCategory}-${mk}.xlsx`,
  );
}

function handleExportTotalJamXlsx() {
  const rows = totalHoursCache.map((r) => ({
    Kategori: r.category === "intern" ? "Intern" : "Team",
    Nama: r.name,
    Total_Hari_Hadir: r.days,
    Total_Jam_Kerja: formatMinutes(r.total),
  }));
  exportToXlsx(rows, "Total Jam", `total-jam-${totalCategory}.xlsx`);
}

// ── Segmented Category Filter Helper ──────────────────────────────────
let currentExportControls = null;

function bindSegmentedFilter(containerId, initialCategory, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const btns = container.querySelectorAll(".category-btn");
  btns.forEach((btn) => {
    const cat = btn.dataset.category || "team";
    if (cat === initialCategory) {
      btn.classList.add("active");
      btn.classList.remove("text-slate-500");
    } else {
      btn.classList.remove("active");
      btn.classList.add("text-slate-500");
    }
    btn.addEventListener("click", () => {
      btns.forEach((b) => {
        b.classList.remove("active");
        b.classList.add("text-slate-500");
      });
      btn.classList.add("active");
      btn.classList.remove("text-slate-500");
      onChange(cat);
    });
  });
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
      if (tabId === "progress" && tabProgress)
        tabProgress.classList.remove("hidden");
      if (tabId === "leaderboard" && tabLeaderboard)
        tabLeaderboard.classList.remove("hidden");
      if (tabId === "legend" && tabLegend)
        tabLegend.classList.remove("hidden");
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

  // Independent Category Filters per table/section
  bindSegmentedFilter("categoryFilterContainer", dailyCategory, (cat) => {
    dailyCategory = cat;
    const filterDateInput = document.getElementById("filterDate");
    const dateKey = filterDateInput?.value || getTodayKey();
    dailyAggregatedRows = aggregateDailyRows(dateKey, dailyCategory);
    paginationState.daily.page = 1;
    renderDailyTable();
    updateDailyKpis(dailyAggregatedRows, dateKey, dailyCategory);
  });

  bindSegmentedFilter("monthlyCategoryFilterContainer", monthlyCategory, (cat) => {
    monthlyCategory = cat;
    const recapMonthFilter = document.getElementById("recapMonthFilter");
    const mk = recapMonthFilter?.value || getMonthKeyFromDate(getTodayKey());
    loadMonthlyRecapData(mk, monthlyCategory);
  });

  bindSegmentedFilter("totalCategoryFilterContainer", totalCategory, (cat) => {
    totalCategory = cat;
    buildTotalHoursFromRecords(allAttendanceRawRecords, totalCategory);
    paginationState.total.page = 1;
    renderTotalHoursTable();
  });

  bindSegmentedFilter("gamiCategoryFilterContainer", gamiCategory, (cat) => {
    gamiCategory = cat;
    const gamiMonthFilter = document.getElementById("gamiMonthFilter");
    const gamiMk = gamiMonthFilter?.value || getMonthKeyFromDate(getTodayKey());
    calculateAndRenderGamification(gamiMk, gamiCategory);
  });

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
      loadMonthlyRecapData(val, monthlyCategory);
    });
  }

  if (gamiMonthFilter) {
    gamiMonthFilter.addEventListener("change", () => {
      const val =
        gamiMonthFilter.value || getMonthKeyFromDate(getTodayKey());
      calculateAndRenderGamification(val, gamiCategory);
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

  // Setup Standard Export Modal Controls
  currentExportControls = ui.initPresenceExportModal();
  const btnOpenExportModal = document.getElementById("btnOpenExportPresenceModal");
  if (btnOpenExportModal && currentExportControls?.setCategory) {
    btnOpenExportModal.addEventListener("click", () => {
      currentExportControls.setCategory(dailyCategory);
    });
  }

  const exportForm = document.getElementById("exportPresenceForm");
  if (exportForm && currentExportControls) {
    exportForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      currentExportControls.setLoading(true);
      try {
        const formData = currentExportControls.getFormData();
        await repo.exportPresenceAttendanceData({
          format: formData.format,
          rangeType: formData.rangeType,
          category: formData.category || "all",
          monthValue: formData.month,
          weekValue: formData.week,
        });

        const modalEl = document.getElementById("exportPresenceModal");
        if (modalEl && window.bootstrap) {
          const inst = bootstrap.Modal.getInstance(modalEl);
          if (inst) inst.hide();
        }
      } catch (err) {
        console.error("Export presence error:", err);
      } finally {
        currentExportControls.setLoading(false);
      }
    });
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

    // 1. Load all presence users (both team & intern)
    try {
      allPresenceUsers = await repo.loadAllPresenceUsers();
      allStaffUsers = allPresenceUsers.filter((u) => u.category === "team");

      // Immediately render initial daily table & initial KPIs with loaded users
      dailyAggregatedRows = aggregateDailyRows(todayKey, dailyCategory);
      paginationState.daily.page = 1;
      renderDailyTable();
      updateDailyKpis(dailyAggregatedRows, todayKey, dailyCategory);
    } catch (uErr) {
      console.error("Gagal memuat presence users:", uErr);
    }

    // 2. Realtime daily attendance
    try {
      setupDailyAttendanceSubscription(todayKey);
    } catch (dErr) {
      console.error("Gagal subscribe daily presensi:", dErr);
    }

    // 3. Monthly recap
    try {
      await loadMonthlyRecapData(todayMonth, monthlyCategory);
    } catch (mErr) {
      console.error("Gagal memuat rekap bulanan:", mErr);
    }

    // 4. Realtime total hours and gamification
    try {
      setupTotalHoursSubscription();
    } catch (tErr) {
      console.error("Gagal setup total hours presensi:", tErr);
    }

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
