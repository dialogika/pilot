// assets/js/components/sidebar/sidebar.repository.js
// =====================================================================
// SIDEBAR DATA ACCESS — the ONLY sidebar module that talks to Firebase.
//
// Responsibilities:
//  - Compute live smart-filter counts (Main Quest / Side Quest /
//    Project / Report) from the Quest feature collections `tasks` and
//    `quest_reports`.
//
// RULES:
//  - NO DOM manipulation, NO rendering here.
//  - Uses the single Firebase init from assets/js/firebase-config.js.
//  - This is the documented (and only) place the shared sidebar reads
//    Quest feature data — see the SMART_FILTERS contract in
//    sidebar.config.js. If the Quest collections change, update the
//    contract + this module together, never the UI.
// =====================================================================

import { db } from "../../firebase-config.js";
import {
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function normalizeStatus(raw) {
  let s = "";
  if (typeof raw === "string") s = raw;
  else if (raw && typeof raw === "object") s = raw.name || raw.label || "";
  return String(s || "").trim().toLowerCase().replace(/[\s_]/g, "");
}

function timeKey(v) {
  if (!v) return "";
  if (v.toDate && typeof v.toDate === "function") {
    const d = v.toDate();
    if (!isNaN(d.getTime())) return d.toISOString();
    return "";
  }
  if (typeof v === "number") {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString();
    return "";
  }
  return String(v);
}

/**
 * Compute the sidebar smart-filter counts.
 * Mirrors legacy element/sidebar.js refreshSidebarCounts.
 * @returns {Promise<{mainQuest:number,sideQuest:number,project:number,report:number}>}
 */
export async function getSidebarCounts() {
  const counts = { mainQuest: 0, sideQuest: 0, project: 0, report: 0 };

  try {
    const tasksSnap = await getDocs(collection(db, "tasks"));

    let totalMain = 0;
    let totalSide = 0;
    const completeIds = [];
    const completeSet = {};

    tasksSnap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      // Projects are excluded from quest counts (mirrors legacy).
      if (data.project_id || data.projectId) return;

      const archived = !!(data.archived || data.is_archived);
      const normStatus = normalizeStatus(data.status);
      const normTaskStatus = normalizeStatus(data.task_status);
      const isComplete =
        normStatus === "complete" ||
        normStatus === "done" ||
        normTaskStatus === "complete" ||
        normTaskStatus === "done";

      if (data.recur && !isComplete && !archived) totalMain++;

      const rawType = String(data.type || "").toLowerCase();
      const isSideQuest =
        rawType === "sidequest" ||
        rawType === "side-quest" ||
        normStatus === "sidequest" ||
        !!data.task_status;
      if (isSideQuest && !isComplete && !archived) totalSide++;

      if (isComplete && !archived) {
        completeIds.push(docSnap.id);
        completeSet[docSnap.id] = true;
      }
    });

    // Legacy never updates the Project card count (stays "0"), so the
    // shell does not compute it either — parity-first.
    counts.mainQuest = totalMain;
    counts.sideQuest = totalSide;
    counts.project = 0;

    // --- Report Pending Approval (mirrors legacy) ---
    let pendingCount = 0;
    const latestByTaskId = {};

    const rootSnap = await getDocs(collection(db, "quest_reports"));
    rootSnap.forEach((repSnap) => {
      const r = repSnap.data() || {};
      const taskId = r.taskId || r.task_id || "";
      if (!taskId || !completeSet[taskId]) return;
      const prev = latestByTaskId[taskId];
      const prevTime = prev ? String(prev._time || "") : "";
      const currTime = timeKey(
        r.submittedAt || r.createdAt || r.timestamp || "",
      );
      if (!prev || currTime > prevTime) {
        latestByTaskId[taskId] = { data: r, _time: currTime };
      }
    });

    const tasksToFetchSub = completeIds.filter((id) => !latestByTaskId[id]);
    if (tasksToFetchSub.length > 0) {
      const batchSize = 10;
      for (let i = 0; i < tasksToFetchSub.length; i += batchSize) {
        const batch = tasksToFetchSub.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (taskId) => {
            try {
              const repSnap = await getDocs(
                collection(db, "tasks", taskId, "reports"),
              );
              repSnap.forEach((docRep) => {
                const r = docRep.data() || {};
                const prev = latestByTaskId[taskId];
                const prevTime = prev ? String(prev._time || "") : "";
                const currTime = timeKey(
                  r.submittedAt || r.createdAt || r.timestamp || "",
                );
                if (!prev || currTime > prevTime) {
                  latestByTaskId[taskId] = { data: r, _time: currTime };
                }
              });
            } catch (e) {
              /* subcollection missing is fine */
            }
          }),
        );
      }
    }

    for (let j = 0; j < completeIds.length; j++) {
      const tid = completeIds[j];
      const entry = latestByTaskId[tid];
      if (!entry || !entry.data) continue;
      const appr = (
        entry.data.approval_status ||
        entry.data.approvalStatus ||
        ""
      ).toLowerCase();
      if (appr !== "approved") pendingCount++;
    }
    counts.report = pendingCount;
  } catch (e) {
    console.warn("sidebar: failed to refresh counts:", e);
  }

  return counts;
}