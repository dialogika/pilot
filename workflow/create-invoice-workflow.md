# Workflow & Arsitektur Create Invoice (Invoice Center)

> **Dokumentasi Komprehensif:** Alur Data, Sumber Koleksi Firestore, Arsitektur 3-Layer, Breadcrumb, Routing, Tabs System, Modal Management, dan Riwayat Refactoring.  
> **Modul:** `pages/marketing/create-invoice/`  
> **Route Publik:** `/create-invoice`  
> **Legacy Route:** `/setting/invoice-management.html` & `/setting/invoice-management` (Redirect 301)  
> **Branch Terkait:** `refactor/marketing/create-invoice`  
> **Target Database:** Cloud Firestore `dialogika-co` — Koleksi `invoices`, `class_availability`, `products`, `settings`  

---

## 1. Ringkasan & Tujuan Refactoring

Modul **Create Invoice (Invoice Center)** adalah pusat administrasi keuangan dan closing marketing di Dialogika untuk membuat tagihan invoice, mengelola daftar invoice, memantau bukti transfer (digital receipt), memvalidasi pembayaran (*Legit* / *Scam* / *Not Verified*), membuat dan mengelola kode referral (beserta kalkulator diskon), serta mengonfigurasi rekening bank pembayaran.

### Tujuan Utama Refactoring:
1. **Migrasi ke Arsitektur 3-Layer Dialogika**: Memisahkan file monolitik lama (`setting/invoice-management.html`) menjadi modul ES terstruktur (`index.html`, `create-invoice.css`, `create-invoice.repository.js`, `create-invoice.ui.js`, dan `create-invoice.js`).
2. **Sinkronisasi Database Firestore Terpusat**: Menghubungkan modul secara *live* dengan koleksi Firestore **`invoices`**, **`class_availability`**, **`products`**, dan dokumen **`settings/banks`** & **`settings/referrals`**.
3. **Penambahan Breadcrumb Navigation Konsisten**: Menstandarkan navigasi pengguna sesuai shared shell Dialogika: `Home / MARKETING DIVISION / CREATE INVOICE`.
4. **Konsistensi Routing Publik**: Mengonfigurasi Firebase Hosting rewrite sehingga halaman dapat diakses langsung pada `http://127.0.0.1:5000/create-invoice`.
5. **100% Feature Parity**: Mempertahankan seluruh fitur yang ada:
   - Form pembuatan & update invoice dengan kalkulasi DP dinamis.
   - Tabel Daftar Invoice dengan real-time countdown expiration timer.
   - Tabel Digital Receipt dengan verifikasi pembayaran (*Legit*, *Scam*, *Not Verified*).
   - Panel kode referral dengan progress bar penggunaan, kalkulator diskon, dan drawer riwayat invoice.
   - Manajemen rekening bank penerima pembayaran.
   - Seluruh modal popup (Copy Link Modal, Paid Invoices Modal, Invoice Detail Modal, Payment Verification Modal, Discount Calculator Modal).

---

## 2. Arsitektur Sistem

```
pages/marketing/create-invoice/
├── index.html                       # Semantic HTML Structure & Shared Shell Mounts
├── create-invoice.css               # Feature-scoped Styles (Glass Card, Inputs, Tabs, Modals)
├── create-invoice.repository.js     # Data Access Layer (Zero DOM)
├── create-invoice.ui.js             # UI Presentation Layer (Zero direct Firestore queries)
└── create-invoice.js                # Orchestrator / Feature Controller
```

| Layer | File | Tanggung Jawab & Implementasi |
| :--- | :--- | :--- |
| **Structure** | `index.html` | Memuat topbar `#dg-topbar-mount`, sidebar `#dg-sidebar-mount`, breadcrumb, kartu stat, tab bar navigasi, 5 container tab, dan 5 modal popup. |
| **Styling** | `create-invoice.css` | Mengatur tema visual: glass card, tab active indicator, custom inputs focus rings, live countdown indicator, animasi fadeIn, dan custom scrollbars. |
| **Repository** | `create-invoice.repository.js` | Akses data Firestore (`invoices`, `class_availability`, `products`, `settings/banks`, `settings/referrals`), operasi CRUD invoice, dan local storage sync. |
| **UI** | `create-invoice.ui.js` | Render DOM murni: update stat cards, render tabel invoice & countdown timer, render tabel receipt & status verifikasi, render kartu referral & progress bar, render rekening bank, serta kontrol buka/tutup modal. |
| **Orchestrator** | `create-invoice.js` | Verifikasi autentikasi via `requireAuth()`, mount shell topbar & sidebar, load data dari repository, bind semua event listener, koordinasi kalkulasi dinamis, dan handling URL hash deep linking. |

---

## 3. Integrasi Koleksi Firestore

1. **`invoices`**:
   - `fetchInvoices()`: Membaca seluruh dokumen diurutkan berdasarkan `createdAtMs` descending.
   - `saveInvoice(data, existingId)`: Menambah dokumen baru atau memperbarui invoice berdasarkan ID.
   - `deleteInvoice(id)`: Menghapus dokumen invoice.
   - `updateInvoiceVerification(id, status)`: Memperbarui status verifikasi (`legit`, `not_verified`, `scam`).

2. **`class_availability`**:
   - Membaca daftar kelas yang tersedia untuk populate dropdown Program Kelas pada form invoice.
   - Menghitung total pendaftar dan kuota kursi untuk kartu KPI Upcoming Classes.

3. **`products`**:
   - Membaca daftar produk untuk dropdown Produk Induk dan pilihan produk pada kode referral.
   - Mengambil detail `materials`, `features`, dan `specifications` saat invoice dibuat.

4. **`settings/banks` & `settings/referrals`**:
   - Membaca dan menyimpan konfigurasi channel rekening pembayaran dan kode referral ke dokumen settings dengan sinkronisasi ke LocalStorage.

---

## 4. Routing & Redirects (`firebase.json`)

* **Public Route**: `/create-invoice` -> `/pages/marketing/create-invoice/index.html`
* **Alias Route**: `/marketing/create-invoice` -> `/pages/marketing/create-invoice/index.html`
* **301 Redirect**:
  - `/setting/invoice-management.html` -> `/create-invoice`
  - `/setting/invoice-management` -> `/create-invoice`
  - `/create-invoice.html` -> `/create-invoice`
