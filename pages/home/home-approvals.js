// assets/js/home-approvals.js
// Daily report and pending approval handling for home dashboard
// =====================================================================

import { db, getCurrentUser } from "./home-firebase.js";
import { 
  collection, query, where, onSnapshot, doc, getDoc,
  updateDoc, setDoc, deleteDoc, serverTimestamp 
} from "./home-firebase.js";
import { getMs, escapeHtml } from "./home-utils.js";

function reviewerInfo() {
  let name = "";
  try {
    name = JSON.parse(localStorage.getItem("userData"))?.name || "";
  } catch (e) {}
  const user = getCurrentUser();
  return { uid: user ? user.uid : "", name: name || (user ? user.email : "") };
}

function swalFire(opts) {
  if (window.Swal) return window.Swal.fire(opts);
  return Promise.resolve();
}

function bootstrapModal(el) {
  return window.bootstrap ? window.bootstrap.Modal.getOrCreateInstance(el) : null;
}

async function backfillTaskPoints(task) {
  const t = { ...task };
  const pts = Number(t.points) || 0;
  if (pts <= 0 && task.task_id) {
    try {
      const taskSnap = await getDoc(doc(db, "tasks", task.task_id));
      if (taskSnap.exists()) {
        const td = taskSnap.data() || {};
        const p = Number(td.points) || 0;
        if (p > 0) t.points = p;
      }
    } catch (e) {
      console.warn("Gagal backfill points quest:", task.task_id, e);
    }
  }
  return t;
}

let dailyReportUnsubscribe = null;
let pendingApprovalsUnsubscribe = null;
let homeUsersMap = null;
let homeUsersMapPromise = null;

/**
 * Load pending user approvals
 * @param {HTMLElement} section - Section element
 * @param {HTMLElement} tbody - Table body element
 */
export function loadPendingApprovals(section, tbody) {
  if (!section || !tbody) return;
  
  section.style.display = "block";
  
  // Clear previous listener
  if (pendingApprovalsUnsubscribe) {
    pendingApprovalsUnsubscribe();
    pendingApprovalsUnsubscribe = null;
  }
  
  try {
    const q = query(
      collection(db, "pending_users"),
      where("is_approved", "==", false)
    );
    
    pendingApprovalsUnsubscribe = onSnapshot(q, (snapshot) => {
      tbody.innerHTML = "";
      
      if (snapshot.empty) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="text-center text-muted">
              No pending registrations.
            </td>
          </tr>
        `;
        return;
      }
      
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const id = docSnap.id;
        let regDate = "-";
        
        if (data.registered_at) {
          regDate = data.registered_at.toDate().toLocaleString("id-ID");
        }
        
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>
            <div class="d-flex align-items-center">
              <img src="${data.photo || "https://i.pravatar.cc/150"}" 
                   class="rounded-circle me-2" 
                   width="35" height="35" 
                   style="object-fit: cover;">
              <strong>${data.name || "No Name"}</strong>
            </div>
          </td>
          <td>${data.email || "-"}</td>
          <td>
            <span class="badge bg-secondary">
              ${data.employment?.position || "-"}
            </span>
          </td>
          <td class="small text-muted">${regDate}</td>
          <td>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-success rounded-pill px-3" 
                      onclick="window.approveUser('${id}')">
                Approve
              </button>
              <button class="btn btn-sm btn-outline-danger rounded-pill px-3" 
                      onclick="window.rejectUser('${id}')">
                Reject
              </button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }, (error) => {
      console.error("Error loading pending users:", error);
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-danger">
            Failed to load data.
          </td>
        </tr>
      `;
    });
  } catch (error) {
    console.error("Failed to setup listener:", error);
  }
}

/**
 * Approve a pending user
 * @param {string} userId - User ID to approve
 */
export async function approveUser(userId) {
  if (!confirm("Are you sure you want to approve this user?")) return;
  
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  
  try {
    const pendingRef = doc(db, "pending_users", userId);
    const pendingSnap = await getDoc(pendingRef);
    
    if (!pendingSnap.exists()) {
      alert("User not found in pending list.");
      return;
    }
    
    const userData = pendingSnap.data();
    userData.is_approved = true;
    userData.status = "Active";
    userData.approved_by = {
      uid: currentUser.uid,
      name: JSON.parse(localStorage.getItem("userData"))?.name || currentUser.email,
      timestamp: serverTimestamp(),
    };
    
    const userRef = doc(db, "users", userId);
    await setDoc(userRef, userData);
    await deleteDoc(pendingRef);
    
    alert("User approved successfully!");
  } catch (error) {
    console.error("Error approving user:", error);
    alert("Failed to approve user: " + error.message);
  }
}

