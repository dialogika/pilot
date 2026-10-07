// pilot/pages/hr/scouting-candidate/scouting.ui.js
// =====================================================================
// UI MODULE: Scouting Candidate
//
// Responsibilities:
// - DOM rendering of Candidate Cards (Grid View) & Table Rows (List View)
// - Status dropdown selector generation
// - Assignee avatar badges and tooltips
// - Modal form population & photo preview handling
// - Tooltips and image compression helpers
//
// Rules:
// - NO direct Firestore queries or mutations
// =====================================================================

const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=800";

export const STATUS_OPTIONS = [
  { value: "radar", label: "Radar" },
  { value: "contacted", label: "Contacted" },
  { value: "followup", label: "Follow Up" },
  { value: "replied", label: "Respond" },
  { value: "interview", label: "Interview" },
  { value: "ojt", label: "On Job Test" },
  { value: "decision", label: "Decision" },
  { value: "rejected", label: "Rejected" },
  { value: "accepted", label: "Accepted" },
];

/**
 * Escape HTML to prevent XSS.
 * @param {*} str
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
 * Normalize status string for filter comparison.
 * @param {string} status
 * @returns {string}
 */
export function mapToFilterStatus(status) {
  const normalized = (status || "").toString().trim().toLowerCase();
  if (normalized === "follow up" || normalized === "follow_up" || normalized === "followup") return "followup";
  if (normalized === "respond" || normalized === "replied") return "respond";
  if (normalized === "on job test" || normalized === "ojt") return "ojt";
  if (normalized === "accept" || normalized === "accepted") return "accepted";
  if (normalized === "reject" || normalized === "rejected") return "rejected";
  return normalized || "radar";
}

/**
 * Normalize status string for form select value.
 * @param {string} status
 * @returns {string}
 */
export function mapToSelectStatus(status) {
  const normalized = (status || "").toString().trim().toLowerCase();
  if (normalized === "follow up" || normalized === "follow_up" || normalized === "followup") return "followup";
  if (normalized === "respond" || normalized === "replied") return "replied";
  if (normalized === "on job test" || normalized === "ojt") return "ojt";
  return normalized || "radar";
}

/**
 * Convert ISO string to format required by datetime-local input.
 * @param {string} isoString
 * @returns {string}
 */
export function isoToDatetimeLocal(isoString) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (_) {
    return "";
  }
}

/**
 * Build assignee stacked circular avatars.
 * @param {Array<string>} userIds
 * @param {Object} assignUsersMap
 * @returns {string}
 */
export function buildAssignAvatarStack(userIds, assignUsersMap = {}) {
  const ids = Array.isArray(userIds) ? userIds : [];
  const valid = ids.filter((uid) => assignUsersMap[uid]);
  if (!valid.length) return "";

  const maxShown = 3;
  const shownIds = valid.slice(0, maxShown);
  let html = '<div class="assign-avatar-stack">';

  shownIds.forEach((uid) => {
    const u = assignUsersMap[uid] || {};
    const name = escapeHtml(u.name || "User");
    const photo = u.photo || "";
    const initials = (u.name || "")
      .split(" ")
      .map((part) => part[0])
      .join("")
      .substring(0, 2)
      .toUpperCase() || "U";

    if (photo) {
      html +=
        '<div class="assign-avatar-circle" data-bs-toggle="tooltip" title="' +
        name +
        '"><img src="' +
        photo +
        '" alt="' +
        name +
        '"></div>';
    } else {
      html +=
        '<div class="assign-avatar-circle assign-avatar-initials" data-bs-toggle="tooltip" title="' +
        name +
        '">' +
        initials +
        "</div>";
    }
  });

  html += "</div>";
  return html;
}

/**
 * Build status dropdown options HTML.
 * @param {string} currentStatus
 * @returns {string}
 */
export function buildStatusOptionsHtml(currentStatus) {
  const selectValue = mapToSelectStatus(currentStatus);
  return STATUS_OPTIONS.map((opt) => {
    const isSelected = selectValue === opt.value ? " selected" : "";
    return `<option value="${opt.value}"${isSelected}>${opt.label}</option>`;
  }).join("");
}

