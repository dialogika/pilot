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
