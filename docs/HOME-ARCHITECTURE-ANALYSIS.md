# Home — Architecture Analysis (Phase 1A Discovery)

> Phase 1 discovery deliverable. Written before any implementation.
> The goal is to understand how the **legacy Home** actually works so the
> new Home can be a faithful, better-structured reference implementation.

---

## 1. Current Home Entry Point

- **Public URL:** `/home.html` (root file, still served by Firebase Hosting as `home.html`).
- **HTML entry:** `home.html` (1011 lines).
- **Main JS module:** `pages/home/home-dashboard.js` (loaded via `<script type="module" src="pages/home/home-dashboard.js">`).
- **Shell components used:** **legacy** `element/topbar.js` + `element/sidebar.js`, mounted into
  `#topbarContainer` and `#sidebarContainer` respectively.

> Important: the new shared shell (`assets/js/topbar.js`, `assets/js/sidebar.js`, which mount
> to `#dg-topbar-mount` / `#dg-sidebar-mount`) is **NOT** used by legacy Home yet. Home still
> uses the legacy `element/*` components.

---

## 2. Current Home Files

| File | Responsibility |
|---|---|
| `home.html` | Full markup: shell containers, welcome, online users, announcements, daily-report + pending-approval sections, static apps grid (HR/Marketing/Product/Branding), 4 modals (daily report, reject, user profile, announcement detail, new project, delete project). |
| `pages/home/home-dashboard.js` | Orchestrator. Renders shell, resolves auth + role, wires presence/announcements/projects/approvals/menu-badges, sets window handlers for inline `onclick`, cleanup. |
| `pages/home/home-firebase.js` | Re-exports `assets/js/firebase-config.js` + Firestore/Auth SDK functions. Own auth-state manager (`initializeAuth` via `onAuthStateChanged`), userData cache, `logoutUser`. |
| `pages/home/home-utils.js` | Home-local utils: `formatGreeting`, `getMs`, `isRecentByFields`, `normalizeStatus`, `formatDateID`, `addMonths`, `escapeHtml`, `debounce`, `throttle`, `truncateText`, `stripHtml`. |
| `pages/home/home-presence.js` | Presence: writes own presence every 60s, listens to `user_presence`, renders online avatars + active badge. |
| `pages/home/home-announcements.js` | Listens to `announcements` (active), filters by department, renders banner, opens detail modal. |
| `pages/home/home-projects.js` | Projects listener + task stats + create/pin/delete + department options. **(dormant — see §10)** |
| `pages/home/home-approvals.js` | Pending user approvals + daily-report approvals + detail modal + approve/reject flows. |
| `pages/home/home-menu-badges.js` | Refreshes cross-feature menu badges every 60s. |

---

## 3. Home Responsibilities

Visually, legacy Home shows (top → bottom):

1. **Welcome header** — `#welcomeMessage` greeting + `#dashboard-role-badge` + `#dashboard-position-badge`.
2. **Who is Online** — `#onlineUsersContainer` avatars + `#onlineActiveBadge` count.
3. **Announcements** — `#announcementBannerContainer` (pinned first, top 5, dept-filtered) with detail modal.
4. **Daily Report Approval** — `#dailyReportList` (dept-filtered, pending status) + detail modal + approve/reject.
5. **Pending Registrations** — `#pendingUsersTableBody` (from `pending_users` where `is_approved == false`).
6. **Apps Overview** — static grid of links grouped by division (HR / Marketing / Product / Branding), with `data-menu-badge` counters on some app-boxes.
7. **New Project modal** — create project (department picker, pinned toggle).
8. **Delete Project modal** — confirm delete.

---

## 4. Home Functions

### Presentation (render)
- `renderTopBar`, `renderSidebar` (via legacy `element/*`)
- `populateUserDisplay` (name/photo/role in shell)
- `updateWelcomeMessage`
- `listenToOnlineUsers` → renders avatar list + count badge
- `listenToHomeAnnouncements` → renders announcement cards
- `loadDailyReportApprovals` → renders report rows + count badge
- `loadPendingApprovals` → renders table rows
- `renderProjects` → renders pinned/unpinned project cards + progress
- `renderDepartmentOptions` → department pill buttons
- `renderNoRoleError` (in auth-guard)

