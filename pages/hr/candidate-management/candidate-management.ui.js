import {
  getInterviewScheduleStatus,
  filterAndSortInterviewSchedules
} from "../../../element/recruitment-interview-utils.js";
import { setupExportModalControls } from "../../../assets/js/utils/export-helper.js";

/**
 * Escapes HTML characters to prevent XSS.
 * @param {string} str 
 * @returns {string}
 */
export function escapeHtml(str) {
  return (str || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Extracts up to 2 initials from a name string.
 * @param {string} name 
 * @returns {string}
 */
export function getInitialsFromName(name) {
  const t = (name || "").toString().trim();
  if (!t) return "NA";
  return t
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

/**
 * Converts a raw date/timestamp to a JavaScript Date object.
 * @param {any} raw 
 * @returns {Date|null}
 */
export function toDateObject(raw) {
  if (!raw) return null;
  if (typeof raw.toDate === "function") {
    const d = raw.toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d : null;
  }
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === "string" || typeof raw === "number") {
    const p = new Date(raw);
    return isNaN(p.getTime()) ? null : p;
  }
  return null;
}

/**
 * Formats a date to Indonesian local date string.
 * @param {any} raw 
 * @returns {string}
 */
export function formatCreatedDate(raw) {
  const d = toDateObject(raw);
  if (!d) return "";
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Gets timestamp in milliseconds for sorting.
 * @param {any} raw 
 * @returns {number}
 */
export function getCreatedTimestamp(raw) {
  const d = toDateObject(raw);
  return d ? d.getTime() : 0;
}

/**
 * Formats due date for standard date inputs (YYYY-MM-DD).
 * @param {any} raw 
 * @returns {string}
 */
export function formatDueDateForInput(raw) {
  const d = toDateObject(raw);
  if (!d) return "";
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

/**
 * Formats schedule date for sorting ISO-like string.
 * @param {any} raw 
 * @returns {string}
 */
export function formatScheduleSortValue(raw) {
  const d = toDateObject(raw);
  if (!d) return "";
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0") +
    "T" +
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0")
  );
}

/**
 * Formats interview date e.g. "Minggu, 23 Agustus 2026"
 * @param {any} raw 
 * @returns {string}
 */
export function formatInterviewDateOnly(raw) {
  const d = toDateObject(raw);
  if (!d) return "-";
  const wd = new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(d);
  const dt = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" }).format(d);
  return wd.charAt(0).toUpperCase() + wd.slice(1) + ", " + dt;
}

/**
 * Formats interview time e.g. "11.00 WIB"
 * @param {any} raw 
 * @returns {string}
 */
export function formatInterviewTimeOnly(raw) {
  const d = toDateObject(raw);
  if (!d) return "-";
  const t = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return t.replace(":", ".") + " WIB";
}

/**
 * Returns badge metadata for interview schedule board.
 * @param {string} status 
 * @returns {Object}
 */
export function getInterviewScheduleBoardBadgeMeta(status) {
  const st = (status || "").toString().trim().toLowerCase();
  if (st === "today") return { label: "Today", className: "interview-schedule-badge badge-today" };
  if (st === "completed") return { label: "Completed", className: "interview-schedule-badge badge-completed" };
  return { label: "Upcoming", className: "interview-schedule-badge badge-upcoming" };
}

/**
 * Formats compact date range for OJT.
 * @param {any} startDate 
 * @param {any} endDate 
 * @returns {string}
 */
export function formatOjtDateRangeCompact(startDate, endDate) {
  const s = toDateObject(startDate);
  if (!s) return "-";
  const st = s.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  const e = toDateObject(endDate);
  if (!e) return st;
  return st + " - " + e.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Resolves interviewer details from list of IDs.
 * @param {Array<string>} ids 
 * @param {Object} usersMap 
 * @returns {Array<Object>}
 */
export function getInterviewerDetailsFromIds(ids, usersMap = {}) {
  return (Array.isArray(ids) ? ids : [])
    .map((uid) => {
      const u = usersMap[uid] || null;
      if (!u) return null;
      return {
        id: uid,
        name: u.name || "User",
        photo: u.photo || null,
        specialization: u.specialization || "General Recruitment",
        availability: u.availability || "available"
      };
    })
    .filter(Boolean);
}

/**
 * Builds single interview schedule entry object.
 * @param {Object} params 
 * @param {Object} usersMap 
 * @returns {Object|null}
 */
export function buildInterviewScheduleEntry(params, usersMap = {}) {
  const d = toDateObject(params.scheduleRaw);
  if (!d) return null;
  const details = getInterviewerDetailsFromIds(params.interviewerIds, usersMap);
  return {
    candidateId: params.candidateId || "",
    candidateName: params.candidateName || "Tanpa Nama",
    positionName: params.positionName || "-",
    interviewerNames: details.map((i) => i.name).filter(Boolean),
    scheduleAt: d,
    scheduleIso: d.toISOString(),
    scheduleStatus: getInterviewScheduleStatus(d)
  };
}

/**
 * Checks if a candidate record is inactive or deleted.
 * @param {Object} data 
 * @returns {boolean}
 */
export function isInactiveCandidateRecord(data) {
  if (!data) return false;
  const rs = (data.record_status || data.recordStatus || "").toString().trim().toLowerCase();
  return data.is_deleted === true || rs === "inactive" || !!data.deleted_at || !!data.deletedAt;
}

/**
 * Refreshes Bootstrap tooltips.
 */
export function refreshTooltips() {
  if (!window.bootstrap || typeof window.bootstrap.Tooltip !== "function") return;
  const els = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  els.forEach((el) => {
    if (!el._tooltipInstance) el._tooltipInstance = new window.bootstrap.Tooltip(el);
  });
}

/**
 * Renders pipeline summary 7-card statistics.
 * @param {string} category 
 * @param {Object} config 
 * @param {Object} counts 
 * @param {number} total 
 */
export function renderPipelineSummary(category, config, counts, total) {
  const el = document.querySelector(`.tab-pipeline[data-tab="${category}"]`);
  if (!el) return;

  const totalNote = total === 0 ? "Belum ada data yang dimuat." : "Total seluruh kandidat.";
  let html = `
    <div class="pipeline-stat-card pipeline-stat-total">
      <div class="pipeline-stat-label">Total Kandidat</div>
      <div class="pipeline-stat-value">${total}</div>
      <div class="pipeline-stat-note">${totalNote}</div>
    </div>
  `;

  config.statusPipeline.forEach((s) => {
    const cnt = counts[s.value] || 0;
    html += `
      <div class="pipeline-stat-card pipeline-stat-${s.value}">
        <div class="pipeline-stat-label">${s.label}</div>
        <div class="pipeline-stat-value">${cnt}</div>
        <div class="pipeline-stat-note">${s.caption || ""}</div>
      </div>
    `;
  });

  el.innerHTML = html;

  const countEl = document.getElementById(`tabCount${category.charAt(0).toUpperCase() + category.slice(1)}`);
  if (countEl) countEl.textContent = total;
}

/**
 * Renders a single candidate card HTML for grid view.
 * @param {string} category 
 * @param {Object} config 
 * @param {Object} item 
 * @param {Object} usersMap 
 * @returns {string}
 */
export function buildCandidateCardHtml(category, config, item, usersMap = {}) {
  const name = escapeHtml(item.name || "Tanpa Nama");
  const position = escapeHtml(item.positionName || "");
  const avatarUrl = item.avatarUrl || "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=800";
  const mode = (item.mode || "").toString().toUpperCase();
  const address = escapeHtml(item.address || "");
  const email = escapeHtml(item.email || "");
  const campus = escapeHtml(item.campus || "");
  const talentId = item.talentId || "";
  const rawStatus = item.status || "";
  const currentStatus = config.normalizeStatus(rawStatus) || "screening";
  const dueDateInputValue = item.dueDateInputValue || "";
  const interviewScheduleRaw = item.interviewScheduleRaw || "";
  const interviewerIds = Array.isArray(item.interviewerIds) ? item.interviewerIds : [];
  const createdSortValue = Number(item.createdSortValue || 0);
  const finalDecisionAt = item.finalDecisionAt || null;
  const rejectionReason = escapeHtml(item.rejectionReason || "");
  const rejectionNotes = escapeHtml(item.rejectionNotes || "");
  const withdrawnNotes = escapeHtml(item.withdrawnNotes || "");
  const ojtStart = item.onJobTrainingStartDate || null;
  const ojtEnd = item.onJobTrainingEndDate || null;
  const isTeamMember = !!item.isTeamMember;
  const onboardingDate = item.onboardingDate || null;
  const onboardingTime = item.onboardingTime || "";
  const onboardingLocation = item.onboardingLocation || "";

  const statusMeta = config.statusPipeline.find((i) => i.value === currentStatus) || config.statusPipeline[0];
  const statusLabel = statusMeta.label;
  const statusBadgeClasses = "status-badge-modern " + statusMeta.badgeClass;

  const positionHtml = position
    ? `<span class="candidate-role">${position}</span>`
    : `<span class="candidate-role">-</span>`;
  const emailValue = email || "-";
  const addressValue = address || "-";
  const modeValue = mode || "-";
  const campusValue = campus || "-";
  const avatarAttr = escapeHtml(avatarUrl);

  let headerChipsHtml = `<div class="candidate-header-chips">${positionHtml}<span class="${statusBadgeClasses}">${statusLabel}</span>`;
  if (category === "team" && isTeamMember) {
    headerChipsHtml += `<span class="team-member-badge"><i class="fa-solid fa-user-check"></i>Team Member</span>`;
  }
  headerChipsHtml += `</div>`;

  // Status details for rejected/canceled
  let statusDetailsHtml = "";
  if (currentStatus === "rejected" || currentStatus === "canceled") {
    const dateText = finalDecisionAt ? formatCreatedDate(finalDecisionAt) : "-";
    const notesText = currentStatus === "rejected" ? (rejectionReason || rejectionNotes) : withdrawnNotes;
    const notesDisplay = notesText
      ? `<div class="candidate-detail-value essay-clamp" title="${notesText}">${notesText}</div>`
      : `<div class="candidate-detail-value text-muted">-</div>`;
    statusDetailsHtml = `
      <div class="candidate-selection-meta mt-3 pt-3 border-t border-slate-100">
        <div class="candidate-interview-meta" style="gap:12px">
          <div class="candidate-extra-item">
            <div class="candidate-extra-label">Tanggal</div>
            <div class="candidate-detail-value text-sm">${escapeHtml(dateText)}</div>
          </div>
          <div class="candidate-extra-item">
            <div class="candidate-extra-label">Catatan</div>
            ${notesDisplay}
          </div>
        </div>
      </div>
    `;
  }

  const detailListHtml = `
    <div class="candidate-details-list">
      <div class="candidate-detail-item detail-email">
        <div class="candidate-detail-icon"><i class="fa-regular fa-envelope"></i></div>
        <div class="candidate-detail-content">
          <div class="candidate-detail-label">Email</div>
          <div class="candidate-detail-value candidate-detail-value-email" title="${emailValue}">${emailValue}</div>
        </div>
      </div>
      <div class="candidate-detail-item detail-location">
        <div class="candidate-detail-icon"><i class="fa-solid fa-location-dot"></i></div>
        <div class="candidate-detail-content">
          <div class="candidate-detail-label">Lokasi</div>
          <div class="candidate-detail-value" title="${addressValue}">${addressValue}</div>
        </div>
      </div>
      <div class="candidate-detail-item detail-mode">
        <div class="candidate-detail-icon"><i class="fa-solid fa-building"></i></div>
        <div class="candidate-detail-content">
          <div class="candidate-detail-label">Mode Kerja</div>
          <div class="candidate-detail-value">${modeValue}</div>
        </div>
      </div>
    </div>
  `;

  const hasInterview = !!toDateObject(interviewScheduleRaw);
  const intStatus = hasInterview ? getInterviewScheduleStatus(interviewScheduleRaw) : "";
  const intDetails = getInterviewerDetailsFromIds(interviewerIds, usersMap);
  const intNames = intDetails.length ? intDetails.map((i) => i.name).join(", ") : "-";
  const intDate = hasInterview ? formatInterviewDateOnly(interviewScheduleRaw) : "-";
  const intTime = hasInterview ? formatInterviewTimeOnly(interviewScheduleRaw) : "-";
  const intBadge = hasInterview ? getInterviewScheduleBoardBadgeMeta(intStatus) : null;
  const intAvail = intDetails.some((i) => (i.availability || "") === "available") ? "available" : "booked";

  const intGridHtml = intDetails.length
    ? intDetails
        .map((i) => {
          const inner = i.photo
            ? `<img src="${escapeHtml(i.photo)}" alt="${escapeHtml(i.name)}">`
            : escapeHtml(getInitialsFromName(i.name));
          return `
            <div class="interviewer-card">
              <div class="interviewer-avatar">${inner}</div>
              <div class="interviewer-main">
                <div class="interviewer-name">${escapeHtml(i.name)}</div>
              </div>
            </div>
          `;
        })
        .join("")
    : `
      <div class="interviewer-card">
        <div class="interviewer-avatar">NA</div>
        <div class="interviewer-main">
          <div class="interviewer-name">Belum Ditentukan</div>
        </div>
      </div>
    `;

  const interviewSectionHtml = `
    <div class="candidate-selection-meta">
      <div class="candidate-interview-meta">
        <div class="candidate-extra-item candidate-extra-item-interviewer">
          <div class="candidate-extra-label">Interviewer</div>
          <div class="interviewer-grid" data-bs-toggle="tooltip" data-bs-placement="top" title="${escapeHtml(intNames)}">
            ${intGridHtml}
          </div>
        </div>
        <div class="candidate-extra-item candidate-extra-item-schedule">
          <div class="schedule-compact-header">
            <i class="fa-regular fa-calendar-days"></i><span>Jadwal Interview</span>
          </div>
          <div class="schedule-compact-details">
            <div class="schedule-compact-row"><span>Tanggal</span><strong>${escapeHtml(intDate)}</strong></div>
            <div class="schedule-compact-row"><span>Jam</span><strong>${escapeHtml(intTime)}</strong></div>
            <div class="schedule-compact-row"><span>Status</span><strong>${intBadge ? `<span class="${intBadge.className}">${escapeHtml(intBadge.label)}</span>` : "-"}</strong></div>
          </div>
        </div>
      </div>
    </div>
  `;

  let ojtSectionHtml = "";
  if (config.hasOjtSection && ojtStart) {
    const ojtDate = formatOjtDateRangeCompact(ojtStart, ojtEnd);
    ojtSectionHtml = `
      <div class="candidate-selection-meta mt-2">
        <div class="candidate-interview-meta">
          <div class="candidate-extra-item candidate-extra-item-schedule" style="border-left:3px solid #8b5cf6">
            <div class="schedule-compact-header"><i class="fa-solid fa-graduation-cap"></i><span>Jadwal On Job Test</span></div>
            <div class="schedule-compact-date">${escapeHtml(ojtDate)}</div>
          </div>
        </div>
      </div>
    `;
  }

  let onboardingSectionHtml = "";
  if (currentStatus === "onboarding" && onboardingDate) {
    const onbDateObj = toDateObject(onboardingDate);
    const onbDateDisplay = onbDateObj ? formatInterviewDateOnly(onbDateObj) : escapeHtml(onboardingDate);
    const onbTimeDisplay = onboardingTime ? escapeHtml(onboardingTime.replace(":", ".") + " WIB") : "-";
    const onbLocationDisplay = onboardingLocation ? escapeHtml(onboardingLocation) : "-";
    const onbPicDisplay = (item.onboardingPicNames && item.onboardingPicNames.length)
      ? item.onboardingPicNames.map(p => escapeHtml(p)).join(", ")
      : "";
    onboardingSectionHtml = `
      <div class="candidate-selection-meta mt-2">
        <div class="candidate-interview-meta">
          <div class="candidate-extra-item candidate-extra-item-schedule" style="border-left:3px solid #6366f1">
            <div class="schedule-compact-header"><i class="fa-solid fa-user-check"></i><span>On Boarding</span></div>
            <div class="schedule-compact-details">
              <div class="schedule-compact-row"><span>Tanggal</span><strong>${onbDateDisplay}</strong></div>
              <div class="schedule-compact-row"><span>Jam</span><strong>${onbTimeDisplay}</strong></div>
              <div class="schedule-compact-row"><span>Lokasi</span><strong>${onbLocationDisplay}</strong></div>
              ${onbPicDisplay ? `<div class="schedule-compact-row"><span>Petugas/PD</span><strong>${onbPicDisplay}</strong></div>` : ""}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const cancelBtnHtml = !["rejected", "canceled"].includes(currentStatus)
    ? `<button type="button" class="candidate-inline-action candidate-cancel-btn" data-category="${category}" data-talent-id="${talentId}" title="Canceled / Mengundurkan Diri" style="color:#b45309"><i class="fa-solid fa-user-xmark"></i></button>`
    : "";
  const actionBtn = `
    <div class="candidate-card-head-actions">
      ${cancelBtnHtml}
      <button type="button" class="candidate-inline-action action-trash candidate-delete-btn" data-category="${category}" title="Pindahkan ke Sampah">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>
  `;

  let bodyContent = detailListHtml;
  if (statusDetailsHtml) bodyContent += statusDetailsHtml;

  return `
    <div class="candidate-item"
      data-name="${name}"
      data-position="${position}"
      data-email="${emailValue}"
      data-campus="${campusValue}"
      data-avatar="${avatarAttr}"
      data-status-label="${escapeHtml(statusLabel)}"
      data-talent-id="${talentId}"
      data-status="${currentStatus}"
      data-created="${createdSortValue}"
      data-due-date="${escapeHtml(dueDateInputValue)}"
      data-interview-status="${intStatus}"
      data-interviewer-availability="${intAvail}"
      data-category="${category}"
      tabindex="0"
      role="link">
      <div class="candidate-card-modern">
        <div class="candidate-card-head">
          <div class="candidate-avatar-row">
            <img src="${avatarUrl}" alt="${name}" class="candidate-avatar-large">
            <div class="candidate-header-main">
              <div class="candidate-name">${name}</div>
              ${headerChipsHtml}
            </div>
          </div>
          ${actionBtn}
          ${statusDetailsHtml ? "" : interviewSectionHtml + ojtSectionHtml + onboardingSectionHtml}
        </div>
        <div class="candidate-card-body">
          ${bodyContent}
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders candidate table row HTML for list view.
 * @param {string} category 
 * @param {Object} config 
 * @param {Object} item 
 * @param {Object} usersMap 
 * @returns {string}
 */
export function buildCandidateRowHtml(category, config, item, usersMap = {}) {
  const name = escapeHtml(item.name || "Tanpa Nama");
  const position = escapeHtml(item.positionName || "");
  const avatarUrl = item.avatarUrl || "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=800";
  const mode = (item.mode || "").toString().toUpperCase();
  const address = escapeHtml(item.address || "");
  const email = escapeHtml(item.email || "");
  const campus = escapeHtml(item.campus || "");
  const talentId = item.talentId || "";
  const rawStatus = item.status || "";
  const currentStatus = config.normalizeStatus(rawStatus) || "screening";
  const dueDateInputValue = item.dueDateInputValue || "";
  const createdSortValue = Number(item.createdSortValue || 0);

  const statusMeta = config.statusPipeline.find((i) => i.value === currentStatus) || config.statusPipeline[0];
  const statusLabel = statusMeta.label;
  const statusBadgeClasses = "status-badge-modern " + statusMeta.badgeClass;

  const positionHtml = position
    ? `<span class="candidate-role">${position}</span>`
    : `<span class="candidate-role">-</span>`;
  const emailValue = email || "-";
  const addressValue = address || "-";
  const modeValue = mode || "-";
  const campusValue = campus || "-";
  const avatarAttr = escapeHtml(avatarUrl);

  let headerChipsHtml = `<div class="candidate-header-chips">${positionHtml}<span class="${statusBadgeClasses}">${statusLabel}</span>`;
  if (category === "team" && item.isTeamMember) {
    headerChipsHtml += `<span class="team-member-badge"><i class="fa-solid fa-user-check"></i>Team Member</span>`;
  }
  headerChipsHtml += `</div>`;

  const cancelBtnHtml = !["rejected", "canceled"].includes(currentStatus)
    ? `<button type="button" class="candidate-inline-action candidate-cancel-btn me-1" data-category="${category}" data-talent-id="${talentId}" title="Canceled / Mengundurkan Diri" style="color:#b45309"><i class="fa-solid fa-user-xmark"></i></button>`
    : "";

  return `
    <tr style="background-color:transparent" class="candidate-row candidate-row-main"
      data-name="${name}"
      data-position="${position}"
      data-email="${emailValue}"
      data-campus="${campusValue}"
      data-avatar="${avatarAttr}"
      data-status-label="${escapeHtml(statusLabel)}"
      data-status="${currentStatus}"
      data-created="${createdSortValue}"
      data-due-date="${escapeHtml(dueDateInputValue)}"
      data-talent-id="${talentId}"
      data-category="${category}">
      <td style="background-color:transparent" colspan="1" class="border-0 px-0 py-2">
        <div class="candidate-list-card" data-talent-id="${talentId}" data-category="${category}" tabindex="0" role="link">
          <div class="candidate-list-main">
            <div class="candidate-list-topbar">
              <div class="d-flex gap-3 align-items-start flex-grow-1">
                <img src="${avatarUrl}" alt="${name}" class="list-img rounded-4 shadow-sm" style="width:64px;height:64px;object-fit:cover;border-radius:1rem">
                <div class="candidate-header-main">
                  <div class="candidate-name">${name}</div>
                  ${headerChipsHtml}
                </div>
              </div>
              <div class="d-flex align-items-center">
                ${cancelBtnHtml}
                <button type="button" class="candidate-inline-action action-trash candidate-delete-btn" data-category="${category}" title="Pindahkan ke Sampah">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </div>
            <div class="candidate-details-list">
              <div class="candidate-detail-item">
                <div class="candidate-detail-icon"><i class="fa-regular fa-envelope"></i></div>
                <div class="candidate-detail-content">
                  <div class="candidate-detail-label">Email</div>
                  <div class="candidate-detail-value">${emailValue}</div>
                </div>
              </div>
              <div class="candidate-detail-item">
                <div class="candidate-detail-icon"><i class="fa-solid fa-location-dot"></i></div>
                <div class="candidate-detail-content">
                  <div class="candidate-detail-label">Lokasi</div>
                  <div class="candidate-detail-value">${addressValue}</div>
                </div>
              </div>
              <div class="candidate-detail-item">
                <div class="candidate-detail-icon"><i class="fa-solid fa-building"></i></div>
                <div class="candidate-detail-content">
                  <div class="candidate-detail-label">Mode Kerja</div>
                  <div class="candidate-detail-value">${modeValue}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  `;
}

/**
 * Color palette for position cards.
 */
export const POSITION_CARD_COLORS = [
  { bg: "#f0f9ff", border: "#bae6fd", accent: "#0284c7" },
  { bg: "#fdf4ff", border: "#f0abfc", accent: "#a21caf" },
  { bg: "#f0fdf4", border: "#86efac", accent: "#16a34a" },
  { bg: "#fff7ed", border: "#fdba74", accent: "#ea580c" },
  { bg: "#faf5ff", border: "#c4b5fd", accent: "#7c3aed" },
  { bg: "#fefce8", border: "#fde047", accent: "#ca8a04" },
  { bg: "#fff1f2", border: "#fda4af", accent: "#e11d48" },
  { bg: "#ecfeff", border: "#67e8f9", accent: "#0891b2" },
  { bg: "#f8fafc", border: "#94a3b8", accent: "#475569" },
  { bg: "#fef2f2", border: "#fca5a5", accent: "#dc2626" }
];

/**
 * Renders positions card grid (active & inactive sections).
 * @param {Array<Object>} positionsData 
 * @param {string} categoryFilter 
 */
export function renderPositionsCards(positionsData = [], categoryFilter = "internship") {
  const grid = document.getElementById("positionsCardGrid");
  if (!grid) return;
  const inactiveSection = document.getElementById("inactivePositionsSection");
  const inactiveGrid = document.getElementById("inactivePositionsGrid");
  const inactiveCount = document.getElementById("inactivePositionCount");

  const filtered = positionsData.filter((p) => {
    if (categoryFilter && (p.category || "") !== categoryFilter) return false;
    return true;
  });

  const activePositions = filtered.filter((p) => p.active);
  const inactivePositions = filtered.filter((p) => !p.active);

  // Render active positions
  if (!activePositions.length) {
    grid.innerHTML = '<div class="candidate-empty-state" style="grid-column:1/-1">Tidak ada posisi aktif untuk kategori ini.</div>';
  } else {
    grid.innerHTML = activePositions
      .map((p, idx) => {
        const color = POSITION_CARD_COLORS[idx % POSITION_CARD_COLORS.length];
        const createdStr = formatCreatedDate(p.createdAt);
        return `
          <div class="position-card" data-id="${escapeHtml(p.id)}" style="background:${color.bg};border:1px solid ${color.border}">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
              <div class="position-card-title">${escapeHtml(p.name || "-")}</div>
              <span style="display:inline-flex;align-items:center;gap:4px;font-size:0.68rem;font-weight:700;color:#16a34a">
                <i class="fa-solid fa-circle" style="font-size:0.35rem"></i>Aktif
              </span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
              <div class="position-card-date"><i class="fa-regular fa-calendar"></i>${escapeHtml(createdStr || "-")}</div>
              <div style="display:flex;gap:4px">
                <button type="button" class="position-action-btn" data-action="toggle" data-id="${escapeHtml(p.id)}" title="Nonaktifkan" style="color:#16a34a">
                  <i class="fa-solid fa-toggle-on"></i>
                </button>
                <button type="button" class="position-action-btn" data-action="edit" data-id="${escapeHtml(p.id)}" title="Edit">
                  <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button type="button" class="position-action-btn action-danger" data-action="delete" data-id="${escapeHtml(p.id)}" title="Hapus">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  // Render inactive positions
  if (inactiveSection && inactiveGrid) {
    if (!inactivePositions.length) {
      inactiveSection.style.display = "none";
      inactiveGrid.innerHTML = "";
    } else {
      inactiveSection.style.display = "block";
      if (inactiveCount) inactiveCount.textContent = inactivePositions.length;
      inactiveGrid.innerHTML = inactivePositions
        .map((p) => {
          const createdStr = formatCreatedDate(p.createdAt);
          return `
            <div class="position-card position-card-inactive" data-id="${escapeHtml(p.id)}">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
                <div class="position-card-title">${escapeHtml(p.name || "-")}</div>
                <span style="display:inline-flex;align-items:center;gap:4px;font-size:0.68rem;font-weight:700;color:#94a3b8">
                  <i class="fa-solid fa-circle" style="font-size:0.35rem"></i>Nonaktif
                </span>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                <div class="position-card-date"><i class="fa-regular fa-calendar"></i>${escapeHtml(createdStr || "-")}</div>
                <div style="display:flex;gap:4px">
                  <button type="button" class="position-action-btn" data-action="toggle" data-id="${escapeHtml(p.id)}" title="Aktifkan" style="color:#94a3b8">
                    <i class="fa-solid fa-toggle-off"></i>
                  </button>
                  <button type="button" class="position-action-btn" data-action="edit" data-id="${escapeHtml(p.id)}" title="Edit">
                    <i class="fa-solid fa-pen-to-square"></i>
                  </button>
                  <button type="button" class="position-action-btn action-danger" data-action="delete" data-id="${escapeHtml(p.id)}" title="Hapus">
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              </div>
            </div>
          `;
        })
        .join("");
    }
  }

  refreshTooltips();
}

/**
 * Renders interview schedule table rows inside modal.
 * @param {Array<Object>} entries 
 * @param {Object} state 
 * @param {Object} config 
 */
export function renderInterviewScheduleTable(entries, state, config) {
  const loadEl = document.getElementById("interviewScheduleLoading");
  const emptyEl = document.getElementById("interviewScheduleEmpty");
  const wrapEl = document.getElementById("interviewScheduleTableWrap");
  const bodyEl = document.getElementById("interviewScheduleTableBody");
  const pagWrap = document.getElementById("interviewSchedulePagWrap");
  const pagMeta = document.getElementById("interviewSchedulePagMeta");
  const prevBtn = document.getElementById("interviewSchedulePrevBtn");
  const nextBtn = document.getElementById("interviewScheduleNextBtn");

  if (!loadEl || !emptyEl || !wrapEl || !bodyEl || !pagWrap || !pagMeta || !prevBtn || !nextBtn) return;

  if (state.loading) {
    loadEl.classList.remove("d-none");
    emptyEl.classList.add("d-none");
    wrapEl.classList.add("d-none");
    pagWrap.classList.add("d-none");
    return;
  }

  const searchEl = document.getElementById("interviewScheduleSearch");
  const dateEl = document.getElementById("interviewScheduleDateFilter");
  const sortEl = document.getElementById("interviewScheduleSort");
  const statusEl = document.getElementById("interviewScheduleStatusFilter");

  const q = searchEl ? searchEl.value : "";
  const df = dateEl ? dateEl.value : "";
  const s = sortEl ? sortEl.value : "nearest";
  const sf = statusEl ? (statusEl.value || "").toLowerCase() : "";

  let filtered = filterAndSortInterviewSchedules(entries, { query: q, date: df, sort: s || "nearest" });
  if (sf) filtered = filtered.filter((i) => (i.scheduleStatus || "").toLowerCase() === sf);

  const total = filtered.length;
  const ps = state.pageSize || 10;
  const tp = Math.max(1, Math.ceil(total / ps));
  if (state.page > tp) state.page = tp;
  const page = Math.max(1, state.page);
  const start = (page - 1) * ps;
  const end = Math.min(start + ps, total);
  const paged = filtered.slice(start, end);

  if (!total) {
    loadEl.classList.add("d-none");
    emptyEl.classList.remove("d-none");
    wrapEl.classList.add("d-none");
    pagWrap.classList.add("d-none");
    bodyEl.innerHTML = "";
    return;
  }

  loadEl.classList.add("d-none");
  emptyEl.classList.add("d-none");
  wrapEl.classList.remove("d-none");
  pagWrap.classList.remove("d-none");

  bodyEl.innerHTML = paged
    .map((item) => {
      const intText = Array.isArray(item.interviewerNames) && item.interviewerNames.length
        ? item.interviewerNames.join(", ")
        : "Belum Ditentukan";
      const detailLink = config.detailPage + "?talentId=" + encodeURIComponent(item.candidateId || "") + "&source=list";
      const cn = escapeHtml(item.candidateName || "Tanpa Nama");
      const pn = escapeHtml(item.positionName || "-");
      const id = escapeHtml(formatInterviewDateOnly(item.scheduleAt || ""));
      const it = escapeHtml(formatInterviewTimeOnly(item.scheduleAt || ""));
      const rs = (item.scheduleStatus || "").toLowerCase() === "today" ? "booked" : "available";
      const rk = (item.candidateId || "") + "|" + (item.scheduleAt || "");
      const isSel = state.selectedRowKey === rk;
      const selCls = isSel ? " schedule-selected" : "";
      const stCls = rs === "booked" ? " schedule-status-booked" : " schedule-status-available";
      const tt = `Interviewer: ${intText} | ${id} | ${it}`;

      return `
        <tr class="schedule-clickable-row${stCls}${selCls}"
          tabindex="0"
          role="button"
          data-bs-toggle="tooltip"
          data-bs-placement="top"
          title="${escapeHtml(tt)}"
          data-detail-link="${detailLink}"
          data-candidate-id="${escapeHtml(item.candidateId || "")}"
          data-row-key="${escapeHtml(rk)}">
          <td>${id}</td>
          <td>${it}</td>
          <td>
            <div class="fw-semibold text-dark d-flex align-items-center">
              <span>${cn}</span>
              ${isSel ? '<span class="schedule-selected-check"><i class="fa-solid fa-check"></i></span>' : ""}
            </div>
          </td>
          <td>${escapeHtml(intText)}</td>
          <td>${pn}</td>
        </tr>
      `;
    })
    .join("");

  refreshTooltips();
  pagMeta.textContent = `Menampilkan ${start + 1}-${end} dari ${total} jadwal`;
  prevBtn.disabled = page <= 1;
  nextBtn.disabled = page >= tp;
}

/**
 * Renders WhatsApp template editor grid inside modal.
 * @param {string} category 
 * @param {Array<Object>} defs 
 * @param {Object} values 
 */
export function renderTemplateEditor(category, defs, values) {
  const el = document.getElementById("templateEditorGrid");
  if (!el) return;

  const CATEGORY_LABELS = { intern: "Intern", team: "Team", mentor: "Mentor", internship: "Intern" };
  const catLabel = document.getElementById("templateCategoryLabel");
  if (catLabel) {
    catLabel.textContent = "Template WhatsApp — " + (CATEGORY_LABELS[category] || category);
  }

  el.innerHTML = defs
    .map((item) => {
      const tl = item.requiredTokens.join(", ");
      return `
        <div class="template-editor-item">
          <h6 class="template-editor-item-title">${escapeHtml(item.title)}</h6>
          <p class="template-editor-item-desc">${escapeHtml(item.description)}</p>
          <p class="template-editor-item-desc mb-1"><strong>Placeholder:</strong> ${escapeHtml(tl)}</p>
          <textarea class="form-control" data-template-input="${item.id}" rows="7">${escapeHtml(values[item.id] || item.defaultTemplate)}</textarea>
        </div>
      `;
    })
    .join("");
}

/**
 * Sets validation alert message in template modal.
 * @param {string} msg 
 * @param {string} tone 
 */
export function setTemplateValidation(msg, tone) {
  const el = document.getElementById("templateBaseValidationMsg");
  if (!el) return;
  if (!msg) {
    el.textContent = "";
    el.className = "alert alert-warning d-none py-2 px-3 mb-3";
    return;
  }
  el.textContent = msg;
  el.className = "alert py-2 px-3 mb-3 " + (tone === "success" ? "alert-success" : tone === "danger" ? "alert-danger" : "alert-warning");
}

/**
 * Renders tab pagination footer for a candidate category tab.
 * @param {string} cat
 * @param {Object} info - { currentPage, totalRows, rowsPerPage, totalPages }
 * @param {Function} onPageChange - (newPage) => void
 */
export function renderTabPagination(cat, info, onPageChange) {
  const container = document.getElementById(`pagination-${cat}`);
  if (!container) return;

  const { currentPage, totalRows, rowsPerPage, totalPages } = info;
  if (!totalRows || totalRows <= 0) {
    container.innerHTML = "";
    container.style.display = "none";
    return;
  }

  container.style.display = "block";
  const start = (currentPage - 1) * rowsPerPage + 1;
  const end = Math.min(currentPage * rowsPerPage, totalRows);

  const left = `<p class="candidate-pagination-meta text-slate-500 font-medium text-xs mb-0">Menampilkan <span class="fw-bold text-slate-700">${start}</span> - <span class="fw-bold text-slate-700">${end}</span> dari <span class="fw-bold text-slate-700">${totalRows}</span> kandidat</p>`;

  let pages = "";
  // Prev button
  const prevDisabled = currentPage <= 1;
  pages += `
    <button type="button" class="candidate-page-btn candidate-page-nav" data-page="prev" ${prevDisabled ? "disabled" : ""} title="Halaman Sebelumnya">
      <i class="fas fa-chevron-left text-xs"></i>
    </button>
  `;

  // Page numbers with smart sliding window
  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  if (startPage > 1) {
    pages += `<button type="button" class="candidate-page-btn" data-page="1">1</button>`;
    if (startPage > 2) {
      pages += `<span class="candidate-page-dots">...</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const active = i === currentPage;
    pages += `<button type="button" class="candidate-page-btn ${active ? "active" : ""}" data-page="${i}">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      pages += `<span class="candidate-page-dots">...</span>`;
    }
    pages += `<button type="button" class="candidate-page-btn" data-page="${totalPages}">${totalPages}</button>`;
  }

  // Next button
  const nextDisabled = currentPage >= totalPages;
  pages += `
    <button type="button" class="candidate-page-btn candidate-page-nav" data-page="next" ${nextDisabled ? "disabled" : ""} title="Halaman Berikutnya">
      <i class="fas fa-chevron-right text-xs"></i>
    </button>
  `;

  container.innerHTML = `
    <div class="candidate-pagination-inner d-flex flex-column flex-sm-row justify-content-between align-items-center w-100 gap-3">
      ${left}
      <div class="candidate-pagination-pages d-flex align-items-center gap-1">
        ${pages}
      </div>
    </div>
  `;

  container.onclick = (e) => {
    const btn = e.target.closest(".candidate-page-btn");
    if (!btn || btn.disabled || btn.classList.contains("active")) return;
    const targetPage = btn.dataset.page;
    if (targetPage === "prev") {
      if (currentPage > 1 && onPageChange) onPageChange(currentPage - 1);
    } else if (targetPage === "next") {
      if (currentPage < totalPages && onPageChange) onPageChange(currentPage + 1);
    } else {
      const p = parseInt(targetPage, 10);
      if (!isNaN(p) && p !== currentPage && onPageChange) {
        onPageChange(p);
      }
    }
  };
}

/**
 * Initializes Export Modal controls for Candidate Management.
 * @param {Function} [onFormatChange]
 * @param {Function} [onRangeChange]
 * @returns {Object} Modal control handles
 */
export function initCandidateMgmtExportModal(onFormatChange, onRangeChange) {
  return setupExportModalControls({
    modalId: "exportCandidateMgmtModal",
    onFormatChange,
    onRangeChange,
  });
}

// =====================================================================
// DATABASE MAPPING & SCHEMA ERD CONTROLS (CANDIDATE MANAGEMENT)
// =====================================================================

function showCandidateToast(msg) {
  if (window.Swal) {
    const Toast = window.Swal.mixin({
      toast: true,
      position: "top-end",
      showConfirmButton: false,
      timer: 2500,
      timerProgressBar: true,
    });
    Toast.fire({
      icon: "success",
      title: msg,
    });
  } else {
    console.log("[Toast]", msg);
  }
}

function getBezierPoint(t, p0, p1, p2, p3) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

/**
 * Mounts the Database Mapping button exclusively to the sidebar
 * when Candidate Management is active.
 */
export function mountSidebarCandidateErdButton() {
  const sidebarWrapper = document.querySelector("#dg-sidebar-mount .sidebar-scroll-wrapper");
  if (!sidebarWrapper) return;

  // Prevent duplicate mounts
  if (document.getElementById("sidebarBtnCandidateErd")) return;

  const linkEl = document.createElement("a");
  linkEl.href = "javascript:void(0)";
  linkEl.className = "sidebar-link";
  linkEl.id = "sidebarBtnCandidateErd";
  linkEl.setAttribute("data-bs-toggle", "modal");
  linkEl.setAttribute("data-bs-target", "#candidateErdModal");
  linkEl.setAttribute("role", "button");
  linkEl.innerHTML = `
    <i class="bi bi-database text-blue-600"></i>
    <span>Database</span>
    <span class="sidebar-badge">
      <span class="badge bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">ERD</span>
    </span>
  `;

  // Place inside MAIN NAVIGATION right after "My Stuff" (or right before "SYSTEM" category)
  const links = Array.from(sidebarWrapper.querySelectorAll(".sidebar-link"));
  const myStuffLink = links.find((link) => link.textContent.includes("My Stuff"));

  if (myStuffLink) {
    myStuffLink.insertAdjacentElement("afterend", linkEl);
  } else {
    const navCategories = Array.from(sidebarWrapper.querySelectorAll(".nav-category"));
    const systemCategory = navCategories.find((cat) => cat.textContent.trim().toUpperCase() === "SYSTEM");
    if (systemCategory) {
      sidebarWrapper.insertBefore(linkEl, systemCategory);
    } else {
      const logoutBtn = document.getElementById("logoutBtn");
      if (logoutBtn) {
        sidebarWrapper.insertBefore(linkEl, logoutBtn);
      } else {
        sidebarWrapper.appendChild(linkEl);
      }
    }
  }
}

/**
 * Initializes Candidate Management ERD modal tabs, search, filters, SVG connectors & copy button.
 */
export function initCandidateErdModalControls() {
  const modalEl = document.getElementById("candidateErdModal");
  if (!modalEl) return;

  // Tab controls
  const tabVisualBtn = document.getElementById("tabBtnCandidateErdVisual");
  const tabDictBtn = document.getElementById("tabBtnCandidateErdDict");
  const tabSqlBtn = document.getElementById("tabBtnCandidateErdSql");

  const tabVisualContent = document.getElementById("candidateErdTabVisualContent");
  const tabDictContent = document.getElementById("candidateErdTabDictContent");
  const tabSqlContent = document.getElementById("candidateErdTabSqlContent");

  const tabs = [
    { btn: tabVisualBtn, content: tabVisualContent },
    { btn: tabDictBtn, content: tabDictContent },
    { btn: tabSqlBtn, content: tabSqlContent },
  ];

  tabs.forEach(({ btn, content }) => {
    btn?.addEventListener("click", () => {
      tabs.forEach((t) => {
        t.btn?.classList.remove("active");
        if (t.content) {
          t.content.classList.remove("active");
          t.content.style.display = "none";
        }
      });
      btn.classList.add("active");
      if (content) {
        content.classList.add("active");
        content.style.display = "block";
      }

      if (btn === tabVisualBtn) {
        setTimeout(drawCandidateErdRelations, 80);
      }
    });
  });

  // Kamus Data (Data Dictionary) Search & Table Filter
  const searchInput = document.getElementById("candidateErdDictSearchInput");
  const tableFilter = document.getElementById("candidateErdDictTableFilter");
  const dictTableBody = document.getElementById("candidateErdDictTableBody");
  const countBadge = document.getElementById("candidateErdDictCountBadge");

  function filterDictionaryRows() {
    if (!dictTableBody) return;
    const q = (searchInput?.value || "").trim().toLowerCase();
    const selectedTable = tableFilter?.value || "all";

    const rows = dictTableBody.querySelectorAll("tr");
    let visibleCount = 0;

    rows.forEach((row) => {
      const rowTable = row.getAttribute("data-table");
      const matchTable = selectedTable === "all" || rowTable === selectedTable;
      const textContent = row.textContent.toLowerCase();
      const matchSearch = !q || textContent.includes(q);

      if (matchTable && matchSearch) {
        row.style.display = "";
        visibleCount++;
      } else {
        row.style.display = "none";
      }
    });

    if (countBadge) {
      countBadge.textContent = `${visibleCount} Kolom`;
    }
  }

  searchInput?.addEventListener("input", filterDictionaryRows);
  tableFilter?.addEventListener("change", filterDictionaryRows);

  // Copy SQL Script Button
  const btnCopySql = document.getElementById("btnCopyCandidateSqlScript");
  const btnCopyText = document.getElementById("btnCopyCandidateSqlText");
  const sqlContent = document.getElementById("candidateSqlScriptContent");

  if (btnCopySql && sqlContent) {
    btnCopySql.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(sqlContent.textContent || "");
        if (btnCopyText) btnCopyText.textContent = "Tersalin!";
        showCandidateToast("Script SQL DDL berhasil disalin ke clipboard!");
        setTimeout(() => {
          if (btnCopyText) btnCopyText.textContent = "Salin Script SQL";
        }, 2500);
      } catch (err) {
        console.error("Gagal menyalin SQL:", err);
      }
    });
  }

  // Copy Obsidian Docs Path Button
  const btnCopyDocs = document.getElementById("btnCopyCandidateDocsPath");
  if (btnCopyDocs) {
    btnCopyDocs.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText("docs/CANDIDATE-DATABASE-MAPPING.md");
        showCandidateToast("Path docs/CANDIDATE-DATABASE-MAPPING.md tersalin!");
      } catch (e) {
        console.error("Gagal menyalin path:", e);
      }
    });
  }

  // =====================================================================
  // DYNAMIC SVG RELATIONS (LINES & ARROWS)
  // =====================================================================
  const wrapper = document.getElementById("candidateErdDiagramWrapper");
  const svgGroup = document.getElementById("candidateErdPathsGroup");
  const originAnchor = document.getElementById("erdOriginCandidatesId");

  const relationConfigs = [
    {
      id: "interviews",
      targetAnchor: document.getElementById("erdTargetInterviewsId"),
      card: document.getElementById("cardCandidateInterviews"),
      color: "#10b981",
      marker: "url(#candidateErdArrowEmerald)",
      label: "1 : N (candidate_id)",
      y1Offset: -10,
      tBadge: 0.35,
    },
    {
      id: "history",
      targetAnchor: document.getElementById("erdTargetHistoryId"),
      card: document.getElementById("cardCandidateHistory"),
      color: "#f59e0b",
      marker: "url(#candidateErdArrowAmber)",
      label: "1 : N (candidate_id)",
      y1Offset: -3,
      tBadge: 0.58,
    },
    {
      id: "interviewers",
      targetAnchor: document.getElementById("erdTargetInterviewersId"),
      card: document.getElementById("cardCandidateInterviewers"),
      color: "#3b82f6",
      marker: "url(#candidateErdArrowBlue)",
      label: "1 : N (candidate_id)",
      y1Offset: 4,
      tBadge: 0.42,
    },
    {
      id: "docs",
      targetAnchor: document.getElementById("erdTargetDocsId"),
      card: document.getElementById("cardCandidateDocs"),
      color: "#a855f7",
      marker: "url(#candidateErdArrowPurple)",
      label: "1 : N (candidate_id)",
      y1Offset: 11,
      tBadge: 0.65,
    },
  ];

  let currentActiveRel = "all";

  function drawCandidateErdRelations() {
    if (!wrapper || !svgGroup || !originAnchor) return;

    const wrapRect = wrapper.getBoundingClientRect();
    if (wrapRect.width === 0 || wrapRect.height === 0) return;

    if (window.innerWidth < 1024) {
      svgGroup.innerHTML = "";
      return;
    }

    const origRect = originAnchor.getBoundingClientRect();

    // Origin point: Right edge center of candidates.id row
    const x1 = origRect.right - wrapRect.left;
    const y1 = origRect.top + origRect.height / 2 - wrapRect.top;

    let svgHtml = "";

    relationConfigs.forEach((cfg) => {
      if (!cfg.targetAnchor) return;
      const tgtRect = cfg.targetAnchor.getBoundingClientRect();
      if (tgtRect.width === 0) return;

      const isSideBySide = tgtRect.left > origRect.left + 50;
      let d = "";
      let midX = 0;
      let midY = 0;

      if (isSideBySide) {
        // Target: Left edge center of child candidate_id row
        const x2 = tgtRect.left - wrapRect.left;
        const y2 = tgtRect.top + tgtRect.height / 2 - wrapRect.top;
        const startY = y1 + (cfg.y1Offset || 0);
        const dx = Math.max(40, (x2 - x1) * 0.45);
        d = `M ${x1} ${startY} C ${x1 + dx} ${startY}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

        const p0 = { x: x1, y: startY };
        const p1 = { x: x1 + dx, y: startY };
        const p2 = { x: x2 - dx, y: y2 };
        const p3 = { x: x2, y: y2 };
        const badgePos = getBezierPoint(cfg.tBadge || 0.5, p0, p1, p2, p3);
        midX = badgePos.x;
        midY = badgePos.y;
      } else {
        // Stacked (Mobile view)
        const x1B = origRect.left + origRect.width / 2 - wrapRect.left;
        const y1B = origRect.bottom - wrapRect.top;
        const x2T = tgtRect.left + tgtRect.width / 2 - wrapRect.left;
        const y2T = tgtRect.top - wrapRect.top;
        const dy = Math.max(25, (y2T - y1B) * 0.4);
        d = `M ${x1B} ${y1B} C ${x1B} ${y1B + dy}, ${x2T} ${y2T - dy}, ${x2T} ${y2T}`;
        midX = (x1B + x2T) / 2;
        midY = (y1B + y2T) / 2;
      }

      const isCurrentActive = currentActiveRel === "all" || currentActiveRel === cfg.id;
      const opacity = isCurrentActive ? 1 : 0.12;
      const strokeWidth = isCurrentActive && currentActiveRel !== "all" ? 3 : 2;

      svgHtml += `
        <g class="erd-relation-path-group" data-rel-id="${cfg.id}" style="opacity: ${opacity};">
          <!-- Glow halo -->
          <path d="${d}" stroke="${cfg.color}" stroke-width="7" fill="none" opacity="0.18" stroke-linecap="round" />
          <!-- Animated connecting line -->
          <path d="${d}" stroke="${cfg.color}" stroke-width="${strokeWidth}" fill="none" 
            marker-start="url(#candidateErdDotStart)" marker-end="${cfg.marker}" 
            stroke-dasharray="6 3" class="erd-relation-path" />
          <!-- Center badge -->
          <g transform="translate(${midX}, ${midY})">
            <rect x="-34" y="-9" width="68" height="18" rx="6" fill="#ffffff" stroke="${cfg.color}" stroke-width="1.5" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.1))" />
            <text x="0" y="3.5" text-anchor="middle" font-size="9" font-family="'JetBrains Mono', monospace" font-weight="700" fill="${cfg.color}">
              1 : N
            </text>
          </g>
        </g>
      `;
    });

    svgGroup.innerHTML = svgHtml;

    // Attach click to each SVG path group
    svgGroup.querySelectorAll(".erd-relation-path-group").forEach((grp) => {
      grp.addEventListener("click", () => {
        const relId = grp.getAttribute("data-rel-id");
        if (relId) setActiveRelation(relId === currentActiveRel ? "all" : relId);
      });
    });
  }

  function setActiveRelation(relId) {
    currentActiveRel = relId;

    // Update Pills
    document.querySelectorAll("#candidateErdTabVisualContent .erd-rel-pill").forEach((pill) => {
      const pRel = pill.getAttribute("data-rel");
      if (pRel === relId) {
        pill.classList.add("active");
      } else {
        pill.classList.remove("active");
      }
    });

    // Update Card Highlight states
    relationConfigs.forEach((cfg) => {
      if (!cfg.card) return;
      if (relId === "all") {
        cfg.card.classList.remove("relation-highlight", "relation-faded");
      } else if (cfg.id === relId) {
        cfg.card.classList.add("relation-highlight");
        cfg.card.classList.remove("relation-faded");
      } else {
        cfg.card.classList.remove("relation-highlight");
        cfg.card.classList.add("relation-faded");
      }
    });

    drawCandidateErdRelations();
  }

  // Relation Filter Pills Click
  document.querySelectorAll("#candidateErdTabVisualContent .erd-rel-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const rel = pill.getAttribute("data-rel") || "all";
      setActiveRelation(rel);
    });
  });

  // Modal Shown Event Listener
  modalEl.addEventListener("shown.bs.modal", () => {
    setTimeout(drawCandidateErdRelations, 80);
  });

  // Tab switch redraw
  tabVisualBtn?.addEventListener("click", () => {
    setTimeout(drawCandidateErdRelations, 80);
  });

  // Window resize redraw (debounced)
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawCandidateErdRelations, 100);
  });

  // Initial draw
  setTimeout(drawCandidateErdRelations, 300);
}

