// pages/product/product-management/product-management.ui.js
// =====================================================================
// PRODUCT MANAGEMENT UI
// Pure DOM rendering, modal controllers, dynamic builders & interactions.
// =====================================================================

import { PUBLIC_URL_MAP } from "./product-management.repository.js";

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatNumber(val) {
  return new Intl.NumberFormat("id-ID").format(Number(val) || 0);
}

function truncateText(text, maxLength = 80) {
  if (!text) return "";
  const str = String(text);
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + "…";
}

/**
 * Render the product list in the table.
 */
export function renderTable(products, { onEdit }) {
  const tbody = document.getElementById("productTableBody");
  if (!tbody) return;

  if (!products || products.length === 0) {
    renderEmpty("Data produk belum tersedia atau belum ada produk yang cocok dengan pencarian.");
    return;
  }

  tbody.innerHTML = products
    .map((product) => {
      const initial = (product.name || "P").charAt(0).toUpperCase();
      const isActive = product.status === "active";
      const statusDot = isActive
        ? `<span class="w-2 h-2 bg-emerald-500 rounded-full inline-block ml-1.5" title="Active"></span>`
        : `<span class="w-2 h-2 bg-slate-300 rounded-full inline-block ml-1.5" title="Archived"></span>`;

      // Curriculum rendering
      let curriculumHtml = "";
      if (Array.isArray(product.curriculum) && product.curriculum.length > 0) {
        const items = product.curriculum
          .map(
            (c, idx) => `
            <div class="flex items-start gap-2 py-0.5">
              <span class="mono text-[10px] font-bold text-slate-500 min-w-[1.5rem]">
                ${escapeHtml(c.order || String(idx + 1).padStart(2, "0"))}
              </span>
              <div class="text-[10px] leading-snug">
                <div class="font-semibold text-slate-700">${escapeHtml(truncateText(c.title, 40))}</div>
                ${c.description ? `<div class="text-slate-500">${escapeHtml(truncateText(c.description, 70))}</div>` : ""}
              </div>
            </div>
          `
          )
          .join("");

        curriculumHtml = `
          <div class="pt-2 mt-2 border-t border-slate-100">
            <div class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Curriculum (${product.curriculum.length})
            </div>
            <div class="curriculum-scroll-box space-y-1 pr-1 max-w-xs">
              ${items}
            </div>
          </div>
        `;
      }

      // Visual badge
      const badgeText = product.visual?.badge_text || "NEW";
      const badgeColor = product.visual?.badge_color || "#6366f1";

      return `
        <tr class="product-row border-b border-slate-100 group">
          <td class="px-6 py-5 align-top">
            <div class="flex items-start gap-3.5">
              <div class="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm uppercase group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors shrink-0">
                ${escapeHtml(initial)}
              </div>
              <div class="space-y-1 min-w-[200px]">
                <div class="flex items-center gap-1">
                  <span class="text-sm font-bold text-slate-900">${escapeHtml(product.name)}</span>
                  ${statusDot}
                </div>
                <div>
                  <span class="mono text-[10px] text-slate-500 font-bold uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    ${escapeHtml(product.product_id)}
                  </span>
                </div>
                ${curriculumHtml}
              </div>
            </div>
          </td>
          <td class="px-6 py-5 align-top">
            <span class="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-600 uppercase tracking-wider">
              ${escapeHtml(product.type || "Online")}
            </span>
          </td>
          <td class="px-6 py-5 align-top">
            <div class="text-sm font-bold text-slate-900">
              Rp ${formatNumber(product.base_price)}
            </div>
            <div class="text-[10px] text-slate-400 font-medium">
              Standard Retail Price
            </div>
          </td>
          <td class="px-6 py-5 align-top">
            <span class="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-600 italic">
              ${product.total_sessions || 0} SESSIONS
            </span>
          </td>
          <td class="px-6 py-5 align-top">
            <span
              style="background-color: ${escapeHtml(badgeColor)}18; color: ${escapeHtml(badgeColor)}; border-color: ${escapeHtml(badgeColor)}30;"
              class="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border inline-block"
            >
              ${escapeHtml(badgeText)}
            </span>
          </td>
          <td class="px-6 py-5 align-top text-right">
            <button
              type="button"
              class="btn-edit-product p-2.5 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-all"
              data-id="${escapeHtml(product.product_id)}"
              title="Edit Product"
            >
              <i class="bi bi-pencil-square text-base"></i>
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  // Attach edit event handlers
  tbody.querySelectorAll(".btn-edit-product").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pid = btn.getAttribute("data-id");
      const found = products.find((p) => p.product_id === pid);
      if (found && onEdit) {
        onEdit(found);
      }
    });
  });
}

/**
 * Render loading skeleton
 */
export function renderLoading() {
  const tbody = document.getElementById("productTableBody");
  if (!tbody) return;
  tbody.innerHTML = `
    <tr>
      <td colspan="6" class="px-8 py-16 text-center text-slate-400">
        <div class="inline-flex items-center gap-3 text-sm font-medium">
          <svg class="animate-spin h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          <span>Memuat data produk...</span>
        </div>
      </td>
    </tr>
  `;
}

/**
 * Render empty state
 */
export function renderEmpty(message = "Data produk tidak ditemukan.") {
  const tbody = document.getElementById("productTableBody");
  if (!tbody) return;
  tbody.innerHTML = `
    <tr>
      <td colspan="6" class="px-8 py-16 text-center text-slate-400 text-sm">
        <div class="flex flex-col items-center justify-center gap-2">
          <i class="bi bi-box-seam text-3xl text-slate-300"></i>
          <span>${escapeHtml(message)}</span>
        </div>
      </td>
    </tr>
  `;
}

/* =====================================================================
   FORM & MODAL MANAGEMENT
   ===================================================================== */

let currentFormMode = "create"; // 'create' | 'edit'
let editingProductId = null;

// Dynamic state arrays
let formCurriculum = [];
let formFeatures = [];
let formSpecifications = [];
let formOutcomes = [];

/**
 * Open Modal for Create or Edit
 */
export function openProductModal(product = null) {
  const modal = document.getElementById("productModalBackdrop");
  const title = document.getElementById("modalTitle");
  const deleteBtn = document.getElementById("modalDeleteBtn");
  const submitBtn = document.getElementById("modalSubmitBtn");

  if (!modal) return;

  if (product) {
    currentFormMode = "edit";
    editingProductId = product.product_id;
    if (title) title.textContent = "Modify Product";
    if (deleteBtn) deleteBtn.classList.remove("hidden");
    if (submitBtn) submitBtn.textContent = "Push Changes";

    populateForm(product);
  } else {
    currentFormMode = "create";
    editingProductId = null;
    if (title) title.textContent = "Establish New Product";
    if (deleteBtn) deleteBtn.classList.add("hidden");
    if (submitBtn) submitBtn.textContent = "Register Product";

    resetForm();
  }

  modal.classList.add("show");
  document.body.classList.add("overflow-hidden");
}

export function closeProductModal() {
  const modal = document.getElementById("productModalBackdrop");
  if (!modal) return;
  modal.classList.remove("show");
  document.body.classList.remove("overflow-hidden");
}

/**
 * Populate form inputs with product data
 */
function populateForm(product) {
  document.getElementById("formProductId").value = product.product_id || "";
  document.getElementById("formProductId").disabled = true;
  document.getElementById("formName").value = product.name || "";
  document.getElementById("formBasePrice").value = product.base_price ? formatNumber(product.base_price) : "";
  document.getElementById("formTotalSessions").value = product.total_sessions || 0;

  // Rich editor description
  const editor = document.getElementById("formDescriptionEditor");
  if (editor) {
    editor.innerHTML = product.description || "";
  }

  // Status
  setStatus(product.status || "active");

  // Visual
  document.getElementById("formBadgeText").value = product.visual?.badge_text || "NEW";
  const color = product.visual?.badge_color || "#6366f1";
  document.getElementById("formBadgeColor").value = color;
  document.getElementById("formBadgeColorText").textContent = color.toUpperCase();

  // Class Type
  setClassType(product.type || "Online");

  // Dynamic lists
  formCurriculum = Array.isArray(product.curriculum) ? JSON.parse(JSON.stringify(product.curriculum)) : [];
  formFeatures = Array.isArray(product.features) ? JSON.parse(JSON.stringify(product.features)) : [];
  formSpecifications = Array.isArray(product.specifications)
    ? product.specifications.filter((s) => s !== (product.type || "Online"))
    : [];
  formOutcomes = Array.isArray(product.outcomes) ? [...product.outcomes] : [];

  renderCurriculumBuilder();
  renderFeatureBuilder();
  renderSpecificationBuilder();
  renderOutcomeBuilder();
  updatePublicUrlPreview();
}

/**
 * Reset form to blank create state
 */
function resetForm() {
  document.getElementById("formProductId").value = "";
  document.getElementById("formProductId").disabled = false;
  document.getElementById("formName").value = "";
  document.getElementById("formBasePrice").value = "";
  document.getElementById("formTotalSessions").value = 0;

  const editor = document.getElementById("formDescriptionEditor");
  if (editor) editor.innerHTML = "";

  setStatus("active");
  document.getElementById("formBadgeText").value = "NEW";
  document.getElementById("formBadgeColor").value = "#6366f1";
  document.getElementById("formBadgeColorText").textContent = "#6366F1";

  setClassType("Online");

  formCurriculum = [];
  formFeatures = [];
  formSpecifications = [];
  formOutcomes = [];

  renderCurriculumBuilder();
  renderFeatureBuilder();
  renderSpecificationBuilder();
  renderOutcomeBuilder();
  updatePublicUrlPreview();
}

/**
 * Set active / archived status in form
 */
export function setStatus(status) {
  const btnActive = document.getElementById("statusBtnActive");
  const btnArchived = document.getElementById("statusBtnArchived");
  const input = document.getElementById("formStatus");

  if (input) input.value = status;

  if (status === "active") {
    btnActive?.classList.add("bg-white", "text-indigo-600", "shadow-sm");
    btnActive?.classList.remove("text-slate-400");
    btnArchived?.classList.remove("bg-white", "text-red-600", "shadow-sm");
    btnArchived?.classList.add("text-slate-400");
  } else {
    btnArchived?.classList.add("bg-white", "text-red-600", "shadow-sm");
    btnArchived?.classList.remove("text-slate-400");
    btnActive?.classList.remove("bg-white", "text-indigo-600", "shadow-sm");
    btnActive?.classList.add("text-slate-400");
  }
}

/**
 * Set Class Type (Online, Offline, Hybrid)
 */
export function setClassType(type) {
  const input = document.getElementById("formType");
  if (input) input.value = type;

  const buttons = document.querySelectorAll(".class-type-btn");
  buttons.forEach((btn) => {
    const btnType = btn.getAttribute("data-type");
    if (btnType === type) {
      btn.className = "class-type-btn flex-1 py-2 rounded-xl text-[11px] font-bold border transition-all bg-indigo-600 text-white border-indigo-600";
    } else {
      btn.className = "class-type-btn flex-1 py-2 rounded-xl text-[11px] font-bold border transition-all bg-slate-50 text-slate-600 border-slate-200";
    }
  });
}

/**
 * Update Public URL preview based on Product ID
 */
export function updatePublicUrlPreview() {
  const idInput = document.getElementById("formProductId");
  const preview = document.getElementById("publicUrlPreview");
  if (!idInput || !preview) return;

  const key = String(idInput.value || "").trim().toLowerCase();
  const url = PUBLIC_URL_MAP[key];

  if (url) {
    preview.innerHTML = `<a href="${url}" target="_blank" class="text-indigo-600 underline font-mono">${escapeHtml(url)}</a>`;
  } else {
    preview.innerHTML = `<span class="text-slate-400 font-mono">Belum tersedia</span>`;
  }
}

/* =====================================================================
   DYNAMIC ROW BUILDERS
   ===================================================================== */

/**
 * Curriculum Builder
 */
export function renderCurriculumBuilder() {
  const container = document.getElementById("curriculumBuilderContainer");
  if (!container) return;

  if (formCurriculum.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-400 italic py-2">Belum ada materi kurikulum ditambahkan.</div>`;
    return;
  }

  container.innerHTML = formCurriculum
    .map((item, idx) => `
      <div class="dynamic-row-item space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-3" data-index="${idx}">
        <div class="flex items-center gap-2">
          <input
            type="text"
            placeholder="01"
            value="${escapeHtml(item.order || String(idx + 1).padStart(2, "0"))}"
            class="curriculum-order-input w-14 px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 text-center"
            data-index="${idx}"
          />
          <input
            type="text"
            placeholder="Judul Materi / Sesi"
            value="${escapeHtml(item.title || "")}"
            class="curriculum-title-input flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium"
            data-index="${idx}"
          />
          <button
            type="button"
            class="btn-remove-curriculum text-slate-300 hover:text-red-500 transition-colors p-1"
            data-index="${idx}"
            title="Hapus Materi"
          >
            <i class="bi bi-x-lg text-sm"></i>
          </button>
        </div>
        <input
          type="text"
          placeholder="Deskripsi singkat materi..."
          value="${escapeHtml(item.description || "")}"
          class="curriculum-desc-input w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-normal"
          data-index="${idx}"
        />
      </div>
    `)
    .join("");

  // Attach change and remove handlers
  container.querySelectorAll(".curriculum-order-input").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const idx = parseInt(e.target.getAttribute("data-index"), 10);
      if (formCurriculum[idx]) formCurriculum[idx].order = e.target.value;
    });
  });

  container.querySelectorAll(".curriculum-title-input").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const idx = parseInt(e.target.getAttribute("data-index"), 10);
      if (formCurriculum[idx]) formCurriculum[idx].title = e.target.value;
    });
  });

  container.querySelectorAll(".curriculum-desc-input").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const idx = parseInt(e.target.getAttribute("data-index"), 10);
      if (formCurriculum[idx]) formCurriculum[idx].description = e.target.value;
    });
  });

  container.querySelectorAll(".btn-remove-curriculum").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      formCurriculum.splice(idx, 1);
      renderCurriculumBuilder();
    });
  });
}

