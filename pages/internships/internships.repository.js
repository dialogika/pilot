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
// SCOPE: Internship roster directory — users with role Internship
//        (read), add/edit/delete intern, promote to team
//        (team_management + users update). Supporting reads:
//        position/positions, department/departments.
//        All collection names match the legacy code exactly.
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

const INTERN_ROLES = ["Internship", "internship"];

/* ------------------------------------------------------------------ */
/* Interns (users collection)                                          */
/* ------------------------------------------------------------------ */

/**
 * Normalize any date-like value into a Date object (or null).
 * @param {any} value
 * @returns {Date|null}
 */
function toDate(value) {
  const ms = getMs(value);
  if (ms == null) return null;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * List all internship users: users where role in [Internship, internship].
 * Returns plain, render-ready rows (no DOM).
 * @returns {Promise<Array>}
 */
export async function listInterns() {
  const q = query(collection(db, "users"), where("role", "in", INTERN_ROLES));
  const snap = await getDocs(q);
  const rows = [];
  snap.forEach((ds) => {
    const data = ds.data() || {};
    const employment = data.employment || {};
    const socials = data.socials || {};
    rows.push({
      id: ds.id,
      name: data.name || data.fullName || data.username || data.email || "",
      status: data.status || data.internshipStatus || "",
      positionKey: data.position || employment.position || "",
      department: data.department || employment.department || "",
      mode: data.mode || data.internshipMode || "",
      address: data.address || data.location || "",
      birthDateObj: toDate(data.birth || data.birthDate || data.dateOfBirth),
      campus: data.campus || data.university || "",
      phone: data.phone || data.phoneNumber || "",
      email: data.email || "",
      instagram: String(socials.instagram || "").trim(),
      linkedin: String(socials.linkedin || "").trim(),
      avatar: data.photo || "https://i.pravatar.cc/150?u=" + ds.id,
      startDateObj: toDate(
        data.internshipStartDate ||
          (data.internship && data.internship.startDate) ||
          employment.startDate ||
          employment.start_date,
      ),
      endDateObj: toDate(
        data.endDate ||
          data.internshipEndDate ||
          (data.internship && data.internship.endDate) ||
          employment.endDate ||
          employment.end_date,
      ),
      promotedToTeam: data.promotedToTeam === true || data.promotedToTeam === "true",
    });
  });
  return rows;
}

/**
 * Add a new intern (users doc with role Internship).
 * @param {Object} payload
 */
export async function addIntern(payload) {
  await addDoc(collection(db, "users"), payload);
}

/**
 * Update an intern (partial).
 * @param {string} id
 * @param {Object} patch
 */
export async function updateIntern(id, patch) {
  await updateDoc(doc(db, "users", id), patch);
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

/**
 * Load a map of id -> label from `position` (fallback `positions`).
 * @returns {Promise<Object>}
 */
export async function loadPositionsMap() {
  const map = {};
  let snap = await getDocs(collection(db, "position"));
  if (snap.empty) {
    try {
      snap = await getDocs(collection(db, "positions"));
    } catch (e) {
      console.warn("Fallback positions collection 'positions' not readable", e);
    }
  }
  snap.forEach((ds) => {
    const d = ds.data() || {};
    map[ds.id] = d.name || d.label || d.title || d.position || ds.id;
  });
  return map;
}

/**
 * Load a map of id -> label from `department` (fallback `departments`).
 * @returns {Promise<Object>}
 */
export async function loadDepartmentsMap() {
  const map = {};
  let snap = await getDocs(collection(db, "department"));
  if (snap.empty) {
    try {
      snap = await getDocs(collection(db, "departments"));
    } catch (e) {
      console.warn("Fallback departments collection 'departments' not readable", e);
    }
  }
  snap.forEach((ds) => {
    const d = ds.data() || {};
    map[ds.id] = d.name || d.label || d.title || d.department || ds.id;
  });
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
  const snap = await getDocs(query(collection(db, "team_management"), where("userId", "==", userId)));
  return !snap.empty;
}

/**
 * Promote an intern to team: create a team_management record and update
 * the users doc (role_id staff + promotedToTeam). Mirrors legacy exactly.
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
    role_id: "staff",
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