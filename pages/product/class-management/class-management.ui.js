/**
 * class-management.ui.js
 * DOM Presentation Layer (Zero Firebase) for Class Management feature.
 */

import { alertDialog } from "/assets/js/ui.js";
import { setupExportModalControls } from "../../../assets/js/utils/export-helper.js";

export function computeHealthScore(c) {
  const attendance = typeof c.attendanceRate === "number" ? c.attendanceRate : 0;
  const delay = typeof c.delayCount === "number" ? c.delayCount : 0;
  const reschedule = typeof c.rescheduleCount === "number" ? c.rescheduleCount : 0;
  let score = (attendance / 100) * 10;
  score -= delay * 0.8;
  score -= reschedule * 1.0;
  if (score < 0) score = 0;
  if (score > 10) score = 10;
  return parseFloat(score.toFixed(1));
}

export function getHealthColor(score) {
  if (score >= 8) return "emerald";
  if (score >= 5) return "amber";
  return "rose";
}

export function getStatusClass(status) {
  if (status === "Soon") return "status-pill status-soon";
  if (status === "Running") return "status-pill status-running";
  if (status === "Reminder") return "status-pill status-reminder";
  if (status === "Stall") return "status-pill status-stall";
  if (status === "Graduate") return "status-pill status-graduate";
  if (status === "Complete") return "status-pill status-complete";
  return "status-pill status-soon";
}

export function showToast(message, type = "success") {
  const el = document.getElementById("planningToast");
  if (!el) return;
  el.textContent = message;
  const base = "planning-toast";
  const variant = type === "error" ? "planning-toast-error" : "planning-toast-success";
  el.className = base + " " + variant;
  el.classList.remove("hidden");
  setTimeout(() => {
    el.classList.add("hidden");
  }, 2400);
}

export function renderSummary(list) {
  const total = list.length;
  const running = list.filter((c) => c.status === "Running").length;
  const stall = list.filter((c) => c.status === "Stall").length;
  const avgHealth = list.length
    ? list.reduce((acc, c) => acc + (c.healthScore || computeHealthScore(c)), 0) / list.length
    : 0;

  const totalEl = document.getElementById("statTotalClass");
  const runningEl = document.getElementById("statRunningClass");
  const runningRatioEl = document.getElementById("statRunningRatio");
  const stallEl = document.getElementById("statStallClass");
  const stallRatioEl = document.getElementById("statStallRatio");
  const avgHealthEl = document.getElementById("statAvgHealth");

  if (totalEl) totalEl.textContent = String(total);
  if (runningEl) runningEl.textContent = String(running);
  if (stallEl) stallEl.textContent = String(stall);
  if (runningRatioEl) {
    const pct = total ? Math.round((running / total) * 100) : 0;
    runningRatioEl.textContent = total ? pct + "% running" : "0% running";
  }
  if (stallRatioEl) {
    const pct = total ? Math.round((stall / total) * 100) : 0;
    stallRatioEl.textContent = total ? pct + "% stall" : "0% stall";
  }
  if (avgHealthEl) avgHealthEl.textContent = avgHealth.toFixed(1);
}

export function renderClassTable(list, selectedClassIds, onToggleSelect, onOpenDetail, totalFilteredCount) {
  const tbody = document.getElementById("classTableBody");
  const countText = document.getElementById("classCountText");
  if (!tbody) return;
  tbody.innerHTML = "";

  const totalCount = totalFilteredCount !== undefined ? totalFilteredCount : list.length;

  if (list.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `
      <td colspan="9" class="px-4 py-8 text-center text-slate-400 text-xs">
        <i class="fas fa-inbox text-2xl mb-2 block text-slate-300"></i>
        Tidak ada data kelas yang sesuai dengan filter pencarian.
      </td>
    `;
    tbody.appendChild(emptyRow);
    if (countText) countText.textContent = "0 kelas";
    return;
  }

  list.forEach((c) => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50/80 transition cursor-pointer border-b border-slate-100";

    // Checkbox
    const tdCheck = document.createElement("td");
    tdCheck.className = "px-3 py-2.5 text-center";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer";
    cb.checked = selectedClassIds.has(c.id);
    cb.addEventListener("click", (e) => e.stopPropagation());
    cb.addEventListener("change", () => onToggleSelect(c.id, cb.checked));
    tdCheck.appendChild(cb);

    // Class Name
    const tdName = document.createElement("td");
    tdName.className = "px-3 py-2.5 align-top";
    const nameCol = document.createElement("div");
    nameCol.className = "flex flex-col";
    const nameEl = document.createElement("div");
    nameEl.className = "text-xs font-semibold text-slate-900 line-clamp-1";
    nameEl.textContent = c.name || "-";
    const badgeRow = document.createElement("div");
    badgeRow.className = "flex items-center gap-1 flex-wrap mt-0.5";
    if (c.isRemedial) {
      const remedialBadge = document.createElement("span");
      remedialBadge.className =
        "inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-sky-50 text-sky-700 border border-sky-200";
      remedialBadge.textContent = "Remedial";
      badgeRow.appendChild(remedialBadge);
      if (c.parentClassName) {
        const parentInfo = document.createElement("span");
        parentInfo.className = "text-[9px] text-slate-400";
        parentInfo.textContent = "Parent: " + c.parentClassName;
        badgeRow.appendChild(parentInfo);
      }
    }
    const metaEl = document.createElement("div");
    metaEl.className = "text-[10px] text-slate-400 mt-0.5";
    metaEl.textContent = (c.location || "Online") + " • " + (c.type || "Class");
    nameCol.appendChild(nameEl);
    if (badgeRow.children.length) nameCol.appendChild(badgeRow);
    nameCol.appendChild(metaEl);
    tdName.appendChild(nameCol);

    // Status
    const tdStatus = document.createElement("td");
    tdStatus.className = "px-3 py-2.5 text-center align-middle";
    const statusSpan = document.createElement("span");
    statusSpan.className = getStatusClass(c.status);
    statusSpan.textContent = c.status || "Soon";
    tdStatus.appendChild(statusSpan);

    // Start Date
    const tdStart = document.createElement("td");
    tdStart.className = "px-3 py-2.5 text-center align-middle text-xs text-slate-600 font-medium whitespace-nowrap";
    tdStart.textContent = c.startDate || "-";

    // Meeting Progress
    const tdMeeting = document.createElement("td");
    tdMeeting.className = "px-3 py-2.5 text-center align-middle";
    const meetingWrapper = document.createElement("div");
    meetingWrapper.className = "flex flex-col items-center gap-1 min-w-[70px]";
    const done = c.meeting ? c.meeting.done || 0 : 0;
    const total = c.meeting ? c.meeting.total || 0 : 0;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const meetingText = document.createElement("div");
    meetingText.className = "text-[10px] text-slate-500 font-medium";
    meetingText.textContent = `${done}/${total} (${pct}%)`;
    const meetingBarOuter = document.createElement("div");
    meetingBarOuter.className = "w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden";
    const meetingBarInner = document.createElement("div");
    meetingBarInner.className = "h-1.5 rounded-full bg-emerald-500 transition-all duration-300";
    meetingBarInner.style.width = pct + "%";
    meetingBarOuter.appendChild(meetingBarInner);
    meetingWrapper.appendChild(meetingText);
    meetingWrapper.appendChild(meetingBarOuter);
    tdMeeting.appendChild(meetingWrapper);

    // PIC
    const tdPic = document.createElement("td");
    tdPic.className = "px-3 py-2.5 text-center align-middle";
    const picWrapper = document.createElement("div");
    picWrapper.className = "flex items-center justify-center gap-1.5";
    if (c.pic && c.pic.name) {
      const avatar = document.createElement("div");
      avatar.className =
        "w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[9px] font-bold shrink-0";
      avatar.textContent = (c.pic.initials || c.pic.name.charAt(0)).toUpperCase();
      const label = document.createElement("span");
      label.className = "text-[11px] text-slate-700 font-medium truncate max-w-[80px]";
      label.textContent = c.pic.name;
      picWrapper.appendChild(avatar);
      picWrapper.appendChild(label);
    } else {
      picWrapper.innerHTML = '<span class="text-slate-300 text-xs">-</span>';
    }
    tdPic.appendChild(picWrapper);

    // Mentor
    const tdMentor = document.createElement("td");
    tdMentor.className = "px-3 py-2.5 text-center align-middle";
    const mentorWrapper = document.createElement("div");
    mentorWrapper.className = "flex items-center justify-center gap-1 flex-wrap";
    if (Array.isArray(c.mentors) && c.mentors.length) {
      c.mentors.slice(0, 2).forEach((m) => {
        const avatar = document.createElement("div");
        avatar.className =
          "w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[9px] font-bold shrink-0";
        avatar.title = m.name;
        avatar.textContent = (m.initials || (m.name || "M").charAt(0)).toUpperCase();
        mentorWrapper.appendChild(avatar);
      });
      if (c.mentors.length > 2) {
        const more = document.createElement("span");
        more.className = "text-[9px] text-slate-400 font-bold";
        more.textContent = `+${c.mentors.length - 2}`;
        mentorWrapper.appendChild(more);
      }
    } else {
      mentorWrapper.innerHTML = '<span class="text-slate-300 text-xs">-</span>';
    }
    tdMentor.appendChild(mentorWrapper);

    // Health Score
    const tdHealth = document.createElement("td");
    tdHealth.className = "px-3 py-2.5 text-center align-middle";
    const hs = c.healthScore !== undefined ? c.healthScore : computeHealthScore(c);
    const color = getHealthColor(hs);
    const healthWrapper = document.createElement("div");
    healthWrapper.className = "flex flex-col items-center gap-1 min-w-[65px]";
    let fg = "text-emerald-700",
      bg = "bg-emerald-50",
      barColor = "bg-emerald-500";
    if (color === "amber") {
      fg = "text-amber-700";
      bg = "bg-amber-50";
      barColor = "bg-amber-500";
    } else if (color === "rose") {
      fg = "text-rose-700";
      bg = "bg-rose-50";
      barColor = "bg-rose-500";
    }
    const pill = document.createElement("div");
    pill.className = `px-1.5 py-0.5 rounded-full text-[9px] font-bold ${fg} ${bg}`;
    pill.textContent = `${hs.toFixed(1)}/10`;
    const barOuter = document.createElement("div");
    barOuter.className = "w-14 h-1.5 rounded-full bg-slate-100 overflow-hidden";
    const barInner = document.createElement("div");
    barInner.className = `h-1.5 rounded-full ${barColor}`;
    barInner.style.width = hs * 10 + "%";
    barOuter.appendChild(barInner);
    healthWrapper.appendChild(pill);
    healthWrapper.appendChild(barOuter);
    tdHealth.appendChild(healthWrapper);

    // Action
    const tdAction = document.createElement("td");
    tdAction.className = "px-3 py-2.5 text-center align-middle";
    const btnDetail = document.createElement("button");
    btnDetail.className =
      "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-900 text-white hover:bg-slate-800 transition shadow-sm";
    btnDetail.innerHTML = '<i data-lucide="eye" class="w-3 h-3"></i> Detail';
    btnDetail.addEventListener("click", (e) => {
      e.stopPropagation();
      onOpenDetail(c.id);
    });
    tdAction.appendChild(btnDetail);

    tr.appendChild(tdCheck);
    tr.appendChild(tdName);
    tr.appendChild(tdStatus);
    tr.appendChild(tdStart);
    tr.appendChild(tdMeeting);
    tr.appendChild(tdPic);
    tr.appendChild(tdMentor);
    tr.appendChild(tdHealth);
    tr.appendChild(tdAction);

    tr.addEventListener("click", () => onOpenDetail(c.id));
    tbody.appendChild(tr);
  });

  if (countText) countText.textContent = `${totalCount} kelas`;
  if (window.lucide) window.lucide.createIcons();
}

export function renderPagination({ currentPage, pageSize, totalItems }, onPageChange, onPageSizeChange) {
  const container = document.getElementById("classPagination");
  if (!container) return;
  if (totalItems === 0) {
    container.innerHTML = "";
    container.classList.add("hidden");
    return;
  }
  container.classList.remove("hidden");

  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  let pagesHtml = "";
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + 4);
  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4);
  }

  // Prev button
  const prevDisabled = currentPage === 1;
  pagesHtml += `
    <button type="button" class="pagination-btn ${prevDisabled ? "disabled" : ""}" data-page="${currentPage - 1}" ${prevDisabled ? "disabled" : ""} title="Halaman Sebelumnya">
      <i class="bi bi-chevron-left text-[11px]"></i>
    </button>
  `;

  if (startPage > 1) {
    pagesHtml += `<button type="button" class="pagination-btn" data-page="1">1</button>`;
    if (startPage > 2) {
      pagesHtml += `<span class="px-1 text-slate-400">...</span>`;
    }
  }

  for (let p = startPage; p <= endPage; p++) {
    const isActive = p === currentPage;
    pagesHtml += `
      <button type="button" class="pagination-btn ${isActive ? "active" : ""}" data-page="${p}">
        ${p}
      </button>
    `;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      pagesHtml += `<span class="px-1 text-slate-400">...</span>`;
    }
    pagesHtml += `<button type="button" class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
  }

  // Next button
  const nextDisabled = currentPage === totalPages;
  pagesHtml += `
    <button type="button" class="pagination-btn ${nextDisabled ? "disabled" : ""}" data-page="${currentPage + 1}" ${nextDisabled ? "disabled" : ""} title="Halaman Berikutnya">
      <i class="bi bi-chevron-right text-[11px]"></i>
    </button>
  `;

  container.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="text-[11px] text-slate-500 font-medium">
        Menampilkan <span class="font-bold text-slate-800">${start}</span> - <span class="font-bold text-slate-800">${end}</span> dari <span class="font-bold text-slate-800">${totalItems}</span> kelas
      </div>
      <div class="flex items-center gap-1.5 text-[11px] text-slate-500">
        <span>Baris per halaman:</span>
        <select id="selectPageSize" class="py-1 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500/20 cursor-pointer">
          <option value="10" ${pageSize === 10 ? "selected" : ""}>10</option>
          <option value="25" ${pageSize === 25 ? "selected" : ""}>25</option>
          <option value="50" ${pageSize === 50 ? "selected" : ""}>50</option>
          <option value="100" ${pageSize === 100 ? "selected" : ""}>100</option>
        </select>
      </div>
    </div>
    <div class="flex items-center gap-1" id="paginationButtonList">
      ${pagesHtml}
    </div>
  `;

  const sizeSelect = container.querySelector("#selectPageSize");
  if (sizeSelect) {
    sizeSelect.addEventListener("change", (e) => {
      onPageSizeChange(parseInt(e.target.value, 10));
    });
  }

  const btnList = container.querySelector("#paginationButtonList");
  if (btnList) {
    btnList.querySelectorAll(".pagination-btn[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = parseInt(btn.getAttribute("data-page"), 10);
        if (p >= 1 && p <= totalPages && p !== currentPage) {
          onPageChange(p);
        }
      });
    });
  }
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getCalCardClass(status) {
  const map = {
    Soon: "cal-card-soon",
    Running: "cal-card-running",
    Reminder: "cal-card-reminder",
    Stall: "cal-card-stall",
    Graduate: "cal-card-graduate",
    Complete: "cal-card-complete",
  };
  return map[status] || "cal-card-soon";
}

