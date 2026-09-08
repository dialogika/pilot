# Workflow & Arsitektur Mentor Management

> **Dokumentasi Komprehensif:** Alur Data, Sumber Koleksi Firestore, Arsitektur 4-Layer, Breadcrumb, Pagination, Performance Ranking, Modal System, dan Riwayat Refactoring.  
> **Modul:** `pages/product/mentor-management/`  
> **Route Publik:** `/mentor-management`  
> **Legacy Route:** `/setting/mentor-management.html` & `/setting/mentor-management` (Redirect 301)  
> **Branch Terkait:** `refactor/product/mentor-management`  
> **Target Database:** Cloud Firestore `dialogika-co` — Koleksi `mentors` (Plural)  

---

## 1. Ringkasan & Tujuan Refactoring

Modul **Mentor Management** adalah pusat operasional produk dan operasional kelas di Dialogika untuk memantau, mengelola data profil, ketersediaan jadwal mengajar, kinerja, kontrak, serta penugasan mentor pada kelas-kelas Dialogika.

### Tujuan Utama Refactoring:
1. **Migrasi ke Arsitektur 4-Layer Dialogika**: Memisahkan kode monolitik lama (~2.100 baris di `setting/mentor-management.html`) menjadi modul-modul ES terstruktur (`index.html`, `mentor-management.css`, `mentor-management.repository.js`, `mentor-management.ui.js`, dan `mentor-management.js`).
2. **Sinkronisasi Database Firestore Terpusat**: Menghubungkan modul secara *live* dengan koleksi Firestore **`mentors`** di project target `dialogika-co` (berisi 44 record mentor aktif) dengan dukungan fallback ke koleksi legacy `mentor`.
3. **Penambahan Breadcrumb Navigation**: Menstandarkan alur navigasi pengguna sesuai shared shell Dialogika (`Home / Product Division / Mentor Management`).
4. **Penambahan Pagination Dinamis**: Menambahkan kontrol pagination cerdas (pilihan ukuran data: 10, 15, 25, 50 per halaman) agar performa render DOM tetap ringan saat menangani dataset mentor yang bertambah besar.
5. **100% Feature Parity (Tanpa Mengurangi/Menambah Fitur Liar)**: Mempertahankan seluruh fitur bisnis yang sudah ada: KPI summary cards, filter multi-kriteria, dynamic sorting, performance ranking (Top 5 & Risk Mentor), reminder kontrak & aktivitas, drawer detail mentor, form add/edit mentor, modal assign class, modal ubah status massal, dan export CSV.

---

## 2. Arsitektur Sistem 4-Layer

Sistem dibangun mengikuti standar modul modular Dialogika Pilot:

```
pages/product/mentor-management/
├── index.html                       # Struktur HTML Semantic & Shared Shell Mounts
├── mentor-management.css             # Scoped Styles, Status Badges, Scoring, Modal
├── mentor-management.repository.js   # Firestore Data Layer (Collection: mentors)
├── mentor-management.ui.js           # DOM Presentation, Table, Modals, Pagination
└── mentor-management.js              # Orchestrator, State, Filter, Sort, Events
```

| Layer | File | Tanggung Jawab & Implementasi |
| :--- | :--- | :--- |
| **Structure** | `index.html` | Memuat topbar `#dg-topbar-mount`, sidebar `#dg-sidebar-mount`, breadcrumb, kartu KPI, toolbar filter, tabel data mentor, pagination container `#pgnControls`, panel kanan (ranking & reminder), serta 4 modal popup. |
| **Styling** | `mentor-management.css` | Mengatur tema visual scoped: status pills (`active`, `probation`, `inactive`), score pill (emerald, amber, rose), sticky table header, custom scrollbars, pagination button states, dan backdrop modal animasi. |
| **Repository** | `mentor-management.repository.js` | Akses langsung ke Cloud Firestore: membaca koleksi `mentors` (dengan fallback `mentor`), normalisasi data (telepon, WhatsApp direct link, rating, rate kehadiran/kelulusan, availability slot, bank account), fungsi `saveMentor` (add & edit), `bulkUpdateStatus`, serta `getAvailableClasses` dari `class_planning`. |
| **UI** | `mentor-management.ui.js` | Render DOM murni: render kartu ringkasan KPI, render baris tabel dengan avatar inisial, render navigasi pagination (`Prev`, tombol halaman numerik, `Next`), render widget Top 5 & Risk Mentor, render Reminder, buka/tutup modal Detail, Add/Edit, Assign Kelas, dan Bulk Status. |
| **Orchestrator** | `mentor-management.js` | Pengatur alur utama: verifikasi autentikasi via `requireAuth()`, render shell `renderTopbar` dan `renderSidebar`, inisialisasi state filter & sorting, perhitungan limit pagination, binding seluruh event listener (search, filter, sort header, modal trigger, export CSV). |

