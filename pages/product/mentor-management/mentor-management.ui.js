// pages/product/mentor-management/mentor-management.ui.js
// =====================================================================
// MENTOR MANAGEMENT UI
// Presentation layer: DOM manipulation, table, cards, modals, and tabs.
// Strictly NO direct Firestore queries here.
// =====================================================================

import {
  AVAILABILITY_DAYS,
  buildWhatsappLink,
  extractWhatsappNumber,
  normalizeAvailabilityDay,
  normalizeClockTime,
  parseAvailabilityTimeRange,
  normalizeAvailabilityList,
  sanitizePhoneNumber,
} from "./mentor-management.repository.js";

export function computeScore(m) {
  const ratingScore = ((m.rating || 0) / 5) * 4;
  const completionScore = ((m.completionRate || 0) / 100) * 3;
  const attendanceScore = ((m.attendanceRate || 0) / 100) * 2;
  let complaintFactor = 1;
  if ((m.complaintCount || 0) > 0) {
    const c = m.complaintCount;
    complaintFactor = Math.max(0, 1 - c / 10);
  }
  const complaintScore = complaintFactor * 1;
  let total = ratingScore + completionScore + attendanceScore + complaintScore;
  if (total < 0) total = 0;
  if (total > 10) total = 10;
  return parseFloat(total.toFixed(2));
}

export function isTopMentor(m) {
  return (m.rating || 0) >= 4.7 && (m.activeClasses || 0) >= 2;
}

export function isRiskMentor(m) {
  return (
    (m.rating || 0) <= 3.8 ||
    (m.complaintCount || 0) >= 3 ||
    (m.lastActiveDays || 0) > 45
  );
}

export function isAvailableMentor(m) {
  if ((m.lastActiveDays || 0) > 30) return false;
  if ((m.activeClasses || 0) === 0) return true;
  return (m.activeClasses || 0) <= 2;
}

export function getContractMeta(m) {
  if (!m.contractEnd) return { daysLeft: null, status: "unknown" };
  const today = new Date();
  const end = new Date(m.contractEnd);
  const diffMs = end.getTime() - today.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  let status = "active";
  if (diffDays < 0) status = "expired";
  else if (diffDays <= 30) status = "warning";
  return { daysLeft: diffDays, status: status };
}

export function getStatusBadge(status) {
  const span = document.createElement("span");
  span.className = "badge-pill";
  const icon = document.createElement("i");
  icon.className = "w-2 h-2 rounded-full";

  const norm = String(status || "").toLowerCase();
  if (norm === "active") {
    span.classList.add("badge-status-active");
    icon.style.backgroundColor = "#16a34a";
    span.appendChild(icon);
    span.appendChild(document.createTextNode("Active"));
  } else if (norm === "on_leave") {
    span.classList.add("badge-status-onleave");
    icon.style.backgroundColor = "#facc15";
    span.appendChild(icon);
    span.appendChild(document.createTextNode("On Leave"));
  } else {
    span.classList.add("badge-status-inactive");
    icon.style.backgroundColor = "#ef4444";
    span.appendChild(icon);
    span.appendChild(document.createTextNode("Inactive"));
  }
  return span;
}

export function renderSummary(list) {
  const total = list.length;
  const active = list.filter((m) => m.status === "active").length;
  const avgRating = list.length
    ? list.reduce((acc, m) => acc + (m.rating || 0), 0) / list.length
    : 0;
  const online = list.filter((m) => m.type === "Online" || m.type === "Both").length;
  const offline = list.filter((m) => m.type === "Offline" || m.type === "Both").length;

  const totalEl = document.getElementById("statTotalMentor");
  const activeEl = document.getElementById("statActiveMentor");
  const activeRatioEl = document.getElementById("statActiveRatio");
  const avgRatingEl = document.getElementById("statAvgRating");
  const onlineEl = document.getElementById("statOnlineMentor");
  const offlineEl = document.getElementById("statOfflineMentor");

  if (totalEl) totalEl.textContent = String(total);
  if (activeEl) activeEl.textContent = String(active);
  if (activeRatioEl) {
    const pct = total ? Math.round((active / total) * 100) : 0;
    activeRatioEl.textContent = total ? `${pct}% aktif` : "";
  }
  if (avgRatingEl) avgRatingEl.textContent = avgRating.toFixed(2);
  if (onlineEl) onlineEl.textContent = `${online} Online`;
  if (offlineEl) offlineEl.textContent = `${offline} Offline`;
}

