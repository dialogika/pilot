---
title: Database Mapping & ERD - Class Management
description: Dokumentasi arsitektur database relasional, skema ERD, kamus data (data dictionary), dan script DDL SQL untuk modul Class Management Dialogika.
category: Architecture & Database Design
tags:
  - database
  - erd
  - class-management
  - schema
  - mysql
  - relational-model
author: Dialogika AI & Core Architecture Team
version: 1.0.0
last_updated: 2026-10-03
---

# 📚 Database Mapping & ERD — Class Management (Dialogika)

> Dokumen ini memetakan rancangan database relasional (*Data Dictionary & Entity Relationship Diagram*) untuk modul **Class Management** pada platform Dialogika (`pilot.dialogika.co/class-management`).
> Arsitektur mengisolasi master batch kelas, sesi pertemuan, coach pengampu, dan siswa pendaftar ke dalam **4 tabel normalisasi (3NF)** demi integritas data dan performa query.

---

## 1. Arsitektur Relasi Tabel (Entity Relationship Overview)

Modul Class Management mengorkestrasikan kegiatan belajar mengajar dengan tabel induk **`classes`** (batch kelas):

```
       ┌────────────────────────┐
       │   mentors (Master)     │
       │   PK: id               │
       └───────────┬────────────┘
                   │
                   │ 1 : N (mentor_id)
                   ▼
       ┌────────────────────────┐
       │   classes (Batch Induk)│
       │   PK: id               │
       └───┬────────────────┬───┘
           │                │
    1 : N  │ (class_id)     │ 1 : N (class_id)
           ▼                ▼
┌──────────────────────┐ ┌──────────────────────┐
│  class_schedules     │ │  class_members       │
│  PK: id              │ │  PK: id              │
│  FK: class_id        │ │  FK: class_id        │
└──────────────────────┘ └──────────────────────┘
```

---

## 2. Kamus Data (Data Dictionary)

### 2.1. Tabel `classes` (Master Batch Kelas)
| No | Field Name | Data Type | Key | Null | Default | Keterangan / Deskripsi |
|---|---|---|---|---|---|---|
| 1 | `id` | VARCHAR(50) | **PK** | NO | - | ID unik kelas (contoh: `CLS-2026-042`) |
| 2 | `class_name` | VARCHAR(150) | - | NO | - | Nama batch kelas (contoh: `Basic Play Batch 42`) |
| 3 | `class_status`| ENUM(...) | - | NO | 'Soon' | Status: `Soon`, `Running`, `Reminder`, `Stall`, `Graduate`, `Complete` |
| 4 | `class_type` | ENUM(...) | - | NO | 'Offline' | Metode pelaksanaan: `Offline`, `Online`, `Hybrid` |
| 5 | `location` | VARCHAR(150) | - | YES | NULL | Lokasi venue / cabang pelaksanaan kelas |
| 6 | `start_date` | DATE | - | YES | NULL | Tanggal sesi perdana / kelas dimulai |
| 7 | `meeting_total`| INT | - | NO | 8 | Target jumlah sesi pertemuan dalam program |
| 8 | `meeting_done` | INT | - | NO | 0 | Jumlah sesi pertemuan yang telah diselesaikan |
| 9 | `mentor_id` | VARCHAR(50) | **FK** | YES | NULL | Relasi ke `mentors.id` (coach utama penanggung jawab) |
| 10 | `created_at` | TIMESTAMP | - | NO | CURRENT_TIMESTAMP | Waktu pencatatan kelas |

### 2.2. Tabel `class_schedules` (Jadwal Pertemuan / Sesi)
| No | Field Name | Data Type | Key | Null | Default | Keterangan / Deskripsi |
|---|---|---|---|---|---|---|
| 1 | `id` | VARCHAR(50) | **PK** | NO | - | ID unik jadwal pertemuan (contoh: `SCH-2026-0891`) |
| 2 | `class_id` | VARCHAR(50) | **FK** | NO | - | Relasi ke `classes.id` (ON DELETE CASCADE) |
| 3 | `meeting_no` | INT | - | NO | 1 | Nomor sesi pertemuan (1, 2, s/d `meeting_total`) |
| 4 | `schedule_date`| DATE | - | NO | - | Tanggal pertemuan |
| 5 | `start_time` | TIME | - | NO | - | Jam mulai sesi |
| 6 | `end_time` | TIME | - | NO | - | Jam selesai sesi |
| 7 | `topic` | VARCHAR(200) | - | YES | NULL | Judul topik silabus yang diajarkan pada sesi ini |
| 8 | `mentor_id` | VARCHAR(50) | **FK** | YES | NULL | Coach yang memandu sesi (default ke coach kelas) |

### 2.3. Tabel `mentors` (Master Coach & Pengajar)
| No | Field Name | Data Type | Key | Null | Default | Keterangan / Deskripsi |
|---|---|---|---|---|---|---|
| 1 | `id` | VARCHAR(50) | **PK** | NO | - | ID unik mentor (contoh: `MTR-2026-0012`) |
| 2 | `full_name` | VARCHAR(150) | - | NO | - | Nama lengkap mentor beserta gelar |
| 3 | `nick_name` | VARCHAR(50) | - | YES | NULL | Nama panggilan |
| 4 | `phone_whatsapp`| VARCHAR(20)| - | NO | - | Nomor WhatsApp aktif untuk koordinasi jadwal |
| 5 | `rating` | DECIMAL(3,2)| - | NO | 5.00 | Rating kepuasan mengajar mentor |
| 6 | `status` | ENUM(...) | - | NO | 'active' | Status: `active`, `inactive`, `on_leave` |

