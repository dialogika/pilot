import {
  getInterviewScheduleStatus,
  filterAndSortInterviewSchedules
} from "../../../element/recruitment-interview-utils.js";

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
          <div class="candidate-extra-item candidate-extra-item-schedule" style="border-left:3px solid #10b981">
            <div class="schedule-compact-header"><i class="fa-solid fa-graduation-cap"></i><span>Jadwal OJT</span></div>
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
    onboardingSectionHtml = `
      <div class="candidate-selection-meta mt-2">
        <div class="candidate-interview-meta">
          <div class="candidate-extra-item candidate-extra-item-schedule" style="border-left:3px solid #6366f1">
            <div class="schedule-compact-header"><i class="fa-solid fa-user-check"></i><span>On Boarding</span></div>
            <div class="schedule-compact-details">
              <div class="schedule-compact-row"><span>Tanggal</span><strong>${onbDateDisplay}</strong></div>
              <div class="schedule-compact-row"><span>Jam</span><strong>${onbTimeDisplay}</strong></div>
              <div class="schedule-compact-row"><span>Lokasi</span><strong>${onbLocationDisplay}</strong></div>
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
