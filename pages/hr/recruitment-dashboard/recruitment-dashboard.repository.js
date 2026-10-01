// pages/hr/recruitment-dashboard/recruitment-dashboard.repository.js
// =====================================================================
// RECRUITMENT DASHBOARD REPOSITORY — data access layer.
//
// All Firestore reads/writes for the Recruitment Dashboard live here.
// This module MUST NOT touch the DOM.
// =====================================================================

import { db } from "/assets/js/firebase-config.js";
import {
  getDocs,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  doc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  downloadExportFile,
  calcDateRange,
  extractTimestamp,
  formatDateIndo,
} from "/assets/js/utils/export-helper.js";

// ── Section config (with fallbacks for singular/plural collections) ─
export const SECTION_CONFIG = {
  team: {
    label: "Team",
    title: "Team Recruitment",
    screeningCollection: "teams_screening",
    fallbackScreeningCollection: "team_screening",
    memberCollection: "team_management",
    fallbackMemberCollection: "teams",
  },
  mentor: {
    label: "Mentor",
    title: "Mentor Recruitment",
    screeningCollection: "mentors_screening",
    fallbackScreeningCollection: "mentor_screening",
    memberCollection: "mentor",
    fallbackMemberCollection: "mentors",
  },
  internship: {
    label: "Internship",
    title: "Internship Recruitment",
    screeningCollection: "interns_screening",
    fallbackScreeningCollection: "intern_screening",
    memberCollection: "users",
    userRoles: ["Internship", "internship", "intern"],
  },
};

// ── Caches ──────────────────────────────────────────────────────────
let usersMap = null;
let positionsMap = null;

/**
 * Build a map of userId → display name from the `users` collection.
 * Cached after first call.
 */
export async function loadUsersMap() {
  if (usersMap) return usersMap;
  usersMap = {};
  try {
    const snap = await getDocs(collection(db, "users"));
    snap.forEach((ds) => {
      const d = ds.data() || {};
      usersMap[ds.id] =
        (d.full_name || d.displayName || d.name || d.nama || d.email || "")
          .toString()
          .trim() || "User Tidak Ditemukan";
    });
  } catch (e) {
    console.warn("[Repository] Failed to build users map:", e);
  }
  return usersMap;
}

/**
 * Resolve an array of user UIDs to display names.
 */
export function resolveInterviewerNames(uids) {
  if (!uids || !uids.length) return "-";
  const map = usersMap || {};
  return uids
    .map((uid) => {
      if (typeof uid !== "string") return uid?.name || uid?.email || "-";
      return map[uid] || "User Tidak Ditemukan";
    })
    .join(", ");
}

/**
 * Build a map of positionId → position name from the `positions` collection.
 * Falls back to the `position` collection. Cached after first call.
 */
export async function loadPositionsMap() {
  if (positionsMap) return positionsMap;
  positionsMap = {};
  try {
    let snap = await getDocs(collection(db, "positions"));
    if (snap.empty) {
      try {
        snap = await getDocs(collection(db, "position"));
      } catch (e) {
        console.warn("[Repository] position fallback not readable:", e);
      }
    }
    if (!snap.empty) {
      snap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const name = (data.name || data.title || data.position_name || "").toString().trim();
        if (name) positionsMap[docSnap.id] = name;
      });
    }
  } catch (e) {
    console.warn("[Repository] Failed to build positions map:", e);
  }
  return positionsMap;
}

/**
 * Resolve a raw position value (possibly an ID) to a human-readable name.
 */
export function resolvePositionName(rawPosition) {
  if (!rawPosition || rawPosition === "-") return "-";
  if (positionsMap && positionsMap[rawPosition]) return positionsMap[rawPosition];
  return rawPosition;
}

// ── Resilient collection fetch with fallback ────────────────────────

/**
 * Fetch all documents from a Firestore collection with optional fallback collection.
 * Catches errors safely so a permission error on one collection doesn't break the entire dashboard.
 * @param {string} primaryCol
 * @param {string} [fallbackCol]
 * @returns {Promise<Array<{id: string, data: Object}>>}
 */
