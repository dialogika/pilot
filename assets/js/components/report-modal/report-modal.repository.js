// assets/js/components/report-modal/report-modal.repository.js
// =====================================================================
// REPORT MODAL REPOSITORY — Data access layer for Quest Report Approval.
//
// Rules:
//  - ONLY module communicating with Firebase Firestore and Storage for reports.
//  - NO direct DOM manipulation here.
// =====================================================================

import {
  db,
  storage,
  auth,
} from "../../firebase-config.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

function normalizeTimeValue(v) {
  if (!v) return "";
  if (v.toDate && typeof v.toDate === "function") {
    const d = v.toDate();
    if (!isNaN(d.getTime())) return d.toISOString();
    return "";
  }
  if (typeof v === "number") {
    const d2 = new Date(v);
    if (!isNaN(d2.getTime())) return d2.toISOString();
    return "";
  }
  return String(v);
}

function normalizeDateString(v, fallback) {
  const s = normalizeTimeValue(v);
  if (s) {
    if (s.length >= 10 && s.indexOf("T") >= 0) return s.slice(0, 10);
    if (s.length >= 10) return s.slice(0, 10);
  }
  return fallback || "";
}

/**
 * Load all users into a map { uid: { uid, name, photo, email } }.
 */
export async function loadUsersMap() {
  const map = {};
  try {
    const snap = await getDocs(collection(db, "users"));
    snap.forEach((docSnap) => {
      const u = docSnap.data() || {};
      map[docSnap.id] = {
        uid: docSnap.id,
        name: u.full_name || u.displayName || u.name || u.email || docSnap.id,
        email: u.email || "",
        photo: u.photo || u.photoURL || u.avatar || "",
      };
    });
  } catch (e) {
    console.warn("report-modal: users collection unreadable:", e);
  }
  return map;
}

/**
 * Load all quest reports and associate them with tasks.
 */
