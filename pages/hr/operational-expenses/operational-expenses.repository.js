// pages/hr/operational-expenses/operational-expenses.repository.js
// =====================================================================
// DATA ACCESS LAYER: OPERATIONAL EXPENSES
// Pure Firestore, Firebase Storage, and Discord Webhook integration.
// Zero DOM manipulation.
// =====================================================================

import { db, storage } from "/assets/js/firebase-config.js";
import {
  collection,
  getDocs,
  setDoc,
  doc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1519571944364576809/hDYfs52OwPDvKcu_00WuL48PAcF0TKf_4BgDGu58vUXNmaVGkPg0w5aMoArM9OU02-ax";

const withTimeout = (promise, ms = 10000) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Firestore request timeout")), ms))
  ]);

const firstFilled = (...values) => {
  for (const value of values) {
    if (String(value || "").trim()) {
      return String(value || "").trim();
    }
  }
  return "";
};

const normalizeWhatsappNumber = (phone) => {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("0")) {
    digits = "62" + digits.slice(1);
  } else if (digits.startsWith("8")) {
    digits = "62" + digits;
  }
  return digits;
};

const extractMentorBankInfo = (data = {}) => ({
  beneficiaryName: firstFilled(
    data.beneficiaryName,
    data.accountHolderName,
    data.accountName,
    data.namaPemilikRekening,
    data.nama_rekening,
    data.namaRekening,
    data.fullName,
    data.nama_lengkap,
    data.name
  ),
  bankName: firstFilled(
    data.bankName,
    data.bank,
    data.namaBank,
    data.bank_name,
    data.rekeningBank,
    data.bankAccountBank
  ),
  accountNumber: firstFilled(
    data.accountNumber,
    data.noRekening,
    data.no_rekening,
    data.nomorRekening,
    data.nomor_rekening,
    data.account_number
  )
});

const extractMentorWhatsapp = (data = {}) =>
  firstFilled(
    data.whatsappNumber,
    data.whatsapp,
    data.whatsApp,
    data.phone,
    data.no_wa,
    data.noWa,
    data.no_hp,
    data.noHp,
    data.nomorHp,
    data.nomor_hp,
    data.telepon
  );

export const mapExpenseDoc = (id, d = {}) => ({
  id,
  title: d.title || "",
  category: d.category || "other",
  department: d.department || "General",
  requesterId: d.requesterId || "",
  requesterName: d.requesterName || "",
  classId: d.classId || "",
  relatedClass: d.relatedClass || "",
  mentorId: d.mentorId || "",
  mentorName: d.mentorName || "",
  dueDate: d.dueDate || "",
  amount: typeof d.amount === "number" ? d.amount : Number(d.amount) || 0,
  status: d.status || "requested",
  beneficiaryName: d.beneficiaryName || "",
  bankName: d.bankName || "",
  accountNumber: d.accountNumber || "",
  paymentMethod: d.paymentMethod || "Transfer Bank",
  transferProofUrl: d.transferProofUrl || "",
  transferProofPath: d.transferProofPath || "",
  mentorWhatsapp: d.mentorWhatsapp || "",
  whatsappMessage: d.whatsappMessage || "",
  whatsappLink: d.whatsappLink || "",
  notes: d.notes || "",
  paymentNotes: d.paymentNotes || "",
  vendorName: d.vendorName || "",
  expensePeriod: d.expensePeriod || "",
  reimburseType: d.reimburseType || "",
  reimburseReason: d.reimburseReason || "",
  reimburseProofUrl: d.reimburseProofUrl || "",
  reimburseProofPath: d.reimburseProofPath || "",
  toolName: d.toolName || "",
  billingPeriod: d.billingPeriod || "",
  travelerName: d.travelerName || "",
  travelDate: d.travelDate || "",
  travelRoute: d.travelRoute || "",
  referenceLabel: d.referenceLabel || "",
  referenceDetail: d.referenceDetail || "",
  paidAtMs: typeof d.paidAtMs === "number" ? d.paidAtMs : 0,
  createdAtMs: typeof d.createdAtMs === "number" ? d.createdAtMs : 0,
  updatedAtMs: typeof d.updatedAtMs === "number" ? d.updatedAtMs : 0
});

/**
 * Loads all operational expenses from Firestore.
 * @returns {Promise<Array>}
 */
