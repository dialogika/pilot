// pages/hr/intern-satisfaction/intern-satisfaction.ui.js
// =====================================================================
// INTERN SATISFACTION UI MODULE
// DOM rendering and presentation logic.
// Strictly NO Firestore access or network calls here.
// =====================================================================

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export function mean(arr) {
  const vals = arr.filter((v) => typeof v === "number" && !isNaN(v));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

export function toDate(v) {
  if (!v) return null;
  if (typeof v.toDate === "function") {
    const t = v.toDate();
    return isNaN(t.getTime()) ? null : t;
  }
  const t = new Date(v);
  return isNaN(t.getTime()) ? null : t;
}

export function fmtDate(v) {
  const d = toDate(v);
  if (!d) return "-";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function initials(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";
}

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export function fullStars(d5) {
  return clamp(Math.round(d5 - 0.25), 0, 5);
}

export function pctScore(s) {
  return (s / 5) * 100;
}

export function colorFor(s) {
  const p = pctScore(s);
  if (p >= 75) return "#16a34a";
  if (p >= 50) return "#d97706";
  return "#dc2626";
}

export function pctBadgeClass(s) {
  const p = pctScore(s);
  if (p >= 75) return "badge-pct-green";
  if (p >= 50) return "badge-pct-yellow";
  return "badge-pct-red";
}

export function ratingValues(doc, cat) {
  const obj = doc[cat.id] || {};
  return Object.values(obj.ratings || obj);
}

export function catAvg(doc, cat) {
  return mean(ratingValues(doc, cat));
}

export function overallScore(doc, categories) {
  let vals = [];
  categories.forEach((c) => {
    vals = vals.concat(ratingValues(doc, c));
  });
  return mean(vals);
}

export function starsHTML(d5, sizeClass) {
  const f = fullStars(d5);
  let h = "";
  for (let i = 1; i <= 5; i++) {
    h += `<span class="star${i <= f ? " filled" : ""}">${i <= f ? "★" : "☆"}</span>`;
  }
  return `<span class="${sizeClass || "stars-sm"}">${h}</span>`;
}

export function circularHTML(pctVal, color, label) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const off = c - (clamp(pctVal, 0, 100) / 100) * c;
  return `<svg viewBox="0 0 72 72" width="72" height="72" style="flex-shrink:0;">
    <circle cx="36" cy="36" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="7"/>
    <circle cx="36" cy="36" r="${r}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 36 36)"/>
    <text x="36" y="40" text-anchor="middle" font-size="13" font-weight="700" fill="#0f172a">${label}</text>
  </svg>`;
}

export function avatarHTML(photo, name, cls) {
  if (photo) {
    return `<div class="${cls}"><img src="${esc(photo)}" alt="${esc(name)}" loading="lazy" onerror="this.onerror=null; this.parentElement.innerHTML='${esc(initials(name))}';"/></div>`;
  }
  return `<div class="${cls}">${esc(initials(name))}</div>`;
}

export function respondentInfo(doc) {
  return doc.respondent_info || {};
}

/**
 * Cache and get DOM element references.
 */
export function getElements() {
  return {
    loadingState: document.getElementById("loadingState"),
    dashboardContent: document.getElementById("dashboardContent"),
    dataInfoText: document.getElementById("dataInfoText"),
    summaryStars: document.getElementById("summaryStars"),
    summaryScore: document.getElementById("summaryScore"),
    summaryRaw: document.getElementById("summaryRaw"),
    summaryCount: document.getElementById("summaryCount"),
    summaryPct: document.getElementById("summaryPct"),
    categoryCards: document.getElementById("categoryCards"),
    searchInput: document.getElementById("searchInput"),
    deptFilter: document.getElementById("deptFilter"),
    sortSelect: document.getElementById("sortSelect"),
    respondentGrid: document.getElementById("respondentGrid"),
    gridEmpty: document.getElementById("gridEmpty"),
    pgnInfo: document.getElementById("pgnInfo"),
    pgnControls: document.getElementById("pgnControls"),
    pgnContainer: document.getElementById("pgnContainer"),
    detailModal: document.getElementById("detailModal"),
    detailModalBody: document.getElementById("detailModalBody"),
  };
}

/**
 * Render loading spinner.
 */
export function renderLoading() {
  const els = getElements();
  if (els.loadingState) els.loadingState.style.display = "block";
  if (els.dashboardContent) els.dashboardContent.style.display = "none";
  if (els.dataInfoText) els.dataInfoText.textContent = "Menunggu data...";
}

/**
 * Render error state.
 */
export function renderError(message) {
  const els = getElements();
  if (els.loadingState) {
    els.loadingState.innerHTML = `<p class="text-danger small">${esc(message)}</p>`;
  }
  if (els.dataInfoText) els.dataInfoText.textContent = "Gagal memuat";
}

/**
 * Render main summary metrics card.
 */
export function renderSummary(surveys, categories) {
  const els = getElements();
  const n = surveys.length;
  const avg = n ? mean(surveys.map((s) => overallScore(s, categories))) : 0;
  const totalQuestions = categories.reduce((acc, c) => acc + c.ratings.length, 0);

  if (els.summaryStars) els.summaryStars.innerHTML = starsHTML(avg, "summary-stars");
  if (els.summaryScore) els.summaryScore.textContent = avg.toFixed(1);
  if (els.summaryRaw) els.summaryRaw.textContent = String(totalQuestions);
  if (els.summaryCount) els.summaryCount.textContent = String(n);
  if (els.summaryPct) els.summaryPct.textContent = Math.round(pctScore(avg)) + "%";
}

/**
 * Render category stat cards (Self Performance, Team Satisfaction, Overall Assessment).
 */
export function renderCategoryCards(surveys, categories) {
  const els = getElements();
  if (!els.categoryCards) return;

  const n = surveys.length;
  els.categoryCards.innerHTML = categories
    .map((c) => {
      const avg = n ? mean(surveys.map((s) => catAvg(s, c))) : 0;
      const p = pctScore(avg);
      const color = colorFor(avg);
      const cls = pctBadgeClass(avg);
      return `
        <div class="col-12 col-md-4">
          <div class="cat-stat-card">
            <div class="d-flex align-items-center justify-content-between mb-3">
              <div class="d-flex align-items-center gap-3">
                <div class="rounded-3 d-flex align-items-center justify-content-center" style="width:42px;height:42px;background:#eef2ff;color:#4f46e5;font-size:20px;">
                  <i class="bi ${c.icon}"></i>
                </div>
                <div>
                  <div class="cat-stat-title">${esc(c.title)}</div>
                  <div class="cat-stat-sub">${esc(c.short)}</div>
                </div>
              </div>
              ${circularHTML(p, color, Math.round(p) + "%")}
            </div>
            <div class="d-flex align-items-end justify-content-between">
              <div>
                <div class="cat-stat-score">${avg.toFixed(1)} <small class="text-slate-400 fw-semibold" style="font-size:12px;">/ 5</small></div>
                <div class="small text-slate-400">${c.ratings.length} pertanyaan Likert</div>
              </div>
              <span class="${cls}">${Math.round(p)}% puas</span>
            </div>
            <div class="stars-sm mt-2">${starsHTML(avg)}</div>
          </div>
        </div>`;
    })
    .join("");
}

/**
 * Populate department dropdown options.
 */
export function renderDeptFilter(surveys, selectedDept = "") {
  const els = getElements();
  if (!els.deptFilter) return;

  const depts = [
    ...new Set(
      surveys.map((s) => (respondentInfo(s).divisi || "").trim()).filter(Boolean)
    ),
  ].sort();

  els.deptFilter.innerHTML =
    '<option value="">Semua Divisi</option>' +
    depts.map((d) => `<option value="${esc(d)}">${esc(d)}</option>`).join("");
  els.deptFilter.value = selectedDept;
}

/**
 * Render respondent grid cards and pagination.
 */
export function renderGrid(filteredSurveys, userPhotoCache, categories, currentPage, pageSize) {
  const els = getElements();
  if (!els.respondentGrid) return;

  if (!filteredSurveys.length) {
    els.respondentGrid.innerHTML = "";
    if (els.gridEmpty) els.gridEmpty.style.display = "block";
    if (els.pgnInfo) els.pgnInfo.textContent = "";
    if (els.pgnControls) els.pgnControls.innerHTML = "";
    if (els.pgnContainer) els.pgnContainer.style.display = "none";
    return;
  }

  if (els.gridEmpty) els.gridEmpty.style.display = "none";

  const totalPages = Math.max(1, Math.ceil(filteredSurveys.length / pageSize));
  const safePage = clamp(currentPage, 1, totalPages);
  const start = (safePage - 1) * pageSize;
  const rows = filteredSurveys.slice(start, start + pageSize);

  els.respondentGrid.innerHTML = rows
    .map((s) => {
      const ri = respondentInfo(s);
      const ov = overallScore(s, categories);
      const photo = userPhotoCache.get(s.user_id || "") || s.photo || ri.photo || "";
      const pills = categories
        .map((c) => {
          return `<span class="cat-pill"><i class="bi ${c.icon} me-1" style="color:#6366f1;"></i>${catAvg(s, c).toFixed(1)}</span>`;
        })
        .join(" ");

      return `
        <div class="col-12 col-sm-6 col-lg-4 col-xxl-3">
          <button type="button" class="resp-card" data-id="${esc(s.id)}">
            <div class="d-flex align-items-center gap-3 mb-3">
              ${avatarHTML(photo, ri.nama, "avatar")}
              <div class="min-w-0">
                <div class="resp-name text-truncate">${esc(ri.nama || "-")}</div>
                <div class="resp-sub text-truncate">${esc(ri.divisi || "-")}</div>
              </div>
            </div>
            <div class="d-flex align-items-center justify-content-between mb-2">
              ${starsHTML(ov)}
              <span class="small fw-bold text-slate-700">${ov.toFixed(1)}/5</span>
            </div>
            <div class="d-flex flex-wrap gap-1 mb-2">${pills}</div>
            <div class="d-flex flex-wrap gap-1 mb-2">
              <span class="resp-reason" title="${esc(ri.alasan_mengakhiri || "")}">
                <i class="bi bi-box-arrow-right"></i>${esc(ri.alasan_mengakhiri || "-")}
              </span>
            </div>
            <div class="resp-date"><i class="bi bi-calendar3 me-1"></i>${fmtDate(s.created_at)}</div>
          </button>
        </div>`;
    })
    .join("");

  // Pagination controls
  renderPagination(filteredSurveys.length, safePage, pageSize);
}

/**
 * Render pagination controls.
 * Only shows buttons if total items > pageSize, but always shows count info.
 */
export function renderPagination(totalFiltered, currentPage, pageSize) {
  const els = getElements();
  if (!els.pgnInfo || !els.pgnControls) return;

  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const startIdx = (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalFiltered);

  els.pgnInfo.textContent = totalFiltered
    ? `Menampilkan ${startIdx}–${endIdx} dari ${totalFiltered} responden`
    : "Tidak ada data";

  if (els.pgnContainer) {
    els.pgnContainer.style.display = totalFiltered ? "flex" : "none";
  }

  const mk = (lbl, pg, dis, act) => {
    const cls = act
      ? "pgn-btn active"
      : dis
        ? "pgn-btn disabled"
        : "pgn-btn";
    return `<button type="button" class="${cls}" data-page="${pg}" ${dis ? "disabled" : ""}>${lbl}</button>`;
  };

  let h = "";
  h += mk("«", 1, currentPage === 1, false);
  h += mk("‹", Math.max(1, currentPage - 1), currentPage === 1, false);
  const ps = Math.max(1, currentPage - 2);
  const pe = Math.min(totalPages, ps + 4);
  for (let p = ps; p <= pe; p++) {
    h += mk(String(p), p, false, p === currentPage);
  }
  h += mk("›", Math.min(totalPages, currentPage + 1), currentPage === totalPages, false);
  h += mk("»", totalPages, currentPage === totalPages, false);

  els.pgnControls.innerHTML = h;
}

/**
 * Open detail survey modal with respondent answers.
 */
export function openDetailModal(survey, userPhoto, categories) {
  const els = getElements();
  if (!els.detailModal || !els.detailModalBody) return;

  const ri = respondentInfo(survey);
  const ov = overallScore(survey, categories);
  const recommend = (survey.overall_assessment || {}).recommend || "";

  const categorySections = categories
    .map((c) => {
      const ratings = (survey[c.id] || {}).ratings || survey[c.id] || {};
      const essays = (survey[c.id] || {}).essays || {};

      const rows = c.ratings
        .map((q) => {
          const score = ratings[q.id];
          const has = typeof score === "number" && !isNaN(score);
          return `
            <div class="q-row">
              <div class="q-label">${esc(q.label)}</div>
              <div class="d-flex align-items-center gap-2">
                ${starsHTML(has ? score : 0)}
                <span class="q-score">${has ? score + "/5" : "—"}</span>
              </div>
            </div>`;
        })
        .join("");

      const essayBlocks = c.essays
        .map((q) => {
          const ans = essays[q.id] || "";
          return `
            <div class="essay-block-detail">
              <div class="essay-question">${esc(q.label)}</div>
              <div class="essay-answer">${esc(ans) || '<span class="text-slate-300">— Tidak ada jawaban —</span>'}</div>
            </div>`;
        })
        .join("");

      const recRow =
        c.id === "overall_assessment"
          ? `
            <div class="q-row" style="border-top:1px dashed #e2e8f0;margin-top:4px;">
              <div class="q-label">Bersedia merekomendasikan sebagai tempat internship</div>
              <span class="rec-badge ${recommend === "Ya" ? "rec-ya" : "rec-tidak"}">
                <i class="bi ${recommend === "Ya" ? "bi-hand-thumbs-up-fill" : "bi-hand-thumbs-down-fill"}"></i>${esc(recommend || "—")}
              </span>
            </div>`
          : "";

      return `
        <div class="detail-section">
          <div class="detail-section-title">
            <i class="bi ${c.icon}"></i>${esc(c.title)}
            <span class="badge rounded-pill ms-auto" style="background:#eef2ff;color:#4f46e5;">${catAvg(survey, c).toFixed(1)}/5</span>
          </div>
          ${rows}
          ${essayBlocks}
          ${recRow}
        </div>`;
    })
    .join("");

    const photo = userPhoto || survey.photo || ri.photo || "";

  els.detailModalBody.innerHTML = `
    <div class="row g-3 mb-3">
      <div class="col-md-7">
        <div class="d-flex align-items-center gap-3">
          ${avatarHTML(photo, ri.nama, "modal-avatar")}
          <div>
            <div class="fs-5 fw-bold text-slate-900">${esc(ri.nama || "-")}</div>
            <div class="small text-slate-500">${esc(survey.email || "-")}</div>
          </div>
        </div>
      </div>
      <div class="col-md-5">
        <div class="info-grid">
          <div class="info-label">Divisi</div>
          <div class="info-value mb-2">${esc(ri.divisi || "-")}</div>
          <div class="info-label">Alasan Mengakhiri</div>
          <div class="info-value">${esc(ri.alasan_mengakhiri || "-")}</div>
        </div>
      </div>
    </div>
    <div class="row g-3 mb-3">
      <div class="col-md-6">
        <div class="info-grid">
          <div class="info-label">Tanggal Pengisian</div>
          <div class="info-value">${fmtDate(survey.created_at)}</div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="info-grid">
          <div class="info-label">Responden ID</div>
          <div class="info-value text-slate-400">${esc(survey.id)}</div>
        </div>
      </div>
    </div>

    <div class="detail-section text-center">
      <div class="detail-section-title justify-content-center"><i class="bi bi-stars"></i>Overall Rating</div>
      ${starsHTML(ov, "stars-lg")}
      <div class="fs-3 fw-extrabold text-slate-900 mt-1">${ov.toFixed(1)} <small class="text-slate-400 fw-semibold" style="font-size:14px;">/ 5</small></div>
      <div class="small text-slate-400">rata-rata keseluruhan ${categories.reduce((n, c) => n + c.ratings.length, 0)} pertanyaan Likert</div>
    </div>

    ${categorySections}
  `;

  if (window.bootstrap && window.bootstrap.Modal) {
    const modal = window.bootstrap.Modal.getOrCreateInstance(els.detailModal);
    modal.show();
  }
}
