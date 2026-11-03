import { db, auth, storage } from "../../../assets/js/firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  query,
  where,
  limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { saveTemplates, setTemplatesLastModified } from "../../../element/template-manager.js";
import { syncAcceptedCandidateToTeamManagement, resolveCandidateDivision } from "../../../element/team-management-sync.js";
import {
  downloadExportFile,
  calcDateRange,
  extractTimestamp,
  formatDateIndo,
} from "../../../assets/js/utils/export-helper.js";
import {
  formatInterviewScheduleLabel,
  getInterviewScheduleStatus,
} from "../../../element/recruitment-interview-utils.js";

/**
 * Normalizes interviewer availability status.
 * @param {string} raw 
 * @param {string} fallback 
 * @returns {string}
 */
export function normalizeInterviewerAvailability(raw, fallback) {
  const v = (raw || fallback || "").toString().trim().toLowerCase();
  if (!v) return "available";
  if (["booked", "busy", "occupied", "taken", "unavailable", "not_available"].includes(v)) return "booked";
  return "available";
}

/**
 * Resolves interviewer specialization from user doc data.
 * @param {Object} data 
 * @returns {string}
 */
export function resolveInterviewerSpecialization(data) {
  if (!data || typeof data !== "object") return "General Recruitment";
  return (data.specialization || data.interviewer_specialization || data.position_name || data.position || data.role_name || data.role || "General Recruitment").toString();
}

/**
 * Fetches map of users for interviewer lookup.
 * @returns {Promise<Object>}
 */
export async function fetchUsersMap() {
  const usersMap = {};
  try {
    const snap = await getDocs(collection(db, "users"));
    snap.forEach((ds) => {
      const d = ds.data() || {};
      usersMap[ds.id] = {
        name: d.displayName || d.name || d.email || "User",
        photo: d.photo || d.photoURL || d.avatar_url || d.avatar || null,
        specialization: resolveInterviewerSpecialization(d),
        availability: normalizeInterviewerAvailability(d.interview_availability || d.availability || d.interviewer_status || d.status)
      };
    });
  } catch (err) {
    console.error("[CandidateRepo] Failed to fetch users map:", err);
  }
  return usersMap;
}

/**
 * Subscribes to real-time updates for users.
 * @param {Function} onUpdate 
 * @param {Function} onError 
 * @returns {Function} Unsubscribe function
 */
export function subscribeUsers(onUpdate, onError) {
  return onSnapshot(
    collection(db, "users"),
    (snap) => {
      const usersMap = {};
      snap.forEach((ds) => {
        const d = ds.data() || {};
        usersMap[ds.id] = {
          name: d.displayName || d.name || d.email || "User",
          photo: d.photo || d.photoURL || d.avatar_url || d.avatar || null,
          specialization: resolveInterviewerSpecialization(d),
          availability: normalizeInterviewerAvailability(d.interview_availability || d.availability || d.interviewer_status || d.status)
        };
      });
      if (typeof onUpdate === "function") onUpdate(usersMap);
    },
    (err) => {
      console.error("[CandidateRepo] Users snapshot error:", err);
      if (typeof onError === "function") onError(err);
    }
  );
}

/**
 * Subscribes to real-time updates for candidates in a specific collection with fallback.
 * @param {string} collectionName 
 * @param {string} [fallbackCollectionName]
 * @param {Function} onUpdate 
 * @param {Function} onError 
 * @returns {Function} Unsubscribe function
 */
