// pilot/pages/hr/team-management/team-management.repository.js
// =====================================================================
// REPOSITORY: Team Management
//
// Responsibilities:
// - Firestore access to collection `team_management`
// - Firebase Storage access for PKWT contracts and member documents
// - Data formatting and storage lifecycle (upload, deduplicate, delete)
//
// Rules:
// - NO DOM manipulation or UI rendering
// =====================================================================

import { db, storage } from "../../../assets/js/firebase-config.js";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

export const TEAM_COLLECTION = "team_management";
export const DOCUMENT_STORAGE_ROOT = "team-management";

export const DIVISIONS = [
  "Human Resources",
  "Marketing",
  "Client & Product",
  "Branding",
  "Ghosted",
  "Resigned",
];

export const ACTIVE_DIVISIONS = DIVISIONS.filter(
  (d) => d !== "Ghosted" && d !== "Resigned"
);

export const CONTRACT_TYPES = ["PKWT", "PKWTT", "Freelance"];

export const ALLOWED_DOCUMENT_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".jpg",
  ".jpeg",
  ".png",
];

export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
];

/**
 * Returns a unique string key for a document item.
 * @param {Object} docItem
 * @returns {string}
 */
export function getDocumentKey(docItem) {
  return (
    (docItem && (docItem.fileUrl || docItem.filePath || docItem.fileName)) || ""
  );
}

/**
 * Deduplicate an array of document objects based on their key.
 * @param {Array} docs
 * @returns {Array}
 */
export function deduplicateDocuments(docs) {
  const seen = new Set();
  const result = [];
  const inputArray = Array.isArray(docs) ? docs : [];
  inputArray.forEach((d) => {
    const key = getDocumentKey(d);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(d);
  });
  return result;
}

/**
 * Validate whether a file has allowed extension/type.
 * @param {File} file
 * @returns {boolean}
 */
export function isAllowedDocumentFile(file) {
  if (!file) return false;
  const name = (file.name || "").toLowerCase();
  const hasAllowedExt = ALLOWED_DOCUMENT_EXTENSIONS.some((ext) =>
    name.endsWith(ext)
  );
  const hasAllowedType =
    !file.type || ALLOWED_DOCUMENT_TYPES.includes(file.type);
  return hasAllowedExt && hasAllowedType;
}

/**
 * Subscribe in real-time to the team_management collection.
 * @param {Function} onNext - Callback when documents change
 * @param {Function} onError - Callback on error
 * @returns {Function} unsubscribe function
 */
export function subscribeTeamMembers(onNext, onError) {
  const collRef = collection(db, TEAM_COLLECTION);
  return onSnapshot(
    collRef,
    (snapshot) => {
      const members = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() || {};
        if (Array.isArray(data.documents)) {
          data.documents = deduplicateDocuments(data.documents);
        }
        return {
          id: docSnap.id,
          ...data,
        };
      });
      if (typeof onNext === "function") onNext(members);
    },
    (err) => {
      console.error("Firestore subscribeTeamMembers error:", err);
      if (typeof onError === "function") onError(err);
    }
  );
}

/**
 * Fetch a single team member by ID.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getTeamMember(id) {
  if (!id) return null;
  const docRef = doc(db, TEAM_COLLECTION, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Upload a PKWT contract file to Firebase Storage.
 * @param {string} memberId
 * @param {File} file
 * @param {string} [oldFilePath]
 * @returns {Promise<{ url: string|null, fileName: string|null, filePath: string|null }>}
 */
export async function uploadPkwtFile(memberId, file, oldFilePath = null) {
  if (!file) return { url: null, fileName: null, filePath: null };

  if (oldFilePath) {
    try {
      const oldFileRef = ref(storage, oldFilePath);
      await deleteObject(oldFileRef);
    } catch (err) {
      console.warn("Could not delete old PKWT file from storage:", err);
    }
  }

  const fileName = file.name;
  const safeName = fileName.replace(/[^\w.\-() ]+/g, "_");
  const fileRef = ref(
    storage,
    `${DOCUMENT_STORAGE_ROOT}/${memberId}/pkwt/${Date.now()}_${safeName}`
  );
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);

  return { url, fileName, filePath: fileRef.fullPath };
}

/**
 * Upload multiple team documents to Firebase Storage.
 * @param {string} memberId
 * @param {Array<File>} files
 * @returns {Promise<Array<Object>>}
 */
export async function uploadTeamDocuments(memberId, files) {
  const uploads = Array.isArray(files) ? files : Array.from(files || []);
  const uploadedDocuments = [];

  for (let i = 0; i < uploads.length; i++) {
    const file = uploads[i];
    const fileName = file.name;
    const timestamp = `${Date.now()}_${i}`;
    const safeName = fileName.replace(/[^\w.\-() ]+/g, "_");
    const fileRef = ref(
      storage,
      `${DOCUMENT_STORAGE_ROOT}/${memberId}/documents/${timestamp}_${safeName}`
    );
    await uploadBytes(fileRef, file);
    const fileUrl = await getDownloadURL(fileRef);
    uploadedDocuments.push({
      fileName,
      fileUrl,
      filePath: fileRef.fullPath,
      uploadedAt: new Date().toISOString(),
    });
  }

  return uploadedDocuments;
}

/**
 * Delete removed documents from Storage.
 * @param {Array<Object>} documents
 * @param {Set<string>} removedKeys
 */
export async function deleteRemovedDocuments(documents, removedKeys) {
  const docs = Array.isArray(documents) ? documents : [];
  for (let i = 0; i < docs.length; i++) {
    const d = docs[i];
    const key = getDocumentKey(d);
    const path = d.filePath || "";
    if (path && removedKeys && removedKeys.has(key)) {
      try {
        await deleteObject(ref(storage, path));
      } catch (err) {
        console.warn("Could not delete document from storage:", err);
      }
    }
  }
}

/**
 * Delete a file directly by storage path.
 * @param {string} filePath
 */
export async function deleteStorageFile(filePath) {
  if (!filePath) return;
  try {
    await deleteObject(ref(storage, filePath));
  } catch (err) {
    console.warn("deleteStorageFile error:", err);
  }
}

/**
 * Create a new team member document in Firestore.
 * @param {Object} data
 * @returns {Promise<Object>} Reference to new doc
 */
export async function createTeamMember(data) {
  const collRef = collection(db, TEAM_COLLECTION);
  const payload = {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  return await addDoc(collRef, payload);
}

/**
 * Update an existing team member document.
 * @param {string} id
 * @param {Object} data
 * @returns {Promise<void>}
 */
export async function updateTeamMember(id, data) {
  const docRef = doc(db, TEAM_COLLECTION, id);
  const payload = {
    ...data,
    updatedAt: serverTimestamp(),
  };
  return await updateDoc(docRef, payload);
}

/**
 * Delete a team member document and optionally clean up their files.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteTeamMember(id) {
  const docRef = doc(db, TEAM_COLLECTION, id);
  return await deleteDoc(docRef);
}
