// pages/product/product-management/product-management.repository.js
// =====================================================================
// PRODUCT MANAGEMENT REPOSITORY
// Direct Firestore data access for Products.
// =====================================================================

import { db } from "../../../assets/js/firebase-config.js";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const PRODUCTS_COLLECTION = "products";

export const PUBLIC_URL_MAP = {
  fk_lvl1: "https://dialogika.co/program/first-kids.html",
  kp_lvl1: "https://dialogika.co/program/kids-play.html",
  bp_lvl1: "https://dialogika.co/program/basic-class.html",
  fc_lvl1: "https://dialogika.co/program/first-class.html",
};

/**
 * Fallback dataset if Firestore connection is restricted or offline
 */
export const FALLBACK_PRODUCTS = [
  {
    product_id: "BP-LVL-03",
    name: "Basic Plus - Level 03",
    description: "Program intensif public speaking untuk pengembangan level dasar lanjutan.",
    type: "Online",
    base_price: 1579000,
    total_sessions: 4,
    visual: {
      badge_text: "NEW",
      badge_color: "#6366f1",
      thumbnail_url: null,
    },
    features: [
      { label: "Modul & E-Book", type: "boolean", value: true },
      { label: "Sertifikat Kelulusan", type: "boolean", value: true },
      { label: "Evaluasi Personal", type: "text", value: "Setiap Sesi" },
    ],
    curriculum: [
      {
        order: "01",
        title: "Fondasi Dasar & Kepercayaan Diri",
        description: "Member belajar untuk mengubah ketakutan menjadi energi positif melalui reframing.",
      },
      {
        order: "02",
        title: "Teknik Komunikasi Verbal & Non-Verbal",
        description: "Member berlatih secara intensif untuk memastikan pesan tidak hanya terdengar.",
      },
      {
        order: "03",
        title: "Impromptu & Storytelling",
        description: "Member akan mengimplementasikan teknik PREP (Point, Reason, Example, Point).",
      },
    ],
    specifications: ["Online", "Interactive Zoom", "Max 10 Peserta"],
    outcomes: ["Menguasai teknik berbicara tanpa panik", "Percaya diri berbicara di depan umum"],
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    product_id: "BASIC-PLAY",
    name: "Basic - Play",
    description: "Program pembelajaran interaktif dan menyenangkan untuk pemula.",
    type: "Online",
    base_price: 1000000,
    total_sessions: 12,
    visual: {
      badge_text: "NEW",
      badge_color: "#10b981",
      thumbnail_url: null,
    },
    features: [
      { label: "Sesi Praktik Terbimbing", type: "boolean", value: true },
      { label: "Akses Komunitas Selamanya", type: "boolean", value: true },
    ],
    curriculum: [
      {
        order: "01",
        title: "Ice Breaking & Fun Communication",
        description: "Membangun rasa nyaman dan interaksi aktif sejak hari pertama.",
      },
      {
        order: "02",
        title: "Body Language Basics",
        description: "Mengenal postur, kontak mata, dan ekspresi wajah yang natural.",
      },
    ],
    specifications: ["Online", "Gamified Learning"],
    outcomes: ["Meningkatkan keberanian berekspresi", "Menghilangkan grogi saat presentasi"],
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * Normalizes a raw Firestore document snapshot data to standard product schema.
 * @param {string} id - Document ID
 * @param {Object} d - Raw Document Data
 * @returns {Object}
 */
export function normalizeProduct(id, d = {}) {
  const materials = Array.isArray(d.materials) ? d.materials : [];
  const curriculum = materials.map((item, idx) => ({
    order: item.order || String(idx + 1).padStart(2, "0"),
    title: item.title || "",
    description: item.description || "",
  }));

  const features = Array.isArray(d.features)
    ? d.features.map((feat) => {
        if (typeof feat === "string") {
          return { label: feat, type: "boolean", value: true };
        }
        return {
          label: feat.label || "",
          type: feat.type || "boolean",
          value: feat.type === "boolean" ? !!feat.value : String(feat.value || ""),
        };
      })
    : [];

  return {
    id: id,
    product_id: d.productId || id,
    name: d.name || "",
    description: d.description || "",
    type: d.type || "Online",
    base_price: Number(d.basePrice) || 0,
    total_sessions: Number(d.totalSessions) || 0,
    visual: {
      badge_text: d.badgeText || (d.visual && d.visual.badge_text) || "NEW",
      badge_color: d.badgeColor || (d.visual && d.visual.badge_color) || "#6366f1",
      thumbnail_url: d.thumbnailUrl || (d.visual && d.visual.thumbnail_url) || null,
    },
    features,
    curriculum,
    specifications: Array.isArray(d.specifications) ? d.specifications : [],
    outcomes: Array.isArray(d.targetOutcomes) ? d.targetOutcomes : Array.isArray(d.outcomes) ? d.outcomes : [],
    status: d.status || "active",
    createdAt: d.createdAt || null,
    updatedAt: d.updatedAt || null,
  };
}

/**
 * Subscribes to products collection in real time.
 * @param {function(Array): void} onUpdate
 * @param {function(Error): void} onError
 * @returns {function(): void} Unsubscribe function
 */
export function subscribeToProducts(onUpdate, onError) {
  try {
    const q = query(collection(db, PRODUCTS_COLLECTION));
    return onSnapshot(
      q,
      (snapshot) => {
        const list = [];
        snapshot.forEach((docSnap) => {
          list.push(normalizeProduct(docSnap.id, docSnap.data()));
        });
        onUpdate(list);
      },
      (error) => {
        console.warn("[ProductRepository] Snapshot error, falling back:", error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Fetches all products once with a timeout.
 * @param {number} timeoutMs
 * @returns {Promise<Array>}
 */
export async function fetchProducts(timeoutMs = 8000) {
  const fetchPromise = (async () => {
    const snap = await getDocs(collection(db, PRODUCTS_COLLECTION));
    const list = [];
    snap.forEach((docSnap) => {
      list.push(normalizeProduct(docSnap.id, docSnap.data()));
    });
    return list;
  })();

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Firestore fetch timeout")), timeoutMs)
  );

  return Promise.race([fetchPromise, timeoutPromise]);
}

/**
 * Saves or updates a product in Firestore.
 * @param {Object} formData
 * @param {boolean} isEdit
 * @returns {Promise<void>}
 */
export async function saveProduct(formData, isEdit = false) {
  const productId = String(formData.product_id || "").trim();
  if (!productId) {
    throw new Error("Product Unique ID is required.");
  }

  const normalizedCurriculum = Array.isArray(formData.curriculum)
    ? formData.curriculum
        .map((item, idx) => ({
          order: String(item.order || idx + 1).trim(),
          title: String(item.title || "").trim(),
          description: String(item.description || "").trim(),
        }))
        .filter((item) => item.title)
    : [];

  const normalizedFeatures = Array.isArray(formData.features)
    ? formData.features
        .map((feat) => ({
          label: String(feat.label || "").trim(),
          type: feat.type || "boolean",
          value: feat.type === "boolean" ? Boolean(feat.value) : String(feat.value ?? "").trim(),
        }))
        .filter((feat) => feat.label)
    : [];

  const classType = formData.type || "Online";

  const manualSpecifications = Array.isArray(formData.specifications)
    ? formData.specifications.filter((s) => String(s || "").trim() && s !== classType)
    : [];
  const finalSpecifications = [classType, ...manualSpecifications];

  const normalizedOutcomes = Array.isArray(formData.outcomes)
    ? formData.outcomes.map((o) => String(o || "").trim()).filter(Boolean)
    : [];

  const payload = {
    productId: productId,
    name: String(formData.name || "").trim(),
    description: String(formData.description || "").trim(),
    type: classType,
    basePrice: Number(formData.base_price) || 0,
    currency: "IDR",
    totalSessions: Number(formData.total_sessions) || 0,
    badgeText: formData.visual?.badge_text || "NEW",
    badgeColor: formData.visual?.badge_color || "#6366f1",
    thumbnailUrl: formData.visual?.thumbnail_url || null,
    features: normalizedFeatures,
    materials: normalizedCurriculum,
    specifications: finalSpecifications,
    targetOutcomes: normalizedOutcomes,
    status: formData.status || "active",
    updatedAt: serverTimestamp(),
  };

  if (!isEdit) {
    payload.createdAt = serverTimestamp();
  }

  const docRef = doc(db, PRODUCTS_COLLECTION, productId);
  await setDoc(docRef, payload, { merge: true });
}

/**
 * Deletes a product from Firestore.
 * @param {string} productId
 * @returns {Promise<void>}
 */
export async function deleteProduct(productId) {
  const cleanId = String(productId || "").trim();
  if (!cleanId) {
    throw new Error("Invalid Product ID for deletion.");
  }
  const docRef = doc(db, PRODUCTS_COLLECTION, cleanId);
  await deleteDoc(docRef);
}
