// pages/hr/presence-team/presence-team.ui.js
// =====================================================================
// PRESENCE TEAM UI MODULE
// Handles all DOM rendering, status badges, table pagination,
// and gamification views.
// NO direct Firestore access here.
// =====================================================================

import { setupExportModalControls } from "../../../assets/js/utils/export-helper.js";
import { toast } from "../../../assets/js/ui.js";

/**
 * Generates an avatar circle HTML (photo or initials).
 * @param {string} photo - Photo URL
 * @param {string} name - Full name
 * @param {number} size - Pixel size
 * @returns {string} HTML string
 */
export function avatarHtml(photo, name, size = 36) {
  const safeName = name || "Tanpa Nama";
  const initials = safeName
    .split(" ")
    .slice(0, 2)
    .map((w) => (w[0] ? w[0] : ""))
    .join("")
    .toUpperCase() || "NN";

  if (photo) {
    return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:url('${photo}') center/cover no-repeat;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.08);flex-shrink:0"></div>`;
  }

  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#dbeafe;display:flex;align-items:center;justify-content:center;font-size:${Math.round(
    size * 0.36,
  )}px;font-weight:600;color:#1e40af;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.08);flex-shrink:0">${initials}</div>`;
}

/**
 * Returns badge markup based on attendance status and lateness.
 * @param {string} status
 * @param {boolean} [isLate=false]
 * @returns {string} HTML
 */
export function statusBadge(status, isLate = false) {
  if (status === "Present" || String(status).startsWith("Present")) {
    if (isLate) {
      return '<span class="badge-status bg-amber-100 text-amber-800 border border-amber-200">Present (Terlambat)</span>';
    }
    return '<span class="badge-status bg-emerald-100 text-emerald-700">Present</span>';
  }
  if (status === "Tidak Valid (Hanya Clock Out)") {
    return '<span class="badge-status bg-amber-100 text-amber-800 border border-amber-200">Belum Clock In</span>';
  }
  if (
    status === "Tidak Valid" ||
    status === "Tidak Valid (Belum Clock Out)" ||
    String(status).startsWith("Tidak Valid") ||
    String(status).startsWith("Belum Clock Out")
  ) {
    if (isLate) {
      return '<span class="badge-status bg-rose-100 text-rose-700 border border-rose-200">Belum Clock Out (Terlambat)</span>';
    }
    return '<span class="badge-status bg-red-100 text-red-700">Belum Clock Out</span>';
  }
  return '<span class="badge-status bg-slate-100 text-slate-600">Tidak Hadir</span>';
}

/**
 * Updates KPI Summary Cards and headers.
 */
export function updateKpis({
  total,
  present,
  totalWorkHoursFormatted = "0 Jam 0 Menit",
  lateCount = 0,
  totalLateHoursFormatted = "0 Menit",
  pending,
  absent,
  dateKey,
  category = "team",
}) {
  const totalEl = document.getElementById("totalInternDisplay");
  const totalLabelEl = document.getElementById("totalLabelDisplay");
  const presentEl = document.getElementById("presentCountDisplay");
  const presentHoursEl = document.getElementById("presentTotalHoursDisplay");
  const lateEl = document.getElementById("lateCountDisplay");
  const lateHoursEl = document.getElementById("lateTotalHoursDisplay");
  const pendingEl = document.getElementById("pendingLogoutDisplay");
  const absentEl = document.getElementById("absentCountDisplay");
  const subtitleEl = document.getElementById("subtitleText");
  const summaryEl = document.getElementById("summaryText");

  if (totalEl) totalEl.textContent = String(total);
  if (totalLabelEl) {
    totalLabelEl.textContent =
      category === "intern"
        ? "Total Intern"
        : category === "all"
          ? "Total Personil"
          : "Total Team";
  }
  if (presentEl) presentEl.textContent = String(present);
  if (presentHoursEl) {
    presentHoursEl.textContent =
      present > 0 ? `Total: ${totalWorkHoursFormatted}` : "Total: 0 Jam 0 Menit";
  }
  if (lateEl) lateEl.textContent = String(lateCount);
  if (lateHoursEl) {
    lateHoursEl.textContent =
      lateCount > 0 ? `Total: ${totalLateHoursFormatted}` : "Total: 0 Menit";
  }
  if (pendingEl) pendingEl.textContent = String(pending);
  if (absentEl) absentEl.textContent = String(absent);
  if (subtitleEl) subtitleEl.textContent = `Rekap ${dateKey}`;
  if (summaryEl) {
    const workText = present > 0 ? ` (Total ${totalWorkHoursFormatted})` : "";
    const lateText =
      lateCount > 0
        ? ` | ${lateCount} terlambat (${totalLateHoursFormatted})`
        : "";
    summaryEl.textContent = `${present} present${workText}${lateText}, ${pending} belum clock out, ${absent} tidak hadir.`;
  }
}

