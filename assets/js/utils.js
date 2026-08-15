// assets/js/utils.js
// =====================================================================
// SHARED UTILITIES — genuinely reusable, framework-agnostic helpers.
//
// RULES:
//  - Only put code here that is used by MORE THAN ONE feature.
//  - Do NOT put feature-specific logic here (e.g. quest helpers,
//    project helpers). Those belong inside their feature folder.
//  - Do NOT turn this into a dumping ground. If a function is used by
//    only one feature, leave it inside that feature.
//
// Usage:
//   import { escapeHtml, formatDateID, debounce } from "/assets/js/utils.js";
// =====================================================================

/**
 * Convert any date-like value to epoch milliseconds (number) or null.
 * Supports number, numeric string, ISO string, Date, and Firestore Timestamp.
 * @param {any} value
 * @returns {number|null}
 */
export function getMs(value) {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const num = Number(value);
    if (!Number.isNaN(num)) return num;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (typeof value.toDate === "function") {
    const d = value.toDate();
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  return null;
}

/**
 * Format a Date as an Indonesian-style, human readable string.
 * @param {Date} date
 * @returns {string}
 */
export function formatDateID(date) {
  const days = [
    "Minggu", "Senin", "Selasa", "Rabu",
    "Kamis", "Jumat", "Sabtu",
  ];
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const dayName = days[date.getDay()];
  const d = date.getDate();
  const m = months[date.getMonth()];
  const y = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${dayName}, ${d} ${m} ${y} • ${hh}:${mm}`;
}

/**
 * Add a number of months to a date-like value.
 * @param {Date|string|number} dateValue
 * @param {number} months
 * @returns {Date}
 */
export function addMonths(dateValue, months) {
  const d = new Date(dateValue);
  const count = Number(months) || 0;
  d.setMonth(d.getMonth() + count);
  return d;
}

/**
 * Escape HTML special characters to prevent injection.
 * @param {any} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Strip HTML tags, returning plain text.
 * @param {string} html
 * @returns {string}
 */
export function stripHtml(html) {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

/**
 * Truncate text with an ellipsis, breaking at the last space.
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
export function truncateText(text, maxLength = 120) {
  if (!text || text.length <= maxLength) return text;
  const lastSpaceIndex = text.lastIndexOf(" ", maxLength - 3);
  const endIndex = lastSpaceIndex > 0 ? lastSpaceIndex : maxLength - 3;
  return text.substring(0, endIndex) + "...";
}

/**
 * Normalize a status/string value to lowercase + trimmed.
 * @param {string} value
 * @returns {string}
 */
export function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

/**
 * Debounce a function call until `wait` ms have passed since the last call.
 * @param {Function} func
 * @param {number} wait
 * @returns {Function}
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle a function to at most one call per `limit` ms.
 * @param {Function} func
 * @param {number} limit
 * @returns {Function}
 */
export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (inThrottle) return;
    func(...args);
    inThrottle = true;
    setTimeout(() => (inThrottle = false), limit);
  };
}