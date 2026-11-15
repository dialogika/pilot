/**
 * Generate Certificate Orchestrator Layer
 * Manages authentication, app shell mounting, state management, event listeners, and certificate generation workflows.
 */

import { requireAuth } from "../../../assets/js/auth-guard.js";
import { renderTopBar } from "../../../element/topbar.js";
import { renderSidebar } from "../../../element/sidebar.js";
import { confirmDialog, alertDialog } from "../../../assets/js/ui.js";
import {
    persistCertificateLog,
    migrateLocalLogsToFirestoreIfNeeded,
    fetchCertificateLogsFromFirestore,
    deleteCertificateLogById,
    deleteCertificateLogsByIds,
    generateLogId,
    exportCertificateData,
    searchMembersFromDatabase,
    getCurrentUserEmail,
    CERT_LOG_STORAGE_KEY
} from "./generate-certificate.repository.js";
import {
    DEFAULT_INVOICE,
    DEFAULT_NAME,
    GUIDE_EXAMPLE_TEXT,
    LOG_PAGE_SIZE,
    toRoman,
    formatDate,
    formatDateLabel,
    buildFullInvoice,
    sanitizeFilename,
    getTodayInputValue,
    formatLogTimestamp,
    parseLogTimestamp,
    escapeHtml,
    parseBatchDateInput,
    parseBatchInput,
    countNonEmptyLines,
    resolveEntryDate,
    renderCertificateToSvgData,
    applySvgToPreview,
    setStatus,
    setStatusWithAction,
    renderInvalidEntries,
    renderBatchStats,
    renderBatchEntryList,
    renderGuideState,
    renderLogErrorBanner,
    renderLogTable,
    getSvgString,
    triggerBlobDownload,
    svgStringToPngBlob,
    createEntryFilename,
    exportLogAsCsv,
    exportLogAsExcel,
    initCertificateExportModal
} from "./generate-certificate.ui.js";

// Ensure authenticated user before initializing page
requireAuth();

// Initialize App Shell (Topbar & Sidebar)
const topbarMount = document.getElementById('dg-topbar-mount') || document.getElementById('topbarContainer');
const sidebarMount = document.getElementById('dg-sidebar-mount') || document.getElementById('sidebarContainer');

if (topbarMount) renderTopBar(topbarMount);
if (sidebarMount) renderSidebar(sidebarMount);

window.toggleSidebar = () => {
    const sidebar = document.getElementById('sidebarNav');
    if (!sidebar) return;

    const isMobile = window.innerWidth <= 991;
    if (isMobile) {
        sidebar.classList.toggle('show');
        return;
    }

    document.body.classList.toggle('sidebar-collapsed');
};

const initializeSidebarState = () => {
    const sidebar = document.getElementById('sidebarNav');
    if (!sidebar) return;

    document.body.classList.remove('sidebar-collapsed');

    if (window.innerWidth <= 991) {
        sidebar.classList.add('show');
    } else {
        sidebar.classList.remove('show');
    }
};

initializeSidebarState();

// DOM Element References
const invoiceInput = document.getElementById('invoiceInput');
const nameInput = document.getElementById('nameInput');
const classInput = document.getElementById('classInput');
const globalDateInput = document.getElementById('globalDateInput');
const batchInput = document.getElementById('batchInput');
const validCountBadge = document.getElementById('validCountBadge');
const invalidCountBadge = document.getElementById('invalidCountBadge');
const activeEntryLabel = document.getElementById('activeEntryLabel');
const activeEntryDate = document.getElementById('activeEntryDate');
const batchStatus = document.getElementById('batchStatus');
const batchErrors = document.getElementById('batchErrors');
const batchErrorsList = document.getElementById('batchErrorsList');
const toggleGuideBtn = document.getElementById('toggleGuideBtn');
const toggleGuideLabel = document.getElementById('toggleGuideLabel');
const batchGuideBody = document.getElementById('batchGuideBody');
const batchGuideActions = document.getElementById('batchGuideActions');
const batchGuideExample = document.getElementById('batchGuideExample');
const copyGuideExampleBtn = document.getElementById('copyGuideExampleBtn');
const fillGuideExampleBtn = document.getElementById('fillGuideExampleBtn');
const totalLinesStat = document.getElementById('totalLinesStat');
const validLinesStat = document.getElementById('validLinesStat');
const invalidLinesStat = document.getElementById('invalidLinesStat');
const batchEntryList = document.getElementById('batchEntryList');
const batchEntryListEmpty = document.getElementById('batchEntryListEmpty');
const previewPanel = document.getElementById('previewPanel');
const batchExportFormatInputs = document.querySelectorAll('input[name="batchExportFormat"]');
const prevEntryBtn = document.getElementById('prevEntryBtn');
const nextEntryBtn = document.getElementById('nextEntryBtn');
const importBatchBtn = document.getElementById('importBatchBtn');
const downloadBatchBtn = document.getElementById('downloadBatchBtn');
const downloadSvgBtn = document.getElementById('downloadSvgBtn');
const downloadPngBtn = document.getElementById('downloadPngBtn');
const publishCertificateBtn = document.getElementById('publishCertificateBtn');
const revokeCertificateBtn = document.getElementById('revokeCertificateBtn');
const publishBatchBtn = document.getElementById('publishBatchBtn');
const revokeBatchBtn = document.getElementById('revokeBatchBtn');
const memberSearchInput = document.getElementById('memberSearchInput');
const clearMemberSearchBtn = document.getElementById('clearMemberSearchBtn');
const memberSearchResults = document.getElementById('memberSearchResults');
let selectedMemberPhone = '';
const certSvg = document.getElementById('certSvg');
const textInvoice = document.getElementById('textInvoice');
const textName = document.getElementById('textName');
const textClass = document.getElementById('textClass');
const textAward = document.getElementById('textAward');
const svgBg = document.getElementById('svgBg');

// Modal Elements
const logSearchInput = document.getElementById('logSearchInput');
const logStartDateInput = document.getElementById('logStartDateInput');
const logEndDateInput = document.getElementById('logEndDateInput');
const logExportCsvBtn = document.getElementById('logExportCsvBtn');
const logExportExcelBtn = document.getElementById('logExportExcelBtn');
const logTableBody = document.getElementById('logTableBody');
const logSummaryText = document.getElementById('logSummaryText');
const logPageInfo = document.getElementById('logPageInfo');
const logPrevPageBtn = document.getElementById('logPrevPageBtn');
const logNextPageBtn = document.getElementById('logNextPageBtn');
const openLogModalBtn = document.getElementById('openLogModalBtn');
const certificateLogModal = document.getElementById('certificateLogModal');
const closeLogModalBtn = document.getElementById('closeLogModalBtn');
const closeLogModalFooterBtn = document.getElementById('closeLogModalFooterBtn');
const logDeleteFilteredBtn = document.getElementById('logDeleteFilteredBtn');
const logLoadErrorBanner = document.getElementById('logLoadErrorBanner');

const svgElements = {
    textInvoice,
    textName,
    textClass,
    textAward
};

const statsElements = {
    totalLinesStat,
    validLinesStat,
    invalidLinesStat
};

const logTableElements = {
    logTableBody,
    logSummaryText,
    logPageInfo,
    logDeleteFilteredBtn,
    logPrevPageBtn,
    logNextPageBtn,
    logLoadErrorBanner
};

