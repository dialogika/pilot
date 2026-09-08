# Laporan Migrasi: Fitur Create Invoice (Invoice Center)
**Tanggal:** 8 September 2026  
**Divisi:** Marketing Division  
**Branch:** `refactor/marketing/create-invoice`  
**Public Route:** `/create-invoice` (`http://127.0.0.1:5000/create-invoice`)  
**Legacy Source:** `setting/invoice-management.html`  
**Target Folder:** `pages/marketing/create-invoice/`  

---

## 1. Latar Belakang & Tujuan Migrasi

Sebelum refactoring, halaman administrasi pembuatan invoice dan monitoring closing (`setting/invoice-management.html`) berukuran ~3.488 baris kode monolitik yang menggabungkan struktur HTML, CSS kustom, query Firebase langsung di DOM, serta logika bisnis yang saling terkait erat.

Tujuan utama dari migrasi ini adalah:
1. **Penerapan Arsitektur Modular 3-Layer Dialogika**: Memecah halaman menjadi layer terpisah: Structure/HTML, Styling/CSS, Data Access/Repository, Presentation/UI, dan Controller/Orchestrator.
2. **Standardisasi Navigasi & Breadcrumb**: Menyelaraskan navigasi breadcrumb sesuai standar sistem Dialogika Pilot (`Home / MARKETING DIVISION / CREATE INVOICE`).
3. **Standardisasi Routing Publik**: Mengonfigurasi Firebase Hosting rewrite agar dapat diakses melalui URL bersih `/create-invoice` dan menambahkan redirect 301 dari URL lama.
4. **Konektivitas Database Firestore**: Menghubungkan modul ke koleksi database Firestore secara terstruktur tanpa manipulasi DOM di lapisan data.
5. **Integritas Fitur (100% Feature Parity)**: Mempertahankan seluruh fitur bisnis yang ada tanpa menambah atau mengurangi fungsionalitas.

---

## 2. Struktur Modul Baru

Sesuai panduan *Refactoring Prompt* dan *Restructuring Dialogika Team Website*, modul ditempatkan di:

```
pilot/pages/marketing/create-invoice/
├── index.html                       # Semantic HTML & App Shell Mounts
├── create-invoice.css               # Feature-scoped Styles (Glass card, inputs, tabs, timer)
├── create-invoice.repository.js     # Data Access Layer (Zero DOM)
├── create-invoice.ui.js             # Presentation Layer (Zero direct Firestore queries)
└── create-invoice.js                # Controller / Orchestrator Layer
```

### Rincian Tanggung Jawab Tiap File:

| File | Peran & Tanggung Jawab |
| :--- | :--- |
| **`index.html`** | Menyediakan mount point App Shell (`#dg-topbar-mount`, `#dg-sidebar-mount`, `<main class="dg-main">`), navigasi breadcrumb konsisten, kartu ringkasan KPI, 5 tab container utama, dan 5 modal dialog popup. |
| **`create-invoice.css`** | Styling visual modul: efek glassmorphism (`.glass-card`), transisi animasi tab (`.tab-content.active`), styling input fokus, custom scrollbar untuk tabel, dan backdrop modal. |
| **`create-invoice.repository.js`** | Berinteraksi langsung dengan Firebase Firestore (CRUD `invoices`, membaca `class_availability`, membaca master `products` beserta detail spesifikasi, serta sinkronisasi `settings/banks` & `settings/referrals`). Menyediakan fallback dan sinkronisasi LocalStorage. |
| **`create-invoice.ui.js`** | Mengelola seluruh operasi DOM: render tabel daftar invoice, update timer countdown kadaluarsa setiap detik, render tabel digital receipt dengan status verifikasi, render kartu referral & progress bar penggunaan, render tabel rekening bank, kontrol popup modal, dan format angka/mata uang IDR. |
| **`create-invoice.js`** | Mengatur siklus hidup modul: otentikasi pengguna via `requireAuth()`, inisialisasi Topbar & Sidebar, pemuatan data awal dari repository, binding seluruh event listener (search, filter, date range popover, submit form, modal trigger), serta sinkronisasi URL hash (`#tab-invoice`, `#tab-invoice-list`, `#tab-referral`, `#tab-bank`, `#tab-receipt`). |

---

## 3. Integrasi Koleksi Cloud Firestore

Modul terhubung dengan 4 koleksi Firestore utama di project target:

1. **Koleksi `invoices`**:
   - `fetchInvoices()`: Mengambil daftar invoice terurut `createdAtMs` menurun.
   - `saveInvoice(data, existingId)`: Membuat dokumen baru (dengan auto-generated ID `INV-YYMMDD-XXXX`) atau memperbarui data invoice.
   - `deleteInvoice(id)`: Menghapus invoice.
   - `updateInvoiceVerification(id, status)`: Mengupdate status verifikasi pembayaran (`legit`, `not_verified`, `scam`).

2. **Koleksi `class_availability`**:
   - Mengambil daftar kelas yang tersedia dan masih buka (*active & not expired*) untuk pilihan dropdown program kelas serta mengisi otomatis sisa seat (*seats left*).
   - Menghitung rasio peserta terdaftar terhadap kuota untuk kartu KPI *Upcoming Classes*.

3. **Koleksi `products`**:
   - Membaca daftar produk aktif untuk dropdown *Produk Induk* dan pilihan produk terkait pada kode referral.
   - Mengambil spesifikasi (*materials*, *features*, *specifications*) untuk dilampirkan pada dokumen invoice baru.

4. **Koleksi `settings` (`banks` & `referrals`)**:
   - Membaca dan menyimpan konfigurasi channel rekening pembayaran ke `settings/banks`.
   - Membaca dan menyimpan master kode referral ke `settings/referrals`.
   - Menggunakan LocalStorage sebagai cadangan lokal (*cache fallback*).