export function addCurriculumItem() {
  const nextOrder = String(formCurriculum.length + 1).padStart(2, "0");
  formCurriculum.push({ order: nextOrder, title: "", description: "" });
  renderCurriculumBuilder();
}

/**
 * Features / Benefit Builder
 */
export function renderFeatureBuilder() {
  const container = document.getElementById("featureBuilderContainer");
  if (!container) return;

  if (formFeatures.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-400 italic py-2">Belum ada benefit ditambahkan.</div>`;
    return;
  }

  container.innerHTML = formFeatures
    .map((feat, idx) => `
      <div class="dynamic-row-item p-3.5 bg-slate-50 rounded-xl border border-slate-200" data-index="${idx}">
        <div class="flex justify-between items-start gap-2 mb-2">
          <input
            type="text"
            placeholder="Label Benefit (Contoh: Modul E-Book)"
            value="${escapeHtml(feat.label || "")}"
            class="feature-label-input flex-1 bg-white px-3 py-1.5 rounded-lg border border-slate-200 font-bold text-xs outline-none focus:border-indigo-300"
            data-index="${idx}"
          />
          <button
            type="button"
            class="btn-remove-feature text-slate-300 hover:text-red-500 transition-colors p-1"
            data-index="${idx}"
            title="Hapus Benefit"
          >
            <i class="bi bi-x-lg text-sm"></i>
          </button>
        </div>
        <div class="flex gap-2 items-center">
          <select
            class="feature-type-select bg-white px-2 py-1.5 rounded-lg text-[11px] font-bold outline-none border border-slate-200"
            data-index="${idx}"
          >
            <option value="boolean" ${feat.type === "boolean" ? "selected" : ""}>Ya / Tidak</option>
            <option value="text" ${feat.type === "text" ? "selected" : ""}>Teks Bebas</option>
          </select>
          <div class="flex-1">
            ${
              feat.type === "boolean"
                ? `<label class="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 bg-white px-3 py-1 rounded-lg border border-slate-200">
                    <input type="checkbox" class="feature-bool-input w-4 h-4 rounded text-indigo-600" data-index="${idx}" ${feat.value ? "checked" : ""}>
                    <span>${feat.value ? "Termasuk (Ya)" : "Tidak Termasuk"}</span>
                   </label>`
                : `<input type="text" placeholder="Nilai (Contoh: 1 kali)" value="${escapeHtml(String(feat.value || ""))}" class="feature-text-input w-full bg-white px-3 py-1.5 rounded-lg text-xs outline-none border border-slate-200" data-index="${idx}">`
            }
          </div>
        </div>
      </div>
    `)
    .join("");

  container.querySelectorAll(".feature-label-input").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const idx = parseInt(e.target.getAttribute("data-index"), 10);
      if (formFeatures[idx]) formFeatures[idx].label = e.target.value;
    });
  });

  container.querySelectorAll(".feature-type-select").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const idx = parseInt(e.target.getAttribute("data-index"), 10);
      if (formFeatures[idx]) {
        formFeatures[idx].type = e.target.value;
        formFeatures[idx].value = e.target.value === "boolean" ? true : "";
        renderFeatureBuilder();
      }
    });
  });

  container.querySelectorAll(".feature-bool-input").forEach((chk) => {
    chk.addEventListener("change", (e) => {
      const idx = parseInt(e.target.getAttribute("data-index"), 10);
      if (formFeatures[idx]) {
        formFeatures[idx].value = e.target.checked;
        renderFeatureBuilder();
      }
    });
  });

  container.querySelectorAll(".feature-text-input").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const idx = parseInt(e.target.getAttribute("data-index"), 10);
      if (formFeatures[idx]) formFeatures[idx].value = e.target.value;
    });
  });

  container.querySelectorAll(".btn-remove-feature").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      formFeatures.splice(idx, 1);
      renderFeatureBuilder();
    });
  });
}

