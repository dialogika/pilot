# Company Position Feature Architecture

## 1. Executive Summary
- **Module:** `pages/hr/company-position/`
- **Canonical Routes:** `/company-position`, `/positions`
- **Legacy Source:** `data/company-position.html` (preserved as archive reference)
- **Architecture Pattern:** Pure Vanilla JS ES Modules (4-Layer: Repository, UI, Orchestrator, Scoped Styles)

---

## 2. File Directory Breakdown

```
pilot/pages/hr/company-position/
├── index.html                      # Semantic layout, topbar/sidebar mounts, card grid & list table, modals
├── company-position.js             # Orchestrator (Auth guard, shell mounting, event wiring, filter & pagination state)
├── company-position.repository.js  # Firestore queries for 'positions'/'position' and 'departments'/'department'
├── company-position.ui.js          # DOM manipulation, card grid & list table rendering, expandable descriptions, modal helpers
└── company-position.css            # Scoped styles (candidate cards, avatar gradients, status pills, filter panel)
```

---

## 3. Layer Separation of Concerns

### A. Repository (`company-position.repository.js`)
- **Zero DOM Operations.**
- Manages Firestore collection reads & writes for positions and department lookup tables.
- Implements:
  - `loadDepartmentsMap()`: Reads `departments` (fallback `department`) and constructs label and color maps.
  - `listPositions()`: Reads `positions` (fallback `position`), normalizes timestamp dates (`createdAt`), and formats items.
  - `getPosition(id)`: Fetches single position document.
  - `addPosition(payload)`: Saves new position with server timestamp.
  - `updatePosition(id, payload)`: Updates existing position.
  - `deletePosition(id)`: Deletes position document.

### B. UI Module (`company-position.ui.js`)
- **Zero Firestore Imports.**
- Implements:
  - `renderPositionsGrid(items, deptLabelMap, deptColorMap, handlers)`: Renders 3-column card grid with initials avatar gradients, head count tag, expandable job description, metrics info group (`Active person` & `Applicant person`), department pill badge, status badge (`OPEN` / `CLOSE`), and 3-dots action dropdown (`Edit` / `Delete`).
  - `renderPositionsList(items, deptLabelMap, handlers)`: Renders table rows for list view.
  - `attachCardEvents(container, handlers)`: Handles expand/collapse toggle for job descriptions (`Show more` / `Show less`) and delegated action clicks.
  - `populateDepartmentSelect(selectEl, deptLabelMap, selectedValue)`: Populates modal dropdowns.
  - `populateDepartmentFilter(selectEl, deptLabelMap)`: Populates filter bar department options.
  - `resetAddPositionForm()`, `getAddPositionFormData()`, `populateEditPositionForm()`, `getEditPositionFormData()`.

### C. Orchestrator (`company-position.js`)
- **Central Event & State Coordinator.**
- Integrates `requireAuth()` from `/assets/js/auth-guard.js`.
- Mounts shared `renderTopbar` and `renderSidebar` components.
- Manages filter state (live text search, department filter, status filter, date preset filter, custom date range).
- Manages view switching between Grid and List view (`#viewGridBtn` / `#viewListBtn`).
- Manages pagination / load more (`#positionsLoadMoreBtn`) in increments of 9 items.
- Controls Add & Edit modal instances and saves changes.

---

## 4. Firestore Schema Parity

### Collection `positions` (fallback `position`)
| Field | Type | Description |
|---|---|---|
| `name` | `string` | Nama Jabatan / Posisi (e.g. "Recruitment Specialist") |
| `department` | `string` | ID atau nama divisi terkait (e.g. "happy", "closing") |
| `headCount` | `number` | Total target kuota posisi |
| `activeCount` | `number` | Jumlah personil aktif saat ini |
| `applicantCount` | `number` | Jumlah pelamar kerja |
| `jobdesk` | `string` | Rincian deskripsi pekerjaan / job vacancy requirements |
| `status` | `string` | Status rekrutmen: `Open` atau `Close` |
| `createdAt` | `timestamp` | Waktu pembuatan record |

### Collection `departments` (fallback `department`)
| Field | Type | Description |
|---|---|---|
| `name` | `string` | Nama divisi (e.g. "Happy", "Closing", "Team") |
| `color` | `string` | Warna badge divisi (e.g. `#f59e0b`, `#10b981`) |
