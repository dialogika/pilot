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

/**
 * Show a custom verification / confirmation modal.
 * Returns a Promise that resolves to true if confirmed, false if canceled.
 * @param {string} message
 * @param {{title?: string, confirmText?: string, cancelText?: string, danger?: boolean, icon?: string}} [opts]
 * @returns {Promise<boolean>}
 */
export function confirmDialog(message, opts = {}) {
  return new Promise((resolve) => {
    const {
      title = "Konfirmasi Tindakan",
      confirmText = "Ya, Lanjutkan",
      cancelText = "Batal",
      danger = true,
      icon = danger ? "bi-trash3" : "bi-question-circle"
    } = opts;

    const existing = document.getElementById("dg-custom-confirm-modal");
    if (existing) existing.remove();

    const backdrop = document.createElement("div");
    backdrop.id = "dg-custom-confirm-modal";
    backdrop.className =
      "fixed inset-0 w-screen h-screen z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-200 opacity-0";

    const modalBox = document.createElement("div");
    modalBox.className =
      "bg-white rounded-[24px] shadow-2xl w-full max-w-sm overflow-hidden p-6 text-center transform scale-95 transition-all duration-200";

    const iconColor = danger ? "bg-rose-50 text-rose-600" : "bg-indigo-50 text-indigo-600";
    const btnColor = danger
      ? "bg-rose-600 hover:bg-rose-700 text-white"
      : "bg-indigo-600 hover:bg-indigo-700 text-white";

    modalBox.innerHTML = `
      <div class="mb-4 flex justify-center">
        <div class="w-16 h-16 rounded-2xl ${iconColor} flex items-center justify-center text-2xl shadow-sm">
          <i class="bi ${icon} text-2xl"></i>
        </div>
      </div>
      <h4 class="font-extrabold text-slate-800 text-lg mb-2">${title}</h4>
      <p class="text-sm text-slate-500 mb-6 leading-relaxed">${message}</p>
      <div class="flex gap-3 justify-center">
        <button type="button" id="dg-confirm-cancel-btn" class="flex-1 px-4 py-2.5 rounded-xl font-bold text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 transition">
          ${cancelText}
        </button>
        <button type="button" id="dg-confirm-submit-btn" class="flex-1 px-4 py-2.5 rounded-xl font-bold text-xs ${btnColor} transition shadow-sm">
          ${confirmText}
        </button>
      </div>
    `;

    backdrop.appendChild(modalBox);
    document.body.appendChild(backdrop);

    requestAnimationFrame(() => {
      backdrop.classList.remove("opacity-0");
      modalBox.classList.remove("scale-95");
      modalBox.classList.add("scale-100");
    });

    const cleanup = (result) => {
      backdrop.classList.add("opacity-0");
      modalBox.classList.remove("scale-100");
      modalBox.classList.add("scale-95");
      setTimeout(() => {
        backdrop.remove();
        resolve(result);
      }, 200);
    };

    const cancelBtn = document.getElementById("dg-confirm-cancel-btn");
    const submitBtn = document.getElementById("dg-confirm-submit-btn");

    if (cancelBtn) cancelBtn.onclick = () => cleanup(false);
    if (submitBtn) submitBtn.onclick = () => cleanup(true);
    backdrop.onclick = (e) => {
      if (e.target === backdrop) cleanup(false);
    };
  });
}

/**
 * Show a custom alert / notification modal.
 * Returns a Promise that resolves when the user closes the modal.
 * @param {string} message
 * @param {{title?: string, buttonText?: string, type?: "success"|"danger"|"error"|"warning"|"info"}} [opts]
 * @returns {Promise<void>}
 */
export function alertDialog(message, opts = {}) {
  return new Promise((resolve) => {
    const {
      title = "Pemberitahuan",
      buttonText = "Mengerti",
      type = "info"
    } = opts;

    const existing = document.getElementById("dg-custom-alert-modal");
    if (existing) existing.remove();

    const backdrop = document.createElement("div");
    backdrop.id = "dg-custom-alert-modal";
    backdrop.className =
      "fixed inset-0 w-screen h-screen z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-200 opacity-0";

    const modalBox = document.createElement("div");
    modalBox.className =
      "bg-white rounded-[24px] shadow-2xl w-full max-w-sm overflow-hidden p-6 text-center transform scale-95 transition-all duration-200";

    let iconHtml = '<i class="bi bi-info-circle text-2xl"></i>';
    let iconColor = "bg-sky-50 text-sky-600";
    let btnColor = "bg-indigo-600 hover:bg-indigo-700 text-white";

    if (type === "success") {
      iconHtml = '<i class="bi bi-check-circle text-2xl"></i>';
      iconColor = "bg-emerald-50 text-emerald-600";
      btnColor = "bg-emerald-600 hover:bg-emerald-700 text-white";
    } else if (type === "danger" || type === "error") {
      iconHtml = '<i class="bi bi-exclamation-triangle text-2xl"></i>';
      iconColor = "bg-rose-50 text-rose-600";
      btnColor = "bg-rose-600 hover:bg-rose-700 text-white";
    } else if (type === "warning") {
      iconHtml = '<i class="bi bi-exclamation-circle text-2xl"></i>';
      iconColor = "bg-amber-50 text-amber-600";
      btnColor = "bg-amber-600 hover:bg-amber-700 text-white";
    }

    modalBox.innerHTML = `
      <div class="mb-4 flex justify-center">
        <div class="w-16 h-16 rounded-2xl ${iconColor} flex items-center justify-center text-2xl shadow-sm">
          ${iconHtml}
        </div>
      </div>
      <h4 class="font-extrabold text-slate-800 text-lg mb-2">${title}</h4>
      <p class="text-sm text-slate-500 mb-6 leading-relaxed">${message}</p>
      <button type="button" id="dg-alert-submit-btn" class="w-full px-4 py-2.5 rounded-xl font-bold text-xs ${btnColor} transition shadow-sm">
        ${buttonText}
      </button>
    `;

    backdrop.appendChild(modalBox);
    document.body.appendChild(backdrop);

    requestAnimationFrame(() => {
      backdrop.classList.remove("opacity-0");
      modalBox.classList.remove("scale-95");
      modalBox.classList.add("scale-100");
    });

    const cleanup = () => {
      backdrop.classList.add("opacity-0");
      modalBox.classList.remove("scale-100");
      modalBox.classList.add("scale-95");
      setTimeout(() => {
        backdrop.remove();
        resolve();
      }, 200);
    };

    const submitBtn = document.getElementById("dg-alert-submit-btn");
    if (submitBtn) submitBtn.onclick = () => cleanup();
    backdrop.onclick = (e) => {
      if (e.target === backdrop) cleanup();
    };
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