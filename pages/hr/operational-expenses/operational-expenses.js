// pages/hr/operational-expenses/operational-expenses.js
// =====================================================================
// ORCHESTRATOR LAYER: OPERATIONAL EXPENSES
// Wires authentication, shared foundation, repository, and UI layers.
// =====================================================================

import { requireAuth } from "/assets/js/auth-guard.js";
import { renderTopbar } from "/assets/js/components/topbar/topbar.js";
import { renderSidebar } from "/assets/js/components/sidebar/sidebar.js";
import {
  buildWhatsappDeepLink,
  normalizeWhatsappMessage,
  normalizeWhatsappNumber
} from "/element/whatsapp-encoding.js";

import * as repo from "./operational-expenses.repository.js";
import * as ui from "./operational-expenses.ui.js";

// --- Module State ---
let allExpenses = [];
let requesterOptions = [];
let mentorOptions = [];
let classOptions = [];

const filterState = {
  searchQuery: "",
  filterStatus: "all",
  filterCategory: "all",
  filterDate: "",
  filterDateStart: "",
  filterDateEnd: ""
};

const dateNavState = {
  anchor: new Date()
};

const sortState = {
  key: "",
  direction: "asc"
};

const paginationState = {
  currentPage: 1,
  pageSize: 15,
  totalItems: 0
};

let currentEditingExpense = null;
let isEditMode = false;
let isSaving = false;

// --- Date Window Helper ---
function formatIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function calculateDateWindow(anchorDate) {
  const base = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
  const windowDays = [];
  for (let offset = -2; offset <= 2; offset++) {
    const day = addDays(base, offset);
    windowDays.push({
      date: day,
      iso: formatIsoDate(day),
      label: String(day.getDate())
    });
  }
  return windowDays;
}

// --- Sorters ---
const normalizeText = (val) => String(val || "").trim().toLowerCase();
const compareText = (a, b) => String(a || "").localeCompare(String(b || ""), "id", { sensitivity: "base" });

const sorters = {
  request: (a, b) =>
    compareText(
      normalizeText(a.title || a.requesterName || a.id),
      normalizeText(b.title || b.requesterName || b.id)
    ),
  destination: (a, b) =>
    compareText(
      normalizeText(a.beneficiaryName || a.bankName || a.accountNumber),
      normalizeText(b.beneficiaryName || b.bankName || b.accountNumber)
    ),
  amount: (a, b) => {
    const diff = (Number(a.amount) || 0) - (Number(b.amount) || 0);
    if (diff) return diff;
    return compareText(String(a.dueDate || ""), String(b.dueDate || ""));
  },
  notes: (a, b) =>
    compareText(
      normalizeText(a.notes || a.paymentNotes || ""),
      normalizeText(b.notes || b.paymentNotes || "")
    ),
  status: (a, b) =>
    compareText(normalizeText(a.status || ""), normalizeText(b.status || ""))
};

// --- WhatsApp Helper ---
function buildMentorWhatsappMessage({ mentorName, className, proofUrl }) {
  const safeProofUrl = String(proofUrl || "").trim();
  const lines = [
    `Halo Kak ${mentorName || "-"},`,
    "",
    `Kami ingin menginformasikan bahwa gaji mentor untuk kelas ${className || "-"} sudah kami transfer.`,
    "",
    "Silakan dicek kembali rekeningnya. Terima kasih atas kontribusi dan dedikasinya dalam membimbing kelas."
  ];
  if (safeProofUrl) {
    lines.push("", "Bukti transfer:", safeProofUrl);
  }
  return normalizeWhatsappMessage(lines.join("\n"));
}

function buildMentorWhatsappPayload({ mentorName, className, proofUrl, phoneNumber }) {
  const normalizedPhone = normalizeWhatsappNumber(phoneNumber);
  const message = buildMentorWhatsappMessage({ mentorName, className, proofUrl });
  return {
    phoneNumber: normalizedPhone,
    message,
    link: normalizedPhone ? buildWhatsappDeepLink(normalizedPhone, message) : ""
  };
}

// --- Data Filtering & Rendering ---
function calculateStats(expenses) {
  const pending = expenses.filter((item) => {
    const stat = ui.displayStatus(item);
    return stat === "requested" || stat === "reviewing";
  }).length;
  const overdue = expenses.filter((item) => ui.displayStatus(item) === "overdue").length;
  const paid = expenses.filter(
    (item) => item.status === "paid" || item.status === "complete"
  ).length;
  const amount = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  return {
    total: expenses.length,
    pending,
    overdue,
    paid,
    amount
  };
}

