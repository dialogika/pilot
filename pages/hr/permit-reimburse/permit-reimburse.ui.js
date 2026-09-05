// pages/hr/permit-reimburse/permit-reimburse.ui.js
// =====================================================================
// PRESENTATION LAYER: PERMIT & REIMBURSE MANAGEMENT
// Pure DOM rendering and event bindings. Zero Firebase direct access.
// =====================================================================

export function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function parseAnyDate(val) {
  if (!val) return null;
  try {
    if (val instanceof Date) {
      return Number.isNaN(val.getTime()) ? null : val;
    }
    if (typeof val === "number") {
      const d = new Date(val);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (val && typeof val.toDate === "function") {
      return val.toDate();
    }
    if (val && typeof val.seconds === "number") {
      return new Date(val.seconds * 1000);
    }
    const str = String(val).trim();
    if (!str) return null;

    // Check for string representation like Timestamp(seconds=1785822659, nanoseconds=476000000)
    const match = str.match(/seconds\s*=\s*(\d+)/i);
    if (match) {
      return new Date(parseInt(match[1], 10) * 1000);
    }

    // Check YYYY-MM-DD
    if (str.includes("-") && str.length === 10) {
      const parts = str.split("-");
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(str);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch (e) {
    return null;
  }
}

export function formatDateIndonesia(val) {
  if (!val) return "-";
  const d = parseAnyDate(val);
  if (!d) return String(val);

  const namaBulan = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
  ];
  const day = String(d.getDate()).padStart(2, "0");
  const month = namaBulan[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

export function formatDailyDate(dateStr) {
  if (!dateStr) return "-";
  const d = parseAnyDate(dateStr);
  if (!d) return String(dateStr);
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  return `${d.getDate()} ${months[d.getMonth()] || ""} ${d.getFullYear()}`;
}

export function formatDateSlash(val) {
  if (!val) return "";
  const d = parseAnyDate(val);
  if (!d) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function getAvatarUrl(name) {
  const safe = encodeURIComponent(name || "User");
  return `https://ui-avatars.com/api/?name=${safe}&background=4F46E5&color=fff`;
}

export function normalizePermitType(value) {
  const raw = String(value || "").toLowerCase().trim();
  if (raw === "setengah-hari" || raw === "half-day" || raw === "half day") {
    return "half-day";
  }
  return "full-day";
}

export function formatTimeToken(value) {
  return String(value || "").trim().replace(/\./g, ":");
}

export function formatPermitHoursLabel(permit) {
  const hoursRaw = String(permit?.permit_hours || permit?.permit_time_range || "").trim();
  if (!hoursRaw) {
    const start = formatTimeToken(permit?.permit_start_hour);
    const end = formatTimeToken(permit?.permit_end_hour);
    if (start && end) return `${start} - ${end}`;
    return "";
  }
  const cleaned = hoursRaw.replace(/\./g, ":");
  const parts = cleaned.split(/\s*-\s*/).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return `${formatTimeToken(parts[0])} - ${formatTimeToken(parts[1])}`;
  }
  return cleaned;
}

export function getPermitJenisLabel(permit) {
  const hours = formatPermitHoursLabel(permit);
  const type = normalizePermitType(permit?.permit_type);
  if (type === "half-day" || hours) {
    return hours ? `Half Day (${hours})` : "Half Day";
  }
  return "Full Day";
}

export function statusBadge(status) {
  const s = String(status || "pending").toLowerCase();
  if (s === "approved") {
    return `<span class="badge-status badge-approved">APPROVED</span>`;
  }
  if (s === "rejected") {
    return `<span class="badge-status badge-rejected">REJECTED</span>`;
  }
  return `<span class="badge-status badge-pending">PENDING</span>`;
}

/**
 * Renders Permit Management Table
 */
export function renderPermitsTable(items, options = {}) {
  const tbody = document.getElementById("permitTableBody");
  if (!tbody) return;

  if (!items || items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-5">
          <div class="d-flex flex-column align-items-center justify-content-center">
            <i class="bi bi-inbox text-4xl text-slate-300 mb-2"></i>
            <div class="font-bold text-slate-600 mb-1">Belum ada pengajuan izin yang sesuai</div>
            <div class="text-xs text-slate-400">Silakan sesuaikan kata kunci pencarian atau filter status.</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items
    .map((p) => {
      const avatar = p.user_photo || getAvatarUrl(p.user_name);
      const fallbackAvatar = getAvatarUrl(p.user_name);
      const jenis = getPermitJenisLabel(p);
      const isPending = p.status === "pending";
      const hasAttachment = Boolean(p.evidence_url);

      const rowBgClass =
        p.status === "approved"
          ? "row-approved"
          : p.status === "rejected"
            ? "row-rejected"
            : "row-pending";

      const attachmentLink = hasAttachment
        ? `<div class="mt-1"><a href="${escapeHtml(p.evidence_url)}" target="_blank" class="attachment-link"><i class="bi bi-paperclip"></i> Lampiran</a></div>`
        : "";

      return `
        <tr class="${rowBgClass}" data-permit-id="${p.id}">
          <td class="text-center text-xs text-slate-600 whitespace-nowrap">
            ${formatDateIndonesia(p.created_at || p.created_at_ms)}
          </td>
          <td>
            <div class="name-cell">
              <img
                src="${avatar}"
                onerror="this.onerror=null;this.src='${fallbackAvatar}';"
                class="permit-avatar-img"
                alt="${escapeHtml(p.user_name)}"
              />
              <div class="name-text">
                <span class="user-primary-name">${escapeHtml(p.user_name)}</span>
                ${p.division ? `<span class="user-sub-division">${escapeHtml(p.division)}</span>` : ""}
              </div>
            </div>
          </td>
          <td class="text-center text-xs text-slate-800 whitespace-nowrap">
            ${formatDateIndonesia(p.start_date)}
            ${p.end_date && p.end_date !== p.start_date ? `<br><span class="text-[10px] text-slate-400">s/d ${formatDateIndonesia(p.end_date)}</span>` : ""}
          </td>
          <td class="text-center text-xs text-slate-700 whitespace-nowrap">
            ${jenis}
          </td>
          <td class="text-start text-xs text-slate-700 reason-col">
            <div class="reason-text">${escapeHtml(p.reason || "-")}</div>
            ${attachmentLink}
          </td>
          <td class="text-center">
            ${statusBadge(p.status)}
            ${
              p.approved_by_name
                ? `<div class="text-[10px] text-slate-400 mt-1">by ${escapeHtml(p.approved_by_name)}</div>`
                : p.rejected_by_name
                  ? `<div class="text-[10px] text-slate-400 mt-1">by ${escapeHtml(p.rejected_by_name)}</div>`
                  : ""
            }
          </td>
          <td class="text-center">
            <div class="action-vertical-stack">
              ${
                isPending
                  ? `<button type="button" class="action-circle-btn action-circle-emerald btn-approve-permit" data-id="${p.id}" title="Approve Izin">
                       <i class="bi bi-check2"></i>
                     </button>
                     <button type="button" class="action-circle-btn action-circle-rose btn-reject-permit" data-id="${p.id}" title="Reject Izin">
                       <i class="bi bi-x"></i>
                     </button>`
                  : `<div class="dropdown d-inline-block">
                       <button type="button" class="action-circle-btn action-circle-slate dropdown-toggle-btn" data-id="${p.id}" title="Opsi Status">
                         <i class="bi bi-three-dots-vertical"></i>
                       </button>
                       <div class="action-dropdown-menu" id="menu-${p.id}">
                         ${
                           p.status === "rejected"
                             ? `<button type="button" class="action-dropdown-item btn-reapprove-permit" data-id="${p.id}">
                                  <i class="bi bi-check-circle text-emerald-600"></i> Ubah ke Approved
                                </button>`
                             : `<button type="button" class="action-dropdown-item btn-rereject-permit" data-id="${p.id}">
                                  <i class="bi bi-x-circle text-rose-600"></i> Ubah ke Rejected
                                </button>`
                         }
                       </div>
                     </div>`
              }
              <button type="button" class="action-circle-btn action-circle-slate btn-delete-permit" data-id="${p.id}" title="Hapus Pengajuan">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  // Attach table event bindings
  tbody.querySelectorAll(".btn-approve-permit").forEach((btn) => {
    btn.addEventListener("click", () => options.onApprove?.(btn.dataset.id));
  });
  tbody.querySelectorAll(".btn-reject-permit").forEach((btn) => {
    btn.addEventListener("click", () => options.onReject?.(btn.dataset.id));
  });
  tbody.querySelectorAll(".btn-delete-permit").forEach((btn) => {
    btn.addEventListener("click", () => options.onDelete?.(btn.dataset.id));
  });
  tbody.querySelectorAll(".dropdown-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const menu = document.getElementById(`menu-${btn.dataset.id}`);
      document.querySelectorAll(".action-dropdown-menu.show").forEach((m) => {
        if (m !== menu) m.classList.remove("show");
      });
      if (menu) menu.classList.toggle("show");
    });
  });
  tbody.querySelectorAll(".btn-reapprove-permit").forEach((btn) => {
    btn.addEventListener("click", () => options.onReapprove?.(btn.dataset.id));
  });
  tbody.querySelectorAll(".btn-rereject-permit").forEach((btn) => {
    btn.addEventListener("click", () => options.onRereject?.(btn.dataset.id));
  });
}

/**
 * Renders Reimburse Management Table
 */
export function renderReimburseTable(groupedItems, options = {}) {
  const tbody = document.getElementById("reimburseTableBody");
  if (!tbody) return;

  if (!groupedItems || groupedItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-6 text-xs text-slate-400">
          Belum ada data reimburse.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = groupedItems
    .map((item) => {
      const pendingDays = Number(item.pending_days !== undefined ? item.pending_days : item.total_days) || 0;
      const pendingHours = Number(item.pending_hours !== undefined ? item.pending_hours : item.total_hours) || 0;

      const rowBgClass =
        pendingDays === 0
          ? "row-approved"
          : pendingDays >= 5
            ? "row-rejected"
            : "row-pending";

      const avatar = item.user_photo || getAvatarUrl(item.user_name);
      const fallbackAvatar = getAvatarUrl(item.user_name);

      return `
        <tr class="${rowBgClass} table-row" data-group-key="${escapeHtml(item.key)}">
          <td class="text-center" style="width: 80px;">
            <img
              src="${avatar}"
              onerror="this.onerror=null;this.src='${fallbackAvatar}';"
              class="avatar-img"
              alt="${escapeHtml(item.user_name)}"
            />
          </td>
          <td class="text-center">
            <span class="user-primary-name">${escapeHtml(item.user_name || "-")}</span>
          </td>
          <td class="text-center text-slate-800 text-xs">
            ${pendingDays}
          </td>
          <td class="text-center text-slate-800 text-xs">
            ${pendingHours}
          </td>
          <td class="text-center">
            <button
              type="button"
              class="btn-detail-reimburse action-btn"
              data-key="${escapeHtml(item.key)}"
            >
              Detail
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  tbody.querySelectorAll(".btn-detail-reimburse").forEach((btn) => {
    btn.addEventListener("click", () => options.onOpenDetail?.(btn.dataset.key));
  });
}

/**
 * Generic Pagination Renderer
 */
export function renderPagination(state, onPageChange, targetWrapId, targetInfoId, targetControlsId) {
  const wrap = document.getElementById(targetWrapId);
  const info = document.getElementById(targetInfoId);
  const controls = document.getElementById(targetControlsId);
  if (!wrap || !controls) return;

  const { totalItems = 0, pageSize = 10, currentPage = 1 } = state;
  if (totalItems <= pageSize) {
    wrap.style.display = totalItems > 0 ? "flex" : "none";
  } else {
    wrap.style.display = "flex";
  }

  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  if (info) {
    info.textContent = `Menampilkan ${startItem}-${endItem} dari ${totalItems} data`;
  }

  let html = "";
  html += `
    <button type="button" class="page-btn" ${currentPage <= 1 ? "disabled" : ""} data-page="${currentPage - 1}">
      <i class="bi bi-chevron-left"></i>
    </button>
  `;

  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  if (startPage > 1) {
    html += `<button type="button" class="page-btn" data-page="1">1</button>`;
    if (startPage > 2) html += `<span class="page-dots">...</span>`;
  }

  for (let p = startPage; p <= endPage; p++) {
    html += `<button type="button" class="page-btn ${p === currentPage ? "active" : ""}" data-page="${p}">${p}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += `<span class="page-dots">...</span>`;
    html += `<button type="button" class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
  }

  html += `
    <button type="button" class="page-btn" ${currentPage >= totalPages ? "disabled" : ""} data-page="${currentPage + 1}">
      <i class="bi bi-chevron-right"></i>
    </button>
  `;

  controls.innerHTML = html;
  controls.querySelectorAll(".page-btn:not([disabled])").forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = parseInt(btn.dataset.page, 10);
      if (page && page !== currentPage) {
        onPageChange(page);
      }
    });
  });
}

export function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove("hidden");
    el.classList.add("modal-open");
  }
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add("hidden");
    el.classList.remove("modal-open");
  }
}

export function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer") || createToastContainer();
  const toast = document.createElement("div");
  toast.className = `custom-toast toast-${type}`;
  toast.innerHTML = `
    <i class="bi ${type === "error" ? "bi-exclamation-circle" : "bi-check-circle"} text-lg"></i>
    <span class="text-xs font-bold">${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("toast-show");
  }, 10);
  setTimeout(() => {
    toast.classList.remove("toast-show");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function createToastContainer() {
  const div = document.createElement("div");
  div.id = "toastContainer";
  div.className = "toast-container";
  document.body.appendChild(div);
  return div;
}
