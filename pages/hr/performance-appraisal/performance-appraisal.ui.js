// pages/hr/performance-appraisal/performance-appraisal.ui.js
// =====================================================================
// PERFORMANCE APPRAISAL UI — rendering, DOM manipulation, event handling.
// =====================================================================

import { escapeHtml } from "../../../assets/js/utils.js";
import { toast, showModal, hideModal, confirmDialog, setButtonBusy } from "../../../assets/js/ui.js";

function el(id) {
  return document.getElementById(id);
}

/* ------------------------------------------------------------------ */
/* List Page Rendering                                                */
/* ------------------------------------------------------------------ */

export function renderInternCard(intern, positionMap) {
  const name = intern.name || "Unknown";
  const photo = intern.photo || `https://i.pravatar.cc/150?u=${intern.id}`;
  const division = intern.division || "No Division";
  let position = intern.position || "No Position";

  if (positionMap[position]) {
    position = positionMap[position];
  }

  const card = document.createElement("div");
  card.className = "appraisal-card p-6 flex flex-col items-center text-center";
  card.innerHTML = `
    <div class="relative mb-4">
      <img src="${escapeHtml(photo)}" alt="${escapeHtml(name)}" class="w-24 h-24 rounded-full object-cover border-4 border-indigo-50 shadow-sm" onerror="this.src='https://i.pravatar.cc/150?u=${intern.id}'">
    </div>
    <h3 class="font-bold text-lg text-slate-900 mb-1 line-clamp-1">${escapeHtml(name)}</h3>
    <span class="inline-flex px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2">${escapeHtml(division)}</span>
    <p class="text-sm text-slate-500 font-medium">${escapeHtml(position)}</p>
  `;

  card.onclick = () => {
    window.location.href = `/performance-appraisal/form?id=${intern.id}`;
  };

  return card;
}

export function renderInternList(interns, positionMap, containerId, summaryId, emptyId, loadingId) {
  const container = el(containerId);
  const summary = el(summaryId);
  const empty = el(emptyId);
  const loading = el(loadingId);

  if (loading) loading.style.display = "none";

  if (!interns || interns.length === 0) {
    if (container) container.style.display = "none";
    if (empty) empty.style.display = "block";
    if (summary) summary.textContent = "Tidak ada data intern.";
    return;
  }

  container.innerHTML = "";
  interns.forEach((intern) => {
    const card = renderInternCard(intern, positionMap);
    container.appendChild(card);
  });

  if (container) container.style.display = "grid";
  if (empty) empty.style.display = "none";
  if (summary) summary.innerHTML = `<i class="bi bi-person-check me-1"></i> Menampilkan ${interns.length} intern`;
}

export function showListLoading(loadingId, emptyId, containerId, summaryId) {
  const loading = el(loadingId);
  const empty = el(emptyId);
  const container = el(containerId);
  const summary = el(summaryId);

  if (loading) loading.style.display = "block";
  if (empty) empty.style.display = "none";
  if (container) container.style.display = "none";
  if (summary) summary.textContent = "Sedang memuat data interns...";
}

export function showListError(summaryId, message) {
  const summary = el(summaryId);
  const loading = el("loadingState");
  const empty = el("emptyState");
  if (loading) loading.style.display = "none";
  if (empty) empty.style.display = "block";
  if (summary) summary.textContent = message || "Gagal memuat data intern. Silahkan periksa koneksi atau izin.";
}

/**
 * Form-page error state (errorState + errorMsg elements).
 * @param {string} message
 */
export function showFormError(message) {
  const loading = el("loadingState");
  const errorState = el("errorState");
  const errorMsg = el("errorMsg");
  if (loading) loading.style.display = "none";
  if (errorState) errorState.style.display = "block";
  if (errorMsg && message) errorMsg.textContent = message;
}

/* ------------------------------------------------------------------ */
/* Form Page Rendering                                                */
/* ------------------------------------------------------------------ */

const CORE_COMPETENCIES = [
  { id: "ach", label: "ACH", full: "Achievement Orientation" },
  { id: "int", label: "INT", full: "Initiative" },
  { id: "tw", label: "TW", full: "Teamwork" },
  { id: "ct", label: "CT", full: "Conceptual Thinking" },
  { id: "oc", label: "OC", full: "Organizational Commit" },
  { id: "tl", label: "TL", full: "Team Leadership" },
  { id: "at", label: "AT", full: "Analytical Thinking" },
  { id: "sct", label: "SCT", full: "Self-Control" },
];

