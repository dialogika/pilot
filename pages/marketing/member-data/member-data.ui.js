// pages/marketing/member-data/member-data.ui.js
// =====================================================================
// MEMBER DATA UI (Presentation Layer)
// Handles DOM rendering, table formatting, modal dialogs, and formatting helpers.
// =====================================================================

import { setupExportModalControls } from "../../../assets/js/utils/export-helper.js";

export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
];

export const COLUMNS = [
  { key: "nama", label: "Nama", type: "bold_string" },
  { key: "whatsapp", label: "WhatsApp", type: "wa_copy" },
  { key: "kota", label: "Kota", type: "badge_city" },
  { key: "produk_dibeli", label: "Produk Dibeli", type: "badge_prog" },
  { key: "harga_dibayarkan", label: "Harga Dibayarkan", type: "price" },
  { key: "metode_pembayaran", label: "Metode Pembayaran", type: "badge_pay" },
  { key: "sumber_informasi", label: "Sumber Informasi", type: "badge_info" },
  { key: "created_at", label: "Created At", type: "timestamp" },
  { key: "bukti_transfer", label: "Bukti Transfer", type: "image_link" },
  { key: "aksi", label: "Aksi", type: "actions" },
];

export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function pick(raw, keys) {
  for (const k of keys) {
    if (raw[k] !== undefined && raw[k] !== null && raw[k] !== "") {
      return raw[k];
    }
  }
  return "";
}

export function toTs(v) {
  if (!v) return null;
  if (typeof v.toDate === "function") {
    const t = v.toDate();
    return isNaN(t.getTime()) ? null : t;
  }
  const t = new Date(v);
  return isNaN(t.getTime()) ? null : t;
}

