# Quest — Architecture Analysis (Phase 2A/2B Discovery)

> This document records the actual, repository-verified discovery of the Quest
> domain. It deliberately does **not** proceed to implementation, because the
> discovery surfaced several STOP conditions defined by the Phase 2 brief.

---

## 1. Quest Discovery

### 1.1 What "Quest" actually is

There is **no single "Quest feature"** in this repository. The term "Quest" maps
to **four distinct, unevenly-sized things**:

| Thing | File(s) | Size | Nature |
|---|---|---|---|
| **Quest Board** | `element/quest-board.html` | 6,013 lines | The core quest/task gamification board (main + side quests, reports, recurrence, file upload) |
| **Quest Detail/Edit** | `quest/quest-edit.html` | 421 lines | Read + toggle status of a single `tasks/{taskId}` |
| **Recruitment Dashboard** | `quest/dashboard-recruitment.html` | 876 lines | Recruitment/talent funnel analytics (NOT really "quest") |
| **People Dev Dashboard** | `quest/dashboard-people-dev.html` | 567 lines | Mostly static KPIs + one real query (`user_attendance`) |

Plus **Quest logic embedded inside the legacy sidebar** (`element/sidebar.js`, 10,203 lines)
— which contains `openQuestDetail`, daily-report submission, quest recurrence,
reminder, and report submission logic. This is a hard, non-obvious coupling.

### 1.2 Navigation expectations vs reality (CRITICAL)

The approved new sidebar (`assets/js/sidebar.js`) and the legacy sidebar both
link to **three Quest routes that DO NOT EXIST in the repository**:

- `/quest/my-tasks.html` → **missing**
- `/quest/activity.html` → **missing**
- `/quest/daily-report.html` → **missing**

The only quest routes that physically exist are:
- `/quest/dashboard-recruitment.html` ✅
- `/quest/dashboard-people-dev.html` ✅
- `/quest/quest-edit.html` ✅
- `/element/quest-board.html?tab=main|side` ✅ (the real Quest Board)

**This means the sidebar advertises a Quest UI (My Tasks / Activity / Daily
Report) that has no implementation.** Reproducing "existing Quest behavior" is
therefore ambiguous — the primary user-facing quest board lives at
`/element/quest-board.html`, not under the advertised `/quest/*` routes.

---

## 2. Legacy Quest Architecture

### 2.1 Quest Board (`element/quest-board.html`)

- Entry: standalone at `/element/quest-board.html?tab=main` (from sidebar.js:593)
  OR embedded in an iframe modal inside legacy `element/sidebar.js`.
- Uses **`parentWin` (iframe parent) coupling**: it reads/writes Firestore via
  `parentWin.db`, `parentWin.collection`, `parentWin.addDoc`, `parentWin.updateDoc`,
  `parentWin.storage`, `parentWin.auth` (lines 826–886). It is **not self-sufficient**
  when embedded — it depends on the parent window exposing Firebase globals.
- Has a standalone detection path (`?tab=main`) with duplicated handlers
  (`__questBoardStandaloneHandlers`, lines 5940–5995).
- Reads: `tasks`, `quest_reports`, `intern_dailyreport`, `departments`, `positions`, `users`.

### 2.2 Quest Detail (`quest/quest-edit.html`)

- `getDoc(doc(db, "tasks", taskId))` → render; `updateDoc(..., { status: Complete|Initiate })`.
- Uses new foundation: `app`/`db` from `assets/js/firebase-config.js` (but also
  imports unused `initializeApp` at line 164 — dead import).
- Loads `auth-guard.js` as a module but **never calls `requireAuth()`** — auth is
  effectively unguarded beyond the module being loaded.

### 2.3 Recruitment Dashboard (`quest/dashboard-recruitment.html`)

- Legacy shell: `element/topbar.js` + `element/sidebar.js` + `element/rightbar-recruit.js`.
- Massive inline `<script>` (lines 312–874): date range, section switcher
  (team/mentor/internship), stats, interviews, overdue, platform posting.
- Reads many collections: `team_screening`, `mentor_screening`, `interns_screening`,
  `team_management`, `mentor`, `users`, `recruitment_dashboard_notes`, `positions`.
- Exposes a pile of globals: `window.app/auth/db/collection/getDocs/query/where`.

### 2.4 People Dev Dashboard (`quest/dashboard-people-dev.html`)

- Mostly **static Tailwind mock data** (KPI cards, leaderboard, logs, survey are
  hardcoded). Only one real query: attendance percent from `users` + `user_attendance`.
- Legacy shell + `window.*` globals.

---

## 3. Quest Domain Map