export async function loadExpenses() {
  try {
    const q = query(collection(db, "operational_expenses"), orderBy("updatedAtMs", "desc"));
    const snap = await withTimeout(getDocs(q), 10000);
    const list = [];
    snap.forEach((docSnap) => {
      list.push(mapExpenseDoc(docSnap.id, docSnap.data() || {}));
    });
    return list;
  } catch (error) {
    console.error("[OperationalExpensesRepo] Gagal query expenses dengan orderBy, fallback:", error);
    try {
      const snap = await withTimeout(getDocs(collection(db, "operational_expenses")), 10000);
      const list = [];
      snap.forEach((docSnap) => {
        list.push(mapExpenseDoc(docSnap.id, docSnap.data() || {}));
      });
      list.sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));
      return list;
    } catch (fallbackErr) {
      console.error("[OperationalExpensesRepo] Gagal memuat data expenses:", fallbackErr);
      return [];
    }
  }
}

/**
 * Loads user options for requester/PIC autocomplete.
 * @returns {Promise<Array>}
 */
export async function loadRequesterOptions() {
  try {
    const snap = await withTimeout(getDocs(collection(db, "users")), 8000);
    const list = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data() || {};
      const name = firstFilled(d.name, d.nickname, d.username, d.userName, d.email, docSnap.id);
      const nickname = firstFilled(d.nickname, d.username, d.userName);
      const email = firstFilled(d.email);
      const role = firstFilled(d.role, d.position);
      const metaParts = [nickname, email, role].filter(Boolean);
      list.push({
        id: docSnap.id,
        name,
        meta: metaParts.join(" • "),
        search: [name, nickname, email, role].filter(Boolean).join(" ").toLowerCase()
      });
    });
    return list.sort((a, b) => a.name.localeCompare(b.name, "id"));
  } catch (error) {
    console.error("[OperationalExpensesRepo] Gagal memuat users:", error);
    return [];
  }
}

/**
 * Loads mentor options for mentor salary category autocomplete.
 * @returns {Promise<Array>}
 */
export async function loadMentorOptions() {
  try {
    const snap = await withTimeout(getDocs(collection(db, "mentor")), 8000);
    const list = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data() || {};
      const name = firstFilled(d.fullName, d.nama_lengkap, d.name, d.displayName, docSnap.id);
      const bankInfo = extractMentorBankInfo(d);
      const metaParts = [bankInfo.bankName, bankInfo.accountNumber].filter(Boolean);
      const rawWa = extractMentorWhatsapp(d);
      list.push({
        id: docSnap.id,
        name,
        meta: metaParts.length ? metaParts.join(" • ") : "Data rekening mentor belum lengkap",
        bankInfo,
        whatsapp: rawWa,
        whatsappNumber: normalizeWhatsappNumber(rawWa),
        search: [name, bankInfo.bankName, bankInfo.accountNumber].filter(Boolean).join(" ").toLowerCase()
      });
    });
    return list.sort((a, b) => a.name.localeCompare(b.name, "id"));
  } catch (error) {
    console.error("[OperationalExpensesRepo] Gagal memuat mentor:", error);
    return [];
  }
}

/**
 * Loads class availability options for related class autocomplete.
 * @returns {Promise<Array>}
 */
export async function loadClassOptions() {
  try {
    const snap = await withTimeout(getDocs(collection(db, "class_availability")), 8000);
    const list = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data() || {};
      const name = firstFilled(d.name, d.className, d.title, docSnap.id);
      list.push({
        id: docSnap.id,
        name,
        search: name.toLowerCase()
      });
    });
    return list.sort((a, b) => a.name.localeCompare(b.name, "id"));
  } catch (error) {
    console.error("[OperationalExpensesRepo] Gagal memuat classes:", error);
    return [];
  }
}

/**
 * Uploads transfer proof file to Firebase Storage.
 */
export async function uploadTransferProof(expenseId, file) {
  if (!file) return null;
  const safeName = String(file.name || "proof")
    .replace(/[^\w.\-]/g, "_")
    .replace(/_+/g, "_");
  const path = `operational-expenses/${expenseId}/${Date.now()}-${safeName}`;
  const refFile = storageRef(storage, path);
  await uploadBytes(refFile, file);
  const url = await getDownloadURL(refFile);
  return { url, path };
}

/**
 * Uploads reimburse supporting document to Firebase Storage.
 */
export async function uploadReimburseProof(expenseId, file) {
  if (!file) return null;
  const safeName = String(file.name || "reimburse")
    .replace(/[^\w.\-]/g, "_")
    .replace(/_+/g, "_");
  const path = `operational-expenses/${expenseId}/reimburse-${Date.now()}-${safeName}`;
  const refFile = storageRef(storage, path);
  await uploadBytes(refFile, file);
  const url = await getDownloadURL(refFile);
  return { url, path };
}

/**
 * Deletes a file from Firebase Storage.
 */