export function subscribeCandidates(collectionName, fallbackCollectionName, onUpdate, onError) {
  let activeCollection = collectionName;
  let unsub = onSnapshot(
    collection(db, activeCollection),
    (snap) => {
      if (snap.empty && fallbackCollectionName && activeCollection === collectionName) {
        if (typeof unsub === "function") unsub();
        activeCollection = fallbackCollectionName;
        unsub = onSnapshot(
          collection(db, activeCollection),
          (fallbackSnap) => {
            if (typeof onUpdate === "function") onUpdate(fallbackSnap, activeCollection);
          },
          onError
        );
        return;
      }
      if (typeof onUpdate === "function") onUpdate(snap, activeCollection);
    },
    (err) => {
      console.error(`[CandidateRepo] Realtime error on ${activeCollection}:`, err);
      if (fallbackCollectionName && activeCollection === collectionName) {
        activeCollection = fallbackCollectionName;
        unsub = onSnapshot(
          collection(db, activeCollection),
          (fallbackSnap) => {
            if (typeof onUpdate === "function") onUpdate(fallbackSnap, activeCollection);
          },
          onError
        );
      } else if (typeof onError === "function") {
        onError(err);
      }
    }
  );
  return () => {
    if (typeof unsub === "function") unsub();
  };
}

/**
 * Fetches candidates from Firestore once with fallback.
 * @param {string} collectionName 
 * @param {string} [fallbackCollectionName]
 * @returns {Promise<Object>} Snapshot and activeCollection
 */
export async function fetchCandidates(collectionName, fallbackCollectionName) {
  let snap = await getDocs(collection(db, collectionName));
  let activeCollection = collectionName;
  if (snap.empty && fallbackCollectionName) {
    const fallbackSnap = await getDocs(collection(db, fallbackCollectionName));
    if (!fallbackSnap.empty) {
      snap = fallbackSnap;
      activeCollection = fallbackCollectionName;
    }
  }
  return { snap, activeCollection };
}

/**
 * Updates candidate recruitment status.
 * @param {string} collectionName 
 * @param {string} talentId 
 * @param {string} newStatus 
 * @param {string} actorName 
 * @returns {Promise<boolean>}
 */
export async function updateCandidateStatus(collectionName, talentId, newStatus, actorName) {
  if (!talentId || !newStatus) return false;
  const ref = doc(db, collectionName, talentId);
  const nowIso = new Date().toISOString();
  try {
    await updateDoc(ref, {
      "recruitment_status.current": newStatus,
      "recruitment_status.history": arrayUnion({ status: newStatus, date: nowIso }),
      logs: arrayUnion({ action: "status_change", to: newStatus, by: actorName || null, date: nowIso })
    });
    return true;
  } catch (e) {
    console.error("[CandidateRepo] Status update failed:", e);
    return false;
  }
}

/**
 * Cancels candidate status (withdrawn / canceled).
 * @param {string} collectionName 
 * @param {string} talentId 
 * @param {string} notes 
 * @param {string} actorName 
 * @returns {Promise<boolean>}
 */
export async function cancelCandidateStatus(collectionName, talentId, notes, actorName) {
  if (!talentId) return false;
  const ref = doc(db, collectionName, talentId);
  const nowIso = new Date().toISOString();
  try {
    await updateDoc(ref, {
      "recruitment_status.current": "canceled",
      "recruitment_status.final_decision": "canceled",
      "recruitment_status.final_decision_at": nowIso,
      "recruitment_status.withdrawn_notes": notes || "",
      "recruitment_status.history": arrayUnion({
        status: "canceled",
        previousStatus: "active",
        date: nowIso,
        by: actorName || null
      }),
      logs: arrayUnion({
        action: "status_change",
        to: "canceled",
        by: actorName || null,
        date: nowIso,
        notes: notes || ""
      })
    });
    return true;
  } catch (e) {
    console.error("[CandidateRepo] Cancel candidate failed:", e);
    return false;
  }
}

/**
 * Moves candidate to trash collection and marks as inactive.
 * @param {Object} config 
 * @param {string} talentId 
 * @param {Object} payload 
 * @returns {Promise<void>}
 */
