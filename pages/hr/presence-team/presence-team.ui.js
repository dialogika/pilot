// pages/hr/presence-team/presence-team.ui.js
// =====================================================================
// PRESENCE TEAM UI MODULE
// Handles all DOM rendering, status badges, table pagination,
// and gamification views.
// NO direct Firestore access here.
// =====================================================================

import { setupExportModalControls } from "../../../assets/js/utils/export-helper.js";

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

