// pages/marketing/webinar/webinar.repository.js
// =====================================================================
// REPOSITORY LAYER: Webinar Management & Member Webinar
// Handles real-time Firestore listeners, Storage uploads, and mutations.
// =====================================================================

import { db, storage } from "../../../assets/js/firebase-config.js";
import {
    collection,
    query,
    orderBy,
    limit,
    startAfter,
    onSnapshot,
    getDocs,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    writeBatch,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
    ref,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const WEBINARS_COLLECTION = "webinars";
const MEMBER_WEBINAR_COLLECTION = "member_webinar";

/**
 * Listens to webinars collection in real-time ordered by `order` ascending.
 * @param {(webinars: Array<Object>) => void} onData
 * @param {(error: Error) => void} onError
 * @returns {() => void} Unsubscribe function
 */
export function listenToWebinars(onData, onError) {
    const q = query(collection(db, WEBINARS_COLLECTION), orderBy("order", "asc"));
    return onSnapshot(
        q,
        (snapshot) => {
            const webinars = [];
            snapshot.forEach((docSnap) => {
                webinars.push({
                    id: docSnap.id,
                    ...docSnap.data()
                });
            });
            if (typeof onData === "function") {
                onData(webinars);
            }
        },
        (error) => {
            console.error("[WebinarRepository] Failed to listen to webinars:", error);
            if (typeof onError === "function") {
                onError(error);
            }
        }
    );
}

/**
 * Uploads a poster image to Firebase Storage.
 * @param {File} file
 * @param {string} webinarName
 * @returns {Promise<string>} Download URL of the uploaded poster
 */
export async function uploadPoster(file, webinarName) {
    if (!file) return "";
    const timestamp = Date.now();
    const cleanName = (webinarName || "webinar").replace(/[^a-zA-Z0-9_-]/g, "_");
    const ext = file.name.split(".").pop() || "jpg";
    const storageRef = ref(storage, `webinars/${timestamp}_${cleanName}.${ext}`);
    const uploadResult = await uploadBytes(storageRef, file);
    return await getDownloadURL(uploadResult.ref);
}

/**
 * Creates or updates a webinar. If `isActive` is true, deactivates other active webinars via batch write.
 * @param {Object} params
 * @param {string} [params.id]
 * @param {string} params.name
 * @param {string} params.metaTitle
 * @param {string} params.metaDescription
 * @param {string} [params.whatsappLink]
 * @param {boolean} params.isActive
 * @param {File|null} [params.posterFile]
 * @param {string} [params.existingPosterUrl]
 * @param {Array<Object>} [params.currentWebinars]
 * @returns {Promise<{ id: string, name: string }>}
 */
export async function saveWebinar({
    id,
    name,
    metaTitle,
    metaDescription,
    whatsappLink = "",
    isActive = false,
    posterFile = null,
    existingPosterUrl = "",
    currentWebinars = []
}) {
    let posterUrl = existingPosterUrl || "";
    if (posterFile) {
        posterUrl = await uploadPoster(posterFile, name);
    }

    // Enforce single active webinar rule
    if (isActive) {
        const othersActive = currentWebinars.filter((w) => w.is_active === true && w.id !== id);
        if (othersActive.length > 0) {
            const batch = writeBatch(db);
            othersActive.forEach((w) => {
                const wRef = doc(db, WEBINARS_COLLECTION, w.id);
                batch.update(wRef, {
                    is_active: false,
                    updated_at: serverTimestamp()
                });
            });
            await batch.commit();
        }
    }

    const payload = {
        name: name.trim(),
        meta_title: metaTitle.trim(),
        meta_description: metaDescription,
        poster_url: posterUrl,
        whatsapp_link: (whatsappLink || "").trim(),
        is_active: Boolean(isActive),
        updated_at: serverTimestamp()
    };

    if (id) {
        const docRef = doc(db, WEBINARS_COLLECTION, id);
        await updateDoc(docRef, payload);
        return { id, name };
    } else {
        const maxOrder = currentWebinars.reduce((max, w) => Math.max(max, Number(w.order) || 0), 0);
        payload.order = maxOrder + 1;
        payload.created_at = serverTimestamp();

        const docRef = await addDoc(collection(db, WEBINARS_COLLECTION), payload);
        return { id: docRef.id, name };
    }
}

/**
 * Toggles a webinar's active state. If activating, deactivates other active webinars.
 * @param {string} id
 * @param {boolean} activate
 * @param {Array<string>} otherActiveIds
 * @returns {Promise<void>}
 */
export async function toggleWebinarActive(id, activate, otherActiveIds = []) {
    if (activate && otherActiveIds.length > 0) {
        const batch = writeBatch(db);
        otherActiveIds.forEach((otherId) => {
            const docRef = doc(db, WEBINARS_COLLECTION, otherId);
            batch.update(docRef, {
                is_active: false,
                updated_at: serverTimestamp()
            });
        });
        await batch.commit();
    }

    const targetDocRef = doc(db, WEBINARS_COLLECTION, id);
    await updateDoc(targetDocRef, {
        is_active: Boolean(activate),
        updated_at: serverTimestamp()
    });
}

/**
 * Deletes a webinar document by ID.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteWebinar(id) {
    if (!id) return;
    const docRef = doc(db, WEBINARS_COLLECTION, id);
    await deleteDoc(docRef);
}

/**
 * Fetches a paginated page of member_webinar records.
 * @param {Object} params
 * @param {import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js").DocumentSnapshot|null} [params.lastVisible]
 * @param {number} [params.pageSize]
 * @returns {Promise<{ docs: Array<Object>, lastVisible: Object|null, hasMore: boolean }>}
 */
export async function fetchMemberWebinarsPage({ lastVisible = null, pageSize = 25 } = {}) {
    let q = query(
        collection(db, MEMBER_WEBINAR_COLLECTION),
        orderBy("createdAt", "desc"),
        orderBy("__name__", "desc"),
        limit(pageSize)
    );

    if (lastVisible) {
        q = query(q, startAfter(lastVisible));
    }

    const snap = await getDocs(q);
    const docs = [];
    snap.forEach((ds) => {
        docs.push({
            id: ds.id,
            ...ds.data()
        });
    });

    const hasMore = docs.length === pageSize;
    const newLastVisible = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

    return {
        docs,
        lastVisible: newLastVisible,
        hasMore
    };
}
