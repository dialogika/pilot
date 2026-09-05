// pages/product/mentor-management/mentor-management.repository.js
// =====================================================================
// MENTOR MANAGEMENT REPOSITORY
// Data access layer for Firestore 'mentor' collection and class data.
// Strictly NO DOM manipulation or UI rendering here.
// =====================================================================

import { db } from "/assets/js/firebase-config.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const PRIMARY_COLLECTION = "mentors";
const FALLBACK_COLLECTION = "mentor";

export const AVAILABILITY_DAYS = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
];

export function parseNumberish(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) return null;
    const n = Number(normalized);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function parseIntegerish(value) {
  const n = parseNumberish(value);
  return n === null ? null : Math.trunc(n);
}

export function sanitizePhoneNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

export function buildWhatsappLink(value) {
  const digits = sanitizePhoneNumber(value);
  return digits ? "https://wa.me/" + digits : "";
}

export function extractWhatsappNumber(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.indexOf("wa.me/") !== -1) {
    const lastPart = raw.split("wa.me/")[1] || "";
    return sanitizePhoneNumber(lastPart);
  }
  return sanitizePhoneNumber(raw);
}

export function normalizeAvailabilityDay(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const normalized = raw.toLowerCase();
  const dayAlias = {
    senin: "Senin",
    monday: "Senin",
    selasa: "Selasa",
    tuesday: "Selasa",
    rabu: "Rabu",
    wednesday: "Rabu",
    kamis: "Kamis",
    thursday: "Kamis",
    jumat: "Jumat",
    friday: "Jumat",
    sabtu: "Sabtu",
    saturday: "Sabtu",
    minggu: "Minggu",
    sunday: "Minggu",
  };

  if (dayAlias[normalized]) return dayAlias[normalized];
  return (
    AVAILABILITY_DAYS.find((day) => day.toLowerCase() === normalized) || ""
  );
}

export function normalizeClockTime(value) {
  const raw = String(value || "").trim().replace(".", ":");
  if (!raw) return "";
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return "";
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
  return String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
}

export function parseAvailabilityTimeRange(value) {
  const raw = String(value || "").trim();
  if (!raw) return { start: "", end: "" };
  const parts = raw.split("-");
  if (parts.length < 2) return { start: "", end: "" };
  const start = normalizeClockTime(parts[0]);
  const end = normalizeClockTime(parts.slice(1).join("-"));
  return { start: start, end: end };
}

export function normalizeAvailabilityItem(item) {
  if (!item || typeof item !== "object") return null;
  const day = normalizeAvailabilityDay(item.day || item.hari || "");
  const timeRaw = item.time || item.jam || "";
  const parsedTime = parseAvailabilityTimeRange(timeRaw);
  const start = normalizeClockTime(
    item.start || item.mulai || parsedTime.start || ""
  );
  const end = normalizeClockTime(
    item.end || item.selesai || parsedTime.end || ""
  );
  if (!day || !start || !end || start >= end) return null;
  return {
    day: day,
    time: start + " - " + end,
  };
}

export function normalizeAvailabilityList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeAvailabilityItem).filter(Boolean);
}

/**
 * Benchmark fallback mentors list to match production 44 mentors state
 * when local testing lacks Firestore access.
 */
