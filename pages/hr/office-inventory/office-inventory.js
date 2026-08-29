// pages/hr/office-inventory/office-inventory.js
// =====================================================================
// OFFICE INVENTORY ORCHESTRATOR
// Coordinates authentication, shell rendering, repository data calls,
// and UI presentation for the Office Inventory feature.
// =====================================================================

import { requireAuth } from "../../../assets/js/auth-guard.js";
import { renderTopbar } from "../../../assets/js/components/topbar/topbar.js";
import { renderSidebar } from "../../../assets/js/components/sidebar/sidebar.js";

import {
  subscribeToInventory,
  loadKategoriCounters,
  generateInventoryID,
  getSequenceNumber,
  addInventory,
  updateInventory,
  deleteInventory,
} from "./office-inventory.repository.js";

import {
  renderTable,
  renderLoading,
  renderEmpty,
  openAddModal,
  closeAddModal,
  openEditModal,
  closeEditModal,
  openDeleteModal,
  closeDeleteModal,
  getAddFormData,
  getEditFormData,
  setButtonLoading,
} from "./office-inventory.ui.js";

let allItems = [];
let editingId = null;
let deletingId = null;
let unsubscribeInventory = null;

/**
 * Initialize Office Inventory feature.
 */
async function initialize() {
  try {
    const { user, role } = await requireAuth();

    // Render shared layout shell
    renderTopbar({ user, role });
    renderSidebar({ role, activePage: "office-inventory" });

    // Show initial loading state
    renderLoading();

    // Load counter cache for accurate ID generation
    await loadKategoriCounters();

    // Setup event listeners
    setupEventListeners();

    // Subscribe to Firestore changes
    unsubscribeInventory = subscribeToInventory(
      (items) => {
        allItems = items;
        applySearchAndRender();
      },
      (error) => {
        console.error("Error subscribing to inventory:", error);
        renderEmpty(null, "Gagal memuat data inventaris. Silakan periksa koneksi.");
      }
    );

    console.log("Office Inventory module initialized successfully.");
  } catch (error) {
    console.error("Failed to initialize Office Inventory:", error);
  }
}

/**
 * Filter items according to search query and update table.
 */
function applySearchAndRender() {
  const searchInput = document.getElementById("searchInput");
  const searchVal = (searchInput?.value || "").toLowerCase().trim();

  let filtered = allItems;
  if (searchVal) {
    filtered = allItems.filter(
      (item) =>
        (item.nama_barang || "").toLowerCase().includes(searchVal) ||
        (item.id_generated || "").toLowerCase().includes(searchVal) ||
        (item.kategori_kode || "").toLowerCase().includes(searchVal) ||
        (item.lokasi_kode || "").toLowerCase().includes(searchVal)
    );
  }

  renderTable(filtered, {
    onEdit: handleOpenEdit,
    onDelete: handleOpenDelete,
  });
}

/**
 * Handle Add form submission.
 */
async function handleSaveInventory() {
  const data = getAddFormData();

  if (!data.nama_barang) {
    alert("Nama barang harus diisi.");
    return;
  }
  if (!data.kategori_kode) {
    alert("Kategori harus dipilih.");
    return;
  }
  if (!data.lokasi_kode) {
    alert("Lokasi harus dipilih.");
    return;
  }
  if (!data.tanggal_beli) {
    alert("Tanggal beli harus diisi.");
    return;
  }

  setButtonLoading(
    "addSave",
    true,
    '<i class="fas fa-spinner fa-spin"></i> Menyimpan...',
    '<i class="fas fa-save mr-1"></i> Simpan'
  );

  try {
    const idGenerated = await generateInventoryID(
      data.kategori_kode,
      data.lokasi_kode,
      data.tanggal_beli,
      data.tipe_pembelian
    );

    const urutan = getSequenceNumber(data.kategori_kode, data.lokasi_kode);

    await addInventory({
      ...data,
      id_generated: idGenerated,
      urutan: urutan,
      status: "Available",
    });

    closeAddModal();
    alert("Barang berhasil ditambahkan!");
  } catch (e) {
    console.error("Gagal menyimpan inventaris:", e);
    alert("Gagal menyimpan: " + e.message);
  } finally {
    setButtonLoading(
      "addSave",
      false,
      '<i class="fas fa-spinner fa-spin"></i> Menyimpan...',
      '<i class="fas fa-save mr-1"></i> Simpan'
    );
  }
}

