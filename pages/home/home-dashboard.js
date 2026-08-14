// assets/home/home-dashboard.js
// Main dashboard initialization and orchestration for home.html
// =====================================================================

import { renderTopBar } from "../../element/topbar.js";
import { renderSidebar } from "../../element/sidebar.js";
import {
  initializeAuth,
  logoutUser,
  getUserDepartment,
} from "./home-firebase.js";
import { db, doc, getDoc, getDocs, collection } from "./home-firebase.js";
import { formatGreeting } from "./home-utils.js";
import {
  startPresenceTracking,
  listenToOnlineUsers,
  cleanupPresence,
} from "./home-presence.js";
import {
  listenToHomeAnnouncements,
  cleanupAnnouncements,
} from "./home-announcements.js";
import {
  listenToProjects,
  renderProjects,
  toggleProjectPin,
  deleteProject,
  createProject,
  openDeleteProjectModal,
  getCachedProjects,
  loadDepartments,
  getSelectedDepartment,
  cleanupProjects,
} from "./home-projects.js";
import {
  loadPendingApprovals,
  loadDailyReportApprovals,
  approveUser,
  rejectUser,
  approveReport,
  approveIndividualTasks,
  cancelApproveIndividual,
  submitApproveIndividual,
  showRejectModal,
  confirmRejectReport,
  cleanupApprovals,
} from "./home-approvals.js";
import {
  startMenuBadgeRefresh,
  cleanupMenuBadges,
} from "./home-menu-badges.js";

let isInitialized = false;

/**
 * Initialize the home dashboard
 */
export async function initializeDashboard() {
  if (isInitialized) return;

  try {
    // Render shared layout (topbar + sidebar)
    const topbarTarget = document.getElementById("topbarContainer");
    if (topbarTarget) renderTopBar(topbarTarget);

    // Initialize auth and get user data FIRST (role needed for sidebar)
    const { user, userData } = await initializeAuth();

    // Resolve role from the user's custom claim (fall back to userData)
    let role = null;
    try {
      const tokenResult = await user.getIdTokenResult();
      role = tokenResult.claims?.role || null;
    } catch (e) {
      console.error("Failed to read role claim:", e);
    }
    role = role || userData?.access?.role_id || userData?.roleId || null;

    // Render sidebar with the resolved role (role-aware nav filtering)
    const sidebarTarget = document.getElementById("sidebarContainer");
    if (sidebarTarget)
      renderSidebar(sidebarTarget, { role, activePage: "dashboard" });

    // Populate user display in topbar/sidebar
    populateUserDisplay(user, userData);

    // Update welcome message
    updateWelcomeMessage(userData);

    // Show role + position badges
    const roleBadge = document.getElementById("dashboard-role-badge");
    if (roleBadge) {
      roleBadge.textContent =
        "" + (role ? role[0].toUpperCase() + role.slice(1) : "-");
    }
    const positionBadge = document.getElementById("dashboard-position-badge");
    if (positionBadge) {
      const position =
        userData?.position ||
        userData?.employment?.position ||
        userData?.employment?.name ||
        "Member";
      positionBadge.textContent = "" + position;
      resolvePositionName(positionBadge, position);
    }

    // Initialize presence tracking
    startPresenceTracking();

    // Initialize online users display
    const onlineContainer = document.getElementById("onlineUsersContainer");
    const onlineBadge = document.getElementById("onlineActiveBadge");
    if (onlineContainer && onlineBadge) {
      listenToOnlineUsers(onlineContainer, onlineBadge);
    }

    // Initialize announcements
    const announcementSection = document.getElementById(
      "announcementBannerSection",
    );
    const announcementContainer = document.getElementById(
      "announcementBannerContainer",
    );
    if (announcementSection && announcementContainer) {
      listenToHomeAnnouncements(
        announcementSection,
        announcementContainer,
        (announcement, color) => {
          const modalEl = document.getElementById("announcementDetailModal");
          if (!modalEl) return;

          const badgeEl = document.getElementById("announcementDetailBadge");
          const titleEl = document.getElementById("announcementDetailTitle");
          const targetEl = document.getElementById("announcementDetailTarget");
          const dateEl = document.getElementById("announcementDetailDate");
          const contentEl = document.getElementById(
            "announcementDetailContent",
          );

          const type = announcement.type || "info";
          badgeEl.textContent = type.toUpperCase();
          badgeEl.style.backgroundColor = color;
          badgeEl.style.color = "#fff";

          titleEl.textContent = announcement.title || "Untitled";
          targetEl.textContent =
            announcement.target_department_name || "All Employees";
          dateEl.textContent = announcement.created_at?.toDate
            ? formatDateID(announcement.created_at.toDate())
            : "-";
          contentEl.innerHTML =
            announcement.content ||
            "<span class='text-muted'>No content.</span>";

          const modal = window.bootstrap?.Modal?.getOrCreateInstance(modalEl);
          if (modal) modal.show();
        },
      );
    }

    // Initialize projects
    const pinnedContainer = document.getElementById("pinnedProjectsContainer");
    const otherContainer = document.getElementById("otherProjectsContainer");
    if (pinnedContainer && otherContainer) {
      window.onProjectsUpdated = (projects, stats) => {
        renderProjects(projects, stats, pinnedContainer, otherContainer);
      };
      setupProjectEventHandlers();
      listenToProjects();
    }

    // Load departments for new-project modal
    loadDepartments();

    // Initialize pending approvals
    const pendingSection = document.getElementById("pendingApprovalsSection");
    const pendingTableBody = document.getElementById("pendingUsersTableBody");
    if (pendingSection && pendingTableBody) {
      loadPendingApprovals(pendingSection, pendingTableBody);
    }

    // Initialize daily report approvals
    const dailyReportList = document.getElementById("dailyReportList");
    const dailyReportBadge = document.getElementById("dailyReportBadge");
    if (dailyReportList && dailyReportBadge) {
      loadDailyReportApprovals(
        dailyReportList,
        dailyReportBadge,
        getUserDepartment(),
      );
    }

    // Initialize menu badges
    startMenuBadgeRefresh();

    // Set up window event handlers
    setupWindowEventHandlers();

    // Set up project form submission
    setupProjectForm();

    isInitialized = true;
    console.log("Dashboard initialized successfully");
  } catch (error) {
    console.error("Failed to initialize dashboard:", error);
  }
}

