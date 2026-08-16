# Register — Feature Architecture

> **Registration is the public, self-serve onboarding page** that creates a Firebase
> Auth account and a `pending_users/{uid}` document awaiting admin approval. It is the
> migrated replacement for the legacy `register.html` (a monolithic 817-line page),
> rebuilt on the Pilot architecture. Read alongside `docs/ARCHITECTURE-FOUNDATION.md`
> (Phase 0), `docs/HOME-ARCHITECTURE.md`, `docs/INTERNSHIPS-ARCHITECTURE.md` and
> `docs/QUEST-ARCHITECTURE-ANALYSIS.md`.

---

## 1. Feature Purpose

Registration lets a prospective team member submit an application that lands in the
admin approval queue:

- capture name, position, email, password, photo, birth date, phone, Instagram,
  LinkedIn;
- live 3D **member card preview** (front/back) that mirrors the inputs;
- create a **Firebase Auth** account (`email/password`);
- upload the profile photo to Storage (`users/{uid}/profile_photo`);
- write a **`pending_users/{uid}`** document (`is_approved: false`);
- sign the new user out and show a success message, then redirect to login.

The registered user is **NOT** an active internal user until an admin approves the
pending document (see §6 Login compatibility and §8 approval flow).

---

## 2. Public Route

| URL | File served | Notes |
|---|---|---|
| `/register` | `pages/register/index.html` | Canonical public URL (Hosting rewrite) |
| `/register.html` | `register.html` (legacy, kept) | 301 redirect → `/register` in production |

`firebase.json`:

```json
"redirects": [
  { "source": "/register.html", "destination": "/register", "type": 301 }
],
"rewrites": [
  { "source": "/register", "destination": "/pages/register/index.html" }
]
```

The browser URL remains `/register`. The legacy `register.html` is deliberately kept
as a fallback (it uses the same centralized `assets/js/firebase-config.js`) and should
only be deleted after production traffic has fully moved to `/register`.

---

## 3. File Responsibilities

```
pages/register/
├── index.html           Static markup: card + form + footer. No logic.
├── register.js          Orchestrator: init, bind events, coordinate repo→ui,
│                        run the Auth→photo→pending sequence, handle partial failure.
├── register.repository.js  ONLY Firebase (Auth/Firestore/Storage). No DOM.
├── register.ui.js       ONLY presentation (card flip, photo preview, messages,
│                        position rendering). No Firebase.
└── register.css         Registration-specific styles (extracted from legacy).
```

### register.repository.js

The **only** module that talks to Firebase. Responsibilities:

- `loadPositions()` — reads `position` (fallback `positions`), returns `[{id, name}]`.
- `createAuthUser(email, password)` — returns the new UID.
- `uploadProfilePhoto(uid, file)` — uploads to `users/{uid}/profile_photo`, returns URL.
- `createPendingUser(uid, payload)` — `setDoc(doc(db, "pending_users", uid), payload)`.
- `signOutNewUser()` — signs out after successful registration.

It imports the single Firebase init from `assets/js/firebase-config.js` and throws
errors with a stable `code` (`register/permission-denied`, `register/network`,
`register/config`) that the orchestrator maps to user messages.

### register.ui.js

Pure presentation. Renders the position dropdown, live card preview (front/back),
photo preview, password show/hide, the message banner (success/error/info), submit
busy state, and redirect to login. No Firebase imports.

### register.js

Orchestrator. Binds events, loads positions, and runs the workflow below. It decides
**when** things happen and wires repository → UI, and is the only place that handles
the partial-failure sequence.

---

## 4. Firebase Auth → pending_users Flow

```
User fills form
        ↓
validate required fields (name, email, password)
        ↓
createAuthUser(email, password)   →  Firebase Auth account created (UID)
        ↓
uploadProfilePhoto(uid, file)     →  Storage users/{uid}/profile_photo → URL
        ↓
createPendingUser(uid, payload)   →  pending_users/{uid}
        ↓
signOutNewUser()
        ↓
show success  →  redirect /index.html
```

`pending_users/{uid}` shape (preserved from legacy, not renamed):

```js
{
  name: string,
  email: string,
  birth: string,        // YYYY-MM-DD
  phone: string,
  photo: string,        // download URL ("" if no file)
  employment: { position: string, department: "", joined_at: Date },
  socials: { instagram: string, linkedin: string },
  access: { role_id: "staff", level_order: 3 },
  is_approved: false,
  registered_at: Date
}
```

