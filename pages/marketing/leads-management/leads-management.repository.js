/**
 * Leads Management - Repository (Data Access Layer)
 * 
 * Pure Data Access Layer.
 * Interacts only with Cloud Firestore and memory caches.
 * ZERO DOM manipulation.
 */

import { db } from "../../../assets/js/firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Fetch all Ads Channels from Firestore collection `leads_settings_ads_channels`
 */
export async function fetchAdsChannels() {
  try {
    const snap = await getDocs(collection(db, "leads_settings_ads_channels"));
    const result = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data() || {};
      result.push({
        id: docSnap.id,
        name: d.name || ""
      });
    });
    return result;
  } catch (error) {
    console.error("Repository: Error fetching ads channels:", error);
    throw error;
  }
}

/**
 * Save or update an Ads Channel
 */
export async function saveAdsChannelDoc(editId, name) {
  try {
    if (editId) {
      await setDoc(
        doc(db, "leads_settings_ads_channels", editId),
        { name },
        { merge: true }
      );
      return editId;
    } else {
      const ref = doc(collection(db, "leads_settings_ads_channels"));
      await setDoc(ref, { name });
      return ref.id;
    }
  } catch (error) {
    console.error("Repository: Error saving ads channel:", error);
    throw error;
  }
}

/**
 * Delete an Ads Channel by ID
 */
export async function deleteAdsChannelDoc(id) {
  try {
    await deleteDoc(doc(db, "leads_settings_ads_channels", id));
  } catch (error) {
    console.error("Repository: Error deleting ads channel:", error);
    throw error;
  }
}

/**
 * Fetch all Interests from Firestore collection `leads_settings_interests`
 */
export async function fetchInterests() {
  try {
    const snap = await getDocs(collection(db, "leads_settings_interests"));
    const result = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data() || {};
      result.push({
        id: docSnap.id,
        name: d.name || "",
        ads_channel_id: d.ads_channel_id || ""
      });
    });
    return result;
  } catch (error) {
    console.error("Repository: Error fetching interests:", error);
    throw error;
  }
}

/**
 * Save or update an Interest
 */
export async function saveInterestDoc(editId, name, adsChannelId = "") {
  try {
    if (editId) {
      await setDoc(
        doc(db, "leads_settings_interests", editId),
        {
          name,
          ads_channel_id: adsChannelId
        },
        { merge: true }
      );
      return editId;
    } else {
      const ref = doc(collection(db, "leads_settings_interests"));
      await setDoc(ref, {
        name,
        ads_channel_id: adsChannelId
      });
      return ref.id;
    }
  } catch (error) {
    console.error("Repository: Error saving interest:", error);
    throw error;
  }
}

/**
 * Delete an Interest by ID
 */
export async function deleteInterestDoc(id) {
  try {
    await deleteDoc(doc(db, "leads_settings_interests", id));
  } catch (error) {
    console.error("Repository: Error deleting interest:", error);
    throw error;
  }
}

/**
 * Fetch users map for PIC resolution from Firestore collection `users`
 */
export async function fetchUsersMap() {
  try {
    const snap = await getDocs(collection(db, "users"));
    const map = {};
    snap.forEach((docSnap) => {
      const d = docSnap.data() || {};
      const id = docSnap.id;
      const name = d.name || d.displayName || d.email || id;
      map[id] = name;
    });
    return map;
  } catch (error) {
    console.error("Repository: Error fetching users map:", error);
    return {};
  }
}

/**
 * Helper to parse lead created date
 */
function parseDateInputValue(value) {
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

function getLeadCreatedDateFromData(data) {
  if (data.created_at && typeof data.created_at.toDate === "function") {
    return data.created_at.toDate();
  }
  const display = String(data.created_display || "").trim();
  if (display) {
    const parts = display.split(" ");
    if (parts[0]) {
      const parsed = parseDateInputValue(parts[0]);
      if (parsed) return parsed;
    }
  }
  const due = String(data.due_date || "").trim();
  if (due) {
    const parsedDue = parseDateInputValue(due);
    if (parsedDue) return parsedDue;
  }
  return null;
}

/**
 * Fetch all leads from Firestore collection `leads`
 */
export async function fetchLeads() {
  try {
    const snap = await getDocs(collection(db, "leads"));
    const leads = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data() || {};
      const createdDate = getLeadCreatedDateFromData(d);
      leads.push({
        id: docSnap.id,
        name: d.name || "",
        city: d.peserta_city || d.city || "",
        interest_program: d.interest_program || "",
        ads_channel: d.ads_channel || "",
        whatsapp: d.whatsapp || "",
        stage: d.stage || "LEADS",
        referral_code: d.referral_code || "",
        createdDate: createdDate,
        assigned_ids: Array.isArray(d.assigned_ids) ? d.assigned_ids : [],
        certificate_name:
          d.peserta_name || d.certificate_name || d.nama_sertifikat || "",
        email: d.peserta_email || d.email || "",
        instagram: d.peserta_ig || d.instagram || d.ig || "",
        job: d.peserta_job || d.job || d.pekerjaan || "",
        age: d.peserta_age || d.age || d.usia || "",
        gender: d.peserta_gender || d.gender || d.jenis_kelamin || "",
        marital_status:
          d.peserta_marital_status ||
          d.marital_status ||
          d.status_menikah ||
          "",
        additional_info:
          d.notes_info ||
          d.additional_info ||
          d.informasi_tambahan ||
          d.catatan ||
          ""
      });
    });
    return leads;
  } catch (error) {
    console.error("Repository: Error fetching leads:", error);
    return [];
  }
}