---

## 4. Konfigurasi Routing & Navigasi

### 4.1. Pembaruan `firebase.json`
Dikonfigurasi aturan routing publik dan backward compatibility:

```json
{
  "redirects": [
    {
      "source": "/setting/invoice-management.html",
      "destination": "/create-invoice",
      "type": 301
    },
    {
      "source": "/setting/invoice-management",
      "destination": "/create-invoice",
      "type": 301
    },
    {
      "source": "/create-invoice.html",
      "destination": "/create-invoice",
      "type": 301
    }
  ],
  "rewrites": [
    {
      "source": "/create-invoice",
      "destination": "/pages/marketing/create-invoice/index.html"
    },
    {
      "source": "/marketing/create-invoice",
      "destination": "/pages/marketing/create-invoice/index.html"
    }
  ]
}
```

### 4.2. Navigasi Breadcrumb
Mengikuti standar struktur konsisten Dialogika:
```html
<nav class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider mb-2">
  <a href="/home" class="text-blue-600 hover:text-blue-700 transition" title="Home">
    <i class="fas fa-home text-xs"></i>
  </a>
  <span class="text-blue-600">/</span>
  <span class="text-blue-600">MARKETING DIVISION</span>
  <span class="text-slate-400">/</span>
  <span class="text-slate-600">CREATE INVOICE</span>
</nav>
```

### 4.3. Pembaruan Dashboard Utama (`pages/home/index.html`)
Tautan app-box **Create Invoice** pada Marketing Division di `pages/home/index.html` diperbarui dari `../../setting/invoice-management.html` menjadi `/create-invoice`.

---

## 5. Rincian Fitur yang Dipertahankan (100% Feature Parity)

1. **Formulir Identitas Invoice (Tab Invoice)**:
   - Input nama penerima invoice, program kelas (sinkron dari `class_availability`), produk induk (sinkron dari `products`), batch, mode (Offline/Online dengan auto-hide field City), batas waktu (jam), harga kelas, dan kalkulasi minimal DP otomatis.
   - Tombol *Create Invoice* yang menyimpan data ke Firestore & LocalStorage, lalu langsung membuka *Copy Link Modal*.

2. **Daftar Invoice (Tab List)**:
   - Pencarian real-time berdasarkan nama, program, atau nomor invoice.
   - Filter rentang tanggal dengan popover kalender interaktif (preset default 30 hari terakhir).
   - Filter status expired (*All*, *Not Expired*, *Expired*, *Not Open*).
   - Pengatur jumlah data per halaman (100, 200, 500).
   - Kolom status waktu kadaluarsa dengan *live countdown ticker* (detik/menit/jam).
   - Aksi baris tabel: *View* (Detail Invoice Modal), *Edit* (Muat data ke form invoice), *Delete* (Hapus permanen dari Firestore).

3. **Manajemen Kode Referral (Tab Referral)**:
   - Pembuatan kode referral baru dengan tipe pemegang (*System* / *Specific User*).
   - Pilihan multi-produk terkait dengan dropdown checkbox kustom.
   - Pilihan fungsi referral (*Discount* dengan input persentase & nominal rupiah).
   - Kalkulator diskon interaktif via iframe modal (`/frame/calculator.html`).
   - Tabel referral dengan kartu inisial, indikator masa berlaku aktif/kadaluarsa, progress bar jumlah pemakaian, drawer riwayat invoice yang menggunakan kode referral, tombol edit, dan tombol hapus.

4. **Rekening Pembayaran (Tab Banks)**:
   - Formulir input/edit nama bank, nomor rekening, dan atas nama.
   - Tabel daftar rekening bank aktif dengan aksi edit dan hapus.

5. **Monitoring Digital Receipt (Tab Receipt)**:
   - Menampilkan seluruh transaksi invoice yang berstatus bayar (*Full*, *DP*, *Book*).
   - Thumbnail bukti transfer yang dapat diklik untuk pratinjau gambar atau tautan PDF.
   - Perhitungan otomatis nominal pembayaran, sisa hutang (*liability*), dan total penerimaan dana.
   - Modal Detail Pembayaran lengkap dengan pengubahan status verifikasi (*Legit*, *Not Verified*, *Scam*), tautan ke receipt publik, dan tombol cetak PDF.

6. **Sistem Modal Popup**:
   - `copyLinkModal`: Salin tautan invoice siap kirim ke client.
   - `paidInvoiceModal`: Daftar ringkasan pembayaran yang dapat diakses langsung dari kartu stat Receipt.
   - `invoiceViewModal`: Pratinjau ringkas data invoice.
   - `paymentViewModal`: Lembar digital receipt dan verifikasi admin.
   - `discountCalculatorModal`: Kalkulator diskon.

---

## 6. Validasi & Pengujian

- [x] **Validasi File JSON**: Struktur `firebase.json` diperiksa dan berstatus valid.
- [x] **Validasi Sintaks JavaScript**: Semua modul (`create-invoice.repository.js`, `create-invoice.ui.js`, `create-invoice.js`) lolos pengecekan `node --check` tanpa *syntax error*.
- [x] **Validasi Clean Code**: Tidak ada query Firestore di layer UI, dan tidak ada manipulasi DOM di layer Repository.
- [x] **Validasi Backward Compatibility**: File legacy `setting/invoice-management.html` tetap dipertahankan sebagai referensi arsip.

---

## 7. Kesimpulan

Proses migrasi fitur **Create Invoice** ke arsitektur modular Dialogika Pilot telah selesai dengan sukses, rapi, dan sesuai seluruh instruksi di `Refactoring Prompt.txt` dan `Restructuring Dialogika Team Website.md`. Branch siap untuk ditinjau dan digabungkan (*merge*) ke branch utama.
