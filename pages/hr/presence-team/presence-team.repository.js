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

/**
 * Loads all active staff/sub_team users from Firestore.
 * Matches legacy filtering on role_id/role and status.
 * @returns {Promise<Array<{id: string, name: string, photo: string}>>}
 */
export async function loadStaffUsers() {
  const snap = await getDocs(query(collection(db, "users")));
  const users = [];

  snap.forEach((docSnap) => {
    const d = docSnap.data() || {};
    const access = d.access || {};
    const roleCand = [
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
    ].find((v) => v !== undefined && v !== null && v !== "");

    const roleValue = roleCand ? String(roleCand).trim().toLowerCase() : "";
    const statusRaw = d.status;
    const status =
      typeof statusRaw === "string" ? statusRaw.trim().toLowerCase() : statusRaw;

    const isStatusOk =
      status === undefined || status === null || status === "active";
    const isRoleOk = ["staff", "sub_team"].includes(roleValue);

    if (!isStatusOk || !isRoleOk) return;

    users.push({
      id: docSnap.id,
      name: d.name || d.email || "Tanpa Nama",
      photo: d.photo || "",
    });
  });

  users.sort((a, b) => a.name.localeCompare(b.name));
  return users;
}

/**
 * Subscribes to realtime daily attendance for a specific date (YYYY-MM-DD).
 * @param {string} dateKey - Format 'YYYY-MM-DD'
 * @param {function(Array): void} onUpdate - Callback with processed daily records
 * @param {function(Error): void} onError - Error callback
 * @returns {function(): void} Unsubscribe function
 */
export function subscribeDailyAttendance(dateKey, onUpdate, onError) {
  const q = query(
    collection(db, "user_attendance"),
    where("date", "==", dateKey),
  );

  return onSnapshot(
    q,
    (snap) => {
      const rows = [];
      snap.forEach((d) => {
        const v = d.data() || {};
        const source = v.source || "manual";
        if (source !== "manual") return;
        rows.push({
          id: d.id,
          user_id: v.user_id || "",
          name: v.name || "",
          photo: v.photo || "",
          date: v.date || "",
          time: v.time || "",
          type: v.type || "",
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
      user_id: d.user_id || "",
      name: d.name || "",
      photo: d.photo || "",
      date: d.date || "",
      time: d.time || "",
      type: d.type || "",
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
          user_id: v.user_id || "",
          name: v.name || "",
          date: v.date || "",
          time: v.time || "",
          type: v.type || "",
        });
      });
      onUpdate(rows);
    },
    (err) => {
      if (typeof onError === "function") onError(err);
    },
  );
}
