// assets/js/utils/export-helper.js
// =====================================================================
// DIALOGIKA PILOT - UNIVERSAL EXPORT HELPER (Excel .xlsx / CSV .csv)
//
// Follows the UI/UX & Flow of Scouting Candidate (Benchmark Reference)
// Responsibilities:
// - Modal rendering & segmented control bindings (Format & Date Range)
// - Date range calculation (Semua Data, Per Bulan, Per Minggu 1-5)
// - Excel (.xlsx) generation with Dialogika Navy (#0B2B6A) header
// - CSV (.csv) generation with UTF-8 BOM and RFC-4180 quotation
// - Triggering browser file downloads without page reload
// =====================================================================

export const MONTH_NAMES_INDO = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

/**
 * Format timestamp / Date object to Indonesian formatted string.
 * @param {number|string|Date|object} value
 * @param {boolean} withTime
 * @returns {string}
 */
export function formatDateIndo(value, withTime = false) {
  if (!value) return "-";
  try {
    let dateObj;
    if (value && typeof value.toDate === "function") {
      dateObj = value.toDate();
    } else if (value && typeof value.toMillis === "function") {
      dateObj = new Date(value.toMillis());
    } else if (value && value.seconds) {
      dateObj = new Date(value.seconds * 1000);
    } else {
      dateObj = new Date(value);
    }
    if (isNaN(dateObj.getTime())) return "-";

    if (withTime) {
      return dateObj.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return dateObj.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch (_) {
    return "-";
  }
}

/**
 * Extract epoch milliseconds from any Firestore timestamp or ISO string.
 * @param {*} value
 * @returns {number|null}
 */
export function extractTimestamp(value) {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (value.seconds) return value.seconds * 1000;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
}

/**
 * Compute start and end timestamps and label for the given range parameters.
 * @param {string} rangeType - 'all' | 'month' | 'week'
 * @param {string} monthStr - 'YYYY-MM'
 * @param {string} weekMonthStr - 'YYYY-MM'
 * @param {number} weekNum - 1 | 2 | 3 | 4 | 5
 * @returns {{ startTimestamp: number, endTimestamp: number, periodLabel: string }}
 */
export function calcDateRange(rangeType, monthStr, weekMonthStr, weekNum) {
  let startDateParam = "";
  let endDateParam = "";

  if (typeof rangeType === "object" && rangeType !== null) {
    const opts = rangeType;
    rangeType = opts.rangeType || opts.dateRange || opts.range || "all";
    monthStr = opts.monthStr || opts.monthValue || opts.month || "";
    weekMonthStr = opts.weekMonthStr || opts.weekMonth || opts.monthValue || "";
    weekNum = opts.weekNum || opts.weekValue || opts.week || 1;
    startDateParam = opts.startDate || opts.start || "";
    endDateParam = opts.endDate || opts.end || "";
  }

  const rType = String(rangeType || "all").toLowerCase().trim();

  // 1. 7 Hari Terakhir
  if (rType === "7" || rType === "7-days" || rType === "7_days") {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0);
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const label = "7_Hari_Terakhir";
    return {
      startTimestamp: startDate.getTime(),
      endTimestamp: endDate.getTime(),
      periodLabel: label,
      start: startDate,
      end: endDate,
      label,
    };
  }

  // 2. 30 Hari Terakhir
  if (rType === "30" || rType === "30-days" || rType === "30_days") {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0, 0);
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const label = "30_Hari_Terakhir";
    return {
      startTimestamp: startDate.getTime(),
      endTimestamp: endDate.getTime(),
      periodLabel: label,
      start: startDate,
      end: endDate,
      label,
    };
  }

  // 3. Custom Date Range
  if (rType === "custom") {
    const sStr = startDateParam || monthStr;
    const eStr = endDateParam || weekMonthStr;
    let startDate = null;
    let endDate = null;
    if (sStr) {
      const parsedS = typeof sStr === "string" ? new Date(`${sStr}T00:00:00`) : new Date(sStr);
      if (!isNaN(parsedS.getTime())) startDate = parsedS;
    }
    if (eStr) {
      const parsedE = typeof eStr === "string" ? new Date(`${eStr}T23:59:59.999`) : new Date(eStr);
      if (!isNaN(parsedE.getTime())) endDate = parsedE;
    }
    const sLabel = sStr ? String(sStr).replace(/[^\w-]/g, "") : "Awal";
    const eLabel = eStr ? String(eStr).replace(/[^\w-]/g, "") : "Akhir";
    const label = `Custom_${sLabel}_sd_${eLabel}`;
    return {
      startTimestamp: startDate ? startDate.getTime() : 0,
      endTimestamp: endDate ? endDate.getTime() : Number.MAX_SAFE_INTEGER,
      periodLabel: label,
      start: startDate,
      end: endDate,
      label,
    };
  }

  // 4. Per Bulan (either specific month YYYY-MM or Bulan Ini)
  if (rType === "month") {
    const now = new Date();
    let year = now.getFullYear();
    let mIdx = now.getMonth();
    if (monthStr && typeof monthStr === "string" && monthStr.includes("-")) {
      const parts = monthStr.split("-");
      year = parseInt(parts[0], 10);
      mIdx = parseInt(parts[1], 10) - 1;
    }
    const startDate = new Date(year, mIdx, 1, 0, 0, 0, 0);
    const endDate = new Date(year, mIdx + 1, 0, 23, 59, 59, 999);
    const label = `${MONTH_NAMES_INDO[mIdx] || "Bulan"}_${year}`;
    return {
      startTimestamp: startDate.getTime(),
      endTimestamp: endDate.getTime(),
      periodLabel: label,
      start: startDate,
      end: endDate,
      label,
    };
  }

  // 5. Per Minggu (Minggu 1 - 5)
  if (rType === "week" && weekMonthStr) {
    const [yearStr, mStr] = weekMonthStr.split("-");
    const year = parseInt(yearStr, 10);
    const mIdx = parseInt(mStr, 10) - 1;
    const lastDayOfMonth = new Date(year, mIdx + 1, 0).getDate();
    const w = parseInt(weekNum || "1", 10);

    let startDay = 1;
    let endDay = 7;
    if (w === 2) {
      startDay = 8;
      endDay = 14;
    } else if (w === 3) {
      startDay = 15;
      endDay = 21;
    } else if (w === 4) {
      startDay = 22;
      endDay = 28;
    } else if (w === 5) {
      startDay = 29;
      endDay = lastDayOfMonth;
    }

    const startDate = new Date(year, mIdx, startDay, 0, 0, 0, 0);
    const endDate = new Date(
      year,
      mIdx,
      Math.min(endDay, lastDayOfMonth),
      23,
      59,
      59,
      999
    );
    const label = `Minggu_${w}_${MONTH_NAMES_INDO[mIdx] || "Bulan"}_${year}`;
    return {
      startTimestamp: startDate.getTime(),
      endTimestamp: endDate.getTime(),
      periodLabel: label,
      start: startDate,
      end: endDate,
      label,
    };
  }

  // 6. Default: Semua Data
  return {
    startTimestamp: 0,
    endTimestamp: Number.MAX_SAFE_INTEGER,
    periodLabel: "Semua_Data",
    start: null,
    end: null,
    label: "Semua_Data",
  };
}

