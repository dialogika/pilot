# Workflow & Arsitektur Piket Branding

> **Dokumentasi Komprehensif:** Alur Data, Sumber Koleksi Firestore, Arsitektur 4-Layer, Access Mode (Admin vs Viewer), Seeding & Deduplikasi Idempoten, dan Penyesuaian Tipografi Hero Banner.  
> **Modul:** `pages/branding/piket-branding/`  
> **Route Publik:** `/piket-branding`  
> **Legacy Route:** `/data/piket-branding.html` (Redirect 301)  
> **Branch Terkait:** `refactor/branding/piket-branding`  
> **Target Database:** Cloud Firestore `dialogika-co` — Koleksi `duty_types` & `duty_schedules`  

---

## 1. Ringkasan & Tujuan Refactoring

Modul **Piket Branding** adalah pusat koordinasi jadwal tugas divisi Branding Dialogika untuk mengatur, mendistribusikan, dan memantau penugasan anggota tim pada berbagai jenis aktivitas operasional branding harian maupun mingguan (seperti Webinar, Live Report, dan Boost Community Discord).

### Tujuan Utama Refactoring:
1. **Migrasi ke Arsitektur 4-Layer Dialogika**: Memisahkan kode monolitik lama dari `data/piket-branding.html` ke dalam struktur modular ES Module yang bersih:
   - `index.html` (Struktur semantic & shared shell mounts)
   - `piket-branding.css` (Scoped styles, hero banner, badge, schedule cards)
   - `piket-branding.repository.js` (Firestore access layer & idempotency)
   - `piket-branding.ui.js` (DOM presentation, formatting, deduplikasi opsi, modals)
   - `piket-branding.js` (Orchestrator, auth guard, access mode, concurrency guard)
2. **Penyelarasan Desain Hero Banner**: Menyesuaikan tipografi, ukuran font judul (`1.35rem`), badge, dan teks deskripsi menjadi compact dan rapi sesuai mockup standar visual internal.
3. **Penyelesaian Bug Seeding & Duplikasi**: Menghilangkan race condition pada inisialisasi default types dengan menerapkan ID deterministik berbasis `slug` (`setDoc`) dan perlindungan *concurrency guard* serta auto-cleanup duplikat di Firestore.
4. **100% Feature Parity (Tanpa Mengurangi/Menambah Fitur)**: Mempertahankan seluruh alur kerja yang ada:
   - Realtime schedule list & status badges (`scheduled`, `completed`, `cancelled`)
   - Filter multi-kriteria: Cari Jadwal (keyword), Jenis Piket, Periode (Semua, Hari Ini, Minggu Ini, Bulan Ini), dan Status
   - Counter statistik realtime: Piket Hari Ini, Jadwal Aktif, Anggota Bertugas, Jenis Piket
   - Modal Tambah & Edit Jadwal (multi-assignment anggota & sub-tugas dinamis)
   - Modal Manajemen Jenis Piket (tambah jenis baru dengan custom color & icon, toggle status aktif/nonaktif)
   - Pembagian hak akses terintegrasi (Admin Mode vs Viewer/Intern Mode)

---

## 2. Arsitektur Sistem 4-Layer

Sistem diorganisir secara terisolasi dan modular di bawah direktori `pages/branding/piket-branding/`:

```
pages/branding/piket-branding/
├── index.html                       # Semantic Markup, Mount Points Topbar & Sidebar, Modals
├── piket-branding.css               # Scoped Theme, Hero Banner Typography, Cards, Mobile Responsive
├── piket-branding.repository.js     # Firestore Data Layer (duty_types, duty_schedules, users)
├── piket-branding.ui.js             # DOM Rendering, Deduplikasi Dropdown/Stat, Modal Handling
└── piket-branding.js                # Orchestrator, Auth Lifecycle, Access Mode, Event Wiring
```