---

## 3. Integrasi & Pemetaan Koleksi Database Firestore

### 3.1 Sumber Koleksi Utama: `mentors`
Halaman ini membaca data live dari koleksi **`mentors`** di Cloud Firestore project Dialogika:

* **Nama Koleksi Utama:** `mentors`
* **Nama Koleksi Fallback:** `mentor` (jika koleksi utama belum terisi)
* **Koleksi Penugasan Kelas:** `class_planning`

### 3.2 Struktur Field Dokumen `mentors`
Setiap dokumen di Firestore dinormalisasi dengan struktur field berikut:

```typescript
interface MentorDocument {
  // Identitas Mentor
  fullName: string;                // Contoh: "Aditya Diah"
  nickName: string;                // Contoh: "Adit"
  whatsapp: string;                // URL atau nomor: "https://wa.me/628315464711"
  location: string;                // Contoh: "Kalimantan", "Jakarta", "Bandung"
  avatar?: string;                 // URL foto (opsional)

  // Status & Kategori Pengajaran
  status: "active" | "probation" | "inactive";
  teaching: "Dewasa" | "Anak-Anak" | "Both";
  type: "Online" | "Offline" | "Both";

  // Performa & Metrik (Skala Kinerja)
  rating: number;                  // Contoh: 4.8 (skala 0.0 - 5.0)
  totalClasses: number;            // Total kelas yang pernah diampu
  activeClasses: number;           // Kelas yang sedang aktif berjalan
  attendanceRate: number;          // Persentase kehadiran (0 - 100%)
  completionRate: number;          // Persentase kelulusan kelas (0 - 100%)
  complaintCount: number;          // Jumlah keluhan peserta (default 0)
  avgFeedback?: number;            // Rata-rata feedback kualitatif
  lastActiveDays: number;          // Hari sejak aktivitas terakhir

  // Finansial & Honor
  feeOnline: number;               // Honor per sesi online (contoh: 50000)
  feeOffline: number;              // Honor per sesi offline (contoh: 75000)
  totalEarning: number;            // Total akumulasi pendapatan
  pendingPayment: number;          // Pembayaran yang sedang pending
  bankName: string;                // Nama Bank (BCA, Mandiri, dsb)
  accountNumber: string;           // No Rekening
  accountHolderName: string;       // Nama Pemilik Rekening

  // Kontrak & Ketersediaan
  contractEnd: string;             // Tanggal berakhir kontrak (format: YYYY-MM-DD)
  contractDurationMonths?: number; // Durasi kontrak (bulan)
  contractNotes?: string;          // Catatan khusus kontrak
  availability: Array<{            // Jadwal ketersediaan mengajar
    day: "Senin" | "Selasa" | "Rabu" | "Kamis" | "Jumat" | "Sabtu" | "Minggu";
    start: string;                 // Contoh: "09:00"
    end: string;                   // Contoh: "12:00"
  }>;

  // Metadata Timestamp
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
```

---

## 4. Alur & Fitur Fungsional

### 4.1 Breadcrumb Navigation
Ditempatkan tepat di atas judul halaman:
$$\text{Home} \rightarrow \text{Product Division} \rightarrow \textbf{Mentor Management}$$
* Ikon rumah direct link ke `/home`.
* Label `Product Division` sebagai divisi modul (konsisten dengan `HR Division`, dll).
* `Mentor Management` sebagai penanda halaman aktif saat ini.

### 4.2 KPI Summary Cards
Ringkasan statistik teratas dihitung otomatis secara realtime dari dataset mentor yang telah difilter:
1. **Total Mentor**: Jumlah keseluruhan data mentor yang terdaftar (contoh: 44 mentor).
2. **Active Mentor**: Jumlah mentor dengan status `active` beserta persentase aset aktif (contoh: 38 / 86.4%).
3. **Average Rating**: Rata-rata bintang mentor terdaftar (skala 5.0).
4. **Online vs Offline**: Distribusi mentor yang mengajar moda online vs moda tatap muka offline.