// Application State
const state = {
    mode: 'single', // 'single' (1 peserta) atau 'batch' (rombongan)
    singleEntry: {
        invoice: DEFAULT_INVOICE,
        name: DEFAULT_NAME,
        className: "Public Speaking Basic",
        rawDate: "",
        certificateDate: ""
    },
    batchEntries: [],
    invalidEntries: [],
    activeIndex: 0,
    globalCertificateDate: "",
    isExporting: false
};

let base64Template = "";
let guideExpanded = true;

const logState = {
    logs: [],
    filteredLogs: [],
    currentPage: 1,
    isModalOpen: false,
    isLoading: false,
    loadError: '',
    isDeleting: false
};

// Log Modal Handlers
function renderLogModalState() {
    if (!certificateLogModal) return;
    certificateLogModal.classList.toggle('open', logState.isModalOpen);
    certificateLogModal.setAttribute('aria-hidden', logState.isModalOpen ? 'false' : 'true');
    document.body.style.overflow = logState.isModalOpen ? 'hidden' : '';
}

function openLogModal() {
    logState.isModalOpen = true;
    renderLogModalState();
    loadCertificateLogs({ showLoading: true });
}

function closeLogModal() {
    logState.isModalOpen = false;
    renderLogModalState();
}

async function loadCertificateLogs(options = {}) {
    const { showLoading = false } = options;
    if (showLoading) {
        logState.isLoading = true;
        logState.loadError = '';
        renderLogErrorBanner(logLoadErrorBanner, '');
        renderLogTable(logTableElements, logState);
    }
    try {
        await migrateLocalLogsToFirestoreIfNeeded();
        logState.logs = await fetchCertificateLogsFromFirestore();
    } catch (error) {
        console.error('Gagal memuat certificate logs', error);
        logState.logs = [];
        logState.loadError = 'Gagal memuat data log certificate. Coba refresh halaman atau periksa koneksi internet.';
    } finally {
        logState.isLoading = false;
    }
    applyLogFilters();
    updateRevokeButtonState();
}

function addCertificateLog(entry, options = {}) {
    if (!entry) return;
    const now = new Date();
    const timestamp = formatLogTimestamp(now);
    const certificateDate = resolveEntryDate(entry, state.globalCertificateDate) || getTodayInputValue();
    const fileReference = options.fileReference || '-';
    const payload = {
        id: generateLogId(),
        createdAt: timestamp,
        createdAtMs: now.getTime(),
        invoice: entry.invoice || '-',
        recipientName: entry.name || '-',
        className: entry.className || '',
        certificateDate,
        fileReference,
        seeCertificateRef: `preview://${encodeURIComponent((entry.name || '-').toLowerCase())}-${now.getTime()}`,
        transactionType: options.transactionType || 'individual',
        exportFormat: options.exportFormat || 'svg',
        isPublishedToPortal: options.isPublishedToPortal || false
    };
    const optimisticId = payload.id;
    logState.logs.unshift(payload);
    applyLogFilters();
    persistCertificateLog(payload).catch((error) => {
        console.error('Gagal menyimpan log ke Firestore', error);
        logState.logs = logState.logs.filter((item) => item.id !== optimisticId);
        applyLogFilters();
        setStatus(batchStatus, 'Gagal menyimpan log ke Firestore. Pastikan kamu sudah login dan koneksi internet stabil.', 'warning');
    });
}

function applyLogFilters() {
    const query = String(logSearchInput?.value || '').trim().toLowerCase();
    const startDate = logStartDateInput?.value || '';
    const endDate = logEndDateInput?.value || '';
    const startMs = startDate ? new Date(`${startDate}T00:00:00`).getTime() : null;
    const endMs = endDate ? new Date(`${endDate}T23:59:59`).getTime() : null;

    logState.filteredLogs = (logState.logs || []).filter((item) => {
        const invoice = String(item.invoice || '');
        const recipientName = String(item.recipientName || '');
        const matchesQuery = !query ||
            invoice.toLowerCase().includes(query) ||
            recipientName.toLowerCase().includes(query);
        if (!matchesQuery) return false;

        const itemMs = Number(item.createdAtMs) || (parseLogTimestamp(item.createdAt)?.getTime() || 0);
        if (startMs !== null && itemMs < startMs) return false;
        if (endMs !== null && itemMs > endMs) return false;
        return true;
    }).sort((a, b) => (Number(b.createdAtMs) || 0) - (Number(a.createdAtMs) || 0));

    const maxPage = Math.max(1, Math.ceil(logState.filteredLogs.length / LOG_PAGE_SIZE));
    logState.currentPage = Math.min(logState.currentPage, maxPage);
    renderLogTable(logTableElements, logState);
}

function previewLogCertificateById(logId) {
    const found = logState.logs.find((item) => item.id === logId);
    if (!found) {
        setStatus(batchStatus, 'Data log tidak ditemukan.', 'warning');
        return;
    }
    const runPreview = () => {
        const previewEntry = {
            invoice: found.invoice,
            name: found.recipientName,
            className: found.className || "",
            certificateDate: found.certificateDate
        };
        applySvgToPreview(svgElements, previewEntry, state.globalCertificateDate);
        invoiceInput.value = previewEntry.invoice || '';
        nameInput.value = previewEntry.name || '';
        classInput.value = previewEntry.className || '';
        if (previewEntry.certificateDate) {
            globalDateInput.value = previewEntry.certificateDate;
            state.globalCertificateDate = previewEntry.certificateDate;
        }
        activeEntryDate.textContent = `Tanggal aktif: ${formatDateLabel(resolveEntryDate(previewEntry, state.globalCertificateDate))}`;
        ensurePreviewVisible();
        setStatus(batchStatus, `Preview log: ${found.invoice} - ${found.recipientName}`, 'info');
    };

    if (logState.isModalOpen) {
        closeLogModal();
        setTimeout(runPreview, 260);
        return;
    }

    runPreview();
}

async function deleteSingleLogFromUi(logId) {
    const found = logState.logs.find((item) => item.id === logId);
    if (!found) {
        setStatus(batchStatus, 'Data log tidak ditemukan.', 'warning');
        return;
    }

    const confirmText = `Hapus / Tarik sertifikat ini dari portal?\n\nInvoice: ${found.invoice}\nNama: ${found.recipientName}\nTanggal: ${found.createdAt}`;
    const confirmed = await confirmDialog(confirmText, {
        title: "Tarik Sertifikat dari Portal",
        confirmText: "Ya, Hapus / Tarik"
    });
    if (!confirmed) return;

    const previous = logState.logs.slice();
    logState.isDeleting = true;
    logState.logs = logState.logs.filter((item) => item.id !== logId);
    applyLogFilters();

    try {
        await deleteCertificateLogById(logId);
        setStatus(batchStatus, 'Sertifikat berhasil ditarik/dihapus dari portal.', 'success');
    } catch (error) {
        console.error('Gagal menghapus log', error);
        logState.logs = previous;
        setStatus(batchStatus, 'Gagal menghapus log. Pastikan kamu sudah login dan koneksi internet stabil.', 'error');
    } finally {
        logState.isDeleting = false;
        applyLogFilters();
    }
}

