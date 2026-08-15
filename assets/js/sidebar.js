// assets/js/sidebar.js
// =====================================================================
// Komponen sidebar reusable — satu sumber navigasi untuk semua halaman,
// supaya menu tidak ditulis ulang manual di tiap file .html.
//
// Role valid (7 tier, UPDATE 2026-08-11):
//   owner | admin | team | staff | intern | mentor | member
// Asumsi akses (sesuai UPDATE §1, perlu konfirmasi Ron):
//   - owner/admin/team (isManagement) melihat semua menu.
//   - admin tidak bisa mengedit role owner (ditangani di sisi backend).
//   - staff/intern/mentor/member melihat menu sesuai peran.
//
// CATATAN KE DEPAN (Tools Management, New Update.pdf): menu seharusnya
// didorong oleh data roles/{roleId}.visible_tools. Struktur MENU_BY_ROLE
// statis ini dipakai dulu sebagai fondasi; nanti diganti/digabung dengan
// pembacaan visible_tools + koleksi `tools` tanpa mengubah API renderSidebar.
//
// Cara pakai di halaman:
//   <div id="dg-sidebar-mount"></div>
//   <script type="module">
//     import { renderSidebar } from "/assets/js/sidebar.js";
//     renderSidebar({ role, activePage: "dashboard" });
//   </script>
// =====================================================================

import { logout } from "./auth-guard.js";

