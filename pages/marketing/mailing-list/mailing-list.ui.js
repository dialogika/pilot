// pages/marketing/mailing-list/mailing-list.ui.js
// =====================================================================
// UI LAYER: Mailing List Presentation
// Handles DOM manipulation, view states, table rendering, toast alerts, and formatting.
// =====================================================================

let toastTimer = null;

/**
 * Formats a Date object into human-readable Indonesian format.
 * @param {Date|null} date
 * @returns {string}
 */
export function formatReadableDate(date) {
    if (!date) return "-";
    try {
        return new Intl.DateTimeFormat("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }).format(date);
    } catch {
        return "-";
    }
}

/**
 * Displays floating toast notification.
 * @param {HTMLElement|null} toastEl
 * @param {string} message
 * @param {"success"|"error"} variant
 */
export function showToast(toastEl, message, variant = "success") {
    if (!toastEl) return;
    toastEl.className = `mail-toast ${variant} show`;
    toastEl.innerHTML = `<i class="bi ${variant === "error" ? "bi-exclamation-circle" : "bi-check-circle"}"></i><span>${message}</span>`;
    
    if (toastTimer) {
        clearTimeout(toastTimer);
    }
    toastTimer = setTimeout(() => {
        toastEl.classList.remove("show");
    }, 2500);
}

/**
 * Legacy copy fallback using textarea element.
 * @param {string} text
 */
function legacyCopyText(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "readonly");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
}

/**
 * Copies text to clipboard and shows toast.
 * @param {HTMLElement|null} toastEl
 * @param {string} text
 * @param {string} successMessage
 */
export async function copyText(toastEl, text, successMessage) {
    if (!text) {
        showToast(toastEl, "Tidak ada email untuk disalin.", "error");
        return;
    }
    try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
            await navigator.clipboard.writeText(text);
        } else {
            legacyCopyText(text);
        }
        showToast(toastEl, successMessage, "success");
    } catch (err) {
        console.error("[MailingListUI] Failed to copy via clipboard API, trying fallback:", err);
        try {
            legacyCopyText(text);
            showToast(toastEl, successMessage, "success");
        } catch (fallbackErr) {
            console.error("[MailingListUI] Fallback copy also failed:", fallbackErr);
            showToast(toastEl, "Gagal menyalin ke clipboard.", "error");
        }
    }
}

/**
 * Updates UI state visibility.
 * @param {Object} elements
 * @param {"loading"|"error"|"empty"|"no-results"|"table"} state
 */
export function setVisibleState(elements, state) {
    const {
        loadingState,
        errorState,
        emptyState,
        noResultsState,
        tableContainer
    } = elements;

    if (loadingState) loadingState.style.display = state === "loading" ? "block" : "none";
    if (errorState) errorState.style.display = state === "error" ? "block" : "none";
    if (emptyState) emptyState.style.display = state === "empty" ? "block" : "none";
    if (noResultsState) noResultsState.style.display = state === "no-results" ? "block" : "none";
    if (tableContainer) tableContainer.style.display = state === "table" ? "block" : "none";
}

/**
 * Sets error message and switches to error state.
 * @param {Object} elements
 * @param {string} message
 */
export function setErrorMessage(elements, message) {
    setVisibleState(elements, "error");
    if (elements.errorText) {
        elements.errorText.textContent = message || "Terjadi kesalahan saat mengambil data dari Firebase.";
    }
}

/**
 * Updates summary counter metrics and action button disabled states.
 * @param {Object} elements
 * @param {Object} params
 */
export function updateSummaryMetrics(elements, { totalCount, filteredItems, selectedEmails }) {
    const {
        totalValue,
        filteredValue,
        selectedValue,
        statusText,
        selectAllCheckbox,
        btnCopySelected,
        btnCopyAll
    } = elements;

    const filteredCount = filteredItems.length;
    const selectedCount = selectedEmails.size;

    if (totalValue) totalValue.textContent = String(totalCount);
    if (filteredValue) filteredValue.textContent = String(filteredCount);
    if (selectedValue) selectedValue.textContent = String(selectedCount);

    if (statusText) {
        statusText.textContent = filteredCount
            ? `Menampilkan ${filteredCount} email dari total ${totalCount} subscriber.`
            : "Tidak ada email yang cocok dengan pencarian.";
    }

    if (selectAllCheckbox) {
        const visibleEmails = filteredItems.map((item) => item.email).filter(Boolean);
        const allVisibleSelected = visibleEmails.length > 0 && visibleEmails.every((email) => selectedEmails.has(email));
        const someVisibleSelected = visibleEmails.some((email) => selectedEmails.has(email));

        selectAllCheckbox.checked = allVisibleSelected;
        selectAllCheckbox.indeterminate = !allVisibleSelected && someVisibleSelected;
        selectAllCheckbox.disabled = filteredCount === 0;
    }

    if (btnCopySelected) {
        btnCopySelected.disabled = selectedCount === 0;
    }
    if (btnCopyAll) {
        btnCopyAll.disabled = totalCount === 0;
    }
}

/**
 * Renders table body with subscriber rows.
 * @param {Object} elements
 * @param {Object} params
 */
export function renderTableRows(elements, { items, selectedEmails, onToggleSelect, onRowClick }) {
    const { tableBody } = elements;
    if (!tableBody) return;

    tableBody.innerHTML = "";

    items.forEach((item) => {
        const tr = document.createElement("tr");
        const checked = selectedEmails.has(item.email);

        tr.innerHTML = `
            <td class="text-center">
                <input type="checkbox" class="mail-checkbox mailing-row-checkbox" ${checked ? "checked" : ""} aria-label="Pilih ${item.email}">
            </td>
            <td>
                <div class="mail-email">${item.email || "-"}</div>
            </td>
            <td>
                <div class="text-sm fw-semibold text-slate-700">${formatReadableDate(item.createdAt)}</div>
            </td>
        `;

        const checkbox = tr.querySelector(".mailing-row-checkbox");
        if (checkbox) {
            checkbox.addEventListener("click", (event) => {
                event.stopPropagation();
            });
            checkbox.addEventListener("change", () => {
                if (typeof onToggleSelect === "function") {
                    onToggleSelect(item.email, checkbox.checked);
                }
            });
        }

        tr.addEventListener("click", () => {
            if (typeof onRowClick === "function") {
                onRowClick(item.email);
            }
        });

        tableBody.appendChild(tr);
    });
}
