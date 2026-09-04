# Ringkasan Workflow Pengembangan Dialogika Pilot Website Internal

**Periode:** 25 Agustus - 4 September 2026
**Tim Pengembang:** Habibi, Fachmi, Rafif
**Standar Arsitektur:** Pure Vanilla JS (ES Modules) + Firestore 4-Layer Architecture

---

## 1. Pengembangan Fitur Daily, Quest, dan Report

### 1.1 Arsitektur Sistem

Sistem dibangun dengan arsitektur 4-layer yang memisahkan tanggung jawab secara terstruktur:

| Layer            | File              | Fungsi Utama                                                                                            |
| :--------------- | :---------------- | :------------------------------------------------------------------------------------------------------ |
| **Repository**   | `*.repository.js` | Query CRUD Firestore, skema database, atomic transaction, upload file ke Firebase Storage               |
| **UI**           | `*.ui.js`         | Dynamic DOM creation, event binding form/tombol, render Markdown preview, render dynamic elements/modal |
| **Orchestrator** | `*.js`            | State manager, validasi input, filter & sorting data, real-time counter sidebar, Auth guard             |
| **Styling**      | `*.css`           | Scoped styling fitur, badge, status colors, action buttons                                              |

### 1.2 Fitur Daily (Tugas Rutin / Recurring)

Fitur Daily membangun sistem tugas harian berulang dengan fitur:
- Inisialisasi skeleton modal dasar
- Pengelompokan tanggal: Overdue, Today, Upcoming
- Parser Markdown untuk deskripsi tugas
- Integrasi counter sidebar secara real-time

### 1.3 Fitur Quest (Tugas Spesifik dengan Due Date & Poin)

Fitur Quest membangun sistem tugas milestone/spesifik satu kali jalan dengan:
- Tenggat waktu (due date) dengan input datetime-local
- Sistem poin rewards (1-100)
- Input multi-assignee PIC
- Upload attachment file ke Firebase Storage
- Modal detail tugas dengan Markdown preview
- Live search dan filter berdasarkan prioritas

### 1.4 Fitur Report (Submit Daily Report)

Fitur Report membangun sistem pelaporan kerja dengan:
- Tombol centang lapor pada list Today
- Modal form input laporan dengan Markdown summary
- Input link bukti kerja (Google Drive, GitHub, Live URL, Figma)
- Mutasi Firestore Atomic Batch Write
- Notifikasi toast berhasil/gagal
- Sinkronisasi counter sidebar

### 1.5 Alur Workflow Terintegrasi

```
1. Penugasan (Daily/Quest)
   Leader/Admin membuat task -> Set Assignee & Tentukan Report To -> Task masuk ke list

2. Pengerjaan & Pelaporan
   Assignee kerjakan task -> Centang & Submit Report -> Status: Reported

3. Routing & Notifikasi
   Status Reported -> Target Report To menerima notifikasi -> Badge Counter bertambah

4. Review & Keputusan
   Atasan buka modal review -> Approve All / Individual Review + Alasan

5. Sinkronisasi & Feedback
   Poin masuk ke user_scores -> Notifikasi ke Assignee -> Selesai
```

### 1.6 Bug Fixing & UAT (28-29 Agustus)

Pada tahap ini diselesaikan beberapa perbaikan:
- Indikator status untuk task yang di-assign (Reported, Approved, Rejected)
- Notifikasi Daily & Report konsisten ke user yang tepat
- Bug gambar pada Report (zoom in/zoom out)
- Proses review Report individual (Approve/Reject per task)
- Tujuan Report To ke user yang tepat
- Tampilan Task disederhanakan konsep ClickUp single-row
- Sistem notifikasi dengan Badge Counter Prioritas (Pending Review)
- Sinkronisasi Poin & Leaderboard (user_scores)
- Firestore Security Rules v3
- Sinkronisasi Status Dua Arah (Data Consistency)
- UAT Lintas 7 Role

---

## 2. Hasil Migrasi Restruktur Fitur HR

### 2.1 Daftar Fitur yang Telah Dimigrasi

