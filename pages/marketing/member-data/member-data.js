// pages/marketing/member-data/member-data.js
// =====================================================================
// MEMBER DATA ORCHESTRATOR
// Coordinates auth, topbar, sidebar, repository, and UI rendering.
// =====================================================================

import { requireAuth } from "/assets/js/auth-guard.js";
import { renderTopbar } from "/assets/js/components/topbar/topbar.js";
import { renderSidebar } from "/assets/js/components/sidebar/sidebar.js";
import * as repo from "/pages/marketing/member-data/member-data.repository.js";
import * as ui from "/pages/marketing/member-data/member-data.ui.js";

/* ── State ── */
let allMembers = [];
let filteredList = [];
let currentPage = 1;
let pageSize = 25;
let sortKey = "created_at";
let sortDir = "desc";
let paymentFilter = "all";
let currentProofUrl = "";
let currentProofName = "";
let pendingDeleteMemberId = null;

/* ── DOM Cache ── */
let loadingState;
let emptyState;
let tableContainer;
let summaryText;
let dataInfoText;
let thead;
let tbody;
let pgnInfo;
let pgnControls;
let searchInput;
let startDateInput;
let endDateInput;
let btnResetDate;
let paymentFilterSelect;
let pageSizeSelect;
let scTotal;
let scFull;
let scDp;

let memberFormModal;
let memberDetailModal;
let deleteMemberModal;

let memberFormMode;
let memberEditId;
let memberFormTitle;
let memberFormSubtitle;
let memberFormSubmitBtn;
let memberFormNama;
let memberFormWhatsapp;
let memberFormKota;
let memberFormProduk;
let memberFormHarga;
let memberFormMetode;
let memberFormSumber;
let memberFormBuktiFile;
let memberFormBuktiHelp;
let memberFormBuktiPreviewWrap;
let memberFormBuktiPreviewImg;
let memberFormBuktiPreviewBadge;
let memberFormBuktiPreviewNote;
let memberFormBuktiPreviewLink;
let confirmDeleteBtn;
let deleteMemberNameEl;

/**
 * Compare two member rows for sorting
 */
