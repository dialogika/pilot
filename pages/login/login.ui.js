// pages/login/login.ui.js
// =====================================================================
// LOGIN PRESENTATION — all DOM interaction for the login page.
//
// RULES:
//  - NO Firestore / Auth / Storage access here.
//  - NO direct Firebase imports.
//  - Only exposes busy/error/success state helpers and redirects for
//    the orchestrator to call.
// =====================================================================

/* ------------------------------------------------------------------ */
/* Login form                                                          */
/* ------------------------------------------------------------------ */

/**
 * Set the login submit button into/out of its busy (spinner) state.
 * @param {boolean} busy
 */
export function setSubmitBusy(busy) {
  const btn = document.getElementById("submitBtn");
  if (!btn) return;
  if (busy) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Memeriksa...`;
  } else {
    btn.disabled = false;
    btn.innerHTML = "Login";
  }
}

/**
 * Show the success label on the submit button ("Login Berhasil!").
 * The button stays disabled while the redirect countdown runs.
 */
export function showLoginSuccess() {
  const btn = document.getElementById("submitBtn");
  if (!btn) return;
  btn.disabled = true;
  btn.innerHTML = "Login Berhasil!";
}

/**
 * Show the main error box with a message.
 * @param {string} message
 */
export function showError(message) {
  const errorMsg = document.getElementById("errorMessage");
  if (!errorMsg) return;
  errorMsg.innerText = message;
  errorMsg.style.display = "block";
}

/**
 * Hide the main error box.
 */
export function hideError() {
  const errorMsg = document.getElementById("errorMessage");
  if (!errorMsg) return;
  errorMsg.style.display = "none";
}

/**
 * Redirect to the app home. Preserved legacy behavior: the browser
 * navigates to the public /home route.
 */
export function redirectToHome() {
  window.location.href = "/home";
}

/* ------------------------------------------------------------------ */
/* Forgot password modal                                               */
/* ------------------------------------------------------------------ */

/**
 * Set the forgot-password submit button into/out of its busy state.
 * @param {boolean} busy
 */
export function setForgotBusy(busy) {
  const btn = document.getElementById("forgotSubmitBtn");
  if (!btn) return;
  if (busy) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Mengirim...`;
  } else {
    btn.disabled = false;
    btn.innerHTML = "Kirim Link Reset";
  }
}

/**
 * Hide both forgot-password feedback boxes.
 */
export function hideForgotMessages() {
  const errBox = document.getElementById("forgotErrorMessage");
  const okBox = document.getElementById("forgotSuccessMessage");
  if (errBox) errBox.style.display = "none";
  if (okBox) okBox.style.display = "none";
}

/**
 * Show an error inside the forgot-password modal.
 * @param {string} message
 */
export function showForgotError(message) {
  const errBox = document.getElementById("forgotErrorMessage");
  if (!errBox) return;
  errBox.style.display = "block";
  errBox.innerText = message;
}

/**
 * Show a success message inside the forgot-password modal and reset
 * its form field.
 * @param {string} message
 */
export function showForgotSuccess(message) {
  const okBox = document.getElementById("forgotSuccessMessage");
  if (okBox) {
    okBox.style.display = "block";
    okBox.innerText = message;
  }
  const form = document.getElementById("forgotPasswordForm");
  if (form) form.reset();
}
