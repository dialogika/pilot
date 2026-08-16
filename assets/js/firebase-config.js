// assets/js/firebase-config.js
// =====================================================================
// Konfigurasi Firebase TUNGGAL untuk seluruh aplikasi — jangan duplikat
// config ini di file lain. Kalau ganti project/key, cukup ubah di sini.
//
// Project: dialogika-co (CANONICAL / aktif). pre-dialogika = project lama,
// read-only — jangan pernah .set/.update/.delete ke sana.
//
// =====================================================================
// LOCAL DEVELOPMENT vs PRODUCTION
// ---------------------------------------------------------------------
// Ada SATU project Firebase: dialogika-co.
//
// Baik LOCAL maupun PRODUCTION memakai layanan Firebase REAL dari project
// dialogika-co (Authentication, Firestore, Storage, Functions).
//
//   - LOCAL   : halaman disajikan oleh Firebase Hosting Emulator
//               (localhost:5000), TAPI semua panggilan Auth/Firestore/
//               Storage/Functions tetap menuju layanan real dialogika-co.
//   - PROD    : halaman disajikan oleh Firebase Hosting asli
//               (team.dialogika.co), memakai layanan real dialogika-co.
//
// TIDAK ada emulator untuk Auth/Firestore/Storage/Functions. Konsekuensi:
// operasi yang dilakukan dari localhost DAPAT memengaruhi data real
// dialogika-co. Hati-hati saat testing — lihat docs/ARCHITECTURE-FOUNDATION.md.
// =====================================================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyDYrzxyQ1oGaVRIdnFfYvjydWZz3xdxpTs",
  authDomain: "dialogika-co.firebaseapp.com",
  projectId: "dialogika-co",
  storageBucket: "dialogika-co.firebasestorage.app",
  messagingSenderId: "664395741941",
  appId: "1:664395741941:web:f20ff01c166e4423d823bc"
};

// Guard supaya tidak initializeApp dua kali kalau file ini di-import di banyak halaman/komponen.
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
// Region default us-central1, sesuai deploy setUserRole/setQuestDifficulty/resetMonthlyScore/cleanupOldNotifications.
export const functions = getFunctions(app);

// CATATAN: tidak ada koneksi emulator apa pun di file ini.
// SDK memakai layanan real dialogika-co di semua environment (local maupun prod).