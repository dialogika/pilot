/**
 * Referral Dashboard Repository Module
 * Handles all data access, Firestore operations, and LocalStorage persistence.
 * Zero DOM manipulation.
 */

import { db } from "../../../assets/js/firebase-config.js";
import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// LocalStorage Keys
export const STORAGE_KEY_REFERRALS = "dlg_invoice_referrals";
export const STORAGE_KEY_REFERRALS_LEGACY = "dlg_referrals";
export const STORAGE_KEY_FEAT_CONFIG = "dlg_referral_feat_config";
export const STORAGE_KEY_EXCLUDED_FEATURES = "dlg_excluded_features";

// Standard First Class Features Definition
export const FIRST_CLASS_FEATURES = [
    { key: "fc-feat-1", label: "Garansi mengulang kelas" },
    { key: "fc-feat-2", label: "10x pertemuan: 2 Bulan*" },
    { key: "fc-feat-3", label: "Maksimal peserta 7 orang" },
    { key: "fc-feat-4", label: "Minimal peserta 3 orang" },
    { key: "fc-feat-5", label: "Durasi kelas 90 menit" },
    { key: "fc-feat-6", label: "Dapat Certificate" },
    { key: "fc-feat-7", label: "Bisa DP dan Dicicil" },
    { key: "fc-feat-8", label: "Gratis webinar setiap bulan" },
    { key: "fc-feat-9", label: "E-book & E-module" },
    { key: "fc-feat-10", label: "Komunitas alumni" },
    { key: "fc-feat-11", label: "Jumlah peserta sedikit" },
    { key: "fc-feat-12", label: "Evaluasi tiap sesi" },
    { key: "fc-feat-13", label: "Ada WAG support" },
    { key: "fc-feat-14", label: "Ada reminder kelas" },
    { key: "fc-feat-15", label: "Dapat materi setiap minggu" }
];

// Offline Fallback Products
export const FALLBACK_PRODUCTS = [
    {
        productId: "FIRST-CLASS-JOGJA",
        name: "First Class: Yogyakarta",
        description: "Fokus pembelajaran: bisa bicara tanpa persiapan dan teratur didalam berbicara.",
        type: "Offline",
        basePrice: 1950000,
        totalSessions: 10,
        visual: {
            badgeText: "HOT",
            badgeColor: "#ef4444",
            thumbnailUrl: null
        },
        features: FIRST_CLASS_FEATURES,
        curriculum: [
            { order: "01", title: "Ice Breaking & Mindset", description: "Membangun kepercayaan diri peserta." },
            { order: "02", title: "Public Speaking Basic", description: "Fundamental teknik berbicara di depan umum." }
        ],
        specifications: [
            "Maksimal 7 peserta per batch",
            "Durasi 90 menit per sesi"
        ],
        outcomes: [],
        status: "active",
        createdAt: null,
        updatedAt: null
    }
];

/**
 * Normalizes raw product document data from Firestore
 */
export function mapProductData(d, id) {
    const materials = Array.isArray(d.materials) ? d.materials : [];
    const curriculum = materials.map((item, idx) => ({
        order: item.order || String(idx + 1).padStart(2, "0"),
        title: item.title || "",
        description: item.description || ""
    }));

    const rawFeatures = Array.isArray(d.features) ? d.features
        : Array.isArray(d.keyFeatures) ? d.keyFeatures
            : Array.isArray(d.key_features) ? d.key_features
                : FIRST_CLASS_FEATURES;

    const rawSpecs = Array.isArray(d.specifications) ? d.specifications
        : Array.isArray(d.specs) ? d.specs
            : [];

    return {
        productId: d.productId || id,
        name: d.name || "",
        description: d.description || "",
        type: d.type || "Online",
        basePrice: Number(d.basePrice) || 0,
        totalSessions: Number(d.totalSessions) || 0,
        visual: {
            badgeText: d.badgeText || "NEW",
            badgeColor: d.badgeColor || "#6366f1",
            thumbnailUrl: d.thumbnailUrl || null
        },
        features: rawFeatures.length ? rawFeatures : FIRST_CLASS_FEATURES,
        curriculum: curriculum,
        specifications: rawSpecs,
        outcomes: Array.isArray(d.targetOutcomes) ? d.targetOutcomes : [],
        status: d.status || "active",
        createdAt: d.createdAt || null,
        updatedAt: d.updatedAt || null
    };
}

/**
 * Fetches all products from Firestore products collection
 */
export async function fetchProducts() {
    try {
        const snap = await getDocs(collection(db, "products"));
        const list = [];
        snap.forEach((docSnap) => {
            list.push(mapProductData(docSnap.data() || {}, docSnap.id));
        });
        if (list.length > 0) {
            return list;
        }
        return FALLBACK_PRODUCTS;
    } catch (error) {
        console.warn("[ReferralRepository] Error fetching products, using fallback:", error);
        return FALLBACK_PRODUCTS;
    }
}

