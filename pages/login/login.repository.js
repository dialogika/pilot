// pages/login/login.repository.js
// =====================================================================
// LOGIN DATA ACCESS — the ONLY Login module that talks to Firebase
// (Auth / Firestore).
//
// RULES:
//  - Every Auth/Firestore call for Login lives here.
//  - NO DOM manipulation, NO document.querySelector, NO rendering,
//    NO alert/toast, NO button-state management here.
//  - Uses the SINGLE Firebase init from assets/js/firebase-config.js.
//  - Returns plain data or throws so the orchestrator can map errors
//    to user-facing messages (see mapLoginError in login.js).
//
// NOTE: There is deliberately NO initializeApp() here — the shared
// firebase-config.js is the only place the app is initialized.
// =====================================================================

import { auth, db } from "../../assets/js/firebase-config.js";
import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

/**
 * Subscribe to Firebase Auth session changes.
 * The login page uses this to bounce already-authenticated users
 * (with a cached session) straight to /home.
 *
 * @param {(user: Object|null) => void} callback
 * @returns {() => void} unsubscribe function
 */
export function watchSession(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Sign the current user out of Firebase Auth.
 * Used when a signed-in account turns out to be inactive / pending,
 * and available for future logout needs.
 */
export function signOutCurrentUser() {
  return signOut(auth);
}

/* ------------------------------------------------------------------ */
/* Login flow                                                          */
/* ------------------------------------------------------------------ */

/**
 * Sign in with email + password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>} the signed-in Firebase user
 */
export async function signIn(email, password) {
  const userCredential = await signInWithEmailAndPassword(
    auth,
    email,
    password,
  );
  return userCredential.user;
}

/**
 * Fetch the user profile document (users/{uid}).
 * @param {string} uid
 * @returns {Promise<Object|null>} profile data, or null when missing
 */
export async function getUserProfile(uid) {
  const userDoc = await getDoc(doc(db, "users", uid));
  return userDoc.exists() ? userDoc.data() : null;
}

/**
 * Check whether a pending registration exists (pending_users/{uid}).
 * Used to distinguish "awaiting admin approval" from "no profile".
 * @param {string} uid
 * @returns {Promise<boolean>}
 */
export async function hasPendingUser(uid) {
  const pendingDoc = await getDoc(doc(db, "pending_users", uid));
  return pendingDoc.exists();
}

/**
 * Record the login presence marker (user_presence/{uid}, merge write).
 * Same doc shape as Home's updatePresence — Home's "Who is Online"
 * reads this collection.
 *
 * @param {{uid:string, email:string}} user   Firebase Auth user
 * @param {{name?:string, photo?:string}} profile
 * @returns {Promise<void>}
 */
export async function recordLoginPresence(user, profile) {
  await setDoc(
    doc(db, "user_presence", user.uid),
    {
      user_id: user.uid,
      name: profile.name || user.email,
      photo: profile.photo || "",
      last_active_at: serverTimestamp(),
    },
    { merge: true },
  );
}

/* ------------------------------------------------------------------ */
/* Forgot password                                                     */
/* ------------------------------------------------------------------ */

/**
 * Send a password reset email via Firebase Auth.
 * @param {string} email
 */
export function sendPasswordReset(email) {
  return sendPasswordResetEmail(auth, email);
}