export function renderCalendar(list, calYear, calMonth, onOpenDetail) {
  const grid = document.getElementById("calGrid");
  const label = document.getElementById("calMonthLabel");
  const countEl = document.getElementById("calClassCount");
  if (!grid) return;
  grid.innerHTML = "";
  if (label) label.textContent = `${MONTH_NAMES[calMonth]} ${calYear}`;

  DAY_NAMES.forEach((d) => {
    const h = document.createElement("div");
    h.className = "cal-day-header";
    h.textContent = d;
    grid.appendChild(h);
  });

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const prevMonthDays = new Date(calYear, calMonth, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const classByDate = {};
  let calCount = 0;
  list.forEach((c) => {
    if (!c.startDate) return;
    let raw = c.startDate;
    if (raw && typeof raw === "object" && typeof raw.toDate === "function") {
      raw = raw.toDate();
    }
    const parsed = new Date(raw);
    if (isNaN(parsed.getTime())) return;
    const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
    if (!classByDate[key]) classByDate[key] = [];
    classByDate[key].push(c);
  });

  // Previous month padding
  for (let i = 0; i < firstDay; i++) {
    const d = prevMonthDays - firstDay + 1 + i;
    const cell = document.createElement("div");
    cell.className = "cal-cell other-month";
    const num = document.createElement("div");
    num.className = "cal-date-num";
    num.textContent = d;
    cell.appendChild(num);
    grid.appendChild(cell);
  }

  // Active month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const cell = document.createElement("div");
    cell.className = "cal-cell" + (dateStr === todayStr ? " today" : "");
    const num = document.createElement("div");
    num.className = "cal-date-num";
    num.textContent = d;
    cell.appendChild(num);

    const classes = classByDate[dateStr] || [];
    calCount += classes.length;
    classes.forEach((c) => {
      const card = document.createElement("div");
      card.className = "cal-card " + getCalCardClass(c.status);
      card.title = c.name;
      const title = document.createElement("div");
      title.className = "cal-card-title";
      title.textContent = c.name || "-";
      const meta = document.createElement("div");
      meta.className = "cal-card-meta";
      const done = c.meeting ? c.meeting.done || 0 : 0;
      meta.innerHTML = `<span>M:${done}</span>`;
      if (c.mentors && c.mentors.length) {
        meta.innerHTML += `<span>• ${c.mentors[0].name}</span>`;
      }
      if (c.type) {
        meta.innerHTML += `<span class="cal-type-badge">${c.type}</span>`;
      }
      card.appendChild(title);
      card.appendChild(meta);
      card.addEventListener("click", (e) => {
        e.stopPropagation();
        onOpenDetail(c.id);
      });
      cell.appendChild(card);
    });
    grid.appendChild(cell);
  }

  // Next month padding
  const totalCells = firstDay + daysInMonth;
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const cell = document.createElement("div");
    cell.className = "cal-cell other-month";
    const num = document.createElement("div");
    num.className = "cal-date-num";
    num.textContent = i;
    cell.appendChild(num);
    grid.appendChild(cell);
  }

  if (countEl) countEl.textContent = `${calCount} kelas`;
  if (window.lucide) window.lucide.createIcons();
}

export function renderStatusBreakdown(list) {
  const container = document.getElementById("statusBreakdownList");
  const legend = document.getElementById("statusLegend");
  if (!container) return;

  const statusOrder = ["Soon", "Running", "Reminder", "Stall", "Graduate", "Complete"];
  const breakdownStyles = {
    Soon: { badge: "status-breakdown-soon", bar: "status-bar-soon" },
    Running: { badge: "status-breakdown-running", bar: "status-bar-running" },
    Reminder: { badge: "status-breakdown-reminder", bar: "status-bar-reminder" },
    Stall: { badge: "status-breakdown-stall", bar: "status-bar-stall" },
    Graduate: { badge: "status-breakdown-graduate", bar: "status-bar-graduate" },
    Complete: { badge: "status-breakdown-complete", bar: "status-bar-complete" },
  };

  const counts = {};
  statusOrder.forEach((s) => (counts[s] = 0));
  list.forEach((c) => {
    const s = c.status || "Soon";
    if (!counts[s] && counts[s] !== 0) counts[s] = 0;
    counts[s] += 1;
  });

  const total = list.length || 1;
  container.innerHTML = "";

  statusOrder.forEach((s) => {
    const count = counts[s] || 0;
    const pct = Math.round((count / total) * 100);
    const breakdownClass = breakdownStyles[s] || {};
    const row = document.createElement("div");
    row.className = "flex items-center justify-between gap-2";
    const left = document.createElement("div");
    left.className = "flex items-center gap-2";
    const badge = document.createElement("span");
    badge.className = "status-pill status-breakdown " + (breakdownClass.badge || "");
    badge.textContent = s;
    const text = document.createElement("span");
    text.className = "text-[11px] text-slate-500 font-medium";
    text.textContent = `${count} kelas`;
    left.appendChild(badge);
    left.appendChild(text);

    const barOuter = document.createElement("div");
    barOuter.className = "flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden ml-2";
    const barInner = document.createElement("div");
    barInner.className = "h-1.5 rounded-full " + (breakdownClass.bar || "bg-slate-400");
    barInner.style.width = pct + "%";
    barOuter.appendChild(barInner);

    row.appendChild(left);
    row.appendChild(barOuter);
    container.appendChild(row);
  });

  if (legend) {
    legend.textContent = `Total ${list.length} kelas`;
  }
}

export function renderAtRiskClasses(list, onOpenDetail) {
  const container = document.getElementById("atRiskClassList");
  if (!container) return;
  container.innerHTML = "";

  const atRisk = list
    .filter((c) => c.status === "Stall" || (c.healthScore !== undefined ? c.healthScore : computeHealthScore(c)) < 6)
    .slice(0, 5);

  if (!atRisk.length) {
    const empty = document.createElement("div");
    empty.className = "text-[11px] text-slate-400 py-2 text-center";
    empty.textContent = "Tidak ada kelas berisiko tinggi saat ini.";
    container.appendChild(empty);
    return;
  }

  atRisk.forEach((c) => {
    const hs = c.healthScore !== undefined ? c.healthScore : computeHealthScore(c);
    const row = document.createElement("div");
    row.className =
      "flex items-start justify-between gap-2 p-2.5 rounded-xl bg-rose-50/50 border border-rose-100/80 transition hover:bg-rose-50";

    const left = document.createElement("div");
    left.className = "flex flex-col min-w-0";
    const name = document.createElement("div");
    name.className = "text-[11px] font-bold text-slate-800 truncate";
    name.textContent = c.name || "-";
    const meta = document.createElement("div");
    meta.className = "text-[10px] text-rose-600 font-medium";
    meta.textContent = `${c.status === "Stall" ? "Stall" : "Health Rendah"} • ${hs.toFixed(1)}/10`;
    left.appendChild(name);
    left.appendChild(meta);

    const btn = document.createElement("button");
    btn.className =
      "px-2.5 py-1 rounded-lg text-[10px] font-bold text-rose-700 bg-rose-100 hover:bg-rose-200 transition shrink-0";
    btn.textContent = "Lihat";
    btn.addEventListener("click", () => onOpenDetail(c.id));

    row.appendChild(left);
    row.appendChild(btn);
    container.appendChild(row);
  });
}

export function renderMeetingProgress(list) {
  const container = document.getElementById("meetingProgressList");
  const summary = document.getElementById("meetingSummary");
  if (!container) return;
  container.innerHTML = "";

  let totalDone = 0;
  let totalPlan = 0;
  list.forEach((c) => {
    const done = c.meeting ? c.meeting.done || 0 : 0;
    const total = c.meeting ? c.meeting.total || 0 : 0;
    totalDone += done;
    totalPlan += total;
  });

  const overallPct = totalPlan ? Math.round((totalDone / totalPlan) * 100) : 0;
  if (summary) {
    summary.textContent = `${totalDone}/${totalPlan} meeting (${overallPct}%)`;
  }

  const sorted = list
    .slice()
    .sort((a, b) => {
      const da = a.meeting ? (a.meeting.done || 0) / (a.meeting.total || 1) : 0;
      const db = b.meeting ? (b.meeting.done || 0) / (b.meeting.total || 1) : 0;
      return db - da;
    })
    .slice(0, 5);

  sorted.forEach((c) => {
    const done = c.meeting ? c.meeting.done || 0 : 0;
    const total = c.meeting ? c.meeting.total || 0 : 0;
    const pct = total ? Math.round((done / total) * 100) : 0;

    const row = document.createElement("div");
    row.className = "flex items-center justify-between gap-2";
    const left = document.createElement("div");
    left.className = "flex flex-col min-w-0";
    const name = document.createElement("div");
    name.className = "text-[11px] font-medium text-slate-800 truncate";
    name.textContent = c.name || "-";
    const meta = document.createElement("div");
    meta.className = "text-[10px] text-slate-400";
    meta.textContent = `${done}/${total} meeting • ${pct}%`;
    left.appendChild(name);
    left.appendChild(meta);

    const barOuter = document.createElement("div");
    barOuter.className = "w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden shrink-0";
    const barInner = document.createElement("div");
    barInner.className = "h-1.5 rounded-full bg-sky-500";
    barInner.style.width = pct + "%";
    barOuter.appendChild(barInner);

    row.appendChild(left);
    row.appendChild(barOuter);
    container.appendChild(row);
  });
}

export function populateFilterOptions(list) {
  const mentorSelect = document.getElementById("filterMentor");
  const picSelect = document.getElementById("filterPic");
  const locSelect = document.getElementById("filterLocation");

  if (mentorSelect) {
    const set = new Set();
    list.forEach((c) => {
      if (Array.isArray(c.mentors)) {
        c.mentors.forEach((m) => {
          if (m.name) set.add(m.name);
        });
      }
    });
    while (mentorSelect.options.length > 1) mentorSelect.remove(1);
    Array.from(set)
      .sort()
      .forEach((name) => {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        mentorSelect.appendChild(opt);
      });
  }

  if (picSelect) {
    const set = new Set();
    list.forEach((c) => {
      if (c.pic && c.pic.name) set.add(c.pic.name);
    });
    while (picSelect.options.length > 1) picSelect.remove(1);
    Array.from(set)
      .sort()
      .forEach((name) => {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        picSelect.appendChild(opt);
      });
  }

  if (locSelect) {
    const set = new Set();
    list.forEach((c) => {
      if (c.location) set.add(c.location);
    });
    while (locSelect.options.length > 1) locSelect.remove(1);
    Array.from(set)
      .sort()
      .forEach((loc) => {
        const opt = document.createElement("option");
        opt.value = loc;
        opt.textContent = loc;
        locSelect.appendChild(opt);
      });
  }
}

