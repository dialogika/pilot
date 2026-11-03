/**
 * Class Availability Orchestrator / Controller
 * Handles Auth Guard, App Shell Mounts, State Management, Event Listeners, and Pagination.
 */

import { requireAuth } from "../../../assets/js/auth-guard.js";
import { renderTopBar } from "../../../element/topbar.js";
import { renderSidebar } from "../../../element/sidebar.js";
import {
    fetchClassAvailability,
    fetchProducts,
    fetchMentors,
    addClassBatch,
    updateClassBatch,
    updateJoinedSeats,
    deleteClassBatch,
    moveToClassPlanning,
refactor/marketing/class-availability
    addMultipleClassBatches,

    exportClassData,
 main
    FALLBACK_CLASSES
} from "./class-availability.repository.js";
import {
    renderClassList,
    updateCardStepperDOM,
    renderPagination,
    populateProductDropdown,
    populateMentorDropdown,
    openModal,
    closeModal,
    renderPlanSummaryModal,
    formatCurrency,
    parseCurrency,
    isBatchClosed,
    getSeatsLeft,
    getBatchStatus,
    showToast,
refactor/marketing/class-availability
    parseSpreadsheetMatrix,
    renderImportPreview

    initClassExportModal
main
} from "./class-availability.ui.js";

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Auth Guard
    const user = await requireAuth();
    if (!user) return;

    // 2. Mount Topbar and Sidebar
    const topbarMount = document.getElementById("dg-topbar-mount");
    if (topbarMount) renderTopBar(topbarMount);

    const sidebarMount = document.getElementById("dg-sidebar-mount");
    if (sidebarMount) renderSidebar(sidebarMount);

    // 3. Local State
    let classesState = [];
    let productsState = [];
    let mentorsState = [];
    let selectedClassIds = [];
    let selectedBatchForEdit = null;
    let selectedBatchForDelete = null;
    let planSummaryState = { valid: [], invalid: [] };

    let searchQuery = "";
    let filterType = "All";
    let filterStatus = "All";
    let sortBy = "priority_sales";
    let sortDirection = "asc";

    let currentPage = 1;
    let pageSize = 10;

    // DOM Elements
    const listContainer = document.getElementById("classListContainer");
    const loadingState = document.getElementById("classLoadingState");
    const searchInput = document.getElementById("searchInput");
    const filterTypeSelect = document.getElementById("filterTypeSelect");
    const filterStatusSelect = document.getElementById("filterStatusSelect");
    const sortBySelect = document.getElementById("sortBySelect");
    const toggleSortBtn = document.getElementById("toggleSortBtn");
    const openPlanModalBtn = document.getElementById("openPlanModalBtn");

    // Add Batch Form Elements
    const addBatchForm = document.getElementById("addBatchForm");
    const newBatchNameInput = document.getElementById("newBatchName");
    const newBatchProductSelect = document.getElementById("newBatchProductId");
    const newBatchCustomProductInput = document.getElementById("newBatchCustomProduct");
    const newBatchTypeSelect = document.getElementById("newBatchType");
    const newBatchMaxSeatInput = document.getElementById("newBatchMaxSeat");
    const newBatchLocationSelect = document.getElementById("newBatchLocation");
    const newBatchMentorSelect = document.getElementById("newBatchMentor");
    const newBatchStartDateInput = document.getElementById("newBatchStartDate");
    const newBatchDpInput = document.getElementById("newBatchDp");
    const submitAddBatchBtn = document.getElementById("submitAddBatchBtn");

    // Edit Batch Form Elements
    const editBatchNameInput = document.getElementById("editBatchName");
    const editBatchProductSelect = document.getElementById("editBatchProductId");
    const editBatchTypeSelect = document.getElementById("editBatchType");
    const editBatchMaxSeatInput = document.getElementById("editBatchMaxSeat");
    const editBatchLocationSelect = document.getElementById("editBatchLocation");
    const editBatchMentorSelect = document.getElementById("editBatchMentor");
    const editBatchStartDateInput = document.getElementById("editBatchStartDate");
    const editBatchDpInput = document.getElementById("editBatchDp");
    const submitEditBatchBtn = document.getElementById("submitEditBatchBtn");

    // Delete Batch Elements
    const deleteBatchMessage = document.getElementById("deleteBatchMessage");
    const confirmDeleteBatchBtn = document.getElementById("confirmDeleteBatchBtn");

    // Plan Move Elements
    const confirmPlanMoveBtn = document.getElementById("confirmPlanMoveBtn");

    // 4. Filter & Sort Evaluation
    function getFilteredAndSortedClasses() {
        const query = searchQuery.trim().toLowerCase();

        return classesState
            .filter((c) => {
                const status = getBatchStatus(c);
                const typeMatch = filterType === "All" || c.type === filterType;
                const statusMatch = filterStatus === "All" || status === filterStatus;
                const searchMatch = !query ||
                    (c.name && c.name.toLowerCase().includes(query)) ||
                    (c.mentor_name && c.mentor_name.toLowerCase().includes(query)) ||
                    (c.product_name && c.product_name.toLowerCase().includes(query));
                return typeMatch && statusMatch && searchMatch;
            })
            .sort((a, b) => {
                let result = 0;
                const seatsA = getSeatsLeft(a);
                const seatsB = getSeatsLeft(b);

                const getScheduleTs = (item) => {
                    if (!item || !item.start_date) return Number.POSITIVE_INFINITY;
                    if (item.start_date === "Flexible") return Number.POSITIVE_INFINITY;
                    const ts = new Date(item.start_date).getTime();
                    return Number.isFinite(ts) ? ts : Number.POSITIVE_INFINITY;
                };

                const compareText = (txt1, txt2) => String(txt1 || "").localeCompare(String(txt2 || ""), "id", { sensitivity: "base" });

                if (sortBy === "name") {
                    result = compareText(a.name, b.name);
                } else if (sortBy === "schedule") {
                    result = getScheduleTs(a) - getScheduleTs(b);
                    if (result === 0) result = compareText(a.name, b.name);
                } else if (sortBy === "seats_left") {
                    result = seatsA - seatsB;
                    if (result === 0) result = compareText(a.name, b.name);
                } else if (sortBy === "mentor") {
                    result = compareText(a.mentor_name, b.mentor_name);
                    if (result === 0) result = compareText(a.name, b.name);
                } else if (sortBy === "product") {
                    const prodA = a.product_name || a.product_id || "";
                    const prodB = b.product_name || b.product_id || "";
                    result = compareText(prodA, prodB);
                    if (result === 0) result = compareText(a.name, b.name);
                } else {
                    // Default: Prioritas Penjualan
                    const soldOutA = seatsA <= 0 || isBatchClosed(a);
                    const soldOutB = seatsB <= 0 || isBatchClosed(b);
                    if (soldOutA !== soldOutB) {
                        result = soldOutA ? 1 : -1;
                    } else {
                        result = seatsA - seatsB;
                    }
                    if (result === 0) result = getScheduleTs(a) - getScheduleTs(b);
                    if (result === 0) result = compareText(a.name, b.name);
                }

                return sortDirection === "asc" ? result : -result;
            });
    }

    // 5. Render View
    function renderView() {
        const filtered = getFilteredAndSortedClasses();
        const totalItems = filtered.length;
        const totalPages = Math.ceil(totalItems / pageSize) || 1;

        if (currentPage > totalPages) {
            currentPage = totalPages;
        }
        if (currentPage < 1) {
            currentPage = 1;
        }

        const startIndex = (currentPage - 1) * pageSize;
        const pageItems = filtered.slice(startIndex, startIndex + pageSize);

        renderClassList({
            container: listContainer,
            items: pageItems,
            selectedIds: selectedClassIds,
            onToggleSelect: handleToggleSelect,
            onToggleSelectAll: handleToggleSelectAll,
            onStepJoined: handleStepJoined,
            onEdit: handleOpenEditBatch,
            onDelete: handleOpenDeleteBatch
        });

        renderPagination(
            { currentPage, pageSize, totalItems },
            (newPage) => {
                currentPage = newPage;
                renderView();
            },
            (newSize) => {
                pageSize = newSize;
                currentPage = 1;
                renderView();
            }
        );

        updatePlanButtonState();
    }

    function updatePlanButtonState() {
        if (!openPlanModalBtn) return;
        const count = selectedClassIds.length;
        openPlanModalBtn.disabled = count === 0;
        if (count === 0) {
            openPlanModalBtn.classList.add("opacity-50", "cursor-not-allowed");
        } else {
            openPlanModalBtn.classList.remove("opacity-50", "cursor-not-allowed");
        }
    }

    // 6. Selection Handlers
    function handleToggleSelect(id, checked) {
        if (checked) {
            if (!selectedClassIds.includes(id)) selectedClassIds.push(id);
        } else {
            selectedClassIds = selectedClassIds.filter(item => item !== id);
        }
        updatePlanButtonState();
    }

    function handleToggleSelectAll(checked) {
        const filtered = getFilteredAndSortedClasses();
        const selectable = filtered.filter(c => !c.is_planned);
        if (checked) {
            selectedClassIds = selectable.map(c => c.id);
        } else {
            selectedClassIds = [];
        }
        renderView();
    }

    // 7. Stepper Handler (In-Place DOM update without full list re-render or jumping)
    async function handleStepJoined(item, delta, cardEl) {
        const current = Number(item.current_joined) || 0;
        const max = Number(item.max_seat) || 0;
        const nextVal = current + delta;

        if (nextVal < 0 || nextVal > max) {
            return;
        }

        // Update local model
        item.current_joined = nextVal;

        // In-place DOM update on the specific card
        updateCardStepperDOM(cardEl, item);

        // Async Firestore update in background
        if (item.docId && !item.docId.startsWith("fallback-")) {
            try {
                await updateJoinedSeats(item.docId, nextVal);
            } catch (err) {
                console.error("Gagal sinkronisasi current_joined ke Firestore:", err);
                showToast("Gagal memperbarui kuota ke server", "error");
            }
        }
    }

    // 8. Open Edit Modal
    function handleOpenEditBatch(item) {
        selectedBatchForEdit = item;
        if (editBatchNameInput) editBatchNameInput.value = item.name || "";
        if (editBatchTypeSelect) editBatchTypeSelect.value = item.type || "Offline";
        if (editBatchMaxSeatInput) editBatchMaxSeatInput.value = item.max_seat || 1;
        if (editBatchLocationSelect) editBatchLocationSelect.value = item.location || "";
        if (editBatchStartDateInput) {
            editBatchStartDateInput.value = item.start_date && item.start_date !== "Flexible" ? item.start_date : "";
        }
        if (editBatchDpInput) {
            editBatchDpInput.value = formatCurrency(item.down_payment || 0);
        }

        populateProductDropdown(editBatchProductSelect, productsState, item.product_id || "");
        populateMentorDropdown(editBatchMentorSelect, mentorsState, item.mentor_name || "Unknown");

        openModal("editCapacityModal");
    }

    // 9. Save Edit Modal
    if (submitEditBatchBtn) {
        submitEditBatchBtn.addEventListener("click", async () => {
            if (!selectedBatchForEdit) return;

            const name = (editBatchNameInput?.value || "").trim();
            const productId = (editBatchProductSelect?.value || "").trim();
            const type = editBatchTypeSelect?.value || "Offline";
            const maxSeat = Number(editBatchMaxSeatInput?.value) || 0;
            const mentor = (editBatchMentorSelect?.value || "").trim();
            const startDate = (editBatchStartDateInput?.value || "").trim() || "Flexible";
            const location = (editBatchLocationSelect?.value || "").trim();
            const downPayment = parseCurrency(editBatchDpInput?.value || "0");

            if (!name || maxSeat <= 0) {
                showToast("Nama kelas dan Max Seat wajib diisi!", "error");
                return;
            }

            if (!productId) {
                showToast("Product wajib dipilih!", "error");
                return;
            }

            const productRef = productsState.find(p => p.productId === productId);
            const resolvedProductName = productRef ? productRef.name : null;

            const updatedData = {
                name,
                type,
                max_seat: maxSeat,
                current_joined: Math.min(selectedBatchForEdit.current_joined, maxSeat),
                start_date: startDate,
                mentor_name: mentor || "Unknown",
                product_id: productId,
                product_name: resolvedProductName,
                location,
                down_payment: downPayment
            };

            // Update local object
            Object.assign(selectedBatchForEdit, updatedData);

            if (selectedBatchForEdit.docId && !selectedBatchForEdit.docId.startsWith("fallback-")) {
                try {
                    await updateClassBatch(selectedBatchForEdit.docId, updatedData);
                    showToast("Batch kelas berhasil diperbarui", "success");
                } catch (err) {
                    console.error("Update batch error:", err);
                    showToast("Gagal menyimpan perubahan ke server", "error");
                }
            } else {
                showToast("Batch kelas diperbarui (Local)", "success");
            }

            closeModal("editCapacityModal");
            selectedBatchForEdit = null;
            renderView();
        });
    }

    // 10. Open Delete Modal
    function handleOpenDeleteBatch(item) {
        selectedBatchForDelete = item;
        if (deleteBatchMessage) {
            deleteBatchMessage.textContent = `Apakah Anda yakin ingin menghapus batch '${item.name}'?`;
        }
        openModal("deleteBatchModal");
    }

    // 11. Confirm Delete Modal
    if (confirmDeleteBatchBtn) {
        confirmDeleteBatchBtn.addEventListener("click", async () => {
            if (!selectedBatchForDelete) return;
            const itemToDelete = selectedBatchForDelete;

            classesState = classesState.filter(c => c.id !== itemToDelete.id);
            selectedClassIds = selectedClassIds.filter(id => id !== itemToDelete.id);

            if (itemToDelete.docId && !itemToDelete.docId.startsWith("fallback-")) {
                try {
                    await deleteClassBatch(itemToDelete.docId);
                    showToast("Batch kelas berhasil dihapus", "success");
                } catch (err) {
                    console.error("Delete batch error:", err);
                    showToast("Gagal menghapus batch dari server", "error");
                }
            } else {
                showToast("Batch kelas dihapus (Local)", "success");
            }

            closeModal("deleteBatchModal");
            selectedBatchForDelete = null;
            renderView();
        });
    }

    // 12. Add Batch Form & Custom Product toggle
    if (newBatchProductSelect && newBatchCustomProductInput) {
        newBatchProductSelect.addEventListener("change", () => {
            if (newBatchProductSelect.value === "__custom__") {
                newBatchCustomProductInput.classList.remove("hidden");
                newBatchCustomProductInput.focus();
            } else {
                newBatchCustomProductInput.classList.add("hidden");
                newBatchCustomProductInput.value = "";
            }
        });
    }

    // Currency mask for Add Batch DP input
    if (newBatchDpInput) {
        newBatchDpInput.addEventListener("input", (e) => {
            const raw = parseCurrency(e.target.value);
            e.target.value = formatCurrency(raw);
        });
    }
    if (editBatchDpInput) {
        editBatchDpInput.addEventListener("input", (e) => {
            const raw = parseCurrency(e.target.value);
            e.target.value = formatCurrency(raw);
        });
    }

    if (submitAddBatchBtn) {
        submitAddBatchBtn.addEventListener("click", async () => {
            const name = (newBatchNameInput?.value || "").trim();
            const selectedProduct = (newBatchProductSelect?.value || "").trim();
            const customProduct = (newBatchCustomProductInput?.value || "").trim();
            const productId = selectedProduct === "__custom__" ? customProduct : selectedProduct;
            const type = newBatchTypeSelect?.value || "Offline";
            const maxSeat = Number(newBatchMaxSeatInput?.value) || 0;
            const mentor = (newBatchMentorSelect?.value || "").trim();
            const startDate = (newBatchStartDateInput?.value || "").trim() || "Flexible";
            const location = (newBatchLocationSelect?.value || "").trim();
            const downPayment = parseCurrency(newBatchDpInput?.value || "0");

            if (!name || maxSeat <= 0) {
                showToast("Nama kelas dan Max Seat wajib diisi!", "error");
                return;
            }

            if (!productId) {
                showToast("Product wajib dipilih!", "error");
                return;
            }

            if (selectedProduct === "__custom__" && !customProduct) {
                showToast("Masukkan nama / kode product custom terlebih dahulu!", "error");
                return;
            }

            const nextNumericId = classesState.length
                ? Math.max(...classesState.map(c => Number(c.id) || 0)) + 1
                : 1;

            const productRef = productsState.find(p => p.productId === productId);
            const resolvedProductName = selectedProduct === "__custom__"
                ? customProduct
                : (productRef ? productRef.name : null);

            const newItem = {
                id: String(nextNumericId),
                docId: "",
                name,
                type,
                max_seat: maxSeat,
                current_joined: 0,
                start_date: startDate,
                mentor_name: mentor || "Unknown",
                product_id: productId,
                product_name: resolvedProductName,
                location,
                down_payment: downPayment,
                is_planned: false
            };

            try {
                const docId = await addClassBatch(newItem);
                newItem.docId = docId;
                classesState.unshift(newItem);
                showToast("Batch baru berhasil ditambahkan", "success");
            } catch (err) {
                console.error("Gagal menambah batch ke Firestore:", err);
                newItem.docId = `local-${Date.now()}`;
                classesState.unshift(newItem);
                showToast("Batch ditambahkan (Mode Offline)", "info");
            }

            // Reset form
            if (newBatchNameInput) newBatchNameInput.value = "";
            if (newBatchProductSelect) newBatchProductSelect.value = "";
            if (newBatchCustomProductInput) {
                newBatchCustomProductInput.value = "";
                newBatchCustomProductInput.classList.add("hidden");
            }
            if (newBatchTypeSelect) newBatchTypeSelect.value = "Offline";
            if (newBatchMaxSeatInput) newBatchMaxSeatInput.value = "1";
            if (newBatchLocationSelect) newBatchLocationSelect.value = "";
            if (newBatchMentorSelect) newBatchMentorSelect.value = "Unknown";
            if (newBatchStartDateInput) newBatchStartDateInput.value = "";
            if (newBatchDpInput) newBatchDpInput.value = "";

            closeModal("addBatchModal");
            currentPage = 1;
            renderView();
        });
    }

    // 13. Move to Planning Workflow
    if (openPlanModalBtn) {
        openPlanModalBtn.addEventListener("click", () => {
            planSummaryState = { valid: [], invalid: [] };
            selectedClassIds.forEach((id) => {
                const c = classesState.find(cls => cls.id === id);
                if (!c) return;
                const invalidReasons = [];
                if (!c.name || c.name.trim() === "" || c.name === "Unnamed Class") invalidReasons.push("Nama kelas kosong");
                if (!c.mentor_name || c.mentor_name.trim() === "" || c.mentor_name === "Unknown") invalidReasons.push("Mentor belum ditentukan");
                if (!c.start_date || c.start_date === "Flexible" || c.start_date.trim() === "") invalidReasons.push("Jadwal Flexible / Kosong");
                if (!c.max_seat || c.max_seat <= 0) invalidReasons.push("Kapasitas kelas <= 0");

                if (invalidReasons.length > 0) {
                    planSummaryState.invalid.push({ ...c, reason: invalidReasons.join(", ") });
                } else {
                    planSummaryState.valid.push(c);
                }
            });

            renderPlanSummaryModal(planSummaryState);
            openModal("planConfirmModal");
        });
    }

    if (confirmPlanMoveBtn) {
        confirmPlanMoveBtn.addEventListener("click", async () => {
            if (planSummaryState.valid.length === 0) return;

            confirmPlanMoveBtn.disabled = true;
            confirmPlanMoveBtn.textContent = "Memindahkan...";

            let successCount = 0;
            for (const c of planSummaryState.valid) {
                try {
                    await moveToClassPlanning(c);
                    c.is_planned = true;
                    successCount++;
                } catch (err) {
                    console.error("Gagal memindahkan kelas ke perencanaan:", c.name, err);
                }
            }

            showToast(`Berhasil memindahkan ${successCount} kelas ke Perencanaan`, "success");
            selectedClassIds = [];
            closeModal("planConfirmModal");
            confirmPlanMoveBtn.disabled = false;
            renderView();
        });
    }

    // 14. Search, Filter, and Sort Bindings
    if (searchInput) {
        let debounceTimer = null;
        searchInput.addEventListener("input", (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                searchQuery = e.target.value;
                currentPage = 1;
                renderView();
            }, 250);
        });
    }

    if (filterTypeSelect) {
        filterTypeSelect.addEventListener("change", (e) => {
            filterType = e.target.value;
            currentPage = 1;
            renderView();
        });
    }

    if (filterStatusSelect) {
        filterStatusSelect.addEventListener("change", (e) => {
            filterStatus = e.target.value;
            currentPage = 1;
            renderView();
        });
    }

    if (sortBySelect) {
        sortBySelect.addEventListener("change", (e) => {
            sortBy = e.target.value;
            currentPage = 1;
            renderView();
        });
    }

    if (toggleSortBtn) {
        toggleSortBtn.addEventListener("click", () => {
            sortDirection = sortDirection === "asc" ? "desc" : "asc";
            const ascIcon = toggleSortBtn.querySelector(".icon-sort-asc");
            const descIcon = toggleSortBtn.querySelector(".icon-sort-desc");
            if (ascIcon && descIcon) {
                if (sortDirection === "asc") {
                    ascIcon.classList.remove("hidden");
                    descIcon.classList.add("hidden");
                } else {
                    ascIcon.classList.add("hidden");
                    descIcon.classList.remove("hidden");
                }
            }
            currentPage = 1;
            renderView();
        });
    }