export async function moveCandidateToTrash(config, talentId, payload) {
  if (!talentId) return;
  const user = auth.currentUser;
  const dbn = user ? user.displayName || user.email || "Recruitment Team" : "Recruitment Team";
  const dbe = user ? user.email || "" : "";

  const trashPayload = {
    source_doc_id: talentId,
    source_collection: config.collectionName,
    name: payload?.name || "Tanpa Nama",
    position: payload?.position || "-",
    email: payload?.email || "-",
    campus: payload?.campus || "-",
    avatar_url: payload?.avatarUrl || "",
    last_status: payload?.lastStatus || "Screening",
    is_deleted: true,
    record_status: "inactive",
    deleted_source_page: config.deletedSourcePage,
    deleted_source_label: config.deletedSourceLabel,
    deleted_at: serverTimestamp(),
    deleted_by_uid: user ? user.uid : "",
    deleted_by_name: dbn,
    deleted_by_email: dbe,
    updated_at: serverTimestamp()
  };

  await setDoc(doc(db, config.trashCollection, talentId), trashPayload);
  await updateDoc(doc(db, config.collectionName, talentId), {
    is_deleted: true,
    record_status: "inactive",
    deleted_source_page: config.deletedSourcePage,
    deleted_source_label: config.deletedSourceLabel,
    deleted_at: serverTimestamp(),
    deleted_by_uid: user ? user.uid : "",
    deleted_by_name: dbn,
    deleted_by_email: dbe
  });
}

/**
 * Syncs an accepted candidate to the team_management collection.
 * @param {string} collectionName 
 * @param {string} talentId 
 * @param {string} division 
 * @param {string} source 
 * @returns {Promise<void>}
 */
export async function syncTeamMember(collectionName, talentId, division, source) {
  return await syncAcceptedCandidateToTeamManagement({
    db,
    candidateCollection: collectionName,
    candidateId: talentId,
    division,
    source
  });
}

/**
 * Resolves candidate division from Firestore document.
 * @param {string} collectionName 
 * @param {string} talentId 
 * @returns {Promise<string>}
 */
export async function resolveCandidateDiv(collectionName, talentId) {
  return await resolveCandidateDivision(db, collectionName, talentId);
}

/**
 * Syncs an accepted candidate to the mentor collection.
 * @param {string} candidateId 
 * @returns {Promise<void>}
 */
export async function syncAcceptedMentor(candidateId) {
  if (!candidateId) return;
  try {
    const snap = await getDoc(doc(db, "mentors_screening", candidateId));
    if (!snap.exists()) {
      console.warn("[Mentor Sync] Mentor candidate not found:", candidateId);
      return;
    }
    const sourceData = snap.data() || {};
    const basic = sourceData.basic_info || {};
    const contact = sourceData.contact_info || {};
    const internship = sourceData.internship || sourceData.internship_info || {};
    const scouting = sourceData.scouting_info || {};
    const education = sourceData.education || {};
    const fullName = basic.full_name || scouting.full_name || sourceData.full_name || "Tanpa Nama";
    const nickName = (fullName.split(" ")[0] || "").trim();
    const whatsappRaw = internship.whatsapp || contact.whatsapp || contact.phone || sourceData.whatsapp || "";
    const digits = (whatsappRaw || "").toString().replace(/\D/g, "");
    const whatsappLink = digits ? "https://wa.me/" + digits : "";
    const location = internship.address || contact.address || sourceData.location || sourceData.city || "";
    const teachingType = scouting.teaching_type || internship.teaching_type || sourceData.teaching_type || "";
    const deliveryType = internship.mode || sourceData.type || sourceData.deliveryType || "";

    const mentorPayload = {
      fullName,
      nickName,
      whatsapp: whatsappLink,
      location,
      rating: 0,
      teaching: teachingType,
      type: deliveryType,
      activeClasses: 0,
      totalClasses: 0,
      status: "active",
      contractEnd: null,
      contractDurationMonths: null,
      lastActiveDays: 0,
      completionRate: 0,
      attendanceRate: 0,
      complaintCount: 0,
      avgFeedback: 0,
      totalEarning: 0,
      pendingPayment: 0,
      feeOnline: 0,
      feeOffline: 0,
      availability: [],
      classHistory: [],
      contractNotes: "",
      bankName: "",
      accountNumber: "",
      accountHolderName: fullName,
      email: internship.email || contact.email || basic.email || "",
      campus: internship.campus || education.campus || education.university || "",
      major: internship.major || education.major || education.department || education.faculty || "",
      instagram: internship.instagram || contact.instagram || "",
      linkedin: internship.linkedin || contact.linkedin || scouting.channel_url || "",
      address: contact.address || internship.address || "",
      avatar_url: basic.avatar_url || "",
      source_candidate_id: candidateId,
      source_collection: "mentors_screening",
      copied_to_mentor_at: new Date().toISOString(),
      createdAt: sourceData.created_at || sourceData.createdAt || serverTimestamp()
    };

    await setDoc(doc(db, "mentor", candidateId), mentorPayload, { merge: true });
    console.log("[Mentor Sync] Candidate", candidateId, "synced to mentor collection.");
  } catch (e) {
    console.error("[Mentor Sync] Failed to sync mentor candidate:", e);
  }
}