| No  | Fitur                 | Legacy Path                             | Target Path                       | Branch                              | Status  |
| :-- | :-------------------- | :-------------------------------------- | :-------------------------------- | :---------------------------------- | :------ |
| 1   | Office Inventory      | `data/office-inventory.html`            | `pages/hr/office-inventory/`      | `refactor/hr/office-inventory`      | Selesai |
| 2   | Company Position      | `data/company-position.html`            | `pages/hr/company-position/`      | `refactor/hr/company-position`      | Selesai |
| 3   | Team Management       | `setting/team-management.html`          | `pages/hr/team-management/`       | `refactor/hr/team-management`       | Selesai |
| 4   | Scouting Candidate    | `data/scouting-candidate.html`          | `pages/hr/scouting-candidate/`    | `refactor/hr/scouting-candidate`    | Selesai |
| 5   | Candidate Management  | `data/candidate-management.html`        | `pages/hr/candidate-management/`  | `refactor/hr/candidate-management`  | Selesai |
| 6   | Recruitment Dashboard | `quest/dashboard-recruitment.html`      | `pages/hr/recruitment-dashboard/` | `refactor/hr/recruitment-dashboard` | Selesai |
| 7   | Permit & Reimburse    | `data/permit-reimburse-management.html` | `pages/hr/permit-reimburse/`      | `refactor/hr/permit-reimburse`      | Selesai |
| 8   | Presence Team         | `data/presence-team.html`               | `pages/hr/presence-team/`         | `refactor/hr/presence-team`         | Selesai |
| 9   | Exit Interview        | `data/exit-interview.html`              | `pages/hr/exit-interview/`        | `refactor/hr/exit-interview`        | Selesai |
| 10  | Internship Management | `setting/internship-management.html`    | `pages/hr/internship-management/` | `refactor/hr/internship-management` | Selesai |

### 2.2 Pola Migrasi Standar 4-Layer

Setiap fitur HR mengikuti pola migrasi yang konsisten:

**Struktur Direktori:**
```
pages/hr/[feature-name]/
  index.html                    # Semantic HTML markup
  [feature].repository.js       # Data Access Layer (Firestore)
  [feature].ui.js               # DOM Presentation Layer
  [feature].js                  # Orchestrator & Controller
  [feature].css                 # Scoped Styling
```

**Konfigurasi Routing Firebase:**
- Rewrite rule bersih: `/[feature-name]` -> `/pages/hr/[feature-name]/index.html`
- Alias route: `/hr/[feature-name]`
- Redirect 301 dari URL legacy

**Standar Kualitas:**
- Zero DOM in Repository
- Zero Firebase in UI
- Breadcrumb konsisten: `🏠 / HR DIVISION / [FEATURE NAME]`
- Feature Parity 100% dari legacy
- Clean URL tanpa trailing slash

### 2.3 Detail Migrasi per Fitur

#### Office Inventory (29 Agustus 2026)
- Real-time synchronisation koleksi Firestore `inventory`
- Auto-generate ID Inventaris: `${kategori}.${lokasi}.${urutan}/DIA/${MM}.${DD}/${tipe}`
- CRUD lengkap dengan live search filter
- Table 10 kolom dengan layout full-width responsif

#### Company Position (29 Agustus 2026)
- Switcher Grid & Table List view
- Live search filter (Nama Posisi & Divisi)
- Filter multi-kategori (Departemen, Status, Tanggal)
- Expand/Collapse deskripsi pekerjaan
- Floating shortcut rekrutmen terintegrasi

#### Team Management (30 Agustus 2026)
- Render seksi divisi (HR, Marketing, Client & Product, Branding, Ghosted, Resigned)
- Manajemen file PKWT dan multi-dokumen tim
- Real-time listener `onSnapshot`
- Badge status pill dan badge tipe kontrak

#### Scouting Candidate (30 Agustus 2026)
- CRUD lengkap dengan upload foto avatar ke Firebase Storage
- Quick status update inline dari kartu
- Export data scouting ke Excel dengan foto kandidat
- Kompressi foto otomatis (max 400px JPEG)

#### Candidate Management (30 Agustus 2026)
- 4-tab pipeline: Team, Mentor, Internship, Positions
- 7 kartu statistik metrik
- Sinkronisasi otomatis kandidat diterima ke team_management
- Modal Jadwal Interview dengan pencarian & paginasi
- Modal Template Chat WhatsApp dengan placeholder dinamis

#### Recruitment Dashboard (1 September 2026)
- Dual collection fallbacks (jamak ↔ tunggal)
- Query error isolation per blok try-catch
- Metric cards: Head Count, Applicants, Kontrak Akan Berakhir, Off Boarding
- Filter Flatpickr rentang tanggal
- Section switcher: Team, Mentor, Internship

