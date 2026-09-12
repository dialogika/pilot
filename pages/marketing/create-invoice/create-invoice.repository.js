/**
 * create-invoice.repository.js
 * Data Access Layer (Zero DOM) for Create Invoice / Invoice Center.
 * Handles Firestore collections: 'invoices', 'class_availability', 'products', 'settings'.
 */

import { db } from "/assets/js/firebase-config.js";
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const STORAGE_KEY_SETTINGS = "dlg_invoice_settings";
const STORAGE_KEY_BANKS = "dlg_invoice_banks";
const STORAGE_KEY_REFERRALS = "dlg_invoice_referrals";

export const DEFAULT_BANKS = [
  { id: "BCA", name: "BCA", number: "8920129301", holder: "PT Dialogika Indonesia" },
  { id: "BCA_SYR", name: "BCA Syariah", number: "8920129301", holder: "PT Dialogika Indonesia" },
  { id: "BSI", name: "BSI", number: "8920129301", holder: "PT Dialogika Indonesia" },
];

/**
 * Generate standard invoice number: INV-YYMMDD-XXXX
 */
export function generateInvoiceNumber() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `INV-${yy}${mm}${dd}-${random}`;
}

/**
 * Load settings from localStorage
 */
export function loadSettingsLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!raw) {
      return {
        leadName: "Andi Pratama",
        className: "Public Speaking Playbook",
        batchLabel: "Batch 42",
        classType: "Offline",
        location: "Jakarta",
        seatsLeft: 4,
        deadlineMinutes: 60,
        basePrice: 2500000,
        dpPercent: 35,
        dpAmount: 875000,
        classMeta: "Batch 42 • Offline • Jakarta",
      };
    }
    const parsed = JSON.parse(raw);
    const merged = Object.assign(
      {
        leadName: "",
        className: "",
        batchLabel: "",
        classType: "",
        location: "",
        seatsLeft: 0,
        deadlineMinutes: 60,
        basePrice: 0,
        dpPercent: 35,
        dpAmount: 0,
        classMeta: "",
      },
      parsed
    );
    if (!merged.batchLabel && merged.classMeta) {
      const parts = merged.classMeta
        .split("•")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      merged.batchLabel = parts[0] || "";
      merged.classType = parts[1] || "";
      merged.location = parts[2] || "";
    }
    if ((!merged.dpAmount || merged.dpAmount <= 0) && merged.basePrice && merged.dpPercent) {
      merged.dpAmount = Math.round((merged.basePrice * merged.dpPercent) / 100);
    }
    return merged;
  } catch (e) {
    return {
      leadName: "",
      className: "",
      batchLabel: "",
      classType: "",
      location: "",
      seatsLeft: 0,
      deadlineMinutes: 60,
      basePrice: 0,
      dpPercent: 35,
      dpAmount: 0,
      classMeta: "",
    };
  }
}

/**
 * Save settings to localStorage
 */
export function saveSettingsLocal(settings) {
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.warn("Failed to save local invoice settings:", e);
  }
}

/**
 * Fetch all invoices from Firestore
 */
export async function fetchInvoices() {
  try {
    let snap;
    try {
      const q = query(collection(db, "invoices"), orderBy("createdAtMs", "desc"));
      snap = await getDocs(q);
    } catch {
      snap = await getDocs(collection(db, "invoices"));
    }

    const list = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data() || {};
      list.push({
        id: docSnap.id,
        leadName: d.leadName || "",
        className: d.className || "",
        batchLabel: d.batchLabel || "",
        classType: d.classType || "",
        location: d.location || "",
        leadPhone: d.leadPhone || d.phone || d.phoneNumber || d.leadPhoneNumber || "",
        seatsLeft: typeof d.seatsLeft === "number" ? d.seatsLeft : 0,
        deadlineMinutes: typeof d.deadlineMinutes === "number" ? d.deadlineMinutes : 0,
        startedAtMs: typeof d.startedAtMs === "number" ? d.startedAtMs : 0,
        basePrice: typeof d.basePrice === "number" ? d.basePrice : 0,
        dpPercent: typeof d.dpPercent === "number" ? d.dpPercent : 0,
        dpAmount: typeof d.dpAmount === "number" ? d.dpAmount : 0,
        invoiceNumber: d.invoiceNumber || "",
        referralCode: d.referralCode || "",
        referralUsedAtMs: typeof d.referralUsedAtMs === "number" ? d.referralUsedAtMs : 0,
        createdAtMs: typeof d.createdAtMs === "number" ? d.createdAtMs : 0,
        paidAmount: typeof d.paidAmount === "number" ? d.paidAmount : 0,
        paidAtMs: typeof d.paidAtMs === "number" ? d.paidAtMs : 0,
        paymentMethod: d.paymentMethod || "",
        bankName: d.bankName || "",
        paymentType: d.paymentType || "",
        finalBasePrice: typeof d.finalBasePrice === "number" ? d.finalBasePrice : 0,
        transferProofUrl: d.transferProofUrl || "",
        verificationStatus: d.verificationStatus || "legit",
      });
    });
    return list;
  } catch (err) {
    console.error("fetchInvoices error:", err);
    return [];
  }
}

/**
 * Save or update invoice in Firestore
 */
