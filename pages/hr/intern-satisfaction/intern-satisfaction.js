// pages/hr/intern-satisfaction/intern-satisfaction.js
// =====================================================================
// INTERN SATISFACTION ORCHESTRATOR
// Coordinates auth, app shell, repository, and UI state.
// =====================================================================

// Clean URL: ensure URL in address bar is strictly /intern-satisfaction (no trailing slash, no .html)
if (window.location.pathname !== "/intern-satisfaction") {
  window.history.replaceState(null, "", "/intern-satisfaction" + window.location.search);
}

import { requireAuth } from "/assets/js/auth-guard.js";
import { renderTopbar } from "/assets/js/components/topbar/topbar.js";
import { renderSidebar } from "/assets/js/components/sidebar/sidebar.js";

import {
  getSurveys,
  getUserPhotos,
  SURVEY_CATEGORIES,
} from "/pages/hr/intern-satisfaction/intern-satisfaction.repository.js";

import {
  getElements,
  renderLoading,
  renderError,
  renderSummary,
  renderCategoryCards,
  renderDeptFilter,
  renderGrid,
  openDetailModal,
  overallScore,
  toDate,
  respondentInfo,
} from "/pages/hr/intern-satisfaction/intern-satisfaction.ui.js";

const PAGE_SIZE = 12;

let allSurveys = [];
let filteredSurveys = [];
let userPhotoCache = new Map();
let currentPage = 1;
let searchTerm = "";
let deptFilter = "";
let sortMode = "newest";
let searchTimer = null;

/**
 * Filter and sort surveys according to active controls.
 */
function applyFilters() {
  const q = searchTerm.toLowerCase().trim();

  let list = allSurveys.filter((s) => {
    const ri = respondentInfo(s);
    if (deptFilter && (ri.divisi || "") !== deptFilter) return false;
    if (q) {
      const hay = [ri.nama, s.email, ri.divisi, ri.alasan_mengakhiri]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  list.sort((a, b) => {
    const timeA = toDate(a.created_at)?.getTime() || 0;
    const timeB = toDate(b.created_at)?.getTime() || 0;

    if (sortMode === "oldest") return timeA - timeB;
    if (sortMode === "highest") {
      return overallScore(b, SURVEY_CATEGORIES) - overallScore(a, SURVEY_CATEGORIES);
    }
    if (sortMode === "lowest") {
      return overallScore(a, SURVEY_CATEGORIES) - overallScore(b, SURVEY_CATEGORIES);
    }
    return timeB - timeA; // newest default
  });

  filteredSurveys = list;
  currentPage = 1;
  renderGrid(filteredSurveys, userPhotoCache, SURVEY_CATEGORIES, currentPage, PAGE_SIZE);
}

/**
 * Setup event listeners on UI controls.
 */
function setupEventListeners() {
  const els = getElements();

  if (els.searchInput) {
    els.searchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        searchTerm = els.searchInput.value;
        applyFilters();
      }, 150);
    });
  }

  if (els.deptFilter) {
    els.deptFilter.addEventListener("change", () => {
      deptFilter = els.deptFilter.value;
      applyFilters();
    });
  }

  if (els.sortSelect) {
    els.sortSelect.addEventListener("change", () => {
      sortMode = els.sortSelect.value;
      applyFilters();
    });
  }

  if (els.respondentGrid) {
    els.respondentGrid.addEventListener("click", (e) => {
      const card = e.target.closest(".resp-card");
      if (!card) return;
      const surveyId = card.dataset.id;
      const survey = allSurveys.find((x) => x.id === surveyId);
      if (survey) {
        const photo = userPhotoCache.get(survey.user_id || "") || survey.photo || (survey.respondent_info && survey.respondent_info.photo) || "";
        openDetailModal(survey, photo, SURVEY_CATEGORIES);
      }
    });
  }

  if (els.pgnControls) {
    els.pgnControls.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-page]");
      if (!btn || btn.disabled) return;
      currentPage = parseInt(btn.dataset.page, 10) || 1;
      renderGrid(filteredSurveys, userPhotoCache, SURVEY_CATEGORIES, currentPage, PAGE_SIZE);
    });
  }
}

/**
 * Initialize page flow.
 */
async function initialize() {
  renderLoading();

  // 1. Authenticate user and render shell
  let authResult;
  try {
    authResult = await requireAuth();
  } catch (err) {
    console.error("Authentication check failed:", err);
    return;
  }

  const { user, role } = authResult;
  renderTopbar({ user, role });
  renderSidebar({ role, activePage: "people-development" });

  // 2. Load survey data from repository
  try {
    allSurveys = await getSurveys();

    // Fetch user photos in parallel (failsafe)
    try {
      const userIds = allSurveys.map((s) => s.user_id).filter(Boolean);
      userPhotoCache = await getUserPhotos(userIds);
    } catch (photoErr) {
      console.warn("Could not load user photos:", photoErr);
    }

    const els = getElements();
    renderSummary(allSurveys, SURVEY_CATEGORIES);
    renderCategoryCards(allSurveys, SURVEY_CATEGORIES);
    renderDeptFilter(allSurveys, deptFilter);
    applyFilters();

    if (els.loadingState) els.loadingState.style.display = "none";
    if (els.dashboardContent) els.dashboardContent.style.display = "block";
    if (els.dataInfoText) {
      els.dataInfoText.textContent = `Total ${allSurveys.length} survey`;
    }

    setupEventListeners();
  } catch (error) {
    console.error("Gagal memuat data survey:", error);
    renderError(`Gagal memuat data survey: ${error?.code ? `[${error.code}] ` : ""}${error?.message || error}`);
  }
}

// Start orchestration
initialize();
