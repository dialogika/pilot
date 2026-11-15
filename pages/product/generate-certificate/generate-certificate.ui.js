/**
 * Generate Certificate UI Layer
 * Presentation helpers, SVG formatting, Canvas PNG rasterization, Batch ZIP, and Log Table rendering.
 */

import { setupExportModalControls } from "../../../assets/js/utils/export-helper.js";

export const DEFAULT_INVOICE = "13.07353";
export const DEFAULT_NAME = "Asih Wulansari";
export const GUIDE_EXAMPLE_TEXT = `13.07353\tAsih Wulansari\tPublic Speaking Basic
13.07354\tBudi Santoso\tPublic Speaking Advanced\t20/04/2026
13.07355|Citra Lestari|Public Speaking Basic|21/04/2026
13.07356,Daniel Pratama,Public Speaking Advanced,22/04/2026`;

export const LOG_PAGE_SIZE = 25;

export function toRoman(n) {
    return ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][n] || "I";
}

export function formatDate(dateStr) {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "-";
    const months = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateLabel(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    }).format(d);
}

export function buildFullInvoice(invoice, dateStr) {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return invoice || "-";
    return `${invoice}/PT-DIA/${toRoman(d.getMonth())}/${d.getFullYear()}`;
}

export function sanitizeFilename(name) {
    return String(name || 'sertifikat')
        .trim()
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'sertifikat';
}

