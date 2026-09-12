// pages/marketing/promo-classes/promo-classes.js
// =====================================================================
// ORCHESTRATOR LAYER: Promo Classes & Batches
// Coordinates auth, app shell, real-time repository listeners, and UI views.
// =====================================================================

import { requireAuth } from "../../../assets/js/auth-guard.js";
import { renderTopbar } from "../../../assets/js/components/topbar/topbar.js";
import { renderSidebar } from "../../../assets/js/components/sidebar/sidebar.js";
import { renderRightbarRecruit } from "../../../element/rightbar-recruit.js?v=2.0.0";
import { confirmDialog, alertDialog, toast } from "../../../assets/js/ui.js";

import * as PromoRepo from "./promo-classes.repository.js";
import * as PromoUI from "./promo-classes.ui.js";

const state = {
  currentUser: null,
  role: null,
  promoClassesCache: [],
  promoBatchesCache: [],
  batchListCache: [],
  activeBatchLabel: null,
  currentPage: 1,
  ITEMS_PER_PAGE: 10,
  selectedIds: new Set(),
  migratingLabels: new Set(),
  promoClassModal: null,
  newBatchModal: null,
};

let unsubscribePromoClasses = null;
let unsubscribePromoBatches = null;

// DOM Element references
let searchInput = null;
let locationFilter = null;
let tableBody = null;
let resultSummary = null;
let paginationInfo = null;
let paginationContainer = null;
let selectAllCheckbox = null;
let bulkActionBar = null;
let bulkSelectedCount = null;
let batchScroller = null;
let batchInfoBar = null;
let batchInfoLabel = null;
let batchInfoSub = null;
let batchContentArea = null;
let batchTableWrap = null;
let deleteBatchBtn = null;
let newBatchStartDate = null;
let newBatchEndDate = null;
let newBatchPreview = null;

/**
 * Initialize Promo Classes feature.
 */
async function initialize() {
  try {
    const authData = await requireAuth();
    state.currentUser = authData.user;
    state.role = authData.role;

    renderTopbar({ user: state.currentUser, role: state.role });
    renderSidebar({ role: state.role, activePage: "promo-classes" });
    if (typeof renderRightbarRecruit === "function") {
      renderRightbarRecruit();
    }

    cacheDOMElements();
    initBootstrapModals();
    wireEvents();

    listenToPromoBatches();
    listenToPromoClasses();
  } catch (error) {
    console.error("[PromoClasses] Initialization error:", error);
  }
}

/**
 * Cache necessary DOM element references.
 */
function cacheDOMElements() {
  searchInput = document.getElementById("searchInput");
  locationFilter = document.getElementById("locationFilter");
  tableBody = document.getElementById("promoClassTableBody");
  resultSummary = document.getElementById("resultSummary");
  paginationInfo = document.getElementById("paginationInfo");
  paginationContainer = document.getElementById("paginationContainer");
  selectAllCheckbox = document.getElementById("selectAllCheckbox");
  bulkActionBar = document.getElementById("bulkActionBar");
  bulkSelectedCount = document.getElementById("bulkSelectedCount");
  batchScroller = document.getElementById("batchScroller");
  batchInfoBar = document.getElementById("batchInfoBar");
  batchInfoLabel = document.getElementById("batchInfoLabel");
  batchInfoSub = document.getElementById("batchInfoSub");
  batchContentArea = document.getElementById("batchContentArea");
  batchTableWrap = document.getElementById("batchTableWrap");
  deleteBatchBtn = document.getElementById("deleteBatchBtn");
  newBatchStartDate = document.getElementById("newBatchStartDate");
  newBatchEndDate = document.getElementById("newBatchEndDate");
  newBatchPreview = document.getElementById("newBatchPreview");
}

/**
 * Initialize Bootstrap modal instances.
 */
function initBootstrapModals() {
  const promoModalEl = document.getElementById("promoClassModal");
  if (promoModalEl && window.bootstrap) {
    state.promoClassModal = bootstrap.Modal.getOrCreateInstance(promoModalEl);
  }

  const batchModalEl = document.getElementById("newBatchModal");
  if (batchModalEl && window.bootstrap) {
    state.newBatchModal = bootstrap.Modal.getOrCreateInstance(batchModalEl);
  }
}