### Data Access (Firestore reads/writes)
- `initializeAuth` → `onAuthStateChanged` + `getDoc(users/{uid})`
- `updateOwnPresence` → `setDoc(user_presence/{uid})`
- `listenToOnlineUsers` → `onSnapshot(user_presence)`
- `listenToHomeAnnouncements` → `onSnapshot(announcements where active==true)`
- `loadDailyReportApprovals` → `onSnapshot(intern_dailyreport where status in Pending…)`
- `loadPendingApprovals` → `onSnapshot(pending_users where is_approved==false)`
- `listenToProjects` → `onSnapshot(projects orderBy created_at desc limit 50)`
- `fetchTaskStatsForProjects` → `getCountFromServer(tasks where project_id==…)` per project
- `loadDepartments` → `getDocs(departments)`
- `createProject` → `addDoc(projects, …)`
- `toggleProjectPin` → `updateDoc(projects/{id}, {is_pinned, pinned})`
- `deleteProject` → `addDoc(trash, …)` + `deleteDoc(projects/{id})`
- `approveUser` / `rejectUser` → `setDoc`+`deleteDoc` / `deleteDoc` on `pending_users`/`users`
- `approveReport` / `submitApproveIndividual` / `confirmRejectReport` → `updateDoc(intern_dailyreport/{id})`
- `backfillTaskPoints` → `getDoc(tasks/{task_id})`
- `ensureHomeUsersMap` → `getDocs(users)`
- menu badges → many `getDocs`/`getCountFromServer` across ~10 collections

### Business Logic
- greeting time-of-day (`formatGreeting`)
- role resolution: custom claim → `userData.access.role_id`/`roleId`
- position badge resolution (`resolvePositionName`, reads `positions`/`position`)
- announcement dept filtering + pinned-first + top-5 sort
- daily-report dept filtering + pending-status matching
- online active-vs-today logic (1-hour window)
- project progress % + color thresholds; pinned/unpinned split
- pending approval `is_approved==false`

### Application Infrastructure (shared)
- `auth-guard.js` (`requireAuth` — actually Home uses its **own** `initializeAuth`, not `requireAuth`)
- legacy `element/topbar.js`, `element/sidebar.js`
- `theme.js`
- inline `bootstrap`, `Swal` (SweetAlert2) CDN globals

### Navigation
- Sidebar links (`/home.html`, `/quest/my-tasks.html`, etc.)
- Apps grid links (hardcoded relative paths e.g. `data/performance-appraisal-intern.html`)
- `logoutUser` → `signOut` + redirect `index.html`
- project cards → `project/project.html?id=…`

### Legacy / Unclear
- **`window.teamMemberDepartment`** — set as a global side effect inside `home-firebase.js`, read by announcements + approvals. Global coupling.
- **Inline `onclick` + `window.*` globals** — `home-dashboard.js` sets `window.approveUser`, `window.confirmRejectReport`, `window.logout`, `window.onProjectsUpdated`, etc. so inline HTML handlers work.
- **Projects code is dormant**: `home.html` has **no** `#pinnedProjectsContainer` / `#otherProjectsContainer` elements. `home-dashboard.js` guards project init behind `if (pinnedContainer && otherContainer)`, so the entire projects feature never runs on the current Home page. Status: **UNKNOWN / NEEDS REVIEW** — kept for comparison, not part of visible behavior.

---

## 5. Firebase Dependency Map

```
Home
 ├── Authentication
 │    └── onAuthStateChanged → user.uid
 │
 ├── Firestore
 │    ├── users/{uid}                    getDoc (profile/name/photo/position/dept)
 │    ├── user_presence/{uid}            setDoc (own presence, merge)
 │    ├── user_presence                  onSnapshot (all online users)
 │    ├── announcements                  onSnapshot (where active == true)
 │    ├── intern_dailyreport             onSnapshot (where status in Pending…)
 │    ├── intern_dailyreport/{id}        updateDoc (approve/reject)
 │    ├── tasks/{task_id}                getDoc (backfill points)
 │    ├── pending_users                  onSnapshot (where is_approved == false)
 │    ├── pending_users/{id}             getDoc/setDoc/deleteDoc
 │    ├── users                          getDocs (name map)
 │    ├── positions , position           getDoc / getDocs (resolve position name)
 │    ├── projects                       onSnapshot (orderBy created_at desc, limit 50) [dormant]
 │    ├── tasks                          getCountFromServer (where project_id == …) [dormant]
 │    ├── departments                    getDocs [dormant]
 │    └── trash                          addDoc [dormant]
 │
 ├── Storage
 │    └── (none — Home uses photo URL strings only)
 │
 └── Functions
      └── (none called directly by Home)
```

> Collection names are taken **verbatim** from the code. No invented names.

---

## 6. Shared Dependencies (what should NOT belong to Home)

From the Phase 0 foundation (`assets/js/` + `assets/css/`), the new Home should reuse:

- `assets/js/firebase-config.js` → single `db`/`auth`/`storage` init (already centralized; do not re-init).
- `assets/js/auth-guard.js` → `requireAuth()`, `logout()` (auth boundary). Home currently duplicates this in `home-firebase.js#initializeAuth` — this is exactly what should be replaced.
- `assets/js/topbar.js` → `renderTopbar({ user, role })` (new shell).
- `assets/js/sidebar.js` → `renderSidebar({ role, activePage })` (new shell, role-filtered menu).
- `assets/js/ui.js` → `toast`, `confirmDialog`, `showModal`, `hideModal`, `showLoading`, `hideLoading`, `setButtonBusy`.
- `assets/js/utils.js` → `getMs`, `formatDateID`, `addMonths`, `escapeHtml`, `stripHtml`, `truncateText`, `normalizeStatus`, `debounce`, `throttle`.
- `assets/css/theme.css` (tokens + dark mode) and `assets/css/layout.css` (shell).