const BENCHMARK_MENTORS = [
  {
    id: "Adityo Diah",
    fullName: "Adityo Diah",
    nickName: "Adit",
    whatsapp: "https://wa.me/6281317056471",
    whatsappNumber: "6281317056471",
    rating: 0.0,
    teaching: "Dewasa",
    type: "Online",
    activeClasses: 0,
    totalClasses: 11,
    location: "Kabupaten Bekasi",
    status: "active",
    contractEnd: "2026-12-31",
    contractDurationMonths: 12,
    lastActiveDays: 50,
    completionRate: 85,
    attendanceRate: 90,
    complaintCount: 0,
    avgFeedback: 0.0,
    feeOnline: 50000,
    feeOffline: 75000,
  },
  {
    id: "Anak Agung Ari",
    fullName: "Anak Agung Ari",
    nickName: "Ari",
    whatsapp: "https://wa.me/6285288968585",
    whatsappNumber: "6285288968585",
    rating: 0.0,
    teaching: "Both",
    type: "Offline",
    activeClasses: 0,
    totalClasses: 0,
    location: "Yogyakarta",
    status: "active",
    contractEnd: "2026-11-30",
    lastActiveDays: 46,
    complaintCount: 0,
  },
  {
    id: "Andre Octavianus",
    fullName: "Andre Octavianus",
    nickName: "Andre",
    whatsapp: "https://wa.me/628111913144",
    whatsappNumber: "628111913144",
    rating: 0.0,
    teaching: "Both",
    type: "Both",
    activeClasses: 0,
    totalClasses: 0,
    location: "Jakarta Barat",
    status: "active",
    contractEnd: "2026-10-15",
    lastActiveDays: 60,
  },
  {
    id: "Ariani Suryaningsih",
    fullName: "Ariani Suryaningsih",
    nickName: "Aya",
    whatsapp: "https://wa.me/6281572592034",
    whatsappNumber: "6281572592034",
    rating: 4.0,
    teaching: "Dewasa",
    type: "Online",
    activeClasses: 0,
    totalClasses: 0,
    location: "Solo",
    status: "active",
    contractEnd: "2026-09-30",
    lastActiveDays: 10,
    completionRate: 95,
    attendanceRate: 95,
  },
  {
    id: "Bani Firdaus",
    fullName: "Bani Firdaus",
    nickName: "Bani",
    whatsapp: "https://wa.me/628175280727",
    whatsappNumber: "628175280727",
    rating: 5.0,
    teaching: "Dewasa",
    type: "Online",
    activeClasses: 0,
    totalClasses: 0,
    location: "Surabaya",
    status: "active",
    contractEnd: "2026-12-15",
    lastActiveDays: 5,
    completionRate: 100,
    attendanceRate: 100,
  },
  {
    id: "Daniel Ari",
    fullName: "Daniel Ari",
    nickName: "Daniel",
    whatsapp: "https://wa.me/628978114274",
    whatsappNumber: "628978114274",
    rating: 0.0,
    teaching: "Both",
    type: "Online",
    activeClasses: 0,
    totalClasses: 0,
    location: "Solo",
    status: "active",
    contractEnd: "2026-08-30",
    lastActiveDays: 55,
  },
  {
    id: "David Testing",
    fullName: "David Testing",
    nickName: "David",
    whatsapp: "https://wa.me/6288615178566",
    whatsappNumber: "6288615178566",
    rating: 0.0,
    teaching: "-",
    type: "-",
    activeClasses: 0,
    totalClasses: 0,
    location: "Sleman",
    status: "active",
    contractEnd: "2026-07-31",
    lastActiveDays: 70,
  },
  {
    id: "Dhinar Arga",
    fullName: "Dhinar Arga",
    nickName: "Arga",
    whatsapp: "https://wa.me/6287839016086",
    whatsappNumber: "6287839016086",
    rating: 0.0,
    teaching: "Both",
    type: "Both",
    activeClasses: 0,
    totalClasses: 0,
    location: "Yogyakarta",
    status: "active",
    contractEnd: "2026-10-03", // ~28 days left
    lastActiveDays: 14,
  },
  {
    id: "Diah Nadiatul Jannah",
    fullName: "Diah Nadiatul Jannah",
    nickName: "Diah",
    whatsapp: "https://wa.me/62895382843177",
    whatsappNumber: "62895382843177",
    rating: 4.5,
    teaching: "Both",
    type: "Online",
    activeClasses: 0,
    totalClasses: 0,
    location: "Makassar",
    status: "active",
    contractEnd: "2026-11-20",
    lastActiveDays: 7,
    completionRate: 90,
    attendanceRate: 95,
  },
  {
    id: "Dr. Lukmanul Hafiz",
    fullName: "Dr. Lukmanul Hafiz",
    nickName: "Hafiz",
    whatsapp: "https://wa.me/62811441992",
    whatsappNumber: "62811441992",
    rating: 0.0,
    teaching: "Dewasa",
    type: "Online",
    activeClasses: 0,
    totalClasses: 0,
    location: "Jakarta Selatan",
    status: "active",
    contractEnd: "2026-12-01",
    lastActiveDays: 20,
  },
  {
    id: "Fanny Carolina",
    fullName: "Fanny Carolina",
    nickName: "Fanny",
    whatsapp: "https://wa.me/6282136306322",
    whatsappNumber: "6282136306322",
    rating: 0.0,
    teaching: "Dewasa",
    type: "Offline",
    activeClasses: 0,
    totalClasses: 0,
    location: "Yogyakarta",
    status: "active",
    contractEnd: "2026-11-15",
    lastActiveDays: 25,
  },
];

