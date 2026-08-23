# Login — Feature Architecture

> **Login is the public authentication entry point** for the whole app. It signs
> team members in with Firebase Auth (email/password), gates active users into
> the app, records their presence marker, and provides password reset. It is the
> migrated replacement for the legacy root `index.html` (a monolithic 745-line
> page), rebuilt on the Pilot architecture. Read alongside
> `docs/ARCHITECTURE-FOUNDATION.md` and `docs/REGISTER-ARCHITECTURE.md`
> (Register is the sibling feature in the same auth domain).

---

## 1. Feature Purpose

Login lets an existing team member enter the app:

- sign in with **Firebase Auth** (`signInWithEmailAndPassword`);
- fetch the profile from **`users/{uid}`** and enforce the business rule
  `status === "Active"`;
- cache the session snapshot in **`localStorage.userData`**
  (`{uid, name, photo, email, position}`) — the key/shape used by legacy pages;
- write the **presence marker** (`user_presence/{uid}`, merge) so Home's
  "Who is Online" sees the login (failure is logged and swallowed — non-fatal);
- distinguish **pending approval** (`pending_users/{uid}` exists) from
  **missing profile**, with distinct messages;
- send a **password reset email** from a Bootstrap modal;
- bounce already-authenticated visitors (session + cached profile) straight to
  `/home`.

Firebase Auth is the source of truth for authentication; Firestore remains the
source of truth for profile/application state.

---

## 2. Public Route

| URL | Served content | Notes |
|---|---|---|
| `/login` | `pages/login/index.html` | Canonical public URL (Hosting rewrite) |
| `/index.html` | legacy root `index.html` locally; **301 → `/login`** in production | Redirect defined in `firebase.json` |
| `/` | legacy root `index.html` | Static fallback during coexistence |

```json
"redirects": [
  { "source": "/index.html", "destination": "/login", "type": 301 }
],
"rewrites": [
  { "source": "/login", "destination": "/pages/login/index.html" }
]
```

**Why the redirect matters:** `auth-guard.js` (`LOGIN_PATH = "/index.html"`),
the post-registration redirect in `register.ui.js`, and dozens of legacy logout
flows all navigate to `/index.html`. The 301 routes all of them to the new page
with **zero consumer code changes**. Rollback = remove the two `firebase.json`
lines.

**Known emulator limitation:** the Hosting emulator serves static files without
applying redirects (same behavior observed during the Register migration), so
locally `/index.html` still shows the legacy page. In production the redirect
applies. Test the new page locally via `/login`.

The legacy root `index.html` is deliberately kept as the coexistence fallback
(it also keeps serving `/`). Delete it only after production traffic has fully
moved to `/login` and removal is explicitly approved.

---

## 3. File Responsibilities

```
pages/login/
├── index.html           Static markup: topbar, login card, forgot-password
│                        modal, footer. No logic.
├── login.js             Orchestrator: session watch, login workflow,
│                        forgot-password workflow, error→message mapping.
├── login.repository.js  ONLY Firebase (Auth/Firestore). No DOM.
├── login.ui.js          ONLY presentation (busy states, error/success boxes,
│                        redirects). No Firebase.
└── login.css            Login-specific styles extracted verbatim from the
                         legacy inline <style> blocks; tokens come from
                         assets/css/theme.css.
```

### login.repository.js

The only module that talks to Firebase:

- `watchSession(cb)` — wraps `onAuthStateChanged`, returns unsubscribe.
- `signIn(email, password)` → Firebase user.
- `getUserProfile(uid)` → `users/{uid}` data or `null`.
- `hasPendingUser(uid)` → existence check on `pending_users/{uid}`.
- `recordLoginPresence(user, profile)` — merge-write `user_presence/{uid}`
  (same doc shape as Home's `updatePresence`: `user_id`, `name`, `photo`,
  `last_active_at: serverTimestamp()`).
- `sendPasswordReset(email)` — wraps `sendPasswordResetEmail`.
- `signOutCurrentUser()` — used when a signed-in account turns out inactive or
  pending.

### login.ui.js

Pure presentation: submit/forgot busy states (spinner markup preserved),
error/success boxes (`errorMessage`, `forgotErrorMessage`,
`forgotSuccessMessage`), forgot-form reset, `redirectToHome()` (`/home`).
Zero Firebase imports.

### login.js

Orchestrator. Binds form events, subscribes to the session watch, runs both
workflows, and owns the error mapping (`mapLoginError`, `mapForgotError`) copied
verbatim from legacy so every failure mode keeps its exact user-facing message
(network/config failures are never shown as "account not registered").

---

## 4. Login Flow (preserved verbatim)

