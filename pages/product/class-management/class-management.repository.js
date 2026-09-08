/**
 * class-management.repository.js
 * Data Access Layer (Zero DOM) for Class Management feature.
 * Connects to Firestore 'class_planning' and 'mentor' collections.
 */

import { db } from "/assets/js/firebase-config.js";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  arrayUnion,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Fallback dataset if Firestore is unreachable or empty
 */
export const FALLBACK_CLASSES = [
  {
    id: "c1",
    docId: "c1",
    name: "First Class Jakarta April #1",
    className: "First Class Jakarta April #1",
    variant: "regular",
    isRemedial: false,
    parentClassDocId: "",
    parentClassName: "",
    rootClassDocId: "",
    remedialLevel: 0,
    remedialReason: "",
    productName: "First Class",
    productId: "FC-01",
    status: "Soon",
    startDate: "2026-04-20",
    dates: [
      { date: "2026-04-20", type: "meeting", label: "Meeting 1" },
      { date: "2026-04-23", type: "reminder", label: "Reminder pembayaran" },
    ],
    location: "Jakarta",
    type: "Offline",
    pic: { name: "Faris", initials: "F" },
    notify: { name: "Rebuy Team", initials: "R" },
    meeting: { done: 0, total: 8 },
    mentors: [
      { name: "Aris", initials: "A" },
      { name: "Nadia", initials: "N" },
    ],
    groupLink: "https://chat.whatsapp.com/example1",
    membersCount: 18,
    memberRefs: [],
    files: [
      { name: "Silabus.pdf", type: "pdf" },
      { name: "Poster.png", type: "image" },
    ],
    comment: "Kelas baru, fokus corporate working adults.",
    attendanceRate: 0,
    delayCount: 0,
    rescheduleCount: 0,
  },
  {
    id: "c2",
    docId: "c2",
    name: "Basic Class Online Mei #2",
    className: "Basic Class Online Mei #2",
    variant: "regular",
    isRemedial: false,
    parentClassDocId: "",
    parentClassName: "",
    rootClassDocId: "",
    remedialLevel: 0,
    remedialReason: "",
    productName: "Basic Class",
    productId: "BC-01",
    status: "Running",
    startDate: "2026-04-05",
    dates: [
      { date: "2026-04-05", type: "meeting", label: "Meeting 1" },
      { date: "2026-04-12", type: "meeting", label: "Meeting 2" },
      { date: "2026-04-19", type: "meeting", label: "Meeting 3 (Reschedule)" },
    ],
    location: "Online (Zoom)",
    type: "Online",
    pic: { name: "Sarah", initials: "S" },
    notify: { name: "Operation Team", initials: "O" },
    meeting: { done: 3, total: 8 },
    mentors: [{ name: "Bimo", initials: "B" }],
    groupLink: "https://chat.whatsapp.com/example2",
    membersCount: 24,
    memberRefs: [],
    files: [{ name: "Absensi.xlsx", type: "sheet" }],
    comment: "Beberapa peserta sering telat; butuh reminder tambahan.",
    attendanceRate: 82,
    delayCount: 2,
    rescheduleCount: 1,
  },
  {
    id: "c3",
    docId: "c3",
    name: "Kids Class Online Batch 10",
    className: "Kids Class Online Batch 10",
    variant: "regular",
    isRemedial: false,
    parentClassDocId: "",
    parentClassName: "",
    rootClassDocId: "",
    remedialLevel: 0,
    remedialReason: "",
    productName: "Kids Class",
    productId: "KC-01",
    status: "Reminder",
    startDate: "2026-03-25",
    dates: [
      { date: "2026-03-25", type: "meeting", label: "Meeting 1" },
      { date: "2026-04-01", type: "meeting", label: "Meeting 2" },
      { date: "2026-04-08", type: "reminder", label: "Follow up absensi orang tua" },
    ],
    location: "Online (Zoom)",
    type: "Online",
    pic: { name: "Nadia", initials: "N" },
    notify: { name: "Kids Lead", initials: "K" },
    meeting: { done: 2, total: 6 },
    mentors: [{ name: "Nadia", initials: "N" }],
    groupLink: "https://chat.whatsapp.com/example3",
    membersCount: 12,
    memberRefs: [],
    files: [],
    comment: "Perlu monitoring kehadiran anak-anak.",
    attendanceRate: 76,
    delayCount: 3,
    rescheduleCount: 0,
  },
  {
    id: "c4",
    docId: "c4",
    name: "First Class Surabaya Maret #3",
    className: "First Class Surabaya Maret #3",
    variant: "regular",
    isRemedial: false,
    parentClassDocId: "",
    parentClassName: "",
    rootClassDocId: "",
    remedialLevel: 0,
    remedialReason: "",
    productName: "First Class",
    productId: "FC-01",
    status: "Stall",
    startDate: "2026-02-15",
    dates: [
      { date: "2026-02-15", type: "meeting", label: "Meeting 1" },
      { date: "2026-02-22", type: "meeting", label: "Meeting 2" },
    ],
    location: "Surabaya",
    type: "Offline",
    pic: { name: "Rina", initials: "R" },
    notify: { name: "Rebuy Team", initials: "R" },
    meeting: { done: 2, total: 8 },
    mentors: [{ name: "Aris", initials: "A" }],
    groupLink: "",
    membersCount: 10,
    memberRefs: [],
    files: [],
    comment: "Kelas terhenti, banyak reschedule. Perlu keputusan lanjutan.",
    attendanceRate: 60,
    delayCount: 4,
    rescheduleCount: 3,
  },
  {
    id: "c5",
    docId: "c5",
    name: "First Class Jakarta Januari #1",
    className: "First Class Jakarta Januari #1",
    variant: "regular",
    isRemedial: false,
    parentClassDocId: "",
    parentClassName: "",
    rootClassDocId: "",
    remedialLevel: 0,
    remedialReason: "",
    productName: "First Class",
    productId: "FC-01",
    status: "Graduate",
    startDate: "2026-01-05",
    dates: [
      { date: "2026-01-05", type: "meeting", label: "Kickoff" },
      { date: "2026-02-10", type: "meeting", label: "Graduation" },
    ],
    location: "Jakarta",
    type: "Offline",
    pic: { name: "Faris", initials: "F" },
    notify: { name: "Operation Team", initials: "O" },
    meeting: { done: 8, total: 8 },
    mentors: [{ name: "Aris", initials: "A" }],
    groupLink: "",
    membersCount: 16,
    memberRefs: [],
    files: [],
    comment: "Kelas berjalan sangat baik, banyak testimoni positif.",
    attendanceRate: 95,
    delayCount: 1,
    rescheduleCount: 0,
  },
  {
    id: "c6",
    docId: "c6",
    name: "Basic Class Online Desember #5",
    className: "Basic Class Online Desember #5",
    variant: "regular",
    isRemedial: false,
    parentClassDocId: "",
    parentClassName: "",
    rootClassDocId: "",
    remedialLevel: 0,
    remedialReason: "",
    productName: "Basic Class",
    productId: "BC-01",
    status: "Complete",
    startDate: "2025-12-01",
    dates: [],
    location: "Online (Zoom)",
    type: "Online",
    pic: { name: "Sarah", initials: "S" },
    notify: { name: "Operation Team", initials: "O" },
    meeting: { done: 8, total: 8 },
    mentors: [{ name: "Bimo", initials: "B" }],
    groupLink: "",
    membersCount: 20,
    memberRefs: [],
    files: [],
    comment: "Kelas selesai, laporan sudah dikirim.",
    attendanceRate: 90,
    delayCount: 1,
    rescheduleCount: 1,
  },
];