| Layer | File | Tanggung Jawab & Implementasi |
| :--- | :--- | :--- |
| **Structure** | `index.html` | Menyediakan mount point shell `#dg-topbar-mount` dan `#dg-sidebar-mount`, breadcrumb (`Home / Branding Division / Piket Branding`), hero section, baris ringkasan statistik, toolbar filter, kontainer list jadwal `#scheduleList`, serta 2 modal Bootstrap: `#scheduleModal` (Tambah/Edit Jadwal) dan `#typesModal` (Kelola Jenis Piket). |
| **Styling** | `piket-branding.css` | Mengatur styling visual scoped: gradien hero banner dengan background radial & linear elegan, tipografi judul hero compact (`.piket-hero-title`), badge duty board (`.piket-hero-badge`), kartu jadwal dengan aksen garis warna vertikal dinamis (`.schedule-type-bar`), pembagian kolom multi-anggota (`.assignment-card`), avatar bulat, dan responsivitas mobile (`@media (max-width: 768px)`). |
| **Repository** | `piket-branding.repository.js` | Menangani seluruh interaksi dengan Cloud Firestore: realtime snapshot listener untuk `duty_types` dan `duty_schedules` (diurutkan `start_date desc`), `getCurrentUser`, `getActiveUsers`, CRUD jadwal (`createSchedule`, `updateSchedule`, `deleteSchedule`), CRUD jenis piket (`createType`, `toggleTypeActive`), idempotent `seedDefaultTypes`, dan pembersih duplikat `cleanupDuplicateTypes`. Bebas dari manipulasi DOM. |
| **UI** | `piket-branding.ui.js` | Menangani render DOM: render daftar jadwal terkelompok per hari tugas, render baris tugas bullet, opsi dropdown filter & form dengan proteksi deduplikasi otomatis, kartu manajemen jenis piket, sinkronisasi form modal multi-anggota (`addAssignmentRow`, `addTaskRow`, `collectAssignments`), serta utilitas penanggalan format Indonesia (`toLocaleDateString('id-ID')`). Bebas dari akses Firestore langsung. |
| **Orchestrator** | `piket-branding.js` | Menghubungkan seluruh lapisan: inisialisasi sesi via `requireAuth()`, deteksi hak akses `applyAccessMode` (Admin vs Intern/Viewer), render shell `#dg-topbar-mount` dan `#dg-sidebar-mount`, memulai dan menghentikan realtime subscription (`startListeners`), guard pencegah race condition seeding (`isSeeding`), dan pendaftaran event listener. |

---

## 3. Integrasi Database Cloud Firestore

Modul Piket Branding mengelola 2 koleksi operasional utama di Cloud Firestore `dialogika-co`, serta membaca data profil dari koleksi pengguna:

### 3.1 Koleksi `duty_types` (Katalog Jenis Piket)
Menyimpan jenis-jenis aktivitas piket yang dapat dipilih saat membuat jadwal.

```typescript
interface DutyTypeDocument {
  id: string;               // Document ID (slug deterministik untuk default types: "webinar", "live-report", "boost-community-discord")
  name: string;             // Nama jenis (contoh: "Webinar", "Live Report", "Boost Community Discord")
  slug: string;             // Identifier slug URL-safe
  color: string;            // Kode warna HEX (contoh: "#7204cf", "#0B2B6A", "#f97316")
  icon: string;             // Nama icon Bootstrap (contoh: "bi-camera-video", "bi-broadcast", "bi-discord")
  description: string;      // Penjelasan singkat tujuan piket
  default_tasks: string[];  // Template tugas umum bawaan jenis ini
  is_active: boolean;       // Status ketersediaan (true = aktif, false = nonaktif)
  created_at: Timestamp;    // Waktu pembuatan
  updated_at: Timestamp;    // Waktu pembaruan terakhir
  created_by: string;       // UID pengguna pembuat
}
```

### 3.2 Koleksi `duty_schedules` (Jadwal Piket Berjalan)
Menyimpan jadwal penugasan piket spesifik lengkap beserta daftar penugasan anggota dan tugasnya.