---

## 5. Position Loading — callable Cloud Function

**Why a function:** Registration is a **public** page (no login), but the deployed
`dialogika-co` Firestore rules deny **unauthenticated** reads of `position`/`positions`.
Reading those collections directly from the client would be **permission-denied** (the
legacy `register.html` silently showed an empty/failed dropdown). To load real positions
**without weakening Firestore rules** (no global anonymous read) and **without
hardcoding** them, the page calls a **callable Cloud Function** that uses the Admin SDK
server-side.

### Client (this repo)

`register.repository.js` calls `httpsCallable(functions, "getPositions")` and expects a
response `{ positions: [{ id, name }] }`. It never touches `position`/`positions`
directly. Errors are mapped to distinct codes:

| Error code | Message |
|---|---|
| `register/permission-denied` | "Data posisi tidak dapat diakses. Hubungi administrator." |
| `register/network` | "Koneksi ke Firebase gagal…" |
| `register/config` | "Daftar posisi belum tersedia. Silakan coba lagi nanti…" |

### Backend function (to add + deploy — needs Ron's approval)

Lives in the **separate** non-git `migration-script/functions/index.js` (deploy requires
explicit approval, per `docs/AI-PROGRESS-LOG.md`). Add a callable `getPositions` that
reads `position` (primary) then falls back to `positions`, matching the repo convention:

```js
// migration-script/functions/index.js (us-central1, same as setUserRole)
const { onCall } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const admin = require("firebase-admin");

const app = admin.apps.length ? admin.app() : initializeApp();
const db = getFirestore(app);

exports.getPositions = onCall(async () => {
  let snap = await db.collection("position").get();
  if (snap.empty) snap = await db.collection("positions").get();
  const positions = [];
  snap.forEach((ds) => {
    const d = ds.data() || {};
    const name = d.name || d.label || d.title || d.position || ds.id;
    if (name) positions.push({ id: ds.id, name: String(name) });
  });
  return { positions };
});
```

> The client's `functions` uses the default `us-central1` region (`getFunctions(app)` in
> `assets/js/firebase-config.js`), so the function must be deployed to `us-central1`.

