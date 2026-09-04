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
  arrayRemove,
  deleteField,
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
      const name = u.full_name || u.displayName || u.name || u.nama || u.email || docSnap.id;
      const photo = u.photo || u.photoURL || u.photoUrl || u.avatar || u.avatar_url || "";
      const email = String(u.email || "").trim();
      const authUid = u.uid || u.userId || u.user_id || u.id || docSnap.id;

      const allAliases = Array.from(
        new Set(
          [
            docSnap.id,
            String(docSnap.id).toLowerCase(),
            authUid,
            String(authUid).toLowerCase(),
            email,
            email.toLowerCase(),
            name,
          ].filter(Boolean)
        )
      );

      const userData = {
        uid: authUid,
        docId: docSnap.id,
        id: docSnap.id,
        name: name,
        email: email,
        photo: String(photo || "").trim(),
        allAliases: allAliases,
      };

      allAliases.forEach((alias) => {
        if (alias) {
          map[alias] = userData;
          map[String(alias).toLowerCase()] = userData;
        }
      });
    });
  } catch (e) {
    console.warn("report-modal: users collection unreadable:", e);
  }
  return map;
}

function isSideQuestTask(data) {
  if (!data) return false;
  if (data.project_id || data.projectId) return false;
  const qt = String(data.quest_type || data.questType || "")
    .toLowerCase()
    .replace(/[\s_]/g, "");
  if (qt === "side" || qt === "sidequest" || qt === "side-quest" || qt === "quest") return true;
  if (qt === "main" || qt === "mainquest" || qt === "daily") return false;
  const t = String(data.type || "")
    .toLowerCase()
    .replace(/[\s_]/g, "");
  if (t === "side" || t === "sidequest" || t === "side-quest" || t === "quest") return true;
  if (t === "main" || t === "mainquest" || t === "daily") return false;
  return false;
}

/**
 * Load all quest reports and associate them with tasks.
 */
