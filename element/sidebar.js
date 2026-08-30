// element/sidebar.js
// =====================================================================
// COMPATIBILITY SHIM — re-exports and adapts the consolidated sidebar
// for legacy pages still importing from element/sidebar.js.
// =====================================================================

import { buildSidebarHTML, applyCounts, bindSidebarEvents } from "../assets/js/components/sidebar/sidebar.ui.js";
import { getSidebarCounts } from "../assets/js/components/sidebar/sidebar.repository.js";
import { logout } from "../assets/js/auth-guard.js";
import { auth } from "../assets/js/firebase-config.js";
import { openQuestModal } from "../assets/js/components/quest-modal/quest-modal.js";
import { openReportModal } from "../assets/js/components/report-modal/report-modal.js";

/**
 * Render Sidebar for legacy pages.
 * Accepts either a container HTMLElement or options object.
 * @param {HTMLElement|Object} [targetOrOpts]
 * @param {Object} [opts]
 */
export function renderSidebar(targetOrOpts, opts = {}) {
  const mount = targetOrOpts instanceof HTMLElement
    ? targetOrOpts
    : document.getElementById("sidebarContainer") || document.getElementById("dg-sidebar-mount");
  if (!mount) return;

  const actualOpts = (targetOrOpts && !(targetOrOpts instanceof HTMLElement)) ? targetOrOpts : (opts || {});
  const role = actualOpts.role || null;
  const activePage = actualOpts.activePage || null;

  mount.innerHTML = buildSidebarHTML(role, activePage);

  bindSidebarEvents(mount, {
    onLogout: logout,
    onAction: (action) => {
      if (action === "openDaily") {
        openQuestModal({ initialTab: "daily" });
      } else if (action === "openQuest") {
        openQuestModal({ initialTab: "quest" });
      } else if (action === "openReport") {
        openReportModal({ initialTab: "daily" });
      }
    },
  });

  const refreshCounts = () => {
    getSidebarCounts()
      .then((counts) => {
        if (!mount.isConnected) return;
        applyCounts(mount, counts);
      })
      .catch(() => {});
  };

  refreshCounts();

  if (auth && typeof auth.onAuthStateChanged === "function") {
    auth.onAuthStateChanged(() => {
      if (mount.isConnected) refreshCounts();
    });
  }
}
