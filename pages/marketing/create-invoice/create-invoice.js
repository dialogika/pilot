/**
 * create-invoice.js
 * Feature Controller / Orchestrator for Create Invoice / Invoice Center.
 */

import { renderTopBar } from "/element/topbar.js";
import { renderSidebar } from "/element/sidebar.js";
import { requireAuth } from "/assets/js/auth-guard.js";
import { confirmDialog, alertDialog } from "/assets/js/ui.js";
import {
  fetchInvoices,
  saveInvoice,
  deleteInvoice,
  updateInvoiceVerification,
  fetchClassAvailability,
  fetchProducts,
  fetchProductDetail,
  fetchBanks,
  saveBanks,
  fetchReferrals,
  saveReferrals,
  loadSettingsLocal,
  saveSettingsLocal,
} from "./create-invoice.repository.js";
import {
  switchTab,
  updateStats,
  populateClassDropdown,
  populateProductDropdown,
  populateReferralProductOptions,
  updateReferralProductSummary,
  updateDpLabel,
  updateLocationVisibility,
  fillInvoiceForm,
  renderInvoiceTable,
  renderReceiptTable,
  populateReceiptReferralFilter,
  renderReferrals,
  renderBanks,
  openCopyLinkModal,
  closeCopyLinkModal,
  copyInvoiceLink,
  openPaidInvoiceModal,
  closePaidInvoiceModal,
  openInvoiceViewModal,
  closeInvoiceViewModal,
  openPaymentViewModal,
  closePaymentViewModal,
  openDiscountCalculatorModal,
  closeDiscountCalculatorModal,
  formatNumberWithDotsStr,
  parseFormattedNumberStr,
  formatDateForInput,
  formatDateRangeLabel,
  getVerificationStatusMeta,
  normalizeUpper,
} from "./create-invoice.ui.js";

// ==========================================
// Module State
// ==========================================

let currentInvoices = [];
let currentClasses = [];
let currentProducts = [];
let currentBanks = [];
let currentReferrals = [];

let invoiceListKeyword = "";
let invoiceListDateFrom = "";
let invoiceListDateTo = "";
let invoiceListExpiryFilter = "all";
let invoiceListPageSize = 100;

let receiptFilterKeyword = "";
let receiptFilterStatus = "all";
let receiptFilterReferral = "all";
let receiptDateFrom = "";
let receiptDateTo = "";
let receiptPageSize = 100;

let refFilterStatus = "all";
let refSearchKeyword = "";

// ==========================================
// Refresh & Update Functions
// ==========================================

function updateInvoiceList() {
  renderInvoiceTable(currentInvoices, {
    keyword: invoiceListKeyword,
    dateFrom: invoiceListDateFrom,
    dateTo: invoiceListDateTo,
    expiryFilter: invoiceListExpiryFilter,
    pageSize: invoiceListPageSize,
  });
}

function updateReceiptList() {
  renderReceiptTable(
    currentInvoices,
    {
      keyword: receiptFilterKeyword,
      dateFrom: receiptDateFrom,
      dateTo: receiptDateTo,
      statusFilter: receiptFilterStatus,
      referralFilter: receiptFilterReferral,
      pageSize: receiptPageSize,
    },
    currentReferrals
  );
}

function updateReferralList() {
  renderReferrals(currentReferrals, currentInvoices, {
    keyword: refSearchKeyword,
    filterStatus: refFilterStatus,
  });
}

function updateAllStats(classJoined = 0, classMax = 0) {
  const paidCount = currentInvoices.filter(
    (inv) =>
      (typeof inv.paidAtMs === "number" && inv.paidAtMs > 0) ||
      (typeof inv.paidAmount === "number" && inv.paidAmount > 0)
  ).length;

  const usedSet = new Set();
  currentInvoices.forEach((inv) => {
    const isPaid =
      (typeof inv.paidAtMs === "number" && inv.paidAtMs > 0) ||
      (typeof inv.paidAmount === "number" && inv.paidAmount > 0);
    if (isPaid) {
      const code = normalizeUpper(inv.referralCode || "");
      if (code) usedSet.add(code);
    }
  });

  const referralStat = `${usedSet.size}/${currentReferrals.length}`;
  const classStat = `${classJoined}/${classMax}`;

  updateStats({
    configuredInvoices: currentInvoices.length,
    classStat,
    referralStat,
    receiptCount: paidCount,
  });
}

// ==========================================
// Event Listeners Binding
// ==========================================