/**
 * Modern conditional pagination component.
 * ONLY rendered if totalRows > rowsPerPage.
 */
export function renderPaginationComponent(containerEl, info) {
  if (!containerEl) return;
  const { currentPage, totalRows, rowsPerPage, onPageChange } = info;

  // CONDITIONAL RULE: jika data tidak terlalu besar (<= rowsPerPage), tidak usah ditambahkan.
  if (totalRows <= rowsPerPage) {
    containerEl.innerHTML = "";
    containerEl.classList.add("hidden");
    return;
  }

  containerEl.classList.remove("hidden");
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const start = (currentPage - 1) * rowsPerPage + 1;
  const end = Math.min(currentPage * rowsPerPage, totalRows);

  const infoHtml = `<div class="pagination-info">Menampilkan <span class="font-bold text-slate-700">${start}</span> - <span class="font-bold text-slate-700">${end}</span> dari <span class="font-bold text-slate-700">${totalRows}</span> tim</div>`;

  let buttonsHtml = "";
  // Prev button
  const prevDisabled = currentPage <= 1;
  buttonsHtml += `
    <button class="pagination-btn" data-action="prev" ${prevDisabled ? "disabled" : ""} title="Sebelumnya">
      <i class="bi bi-chevron-left"></i>
    </button>
  `;

  // Page numbers
  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let p = startPage; p <= endPage; p++) {
    const isActive = p === currentPage;
    buttonsHtml += `
      <button class="pagination-btn ${isActive ? "active" : ""}" data-page="${p}">
        ${p}
      </button>
    `;
  }

  // Next button
  const nextDisabled = currentPage >= totalPages;
  buttonsHtml += `
    <button class="pagination-btn" data-action="next" ${nextDisabled ? "disabled" : ""} title="Berikutnya">
      <i class="bi bi-chevron-right"></i>
    </button>
  `;

  containerEl.innerHTML = `
    ${infoHtml}
    <div class="pagination-controls">
      ${buttonsHtml}
    </div>
  `;

  // Attach click listener
  containerEl.querySelectorAll(".pagination-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      const action = btn.dataset.action;
      const pageNum = btn.dataset.page;
      if (action === "prev" && currentPage > 1) {
        onPageChange(currentPage - 1);
      } else if (action === "next" && currentPage < totalPages) {
        onPageChange(currentPage + 1);
      } else if (pageNum) {
        onPageChange(Number(pageNum));
      }
    });
  });
}

/**
 * Renders Daily Attendance Table with conditional pagination.
 */