/**
 * Listen to Promo Batches Firestore updates.
 */
function listenToPromoBatches() {
  if (unsubscribePromoBatches) unsubscribePromoBatches();
  unsubscribePromoBatches = PromoRepo.subscribePromoBatches(
    (batches) => {
      state.promoBatchesCache = batches;
      rebuildBatchList();
    },
    (error) => {
      console.error("Failed to load promo batches:", error);
      toast("Gagal memuat data batch.", "error");
    }
  );
}

/**
 * Listen to Promo Classes Firestore updates.
 */
function listenToPromoClasses() {
  if (unsubscribePromoClasses) unsubscribePromoClasses();
  unsubscribePromoClasses = PromoRepo.subscribePromoClasses(
    (classes) => {
      const validIds = new Set(classes.map((c) => c.id));
      for (const id of Array.from(state.selectedIds)) {
        if (!validIds.has(id)) state.selectedIds.delete(id);
      }

      state.promoClassesCache = classes.sort((a, b) => {
        const aTime = PromoUI.getTimestampMs(a.updated_at, a.updated_at_ms) || PromoUI.getTimestampMs(a.created_at, a.created_at_ms) || 0;
        const bTime = PromoUI.getTimestampMs(b.updated_at, b.updated_at_ms) || PromoUI.getTimestampMs(b.created_at, b.created_at_ms) || 0;
        return bTime - aTime;
      });

      rebuildBatchList();
    },
    (error) => {
      console.error("Failed to load promo classes:", error);
      toast("Gagal memuat promo classes.", "error");
    }
  );
}

/**
 * Derive merged batch list and sort chronologically.
 */
function rebuildBatchList() {
  const byLabel = new Map();

  state.promoBatchesCache.forEach((batchDoc) => {
    if (!batchDoc.label) return;
    byLabel.set(batchDoc.label, {
      id: batchDoc.id,
      label: batchDoc.label,
      startDate: batchDoc.startDate || null,
      endDate: batchDoc.endDate || null,
      count: 0,
    });
  });

  const legacyLabelsMissing = new Set();

  state.promoClassesCache.forEach((item) => {
    const label = String(item.promoDuration || "").trim();
    if (!label) return;
    if (byLabel.has(label)) {
      byLabel.get(label).count += 1;
    } else {
      legacyLabelsMissing.add(label);
      if (!byLabel.has(label)) {
        const range = PromoUI.parseDurationDateRange(label);
        byLabel.set(label, {
          id: null,
          label,
          startDate: range ? PromoUI.formatDateToISO(range.start) : null,
          endDate: range ? PromoUI.formatDateToISO(range.end) : null,
          count: 0,
        });
      }
      byLabel.get(label).count += 1;
    }
  });

  state.batchListCache = Array.from(byLabel.values()).sort((a, b) => {
    const aTime = a.startDate ? new Date(a.startDate).getTime() : 0;
    const bTime = b.startDate ? new Date(b.startDate).getTime() : 0;
    return aTime - bTime;
  });

  migrateLegacyBatches(legacyLabelsMissing);

  if (!state.activeBatchLabel && state.batchListCache.length > 0) {
    state.activeBatchLabel = pickDefaultBatchLabel();
  }
  if (
    state.activeBatchLabel &&
    !state.batchListCache.some((b) => b.label === state.activeBatchLabel)
  ) {
    state.activeBatchLabel = state.batchListCache.length
      ? state.batchListCache[0].label
      : null;
  }

  PromoUI.renderBatchScroller(batchScroller, state.batchListCache, state.activeBatchLabel);
  PromoUI.renderLocationFilterOptions(locationFilter, getItemsForActiveBatch());
  renderActiveBatchView();
}

/**
 * Determine default batch based on current date.
 * @returns {string|null}
 */
