// assets/js/home-projects.js
// Project management for home dashboard
// =====================================================================

import { db, getCurrentUser } from "./home-firebase.js";
import {
  collection, query, orderBy, limit, onSnapshot,
  getCountFromServer, where, doc, updateDoc, deleteDoc,
  addDoc, serverTimestamp, getDocs
} from "./home-firebase.js";

let projectsUnsubscribe = null;
let projectTaskStats = {};
let cachedProjects = [];
let globalProjectTasksTotal = 0;
let listenToProjectsRetryCount = 0;
let departments = [];
let selectedDepartment = null;

/**
 * Listen to projects and update UI
 */
export function listenToProjects() {
  try {
    if (projectsUnsubscribe) {
      projectsUnsubscribe();
      projectsUnsubscribe = null;
    }

    const q = query(
      collection(db, "projects"),
      orderBy("created_at", "desc"),
      limit(50)
    );

    projectsUnsubscribe = onSnapshot(q, async (snapshot) => {
      listenToProjectsRetryCount = 0; // Reset retry count on success
      let projects = [];
      snapshot.forEach((doc) => {
        projects.push({ id: doc.id, ...doc.data() });
      });
      
      cachedProjects = projects;
      
      // Fetch task counts non-realtime to save reads
      await fetchTaskStatsForProjects(projects);
      
      // Trigger UI update via callback if set
      if (window.onProjectsUpdated) {
        window.onProjectsUpdated(projects, projectTaskStats);
      }
    }, (error) => {
      console.error("Failed to listen to projects:", error);
      // Retry with exponential backoff
      if (error.code === "unavailable" || error.message.includes("abort") || error.code === "cancelled") {
        listenToProjectsRetryCount++;
        const delay = Math.min(1000 * Math.pow(2, listenToProjectsRetryCount), 30000);
        console.log(`Retrying projects listener in ${delay}ms (attempt ${listenToProjectsRetryCount})...`);
        setTimeout(listenToProjects, delay);
      }
    });
  } catch (e) {
    console.error("Failed to listen to projects", e);
  }
}

/**
 * Fetch task statistics for projects
 * @param {Array} projects - Array of project objects
 */
export async function fetchTaskStatsForProjects(projects) {
  try {
    let totalAll = 0;
    const stats = {};
    
    for (const p of projects) {
      const pid = p.id;
      if (!pid) continue;
      
      try {
        // Total tasks count
        const totalSnap = await getCountFromServer(
          query(collection(db, "tasks"), where("project_id", "==", pid))
        );
        const total = totalSnap.data().count;

        // Completed tasks count
        const completeSnap = await getCountFromServer(
          query(
            collection(db, "tasks"),
            where("project_id", "==", pid),
            where("status", "in", ["complete", "done", "Complete", "Done"])
          )
        );
        const complete = completeSnap.data().count;

        stats[pid] = { total, complete };
        totalAll += total;
      } catch (e) {
        console.warn("Count query failed for project", pid, e);
        stats[pid] = { total: 0, complete: 0 };
      }
    }
    
    globalProjectTasksTotal = totalAll;
    projectTaskStats = stats;
    
    // Update project tasks count display
    const projectCountEl = document.getElementById("projectTasksTotalCount");
    if (projectCountEl) {
      projectCountEl.innerText = String(totalAll);
    }
    
    // Trigger UI update
    if (window.onProjectsUpdated) {
      window.onProjectsUpdated(cachedProjects, projectTaskStats);
    }
  } catch (e) {
    console.error("Exception in fetchTaskStatsForProjects", e);
  }
}

/**
 * Get currently selected department
 * @returns {Object|null} Selected department
 */
export function getSelectedDepartment() {
  return selectedDepartment;
}

/**
 * Get cached projects
 * @returns {Array} Cached projects
 */
export function getCachedProjects() {
  return cachedProjects;
}

/**
 * Load departments into the new-project modal
 */
export async function loadDepartments() {
  const container = document.getElementById("departmentOptions");
  if (container) {
    container.innerHTML = '<span class="text-muted small">Loading departments...</span>';
  }
  try {
    const snap = await getDocs(collection(db, "departments"));
    const items = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      items.push({
        id: docSnap.id,
        name: d.name || "Untitled",
        color: d.color || "#e5e7eb",
      });
    });
    departments = items;
    if (!selectedDepartment && departments.length > 0) {
      selectedDepartment = departments[0];
    }
    renderDepartmentOptions();
  } catch (e) {
    console.error("Failed to load departments", e);
    if (container) {
      container.innerHTML = '<span class="text-danger small">Failed to load departments.</span>';
    }
  }
}

/**
 * Render department option buttons
 */
function renderDepartmentOptions() {
  const container = document.getElementById("departmentOptions");
  if (!container) return;
  container.innerHTML = "";
  if (!departments || departments.length === 0) {
    container.innerHTML = '<span class="text-muted small">No departments available.</span>';
    selectedDepartment = null;
    return;
  }
  departments.forEach((dept) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-sm btn-light border rounded-pill d-flex align-items-center gap-2";
    btn.dataset.deptId = dept.id;
    btn.innerHTML = `
      <span class="d-inline-block rounded-circle" style="width:10px;height:10px;background:${dept.color};"></span>
      <span>${dept.name}</span>
    `;
    btn.addEventListener("click", () => {
      selectedDepartment = dept;
      updateDepartmentSelectionUI();
    });
    container.appendChild(btn);
  });
  updateDepartmentSelectionUI();
}