export function renderDailyAttendanceTable(rows, paginationState) {
  const tbody = document.getElementById("attendanceBody");
  const emptyEl = document.getElementById("emptyState");
  const paginationEl = document.getElementById("attendancePagination");
  const footEl = document.getElementById("attendanceFoot");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!rows || !rows.length) {
    if (emptyEl) emptyEl.classList.remove("hidden");
    if (paginationEl) {
      paginationEl.innerHTML = "";
      paginationEl.classList.add("hidden");
    }
    if (footEl) footEl.classList.add("hidden");
    return;
  }

  if (emptyEl) emptyEl.classList.add("hidden");

    // Render Daily Table Footer
    if (footEl) {
      footEl.classList.remove("hidden");
      const totalSecs = rows.reduce((acc, r) => acc + (r.totalSeconds || 0), 0);
      const presentRows = rows.filter((r) => r.status === "Present");
      const lateRows = rows.filter((r) => r.isLate);
      const totalLateSecs = lateRows.reduce((acc, r) => acc + (r.lateSeconds || 0), 0);
      const lateH = Math.floor(totalLateSecs / 3600);
      const lateM = Math.floor((totalLateSecs % 3600) / 60);
      const lateTxt =
        lateRows.length > 0
          ? `${lateRows.length} Terlambat (${lateH > 0 ? `${lateH}j ${lateM}m` : `${lateM}m`})`
          : "Tepat Waktu";

      const dailyHoursCell = document.getElementById("dailyTotalHoursCell");
      const dailyStatusCell = document.getElementById("dailyTotalStatusCell");
      if (dailyHoursCell) {
        const h = Math.floor(totalSecs / 3600);
        const m = Math.floor((totalSecs % 3600) / 60);
        const totalCombSecs = rows.reduce(
          (acc, r) => acc + (r.combinedSeconds || r.totalSeconds || 0),
          0,
        );
        const combH = Math.floor(totalCombSecs / 3600);
        const combM = Math.floor((totalCombSecs % 3600) / 60);
        if (totalLateSecs > 0) {
          dailyHoursCell.innerHTML = `
            <div class="flex flex-col">
              <span class="font-extrabold text-[#0B2B6A]">${combH} Jam ${combM} Menit</span>
              <span class="text-[10px] font-normal text-slate-500">(${h}j ${m}m kerja + ${lateH}j ${lateM}m telat)</span>
            </div>
          `;
        } else {
          dailyHoursCell.textContent = `${h} Jam ${m} Menit`;
        }
      }
      if (dailyStatusCell) {
        dailyStatusCell.textContent = `${presentRows.length} Present • ${lateTxt}`;
      }
    }

    const { page, rowsPerPage, onPageChange } = paginationState;
    const startIdx = (page - 1) * rowsPerPage;
    const endIdx = startIdx + rowsPerPage;
    const displayedRows = rows.length > rowsPerPage ? rows.slice(startIdx, endIdx) : rows;

    const frag = document.createDocumentFragment();
    displayedRows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.className = `border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${
        r.status &&
        (r.status.startsWith("Tidak Valid") ||
          r.status.startsWith("Belum Clock Out"))
          ? "row-warning"
          : ""
      }`;

      const categoryBadge =
        r.category === "intern"
          ? '<span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-amber-50 text-amber-700 border border-amber-200/60 shrink-0">Intern</span>'
          : '<span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60 shrink-0">Team</span>';

      let clockInHtml = '<span class="text-slate-400 font-medium">-</span>';
      if (r.loginTime && r.loginTime !== "-") {
        if (r.isLate) {
          clockInHtml = `
            <div class="flex flex-col">
              <span class="font-bold text-rose-600">${r.loginTime}</span>
              <span class="text-[10px] font-semibold text-rose-500 flex items-center gap-0.5">
                <i class="bi bi-clock-history"></i> +${r.lateFormatted}
              </span>
            </div>
          `;
        } else {
          clockInHtml = `
            <div class="flex flex-col">
              <span class="font-semibold text-slate-700">${r.loginTime}</span>
              <span class="text-[10px] font-semibold text-emerald-600 flex items-center gap-0.5">
                <i class="bi bi-check2"></i> Tepat Waktu
              </span>
            </div>
          `;
        }
      }

      let totalJamKerjaHtml = '<span class="text-slate-400 font-medium">-</span>';
      if (r.totalSeconds != null) {
        if (r.isLate && r.lateSeconds > 0) {
          totalJamKerjaHtml = `
            <div class="flex flex-col">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-bold text-slate-800">${r.combinedLabel}</span>
                <span class="badge-late-added px-1.5 py-0.5 rounded text-[10px] font-bold" title="Total kerja ditambah keterlambatan (+${r.lateFormatted})">
                  <i class="bi bi-clock-history"></i> +Telat
                </span>
              </div>
              <span class="text-[11px] text-slate-500 font-normal">
                ${r.totalLabel} kerja + ${r.lateFormatted} telat
              </span>
            </div>
          `;
        } else {
          totalJamKerjaHtml = `<span class="font-medium text-slate-700">${r.totalLabel}</span>`;
        }
      }

      tr.innerHTML = `
        <td class="px-4 py-3 cell-name">
          <div class="flex items-center gap-2.5">
            ${avatarHtml(r.photo, r.name)}
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-semibold text-slate-800">${r.name}</span>
              ${categoryBadge}
            </div>
          </div>
        </td>
        <td class="px-4 py-3">${clockInHtml}</td>
        <td class="px-4 py-3 font-medium text-slate-600">${r.logoutTime}</td>
        <td class="px-4 py-3">${totalJamKerjaHtml}</td>
        <td class="px-4 py-3">${statusBadge(r.status, r.isLate)}</td>
      `;
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);

    renderPaginationComponent(paginationEl, {
      currentPage: page,
      totalRows: rows.length,
      rowsPerPage,
      onPageChange,
    });
  }

  /**
   * Renders Monthly Recap Table with conditional pagination.
   */
  export function renderMonthlyRecapTable(rows, paginationState) {
    const tbody = document.getElementById("internRecapBody");
    const emptyEl = document.getElementById("internRecapEmpty");
    const paginationEl = document.getElementById("monthlyRecapPagination");
    const footEl = document.getElementById("internRecapFoot");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!rows || !rows.length) {
      if (emptyEl) emptyEl.classList.remove("hidden");
      if (paginationEl) {
        paginationEl.innerHTML = "";
        paginationEl.classList.add("hidden");
      }
      if (footEl) footEl.classList.add("hidden");
      return;
    }

    if (emptyEl) emptyEl.classList.add("hidden");

    // Render Monthly Table Footer
    if (footEl) {
      footEl.classList.remove("hidden");
      const totalSecs = rows.reduce((acc, r) => acc + (r.total || 0), 0);
      const totalDays = rows.reduce((acc, r) => acc + (r.attendanceDays || 0), 0);
      const totalLateSecs = rows.reduce((acc, r) => acc + (r.totalLateSeconds || 0), 0);
      const totalLateCount = rows.reduce((acc, r) => acc + (r.lateCount || 0), 0);

      const mDaysCell = document.getElementById("monthlyTotalDaysCell");
      const mLateCell = document.getElementById("monthlyTotalLateCell");
      const mHoursCell = document.getElementById("monthlyTotalHoursCell");

      if (mDaysCell) mDaysCell.textContent = `${totalDays} hari`;
      if (mLateCell) {
        const h = Math.floor(totalLateSecs / 3600);
        const m = Math.floor((totalLateSecs % 3600) / 60);
        const lateStr = h > 0 ? `${h} Jam ${m} Menit` : `${m} Menit`;
        mLateCell.textContent =
          totalLateCount > 0 ? `${totalLateCount}x (${lateStr})` : "Tepat Waktu";
      }
      if (mHoursCell) {
        const h = Math.floor(totalSecs / 3600);
        const m = Math.floor((totalSecs % 3600) / 60);
        const totalCombSecs = rows.reduce(
          (acc, r) => acc + (r.totalCombined || r.total || 0),
          0,
        );
        const combH = Math.floor(totalCombSecs / 3600);
        const combM = Math.floor((totalCombSecs % 3600) / 60);
        if (totalLateSecs > 0) {
          const lateH = Math.floor(totalLateSecs / 3600);
          const lateM = Math.floor((totalLateSecs % 3600) / 60);
          const lateStr = lateH > 0 ? `${lateH}j ${lateM}m` : `${lateM}m`;
          mHoursCell.innerHTML = `
            <div class="flex flex-col">
              <span class="font-extrabold text-[#0B2B6A]">${combH} Jam ${combM} Menit</span>
              <span class="text-[10px] font-normal text-slate-500">(${h}j ${m}m kerja + ${lateStr} telat)</span>
            </div>
          `;
        } else {
          mHoursCell.textContent = `${h} Jam ${m} Menit`;
        }
      }
    }

    const { page, rowsPerPage, onPageChange, formatMinutes } = paginationState;
    const startIdx = (page - 1) * rowsPerPage;
    const endIdx = startIdx + rowsPerPage;
    const displayedRows = rows.length > rowsPerPage ? rows.slice(startIdx, endIdx) : rows;

    const frag = document.createDocumentFragment();
    displayedRows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.className = "border-b border-slate-100 hover:bg-slate-50/50 transition-colors";
      const categoryBadge =
        r.category === "intern"
          ? '<span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-amber-50 text-amber-700 border border-amber-200/60 shrink-0">Intern</span>'
          : '<span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60 shrink-0">Team</span>';

      const lateFormatted =
        r.lateFormattedHours ||
        (r.totalLateMinutes ? `${r.totalLateMinutes} Menit` : "-");
      const lateHtml =
        r.lateCount > 0
          ? `<span class="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">${r.lateCount}x (${lateFormatted})</span>`
          : `<span class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">Tepat Waktu</span>`;

      let monthlyTotalJamHtml = `<span class="font-medium text-slate-700">${formatMinutes(r.total)}</span>`;
      if (r.lateCount > 0 && r.totalLateSeconds > 0) {
        monthlyTotalJamHtml = `
          <div class="flex flex-col">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-bold text-slate-800">${formatMinutes(r.totalCombined)}</span>
              <span class="badge-late-added px-1.5 py-0.5 rounded text-[10px] font-bold" title="Ditambah keterlambatan: ${r.lateFormattedHours}">
                <i class="bi bi-clock-history"></i> +Telat
              </span>
            </div>
            <span class="text-[11px] text-slate-500 font-normal">
              ${formatMinutes(r.total)} kerja + ${r.lateFormattedHours} telat
            </span>
          </div>
        `;
      }

      tr.innerHTML = `
        <td class="px-4 py-3 cell-name">
          <div class="flex items-center gap-2.5">
            ${avatarHtml(r.photo, r.name)}
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-semibold text-slate-800">${r.name}</span>
              ${categoryBadge}
            </div>
          </div>
        </td>
        <td class="px-4 py-3 font-medium text-slate-600">${r.attendanceDays} hari</td>
        <td class="px-4 py-3 font-medium">${lateHtml}</td>
        <td class="px-4 py-3">${monthlyTotalJamHtml}</td>
      `;
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);

  renderPaginationComponent(paginationEl, {
    currentPage: page,
    totalRows: rows.length,
    rowsPerPage,
    onPageChange,
  });
}

