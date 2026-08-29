// pages/hr/office-inventory/office-inventory.ui.js
// =====================================================================
// OFFICE INVENTORY UI MODULE
// Handles DOM rendering, modal states, table formatting, and input binding.
// Pure UI module: NO direct Firestore queries.
// =====================================================================

import { KATEGORI_MAP, LOKASI_MAP, STATUS_MAP } from "./office-inventory.repository.js";

/**
 * Format timestamp or date string to Indonesian formatted date (e.g. 08 Agu 2025).
 * @param {any} dateVal
 * @returns {string}
 */
export function formatDisplayDate(dateVal) {
  if (!dateVal) return "-";
  try {
    const d = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch (e) {
    return String(dateVal);
  }
}

/**
 * Convert timestamp/date to YYYY-MM-DD for <input type="date">.
 * @param {any} dateVal
 * @returns {string}
 */
export function formatInputDate(dateVal) {
  if (!dateVal) return "";
  try {
    const d = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  } catch (e) {
    return "";
  }
}

/**
 * Render table rows into #inventoryTableBody.
 * @param {Array} items
 * @param {Object} handlers - { onEdit: (id) => void, onDelete: (id, name) => void }
 */
export function renderTable(items, handlers = {}) {
  const tbody = document.getElementById("inventoryTableBody");
  if (!tbody) return;

  if (!items || items.length === 0) {
    renderEmpty(tbody);
    return;
  }

  tbody.innerHTML = items
    .map((item) => {
      const kategoriLabel = KATEGORI_MAP[item.kategori_kode] || item.kategori_label || item.kategori_kode || "-";
      const lokasiLabel = LOKASI_MAP[item.lokasi_kode] || item.lokasi_label || item.lokasi_kode || "-";
      const statusInfo = STATUS_MAP[item.status] || {
        label: item.status || "Available",
        class: "status-available",
      };

      const tglBeli = formatDisplayDate(item.tanggal_beli);
      const idDisplay = item.id_generated || item.id || "-";
      const kondisi = item.kondisi || "Baik";
      const jumlah = item.jumlah || 1;

      let kondisiColor = "text-green-600 bg-green-50";
      if (kondisi === "Rusak Ringan") kondisiColor = "text-yellow-600 bg-yellow-50";
      if (kondisi === "Rusak Berat") kondisiColor = "text-red-600 bg-red-50";

      return `
        <tr class="hover:bg-slate-50 transition text-xs border-b border-slate-100">
          <td class="px-3 py-2.5 whitespace-nowrap">
            <span class="id-monospace">${idDisplay}</span>
          </td>
          <td class="px-3 py-2.5 font-semibold text-slate-800">${item.nama_barang || "-"}</td>
          <td class="px-3 py-2.5 text-slate-600 whitespace-nowrap">
            <span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-xs font-semibold">${item.kategori_kode || "-"}</span>
            <span class="text-xs text-slate-400 ml-1">${kategoriLabel}</span>
          </td>
          <td class="px-3 py-2.5 text-slate-600 whitespace-nowrap">
            <span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-xs font-semibold">${item.lokasi_kode || "-"}</span>
            <span class="text-xs text-slate-400 ml-1">${lokasiLabel}</span>
          </td>
          <td class="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">${tglBeli}</td>
          <td class="px-2 py-2.5 text-center whitespace-nowrap">
            <span class="text-xs font-bold ${item.tipe_pembelian === "SUB" ? "text-amber-600" : "text-slate-500"}">
              ${item.tipe_pembelian || "OTM"}
            </span>
          </td>
          <td class="px-2 py-2.5 text-center whitespace-nowrap">
            <span class="px-1.5 py-0.5 rounded-md text-xs font-medium ${kondisiColor}">${kondisi}</span>
          </td>
          <td class="px-2 py-2.5 text-center font-medium text-slate-700 whitespace-nowrap">${jumlah}</td>
          <td class="px-3 py-2.5 text-center whitespace-nowrap">
            <span class="status-badge ${statusInfo.class}">
              <i class="fas fa-circle text-[5px]"></i>
              ${statusInfo.label}
            </span>
          </td>
          <td class="px-3 py-2.5 text-right whitespace-nowrap">
            <div class="action-btns">
              <button type="button" class="action-btn edit-btn" data-id="${item.id}" data-nama="${item.nama_barang || ""}" title="Edit">
                <i class="fas fa-pen"></i>
              </button>
              <button type="button" class="action-btn delete-btn" data-id="${item.id}" data-nama="${item.nama_barang || ""}" title="Hapus">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  // Attach event handlers
  tbody.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      if (handlers.onEdit) handlers.onEdit(id);
    });
  });

  tbody.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const nama = btn.dataset.nama;
      if (handlers.onDelete) handlers.onDelete(id, nama);
    });
  });
}

/**
 * Show loading placeholder in table.
 * @param {HTMLElement} [tbody]
 */
export function renderLoading(tbody) {
  const target = tbody || document.getElementById("inventoryTableBody");
  if (!target) return;
  target.innerHTML = `
    <tr>
      <td colspan="10" class="px-6 py-12 text-center text-slate-400">
        <i class="fas fa-box-open text-3xl mb-3 block animate-pulse"></i>
        Memuat data inventaris...
      </td>
    </tr>
  `;
}

/**
 * Show empty data state in table.
 * @param {HTMLElement} [tbody]
 * @param {string} [message]
 */
export function renderEmpty(tbody, message = "Belum ada data inventaris.") {
  const target = tbody || document.getElementById("inventoryTableBody");
  if (!target) return;
  target.innerHTML = `
    <tr>
      <td colspan="10" class="px-6 py-12 text-center text-slate-400">
        <i class="fas fa-box-open text-3xl mb-3 block"></i>
        ${message}
      </td>
    </tr>
  `;
}

/* =====================================================================
   MODAL CONTROLS
   ===================================================================== */

export function openAddModal() {
  const overlay = document.getElementById("addOverlay");
  if (overlay) {
    resetAddForm();
    overlay.classList.add("show");
  }
}

export function closeAddModal() {
  const overlay = document.getElementById("addOverlay");
  if (overlay) {
    overlay.classList.remove("show");
    resetAddForm();
  }
}

export function resetAddForm() {
  const el = (id) => document.getElementById(id);
  if (el("addNama")) el("addNama").value = "";
  if (el("addKategori")) el("addKategori").value = "";
  if (el("addLokasi")) el("addLokasi").value = "";
  if (el("addTglBeli")) el("addTglBeli").value = "";
  if (el("addTipe")) el("addTipe").value = "OTM";
  if (el("addKondisi")) el("addKondisi").value = "Baik";
  if (el("addJumlah")) el("addJumlah").value = "1";
}

export function getAddFormData() {
  const el = (id) => document.getElementById(id);
  return {
    nama_barang: el("addNama")?.value.trim() || "",
    kategori_kode: el("addKategori")?.value || "",
    lokasi_kode: el("addLokasi")?.value || "",
    tanggal_beli: el("addTglBeli")?.value || "",
    tipe_pembelian: el("addTipe")?.value || "OTM",
    kondisi: el("addKondisi")?.value || "Baik",
    jumlah: parseInt(el("addJumlah")?.value, 10) || 1,
  };
}

export function openEditModal(item) {
  if (!item) return;
  const overlay = document.getElementById("editOverlay");
  const el = (id) => document.getElementById(id);

  if (el("editNama")) el("editNama").value = item.nama_barang || "";
  if (el("editKategori")) el("editKategori").value = item.kategori_kode || "";
  if (el("editLokasi")) el("editLokasi").value = item.lokasi_kode || "";
  if (el("editTipe")) el("editTipe").value = item.tipe_pembelian || "OTM";
  if (el("editKondisi")) el("editKondisi").value = item.kondisi || "Baik";
  if (el("editStatus")) el("editStatus").value = item.status || "Available";
  if (el("editJumlah")) el("editJumlah").value = item.jumlah || 1;
  if (el("editTglBeli")) el("editTglBeli").value = formatInputDate(item.tanggal_beli);

  if (overlay) overlay.classList.add("show");
}

export function closeEditModal() {
  const overlay = document.getElementById("editOverlay");
  if (overlay) overlay.classList.remove("show");
}

export function getEditFormData() {
  const el = (id) => document.getElementById(id);
  return {
    nama_barang: el("editNama")?.value.trim() || "",
    kategori_kode: el("editKategori")?.value || "",
    lokasi_kode: el("editLokasi")?.value || "",
    tanggal_beli: el("editTglBeli")?.value || "",
    tipe_pembelian: el("editTipe")?.value || "OTM",
    kondisi: el("editKondisi")?.value || "Baik",
    status: el("editStatus")?.value || "Available",
    jumlah: parseInt(el("editJumlah")?.value, 10) || 1,
  };
}

export function openDeleteModal(id, name) {
  const overlay = document.getElementById("deleteOverlay");
  const nameEl = document.getElementById("deleteItemName");
  if (nameEl) nameEl.textContent = name || "Barang ini";
  if (overlay) overlay.classList.add("show");
}

export function closeDeleteModal() {
  const overlay = document.getElementById("deleteOverlay");
  if (overlay) overlay.classList.remove("show");
}

export function setButtonLoading(buttonId, isLoading, loadingHtml, defaultHtml) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.disabled = isLoading;
  btn.innerHTML = isLoading ? loadingHtml : defaultHtml;
}