async function deleteFilteredLogsFromUi() {
    const ids = logState.filteredLogs.map((item) => item.id).filter(Boolean);
    if (!ids.length) {
        setStatus(batchStatus, 'Tidak ada log yang bisa dihapus.', 'warning');
        return;
    }

    const confirmText = `Hapus ${ids.length} sertifikat terfilter dari portal?\n\nTindakan ini akan menarik sertifikat tersebut dari portal siswa.`;
    const confirmed = await confirmDialog(confirmText, {
        title: "Tarik Semua Sertifikat Terfilter",
        confirmText: "Ya, Tarik Semua"
    });
    if (!confirmed) return;

    const previous = logState.logs.slice();
    const idSet = new Set(ids);
    logState.isDeleting = true;
    logState.logs = logState.logs.filter((item) => !idSet.has(item.id));
    applyLogFilters();

    try {
        await deleteCertificateLogsByIds(ids);
        setStatus(batchStatus, `Berhasil menarik ${ids.length} sertifikat dari portal.`, 'success');
    } catch (error) {
        console.error('Gagal menghapus log terfilter', error);
        logState.logs = previous;
        setStatus(batchStatus, 'Gagal menghapus log. Coba lagi atau refresh halaman.', 'error');
        try {
            await loadCertificateLogs();
        } catch (e) { }
    } finally {
        logState.isDeleting = false;
        applyLogFilters();
    }
}

function handleExportCsv() {
    const rows = logState.filteredLogs;
    if (!rows.length) {
        setStatus(batchStatus, 'Tidak ada data sertifikat terbit untuk diexport.', 'warning');
        return;
    }
    const blob = exportLogAsCsv(rows);
    if (blob) {
        triggerBlobDownload(blob, `sertifikat-terbit-${Date.now()}.csv`);
        setStatus(batchStatus, 'Export CSV berhasil.', 'success');
    }
}

function handleExportExcel() {
    const rows = logState.filteredLogs;
    if (!rows.length) {
        setStatus(batchStatus, 'Tidak ada data sertifikat terbit untuk diexport.', 'warning');
        return;
    }
    const blob = exportLogAsExcel(rows);
    if (blob) {
        triggerBlobDownload(blob, `sertifikat-terbit-${Date.now()}.xls`);
        setStatus(batchStatus, 'Export Excel berhasil.', 'success');
    }
}

// Certificate Entry & Preview Logic
function getEntryForPreview() {
    if (state.mode === 'single' || !state.batchEntries.length) {
        return {
            invoice: invoiceInput.value.trim() || state.singleEntry?.invoice || DEFAULT_INVOICE,
            name: nameInput.value.trim() || state.singleEntry?.name || DEFAULT_NAME,
            className: classInput.value.trim() || state.singleEntry?.className || "",
            rawDate: "",
            certificateDate: state.globalCertificateDate || getTodayInputValue()
        };
    }

    const current = state.batchEntries[state.activeIndex] || state.batchEntries[0];
    return {
        ...current,
        certificateDate: resolveEntryDate(current, state.globalCertificateDate) || state.globalCertificateDate || getTodayInputValue()
    };
}

function syncActiveInputs() {
    const activeEntry = getEntryForPreview();
    if (document.activeElement !== invoiceInput && invoiceInput) invoiceInput.value = activeEntry.invoice || '';
    if (document.activeElement !== nameInput && nameInput) nameInput.value = activeEntry.name || '';
    if (document.activeElement !== classInput && classInput) classInput.value = activeEntry.className || '';
    if (document.activeElement !== globalDateInput && globalDateInput) globalDateInput.value = state.globalCertificateDate;
}

function updateNavigationState() {
    const total = state.mode === 'batch' ? (state.batchEntries.length || 1) : 1;
    const current = state.mode === 'batch' && state.batchEntries.length ? state.activeIndex + 1 : 1;
    activeEntryLabel.textContent = `Peserta ${current} dari ${total}`;
    const activeEntry = getEntryForPreview();
    activeEntryDate.textContent = `Tanggal aktif: ${formatDateLabel(resolveEntryDate(activeEntry, state.globalCertificateDate))}`;

    const canPrev = state.mode === 'batch' && state.batchEntries.length > 1 && state.activeIndex > 0 && !state.isExporting;
    const canNext = state.mode === 'batch' && state.batchEntries.length > 1 && state.activeIndex < state.batchEntries.length - 1 && !state.isExporting;

    prevEntryBtn.disabled = !canPrev;
    nextEntryBtn.disabled = !canNext;
    prevEntryBtn.classList.toggle('opacity-50', !canPrev);
    nextEntryBtn.classList.toggle('opacity-50', !canNext);
}

function renderCounters() {
    if (validCountBadge) {
        if (state.mode === 'single') {
            validCountBadge.textContent = `1 peserta aktif`;
        } else {
            const validCount = state.batchEntries.length;
            validCountBadge.textContent = `${validCount} peserta batch`;
        }
    }
    if (invalidCountBadge) {
        invalidCountBadge.textContent = `${state.invalidEntries.length} invalid`;
    }
}

function isElementMostlyVisible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const visibleTop = Math.max(rect.top, 0);
    const visibleBottom = Math.min(rect.bottom, viewportHeight);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);
    return visibleHeight >= Math.min(rect.height * 0.45, 320);
}

