// pages/register/register.js
// =====================================================================
// REGISTRATION ORCHESTRATOR — coordinates repository (data) and UI
// (presentation) for the public registration page.
//
// Flow:
//   initialize() → load positions (repo) → render (ui)
//        ↓
//   form submit → validate → createAuthUser (repo) → uploadPhoto (repo)
//        ↓
//   createPendingUser (repo) → signOutNewUser (repo) → success (ui)
//
// RULES:
//  - No Firebase queries here (use register.repository.js).
//  - No raw DOM rendering of data here (use register.ui.js).
//  - This file decides WHEN things happen and wires repo → ui.
//  - Handles the partial-failure sequence so an Auth account without a
//    pending_users doc is surfaced explicitly (recoverable, documented).
// =====================================================================

import * as repo from "./register.repository.js";
import * as ui from "./register.ui.js";

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

async function initializeRegister() {
  try {
    bindEvents();
    await loadPositionsIntoSelect();
  } catch (error) {
    console.error("Failed to initialize Register page:", error);
  }
}

async function loadPositionsIntoSelect() {
  const select = document.getElementById("inputPos");
  if (!select) return;
  try {
    const positions = await repo.loadPositions();
    if (positions.length === 0) {
      ui.renderPositions(select, positions); // shows "Belum ada posisi"
      return;
    }
    ui.renderPositions(select, positions);
  } catch (error) {
    console.error("Load positions error:", error);
    ui.renderPositionsError(select, positionErrorMessage(error));
  }
}

/* ------------------------------------------------------------------ */
/* Event wiring                                                        */
/* ------------------------------------------------------------------ */

function bindEvents() {
  const form = document.getElementById("regForm");
  if (form) form.addEventListener("submit", handleSubmit);

  const wrapper = document.getElementById("cardWrapper");
  if (wrapper) wrapper.addEventListener("click", () => ui.toggleCardFlip());

  const toggleBtn = document.querySelector(".password-toggle");
  if (toggleBtn) toggleBtn.addEventListener("click", () => ui.togglePasswordVisibility());

  const photoInput = document.getElementById("inputPhoto");
  if (photoInput) {
    photoInput.addEventListener("change", () => {
      const file = photoInput.files && photoInput.files[0];
      if (file) ui.previewPhoto(file);
    });
  }

  bindCardInputs();
}

function bindCardInputs() {
  const name = document.getElementById("inputName");
  const pos = document.getElementById("inputPos");
  const pass = document.getElementById("inputPass");
  const birth = document.getElementById("inputBirth");
  const email = document.getElementById("inputEmail");
  const phone = document.getElementById("inputPhone");
  const ig = document.getElementById("inputIG");
  const linked = document.getElementById("inputLinked");

  const refreshFront = () =>
    ui.updateCardFront({
      name: valueOf(name),
      pos: valueOf(pos),
      pass: valueOf(pass),
      birth: valueOf(birth),
    });
  const refreshBack = () =>
    ui.updateCardBack({
      email: valueOf(email),
      phone: valueOf(phone),
      ig: valueOf(ig),
      linked: valueOf(linked),
    });

  if (name) name.addEventListener("input", refreshFront);
  if (pos) pos.addEventListener("change", refreshFront);
  if (pass) pass.addEventListener("input", refreshFront);
  if (birth) birth.addEventListener("input", refreshFront);
  if (email) email.addEventListener("input", () => { refreshBack(); ui.flipToBack(); });
  if (phone) phone.addEventListener("input", () => { refreshBack(); ui.flipToBack(); });
  if (ig) ig.addEventListener("input", () => { refreshBack(); ui.flipToBack(); });
  if (linked) linked.addEventListener("input", () => { refreshBack(); ui.flipToBack(); });
}

/* ------------------------------------------------------------------ */
/* Registration workflow                                               */
/* ------------------------------------------------------------------ */