function pickDefaultBatchLabel() {
  const now = Date.now();
  const containing = state.batchListCache.find((b) => {
    if (!b.startDate || !b.endDate) return false;
    const s = new Date(b.startDate).getTime();
    const e = new Date(b.endDate).getTime();
    return now >= s && now <= e;
  });
  if (containing) return containing.label;

  const upcoming = state.batchListCache
    .filter((b) => b.startDate && new Date(b.startDate).getTime() >= now)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))[0];
  if (upcoming) return upcoming.label;

  return state.batchListCache.length
    ? state.batchListCache[state.batchListCache.length - 1].label
    : null;
}

/**
 * Migrate legacy batches without formal documents.
 * @param {Set<string>} legacyLabelsMissing
 */
async function migrateLegacyBatches(legacyLabelsMissing) {
  if (!state.currentUser) return;
  const actor = state.currentUser.email || state.currentUser.uid || "";

  for (const label of legacyLabelsMissing) {
    if (state.migratingLabels.has(label)) continue;
    const range = PromoUI.parseDurationDateRange(label);
    if (!range) continue;
    state.migratingLabels.add(label);
    try {
      await PromoRepo.createPromoBatch(
        {
          label,
          startDate: PromoUI.formatDateToISO(range.start),
          endDate: PromoUI.formatDateToISO(range.end),
        },
        actor
      );
    } catch (error) {
      console.error("Failed to migrate legacy batch:", label, error);
      state.migratingLabels.delete(label);
    }
  }
}

/**
 * Select active batch pill.
 * @param {string} label
 */
function selectBatch(label) {
  state.activeBatchLabel = label;
  state.currentPage = 1;
  state.selectedIds.clear();
  PromoUI.renderBatchScroller(batchScroller, state.batchListCache, state.activeBatchLabel);
  PromoUI.renderLocationFilterOptions(locationFilter, getItemsForActiveBatch());
  renderActiveBatchView();
}

/**
 * Get active batch object.
 * @returns {Object|null}
 */
function getActiveBatch() {
  return state.batchListCache.find((b) => b.label === state.activeBatchLabel) || null;
}

/**
 * Get items belonging to the active batch.
 * @returns {Array<Object>}
 */
function getItemsForActiveBatch() {
  if (!state.activeBatchLabel) return [];
  return state.promoClassesCache.filter(
    (item) => String(item.promoDuration || "").trim() === state.activeBatchLabel
  );
}

/**
 * Filter promo classes in active batch based on search & location filter.
 * @returns {Array<Object>}
 */
function getFilteredPromoClasses() {
  const searchTerm = PromoUI.normalizeText(searchInput?.value);
  const selectedLocation = locationFilter?.value || "all";
  const items = getItemsForActiveBatch();

  return items.filter((item) => {
    const matchesLocation =
      selectedLocation === "all" ||
      String(item.location || "").trim() === selectedLocation;
    if (!matchesLocation) return false;
    if (!searchTerm) return true;

    const haystack = [
      item.product,
      item.location,
      item.locationName,
      item.normalPrice,
      item.promoPrice,
      item.mapsLink,
    ]
      .map((value) => String(value || ""))
      .join(" ");

    return PromoUI.normalizeText(haystack).includes(searchTerm);
  });
}

/**
 * Render the main active batch view, metrics, and data table.
 */
function renderActiveBatchView() {
  const batch = getActiveBatch();

  if (!batch) {
    if (batchInfoBar) batchInfoBar.style.display = "none";
    if (batchContentArea) batchContentArea.style.display = "block";
    if (batchTableWrap) batchTableWrap.style.display = "none";
    return;
  }

  if (batchInfoBar) batchInfoBar.style.display = "flex";
  if (batchContentArea) batchContentArea.style.display = "none";
  if (batchTableWrap) batchTableWrap.style.display = "block";

  if (batchInfoLabel) batchInfoLabel.textContent = batch.label;
  if (batchInfoSub) batchInfoSub.textContent = `${batch.count} data dalam batch ini`;
  if (deleteBatchBtn) {
    deleteBatchBtn.style.display = batch.count === 0 ? "inline-flex" : "none";
  }

  const batchItems = getItemsForActiveBatch();
  PromoUI.renderMetrics(batchItems);
  renderPromoClassTable();
  PromoUI.updateBulkActionBar(bulkActionBar, bulkSelectedCount, state.selectedIds.size);
}