```
submit → signIn (Auth)
              ↓
      users/{uid} exists?
      ├─ yes + status !== "Active" → signOut → "account_inactive"
      ├─ yes + Active              → localStorage.userData
      │                              → presence merge write (errors swallowed)
      │                              → "Login Berhasil!" → /home (800 ms)
      └─ no  → pending_users/{uid} exists?
                ├─ yes → signOut → "pending_approval"
                └─ no  → "Data profil tidak ditemukan di database."
```

Session watch (module init): `user && localStorage.getItem("userData")` →
redirect `/home`. Both conditions preserved exactly from legacy.

---

## 5. Firebase Collections / Services

| Resource | Access | Purpose | Owner |
|---|---|---|---|
| Firebase Auth | signIn / reset email / signOut / session watch | Authentication | shared (`firebase-config.js`) |
| `users/{uid}` | READ | Profile: `status`, `name`, `photo`, `email`, `employment.position` | Users domain (Home approves/copies here) |
| `pending_users/{uid}` | READ | Distinguish pending approval from missing profile | Register writes; Home approves/deletes |
| `user_presence/{uid}` | MERGE WRITE | Presence marker consumed by Home "Who is Online" | Home feature (cross-feature write preserved from legacy) |
| `localStorage.userData` | WRITE (+READ on watch) | Session snapshot for legacy/new consumers | Login |

No Storage, no Cloud Functions, no external APIs, no schema changes.

---

## 6. Authentication & Authorization

- **Authentication:** Firebase Auth email/password. No duplicate init — uses the
  single `assets/js/firebase-config.js`.
- **Authorization:** none on this page by design (it IS the gate). Role logic
  lives exclusively in `auth-guard.js` (custom claims) and is unchanged.
- The Active/pending/profile checks replicate legacy behavior 1:1; nothing was
  weakened or strengthened.

---

## 7. Visual Compatibility

- Markup copied verbatim from legacy (topbar, card, modal, footer).
- Styles extracted into `login.css`; token values are provided by
  `assets/css/theme.css` (identical values — the legacy inline tokens were the
  source of theme.css).
- One intentional difference: legacy overrode `--bg-body` to `#f8fafc`
  (theme default `#f1f7fd`); kept as a literal value in `login.css` for pixel
  parity.
- Dead code intentionally dropped: the inline `[data-theme="dark"]` token block.
  Nothing ever set `data-theme` on this page (no `theme.js` loaded), so it was
  inert; parity preserved.

---

## 8. Testing

Because login touches real `dialogika-co` Auth/Firestore and real users,
credential end-to-end tests were not run here (a real login performs a
production presence merge-write). Verified in this task:

- `/login` → 200, serves the new page (theme.css + login.css + module
  `./login.js`, no inline styles).
- `/pages/login/{index.html,login.js,login.repository.js,login.ui.js,login.css}`
  all 200 via the Hosting emulator.
- `/` still serves the untouched legacy login (regression).
- `/register`, `/home`, `/internships`, `/test`, shared assets → all 200.
- `node --check` passes for all three modules.
- `mapLoginError`/`mapForgotError` unit-tested: 18 cases covering every legacy
  failure mode (pending, inactive, missing profile, network, config,
  credentials, disabled, rate limit, permission-denied, fallbacks) — all pass.
- No `initializeApp` outside `assets/js/firebase-config.js`; repository has zero
  DOM references; UI has zero Firebase imports.

### Manual test checklist (requires credentials)

1. Visit `/login` while logged out → card renders, no auto-redirect.
2. Login with wrong password → "Email atau Password salah.", button recovers.
3. Login with pending account → "menunggu persetujuan Administrator."
4. Login with valid Active account → presence updated, redirected to `/home`.
5. While logged in, open `/login` again → bounced to `/home`.
6. Forgot password with registered email → success message in modal.
7. Logout from any feature → lands on the login page (legacy `/index.html`
   until production applies the 301).

---

## 9. Known Limitations & Deferred Work

- The 301 `/index.html` → `/login` only takes effect in **production**
  (emulator ignores redirects). Until deploy, local logout flows land on the
  legacy page.
- `auth-guard.js LOGIN_PATH` still points to `/index.html`. Updating it to
  `/login` would remove a redirect hop but touches a **shared foundation file**
  used by every feature — deliberately deferred to a dedicated shared-shell
  change rather than doing it inside this feature branch.
- Root `/` continues serving the legacy page until cutover is approved; after
  verification, replace/remove root `index.html` (needs explicit approval per
  migration rules).
- `register.ui.js redirectToLogin()` still targets `/index.html` — works via the
  production 301; updating it belongs to a future register touch-up, not this
  branch.
- Credential E2E not executed (real production Auth/Firestore; see §8 checklist).
