# AI-PROGRESS-LOG — Dialogika Pilot (team.dialogika.co redesign)

> **BACA DULU SEBELUM NGODING.** Dokumen ini adalah catatan progres single-source-of-truth untuk AI/developer yang melanjutkan project. Kalau kamu adalah AI yang baru masuk sesi ini: baca dokumen ini dari atas ke bawah, lalu baca dokumen referensi di §4 sebelum menyentuh kode.

> **Tanggal update terakhir:** 2026-08-13 (sesi frontend: migrasi config + refactor dashboard + deploy rules)
> **Project:** Sistem Informasi Internal & Website Dialogika
> **Domain target:** `team.dialogika.co` (internal) · `dialogika.co` (publik)
> **Firebase project:** `dialogika-co` (target/aktif) — `pre-dialogika` (lama, READ-ONLY)

---

## 1. Status Singkat (Ringkasan Eksekutif)

| Area | Status |
|---|---|
| Migrasi data `pre-dialogika` → `dialogika-co` | ✅ Selesai (sebelum sesi ini, lihat HANDOFF-MASTER) |
| Firestore Security Rules v3 (7 role) | ✅ **Deployed** 2026-08-11 & 2026-08-13 (ditambah rule `tasks`, `announcements`, `intern_dailyreport`, `position`, `settings`) |
| Cloud Functions (5 fungsi, 7 role) | ✅ Sudah live & match dengan kode lokal (verified "no changes") |
| Firestore indexes (notifications) | ✅ Deployed |
| Rename role `kepala_tim` → `team` | ✅ No-op (0 user punya claim `kepala_tim`) |
| Set owner | ✅ `yuandadhamap@gmail.com` = claim `owner` + users doc dilengkapi profil |
| Repo frontend baru `pilot` | ✅ Git history di-reset, initial commit + migrasi login/dashboard |
| `index.html` (login) → fondasi baru | ✅ Migrasi ke `dialogika-co` (commit `8cedc70`) |
| `home.html` (My Dashboard) → fondasi baru | ✅ Migrasi + **refactor modular** (2026-08-13) |
| **Migrasi config 71 file → `firebase-config.js`** | ✅ **Selesai 2026-08-13** (mekanis via skrip) |
| Rules deploy (rules aktif utk dashboard) | ✅ Deployed 2026-08-13 |
| Quest UI / My Tasks | ⬜ Belum dibangun |
| Seed `tools` + `roles.visible_tools` | ⬜ Belum (Tools Management) |
| Seed `collection_access` | ⬜ Belum (data_member & mentors_screening) |
| Backfill `department_id` | ⬜ Ditunda (prioritas rendah, lihat HANDOFF-MASTER §2) |

---

## 2. Di Mana Repo & File (Lokasi Penting)

```
C:\Users\Yuan\OneDrive\Desktop\Codes\Website Team Internal\
├── pilot\                     ← REPO FRONTEND BARU (git, remote belum diset)
│   ├── index.html             ✅ sudah migrasi ke dialogika-co
│   ├── home.html              ✅ sudah migrasi (My Dashboard)
│   ├── assets/js/firebase-config.js   ← config TUNGGAL (dialogika-co)
│   ├── assets/js/auth-guard.js        ← claim-based, 7 role
│   ├── assets/js/sidebar.js           ← role-aware menu
│   ├── assets/css/theme.css, layout.css
│   ├── assets/js/auth-guard.legacy.js ← backup guard lama
│   ├── element/sidebar.js             ← sidebar lama (523KB, BELUM diganti di halaman legacy)
│   └── docs/AI-PROGRESS-LOG.md        ← file ini
├── migration-script\          ← BACKEND (bukan git repo): rules, functions, skrip migrasi
│   ├── firestore.rules        ✅ v3 (deployed) — ada fix leads
│   ├── firestore.indexes.json ✅ baru dibuat + deployed
│   ├── firebase.json, .firebaserc ✅ baru dibuat
│   ├── functions/index.js     ✅ 5 fungsi, live
│   └── target-service-account.json  ⚠️ KREDENSIAL — JANGAN commit/share
├── Website Goals\             ← spesifikasi fitur (voice notes Ron)
├── Firestore Collection Docs\ ← skema per-koleksi (live, 2026-08-08)
└── *.md                       ← dokumen strategis (lihat §4)
```