### 2.4. Tabel `class_members` (Siswa Pendaftar Batch)
| No | Field Name | Data Type | Key | Null | Default | Keterangan / Deskripsi |
|---|---|---|---|---|---|---|
| 1 | `id` | VARCHAR(50) | **PK** | NO | - | ID pendaftaran (contoh: `ENR-2026-0156`) |
| 2 | `class_id` | VARCHAR(50) | **FK** | NO | - | Relasi ke `classes.id` (ON DELETE CASCADE) |
| 3 | `member_id` | VARCHAR(50) | **FK** | NO | - | Relasi ke `members.id` (siswa terdaftar) |
| 4 | `enrolled_at` | TIMESTAMP | - | NO | CURRENT_TIMESTAMP | Tanggal siswa resmi masuk batch kelas |
| 5 | `attendance_rate`| DECIMAL(5,2)| -| NO | 100.00 | Persentase absensi kehadiran siswa |
| 6 | `payment_status`| ENUM(...) | - | NO | 'Lunas' | Status: `DP`, `Lunas`, `Pending` |

---

## 3. SQL DDL Implementation

```sql
-- =======================================================
-- DIALOGIKA: CLASS MANAGEMENT & SCHEDULE MAPPING DDL
-- =======================================================

-- 1. TABEL MASTER MENTOR: mentors
CREATE TABLE IF NOT EXISTS `mentors` (
  `id` VARCHAR(50) NOT NULL,
  `full_name` VARCHAR(150) NOT NULL,
  `nick_name` VARCHAR(50) NULL,
  `phone_whatsapp` VARCHAR(20) NOT NULL,
  `rating` DECIMAL(3, 2) NOT NULL DEFAULT 5.00,
  `status` ENUM('active', 'inactive', 'on_leave') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. TABEL MASTER BATCH KELAS: classes
CREATE TABLE IF NOT EXISTS `classes` (
  `id` VARCHAR(50) NOT NULL,
  `class_name` VARCHAR(150) NOT NULL,
  `class_status` ENUM('Soon', 'Running', 'Reminder', 'Stall', 'Graduate', 'Complete') NOT NULL DEFAULT 'Soon',
  `class_type` ENUM('Offline', 'Online', 'Hybrid') NOT NULL DEFAULT 'Offline',
  `location` VARCHAR(150) NULL,
  `start_date` DATE NULL,
  `meeting_total` INT NOT NULL DEFAULT 8,
  `meeting_done` INT NOT NULL DEFAULT 0,
  `mentor_id` VARCHAR(50) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_classes_status` (`class_status`),
  KEY `idx_classes_mentor` (`mentor_id`),
  CONSTRAINT `fk_classes_mentor` FOREIGN KEY (`mentor_id`) 
    REFERENCES `mentors` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. TABEL JADWAL SESI PERTEMUAN: class_schedules
CREATE TABLE IF NOT EXISTS `class_schedules` (
  `id` VARCHAR(50) NOT NULL,
  `class_id` VARCHAR(50) NOT NULL,
  `meeting_no` INT NOT NULL DEFAULT 1,
  `schedule_date` DATE NOT NULL,
  `start_time` TIME NOT NULL,
  `end_time` TIME NOT NULL,
  `topic` VARCHAR(200) NULL,
  `mentor_id` VARCHAR(50) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_schedules_class` (`class_id`),
  KEY `idx_schedules_date` (`schedule_date`),
  CONSTRAINT `fk_schedules_class` FOREIGN KEY (`class_id`) 
    REFERENCES `classes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_schedules_mentor` FOREIGN KEY (`mentor_id`) 
    REFERENCES `mentors` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. TABEL SISWA PENDAFTAR BATCH: class_members
CREATE TABLE IF NOT EXISTS `class_members` (
  `id` VARCHAR(50) NOT NULL,
  `class_id` VARCHAR(50) NOT NULL,
  `member_id` VARCHAR(50) NOT NULL,
  `enrolled_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `attendance_rate` DECIMAL(5, 2) NOT NULL DEFAULT 100.00,
  `payment_status` ENUM('DP', 'Lunas', 'Pending') NOT NULL DEFAULT 'Lunas',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_class_member` (`class_id`, `member_id`),
  KEY `idx_enrollment_class` (`class_id`),
  KEY `idx_enrollment_member` (`member_id`),
  CONSTRAINT `fk_enrollment_class` FOREIGN KEY (`class_id`) 
    REFERENCES `classes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 4. Hubungan Antar Modul

- **Product Management:** Lihat [PRODUCT-DATABASE-MAPPING.md](file:///d:/MAGANG/pilot/docs/PRODUCT-DATABASE-MAPPING.md)
- **Member Data:** Lihat [MEMBER-DATABASE-MAPPING.md](file:///d:/MAGANG/pilot/docs/MEMBER-DATABASE-MAPPING.md)
- **Mentor Management:** Lihat [MENTOR-DATABASE-MAPPING.md](file:///d:/MAGANG/pilot/docs/MENTOR-DATABASE-MAPPING.md)
