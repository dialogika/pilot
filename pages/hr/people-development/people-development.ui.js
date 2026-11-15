// pages/hr/people-development/people-development.ui.js
// =====================================================================
// PEOPLE DEVELOPMENT UI — rendering, DOM manipulation, event binding.
//
// RULES:
//  - Pure view logic; receives plain data and renders into DOM.
//  - NO Firestore/Auth calls here (use people-development.repository.js).
//  - Reuses shared ui.js (toast, setButtonBusy) and utils.js (escapeHtml).
// =====================================================================

import { escapeHtml } from "/assets/js/utils.js";
import { toast, setButtonBusy } from "/assets/js/ui.js";
import { setupExportModalControls } from "/assets/js/utils/export-helper.js";

function el(id) {
  return document.getElementById(id);
}

/**
 * Render dynamic header greeting based on current hour and user name.
 * @param {string} name
 */
export function renderHeaderGreeting(name = "") {
  const greetingEl = el("pdGreetingText");
  const subEl = el("pdSubGreetingText");
  if (!greetingEl) return;

  const hour = new Date().getHours();
  let timeOfDay = "Pagi";
  if (hour >= 11 && hour < 15) {
    timeOfDay = "Siang";
  } else if (hour >= 15 && hour < 18) {
    timeOfDay = "Sore";
  } else if (hour >= 18 || hour < 4) {
    timeOfDay = "Malam";
  }

  const safeName = name ? `, ${escapeHtml(name)}` : "";
  greetingEl.innerHTML = `Halo, Selamat ${timeOfDay}${safeName}! 👋`;
  if (subEl) {
    subEl.textContent = "Ringkasan performa, kehadiran, dan KPI divisi hari ini.";
  }
}

/**
 * Render the 4 key stat cards.
 * @param {{presentPct: number, absentPct: number, satisfactionScore: number, trainingProgress: number}} stats
 */
export function renderStats(stats) {
  const presentEl = el("attendancePresentPercent");
  const absentEl = el("attendanceAbsentPercent");
  const satisfactionEl = el("pdSatisfactionScore");
  const trainingEl = el("pdTrainingProgress");

  if (presentEl) {
    presentEl.textContent = `${Number(stats.presentPct || 0).toFixed(1)}%`;
  }
  if (absentEl) {
    absentEl.textContent = `${Number(stats.absentPct || 0).toFixed(1)}%`;
  }
  if (satisfactionEl) {
    satisfactionEl.textContent = `${Number(stats.satisfactionScore || 4.8).toFixed(1)}/5.0`;
  }
  if (trainingEl) {
    trainingEl.textContent = `${Math.round(stats.trainingProgress || 72)}%`;
  }
}

/**
 * Render KPI Assessment per Division.
 * @param {Array<{division: string, percent: number, targetLabel: string, color: string, textColor: string}>} kpis
 */
export function renderKpiSection(kpis = []) {
  const container = el("pdKpiContainer");
  if (!container) return;

  container.innerHTML = "";

  kpis.forEach((item) => {
    const card = document.createElement("div");
    card.className = "space-y-3 p-4 bg-slate-50/70 rounded-xl border border-slate-100 transition hover:bg-slate-50";
    card.innerHTML = `
      <div class="flex justify-between items-center">
        <span class="text-sm font-bold text-slate-700 uppercase tracking-tight">${escapeHtml(item.division)}</span>
        <span class="text-sm font-black ${escapeHtml(item.textColor || "text-blue-600")}">${item.percent}%</span>
      </div>
      <div class="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
        <div class="${escapeHtml(item.color || "bg-blue-600")} h-2 rounded-full transition-all duration-500" style="width: ${item.percent}%"></div>
      </div>
      <p class="text-[11px] text-slate-400 font-medium">${escapeHtml(item.targetLabel)}</p>
    `;
    container.appendChild(card);
  });
}

/**
 * Render Detail Perencanaan Training.
 * @param {{overallPercent: number, modules: Array<{title: string, percent: number}>}} training
 */
export function renderTrainingSection(training) {
  const container = el("pdTrainingContainer");
  if (!container || !training || !Array.isArray(training.modules)) return;

  container.innerHTML = "";

  training.modules.forEach((mod) => {
    const div = document.createElement("div");
    div.innerHTML = `
      <div class="flex justify-between mb-2 text-sm font-medium">
        <span class="text-slate-700 font-semibold">${escapeHtml(mod.title)}</span>
        <span class="text-indigo-600 font-bold">${mod.percent}%</span>
      </div>
      <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
        <div class="bg-indigo-600 h-2.5 rounded-full transition-all duration-500" style="width: ${mod.percent}%"></div>
      </div>
    `;
    container.appendChild(div);
  });
}

/**
 * Render leaderboard list for selected tab.
 * @param {Array<{rank: number, name: string, xp: number, initials: string, trend?: string}>} list
 */
