---
title: Database Mapping & ERD - Mentor Management
author: Dialogika Tech Team
date: 2026-10-03
tags:
  - database
  - erd
  - mentor-management
  - classes
  - schedules
  - schema
  - pilot-dialogika
status: proposal
type: technical-documentation
---

# 🧑‍🏫 Database Mapping & ERD — Mentor Management (Dialogika)

> [!INFO] **Ringkasan Dokumen**
> Dokumen ini memetakan rancangan database relasional (*Data Dictionary & Entity Relationship Diagram*) untuk modul **Mentor Management** pada platform internal Dialogika (`pilot.dialogika.co/mentor-management`).
> Modul ini mencakup pengelolaan profil pelatih (*Master Coach / Trainer*), penugasan batch kelas yang diampu (*Classes Assigned*), jadwal sesi mengajar (*Teaching Schedules*), serta daftar siswa bimbingan dalam kelas (*Mentored Students*).

---

## 1. Visual Entity Relationship Diagram (ERD)

Diagram berikut merepresentasikan relasi antara master mentor, batch kelas yang diampu, sesi jadwal mengajar, dan peserta bimbingan:

```mermaid
erDiagram
    mentors ||--o{ classes : "teaches (1:N)"
    classes ||--o{ class_schedules : "has sessions (1:N)"
    classes ||--o{ class_members : "contains students (1:N)"

    mentors {
        varchar(50) id PK "ID Mentor (ex: MTR-001)"
        varchar(150) full_name "Nama Lengkap Coach"
        varchar(20) phone_whatsapp "Nomor WhatsApp Mentor"
        varchar(100) email "Email Resmi Mentor"
        varchar(150) specialization "Bidang Keahlian / Silabus"
        enum teaching_type "Online / Offline / Both"
        enum status "active / inactive"
        timestamp created_at "Waktu Registrasi Mentor"
    }

    classes {
        varchar(50) id PK "Kode Kelas (ex: CLS-BP03-202610)"
        varchar(50) mentor_id FK "➔ mentors.id"
        varchar(50) product_id FK "➔ products.id"
        varchar(150) name "Nama Batch Kelas"
        enum type "Online / Offline / Hybrid"
        int max_capacity "Kapasitas Maksimal (10)"
        date start_date "Tanggal Mulai Sesi 1"
        date end_date "Tanggal Penutupan Batch"
        enum status "open / ongoing / completed / cancelled"
        timestamp created_at "Waktu Buat Kelas"
    }

    class_schedules {
        int id PK "Auto Increment"
        varchar(50) class_id FK "➔ classes.id"
        varchar(10) session_order "Urutan Sesi (Sesi 01, Sesi 02)"
        varchar(255) topic_title "Materi Sesi Mengajar"
        date schedule_date "Tanggal Mengajar"
        time start_time "Jam Mulai (WIB)"
        time end_time "Jam Selesai (WIB)"
        varchar(255) meeting_url "Link Ruang Zoom Host"
        enum status "scheduled / completed / rescheduled"
        timestamp created_at "Waktu Input Jadwal"
    }

    class_members {
        int id PK "Auto Increment"
        varchar(50) class_id FK "➔ classes.id"
        varchar(50) member_id FK "➔ members.id"
        timestamp enrollment_date "Waktu Masuk Kelas"
        enum payment_status "paid / dp / unpaid"
        enum status "active / graduated / dropped"
    }
```

---

## 2. Matriks Relasi Antar Tabel (Foreign Key Integrity)

| Tabel Induk (Parent) | Kardinalitas | Tabel Anak (Child) | Kunci Penghubung | Aturan Delete / Update | Deskripsi Hubungan Bisnis |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `mentors (id)` | **1 : N** | `classes` | `mentor_id ➔ mentors.id` | **ON DELETE RESTRICT** | 1 mentor dapat mengampu banyak batch kelas. Data mentor tidak boleh dihapus jika masih ada kelas aktif yang diampu. |
| `classes (id)` | **1 : N** | `class_schedules` | `class_id ➔ classes.id` | **ON DELETE CASCADE** | 1 batch kelas memiliki jadwal sesi belajar berulang yang dipandu oleh mentor. |
| `classes (id)` | **1 : N** | `class_members` | `class_id ➔ classes.id` | **ON DELETE CASCADE** | 1 batch kelas menampung hingga 10 siswa yang dimentori secara intensif. |

---

## 3. Kamus Data (Data Dictionary)