function getIsoDueDate(raw) {
  if (!raw) return "";
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    const ymd = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (ymd) {
      return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
    }
    const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmy) {
      return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, "0");
      const d = String(parsed.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return trimmed.slice(0, 10);
  }
  if (typeof raw?.toDate === "function") {
    const d = raw.toDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  if (typeof raw === "number") {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
  }
  return "";
}

function handleClearDate() {
  filterState.filterDate = "";
  filterState.filterDateStart = "";
  filterState.filterDateEnd = "";
  const startInput = document.getElementById("filterDateStart");
  const endInput = document.getElementById("filterDateEnd");
  if (startInput) startInput.value = "";
  if (endInput) endInput.value = "";
  updateDatePills();
  paginationState.currentPage = 1;
  applyFiltersAndRender();
}

function applyFiltersAndRender() {
  const q = filterState.searchQuery.trim().toLowerCase();

  const filtered = allExpenses.filter((expense) => {
    const currentStatus = ui.displayStatus(expense);
    const matchStatus =
      filterState.filterStatus === "all" || currentStatus === filterState.filterStatus;
    const matchCategory =
      filterState.filterCategory === "all" || expense.category === filterState.filterCategory;

    const dueDate = getIsoDueDate(expense.dueDate);
    const hasRange = !!(filterState.filterDateStart || filterState.filterDateEnd);
    const matchRange =
      !hasRange ||
      (!!dueDate &&
        (!filterState.filterDateStart || dueDate >= filterState.filterDateStart) &&
        (!filterState.filterDateEnd || dueDate <= filterState.filterDateEnd));

    const matchDate =
      (!filterState.filterDate || dueDate === filterState.filterDate) && matchRange;

    const matchQuery =
      !q ||
      [
        expense.title,
        expense.requesterName,
        expense.relatedClass,
        expense.mentorName,
        expense.bankName,
        expense.accountNumber,
        expense.beneficiaryName,
        expense.notes,
        expense.paymentNotes,
        expense.vendorName,
        expense.expensePeriod,
        expense.reimburseType,
        expense.reimburseReason,
        expense.toolName,
        expense.billingPeriod,
        expense.travelerName,
        expense.travelDate,
        expense.travelRoute,
        expense.referenceLabel,
        expense.referenceDetail
      ].some((field) => String(field || "").toLowerCase().includes(q));

    return matchStatus && matchCategory && matchDate && matchQuery;
  });

  // Sorting
  if (sortState.key && sorters[sortState.key]) {
    filtered.sort(sorters[sortState.key]);
    if (sortState.direction === "desc") {
      filtered.reverse();
    }
  }

  // Update Stats
  ui.renderStats(calculateStats(allExpenses));

  // Pagination Slice
  paginationState.totalItems = filtered.length;
  const totalPages = Math.ceil(paginationState.totalItems / paginationState.pageSize) || 1;
  if (paginationState.currentPage > totalPages) {
    paginationState.currentPage = totalPages;
  }

  const startIndex = (paginationState.currentPage - 1) * paginationState.pageSize;
  const paginatedItems = filtered.slice(startIndex, startIndex + paginationState.pageSize);

  // Render Table & Pagination
  ui.renderTable(paginatedItems, {
    sortKey: sortState.key,
    sortDirection: sortState.direction,
    activeDate: filterState.filterDate,
    onClearDate: handleClearDate,
    onOpenDetail: handleOpenEdit,
    onMarkReviewing: handleMarkReviewing,
    onSendWhatsapp: handleSendWhatsapp
  });

  ui.renderPagination(paginationState, (newPage) => {
    paginationState.currentPage = newPage;
    applyFiltersAndRender();
  });
}

function updateDatePills() {
  const windowDays = calculateDateWindow(dateNavState.anchor);
  ui.renderDatePills(windowDays, filterState.filterDate, (selectedIso) => {
    filterState.filterDate = filterState.filterDate === selectedIso ? "" : selectedIso;
    filterState.filterDateStart = "";
    filterState.filterDateEnd = "";
    const startInput = document.getElementById("filterDateStart");
    const endInput = document.getElementById("filterDateEnd");
    if (startInput) startInput.value = "";
    if (endInput) endInput.value = "";
    updateDatePills();
    paginationState.currentPage = 1;
    applyFiltersAndRender();
  });
}

