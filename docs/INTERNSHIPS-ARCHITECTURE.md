# Internships — Feature Architecture

> **Phase 12 deliverable.** Internships is the migrated replacement for the legacy
> `setting/internship-management.html` — an **internship roster directory** built on
> the Pilot architecture. Read alongside `docs/ARCHITECTURE-FOUNDATION.md` (Phase 0),
> `docs/HOME-ARCHITECTURE.md` (reference implementation) and `docs/QUEST-ARCHITECTURE-ANALYSIS.md`.

---

## 1. Feature Purpose

Internship Management is a **directory of internship participants** (users with role
`Internship`). It lets staff:
- view the roster with status / position / department / contact columns;
- filter by search, status and rows-per-page, paginate;
- **add / edit / delete** an intern record;
- **promote** an intern to a team member (creates a `team_management` record and
  flips the user to `role_id: staff`).

It is **not** user management, the recruitment pipeline, or team management — those
remain separate features (see `docs/team-internal-map.html`).

---

## 2. Public Route

```
/internships   →   pages/internships/index.html
```

Firebase Hosting rewrite in `firebase.json`. The browser URL stays `/internships`
(no client-side router). The physical `pages/internships/index.html` path is an
implementation detail, not a public URL.

The legacy public page `setting/internship-management.html` still works and is kept
**untouched** for comparison.

> Feature name is `internships` (confirmed with the team), not the legacy filename.

---

## 3. Physical File Location

```
pages/internships/
├── index.html
├── internships.js
├── internships.repository.js
├── internships.ui.js
└── internships.css
```

Same minimum structure as Home/Quest: one file per concern, no over-splitting.

---

## 4. File Responsibilities

| File | Responsibility | Must NOT |
|---|---|---|
| `index.html` | Page markup, shell mounts (`#dg-topbar-mount`, `#dg-sidebar-mount`), stat cards, table shell, filter bar, pagination, Add/Edit/Promote Bootstrap modals, CSS/JS references. | Firestore queries, `initializeApp`, business logic. |
| `internships.js` | Orchestrator: `requireAuth()`, render shell, load positions/departments/interns, coordinate repository → ui, wire events (search, rows-per-page, stat-card filters, prev/next, add/edit/promote/delete), boot on DOM ready. | Firestore queries, raw data rendering. |
| `internships.repository.js` | **All** Internships Firestore data access: list interns (`users` supporting legacy & modern role representations with fallback scan), add/edit/delete intern, position map (`positions` → fallback `position`), department map (`departments` → fallback `department`), `isPromoted`, `promoteToTeam` (`team_management` addDoc + `users` update). | DOM manipulation, rendering, toasts, modals. |
| `internships.ui.js` | **All** Internships rendering + modal logic: stat cards, table rows (buildRow), status derivation `getInternshipDisplayStatus`, filter/sort/paginate, open/read Add/Edit/Promote forms, loading/notify/confirm helpers. | Firestore queries, data fetching. |
| `internships.css` | Internships-specific styles (avatars, sticky columns, stat cards, filter bar, pagination, table). Reuses theme/layout tokens. | Duplicated global styles. |

---

## 5. Data Flow

```
UI event  →  internships.js  →  internships.repository.js  →  Firebase (Firestore)
        ←  internships.js  ←  internships.repository.js  ←
      →  internships.ui.js  →  DOM
```

- **Writes:** click → orchestrator handler → repository function (`addIntern`,
  `updateIntern`, `deleteIntern`, `promoteToTeam`) → Firestore → `loadInternships()` refresh.
- **Reads:** `loadInternships()` does `Promise.all` of `loadPositionsMap()` +
  `loadDepartmentsMap()` + `listInterns()`, resolves position keys to labels, then
  `renderStats` + `renderTable`.
- Repository returns **plain data** (normalized rows); orchestrator + ui decide rendering.
- Row actions (edit/delete/promote) are wired by **event delegation** on `document`
  because rows are dynamically rendered.

---

## 6. Firebase Dependencies

```
Internships
 ├── Authentication
 │    └── requireAuth() from assets/js/auth-guard.js (custom claim `role`)
 ├── Firestore
 │    ├── users                     getDocs (query with multi-role support + fallback scan)
 │    ├── users/{id}                addDoc / updateDoc / deleteDoc
 │    ├── positions (fallback position)   getDocs (id → label map with try/catch fallback)
 │    ├── departments (fallback department) getDocs (id → label map with try/catch fallback)
 │    └── team_management/{id}      addDoc (promote) + query (where userId / internshipId == )
 │                                  users/{id} updateDoc (role/role_id staff, access.role_id staff, promotedToTeam)
 ├── Storage
 │    └── (none — avatar is a URL string, pravatar placeholder when absent)
 └── Functions
      └── (none called directly)
```

All via the single `assets/js/firebase-config.js` init. No `initializeApp` here.
Collection and field names match the legacy code exactly — nothing invented.

---

## 7. UI Flow

- `index.html` declares containers: `#internshipTableBody`, `#internshipPaginationInfo`,
  stat-card counters (`#statsCardTotalCount`, `#statsCardActiveCount`,
  `#statsCardOnLeaveCount`, `#statsCardLeftCount` + delta/pct badges), `#internshipSearchInput`,
  `#internshipRowsPerPage`, `#internshipPrevPage`/`#internshipNextPage`, and the three modals
  (`#internshipAddModal`, `#internshipEditModal`, `#promoteToTeamModal`).
