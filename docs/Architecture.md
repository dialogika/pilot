# Architecture — Google Apps Script Integration

## Overview

Seluruh data bisnis disimpan di **Google Spreadsheet** dan diakses melalui **Google Apps Script Web App**. Setiap halaman HTML melakukan fetch ke endpoint GAS untuk operasi CRUD.

## Diagram Alur

```
Browser (HTML/JS)
    │
    ├─ Firebase Auth ────► Firebase
    │
    └─ fetch() ────────► GAS Web App ────► Google Sheets
                              │
                              └──► Google Drive (file upload)
```

## Konstanta Spreadsheet

Didefinisikan di `appscript.js:5-16`:

| Konstanta | ID Spreadsheet | Fungsi |
|-----------|----------------|--------|
| `PROJECT_SHEET_ID` | `1ctP2l...` | Data proyek |
| `LIST_SHEET_ID` | `1MKNFD...` | List dalam proyek |
| `TASK_SHEET_ID` | `1EFUyG...` | Task/item |
| `COMMENT_SHEET_ID` | `1gQ35b...` | Komentar |
| `SUBS_SHEET_ID` | `1RRXSk...` | Subscriber proyek |
| `TAG_SHEET_ID` | `14cZxG...` | Master tag |
| `TASK_TAG_SHEET_ID` | `1na1Kf...` | Relasi task ↔ tag |
| `STATUS_SHEET_ID` | `1HVbob...` | Status workflow |
| `USER_SHEET_ID` | `1sFG5W...` | Data user |
| `LOG_SHEET_ID` | `1sKpP7...` | Log aktivitas |
| `TRASH_SHEET_ID` | `1UI_66...` | Sampah (soft delete) |
| `DRIVE_FOLDER_ID` | `1UBAZE...` | Folder Google Drive untuk upload file |

## Endpoint (`doGet` / `doPost`)

### `doGet(e)`
- `?action=getProjectData&id=<id>` — Ambil data lengkap satu proyek (lists, tasks, comments, subscribers, users, tags, statuses)
- Tanpa parameter — Ambil semua proyek

### `doPost(e)` — Action yang tersedia:

| Action | Fungsi | File:Line |
|--------|--------|-----------|
| `createProject` | Buat proyek baru | — |
| `createList` | Buat list baru | `appscript.js:350` |
| `updateList` | Update nama/deskripsi/posisi list | `appscript.js:620` |
| `deleteList` | Hapus list (pindah ke trash) | `appscript.js:640` |
| `createTask` | Buat task dengan tag & assignee | `appscript.js:383` |
| `updateTaskStatus` | Ubah status task | `appscript.js:564` |
| `deleteTask` | Hapus task + relasi tag | `appscript.js:425` |
| `createComment` | Tambah komentar | `appscript.js:521` |
| `updateComment` | Edit komentar | `appscript.js:540` |
| `deleteComment` | Hapus komentar | `appscript.js:552` |
| `syncStatuses` | Sinkronisasi status list | `appscript.js:471` |
| `createTag` | Buat tag baru | `appscript.js:93` |
| `updateTag` | Update nama/warna tag | `appscript.js:101` |
| `deleteTag` | Hapus tag + relasi | `appscript.js:118` |
| `createStatus` | Buat status baru | `appscript.js:454` |
| `uploadFile` | Upload file ke Google Drive | `appscript.js:505` |
| `toggleSubscriber` | Subscribe/unsubscribe proyek | `appscript.js:580` |

## Logging & Trash

- **Log:** Semua action (kecuali `uploadFile`) dicatat ke `LOG_SHEET_ID` via `logAction()` (`appscript.js:80`)
- **Trash:** List/task yang dihapus dipindahkan ke `TRASH_SHEET_ID` via `moveToTrash()` (`appscript.js:85`)

## Login Script (`login-script.js`)

- Endpoint terpisah dari `appscript.js`
- Mengecek kredensial di spreadsheet auth (`ssAuthId`)
- Mengambil profil dari spreadsheet profil (`ssProfileId`)
- Mengembalikan `{ status, user: { id, name, email, photo, role } }`

## Keamanan

- `LockService.getScriptLock()` dipakai di `doPost` untuk mencegah race condition
- File Drive di-*share* sebagai `ANYONE_WITH_LINK` saat upload
- Auth guard di client (`auth-guard.js`) memeriksa `localStorage` + Firebase `onAuthStateChanged`
