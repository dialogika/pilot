// assets/js/home-utils.js
// Utility functions for home dashboard
// =====================================================================

/**
 * Format greeting based on current time
 * @param {string} name - User's name
 * @returns {string} Formatted greeting
 */
export function formatGreeting(name = "") {
  const hour = new Date().getHours();
  let greeting = "Hello";
  
  if (hour >= 5 && hour < 12) greeting = "Good Morning";
  else if (hour >= 12 && hour < 17) greeting = "Good Afternoon";
  else if (hour >= 17 && hour < 21) greeting = "Good Evening";
  else greeting = "Good Night";
  
  const firstName = name ? name.split(" ")[0] : "";
  return firstName ? `${greeting}, ${firstName}!` : greeting;
}

/**
 * Get milliseconds from various date formats
 * @param {any} value - Date value
 * @returns {number|null} Milliseconds or null
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
 * Check if data is recent based on cutoff time
 * @param {Object} data - Data object
 * @param {number} cutoffMs - Cutoff time in milliseconds
 * @returns {boolean} True if recent
 */
export function isRecentByFields(data, cutoffMs) {
  const ms = getMs(data.createdAtMs || data.created_at_ms);
  const ts = getMs(data.createdAt || data.created_at);
  return (ms != null && ms >= cutoffMs) || (ts != null && ts >= cutoffMs);
}

/**
 * Normalize status string
 * @param {string} value - Status value
 * @returns {string} Normalized status
 */
export function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

/**
 * Format Indonesian date
 * @param {Date} date - Date object
 * @returns {string} Formatted date string
 */
export function formatDateID(date) {
  const days = [
    "Minggu", "Senin", "Selasa", "Rabu", 
    "Kamis", "Jumat", "Sabtu"
  ];
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
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
 * Add months to date
 * @param {Date|string|number} dateValue - Original date
 * @param {number} months - Number of months to add
 * @returns {Date} New date
 */
export function addMonths(dateValue, months) {
  const d = new Date(dateValue);
  const count = Number(months) || 0;
  d.setMonth(d.getMonth() + count);
  return d;
}

/**
 * Escape HTML special characters
 * @param {string} value - String to escape
 * @returns {string} Escaped string
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
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength = 120) {
  if (!text || text.length <= maxLength) return text;
  
  // Try to break at last space before maxLength
  const lastSpaceIndex = text.lastIndexOf(" ", maxLength - 3);
  const endIndex = lastSpaceIndex > 0 ? lastSpaceIndex : maxLength - 3;
  return text.substring(0, endIndex) + "...";
}

/**
 * Strip HTML tags from string
 * @param {string} html - HTML string
 * @returns {string} Plain text
 */
export function stripHtml(html) {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}