export function openDetailModal(c, onSaveComment, onDeleteClass) {
  const modal = document.getElementById("classDetailModal");
  if (!modal || !c) return;

  const avatar = document.getElementById("detailAvatar");
  const className = document.getElementById("detailClassName");
  const subtitle = document.getElementById("detailSubtitle");
  const statusBadge = document.getElementById("detailStatusBadge");
  const classNameValue = document.getElementById("detailClassNameValue");
  const statusText = document.getElementById("detailStatusText");
  const startDate = document.getElementById("detailStartDate");
  const location = document.getElementById("detailLocation");
  const pic = document.getElementById("detailPic");
  const notify = document.getElementById("detailNotify");
  const type = document.getElementById("detailType");
  const groupLink = document.getElementById("detailGroupLink");
  const mentorList = document.getElementById("detailMentorList");
  const meetingSummary = document.getElementById("detailMeetingSummary");
  const meetingPercent = document.getElementById("detailMeetingPercent");
  const meetingBar = document.getElementById("detailMeetingBar");
  const healthScoreEl = document.getElementById("detailHealthScore");
  const healthLabel = document.getElementById("detailHealthLabel");
  const healthMeta = document.getElementById("detailHealthMeta");
  const datesList = document.getElementById("detailDatesList");
  const attendanceEl = document.getElementById("detailAttendance");
  const delayEl = document.getElementById("detailDelay");
  const rescheduleEl = document.getElementById("detailReschedule");
  const healthBar = document.getElementById("detailHealthBar");
  const memberList = document.getElementById("detailMemberList");
  const fileList = document.getElementById("detailFileList");
  const comment = document.getElementById("detailComment");

  if (avatar) {
    const initials = (c.name || "C")
      .split(" ")
      .map((p) => p.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase();
    avatar.textContent = initials;
  }
  if (className) className.textContent = c.name || "-";
  if (subtitle) {
    subtitle.textContent = `${c.location || "Online"} • ${c.type || "Class"}`;
    if (c.isRemedial && c.parentClassName) {
      subtitle.textContent += ` | Parent: ${c.parentClassName}`;
    }
  }
  if (statusBadge) {
    statusBadge.innerHTML = "";
    const span = document.createElement("span");
    span.className = getStatusClass(c.status);
    span.textContent = c.status || "-";
    statusBadge.appendChild(span);
  }
  if (classNameValue) classNameValue.textContent = c.name || "-";
  if (statusText) statusText.textContent = c.status || "-";
  if (startDate) startDate.textContent = c.startDate || "-";
  if (location) location.textContent = c.location || "-";
  if (type) type.textContent = c.type || "-";
  if (groupLink) {
    groupLink.textContent = c.groupLink || "-";
    groupLink.href = c.groupLink || "#";
  }
  if (pic) {
    pic.innerHTML = "";
    if (c.pic && c.pic.name) {
      const avatarPic = document.createElement("div");
      avatarPic.className =
        "w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[9px] font-bold";
      avatarPic.textContent = (c.pic.initials || c.pic.name.charAt(0)).toUpperCase();
      const label = document.createElement("span");
      label.className = "text-xs text-slate-700 font-medium";
      label.textContent = c.pic.name;
      pic.appendChild(avatarPic);
      pic.appendChild(label);
    } else {
      pic.textContent = "-";
    }
  }
  if (notify) {
    notify.innerHTML = "";
    if (c.notify && c.notify.name) {
      const avatarNotify = document.createElement("div");
      avatarNotify.className =
        "w-5 h-5 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-[9px] font-bold";
      avatarNotify.textContent = (c.notify.initials || c.notify.name.charAt(0)).toUpperCase();
      const label = document.createElement("span");
      label.className = "text-xs text-slate-700 font-medium";
      label.textContent = c.notify.name;
      notify.appendChild(avatarNotify);
      notify.appendChild(label);
    } else {
      notify.textContent = "-";
    }
  }

  if (mentorList) {
    mentorList.innerHTML = "";
    if (Array.isArray(c.mentors) && c.mentors.length) {
      c.mentors.forEach((m) => {
        const chip = document.createElement("div");
        chip.className =
          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-medium";
        const av = document.createElement("div");
        av.className =
          "w-4 h-4 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center text-[8px] font-bold";
        av.textContent = (m.initials || (m.name || "M").charAt(0)).toUpperCase();
        const lbl = document.createElement("span");
        lbl.textContent = m.name || "-";
        chip.appendChild(av);
        chip.appendChild(lbl);
        mentorList.appendChild(chip);
      });
    } else {
      mentorList.textContent = "-";
    }
  }

  const done = c.meeting ? c.meeting.done || 0 : 0;
  const total = c.meeting ? c.meeting.total || 0 : 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  if (meetingSummary) meetingSummary.textContent = `${done}/${total} meeting`;
  if (meetingPercent) meetingPercent.textContent = `${pct}%`;
  if (meetingBar) meetingBar.style.width = `${pct}%`;

  const hs = c.healthScore !== undefined ? c.healthScore : computeHealthScore(c);
  const color = getHealthColor(hs);
  if (healthScoreEl) healthScoreEl.textContent = hs.toFixed(1);
  if (healthLabel) {
    if (color === "emerald") healthLabel.textContent = "Sehat";
    else if (color === "amber") healthLabel.textContent = "Perlu Dipantau";
    else healthLabel.textContent = "Berisiko";
  }
  if (healthMeta) {
    const attendance = typeof c.attendanceRate === "number" ? c.attendanceRate : 0;
    const delay = typeof c.delayCount === "number" ? c.delayCount : 0;
    const reschedule = typeof c.rescheduleCount === "number" ? c.rescheduleCount : 0;
    healthMeta.textContent = `Attendance ${attendance}% • Delay ${delay}x • Reschedule ${reschedule}x`;
  }

  if (datesList) {
    datesList.innerHTML = "";
    if (Array.isArray(c.dates) && c.dates.length) {
      c.dates.forEach((d) => {
        const row = document.createElement("div");
        row.className =
          "flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100";
        const left = document.createElement("div");
        left.className = "flex flex-col";
        const dt = document.createElement("div");
        dt.className = "text-[11px] font-semibold text-slate-800";
        dt.textContent = d.date || "-";
        const lbl = document.createElement("div");
        lbl.className = "text-[10px] text-slate-500";
        lbl.textContent = d.label || "-";
        left.appendChild(dt);
        left.appendChild(lbl);
        const tag = document.createElement("span");
        tag.className = "text-[10px] font-bold px-2 py-0.5 rounded-full";
        if (d.type === "meeting") {
          tag.className += " bg-emerald-50 text-emerald-700";
          tag.textContent = "Meeting";
        } else if (d.type === "reminder") {
          tag.className += " bg-amber-50 text-amber-700";
          tag.textContent = "Reminder";
        } else {
          tag.className += " bg-slate-100 text-slate-600";
          tag.textContent = "Other";
        }
        row.appendChild(left);
        row.appendChild(tag);
        datesList.appendChild(row);
      });
    } else {
      datesList.innerHTML = '<div class="text-[11px] text-slate-400 py-2">Belum ada jadwal atau reminder.</div>';
    }
  }

  const attendance = typeof c.attendanceRate === "number" ? c.attendanceRate : 0;
  const delay = typeof c.delayCount === "number" ? c.delayCount : 0;
  const reschedule = typeof c.rescheduleCount === "number" ? c.rescheduleCount : 0;
  if (attendanceEl) attendanceEl.textContent = `${attendance}%`;
  if (delayEl) delayEl.textContent = `${delay}x`;
  if (rescheduleEl) rescheduleEl.textContent = `${reschedule}x`;
  if (healthBar) {
    let barColor = "bg-emerald-500";
    if (color === "amber") barColor = "bg-amber-500";
    else if (color === "rose") barColor = "bg-rose-500";
    healthBar.className = `h-2 rounded-full ${barColor}`;
    healthBar.style.width = `${hs * 10}%`;
  }

  if (memberList) {
    memberList.innerHTML = `<div class="text-[11px] text-slate-500">Member count: ${c.membersCount || 0} orang</div>`;
  }

  if (fileList) {
    fileList.innerHTML = "";
    if (Array.isArray(c.files) && c.files.length) {
      c.files.forEach((f) => {
        const row = document.createElement("div");
        row.className =
          "flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100";
        const left = document.createElement("div");
        left.className = "flex items-center gap-2";
        const icon = document.createElement("div");
        icon.className =
          "w-6 h-6 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold";
        icon.textContent = (f.type || "file").substring(0, 3).toUpperCase();
        const name = document.createElement("div");
        name.className = "text-[11px] font-medium text-slate-800";
        name.textContent = f.name || "-";
        left.appendChild(icon);
        left.appendChild(name);
        const badge = document.createElement("span");
        badge.className = "text-[10px] text-slate-400";
        badge.textContent = f.type || "";
        row.appendChild(left);
        row.appendChild(badge);
        fileList.appendChild(row);
      });
    } else {
      fileList.innerHTML = '<div class="text-[11px] text-slate-400 py-2">Belum ada file yang diunggah.</div>';
    }
  }

  if (comment) {
    comment.value = c.comment || "";
  }

  // Bind save comment button
  const saveBtn = document.getElementById("btnDetailSave");
  if (saveBtn) {
    saveBtn.onclick = () => {
      onSaveComment(c.id, comment ? comment.value : "");
    };
  }

  // Bind delete button
  const deleteBtn = document.getElementById("btnDetailDelete");
  if (deleteBtn) {
    deleteBtn.onclick = () => {
      onDeleteClass(c.id, c.name);
    };
  }

  setActiveDetailTab("overview");
  modal.classList.add("open");
}

export function closeDetailModal() {
  const modal = document.getElementById("classDetailModal");
  if (modal) modal.classList.remove("open");
}

export function setActiveDetailTab(tabId) {
  const tabs = ["overview", "schedule", "attendance", "members", "files"];
  tabs.forEach((t) => {
    const btn = document.querySelector(`#detailTabList button[data-tab="${t}"]`);
    const panel = document.getElementById(`tab-${t}`);
    if (!btn || !panel) return;
    if (t === tabId) {
      btn.classList.add("tab-pill-active");
      btn.classList.remove("tab-pill-inactive");
      panel.classList.remove("hidden");
    } else {
      btn.classList.remove("tab-pill-active");
      btn.classList.add("tab-pill-inactive");
      panel.classList.add("hidden");
    }
  });
}

export function openAddClassModal(onSaveClass) {
  const modal = document.getElementById("addClassModal");
  if (!modal) return;
  modal.classList.add("open");

  const saveBtn = document.getElementById("btnAddClassSave");
  if (saveBtn) {
    saveBtn.onclick = () => {
      const nameEl = document.getElementById("inputClassName");
      const statusEl = document.getElementById("inputStatus");
      const typeEl = document.getElementById("inputType");
      const startEl = document.getElementById("inputStartDate");
      const locEl = document.getElementById("inputLocation");
      const picEl = document.getElementById("inputPic");
      const notifyEl = document.getElementById("inputNotify");
      const mentorEl = document.getElementById("inputMentor");
      const groupEl = document.getElementById("inputGroupLink");
      const totalEl = document.getElementById("inputMeetingTotal");
      const doneEl = document.getElementById("inputMeetingDone");

      if (!nameEl || !nameEl.value.trim()) {
        alertDialog("Nama kelas wajib diisi", {
          title: "Peringatan",
          type: "warning"
        });
        return;
      }

      const mentors = (mentorEl && mentorEl.value ? mentorEl.value.split(",") : [])
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name) => ({
          name,
          initials: name
            .split(" ")
            .map((p) => p.charAt(0))
            .join("")
            .slice(0, 2)
            .toUpperCase(),
        }));

      const newClassData = {
        name: nameEl.value.trim(),
        class_name: nameEl.value.trim(),
        status: statusEl ? statusEl.value : "Soon",
        class_status: statusEl ? statusEl.value : "Soon",
        startDate: startEl ? startEl.value : "",
        start_date: startEl ? startEl.value : "",
        date: startEl ? startEl.value : "",
        location: locEl ? locEl.value.trim() : "",
        type: typeEl ? typeEl.value : "Offline",
        pic: picEl && picEl.value ? { name: picEl.value.trim() } : null,
        notify: notifyEl && notifyEl.value ? { name: notifyEl.value.trim() } : null,
        meeting_done: doneEl && doneEl.value ? parseInt(doneEl.value, 10) : 0,
        meeting_total: totalEl && totalEl.value ? parseInt(totalEl.value, 10) : 8,
        mentors,
        mentor_name: mentorEl ? mentorEl.value.trim() : "",
        groupLink: groupEl ? groupEl.value.trim() : "",
        current_joined: 0,
      };

      onSaveClass(newClassData);
    };
  }
}

export function closeAddClassModal() {
  const modal = document.getElementById("addClassModal");
  if (modal) modal.classList.remove("open");
  const fields = [
    "inputClassName",
    "inputStatus",
    "inputType",
    "inputStartDate",
    "inputLocation",
    "inputPic",
    "inputNotify",
    "inputMentor",
    "inputGroupLink",
    "inputMeetingTotal",
    "inputMeetingDone",
  ];
  fields.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === "SELECT") el.selectedIndex = 0;
    else el.value = "";
  });
}

export function openPlanningModal() {
  const modal = document.getElementById("planningModal");
  if (modal) modal.classList.add("open");
}

export function closePlanningModal() {
  const modal = document.getElementById("planningModal");
  if (modal) modal.classList.remove("open");
}

/**
 * Initializes Standard Export Modal for Class Management.
 * @param {Function} [onFormatChange]
 * @param {Function} [onRangeChange]
 */
export function initClassExportModal(onFormatChange, onRangeChange) {
  return setupExportModalControls({
    modalId: "exportClassModal",
    onFormatChange,
    onRangeChange,
  });
}

/**
 * Mounts the Database Mapping button exclusively to the sidebar
 * when Class Management is active.
 */