/**
 * Populate user name/photo/role in shared layout
 */
function populateUserDisplay(user, userData) {
  const localData = userData || {};
  const userNameDisplay = document.getElementById("user-name-display");
  const userPhotoDisplay = document.getElementById("user-photo-display");
  const userRoleDisplay = document.getElementById("user-role-display");

  if (userNameDisplay) userNameDisplay.innerText = localData.name || user.email;
  if (userPhotoDisplay)
    userPhotoDisplay.src = localData.photo || "https://i.pravatar.cc/300";

  // Show readable position: prefer employment.position/role, else resolve the ID.
  if (userRoleDisplay) {
    const readable =
      localData.employment?.position ||
      localData.employment?.role ||
      localData.positionLabel ||
      localData.position_name ||
      "";
    if (readable && readable.length < 10) {
      userRoleDisplay.innerText = readable;
    } else {
      userRoleDisplay.innerText = "Loading...";
      resolvePositionName(userRoleDisplay, localData.position || readable, "");
    }
  }
}

/**
 * Update welcome message
 */
function updateWelcomeMessage(userData) {
  const welcomeMsg = document.getElementById("welcomeMessage");
  if (!welcomeMsg) return;
  welcomeMsg.innerText = formatGreeting(userData?.name || "");
}

/**
 * Set up project event handlers (pin + delete)
 */
function setupProjectEventHandlers() {
  document.addEventListener("click", (e) => {
    const trashIcon = e.target.closest(".project-trash-icon");
    if (trashIcon) {
      const projectId = trashIcon.getAttribute("data-project-id") || "";
      const projectName = trashIcon.getAttribute("data-project-name") || "";
      if (projectId) {
        e.preventDefault();
        e.stopPropagation();
        openDeleteProjectModal(projectId, projectName);
      }
      return;
    }

    const pinIcon = e.target.closest(".project-pin-icon");
    if (pinIcon) {
      const projectId = pinIcon.getAttribute("data-project-id") || "";
      if (!projectId) return;
      const pinnedAttr = pinIcon.getAttribute("data-project-pinned");
      const currentlyPinned = pinnedAttr === "true";
      e.preventDefault();
      e.stopPropagation();
      toggleProjectPin(projectId, !currentlyPinned);
    }
  });
}

/**
 * Set up window event handlers used by inline HTML onclick attributes
 */
function setupWindowEventHandlers() {
  // Approval handlers
  window.approveUser = approveUser;
  window.rejectUser = rejectUser;
  window.approveReport = approveReport;
  window.approveIndividualTasks = approveIndividualTasks;
  window.cancelApproveIndividual = cancelApproveIndividual;
  window.submitApproveIndividual = submitApproveIndividual;
  window.showRejectModal = showRejectModal;
  window.confirmRejectReport = confirmRejectReport;

  // Delete project
  window.confirmDeleteProject = async () => {
    const idInput = document.getElementById("deleteProjectId");
    const modalEl = document.getElementById("deleteProjectModal");
    if (!idInput || !modalEl) return;

    const projectId = idInput.value;
    if (!projectId) return;

    try {
      const projects = getCachedProjects() || [];
      const project = projects.find((p) => p.id === projectId) || null;
      await deleteProject(projectId, project);
      const modal = window.bootstrap?.Modal?.getInstance(modalEl);
      if (modal) modal.hide();
    } catch (e) {
      console.error("Failed to delete project", e);
      alert("Gagal menghapus project: " + (e.message || e.toString()));
    }
  };

  // Logout
  window.logout = logoutUser;

  // Sidebar toggle
  window.toggleSidebar = () => {
    const sidebar = document.getElementById("sidebarNav");
    if (!sidebar) return;
    const isMobile = window.innerWidth <= 991;
    if (isMobile) {
      sidebar.classList.toggle("show");
    } else {
      document.body.classList.toggle("sidebar-collapsed");
    }
  };
}