// --- Data Fetching ---
async function loadAllData() {
  try {
    allExpenses = await repo.loadExpenses();
    applyFiltersAndRender();
  } catch (error) {
    console.error("[OperationalExpenses] Gagal memuat expenses:", error);
    ui.showToast("Gagal memuat data expense.");
  }

  // Load auxiliary options in parallel without blocking the main table
  try {
    const [usersRes, mentorsRes, classesRes] = await Promise.allSettled([
      repo.loadRequesterOptions(),
      repo.loadMentorOptions(),
      repo.loadClassOptions()
    ]);

    if (usersRes.status === "fulfilled" && Array.isArray(usersRes.value)) {
      requesterOptions = usersRes.value;
    }
    if (mentorsRes.status === "fulfilled" && Array.isArray(mentorsRes.value)) {
      mentorOptions = mentorsRes.value;
    }
    if (classesRes.status === "fulfilled" && Array.isArray(classesRes.value)) {
      classOptions = classesRes.value;
    }

    enrichExpensesWithMentorBank();
    applyFiltersAndRender();
  } catch (optError) {
    console.warn("[OperationalExpenses] Gagal memuat data opsi dropdown:", optError);
  }
}

function enrichExpensesWithMentorBank() {
  allExpenses.forEach((expense) => {
    if (expense.category !== "mentor_salary") return;
    if (expense.bankName && expense.accountNumber) return;
    let mentorOpt = null;
    if (expense.mentorId) {
      mentorOpt = mentorOptions.find((m) => m.id === expense.mentorId);
    }
    if (!mentorOpt && expense.mentorName) {
      const nameNorm = normalizeText(expense.mentorName);
      mentorOpt = mentorOptions.find((m) => normalizeText(m.name) === nameNorm);
    }
    if (mentorOpt && mentorOpt.bankInfo) {
      if (!expense.beneficiaryName) expense.beneficiaryName = mentorOpt.bankInfo.beneficiaryName || "";
      if (!expense.bankName) expense.bankName = mentorOpt.bankInfo.bankName || "";
      if (!expense.accountNumber) expense.accountNumber = mentorOpt.bankInfo.accountNumber || "";
    }
  });
}

// --- Drawer Open & Close Handlers ---
function createEmptyForm() {
  return {
    id: "",
    title: "",
    category: "mentor_salary",
    department: "HR Division",
    requesterId: "",
    requesterName: "",
    classId: "",
    relatedClass: "",
    mentorId: "",
    mentorName: "",
    dueDate: "",
    amount: 0,
    status: "requested",
    beneficiaryName: "",
    bankName: "",
    accountNumber: "",
    paymentMethod: "Transfer Bank",
    transferProofUrl: "",
    transferProofPath: "",
    mentorWhatsapp: "",
    whatsappMessage: "",
    whatsappLink: "",
    notes: "",
    paymentNotes: "",
    vendorName: "",
    expensePeriod: "",
    reimburseType: "",
    reimburseReason: "",
    reimburseProofUrl: "",
    reimburseProofPath: "",
    toolName: "",
    billingPeriod: "",
    travelerName: "",
    travelDate: "",
    travelRoute: "",
    referenceLabel: "",
    referenceDetail: ""
  };
}

function handleOpenCreate() {
  isEditMode = false;
  currentEditingExpense = null;
  const form = createEmptyForm();
  ui.populateDrawerForm(form, false);
  clearFileInputs();
  ui.openDrawer();
}

function handleOpenEdit(expenseId) {
  const expense = allExpenses.find((item) => item.id === expenseId);
  if (!expense) return;

  isEditMode = true;
  currentEditingExpense = { ...expense };

  // Fallback mentor WhatsApp if missing
  let fallbackMentorWa = expense.mentorWhatsapp || "";
  if (!normalizeWhatsappNumber(fallbackMentorWa) && expense.mentorId) {
    const mentorById = mentorOptions.find((item) => item.id === expense.mentorId);
    fallbackMentorWa = mentorById?.whatsappNumber || mentorById?.whatsapp || fallbackMentorWa;
  }
  if (!normalizeWhatsappNumber(fallbackMentorWa) && expense.mentorName) {
    const mentorByName = mentorOptions.find(
      (item) => normalizeText(item.name) === normalizeText(expense.mentorName)
    );
    fallbackMentorWa = mentorByName?.whatsappNumber || mentorByName?.whatsapp || fallbackMentorWa;
  }
  expense.mentorWhatsapp = normalizeWhatsappNumber(fallbackMentorWa) || fallbackMentorWa;

  ui.populateDrawerForm(expense, true);
  clearFileInputs();
  ui.openDrawer();
}

function clearFileInputs() {
  const proofFile = document.getElementById("proofFileInput");
  const reimburseFile = document.getElementById("reimburseProofInput");
  if (proofFile) proofFile.value = "";
  if (reimburseFile) reimburseFile.value = "";
}