export async function fetchCollectionWithFallback(primaryCol, fallbackCol) {
  try {
    const snap = await getDocs(collection(db, primaryCol));
    if (!snap.empty) {
      const rows = [];
      snap.forEach((ds) => rows.push({ id: ds.id, data: ds.data() || {} }));
      return rows;
    }
    if (fallbackCol) {
      try {
        const fallbackSnap = await getDocs(collection(db, fallbackCol));
        const rows = [];
        fallbackSnap.forEach((ds) => rows.push({ id: ds.id, data: ds.data() || {} }));
        return rows;
      } catch (fallbackErr) {
        console.warn(`[Repository] Fallback collection ${fallbackCol} error:`, fallbackErr);
      }
    }
    return [];
  } catch (err) {
    console.warn(`[Repository] Error querying ${primaryCol}:`, err);
    if (fallbackCol) {
      try {
        const fallbackSnap = await getDocs(collection(db, fallbackCol));
        const rows = [];
        fallbackSnap.forEach((ds) => rows.push({ id: ds.id, data: ds.data() || {} }));
        return rows;
      } catch (fallbackErr) {
        console.warn(`[Repository] Fallback collection ${fallbackCol} error:`, fallbackErr);
      }
    }
    return [];
  }
}

/**
 * Fetch members for a given section (team / mentor / internship).
 */
export async function fetchSectionMembers(section) {
  const cfg = SECTION_CONFIG[section];
  if (!cfg) return [];

  if (section === "internship") {
    try {
      const snap = await getDocs(
        query(collection(db, "users"), where("role", "in", cfg.userRoles))
      );
      const rows = [];
      snap.forEach((ds) => rows.push({ id: ds.id, data: ds.data() || {} }));
      return rows;
    } catch (e) {
      console.warn("[Repository] Error fetching internship users:", e);
      return [];
    }
  }

  return fetchCollectionWithFallback(cfg.memberCollection, cfg.fallbackMemberCollection);
}

/**
 * Fetch screening candidates for ALL sections safely.
 * Uses individual error isolation so that failure in one collection doesn't block others.
 * @returns {Promise<Object>} keyed by section name, value is array of raw doc items.
 */
export async function fetchAllScreening() {
  const results = {};
  for (const [s, c] of Object.entries(SECTION_CONFIG)) {
    try {
      const rows = await fetchCollectionWithFallback(
        c.screeningCollection,
        c.fallbackScreeningCollection
      );
      results[s] = rows;
    } catch (e) {
      console.warn(`[Repository] Failed to fetch screening for ${s}:`, e);
      results[s] = [];
    }
  }
  return results;
}

// ── Recruitment Notes ───────────────────────────────────────────────

const recruitmentNotesRef = doc(db, "recruitment_dashboard_notes", "default");

/**
 * Load the important notes content from Firestore.
 * @returns {Promise<string>} the notes content, or empty string.
 */
export async function loadRecruitmentNotes() {
  try {
    const snap = await getDoc(recruitmentNotesRef);
    if (!snap.exists()) return "";
    return ((snap.data() || {}).content || "").toString().trim();
  } catch (error) {
    console.warn("[Repository] Failed to load recruitment notes:", error);
    return "";
  }
}

/**
 * Save the important notes content to Firestore.
 */
export async function saveRecruitmentNotes(content, userEmail) {
  await setDoc(
    recruitmentNotesRef,
    {
      content: content || "",
      updated_at: serverTimestamp(),
      updated_by: userEmail || null,
    },
    { merge: true }
  );
}

/**
 * Export Recruitment Dashboard data to Excel (.xlsx) or CSV (.csv).
 * @param {Object} options
 * @param {string} options.dataType - 'pipeline' | 'headcount' | 'contract'
 * @param {string} options.section - 'all' | 'team' | 'mentor' | 'internship'
 * @param {string} options.status - 'all' | 'screening' | 'interview' | 'micro_teaching' | 'accepted' | 'onboarding' | 'rejected' | 'canceled'
 * @param {string} options.rangeType - 'all' | 'month' | 'week'
 * @param {string} options.month
 * @param {string} options.weekMonth
 * @param {number} options.week
 * @param {string} options.format - 'xlsx' | 'csv'
 * @returns {Promise<{ count: number, filename: string }>}
 */