/**
 * Ensure ExcelJS or XLSX library is loaded dynamically if missing.
 * @returns {Promise<boolean>}
 */
export async function ensureSpreadsheetLibraries() {
  if (typeof window === "undefined") return false;
  if (window.ExcelJS || window.XLSX) return true;

  return new Promise((resolve) => {
    const s1 = document.createElement("script");
    s1.src = "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js";
    s1.onload = () => resolve(true);
    s1.onerror = () => {
      const s2 = document.createElement("script");
      s2.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      s2.onload = () => resolve(true);
      s2.onerror = () => resolve(false);
      document.head.appendChild(s2);
    };
    document.head.appendChild(s1);
  });
}

/**
 * Universal file exporter for Excel (.xlsx) and CSV (.csv).
 * @param {Object} options
 * @param {string} options.filename - Base filename without extension
 * @param {string} [options.sheetName] - Name of worksheet in Excel
 * @param {Array<{ header: string, key: string, width?: number }>} options.columns
 * @param {Array<Object>} options.rowsData - Plain objects matching column keys
 * @param {string} [options.format='xlsx'] - 'xlsx' | 'csv'
 * @returns {Promise<void>}
 */
export async function downloadExportFile({
  filename = "Export_Data",
  sheetName = "Data",
  columns = [],
  rowsData = [],
  rows = [],
  format = "xlsx",
}) {
  const finalRows = (rowsData && rowsData.length > 0) ? rowsData : (rows || []);
  if (!finalRows || !finalRows.length) {
    throw new Error("Tidak ada data yang dapat diexport.");
  }
  rowsData = finalRows;

  const cleanFilename = (filename || "Export_Data").replace(/[^\w.\-]/g, "_");

  // 1. FORMAT: EXCEL (.xlsx)
  if (format === "xlsx") {
    if (!window.ExcelJS && !window.XLSX) {
      await ensureSpreadsheetLibraries();
    }
    // If ExcelJS is available, use it for styled navy header & borders
    if (window.ExcelJS) {
      const workbook = new window.ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(sheetName);

      worksheet.columns = columns.map((col) => ({
        header: col.header,
        key: col.key,
        width: col.width || 18,
      }));

      // Header row styling: Navy #0B2B6A with white bold text
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0B2B6A" },
      };
      headerRow.height = 28;

      // Add data rows
      rowsData.forEach((rowObj) => {
        worksheet.addRow(rowObj);
      });

      // Cell border & alignment styling
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          row.height = 22;
        }
        row.eachCell((cell, colNumber) => {
          if (rowNumber !== 1) {
            cell.alignment = { vertical: "middle", wrapText: false };
            // If first column (No), center it
            if (colNumber === 1) {
              cell.alignment = { vertical: "middle", horizontal: "center" };
            }
          }
          cell.border = {
            top: { style: "thin", color: { argb: "FFD1D5DB" } },
            left: { style: "thin", color: { argb: "FFD1D5DB" } },
            bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
            right: { style: "thin", color: { argb: "FFD1D5DB" } },
          };
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      triggerBlobDownload(blob, `${cleanFilename}.xlsx`);
      return;
    }

    // Fallback if SheetJS is available
    if (window.XLSX) {
      // Map row objects using column headers
      const sheetData = rowsData.map((rowObj) => {
        const item = {};
        columns.forEach((col) => {
          item[col.header] = rowObj[col.key] !== undefined ? rowObj[col.key] : "";
        });
        return item;
      });
      const ws = window.XLSX.utils.json_to_sheet(sheetData);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, sheetName);
      window.XLSX.writeFile(wb, `${cleanFilename}.xlsx`);
      return;
    }

    throw new Error(
      "Library export spreadsheet (SheetJS / ExcelJS) belum dimuat pada halaman ini."
    );
  }

  // 2. FORMAT: CSV (.csv)
  const headerKeys = columns.map((c) => c.key);
  const headerLabels = columns.map((c) => c.header);

  let csvContent = "\uFEFF"; // UTF-8 BOM for Excel compatibility

  if (window.XLSX) {
    const csvRows = rowsData.map((rowObj) => {
      const item = {};
      columns.forEach((col) => {
        item[col.header] = rowObj[col.key] !== undefined ? rowObj[col.key] : "";
      });
      return item;
    });
    const ws = window.XLSX.utils.json_to_sheet(csvRows);
    csvContent += window.XLSX.utils.sheet_to_csv(ws);
  } else {
    // Standard RFC-4180 CSV builder
    const escapeCsvCell = (val) => {
      const str = val === null || val === undefined ? "" : String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    csvContent += headerLabels.map(escapeCsvCell).join(",") + "\r\n";
    rowsData.forEach((row) => {
      const line = headerKeys
        .map((k) => escapeCsvCell(row[k]))
        .join(",");
      csvContent += line + "\r\n";
    });
  }

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  triggerBlobDownload(blob, `${cleanFilename}.csv`);
}