export async function saveInvoice(invoiceData, existingId = "") {
  try {
    if (existingId) {
      const updatePayload = {
        ...invoiceData,
        updatedAtMs: Date.now(),
      };
      await updateDoc(doc(db, "invoices", existingId), updatePayload);
      return existingId;
    } else {
      const createPayload = {
        ...invoiceData,
        createdAtMs: Date.now(),
        invoiceNumber: invoiceData.invoiceNumber || generateInvoiceNumber(),
      };
      const ref = await addDoc(collection(db, "invoices"), createPayload);
      return ref.id;
    }
  } catch (err) {
    console.error("saveInvoice error:", err);
    throw err;
  }
}

/**
 * Delete invoice from Firestore
 */
export async function deleteInvoice(invoiceId) {
  try {
    await deleteDoc(doc(db, "invoices", invoiceId));
    return true;
  } catch (err) {
    console.error("deleteInvoice error:", err);
    throw err;
  }
}

/**
 * Update verification status of an invoice
 */
export async function updateInvoiceVerification(invoiceId, status) {
  try {
    const ref = doc(db, "invoices", invoiceId);
    await setDoc(ref, { verificationStatus: status }, { merge: true });
    return true;
  } catch (err) {
    console.error("updateInvoiceVerification error:", err);
    throw err;
  }
}

/**
 * Fetch available classes from 'class_availability' collection
 */
export async function fetchClassAvailability() {
  try {
    const snap = await getDocs(collection(db, "class_availability"));
    const classes = [];
    let totalJoined = 0;
    let totalMax = 0;

    snap.forEach((docSnap) => {
      const d = docSnap.data() || {};
      const maxSeat = Number(d.max_seat || 0);
      const currentJoined = Number(d.current_joined || 0);
      const seatsLeft = maxSeat - currentJoined;
      const startRaw = d.start_date || "";

      totalJoined += Math.max(currentJoined, 0);
      totalMax += Math.max(maxSeat, 0);

      let isClosed = false;
      if (startRaw && startRaw !== "Flexible") {
        try {
          const dateObj = new Date(startRaw);
          if (!isNaN(dateObj.getTime())) {
            const now = new Date();
            if (dateObj.getTime() < now.getTime()) {
              isClosed = true;
            }
          }
        } catch {
          // ignore date parse error
        }
      }

      if (seatsLeft > 0 && !isClosed) {
        classes.push({
          id: docSnap.id,
          name: d.name || "Unnamed Class",
          seatsLeft: seatsLeft,
        });
      }
    });

    return {
      classes,
      totalJoined,
      totalMax,
    };
  } catch (err) {
    console.warn("fetchClassAvailability error:", err);
    return {
      classes: [],
      totalJoined: 0,
      totalMax: 0,
    };
  }
}

/**
 * Fetch products list from 'products' collection
 */
export async function fetchProducts() {
  try {
    const snap = await getDocs(collection(db, "products"));
    const list = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data() || {};
      const name = String(d.name || "").trim();
      if (!name) return;
      const id = d.productId || docSnap.id;
      list.push({ id, name });
    });
    return list;
  } catch (err) {
    console.warn("fetchProducts error:", err);
    return [];
  }
}

/**
 * Fetch detailed product info (materials, features, specifications)
 */
export async function fetchProductDetail(productId) {
  if (!productId) return null;
  try {
    const ref = doc(db, "products", productId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const pd = snap.data() || {};
    return {
      materials: Array.isArray(pd.materials) ? pd.materials : [],
      features: Array.isArray(pd.features) ? pd.features : [],
      specifications: Array.isArray(pd.specifications) ? pd.specifications : [],
    };
  } catch (err) {
    console.warn("fetchProductDetail error:", err);
    return null;
  }
}

/**
 * Fetch banks from Firestore 'settings/banks' with localStorage fallback
 */
export async function fetchBanks() {
  try {
    const ref = doc(db, "settings", "banks");
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const d = snap.data() || {};
      if (Array.isArray(d.banks) && d.banks.length) {
        localStorage.setItem(STORAGE_KEY_BANKS, JSON.stringify(d.banks));
        return d.banks;
      }
    }
  } catch (err) {
    console.warn("fetchBanks from Firestore error:", err);
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BANKS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    // ignore
  }

  return DEFAULT_BANKS;
}

/**
 * Save banks to Firestore and localStorage
 */
export async function saveBanks(banks) {
  try {
    localStorage.setItem(STORAGE_KEY_BANKS, JSON.stringify(banks));
    const ref = doc(db, "settings", "banks");
    await setDoc(ref, { banks }, { merge: true });
    return true;
  } catch (err) {
    console.error("saveBanks error:", err);
    return false;
  }
}

/**
 * Fetch referrals from Firestore 'settings/referrals' with localStorage fallback
 */
export async function fetchReferrals() {
  try {
    const ref = doc(db, "settings", "referrals");
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const d = snap.data() || {};
      if (Array.isArray(d.referrals)) {
        localStorage.setItem(STORAGE_KEY_REFERRALS, JSON.stringify(d.referrals));
        return d.referrals;
      }
    }
  } catch (err) {
    console.warn("fetchReferrals from Firestore error:", err);
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REFERRALS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }

  return [];
}

/**
 * Save referrals to Firestore and localStorage
 */
export async function saveReferrals(referrals) {
  try {
    localStorage.setItem(STORAGE_KEY_REFERRALS, JSON.stringify(referrals));
    const ref = doc(db, "settings", "referrals");
    await setDoc(ref, { referrals }, { merge: true });
    return true;
  } catch (err) {
    console.error("saveReferrals error:", err);
    return false;
  }
}
