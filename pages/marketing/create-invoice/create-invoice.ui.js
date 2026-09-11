/**
 * create-invoice.ui.js
 * Presentation and DOM Rendering Layer (Zero Firestore queries) for Create Invoice.
 */

let invoiceExpiryTicker = null;

// ==========================================
// Formatting Helpers
// ==========================================

export function formatCurrencyId(amount) {
  const n = typeof amount === "number" ? amount : parseInt(amount, 10) || 0;
  return n.toLocaleString("id-ID");
}

export function formatNumberWithDotsStr(value) {
  const numeric = String(value || "").replace(/\D/g, "");
  if (!numeric) return "";
  return numeric.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function parseFormattedNumberStr(value) {
  const numeric = String(value || "").replace(/\D/g, "");
  return numeric ? parseInt(numeric, 10) : 0;
}

export function normalizeUpper(val) {
  return String(val || "").trim().toUpperCase();
}

export function formatDateForInput(date) {
  const d = date instanceof Date ? date : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateRangeLabel(fromStr, toStr) {
  if (!fromStr && !toStr) {
    return "Tanpa filter tanggal";
  }
  const fromDate = fromStr ? new Date(`${fromStr}T00:00:00`) : null;
  const toDate = toStr ? new Date(`${toStr}T00:00:00`) : null;
  if (fromDate && toDate) {
    const fromLabel = fromDate.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
    const toLabel = toDate.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
    return `${fromLabel} - ${toLabel}`;
  }
  if (fromDate) {
    const fromLabel = fromDate.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
    return `≥ ${fromLabel}`;
  }
  const toLabel = toDate.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
  return `≤ ${toLabel}`;
}

export function getVerificationStatusMeta(status) {
  const key = String(status || "").toLowerCase();
  if (key === "legit") {
    return {
      key: "legit",
      label: "Legit",
      badge: `<span class="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 gap-1"><i class="fa-solid fa-circle-check text-emerald-500"></i><span>Legit</span></span>`,
    };
  }
  if (key === "scam") {
    return {
      key: "scam",
      label: "Scam",
      badge: `<span class="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 gap-1"><i class="fa-solid fa-triangle-exclamation text-rose-500"></i><span>Scam</span></span>`,
    };
  }
  if (key === "not_verified") {
    return {
      key: "not_verified",
      label: "Not Verified",
      badge: `<span class="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 gap-1"><i class="fa-solid fa-circle-exclamation text-slate-500"></i><span>Not Verified</span></span>`,
    };
  }
  return {
    key: "legit",
    label: "Legit",
    badge: `<span class="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 gap-1"><i class="fa-solid fa-circle-check text-emerald-500"></i><span>Legit</span></span>`,
  };
}

export function getInvoiceExpiryMeta(inv, nowMs) {
  const now = typeof nowMs === "number" ? nowMs : Date.now();
  const startedAtMs =
    typeof inv.startedAtMs === "number" && inv.startedAtMs > 0
      ? inv.startedAtMs
      : typeof inv.createdAtMs === "number" && inv.createdAtMs > 0
      ? inv.createdAtMs
      : 0;
  const deadlineMinutes = typeof inv.deadlineMinutes === "number" ? inv.deadlineMinutes : 0;
  if (!deadlineMinutes) {
    return { state: "no_deadline", expiryMs: 0, remainingMs: 0 };
  }
  if (!startedAtMs) {
    return { state: "not_started", expiryMs: 0, remainingMs: 0 };
  }
  const expiryMs = startedAtMs + deadlineMinutes * 60 * 1000;
  const remainingMs = expiryMs - now;
  if (remainingMs <= 0) {
    return { state: "expired", expiryMs, remainingMs: 0 };
  }
  return { state: "active", expiryMs, remainingMs };
}

export function formatRemainingMs(ms) {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function getReferralOwnerLabel(r) {
  const type = r.holderType || "system";
  const name = (r.holderName || "").trim();
  if (type === "user" && name) {
    return `User: ${name}`;
  }
  return "System";
}

export function getReferralFunctionLabel(r) {
  const t = (r.functionType || "").toLowerCase();
  if (!t) return "";
  if (t === "cashback") return "Cashback";
  if (t === "discount") return "Discount / Potongan Harga";
  if (t === "charity") return "Charity";
  if (t === "point") return "Point";
  if (t === "addon") return "Tambahan Produk / Layanan";
  if (t === "reward") return "Reward";
  if (t === "exclusivity") return "Exclusivity";
  return r.functionType;
}

export function getReferralInitials(r) {
  const label = getReferralOwnerLabel(r);
  const parts = label.split(" ");
  if (!parts.length) return "RF";
  const first = parts[0] || "";
  const second = parts[1] || "";
  const a = first.charAt(0);
  const b = second.charAt(0);
  const letters = (a + b).toUpperCase().replace(/[^A-Z]/g, "");
  if (letters) return letters;
  return (r.code || "RF").slice(0, 2).toUpperCase();
}

export function getReferralExpiryMeta(r) {
  const months = r.monthsValid || 2;
  const created = typeof r.createdAtMs === "number" && r.createdAtMs > 0 ? r.createdAtMs : null;
  if (!created) {
    return {
      expiryLabel: `Masa berlaku ${months} bulan`,
      statusLabel: "",
      isActive: true,
    };
  }
  const expiryDate = new Date(created);
  expiryDate.setMonth(expiryDate.getMonth() + months);
  const now = new Date();
  const isActive = expiryDate.getTime() >= now.getTime();
  const diffMs = expiryDate.getTime() - now.getTime();
  const diffDays = Math.max(Math.round(diffMs / (1000 * 60 * 60 * 24)), 0);
  const expiryLabel = `Hingga ${expiryDate.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`;
  let statusLabel = "";
  if (isActive) {
    statusLabel = `Active - ${diffDays} Days Left`;
  } else {
    statusLabel = "Expired";
  }
  return {
    expiryLabel,
    statusLabel,
    isActive,
  };
}

// ==========================================
// Tab Switching
// ==========================================

export function switchTab(tabId) {
  const tabContent = document.getElementsByClassName("tab-content");
  for (let i = 0; i < tabContent.length; i++) {
    tabContent[i].classList.remove("active");
  }
  const tabBtn = document.getElementsByClassName("tab-btn");
  for (let i = 0; i < tabBtn.length; i++) {
    tabBtn[i].classList.remove("tab-active");
    tabBtn[i].classList.add("text-slate-500");
  }
  const active = document.getElementById(tabId);
  if (active) {
    active.classList.add("active");
  }
  const targetBtn = document.querySelector(`[data-tab-target="${tabId}"]`);
  if (targetBtn) {
    targetBtn.classList.add("tab-active");
    targetBtn.classList.remove("text-slate-500");
  }
}

// ==========================================
// Stats Updating
// ==========================================

export function updateStats({ configuredInvoices = 0, classStat = "0/0", referralStat = "0/0", receiptCount = 0 }) {
  document.querySelectorAll(".configured-invoice-count").forEach((el) => {
    el.textContent = String(configuredInvoices);
  });
  const classEl = document.getElementById("classStatCount");
  if (classEl) classEl.textContent = String(classStat);

  const referralEl = document.getElementById("referralStatCount");
  if (referralEl) referralEl.textContent = String(referralStat);

  const receiptEl = document.getElementById("receiptStatCount");
  if (receiptEl) receiptEl.textContent = String(receiptCount);
}

// ==========================================
// Expiry Ticker
// ==========================================

export function stopInvoiceExpiryTicker() {
  if (invoiceExpiryTicker) {
    clearInterval(invoiceExpiryTicker);
    invoiceExpiryTicker = null;
  }
}

export function startInvoiceExpiryTicker() {
  stopInvoiceExpiryTicker();
  invoiceExpiryTicker = setInterval(() => {
    const nodes = document.querySelectorAll(".inv-expiry[data-expiry-ms]");
    if (!nodes || !nodes.length) {
      stopInvoiceExpiryTicker();
      return;
    }
    const now = Date.now();
    let activeCount = 0;
    nodes.forEach((el) => {
      const expiryMs = parseInt(el.getAttribute("data-expiry-ms") || "0", 10) || 0;
      if (!expiryMs) {
        el.textContent = "-";
        return;
      }
      const remainingMs = expiryMs - now;
      if (remainingMs <= 0) {
        el.textContent = "Expired";
        el.classList.remove("text-emerald-600");
        el.classList.add("text-rose-600");
        el.removeAttribute("data-expiry-ms");
        return;
      }
      activeCount++;
      el.textContent = formatRemainingMs(remainingMs);
    });
    if (activeCount === 0) {
      stopInvoiceExpiryTicker();
    }
  }, 1000);
}

// ==========================================
// Invoice Form UI Handlers
// ==========================================

export function populateClassDropdown(classes, savedClassName = "") {
  const select = document.getElementById("settingClassName");
  if (!select) return;
  if (!classes || !classes.length) {
    select.innerHTML = '<option value="">Pilih program kelas (tidak ada data)</option>';
  } else {
    select.innerHTML = '<option value="">Pilih program kelas</option>';
    classes.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.name;
      opt.textContent = c.name;
      select.appendChild(opt);
    });
    if (savedClassName) {
      select.value = savedClassName;
    }
  }
}

export function populateProductDropdown(products, savedProductId = "") {
  const select = document.getElementById("settingProductName");
  if (!select) return;
  if (!products || !products.length) {
    select.innerHTML = '<option value="">Produk tidak tersedia</option>';
  } else {
    select.innerHTML = '<option value="">Pilih produk terkait (wajib)</option>';
    products.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      select.appendChild(opt);
    });
    if (savedProductId) {
      select.value = savedProductId;
    }
  }
}

