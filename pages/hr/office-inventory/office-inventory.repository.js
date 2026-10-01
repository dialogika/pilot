// pages/hr/office-inventory/office-inventory.repository.js
// =====================================================================
// OFFICE INVENTORY DATA ACCESS
// The ONLY module that talks to Firebase Firestore for Office Inventory.
// =====================================================================

import { db } from "../../../assets/js/firebase-config.js";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  downloadExportFile,
  calcDateRange,
  formatDateIndo,
  extractTimestamp,
} from "../../../assets/js/utils/export-helper.js";

export const INVENTORY_COLLECTION = "inventory";

export const KATEGORI_MAP = {
  ATK: "Alat Tulis",
  ETK: "Elektronik",
  FUR: "Furnitur",
  BRS: "Kebersihan",
  SMP: "Penyimpanan",
  PERTEN: "Peralatan Konten",
  DEC: "Dekorasi",
  OTH: "Lainnya",
};

export const LOKASI_MAP = {
  UTM: "Ruang Utama",
  KLS: "Ruang Kelas",
  INT: "Dengan Intern",
  STD: "Ruang Studio",
  JNT: "Janitor",
  HLM: "Halaman Belakang",
  MUS: "Musholla",
};

export const STATUS_MAP = {
  Available: { label: "Available", class: "status-available" },
  "In Use": { label: "In Use", class: "status-in-use" },
  Repair: { label: "Repair", class: "status-repair" },
};

let kategoriCounterCache = {};

/**
 * Load counter cache from Firestore inventory collection to ensure accurate sequence generation.
 * @returns {Promise<Object>}
 */
export async function loadKategoriCounters() {
  try {
    const snap = await getDocs(collection(db, INVENTORY_COLLECTION));
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      if (d.kategori_kode && d.lokasi_kode) {
        const key = `${d.kategori_kode}.${d.lokasi_kode}`;
        const urut = d.urutan || 0;
        if (!kategoriCounterCache[key] || urut > kategoriCounterCache[key]) {
          kategoriCounterCache[key] = urut;
        }
      }
    });
  } catch (e) {
    console.warn("Gagal load counter cache:", e);
  }
  return kategoriCounterCache;
}

/**
 * Generate formatted Inventory ID: `${kategoriKode}.${lokasiKode}.${urutStr}/DIA/${bulan}.${tanggal}/${tipe}`
 * @param {string} kategoriKode
 * @param {string} lokasiKode
 * @param {string|Date} tglBeli
 * @param {string} tipe
 * @returns {Promise<string>}
 */
export async function generateInventoryID(kategoriKode, lokasiKode, tglBeli, tipe) {
  const key = `${kategoriKode}.${lokasiKode}`;
  let lastUrut = kategoriCounterCache[key] || 0;

  try {
    const q = query(
      collection(db, INVENTORY_COLLECTION),
      where("kategori_kode", "==", kategoriKode),
      where("lokasi_kode", "==", lokasiKode),
      orderBy("urutan", "desc")
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const maxUrut = snap.docs[0].data().urutan || 0;
      if (maxUrut > lastUrut) lastUrut = maxUrut;
    }
  } catch (e) {
    console.warn("Gagal query counter urutan, menggunakan cache:", e);
  }

  const urutBaru = lastUrut + 1;
  kategoriCounterCache[key] = urutBaru;

  const d = new Date(tglBeli);
  const bulan = String(d.getMonth() + 1).padStart(2, "0");
  const tanggal = String(d.getDate()).padStart(2, "0");
  const urutStr = String(urutBaru).padStart(3, "0");

  return `${kategoriKode}.${lokasiKode}.${urutStr}/DIA/${bulan}.${tanggal}/${tipe}`;
}

/**
 * Get current sequence number for a category/location pair.
 * @param {string} kategoriKode
 * @param {string} lokasiKode
 * @returns {number}
 */
export function getSequenceNumber(kategoriKode, lokasiKode) {
  const key = `${kategoriKode}.${lokasiKode}`;
  return kategoriCounterCache[key] || 1;
}

/**
 * Real-time listener for all inventory items ordered by created_at desc.
 * @param {function(Array): void} onUpdate
 * @param {function(Error): void} onError
 * @returns {function(): void} Unsubscribe function
 */
export function subscribeToInventory(onUpdate, onError) {
  const q = query(collection(db, INVENTORY_COLLECTION), orderBy("created_at", "desc"));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() });
      });
      onUpdate(items);
    },
    (error) => {
      console.error("Gagal listen inventory:", error);
      if (onError) onError(error);
    }
  );
}

/**
 * Fetch a single inventory record by ID.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getInventory(id) {
  const docSnap = await getDoc(doc(db, INVENTORY_COLLECTION, id));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() };
}

/**
 * Create a new inventory record in Firestore.
 * @param {Object} itemData
 * @returns {Promise<string>} Created Document ID
 */