/**
 * Renders Total Hours Table with conditional pagination.
 */
export function renderTotalHoursTable(rows, paginationState) {
  const tbody = document.getElementById("internshipTotalBody");
  const emptyEl = document.getElementById("internshipTotalEmpty");
  const paginationEl = document.getElementById("totalJamPagination");
  const footEl = document.getElementById("internshipTotalFoot");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!rows || !rows.length) {
    if (emptyEl) emptyEl.classList.remove("hidden");
    if (paginationEl) {
      paginationEl.innerHTML = "";
      paginationEl.classList.add("hidden");
    }
    if (footEl) footEl.classList.add("hidden");
    return;
  }

  if (emptyEl) emptyEl.classList.add("hidden");

  // Render Total Hours Table Footer
  if (footEl) {
    footEl.classList.remove("hidden");
    const totalSecs = rows.reduce((acc, r) => acc + (r.total || 0), 0);
    const totalDays = rows.reduce((acc, r) => acc + (r.days || 0), 0);
    const avgSecs = totalDays > 0 ? Math.floor(totalSecs / totalDays) : 0;

    const tHoursCell = document.getElementById("totalJamAllHoursCell");
    const tDaysCell = document.getElementById("totalJamAllDaysCell");
    const tAvgCell = document.getElementById("totalJamAllAvgCell");

    if (tHoursCell) {
      const h = Math.floor(totalSecs / 3600);
      const m = Math.floor((totalSecs % 3600) / 60);
      tHoursCell.textContent = `${h} Jam ${m} Menit`;
    }
    if (tDaysCell) tDaysCell.textContent = `${totalDays} hari`;
    if (tAvgCell) {
      const h = Math.floor(avgSecs / 3600);
      const m = Math.floor((avgSecs % 3600) / 60);
      tAvgCell.textContent = `${h} Jam ${m} Menit`;
    }
  }

  const { page, rowsPerPage, onPageChange, formatMinutes } = paginationState;
  const startIdx = (page - 1) * rowsPerPage;
  const endIdx = startIdx + rowsPerPage;
  const displayedRows = rows.length > rowsPerPage ? rows.slice(startIdx, endIdx) : rows;

  const frag = document.createDocumentFragment();
  displayedRows.forEach((r, idx) => {
    const rankNum = startIdx + idx + 1;
    const avg = r.days > 0 ? Math.floor(r.total / r.days) : 0;
    const categoryBadge =
      r.category === "intern"
        ? '<span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-amber-50 text-amber-700 border border-amber-200/60 shrink-0">Intern</span>'
        : '<span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60 shrink-0">Team</span>';

    const tr = document.createElement("tr");
    tr.className =
      "border-b border-slate-100 hover:bg-slate-50/70 transition-colors";
    tr.innerHTML = `
      <td class="px-4 py-3 cell-name">
        <div class="flex items-center gap-3">
          <span class="text-[11px] font-bold text-slate-400 w-5">${rankNum}</span>
          ${avatarHtml(r.photo, r.name)}
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-semibold text-slate-800">${r.name}</span>
            ${categoryBadge}
          </div>
        </div>
      </td>
      <td class="px-4 py-3 font-semibold text-[#0B2B6A]">${formatMinutes(r.total)}</td>
      <td class="px-4 py-3 font-medium text-slate-600">${r.days} hari</td>
      <td class="px-4 py-3 font-medium text-slate-600">${formatMinutes(avg)}</td>
    `;
    frag.appendChild(tr);
  });
  tbody.appendChild(frag);

  renderPaginationComponent(paginationEl, {
    currentPage: page,
    totalRows: rows.length,
    rowsPerPage,
    onPageChange,
  });
}