export function getTodayInputValue() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function formatLogTimestamp(dateObj = new Date()) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hour = String(dateObj.getHours()).padStart(2, '0');
    const minute = String(dateObj.getMinutes()).padStart(2, '0');
    const second = String(dateObj.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

export function parseLogTimestamp(ts) {
    if (!ts) return null;
    const normalized = String(ts).replace(' ', 'T');
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

export function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function parseBatchDateInput(dateText) {
    const trimmed = String(dateText || '').trim();
    const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;

    const [, dayStr, monthStr, yearStr] = match;
    const day = Number(dayStr);
    const month = Number(monthStr);
    const year = Number(yearStr);
    const date = new Date(year, month - 1, day);

    if (
        Number.isNaN(date.getTime()) ||
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    return `${yearStr}-${monthStr}-${dayStr}`;
}

export function parseBatchLine(line) {
    if (line.includes('\t')) return line.split('\t');
    if (line.includes('|')) return line.split('|');
    if (line.includes(',')) return line.split(',');
    if (line.includes(' - ')) return line.split(' - ');

    // Smart detection: format bebas seperti "(Inv: 13.98891)", "Inv 13.98891", atau "13.07353 Nama"
    const invPattern = /\(?\b(?:inv|invoice)?[:\s]*([0-9]{2,}\.[0-9]+|[0-9]{5,})\)?/i;
    const invMatch = line.match(invPattern);
    if (invMatch) {
        const invoice = invMatch[1].trim();
        const remaining = line
            .replace(invMatch[0], '')
            .replace(/\(\s*\)/g, '')
            .replace(/\[\s*\]/g, '')
            .replace(/^[-–—:\s]+|[-–—:\s]+$/g, '')
            .trim();
        return [invoice, remaining];
    }

    return [line];
}

export function parseBatchInput(rawText, globalDate) {
    const validEntries = [];
    const invalidEntries = [];
    const lines = String(rawText || '').split(/\r?\n/);

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        let parts = parseBatchLine(trimmed).map((part) => part.trim());
        let [col0, col1, col2, col3] = parts;
        const isInvoice = (val) => /^(?:inv[:\s]*)?([0-9]{2,}\.[0-9]+|[0-9]{5,})/i.test(val);

        // Smart swap jika kolom pertama nama dan kolom kedua invoice (contoh: "Budi Santoso - 13.07354")
        if (!isInvoice(col0) && isInvoice(col1)) {
            const temp = col0;
            col0 = col1.replace(/^(?:inv[:\s]*)/i, '');
            col1 = temp;
        }

        const invoice = col0 || '';
        const name = col1 || '';
        const className = col2 || '';
        const rawDate = col3 || '';
        const normalizedDate = rawDate ? parseBatchDateInput(rawDate) : '';

        if (!invoice || !name) {
            invalidEntries.push({ line: index + 1, reason: 'Invoice dan nama wajib diisi.' });
            return;
        }

        if (rawDate) {
            if (!normalizedDate) {
                invalidEntries.push({ line: index + 1, reason: 'Format tanggal tidak valid. Gunakan DD/MM/YYYY.' });
                return;
            }
        } else if (!globalDate) {
            invalidEntries.push({ line: index + 1, reason: 'Tanggal kosong dan belum ada tanggal global.' });
            return;
        }

        validEntries.push({
            invoice,
            name,
            className,
            rawDate: normalizedDate,
            certificateDate: normalizedDate || globalDate
        });
    });

    return { validEntries, invalidEntries };
}

export function countNonEmptyLines(text) {
    return String(text || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .length;
}

export function resolveEntryDate(entry, globalDate = "") {
    return entry.rawDate || entry.certificateDate || globalDate || "";
}

export function renderCertificateToSvgData(entry, globalDate = "") {
    const certificateDate = resolveEntryDate(entry, globalDate);
    const classText = entry.className ? `HAS SUCCESSFULLY COMPLETED THE PUBLIC SPEAKING ${entry.className.toUpperCase()}` : "";
    return {
        invoiceText: buildFullInvoice(entry.invoice, certificateDate),
        nameText: entry.name || "-",
        classText: classText,
        awardText: `THIS CERTIFICATE IS AWARDED ON ${formatDate(certificateDate)}`
    };
}

export function applySvgToPreview(elements, entry, globalDate = "") {
    const svgData = renderCertificateToSvgData(entry, globalDate);
    if (elements.textInvoice) elements.textInvoice.textContent = svgData.invoiceText;
    if (elements.textName) elements.textName.textContent = svgData.nameText;
    if (elements.textClass) elements.textClass.textContent = svgData.classText;
    if (elements.textAward) elements.textAward.textContent = svgData.awardText;
}

export function setStatus(statusEl, message, type = 'info') {
    if (!statusEl) return;
    if (!message) {
        statusEl.className = 'mt-4 hidden rounded-xl border px-4 py-3 text-sm';
        statusEl.textContent = '';
        return;
    }

    const classes = {
        info: 'mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700',
        success: 'mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700',
        warning: 'mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700',
        error: 'mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700'
    };

    statusEl.className = classes[type] || classes.info;
    statusEl.textContent = message;
}

export function setStatusWithAction(statusEl, message, actionLabel, onAction) {
    if (!statusEl) return;
    statusEl.className = 'mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-center justify-between gap-3 shadow-sm';
    statusEl.innerHTML = `
        <div class="flex items-center gap-2 min-w-0">
            <i class="bi bi-info-circle-fill text-amber-600 text-base shrink-0"></i>
            <span class="truncate">${escapeHtml(message)}</span>
        </div>
        <button type="button" class="btn-undo-action px-3 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition-all shadow-sm shrink-0 flex items-center gap-1.5 cursor-pointer">
            <i class="bi bi-arrow-counterclockwise text-amber-700"></i> ${escapeHtml(actionLabel)}
        </button>
    `;
    const btn = statusEl.querySelector('.btn-undo-action');
    btn?.addEventListener('click', () => {
        if (typeof onAction === 'function') onAction();
    });
}

export function renderInvalidEntries(batchErrors, batchErrorsList, invalidEntries) {
    if (!batchErrors || !batchErrorsList) return;
    if (!invalidEntries.length) {
        batchErrors.classList.add('hidden');
        batchErrorsList.innerHTML = '';
        return;
    }

    batchErrors.classList.remove('hidden');
    batchErrorsList.innerHTML = '';
    invalidEntries.slice(0, 8).forEach((item) => {
        const li = document.createElement('li');
        li.textContent = `Baris ${item.line}: ${item.reason}`;
        batchErrorsList.appendChild(li);
    });
}

export function renderBatchStats(elements, rawText, validCount, invalidCount) {
    if (elements.totalLinesStat) elements.totalLinesStat.textContent = String(countNonEmptyLines(rawText));
    if (elements.validLinesStat) elements.validLinesStat.textContent = String(validCount);
    if (elements.invalidLinesStat) elements.invalidLinesStat.textContent = String(invalidCount);
}

export function renderBatchEntryList(batchEntryList, batchEntryListEmpty, batchEntries, activeIndex, onSelect, onRemove) {
    if (!batchEntryList || !batchEntryListEmpty) return;

    if (!batchEntries.length) {
        batchEntryList.classList.add('hidden');
        batchEntryListEmpty.classList.remove('hidden');
        batchEntryList.innerHTML = '';
        return;
    }

    batchEntryList.classList.remove('hidden');
    batchEntryListEmpty.classList.add('hidden');
    batchEntryList.innerHTML = '';

    batchEntries.forEach((entry, index) => {
        const item = document.createElement('div');
        const isActive = index === activeIndex;
        item.className = `batch-entry-item w-full rounded-xl border px-3 py-2.5 transition-all ${isActive ? 'active border-blue-400 bg-blue-50/80 shadow-sm ring-1 ring-blue-300' : 'border-slate-200 bg-white hover:bg-slate-50'}`;
        item.innerHTML = `
            <div class="flex items-center justify-between gap-2.5">
                <div class="entry-select-area flex-1 min-w-0 cursor-pointer" title="Klik untuk lihat preview">
                    <div class="text-xs font-bold text-slate-800 truncate">${String(index + 1).padStart(2, '0')}. ${escapeHtml(entry.name || '-')}</div>
                    <div class="text-[11px] text-slate-500 mt-0.5 truncate">${escapeHtml(entry.invoice || '-')} • ${formatDateLabel(resolveEntryDate(entry))}</div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" class="btn-preview-entry text-[11px] font-bold px-2 py-0.5 rounded transition-colors ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-600 hover:bg-blue-100/70'}" title="Lihat preview sertifikat">
                        Preview
                    </button>
                    <button type="button" class="btn-remove-entry p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Hapus peserta ini dari daftar batch">
                        <i class="bi bi-trash3 text-xs"></i>
                    </button>
                </div>
            </div>
        `;

        const selectArea = item.querySelector('.entry-select-area');
        const previewBtn = item.querySelector('.btn-preview-entry');
        const removeBtn = item.querySelector('.btn-remove-entry');

        selectArea?.addEventListener('click', () => {
            if (typeof onSelect === 'function') onSelect(index);
        });

        previewBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof onSelect === 'function') onSelect(index);
        });

        removeBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof onRemove === 'function') onRemove(index);
        });

        batchEntryList.appendChild(item);
    });
}

