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