/**
 * Derives class operational status
 */
export function deriveStatusFromAvailability(d) {
  const raw = d && (d.status || d.class_status);
  if (raw) {
    const lower = String(raw).toLowerCase();
    if (lower === "soon") return "Soon";
    if (lower === "running") return "Running";
    if (lower === "reminder") return "Reminder";
    if (lower === "stall") return "Stall";
    if (lower === "graduate") return "Graduate";
    if (lower === "complete") return "Complete";
  }
  const startRaw = d && (d.start_date || d.startDate || d.date);
  if (!startRaw || startRaw === "Flexible") return "Soon";
  const start = new Date(startRaw);
  if (isNaN(start.getTime())) return "Soon";
  const now = new Date();
  if (start.getTime() > now.getTime()) return "Soon";
  return "Running";
}

/**
 * Normalizes Firestore document to standard Class entity
 */
export function mapAvailabilityDocToClass(docSnap, idx = 1) {
  const d = docSnap.data() || {};
  const id = d.id || docSnap.id || `c${idx}`;
  const startRaw = d.date || d.start_date || d.startDate || "";
  const mentorName = d.mentor_name || d.mentor || "";
  const mentors = [];

  if (typeof mentorName === "string" && mentorName.trim() !== "") {
    mentorName.split(",").forEach((part) => {
      const name = part.trim();
      if (!name) return;
      const initials = name
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
      mentors.push({ name, initials });
    });
  }

  if (Array.isArray(d.mentors)) {
    d.mentors.forEach((m) => {
      if (!m) return;
      if (typeof m === "string") {
        const name = m.trim();
        if (!name) return;
        const initials = name
          .split(" ")
          .filter(Boolean)
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);
        mentors.push({ name, initials });
      } else if (m.name) {
        const name = String(m.name);
        const initials =
          m.initials ||
          name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
        mentors.push({ name, initials });
      }
    });
  }

  const picName = d.pic || "";
  const notifyName = d.notify || "";
  const buildPerson = (name) => {
    if (!name) return null;
    const initials = name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    return { name, initials };
  };

  const attendanceRate = typeof d.attendanceRate === "number" ? d.attendanceRate : 0;
  const delayCount = typeof d.delayCount === "number" ? d.delayCount : 0;
  const rescheduleCount = typeof d.rescheduleCount === "number" ? d.rescheduleCount : 0;
  const meetingDone =
    typeof d.meeting_done === "number"
      ? d.meeting_done
      : typeof d.meetingDone === "number"
        ? d.meetingDone
        : 0;
  const meetingTotal =
    typeof d.meeting_total === "number"
      ? d.meeting_total
      : typeof d.meetingTotal === "number"
        ? d.meetingTotal
        : 0;
  const isRemedial =
    d.is_remedial === true ||
    d.isRemedial === true ||
    String(d.variant || "").toLowerCase() === "remedial";

  return {
    id,
    docId: docSnap.id,
    name: d.name || d.class_name || "Unnamed Class",
    className: d.class_name || d.name || "Unnamed Class",
    variant: d.variant || (isRemedial ? "remedial" : "regular"),
    isRemedial,
    parentClassDocId: d.parent_class_doc_id || d.parentClassDocId || "",
    parentClassName: d.parent_class_name || d.parentClassName || "",
    rootClassDocId: d.root_class_doc_id || d.rootClassDocId || "",
    remedialLevel:
      typeof d.remedial_level === "number"
        ? d.remedial_level
        : typeof d.remedialLevel === "number"
          ? d.remedialLevel
          : 0,
    remedialReason: d.remedial_reason || d.remedialReason || "",
    productName: d.productName || d.product_name || "",
    productId: d.productId || d.product_id || "",
    status: deriveStatusFromAvailability(d),
    startDate: startRaw,
    dates: Array.isArray(d.dates) ? d.dates : [],
    location: d.location || "",
    type: d.type || "Offline",
    pic: buildPerson(picName),
    notify: buildPerson(notifyName),
    meeting: {
      done: meetingDone,
      total: meetingTotal,
    },
    mentors,
    groupLink: d.group_link || d.groupLink || "",
    membersCount: typeof d.current_joined === "number" ? d.current_joined : 0,
    memberRefs: [],
    files: Array.isArray(d.files) ? d.files : [],
    comment: d.comment || d.remedial_reason || "",
    attendanceRate,
    delayCount,
    rescheduleCount,
  };
}

