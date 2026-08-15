// assets/js/topbar.js
// =====================================================================
// SHARED TOPBAR — app shell component for the NEW architecture.
//
// RULES:
//  - Shared layout behavior ONLY. No feature-specific logic or queries.
//  - Mounts to <div id="dg-topbar-mount"></div>.
//  - Coexists with the legacy element/topbar.js (legacy pages keep using
//    element/topbar.js until they are migrated).
//
// Usage:
//   <div id="dg-topbar-mount"></div>
//   <script type="module">
//     import { renderTopbar } from "/assets/js/topbar.js";
//     renderTopbar({ user, role });
//   </script>
// =====================================================================

import { logout } from "./auth-guard.js";

/**
 * Render the shared topbar into #dg-topbar-mount.
 * @param {{ user?: Object|null, role?: string|null }} [ctx]
 */
export function renderTopbar(ctx = {}) {
  const mount = document.getElementById("dg-topbar-mount");
  if (!mount) return;

  const { user = null, role = null } = ctx;
  const displayName = user?.displayName || user?.email || "User";
  const photo = user?.photoURL || "https://i.pravatar.cc/300";

  mount.innerHTML = `
    <header class="dg-topbar">
      <div class="dg-topbar-left">
        <button type="button" class="dg-topbar-toggle" aria-label="Toggle sidebar">
          <i class="bi bi-list"></i>
        </button>
      </div>
      <div class="dg-topbar-center">
        <strong class="dg-topbar-brand">DIALOGIKA</strong>
      </div>
      <div class="dg-topbar-right">
        <button type="button" class="dg-theme-toggle theme-toggle" aria-label="Toggle theme">
          <i class="bi bi-moon-stars" data-icon-dark="bi bi-moon-stars" data-icon-light="bi bi-sun"></i>
        </button>
        <div class="dg-topbar-user">
          <img src="${photo}" alt="${displayName}" class="dg-topbar-avatar" />
          <div class="dg-topbar-user-meta">
            <span class="dg-topbar-user-name">${displayName}</span>
            <span class="dg-topbar-user-role">${role || ""}</span>
          </div>
          <button type="button" id="dg-topbar-logout" class="dg-topbar-logout" aria-label="Logout">
            <i class="bi bi-box-arrow-right"></i>
          </button>
        </div>
      </div>
    </header>`;

  const logoutBtn = mount.querySelector("#dg-topbar-logout");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  const toggle = mount.querySelector(".dg-topbar-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      document.body.classList.toggle("dg-sidebar-collapsed");
    });
  }

  if (window.DLGTheme && window.DLGTheme.syncIcons) window.DLGTheme.syncIcons();
}