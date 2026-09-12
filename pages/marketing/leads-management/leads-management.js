/**
 * Leads Management - Controller / Orchestrator
 * 
 * Orchestrates Auth Guard, App Shell mounts, Repository queries, and UI rendering.
 */

import { requireAuth } from "../../../assets/js/auth-guard.js";
import { renderTopBar } from "../../../element/topbar.js";
import { renderSidebar } from "../../../element/sidebar.js";

import {
  fetchAdsChannels,
  saveAdsChannelDoc,
  deleteAdsChannelDoc,
  fetchInterests,
  saveInterestDoc,
  deleteInterestDoc,
  fetchUsersMap,
  fetchLeads,
  saveLeadDoc,
  deleteLeadDoc,
  addManualLeadDoc,
  fetchProductsCatalog,
  fetchInvoices,
  fetchInvoiceById,
  saveInvoiceDoc,
  deleteInvoicesBatch
} from "./leads-management.repository.js";

import {
  formatCurrencyId,
  formatDateIndonesian,
  normalizeDate,
  parseDateInputValue,
  renderDashboardStats,
  populateProgramDropdowns,
  renderNextPaymentTable,
  renderUploadProofTable,
  renderInvoiceDetailModalContent,
  renderAdsChannelsList,
  renderInterestsList,
  showConfirmModal,
  showNotificationModal,
  openEditLeadModal,
  closeEditLeadModal,
  openEditInvoiceModal,
  closeEditInvoiceModal
} from "./leads-management.ui.js";

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
  let adsChannels = [];
  let interests = [];
  let allLeads = [];
  let allInvoices = [];
  let usersMap = {};
  let productCatalog = {};

  // DOM Elements
  const globalStartDateFilter = document.getElementById("globalStartDateFilter");
  const globalEndDateFilter = document.getElementById("globalEndDateFilter");
  const btnDate1Month = document.getElementById("btnDate1Month");
  const globalDateLabel = document.getElementById("globalDateLabel");
  const filterSearchDaily = document.getElementById("filterSearchDaily");
  const filterSearchUpload = document.getElementById("filterSearchUpload");
  const filterProgramNext = document.getElementById("filterProgramNext");

  const adsChannelInput = document.getElementById("adsChannelInput");
  const btnAddAdsChannel = document.getElementById("btnAddAdsChannel");
  const interestNameInput = document.getElementById("interestNameInput");
  const btnAddInterest = document.getElementById("btnAddInterest");

  // Modal elements
  const btnOpenManualAdd = document.getElementById("btnOpenManualAdd");
  const manualAddModal = document.getElementById("manualAddModal");
  const btnCloseManualAdd = document.getElementById("btnCloseManualAdd");
  const btnCancelManualAdd = document.getElementById("btnCancelManualAdd");
  const formManualAdd = document.getElementById("formManualAdd");

  const formEditLead = document.getElementById("formEditLead");
  const formEditInvoice = document.getElementById("formEditInvoice");

  const invoiceDetailModalEl = document.getElementById("invoiceDetailModal");
  const invoiceDetailContentEl = document.getElementById("invoiceDetailContent");

  // 4. Date Range Helpers
  function getDefault1MonthRange() {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    return {
      start: normalizeDate(start),
      end: normalizeDate(end)
    };
  }

  function getTodayDateOnly() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function getSelectedDateRange() {
    let start = null;
    let end = null;

    if (globalStartDateFilter && globalStartDateFilter.value) {
      start = parseDateInputValue(globalStartDateFilter.value);
    }
    if (globalEndDateFilter && globalEndDateFilter.value) {
      end = parseDateInputValue(globalEndDateFilter.value);
    }

    if (!start || !end) {
      const range = getDefault1MonthRange();
      if (!start) start = range.start;
      if (!end) end = range.end;
    }

    return {
      start: normalizeDate(start),
      end: normalizeDate(end)
    };
  }

  function setGlobalDateTo1Month() {
    const range = getDefault1MonthRange();
    const formatDate = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };

    if (globalStartDateFilter) globalStartDateFilter.value = formatDate(range.start);
    if (globalEndDateFilter) globalEndDateFilter.value = formatDate(range.end);

    updateGlobalDateLabel();
  }

  function updateGlobalDateLabel() {
    if (!globalDateLabel) return;
    const range = getSelectedDateRange();
    const startLabel = formatDateIndonesian(range.start);
    const endLabel = formatDateIndonesian(range.end);
    const today = getTodayDateOnly();
    const isTodayEnd = range.end.getTime() === today.getTime();

    if (range.start.getTime() === range.end.getTime()) {
      globalDateLabel.textContent = startLabel + (isTodayEnd ? " (Hari Ini)" : "");
    } else {
      globalDateLabel.textContent =
        startLabel + " - " + endLabel + (isTodayEnd ? " (Sampai Hari Ini)" : "");
    }
  }

  // 5. Summary KPI Calculation
  function updateDashboardSummary() {
    const range = getSelectedDateRange();
    const startMs = range.start.getTime();
    const endMs = range.end.getTime();

    let leadsSelected = 0;
    let leadsThisWeek = 0;
    let referralUsedCount = 0;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const weekStart = new Date(range.end.getTime() - 6 * oneDayMs);

    (allLeads || []).forEach((lead) => {
      if (!lead.createdDate) return;
      const d = normalizeDate(lead.createdDate);
      if (!d) return;
      const dMs = d.getTime();
      if (dMs >= startMs && dMs <= endMs) {
        leadsSelected += 1;
        if (lead.referral_code && String(lead.referral_code).trim() !== "") {
          referralUsedCount += 1;
        }
      }
      if (d >= weekStart && d <= range.end) {
        leadsThisWeek += 1;
      }
    });

    let proofUploadedCount = 0;
    let verifiedCount = 0;

    (allInvoices || []).forEach((inv) => {
      let invDate = null;
      if (inv.paidAtMs && inv.paidAtMs > 0) {
        invDate = normalizeDate(new Date(inv.paidAtMs));
      } else if (inv.createdAtMs && inv.createdAtMs > 0) {
        invDate = normalizeDate(new Date(inv.createdAtMs));
      }
      if (!invDate) return;
      const invMs = invDate.getTime();
      const matchRange = invMs >= startMs && invMs <= endMs;

      if (inv.transferProofUrl && matchRange) {
        proofUploadedCount += 1;
      }
    });

    (allLeads || []).forEach((lead) => {
      if (!lead.createdDate) return;
      const d = normalizeDate(lead.createdDate);
      if (!d) return;
      const dMs = d.getTime();
      const stageKey = String(lead.stage || "").toLowerCase();
      if (dMs >= startMs && dMs <= endMs && stageKey === "verified") {
        verifiedCount += 1;
      }
    });

    const conversionRate = referralUsedCount
      ? Math.round((verifiedCount * 100) / referralUsedCount)
      : 0;

    renderDashboardStats({
      leadsCount: leadsSelected,
      leadsWeekCount: leadsThisWeek,
      referralUsedCount,
      proofUploadedCount,
      verifiedCount,
      conversionRate
    });
  }

  // 6. Refresh Views
  function refreshNextPaymentTable() {
    renderNextPaymentTable({
      leads: allLeads,
      invoices: allInvoices,
      dateRange: getSelectedDateRange(),
      searchTerm: filterSearchDaily ? filterSearchDaily.value : "",
      programFilter: filterProgramNext ? filterProgramNext.value : "",
      onEditLead: handleEditLead,
      onDeleteLead: handleDeleteLead
    });
  }

  function refreshUploadProofTable() {
    renderUploadProofTable({
      invoices: allInvoices,
      leads: allLeads,
      productCatalog,
      dateRange: getSelectedDateRange(),
      searchTerm: filterSearchUpload ? filterSearchUpload.value : "",
      onShowDetail: handleShowInvoiceDetail,
      onEditInvoice: handleEditInvoice,
      onDeleteInvoice: handleDeleteInvoice
    });
  }

  function onGlobalDateChange() {
    updateGlobalDateLabel();
    updateDashboardSummary();
    refreshNextPaymentTable();
    refreshUploadProofTable();
  }

  // 7. Lead Actions (Edit, Delete, Add Manual)
  function handleEditLead(leadId) {
    const target = (allLeads || []).find((l) => l.id === leadId);
    if (!target) return;
    openEditLeadModal(target);
  }

  if (formEditLead) {
    formEditLead.addEventListener("submit", async (e) => {
      e.preventDefault();
      const leadId = document.getElementById("editLeadId")?.value;
      if (!leadId) return;

      const btnSave = document.getElementById("btnSaveEditLead");
      const origText = btnSave?.textContent || "Simpan Perubahan";
      if (btnSave) {
        btnSave.textContent = "Menyimpan...";
        btnSave.disabled = true;
      }

      const name = document.getElementById("editLeadName")?.value || "";
      const city = document.getElementById("editLeadCity")?.value || "";
      const program = document.getElementById("editLeadProgram")?.value || "";
      const stage = document.getElementById("editLeadStage")?.value || "LEADS";
      const whatsapp = document.getElementById("editLeadWhatsapp")?.value || "";

      try {
        await saveLeadDoc(leadId, {
          name: name.trim(),
          city: city.trim(),
          interest_program: program.trim(),
          stage: stage.trim(),
          whatsapp: whatsapp.trim()
        });
        closeEditLeadModal();
        allLeads = await fetchLeads();
        updateDashboardSummary();
        populateProgramDropdowns(allLeads, allInvoices);
        refreshNextPaymentTable();
        refreshUploadProofTable();
        showNotificationModal({
          title: "Berhasil",
          message: "Data lead berhasil diperbarui."
        });
      } catch (err) {
        showNotificationModal({
          title: "Gagal",
          message: "Gagal memperbarui data lead: " + err.message,
          type: "danger"
        });
      } finally {
        if (btnSave) {
          btnSave.textContent = origText;
          btnSave.disabled = false;
        }
      }
    });
  }

  function handleDeleteLead(leadId) {
    if (!leadId) return;
    const target = (allLeads || []).find((l) => l.id === leadId);
    const leadName = target ? target.name : "lead";

    showConfirmModal({
      title: "Hapus Lead",
      message: `Apakah Anda yakin ingin menghapus data lead "${leadName}"? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: "Ya, Hapus",
      confirmClass: "bg-rose-600 hover:bg-rose-700 text-white",
      icon: "trash-2",
      iconWrapperClass: "bg-rose-50 text-rose-600",
      onConfirm: async () => {
        try {
          await deleteLeadDoc(leadId);
          allLeads = await fetchLeads();
          updateDashboardSummary();
          populateProgramDropdowns(allLeads, allInvoices);
          refreshNextPaymentTable();
          refreshUploadProofTable();
          showNotificationModal({
            title: "Berhasil Dihapus",
            message: "Data lead berhasil dihapus."
          });
        } catch (e) {
          showNotificationModal({
            title: "Gagal",
            message: "Gagal menghapus lead: " + e.message,
            type: "danger"
          });
        }
      }
    });
  }

  // Manual Add Modal Handlers
  function closeManualAddModal() {
    if (manualAddModal) manualAddModal.classList.add("hidden");
    if (formManualAdd) formManualAdd.reset();
  }

  if (btnOpenManualAdd && manualAddModal) {
    btnOpenManualAdd.addEventListener("click", () => {
      manualAddModal.classList.remove("hidden");
      const dateInput = document.getElementById("manualAddBatch");
      if (dateInput) {
        const sd = getSelectedDateRange().start;
        const yy = sd.getFullYear();
        const mm = String(sd.getMonth() + 1).padStart(2, "0");
        const dd = String(sd.getDate()).padStart(2, "0");
        dateInput.value = `${yy}-${mm}-${dd}`;
      }
    });
  }

  if (btnCloseManualAdd) btnCloseManualAdd.addEventListener("click", closeManualAddModal);
  if (btnCancelManualAdd) btnCancelManualAdd.addEventListener("click", closeManualAddModal);

  if (formManualAdd) {
    formManualAdd.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btnSave = document.getElementById("btnSaveManualAdd");
      const originalText = btnSave.textContent;
      btnSave.textContent = "Menyimpan...";
      btnSave.disabled = true;

      const nameInput = document.getElementById("manualAddName");
      const programInput = document.getElementById("manualAddProgram");
      const batchInput = document.getElementById("manualAddBatch");
      const stageInput = document.getElementById("manualAddStage");
      const nominalInput = document.getElementById("manualAddNominal");

      try {
        await addManualLeadDoc({
          name: nameInput.value.trim(),
          interest_program: programInput.value,
          due_date: batchInput.value,
          stage: stageInput.value,
          nominal: nominalInput.value ? parseInt(nominalInput.value, 10) : 0
        });

        closeManualAddModal();
        allLeads = await fetchLeads();
        updateDashboardSummary();
        populateProgramDropdowns(allLeads, allInvoices);
        refreshNextPaymentTable();
        showNotificationModal({
          title: "Berhasil",
          message: "Berhasil menambahkan pipeline leads secara manual."
        });
      } catch (err) {
        console.error("Gagal menyimpan data manual", err);
        showNotificationModal({
          title: "Gagal",
          message: "Gagal menyimpan data: " + err.message,
          type: "danger"
        });
      } finally {
        btnSave.textContent = originalText;
        btnSave.disabled = false;
      }
    });
  }

  // 8. Invoice Actions (Detail, Edit, Delete)
  async function handleShowInvoiceDetail(inv, leadFromTable) {
    if (!invoiceDetailModalEl || !invoiceDetailContentEl || !inv) return;

    invoiceDetailContentEl.innerHTML =
      '<p class="text-center text-slate-400 py-4">Memuat data dari API...</p>';

    try {
      const modalInstance =
        window.bootstrap && window.bootstrap.Modal
          ? window.bootstrap.Modal.getOrCreateInstance(invoiceDetailModalEl)
          : null;
      if (modalInstance) modalInstance.show();

      let latestInvoiceData = Object.assign({}, inv);
      const groupedBasePrice = inv.basePrice || 0;
      const groupedFinalBasePrice = inv.finalBasePrice || 0;

      if (inv.id) {
        const fetched = await fetchInvoiceById(inv.id);
        if (fetched) {
          latestInvoiceData = Object.assign({}, latestInvoiceData, fetched, { id: inv.id });
        }
      }

      if (groupedBasePrice > (latestInvoiceData.basePrice || 0)) {
        latestInvoiceData.basePrice = groupedBasePrice;
      }
      if (groupedFinalBasePrice > (latestInvoiceData.finalBasePrice || 0)) {
        latestInvoiceData.finalBasePrice = groupedFinalBasePrice;
      }

      const leadNameKey = String(latestInvoiceData.leadName || "").trim().toLowerCase();
      const leadData =
        allLeads.find((l) => String(l.name || "").trim().toLowerCase() === leadNameKey) ||
        leadFromTable ||
        null;

      invoiceDetailContentEl.innerHTML = renderInvoiceDetailModalContent(
        latestInvoiceData,
        leadData,
        usersMap,
        productCatalog
      );
    } catch (e) {
      invoiceDetailContentEl.innerHTML =
        '<p class="text-center text-rose-500 py-4">Gagal memuat detail invoice dari API.</p>';
    }
  }

  function handleEditInvoice(invoiceId) {
    const target = (allInvoices || []).find((inv) => inv.id === invoiceId);
    if (!target) return;
    openEditInvoiceModal(target);
  }

  if (formEditInvoice) {
    formEditInvoice.addEventListener("submit", async (e) => {
      e.preventDefault();
      const invoiceId = document.getElementById("editInvoiceId")?.value;
      if (!invoiceId) return;

      const btnSave = document.getElementById("btnSaveEditInvoice");
      const origText = btnSave?.textContent || "Simpan Perubahan";
      if (btnSave) {
        btnSave.textContent = "Menyimpan...";
        btnSave.disabled = true;
      }

      const leadName = document.getElementById("editInvoiceLeadName")?.value || "";
      const productName = document.getElementById("editInvoiceProductName")?.value || "";
      const paidAmount = parseInt(document.getElementById("editInvoicePaidAmount")?.value || "0", 10) || 0;
      const finalBasePrice = parseInt(document.getElementById("editInvoiceFinalBasePrice")?.value || "0", 10) || 0;
      const paymentMethod = document.getElementById("editInvoicePaymentMethod")?.value || "";
      const bankName = document.getElementById("editInvoiceBankName")?.value || "";

      try {
        await saveInvoiceDoc(invoiceId, {
          leadName: leadName.trim(),
          productName: productName.trim(),
          paidAmount,
          finalBasePrice,
          paymentMethod: paymentMethod.trim(),
          bankName: bankName.trim()
        });
        closeEditInvoiceModal();
        allInvoices = await fetchInvoices();
        updateDashboardSummary();
        populateProgramDropdowns(allLeads, allInvoices);
        refreshUploadProofTable();
        refreshNextPaymentTable();
        showNotificationModal({
          title: "Berhasil",
          message: "Data invoice berhasil diperbarui."
        });
      } catch (err) {
        showNotificationModal({
          title: "Gagal",
          message: "Gagal memperbarui invoice: " + err.message,
          type: "danger"
        });
      } finally {
        if (btnSave) {
          btnSave.textContent = origText;
          btnSave.disabled = false;
        }
      }
    });
  }

  function handleDeleteInvoice(invoiceIds) {
    showConfirmModal({
      title: "Hapus Invoice",
      message: "Apakah Anda yakin ingin menghapus invoice pembayaran ini? Tindakan ini tidak dapat dibatalkan.",
      confirmText: "Ya, Hapus",
      confirmClass: "bg-rose-600 hover:bg-rose-700 text-white",
      icon: "trash-2",
      iconWrapperClass: "bg-rose-50 text-rose-600",
      onConfirm: async () => {
        try {
          await deleteInvoicesBatch(invoiceIds);
          allInvoices = await fetchInvoices();
          updateDashboardSummary();
          populateProgramDropdowns(allLeads, allInvoices);
          refreshUploadProofTable();
          refreshNextPaymentTable();
          showNotificationModal({
            title: "Berhasil Dihapus",
            message: "Data invoice berhasil dihapus."
          });
        } catch (e) {
          showNotificationModal({
            title: "Gagal",
            message: "Gagal menghapus invoice: " + e.message,
            type: "danger"
          });
        }
      }
    });
  }

  // 9. Ads Channel & Interest CRUD
  async function loadAndRenderAdsChannels() {
    try {
      adsChannels = await fetchAdsChannels();
      renderAdsChannelsList(
        adsChannels,
        (ch) => {
          if (adsChannelInput) {
            adsChannelInput.value = ch.name;
            adsChannelInput.dataset.editId = ch.id;
          }
        },
        (chId) => {
          showConfirmModal({
            title: "Hapus Ads Channel",
            message: "Apakah Anda yakin ingin menghapus ads channel ini?",
            confirmText: "Ya, Hapus",
            confirmClass: "bg-rose-600 hover:bg-rose-700 text-white",
            icon: "trash-2",
            iconWrapperClass: "bg-rose-50 text-rose-600",
            onConfirm: async () => {
              try {
                await deleteAdsChannelDoc(chId);
                await loadAndRenderAdsChannels();
                await loadAndRenderInterests();
                showNotificationModal({
                  title: "Berhasil Dihapus",
                  message: "Ads channel berhasil dihapus."
                });
              } catch (e) {
                showNotificationModal({
                  title: "Gagal",
                  message: "Gagal menghapus ads channel: " + e.message,
                  type: "danger"
                });
              }
            }
          });
        }
      );
    } catch (e) {
      console.error("Gagal memuat ads channels:", e);
    }
  }

  async function handleSaveAdsChannel() {
    if (!adsChannelInput) return;
    const name = (adsChannelInput.value || "").trim();
    if (!name) return;
    const editId = adsChannelInput.dataset.editId || "";
    try {
      await saveAdsChannelDoc(editId, name);
      adsChannelInput.value = "";
      adsChannelInput.dataset.editId = "";
      await loadAndRenderAdsChannels();
      showNotificationModal({
        title: "Berhasil Disimpan",
        message: editId ? "Ads channel berhasil diperbarui." : "Ads channel baru berhasil ditambahkan."
      });
    } catch (e) {
      showNotificationModal({
        title: "Gagal",
        message: "Gagal menyimpan ads channel: " + e.message,
        type: "danger"
      });
    }
  }

  async function loadAndRenderInterests() {
    try {
      interests = await fetchInterests();
      renderInterestsList(
        interests,
        adsChannels,
        (it) => {
          if (interestNameInput) {
            interestNameInput.value = it.name;
            interestNameInput.dataset.editId = it.id;
          }
        },
        (itId) => {
          showConfirmModal({
            title: "Hapus Interest Program",
            message: "Apakah Anda yakin ingin menghapus interest program ini?",
            confirmText: "Ya, Hapus",
            confirmClass: "bg-rose-600 hover:bg-rose-700 text-white",
            icon: "trash-2",
            iconWrapperClass: "bg-rose-50 text-rose-600",
            onConfirm: async () => {
              try {
                await deleteInterestDoc(itId);
                await loadAndRenderInterests();
                showNotificationModal({
                  title: "Berhasil Dihapus",
                  message: "Interest program berhasil dihapus."
                });
              } catch (e) {
                showNotificationModal({
                  title: "Gagal",
                  message: "Gagal menghapus interest: " + e.message,
                  type: "danger"
                });
              }
            }
          });
        }
      );
    } catch (e) {
      console.error("Gagal memuat interests:", e);
    }
  }

  async function handleSaveInterest() {
    if (!interestNameInput) return;
    const name = (interestNameInput.value || "").trim();
    if (!name) return;
    const editId = interestNameInput.dataset.editId || "";
    try {
      await saveInterestDoc(editId, name, "");
      interestNameInput.value = "";
      interestNameInput.dataset.editId = "";
      await loadAndRenderInterests();
      showNotificationModal({
        title: "Berhasil Disimpan",
        message: editId ? "Interest program berhasil diperbarui." : "Interest program baru berhasil ditambahkan."
      });
    } catch (e) {
      showNotificationModal({
        title: "Gagal",
        message: "Gagal menyimpan interest: " + e.message,
        type: "danger"
      });
    }
  }

  // 10. Swipe Scroll Support
  function enableSwipeScroll() {
    const containers = document.querySelectorAll(".swipe-scroll");
    containers.forEach((container) => {
      let isDown = false;
      let startX = 0;
      let scrollLeft = 0;

      container.addEventListener("mousedown", (e) => {
        isDown = true;
        startX = e.pageX - container.offsetLeft;
        scrollLeft = container.scrollLeft;
      });

      container.addEventListener("mouseleave", () => {
        isDown = false;
      });

      container.addEventListener("mouseup", () => {
        isDown = false;
      });

      container.addEventListener("mousemove", (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - container.offsetLeft;
        const walk = x - startX;
        container.scrollLeft = scrollLeft - walk;
      });
    });
  }

  // 11. Bind UI Event Listeners
  if (globalStartDateFilter) {
    globalStartDateFilter.addEventListener("change", onGlobalDateChange);
  }
  if (globalEndDateFilter) {
    globalEndDateFilter.addEventListener("change", onGlobalDateChange);
  }
  if (btnDate1Month) {
    btnDate1Month.addEventListener("click", () => {
      setGlobalDateTo1Month();
      onGlobalDateChange();
    });
  }
  if (filterSearchDaily) {
    filterSearchDaily.addEventListener("input", refreshNextPaymentTable);
  }
  if (filterSearchUpload) {
    filterSearchUpload.addEventListener("input", refreshUploadProofTable);
  }
  if (filterProgramNext) {
    filterProgramNext.addEventListener("change", refreshNextPaymentTable);
  }

  if (btnAddAdsChannel) {
    btnAddAdsChannel.addEventListener("click", (e) => {
      e.preventDefault();
      handleSaveAdsChannel();
    });
  }
  if (adsChannelInput) {
    adsChannelInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSaveAdsChannel();
      }
    });
  }

  if (btnAddInterest) {
    btnAddInterest.addEventListener("click", (e) => {
      e.preventDefault();
      handleSaveInterest();
    });
  }
  if (interestNameInput) {
    interestNameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSaveInterest();
      }
    });
  }

  // 12. Main Initialization Routine
  async function initFeature() {
    setGlobalDateTo1Month();

    try {
      const [users, leads, invoices, catalog] = await Promise.all([
        fetchUsersMap(),
        fetchLeads(),
        fetchInvoices(),
        fetchProductsCatalog()
      ]);
      usersMap = users;
      allLeads = leads;
      allInvoices = invoices;
      productCatalog = catalog;
    } catch (err) {
      console.error("Error loading leads initial data:", err);
    }

    updateDashboardSummary();
    populateProgramDropdowns(allLeads, allInvoices);
    refreshNextPaymentTable();
    refreshUploadProofTable();
    enableSwipeScroll();

    await loadAndRenderAdsChannels();
    await loadAndRenderInterests();
  }

  await initFeature();
});