export function populateReferralProductOptions(products) {
  const dropdown = document.getElementById("refProductDropdown");
  const optionsBox = document.getElementById("refProductOptions");
  const summaryEl = document.getElementById("refProductSummary");
  if (!dropdown || !optionsBox || !summaryEl) return;

  if (!products || !products.length) {
    optionsBox.innerHTML = '<p class="text-[11px] text-slate-400">Data product tidak tersedia.</p>';
    summaryEl.textContent = "Tidak ada product";
    dropdown.classList.add("cursor-not-allowed", "opacity-60");
    return;
  }

  optionsBox.innerHTML = "";
  products.forEach((p) => {
    const row = document.createElement("label");
    row.className = "flex items-center gap-2 py-1 cursor-pointer";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "ref-product-checkbox";
    input.setAttribute("data-product-id", p.id);
    input.setAttribute("data-product-name", p.name);
    const span = document.createElement("span");
    span.className = "text-sm text-slate-700";
    span.textContent = p.name;
    row.appendChild(input);
    row.appendChild(span);
    optionsBox.appendChild(row);
  });
}

export function updateReferralProductSummary() {
  const summaryEl = document.getElementById("refProductSummary");
  if (!summaryEl) return;
  const checkboxes = document.querySelectorAll(".ref-product-checkbox");
  const selectedNames = [];
  checkboxes.forEach((cb) => {
    if (cb.checked) {
      const name = cb.getAttribute("data-product-name") || "";
      if (name) selectedNames.push(name);
    }
  });
  if (!selectedNames.length) {
    summaryEl.textContent = "Pilih minimal 1 product";
  } else if (selectedNames.length === 1) {
    summaryEl.textContent = selectedNames[0];
  } else {
    summaryEl.textContent = `${selectedNames.length} product dipilih`;
  }
}