const DIVISION_SPECIFICS = {
  hr: {
    label: "HR",
    // appraisal key -> input element id (matches legacy markup exactly)
    fields: [
      { key: "dev", inputId: "comp_dev", label: "DEV", full: "Developing Others" },
      { key: "rb", inputId: "comp_rb_hr", label: "RB", full: "Relationship Building" },
      { key: "iu", inputId: "comp_iu", label: "IU", full: "Interpersonal Und." },
    ],
  },
  branding: {
    label: "Branding",
    fields: [
      { key: "imp", inputId: "comp_imp", label: "IMP", full: "Impact and Influence" },
      { key: "info", inputId: "comp_info", label: "INFO", full: "Information Seeking" },
    ],
  },
  marketing: {
    label: "Marketing",
    fields: [
      { key: "cso", inputId: "comp_cso_mkt", label: "CSO", full: "Customer Service" },
      { key: "co", inputId: "comp_co", label: "CO", full: "Concern for Order" },
      { key: "flx", inputId: "comp_flx_mkt", label: "FLX", full: "Flexibility" },
    ],
  },
  client_product: {
    label: "Client & Product",
    fields: [
      { key: "flx", inputId: "comp_flx_cp", label: "FLX", full: "Flexibility" },
      { key: "dir", inputId: "comp_dir", label: "DIR", full: "Directiveness" },
      { key: "cso", inputId: "comp_cso_cp", label: "CSO", full: "Customer Service" },
      { key: "rb", inputId: "comp_rb_cp", label: "RB", full: "Relationship Building" },
    ],
  },
};

function determineDivisionCategory(divisionStr) {
  const str = String(divisionStr || "").toLowerCase();
  if (str.includes("hr") || str.includes("human resource")) return "hr";
  if (str.includes("brand")) return "branding";
  if (str.includes("market")) return "marketing";
  if (str.includes("client") || str.includes("product")) return "client_product";
  return null;
}

export function renderFormHeader(intern, positionMap) {
  const nameEl = el("internName");
  const divisionEl = el("internDivision");
  const positionEl = el("internPosition");
  const photoEl = el("internPhoto");

  if (nameEl) nameEl.textContent = intern.name || "Unknown";
  if (divisionEl) divisionEl.textContent = intern.division || "No Division";

  let position = intern.position || "No Position";
  if (positionMap[position]) position = positionMap[position];
  if (positionEl) positionEl.textContent = position;

  if (photoEl) photoEl.src = intern.photo || `https://i.pravatar.cc/150?u=${intern.id}`;
}

export function renderDivisionSpecificFields(intern, positionMap) {
  const sectionKhusus = el("sectionKhusus");
  const divLabel = el("divisionLabel");
  const category = determineDivisionCategory(intern.division);

  const divs = {
    hr: el("khusus_hr"),
    branding: el("khusus_branding"),
    marketing: el("khusus_marketing"),
    client_product: el("khusus_client_product"),
  };

  Object.values(divs).forEach((d) => {
    if (d) d.style.display = "none";
  });

  if (!category) {
    if (sectionKhusus) sectionKhusus.style.display = "none";
    return null;
  }

  if (sectionKhusus) sectionKhusus.style.display = "block";
  if (divLabel) divLabel.textContent = `(${intern.division})`;

  const activeDiv = divs[category];
  if (activeDiv) {
    activeDiv.style.display = "grid";
    activeDiv.querySelectorAll("input").forEach((el) => (el.required = true));
  }

  return category;
}