// Menu per role. Tambah role baru = tambah key baru di sini, TIDAK perlu
// ubah HTML di halaman manapun.
const MENU_BY_ROLE = {
  owner: [
    { section: "Utama" },
    { id: "dashboard", label: "Home", href: "/home", icon: "bi-house" },
    { id: "my-tasks", label: "My Tasks", href: "/quest", icon: "bi-check2-square" },
    { id: "activity", label: "Activity", href: "/quest", icon: "bi-clock-history" },
    { id: "projects", label: "Projects", href: "/project/list.html", icon: "bi-folder2-open" },
    { section: "Divisi" },
    { id: "closing", label: "Closing", href: "/data/leads-inbox.html", icon: "bi-graph-up" },
    { id: "happy", label: "Happy / HR", href: "/data/presence-team.html", icon: "bi-people" },
    { id: "branding", label: "Branding", href: "/data/branding-schedule.html", icon: "bi-megaphone" },
    { id: "rebuy", label: "Rebuy / Kelas", href: "/setting/class-planning.html", icon: "bi-arrow-repeat" },
    { section: "Quest" },
    { id: "recruitment", label: "Recruitment", href: "/quest/dashboard-recruitment.html", icon: "bi-person-plus" },
    { id: "people-dev", label: "People Dev", href: "/quest/dashboard-people-dev.html", icon: "bi-person-badge" },
    { section: "Sistem" },
    { id: "users", label: "User Management", href: "/setting/users-management.html", icon: "bi-person-gear" },
    { id: "tools", label: "Tools Management", href: "/setting/tools-management.html", icon: "bi-toggle-on" },
    { id: "components", label: "Component", href: "/setting/component-management.html", icon: "bi-palette" },
  ],
  admin: [
    { section: "Utama" },
    { id: "dashboard", label: "Home", href: "/home", icon: "bi-house" },
    { id: "my-tasks", label: "My Tasks", href: "/quest", icon: "bi-check2-square" },
    { id: "activity", label: "Activity", href: "/quest", icon: "bi-clock-history" },
    { id: "projects", label: "Projects", href: "/project/list.html", icon: "bi-folder2-open" },
    { section: "Divisi" },
    { id: "closing", label: "Closing", href: "/data/leads-inbox.html", icon: "bi-graph-up" },
    { id: "happy", label: "Happy / HR", href: "/data/presence-team.html", icon: "bi-people" },
    { id: "branding", label: "Branding", href: "/data/branding-schedule.html", icon: "bi-megaphone" },
    { id: "rebuy", label: "Rebuy / Kelas", href: "/setting/class-planning.html", icon: "bi-arrow-repeat" },
    { section: "Quest" },
    { id: "recruitment", label: "Recruitment", href: "/quest/dashboard-recruitment.html", icon: "bi-person-plus" },
    { id: "people-dev", label: "People Dev", href: "/quest/dashboard-people-dev.html", icon: "bi-person-badge" },
    { section: "Sistem" },
    { id: "users", label: "User Management", href: "/setting/users-management.html", icon: "bi-person-gear" },
    { id: "tools", label: "Tools Management", href: "/setting/tools-management.html", icon: "bi-toggle-on" },
    { id: "components", label: "Component", href: "/setting/component-management.html", icon: "bi-palette" },
  ],
  team: [
    { section: "Utama" },
    { id: "dashboard", label: "Home", href: "/home", icon: "bi-house" },
    { id: "my-tasks", label: "My Tasks", href: "/quest", icon: "bi-check2-square" },
    { id: "activity", label: "Activity", href: "/quest", icon: "bi-clock-history" },
    { id: "projects", label: "Projects", href: "/project/list.html", icon: "bi-folder2-open" },
    { section: "Divisi" },
    { id: "closing", label: "Closing", href: "/data/leads-inbox.html", icon: "bi-graph-up" },
    { id: "happy", label: "Happy / HR", href: "/data/presence-team.html", icon: "bi-people" },
    { id: "branding", label: "Branding", href: "/data/branding-schedule.html", icon: "bi-megaphone" },
    { id: "rebuy", label: "Rebuy / Kelas", href: "/setting/class-planning.html", icon: "bi-arrow-repeat" },
    { section: "Quest" },
    { id: "recruitment", label: "Recruitment", href: "/quest/dashboard-recruitment.html", icon: "bi-person-plus" },
    { id: "people-dev", label: "People Dev", href: "/quest/dashboard-people-dev.html", icon: "bi-person-badge" },
    { section: "Sistem" },
    { id: "users", label: "User Management", href: "/setting/users-management.html", icon: "bi-person-gear" },
    { id: "tools", label: "Tools Management", href: "/setting/tools-management.html", icon: "bi-toggle-on" },
  ],
  staff: [
    { section: "Utama" },
    { id: "dashboard", label: "Home", href: "/home", icon: "bi-house" },
    { id: "my-tasks", label: "My Tasks", href: "/quest", icon: "bi-check2-square" },
    { id: "projects", label: "Projects", href: "/project/list.html", icon: "bi-folder2-open" },
    { section: "Divisi" },
    { id: "closing", label: "Closing", href: "/data/leads-inbox.html", icon: "bi-graph-up" },
    { id: "happy", label: "Happy / HR", href: "/data/presence-team.html", icon: "bi-people" },
    { id: "branding", label: "Branding", href: "/data/branding-schedule.html", icon: "bi-megaphone" },
    { id: "rebuy", label: "Rebuy / Kelas", href: "/setting/class-planning.html", icon: "bi-arrow-repeat" },
  ],
  intern: [
    { section: "Utama" },
    { id: "dashboard", label: "Home", href: "/home", icon: "bi-house" },
    { id: "my-tasks", label: "My Tasks", href: "/quest", icon: "bi-check2-square" },
    { id: "presensi", label: "Presensi", href: "/presence.html", icon: "bi-calendar-check" },
    { id: "daily-report", label: "Daily Report", href: "/quest", icon: "bi-journal-text" },
  ],
  mentor: [
    { section: "Utama" },
    { id: "dashboard", label: "Home", href: "/home", icon: "bi-house" },
    { id: "schedule", label: "Jadwal Mengajar", href: "/quest", icon: "bi-calendar-week" },
    { id: "my-classes", label: "Kelas Saya", href: "/setting/class-detail.html", icon: "bi-easel" },
    { id: "payment", label: "Status Fee", href: "/personal/profile.html", icon: "bi-wallet2" },
  ],
  member: [
    { section: "Utama" },
    { id: "dashboard", label: "Home", href: "/home", icon: "bi-house" },
    { id: "my-classes", label: "Kelas Saya", href: "/data/member-data.html", icon: "bi-easel" },
    { id: "certificate", label: "Sertifikat", href: "/setting/generate-certificate.html", icon: "bi-award" },
  ],
};

/**
 * Render sidebar ke elemen #dg-sidebar-mount.
 * @param {{ role: string, activePage: string }} opts
 */
export function renderSidebar({ role, activePage }) {
  const mount = document.getElementById("dg-sidebar-mount");
  if (!mount) return;

  const items = MENU_BY_ROLE[role] || [];
  const itemsHtml = items
    .map((item) => {
      if (item.section) {
        return `<div class="nav-section-label">${item.section}</div>`;
      }
      const active = item.id === activePage ? "active" : "";
      return `<a href="${item.href}" class="nav-link d-flex align-items-center gap-2 ${active}">
                <i class="bi ${item.icon}"></i> <span>${item.label}</span>
              </a>`;
    })
    .join("");

  mount.innerHTML = `
    <aside class="dg-sidebar" id="dg-sidebar">
      <div class="d-flex align-items-center gap-2 mb-3 px-2">
        <strong class="fs-5">DIALOGIKA</strong>
      </div>
      <nav class="nav flex-column">${itemsHtml}</nav>
      <div class="mt-auto pt-3 px-2">
        <button id="dg-btn-logout" class="btn btn-sm btn-outline-light w-100">
          <i class="bi bi-box-arrow-right"></i> Logout
        </button>
      </div>
    </aside>`;

  document.getElementById("dg-btn-logout").addEventListener("click", logout);
}
