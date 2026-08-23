# Dialogika Pilot

> **Internal dashboard** untuk mengelola operasional tim Dialogika — berbasis
> static HTML + **Firebase** (Auth + Firestore + Storage).

Pilot sedang dimigrasi dari arsitektur legacy (HTML monolitik per halaman) ke
arsitektur modular baru. Dokumentasi lengkapnya ada di `docs/ARCHITECTURE-FOUNDATION.md`.

---

## Struktur Proyek

```
pilot/
├── firebase.json                  # Hosting config, routing, emulator
├── .firebaserc                    # Firebase project: dialogika-co
│
├── index.html                     # Redirect stub → /login (legacy login已被迁移)
│
├── pages/                         # Fitur baru (arsitektur Pilot)
│   ├── login/                     #   /login  — Autentikasi (email/password, forgot password)
│   ├── home/                      #   /home   — Dashboard: online users, announcements, approvals, apps grid
│   ├── register/                  #   /register — Registrasi user baru (pending approval)
│   ├── internships/               #   /internships — Internship management
│   ├── quest/                     #   (quest pages — modal components in shared/)
│   └── test/                      #   /test — Routing proof-of-concept
│
├── assets/
│   ├── js/
│   │   ├── firebase-config.js     # Firebase init tunggal (app, auth, db, storage, functions)
│   │   ├── auth-guard.js          # requireAuth(), role custom claim, logout()
│   │   ├── ui.js                  # Shared UI: toast, confirm, modal, loading, setButtonBusy
│   │   ├── utils.js               # Shared helpers (formatting, debounce)
│   │   ├── theme.js               # Dark/light theme via <html data-theme>
│   │   ├── class-sync.js          # BroadcastChannel class sync (legacy consumer)
│   │   └── components/            # Shared shell components
│   │       ├── sidebar/           #   Shared sidebar (role-filtered nav)
│   │       ├── topbar/            #   Shared topbar (theme toggle, logout)
│   │       ├── quest-modal/       #   Quest board modal
│   │       ├── report-modal/      #   Daily report modal
│   │       └── rich-editor/       #   Tiptap rich text editor
│   ├── css/
│   │   ├── theme.css              # Design tokens, dark mode, typography
│   │   ├── layout.css             # App shell layout (topbar, sidebar, main)
│   │   └── style.css              # LEGACY global CSS (hanya dipakai halaman legacy)
│   └── img/
│
├── element/                       # LEGACY komponen UI (sidebar, topbar lama) — frozen
├── data/                          # LEGACY halaman data: Leads, Kandidat, Presensi, Inventory
├── setting/                       # LEGACY halaman admin: User, Team, Class, Invoice, dll
├── project/                       # LEGACY Project & Task management + Message & Files
├── personal/                      # LEGACY Profil pribadi, Form izin & reimburse
├── quest/                         # LEGACY People Development & Recruitment Dashboard
├── presence.html                  # LEGACY Presensi kehadiran
├── register.html                  # LEGACY Redirect ke /register (301 di production)
├── backend/                       # Asset backend (Apps Script legacy, CNAME)
├── docs/                          # Dokumentasi teknis
└── Text-Editor-Tiptap/            # Tiptap editor project (submodule)
```

---

## Arsitektur (Pilot Pattern)

Setiap fitur baru mengikuti struktur ini:

```
pages/<feature>/
├── index.html                  # Markup, mount points, script/style imports
├── <feature>.js                # Orchestrator — inisialisasi, event wiring, repo→ui flow
├── <feature>.repository.js     # HANYA akses Firebase (Auth/Firestore/Storage) — NO DOM
├── <feature>.ui.js             # HANYA presentasi (DOM, render, modal) — NO Firebase
└── <feature>.css               # Style khusus fitur (reuse theme.css tokens)
```

**Aturan:** Repository tidak manipulasi DOM. UI tidak akses Firebase. Tidak ada
`initializeApp` ganda — semua lewat `assets/js/firebase-config.js`.

