# Architecture Review — Phase 1.5

> Review-only. Verifies whether the Phase 0 / 0.5 / 1 architecture is mature
> enough to become the standard migration pattern for future features.
> No application code was changed during this review.

---

## 1. Review Scope

Reviewed actual repository state (not prior summaries):

- **Shared foundation:** `assets/js/{firebase-config,auth-guard,sidebar,topbar,ui,utils,theme,class-sync}.js`, `assets/css/{theme,layout,style}.css`
- **New Home:** `pages/home/{index.html,home.js,home.repository.js,home.ui.js,home.css}`
- **Legacy Home:** `home.html` + `pages/home/home-{dashboard,firebase,utils,presence,announcements,projects,approvals,menu-badges}.js`
- **Config:** `firebase.json`, `.firebaserc`
- **Docs:** `ARCHITECTURE-FOUNDATION.md`, `HOME-ARCHITECTURE.md`, `HOME-ARCHITECTURE-ANALYSIS.md`

**Note:** `permissions.js` and `router.js` (listed in the review brief) **do not exist** in this repository. Permission/role logic lives in `auth-guard.js`; routing is done via Firebase Hosting rewrites (no router module). These are informational, not defects.

---

## 2. Foundation Review

| Module | Owns | Truly shared | Feature-specific logic | Verdict |
|---|---|---|---|---|
| `firebase-config.js` | Single `initializeApp`, exports `auth/db/storage/functions` (real project, no emulator wiring) | Yes | No | Keep as-is |
| `auth-guard.js` | `requireAuth`, role-from-custom-claim, `logout` | Yes | No | Keep |
| `sidebar.js` | Role-filtered nav + logout | Yes | No (role data is shared) | Keep |
| `topbar.js` | Shared shell header + theme toggle + logout | Yes | No | Keep |
| `ui.js` | `toast`, `confirmDialog`, `showModal/hideModal`, loading, `setButtonBusy` | Yes | No | Keep |
| `utils.js` | Generic date/string/debounce helpers | Yes | No (rule: only multi-feature code) | Keep |
| `theme.js` | Dark/light theme via `<html data-theme>` | Yes | No | Keep |
| `class-sync.js` | BroadcastChannel + sync-badge + highlight | **Partial** | **Yes (class/calendar specific)** | Note (below) |

**Finding (LOW / INFORMATIONAL):** `class-sync.js` sits in the shared `assets/js/` but its logic is class/calendar-specific (sync badge, `cal-card-new` highlight, `dialogika_class_sync` channel). It is a shared *file* but a single-consumer *feature util*. This is not a defect — it is a shared module used by one (legacy) feature. When the class feature is migrated, this should move into that feature's folder. Does not block the Home pattern.

No shared module contains Home-specific logic. No hidden coupling found.

---

## 3. Home Architecture Review

| File | Responsibility | Verified |
|---|---|---|
| `index.html` | Markup, mounts (`#dg-topbar-mount`, `#dg-sidebar-mount`), apps grid, modals | No Firestore queries / no `initializeApp` ✅ |
| `home.js` | Orchestrator: `requireAuth` → shell → repo → ui → events → cleanup | No queries, no raw rendering (230 lines) ✅ |
| `home.repository.js` | **All** Firestore/Auth access | Zero DOM references ✅ |
| `home.ui.js` | **All** rendering + events | Zero Firestore calls ✅ |
| `home.css` | Home-only styles reusing theme/layout tokens | No duplicated globals ✅ |

Boundary exceptions found:

- **`home.ui.js` imports `ANNOUNCEMENT_COLORS` from `home.repository.js`** (ui.js:19). Colors are *presentation* data living in the *data-access* module, forcing a ui→repository dependency. **Not circular** (repository never imports ui). Severity: **LOW / INFORMATIONAL** — safe, but if desired later, move the color map into `home.ui.js`. Does not require change.

No god files. `home.js` stays at 230 lines. HTML holds no business logic. CSS does not leak into foundation (see §9).

---

## 4. Data Flow Review

Intended flow confirmed:

```
Event → home.js → repository → Firebase
Firebase → repository → home.js → ui → DOM
```

Bypass scan:

| Potential bypass | Found? | Class |
|---|---|---|
| UI → Firebase | No | — |
| HTML → Firebase | No | — |
| repository → DOM | No | — |
| global function → Firebase | `window.logout` only (orchestrator exposing shared logout) | **intentional** |

`window.logout` (home.js:223) is the only global exposed; it just forwards to `auth-guard.logout()`. Acceptable for shell compatibility.

