import { requireAuth } from "../../../assets/js/auth-guard.js";
import { renderTopbar } from "../../../assets/js/components/topbar/topbar.js";
import { renderSidebar } from "../../../assets/js/components/sidebar/sidebar.js";
import { renderRightbarRecruit } from "../../../element/rightbar-recruit.js?v=2.0.0";

import * as PositionRepo from "./company-position.repository.js";
import * as PositionUI from "./company-position.ui.js";

let allPositions = [];
let departmentsData = { labelMap: {}, colorMap: {}, rawList: [] };
let currentView = "grid";
const PAGE_SIZE = 9;
let visibleCount = PAGE_SIZE;

const filterState = {
  search: "",
  department: "All",
  status: "All",
  datePreset: "all",
  customStart: null,
  customEnd: null,
};

let addModalInstance = null;
let editModalInstance = null;

/**
 * Filter positions based on active filter state.
 * @returns {Array}
 */
function getFilteredPositions() {
  let items = allPositions.slice();

  // Search filter
  const term = filterState.search.trim().toLowerCase();
  if (term) {
    items = items.filter((item) => {
      const name = (item.name || "").toLowerCase();
      const deptLabel = (
        departmentsData.labelMap[item.department] ||
        item.department ||
        ""
      ).toLowerCase();
      return name.includes(term) || deptLabel.includes(term);
    });
  }

  // Department filter
  if (filterState.department !== "All") {
    items = items.filter((item) => {
      const deptLabel = departmentsData.labelMap[item.department] || item.department || "";
      return deptLabel.toLowerCase() === filterState.department.toLowerCase();
    });
  }

  // Status filter
  if (filterState.status !== "All") {
    items = items.filter((item) => {
      return (item.status || "").toLowerCase() === filterState.status.toLowerCase();
    });
  }

  // Date filter
  const preset = filterState.datePreset;
  if (preset !== "all") {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let start = null;
    let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (preset === "last7") {
      start = new Date(today.getTime() - 7 * 86400000);
    } else if (preset === "last30") {
      start = new Date(today.getTime() - 30 * 86400000);
    } else if (preset === "last90") {
      start = new Date(today.getTime() - 90 * 86400000);
    } else if (preset === "custom" && filterState.customStart && filterState.customEnd) {
      const s = new Date(filterState.customStart);
      const e = new Date(filterState.customEnd);
      e.setHours(23, 59, 59, 999);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        start = s;
        end = e;
      }
    }

    if (start) {
      items = items.filter((item) => {
        if (!item.createdAt) return true;
        const d = item.createdAt;
        return d >= start && d <= end;
      });
    }
  }

  return items;
}

/**
 * Apply filters and render the active view.
 */
function applyFiltersAndRender() {
  const filtered = getFilteredPositions();
  const visibleItems = filtered.slice(0, visibleCount);

  const gridWrapper = document.getElementById("positionsGridWrapper");
  const listWrapper = document.getElementById("positionsListWrapper");

  const handlers = {
    onEdit: handleOpenEditModal,
    onDelete: handleDeletePosition,
  };

  if (currentView === "grid") {
    if (gridWrapper) gridWrapper.classList.remove("d-none");
    if (listWrapper) listWrapper.classList.add("d-none");
    PositionUI.renderPositionsGrid(
      visibleItems,
      departmentsData.labelMap,
      departmentsData.colorMap,
      handlers
    );
  } else {
    if (gridWrapper) gridWrapper.classList.add("d-none");
    if (listWrapper) listWrapper.classList.remove("d-none");
    PositionUI.renderPositionsList(visibleItems, departmentsData.labelMap, handlers);
  }

  const loadMoreBtn = document.getElementById("positionsLoadMoreBtn");
  if (loadMoreBtn) {
    loadMoreBtn.classList.toggle("d-none", visibleCount >= filtered.length);
  }
}

/**
 * Load fresh positions from repository.
 */
async function loadPositions() {
  try {
    allPositions = await PositionRepo.listPositions();
    applyFiltersAndRender();
  } catch (error) {
    console.error("Failed to load company positions:", error);
  }
}

/**
 * Handle Open Add Position Modal.
 */
function handleOpenAddModal() {
  PositionUI.resetAddPositionForm();
  const deptSelect = document.getElementById("positionAddDepartment");
  if (deptSelect) {
    PositionUI.populateDepartmentSelect(deptSelect, departmentsData.labelMap);
  }

  const modalEl = document.getElementById("positionAddModal");
  if (modalEl && window.bootstrap) {
    addModalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    addModalInstance.show();
  }
}

/**
 * Handle Submit Add Position Form.
 */
async function handleSubmitAddPosition(e) {
  e.preventDefault();
  const formData = PositionUI.getAddPositionFormData();
  if (!formData.name) {
    alert("Please enter a position name.");
    return;
  }

  try {
    await PositionRepo.addPosition(formData);
    if (addModalInstance) addModalInstance.hide();
    await loadPositions();
  } catch (error) {
    console.error("Failed to save new position:", error);
    alert("Failed to save new position. Please try again.");
  }
}

/**
 * Handle Open Edit Position Modal.
 */
function handleOpenEditModal(positionId) {
  const item = allPositions.find((p) => p.id === positionId);
  if (!item) return;

  PositionUI.populateEditPositionForm(item, departmentsData.labelMap);

  const modalEl = document.getElementById("positionEditModal");
  if (modalEl && window.bootstrap) {
    editModalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    editModalInstance.show();
  }
}

/**
 * Handle Submit Edit Position Form.
 */
