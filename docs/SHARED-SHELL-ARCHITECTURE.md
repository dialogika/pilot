# Shared Shell Architecture (Phase 2.5)

> Consolidates the two competing shell generations into ONE shared topbar
> and sidebar that reproduce the legacy Dialogika visual design while
> keeping clean module boundaries.

## 1. Problem Being Solved

Before this phase the project had **two competing shells**:

| Aspect | Legacy shell | New shell |
|---|---|---|
| Topbar | `element/topbar.js` (~10 KB) | `assets/js/topbar.js` (~2.7 KB) |
| Sidebar | `element/sidebar.js` (~525 KB / 9,859 lines) | `assets/js/sidebar.js` (~8.6 KB) |
| CSS | `assets/css/style.css` (~34 KB, all pages) | `assets/css/theme.css` + `layout.css` |
| Consumers | 55 legacy pages + `home.html` + `element/quest-board.html` | Home, Quest, Internships |
| Nav model | Hard-coded HTML + `data-gate` role hints (mostly inert) | Single legacy `MENU` + `NAV_ROLE_GATE` config |

The two shells diverged visually and behaviorally, so the shared shell
must reproduce the **legacy visual design** (brand logo, profile dropdown,
smart filters, nav categories, collapse toggle) as a single implementation.

## 2. Resulting Architecture

```
assets/
└── js/
    ├── components/
    │   ├── topbar/
    │   │   ├── topbar.js            orchestrator: renderTopbar({ user, role })
    │   │   ├── topbar.ui.js         legacy markup + DOM events
    │   │   └── topbar.repository.js users-doc + position-name resolution
    │   └── sidebar/
    │       ├── sidebar.js           orchestrator: renderSidebar({ role, activePage })
    │       ├── sidebar.config.js    NAV_ROLE_GATE + MENU + SMART_FILTERS data contract
    │       ├── sidebar.repository.js live smart-filter counts (Quest data)
    │       └── sidebar.ui.js        legacy markup + DOM events
    ├── core/* (existing)            firebase-config, auth-guard, ui, utils, theme
    └── css/
        ├── theme.css                design tokens (now includes legacy tokens)
        └── layout.css               extracted shell styles + loading overlay
```

The old flat files `assets/js/topbar.js` and `assets/js/sidebar.js` were
**removed** — exactly one shell implementation remains.

## 3. Module Rules

- **Orchestrator** (`topbar.js`, `sidebar.js`): coordinates auth context,
  rendering, repository data, event wiring. No Firestore, no raw DOM
  feature rendering.
- **UI** (`topbar.ui.js`, `sidebar.ui.js`): builds the legacy markup and
  binds DOM events. No Firestore access.
- **Repository** (`topbar.repository.js`, `sidebar.repository.js`): the only
  modules that touch Firebase. Return plain data.
- **Config** (`sidebar.config.js`): single source of truth for navigation.
  Adding/removing menu items happens here, not in HTML.

## 4. Navigation Model (`sidebar.config.js`)

The shared sidebar reproduces the **legacy sidebar nav exactly** — no
redesign. This is a parity-first decision: legacy behavior wins over
architecture elegance.

- `MENU` is a single nav shared by every role:
  - **Main Navigation**: Dashboard (collapsible submenu: Closing / Rebuy /
    Happy / Branding), Shortcut, Pings, Announcement!, Activity, My Stuff.
  - **System**: System Settings, Logout.
- `NAV_ROLE_GATE` + `roleCanShow()` mirror the legacy `data-gate` gating:
  - `shortcut` / `pings` → `owner`, `admin`, `team`.
  - `system-settings` → `owner`, `admin`.
  - Items without a gate always show; unknown roles hide gated items.
- **Dashboard is always `active`** (legacy hardcodes the class), so
  `activePage` is accepted for API compatibility but ignored — the legacy
  nav has no My Tasks / Internships entries to highlight.
- Dashboard submenu items stay **dead links** (`javascript:void(0)`),
  matching legacy exactly.
- `href` uses the **migrated canonical route** when the feature migrated
  (`/home`, `/quest`); otherwise the legacy route is preserved. Legacy
  broken/planned-but-missing routes are not reintroduced.
- "Under Development" items (Pings, Activity, My Stuff, System Settings)
  keep the legacy `alert('Under Development')` behavior.

## 5. Smart Filters & the Quest-Data Contract

The legacy sidebar rendered four smart-filter cards (Main Quest / Side
Quest / Project / Report) with **live counts** from the Quest collections
`tasks` and `quest_reports`.

Per Phase 2.5 rules, live counts are reproduced, but the coupling is
**isolated and documented**:

- `sidebar.config.js` exports `SMART_FILTERS` (presentation-only: label,
  icon, color, href, count element id) — the **data contract**.