export function fillFormFromAppraisal(appraisal, category) {
  if (appraisal.core) {
    CORE_COMPETENCIES.forEach((c) => {
      const input = el(`comp_${c.id}`);
      if (input && appraisal.core[c.id] !== undefined) input.value = appraisal.core[c.id];
    });
  }

  if (appraisal.specific && category && DIVISION_SPECIFICS[category]) {
    DIVISION_SPECIFICS[category].fields.forEach((f) => {
      const input = el(f.inputId);
      if (input && appraisal.specific[f.key] !== undefined) input.value = appraisal.specific[f.key];
    });
  }

  if (el("talentNotes")) el("talentNotes").value = appraisal.talentNotes || "";
  if (el("talentAchievement")) el("talentAchievement").value = appraisal.talentAchievement || "";
  if (el("referenceEmail")) el("referenceEmail").value = appraisal.referenceEmail || "";

  const ntiContainer = el("ntiContainer");
  const ntiEmpty = el("ntiEmpty");
  const btnAddNti = el("btnAddNti");

  if (appraisal.needToImprove && Array.isArray(appraisal.needToImprove) && ntiContainer) {
    appraisal.needToImprove.forEach((nti) => {
      if (btnAddNti) btnAddNti.click();
      const rows = ntiContainer.querySelectorAll(".nti-row");
      const lastRow = rows[rows.length - 1];
      if (lastRow) {
        lastRow.querySelector(".nti-header-input").value = nti.header || "";
        lastRow.querySelector(".nti-content-input").value = nti.content || "";
      }
    });
  }
}

export function collectFormData(category) {
  const core = {};
  CORE_COMPETENCIES.forEach((c) => {
    const input = el(`comp_${c.id}`);
    core[c.id] = parseFloat(input?.value) || 0;
  });

  const specific = {};
  if (category && DIVISION_SPECIFICS[category]) {
    DIVISION_SPECIFICS[category].fields.forEach((f) => {
      const input = el(f.inputId);
      specific[f.key] = parseFloat(input?.value) || 0;
    });
  }

  const needToImprove = [];
  const ntiContainer = el("ntiContainer");
  if (ntiContainer) {
    ntiContainer.querySelectorAll(".nti-row").forEach((row) => {
      const header = row.querySelector(".nti-header-input")?.value.trim();
      const content = row.querySelector(".nti-content-input")?.value.trim();
      if (header || content) needToImprove.push({ header, content });
    });
  }

  return {
    core,
    specific,
    needToImprove,
    talentNotes: el("talentNotes")?.value.trim() || "",
    talentAchievement: el("talentAchievement")?.value.trim() || "",
    referenceEmail: el("referenceEmail")?.value.trim() || "",
    evaluatedAt: new Date(),
  };
}

export function setupNtiHandlers() {
  const btnAddNti = el("btnAddNti");
  const ntiContainer = el("ntiContainer");
  const ntiEmpty = el("ntiEmpty");
  const ntiTemplate = el("ntiTemplate");

  function checkNtiEmpty() {
    if (ntiContainer && ntiEmpty) {
      ntiEmpty.style.display = ntiContainer.children.length === 0 ? "block" : "none";
    }
  }

  if (btnAddNti && ntiContainer && ntiTemplate) {
    btnAddNti.addEventListener("click", () => {
      const clone = ntiTemplate.content.cloneNode(true);
      const row = clone.querySelector(".nti-row");
      const btnRemove = clone.querySelector(".btn-remove-nti");

      btnRemove.addEventListener("click", () => {
        row.remove();
        checkNtiEmpty();
      });

      ntiContainer.appendChild(clone);
      checkNtiEmpty();

      const inputs = row.querySelectorAll("input");
      if (inputs.length > 0) inputs[0].focus();
    });
  }

  checkNtiEmpty();
}

export function setSubmitBusy(busy, label = "Menyimpan...") {
  const btn = el("btnSubmit");
  if (btn) setButtonBusy(btn, busy, label);
}

export function notifySuccess(message) {
  toast(message, "success");
}

export function notifyError(message) {
  toast(message, "error");
}

/**
 * Initialize Performance Appraisal Export Modal controls.
 */