export function updateDpLabel() {
  const basePriceField = document.getElementById("settingBasePrice");
  const dpField = document.getElementById("settingDpPercent");
  const label = document.getElementById("dpLabel");
  if (!basePriceField || !dpField || !label) return;
  const base = parseFormattedNumberStr(basePriceField.value);
  const dpAmount = parseFormattedNumberStr(dpField.value);
  if (!base || !dpAmount) {
    label.textContent = "Minimal DP";
    return;
  }
  const percent = Math.round((dpAmount / base) * 100);
  label.textContent = `Minimal DP : ${percent}%`;
}

export function updateLocationVisibility() {
  const typeField = document.getElementById("settingClassType");
  const wrapper = document.getElementById("locationFieldWrapper");
  if (!typeField || !wrapper) return;
  const val = (typeField.value || "").toLowerCase();
  if (val === "online") {
    wrapper.classList.add("hidden");
  } else {
    wrapper.classList.remove("hidden");
  }
}

export function fillInvoiceForm(data) {
  if (!data) return;
  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val !== undefined && val !== null ? val : "";
  };

  setText("settingLeadName", data.leadName || "");
  setText("settingClassName", data.className || "");
  setText("settingBatchLabel", data.batchLabel || "");
  if (data.classType) setText("settingClassType", data.classType);
  setText("settingLocation", data.location || "");
  if (typeof data.seatsLeft === "number") setText("settingSeatsLeft", data.seatsLeft);
  if (typeof data.deadlineMinutes === "number") {
    let hours = Math.round(data.deadlineMinutes / 60);
    if (!hours || hours < 1) hours = 1;
    setText("settingDeadlineMinutes", hours);
  }
  if (typeof data.basePrice === "number") {
    setText("settingBasePrice", formatNumberWithDotsStr(data.basePrice));
  }
  if (data.dpAmount) {
    setText("settingDpPercent", formatNumberWithDotsStr(data.dpAmount));
  } else if (data.dpPercent && data.basePrice) {
    setText("settingDpPercent", formatNumberWithDotsStr(Math.round((data.basePrice * data.dpPercent) / 100)));
  } else {
    setText("settingDpPercent", "");
  }
  setText("invoiceId", data.id || "");
  updateDpLabel();
  updateLocationVisibility();
}

// ==========================================
// Tables Rendering
// ==========================================

