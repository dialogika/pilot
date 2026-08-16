// pages/home/home.js
// =====================================================================
// HOME ORCHESTRATOR — coordinates auth, shell, repository and UI.
//
// Flow:
//   requireAuth() → renderTopbar/renderSidebar
//       ↓
//   home.repository.js (data access)
//       ↓
//   home.ui.js (rendering + events)
//
// Rules:
//  - No Firestore queries here (use home.repository.js).
//  - No raw DOM rendering of data here (use home.ui.js).
//  - This file decides WHEN things happen and wires repo → ui.
// =====================================================================

import { requireAuth, logout } from "../../assets/js/auth-guard.js";
import { renderTopbar } from "../../assets/js/components/topbar/topbar.js";
import { renderSidebar } from "../../assets/js/components/sidebar/sidebar.js";
import * as repo from "./home.repository.js";
import * as ui from "./home.ui.js";

let unsubscribers = [];

function registerUnsub(fn) {
  if (typeof fn === "function") unsubscribers.push(fn);
}

/**
 * Initialize the Home feature.
 */
async function initializeHome() {
  try {
    // 1. Auth boundary — redirects to login if unauthenticated.
    const { user, role } = await requireAuth();

    // 2. Shared shell.
    renderTopbar({ user, role });
    renderSidebar({ role, activePage: "dashboard" });

    // 3. User data.
    const userData = await repo.getUserDoc(user.uid);
    const displayName = userData?.name || user.displayName || user.email || "";
    const position =
      userData?.position || userData?.employment?.position || userData?.employment?.name || "Member";
    ui.renderWelcome(displayName, role, position);

    // Resolve a readable position name when it looks like an id.
    if (
      userData?.position &&
      String(userData.position).trim().length >= 10 &&
      !String(userData.position).includes(" ")
    ) {
      const readable = await repo.resolvePositionName(userData.position);
      if (readable) ui.renderWelcome(displayName, role, readable);
    }

    const userDept = userData?.employment?.department || "";

    // 4. Presence: write own marker + listen for online users.
    repo.updatePresence({ uid: user.uid, name: displayName, photo: userData?.photo || "" });
    registerUnsub(repo.subscribeOnlineUsers((users) => ui.renderOnlineUsers(users, user.uid)));

    // 5. Announcements.
    registerUnsub(
      repo.subscribeAnnouncements(userDept, (items) => ui.renderAnnouncements(items)),
    );

    // 6. Daily report approvals.
    registerUnsub(
      repo.subscribeDailyReports(userDept, (reports) => ui.renderDailyReports(reports)),
    );

    // 7. Pending registrations.
    registerUnsub(repo.subscribePendingUsers((users) => ui.renderPendingUsers(users)));

    // 8. Wire interactions.
    wireEventHandlers();

    console.log("Home initialized");
  } catch (error) {
    console.error("Failed to initialize Home:", error);
  }
}

/**
 * Wire user-interaction events (delegated so dynamic content works).
 */
function wireEventHandlers() {
  const body = document.body;

  // Pending user approve/reject (buttons rendered dynamically).
  body.addEventListener("click", async (e) => {
    const approveBtn = e.target.closest("[data-approve-pending]");
    if (approveBtn) {
      e.preventDefault();
      const id = approveBtn.getAttribute("data-approve-pending");
      const ok = await ui.confirmAction("Are you sure you want to approve this user?");
      if (!ok) return;
      try {
        await repo.approvePendingUser(id, reviewerInfo());
        ui.notifySuccess("User approved successfully!");
      } catch (err) {
        ui.notifyError("Failed to approve user: " + (err.message || err));
      }
      return;
    }

    const rejectBtn = e.target.closest("[data-reject-pending]");
    if (rejectBtn) {
      e.preventDefault();
      const id = rejectBtn.getAttribute("data-reject-pending");
      const ok = await ui.confirmAction(
        "Are you sure you want to reject this user? Data will be deleted.",
        true,
      );
      if (!ok) return;
      try {
        await repo.rejectPendingUser(id);
        ui.notifySuccess("User rejected and deleted successfully.");
      } catch (err) {
        ui.notifyError("Failed to reject user: " + (err.message || err));
      }
    }
  });

  // Daily report: reject button in detail modal.
  const rejectReportBtn = document.getElementById("btnRejectReport");
  if (rejectReportBtn) rejectReportBtn.addEventListener("click", () => ui.showRejectModal());

  // Daily report: confirm reject in reject modal.
  const confirmRejectBtn = document.getElementById("btnConfirmReject");
  if (confirmRejectBtn) {
    confirmRejectBtn.addEventListener("click", async () => {
      const reportId = ui.getOpenReportId();
      if (!reportId) return;
      const reason = ui.getRejectReason();
      try {
        await repo.rejectReport(reportId, reason, reviewerInfo());
        ui.hideRejectModal();
        ui.hideDailyReportModal();
        ui.notifySuccess("Laporan berhasil ditolak");
      } catch (err) {
        ui.notifyError("Gagal menolak laporan: " + (err.message || err));
      }
    });
  }

  // Daily report: approve-all / individual buttons (re-wired after render).
  body.addEventListener("click", async (e) => {
    if (e.target.closest("#btnApproveAll")) {
      const reportId = ui.getOpenReportId();
      if (!reportId) return;
      ui.setReportActionBusy(true, "Menyetujui...");
      try {
        await repo.approveReport(reportId, reviewerInfo());
        ui.hideDailyReportModal();
        ui.notifySuccess("Laporan berhasil disetujui");
      } catch (err) {
        ui.notifyError("Gagal menyetujui laporan");
      } finally {
        ui.setReportActionBusy(false);
      }
      return;
    }

    if (e.target.closest("#btnApproveIndividual")) {
      ui.renderIndividualMode();
      return;
    }

    if (e.target.closest("#btnCancelIndividual")) {
      ui.renderCancelIndividual();
      return;
    }

    if (e.target.closest("#btnSubmitIndividual")) {
      const reportId = ui.getOpenReportId();
      const tasks = ui.getOpenReportTasks();
      const selected = ui.getSelectedTaskIndices();
      if (selected.length === 0) {
        ui.notifyError("Pilih setidaknya satu tugas untuk disetujui");
        return;
      }
      try {
        await repo.submitApproveIndividual(reportId, tasks, selected, reviewerInfo());
        ui.hideDailyReportModal();
        ui.renderCancelIndividual();
        ui.notifySuccess("Tugas yang dipilih berhasil disetujui");
      } catch (err) {
        ui.notifyError("Gagal menyetujui tugas");
      }
    }
  });
}

/**
 * Build the reviewer identity from the current auth + localStorage.
 */
function reviewerInfo() {
  let name = "";
  try {
    name = JSON.parse(localStorage.getItem("userData"))?.name || "";
  } catch (e) {}
  const user = repo.auth.currentUser;
  return { uid: user ? user.uid : "", name: name || (user ? user.email : "") };
}

/**
 * Clean up listeners and shared resources.
 */
export function cleanupHome() {
  unsubscribers.forEach((fn) => {
    try {
      fn();
    } catch (e) {}
  });
  unsubscribers = [];
}

// Expose logout for shared shell.
window.logout = logout;

// Boot on DOM ready.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeHome);
} else {
  initializeHome();
}