/**
 * Highlight selected department
 */
function updateDepartmentSelectionUI() {
  const container = document.getElementById("departmentOptions");
  if (!container) return;
  container.querySelectorAll("button[data-dept-id]").forEach((btn) => {
    const id = btn.getAttribute("data-dept-id");
    if (selectedDepartment && id === selectedDepartment.id) {
      btn.classList.add("btn-primary");
      btn.classList.remove("btn-light");
      btn.classList.add("text-white");
    } else {
      btn.classList.remove("btn-primary");
      btn.classList.add("btn-light");
      btn.classList.remove("text-white");
    }
  });
}

/**
 * Get project task statistics
 * @returns {Object} Project task stats
 */
export function getProjectTaskStats() {
  return projectTaskStats;
}

/**
 * Get total tasks count
 * @returns {number} Total tasks count
 */
export function getGlobalProjectTasksTotal() {
  return globalProjectTasksTotal;
}

/**
 * Create a new project
 * @param {Object} projectData - Project data
 * @returns {Promise<string>} Project ID
 */
export async function createProject(projectData) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error("User not authenticated");
  
  try {
    const docRef = await addDoc(collection(db, "projects"), {
      name: projectData.name,
      description: projectData.description || "",
      owner_id: currentUser.uid,
      is_pinned: projectData.is_pinned || false,
      pinned: projectData.is_pinned || false,
      status: "active",
      department: projectData.department || "General",
      department_color: projectData.department_color || "",
      members: [currentUser.uid],
      created_at: serverTimestamp(),
    });
    
    return docRef.id;
  } catch (error) {
    console.error("Error creating project:", error);
    throw error;
  }
}

/**
 * Toggle project pin status
 * @param {string} projectId - Project ID
 * @param {boolean} shouldPin - Whether to pin the project
 */
export async function toggleProjectPin(projectId, shouldPin) {
  if (!projectId) return;
  
  try {
    await updateDoc(doc(db, "projects", projectId), {
      is_pinned: shouldPin,
      pinned: shouldPin,
    });
  } catch (e) {
    console.error("Failed to toggle pin project", e);
    throw e;
  }
}

/**
 * Delete a project
 * @param {string} projectId - Project ID
 * @param {Object} projectData - Project data for trash record
 */
export async function deleteProject(projectId, projectData) {
  if (!projectId) return;
  
  try {
    const currentUser = getCurrentUser();
    
    // Create trash record
    if (projectData) {
      await addDoc(collection(db, "trash"), {
        type: "project",
        project_id: projectId,
        entity_id: projectId,
        data: projectData,
        deleted_at: serverTimestamp(),
        deleted_by: currentUser ? currentUser.uid : "",
      });
    }
    
    // Delete project
    await deleteDoc(doc(db, "projects", projectId));
  } catch (e) {
    console.error("Failed to delete project", e);
    throw e;
  }
}

/**
 * Open delete project modal
 * @param {string} projectId - Project ID
 * @param {string} projectName - Project name
 */