function bindEventListeners() {
  // 1. Tab Bar Navigation
  document.querySelectorAll(".tab-btn[data-tab-target]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-tab-target");
      if (targetId) switchTab(targetId);
    });
  });

  // 2. Stat Cards Click
  const invoiceStatCard = document.getElementById("invoiceStatCard");
  const classStatCard = document.getElementById("classStatCard");
  const receiptStatCard = document.getElementById("receiptStatCard");
  const tabBtnInvoiceList = document.getElementById("tabBtnInvoiceList");

  if (invoiceStatCard && tabBtnInvoiceList) {
    invoiceStatCard.addEventListener("click", () => tabBtnInvoiceList.click());
  }
  if (receiptStatCard) {
    receiptStatCard.addEventListener("click", () => openPaidInvoiceModal(currentInvoices));
  }
  if (classStatCard) {
    classStatCard.addEventListener("click", () => {
      window.open("/class-management", "_blank");
    });
  }

  // 3. Invoice Form Price & DP Inputs
  const basePriceField = document.getElementById("settingBasePrice");
  const dpField = document.getElementById("settingDpPercent");
  const classTypeField = document.getElementById("settingClassType");
  const classNameField = document.getElementById("settingClassName");
  const seatsField = document.getElementById("settingSeatsLeft");

  if (basePriceField) {
    basePriceField.addEventListener("input", () => {
      basePriceField.value = formatNumberWithDotsStr(basePriceField.value);
      updateDpLabel();
    });
  }
  if (dpField) {
    dpField.addEventListener("input", () => {
      dpField.value = formatNumberWithDotsStr(dpField.value);
      updateDpLabel();
    });
  }
  if (classTypeField) {
    classTypeField.addEventListener("change", updateLocationVisibility);
  }
  if (classNameField) {
    classNameField.addEventListener("change", () => {
      const name = classNameField.value;
      if (!seatsField) return;
      const match = currentClasses.find((c) => c.name === name);
      if (match && typeof match.seatsLeft === "number") {
        seatsField.value = match.seatsLeft;
      }
    });
  }

  // 4. Save Invoice Settings
  const btnSaveSettings = document.getElementById("btnSaveSettings");
  const statusSettings = document.getElementById("statusSettings");

  if (btnSaveSettings) {
    btnSaveSettings.addEventListener("click", async () => {
      const leadName = (document.getElementById("settingLeadName")?.value || "").trim();
      const className = (document.getElementById("settingClassName")?.value || "").trim();
      const batchLabel = (document.getElementById("settingBatchLabel")?.value || "").trim();
      const classType = (document.getElementById("settingClassType")?.value || "").trim();
      const location = (document.getElementById("settingLocation")?.value || "").trim();
      const productSelect = document.getElementById("settingProductName");
      const selectedProductId = productSelect ? productSelect.value || "" : "";
      const selectedProductName =
        productSelect && productSelect.selectedIndex > 0
          ? productSelect.options[productSelect.selectedIndex].text || ""
          : "";

      const invoiceIdField = document.getElementById("invoiceId");
      const existingId = (invoiceIdField?.value || "").trim();

      const basePrice = parseFormattedNumberStr(basePriceField?.value);
      const dpAmount = parseFormattedNumberStr(dpField?.value);
      let dpPercent = 0;
      if (basePrice > 0 && dpAmount > 0) {
        dpPercent = Math.round((dpAmount / basePrice) * 100);
      }

      let deadlineHours = parseInt(document.getElementById("settingDeadlineMinutes")?.value, 10) || 1;
      if (deadlineHours < 1) deadlineHours = 1;

      btnSaveSettings.disabled = true;
      btnSaveSettings.textContent = "Menyimpan...";

      let productDetail = null;
      if (selectedProductId) {
        productDetail = await fetchProductDetail(selectedProductId);
      }

      const data = {
        leadName,
        className,
        batchLabel,
        classType,
        location,
        seatsLeft: parseInt(document.getElementById("settingSeatsLeft")?.value, 10) || 0,
        deadlineMinutes: deadlineHours * 60,
        basePrice,
        dpPercent,
        dpAmount,
        productId: selectedProductId,
        productName: selectedProductName,
        productMaterials: productDetail?.materials || [],
        productFeatures: productDetail?.features || [],
        productSpecifications: productDetail?.specifications || [],
      };
      data.classMeta = [batchLabel, classType, location].filter(Boolean).join(" • ");

      saveSettingsLocal(data);

      try {
        const savedId = await saveInvoice(data, existingId);
        if (invoiceIdField) invoiceIdField.value = savedId;
        currentInvoices = await fetchInvoices();
        updateInvoiceList();
        updateReceiptList();
        updateAllStats();
        if (statusSettings) {
          statusSettings.textContent = "Tersimpan! Membuka link invoice...";
        }
        openCopyLinkModal(savedId);
      } catch (err) {
        console.error("Save invoice error:", err);
        if (statusSettings) {
          statusSettings.textContent = "Gagal menyimpan ke server, disimpan secara lokal.";
        }
        openCopyLinkModal(existingId || "");
      } finally {
        btnSaveSettings.disabled = false;
        btnSaveSettings.textContent = "Create Invoice";
        setTimeout(() => {
          if (statusSettings) statusSettings.textContent = "";
        }, 3000);
      }
    });
  }

  // 5. Invoice List Filters & Date Range Popover
  const invoiceSearchInput = document.getElementById("invoiceSearchInput");
  const invoiceDateFrom = document.getElementById("invoiceDateFrom");
  const invoiceDateTo = document.getElementById("invoiceDateTo");
  const invoiceExpiryFilter = document.getElementById("invoiceExpiryFilter");
  const invoicePageSize = document.getElementById("invoicePageSize");
  const invoiceDateRangeBtn = document.getElementById("invoiceDateRangeBtn");
  const invoiceDateRangePopover = document.getElementById("invoiceDateRangePopover");
  const invoiceDateRangeApply = document.getElementById("invoiceDateRangeApply");
  const invoiceDateRangeClear = document.getElementById("invoiceDateRangeClear");
  const invoiceDateRangeLabel = document.getElementById("invoiceDateRangeLabel");

  function updateInvoiceDateRangeLabelText() {
    if (invoiceDateRangeLabel) {
      invoiceDateRangeLabel.textContent = `Tanggal: ${formatDateRangeLabel(invoiceListDateFrom, invoiceListDateTo)}`;
    }
  }

  // Default 30 days
  if (invoiceDateFrom && invoiceDateTo) {
    const now = new Date();
    const fromDate = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    invoiceListDateFrom = formatDateForInput(fromDate);
    invoiceListDateTo = formatDateForInput(now);
    invoiceDateFrom.value = invoiceListDateFrom;
    invoiceDateTo.value = invoiceListDateTo;
    updateInvoiceDateRangeLabelText();
  }

  if (invoiceSearchInput) {
    invoiceSearchInput.addEventListener("input", (e) => {
      invoiceListKeyword = e.target.value || "";
      updateInvoiceList();
    });
  }
  if (invoiceExpiryFilter) {
    invoiceExpiryFilter.addEventListener("change", (e) => {
      invoiceListExpiryFilter = e.target.value || "all";
      updateInvoiceList();
    });
  }
  if (invoicePageSize) {
    invoicePageSize.addEventListener("change", (e) => {
      invoiceListPageSize = parseInt(e.target.value, 10) || 100;
      updateInvoiceList();
    });
  }
  if (invoiceDateRangeBtn && invoiceDateRangePopover) {
    invoiceDateRangeBtn.addEventListener("click", () => {
      invoiceDateRangePopover.classList.toggle("hidden");
    });
    document.addEventListener("click", (e) => {
      if (invoiceDateRangePopover.classList.contains("hidden")) return;
      if (!invoiceDateRangePopover.contains(e.target) && !invoiceDateRangeBtn.contains(e.target)) {
        invoiceDateRangePopover.classList.add("hidden");
      }
    });
  }
  if (invoiceDateRangeApply && invoiceDateRangePopover) {
    invoiceDateRangeApply.addEventListener("click", () => {
      invoiceListDateFrom = invoiceDateFrom?.value || "";
      invoiceListDateTo = invoiceDateTo?.value || "";
      updateInvoiceDateRangeLabelText();
      invoiceDateRangePopover.classList.add("hidden");
      updateInvoiceList();
    });
  }
  if (invoiceDateRangeClear && invoiceDateFrom && invoiceDateTo) {
    invoiceDateRangeClear.addEventListener("click", () => {
      invoiceDateFrom.value = "";
      invoiceDateTo.value = "";
      invoiceListDateFrom = "";
      invoiceListDateTo = "";
      updateInvoiceDateRangeLabelText();
      updateInvoiceList();
    });
  }

  // 6. Invoice Table Actions (View, Edit, Delete)
  const invoiceTableBody = document.getElementById("invoiceTableBody");
  if (invoiceTableBody) {
    invoiceTableBody.addEventListener("click", async (e) => {
      const target = e.target;
      const viewBtn = target.closest(".view-invoice");
      if (viewBtn) {
        const id = viewBtn.getAttribute("data-id");
        const inv = currentInvoices.find((x) => x.id === id);
        if (inv) openInvoiceViewModal(inv);
        return;
      }
      const editBtn = target.closest(".edit-invoice");
      if (editBtn) {
        const id = editBtn.getAttribute("data-id");
        const inv = currentInvoices.find((x) => x.id === id);
        if (inv) {
          fillInvoiceForm(inv);
          document.getElementById("tabBtnInvoiceSettings")?.click();
        }
        return;
      }
      const deleteBtn = target.closest(".delete-invoice");
      if (deleteBtn) {
        const id = deleteBtn.getAttribute("data-id");
        if (!id) return;
        const confirmed = await confirmDialog("Hapus invoice ini secara permanen?", {
          title: "Hapus Invoice",
          confirmText: "Ya, Hapus"
        });
        if (!confirmed) return;
        try {
          await deleteInvoice(id);
        } catch {
          // ignore
        }
        currentInvoices = currentInvoices.filter((x) => x.id !== id);
        updateInvoiceList();
        updateAllStats();
      }
    });
  }

  // 7. Receipt List Filters & Popovers
  const receiptSearchInput = document.getElementById("receiptSearchInput");
  const receiptDateFromInput = document.getElementById("receiptDateFrom");
  const receiptDateToInput = document.getElementById("receiptDateTo");
  const receiptStatusFilterSelect = document.getElementById("receiptStatusFilter");
  const receiptReferralFilterSelect = document.getElementById("receiptReferralFilter");
  const receiptPageSizeSelect = document.getElementById("receiptPageSize");
  const receiptDateRangeBtn = document.getElementById("receiptDateRangeBtn");
  const receiptDateRangePopover = document.getElementById("receiptDateRangePopover");
  const receiptDateRangeApply = document.getElementById("receiptDateRangeApply");
  const receiptDateRangeClear = document.getElementById("receiptDateRangeClear");
  const receiptDateRangeLabel = document.getElementById("receiptDateRangeLabel");

  function updateReceiptDateRangeLabelText() {
    if (receiptDateRangeLabel) {
      receiptDateRangeLabel.textContent = `Tanggal: ${formatDateRangeLabel(receiptDateFrom, receiptDateTo)}`;
    }
  }

  if (receiptDateFromInput && receiptDateToInput) {
    const now = new Date();
    const fromDate = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    receiptDateFrom = formatDateForInput(fromDate);
    receiptDateTo = formatDateForInput(now);
    receiptDateFromInput.value = receiptDateFrom;
    receiptDateToInput.value = receiptDateTo;
    updateReceiptDateRangeLabelText();
  }

  if (receiptSearchInput) {
    receiptSearchInput.addEventListener("input", (e) => {
      receiptFilterKeyword = e.target.value || "";
      updateReceiptList();
    });
  }
  if (receiptStatusFilterSelect) {
    receiptStatusFilterSelect.addEventListener("change", (e) => {
      receiptFilterStatus = e.target.value || "all";
      updateReceiptList();
    });
  }
  if (receiptReferralFilterSelect) {
    receiptReferralFilterSelect.addEventListener("change", (e) => {
      receiptFilterReferral = e.target.value || "all";
      updateReceiptList();
    });
  }
  if (receiptPageSizeSelect) {
    receiptPageSizeSelect.addEventListener("change", (e) => {
      receiptPageSize = parseInt(e.target.value, 10) || 100;
      updateReceiptList();
    });
  }
  if (receiptDateRangeBtn && receiptDateRangePopover) {
    receiptDateRangeBtn.addEventListener("click", () => {
      receiptDateRangePopover.classList.toggle("hidden");
    });
    document.addEventListener("click", (e) => {
      if (receiptDateRangePopover.classList.contains("hidden")) return;
      if (!receiptDateRangePopover.contains(e.target) && !receiptDateRangeBtn.contains(e.target)) {
        receiptDateRangePopover.classList.add("hidden");
      }
    });
  }
  if (receiptDateRangeApply && receiptDateRangePopover) {
    receiptDateRangeApply.addEventListener("click", () => {
      receiptDateFrom = receiptDateFromInput?.value || "";
      receiptDateTo = receiptDateToInput?.value || "";
      updateReceiptDateRangeLabelText();
      receiptDateRangePopover.classList.add("hidden");
      updateReceiptList();
    });
  }
  if (receiptDateRangeClear && receiptDateFromInput && receiptDateToInput) {
    receiptDateRangeClear.addEventListener("click", () => {
      receiptDateFromInput.value = "";
      receiptDateToInput.value = "";
      receiptDateFrom = "";
      receiptDateTo = "";
      updateReceiptDateRangeLabelText();
      updateReceiptList();
    });
  }

  // 8. Receipt Table Body Actions
  const receiptTableBody = document.getElementById("receiptTableBody");
  if (receiptTableBody) {
    receiptTableBody.addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".view-payment");
      if (viewBtn) {
        const id = viewBtn.getAttribute("data-id");
        const inv = currentInvoices.find((x) => x.id === id);
        if (inv) openPaymentViewModal(inv);
        return;
      }
      const photoBtn = e.target.closest(".receipt-photo-btn");
      if (photoBtn) {
        const url = photoBtn.getAttribute("data-url");
        if (url) window.open(url, "_blank");
      }
    });
  }

  // 9. Payment View Modal Verification Select & Close
  const verificationSelect = document.getElementById("paymentVerificationStatus");
  const verificationBadge = document.getElementById("paymentVerificationBadge");
  const paymentModal = document.getElementById("paymentViewModal");
  const closePaymentBtn = document.getElementById("closePaymentViewModalBtn");

  if (verificationSelect && paymentModal) {
    verificationSelect.addEventListener("change", async function () {
      const invoiceId = paymentModal.getAttribute("data-id");
      if (!invoiceId) return;
      const meta = getVerificationStatusMeta(this.value || "legit");
      if (verificationBadge) {
        verificationBadge.innerHTML = meta.badge;
      }
      const idx = currentInvoices.findIndex((x) => x.id === invoiceId);
      if (idx >= 0) {
        currentInvoices[idx].verificationStatus = meta.key;
      }
      try {
        await updateInvoiceVerification(invoiceId, meta.key);
      } catch (err) {
        console.warn("Failed to update verification status:", err);
      }
    });
  }
  if (closePaymentBtn) closePaymentBtn.addEventListener("click", closePaymentViewModal);
  if (paymentModal) {
    paymentModal.addEventListener("click", (e) => {
      if (e.target === paymentModal) closePaymentViewModal();
    });
  }

  // 10. Bank Channels Form & Actions
  const btnSaveBank = document.getElementById("btnSaveBank");
  const btnClearBankForm = document.getElementById("btnClearBankForm");
  const bankTableBody = document.getElementById("bankTableBody");

  if (btnSaveBank) {
    btnSaveBank.addEventListener("click", async () => {
      const idField = document.getElementById("bankId");
      const nameField = document.getElementById("bankName");
      const numberField = document.getElementById("bankNumber");
      const holderField = document.getElementById("bankHolder");

      const name = (nameField?.value || "").trim();
      const number = (numberField?.value || "").trim();
      const holder = (holderField?.value || "").trim();

      if (!name || !number) {
        alertDialog("Nama bank dan nomor rekening wajib diisi.", {
          title: "Peringatan",
          type: "warning"
        });
        return;
      }

      let id = idField?.value || "";
      if (!id) id = `BANK_${Date.now()}`;

      const existingIndex = currentBanks.findIndex((b) => b.id === id);
      const item = { id, name, number, holder };

      if (existingIndex >= 0) {
        currentBanks[existingIndex] = item;
      } else {
        currentBanks.push(item);
      }

      await saveBanks(currentBanks);
      renderBanks(currentBanks);

      if (idField) idField.value = "";
      if (nameField) nameField.value = "";
      if (numberField) numberField.value = "";
      if (holderField) holderField.value = "";
    });
  }

  if (btnClearBankForm) {
    btnClearBankForm.addEventListener("click", () => {
      document.getElementById("bankId").value = "";
      document.getElementById("bankName").value = "";
      document.getElementById("bankNumber").value = "";
      document.getElementById("bankHolder").value = "";
    });
  }

  if (bankTableBody) {
    bankTableBody.addEventListener("click", async (e) => {
      const editBtn = e.target.closest(".edit-bank");
      if (editBtn) {
        const id = editBtn.getAttribute("data-id");
        const bank = currentBanks.find((b) => b.id === id);
        if (!bank) return;
        document.getElementById("bankId").value = bank.id;
        document.getElementById("bankName").value = bank.name;
        document.getElementById("bankNumber").value = bank.number;
        document.getElementById("bankHolder").value = bank.holder;
        return;
      }
      const deleteBtn = e.target.closest(".delete-bank");
      if (deleteBtn) {
        const id = deleteBtn.getAttribute("data-id");
        const confirmed = await confirmDialog("Hapus rekening ini?", {
          title: "Hapus Rekening",
          confirmText: "Ya, Hapus"
        });
        if (!confirmed) return;
        currentBanks = currentBanks.filter((b) => b.id !== id);
        await saveBanks(currentBanks);
        renderBanks(currentBanks);
      }
    });
  }

  // 11. Referral Management Actions
  const refHolderType = document.getElementById("refHolderType");
  const refOwnerNameWrapper = document.getElementById("refOwnerNameWrapper");
  const refFunctionType = document.getElementById("refFunctionType");
  const refDiscountWrapper = document.getElementById("refDiscountWrapper");
  const refDiscountPercent = document.getElementById("refDiscountPercent");
  const refDiscountAmount = document.getElementById("refDiscountAmount");
  const refProductDropdown = document.getElementById("refProductDropdown");
  const refProductOptions = document.getElementById("refProductOptions");
  const btnSaveReferral = document.getElementById("btnSaveReferral");
  const btnClearReferralForm = document.getElementById("btnClearReferralForm");
  const refSearchInput = document.getElementById("refSearchInput");
  const refTableBody = document.getElementById("refTableBody");

  if (refHolderType && refOwnerNameWrapper) {
    refHolderType.addEventListener("change", function () {
      if (this.value === "user") {
        refOwnerNameWrapper.classList.remove("hidden");
      } else {
        refOwnerNameWrapper.classList.add("hidden");
      }
    });
  }

  if (refFunctionType && refDiscountWrapper) {
    refFunctionType.addEventListener("change", function () {
      if (this.value === "discount") {
        refDiscountWrapper.classList.remove("hidden");
      } else {
        refDiscountWrapper.classList.add("hidden");
        if (refDiscountPercent) refDiscountPercent.value = "";
        if (refDiscountAmount) refDiscountAmount.value = "";
      }
    });
  }

  if (refDiscountPercent && refDiscountAmount && basePriceField) {
    refDiscountPercent.addEventListener("input", () => {
      const base = parseFormattedNumberStr(basePriceField.value);
      const p = parseFloat(refDiscountPercent.value);
      if (!base || !p || p <= 0) {
        if (!refDiscountPercent.value) refDiscountAmount.value = "";
        return;
      }
      const amount = Math.round((base * p) / 100);
      refDiscountAmount.value = formatNumberWithDotsStr(amount);
    });

    refDiscountAmount.addEventListener("input", () => {
      const base = parseFormattedNumberStr(basePriceField.value);
      const amount = parseFormattedNumberStr(refDiscountAmount.value);
      if (!base || !amount || amount <= 0) {
        if (!refDiscountAmount.value) refDiscountPercent.value = "";
        return;
      }
      const p = Math.round((amount / base) * 100);
      refDiscountPercent.value = String(p);
      refDiscountAmount.value = formatNumberWithDotsStr(amount);
    });
  }

  if (refProductDropdown && refProductOptions) {
    refProductDropdown.addEventListener("click", () => {
      refProductOptions.classList.toggle("hidden");
    });
    refProductOptions.addEventListener("change", (e) => {
      if (e.target.classList.contains("ref-product-checkbox")) {
        updateReferralProductSummary();
      }
    });
    document.addEventListener("click", (e) => {
      if (!refProductOptions.contains(e.target) && !refProductDropdown.contains(e.target)) {
        refProductOptions.classList.add("hidden");
      }
    });
  }

  if (btnSaveReferral) {
    btnSaveReferral.addEventListener("click", async () => {
      const holderType = refHolderType?.value || "system";
      const holderName = (document.getElementById("refOwnerName")?.value || "").trim();
      const code = (document.getElementById("refCode")?.value || "").trim().toUpperCase();
      const maxUsage = parseInt(document.getElementById("refMaxUsage")?.value, 10) || 0;
      const monthsValid = parseInt(document.getElementById("refMonthsValid")?.value, 10) || 2;
      const usedCount = parseInt(document.getElementById("refUsedCount")?.value, 10) || 0;
      const functionType = refFunctionType?.value || "";

      let discountPercent = 0;
      let discountAmount = 0;
      if (functionType === "discount") {
        if (refDiscountPercent) {
          const p = parseFloat(refDiscountPercent.value);
          if (!isNaN(p) && p > 0) discountPercent = p;
        }
        if (refDiscountAmount) {
          const a = parseFormattedNumberStr(refDiscountAmount.value);
          if (a > 0) discountAmount = a;
        }
      }

      const selectedProductNames = [];
      const selectedProductIds = [];
      document.querySelectorAll(".ref-product-checkbox").forEach((cb) => {
        if (cb.checked) {
          const name = cb.getAttribute("data-product-name") || "";
          const id = cb.getAttribute("data-product-id") || "";
          if (name) selectedProductNames.push(name);
          if (id) selectedProductIds.push(id);
        }
      });

      if (!selectedProductNames.length) {
        alertDialog("Pilih minimal 1 product untuk referral ini.", {
          title: "Peringatan",
          type: "warning"
        });
        return;
      }
      if (!code || maxUsage <= 0) {
        alertDialog("Kode dan maksimal pemakaian wajib diisi.", {
          title: "Peringatan",
          type: "warning"
        });
        return;
      }

      const existingIndex = currentReferrals.findIndex((r) => r.code === code);
      let createdAtMs = Date.now();
      if (existingIndex >= 0 && typeof currentReferrals[existingIndex].createdAtMs === "number") {
        createdAtMs = currentReferrals[existingIndex].createdAtMs;
      }

      const item = {
        code,
        maxUsage,
        usedCount,
        holderType,
        holderName,
        monthsValid,
        createdAtMs,
        functionType,
        discountPercent,
        discountAmount,
        productNames: selectedProductNames,
        productIds: selectedProductIds,
      };

      if (existingIndex >= 0) {
        currentReferrals[existingIndex] = item;
      } else {
        currentReferrals.push(item);
      }

      await saveReferrals(currentReferrals);
      updateReferralList();
      populateReceiptReferralFilter(currentReferrals);
      updateAllStats();

      // Reset form
      if (refHolderType) refHolderType.value = "system";
      if (document.getElementById("refOwnerName")) document.getElementById("refOwnerName").value = "";
      if (document.getElementById("refCode")) document.getElementById("refCode").value = "";
      if (document.getElementById("refMaxUsage")) document.getElementById("refMaxUsage").value = "";
      if (document.getElementById("refMonthsValid")) document.getElementById("refMonthsValid").value = "";
      if (document.getElementById("refUsedCount")) document.getElementById("refUsedCount").value = "";
      if (refFunctionType) refFunctionType.value = "";
      if (refDiscountPercent) refDiscountPercent.value = "";
      if (refDiscountAmount) refDiscountAmount.value = "";
      if (refDiscountWrapper) refDiscountWrapper.classList.add("hidden");
      if (refOwnerNameWrapper) refOwnerNameWrapper.classList.add("hidden");
      document.querySelectorAll(".ref-product-checkbox").forEach((cb) => {
        cb.checked = false;
      });
      updateReferralProductSummary();
    });
  }

  if (btnClearReferralForm) {
    btnClearReferralForm.addEventListener("click", () => {
      if (refHolderType) refHolderType.value = "system";
      if (document.getElementById("refOwnerName")) document.getElementById("refOwnerName").value = "";
      if (document.getElementById("refCode")) document.getElementById("refCode").value = "";
      if (document.getElementById("refMaxUsage")) document.getElementById("refMaxUsage").value = "";
      if (document.getElementById("refMonthsValid")) document.getElementById("refMonthsValid").value = "";
      if (document.getElementById("refUsedCount")) document.getElementById("refUsedCount").value = "";
      if (refFunctionType) refFunctionType.value = "";
      if (refDiscountPercent) refDiscountPercent.value = "";
      if (refDiscountAmount) refDiscountAmount.value = "";
      if (refDiscountWrapper) refDiscountWrapper.classList.add("hidden");
      if (refOwnerNameWrapper) refOwnerNameWrapper.classList.add("hidden");
      document.querySelectorAll(".ref-product-checkbox").forEach((cb) => {
        cb.checked = false;
      });
      updateReferralProductSummary();
    });
  }

  if (refSearchInput) {
    refSearchInput.addEventListener("input", (e) => {
      refSearchKeyword = e.target.value || "";
      updateReferralList();
    });
  }

  document.querySelectorAll(".ref-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = btn.getAttribute("data-ref-filter") || "all";
      refFilterStatus = val;
      document.querySelectorAll(".ref-filter-btn").forEach((b) => {
        b.classList.remove("bg-white", "border", "border-slate-200", "shadow-sm", "text-emerald-600", "text-red-500");
        b.classList.add("text-slate-400");
      });
      if (val === "all") {
        btn.classList.add("bg-white", "border", "border-slate-200", "shadow-sm", "text-slate-700");
        btn.classList.remove("text-slate-400");
      } else if (val === "active") {
        btn.classList.add("text-emerald-600");
        btn.classList.remove("text-slate-400");
      } else if (val === "expired") {
        btn.classList.add("text-red-500");
        btn.classList.remove("text-slate-400");
      }
      updateReferralList();
    });
  });

  if (refTableBody) {
    refTableBody.addEventListener("click", async (e) => {
      const historyToggleBtn = e.target.closest(".toggle-ref-history");
      if (historyToggleBtn) {
        const id = historyToggleBtn.getAttribute("data-history-id");
        if (id) {
          const row = document.getElementById(id);
          if (row) row.classList.toggle("hidden");
        }
        return;
      }
      const historyLinkBtn = e.target.closest(".open-history-link");
      if (historyLinkBtn) {
        const invId = historyLinkBtn.getAttribute("data-id");
        if (invId) openCopyLinkModal(invId);
        return;
      }
      const editBtn = e.target.closest(".edit-ref");
      if (editBtn) {
        const idx = parseInt(editBtn.getAttribute("data-idx"), 10);
        const item = currentReferrals[idx];
        if (!item) return;
        document.getElementById("refCode").value = item.code || "";
        document.getElementById("refMaxUsage").value = item.maxUsage || "";
        document.getElementById("refMonthsValid").value = item.monthsValid || "";
        document.getElementById("refUsedCount").value = item.usedCount || "";
        if (refHolderType) refHolderType.value = item.holderType || "system";
        if (document.getElementById("refOwnerName")) {
          document.getElementById("refOwnerName").value = item.holderName || "";
        }
        if (refOwnerNameWrapper) {
          if (item.holderType === "user") refOwnerNameWrapper.classList.remove("hidden");
          else refOwnerNameWrapper.classList.add("hidden");
        }
        if (refFunctionType) refFunctionType.value = item.functionType || "";
        if (item.functionType === "discount") {
          refDiscountWrapper?.classList.remove("hidden");
          if (refDiscountPercent) refDiscountPercent.value = item.discountPercent || "";
          if (refDiscountAmount) {
            refDiscountAmount.value = item.discountAmount ? formatNumberWithDotsStr(item.discountAmount) : "";
          }
        } else {
          refDiscountWrapper?.classList.add("hidden");
        }
        const savedNames = Array.isArray(item.productNames)
          ? item.productNames.map((n) => String(n || "").toLowerCase())
          : [];
        document.querySelectorAll(".ref-product-checkbox").forEach((cb) => {
          const name = (cb.getAttribute("data-product-name") || "").toLowerCase();
          cb.checked = savedNames.includes(name);
        });
        updateReferralProductSummary();
        return;
      }
      const deleteBtn = e.target.closest(".delete-ref");
      if (deleteBtn) {
        const idx = parseInt(deleteBtn.getAttribute("data-idx"), 10);
        if (isNaN(idx)) return;
        const confirmed = await confirmDialog("Hapus kode referral ini?", {
          title: "Hapus Referral",
          confirmText: "Ya, Hapus"
        });
        if (!confirmed) return;
        currentReferrals.splice(idx, 1);
        await saveReferrals(currentReferrals);
        updateReferralList();
        populateReceiptReferralFilter(currentReferrals);
        updateAllStats();
      }
    });
  }

  // 12. Modal Buttons
  document.getElementById("btnCopyInvoiceLink")?.addEventListener("click", copyInvoiceLink);
  document.getElementById("btnCloseCopyLinkModal")?.addEventListener("click", closeCopyLinkModal);
  document.getElementById("closePaidInvoiceModalBtn")?.addEventListener("click", closePaidInvoiceModal);
  document.getElementById("btnCloseInvoiceViewModal")?.addEventListener("click", closeInvoiceViewModal);
  document.getElementById("btnOpenDiscountCalculator")?.addEventListener("click", openDiscountCalculatorModal);
  document.getElementById("closeDiscountCalculatorModalBtn")?.addEventListener("click", closeDiscountCalculatorModal);

  const copyLinkModal = document.getElementById("copyLinkModal");
  if (copyLinkModal) {
    copyLinkModal.addEventListener("click", (e) => {
      if (e.target === copyLinkModal) closeCopyLinkModal();
    });
  }
  const paidInvoiceModal = document.getElementById("paidInvoiceModal");
  if (paidInvoiceModal) {
    paidInvoiceModal.addEventListener("click", (e) => {
      if (e.target === paidInvoiceModal) closePaidInvoiceModal();
    });
  }
  const invoiceViewModal = document.getElementById("invoiceViewModal");
  if (invoiceViewModal) {
    invoiceViewModal.addEventListener("click", (e) => {
      if (e.target === invoiceViewModal) closeInvoiceViewModal();
    });
  }
  const discountCalculatorModal = document.getElementById("discountCalculatorModal");
  if (discountCalculatorModal) {
    discountCalculatorModal.addEventListener("click", (e) => {
      if (e.target === discountCalculatorModal) closeDiscountCalculatorModal();
    });
  }
}

