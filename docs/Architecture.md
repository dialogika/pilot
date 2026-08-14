# Architecture — Firebase + Firestore + Custom Claims

## Overview

Dashboard internal Dialogika (team.dialogika.co) berbasis **static HTML + Firebase**. Autentikasi via **Firebase Authentication**, data bisnis disimpan di **Cloud Firestore**, dan akses dikontrol oleh **role via Custom Claims** yang ditegakkan oleh **Firestore Security Rules**.

## Diagram Alur

```
Browser (HTML/JS)
    │
    ├─ Firebase Auth (login) ──► Firebase Authentication (email/password)
    │       └─ getIdTokenResult() ──► claims.role (owner/admin/team/...)
    │
    ├─ Firestore SDK ──────────► Cloud Firestore
    │       └─ ditegakkan oleh firestore.rules (7 role)
    │
    └─ Google Apps Script ─────► Google Sheets / Drive   [LEGACY, opsional]
```

## Konfigurasi Firebase

Didefinisikan sentral di `assets/js/firebase-config.js` (dipakai semua halaman):

| Property | Nilai |
|----------|-------|
| `apiKey` | `AIzaSyDYrzxyQ1oGaVRIdnFfYvjydWZz3xdxpTs` |
| `projectId` | `dialogika-co` |
| `authDomain` | `dialogika-co.firebaseapp.com` |
| `storageBucket` | `dialogika-co.firebasestorage.app` |
| `appId` | `1:664395741941:web:f20ff01c166e4423d823bc` |

## Role (Custom Claims)

7 tier role, dibaca dari `getIdTokenResult().claims.role` (`assets/js/auth-guard.js`):

| Role | Fungsi |
|------|--------|
| `owner` | Akses penuh, semua modul termasuk system-settings |
| `admin` | Manajemen sistem, class, invoice, user |
| `team` | Operasional internal |
| `staff` | Tim non-manajemen |
| `intern` | Magang |
| `mentor` | Mentor |
| `member` | Anggota umum |

Rule Firestore (`migration-script/firestore.rules`, Security Rules v3):
- `isManagement()` = owner/admin/team
- `isInternalTeam()` = management + staff/intern/mentor
- `isSelf()` = `request.auth.uid == uid`

Role ditetapkan via Cloud Function `setUserRole` (menulis custom claim), lalu ditegakkan client-side di `auth-guard.js` dan server-side di `firestore.rules`. Jika role belum di-set, `requireAuth()` menampilkan pesan dan TIDAK memberi akses (fail-safe, bukan fail-open).

## Auth Guard

`assets/js/auth-guard.js` — WAJIB dipanggil di setiap halaman internal:
```js
import { requireAuth } from "/assets/js/auth-guard.js";
const { user, role } = await requireAuth();
```
- Belum login → redirect ke `/index.html`
- Role kosong/tidak valid → tampilkan error, halaman berhenti

## Struktur Data Firestore (ringkas)

- `users/` — profil user (`access.role_id`, `employment.position`)
- `positions/` — master posisi
- `settings/referrals` — daftar referral (single doc, array `referrals`)
- `tasks/`, `announcements/`, `intern_dailyreport/`, `position/`, `settings/` — ditambah rule akses saat migrasi

## Deploy

- **Hosting:** static hosting (GitHub Pages / Vercel / Firebase Hosting). Domain `team.dialogika.co` diatur lewat `backend/CNAME`.
- **Firestore Rules:** `firebase deploy --only firestore:rules` dari folder `migration-script/`.

## Backend Google Apps Script (LEGACY)

Sebelum migrasi ke Firestore, data disimpan di Google Sheets dan diakses lewat GAS Web App. File `backend/appscript.js` masih dipertahankan sebagai referensi/lapis fallback opsional:

- `doGet` — ambil data proyek
- `doPost` — CRUD project/list/task/comment/tag/status + `uploadFile` ke Drive
- Spreadsheet IDs didefinisikan di konstanta atas `appscript.js`
- `login-script.js` (login endpoint berbasis spreadsheet) **sudah dihapus** — digantikan Firebase Auth

> **Catatan migrasi:** Dashboard kini berjalan penuh di atas Firebase + Firestore. Bagian ini hanya arsip historis, bukan jalur utama.