export function addFeatureItem() {
  formFeatures.push({ label: "", type: "boolean", value: true });
  renderFeatureBuilder();
}

/**
 * Specification Builder
 */
export function renderSpecificationBuilder() {
  const container = document.getElementById("specificationBuilderContainer");
  if (!container) return;

  if (formSpecifications.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-400 italic py-1">Belum ada spesifikasi tambahan.</div>`;
    return;
  }

  container.innerHTML = formSpecifications
    .map((spec, idx) => `
      <div class="dynamic-row-item flex items-center gap-2" data-index="${idx}">
        <input
          type="text"
          placeholder="Spesifikasi (contoh: Max 10 Peserta)..."
          value="${escapeHtml(spec || "")}"
          class="spec-input flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white"
          data-index="${idx}"
        />
        <button
          type="button"
          class="btn-remove-spec text-slate-300 hover:text-red-500 transition-colors p-1"
          data-index="${idx}"
        >
          <i class="bi bi-x-lg text-sm"></i>
        </button>
      </div>
    `)
    .join("");

  container.querySelectorAll(".spec-input").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const idx = parseInt(e.target.getAttribute("data-index"), 10);
      formSpecifications[idx] = e.target.value;
    });
  });

  container.querySelectorAll(".btn-remove-spec").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      formSpecifications.splice(idx, 1);
      renderSpecificationBuilder();
    });
  });
}