/**
 * Fetches all classes from Firestore 'class_planning'
 */
export async function fetchClasses() {
  if (!db) return FALLBACK_CLASSES;
  try {
    const snap = await getDocs(collection(db, "class_planning"));
    if (snap.empty) {
      return FALLBACK_CLASSES;
    }
    const loaded = [];
    let idx = 1;
    snap.forEach((docSnap) => {
      loaded.push(mapAvailabilityDocToClass(docSnap, idx++));
    });
    return loaded.length > 0 ? loaded : FALLBACK_CLASSES;
  } catch (error) {
    console.error("[Repository] Failed to fetch classes from class_planning:", error);
    return FALLBACK_CLASSES;
  }
}

/**
 * Fetches mentors for lookup
 */
export async function fetchMentors() {
  if (!db) return [];
  try {
    const mentorSnap = await getDocs(collection(db, "mentor"));
    return mentorSnap.docs.map((docSnap) => ({
      id: docSnap.id,
      data: docSnap.data() || {},
    }));
  } catch (error) {
    console.error("[Repository] Failed to fetch mentors:", error);
    return [];
  }
}

/**
 * Fetches class planning items for calendar/drag-drop schedule
 */
export async function fetchPlanningItems() {
  if (!db) return { unscheduled: [], scheduled: [] };
  try {
    const snap = await getDocs(collection(db, "class_planning"));
    const unscheduled = [];
    const scheduled = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data() || {};
      const item = {
        id: docSnap.id,
        name: d.name || d.class_name || "",
        mentor: d.mentor_name || d.mentor || "",
        duration: typeof d.duration === "number" ? d.duration : 1,
        type: d.type || "Online",
        note: d.note || "",
        date: d.date || d.start_date || d.startDate || "",
        time: d.time || "",
      };
      if (item.date && item.time) {
        scheduled.push(item);
      } else {
        unscheduled.push(item);
      }
    });
    return { unscheduled, scheduled };
  } catch (error) {
    console.error("[Repository] Failed to fetch planning items:", error);
    return { unscheduled: [], scheduled: [] };
  }
}

