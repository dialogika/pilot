// pages/hr/intern-satisfaction/intern-satisfaction.repository.js
// =====================================================================
// INTERN SATISFACTION REPOSITORY
// Data access layer for Intern Satisfaction Survey.
// Strictly NO DOM manipulation or UI rendering here.
// =====================================================================

import { db } from "/assets/js/firebase-config.js";
import {
  collection,
  getDocs,
  getDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const COLLECTION_NAME = "internship_satisfaction_survey";

/**
 * Category & question definitions for the satisfaction survey.
 */
export const SURVEY_CATEGORIES = [
  {
    id: "self_performance",
    title: "Penilaian Performa Diri",
    short: "Self Performance",
    icon: "bi-person-check-fill",
    ratings: [
      { id: "task_comprehension", label: "Kemampuan Memahami & Menyelesaikan Tugas" },
      { id: "communication_collaboration", label: "Komunikasi & Kolaborasi" },
      { id: "learning_adaptability_initiative", label: "Rasa Ingin Belajar, Adaptasi, Kreatif & Inisiatif" },
      { id: "time_management_prioritization", label: "Mengatur Waktu & Prioritas" },
    ],
    essays: [
      { id: "biggest_achievement_challenge", label: "Pencapaian dan tantangan terbesar selama internship" },
      { id: "new_skills_learned", label: "Keterampilan atau pengetahuan baru yang dipelajari" },
      { id: "most_valuable_project", label: "Tugas atau proyek paling berharga beserta alasannya" },
    ],
  },
  {
    id: "team_satisfaction",
    title: "Penilaian Kepuasan Tim",
    short: "Team Satisfaction",
    icon: "bi-people-fill",
    ratings: [
      { id: "communication_coordination_support", label: "Komunikasi, Koordinasi & Dukungan Tim" },
      { id: "openness_guidance", label: "Keterbukaan Tim & Bimbingan" },
      { id: "relationship_appreciation", label: "Hubungan Kerja & Dihargai" },
    ],
    essays: [
      { id: "liked_and_challenges", label: "Hal yang paling disukai sekaligus tantangan bersama tim" },
      { id: "team_improvements", label: "Hal yang masih dapat ditingkatkan dari tim" },
    ],
  },
  {
    id: "overall_assessment",
    title: "Penilaian Umum",
    short: "Overall Assessment",
    icon: "bi-clipboard-check-fill",
    ratings: [
      { id: "satisfaction", label: "Tingkat Kepuasan Keseluruhan" },
    ],
    essays: [],
  },
];

/**
 * Benchmark survey records matching production state (Image 2), used as fallback
 * when local test accounts lack Firestore Security Rules custom claims.
 */
/**
 * Fetch all survey responses directly from Dialogika Firestore database.
 * @returns {Promise<Array<Object>>}
 */
export async function getSurveys() {
  try {
    const snap = await getDocs(collection(db, COLLECTION_NAME));
    const results = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      // Include any valid survey document in the collection
      results.push({
        id: docSnap.id,
        ...data,
      });
    });

    return results;
  } catch (error) {
    console.warn("[InternSatisfaction Repo] Firestore query result:", error?.message || error);
    return [];
  }
}

/**
 * Fetch user photos directly from users collection for given user IDs.
 * @param {Array<string>} userIds
 * @returns {Promise<Map<string, string>>}
 */
export async function getUserPhotos(userIds) {
  const photoMap = new Map();
  const uniqueIds = [...new Set(userIds.filter(Boolean))];

  await Promise.all(
    uniqueIds.map(async (uid) => {
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
          const userData = snap.data() || {};
          const photoUrl = userData.photo || userData.Photo || userData.avatar || "";
          photoMap.set(uid, photoUrl);
        } else {
          photoMap.set(uid, "");
        }
      } catch (err) {
        console.warn(`Could not load photo for user ${uid}:`, err);
        photoMap.set(uid, "");
      }
    })
  );

  return photoMap;
}
