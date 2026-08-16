// pages/register/register.repository.js
// =====================================================================
// REGISTRATION DATA ACCESS — the ONLY Register module that talks to
// Firebase (Auth / Firestore / Storage).
//
// RULES:
//  - Every Auth/Firestore/Storage call for Registration lives here.
//  - NO DOM manipulation, NO document.querySelector, NO rendering,
//    NO alert/toast, NO button-state management here.
//  - Uses the SINGLE Firebase init from assets/js/firebase-config.js.
//  - Returns plain data or throws Error with a stable `code` so the
//    orchestrator/UI can map it to a user-facing message.
//
// NOTE: There is deliberately NO initializeApp() here — the shared
// firebase-config.js is the only place the app is initialized.
// =====================================================================

import { auth, db, storage, functions } from "../../assets/js/firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import {
  collection,
  getDocs,
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

export { auth };

/* ------------------------------------------------------------------ */
/* Position loading                                                    */
/* ------------------------------------------------------------------ */

/**
 * Load the list of position labels via a callable Cloud Function.
 *
 * WHY A FUNCTION: Registration is a PUBLIC page (no login), but Firestore
 * rules on dialogika-co deny unauthenticated reads of `position`/`positions`.
 * The callable function uses the Admin SDK server-side (privileged), so the
 * public page can get real positions WITHOUT weakening Firestore rules or
 * exposing position data to arbitrary anonymous reads.
 *
 * The function reads `position` (primary) and falls back to `positions`,
 * matching the repo convention (data/script.js, internships.repository.js).
 *
 * @returns {Promise<Array<{id:string, name:string}>>}
 * @throws Error with stable code:
 *         'register/network'           network / function unavailable
 *         'register/permission-denied' function denied / server error
 *         'register/config'            function missing / misconfigured
 */
export async function loadPositions() {
  const getPositions = httpsCallable(functions, "getPositions");
  let result;
  try {
    result = await getPositions();
  } catch (e) {
    throw normalizeFunctionError(e);
  }

  // The function returns { positions: [{id, name}] }.
  const data = (result && result.data) || {};
  const list = Array.isArray(data.positions) ? data.positions : [];
  return list
    .map((p) => ({
      id: p && p.id ? String(p.id) : "",
      name: p && p.name ? String(p.name) : "",
    }))
    .filter((p) => p.name);
}

/**
 * Map a callable-function error to a stable, user-meaningful error code.
 * @param {Error} error
 * @returns {Error}
 */
function normalizeFunctionError(error) {
  const code = error && error.code ? error.code : "";

  // Function exists but failed server-side / denied.
  if (
    code === "functions/permission-denied" ||
    code === "functions/aborted" ||
    code === "functions/internal" ||
    code === "permission-denied"
  ) {
    const err = new Error("Position data not readable.");
    err.code = "register/permission-denied";
    return err;
  }

  // Function not found / not deployed.
  if (
    code === "functions/not-found" ||
    code === "functions/unauthenticated" ||
    code === "functions/invalid-argument" ||
    code === "functions/failed-precondition"
  ) {
    const err = new Error("Position loader function unavailable.");
    err.code = "register/config";
    return err;
  }

  // Network / unavailable.
  if (
    code === "functions/unavailable" ||
    code === "unavailable" ||
    code === "functions/network-error" ||
    code === "network-request-failed" ||
    code === "functions/deadline-exceeded"
  ) {
    const err = new Error("Network error while loading positions.");
    err.code = "register/network";
    return err;
  }

  // Default: unknown / config.
  const err = new Error("Failed to load positions.");
  err.code = "register/config";
  return err;
}

/* ------------------------------------------------------------------ */
/* Registration flow                                                   */
/* ------------------------------------------------------------------ */

/**
 * Create a Firebase Auth account with email/password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<string>} the created user's UID
 */
export async function createAuthUser(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  return cred.user.uid;
}

/**
 * Upload the applicant's profile photo to Storage.
 * Returns a stable download URL, or "" if no file was provided.
 * @param {string} uid
 * @param {File|null} file
 * @returns {Promise<string>} photo URL ("" when no file)
 */
export async function uploadProfilePhoto(uid, file) {
  if (!file) return "";
  const storageRef = ref(storage, `users/${uid}/profile_photo`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

/**
 * Persist the pending_users/{uid} document.
 * @param {string} uid
 * @param {Object} payload  normalized registration data
 */
export async function createPendingUser(uid, payload) {
  await setDoc(doc(db, "pending_users", uid), payload);
}

/**
 * Sign out the newly created user after registration completes.
 */
export async function signOutNewUser() {
  await signOut(auth);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Map a Firestore read error to a stable, user-meaningful error code.
 * @param {Error} error
 * @param {string} collectionName
 * @returns {Error}
 */
function normalizeFirestoreError(error, collectionName) {
  const code = error && error.code ? error.code : "";
  if (
    code === "permission-denied" ||
    code === "PERMISSION_DENIED" ||
    (typeof String(error).toLowerCase().includes === "function" &&
      String(error).toLowerCase().includes("permission"))
  ) {
    const err = new Error(`Position data not readable (${collectionName}).`);
    err.code = "register/permission-denied";
    return err;
  }
  if (
    code === "unavailable" ||
    code === "network-request-failed" ||
    code === "resource-exhausted" ||
    code === "UNAVAILABLE" ||
    code === "FAILED_PRECONDITION"
  ) {
    const err = new Error(`Network error while reading ${collectionName}.`);
    err.code = "register/network";
    return err;
  }
  // Default: configuration / unknown read failure.
  const err = new Error(`Failed to read ${collectionName}.`);
  err.code = "register/config";
  return err;
}