export async function deleteStorageFile(pathOrUrl) {
  if (!pathOrUrl) return;
  try {
    const fileRef = storageRef(storage, pathOrUrl);
    await deleteObject(fileRef);
  } catch (err) {
    console.warn("[OperationalExpensesRepo] Gagal menghapus file storage:", err);
  }
}

/**
 * Saves or updates an expense document in Firestore.
 */
export async function saveExpenseDoc(expenseId, payload) {
  const docRef = doc(db, "operational_expenses", expenseId);
  await setDoc(docRef, {
    ...payload,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

/**
 * Deletes an expense document from Firestore.
 */
export async function deleteExpenseDoc(expenseId) {
  const docRef = doc(db, "operational_expenses", expenseId);
  await deleteDoc(docRef);
}

/**
 * Sends a Discord webhook notification when a new expense is created.
 */
export async function sendDiscordExpenseNotification(expenseData) {
  try {
    const formattedAmount = typeof expenseData.amount === "number"
      ? `Rp ${new Intl.NumberFormat("id-ID").format(expenseData.amount)}`
      : (expenseData.amount ? `Rp ${expenseData.amount}` : "-");

    const fields = [
      { name: "👤 Pengaju", value: expenseData.requesterName || "-", inline: true },
      { name: "📋 Judul", value: expenseData.title || "-", inline: true },
      { name: "📂 Kategori", value: expenseData.category || "-", inline: true },
      { name: "🏢 Department", value: expenseData.department || "-", inline: true },
      { name: "💰 Nominal", value: formattedAmount, inline: true },
      { name: "👥 Penerima", value: expenseData.beneficiaryName || "-", inline: true },
      { name: "🏦 Bank", value: expenseData.bankName || "-", inline: true },
      { name: "💳 Rekening", value: expenseData.accountNumber || "-", inline: true },
      { name: "💸 Metode Pembayaran", value: expenseData.paymentMethod || "-", inline: true },
      { name: "🎓 Kelas Terkait", value: expenseData.relatedClass || "-", inline: true },
      { name: "📅 Due Date", value: expenseData.dueDate || "-", inline: true },
      { name: "📌 Status", value: expenseData.status || "-", inline: true },
      { name: "📝 Catatan", value: expenseData.notes || "-", inline: false }
    ];

    if (expenseData.transferProofUrl) {
      fields.push({ name: "📎 Bukti Transfer", value: expenseData.transferProofUrl, inline: false });
    }

    const embed = {
      title: "💰 Operational Expense Baru",
      description: "Operasional baru telah ditambahkan ke sistem Dialogika.",
      color: 5195253, // Indigo
      fields,
      footer: { text: "Dialogika Operational Expenses System" },
      timestamp: new Date().toISOString()
    };

    if (expenseData.transferProofUrl) {
      embed.image = { url: expenseData.transferProofUrl };
    }

    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] })
    });
  } catch (error) {
    console.error("[OperationalExpensesRepo] Failed to send Discord notification:", error);
  }
}

/**
 * Sends a Discord webhook notification when an expense is marked as paid.
 */
export async function sendDiscordPaidNotification(expenseData) {
  try {
    const formattedAmount = typeof expenseData.amount === "number"
      ? `Rp ${new Intl.NumberFormat("id-ID").format(expenseData.amount)}`
      : (expenseData.amount ? `Rp ${expenseData.amount}` : "-");

    const fields = [
      { name: "👤 Pengaju", value: expenseData.requesterName || "-", inline: true },
      { name: "📋 Judul", value: expenseData.title || "-", inline: true },
      { name: "📂 Kategori", value: expenseData.category || "-", inline: true },
      { name: "💰 Nominal", value: formattedAmount, inline: true },
      { name: "👥 Penerima", value: expenseData.beneficiaryName || "-", inline: true },
      { name: "📌 Status", value: expenseData.status ? expenseData.status.toUpperCase() : "-", inline: true }
    ];

    if (expenseData.paymentNotes) {
      fields.push({ name: "📝 Catatan Pembayaran", value: expenseData.paymentNotes, inline: false });
    }

    const embed = {
      title: "✅ Expense Dibayarkan",
      description: `Request expense **${expenseData.title}** telah dibayarkan.`,
      color: 3581519, // Emerald Green
      fields,
      footer: { text: "Dialogika Operational Expenses System" },
      timestamp: new Date().toISOString()
    };

    if (expenseData.transferProofUrl) {
      embed.image = { url: expenseData.transferProofUrl };
    }

    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] })
    });
  } catch (error) {
    console.error("[OperationalExpensesRepo] Failed to send Discord paid notification:", error);
  }
}