- `sidebar.repository.js` is the **only** shell module that reads Quest
  collections. It mirrors legacy `refreshSidebarCounts` semantics:
  - Main Quest: `recur` tasks, not complete/archived.
  - Side Quest: `type=sidequest|side-quest` or has `task_status`,
    not complete/archived.
  - Project: **always `0`** — legacy never updates the Project card, so
    the shell does not compute it (parity-first).
  - Report: latest report per completed task (root `quest_reports` doc,
    falling back to `tasks/{id}/reports` subcollection), not `approved`.
- The UI only renders values provided by the repository. If the Quest
  collections ever change, update the contract + repository **together**,
  never the UI.

> Design note: the live count has a single documented cross-feature read
> (Quest data) that the shared shell performs. This is a deliberate,
> explicit exception; it does not reintroduce the legacy `window.*` global
> flooding or embedded Quest board modals.

## 6. What Was Removed From the Legacy Sidebar (not copied)

The consolidated shell intentionally **excludes** legacy dead/feature code:

- Embedded `questBoardModal` / `reportBoardModal` iframes + overlays.
- `initGlobalUsers`, `window.questTasksById`, `window.questUsersById`,
  `__appCacheInit` global caches.
- `parentWin` iframe coupling (`window.parent.db` etc.).
- Dead embedded quest board / daily report / side quest CRUD code (the
  legacy `questCard` redirect already sent users to
  `/element/quest-board.html`).
- The legacy `.modal { z-index: 5000 }` / `.modal-backdrop { z-index:
  4999 }` globals stay **out** — the only global modal override kept is
  the scoped `#logoutModal { z-index: 5001 }` in `layout.css`, so migrated
  pages' own modals/SweetAlert stacking is unchanged. (The legacy
  `#logoutModal` is rendered for markup parity but is **never opened** —
  matching legacy, logout is immediate.)

## 7. CSS Strategy

- `theme.css` gained the legacy tokens used by the shell (`--topbar-height`,
  `--sidebar-width`, `--surface-2`, `--surface-active`, `--surface-hover-strong`,
  `--text-muted-2`, `--text-faint`, `--icon-*`, `--shadow-*`, etc.) plus
  matching dark-mode overrides.
- `layout.css` now carries the **extracted** legacy shell styles
  (`.top-bar`, `.sidebar`, `.smart-filters-grid`, `.filter-card`,
  `.nav-category`, `.sidebar-link`, `.sidebar-submenu`, `.menu-badge`,
  `.profile-img-*`, `.profile-dropdown-*`, collapse + responsive rules)
  plus the loading overlay. It defines **no** `.sidebarCopyright` rule —
  legacy uses class `sidebarCopyright` (camelCase) with an inline style,
  and legacy `style.css` only has a never-matching `.sidebar-copyright`
  (kebab) rule, so none is applied here either (parity-first).
- `style.css` is **untouched** for legacy pages. The migrated pages load
  only `theme.css` + `layout.css`; no full `style.css` migration.

## 8. Coexistence & Migration Status

- Legacy `element/topbar.js`, `element/sidebar.js`, and `style.css` remain
  in place and drive the 55 legacy pages unchanged.
- Migrated features (Home, Quest, Internships) now import the consolidated
  shell from `assets/js/components/...`.
- As legacy pages migrate, they switch to the shared shell; legacy files
  can then be removed incrementally (not in this phase).

## 9. Verification

- `node --check` passes on all 7 shared modules.
- Hosting emulator smoke test: `/`, `/home`, `/quest`, `/internships`,
  `/test` all 200; all new assets 200; representative legacy pages
  (`home.html`, `setting/users-management.html`,
  `data/performance-appraisal-intern.html`) still 200.
- Node parity unit test (29 assertions) for `sidebar.ui.js`:
  smart-filter cards/hrefs/count ids/legacy `--dlg-*` colors, exact legacy
  nav (categories, Dashboard active + toggle, 4 dead submenu links,
  `#dashboardIcon`), role gating (owner shows shortcut/pings/
  system-settings; unknown role hides all gated items), logout + inert
  `#logoutModal` in DOM, copyright inline style, and `applyCounts`
  (project stays 0). All pass.
- Headless Chrome (CDP) harness: smart cards = 4, nav categories =
  Main Navigation|System, Dashboard active + 4 submenu links, gated items
  = 3 (owner), under-development alerts = 4, submenu toggle +
  `#dashboardIcon` icon swap work, `window.toggleSidebar` works, counts
  applied (7/3/0/2). No runtime exceptions.
- Auth boundary intact: unauthenticated `/home` redirects to `/index.html`
  (which is why the harness clicks are `preventDefault`-wired).
- Home apps grid: all 29 app-box hrefs verified existing; the migrated
  "Internship Management" box now points to `/internships` (was the legacy
  `setting/internship-management.html` route).