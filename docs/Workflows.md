# Workflows — Alur Kerja & Arsitektur Sistem

> **Source of Truth:** `docs/team-internal-map.html`  
> **Firebase Project:** `pre-dialogika`  
> **Stack:** Firebase Web SDK 10.7.1 (ESM CDN) · Google Apps Script · Google Sheets · Google Drive  
> **Hosting:** GitHub Pages (CNAME: team.dialogika.co)

---

## 1. System Overview

### Arsitektur Bertumpuk

Aplikasi berjalan sepenuhnya di sisi klien — static HTML + Firebase Web SDK via ESM CDN. Tidak ada server sendiri; ada satu lapis backend tambahan lewat Google Apps Script sebagai mirror ke Google Sheets/Drive untuk modul Project.

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│              75 halaman HTML statis                         │
│  (index.html · home.html · data/*.html · setting/*.html …) │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                 Firebase Web SDK v10.7.1                     │
│              (ESM CDN — import dari firebase-app.js …)       │
└──────┬──────────────────────┬────────────────────┬──────────┘
       │                      │                    │
       ▼                      ▼                    ▼
┌──────────────┐   ┌──────────────────┐   ┌──────────────┐
│ Firebase Auth │   │    Firestore     │   │    Storage   │
│ (Email/Pwd)   │   │  (40+ koleksi)  │   │ (Foto/File)  │
└──────────────┘   └────────┬─────────┘   └──────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │ Google Apps Script      │
              │ appscript.js            │
              │ ↓                       │
              │ Google Sheets (mirror)  │
              │ Google Drive (upload)   │
              └─────────────────────────┘
```

### Source of Truth

| Lapisan | Status |
|---------|--------|
| **Firestore** | **Source of Truth utama** — semua data operasional |
| Google Sheets | Mirror untuk modul Project (via Apps Script). **Rawan tidak sinkron.** Disarankan hanya untuk ekspor/laporan |
| Google Drive | File upload dari modul Project |

### Firebase Project Config

```
API Key:       AIzaSyDyzzEYbJkkl-N8snrQf14qvj8De4YliV0
Auth Domain:   pre-dialogika.firebaseapp.com
Project ID:    pre-dialogika
```

### Statistik Sistem

| Metrik | Jumlah |
|--------|--------|
| Halaman HTML | 75 |
| Modul Fungsional | 8 |
| Koleksi Firestore | 40+ (termasuk subkoleksi bertingkat) |
| Lapis Backend | 2 (Firestore + Apps Script) |
| Titik Redundansi | 7 (perlu dibereskan) |
| Komponen JS Reusable | 10 (di `element/`) |

---

## 2. Authentication Flow

```
┌──────────┐
│ index.html│
└─────┬─────┘
      │ Input email + password
      ▼
┌──────────────────────────────────────────────────────────────┐
│                    Firebase Auth                              │
│  signInWithEmailAndPassword(email, password)                  │
│  → Firebase Auth mengembalikan UserCredential                │
│  → Token JWT disimpan di localStorage                        │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                    localStorage.userData                      │
│  {                                                           │
│    uid, email, displayName, photoURL, role,                  │
│    employment: { position, department },                     │
│    is_approved: true/false                                   │
│  }                                                           │
│  → Fast-path: halaman lain cek localStorage dulu             │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                    auth-guard.js                              │
│  Setiap halaman (via <script type="module">)                  │
│  1. Cek localStorage['userData']                              │
│     → Jika tidak ada: redirect ke index.html                 │
│  2. Cek Firebase onAuthStateChanged                           │
│     → Jika user null: hapus localStorage, redirect ke index   │
│  3. Polling: coba 50× (100ms) sampai Firebase apps ready      │
└─────────────────────────┬────────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
          ▼                               ▼
┌──────────────────┐           ┌──────────────────┐
│    home.html     │           │ Halaman Lain      │
│  (Dashboard)     │           │ (data/*, setting/*│
│                  │           │  project/*, dll)  │
└──────────────────┘           └──────────────────┘
```

### Session Validation

- **Fast path:** `localStorage.userData` — dicek sinkron sebelum halaman dirender
- **Async path:** `onAuthStateChanged` — Firebase memvalidasi token JWT secara asinkron
- **Polling fallback:** auth-guard.js menunggu Firebase apps ready hingga 5 detik (50 × 100ms)

### user_presence

- Saat login, Firestore `user_presence/{uid}` diupdate: `{ status: "online", last_seen: Timestamp }`
- Saat logout / tab closed: `{ status: "offline", last_seen: Timestamp }`
- Ditampilkan di `home.html` (Who's Online widget)

### pending_users Approval

- User baru mendaftar → masuk ke `pending_users`
- Admin melihat daftar di `home.html`
- Admin klik "Approve" → data dipindahkan ke `users` + `pending_users/{id}` dihapus
- Hanya user dengan `is_approved: true` yang bisa login

---

## 3. User Registration Flow

```
┌──────────────┐
│ register.html│
└───────┬──────┘
        │ Isi form: nama, email, password, phone, dll
        ▼
┌──────────────────────────────────────────────────────────────┐
│                 Firebase Auth — createUser                    │
│  createUserWithEmailAndPassword(email, password)              │
│  → User terdaftar di Firebase Authentication                 │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                 Firestore: pending_users/{uid}                │
│  {                                                           │
│    uid, name, email, phone, photo,                           │
│    employment: { position, department, joined_at },          │
│    socials: { instagram, linkedin },                         │
│    is_approved: false,                                       │
│    registered_at: Timestamp,                                 │
│    access: { role_id, level_order }                          │
│  }                                                           │
└─────────────────────────┬────────────────────────────────────┘
                          │ User menunggu approval
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                 Admin Approval (home.html)                    │
│  Admin membuka daftar pending_users                          │
│  → Lihat detail calon user                                   │
│  → Klik "Approve" atau "Reject"                              │
│                                                              │
│  Approve:                                                    │
│  1. Buat dokumen di users/{uid} (is_approved: true)          │
│  2. Hapus pending_users/{uid}                                │
│                                                              │
│  Reject:                                                     │
│  1. Hapus pending_users/{uid}                                │
│  2. (Opsional) Hapus user dari Firebase Auth                 │
└──────────────────────────────────────────────────────────────┘
```

### Struktur Dokumen

**`pending_users/{uid}`** (sama dengan `users/{uid}`):
```
{
  name: string,
  email: string,
  phone: string,
  birth: string,
  photo: string,
  employment: {
    position: string,
    department: string,
    joined_at: string
  },
  socials: {
    instagram: string,
    linkedin: string
  },
  access: {
    role_id: string,
    level_order: number
  },
  is_approved: false,
  status: "pending",
  approved_by: null,
  registered_at: Timestamp
}
```

---

## 4. Project & Task Workflow

### Struktur Data Bertingkat

```
projects/{projectId}
├── name, description, owner_id, status, department,
│   department_color, members[], is_pinned, pinned, created_at
│
├── lists/{listId}
│   ├── name, description, position, is_tracked, color_theme
│   │
│   ├── comments/{commentId}
│   │   └── user_id, text, created_at, attachment
│   │
│   └── subscribers/{subscriberId}
│       └── user_id, created_at
│
├── files/{fileId}
│   ├── name, url, mime_type, uploaded_by, created_at
│   │
│   ├── comments/{commentId}
│   ├── subscribers/{subscriberId}
│   └── boosts/{boostId}
│
├── messages/{messageId}
│   ├── title, body, sender, created_at
│   │
│   └── comments/{commentId}
│
├── message_drafts/{draftId}
│   └── title, body, sender, created_at
│
└── message_subscribers/{subId}
    └── user_id, created_at

tasks/{taskId}
├── project_id, list_id, title, description, status,
│   priority, start_date, due_date, points, assign_to,
│   notify_to, tags[], position, created_by
│
└── logs/{logId}
    └── action, user_id, old_value, new_value, timestamp
```

### Read Flow

```
Halaman (project/project.html, list.html, dll)
    │
    ▼
Firestore — query ke koleksi:
  ├─ projects/{id}  → detail proyek
  ├─ projects/{id}/lists → daftar list + comments + subscribers
  ├─ tasks (WHERE project_id == id) → daftar task
  └─ tasks/{id}/logs → audit trail
    │
    ▼
Render UI di browser
```

### Write Flow

```
Form / Tombol Aksi
    │
    ▼
Validasi (client-side)
    │
    ▼
Firestore — write ke koleksi:
  ├─ projects → create/update project
  ├─ projects/{id}/lists → create/update/delete list
  ├─ projects/{id}/lists/{id}/comments → create/update/delete
  ├─ projects/{id}/lists/{id}/subscribers → toggle
  ├─ tasks → create/update/delete task
  ├─ tasks/{id}/logs → append log
  └─ trash → soft-delete record
    │
    ▼
Google Apps Script (mirror opsional):
  ├─ appscript.js doPost → Sheets mirror
  └─ uploadFileToDrive → Google Drive
    │
    ▼
UI Refresh (realtime via onSnapshot / manual reload)
```

### Task Lifecycle

```
OPEN
  │
  ├─→ IN_PROGRESS
  │       │
  │       ├─→ REVIEW
  │       │       │
  │       │       ├─→ COMPLETE
  │       │       └─→ REOPEN ──→ IN_PROGRESS
  │       │
  │       └─→ BLOCKED ──→ IN_PROGRESS
  │
  └─→ CANCELLED
```

- Setiap perubahan status → `logs/{logId}`: `{ action: "status_change", user_id, old_value, new_value, timestamp }`
- Task bisa memiliki `tags[]` (array string ID tag)
- Assignee via `assign_to` (string user ID)
- Urutan task diatur via field `position` (number)

### Logging

```
tasks/{taskId}/logs/{logId}
{
  action: "created" | "status_change" | "updated" | "deleted",
  user_id: string,
  old_value: string,
  new_value: string,
  timestamp: Timestamp
}
```

### Google Apps Script Sync

Project, List, Task, Tag, Comment, Subscriber juga di-mirror ke Google Sheets:

| Sheet | ID |
|-------|-----|
| Projects | `PROJECT_SHEET_ID` |
| Lists | `LIST_SHEET_ID` |
| Tasks | `TASK_SHEET_ID` |
| Comments | `COMMENT_SHEET_ID` |
| Tags | `TAG_SHEET_ID` |
| Statuses | `STATUS_SHEET_ID` |
| Subscribers | `SUBS_SHEET_ID` |
| Users | `USER_SHEET_ID` |
| Log | `LOG_SHEET_ID` |
| Trash | `TRASH_SHEET_ID` |

> **Catatan:** Firestore adalah source of truth. Sheets adalah mirror yang **rawan tidak sinkron**. Disarankan Sheets hanya untuk ekspor/laporan, bukan operasional.

### Files

- Upload file → Google Drive (`DRIVE_FOLDER_ID`)
- Metadata file disimpan di `projects/{id}/files/{fileId}`
- Subkoleksi: `comments`, `subscribers`, `boosts`

### Messages

- Pesan antar anggota proyek
- Draft disimpan di `message_drafts`
- Subscriber notifikasi di `message_subscribers`
- Subkoleksi: `comments`

---

## 5. Recruitment Workflow

```
┌────────────┐
│  Scouting  │
│  scouting- │
│ candidate  │
│ .html      │
└─────┬──────┘
      │ Cari & tambah talent baru
      ▼
┌──────────────────────────────────────────────────────────────┐
│                 Firestore: talents/{talentId}                 │
│  Pool kandidat hasil scouting                                │
│  { name, contact, source, position, status, notes }          │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│              Candidate Management                            │
│  candidate-management.html (via candidate-management.js)     │
│  → Baca: users, mentors_screening, mentor,                   │
│           recruitment_positions                              │
│  → Tulis: team_management, mentor,                           │
│           recruitment_positions                              │
└─────────────────────────┬────────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              │                       │
              ▼                       ▼
┌──────────────────┐   ┌──────────────────────────────────────┐
│   Interview       │   │        Screening                    │
│  recruitment-     │   │  interns_screening/{id}             │
│  interview-utils  │   │  mentors_screening/{id}             │
│  .js              │   │  → Nilai, keputusan, catatan        │
└──────────────────┘   └────────────────┬─────────────────────┘
                                        │
                                        ▼
┌──────────────────────────────────────────────────────────────┐
│                      Accepted?                               │
│  ┌─── Ya ──────────────────────────────── Tidak ───┐        │
│  ▼                                                  ▼        │
│  Masuk ke:                                    Kembali ke     │
│  ┌──────────┬──────────┬──────────┐         talent pool     │
│  │ Intern   │  Mentor  │   Team   │         atau arsip       │
│  │          │          │          │                           │
│  │ interns  │ mentor   │ team_    │  kandidat-nonaktif.html  │
│  │ _screening│ (koleksi│ manage-  │                           │
│  │          │  mentor) │  ment    │                           │
│  ├──────────┼──────────┼──────────┤                           │
│  │ interns_ │          │          │                           │
│  │ resume   │          │          │                           │
│  │ intern_  │          │          │                           │
│  │ daily    │          │          │                           │
│  │ _report  │          │          │                           │
│  └──────────┴──────────┴──────────┘                           │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                 People Development                           │
│  dashboard-people-dev.html                                   │
│  → Baca: user_attendance, users                              │
│  → Metrik perkembangan SDM                                   │
└──────────────────────────────────────────────────────────────┘
```

### Detail Kandidat

| Halaman | Koleksi yang Dibaca | Untuk |
|---------|--------------------|-------|
| `team-candidate-detail.html` | departments, positions, users | Detail kandidat tim |
| `mentor-candidate-detail.html` | departments, positions, users | Detail kandidat mentor |
| `internship-candidate-detail.html` | departments, positions, users | Detail kandidat magang |

### Recruitment-specific Collections

| Collection | Fungsi |
|------------|--------|
| `talents` | Pool talent/kandidat dari scouting |
| `recruitment_positions` | Lowongan/posisi yang dibuka |
| `interns_screening` | Proses screening intern |
| `mentors_screening` | Proses screening mentor |
| `interns_resume` | Resume/CV intern + data penilaian |
| `intern_dailyreport` | Laporan harian intern |
| `recruitment_dashboard_notes` | Catatan di dashboard rekrutmen |

### Komponen Pendukung

- `element/candidate-management.js` — Logika CRUD kandidat
- `element/recruitment-interview-utils.js` — Utility wawancara (jadwal, form penilaian)
- `element/register-candidate-lookup.js` — Pencarian data kandidat dari berbagai sumber
- `element/rightbar-recruit.js` — Panel info rekrutmen di sidebar kanan

---

## 6. Attendance Workflow

```
┌────────────┐
│  presence  │
│  .html     │
└─────┬──────┘
      │ Pilih status kehadiran
      ▼
┌──────────────────────────────────────────────────────────────┐
│                    Check In / Check Out                       │
│                                                              │
│  Slider Login  →  user_attendance/{id}                       │
│  { user_id, date, check_in: Timestamp,                       │
│    status: "hadir", location_code }                          │
│                                                              │
│  Slider Logout →  user_attendance/{id}                       │
│  { check_out: Timestamp,                                     │
│    duration: number (menit) }                                │
└─────────────────────────┬────────────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            │                           │
            ▼                           ▼
┌──────────────────┐         ┌────────────────────────────────┐
│  user_attendance  │         │  Permits & Reimburse          │
│  Rekap harian     │         │                               │
│                   │         │  permit-reimburse-            │
│  presence-team    │         │  management.html              │
│  .html            │         │  → Baca: users, reimburse     │
│  → Baca:          │         │  → Tulis: permits,            │
│  user_attendance  │         │    reimburse, user_attendance │
│                   │         │                               │
│  intern-presence  │         │  personal/form-permit.html    │
│  .html            │         │  → Tulis: permits             │
│  → Presensi intern│         │    (+ lampiran ke Storage)    │
└──────────────────┘         │                               │
                              │  personal/form-reimburse.html │
                              │  → Tulis: operational_expenses│
                              └───────────────┬───────────────┘
                                              │
                                              ▼
                              ┌────────────────────────────────┐
                              │         Approval               │
                              │  Admin approve/reject          │
                              │  permits.is_approved           │
                              │  reimburse.is_approved         │
                              │                               │
                              │  Jika izin disetujui →         │
                              │  update user_attendance status │
                              │  ke "izin"                    │
                              └────────────────────────────────┘
```

### Hubungan Permit, Reimburse, dan Attendance

```
form-permit.html
    │
    ▼
permits/{permitId}
{
  requester_id,
  type: "sakit" | "dinas_luar" | "cuti" | "lainnya",
  start_date, end_date,
  reason,
  attachment_url (ke Storage),
  is_approved: false | true | null,
  approved_by,
  created_at
}
    │
    ├── Jika approved → user_attendance diupdate (status = type)
    │
    ▼
permit-reimburse-management.html
    │
    ▼
reimburse/{reimburseId}
{
  reimburse_id,
  kategori_kode,
  amount,
  description,
  receipt_url,
  is_approved,
  created_at
}

form-reimburse.html
    │
    ▼
operational_expenses/{expenseId}
{
  // Reimburse dicatat sebagai operational expense
  user_id,
  amount,
  category,
  description,
  date,
  receipt_url
}
```

---

## 7. CRM Workflow

```
┌──────────────────────────────────────────────────────────────┐
│                    Leads Inbox                               │
│  data/leads-inbox.html                                       │
│  → Baca: leads_settings_ads_channels,                        │
│           leads_settings_interests, users, leads              │
│  → Tulis: leads                                              │
│  Menampilkan leads masuk, tandai status, update data         │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                  Assignment ke Agent                          │
│  data/leads-agent.html (via komponen bersama)                 │
│  → Assign leads ke sales agent                               │
│  → Tracking follow-up status                                 │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                     Invoice                                  │
│  setting/invoice-management.html                             │
│  → Baca/Tulis: invoices                                     │
│  → Terkait leads & produk                                    │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                  Products & Enrollment                        │
│                                                              │
│  setting/product-management.html                             │
│  → Baca/Tulis: products                                     │
│                                                              │
│  export/enrollment.html                                      │
│  → Baca: enrollments                                        │
│                                                              │
│  setting/referral-dashboard.html                             │
│  → Baca: products (data referral)                            │
└──────────────────────────────────────────────────────────────┘
```

### Sales Collections

| Collection | Fungsi |
|------------|--------|
| `leads` | Data prospek: nama, kontak, interest, channel iklan, status, assigned_agent |
| `leads_settings_interests` | Master minat/interest (dropdown options) |
| `leads_settings_ads_channels` | Master channel iklan (dropdown options) |
| `invoices` | Tagihan terkait leads/produk |
| `products` | Katalog produk/kelas untuk penjualan |
| `enrollments` | Pendaftaran peserta ke kelas/produk |

---

## 8. Class Management Workflow

```
┌──────────────────────────────────────────────────────────────┐
│                   Class Planning                              │
│  setting/class-management.html (daftar kelas)                │
│  setting/class-planning.html (rencana & jadwal)              │
│  → Baca/Tulis: class_planning, mentor                        │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                    Class Detail                               │
│  setting/class-detail.html                                   │
│  → Baca: mentor, users                                      │
│  → Detail satu kelas: peserta, mentor, jadwal               │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                       Mentor                                  │
│  setting/mentor-management.html                              │
│  → Baca/Tulis: mentor (koleksi mentor)                      │
│                                                              │
│  Mentor mengajar kelas, dijadwalkan via class_planning       │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                    Schedule Logs                              │
│  setting/class-checkup.html                                  │
│  → Baca: mentor, schedule_logs, users                       │
│  → Log perubahan jadwal: schedule_logs/{id}                  │
└──────────┬────────────────────────────────────┬──────────────┘
           │                                    │
           ▼                                    ▼
┌──────────────────────┐   ┌──────────────────────────────────┐
│   Promo Classes       │   │        Certificate               │
│  setting/promo-       │   │  setting/generate-certificate    │
│  classes.html         │   │  .html (client-side)             │
│  → Baca/Tulis:        │   │  Generate PDF sertifikat         │
│    promo_classes,     │   │                                  │
│    promo_batches      │   └──────────────────────────────────┘
└──────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│                   Member Data                                │
│  data/member-data.html                                       │
│  → Baca/Tulis: data_member                                   │
│  → Data alumni/peserta kelas                                 │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                   Mailing List                               │
│  data/mailing-list.html                                      │
│  → Baca: subscription_email                                 │
│  → Daftar email untuk newsletter/promo                      │
└──────────────────────────────────────────────────────────────┘
```

### class_availability

- `class_availability` menyimpan slot kelas yang tersedia
- Dibaca oleh: `data/class-available.html`, `setting/operational-expenses.html`
- Digunakan untuk mengecek ketersediaan sebelum enroll

### Collections Kelas

| Collection | Fungsi |
|------------|--------|
| `class_planning` | Rencana kelas & jadwal |
| `class_availability` | Ketersediaan slot kelas |
| `mentor` | Data mentor/pengajar |
| `promo_classes` | Kelas yang dipromosikan |
| `promo_batches` | Batch promo per angkatan |
| `schedule_logs` | Log perubahan jadwal |
| `webinars` | Data & pendaftaran webinar |
| `data_member` | Data member/alumni |
| `subscription_email` | Daftar email mailing list |

---

## 9. Branding Workflow

```
┌──────────────────────────────────────────────────────────────┐
│                  Branding Schedule                            │
│  data/branding-schedule.html                                 │
│  → Baca/Tulis: branding_content                             │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│               branding_content/{contentId}                    │
│  {                                                           │
│    platform: "instagram" | "tiktok" | "linkedin" | ...      │
│    content_type: "post" | "story" | "reel" | "carousel",    │
│    caption,                                                   │
│    media_url,                                                 │
│    scheduled_date,                                            │
│    status: "draft" | "scheduled" | "published",              │
│    created_by,                                                │
│    created_at                                                 │
│  }                                                           │
└──────────────────────────────────────────────────────────────┘
```

### Output Branding

Jadwal & konten branding sosial media untuk:
- Instagram (post, story, reel)
- TikTok
- LinkedIn
- Platform lain

---

## 10. Office & Operational Workflow

```
┌──────────────────────────────────────────────────────────────┐
│                    Inventory                                  │
│  data/office-inventory.html                                  │
│  → Baca/Tulis: inventory                                    │
│                                                              │
│  inventory/{itemId}                                          │
│  { name, category, quantity, condition,                      │
│    location, last_updated, updated_by }                      │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                Operational Expenses                           │
│  setting/operational-expenses.html                           │
│  → Baca: operational_expenses, class_availability,           │
│           mentor, users                                      │
│  → Tulis: operational_expenses                              │
│                                                              │
│  operational_expenses/{expenseId}                            │
│  { amount, category, description, date,                      │
│    related_class_id, approved_by, status }                   │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                      Approval                                 │
│  - Pengeluaran operasional perlu approval                    │
│  - Reimburse personal juga lewat flow approval               │
│    (lihat section 6 — permit-reimburse-management.html)      │
└──────────────────────────────────────────────────────────────┘
```

---

## 11. Firestore Read / Write Pattern

### READ Pattern

```
┌──────────┐
│ Halaman   │
│ (HTML/JS) │
└─────┬─────┘
      │ 1. Inisialisasi Firebase
      │    import { getFirestore, collection, query, where,
      │            onSnapshot, getDocs, doc, getDoc } from CDN
      │
      ▼
┌────────────────┐
│  Firestore      │
│  onSnapshot()   │ ← Realtime listener (live update)
│  atau getDocs() │ ← One-time fetch
│  atau getDoc()  │ ← Single document
└────────┬───────┘
         │ 3. Data stream / promise resolved
         ▼
┌────────────────┐
│  Render UI      │
│  DOM innerHTML  │
│  atau append()  │
│  + SweetAlert2  │
│    untuk umpan  │
│    balik user   │
└─────────────────┘
```

### WRITE Pattern

```
┌──────────┐
│  Form /   │
│  Tombol   │
└─────┬─────┘
      │ 1. Tangkap event (submit / click)
      │ 2. Validasi client-side
      │    - Cek required fields
      │    - Cek format (email, phone, dll)
      │    - Tampilkan error via SweetAlert2 jika perlu
      │
      ▼
┌────────────────┐
│  Firestore      │
│  addDoc()       │ ← Dokumen baru
│  setDoc()       │ ← Tulis/set dokumen
│  updateDoc()    │ ← Update field tertentu
│  deleteDoc()    │ ← Hapus dokumen
│  dengan atau    │
│  tanpa merge    │
└────────┬───────┘
         │ 3. Promise resolved
         ▼
┌────────────────┐
│  Realtime       │
│  Update         │
│  (via           │
│  onSnapshot     │
│  listener)      │
└────────┬───────┘
         │ 4. Listener fires
         ▼
┌────────────────┐
│  UI Refresh     │
│  Otomatis       │
│  atau manual    │
│  reload         │
└─────────────────┘
```

---

## 12. Project Data Model

### Struktur Lengkap

```ascii
projects/                          ← Koleksi root
│
├── {projectId}                    ← Dokumen proyek
│   ├── name: string
│   ├── description: string
│   ├── owner_id: string
│   ├── status: string
│   ├── department: string
│   ├── department_color: string
│   ├── members: array<string>
│   ├── is_pinned: boolean          ← ⚠ Redundan dengan pinned
│   ├── pinned: boolean             ← ⚠ Redundan dengan is_pinned
│   └── created_at: Timestamp
│
│   ├── lists/                      ← Subkoleksi List
│   │   ├── {listId}
│   │   │   ├── name: string
│   │   │   ├── description: string
│   │   │   ├── position: number
│   │   │   ├── is_tracked: boolean
│   │   │   └── color_theme: string
│   │   │   │
│   │   │   ├── comments/           ← Sub-subkoleksi
│   │   │   │   └── {commentId}
│   │   │   │       ├── user_id: string
│   │   │   │       ├── text: string
│   │   │   │       ├── created_at: Timestamp
│   │   │   │       └── attachment: string
│   │   │   │
│   │   │   └── subscribers/        ← Sub-subkoleksi
│   │   │       └── {subscriberId}
│   │   │           ├── user_id: string
│   │   │           └── created_at: Timestamp
│   │   │
│   │   └── ...
│   │
│   ├── files/                      ← Subkoleksi Files
│   │   ├── {fileId}
│   │   │   ├── name: string
│   │   │   ├── url: string
│   │   │   ├── mime_type: string
│   │   │   ├── uploaded_by: string
│   │   │   └── created_at: Timestamp
│   │   │   │
│   │   │   ├── comments/           ← Sub-subkoleksi
│   │   │   ├── subscribers/        ← Sub-subkoleksi
│   │   │   └── boosts/             ← Sub-subkoleksi
│   │   │
│   │   └── ...
│   │
│   ├── messages/                   ← Subkoleksi Messages
│   │   ├── {messageId}
│   │   │   ├── title: string
│   │   │   ├── body: string
│   │   │   ├── sender: string
│   │   │   ├── created_at: Timestamp
│   │   │   │
│   │   │   └── comments/           ← Sub-subkoleksi
│   │   │
│   │   └── ...
│   │
│   ├── message_drafts/            ← Subkoleksi Draft
│   │   └── {draftId}
│   │       ├── title: string
│   │       ├── body: string
│   │       ├── sender: string
│   │       └── created_at: Timestamp
│   │
│   └── message_subscribers/       ← Subkoleksi Subscriber Pesan
│       └── {subId}
│           ├── user_id: string
│           └── created_at: Timestamp

tasks/                              ← Koleksi root (terpisah dari projects)
│
├── {taskId}                        ← Dokumen task
│   ├── project_id: string
│   ├── list_id: string
│   ├── title: string
│   ├── description: string
│   ├── status: string
│   ├── priority: string
│   ├── start_date: string          ← ⚠ Pakai string, sarankan null
│   ├── due_date: string            ← ⚠ Pakai string, sarankan null
│   ├── points: number
│   ├── assign_to: string           ← ⚠ Pakai string kosong, sarankan null
│   ├── notify_to: string
│   ├── tags: array<string>
│   ├── position: number
│   ├── created_by: string
│   └── created_at: Timestamp
│   │
│   └── logs/                       ← Subkoleksi Audit Trail
│       └── {logId}
│           ├── action: string
│           ├── user_id: string
│           ├── old_value: string
│           ├── new_value: string
│           └── timestamp: Timestamp

trash/                              ← Koleksi root (soft-delete)
│
└── {trashId}
    ├── type: "project" | "list" | "task" | "file"
    ├── original_id: string
    ├── original_data: object
    ├── deleted_by: string
    ├── deleted_at: Timestamp
    └── parent_id: string
```

### Penjelasan Koleksi & Subkoleksi

| Koleksi | Jenis | Fungsi |
|---------|-------|--------|
| `projects` | Root | Proyek utama — induk dari semua subkoleksi |
| `projects/{id}/lists` | Sub | Daftar/list dalam proyek (mirip kolom Kanban) |
| `projects/{id}/lists/{id}/comments` | Sub-sub | Komentar pada sebuah list |
| `projects/{id}/lists/{id}/subscribers` | Sub-sub | User yang subscribe list tertentu |
| `projects/{id}/files` | Sub | File/dokumen proyek |
| `projects/{id}/files/{id}/comments` | Sub-sub | Komentar pada file |
| `projects/{id}/files/{id}/subscribers` | Sub-sub | Subscribe file |
| `projects/{id}/files/{id}/boosts` | Sub-sub | Boost/promote file |
| `projects/{id}/messages` | Sub | Pesan internal proyek |
| `projects/{id}/messages/{id}/comments` | Sub-sub | Komentar pada pesan |
| `projects/{id}/message_drafts` | Sub | Draft pesan |
| `projects/{id}/message_subscribers` | Sub | Subscribe notifikasi pesan |
| `tasks` | Root | Task/item — terpisah dari proyek, reference via `project_id` + `list_id` |
| `tasks/{id}/logs` | Sub | Audit trail perubahan task |
| `trash` | Root | Soft-delete untuk item yang dihapus |

---

## 13. Shared Components

Komponen reusable di `element/*.js` — di-inject ke banyak halaman. Jangan duplikat logika per halaman.

| File | Fungsi | Digunakan Oleh |
|------|--------|----------------|
| `auth-guard.js` | Proteksi halaman: cek localStorage + Firebase onAuthStateChanged, redirect ke login jika tidak valid | Semua halaman (via `<script type="module">`) |
| `candidate-management.js` | Logika CRUD kandidat — baca users, mentors_screening, mentor, recruitment_positions; tulis ke team_management, mentor, recruitment_positions | `data/candidate-management.html` |
| `recruitment-interview-utils.js` | Utility untuk proses wawancara: jadwal, form penilaian, scoring | Halaman rekrutmen |
| `whatsapp-message-builder.js` | Builder pesan WhatsApp — template untuk komunikasi ke kandidat | Halaman kandidat & rekrutmen |
| `whatsapp-encoding.js` | Encoding text untuk format WhatsApp (handle special chars, formatting) | Halaman yang mengirim pesan WA |
| `register-candidate-lookup.js` | Pencarian data kandidat dari berbagai koleksi (talents, users, interns_screening, dll) | Halaman rekrutmen |
| `team-management-sync.js` | Sinkronisasi data tim/anggota — baca/tulis team_management | `setting/internship-management.html` |
| `sidebar.js` | Render sidebar navigasi | Dashboard & halaman utama |
| `topbar.js` | Render top bar + profile dropdown | Dashboard & halaman utama |
| `rightbar-recruit.js` | Panel info rekrutmen di sidebar kanan | Halaman rekrutmen |
| `template-manager.js` | Manajemen template konten | Halaman terkait |

---

## 14. Data Synchronization

### Arsitektur Sinkronisasi

```
┌────────────────────────────────────────────────────────────┐
│                     Firestore                               │
│              Source of Truth Utama                          │
│  Halaman menulis/membaca langsung via Firebase Web SDK     │
│  Realtime sync via onSnapshot() listener                    │
└────────────────────────┬───────────────────────────────────┘
                         │
                         │ Mirror (write-only dari Firestore)
                         ▼
┌────────────────────────────────────────────────────────────┐
│               Google Apps Script (appscript.js)             │
│                                                             │
│  doPost handler — dipanggil dari browser:                   │
│  → createProject, createList, createTask, ...               │
│                                                             │
│  Setiap action:                                             │
│  1. Tulis ke Firestore (via Firebase SDK)                   │
│  2. Panggil Apps Script → tulis ke Google Sheets            │
│     (sebagai backup/mirror)                                 │
│                                                             │
│  Upload file:                                               │
│  1. Base64 decode → Blob                                    │
│  2. DriveApp.getFolderById(DRIVE_FOLDER_ID).createFile()    │
│  3. Set sharing: ANYONE_WITH_LINK                           │
│  4. Return file URL                                         │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│  Google Sheets (10 sheet)    │   Google Drive               │
│  ┌─────────────────────┐     │   ┌──────────────────────┐  │
│  │ PROJECT_SHEET_ID    │     │   │ DRIVE_FOLDER_ID      │  │
│  │ LIST_SHEET_ID       │     │   │ (1UBAZEr-...)        │  │
│  │ TASK_SHEET_ID       │     │   │ ↓                    │  │
│  │ COMMENT_SHEET_ID    │     │   │ File upload hasil    │  │
│  │ TAG_SHEET_ID        │     │   │ dari modul Project   │  │
│  │ TASK_TAG_SHEET_ID   │     │   └──────────────────────┘  │
│  │ STATUS_SHEET_ID     │     │                             │
│  │ USER_SHEET_ID       │     └─────────────────────────────┘
│  │ LOG_SHEET_ID        │
│  │ TRASH_SHEET_ID      │
│  └─────────────────────┘
└────────────────────────────────────────────────────────────┘
```

### Alur Sinkronisasi per Action

```
Browser (JS)
    │
    ├── 1. Tulis ke Firestore (real-time)
    │     └── UI langsung terupdate via onSnapshot
    │
    ├── 2. Panggil Apps Script endpoint:
    │     fetch(GAS_URL, {
    │       method: 'POST',
    │       body: JSON.stringify({ action, ...data })
    │     })
    │
    └── 3. Apps Script:
          ├── Buka sheet berdasarkan ID konstanta
          └── appendRow / setValue / deleteRow
```

### ⚠ Catatan Penting

| Masalah | Penjelasan |
|---------|------------|
| **Dua Source of Truth** | Data Project/Task ditulis ke Firestore AND di-mirror ke Sheets. Rawan tidak sinkron. |
| **Rekomendasi** | Firestore sebagai source of truth. Sheets hanya untuk ekspor/laporan. |
| **API Key** | Kode memakai `AIzaSyDyzzEYbJkkl-N8snrQf14qvj8De4YliV0` (project pre-dialogika). Pastikan konsisten. |

---

## 15. Best Practices — Data Hygiene

### Singular vs Plural Collection

⚠ **Jangan buat collection baru dengan nama plural/singular versi lain.**

| Pilih Satu (Kanonik) | ❌ Hindari |
|----------------------|------------|
| `positions` | `position` |
| `departments` | `department` |
| `mentor` | `mentors` |
| `team_management` | `teams` |

> **Aturan:** Pilih satu bentuk kanonik per entitas, migrasikan data lama, lalu hapus yang redundant.

### Duplicated Collections

Koleksi berikut terindikasi duplikat / tumpang tindih:

| Collection | Status | Masalah |
|------------|--------|---------|
| `position` | `legacy` | Duplikat singular dari `positions` |
| `department` | `legacy` | Duplikat singular dari `departments` |
| `mentors` | `legacy` | Duplikat plural dari `mentor` |
| `teams` | `legacy` | Tumpang tindih dengan `team_management` |

### Duplicated Fields

| Dokumen | Field Duplikat | Tindakan |
|---------|---------------|----------|
| `projects/{id}` | `is_pinned` **dan** `pinned` | Hanya perlu satu. Keduanya ditulis bersamaan dengan nilai sama. |

### Firestore sebagai Source of Truth

- **Firestore** adalah sumber kebenaran utama untuk semua data operasional
- **Google Sheets** adalah **mirror** untuk modul Project — jangan jadikan sebagai data primer
- Saat menambah fitur baru: **tulis dulu ke Firestore**, mirror ke Sheets jika perlu

### Hindari Collection Baru untuk Data yang Masih Relevan

- Sebelum membuat collection baru, cek apakah data sudah ada di collection/subcollection yang sudah ada
- Contoh: jangan buat `tasks_archive` — gunakan field `status: "archived"` atau subkoleksi `trash`
- Gunakan subcollection project yang sudah ada (`projects/{id}/lists/`, `projects/{id}/files/`, dll)

### Jangan Membuat Field Boolean Ganda

- Satu field boolean cukup. Jangan duplikasi dengan nama berbeda (`is_pinned` + `pinned`)
- Gunakan konvensi prefix `is_` untuk boolean (`is_approved`, `is_pinned`, `is_tracked`)

### Gunakan `null`, Bukan String Kosong

| ❌ Salah | ✅ Benar |
|----------|---------|
| `assign_to: ""` | `assign_to: null` |
| `due_date: ""` | `due_date: null` |
| `start_date: ""` | `start_date: null` |

Query "yang belum di-assign" jadi tidak konsisten dengan string kosong. Standarkan `null` / `undefined` untuk field opsional.

### Reuse Komponen `element/*.js`

- Jangan duplikasi logika per halaman — gunakan komponen yang sudah ada di `element/`
- Komponen yang tersedia: sidebar, topbar, candidate-management, recruitment-interview-utils, whatsapp-message-builder, whatsapp-encoding, register-candidate-lookup, team-management-sync
- Jika perlu modifikasi, edit komponennya sekali, bukan tiap halaman

### Pola yang Sudah Rapi (Pertahankan)

- ✅ Struktur subkoleksi `projects` konsisten dan bersih (lists, files, messages, + sub-subkoleksi)
- ✅ `auth-guard.js` terpusat di satu file, dipakai semua halaman
- ✅ Komponen UI di `element/*.js` sudah reusable
- ✅ Penggunaan SweetAlert2 untuk feedback konsisten
- ✅ Firebase modular imports via ESM CDN versi tetap (10.7.1)

---

> **Referensi:** `docs/team-internal-map.html` — file HTML interaktif dengan detail halaman, koleksi, dan modul.
