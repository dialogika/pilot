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
// Ada SATU project Firebase: dialogika-co. Environment tidak ditentukan
// oleh project ID, melainkan oleh apakah aplikasi berjalan di LOCALHOST.
//
//   - LOCAL  : window.location.hostname == "localhost" / "127.0.0.1"
//              → SDK dihubungkan ke Firebase Emulator Suite
//                (Auth 9099, Firestore 8080, Storage 9199, Functions 5001)
//   - PROD   : hostname domain publik (team.dialogika.co / *.firebaseapp.com)
//              → SDK memakai layanan production dialogika-co
//
// Jika halaman dibuka di localhost, semua panggilan Auth/Firestore/Storage/
// Functions DIARAHKAN ke emulator lokal, BUKAN ke production.
// =====================================================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, connectStorageEmulator } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getFunctions, connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyDYrzxyQ1oGaVRIdnFfYvjydWZz3xdxpTs",
  authDomain: "dialogika-co.firebaseapp.com",
  projectId: "dialogika-co",
  storageBucket: "dialogika-co.firebasestorage.app",
  messagingSenderId: "664395741941",
  appId: "1:664395741941:web:f20ff01c166e4423d823bc"
};

// Detect local development by hostname. Keeps the code simple and explicit.
const host = window.location.hostname;
export const IS_LOCAL_DEV = host === "localhost" || host === "127.0.0.1";

// Guard supaya tidak initializeApp dua kali kalau file ini di-import di banyak halaman/komponen.
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
// Region default us-central1, sesuai deploy setUserRole/setQuestDifficulty/resetMonthlyScore/cleanupOldNotifications.
export const functions = getFunctions(app);

// Connect to the Emulator Suite ONLY when running locally.
// In production (custom domain) these lines are skipped → production services are used.
if (IS_LOCAL_DEV) {
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "localhost", 8080);
  connectStorageEmulator(storage, "localhost", 9199);
  // NOTE: tidak ada source code Functions di repo ini. Baris ini mengarahkan
  // panggilan Functions ke port emulator lokal supaya TIDAK pernah jatuh ke
  // production. Karena emulator Functions tidak dijalankan, panggilan callable
  // akan gagal secara lokal (aman), bukan memanggil production.
  connectFunctionsEmulator(functions, "localhost", 5001);
}