Overlaps found (Home re-implements foundation):
- `home-utils.js` duplicates `utils.js` (formatDateID, getMs, escapeHtml, stripHtml, debounce, throttle, truncateText, normalizeStatus, addMonths). → Replace with `utils.js`.
- `home-firebase.js` duplicates auth-guard's job (`initializeAuth`). → Replace with `requireAuth`.

---

## 7. Navigation Dependencies

- Sidebar (legacy `element/sidebar.js`) links to `home.html`, quest, project, data pages.
- Apps grid in `home.html` hardcodes relative links to many legacy pages.
- Logout → `signOut(auth)` + `window.location.href = "index.html"`.
- New Home route should be `/home` (public) → `pages/home/index.html` (physical). Sidebar + app links should point to public URLs, not file paths.

---

## 8. CSS Dependencies

Legacy Home relies on:
- `assets/css/style.css` (1000 lines, global legacy styles: `.app-box`, `.project-card`, `.avatar-*`, `.online-*`, `.menu-badge`, sidebar/topbar layout).
- Inline `<style>` block in `home.html` (~150 lines: new-project placeholder, modal, toggle switch, project-card actions, announcement wrap).
- Bootstrap 5.3 + Bootstrap Icons + Poppins via CDN.

New Home should use `theme.css` + `layout.css` for the shell, `home.css` for Home-specific styles (app grid, online avatars, announcement cards, report rows), and Bootstrap/Icons via CDN.

---

## 9. Legacy Coupling (most dangerous)

1. **Inline `onclick="window.xxx()"`** + `window.*` globals set in `home-dashboard.js` — Home's actions only work because global functions exist. High coupling, hard to test.
2. **Global `window.teamMemberDepartment`** set in `home-firebase.js` and read elsewhere — implicit global state.
3. **`home-firebase.js` re-export barrel + its own auth state** — mixes re-export, auth, and localStorage caching; Home doesn't use the standardized `requireAuth`.
4. **Projects code dormant** — dead-ish code still shipped; containers missing. Risk of confusion.
5. **DOM + data mixed** in presence/announcements/approvals (each module both queries Firestore and renders DOM). Not separable.
6. **Duplicated utils** (`home-utils.js` vs `utils.js`).
7. **Hardcoded legacy navigation** (apps grid relative paths, project `href`).
8. **Inline `<style>`** in HTML.
9. **Global CSS** `style.css` affecting the shell.
10. **CDN globals** (`bootstrap`, `Swal`) relied on directly without import.

---

## 10. Risk Areas

- **Do not break** the working sections: welcome/badges, online users, announcements, daily-report approvals, pending registrations, apps grid.
- **Do not deploy**, **do not touch production data/rules**.
- **Dormant projects code**: do NOT delete (legacy safety); keep for comparison, do not re-activate without a documented reason.
- **Auth**: must use `requireAuth()` (redirect to login if unauthenticated), preserve "role required" fail-safe.
- **Emulator**: all local reads/writes must hit the Firestore emulator; never production.

---

## 11. Recommended Feature Boundary

```
pages/home/
├── index.html            # page markup + shell mounts + static apps grid + modals
├── home.js               # orchestrator: requireAuth → render shell → coordinate repo+ui
├── home.repository.js    # all Home Firestore/Auth data access
├── home.ui.js            # all Home DOM rendering + event wiring (no queries)
└── home.css              # Home-specific styles
```

Boundary rule applied:
- "How does Home get data?" → `home.repository.js`
- "How does Home display data?" → `home.ui.js`
- "When should Home do something?" → `home.js`
- generic infra used by many features → `assets/js/*`, `assets/css/*`

---

## 12. Proposed New Structure

```
pages/home/
├── index.html
├── home.js
├── home.repository.js
├── home.ui.js
└── home.css
```

Deliberately the **minimum** set. Presence / announcements / approvals are small enough to live as functions in `home.repository.js` (data) and `home.ui.js` (render) — **no** `home.presence.js` / `home.announcements.js` / `home.approvals.js` extra files, to avoid overengineering (§ Phase 1B). They are split by **concern (repository vs ui)**, not by feature, which keeps the reference simple and copyable.

---

## 13. Migration Strategy

1. Keep legacy `home.html` + `pages/home/*` **untouched** (comparison baseline).
2. Create `pages/home/index.html` (new shell + structure).
3. Route `/home` → `pages/home/index.html` in `firebase.json`.
4. Build `home.repository.js` (data) then `home.ui.js` (render) then `home.js` (orchestrate).
5. Reuse foundation: `requireAuth`, `renderTopbar`, `renderSidebar`, `ui.js`, `utils.js`, `theme.css`, `layout.css`.
6. Preserve behavior of the **visible** sections; do not re-activate dormant projects.
7. Test against emulator with realistic local data.
8. Compare legacy vs new; document as the reference implementation.