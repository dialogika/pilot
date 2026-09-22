// assets/js/ui.js
// =====================================================================
// SHARED UI HELPERS — generic feedback & custom Dialogika modal behavior.
//
// RULES:
//  - Only generic, reusable UI behavior goes here (toast, confirm,
//    loading, modal helpers).
//  - Do NOT add feature-specific rendering or feature queries.
//  - Pure custom Dialogika modal rendering with ZERO native browser
//    alert/confirm popups.
//
// Usage:
//   import { toast, confirmDialog, alertDialog, showLoading, hideLoading, showModal, hideModal } from "/assets/js/ui.js";
// =====================================================================

/**
 * Show a brief toast/notification.
 * @param {string} message
 * @param {"success"|"error"|"danger"|"warning"|"info"} [type="info"]
 */
export function toast(message, type = "info") {
  if (window.Swal) {
    const iconMap = { success: "success", error: "error", danger: "error", warning: "warning", info: "info" };
    window.Swal.fire({
      icon: iconMap[type] || "info",
      title: message,
      toast: true,
      position: "top-end",
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    });
    return;
  }

  // Pure custom floating toast if Swal is absent
  let toastContainer = document.getElementById("dg-toast-container");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "dg-toast-container";
    toastContainer.className = "fixed top-5 right-5 z-[999999] flex flex-col gap-2 pointer-events-none";
    document.body.appendChild(toastContainer);
  }

  const toastItem = document.createElement("div");
  const isErr = type === "error" || type === "danger";
  const isSuccess = type === "success";
  const bgClass = isErr ? "bg-rose-600 text-white" : isSuccess ? "bg-emerald-600 text-white" : "bg-slate-900 text-white";
  
  toastItem.className = `${bgClass} px-4 py-3 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 transition-all duration-300 transform translate-y-[-10px] opacity-0 pointer-events-auto`;
  toastItem.innerHTML = `
    <i class="bi ${isErr ? 'bi-exclamation-circle' : isSuccess ? 'bi-check-circle' : 'bi-info-circle'} text-sm"></i>
    <span>${message}</span>
  `;

  toastContainer.appendChild(toastItem);
  requestAnimationFrame(() => {
    toastItem.classList.remove("translate-y-[-10px]", "opacity-0");
  });

  setTimeout(() => {
    toastItem.classList.add("opacity-0", "translate-y-[-10px]");
    setTimeout(() => toastItem.remove(), 300);
  }, 3500);
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
      background: var(--surface, #ffffff);
      border-radius: 1.25rem;
      border: 1px solid var(--border, #e2e8f0);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px var(--border, rgba(226, 232, 240, 0.6));
      padding: 1.75rem 1.5rem 1.5rem 1.5rem;
      text-align: center;
      transform: scale(0.92) translateY(10px);
      transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      box-sizing: border-box;
      color: var(--text, #1e293b);
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
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      box-shadow: 0 8px 16px -4px rgba(220, 38, 38, 0.2);
    }
    .dg-confirm-icon-warning {
      background: rgba(245, 158, 11, 0.15);
      color: #f59e0b;
      box-shadow: 0 8px 16px -4px rgba(217, 119, 6, 0.2);
    }
    .dg-confirm-icon-info {
      background: rgba(59, 130, 246, 0.15);
      color: #3b82f6;
      box-shadow: 0 8px 16px -4px rgba(2, 132, 199, 0.2);
    }
    .dg-confirm-icon-success {
      background: rgba(34, 197, 94, 0.15);
      color: #22c55e;
      box-shadow: 0 8px 16px -4px rgba(22, 163, 74, 0.2);
    }
    .dg-confirm-title {
      margin: 0 0 0.5rem 0;
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--text-strong, #0f172a);
      line-height: 1.3;
    }
    .dg-confirm-message {
      margin: 0 0 1.5rem 0;
      font-size: 0.925rem;
      color: var(--text-muted, #64748b);
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
      background: var(--surface-2, #f1f5f9);
      color: var(--text, #475569);
      border: 1px solid var(--border, #e2e8f0);
    }
    .dg-confirm-btn-cancel:hover {
      background: var(--surface-hover, #e2e8f0);
      color: var(--text-strong, #1e293b);
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
    .dg-confirm-btn-success {
      background: linear-gradient(135deg, #009d74 0%, #008763 100%);
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(0, 157, 116, 0.3);
    }
    .dg-confirm-btn-success:hover {
      background: linear-gradient(135deg, #008763 0%, #007052 100%);
      box-shadow: 0 6px 18px rgba(0, 157, 116, 0.4);
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
 * Show a custom alert / notification modal.
 * Returns a Promise that resolves when the user closes the modal.
 * @param {string|{title?: string, message?: string, text?: string, buttonText?: string, type?: "success"|"danger"|"error"|"warning"|"info"}} messageOrOpts
 * @param {{title?: string, buttonText?: string, type?: "success"|"danger"|"error"|"warning"|"info"}} [opts]
 * @returns {Promise<void>}
 */
export function alertDialog(messageOrOpts, opts = {}) {
  let title = "Pemberitahuan";
  let message = "";
  let buttonText = "Mengerti";
  let type = "info";

  if (typeof messageOrOpts === "string") {
    message = messageOrOpts;
    if (opts.title) title = opts.title;
    if (opts.buttonText) buttonText = opts.buttonText;
    if (opts.type) type = opts.type;
  } else if (typeof messageOrOpts === "object" && messageOrOpts !== null) {
    title = messageOrOpts.title || title;
    message = messageOrOpts.message || messageOrOpts.text || "";
    buttonText = messageOrOpts.buttonText || buttonText;
    type = messageOrOpts.type || type;
  }

  ensureConfirmStyles();

  return new Promise((resolve) => {
    const existing = document.getElementById("dg-custom-alert-modal");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "dg-custom-alert-modal";
    overlay.className = "dg-confirm-overlay";

    let iconHtml = '<i class="bi bi-info-circle"></i>';
    let iconClass = "dg-confirm-icon-info";
    let btnClass = "dg-confirm-btn-primary";

    if (type === "success") {
      iconHtml = '<i class="bi bi-check-circle"></i>';
      iconClass = "dg-confirm-icon-success";
      btnClass = "dg-confirm-btn-success";
    } else if (type === "danger" || type === "error") {
      iconHtml = '<i class="bi bi-exclamation-triangle"></i>';
      iconClass = "dg-confirm-icon-danger";
      btnClass = "dg-confirm-btn-danger";
    } else if (type === "warning") {
      iconHtml = '<i class="bi bi-exclamation-circle"></i>';
      iconClass = "dg-confirm-icon-warning";
      btnClass = "dg-confirm-btn-primary";
    }

    const safeTitle = String(title).replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeMessage = String(message).replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeButtonText = String(buttonText).replace(/</g, "&lt;").replace(/>/g, "&gt;");

    overlay.innerHTML = `
      <div class="dg-confirm-dialog">
        <div class="dg-confirm-icon-wrap ${iconClass}">
          ${iconHtml}
        </div>
        <h4 class="dg-confirm-title">${safeTitle}</h4>
        <p class="dg-confirm-message">${safeMessage}</p>
        <div class="dg-confirm-actions" style="justify-content: center;">
          <button type="button" class="dg-confirm-btn ${btnClass}" id="dg-alert-submit-btn" style="min-width: 140px;">
            ${safeButtonText}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.classList.add("dg-confirm-show");
    });

    let isSettled = false;
    const cleanup = () => {
      if (isSettled) return;
      isSettled = true;
      document.removeEventListener("keydown", onKeyDown);
      overlay.classList.remove("dg-confirm-show");
      setTimeout(() => {
        if (overlay && overlay.parentNode) {
          overlay.remove();
        }
        resolve();
      }, 200);
    };

    function onKeyDown(e) {
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        cleanup();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    const submitBtn = overlay.querySelector("#dg-alert-submit-btn");
    if (submitBtn) submitBtn.onclick = () => cleanup();
    overlay.onclick = (e) => {
      if (e.target === overlay) cleanup();
    };

    setTimeout(() => {
      submitBtn?.focus();
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