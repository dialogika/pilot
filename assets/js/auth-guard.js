// assets/js/auth-guard.js
// =====================================================================
// Guard WAJIB dipanggil di SETIAP halaman internal (team.dialogika.co).
// Versi baru: role dibaca dari CUSTOM CLAIM (bukan field dokumen users),
// sesuai firestore.rules yang membaca request.auth.token.role.
//
// Role valid (7 tier, UPDATE 2026-08-11):
//   owner | admin | team | staff | intern | mentor | member
//
// Cara pakai di halaman:
//   <script type="module">
//     import { requireAuth } from "/assets/js/auth-guard.js";
//     const { user, role } = await requireAuth();
//     // lanjut render halaman pakai `role` untuk tentukan menu/akses
//   </script>
// =====================================================================

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

const LOGIN_PATH = "/login";
const VALID_ROLES = ["owner", "admin", "team", "staff", "intern", "mentor", "member"];

/**
 * Tunggu status auth siap, wajib login, kembalikan { user, role }.
 * Kalau belum login -> redirect ke halaman login.
 * Membaca role dari Custom Claim dan tersinkronisasi dengan Firestore users doc.
 */
export function requireAuth() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        localStorage.removeItem("userData");
        window.location.href = LOGIN_PATH;
        return;
      }

      const tokenResult = await user.getIdTokenResult();
      let role = tokenResult.claims?.role || null;

      // Sinkronisasi dengan Firestore users doc (role / access.role_id)
      try {
        const uSnap = await getDoc(doc(db, "users", user.uid));
        if (uSnap.exists()) {
          const uData = uSnap.data() || {};
          const docRole = uData.role || uData.access?.role_id;
          if (docRole && VALID_ROLES.includes(String(docRole).toLowerCase())) {
            role = String(docRole).toLowerCase();
          }
        }
      } catch (_) {}

      if (!role || !VALID_ROLES.includes(role)) {
        renderNoRoleError();
        return;
      }

      resolve({ user, role });
    });
  });
}

/** Ambil role user yang sedang login (tanpa blocking redirect). Return null kalau belum login. */
export async function getCurrentRole() {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    const tokenResult = await user.getIdTokenResult();
    let role = tokenResult.claims?.role || null;
    try {
      const uSnap = await getDoc(doc(db, "users", user.uid));
      if (uSnap.exists()) {
        const uData = uSnap.data() || {};
        const docRole = uData.role || uData.access?.role_id;
        if (docRole && VALID_ROLES.includes(String(docRole).toLowerCase())) {
          role = String(docRole).toLowerCase();
        }
      }
    } catch (_) {}
    return role;
  } catch (e) {
    return null;
  }
}

function renderNoRoleError() {
  document.body.innerHTML = `
    <div class="d-flex align-items-center justify-content-center vh-100 p-4">
      <div class="text-center" style="max-width: 420px;">
        <h4 class="mb-3">Akun kamu belum punya role</h4>
        <p class="text-body-secondary">Hubungi owner/admin untuk mengaktifkan akses akunmu. Kalau role kamu baru saja diubah, coba logout lalu login lagi dulu.</p>
        <button id="btn-logout" class="btn btn-outline-secondary">Logout</button>
      </div>
    </div>`;
  document.getElementById("btn-logout").addEventListener("click", () => {
    localStorage.removeItem("userData");
    signOut(auth).then(() => (window.location.href = LOGIN_PATH));
  });
}

/** Helper logout dipakai tombol logout di sidebar/topbar. */
export function logout() {
  localStorage.removeItem("userData");
  return signOut(auth).then(() => (window.location.href = LOGIN_PATH));
}