/**
 * Handle opening Edit modal for selected item.
 * @param {string} id
 */
function handleOpenEdit(id) {
  const item = allItems.find((i) => i.id === id);
  if (!item) return;
  editingId = id;
  openEditModal(item);
}

/**
 * Handle Edit form submission.
 */
async function handleUpdateInventory() {
  if (!editingId) return;
  const data = getEditFormData();

  if (!data.nama_barang) {
    alert("Nama barang harus diisi.");
    return;
  }
  if (!data.kategori_kode) {
    alert("Kategori harus dipilih.");
    return;
  }
  if (!data.lokasi_kode) {
    alert("Lokasi harus dipilih.");
    return;
  }
  if (!data.tanggal_beli) {
    alert("Tanggal beli harus diisi.");
    return;
  }

  setButtonLoading(
    "editSave",
    true,
    '<i class="fas fa-spinner fa-spin"></i> Menyimpan...',
    '<i class="fas fa-save mr-1"></i> Simpan'
  );

  try {
    await updateInventory(editingId, data);
    closeEditModal();
    editingId = null;
    alert("Inventaris berhasil diperbarui!");
  } catch (e) {
    console.error("Gagal memperbarui inventaris:", e);
    alert("Gagal menyimpan: " + e.message);
  } finally {
    setButtonLoading(
      "editSave",
      false,
      '<i class="fas fa-spinner fa-spin"></i> Menyimpan...',
      '<i class="fas fa-save mr-1"></i> Simpan'
    );
  }
}

/**
 * Handle opening Delete confirmation modal.
 * @param {string} id
 * @param {string} name
 */
function handleOpenDelete(id, name) {
  deletingId = id;
  openDeleteModal(id, name);
}

/**
 * Handle confirmed deletion.
 */
async function handleConfirmDelete() {
  if (!deletingId) return;

  setButtonLoading(
    "deleteConfirm",
    true,
    '<i class="fas fa-spinner fa-spin"></i> Menghapus...',
    "Ya, Hapus"
  );

  try {
    await deleteInventory(deletingId);
    deletingId = null;
    closeDeleteModal();
  } catch (e) {
    console.error("Gagal menghapus inventaris:", e);
    alert("Gagal menghapus: " + e.message);
  } finally {
    setButtonLoading(
      "deleteConfirm",
      false,
      '<i class="fas fa-spinner fa-spin"></i> Menghapus...',
      "Ya, Hapus"
    );
  }
}

/**
 * Setup DOM event listeners.
 */
function setupEventListeners() {
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", applySearchAndRender);
  }

  // Add modal controls
  const addBtn = document.getElementById("addInventoryBtn");
  if (addBtn) addBtn.addEventListener("click", openAddModal);

  const addClose = document.getElementById("addClose");
  if (addClose) addClose.addEventListener("click", closeAddModal);

  const addCancel = document.getElementById("addCancel");
  if (addCancel) addCancel.addEventListener("click", closeAddModal);

  const addSave = document.getElementById("addSave");
  if (addSave) addSave.addEventListener("click", handleSaveInventory);

  // Edit modal controls
  const editClose = document.getElementById("editClose");
  if (editClose) editClose.addEventListener("click", closeEditModal);

  const editCancel = document.getElementById("editCancel");
  if (editCancel) editCancel.addEventListener("click", closeEditModal);

  const editSave = document.getElementById("editSave");
  if (editSave) editSave.addEventListener("click", handleUpdateInventory);

  // Delete modal controls
  const deleteCancel = document.getElementById("deleteCancel");
  if (deleteCancel) {
    deleteCancel.addEventListener("click", () => {
      deletingId = null;
      closeDeleteModal();
    });
  }

  const deleteConfirm = document.getElementById("deleteConfirm");
  if (deleteConfirm) deleteConfirm.addEventListener("click", handleConfirmDelete);
}

// Boot module on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