function ensurePreviewVisible() {
    if (!previewPanel) return;
    const isMobile = window.innerWidth < 1024;
    if (!isMobile && isElementMostlyVisible(previewPanel)) return;
    if (isMobile && isElementMostlyVisible(previewPanel)) return;
    previewPanel.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

function updateRevokeButtonState() {
    if (!revokeCertificateBtn) return;
    const activeEntry = getEntryForPreview();
    const cleanName = String(activeEntry?.name || '').trim().toLowerCase();
    const cleanInvoice = String(activeEntry?.invoice || '').trim().toLowerCase();

    // Check if an existing PUBLISHED certificate log matches this invoice or recipient name
    const existingPublished = (logState.logs || []).find((l) => {
        const isPub = l.isPublishedToPortal === true || l.exportFormat === 'portal_published' || String(l.fileReference || '').startsWith('portal://');
        if (!isPub) return false;
        const invMatch = cleanInvoice && cleanInvoice !== '-' && cleanInvoice !== DEFAULT_INVOICE.toLowerCase() && String(l.invoice || '').trim().toLowerCase() === cleanInvoice;
        const nameMatch = cleanName && cleanName !== DEFAULT_NAME.toLowerCase() && String(l.recipientName || '').trim().toLowerCase() === cleanName;
        return invMatch || nameMatch;
    });

    if (existingPublished) {
        revokeCertificateBtn.classList.remove('hidden');
        revokeCertificateBtn.dataset.logId = existingPublished.id;
        revokeCertificateBtn.dataset.recipientName = existingPublished.recipientName || activeEntry?.name || '';
        revokeCertificateBtn.dataset.invoice = existingPublished.invoice || activeEntry?.invoice || '';
        revokeCertificateBtn.title = `Tarik sertifikat untuk ${existingPublished.recipientName} (${existingPublished.invoice}) dari Portal Siswa`;
    } else {
        revokeCertificateBtn.classList.add('hidden');
        delete revokeCertificateBtn.dataset.logId;
        delete revokeCertificateBtn.dataset.recipientName;
        delete revokeCertificateBtn.dataset.invoice;
    }
}

let lastRemovedEntry = null;

function removeEntryFromBatch(index) {
    if (index < 0 || index >= state.batchEntries.length) return;
    const removed = state.batchEntries[index];
    lastRemovedEntry = { entry: { ...removed }, index };

    state.batchEntries.splice(index, 1);

    if (state.activeIndex >= state.batchEntries.length) {
        state.activeIndex = Math.max(0, state.batchEntries.length - 1);
    }

    // Update textarea agar tetap sinkron
    batchInput.value = state.batchEntries.map((e) => `${e.invoice}\t${e.name}\t${e.className || ''}`).join('\n');

    refreshPreview();

    setStatusWithAction(
        batchStatus,
        `Siswa "${removed.name}" dihapus dari daftar batch.`,
        'Kembalikan (Undo)',
        () => restoreLastRemovedEntry()
    );
}

function restoreLastRemovedEntry() {
    if (!lastRemovedEntry) return;
    const { entry, index } = lastRemovedEntry;
    const insertIdx = Math.min(index, state.batchEntries.length);
    state.batchEntries.splice(insertIdx, 0, entry);
    lastRemovedEntry = null;

    batchInput.value = state.batchEntries.map((e) => `${e.invoice}\t${e.name}\t${e.className || ''}`).join('\n');

    state.activeIndex = insertIdx;
    refreshPreview();

    setStatus(batchStatus, `✅ Berhasil mengembalikan "${entry.name}" ke daftar batch!`, 'success');
}

function refreshPreview() {
    const activeEntry = getEntryForPreview();
    syncActiveInputs();
    applySvgToPreview(svgElements, activeEntry, state.globalCertificateDate);
    updateNavigationState();
    renderCounters();
    renderBatchStats(statsElements, batchInput.value, state.batchEntries.length, state.invalidEntries.length);
    renderInvalidEntries(batchErrors, batchErrorsList, state.invalidEntries);
    renderBatchEntryList(
        batchEntryList,
        batchEntryListEmpty,
        state.batchEntries,
        state.mode === 'batch' ? state.activeIndex : -1,
        (index) => {
            state.mode = 'batch';
            state.activeIndex = index;
            syncActiveInputs();
            refreshPreview();
            ensurePreviewVisible();
        },
        (removeIndex) => {
            removeEntryFromBatch(removeIndex);
        }
    );
    updateRevokeButtonState();
}

function updateActiveEntry(field, value) {
    if (state.mode === 'single' || !state.batchEntries.length) {
        if (!state.singleEntry) {
            state.singleEntry = {};
        }
        state.singleEntry[field] = value;
        state.singleEntry.certificateDate = resolveEntryDate(state.singleEntry, state.globalCertificateDate);
    } else if (state.batchEntries[state.activeIndex]) {
        state.batchEntries[state.activeIndex][field] = value;
        state.batchEntries[state.activeIndex].certificateDate = resolveEntryDate(state.batchEntries[state.activeIndex], state.globalCertificateDate);
    }
}

async function copyGuideExample() {
    try {
        await navigator.clipboard.writeText(GUIDE_EXAMPLE_TEXT);
        setStatus(batchStatus, 'Contoh format berhasil disalin ke clipboard.', 'success');
    } catch (error) {
        console.error('Gagal menyalin contoh format', error);
        setStatus(batchStatus, 'Clipboard tidak tersedia. Salin manual dari contoh format di panduan.', 'warning');
    }
}

function fillGuideExample() {
    batchInput.value = GUIDE_EXAMPLE_TEXT;
    renderBatchStats(statsElements, batchInput.value, state.batchEntries.length, state.invalidEntries.length);
    setStatus(batchStatus, 'Contoh format dimasukkan ke textarea. Anda bisa edit lalu klik Import Batch.', 'info');
}

function importBatch() {
    const rawText = batchInput.value;
    const { validEntries, invalidEntries } = parseBatchInput(rawText, state.globalCertificateDate);

    state.invalidEntries = invalidEntries;

    if (!validEntries.length) {
        renderCounters();
        renderInvalidEntries(batchErrors, batchErrorsList, state.invalidEntries);
        refreshPreview();
        setStatus(batchStatus, 'Tidak ada data valid yang bisa diimport. Periksa format daftar peserta.', 'warning');
        return;
    }

    state.batchEntries = validEntries;
    state.activeIndex = 0;
    state.mode = 'batch';
    syncActiveInputs();
    setStatus(batchStatus, `Batch berhasil diimport: ${validEntries.length} valid, ${invalidEntries.length} invalid.`, 'success');
    refreshPreview();
}

function getSelectedBatchExportFormat() {
    const selected = Array.from(batchExportFormatInputs).find((input) => input.checked);
    return selected ? selected.value : 'both';
}

function setExportingState(isExporting, message = '') {
    state.isExporting = isExporting;
    [downloadBatchBtn, downloadSvgBtn, downloadPngBtn, importBatchBtn, publishCertificateBtn, publishBatchBtn, revokeCertificateBtn, revokeBatchBtn].forEach((btn) => {
        if (btn) {
            btn.disabled = isExporting;
            btn.classList.toggle('opacity-50', isExporting);
        }
    });
    updateNavigationState();
    if (message) {
        setStatus(batchStatus, message, 'info');
    }
}

// Unduh SVG
async function downloadSingleSvg(entry = getEntryForPreview()) {
    applySvgToPreview(svgElements, entry, state.globalCertificateDate);
    const svgData = getSvgString(certSvg);
    const fileName = `${createEntryFilename(entry, state.activeIndex)}.svg`;
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    triggerBlobDownload(svgBlob, fileName);
    addCertificateLog(entry, {
        transactionType: 'individual',
        exportFormat: 'svg',
        fileReference: `local-download://${fileName}`
    });
    setStatus(batchStatus, `File SVG untuk "${entry.name}" berhasil diunduh.`, 'success');
}

// Unduh PNG
async function downloadSinglePng(entry = getEntryForPreview()) {
    applySvgToPreview(svgElements, entry, state.globalCertificateDate);
    const svgData = getSvgString(certSvg);
    const fileName = `${createEntryFilename(entry, state.activeIndex)}.png`;
    const pngBlob = await svgStringToPngBlob(svgData);
    triggerBlobDownload(pngBlob, fileName);
    addCertificateLog(entry, {
        transactionType: 'individual',
        exportFormat: 'png',
        fileReference: `local-download://${fileName}`
    });
    setStatus(batchStatus, `Gambar PNG untuk "${entry.name}" berhasil diunduh.`, 'success');
}

// Unduh Batch ZIP Lokal (Murni download ZIP ke komputer, tidak mencatat ke database log)
async function downloadBatchZip() {
    if (!state.batchEntries.length) {
        setStatus(batchStatus, 'Belum ada batch valid untuk diexport. Import daftar peserta terlebih dahulu.', 'warning');
        return;
    }

    if (!window.JSZip) {
        setStatus(batchStatus, 'Library ZIP tidak berhasil dimuat. Coba refresh halaman.', 'error');
        return;
    }

    setExportingState(true, 'Menyiapkan file ZIP batch...');

    const zip = new window.JSZip();
    const previousIndex = state.activeIndex;
    const exportFormat = getSelectedBatchExportFormat();
    const now = new Date();
    const stamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0')
    ].join('') + '-' + [
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0')
    ].join('');
    const zipFilename = `sertifikat-batch-${exportFormat}-${stamp}.zip`;

    try {
        for (let index = 0; index < state.batchEntries.length; index += 1) {
            const entry = {
                ...state.batchEntries[index],
                certificateDate: resolveEntryDate(state.batchEntries[index], state.globalCertificateDate)
            };

            state.activeIndex = index;
            refreshPreview();
            setStatus(batchStatus, `Membuat file ${index + 1}/${state.batchEntries.length}: ${entry.name}`, 'info');

            applySvgToPreview(svgElements, entry, state.globalCertificateDate);
            const svgData = getSvgString(certSvg);
            const baseFilename = createEntryFilename(entry, index);

            let fileReference = '-';
            if (exportFormat === 'both' || exportFormat === 'svg') {
                zip.file(`${baseFilename}.svg`, svgData);
                fileReference = `zip://${zipFilename}::${baseFilename}.svg`;
            }

            if (exportFormat === 'both' || exportFormat === 'png') {
                const pngBlob = await svgStringToPngBlob(svgData);
                zip.file(`${baseFilename}.png`, pngBlob);
                fileReference = `zip://${zipFilename}::${baseFilename}.png`;
            }

            if (exportFormat === 'both') {
                fileReference = `zip://${zipFilename}::${baseFilename}.svg|${baseFilename}.png`;
            }

            addCertificateLog(entry, {
                transactionType: 'batch',
                exportFormat,
                fileReference
            });
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        triggerBlobDownload(zipBlob, zipFilename);
        const exportLabel = exportFormat === 'both' ? 'SVG + PNG' : exportFormat.toUpperCase();
        setStatus(batchStatus, `File ZIP batch berhasil diunduh untuk ${state.batchEntries.length} peserta (${exportLabel}).`, 'success');
    } catch (error) {
        console.error('Gagal membuat batch ZIP', error);
        setStatus(batchStatus, `Gagal membuat ZIP: ${error.message}`, 'error');
    } finally {
        state.activeIndex = Math.min(previousIndex, Math.max(state.batchEntries.length - 1, 0));
        setExportingState(false);
        refreshPreview();
    }
}

function initializeDefaultState() {
    const today = getTodayInputValue();
    state.globalCertificateDate = today;
    if (globalDateInput) globalDateInput.value = today;
    state.mode = 'single';
    state.singleEntry = {
        invoice: DEFAULT_INVOICE,
        name: DEFAULT_NAME,
        className: "Public Speaking Basic",
        rawDate: '',
        certificateDate: today
    };
    state.batchEntries = [];
    state.invalidEntries = [];
    state.activeIndex = 0;
    if (batchInput) batchInput.value = '';
    syncActiveInputs();
    refreshPreview();
    setStatus(batchStatus, 'Siap digunakan. Cari siswa untuk preview/cetak 1 sertifikat, atau gunakan tombol "+ Batch" untuk rombongan.', 'info');
}

// Event Listeners Registration
invoiceInput?.addEventListener('input', () => {
    updateActiveEntry('invoice', invoiceInput.value.trim());
    refreshPreview();
});

nameInput?.addEventListener('input', () => {
    updateActiveEntry('name', nameInput.value);
    refreshPreview();
});

classInput?.addEventListener('input', () => {
    updateActiveEntry('className', classInput.value);
    refreshPreview();
});

// Member Auto-Search & Selection from Database (Mode 1 Peserta / Single)
function selectMemberForActiveEntry(member) {
    if (!member) return;
    state.mode = 'single'; // Beralih ke mode 1 peserta mandiri, tidak menyentuh batch!
    const cleanName = member.nama || '';
    let cleanInv = member.invoice ? String(member.invoice).trim() : '';

    // If member has no invoice recorded in database, auto-generate official Dialogika invoice format
    if (!cleanInv || cleanInv === '-' || cleanInv.toLowerCase() === 'no invoice') {
        const randomNum = Math.floor(10000 + Math.random() * 90000);
        cleanInv = `13.${randomNum}`;
    }

    const cleanClass = member.produk_dibeli || member.kelas || member.program || 'Public Speaking Basic';

    state.singleEntry = {
        invoice: cleanInv,
        name: cleanName,
        className: cleanClass,
        rawDate: '',
        certificateDate: state.globalCertificateDate || getTodayInputValue()
    };

    if (nameInput) nameInput.value = cleanName;
    if (invoiceInput) invoiceInput.value = cleanInv;
    if (classInput) classInput.value = cleanClass;

    refreshPreview();

    selectedMemberPhone = member.whatsapp || '';

    if (memberSearchInput) memberSearchInput.value = cleanName;
    if (clearMemberSearchBtn) clearMemberSearchBtn.classList.remove('hidden');
    if (memberSearchResults) memberSearchResults.classList.add('hidden');

    setStatus(batchStatus, `✨ Data siswa "${cleanName}" dimuat ke Editor (1 Orang). Siswa ini TIDAK masuk ke daftar batch.`, 'success');
}

function addMemberToBatch(member) {
    if (!member) return;
    const cleanName = String(member.nama || '').trim();
    let cleanInv = member.invoice ? String(member.invoice).trim() : '';

    if (!cleanInv || cleanInv === '-' || cleanInv.toLowerCase() === 'no invoice') {
        const randomNum = Math.floor(10000 + Math.random() * 90000);
        cleanInv = `13.${randomNum}`;
    }

    const cleanClass = String(member.produk_dibeli || member.kelas || member.program || 'Public Speaking Basic').trim();

    // Cek apakah siswa ini sudah ada di dalam batchEntries
    const alreadyInBatch = state.batchEntries.some((e) => {
        const sameName = String(e.name || '').trim().toLowerCase() === cleanName.toLowerCase();
        const sameInv = cleanInv && String(e.invoice || '').trim().toLowerCase() === cleanInv.toLowerCase();
        return sameName || sameInv;
    });

    if (alreadyInBatch) {
        setStatus(batchStatus, `⚠️ "${cleanName}" (${cleanInv}) sudah ada di dalam daftar batch!`, 'warning');
        return;
    }

    const newEntry = {
        invoice: cleanInv,
        name: cleanName,
        className: cleanClass,
        rawDate: '',
        certificateDate: state.globalCertificateDate || getTodayInputValue()
    };

    state.batchEntries.push(newEntry);

    // Update batchInput textarea agar sinkron
    const newLine = `${cleanInv}\t${cleanName}\t${cleanClass}`;
    const currentVal = batchInput.value.trim();
    batchInput.value = currentVal ? `${currentVal}\n${newLine}` : newLine;

    renderCounters();
    renderBatchStats(statsElements, batchInput.value, state.batchEntries.length, state.invalidEntries.length);
    renderBatchEntryList(
        batchEntryList,
        batchEntryListEmpty,
        state.batchEntries,
        state.mode === 'batch' ? state.activeIndex : -1,
        (index) => {
            state.mode = 'batch';
            state.activeIndex = index;
            syncActiveInputs();
            refreshPreview();
            ensurePreviewVisible();
        },
        (removeIndex) => {
            removeEntryFromBatch(removeIndex);
        }
    );

    if (memberSearchResults) memberSearchResults.classList.add('hidden');
    if (memberSearchInput) memberSearchInput.value = '';
    if (clearMemberSearchBtn) clearMemberSearchBtn.classList.add('hidden');

    setStatus(batchStatus, `✅ Sukses! "${cleanName}" dimasukkan ke Daftar Batch (Total: ${state.batchEntries.length} peserta).`, 'success');
}

function renderMemberSearchResults(members) {
    if (!memberSearchResults) return;
    if (!members || !members.length) {
        memberSearchResults.innerHTML = `
            <div class="p-3 text-center text-xs text-slate-400">
                <i class="bi bi-search text-base block mb-1"></i>
                Tidak ditemukan siswa dengan kata kunci tersebut
            </div>
        `;
        memberSearchResults.classList.remove('hidden');
        return;
    }

    memberSearchResults.innerHTML = members.map((m) => {
        const name = escapeHtml(m.nama || 'Tanpa Nama');
        const inv = escapeHtml(m.invoice || '-');
        const prog = escapeHtml(m.produk_dibeli || m.kelas || 'Kelas Dialogika');
        const initials = name.slice(0, 2).toUpperCase();

        return `
            <div class="member-search-item px-3 py-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-2 border-b border-slate-100 last:border-b-0">
                <div class="member-select-trigger flex items-center gap-2.5 min-w-0 cursor-pointer flex-1" data-member-id="${escapeHtml(m.id)}" title="Klik untuk tampilkan di editor 1 peserta">
                    <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                        ${initials}
                    </div>
                    <div class="min-w-0">
                        <div class="text-xs font-bold text-slate-800 truncate">${name}</div>
                        <div class="text-[11px] text-slate-500 truncate flex items-center gap-2 mt-0.5">
                            <span class="font-semibold text-blue-600 font-mono">Inv: ${inv}</span>
                            <span>&bull;</span>
                            <span class="text-slate-600 truncate">${prog}</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" class="btn-add-batch px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shadow-sm" title="Tambahkan ke daftar batch di bawah" data-member-id="${escapeHtml(m.id)}">
                        <i class="bi bi-plus-circle-fill text-xs text-emerald-600"></i> + Batch
                    </button>
                </div>
            </div>
        `;
    }).join('');

    memberSearchResults.classList.remove('hidden');

    memberSearchResults.querySelectorAll('.member-select-trigger').forEach((item) => {
        item.addEventListener('click', () => {
            const mId = item.getAttribute('data-member-id');
            const target = members.find((x) => x.id === mId);
            if (target) {
                selectMemberForActiveEntry(target);
            }
        });
    });

    memberSearchResults.querySelectorAll('.btn-add-batch').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const mId = btn.getAttribute('data-member-id');
            const target = members.find((x) => x.id === mId);
            if (target) {
                addMemberToBatch(target);
            }
        });
    });
}

