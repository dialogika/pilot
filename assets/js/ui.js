// assets/js/ui.js
// =====================================================================
// SHARED UI HELPERS — generic feedback & modal behavior.
//
// RULES:
//  - Only generic, reusable UI behavior goes here (toast, confirm,
//    loading, modal helpers).
//  - Do NOT add feature-specific rendering or feature queries.
//  - Reuses SweetAlert2 (window.Swal) and Bootstrap (window.bootstrap),
//    which are already loaded by the app.
//
// Usage:
//   import { toast, confirmDialog, showLoading, showModal } from "/assets/js/ui.js";
// =====================================================================

/**
 * Show a brief toast/notification.
 * Uses SweetAlert2 Toast if available; falls back to console silently.
 * @param {string} message
 * @param {"success"|"error"|"warning"|"info"} [type="info"]
 */
export function toast(message, type = "info") {
  if (!window.Swal) {
    if (type === "error") console.error(message);
    else console.info(message);
    return;
  }
  const iconMap = { success: "success", error: "error", warning: "warning", info: "info" };
  window.Swal.fire({
    icon: iconMap[type] || "info",
    title: message,
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
  });
}

/**
 * Show a confirm dialog. Resolves true on confirm, false on cancel.
 * @param {string} message
 * @param {{title?: string, confirmText?: string, danger?: boolean}} [opts]
 * @returns {Promise<boolean>}
 */
export async function confirmDialog(message, opts = {}) {
  if (!window.Swal) return window.confirm(message);
  const { title = "Konfirmasi", confirmText = "Ya", danger = false } = opts;
  const result = await window.Swal.fire({
    title,
    text: message,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: "Batal",
    confirmButtonColor: danger ? "#e7181a" : "#0B2B6A",
  });
  return result.isConfirmed;
}

/**
 * Show a modal by element id (Bootstrap). No-op if Bootstrap is missing.
 * @param {string|HTMLElement} el
 */
export function showModal(el) {
  if (!window.bootstrap) return;
  const node = typeof el === "string" ? document.getElementById(el) : el;
  if (!node) return;
  window.bootstrap.Modal.getOrCreateInstance(node).show();
}

/**
 * Hide a modal by element id (Bootstrap). No-op if Bootstrap is missing.
 * @param {string|HTMLElement} el
 */
export function hideModal(el) {
  if (!window.bootstrap) return;
  const node = typeof el === "string" ? document.getElementById(el) : el;
  if (!node) return;
  const modal = window.bootstrap.Modal.getInstance(node);
  if (modal) modal.hide();
}

/**
 * Show a full-screen loading overlay.
 * @param {string} [label]
 */
export function showLoading(label = "Loading...") {
  let overlay = document.getElementById("dg-loading-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "dg-loading-overlay";
    overlay.innerHTML = `
      <div class="dg-loading-box">
        <div class="dg-spinner" aria-hidden="true"></div>
        <div class="dg-loading-label"></div>
      </div>`;
    document.body.appendChild(overlay);
  }
  overlay.querySelector(".dg-loading-label").textContent = label;
  overlay.classList.add("dg-loading-show");
}

/**
 * Hide the loading overlay shown by showLoading().
 */
export function hideLoading() {
  const overlay = document.getElementById("dg-loading-overlay");
  if (overlay) overlay.classList.remove("dg-loading-show");
}

/**
 * Toggle a button's disabled state and label while an async op runs.
 * @param {HTMLElement} btn
 * @param {boolean} busy
 * @param {string} busyLabel
 */
export function setButtonBusy(btn, busy, busyLabel = "Menyimpan...") {
  if (!btn) return;
  if (busy) {
    btn.dataset.originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = busyLabel;
  } else {
    btn.disabled = false;
    btn.innerText = btn.dataset.originalText || btn.innerText;
  }
}