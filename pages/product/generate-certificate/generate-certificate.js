/**
 * Generate Certificate Orchestrator Layer
 * Manages authentication, app shell mounting, state management, event listeners, and certificate generation workflows.
 */

import { requireAuth } from "../../../assets/js/auth-guard.js";
import { renderTopBar } from "../../../element/topbar.js";
import { renderSidebar } from "../../../element/sidebar.js";
import {
    persistCertificateLog,
    migrateLocalLogsToFirestoreIfNeeded,
    fetchCertificateLogsFromFirestore,
    deleteCertificateLogById,
    deleteCertificateLogsByIds,
    generateLogId,
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
    exportLogAsExcel
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
        exportFormat: options.exportFormat || 'svg'
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

    logState.filteredLogs = logState.logs.filter((item) => {
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

    const confirmText = `Hapus log ini?\n\nInvoice: ${found.invoice}\nNama: ${found.recipientName}\nTanggal: ${found.createdAt}`;
    const confirmed = window.confirm(confirmText);
    if (!confirmed) return;

    const previous = logState.logs.slice();
    logState.isDeleting = true;
    logState.logs = logState.logs.filter((item) => item.id !== logId);
    applyLogFilters();

    try {
        await deleteCertificateLogById(logId);
        setStatus(batchStatus, 'Log berhasil dihapus.', 'success');
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

    const confirmText = `Hapus ${ids.length} log sesuai filter saat ini?\n\nTindakan ini tidak dapat dibatalkan.`;
    const confirmed = window.confirm(confirmText);
    if (!confirmed) return;

    const previous = logState.logs.slice();
    const idSet = new Set(ids);
    logState.isDeleting = true;
    logState.logs = logState.logs.filter((item) => !idSet.has(item.id));
    applyLogFilters();

    try {
        await deleteCertificateLogsByIds(ids);
        setStatus(batchStatus, `Berhasil menghapus ${ids.length} log.`, 'success');
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
        setStatus(batchStatus, 'Tidak ada data log untuk diexport.', 'warning');
        return;
    }
    const blob = exportLogAsCsv(rows);
    if (blob) {
        triggerBlobDownload(blob, `certificate-logs-${Date.now()}.csv`);
        setStatus(batchStatus, 'Export CSV berhasil.', 'success');
    }
}

function handleExportExcel() {
    const rows = logState.filteredLogs;
    if (!rows.length) {
        setStatus(batchStatus, 'Tidak ada data log untuk diexport.', 'warning');
        return;
    }
    const blob = exportLogAsExcel(rows);
    if (blob) {
        triggerBlobDownload(blob, `certificate-logs-${Date.now()}.xls`);
        setStatus(batchStatus, 'Export Excel berhasil.', 'success');
    }
}

// Certificate Entry & Preview Logic
function getEntryForPreview() {
    if (!state.batchEntries.length) {
        return {
            invoice: invoiceInput.value.trim() || DEFAULT_INVOICE,
            name: nameInput.value.trim() || DEFAULT_NAME,
            className: classInput.value.trim() || "",
            rawDate: "",
            certificateDate: globalDateInput.value || getTodayInputValue()
        };
    }

    const current = state.batchEntries[state.activeIndex] || state.batchEntries[0];
    return {
        ...current,
        certificateDate: resolveEntryDate(current, state.globalCertificateDate)
    };
}

function syncActiveInputs() {
    const activeEntry = getEntryForPreview();
    invoiceInput.value = activeEntry.invoice || '';
    nameInput.value = activeEntry.name || '';
    classInput.value = activeEntry.className || '';
    globalDateInput.value = state.globalCertificateDate;
}

function updateNavigationState() {
    const total = state.batchEntries.length || 1;
    const current = state.batchEntries.length ? state.activeIndex + 1 : 1;
    activeEntryLabel.textContent = `Peserta ${current} dari ${total}`;
    const activeEntry = getEntryForPreview();
    activeEntryDate.textContent = `Tanggal aktif: ${formatDateLabel(resolveEntryDate(activeEntry, state.globalCertificateDate))}`;
    prevEntryBtn.disabled = !state.batchEntries.length || state.activeIndex === 0 || state.isExporting;
    nextEntryBtn.disabled = !state.batchEntries.length || state.activeIndex >= state.batchEntries.length - 1 || state.isExporting;
    prevEntryBtn.classList.toggle('opacity-50', prevEntryBtn.disabled);
    nextEntryBtn.classList.toggle('opacity-50', nextEntryBtn.disabled);
}

function renderCounters() {
    const validCount = state.batchEntries.length || 1;
    validCountBadge.textContent = `${validCount} peserta`;
    invalidCountBadge.textContent = `${state.invalidEntries.length} invalid`;
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

function refreshPreview() {
    const activeEntry = getEntryForPreview();
    syncActiveInputs();
    applySvgToPreview(svgElements, activeEntry, state.globalCertificateDate);
    updateNavigationState();
    renderCounters();
    renderBatchStats(statsElements, batchInput.value, state.batchEntries.length, state.invalidEntries.length);
    renderInvalidEntries(batchErrors, batchErrorsList, state.invalidEntries);
    renderBatchEntryList(batchEntryList, batchEntryListEmpty, state.batchEntries, state.activeIndex, (index) => {
        state.activeIndex = index;
        refreshPreview();
        ensurePreviewVisible();
    });
}

function updateActiveEntry(field, value) {
    if (state.batchEntries.length) {
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
    setStatus(batchStatus, `Batch berhasil diimport: ${validEntries.length} valid, ${invalidEntries.length} invalid.`, 'success');
    refreshPreview();
}

function getSelectedBatchExportFormat() {
    const selected = Array.from(batchExportFormatInputs).find((input) => input.checked);
    return selected ? selected.value : 'both';
}

function setExportingState(isExporting, message = '') {
    state.isExporting = isExporting;
    downloadBatchBtn.disabled = isExporting;
    downloadSvgBtn.disabled = isExporting;
    downloadPngBtn.disabled = isExporting;
    importBatchBtn.disabled = isExporting;
    [downloadBatchBtn, downloadSvgBtn, downloadPngBtn, importBatchBtn].forEach((btn) => {
        if (btn) btn.classList.toggle('opacity-50', isExporting);
    });
    updateNavigationState();
    if (message) {
        setStatus(batchStatus, message, 'info');
    }
}

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
}

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
}

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
            setStatus(batchStatus, `Generating ${index + 1}/${state.batchEntries.length}`, 'info');

            applySvgToPreview(svgElements, entry, state.globalCertificateDate);
            const svgData = getSvgString(certSvg);
            const baseFilename = createEntryFilename(entry, index);

            if (exportFormat === 'both' || exportFormat === 'svg') {
                zip.file(`${baseFilename}.svg`, svgData);
            }

            if (exportFormat === 'both' || exportFormat === 'png') {
                const pngBlob = await svgStringToPngBlob(svgData);
                zip.file(`${baseFilename}.png`, pngBlob);
            }

            let fileReference = `zip://${zipFilename}::${baseFilename}.svg`;
            if (exportFormat === 'png') {
                fileReference = `zip://${zipFilename}::${baseFilename}.png`;
            } else if (exportFormat === 'both') {
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
        setStatus(batchStatus, `ZIP berhasil dibuat untuk ${state.batchEntries.length} peserta dengan format ${exportLabel}.`, 'success');
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
    state.batchEntries = [{
        invoice: DEFAULT_INVOICE,
        name: DEFAULT_NAME,
        className: "",
        rawDate: '',
        certificateDate: today
    }];
    state.invalidEntries = [];
    state.activeIndex = 0;
    if (batchInput) batchInput.value = `${DEFAULT_INVOICE}\t${DEFAULT_NAME}\tPublic Speaking Basic`;
    refreshPreview();
    setStatus(batchStatus, 'Siap digunakan. Anda bisa edit peserta aktif atau import batch sekaligus.', 'info');
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

globalDateInput?.addEventListener('input', () => {
    state.globalCertificateDate = globalDateInput.value;
    state.batchEntries = state.batchEntries.map((entry) => ({
        ...entry,
        certificateDate: resolveEntryDate(entry, globalDateInput.value)
    }));
    refreshPreview();
});

prevEntryBtn?.addEventListener('click', () => {
    if (state.activeIndex > 0) {
        state.activeIndex -= 1;
        refreshPreview();
    }
});

nextEntryBtn?.addEventListener('click', () => {
    if (state.activeIndex < state.batchEntries.length - 1) {
        state.activeIndex += 1;
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