async function handleSubmitEditPosition(e) {
  e.preventDefault();
  const formData = PositionUI.getEditPositionFormData();
  if (!formData.id || !formData.name) {
    alert("Position name cannot be empty.");
    return;
  }

  try {
    await PositionRepo.updatePosition(formData.id, formData);
    if (editModalInstance) editModalInstance.hide();
    await loadPositions();
  } catch (error) {
    console.error("Failed to update position:", error);
    alert("Failed to update position. Please try again.");
  }
}

/**
 * Handle Delete Position.
 */
async function handleDeletePosition(positionId) {
  const item = allPositions.find((p) => p.id === positionId);
  const name = item ? item.name : "this position";

  const confirmed = window.confirm(
    `Are you sure you want to delete "${name}"? This action cannot be undone.`
  );
  if (!confirmed) return;

  try {
    await PositionRepo.deletePosition(positionId);
    await loadPositions();
  } catch (error) {
    console.error("Failed to delete position:", error);
    alert("Failed to delete position. Please try again.");
  }
}

/**
 * Wire all DOM event listeners.
 */
function wireEvents() {
  // View Toggle Buttons (Grid vs List)
  const viewGridBtn = document.getElementById("viewGridBtn");
  const viewListBtn = document.getElementById("viewListBtn");

  if (viewGridBtn && viewListBtn) {
    viewGridBtn.addEventListener("click", () => {
      currentView = "grid";
      viewGridBtn.classList.add("active");
      viewListBtn.classList.remove("active");
      visibleCount = PAGE_SIZE;
      applyFiltersAndRender();
    });

    viewListBtn.addEventListener("click", () => {
      currentView = "list";
      viewListBtn.classList.add("active");
      viewGridBtn.classList.remove("active");
      visibleCount = PAGE_SIZE;
      applyFiltersAndRender();
    });
  }

  // Search Input
  const searchInput = document.getElementById("positionSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      filterState.search = e.target.value || "";
      visibleCount = PAGE_SIZE;
      applyFiltersAndRender();
    });
  }

  // Department Filter
  const deptFilter = document.getElementById("positionDeptFilter");
  if (deptFilter) {
    deptFilter.addEventListener("change", (e) => {
      filterState.department = e.target.value || "All";
      visibleCount = PAGE_SIZE;
      applyFiltersAndRender();
    });
  }

  // Status Filter
  const statusFilter = document.getElementById("positionStatusFilter");
  if (statusFilter) {
    statusFilter.addEventListener("change", (e) => {
      filterState.status = e.target.value || "All";
      visibleCount = PAGE_SIZE;
      applyFiltersAndRender();
    });
  }

  // Date Filter & Custom Date Range
  const dateFilter = document.getElementById("positionDateFilter");
  const dateRangeWrapper = document.getElementById("positionDateRangeWrapper");
  const dateStartInput = document.getElementById("positionDateStart");
  const dateEndInput = document.getElementById("positionDateEnd");

  if (dateFilter) {
    dateFilter.addEventListener("change", (e) => {
      const val = e.target.value || "all";
      filterState.datePreset = val;
      if (val === "custom" && dateRangeWrapper) {
        dateRangeWrapper.classList.remove("d-none");
      } else if (dateRangeWrapper) {
        dateRangeWrapper.classList.add("d-none");
        filterState.customStart = null;
        filterState.customEnd = null;
        if (dateStartInput) dateStartInput.value = "";
        if (dateEndInput) dateEndInput.value = "";
      }
      visibleCount = PAGE_SIZE;
      applyFiltersAndRender();
    });
  }

  if (dateStartInput) {
    dateStartInput.addEventListener("change", (e) => {
      filterState.customStart = e.target.value || null;
      visibleCount = PAGE_SIZE;
      applyFiltersAndRender();
    });
  }

  if (dateEndInput) {
    dateEndInput.addEventListener("change", (e) => {
      filterState.customEnd = e.target.value || null;
      visibleCount = PAGE_SIZE;
      applyFiltersAndRender();
    });
  }

  // Load More Button
  const loadMoreBtn = document.getElementById("positionsLoadMoreBtn");
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      visibleCount += PAGE_SIZE;
      applyFiltersAndRender();
    });
  }

  // Add Position Button & Form
  const addBtn = document.getElementById("positionAddBtn");
  if (addBtn) {
    addBtn.addEventListener("click", handleOpenAddModal);
  }

  const addForm = document.getElementById("positionAddForm");
  if (addForm) {
    addForm.addEventListener("submit", handleSubmitAddPosition);
  }

  // Edit Position Form
  const editForm = document.getElementById("positionEditForm");
  if (editForm) {
    editForm.addEventListener("submit", handleSubmitEditPosition);
  }
}

/**
 * Initialize Company Position Page.
 */
async function init() {
  try {
    // 1. Initial UI wiring
    wireEvents();
    if (typeof renderRightbarRecruit === "function") {
      renderRightbarRecruit();
    }

    // 2. Auth guard
    const authResult = await requireAuth();
    if (!authResult) return;

    const { user, role } = authResult;

    // 3. Mount Shell Topbar & Sidebar
    renderTopbar({ user, role: role || "member" });
    renderSidebar({ role: role || "member", activePage: "company-position" });

    // 4. Load Department Metadata
    departmentsData = await PositionRepo.loadDepartmentsMap();

    // 5. Populate Filter Dropdown
    const deptFilter = document.getElementById("positionDeptFilter");
    if (deptFilter) {
      PositionUI.populateDepartmentFilter(deptFilter, departmentsData.labelMap);
    }

    // 6. Load Positions from Firestore
    await loadPositions();
  } catch (error) {
    console.error("Initialization error in company-position:", error);
    try {
      await loadPositions();
    } catch (_) {}
  }
}

// Start on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