/**
 * Trigger browser file download from Blob.
 * @param {Blob} blob
 * @param {string} fileName
 */
export function triggerBlobDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Wire the Export Modal Segmented Controls & Inputs.
 * Supports both standard HR picker layout and Marketing segmented controls.
 * @param {Object} options
 * @param {string} options.modalId
 * @param {string} [options.formatInputId]
 * @param {string} [options.rangeInputId]
 * @param {string} [options.customDateContainerId]
 * @param {string} [options.startDateInputId]
 * @param {string} [options.endDateInputId]
 * @param {string} [options.submitBtnId]
 * @param {Function} [options.onFormatChange]
 * @param {Function} [options.onRangeChange]
 */
export function setupExportModalControls({
  modalId = "exportDataModal",
  formatInputId,
  rangeInputId,
  customDateContainerId,
  startDateInputId,
  endDateInputId,
  submitBtnId,
  onFormatChange,
  onRangeChange,
} = {}) {
  const modalEl = document.getElementById(modalId);
  if (!modalEl) return;

  const currentYearMonth = new Date().toISOString().substring(0, 7);
  const monthInput = modalEl.querySelector(".export-month-input, #exportMonthInput, [id$='MonthInput'], input[type='month']");
  const weekMonthInput = modalEl.querySelector(".export-week-month-input, #exportWeekMonthInput, [id$='WeekMonthInput']");

  if (monthInput && !monthInput.value) monthInput.value = currentYearMonth;
  if (weekMonthInput && !weekMonthInput.value) weekMonthInput.value = currentYearMonth;

  let currentFormat = "xlsx";
  let currentRange = "all";

  // Elements for format
  const formatButtons = modalEl.querySelectorAll("[data-format]");
  const formatInput = formatInputId
    ? document.getElementById(formatInputId)
    : modalEl.querySelector('input[name="exportFormat"]');
  const downloadBtnText = modalEl.querySelector(".download-btn-text, #exportSubmitBtnText");
  const helpAllText = modalEl.querySelector(".export-help-all, #exportAllHelpText");
  const helpMonthText = modalEl.querySelector(".export-help-month, #exportMonthHelpText");
  const helpWeekText = modalEl.querySelector(".export-help-week, #exportWeekHelpText");

  const setFormat = (fmt) => {
    currentFormat = fmt === "csv" ? "csv" : "xlsx";
    formatButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.format === currentFormat);
    });

    if (formatInput) {
      formatInput.value = currentFormat;
    }

    if (downloadBtnText) {
      downloadBtnText.textContent =
        currentFormat === "xlsx" ? "Download Excel (.xlsx)" : "Download CSV (.csv)";
    }
    if (helpMonthText) {
      helpMonthText.textContent = `Semua pengajuan pada bulan yang dipilih akan dimasukkan ke dalam file ${currentFormat.toUpperCase()}.`;
    }
    if (helpWeekText) {
      helpWeekText.textContent = `Semua pengajuan pada minggu yang dipilih akan dimasukkan ke dalam file ${currentFormat.toUpperCase()}.`;
    }
    if (typeof onFormatChange === "function") onFormatChange(currentFormat);
  };

  formatButtons.forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();
      setFormat(btn.dataset.format);
    };
  });

  // Elements for range
  const rangeButtons = modalEl.querySelectorAll("[data-range]");
  const rangeInput = rangeInputId
    ? document.getElementById(rangeInputId)
    : modalEl.querySelector('input[name="exportRange"]');
  const customDateContainer = customDateContainerId
    ? document.getElementById(customDateContainerId)
    : modalEl.querySelector(
        '.export-custom-date-container, [id$="CustomDateContainer"], #exportInvoiceCustomDateContainer, #exportReferralCustomDateContainer'
      );

  const sectionAll = modalEl.querySelector(".section-all-picker, #sectionAllPicker, [id$='AllPicker']");
  const sectionMonth = modalEl.querySelector(".section-month-picker, #sectionMonthPicker, [id$='MonthPicker']");
  const sectionWeek = modalEl.querySelector(".section-week-picker, #sectionWeekPicker, [id$='WeekPicker']");

  const setRange = (rType) => {
    currentRange = rType || "all";

    rangeButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.range === currentRange);
    });

    if (rangeInput) {
      rangeInput.value = currentRange;
    }

    if (customDateContainer) {
      customDateContainer.style.display = currentRange === "custom" ? "" : "none";
    }

    if (sectionAll) sectionAll.style.display = currentRange === "all" ? "block" : "none";
    if (sectionMonth) sectionMonth.style.display = currentRange === "month" ? "block" : "none";
    if (sectionWeek) sectionWeek.style.display = currentRange === "week" ? "block" : "none";

    if (typeof onRangeChange === "function") onRangeChange(currentRange);
  };

  rangeButtons.forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();
      setRange(btn.dataset.range);
    };
  });

  // Determine initial active states
  const activeFmtBtn = modalEl.querySelector("[data-format].active");
  setFormat(activeFmtBtn?.dataset.format || "xlsx");

  const activeRangeBtn = modalEl.querySelector("[data-range].active");
  setRange(activeRangeBtn?.dataset.range || "all");

  return {
    getFormData: () => {
      const weekSelect = modalEl.querySelector(".export-week-select, #exportWeekSelect, [id$='WeekSelect'], select[name='week']");
      const statusFilter = modalEl.querySelector(
        ".export-status-filter, #exportStatusFilter, [id$='StatusFilter'], select[name='status']"
      );
      const dataTypeSelect = modalEl.querySelector(
        ".export-data-type, #exportDataType, [id$='DataType'], select[name='dataType']"
      );

      const startDateEl = startDateInputId
        ? document.getElementById(startDateInputId)
        : modalEl.querySelector('[id$="StartDate"], input[name="startDate"]');
      const endDateEl = endDateInputId
        ? document.getElementById(endDateInputId)
        : modalEl.querySelector('[id$="EndDate"], input[name="endDate"]');

      return {
        format: currentFormat,
        rangeType: currentRange,
        dateRange: currentRange,
        range: currentRange,
        month: monthInput?.value || currentYearMonth,
        weekMonth: weekMonthInput?.value || currentYearMonth,
        week: parseInt(weekSelect?.value || "1", 10),
        startDate: startDateEl?.value || "",
        endDate: endDateEl?.value || "",
        status: (statusFilter?.value || "").toLowerCase().trim(),
        dataType: dataTypeSelect?.value || "all",
      };
    },
    setLoading: (loading) => {
      const submitBtn = submitBtnId
        ? document.getElementById(submitBtnId)
        : modalEl.querySelector('button[type="submit"]');
      if (!submitBtn) return;
      if (loading) {
        submitBtn.disabled = true;
        const spinner = submitBtn.querySelector(".spinner-border");
        if (spinner) {
          spinner.classList.remove("d-none");
        } else {
          submitBtn.dataset.origHtml = submitBtn.innerHTML;
          submitBtn.innerHTML =
            '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Memproses...';
        }
      } else {
        submitBtn.disabled = false;
        const spinner = submitBtn.querySelector(".spinner-border");
        if (spinner) {
          spinner.classList.add("d-none");
        } else if (submitBtn.dataset.origHtml) {
          submitBtn.innerHTML = submitBtn.dataset.origHtml;
        }
      }
    },
  };
}

