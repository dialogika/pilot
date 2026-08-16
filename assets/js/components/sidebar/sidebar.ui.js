// assets/js/components/sidebar/sidebar.ui.js
// =====================================================================
// SIDEBAR UI — pure rendering + DOM events for the shared sidebar.
//
// Reproduces the LEGACY sidebar markup EXACTLY (element/sidebar.js
// renderSidebar, lines 255-353):
//  - smart-filters grid (4 cards, counts injected via applyCounts)
//  - Main Navigation: Dashboard (collapsible submenu), Shortcut, Pings,
//    Announcement!, Activity, My Stuff
//  - System: System Settings, Logout
//  - hidden menu-badge spans (data-menu-badge) kept for markup parity
//  - logout modal kept in the DOM but never opened (legacy behavior)
//  - copyright footer (inline style, matching legacy)
//
// RULES:
//  - NO Firebase/Firestore access here (use sidebar.repository.js).
//  - Navigation content comes ONLY from sidebar.config.js.
//  - NO feature logic.
// =====================================================================

import { MENU, SMART_FILTERS, roleCanShow } from "./sidebar.config.js";

/**
 * Build the legacy sidebar HTML.
 * @param {string|null} role
 * @param {string|null} activePage
 * @returns {string}
 */
export function buildSidebarHTML(role, activePage) {
  // --- Smart filters (4 cards) ---
  const filtersHtml = SMART_FILTERS.map((f) => `
    <a href="${f.href}" class="filter-card"${f.cardId ? ` id="${f.cardId}"` : ""}>
      <div class="filter-top"><div class="filter-icon" style="background-color: ${f.color};"><i class="bi ${f.icon}"></i></div><div class="filter-count" id="${f.countEl}">0</div></div>
      <div class="filter-label">${f.label}</div>
    </a>`).join("");

  // --- Navigation links (legacy markup, gated by role) ---
  let navHtml = "";
  MENU.forEach((item) => {
    if (item.section) {
      navHtml += `<div class="nav-category${item.section === "System" ? " mt-4" : ""}">${item.section}</div>`;
      return;
    }
    if (item.gate && !roleCanShow(item.gate, role)) return;

    const badgeSpan = item.badge
      ? ` <span class="menu-badge menu-badge-inline menu-badge-hidden" data-menu-badge="${item.badge}"></span>`
      : "";
    const gateAttr = item.gate ? ` data-gate="${item.gate}"` : "";
    const devAttr = item.underDevelopment ? ` onclick="alert('Under Development')"` : "";

    if (item.logout) {
      navHtml += `<a href="${item.href}" class="sidebar-link text-danger" id="logoutBtn">
        <i class="bi bi-box-arrow-right"></i> Logout</a>`;
      return;
    }

    if (item.toggle) {
      const submenuHtml = (item.submenu || [])
        .map((s) => `<a href="${s.href}" class="sidebar-submenu-link">${s.label}</a>`)
        .join("");
      navHtml += `
        <a href="${item.href}" class="sidebar-link active" onclick="window.toggleDashboardMenu(this)"${gateAttr}>
          <i class="bi ${item.icon}"></i> ${item.label}${badgeSpan}
          <span class="sidebar-badge"><i class="bi bi-arrow-left-square-fill" id="dashboardIcon"></i></span>
        </a>
        <div class="sidebar-submenu">${submenuHtml}</div>`;
      return;
    }

    navHtml += `<a href="${item.href}" class="sidebar-link"${gateAttr}${devAttr}><i class="bi ${item.icon}"></i> ${item.label}${badgeSpan}</a>`;
  });

  return `
    <aside class="sidebar" id="sidebarNav">
      <div class="sidebar-scroll-wrapper">
        <div class="smart-filters-grid">${filtersHtml}</div>

        ${navHtml}
      </div>

      <!-- Logout Confirmation Modal (kept in the DOM for legacy markup
           parity; legacy never opens it — logout is immediate) -->
      <div class="modal fade" id="logoutModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title text-danger">
                <i class="bi bi-exclamation-triangle"></i> Konfirmasi Logout
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              Apakah Anda yakin ingin logout?
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                Batal
              </button>
              <button type="button" class="btn btn-danger" id="confirmLogout">
                Ya, Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="sidebarCopyright fw-semibold" style="font-size: 12px; margin: 12px 16px 16px;">
        &copy; Copyright 2025<br/> PT Dialogika Persona Indonesia
      </div>
    </aside>`;
}

/**
 * Inject live counts into the smart-filter cards.
 * @param {HTMLElement} mount
 * @param {{mainQuest:number,sideQuest:number,project:number,report:number}} counts
 */
export function applyCounts(mount, counts) {
  const map = {
    mainQuestCount: counts.mainQuest,
    sideQuestCount: counts.sideQuest,
    projectTasksTotalCount: counts.project,
    reportPendingApprovalCount: counts.report,
  };
  Object.keys(map).forEach((elId) => {
    const el = mount.querySelector(`#${elId}`);
    if (el) el.textContent = String(map[elId] || 0);
  });
}

/**
 * Wire all sidebar DOM events.
 * @param {HTMLElement} mount
 * @param {{ onLogout: Function }} handlers
 */
export function bindSidebarEvents(mount, { onLogout }) {
  // Shared sidebar toggle (used by the topbar mobile-toggle button).
  if (
    typeof window !== "undefined" &&
    typeof window.toggleSidebar !== "function"
  ) {
    window.toggleSidebar = function () {
      const sidebar = document.getElementById("sidebarNav");
      if (!sidebar) return;
      const isMobile = window.innerWidth <= 991;
      if (isMobile) {
        sidebar.classList.toggle("show");
        return;
      }
      document.body.classList.toggle("sidebar-collapsed");
    };
  }

  // Dashboard collapsible submenu (legacy window.toggleDashboardMenu).
  if (
    typeof window !== "undefined" &&
    typeof window.toggleDashboardMenu !== "function"
  ) {
    window.toggleDashboardMenu = function (el) {
      const submenu = el.nextElementSibling;
      const icon = document.getElementById("dashboardIcon");
      if (submenu) {
        const isShow = submenu.classList.toggle("show");
        if (icon) {
          if (isShow) {
            icon.classList.remove("bi-arrow-left-square-fill");
            icon.classList.add("bi-arrow-down-square-fill");
          } else {
            icon.classList.remove("bi-arrow-down-square-fill");
            icon.classList.add("bi-arrow-left-square-fill");
          }
        }
      }
    };
  }

  // Logout — immediate, matching legacy (the modal is never opened).
  const logoutBtn = mount.querySelector("#logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (typeof onLogout === "function") onLogout();
    });
  }
}