export function addSpecificationItem() {
  formSpecifications.push("");
  renderSpecificationBuilder();
}

/**
 * Outcomes Builder
 */
export function renderOutcomeBuilder() {
  const container = document.getElementById("outcomeBuilderContainer");
  if (!container) return;

  if (formOutcomes.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-400 italic py-1">Belum ada target outcome ditambahkan.</div>`;
    return;
  }

  container.innerHTML = formOutcomes
    .map((outcome, idx) => `
      <div class="dynamic-row-item flex items-center gap-2" data-index="${idx}">
        <input
          type="text"
          placeholder="Target capaian member..."
          value="${escapeHtml(outcome || "")}"
          class="outcome-input flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white"
          data-index="${idx}"
        />
        <button
          type="button"
          class="btn-remove-outcome text-slate-300 hover:text-red-500 transition-colors p-1"
          data-index="${idx}"
        >
          <i class="bi bi-x-lg text-sm"></i>
        </button>
      </div>
    `)
    .join("");

  container.querySelectorAll(".outcome-input").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const idx = parseInt(e.target.getAttribute("data-index"), 10);
      formOutcomes[idx] = e.target.value;
    });
  });

  container.querySelectorAll(".btn-remove-outcome").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      formOutcomes.splice(idx, 1);
      renderOutcomeBuilder();
    });
  });
}