/**
 * Get channel font awesome icon.
 * @param {string} channelType
 * @returns {string}
 */
export function getChannelIcon(channelType) {
  const type = (channelType || "").toLowerCase();
  if (type === "facebook") return "fab fa-facebook-f";
  if (type === "instagram") return "fab fa-instagram";
  if (type === "tiktok") return "fab fa-tiktok";
  return "fab fa-linkedin-in";
}

/**
 * Build single candidate Grid Card HTML.
 * @param {Object} talent
 * @param {Object} assignUsersMap
 * @returns {string}
 */
export function buildCandidateCardHtml(talent, assignUsersMap = {}) {
  const basic = talent.basic_info || {};
  const scouting = talent.scouting_info || {};
  const recruitment = talent.recruitment_status || {};

  const name = escapeHtml(basic.full_name || scouting.full_name || "Tanpa Nama");
  const role = escapeHtml(basic.current_role || scouting.role_name || "");
  const position = escapeHtml(scouting.position_name || "");
  const avatarUrl = basic.avatar_url || DEFAULT_AVATAR;
  const channelType = scouting.channel_type || "linkedin";
  const channelUrl = escapeHtml(scouting.channel_url || "#");
  const talentId = escapeHtml(talent.id || "");
  const currentStatus = recruitment.current || "radar";
  const filterStatus = mapToFilterStatus(currentStatus);
  const selectValue = mapToSelectStatus(currentStatus);
  const dueIso = scouting.interview_due || "";

  const assignedTo = Array.isArray(scouting.assigned_to)
    ? scouting.assigned_to.filter(Boolean)
    : [];
  const assignAvatarHtml = buildAssignAvatarStack(assignedTo, assignUsersMap);
  const assignBadgeHtml = assignAvatarHtml
    ? `<div class="img-assign-badge">${assignAvatarHtml}</div>`
    : "";

  const subtitleParts = [];
  if (role) subtitleParts.push(role);
  if (position) subtitleParts.push(position);
  const subtitle = subtitleParts.join(" | ");

  const channelIcon = getChannelIcon(channelType);
  const statusOptionsHtml = buildStatusOptionsHtml(currentStatus);

  return `
    <div class="col-12 col-md-6 col-lg-4 candidate-item" data-name="${name}" data-talent-id="${talentId}" data-status="${filterStatus}" data-phase="${selectValue}" data-due-date="${dueIso}">
      <div class="candidate-card">
        <div class="img-wrapper">
          <img src="${avatarUrl}" class="candidate-img" alt="${name}">
          <div class="card-action-menu dropdown">
            <button class="btn btn-light btn-sm" type="button" data-bs-toggle="dropdown" aria-expanded="false">
              <i class="fas fa-ellipsis-v"></i>
            </button>
            <ul class="dropdown-menu dropdown-menu-end shadow-sm">
              <li><button class="dropdown-item candidate-edit-btn" type="button" data-id="${talentId}"><i class="fas fa-pen me-2 text-muted"></i>Edit</button></li>
              <li><button class="dropdown-item text-danger candidate-delete-btn" type="button" data-id="${talentId}"><i class="fas fa-trash me-2"></i>Delete</button></li>
            </ul>
          </div>
          <div class="social-tags">
            <a href="${channelUrl}" target="_blank" rel="noopener noreferrer" class="tag-icon" title="${channelType}">
              <i class="${channelIcon}"></i>
            </a>
          </div>
          ${assignBadgeHtml}
        </div>
        <div class="p-4 d-flex flex-column flex-grow-1">
          <div class="mb-3">
            <h5 class="fw-bold mb-1 candidate-name text-slate-800">${name}</h5>
            <small class="text-slate-500">${subtitle || "-"}</small>
          </div>
          <div class="status-box mt-auto pt-2 border-t border-slate-100">
            <select class="form-select status-select" data-talent-id="${talentId}">
              ${statusOptionsHtml}
            </select>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Build single candidate List View Table Row HTML.
 * @param {Object} talent
 * @param {Object} assignUsersMap
 * @returns {string}
 */
export function buildCandidateRowHtml(talent, assignUsersMap = {}) {
  const basic = talent.basic_info || {};
  const scouting = talent.scouting_info || {};
  const recruitment = talent.recruitment_status || {};

  const name = escapeHtml(basic.full_name || scouting.full_name || "Tanpa Nama");
  const role = escapeHtml(basic.current_role || scouting.role_name || "");
  const position = escapeHtml(scouting.position_name || "");
  const avatarUrl = basic.avatar_url || DEFAULT_AVATAR;
  const channelType = scouting.channel_type || "linkedin";
  const channelUrl = escapeHtml(scouting.channel_url || "#");
  const talentId = escapeHtml(talent.id || "");
  const currentStatus = recruitment.current || "radar";
  const filterStatus = mapToFilterStatus(currentStatus);
  const selectValue = mapToSelectStatus(currentStatus);
  const dueIso = scouting.interview_due || "";
  const dueLocalVal = isoToDatetimeLocal(dueIso);

  const assignedTo = Array.isArray(scouting.assigned_to)
    ? scouting.assigned_to.filter(Boolean)
    : [];
  const assignAvatarHtml = buildAssignAvatarStack(assignedTo, assignUsersMap);

  const subtitleParts = [];
  if (role) subtitleParts.push(role);
  if (position) subtitleParts.push(position);
  const subtitle = subtitleParts.join(" | ");

  const channelIcon = getChannelIcon(channelType);
  const statusOptionsHtml = buildStatusOptionsHtml(currentStatus);

  return `
    <tr class="candidate-row" data-name="${name}" data-talent-id="${talentId}" data-status="${filterStatus}" data-phase="${selectValue}" data-due-date="${dueIso}">
      <td class="ps-4">
        <div class="d-flex align-items-center">
          <img src="${avatarUrl}" class="list-img" alt="${name}">
          <div>
            <div class="fw-bold candidate-name text-slate-800">${name}</div>
            <small class="text-slate-500">${subtitle || "-"}</small>
          </div>
        </div>
      </td>
      <td>
        <a href="${channelUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-light border" title="${channelType}">
          <i class="${channelIcon}"></i>
        </a>
      </td>
      <td>
        <select class="form-select status-select form-select-sm" data-talent-id="${talentId}">
          ${statusOptionsHtml}
        </select>
      </td>
      <td style="max-width: 200px;">
        <input type="datetime-local" class="form-control form-control-sm due-input" value="${dueLocalVal}" data-talent-id="${talentId}">
      </td>
      <td>
        ${assignAvatarHtml || '<span class="text-slate-400 text-xs">-</span>'}
      </td>
      <td class="text-center">
        <div class="dropdown">
          <button class="btn btn-light btn-sm" type="button" data-bs-toggle="dropdown" aria-expanded="false">
            <i class="fas fa-ellipsis-v"></i>
          </button>
          <ul class="dropdown-menu dropdown-menu-end shadow-sm">
            <li><button class="dropdown-item candidate-edit-btn" type="button" data-id="${talentId}"><i class="fas fa-pen me-2 text-muted"></i>Edit</button></li>
            <li><button class="dropdown-item text-danger candidate-delete-btn" type="button" data-id="${talentId}"><i class="fas fa-trash me-2"></i>Delete</button></li>
          </ul>
        </div>
      </td>
    </tr>
  `;
}

/**
 * Render all talents into grid and list view containers.
 * @param {Array<Object>} talents
 * @param {Object} assignUsersMap
 */
export function renderTalents(talents, assignUsersMap = {}) {
  const gridContainer = document.getElementById("gridView");
  const listTbody = document.querySelector("#listView tbody");

  if (!gridContainer || !listTbody) return;

  if (!talents || !talents.length) {
    gridContainer.innerHTML =
      '<div class="col-12 py-5 text-center text-muted small">Belum ada data kandidat scouting yang dapat ditampilkan.</div>';
    listTbody.innerHTML =
      '<tr><td colspan="6" class="text-center text-muted small py-4">Belum ada data kandidat scouting yang dapat ditampilkan.</td></tr>';
    return;
  }

  gridContainer.innerHTML = talents
    .map((t) => buildCandidateCardHtml(t, assignUsersMap))
    .join("");

  listTbody.innerHTML = talents
    .map((t) => buildCandidateRowHtml(t, assignUsersMap))
    .join("");

  refreshTooltips();
}

/**
 * Render assign users checkbox dropdown in Add/Edit modal.
 * @param {Object} assignUsersMap
 * @param {Array<string>} selectedUserIds
 */
export function renderAssignUsersDropdown(assignUsersMap = {}, selectedUserIds = []) {
  const container = document.getElementById("candidateAssignUsers");
  const hiddenInput = document.getElementById("candidateAssignInput");
  const display = document.getElementById("assignDisplay");

  if (!container || !hiddenInput) return;
  container.innerHTML = "";

  const selectedSet = new Set(selectedUserIds);

  Object.keys(assignUsersMap).forEach((id) => {
    const user = assignUsersMap[id] || {};
    const name = user.name || "User";
    const photo = user.photo || "";

    const isChecked = selectedSet.has(id);

    const item = document.createElement("div");
    item.className = `assign-user-item ${isChecked ? "active" : ""}`;
    item.dataset.userId = id;
    item.dataset.name = name;

    let avatarHtml;
    if (photo) {
      avatarHtml = `<img src="${photo}" class="assign-user-avatar" alt="${name}">`;
    } else {
      const initials = name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .substring(0, 2)
        .toUpperCase() || "U";
      avatarHtml = `<div class="assign-user-initials">${initials}</div>`;
    }

    item.innerHTML = `
      <div class="assign-user-left">
        ${avatarHtml}
        <span class="assign-user-name">${escapeHtml(name)}</span>
      </div>
      <div class="assign-user-checkbox">
        <input type="checkbox" ${isChecked ? "checked" : ""}>
      </div>
    `;

    container.appendChild(item);
  });

  updateAssignDisplay(assignUsersMap, selectedUserIds);
}

/**
 * Update the assign dropdown display text label.
 * @param {Object} assignUsersMap
 * @param {Array<string>} selectedIds
 */
export function updateAssignDisplay(assignUsersMap = {}, selectedIds = []) {
  const display = document.getElementById("assignDisplay");
  const hiddenInput = document.getElementById("candidateAssignInput");
  if (!display || !hiddenInput) return;

  hiddenInput.value = selectedIds.join(",");

  if (selectedIds.length === 0) {
    display.textContent = "Pilih assign...";
    display.classList.remove("has-value");
  } else {
    const names = selectedIds.map(
      (uid) => assignUsersMap[uid]?.name || "User"
    );
    const shown = names.slice(0, 2);
    const extra = names.length - shown.length;
    const label = extra > 0 ? `${shown.join(", ")} +${extra}` : shown.join(", ");
    display.textContent = label;
    display.classList.add("has-value");
  }
}

/**
 * Populate role options select dropdown.
 * @param {Array<{ id: string, name: string }>} roles
 */
export function populateRolesSelect(roles = []) {
  const select = document.getElementById("candidateRoleInput");
  if (!select) return;
  select.innerHTML = '<option value="">Pilih role</option>' +
    roles.map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join("");
}

/**
 * Populate position options select dropdown.
 * @param {Array<{ id: string, name: string }>} positions
 */
export function populatePositionsSelect(positions = []) {
  const select = document.getElementById("candidatePositionSelect");
  if (!select) return;
  select.innerHTML = '<option value="">Pilih posisi</option>' +
    positions.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
}

/**
 * Update photo status text indicator.
 * @param {string} state - 'idle' | 'processing' | 'ready' | 'success' | 'error'
 * @param {string} text
 */
export function setPhotoState(state, text) {
  const photoStatusEl = document.getElementById("photoStatusText");
  const photoStatusIcon = document.getElementById("photoStatusIcon");
  if (!photoStatusEl || !photoStatusIcon) return;

  photoStatusEl.textContent = text || "";
  if (state === "idle") {
    photoStatusIcon.style.visibility = "hidden";
    photoStatusEl.style.color = "#374151";
  } else if (state === "processing") {
    photoStatusIcon.style.visibility = "visible";
    photoStatusIcon.style.animation = "spin 0.8s linear infinite";
    photoStatusEl.style.color = "#1e88e5";
  } else if (state === "ready" || state === "success") {
    photoStatusIcon.style.visibility = "hidden";
    photoStatusEl.style.color = "#059669";
  } else if (state === "error") {
    photoStatusIcon.style.visibility = "hidden";
    photoStatusEl.style.color = "#dc2626";
  }
}

/**
 * Compress an image file to max dimensions with JPEG quality.
 * @param {File} file
 * @param {number} [maxDim=400]
 * @param {number} [quality=0.85]
 * @returns {Promise<Blob>}
 */
export async function compressImage(file, maxDim = 400, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      const scale = Math.min(1, maxDim / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to compress image"));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = reject;
    const reader = new FileReader();
    reader.onload = () => {
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Re-initialize Bootstrap tooltips across the document.
 */
export function refreshTooltips() {
  if (typeof bootstrap !== "undefined" && bootstrap.Tooltip) {
    const tooltipTriggerList = [].slice.call(
      document.querySelectorAll('[data-bs-toggle="tooltip"]')
    );
    tooltipTriggerList.forEach((el) => {
      try {
        bootstrap.Tooltip.getOrCreateInstance(el);
      } catch (_) {}
    });
  }
}

/**
 * Render pagination controls for Scouting Candidates.
 * @param {Object} info - { currentPage, totalRows, rowsPerPage, totalPages }
 * @param {Function} onPageChange - (newPage) => void
 */
export function renderPagination(info, onPageChange) {
  const container = document.getElementById("scoutingPagination");
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

  const left = `<p class="scouting-pagination-meta text-slate-500 font-medium text-xs mb-0">Menampilkan <span class="fw-bold text-slate-700">${start}</span> - <span class="fw-bold text-slate-700">${end}</span> dari <span class="fw-bold text-slate-700">${totalRows}</span> kandidat</p>`;

  let pages = "";
  const prevDisabled = currentPage <= 1;
  pages += `
    <button type="button" class="candidate-page-btn candidate-page-nav" data-page="prev" ${prevDisabled ? "disabled" : ""} title="Halaman Sebelumnya">
      <i class="fas fa-chevron-left text-xs"></i>
    </button>
  `;

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

// =====================================================================
// EXPORT MODAL UI HELPERS
// =====================================================================

let currentExportFormat = "xlsx";
let currentExportRange = "all";

export function getMonthNameIndo(monthNum) {
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  return months[monthNum] || "Bulan";
}

export function setExportFileFormat(format) {
  currentExportFormat = format === "csv" ? "csv" : "xlsx";
  const btnXlsx = document.getElementById("btnFormatXlsx");
  const btnCsv = document.getElementById("btnFormatCsv");
  const downloadBtnText = document.getElementById("downloadBtnText");
  const exportAllHelpText = document.getElementById("exportAllHelpText");
  const exportMonthHelpText = document.getElementById("exportMonthHelpText");
  const exportWeekHelpText = document.getElementById("exportWeekHelpText");

  if (currentExportFormat === "xlsx") {
    if (btnXlsx) btnXlsx.classList.add("active");
    if (btnCsv) btnCsv.classList.remove("active");
    if (downloadBtnText) downloadBtnText.textContent = "Download Excel (.xlsx)";
    if (exportAllHelpText) exportAllHelpText.textContent = "Semua data kandidat dari awal hingga saat ini akan dimasukkan ke dalam file export tanpa batasan tanggal.";
    if (exportMonthHelpText) exportMonthHelpText.textContent = "Semua pengajuan pada bulan yang dipilih akan dimasukkan ke dalam file Excel.";
    if (exportWeekHelpText) exportWeekHelpText.textContent = "Semua pengajuan pada minggu yang dipilih akan dimasukkan ke dalam file Excel.";
  } else {
    if (btnCsv) btnCsv.classList.add("active");
    if (btnXlsx) btnXlsx.classList.remove("active");
    if (downloadBtnText) downloadBtnText.textContent = "Download CSV (.csv)";
    if (exportAllHelpText) exportAllHelpText.textContent = "Semua data kandidat dari awal hingga saat ini akan dimasukkan ke dalam file export tanpa batasan tanggal.";
    if (exportMonthHelpText) exportMonthHelpText.textContent = "Semua pengajuan pada bulan yang dipilih akan dimasukkan ke dalam file CSV.";
    if (exportWeekHelpText) exportWeekHelpText.textContent = "Semua pengajuan pada minggu yang dipilih akan dimasukkan ke dalam file CSV.";
  }
}

export function setExportRangeType(rangeType) {
  currentExportRange = ["all", "month", "week"].includes(rangeType) ? rangeType : "all";
  const rangeBtnAll = document.getElementById("btnRangeAll");
  const rangeBtnMonth = document.getElementById("btnRangeMonth");
  const rangeBtnWeek = document.getElementById("btnRangeWeek");
  const sectionAll = document.getElementById("sectionAllPicker");
  const sectionMonth = document.getElementById("sectionMonthPicker");
  const sectionWeek = document.getElementById("sectionWeekPicker");

  if (rangeBtnAll) rangeBtnAll.classList.toggle("active", currentExportRange === "all");
  if (rangeBtnMonth) rangeBtnMonth.classList.toggle("active", currentExportRange === "month");
  if (rangeBtnWeek) rangeBtnWeek.classList.toggle("active", currentExportRange === "week");

  if (sectionAll) sectionAll.style.display = currentExportRange === "all" ? "block" : "none";
  if (sectionMonth) sectionMonth.style.display = currentExportRange === "month" ? "block" : "none";
  if (sectionWeek) sectionWeek.style.display = currentExportRange === "week" ? "block" : "none";
}

export function initExportModalUI(onFormatChange, onRangeChange) {
  const currentYearMonth = new Date().toISOString().substring(0, 7);
  const exportMonthInput = document.getElementById("exportMonthInput");
  const exportWeekMonthInput = document.getElementById("exportWeekMonthInput");

  if (exportMonthInput && !exportMonthInput.value) exportMonthInput.value = currentYearMonth;
  if (exportWeekMonthInput && !exportWeekMonthInput.value) exportWeekMonthInput.value = currentYearMonth;

  const btnXlsx = document.getElementById("btnFormatXlsx");
  const btnCsv = document.getElementById("btnFormatCsv");
  const rangeBtnAll = document.getElementById("btnRangeAll");
  const rangeBtnMonth = document.getElementById("btnRangeMonth");
  const rangeBtnWeek = document.getElementById("btnRangeWeek");

  if (btnXlsx) {
    btnXlsx.onclick = () => {
      setExportFileFormat("xlsx");
      if (typeof onFormatChange === "function") onFormatChange("xlsx");
    };
  }
  if (btnCsv) {
    btnCsv.onclick = () => {
      setExportFileFormat("csv");
      if (typeof onFormatChange === "function") onFormatChange("csv");
    };
  }

  if (rangeBtnAll) {
    rangeBtnAll.onclick = () => {
      setExportRangeType("all");
      if (typeof onRangeChange === "function") onRangeChange("all");
    };
  }
  if (rangeBtnMonth) {
    rangeBtnMonth.onclick = () => {
      setExportRangeType("month");
      if (typeof onRangeChange === "function") onRangeChange("month");
    };
  }
  if (rangeBtnWeek) {
    rangeBtnWeek.onclick = () => {
      setExportRangeType("week");
      if (typeof onRangeChange === "function") onRangeChange("week");
    };
  }

  setExportFileFormat("xlsx");
  setExportRangeType("all");
}

export function getExportFormData() {
  const monthInput = document.getElementById("exportMonthInput");
  const weekMonthInput = document.getElementById("exportWeekMonthInput");
  const weekSelect = document.getElementById("exportWeekSelect");
  const statusFilter = document.getElementById("exportStatusFilter");

  return {
    format: currentExportFormat,
    rangeType: currentExportRange,
    month: monthInput?.value || new Date().toISOString().substring(0, 7),
    weekMonth: weekMonthInput?.value || new Date().toISOString().substring(0, 7),
    week: parseInt(weekSelect?.value || "1", 10),
    status: (statusFilter?.value || "").toLowerCase().trim(),
  };
}

export function setExportButtonLoading(loading) {
  const submitBtn = document.getElementById("btnDownloadExport");
  if (!submitBtn) return;
  if (loading) {
    submitBtn.disabled = true;
    submitBtn.dataset.originalHtml = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Memproses...';
  } else {
    submitBtn.disabled = false;
    if (submitBtn.dataset.originalHtml) {
      submitBtn.innerHTML = submitBtn.dataset.originalHtml;
    }
  }
}

// =====================================================================
// DATABASE MAPPING & SCHEMA ERD CONTROLS (SCOUTING CANDIDATE)
// =====================================================================

function showScoutingToast(msg) {
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
 * when Scouting Candidate is active.
 */
export function mountSidebarScoutingErdButton() {
  const sidebarWrapper = document.querySelector("#dg-sidebar-mount .sidebar-scroll-wrapper");
  if (!sidebarWrapper) return;

  // Prevent duplicate mounts
  if (document.getElementById("sidebarBtnScoutingErd")) return;

  const linkEl = document.createElement("a");
  linkEl.href = "javascript:void(0)";
  linkEl.className = "sidebar-link";
  linkEl.id = "sidebarBtnScoutingErd";
  linkEl.setAttribute("data-bs-toggle", "modal");
  linkEl.setAttribute("data-bs-target", "#scoutingErdModal");
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
 * Initializes Scouting Candidate ERD modal tabs, search, filters, SVG connectors & copy button.
 */
export function initScoutingErdModalControls() {
  const modalEl = document.getElementById("scoutingErdModal");
  if (!modalEl) return;

  // Tab controls
  const tabVisualBtn = document.getElementById("tabBtnScoutingErdVisual");
  const tabDictBtn = document.getElementById("tabBtnScoutingErdDict");
  const tabSqlBtn = document.getElementById("tabBtnScoutingErdSql");

  const tabVisualContent = document.getElementById("scoutingErdTabVisualContent");
  const tabDictContent = document.getElementById("scoutingErdTabDictContent");
  const tabSqlContent = document.getElementById("scoutingErdTabSqlContent");

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
        setTimeout(drawScoutingErdRelations, 80);
      }
    });
  });

  // Kamus Data (Data Dictionary) Search & Table Filter
  const searchInput = document.getElementById("scoutingErdDictSearchInput");
  const tableFilter = document.getElementById("scoutingErdDictTableFilter");
  const dictTableBody = document.getElementById("scoutingErdDictTableBody");
  const countBadge = document.getElementById("scoutingErdDictCountBadge");

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
  const btnCopySql = document.getElementById("btnCopyScoutingSqlScript");
  const btnCopyText = document.getElementById("btnCopyScoutingSqlText");
  const sqlContent = document.getElementById("scoutingSqlScriptContent");

  if (btnCopySql && sqlContent) {
    btnCopySql.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(sqlContent.textContent || "");
        if (btnCopyText) btnCopyText.textContent = "Tersalin!";
        showScoutingToast("Script SQL DDL berhasil disalin ke clipboard!");
        setTimeout(() => {
          if (btnCopyText) btnCopyText.textContent = "Salin Script SQL";
        }, 2500);
      } catch (err) {
        console.error("Gagal menyalin SQL:", err);
      }
    });
  }

  // Copy Obsidian Docs Path Button
  const btnCopyDocs = document.getElementById("btnCopyScoutingDocsPath");
  if (btnCopyDocs) {
    btnCopyDocs.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText("docs/SCOUTING-DATABASE-MAPPING.md");
        showScoutingToast("Path docs/SCOUTING-DATABASE-MAPPING.md tersalin!");
      } catch (e) {
        console.error("Gagal menyalin path:", e);
      }
    });
  }

  // =====================================================================
  // DYNAMIC SVG RELATIONS (LINES & ARROWS)
  // =====================================================================
  const wrapper = document.getElementById("scoutingErdDiagramWrapper");
  const svgGroup = document.getElementById("scoutingErdPathsGroup");
  const originAnchor = document.getElementById("erdOriginScoutingId");

  const relationConfigs = [
    {
      id: "assignees",
      targetAnchor: document.getElementById("erdTargetAssigneesId"),
      card: document.getElementById("cardScoutingAssignees"),
      color: "#3b82f6",
      marker: "url(#scoutingErdArrowBlue)",
      label: "1 : N (talent_id)",
      y1Offset: -10,
      tBadge: 0.35,
    },
    {
      id: "history",
      targetAnchor: document.getElementById("erdTargetHistoryId"),
      card: document.getElementById("cardScoutingHistory"),
      color: "#f59e0b",
      marker: "url(#scoutingErdArrowAmber)",
      label: "1 : N (talent_id)",
      y1Offset: -3,
      tBadge: 0.58,
    },
    {
      id: "logs",
      targetAnchor: document.getElementById("erdTargetLogsId"),
      card: document.getElementById("cardScoutingLogs"),
      color: "#10b981",
      marker: "url(#scoutingErdArrowEmerald)",
      label: "1 : N (talent_id)",
      y1Offset: 4,
      tBadge: 0.42,
    },
    {
      id: "evaluations",
      targetAnchor: document.getElementById("erdTargetEvaluationsId"),
      card: document.getElementById("cardScoutingEvaluations"),
      color: "#a855f7",
      marker: "url(#scoutingErdArrowPurple)",
      label: "1 : N (talent_id)",
      y1Offset: 11,
      tBadge: 0.65,
    },
  ];

  let currentActiveRel = "all";

  function drawScoutingErdRelations() {
    if (!wrapper || !svgGroup || !originAnchor) return;

    const wrapRect = wrapper.getBoundingClientRect();
    if (wrapRect.width === 0 || wrapRect.height === 0) return;

    if (window.innerWidth < 1024) {
      svgGroup.innerHTML = "";
      return;
    }

    const origRect = originAnchor.getBoundingClientRect();

    // Origin point: Right edge center of scouting_talents.id row
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
        // Target: Left edge center of child talent_id row
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
            marker-start="url(#scoutingErdDotStart)" marker-end="${cfg.marker}" 
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
    document.querySelectorAll("#scoutingErdTabVisualContent .erd-rel-pill").forEach((pill) => {
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

    drawScoutingErdRelations();
  }

  // Relation Filter Pills Click
  document.querySelectorAll("#scoutingErdTabVisualContent .erd-rel-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const rel = pill.getAttribute("data-rel") || "all";
      setActiveRelation(rel);
    });
  });

  // Modal Shown Event Listener
  modalEl.addEventListener("shown.bs.modal", () => {
    setTimeout(drawScoutingErdRelations, 80);
  });

  // Tab switch redraw
  tabVisualBtn?.addEventListener("click", () => {
    setTimeout(drawScoutingErdRelations, 80);
  });

  // Window resize redraw (debounced)
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawScoutingErdRelations, 100);
  });

  // Initial draw
  setTimeout(drawScoutingErdRelations, 300);
}



