// pages/register/register.ui.js
// =====================================================================
// REGISTRATION PRESENTATION — renders the card, form feedback, and all
// DOM interactions for the registration page.
//
// RULES:
//  - NO Firestore / Auth / Storage access here.
//  - NO direct Firebase imports.
//  - Only receives already-loaded data (e.g. positions) and exposes
//    pure rendering / state helpers for the orchestrator to call.
// =====================================================================

/**
 * Populate the position <select> with the loaded options.
 * The select element itself lives in index.html; we only render into it.
 * @param {HTMLSelectElement} select
 * @param {Array<{id:string, name:string}>} positions
 */
export function renderPositions(select, positions) {
  select.innerHTML = '<option value="" disabled selected>Pilih Posisi</option>';
  if (!positions || positions.length === 0) {
    select.innerHTML = '<option value="" disabled>Belum ada posisi yang tersedia.</option>';
    return;
  }
  positions.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.name;
    opt.textContent = p.name;
    select.appendChild(opt);
  });
}

/**
 * Show the position dropdown in a failed/empty state with a message.
 * @param {HTMLSelectElement} select
 * @param {string} message
 */
export function renderPositionsError(select, message) {
  select.innerHTML = `<option value="" disabled selected>${escapeText(message)}</option>`;
}

/**
 * Reset the card back to its default placeholder state.
 */
export function resetCard() {
  setText("cardName", "FULL NAME");
  setText("cardPosDisplay", "POSITION");
  setText("cardPassDisplay", "****");
  setText("cardBirthFront", "MM/YY");
  setText("cardIDDisplay", "#### #### #### ####");
  setText("cardEmailBack", "email@example.com");
  setText("cardPhone", "Tel: -");
  setText("cardIG", "IG: -");
  setText("cardLinked", "In: -");
  setPhotoPreview("");
}

/**
 * Update the front of the card from the current form values.
 * @param {Object} v { name, pos, pass, birth }
 */
export function updateCardFront(v) {
  setText("cardName", v.name || "FULL NAME");
  setText("cardPosDisplay", v.pos || "POSITION");
  setText("cardPassDisplay", (v.pass ? "*".repeat(v.pass.length) : "") || "****");

  if (v.birth) {
    const d = new Date(v.birth);
    if (!isNaN(d.getTime())) {
      setText(
        "cardBirthFront",
        `${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`,
      );
      setText(
        "cardIDDisplay",
        `${randomFirstFour()} #### #### ${pad(d.getMonth() + 1)}${pad(d.getDate())}`,
      );
    }
  }
}

/**
 * Update the back of the card from the current form values.
 * @param {Object} v { email, phone, ig, linked }
 */
export function updateCardBack(v) {
  setText("cardEmailBack", v.email || "email@example.com");
  setText("cardPhone", v.phone ? `Tel: ${v.phone}` : "Tel: -");
  setText("cardIG", v.ig ? `IG: ${v.ig}` : "IG: -");
  setText("cardLinked", v.linked ? `In: ${v.linked}` : "In: -");
}

/**
 * Toggle the 3D card flip (front/back).
 */
export function toggleCardFlip() {
  const wrapper = document.getElementById("cardWrapper");
  if (wrapper) wrapper.classList.toggle("flipped");
}

/**
 * Flip the card to the back side.
 */
export function flipToBack() {
  const wrapper = document.getElementById("cardWrapper");
  if (wrapper) wrapper.classList.add("flipped");
}

/**
 * Toggle password visibility (show/hide) and swap the eye icon.
 */
export function togglePasswordVisibility() {
  const passInput = document.getElementById("inputPass");
  const icon = document.querySelector(".password-toggle");
  if (!passInput || !icon) return;
  const isHidden = passInput.type === "password";
  passInput.type = isHidden ? "text" : "password";
  icon.classList.toggle("fa-eye", !isHidden);
  icon.classList.toggle("fa-eye-slash", isHidden);
}

/**
 * Preview the selected profile photo on the card.
 * @param {File} file
 */
export function previewPhoto(file) {
  if (!file) return;
  const uploadText = document.getElementById("uploadText");
  if (uploadText) uploadText.textContent = file.name;
  const reader = new FileReader();
  reader.onload = (e) => setPhotoPreview(e.target.result);
  reader.readAsDataURL(file);
}

/**
 * Set the profile photo preview background ("" clears it).
 * @param {string} url
 */
export function setPhotoPreview(url) {
  const el = document.getElementById("cardPhotoPreview");
  if (el) el.style.backgroundImage = url ? `url(${url})` : "";
}

/**
 * Set the submit button into a busy/loading state.
 * @param {boolean} busy
 * @param {string} [busyLabel]
 */
export function setSubmitBusy(busy, busyLabel = "Processing...") {
  const btn = document.getElementById("btnSubmit");
  if (!btn) return;
  btn.disabled = busy;
  btn.textContent = busy ? busyLabel : "Submit Registration";
}

/**
 * Show a transient user-facing message banner.
 * @param {string} message
 * @param {"success"|"error"|"info"} kind
 */
export function showMessage(message, kind = "error") {
  const box = document.getElementById("registerMessage");
  if (!box) return;
  box.style.display = "block";
  box.className = "register-alert " + (kind === "success" ? "success" : kind === "info" ? "info" : "error");
  box.textContent = message;
}

/**
 * Hide the message banner.
 */
export function hideMessage() {
  const box = document.getElementById("registerMessage");
  if (box) box.style.display = "none";
}

/**
 * Redirect to the login page.
 */
export function redirectToLogin() {
  window.location.href = "/index.html";
}

/* ------------------------------------------------------------------ */
/* Internal helpers                                                    */
/* ------------------------------------------------------------------ */

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function randomFirstFour() {
  return Math.floor(1000 + Math.random() * 9000);
}

function escapeText(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}