// --- Autocomplete Selections ---
function selectRequester(opt) {
  document.getElementById("formRequesterId").value = opt.id;
  document.getElementById("formRequesterName").value = opt.name;
  document.getElementById("requesterSearchInput").value = opt.name;
  ui.hideSearchResults("requesterSearchResults");
}

function selectMentor(opt) {
  document.getElementById("formMentorId").value = opt.id;
  document.getElementById("formMentorName").value = opt.name;
  document.getElementById("mentorSearchInput").value = opt.name;
  document.getElementById("formMentorWhatsapp").value =
    opt.whatsappNumber || normalizeWhatsappNumber(opt.whatsapp || "") || "";

  if (opt.bankInfo) {
    document.getElementById("formBeneficiaryName").value = opt.bankInfo.beneficiaryName || opt.name;
    document.getElementById("formBankName").value = opt.bankInfo.bankName || "";
    document.getElementById("formAccountNumber").value = opt.bankInfo.accountNumber || "";
  }

  ui.toggleCategoryPanels(document.getElementById("formCategory").value);
  ui.hideSearchResults("mentorSearchResults");
}

function selectClass(opt) {
  document.getElementById("formClassId").value = opt.id;
  document.getElementById("formRelatedClass").value = opt.name;
  document.getElementById("classSearchInput").value = opt.name;
  ui.hideSearchResults("classSearchResults");
}

// --- Form Validation ---
function validateDrawerForm() {
  const title = document.getElementById("formTitle")?.value.trim();
  const requester = document.getElementById("formRequesterName")?.value.trim();
  const beneficiary = document.getElementById("formBeneficiaryName")?.value.trim();
  const bank = document.getElementById("formBankName")?.value.trim();
  const account = document.getElementById("formAccountNumber")?.value.trim();
  const amountDigits = String(document.getElementById("formAmount")?.value || "").replace(/\D/g, "");
  const amount = parseInt(amountDigits, 10) || 0;
  const category = document.getElementById("formCategory")?.value;
  const status = document.getElementById("formStatus")?.value;

  if (!title) {
    alert("Judul pengeluaran wajib diisi.");
    return false;
  }
  if (!requester) {
    alert("Requester / PIC wajib diisi.");
    return false;
  }
  if (!beneficiary) {
    alert("Nama penerima rekening wajib diisi.");
    return false;
  }
  if (!bank || !account) {
    alert("Bank dan nomor rekening tujuan wajib diisi.");
    return false;
  }
  if (amount <= 0) {
    alert("Nominal pengeluaran wajib lebih dari 0.");
    return false;
  }

  const proofFile = document.getElementById("proofFileInput")?.files?.[0];
  const reimburseFile = document.getElementById("reimburseProofInput")?.files?.[0];
  const existingTransferProof = currentEditingExpense?.transferProofUrl;
  const existingReimburseProof = currentEditingExpense?.reimburseProofUrl;

  if (category === "reimburse" && !existingReimburseProof && !reimburseFile) {
    alert("Untuk kategori reimburse, nota/kwitansi wajib dilampirkan.");
    return false;
  }

  if (category === "mentor_salary") {
    const relatedClass = document.getElementById("formRelatedClass")?.value.trim();
    const mentorId = document.getElementById("formMentorId")?.value.trim();
    const mentorName = document.getElementById("formMentorName")?.value.trim();

    if (!relatedClass) {
      alert("Related class wajib diisi untuk mentor salary.");
      return false;
    }
    if (!mentorId) {
      alert("Pilih mentor dari dropdown agar rekening tujuan sinkron dengan data mentor.");
      return false;
    }
    if (!mentorName) {
      alert("Mentor name wajib diisi untuk mentor salary.");
      return false;
    }
  }

  if ((status === "paid" || status === "complete") && !existingTransferProof && !proofFile) {
    alert("Untuk status paid, bukti transfer wajib dilampirkan.");
    return false;
  }

  return true;
}