export function mountSidebarClassErdButton() {
  const sidebarWrapper = document.querySelector("#dg-sidebar-mount .sidebar-scroll-wrapper");
  if (!sidebarWrapper) return;

  // Prevent duplicate mounts
  if (document.getElementById("sidebarBtnClassErd")) return;

  const linkEl = document.createElement("a");
  linkEl.href = "javascript:void(0)";
  linkEl.className = "sidebar-link";
  linkEl.id = "sidebarBtnClassErd";
  linkEl.setAttribute("data-bs-toggle", "modal");
  linkEl.setAttribute("data-bs-target", "#classErdModal");
  linkEl.setAttribute("role", "button");
  linkEl.innerHTML = `
    <i class="bi bi-database text-emerald-600"></i>
    <span>Database</span>
    <span class="sidebar-badge">
      <span class="badge bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">ERD</span>
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
 * Initializes Class Management ERD modal tabs, search, filters, SVG connectors & copy button.
 */
export function initClassErdModalControls() {
  const modalEl = document.getElementById("classErdModal");
  if (!modalEl) return;

  // Tab controls
  const tabVisualBtn = document.getElementById("classErdTabVisualBtn");
  const tabDictBtn = document.getElementById("classErdTabDictBtn");
  const tabSqlBtn = document.getElementById("classErdTabSqlBtn");

  const tabVisualContent = document.getElementById("classErdTabVisualContent");
  const tabDictContent = document.getElementById("classErdTabDictContent");
  const tabSqlContent = document.getElementById("classErdTabSqlContent");

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
        setTimeout(drawClassErdRelations, 80);
      }
    });
  });

  // Kamus Data (Data Dictionary) Search & Table Filter
  const searchInput = document.getElementById("classErdDictSearchInput");
  const tableFilter = document.getElementById("classErdDictTableFilter");
  const dictTableBody = document.getElementById("classErdDictTableBody");
  const countBadge = document.getElementById("classErdDictCountBadge");

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
  const btnCopySql = document.getElementById("classBtnCopySqlScript");
  const btnCopyText = document.getElementById("classBtnCopySqlText");
  const sqlContent = document.getElementById("classSqlScriptContent");

  btnCopySql?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(sqlContent?.textContent || "");
      if (btnCopyText) btnCopyText.textContent = "Tersalin!";
      setTimeout(() => {
        if (btnCopyText) btnCopyText.textContent = "Salin Script SQL";
      }, 2500);
    } catch (err) {
      console.error("Gagal menyalin SQL:", err);
    }
  });

  // Copy Docs Path Button
  const btnCopyDocs = document.getElementById("classBtnCopyDocsPath");
  btnCopyDocs?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText("docs/CLASS-DATABASE-MAPPING.md");
      const orig = btnCopyDocs.innerHTML;
      btnCopyDocs.innerHTML = `<i class="bi bi-check2 text-emerald-600"></i><span>Tersalin!</span>`;
      setTimeout(() => {
        btnCopyDocs.innerHTML = orig;
      }, 2000);
    } catch (e) {
      console.error("Gagal menyalin path:", e);
    }
  });

  // =====================================================================
  // DYNAMIC SVG RELATIONS
  // =====================================================================
  const wrapper = document.getElementById("classErdDiagramWrapper");
  const svgGroup = document.getElementById("classErdPathsGroup");

  const relationConfigs = [
    {
      id: "mentor-class",
      from: document.getElementById("classErdAnchorMentorsId"),
      to: document.getElementById("classErdTargetClassesMentorId"),
      card: document.getElementById("classCardClasses"),
      color: "#f59e0b",
      marker: "url(#classErdArrowAmber)",
      label: "1 : N (mentor_id)",
      y1Offset: 0,
      tBadge: 0.50,
    },
    {
      id: "class-schedule",
      from: document.getElementById("classErdAnchorClassesId"),
      to: document.getElementById("classErdTargetSchedulesClassId"),
      card: document.getElementById("classCardSchedules"),
      color: "#0d9488",
      marker: "url(#classErdArrowTeal)",
      label: "1 : N (class_id)",
      y1Offset: -7,
      tBadge: 0.40,
    },
    {
      id: "class-member",
      from: document.getElementById("classErdAnchorClassesId"),
      to: document.getElementById("classErdTargetMembersClassId"),
      card: document.getElementById("classCardMembers"),
      color: "#6366f1",
      marker: "url(#classErdArrowIndigo)",
      label: "1 : N (class_id)",
      y1Offset: 7,
      tBadge: 0.60,
    },
  ];

  let currentActiveRel = "all";

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

  function drawClassErdRelations() {
    if (!wrapper || !svgGroup) return;
    if (window.innerWidth < 1024) {
      svgGroup.innerHTML = "";
      return;
    }

    const wrapRect = wrapper.getBoundingClientRect();
    if (wrapRect.width === 0 || wrapRect.height === 0) return;

    let svgHtml = "";

    relationConfigs.forEach((cfg) => {
      if (!cfg.from || !cfg.to) return;
      const fromRect = cfg.from.getBoundingClientRect();
      const toRect = cfg.to.getBoundingClientRect();
      if (fromRect.width === 0 || toRect.width === 0) return;

      // Start: Right edge of origin card (with small vertical offset to prevent overlap)
      const x1 = fromRect.right - wrapRect.left;
      const y1 = fromRect.top + fromRect.height / 2 - wrapRect.top + (cfg.y1Offset || 0);

      // End: Left edge of target card
      const x2 = toRect.left - wrapRect.left;
      const y2 = toRect.top + toRect.height / 2 - wrapRect.top;

      // Smooth horizontal curve across column gap
      const dx = Math.max(30, Math.abs(x2 - x1) * 0.45);
      const p0 = { x: x1, y: y1 };
      const p1 = { x: x1 + dx, y: y1 };
      const p2 = { x: x2 - dx, y: y2 };
      const p3 = { x: x2, y: y2 };

      const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      const badgePos = getBezierPoint(cfg.tBadge || 0.5, p0, p1, p2, p3);

      const isCurrentActive = currentActiveRel === "all" || currentActiveRel === cfg.id;
      const opacity = isCurrentActive ? 1 : 0.15;
      const strokeWidth = isCurrentActive && currentActiveRel !== "all" ? 3.5 : 2.2;

      svgHtml += `
        <g class="erd-relation-path-group" data-rel-id="${cfg.id}" style="opacity: ${opacity};">
          <!-- Glow halo -->
          <path d="${d}" stroke="${cfg.color}" stroke-width="7" fill="none" opacity="0.18" stroke-linecap="round" />
          <!-- Animated connecting line -->
          <path d="${d}" stroke="${cfg.color}" stroke-width="${strokeWidth}" fill="none" 
            marker-start="url(#classErdDotStart)" marker-end="${cfg.marker}" 
            stroke-dasharray="6 3" class="erd-relation-path" />
          <!-- Center badge -->
          <g transform="translate(${badgePos.x}, ${badgePos.y})">
            <rect x="-34" y="-9" width="68" height="18" rx="6" fill="#ffffff" stroke="${cfg.color}" stroke-width="1.5" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.1))" />
            <text x="0" y="3.5" text-anchor="middle" font-size="9" font-family="'JetBrains Mono', monospace" font-weight="700" fill="${cfg.color}">
              1 : N
            </text>
          </g>
        </g>
      `;
    });

    svgGroup.innerHTML = svgHtml;

    svgGroup.querySelectorAll(".erd-relation-path-group").forEach((grp) => {
      grp.addEventListener("click", () => {
        const relId = grp.getAttribute("data-rel-id");
        if (relId) setActiveRelation(relId === currentActiveRel ? "all" : relId);
      });
    });
  }

  const classCards = [
    document.getElementById("classCardMentors"),
    document.getElementById("classCardClasses"),
    document.getElementById("classCardSchedules"),
    document.getElementById("classCardMembers"),
  ];

  function setActiveRelation(relId) {
    currentActiveRel = relId;

    document.querySelectorAll("#classErdPills .erd-rel-pill").forEach((pill) => {
      const pRel = pill.getAttribute("data-rel");
      if (pRel === relId) {
        pill.classList.add("active");
      } else {
        pill.classList.remove("active");
      }
    });

    let activeCardIds = [];
    if (relId === "mentor-class") {
      activeCardIds = ["classCardMentors", "classCardClasses"];
    } else if (relId === "class-schedule") {
      activeCardIds = ["classCardClasses", "classCardSchedules"];
    } else if (relId === "class-member") {
      activeCardIds = ["classCardClasses", "classCardMembers"];
    }

    classCards.forEach((card) => {
      if (!card) return;
      if (relId === "all") {
        card.classList.remove("relation-highlight", "relation-faded");
      } else if (activeCardIds.includes(card.id)) {
        card.classList.add("relation-highlight");
        card.classList.remove("relation-faded");
      } else {
        card.classList.remove("relation-highlight");
        card.classList.add("relation-faded");
      }
    });

    drawClassErdRelations();
  }

  document.querySelectorAll("#classErdPills .erd-rel-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const rel = pill.getAttribute("data-rel") || "all";
      setActiveRelation(rel);
    });
  });

  modalEl.addEventListener("shown.bs.modal", () => {
    setTimeout(drawClassErdRelations, 80);
  });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawClassErdRelations, 100);
  });
}

/* ==========================================================================
   REMEDIAL MANAGEMENT UI PRESENTATION LAYER (Zero Firebase)
   ========================================================================== */

export const REMEDIAL_MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

export const REMEDIAL_MONTH_NAMES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function positionGlider(gliderEl, targetBtnEl, isInitial = false) {
  if (!gliderEl || !targetBtnEl) return;
  if (targetBtnEl.offsetWidth === 0) return;

  const left = targetBtnEl.offsetLeft;
  const top = targetBtnEl.offsetTop;
  const width = targetBtnEl.offsetWidth;
  const height = targetBtnEl.offsetHeight;

  if (isInitial) {
    gliderEl.style.transition = "none";
  } else {
    gliderEl.style.transition =
      "transform 0.32s cubic-bezier(0.34, 1.35, 0.64, 1), width 0.26s cubic-bezier(0.34, 1.35, 0.64, 1), background-color 0.25s ease, box-shadow 0.25s ease";
  }

  gliderEl.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  gliderEl.style.width = `${width}px`;
  gliderEl.style.height = `${height}px`;

  if (isInitial) {
    requestAnimationFrame(() => {
      setTimeout(() => {
        gliderEl.style.transition =
          "transform 0.32s cubic-bezier(0.34, 1.35, 0.64, 1), width 0.26s cubic-bezier(0.34, 1.35, 0.64, 1), background-color 0.25s ease, box-shadow 0.25s ease";
      }, 50);
    });
  }
}

export function getRemedialStatusStyle(status) {
  const s = String(status || "REQUEST").toUpperCase();
  switch (s) {
    case "REQUEST":
      return {
        dot: "bg-rose-500",
        chip: "border-l-rose-500 bg-rose-50/90 text-rose-900 hover:bg-rose-100",
        badge: "bg-rose-100 text-rose-800 border-rose-200",
        text: "REQUEST",
      };
    case "CONTACT":
      return {
        dot: "bg-purple-500",
        chip: "border-l-purple-500 bg-purple-50/90 text-purple-900 hover:bg-purple-100",
        badge: "bg-purple-100 text-purple-800 border-purple-200",
        text: "CONTACT",
      };
    case "PROCESS":
      return {
        dot: "bg-orange-500",
        chip: "border-l-orange-500 bg-orange-50/90 text-orange-900 hover:bg-orange-100",
        badge: "bg-orange-100 text-orange-800 border-orange-200",
        text: "PROCESS",
      };
    case "SCHEDULE":
      return {
        dot: "bg-sky-500",
        chip: "border-l-sky-500 bg-sky-50/90 text-sky-900 hover:bg-sky-100",
        badge: "bg-sky-100 text-sky-800 border-sky-200",
        text: "SCHEDULE",
      };
    case "RESCHEDULE":
      return {
        dot: "bg-fuchsia-500",
        chip: "border-l-fuchsia-500 bg-fuchsia-50/90 text-fuchsia-900 hover:bg-fuchsia-100",
        badge: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
        text: "RESCHEDULE",
      };
    case "STALL":
      return {
        dot: "bg-slate-500",
        chip: "border-l-slate-500 bg-slate-100 text-slate-800 hover:bg-slate-200",
        badge: "bg-slate-200 text-slate-800 border-slate-300",
        text: "STALL",
      };
    case "COMPLETE":
      return {
        dot: "bg-emerald-500",
        chip: "border-l-emerald-500 bg-emerald-50/90 text-emerald-900 hover:bg-emerald-100",
        badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
        text: "COMPLETE",
      };
    default:
      return {
        dot: "bg-slate-400",
        chip: "border-l-slate-400 bg-slate-50 text-slate-700",
        badge: "bg-slate-100 text-slate-700 border-slate-200",
        text: s,
      };
  }
}

export function getClickUpStatusMeta(status) {
  const s = String(status || "REQUEST").toUpperCase();
  switch (s) {
    case "STALL":
      return {
        label: "STALL",
        badgeBg: "bg-[#475569]",
        ringBorder: "border-[#475569]",
        iconHtml: `<i data-lucide="check-circle-2" class="w-3.5 h-3.5 stroke-[2.5]"></i>`,
      };
    case "RESCHEDULE":
      return {
        label: "RESCHEDULE",
        badgeBg: "bg-[#9333ea]",
        ringBorder: "border-[#a855f7]",
        iconHtml: `<i data-lucide="clock" class="w-3.5 h-3.5 stroke-[2.5]"></i>`,
      };
    case "SCHEDULE":
      return {
        label: "SCHEDULE",
        badgeBg: "bg-[#0284c7]",
        ringBorder: "border-[#0ea5e9]",
        iconHtml: `<i data-lucide="circle-dot" class="w-3.5 h-3.5 stroke-[2.5]"></i>`,
      };
    case "PROCESS":
      return {
        label: "PROCESS",
        badgeBg: "bg-[#ea580c]",
        ringBorder: "border-[#f97316]",
        iconHtml: `<i data-lucide="clock-3" class="w-3.5 h-3.5 stroke-[2.5]"></i>`,
      };
    case "CONTACT":
      return {
        label: "CONTACT",
        badgeBg: "bg-[#9333ea]",
        ringBorder: "border-[#a855f7]",
        iconHtml: `<i data-lucide="circle-dashed" class="w-3.5 h-3.5 stroke-[2.5]"></i>`,
      };
    case "REQUEST":
      return {
        label: "REQUEST",
        badgeBg: "bg-[#dc2626]",
        ringBorder: "border-[#ef4444]",
        iconHtml: `<i data-lucide="circle-dashed" class="w-3.5 h-3.5 stroke-[2.5]"></i>`,
      };
    case "COMPLETE":
      return {
        label: "COMPLETE",
        badgeBg: "bg-[#16a34a]",
        ringBorder: "border-[#22c55e]",
        iconHtml: `<i data-lucide="check-check" class="w-3.5 h-3.5 stroke-[2.5]"></i>`,
      };
    default:
      return {
        label: s,
        badgeBg: "bg-slate-500",
        ringBorder: "border-slate-400",
        iconHtml: `<i data-lucide="circle" class="w-3.5 h-3.5 stroke-[2.5]"></i>`,
      };
  }
}

export function formatClickUpPhone(rawPhone) {
  if (!rawPhone || rawPhone === "-") return "-";
  const digits = String(rawPhone).replace(/\D/g, "");
  if (digits.startsWith("62")) {
    const local = "0" + digits.slice(2);
    if (local.length === 11) return `${local.slice(0, 4)}-${local.slice(4, 7)}-${local.slice(7)}`;
    if (local.length >= 12) return `${local.slice(0, 4)}-${local.slice(4, 8)}-${local.slice(8)}`;
    return local;
  }
  if (digits.startsWith("0")) {
    if (digits.length === 11) return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
    if (digits.length >= 12) return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`;
    return digits;
  }
  return String(rawPhone);
}

export function formatClickUpDate(val) {
  if (!val) return "-";
  let d = null;
  if (typeof val === "object" && typeof val.toDate === "function") {
    d = val.toDate();
  } else if (val instanceof Date) {
    d = val;
  } else if (typeof val === "string") {
    const m = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    } else {
      d = new Date(val);
    }
  }
  if (!d || isNaN(d.getTime())) return String(val).slice(0, 10);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const year2 = String(d.getFullYear()).slice(-2);
  return `${month}/${day}/${year2}`;
}

export function parseItemDateKey(item, mode) {
  let raw = mode === "created" ? item.created_at : (item.schedule_date || item.scheduled_date || item.date);
  if (!raw) return null;
  if (typeof raw === "object" && typeof raw.toDate === "function") {
    raw = raw.toDate();
  }
  if (typeof raw === "string") {
    const m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
    }
  }
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseItemTimeStr(item) {
  let raw = item.schedule_date || item.scheduled_date || item.date;
  if (!raw) return "";
  if (typeof raw === "object" && typeof raw.toDate === "function") {
    raw = raw.toDate();
  }
  if (typeof raw === "string") {
    const m = raw.match(/(?:T|\s)(\d{1,2}):(\d{2})/);
    if (m) return `${m[1]}:${m[2]}`;
  }
  if (raw instanceof Date) {
    return `${String(raw.getHours()).padStart(2, "0")}:${String(raw.getMinutes()).padStart(2, "0")}`;
  }
  return item.schedule_time || "";
}

export function getClassDates(c) {
  if (!c) return [];
  const datesSet = new Set();
  const normalize = (v) => {
    if (!v) return null;
    if (typeof v === "object" && typeof v.toDate === "function") v = v.toDate();
    if (v instanceof Date && !isNaN(v.getTime())) {
      return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
    }
    const str = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    return null;
  };
  const start = normalize(c.startDate || c.date || c.start_date);
  if (start) datesSet.add(start);
  if (Array.isArray(c.dates)) {
    c.dates.forEach((d) => {
      if (typeof d === "string") {
        const n = normalize(d);
        if (n) datesSet.add(n);
      } else if (d && typeof d === "object") {
        const n = normalize(d.date || d.start_date);
        if (n) datesSet.add(n);
      }
    });
  }
  return Array.from(datesSet);
}

export function getItemCommentCount(item) {
  if (!item) return 0;
  if (Array.isArray(item.comments)) return item.comments.length;
  if (typeof item.comments_count === "number") return item.comments_count;
  return 0;
}

export function renderClickUpMeetingBadges(item) {
  let nums = [];
  if (Array.isArray(item.meeting_numbers) && item.meeting_numbers.length > 0) {
    nums = item.meeting_numbers.slice();
  } else if (item.meeting_number) {
    nums = [parseInt(item.meeting_number, 10) || 1];
  } else {
    nums = [1];
  }

  const maxBadges = 3;
  const visibleNums = nums.slice(0, maxBadges);
  const extraCount = nums.length - maxBadges;

  const badgesHtml = visibleNums.map((n) => {
    const numStr = String(n).padStart(2, "0");
    let badgeClass = "badge-meeting-teal";
    if (n >= 4 && n <= 5) {
      badgeClass = "badge-meeting-rose";
    } else if (n === 6) {
      badgeClass = "badge-meeting-teal";
    } else if (n === 7) {
      badgeClass = "badge-meeting-orange";
    } else if (n >= 8) {
      badgeClass = "badge-meeting-slate";
    }
    return `<span class="clickup-meeting-badge ${badgeClass}" title="Pertemuan ${n}">${numStr}</span>`;
  }).join("");

  const moreHtml =
    extraCount > 0
      ? `<span class="clickup-meeting-badge badge-meeting-more" title="+${extraCount} pertemuan lainnya">+${extraCount}</span>`
      : "";

  return badgesHtml + moreHtml;
}

export function renderClickUpMentorBadge(mentorName) {
  const name = (mentorName || "-").trim();
  if (name === "-" || !name) {
    return `<span class="text-slate-400 text-[11px]">-</span>`;
  }

  let styleClass = "bg-slate-100 text-slate-700 border-slate-200";
  const lower = name.toLowerCase();
  if (lower.includes("fanny")) {
    styleClass = "bg-[#fdf2f8] text-[#db2777] border-[#fbcfe8]";
  } else if (lower.includes("bani")) {
    styleClass = "bg-[#f5f3ff] text-[#7c3aed] border-[#ddd6fe]";
  } else if (lower.includes("salsabila")) {
    styleClass = "bg-[#f0f9ff] text-[#0284c7] border-[#bae6fd]";
  } else if (lower.includes("afra")) {
    styleClass = "bg-[#fffbeb] text-[#d97706] border-[#fde68a]";
  } else if (lower.includes("dian")) {
    styleClass = "bg-[#ecfdf5] text-[#059669] border-[#a7f3d0]";
  } else if (lower.includes("bella")) {
    styleClass = "bg-[#fdf4ff] text-[#c026d3] border-[#f0abfc]";
  } else if (lower.includes("jonathan")) {
    styleClass = "bg-[#eef2ff] text-[#4f46e5] border-[#c7d2fe]";
  } else if (lower.includes("faris")) {
    styleClass = "bg-[#fef2f2] text-[#dc2626] border-[#fecaca]";
  } else if (lower.includes("nurallah")) {
    styleClass = "bg-[#f0fdf4] text-[#16a34a] border-[#bbf7d0]";
  }

  return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border whitespace-nowrap ${styleClass}" title="Mentor: ${escapeHtml(
    name
  )}">${escapeHtml(name)}</span>`;
}

export function renderRemedialKPIs(counts) {
  const ids = {
    REQUEST: "badgeCountRequest",
    CONTACT: "badgeCountContact",
    PROCESS: "badgeCountProcess",
    SCHEDULE: "badgeCountSchedule",
    RESCHEDULE: "badgeCountReschedule",
    STALL: "badgeCountStall",
    COMPLETE: "badgeCountComplete",
  };
  Object.keys(ids).forEach((k) => {
    const el = document.getElementById(ids[k]);
    if (el) el.textContent = String(counts[k] || 0);
  });
}

