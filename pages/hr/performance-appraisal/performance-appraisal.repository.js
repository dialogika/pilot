// pages/hr/performance-appraisal/performance-appraisal.repository.js
// =====================================================================
// PERFORMANCE APPRAISAL DATA ACCESS — the ONLY module that talks to
// Firebase for Performance Appraisal.
// =====================================================================

import { db } from "../../../assets/js/firebase-config.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const INTERNS_RESUME_COLLECTION = "interns_resume";

/**
 * Load all interns from interns_resume collection.
 * Returns plain data for rendering.
 * @returns {Promise<Array>}
 */
export async function listInterns() {
  const snap = await getDocs(collection(db, INTERNS_RESUME_COLLECTION));
  const rows = [];
  snap.forEach((ds) => {
    const data = ds.data() || {};
    rows.push({
      id: ds.id,
      name: data.name || data.nama || data.nama_lengkap || "",
      photo: data.photo || data.profile_picture || data.avatar || data.image || data.foto || "",
      division: data.division || data.divisi || data.department || "",
      position: data.position || data.posisi || data.role || data.job_title || "",
      raw: data,
    });
  });
  return rows;
}

/**
 * Get a single intern by ID from interns_resume.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getIntern(id) {
  const docSnap = await getDoc(doc(db, INTERNS_RESUME_COLLECTION, id));
  if (!docSnap.exists()) return null;
  const data = docSnap.data() || {};
  return {
    id: docSnap.id,
    name: data.name || data.nama || data.nama_lengkap || "",
    photo: data.photo || data.profile_picture || data.avatar || data.image || data.foto || "",
    division: data.division || data.divisi || data.department || "",
    position: data.position || data.posisi || data.role || data.job_title || "",
    appraisal: data.appraisal || null,
    raw: data,
  };
}

/**
 * Load position map from `position` (fallback `positions`).
 * Mirrors legacy behavior: never throws — returns partial/empty map on error.
 * @returns {Promise<Object>}
 */
export async function loadPositionsMap() {
  const map = {};
  // Rules only define `positions` (plural) — `position` (singular, used by
  // legacy first) has no rule and denies. Try plural-first, fall back.
  const sources = ["positions", "position"];
  for (const name of sources) {
    try {
      const snap = await getDocs(collection(db, name));
      if (!snap.empty) {
        snap.forEach((ds) => {
          const d = ds.data() || {};
          map[ds.id] = d.name || d.label || d.title || d.position || ds.id;
        });
        return map;
      }
    } catch (e) {
      console.warn(`Position source '${name}' not readable`, e);
    }
  }
  return map;
}

/**
 * Save appraisal data to interns_resume/{id}.appraisal
 * @param {string} id
 * @param {Object} appraisalData
 */
export async function saveAppraisal(id, appraisalData) {
  await setDoc(
    doc(db, INTERNS_RESUME_COLLECTION, id),
    { appraisal: appraisalData },
    { merge: true }
  );
}