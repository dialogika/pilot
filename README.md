# Dialogika Team Dashboard

> **Internal dashboard** untuk mengelola operasional tim Dialogika — berbasis static HTML + **Firebase** (Auth + Firestore).

## Struktur Proyek

```
pilot/
├── index.html          # Login page (Firebase Auth)
├── home.html           # Dashboard utama (role-aware sidebar + badges)
├── presence.html       # Sistem presensi kehadiran
├── register.html       # Halaman registrasi user
├── template.png        # Background sertifikat (generate-certificate.html)
│
├── backend/            # Asset backend & konfigurasi deploy (tidak dilink HTML)
│   ├── appscript.js    # Google Apps Script (LEGACY) — CRUD via Sheets
│   ├── cors.json       # CORS config untuk appscript
│   └── CNAME           # Custom domain team.dialogika.co
│
├── assets/
│   ├── css/style.css   # CSS global & komponen reusable
│   └── js/
│       ├── firebase-config.js # Konfigurasi Firebase sentral
│       ├── auth-guard.js      # Guard Firebase Auth (custom-claim role)
│       ├── class-sync.js      # Cross-tab class sync via BroadcastChannel
│       └── ...
│
├── element/            # Komponen UI reusable (sidebar, topbar, dll)
├── data/               # Halaman modul data: Leads, Kandidat, Presensi, Inventory
├── setting/            # Halaman administrasi: User, Team, Class, Invoice, dll
├── project/            # Project & Task management + Message & Files
├── personal/           # Profil pribadi, Form izin & reimburse
├── quest/              # People Development & Recruitment Dashboard
├── frame/              # Utility (calculator)
├── docs/               # Dokumentasi teknis
└── migration-script/   # firestore.rules + config deploy Firestore
```

## Setup

1. **Hosting** — Deploy ke static hosting (GitHub Pages, Vercel, Firebase Hosting). Domain `team.dialogika.co` diatur via `backend/CNAME`.
2. **Firebase** — Set Firebase project (`dialogika-co`), aktifkan Authentication (email/password). Konfigurasi di `assets/js/firebase-config.js`.
3. **Firestore Rules** — Deploy `migration-script/firestore.rules` via `firebase deploy --only firestore:rules` (mengatur akses berbasis 7 role).
4. **Role user** — Set via Cloud Function `setUserRole` (menulis custom claim). Role dibaca dari `getIdTokenResult().claims.role`.

## Halaman Utama

| Halaman | File | Fungsi |
|---------|------|--------|
| Login | `index.html` | Autentikasi via Firebase Auth |
| Dashboard | `home.html` | Overview, online users, apps grid, role & position badges |
| Presensi | `presence.html` | Check-in/check-out, riwayat kehadiran |
| Register | `register.html` | Registrasi user |
| Project | `project/project.html` | Project & task management (Kanban-style) |
| Data | `data/*.html` | Leads, kandidat, presensi tim, inventory |
| Setting | `setting/*.html` | Manajemen user, class, invoice, webinar, sertifikat |
| Personal | `personal/*.html` | Profile, izin, reimburse |

## Teknologi

- **Frontend:** Bootstrap 5.3, Bootstrap Icons, Google Fonts (Poppins), SweetAlert2
- **Auth:** Firebase Authentication (v10.7.1) + Custom Claims (7 role)
- **Database:** Cloud Firestore + Firestore Security Rules
- **Sync:** BroadcastChannel API (cross-tab real-time)
- **Legacy:** Google Apps Script (di `backend/appscript.js`) — lihat `docs/Architecture.md`

## Dokumentasi

Detail arsitektur, modul, UI komponen, dan workflow ada di folder `docs/`.