export async function exportRecruitmentData({
  dataType = "pipeline",
  section = "all",
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

  await loadUsersMap();
  await loadPositionsMap();

  let columns = [];
  let rows = [];
  let sheetName = "Data Rekrutmen";

  if (dataType === "headcount") {
    sheetName = "Head Count";
    columns = [
      { header: "No", key: "no", width: 6 },
      { header: "Section / Divisi", key: "section", width: 16 },
      { header: "ID Anggota", key: "id", width: 22 },
      { header: "Nama Lengkap", key: "name", width: 26 },
      { header: "Posisi / Role", key: "position", width: 24 },
      { header: "Email", key: "email", width: 26 },
      { header: "Status", key: "status", width: 16 },
    ];

    const sectionsToFetch = section === "all" ? ["team", "mentor", "internship"] : [section];
    const allMembers = [];

    for (const sec of sectionsToFetch) {
      try {
        const mems = await fetchSectionMembers(sec);
        mems.forEach((m) => {
          allMembers.push({ sec, id: m.id, ...(m.data || {}) });
        });
      } catch (err) {
        console.warn(`[exportRecruitmentData] Error fetching members for ${sec}:`, err);
      }
    }

    if (!allMembers.length) {
      throw new Error("Tidak ada data anggota / headcount ditemukan.");
    }

    rows = allMembers.map((m, idx) => {
      const secLabel = SECTION_CONFIG[m.sec]?.label || m.sec;
      const name = m.name || m.full_name || m.displayName || m.nama || "-";
      const pos = resolvePositionName(m.position || m.position_name || m.role || "-");
      const em = m.email || "-";
      const stat = m.status || m.state || "Active";
      return {
        no: idx + 1,
        section: secLabel,
        id: m.id,
        name,
        position: pos,
        email: em,
        status: stat.toString().toUpperCase(),
      };
    });
  } else if (dataType === "contract") {
    sheetName = "Kontrak Berakhir";
    columns = [
      { header: "No", key: "no", width: 6 },
      { header: "Section", key: "section", width: 16 },
      { header: "ID Anggota", key: "id", width: 22 },
      { header: "Nama Lengkap", key: "name", width: 26 },
      { header: "Posisi", key: "position", width: 24 },
      { header: "Tanggal Mulai", key: "startDate", width: 18 },
      { header: "Tanggal Selesai", key: "endDate", width: 18 },
      { header: "Status Kontrak", key: "contractStatus", width: 18 },
    ];

    const sectionsToFetch = section === "all" ? ["team", "mentor", "internship"] : [section];
    const allRows = [];

    for (const sec of sectionsToFetch) {
      try {
        const mems = await fetchSectionMembers(sec);
        mems.forEach((m) => {
          const d = m.data || {};
          const endTs = extractTimestamp(d.end_date || d.endDate || d.contract_end || d.contract_period?.end);
          if (endTs) {
            allRows.push({ sec, id: m.id, endTs, ...d });
          }
        });
      } catch (e) {
        console.warn(`[exportRecruitmentData] Error fetching contract members:`, e);
      }
    }

    let filteredContracts = allRows;
    if (rangeType !== "all") {
      filteredContracts = filteredContracts.filter((c) => c.endTs >= startTimestamp && c.endTs <= endTimestamp);
    }

    if (!filteredContracts.length) {
      throw new Error("Tidak ada data kontrak pada periode yang dipilih.");
    }

    rows = filteredContracts.map((c, idx) => {
      const secLabel = SECTION_CONFIG[c.sec]?.label || c.sec;
      const name = c.name || c.full_name || c.displayName || "-";
      const pos = resolvePositionName(c.position || c.position_name || c.role || "-");
      const startD = c.start_date || c.startDate || c.contract_start;
      const endD = c.end_date || c.endDate || c.contract_end;
      return {
        no: idx + 1,
        section: secLabel,
        id: c.id,
        name,
        position: pos,
        startDate: formatDateIndo(startD),
        endDate: formatDateIndo(endD),
        contractStatus: "Ending Soon",
      };
    });
  } else {
    // Pipeline kandidat
    sheetName = "Pipeline Rekrutmen";
    columns = [
      { header: "No", key: "no", width: 6 },
      { header: "Section", key: "section", width: 16 },
      { header: "ID Kandidat", key: "id", width: 22 },
      { header: "Nama Lengkap", key: "name", width: 26 },
      { header: "Posisi / Role", key: "position", width: 24 },
      { header: "Status Rekrutmen", key: "status", width: 18 },
      { header: "Jadwal Interview", key: "interviewSchedule", width: 20 },
      { header: "Interviewer", key: "interviewer", width: 24 },
      { header: "Tanggal Pendaftaran", key: "createdAt", width: 20 },
      { header: "Asal Kampus / Institusi", key: "institution", width: 26 },
      { header: "No. WhatsApp", key: "phone", width: 18 },
      { header: "Email", key: "email", width: 26 },
    ];

    const sectionsToFetch = section === "all" ? ["team", "mentor", "internship"] : [section];
    const allCandidates = [];

    for (const sec of sectionsToFetch) {
      const cfg = SECTION_CONFIG[sec];
      if (!cfg) continue;
      try {
        const rows = await fetchCollectionWithFallback(cfg.screeningCollection, cfg.fallbackScreeningCollection);
        rows.forEach((r) => {
          allCandidates.push({ sec, id: r.id, ...(r.data || {}) });
        });
      } catch (err) {
        console.warn(`[exportRecruitmentData] Error fetching screening for ${sec}:`, err);
      }
    }

    let filtered = allCandidates;

    if (status && status !== "all") {
      const sTerm = status.toLowerCase().trim();
      filtered = filtered.filter((item) => {
        const rec = item.recruitment_status || {};
        const cur = (rec.current || item.status || "screening").toString().toLowerCase().trim();
        const fd = (rec.final_decision || rec.finalDecision || "").toString().toLowerCase().trim();
        return cur === sTerm || fd === sTerm;
      });
    }

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

    rows = filtered.map((c, idx) => {
      const secLabel = SECTION_CONFIG[c.sec]?.label || c.sec;
      const basic = c.basic_info || {};
      const scouting = c.scouting_info || {};
      const internship = c.internship || c.internship_info || {};
      const education = c.education_info || c.education || {};
      const recruitment = c.recruitment_status || {};

      const name = basic.full_name || scouting.full_name || c.name || c.full_name || "-";
      const pos = resolvePositionName(c.role_name || internship.position_name || scouting.position_name || c.position_name || c.position || "-");
      const stat = recruitment.current || recruitment.status || c.status || "Screening";
      const sched = recruitment.interview_schedule || recruitment.due_date || c.interview_schedule || "-";
      const interviewers = resolveInterviewerNames(recruitment.interviewers || recruitment.interviewer_uids || c.interviewers || []);
      const inst = education.institution || education.campus || education.university || c.campus || "-";
      const phone = basic.whatsapp || basic.phone || c.whatsapp || c.phone || "-";
      const email = basic.email || c.email || "-";
      const createdTs = c.created_at || c.createdAt || c.timestamp;

      return {
        no: idx + 1,
        section: secLabel,
        id: c.id,
        name,
        position: pos,
        status: stat.toString().toUpperCase(),
        interviewSchedule: typeof sched === "string" ? sched : formatDateIndo(sched, true),
        interviewer: interviewers,
        createdAt: formatDateIndo(createdTs, true),
        institution: inst,
        phone,
        email,
      };
    });
  }

  const filename = `Data_Rekrutmen_${dataType.toUpperCase()}_${section.toUpperCase()}_${periodLabel}`;

  await downloadExportFile({
    filename,
    sheetName,
    columns,
    rows,
    format,
  });

  return { count: rows.length, filename };
}

