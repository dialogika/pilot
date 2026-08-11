# UI Components — Komponen Reusable

## 1. Design System

### Color Palette (`assets/css/style.css:1-17`)

| Variabel CSS | Nilai | Penggunaan |
|-------------|-------|------------|
| `--dlg-blue` | `#0B2B6A` | Warna utama Dialogika |
| `--dlg-yellow` | `#f7b12c` | Warna aksen |
| `--dlg-green` | `#006a4e` | Sukses / selesai |
| `--dlg-red` | `#e7181a` | Bahaya / prioritas |
| `--dlg-purple` | `#7204cf` | Aksen khusus |
| `--bg-body` | `#f1f7fd` | Latar belakang halaman |
| `--sidebar-width` | `290px` | Lebar sidebar |
| `--topbar-height` | `70px` | Tinggi top bar |

### Gradient Utilities
- `.grad-blue`, `.grad-yellow`, `.grad-green`, `.grad-red`, `.grad-purple`, `.grad-slate`

### Buttons
- `.btn-dlg-blue` — Primary button
- `.btn-dlg-red` — Danger button
- `.btn-dlg-yellow` — Warning/action button
- `.btn-dlg-purple` — Special accent button
- `.btn-dlg-green` — Success button

---

## 2. Layout Structure

```
.top-bar (fixed, height: 70px)
  ├── Logo center
  ├── Left: mobile toggle
  └── Right: profile dropdown

.sidebar (fixed, width: 290px)
  ├── .sidebar-scroll-wrapper
  │   ├── Smart filters (4 grid cards)
  │   ├── Navigation categories & links
  │   └── Sidebar copyright
  └── .pending-widget (pinned bottom)

.main-content (margin-left: 290px)
  └── Page-specific content

.bottom-nav (mobile, fixed bottom)
  └── 5 nav items + center plus button
```

**Responsive:** Sidebar collapse via `body.sidebar-collapsed` class (≥992px). Bottom nav muncul di <992px.

---

## 3. Top Bar

**File:** `element/topbar.js`

- Logo sentral dengan `position: absolute; left: 50%; transform: translateX(-50%)`
- Mobile toggle button (hamburger)
- Profile dropdown (kanan) — menampilkan avatar, nama, email, menu dropdow

Profile dropdown (`style.css:406-486`):
- `.profile-dropdown-menu` — Panel dropdown dengan shadow
- `.profile-dropdown-header` — Avatar + info user
- `.profile-dropdown-body` — Daftar menu (Profile, Settings, Logout)
- Toggle via class `.show`

---

## 4. Sidebar

**File:** `element/sidebar.js`

**Smart Filters** (`style.css:143-165`):
- Grid 2×2 kartu filter cepat
- `.filter-card` — Background abu-abu, hover effect
- `.filter-icon` — Icon bulat 30px dengan warna berbeda
- `.filter-count` — Angka besar (bold)
- `.filter-label` — Label kecil

**Navigation** (`style.css:174-187`):
- `.nav-category` — Judul kategori (uppercase, kecil)
- `.sidebar-link` — Item navigasi dengan icon + label + badge
- `.sidebar-link.active` — Status aktif (biru muda)
- `.sidebar-badge` — Badge jumlah di sebelah kanan

**Pending Widget** (`style.css:190-211`):
- Widget sticky di bagian bawah sidebar
- Fire icon + tombol "Review Now"

---

## 5. Cards & Containers

### Project Card (`style.css:332-345`)
- `.project-card` — White card dengan border, shadow, hover translateY
- `.project-card.priority` — Gradient biru untuk prioritas

### Opportunity Card (`style.css:316-329`)
- Border kiri kuning, icon box dengan gradient
- Menampilkan peluang/rekrutmen

### App Box (`style.css:347-364`)
- Grid shortcut aplikasi di dashboard
- `.app-box` — Card kecil, hover translateY + shadow
- `.app-icon-wrapper` — Icon box 48px gradient
- `.app-title` — Label aplikasi

### List Card (`style.css:714-737`)
- `.list-card-container` — Card putih dengan border radius 20px
- `.list-card-title` — Judul large (1.8rem, weight 800)
- `.list-card-desc` — Deskripsi dengan clamp 2 baris
- `.status-flow` — Baris status workflow
- `.status-item` — Pill status dengan warna
- `.btn-add-todo-pill` — Tombol tambah task

---

## 6. Tags (`style.css:387-397`)

- `.tag-pill` — Pill dengan border radius penuh
- Kelas warna: `.tag-blue`, `.tag-yellow`, `.tag-green`, `.tag-red`, `.tag-purple`

---

## 7. Badges (`style.css:367-384`)

- `.menu-badge` — Badge merah notifikasi
- `.menu-badge-floating` — Posisi absolute (top-right)
- `.menu-badge-inline` — Sejajar dengan teks
- `.menu-badge-hidden` — Sembunyikan badge

---

## 8. Profile Avatar Online (`style.css:286-313`)

- `.online-scroll-container` — Horizontal scroll container
- `.avatar-wrapper` — Wrapper dengan ring gradient
- `.avatar-mask` — Masking lingkaran
- `.avatar-img` — Foto profil
- `.online-status-dot` — Dot hijau (online)

---

## 9. Rich Editor (`style.css:664-701`)

- `.editor-container` — Border container
- `.editor-toolbar` — Toolbar dengan tombol format
- `.editor-btn` — Tombol toolbar 34×34
- `.editor-content` — ContentEditable area
- Placeholder via `data-placeholder` attribute

---

## 10. Progress Bar (`style.css:251-283`)

- `.progress-track` — Track abu-abu
- `.progress-fill` — Fill dengan gradasi (abu → biru → hijau)
- `.step-item` — Step dots dalam flow
- `.step-dot` — Lingkaran status per step

---

## 11. Bottom Sheet (Mobile)

- `.custom-bottom-sheet` — Sheet dari bawah (border-radius 25px atas)
- `.action-option` — Opsi aksi dalam sheet
- Tampil via Bootstrap modal

---

## 12. Footer (`style.css:612-662`)

- Background `#0B2B6A`
- Social links dengan icon lingkaran
- `margin-top: auto` untuk sticky footer