---

## 3. Yang SUDAH DILAKUKAN (Detail)

### 3.1 Fondasi frontend (commit `37295be` — initial, `8cedc70` — login+dashboard)

Dibuat di `pilot/` sesuai HANDOFF-MASTER §5:
- **`assets/js/firebase-config.js`** — config Firebase tunggal ke `dialogika-co` (apiKey `AIzaSyDYrzxyQ1oGaVRIdnFfYvjydWZz3xdxpTs`). Semua halaman baru WAJIB import dari sini. Jangan duplikat config di file lain.
- **`assets/js/auth-guard.js`** — API: `requireAuth()` → `{ user, role }`, `getCurrentRole()`, `logout()`. Role dibaca dari **custom claim** (`getIdTokenResult().claims.role`), `VALID_ROLES = [owner, admin, team, staff, intern, mentor, member]`. User tanpa claim → halaman "Akun kamu belum punya role" (fail-safe).
- **`assets/js/sidebar.js`** — API: `renderSidebar({ role, activePage })`, mount di `<div id="dg-sidebar-mount">`. Menu statis per role (owner/admin/team full; staff/intern/mentor/member scoped). CATATAN: ke depan Tools Management mau pakai `roles/{roleId}.visible_tools` — API `renderSidebar` harus tetap kompatibel.
- **`assets/css/theme.css`** (design token `--dg-*` + override `--bs-*` + dark mode) & **`assets/css/layout.css`** (app shell `.dg-*`). ATURAN: jangan inline `<style>` di halaman baru.

`index.html` & `home.html` sudah memakai fondasi ini (tidak ada `pre-dialogika`, tidak ada `<style>` inline). Home query `quests` (array-contains uid di `assignees`) + `user_scores/{uid}`.

### 3.2 Backend deploy (2026-08-11)

Urutan eksekusi & hasil (lengkap di UPDATE-2026-08-11 §7):
1. **Review rules v3 + functions** sebelum deploy. Menemukan & MEMPERBAIKI 1 bug: rule `leads` lama cek field `assigned_to`, padahal data live pakai **`assigned_ids`** (array). Sudah di-deploy dengan fix.
2. `node 3-rename-kepala-tim-to-team.js` → **dry-run: 0 user** (tidak ada claim `kepala_tim`).
3. **Set owner**: `yuandadhamap@gmail.com` (auth uid `yGn42NaPP3bJTw4xOa0gSfCGA3j2`) → custom claim `{ role: 'owner' }`.
4. `firebase deploy --only firestore:rules` → ✅ deployed (v3).
5. `firebase deploy --only functions` → ✅ **semua "No changes detected"** (kode sudah live).
6. `firebase deploy --only firestore:indexes` → ✅ deployed (index `notifications` on `read`+`created_at`).

### 3.3 Fix data penting (agar login E2E jalan)

Auth user `yuandadhamap@gmail.com` (uid `yGn42...`) awalnya punya users doc **kosong** (hanya `access.role_id`) → login pasti gagal (`account_inactive`). Sedangkan profil asli "Yuanda Dhama Prandita" ada di users doc lain (`wVybm8ikBnb7lFVpUn6wP24lPF63`, role internship, status Active).

**Aksi:** disalin profil lengkap (name/email/photo/employment/status Active) dari `wVybm8...` ke `users/yGn42...`, dengan `access.role_id = 'owner'`. Doc `wVybm8...` DIBIARKAN (jangan dihapus sembarangan — berpotensi jadi referensi data lain; bersihkan saat fase data-hygiene).

**Fakta data penting untuk AI:**
- Hanya **1 akun auth** di `dialogika-co` (yuandadhamap@gmail.com). 51 doc di `users`, sisanya **tidak punya akun auth** — user lain belum bisa login sampai akun auth-nya dibuat/claim di-set.
- Nilai `users.employment.department` berupa string nama dept: `branding`, `closing`, `happy`, `rebuy`, `team` (cocok dengan doc di koleksi `departments`). **Vocabulary ini yang dipakai `collection_access`**.
- `users.employment.position` berupa **ID dokumen** `positions` (bukan nama).
- Koleksi `roles` (6 doc): Employee, Internship, Mentor, Sub Team, Super Administrator, Super Team — ini data lama, **belum disinkronkan dengan 7 role baru** (owner/admin/team/staff/intern/mentor/member). Perlu diselaraskan saat User Management dibangun.