```typescript
interface DutyScheduleDocument {
  id: string;               // Firestore Document ID (Auto-generated)
  title: string;            // Judul jadwal (contoh: "Webinar 25.2", "Live Report 13-19 Juli")
  description: string;      // Rincian pelaksanaan
  type_id: string;          // Relasi ke Document ID pada duty_types
  type_name: string;        // Denormalized nama jenis (menjaga redundansi bila ID berubah)
  type_color: string;       // Denormalized warna jenis
  start_date: Timestamp;    // Tanggal mulai periode piket
  end_date: Timestamp;      // Tanggal selesai periode piket
  period_label: string;     // String rentang tanggal terformat (contoh: "12 Juli – 17 Juli 2026")
  status: "scheduled" | "completed" | "cancelled";
  visibility: "all";
  assignments: Array<{      // Penugasan anggota tim pada jadwal ini
    user_id: string;        // UID anggota bertugas (dari koleksi users)
    name: string;           // Nama anggota bertugas
    photo: string;          // URL avatar anggota
    role_label: string;     // Posisi/peran dalam piket (contoh: "Ketua Panitia", "Panitia", "PIC")
    day_label: string;      // Hari pelaksanaan (contoh: "Kamis")
    assignment_date: Timestamp; // Tanggal spesifik tugas anggota tersebut
    tasks: Array<{          // Daftar rincian tugas anggota
      title: string;        // Judul tugas (contoh: "Leading event", "Reminder GC 25.1")
      description: string;  // Deskripsi tugas
      status: "pending" | "completed";
    }>;
  }>;
  created_at: Timestamp;
  updated_at: Timestamp;
  created_by: string;
  updated_by: string;
}
```

### 3.3 Koleksi Baca Terkait: `users`
Membaca data seluruh anggota aktif (`status == 'active'`) melalui `getActiveUsers()` untuk mengisi opsi dropdown pemilihan anggota saat admin menyusun penugasan piket.

---

## 4. Alur Bisnis & Fitur Fungsional

### 4.1 Breadcrumb & Access Mode Control
* **Breadcrumb**: `Home / BRANDING DIVISION / PIKET BRANDING`.
* **Access Mode**:
  - **Admin Mode** (Role `owner`, `admin`, `team`, `staff`): Akses penuh membuat jadwal baru, mengedit jadwal, menghapus jadwal, menambah jenis piket, dan mengaktifkan/menonaktifkan jenis piket.
  - **Viewer Mode** (Role `intern`, `internship`, `magang`): Mode baca (*read-only*). Tombol aksi pembuatan/pengeditan otomatis disembunyikan via CSS `.admin-only.viewer-hidden`. Subtitle dan informasi terfokus pada melihat jadwal tugas.

### 4.2 Hero Banner & Tipografi Proporsional
Sesuai arahan visual tim:
* **Badge**: `Branding Duty Board` dengan latar putih elegan dan teks primary.
* **Judul**: `Piket Branding` dengan ukuran font proporsional `1.35rem` (~21px) dan `font-weight: 700`.
* **Deskripsi**: *"Lihat jadwal piket, anggota yang bertugas, dan deskripsi tugas masing-masing."* dengan warna kontras halus `rgba(255, 255, 255, 0.75)` dan ukuran `0.82rem`.

### 4.3 KPI Ringkasan Statistik
Dihitung otomatis secara reaktif saat data jadwal atau filter berubah:
1. **Piket Hari Ini**: Total anggota yang memiliki jadwal tugas tepat pada tanggal hari ini.
2. **Jadwal Aktif**: Jumlah jadwal dengan status `scheduled`.
3. **Anggota Bertugas**: Jumlah personil unik yang terlibat dalam jadwal-jadwal yang sedang difilter.
4. **Jenis Piket**: Jumlah total tipe piket unik yang berstatus aktif (3 tipe operasional: Webinar, Live Report, Boost Community Discord).

### 4.4 Sistem Penyaringan & Pencarian Realtime
* **Cari Jadwal**: Pencarian live mencakup judul, deskripsi, nama anggota bertugas, role penugasan, dan judul tugas.
* **Jenis Piket**: Dropdown difilter cerdas mencocokkan `type_id` maupun fallback `type_name` untuk menjamin kompatibilitas jadwal lama.
* **Periode**:
  - `Semua Periode`
  - `Hari Ini` (rentang jam 00:00:00 s.d 23:59:59)
  - `Minggu Ini` (Senin s.d Minggu minggu berjalan)
  - `Bulan Ini` (awal bulan s.d akhir bulan)