// --- Save Expense Handler ---
async function handleSaveExpense() {
  if (isSaving) return;
  if (!validateDrawerForm()) return;

  isSaving = true;
  const saveBtn = document.getElementById("btnSaveExpense");
  if (saveBtn) {
    saveBtn.textContent = "Menyimpan...";
    saveBtn.disabled = true;
  }

  const expenseId =
    isEditMode && currentEditingExpense?.id
      ? currentEditingExpense.id
      : `OPS-${Date.now()}`;

  try {
    const proofFile = document.getElementById("proofFileInput")?.files?.[0];
    const reimburseFile = document.getElementById("reimburseProofInput")?.files?.[0];

    let transferProofUrl = currentEditingExpense?.transferProofUrl || "";
    let transferProofPath = currentEditingExpense?.transferProofPath || "";
    let reimburseProofUrl = currentEditingExpense?.reimburseProofUrl || "";
    let reimburseProofPath = currentEditingExpense?.reimburseProofPath || "";

    if (proofFile) {
      const uploadRes = await repo.uploadTransferProof(expenseId, proofFile);
      if (uploadRes) {
        transferProofUrl = uploadRes.url;
        transferProofPath = uploadRes.path;
      }
    }

    if (reimburseFile) {
      const uploadRes = await repo.uploadReimburseProof(expenseId, reimburseFile);
      if (uploadRes) {
        reimburseProofUrl = uploadRes.url;
        reimburseProofPath = uploadRes.path;
      }
    }

    let statusVal = document.getElementById("formStatus")?.value || "requested";
    if (proofFile && statusVal !== "paid" && statusVal !== "complete" && statusVal !== "rejected") {
      statusVal = "paid";
      ui.showToast("Bukti transfer terdeteksi → status otomatis diubah ke Paid");
    }

    const amountDigits = String(document.getElementById("formAmount")?.value || "").replace(/\D/g, "");
    const amountVal = parseInt(amountDigits, 10) || 0;
    const nowMs = Date.now();

    const mentorNameVal = document.getElementById("formMentorName")?.value.trim() || "";
    const relatedClassVal = document.getElementById("formRelatedClass")?.value.trim() || "";
    const mentorWaVal = document.getElementById("formMentorWhatsapp")?.value.trim() || "";

    const waPayload = buildMentorWhatsappPayload({
      mentorName: mentorNameVal,
      className: relatedClassVal,
      proofUrl: transferProofUrl,
      phoneNumber: mentorWaVal
    });

    const payload = {
      title: document.getElementById("formTitle")?.value.trim() || "",
      category: document.getElementById("formCategory")?.value.trim() || "other",
      department: document.getElementById("formDepartment")?.value.trim() || "General",
      requesterId: document.getElementById("formRequesterId")?.value.trim() || "",
      requesterName: document.getElementById("formRequesterName")?.value.trim() || "",
      classId: document.getElementById("formClassId")?.value.trim() || "",
      relatedClass: relatedClassVal,
      mentorId: document.getElementById("formMentorId")?.value.trim() || "",
      mentorName: mentorNameVal,
      dueDate: document.getElementById("formDueDate")?.value.trim() || "",
      amount: amountVal,
      status: statusVal,
      beneficiaryName: document.getElementById("formBeneficiaryName")?.value.trim() || "",
      bankName: document.getElementById("formBankName")?.value.trim() || "",
      accountNumber: document.getElementById("formAccountNumber")?.value.trim() || "",
      paymentMethod: document.getElementById("formPaymentMethod")?.value.trim() || "Transfer Bank",
      transferProofUrl,
      transferProofPath,
      mentorWhatsapp: normalizeWhatsappNumber(mentorWaVal),
      whatsappMessage: waPayload.message || "",
      whatsappLink: waPayload.link || "",
      notes: document.getElementById("formNotes")?.value.trim() || "",
      paymentNotes: document.getElementById("formPaymentNotes")?.value.trim() || "",
      vendorName: document.getElementById("formVendorName")?.value.trim() || "",
      expensePeriod: document.getElementById("formExpensePeriod")?.value.trim() || "",
      reimburseType: document.getElementById("formReimburseType")?.value.trim() || "",
      reimburseReason: document.getElementById("formReimburseReason")?.value.trim() || "",
      reimburseProofUrl,
      reimburseProofPath,
      toolName: document.getElementById("formToolName")?.value.trim() || "",
      billingPeriod: document.getElementById("formBillingPeriod")?.value.trim() || "",
      travelerName: document.getElementById("formTravelerName")?.value.trim() || "",
      travelDate: document.getElementById("formTravelDate")?.value.trim() || "",
      travelRoute: document.getElementById("formTravelRoute")?.value.trim() || "",
      referenceLabel: document.getElementById("formReferenceLabel")?.value.trim() || "",
      referenceDetail: document.getElementById("formReferenceDetail")?.value.trim() || "",
      updatedAtMs: nowMs
    };

    if (!isEditMode) {
      payload.createdAtMs = nowMs;
    }

    if (payload.status === "paid" || payload.status === "complete") {
      payload.paidAtMs = nowMs;
    }

    const previousStatus = currentEditingExpense?.status || "";
    const isNew = !isEditMode;
    const justPaidOrComplete =
      !isNew &&
      previousStatus !== "paid" &&
      previousStatus !== "complete" &&
      (payload.status === "paid" || payload.status === "complete");

    await repo.saveExpenseDoc(expenseId, payload);

    if (isNew) {
      repo.sendDiscordExpenseNotification({ id: expenseId, ...payload });
    }

    if (justPaidOrComplete) {
      repo.sendDiscordPaidNotification({ id: expenseId, ...payload });
    }

    ui.showToast(isEditMode ? "Expense berhasil diperbarui" : "Expense request berhasil dibuat");
    ui.closeDrawer();
    await loadAllData();
  } catch (error) {
    console.error("[OperationalExpenses] Gagal menyimpan expense:", error);
    alert("Gagal menyimpan expense request. Silakan coba lagi.");
  } finally {
    isSaving = false;
    if (saveBtn) {
      saveBtn.textContent = isEditMode ? "Update Expense" : "Create Expense";
      saveBtn.disabled = false;
    }
  }
}