/**
 * Save / update lead data
 */
export async function saveLeadDoc(leadId, data) {
  try {
    await setDoc(doc(db, "leads", leadId), data, { merge: true });
  } catch (error) {
    console.error("Repository: Error saving lead doc:", error);
    throw error;
  }
}

/**
 * Delete lead doc by ID
 */
export async function deleteLeadDoc(leadId) {
  try {
    await deleteDoc(doc(db, "leads", leadId));
  } catch (error) {
    console.error("Repository: Error deleting lead doc:", error);
    throw error;
  }
}

/**
 * Add manual lead to pipeline
 */
export async function addManualLeadDoc(leadData) {
  try {
    const leadsRef = collection(db, "leads");
    const docData = {
      name: leadData.name,
      interest_program: leadData.interest_program,
      due_date: leadData.due_date,
      stage: leadData.stage,
      nominal: leadData.nominal || 0,
      created_at: serverTimestamp(),
      source: "manual_add_next_payment"
    };
    const res = await addDoc(leadsRef, docData);
    return res.id;
  } catch (error) {
    console.error("Repository: Error adding manual lead doc:", error);
    throw error;
  }
}

/**
 * Fetch product catalog from Firestore collection `products`
 */
export async function fetchProductsCatalog() {
  try {
    const snap = await getDocs(collection(db, "products"));
    const cat = {};
    snap.forEach((docSnap) => {
      const d = docSnap.data() || {};
      if (d.name) {
        let key = String(d.name).trim().toLowerCase();
        key = key.replace(/\s+(online|offline|kids|class)$/i, "").trim();
        const originalKey = String(d.name).trim().toLowerCase();

        const entry = {
          id: docSnap.id,
          name: d.name,
          base_price: typeof d.basePrice === "number" ? d.basePrice : 0
        };

        cat[key] = entry;
        cat[originalKey] = entry;
      }
    });
    return cat;
  } catch (error) {
    console.error("Repository: Error fetching product catalog:", error);
    return {};
  }
}

/**
 * Fetch all invoices from Firestore collection `invoices`
 */
export async function fetchInvoices() {
  try {
    const snap = await getDocs(collection(db, "invoices"));
    const invoices = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data() || {};
      invoices.push({
        id: docSnap.id,
        invoiceNumber: d.invoiceNumber || docSnap.id,
        leadName: d.leadName || "",
        productName: d.productName || d.className || "",
        paidAmount: typeof d.paidAmount === "number" ? d.paidAmount : 0,
        finalBasePrice:
          typeof d.finalBasePrice === "number"
            ? d.finalBasePrice
            : typeof d.basePrice === "number"
              ? d.basePrice
              : 0,
        createdAtMs:
          typeof d.createdAtMs === "number" ? d.createdAtMs : 0,
        paidAtMs: typeof d.paidAtMs === "number" ? d.paidAtMs : 0,
        paymentType: d.paymentType || "",
        paymentMethod: d.paymentMethod || "",
        bankName: d.bankName || "",
        transferProofUrl: d.transferProofUrl || "",
        verificationStatus: d.verificationStatus || "",
        enrollmentWhatsapp: d.enrollmentWhatsapp || "",
        className: d.className || "",
        batchLabel: d.batchLabel || "",
        batchSchedule: d.batchSchedule || "",
        classSchedule: d.classSchedule || "",
        schedule: d.schedule || "",
        sessionSchedule: d.sessionSchedule || "",
        classMeta: d.classMeta || "",
        basePrice: typeof d.basePrice === "number" ? d.basePrice : 0,
        referralCode: d.referralCode || d.referral_code || ""
      });
    });
    return invoices;
  } catch (error) {
    console.error("Repository: Error fetching invoices:", error);
    return [];
  }
}

/**
 * Fetch single invoice by ID
 */
export async function fetchInvoiceById(invoiceId) {
  try {
    const ref = doc(db, "invoices", invoiceId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return Object.assign({ id: invoiceId }, snap.data());
    }
    return null;
  } catch (error) {
    console.error("Repository: Error fetching invoice by ID:", error);
    throw error;
  }
}

/**
 * Save / update invoice data
 */
export async function saveInvoiceDoc(invoiceId, data) {
  try {
    await setDoc(doc(db, "invoices", invoiceId), data, { merge: true });
  } catch (error) {
    console.error("Repository: Error saving invoice doc:", error);
    throw error;
  }
}

/**
 * Delete batch of invoice IDs
 */
export async function deleteInvoicesBatch(invoiceIds) {
  try {
    const ids = Array.isArray(invoiceIds) ? invoiceIds : [invoiceIds];
    await Promise.all(ids.map((id) => deleteDoc(doc(db, "invoices", id))));
  } catch (error) {
    console.error("Repository: Error deleting invoices batch:", error);
    throw error;
  }
}
