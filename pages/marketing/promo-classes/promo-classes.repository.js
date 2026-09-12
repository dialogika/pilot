// pages/marketing/promo-classes/promo-classes.repository.js
// =====================================================================
// DATA LAYER: Promo Classes & Promo Batches
// Handles direct Firestore interactions for promo_classes & promo_batches.
// =====================================================================

import { db } from "../../../assets/js/firebase-config.js";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const PROMO_CLASSES_COLLECTION = "promo_classes";
const PROMO_BATCHES_COLLECTION = "promo_batches";

/**
 * Subscribe to real-time updates for promo batches.
 * @param {(batches: Array<Object>) => void} onUpdate
 * @param {(error: Error) => void} onError
 * @returns {() => void} Unsubscribe function
 */
export function subscribePromoBatches(onUpdate, onError) {
  return onSnapshot(
    collection(db, PROMO_BATCHES_COLLECTION),
    (snapshot) => {
      const rows = [];
      snapshot.forEach((docSnap) => {
        rows.push({ id: docSnap.id, ...docSnap.data() });
      });
      onUpdate(rows);
    },
    (error) => {
      console.error("[PromoRepo] Failed to load promo batches:", error);
      if (onError) onError(error);
    }
  );
}

/**
 * Subscribe to real-time updates for promo classes.
 * @param {(classes: Array<Object>) => void} onUpdate
 * @param {(error: Error) => void} onError
 * @returns {() => void} Unsubscribe function
 */
export function subscribePromoClasses(onUpdate, onError) {
  return onSnapshot(
    collection(db, PROMO_CLASSES_COLLECTION),
    (snapshot) => {
      const rows = [];
      snapshot.forEach((docSnap) => {
        rows.push({ id: docSnap.id, ...docSnap.data() });
      });
      onUpdate(rows);
    },
    (error) => {
      console.error("[PromoRepo] Failed to load promo classes:", error);
      if (onError) onError(error);
    }
  );
}

/**
 * Create a new promo class record.
 * @param {Object} data
 * @param {string} actor
 * @returns {Promise<string>} Created doc ID
 */
export async function createPromoClass(data, actor = "") {
  const nowMs = Date.now();
  const payload = {
    product: data.product || "",
    location: data.location || "Online",
    locationName: data.locationName || "",
    mapsLink: data.mapsLink || "",
    normalPrice: data.normalPrice || "",
    promoPrice: data.promoPrice || "",
    promoDuration: data.promoDuration || "",
    created_at: serverTimestamp(),
    created_at_ms: nowMs,
    created_by: actor,
    updated_at: serverTimestamp(),
    updated_at_ms: nowMs,
    updated_by: actor,
  };

  const docRef = await addDoc(collection(db, PROMO_CLASSES_COLLECTION), payload);
  return docRef.id;
}

/**
 * Update an existing promo class record.
 * @param {string} id
 * @param {Object} data
 * @param {string} actor
 * @returns {Promise<void>}
 */
export async function updatePromoClass(id, data, actor = "") {
  if (!id) throw new Error("ID promo class required");
  const nowMs = Date.now();
  const payload = {
    product: data.product || "",
    location: data.location || "Online",
    locationName: data.locationName || "",
    mapsLink: data.mapsLink || "",
    normalPrice: data.normalPrice || "",
    promoPrice: data.promoPrice || "",
    promoDuration: data.promoDuration || "",
    updated_at: serverTimestamp(),
    updated_at_ms: nowMs,
    updated_by: actor,
  };

  await updateDoc(doc(db, PROMO_CLASSES_COLLECTION, id), payload);
}

/**
 * Delete a single promo class record.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deletePromoClass(id) {
  if (!id) throw new Error("ID promo class required");
  await deleteDoc(doc(db, PROMO_CLASSES_COLLECTION, id));
}

/**
 * Bulk delete promo class records by ID.
 * @param {Array<string>} ids
 * @returns {Promise<number>} Count of deleted records
 */
export async function bulkDeletePromoClasses(ids = []) {
  if (!ids.length) return 0;
  const batch = writeBatch(db);
  ids.forEach((id) => {
    batch.delete(doc(db, PROMO_CLASSES_COLLECTION, id));
  });
  await batch.commit();
  return ids.length;
}

/**
 * Create a new promo batch document.
 * @param {Object} batchData
 * @param {string} actor
 * @returns {Promise<string>} Created batch doc ID
 */
export async function createPromoBatch(batchData, actor = "") {
  const nowMs = Date.now();
  const payload = {
    label: batchData.label || "",
    startDate: batchData.startDate || "",
    endDate: batchData.endDate || "",
    created_at: serverTimestamp(),
    created_at_ms: nowMs,
    created_by: actor,
  };

  const docRef = await addDoc(collection(db, PROMO_BATCHES_COLLECTION), payload);
  return docRef.id;
}

/**
 * Delete a promo batch document by ID.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deletePromoBatch(id) {
  if (!id) throw new Error("ID batch required");
  await deleteDoc(doc(db, PROMO_BATCHES_COLLECTION, id));
}