async function handleSubmit(event) {
  event.preventDefault();

  const email = valueOf(document.getElementById("inputEmail")).trim();
  const password = valueOf(document.getElementById("inputPass"));
  const file = photoFile();
  const payload = buildPendingPayload(email);

  if (!payload.name || !email || !password) {
    ui.showMessage("Lengkapi data wajib terlebih dahulu.", "error");
    return;
  }

  ui.hideMessage();
  ui.setSubmitBusy(true);

  // Sequence: createAuthUser → uploadPhoto → createPendingUser.
  // A failure AFTER createAuthUser can leave an Auth account with no
  // pending_users doc. We detect and surface that explicitly (recoverable).
  let uid = null;
  try {
    uid = await repo.createAuthUser(email, password);
  } catch (error) {
    console.error("createAuthUser failed:", error);
    ui.showMessage(authCreateErrorMessage(error), "error");
    ui.setSubmitBusy(false);
    return;
  }

  let photoURL = "";
  try {
    photoURL = await repo.uploadProfilePhoto(uid, file);
    payload.photo = photoURL;
  } catch (error) {
    console.error("uploadPhoto failed:", error);
    await partialFailure(uid, "upload photo", error);
    return;
  }

  try {
    await repo.createPendingUser(uid, payload);
  } catch (error) {
    console.error("createPendingUser failed:", error);
    await partialFailure(uid, "create pending profile", error);
    return;
  }

  try {
    await repo.signOutNewUser();
  } catch (error) {
    console.warn("signOut after registration failed (non-fatal):", error);
  }

  ui.setSubmitBusy(false);
  ui.showMessage("Registrasi Berhasil! Akun Anda sedang menunggu persetujuan Admin.", "success");
  setTimeout(() => ui.redirectToLogin(), 2000);
}

/* ------------------------------------------------------------------ */
/* Partial failure handling                                            */
/* ------------------------------------------------------------------ */

/**
 * Handle a failure that occurs after the Auth user was created but before
 * pending_users was fully written. The Auth account already exists, so we
 * tell the user their account was created but the application profile is
 * incomplete, and direct them to retry login (they will see "pending
 * approval" if the pending doc was written, or they can contact admin).
 *
 * We do NOT attempt to delete the Firebase Auth user client-side — that is
 * unsafe and not permitted. This is an explicit, recoverable state.
 * @param {string} uid
 * @param {string} step
 * @param {Error} error
 */
async function partialFailure(uid, step, error) {
  console.error(`Partial registration failure at step "${step}" (uid=${uid}):`, error);
  ui.setSubmitBusy(false);
  ui.showMessage(
    "Pendaftaran akun berhasil, tetapi data profil belum lengkap. " +
      "Silakan hubungi administrator untuk menyelesaikan pendaftaran Anda.",
    "info",
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function buildPendingPayload(email) {
  const department = "";
  return {
    name: valueOf(document.getElementById("inputName")).trim(),
    email: email,
    birth: valueOf(document.getElementById("inputBirth")),
    phone: valueOf(document.getElementById("inputPhone")),
    photo: "",
    employment: {
      position: valueOf(document.getElementById("inputPos")),
      department: department,
      joined_at: new Date(),
    },
    socials: {
      instagram: valueOf(document.getElementById("inputIG")).trim(),
      linkedin: valueOf(document.getElementById("inputLinked")).trim(),
    },
    access: {
      role_id: "staff",
      level_order: 3,
    },
    is_approved: false,
    registered_at: new Date(),
  };
}

function photoFile() {
  const input = document.getElementById("inputPhoto");
  return input && input.files && input.files[0] ? input.files[0] : null;
}

function valueOf(el) {
  return el ? el.value : "";
}

function positionErrorMessage(error) {
  if (error && error.code === "register/permission-denied")
    return "Data posisi tidak dapat diakses. Hubungi administrator.";
  if (error && error.code === "register/network")
    return "Koneksi ke Firebase gagal. Periksa koneksi internet atau konfigurasi Firebase.";
  if (error && error.code === "register/config")
    return "Daftar posisi belum tersedia. Silakan coba lagi nanti atau hubungi administrator.";
  return "Gagal memuat data posisi. Coba lagi.";
}

function authCreateErrorMessage(error) {
  const code = error && error.code ? error.code : "";
  if (code === "auth/email-already-in-use")
    return "Email ini sudah terdaftar. Silakan login atau gunakan email lain.";
  if (code === "auth/invalid-email") return "Format email tidak valid.";
  if (code === "auth/weak-password") return "Password terlalu lemah (minimal 6 karakter).";
  if (code === "auth/network-request-failed" || code === "auth/unavailable")
    return "Koneksi ke Firebase gagal. Periksa koneksi internet atau konfigurasi Firebase.";
  return "Terjadi kesalahan saat mendaftarkan akun. Coba lagi.";
}

// Boot on DOM ready.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeRegister);
} else {
  initializeRegister();
}