export function renderRemedialBoard(reports, onStatusChange, onCommentClick, onDeleteClick, onCardClick) {
  const statuses = ["REQUEST", "CONTACT", "PROCESS", "SCHEDULE", "RESCHEDULE", "STALL", "COMPLETE"];

  statuses.forEach((statusKey) => {
    const colEl = document.querySelector(`.remedial-col[data-status="${statusKey}"]`);
    const countEl = colEl ? colEl.querySelector(".col-count") : null;
    const listEl = colEl ? colEl.querySelector(`.cards-list[data-status="${statusKey}"]`) : null;

    const itemsInCol = reports.filter(
      (r) => (r.status || "REQUEST").toUpperCase() === statusKey
    );

    if (countEl) countEl.textContent = itemsInCol.length;
    if (!listEl) return;

    listEl.innerHTML = "";

    if (itemsInCol.length === 0) {
      const emptyEl = document.createElement("div");
      emptyEl.className =
        "text-center py-10 px-3 text-slate-400 text-[11px] border-2 border-dashed border-slate-200/80 rounded-2xl flex flex-col items-center justify-center gap-1.5";
      emptyEl.innerHTML = `
        <i data-lucide="inbox" class="w-5 h-5 text-slate-300"></i>
        <span>Kosong</span>
      `;
      listEl.appendChild(emptyEl);
      return;
    }

    itemsInCol.forEach((item, index) => {
      const card = document.createElement("div");
      card.draggable = true;
      card.dataset.id = item.id;

      const isSingle = itemsInCol.length === 1;
      const hasPuzzleTop = !isSingle && index > 0;
      const hasPuzzleBottom = !isSingle && index < itemsInCol.length - 1;

      let puzzleClass = "";
      if (!isSingle) {
        if (index === 0) puzzleClass = "puzzle-piece-top";
        else if (index === itemsInCol.length - 1) puzzleClass = "puzzle-piece-bottom";
        else puzzleClass = "puzzle-piece-middle";
      }
      card.className = `remedial-card ${puzzleClass}`.trim();

      let meetingTagStr = "";
      let meetingNum = 1;
      if (Array.isArray(item.meeting_numbers) && item.meeting_numbers.length > 0) {
        meetingNum = item.meeting_numbers[0];
        meetingTagStr = item.meeting_numbers.map((n) => `P${String(n).padStart(2, "0")}`).join(", ");
      } else {
        meetingNum = parseInt(item.meeting_number || "1", 10);
        meetingTagStr = `P${String(meetingNum).padStart(2, "0")}`;
      }

      let tagColorClass = "bg-teal-100 text-teal-800 border-teal-200";
      if (meetingNum >= 4 && meetingNum <= 6) tagColorClass = "bg-sky-100 text-sky-800 border-sky-200";
      if (meetingNum >= 7 && meetingNum <= 8) tagColorClass = "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200";
      if (meetingNum > 8) tagColorClass = "bg-amber-100 text-amber-800 border-amber-200";

      let cleanPhone = String(item.phone || "").replace(/\D/g, "");
      if (cleanPhone.startsWith("0")) cleanPhone = "62" + cleanPhone.slice(1);
      if (!cleanPhone.startsWith("62") && cleanPhone.length > 5) cleanPhone = "62" + cleanPhone;

      const resolvedClass = item.group_whatsapp || item.class_name || "";
      const hasClass = Boolean(resolvedClass && resolvedClass !== "-");
      const classText = hasClass ? ` di ${resolvedClass}` : "";
      const waMsg = encodeURIComponent(
        `Halo kak ${item.name}, kami dari Admin Kelas Dialogika mengenai pengajuan remedial ${
          item.meeting_missed || "pertemuan kelas"
        }${classText}. Apakah saat ini kakak bisa konfirmasi jadwal kelas penggantinya? Terima kasih!`
      );

      const mentorInitials = (item.mentor_name || "M")
        .split(" ")
        .filter(Boolean)
        .map((p) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

      card.innerHTML = `
        ${
          hasPuzzleTop
            ? `<div class="puzzle-socket-container">
                 <div class="puzzle-socket" data-status="${statusKey}"></div>
               </div>`
            : ""
        }

        <div class="flex items-start justify-between gap-2">
          <div class="font-bold text-slate-900 text-xs leading-snug break-words">
            ${escapeHtml(item.name)}
          </div>
          <span class="tag-meeting ${tagColorClass} border flex-shrink-0" title="Pertemuan ke-${meetingNum}">
            ${meetingTagStr}
          </span>
        </div>

        <div class="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
          <i data-lucide="layers" class="w-3 h-3 text-slate-300"></i>
          <span>In Remedial Report</span>
        </div>

        ${
          hasClass
            ? `<div class="mt-2 text-[11px] font-medium text-slate-700 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100 truncate" title="${escapeHtml(
                resolvedClass
              )}">
                <i data-lucide="book-open" class="w-3 h-3 inline text-slate-400 mr-1"></i>
                <span>${escapeHtml(resolvedClass)}</span>
               </div>`
            : ""
        }

        <div class="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
          <div class="flex items-center gap-1.5 truncate">
            <span class="w-4 h-4 rounded-full bg-slate-200 text-slate-700 font-extrabold text-[8px] flex items-center justify-center flex-shrink-0">
              ${mentorInitials}
            </span>
            <span class="truncate">${escapeHtml(item.mentor_name)}</span>
          </div>
          ${
            cleanPhone.length > 5
              ? `<a href="https://wa.me/${cleanPhone}?text=${waMsg}" target="_blank" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[10px] font-bold border border-emerald-200 transition" title="Kirim Pesan WhatsApp">
                  <i data-lucide="message-circle" class="w-3 h-3 text-emerald-600"></i> WA
                 </a>`
              : ""
          }
        </div>

        ${
          item.reason && item.reason !== "-"
            ? `<div class="mt-2 text-[10px] text-slate-500 italic bg-amber-50/50 border border-amber-100/60 p-1.5 rounded-lg line-clamp-2" title="${escapeHtml(
                item.reason
              )}">
                "${escapeHtml(item.reason)}"
               </div>`
            : ""
        }

        <div class="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          <div class="flex-1">
            <select class="remedial-status-changer text-[10px] font-bold py-1 px-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white text-slate-700 w-full focus:outline-none focus:ring-1 focus:ring-sky-500">
              <option value="STALL" ${statusKey === "STALL" ? "selected" : ""}>⚫ STALL</option>
              <option value="RESCHEDULE" ${statusKey === "RESCHEDULE" ? "selected" : ""}>🟪 RESCHEDULE</option>
              <option value="SCHEDULE" ${statusKey === "SCHEDULE" ? "selected" : ""}>🔵 SCHEDULE</option>
              <option value="PROCESS" ${statusKey === "PROCESS" ? "selected" : ""}>🟠 PROCESS</option>
              <option value="CONTACT" ${statusKey === "CONTACT" ? "selected" : ""}>🟣 CONTACT</option>
              <option value="REQUEST" ${statusKey === "REQUEST" ? "selected" : ""}>🔴 REQUEST</option>
              <option value="COMPLETE" ${statusKey === "COMPLETE" ? "selected" : ""}>🟢 COMPLETE</option>
            </select>
          </div>
          <button type="button" class="btn-card-comments p-1 text-slate-400 hover:text-sky-600 rounded-md hover:bg-sky-50 transition flex items-center gap-1 text-[11px] cursor-pointer" title="Buka Komentar" data-id="${
            item.id
          }">
            <i data-lucide="message-square" class="w-3.5 h-3.5"></i>
            <span class="text-[10px] font-bold">${getItemCommentCount(item)}</span>
          </button>
          <button type="button" class="btn-delete-card p-1 text-slate-300 hover:text-rose-500 rounded-md hover:bg-rose-50 transition" title="Hapus kartu ini">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>

        ${
          hasPuzzleBottom
            ? `<div class="puzzle-knob-container">
                 <div class="puzzle-knob" data-status="${statusKey}" title="Puzzle Interlock (${statusKey})">
                   <span class="puzzle-knob-core"></span>
                 </div>
               </div>`
            : ""
        }
      `;

      const statusSelect = card.querySelector(".remedial-status-changer");
      if (statusSelect) {
        statusSelect.addEventListener("click", (e) => e.stopPropagation());
        statusSelect.addEventListener("change", (e) => {
          e.stopPropagation();
          if (onStatusChange) onStatusChange(item.id, e.target.value);
        });
      }

      const cmtBtn = card.querySelector(".btn-card-comments");
      if (cmtBtn) {
        cmtBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (onCommentClick) onCommentClick(item.id);
        });
      }

      const deleteBtn = card.querySelector(".btn-delete-card");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (onDeleteClick) onDeleteClick(item.id, item.name);
        });
      }

      let isDragging = false;
      card.addEventListener("dragstart", (e) => {
        isDragging = true;
        card.classList.add("dragging");
        e.dataTransfer.setData("text/plain", item.id);
      });
      card.addEventListener("dragend", () => {
        setTimeout(() => {
          isDragging = false;
          card.classList.remove("dragging");
        }, 60);
      });

      card.addEventListener("click", (e) => {
        if (isDragging) return;
        if (
          e.target.closest(".remedial-status-changer, .btn-card-comments, .btn-delete-card, a, button, select")
        ) {
          return;
        }
        if (onCardClick) onCardClick(item.id);
      });

      listEl.appendChild(card);
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

