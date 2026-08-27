// pages/login/login.js
// =====================================================================
// LOGIN ORCHESTRATOR — coordinates repository (data) and UI
// (presentation) for the public login page.
//
// Flows:
//   initialize()
//     ├─ session watch  → already signed-in (+ cached profile) → /home
//     ├─ login submit   → signIn (repo) → users/{uid} profile (repo)
//     │                    → Active check → cache session (localStorage)
//     │                    → presence marker (repo) → success → /home
//     └─ forgot submit  → sendPasswordReset (repo) → modal feedback
//
// Business rules preserved verbatim from the legacy root index.html:
//   - users/{uid} exists + status !== "Active" → sign out + account_inactive
//   - users/{uid} missing + pending_users/{uid} exists → pending_approval
//   - users/{uid} missing + no pending doc → "Data profil tidak ditemukan"
//   - presence write failure is logged and swallowed (non-fatal)
//
// RULES:
//  - No Firebase calls here (use login.repository.js).
//  - No raw DOM manipulation here (use login.ui.js).
//  - This file decides WHEN things happen and wires repo → ui.
// =====================================================================

import * as repo from "./login.repository.js";
import * as ui from "./login.ui.js";

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

function initializeLogin() {
  bindEvents();
  subscribeSession();
}

/**
 * Already-authenticated visitors with a cached profile are bounced to
 * /home immediately. Condition preserved verbatim from legacy: BOTH a
 * Firebase session AND localStorage "userData" are required.
 */
function subscribeSession() {
  repo.watchSession((user) => {
    if (user && localStorage.getItem("userData")) {
      ui.redirectToHome();
    }
  });
}

/* ------------------------------------------------------------------ */
/* Event wiring                                                        */
/* ------------------------------------------------------------------ */

function bindEvents() {
  const form = document.getElementById("loginForm");
  if (form) form.addEventListener("submit", handleSubmit);

  const forgotForm = document.getElementById("forgotPasswordForm");
  if (forgotForm) forgotForm.addEventListener("submit", handleForgotSubmit);
}

/* ------------------------------------------------------------------ */
/* Login workflow                                                      */
/* ------------------------------------------------------------------ */

async function handleSubmit(event) {
  event.preventDefault();

  // UI State
  ui.hideError();
  ui.setSubmitBusy(true);

  const email = valueOf("email");
  const password = valueOf("password");

  let user = null;
  try {
    // A. Login ke Firebase Auth
    user = await repo.signIn(email, password);

    // B. Ambil Data Profil dari Firestore (Nama, Foto, Posisi, dll)
    const userData = await repo.getUserProfile(user.uid);

    if (userData) {
      // Cek apakah akun aktif
      if (userData.status !== "Active") {
        await repo.signOutCurrentUser(); // Pastikan session dihapus
        throw new Error("account_inactive");
      }

      localStorage.setItem(
        "userData",
        JSON.stringify({
          uid: user.uid,
          name: userData.name,
          photo: userData.photo,
          email: userData.email,
          position: userData.employment.position,
        }),
      );

      try {
        await repo.recordLoginPresence(user, userData);
      } catch (e) {
        console.error("Failed to record login presence", e);
      }

      ui.showLoginSuccess();

      setTimeout(() => {
        ui.redirectToHome();
      }, 800);
    } else {
      const pending = await repo.hasPendingUser(user.uid);
      if (pending) {
        await repo.signOutCurrentUser();
        throw new Error("pending_approval");
      } else {
        throw new Error("Data profil tidak ditemukan di database.");
      }
    }
  } catch (error) {
    console.error("Login Error:", error);
    ui.showError(mapLoginError(error));
    ui.setSubmitBusy(false);
  }
}

// Maps every failure mode to a distinct, user-meaningful message.
// Network / configuration errors are NEVER shown as "account not
// registered" — they get their own "koneksi/config" message.
function mapLoginError(error) {
  const code = error && error.code ? error.code : "";

  // 1. Application-level flow errors (thrown in the try above).
  if (error.message === "pending_approval")
    return "Akun Anda sedang menunggu persetujuan Administrator.";
  if (error.message === "account_inactive")
    return "Akun Anda telah dinonaktifkan. Silakan hubungi Administrator jika ini adalah sebuah kesalahan.";
  if (
    error.message &&
    error.message.indexOf("Data profil tidak ditemukan") === 0
  )
    return "Login berhasil, tetapi profil Anda belum ditemukan di database. Silakan hubungi Administrator.";

  // 2. Network / configuration failures — must NOT be shown as
  //    "account not registered".
  if (
    code === "auth/network-request-failed" ||
    code === "auth/unavailable" ||
    code === "unavailable" ||
    code === "network-request-failed" ||
    code === "internal-error" ||
    code === "auth/internal-error"
  )
    return "Koneksi ke Firebase gagal. Periksa koneksi internet atau konfigurasi Firebase.";
  if (code === "auth/invalid-api-key" || code === "auth/api-key-not-valid")
    return "Konfigurasi Firebase salah. Silakan hubungi Administrator.";

  // 3. Credential errors.
  if (code === "auth/user-not-found") return "Akun tidak terdaftar.";
  if (code === "auth/wrong-password" || code === "auth/invalid-credential")
    return "Email atau Password salah.";
  if (code === "auth/invalid-email") return "Format email tidak valid.";
  if (code === "auth/user-disabled")
    return "Akun Anda telah dinonaktifkan. Silakan hubungi Administrator.";
  if (code === "auth/too-many-requests")
    return "Terlalu banyak percobaan login. Silakan coba lagi beberapa saat kemudian.";

  // 4. Firestore permission-denied (auth succeeded, no data access).
  if (code === "permission-denied" || code === "PERMISSION_DENIED")
    return "Login berhasil, tetapi akun ini belum punya izin akses data di sistem. Hubungi admin untuk diberikan akses.";

  // 5. Fallback.
  return "Email atau Password salah.";
}

/* ------------------------------------------------------------------ */
/* Forgot password workflow                                            */
/* ------------------------------------------------------------------ */

async function handleForgotSubmit(event) {
  event.preventDefault();

  ui.setForgotBusy(true);
  ui.hideForgotMessages();

  const email = valueOf("forgotEmail");

  try {
    await repo.sendPasswordReset(email);
    ui.showForgotSuccess(
      "Tautan reset password telah dikirim ke email Anda. Silakan cek kotak masuk atau folder spam.",
    );
  } catch (error) {
    console.error("Forgot Password Error:", error);
    ui.showForgotError(mapForgotError(error));
  } finally {
    ui.setForgotBusy(false);
  }
}

function mapForgotError(error) {
  const code = error && error.code ? error.code : "";
  if (code === "auth/user-not-found") return "Email tidak terdaftar.";
  if (code === "auth/invalid-email") return "Format email tidak valid.";
  if (code === "auth/missing-email") return "Email wajib diisi.";
  return "Terjadi kesalahan saat mengirim tautan reset.";
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function valueOf(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}

// Boot on DOM ready.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeLogin);
} else {
  initializeLogin();
}
