// assets/js/components/topbar/topbar.repository.js
// =====================================================================
// TOPBAR DATA ACCESS — the ONLY topbar module that talks to Firebase.
//
// Responsibilities:
//  - Read the current user's Firestore document (users/{uid}).
//  - Resolve a position id into a readable position name.
//
// RULES:
//  - NO DOM manipulation, NO rendering, NO toast/modal here.
//  - Uses the single Firebase init from assets/js/firebase-config.js.
//  - Returns plain data; the orchestrator decides what to render.
//  - Data here is shared shell data ONLY (profile identity shown in the
//    topbar). Feature data must never be queried from this module.
// =====================================================================

import { db } from "../../firebase-config.js";
import {
  doc,
  getDoc,
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Read the user's Firestore document.
 * @param {string} uid
 * @returns {Promise<Object|null>} user data or null
 */
export async function getUserDoc(uid) {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn("topbar: failed to read users doc:", e);
    return null;
  }
}

/**
 * Resolve a position id string into a readable name.
 * Mirrors legacy resolvePositionName: try positions/position docs, then
 * scan the positions collection.
 * @param {string} rawValue
 * @returns {Promise<string|null>}
 */
export async function resolvePositionName(rawValue) {
  if (
    !rawValue ||
    String(rawValue).trim().length < 10 ||
    String(rawValue).includes(" ")
  ) {
    return null;
  }
  const key = String(rawValue).trim();
  const getName = (d) => d && (d.name || d.title || d.position || d.label);

  for (const coll of ["positions", "position"]) {
    try {
      const snap = await getDoc(doc(db, coll, key));
      if (snap.exists()) {
        const name = getName(snap.data());
        if (name) return name;
      }
    } catch (e) {
      console.warn(`topbar: failed to read ${coll}/${key}:`, e);
    }
  }

  try {
    const listSnap = await getDocs(collection(db, "positions"));
    let matched = null;
    listSnap.forEach((ds) => {
      const d = ds.data() || {};
      if (
        d.id === key ||
        d.position_id === key ||
        d._id === key ||
        ds.id === key
      ) {
        const name = getName(d);
        if (name && !matched) matched = name;
      }
    });
    return matched;
  } catch (e) {
    console.warn("topbar: failed to scan positions:", e);
    return null;
  }
}

/**
 * Build the profile payload shown by the topbar.
 * @param {string} uid current user uid
 * @param {Object} [fallback] fallback from the auth user object
 * @returns {Promise<{name:string,email:string,photo:string,position:string}>}
 */
export async function getTopbarProfile(uid, fallback = {}) {
  const userDoc = await getUserDoc(uid);
  const data = userDoc || {};

  const name = data.name || fallback.name || fallback.email || "User";
  const email = data.email || fallback.email || "";
  const photo = data.photo || fallback.photo || "https://i.pravatar.cc/300";

  let position = data.position || data.employment?.position || fallback.position || "";
  if (position) {
    const resolved = await resolvePositionName(String(position));
    if (resolved) position = resolved;
  }

  return { name, email, photo, position };
}