/**
 * Reject a pending user
 * @param {string} userId - User ID to reject
 */
export async function rejectUser(userId) {
  if (!confirm("Are you sure you want to reject this user? Data will be deleted.")) return;
  
  try {
    const pendingRef = doc(db, "pending_users", userId);
    const pendingSnap = await getDoc(pendingRef);
    
    if (!pendingSnap.exists()) {
      alert("User not found in pending list.");
      return;
    }
    
    await deleteDoc(pendingRef);
    alert("User rejected and deleted successfully.");
  } catch (error) {
    console.error("Error rejecting user:", error);
    alert("Failed to reject user: " + error.message);
  }
}

/**
 * Load daily report approvals
 * @param {HTMLElement} list - List element
 * @param {HTMLElement} badge - Badge element
 * @param {string} userDepartment - User's department
 */
export function loadDailyReportApprovals(list, badge, userDepartment) {
  if (!list || !badge) return;
  
  // Clear previous listener
  if (dailyReportUnsubscribe) {
    dailyReportUnsubscribe();
    dailyReportUnsubscribe = null;
  }
  
  const q = query(
    collection(db, "intern_dailyreport"),
    where("status", "in", [
      "Pending",
      "Pending Review",
      "pending",
      "pending review",
    ])
  );
  
  dailyReportUnsubscribe = onSnapshot(q, async (snapshot) => {
    list.innerHTML = "";
    
    if (snapshot.empty) {
      list.innerHTML = `
        <p class="text-muted small mb-0">
          Tidak ada laporan perlu persetujuan.
        </p>
      `;
      badge.textContent = "0";
      return;
    }
    
    // Ensure users map is loaded
    await ensureHomeUsersMap();
    
    const reports = [];
    const userDept = (userDepartment || "").toLowerCase().trim();
    
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      
      // Determine report department
      let reportDept = "";
      if (Array.isArray(data.departments) && data.departments.length > 0) {
        const deptArray = data.departments.map(d => String(d).toLowerCase().trim());
        if (userDept && deptArray.includes(userDept)) {
          reportDept = userDept;
        } else {
          reportDept = deptArray[0] || "";
        }
      } else {
        reportDept = (
          data.department ||
          data.internship_department ||
          data.team_department ||
          ""
        );
        reportDept = String(reportDept).toLowerCase().trim();
      }
      
      // Filter by department
      if (!userDept || !reportDept || reportDept !== userDept) {
        return;
      }
      
      reports.push({ id: docSnap.id, data: data });
    });
    
    if (reports.length === 0) {
      list.innerHTML = `
        <p class="text-muted small mb-0">
          Tidak ada laporan perlu persetujuan.
        </p>
      `;
      badge.textContent = "0";
      return;
    }
    
    badge.textContent = reports.length;
    
    // Sort by submission date
    reports.sort((a, b) => {
      const aTime = getMs(
        a.data.submitted_at || a.data.submittedAt || a.data.report_date
      );
      const bTime = getMs(
        b.data.submitted_at || b.data.submittedAt || b.data.report_date
      );
      return (bTime || 0) - (aTime || 0);
    });
    
    // Create report items
    reports.forEach((report) => {
      const data = report.data;
      const item = document.createElement("div");
      item.className = "p-3 bg-light rounded-3 d-flex justify-content-between align-items-center";
      item.style.cursor = "pointer";
      
      item.innerHTML = `
        <div>
          <p class="fw-bold mb-0 small">${data.name || "No Name"}</p>
          <small class="text-muted" style="font-size:0.7rem">
            ${data.date_label || data.report_date || "-"} | ${data.position || "-"}
          </small>
        </div>
        <button type="button" class="btn btn-sm btn-dark rounded-pill px-3 daily-report-review-btn">
          Review
        </button>
      `;
      
      item.addEventListener("click", () => {
        if (window.openDailyReportModal) {
          window.openDailyReportModal(report.id, data);
        }
      });
      
      const reviewButton = item.querySelector(".daily-report-review-btn");
      if (reviewButton) {
        reviewButton.addEventListener("click", (event) => {
          event.stopPropagation();
          if (window.openDailyReportModal) {
            window.openDailyReportModal(report.id, data);
          }
        });
      }
      
      list.appendChild(item);
    });
  }, (error) => {
    console.error("Error loading daily reports:", error);
    list.innerHTML = `
      <p class="text-danger small mb-0">
        Gagal memuat data.
      </p>
    `;
  });
}

/**
 * Ensure users map is loaded for display names
 */
