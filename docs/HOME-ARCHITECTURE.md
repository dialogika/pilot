# Home — Feature Architecture (Reference Implementation)

> **Phase 1 deliverable.** Home is the **first reference implementation** of the
> Pilot architecture. Future features (Quest, Projects, Users, …) should follow
> the same structure. Read this alongside `docs/ARCHITECTURE-FOUNDATION.md`
> (Phase 0) and `docs/HOME-ARCHITECTURE-ANALYSIS.md` (Phase 1A discovery).

---

## 1. Home Purpose

Home is the internal dashboard shown after login. It shows:
- a personalized welcome header (greeting, role, position);
- **Who is Online** (presence avatars + active count);
- **Announcements** (pinned first, department-filtered, top 5);
- **Daily Report Approvals** (department-filtered pending reports + review/approve/reject);
- **Pending Registrations** (pending user approvals);
- an **Apps Overview** grid grouped by division (HR / Marketing / Product / Branding).

It is also the architectural template: a clean split between **orchestration**,
**data access** (repository) and **presentation** (ui), built on the shared foundation.

---

## 2. Public Route

```
/home   →   pages/home/index.html
```

Firebase Hosting rewrite in `firebase.json`. The browser URL stays at `/home`
(no client-side router, no redirect to the physical file path). The physical
`pages/home/index.html` path is an implementation detail, not a public URL.

Legacy public page `/home.html` still works and is left untouched for comparison.

---

## 3. Physical File Location

```
pages/home/
├── index.html
├── home.js
├── home.repository.js
├── home.ui.js
└── home.css
```

The minimum necessary structure. Presence / announcements / approvals are
**not** given their own files — they are separated by *concern* (repository vs
ui), not by feature, to avoid over-engineering.

---

## 4. File Responsibilities

| File | Responsibility | Must NOT |
|---|---|---|
| `index.html` | Page markup, shell mounts (`#dg-topbar-mount`, `#dg-sidebar-mount`), static apps grid, modals, feature containers, CSS/JS references. | Firestore queries, `initializeApp`, large business logic. |
| `home.js` | Orchestrator: `requireAuth()`, render shell, coordinate repository → ui, wire user interactions, cleanup. | Firestore queries, raw data rendering. |
| `home.repository.js` | **All** Home Firestore/Auth data access: user doc, presence, announcements, daily reports + approve/reject, pending users + approve/reject, position resolution. | DOM manipulation, rendering, toasts, layout. |
| `home.ui.js` | **All** Home rendering + event wiring: welcome, online avatars, announcements, report rows + modal, pending table, individual-approval mode. | Firestore queries, data fetching. |
| `home.css` | Home-specific styles (online avatars, app grid, announcement cards, menu badges). Reuses theme/layout tokens. | Duplicated global styles. |

---

## 5. Data Flow

```
UI event  →  home.js  →  home.repository.js  →  Firebase (Auth/Firestore)
        ←  home.js  ←  home.repository.js  ←
      →  home.ui.js  →  DOM
```

Two directions:

- **Writes/actions:** user clicks → `home.js` handler → repository function
  (e.g. `approvePendingUser`, `approveReport`) → Firestore.
- **Reads/subscriptions:** repository `onSnapshot`/`getDoc` → callback → `home.js`
  → `home.ui.js` render → DOM. Unsubscribe functions are collected by `home.js`.

Repository functions return **plain data**; the orchestrator decides what to render.

---

## 6. Firebase Dependencies

```
Home
 ├── Authentication
 │    └── requireAuth() from assets/js/auth-guard.js  (custom claim `role`)
 ├── Firestore
 │    ├── users/{uid}               getDoc
 │    ├── user_presence/{uid}       setDoc (merge, own presence)
 │    ├── user_presence             onSnapshot (online users)
 │    ├── announcements             onSnapshot (where active == true)
 │    ├── intern_dailyreport        onSnapshot (status in Pending…)
 │    ├── intern_dailyreport/{id}   updateDoc (approve/reject)
 │    ├── tasks/{task_id}           getDoc (backfill points)
 │    ├── pending_users             onSnapshot (is_approved == false)
 │    ├── pending_users/{id}        getDoc/setDoc/deleteDoc
 │    ├── users                     getDocs (name map)
 │    └── positions, position       getDoc / getDocs (resolve position name)
 ├── Storage
 │    └── (none — Home uses photo URL strings)
 └── Functions
      └── (none called directly)
```