export function renderLeaderboard(list = []) {
  const container = el("pdLeaderboardContainer");
  if (!container) return;

  container.innerHTML = "";

  if (list.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-8 text-center text-slate-400 italic text-sm">
        Belum ada data performa untuk periode ini.
      </div>
    `;
    return;
  }

  list.forEach((item) => {
    const card = document.createElement("div");
    const isTop1 = item.rank === 1;

    card.className = `pd-leaderboard-item ${isTop1 ? "pd-rank-1" : "pd-rank-normal"}`;
    card.innerHTML = `
      <span class="pd-rank-badge ${isTop1 ? "text-indigo-600" : "text-slate-300"}">#${item.rank}</span>
      <div class="w-12 h-12 rounded-full ${isTop1 ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-700"} flex items-center justify-center font-bold text-sm shadow-sm flex-shrink-0">
        ${escapeHtml(item.initials || "IN")}
      </div>
      <div class="flex-1 min-w-0">
        <h4 class="font-bold text-slate-800 text-sm truncate">${escapeHtml(item.name)}</h4>
        <p class="text-[10px] text-slate-500 uppercase font-bold tracking-wider">${item.xp.toLocaleString()} XP</p>
      </div>
      ${isTop1 ? '<i class="bi bi-graph-up-arrow text-emerald-500 font-bold"></i>' : ""}
    `;
    container.appendChild(card);
  });
}


/**
 * Render daily attendance table records.
 * @param {Array<{id: string, name: string, time: string, status: string, statusType: string, location: string, photo: string, attachmentUrl?: string, attachmentName?: string}>} logs
 */
export function renderAttendanceTable(logs = []) {
  const tbody = el("pdAttendanceTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (logs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="px-6 py-8 text-center text-slate-400 text-sm">
          <i class="bi bi-calendar2-x text-2xl block mb-2 text-slate-300"></i>
          Belum ada log kehadiran yang tercatat hari ini.
        </td>
      </tr>
    `;
    return;
  }

  logs.forEach((item) => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50/70 transition";

    let badgeClass = "pd-badge-ontime";
    if (item.statusType === "late") badgeClass = "pd-badge-late";
    else if (item.statusType === "sick" || item.statusType === "absent") badgeClass = "pd-badge-sick";
    else if (item.statusType === "permit") badgeClass = "pd-badge-permit";

    const photoHtml = item.photo
      ? `<img src="${escapeHtml(item.photo)}" alt="${escapeHtml(item.name)}" class="w-8 h-8 rounded-full object-cover border border-slate-200" />`
      : `<div class="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs">
          ${escapeHtml(item.name.charAt(0).toUpperCase())}
        </div>`;

    let noteHtml = `<span class="text-xs text-slate-500 italic">${escapeHtml(item.location)}</span>`;
    if (item.attachmentUrl) {
      noteHtml = `<a href="${escapeHtml(item.attachmentUrl)}" target="_blank" class="text-xs text-indigo-600 underline flex items-center gap-1 hover:text-indigo-800">
        <i class="bi bi-paperclip"></i>
        <span>${escapeHtml(item.attachmentName || "surat_dokter.pdf")}</span>
      </a>`;
    }

    tr.innerHTML = `
      <td class="px-6 py-4 flex items-center gap-3 font-medium text-slate-800">
        ${photoHtml}
        <span class="font-semibold text-sm truncate max-w-[200px]">${escapeHtml(item.name)}</span>
      </td>
      <td class="px-6 py-4 text-slate-600 text-sm font-medium whitespace-nowrap">
        ${escapeHtml(item.time)}
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="pd-badge ${badgeClass}">${escapeHtml(item.status)}</span>
      </td>
      <td class="px-6 py-4">
        ${noteHtml}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Setup Satisfaction Survey interactions.
 * @param {Function} onSubmitCallback
 */
export function setupSurveyUI(onSubmitCallback) {
  const emojiButtons = document.querySelectorAll(".pd-emoji-btn");
  const textarea = el("pdSurveyFeedback");
  const submitBtn = el("pdSurveySubmitBtn");

  let selectedRating = 5; // default to 'love' (rating 5)

  emojiButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      emojiButtons.forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedRating = Number(btn.getAttribute("data-rating")) || 5;
    });
  });

  if (submitBtn) {
    submitBtn.addEventListener("click", async () => {
      const feedbackText = textarea ? textarea.value.trim() : "";
      setButtonBusy(submitBtn, true, "Mengirim...");

      try {
        await onSubmitCallback({
          rating: selectedRating,
          feedback: feedbackText,
        });

        if (textarea) textarea.value = "";
        toast("Terima kasih atas feedback yang Anda berikan!", "success");
      } catch (err) {
        console.error("Gagal submit feedback survey:", err);
        toast("Gagal mengirim survey, silakan coba lagi.", "error");
      } finally {
        setButtonBusy(submitBtn, false, "Submit Feedback");
      }
    });
  }
}

/**
 * Initializes Export Modal controls for People Development.
 * @param {Function} [onFormatChange]
 * @param {Function} [onRangeChange]
 * @returns {Object} Modal control handles
 */
export function initPeopleDevExportModal(onFormatChange, onRangeChange) {
  return setupExportModalControls({
    modalId: "exportPeopleDevModal",
    onFormatChange,
    onRangeChange,
  });
}

// =====================================================================
// DATABASE MAPPING & SCHEMA ERD CONTROLS (PEOPLE DEVELOPMENT)
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
 * when People Development is active.
 */
export function mountSidebarPeopleDevErdButton() {
  const sidebarWrapper = document.querySelector("#dg-sidebar-mount .sidebar-scroll-wrapper");
  if (!sidebarWrapper) return;

  // Prevent duplicate mounts
  if (document.getElementById("sidebarBtnPeopleDevErd")) return;

  const linkEl = document.createElement("a");
  linkEl.href = "javascript:void(0)";
  linkEl.className = "sidebar-link";
  linkEl.id = "sidebarBtnPeopleDevErd";
  linkEl.setAttribute("data-bs-toggle", "modal");
  linkEl.setAttribute("data-bs-target", "#peopleDevErdModal");
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
 * Initializes People Development ERD modal tabs, search, filters, SVG connectors & copy button.
 */
export function initPeopleDevErdModalControls() {
  const modalEl = document.getElementById("peopleDevErdModal");
  if (!modalEl) return;

  // Tab controls
  const tabVisualBtn = document.getElementById("tabBtnPeopleDevErdVisual");
  const tabDictBtn = document.getElementById("tabBtnPeopleDevErdDict");
  const tabSqlBtn = document.getElementById("tabBtnPeopleDevErdSql");

  const tabVisualContent = document.getElementById("peopleDevErdTabVisualContent");
  const tabDictContent = document.getElementById("peopleDevErdTabDictContent");
  const tabSqlContent = document.getElementById("peopleDevErdTabSqlContent");

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
        setTimeout(drawPeopleDevErdRelations, 80);
      }
    });
  });

  // Kamus Data (Data Dictionary) Search & Table Filter
  const searchInput = document.getElementById("peopleDevErdDictSearchInput");
  const tableFilter = document.getElementById("peopleDevErdDictTableFilter");
  const dictTableBody = document.getElementById("peopleDevErdDictTableBody");
  const countBadge = document.getElementById("peopleDevErdDictCountBadge");

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
  const btnCopySql = document.getElementById("btnCopyPeopleDevSqlScript");
  const btnCopyText = document.getElementById("btnCopyPeopleDevSqlText");
  const sqlContent = document.getElementById("peopleDevSqlScriptContent");

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
  const btnCopyDocs = document.getElementById("btnCopyPeopleDevDocsPath");
  if (btnCopyDocs) {
    btnCopyDocs.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText("docs/PEOPLE-DEV-DATABASE-MAPPING.md");
        toast("Path docs/PEOPLE-DEV-DATABASE-MAPPING.md tersalin!", "success");
      } catch (e) {
        console.error("Gagal menyalin path:", e);
      }
    });
  }

  // =====================================================================
  // DYNAMIC SVG RELATIONS (LINES & ARROWS)
  // =====================================================================
  const wrapper = document.getElementById("peopleDevErdDiagramWrapper");
  const svgGroup = document.getElementById("peopleDevErdPathsGroup");
  const originAnchor = document.getElementById("erdOriginUsersId");

  const relationConfigs = [
    {
      id: "attendances",
      targetAnchor: document.getElementById("erdTargetAttendanceId"),
      card: document.getElementById("cardPeopleDevAttendance"),
      color: "#10b981",
      marker: "url(#peopleDevErdArrowEmerald)",
      label: "1 : N (user_id)",
      y1Offset: -10,
      tBadge: 0.35,
    },
    {
      id: "surveys",
      targetAnchor: document.getElementById("erdTargetSurveysId"),
      card: document.getElementById("cardPeopleDevSurveys"),
      color: "#ec4899",
      marker: "url(#peopleDevErdArrowPink)",
      label: "1 : N (user_id)",
      y1Offset: -3,
      tBadge: 0.58,
    },
    {
      id: "training",
      targetAnchor: document.getElementById("erdTargetTrainingId"),
      card: document.getElementById("cardPeopleDevTraining"),
      color: "#8b5cf6",
      marker: "url(#peopleDevErdArrowPurple)",
      label: "1 : N (user_id)",
      y1Offset: 4,
      tBadge: 0.42,
    },
    {
      id: "gamification",
      targetAnchor: document.getElementById("erdTargetGamificationId"),
      card: document.getElementById("cardPeopleDevGamification"),
      color: "#f59e0b",
      marker: "url(#peopleDevErdArrowAmber)",
      label: "1 : N (user_id)",
      y1Offset: 11,
      tBadge: 0.65,
    },
  ];

  let currentActiveRel = "all";

  function drawPeopleDevErdRelations() {
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
            marker-start="url(#peopleDevErdDotStart)" marker-end="${cfg.marker}" 
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

    drawPeopleDevErdRelations();
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
      setTimeout(drawPeopleDevErdRelations, 80);
    });
  }

  // Tab switch redraw
  tabVisualBtn?.addEventListener("click", () => {
    setTimeout(drawPeopleDevErdRelations, 80);
  });

  // Window resize redraw (debounced)
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawPeopleDevErdRelations, 100);
  });

  // Initial draw
  setTimeout(drawPeopleDevErdRelations, 300);
}