/**
 * Render table and pagination for current page.
 */
function renderPromoClassTable() {
  const filteredRows = getFilteredPromoClasses();
  const totalItems = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / state.ITEMS_PER_PAGE));
  if (state.currentPage > totalPages) state.currentPage = totalPages;
  if (state.currentPage < 1) state.currentPage = 1;

  const startIndex = totalItems === 0 ? 0 : (state.currentPage - 1) * state.ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(state.currentPage * state.ITEMS_PER_PAGE, totalItems);
  const paginatedRows = filteredRows.slice(
    startIndex > 0 ? startIndex - 1 : 0,
    endIndex
  );

  if (resultSummary) resultSummary.textContent = `${totalItems} data`;
  if (paginationInfo) paginationInfo.textContent = `Menampilkan ${startIndex}-${endIndex} dari ${totalItems} data`;

  PromoUI.renderPromoClassTable(tableBody, paginatedRows, state.selectedIds);
  PromoUI.renderPagination(paginationContainer, totalItems, totalPages, state.currentPage);
  PromoUI.updateSelectAllState(selectAllCheckbox, paginatedRows, state.selectedIds);
}

/**
 * Open Add Modal.
 */
function handleOpenAddModal() {
  if (!state.activeBatchLabel) {
    alertDialog("Pilih atau buat batch terlebih dahulu.", { type: "warning", title: "Batch Belum Dipilih" });
    return;
  }
  PromoUI.resetForm(state.activeBatchLabel);
  const title = document.getElementById("promoClassModalTitle");
  if (title) title.textContent = "Tambah Promo Class";
  if (state.promoClassModal) state.promoClassModal.show();
}

/**
 * Open Edit Modal.
 * @param {string} id
 */
function handleOpenEditModal(id) {
  const item = state.promoClassesCache.find((row) => row.id === id);
  if (!item) return;

  const title = document.getElementById("promoClassModalTitle");
  if (title) title.textContent = "Edit Promo Class";
  PromoUI.populateEditForm(item, state.activeBatchLabel);
  if (state.promoClassModal) state.promoClassModal.show();
}

/**
 * Handle saving Promo Class (Add / Edit).
 */
async function handleSavePromoClass() {
  const id = document.getElementById("promoClassId")?.value.trim() || "";
  const product = document.getElementById("productInput")?.value.trim() || "";
  const classLocation = document.getElementById("locationInput")?.value.trim() || "";
  const locationName = document.getElementById("locationNameInput")?.value.trim() || "";
  const mapsLink = document.getElementById("mapsLinkInput")?.value.trim() || "";
  const normalPrice = document.getElementById("normalPriceInput")?.value.trim() || "";
  const promoPrice = document.getElementById("promoPriceInput")?.value.trim() || "";
  const promoDuration = document.getElementById("promoDurationInput")?.value.trim() || state.activeBatchLabel || "";

  if (!product) {
    await alertDialog("Product wajib diisi.", { type: "warning", title: "Validasi Form" });
    return;
  }
  if (!classLocation) {
    await alertDialog("Location wajib diisi.", { type: "warning", title: "Validasi Form" });
    return;
  }
  if (!normalPrice) {
    await alertDialog("Normal price wajib diisi.", { type: "warning", title: "Validasi Form" });
    return;
  }
  if (!promoPrice) {
    await alertDialog("Promo price wajib diisi.", { type: "warning", title: "Validasi Form" });
    return;
  }
  if (!promoDuration) {
    await alertDialog("Batch tidak ditemukan, pilih batch terlebih dahulu.", { type: "warning", title: "Validasi Form" });
    return;
  }

  const saveBtn = document.getElementById("savePromoClassBtn");
  const saveLabel = document.getElementById("savePromoClassLabel");
  const saveSpinner = document.getElementById("savePromoClassSpinner");
  if (saveBtn) saveBtn.disabled = true;
  if (saveLabel) saveLabel.textContent = "Menyimpan...";
  if (saveSpinner) saveSpinner.style.display = "inline-block";

  const actor = state.currentUser ? state.currentUser.email || state.currentUser.uid || "" : "";
  const payload = {
    product,
    location: classLocation,
    locationName,
    mapsLink,
    normalPrice,
    promoPrice,
    promoDuration,
  };

  try {
    if (id) {
      await PromoRepo.updatePromoClass(id, payload, actor);
      toast(`Promo class "${product}" berhasil diperbarui.`, "success");
    } else {
      await PromoRepo.createPromoClass(payload, actor);
      toast(`Promo class "${product}" berhasil ditambahkan ke batch.`, "success");
    }

    if (state.promoClassModal) state.promoClassModal.hide();
    PromoUI.resetForm(state.activeBatchLabel);
  } catch (error) {
    console.error("Failed to save promo class:", error);
    await alertDialog("Gagal menyimpan promo class: " + error.message, { type: "error", title: "Terjadi Kesalahan" });
  } finally {
    if (saveBtn) saveBtn.disabled = false;
    if (saveLabel) saveLabel.textContent = "Simpan";
    if (saveSpinner) saveSpinner.style.display = "none";
  }
}

