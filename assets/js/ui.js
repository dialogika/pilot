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

function ensureConfirmStyles() {
  if (document.getElementById("dg-confirm-dialog-styles")) return;
  const style = document.createElement("style");
  style.id = "dg-confirm-dialog-styles";
  style.textContent = `
    .dg-confirm-overlay {
      position: fixed;
      inset: 0;
      z-index: 100000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.25rem;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      font-family: inherit;
    }
    .dg-confirm-overlay.dg-confirm-show {
      opacity: 1;
      visibility: visible;
    }
    .dg-confirm-dialog {
      position: relative;
      width: 100%;
      max-width: 420px;
      background: #ffffff;
      border-radius: 1.25rem;
      border: 1px solid #e2e8f0;
      box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(226, 232, 240, 0.6);
      padding: 1.75rem 1.5rem 1.5rem 1.5rem;
      text-align: center;
      transform: scale(0.92) translateY(10px);
      transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      box-sizing: border-box;
    }
    .dg-confirm-overlay.dg-confirm-show .dg-confirm-dialog {
      transform: scale(1) translateY(0);
    }
    .dg-confirm-icon-wrap {
      width: 58px;
      height: 58px;
      border-radius: 1rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 1.65rem;
      margin-bottom: 1.15rem;
    }
    .dg-confirm-icon-danger {
      background: #fee2e2;
      color: #dc2626;
      box-shadow: 0 8px 16px -4px rgba(220, 38, 38, 0.2);
    }
    .dg-confirm-icon-warning {
      background: #fef3c7;
      color: #d97706;
      box-shadow: 0 8px 16px -4px rgba(217, 119, 6, 0.2);
    }
    .dg-confirm-icon-info {
      background: #e0f2fe;
      color: #0284c7;
      box-shadow: 0 8px 16px -4px rgba(2, 132, 199, 0.2);
    }
    .dg-confirm-title {
      margin: 0 0 0.5rem 0;
      font-size: 1.2rem;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.3;
    }
    .dg-confirm-message {
      margin: 0 0 1.5rem 0;
      font-size: 0.925rem;
      color: #64748b;
      line-height: 1.55;
      word-break: break-word;
    }
    .dg-confirm-actions {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      justify-content: center;
    }
    .dg-confirm-btn {
      flex: 1;
      padding: 0.68rem 1.25rem;
      font-size: 0.9rem;
      font-weight: 600;
      border-radius: 0.75rem;
      cursor: pointer;
      border: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: all 0.15s ease;
      outline: none;
    }
    .dg-confirm-btn:focus-visible {
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.35);
    }
    .dg-confirm-btn-cancel {
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #e2e8f0;
    }
    .dg-confirm-btn-cancel:hover {
      background: #e2e8f0;
      color: #1e293b;
    }
    .dg-confirm-btn-danger {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(220, 38, 38, 0.3);
    }
    .dg-confirm-btn-danger:hover {
      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
      box-shadow: 0 6px 18px rgba(220, 38, 38, 0.4);
      transform: translateY(-1px);
    }
    .dg-confirm-btn-primary {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
    }
    .dg-confirm-btn-primary:hover {
      background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
      box-shadow: 0 6px 18px rgba(37, 99, 235, 0.4);
      transform: translateY(-1px);
    }
  `;
  document.head.appendChild(style);
}

/**
 * Show a confirm modal dialog. Resolves true on confirm, false on cancel.
 * Renders a modern in-page modal dialog without browser alert/confirm popup.
 *
 * @param {string|{title?: string, message?: string, text?: string, confirmText?: string, cancelText?: string, danger?: boolean, icon?: string}} messageOrOpts
 * @param {{title?: string, confirmText?: string, cancelText?: string, danger?: boolean, icon?: string}} [opts]
 * @returns {Promise<boolean>}
 */
export function confirmDialog(messageOrOpts, opts = {}) {
  let title = "Konfirmasi";
  let message = "";
  let confirmText = "";
  let cancelText = "Batal";
  let danger = false;
  let icon = "";

  if (typeof messageOrOpts === "string") {
    message = messageOrOpts;
    if (opts.title) title = opts.title;
    if (opts.confirmText) confirmText = opts.confirmText;
    if (opts.cancelText) cancelText = opts.cancelText;
    if (opts.danger !== undefined) danger = Boolean(opts.danger);
    if (opts.icon) icon = opts.icon;
  } else if (typeof messageOrOpts === "object" && messageOrOpts !== null) {
    title = messageOrOpts.title || title;
    message = messageOrOpts.message || messageOrOpts.text || "";
    confirmText = messageOrOpts.confirmText || "";
    cancelText = messageOrOpts.cancelText || cancelText;
    danger = Boolean(messageOrOpts.danger);
    icon = messageOrOpts.icon || "";
  }

  if (!confirmText) {
    confirmText = danger ? "Ya, Hapus" : "Ya";
  }

  if (!icon) {
    icon = danger ? "bi-trash3-fill" : "bi-exclamation-triangle-fill";
  }

  ensureConfirmStyles();

  return new Promise((resolve) => {
    const existing = document.getElementById("dgConfirmModalOverlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "dgConfirmModalOverlay";
    overlay.className = "dg-confirm-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    const iconClass = danger
      ? "dg-confirm-icon-danger"
      : icon.includes("info")
      ? "dg-confirm-icon-info"
      : "dg-confirm-icon-warning";

    const btnClass = danger ? "dg-confirm-btn-danger" : "dg-confirm-btn-primary";

    // Escape strings for safe HTML rendering
    const safeTitle = String(title).replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeMessage = String(message).replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeConfirmText = String(confirmText).replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeCancelText = String(cancelText).replace(/</g, "&lt;").replace(/>/g, "&gt;");

    overlay.innerHTML = `
      <div class="dg-confirm-dialog">
        <div class="dg-confirm-icon-wrap ${iconClass}">
          <i class="bi ${icon}"></i>
        </div>
        <h4 class="dg-confirm-title">${safeTitle}</h4>
        <p class="dg-confirm-message">${safeMessage}</p>
        <div class="dg-confirm-actions">
          <button type="button" class="dg-confirm-btn dg-confirm-btn-cancel" id="dgConfirmBtnCancel">${safeCancelText}</button>
          <button type="button" class="dg-confirm-btn ${btnClass}" id="dgConfirmBtnOk">${safeConfirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Trigger entrance transition
    requestAnimationFrame(() => {
      overlay.classList.add("dg-confirm-show");
    });

    let isSettled = false;

    function cleanup(result) {
      if (isSettled) return;
      isSettled = true;
      document.removeEventListener("keydown", onKeyDown);
      overlay.classList.remove("dg-confirm-show");
      setTimeout(() => {
        if (overlay && overlay.parentNode) {
          overlay.remove();
        }
        resolve(result);
      }, 180);
    }

    const cancelBtn = overlay.querySelector("#dgConfirmBtnCancel");
    const okBtn = overlay.querySelector("#dgConfirmBtnOk");

    cancelBtn?.addEventListener("click", () => cleanup(false));
    okBtn?.addEventListener("click", () => cleanup(true));

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        cleanup(false);
      }
    });

    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        cleanup(false);
      } else if (e.key === "Enter" && !e.shiftKey) {
        // If focused element is cancelBtn, respect that
        if (document.activeElement === cancelBtn) {
          e.preventDefault();
          cleanup(false);
        } else {
          e.preventDefault();
          cleanup(true);
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);

    // Focus cancel button for safe keyboard navigation
    setTimeout(() => {
      cancelBtn?.focus();
    }, 50);
  });
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