// --- Delete Expense Handler ---
async function handleDeleteExpense() {
  if (!isEditMode || !currentEditingExpense?.id) return;
  if (!confirm("Hapus expense ini? Data yang sudah dihapus tidak bisa dikembalikan.")) return;

  isSaving = true;
  const delBtn = document.getElementById("btnDeleteExpense");
  if (delBtn) delBtn.disabled = true;

  try {
    if (currentEditingExpense.transferProofPath) {
      await repo.deleteStorageFile(currentEditingExpense.transferProofPath);
    }
    if (currentEditingExpense.reimburseProofPath) {
      await repo.deleteStorageFile(currentEditingExpense.reimburseProofPath);
    }

    await repo.deleteExpenseDoc(currentEditingExpense.id);
    ui.showToast("Expense berhasil dihapus");
    ui.closeDrawer();
    await loadAllData();
  } catch (error) {
    console.error("[OperationalExpenses] Gagal menghapus expense:", error);
    alert("Gagal menghapus expense.");
  } finally {
    isSaving = false;
    if (delBtn) delBtn.disabled = false;
  }
}

// --- Status & Action Handlers ---
async function handleMarkReviewing(expenseId) {
  try {
    await repo.saveExpenseDoc(expenseId, {
      status: "reviewing",
      updatedAtMs: Date.now()
    });
    ui.showToast("Status diubah ke reviewing");
    await loadAllData();
  } catch (error) {
    console.error("[OperationalExpenses] Gagal ubah status reviewing:", error);
    alert("Gagal mengubah status expense.");
  }
}

async function handleSendWhatsapp(expenseId) {
  const expense = allExpenses.find((item) => item.id === expenseId);
  if (!expense || expense.category !== "mentor_salary") return;

  let phoneNumber = normalizeWhatsappNumber(expense.mentorWhatsapp || "");
  if (!phoneNumber && expense.mentorId) {
    const mOpt = mentorOptions.find((m) => m.id === expense.mentorId);
    phoneNumber = mOpt?.whatsappNumber || normalizeWhatsappNumber(mOpt?.whatsapp || "");
  }
  if (!phoneNumber && expense.mentorName) {
    const mOpt = mentorOptions.find((m) => normalizeText(m.name) === normalizeText(expense.mentorName));
    phoneNumber = mOpt?.whatsappNumber || normalizeWhatsappNumber(mOpt?.whatsapp || "");
  }

  if (!phoneNumber) {
    alert("Nomor WhatsApp mentor tidak tersedia atau tidak valid di collection mentor.");
    return;
  }
  if (!expense.transferProofUrl) {
    alert("Bukti transfer belum tersedia untuk dikirim ke mentor.");
    return;
  }

  const waPayload = buildMentorWhatsappPayload({
    mentorName: expense.mentorName,
    className: expense.relatedClass,
    proofUrl: expense.transferProofUrl,
    phoneNumber
  });

  if (!waPayload.link) {
    alert("Gagal membuat link WhatsApp mentor.");
    return;
  }

  try {
    await repo.saveExpenseDoc(expense.id, {
      status: "complete",
      mentorWhatsapp: phoneNumber,
      whatsappMessage: waPayload.message,
      whatsappLink: waPayload.link,
      updatedAtMs: Date.now()
    });
    await loadAllData();
    window.open(waPayload.link, "_blank", "noopener");
    ui.showToast("WhatsApp mentor siap dikirim. Bukti transfer sudah disisipkan dalam pesan.");
  } catch (error) {
    console.error("[OperationalExpenses] Gagal menyiapkan WhatsApp mentor:", error);
    alert("Gagal menyiapkan WhatsApp mentor.");
  }
}