Dokumentasi detail:
- `docs/ARCHITECTURE-FOUNDATION.md` — fondasi + rules untuk migrasi
- `docs/ARCHITECTURE-REVIEW.md` — review kematangan arsitektur
- `docs/HOME-ARCHITECTURE.md` — referensi implementasi pertama (Home)
- `docs/REGISTER-ARCHITECTURE.md` — Registrasi (public page + callable function)
- `docs/LOGIN-ARCHITECTURE.md` — Login (autentikasi entry point)
- `docs/INTERNSHIPS-ARCHITECTURE.md` — Internships

---

## Routing

Public URL → Firebase Hosting rewrite → `pages/<feature>/index.html`

| URL | Feature | File |
|-----|---------|------|
| `/` | Redirect → `/login` | `index.html` (stub) |
| `/login` | Login | `pages/login/index.html` |
| `/home` | Dashboard | `pages/home/index.html` |
| `/register` | Registrasi | `pages/register/index.html` |
| `/internships` | Internships | `pages/internships/index.html` |
| `/test` | Test page | `pages/test/index.html` |

Redirect legacy (di `firebase.json`):
- `/index.html` → `/login`
- `/home.html` → `/home`
- `/register.html` → `/register`

---

## Setup

### Prerequisites

- [Firebase CLI](https://firebase.google.com/docs/cli) (`npm install -g firebase-tools`)
- Node.js 18+

### Local Development

```bash
firebase login
firebase emulators:start --only hosting
```

Buka `http://localhost:5000`. Emulator Hosting melayani statis; Auth/Firestore/Storage
tetap ke project **real** `dialogika-co` (hati-hati — lihat § Environment di bawah).

### Firebase Project

- Project: **dialogika-co**
- Config: `assets/js/firebase-config.js`
- Auth: email/password
- Firestore: 7-level role system via custom claims

### Role System

| Role | Level |
|------|-------|
| owner | 1 |
| admin | 2 |
| team | 3 |
| staff | 4 |
| intern | 5 |
| mentor | 6 |
| member | 7 |

Role ditetapkan via Cloud Function `setUserRole` (custom claim).
Dibaca dari `user.getIdTokenResult().claims.role` di `auth-guard.js`.

### Deploy

```bash
firebase deploy --only hosting
```

**Jangan deploy Firestore rules / Functions tanpa approval** — target project real.

---

## Environment

### Local

```
Browser → Firebase Hosting Emulator (localhost:5000)
       → Firebase SDK (real dialogika-co project)
           ├── Authentication
           ├── Firestore
           ├── Storage
           └── Functions
```

### Production

```
Browser → team.dialogika.co (Firebase Hosting)
       → Firebase SDK (real dialogika-co project)
           ├── Authentication
           ├── Firestore
           ├── Storage
           └── Functions
```

**Satu project Firebase.** Local dan production pakai layanan yang sama.
Local bisa mempengaruhi data production — hindari destructive writes.

---

## Tech Stack

- **Frontend:** Vanilla JS (ES Modules), Bootstrap 5.3, Google Fonts (Poppins)
- **Auth:** Firebase Authentication v10.7.1 + Custom Claims (7 role)
- **Database:** Cloud Firestore + Security Rules
- **Hosting:** Firebase Hosting + Emulator (port 5000)
- **Editor:** Tiptap rich text editor (modular components)
- **Theme:** Dark/light via `theme.js` + CSS variables
- **Broadcast:** BroadcastChannel API (cross-tab class sync)

---

## Dokumentasi

Dokumentasi lengkap ada di `docs/`:

| Dokumen | Isi |
|---------|-----|
| `ARCHITECTURE-FOUNDATION.md` | Fondasi arsitektur, rules, emulator setup |
| `ARCHITECTURE-REVIEW.md` | Review kematangan Phase 1 |
| `HOME-ARCHITECTURE.md` | Referensi implementasi Home (template untuk fitur baru) |
| `REGISTER-ARCHITECTURE.md` | Registrasi (public page, callable function, approval flow) |
| `LOGIN-ARCHITECTURE.md` | Login (autentikasi, session, presence, error mapping) |
| `INTERNSHIPS-ARCHITECTURE.md` | Internships |
| `QUEST-ARCHITECTURE-ANALYSIS.md` | Analisis fitur Quest untuk migrasi |
| `Modules.md` | Deskripsi modul-modul legacy |
| `UI-Components.md` | Komponen UI reusable |
| `Workflows.md` | Workflow operasional |
