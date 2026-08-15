# Architecture Foundation v1 — Implementation Guide

> **Phase 0 deliverable.** This document explains the architectural foundation that now exists in **Pilot**, how to use it, and the rules for building future features on top of it. It is written for a new intern.
>
> - **Language:** HTML, CSS, Vanilla JavaScript (ES Modules), Firebase, Firestore, Firebase Auth, Firebase Hosting.
> - **No build step, no framework, no router library.**
> - This is a **guide for refactoring Pilot**, not a description of the whole legacy app.

---

## 1. Folder Structure

The foundation adds a small number of shared files alongside the existing (legacy) app. New code goes in the shared folders below; **legacy code is not moved or rewritten**.

```
pilot/
├── firebase.json            # Firebase Hosting config + rewrites
├── .firebaserc              # Which Firebase project Pilot points to
├── index.html               # Login page (legacy, still works)
│
├── assets/
│   ├── js/
│   │   ├── firebase-config.js   # SINGLE Firebase init (exists)
│   │   ├── auth-guard.js        # requireAuth() auth gate (exists)
│   │   ├── utils.js             # NEW shared utilities
│   │   ├── ui.js                # NEW shared UI helpers (toast/confirm/loading/modal)
│   │   ├── theme.js             # dark/light theme manager (exists)
│   │   ├── sidebar.js           # NEW shared sidebar shell
│   │   └── topbar.js            # NEW shared topbar shell
│   ├── css/
│   │   ├── style.css            # LEGACY global CSS (unchanged, still used by legacy pages)
│   │   ├── theme.css            # NEW design tokens + dark mode
│   │   └── layout.css           # NEW app shell primitives (topbar/sidebar/main)
│   └── img/
│
├── pages/
│   ├── home/                # Existing Home refactor (js modules)
│   ├── test/                # Routing proof-of-concept
│   └── ...                  # Future feature folders
│
├── element/                 # LEGACY shared components (topbar/sidebar) — frozen
├── data/ setting/ project/ quest/ personal/ example/ backend/   # LEGACY pages — frozen
└── docs/
```

**Key idea:** the foundation adds **new shared files** for new/refactored features. Legacy pages keep using their old files (`element/`, `assets/css/style.css`). The two coexist.

---

## 2. Responsibilities of the Shared JavaScript Modules

| File | Responsibility | What it must NOT contain |
|---|---|---|
| `assets/js/firebase-config.js` | Initialize Firebase once; export `app`, `auth`, `db`, `storage`, `functions` | Feature queries, business logic, UI, permission decisions |
| `assets/js/auth-guard.js` | Answer *"is the user authenticated?"* via `requireAuth()`, plus `logout()` | Role/permission systems, page rendering |
| `assets/js/utils.js` | Genuinely reusable helpers (formatting, DOM safety, debounce/throttle) | Feature-specific helpers |
| `assets/js/ui.js` | Generic UI feedback: toast, confirm, loading, modal helpers | Feature rendering, feature queries |
| `assets/js/theme.js` | Apply dark/light theme | — |
| `assets/js/sidebar.js` | Render the shared app sidebar (mount `#dg-sidebar-mount`) | Feature menus/logic |
| `assets/js/topbar.js` | Render the shared app topbar (mount `#dg-topbar-mount`) | Feature menus/logic |

### Rules
- **Shared code is shared only if genuinely used by 2+ features.**
- Do **not** create files like `quest-helper.js`, `project-helper.js`, `task-helper.js` in `assets/js/`. Feature-specific code belongs inside the feature folder.

---

## 3. Feature Structure (Convention for Future Work)

A feature lives under `pages/<feature>/`. Use the **minimum structure necessary** — small features do not need every file.

```
pages/
└── quest/
    └── tasks/
        ├── index.html            # Page entry point + structure
        ├── tasks.js              # Orchestration / business flow
        ├── tasks.ui.js           # DOM manipulation & rendering
        ├── tasks.repository.js   # Firestore / Firebase data access
        └── tasks.css             # Feature-specific styling
```

**Do NOT create** `feature.service.js`, `feature.controller.js`, `feature.model.js`, `feature.mapper.js`, etc., just because those layers are theoretically possible. If a feature is small, combine files.

---

## 4. Repository Responsibility

Data access flows through a **repository** per feature:

```
Page → Feature Logic → Repository → Firebase / Firestore
```

A repository file (e.g. `tasks.repository.js`) contains data-access functions:

```js
// tasks.repository.js — example shape
export function getTasks(projectId) { ... }
export function getTask(taskId) { ... }
export function createTask(data) { ... }
export function updateTask(id, patch) { ... }
export function deleteTask(id) { ... }
```

A repository must **NOT** contain DOM manipulation, HTML rendering, button listeners, navigation, or visual state.

> **Phase 0 note:** This is a **convention for future work**. We do **not** migrate existing Firestore queries during Phase 0.

---

## 5. Firebase Access Rules

- **Only one Firebase initialization** exists: `assets/js/firebase-config.js`. Import `db`/`auth` from it. Never call `initializeApp` in a page.
- **Only the feature's repository** should talk to Firestore/Auth/Storage directly. Pages and UI logic call the repository.
- **Exception:** `auth-guard.js` may read auth state; it is the auth boundary.

---

## 6. Authentication Responsibility

- `assets/js/auth-guard.js` provides `requireAuth()` which resolves to `{ user, role }` and redirects to login if unauthenticated.
- It answers **only**: *"is the user authenticated?"* It does **not** become a general permission system.
- **Do not duplicate Firestore Security Rules** in frontend JavaScript. The server rules are the source of truth for permissions.
- Preserve existing login/logout behavior; the new `topbar.js` uses `logout` from `auth-guard.js`.

---

## 7. Routing

Firebase Hosting maps **public URLs** to **internal HTML entry points**. The browser uses public URLs.

```
Public URL     → Firebase Hosting Rewrite → Internal HTML file
/test          → pages/test/index.html
```

Navigation must use the public URL:

```html
<a href="/quest/tasks">  <!-- CORRECT -->
<a href="/pages/quest/tasks/index.html">  <!-- WRONG -->
```

### Rules
- **No client-side SPA router.**
- **No catch-all rewrite** that sends every URL to one `index.html`.
- Add one rewrite line per public route in `firebase.json`.
- Preserve existing working routes.

Example `firebase.json` hosting section:

```json
{
  "hosting": {
    "public": ".",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "/test", "destination": "/pages/test/index.html" },
      { "source": "/home", "destination": "/pages/home/index.html" }
    ]
  }
}
```

---

## 8. Firebase Hosting Rewrites (summary)

- One rewrite per public route.
- Public URL is the **application contract**; internal file path is an implementation detail.
- Keep legacy pages reachable while migrating; do not break existing routes.

---

## 9. CSS Conventions

Three CSS concerns, kept separate:

| Concern | File | What it contains |
|---|---|---|
| Theme / tokens | `assets/css/theme.css` | colors, typography, spacing, dark mode variables |
| Layout / shell | `assets/css/layout.css` | topbar, sidebar, main content, loading overlay |
| Feature styles | `pages/<feature>/<feature>.css` | feature-specific styling |

- **No inline `<style>` blocks in new pages.**
- Legacy pages keep using `assets/css/style.css`; do not migrate all CSS at once.

---

## 10. Shared vs Feature-Specific Code

**Shared infrastructure** (in `assets/js/`) is only for genuinely reusable code.

**GOOD:**
```
assets/js/
├── firebase-config.js  auth-guard.js  utils.js  ui.js  sidebar.js  topbar.js
```

**BAD:**
```
assets/js/
├── quest-helper.js  project-helper.js  task-helper.js  recruitment-helper.js  user-helper.js
```

Feature-specific code belongs inside the feature. Do not recreate the legacy "everything in one shared folder" problem.

---

## 11. Legacy Coexistence

- The legacy app (in `data/`, `setting/`, `project/`, `quest/`, `personal/`, `example/`, `element/`, `backend/`) **keeps working unchanged**.
- Legacy pages still use `element/topbar.js`, `element/sidebar.js`, and `assets/css/style.css`.
- The **new** shared components (`assets/js/sidebar.js`, `assets/js/topbar.js`) mount to dedicated `#dg-*` containers, so they never conflict with legacy components.
- **Do not move or rename legacy files for cosmetic reasons.**

---

## 12. Migration Rules