/**
 * Cleans up synced data across collections if candidate is canceled or deleted.
 * @param {Object} config 
 * @param {string} talentId 
 * @returns {Promise<void>}
 */
export async function deleteSyncedCandidateData(config, talentId) {
  try {
    if (config.hasMentorSync) {
      const mentorRef = doc(db, "mentor", talentId);
      const mentorSnap = await getDoc(mentorRef);
      if (mentorSnap.exists()) {
        await deleteDoc(mentorRef);
        console.log("[Cancel Sync] Deleted mentor doc:", talentId);
      }
    }
    if (config.hasTeamSync) {
      const tmQuery = query(collection(db, "team_management"), where("candidateId", "==", talentId), limit(1));
      const tmSnap = await getDocs(tmQuery);
      if (!tmSnap.empty) {
        const tmDoc = tmSnap.docs[0];
        await deleteDoc(doc(db, "team_management", tmDoc.id));
        console.log("[Cancel Sync] Deleted team_management doc:", tmDoc.id);
      }
      await updateDoc(doc(db, config.collectionName, talentId), {
        isTeamMember: false,
        is_team_member: false,
        "recruitment_status.is_team_member": false,
        "recruitment_status.team_management_id": null,
        "recruitment_status.team_member_division": null,
        "recruitment_status.team_member_department": null,
        teamManagementId: null
      });
      console.log("[Cancel Sync] Cleared team flags for:", talentId);
    }
  } catch (e) {
    console.error("[Cancel Sync] Failed to clean synced data:", e);
  }
}

/**
 * Fetches recruitment positions from Firestore.
 * @returns {Promise<Array>}
 */
export async function fetchPositions() {
  const positions = [];
  const snap = await getDocs(collection(db, "recruitment_positions"));
  snap.forEach((ds) => {
    const raw = ds.data() || {};
    let cat = raw.category;
    if (Array.isArray(cat)) cat = cat[0] || "";
    cat = (cat || "").toString().toLowerCase();
    const isActive = raw.active !== undefined ? !!raw.active : !!raw.is_active;
    const createdAt = raw.createdAt || raw.created_at || null;
    positions.push({ id: ds.id, ...raw, category: cat, active: isActive, createdAt });
  });
  positions.sort((a, b) => (a.name || "").localeCompare(b.name || "", "id"));
  return positions;
}

/**
 * Creates a new recruitment position.
 * @param {Object} payload 
 * @returns {Promise<string>}
 */
