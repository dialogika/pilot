// pages/hr/recruitment-dashboard/recruitment-dashboard.repository.js
// =====================================================================
// RECRUITMENT DASHBOARD REPOSITORY — data access layer.
//
// All Firestore reads/writes for the Recruitment Dashboard live here.
// This module MUST NOT touch the DOM.
// =====================================================================

import { db } from "/assets/js/firebase-config.js";
import {
  getDocs,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  doc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ── Section config (with fallbacks for singular/plural collections) ─
export const SECTION_CONFIG = {
  team: {
    label: "Team",
    title: "Team Recruitment",
    screeningCollection: "teams_screening",
    fallbackScreeningCollection: "team_screening",
    memberCollection: "team_management",
    fallbackMemberCollection: "teams",
  },
  mentor: {
    label: "Mentor",
    title: "Mentor Recruitment",
    screeningCollection: "mentors_screening",
    fallbackScreeningCollection: "mentor_screening",
    memberCollection: "mentor",
    fallbackMemberCollection: "mentors",
  },
  internship: {
    label: "Internship",
    title: "Internship Recruitment",
    screeningCollection: "interns_screening",
    fallbackScreeningCollection: "intern_screening",
    memberCollection: "users",
    userRoles: ["Internship", "internship", "intern"],
  },
};

// ── Caches ──────────────────────────────────────────────────────────
let usersMap = null;
let positionsMap = null;

/**
 * Build a map of userId → display name from the `users` collection.
 * Cached after first call.
 */
export async function loadUsersMap() {
  if (usersMap) return usersMap;
  usersMap = {};
  try {
    const snap = await getDocs(collection(db, "users"));
    snap.forEach((ds) => {
      const d = ds.data() || {};
      usersMap[ds.id] =
        (d.full_name || d.displayName || d.name || d.nama || d.email || "")
          .toString()
          .trim() || "User Tidak Ditemukan";
    });
  } catch (e) {
    console.warn("[Repository] Failed to build users map:", e);
  }
  return usersMap;
}

/**
 * Resolve an array of user UIDs to display names.
 */
export function resolveInterviewerNames(uids) {
  if (!uids || !uids.length) return "-";
  const map = usersMap || {};
  return uids
    .map((uid) => {
      if (typeof uid !== "string") return uid?.name || uid?.email || "-";
      return map[uid] || "User Tidak Ditemukan";
    })
    .join(", ");
}

/**
 * Build a map of positionId → position name from the `positions` collection.
 * Falls back to the `position` collection. Cached after first call.
 */
export async function loadPositionsMap() {
  if (positionsMap) return positionsMap;
  positionsMap = {};
  try {
    let snap = await getDocs(collection(db, "positions"));
    if (snap.empty) {
      try {
        snap = await getDocs(collection(db, "position"));
      } catch (e) {
        console.warn("[Repository] position fallback not readable:", e);
      }
    }
    if (!snap.empty) {
      snap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const name = (data.name || data.title || data.position_name || "").toString().trim();
        if (name) positionsMap[docSnap.id] = name;
      });
    }
  } catch (e) {
    console.warn("[Repository] Failed to build positions map:", e);
  }
  return positionsMap;
}

/**
 * Resolve a raw position value (possibly an ID) to a human-readable name.
 */
export function resolvePositionName(rawPosition) {
  if (!rawPosition || rawPosition === "-") return "-";
  if (positionsMap && positionsMap[rawPosition]) return positionsMap[rawPosition];
  return rawPosition;
}

// ── Resilient collection fetch with fallback ────────────────────────

/**
 * Fetch all documents from a Firestore collection with optional fallback collection.
 * Catches errors safely so a permission error on one collection doesn't break the entire dashboard.
 * @param {string} primaryCol
 * @param {string} [fallbackCol]
 * @returns {Promise<Array<{id: string, data: Object}>>}
 */
export async function fetchCollectionWithFallback(primaryCol, fallbackCol) {
  try {
    const snap = await getDocs(collection(db, primaryCol));
    if (!snap.empty) {
      const rows = [];
      snap.forEach((ds) => rows.push({ id: ds.id, data: ds.data() || {} }));
      return rows;
    }
    if (fallbackCol) {
      try {
        const fallbackSnap = await getDocs(collection(db, fallbackCol));
        const rows = [];
        fallbackSnap.forEach((ds) => rows.push({ id: ds.id, data: ds.data() || {} }));
        return rows;
      } catch (fallbackErr) {
        console.warn(`[Repository] Fallback collection ${fallbackCol} error:`, fallbackErr);
      }
    }
    return [];
  } catch (err) {
    console.warn(`[Repository] Error querying ${primaryCol}:`, err);
    if (fallbackCol) {
      try {
        const fallbackSnap = await getDocs(collection(db, fallbackCol));
        const rows = [];
        fallbackSnap.forEach((ds) => rows.push({ id: ds.id, data: ds.data() || {} }));
        return rows;
      } catch (fallbackErr) {
        console.warn(`[Repository] Fallback collection ${fallbackCol} error:`, fallbackErr);
      }
    }
    return [];
  }
}

/**
 * Fetch members for a given section (team / mentor / internship).
 */
export async function fetchSectionMembers(section) {
  const cfg = SECTION_CONFIG[section];
  if (!cfg) return [];

  if (section === "internship") {
    try {
      const snap = await getDocs(
        query(collection(db, "users"), where("role", "in", cfg.userRoles))
      );
      const rows = [];
      snap.forEach((ds) => rows.push({ id: ds.id, data: ds.data() || {} }));
      return rows;
    } catch (e) {
      console.warn("[Repository] Error fetching internship users:", e);
      return [];
    }
  }

  return fetchCollectionWithFallback(cfg.memberCollection, cfg.fallbackMemberCollection);
}

/**
 * Fetch screening candidates for ALL sections safely.
 * Uses individual error isolation so that failure in one collection doesn't block others.
 * @returns {Promise<Object>} keyed by section name, value is array of raw doc items.
 */
export async function fetchAllScreening() {
  const results = {};
  for (const [s, c] of Object.entries(SECTION_CONFIG)) {
    try {
      const rows = await fetchCollectionWithFallback(
        c.screeningCollection,
        c.fallbackScreeningCollection
      );
      results[s] = rows;
    } catch (e) {
      console.warn(`[Repository] Failed to fetch screening for ${s}:`, e);
      results[s] = [];
    }
  }
  return results;
}

// ── Recruitment Notes ───────────────────────────────────────────────

const recruitmentNotesRef = doc(db, "recruitment_dashboard_notes", "default");

/**
 * Load the important notes content from Firestore.
 * @returns {Promise<string>} the notes content, or empty string.
 */
export async function loadRecruitmentNotes() {
  try {
    const snap = await getDoc(recruitmentNotesRef);
    if (!snap.exists()) return "";
    return ((snap.data() || {}).content || "").toString().trim();
  } catch (error) {
    console.warn("[Repository] Failed to load recruitment notes:", error);
    return "";
  }
}

/**
 * Save the important notes content to Firestore.
 */
export async function saveRecruitmentNotes(content, userEmail) {
  await setDoc(
    recruitmentNotesRef,
    {
      content: content || "",
      updated_at: serverTimestamp(),
      updated_by: userEmail || null,
    },
    { merge: true }
  );
}