export function addOutcomeItem() {
  formOutcomes.push("");
  renderOutcomeBuilder();
}

/* =====================================================================
   RICH TEXT COMMANDS
   ===================================================================== */

export function executeRichCommand(command, value = null) {
  const editor = document.getElementById("formDescriptionEditor");
  if (!editor) return;
  editor.focus();
  document.execCommand(command, false, value);
}

/* =====================================================================
   FORM SERIALIZATION & GETTERS
   ===================================================================== */

export function getFormData() {
  const productId = String(document.getElementById("formProductId")?.value || "").trim();
  const name = String(document.getElementById("formName")?.value || "").trim();
  const priceRaw = String(document.getElementById("formBasePrice")?.value || "").replace(/[^\d]/g, "");
  const basePrice = priceRaw ? parseInt(priceRaw, 10) : 0;
  const totalSessions = parseInt(document.getElementById("formTotalSessions")?.value || "0", 10);
  const status = document.getElementById("formStatus")?.value || "active";
  const type = document.getElementById("formType")?.value || "Online";

  const editor = document.getElementById("formDescriptionEditor");
  const description = editor ? editor.innerHTML.trim() : "";

  const badgeText = String(document.getElementById("formBadgeText")?.value || "NEW").trim();
  const badgeColor = String(document.getElementById("formBadgeColor")?.value || "#6366f1").trim();

  return {
    isEdit: currentFormMode === "edit",
    productId,
    data: {
      product_id: productId,
      name,
      base_price: basePrice,
      total_sessions: totalSessions,
      status,
      type,
      description,
      visual: {
        badge_text: badgeText,
        badge_color: badgeColor,
        thumbnail_url: null,
      },
      curriculum: formCurriculum.filter((c) => String(c.title || "").trim()),
      features: formFeatures.filter((f) => String(f.label || "").trim()),
      specifications: formSpecifications.filter((s) => String(s || "").trim()),
      outcomes: formOutcomes.filter((o) => String(o || "").trim()),
    },
  };
}

