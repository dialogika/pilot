// pages/marketing/member-data/member-data.repository.js
// =====================================================================
// MEMBER DATA REPOSITORY (Data Layer)
// Handles Firestore collection `data_member` and Firebase Storage `member-proofs/`.
// =====================================================================

import { db, storage } from "/assets/js/firebase-config.js";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import {
  downloadExportFile,
  calcDateRange,
  formatDateIndo,
  extractTimestamp,
} from "../../../assets/js/utils/export-helper.js";

const COLLECTION_NAME = "data_member";

/**
 * Fetch all member documents from Firestore
 * @returns {Promise<Array<Object>>}
 */
export async function fetchMembers() {
  const snap = await getDocs(collection(db, COLLECTION_NAME));
  const list = [];
  snap.forEach((d) => {
    list.push({
      ...(d.data() || {}),
      id: d.id,
    });
  });
  return list;
}

/**
 * Create a new member document
 * @param {Object} payload
 * @returns {Promise<string>} created document id
 */
export async function createMember(payload) {
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    ...payload,
    created_at: new Date(),
  });
  return docRef.id;
}

/**
 * Update an existing member document
 * @param {string} memberId
 * @param {Object} payload
 * @returns {Promise<void>}
 */
export async function updateMember(memberId, payload) {
  if (!memberId) throw new Error("Member ID is required for update.");
  await updateDoc(doc(db, COLLECTION_NAME, memberId), payload);
}

/**
 * Delete a member document
 * @param {string} memberId
 * @returns {Promise<void>}
 */
export async function deleteMember(memberId) {
  if (!memberId) throw new Error("Member ID is required for deletion.");
  await deleteDoc(doc(db, COLLECTION_NAME, memberId));
}

/**
 * Upload proof of transfer image to Firebase Storage
 * @param {File} file
 * @param {string} [memberId="new"]
 * @returns {Promise<string>} Download URL
 */
export async function uploadProofImage(file, memberId = "new") {
  if (!file) return "";
  if (!file.type || !file.type.startsWith("image/")) {
    throw new Error("File harus berupa gambar.");
  }
  if (file.size > 3 * 1024 * 1024) {
    throw new Error("Ukuran gambar maksimal 3 MB.");
  }
  const cleanName = String(file.name || "proof").replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `member-proofs/${memberId}-${Date.now()}-${cleanName}`;
  const fileRef = storageRef(storage, filePath);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}

/**
 * Export member data to Excel or CSV
 */
export async function exportMemberData({ format = "xlsx", dateRange = "all", startDate = "", endDate = "" }) {
  const members = await fetchMembers();
  const { start, end } = calcDateRange(dateRange, startDate, endDate);

  const filtered = members.filter((item) => {
    if (!start && !end) return true;
    const time = extractTimestamp(item.created_at || item.createdAt || item.date);
    if (!time) return true;
    if (start && time < start) return false;
    if (end && time > end) return false;
    return true;
  });

  const columns = [
    { key: "no", header: "No", width: 6 },
    { key: "nama", header: "Nama Member", width: 22 },
    { key: "whatsapp", header: "No. WhatsApp", width: 16 },
    { key: "kota", header: "Kota", width: 16 },
    { key: "produk_dibeli", header: "Produk Dibeli", width: 25 },
    { key: "harga_dibayarkan", header: "Harga Dibayarkan (Rp)", width: 22 },
    { key: "metode_pembayaran", header: "Metode Pembayaran", width: 20 },
    { key: "sumber_informasi", header: "Sumber Informasi", width: 20 },
    { key: "date", header: "Tanggal Bergabung", width: 20 },
  ];

  const rows = filtered.map((item, index) => {
    const rawPrice = item.harga_dibayarkan || item.harga || item.nominal || 0;
    const priceNum = typeof rawPrice === "number" ? rawPrice : parseInt(String(rawPrice).replace(/[^0-9]/g, ""), 10) || 0;
    return {
      no: index + 1,
      nama: item.nama || item.name || "-",
      whatsapp: item.whatsapp || item.no_wa || item.phone || "-",
      kota: item.kota || item.city || "-",
      produk_dibeli: item.produk_dibeli || item.produk || item.program || "-",
      harga_dibayarkan: priceNum ? priceNum.toLocaleString("id-ID") : "0",
      metode_pembayaran: item.metode_pembayaran || item.metode || item.payment_method || "-",
      sumber_informasi: item.sumber_informasi || item.sumber || item.source || "-",
      date: formatDateIndo(item.created_at || item.createdAt || item.date),
    };
  });

  const filename = `Data_Member_${new Date().toISOString().slice(0, 10)}`;
  await downloadExportFile({
    format,
    filename,
    sheetName: "Data Member",
    columns,
    rows,
  });

  return { total: rows.length };
}