// --- Wire Event Listeners ---
function setupEventListeners() {
  // Search and Filter controls
  const searchInput = document.getElementById("searchQuery");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      filterState.searchQuery = e.target.value;
      paginationState.currentPage = 1;
      applyFiltersAndRender();
    });
  }

  const statusSelect = document.getElementById("filterStatus");
  if (statusSelect) {
    statusSelect.addEventListener("change", (e) => {
      filterState.filterStatus = e.target.value;
      if (filterState.filterStatus === "overdue") {
        filterState.searchQuery = "";
        filterState.filterCategory = "all";
        filterState.filterDate = "";
        filterState.filterDateStart = "";
        filterState.filterDateEnd = "";
        if (searchInput) searchInput.value = "";
        const catSelect = document.getElementById("filterCategory");
        if (catSelect) catSelect.value = "all";
        const startInp = document.getElementById("filterDateStart");
        if (startInp) startInp.value = "";
        const endInp = document.getElementById("filterDateEnd");
        if (endInp) endInp.value = "";
        updateDatePills();
      }
      paginationState.currentPage = 1;
      applyFiltersAndRender();
    });
  }

  const categorySelect = document.getElementById("filterCategory");
  if (categorySelect) {
    categorySelect.addEventListener("change", (e) => {
      filterState.filterCategory = e.target.value;
      paginationState.currentPage = 1;
      applyFiltersAndRender();
    });
  }

  const startInput = document.getElementById("filterDateStart");
  if (startInput) {
    startInput.addEventListener("change", (e) => {
      filterState.filterDateStart = e.target.value;
      if (e.target.value) {
        filterState.filterDate = "";
        updateDatePills();
      }
      paginationState.currentPage = 1;
      applyFiltersAndRender();
    });
  }

  const endInput = document.getElementById("filterDateEnd");
  if (endInput) {
    endInput.addEventListener("change", (e) => {
      filterState.filterDateEnd = e.target.value;
      if (e.target.value) {
        filterState.filterDate = "";
        updateDatePills();
      }
      paginationState.currentPage = 1;
      applyFiltersAndRender();
    });
  }

  const clearDateBtn = document.getElementById("btnClearDateFilter");
  if (clearDateBtn) {
    clearDateBtn.addEventListener("click", () => {
      filterState.filterDate = "";
      filterState.filterDateStart = "";
      filterState.filterDateEnd = "";
      if (startInput) startInput.value = "";
      if (endInput) endInput.value = "";
      updateDatePills();
      paginationState.currentPage = 1;
      applyFiltersAndRender();
    });
  }

  const dateNavPrev = document.getElementById("btnDateNavPrev");
  if (dateNavPrev) {
    dateNavPrev.addEventListener("click", () => {
      dateNavState.anchor = addDays(dateNavState.anchor, -1);
      updateDatePills();
    });
  }

  const dateNavNext = document.getElementById("btnDateNavNext");
  if (dateNavNext) {
    dateNavNext.addEventListener("click", () => {
      dateNavState.anchor = addDays(dateNavState.anchor, 1);
      updateDatePills();
    });
  }

  // Table Sort Headers
  const sortKeys = ["request", "destination", "amount", "notes", "status"];
  sortKeys.forEach((key) => {
    const btn = document.getElementById(`sortBtn-${key}`);
    if (btn) {
      btn.addEventListener("click", () => {
        if (sortState.key !== key) {
          sortState.key = key;
          sortState.direction = "asc";
        } else {
          sortState.direction = sortState.direction === "asc" ? "desc" : "asc";
        }
        applyFiltersAndRender();
      });
    }
  });

  // Action Buttons
  const refreshBtn = document.getElementById("btnRefreshData");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      loadAllData();
      ui.showToast("Memperbarui data expense...");
    });
  }

  const newExpenseBtn = document.getElementById("btnNewExpense");
  if (newExpenseBtn) {
    newExpenseBtn.addEventListener("click", handleOpenCreate);
  }

  // Drawer Buttons
  const closeDrawerBtn = document.getElementById("btnCloseDrawer");
  if (closeDrawerBtn) closeDrawerBtn.addEventListener("click", ui.closeDrawer);

  const cancelDrawerBtn = document.getElementById("btnCancelDrawer");
  if (cancelDrawerBtn) cancelDrawerBtn.addEventListener("click", ui.closeDrawer);

  const saveExpenseBtn = document.getElementById("btnSaveExpense");
  if (saveExpenseBtn) saveExpenseBtn.addEventListener("click", handleSaveExpense);

  const deleteExpenseBtn = document.getElementById("btnDeleteExpense");
  if (deleteExpenseBtn) deleteExpenseBtn.addEventListener("click", handleDeleteExpense);

  // Drawer backdrop click
  const drawerBackdrop = document.getElementById("expenseDrawer");
  if (drawerBackdrop) {
    drawerBackdrop.addEventListener("click", (e) => {
      if (e.target === drawerBackdrop) {
        ui.closeDrawer();
      }
    });
  }

  // Form Amount Formatter
  const formAmountInput = document.getElementById("formAmount");
  if (formAmountInput) {
    formAmountInput.addEventListener("input", (e) => {
      const digits = e.target.value.replace(/\D/g, "");
      e.target.value = digits ? ui.formatCurrency(parseInt(digits, 10)) : "";
    });
  }

  // Form Category Change
  const formCategorySelect = document.getElementById("formCategory");
  if (formCategorySelect) {
    formCategorySelect.addEventListener("change", (e) => {
      ui.toggleCategoryPanels(e.target.value);
    });
  }

  // Autocomplete Inputs
  setupAutocompleteInputs();
}