function cmpRows(a, b, key, dir) {
  const col = ui.COLUMNS.find((c) => c.key === key) || { type: "string" };
  let va = a[key];
  let vb = b[key];
  let cmp = 0;

  if (col.type === "timestamp" || col.type === "date") {
    const da = ui.toTs(va);
    const db = ui.toTs(vb);
    cmp = (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
  } else if (col.type === "price") {
    const na = ui.parsePrice(va);
    const nb = ui.parsePrice(vb);
    cmp = na - nb;
  } else {
    cmp = String(va || "").localeCompare(String(vb || ""), "id", {
      sensitivity: "base",
    });
  }
  return dir === "asc" ? cmp : -cmp;
}

/**
 * Ensure a select element has a specific value option
 */
function ensureSelectValue(selectEl, value) {
  if (!selectEl) return;
  const target = String(value || "").trim();
  if (!target) {
    selectEl.value = "";
    return;
  }
  const match = Array.from(selectEl.options).find(
    (opt) => opt.value.toLowerCase() === target.toLowerCase()
  );
  if (match) {
    selectEl.value = match.value;
  } else {
    const opt = document.createElement("option");
    opt.value = target;
    opt.textContent = target;
    selectEl.appendChild(opt);
    selectEl.value = target;
  }
}

/**
 * Update help text for proof of payment
 */
function refreshProofHelp() {
  if (!memberFormBuktiHelp) return;
  if (currentProofUrl) {
    memberFormBuktiHelp.innerHTML = `Bukti tersimpan: <a href="${ui.esc(
      currentProofUrl
    )}" target="_blank" rel="noopener" class="text-indigo-600 underline">Lihat Bukti</a>. Upload gambar baru jika ingin mengganti.`;
  } else {
    memberFormBuktiHelp.textContent = "Upload gambar bukti transfer, maksimal 3 MB.";
  }
}

/**
 * Reset and populate form fields
 */
function fillForm(member) {
  if (memberFormNama) memberFormNama.value = member?.nama || "";
  if (memberFormWhatsapp) memberFormWhatsapp.value = member?.whatsapp || "";
  if (memberFormKota) memberFormKota.value = member?.kota || "";
  ensureSelectValue(memberFormProduk, member?.produk_dibeli || "");

  if (memberFormHarga) {
    memberFormHarga.value =
      member?.harga_dibayarkan === undefined ||
      member?.harga_dibayarkan === null ||
      member?.harga_dibayarkan === ""
        ? ""
        : ui.formatRupiahInput(member.harga_dibayarkan);
  }

  ensureSelectValue(
    memberFormMetode,
    ui.normalizePaymentMethod(member?.metode_pembayaran || "")
  );

  if (memberFormSumber) memberFormSumber.value = member?.sumber_informasi || "";
  currentProofUrl = member?.bukti_transfer || "";
  currentProofName = currentProofUrl ? "Bukti transfer tersimpan" : "";
  refreshProofHelp();

  if (memberFormBuktiPreviewWrap) {
    if (currentProofUrl) {
      if (memberFormBuktiPreviewImg) memberFormBuktiPreviewImg.src = currentProofUrl;
      if (memberFormBuktiPreviewLink) memberFormBuktiPreviewLink.href = currentProofUrl;
      if (memberFormBuktiPreviewBadge) {
        memberFormBuktiPreviewBadge.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>Bukti Tersimpan';
        memberFormBuktiPreviewBadge.className = 'badge bg-success bg-opacity-10 text-success fw-bold';
      }
      if (memberFormBuktiPreviewNote) {
        memberFormBuktiPreviewNote.textContent = "Gambar bukti transfer yang saat ini digunakan.";
      }
      memberFormBuktiPreviewWrap.style.display = "flex";
    } else {
      memberFormBuktiPreviewWrap.style.display = "none";
    }
  }

  if (memberFormBuktiFile) {
    memberFormBuktiFile.value = "";
  }
}

function openAddMemberForm() {
  if (memberFormMode) memberFormMode.value = "add";
  if (memberEditId) memberEditId.value = "";
  if (memberFormTitle) memberFormTitle.textContent = "Tambah Data Member";
  if (memberFormSubtitle) {
    memberFormSubtitle.textContent = "Isi data member yang akan disimpan ke Firebase.";
  }
  if (memberFormSubmitBtn) memberFormSubmitBtn.textContent = "Simpan Data";
  currentProofUrl = "";
  currentProofName = "";
  fillForm(null);
  if (memberFormBuktiPreviewWrap) {
    memberFormBuktiPreviewWrap.style.display = "none";
  }
  if (memberFormModal) memberFormModal.show();
}

function openEditMemberForm(member) {
  if (!member) return;
  if (memberFormMode) memberFormMode.value = "edit";
  if (memberEditId) memberEditId.value = member.id || "";
  if (memberFormTitle) memberFormTitle.textContent = "Edit Data Member";
  if (memberFormSubtitle) {
    memberFormSubtitle.textContent = "Perbarui data member yang sudah tersimpan.";
  }
  if (memberFormSubmitBtn) memberFormSubmitBtn.textContent = "Simpan Perubahan";
  fillForm(member);
  if (memberFormModal) memberFormModal.show();
}

function getFormPayload() {
  return {
    nama: String(memberFormNama?.value || "").trim(),
    whatsapp: String(memberFormWhatsapp?.value || "").trim(),
    kota: String(memberFormKota?.value || "").trim(),
    produk_dibeli: String(memberFormProduk?.value || "").trim(),
    harga_dibayarkan:
      String(memberFormHarga?.value || "").trim() === ""
        ? ""
        : ui.parsePrice(memberFormHarga.value),
    metode_pembayaran: String(memberFormMetode?.value || "").trim(),
    sumber_informasi: String(memberFormSumber?.value || "").trim(),
    bukti_transfer: currentProofUrl || "",
  };
}

async function saveMemberForm() {
  const payload = getFormPayload();
  if (!payload.nama) {
    alert("Nama member wajib diisi.");
    return;
  }

  const file = memberFormBuktiFile?.files?.[0] || null;
  if (!file && !currentProofUrl) {
    alert("Bukti transfer wajib diunggah dalam bentuk gambar.");
    return;
  }

  try {
    if (memberFormSubmitBtn) {
      memberFormSubmitBtn.disabled = true;
      memberFormSubmitBtn.textContent = "Menyimpan...";
    }

    if (file) {
      currentProofUrl = await repo.uploadProofImage(
        file,
        memberEditId?.value || "member"
      );
      payload.bukti_transfer = currentProofUrl;
    }

    const isEdit = memberFormMode?.value === "edit" && memberEditId?.value;
    if (isEdit) {
      await repo.updateMember(memberEditId.value, payload);
    } else {
      await repo.createMember(payload);
    }

    if (memberFormModal) memberFormModal.hide();
    await loadMembers();

    // Show feedback popup
    ui.showFeedbackModal(
      isEdit ? "Berhasil Diperbarui!" : "Berhasil Ditambahkan!",
      isEdit
        ? "Perubahan data member berhasil disimpan ke database."
        : "Data member baru berhasil ditambahkan ke database.",
      "success"
    );
  } catch (error) {
    console.error("Gagal menyimpan member:", error);
    ui.showFeedbackModal(
      "Gagal Menyimpan",
      error.message || "Gagal menyimpan data member. Silakan coba lagi.",
      "error"
    );
  } finally {
    if (memberFormSubmitBtn) {
      memberFormSubmitBtn.disabled = false;
      memberFormSubmitBtn.textContent =
        memberFormMode?.value === "edit" ? "Simpan Perubahan" : "Simpan Data";
    }
  }
}

function openDeleteModal(memberId) {
  if (!memberId) return;
  const member =
    filteredList.find((item) => item.id === memberId) ||
    allMembers.find((item) => item.id === memberId);
  pendingDeleteMemberId = memberId;
  if (deleteMemberNameEl) {
    deleteMemberNameEl.textContent = member?.nama ? `"${member.nama}"` : "ini";
  }
  if (deleteMemberModal) {
    deleteMemberModal.show();
  }
}

async function executeDeleteMember() {
  if (!pendingDeleteMemberId) return;
  try {
    if (confirmDeleteBtn) {
      confirmDeleteBtn.disabled = true;
      confirmDeleteBtn.textContent = "Menghapus...";
    }
    await repo.deleteMember(pendingDeleteMemberId);
    if (deleteMemberModal) deleteMemberModal.hide();
    await loadMembers();

    // Show feedback popup
    ui.showFeedbackModal(
      "Berhasil Dihapus!",
      "Data member telah berhasil dihapus dari database.",
      "success"
    );
  } catch (error) {
    console.error("Gagal menghapus member:", error);
    ui.showFeedbackModal(
      "Gagal Menghapus",
      error.message || "Gagal menghapus data member. Silakan coba lagi.",
      "error"
    );
  } finally {
    if (confirmDeleteBtn) {
      confirmDeleteBtn.disabled = false;
      confirmDeleteBtn.textContent = "Hapus";
    }
    pendingDeleteMemberId = null;
  }
}

/* ── Calculations & Summary ── */
function renderFoot() {
  const totalBayar = filteredList.reduce(
    (sum, m) => sum + ui.parsePrice(m.harga_dibayarkan),
    0
  );
  const totalEl = document.getElementById("tfootTotalValue");
  if (totalEl) {
    totalEl.textContent = "Rp" + totalBayar.toLocaleString("id-ID");
  }
}

function renderSummary() {
  const fullCount = filteredList.filter((m) =>
    ui.isFullPayment(m.metode_pembayaran)
  ).length;
  const dpCount = filteredList.filter((m) =>
    ui.isDP(m.metode_pembayaran)
  ).length;

  if (scTotal) scTotal.textContent = filteredList.length;
  if (scFull) scFull.textContent = fullCount;
  if (scDp) scDp.textContent = dpCount;

  document.querySelectorAll(".stat-card").forEach((c) => {
    const f = c.dataset.payFilter;
    c.classList.toggle(
      "active",
      f === paymentFilter || (f === "all" && paymentFilter === "all")
    );
  });
}

function renderTable() {
  if (!filteredList.length) {
    if (tableContainer) tableContainer.style.display = "none";
    if (emptyState) emptyState.style.display = "block";
    if (summaryText) summaryText.textContent = "Tidak ada member yang cocok dengan filter.";
    if (dataInfoText) dataInfoText.textContent = "";
    return;
  }

  const tp = Math.max(1, Math.ceil(filteredList.length / pageSize));
  if (currentPage > tp) currentPage = tp;
  const start = (currentPage - 1) * pageSize;
  const rows = filteredList.slice(start, start + pageSize);

  ui.renderHead(thead, sortKey, sortDir);
  if (tbody) {
    tbody.innerHTML = rows
      .map(
        (r) =>
          `<tr data-member-id="${ui.esc(r.id)}">${ui.COLUMNS.map(
            (c) => `<td>${ui.renderCell(r, c)}</td>`
          ).join("")}</tr>`
      )
      .join("");
  }

  if (tableContainer) tableContainer.style.display = "block";
  if (emptyState) emptyState.style.display = "none";
  if (summaryText) summaryText.textContent = `Menampilkan ${filteredList.length} member`;
  if (dataInfoText) dataInfoText.textContent = `Total: ${allMembers.length} member`;

  ui.renderPagination(pgnControls, pgnInfo, filteredList.length, currentPage, pageSize);
  renderFoot();
  renderSummary();
}

function applyFilters() {
  const term = String(searchInput?.value || "").toLowerCase().trim();
  let list = allMembers.slice();

  if (term) {
    list = list.filter((m) =>
      ui.COLUMNS.some((c) => {
        if (c.type === "image_link") return false;
        return String(m[c.key] || "").toLowerCase().includes(term);
      })
    );
  }

  const sv = startDateInput?.value;
  const ev = endDateInput?.value;
  if (sv || ev) {
    const sd = sv ? ui.parseDateOnly(sv) : null;
    const ed = ev ? ui.parseDateOnly(ev) : null;
    list = list.filter((m) => {
      const d = ui.toTs(m.created_at);
      if (!d) return false;
      const nd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      if (sd && nd < sd) return false;
      if (ed && nd > ed) return false;
      return true;
    });
  }

  if (paymentFilter === "full") {
    list = list.filter((m) => ui.isFullPayment(m.metode_pembayaran));
  } else if (paymentFilter === "dp") {
    list = list.filter((m) => ui.isDP(m.metode_pembayaran));
  }

  list.sort((a, b) => cmpRows(a, b, sortKey, sortDir));
  filteredList = list;
  currentPage = 1;
  renderTable();
}

async function loadMembers() {
  if (loadingState) loadingState.style.display = "block";
  if (emptyState) emptyState.style.display = "none";
  if (tableContainer) tableContainer.style.display = "none";
  if (summaryText) summaryText.textContent = "Sedang memuat data member...";

  try {
    const rawList = await repo.fetchMembers();
    allMembers = rawList.map((raw) => ui.mapRow(raw));
    if (summaryText) summaryText.textContent = `Memuat ${allMembers.length} member dari Firebase`;
    if (loadingState) loadingState.style.display = "none";
    applyFilters();
  } catch (e) {
    console.error("Gagal memuat data_member:", e);
    if (loadingState) loadingState.style.display = "none";
    if (emptyState) emptyState.style.display = "block";
    if (summaryText) {
      summaryText.textContent = "Gagal memuat data member. Cek koneksi atau Firebase.";
    }
  }
}

/**
 * Wire all events
 */
function setupEvents() {
  // Realtime Rupiah input formatting
  memberFormHarga?.addEventListener("input", (e) => {
    const curPos = e.target.selectionStart;
    const oldLen = e.target.value.length;
    e.target.value = ui.formatRupiahInput(e.target.value);
    const newLen = e.target.value.length;
    const newPos = Math.max(0, curPos + (newLen - oldLen));
    e.target.setSelectionRange(newPos, newPos);
  });

  // Search input debounced
  let searchTimer;
  searchInput?.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => applyFilters(), 250);
  });

  // Date filters
  startDateInput?.addEventListener("change", applyFilters);
  endDateInput?.addEventListener("change", applyFilters);
  btnResetDate?.addEventListener("click", () => {
    if (startDateInput) startDateInput.value = "";
    if (endDateInput) endDateInput.value = "";
    applyFilters();
  });

  // Payment filter select
  paymentFilterSelect?.addEventListener("change", () => {
    paymentFilter = paymentFilterSelect.value;
    applyFilters();
  });

  // Page size select
  pageSizeSelect?.addEventListener("change", () => {
    pageSize = parseInt(pageSizeSelect.value, 10) || 25;
    currentPage = 1;
    renderTable();
  });

  // Stat cards filter click
  document.getElementById("statCards")?.addEventListener("click", (e) => {
    const card = e.target.closest(".stat-card");
    if (!card) return;
    const target = card.dataset.payFilter;
    if (!target) return;
    paymentFilter = target;
    if (paymentFilterSelect) paymentFilterSelect.value = target;
    applyFilters();
  });

  // Table header sorting
  thead?.addEventListener("click", (e) => {
    const th = e.target.closest("th[data-sort-key]");
    if (!th) return;
    const key = th.dataset.sortKey;
    if (sortKey === key) {
      sortDir = sortDir === "asc" ? "desc" : "asc";
    } else {
      sortKey = key;
      sortDir = "asc";
    }
    applyFilters();
  });

  // Pagination buttons
  pgnControls?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-page]");
    if (!btn || btn.disabled) return;
    const pg = parseInt(btn.dataset.page, 10);
    if (!isNaN(pg)) {
      currentPage = pg;
      renderTable();
    }
  });

  // Add Member button
  document.getElementById("btnAddMember")?.addEventListener("click", openAddMemberForm);

  // File change listener for live proof image preview
  memberFormBuktiFile?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const objectUrl = URL.createObjectURL(file);
      if (memberFormBuktiPreviewImg) memberFormBuktiPreviewImg.src = objectUrl;
      if (memberFormBuktiPreviewLink) memberFormBuktiPreviewLink.href = objectUrl;
      if (memberFormBuktiPreviewBadge) {
        memberFormBuktiPreviewBadge.innerHTML = '<i class="bi bi-arrow-repeat me-1"></i>File Baru Dipilih';
        memberFormBuktiPreviewBadge.className = 'badge bg-primary bg-opacity-10 text-primary fw-bold';
      }
      if (memberFormBuktiPreviewNote) {
        memberFormBuktiPreviewNote.textContent = `File baru: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      }
      if (memberFormBuktiPreviewWrap) memberFormBuktiPreviewWrap.style.display = "flex";
    } else if (!currentProofUrl) {
      if (memberFormBuktiPreviewWrap) memberFormBuktiPreviewWrap.style.display = "none";
    } else {
      if (memberFormBuktiPreviewImg) memberFormBuktiPreviewImg.src = currentProofUrl;
      if (memberFormBuktiPreviewLink) memberFormBuktiPreviewLink.href = currentProofUrl;
      if (memberFormBuktiPreviewBadge) {
        memberFormBuktiPreviewBadge.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>Bukti Tersimpan';
        memberFormBuktiPreviewBadge.className = 'badge bg-success bg-opacity-10 text-success fw-bold';
      }
      if (memberFormBuktiPreviewNote) {
        memberFormBuktiPreviewNote.textContent = "Gambar bukti transfer yang saat ini digunakan.";
      }
      if (memberFormBuktiPreviewWrap) memberFormBuktiPreviewWrap.style.display = "flex";
    }
  });

  // Form submit button
  memberFormSubmitBtn?.addEventListener("click", saveMemberForm);

  // Confirm delete button
  confirmDeleteBtn?.addEventListener("click", executeDeleteMember);

  // Table row clicks (Edit, Delete, or View Detail)
  tbody?.addEventListener("click", (e) => {
    // Edit button click
    const editBtn = e.target.closest(".btn-edit-member");
    if (editBtn) {
      e.stopPropagation();
      const id = editBtn.dataset.id;
      const m = allMembers.find((item) => item.id === id);
      if (m) openEditMemberForm(m);
      return;
    }

    // Delete button click
    const delBtn = e.target.closest(".btn-delete-member");
    if (delBtn) {
      e.stopPropagation();
      const id = delBtn.dataset.id;
      openDeleteModal(id);
      return;
    }

    // Ignore clicks on links or copy buttons
    if (e.target.closest("a") || e.target.closest(".btn-copy-wa")) {
      return;
    }

    // Click anywhere else on row opens detail
    const rowEl = e.target.closest("tr[data-member-id]");
    if (rowEl) {
      const id = rowEl.dataset.memberId;
      const m = allMembers.find((item) => item.id === id);
      if (m) ui.openMemberDetail(m);
    }
  });
}

/**
 * Initialize Member Data page
 */
async function initializeMemberData() {
  try {
    const { user, role } = await requireAuth();

    // Ensure address bar URL is always clean canonical /member-data
    if (window.location.pathname !== "/member-data") {
      try {
        window.history.replaceState(null, "", "/member-data" + window.location.search);
      } catch (_) {}
    }

    // Render shared topbar and sidebar
    renderTopbar({ user, role });
    renderSidebar({ role, activePage: "member-data" });

    // Cache DOM references
    loadingState = document.getElementById("loadingState");
    emptyState = document.getElementById("emptyState");
    tableContainer = document.getElementById("tableContainer");
    summaryText = document.getElementById("summaryText");
    dataInfoText = document.getElementById("dataInfoText");
    thead = document.getElementById("memberTableHead");
    tbody = document.getElementById("memberTableBody");
    pgnInfo = document.getElementById("pgnInfo");
    pgnControls = document.getElementById("pgnControls");
    searchInput = document.getElementById("memberSearchInput");
    startDateInput = document.getElementById("filterStartDate");
    endDateInput = document.getElementById("filterEndDate");
    btnResetDate = document.getElementById("btnResetDate");
    paymentFilterSelect = document.getElementById("paymentFilterSelect");
    pageSizeSelect = document.getElementById("pageSizeSelect");
    scTotal = document.getElementById("scTotal");
    scFull = document.getElementById("scFull");
    scDp = document.getElementById("scDp");

    // Modals
    const formModalEl = document.getElementById("memberFormModal");
    if (formModalEl && window.bootstrap?.Modal) {
      memberFormModal = window.bootstrap.Modal.getOrCreateInstance(formModalEl);
    }

    const detailModalEl = document.getElementById("memberDetailModal");
    if (detailModalEl && window.bootstrap?.Modal) {
      memberDetailModal = window.bootstrap.Modal.getOrCreateInstance(detailModalEl);
    }

    const deleteModalEl = document.getElementById("deleteMemberModal");
    if (deleteModalEl && window.bootstrap?.Modal) {
      deleteMemberModal = window.bootstrap.Modal.getOrCreateInstance(deleteModalEl);
    }

    memberFormMode = document.getElementById("memberFormMode");
    memberEditId = document.getElementById("memberEditId");
    memberFormTitle = document.getElementById("memberFormTitle");
    memberFormSubtitle = document.getElementById("memberFormSubtitle");
    memberFormSubmitBtn = document.getElementById("memberFormSubmitBtn");
    memberFormNama = document.getElementById("memberFormNama");
    memberFormWhatsapp = document.getElementById("memberFormWhatsapp");
    memberFormKota = document.getElementById("memberFormKota");
    memberFormProduk = document.getElementById("memberFormProduk");
    memberFormHarga = document.getElementById("memberFormHarga");
    memberFormMetode = document.getElementById("memberFormMetode");
    memberFormSumber = document.getElementById("memberFormSumber");
    memberFormBuktiFile = document.getElementById("memberFormBuktiFile");
    memberFormBuktiHelp = document.getElementById("memberFormBuktiHelp");
    memberFormBuktiPreviewWrap = document.getElementById("memberFormBuktiPreviewWrap");
    memberFormBuktiPreviewImg = document.getElementById("memberFormBuktiPreviewImg");
    memberFormBuktiPreviewBadge = document.getElementById("memberFormBuktiPreviewBadge");
    memberFormBuktiPreviewNote = document.getElementById("memberFormBuktiPreviewNote");
    memberFormBuktiPreviewLink = document.getElementById("memberFormBuktiPreviewLink");
    confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
    deleteMemberNameEl = document.getElementById("deleteMemberName");

    setupEvents();
    await loadMembers();
  } catch (err) {
    console.error("Initialization failed:", err);
  }
}

// Bootstrap on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeMemberData);
} else {
  initializeMemberData();
}