let searchDebounceTimer = null;
memberSearchInput?.addEventListener('input', () => {
    const term = memberSearchInput.value.trim();
    if (clearMemberSearchBtn) {
        clearMemberSearchBtn.classList.toggle('hidden', !term);
    }
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(async () => {
        const results = await searchMembersFromDatabase(term);
        renderMemberSearchResults(results);
    }, 200);
});

memberSearchInput?.addEventListener('focus', async () => {
    const term = memberSearchInput.value.trim();
    const results = await searchMembersFromDatabase(term);
    renderMemberSearchResults(results);
});

clearMemberSearchBtn?.addEventListener('click', () => {
    if (memberSearchInput) memberSearchInput.value = '';
    clearMemberSearchBtn.classList.add('hidden');
    if (memberSearchResults) memberSearchResults.classList.add('hidden');
    selectedMemberPhone = '';
});

// Auto generate random official invoice number
const btnAutoGenerateInvoice = document.getElementById('btnAutoGenerateInvoice');
btnAutoGenerateInvoice?.addEventListener('click', () => {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const newInv = `13.${randomNum}`;
    if (invoiceInput) invoiceInput.value = newInv;
    updateActiveEntry('invoice', newInv);
    refreshPreview();
    setStatus(batchStatus, `Nomor invoice otomatis dibuat: ${newInv}`, 'info');
});