```
quest-board.html (main quest UI)
  ├── parentWin (iframe parent) → Firebase globals  ← HARD COUPLING
  ├── tasks                 (read/write: list, status, tags, points)
  ├── quest_reports         (addDoc: side-quest reports)
  ├── intern_dailyreport    (daily report submissions)
  ├── departments, positions, users (maps/lookups)
  │
  ├── embedded in element/sidebar.js (10k-line legacy sidebar)
  │        └── openQuestDetail, submitDailyReport, recurrence, reminder
  │
  └── standalone ?tab=main|side (duplicated handlers)

quest-edit.html  → tasks/{taskId}  (getDoc + updateDoc status)
dashboard-recruitment.html → screening/management/notes/positions collections
dashboard-people-dev.html  → users + user_attendance (one real query)

Shared collection: tasks
  ├── ALSO read/written by project/* pages (list-detail, item-details, list)
  └── → Quest and Project are CROSS-FEATURE coupled through `tasks`
```

---

## 4. Quest Pages

| Route | File | Status |
|---|---|---|
| `/quest/my-tasks.html` | — | **MISSING** (advertised, absent) |
| `/quest/activity.html` | — | **MISSING** (advertised, absent) |
| `/quest/daily-report.html` | — | **MISSING** (advertised, absent) |
| `/quest/dashboard-recruitment.html` | ✅ | exists |
| `/quest/dashboard-people-dev.html` | ✅ | exists |
| `/quest/quest-edit.html` | ✅ | exists |
| `/element/quest-board.html?tab=main` | ✅ | exists (real board) |

---

## 5. Quest Data Model