export async function addInventory(itemData) {
  const payload = {
    id_generated: itemData.id_generated,
    nama_barang: itemData.nama_barang,
    kategori_kode: itemData.kategori_kode,
    kategori_label: KATEGORI_MAP[itemData.kategori_kode] || itemData.kategori_kode,
    lokasi_kode: itemData.lokasi_kode,
    lokasi_label: LOKASI_MAP[itemData.lokasi_kode] || itemData.lokasi_kode,
    tanggal_beli: itemData.tanggal_beli instanceof Date ? itemData.tanggal_beli : new Date(itemData.tanggal_beli),
    tipe_pembelian: itemData.tipe_pembelian,
    kondisi: itemData.kondisi,
    jumlah: parseInt(itemData.jumlah, 10) || 1,
    status: itemData.status || "Available",
    urutan: itemData.urutan || 1,
    created_at: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, INVENTORY_COLLECTION), payload);
  return docRef.id;
}

/**
 * Update an existing inventory record.
 * @param {string} id
 * @param {Object} itemData
 * @returns {Promise<void>}
 */
export async function updateInventory(id, itemData) {
  const payload = {
    nama_barang: itemData.nama_barang,
    kategori_kode: itemData.kategori_kode,
    kategori_label: KATEGORI_MAP[itemData.kategori_kode] || itemData.kategori_kode,
    lokasi_kode: itemData.lokasi_kode,
    lokasi_label: LOKASI_MAP[itemData.lokasi_kode] || itemData.lokasi_kode,
    tanggal_beli: itemData.tanggal_beli instanceof Date ? itemData.tanggal_beli : new Date(itemData.tanggal_beli),
    tipe_pembelian: itemData.tipe_pembelian,
    kondisi: itemData.kondisi,
    status: itemData.status,
    jumlah: parseInt(itemData.jumlah, 10) || 1,
  };

  await updateDoc(doc(db, INVENTORY_COLLECTION, id), payload);
}

/**
 * Delete an inventory record by ID.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteInventory(id) {
  await deleteDoc(doc(db, INVENTORY_COLLECTION, id));
}

/**
 * Export inventory data based on modal filter options.
 * @param {Object} options
 * @param {string} [options.format="xlsx"]
 * @param {string} [options.rangeType="all"]
 * @param {string} [options.startDate]
 * @param {string} [options.endDate]
 * @param {string} [options.monthValue]
 * @param {string|number} [options.weekValue]
 * @param {string} [options.status=""]
 * @returns {Promise<{ count: number, filename: string }>}
 */
export async function exportInventoryData({
  format = "xlsx",
  rangeType = "all",
  startDate,
  endDate,
  monthValue,
  weekValue,
  status = "",
}) {
  const { start, end, label: periodLabel } = calcDateRange({
    rangeType,
    startDate,
    endDate,
    monthValue,
    weekValue,
  });

  const snap = await getDocs(
    query(collection(db, INVENTORY_COLLECTION), orderBy("created_at", "desc")),
  );

  const raw = [];
  snap.forEach((d) => {
    raw.push({ id: d.id, ...d.data() });
  });

  const filtered = raw.filter((item) => {
    if (status && status !== "" && String(item.status || "").toLowerCase() !== status.toLowerCase()) {
      return false;
    }
    if (start && end) {
      const ts = extractTimestamp(item.tanggal_beli || item.created_at);
      if (!ts) return false;
      const itemDate = new Date(ts);
      if (itemDate < start || itemDate > end) return false;
    }
    return true;
  });

  const columns = [
    { header: "No", key: "no", width: 8 },
    { header: "Kode Barang", key: "idGenerated", width: 22 },
    { header: "Nama Barang", key: "namaBarang", width: 28 },
    { header: "Kategori", key: "kategori", width: 20 },
    { header: "Lokasi", key: "lokasi", width: 20 },
    { header: "Tanggal Pembelian", key: "tanggalBeli", width: 18 },
    { header: "Tipe Pembelian", key: "tipePembelian", width: 16 },
    { header: "Kondisi", key: "kondisi", width: 16 },
    { header: "Jumlah (Qty)", key: "jumlah", width: 14 },
    { header: "Status", key: "status", width: 16 },
  ];

  const rows = filtered.map((item, idx) => ({
    no: idx + 1,
    idGenerated: item.id_generated || "-",
    namaBarang: item.nama_barang || "-",
    kategori: item.kategori_label || KATEGORI_MAP[item.kategori_kode] || item.kategori_kode || "-",
    lokasi: item.lokasi_label || LOKASI_MAP[item.lokasi_kode] || item.lokasi_kode || "-",
    tanggalBeli: formatDateIndo(item.tanggal_beli) || "-",
    tipePembelian: item.tipe_pembelian || "-",
    kondisi: item.kondisi || "-",
    jumlah: Number(item.jumlah || 1),
    status: (item.status || "Available").toUpperCase(),
  }));

  const filename = `Data_Inventaris_Kantor_${periodLabel}`;
  await downloadExportFile({
    filename,
    sheetName: "Inventaris Kantor",
    columns,
    rows,
    format,
  });

  return { count: rows.length, filename };
}

