// pages/product/product-management/product-management.js
// =====================================================================
// PRODUCT MANAGEMENT FEATURE ORCHESTRATOR
// Coordinates Auth, Shell, Data Repository & UI interactions.
// =====================================================================

import { requireAuth } from "../../../assets/js/auth-guard.js";
import { renderTopbar } from "../../../assets/js/components/topbar/topbar.js";
import { renderSidebar } from "../../../assets/js/components/sidebar/sidebar.js";

import {
  subscribeToProducts,
  fetchProducts,
  saveProduct,
  deleteProduct,
  FALLBACK_PRODUCTS,
} from "./product-management.repository.js";

import {
  renderTable,
  renderLoading,
  renderEmpty,
  openProductModal,
  closeProductModal,
  openDeleteModal,
  closeDeleteModal,
  getFormData,
  getPendingDeleteId,
  showToast,
  setButtonLoading,
  setStatus,
  setClassType,
  updatePublicUrlPreview,
  addCurriculumItem,
  addFeatureItem,
  addSpecificationItem,
  addOutcomeItem,
  executeRichCommand,
} from "./product-management.ui.js";

let allProducts = [];
let activeFilter = "all";
let unsubscribeListener = null;

/**
 * Initialize Product Management feature.
 */
async function initialize() {
  try {
    const { user, role } = await requireAuth();

    // Render shared app shell
    renderTopbar({ user, role });
    renderSidebar({ role, activePage: "product-management" });

    // Show table loading state
    renderLoading();

    // Setup event listeners
    setupEventListeners();

    // Subscribe to Firestore changes or fallback
    let isInitialLoaded = false;
    unsubscribeListener = subscribeToProducts(
      (products) => {
        isInitialLoaded = true;
        allProducts = products;
        applySearchAndFilter();
      },
      async (err) => {
        console.warn("[ProductManagement] Fallback triggered due to Firestore error:", err);
        if (!isInitialLoaded) {
          try {
            const fetched = await fetchProducts(5000);
            if (fetched && fetched.length > 0) {
              allProducts = fetched;
            } else {
              allProducts = [...FALLBACK_PRODUCTS];
            }
          } catch (e) {
            allProducts = [...FALLBACK_PRODUCTS];
          }
          applySearchAndFilter();
        }
      }
    );

    console.log("Product Management feature initialized successfully.");
  } catch (error) {
    console.error("Failed to initialize Product Management:", error);
  }
}

/**
 * Filter products based on search input and active status tab.
 */
function applySearchAndFilter() {
  const searchInput = document.getElementById("productSearchInput");
  const query = (searchInput?.value || "").toLowerCase().trim();

  const filtered = allProducts.filter((p) => {
    const matchSearch =
      !query ||
      (p.name || "").toLowerCase().includes(query) ||
      (p.product_id || "").toLowerCase().includes(query) ||
      (p.type || "").toLowerCase().includes(query);

    const matchStatus = activeFilter === "all" || (p.status || "active") === activeFilter;

    return matchSearch && matchStatus;
  });

  renderTable(filtered, {
    onEdit: handleOpenEditModal,
  });
}

/**
 * Handle opening the edit modal
 */
function handleOpenEditModal(product) {
  openProductModal(product);
}

/**
 * Setup all DOM event listeners
 */