export function renderRemedialCalendar(
  reports,
  calYear,
  calMonth,
  dateMode,
  showCheckupLayer,
  classesState,
  onDayClick,
  onChipClick,
  onQuickAdd,
  onScheduleUnscheduled
) {
  const grid = document.getElementById("remedialCalGrid");
  const monthLabel = document.getElementById("remedialCalMonthLabel");
  const activeCountBadge = document.getElementById("remedialCalActiveCountBadge");
  const checkupCountBadge = document.getElementById("remedialCalCheckupCountBadge");
  const unscheduledBadge = document.getElementById("remedialUnscheduledCountBadge");
  const unscheduledPanelBadge = document.getElementById("unscheduledPanelBadge");
  const unscheduledContainer = document.getElementById("unscheduledListContainer");
  if (!grid) return;

  const monthName = REMEDIAL_MONTH_NAMES_EN[calMonth] || REMEDIAL_MONTH_NAMES[calMonth];
  if (monthLabel) {
    monthLabel.textContent = `${monthName} ${calYear}`;
  }

  const itemsByDate = {};
  const unscheduledList = [];
  let scheduledThisMonthCount = 0;

  reports.forEach((item) => {
    const dateKey = parseItemDateKey(item, dateMode);
    const s = String(item.status || "REQUEST").toUpperCase();
    const isScheduledStage = s === "SCHEDULE" || s === "RESCHEDULE" || s === "COMPLETE";

    if (dateMode === "schedule") {
      if (!isScheduledStage) return;

      if (dateKey) {
        if (!itemsByDate[dateKey]) itemsByDate[dateKey] = [];
        itemsByDate[dateKey].push(item);

        const [y, m] = dateKey.split("-").map(Number);
        if (y === calYear && m === calMonth + 1) {
          scheduledThisMonthCount++;
        }
      } else {
        unscheduledList.push(item);
      }
    } else {
      if (dateKey) {
        if (!itemsByDate[dateKey]) itemsByDate[dateKey] = [];
        itemsByDate[dateKey].push(item);

        const [y, m] = dateKey.split("-").map(Number);
        if (y === calYear && m === calMonth + 1) {
          scheduledThisMonthCount++;
        }
      } else {
        unscheduledList.push(item);
      }
    }
  });

  const classesByDate = {};
  let checkupClassesThisMonthCount = 0;

  if (showCheckupLayer && Array.isArray(classesState)) {
    classesState.forEach((c) => {
      const dates = getClassDates(c);
      dates.forEach((dateKey) => {
        if (!classesByDate[dateKey]) classesByDate[dateKey] = [];
        classesByDate[dateKey].push(c);

        const [y, m] = dateKey.split("-").map(Number);
        if (y === calYear && m === calMonth + 1) {
          checkupClassesThisMonthCount++;
        }
      });
    });
  }

  if (activeCountBadge) {
    activeCountBadge.textContent = `${scheduledThisMonthCount} Terjadwal`;
  }
  if (checkupCountBadge) {
    if (showCheckupLayer) {
      checkupCountBadge.textContent = `${checkupClassesThisMonthCount} Kelas Check-Up`;
      checkupCountBadge.classList.remove("hidden");
    } else {
      checkupCountBadge.classList.add("hidden");
    }
  }
  if (unscheduledBadge) unscheduledBadge.textContent = String(unscheduledList.length);
  if (unscheduledPanelBadge) unscheduledPanelBadge.textContent = String(unscheduledList.length);

  grid.innerHTML = "";

  const firstDayIndex = new Date(calYear, calMonth, 1).getDay();
  const daysInCurrentMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate();

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;

  function buildCell(dayNum, dateKey, isOtherMonth, isToday) {
    const cell = document.createElement("div");
    cell.className = `remedial-cal-cell group ${isOtherMonth ? "other-month" : ""} ${isToday ? "today" : ""}`;
    cell.dataset.date = dateKey;
    cell.addEventListener("click", () => {
      if (onDayClick) onDayClick(dateKey);
    });

    const topBar = document.createElement("div");
    topBar.className = "flex items-center justify-between mb-1";

    const numEl = document.createElement("span");
    numEl.className = `text-[11px] font-extrabold cursor-pointer hover:text-sky-600 transition ${
      isToday
        ? "w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center font-black shadow-xs text-[10px]"
        : isOtherMonth
        ? "text-slate-300"
        : "text-slate-700"
    }`;
    numEl.textContent = dayNum;
    numEl.addEventListener("click", (e) => {
      e.stopPropagation();
      if (onDayClick) onDayClick(dateKey);
    });
    topBar.appendChild(numEl);

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className =
      "w-4 h-4 rounded text-slate-300 hover:text-sky-600 hover:bg-sky-50 flex items-center justify-center transition opacity-0 group-hover:opacity-100 cursor-pointer";
    addBtn.title = `Tambah jadwal untuk ${dateKey}`;
    addBtn.innerHTML = `<i data-lucide="plus" class="w-2.5 h-2.5"></i>`;
    addBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (onQuickAdd) onQuickAdd(dateKey);
    });
    topBar.appendChild(addBtn);

    cell.appendChild(topBar);

    const listEl = document.createElement("div");
    listEl.className = "remedial-cal-list flex-1";

    const rItems = itemsByDate[dateKey] || [];
    const cItems = classesByDate[dateKey] || [];
    const hasRemedial = rItems.length > 0;
    const hasCheckup = cItems.length > 0 && showCheckupLayer;

    if (hasRemedial) {
      const maxRemedial = 2;
      const shownRemedial = rItems.slice(0, maxRemedial);

      shownRemedial.forEach((item) => {
        const chip = document.createElement("div");
        const style = getRemedialStatusStyle(item.status);
        chip.className = `remedial-cal-chip ${style.chip}`;
        chip.dataset.id = item.id;

        const timeStr = parseItemTimeStr(item);
        const mNum =
          Array.isArray(item.meeting_numbers) && item.meeting_numbers.length > 0
            ? item.meeting_numbers[0]
            : item.meeting_number || 1;
        const mTag = `P${String(mNum).padStart(2, "0")}`;
        const mentorName = item.mentor_name || "";
        const mentorShort = mentorName.split(" ")[0] || "-";

        chip.innerHTML = `
          <div class="flex items-center justify-between gap-1 leading-tight">
            <span class="truncate font-extrabold text-[10.5px] text-slate-900">${escapeHtml(item.name)}</span>
            <span class="text-[8.5px] font-black px-1 py-0.2 rounded bg-sky-100 text-sky-800 shrink-0 uppercase tracking-tighter">${mTag}</span>
          </div>
          <div class="flex items-center gap-1 text-[9px] text-slate-500 font-medium leading-none mt-0.5 truncate">
            ${timeStr ? `<span class="font-bold text-slate-700">${escapeHtml(timeStr)}</span><span>&bull;</span>` : ""}
            <span class="truncate text-slate-600" title="${escapeHtml(mentorName)}">${escapeHtml(mentorShort)}</span>
          </div>
        `;
        chip.title = `[Remedial] ${item.name} (${item.status}) - ${item.meeting_missed || mTag} - Mentor: ${mentorName}`;

        chip.addEventListener("click", (e) => {
          e.stopPropagation();
          if (onChipClick) onChipClick(item.id);
        });

        listEl.appendChild(chip);
      });

      if (rItems.length > maxRemedial) {
        const moreRemedialEl = document.createElement("div");
        moreRemedialEl.className =
          "text-[9px] font-extrabold text-amber-700 hover:text-amber-900 cursor-pointer pt-0.5";
        moreRemedialEl.textContent = `+${rItems.length - maxRemedial} remedial lagi...`;
        moreRemedialEl.addEventListener("click", (e) => {
          e.stopPropagation();
          if (onDayClick) onDayClick(dateKey);
        });
        listEl.appendChild(moreRemedialEl);
      }

      if (hasCheckup) {
        const checkupPill = document.createElement("div");
        checkupPill.className = "checkup-summary-pill";
        checkupPill.title = `Terdapat ${cItems.length} kelas Check-Up pada tanggal ini. Klik untuk lihat detail.`;
        checkupPill.innerHTML = `
          <div class="flex items-center justify-between gap-1 leading-tight">
            <span class="flex items-center gap-1 min-w-0 font-black text-[9.5px] text-sky-950 truncate">
              <i data-lucide="graduation-cap" class="w-3 h-3 text-sky-600 shrink-0"></i>
              <span class="truncate">${cItems.length} Kelas Check-Up</span>
            </span>
            <span class="text-[8px] font-extrabold text-sky-700 bg-sky-200/60 px-1 py-0.2 rounded shrink-0">Lihat &rsaquo;</span>
          </div>
        `;
        checkupPill.addEventListener("click", (e) => {
          e.stopPropagation();
          if (onDayClick) onDayClick(dateKey);
        });
        listEl.appendChild(checkupPill);
      }
    } else if (hasCheckup) {
      const maxCheckup = 2;
      const shown = cItems.slice(0, maxCheckup);

      shown.forEach((c) => {
        const chip = document.createElement("div");
        chip.className = "checkup-cal-chip";
        chip.dataset.classId = c.id;

        const mentorName =
          Array.isArray(c.mentors) && c.mentors.length ? c.mentors[0].name : c.mentor || "-";
        const mentorShort = mentorName.split(" ")[0] || "-";
        const mtgDone = c.meeting?.done ?? c.meetingDone ?? 0;
        const mtgTotal = c.meeting?.total ?? c.meetingTotal ?? 0;
        const timeStr = c.startTime || c.time || "";

        chip.innerHTML = `
          <div class="flex items-center justify-between gap-1 leading-tight">
            <span class="flex items-center gap-1 min-w-0 font-black text-[10px] text-sky-950 truncate">
              <i data-lucide="graduation-cap" class="w-2.5 h-2.5 text-sky-600 shrink-0"></i>
              <span class="truncate">${escapeHtml(c.name)}</span>
            </span>
            <span class="text-[8.5px] font-extrabold text-sky-700 px-1 py-0.2 rounded bg-sky-200/60 shrink-0">M${mtgDone}/${mtgTotal}</span>
          </div>
          <div class="flex items-center gap-1 text-[9px] text-slate-500 font-semibold leading-none mt-0.5 truncate">
            ${timeStr ? `<span class="text-sky-700 font-bold">${escapeHtml(timeStr)}</span><span>&bull;</span>` : ""}
            <span class="truncate text-slate-600" title="${escapeHtml(mentorName)}">${escapeHtml(mentorShort)}</span>
            <span>&bull;</span>
            <span class="text-[8px] uppercase tracking-wider text-slate-400 font-extrabold shrink-0">${escapeHtml(
              c.type || "Offline"
            )}</span>
          </div>
        `;

        chip.addEventListener("click", (e) => {
          e.stopPropagation();
          if (onDayClick) onDayClick(dateKey);
        });

        listEl.appendChild(chip);
      });

      if (cItems.length > maxCheckup) {
        const moreEl = document.createElement("div");
        moreEl.className = "text-[9px] font-extrabold text-sky-600 hover:text-sky-800 cursor-pointer pt-0.5";
        moreEl.textContent = `+${cItems.length - maxCheckup} kelas lagi...`;
        moreEl.addEventListener("click", (e) => {
          e.stopPropagation();
          if (onDayClick) onDayClick(dateKey);
        });
        listEl.appendChild(moreEl);
      }
    }

    cell.appendChild(listEl);
    return cell;
  }

  // 1. Previous month trailing days
  for (let i = 0; i < firstDayIndex; i++) {
    const dayNum = daysInPrevMonth - firstDayIndex + 1 + i;
    let prevMonth = calMonth - 1;
    let prevYear = calYear;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear--;
    }
    const prevKey = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    grid.appendChild(buildCell(dayNum, prevKey, true, false));
  }

  // 2. Current month days
  for (let d = 1; d <= daysInCurrentMonth; d++) {
    const curKey = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isToday = curKey === todayKey;
    grid.appendChild(buildCell(d, curKey, false, isToday));
  }

  // 3. Next month leading days
  const totalRendered = firstDayIndex + daysInCurrentMonth;
  const totalSlots = totalRendered > 35 ? 42 : 35;
  const nextMonthDaysCount = totalSlots - totalRendered;

  for (let n = 1; n <= nextMonthDaysCount; n++) {
    let nextMonth = calMonth + 1;
    let nextYear = calYear;
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear++;
    }
    const nextKey = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
    grid.appendChild(buildCell(n, nextKey, true, false));
  }

  // Render Unscheduled list
  if (unscheduledContainer) {
    unscheduledContainer.innerHTML = "";
    if (unscheduledList.length === 0) {
      unscheduledContainer.innerHTML = `
        <div class="text-center py-8 px-2 text-slate-400 text-xs">
          <i data-lucide="check-circle" class="w-6 h-6 mx-auto mb-1 text-emerald-400"></i>
          <p class="font-semibold text-slate-600">Semua Terjadwal!</p>
          <p class="text-[10px] text-slate-400">Tidak ada pengajuan Schedule tanpa tanggal.</p>
        </div>
      `;
    } else {
      unscheduledList.forEach((item) => {
        const card = document.createElement("div");
        card.className =
          "bg-white p-3 rounded-xl border border-slate-200/90 shadow-xs hover:shadow-sm transition-all flex flex-col gap-1.5";
        const style = getRemedialStatusStyle(item.status);
        const mNum =
          Array.isArray(item.meeting_numbers) && item.meeting_numbers.length > 0
            ? item.meeting_numbers[0]
            : item.meeting_number || 1;
        const mTag = `P${String(mNum).padStart(2, "0")}`;

        card.innerHTML = `
          <div class="flex items-start justify-between gap-1.5">
            <span class="font-bold text-slate-900 text-xs truncate leading-snug">${escapeHtml(item.name)}</span>
            <span class="tag-meeting bg-sky-50 text-sky-700 border border-sky-200 flex-shrink-0 text-[9px] px-1.5 py-0.5">${mTag}</span>
          </div>
          <div class="text-[10px] text-slate-400 flex items-center justify-between">
            <span class="truncate">${escapeHtml(item.group_whatsapp || item.class_name || "Tanpa Kelas")}</span>
            <span class="font-extrabold ${style.badge} px-1.5 py-0.5 rounded text-[9px] border">${style.text}</span>
          </div>
          <div class="flex items-center justify-between pt-1 mt-1 border-t border-slate-100 text-[10px]">
            <span class="text-slate-400 truncate max-w-[120px]">${escapeHtml(item.mentor_name)}</span>
            <button type="button" class="btn-schedule-item px-2 py-1 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-600 hover:text-white font-bold transition flex items-center gap-1 cursor-pointer" data-id="${
              item.id
            }">
              <i data-lucide="calendar-plus" class="w-3 h-3"></i>
              <span>Jadwalkan</span>
            </button>
          </div>
        `;

        card.querySelector(".btn-schedule-item")?.addEventListener("click", () => {
          if (onScheduleUnscheduled) onScheduleUnscheduled(item.id);
        });

        unscheduledContainer.appendChild(card);
      });
    }
  }

  if (window.lucide) window.lucide.createIcons();
}