- Stat cards are also **click-to-filter** (Total → clear, Active, On Leave, Left).
- `internships.ui.js` writes into those containers; delegated clicks on
  `.internship-edit-btn` / `.internship-delete-btn` / `.internship-promote-btn` handle rows.
- Loading / empty states handled inline (`showTableLoading`, "Showing 0 entries").

---

## 8. Authentication Flow

`internships.js` calls `requireAuth()`:
- unauthenticated → redirect to `index.html` (login);
- authenticated + role → `{ user, role }` for shell.

`renderTopbar`/`renderSidebar` receive `{ user, role }`. The sidebar is invoked with
`activePage: "users"` because the shared sidebar has no Internships entry; the breadcrumb
links to `/home`. The legacy page had **no role gate** (any logged-in user); the new page
preserves that behavior by using `requireAuth()` without a role allow-list.

---

## 9. Navigation

- New page breadcrumb links to `/home` (public URL).
- The Home apps grid (`pages/home/index.html`) still points to the **legacy**
  `setting/internship-management.html` — untouched in this migration.
- Neither the legacy nor the new shared sidebar lists Internships today.

---

## 10. Shared Dependencies (Phase 0 foundation used)

| Module | Used for |
|---|---|
| `assets/js/firebase-config.js` | single `db`/`auth` init |
| `assets/js/auth-guard.js` | `requireAuth()` |
| `assets/js/components/topbar/topbar.js` | `renderTopbar` (mount `#dg-topbar-mount`) |
| `assets/js/components/sidebar/sidebar.js` | `renderSidebar` (mount `#dg-sidebar-mount`) |
| `assets/js/ui.js` | `toast`, `confirmDialog`, `showModal`, `hideModal`, `setButtonBusy` |
| `assets/js/utils.js` | `escapeHtml`, `getMs` |
| `assets/css/theme.css` | design tokens + dark mode |
| `assets/css/layout.css` | app shell primitives |

No foundation functionality is duplicated inside Internships.

---

## 11. Status Derivation (ported from legacy)

`getInternshipDisplayStatus(u)` mirrors the legacy logic:
- explicit `status`: `inactive` → Inactive/danger, `left` → Left/danger,
  `graduate` → Graduate/success;
- otherwise uses `endDateObj`: no end date → `status` (default Active); `diffDays < 0` →
  Graduate; `≤ 20` → On Leave/warning; else Active/success.

---

## 12. Data Contract Notes (promote)

`promoteToTeam` creates a `team_management` doc (source `"internship"`, `internshipId`,
`userId`, division, birthDate/startDate as ISO date, blank bank/fee/pkwt fields) then
updates `users/{id}` with `role_id: "staff"`, `promotedToTeam: true`, `promotedAt`/`updatedAt`
server timestamps. If a `team_management` record already exists for the user, the promote
is a no-op (returns `false`, shows a warning).

---

## 13. Testing Approach

- **Routing:** `GET /internships` → 200; browser stays at `/internships`.
- **Module syntax:** `node --check` on all three ES modules.
- **Asset availability:** every CSS/JS reference returns 200 (incl. `pages/internships/*`).
- **UI render:** headless Chrome self-test exercises `internships.ui.js` against seeded
  data — status derivation, stats, table render/search/filter, modal open/read: **22/22 pass**.
- **Auth boundary:** unauthenticated visit to `/internships` redirects to `/index.html` (login).
- **Isolation checks:** served page contains **no** `style.css`, `element/`, `window.db`/
  `window.auth`, `connectEmulator`, Tailwind, or Font Awesome; only real Firebase hosts
  contacted (no `localhost:9099/8080/9199/5001` service traffic).
- **Regression:** `/home`, `/quest`, `/test`, `/` and legacy
  `setting/internship-management.html` still serve 200.

---

## 14. Known Limitations

- **Authenticated read-path** against real Firestore not yet exercised end-to-end
  (requires a real `dialogika-co` credential). All other layers validated.
- **Legacy Export button** (no-op in legacy source, lines 213–215) is **omitted** — confirmed
  with the team.
- **Sidebar has no Internships entry**, so the page uses `activePage: "users"` and is only
  reachable via the Home apps grid (legacy link). A future sidebar/nav update could add
  `/internships`.
- Avatar falls back to `https://i.pravatar.cc/150?u=<id>` when `photo` is absent (same
  convenience as other new pages).

---

## 15. Migration Notes

- Legacy `setting/internship-management.html` + its scripts are **kept untouched**.
- Do **not** delete legacy files without explicit approval.
- New feature name/route is `internships`; Home apps grid link not re-pointed (left legacy).
- Structure (orchestrator + repository + ui + css + html) mirrors Home/Quest.

---

## 16. Architecture Diagram

```
Browser
   ↓
/internships                  (public URL, rewrite)
   ↓
pages/internships/index.html  (physical file)
   ↓
internships.js                (orchestrator)
   ├── internships.repository.js   (data access)
   │       ↓
   │   assets/js/firebase-config.js
   │       ↓
   │   Firebase (Firestore)
   │
   └── internships.ui.js      (rendering + events)
           ↓
          DOM
```