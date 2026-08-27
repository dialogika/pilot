# Users Management — Feature Architecture

> **Phase 12 deliverable.** Users Management is the migrated replacement for the legacy
> `setting/users-management.html` — a **user roster directory** built on the Pilot
> architecture. Read alongside `docs/ARCHITECTURE-FOUNDATION.md` (Phase 0),
> `docs/HOME-ARCHITECTURE.md` (reference implementation) and
> `docs/INTERNSHIPS-ARCHITECTURE.md`.

---

## 1. Feature Purpose

Users Management is a **directory of all organization users** across all roles. It lets staff:

- view the user roster with name, email, created date, position, role, and status columns;
- filter by search (name/email), date range, role, and status;
- sort by any column header (name, email, created date, position, role, status);
- paginate with configurable rows per page;
- **add / edit / delete** a user record;
- **export** user data to CSV or print-friendly PDF;
- change password for the currently logged-in user.

It is **not** user management for specific domains (internship management, team management, performance appraisal) — those remain separate features.

---

## 2. Public Route

```
/users-management   →   pages/hr/users-management/index.html
```

Firebase Hosting rewrite in `firebase.json`. The browser URL stays `/users-management`
(no client-side router). The physical `pages/hr/users-management/index.html` path is an
implementation detail, not a public URL.

The legacy public page `setting/users-management.html` still works and is kept
**untouched** for comparison.

> Feature name is `users-management` (matches the legacy page title and domain).

---

## 3. Physical File Location

```
pages/hr/users-management/
├── index.html                      # Page entry point + structure
├── users-management.js             # Orchestrator / business flow
├── users-management.ui.js          # DOM manipulation & rendering
├── users-management.repository.js  # Firestore / Firebase data access
└── users-management.css            # Feature-specific styling
```

Same minimum structure as Home/Internships: one file per concern, no over-splitting.

---

## 4. File Responsibilities

| File | Responsibility | Must NOT |
|---|---|---|
| `index.html` | Page markup, shell mounts (`#dg-topbar-mount`, `#dg-sidebar-mount`), filter bar, table shell, pagination, Add/Edit/Delete/Custom Range modals, CSS/JS references. | Firestore queries, `initializeApp`, business logic. |
| `users-management.js` | Orchestrator: `requireAuth()`, render shell, load roles/positions/users, coordinate repository → ui, wire events (search, filters, rows-per-page, prev/next, add/edit/delete, export, column sorting), boot on DOM ready. | Firestore queries, raw data rendering. |
| `users-management.repository.js` | **All** Users Management Firestore data access: list users, add/edit/delete user, role map (`roles`), position map (`position` → fallback `positions`), password update. | DOM manipulation, rendering, toasts, modals. |
| `users-management.ui.js` | **All** Users Management rendering + modal logic: table rows (buildRow), filter/sort/paginate, open/read Add/Edit forms, loading/notify/confirm helpers. | Firestore queries, data fetching. |
| `users-management.css` | Users Management-specific styles (layout, sticky columns, badges, buttons, scrollbars). Reuses theme/layout tokens. | Duplicated global styles. |

---

## 5. Data Flow

```
UI event  →  users-management.js  →  users-management.repository.js  →  Firebase (Firestore)
        ←  users-management.js  ←  users-management.repository.js  ←
      →  users-management.ui.js  →  DOM
```

- **Writes:** click → orchestrator handler → repository function (`addUser`,
  `updateUser`, `deleteUser`) → Firestore → `loadUsers()` refresh.
- **Reads:** `loadUsers()` does `Promise.all` of `loadRolesMap()` +
  `loadPositionsMap()`, then `listUsers()`, resolves role/position keys to
  labels, then `renderTable`.
- Repository returns **plain data** (normalized rows); orchestrator + ui decide
  rendering.
- Row actions (edit/delete) are wired by **event delegation** on `document`
  because rows are dynamically rendered.

---

## 6. Firebase Dependencies

```
Users Management
 ├── Authentication
 │    └── requireAuth() from assets/js/auth-guard.js (custom claim `role`)
 ├── Firestore
 │    ├── users                     getDocs / addDoc / updateDoc / deleteDoc
 │    ├── roles                     getDocs (id → label map)
 │    └── position (fallback positions)   getDocs (id → label map)
 ├── Storage
 │    └── (none — avatar is a URL string, pravatar placeholder when absent)
 └── Functions
      └── (none called directly)
```

All via the single `assets/js/firebase-config.js` init. No `initializeApp` here.
Collection and field names match the legacy code exactly — nothing invented.

---

## 7. UI Flow

- `index.html` declares containers: `#usersTableBody`, `#paginationText`,
  filter selects (`#filterDatePreset`, `#filterRole`, `#filterStatus`,
  `#filterSort`), `#rowsPerPage`, `#searchInput`, `#prevPage`/`#nextPage`,
  and four modals (`#editUserOverlay`, `#addUserOverlay`, `#deleteUserOverlay`,
  `#customRangeOverlay`).
- `users-management.ui.js` writes into those containers; delegated clicks on
  `.users-edit-btn` / `.users-delete-btn` handle rows.
- Column header clicks trigger `sortByColumn` with direction toggling.
- Loading / empty states handled inline (`showTableLoading`, "Showing 0 entries").