export async function loadReportsData() {
  const tasksById = {};
  const taskQuestTypeById = {};
  const completeTaskIds = [];

  try {
    const tasksSnap = await getDocs(collection(db, "tasks"));
    tasksSnap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      tasksById[docSnap.id] = data;
      const archived = !!(data.archived || data.is_archived);
      if (archived) return;

      let questType = "Side Quest";
      if (data.project_id) questType = "Project Quest";
      else if (data.recur) questType = "Main Quest";
      taskQuestTypeById[docSnap.id] = questType;

      completeTaskIds.push(docSnap.id);
    });
  } catch (e) {
    console.warn("report-modal: tasks collection unreadable:", e);
  }

  const latestByTaskId = {};

  // 1. Fetch from root collection quest_reports
  try {
    const rootSnap = await getDocs(collection(db, "quest_reports"));
    rootSnap.forEach((repSnap) => {
      const rdataRoot = repSnap.data() || {};
      const taskIdRoot = rdataRoot.taskId || rdataRoot.task_id || "";
      if (!taskIdRoot || !taskQuestTypeById[taskIdRoot]) return;
      const prevRoot = latestByTaskId[taskIdRoot];
      const prevTimeRoot = prevRoot
        ? normalizeTimeValue(
            prevRoot.data.submittedAt ||
              prevRoot.data.createdAt ||
              prevRoot.data.timestamp
          )
        : "";
      const currTimeRoot = normalizeTimeValue(
        rdataRoot.submittedAt || rdataRoot.createdAt || rdataRoot.timestamp
      );
      if (!prevRoot || currTimeRoot > prevTimeRoot) {
        latestByTaskId[taskIdRoot] = {
          data: rdataRoot,
          source: "root",
          docId: repSnap.id,
        };
      }
    });
  } catch (e) {
    console.warn("report-modal: quest_reports root collection unreadable:", e);
  }

  // 2. Fetch from subcollection tasks/{taskId}/reports with concurrency pool
  async function fetchLatestSubReport(tId) {
    try {
      const repSnap = await getDocs(collection(db, "tasks", tId, "reports"));
      repSnap.forEach((docRep) => {
        const rdata = docRep.data() || {};
        const prev = latestByTaskId[tId];
        const prevTime = prev
          ? normalizeTimeValue(
              prev.data.submittedAt ||
                prev.data.createdAt ||
                prev.data.timestamp
            )
          : "";
        const currTime = normalizeTimeValue(
          rdata.submittedAt || rdata.createdAt || rdata.timestamp
        );

        if (!prev || currTime >= prevTime || prev.source === "root") {
          latestByTaskId[tId] = {
            data: rdata,
            source: "sub",
            docId: docRep.id,
          };
        }
      });
    } catch (e) {
      // Subcollection missing or permission is fine
    }
  }

  let cursor = 0;
  const concurrency = 4;
  const workers = [];
  for (let w = 0; w < concurrency; w++) {
    workers.push(
      (async () => {
        while (cursor < completeTaskIds.length) {
          const idx = cursor++;
          const tId = completeTaskIds[idx];
          await fetchLatestSubReport(tId);
        }
      })()
    );
  }
  await Promise.all(workers);

  // 3. Format structured report items
  const reports = [];
  Object.keys(latestByTaskId).forEach((taskId) => {
    const entry = latestByTaskId[taskId] || {};
    const rdata = entry.data || {};
    const data = tasksById[taskId] || {};
    const questType = taskQuestTypeById[taskId] || "Side Quest";

    const notifyRaw = data.notify_to || data.notifyTo || [];
    const notifyIds = Array.isArray(notifyRaw)
      ? notifyRaw.slice()
      : notifyRaw
      ? [notifyRaw]
      : [];

    const assignRaw = data.assign_to || data.assignTo || [];
    const assignIds = Array.isArray(assignRaw)
      ? assignRaw.slice()
      : assignRaw
      ? [assignRaw]
      : [];

    const title = data.title || "Untitled Task";
    const reportHtml = rdata.content || "";
    const tmpDiv = document.createElement("div");
    tmpDiv.innerHTML = reportHtml;
    const reportText = (tmpDiv.textContent || tmpDiv.innerText || "").trim();
    const previewMax = 140;
    let previewText = reportText;
    if (previewText.length > previewMax) {
      previewText = previewText.substring(0, previewMax).replace(/\s+\S*$/, "") + "...";
    }

    const submittedAt = rdata.submittedAt || rdata.createdAt || "";
    let dateStr = normalizeDateString(submittedAt, "");
    if (!dateStr) {
      dateStr = data.due_date || data.dueDate || "";
    }

    const filesArr = Array.isArray(rdata.files) ? rdata.files : [];
    if (filesArr.length === 0) {
      const legacyUrl = rdata.fileUrl || rdata.file_url || rdata.url || "";
      const legacyName = rdata.fileName || rdata.file_name || rdata.name || "Attachment";
      if (legacyUrl && legacyUrl !== "#") {
        filesArr.push({
          url: legacyUrl,
          name: legacyName,
          type: rdata.fileType || rdata.type || "",
        });
      }
    }

    let fileName = "";
    let fileTitle = "";
    let fileUrl = "#";
    let fileIconClass = "bi bi-file-earmark";
    if (filesArr.length > 0) {
      const f = filesArr[0];
      fileName = f.name || "Attachment";
      fileTitle = f.name || "";
      fileUrl = f.url || "#";
      const ttype = String(f.type || "").toLowerCase();
      if (ttype.includes("pdf")) {
        fileIconClass = "bi bi-file-earmark-pdf text-danger";
      } else if (ttype.includes("zip") || ttype.includes("rar") || ttype.includes("7z")) {
        fileIconClass = "bi bi-file-earmark-zip text-warning";
      } else if (ttype.startsWith("image/")) {
        fileIconClass = "bi bi-file-earmark-image text-primary";
      }
      if (filesArr.length > 1) {
        fileName += ` (+${filesArr.length - 1})`;
      }
    }

    const appr = String(rdata.approval_status || rdata.approvalStatus || "").toLowerCase();
    const statusVal = appr === "approved" || appr === "rejected" ? appr : "pending";

    reports.push({
      id: taskId,
      questType: questType,
      date: dateStr,
      task: title,
      taskShort: title.length > 20 ? title.substring(0, 17) + "..." : title,
      reportPreview: previewText,
      reportPreviewFull: reportText,
      reportFull: reportHtml,
      fileName: fileName,
      fileTitle: fileTitle,
      fileUrl: fileUrl,
      fileIconClass: fileIconClass,
      files: filesArr,
      status: statusVal,
      notifyTo: notifyIds,
      notifyCount: notifyIds.length,
      assignees: assignIds,
      departments: Array.isArray(data.departments) ? data.departments : [],
      positions: Array.isArray(data.positions) ? data.positions : [],
      startDate: data.start_date || data.startDate || "",
      dueDate: data.due_date || data.dueDate || "",
      points: typeof data.points === "number" ? data.points : Number(data.points) || 0,
      priority: data.priority || "normal",
      description: data.description || "",
      reportSource: entry.source || "root",
      reportDocId: entry.docId || "",
    });
  });

  return reports;
}