---

## 5. Shared vs Feature Boundaries

| Capability | Classification | Correct? |
|---|---|---|
| Authentication / role | SHARED (`auth-guard.js`) | ✅ |
| Sidebar / topbar | SHARED | ✅ |
| Toast / modal / loading | SHARED (`ui.js`) | ✅ |
| Theme | SHARED | ✅ |
| Utilities | SHARED | ✅ |
| Presence | **FEATURE-SPECIFIC** (Home "Who is Online") | ✅ |
| User info display | FEATURE-SPECIFIC | ✅ |
| Badges | **CROSS-FEATURE** (deferred) | ✅ (see §6) |
| Firebase initialization | SHARED (single init) | ✅ |

No new abstractions proposed. Boundaries are correct.

---

## 6. Menu Badge Review

**Classification: CROSS-FEATURE → future dedicated capability.**

Evidence: legacy `home-menu-badges.js` queries ~10 collections (`branding_content`, `class_planning`, leads, etc.) on a `setInterval`. These counters track data owned by **other** features (Branding, Class Planning, Closing). They are not Home's data.

The decision to **defer** is correct: implementing them inside Home would re-introduce cross-feature queries into the reference implementation, coupling Home to every other domain. They belong to a future shared/notification capability once several features are migrated.

**Verdict:** remain deferred. Insufficient information to build correctly now; the legacy version remains for comparison.

---

## 7. Routing Review

```
/home → Firebase Hosting rewrite → /pages/home/index.html
```

- Browser stays at `/home` (verified: served content equals the physical file; no client redirect, no JS `location` override).
- No SPA router, no catch-all rewrite. Only `/test` + `/home` defined.
- **Pattern is appropriate** and generalizes to future features: each feature gets `pages/<feature>/index.html` + a named rewrite.

---

## 8. Firebase / Emulator Review

- Single project `dialogika-co` (`.firebaserc`). No second project.
- **Phase 0.5 revision:** no Firebase-service emulator connections. `firebase-config.js` initializes
  the SDK once against the real `dialogika-co` project for ALL environments; there is no `IS_LOCAL_DEV`
  gate and no `connect*Emulator` calls for Auth/Firestore/Storage/Functions.
- `firebase.json` defines **only** the Hosting emulator: port 5000. Auth/Firestore/Storage/Functions
  emulators are removed.
- LOCAL uses the real `dialogika-co` Firebase services (Auth/Firestore/Storage/Functions); only the
  Hosting layer is emulated. Writes made from localhost affect real production data — see
  `ARCHITECTURE-FOUNDATION.md` §14 warning.
- Functions source is not in this repo; no Functions are deployed from here. `functions` is initialized
  against the real project (no local emulator, no local fallback port).
- **Accidental-production risks:** by design, localhost talks to production services. Reads are safe for
  verification; destructive writes/deletes/rules experiments must be avoided. (Legacy
  `data/leads-agent.html` hardcodes a production REST URL — not part of Home, documented in prior phases, untouched.)

---

## 9. Legacy Coexistence Review

- **No duplicate `initializeApp`** — single init in `firebase-config.js`; legacy pages still load their own legacy init but on separate pages (no runtime collision on any single page).
- **No DOM ID collisions** between new Home (`dg-topbar-mount`, `welcomeMessage`, `onlineUsersContainer`, …) and legacy shell (`topbarContainer`, `sidebarContainer`).
- **No global JS variable conflicts** — new Home uses ES modules with no `window.*` except the intentional `logout`.
- **CSS:** new `home.css` reuses class names also defined in legacy global `style.css` (`.app-box`, `.avatar-wrapper`, `.menu-badge`, `.online-scroll-container`). **No runtime collision** because the new page loads `theme.css` + `layout.css` + `home.css` and **never** `style.css`. Verified only legacy `home.html` loads `style.css`. Severity **LOW / INFORMATIONAL** — future migrators must not load legacy `style.css` on migrated pages.
- Legacy `home.html` + `pages/home/*` legacy modules remain untouched and available for comparison.

---

## 10. Architecture Smells

| Smell | Found? | Severity |
|---|---|---|
| God files | No | — |
| Global mutable state | Minimal (`window.logout` only) | LOW/INFORMATIONAL |
| Duplicated logic | Minor (class names reused in `home.css`, no conflict) | LOW |
| Hidden dependencies | No | — |
| Circular dependencies | No | — |
| Feature leakage | No (menu badges correctly deferred) | — |
| Excessive abstraction | No | — |
| Unnecessary files | No (5 files, minimal) | — |
| Repository misuse | No (0 DOM refs) | — |
| UI/data coupling | `ANNOUNCEMENT_COLORS` in repository, imported by ui | LOW |
| Global CSS leakage | No runtime leakage | — |
| Duplicate Firebase init | No | — |