### 3.1. Tabel `mentors` (Master Trainer / Coach)
- **Tujuan**: Menyimpan data profil resmi pelatih, ketersediaan mengajar, dan spesialisasi keilmuan.
- **Primary Key**: `id` (`VARCHAR(50)`)

| Nama Kolom | Tipe Data | Nullable | Default | Deskripsi | Contoh Nilai |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(50)` | NO | - | Primary Key format kode unik mentor | `"MTR-001"` |
| `full_name` | `VARCHAR(150)` | NO | - | Nama lengkap beserta gelar mentor | `"Coach Budi Prasetyo, M.I.Kom"` |
| `phone_whatsapp` | `VARCHAR(20)` | NO | - | Nomor WhatsApp format internasional | `"6281987654321"` |
| `email` | `VARCHAR(100)` | YES | NULL | Alamat email resmi mentor | `"budi.coach@dialogika.co"` |
| `specialization` | `VARCHAR(150)` | NO | - | Spesialisasi program bimbingan | `"Public Speaking & Voice Mastery"` |
| `teaching_type` | `ENUM('Online','Offline','Both')` | NO | `'Online'` | Ketersediaan moda mengajar | `'Both'` |
| `status` | `ENUM('active','inactive')` | NO | `'active'` | Status kontrak mentor | `'active'` |
| `created_at` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Waktu bergabung pertama kali | `2026-10-01 08:30:00` |

---

### 3.2. Tabel `classes` (Master Batch Kelas yang Diampu)
- **Tujuan**: Menyimpan batch kelas yang ditugaskan kepada mentor.
- **Primary Key**: `id` (`VARCHAR(50)`)

| Nama Kolom | Tipe Data | Nullable | Default | Deskripsi | Contoh Nilai |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(50)` | NO | - | Kode batch unik kelas | `"CLS-BP03-202610"` |
| `mentor_id` | `VARCHAR(50)` | NO | - | FK merujuk ke `mentors.id` (RESTRICT) | `"MTR-001"` |
| `product_id` | `VARCHAR(50)` | NO | - | FK merujuk ke `products.id` | `"BP-LVL-03"` |
| `name` | `VARCHAR(150)` | NO | - | Nama batch program kelas | `"Basic Plus Level 3 - Batch Oktober"` |
| `type` | `ENUM('Online','Offline','Hybrid')` | NO | `'Online'` | Moda pelaksanaan kelas | `'Online'` |
| `max_capacity` | `INT(11)` | NO | `10` | Batas kapasitas maksimal siswa | `10` |
| `start_date` | `DATE` | NO | - | Tanggal sesi perdana mengajar | `2026-10-15` |
| `end_date` | `DATE` | NO | - | Tanggal sesi kelulusan batch | `2026-11-15` |
| `status` | `ENUM('open','ongoing','completed','cancelled')` | NO | `'open'` | Status operasional kelas | `'open'` |
| `created_at` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Waktu data batch dibuat | `2026-10-03 10:00:00` |

---

### 3.3. Tabel `class_schedules` (Jadwal Sesi Mengajar)
- **Tujuan**: Jadwal kalender tatap muka dan link room kelas bagi mentor.
- **Primary Key**: `id` (`INT(11) AUTO_INCREMENT`)

| Nama Kolom | Tipe Data | Nullable | Default | Deskripsi | Contoh Nilai |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INT(11)` | NO | AUTO_INC | ID unik baris sesi | `501` |
| `class_id` | `VARCHAR(50)` | NO | - | FK merujuk ke `classes.id` | `"CLS-BP03-202610"` |
| `session_order` | `VARCHAR(10)` | NO | - | Nomor urutan pertemuan sesi | `"Sesi 01"` |
| `topic_title` | `VARCHAR(255)` | NO | - | Judul modul materi yang diajarkan | `"Overcoming Speech Anxiety"` |
| `schedule_date` | `DATE` | NO | - | Tanggal pertemuan mengajar | `2026-10-18` |
| `start_time` | `TIME` | NO | - | Jam mulai sesi | `19:30:00` |
| `end_time` | `TIME` | NO | - | Jam selesai sesi | `21:00:00` |
| `meeting_url` | `VARCHAR(255)` | YES | NULL | Link ruang Zoom Host / Google Meet | `"https://zoom.us/j/9876543210"` |
| `status` | `ENUM('scheduled','completed','rescheduled')` | NO | `'scheduled'` | Status pelaksanaan sesi | `'scheduled'` |
| `created_at` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Waktu baris jadwal dibuat | `2026-10-03 10:00:00` |

---

### 3.4. Tabel `class_members` (Siswa Bimbingan dalam Kelas Mentor)
- **Tujuan**: Daftar peserta bimbingan yang terdaftar pada kelas yang diampu mentor.
- **Primary Key**: `id` (`INT(11) AUTO_INCREMENT`)

| Nama Kolom | Tipe Data | Nullable | Default | Deskripsi | Contoh Nilai |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INT(11)` | NO | AUTO_INC | Primary Key unik peserta | `101` |
| `class_id` | `VARCHAR(50)` | NO | - | FK merujuk ke `classes.id` | `"CLS-BP03-202610"` |
| `member_id` | `VARCHAR(50)` | NO | - | FK merujuk ke `members.id` | `"MBR-2026-0042"` |
| `enrollment_date` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Waktu siswa bergabung kelas | `2026-10-03 11:30:00` |
| `payment_status` | `ENUM('paid','dp','unpaid')` | NO | `'paid'` | Status administrasi siswa | `'paid'` |
| `status` | `ENUM('active','graduated','dropped')` | NO | `'active'` | Status keikutsertaan bimbingan | `'active'` |