// Click outside to dismiss search dropdown
document.addEventListener('click', (e) => {
    if (memberSearchResults && !memberSearchResults.contains(e.target) && e.target !== memberSearchInput) {
        memberSearchResults.classList.add('hidden');
    }
});

globalDateInput?.addEventListener('input', () => {
    state.globalCertificateDate = globalDateInput.value;
    state.batchEntries = state.batchEntries.map((entry) => ({
        ...entry,
        certificateDate: resolveEntryDate(entry, globalDateInput.value)
    }));
    refreshPreview();
});

prevEntryBtn?.addEventListener('click', () => {
    if (state.mode === 'batch' && state.activeIndex > 0) {
        state.activeIndex -= 1;
        syncActiveInputs();
        refreshPreview();
    }
});

nextEntryBtn?.addEventListener('click', () => {
    if (state.mode === 'batch' && state.activeIndex < state.batchEntries.length - 1) {
        state.activeIndex += 1;
        syncActiveInputs();
        refreshPreview();
    }
});

importBatchBtn?.addEventListener('click', importBatch);
downloadBatchBtn?.addEventListener('click', downloadBatchZip);

toggleGuideBtn?.addEventListener('click', () => {
    guideExpanded = !guideExpanded;
    renderGuideState(batchGuideBody, batchGuideActions, toggleGuideLabel, guideExpanded);
});

copyGuideExampleBtn?.addEventListener('click', copyGuideExample);
fillGuideExampleBtn?.addEventListener('click', fillGuideExample);
batchInput?.addEventListener('input', () => {
    renderBatchStats(statsElements, batchInput.value, state.batchEntries.length, state.invalidEntries.length);
});

openLogModalBtn?.addEventListener('click', openLogModal);
closeLogModalBtn?.addEventListener('click', closeLogModal);
closeLogModalFooterBtn?.addEventListener('click', closeLogModal);

certificateLogModal?.addEventListener('click', (event) => {
    if (event.target === certificateLogModal) {
        closeLogModal();
    }
});

window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && logState.isModalOpen) {
        closeLogModal();
    }
});

logSearchInput?.addEventListener('input', () => {
    logState.currentPage = 1;
    applyLogFilters();
});

logStartDateInput?.addEventListener('change', () => {
    logState.currentPage = 1;
    applyLogFilters();
});

logEndDateInput?.addEventListener('change', () => {
    logState.currentPage = 1;
    applyLogFilters();
});

logPrevPageBtn?.addEventListener('click', () => {
    if (logState.currentPage <= 1) return;
    logState.currentPage -= 1;
    renderLogTable(logTableElements, logState);
});

logNextPageBtn?.addEventListener('click', () => {
    const maxPage = Math.max(1, Math.ceil(logState.filteredLogs.length / LOG_PAGE_SIZE));
    if (logState.currentPage >= maxPage) return;
    logState.currentPage += 1;
    renderLogTable(logTableElements, logState);
});

logExportCsvBtn?.addEventListener('click', handleExportCsv);
logExportExcelBtn?.addEventListener('click', handleExportExcel);

if (logDeleteFilteredBtn) {
    logDeleteFilteredBtn.addEventListener('click', () => {
        if (logState.isDeleting || logState.isLoading) return;
        deleteFilteredLogsFromUi();
    });
}

logTableBody?.addEventListener('click', (event) => {
    const seeBtn = event.target.closest('.log-see-btn');
    if (seeBtn) {
        const logId = seeBtn.getAttribute('data-log-id');
        if (!logId) return;
        previewLogCertificateById(logId);
        return;
    }

    const deleteBtn = event.target.closest('.log-delete-btn');
    if (deleteBtn) {
        const logId = deleteBtn.getAttribute('data-log-id');
        if (!logId) return;
        if (logState.isDeleting || logState.isLoading) return;
        deleteSingleLogFromUi(logId);
    }
});