export function renderMentorTable(
  allFilteredList,
  pagination,
  selectedMentorIds,
  callbacks = {}
) {
  const tbody = document.getElementById("mentorTableBody");
  const countText = document.getElementById("mentorCountText");
  if (!tbody) return;

  tbody.innerHTML = "";

  const totalItems = allFilteredList.length;
  const pageSize = pagination.pageSize;
  let pageItems = allFilteredList;

  if (pageSize > 0) {
    const startIdx = (pagination.page - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    pageItems = allFilteredList.slice(startIdx, endIdx);

    if (countText) {
      if (totalItems === 0) {
        countText.textContent = "0 mentor ditampilkan";
      } else {
        const displayStart = startIdx + 1;
        const displayEnd = Math.min(endIdx, totalItems);
        countText.textContent = `Menampilkan ${displayStart}–${displayEnd} dari ${totalItems} mentor`;
      }
    }
  } else if (countText) {
    countText.textContent = `${totalItems} mentor ditampilkan`;
  }

  if (pageItems.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 14;
    td.className = "text-center py-8 text-slate-400 text-xs";
    td.textContent = "Tidak ada mentor yang cocok dengan kriteria pencarian.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  pageItems.forEach((m) => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition";

    // Checkbox
    const tdCheck = document.createElement("td");
    tdCheck.className = "px-4 py-3";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "rounded border-slate-300";
    cb.checked = selectedMentorIds.has(m.id);
    cb.addEventListener("change", () => {
      if (callbacks.onToggleCheck) callbacks.onToggleCheck(m.id, cb.checked);
    });
    tdCheck.appendChild(cb);

    // Name + Avatar + Badges
    const tdName = document.createElement("td");
    tdName.className = "px-4 py-3";
    const nameRow = document.createElement("div");
    nameRow.className = "flex items-center gap-3";
    const avatar = document.createElement("div");
    avatar.className =
      "w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-[11px] font-bold";
    avatar.textContent = (m.fullName || "M")
      .split(" ")
      .map((p) => p.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase();

    const nameCol = document.createElement("div");
    const nameEl = document.createElement("div");
    nameEl.className = "text-xs font-semibold text-slate-900";
    nameEl.textContent = m.fullName || "-";

    const badgeRow = document.createElement("div");
    badgeRow.className = "flex items-center gap-1 mt-0.5";
    if (isTopMentor(m)) {
      const b = document.createElement("span");
      b.className = "badge-tag bg-emerald-50 text-emerald-700";
      b.textContent = "Top Mentor";
      badgeRow.appendChild(b);
    }
    if (isRiskMentor(m)) {
      const b = document.createElement("span");
      b.className = "badge-tag bg-rose-50 text-rose-600";
      b.textContent = "Risk";
      badgeRow.appendChild(b);
    }

    nameCol.appendChild(nameEl);
    if (badgeRow.children.length > 0) nameCol.appendChild(badgeRow);
    nameRow.appendChild(avatar);
    nameRow.appendChild(nameCol);
    tdName.appendChild(nameRow);

    // Nick
    const tdNick = document.createElement("td");
    tdNick.className = "px-4 py-3 text-xs text-slate-500";
    tdNick.textContent = m.nickName || "-";

    // WhatsApp
    const tdWhatsapp = document.createElement("td");
    tdWhatsapp.className = "px-4 py-3 text-center text-xs";
    const waRaw = m.whatsapp || "";
    const waNumber = m.whatsappNumber || extractWhatsappNumber(waRaw);
    const waLink =
      waRaw.indexOf("http") === 0 ? waRaw : buildWhatsappLink(waRaw);
    if (waLink) {
      const a = document.createElement("a");
      a.href = waLink;
      a.target = "_blank";
      a.className =
        "text-emerald-600 hover:text-emerald-700 underline decoration-dotted";
      a.textContent = waNumber || waLink;
      tdWhatsapp.appendChild(a);
    } else {
      tdWhatsapp.classList.add("text-slate-400");
      tdWhatsapp.textContent = "-";
    }

    // Rating
    const tdRating = document.createElement("td");
    tdRating.className = "px-4 py-3 text-center";
    const ratingRow = document.createElement("div");
    ratingRow.className = "inline-flex items-center gap-1 justify-center";
    const starIcon = document.createElement("i");
    starIcon.className = "bi bi-star-fill text-amber-400 text-[11px]";
    const ratingText = document.createElement("span");
    ratingText.className = "text-xs font-semibold text-slate-800";
    ratingText.textContent = (m.rating || 0).toFixed(1);
    ratingRow.appendChild(starIcon);
    ratingRow.appendChild(ratingText);
    tdRating.appendChild(ratingRow);

    // Teaching
    const tdTeaching = document.createElement("td");
    tdTeaching.className = "px-4 py-3 text-center";
    tdTeaching.innerHTML = `<span class="badge-tag bg-slate-100 text-slate-600">${
      m.teaching || "-"
    }</span>`;

    // Type
    const tdType = document.createElement("td");
    tdType.className = "px-4 py-3 text-center";
    tdType.innerHTML = `<span class="badge-tag bg-slate-100 text-slate-600">${
      m.type || "-"
    }</span>`;

    // Active Class
    const tdActive = document.createElement("td");
    tdActive.className =
      "px-4 py-3 text-center text-xs text-slate-700 font-semibold";
    tdActive.textContent = String(m.activeClasses || 0);

    // Total Class
    const tdTotal = document.createElement("td");
    tdTotal.className = "px-4 py-3 text-center text-xs text-slate-500";
    tdTotal.textContent = String(m.totalClasses || 0);

    // Location
    const tdLocation = document.createElement("td");
    tdLocation.className = "px-4 py-3 text-center text-xs text-slate-500";
    tdLocation.textContent = m.location || "-";

    // Status
    const tdStatus = document.createElement("td");
    tdStatus.className = "px-4 py-3 text-center";
    tdStatus.appendChild(getStatusBadge(m.status || ""));

    // Contract End
    const tdContract = document.createElement("td");
    tdContract.className = "px-4 py-3 text-center text-xs";
    const meta = getContractMeta(m);
    const text = document.createElement("div");
    text.className = "font-semibold";
    text.textContent = m.contractEnd || "-";
    const sub = document.createElement("div");
    sub.className = "text-[10px]";
    if (meta.daysLeft != null) {
      if (meta.daysLeft < 0) {
        sub.classList.add("text-rose-600");
        sub.textContent = `Expired ${Math.abs(meta.daysLeft)} hari`;
      } else if (meta.daysLeft <= 30) {
        sub.classList.add("text-amber-600");
        sub.textContent = `Habis ${meta.daysLeft} hari lagi`;
      } else {
        sub.classList.add("text-slate-400");
        sub.textContent = `${meta.daysLeft} hari lagi`;
      }
    }
    tdContract.appendChild(text);
    tdContract.appendChild(sub);

    // Score
    const tdScore = document.createElement("td");
    tdScore.className = "px-4 py-3 text-center";
    const score = computeScore(m);
    const scoreEl = document.createElement("span");
    scoreEl.className = "score-pill";
    scoreEl.textContent = score.toFixed(2);
    if (score >= 8) {
      scoreEl.classList.add("bg-emerald-50", "text-emerald-700");
    } else if (score >= 6) {
      scoreEl.classList.add("bg-amber-50", "text-amber-700");
    } else {
      scoreEl.classList.add("bg-rose-50", "text-rose-600");
    }
    tdScore.appendChild(scoreEl);

    // Actions
    const tdAction = document.createElement("td");
    tdAction.className = "px-4 py-3 text-right";
    const actionWrap = document.createElement("div");
    actionWrap.className = "inline-flex items-center gap-2";

    const detailBtn = document.createElement("button");
    detailBtn.className =
      "px-3 py-1 rounded-xl text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition";
    detailBtn.textContent = "Detail";
    detailBtn.addEventListener("click", () => {
      if (callbacks.onDetail) callbacks.onDetail(m.id);
    });

    const editBtn = document.createElement("button");
    editBtn.className =
      "px-3 py-1 rounded-xl text-[11px] font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 transition";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => {
      if (callbacks.onEdit) callbacks.onEdit(m.id);
    });

    const assignBtn = document.createElement("button");
    assignBtn.className =
      "px-3 py-1 rounded-xl text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition";
    assignBtn.textContent = "Assign";
    assignBtn.addEventListener("click", () => {
      if (callbacks.onAssign) callbacks.onAssign(m.id);
    });

    actionWrap.appendChild(detailBtn);
    actionWrap.appendChild(editBtn);
    actionWrap.appendChild(assignBtn);
    tdAction.appendChild(actionWrap);

    tr.appendChild(tdCheck);
    tr.appendChild(tdName);
    tr.appendChild(tdNick);
    tr.appendChild(tdWhatsapp);
    tr.appendChild(tdRating);
    tr.appendChild(tdTeaching);
    tr.appendChild(tdType);
    tr.appendChild(tdActive);
    tr.appendChild(tdTotal);
    tr.appendChild(tdLocation);
    tr.appendChild(tdStatus);
    tr.appendChild(tdContract);
    tr.appendChild(tdScore);
    tr.appendChild(tdAction);

    tbody.appendChild(tr);
  });
}

