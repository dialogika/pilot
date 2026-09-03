// pages/hr/people-development/people-development.js
// =====================================================================
// PEOPLE DEVELOPMENT ORCHESTRATOR — coordinates auth, shared shell,
// repository (data access), and UI (rendering).
//
// Rules:
//  - No Firestore queries here (use people-development.repository.js).
//  - No raw DOM rendering of data here (use people-development.ui.js).
//  - This file decides WHEN things happen and wires repo -> ui.
// =====================================================================

import { requireAuth } from "/assets/js/auth-guard.js";
import { renderTopbar } from "/assets/js/components/topbar/topbar.js";
import { renderSidebar } from "/assets/js/components/sidebar/sidebar.js";
import * as repo from "/pages/hr/people-development/people-development.repository.js";
import * as ui from "/pages/hr/people-development/people-development.ui.js";

let currentUser = null;
let currentRole = null;
let leaderboardData = { weekly: [], monthly: [] };
let activeLeaderboardTab = "weekly";

/**
 * Main initialization lifecycle for People Development dashboard.
 */
async function initializePeopleDevelopment() {
  try {
    // 1. Enforce authentication and resolve active user/role
    const authResult = await requireAuth();
    currentUser = authResult.user;
    currentRole = authResult.role;

    // 2. Mount shared shell components
    renderTopbar({ user: currentUser, role: currentRole });
    renderSidebar({ role: currentRole, activePage: "people-development" });

    // 3. Dynamic header greeting
    const userName = currentUser?.displayName || currentUser?.name || "";
    ui.renderHeaderGreeting(userName);

    // 4. Load dashboard datasets in parallel
    await loadDashboardData();

    // 5. Setup event listeners
    setupTabSwitching();
    setupSurveyHandler();
  } catch (error) {
    console.error("[People Development] Initialization error:", error);
  }
}

/**
 * Fetch and render all data for the dashboard.
 */
async function loadDashboardData() {
  try {
    const [attendanceStats, satisfactionData, logsData, leaderboard] = await Promise.all([
      repo.getTodayAttendanceStats(),
      repo.getSatisfactionMetrics(),
      repo.getDailyAttendanceLogs(15),
      repo.getLeaderboardData(),
    ]);

    const trainingData = repo.getTrainingMetrics();
    const kpiData = repo.getKpiMetrics();

    // Update stat cards
    ui.renderStats({
      presentPct: attendanceStats.presentPct,
      absentPct: attendanceStats.absentPct,
      satisfactionScore: satisfactionData.score,
      trainingProgress: trainingData.overallPercent,
    });

    // Update KPI & Training sections
    ui.renderKpiSection(kpiData);
    ui.renderTrainingSection(trainingData);

    // Update Attendance Logs
    ui.renderAttendanceTable(logsData);

    // Cache and render Leaderboard
    leaderboardData = leaderboard || { weekly: [], monthly: [] };
    ui.renderLeaderboard(leaderboardData[activeLeaderboardTab] || []);
  } catch (err) {
    console.error("[People Development] Error loading dashboard data:", err);
  }
}

/**
 * Setup weekly / monthly leaderboard tab switching.
 */
function setupTabSwitching() {
  const btnWeekly = document.getElementById("btn-weekly");
  const btnMonthly = document.getElementById("btn-monthly");

  if (!btnWeekly || !btnMonthly) return;

  btnWeekly.addEventListener("click", () => {
    activeLeaderboardTab = "weekly";
    btnWeekly.classList.add("active");
    btnMonthly.classList.remove("active");
    ui.renderLeaderboard(leaderboardData.weekly || []);
  });

  btnMonthly.addEventListener("click", () => {
    activeLeaderboardTab = "monthly";
    btnMonthly.classList.add("active");
    btnWeekly.classList.remove("active");
    ui.renderLeaderboard(leaderboardData.monthly || []);
  });
}

/**
 * Wire satisfaction survey submit handler.
 */
function setupSurveyHandler() {
  ui.setupSurveyUI(async ({ rating, feedback }) => {
    await repo.submitSatisfactionSurvey({
      rating,
      feedback,
      user: currentUser,
    });

    // Refresh satisfaction metric
    const updatedMetrics = await repo.getSatisfactionMetrics();
    const attendanceStats = await repo.getTodayAttendanceStats();
    const trainingData = repo.getTrainingMetrics();

    ui.renderStats({
      presentPct: attendanceStats.presentPct,
      absentPct: attendanceStats.absentPct,
      satisfactionScore: updatedMetrics.score,
      trainingProgress: trainingData.overallPercent,
    });
  });
}

// Auto-run upon DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializePeopleDevelopment);
} else {
  initializePeopleDevelopment();
}