export function renderGuideState(batchGuideBody, batchGuideActions, toggleGuideLabel, guideExpanded) {
    if (!batchGuideBody || !toggleGuideLabel) return;
    batchGuideBody.classList.toggle('hidden', !guideExpanded);
    if (batchGuideActions) {
        batchGuideActions.classList.toggle('hidden', !guideExpanded);
    }
    toggleGuideLabel.textContent = guideExpanded ? 'Sembunyikan' : 'Tampilkan';
}

export function renderLogErrorBanner(bannerEl, errorText) {
    if (!bannerEl) return;
    if (!errorText) {
        bannerEl.classList.add('hidden');
        bannerEl.textContent = '';
        return;
    }
    bannerEl.classList.remove('hidden');
    bannerEl.textContent = errorText;
}

export function renderLogTable(elements, logState) {
    const { logTableBody, logSummaryText, logPageInfo, logDeleteFilteredBtn, logPrevPageBtn, logNextPageBtn, logLoadErrorBanner } = elements;
    if (!logTableBody) return;

    renderLogErrorBanner(logLoadErrorBanner, logState.loadError);

    if (logState.isLoading) {
        logTableBody.innerHTML = '<tr><td colspan="5" class="px-3 py-5 text-center"><span class="log-modal-loading"><span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>Memuat log certificate...</span></td></tr>';
        if (logSummaryText) logSummaryText.textContent = 'Memuat data...';
        if (logPageInfo) logPageInfo.textContent = 'Halaman - / -';
        if (logDeleteFilteredBtn) {
            logDeleteFilteredBtn.disabled = true;
        }
        return;
    }

    const total = logState.filteredLogs.length;
    const maxPage = Math.max(1, Math.ceil(total / LOG_PAGE_SIZE));
    if (logState.currentPage < 1) logState.currentPage = 1;
    if (logState.currentPage > maxPage) logState.currentPage = maxPage;

    const startIndex = (logState.currentPage - 1) * LOG_PAGE_SIZE;
    const pageItems = logState.filteredLogs.slice(startIndex, startIndex + LOG_PAGE_SIZE);

    if (!pageItems.length) {
        logTableBody.innerHTML = '<tr><td colspan="5" class="px-3 py-4 text-center text-slate-400">Belum ada data log sesuai filter.</td></tr>';
    } else {
        logTableBody.innerHTML = pageItems.map((item) => (
            '<tr>' +
            `<td class="px-3 py-2 text-slate-700 font-semibold">${escapeHtml(item.invoice)}</td>` +
            `<td class="px-3 py-2 text-slate-700">${escapeHtml(item.recipientName)}</td>` +
            `<td class="px-3 py-2"><button type="button" data-log-id="${escapeHtml(item.id)}" class="log-see-btn rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition-all">Lihat</button></td>` +
            `<td class="px-3 py-2 text-slate-600">${escapeHtml(item.createdAt)}</td>` +
            `<td class="px-3 py-2 text-right"><button type="button" data-log-id="${escapeHtml(item.id)}" class="log-delete-btn inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-extrabold text-rose-700 hover:bg-rose-100 transition-all" title="Hapus log"><i class="bi bi-trash3"></i></button></td>` +
            '</tr>'
        )).join('');
    }

    if (logSummaryText) logSummaryText.textContent = `${total} data • menampilkan ${pageItems.length} baris`;
    if (logPageInfo) logPageInfo.textContent = `Halaman ${logState.currentPage} / ${maxPage}`;
    if (logDeleteFilteredBtn) {
        logDeleteFilteredBtn.disabled = logState.isDeleting || total === 0;
    }
    if (logPrevPageBtn) {
        logPrevPageBtn.disabled = logState.currentPage <= 1;
        logPrevPageBtn.classList.toggle('opacity-50', logPrevPageBtn.disabled);
    }
    if (logNextPageBtn) {
        logNextPageBtn.disabled = logState.currentPage >= maxPage;
        logNextPageBtn.classList.toggle('opacity-50', logNextPageBtn.disabled);
    }
}