export function openDeleteProjectModal(projectId, projectName) {
  const nameEl = document.getElementById("deleteProjectName");
  const idInput = document.getElementById("deleteProjectId");
  const modalEl = document.getElementById("deleteProjectModal");
  
  if (!nameEl || !idInput || !modalEl) return;
  
  nameEl.innerText = projectName || "";
  idInput.value = projectId || "";
  
  if (typeof bootstrap === "undefined") return;
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

/**
 * Render projects to UI
 * @param {Array} projects - Projects to render
 * @param {Object} stats - Project task statistics
 * @param {HTMLElement} pinnedContainer - Pinned projects container
 * @param {HTMLElement} otherContainer - Other projects container
 */
export function renderProjects(projects, stats, pinnedContainer, otherContainer) {
  if (!pinnedContainer || !otherContainer) return;
  
  pinnedContainer.innerHTML = "";
  otherContainer.innerHTML = "";
  
  // Filter pinned and unpinned projects
  const pinnedList = projects.filter(p => p.is_pinned === true || p.pinned === true);
  const unpinnedList = projects.filter(p => !(p.is_pinned === true || p.pinned === true));
  
  // Render pinned projects
  pinnedList.forEach((p, index) => {
    const isFirst = index === 0;
    const colClass = isFirst ? "col-lg-6 col-12" : "col-md-6 col-lg-3";
    const cardClass = isFirst ? "project-card priority" : "project-card";
    const stat = stats[p.id] || { total: 0, complete: 0 };
    const totalTasks = stat.total || 0;
    const completedTasks = stat.complete || 0;
    const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    let progressBarClass = "bg-secondary";
    if (totalTasks > 0) {
      if (progressPercent < 50) progressBarClass = "bg-danger";
      else if (progressPercent < 80) progressBarClass = "bg-warning";
      else progressBarClass = "bg-success";
    }
    
    const rawDesc = typeof p.description === "string" ? p.description : "";
    const plainDesc = rawDesc.replace(/<[^>]+>/g, " ").trim();
    const shortDesc = plainDesc.length > 140 
      ? plainDesc.substring(0, plainDesc.lastIndexOf(" ", 137)) + "..." 
      : plainDesc;
    
    const html = `
      <div class="${colClass}">
        <a href="project/project.html?id=${p.id}" class="text-decoration-none">
          <div class="${cardClass}">
            <div class="d-flex justify-content-between align-items-start mb-3">
              <span class="badge ${isFirst ? "bg-white bg-opacity-25 text-white" : "bg-light text-dark border"}">${p.department || "General"}</span>
              <div class="d-flex align-items-center gap-2 project-card-actions">
                <i class="bi bi-pin-angle-fill ${isFirst ? "text-white" : "text-primary"} project-pin-icon" data-project-id="${p.id}" data-project-pinned="true"></i>
                <i class="bi bi-trash3 ${isFirst ? "text-white" : "text-danger"} project-trash-icon" data-project-id="${p.id}" data-project-name="${p.name || ""}"></i>
              </div>
            </div>
            <h5 class="fw-bold ${isFirst ? "text-white" : "text-dark"}">${p.name}</h5>
            <p class="${isFirst ? "text-white-50" : "text-muted"} small mb-0" style="min-height:2.6em;max-height:2.6em;overflow:hidden;">${shortDesc}</p>
            <div class="mt-4">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="small ${isFirst ? "text-white-50" : "text-muted"}">Progress</span>
                <span class="small ${isFirst ? "text-white-50" : "text-muted"}">${progressPercent}%</span>
              </div>
              <div class="progress" style="height: 6px; background: rgba(0,0,0,0.1);">
                <div class="progress-bar ${progressBarClass} progress-bar-striped progress-bar-animated" style="width: ${progressPercent}%"></div>
              </div>
            </div>
          </div>
        </a>
      </div>
    `;
    
    pinnedContainer.insertAdjacentHTML("beforeend", html);
  });
  
  // Add new project button
  const newProjectBtn = `
    <div class="col-md-6 col-lg-3">
      <div class="btn-new-project-placeholder" data-bs-toggle="modal" data-bs-target="#newProjectModal">
        <i class="bi bi-plus-circle-dotted new-proj-icon"></i>
        <span class="fw-bold">Create New Project</span>
        <small class="text-muted">Start something new</small>
      </div>
    </div>
  `;
  pinnedContainer.insertAdjacentHTML("beforeend", newProjectBtn);
  
  // Render unpinned projects
  unpinnedList.forEach(p => {
    const departmentName = p.department || "General";
    const departmentColor = p.department_color || "#e5e7eb";
    const stat = stats[p.id] || { total: 0, complete: 0 };
    const totalTasks = stat.total || 0;
    const completedTasks = stat.complete || 0;
    const isAllDone = totalTasks > 0 && completedTasks === totalTasks;
    const progressText = `${completedTasks}/${totalTasks} Done`;
    
    const rawDesc = typeof p.description === "string" ? p.description : "";
    const plainDesc = rawDesc.replace(/<[^>]+>/g, " ").trim();
    const shortDesc = plainDesc.length > 120 ? plainDesc.substring(0, 117) + "..." : plainDesc;
    
    const iconClass = isAllDone
      ? "bi bi-check-circle-fill text-success"
      : "bi bi-check-circle";
    
    const html = `
      <div class="col-md-6 col-lg-3">
        <a href="project/project.html?id=${p.id}" class="text-decoration-none">
          <div class="project-card">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <span class="badge border pill px-3 d-inline-flex align-items-center justify-content-center text-center"
                    style="min-width:80px;max-width:80px;background:${departmentColor};border-color:${departmentColor};color:#fff;">
                ${departmentName}
              </span>
              <div class="d-flex align-items-center gap-2 project-card-actions project-card-actions-unpinned">
                <i class="bi bi-pin-angle-fill text-primary project-pin-icon"
                   data-project-id="${p.id}" data-project-pinned="false"></i>
                <i class="bi bi-trash3 text-danger project-trash-icon"
                   data-project-id="${p.id}" data-project-name="${p.name || ""}"></i>
              </div>
            </div>
            <h6 class="fw-bold text-dark mb-1">${p.name}</h6>
            <p class="text-muted small mb-2" style="min-height:2.6em;white-space:normal;word-break:break-word;">${shortDesc}</p>
            <div class="d-flex align-items-center small text-muted">
              <i class="${iconClass} me-1"></i>
              <span>${progressText}</span>
            </div>
          </div>
        </a>
      </div>
    `;
    
    otherContainer.insertAdjacentHTML("beforeend", html);
  });
}

/**
 * Clean up project resources
 */
export function cleanupProjects() {
  if (projectsUnsubscribe) {
    projectsUnsubscribe();
    projectsUnsubscribe = null;
  }
}