export async function loadReportsData({ includeArchived = false } = {}) {
  const tasksById = {};
  const taskQuestTypeById = {};
  const completeTaskIds = [];

  function registerTaskDoc(docSnap) {
    if (!docSnap) return;
    const data = docSnap.data() || {};
    tasksById[docSnap.id] = data;
    const archived = !!(data.archived || data.is_archived);
    tasksById[docSnap.id]._isArchived = archived;

    let questType = "Daily";
    if (data.project_id || data.projectId) {
      questType = "Project";
    } else if (isSideQuestTask(data)) {
      questType = "Quest";
    } else {
      questType = "Daily";
    }
    taskQuestTypeById[docSnap.id] = questType;

    if (archived && !includeArchived) return;

    if (!completeTaskIds.includes(docSnap.id)) {
      completeTaskIds.push(docSnap.id);
    }
  }

  try {
    try {
      const snapQuests = await getDocs(collection(db, "quests"));
      snapQuests.forEach(registerTaskDoc);
    } catch (_) {}

    try {
      const snapTasks = await getDocs(collection(db, "tasks"));
      snapTasks.forEach(registerTaskDoc);
    } catch (_) {}
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

  // 3. Format structured report items from tasks & legacy reports
  const reports = [];
  Object.keys(latestByTaskId).forEach((taskId) => {
    const entry = latestByTaskId[taskId] || {};
    const rdata = entry.data || {};
    const data = tasksById[taskId] || {};
    const questType = taskQuestTypeById[taskId] || "Daily";

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

    const filesArr = Array.isArray(rdata.files) ? rdata.files.slice() : [];
    if (filesArr.length === 0) {
      const legacyUrl = rdata.fileUrl || rdata.file_url || rdata.url || "";
      const legacyName = rdata.fileName || rdata.file_name || rdata.name || "Attachment";
      if (legacyUrl && legacyUrl !== "#") {
        filesArr.push({
          url: legacyUrl,
          name: legacyName,
          type: rdata.fileType || rdata.type || "",
        });
      } else if (reportHtml && reportHtml.includes("<img")) {
        const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
        let match;
        let imgIdx = 1;
        while ((match = imgRegex.exec(reportHtml)) !== null) {
          if (match[1] && match[1] !== "#") {
            filesArr.push({
              url: match[1],
              name: imgIdx === 1 ? "Attachment Image" : `Attachment Image ${imgIdx}`,
              type: "image/png",
            });
            imgIdx++;
          }
        }
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
    const isArchived = !!(rdata.archived || rdata.is_archived || (tasksById[taskId] && tasksById[taskId]._isArchived));
    if (isArchived && !includeArchived) return; // skip archived unless requested

    const reportDocId = entry.docId || "";
    const rowId = entry.source === "sub"
      ? `sub_${taskId}_${reportDocId || "rep"}`
      : `root_${reportDocId || taskId}`;

    reports.push({
      id: rowId,
      taskId: taskId,
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
      status: isArchived ? "archived" : statusVal,
      archived: isArchived,
      notifyTo: notifyIds,
      notifyCount: notifyIds.length,
      assignees: assignIds,
      reportTo: Array.isArray(data.report_to) ? data.report_to : data.report_to ? [data.report_to] : [],
      createdBy: data.created_by || data.createdBy || "",
      authorId: rdata.userId || rdata.user_id || rdata.authorId || "",
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

  // 4. Fetch from modern intern_dailyreport collection
  try {
    const dailySnap = await getDocs(collection(db, "intern_dailyreport"));
    dailySnap.forEach((docSnap) => {
      const ddata = docSnap.data() || {};
      const tasks = Array.isArray(ddata.tasks) && ddata.tasks.length > 0 ? ddata.tasks : [ddata];
      const authorId = ddata.user_id || ddata.userId || ddata.author_id || "";
      const authorName = ddata.name || ddata.user_name || "Unknown";
      const repDate = ddata.date_label || ddata.report_date || ddata.date || normalizeDateString(ddata.created_at || ddata.timestamp, "");
      const repStatus = String(ddata.status || "").toLowerCase();
      tasks.forEach((t, idx) => {
        const taskId = t.task_id || t.taskId || t.id || "";
        const rowId = `daily_${docSnap.id}_${idx}`;
        const title = t.title || t.task || `Tugas ${idx + 1}`;
        const reportHtml = t.detail || t.description || t.content || "";
        const tmpDiv = document.createElement("div");
        tmpDiv.innerHTML = reportHtml;
        const reportText = (tmpDiv.textContent || tmpDiv.innerText || "").trim();
        const previewMax = 140;
        let previewText = reportText;
        if (previewText.length > previewMax) {
          previewText = previewText.substring(0, previewMax).replace(/\s+\S*$/, "") + "...";
        }

        // Determine quest type.
        // Check task detail item, parent report document, or catalog metadata.
        let questType = "Daily";
        const tQt = String(t.questType || t.quest_type || "").toLowerCase().replace(/[\s_]/g, "");
        const dQt = String(ddata.questType || ddata.quest_type || "").toLowerCase().replace(/[\s_]/g, "");

        // 1. Explicit marker on task item
        if (tQt === "project") {
          questType = "Project";
        } else if (tQt === "side" || tQt === "sidequest" || tQt === "side-quest" || tQt === "quest") {
          questType = "Quest";
        } else if (tQt === "daily" || tQt === "main" || tQt === "mainquest") {
          questType = "Daily";
        // 2. Explicit marker on parent report document
        } else if (dQt === "project") {
          questType = "Project";
        } else if (dQt === "side" || dQt === "sidequest" || dQt === "side-quest" || dQt === "quest") {
          questType = "Quest";
        } else if (dQt === "daily" || dQt === "main" || dQt === "mainquest") {
          questType = "Daily";
        // 3. Fallback to task catalog lookup
        } else if (taskId && taskQuestTypeById[taskId]) {
          questType = taskQuestTypeById[taskId];
        } else if (taskId && tasksById[taskId]) {
          const td = tasksById[taskId];
          if (td.project_id || td.projectId) {
            questType = "Project";
          } else if (isSideQuestTask(td)) {
            questType = "Quest";
          } else {
            questType = "Daily";
          }
        }

        // Status
        const taskStatus = String(t.status || "").toLowerCase();
        let statusVal = "pending";
        if (taskStatus === "approved" || repStatus === "approved") statusVal = "approved";
        else if (taskStatus === "rejected" || repStatus === "rejected") statusVal = "rejected";

        const isArchived = !!(ddata.archived || ddata.is_archived || t.archived);
        if (isArchived && !includeArchived) return; // skip archived unless requested

        // Files from images in content or explicit attachments
        const filesArr = Array.isArray(t.files) ? t.files.slice() : [];
        let fileName = "";
        let fileTitle = "";
        let fileUrl = "#";
        let fileIconClass = "bi bi-file-earmark";

        // Check for embedded <img> src in reportHtml if filesArr is empty
        if (filesArr.length === 0 && reportHtml && reportHtml.includes("<img")) {
          const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
          let match;
          let imgIdx = 1;
          while ((match = imgRegex.exec(reportHtml)) !== null) {
            if (match[1] && match[1] !== "#") {
              filesArr.push({
                url: match[1],
                name: imgIdx === 1 ? "Attachment Image" : `Attachment Image ${imgIdx}`,
                type: "image/png",
              });
              imgIdx++;
            }
          }
        }

        if (filesArr.length > 0) {
          const f = filesArr[0];
          fileName = f.name || "Attachment";
          fileTitle = f.name || "";
          fileUrl = f.url || "#";
          const ttype = String(f.type || "").toLowerCase();
          if (ttype.includes("pdf")) {
            fileIconClass = "bi bi-file-earmark-pdf text-danger";
          } else if (ttype.includes("zip") || ttype.includes("rar")) {
            fileIconClass = "bi bi-file-earmark-zip text-warning";
          } else if (ttype.startsWith("image/") || (f.url && f.url.startsWith("data:image/"))) {
            fileIconClass = "bi bi-file-earmark-image text-primary";
          }
          if (filesArr.length > 1) {
            fileName += ` (+${filesArr.length - 1})`;
          }
        }

        const rawReportTo = Array.isArray(t.report_to) && t.report_to.length
          ? t.report_to
          : (Array.isArray(ddata.report_to) ? ddata.report_to : ddata.report_to ? [ddata.report_to] : (t.report_to ? [t.report_to] : []));
        const reportToArr = Array.from(new Set((Array.isArray(rawReportTo) ? rawReportTo : [rawReportTo]).filter(Boolean)));

        const rawCreatedBy = Array.isArray(t.created_by) && t.created_by.length
          ? t.created_by
          : (Array.isArray(ddata.created_by) ? ddata.created_by : ddata.created_by ? [ddata.created_by] : (t.created_by ? [t.created_by] : []));
        const createdByArr = Array.from(new Set((Array.isArray(rawCreatedBy) ? rawCreatedBy : [rawCreatedBy]).filter(Boolean)));

        const finalAuthorId = authorId || (Array.isArray(t.who_did_this) ? t.who_did_this[0] : "") || "";

        reports.push({
          id: rowId,
          taskId: taskId,
          questType: questType,
          date: repDate,
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
          status: isArchived ? "archived" : statusVal,
          archived: isArchived,
          notifyTo: [],
          notifyCount: 0,
          assignees: [finalAuthorId || authorName],
          reportTo: reportToArr,
          createdBy: createdByArr,
          authorId: finalAuthorId,
          departments: ddata.department ? [ddata.department] : [],
          positions: ddata.position ? [ddata.position] : [],
          startDate: repDate,
          dueDate: repDate,
          points: Number(t.points) || 0,
          priority: "normal",
          description: title,
          reportSource: "intern_dailyreport",
          reportDocId: docSnap.id,
          taskIndex: idx,
          rawTask: t,
          raw: t,
        });
      });
    });
  } catch (e) {
    console.warn("report-modal: intern_dailyreport collection unreadable:", e);
  }

  return reports;
}

/**
 * Persist approve or reject status for a report.
 */
export async function persistApprovalStatus(report, status, feedbackHtml = "") {
  if (!report) return;
  const isApprove = String(status).toLowerCase() === "approved";
  const newStatusStr = isApprove ? "Approved" : "Rejected";
  const normStatus = isApprove ? "approved" : "rejected";

  const payload = {
    approval_status: normStatus,
    approvalStatus: normStatus,
    approvalUpdatedAt: serverTimestamp ? serverTimestamp() : new Date().toISOString(),
  };

  if (feedbackHtml) {
    payload.feedback = feedbackHtml;
    payload.rejection_reason = feedbackHtml;
    payload.feedback_at = serverTimestamp ? serverTimestamp() : new Date().toISOString();
    payload.feedback_by = auth.currentUser ? auth.currentUser.uid : "";
  }

  if (report.reportSource === "intern_dailyreport" && report.reportDocId) {
    try {
      const repRef = doc(db, "intern_dailyreport", report.reportDocId);
      const repSnap = await getDoc(repRef);
      if (repSnap.exists()) {
        const repData = repSnap.data() || {};
        const tasks = Array.isArray(repData.tasks) ? repData.tasks : [];

        if (typeof report.taskIndex === "number" && tasks[report.taskIndex]) {
          tasks[report.taskIndex].status = newStatusStr;
          tasks[report.taskIndex].approval_status = normStatus;
          if (feedbackHtml) tasks[report.taskIndex].feedback = feedbackHtml;
          tasks[report.taskIndex].rejection_reason = isApprove ? "" : (feedbackHtml || "");
          tasks[report.taskIndex].reviewed_at = new Date().toISOString();
          tasks[report.taskIndex].reviewed_by = auth.currentUser ? auth.currentUser.uid : "";
        } else {
          tasks.forEach((t) => {
            const tId = t.task_id || t.taskId || t.id;
            if (tId === report.taskId || tId === report.id || t.title === report.task) {
              t.status = newStatusStr;
              t.approval_status = normStatus;
              if (feedbackHtml) t.feedback = feedbackHtml;
              t.rejection_reason = isApprove ? "" : (feedbackHtml || "");
              t.reviewed_at = new Date().toISOString();
              t.reviewed_by = auth.currentUser ? auth.currentUser.uid : "";
            }
          });
        }

        const allApproved = tasks.length > 0 && tasks.every((t) => String(t.status).toLowerCase() === "approved");
        const allRejected = tasks.length > 0 && tasks.every((t) => String(t.status).toLowerCase() === "rejected");
        let overallStatus = "Pending Review";
        if (allApproved) overallStatus = "Approved";
        else if (allRejected) overallStatus = "Rejected";
        else if (tasks.some((t) => String(t.status).toLowerCase() === "approved")) overallStatus = "Partially Approved";
        else if (tasks.some((t) => String(t.status).toLowerCase() === "rejected")) overallStatus = "Partially Rejected";

        await updateDoc(repRef, {
          tasks: tasks,
          status: overallStatus,
          reviewer_id: auth.currentUser ? auth.currentUser.uid : "",
          reviewer_name: auth.currentUser ? (auth.currentUser.displayName || auth.currentUser.email) : "",
          reviewed_at: serverTimestamp ? serverTimestamp() : new Date().toISOString(),
          ...(feedbackHtml ? { rejection_reason: feedbackHtml, feedback: feedbackHtml } : {}),
        });
      }
    } catch (e) {
      console.warn("Failed to persist approval status to intern_dailyreport:", e);
    }
  } else if (report.reportSource === "root" && report.reportDocId) {
    await updateDoc(doc(db, "quest_reports", report.reportDocId), payload);
  } else if (report.reportSource === "sub" && report.reportDocId) {
    const parentTaskId = report.taskId || report.id;
    await updateDoc(doc(db, "tasks", parentTaskId, "reports", report.reportDocId), payload);
  }

  // Update corresponding task doc in quests / tasks
  const rawTaskId =
    report.taskId ||
    (report.rawTask && (report.rawTask.task_id || report.rawTask.taskId || report.rawTask.id)) ||
    (report.raw && (report.raw.task_id || report.raw.taskId || report.raw.id)) ||
    (report.reportSource !== "intern_dailyreport" ? report.id : "");
  const targetTaskId = rawTaskId ? String(rawTaskId).trim() : "";

  if (targetTaskId) {
    const authorUid =
      report.authorId ||
      (report.rawTask && (report.rawTask.user_id || report.rawTask.userId || report.rawTask.author_id || (Array.isArray(report.rawTask.who_did_this) ? report.rawTask.who_did_this[0] : ""))) ||
      (report.raw && (report.raw.user_id || report.raw.userId || report.raw.author_id)) ||
      "";

    // Detect if task exists in quests or tasks
    let targetCollection = "quests";
    let isSingleAssignee = true;
    try {
      let taskSnap = null;
      try {
        taskSnap = await getDoc(doc(db, "quests", targetTaskId));
        if (taskSnap && taskSnap.exists()) targetCollection = "quests";
      } catch (_) {}
      if (!taskSnap || !taskSnap.exists()) {
        try {
          taskSnap = await getDoc(doc(db, "tasks", targetTaskId));
          if (taskSnap && taskSnap.exists()) targetCollection = "tasks";
        } catch (_) {}
      }
      if (taskSnap && taskSnap.exists()) {
        const td = taskSnap.data() || {};
        const assignList = Array.isArray(td.assign_to) ? td.assign_to : td.assign_to ? [td.assign_to] : [];
        isSingleAssignee = assignList.length <= 1;
      }
    } catch (_) {}

    const taskPatch = isApprove
      ? {
          status: "approved",
          task_status: "approved",
          last_approved_at: serverTimestamp ? serverTimestamp() : new Date().toISOString(),
          last_approved_by: auth.currentUser ? auth.currentUser.uid : "",
          rejection_reason: deleteField(),
          feedback: deleteField(),
          last_rejected_at: deleteField(),
          last_rejected_by: deleteField(),
          ...(authorUid ? { [`rejected_users.${authorUid}`]: deleteField() } : {}),
          // Store per-user approval so co-assignees can verify their own approval state
          ...(authorUid && !isSingleAssignee
            ? {
                [`approved_users.${authorUid}`]: {
                  approved_at: new Date().toISOString(),
                  approved_by: auth.currentUser ? auth.currentUser.uid : "",
                },
              }
            : {}),
        }
      : {
          status: "rejected",
          task_status: "rejected",
          last_rejected_at: serverTimestamp ? serverTimestamp() : new Date().toISOString(),
          last_rejected_by: auth.currentUser ? auth.currentUser.uid : "",
          rejection_reason: feedbackHtml || "",
          feedback: feedbackHtml || "",
          ...(authorUid
            ? {
                last_reported_by: arrayRemove(authorUid),
                [`rejected_users.${authorUid}`]: {
                  reason: feedbackHtml || "",
                  rejected_at: new Date().toISOString(),
                  rejected_by: auth.currentUser ? auth.currentUser.uid : "",
                },
                [`approved_users.${authorUid}`]: deleteField(),
              }
            : {}),
        };

    try {
      await updateDoc(doc(db, targetCollection, targetTaskId), taskPatch);
    } catch (err) {
      const fallbackCol = targetCollection === "quests" ? "tasks" : "quests";
      try {
        await updateDoc(doc(db, fallbackCol, targetTaskId), taskPatch);
      } catch (err2) {
        console.warn(`Failed to update task ${targetTaskId} in ${targetCollection} and ${fallbackCol}:`, err2);
      }
    }
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
 * Bulk archive selected reports.
 * For intern_dailyreport items: marks task inside doc as archived (and doc as archived if all tasks archived).
 * For quest_reports / subcollection: sets archived = true on report doc.
 * @param {Array} reports - array of report objects from loadReportsData
 */
export async function bulkArchiveTasks(reports) {
  const archivedAtIso = new Date().toISOString();
  const archivedBy = auth.currentUser ? auth.currentUser.uid : "";

  const internReportsByDoc = {};

  for (const report of reports) {
    const src = report.reportSource || "";
    const docId = report.reportDocId || "";
    const taskId = report.taskId || report.id || "";

    if (src === "intern_dailyreport" && docId) {
      if (!internReportsByDoc[docId]) internReportsByDoc[docId] = [];
      internReportsByDoc[docId].push(report);
      continue;
    }

    try {
      if (src === "root" && docId) {
        await updateDoc(doc(db, "quest_reports", docId), {
          archived: true,
          is_archived: true,
          archived_at: archivedAtIso,
          archived_by: archivedBy,
        });
      } else if (src === "sub" && docId && taskId) {
        try {
          await updateDoc(doc(db, "tasks", taskId, "reports", docId), {
            archived: true,
            is_archived: true,
            archived_at: archivedAtIso,
            archived_by: archivedBy,
          });
        } catch (_) {}
      } else if (docId) {
        try {
          await updateDoc(doc(db, "tasks", docId), {
            archived: true,
            is_archived: true,
            archived_at: archivedAtIso,
            archived_by: archivedBy,
          });
        } catch (_) {}
      }
    } catch (e) {
      console.warn("bulkArchiveTasks: failed to archive", report.id, e);
    }
  }

  // Handle intern_dailyreport grouped
  for (const [docId, repList] of Object.entries(internReportsByDoc)) {
    try {
      const repRef = doc(db, "intern_dailyreport", docId);
      const repSnap = await getDoc(repRef);
      if (repSnap.exists()) {
        const repData = repSnap.data() || {};
        const tasks = Array.isArray(repData.tasks) ? repData.tasks : [];
        const taskIndicesToArchive = new Set(repList.map((r) => r.taskIndex).filter((i) => typeof i === "number"));

        tasks.forEach((t, idx) => {
          const matchByIndex = taskIndicesToArchive.has(idx);
          const matchById = repList.some((r) => r.taskId && (t.task_id === r.taskId || t.id === r.taskId));
          const matchByTitle = repList.some((r) => r.task && (t.title === r.task || t.task === r.task));
          if (matchByIndex || matchById || matchByTitle) {
            t.archived = true;
            t.is_archived = true;
            t.archived_at = archivedAtIso;
            t.archived_by = archivedBy;
          }
        });

        const allArchived = tasks.length > 0 && tasks.every((t) => !!(t.archived || t.is_archived));
        await updateDoc(repRef, {
          tasks: tasks,
          archived: allArchived,
          is_archived: allArchived,
          archived_at: archivedAtIso,
          archived_by: archivedBy,
        });
      }
    } catch (e) {
      console.warn("bulkArchiveTasks: failed on intern_dailyreport doc:", docId, e);
    }
  }
}

/**
 * Unarchive / restore selected reports back to active state.
 * @param {Array} reports - array of report objects
 */
export async function bulkUnarchiveTasks(reports) {
  const internReportsByDoc = {};

  for (const report of reports) {
    const src = report.reportSource || "";
    const docId = report.reportDocId || "";
    const taskId = report.taskId || report.id || "";

    if (src === "intern_dailyreport" && docId) {
      if (!internReportsByDoc[docId]) internReportsByDoc[docId] = [];
      internReportsByDoc[docId].push(report);
      continue;
    }

    try {
      if (src === "root" && docId) {
        await updateDoc(doc(db, "quest_reports", docId), {
          archived: false,
          is_archived: false,
        });
      } else if (src === "sub" && docId && taskId) {
        try {
          await updateDoc(doc(db, "tasks", taskId, "reports", docId), {
            archived: false,
            is_archived: false,
          });
        } catch (_) {}
      } else if (docId) {
        try {
          await updateDoc(doc(db, "tasks", docId), {
            archived: false,
            is_archived: false,
          });
        } catch (_) {}
      }
    } catch (e) {
      console.warn("bulkUnarchiveTasks: failed to unarchive", report.id, e);
    }
  }

  for (const [docId, repList] of Object.entries(internReportsByDoc)) {
    try {
      const repRef = doc(db, "intern_dailyreport", docId);
      const repSnap = await getDoc(repRef);
      if (repSnap.exists()) {
        const repData = repSnap.data() || {};
        const tasks = Array.isArray(repData.tasks) ? repData.tasks : [];
        const taskIndicesToUnarchive = new Set(repList.map((r) => r.taskIndex).filter((i) => typeof i === "number"));

        tasks.forEach((t, idx) => {
          const matchByIndex = taskIndicesToUnarchive.has(idx);
          const matchById = repList.some((r) => r.taskId && (t.task_id === r.taskId || t.id === r.taskId));
          const matchByTitle = repList.some((r) => r.task && (t.title === r.task || t.task === r.task));
          if (matchByIndex || matchById || matchByTitle) {
            t.archived = false;
            t.is_archived = false;
            delete t.archived;
            delete t.is_archived;
            delete t.archived_at;
            delete t.archived_by;
          }
        });

        const anyArchived = tasks.some((t) => !!(t.archived || t.is_archived));
        await updateDoc(repRef, {
          tasks: tasks,
          archived: anyArchived,
          is_archived: anyArchived,
        });
      }
    } catch (e) {
      console.warn("bulkUnarchiveTasks: failed on intern_dailyreport doc:", docId, e);
    }
  }
}

/**
 * Delete selected reports or task IDs.
 * Moves item to Trash collection and deletes from the appropriate source collection.
 * @param {Array} reports - array of report objects or taskId strings
 */
export async function bulkDeleteTasks(reports) {
  const deletedAtIso = new Date().toISOString();
  const deletedBy = auth.currentUser ? auth.currentUser.uid : "";

  const internReportsByDoc = {};

  for (const item of reports) {
    const report = typeof item === "string" ? { id: item } : item;
    const src = report.reportSource || "";
    const docId = report.reportDocId || "";
    const taskId = report.taskId || report.id || "";

    try {
      // 1. Move a backup copy to Trash collection
      const trashEntry = {
        taskId: taskId,
        reportId: report.id || "",
        taskTitle: report.task || "",
        reportSource: src,
        reportDocId: docId,
        date: report.date || "",
        deletedAt: deletedAtIso,
        deletedBy: deletedBy,
      };

      try {
        await addDoc(collection(db, "Trash"), trashEntry);
      } catch (e) {
        console.warn("bulkDeleteTasks: failed to add to Trash:", e);
      }

      if (src === "intern_dailyreport" && docId) {
        if (!internReportsByDoc[docId]) internReportsByDoc[docId] = [];
        internReportsByDoc[docId].push(report);
        continue;
      }

      // 2. Delete from quest_reports (root collection)
      if (src === "root" && docId) {
        try {
          await deleteDoc(doc(db, "quest_reports", docId));
        } catch (e) {
          console.warn("bulkDeleteTasks: failed to delete from quest_reports:", e);
        }
      }

      // 3. Delete subcollection reports
      if (src === "sub" && docId && taskId) {
        try {
          await deleteDoc(doc(db, "tasks", taskId, "reports", docId));
        } catch (_) {}
      }
    } catch (e) {
      console.warn("bulkDeleteTasks: error deleting item", report, e);
    }
  }

  // Process intern_dailyreport grouped
  for (const [docId, repList] of Object.entries(internReportsByDoc)) {
    try {
      const repRef = doc(db, "intern_dailyreport", docId);
      const repSnap = await getDoc(repRef);
      if (repSnap.exists()) {
        const repData = repSnap.data() || {};
        const tasks = Array.isArray(repData.tasks) ? repData.tasks : [];
        const taskIndicesToDelete = new Set(repList.map((r) => r.taskIndex).filter((i) => typeof i === "number"));

        const remainingTasks = tasks.filter((t, idx) => {
          if (taskIndicesToDelete.has(idx)) return false;
          if (repList.some((r) => (r.taskId && (t.task_id === r.taskId || t.id === r.taskId)) || (r.task && (t.title === r.task || t.task === r.task)))) return false;
          return true;
        });

        if (remainingTasks.length > 0) {
          await updateDoc(repRef, { tasks: remainingTasks });
        } else {
          await deleteDoc(repRef);
        }
      }
    } catch (e) {
      console.warn("bulkDeleteTasks: failed to delete from intern_dailyreport doc:", docId, e);
    }
  }
}