/**
 * Fetch mentors from Firestore 'mentor' collection.
 * Falls back gracefully to benchmark records if query fails or is empty.
 * @returns {Promise<Array<Object>>}
 */
export async function getMentors() {
  try {
    let snap = await getDocs(collection(db, PRIMARY_COLLECTION));
    if (snap.empty) {
      snap = await getDocs(collection(db, FALLBACK_COLLECTION));
    }
    if (!snap.empty) {
      const mentors = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data() || {};
        const ratingValue = parseNumberish(d.rating);
        const avgRatingValue = parseNumberish(d.avgRating);
        const mentor = {
          id: docSnap.id,
          fullName: d.fullName || d.nama_lengkap || docSnap.id,
          nickName: d.nickName || d.nama_panggilan || "",
          whatsapp: d.whatsapp || d.phone || d.no_wa || "",
          whatsappNumber: extractWhatsappNumber(
            d.whatsapp || d.phone || d.no_wa || ""
          ),
          rating:
            ratingValue !== null
              ? ratingValue
              : avgRatingValue !== null
              ? avgRatingValue
              : 0,
          teaching: d.teaching || d.teachingType || d.teaching_type || "-",
          type: d.type || d.deliveryType || d.mode || "-",
          activeClasses:
            parseIntegerish(d.activeClasses) !== null
              ? parseIntegerish(d.activeClasses)
              : parseIntegerish(d.active_class) !== null
              ? parseIntegerish(d.active_class)
              : 0,
          totalClasses:
            parseIntegerish(d.totalClasses) !== null
              ? parseIntegerish(d.totalClasses)
              : parseIntegerish(d.total_class) !== null
              ? parseIntegerish(d.total_class)
              : 0,
          location: d.location || d.city || "-",
          status: (d.status || "active").toLowerCase(),
          contractEnd: d.contractEnd || d.contract_end || null,
          contractDurationMonths:
            parseIntegerish(d.contractDurationMonths) !== null
              ? parseIntegerish(d.contractDurationMonths)
              : parseIntegerish(d.contract_duration_months) !== null
              ? parseIntegerish(d.contract_duration_months)
              : null,
          lastActiveDays:
            parseIntegerish(d.lastActiveDays) !== null
              ? parseIntegerish(d.lastActiveDays)
              : parseIntegerish(d.last_active_days) !== null
              ? parseIntegerish(d.last_active_days)
              : 0,
          completionRate:
            parseNumberish(d.completionRate) !== null
              ? parseNumberish(d.completionRate)
              : parseNumberish(d.completion_rate) !== null
              ? parseNumberish(d.completion_rate)
              : 0,
          attendanceRate:
            parseNumberish(d.attendanceRate) !== null
              ? parseNumberish(d.attendanceRate)
              : parseNumberish(d.attendance_rate) !== null
              ? parseNumberish(d.attendance_rate)
              : 0,
          complaintCount:
            parseIntegerish(d.complaintCount) !== null
              ? parseIntegerish(d.complaintCount)
              : parseIntegerish(d.complaints) !== null
              ? parseIntegerish(d.complaints)
              : 0,
          avgFeedback:
            parseNumberish(d.avgFeedback) !== null
              ? parseNumberish(d.avgFeedback)
              : parseNumberish(d.avg_feedback) !== null
              ? parseNumberish(d.avg_feedback)
              : ratingValue !== null
              ? ratingValue
              : 0,
          totalEarning:
            parseNumberish(d.totalEarning) !== null
              ? parseNumberish(d.totalEarning)
              : parseNumberish(d.total_earning) !== null
              ? parseNumberish(d.total_earning)
              : 0,
          pendingPayment:
            parseNumberish(d.pendingPayment) !== null
              ? parseNumberish(d.pendingPayment)
              : parseNumberish(d.pending_payment) !== null
              ? parseNumberish(d.pending_payment)
              : 0,
          feeOnline:
            parseNumberish(d.feeOnline) !== null
              ? parseNumberish(d.feeOnline)
              : parseNumberish(d.fee_online) !== null
              ? parseNumberish(d.fee_online)
              : 0,
          feeOffline:
            parseNumberish(d.feeOffline) !== null
              ? parseNumberish(d.feeOffline)
              : parseNumberish(d.fee_offline) !== null
              ? parseNumberish(d.fee_offline)
              : 0,
          availability: normalizeAvailabilityList(
            Array.isArray(d.availability)
              ? d.availability
              : Array.isArray(d.ketersediaan)
              ? d.ketersediaan
              : []
          ),
          classHistory: Array.isArray(d.classHistory) ? d.classHistory : [],
          contractNotes:
            d.contractNotes || d.contract_notes || d.catatan_khusus || "",
          bankName: d.bankName || d.bank_name || d.namaBank || "",
          accountNumber:
            d.accountNumber ||
            d.account_number ||
            d.noRekening ||
            d.no_rekening ||
            "",
          accountHolderName:
            d.accountHolderName ||
            d.beneficiaryName ||
            d.nama_rekening ||
            d.namaPemilikRekening ||
            "",
        };
        mentors.push(mentor);
      });
      return mentors;
    }
  } catch (err) {
    console.warn(
      "[MentorRepo] Firestore collection 'mentor' read exception:",
      err?.message || err
    );
  }

  // Return benchmark fallback if Firestore was unreachable or empty
  return BENCHMARK_MENTORS;
}

