// assets/js/components/topbar/topbar.js
// =====================================================================
// SHARED TOPBAR — orchestrator for the consolidated app shell.
//
// This is the SINGLE shared topbar implementation (replaces the legacy
// element/topbar.js and the previous assets/js/topbar.js). It renders
// the legacy Dialogika visual design:
//  - brand logo, mobile sidebar toggle, theme toggle
//  - user name + role (position) display
//  - profile dropdown with Logout
//
// Usage:
//   <div id="dg-topbar-mount"></div>
//   <script type="module">
//     import { renderTopbar } from "/assets/js/components/topbar/topbar.js";
//     renderTopbar({ user, role });
//   </script>
//
// RULES:
//  - Shared layout behavior ONLY. No feature-specific logic or queries.
//  - All Firestore access lives in topbar.repository.js.
//  - All DOM/rendering lives in topbar.ui.js.
//  - Mounts to <div id="dg-topbar-mount"></div>.
// =====================================================================

import { logout } from "../../auth-guard.js";
import { buildTopbarHTML, applyProfile, bindTopbarEvents } from "./topbar.ui.js";
import { getTopbarProfile } from "./topbar.repository.js";

/**
 * Render the shared topbar into #dg-topbar-mount.
 * @param {{ user?: Object|null, role?: string|null }} [ctx]
 */
export function renderTopbar(ctx = {}) {
  const mount = document.getElementById("dg-topbar-mount");
  if (!mount) return;

  const { user = null, role = null } = ctx;

  mount.innerHTML = buildTopbarHTML();

  const uid = user?.uid || "";
  const fallback = {
    name: user?.displayName || "",
    email: user?.email || "",
    photo: user?.photoURL || "",
    position: role || "",
  };

  // Render instantly with auth fallback, then hydrate with the users doc.
  applyProfile(mount, fallback);

  getTopbarProfile(uid, fallback).then((profile) => {
    if (!mount.isConnected) return;
    applyProfile(mount, profile);
  });

  bindTopbarEvents(mount, { onLogout: logout });
}