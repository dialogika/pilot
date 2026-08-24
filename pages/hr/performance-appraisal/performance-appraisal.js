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
  positionMap = await repo.loadPositionsMap();
}

/* ------------------------------------------------------------------ */
/* List Page                                                          */
/* ------------------------------------------------------------------ */

async function initializeList() {
  const searchInput = document.getElementById("internSearchInput");

  if (searchInput) {
    searchInput.addEventListener("input", () => applyFilters());
  }

  await loadInterns();
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