| Collection | Purpose | Main fields | Used by | Read/Write |
|---|---|---|---|---|
| `tasks` | Tasks/quests (shared with Projects) | `project_id, list_id, title, description, status, priority, due_date, points, assign_to, notify_to, tags[], position, created_by` | quest-board, quest-edit, **project/*** | R+W |
| `quest_reports` | Side-quest completion reports | `task_id, submitted_by, payload, files[]` | quest-board, sidebar | R+W |
| `intern_dailyreport` | Daily report submissions | `status, tasks[], departments[], name, ...` | quest-board, sidebar, Home | R+W |
| `team_screening` | Team candidate screening | — | dashboard-recruitment | R |
| `mentor_screening` | Mentor candidate screening | — | dashboard-recruitment | R |
| `interns_screening` | Intern candidate screening | — | dashboard-recruitment | R |
| `team_management` | Active team members | — | dashboard-recruitment | R |
| `mentor` | Active mentors | — | dashboard-recruitment | R |
| `recruitment_dashboard_notes` | Dashboard important-notes | `content, updated_at, updated_by` | dashboard-recruitment | R+W |
| `user_attendance` | Daily attendance | `user_id, date, check_in, check_out` | dashboard-people-dev | R |
| `users` | Users (role/department/position) | `name, role, employment, departments` | all | R |
| `departments`, `positions` | Lookups | `name` | quest-board, recruitment | R |

**Schema is UNCHANGED.** Firestore Security Rules are **not in the repo** (managed in Firebase console) — permission model cannot be fully audited from the repo.

---

## 6. Quest Permission Model

- **Authentication:** legacy pages use `onAuthStateChanged(auth, ...)` with a manual
  `window.location.href = "../index.html"` redirect (NOT the new `requireAuth()`).
  `quest-edit.html` loads `auth-guard.js` but never calls `requireAuth()`.
- **Authorization:** **no role-based checks** in any Quest page. Visibility is not
  gated by role in the pages. Role only filters *data* (e.g. internship users via
  `where("role","in",["Internship"])`).
- **Firestore rules:** not present in repo → **UNKNOWN**, cannot audit.

---

## 7. Legacy Problems

| # | Problem | Severity |
|---|---|---|
| 1 | **iframe `parentWin` coupling** — Quest Board not self-sufficient, depends on parent globals | **CRITICAL** |
| 2 | **Quest logic buried in 10,203-line legacy sidebar** (`element/sidebar.js`) | **CRITICAL** |
| 3 | **Advertised routes `/quest/my-tasks|activity|daily-report` do not exist** | **HIGH** |
| 4 | `tasks` shared with Projects — cross-feature coupling (hard to own) | **HIGH** |
| 5 | Massive inline scripts in dashboards; business logic mixed with DOM | **HIGH** |
| 6 | `window.*` global flooding (`db`, `collection`, `getDocs`, etc.) | **HIGH** |
| 7 | `quest-edit.html` dead `initializeApp` import + auth-guard loaded but unused | **MEDIUM** |
| 8 | `element/sidebar.js` (legacy) vs `assets/js/sidebar.js` (new) — two competing sidebars | **MEDIUM** |
| 9 | People Dev dashboard is mostly hardcoded static data | **MEDIUM** |
| 10 | Duplicated utilities (normalizeStatus, date helpers) across files | **LOW** |

---

## 8. New Architecture (Proposed)

Given the discovery, the reference pattern would be:

```
pages/quest/
├── index.html            → Quest Board (from quest-board.html)
├── quest.js              → orchestrator
├── quest.repository.js   → tasks, quest_reports, intern_dailyreport
├── quest.ui.js           → rendering
├── quest.css
```

And the missing routes would need explicit decisions:
- `/quest/my-tasks` → new Quest Board route
- `/quest/activity` → ? (no legacy implementation)
- `/quest/daily-report` → ? (daily report currently in sidebar/quest-board)

---

## 9. STOP Conditions Triggered

Per the Phase 2 brief, I must **STOP and report** before implementation because:

1. **Quest architecture is unclear** — "Quest" is 4 different things with no single entry; the real board is `element/quest-board.html`, not the advertised `/quest/*` routes.
2. **Firestore relationships are ambiguous** — `tasks` is shared between Quest and Project; `quest_reports` + `intern_dailyreport` + `tasks/{id}/reports` overlap.
3. **Permissions are unclear** — no role checks in Quest pages; Firestore rules absent from repo.
4. **Existing Quest behavior cannot be safely reproduced** — the primary user-facing surface (Quest Board) is iframe/parentWin-coupled; the sidebar advertises routes that don't exist.
5. **A shared foundation change may be required** — legacy sidebar `element/sidebar.js` must not be the host for Quest logic; replacing it is a large cross-cutting change.
6. **A major architectural decision is required** — what exactly is in the Quest feature boundary? (Recruitment and People Dev are arguably separate features, not Quest.)

---

## 10. Recommended Path Forward (awaiting decision)

I recommend we **STOP and obtain direction** on:

- **A)** What is the *intended* Quest feature scope? (Board only? Board + daily report? Or also Recruitment/People Dev?)
- **B)** The three missing routes (`my-tasks`, `activity`, `daily-report`) — should the new Quest implementation *create* them, or are they legacy leftovers to drop?
- **C)** How to handle `element/quest-board.html`'s iframe/parentWin coupling (extract to standalone is the clear direction).
- **D)** The `tasks` collection sharing with Projects — accept shared ownership (documented) or define a boundary now.

No Quest files have been modified. Legacy Quest is untouched.

---

# Phase 2 Architectural Decisions

> Recorded per the Phase 2 Decision brief. These decisions are validated against
> the repository evidence gathered above.

## 1. Approved Quest Scope

The new Quest feature covers:
- **Quest Board** — the task/quest gamification board (from `element/quest-board.html`).
- **Quest Reports** — side-quest completion reports stored in `quest_reports`.
- **Daily Report** — the daily-report submission associated with the Quest workflow
  (currently in `element/sidebar.js#submitDailyReport`, writes to `intern_dailyreport`).

## 2. Excluded Domains

NOT part of Phase 2 Quest:
- **Recruitment Dashboard** (`quest/dashboard-recruitment.html`) → separate future feature.
- **People Development Dashboard** (`quest/dashboard-people-dev.html`) → separate future feature.
- **Projects** (`project/*`) → separate future feature (shares `tasks`, documented below).
- **Menu badges**, Home, Users, Personal → out of scope.

## 3. Route Strategy

- New entry: `/quest` → Firebase Hosting rewrite → `pages/quest/index.html`. Browser stays at `/quest`.
- The legacy sidebar advertises `/quest/my-tasks`, `/quest/activity`, `/quest/daily-report` — **none exist as independent pages.**
- Decision: **drop these three non-existent routes from navigation.** Do NOT create fake pages.
- Mapping of their intent onto the new board:
  - "My Tasks" → the Quest Board itself (`/quest`) lists assigned quests.
  - "Daily Report" → the Daily Report submit inside the Quest Board.
  - "Activity" → no legacy implementation; not recreated.
- This cleanup touches only the two sidebars (`assets/js/sidebar.js` + `element/sidebar.js`) and does not break unrelated functionality (these routes 404 today).

## 4. Standalone Quest Decision

The new Quest Board is **standalone and self-sufficient**. The following legacy patterns
are **explicitly forbidden** in the new implementation:
- iframe-based Quest Board
- `parentWin` Firebase globals
- parent DOM coupling
- `window.*` data passing between Quest and a parent

The target flow:

```
Quest UI
    ↓
quest.js (orchestrator)
    ↓
quest.repository.js
    ↓
assets/js/firebase-config.js
    ↓
Firestore
```

## 5. iframe/parentWin Removal Strategy

- The legacy `element/quest-board.html` reads/writes Firestore via `parentWin.db`,
  `parentWin.collection`, `parentWin.addDoc`, `parentWin.updateDoc`, `parentWin.storage`,
  `parentWin.auth`, `parentWin.serverTimestamp`.
- The new `quest.repository.js` imports `{ auth, db, storage, functions }` directly from
  `assets/js/firebase-config.js` and performs the same operations self-sufficiently.
- File uploads (reports) go through `storage` from firebase-config directly (no `parentWin`).
- All `window.questTasksById` / `window.questUsersById` cross-window caches are replaced by
  module-local state in the orchestrator.

## 6. tasks Cross-Domain Relationship

- `tasks` is the shared collection between **Quest** and **Projects** (project pages read/write
  tasks via `project_id`; Quest Board reads/writes tasks as quests).
- Phase 2 decision: **do NOT create a global task abstraction.**
- Quest gets its own `quest.repository.js` methods for the task operations it owns
  (list by `quest_type`, create, edit, delete, toggle status, submit-report status update).
- Document the Project relationship here; reassess a shared task module **when Projects is migrated**.

## 7. quest_reports vs intern_dailyreport

These are **two distinct concepts** — NOT merged:

| | `quest_reports` | `intern_dailyreport` |
|---|---|---|
| Purpose | Side-quest completion reports | Intern daily work report |
| Created by | `submitSideQuestReport` (quest-board) | `submitDailyReport` (sidebar) |
| Payload | `{ taskId, content, files[], submittedAt, submittedBy }` | `{ date, date_label, user_id, name, departments[], tasks[], total_points, status:"Pending Review", created_at }` |
| Read by | quest-board report accordion | Home approval flow + quest-board |
| Task relationship | single task (`taskId`), sets task status → `reported` | multiple tasks, sets each → `reported` + `last_reported_by/at` |
| Concept | One task's completion evidence | A user's daily summary across tasks |

Both are kept as separate collections with separate repository methods. No merge, no rename.

## 8. Authentication Strategy

- New Quest uses the shared `requireAuth()` from `assets/js/auth-guard.js` as the single
  auth boundary (replacing the legacy inconsistent `onAuthStateChanged` + manual redirect,
  and the unused auth-guard load in `quest-edit.html`).
- Quest Board task-visibility currently filters by role (`staff` sees dept tasks) — this logic
  is **preserved** in the orchestrator/repository using `user.role` from `requireAuth()`.

## 9. Authorization Limitations

- **No role-based page authorization** exists in legacy Quest pages (they only gate visibility
  of tasks by role at data level).
- **Firestore Security Rules are NOT in the repository** (managed externally in Firebase console).
  They remain **externally managed and outside this migration.** State as UNKNOWN where not provable.
- The new Quest does **not invent** any new permission rules.

## 10. Proposed Final File Structure

```
pages/quest/
├── index.html            → Quest Board (main + side tabs), daily report submit UI
├── quest.js              → orchestrator (auth, load, subscriptions, events, cleanup)
├── quest.repository.js   → tasks, quest_reports, intern_dailyreport, users/depts/positions
├── quest.ui.js           → board rendering + daily report modal + report accordion
└── quest.css             → Quest-specific styles (reusing theme/layout tokens)
```

Single entry point + 3 modules. The daily-report and side-quest report are **features within
the one board** (modals), NOT separate pages — evidence shows they are modals inside the board,
so a separate `daily-report/` sub-feature is **not** justified.

## 11. Migration Sequence

1. Create `pages/quest/` architecture (index, quest.js, repository, ui, css).
2. Standalone Quest Board: load + group tasks (main/side, overdue/today/upcoming), role filter.
3. Task create/edit/delete/toggle.
4. Side-quest report submit → `quest_reports` (+ storage upload + task → `reported`).
5. Daily report submit → `intern_dailyreport` (+ task → `reported` + `last_reported_by/at`).
6. Verify against legacy behavior.
7. Emulator isolation + routing + legacy regression.
8. Clean up navigation (drop missing routes).
9. Document differences. (Legacy cleanup only after stability.)

## 12. Known Risks

- **Scope breadth:** quest-board.html is 6,013 lines; full behavior (recurrence, reminder,
  who-did-this, file upload, role dept filter) must be reproduced without iframe coupling.
- **Data-field ambiguity:** recurring/reminder fields (`recur`, `reminder_mode`,
  `reminder_dates`, `deadline_time`) are complex; normalize carefully to match legacy.
- **`tasks` shared with Projects:** must not break project task reads/writes.
- **Sidebar edits:** dropping non-existent routes touches `element/sidebar.js` (10k lines) —
  do this surgically and verify legacy quest-board/iframe embedding still works.
- **Emulator:** Storage + Functions emulators are not launched (documented) — local file upload
  and any callable fail safely; core Firestore flows are testable.

---

## Decision Status: awaiting approval to implement

The proposed structure (`pages/quest/{index.html, quest.js, quest.repository.js, quest.ui.js, quest.css}`)
with standalone architecture, single entry, and dropped non-existent routes is ready for approval.
No Quest application code has been modified.