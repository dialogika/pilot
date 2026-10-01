// pages/hr/performance-appraisal/performance-appraisal.js
// =====================================================================
// PERFORMANCE APPRAISAL ORCHESTRATOR — coordinates auth, shell, repository and UI.
// =====================================================================

import { requireAuth } from "../../../assets/js/auth-guard.js";
import { renderTopbar } from "../../../assets/js/components/topbar/topbar.js";
import { renderSidebar } from "../../../assets/js/components/sidebar/sidebar.js";
import { auth } from "../../../assets/js/firebase-config.js";
import * as repo from "./performance-appraisal.repository.js";
import * as ui from "./performance-appraisal.ui.js";

let positionMap = {};

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

async function initialize() {
  try {
    const { user, role } = await requireAuth();

    renderTopbar({ user, role });
    renderSidebar({ role, activePage: "performance-appraisal" });

    await loadPositionsMap();

    // Detect which page we're on
    const path = window.location.pathname;
    if (path.includes("/form")) {
      await initializeForm();
    } else {
      await initializeList();
    }

    console.log("Performance Appraisal initialized");
  } catch (error) {
    console.error("Failed to initialize Performance Appraisal:", error);
  }
}

async function loadPositionsMap() {
  // Legacy parity: failure to load positions must NOT block the intern list.
  try {
    positionMap = await repo.loadPositionsMap();
  } catch (e) {
    console.warn("Failed to load positions, continuing without map:", e);
    positionMap = {};
  }
}

/* ------------------------------------------------------------------ */
/* List Page                                                          */
/* ------------------------------------------------------------------ */

async function initializeList() {
  const searchInput = document.getElementById("internSearchInput");

  if (searchInput) {
    searchInput.addEventListener("input", () => applyFilters());
  }

  setupExport();
  await loadInterns();
}

function setupExport() {
  const controls = ui.initPerformanceExportModal();
  if (!controls) return;

  const form = document.getElementById("exportPerformanceForm");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      controls.setLoading(true);
      try {
        const params = controls.getFormData();
        const { calcDateRange, extractTimestamp } = await import(
          "../../../assets/js/utils/export-helper.js"
        );
        const { startTimestamp, endTimestamp, periodLabel } = calcDateRange(
          params.rangeType,
          params.month,
          params.weekMonth,
          params.week
        );

        let exportList = allInterns.slice();

        // Filter status
        if (params.status === "appraised") {
          exportList = exportList.filter(
            (i) => i.raw?.appraisal || i.raw?.appraisal_completed || i.raw?.score
          );
        } else if (params.status === "pending") {
          exportList = exportList.filter(
            (i) => !i.raw?.appraisal && !i.raw?.appraisal_completed && !i.raw?.score
          );
        }

        // Filter date range if not 'all'
        if (params.rangeType !== "all") {
          exportList = exportList.filter((i) => {
            const ts =
              extractTimestamp(i.raw?.appraisal_date) ||
              extractTimestamp(i.raw?.created_at) ||
              extractTimestamp(i.raw?.updated_at) ||
              extractTimestamp(i.raw?.start_date);
            if (ts === null) return true;
            return ts >= startTimestamp && ts <= endTimestamp;
          });
        }

        if (!exportList.length) {
          ui.notifyError("Tidak ada data penilaian intern pada periode/filter yang dipilih.");
          return;
        }

        await repo.exportPerformanceData({
          interns: exportList,
          format: params.format,
          periodLabel,
          positionMap,
        });

        controls.closeModal();
        ui.notifySuccess("Data performance appraisal berhasil diexport!");
      } catch (err) {
        console.error("Export error:", err);
        ui.notifyError("Gagal melakukan export data: " + err.message);
      } finally {
        controls.setLoading(false);
      }
    });
  }
}

async function loadInterns() {
  ui.showListLoading("loadingState", "emptyState", "cardContainer", "summaryText");

  try {
    const interns = await repo.listInterns();
    allInterns = interns;
    applyFilters();
  } catch (e) {
    console.error("Gagal memuat interns_resume:", e);
    ui.showListError("summaryText", "Gagal memuat data intern. Silahkan periksa koneksi atau izin.");
  }
}

let allInterns = [];

function applyFilters() {
  let list = allInterns.slice();
  const searchInput = document.getElementById("internSearchInput");
  const term = String(searchInput?.value || "").toLowerCase().trim();

  if (term) {
    list = list.filter((intern) => {
      const name = String(intern.name || "").toLowerCase();
      const division = String(intern.division || "").toLowerCase();
      let position = String(intern.position || "").toLowerCase();
      if (positionMap[intern.position]) {
        position = positionMap[intern.position].toLowerCase();
      }
      return name.includes(term) || division.includes(term) || position.includes(term);
    });
  }

  ui.renderInternList(
    list,
    positionMap,
    "cardContainer",
    "summaryText",
    "emptyState",
    "loadingState"
  );
}

/* ------------------------------------------------------------------ */
/* Form Page                                                          */
/* ------------------------------------------------------------------ */

async function initializeForm() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");

  if (!id) {
    ui.showFormError("ID Intern tidak ditemukan di URL.");
    return;
  }

  try {
    const intern = await repo.getIntern(id);

    if (!intern) {
      ui.showFormError("Data intern tidak ditemukan.");
      return;
    }

    ui.renderFormHeader(intern, positionMap);
    const category = ui.renderDivisionSpecificFields(intern, positionMap);

    // Attach NTI handlers BEFORE filling (fill clicks btnAddNti to add rows).
    ui.setupNtiHandlers();

    if (intern.appraisal) {
      ui.fillFormFromAppraisal(intern.appraisal, category);
    }

    // Show form
    document.getElementById("loadingState").style.display = "none";
    document.getElementById("formContainer").style.display = "block";

    // Ensure at least one NTI row
    const ntiContainer = document.getElementById("ntiContainer");
    if (ntiContainer && ntiContainer.children.length === 0) {
      document.getElementById("btnAddNti")?.click();
    }

    // Wire form submit
    const form = document.getElementById("appraisalForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        await handleSubmit(id, category);
      });
    }
  } catch (e) {
    console.error(e);
    ui.showFormError("Gagal mengambil data dari server.");
  }
}

async function handleSubmit(id, category) {
  ui.setSubmitBusy(true);

  try {
    const appraisalData = ui.collectFormData(category);
    appraisalData.evaluatedBy = auth.currentUser?.uid;

    await repo.saveAppraisal(id, appraisalData);

    ui.notifySuccess("Penilaian berhasil disimpan!");
    window.location.href = "/performance-appraisal";
  } catch (err) {
    console.error(err);
    ui.notifyError("Gagal menyimpan penilaian: " + err.message);
    ui.setSubmitBusy(false);
  }
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}