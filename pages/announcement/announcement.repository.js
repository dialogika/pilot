// pages/announcement/announcement.repository.js
// =====================================================================
// ANNOUNCEMENT DATA ACCESS — the ONLY Announcement module that talks to Firebase.
//
// RULES:
//  - Every Firestore/Auth read & write for Announcement lives here.
//  - NO DOM manipulation, NO rendering, NO toast/modal here.
//  - Uses the single Firebase init from assets/js/firebase-config.js.
//  - Returns plain data / promises; the orchestrator decides what to render.
// =====================================================================

import { auth, db } from "/assets/js/firebase-config.js";
import {
  collection,
  query,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Subscribe in realtime to all announcements.
 * @param {(items: Array<Object>) => void} onData
 * @param {(error: Error) => void} onError
 * @returns {() => void} unsubscribe function
 */
export function subscribeAnnouncements(onData, onError) {
  const colRef = collection(db, "announcements");
  const q = query(colRef);
  return onSnapshot(
    q,
    (snapshot) => {
      const items = [];
      snapshot.forEach((docSnap) => {
        items.push({
          id: docSnap.id,
          ...docSnap.data(),
        });
      });
      onData(items);
    },
    (error) => {
      console.error("Firestore onSnapshot error (announcements):", error);
      if (typeof onError === "function") onError(error);
    }
  );
}

/**
 * Fetch list of departments from Firestore.
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
export async function fetchDepartments() {
  const list = [];
  try {
    const snap = await getDocs(collection(db, "departments"));
    snap.forEach((docSnap) => {
      const d = docSnap.data() || {};
      list.push({
        id: docSnap.id,
        name: d.name || d.title || "Untitled",
      });
    });
  } catch (e) {
    console.error("Failed to load departments:", e);
  }
  return list;
}

/**
 * Save an announcement (Create or Update).
 * @param {string|null} id
 * @param {Object} data
 * @param {Object} currentUser
 * @returns {Promise<string>} doc ID
 */
export async function saveAnnouncementDoc(id, data, currentUser) {
  const payload = {
    title: data.title || "",
    content: data.content || "",
    type: data.type || "info",
    target_department: data.target_department || "",
    target_department_name: data.target_department_name || "",
    pinned: !!data.pinned,
    active: data.active !== undefined ? !!data.active : true,
    updated_at: serverTimestamp(),
  };

  if (id) {
    await updateDoc(doc(db, "announcements", id), payload);
    return id;
  } else {
    payload.created_at = serverTimestamp();
    payload.created_by = currentUser ? currentUser.uid : "";
    payload.created_by_name =
      (currentUser && (currentUser.name || currentUser.displayName || currentUser.email)) || "";
    const docRef = await addDoc(collection(db, "announcements"), payload);
    return docRef.id;
  }
}

/**
 * Delete an announcement doc and archive to trash collection.
 * @param {string} id
 * @param {Object} announcementData
 * @param {Object} currentUser
 * @returns {Promise<void>}
 */
export async function deleteAnnouncementDoc(id, announcementData, currentUser) {
  if (!id) return;
  // 1. Archive to trash
  try {
    await addDoc(collection(db, "trash"), {
      type: "announcement",
      entity_id: id,
      data: announcementData || {},
      deleted_at: serverTimestamp(),
      deleted_by: currentUser ? currentUser.uid : "",
    });
  } catch (e) {
    console.warn("Failed to archive deleted announcement to trash:", e);
  }

  // 2. Delete the actual announcement doc
  await deleteDoc(doc(db, "announcements", id));
}

export { auth, db };
