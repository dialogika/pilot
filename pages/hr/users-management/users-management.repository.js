// pages/hr/users-management/users-management.repository.js
// =====================================================================
// USERS MANAGEMENT DATA ACCESS — the ONLY module that talks to
// Firebase for the Users Management feature.
//
// Role model:
//   Firebase Auth Custom Claims → claims.role = source of truth
//   users/{uid}.role = synchronized application data
//
// Valid internal roles (from auth-guard.js):
//   owner | admin | team | staff | intern | mentor | member
// =====================================================================

import { auth, db, functions } from "../../../assets/js/firebase-config.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getMs } from "../../../assets/js/utils.js";

export { auth };

// Current internal roles — same source as auth-guard.js
export const VALID_ROLES = ["owner", "admin", "team", "staff", "intern", "mentor", "member"];

/* ------------------------------------------------------------------ */
/* Positions cache                                                     */
/* ------------------------------------------------------------------ */

let positionsCache = null;

/**
 * Load and cache a map of position id -> label from "positions" (fallback "position").
 * Returns empty map on permission error.
 */
export async function loadPositionsMap() {
  if (positionsCache) return positionsCache;
  const sources = ["positions", "position"];
  for (const name of sources) {
    try {
      const snap = await getDocs(collection(db, name));
      if (!snap.empty) {
        const map = {};
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
  positionsCache = {};
  return {};
}

/* ------------------------------------------------------------------ */
/* Users (users collection)                                            */
/* ------------------------------------------------------------------ */

/**
 * Normalize a date-like value into a YYYY-MM-DD string.
 */
function normalizeDate(value) {
  const ms = getMs(value);
  if (ms == null) return "";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + dd;
}

/**
 * List ALL users from the "users" collection.
 * No date filtering — returns every user.
 * Role is read from users/{uid}.role (application/display data).
 * The authoritative authorization role lives in Firebase Auth Custom Claims.
 */
export async function listUsers(positionsMap) {
  const snap = await getDocs(collection(db, "users"));
  const users = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const createdStr = normalizeDate(data.createdAt);

    // Use the role stored in Firestore users doc as display value.
    // Authorization role = Custom Claims (not readable for other users client-side).
    const role = (data.role || "").toLowerCase() || "member";

    const rawPositionKey =
      data.position || (data.employment && data.employment.position) || "";
    let resolvedPosition = rawPositionKey;
    if (rawPositionKey && positionsMap && positionsMap[rawPositionKey]) {
      resolvedPosition = positionsMap[rawPositionKey];
    }

    users.push({
      id: docSnap.id,
      name: data.name || data.email || "Unknown",
      nickname: data.nickname || data.username || data.userName || "",
      email: data.email || "",
      created: createdStr,
      position: resolvedPosition || "",
      role,
      status: data.status || "Active",
      avatar: data.photo || "https://i.pravatar.cc/150?u=" + docSnap.id,
      phone: data.phone || data.phoneNumber || "",
    });
  });
  return users;
}

/**
 * Get a single user by ID.
 */
export async function getUser(userId) {
  const docSnap = await getDoc(doc(db, "users", userId));
  if (!docSnap.exists()) return null;
  const data = docSnap.data() || {};
  return {
    id: docSnap.id,
    name: data.name || "",
    nickname: data.nickname || data.username || data.userName || "",
    email: data.email || "",
    phone: data.phone || data.phoneNumber || "",
    position:
      data.position || (data.employment && data.employment.position) || "",
    role: (data.role || "").toLowerCase() || "member",
    status: data.status || "Active",
    createdAt: data.createdAt || null,
  };
}

/**
 * Add a new user document.
 */
export async function addUser(payload) {
  return addDoc(collection(db, "users"), {
    ...payload,
    createdAt: serverTimestamp(),
  });
}

/**
 * Update a user document (partial update, never overwrites entire doc).
 * NOTE: Changing a user's role here only updates users/{uid}.role.
 * Custom Claims cannot be changed client-side — requires a Cloud Function.
 * For role changes use updateUserRole() which calls the trusted backend.
 */
export async function updateUser(userId, patch) {
  // Defensive: never send undefined keys, never overwrite entire doc
  const clean = {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (v !== undefined) clean[k] = v;
  }
  if (Object.keys(clean).length === 0) return;
  await updateDoc(doc(db, "users", userId), clean);
}

/**
 * Update a user's INTERNAL role via the trusted Cloud Function.
 * This is the ONLY correct way to change authorization role.
 *
 * Backend: callable `setUserRole` (us-central1) — see pages/home/home.repository.js:622.
 * Params (compat): { uid, userId, role } — both uid/userId sent for legacy compat.
 * Valid roles: owner | admin | team | staff | intern | mentor | member (auth-guard.js:23)
 *
 * After the function succeeds it also best-effort syncs Firestore users/{uid}.role
 * and users/{uid}.access.role_id for display parity (mirrors home.repository.js:638).
 *
 * @param {string} uid - Firebase Auth UID == Firestore users/{uid} doc ID
 * @param {string} role - new internal role (lowercase)
 */
export async function updateUserRole(uid, role) {
  const targetUid = String(uid || "").trim();
  const cleanRole = String(role || "").toLowerCase().trim();
  if (!targetUid) throw new Error("Missing target UID");
  if (!VALID_ROLES.includes(cleanRole)) {
    throw new Error(`Invalid role: ${role}. Valid: ${VALID_ROLES.join(", ")}`);
  }
  const { httpsCallable } = await import(
    "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js"
  );
  const call = httpsCallable(functions, "setUserRole");
  let result;
  try {
    // Send both uid and userId for compat with different backend versions (home does this)
    result = await call({ uid: targetUid, userId: targetUid, role: cleanRole });
  } catch (error) {
    // Preserve Firebase Functions error codes for caller
    const msg = error?.message || "Gagal mengubah role pengguna.";
    const err = new Error(msg);
    err.code = error?.code || "";
    err.details = error?.details || null;
    throw err;
  }
  // Best-effort Firestore sync (function may already do this; client sync is display parity)
  try {
    await updateDoc(doc(db, "users", targetUid), {
      role: cleanRole,
      "access.role_id": cleanRole,
    });
  } catch (_) {
    // Non-fatal: Custom Claims already updated by function; Firestore sync will eventually converge
    console.warn("[Repo] post-setUserRole Firestore sync failed (non-fatal)", _);
  }
  return result?.data ?? result;
}

/**
 * Delete a user document.
 */
export async function deleteUser(userId) {
  await deleteDoc(doc(db, "users", userId));
}

/**
 * Update the password for the currently authenticated user only.
 */
export async function updateCurrentUserPassword(newPassword) {
  const { updatePassword } = await import(
    "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"
  );
  if (!auth.currentUser) throw new Error("No authenticated user");
  await updatePassword(auth.currentUser, newPassword);
}