export function renderPagination(pagination, onPageChange, onPageSizeChange) {
  const container = document.getElementById("pgnControls");
  const sizeSelect = document.getElementById("pgnSizeSelect");
  if (!container) return;

  container.innerHTML = "";

  const totalPages = Math.ceil(pagination.total / pagination.pageSize) || 1;
  const currentPage = pagination.page;

  if (sizeSelect) {
    sizeSelect.value = String(pagination.pageSize);
    if (!sizeSelect.hasAttribute("data-bound")) {
      sizeSelect.setAttribute("data-bound", "1");
      sizeSelect.addEventListener("change", () => {
        onPageSizeChange(Number(sizeSelect.value));
      });
    }
  }

  // Prev Button
  const prevBtn = document.createElement("button");
  prevBtn.className = "pagination-btn";
  prevBtn.disabled = currentPage <= 1;
  prevBtn.innerHTML = '<i class="bi bi-chevron-left text-xs"></i>';
  prevBtn.addEventListener("click", () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  });
  container.appendChild(prevBtn);

  // Page Numbers calculation
  let pagesToShow = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pagesToShow.push(i);
  } else {
    pagesToShow.push(1);
    if (currentPage > 3) pagesToShow.push("...");
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pagesToShow.push(i);
    if (currentPage < totalPages - 2) pagesToShow.push("...");
    pagesToShow.push(totalPages);
  }

  pagesToShow.forEach((p) => {
    if (p === "...") {
      const dots = document.createElement("span");
      dots.className = "px-1.5 text-xs text-slate-400";
      dots.textContent = "...";
      container.appendChild(dots);
    } else {
      const pageBtn = document.createElement("button");
      pageBtn.className =
        "pagination-btn" + (p === currentPage ? " active" : "");
      pageBtn.textContent = String(p);
      pageBtn.addEventListener("click", () => {
        if (p !== currentPage) onPageChange(p);
      });
      container.appendChild(pageBtn);
    }
  });

  // Next Button
  const nextBtn = document.createElement("button");
  nextBtn.className = "pagination-btn";
  nextBtn.disabled = currentPage >= totalPages;
  nextBtn.innerHTML = '<i class="bi bi-chevron-right text-xs"></i>';
  nextBtn.addEventListener("click", () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  });
  container.appendChild(nextBtn);
}