/**
 * Saves a new remedial class and links it to parent class
 */
export async function saveRemedialClass(payload, parentDocId) {
  if (!db) throw new Error("Database not connected");
  const docRef = await addDoc(collection(db, "class_planning"), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (parentDocId) {
    const remedialEntry = {
      remedialClassDocId: docRef.id,
      remedialClassName: payload.name || payload.class_name,
      parentClassDocId: parentDocId,
      parentClassName: payload.parent_class_name || "",
      rootClassDocId: payload.root_class_doc_id || parentDocId,
      remedialLevel: payload.remedial_level || 1,
      createdAt: new Date().toISOString(),
    };
    await updateDoc(doc(db, "class_planning", parentDocId), {
      remedials: arrayUnion(remedialEntry),
      updatedAt: serverTimestamp(),
    });
  }

  return docRef.id;
}

/**
 * Creates a regular new class in Firestore
 */
export async function saveNewClass(classData) {
  if (!db) throw new Error("Database not connected");
  const docRef = await addDoc(collection(db, "class_planning"), {
    ...classData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Updates class document (e.g. comment or details)
 */
export async function updateClassDoc(docId, updateData) {
  if (!db) return;
  await updateDoc(doc(db, "class_planning", docId), {
    ...updateData,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Deletes class document
 */
export async function deleteClassDoc(docId) {
  if (!db) return;
  await deleteDoc(doc(db, "class_planning", docId));
}