function setupEventListeners() {
  // New Product Button
  const btnNew = document.getElementById("btnNewProduct");
  if (btnNew) {
    btnNew.addEventListener("click", () => {
      openProductModal(null);
    });
  }

  // Modal Close Buttons
  document.getElementById("modalCloseBtn")?.addEventListener("click", closeProductModal);
  document.getElementById("modalCancelBtn")?.addEventListener("click", closeProductModal);

  // Status Filter Tabs
  document.querySelectorAll(".status-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".status-filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.getAttribute("data-status") || "all";
      applySearchAndFilter();
    });
  });

  // Search Input
  const searchInput = document.getElementById("productSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", applySearchAndFilter);
  }

  // Price auto-formatting
  const priceInput = document.getElementById("formBasePrice");
  if (priceInput) {
    priceInput.addEventListener("input", (e) => {
      const digits = e.target.value.replace(/[^\d]/g, "");
      if (digits) {
        e.target.value = new Intl.NumberFormat("id-ID").format(parseInt(digits, 10));
      } else {
        e.target.value = "";
      }
    });
  }

  // Product ID input for public URL preview
  const pidInput = document.getElementById("formProductId");
  if (pidInput) {
    pidInput.addEventListener("input", updatePublicUrlPreview);
  }

  // Status toggle in modal
  document.getElementById("statusBtnActive")?.addEventListener("click", () => setStatus("active"));
  document.getElementById("statusBtnArchived")?.addEventListener("click", () => setStatus("archived"));

  // Class Type selector buttons in modal
  document.querySelectorAll(".class-type-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = btn.getAttribute("data-type");
      if (t) setClassType(t);
    });
  });

  // Badge Color Picker sync
  const colorPicker = document.getElementById("formBadgeColor");
  const colorText = document.getElementById("formBadgeColorText");
  if (colorPicker && colorText) {
    colorPicker.addEventListener("input", (e) => {
      colorText.textContent = (e.target.value || "#6366F1").toUpperCase();
    });
  }

  // Rich Text Editor Toolbar Buttons
  document.querySelectorAll(".rich-tool-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cmd = btn.getAttribute("data-command");
      const val = btn.getAttribute("data-value") || null;
      if (cmd) executeRichCommand(cmd, val);
    });
  });

  // Dynamic Item Add Buttons
  document.getElementById("btnAddCurriculum")?.addEventListener("click", addCurriculumItem);
  document.getElementById("btnAddFeature")?.addEventListener("click", addFeatureItem);
  document.getElementById("btnAddSpecification")?.addEventListener("click", addSpecificationItem);
  document.getElementById("btnAddOutcome")?.addEventListener("click", addOutcomeItem);

  // Form Submit (Save / Register)
  const form = document.getElementById("productForm");
  if (form) {
    form.addEventListener("submit", handleSaveProduct);
  }

  // Modal Delete Button (from edit form)
  document.getElementById("modalDeleteBtn")?.addEventListener("click", () => {
    const { productId, data } = getFormData();
    if (productId) {
      openDeleteModal(data);
    }
  });

  // Delete Modal Confirmation
  document.getElementById("btnCancelDelete")?.addEventListener("click", closeDeleteModal);
  document.getElementById("btnConfirmDelete")?.addEventListener("click", handleConfirmDelete);
}

/**
 * Handle Save / Update Product
 */
async function handleSaveProduct(e) {
  e.preventDefault();

  const { isEdit, productId, data } = getFormData();

  if (!productId) {
    alert("Product Unique ID is required.");
    return;
  }

  if (!isEdit && allProducts.some((p) => p.product_id === productId)) {
    alert(`Product with ID '${productId}' already exists! Please use another ID.`);
    return;
  }

  const submitBtn = document.getElementById("modalSubmitBtn");
  setButtonLoading(submitBtn, true);

  try {
    await saveProduct(data, isEdit);

    // Update local state if not realtime
    const existingIndex = allProducts.findIndex((p) => p.product_id === productId);
    if (existingIndex >= 0) {
      allProducts[existingIndex] = { ...allProducts[existingIndex], ...data };
    } else {
      allProducts.unshift({ id: productId, ...data });
    }

    applySearchAndFilter();
    closeProductModal();
    showToast(isEdit ? "Data Synced with Database" : "New Product Registered");
  } catch (error) {
    console.error("Gagal menyimpan produk:", error);
    alert("Gagal menyimpan produk: " + (error.message || error));
  } finally {
    setButtonLoading(submitBtn, false, isEdit ? "Push Changes" : "Register Product");
  }
}

/**
 * Handle Confirm Delete
 */
async function handleConfirmDelete() {
  const productId = getPendingDeleteId();
  if (!productId) return;

  const confirmBtn = document.getElementById("btnConfirmDelete");
  setButtonLoading(confirmBtn, true);

  try {
    await deleteProduct(productId);

    allProducts = allProducts.filter((p) => p.product_id !== productId);
    applySearchAndFilter();

    closeDeleteModal();
    closeProductModal();
    showToast("Product Deleted");
  } catch (error) {
    console.error("Gagal menghapus produk:", error);
    alert("Gagal menghapus produk: " + (error.message || error));
  } finally {
    setButtonLoading(confirmBtn, false, "Delete Product");
  }
}

// Kickoff initialization when DOM is ready
document.addEventListener("DOMContentLoaded", initialize);