/**
 * Handle deleting single promo class with confirmation modal.
 * @param {string} id
 */
async function handleDeletePromoClass(id) {
  if (!id) return;
  const item = state.promoClassesCache.find((row) => row.id === id);
  const name = item?.product || "promo class ini";

  const ok = await confirmDialog(`Yakin ingin menghapus promo class "${name}" dari batch ini?`, {
    title: "Hapus Promo Class",
    confirmText: "Ya, Hapus",
    cancelText: "Batal",
    danger: true,
  });
  if (!ok) return;

  try {
    await PromoRepo.deletePromoClass(id);
    state.selectedIds.delete(id);
    toast(`Promo class "${name}" berhasil dihapus.`, "success");
  } catch (error) {
    console.error("Failed to delete promo class:", error);
    await alertDialog("Gagal menghapus promo class: " + error.message, { type: "error", title: "Terjadi Kesalahan" });
  }
}

/**
 * Handle bulk deleting selected items with confirmation modal.
 */
async function handleBulkDelete() {
  if (state.selectedIds.size === 0) {
    await alertDialog("Pilih minimal satu data terlebih dahulu.", { type: "warning", title: "Belum Ada Data Dipilih" });
    return;
  }

  const count = state.selectedIds.size;
  const ok = await confirmDialog(`Yakin ingin menghapus ${count} data promo class yang dipilih dari batch ini? Tindakan ini tidak dapat dibatalkan.`, {
    title: "Hapus Data Terpilih",
    confirmText: `Hapus ${count} Data`,
    cancelText: "Batal",
    danger: true,
  });
  if (!ok) return;

  const idsToDelete = Array.from(state.selectedIds);
  try {
    await PromoRepo.bulkDeletePromoClasses(idsToDelete);
    state.selectedIds.clear();
    toast(`${idsToDelete.length} data berhasil dihapus dari batch.`, "success");
    PromoUI.updateBulkActionBar(bulkActionBar, bulkSelectedCount, 0);
  } catch (error) {
    console.error("Failed to bulk delete promo classes:", error);
    await alertDialog("Gagal menghapus data secara bulk: " + error.message, { type: "error", title: "Terjadi Kesalahan" });
  }
}

/**
 * Update New Batch date range live preview.
 */
function updateNewBatchPreview() {
  const start = newBatchStartDate?.value;
  const end = newBatchEndDate?.value;
  if (newBatchPreview) {
    if (start && end) {
      newBatchPreview.textContent = `${PromoUI.formatDateToIndonesian(start)} - ${PromoUI.formatDateToIndonesian(end)}`;
    } else {
      newBatchPreview.textContent = "-";
    }
  }
}

/**
 * Open New Batch modal.
 */
