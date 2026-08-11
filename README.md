# Dialogika Team Dashboard

> **Internal dashboard** untuk mengelola operasional tim Dialogika — berbasis static HTML + Google Apps Script backend.

## Struktur Proyek

```
team/
├── index.html          # Login page (Firebase Auth)
├── home.html           # Dashboard utama
├── presence.html       # Sistem presensi kehadiran
├── register.html       # Halaman registrasi user
├── docs.html           # Dokumentasi kode (PDF-friendly)
├── appscript.js        # Google Apps Script — CRUD Project/List/Task/Comment/Tag
├── login-script.js     # Google Apps Script — Login endpoint (Spreadsheet)
│
├── assets/
│   ├── css/style.css   # CSS global & komponen reusable
│   └── js/
│       ├── auth-guard.js   # Firebase auth guard (redirect ke login)
│       └── class-sync.js   # Cross-tab class sync via BroadcastChannel
│
├── element/            # Komponen UI reusable (sidebar, topbar, dll)
├── data/               # Halaman modul data: Leads, Kandidat, Presensi, Inventory
├── setting/            # Halaman administrasi: User, Team, Class, Invoice, dll
├── project/            # Project & Task management + Message & Files
├── personal/           # Profil pribadi, Form izin & reimburse
├── quest/              # People Development & Recruitment Dashboard
├── export/             # Halaman cetak/export (register, invoice, receipt)
├── example/            # Template contoh (form register, closing, dll)
├── frame/              # Utility (calculator)
└── docs/               # Dokumentasi teknis
```

## Setup

1. **Hosting** — Deploy ke static hosting (GitHub Pages, Vercel, dll). Sesuaikan `CNAME` jika perlu.
2. **Firebase** — Set Firebase project, aktifkan Authentication. Inisialisasi di halaman masing-masing.
3. **Google Apps Script** — Deploy `appscript.js` & `login-script.js` sebagai Web App. Set ID Spreadsheet di konstanta bagian atas file.
4. **CORS** — Konfigurasi `cors.json` jika diperlukan akses dari origin berbeda.

## Halaman Utama

| Halaman | File | Fungsi |
|---------|------|--------|
| Login | `index.html` | Autentikasi via Firebase + Spreadsheet |
| Dashboard | `home.html` | Overview proyek, online users, apps grid |
| Presensi | `presence.html` | Check-in/check-out, riwayat kehadiran |
| Project | `project/project.html` | Project & task management (Kanban-style) |
| Data | `data/*.html` | Leads, kandidat, presensi tim, inventory |
| Setting | `setting/*.html` | Manajemen user, class, invoice, webinar, dll |
| Personal | `personal/*.html` | Profile, izin, reimburse |

## Teknologi

- **Frontend:** Bootstrap 5.3, Bootstrap Icons, Google Fonts (Poppins), SweetAlert2
- **Auth:** Firebase Authentication (v10.7.1)
- **Backend:** Google Apps Script + Google Sheets + Google Drive
- **Sync:** BroadcastChannel API (cross-tab real-time)
