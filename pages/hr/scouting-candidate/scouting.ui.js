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
  if (normalized === "respond" || normalized === "replied") return "respond";
  if (normalized === "on job test" || normalized === "ojt") return "ojt";
  return normalized || "radar";
}

/**
 * Normalize status string for form select value.
 * @param {string} status
 * @returns {string}
 */
export function mapToSelectStatus(status) {
  const normalized = (status || "").toString().trim().toLowerCase();
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

