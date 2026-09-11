// pages/marketing/promo-classes/promo-classes.ui.js
// =====================================================================
// UI LAYER: Promo Classes & Batches
// Handles pure DOM rendering, formatters, and UI component state.
// =====================================================================

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/**
 * Format YYYY-MM-DD to Indonesian date string (e.g. 7 Agustus 2026).
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDateToIndonesian(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  const day = date.getDate();
  const month = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Parse Indonesian date string back to Date object.
 * @param {string} dateStr
 * @returns {Date|null}
 */
export function parseIndonesianDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split(" ").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 3) return null;

  const day = parseInt(parts[0], 10);
  const monthName = parts[1];
  const year = parseInt(parts[2], 10);

  if (!day || !monthName || !year) return null;
  const monthIndex = MONTH_NAMES.indexOf(monthName);
  if (monthIndex === -1) return null;

  return new Date(year, monthIndex, day);
}

/**
 * Format a Date object to YYYY-MM-DD.
 * @param {Date} date
 * @returns {string}
 */
export function formatDateToISO(date) {
  if (!date || !(date instanceof Date)) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parse a duration string like "1 Juni 2026 - 31 Juli 2026" into start/end dates.
 * @param {string} durationStr
 * @returns {{start: Date, end: Date}|null}
 */
export function parseDurationDateRange(durationStr) {
  if (!durationStr || !durationStr.includes("-")) return null;
  const parts = durationStr.split("-").map((s) => s.trim());
  if (parts.length < 2) return null;

  const startDate = parseIndonesianDate(parts[0]);
  const endDate = parseIndonesianDate(parts[1]);
  if (!startDate || !endDate) return null;

  return { start: startDate, end: endDate };
}

/**
 * Normalize text for searching and comparison.
 * @param {any} value
 * @returns {string}
 */
export function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

/**
 * Escape HTML special characters for safe markup insertion.
 * @param {string} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Escape attribute values for onclick/data attributes.
 * @param {string} value
 * @returns {string}
 */
export function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

/**
 * Get timestamp in milliseconds from Firestore Timestamp or number/string.
 * @param {any} timestampValue
 * @param {number} [numericValue]
 * @returns {number}
 */
export function getTimestampMs(timestampValue, numericValue) {
  if (typeof numericValue === "number" && Number.isFinite(numericValue)) {
    return numericValue;
  }
  if (timestampValue && typeof timestampValue.toDate === "function") {
    return timestampValue.toDate().getTime();
  }
  const parsed = new Date(timestampValue || "").getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Format timestamp into Indonesian localized date-time.
 * @param {any} timestampValue
 * @param {number} [numericValue]
 * @returns {string}
 */
export function formatDateTime(timestampValue, numericValue) {
  const ms = getTimestampMs(timestampValue, numericValue);
  if (!ms) return "-";
  return new Date(ms).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Get CSS badge class for class location.
 * @param {string} locationValue
 * @returns {string}
 */
export function getLocationClass(locationValue) {
  const normalized = normalizeText(locationValue);
  if (normalized === "online") return "online";
  if (normalized === "offline") return "offline";
  return "other";
}

/**
 * Render batch selector pills inside the scroller.
 * @param {HTMLElement} container
 * @param {Array<Object>} batchList
 * @param {string|null} activeBatchLabel
 */
export function renderBatchScroller(container, batchList, activeBatchLabel) {
  if (!container) return;

  const countLabel = document.getElementById("batchCountLabel");
  if (countLabel) countLabel.textContent = `${batchList.length} batch`;

  const pills = batchList
    .map((batch) => {
      const isActive = batch.label === activeBatchLabel;
      return `
        <div class="batch-pill ${isActive ? "active" : ""}" data-action="select-batch" data-batch-label="${escapeAttribute(batch.label)}">
          <span class="batch-pill-label">${escapeHtml(batch.label)}</span>
          <span class="batch-pill-count">${batch.count} data</span>
        </div>
      `;
    })
    .join("");

  const addPill = `
    <div class="batch-pill batch-pill-add" data-action="open-new-batch">
      <i class="bi bi-plus-lg"></i> Batch Baru
    </div>
  `;

  container.innerHTML = batchList.length
    ? pills + addPill
    : `<div class="text-muted small py-2">Belum ada batch.</div>` + addPill;
}

/**
 * Render metrics for the active batch.
 * @param {Array<Object>} items
 */
export function renderMetrics(items = []) {
  const total = items.length;
  const online = items.filter(
    (item) => normalizeText(item.location) === "online"
  ).length;
  const withMaps = items.filter((item) =>
    String(item.mapsLink || "").trim()
  ).length;

  const metricTotal = document.getElementById("metricTotal");
  const metricOnline = document.getElementById("metricOnline");
  const metricMaps = document.getElementById("metricMaps");

  if (metricTotal) metricTotal.textContent = String(total);
  if (metricOnline) metricOnline.textContent = String(online);
  if (metricMaps) metricMaps.textContent = String(withMaps);
}

/**
 * Populate Location filter dropdown with distinct locations.
 * @param {HTMLSelectElement} selectEl
 * @param {Array<Object>} items
 */
export function renderLocationFilterOptions(selectEl, items = []) {
  if (!selectEl) return;
  const currentValue = selectEl.value || "all";
  const uniqueLocations = Array.from(
    new Set(
      items
        .map((item) => String(item.location || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  selectEl.innerHTML = '<option value="all">Semua Lokasi</option>';
  uniqueLocations.forEach((item) => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    selectEl.appendChild(option);
  });

  selectEl.value =
    uniqueLocations.includes(currentValue) || currentValue === "all"
      ? currentValue
      : "all";
}

/**
 * Render table rows for promo classes.
 * @param {HTMLTableSectionElement} tableBody
 * @param {Array<Object>} paginatedRows
 * @param {Set<string>} selectedIds
 */
export function renderPromoClassTable(tableBody, paginatedRows = [], selectedIds = new Set()) {
  if (!tableBody) return;

  if (!paginatedRows.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="empty-state">
            <i class="bi bi-inboxes"></i>
            <h6 class="fw-bold mt-3 mb-2">Belum ada promo class di batch ini</h6>
            <p class="mb-0">Coba ubah pencarian, atau tambahkan data promo class baru ke batch ini.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = paginatedRows
    .map((item) => {
      const locationValue = String(item.location || "").trim();
      const locationClass = getLocationClass(locationValue);
      const locationName = item.locationName
        ? escapeHtml(item.locationName)
        : '<span class="text-muted">-</span>';
      const mapsLink = String(item.mapsLink || "").trim();
      const mapsHtml = mapsLink
        ? `<a href="${escapeAttribute(mapsLink)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-primary rounded-pill">
            <i class="bi bi-box-arrow-up-right me-1"></i>Open
           </a>`
        : '<span class="text-muted">-</span>';
      const isChecked = selectedIds.has(item.id);

      return `
        <tr class="${isChecked ? "row-selected" : ""}">
          <td>
            <input type="checkbox" class="row-checkbox" data-id="${escapeAttribute(item.id)}" ${isChecked ? "checked" : ""} />
          </td>
          <td>
            <div class="fw-semibold text-dark">${escapeHtml(item.product || "-")}</div>
          </td>
          <td>
            <span class="location-badge ${locationClass}">
              <i class="bi bi-geo-alt-fill"></i>${escapeHtml(locationValue || "-")}
            </span>
          </td>
          <td>${locationName}</td>
          <td><span class="price-chip normal">${escapeHtml(item.normalPrice || "-")}</span></td>
          <td><span class="price-chip promo">${escapeHtml(item.promoPrice || "-")}</span></td>
          <td>${mapsHtml}</td>
          <td class="text-muted small">${formatDateTime(item.updated_at || item.created_at, item.updated_at_ms || item.created_at_ms)}</td>
          <td class="text-center">
            <div class="d-inline-flex gap-2">
              <button type="button" class="table-action-btn" data-action="edit" data-id="${escapeAttribute(item.id)}" title="Edit">
                <i class="bi bi-pencil-square"></i>
              </button>
              <button type="button" class="table-action-btn danger" data-action="delete" data-id="${escapeAttribute(item.id)}" title="Hapus">
                <i class="bi bi-trash3"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

/**
 * Render pagination controls.
 * @param {HTMLElement} container
 * @param {number} totalItems
 * @param {number} totalPages
 * @param {number} currentPage
 */
export function renderPagination(container, totalItems, totalPages, currentPage) {
  if (!container) return;

  if (totalItems === 0 || totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  const items = [];
  const createItem = (label, page, disabled, active) => {
    const classes = ["page-item"];
    if (disabled) classes.push("disabled");
    if (active) classes.push("active");
    const safePage = Math.max(1, page);
    return `
      <li class="${classes.join(" ")}">
        <button type="button" class="page-link" ${disabled ? "disabled" : ""} data-page="${safePage}">${escapeHtml(label)}</button>
      </li>
    `;
  };

  items.push(createItem("Prev", currentPage - 1, currentPage === 1, false));

  for (let page = 1; page <= totalPages; page += 1) {
    items.push(createItem(String(page), page, false, page === currentPage));
  }

  items.push(createItem("Next", currentPage + 1, currentPage === totalPages, false));

  container.innerHTML = items.join("");
}

/**
 * Update Bulk Action Bar visibility and count.
 * @param {HTMLElement} barEl
 * @param {HTMLElement} countEl
 * @param {number} count
 */
export function updateBulkActionBar(barEl, countEl, count) {
  if (countEl) countEl.textContent = String(count);
  if (barEl) barEl.classList.toggle("active", count > 0);
}

/**
 * Update the state of Select All Checkbox.
 * @param {HTMLInputElement} selectAllCheckbox
 * @param {Array<Object>} visibleRows
 * @param {Set<string>} selectedIds
 */
export function updateSelectAllState(selectAllCheckbox, visibleRows = [], selectedIds = new Set()) {
  if (!selectAllCheckbox) return;
  if (!visibleRows.length) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
    return;
  }
  const selectedOnPage = visibleRows.filter((row) => selectedIds.has(row.id)).length;
  selectAllCheckbox.checked = selectedOnPage === visibleRows.length;
  selectAllCheckbox.indeterminate = selectedOnPage > 0 && selectedOnPage < visibleRows.length;
}

/**
 * Reset Add/Edit Promo Class form.
 * @param {string|null} activeBatchLabel
 */
export function resetForm(activeBatchLabel) {
  const form = document.getElementById("promoClassForm");
  if (form) form.reset();
  const idInput = document.getElementById("promoClassId");
  if (idInput) idInput.value = "";
  const locationInput = document.getElementById("locationInput");
  if (locationInput) locationInput.value = "Online";
  const durationInput = document.getElementById("promoDurationInput");
  if (durationInput) durationInput.value = activeBatchLabel || "";
  const batchLabel = document.getElementById("formBatchLabel");
  if (batchLabel) batchLabel.textContent = activeBatchLabel || "-";
}

/**
 * Populate Edit Promo Class form with existing data.
 * @param {Object} item
 * @param {string|null} activeBatchLabel
 */
export function populateEditForm(item, activeBatchLabel) {
  if (!item) return;
  const idInput = document.getElementById("promoClassId");
  if (idInput) idInput.value = item.id || "";
  const productInput = document.getElementById("productInput");
  if (productInput) productInput.value = item.product || "";
  const locationInput = document.getElementById("locationInput");
  if (locationInput) locationInput.value = item.location || "Online";
  const locationNameInput = document.getElementById("locationNameInput");
  if (locationNameInput) locationNameInput.value = item.locationName || "";
  const mapsLinkInput = document.getElementById("mapsLinkInput");
  if (mapsLinkInput) mapsLinkInput.value = item.mapsLink || "";
  const normalPriceInput = document.getElementById("normalPriceInput");
  if (normalPriceInput) normalPriceInput.value = item.normalPrice || "";
  const promoPriceInput = document.getElementById("promoPriceInput");
  if (promoPriceInput) promoPriceInput.value = item.promoPrice || "";
  const durationInput = document.getElementById("promoDurationInput");
  if (durationInput) durationInput.value = item.promoDuration || activeBatchLabel || "";
  const batchLabel = document.getElementById("formBatchLabel");
  if (batchLabel) batchLabel.textContent = item.promoDuration || activeBatchLabel || "-";
}