/**
 * Fetches referrals from Firestore or LocalStorage
 */
export async function fetchReferrals() {
    // 1. Try Firestore first
    try {
        const ref = doc(db, "settings", "referrals");
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const data = snap.data() || {};
            const list = Array.isArray(data.referrals) ? data.referrals : [];
            persistReferralStorage(list);
            return list;
        }
    } catch (error) {
        console.warn("[ReferralRepository] Error fetching referrals from Firestore, trying LocalStorage:", error);
    }

    // 2. Fallback to LocalStorage
    try {
        const rawPrimary = localStorage.getItem(STORAGE_KEY_REFERRALS);
        const rawLegacy = localStorage.getItem(STORAGE_KEY_REFERRALS_LEGACY);
        const parsed = rawPrimary ? JSON.parse(rawPrimary) : (rawLegacy ? JSON.parse(rawLegacy) : []);
        if (Array.isArray(parsed)) {
            return parsed;
        }
    } catch (e) {
        console.warn("[ReferralRepository] Error reading LocalStorage referrals:", e);
    }

    return [];
}

/**
 * Saves full referrals array to Firestore settings/referrals and LocalStorage
 */
export async function saveReferrals(referralsList) {
    const list = Array.isArray(referralsList) ? referralsList : [];
    persistReferralStorage(list);

    try {
        const ref = doc(db, "settings", "referrals");
        await setDoc(ref, { referrals: list }, { merge: true });
        return true;
    } catch (error) {
        console.error("[ReferralRepository] Error saving referrals to Firestore:", error);
        return false;
    }
}

/**
 * Fetches invoices for calculating live referral usage and history
 */
export async function fetchInvoices() {
    try {
        const snap = await getDocs(collection(db, "invoices"));
        const list = [];
        snap.forEach((docSnap) => {
            const d = docSnap.data() || {};
            list.push({
                id: docSnap.id,
                invoiceNumber: d.invoiceNumber || "",
                referralCode: d.referralCode || "",
                paidAmount: typeof d.paidAmount === "number" ? d.paidAmount : 0,
                paidAtMs: typeof d.paidAtMs === "number" ? d.paidAtMs : 0,
                leadName: d.leadName || ""
            });
        });
        return list;
    } catch (error) {
        console.warn("[ReferralRepository] Error fetching invoices:", error);
        return [];
    }
}

/**
 * Synchronizes referral arrays into localStorage keys
 */
export function persistReferralStorage(referrals) {
    try {
        const serialized = JSON.stringify(Array.isArray(referrals) ? referrals : []);
        localStorage.setItem(STORAGE_KEY_REFERRALS, serialized);
        localStorage.setItem(STORAGE_KEY_REFERRALS_LEGACY, serialized);
    } catch (e) {
        console.warn("[ReferralRepository] persistReferralStorage error:", e);
    }
}

/**
 * Retrieves excluded features for dashboard preview from LocalStorage
 */
export function getSavedExcludedFeatures() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY_EXCLUDED_FEATURES) || "[]");
    } catch (e) {
        return [];
    }
}

/**
 * Persists excluded features for dashboard preview to LocalStorage
 */
export function saveExcludedFeatures(keys) {
    try {
        localStorage.setItem(STORAGE_KEY_EXCLUDED_FEATURES, JSON.stringify(keys || []));
    } catch (e) {
        console.warn("[ReferralRepository] saveExcludedFeatures error:", e);
    }
}

/**
 * Saves specific referral code excluded features mapping to LocalStorage
 */
export function saveReferralFeatConfigToStorage(code, excludedKeys) {
    try {
        let allConfigs = {};
        try {
            allConfigs = JSON.parse(localStorage.getItem(STORAGE_KEY_FEAT_CONFIG) || "{}");
        } catch (e) {
            allConfigs = {};
        }
        allConfigs[code] = excludedKeys || [];
        localStorage.setItem(STORAGE_KEY_FEAT_CONFIG, JSON.stringify(allConfigs));
    } catch (e) {
        console.warn("[ReferralRepository] saveReferralFeatConfigToStorage error:", e);
    }
}

/**
 * Removes referral config from LocalStorage on reset
 */
export function removeReferralFeatConfigFromStorage(code) {
    try {
        let allConfigs = {};
        try {
            allConfigs = JSON.parse(localStorage.getItem(STORAGE_KEY_FEAT_CONFIG) || "{}");
        } catch (e) {
            allConfigs = {};
        }
        delete allConfigs[code];
        localStorage.setItem(STORAGE_KEY_FEAT_CONFIG, JSON.stringify(allConfigs));
    } catch (e) {
        console.warn("[ReferralRepository] removeReferralFeatConfigFromStorage error:", e);
    }
}
