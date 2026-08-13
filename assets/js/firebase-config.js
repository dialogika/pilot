// assets/js/firebase-config.js
// =====================================================================
// Konfigurasi Firebase TUNGGAL untuk seluruh aplikasi — jangan duplikat
// config ini di file lain. Kalau ganti project/key, cukup ubah di sini.
//
// Project: dialogika-co (CANONICAL / aktif). pre-dialogika = project lama,
// read-only — jangan pernah .set/.update/.delete ke sana.
//
// Cara pakai di halaman:
//   import { db } from "/assets/js/firebase-config.js";
//   import { auth } from "/assets/js/firebase-config.js";
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
