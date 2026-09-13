// element/topbar.js
// =====================================================================
// COMPATIBILITY SHIM — re-exports and adapts the consolidated topbar
// for legacy pages still importing from element/topbar.js.
// =====================================================================

import { buildTopbarHTML, applyProfile, bindTopbarEvents } from "../assets/js/components/topbar/topbar.ui.js";
import { getTopbarProfile } from "../assets/js/components/topbar/topbar.repository.js";
import { logout } from "../assets/js/auth-guard.js";
import { auth } from "../assets/js/firebase-config.js";

/**
 * Render TopBar for legacy pages.
 * Accepts either a container HTMLElement or context object.
 * @param {HTMLElement|Object} [targetOrCtx]
 */
export function renderTopBar(targetOrCtx) {
  const mount = targetOrCtx instanceof HTMLElement
    ? targetOrCtx
    : document.getElementById("topbarContainer") || document.getElementById("dg-topbar-mount");
  if (!mount) return;

  const ctx = (targetOrCtx && !(targetOrCtx instanceof HTMLElement)) ? targetOrCtx : {};
  const user = ctx.user || auth?.currentUser;
  const role = ctx.role || "";

  mount.innerHTML = buildTopbarHTML();

  const fallback = {
    name: user?.displayName || "",
    email: user?.email || "",
    photo: user?.photoURL || "",
    position: role || "",
  };

  applyProfile(mount, fallback);

  if (user?.uid) {
    getTopbarProfile(user.uid, fallback).then((profile) => {
      if (!mount.isConnected) return;
      applyProfile(mount, profile);
    });
  }

  bindTopbarEvents(mount, { onLogout: logout });
}

export { renderTopBar as renderTopbar };