export async function addPosition(payload) {
  const docPayload = {
    name: payload.name,
    category: payload.category,
    active: payload.active,
    is_active: payload.active,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const docRef = await addDoc(collection(db, "recruitment_positions"), docPayload);
  return docRef.id;
}

/**
 * Updates an existing recruitment position.
 * @param {string} docId 
 * @param {Object} payload 
 * @returns {Promise<void>}
 */
export async function updatePosition(docId, payload) {
  const docPayload = {
    name: payload.name,
    category: payload.category,
    active: payload.active,
    is_active: payload.active,
    updatedAt: serverTimestamp()
  };
  await updateDoc(doc(db, "recruitment_positions", docId), docPayload);
}

/**
 * Toggles the active state of a recruitment position.
 * @param {string} docId 
 * @param {boolean} currentActive 
 * @returns {Promise<boolean>} New active state
 */
export async function togglePositionActive(docId, currentActive) {
  const newActive = !currentActive;
  await updateDoc(doc(db, "recruitment_positions", docId), {
    active: newActive,
    is_active: newActive,
    updatedAt: serverTimestamp()
  });
  return newActive;
}

/**
 * Deletes a recruitment position from Firestore.
 * @param {string} docId 
 * @returns {Promise<void>}
 */
export async function deletePosition(docId) {
  await deleteDoc(doc(db, "recruitment_positions", docId));
}

/**
 * Saves WhatsApp templates for a given category.
 * @param {Object} templatesMap 
 * @param {string} category 
 */
export function saveCategoryTemplates(templatesMap, category) {
  saveTemplates(templatesMap, category);
  setTemplatesLastModified(category);
}

/**
 * Uploads a file to Firebase Storage.
 * @param {File} file 
 * @param {string} folder 
 * @returns {Promise<string>} Download URL
 */
export async function uploadFileToStorage(file, folder = "uploads") {
  if (!file) return null;
  const path = `${folder}/${Date.now()}-${file.name}`;
  const r = storageRef(storage, path);
  await uploadBytes(r, file);
  return await getDownloadURL(r);
}

/**
 * Safely converts any timestamp/date input into a Date object.
 * @param {any} raw 
 * @returns {Date|null}
 */
function toDateObj(raw) {
  if (!raw) return null;
  if (typeof raw.toDate === "function") {
    const d = raw.toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d : null;
  }
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === "number") {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === "string") {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Export Candidate Management data to Excel (.xlsx) or CSV (.csv).
 * @param {Object} options
 * @param {string} options.category - 'all' | 'team' | 'mentor' | 'internship'
 * @param {string} options.status - 'all' | 'screening' | 'interview' | 'micro_teaching' | 'accepted' | 'onboarding' | 'rejected' | 'canceled'
 * @param {string} options.rangeType - 'all' | 'month' | 'week'
 * @param {string} options.month
 * @param {string} options.weekMonth
 * @param {number} options.week
 * @param {string} options.format - 'xlsx' | 'csv'
 * @returns {Promise<{ count: number, filename: string }>}
 */
export async function exportCandidateMgmtData({
  category = "all",
  status = "all",
  rangeType = "all",
  month = "",
  weekMonth = "",
  week = 1,
  format = "xlsx",
}) {
  const { startTimestamp, endTimestamp, periodLabel } = calcDateRange(
    rangeType,
    month,
    weekMonth,
    week
  );

  const usersMap = await fetchUsersMap().catch(() => ({}));

  const targets = [];
  if (category === "team" || category === "all") {
    targets.push({ categoryLabel: "Team", col: "teams_screening", fallbackCol: "team_screening" });
  }
  if (category === "mentor" || category === "all") {
    targets.push({ categoryLabel: "Mentor", col: "mentors_screening", fallbackCol: "mentor_screening" });
  }
  if (category === "internship" || category === "all") {
    targets.push({
      categoryLabel: "Internship",
      col: "interns_screening",
      fallbackCol: "intern_screening",
      extraFallbackCols: ["internships_screening", "internship_screening"],
    });
  }

  const allRecords = [];
  for (const t of targets) {
    try {
      let { snap } = await fetchCandidates(t.col, t.fallbackCol);
      if (snap.empty && Array.isArray(t.extraFallbackCols)) {
        for (const extraCol of t.extraFallbackCols) {
          const extraSnap = await getDocs(collection(db, extraCol));
          if (!extraSnap.empty) {
            snap = extraSnap;
            break;
          }
        }
      }
      snap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        allRecords.push({
          id: docSnap.id,
          categoryLabel: t.categoryLabel,
          ...data,
        });
      });
    } catch (e) {
      console.warn(`[exportCandidateMgmtData] Failed to fetch ${t.col}:`, e);
    }
  }

  // Filter status
  let filtered = allRecords;
  if (status && status !== "all") {
    const sTerm = status.toLowerCase().trim();
    filtered = filtered.filter((item) => {
      const rec = item.recruitment_status || item.recruitment_system || {};
      const cur = (rec.current || item.status || "screening").toString().toLowerCase().trim();
      const fd = (rec.final_decision || rec.finalDecision || "").toString().toLowerCase().trim();
      if (cur === sTerm || fd === sTerm) return true;
      if (sTerm === "on_job_test" && ["on_job_training", "ojt", "on_job_test"].includes(cur)) return true;
      if (sTerm === "follow_up" && ["followup", "follow up", "follow_up"].includes(cur)) return true;
      if (sTerm === "accepted" && (cur === "accept" || fd === "accept")) return true;
      if (sTerm === "rejected" && (cur === "reject" || fd === "reject")) return true;
      if (sTerm === "canceled" && ["withdrawn", "mengundurkan_diri", "mengundurkan diri"].includes(fd || cur)) return true;
      return false;
    });
  }

  // Filter date
  if (rangeType !== "all") {
    filtered = filtered.filter((item) => {
      const ts =
        extractTimestamp(item.created_at) ||
        extractTimestamp(item.createdAt) ||
        extractTimestamp(item.timestamp) ||
        extractTimestamp(item.applied_at);
      if (ts === null) return true;
      return ts >= startTimestamp && ts <= endTimestamp;
    });
  }

  if (!filtered.length) {
    throw new Error("Tidak ada data kandidat pada periode / filter yang dipilih.");
  }

  const columns = [
    { header: "No", key: "no", width: 6 },
    { header: "Kategori", key: "category", width: 14 },
    { header: "ID Kandidat", key: "id", width: 22 },
    { header: "Nama Lengkap", key: "name", width: 26 },
    { header: "Posisi / Role", key: "position", width: 24 },
    { header: "Status Rekrutmen", key: "status", width: 18 },
    { header: "Tanggal Pendaftaran", key: "createdAt", width: 20 },
    { header: "Interviewer (PIC)", key: "interviewer", width: 24 },
    { header: "Jadwal Interview", key: "interviewSchedule", width: 28 },
    { header: "Status Interview", key: "interviewStatus", width: 18 },
    { header: "Mode Kerja", key: "mode", width: 14 },
    { header: "Lokasi / Domisili", key: "location", width: 22 },
    { header: "Asal Kampus / Sekolah", key: "institution", width: 26 },
    { header: "No. WhatsApp", key: "phone", width: 18 },
    { header: "Email", key: "email", width: 26 },
    { header: "Log Aktivitas Terakhir", key: "lastLog", width: 32 },
    { header: "Catatan / Alasan", key: "notes", width: 30 },
  ];

  const rows = filtered.map((c, index) => {
    const basic = c.basic_info || {};
    const scouting = c.scouting_info || {};
    const contact = c.contact_info || {};
    const internship = c.internship || c.internship_info || {};
    const education = c.education_info || c.education || {};
    const recruitment = c.recruitment_status || c.recruitment_system || {};

    const name =
      basic.full_name ||
      scouting.full_name ||
      c.name ||
      c.full_name ||
      "-";

    const position =
      c.role_name ||
      internship.position_name ||
      scouting.position_name ||
      scouting.role_name ||
      c.position_name ||
      c.position ||
      "-";

    const stat =
      recruitment.current ||
      recruitment.status ||
      c.status ||
      "Screening";

    const createdTs =
      c.created_at ||
      c.createdAt ||
      c.timestamp ||
      c.applied_at;

    // Interviewer lookup via usersMap
    const interviewerIds = Array.isArray(c.interviewers)
      ? c.interviewers.filter(Boolean)
      : (Array.isArray(c.interviewerIds) ? c.interviewerIds.filter(Boolean) : []);

    const interviewerNames = interviewerIds
      .map((uid) => usersMap[uid]?.name || uid)
      .filter(Boolean);

    const interviewer = interviewerNames.length
      ? interviewerNames.join(", ")
      : (c.interviewer_name || c.interviewer || "-");

    // Interview schedule & status formatting
    const rawSched =
      recruitment.interview_schedule ||
      recruitment.due_date ||
      c.interview_schedule ||
      c.interviewScheduleRaw ||
      null;

    let interviewSchedule = "-";
    let interviewStatus = "-";

    if (rawSched && rawSched !== "-") {
      const dObj = toDateObj(rawSched);
      if (dObj) {
        interviewSchedule = formatInterviewScheduleLabel(dObj);
        const st = getInterviewScheduleStatus(dObj);
        interviewStatus = st === "completed" ? "Completed" : (st === "today" ? "Hari Ini (Today)" : "Scheduled / Upcoming");
      } else if (typeof rawSched === "string") {
        interviewSchedule = rawSched;
        interviewStatus = "Scheduled";
      }
    }

    // Mode & Location
    const mode = (c.mode || internship.mode || c.work_mode || "-").toString().toUpperCase();
    const location = contact.address || contact.city || internship.address || c.address || c.city || c.location || "-";

    const inst =
      education.institution ||
      education.campus ||
      education.university ||
      education.school ||
      internship.campus ||
      c.campus ||
      c.university ||
      "-";

    const phone =
      contact.phone ||
      contact.whatsapp ||
      basic.whatsapp ||
      basic.phone ||
      c.whatsapp ||
      c.phone ||
      "-";

    const email =
      contact.email ||
      basic.email ||
      internship.email ||
      c.email ||
      "-";

    // Activity Log & Notes
    let lastLog = "-";
    let notes = "-";

    const logsArr = Array.isArray(c.logs) ? c.logs : [];
    const histArr = Array.isArray(recruitment.history) ? recruitment.history : [];

    if (logsArr.length > 0) {
      const lastEntry = logsArr[logsArr.length - 1] || {};
      const byName = lastEntry.by || "Admin";
      const logDate = lastEntry.date ? formatDateIndo(lastEntry.date, true) : "";
      const action = lastEntry.action || lastEntry.to || "Update";
      lastLog = logDate ? `${action} oleh ${byName} (${logDate})` : `${action} oleh ${byName}`;
      if (lastEntry.notes) {
        notes = lastEntry.notes;
      }
    } else if (histArr.length > 0) {
      const lastEntry = histArr[histArr.length - 1] || {};
      const byName = lastEntry.by || "Admin";
      const histDate = lastEntry.date ? formatDateIndo(lastEntry.date, true) : "";
      const st = lastEntry.status || "Update";
      lastLog = histDate ? `${st} oleh ${byName} (${histDate})` : `${st} oleh ${byName}`;
    } else if (recruitment.final_decision_at) {
      const decDate = formatDateIndo(recruitment.final_decision_at, true);
      const decStatus = recruitment.final_decision || recruitment.finalDecision || stat;
      lastLog = `${decStatus.toUpperCase()} (${decDate})`;
    }

    const reason = recruitment.rejection_reason || recruitment.rejection_notes || recruitment.withdrawn_notes || "";
    if (reason) {
      notes = notes !== "-" ? `${notes} | ${reason}` : reason;
    }

    return {
      no: index + 1,
      category: c.categoryLabel || "-",
      id: c.id,
      name,
      position,
      status: stat.toUpperCase(),
      createdAt: formatDateIndo(createdTs, true),
      interviewer,
      interviewSchedule,
      interviewStatus,
      mode,
      location,
      institution: inst,
      phone,
      email,
      lastLog,
      notes,
    };
  });

  const catSuffix = category === "all" ? "Semua_Kategori" : category.toUpperCase();
  const filename = `Data_Kandidat_${catSuffix}_${periodLabel}`;

  await downloadExportFile({
    filename,
    sheetName: "Data Kandidat",
    columns,
    rows,
    format,
  });

  return { count: rows.length, filename };
}

