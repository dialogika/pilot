/**
 * Leads Management - UI (Presentation Layer)
 * 
 * Pure Presentation Layer.
 * Interacts only with DOM elements, formatters, and event triggers.
 * ZERO direct Firebase imports or network calls.
 */

/* =========================================================================
   FORMATTERS & UTILITIES
   ========================================================================= */

export function formatCurrencyId(value) {
  const num = typeof value === "number" ? value : parseInt(value, 10) || 0;
  return num.toLocaleString("id-ID");
}

export function parseDateInputValue(value) {
  if (!value) return null;
  const parts = String(value).split("-");
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const date = new Date(y, m, d);
  if (isNaN(date.getTime())) return null;
  return date;
}

export function normalizeDate(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatDateIndonesian(date) {
  const days = [
    "Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"
  ];
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  return (
    days[date.getDay()] +
    ", " +
    date.getDate() +
    " " +
    months[date.getMonth()] +
    " " +
    date.getFullYear()
  );
}

export function formatDateTimeMs(ms) {
  if (!ms || typeof ms !== "number" || ms <= 0) return "-";
  const date = new Date(ms);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID");
}

export function formatPhoneDisplay(number) {
  if (!number) return "-";
  const raw = String(number).trim();
  if (!raw) return "-";
  let num = raw.replace(/[^0-9+]/g, "");
  if (num.startsWith("+62")) return "0" + num.substring(3);
  if (num.startsWith("62")) return "0" + num.substring(2);
  return num;
}

export function formatWhatsAppLink(number) {
  if (!number) return "#";
  let num = String(number).trim();
  if (num.startsWith("0")) {
    num = "+62" + num.substring(1);
  }
  if (num.startsWith("+")) {
    num = num.substring(1);
  }
  num = num.replace(/[^0-9]/g, "");
  return "https://wa.me/" + num;
}

export function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function mapVerificationStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  if (key === "legit") return "Legit";
  if (key === "scam") return "Scam";
  if (key === "not_verified") return "Not Verified";
  return "-";
}

export function formatAssignedPic(lead, usersMap = {}) {
  const ids = Array.isArray(lead && lead.assigned_ids) ? lead.assigned_ids : [];
  if (!ids.length) return "-";
  const names = ids.map((id) => usersMap[id] || id).filter(Boolean);
  return names.length ? names.join(", ") : "-";
}

export function resolveOriginalPrice(programName, inv, productCatalog = {}) {
  let originalPrice = 0;
  const rawProgramName = inv && inv.productName ? inv.productName : programName || "";
  let progKey = String(rawProgramName).trim().toLowerCase();
  let cleanProgKey = progKey.replace(/\s+(online|offline|kids|class)$/i, "").trim();

  if (productCatalog[cleanProgKey] && productCatalog[cleanProgKey].base_price > 0) {
    originalPrice = productCatalog[cleanProgKey].base_price;
  } else if (productCatalog[progKey] && productCatalog[progKey].base_price > 0) {
    originalPrice = productCatalog[progKey].base_price;
  } else if (inv && typeof inv.basePrice === "number" && inv.basePrice > 0) {
    originalPrice = inv.basePrice;
  }
  return originalPrice;
}

export function resolveInvoiceWhatsapp(inv, allLeads = []) {
  const fromInvoice = String(
    inv.enrollmentWhatsapp ||
    inv.whatsapp ||
    inv.leadWhatsapp ||
    inv.phone ||
    ""
  ).trim();
  if (fromInvoice) return fromInvoice;

  const leadNameKey = String(inv.leadName || "").trim().toLowerCase();
  if (!leadNameKey) return "";
  const matchedLead = allLeads.find((lead) => {
    return String(lead.name || "").trim().toLowerCase() === leadNameKey;
  });
  return matchedLead && matchedLead.whatsapp ? String(matchedLead.whatsapp).trim() : "";
}

export function resolveInvoiceBatchProgram(inv) {
  const batch = String(inv.batchLabel || "").trim();
  if (batch) return batch;
  const className = String(inv.className || "").trim();
  if (className) return className;
  return "-";
}

