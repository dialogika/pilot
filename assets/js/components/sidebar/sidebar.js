// assets/js/components/sidebar/sidebar.js
// =====================================================================
// SHARED SIDEBAR — orchestrator for the consolidated app shell.
//
// This is the SINGLE shared sidebar implementation (replaces the legacy
// element/sidebar.js and the previous assets/js/sidebar.js). It renders
// the legacy Dialogika visual design (smart filters, nav categories,
// Dashboard submenu, logout) driven entirely by the navigation
// model in sidebar.config.js.
//
// Usage:
//   <div id="dg-sidebar-mount"></div>
//   <script type="module">
//     import { renderSidebar } from "/assets/js/components/sidebar/sidebar.js";
//     renderSidebar({ role, activePage });
//   </script>
//
// RULES:
//  - Shared layout behavior ONLY. No feature-specific logic or queries.
//  - All Firestore access lives in sidebar.repository.js (documented
//    Quest-data contract in sidebar.config.js).
//  - All DOM/rendering lives in sidebar.ui.js.
//  - Mounts to <div id="dg-sidebar-mount"></div>.
// =====================================================================

import { logout } from "../../auth-guard.js";
import { buildSidebarHTML, applyCounts, bindSidebarEvents } from "./sidebar.ui.js";
import { getSidebarCounts } from "./sidebar.repository.js";
import { openQuestModal } from "../quest-modal/quest-modal.js";
import { openReportModal } from "../report-modal/report-modal.js";

/**
 * Render the shared sidebar into #dg-sidebar-mount.
 * @param {{ role?: string|null, activePage?: string|null }} [opts]
 */
export function renderSidebar(opts = {}) {
  const mount = document.getElementById("dg-sidebar-mount");
  if (!mount) return;

  const { role = null, activePage = null } = opts;

  mount.innerHTML = buildSidebarHTML(role, activePage);

  bindSidebarEvents(mount, {
    onLogout: logout,
    onAction: (action) => {
      if (action === "openDaily") {
        openQuestModal({ initialTab: "daily" });
      } else if (action === "openQuest") {
        openQuestModal({ initialTab: "quest" });
      } else if (action === "openReport") {
        openReportModal({ initialTab: "side" });
      }
    },
  });

  // Live smart-filter counts (best-effort; the shell stays usable when
  // the Quest collections are unavailable).
  getSidebarCounts()
    .then((counts) => {
      if (!mount.isConnected) return;
      applyCounts(mount, counts);
    })
    .catch(() => {});
}