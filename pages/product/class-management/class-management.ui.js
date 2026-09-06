/**
 * class-management.ui.js
 * DOM Presentation Layer (Zero Firebase) for Class Management feature.
 */

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

export function renderClassTable(list, selectedClassIds, onToggleSelect, onOpenDetail) {
  const tbody = document.getElementById("classTableBody");
  const countText = document.getElementById("classCountText");
  if (!tbody) return;
  tbody.innerHTML = "";

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

  if (countText) countText.textContent = `${list.length} kelas`;
  if (window.lucide) window.lucide.createIcons();
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
        alert("Nama kelas wajib diisi");
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