* **Status**: Filter spesifik `Scheduled`, `Completed`, atau `Cancelled`.

### 4.5 Sistem Modal Terintegrasi
1. **Modal Tambah / Edit Jadwal**:
   - Pemilihan jenis piket dan rentang tanggal mulai s.d selesai.
   - Penambahan anggota bertugas dinamis dengan picker tanggal tugas dan label role penugasan.
   - Penambahan satu atau lebih sub-tugas untuk setiap anggota bertugas.
   - Form scroll internal yang nyaman dan responsif di berbagai resolusi layar.
2. **Modal Kelola Jenis Piket**:
   - Form penambahan jenis baru (Nama, Kode Warna HEX via color picker, Icon Bootstrap).
   - Daftar seluruh jenis yang terdaftar dengan tombol toggle Aktif / Nonaktifkan.

---

## 5. Riwayat Penanganan Masalah & Solusi Arsitektur

### 5.1 Penanganan Duplikasi Dokumen `duty_types` (Seeding Idempotency)
* **Gejala Sebelumnya**: Dropdown jenis piket menampilkan duplikasi (setiap jenis muncul 2 kali berturut-turut) dan kartu statistik menghitung 6 jenis piket.
* **Akar Masalah**: Fungsi seeding awal menggunakan `addDoc` dengan Document ID acak, serta rentan terpicu ganda saat reload halaman / race condition pada listener snapshot Firestore kosong.
* **Solusi**:
  1. Mengubah mekanisme `seedDefaultTypes` di `piket-branding.repository.js` menggunakan `setDoc(doc(db, COLL_TYPES, item.slug), ...)` dengan `{ merge: true }`. ID dokumen sekarang bersifat deterministik (contoh: ID dokumen `webinar`, `live-report`, `boost-community-discord`).
  2. Menambahkan `cleanupDuplicateTypes` di repository untuk menyisakan satu dokumen kanonikal per jenis dan membersihkan dokumen duplikat ber-ID acak dari Firestore saat admin mengakses halaman.
  3. Menambahkan flag penjaga `isSeeding` di `piket-branding.js` agar proses seed tidak pernah dieksekusi bersamaan.
  4. Menerapkan proteksi deduplikasi di UI (`piket-branding.ui.js`) pada `renderTypeOptions`, `renderTypesList`, dan kalkulasi `updateStats`.

### 5.2 Standarisasi Tipografi Hero Section
* Menyesuaikan ukuran judul dan deskripsi dari default Bootstrap yang terlalu besar menjadi ukuran proporsional sesuai standar visual internal Dialogika (Gambar 2).
* Mengabstraksikan styling ke dalam class khusus: `.piket-hero-badge`, `.piket-hero-title`, dan `.piket-hero-subtitle`.

---

## 6. Status Pengujian & Validasi

| Kriteria Pengujian | Hasil Pengujian | Keterangan |
| :--- | :---: | :--- |
| **Realtime Firestore Listener** | **Lulus** | Sinkronisasi dua arah instan saat data jadwal/jenis ditambah, diubah, atau dihapus. |
| **Deduplikasi Dropdown & Stat** | **Lulus** | Dropdown dan kartu stat menampilkan jenis unik secara konsisten tanpa duplikat. |
| **Multi-Assignment Modal** | **Lulus** | Penambahan multi-anggota dan multi-tugas tersimpan utuh dalam struktur array `assignments`. |
| **Filter Multi-Kriteria** | **Lulus** | Filter pencarian, tipe, periode waktu, dan status berjalan reaktif dan akurat. |
| **Access Control (Admin vs Viewer)** | **Lulus** | User bertingkat intern hanya memiliki mode baca; tombol modifikasi disembunyikan dengan aman. |
| **Responsive Mobile Layout** | **Lulus** | Hero banner, kartu statistik, dan kartu jadwal tersusun rapi pada breakpoint mobile (`<= 768px`). |
