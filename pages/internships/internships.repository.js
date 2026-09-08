// pages/internships/internships.repository.js
// =====================================================================
// INTERNSHIPS DATA ACCESS — the ONLY Internships module that talks to
// Firebase.
//
// RULES:
//  - Every Firestore/Auth read & write for Internships lives here.
//  - NO DOM manipulation, NO rendering, NO toast/modal here.
//  - Uses the single Firebase init from assets/js/firebase-config.js.
//  - Returns plain data; the orchestrator decides what to render.
//
// SCOPE: Internship roster directory — users with role Internship / intern
//        (read), add/edit/delete intern, promote to team
//        (team_management + users update). Supporting reads:
//        positions/position, departments/department.
// =====================================================================

import { auth, db } from "../../assets/js/firebase-config.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getMs } from "../../assets/js/utils.js";

export { auth };

const INTERN_ROLES = ["Internship", "internship", "intern", "Intern", "INTERNSHIP", "INTERN"];

/* ------------------------------------------------------------------ */
/* Date & Model Helpers                                               */
/* ------------------------------------------------------------------ */

/**
 * Normalize any date-like value into a Date object (or null).
 * Supports Firestore Timestamps (.toDate(), { seconds }, { _seconds }),
 * JS Date objects, ISO/date strings, and timestamps in milliseconds.
 * @param {any} value
 * @returns {Date|null}
 */
function toDate(value) {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === "function") {
    const d = value.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "object") {
    if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
    if (typeof value._seconds === "number") return new Date(value._seconds * 1000);
  }
  const ms = getMs(value);
  if (ms == null) return null;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Check if a Firestore users document represents an intern across
 * legacy and current role representations.
 * @param {Object} data
 * @returns {boolean}
 */
/**
 * Check if a Firestore users document represents an intern across
 * legacy and current role representations.
 * @param {Object} data
 * @returns {boolean}
 */
function isInternUser(data) {
  if (!data) return false;
  const role = String(data.role || "").toLowerCase().trim();
  const roleId = String(data.role_id || "").toLowerCase().trim();
  const accessRole = String((data.access && (data.access.role_id || data.access.role)) || "").toLowerCase().trim();
  const employmentRole = String((data.employment && (data.employment.role || data.employment.role_id)) || "").toLowerCase().trim();

  // Match if any role field indicates internship/intern
  if (
    role === "internship" ||
    role === "intern" ||
    roleId === "internship" ||
    roleId === "intern" ||
    accessRole === "internship" ||
    accessRole === "intern" ||
    employmentRole === "internship" ||
    employmentRole === "intern"
  ) {
    return true;
  }

  // Match if document contains internship-specific properties
  if (
    Boolean(data.internshipStatus) ||
    Boolean(data.internshipStartDate) ||
    Boolean(data.internshipEndDate) ||
    Boolean(data.internship && (data.internship.startDate || data.internship.endDate)) ||
    Boolean(data.employment && (data.employment.department === "internship" || data.employment.role === "intern"))
  ) {
    return true;
  }

  return false;
}

/* ------------------------------------------------------------------ */
/* Interns (users collection)                                          */
/* ------------------------------------------------------------------ */

/**
 * List all internship users: query-based retrieval matching legacy & 7-role schemas.
 * Returns plain, render-ready rows (no DOM).
 * @returns {Promise<Array>}
 */