downloadSvgBtn?.addEventListener('click', () => {
    downloadSingleSvg(getEntryForPreview()).catch((error) => {
        console.error(error);
        setStatus(batchStatus, `Gagal download SVG: ${error.message}`, 'error');
    });
});

downloadPngBtn?.addEventListener('click', () => {
    downloadSinglePng(getEntryForPreview()).catch((error) => {
        console.error(error);
        setStatus(batchStatus, `Gagal download PNG: ${error.message}`, 'error');
    });
});

// Terbitkan Sertifikat Peserta Aktif ke Portal Siswa (RESMI TERCATAT KE DATABASE & LOG HISTORI)
publishCertificateBtn?.addEventListener('click', async () => {
    const entry = getEntryForPreview();
    const cleanName = String(entry?.name || '').trim();
    let cleanInvoice = String(entry?.invoice || '').trim();

    if (!cleanName || cleanName.toLowerCase() === DEFAULT_NAME.toLowerCase()) {
        setStatus(batchStatus, 'Mohon masukkan nama peserta yang valid sebelum menerbitkan sertifikat.', 'warning');
        return;
    }

    // Auto-generate invoice if missing so it never blocks or fails
    if (!cleanInvoice || cleanInvoice === '-' || cleanInvoice.toLowerCase() === DEFAULT_INVOICE.toLowerCase()) {
        const randomNum = Math.floor(10000 + Math.random() * 90000);
        cleanInvoice = `13.${randomNum}`;
        if (invoiceInput) invoiceInput.value = cleanInvoice;
        updateActiveEntry('invoice', cleanInvoice);
        refreshPreview();
    }

    publishCertificateBtn.disabled = true;
    const originalHtml = publishCertificateBtn.innerHTML;
    publishCertificateBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span> Menerbitkan ke Portal Siswa...`;

    try {
        // Cek log sebelumnya untuk invoice / nama ini agar tidak duplikat di riwayat
        const existingIndex = (logState.logs || []).findIndex((l) => {
            const invMatch = cleanInvoice && cleanInvoice !== '-' && String(l.invoice || '').trim().toLowerCase() === cleanInvoice.toLowerCase();
            const nameMatch = cleanName && String(l.recipientName || '').trim().toLowerCase() === cleanName.toLowerCase();
            return invMatch || nameMatch;
        });

        const logId = existingIndex !== -1 ? logState.logs[existingIndex].id : generateLogId();
        const now = new Date();
        const timestamp = formatLogTimestamp(now);
        const certificateDate = resolveEntryDate(entry, state.globalCertificateDate) || getTodayInputValue();
        const payload = {
            id: logId,
            createdAt: timestamp,
            createdAtMs: now.getTime(),
            invoice: cleanInvoice,
            recipientName: cleanName,
            className: entry.className || 'Public Speaking',
            certificateDate,
            fileReference: 'portal://published',
            seeCertificateRef: `preview://${encodeURIComponent(cleanName.toLowerCase())}-${now.getTime()}`,
            transactionType: 'individual',
            exportFormat: 'portal_published',
            isPublishedToPortal: true,
            createdByEmail: getCurrentUserEmail()
        };

        await persistCertificateLog(payload);
        if (existingIndex !== -1) {
            logState.logs[existingIndex] = payload;
        } else {
            logState.logs.unshift(payload);
        }
        applyLogFilters();

        setStatus(batchStatus, `🎉 Sukses! Sertifikat untuk "${cleanName}" (${cleanInvoice}) berhasil diterbitkan ke Portal Siswa dan tercatat di Log Histori.`, 'success');
        updateRevokeButtonState();
    } catch (error) {
        console.error('Publish certificate error:', error);
        setStatus(batchStatus, `Gagal menerbitkan sertifikat: ${error.message}`, 'error');
    } finally {
        publishCertificateBtn.disabled = false;
        publishCertificateBtn.innerHTML = originalHtml;
    }
});

// Tarik (Revoke) Sertifikat Peserta Aktif dari Portal Siswa
revokeCertificateBtn?.addEventListener('click', async () => {
    const logId = revokeCertificateBtn.dataset.logId;
    const recipientName = revokeCertificateBtn.dataset.recipientName || 'peserta';
    const invoice = revokeCertificateBtn.dataset.invoice || '-';

    // Cari seluruh record log yang berhubungan dengan nama atau nomor invoice ini
    const matchingLogs = (logState.logs || []).filter((l) => {
        const invMatch = invoice && invoice !== '-' && String(l.invoice || '').trim().toLowerCase() === invoice.toLowerCase();
        const nameMatch = recipientName && recipientName !== 'peserta' && String(l.recipientName || '').trim().toLowerCase() === recipientName.toLowerCase();
        return invMatch || nameMatch;
    });

    const targetIds = matchingLogs.length > 0 ? matchingLogs.map((l) => l.id) : (logId ? [logId] : []);

    if (!targetIds.length) {
        setStatus(batchStatus, 'Tidak ditemukan data sertifikat aktif untuk ditarik.', 'warning');
        return;
    }

    const confirmed = await confirmDialog(
        `PERINGATAN: Apakah Anda yakin ingin MENARIK (membatalkan) sertifikat ini dari Portal Siswa?\n\nPenerima: ${recipientName}\nNo. Invoice: ${invoice}\n\nSetelah ditarik, sertifikat TIDAK AKAN LAGI muncul di Portal Siswa dan status siswa akan kembali belum memiliki sertifikat.`,
        {
            title: "Tarik Sertifikat dari Portal Siswa",
            confirmText: "Ya, Tarik Sertifikat",
            confirmColor: "rose"
        }
    );
    if (!confirmed) return;

    revokeCertificateBtn.disabled = true;
    const origHtml = revokeCertificateBtn.innerHTML;
    revokeCertificateBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span> Menarik Sertifikat...`;

    try {
        await deleteCertificateLogsByIds(targetIds);
        const targetSet = new Set(targetIds);
        logState.logs = (logState.logs || []).filter((item) => !targetSet.has(item.id));
        applyLogFilters();
        updateRevokeButtonState();

        setStatus(batchStatus, `✅ Sukses! Sertifikat untuk "${recipientName}" (${invoice}) telah berhasil DITARIK dari Portal Siswa.`, 'success');
    } catch (err) {
        console.error('Gagal menarik sertifikat:', err);
        setStatus(batchStatus, `Gagal menarik sertifikat: ${err.message}`, 'error');
    } finally {
        revokeCertificateBtn.disabled = false;
        revokeCertificateBtn.innerHTML = origHtml;
    }
});

// Terbitkan Seluruh Batch ke Portal Siswa (RESMI TERCATAT KE DATABASE & LOG HISTORI)
publishBatchBtn?.addEventListener('click', async () => {
    if (!state.batchEntries.length) {
        setStatus(batchStatus, 'Belum ada batch valid untuk diterbitkan. Import daftar peserta terlebih dahulu.', 'warning');
        return;
    }

    const confirmed = await confirmDialog(
        `Terbitkan ${state.batchEntries.length} Sertifikat ke Portal?`,
        `Seluruh peserta dalam batch ini akan otomatis dapat mengakses dan mengunduh sertifikat kelulusan resmi mereka langsung di tab Sertifikat Portal Siswa Dialogika.`
    );
    if (!confirmed) return;

    setExportingState(true, `Menerbitkan ${state.batchEntries.length} sertifikat ke Portal Siswa...`);

    try {
        let publishedCount = 0;
        const now = new Date();

        for (let index = 0; index < state.batchEntries.length; index += 1) {
            const entry = {
                ...state.batchEntries[index],
                certificateDate: resolveEntryDate(state.batchEntries[index], state.globalCertificateDate) || getTodayInputValue()
            };
            const entryName = String(entry.name || '').trim().toLowerCase();
            const entryInv = String(entry.invoice || '').trim().toLowerCase();

            // Cek apakah sudah pernah diterbitkan / ada log sebelumnya agar tidak terjadi duplikasi log
            const existingIndex = (logState.logs || []).findIndex((l) => {
                const invMatch = entryInv && entryInv !== '-' && String(l.invoice || '').trim().toLowerCase() === entryInv;
                const nameMatch = entryName && String(l.recipientName || '').trim().toLowerCase() === entryName;
                return invMatch || nameMatch;
            });

            const logId = existingIndex !== -1 ? logState.logs[existingIndex].id : generateLogId();
            const payload = {
                id: logId,
                createdAt: formatLogTimestamp(now),
                createdAtMs: now.getTime() + index,
                invoice: entry.invoice || '-',
                recipientName: entry.name || '-',
                className: entry.className || 'Public Speaking',
                certificateDate: entry.certificateDate,
                fileReference: 'portal://batch_published',
                seeCertificateRef: `preview://${encodeURIComponent((entry.name || '-').toLowerCase())}-${now.getTime()}`,
                transactionType: 'batch',
                exportFormat: 'portal_published',
                isPublishedToPortal: true,
                createdByEmail: getCurrentUserEmail()
            };

            await persistCertificateLog(payload);
            if (existingIndex !== -1) {
                logState.logs[existingIndex] = payload;
            } else {
                logState.logs.unshift(payload);
            }
            publishedCount++;
            setStatus(batchStatus, `Menerbitkan ${publishedCount}/${state.batchEntries.length} peserta...`, 'info');
        }

        applyLogFilters();
        setStatus(batchStatus, `🎉 Sukses! Sebanyak ${publishedCount} sertifikat berhasil diterbitkan ke Portal Siswa dan tercatat di Log Histori.`, 'success');
    } catch (error) {
        console.error('Batch publish error:', error);
        setStatus(batchStatus, `Gagal menerbitkan batch: ${error.message}`, 'error');
    } finally {
        setExportingState(false);
    }
});