Deploy (backend only, with Ron's approval):
```
cd migration-script
FUNCTIONS_DISCOVERY_TIMEOUT=60 firebase deploy --only functions
```

No hardcoded positions, no fabricated fallback options. If the function returns an empty
list the UI shows "Belum ada posisi yang tersedia."

---

## 6. Login Compatibility

Login (`index.html`) reads `users/{uid}`:

- **`users/{uid}` exists + `status === "Active"`** → login, record presence, → `/home`.
- **`users/{uid}` exists + status ≠ "Active"** → `account_inactive`.
- **`users/{uid}` missing + `pending_users/{uid}` exists** → `pending_approval`.
- **neither exists** → "Data profil tidak ditemukan di database."

Registration produces exactly this state: it creates the Auth account + a
`pending_users/{uid}` doc, so the applicant's first login yields **pending approval**
(not "account not registered").

Firebase Auth remains the **source of truth for authentication**; Firestore remains the
**source of truth for profile/application state**. Login does not depend on
`localStorage` for authentication.

### Improved login error mapping (`index.html`)

The legacy code mishandled network/config failures, letting them fall through to a
generic message. `mapLoginError(error)` now distinguishes:

| Failure | Message |
|---|---|
| `auth/user-not-found` | "Akun tidak terdaftar." |
| `auth/wrong-password` / `auth/invalid-credential` | "Email atau Password salah." |
| `auth/network-request-failed`, `auth/unavailable`, `internal-error` | "Koneksi ke Firebase gagal. Periksa koneksi internet atau konfigurasi Firebase." |
| `auth/invalid-api-key` | "Konfigurasi Firebase salah. Silakan hubungi Administrator." |
| `pending_approval` (thrown) | "Akun Anda sedang menunggu persetujuan Administrator." |
| `account_inactive` (thrown) | "Akun Anda telah dinonaktifkan…" |
| missing profile (thrown) | "…profil Anda belum ditemukan di database…" |
| `permission-denied` | "…akun ini belum punya izin akses data…" |
| `auth/user-disabled` | "Akun Anda telah dinonaktifkan…" |
| `auth/too-many-requests` | "Terlalu banyak percobaan login…" |
| unknown | "Email atau Password salah." |

Network/config failures are **never** shown as "Akun tidak terdaftar."

---

## 7. Storage Flow

Profile photos use the deterministic path `users/{uid}/profile_photo` (same as
`personal/profile.html` and the documented convention).

```
uploadBytes(storage/users/{uid}/profile_photo, file)
        ↓
getDownloadURL(...)  →  stored in pending_users.photo
```

---

## 8. Approval (read-only reference)

Admin approval lives in `pages/home/home.repository.js` (`approvePendingUser`):
reads the pending doc, sets `is_approved=true` + `status`, copies the whole doc to
`users/{uid}` via `setDoc`, then `deleteDoc`s the pending doc. Rejection deletes the
pending doc. Registration itself does **not** grant access or set custom claims.

---

## 9. Partial Registration Failure

The sequence `createAuthUser → uploadPhoto → createPendingUser` can fail after the
Auth account exists, leaving an Auth account without a `pending_users` doc. The
orchestrator treats each step's failure explicitly:

- **Auth creation fails** → error shown, no orphan.
- **Photo upload fails** (after Auth created) → enters a documented **recoverable
  state**: the UI tells the user their account was created but the application
  profile is incomplete and to contact an administrator.
- **pending_users write fails** (after Auth + photo) → same recoverable-state message.

The code does **not** attempt to delete the Firebase Auth user client-side (unsafe and
not permitted). It surfaces the state explicitly and logs the `uid` + failing step to
the console for admin follow-up.

---

## 10. Error Handling

Meaningful user-facing messages (not raw `alert("Error: " + error.message)`):

- Auth create: duplicate email, invalid email, weak password, network failure.
- Positions: permission denied, network, no data, config.
- Success / partial-failure info banners via `ui.showMessage()`.

Detailed `console.error` is preserved for debugging.

---

## 11. Testing

Because registration touches real `dialogika-co` Auth/Firestore/Storage and real users,
end-to-end tests require admin credentials and are not automated here. Verified in this
task:

- `/register` returns 200 (Hosting rewrite) and serves `register.js`, `register.ui.js`,
  `register.repository.js`, `register.css` (all 200).
- `/register.html` serves the legacy fallback (production applies the 301 redirect).
- Route regression: `/`, `/index.html`, `/home`, `/quest`, `/internships`, `/test` all
  200 after adding `/register`.
- Position fallback logic unit-tested: `position` populated, fallback to `positions`,
  both-empty, field-name resolution — all pass.
- Login error-mapping unit-tested for every failure mode above — all pass.
- Only **one** `initializeApp` source: `assets/js/firebase-config.js` (no call in any
  register file).
- Login Register link updated to `/register`.

### Manual test checklist

1. `/register` loads with correct styling.
2. Position dropdown populates from real Firebase `position` (or `positions`).
3. Register with a brand-new email → Auth account created.
4. `pending_users/{uid}` created with the schema in §4.
5. Photo uploaded to `users/{uid}/profile_photo`.
6. User is signed out after success.
7. Login with the same credentials → "menunggu persetujuan Administrator".
8. Existing approved users still login.
9. Wrong password → "Email atau Password salah."
10. Existing email on register → "Email ini sudah terdaftar…".
11. Simulated network failure → connection message, not "Akun tidak terdaftar".
12. `/home`, `/quest`, `/internships` still work.

---

## 12. Known Limitations

- The legacy `register.html` is retained as a fallback; it reads only `positions` and
  uses raw `alert()` — it should be deleted after production moves fully to `/register`.
- Real end-to-end registration requires live Firebase credentials (not run here).
- **The `getPositions` Cloud Function is NOT yet deployed** (backend lives in the
  separate `migration-script/` folder; deploy needs Ron's approval). Until it is
  deployed, the dropdown shows "Daftar posisi belum tersedia…" (`register/config`) —
  the page itself still works. Deploy the function per §5 to populate positions.
- The repo has no committed `firestore.rules`; position-read permissions are enforced
  server-side only. Public registration cannot read `position`/`positions` directly,
  hence the Cloud Function approach (no rule weakening).
- Docs in `docs/team-internal-map.html` are stale (still reference `pre-dialogika` and
  describe `register.html` / `home.html`); they were not rewritten in this task.