---

## 4. Dokumen Referensi (WAJIB dibaca AI sebelum kerja)

Di folder induk `Website Team Internal\`:

| Dokumen | Isi |
|---|---|
| **HANDOFF-MASTER-Migration-Dialogika.md** | Dokumen satu-pintu backend: keputusan arsitektur, runbook, kode lengkap. **BACA PERTAMA.** |
| MASTER-PLAN-Sistem-Informasi-Dialogika-2026-08-04.md | Blueprint: quest system, role/permission, CMS, budget read, roadmap Fase 0–6. |
| BLUEPRINT-Redesign-Team-Internal-Dialogika-2026-08-03.md | Visi redesign (OS internal), role besar, modul, phase 1–3. Rekomendasi: **Opsi C Hybrid**. |
| ANALISA-Website-Team-Internal.md | Scan repo lama (75 halaman, 40+ koleksi, 7 temuan data hygiene). |
| CROSS-CHECK-Website-Goals-vs-Dokumen-Existing-2026-08-11.md | Konflik & keputusan tertunda antara catatan Ron vs dokumen lama. |
| UPDATE-2026-08-11-Role-Tools-Quest-Schema.md | Perubahan 2026-08-11 (7 role, tools management, quest difficulty). |
| DATABASE-SCHEMA-VISUAL-MAP.md | Peta visual semua koleksi `dialogika-co`. |
| DEPARTMENT-MAPPING-Firestore-Collections.md | Pemetaan koleksi → department (`department_id`). |
| MIGRATION-MAPPING-pre-dialogika-to-dialogika-co.md | Spesifikasi transformasi `tasks`→`quests`, merge koleksi kembar. |
| REPORT-Firestore-Schema-Validation-2026-08-08.md | Skema live aktual (36 koleksi, field per koleksi, field sensitif). |
| MOC - Firebase Mapping Dialogika.md | Index cepat per department (count, field, sensitif). |
| COSMOS - System Prompt Backend Specialist.md | Aturan kerja backend AI (D.A.T.A loop, aturan mutlak). |
| EVE - Deskripsi Agent Manager IT.md | Peran agent manager (referensi struktur agent). |
| `Firestore Collection Docs\` | Skema per-koleksi (draft). |

---

## 5. Aturan Mutlak (Jangan Dilanggar)

1. **`pre-dialogika` HANYA DIBACA.** Tidak pernah `.set/.update/.delete` ke sana. (Sumber: HANDOFF-MASTER §4.1, COSMOS aturan #1.)
2. **Cek schema dulu sebelum bikin field/collection baru.** Buka `DATABASE-SCHEMA-VISUAL-MAP.md` + `DEPARTMENT-MAPPING-Firestore-Collections.md`. Jangan buat duplikat `position`/`positions` versi baru. Kalau baru, update peta schema juga.
3. **Deploy production butuh persetujuan eksplisit Ron SETIAP KALI.** Rules/functions sudah live — perubahan berikutnya ikuti alur yang sama.
4. **Zero improvisasi data.** Field/nilai yang nggak ada di dokumen → tanya, jangan mengarang.
5. **CSS terpusat.** Halaman baru: jangan `<style>` inline, pakai `theme.css`/`layout.css`. Komponen sidebar/topbar jangan di-copy-paste.
6. **Jangan commit kredensial.** `target-service-account.json`, `role-mapping.csv`, `*.service-account.json` sudah di-.gitignore pilot.
7. **Jangan rombak `element/sidebar.js` (523KB) dulu** — masih dipakai 73 halaman legacy yang belum dimigrasi. Fondasi baru di `assets/js/sidebar.js`.

---

## 6. Keputusan & Asumsi yang BELUM Dikonfirmasi Ron

Dari UPDATE-2026-08-11 §1 & §8 (asumsi yang diambil karena tidak eksplisit di PDF):
1. **`team` (bekas `kepala_tim`) tetap akses penuh** seperti dulu (owner/admin/team = `isManagement()` setara). Kalau salah → pisah `isManagement()`.
2. **`team` TIDAK bisa ubah role user lain** (setUserRole cuma owner/admin). Kalau salah → tambah `'team'` ke `ROLE_MANAGER_ROLES`.
3. **Gap aturan quest (PERLU DIPUTUSKAN sebelum Quest UI):**
   - `allow create` di rules TIDAK membatasi field → client bisa buat quest dengan `difficulty`/`points` preset, melewati `setQuestDifficulty`. Fix usulan: blokir 2 field itu di create juga.
   - **Poin Daily Task (recurring) di-set manual oleh tim** (catatan Ron) TAPI rules memblokir tulis `points` di semua update → saat ini manual points tidak mungkin. Fix usulan: `setQuestDifficulty` terima override `points` manual khusus `type === 'recurring'`, atau jalur khusus management.
4. **`users` write** — `isManagement()` bisa ubah field apa pun termasuk `access.role_id` langsung (bypass `setUserRole`). Risiko rendah (akses tetap dari claim) tapi bisa desync tampilan. Perlu keputusan: batasi atau biarkan.
5. **4 halaman spek kosong** (CROSS-CHECK §9): `Project Discussion.md`, `Quest Task.md`, `Team Presence.md`, `Inventory Management.md` — belum bisa di-spec.

---

## 7. Gotchas / Hal yang Bikin Bingung (catatan dari sesi ini)

- **Fungsi deploy gagal "Timeout after 10000"** di mesin ini (Windows + OneDrive lambat). Workaround: set env `FUNCTIONS_DISCOVERY_TIMEOUT=60` sebelum `firebase deploy --only functions`. (Firebase-tools baca env itu, dalam detik.)
- **`onQuestUpdate` deployed di region `asia-southeast2`**, sedangkan callable `setUserRole`/`setQuestDifficulty` di `us-central1`. Client `getFunctions(app)` default us-central1 → callable OK. Jangan pindahin region sembarangan.
- **Runtime Node 20 deprecation** (functions): deprecated 2026-04-30, decommission 2026-10-30. Upgrade ke Node 22 (ubah `functions/package.json` `engines.node` → 22) sebelum tenggat. Pakai `firebase-functions@latest` (ada breaking changes).
- **CNAME di repo `pilot` masih `team.dialogika.co`** (sisa repo lama). Untuk site pilot sendiri perlu keputusan domain/CNAME.
- **`localStorage.userData`** dipakai login lama sebagai fast-path — di fondasi baru **tidak** dipakai untuk keputusan auth (claim yang otoritatif), hanya simpan profil untuk tampilan.
- **Duplicate user**: `users/wVybm8...` (Yuanda, internship) vs `users/yGn42...` (auth uid, owner). Jangan bingung; `yGn42` = yang aktif login.

---

## 8. Langkah Berikut yang Disarankan

Prioritas (berdasarkan BLUEPRINT Phase 1 + kondisi saat ini):

1. **Test E2E login** — `cd pilot && npx serve .` → login `yuandadhamap@gmail.com` → dashboard owner. Kalau role claim belum kebaca, logout/login lagi.
2. **Putuskan 2 gap rules quest** (§6 no.3) — kalau oke, patch `firestore.rules` + `functions/index.js` + deploy (butuh approval Ron).
3. **Migrasi halaman legacy berikutnya** — `register.html` (butuh `positions` live), lalu swap config 73 file ke `firebase-config.js`. Melelahkan tapi mekanis; bisa dibuat skrip.
4. **Bangun My Tasks / Quest UI** — koleksi `quests` (3 type), tampilkan di sidebar `my-tasks`.
5. **Seed data Tools Management** (`tools`, `roles.visible_tools`, `collection_access`) — vocab department: `branding/closing/happy/rebuy`.
6. **Sinkronkan koleksi `roles`** dengan 7 role baru.

---

*Dokumen ini diupdate di sesi 2026-08-11. Prinsip: update SETIAP selesai kerja yang berarti, supaya AI berikutnya nggak mulai dari nol. Kalau folder `migration-script` hilang, rekonstruksi dari HANDOFF-MASTER.*