export async function listInterns() {
  const docMap = new Map();

  // 1. Primary Strategy: scan full users collection (matches users-management & catches all intern representations)
  try {
    const snapAll = await getDocs(collection(db, "users"));
    snapAll.forEach((ds) => {
      const data = ds.data() || {};
      if (isInternUser(data)) {
        docMap.set(ds.id, ds);
      }
    });
  } catch (e) {
    console.warn("[Repo] Full users scan note:", e.message);
  }

  // 2. Secondary Strategy: legacy query where role in ["Internship", "internship"]
  if (docMap.size === 0) {
    try {
      const qLegacy = query(
        collection(db, "users"),
        where("role", "in", ["Internship", "internship"])
      );
      const snapLegacy = await getDocs(qLegacy);
      snapLegacy.forEach((ds) => docMap.set(ds.id, ds));
    } catch (e) {
      console.warn("[Repo] Legacy role query note:", e.message);
    }
  }

  // 3. Modern 7-Role Query: role in ["intern", "Intern"]
  if (docMap.size === 0) {
    try {
      const qModern = query(
        collection(db, "users"),
        where("role", "in", ["intern", "Intern", "INTERNSHIP", "INTERN"])
      );
      const snapModern = await getDocs(qModern);
      snapModern.forEach((ds) => docMap.set(ds.id, ds));
    } catch (e) {
      console.warn("[Repo] Modern intern query note:", e.message);
    }
  }

  // 4. Role ID Query: role_id in ["intern", "internship"]
  if (docMap.size === 0) {
    try {
      const qRoleId = query(
        collection(db, "users"),
        where("role_id", "in", ["intern", "internship", "Internship", "Intern"])
      );
      const snapRoleId = await getDocs(qRoleId);
      snapRoleId.forEach((ds) => docMap.set(ds.id, ds));
    } catch (e) {
      console.warn("[Repo] role_id query note:", e.message);
    }
  }

  const rows = [];
  docMap.forEach((ds) => {
    try {
      const data = ds.data() || {};
      const employment = data.employment || {};
      const socials = data.socials || {};

      const startDateRaw =
        data.internshipStartDate ||
        (data.internship && data.internship.startDate) ||
        employment.startDate ||
        employment.start_date ||
        data.startDate ||
        data.start_date ||
        null;

      const endDateRaw =
        data.endDate ||
        data.internshipEndDate ||
        (data.internship && data.internship.endDate) ||
        employment.endDate ||
        employment.end_date ||
        data.end_date ||
        null;

      const birthRaw =
        data.birth ||
        data.birthDate ||
        data.dateOfBirth ||
        data.birth_date ||
        null;

      const startDateObj = toDate(startDateRaw);
      const endDateObj = toDate(endDateRaw);
      const birthDateObj = toDate(birthRaw);

      const startDateFormatted = formatDateValue(startDateRaw) || formatDateValue(startDateObj);
      const endDateFormatted = formatDateValue(endDateRaw) || formatDateValue(endDateObj);
      const birthDateFormatted = formatDateValue(birthRaw) || formatDateValue(birthDateObj);

      const rawPositionKey =
        data.position ||
        employment.position ||
        data.positionKey ||
        "";

      const department =
        data.department ||
        employment.department ||
        "";

      const status =
        data.status ||
        data.internshipStatus ||
        "Active";

      const isPromoted =
        data.promotedToTeam === true ||
        data.promotedToTeam === "true" ||
        (data.access && data.access.role_id === "staff") ||
        data.role === "staff";

      rows.push({
        id: ds.id,
        name: data.name || data.fullName || data.username || data.userName || data.email || "",
        status: status,
        positionKey: rawPositionKey,
        department: department,
        mode: data.mode || data.internshipMode || data.workMode || "",
        address: data.address || data.location || data.domicile || "",
        birthDate: birthDateFormatted,
        birthDateObj: birthDateObj,
        campus: data.campus || data.university || data.school || data.institution || "",
        phone: data.phone || data.phoneNumber || data.whatsapp || data.wa || "",
        email: data.email || "",
        instagram: String(socials.instagram || data.instagram || "").trim(),
        linkedin: String(socials.linkedin || data.linkedin || "").trim(),
        avatar: data.photo || data.photoURL || data.avatar || "https://i.pravatar.cc/150?u=" + ds.id,
        startDate: startDateFormatted,
        startDateObj: startDateObj,
        endDate: endDateFormatted,
        endDateObj: endDateObj,
        promotedToTeam: isPromoted,
      });
    } catch (err) {
      console.warn("[Repo] Error normalizing intern row:", ds.id, err);
    }
  });

  return rows;
}

/**
 * Format a Date-like value as "dd Mon yyyy".
 * @param {any} value
 * @returns {string}
 */
function formatDateValue(value) {
  if (!value) return "";
  if (typeof value === "string" && value.includes(" ") && !value.includes("T")) {
    return value;
  }
  const dateObj = toDate(value);
  if (!dateObj) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return String(dateObj.getDate()).padStart(2, "0") + " " + months[dateObj.getMonth()] + " " + dateObj.getFullYear();
}

/**
 * Add a new intern (users doc with synchronized legacy & modern role fields).
 * @param {Object} payload
 */