No **CRITICAL / HIGH** findings. The only items are LOW/INFORMATIONAL and none requires a change to proceed.

---

## 11. Intern Onboarding Test

A new intern with HTML/CSS/JS/Firebase reading the repo can determine:

| Question | Answerable? | Via |
|---|---|---|
| Where a new feature belongs | ✅ | `pages/<feature>/` pattern (HOME-ARCHITECTURE §3) |
| Where its HTML belongs | ✅ | `pages/<feature>/index.html` |
| Where its CSS belongs | ✅ | `pages/<feature>/<feature>.css` |
| Where its data access belongs | ✅ | `<feature>.repository.js` |
| Where its UI logic belongs | ✅ | `<feature>.ui.js` |
| Where shared code belongs | ✅ | `assets/js`, `assets/css` |
| How to create a route | ✅ | `firebase.json` rewrites (HOME-ARCHITECTURE §2, §9) |
| How to test locally | ✅ | `ARCHITECTURE-FOUNDATION.md` §14 (Hosting emulator + real services) |
| How to verify real-Firebase usage | ✅ | §14 network check → `*.googleapis.com`, no localhost service ports |
| How to avoid destructive production data | ✅ | §14 warning: reads preferred; no destructive tests/deletes/schema experiments |

**Documentation gaps (INFORMATIONAL):** a single `ARCHITECTURE-FOUNDATION.md` already covers emulator + safety. The pattern is teachable from `HOME-ARCHITECTURE.md` + `pages/home/*` alone. No critical gap.

---

## 12. Future Feature Simulation (Quest)

Inspection: Quest is a large legacy domain (`/quest/*`, multiple dashboards, tasks, daily reports, difficulty, points). The Home pattern generalizes as:

```
pages/quest/
├── index.html
├── quest.js          (orchestrator)
├── quest.repository.js
├── quest.ui.js
└── quest.css
```

**Would it make sense?** Yes — the pattern is domain-agnostic:
- repository for Quest's Firestore reads/writes (tasks, points, reports);
- ui for Quest's rendering;
- orchestrator for Quest's workflow;
- shared foundation (`auth-guard`, `ui`, `utils`, `theme`, shell) reused unchanged;
- a `/quest/...` hosting rewrite.

Caveat: Quest is large and probably needs more than one page. The pattern supports this via multiple HTML entry points each with their own orchestrator, sharing one `quest.repository.js` + `quest.ui.js` — no new abstraction required.

**Classification: A) standard pattern.** `feature.js + feature.repository.js + feature.ui.js` should be treated as the standard. It is simple, Vanilla-native, and validated by Home.

---

## 13. Final Verdict

# READY

The architecture is mature enough to be taught to the next batch of interns as the standard way to build a feature.

**Evidence:**
- Clean, verified separation of concerns (repository has 0 DOM, ui has 0 Firebase).
- Single Firebase init + hostname-based emulator isolation, no accidental-production risk.
- Routing pattern is simple and generalizes.
- Legacy coexists safely; nothing deleted or modified unnecessarily.
- No god files, no circular deps, no global CSS leakage, no excessive abstraction.
- Intern can answer all 10 onboarding questions from the docs + reference implementation alone.
- Quest simulation confirms the pattern generalizes.

**Non-blocking notes (LOW/INFORMATIONAL, no change required):**
1. `ANNOUNCEMENT_COLORS` lives in repository but is presentation data (ui imports it). Optionally move to `home.ui.js` later.
2. `class-sync.js` is a single-consumer shared file; move into its feature on future migration.
3. New `home.css` reuses class names from legacy `style.css`; never load legacy `style.css` on migrated pages.

---

## 14. Recommendations

1. **Proceed to Phase 2 — Quest Migration** using the Home pattern as the template.
2. Do **not** change the Home code now (no critical defect).
3. During Quest migration, revisit the three LOW notes opportunistically; none blocks progress.
4. Keep legacy code until each feature is migrated and verified; only delete with explicit approval.
5. Extend the pattern to multi-page features by sharing `feature.repository.js` + `feature.ui.js` across entry pages, each with its own orchestrator.

---

**Boundary respected:** no code changed, nothing deployed, no production data/rules touched, no features migrated, legacy untouched. Review complete.