// ==========================================
// Initialization Orchestrator
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Auth Guard
  const user = await requireAuth();
  if (!user) return;

  // 2. Mount App Shell
  const topbarMount = document.getElementById("dg-topbar-mount");
  if (topbarMount) renderTopBar(topbarMount);

  const sidebarMount = document.getElementById("dg-sidebar-mount");
  if (sidebarMount) renderSidebar(sidebarMount);

  // 3. Bind UI event listeners
  bindEventListeners();

  // 4. Initial form population from local settings
  const localSettings = loadSettingsLocal();
  fillInvoiceForm(localSettings);

  // 5. Fetch Data from Repository
  const [invoices, classData, products, banks, referrals] = await Promise.all([
    fetchInvoices(),
    fetchClassAvailability(),
    fetchProducts(),
    fetchBanks(),
    fetchReferrals(),
  ]);

  currentInvoices = invoices;
  currentClasses = classData.classes;
  currentProducts = products;
  currentBanks = banks;
  currentReferrals = referrals;

  // 6. Populate Dropdowns & Initial Tables
  populateClassDropdown(currentClasses, localSettings.className);
  populateProductDropdown(currentProducts, localSettings.productId);
  populateReferralProductOptions(currentProducts);
  populateReceiptReferralFilter(currentReferrals);

  renderBanks(currentBanks);
  updateInvoiceList();
  updateReceiptList();
  updateReferralList();
  updateAllStats(classData.totalJoined, classData.totalMax);

  // 7. Hash-based tab deep link (#tab-invoice, #tab-invoice-list, etc.)
  const hash = window.location.hash.substring(1);
  if (hash) {
    const targetTabId = hash.startsWith("tab-") ? hash : `tab-${hash}`;
    const targetTab = document.getElementById(targetTabId);
    if (targetTab) {
      switchTab(targetTabId);
    }
  }
});