---

## 4. Script MySQL DDL (Production Ready)

```sql
-- =======================================================
-- DIALOGIKA: MENTOR MANAGEMENT, CLASSES & SCHEDULES DDL
-- =======================================================

-- 1. TABEL MASTER MENTOR: mentors
CREATE TABLE IF NOT EXISTS `mentors` (
  `id` VARCHAR(50) NOT NULL,
  `full_name` VARCHAR(150) NOT NULL,
  `phone_whatsapp` VARCHAR(20) NOT NULL,
  `email` VARCHAR(100) NULL,
  `specialization` VARCHAR(150) NOT NULL,
  `teaching_type` ENUM('Online', 'Offline', 'Both') NOT NULL DEFAULT 'Online',
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. TABEL MASTER BATCH KELAS: classes
CREATE TABLE IF NOT EXISTS `classes` (
  `id` VARCHAR(50) NOT NULL,
  `product_id` VARCHAR(50) NOT NULL,
  `mentor_id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `type` ENUM('Online', 'Offline', 'Hybrid') NOT NULL DEFAULT 'Online',
  `max_capacity` INT(11) NOT NULL DEFAULT 10,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `status` ENUM('open', 'ongoing', 'completed', 'cancelled') NOT NULL DEFAULT 'open',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_classes_mentor` (`mentor_id`),
  CONSTRAINT `fk_classes_mentor` FOREIGN KEY (`mentor_id`)
    REFERENCES `mentors` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. TABEL PENJADWALAN SESI KELAS: class_schedules
CREATE TABLE IF NOT EXISTS `class_schedules` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `class_id` VARCHAR(50) NOT NULL,
  `session_order` VARCHAR(10) NOT NULL,
  `topic_title` VARCHAR(255) NOT NULL,
  `schedule_date` DATE NOT NULL,
  `start_time` TIME NOT NULL,
  `end_time` TIME NOT NULL,
  `meeting_url` VARCHAR(255) NULL,
  `status` ENUM('scheduled', 'completed', 'rescheduled') NOT NULL DEFAULT 'scheduled',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_schedules_class` (`class_id`),
  CONSTRAINT `fk_schedules_class` FOREIGN KEY (`class_id`)
    REFERENCES `classes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. TABEL PESERTA DALAM KELAS BIMBINGAN: class_members
CREATE TABLE IF NOT EXISTS `class_members` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `class_id` VARCHAR(50) NOT NULL,
  `member_id` VARCHAR(50) NOT NULL,
  `enrollment_date` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `payment_status` ENUM('paid', 'dp', 'unpaid') NOT NULL DEFAULT 'paid',
  `status` ENUM('active', 'graduated', 'dropped') NOT NULL DEFAULT 'active',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_class_member` (`class_id`, `member_id`),
  INDEX `idx_class_members_class` (`class_id`),
  CONSTRAINT `fk_class_members_class` FOREIGN KEY (`class_id`)
    REFERENCES `classes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 5. Referensi Modul Terkait

Sesuai pembagian domain arsitektur Dialogika:
- **Product Management (Katalog Produk & Silabus):** Lihat [PRODUCT-DATABASE-MAPPING.md](file:///d:/MAGANG/pilot/docs/PRODUCT-DATABASE-MAPPING.md)
- **Member Data (Peserta & Pendaftaran Kelas):** Lihat [MEMBER-DATABASE-MAPPING.md](file:///d:/MAGANG/pilot/docs/MEMBER-DATABASE-MAPPING.md)