/**
 * Renders Gamification cards, progress bars, flame pins, and leaderboard.
 */
export function renderGamificationView({ sortedUsers, workDays, todayKey }) {
  const gamiCards = document.getElementById("gamiCards");
  const gamiEmpty = document.getElementById("gamiEmpty");
  const gamiLeaderboard = document.getElementById("gamiLeaderboard");
  const gamiLdrEmpty = document.getElementById("gamiLdrEmpty");

  if (!gamiCards || !gamiLeaderboard) return;

  gamiCards.innerHTML = "";
  gamiLeaderboard.innerHTML = "";

  if (!sortedUsers || !sortedUsers.length) {
    if (gamiEmpty) gamiEmpty.classList.remove("hidden");
    if (gamiLdrEmpty) gamiLdrEmpty.classList.remove("hidden");
    return;
  }

  if (gamiEmpty) gamiEmpty.classList.add("hidden");
  if (gamiLdrEmpty) gamiLdrEmpty.classList.add("hidden");

  const totalDays = workDays.length || 1;
  const dayNames = { 0: "Min", 2: "Sel", 4: "Kam", 6: "Sat" };

  // 1. Render Gamification Cards
  sortedUsers.forEach((u) => {
    const { segs, bs, tp, pc, ec } = u;
    const pct = pc > 0 ? Math.round((tp / pc) * 100) : 0;

    // Flame pins
    const flameSegs = segs.filter((s) => s.type === "streak");
    let flameRowHTML = "";
    flameSegs.forEach((seg) => {
      const leftPct = (((seg.end + 1) / totalDays) * 100).toFixed(3);
      flameRowHTML += `
        <div style="position:absolute;left:${leftPct}%;bottom:0;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:0">
          <span style="font-size:13px;line-height:1">🔥</span>
          <span style="font-size:8px;font-weight:700;color:#A32D2D;line-height:1.2">${seg.len}x</span>
        </div>
      `;
    });

    // Bar segments
    const segColors = {
      streak: "#E24B4A",
      present: "#185FA5",
      absent: "#e2e8f0",
      future: "#f1f5f9",
    };

    let barInnerHTML = "";
    segs.forEach((seg) => {
      const wPct = ((seg.len / totalDays) * 100).toFixed(4);
      const isFuture = seg.type === "future";
      const label = workDays
        .slice(seg.start, seg.end + 1)
        .map((d) => {
          const dt = new Date(d + "T00:00:00");
          return (
            (dayNames[dt.getDay()] || "") +
            " " +
            dt.getDate() +
            ": " +
            (isFuture
              ? "Belum"
              : seg.type === "absent"
              ? "Tidak Hadir"
              : "Hadir")
          );
        })
        .join("\n");

      barInnerHTML += `<div style="width:${wPct}%;height:100%;background:${segColors[seg.type]};cursor:${
        isFuture ? "default" : "pointer"
      };flex-shrink:0" title="${label}" data-start="${seg.start}" data-end="${seg.end}" data-uid="${u.id}"></div>`;
    });

    // Day labels
    const labelIdxs = [
      0,
      Math.round(totalDays / 4) - 1,
      Math.round(totalDays / 2) - 1,
      Math.round((totalDays * 3) / 4) - 1,
      totalDays - 1,
    ];
    let labelsHTML = "";
    new Set(labelIdxs.filter((i) => i >= 0 && i < totalDays)).forEach((idx) => {
      const d = new Date(workDays[idx] + "T00:00:00");
      const lp = (((idx + 0.5) / totalDays) * 100).toFixed(2);
      labelsHTML += `<div style="position:absolute;left:${lp}%;transform:translateX(-50%);font-size:8px;color:#94a3b8;white-space:nowrap">${
        (dayNames[d.getDay()] || "") + d.getDate()
      }</div>`;
    });

    const progressScaleHTML = `
      <div class="flex items-center justify-between mt-1 px-[1px]">
        <span class="text-[10px] text-slate-400 font-medium">0</span>
        <span class="text-[10px] text-slate-400 font-medium">${totalDays}</span>
      </div>
    `;

    // Badges
    const badgeClassMap = {
      "early-bgn": "badge-chip early-bgn",
      "early-nov": "badge-chip early-nov",
      "early-mas": "badge-chip early-mas",
      "step-rookie": "badge-chip step-rookie",
      "step-strider": "badge-chip step-strider",
      "step-sprint": "badge-chip step-sprint",
    };

    let ebadge = null;
    if (ec >= 10) ebadge = ["early-mas", "☀️ Early Mastery"];
    else if (ec >= 4) ebadge = ["early-nov", "☀️ Early Novice"];
    else if (ec >= 2) ebadge = ["early-bgn", "☀️ Early Beginner"];

    let sbadge = null;
    if (bs >= 14) sbadge = ["step-sprint", "🔥 Step-in Sprinter"];
    else if (bs >= 7) sbadge = ["step-strider", "🔥 Step-in Strider"];
    else if (bs >= 3) sbadge = ["step-rookie", "🔥 Step-in Rookie"];

    let badgesHTML = "";
    if (ebadge) {
      badgesHTML += `<span class="${badgeClassMap[ebadge[0]]}">${ebadge[1]}</span>`;
    } else {
      badgesHTML += `<span class="badge-chip locked">🔒 Early Beginner (total 2× paling awal)</span>`;
    }

    if (sbadge) {
      badgesHTML += `<span class="${badgeClassMap[sbadge[0]]}">${sbadge[1]}</span>`;
    } else {
      badgesHTML += `<span class="badge-chip locked">🔒 Step-in Rookie (3 hari)</span>`;
    }

    const card = document.createElement("div");
    card.className = "intern-gami-card";
    card.innerHTML = `
      <div class="flex items-center gap-3 mb-3">
        ${avatarHtml(u.photo, u.name, 38)}
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-slate-800 text-sm truncate mb-0">${u.name}</p>
          <p class="text-xs text-slate-400 mb-0">${tp}/${pc} hari hadir (${pct}%)</p>
          <p class="text-xs text-slate-400 mb-0">Berangkat paling awal: ${ec}x bulan ini</p>
        </div>
        ${
          bs >= 2
            ? `<span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:99px;background:#FEF2F2;color:#A32D2D;border:1px solid #F09595;white-space:nowrap;flex-shrink:0">Best streak: ${bs}x</span>`
            : `<span class="text-xs text-slate-400 flex-shrink-0">Streak terbaik: ${bs}</span>`
        }
      </div>
      <div style="position:relative;margin-bottom:4px">
        <div style="position:relative;height:22px;margin-bottom:2px">${flameRowHTML}</div>
        <div style="width:100%;height:13px;border-radius:99px;overflow:hidden;background:#e2e8f0;display:flex">${barInnerHTML}</div>
        <div style="position:relative;height:14px;margin-top:2px">${labelsHTML}</div>
        ${progressScaleHTML}
      </div>
      <div class="flex flex-wrap mt-3" style="gap:4px">${badgesHTML}</div>
    `;
    gamiCards.appendChild(card);
  });

  // 2. Render Leaderboard
  const medals = ["🥇", "🥈", "🥉"];
  sortedUsers.forEach((u, i) => {
    const row = document.createElement("div");
    row.className = "ldr-row";
    row.innerHTML = `
      <span class="ldr-rank">${medals[i] || i + 1}</span>
      ${avatarHtml(u.photo, u.name, 32)}
      <span class="flex-1 text-sm font-semibold text-slate-800">${u.name}</span>
      <div class="text-right">
        <p class="text-sm font-semibold text-slate-800 mb-0">${u.tp} hari</p>
        <p class="text-xs mb-0" style="color:${u.bs >= 2 ? "#E24B4A" : "#94a3b8"}">
          ${u.bs >= 2 ? "🔥 Best streak: " + u.bs + "x" : "streak: " + u.bs}
        </p>
      </div>
    `;
    gamiLeaderboard.appendChild(row);
  });
}

/**
 * Toggles daily loading spinner.
 */
export function setDailyLoading(isLoading) {
  const spinner = document.getElementById("loadingSpinner");
  if (spinner) {
    if (isLoading) spinner.classList.remove("hidden");
    else spinner.classList.add("hidden");
  }
}

/**
 * Initializes Standard Export Modal for Presence Team.
 * @param {Function} [onFormatChange]
 * @param {Function} [onRangeChange]
 */
export function initPresenceExportModal(onFormatChange, onRangeChange) {
  const baseControls = setupExportModalControls({
    modalId: "exportPresenceModal",
    onFormatChange,
    onRangeChange,
  });

  const modalEl = document.getElementById("exportPresenceModal");
  let selectedCategory = "all";

  if (modalEl) {
    const catSegmented = modalEl.querySelector("#exportCategorySegmented");
    if (catSegmented) {
      const catBtns = catSegmented.querySelectorAll("[data-category]");
      catBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          catBtns.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          selectedCategory = btn.dataset.category || "all";
        });
      });
    }
  }

  const setCategory = (cat) => {
    selectedCategory = cat || "all";
    if (modalEl) {
      const catSegmented = modalEl.querySelector("#exportCategorySegmented");
      if (catSegmented) {
        const catBtns = catSegmented.querySelectorAll("[data-category]");
        catBtns.forEach((b) => {
          if (b.dataset.category === selectedCategory) {
            b.classList.add("active");
          } else {
            b.classList.remove("active");
          }
        });
      }
    }
  };

  return {
    ...baseControls,
    setCategory,
    getFormData: () => {
      const baseData =
        baseControls && typeof baseControls.getFormData === "function"
          ? baseControls.getFormData()
          : {};
      return {
        ...baseData,
        category: selectedCategory,
      };
    },
  };
}

// =====================================================================
// DATABASE MAPPING & SCHEMA ERD CONTROLS (PRESENCE TEAM)
// =====================================================================

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
 * when Team Presence is active.
 */
export function mountSidebarPresenceTeamErdButton() {
  const sidebarWrapper = document.querySelector("#dg-sidebar-mount .sidebar-scroll-wrapper");
  if (!sidebarWrapper) return;

  // Prevent duplicate mounts
  if (document.getElementById("sidebarBtnPresenceTeamErd")) return;

  const linkEl = document.createElement("a");
  linkEl.href = "javascript:void(0)";
  linkEl.className = "sidebar-link";
  linkEl.id = "sidebarBtnPresenceTeamErd";
  linkEl.setAttribute("data-bs-toggle", "modal");
  linkEl.setAttribute("data-bs-target", "#presenceTeamErdModal");
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
 * Initializes Presence Team ERD modal tabs, search, filters, SVG connectors & copy button.
 */
export function initPresenceTeamErdModalControls() {
  const modalEl = document.getElementById("presenceTeamErdModal");
  if (!modalEl) return;

  // Tab controls
  const tabVisualBtn = document.getElementById("tabBtnPresenceTeamErdVisual");
  const tabDictBtn = document.getElementById("tabBtnPresenceTeamErdDict");
  const tabSqlBtn = document.getElementById("tabBtnPresenceTeamErdSql");

  const tabVisualContent = document.getElementById("presenceTeamErdTabVisualContent");
  const tabDictContent = document.getElementById("presenceTeamErdTabDictContent");
  const tabSqlContent = document.getElementById("presenceTeamErdTabSqlContent");

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
        setTimeout(drawPresenceTeamErdRelations, 80);
      }
    });
  });

  // Kamus Data (Data Dictionary) Search & Table Filter
  const searchInput = document.getElementById("presenceTeamErdDictSearchInput");
  const tableFilter = document.getElementById("presenceTeamErdDictTableFilter");
  const dictTableBody = document.getElementById("presenceTeamErdDictTableBody");
  const countBadge = document.getElementById("presenceTeamErdDictCountBadge");

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
  const btnCopySql = document.getElementById("btnCopyPresenceTeamSqlScript");
  const btnCopyText = document.getElementById("btnCopyPresenceTeamSqlText");
  const sqlContent = document.getElementById("presenceTeamSqlScriptContent");

  if (btnCopySql && sqlContent) {
    btnCopySql.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(sqlContent.textContent || "");
        if (btnCopyText) btnCopyText.textContent = "Tersalin!";
        toast("Script SQL DDL berhasil disalin ke clipboard!", "success");
        setTimeout(() => {
          if (btnCopyText) btnCopyText.textContent = "Salin Script SQL";
        }, 2500);
      } catch (err) {
        console.error("Gagal menyalin SQL:", err);
      }
    });
  }

  // Copy Obsidian Docs Path Button
  const btnCopyDocs = document.getElementById("btnCopyPresenceTeamDocsPath");
  if (btnCopyDocs) {
    btnCopyDocs.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText("docs/PRESENCE-TEAM-DATABASE-MAPPING.md");
        toast("Path docs/PRESENCE-TEAM-DATABASE-MAPPING.md tersalin!", "success");
      } catch (e) {
        console.error("Gagal menyalin path:", e);
      }
    });
  }

  // =====================================================================
  // DYNAMIC SVG RELATIONS (LINES & ARROWS)
  // =====================================================================
  const wrapper = document.getElementById("presenceTeamErdDiagramWrapper");
  const svgGroup = document.getElementById("presenceTeamErdPathsGroup");
  const originAnchor = document.getElementById("erdOriginPresenceUsersId");

  const relationConfigs = [
    {
      id: "attendances",
      targetAnchor: document.getElementById("erdTargetPresenceAttendanceId"),
      card: document.getElementById("cardPresenceTeamAttendance"),
      color: "#10b981",
      marker: "url(#presenceTeamErdArrowEmerald)",
      label: "1 : N (user_id)",
      y1Offset: -10,
      tBadge: 0.35,
    },
    {
      id: "monthly",
      targetAnchor: document.getElementById("erdTargetPresenceMonthlyId"),
      card: document.getElementById("cardPresenceTeamMonthly"),
      color: "#3b82f6",
      marker: "url(#presenceTeamErdArrowBlue)",
      label: "1 : N (user_id)",
      y1Offset: -3,
      tBadge: 0.58,
    },
    {
      id: "gamification",
      targetAnchor: document.getElementById("erdTargetPresenceGamificationId"),
      card: document.getElementById("cardPresenceTeamGamification"),
      color: "#f59e0b",
      marker: "url(#presenceTeamErdArrowAmber)",
      label: "1 : N (user_id)",
      y1Offset: 4,
      tBadge: 0.42,
    },
    {
      id: "permits",
      targetAnchor: document.getElementById("erdTargetPresencePermitsId"),
      card: document.getElementById("cardPresenceTeamPermits"),
      color: "#8b5cf6",
      marker: "url(#presenceTeamErdArrowPurple)",
      label: "1 : N (user_id)",
      y1Offset: 11,
      tBadge: 0.65,
    },
  ];

  let currentActiveRel = "all";

  function drawPresenceTeamErdRelations() {
    if (!wrapper || !svgGroup || !originAnchor) return;

    const wrapRect = wrapper.getBoundingClientRect();
    if (wrapRect.width === 0 || wrapRect.height === 0) return;

    if (window.innerWidth < 1024) {
      svgGroup.innerHTML = "";
      return;
    }

    const origRect = originAnchor.getBoundingClientRect();

    // Origin point: Right edge center of users.id row
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
        // Target: Left edge center of child user_id row
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
        // Stacked (Mobile/narrow view)
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
            marker-start="url(#presenceTeamErdDotStart)" marker-end="${cfg.marker}" 
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
    document.querySelectorAll(".erd-rel-pill").forEach((pill) => {
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

    drawPresenceTeamErdRelations();
  }

  // Relation Filter Pills Click
  document.querySelectorAll(".erd-rel-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const rel = pill.getAttribute("data-rel") || "all";
      setActiveRelation(rel);
    });
  });

  // Modal Shown Event Listener
  if (modalEl) {
    modalEl.addEventListener("shown.bs.modal", () => {
      setTimeout(drawPresenceTeamErdRelations, 80);
    });
  }

  // Tab switch redraw
  tabVisualBtn?.addEventListener("click", () => {
    setTimeout(drawPresenceTeamErdRelations, 80);
  });

  // Window resize redraw (debounced)
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawPresenceTeamErdRelations, 100);
  });

  // Initial draw
  setTimeout(drawPresenceTeamErdRelations, 300);
}