/* =====================================================================
   DELETE MODAL CONTROLLER
   ===================================================================== */

let pendingDeleteProductId = null;

export function openDeleteModal(product) {
  const modal = document.getElementById("deleteModalBackdrop");
  const nameEl = document.getElementById("deleteProductName");
  if (!modal) return;

  pendingDeleteProductId = product.product_id;
  if (nameEl) {
    nameEl.textContent = `${product.name || "Unnamed"} (${product.product_id})`;
  }

  modal.classList.add("show");
}

export function closeDeleteModal() {
  const modal = document.getElementById("deleteModalBackdrop");
  if (!modal) return;
  modal.classList.remove("show");
  pendingDeleteProductId = null;
}

export function getPendingDeleteId() {
  return pendingDeleteProductId || editingProductId;
}

/* =====================================================================
   TOAST & BUTTON HELPERS
   ===================================================================== */

export function showToast(msg) {
  const toast = document.getElementById("dgToast");
  const msgEl = document.getElementById("dgToastMessage");
  if (!toast || !msgEl) return;

  msgEl.textContent = msg;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

export function setButtonLoading(button, isLoading, defaultHtml = "") {
  if (!button) return;
  if (isLoading) {
    button.disabled = true;
    button.setAttribute("data-default-html", button.innerHTML);
    button.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-current inline-block" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
      Menyimpan...
    `;
  } else {
    button.disabled = false;
    const prev = button.getAttribute("data-default-html") || defaultHtml;
    if (prev) button.innerHTML = prev;
  }
}