1. Migrate **one feature at a time**, using the structure in §3.
2. A feature is done when it works against live data E2E, its repository owns all its Firebase access, and no legacy consumer is left depending on the old version.
3. **Only after** every consumer is migrated and the replacement is verified, delete the legacy module.
4. Never rewrite a feature *and* delete its legacy version in the same step.
5. Keep changes small and reviewable.

---

## 13. Safety

- Pilot is a **copy**; the production site is live.
- **Do not deploy to production.**
- **Do not delete or modify production Firestore data, authentication, or security rules.**
- There is **one** Firebase project: `dialogika-co`. Local development is isolated through the **Firebase Emulator Suite** (see §14), not a second project.
- `.firebaserc` remains `dialogika-co` on purpose. Local requests reach the emulator because `assets/js/firebase-config.js` connects the SDK to emulator endpoints **when running on localhost**.

---

## 14. Phase 0.5 — Local Environment Isolation (Emulator Suite)

> There is **ONE** Firebase project: `dialogika-co`. Environment separation is provided by the **Emulator Suite**, not a second project.

### Production
```
Browser
   ↓
Production Website
   ↓
Firebase Project: dialogika-co
   ├── Authentication
   ├── Firestore
   ├── Storage
   └── Functions
```

### Local Development
```
Browser
   ↓
Firebase Hosting Emulator  (port 5000)
   ↓
Firebase SDK (firebase-config.js)
   ↓
Firebase Emulator Suite
   ├── Authentication Emulator  (9099)
   ├── Firestore Emulator       (8080)
   ├── Storage Emulator         (9199)
   └── Functions Emulator       (5001)  ← not running; see limitation
```

### How the app decides LOCAL vs PROD
`assets/js/firebase-config.js` checks `window.location.hostname`:
- `localhost` or `127.0.0.1` → connects `auth`/`db`/`storage`/`functions` to emulator endpoints.
- any other hostname (e.g. `team.dialogika.co`) → uses production `dialogika-co`.

The project ID stays the same; the **runtime environment** decides. Same project ID does **not** mean local requests reach production.

### Start the emulators
```
firebase emulators:start
```
Serves everything locally. Emulator UI at `http://localhost:4000`.

To run a subset (e.g. hosting + firestore):
```
firebase emulators:start --only hosting,firestore
```

### Stop the emulators
Press `Ctrl+C` in the terminal running the emulator. (Or stop the terminal process.)

### Emulator ports
| Service | Port |
|---|---|
| Hosting | 5000 |
| Authentication | 9099 |
| Firestore | 8080 |
| Storage | 9199 |
| Functions | 5001 (not running) |
| Emulator UI | 4000 |

### Create a local Auth test user
Use the Emulator UI (`http://localhost:4000` → Auth → Add user), or in code call
`createUserWithEmailAndPassword(auth, email, password)` while the app is served from `localhost:5000`.
Users created here exist **only in the emulator** — never in production.

### Reset emulator data
Emulator data is held in memory/local disk and is **not** production data. To reset:
1. Stop the emulators.
2. Delete the local data directory:
   ```
   .firebase/
   ```
   (This folder is emulator state only; it is already git-ignored.)
3. Restart `firebase emulators:start`.

### Verify emulator connectivity
1. Start `firebase emulators:start`.
2. Open the app at `http://localhost:5000`.
3. In browser DevTools → Network, check requests go to:
   - Auth → `localhost:9099`
   - Firestore → `localhost:8080`
   - Storage → `localhost:9199`
   Not to `*.googleapis.com` (that would mean production).

### Verify the active Firebase CLI project
```
firebase use
```
Expected: `dialogika-co`. This is correct — the emulator uses the same project ID; only local requests are rerouted to the emulator.

### Commands that must NOT be used casually
- `firebase deploy` (deploys to production hosting/functions/rules)
- `firebase deploy --only firestore:rules` (overwrites production security rules)
- `firebase deploy --only functions` (deploys functions to production)
- Any `firebase firestore:delete` / `firebase storage:...` against production

These target production `dialogika-co`. Never run them for local work.

### Known limitation — Functions
There is **no Functions source code** in this repo (functions live in the backend `migration-script/`, outside Pilot). Therefore:
- The Functions emulator is **not configured** to run.
- `firebase-config.js` still points the Functions SDK to the local port so local calls can **never silently fall back to production**.
- Local callable-function calls will **fail** (safe), because no local functions emulator is listening.
- Do **not** invent function implementations here; do **not** deploy production functions.