export function getSvgString(svgEl) {
    return new XMLSerializer().serializeToString(svgEl);
}

export function triggerBlobDownload(blob, filename) {
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    setTimeout(() => URL.revokeObjectURL(downloadLink.href), 1000);
}

export function svgStringToPngBlob(svgStr) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        canvas.width = 2000;
        canvas.height = 1414;
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = function () {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Gagal membuat PNG blob.'));
                    return;
                }
                resolve(blob);
            }, 'image/png');
        };

        img.onerror = () => reject(new Error('Gagal merender SVG ke PNG.'));
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));
    });
}

export function createEntryFilename(entry, index) {
    const sequence = String(index + 1).padStart(3, '0');
    return `${sequence}-${sanitizeFilename(entry.name)}`;
}

export function exportLogAsCsv(rows) {
    if (!rows || !rows.length) return null;
    const headers = ['id', 'invoice', 'nama', 'see_certificate', 'tanggal_pembuatan', 'file_reference'];
    const csvLines = [headers.join(',')];
    rows.forEach((item) => {
        const values = [
            item.id,
            item.invoice,
            item.recipientName,
            item.seeCertificateRef || '',
            item.createdAt,
            item.fileReference || ''
        ].map((value) => `"${String(value || '').replace(/"/g, '""')}"`);
        csvLines.push(values.join(','));
    });
    return new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
}

export function exportLogAsExcel(rows) {
    if (!rows || !rows.length) return null;
    const tableHtml = [
        '<table border="1">',
        '<thead><tr><th>ID</th><th>Invoice</th><th>Nama</th><th>See Certificate</th><th>Tanggal Pembuatan</th><th>File Reference</th></tr></thead>',
        '<tbody>',
        ...rows.map((item) => (
            `<tr><td>${escapeHtml(item.id)}</td><td>${escapeHtml(item.invoice)}</td><td>${escapeHtml(item.recipientName)}</td><td>${escapeHtml(item.seeCertificateRef || '')}</td><td>${escapeHtml(item.createdAt)}</td><td>${escapeHtml(item.fileReference || '')}</td></tr>`
        )),
        '</tbody></table>'
    ].join('');
    return new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
}

/**
 * Initializes Standard Export Modal for Certificate Logs.
 * @param {Function} [onFormatChange]
 * @param {Function} [onRangeChange]
 */
export function initCertificateExportModal(onFormatChange, onRangeChange) {
    return setupExportModalControls({
        modalId: "exportCertificateModal",
        onFormatChange,
        onRangeChange,
    });
}