export function renderRanking(list) {
  const topContainer = document.getElementById("topMentorList");
  const riskContainer = document.getElementById("riskMentorList");
  if (!topContainer || !riskContainer) return;

  topContainer.innerHTML = "";
  riskContainer.innerHTML = "";

  const scored = list.map((m) => ({ ...m, score: computeScore(m) }));
  const sortedDesc = scored.slice().sort((a, b) => (b.score || 0) - (a.score || 0));
  const sortedAsc = scored.slice().sort((a, b) => (a.score || 0) - (b.score || 0));

  sortedDesc.slice(0, 5).forEach((m, idx) => {
    const row = document.createElement("div");
    row.className = "flex items-center justify-between";
    const left = document.createElement("div");
    left.className = "flex items-center gap-2";
    const badge = document.createElement("div");
    badge.className =
      "w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center text-[11px] font-bold";
    badge.textContent = String(idx + 1);

    const textWrap = document.createElement("div");
    const name = document.createElement("div");
    name.className = "text-[11px] font-semibold text-slate-800";
    name.textContent = m.nickName || m.fullName || "-";
    const sub = document.createElement("div");
    sub.className = "text-[10px] text-slate-400";
    sub.textContent = `Score ${m.score.toFixed(2)} • Rating ${(
      m.rating || 0
    ).toFixed(1)}`;
    textWrap.appendChild(name);
    textWrap.appendChild(sub);

    left.appendChild(badge);
    left.appendChild(textWrap);

    const right = document.createElement("div");
    right.className = "text-[10px] text-emerald-600 font-semibold";
    right.textContent = `${m.activeClasses || 0} kelas aktif`;

    row.appendChild(left);
    row.appendChild(right);
    topContainer.appendChild(row);
  });

  sortedAsc
    .filter((m) => isRiskMentor(m))
    .slice(0, 5)
    .forEach((m) => {
      const row = document.createElement("div");
      row.className = "flex items-center justify-between";
      const left = document.createElement("div");
      left.className = "flex items-center gap-2";
      const dot = document.createElement("span");
      dot.className = "w-2 h-2 rounded-full bg-rose-500";
      const name = document.createElement("span");
      name.className = "text-[11px] font-semibold text-slate-800";
      name.textContent = m.nickName || m.fullName || "-";
      left.appendChild(dot);
      left.appendChild(name);

      const right = document.createElement("div");
      right.className = "text-[10px] text-rose-600";
      right.textContent = `Complaints ${m.complaintCount || 0} • Score ${computeScore(
        m
      ).toFixed(2)}`;

      row.appendChild(left);
      row.appendChild(right);
      riskContainer.appendChild(row);
    });
}

export function renderReminders(list) {
  const container = document.getElementById("reminderList");
  if (!container) return;
  container.innerHTML = "";
  const reminders = [];

  list.forEach((m) => {
    const meta = getContractMeta(m);
    if (meta.daysLeft != null && meta.daysLeft <= 30) {
      const type = meta.daysLeft < 0 ? "danger" : "warning";
      const text =
        meta.daysLeft < 0
          ? `Kontrak ${m.nickName || m.fullName} sudah habis ${Math.abs(
              meta.daysLeft
            )} hari.`
          : `Kontrak ${m.nickName || m.fullName} habis ${meta.daysLeft} hari lagi.`;
      reminders.push({ type, text });
    }
    if ((m.lastActiveDays || 0) >= 30) {
      reminders.push({
        type: "warning",
        text: `Mentor ${m.nickName || m.fullName} tidak aktif ${
          m.lastActiveDays || 0
        } hari.`,
      });
    }
    if (isRiskMentor(m)) {
      reminders.push({
        type: "danger",
        text: `Mentor ${m.nickName || m.fullName} termasuk kategori Risk, perlu review.`,
      });
    }
  });

  if (!reminders.length) {
    const empty = document.createElement("p");
    empty.className = "text-xs text-slate-400";
    empty.textContent = "Tidak ada reminder kritikal saat ini.";
    container.appendChild(empty);
    return;
  }

  reminders.slice(0, 6).forEach((r) => {
    const row = document.createElement("div");
    row.className = "flex items-start gap-2";
    const icon = document.createElement("div");
    icon.className = "mt-0.5";
    const dot = document.createElement("span");
    dot.className = "w-2 h-2 rounded-full inline-block";
    if (r.type === "danger") dot.classList.add("bg-rose-500");
    else if (r.type === "warning") dot.classList.add("bg-amber-400");
    else dot.classList.add("bg-slate-300");
    icon.appendChild(dot);

    const text = document.createElement("p");
    text.className = "text-[11px] text-slate-600";
    text.textContent = r.text;

    row.appendChild(icon);
    row.appendChild(text);
    container.appendChild(row);
  });
}