function handleOpenNewBatchModal() {
  const today = new Date();
  if (newBatchStartDate) newBatchStartDate.value = PromoUI.formatDateToISO(today);
  const end = new Date(today);
  end.setDate(end.getDate() + 30);
  if (newBatchEndDate) newBatchEndDate.value = PromoUI.formatDateToISO(end);
  updateNewBatchPreview();
  if (state.newBatchModal) state.newBatchModal.show();
}

/**
 * Save New Batch.
 */
async function handleSaveNewBatch() {
  const start = newBatchStartDate?.value;
  const end = newBatchEndDate?.value;

  if (!start || !end) {
    await alertDialog("Pilih tanggal mulai dan tanggal selesai.", { type: "warning", title: "Validasi Batch" });
    return;
  }
  if (new Date(end) < new Date(start)) {
    await alertDialog("Tanggal selesai tidak boleh sebelum tanggal mulai.", { type: "warning", title: "Validasi Tanggal" });
    return;
  }

  const label = `${PromoUI.formatDateToIndonesian(start)} - ${PromoUI.formatDateToIndonesian(end)}`;
  const existing = state.batchListCache.find((b) => b.label === label);
  if (existing) {
    toast("Batch dengan rentang tanggal ini sudah ada.", "warning");
    selectBatch(label);
    if (state.newBatchModal) state.newBatchModal.hide();
    return;
  }

  const btn = document.getElementById("saveNewBatchBtn");
  const btnLabel = document.getElementById("saveNewBatchLabel");
  const spinner = document.getElementById("saveNewBatchSpinner");
  if (btn) btn.disabled = true;
  if (btnLabel) btnLabel.textContent = "Menyimpan...";
  if (spinner) spinner.style.display = "inline-block";

  const actor = state.currentUser ? state.currentUser.email || state.currentUser.uid || "" : "";

  try {
    await PromoRepo.createPromoBatch(
      {
        label,
        startDate: start,
        endDate: end,
      },
      actor
    );

    state.activeBatchLabel = label;
    toast(`Batch "${label}" berhasil dibuat.`, "success");
    if (state.newBatchModal) state.newBatchModal.hide();
  } catch (error) {
    console.error("Failed to create batch:", error);
    await alertDialog("Gagal membuat batch baru: " + error.message, { type: "error", title: "Terjadi Kesalahan" });
  } finally {
    if (btn) btn.disabled = false;
    if (btnLabel) btnLabel.textContent = "Buat Batch";
    if (spinner) spinner.style.display = "none";
  }
}

/**
 * Handle Deleting an empty Batch.
 */
async function handleDeleteBatch() {
  const batch = getActiveBatch();
  if (!batch) return;

  if (batch.count > 0) {
    await alertDialog("Batch tidak bisa dihapus karena masih berisi data promo class. Hapus atau pindahkan data terlebih dahulu.", {
      type: "warning",
      title: "Batch Masih Berisi Data",
    });
    return;
  }

  const ok = await confirmDialog(`Yakin ingin menghapus batch "${batch.label}"? Batch ini kosong dan akan dihapus permanen.`, {
    title: "Hapus Batch",
    confirmText: "Ya, Hapus Batch",
    cancelText: "Batal",
    danger: true,
  });
  if (!ok) return;

  if (!batch.id) {
    state.activeBatchLabel = null;
    rebuildBatchList();
    toast(`Batch "${batch.label}" berhasil dihapus.`, "success");
    return;
  }

  try {
    await PromoRepo.deletePromoBatch(batch.id);
    state.activeBatchLabel = null;
    toast(`Batch "${batch.label}" berhasil dihapus.`, "success");
  } catch (error) {
    console.error("Failed to delete batch:", error);
    await alertDialog("Gagal menghapus batch: " + error.message, { type: "error", title: "Terjadi Kesalahan" });
  }
}

/**
 * Wire all DOM events and event delegations.
 */
