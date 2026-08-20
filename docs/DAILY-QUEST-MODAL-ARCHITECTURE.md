# Arsitektur Daily & Quest Modal (Refactoring Main Quest & Side Quest)

## 1. Ringkasan & Tujuan Refactoring

Fitur **Daily & Quest** (sebelumnya bernama *Main Quest & Side Quest*) adalah sistem manajemen to-do dan pelaporan kerja internal Dialogika. 

Tujuan utama refactoring ini adalah:
1. **Pembaruan Terminologi**:
   - `Main Quest` diubah menjadi **`Daily`** (tugas berulang harian/rutin).
   - `Side Quest` diubah menjadi **`Quest`** (tugas spesifik dengan tenggat waktu satu kali).
2. **Pola Interaksi In-Page Modal**:
   - Menghilangkan navigasi / redirect halaman saat user mengklik kartu filter "Daily" atau "Quest" di Sidebar.
   - Mengubah alur menjadi **Modal Dialog Interaktif** langsung di halaman yang sedang aktif (Home, Internships, dll.) tanpa reload halaman.
3. **Pelestarian Fitur 100%**:
   - Semua fungsi (Overdue, Today, Upcoming, centang submit Daily Report, form tambah/edit, detail task, poin, filter per role/department) dipertahankan secara utuh.

---

## 2. Struktur File Modular (4-Layer Pattern)

Komponen modal ini dibangun secara modular dan dapat digunakan di seluruh halaman shell aplikasi:

```
pilot/assets/js/components/quest-modal/
├── quest-modal.js             # ORCHESTRATOR: Kontrol lifecycle, auth, tab switching, sync count
├── quest-modal.repository.js  # REPOSITORY: Akses Firestore (tasks, intern_dailyreport, users, depts)
├── quest-modal.ui.js          # UI: Rendering DOM, modal dialog, form, detail, report checklist
└── quest-modal.css            # STYLING: Scoped CSS, overlay backdrop-blur, responsive card layout
```

---

## 3. Pembagian Tanggung Jawab Antar-Layer

### `quest-modal.repository.js` (Data Layer)
- Berkomunikasi langsung dengan Firebase Firestore menggunakan inisialisasi tunggal dari `firebase-config.js`.
- Menyediakan fungsi CRUD data:
  - `listQuestTasks()`: Membaca seluruh tasks.
  - `createTask(payload)`, `updateTask(id, patch)`, `deleteTask(id)`.
  - `submitDailyReport(payload)`: Mengirim laporan ke koleksi `intern_dailyreport`.
  - `markTaskReported(id, whoDidThis)`: Memperbarui status task menjadi *reported*.
  - `loadUsersMap()`, `loadDepartments()`, `loadPositions()`.
- **Dilarang keras**: Memanipulasi DOM atau memanggil elemen HTML.

### `quest-modal.ui.js` (Presentation Layer)
- Menjamin struktur modal (`#dgQuestModalMount`) terpasang di DOM secara dinamis (`ensureQuestModalDOM`).
- Menangani tampilan tab:
  - Tab **Daily** (ikon `bi-bullseye` / target).
  - Tab **Quest** (ikon `bi-stars` / bintang).
- Merender daftar kartu tugas per kategori: Overdue, Today (dengan tombol centang untuk laporan), dan Upcoming (maksimal 2 to-do berikutnya).
- Mengatur sub-modal:
  - Sub-modal Form (Tambah/Edit Daily & Quest).
  - Sub-modal Detail Task.
  - Sub-modal Submit Daily Report.
- **Dilarang keras**: Melakukan query Firestore langsung.

### `quest-modal.js` (Orchestrator Layer)
- Menyediakan entry point publik:
  - `openQuestModal({ initialTab: 'daily' | 'quest' })`
  - `closeQuestModal()`
  - `initQuestModal()`
- Mengatur alur logika:
  - Mengambil data dari `repository`.
  - Menormalisasi tugas (deteksi overdue, recurring untuk Daily, due date untuk Quest, lock state, hak akses role).
  - Mengirim data ke `ui` untuk dirender.
  - Memperbarui counter live di sidebar (`getSidebarCounts`) secara otomatis setelah ada task yang dibuat/diupdate/dilaporkan.

---

## 4. Integrasi dengan Shared Shell (Sidebar)

Pada [sidebar.config.js](file:///d:/Dialogika%20IT/Dialogika/pilot/assets/js/components/sidebar/sidebar.config.js):
- Smart filter 1: Label **`Daily`**, action: `"openDaily"`, count ID: `mainQuestCount`.
- Smart filter 2: Label **`Quest`**, action: `"openQuest"`, count ID: `sideQuestCount`.

Pada [sidebar.ui.js](file:///d:/Dialogika%20IT/Dialogika/pilot/assets/js/components/sidebar/sidebar.ui.js):
- Merender kartu smart filter dengan atribut `data-sidebar-action`.
- Menangkap event klik tanpa memicu navigasi link `<a>`.

Pada [sidebar.js](file:///d:/Dialogika%20IT/Dialogika/pilot/assets/js/components/sidebar/sidebar.js):
- Memanggil `openQuestModal({ initialTab: 'daily' })` atau `openQuestModal({ initialTab: 'quest' })` saat kartu filter diklik.

---

## 5. Validasi & Pengujian

- [x] **Tidak ada redirect**: Mengklik Daily atau Quest di Sidebar langsung memunculkan modal di halaman yang aktif.
- [x] **Pemberian Nama Baru**: Seluruh teks Main Quest &rarr; Daily dan Side Quest &rarr; Quest.
- [x] **Fungsi Lengkap**:
  - Overdue list tampil akurat.
  - Today list dapat dicentang untuk Submit Report.
  - Form Add/Edit dapat membedakan opsi recurring (Daily) dan tanggal tenggat satu kali (Quest).
  - Detail task menampilkan penugasan user, departemen, prioritas, dan status.
  - Live count pada sidebar langsung ter-update setelah aksi CRUD.