export function initPerformanceExportModal() {
  const modalEl = el("exportPerformanceModal");
  if (!modalEl) return null;

  const currentYearMonth = new Date().toISOString().substring(0, 7);
  const monthInput = modalEl.querySelector(".export-month-input");
  const weekMonthInput = modalEl.querySelector(".export-week-month-input");

  if (monthInput && !monthInput.value) monthInput.value = currentYearMonth;
  if (weekMonthInput && !weekMonthInput.value) weekMonthInput.value = currentYearMonth;

  let currentFormat = "xlsx";
  let currentRange = "all";

  const btnXlsx = modalEl.querySelector('[data-format="xlsx"]');
  const btnCsv = modalEl.querySelector('[data-format="csv"]');
  const downloadBtnText = modalEl.querySelector(".download-btn-text");
  const helpMonthText = modalEl.querySelector(".export-help-month");
  const helpWeekText = modalEl.querySelector(".export-help-week");

  const setFormat = (fmt) => {
    currentFormat = fmt === "csv" ? "csv" : "xlsx";
    if (btnXlsx) btnXlsx.classList.toggle("active", currentFormat === "xlsx");
    if (btnCsv) btnCsv.classList.toggle("active", currentFormat === "csv");
    if (downloadBtnText) {
      downloadBtnText.textContent =
        currentFormat === "xlsx" ? "Download Excel (.xlsx)" : "Download CSV (.csv)";
    }
    if (helpMonthText) {
      helpMonthText.textContent = `Semua pengajuan pada bulan yang dipilih akan dimasukkan ke dalam file ${currentFormat.toUpperCase()}.`;
    }
    if (helpWeekText) {
      helpWeekText.textContent = `Semua pengajuan pada minggu yang dipilih akan dimasukkan ke dalam file ${currentFormat.toUpperCase()}.`;
    }
  };

  const rangeBtnAll = modalEl.querySelector('[data-range="all"]');
  const rangeBtnMonth = modalEl.querySelector('[data-range="month"]');
  const rangeBtnWeek = modalEl.querySelector('[data-range="week"]');
  const sectionAll = modalEl.querySelector(".section-all-picker");
  const sectionMonth = modalEl.querySelector(".section-month-picker");
  const sectionWeek = modalEl.querySelector(".section-week-picker");

  const setRange = (rType) => {
    currentRange = ["all", "month", "week"].includes(rType) ? rType : "all";
    if (rangeBtnAll) rangeBtnAll.classList.toggle("active", currentRange === "all");
    if (rangeBtnMonth) rangeBtnMonth.classList.toggle("active", currentRange === "month");
    if (rangeBtnWeek) rangeBtnWeek.classList.toggle("active", currentRange === "week");

    if (sectionAll) sectionAll.style.display = currentRange === "all" ? "block" : "none";
    if (sectionMonth) sectionMonth.style.display = currentRange === "month" ? "block" : "none";
    if (sectionWeek) sectionWeek.style.display = currentRange === "week" ? "block" : "none";
  };

  if (btnXlsx) btnXlsx.onclick = () => setFormat("xlsx");
  if (btnCsv) btnCsv.onclick = () => setFormat("csv");
  if (rangeBtnAll) rangeBtnAll.onclick = () => setRange("all");
  if (rangeBtnMonth) rangeBtnMonth.onclick = () => setRange("month");
  if (rangeBtnWeek) rangeBtnWeek.onclick = () => setRange("week");

  setFormat("xlsx");
  setRange("all");

  return {
    getFormData: () => {
      const weekSelect = modalEl.querySelector(".export-week-select");
      const statusFilter = modalEl.querySelector(".export-status-filter");
      return {
        format: currentFormat,
        rangeType: currentRange,
        month: monthInput?.value || currentYearMonth,
        weekMonth: weekMonthInput?.value || currentYearMonth,
        week: parseInt(weekSelect?.value || "1", 10),
        status: (statusFilter?.value || "").toLowerCase().trim(),
      };
    },
    setLoading: (loading) => {
      const submitBtn = modalEl.querySelector('button[type="submit"]');
      if (!submitBtn) return;
      if (loading) {
        submitBtn.disabled = true;
        submitBtn.dataset.origHtml = submitBtn.innerHTML;
        submitBtn.innerHTML =
          '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Memproses...';
      } else {
        submitBtn.disabled = false;
        if (submitBtn.dataset.origHtml) {
          submitBtn.innerHTML = submitBtn.dataset.origHtml;
        }
      }
    },
    closeModal: () => {
      if (window.bootstrap) {
        const bsModal = bootstrap.Modal.getInstance(modalEl);
        if (bsModal) bsModal.hide();
      }
    },
  };
}