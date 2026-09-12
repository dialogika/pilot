// pages/marketing/mailing-list/mailing-list.repository.js
// =====================================================================
// REPOSITORY LAYER: Mailing List (Subscription Email)
// Handles real-time Firestore listeners, schema normalization, and errors.
// =====================================================================

import { db } from "../../../assets/js/firebase-config.js";
import {
    collection,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const COLLECTION_NAME = "subscription_email";

/**
 * Parses raw date value from various formats into a valid Date object or null.
 * @param {any} raw
 * @returns {Date|null}
 */
export function toDateValue(raw) {
    if (!raw) return null;
    if (typeof raw.toDate === "function") {
        const d = raw.toDate();
        return isNaN(d.getTime()) ? null : d;
    }
    if (raw instanceof Date) {
        return isNaN(raw.getTime()) ? null : raw;
    }
    if (typeof raw === "number") {
        const d = new Date(raw);
        return isNaN(d.getTime()) ? null : d;
    }
    const parsed = new Date(raw);
    return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Normalizes document snapshot from `subscription_email` collection.
 * @param {import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js").DocumentSnapshot} docSnap
 * @returns {{ id: string, email: string, createdAt: Date|null }}
 */
export function normalizeSubscriber(docSnap) {
    const d = docSnap.data() || {};
    const email = String(
        d.email ||
        d.email_address ||
        d.emailAddress ||
        d.subscriber_email ||
        d.address ||
        ""
    ).trim();

    const createdAt = toDateValue(
        d.createdAt ||
        d.created_at ||
        d.timestamp ||
        d.date ||
        d.subscribedAt ||
        d.subscribed_at
    );

    return {
        id: docSnap.id,
        email,
        createdAt
    };
}

/**
 * Attaches a real-time listener to the `subscription_email` collection.
 * @param {(items: Array<{ id: string, email: string, createdAt: Date|null }>) => void} onData
 * @param {(error: Error) => void} onError
 * @returns {() => void} Unsubscribe function
 */
export function subscribeToMailingList(onData, onError) {
    const collectionRef = collection(db, COLLECTION_NAME);
    
    return onSnapshot(
        collectionRef,
        (snapshot) => {
            const items = [];
            snapshot.forEach((docSnap) => {
                const item = normalizeSubscriber(docSnap);
                if (item.email) {
                    items.push(item);
                }
            });

            // Sort descending: newest first
            items.sort((a, b) => {
                const ta = a.createdAt ? a.createdAt.getTime() : 0;
                const tb = b.createdAt ? b.createdAt.getTime() : 0;
                return tb - ta;
            });

            if (typeof onData === "function") {
                onData(items);
            }
        },
        (error) => {
            console.error("[MailingListRepository] Error in subscription_email listener:", error);
            if (typeof onError === "function") {
                onError(error);
            }
        }
    );
}

/**
 * Maps Firestore errors into user-friendly localized messages.
 * @param {Error|any} error
 * @returns {string}
 */
export function resolveMailingErrorMessage(error) {
    const rawMessage = String(error?.message || "").toLowerCase();
    const code = String(error?.code || "").toLowerCase();

    if (code.includes("permission-denied")) {
        return "Akses ke collection `subscription_email` ditolak. Cek Firestore Rules atau akun yang sedang digunakan.";
    }
    if (code.includes("unavailable") || rawMessage.includes("network")) {
        return "Koneksi ke Firebase sedang bermasalah. Cek internet lalu coba lagi.";
    }
    return "Gagal terhubung ke Firebase. Pastikan collection `subscription_email` dapat diakses.";
}