// Tarik (Revoke) Seluruh Batch Peserta dari Portal Siswa
revokeBatchBtn?.addEventListener('click', async () => {
    if (!state.batchEntries.length) {
        setStatus(batchStatus, 'Belum ada data batch untuk ditarik. Pastikan daftar peserta batch sudah di-import atau ditambahkan.', 'warning');
        return;
    }

    const batchInvoices = new Set(
        state.batchEntries
            .map((e) => String(e.invoice || '').trim().toLowerCase())
            .filter((inv) => inv && inv !== '-' && inv !== DEFAULT_INVOICE.toLowerCase())
    );
    const batchNames = new Set(
        state.batchEntries
            .map((e) => String(e.name || '').trim().toLowerCase())
            .filter((n) => n && n !== DEFAULT_NAME.toLowerCase())
    );

    const matchingLogs = (logState.logs || []).filter((l) => {
        const isPub = l.isPublishedToPortal === true || l.exportFormat === 'portal_published' || String(l.fileReference || '').startsWith('portal://');
        if (!isPub) return false;
        const inv = String(l.invoice || '').trim().toLowerCase();
        const name = String(l.recipientName || '').trim().toLowerCase();
        const invMatch = Boolean(inv && (batchInvoices.has(inv) || Array.from(batchInvoices).some((bInv) => bInv && (inv.includes(bInv) || bInv.includes(inv)))));
        const nameMatch = Boolean(name && (batchNames.has(name) || Array.from(batchNames).some((bName) => bName && (name.includes(bName) || bName.includes(name)))));
        return invMatch || nameMatch;
    });

    if (!matchingLogs.length) {
        setStatus(batchStatus, 'Tidak ditemukan sertifikat yang sedang berstatus terbit di Portal Siswa untuk peserta dalam daftar batch ini.', 'info');
        return;
    }

    const targetIds = matchingLogs.map((l) => l.id);
    const count = targetIds.length;

    const confirmed = await confirmDialog(
        `PERINGATAN: Apakah Anda yakin ingin MENARIK (membatalkan) ${count} sertifikat peserta batch ini dari Portal Siswa?\n\nSetelah ditarik, sertifikat TIDAK AKAN LAGI muncul di Portal Siswa dan status siswa akan kembali belum memiliki sertifikat.`,
        {
            title: "Tarik Seluruh Batch dari Portal Siswa",
            confirmText: `Ya, Tarik ${count} Sertifikat`,
            confirmColor: "rose"
        }
    );
    if (!confirmed) return;

    revokeBatchBtn.disabled = true;
    const origHtml = revokeBatchBtn.innerHTML;
    revokeBatchBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span> Menarik ${count} Sertifikat...`;
    setExportingState(true, `Menarik ${count} sertifikat dari Portal Siswa...`);

    try {
        await deleteCertificateLogsByIds(targetIds);
        const targetSet = new Set(targetIds);
        logState.logs = (logState.logs || []).filter((item) => !targetSet.has(item.id));
        applyLogFilters();
        updateRevokeButtonState();

        setStatus(batchStatus, `✅ Sukses! Sebanyak ${count} sertifikat peserta berhasil DITARIK dari Portal Siswa.`, 'success');
    } catch (err) {
        console.error('Gagal menarik sertifikat batch:', err);
        setStatus(batchStatus, `Gagal menarik sertifikat batch: ${err.message}`, 'error');
    } finally {
        revokeBatchBtn.disabled = false;
        revokeBatchBtn.innerHTML = origHtml;
        setExportingState(false);
    }
});

// Export Certificate Data
const certExportControls = initCertificateExportModal();
const certExportForm = document.getElementById("exportCertificateForm");
if (certExportForm && certExportControls) {
    certExportForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        certExportControls.setLoading(true);
        try {
            const formData = certExportControls.getFormData();
            await exportCertificateData(formData);
            const modalEl = document.getElementById("exportCertificateModal");
            if (modalEl && window.bootstrap) {
                bootstrap.Modal.getInstance(modalEl)?.hide();
            }
        } catch (err) {
            console.error("Export certificate error:", err);
            alertDialog("Gagal mengekspor data sertifikat: " + err.message);
        } finally {
            certExportControls.setLoading(false);
        }
    });
}

// Preload certificate background template
fetch('/template.png')
    .then((res) => res.blob())
    .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = function () {
            base64Template = reader.result;
            if (svgBg) svgBg.setAttribute('href', base64Template);
        };
        reader.readAsDataURL(blob);
    })
    .catch((err) => console.error('Gagal memuat template.png', err))
    .finally(() => {
        if (batchGuideExample) {
            batchGuideExample.textContent = GUIDE_EXAMPLE_TEXT;
        }
        renderGuideState(batchGuideBody, batchGuideActions, toggleGuideLabel, guideExpanded);
        loadCertificateLogs();
        initializeDefaultState();
    });