export function resolveInvoiceScheduleFromBatch(inv) {
  const fromApi = String(
    inv.batchSchedule ||
    inv.classSchedule ||
    inv.schedule ||
    inv.sessionSchedule ||
    ""
  ).trim();
  if (fromApi) return fromApi;

  const batchRaw = String(inv.batchLabel || "").trim();
  if (!batchRaw) return "-";

  const separators = [" - ", " – ", " — ", " | ", " • "];
  for (let i = 0; i < separators.length; i += 1) {
    const sep = separators[i];
    if (batchRaw.includes(sep)) {
      const parts = batchRaw
        .split(sep)
        .map((s) => String(s).trim())
        .filter(Boolean);
      if (parts.length > 1) {
        return parts.slice(1).join(" - ");
      }
    }
  }
  const classMetaRaw = String(inv.classMeta || "").trim();
  if (classMetaRaw.includes("•")) {
    const parts = classMetaRaw
      .split("•")
      .map((s) => String(s).trim())
      .filter(Boolean);
    if (parts.length > 2) {
      return parts.slice(2).join(" • ");
    }
  }
  return "-";
}

/* =========================================================================
   PRESENTATION RENDERERS
   ========================================================================= */

/**
 * Render KPI summary cards
 */
export function renderDashboardStats({
  leadsCount,
  leadsWeekCount,
  referralUsedCount,
  proofUploadedCount,
  verifiedCount,
  conversionRate
}) {
  const statLeadsTodayEl = document.getElementById("statLeadsToday");
  const statLeadsThisWeekEl = document.getElementById("statLeadsThisWeek");
  const statReferralUsedEl = document.getElementById("statReferralUsed");
  const statProofUploadedEl = document.getElementById("statProofUploaded");
  const statVerifiedPaymentEl = document.getElementById("statVerifiedPayment");
  const statNextToVerifiedRateEl = document.getElementById("statNextToVerifiedRate");

  if (statLeadsTodayEl) statLeadsTodayEl.textContent = String(leadsCount);
  if (statLeadsThisWeekEl) statLeadsThisWeekEl.textContent = String(leadsWeekCount);
  if (statReferralUsedEl) statReferralUsedEl.textContent = String(referralUsedCount);
  if (statProofUploadedEl) statProofUploadedEl.textContent = String(proofUploadedCount);
  if (statVerifiedPaymentEl) statVerifiedPaymentEl.textContent = String(verifiedCount);
  if (statNextToVerifiedRateEl) statNextToVerifiedRateEl.textContent = conversionRate + "%";
}

/**
 * Populate Program Filter Options and Manual Add Program Dropdown
 */
export function populateProgramDropdowns(allLeads = [], allInvoices = []) {
  const filterProgramNext = document.getElementById("filterProgramNext");
  const manualAddProgram = document.getElementById("manualAddProgram");

  const allPrograms = new Set();
  (allLeads || []).forEach((lead) => {
    const name = String(lead.interest_program || "").trim();
    if (name) allPrograms.add(name);
  });
  (allInvoices || []).forEach((inv) => {
    const name = String(inv.productName || "").trim();
    if (name) allPrograms.add(name);
  });

  const sorted = Array.from(allPrograms).sort();

  if (filterProgramNext) {
    const currentVal = filterProgramNext.value;
    filterProgramNext.innerHTML = '<option value="">Semua Program</option>';
    sorted.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      filterProgramNext.appendChild(opt);
    });
    if (currentVal && allPrograms.has(currentVal)) {
      filterProgramNext.value = currentVal;
    }
  }

  if (manualAddProgram) {
    manualAddProgram.innerHTML = '<option value="">Pilih Program...</option>';
    sorted.forEach((name) => {
      const optAdd = document.createElement("option");
      optAdd.value = name;
      optAdd.textContent = name;
      manualAddProgram.appendChild(optAdd);
    });
  }
}

/**
 * Render Next Payment Pipeline Table
 */