async function ensureHomeUsersMap() {
  if (homeUsersMap) return homeUsersMap;
  if (homeUsersMapPromise) return homeUsersMapPromise;
  
  homeUsersMapPromise = (async () => {
    const map = {};
    try {
      const snap = await getDocs(collection(db, "users"));
      snap.forEach((docSnap) => {
        const u = docSnap.data() || {};
        map[docSnap.id] = u.name || u.email || docSnap.id;
      });
      homeUsersMap = map;
    } catch (e) {
      homeUsersMapPromise = null;
      console.warn("Gagal memuat data users untuk who_did_this:", e);
    }
    return map;
  })();
  
  return homeUsersMapPromise;
}

/**
 * Get user name from UID
 * @param {string} uid - User ID
 * @returns {string} User name
 */
export function homeUserName(uid) {
  const map = homeUsersMap || {};
  return map[uid] || uid;
}

/**
 * Open daily report modal
 * @param {string} reportId - Report ID
 * @param {Object} data - Report data
 */
export async function openDailyReportModal(reportId, data) {
  const modalEl = document.getElementById("dailyReportModal");
  if (!modalEl) return;
  
  // Set basic report data
  document.getElementById("modalReportId").value = reportId;
  document.getElementById("modalReportName").textContent = data.name || "-";
  document.getElementById("modalReportNameDetail").textContent = data.name || "-";
  
  const reportDeptName = data.department || 
    (Array.isArray(data.departments) && data.departments.length > 0 ? data.departments[0] : '-');
  const reportPosition = data.position || '';
  
  document.getElementById("modalReportPosition").textContent = reportPosition || "-";
  document.getElementById("modalReportDeptPos").textContent = 
    reportDeptName + ' / ' + (reportPosition || '-');
  document.getElementById("modalReportDate").textContent = 
    data.date_label || data.report_date || "-";
  
  // Get photo from report data or user document
  let photoUrl = data.photo_url || data.photo || data.profile_photo;
  const userId = data.uid || data.user_id || data.reporter_id;
  
  if ((!reportPosition || !photoUrl) && userId) {
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (!photoUrl) {
          photoUrl = userData.photo_url || userData.photo || userData.profile_photo;
        }
        if (!reportPosition) {
          const newPosition = userData.position || 
            (userData.employment && (userData.employment.position || userData.employment.role)) || '';
          document.getElementById("modalReportPosition").textContent = newPosition || "-";
          document.getElementById("modalReportDeptPos").textContent = 
            reportDeptName + ' / ' + (newPosition || '-');
        }
      }
    } catch (e) {
      console.warn("Could not fetch user data:", e);
    }
  }
  
  const photoEl = document.getElementById("modalReportPhoto");
  if (photoUrl) {
    photoEl.src = photoUrl;
  } else {
    photoEl.src = "https://i.pravatar.cc/150?u=" + encodeURIComponent(data.name || "user");
  }
  
  // Display tasks
  const tasksList = document.getElementById("modalReportTasks");
  tasksList.innerHTML = "";
  
  // Store tasks data for later use
  document.getElementById("modalReportId").dataset.tasks = JSON.stringify(data.tasks || []);
  
  // Update approve buttons
  const buttonsContainer = document.getElementById("approveButtonsContainer");
  buttonsContainer.innerHTML = `
    <button type="button" class="btn btn-success rounded-pill px-4 me-2" onclick="window.approveReport()">
      Approve All
    </button>
    <button type="button" class="btn btn-outline-success rounded-pill px-4" onclick="window.approveIndividualTasks()">
      Approve Individual
    </button>
  `;
  
  // Render tasks
  if (data.tasks && Array.isArray(data.tasks)) {
    data.tasks.forEach((task, index) => {
      const whoDidThisRaw = task.who_did_this;
      let whoDidThisList = [];
      
      if (typeof whoDidThisRaw === "string") {
        whoDidThisList = [whoDidThisRaw];
      } else if (Array.isArray(whoDidThisRaw)) {
        whoDidThisList = whoDidThisRaw;
      } else if (whoDidThisRaw && typeof whoDidThisRaw === "object") {
        const keys = Object.keys(whoDidThisRaw);
        const allNumeric = keys.length > 0 && keys.every(k => !Number.isNaN(parseInt(k, 10)));
        if (allNumeric) {
          whoDidThisList = keys.map(k => whoDidThisRaw[k]);
        } else if (whoDidThisRaw.uid || whoDidThisRaw.id) {
          whoDidThisList = [whoDidThisRaw];
        }
      }
      
      const whoNamesHtml = whoDidThisList
        .map(entry => {
          const uid = entry && typeof entry === "object"
            ? entry.uid || entry.id || entry.user_id || ""
            : entry;
          return uid
            ? `<span class="badge rounded-pill me-1" style="background-color:#e7f1ff;color:#0d6efd;font-weight:500">
                 ${escapeHtml(homeUserName(uid))}
               </span>`
            : "";
        })
        .join("");
      
      const whoBlockHtml = whoNamesHtml
        ? `<div class="mt-1 d-flex flex-wrap align-items-center gap-1">
             <small class="text-muted fw-semibold me-1" style="font-size:0.72rem">
               <i class="bi bi-people-fill me-1"></i> Dikerjakan oleh:
             </small>
             ${whoNamesHtml}
           </div>`
        : "";
      
      const li = document.createElement("li");
      li.className = "d-flex align-items-start mb-2";
      li.innerHTML = `
        <div class="form-check mt-1 me-2" style="display: none;" id="taskCheckContainer_${index}">
          <input class="form-check-input task-approve-checkbox" type="checkbox" value="${index}" id="taskCheck_${index}">
        </div>
        <span class="badge bg-primary rounded-pill me-2 mt-1" id="taskBadge_${index}" style="min-width: 24px;">
          ${index + 1}
        </span>
        <div>
          <div class="fw-bold text-dark">${task.title || task.task || "-"}</div>
          <small class="text-muted">${task.detail || task.note || ""}</small>
          ${whoBlockHtml}
        </div>
      `;
      tasksList.appendChild(li);
    });
  }
  
  // Show modal
  const modal = window.bootstrap?.Modal?.getOrCreateInstance(modalEl);
  if (modal) modal.show();
}