function wireEvents() {
  // Global buttons
  document.getElementById("btnRefreshAll")?.addEventListener("click", () => {
    listenToPromoBatches();
    listenToPromoClasses();
    toast("Data sedang disegarkan.", "info");
  });

  document.getElementById("btnNewBatch")?.addEventListener("click", handleOpenNewBatchModal);
  document.getElementById("btnEmptyNewBatch")?.addEventListener("click", handleOpenNewBatchModal);
  document.getElementById("addToBatchBtn")?.addEventListener("click", handleOpenAddModal);
  document.getElementById("deleteBatchBtn")?.addEventListener("click", handleDeleteBatch);
  document.getElementById("savePromoClassBtn")?.addEventListener("click", handleSavePromoClass);
  document.getElementById("saveNewBatchBtn")?.addEventListener("click", handleSaveNewBatch);
  document.getElementById("btnBulkDelete")?.addEventListener("click", handleBulkDelete);
  document.getElementById("btnBulkClear")?.addEventListener("click", () => {
    state.selectedIds.clear();
    PromoUI.updateBulkActionBar(bulkActionBar, bulkSelectedCount, 0);
    renderPromoClassTable();
  });

  // Date picker change listeners
  newBatchStartDate?.addEventListener("change", updateNewBatchPreview);
  newBatchEndDate?.addEventListener("change", updateNewBatchPreview);
  newBatchStartDate?.addEventListener("click", function () {
    this.showPicker?.();
  });
  newBatchEndDate?.addEventListener("click", function () {
    this.showPicker?.();
  });

  // Search & Filter
  searchInput?.addEventListener("input", () => {
    state.currentPage = 1;
    renderPromoClassTable();
  });

  locationFilter?.addEventListener("change", () => {
    state.currentPage = 1;
    renderPromoClassTable();
  });

  // Select all checkbox
  selectAllCheckbox?.addEventListener("change", (e) => {
    const isChecked = e.target.checked;
    const filteredRows = getFilteredPromoClasses();
    const startIndex = (state.currentPage - 1) * state.ITEMS_PER_PAGE;
    const visibleRows = filteredRows.slice(startIndex, startIndex + state.ITEMS_PER_PAGE);

    visibleRows.forEach((row) => {
      if (isChecked) {
        state.selectedIds.add(row.id);
      } else {
        state.selectedIds.delete(row.id);
      }
    });

    PromoUI.updateBulkActionBar(bulkActionBar, bulkSelectedCount, state.selectedIds.size);
    renderPromoClassTable();
  });

  // Event delegation on table body (checkbox, edit, delete)
  tableBody?.addEventListener("click", (e) => {
    const target = e.target;

    // Checkbox toggle
    const checkbox = target.closest(".row-checkbox");
    if (checkbox) {
      const id = checkbox.dataset.id;
      if (checkbox.checked) {
        state.selectedIds.add(id);
      } else {
        state.selectedIds.delete(id);
      }
      PromoUI.updateBulkActionBar(bulkActionBar, bulkSelectedCount, state.selectedIds.size);
      renderPromoClassTable();
      return;
    }

    // Action button clicks
    const btn = target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === "edit" && id) {
      handleOpenEditModal(id);
    } else if (action === "delete" && id) {
      handleDeletePromoClass(id);
    }
  });

  // Event delegation on batch scroller
  batchScroller?.addEventListener("click", (e) => {
    const pill = e.target.closest("[data-action]");
    if (!pill) return;
    const action = pill.dataset.action;
    if (action === "select-batch") {
      const label = pill.dataset.batchLabel;
      if (label) selectBatch(label);
    } else if (action === "open-new-batch") {
      handleOpenNewBatchModal();
    }
  });

  // Event delegation on pagination
  paginationContainer?.addEventListener("click", (e) => {
    const link = e.target.closest("[data-page]");
    if (!link) return;
    const page = parseInt(link.dataset.page, 10);
    if (!isNaN(page)) {
      state.currentPage = page;
      renderPromoClassTable();
    }
  });

  // Cleanup listeners on unload
  window.addEventListener("unload", () => {
    if (unsubscribePromoBatches) unsubscribePromoBatches();
    if (unsubscribePromoClasses) unsubscribePromoClasses();
  });
}

// Start lifecycle
document.addEventListener("DOMContentLoaded", initialize);
