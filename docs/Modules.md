# Modules — Katalog Halaman & Fitur

## 1. Authentication (`/`)

| File | Fungsi |
|------|--------|
| `index.html` | Login page — Firebase Auth + verifikasi Spreadsheet |
| `register.html` | Registrasi user baru |
| `assets/js/auth-guard.js` | Guard halaman — redirect ke login jika tidak terautentikasi |

---

## 2. Dashboard (`/home.html`)

Halaman utama setelah login:
- **Project Cards** — Daftar proyek dengan progress bar
- **Opportunity Card** — Ringkasan peluang/rekrutmen
- **Who's Online** — Avatar user yang sedang aktif
- **Apps Grid** — Grid shortcut ke semua modul
- **Sidebar Navigation** — Menu kategori + widget pending task
- **Mobile Bottom Nav** — Navigasi bawah untuk mobile

---

## 3. Presence / Presensi (`/presence.html`)

Sistem check-in/check-out:
- Slider login/logout
- Status badge (Hadir, Izin, Sakit, Dinas Luar, dll)
- Riwayat kehadiran user
- Manajemen presensi tim

**Halaman terkait:** `data/presence-team.html`, `data/intern-presence.html`

---

## 4. Project & Task Management (`/project/`)

| Halaman | Fungsi |
|---------|--------|
| `project.html` | Daftar semua proyek + buat proyek baru |
| `list.html` | Daftar list dalam satu proyek |
| `list-detail.html` | Detail list beserta task |
| `item-details.html` | Detail task (status, tag, assignee, komentar) |

**Fitur:**
- CRUD proyek, list, task, komentar, tag
- Status workflow (START → COMPLETE, bisa dikustom)
- Assign task ke user + notify
- Tag dengan warna
- Subscriber notifikasi
- Upload file ke Google Drive

---

## 5. Messages (`/project/message*.html`)

| Halaman | Fungsi |
|---------|--------|
| `message.html` | Inbox / daftar pesan |
| `message-draft.html` | Draft pesan |
| `message-detail.html` | Detail percakapan |
| `message-craft.html` | Komposer pesan (rich editor) |

---

## 6. Files (`/project/files*.html`)

| Halaman | Fungsi |
|---------|--------|
| `files.html` | Manajemen file utama |
| `files-doc.html` | Dokumen |
| `files-draft.html` | Draft file |
| `files-craft.html` | File craft |
| `files-link.html` | Kumpulan link |
| `files-folder.html` | Manajemen folder |

---

## 7. Leads & CRM (`/data/`)

| Halaman | Fungsi |
|---------|--------|
| `leads-inbox.html` | Inbox leads masuk |
| `leads-agent.html` | Assignment leads ke agent |
| `mailing-list.html` | Manajemen mailing list |

---

## 8. Kandidat & Rekrutmen (`/data/`)

| Halaman | Fungsi |
|---------|--------|
| `candidate-management.html` | Manajemen kandidat |
| `scouting-candidate.html` | Scouting / pencarian kandidat |
| `internship-candidate-detail.html` | Detail kandidat internship |
| `team-candidate-detail.html` | Detail kandidat tim |
| `mentor-candidate-detail.html` | Detail kandidat mentor |
| `kandidat-nonaktif.html` | Kandidat non-aktif |

**Komponen terkait:** `element/candidate-management.js`, `element/register-candidate-lookup.js`, `element/recruitment-interview-utils.js`

---

## 9. People & Recruitment Dashboard (`/quest/`)

| Halaman | Fungsi |
|---------|--------|
| `dashboard-people-dev.html` | Dashboard pengembangan SDM |
| `dashboard-recruitment.html` | Dashboard rekrutmen |
| `quest-edit.html` | Editor quest/tugas |

---

## 10. Admin & Settings (`/setting/`)

| Halaman | Fungsi |
|---------|--------|
| `users-management.html` | Manajemen user |
| `team-management.html` | Manajemen tim |
| `mentor-management.html` | Manajemen mentor |
| `leads-management.html` | Manajemen leads |
| `product-management.html` | Manajemen produk |
| `promo-classes.html` | Promo kelas |
| `referral-dashboard.html` | Dashboard referral |
| `webinar.html` | Manajemen webinar |
| `invoice-management.html` | Manajemen invoice |
| `operational-expenses.html` | Pengeluaran operasional |

### Class Management

| Halaman | Fungsi |
|---------|--------|
| `class-management.html` | Daftar & manajemen kelas |
| `class-detail.html` | Detail kelas |
| `class-checkup.html` | Checkup kelas |
| `class-planning.html` | Perencanaan kelas |
| `generate-certificate.html` | Generate sertifikat |
| `assets/js/class-sync.js` | Sinkronisasi real-time antar tab via BroadcastChannel |

### Internship Management

| Halaman | Fungsi |
|---------|--------|
| `internship-management.html` | Manajemen internship |
| `data/intern-presence.html` | Presensi intern |

---

## 11. Personal (`/personal/`)

| Halaman | Fungsi |
|---------|--------|
| `profile.html` | Profil pribadi |
| `form-permit.html` | Form izin (tidak masuk) |
| `form-reimburse.html` | Form reimbursment |

**Halaman terkait:** `data/permit-reimburse-management.html` (manajemen izin & reimburse oleh admin)

---

## 12. Branding & Operational

| Halaman | Fungsi |
|---------|--------|
| `data/branding-schedule.html` | Jadwal konten branding |
| `data/piket-branding.html` | Piket branding |
| `data/company-position.html` | Posisi perusahaan |
| `data/office-inventory.html` | Inventaris kantor |
| `data/performance-appraisal-form.html` | Form penilaian kinerja |
| `data/performance-appraisal-intern.html` | Penilaian kinerja intern |
| `data/member-data.html` | Data anggota |
| `data/class-available.html` | Kelas tersedia |

---

## 13. Export & Printable (`/export/`, `/example/`)

| Halaman | Fungsi |
|---------|--------|
| `export/register.html` | Cetak formulir registrasi |
| `export/receipt.html` | Cetak kwitansi |
| `export/invoice.html` | Cetak invoice |
| `export/enrollment.html` | Cetak enrollment |
| `export/closing.html` | Cetak closing |
| `example/register.html` | Template register |
| `example/register-ref.html` | Template register referral |
| `example/receipt.html` | Template kwitansi |
| `example/invoice.html` | Template invoice |
| `example/form-regis-member.html` | Template form member |
| `example/closing.html` | Template closing |
| `example/x-product.html` | Template cross-product |

---

## 14. Utility (`/frame/`)

| Halaman | Fungsi |
|---------|--------|
| `calculator.html` | Kalkulator utilitas |

---

## 15. Komponen Pendukung (`/element/`)

| File | Fungsi |
|------|--------|
| `topbar.js` | Top bar komponen |
| `sidebar.js` | Sidebar navigasi |
| `rightbar-recruit.js` | Right bar untuk rekrutmen |
| `template-manager.js` | Manajemen template |
| `team-management-sync.js` | Sinkronisasi data tim |
| `candidate-management.js` | Logika manajemen kandidat |
| `register-candidate-lookup.js` | Pencarian data kandidat |
| `recruitment-interview-utils.js` | Utility wawancara rekrutmen |
| `whatsapp-message-builder.js` | Builder pesan WhatsApp |
| `whatsapp-encoding.js` | Encoding untuk pesan WhatsApp |