/**
 * Set up project form submission
 */
function setupProjectForm() {
  const saveProjectBtn = document.querySelector(
    "#createProjectForm .btn-dlg-blue",
  );
  if (saveProjectBtn) {
    saveProjectBtn.onclick = null;
    saveProjectBtn.addEventListener("click", () => saveProject());
  }
}

/**
 * Save project (wired to the inline button)
 */
async function saveProject() {
  const name = document.getElementById("inputProjectName")?.value;
  const desc = document.getElementById("inputProjectDesc")?.innerText;
  const pinnedInput = document.getElementById("inputProjectPinned");
  const isPinned = pinnedInput ? pinnedInput.checked : false;
  const saveBtn = document.querySelector("#createProjectForm .btn-dlg-blue");

  const dept = getSelectedDepartment();
  const departmentName = dept ? dept.name || "General" : "General";
  const departmentColor = dept ? dept.color || "" : "";

  if (!name) {
    alert("Please enter project name!");
    return;
  }

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerText = "Saving...";
  }

  try {
    await createProject({
      name,
      description: desc || "",
      is_pinned: isPinned,
      department: departmentName,
      department_color: departmentColor,
    });

    const nameInput = document.getElementById("inputProjectName");
    const descInput = document.getElementById("inputProjectDesc");
    if (nameInput) nameInput.value = "";
    if (descInput) descInput.innerText = "";

    const modal = window.bootstrap?.Modal?.getInstance(
      document.getElementById("newProjectModal"),
    );
    if (modal) modal.hide();
  } catch (error) {
    console.error("Error creating project:", error);
    alert("Failed to save project.");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerText = "Save changes";
    }
  }
}

/**
 * Clean up dashboard resources
 */
export function cleanupDashboard() {
  cleanupPresence();
  cleanupAnnouncements();
  cleanupProjects();
  cleanupApprovals();
  cleanupMenuBadges();

  window.onProjectsUpdated = null;
  window.approveUser = null;
  window.rejectUser = null;
  window.approveReport = null;
  window.approveIndividualTasks = null;
  window.cancelApproveIndividual = null;
  window.submitApproveIndividual = null;
  window.showRejectModal = null;
  window.confirmRejectReport = null;
  window.confirmDeleteProject = null;
  window.logout = null;
  window.toggleSidebar = null;

  isInitialized = false;
}

/**
 * Resolve a position doc ID into a readable name, if it looks like an ID.
 */
async function resolvePositionName(el, rawValue, prefix = "Position: ") {
  if (!rawValue || rawValue.trim().length < 10 || rawValue.includes(" ")) {
    return;
  }
  const key = rawValue.trim();
  const getName = (d) => d && (d.name || d.title || d.position || d.label);

  // Try the known-allowed collection FIRST (positions is in the rules).
  for (const coll of ["positions", "position"]) {
    try {
      const ref = doc(db, coll, key);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const name = getName(snap.data());
        if (name) {
          const parts = [name];
          if (prefix && snap.data().department)
            parts.push(`(${snap.data().department})`);
          el.textContent = parts.join(" ");
          return;
        }
      }
    } catch (e) {
      console.warn(`Failed to read ${coll}/${key}:`, e);
    }
  }

  // Fallback: scan the allowed positions collection for a matching id field.
  try {
    const listSnap = await getDocs(collection(db, "positions"));
    let matched = "";
    listSnap.forEach((docSnap) => {
      if (matched) return;
      const d = docSnap.data() || {};
      if (
        d.id === key ||
        d.position_id === key ||
        d._id === key ||
        docSnap.id === key
      ) {
        const name = getName(d);
        if (name) matched = name;
      }
    });
    if (matched) el.textContent = prefix + matched;
  } catch (e) {
    console.warn("Failed to scan positions:", e);
  }
}

/**
 * Format Indonesian date
 */
function formatDateID(date) {
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  const dayName = days[date.getDay()];
  const d = date.getDate();
  const m = months[date.getMonth()];
  const y = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${dayName}, ${d} ${m} ${y} • ${hh}:${mm}`;
}

// Initialize dashboard on load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initializeDashboard();
  });
} else {
  initializeDashboard();
}
