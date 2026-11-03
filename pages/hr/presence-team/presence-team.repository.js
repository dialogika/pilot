// pages/hr/presence-team/presence-team.repository.js
// =====================================================================
// PRESENCE TEAM REPOSITORY
// The data access layer for presence-team feature.
// ONLY communicates with Firebase Firestore (users, user_attendance).
// NO DOM manipulation or rendering here.
// =====================================================================

import { db } from "../../../assets/js/firebase-config.js";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  downloadExportFile,
  calcDateRange,
  formatDateIndo,
} from "../../../assets/js/utils/export-helper.js";

/**
 * Checks if a user data object represents an intern.
 * @param {Object} d
 * @returns {boolean}
 */
export function isInternUser(d) {
  if (!d) return false;
  const access = d.access || {};
  const employment = d.employment || {};

  const checkValues = [
    d.role_id,
    access.role_id,
    d.role,
    access.role,
    d.roleId,
    access.roleId,
    d.role_name,
    access.role_name,
    d.roleName,
    access.roleName,
    employment.role,
    employment.role_id,
    d.position,
    access.position,
    employment.position,
    d.department,
    access.department,
    employment.department,
    d.division,
    access.division,
    employment.division,
    d.category,
    d.type,
    d.user_type,
    d.name,
  ]
    .filter((v) => v !== undefined && v !== null && v !== "")
    .map((v) => String(v).trim().toLowerCase());

  if (
    checkValues.some(
      (val) =>
        val === "intern" ||
        val === "internship" ||
        val === "magang" ||
        val.includes("intern") ||
        val.includes("magang"),
    )
  ) {
    return true;
  }

  if (
    Boolean(d.internshipStatus) ||
    Boolean(d.internshipStartDate) ||
    Boolean(d.internshipEndDate) ||
    Boolean(d.internship && (d.internship.startDate || d.internship.endDate)) ||
    Boolean(
      employment &&
        (employment.department === "internship" ||
          employment.role === "intern" ||
          employment.department === "magang"),
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Parses time string HH:mm:ss to total seconds from midnight.
 * @param {string} t
 * @returns {number|null}
 */
export function parseTimeToSeconds(t) {
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

/**
 * Calculates work schedule and lateness for a given date and time string.
 * Selasa - Kamis: 10:00:00 (36000s)
 * Sabtu - Minggu: 09:00:00 (32400s)
 * Senin, Rabu, Jumat: Off-schedule (Non-Jadwal)
 *
 * @param {string} dateKey - 'YYYY-MM-DD'
 * @param {string} loginTimeStr - 'HH:mm:ss'
 * @returns {{
 *   scheduleLabel: string,
 *   isWorkDay: boolean,
 *   isLate: boolean,
 *   lateSeconds: number,
 *   lateMinutesDecimal: number,
 *   lateFormatted: string
 * }}
 */
export function calculateLateness(dateKey, loginTimeStr) {
  if (!dateKey) {
    return {
      scheduleLabel: "-",
      isWorkDay: false,
      isLate: false,
      lateSeconds: 0,
      lateHours: 0,
      lateMinutes: 0,
      lateRemainingSeconds: 0,
      lateHoursDecimal: 0,
      lateMinutesDecimal: 0,
      lateFormatted: "-",
      lateTotalHoursFormatted: "0 Menit",
    };
  }

  // Normalize dateKey if format is DD/MM/YYYY or DD-MM-YYYY
  let normDate = String(dateKey).trim();
  if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(normDate)) {
    const [d, m, y] = normDate.split(/[\/\-]/);
    normDate = `${y}-${m}-${d}`;
  }

  const d = new Date(normDate + "T00:00:00");
  const dow = !isNaN(d.getTime()) ? d.getDay() : -1; // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

  let targetSec = null;
  let scheduleLabel = "-";
  let isWorkDay = false;

  if (dow === 2 || dow === 4) {
    // Selasa, Kamis: clock in 10:00
    targetSec = 10 * 3600;
    scheduleLabel = "10:00";
    isWorkDay = true;
  } else if (dow === 0 || dow === 6) {
    // Minggu, Sabtu: clock in 09:00
    targetSec = 9 * 3600;
    scheduleLabel = "09:00";
    isWorkDay = true;
  } else if (dow === 1 || dow === 3 || dow === 5) {
    // Senin (1), Rabu (3), Jumat (5)
    scheduleLabel = "Off-Day";
    isWorkDay = false;
  }

  if (!loginTimeStr || loginTimeStr === "-") {
    return {
      scheduleLabel,
      isWorkDay,
      isLate: false,
      lateSeconds: 0,
      lateHours: 0,
      lateMinutes: 0,
      lateRemainingSeconds: 0,
      lateHoursDecimal: 0,
      lateMinutesDecimal: 0,
      lateFormatted: "-",
      lateTotalHoursFormatted: "0 Menit",
    };
  }

  const sec = parseTimeToSeconds(loginTimeStr);
  if (sec == null || targetSec == null) {
    return {
      scheduleLabel,
      isWorkDay,
      isLate: false,
      lateSeconds: 0,
      lateHours: 0,
      lateMinutes: 0,
      lateRemainingSeconds: 0,
      lateHoursDecimal: 0,
      lateMinutesDecimal: 0,
      lateFormatted: "-",
      lateTotalHoursFormatted: "0 Menit",
    };
  }

  if (sec > targetSec) {
    const diff = sec - targetSec;
    const hours = Math.floor(diff / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    const secs = diff % 60;

    let lateFormatted = "";
    if (hours > 0) {
      lateFormatted = secs > 0 ? `${hours} Jam ${mins}m ${secs}s` : `${hours} Jam ${mins}m`;
    } else {
      lateFormatted = secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    }

    const lateTotalHoursFormatted =
      hours > 0 ? `${hours} Jam ${mins} Menit` : `${mins} Menit`;
    const lateHoursDecimal = Number((diff / 3600).toFixed(2));
    const lateMinutesDecimal = Number((diff / 60).toFixed(2));

    return {
      scheduleLabel,
      isWorkDay,
      isLate: true,
      lateSeconds: diff,
      lateHours: hours,
      lateMinutes: mins,
      lateRemainingSeconds: secs,
      lateHoursDecimal,
      lateMinutesDecimal,
      lateFormatted,
      lateTotalHoursFormatted,
    };
  }

  return {
    scheduleLabel,
    isWorkDay,
    isLate: false,
    lateSeconds: 0,
    lateHours: 0,
    lateMinutes: 0,
    lateRemainingSeconds: 0,
    lateHoursDecimal: 0,
    lateMinutesDecimal: 0,
    lateFormatted: "Tepat Waktu",
    lateTotalHoursFormatted: "0 Menit",
  };
}

/**
 * Loads all active users classified by category ('team' vs 'intern').
 * @returns {Promise<Array<{id: string, name: string, photo: string, category: 'team'|'intern'}>>}
 */
export async function loadAllPresenceUsers() {
  const snap = await getDocs(query(collection(db, "users")));
  const users = [];

  snap.forEach((docSnap) => {
    const d = docSnap.data() || {};
    const statusRaw = d.status;
    const status =
      typeof statusRaw === "string" ? statusRaw.trim().toLowerCase() : statusRaw;

    const isStatusOk =
      status === undefined || status === null || status === "active";
    if (!isStatusOk) return;

    const category = isInternUser(d) ? "intern" : "team";

    users.push({
      id: docSnap.id,
      name: d.name || d.email || "Tanpa Nama",
      photo: d.photo || "",
      category,
    });
  });

  users.sort((a, b) => a.name.localeCompare(b.name));
  return users;
}

/**
 * Loads all active staff/sub_team users from Firestore.
 * Matches legacy filtering on role_id/role and status.
 * @returns {Promise<Array<{id: string, name: string, photo: string, category: string}>>}
 */
export async function loadStaffUsers() {
  const all = await loadAllPresenceUsers();
  return all.filter((u) => u.category === "team");
}

/**
 * Subscribes to realtime daily attendance for a specific date (YYYY-MM-DD).
 * @param {string} dateKey - Format 'YYYY-MM-DD'
 * @param {function(Array): void} onUpdate - Callback with processed daily records
 * @param {function(Error): void} onError - Error callback
 * @returns {function(): void} Unsubscribe function
 */
export function subscribeDailyAttendance(dateKey, onUpdate, onError) {
  let normDate = String(dateKey || "").trim();
  if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(normDate)) {
    const [d, m, y] = normDate.split(/[\/\-]/);
    normDate = `${y}-${m}-${d}`;
  }

  const q = query(
    collection(db, "user_attendance"),
    where("date", "==", normDate),
  );

  return onSnapshot(
    q,
    (snap) => {
      const rows = [];
      snap.forEach((d) => {
        const v = d.data() || {};
        let timeStr =
          v.time ||
          v.clock_in ||
          v.check_in ||
          v.clock_out ||
          v.check_out ||
          v.logout_time ||
          v.logoutTime ||
          v.checkout ||
          "";
        if (
          !timeStr &&
          v.created_at &&
          typeof v.created_at.toDate === "function"
        ) {
          const dt = v.created_at.toDate();
          const hh = String(dt.getHours()).padStart(2, "0");
          const mm = String(dt.getMinutes()).padStart(2, "0");
          const ss = String(dt.getSeconds()).padStart(2, "0");
          timeStr = `${hh}:${mm}:${ss}`;
        }

        rows.push({
          id: d.id,
          user_id: v.user_id || v.userId || v.uid || "",
          name: v.name || v.userName || "",
          photo: v.photo || "",
          date: v.date || "",
          time: timeStr,
          type: v.type || v.status || "",
          source: v.source || "manual",
          clock_out:
            v.clock_out ||
            v.check_out ||
            v.logout_time ||
            v.logoutTime ||
            v.checkout ||
            "",
          work_duration_seconds: v.work_duration_seconds || null,
        });
      });
      console.log(
        `[PRESENCE-REALTIME] Received ${rows.length} records for ${normDate}:`,
        rows,
      );
      onUpdate(rows);
    },
    (err) => {
      console.error("[PRESENCE-REALTIME] Subscription error:", err);
      if (typeof onError === "function") onError(err);
    },
  );
}

/**
 * Fetches attendance records for a specific month (YYYY-MM).
 * @param {string} startKey - Format 'YYYY-MM-DD'
 * @param {string} endKey - Format 'YYYY-MM-DD'
 * @returns {Promise<Array>}
 */
export async function fetchMonthlyAttendanceRecords(startKey, endKey) {
  const snap = await getDocs(
    query(
      collection(db, "user_attendance"),
      where("date", ">=", startKey),
      where("date", "<=", endKey),
    ),
  );

  const records = [];
  snap.forEach((docSnap) => {
    const d = docSnap.data() || {};
    records.push({
      id: docSnap.id,
      user_id: d.user_id || d.userId || d.uid || "",
      name: d.name || d.userName || "",
      photo: d.photo || "",
      date: d.date || "",
      time: d.time || d.clock_in || d.check_in || "",
      type: d.type || d.status || "",
      clock_out: d.clock_out || d.check_out || d.logout_time || d.logoutTime || d.checkout || "",
    });
  });

  return records;
}

/**
 * Subscribes to realtime full attendance records for total hours & gamification.
 * @param {function(Array): void} onUpdate - Callback with all attendance records
 * @param {function(Error): void} onError - Error callback
 * @returns {function(): void} Unsubscribe function
 */
export function subscribeAllAttendance(onUpdate, onError) {
  return onSnapshot(
    collection(db, "user_attendance"),
    (snap) => {
      const rows = [];
      snap.forEach((d) => {
        const v = d.data() || {};
        rows.push({
          id: d.id,
          user_id: v.user_id || v.userId || v.uid || "",
          name: v.name || v.userName || "",
          photo: v.photo || "",
          date: v.date || "",
          time: v.time || v.clock_in || v.check_in || "",
          type: v.type || v.status || "",
          clock_out: v.clock_out || v.check_out || v.logout_time || v.logoutTime || v.checkout || "",
        });
      });
      onUpdate(rows);
    },
    (err) => {
      if (typeof onError === "function") onError(err);
    },
  );
}

/**
 * Exports presence attendance data based on modal filter parameters.
 * @param {Object} options
 * @param {string} [options.format="xlsx"] - "xlsx" | "csv"
 * @param {string} [options.rangeType="all"] - "all" | "month" | "week"
 * @param {string} [options.category="all"] - "all" | "team" | "intern"
 * @param {string} [options.startDate]
 * @param {string} [options.endDate]
 * @param {string} [options.monthValue]
 * @param {string|number} [options.weekValue]
 * @returns {Promise<{ count: number, filename: string }>}
 */
export async function exportPresenceAttendanceData({
  format = "xlsx",
  rangeType = "all",
  category = "all",
  startDate,
  endDate,
  monthValue,
  weekValue,
}) {
  const { start, end, label: periodLabel } = calcDateRange({
    rangeType,
    startDate,
    endDate,
    monthValue,
    weekValue,
  });

  const allUsers = await loadAllPresenceUsers();
  const usersMap = new Map(allUsers.map((u) => [u.id, u]));

  let qAtt;
  if (start && end) {
    const sStr = start.toISOString().slice(0, 10);
    const eStr = end.toISOString().slice(0, 10);
    qAtt = query(
      collection(db, "user_attendance"),
      where("date", ">=", sStr),
      where("date", "<=", eStr),
    );
  } else {
    qAtt = query(collection(db, "user_attendance"));
  }

  const snap = await getDocs(qAtt);
  const rawRecords = [];
  snap.forEach((docSnap) => {
    const d = docSnap.data() || {};
    rawRecords.push({ id: docSnap.id, ...d });
  });

  // Filter based on selected category (all / team / intern)
  const filteredRecords = rawRecords.filter((r) => {
    if (!r.user_id) return false;
    const userObj = usersMap.get(r.user_id);
    if (!userObj) return false;
    if (category === "team") return userObj.category === "team";
    if (category === "intern") return userObj.category === "intern";
    return true;
  });

  filteredRecords.sort((a, b) =>
    String(b.date || "").localeCompare(String(a.date || "")) ||
    String(a.time || "").localeCompare(String(b.time || "")),
  );

  const dayNamesIndo = [
    "Minggu",
    "Senin",
    "Selasa",
    "Rabu",
    "Kamis",
    "Jumat",
    "Sabtu",
  ];

  const columns = [
    { header: "No", key: "no", width: 8 },
    { header: "Tanggal", key: "date", width: 14 },
    { header: "Hari", key: "day", width: 12 },
    { header: "Kategori", key: "category", width: 12 },
    { header: "Nama", key: "name", width: 26 },
    { header: "Tipe Presensi", key: "type", width: 16 },
    { header: "Waktu (Jam)", key: "time", width: 14 },
    { header: "Jadwal Masuk", key: "schedule", width: 14 },
    { header: "Status Masuk", key: "late_status", width: 18 },
    { header: "Keterlambatan", key: "late_formatted", width: 22 },
    { header: "Total Jam Keterlambatan", key: "late_total_hours", width: 24 },
    { header: "Keterlambatan (Jam Desimal)", key: "late_hours_decimal", width: 26 },
    { header: "Keterlambatan (Menit Desimal)", key: "late_decimal", width: 26 },
    { header: "Sumber", key: "source", width: 12 },
  ];

  const rows = filteredRecords.map((r, idx) => {
    const userObj = usersMap.get(r.user_id) || {};
    const d = r.date ? new Date(r.date + "T00:00:00") : null;
    const dayName =
      d && !isNaN(d.getTime()) ? dayNamesIndo[d.getDay()] : "-";
    const rawType = String(r.type || "").trim().toLowerCase();
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
    const lateness = isLogin ? calculateLateness(r.date, r.time) : null;

    let lateStatus = "-";
    let lateFormatted = "-";
    let lateTotalHours = "-";
    let lateHoursDecimal = 0;
    let lateDecimal = 0;
    let schedule = "-";

    if (isLogin && lateness) {
      schedule = lateness.scheduleLabel;
      if (lateness.isWorkDay) {
        lateStatus = lateness.isLate ? "Terlambat" : "Tepat Waktu";
        lateFormatted = lateness.lateFormatted;
        lateTotalHours = lateness.isLate ? lateness.lateTotalHoursFormatted : "-";
        lateHoursDecimal = lateness.lateHoursDecimal || 0;
        lateDecimal = lateness.lateMinutesDecimal;
      } else {
        lateStatus = "Non-Jadwal";
        lateFormatted = "-";
      }
    }

    return {
      no: idx + 1,
      date: r.date || "-",
      day: dayName,
      category: userObj.category === "intern" ? "Intern" : "Team",
      name: userObj.name || r.name || "-",
      type: isLogin ? "CLOCK IN" : isLogout ? "CLOCK OUT" : (r.type || "-").toUpperCase(),
      time: r.time || "-",
      schedule,
      late_status: lateStatus,
      late_formatted: lateFormatted,
      late_total_hours: lateTotalHours,
      late_hours_decimal: lateHoursDecimal,
      late_decimal: lateDecimal,
      source: r.source || "manual",
    };
  });

  const categoryLabel =
    category === "team" ? "Team" : category === "intern" ? "Intern" : "Semua";
  const filename = `Data_Presensi_${categoryLabel}_${periodLabel}`;
  await downloadExportFile({
    filename,
    sheetName: `Presensi ${categoryLabel}`,
    columns,
    rows,
    format,
  });

  return { count: rows.length, filename };
}