### 4.3 Navigasi Tabel & Pagination Dinamis
Untuk menjaga performa dan kerapian tampilan:
* **Ukuran Halaman (Page Size)**: Dropdown pilihan `10`, `15`, `25`, atau `50` data per halaman.
* **Pagination Bar**: Menampilkan tombol `Prev`, nomor-nomor halaman dengan indikator aktif, pemisah `...` (*ellipsis*) untuk halaman panjang, dan tombol `Next`.
* **Realtime Counter**: Keterangan jumlah baris yang tampil (contoh: *Menampilkan 1-10 dari 44 mentor*).

### 4.4 Multi-Filter & Live Search
* **Search Input**: Pencarian instan berdasarkan nama lengkap, panggilan (*nickname*), nomor WhatsApp, atau lokasi.
* **Filter Status**: `active`, `probation`, `inactive`.
* **Filter Rating**: Pilihan rating bintang minimum (Bintang 4+, Bintang 3+, dll).
* **Filter Lokasi**: Berdasarkan kota domisili.
* **Filter Kategori & Moda**: Dewasa / Anak-Anak / Both; Online / Offline / Both.
* **Filter Ketersediaan**: Berdasarkan hari ketersediaan mengajar.

### 4.5 Performance Ranking & Reminder Panel (Side Widget)
* **Auto-Scoring (Skala 0–10)**:
  $$\text{Score} = (\text{Rating} \times 0.8) + (\text{Attendance} \times 0.03) + (\text{Completion} \times 0.02) - (\text{Complaints} \times 0.5)$$
* **Top 5 Mentor**: Daftar 5 pengajar terbaik berdasarkan kalkulasi score tertinggi.
* **Risk Mentor**: Mendeteksi mentor yang memiliki komplain peserta $>0$ atau skor performa rendah untuk segera dievaluasi tim operational.
* **Reminder Kontrak & Aktivitas**: Alert otomatis bagi mentor yang masa kontrak kerjanya berakhir dalam kurun waktu $< 30$ hari.

### 4.6 Sistem Modal Komprehensif
1. **Modal Detail Mentor**:
   * Menampilkan profil lengkap, rincian kontak WhatsApp, ringkasan honor, info rekening bank, jadwal availability harian, dan riwayat kelas yang diampu.
2. **Modal Add New Mentor / Edit Mentor**:
   * Form validasi penambahan mentor baru atau pembaruan profil yang langsung tersimpan ke koleksi `mentors`.
   * Form slot ketersediaan mengajar yang dapat ditambah dinamis (*dynamic schedule slot*).
3. **Modal Assign Class**:
   * Menugaskan mentor ke salah satu batch kelas aktif yang diambil dari koleksi `class_planning`.
4. **Modal Ubah Status Massal**:
   * Memungkinkan pengguna memilih banyak mentor via checkbox tabel, kemudian mengganti status mereka sekaligus (`active`, `probation`, atau `inactive`) secara *batch transaction*.
5. **Export CSV**:
   * Mengunduh seluruh data mentor yang sedang aktif/difilter ke format `mentor-management.csv` berstandar UTF-8.

---

## 5. Konfigurasi Routing & Hosting

Di file [firebase.json](file:///d:/dialogika%20fix/pilot/firebase.json):
```json
{
  "hosting": {
    "redirects": [
      {
        "source": "/setting/mentor-management.html",
        "destination": "/mentor-management",
        "type": 301
      },
      {
        "source": "/setting/mentor-management",
        "destination": "/mentor-management",
        "type": 301
      }
    ],
    "rewrites": [
      {
        "source": "/mentor-management",
        "destination": "/pages/product/mentor-management/index.html"
      }
    ]
  }
}
```

* URL Canonical baru: `http://127.0.0.1:5000/mentor-management`
* URL Kompatibilitas lama: `http://127.0.0.1:5000/setting/mentor-management.html` (otomatis redirect atau memuat bundle modern).

---

## 6. Riwayat Perubahan & Status Kesiapan

* **Branch Git**: `refactor/product/mentor-management`
* **Status Pengujian**:
  * Inisialisasi Firebase Auth Guard: ✅ Sukses
  * Shared Shell (Topbar & Sidebar Dialogika): ✅ Sukses
  * Pembacaan Firestore `mentors` (44 dokumen): ✅ 100% Cocok
  * Tampilan UI & Responsive Layout: ✅ Terverifikasi di Emulator Port 5000
  * Operasi Tambah, Edit, Assign, Status Massal, & Export: ✅ Lolos pengujian
* **Status**: **Siap Di-commit & Merge ke Staging / Production**.
