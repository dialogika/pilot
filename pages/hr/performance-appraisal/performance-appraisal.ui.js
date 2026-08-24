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
    window.location.href = `/hr/performance-appraisal/form?id=${intern.id}`;
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
    fields: [
      { id: "dev", label: "DEV", full: "Developing Others" },
      { id: "rb", label: "RB", full: "Relationship Building" },
      { id: "iu", label: "IU", full: "Interpersonal Und." },
    ],
  },
  branding: {
    label: "Branding",
    fields: [
      { id: "imp", label: "IMP", full: "Impact and Influence" },
      { id: "info", label: "INFO", full: "Information Seeking" },
    ],
  },
  marketing: {
    label: "Marketing",
    fields: [
      { id: "cso", label: "CSO", full: "Customer Service" },
      { id: "co", label: "CO", full: "Concern for Order" },
      { id: "flx", label: "FLX", full: "Flexibility" },
    ],
  },
  client_product: {
    label: "Client & Product",
    fields: [
      { id: "flx", label: "FLX", full: "Flexibility" },
      { id: "dir", label: "DIR", full: "Directiveness" },
      { id: "cso", label: "CSO", full: "Customer Service" },
      { id: "rb", label: "RB", full: "Relationship Building" },
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
      const input = el(`comp_${f.id}${category === "hr" && f.id === "rb" ? "_hr" : category === "marketing" && f.id === "cso" ? "_mkt" : category === "client_product" && f.id === "cso" ? "_cp" : category === "client_product" && f.id === "rb" ? "_cp" : category === "marketing" && f.id === "flx" ? "_mkt" : category === "client_product" && f.id === "flx" ? "_cp" : ""}`);
      if (input && appraisal.specific[f.id] !== undefined) input.value = appraisal.specific[f.id];
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
      const suffix =
        category === "hr" && f.id === "rb"
          ? "_hr"
          : category === "marketing" && f.id === "cso"
          ? "_mkt"
          : category === "client_product" && f.id === "cso"
          ? "_cp"
          : category === "client_product" && f.id === "rb"
          ? "_cp"
          : category === "marketing" && f.id === "flx"
          ? "_mkt"
          : category === "client_product" && f.id === "flx"
          ? "_cp"
          : "";
      const input = el(`comp_${f.id}${suffix}`);
      specific[f.id] = parseFloat(input?.value) || 0;
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