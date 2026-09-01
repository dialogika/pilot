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