export function renderRemedialList(
  reports,
  collapsedGroups,
  onToggleCollapse,
  onStatusChange,
  onCommentClick,
  onScheduleClick,
  onRowClick,
  onQuickAdd
) {
  const wrapper = document.getElementById("clickupListGroupsWrapper");
  const totalCountBadge = document.getElementById("clickupListTotalCountBadge");
  if (!wrapper) return;

  if (totalCountBadge) {
    totalCountBadge.textContent = `${reports.length} task${reports.length === 1 ? "" : "s"}`;
  }

  const listStatuses = ["STALL", "RESCHEDULE", "SCHEDULE", "PROCESS", "CONTACT", "REQUEST", "COMPLETE"];
  wrapper.innerHTML = "";

  listStatuses.forEach((statusKey) => {
    const itemsInStatus = reports.filter((r) => (r.status || "REQUEST").toUpperCase() === statusKey);
    const meta = getClickUpStatusMeta(statusKey);
    const isCollapsed = collapsedGroups ? collapsedGroups.has(statusKey) : false;

    const groupContainer = document.createElement("div");
    groupContainer.className =
      "clickup-group-block rounded-2xl border border-slate-200/70 overflow-hidden bg-white shadow-2xs transition-all";
    groupContainer.dataset.status = statusKey;

    const headerEl = document.createElement("div");
    headerEl.className =
      "clickup-group-header flex items-center justify-between py-2.5 px-4 cursor-pointer select-none border-b border-slate-100 bg-slate-50/50 hover:bg-slate-100/60 transition";
    headerEl.innerHTML = `
      <div class="flex items-center gap-2.5">
        <span class="group-chevron w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-transform duration-200 ${
          isCollapsed ? "-rotate-90" : ""
        }">
          <i data-lucide="chevron-down" class="w-4 h-4"></i>
        </span>
        <span class="inline-flex items-center gap-1.5 justify-center px-2.5 py-0.5 rounded-md text-[11px] font-black tracking-wider uppercase text-white shadow-xs ${
          meta.badgeBg
        }">
          ${meta.iconHtml || ""}
          <span>${statusKey}</span>
        </span>
        <span class="text-xs font-bold text-slate-400 ml-1">
          ${itemsInStatus.length}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="btn-group-add-task inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-500 hover:text-sky-600 hover:bg-white transition border border-transparent hover:border-slate-200"
          data-status="${statusKey}"
          title="Tambah task di grup ${statusKey}"
        >
          <i data-lucide="plus" class="w-3.5 h-3.5"></i>
          <span>Add Task</span>
        </button>
      </div>
    `;

    headerEl.addEventListener("click", (e) => {
      if (e.target.closest(".btn-group-add-task")) return;
      if (onToggleCollapse) onToggleCollapse(statusKey);
    });

    const addBtn = headerEl.querySelector(".btn-group-add-task");
    if (addBtn) {
      addBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (onQuickAdd) onQuickAdd(statusKey);
      });
    }

    groupContainer.appendChild(headerEl);

    if (!isCollapsed) {
      const tableWrap = document.createElement("div");
      tableWrap.className = "overflow-x-auto";

      const table = document.createElement("table");
      table.className = "w-full text-left text-xs border-collapse min-w-[980px]";

      table.innerHTML = `
        <thead>
          <tr class="border-b border-slate-200/80 text-[11px] font-semibold text-slate-400 bg-white select-none">
            <th class="py-2.5 px-4 font-semibold w-[260px]">Name</th>
            <th class="py-2.5 px-3 font-semibold w-[110px]">Date created</th>
            <th class="py-2.5 px-3 font-semibold w-[100px]">Due date</th>
            <th class="py-2.5 px-3 font-semibold w-[160px]">Whatsapp Pengisi Form</th>
            <th class="py-2.5 px-3 font-semibold w-[180px]">Class</th>
            <th class="py-2.5 px-3 font-semibold w-[120px]">Meeting</th>
            <th class="py-2.5 px-3 font-semibold w-[90px]">Comments</th>
            <th class="py-2.5 px-3 font-semibold w-[140px]">Mentor</th>
            <th class="py-2.5 px-3 font-semibold w-[130px]">Status</th>
            <th class="py-2.5 px-2 font-semibold w-[40px] text-center">
              <i data-lucide="plus" class="w-3.5 h-3.5 mx-auto text-slate-300"></i>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100/80"></tbody>
      `;

      const tbody = table.querySelector("tbody");

      if (itemsInStatus.length === 0) {
        const emptyTr = document.createElement("tr");
        emptyTr.innerHTML = `
          <td colspan="10" class="py-4 px-4 text-center text-slate-400 text-xs italic">
            Tidak ada task dengan status ${statusKey}
          </td>
        `;
        tbody.appendChild(emptyTr);
      } else {
        itemsInStatus.forEach((item) => {
          const tr = document.createElement("tr");
          tr.className = "clickup-row-hover transition-colors group cursor-pointer";
          tr.dataset.id = item.id;

          let cleanPhone = String(item.phone || "").replace(/\D/g, "");
          if (cleanPhone.startsWith("0")) cleanPhone = "62" + cleanPhone.slice(1);
          if (!cleanPhone.startsWith("62") && cleanPhone.length > 5) cleanPhone = "62" + cleanPhone;

          const displayClass = item.group_whatsapp || item.class_name || "-";
          const hasClass = Boolean(displayClass && displayClass !== "-");
          const classText = hasClass ? ` di ${displayClass}` : "";
          const waMsg = encodeURIComponent(
            `Halo kak ${item.name}, kami dari Admin Kelas Dialogika mengenai remedial ${
              item.meeting_missed || "pertemuan kelas"
            }${classText}. Apakah jadwal pengganti ini sudah sesuai? Terima kasih!`
          );

          const hasScheduleDate = Boolean(item.schedule_date || item.scheduled_date || item.date);

          tr.innerHTML = `
            <td class="py-2.5 px-4">
              <div class="flex items-center gap-2.5">
                <span class="w-3.5 h-3.5 rounded-full border-2 ${meta.ringBorder} flex-shrink-0 group-hover:scale-110 transition-transform"></span>
                <span class="font-semibold text-slate-800 hover:text-sky-600 transition truncate max-w-[200px]" title="${escapeHtml(
                  item.name
                )}">
                  ${escapeHtml(item.name)}
                </span>
                ${
                  item.reason && item.reason !== "-"
                    ? `<i data-lucide="align-left" class="w-3 h-3 text-slate-400 flex-shrink-0" title="${escapeHtml(
                        item.reason
                      )}"></i>`
                    : ""
                }
              </div>
            </td>
            <td class="py-2.5 px-3 text-[11px] text-slate-600 font-medium whitespace-nowrap">
              ${formatClickUpDate(item.created_at)}
            </td>
            <td class="py-2.5 px-3 whitespace-nowrap">
              ${
                hasScheduleDate
                  ? `
                <div class="inline-flex items-center gap-1.5 text-[11px] text-slate-700 font-medium hover:text-sky-600 transition" title="Jadwal: ${escapeHtml(
                  String(item.schedule_date)
                )}">
                  <i data-lucide="calendar" class="w-3 h-3 text-slate-400"></i>
                  <span>${formatClickUpDate(item.schedule_date)}</span>
                </div>
              `
                  : `
                <button type="button" class="btn-cell-schedule text-slate-300 hover:text-sky-600 p-1 rounded hover:bg-slate-100 transition" title="Atur Jadwal Remedial" data-id="${item.id}">
                  <i data-lucide="calendar" class="w-3.5 h-3.5"></i>
                </button>
              `
              }
            </td>
            <td class="py-2.5 px-3 whitespace-nowrap">
              ${
                cleanPhone.length > 5
                  ? `
                <a href="https://wa.me/${cleanPhone}?text=${waMsg}" target="_blank" class="text-[11px] text-slate-700 hover:text-emerald-600 font-medium hover:underline inline-flex items-center gap-1.5" title="Kirim WhatsApp">
                  <span>${formatClickUpPhone(item.phone)}</span>
                </a>
              `
                  : `
                <span class="text-slate-400 text-[11px]">-</span>
              `
              }
            </td>
            <td class="py-2.5 px-3 text-[11px] text-slate-700 font-medium truncate max-w-[180px]" title="${escapeHtml(
              displayClass
            )}">
              ${escapeHtml(displayClass)}
            </td>
            <td class="py-2.5 px-3">
              <div class="flex items-center gap-1 flex-wrap">
                ${renderClickUpMeetingBadges(item)}
              </div>
            </td>
            <td class="py-2.5 px-3 whitespace-nowrap">
              <button
                type="button"
                class="btn-cell-comments inline-flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-sky-600 hover:bg-slate-100 px-2 py-1 rounded-md transition group/cmt-btn cursor-pointer"
                data-id="${item.id}"
                title="Buka Komentar ClickUp"
              >
                <i data-lucide="message-square" class="w-3.5 h-3.5 text-slate-400 group-hover/cmt-btn:text-sky-500 transition-colors"></i>
                <span class="font-medium text-slate-600 group-hover/cmt-btn:text-sky-600">${getItemCommentCount(
                  item
                )}</span>
              </button>
            </td>
            <td class="py-2.5 px-3 whitespace-nowrap">
              ${renderClickUpMentorBadge(item.mentor_name)}
            </td>
            <td class="py-2.5 px-3 whitespace-nowrap relative">
              <div class="inline-block relative">
                <select class="btn-cell-status-select text-[10px] font-extrabold uppercase tracking-wider text-white ${
                  meta.badgeBg
                } rounded-full px-2.5 py-1 border-0 focus:outline-none cursor-pointer appearance-none text-center shadow-xs hover:opacity-90 active:scale-95 transition" data-id="${
            item.id
          }" title="Ubah Status">
                  <option value="STALL" ${statusKey === "STALL" ? "selected" : ""} class="bg-white text-slate-800 font-bold">STALL</option>
                  <option value="RESCHEDULE" ${statusKey === "RESCHEDULE" ? "selected" : ""} class="bg-white text-fuchsia-700 font-bold">RESCHEDULE</option>
                  <option value="SCHEDULE" ${statusKey === "SCHEDULE" ? "selected" : ""} class="bg-white text-sky-700 font-bold">SCHEDULE</option>
                  <option value="PROCESS" ${statusKey === "PROCESS" ? "selected" : ""} class="bg-white text-orange-700 font-bold">PROCESS</option>
                  <option value="CONTACT" ${statusKey === "CONTACT" ? "selected" : ""} class="bg-white text-purple-700 font-bold">CONTACT</option>
                  <option value="REQUEST" ${statusKey === "REQUEST" ? "selected" : ""} class="bg-white text-rose-700 font-bold">REQUEST</option>
                  <option value="COMPLETE" ${statusKey === "COMPLETE" ? "selected" : ""} class="bg-white text-emerald-700 font-bold">COMPLETE</option>
                </select>
              </div>
            </td>
            <td class="py-2.5 px-2 text-center whitespace-nowrap">
              <button type="button" class="btn-cell-open p-1 text-slate-300 hover:text-slate-700 rounded-md hover:bg-slate-100 transition" title="Buka Detail Jadwal" data-id="${
                item.id
              }">
                <i data-lucide="more-horizontal" class="w-3.5 h-3.5"></i>
              </button>
            </td>
          `;

          tr.addEventListener("click", (e) => {
            if (e.target.closest(".btn-cell-status-select, .btn-cell-comments, a, button")) return;
            if (onRowClick) onRowClick(item.id);
          });

          tr.querySelector(".btn-cell-comments")?.addEventListener("click", (e) => {
            e.stopPropagation();
            if (onCommentClick) onCommentClick(item.id);
          });

          tr.querySelector(".btn-cell-status-select")?.addEventListener("change", (e) => {
            e.stopPropagation();
            if (onStatusChange) onStatusChange(item.id, e.target.value);
          });

          tr.querySelector(".btn-cell-schedule")?.addEventListener("click", (e) => {
            e.stopPropagation();
            if (onScheduleClick) onScheduleClick(item.id);
          });

          tr.querySelector(".btn-cell-open")?.addEventListener("click", (e) => {
            e.stopPropagation();
            if (onRowClick) onRowClick(item.id);
          });

          tbody.appendChild(tr);
        });
      }

      tableWrap.appendChild(table);

      const bottomAddRow = document.createElement("div");
      bottomAddRow.className =
        "flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-700 hover:bg-slate-50 cursor-pointer transition border-t border-slate-100/60 select-none";
      bottomAddRow.innerHTML = `
        <i data-lucide="plus" class="w-3.5 h-3.5 text-slate-400"></i>
        <span>Add Task</span>
      `;
      bottomAddRow.addEventListener("click", () => {
        if (onQuickAdd) onQuickAdd(statusKey);
      });
      tableWrap.appendChild(bottomAddRow);

      groupContainer.appendChild(tableWrap);
    }

    wrapper.appendChild(groupContainer);
  });

  if (window.lucide) window.lucide.createIcons();
}

/* ==========================================================================
   REMEDIAL MODALS CONTROLLER & POPUPS
   ========================================================================== */

export function openRemedialScheduleModal(item, classesState, onPickSuggestion, onSave, onDelete, onCommentClick, onClose) {
  const modal = document.getElementById("remedialScheduleModal");
  if (!modal || !item) return;

  const memberName = item.name || "Tanpa Nama";
  const nameEl = document.getElementById("schedModalMemberName");
  if (nameEl) nameEl.textContent = memberName;

  const avatarEl = document.getElementById("schedModalMemberAvatar");
  if (avatarEl) {
    avatarEl.textContent = memberName.trim().charAt(0).toUpperCase() || "M";
  }

  const resolvedClass = item.group_whatsapp || item.class_name || "Tanpa Kelas";
  const classEl = document.getElementById("schedModalClassName");
  if (classEl) classEl.textContent = resolvedClass;

  let meetingBadgeStr = "";
  if (Array.isArray(item.meeting_numbers) && item.meeting_numbers.length > 0) {
    meetingBadgeStr = item.meeting_numbers.map((n) => `P${String(n).padStart(2, "0")}`).join(", ");
  } else {
    meetingBadgeStr = `P${String(item.meeting_number || 1).padStart(2, "0")}`;
  }
  const badgeEl = document.getElementById("schedModalMeetingBadge");
  if (badgeEl) badgeEl.textContent = meetingBadgeStr;

  const mentorEl = document.getElementById("schedModalMentor");
  if (mentorEl) mentorEl.textContent = item.mentor_name || "-";

  const phoneEl = document.getElementById("schedModalPhone");
  if (phoneEl) phoneEl.textContent = item.phone || "-";

  const createdAtEl = document.getElementById("schedModalCreatedAt");
  if (createdAtEl) createdAtEl.textContent = formatClickUpDate(item.created_at) || "-";

  const emailEl = document.getElementById("schedModalEmail");
  if (emailEl) emailEl.textContent = item.email && item.email !== "-" ? item.email : "-";

  const reasonBox = document.getElementById("schedModalReasonBox");
  const reasonText = document.getElementById("schedModalReasonText");
  if (item.reason && item.reason !== "-") {
    if (reasonText) reasonText.textContent = item.reason;
    if (reasonBox) reasonBox.classList.remove("hidden");
  } else if (reasonBox) {
    reasonBox.classList.add("hidden");
  }

  const dateInput = document.getElementById("schedModalDateInput");
  if (dateInput) {
    let dtVal = "";
    let raw = item.schedule_date || item.scheduled_date || item.date;
    if (raw) {
      if (typeof raw === "object" && typeof raw.toDate === "function") {
        const d = raw.toDate();
        dtVal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
          d.getDate()
        ).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      } else if (typeof raw === "string") {
        if (raw.includes("T")) {
          dtVal = raw.slice(0, 16);
        } else if (raw.includes(" ")) {
          dtVal = raw.replace(" ", "T").slice(0, 16);
        } else {
          dtVal = `${raw}T19:00`;
        }
      }
    }
    dateInput.value = dtVal;
    dateInput.onchange = () => {
      if (dateInput.value) {
        const sel = document.getElementById("schedModalStatusSelect");
        if (sel && (sel.value === "REQUEST" || sel.value === "CONTACT" || sel.value === "PROCESS")) {
          sel.value = "SCHEDULE";
        }
      }
    };
  }

  const statusSelect = document.getElementById("schedModalStatusSelect");
  if (statusSelect) {
    statusSelect.value = (item.status || "REQUEST").toUpperCase();
  }

  const btnWA = document.getElementById("btnSchedModalWhatsApp");
  if (btnWA) {
    let cleanPhone = String(item.phone || "").replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = "62" + cleanPhone.slice(1);
    if (!cleanPhone.startsWith("62") && cleanPhone.length > 5) cleanPhone = "62" + cleanPhone;

    const hasClass = Boolean(resolvedClass && resolvedClass !== "-");
    const classText = hasClass ? ` di ${resolvedClass}` : "";
    const msg = encodeURIComponent(
      `Halo kak ${item.name}, kami dari Admin Kelas Dialogika mengenai jadwal remedial ${
        item.meeting_missed || "pertemuan kelas"
      }${classText}. Apakah jadwal pengganti ini sudah sesuai? Terima kasih!`
    );
    btnWA.href = `https://wa.me/${cleanPhone}?text=${msg}`;
  }

  const commentsCountEl = document.getElementById("schedModalCommentsCount");
  if (commentsCountEl) {
    commentsCountEl.textContent = `${getItemCommentCount(item)} Komentar`;
  }
  const btnComments = document.getElementById("btnSchedModalComments");
  if (btnComments) {
    btnComments.onclick = () => {
      if (onCommentClick) onCommentClick(item.id);
    };
  }

  const btnDelete = document.getElementById("btnSchedModalDelete");
  if (btnDelete) {
    btnDelete.onclick = () => {
      if (onDelete) onDelete(item.id, item.name);
    };
  }

  const btnSave = document.getElementById("btnSaveSchedModal");
  if (btnSave) {
    btnSave.onclick = () => {
      const newDate = dateInput?.value || null;
      let newStatus = statusSelect?.value || item.status;
      if (newDate && (newStatus === "REQUEST" || newStatus === "CONTACT" || newStatus === "PROCESS")) {
        newStatus = "SCHEDULE";
      }
      if (onSave) onSave(item.id, newDate, newStatus);
    };
  }

  const btnClose = document.getElementById("btnCloseSchedModal");
  const btnCancel = document.getElementById("btnCancelSchedModal");
  const doClose = () => {
    closeRemedialScheduleModal();
    if (onClose) onClose();
  };
  if (btnClose) btnClose.onclick = doClose;
  if (btnCancel) btnCancel.onclick = doClose;

  renderScheduleClassSuggestions(item, classesState, onPickSuggestion);

  modal.classList.add("open");
  if (window.lucide) window.lucide.createIcons();
}

export function renderScheduleClassSuggestions(item, classesState, onPickSuggestion) {
  const container = document.getElementById("schedModalSuggestionsList");
  const countBadge = document.getElementById("schedModalSuggestionsCount");
  const box = document.getElementById("schedModalSuggestionsBox");
  if (!container || !box) return;

  container.innerHTML = "";

  if (!Array.isArray(classesState) || classesState.length === 0) {
    box.classList.add("hidden");
    return;
  }

  box.classList.remove("hidden");

  const targetMeetingNum =
    Array.isArray(item.meeting_numbers) && item.meeting_numbers.length > 0
      ? item.meeting_numbers[0]
      : parseInt(item.meeting_number, 10) || 1;
  const targetMentor = (item.mentor_name || "").toLowerCase().trim();

  const candidates = [];

  classesState.forEach((c) => {
    const dates = getClassDates(c);
    const validDate = dates.find((d) => d >= new Date().toISOString().slice(0, 10)) || dates[0] || c.startDate;
    if (!validDate) return;

    const mentorName = Array.isArray(c.mentors) && c.mentors.length ? c.mentors[0].name : c.mentor || "";
    const isSameMentor = targetMentor && mentorName.toLowerCase().includes(targetMentor);
    const mtgDone = c.meeting?.done ?? c.meetingDone ?? 0;
    const mtgTotal = c.meeting?.total ?? c.meetingTotal ?? 0;
    const nextMtg = mtgDone + 1;
    const isSameMeeting = nextMtg === targetMeetingNum || mtgDone === targetMeetingNum;

    let score = 0;
    if (isSameMentor) score += 4;
    if (isSameMeeting) score += 3;
    if (c.status === "Running" || c.status === "Soon") score += 2;

    if (score > 0 || candidates.length < 5) {
      candidates.push({
        class: c,
        score,
        targetDate: validDate,
        mentorName,
        nextMtg,
        mtgDone,
        mtgTotal,
      });
    }
  });

  candidates.sort((a, b) => b.score - a.score);
  const topCandidates = candidates.slice(0, 4);

  if (countBadge) {
    countBadge.textContent = `${topCandidates.length} Rekomendasi`;
  }

  if (topCandidates.length === 0) {
    container.innerHTML = `
      <div class="text-[10px] text-slate-400 italic py-2 text-center bg-white/60 rounded-xl border border-sky-100">
        Belum ada jadwal kelas reguler yang cocok. Silakan atur jadwal manual di bawah.
      </div>
    `;
    return;
  }

  topCandidates.forEach((cand) => {
    const c = cand.class;
    const card = document.createElement("div");
    card.className =
      "bg-white p-2 rounded-xl border border-sky-100 hover:border-sky-300 flex items-center justify-between gap-2 shadow-2xs transition";

    const timeStr = c.startTime || c.time || "11:00";
    const dateFormatted = cand.targetDate;
    const matchTag = cand.score >= 6 ? "Sangat Cocok" : cand.score >= 4 ? "Mentor Sama" : "Opsi Kelas";
    const matchTagColor =
      cand.score >= 6
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-sky-50 text-sky-700 border-sky-200";

    card.innerHTML = `
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5 leading-snug">
          <i data-lucide="graduation-cap" class="w-3.5 h-3.5 text-sky-600 shrink-0"></i>
          <span class="font-extrabold text-xs text-slate-900 truncate">${escapeHtml(c.name)}</span>
          <span class="text-[8.5px] font-black px-1.5 py-0.5 rounded border ${matchTagColor} shrink-0">${matchTag}</span>
        </div>
        <div class="flex items-center gap-1.5 text-[9.5px] text-slate-500 font-medium mt-0.5 truncate">
          <span class="font-bold text-slate-700">${escapeHtml(dateFormatted)}</span>
          <span>&bull;</span>
          <span class="font-extrabold text-sky-700">${escapeHtml(timeStr)}</span>
          <span>&bull;</span>
          <span class="truncate" title="${escapeHtml(cand.mentorName)}">${escapeHtml(cand.mentorName)}</span>
          <span>&bull;</span>
          <span class="font-semibold text-slate-600">Mtg ${cand.mtgDone}/${cand.mtgTotal}</span>
        </div>
      </div>
      <button
        type="button"
        class="btn-pick-suggested-schedule px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-[10px] transition shrink-0 cursor-pointer shadow-xs flex items-center gap-1"
      >
        <i data-lucide="calendar-plus" class="w-3 h-3"></i>
        <span>Pilih</span>
      </button>
    `;

    card.querySelector(".btn-pick-suggested-schedule")?.addEventListener("click", () => {
      const dateInput = document.getElementById("schedModalDateInput");
      const statusSelect = document.getElementById("schedModalStatusSelect");
      if (dateInput) {
        let cleanTime = timeStr;
        if (cleanTime.length === 5) cleanTime = `${cleanTime}:00`;
        else if (cleanTime.length < 5) cleanTime = "11:00:00";
        dateInput.value = `${dateFormatted}T${cleanTime.slice(0, 5)}`;
        dateInput.classList.add("ring-2", "ring-emerald-500", "bg-emerald-50/50");
        setTimeout(() => {
          dateInput.classList.remove("ring-2", "ring-emerald-500", "bg-emerald-50/50");
        }, 1200);
      }
      if (statusSelect) {
        statusSelect.value = "SCHEDULE";
      }
      if (onPickSuggestion) onPickSuggestion(c, dateFormatted, timeStr);
      showToast(`Jadwal diisi dari: ${c.name} (${dateFormatted} ${timeStr})`, "success");
    });

    container.appendChild(card);
  });

  if (window.lucide) window.lucide.createIcons();
}