export function fmtTs(v) {
  const d = toTs(v);
  if (!d) return "-";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} WIB`;
}

export function fmtDate(v) {
  const d = toTs(v);
  if (!d) return "-";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtRp(v) {
  if (v === undefined || v === null || v === "") return "-";
  const n = typeof v === "number" ? v : parseInt(String(v).replace(/[^0-9]/g, ""), 10);
  if (isNaN(n)) return String(v);
  return "Rp" + n.toLocaleString("id-ID");
}

export function parsePrice(v) {
  return typeof v === "number" ? v : parseInt(String(v || "").replace(/[^0-9]/g, ""), 10) || 0;
}

export function formatRupiahInput(val) {
  if (val === undefined || val === null || val === "") return "";
  const raw = String(val).replace(/[^0-9]/g, "");
  if (!raw) return "";
  return parseInt(raw, 10).toLocaleString("id-ID");
}

export function parseDateOnly(value) {
  if (!value) return null;
  const p = String(value).split("-");
  if (p.length !== 3) return null;
  const d = new Date(+p[0], +p[1] - 1, +p[2]);
  return isNaN(d.getTime()) ? null : d;
}

export function normalizePaymentMethod(value) {
  const v = String(value || "").toLowerCase().trim();
  if (!v) return "";
  if (v.includes("full") || v === "lunas") return "Full Payment";
  if (v.includes("dp") || v.includes("down") || v.includes("cicil") || v.includes("installment")) {
    return "Down Payment (DP)";
  }
  return v;
}

export function isFullPayment(s) {
  const l = String(s || "").toLowerCase();
  return l.includes("full") || l === "lunas";
}

export function isDP(s) {
  const l = String(s || "").toLowerCase();
  return (
    l.includes("dp") ||
    l.includes("down") ||
    l.includes("cicil") ||
    l.includes("installment")
  );
}

export function mapRow(raw) {
  function normalizeString(val) {
    if (val === undefined || val === null) return "";
    return String(val).replace(/\s*\n\s*/g, " ").trim();
  }
  return {
    id: raw.id || raw._id || raw.docId || "",
    nama: normalizeString(pick(raw, ["nama", "name", "nama_lengkap"])),
    whatsapp: normalizeString(pick(raw, ["whatsapp", "phone", "no_hp", "telepon", "hp"])),
    kota: normalizeString(pick(raw, ["kota", "city", "domisili", "domisili_kota"])),
    produk_dibeli: normalizeString(pick(raw, ["produk_dibeli", "produkDibeli", "product", "program_kelas", "program_diambil", "kelas"])),
    harga_dibayarkan: pick(raw, ["harga_dibayarkan", "hargaDibayarkan", "harga", "amount", "nominal"]),
    metode_pembayaran: normalizeString(pick(raw, ["metode_pembayaran", "metodePembayaran", "payment_method", "pembayaran"])),
    sumber_informasi: normalizeString(pick(raw, ["sumber_informasi", "sumberInformasi", "sumber_info"])),
    created_at: pick(raw, ["created_at", "createdAt", "created_date", "tanggal_daftar", "tanggal", "date", "registered_at", "timestamp"]),
    bukti_transfer: normalizeString(pick(raw, ["bukti_transfer", "buktiTransfer", "bukti_pembayaran", "proof_url", "proof"])),
    _raw: raw,
  };
}

export function renderCell(row, col) {
  const v = row[col.key];
  const s = String(v ?? "").trim();
  switch (col.type) {
    case "timestamp":
      return `<span class="td-ts">${fmtTs(v)}</span>`;
    case "date":
      return `<span class="td-ts">${fmtDate(v)}</span>`;
    case "price":
      return `<span class="td-price">${fmtRp(v)}</span>`;
    case "bold_string":
      return s ? `<span class="td-nama">${esc(s)}</span>` : '<span style="color:#cbd5e1">-</span>';
    case "wa_copy": {
      if (!s) return '<span style="color:#cbd5e1">-</span>';
      const num = esc(s);
      return `<div style="display: flex; align-items: center; gap: 0.5rem;">
          <span>${num}</span>
          <button type="button" class="btn-copy-wa" data-wa="${num}" title="Copy nomor" onclick="navigator.clipboard.writeText('${num}').then(()=>{this.textContent='✓';this.classList.add('copied');setTimeout(()=>{this.textContent='⧉';this.classList.remove('copied');},1500);})">⧉</button>
        </div>`;
    }
    case "badge_city":
      return s ? `<span class="b-city">${esc(s)}</span>` : '<span style="color:#cbd5e1">-</span>';
    case "badge_prog":
      return s ? `<span class="b-prog">${esc(s)}</span>` : '<span style="color:#cbd5e1">-</span>';
    case "badge_info":
      return s ? `<span class="b-info">${esc(s)}</span>` : '<span style="color:#cbd5e1">-</span>';
    case "badge_pay": {
      if (!s) return '<span style="color:#cbd5e1">-</span>';
      const low = s.toLowerCase();
      if (low.includes("full") || low === "lunas") return `<span class="b-pay-full">${esc(s)}</span>`;
      if (low.includes("dp") || low.includes("down") || low.includes("cicil") || low.includes("installment")) {
        return `<span class="b-pay-dp">${esc(s)}</span>`;
      }
      return `<span class="b-pay-oth">${esc(s)}</span>`;
    }
    case "image_link": {
      if (!s || s === "undefined") return '<span style="color:#cbd5e1">-</span>';
      return `<a href="${esc(s)}" target="_blank" rel="noopener" class="btn btn-outline-primary btn-bukti"><i class="bi bi-image me-1"></i>Lihat Bukti</a>`;
    }
    case "actions":
      return `
        <div class="member-action-wrap">
          <button type="button" class="btn btn-outline-primary btn-mini-action btn-edit-member" data-id="${esc(row.id || "")}" title="Edit">
            <i class="bi bi-pencil-square"></i>
          </button>
          <button type="button" class="btn btn-outline-danger btn-mini-action btn-delete-member" data-id="${esc(row.id || "")}" title="Hapus">
            <i class="bi bi-trash"></i>
          </button>
        </div>`;
    default:
      return s ? esc(s) : '<span style="color:#cbd5e1">-</span>';
  }
}

export function renderHead(thead, sortKey, sortDir) {
  if (!thead) return;
  const tr = document.createElement("tr");
  COLUMNS.forEach((col) => {
    const th = document.createElement("th");
    if (col.type !== "actions") {
      th.dataset.sortKey = col.key;
      const active = sortKey === col.key;
      if (active) th.classList.add(sortDir === "asc" ? "s-asc" : "s-desc");
      const arrow = active ? (sortDir === "asc" ? "▲" : "▼") : "⇅";
      th.innerHTML = `${col.label}<span class="sa">${arrow}</span>`;
    } else {
      th.style.cursor = "default";
      th.innerHTML = col.label;
    }
    tr.appendChild(th);
  });
  thead.innerHTML = "";
  thead.appendChild(tr);
}

export function renderPagination(pgnControls, pgnInfo, total, currentPage, pageSize) {
  if (!pgnControls) return;
  const tp = Math.max(1, Math.ceil(total / pageSize));
  const s = total > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const e = Math.min(currentPage * pageSize, total);
  if (pgnInfo) {
    pgnInfo.textContent = total > 0 ? `Menampilkan ${s}–${e} dari ${total} member` : "Tidak ada data";
  }

  const mk = (lbl, pg, dis, act) => {
    const cls = act
      ? "btn btn-primary pgn-btn"
      : dis
        ? "btn btn-light pgn-btn disabled"
        : "btn btn-outline-secondary pgn-btn";
    return `<button type="button" class="${cls}" data-page="${pg}" ${dis ? "disabled" : ""}>${lbl}</button>`;
  };

  let h = "";
  h += mk("«", 1, currentPage === 1, false);
  h += mk("‹", currentPage - 1, currentPage === 1, false);
  let ps = Math.max(1, currentPage - 2);
  let pe = Math.min(tp, ps + 4);
  if (pe - ps < 4) ps = Math.max(1, pe - 4);
  if (ps > 1) h += mk("1", 1, false, currentPage === 1);
  if (ps > 2) h += `<span class="px-1 text-slate-400">…</span>`;
  for (let p = ps; p <= pe; p++) h += mk(String(p), p, false, p === currentPage);
  if (pe < tp - 1) h += `<span class="px-1 text-slate-400">…</span>`;
  if (pe < tp) h += mk(String(tp), tp, false, currentPage === tp);
  h += mk("›", currentPage + 1, currentPage === tp, false);
  h += mk("»", tp, currentPage === tp, false);
  pgnControls.innerHTML = h;
}

export function openMemberDetail(member) {
  if (!member) return;
  const modalEl = document.getElementById("memberDetailModal");
  if (!modalEl || !window.bootstrap?.Modal) return;

  const raw = member._raw || {};
  const nama = member.nama || "-";
  const wa = member.whatsapp || "-";

  document.getElementById("detailMemberTitle").textContent = nama || "Detail Member";
  document.getElementById("detailMemberInitial").textContent = nama ? nama.charAt(0).toUpperCase() : "M";
  document.getElementById("detailMemberSubtitle").textContent = wa;
  document.getElementById("detailMemberName").textContent = nama;
  document.getElementById("detailMemberPhone").textContent = wa;
  document.getElementById("detailMemberEmail").textContent = raw.email || "-";
  document.getElementById("detailMemberProgram").textContent = member.produk_dibeli || "-";
  document.getElementById("detailMemberCity").textContent = member.kota || "-";
  document.getElementById("detailMemberDate").textContent = fmtTs(member.created_at);

  const waBtn = document.getElementById("detailWhatsappBtn");
  if (waBtn) {
    const rp = String(wa).replace(/[^0-9]/g, "");
    if (rp) {
      waBtn.style.display = "";
      waBtn.onclick = () => window.open("https://wa.me/" + rp, "_blank");
    } else {
      waBtn.style.display = "none";
      waBtn.onclick = null;
    }
  }

  const extraEl = document.getElementById("detailMemberExtra");
  if (extraEl) {
    const skip = new Set([
      "nama", "name", "nama_lengkap", "whatsapp", "phone", "no_hp", "telepon", "hp",
      "email", "kota", "city", "domisili", "domisili_kota", "produk_dibeli", "produkDibeli",
      "product", "program_kelas", "program_diambil", "programDiambil", "kelas",
      "harga_dibayarkan", "hargaDibayarkan", "harga", "amount", "nominal",
      "metode_pembayaran", "metodePembayaran", "payment_method", "pembayaran",
      "sumber_informasi", "sumberInformasi", "sumber_info", "sumber_informasi_lainnya",
      "sumberInformasiLainnya", "waktu_pengisian", "waktuPengisian", "submitted_at",
      "form_submitted_at", "created_at", "createdAt", "created_date", "tanggal_daftar",
      "tanggal", "date", "registered_at", "timestamp", "bukti_transfer", "buktiTransfer",
      "bukti_pembayaran", "proof_url", "proof", "id", "_id", "docId", "_raw"
    ]);
    const blocks = [], proofs = [];
    Object.keys(raw).forEach((k) => {
      if (skip.has(k)) return;
      const val = raw[k];
      if (val === undefined || val === null || val === "") return;
      let disp = "";
      if (val && typeof val.toDate === "function") disp = fmtTs(val);
      else if (typeof val === "object") {
        try { disp = JSON.stringify(val); } catch { disp = String(val); }
      } else disp = String(val);

      const kl = k.toLowerCase();
      const isImg = /^https?:\/\//i.test(disp) && /\.(png|jpe?g|webp|gif)$/i.test(disp.split("?")[0]);
      if (isImg && (kl.includes("bukti") || kl.includes("proof"))) {
        proofs.push(`<div class="col-12 mb-3"><div class="text-xs text-slate-400 fw-semibold text-uppercase mb-1">${esc(k)}</div><div class="border rounded-3 p-2 bg-slate-50"><img src="${esc(disp)}" alt="${esc(k)}" class="img-fluid rounded-3"></div></div>`);
      } else {
        blocks.push(`<div class="col-md-6 mb-2"><div class="text-xs text-slate-400 fw-semibold text-uppercase mb-1">${esc(k)}</div><div class="text-xs text-slate-700">${esc(disp)}</div></div>`);
      }
    });
    const combined = blocks.concat(proofs);
    extraEl.innerHTML = combined.length
      ? `<div class="row">${combined.join("")}</div>`
      : '<div class="text-xs text-slate-400">Tidak ada detail tambahan.</div>';
  }

  window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

/**
 * Show a feedback popup modal for success, error, or info
 * @param {string} title
 * @param {string} message
 * @param {"success"|"error"|"info"} [type="success"]
 */
export function showFeedbackModal(title, message, type = "success") {
  const modalEl = document.getElementById("feedbackModal");
  if (!modalEl || !window.bootstrap?.Modal) return;

  const titleEl = document.getElementById("feedbackTitle");
  const msgEl = document.getElementById("feedbackMessage");
  const iconWrap = document.getElementById("feedbackIconWrap");
  const iconEl = document.getElementById("feedbackIcon");

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;

  if (iconWrap && iconEl) {
    if (type === "success") {
      iconWrap.style.backgroundColor = "#dcfce7";
      iconWrap.style.color = "#16a34a";
      iconEl.className = "bi bi-check-circle-fill fs-3";
    } else if (type === "error") {
      iconWrap.style.backgroundColor = "#fee2e2";
      iconWrap.style.color = "#dc2626";
      iconEl.className = "bi bi-exclamation-triangle-fill fs-3";
    } else {
      iconWrap.style.backgroundColor = "#e0f2fe";
      iconWrap.style.color = "#0284c7";
      iconEl.className = "bi bi-info-circle-fill fs-3";
    }
  }

  const modalInstance = window.bootstrap.Modal.getOrCreateInstance(modalEl);
  modalInstance.show();

  setTimeout(() => {
    try {
      modalInstance.hide();
    } catch (_) {}
  }, 2500);
}

export function initMemberExportModal() {
  return setupExportModalControls({
    modalId: "exportMemberModal",
    formatInputId: "exportMemberFormat",
    rangeInputId: "exportMemberRange",
    customDateContainerId: "exportMemberCustomDateContainer",
    startDateInputId: "exportMemberStartDate",
    endDateInputId: "exportMemberEndDate",
    submitBtnId: "btnSubmitExportMember",
  });
}

/**
 * Mounts the Database Mapping button exclusively to the sidebar
 * when Member Data is active.
 */
export function mountSidebarMemberErdButton() {
  const sidebarWrapper = document.querySelector("#dg-sidebar-mount .sidebar-scroll-wrapper");
  if (!sidebarWrapper) return;

  // Prevent duplicate mounts
  if (document.getElementById("sidebarMemberErdSection")) return;

  const sectionEl = document.createElement("div");
  sectionEl.id = "sidebarMemberErdSection";
  sectionEl.innerHTML = `
    <div class="nav-category mt-4">MARKETING DIVISION</div>
    <a href="javascript:void(0)" class="sidebar-link" id="sidebarBtnMemberErd" data-bs-toggle="modal" data-bs-target="#memberErdModal" role="button">
      <i class="bi bi-diagram-3-fill text-blue-600"></i>
      <span>Database Mapping</span>
      <span class="sidebar-badge">
        <span class="badge bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">ERD</span>
      </span>
    </a>
  `;

  // Find the "SYSTEM" category to cleanly place it right above SYSTEM
  const navCategories = Array.from(sidebarWrapper.querySelectorAll(".nav-category"));
  const systemCategory = navCategories.find((cat) => cat.textContent.trim().toUpperCase() === "SYSTEM");

  if (systemCategory) {
    sidebarWrapper.insertBefore(sectionEl, systemCategory);
  } else {
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      sidebarWrapper.insertBefore(sectionEl, logoutBtn);
    } else {
      sidebarWrapper.appendChild(sectionEl);
    }
  }
}

/**
 * Initializes Member Data ERD modal tabs, search, filters, SVG connectors & copy button.
 */
export function initMemberErdModalControls() {
  const modalEl = document.getElementById("memberErdModal");
  if (!modalEl) return;

  // Tab controls
  const tabVisualBtn = document.getElementById("memberErdTabVisualBtn");
  const tabDictBtn = document.getElementById("memberErdTabDictBtn");
  const tabSqlBtn = document.getElementById("memberErdTabSqlBtn");

  const tabVisualContent = document.getElementById("memberErdTabVisualContent");
  const tabDictContent = document.getElementById("memberErdTabDictContent");
  const tabSqlContent = document.getElementById("memberErdTabSqlContent");

  const tabs = [
    { btn: tabVisualBtn, content: tabVisualContent },
    { btn: tabDictBtn, content: tabDictContent },
    { btn: tabSqlBtn, content: tabSqlContent },
  ];

  tabs.forEach(({ btn, content }) => {
    btn?.addEventListener("click", () => {
      tabs.forEach((t) => {
        t.btn?.classList.remove("active");
        if (t.content) {
          t.content.classList.remove("active");
          t.content.style.display = "none";
        }
      });
      btn.classList.add("active");
      if (content) {
        content.classList.add("active");
        content.style.display = "block";
      }

      if (btn === tabVisualBtn) {
        setTimeout(drawMemberErdRelations, 80);
      }
    });
  });

  // Kamus Data (Data Dictionary) Search & Table Filter
  const searchInput = document.getElementById("memberErdDictSearchInput");
  const tableFilter = document.getElementById("memberErdDictTableFilter");
  const dictTableBody = document.getElementById("memberErdDictTableBody");
  const countBadge = document.getElementById("memberErdDictCountBadge");

  function filterDictionaryRows() {
    if (!dictTableBody) return;
    const q = (searchInput?.value || "").trim().toLowerCase();
    const selectedTable = tableFilter?.value || "all";

    const rows = dictTableBody.querySelectorAll("tr");
    let visibleCount = 0;

    rows.forEach((row) => {
      const rowTable = row.getAttribute("data-table");
      const matchTable = selectedTable === "all" || rowTable === selectedTable;
      const textContent = row.textContent.toLowerCase();
      const matchSearch = !q || textContent.includes(q);

      if (matchTable && matchSearch) {
        row.style.display = "";
        visibleCount++;
      } else {
        row.style.display = "none";
      }
    });

    if (countBadge) {
      countBadge.textContent = `${visibleCount} Kolom`;
    }
  }

  searchInput?.addEventListener("input", filterDictionaryRows);
  tableFilter?.addEventListener("change", filterDictionaryRows);

  // Copy SQL Script Button
  const btnCopySql = document.getElementById("memberBtnCopySqlScript");
  const btnCopyText = document.getElementById("memberBtnCopySqlText");
  const sqlContent = document.getElementById("memberSqlScriptContent");

  btnCopySql?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(sqlContent?.textContent || "");
      if (btnCopyText) btnCopyText.textContent = "Tersalin!";
      setTimeout(() => {
        if (btnCopyText) btnCopyText.textContent = "Salin Script SQL";
      }, 2500);
    } catch (err) {
      console.error("Gagal menyalin SQL:", err);
    }
  });

  // Copy Docs Path Button
  const btnCopyDocs = document.getElementById("memberBtnCopyDocsPath");
  btnCopyDocs?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText("docs/MEMBER-DATABASE-MAPPING.md");
      const orig = btnCopyDocs.innerHTML;
      btnCopyDocs.innerHTML = `<i class="bi bi-check2 text-emerald-600"></i><span>Tersalin!</span>`;
      setTimeout(() => {
        btnCopyDocs.innerHTML = orig;
      }, 2000);
    } catch (e) {
      console.error("Gagal menyalin path:", e);
    }
  });

  // =====================================================================
  // DYNAMIC SVG RELATIONS
  // =====================================================================
  const wrapper = document.getElementById("memberErdDiagramWrapper");
  const svgGroup = document.getElementById("memberErdPathsGroup");

  const relationConfigs = [
    {
      id: "member-class-member",
      from: document.getElementById("memberErdAnchorMembersId"),
      to: document.getElementById("memberErdTargetClassMembersMemberId"),
      card: document.getElementById("memberCardClassMembers"),
      color: "#3b82f6",
      marker: "url(#memberErdArrowBlue)",
      label: "1 : N (member_id)",
      y1Offset: 0,
      tBadge: 0.5,
    },
    {
      id: "class-class-member",
      from: document.getElementById("memberErdAnchorClassesId"),
      to: document.getElementById("memberErdTargetClassMembersClassId"),
      card: document.getElementById("memberCardClassMembers"),
      color: "#6366f1",
      marker: "url(#memberErdArrowIndigo)",
      label: "1 : N (class_id)",
      y1Offset: -7,
      tBadge: 0.38,
    },
    {
      id: "class-schedule",
      from: document.getElementById("memberErdAnchorClassesId"),
      to: document.getElementById("memberErdTargetSchedulesClassId"),
      card: document.getElementById("memberCardSchedules"),
      color: "#0d9488",
      marker: "url(#memberErdArrowTeal)",
      label: "1 : N (class_id)",
      y1Offset: 7,
      tBadge: 0.62,
    },
  ];

  let currentActiveRel = "all";

  function getBezierPoint(t, p0, p1, p2, p3) {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;
    return {
      x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
      y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
    };
  }

  function drawMemberErdRelations() {
    if (!wrapper || !svgGroup) return;

    const wrapRect = wrapper.getBoundingClientRect();
    if (wrapRect.width === 0 || wrapRect.height === 0) return;

    if (window.innerWidth < 1024) {
      svgGroup.innerHTML = "";
      return;
    }

    let svgHtml = "";

    relationConfigs.forEach((cfg) => {
      if (!cfg.from || !cfg.to) return;
      const fromRect = cfg.from.getBoundingClientRect();
      const toRect = cfg.to.getBoundingClientRect();
      if (fromRect.width === 0 || toRect.width === 0) return;

      // Start: Right edge of left column card (with small vertical offset to prevent overlap)
      const x1 = fromRect.right - wrapRect.left;
      const y1 = fromRect.top + fromRect.height / 2 - wrapRect.top + (cfg.y1Offset || 0);

      // End: Left edge of right column card
      const x2 = toRect.left - wrapRect.left;
      const y2 = toRect.top + toRect.height / 2 - wrapRect.top;

      // Smooth horizontal curve across the center gutter
      const dx = Math.max(35, Math.abs(x2 - x1) * 0.45);
      const p0 = { x: x1, y: y1 };
      const p1 = { x: x1 + dx, y: y1 };
      const p2 = { x: x2 - dx, y: y2 };
      const p3 = { x: x2, y: y2 };

      const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

      // Calculate non-colliding badge coordinates along the curve
      const badgePos = getBezierPoint(cfg.tBadge || 0.5, p0, p1, p2, p3);

      const isCurrentActive = currentActiveRel === "all" || currentActiveRel === cfg.id;
      const opacity = isCurrentActive ? 1 : 0.12;
      const strokeWidth = isCurrentActive && currentActiveRel !== "all" ? 3 : 2;

      svgHtml += `
        <g class="erd-relation-path-group" data-rel-id="${cfg.id}" style="opacity: ${opacity};">
          <!-- Glow halo -->
          <path d="${d}" stroke="${cfg.color}" stroke-width="7" fill="none" opacity="0.18" stroke-linecap="round" />
          <!-- Animated connecting line -->
          <path d="${d}" stroke="${cfg.color}" stroke-width="${strokeWidth}" fill="none" 
            marker-start="url(#memberErdDotStart)" marker-end="${cfg.marker}" 
            stroke-dasharray="6 3" class="erd-relation-path" />
          <!-- Center badge -->
          <g transform="translate(${badgePos.x}, ${badgePos.y})">
            <rect x="-34" y="-9" width="68" height="18" rx="6" fill="#ffffff" stroke="${cfg.color}" stroke-width="1.5" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.1))" />
            <text x="0" y="3.5" text-anchor="middle" font-size="9" font-family="'JetBrains Mono', monospace" font-weight="700" fill="${cfg.color}">
              1 : N
            </text>
          </g>
        </g>
      `;
    });

    svgGroup.innerHTML = svgHtml;

    svgGroup.querySelectorAll(".erd-relation-path-group").forEach((grp) => {
      grp.addEventListener("click", () => {
        const relId = grp.getAttribute("data-rel-id");
        if (relId) setActiveMemberRelation(relId === currentActiveRel ? "all" : relId);
      });
    });
  }

  const memberCards = [
    document.getElementById("memberCardMembers"),
    document.getElementById("memberCardClassMembers"),
    document.getElementById("memberCardClasses"),
    document.getElementById("memberCardSchedules"),
  ];

  function setActiveMemberRelation(relId) {
    currentActiveRel = relId;

    document.querySelectorAll("#memberErdPills .erd-rel-pill").forEach((pill) => {
      const pRel = pill.getAttribute("data-rel");
      if (pRel === relId) {
        pill.classList.add("active");
      } else {
        pill.classList.remove("active");
      }
    });

    let activeCardIds = [];
    if (relId === "member-class-member") {
      activeCardIds = ["memberCardMembers", "memberCardClassMembers"];
    } else if (relId === "class-class-member") {
      activeCardIds = ["memberCardClasses", "memberCardClassMembers"];
    } else if (relId === "class-schedule") {
      activeCardIds = ["memberCardClasses", "memberCardSchedules"];
    }

    memberCards.forEach((card) => {
      if (!card) return;
      if (relId === "all") {
        card.classList.remove("relation-highlight", "relation-faded");
      } else if (activeCardIds.includes(card.id)) {
        card.classList.add("relation-highlight");
        card.classList.remove("relation-faded");
      } else {
        card.classList.remove("relation-highlight");
        card.classList.add("relation-faded");
      }
    });

    drawMemberErdRelations();
  }

  document.querySelectorAll("#memberErdPills .erd-rel-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const rel = pill.getAttribute("data-rel") || "all";
      setActiveMemberRelation(rel);
    });
  });

  modalEl.addEventListener("shown.bs.modal", () => {
    setTimeout(drawMemberErdRelations, 80);
  });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawMemberErdRelations, 100);
  });
}

