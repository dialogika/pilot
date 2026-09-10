/**
 * Referral Dashboard Orchestrator / Controller
 * Connects Auth Guard, App Shell Mounts, Repository, and UI modules.
 */

import { requireAuth } from "../../../assets/js/auth-guard.js";
import { renderTopBar } from "../../../element/topbar.js";
import { renderSidebar } from "../../../element/sidebar.js";
import { confirmDialog, alertDialog } from "../../../assets/js/ui.js";
import {
    FIRST_CLASS_FEATURES,
    fetchProducts,
    fetchReferrals,
    saveReferrals,
    fetchInvoices,
    getSavedExcludedFeatures,
    saveExcludedFeatures,
    saveReferralFeatConfigToStorage,
    removeReferralFeatConfigFromStorage
} from "./referral-dashboard.repository.js";
import {
    formatCurrency,
    formatNumber,
    renderHeaderStats,
    renderProductDropdown,
    toggleProductDropdown,
    renderProductOverview,
    renderCurriculum,
    renderHighlights,
    renderDraggableFeatures,
    setupDragAndDrop,
    getExcludedKeysFromDOM,
    openRefFeatDrawer,
    closeRefFeatDrawer,
    populateRefFeatDropdown,
    renderRefFeatChecklist,
    renderRefFeatSavedList,
    openReferralModal,
    closeReferralModal,
    populateProductCheckboxes,
    populateCreationFeatureChecklist,
    populateEditReferralForm,
    resetReferralForm,
    showReferralStatus,
    openReferralListModal,
    closeReferralListModal,
    renderReferralTable,
    checkAndShowSystemDefaultPopup,
    closeSysDefaultPopup
} from "./referral-dashboard.ui.js";

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Centralized Auth Guard
    const user = await requireAuth();
    if (!user) return;

    // 2. Mount App Shell Components
    const topbarMount = document.getElementById("dg-topbar-mount");
    if (topbarMount) renderTopBar(topbarMount);

    const sidebarMount = document.getElementById("dg-sidebar-mount");
    if (sidebarMount) renderSidebar(sidebarMount);

    // 3. Local Feature State
    let productsState = [];
    let selectedProductId = null;
    let referralsState = [];
    let invoicesState = [];
    let selectedProductsInCreation = [];
    let refFilterStatus = "all";
    let refSearchKeyword = "";
    let activeFeaturesPage = 1;
    const activePageSize = 5;

    // 4. Initialization Routine
    async function initFeature() {
        // Fetch products and referrals in parallel
        const [products, referrals, invoices] = await Promise.all([
            fetchProducts(),
            fetchReferrals(),
            fetchInvoices()
        ]);

        productsState = products;
        referralsState = referrals;
        invoicesState = invoices;

        if (productsState.length > 0) {
            selectedProductId = productsState[0].productId;
        }

        // Render Initial UI Views
        refreshHeaderStats();
        refreshProductDropdown();
        refreshSelectedProductView();

        // Check for duplicate system defaults after data load
        setTimeout(() => {
            checkAndShowSystemDefaultPopup(referralsState, () => {
                openReferralListModal();
                refreshReferralTable();
            });
        }, 1000);
    }

    // Refresh UI Helpers
    function refreshHeaderStats() {
        renderHeaderStats(referralsState, invoicesState);
    }

    function refreshProductDropdown() {
        renderProductDropdown(productsState, selectedProductId, (newProductId) => {
            selectedProductId = newProductId;
            toggleProductDropdown(true);
            refreshProductDropdown();
            refreshSelectedProductView();
        });
    }

    function refreshSelectedProductView() {
        const product = productsState.find((p) => p.productId === selectedProductId) || productsState[0];
        if (!product) return;

        // Ensure features match standard list
        product.features = FIRST_CLASS_FEATURES;

        renderProductOverview(product);
        renderCurriculum(product.curriculum);
        renderHighlights(product);

        // Load saved excluded keys for drag and drop with pagination
        const savedExcluded = getSavedExcludedFeatures();
        renderDraggableFeatures({
            features: FIRST_CLASS_FEATURES,
            savedExcludedKeys: savedExcluded,
            activePage: activeFeaturesPage,
            activePageSize,
            onActivePageChange: (newPage) => {
                activeFeaturesPage = newPage;
                refreshSelectedProductView();
            }
        });
    }

    function refreshReferralTable() {
        renderReferralTable(
            referralsState,
            invoicesState,
            refFilterStatus,
            refSearchKeyword,
            (historyId) => {
                const row = document.getElementById(historyId);
                if (row) row.classList.toggle("hidden");
            },
            (referralItem) => {
                // Edit referral
                closeReferralListModal();
                openReferralModal();
                selectedProductsInCreation = Array.isArray(referralItem.products) ? [...referralItem.products] : [];
                populateProductCheckboxes(productsState, selectedProductsInCreation, handleProductCheckboxToggle);
                populateCreationFeatureChecklist(FIRST_CLASS_FEATURES, referralItem.excludedFeatures || []);
                populateEditReferralForm(referralItem, productsState);
            },
            async (referralItem, index) => {
                // Delete referral
                const confirmed = await confirmDialog(`Hapus kode referral "${referralItem.code || "-"}"?`, {
                    title: "Hapus Referral",
                    confirmText: "Ya, Hapus"
                });
                if (confirmed) {
                    referralsState.splice(index, 1);
                    await saveReferrals(referralsState);
                    refreshHeaderStats();
                    refreshReferralTable();
                }
            }
        );
    }

    // 5. Setup Drag & Drop Zone Handlers
    setupDragAndDrop((featKey, isExcluding) => {
        let savedExcluded = getSavedExcludedFeatures();
        if (isExcluding) {
            if (!savedExcluded.includes(featKey)) {
                savedExcluded.push(featKey);
            }
        } else {
            savedExcluded = savedExcluded.filter((k) => k !== featKey);
        }
        saveExcludedFeatures(savedExcluded);
        refreshSelectedProductView();
    });

    // 6. Product Dropdown Button & Backdrop Listeners
    const productDropdownBtn = document.getElementById("productDropdownBtn");
    const productDropdownBackdrop = document.getElementById("productDropdownBackdrop");
    if (productDropdownBtn) {
        productDropdownBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleProductDropdown();
        });
    }
    if (productDropdownBackdrop) {
        productDropdownBackdrop.addEventListener("click", () => {
            toggleProductDropdown(true);
        });
    }

    // 7. Drawer: "Set Fitur per Referral" Handlers
    const btnSetReferralFeatures = document.getElementById("btnSetReferralFeatures");
    const refFeatOverlay = document.getElementById("refFeatOverlay");
    const btnCloseRefFeat = document.getElementById("btnCloseRefFeat");
    const refFeatCodeSelect = document.getElementById("refFeatCodeSelect");
    const refFeatSaveBtn = document.getElementById("refFeatSaveBtn");
    const btnResetRefFeatConfig = document.getElementById("btnResetRefFeatConfig");

    if (btnSetReferralFeatures) {
        btnSetReferralFeatures.addEventListener("click", () => {
            populateRefFeatDropdown(referralsState);
            openRefFeatDrawer();
            renderRefFeatSavedList(referralsState, FIRST_CLASS_FEATURES, (refItem) => {
                // Preview saved config in drag & drop zones
                saveExcludedFeatures(refItem.excludedFeatures || []);
                closeRefFeatDrawer();
                refreshSelectedProductView();
            });
        });
    }

    if (refFeatOverlay) refFeatOverlay.addEventListener("click", closeRefFeatDrawer);
    if (btnCloseRefFeat) btnCloseRefFeat.addEventListener("click", closeRefFeatDrawer);

    if (refFeatCodeSelect) {
        refFeatCodeSelect.addEventListener("change", () => {
            const code = refFeatCodeSelect.value;
            if (!code) {
                renderRefFeatChecklist(FIRST_CLASS_FEATURES, []);
                const empty = document.getElementById("refFeatEmpty");
                const wrap = document.getElementById("refFeatChecklistWrap");
                const saveBtn = document.getElementById("refFeatSaveBtn");
                if (empty) empty.classList.remove("hidden");
                if (wrap) wrap.classList.add("hidden");
                if (saveBtn) saveBtn.disabled = true;
                return;
            }

            const refItem = referralsState.find((r) => r.code === code);
            const excluded = refItem && Array.isArray(refItem.excludedFeatures) ? refItem.excludedFeatures : [];
            renderRefFeatChecklist(FIRST_CLASS_FEATURES, excluded);
        });
    }

    if (refFeatSaveBtn) {
        refFeatSaveBtn.addEventListener("click", async () => {
            const code = refFeatCodeSelect ? refFeatCodeSelect.value : "";
            if (!code) return;

            const checkboxes = document.querySelectorAll("#refFeatChecklist input[type=checkbox]");
            const excluded = [];
            checkboxes.forEach((cb) => {
                if (!cb.checked) excluded.push(cb.value);
            });

            const refIndex = referralsState.findIndex((r) => r.code === code);
            if (refIndex < 0) return;

            const origContent = refFeatSaveBtn.innerHTML;
            refFeatSaveBtn.disabled = true;
            refFeatSaveBtn.innerHTML = '<i class="bi bi-hourglass-split animate-spin"></i> Menyimpan...';

            try {
                referralsState[refIndex].excludedFeatures = excluded;
                saveReferralFeatConfigToStorage(code, excluded);
                await saveReferrals(referralsState);

                refFeatSaveBtn.innerHTML = '<i class="bx bx-check-circle mr-1"></i>Tersimpan!';
                refFeatSaveBtn.classList.add("bg-emerald-600");
                refFeatSaveBtn.classList.remove("bg-indigo-600");

                setTimeout(() => {
                    refFeatSaveBtn.innerHTML = origContent;
                    refFeatSaveBtn.classList.remove("bg-emerald-600");
                    refFeatSaveBtn.classList.add("bg-indigo-600");
                    refFeatSaveBtn.disabled = false;
                }, 1800);

                renderRefFeatSavedList(referralsState, FIRST_CLASS_FEATURES, (refItem) => {
                    saveExcludedFeatures(refItem.excludedFeatures || []);
                    closeRefFeatDrawer();
                    refreshSelectedProductView();
                });
            } catch (err) {
                console.error("Save config error:", err);
                refFeatSaveBtn.innerHTML = '<i class="bi bi-exclamation-triangle"></i> Gagal!';
                setTimeout(() => {
                    refFeatSaveBtn.innerHTML = origContent;
                    refFeatSaveBtn.disabled = false;
                }, 1800);
            }
        });
    }

    if (btnResetRefFeatConfig) {
        btnResetRefFeatConfig.addEventListener("click", async () => {
            const code = refFeatCodeSelect ? refFeatCodeSelect.value : "";
            if (!code) return;

            const refIndex = referralsState.findIndex((r) => r.code === code);
            if (refIndex >= 0) {
                referralsState[refIndex].excludedFeatures = [];
                removeReferralFeatConfigFromStorage(code);
                await saveReferrals(referralsState);
            }
            renderRefFeatChecklist(FIRST_CLASS_FEATURES, []);
            renderRefFeatSavedList(referralsState, FIRST_CLASS_FEATURES, (refItem) => {
                saveExcludedFeatures(refItem.excludedFeatures || []);
                closeRefFeatDrawer();
                refreshSelectedProductView();
            });
        });
    }

    // 8. Modal: "Create & Edit Referral" Handlers
    const btnOpenReferralModal = document.getElementById("btnOpenReferralModal");
    const btnCloseReferralModal = document.getElementById("btnCloseReferralModal");
    const referralModal = document.getElementById("referralModal");
    const btnSaveReferral = document.getElementById("btnSaveReferralDashboard");
    const btnResetReferral = document.getElementById("btnResetReferralForm");
    const holderType = document.getElementById("rdRefHolderType");
    const functionType = document.getElementById("rdRefFunctionType");
    const ownerWrapper = document.getElementById("rdRefOwnerNameWrapper");
    const discountWrapper = document.getElementById("rdRefDiscountWrapper");
    const productDropdownToggle = document.getElementById("rdRefProductDropdown");
    const productOptions = document.getElementById("rdRefProductOptions");
    const discountPercentField = document.getElementById("rdRefDiscountPercent");
    const discountAmountField = document.getElementById("rdRefDiscountAmount");
    const btnCalc = document.getElementById("btnOpenDiscountCalculator");

    function handleProductCheckboxToggle(productId, isChecked) {
        if (isChecked) {
            if (!selectedProductsInCreation.includes(productId)) selectedProductsInCreation.push(productId);
        } else {
            selectedProductsInCreation = selectedProductsInCreation.filter((id) => id !== productId);
        }
        populateProductCheckboxes(productsState, selectedProductsInCreation, handleProductCheckboxToggle);
        calculateDiscountSync("percent");
    }

    function calculateDiscountSync(source) {
        if (!discountPercentField || !discountAmountField) return;

        let totalBasePrice = 0;
        selectedProductsInCreation.forEach((id) => {
            const p = productsState.find((x) => x.productId === id);
            if (p && p.basePrice) totalBasePrice += Number(p.basePrice) || 0;
        });

        if (totalBasePrice === 0) return;

        if (source === "percent") {
            const pct = parseFloat(discountPercentField.value);
            if (!isNaN(pct) && pct >= 0) {
                const amt = Math.round(totalBasePrice * (pct / 100));
                discountAmountField.value = formatNumber(amt);
            }
        } else if (source === "amount") {
            const valStr = discountAmountField.value.replace(/\D/g, "");
            const amt = parseInt(valStr, 10);
            if (!isNaN(amt) && amt >= 0) {
                const pct = (amt / totalBasePrice) * 100;
                discountPercentField.value = parseFloat(pct.toFixed(2));
            }
        }
    }

    if (discountPercentField) {
        discountPercentField.addEventListener("input", () => calculateDiscountSync("percent"));
    }
    if (discountAmountField) {
        discountAmountField.addEventListener("input", (e) => {
            const raw = e.target.value.replace(/\D/g, "");
            if (raw) {
                e.target.value = formatNumber(parseInt(raw, 10));
            }
            calculateDiscountSync("amount");
        });
    }

    if (btnCalc) {
        btnCalc.addEventListener("click", () => {
            let totalBasePrice = 0;
            selectedProductsInCreation.forEach((id) => {
                const p = productsState.find((x) => x.productId === id);
                if (p && p.basePrice) totalBasePrice += Number(p.basePrice) || 0;
            });

            if (totalBasePrice === 0) {
                alertDialog("Pilih produk terlebih dahulu untuk menghitung diskon otomatis.", {
                    title: "Informasi",
                    type: "warning"
                });
                return;
            }
            alertDialog(`Total Harga Dasar Produk Terpilih: ${formatCurrency(totalBasePrice)}\n\nMasukkan Persentase atau Nilai Potongan untuk menghitung otomatis.`, {
                title: "Kalkulator Diskon",
                type: "info"
            });
        });
    }

    if (holderType && ownerWrapper) {
        holderType.addEventListener("change", () => {
            ownerWrapper.classList.toggle("hidden", holderType.value !== "user");
        });
    }

    if (functionType && discountWrapper) {
        functionType.addEventListener("change", () => {
            const isDiscount = functionType.value === "discount";
            discountWrapper.classList.toggle("hidden", !isDiscount);
            if (btnCalc) btnCalc.classList.toggle("hidden", !isDiscount);
        });
    }

    if (productDropdownToggle && productOptions) {
        productDropdownToggle.addEventListener("click", () => {
            productOptions.classList.toggle("hidden");
        });
    }

    if (btnOpenReferralModal) {
        btnOpenReferralModal.addEventListener("click", () => {
            resetReferralForm();
            selectedProductsInCreation = [];
            populateProductCheckboxes(productsState, selectedProductsInCreation, handleProductCheckboxToggle);
            populateCreationFeatureChecklist(FIRST_CLASS_FEATURES, []);
            openReferralModal();
        });
    }

    if (btnCloseReferralModal) btnCloseReferralModal.addEventListener("click", closeReferralModal);
    if (referralModal) {
        referralModal.addEventListener("click", (e) => {
            if (e.target === referralModal || e.target.classList.contains("bg-opacity-75")) {
                closeReferralModal();
            }
        });
    }

    if (btnResetReferral) {
        btnResetReferral.addEventListener("click", () => {
            resetReferralForm();
            selectedProductsInCreation = [];
            populateProductCheckboxes(productsState, selectedProductsInCreation, handleProductCheckboxToggle);
            populateCreationFeatureChecklist(FIRST_CLASS_FEATURES, []);
        });
    }

    // Toggle All Benefit Buttons
    const btnCheckAllCreation = document.getElementById("btnCheckAllCreation");
    const btnUncheckAllCreation = document.getElementById("btnUncheckAllCreation");
    if (btnCheckAllCreation) {
        btnCheckAllCreation.addEventListener("click", () => {
            const checks = document.querySelectorAll("#creationRefFeatChecklist input[type=checkbox]");
            checks.forEach((cb) => {
                cb.checked = true;
                cb.dispatchEvent(new Event("change"));
            });
        });
    }
    if (btnUncheckAllCreation) {
        btnUncheckAllCreation.addEventListener("click", () => {
            const checks = document.querySelectorAll("#creationRefFeatChecklist input[type=checkbox]");
            checks.forEach((cb) => {
                cb.checked = false;
                cb.dispatchEvent(new Event("change"));
            });
        });
    }

    // Save Referral Handler
    if (btnSaveReferral) {
        btnSaveReferral.addEventListener("click", async () => {
            const code = (document.getElementById("rdRefCode")?.value || "").trim().toUpperCase();
            if (!code) {
                showReferralStatus("Kode referral wajib diisi!", true);
                return;
            }
            if (!selectedProductsInCreation.length) {
                showReferralStatus("Pilih minimal 1 produk!", true);
                return;
            }
            const fType = functionType?.value || "";
            if (!fType) {
                showReferralStatus("Pilih fungsi referral!", true);
                return;
            }

            btnSaveReferral.disabled = true;
            btnSaveReferral.innerHTML = '<i class="bi bi-hourglass-split animate-spin"></i> Menyimpan...';

            try {
                const now = Date.now();
                const monthsValid = parseInt(document.getElementById("rdRefMonthsValid")?.value || "2", 10) || 2;
                const expiresAt = now + (monthsValid * 30 * 24 * 60 * 60 * 1000);

                const featChecks = document.querySelectorAll("#creationRefFeatChecklist input[type=checkbox]");
                const excludedKeys = [];
                featChecks.forEach((cb) => {
                    if (!cb.checked) excludedKeys.push(cb.value);
                });

                const payload = {
                    code,
                    holderType: holderType?.value || "system",
                    ownerName: (document.getElementById("rdRefOwnerName")?.value || "").trim(),
                    products: [...selectedProductsInCreation],
                    functionType: fType,
                    discountPercent: parseFloat(document.getElementById("rdRefDiscountPercent")?.value || "0") || 0,
                    discountAmount: parseInt((document.getElementById("rdRefDiscountAmount")?.value || "0").replace(/\D/g, ""), 10) || 0,
                    maxUsage: parseInt(document.getElementById("rdRefMaxUsage")?.value || "10", 10) || 10,
                    usedCount: parseInt(document.getElementById("rdRefUsedCount")?.value || "0", 10) || 0,
                    monthsValid,
                    createdAt: now,
                    createdAtMs: now,
                    expiresAt,
                    excludedFeatures: excludedKeys
                };

                saveReferralFeatConfigToStorage(code, excludedKeys);

                const dupIndex = referralsState.findIndex((r) => (r.code || "").toUpperCase() === code);
                if (dupIndex >= 0) {
                    referralsState[dupIndex] = {
                        ...referralsState[dupIndex],
                        ...payload,
                        createdAt: referralsState[dupIndex].createdAt || now,
                        createdAtMs: referralsState[dupIndex].createdAtMs || now
                    };
                } else {
                    referralsState.push(payload);
                }

                const ok = await saveReferrals(referralsState);
                if (ok) {
                    showReferralStatus(dupIndex >= 0 ? "Referral berhasil diupdate!" : "Referral berhasil disimpan!", false);
                    resetReferralForm();
                    closeReferralModal();
                    refreshHeaderStats();
                    refreshReferralTable();
                } else {
                    showReferralStatus("Gagal menyimpan ke Firestore", true);
                }
            } catch (err) {
                console.error("Error saving referral:", err);
                showReferralStatus("Error: " + err.message, true);
            } finally {
                btnSaveReferral.disabled = false;
                btnSaveReferral.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan Referral';
            }
        });
    }

    // 9. Modal: "Daftar Referral" Handlers
    const btnOpenReferralListModal = document.getElementById("btnOpenReferralListModal");
    const btnCloseReferralListModal = document.getElementById("btnCloseReferralListModal");
    const referralListModal = document.getElementById("referralListModal");
    const refSearchInput = document.getElementById("refSearchInput");
    const filterButtons = document.querySelectorAll(".ref-filter-btn");

    if (btnOpenReferralListModal) {
        btnOpenReferralListModal.addEventListener("click", () => {
            openReferralListModal();
            refreshReferralTable();
        });
    }

    if (btnCloseReferralListModal) btnCloseReferralListModal.addEventListener("click", closeReferralListModal);
    if (referralListModal) {
        referralListModal.addEventListener("click", (e) => {
            if (e.target.classList.contains("bg-opacity-75")) {
                closeReferralListModal();
            }
        });
    }

    if (filterButtons.length) {
        filterButtons.forEach((btn) => {
            btn.addEventListener("click", function () {
                refFilterStatus = this.getAttribute("data-ref-filter") || "all";
                filterButtons.forEach((b) => {
                    b.classList.remove("bg-white", "border-slate-200", "shadow-sm", "text-emerald-600", "text-red-500", "border");
                    b.classList.add("text-slate-400");
                });

                this.classList.remove("text-slate-400");
                if (refFilterStatus === "all") {
                    this.classList.add("bg-white", "border", "border-slate-200", "shadow-sm");
                } else if (refFilterStatus === "active") {
                    this.classList.add("text-emerald-600");
                } else if (refFilterStatus === "expired") {
                    this.classList.add("text-red-500");
                }
                refreshReferralTable();
            });
        });
    }

    if (refSearchInput) {
        refSearchInput.addEventListener("input", function () {
            refSearchKeyword = this.value;
            refreshReferralTable();
        });
    }

    // 10. System Default Conflict Popup Close
    const btnCloseSysDefault = document.getElementById("btnCloseSysDefault");
    if (btnCloseSysDefault) {
        btnCloseSysDefault.addEventListener("click", closeSysDefaultPopup);
    }

    // Start feature init
    await initFeature();
});