export async function addIntern(payload) {
  const clean = {
    ...payload,
    role: payload.role || "Internship",
    role_id: payload.role_id || "intern",
    access: {
      role_id: "intern",
      role: "intern",
      ...(payload.access || {}),
    },
    status: payload.status || payload.internshipStatus || "Active",
    internshipStatus: payload.internshipStatus || payload.status || "Active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await addDoc(collection(db, "users"), clean);
}

/**
 * Update an intern document.
 * @param {string} id
 * @param {Object} patch
 */
export async function updateIntern(id, patch) {
  const clean = {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (v !== undefined) clean[k] = v;
  }
  clean.updatedAt = serverTimestamp();
  await updateDoc(doc(db, "users", id), clean);
}

/**
 * Delete an intern.
 * @param {string} id
 */
export async function deleteIntern(id) {
  await deleteDoc(doc(db, "users", id));
}

/* ------------------------------------------------------------------ */
/* Position / department caches                                        */
/* ------------------------------------------------------------------ */

let positionsCache = null;
let departmentsCache = null;

/**
 * Load a map of id -> label from `position` (fallback `positions`).
 * @returns {Promise<Object>}
 */
export async function loadPositionsMap() {
  if (positionsCache && Object.keys(positionsCache).length > 0) {
    return positionsCache;
  }
  const sources = ["position", "positions"];
  const map = {};
  for (const name of sources) {
    try {
      const snap = await getDocs(collection(db, name));
      if (!snap.empty) {
        snap.forEach((ds) => {
          const d = ds.data() || {};
          map[ds.id] = d.name || d.label || d.title || d.position || ds.id;
        });
        positionsCache = map;
        return map;
      }
    } catch (e) {
      console.warn(`[Repo] Could not load '${name}' collection:`, e.message);
    }
  }
  positionsCache = map;
  return map;
}

/**
 * Load a map of id -> label from `department` (fallback `departments`).
 * @returns {Promise<Object>}
 */
export async function loadDepartmentsMap() {
  if (departmentsCache && Object.keys(departmentsCache).length > 0) {
    return departmentsCache;
  }
  const sources = ["department", "departments"];
  const map = {};
  for (const name of sources) {
    try {
      const snap = await getDocs(collection(db, name));
      if (!snap.empty) {
        snap.forEach((ds) => {
          const d = ds.data() || {};
          map[ds.id] = d.name || d.label || d.title || d.department || ds.id;
        });
        departmentsCache = map;
        return map;
      }
    } catch (e) {
      console.warn(`[Repo] Could not load '${name}' collection:`, e.message);
    }
  }
  departmentsCache = map;
  return map;
}

/* ------------------------------------------------------------------ */
/* Promote to team                                                     */
/* ------------------------------------------------------------------ */

/**
 * Check whether an intern already has a team_management record.
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function isPromoted(userId) {
  try {
    const snap = await getDocs(
      query(collection(db, "team_management"), where("userId", "==", userId))
    );
    if (!snap.empty) return true;

    const altSnap = await getDocs(
      query(collection(db, "team_management"), where("internshipId", "==", userId))
    );
    return !altSnap.empty;
  } catch (e) {
    console.warn("[Repo] isPromoted check error:", e.message);
    return false;
  }
}

/**
 * Promote an intern to team: create a team_management record and update
 * the users doc (role_id staff + promotedToTeam + access.role_id staff).
 * @param {Object} user  normalized intern row (id, name, email, phone, ...)
 * @param {string} division
 * @returns {Promise<boolean>} false if the intern is already promoted
 */
export async function promoteToTeam(user, division) {
  if (await isPromoted(user.id)) return false;

  const teamData = {
    name: user.name || "",
    email: user.email || "",
    whatsapp: user.phone || "",
    instagram: user.instagram || "",
    linkedin: user.linkedin || "",
    address: user.address || "",
    birthDate: formatISODate(user.birthDateObj),
    division: division,
    originalDivision: division,
    status: "Active",
    startDate: formatISODate(user.startDateObj),
    endDate: "",
    bank: "",
    accountNumber: "",
    fee: "",
    pkwtFileName: "",
    pkwtFileUrl: "",
    source: "internship",
    internshipId: user.id,
    userId: user.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await addDoc(collection(db, "team_management"), teamData);

  await updateDoc(doc(db, "users", user.id), {
    role: "staff",
    role_id: "staff",
    "access.role_id": "staff",
    promotedToTeam: true,
    promotedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return true;
}

/**
 * Format a Date as YYYY-MM-DD (or "" when invalid).
 * @param {Date|null} value
 * @returns {string}
 */
function formatISODate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "";
  return value.toISOString().split("T")[0];
}