function setupAutocompleteInputs() {
  // Requester Autocomplete
  const reqInput = document.getElementById("requesterSearchInput");
  if (reqInput) {
    reqInput.addEventListener("input", (e) => {
      const q = normalizeText(e.target.value);
      document.getElementById("formRequesterName").value = e.target.value;
      document.getElementById("formRequesterId").value = "";
      const matches = requesterOptions
        .filter((item) => !q || item.search.includes(q))
        .slice(0, 8);
      ui.renderSearchResults("requesterSearchResults", matches, selectRequester);
    });
    reqInput.addEventListener("focus", () => {
      const q = normalizeText(reqInput.value);
      const matches = requesterOptions
        .filter((item) => !q || item.search.includes(q))
        .slice(0, 8);
      ui.renderSearchResults("requesterSearchResults", matches, selectRequester);
    });
    reqInput.addEventListener("blur", () => {
      setTimeout(() => ui.hideSearchResults("requesterSearchResults"), 150);
    });
  }

  // Mentor Autocomplete
  const mentorInput = document.getElementById("mentorSearchInput");
  if (mentorInput) {
    mentorInput.addEventListener("input", (e) => {
      const q = normalizeText(e.target.value);
      document.getElementById("formMentorName").value = e.target.value;
      document.getElementById("formMentorId").value = "";
      const matches = mentorOptions
        .filter((item) => !q || item.search.includes(q))
        .slice(0, 8);
      ui.renderSearchResults("mentorSearchResults", matches, selectMentor);
    });
    mentorInput.addEventListener("focus", () => {
      const q = normalizeText(mentorInput.value);
      const matches = mentorOptions
        .filter((item) => !q || item.search.includes(q))
        .slice(0, 8);
      ui.renderSearchResults("mentorSearchResults", matches, selectMentor);
    });
    mentorInput.addEventListener("blur", () => {
      setTimeout(() => ui.hideSearchResults("mentorSearchResults"), 150);
    });
  }

  // Class Autocomplete
  const classInput = document.getElementById("classSearchInput");
  if (classInput) {
    classInput.addEventListener("input", (e) => {
      const q = normalizeText(e.target.value);
      document.getElementById("formRelatedClass").value = e.target.value;
      document.getElementById("formClassId").value = "";
      const matches = classOptions
        .filter((item) => !q || item.search.includes(q))
        .slice(0, 8);
      ui.renderSearchResults("classSearchResults", matches, selectClass);
    });
    classInput.addEventListener("focus", () => {
      const q = normalizeText(classInput.value);
      const matches = classOptions
        .filter((item) => !q || item.search.includes(q))
        .slice(0, 8);
      ui.renderSearchResults("classSearchResults", matches, selectClass);
    });
    classInput.addEventListener("blur", () => {
      setTimeout(() => ui.hideSearchResults("classSearchResults"), 150);
    });
  }
}

// --- Initialization ---
async function init() {
  try {
    const { user, role } = await requireAuth();

    // Mount Topbar and Sidebar
    renderTopbar({ user, role });
    renderSidebar({ role, activePage: "operational-expenses" });

    // Initial Date Filter: default ke tanggal 1 (anchor date) sesuai instruksi
    filterState.filterDate = formatIsoDate(dateNavState.anchor);

    // Setup Listeners & Initial Date Window
    setupEventListeners();
    updateDatePills();

    // Fetch live data
    await loadAllData();
  } catch (error) {
    console.error("[OperationalExpenses] Initialization failed:", error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