export function renderInvoiceTable(invoices, { keyword = "", dateFrom = "", dateTo = "", expiryFilter = "all", pageSize = 100 }) {
  const tbody = document.getElementById("invoiceTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const kw = String(keyword || "").trim().toLowerCase();
  const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : 0;
  const to = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : 0;
  const now = Date.now();

  const filtered = invoices.filter((inv) => {
    if (kw) {
      const invNo = (inv.invoiceNumber || inv.id || "").toLowerCase();
      const name = (inv.leadName || "").toLowerCase();
      const program = (inv.className || "").toLowerCase();
      if (!invNo.includes(kw) && !name.includes(kw) && !program.includes(kw)) {
        return false;
      }
    }
    const createdAt = typeof inv.createdAtMs === "number" ? inv.createdAtMs : 0;
    if (from && (!createdAt || createdAt < from)) return false;
    if (to && (!createdAt || createdAt > to)) return false;

    const meta = getInvoiceExpiryMeta(inv, now);
    if (expiryFilter === "active" && meta.state !== "active") return false;
    if (expiryFilter === "expired" && meta.state !== "expired") return false;
    if (expiryFilter === "not_started" && meta.state !== "not_started") return false;
    return true;
  });

  const limit = Math.max(parseInt(pageSize, 10) || 100, 1);
  const shown = filtered.slice(0, limit);

  shown.forEach((inv) => {
    const createdAtLabel = inv.createdAtMs
      ? new Date(inv.createdAtMs).toLocaleString("id-ID", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "-";
    const amountLabel = inv.basePrice ? `Rp ${formatCurrencyId(inv.basePrice)}` : "-";
    const invoiceNumber = inv.invoiceNumber || inv.id || "";
    const expiryMeta = getInvoiceExpiryMeta(inv, now);

    let expiryHtml = "";
    if (expiryMeta.state === "no_deadline") {
      expiryHtml = '<span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">-</span>';
    } else if (expiryMeta.state === "not_started") {
      expiryHtml = '<span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Belum Dibuka</span>';
    } else if (expiryMeta.state === "expired") {
      expiryHtml = '<span class="text-[10px] font-bold text-rose-600 uppercase tracking-widest">Expired</span>';
    } else {
      expiryHtml = `<span class="inv-expiry font-mono text-[11px] font-bold text-emerald-600" data-expiry-ms="${expiryMeta.expiryMs}">${formatRemainingMs(expiryMeta.remainingMs)}</span>`;
    }

    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50/60 transition";
    tr.innerHTML = `
      <td class="px-3 py-3 font-semibold text-slate-800">${inv.leadName || "-"}</td>
      <td class="px-3 py-3 text-slate-700">${inv.className || "-"}</td>
      <td class="px-3 py-3 font-mono text-[11px] text-slate-600">${invoiceNumber || "-"}</td>
      <td class="px-3 py-3 text-slate-500">${createdAtLabel}</td>
      <td class="px-3 py-3">${expiryHtml}</td>
      <td class="px-3 py-3 text-right font-bold text-slate-800">${amountLabel}</td>
      <td class="px-3 py-3 text-center space-x-2">
        <button data-id="${inv.id}" class="view-invoice text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md transition">View</button>
        <button data-id="${inv.id}" class="edit-invoice text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md transition">Edit</button>
        <button data-id="${inv.id}" class="delete-invoice text-[10px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-md transition">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  startInvoiceExpiryTicker();
}

export function renderReceiptTable(
  invoices,
  { keyword = "", dateFrom = "", dateTo = "", statusFilter = "all", referralFilter = "all", pageSize = 100 },
  referrals = []
) {
  const tbody = document.getElementById("receiptTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const paid = invoices.filter(
    (inv) =>
      (typeof inv.paidAtMs === "number" && inv.paidAtMs > 0) ||
      (typeof inv.paidAmount === "number" && inv.paidAmount > 0)
  );

  const kw = String(keyword || "").trim().toLowerCase();
  const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : 0;
  const to = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : 0;
  const status = statusFilter || "all";
  const refKey = normalizeUpper(referralFilter || "all");

  const filtered = paid.filter((inv) => {
    if (kw) {
      const invoiceNumber = (inv.invoiceNumber || inv.id || "").toLowerCase();
      const name = (inv.leadName || "").toLowerCase();
      const program = (inv.className || "").toLowerCase();
      if (!invoiceNumber.includes(kw) && !name.includes(kw) && !program.includes(kw)) {
        return false;
      }
    }
    const baseTime =
      typeof inv.paidAtMs === "number" && inv.paidAtMs > 0
        ? inv.paidAtMs
        : typeof inv.createdAtMs === "number"
        ? inv.createdAtMs
        : 0;
    if (from && (!baseTime || baseTime < from)) return false;
    if (to && (!baseTime || baseTime > to)) return false;

    const statusKey =
      (inv.paymentMethod || "").toLowerCase() === "cash"
        ? "book"
        : inv.paymentType === "dp"
        ? "dp"
        : "full";
    if (status !== "all" && statusKey !== status) {
      return false;
    }
    if (refKey !== "ALL") {
      const invCode = normalizeUpper(inv.referralCode || "");
      if (!invCode || invCode !== refKey) {
        return false;
      }
    }
    return true;
  });

  filtered.sort((a, b) => {
    const ta = typeof a.paidAtMs === "number" ? a.paidAtMs : 0;
    const tb = typeof b.paidAtMs === "number" ? b.paidAtMs : 0;
    return tb - ta;
  });

  const limit = Math.max(parseInt(pageSize, 10) || 100, 1);
  const shown = filtered.slice(0, limit);
  let totalPayment = 0;

  shown.forEach((inv) => {
    const invoiceNumber = inv.invoiceNumber || inv.id || "";
    const nominal =
      typeof inv.finalBasePrice === "number" && inv.finalBasePrice > 0
        ? inv.finalBasePrice
        : typeof inv.basePrice === "number"
        ? inv.basePrice
        : 0;
    const payment = typeof inv.paidAmount === "number" ? inv.paidAmount : 0;
    const liability = nominal > payment ? nominal - payment : 0;
    totalPayment += payment > 0 ? payment : 0;

    const statusKey =
      (inv.paymentMethod || "").toLowerCase() === "cash"
        ? "book"
        : inv.paymentType === "dp"
        ? "dp"
        : "full";
    const statusBadge =
      statusKey === "dp"
        ? '<span class="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">DP</span>'
        : statusKey === "book"
        ? '<span class="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">Book</span>'
        : '<span class="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">Full</span>';

    const paidLabel = inv.paidAtMs
      ? new Date(inv.paidAtMs).toLocaleString("id-ID", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "-";

    const photoUrl = inv.transferProofUrl || "";
    const photoHtml = photoUrl
      ? `<button type="button" class="receipt-photo-btn w-10 h-10 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 hover:scale-105 transition shadow-sm" data-url="${photoUrl}"><img src="${photoUrl}" class="w-full h-full object-cover" alt="Proof"></button>`
      : '<span class="text-slate-400 text-xs font-semibold">-</span>';

    const referralCode = inv.referralCode || "";
    const refObj = referrals.find((r) => normalizeUpper(r && r.code) === normalizeUpper(referralCode));
    let referralTooltip = "";
    if (refObj) {
      const label = getReferralFunctionLabel(refObj);
      if ((refObj.functionType || "").toLowerCase() === "discount") {
        const p = typeof refObj.discountPercent === "number" ? refObj.discountPercent : 0;
        const a = typeof refObj.discountAmount === "number" ? refObj.discountAmount : 0;
        if (a > 0) referralTooltip = `${label} • Rp ${formatCurrencyId(a)}`;
        else if (p > 0) referralTooltip = `${label} • ${p}%`;
      } else {
        referralTooltip = label;
      }
    }

    const referralHtml = referralCode
      ? `<span class="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg" title="${referralTooltip}">${referralCode}</span>`
      : '<span class="text-slate-400">-</span>';

    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50/60 transition";
    tr.innerHTML = `
      <td class="p-3 font-mono text-[11px] text-slate-600">${invoiceNumber || "-"}</td>
      <td class="p-3">${photoHtml}</td>
      <td class="p-3 font-semibold text-slate-800">${inv.leadName || "-"}</td>
      <td class="p-3 text-slate-700">${inv.className || "-"}</td>
      <td class="p-3">${statusBadge}</td>
      <td class="p-3 text-slate-500">${paidLabel}</td>
      <td class="p-3 text-right font-bold text-emerald-600">${payment ? `Rp ${formatCurrencyId(payment)}` : "-"}</td>
      <td class="p-3 text-right text-rose-600 font-semibold">${liability ? `Rp ${formatCurrencyId(liability)}` : "-"}</td>
      <td class="p-3 text-right font-bold text-slate-800">${nominal ? `Rp ${formatCurrencyId(nominal)}` : "-"}</td>
      <td class="p-3">${referralHtml}</td>
      <td class="p-3 text-slate-700">${inv.paymentMethod || "-"}</td>
      <td class="p-3 text-slate-700 uppercase font-semibold text-xs">${inv.bankName || "-"}</td>
      <td class="p-3 text-slate-700">${inv.leadPhone || "-"}</td>
      <td class="p-3 text-center">
        <button type="button" class="view-payment px-3 py-1.5 rounded-xl text-[11px] font-bold bg-slate-900 text-white hover:bg-black transition shadow-sm" data-id="${inv.id}">View</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  const totalEl = document.getElementById("receiptTotalPayment");
  if (totalEl) {
    totalEl.textContent = `Total Payment: Rp ${formatCurrencyId(totalPayment)}`;
  }
}

export function populateReceiptReferralFilter(referrals) {
  const select = document.getElementById("receiptReferralFilter");
  if (!select) return;
  const currentVal = select.value || "all";
  select.innerHTML = '<option value="all">All Referral</option>';
  if (Array.isArray(referrals)) {
    referrals.forEach((r) => {
      if (r && r.code) {
        const opt = document.createElement("option");
        opt.value = r.code.toUpperCase();
        opt.textContent = r.code.toUpperCase();
        select.appendChild(opt);
      }
    });
  }
  select.value = currentVal;
}

export function renderReferrals(referrals, invoices, { keyword = "", filterStatus = "all" }) {
  const tbody = document.getElementById("refTableBody");
  const footer = document.getElementById("refFooterSummary");
  if (!tbody) return;
  tbody.innerHTML = "";

  const kw = (keyword || "").toLowerCase();
  let visibleCount = 0;

  referrals.forEach((r, idx) => {
    const ownerLabel = getReferralOwnerLabel(r);
    const initials = getReferralInitials(r);
    const functionLabel = getReferralFunctionLabel(r);
    const max = r.maxUsage || 0;

    const usedInvoices = invoices.filter((inv) => {
      const codeInv = (inv.referralCode || "").toUpperCase();
      const codeRef = (r.code || "").toUpperCase();
      if (!codeInv || !codeRef || codeInv !== codeRef) return false;
      return (
        (typeof inv.paidAtMs === "number" && inv.paidAtMs > 0) ||
        (typeof inv.paidAmount === "number" && inv.paidAmount > 0)
      );
    });

    const used = usedInvoices.length;
    const percent = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
    const expiryMeta = getReferralExpiryMeta(r);

    if (filterStatus === "active" && !expiryMeta.isActive) return;
    if (filterStatus === "expired" && expiryMeta.isActive) return;
    if (kw) {
      const haystack = [r.code || "", ownerLabel].join(" ").toLowerCase();
      if (!haystack.includes(kw)) return;
    }

    visibleCount++;
    const historyId = `refHistory-${idx}`;
    const baseRow = document.createElement("tr");
    baseRow.className = expiryMeta.isActive
      ? "group hover:bg-slate-50/50 transition-all"
      : "group hover:bg-slate-50/50 transition-all opacity-60";

    baseRow.innerHTML = `
      <td class="p-6">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-full ${
            expiryMeta.isActive ? "bg-blue-100 text-blue-600" : "bg-slate-200 text-slate-600"
          } flex items-center justify-center font-bold text-xs shadow-inner">
            ${initials}
          </div>
          <div>
            <p class="text-xs font-bold text-slate-400 uppercase tracking-tight">${ownerLabel}</p>
            <p class="text-base font-extrabold text-slate-800 font-mono tracking-wider">${r.code || "-"}</p>
            ${
              functionLabel
                ? `<p class="text-[10px] font-semibold text-emerald-600 mt-1 uppercase tracking-widest">${functionLabel}</p>`
                : ""
            }
          </div>
        </div>
      </td>
      <td class="p-6">
        <div class="flex flex-col">
          <span class="text-sm font-bold text-slate-700 italic">${expiryMeta.expiryLabel}</span>
          ${
            expiryMeta.statusLabel
              ? `<span class="text-[10px] font-bold ${
                  expiryMeta.isActive ? "text-emerald-500 bg-emerald-50" : "text-red-500 bg-red-50"
                } px-2 py-0.5 rounded-full w-fit mt-1 uppercase tracking-tighter">${expiryMeta.statusLabel}</span>`
              : ""
          }
        </div>
      </td>
      <td class="p-6">
        <div class="w-full max-w-[140px]">
          <div class="flex justify-between items-center mb-1">
            <span class="text-xs font-extrabold text-slate-700">${used} / ${max}</span>
            <span class="text-[10px] text-slate-400 font-bold">${percent}%</span>
          </div>
          <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div class="progress-bar h-full ${
              expiryMeta.isActive ? "bg-emerald-500" : "bg-slate-400"
            }" style="width: ${percent}%;"></div>
          </div>
        </div>
      </td>
      <td class="p-6">
        <div class="flex items-center justify-center gap-2">
          <button type="button" data-history-id="${historyId}" class="toggle-ref-history w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm" title="Lihat Riwayat Invoice">
            <i class="fa-solid fa-receipt"></i>
          </button>
          <button type="button" data-idx="${idx}" class="edit-ref w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-amber-500 hover:text-white transition-all shadow-sm" title="Edit Referral">
            <i class="fa-solid fa-pen-to-square text-sm"></i>
          </button>
          <button type="button" data-idx="${idx}" class="delete-ref w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-rose-500 hover:text-white transition-all shadow-sm" title="Hapus Referral">
            <i class="fa-solid fa-trash-can text-sm"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(baseRow);

    // History Row
    const historyRow = document.createElement("tr");
    historyRow.id = historyId;
    historyRow.className = "hidden bg-slate-50/80";

    let historyItemsHtml = "";
    if (usedInvoices.length) {
      const slice = usedInvoices.slice(0, 4);
      slice.forEach((inv) => {
        const invNumber = inv.invoiceNumber || `#${inv.id || ""}`;
        const customer = inv.leadName || "-";
        historyItemsHtml += `
          <div class="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div>
              <p class="text-xs font-bold text-slate-800">${invNumber}</p>
              <p class="text-[10px] text-slate-500 font-medium">Customer: ${customer}</p>
            </div>
            <button type="button" class="open-history-link text-[10px] font-bold text-blue-600 hover:underline" data-id="${inv.id}">
              Lihat Invoice <i class="fa-solid fa-arrow-right ml-1"></i>
            </button>
          </div>
        `;
      });
    } else {
      historyItemsHtml = '<p class="text-[11px] text-slate-500">Belum ada invoice yang tercatat menggunakan kode ini.</p>';
    }

    historyRow.innerHTML = `
      <td colspan="4" class="p-6">
        <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-inner">
          <div class="flex justify-between items-center mb-4">
            <h4 class="text-xs font-extrabold text-slate-800 uppercase tracking-widest flex items-center"><i class="fa-solid fa-clock-rotate-left mr-2 text-blue-500"></i> Riwayat Penggunaan Invoice</h4>
            <span class="text-[10px] font-bold text-slate-400 italic">Digunakan di ${usedInvoices.length} Invoice</span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">${historyItemsHtml}</div>
        </div>
      </td>
    `;
    tbody.appendChild(historyRow);
  });

  if (footer) {
    footer.textContent = `Referral Terdaftar: ${referrals.length} • Ditampilkan: ${visibleCount}`;
  }
}

export function renderBanks(banks) {
  const tbody = document.getElementById("bankTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  banks.forEach((b) => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition";
    tr.innerHTML = `
      <td class="px-3 py-3 font-bold text-slate-800">${b.name || "-"}</td>
      <td class="px-3 py-3 font-mono text-slate-700">${b.number || "-"}</td>
      <td class="px-3 py-3 text-slate-500">${b.holder || "-"}</td>
      <td class="px-3 py-3 text-center space-x-2">
        <button data-id="${b.id}" class="edit-bank text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md transition">Edit</button>
        <button data-id="${b.id}" class="delete-bank text-[10px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-md transition">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================
// Modals
// ==========================================

export function openCopyLinkModal(invoiceId) {
  const modal = document.getElementById("copyLinkModal");
  const input = document.getElementById("invoiceLinkInput");
  if (!modal || !input) return;

  const isLocal =
    window.location.protocol === "file:" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const url = isLocal
    ? new URL("/example/invoice.html", window.location.href)
    : new URL("/invoice.html", window.location.origin);

  if (invoiceId) {
    url.searchParams.set("invoiceId", invoiceId);
  }
  input.value = url.href;
  modal.classList.remove("hidden");
}

export function closeCopyLinkModal() {
  const modal = document.getElementById("copyLinkModal");
  if (modal) modal.classList.add("hidden");
}

export function copyInvoiceLink() {
  const input = document.getElementById("invoiceLinkInput");
  if (!input) return;
  input.select();
  input.setSelectionRange(0, 99999);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(input.value).catch(() => {
      document.execCommand("copy");
    });
  } else {
    document.execCommand("copy");
  }
}

export function openPaidInvoiceModal(invoices) {
  const modal = document.getElementById("paidInvoiceModal");
  const tbody = document.getElementById("paidInvoiceTableBody");
  if (!modal || !tbody) return;

  tbody.innerHTML = "";
  const paid = invoices.filter(
    (inv) =>
      (typeof inv.paidAtMs === "number" && inv.paidAtMs > 0) ||
      (typeof inv.paidAmount === "number" && inv.paidAmount > 0)
  );

  paid.sort((a, b) => {
    const ta = typeof a.paidAtMs === "number" ? a.paidAtMs : 0;
    const tb = typeof b.paidAtMs === "number" ? b.paidAtMs : 0;
    return tb - ta;
  });

  paid.forEach((inv) => {
    const paidLabel = inv.paidAtMs
      ? new Date(inv.paidAtMs).toLocaleString("id-ID", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "-";
    const amountLabel = inv.paidAmount ? `Rp ${formatCurrencyId(inv.paidAmount)}` : "-";
    const invoiceNumber = inv.invoiceNumber || inv.id || "";
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition";
    tr.innerHTML = `
      <td class="px-3 py-2 font-semibold text-slate-800">${inv.leadName || "-"}</td>
      <td class="px-3 py-2 text-slate-700">${inv.className || "-"}</td>
      <td class="px-3 py-2 font-mono text-[11px] text-slate-600">${invoiceNumber || "-"}</td>
      <td class="px-3 py-2 text-slate-500">${paidLabel}</td>
      <td class="px-3 py-2 text-right font-bold text-slate-800">${amountLabel}</td>
      <td class="px-3 py-2 text-slate-700">${inv.paymentMethod || "-"}</td>
      <td class="px-3 py-2 text-slate-700">${inv.bankName || "-"}</td>
    `;
    tbody.appendChild(tr);
  });

  modal.classList.remove("hidden");
}

export function closePaidInvoiceModal() {
  const modal = document.getElementById("paidInvoiceModal");
  if (modal) modal.classList.add("hidden");
}

export function openInvoiceViewModal(inv) {
  const modal = document.getElementById("invoiceViewModal");
  if (!modal || !inv) return;

  const invoiceNumber = inv.invoiceNumber || inv.id || "";
  const basePrice = typeof inv.basePrice === "number" ? inv.basePrice : 0;
  const dpAmount = typeof inv.dpAmount === "number" ? inv.dpAmount : 0;
  const dpPercent = typeof inv.dpPercent === "number" ? inv.dpPercent : 0;
  const seats = typeof inv.seatsLeft === "number" ? inv.seatsLeft : 0;
  const batchMode = [inv.batchLabel, inv.classType].filter(Boolean).join(" • ");

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setText("viewLeadName", inv.leadName || "-");
  setText("viewClassName", inv.className || "-");
  setText("viewInvoiceNumber", invoiceNumber || "-");
  setText("viewBatchMode", batchMode || "-");
  setText("viewLocation", inv.location || "-");
  setText("viewBasePrice", basePrice ? `Rp ${formatCurrencyId(basePrice)}` : "-");

  if (dpAmount > 0) {
    setText("viewDpInfo", `Rp ${formatCurrencyId(dpAmount)}${dpPercent ? ` (${dpPercent}%)` : ""}`);
  } else if (dpPercent > 0 && basePrice > 0) {
    const calc = Math.round((basePrice * dpPercent) / 100);
    setText("viewDpInfo", `Rp ${formatCurrencyId(calc)} (${dpPercent}%)`);
  } else {
    setText("viewDpInfo", "-");
  }
  setText("viewSeats", String(seats));

  const link = document.getElementById("viewInvoiceLink");
  if (link) {
    const isLocal =
      window.location.protocol === "file:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    const url = isLocal
      ? new URL("/example/invoice.html", window.location.href)
      : new URL("/invoice.html", window.location.origin);
    url.searchParams.set("invoiceId", inv.id);
    link.href = url.href;
  }

  modal.classList.remove("hidden");
}

export function closeInvoiceViewModal() {
  const modal = document.getElementById("invoiceViewModal");
  if (modal) modal.classList.add("hidden");
}

export function openPaymentViewModal(inv) {
  const modal = document.getElementById("paymentViewModal");
  if (!modal || !inv) return;
  modal.setAttribute("data-id", inv.id || "");

  const invoiceNumber = inv.invoiceNumber || inv.id || "";
  const nominal =
    typeof inv.finalBasePrice === "number" && inv.finalBasePrice > 0
      ? inv.finalBasePrice
      : typeof inv.basePrice === "number"
      ? inv.basePrice
      : 0;
  const payment = typeof inv.paidAmount === "number" ? inv.paidAmount : 0;
  const liability = nominal > payment ? nominal - payment : 0;

  const statusKey =
    (inv.paymentMethod || "").toLowerCase() === "cash"
      ? "book"
      : inv.paymentType === "dp"
      ? "dp"
      : "full";
  const statusLabel = statusKey === "dp" ? "DP" : statusKey === "book" ? "Book" : "Full";

  const paidLabel = inv.paidAtMs
    ? new Date(inv.paidAtMs).toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "-";

  const proofWrapper = document.getElementById("paymentViewProofWrapper");
  if (proofWrapper) {
    const url = inv.transferProofUrl || "";
    if (url) {
      const lower = url.toLowerCase();
      if (lower.includes(".pdf")) {
        proofWrapper.innerHTML = `<a href="${url}" target="_blank" class="text-xs font-bold text-blue-600 hover:text-blue-800">Buka PDF</a>`;
      } else {
        proofWrapper.innerHTML = `<img src="${url}" class="w-full h-full object-cover cursor-pointer hover:opacity-90 transition" alt="Bukti Pembayaran">`;
        const img = proofWrapper.querySelector("img");
        if (img) {
          img.addEventListener("click", () => window.open(url, "_blank"));
        }
      }
    } else {
      proofWrapper.innerHTML = '<span class="text-slate-400 text-xs font-bold">No Photo</span>';
    }
  }

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setText("paymentViewInvoice", invoiceNumber || "-");
  setText("paymentViewName", inv.leadName || "-");
  setText("paymentViewProgram", inv.className || "-");
  setText("paymentViewStatus", statusLabel);
  setText("paymentViewDate", paidLabel);
  setText("paymentViewPayment", payment ? `Rp ${formatCurrencyId(payment)}` : "-");
  setText("paymentViewLiability", liability ? `Rp ${formatCurrencyId(liability)}` : "-");
  setText("paymentViewNominal", nominal ? `Rp ${formatCurrencyId(nominal)}` : "-");
  setText("paymentViewReferral", inv.referralCode || "-");

  const phone = inv.phone || inv.phoneNumber || inv.leadPhone || inv.leadPhoneNumber || "";
  setText("paymentViewPhone", phone || "-");

  setText("paymentViewMethod", inv.paymentMethod || "-");
  setText("paymentViewBank", inv.bankName || "-");

  const verificationMeta = getVerificationStatusMeta(inv.verificationStatus || "legit");
  const verificationSelect = document.getElementById("paymentVerificationStatus");
  const verificationBadge = document.getElementById("paymentVerificationBadge");
  if (verificationSelect) {
    verificationSelect.value = verificationMeta.key;
  }
  if (verificationBadge) {
    verificationBadge.innerHTML = verificationMeta.badge;
  }

  const receiptLink = document.getElementById("paymentViewReceiptLink");
  if (receiptLink) {
    const url = new URL("https://dialogika.co/receipt.html", window.location.href);
    url.searchParams.set("invoiceId", inv.id);
    receiptLink.href = url.href;
  }

  modal.classList.remove("hidden");
}

export function closePaymentViewModal() {
  const modal = document.getElementById("paymentViewModal");
  if (modal) modal.classList.add("hidden");
}

export function openDiscountCalculatorModal() {
  const modal = document.getElementById("discountCalculatorModal");
  if (modal) modal.classList.remove("hidden");
}

export function closeDiscountCalculatorModal() {
  const modal = document.getElementById("discountCalculatorModal");
  if (modal) modal.classList.add("hidden");
}