/**
 * Mount universal export modal into document body if not already present.
 * @param {Object} config
 * @param {string} config.modalId - e.g. "exportInvoiceModal"
 * @param {string} config.moduleTitle - e.g. "Create Invoice"
 * @param {string} [config.dataTypeLabel] - e.g. "Data Invoice"
 * @param {Array<{ value: string, label: string }>} [config.statusOptions] - status filter options
 * @param {string} [config.statusFilterLabel="FILTER STATUS"]
 * @param {boolean} [config.enableDateRange=true] - true for transactional, false for static master
 * @returns {HTMLElement}
 */
export function mountExportModalHtml({
  modalId = "exportDataModal",
  moduleTitle = "Data Laporan",
  dataTypeLabel = "Data Laporan",
  statusOptions = [],
  statusFilterLabel = "FILTER STATUS",
  enableDateRange = true,
}) {
  let modalEl = document.getElementById(modalId);
  if (modalEl) return modalEl;

  const dateRangeHtml = enableDateRange
    ? `
      <!-- PILIHAN RENTANG WAKTU -->
      <div>
        <label class="export-section-label">PILIHAN RENTANG WAKTU</label>
        <div class="export-segmented-control">
          <button type="button" class="export-segmented-btn active" data-range="all">
            <i class="bi bi-globe"></i> Semua Data
          </button>
          <button type="button" class="export-segmented-btn" data-range="month">
            <i class="bi bi-calendar3"></i> Per Bulan
          </button>
          <button type="button" class="export-segmented-btn" data-range="week">
            <i class="bi bi-calendar-week"></i> Per Minggu
          </button>
        </div>
      </div>

      <!-- SECTION: SEMUA DATA -->
      <div class="section-all-picker" style="display: block;">
        <div class="p-3 rounded-3" style="background-color: #f8fafc; border: 1px dashed #cbd5e1;">
          <div class="d-flex align-items-center gap-2 text-primary small fw-semibold">
            <i class="bi bi-info-circle-fill"></i>
            <span>Ekspor Semua ${dataTypeLabel}</span>
          </div>
          <small class="text-muted d-block mt-1 export-help-all" style="font-size: 0.75rem;">
            Semua data ${dataTypeLabel.toLowerCase()} dari awal hingga saat ini akan dimasukkan ke dalam file export tanpa batasan tanggal.
          </small>
        </div>
      </div>

      <!-- SECTION: PILIH BULAN -->
      <div class="section-month-picker" style="display: none;">
        <label class="export-section-label">PILIH BULAN &amp; TAHUN</label>
        <input type="month" class="form-control export-input export-month-input shadow-none w-100">
        <small class="text-muted d-block mt-1 export-help-month" style="font-size: 0.75rem;">
          Semua data pada bulan yang dipilih akan dimasukkan ke dalam file Excel.
        </small>
      </div>

      <!-- SECTION: PILIH MINGGU -->
      <div class="section-week-picker" style="display: none;">
        <div class="row g-2">
          <div class="col-6">
            <label class="export-section-label">BULAN &amp; TAHUN</label>
            <input type="month" class="form-control export-input export-week-month-input shadow-none w-100">
          </div>
          <div class="col-6">
            <label class="export-section-label">PILIH MINGGU</label>
            <select class="form-select export-select export-week-select shadow-none">
              <option value="1">Minggu 1 (Tgl 1 - 7)</option>
              <option value="2">Minggu 2 (Tgl 8 - 14)</option>
              <option value="3">Minggu 3 (Tgl 15 - 21)</option>
              <option value="4">Minggu 4 (Tgl 22 - 28)</option>
              <option value="5">Minggu 5 (Tgl 29 - Akhir Bulan)</option>
            </select>
          </div>
        </div>
        <small class="text-muted d-block mt-1 export-help-week" style="font-size: 0.75rem;">
          Semua data pada minggu yang dipilih akan dimasukkan ke dalam file Excel.
        </small>
      </div>
    `
    : `
      <!-- SECTION: SEMUA DATA MASTER -->
      <div class="section-all-picker" style="display: block;">
        <div class="p-3 rounded-3" style="background-color: #f8fafc; border: 1px dashed #cbd5e1;">
          <div class="d-flex align-items-center gap-2 text-primary small fw-semibold">
            <i class="bi bi-info-circle-fill"></i>
            <span>Ekspor Master ${dataTypeLabel}</span>
          </div>
          <small class="text-muted d-block mt-1 export-help-all" style="font-size: 0.75rem;">
            Seluruh data master ${dataTypeLabel.toLowerCase()} saat ini akan dimasukkan ke dalam file export.
          </small>
        </div>
      </div>
    `;

  let statusFilterSection = "";
  if (Array.isArray(statusOptions) && statusOptions.length > 0) {
    const optionsHtml = statusOptions
      .map((opt) => `<option value="${opt.value}">${opt.label}</option>`)
      .join("");
    statusFilterSection = `
      <!-- FILTER STATUS -->
      <div>
        <label class="export-section-label">${statusFilterLabel}</label>
        <select class="form-select export-select export-status-filter shadow-none">
          <option value="">Semua status</option>
          ${optionsHtml}
        </select>
      </div>
    `;
  }

  const modalHtml = `
    <div class="modal fade" id="${modalId}" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered export-modal-dialog">
        <div class="modal-content export-modal-content shadow-lg">
          <div class="modal-body p-4">
            <!-- Header -->
            <div class="d-flex align-items-start justify-content-between mb-4">
              <div class="d-flex align-items-center gap-3">
                <div class="export-icon-box">
                  <i class="fa-solid fa-file-excel"></i>
                </div>
                <div>
                  <h5 class="fw-bold mb-1 text-dark" style="font-size: 1.15rem;">Export Data (Excel / CSV)</h5>
                  <p class="text-muted small mb-0" style="font-size: 0.8rem;">Pilih format file, periode, dan jenis data ${moduleTitle}</p>
                </div>
              </div>
              <button type="button" class="btn-close shadow-none" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>

            <!-- Form Export -->
            <form class="export-data-form d-flex flex-column gap-3">
              <!-- FORMAT FILE -->
              <div>
                <label class="export-section-label">FORMAT FILE</label>
                <div class="export-segmented-control">
                  <button type="button" class="export-segmented-btn active" data-format="xlsx">
                    <i class="bi bi-file-earmark-excel text-success"></i> Excel (.xlsx)
                  </button>
                  <button type="button" class="export-segmented-btn" data-format="csv">
                    <i class="bi bi-file-earmark-text text-primary"></i> CSV (.csv)
                  </button>
                </div>
              </div>

              <!-- DATA YANG DIEXPORT -->
              <div>
                <label class="export-section-label">DATA YANG DIEXPORT</label>
                <select class="form-select export-select export-data-type shadow-none">
                  <option value="all">${dataTypeLabel}</option>
                </select>
              </div>

              ${dateRangeHtml}
              ${statusFilterSection}

              <!-- FOOTER BUTTONS -->
              <div class="d-flex align-items-center justify-content-between gap-3 mt-3 pt-2">
                <button type="button" class="btn btn-cancel-export flex-fill" data-bs-dismiss="modal">Batalkan</button>
                <button type="submit" class="btn btn-download-export flex-fill">
                  <i class="bi bi-download"></i> <span class="download-btn-text">Download Excel (.xlsx)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);
  return document.getElementById(modalId);
}