export function renderNextPaymentTable({
  leads = [],
  invoices = [],
  dateRange,
  searchTerm = "",
  programFilter = "",
  onEditLead,
  onDeleteLead
}) {
  const tableBody = document.getElementById("tableNextPaymentBody");
  if (!tableBody) return;
  tableBody.innerHTML = "";

  const startMs = dateRange.start.getTime();
  const endMs = dateRange.end.getTime();
  const term = searchTerm.toLowerCase().trim();

  // Filter leads by date range, program filter, and search keyword
  const filteredLeads = leads.filter((lead) => {
    if (!lead.createdDate) return false;
    const d = normalizeDate(lead.createdDate);
    if (!d) return false;
    const dMs = d.getTime();
    if (dMs < startMs || dMs > endMs) return false;
    if (programFilter && String(lead.interest_program || "") !== programFilter) {
      return false;
    }
    if (!term) return true;
    const name = String(lead.name || "").toLowerCase();
    const program = String(lead.interest_program || "").toLowerCase();
    return name.includes(term) || program.includes(term);
  });

  // Invoice enrichment map
  const invoiceByLead = {};
  invoices.forEach((inv) => {
    const key = String(inv.leadName || "").trim().toLowerCase();
    if (key) {
      if (!invoiceByLead[key]) invoiceByLead[key] = [];
      invoiceByLead[key].push(inv);
    }
  });

  if (!filteredLeads.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.className = "text-center text-slate-400 py-3";
    td.textContent = "Belum ada leads untuk range tanggal ini.";
    tr.appendChild(td);
    tableBody.appendChild(tr);
    return;
  }

  filteredLeads.forEach((lead) => {
    const tr = document.createElement("tr");

    // 1. Nama
    const tdName = document.createElement("td");
    tdName.textContent = lead.name || "-";

    // 2. Program
    const tdProgram = document.createElement("td");
    tdProgram.textContent = lead.interest_program || "-";

    // 3. Stage
    const tdStage = document.createElement("td");
    const stage = lead.stage || "LEADS";
    const stageBadge = document.createElement("span");
    const stageKey = stage.toLowerCase();
    let badgeClass = "bg-slate-100 text-slate-600";
    if (stageKey === "leads") badgeClass = "bg-blue-100 text-blue-700";
    else if (stageKey === "next_payment" || stageKey === "next payment")
      badgeClass = "bg-amber-100 text-amber-700";
    else if (stageKey === "paid" || stageKey === "verified")
      badgeClass = "bg-emerald-100 text-emerald-700";
    stageBadge.className = "px-2 py-0.5 rounded-md text-[10px] font-bold " + badgeClass;
    stageBadge.textContent = stage;
    tdStage.appendChild(stageBadge);

    // 4. Referral Code
    const leadKey = String(lead.name || "").trim().toLowerCase();
    const matchedInvoices = invoiceByLead[leadKey] || [];
    const inv = matchedInvoices.length ? matchedInvoices[0] : null;

    const tdReferral = document.createElement("td");
    const refCode = lead.referral_code || (inv && inv.referralCode) || "";
    if (refCode && String(refCode).trim() !== "") {
      const badge = document.createElement("span");
      badge.className =
        "px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-700";
      badge.textContent = refCode;
      tdReferral.appendChild(badge);
    } else {
      tdReferral.textContent = "-";
    }

    // 5. WhatsApp
    const tdWa = document.createElement("td");
    if (lead.whatsapp) {
      const displayNumber = formatPhoneDisplay(lead.whatsapp);
      const a = document.createElement("a");
      a.href = formatWhatsAppLink(lead.whatsapp);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.className = "text-indigo-600 font-semibold hover:underline";
      a.textContent = displayNumber;
      tdWa.appendChild(a);
    } else {
      tdWa.textContent = "-";
    }

    // 6. Actions
    const tdActions = document.createElement("td");
    tdActions.className = "text-nowrap";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn-sm btn-outline-primary me-1";
    editBtn.innerHTML = '<i class="bi bi-pencil-square"></i>';
    editBtn.addEventListener("click", () => onEditLead(lead.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-sm btn-outline-danger";
    deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
    deleteBtn.addEventListener("click", () => onDeleteLead(lead.id));

    tdActions.appendChild(editBtn);
    tdActions.appendChild(deleteBtn);

    tr.appendChild(tdName);
    tr.appendChild(tdProgram);
    tr.appendChild(tdStage);
    tr.appendChild(tdReferral);
    tr.appendChild(tdWa);
    tr.appendChild(tdActions);

    tableBody.appendChild(tr);
  });

  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

/**
 * Render Upload Bukti Transfer Table
 */
export function renderUploadProofTable({
  invoices = [],
  leads = [],
  productCatalog = {},
  dateRange,
  searchTerm = "",
  onShowDetail,
  onEditInvoice,
  onDeleteInvoice
}) {
  const tableBody = document.getElementById("tableUploadProofBody");
  if (!tableBody) return;
  tableBody.innerHTML = "";

  const startMs = dateRange.start.getTime();
  const endMs = dateRange.end.getTime();
  const term = searchTerm.toLowerCase().trim();

  const rawInvoices = invoices.filter((inv) => {
    if (!inv.transferProofUrl) return false;
    let invDate = null;
    if (inv.paidAtMs && inv.paidAtMs > 0) {
      invDate = normalizeDate(new Date(inv.paidAtMs));
    } else if (inv.createdAtMs && inv.createdAtMs > 0) {
      invDate = normalizeDate(new Date(inv.createdAtMs));
    }
    if (!invDate) return false;
    const invMs = invDate.getTime();
    if (invMs < startMs || invMs > endMs) return false;
    if (!term) return true;

    const name = String(inv.leadName || "").toLowerCase();
    const program = String(inv.productName || "").toLowerCase();
    const batchProgram = String(inv.batchLabel || inv.className || "").toLowerCase();
    const schedule = String(resolveInvoiceScheduleFromBatch(inv) || "").toLowerCase();
    return (
      name.includes(term) ||
      program.includes(term) ||
      batchProgram.includes(term) ||
      schedule.includes(term)
    );
  });

  // Group by leadName + productName
  const groupedMap = {};
  rawInvoices.forEach((inv) => {
    const key =
      String(inv.leadName || "").trim().toLowerCase() +
      "||" +
      String(inv.productName || "").trim().toLowerCase();
    if (!groupedMap[key]) {
      groupedMap[key] = Object.assign({}, inv, { _groupedIds: [inv.id] });
    } else {
      const existing = groupedMap[key];
      existing._groupedIds.push(inv.id);
      if ((inv.paidAmount || 0) > (existing.paidAmount || 0))
        existing.paidAmount = inv.paidAmount;
      if (!existing.batchLabel && inv.batchLabel) existing.batchLabel = inv.batchLabel;
      if (!existing.className && inv.className) existing.className = inv.className;
      if (!existing.batchSchedule && inv.batchSchedule) existing.batchSchedule = inv.batchSchedule;
      if (!existing.classSchedule && inv.classSchedule) existing.classSchedule = inv.classSchedule;
      if (!existing.schedule && inv.schedule) existing.schedule = inv.schedule;
      if (!existing.sessionSchedule && inv.sessionSchedule) existing.sessionSchedule = inv.sessionSchedule;
      if (!existing.classMeta && inv.classMeta) existing.classMeta = inv.classMeta;
      if (!existing.paymentMethod && inv.paymentMethod) existing.paymentMethod = inv.paymentMethod;
      if (!existing.bankName && inv.bankName) existing.bankName = inv.bankName;
      if (!existing.enrollmentWhatsapp && inv.enrollmentWhatsapp) existing.enrollmentWhatsapp = inv.enrollmentWhatsapp;
      if (!existing.transferProofUrl && inv.transferProofUrl) existing.transferProofUrl = inv.transferProofUrl;
      if ((inv.finalBasePrice || 0) > (existing.finalBasePrice || 0))
        existing.finalBasePrice = inv.finalBasePrice;
      if ((inv.basePrice || 0) > (existing.basePrice || 0))
        existing.basePrice = inv.basePrice;
    }
  });

  const groupedInvoices = Object.values(groupedMap);

  if (!groupedInvoices.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 10;
    td.className = "text-center text-slate-400 py-3";
    td.textContent = "Belum ada bukti transfer untuk range tanggal ini.";
    tr.appendChild(td);
    tableBody.appendChild(tr);
    return;
  }

  groupedInvoices.forEach((inv) => {
    const tr = document.createElement("tr");

    // 1. Nama
    const tdName = document.createElement("td");
    tdName.textContent = inv.leadName || "-";

    // 2. Program
    const tdProgram = document.createElement("td");
    const leadNameKey = String(inv.leadName || "").trim().toLowerCase();
    const matchedLead = leads.find(
      (l) => String(l.name || "").trim().toLowerCase() === leadNameKey
    );
    tdProgram.textContent =
      matchedLead && matchedLead.interest_program
        ? matchedLead.interest_program
        : inv.productName || "-";

    // 3. Batch Program
    const tdBatchProgram = document.createElement("td");
    tdBatchProgram.textContent = resolveInvoiceBatchProgram(inv);

    // 4. Jadwal
    const tdJadwal = document.createElement("td");
    tdJadwal.textContent = resolveInvoiceScheduleFromBatch(inv);

    // 5. Nominal
    const tdNominal = document.createElement("td");
    const amount = inv.paidAmount || inv.finalBasePrice || 0;
    tdNominal.textContent = amount > 0 ? "Rp " + formatCurrencyId(amount) : "-";

    // 6. Harga Asli
    const tdHargaAsli = document.createElement("td");
    const originalPrice = resolveOriginalPrice(
      inv.productName || "",
      inv,
      productCatalog
    );
    tdHargaAsli.textContent =
      originalPrice > 0 ? "Rp " + formatCurrencyId(originalPrice) : "-";

    // 7. Metode
    const tdMethod = document.createElement("td");
    const methodParts = [];
    if (inv.paymentMethod) methodParts.push(inv.paymentMethod);
    if (inv.bankName) methodParts.push(inv.bankName);
    tdMethod.textContent = methodParts.join(" • ") || "-";

    // 8. WA
    const tdWa = document.createElement("td");
    const number = resolveInvoiceWhatsapp(inv, leads);
    if (number) {
      tdWa.textContent = formatPhoneDisplay(number);
    } else {
      tdWa.textContent = "-";
    }

    // 9. Detail
    const tdDetail = document.createElement("td");
    const detailBtn = document.createElement("button");
    detailBtn.type = "button";
    detailBtn.className = "btn btn-sm btn-outline-primary";
    detailBtn.textContent = "Detail";
    detailBtn.addEventListener("click", () => onShowDetail(inv, matchedLead));
    tdDetail.appendChild(detailBtn);

    // 10. Actions
    const tdActions = document.createElement("td");
    tdActions.className = "text-nowrap";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn-sm btn-outline-primary me-1";
    editBtn.innerHTML = '<i class="bi bi-pencil-square"></i>';
    editBtn.addEventListener("click", () => onEditInvoice(inv.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-sm btn-outline-danger";
    deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
    deleteBtn.addEventListener("click", () =>
      onDeleteInvoice(inv._groupedIds || [inv.id])
    );

    tdActions.appendChild(editBtn);
    tdActions.appendChild(deleteBtn);

    tr.appendChild(tdName);
    tr.appendChild(tdProgram);
    tr.appendChild(tdBatchProgram);
    tr.appendChild(tdJadwal);
    tr.appendChild(tdNominal);
    tr.appendChild(tdHargaAsli);
    tr.appendChild(tdMethod);
    tr.appendChild(tdWa);
    tr.appendChild(tdDetail);
    tr.appendChild(tdActions);

    tableBody.appendChild(tr);
  });

  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

/**
 * Render Detail Invoice Modal Content
 */
export function renderInvoiceDetailModalContent(
  invData,
  leadData,
  usersMap = {},
  productCatalog = {}
) {
  const phoneNumber = resolveInvoiceWhatsapp(invData, leadData ? [leadData] : []);
  const scheduleText = resolveInvoiceScheduleFromBatch(invData);
  const batchText = resolveInvoiceBatchProgram(invData);
  const dealAmount = invData.paidAmount || invData.finalBasePrice || 0;
  const basePrice = resolveOriginalPrice(
    invData.productName || "",
    invData,
    productCatalog
  );
  const proofUrl = String(invData.transferProofUrl || "").trim();
  const invoiceNumber = invData.invoiceNumber || invData.id || "-";
  const userName = (leadData && leadData.name) || invData.leadName || "-";
  const userProgram =
    (leadData && leadData.interest_program) || invData.productName || "-";
  const userStage = (leadData && leadData.stage) || "-";
  const userReferral = (leadData && leadData.referral_code) || "-";
  const userAds = (leadData && leadData.ads_channel) || "-";
  const userWhatsapp = phoneNumber || "-";
  const picNames = formatAssignedPic(leadData || {}, usersMap);

  const userCertificateName =
    (leadData && (leadData.peserta_name || leadData.certificate_name)) ||
    invData.pesertaName ||
    invData.peserta_name ||
    invData.certificate_name ||
    invData.nama_sertifikat ||
    "-";
  const userEmail =
    (leadData && (leadData.peserta_email || leadData.email)) ||
    invData.pesertaEmail ||
    invData.peserta_email ||
    invData.email ||
    "-";
  const userInstagram =
    (leadData && (leadData.peserta_ig || leadData.instagram)) ||
    invData.pesertaIg ||
    invData.peserta_ig ||
    invData.instagram ||
    invData.ig ||
    "-";
  const userJob =
    (leadData && (leadData.peserta_job || leadData.job)) ||
    invData.pesertaJob ||
    invData.peserta_job ||
    invData.job ||
    invData.pekerjaan ||
    "-";
  const userAge =
    (leadData && (leadData.peserta_age || leadData.age)) ||
    invData.pesertaAge ||
    invData.peserta_age ||
    invData.age ||
    invData.usia ||
    "-";
  const userGender =
    (leadData && (leadData.peserta_gender || leadData.gender)) ||
    invData.pesertaGender ||
    invData.peserta_gender ||
    invData.gender ||
    invData.jenis_kelamin ||
    "-";
  const userCity =
    (leadData && (leadData.peserta_city || leadData.city)) ||
    invData.pesertaCity ||
    invData.peserta_city ||
    invData.city ||
    "-";
  const userMaritalStatus =
    (leadData && (leadData.peserta_marital_status || leadData.marital_status)) ||
    invData.pesertaMaritalStatus ||
    invData.peserta_marital_status ||
    invData.marital_status ||
    invData.status_menikah ||
    "-";
  const userAdditionalInfo =
    (leadData && (leadData.notes_info || leadData.additional_info)) ||
    invData.notesInfo ||
    invData.notes_info ||
    invData.additional_info ||
    invData.informasi_tambahan ||
    invData.catatan ||
    "-";

  const proofHtml = proofUrl
    ? '<a href="' +
      escapeHtml(proofUrl) +
      '" target="_blank" rel="noopener noreferrer" class="text-blue-600 font-semibold underline">Lihat Bukti</a>'
    : "-";

  const userRows = [
    { label: "Nama User", value: userName },
    { label: "Nama untuk Sertifikat", value: userCertificateName },
    { label: "WhatsApp", value: userWhatsapp },
    { label: "Email", value: userEmail },
    { label: "Instagram", value: userInstagram },
    { label: "Pekerjaan", value: userJob },
    { label: "Usia", value: userAge },
    { label: "Gender", value: userGender },
    { label: "Kota Domisili", value: userCity },
    { label: "Status Menikah", value: userMaritalStatus },
    { label: "Program User", value: userProgram },
    { label: "Stage", value: userStage },
    { label: "Referral", value: userReferral },
    { label: "Ads Channel", value: userAds },
    { label: "PIC", value: picNames },
    { label: "Informasi Tambahan", value: userAdditionalInfo }
  ];

  const invoiceRows = [
    { label: "Invoice", value: invoiceNumber },
    { label: "Program Invoice", value: invData.productName || "-" },
    { label: "Batch Program", value: batchText },
    { label: "Jadwal", value: scheduleText },
    { label: "Payment Type", value: invData.paymentType || "-" },
    { label: "Metode", value: invData.paymentMethod || "-" },
    { label: "Bank", value: invData.bankName || "-" },
    {
      label: "Status Verifikasi",
      value: mapVerificationStatusLabel(invData.verificationStatus)
    },
    {
      label: "Nominal Bayar",
      value: dealAmount > 0 ? "Rp " + formatCurrencyId(dealAmount) : "-"
    },
    {
      label: "Harga Asli",
      value: basePrice > 0 ? "Rp " + formatCurrencyId(basePrice) : "-"
    },
    { label: "Dibuat", value: formatDateTimeMs(invData.createdAtMs) },
    { label: "Dibayar", value: formatDateTimeMs(invData.paidAtMs) },
    { label: "Bukti Transfer", value: proofHtml, isHtml: true }
  ];

  const renderRows = (rows) => {
    return rows
      .map((row) => {
        const displayValue = row.isHtml
          ? String(row.value || "-")
          : escapeHtml(row.value);
        return (
          "<tr>" +
          '<td class="py-2 pe-3 text-slate-500 font-semibold align-top" style="width: 140px;">' +
          escapeHtml(row.label) +
          "</td>" +
          '<td class="py-2 text-slate-800">' +
          displayValue +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  };

  return (
    '<div class="row g-3">' +
    '<div class="col-12 col-lg-6">' +
    '<div class="rounded-3xl border border-slate-200 bg-white p-4 h-100">' +
    '<div class="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3">Data User</div>' +
    '<div class="table-responsive"><table class="table table-borderless mb-0 text-sm">' +
    renderRows(userRows) +
    "</table></div>" +
    "</div>" +
    "</div>" +
    '<div class="col-12 col-lg-6">' +
    '<div class="rounded-3xl border border-slate-200 bg-white p-4 h-100">' +
    '<div class="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3">Data Invoice</div>' +
    '<div class="table-responsive"><table class="table table-borderless mb-0 text-sm">' +
    renderRows(invoiceRows) +
    "</table></div>" +
    "</div>" +
    "</div>" +
    "</div>"
  );
}

/**
 * Render Ads Channel list
 */
export function renderAdsChannelsList(adsChannels = [], onSelect, onDelete) {
  const container = document.getElementById("adsChannelList");
  if (!container) return;
  container.innerHTML = "";

  if (!adsChannels.length) {
    container.innerHTML =
      '<p class="text-[11px] text-slate-400 italic mb-0">Belum ada ads channel.</p>';
    return;
  }

  adsChannels.forEach((ch) => {
    const card = document.createElement("div");
    card.className =
      "flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm group cursor-pointer hover:border-indigo-200 transition";
    card.dataset.id = ch.id;

    const iconWrapper = document.createElement("div");
    iconWrapper.className = "bg-indigo-50 text-indigo-600 p-2 rounded-lg";
    iconWrapper.innerHTML = '<i data-lucide="megaphone" class="w-4 h-4"></i>';

    const textWrapper = document.createElement("div");
    textWrapper.className = "flex-1";

    const titleEl = document.createElement("p");
    titleEl.className = "text-sm font-semibold text-slate-800 mb-0";
    titleEl.textContent = ch.name;

    const metaEl = document.createElement("p");
    metaEl.className = "text-[10px] text-slate-400 font-mono italic mb-0";
    metaEl.textContent = "Value ID: " + ch.id;

    textWrapper.appendChild(titleEl);
    textWrapper.appendChild(metaEl);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className =
      "opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 transition";
    deleteBtn.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
    deleteBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      onDelete(ch.id);
    });

    card.appendChild(iconWrapper);
    card.appendChild(textWrapper);
    card.appendChild(deleteBtn);

    card.addEventListener("click", () => onSelect(ch));

    container.appendChild(card);
  });

  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

/**
 * Render Interests list
 */
export function renderInterestsList(
  interests = [],
  adsChannels = [],
  onSelect,
  onDelete
) {
  const container = document.getElementById("interestList");
  if (!container) return;
  container.innerHTML = "";

  if (!interests.length) {
    container.innerHTML =
      '<p class="text-[11px] text-slate-400 italic mb-0">Belum ada interest.</p>';
    return;
  }

  interests.forEach((it) => {
    const card = document.createElement("div");
    card.className =
      "flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm group cursor-pointer hover:border-emerald-200 transition";
    card.dataset.id = it.id;

    const iconWrapper = document.createElement("div");
    iconWrapper.className = "bg-emerald-50 text-emerald-600 p-2 rounded-lg";
    iconWrapper.innerHTML = '<i data-lucide="sparkles" class="w-4 h-4"></i>';

    const textWrapper = document.createElement("div");
    textWrapper.className = "flex-1";

    const titleEl = document.createElement("p");
    titleEl.className = "text-sm font-semibold text-slate-800 mb-0";
    titleEl.textContent = it.name;

    const channel = adsChannels.find((c) => c.id === it.ads_channel_id);
    const channelLabel = channel
      ? "Ads Channel: " + channel.name
      : "Ads Channel: Umum";

    const channelEl = document.createElement("p");
    channelEl.className = "text-[11px] text-slate-500 mb-0";
    channelEl.textContent = channelLabel;

    const metaEl = document.createElement("p");
    metaEl.className = "text-[10px] text-slate-400 font-mono italic mb-0";
    metaEl.textContent = "Value ID: " + it.id;

    textWrapper.appendChild(titleEl);
    textWrapper.appendChild(channelEl);
    textWrapper.appendChild(metaEl);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className =
      "opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 transition";
    deleteBtn.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
    deleteBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      onDelete(it.id);
    });

    card.appendChild(iconWrapper);
    card.appendChild(textWrapper);
    card.appendChild(deleteBtn);

    card.addEventListener("click", () => onSelect(it));

    container.appendChild(card);
  });

  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

/* =========================================================================
   CUSTOM MODALS & DIALOGS (REPLACING NATIVE ALERTS / CONFIRMS / PROMPTS)
   ========================================================================= */

let activeConfirmCallback = null;

/**
 * Show Action Confirmation Modal
 */
export function showConfirmModal({
  title = "Konfirmasi Tindakan",
  message = "Apakah Anda yakin ingin melanjutkan tindakan ini?",
  confirmText = "Ya, Lanjutkan",
  confirmClass = "bg-rose-600 hover:bg-rose-700 text-white",
  icon = "trash-2",
  iconWrapperClass = "bg-rose-50 text-rose-600",
  onConfirm
}) {
  const modalEl = document.getElementById("actionConfirmModal");
  if (!modalEl) return;

  const titleEl = document.getElementById("confirmModalTitle");
  const messageEl = document.getElementById("confirmModalMessage");
  const submitBtn = document.getElementById("confirmModalSubmitBtn");
  const iconWrapper = document.getElementById("confirmModalIconWrapper");

  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;

  if (submitBtn) {
    submitBtn.textContent = confirmText;
    submitBtn.className = `flex-1 px-4 py-2.5 rounded-xl font-bold text-xs transition shadow-sm ${confirmClass}`;
  }

  if (iconWrapper) {
    iconWrapper.className = `w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${iconWrapperClass}`;
    iconWrapper.innerHTML = `<i id="confirmModalIcon" data-lucide="${icon}" class="w-8 h-8"></i>`;
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  activeConfirmCallback = onConfirm;

  if (submitBtn) {
    submitBtn.onclick = () => {
      const modalInstance =
        window.bootstrap && window.bootstrap.Modal
          ? window.bootstrap.Modal.getInstance(modalEl)
          : null;
      if (modalInstance) modalInstance.hide();
      if (typeof activeConfirmCallback === "function") {
        activeConfirmCallback();
      }
    };
  }

  const modalInstance =
    window.bootstrap && window.bootstrap.Modal
      ? window.bootstrap.Modal.getOrCreateInstance(modalEl)
      : null;
  if (modalInstance) modalInstance.show();
}

/**
 * Show Notification Modal
 */
export function showNotificationModal({
  title = "Pemberitahuan",
  message = "",
  type = "success" // 'success' | 'danger' | 'info'
}) {
  const modalEl = document.getElementById("notificationModal");
  if (!modalEl) return;

  const titleEl = document.getElementById("notificationModalTitle");
  const messageEl = document.getElementById("notificationModalMessage");
  const iconWrapper = document.getElementById("notifModalIconWrapper");

  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;

  if (iconWrapper) {
    let iconName = "check-circle";
    let wrapperClass = "bg-emerald-50 text-emerald-600";
    if (type === "danger") {
      iconName = "alert-circle";
      wrapperClass = "bg-rose-50 text-rose-600";
    } else if (type === "info") {
      iconName = "info";
      wrapperClass = "bg-sky-50 text-sky-600";
    }
    iconWrapper.className = `w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${wrapperClass}`;
    iconWrapper.innerHTML = `<i id="notifModalIcon" data-lucide="${iconName}" class="w-8 h-8"></i>`;
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  const modalInstance =
    window.bootstrap && window.bootstrap.Modal
      ? window.bootstrap.Modal.getOrCreateInstance(modalEl)
      : null;
  if (modalInstance) modalInstance.show();
}

/**
 * Open & Populate Edit Lead Modal
 */
export function openEditLeadModal(lead) {
  const modalEl = document.getElementById("editLeadModal");
  if (!modalEl || !lead) return;

  const idInput = document.getElementById("editLeadId");
  const nameInput = document.getElementById("editLeadName");
  const cityInput = document.getElementById("editLeadCity");
  const programInput = document.getElementById("editLeadProgram");
  const stageInput = document.getElementById("editLeadStage");
  const whatsappInput = document.getElementById("editLeadWhatsapp");

  if (idInput) idInput.value = lead.id || "";
  if (nameInput) nameInput.value = lead.name || "";
  if (cityInput) cityInput.value = lead.city || "";
  if (programInput) programInput.value = lead.interest_program || "";
  if (stageInput) stageInput.value = lead.stage || "LEADS";
  if (whatsappInput) whatsappInput.value = lead.whatsapp || "";

  const modalInstance =
    window.bootstrap && window.bootstrap.Modal
      ? window.bootstrap.Modal.getOrCreateInstance(modalEl)
      : null;
  if (modalInstance) modalInstance.show();
}

export function closeEditLeadModal() {
  const modalEl = document.getElementById("editLeadModal");
  if (!modalEl) return;
  const modalInstance =
    window.bootstrap && window.bootstrap.Modal
      ? window.bootstrap.Modal.getInstance(modalEl)
      : null;
  if (modalInstance) modalInstance.hide();
}

/**
 * Open & Populate Edit Invoice Modal
 */
export function openEditInvoiceModal(invoice) {
  const modalEl = document.getElementById("editInvoiceModal");
  if (!modalEl || !invoice) return;

  const idInput = document.getElementById("editInvoiceId");
  const leadNameInput = document.getElementById("editInvoiceLeadName");
  const productNameInput = document.getElementById("editInvoiceProductName");
  const paidAmountInput = document.getElementById("editInvoicePaidAmount");
  const finalPriceInput = document.getElementById("editInvoiceFinalBasePrice");
  const methodInput = document.getElementById("editInvoicePaymentMethod");
  const bankInput = document.getElementById("editInvoiceBankName");

  if (idInput) idInput.value = invoice.id || "";
  if (leadNameInput) leadNameInput.value = invoice.leadName || "";
  if (productNameInput) productNameInput.value = invoice.productName || "";
  if (paidAmountInput) paidAmountInput.value = invoice.paidAmount || 0;
  if (finalPriceInput)
    finalPriceInput.value = invoice.finalBasePrice || invoice.basePrice || 0;
  if (methodInput) methodInput.value = invoice.paymentMethod || "";
  if (bankInput) bankInput.value = invoice.bankName || "";

  const modalInstance =
    window.bootstrap && window.bootstrap.Modal
      ? window.bootstrap.Modal.getOrCreateInstance(modalEl)
      : null;
  if (modalInstance) modalInstance.show();
}

export function closeEditInvoiceModal() {
  const modalEl = document.getElementById("editInvoiceModal");
  if (!modalEl) return;
  const modalInstance =
    window.bootstrap && window.bootstrap.Modal
      ? window.bootstrap.Modal.getInstance(modalEl)
      : null;
  if (modalInstance) modalInstance.hide();
}

