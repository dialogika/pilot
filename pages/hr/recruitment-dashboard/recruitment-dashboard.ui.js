// pages/hr/recruitment-dashboard/recruitment-dashboard.ui.js
// =====================================================================
// RECRUITMENT DASHBOARD UI — DOM rendering layer.
//
// All DOM manipulation for the Recruitment Dashboard lives here.
// This module MUST NOT import or query Firestore directly.
// =====================================================================

// ── Shared helpers ──────────────────────────────────────────────────

function escapeDashboardHtml(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatLongDate(dateObj) {
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return "-";
  return dateObj.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getPlatformColorClass(platformLabel) {
  const key = (platformLabel || "").toString().trim().toLowerCase().replace(/\s/g, "");
  if (key.includes("linkedin")) return "bg-primary";
  if (key.includes("instagram")) return "bg-info";
  if (key.includes("msib")) return "bg-secondary";
  if (key.includes("website")) return "bg-success";
  if (key.includes("other")) return "bg-dark";
  return "bg-primary";
}

// ── Greeting ────────────────────────────────────────────────────────

/**
 * Render the greeting text and today's date.
 */
export function renderGreeting() {
  const now = new Date();
  const hours = now.getHours();
  let greeting = "";
  if (hours < 12) greeting = "Good Morning";
  else if (hours < 18) greeting = "Good Afternoon";
  else greeting = "Good Evening";

  const greetingEl = document.getElementById("greetingText");
  const dateEl = document.getElementById("dateText");
  if (greetingEl) greetingEl.innerText = greeting + ",";
  if (dateEl) {
    const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
    dateEl.innerText = "Today is " + now.toLocaleDateString("en-US", options);
  }
}

// ── Section title ───────────────────────────────────────────────────

/**
 * Update the active section title text.
 */
export function renderSectionTitle(title) {
  const el = document.getElementById("activeSectionTitle");
  if (el) el.textContent = title || "Recruitment";
}

// ── Metric cards ────────────────────────────────────────────────────

/**
 * Update the four summary metric cards.
 */
export function renderMetricCards({ headCount, applicants, contractEnding, offboarding }) {
  const hcEl = document.getElementById("currentHeadCount");
  const appEl = document.getElementById("applicantsCount");
  const olEl = document.getElementById("onLeaveCount");
  const obEl = document.getElementById("offboardingCount");

  if (hcEl) hcEl.textContent = (headCount ?? 0).toString();
  if (appEl) appEl.textContent = (applicants ?? 0).toString();
  if (olEl) olEl.textContent = (contractEnding ?? 0).toString();
  if (obEl) obEl.textContent = (offboarding ?? 0).toString();
}

// ── Notes ───────────────────────────────────────────────────────────

/**
 * Set the important notes text on the dashboard.
 */
export function renderNotesText(content) {
  const el = document.getElementById("recruitmentImportantNotesText");
  if (el) el.textContent = content || "Posisi yang saat ini dibuka : all position";
}

/**
 * Open the notes edit modal, pre-filling the textarea.
 */
export function openNotesModal() {
  const modalEl = document.getElementById("recruitmentNotesModal");
  const inputEl = document.getElementById("recruitmentNotesInput");
  const textEl = document.getElementById("recruitmentImportantNotesText");
  if (!modalEl || !inputEl) return;

  inputEl.value = textEl ? (textEl.textContent || "").trim() : "";
  bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

/**
 * Get the current value from the notes textarea.
 */
export function getNotesInputValue() {
  const el = document.getElementById("recruitmentNotesInput");
  return el ? (el.value || "").toString().trim() : "";
}

/**
 * Close the notes modal.
 */
export function closeNotesModal() {
  const modalEl = document.getElementById("recruitmentNotesModal");
  if (!modalEl) return;
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();
}

/**
 * Set the save button disabled state.
 */
export function setNotesSaveLoading(loading) {
  const btn = document.getElementById("saveRecruitmentNotesBtn");
  if (btn) btn.disabled = loading;
}

// ── Stats detail modal ──────────────────────────────────────────────

/**
 * Open the stats detail modal in a loading state.
 * @returns {{ bodyEl: HTMLElement, countEl: HTMLElement } | null}
 */
export function setModalLoading(title, subtitle) {
  const modalEl = document.getElementById("statsDetailsModal");
  const titleEl = document.getElementById("statsDetailsModalLabel");
  const subtitleEl = document.getElementById("statsDetailsModalSubtitle");
  const countEl = document.getElementById("statsDetailsModalCount");
  const bodyEl = document.getElementById("statsDetailsModalBody");
  if (!modalEl || !titleEl || !subtitleEl || !countEl || !bodyEl) return null;

  titleEl.textContent = title || "Detail";
  subtitleEl.textContent = subtitle || "";
  countEl.textContent = "";
  bodyEl.innerHTML = `<div class="d-flex align-items-center gap-2 text-muted"><div class="spinner-border spinner-border-sm" role="status"></div><div>Loading...</div></div>`;

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
  return { bodyEl, countEl };
}

/**
 * Render a table inside the stats detail modal.
 */
export function renderModalTable(ctx, columns, rows) {
  const { bodyEl, countEl } = ctx;
  countEl.textContent = `${rows.length} data`;
  if (!rows.length) {
    bodyEl.innerHTML = `<div class="text-muted">Tidak ada data pada rentang tanggal ini.</div>`;
    return;
  }
  const thead = columns.map((c) => `<th>${c.label}</th>`).join("");
  const tbody = rows
    .map((r) => {
      const tds = columns
        .map((c) => {
          if (c.key === "photo") {
            const src = r.photo || `https://i.pravatar.cc/150?u=${r.id || r.name || "x"}`;
            return `<td><img class="stats-modal-photo" src="${src}" alt=""></td>`;
          }
          return `<td>${escapeDashboardHtml(r[c.key] ?? "-")}</td>`;
        })
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");
  bodyEl.innerHTML = `<div class="table-responsive"><table class="table align-middle"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></div>`;
}

// ── Upcoming interviews ─────────────────────────────────────────────

/**
 * Render the upcoming interview list.
 * @param {Array} rows — processed interview rows with resolved names.
 */
export function renderUpcomingInterviews(rows) {
  const container = document.getElementById("upcomingInterviewList");
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = `<div class="text-muted-custom small">Belum ada upcoming interview.</div>`;
    return;
  }

  container.innerHTML = rows
    .slice(0, 10)
    .map(
      (row) => `
    <div class="interview-list-item">
      <div class="d-flex justify-content-between gap-3">
        <div>
          <div class="fw-bold">${escapeDashboardHtml(row.name)}</div>
          <div class="text-muted-custom small">${escapeDashboardHtml(row.position)} | ${escapeDashboardHtml(row.sectionLabel)}</div>
          <div class="text-muted-custom small">Interviewer: ${escapeDashboardHtml(row.interviewerNames)}</div>
        </div>
        <div class="text-end small">
          <div class="fw-bold">${formatLongDate(row.interviewSchedule)}</div>
          <div class="text-muted-custom">${row.interviewSchedule.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
      </div>
    </div>`
    )
    .join("");
}

// ── Overdue interviews ──────────────────────────────────────────────

/**
 * Render the overdue interview list.
 * @param {Array} rows — overdue interview rows with lateDays calculated.
 */
export function renderOverdueInterviews(rows) {
  const container = document.getElementById("overdueInterviewList");
  const badge = document.getElementById("overdueCountBadge");

  if (badge) badge.textContent = rows.length.toString();
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = `<div class="text-secondary small text-center py-4">Tidak ada overdue interview.</div>`;
    return;
  }

  container.innerHTML = rows
    .map(
      (row) => `
    <div class="d-flex justify-content-between gap-3 p-3 rounded bg-white border border-danger border-opacity-10">
      <div>
        <div class="fw-bold text-dark small">${escapeDashboardHtml(row.name)}</div>
        <div class="text-muted-custom small">${escapeDashboardHtml(row.position)} | ${escapeDashboardHtml(row.sectionLabel)}</div>
        <div class="text-muted-custom small">Interviewer: ${escapeDashboardHtml(row.interviewerNames)}</div>
        <div class="text-danger small">${formatLongDate(row.interviewSchedule)}</div>
      </div>
      <div class="text-end text-danger fw-bold small">${row.lateDays} hari</div>
    </div>`
    )
    .join("");
}

// ── Platform job posting ────────────────────────────────────

/**
 * Render the platform job posting bar chart.
 * @param {Object} counts — { "LinkedIn": 21, "Instagram": 108, ... }
 * @param {number} total
 */
export function renderPlatformJobposting(counts, total) {
  const listEl = document.getElementById("platformJobpostingList");
  const totalEl = document.getElementById("platformTotalCandidate");
  if (!listEl || !totalEl) return;

  totalEl.textContent = total.toString();

  const platforms = ["LinkedIn", "Instagram", "Website Dialogika", "Website MSIB", "Other"];
  listEl.innerHTML = platforms
    .map((l) => {
      const c = counts[l] || 0;
      const pct = total ? Math.round((c / total) * 1000) / 10 : 0;
      return `<div class="mb-3"><div class="d-flex justify-content-between small mb-1"><span>${l}</span><span>${c} kandidat (${pct}%)</span></div><div class="progress"><div class="progress-bar ${getPlatformColorClass(l)}" style="width: ${pct}%"></div></div></div>`;
    })
    .join("");
}

// ── Calendar text ───────────────────────────────────────────────────

/**
 * Update the calendar button text.
 */
export function setCalendarText(text) {
  const btn = document.querySelector(".btn-weekly .calendar-text");
  if (btn) btn.textContent = text;
}

// ── Filter button states ────────────────────────────────────────────

/**
 * Update the All Time button active state.
 */
export function updateFilterButtonStates(isAllTime) {
  const allTimeBtn = document.getElementById("btnAllTime");
  if (allTimeBtn) allTimeBtn.classList.toggle("active", isAllTime);
}
