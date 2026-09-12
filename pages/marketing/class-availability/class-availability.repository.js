/**
 * Class Availability Repository Layer
 * Pure Data Access Layer (Zero DOM manipulation).
 * Handles Firestore queries for `class_availability`, `products`, `mentor`, and `class_planning`.
 */

import { auth, db } from "../../../assets/js/firebase-config.js";
import {
    collection,
    getDocs,
    addDoc,
    deleteDoc,
    doc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const FALLBACK_CLASSES = [
    {
        id: "1",
        docId: "fallback-1",
        name: "First Class Offline - Jakarta (Preview Mode)",
        type: "Offline",
        max_seat: 7,
        current_joined: 6,
        start_date: "10 Nov 2023",
        mentor_name: "Coach Aris",
        product_id: "FC-OFF-JKT",
        product_name: "First Class",
        location: "Jakarta",
        down_payment: 500000,
        is_planned: false
    },
    {
        id: "2",
        docId: "fallback-2",
        name: "Basic Plus Online - Batch 42 (Preview Mode)",
        type: "Online",
        max_seat: 10,
        current_joined: 10,
        start_date: "12 Nov 2023",
        mentor_name: "Coach Devi",
        product_id: "BP-ONL-42",
        product_name: "Basic Plus",
        location: "",
        down_payment: 300000,
        is_planned: false
    },
    {
        id: "3",
        docId: "fallback-3",
        name: "Private Class - Public Speaking",
        type: "Private",
        max_seat: 1,
        current_joined: 0,
        start_date: "Flexible",
        mentor_name: "Coach Taufan",
        product_id: "PVT-PS",
        product_name: "Private Public Speaking",
        location: "Yogyakarta",
        down_payment: 1000000,
        is_planned: false
    },
    {
        id: "4",
        docId: "fallback-4",
        name: "Advanced Presentation - Online",
        type: "Online",
        max_seat: 12,
        current_joined: 4,
        start_date: "15 Nov 2023",
        mentor_name: "Coach Aris",
        product_id: "ADV-ONL",
        product_name: "Advanced Presentation",
        location: "",
        down_payment: 500000,
        is_planned: false
    },
    {
        id: "5",
        docId: "fallback-5",
        name: "Kids Public Speaking - Offline",
        type: "Offline",
        max_seat: 7,
        current_joined: 2,
        start_date: "20 Nov 2023",
        mentor_name: "Coach Susi",
        product_id: "KIDS-OFF",
        product_name: "Kids Public Speaking",
        location: "Yogyakarta",
        down_payment: 350000,
        is_planned: false
    }
];

/**
 * Normalizes a Firestore document snapshot from `class_availability`.
 */
export function normalizeClassItem(docSnap, index = 1) {
    const d = docSnap.data ? docSnap.data() || {} : docSnap;
    const docId = docSnap.id || d.docId || `temp-${index}`;
    return {
        id: String(d.id || index),
        docId: docId,
        name: d.name || "Unnamed Class",
        type: d.type || "Offline",
        max_seat: Number(d.max_seat || 0),
        current_joined: Number(d.current_joined || 0),
        start_date: d.start_date || "Flexible",
        mentor_name: d.mentor_name || "Unknown",
        product_id: d.productId || d.product_id || null,
        product_name: d.productName || d.product_name || null,
        location: d.location || "",
        down_payment: Number(d.down_payment || 0),
        is_planned: Boolean(d.is_planned || false)
    };
}

/**
 * Fetches all class availability items from Firestore.
 * @returns {Promise<Array>}
 */
export async function fetchClassAvailability() {
    try {
        const snap = await getDocs(collection(db, "class_availability"));
        if (snap.empty) {
            return [];
        }
        const items = [];
        let idx = 1;
        snap.forEach((docSnap) => {
            items.push(normalizeClassItem(docSnap, idx++));
        });
        return items;
    } catch (error) {
        console.error("fetchClassAvailability error:", error);
        throw error;
    }
}

/**
 * Fetches products list for dropdowns.
 * @returns {Promise<Array>}
 */
export async function fetchProducts() {
    try {
        const snap = await getDocs(collection(db, "products"));
        const list = [];
        snap.forEach((docSnap) => {
            const d = docSnap.data() || {};
            const id = docSnap.id;
            list.push({
                id,
                productId: d.productId || id,
                name: d.name || d.internalName || id
            });
        });
        list.sort((a, b) => {
            const left = String(a.name || a.productId || "").toLowerCase();
            const right = String(b.name || b.productId || "").toLowerCase();
            return left.localeCompare(right, "id");
        });
        return list;
    } catch (error) {
        console.error("fetchProducts error:", error);
        return [];
    }
}

/**
 * Fetches mentors list for dropdowns.
 * @returns {Promise<Array>}
 */
export async function fetchMentors() {
    try {
        const snap = await getDocs(collection(db, "mentor"));
        const list = [];
        snap.forEach((docSnap) => {
            const d = docSnap.data() || {};
            const id = docSnap.id;
            if (d.fullName) {
                list.push({
                    id,
                    name: d.fullName
                });
            }
        });
        list.sort((a, b) => a.name.localeCompare(b.name, "id"));
        return list;
    } catch (error) {
        console.error("fetchMentors error:", error);
        return [];
    }
}

/**
 * Adds a new class batch to Firestore.
 * @param {Object} batchData
 * @returns {Promise<string>} docId
 */
export async function addClassBatch(batchData) {
    try {
        const payload = {
            name: batchData.name,
            type: batchData.type || "Offline",
            max_seat: Number(batchData.max_seat) || 1,
            current_joined: Number(batchData.current_joined) || 0,
            start_date: batchData.start_date || "Flexible",
            mentor_name: batchData.mentor_name || "Unknown",
            productId: batchData.product_id || "",
            productName: batchData.product_name || "",
            location: batchData.location || "",
            down_payment: Number(batchData.down_payment) || 0,
            created_at: serverTimestamp()
        };
        const docRef = await addDoc(collection(db, "class_availability"), payload);
        return docRef.id;
    } catch (error) {
        console.error("addClassBatch error:", error);
        throw error;
    }
}

/**
 * Updates an existing class batch in Firestore.
 * @param {string} docId
 * @param {Object} updatedData
 */
export async function updateClassBatch(docId, updatedData) {
    if (!docId) throw new Error("Missing docId for update");
    try {
        const payload = {
            name: updatedData.name,
            type: updatedData.type,
            max_seat: Number(updatedData.max_seat),
            current_joined: Number(updatedData.current_joined),
            start_date: updatedData.start_date,
            mentor_name: updatedData.mentor_name,
            productId: updatedData.product_id,
            productName: updatedData.product_name,
            location: updatedData.location || "",
            down_payment: Number(updatedData.down_payment) || 0
        };
        await updateDoc(doc(db, "class_availability", docId), payload);
    } catch (error) {
        console.error("updateClassBatch error:", error);
        throw error;
    }
}

/**
 * Updates only the current_joined seat count in Firestore.
 * @param {string} docId
 * @param {number} currentJoined
 */
export async function updateJoinedSeats(docId, currentJoined) {
    if (!docId) return;
    try {
        await updateDoc(doc(db, "class_availability", docId), {
            current_joined: Number(currentJoined)
        });
    } catch (error) {
        console.error("updateJoinedSeats error:", error);
        throw error;
    }
}

/**
 * Deletes a class batch document from Firestore.
 * @param {string} docId
 */
export async function deleteClassBatch(docId) {
    if (!docId) throw new Error("Missing docId for delete");
    try {
        await deleteDoc(doc(db, "class_availability", docId));
    } catch (error) {
        console.error("deleteClassBatch error:", error);
        throw error;
    }
}

/**
 * Moves a valid class to `class_planning` and marks it as planned in `class_availability`.
 * @param {Object} classItem
 */
export async function moveToClassPlanning(classItem) {
    try {
        const dateStr = String(classItem.start_date || "").trim();
        const parts = dateStr.split("T");
        let dateKey = "";
        let timeKey = "";

        if (parts.length > 1) {
            const dObj = new Date(parts[0]);
            if (!isNaN(dObj.getTime())) {
                dateKey = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, "0")}-${String(dObj.getDate()).padStart(2, "0")}`;
            }
            timeKey = parts[1].slice(0, 5);
        } else {
            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) {
                dateKey = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
                timeKey = `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
            }
        }

        const payload = {
            availabilityId: classItem.docId || "",
            name: classItem.name,
            mentor: classItem.mentor_name,
            type: classItem.type,
            max_seat: classItem.max_seat,
            current_joined: classItem.current_joined,
            duration: 1.5,
            room: "",
            note: "",
            date: dateKey,
            time: timeKey,
            productId: classItem.product_id || "",
            productName: classItem.product_name || "",
            location: classItem.location || "",
            down_payment: classItem.down_payment || 0,
            createdAt: serverTimestamp()
        };

        await addDoc(collection(db, "class_planning"), payload);

        if (classItem.docId) {
            await updateDoc(doc(db, "class_availability", classItem.docId), {
                is_planned: true
            });
        }
    } catch (error) {
        console.error("moveToClassPlanning error:", error);
        throw error;
    }
}