---

## 8. Authentication Flow

`users-management.js` calls `requireAuth()`:
- unauthenticated → redirect to `index.html` (login);
- authenticated + role → `{ user, role }` for shell.

`renderTopbar`/`renderSidebar` receive `{ user, role }`. The sidebar is invoked with
`activePage: "users"` because the shared sidebar has no Users Management entry;
the breadcrumb links to `/home`. The legacy page had **no role gate** (any logged-in
user); the new page preserves that behavior by using `requireAuth()` without a
role allow-list.

---

## 9. Navigation

- New page breadcrumb links to `/home` (public URL).
- The sidebar uses `activePage: "users"` (matches the HR section convention).
- Neither the legacy nor the new shared sidebar lists Users Management today.

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

No foundation functionality is duplicated inside Users Management.

---

## 11. Filter and Sort Behavior (ported from legacy)

The filter/sort system mirrors the legacy implementation exactly:

- **Date presets:** last30, last60, last90, last6month, thisYear, lastYear, custom range
- **Role filter:** Super Team, Sub Team, Mentor, Employee, Internship
- **Status filter:** Active, Inactive
- **Sort presets:** Recent, Name Ascending, Name Descending, Last 7 Days, Last Month, Last 3 Months
- **Column sort:** click header → toggle asc/desc, supports all 6 columns
- **Search:** fuzzy match on nickname/name and email
- **Pagination:** configurable rows per page (25/50/100/200)

---

## 12. Role Badge Colors (ported from legacy)

Role badges use the same Tailwind-based color scheme as the legacy page:

| Role | Badge Colors |
|---|---|
| Super Team | bg-indigo-100 text-indigo-600 |
| Sub Team | bg-teal-100 text-teal-600 |
| Mentor | bg-amber-100 text-amber-600 |
| Employee | bg-pink-100 text-pink-600 |
| Internship | bg-slate-100 text-slate-600 |
| (default) | bg-sky-100 text-sky-600 |

---

## 13. Export Behavior (ported from legacy)

- **Export to PDF:** Opens a new window with a print-friendly Bootstrap-styled table
- **Export to Excel:** Downloads a CSV file with the current filtered data
- Both exports operate on the currently filtered/sorted dataset

---

## 14. Password Change Behavior

Password changes follow the legacy restriction:
- Can only change password for the **currently logged-in user** (checks `auth.currentUser.uid === editingUserId`)
- If trying to change another user's password, shows an alert: "Password hanya bisa diganti untuk akun yang sedang login."
- Uses `updatePassword()` from Firebase Auth SDK

---

## 15. Testing Approach

- **Routing:** `GET /users-management` → 200; browser stays at `/users-management`.
- **Module syntax:** `node --check` on all three ES modules.
- **Asset availability:** every CSS/JS reference returns 200.
- **Auth boundary:** unauthenticated visit to `/users-management` redirects to `/index.html` (login).
- **Regression:** `/home`, `/quest`, `/test`, `/` and legacy
  `setting/users-management.html` still serve 200.

---

## 16. Known Limitations

- **Authenticated read-path** against real Firestore not yet exercised end-to-end
  (requires a real `dialogika-co` credential). All other layers validated.
- **Sidebar has no Users Management entry**, so the page is only reachable via
  breadcrumb navigation or direct URL. A future sidebar/nav update could add
  `/users-management`.
- Avatar falls back to `https://i.pravatar.cc/150?u=<id>` when `photo` is absent
  (same convenience as other new pages).

---

## 17. Migration Notes

- Legacy `setting/users-management.html` is **kept untouched**.
- Do **not** delete legacy files without explicit approval.
- New feature name/route is `users-management`; the legacy page still works.
- Structure (orchestrator + repository + ui + css + html) mirrors Home/Internships.

---

## 18. Architecture Diagram

```
Browser
   ↓
/users-management                 (public URL, rewrite)
   ↓
pages/hr/users-management/index.html  (physical file)
   ↓
users-management.js               (orchestrator)
   ├── users-management.repository.js   (data access)
   │       ↓
   │   assets/js/firebase-config.js
   │       ↓
   │   Firebase (Firestore)
   │
   └── users-management.ui.js     (rendering + events)
           ↓
          DOM
```

---

## 19. Migration Decisions

| Decision | Rationale |
|---|---|
| Feature name `users-management` | Matches legacy page title and HR domain |
| Route `/users-management` | Clean, descriptive public URL |
| HR subfolder `pages/hr/` | Consistent with performance-appraisal pattern |
| Sidebar `activePage: "users"` | Matches existing sidebar convention |
| Legacy Tailwind via CDN | Preserves legacy visual appearance |
| Font Awesome via CDN | Preserves legacy icon set |
| Bootstrap via CDN | Preserves legacy modal/form styles |
| Export button preserved | Legacy had export functionality (PDF + CSV) |

---

## 20. Deferred Work

- **Sidebar entry:** Add `/users-management` to the shared sidebar navigation.
- **Permissions:** Add role-based access control if needed in the future.
- **Bulk operations:** The select-all checkbox works but no bulk delete action is implemented (matches legacy).
- **Column sort indicators:** Sort direction indicators on column headers could be enhanced.
