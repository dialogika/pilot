# Office Inventory — Feature Architecture

> **Feature Architecture Document.** Office Inventory is the migrated replacement for the legacy
> `data/office-inventory.html` — an **office assets & inventory management module** built on the Pilot
> architecture. Read alongside `docs/ARCHITECTURE-FOUNDATION.md` and `docs/USERS-MANAGEMENT-ARCHITECTURE.md`.

---

## 1. Feature Purpose

Office Inventory provides management of physical assets and inventory items across all office areas. It allows authorized team members to:

- View live inventory list with ID, item name, category, location, purchase date, purchase type, condition, quantity, status, and actions.
- Filter inventory items dynamically using search (search by item name, ID code, category code, location code).
- Add new inventory items with automated ID generation adhering to the standard format `${category}.${location}.${seq}/DIA/${MM}.${DD}/${type}`.
- Edit existing inventory items (name, category, location, purchase date, purchase type, condition, status, quantity).
- Delete inventory items with confirmation modal.
- Maintain real-time data synchronization with Firestore.

---

## 2. Public Route

```
/office-inventory  →  pages/hr/office-inventory/index.html
/inventory         →  pages/hr/office-inventory/index.html
```

Firebase Hosting rewrites in `firebase.json`. The browser URL stays `/office-inventory` or `/inventory`.
The legacy page `data/office-inventory.html` is kept untouched for comparison and backwards compatibility.

---

## 3. Physical File Location

```
pages/hr/office-inventory/
├── index.html                      # Page entry point & semantic layout
├── office-inventory.js             # Orchestrator (auth, shell mounting, event wiring)
├── office-inventory.repository.js  # Firestore queries, mutations, counter cache & ID generator
├── office-inventory.ui.js          # DOM manipulation, table rendering & modal controls
└── office-inventory.css            # Scoped feature styles, badges & modals
```

---

## 4. File Responsibilities

| File | Responsibility | Must NOT |
|---|---|---|
| `index.html` | Page markup, shell mounts (`#dg-topbar-mount`, `#dg-sidebar-mount`), table card, Add/Edit/Delete modals, CSS/JS references. | Directly query Firestore, call `initializeApp`, or execute business logic. |
| `office-inventory.js` | Orchestrator: `requireAuth()`, render shell (`renderTopbar`, `renderSidebar`), coordinate repository → ui, wire events (search, add/edit/delete modal lifecycle). | Query Firestore directly or perform raw DOM manipulations. |
| `office-inventory.repository.js` | **All** Firestore data access for `inventory` collection: `subscribeToInventory`, `loadKategoriCounters`, `generateInventoryID`, `addInventory`, `updateInventory`, `deleteInventory`. | Manipulate DOM, toggle UI modals, render elements. |
| `office-inventory.ui.js` | All rendering and modal helpers: table row generation, formatters (Indonesian date format, date input format), open/close modal overlays, form data extraction. | Query Firestore or execute persistence logic. |
| `office-inventory.css` | Inventory-specific styles (status badges, monospace ID pill, table row hover, custom modal overlay styles). | Duplicate global layout/theme styles. |

---

## 5. Data Flow

```
User Action → office-inventory.js → office-inventory.repository.js → Firebase (Firestore)
            ← office-inventory.js ← office-inventory.repository.js ←
          → office-inventory.ui.js → DOM
```

- **Reads / Subscriptions:** `office-inventory.js` initializes `subscribeToInventory()`, receiving live updates from `inventory` ordered by `created_at desc`. On update, items are filtered through `applySearchAndRender()` and passed to `office-inventory.ui.js` for rendering.
- **Writes:**
  - **Create:** User fills Add modal → `office-inventory.js` validates inputs → calls `generateInventoryID()` → calls `addInventory()` → Firestore triggers onSnapshot update.
  - **Update:** User modifies Edit modal → calls `updateInventory(id, data)` → Firestore triggers onSnapshot update.
  - **Delete:** User confirms deletion → calls `deleteInventory(id)` → Firestore triggers onSnapshot update.

---

## 6. Firebase Dependencies

```
Office Inventory
 ├── Authentication
 │    └── requireAuth() from assets/js/auth-guard.js
 ├── Firestore
 │    └── inventory          onSnapshot / getDocs / addDoc / updateDoc / deleteDoc
 └── Storage / Functions
      └── (none)
```

All Firestore calls reuse the central instance from `assets/js/firebase-config.js`.

---

## 7. Schema Dictionary (`inventory`)

| Field | Type | Description |
|---|---|---|
| `id_generated` | `string` | Formatted inventory code: `${kategori}.${lokasi}.${seq}/DIA/${MM}.${DD}/${tipe}` |
| `nama_barang` | `string` | Name of the asset / item |
| `kategori_kode` | `string` | Category code (e.g. `ATK`, `ETK`, `FUR`, `BRS`, `SMP`, `PERTEN`, `DEC`, `OTH`) |
| `kategori_label` | `string` | Category display name (e.g. `Alat Tulis`, `Elektronik`, `Furnitur`, `Kebersihan`, etc.) |
| `lokasi_kode` | `string` | Location code (e.g. `UTM`, `KLS`, `INT`, `STD`, `JNT`, `HLM`, `MUS`) |
| `lokasi_label` | `string` | Location display name (e.g. `Ruang Utama`, `Ruang Kelas`, `Musholla`, etc.) |
| `tanggal_beli` | `timestamp` / `date` | Purchase date |
| `tipe_pembelian` | `string` | Purchase type: `OTM` (One Time) or `SUB` (Subscribe) |
| `kondisi` | `string` | Asset condition: `Baik`, `Rusak Ringan`, `Rusak Berat` |
| `jumlah` | `number` | Item quantity / count |
| `status` | `string` | Status: `Available`, `In Use`, `Repair` |
| `urutan` | `number` | Category/location sequence counter |
| `created_at` | `timestamp` | Server timestamp |

---

## 8. Authentication & App Shell Integration

- Uses `requireAuth()` from `/assets/js/auth-guard.js`. Unauthenticated visitors are redirected to `/login`.
- Topbar: `renderTopbar({ user, role })` renders user profile, notifications, search, and navigation controls.
- Sidebar: `renderSidebar({ role, activePage: "office-inventory" })` renders sidebar and live counter badges.
- Breadcrumb points to `/home` and `/ Data / Inventory`.