All via the single `assets/js/firebase-config.js` init. No `initializeApp` in Home.
Collection names match the legacy code exactly — nothing invented.

---

## 7. UI Flow

- `index.html` declares containers (`#onlineUsersContainer`, `#announcementBannerContainer`,
  `#dailyReportList`, `#pendingUsersTableBody`, modals).
- `home.ui.js` writes into those containers and wires event delegation on `document.body`
  for dynamically-rendered buttons.
- Loading / empty / error states are handled inline by each render function.

---

## 8. Authentication Flow

`home.js` calls `requireAuth()` (from `assets/js/auth-guard.js`):
- unauthenticated → redirect to `index.html` (login);
- authenticated but no valid role → fail-safe "no role" screen;
- authenticated + role → resolves `{ user, role }`, used for shell + welcome.

`renderTopbar` and `renderSidebar` receive `{ user, role }`; the sidebar filters
navigation by role. Logout uses `logout()` from `auth-guard.js`.

---

## 9. Navigation

- Shared sidebar (`assets/js/components/sidebar/sidebar.js`) links to **public URLs** (e.g. `/home`,
  `/quest`), never file paths.
- Apps grid in `index.html` uses relative links to legacy pages (still legacy).
- New Home links point to `/home` (public), not `/pages/home/index.html`.

---

## 10. Shared Dependencies (Phase 0 foundation used)

| Module | Used for |
|---|---|
| `assets/js/firebase-config.js` | single `db`/`auth` init + emulator wiring |
| `assets/js/auth-guard.js` | `requireAuth()`, `logout()` |
| `assets/js/components/topbar/topbar.js` | `renderTopbar` (mount `#dg-topbar-mount`) |
| `assets/js/components/sidebar/sidebar.js` | `renderSidebar` (mount `#dg-sidebar-mount`) |
| `assets/js/ui.js` | `toast`, `confirmDialog`, `showModal`, `hideModal`, `setButtonBusy` |
| `assets/js/utils.js` | `formatDateID`, `stripHtml`, `escapeHtml`, `getMs` |
| `assets/css/theme.css` | design tokens + dark mode |
| `assets/css/layout.css` | app shell primitives |

No foundation functionality is duplicated inside Home.

---

## 11. Testing Approach

- **Routing:** `GET /home` → 200, serves `pages/home/index.html`, browser stays at `/home`; `/test` preserved.
- **Emulator:** local development uses the Firebase Hosting Emulator to serve `/home`, while Auth/Firestore point to the REAL `dialogika-co` project (see `ARCHITECTURE-FOUNDATION.md` §14). No Firebase-service emulators.
- **Module syntax:** `node --check` on each ES module.
- **Asset availability:** every CSS/JS the page references returns 200.
- **UI render:** headless Chrome self-test exercises `home.ui.js` against seeded data.
- **Auth boundary:** unauthenticated visit to `/home` redirects to login.
- **Regression:** legacy `/home.html`, `/presence.html`, `/index.html`, `/test` still serve.

---

## 12. Known Limitations

- **Menu badges** (`data-menu-badge` counters on the apps grid) are **rendered but not
  populated** by the new Home. The legacy `home-menu-badges.js` did this by querying ~10
  collections every 60s. That logic is cross-feature and was **deferred** to keep Home a
  clean reference (see regression §14 — legacy still shows them). A future shared badge
  system should own this.
- **Projects** code is dormant in legacy Home (no project containers in `home.html`) and is
  **not re-activated** here. Project management belongs to the future Projects feature.
- **Storage** points to the REAL `dialogika-co` Storage (no emulator). **Functions** source is not in this repo; `functions` is initialized against the real project (no local emulator).

---

## 13. Migration Notes

- Legacy `home.html` + `pages/home/*` legacy modules are **kept untouched** for comparison.
- The new Home is the **reference implementation**; legacy Home is a **deprecated candidate**.
- Do **not** delete legacy files without explicit approval.
- Future features should copy this structure (orchestrator + repository + ui + css + html)
  without copying Home-specific code.

---

## 14. Architecture Diagram

```
Browser
   ↓
/home                          (public URL, rewrite)
   ↓
pages/home/index.html          (physical file)
   ↓
home.js                        (orchestrator)
   ├── home.repository.js      (data access)
   │       ↓
   │   assets/js/firebase-config.js
   │       ↓
   │   Firebase (Auth/Firestore)
   │
   └── home.ui.js              (rendering + events)
           ↓
          DOM
```