/**
 * Approve all tasks in the open report
 */
export async function approveReport() {
  const reportId = document.getElementById("modalReportId").value;
  if (!reportId) return;

  try {
    const reportRef = doc(db, "intern_dailyreport", reportId);
    const reportSnap = await getDoc(reportRef);
    const reportData = reportSnap.exists() ? reportSnap.data() || {} : {};
    const tasks = Array.isArray(reportData.tasks) ? reportData.tasks : [];
    const updatedTasks = await Promise.all(
      tasks.map(async (task) => ({
        ...(await backfillTaskPoints(task)),
        status: "Approved",
      })),
    );
    const reviewer = reviewerInfo();

    await updateDoc(reportRef, {
      tasks: updatedTasks,
      status: "Approved",
      reviewer_id: reviewer.uid,
      reviewer_name: reviewer.name,
      reviewed_at: serverTimestamp(),
    });

    const modal = bootstrapModal(document.getElementById("dailyReportModal"));
    if (modal) modal.hide();

    await swalFire({
      title: "Berhasil!",
      text: "Laporan berhasil disetujui",
      icon: "success",
      confirmButtonText: "OK",
      confirmButtonColor: "#198754",
      timer: 3000,
      timerProgressBar: true,
    });
  } catch (error) {
    console.error("Error approving report:", error);
    await swalFire({
      title: "Gagal!",
      text: "Gagal menyetujui laporan",
      icon: "error",
      confirmButtonText: "OK",
      confirmButtonColor: "#dc3545",
    });
  }
}

/**
 * Enter individual task approval mode
 */
export function approveIndividualTasks() {
  const checkboxes = document.querySelectorAll(".task-approve-checkbox");
  const containers = document.querySelectorAll('[id^="taskCheckContainer_"]');
  const badges = document.querySelectorAll('[id^="taskBadge_"]');

  containers.forEach((el) => (el.style.display = "block"));
  badges.forEach((el) => (el.style.display = "none"));

  const buttonsContainer = document.getElementById("approveButtonsContainer");
  if (buttonsContainer) {
    buttonsContainer.innerHTML = `
      <button type="button" class="btn btn-secondary rounded-pill px-4 me-2" onclick="window.cancelApproveIndividual()">Cancel</button>
      <button type="button" class="btn btn-success rounded-pill px-4" onclick="window.submitApproveIndividual()">Approve Selected</button>
    `;
  }
  checkboxes.forEach((cb) => (cb.checked = false));
}

/**
 * Cancel individual task approval mode
 */
export function cancelApproveIndividual() {
  const containers = document.querySelectorAll('[id^="taskCheckContainer_"]');
  const badges = document.querySelectorAll('[id^="taskBadge_"]');

  containers.forEach((el) => (el.style.display = "none"));
  badges.forEach((el) => (el.style.display = "inline-block"));

  const buttonsContainer = document.getElementById("approveButtonsContainer");
  if (buttonsContainer) {
    buttonsContainer.innerHTML = `
      <button type="button" class="btn btn-success rounded-pill px-4 me-2" onclick="window.approveReport()">Approve All</button>
      <button type="button" class="btn btn-outline-success rounded-pill px-4" onclick="window.approveIndividualTasks()">Approve Individual</button>
    `;
  }
}