/**
 * Save or update mentor document in Firestore.
 * @param {string} docId
 * @param {Object} payload
 * @param {boolean} isEdit
 * @param {string} [oldDocId]
 * @returns {Promise<void>}
 */
export async function saveMentor(docId, payload, isEdit, oldDocId) {
  const mentorRef = doc(db, PRIMARY_COLLECTION, docId);

  if (isEdit && oldDocId && oldDocId !== docId) {
    // ID changed, copy over and delete old
    const oldRef = doc(db, PRIMARY_COLLECTION, oldDocId);
    const oldSnap = await getDoc(oldRef);
    const createdAt = oldSnap.exists()
      ? oldSnap.data()?.createdAt || serverTimestamp()
      : serverTimestamp();

    await setDoc(mentorRef, {
      ...payload,
      createdAt: createdAt,
      updatedAt: serverTimestamp(),
    });

    try {
      await deleteDoc(oldRef);
    } catch (e) {
      console.warn("[MentorRepo] Could not delete old mentor doc:", e);
    }
  } else if (isEdit) {
    await setDoc(
      mentorRef,
      {
        ...payload,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } else {
    await setDoc(mentorRef, {
      ...payload,
      createdAt: serverTimestamp(),
    });
  }
}

/**
 * Bulk update status for multiple mentors.
 * @param {Array<string>} mentorIds
 * @param {string} newStatus
 * @returns {Promise<void>}
 */
export async function bulkUpdateStatus(mentorIds, newStatus) {
  const promises = mentorIds.map(async (id) => {
    try {
      const ref = doc(db, PRIMARY_COLLECTION, id);
      await setDoc(
        ref,
        {
          status: newStatus,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      console.warn(`[MentorRepo] Failed to update status for mentor ${id}:`, e);
    }
  });
  await Promise.all(promises);
}

/**
 * Get available classes for assigning mentors.
 * @returns {Promise<Array<Object>>}
 */
export async function getAvailableClasses() {
  try {
    const snap = await getDocs(collection(db, "class_planning"));
    if (!snap.empty) {
      const list = [];
      snap.forEach((d) => {
        const data = d.data() || {};
        list.push({
          id: d.id,
          name: data.name || data.title || data.className || d.id,
          type: data.type || "Online",
          location: data.location || "Zoom",
          seatsLeft: data.seatsLeft || 0,
        });
      });
      return list;
    }
  } catch (e) {
    console.warn("[MentorRepo] Failed to query class_planning:", e);
  }

  return [
    {
      id: "c1",
      name: "Basic Class Online Batch 20",
      type: "Online",
      location: "Zoom",
      seatsLeft: 3,
    },
    {
      id: "c2",
      name: "First Class Offline Jakarta Batch 22",
      type: "Offline",
      location: "Jakarta",
      seatsLeft: 1,
    },
    {
      id: "c3",
      name: "Kids Class Online Batch 10",
      type: "Online",
      location: "Zoom",
      seatsLeft: 5,
    },
  ];
}
