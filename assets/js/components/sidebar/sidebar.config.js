// assets/js/components/sidebar/sidebar.config.js
// =====================================================================
// SIDEBAR CONFIG — LEGACY navigation model (source of truth:
// element/sidebar.js renderSidebar markup, lines 255-353).
//
// The shared sidebar reproduces the LEGACY sidebar nav EXACTLY:
//   Main Navigation: Dashboard (collapsible submenu), Shortcut, Pings,
//                    Announcement!, Activity, My Stuff
//   System:          System Settings, Logout
//
// Role gating mirrors legacy NAV_ROLE_GATE (data-gate):
//   shortcut / pings  -> owner, admin, team
//   system-settings   -> owner, admin
// Items WITHOUT a gate always show. Unknown role hides gated items.
//
// NAV RULES:
//  - href uses the migrated canonical route when the feature migrated
//    (/home, /quest); otherwise the legacy route is preserved.
//  - Legacy Dashboard submenu items are dead links
//    (javascript:void(0)) — preserved as-is (parity-first).
//  - "Under Development" items keep the legacy alert() behavior.
//  - activePage is accepted for API compatibility; legacy always marks
//    Dashboard active, so the shared sidebar reproduces that.
// =====================================================================

export const NAV_ROLE_GATE = {
  shortcut: ["owner", "admin", "team"],
  pings: ["owner", "admin", "team"],
  "system-settings": ["owner", "admin"],
};

/**
 * Whether a role may see a gated nav item (mirrors legacy roleCanShow).
 * @param {string|null|undefined} gateKey
 * @param {string|null|undefined} role
 * @returns {boolean}
 */
export function roleCanShow(gateKey, role) {
  if (!gateKey) return true;
  const allowed = NAV_ROLE_GATE[gateKey];
  if (!allowed) return true;
  if (!role) return false;
  return allowed.includes(role);
}

/** Single legacy nav (same for every role; gated items are hidden). */
export const MENU = [
  { section: "Main Navigation" },
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/home",
    icon: "bi-columns-gap",
    active: true, // legacy hardcodes "active" on Dashboard
    toggle: true,
    badge: "dashboard",
    submenu: [
      { label: "Closing", href: "javascript:void(0)" },
      { label: "Rebuy", href: "javascript:void(0)" },
      { label: "Happy", href: "javascript:void(0)" },
      { label: "Branding", href: "javascript:void(0)" },
    ],
  },
  {
    id: "shortcut",
    label: "Shortcut",
    href: "#",
    icon: "bi-list-columns-reverse",
    gate: "shortcut",
    badge: "shortcut",
    underDevelopment: true,
  },
  {
    id: "pings",
    label: "Pings",
    href: "javascript:void(0)",
    icon: "bi-chat-dots",
    gate: "pings",
    badge: "pings",
    underDevelopment: true,
  },
  {
    id: "announcement",
    label: "Announcement!",
    href: "/setting/announcement.html",
    icon: "bi-bell",
    badge: "hey",
  },
  {
    id: "activity",
    label: "Activity",
    href: "javascript:void(0)",
    icon: "bi-activity",
    badge: "activity",
    underDevelopment: true,
  },
  {
    id: "my-stuff",
    label: "My Stuff",
    href: "javascript:void(0)",
    icon: "bi-person-circle",
    badge: "my-stuff",
    underDevelopment: true,
  },
  { section: "System" },
  {
    id: "system-settings",
    label: "System Settings",
    href: "javascript:void(0)",
    icon: "bi-gear",
    gate: "system-settings",
    badge: "system-settings",
    underDevelopment: true,
  },
  {
    id: "logout",
    label: "Logout",
    href: "javascript:void(0)",
    icon: "bi-box-arrow-right",
    danger: true,
    logout: true,
  },
];

/**
 * SMART FILTER CARDS — legacy presentation contract (element/sidebar.js).
 * ---------------------------------------------------------------------
 * The grid is a shell-level widget; live counts come from
 * sidebar.repository.js. hrefs use the migrated canonical route when the
 * feature migrated (quest -> /quest, home -> /home), otherwise the
 * legacy route is preserved. Report card keeps the legacy id.
 */
export const SMART_FILTERS = [
  {
    id: "mainQuest",
    label: "Main Quest",
    icon: "bi-archive-fill",
    color: "var(--dlg-blue)",
    href: "/quest",
    countEl: "mainQuestCount",
  },
  {
    id: "sideQuest",
    label: "Side Quest",
    icon: "bi-archive-fill",
    color: "var(--dlg-yellow)",
    href: "/quest",
    countEl: "sideQuestCount",
  },
  {
    id: "project",
    label: "Project",
    icon: "bi-calendar-event-fill",
    color: "var(--dlg-purple)",
    href: "/home",
    countEl: "projectTasksTotalCount",
  },
  {
    id: "report",
    label: "Report",
    icon: "bi-calendar-event-fill",
    color: "var(--dlg-green)",
    href: "/quest",
    countEl: "reportPendingApprovalCount",
    cardId: "reportFilterCard",
  },
];