export function closeRemedialScheduleModal() {
  const modal = document.getElementById("remedialScheduleModal");
  if (modal) modal.classList.remove("open");
}

export function openRemedialDayAgendaModal(dateKey, dayRemedial = [], dayClasses = [], onManageRemedial, onAddRemedial, onClose) {
  const modal = document.getElementById("remedialDayAgendaModal");
  if (!modal) return;

  const [y, m, d] = dateKey.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const dayName = dayNames[dateObj.getDay()] || "";
  const monthName = REMEDIAL_MONTH_NAMES[m - 1] || "";
  const formattedTitle = `${dayName}, ${d} ${monthName} ${y}`;

  const titleEl = document.getElementById("dayAgendaTitle");
  if (titleEl) titleEl.textContent = `Agenda Tanggal ${formattedTitle}`;

  const remedialBadge = document.getElementById("dayAgendaRemedialBadge");
  const checkupBadge = document.getElementById("dayAgendaCheckupBadge");
  const remedialCountSub = document.getElementById("dayAgendaRemedialCount");
  const checkupCountSub = document.getElementById("dayAgendaCheckupCount");

  if (remedialBadge) remedialBadge.textContent = `${dayRemedial.length} Member`;
  if (checkupBadge) checkupBadge.textContent = `${dayClasses.length} Kelas`;
  if (remedialCountSub) remedialCountSub.textContent = `${dayRemedial.length} Member Remedial`;
  if (checkupCountSub) checkupCountSub.textContent = `${dayClasses.length} Kelas Check-Up`;

  const remedialContainer = document.getElementById("dayAgendaRemedialList");
  if (remedialContainer) {
    remedialContainer.innerHTML = "";
    if (dayRemedial.length === 0) {
      remedialContainer.innerHTML = `
        <div class="text-[11px] text-slate-400 italic p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
          Tidak ada member remedial yang dijadwalkan pada tanggal ini.
        </div>
      `;
    } else {
      dayRemedial.forEach((item) => {
        const card = document.createElement("div");
        const style = getRemedialStatusStyle(item.status);
        const mNum =
          Array.isArray(item.meeting_numbers) && item.meeting_numbers.length > 0
            ? item.meeting_numbers[0]
            : item.meeting_number || 1;
        const mTag = `P${String(mNum).padStart(2, "0")}`;
        const timeStr = parseItemTimeStr(item) || "-";
        const resolvedClass = item.group_whatsapp || item.class_name || "Tanpa Kelas";

        card.className =
          "bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-3";
        card.innerHTML = `
          <div class="flex items-start gap-3 min-w-0">
            <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
              ${(item.name || "M").charAt(0).toUpperCase()}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-black text-xs text-slate-900 truncate">${escapeHtml(item.name)}</span>
                <span class="text-[9px] font-black px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 border border-sky-200">${mTag}</span>
                <span class="text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${style.badge}">${style.text}</span>
              </div>
              <div class="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                <span class="font-bold text-slate-700">${timeStr}</span>
                <span>&bull;</span>
                <span class="truncate">${escapeHtml(resolvedClass)}</span>
                <span>&bull;</span>
                <span class="font-semibold text-slate-600">Mentor: ${escapeHtml(item.mentor_name || "-")}</span>
              </div>
              ${
                item.reason && item.reason !== "-"
                  ? `<div class="text-[9.5px] text-amber-700 italic mt-0.5 truncate">Alasan: ${escapeHtml(item.reason)}</div>`
                  : ""
              }
            </div>
          </div>
          <button
            type="button"
            class="btn-edit-remedial-from-day px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-600 hover:text-white text-sky-700 text-xs font-bold transition flex items-center gap-1.5 shrink-0 self-end sm:self-center cursor-pointer shadow-2xs"
            data-id="${item.id}"
          >
            <i data-lucide="calendar-check" class="w-3.5 h-3.5"></i>
            <span>Kelola Jadwal</span>
          </button>
        `;

        card.querySelector(".btn-edit-remedial-from-day")?.addEventListener("click", () => {
          closeRemedialDayAgendaModal();
          if (onManageRemedial) onManageRemedial(item.id);
        });

        remedialContainer.appendChild(card);
      });
    }
  }

  const checkupContainer = document.getElementById("dayAgendaCheckupList");
  if (checkupContainer) {
    checkupContainer.innerHTML = "";
    if (dayClasses.length === 0) {
      checkupContainer.innerHTML = `
        <div class="text-[11px] text-slate-400 italic p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
          Tidak ada kelas reguler dari Check-Up Class pada tanggal ini.
        </div>
      `;
    } else {
      dayClasses.forEach((c) => {
        const card = document.createElement("div");
        const mentorName =
          Array.isArray(c.mentors) && c.mentors.length
            ? c.mentors.map((m) => m.name || "").join(", ")
            : c.mentor || "-";
        const mtgDone = c.meeting?.done ?? c.meetingDone ?? 0;
        const mtgTotal = c.meeting?.total ?? c.meetingTotal ?? 0;
        const timeStr = c.startTime || c.time || "-";

        card.className =
          "bg-sky-50/50 p-3 rounded-2xl border border-sky-100 hover:border-sky-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3";
        card.innerHTML = `
          <div class="flex items-start gap-3 min-w-0">
            <div class="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
              <i data-lucide="graduation-cap" class="w-4 h-4"></i>
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-black text-xs text-slate-900 truncate">${escapeHtml(c.name)}</span>
                <span class="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-sky-200/80 text-sky-800">Meeting ${mtgDone}/${mtgTotal}</span>
                <span class="text-[8.5px] uppercase font-black px-1.5 py-0.2 rounded bg-white text-slate-600 border border-slate-200">${escapeHtml(
                  c.type || "Offline"
                )}</span>
              </div>
              <div class="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                <span class="font-extrabold text-sky-700">${timeStr}</span>
                <span>&bull;</span>
                <span class="font-semibold text-slate-700">Mentor: ${escapeHtml(mentorName)}</span>
                ${c.location ? `<span>&bull;</span><span class="text-slate-400">${escapeHtml(c.location)}</span>` : ""}
              </div>
            </div>
          </div>
        `;

        checkupContainer.appendChild(card);
      });
    }
  }

  const btnAddOnDay = document.getElementById("btnAddRemedialOnDay");
  if (btnAddOnDay) {
    btnAddOnDay.onclick = () => {
      closeRemedialDayAgendaModal();
      if (onAddRemedial) onAddRemedial(dateKey);
    };
  }

  const btnClose = document.getElementById("btnCloseDayAgendaModal");
  const btnCloseFooter = document.getElementById("btnCloseDayAgendaFooter");
  const doClose = () => {
    closeRemedialDayAgendaModal();
    if (onClose) onClose();
  };
  if (btnClose) btnClose.onclick = doClose;
  if (btnCloseFooter) btnCloseFooter.onclick = doClose;

  modal.classList.add("open");
  if (window.lucide) window.lucide.createIcons();
}

export function closeRemedialDayAgendaModal() {
  const modal = document.getElementById("remedialDayAgendaModal");
  if (modal) modal.classList.remove("open");
}

/* ==========================================================================
   ClickUp Floating Comments Popup
   ========================================================================== */

export function openClickupCommentPopup(item, onAddComment, onReaction, onReply, onClose) {
  const popup = document.getElementById("clickupRemedialCommentPopup");
  if (!popup || !item) return;

  const comments = Array.isArray(item.comments) ? item.comments : [];

  const titleEl = document.getElementById("clickupCommentTaskName");
  if (titleEl) {
    titleEl.textContent = item.name || "Remedial Task";
    titleEl.title = item.name || "";
  }

  const classEl = document.getElementById("clickupCommentHeaderClass");
  if (classEl) {
    classEl.textContent = item.group_whatsapp || item.class_name || "Tanpa Kelas";
  }

  const statusBadge = document.getElementById("clickupCommentStatusBadge");
  if (statusBadge) {
    const statusKey = (item.status || "REQUEST").toUpperCase();
    const meta = getClickUpStatusMeta(statusKey);
    statusBadge.textContent = statusKey;
    statusBadge.className = `text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full text-white ${meta.badgeBg} shadow-xs flex-shrink-0`;
  }

  const countEl = document.getElementById("clickupCommentHeaderCount");
  if (countEl) {
    countEl.textContent = `${comments.length} comment${comments.length === 1 ? "" : "s"}`;
  }

  renderRemedialCommentsList(item, onReaction, onReply);

  const btnClose = document.getElementById("btnCloseClickupComment");
  if (btnClose) {
    btnClose.onclick = () => {
      closeClickupCommentPopup();
      if (onClose) onClose();
    };
  }

  const submitBtn = document.getElementById("btnSubmitClickupComment");
  const inputEl = document.getElementById("clickupCommentInput");

  if (submitBtn && inputEl) {
    submitBtn.onclick = () => {
      const text = (inputEl.value || "").trim();
      if (!text) return;
      inputEl.value = "";
      if (onAddComment) onAddComment(item.id, text);
    };

    inputEl.onkeydown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const text = (inputEl.value || "").trim();
        if (!text) return;
        inputEl.value = "";
        if (onAddComment) onAddComment(item.id, text);
      }
    };
  }

  popup.classList.remove("hidden");
  if (window.lucide) window.lucide.createIcons();

  if (inputEl) {
    setTimeout(() => inputEl.focus(), 80);
  }
}

export function closeClickupCommentPopup() {
  const popup = document.getElementById("clickupRemedialCommentPopup");
  if (popup) popup.classList.add("hidden");
}

export function renderRemedialCommentsList(item, onReaction, onReply) {
  const listWrapper = document.getElementById("clickupCommentListWrapper");
  if (!listWrapper || !item) return;

  const comments = Array.isArray(item.comments) ? item.comments : [];

  if (comments.length === 0) {
    listWrapper.innerHTML = `
      <div class="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-6 text-slate-400">
        <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
          <i data-lucide="message-square" class="w-5 h-5"></i>
        </div>
        <p class="text-xs font-semibold text-slate-600">Belum ada komentar</p>
        <p class="text-[11px] text-slate-400 mt-0.5">Ketik komentar pertama Anda di bawah untuk berdiskusi.</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  listWrapper.innerHTML = "";

  comments.forEach((cmt) => {
    const cmtEl = document.createElement("div");
    cmtEl.className = "clickup-comment-row group flex items-start gap-2.5 transition";

    let avatarHtml = "";
    if (cmt.avatar) {
      avatarHtml = `<img src="${escapeHtml(cmt.avatar)}" alt="${escapeHtml(
        cmt.author || "User"
      )}" class="w-7 h-7 rounded-full object-cover flex-shrink-0 shadow-2xs border border-slate-200 mt-0.5" />`;
    } else {
      const initials = (cmt.author || "User")
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
      avatarHtml = `<div class="w-7 h-7 rounded-full bg-slate-800 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 shadow-2xs mt-0.5">${initials}</div>`;
    }

    cmtEl.innerHTML = `
      ${avatarHtml}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-bold text-slate-900 text-xs">${escapeHtml(cmt.author || "User")}</span>
          <span class="text-[11px] text-slate-400 font-normal">${escapeHtml(cmt.time || "")}</span>
        </div>
        <div class="mt-1 text-slate-800 text-xs leading-relaxed whitespace-pre-line break-words select-text">
          ${escapeHtml(cmt.text || "")}
        </div>
        <div class="mt-1.5 flex items-center justify-between pt-0.5">
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              class="btn-cmt-reaction inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              data-cmtid="${cmt.id}"
              data-type="thumbs_up"
              title="Suka"
            >
              <i data-lucide="thumbs-up" class="w-3.5 h-3.5"></i>
              ${cmt.thumbs_up ? `<span class="text-[10px] font-bold text-sky-600">${cmt.thumbs_up}</span>` : ""}
            </button>
            <button
              type="button"
              class="btn-cmt-reaction inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              data-cmtid="${cmt.id}"
              data-type="smile"
              title="Reaksi"
            >
              <i data-lucide="smile" class="w-3.5 h-3.5"></i>
              ${cmt.smile ? `<span class="text-[10px] font-bold text-amber-500">${cmt.smile}</span>` : ""}
            </button>
          </div>
          <button
            type="button"
            class="btn-cmt-reply text-[11px] font-semibold text-slate-400 hover:text-slate-700 transition cursor-pointer"
            data-author="${escapeHtml(cmt.author || "")}"
          >
            Reply
          </button>
        </div>
      </div>
    `;

    cmtEl.querySelectorAll(".btn-cmt-reaction").forEach((btn) => {
      btn.addEventListener("click", () => {
        const type = btn.getAttribute("data-type");
        if (onReaction) onReaction(item.id, cmt.id, type);
      });
    });

    cmtEl.querySelector(".btn-cmt-reply")?.addEventListener("click", () => {
      const author = cmt.author || "";
      const inputEl = document.getElementById("clickupCommentInput");
      if (inputEl) {
        inputEl.value = `@${author} `;
        inputEl.focus();
      }
      if (onReply) onReply(author);
    });

    listWrapper.appendChild(cmtEl);
  });

  if (window.lucide) window.lucide.createIcons();
  listWrapper.scrollTop = listWrapper.scrollHeight;
}

export function updateCommentCountInTable(itemId, count) {
  const counters = document.querySelectorAll(
    `.btn-cell-comments[data-id="${itemId}"] span, .btn-card-comments[data-id="${itemId}"] span`
  );
  counters.forEach((el) => {
    el.textContent = String(count);
  });
}

export function populateRemedialMentorDropdown(mentorNames = []) {
  const select = document.getElementById("remedialFormMentor");
  const filterSelect = document.getElementById("filterRemedialMentor");

  if (select) {
    const curVal = select.value;
    select.innerHTML = '<option value="">Pilih Mentor...</option>';
    mentorNames.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });
    if (curVal) select.value = curVal;
  }

  if (filterSelect) {
    const curVal = filterSelect.value;
    filterSelect.innerHTML = '<option value="">Semua Mentor</option>';
    mentorNames.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      filterSelect.appendChild(opt);
    });
    if (curVal) filterSelect.value = curVal;
  }
}

export function openRemedialSubmissionModal(defaultStatus = "REQUEST", defaultScheduleDate = "") {
  const modal = document.getElementById("remedialModal");
  if (!modal) return;

  const form = document.getElementById("internalRemedialForm");
  if (form) form.reset();

  const statusSelect = document.getElementById("remedialFormStatus");
  if (statusSelect) statusSelect.value = defaultStatus;

  const dateInput = document.getElementById("remedialFormScheduleDate");
  if (dateInput && defaultScheduleDate) {
    dateInput.value = defaultScheduleDate;
  }

  const btnClose = document.getElementById("btnCloseRemedial");
  const btnCancel = document.getElementById("btnCancelRemedialModal");
  if (btnClose) btnClose.onclick = closeRemedialSubmissionModal;
  if (btnCancel) btnCancel.onclick = closeRemedialSubmissionModal;

  modal.classList.add("open");
  if (window.lucide) window.lucide.createIcons();
}

export function closeRemedialSubmissionModal() {
  const modal = document.getElementById("remedialModal");
  if (modal) modal.classList.remove("open");
}