/**
 * Persist approve or reject status for a report.
 */
export async function persistApprovalStatus(report, status, feedbackHtml = "") {
  if (!report) return;
  const payload = {
    approval_status: status,
    approvalStatus: status,
    approvalUpdatedAt: serverTimestamp ? serverTimestamp() : new Date().toISOString(),
  };

  if (feedbackHtml) {
    payload.feedback = feedbackHtml;
    payload.feedback_at = serverTimestamp ? serverTimestamp() : new Date().toISOString();
    payload.feedback_by = auth.currentUser ? auth.currentUser.uid : "";
  }

  if (report.reportSource === "root" && report.reportDocId) {
    await updateDoc(doc(db, "quest_reports", report.reportDocId), payload);
  } else if (report.reportSource === "sub" && report.reportDocId) {
    await updateDoc(doc(db, "tasks", report.id, "reports", report.reportDocId), payload);
  }
}

/**
 * Upload attachments for report feedback.
 */
export async function uploadFeedbackFiles(taskId, files) {
  if (!files || !files.length) return [];
  const out = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    try {
      const path = `report_feedback/${taskId}/${Date.now()}_${f.name}`;
      const sRef = ref(storage, path);
      await uploadBytes(sRef, f);
      const url = await getDownloadURL(sRef);
      out.push({ name: f.name, url: url, type: f.type || "" });
    } catch (e) {
      console.warn("Failed to upload feedback file:", e);
    }
  }
  return out;
}

/**
 * Archive selected task IDs.
 */
export async function bulkArchiveTasks(taskIds) {
  for (const taskId of taskIds) {
    let taskData = {};
    try {
      const tSnap = await getDoc(doc(db, "tasks", taskId));
      if (tSnap.exists()) taskData = tSnap.data() || {};
    } catch (e) {}

    const archiveEntry = {
      taskId: taskId,
      task: taskData,
      archivedAt: serverTimestamp ? serverTimestamp() : new Date().toISOString(),
      archivedBy: auth.currentUser ? auth.currentUser.uid : "",
    };

    try {
      await addDoc(collection(db, "Archives"), archiveEntry);
    } catch (e) {}

    await updateDoc(doc(db, "tasks", taskId), {
      archived: true,
      archived_at: serverTimestamp ? serverTimestamp() : new Date().toISOString(),
      archived_by: auth.currentUser ? auth.currentUser.uid : "",
    });
  }
}

/**
 * Delete selected task IDs.
 */
export async function bulkDeleteTasks(taskIds) {
  const rootSnap = await getDocs(collection(db, "quest_reports"));
  const rootDocs = [];
  rootSnap.forEach((d) => rootDocs.push({ id: d.id, data: d.data() || {} }));

  for (const tId of taskIds) {
    let tData = {};
    try {
      const tSnap = await getDoc(doc(db, "tasks", tId));
      if (tSnap.exists()) tData = tSnap.data() || {};
    } catch (e) {}

    const trashEntry = {
      taskId: tId,
      task: tData,
      deletedAt: serverTimestamp ? serverTimestamp() : new Date().toISOString(),
      deletedBy: auth.currentUser ? auth.currentUser.uid : "",
    };

    try {
      await addDoc(collection(db, "Trash"), trashEntry);
    } catch (e) {}

    try {
      const repSnap = await getDocs(collection(db, "tasks", tId, "reports"));
      for (const d of repSnap.docs) {
        await deleteDoc(doc(db, "tasks", tId, "reports", d.id));
      }
    } catch (e) {}

    for (const d2 of rootDocs) {
      const tid = d2.data.taskId || d2.data.task_id || "";
      if (tid === tId) {
        await deleteDoc(doc(db, "quest_reports", d2.id));
      }
    }

    await deleteDoc(doc(db, "tasks", tId));
  }
}