/**
 * Submit the selected individual tasks for approval
 */
export async function submitApproveIndividual() {
  const reportId = document.getElementById("modalReportId").value;
  if (!reportId) return;

  const checkboxes = document.querySelectorAll(".task-approve-checkbox");
  const tasksData = JSON.parse(
    document.getElementById("modalReportId").dataset.tasks || "[]",
  );

  const selectedIndices = Array.from(checkboxes)
    .filter((cb) => cb.checked)
    .map((cb) => parseInt(cb.value));

  if (selectedIndices.length === 0) {
    await swalFire({
      title: "Peringatan",
      text: "Pilih setidaknya satu tugas untuk disetujui",
      icon: "warning",
    });
    return;
  }

  const updatedTasks = await Promise.all(
    tasksData.map(async (task, idx) => {
      const approved = selectedIndices.includes(idx);
      const base = approved ? await backfillTaskPoints(task) : { ...task };
      return { ...base, status: approved ? "Approved" : "Rejected" };
    }),
  );

  const allApproved =
    updatedTasks.length > 0 &&
    updatedTasks.every((t) => t.status === "Approved");
  const allRejected =
    updatedTasks.length > 0 &&
    updatedTasks.every((t) => t.status === "Rejected");

  let reportStatus = "Partially Approved";
  if (allApproved) reportStatus = "Approved";
  else if (allRejected) reportStatus = "Rejected";

  const reviewer = reviewerInfo();

  try {
    await updateDoc(doc(db, "intern_dailyreport", reportId), {
      tasks: updatedTasks,
      status: reportStatus,
      reviewer_id: reviewer.uid,
      reviewer_name: reviewer.name,
      reviewed_at: serverTimestamp(),
    });

    const modal = bootstrapModal(document.getElementById("dailyReportModal"));
    if (modal) modal.hide();

    cancelApproveIndividual();

    await swalFire({
      title: "Berhasil!",
      text: "Tugas yang dipilih berhasil disetujui",
      icon: "success",
      confirmButtonText: "OK",
      confirmButtonColor: "#198754",
      timer: 3000,
      timerProgressBar: true,
    });
  } catch (error) {
    console.error("Error approving tasks:", error);
    await swalFire({
      title: "Gagal!",
      text: "Gagal menyetujui tugas",
      icon: "error",
      confirmButtonText: "OK",
      confirmButtonColor: "#dc3545",
    });
  }
}

/**
 * Show reject confirmation modal
 */
export function showRejectModal() {
  document.getElementById("rejectReasonInput").value = "";
  const modal = bootstrapModal(document.getElementById("rejectReportModal"));
  if (modal) modal.show();
}

/**
 * Confirm and reject the open report
 */
export async function confirmRejectReport() {
  const reportId = document.getElementById("modalReportId").value;
  const reason = document
    .getElementById("rejectReasonInput")
    .value.trim();

  if (!reportId) return;

  const reviewer = reviewerInfo();

  try {
    await updateDoc(doc(db, "intern_dailyreport", reportId), {
      status: "Rejected",
      reviewer_id: reviewer.uid,
      reviewer_name: reviewer.name,
      reviewed_at: serverTimestamp(),
      rejection_reason: reason || "",
    });

    const rejectModal = bootstrapModal(
      document.getElementById("rejectReportModal"),
    );
    if (rejectModal) rejectModal.hide();

    const detailModal = bootstrapModal(
      document.getElementById("dailyReportModal"),
    );
    if (detailModal) detailModal.hide();

    await swalFire({
      title: "Ditolak!",
      text: "Laporan berhasil ditolak",
      icon: "info",
      confirmButtonText: "OK",
      confirmButtonColor: "#0dcaf0",
      timer: 3000,
      timerProgressBar: true,
    });
  } catch (error) {
    console.error("Error rejecting report:", error);
    await swalFire({
      title: "Gagal!",
      text: "Gagal menolak laporan",
      icon: "error",
      confirmButtonText: "OK",
      confirmButtonColor: "#dc3545",
    });
  }
}

/**
 * Clean up approval resources
 */
export function cleanupApprovals() {
  if (dailyReportUnsubscribe) {
    dailyReportUnsubscribe();
    dailyReportUnsubscribe = null;
  }
  if (pendingApprovalsUnsubscribe) {
    pendingApprovalsUnsubscribe();
    pendingApprovalsUnsubscribe = null;
  }
}