refactor/marketing/class-availability

    // =========================================================================
    // IMPORT SPREADSHEET ORCHESTRATION
    // =========================================================================
    let importedMatrixState = null;
    let parsedBatchesState = [];

    const importDropzone = document.getElementById("importDropzone");
    const spreadsheetFileInput = document.getElementById("spreadsheetFileInput");
    const selectedFileNameBadge = document.getElementById("selectedFileNameBadge");
    const selectedFileNameText = document.getElementById("selectedFileNameText");
    const cfgMaxSeatOffline = document.getElementById("cfgMaxSeatOffline");
    const cfgMaxSeatOnline = document.getElementById("cfgMaxSeatOnline");
    const cfgDpOffline = document.getElementById("cfgDpOffline");
    const cfgDpOnline = document.getElementById("cfgDpOnline");
    const cfgAppendLocationToName = document.getElementById("cfgAppendLocationToName");
    const importPreviewSection = document.getElementById("importPreviewSection");
    const importEmptyState = document.getElementById("importEmptyState");
    const previewCountBadge = document.getElementById("previewCountBadge");
    const importPreviewTbody = document.getElementById("importPreviewTbody");
    const btnExecuteImport = document.getElementById("btnExecuteImport");
    const btnExecuteImportText = document.getElementById("btnExecuteImportText");

    function reevaluateImportData() {
        if (!importedMatrixState) return;
        const maxSeatOffline = Number(cfgMaxSeatOffline?.value) || 7;
        const maxSeatOnline = Number(cfgMaxSeatOnline?.value) || 10;
        const dpOffline = parseCurrency(cfgDpOffline?.value || "500.000");
        const dpOnline = parseCurrency(cfgDpOnline?.value || "300.000");
        const appendLocation = Boolean(cfgAppendLocationToName?.checked);

        parsedBatchesState = parseSpreadsheetMatrix(importedMatrixState, {
            defaultMaxSeatOffline: maxSeatOffline,
            defaultMaxSeatOnline: maxSeatOnline,
            defaultDpOffline: dpOffline,
            defaultDpOnline: dpOnline,
            appendLocationToName: appendLocation,
            products: productsState,
            mentors: mentorsState
        });

        if (parsedBatchesState.length > 0) {
            if (importPreviewSection) importPreviewSection.classList.remove("hidden");
            if (importEmptyState) importEmptyState.classList.add("hidden");
            if (btnExecuteImport) {
                btnExecuteImport.disabled = false;
                btnExecuteImport.classList.remove("opacity-50", "cursor-not-allowed");
            }
            if (btnExecuteImportText) {
                btnExecuteImportText.textContent = `Import ${parsedBatchesState.length} Data Kelas`;
            }
        } else {
            if (importPreviewSection) importPreviewSection.classList.add("hidden");
            if (importEmptyState) {
                importEmptyState.classList.remove("hidden");
                importEmptyState.innerHTML = '<p class="mb-0 text-amber-600 font-medium">Tidak ada baris data kelas yang valid ditemukan dalam sheet.</p>';
            }
            if (btnExecuteImport) {
                btnExecuteImport.disabled = true;
                btnExecuteImport.classList.add("opacity-50", "cursor-not-allowed");
            }
        }

        renderImportPreview({
            container: importPreviewTbody,
            countBadge: previewCountBadge,
            items: parsedBatchesState,
            onRemoveItem: (removeIdx) => {
                parsedBatchesState.splice(removeIdx, 1);
                if (btnExecuteImportText) {
                    btnExecuteImportText.textContent = `Import ${parsedBatchesState.length} Data Kelas`;
                }
                if (parsedBatchesState.length === 0 && btnExecuteImport) {
                    btnExecuteImport.disabled = true;
                    btnExecuteImport.classList.add("opacity-50", "cursor-not-allowed");
                }
                renderImportPreview({
                    container: importPreviewTbody,
                    countBadge: previewCountBadge,
                    items: parsedBatchesState,
                    onRemoveItem: (nextIdx) => {
                        parsedBatchesState.splice(nextIdx, 1);
                        reevaluateImportData();
                    }
                });
            }
        });
    }

    async function processSpreadsheetFile(file) {
        if (!file) return;
        const validExtensions = [".xlsx", ".xls", ".csv"];
        const fileName = file.name.toLowerCase();
        const hasValidExt = validExtensions.some(ext => fileName.endsWith(ext));
        if (!hasValidExt) {
            showToast("Hanya file .xlsx, .xls, atau .csv yang didukung!", "error");
            return;
        }

        if (selectedFileNameBadge && selectedFileNameText) {
            selectedFileNameText.textContent = file.name;
            selectedFileNameBadge.classList.remove("hidden");
        }

        try {
            if (typeof window.XLSX === "undefined") {
                showToast("Library pembaca spreadsheet (XLSX) sedang dimuat, coba lagi...", "error");
                return;
            }

            const data = await file.arrayBuffer();
            const workbook = window.XLSX.read(data, { type: "array" });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const matrix = window.XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

            importedMatrixState = matrix;
            reevaluateImportData();
            showToast(`File ${file.name} berhasil dibaca (${parsedBatchesState.length} kelas ditemukan)`, "success");
        } catch (err) {
            console.error("Gagal membaca file spreadsheet:", err);
            showToast("Gagal membaca file spreadsheet. Pastikan format file valid.", "error");
        }
    }

    if (importDropzone && spreadsheetFileInput) {
        importDropzone.addEventListener("click", () => spreadsheetFileInput.click());

        spreadsheetFileInput.addEventListener("change", (e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
                processSpreadsheetFile(files[0]);
            }
        });

        importDropzone.addEventListener("dragover", (e) => {
            e.preventDefault();
            importDropzone.classList.add("border-indigo-500", "bg-indigo-100/50");
        });

        importDropzone.addEventListener("dragleave", (e) => {
            e.preventDefault();
            importDropzone.classList.remove("border-indigo-500", "bg-indigo-100/50");
        });

        importDropzone.addEventListener("drop", (e) => {
            e.preventDefault();
            importDropzone.classList.remove("border-indigo-500", "bg-indigo-100/50");
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                processSpreadsheetFile(files[0]);
            }
        });
    }

    // Config inputs live change
    [cfgMaxSeatOffline, cfgMaxSeatOnline, cfgDpOffline, cfgDpOnline, cfgAppendLocationToName].forEach(input => {
        if (input) {
            input.addEventListener("input", reevaluateImportData);
            input.addEventListener("change", reevaluateImportData);
        }
    });

    if (btnExecuteImport) {
        btnExecuteImport.addEventListener("click", async () => {
            if (!parsedBatchesState || parsedBatchesState.length === 0) {
                showToast("Tidak ada batch yang dapat diimpor", "error");
                return;
            }

            const total = parsedBatchesState.length;
            btnExecuteImport.disabled = true;
            btnExecuteImport.innerHTML = `
                <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                <span>Menyimpan ${total} Batch ke Firebase...</span>
            `;

            try {
                await addMultipleClassBatches(parsedBatchesState);
                showToast(`Sukses! ${total} batch kelas berhasil ditambahkan ke Firebase`, "success");

                // Refresh data from Firestore
                try {
                    const refreshed = await fetchClassAvailability();
                    if (refreshed && refreshed.length > 0) {
                        classesState = refreshed;
                    }
                } catch (loadErr) {
                    console.warn("Gagal merefresh langsung dari Firestore:", loadErr);
                }

                currentPage = 1;
                renderView();

                // Close modal & reset state
                closeModal("importSpreadsheetModal");
                importedMatrixState = null;
                parsedBatchesState = [];
                if (spreadsheetFileInput) spreadsheetFileInput.value = "";
                if (selectedFileNameBadge) selectedFileNameBadge.classList.add("hidden");
                if (importPreviewSection) importPreviewSection.classList.add("hidden");
                if (importEmptyState) importEmptyState.classList.remove("hidden");
            } catch (err) {
                console.error("Gagal mengimpor batch:", err);
                showToast("Gagal menyimpan batch ke Firebase: " + (err.message || err), "error");
            } finally {
                btnExecuteImport.disabled = false;
                btnExecuteImport.innerHTML = `
                    <i class="bi bi-cloud-check me-1"></i>
                    <span id="btnExecuteImportText">Import Data Kelas</span>
                `;

    // 14b. Export Data Controls
    const exportControls = initClassExportModal();
    const exportForm = document.getElementById("exportClassForm");
    if (exportForm && exportControls) {
        exportForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            exportControls.setLoading(true);
            try {
                const formData = exportControls.getFormData();
                await exportClassData(formData);
                const modalEl = document.getElementById("exportClassModal");
                if (modalEl && window.bootstrap) {
                    bootstrap.Modal.getInstance(modalEl)?.hide();
                }
            } catch (err) {
                console.error("Export class availability error:", err);
                showToast("Gagal mengekspor data ketersediaan kelas: " + err.message, "danger");
            } finally {
                exportControls.setLoading(false);
main
            }
        });
    }

    // 15. Initial Load
    async function loadData() {
        if (loadingState) loadingState.style.display = "block";
        if (listContainer) listContainer.style.display = "none";

        try {
            const [classes, products, mentors] = await Promise.all([
                fetchClassAvailability(),
                fetchProducts(),
                fetchMentors()
            ]);

            classesState = classes && classes.length > 0 ? classes : FALLBACK_CLASSES;
            productsState = products || [];

            // Gunakan daftar mentor resmi dari database jika ada; jika kosong, baru fallback dari data kelas
            if (mentors && mentors.length > 0) {
                mentorsState = mentors;
            } else {
                const mentorMap = new Map();
                classesState.forEach(c => {
                    if (c.mentor_name && c.mentor_name !== "Unknown" && c.mentor_name !== "-" && !mentorMap.has(c.mentor_name)) {
                        mentorMap.set(c.mentor_name, { id: c.mentor_name, name: c.mentor_name });
                    }
                });
                mentorsState = Array.from(mentorMap.values()).sort((a, b) => a.name.localeCompare(b.name, "id"));
            }

            // Pre-populate Add Batch dropdowns
            populateProductDropdown(newBatchProductSelect, productsState, "", true);
            populateMentorDropdown(newBatchMentorSelect, mentorsState, "Unknown");
        } catch (error) {
            console.error("Gagal memuat data Firestore, beralih ke Fallback:", error);
            classesState = FALLBACK_CLASSES;
            showToast("Memuat data dalam mode offline", "info");
        } finally {
            if (loadingState) loadingState.style.display = "none";
            if (listContainer) listContainer.style.display = "block";
            renderView();
        }
    }

    loadData();
});
