// pages/hr/company-position/company-position.repository.js
// =====================================================================
// COMPANY POSITION DATA ACCESS
// The ONLY module that talks to Firebase Firestore for Company Positions.
// =====================================================================

import { db } from "../../../assets/js/firebase-config.js";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let activePositionsCollection = "position";
let activeDepartmentsCollection = "department";

/**
 * Load all departments into id -> { label, color } mapping.
 * Tries `department` first, then falls back to `departments`.
 * @returns {Promise<{ labelMap: Object, colorMap: Object, rawList: Array }>}
 */
export async function loadDepartmentsMap() {
  const labelMap = {};
  const colorMap = {};
  const rawList = [];

  const sources = ["department", "departments"];
  for (const collName of sources) {
    try {
      const snap = await getDocs(collection(db, collName));
      if (!snap.empty) {
        activeDepartmentsCollection = collName;
        snap.forEach((docSnap) => {
          const d = docSnap.data() || {};
          const key = docSnap.id;
          const label = d.name || d.label || d.title || d.department || key;
          const color = d.color || d.badgeColor || d.bgColor || d.backgroundColor || "";
          labelMap[key] = label;
          if (color) colorMap[key] = color;
          rawList.push({ id: key, name: label, color: color, ...d });
        });
        return { labelMap, colorMap, rawList };
      }
    } catch (e) {
      console.warn(`Department source '${collName}' not readable:`, e);
    }
  }

  return { labelMap, colorMap, rawList };
}

/**
 * Helper to normalize Firestore timestamp/date.
 * @param {any} value
 * @returns {Date|null}
 */
export function normalizeDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Fetch all positions from Firestore.
 * Tries `position` first, then falls back to `positions`.
 * @returns {Promise<Array>}
 */
export async function listPositions() {
  const items = [];
  const sources = ["position", "positions"];
  let snap = null;

  for (const collName of sources) {
    try {
      const s = await getDocs(collection(db, collName));
      if (!s.empty) {
        snap = s;
        activePositionsCollection = collName;
        break;
      }
    } catch (e) {
      console.warn(`Positions source '${collName}' not readable:`, e);
    }
  }

  if (!snap) {
    try {
      snap = await getDocs(collection(db, "position"));
      activePositionsCollection = "position";
    } catch (e) {
      console.error("Error reading position collection:", e);
      return items;
    }
  }

  snap.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const name = data.name || data.label || data.title || data.position || "Unknown Position";
    const headCount = parseInt(data.headCount ?? data.quota ?? 0, 10);
    const activeCount = parseInt(data.activeCount ?? 0, 10);
    const applicantCount = parseInt(data.applicantCount ?? 0, 10);
    const jobdesk = data.jobdesk || data.description || "";
    const department = data.department || data.dept_id || "";
    const createdRaw =
      data.createdAt || data.created || data.created_at || data.date || data.createdDate || null;

    const rawStatus = (data.status || "Open").toString();
    const status = /close/i.test(rawStatus) ? "Close" : "Open";

    const initials =
      name
        .split(" ")
        .filter((w) => Boolean(w.trim()))
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase() || "CP";

    items.push({
      id: docSnap.id,
      collection: activePositionsCollection,
      name,
      headCount,
      activeCount,
      applicantCount,
      jobdesk,
      department,
      initials,
      status,
      statusClass: status === "Open" ? "st-open" : "st-close",
      createdAt: normalizeDate(createdRaw),
    });
  });

  return items;
}

/**
 * Get a single position by ID.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getPosition(id) {
  const docSnap = await getDoc(doc(db, activePositionsCollection, id));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() };
}

/**
 * Add a new position record.
 * @param {Object} payload
 * @returns {Promise<string>} Created Document ID
 */
export async function addPosition(payload) {
  const docData = {
    name: payload.name.trim(),
    department: payload.department || "",
    headCount: parseInt(payload.headCount || 0, 10),
    activeCount: parseInt(payload.activeCount || 0, 10),
    applicantCount: parseInt(payload.applicantCount || 0, 10),
    jobdesk: payload.jobdesk || "",
    status: payload.status || "Open",
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, activePositionsCollection), docData);
  return docRef.id;
}

/**
 * Update an existing position record.
 * @param {string} id
 * @param {Object} payload
 * @returns {Promise<void>}
 */
export async function updatePosition(id, payload) {
  const docData = {
    name: payload.name.trim(),
    department: payload.department || "",
    headCount: parseInt(payload.headCount || 0, 10),
    activeCount: parseInt(payload.activeCount || 0, 10),
    applicantCount: parseInt(payload.applicantCount || 0, 10),
    jobdesk: payload.jobdesk || "",
    status: payload.status || "Open",
  };

  await updateDoc(doc(db, activePositionsCollection, id), docData);
}

/**
 * Delete a position record by ID.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deletePosition(id) {
  await deleteDoc(doc(db, activePositionsCollection, id));
}