#### Permit & Reimburse (3 September 2026)
- Listener realtime `onSnapshot` dengan fallback query
- Mutasi atomik: approve, reject, delete, mark complete
- Paginasi responsif di kedua tab
- Parser tanggal komprehensif (Firestore Timestamp, regex, ISO)
- Generator draft email persetujuan/penolakan via mailto
- Presensi sintetis otomatis

#### Presence Team (3 September 2026)
- Agregasi harian: jam login/logout per user
- Status presensi: Present, Belum Clock Out, Tidak Hadir
- Rekap bulanan: akumulasi jam kerja dan total hari hadir
- Algoritma gamifikasi: streak segments, flame pins, badge
- Ekspor spreadsheet XLSX (SheetJS)
- Conditional pagination (muncul jika > 10 baris)

#### Exit Interview (3 September 2026)
- Submission anonim tanpa merekam user_id
- Akses kontrol berdasarkan posisi pengguna
- SweetAlert2 dialog untuk konfirmasi
- Grid 3 kolom responsif dengan conditional pagination (muncul jika > 6 entri)
- Input sanitization `escapeHtml()`

#### Internship Management (4 September 2026)
- Direktori roster terpusat peserta internship berbasis koleksi Firestore `users` (multi-role detection: `Internship`, `intern`, `employment`, `internshipStatus`)
- Integrasi lookup dinamis koleksi `positions` (*fallback* `position`) dan `departments` (*fallback* `department`)
- 4 Kartu metrik: Total Internships, Active, On Leave, dan Left Early dengan kalkulasi tren kuartal (3 bulan terakhir)
- Auto-status derivation: perhitungan status dinamis berdasarkan perbandingan tanggal selesai magang (`endDate`) terhadap hari ini
- Promosi ke Tim Inti (*Promote to Team*): penambahan dokumen baru di `team_management` (`source: "internship"`) dan pembaruan role user menjadi `staff` (`promotedToTeam: true`)
- CRUD lengkap: Add Intern, Edit data & media sosial (Instagram/LinkedIn), dan Delete dengan konfirmasi SweetAlert2 dialog
- Table responsif dengan sticky columns (*Name* & *Status*), custom pagination, dan live search
- Routing Firebase: rewrite `/internship-management` ➡️ `pages/hr/internship-management/index.html` dan redirect 301 dari `/internships`

---

## 3. Standar Teknis yang Diterapkan

### 3.1 Arsitektur 4-Layer
- Repository: Murni akses data, zero DOM manipulation
- UI: Murni rendering template, zero Firebase SDK langsung
- Orchestrator: Mengelola state dan menghubungkan repository dengan UI
- CSS: Scoped styling per fitur

### 3.2 Keamanan & Autentikasi
- Auth Guard (`requireAuth()`) pada setiap halaman
- Firestore Security Rules v3
- Query error isolation per blok try-catch
- Validasi otorisasi posisi pengguna

### 3.3 Routing & URL
- Clean URL bersih tanpa trailing slash
- Redirect 301 dari URL legacy
- Konfigurasi `cleanUrls: true` dan `trailingSlash: false`
- Breadcrumb navigasi konsisten

### 3.4 Kualitas Kode
- Syntax validation: `node --check` tanpa error
- Feature Parity 100% dari legacy
- Real-time synchronization Firestore
- Responsive layout untuk berbagai resolusi layar

---

## 4. Kesimpulan

Pada periode 25 Agustus - 4 September 2026, tim pengembang telah berhasil:

1. **Membangun sistem Daily, Quest, dan Report** dengan arsitektur 4-layer yang terstruktur, termasuk alur penugasan, pengerjaan, pelaporan, review, dan sinkronisasi poin.

2. **Migrasi 10 fitur HR** dari arsitektur monolitik legacy ke arsitektur modular 4-layer dengan standar kualitas tinggi:
   - Office Inventory
   - Company Position
   - Team Management
   - Scouting Candidate
   - Candidate Management
   - Recruitment Dashboard
   - Permit & Reimburse
   - Presence Team
   - Exit Interview
   - Internship Management

3. **Menerapkan standar teknis** yang konsisten di seluruh fitur:
   - Arsitektur 4-Layer (Repository, UI, Orchestrator, CSS)
   - Clean URL routing dengan redirect 301
   - Breadcrumb navigasi seragam
   - Feature Parity 100% dari implementasi legacy
   - Real-time synchronization dengan Firestore
   - Responsive design untuk berbagai perangkat