export function populateLocationFilter(list) {
  const select = document.getElementById("filterLocation");
  if (!select) return;
  const unique = Array.from(
    new Set(list.map((m) => m.location || "").filter((loc) => loc && loc !== "-"))
  ).sort();
  while (select.options.length > 1) {
    select.remove(1);
  }
  unique.forEach((loc) => {
    const opt = document.createElement("option");
    opt.value = loc;
    opt.textContent = loc;
    select.appendChild(opt);
  });
}

export function openDetailModal(mentor, callbacks = {}) {
  const modal = document.getElementById("mentorDetailModal");
  if (!modal || !mentor) return;

  const avatar = document.getElementById("detailAvatar");
  const fullName = document.getElementById("detailFullName");
  const subtitle = document.getElementById("detailSubtitle");
  const badges = document.getElementById("detailBadges");
  const fullNameValue = document.getElementById("detailFullNameValue");
  const nickName = document.getElementById("detailNickName");
  const whatsapp = document.getElementById("detailWhatsapp");
  const location = document.getElementById("detailLocation");
  const status = document.getElementById("detailStatus");
  const availability = document.getElementById("detailAvailability");
  const ratingEl = document.getElementById("detailRating");
  const completionEl = document.getElementById("detailCompletion");
  const attendanceEl = document.getElementById("detailAttendance");
  const complaintsEl = document.getElementById("detailComplaints");
  const perfInsight = document.getElementById("detailPerformanceInsight");
  const totalClasses = document.getElementById("detailTotalClasses");
  const classesBody = document.getElementById("detailClassesBody");
  const totalEarning = document.getElementById("detailTotalEarning");
  const pendingPayment = document.getElementById("detailPendingPayment");
  const feeOnline = document.getElementById("detailFeeOnline");
  const feeOffline = document.getElementById("detailFeeOffline");
  const contractEnd = document.getElementById("detailContractEnd");
  const contractDuration = document.getElementById("detailContractDuration");
  const contractStatus = document.getElementById("detailContractStatus");
  const contractNotes = document.getElementById("detailContractNotes");
  const btnDetailAssign = document.getElementById("btnDetailAssign");

  if (avatar) {
    avatar.textContent = (mentor.fullName || "M")
      .split(" ")
      .map((p) => p.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  if (fullName) fullName.textContent = mentor.fullName || "-";
  if (subtitle)
    subtitle.textContent = `${mentor.nickName || "-"} • ${
      mentor.location || "-"
    }`;
  if (badges) {
    badges.innerHTML = "";
    if (isTopMentor(mentor)) {
      const b = document.createElement("span");
      b.className = "badge-tag bg-emerald-50 text-emerald-700";
      b.textContent = "Top Mentor";
      badges.appendChild(b);
    }
    if (isRiskMentor(mentor)) {
      const b = document.createElement("span");
      b.className = "badge-tag bg-rose-50 text-rose-600";
      b.textContent = "Risk";
      badges.appendChild(b);
    }
  }

  if (fullNameValue) fullNameValue.textContent = mentor.fullName || "-";
  if (nickName) nickName.textContent = mentor.nickName || "-";
  if (whatsapp) {
    const waRaw = mentor.whatsapp || "";
    const waNumber = mentor.whatsappNumber || extractWhatsappNumber(waRaw);
    const waLink =
      waRaw.indexOf("http") === 0 ? waRaw : buildWhatsappLink(waRaw);
    if (waLink) {
      whatsapp.innerHTML = "";
      const a = document.createElement("a");
      a.href = waLink;
      a.target = "_blank";
      a.className = "underline decoration-dotted";
      a.textContent = waNumber || waLink;
      whatsapp.appendChild(a);
    } else {
      whatsapp.textContent = "-";
    }
  }
  if (location) location.textContent = mentor.location || "-";
  if (status) {
    status.innerHTML = "";
    status.appendChild(getStatusBadge(mentor.status || ""));
  }

  const detailBankName = document.getElementById("detailBankName");
  const detailAccountNumber = document.getElementById("detailAccountNumber");
  const detailAccountHolderName = document.getElementById(
    "detailAccountHolderName"
  );
  if (detailBankName) detailBankName.textContent = mentor.bankName || "-";
  if (detailAccountNumber)
    detailAccountNumber.textContent = mentor.accountNumber || "-";
  if (detailAccountHolderName)
    detailAccountHolderName.textContent =
      mentor.accountHolderName || mentor.fullName || "-";

  if (availability) {
    const items = normalizeAvailabilityList(mentor.availability);
    if (items.length) {
      availability.innerHTML = items
        .map((a) => `<div>${a.day} • ${a.time}</div>`)
        .join("");
    } else {
      availability.textContent = "Belum ada jadwal availability tersimpan.";
    }
  }

  if (ratingEl) {
    ratingEl.innerHTML = "";
    const star = document.createElement("i");
    star.className = "bi bi-star-fill text-amber-400 text-sm";
    const text = document.createElement("span");
    text.textContent = ` ${(mentor.rating || 0).toFixed(1)} / 5.0`;
    ratingEl.appendChild(star);
    ratingEl.appendChild(text);
  }
  if (completionEl)
    completionEl.textContent = `${mentor.completionRate || 0}%`;
  if (attendanceEl)
    attendanceEl.textContent = `${mentor.attendanceRate || 0}%`;
  if (complaintsEl)
    complaintsEl.textContent = String(mentor.complaintCount || 0);

  if (perfInsight) {
    perfInsight.innerHTML = "";
    const score = computeScore(mentor);
    const liScore = document.createElement("li");
    liScore.textContent = `Auto score: ${score.toFixed(2)} (0–10).`;
    perfInsight.appendChild(liScore);
    const li1 = document.createElement("li");
    li1.textContent =
      "Rating menyumbang 40%, completion 30%, attendance 20%, complaint 10%.";
    perfInsight.appendChild(li1);
    if (isTopMentor(mentor)) {
      const li = document.createElement("li");
      li.textContent =
        "Masuk kategori Top Mentor, direkomendasikan untuk batch prioritas.";
      perfInsight.appendChild(li);
    }
    if (isRiskMentor(mentor)) {
      const li = document.createElement("li");
      li.textContent =
        "Kategori Risk, perlu review materi, komunikasi, atau matching kelas.";
      perfInsight.appendChild(li);
    }
    if ((mentor.lastActiveDays || 0) > 30) {
      const li = document.createElement("li");
      li.textContent = `Tidak ada kelas baru dalam ${
        mentor.lastActiveDays || 0
      } hari.`;
      perfInsight.appendChild(li);
    }
  }

  if (totalClasses) {
    const total = Array.isArray(mentor.classHistory)
      ? mentor.classHistory.length
      : 0;
    totalClasses.textContent = `${total} kelas tercatat`;
  }
  if (classesBody) {
    classesBody.innerHTML = "";
    (mentor.classHistory || []).forEach((ch) => {
      const tr = document.createElement("tr");
      const tdName = document.createElement("td");
      tdName.className = "px-3 py-2 text-xs text-slate-700";
      tdName.textContent = ch.name || "-";
      const tdDate = document.createElement("td");
      tdDate.className = "px-3 py-2 text-xs text-slate-500";
      tdDate.textContent = ch.date || "-";
      const tdStudents = document.createElement("td");
      tdStudents.className = "px-3 py-2 text-xs text-center text-slate-700";
      tdStudents.textContent = String(ch.students || 0);
      tr.appendChild(tdName);
      tr.appendChild(tdDate);
      tr.appendChild(tdStudents);
      classesBody.appendChild(tr);
    });
  }

  if (totalEarning)
    totalEarning.textContent = `Rp ${(mentor.totalEarning || 0).toLocaleString(
      "id-ID"
    )}`;
  if (pendingPayment)
    pendingPayment.textContent = `Rp ${(
      mentor.pendingPayment || 0
    ).toLocaleString("id-ID")}`;
  if (feeOnline)
    feeOnline.textContent = `Rp ${(mentor.feeOnline || 0).toLocaleString(
      "id-ID"
    )}`;
  if (feeOffline)
    feeOffline.textContent = `Rp ${(mentor.feeOffline || 0).toLocaleString(
      "id-ID"
    )}`;

  if (contractEnd) contractEnd.textContent = mentor.contractEnd || "-";
  if (contractDuration)
    contractDuration.textContent = mentor.contractDurationMonths
      ? `${mentor.contractDurationMonths} bulan`
      : "-";
  if (contractStatus) {
    const meta = getContractMeta(mentor);
    contractStatus.textContent =
      meta.status === "expired"
        ? "Expired"
        : meta.status === "warning"
        ? "Segera Berakhir"
        : "Aktif";
    contractStatus.className =
      "font-semibold " +
      (meta.status === "expired"
        ? "text-rose-600"
        : meta.status === "warning"
        ? "text-amber-600"
        : "text-emerald-600");
  }
  if (contractNotes)
    contractNotes.textContent = mentor.contractNotes || "-";

  if (btnDetailAssign) {
    btnDetailAssign.onclick = () => {
      if (callbacks.onAssign) callbacks.onAssign(mentor.id);
    };
  }

  setActiveTab("overview");
  modal.classList.add("open");
}

export function closeDetailModal() {
  const modal = document.getElementById("mentorDetailModal");
  if (modal) modal.classList.remove("open");
}

export function setActiveTab(tabId) {
  const tabs = document.querySelectorAll("#detailTabList button[data-tab]");
  const panels = document.querySelectorAll("[data-tab-panel]");
  tabs.forEach((btn) => {
    const id = btn.getAttribute("data-tab");
    if (id === tabId) {
      btn.classList.remove("tab-pill-inactive");
      btn.classList.add("tab-pill-active");
    } else {
      btn.classList.remove("tab-pill-active");
      btn.classList.add("tab-pill-inactive");
    }
  });
  panels.forEach((p) => {
    const id = p.getAttribute("data-tab-panel");
    if (id === tabId) {
      p.classList.remove("hidden");
    } else {
      p.classList.add("hidden");
    }
  });
}

export function openAssignModal(mentor, classesList = [], onConfirm) {
  const modal = document.getElementById("assignModal");
  if (!modal || !mentor) return;

  const nameEl = document.getElementById("assignMentorName");
  const select = document.getElementById("assignClassSelect");
  const note = document.getElementById("assignNote");
  const confirmBtn = document.getElementById("btnAssignConfirm");

  if (nameEl) {
    nameEl.textContent = `Mentor: ${mentor.fullName || mentor.nickName || "-"}`;
  }

  if (select) {
    select.innerHTML = "";
    const emptyOpt = document.createElement("option");
    emptyOpt.value = "";
    emptyOpt.textContent = "Pilih kelas yang tersedia";
    select.appendChild(emptyOpt);

    classesList.forEach((cls) => {
      const opt = document.createElement("option");
      opt.value = cls.id;
      opt.textContent = `${cls.name} (${cls.type} • ${cls.location})`;
      select.appendChild(opt);
    });
  }

  if (note) note.value = "";

  if (confirmBtn) {
    confirmBtn.onclick = () => {
      if (!select.value) {
        alert("Pilih kelas terlebih dahulu.");
        return;
      }
      onConfirm(mentor.id, select.value, note ? note.value : "");
    };
  }

  modal.classList.add("open");
}

export function closeAssignModal() {
  const modal = document.getElementById("assignModal");
  if (modal) modal.classList.remove("open");
}

export function addAvailabilitySlot(dayValue = "", startValue = "", endValue = "") {
  const slotsContainer = document.getElementById("addMentorAvailabilitySlots");
  if (!slotsContainer) return;

  const row = document.createElement("div");
  row.className = "grid grid-cols-1 sm:grid-cols-12 gap-2 items-center";
  row.setAttribute("data-availability-slot", "1");

  const select = document.createElement("select");
  select.className =
    "sm:col-span-4 w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500";
  select.setAttribute("data-role", "day");

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = "Pilih hari";
  select.appendChild(emptyOption);

  AVAILABILITY_DAYS.forEach((day) => {
    const option = document.createElement("option");
    option.value = day;
    option.textContent = day;
    select.appendChild(option);
  });

  const start = document.createElement("input");
  start.type = "time";
  start.className =
    "sm:col-span-3 w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500";
  start.setAttribute("data-role", "start");

  const end = document.createElement("input");
  end.type = "time";
  end.className =
    "sm:col-span-3 w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500";
  end.setAttribute("data-role", "end");

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className =
    "sm:col-span-2 w-full text-[11px] font-semibold rounded-xl px-3 py-2 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100";
  removeBtn.textContent = "Hapus";
  removeBtn.addEventListener("click", () => row.remove());

  select.value = normalizeAvailabilityDay(dayValue || "");
  start.value = normalizeClockTime(startValue || "");
  end.value = normalizeClockTime(endValue || "");

  row.appendChild(select);
  row.appendChild(start);
  row.appendChild(end);
  row.appendChild(removeBtn);
  slotsContainer.appendChild(row);
}

export function renderAvailabilitySlots(availabilityList) {
  const slotsContainer = document.getElementById("addMentorAvailabilitySlots");
  if (slotsContainer) slotsContainer.innerHTML = "";

  const normalized = normalizeAvailabilityList(availabilityList);
  if (!normalized.length) {
    addAvailabilitySlot("", "", "");
    return;
  }
  normalized.forEach((item) => {
    const parsed = parseAvailabilityTimeRange(item.time || "");
    addAvailabilitySlot(item.day, parsed.start, parsed.end);
  });
}

export function collectAvailabilityFromForm() {
  const slotsContainer = document.getElementById("addMentorAvailabilitySlots");
  if (!slotsContainer) {
    return { list: [], hasPartial: false, hasInvalidRange: false };
  }

  const rows = slotsContainer.querySelectorAll("[data-availability-slot]");
  const list = [];
  let hasPartial = false;
  let hasInvalidRange = false;

  rows.forEach((row) => {
    const day = normalizeAvailabilityDay(
      (row.querySelector('[data-role="day"]') || {}).value || ""
    );
    const start = normalizeClockTime(
      (row.querySelector('[data-role="start"]') || {}).value || ""
    );
    const end = normalizeClockTime(
      (row.querySelector('[data-role="end"]') || {}).value || ""
    );

    if (!day && !start && !end) return;
    if (!day || !start || !end) {
      hasPartial = true;
      return;
    }
    if (start >= end) {
      hasInvalidRange = true;
      return;
    }
    list.push({
      day: day,
      time: `${start} - ${end}`,
    });
  });

  return { list, hasPartial, hasInvalidRange };
}

export function openAddMentorModal(mentorToEdit = null) {
  const modal = document.getElementById("addMentorModal");
  if (!modal) return;

  const titleEl = document.getElementById("addMentorModalTitle");
  const saveBtn = document.getElementById("btnAddMentorSave");
  const errorEl = document.getElementById("addMentorError");

  if (errorEl) {
    errorEl.textContent = "";
    errorEl.classList.add("hidden");
  }

  const isEdit = Boolean(mentorToEdit);
  if (titleEl) {
    titleEl.textContent = isEdit ? "Edit Mentor" : "Add New Mentor";
  }
  if (saveBtn) {
    saveBtn.textContent = isEdit ? "Simpan Perubahan" : "Simpan Mentor";
  }

  const fullNameInput = document.getElementById("addMentorFullName");
  const nickNameInput = document.getElementById("addMentorNickName");
  const whatsappInput = document.getElementById("addMentorWhatsapp");
  const locationInput = document.getElementById("addMentorLocation");
  const ratingInput = document.getElementById("addMentorRating");
  const teachingSelect = document.getElementById("addMentorTeaching");
  const typeSelect = document.getElementById("addMentorType");
  const statusSelect = document.getElementById("addMentorStatus");
  const contractEndInput = document.getElementById("addMentorContractEnd");
  const feeOnlineInput = document.getElementById("addMentorFeeOnline");
  const feeOfflineInput = document.getElementById("addMentorFeeOffline");
  const notesInput = document.getElementById("addMentorContractNotes");
  const bankNameInput = document.getElementById("addMentorBankName");
  const accountNumberInput = document.getElementById("addMentorAccountNumber");
  const accountHolderNameInput = document.getElementById(
    "addMentorAccountHolderName"
  );

  if (isEdit) {
    if (fullNameInput) fullNameInput.value = mentorToEdit.fullName || "";
    if (nickNameInput) nickNameInput.value = mentorToEdit.nickName || "";
    if (whatsappInput)
      whatsappInput.value =
        mentorToEdit.whatsappNumber ||
        extractWhatsappNumber(mentorToEdit.whatsapp || "");
    if (locationInput) locationInput.value = mentorToEdit.location || "";
    if (ratingInput)
      ratingInput.value = (mentorToEdit.rating || 0).toFixed(1);
    if (teachingSelect)
      teachingSelect.value = mentorToEdit.teaching || "Both";
    if (typeSelect) typeSelect.value = mentorToEdit.type || "Online";
    if (statusSelect)
      statusSelect.value = mentorToEdit.status || "active";
    if (contractEndInput)
      contractEndInput.value = mentorToEdit.contractEnd || "";
    if (feeOnlineInput)
      feeOnlineInput.value = String(mentorToEdit.feeOnline || 0);
    if (feeOfflineInput)
      feeOfflineInput.value = String(mentorToEdit.feeOffline || 0);
    if (notesInput) notesInput.value = mentorToEdit.contractNotes || "";
    if (bankNameInput) bankNameInput.value = mentorToEdit.bankName || "";
    if (accountNumberInput)
      accountNumberInput.value = mentorToEdit.accountNumber || "";
    if (accountHolderNameInput)
      accountHolderNameInput.value =
        mentorToEdit.accountHolderName || mentorToEdit.fullName || "";
    renderAvailabilitySlots(mentorToEdit.availability || []);
  } else {
    if (fullNameInput) fullNameInput.value = "";
    if (nickNameInput) nickNameInput.value = "";
    if (whatsappInput) whatsappInput.value = "";
    if (locationInput) locationInput.value = "";
    if (ratingInput) ratingInput.value = "0.0";
    if (teachingSelect) teachingSelect.value = "Both";
    if (typeSelect) typeSelect.value = "Online";
    if (statusSelect) statusSelect.value = "active";
    if (contractEndInput) contractEndInput.value = "";
    if (feeOnlineInput) feeOnlineInput.value = "50000";
    if (feeOfflineInput) feeOfflineInput.value = "75000";
    if (notesInput) notesInput.value = "";
    if (bankNameInput) bankNameInput.value = "";
    if (accountNumberInput) accountNumberInput.value = "";
    if (accountHolderNameInput) accountHolderNameInput.value = "";
    renderAvailabilitySlots([]);
  }

  modal.classList.add("open");
  if (fullNameInput) fullNameInput.focus();
}

export function closeAddMentorModal() {
  const modal = document.getElementById("addMentorModal");
  if (modal) modal.classList.remove("open");
}

export function setAddMentorError(msg) {
  const errorEl = document.getElementById("addMentorError");
  if (!errorEl) return;
  if (!msg) {
    errorEl.textContent = "";
    errorEl.classList.add("hidden");
  } else {
    errorEl.textContent = msg;
    errorEl.classList.remove("hidden");
  }
}
