// assets/js/components/topbar/topbar.ui.js
// =====================================================================
// TOPBAR UI — pure rendering + DOM events for the shared topbar.
//
// Reproduces the LEGACY topbar visual design (element/topbar.js):
//  - brand logo (centered), mobile toggle, theme toggle
//  - user name + role display
//  - profile dropdown (avatar, name, email, Profile/Setting/Portfolio,
//    Form accordion (Permit/Reimburse), Logout)
//
// RULES:
//  - NO Firebase/Firestore access here (use topbar.repository.js).
//  - NO feature logic. "Under development" placeholders preserved for
//    links whose pages do not exist yet.
// =====================================================================

const DEFAULT_PHOTO = "https://i.pravatar.cc/300";

/**
 * Build the legacy topbar markup.
 * @returns {string}
 */
export function buildTopbarHTML() {
  return `
    <nav class="top-bar">
        <div class="d-flex align-items-center">
            <button class="mobile-toggle me-3" type="button" onclick="window.toggleSidebar && window.toggleSidebar()" aria-label="Toggle sidebar">
                <i class="bi bi-list"></i>
            </button>
        </div>
        <div class="logo-center">
            <a href="/home"><img src="https://www.dialogika.co/assets/img/logo.webp" alt="Dialogika Logo" style="height:35px;"></a>
        </div>
        <div class="d-flex align-items-center gap-3">
            <div class="text-end d-none d-lg-block lh-1">
                <span id="user-name-display" class="d-block fw-bold small text-dark">Loading...</span>
                <small id="user-role-display" class="text-muted" style="font-size:0.7rem">User</small>
            </div>
            <button class="btn btn-outline-secondary btn-sm theme-toggle" type="button" title="Toggle dark/light mode" aria-label="Toggle theme">
                <i class="bi bi-moon-stars" data-icon-dark="bi bi-moon-stars" data-icon-light="bi bi-sun"></i>
            </button>
            <div class="profile-dropdown-wrapper">
                <div class="profile-img-container" id="profileDropdownToggle">
                    <img id="user-photo-display" src="${DEFAULT_PHOTO}" alt="Profile" class="profile-img">
                </div>
                <div class="profile-dropdown-menu" id="profileDropdownMenu">
                    <div class="profile-dropdown-header">
                        <div class="profile-dropdown-avatar">
                            <img id="profile-dropdown-photo" src="${DEFAULT_PHOTO}" alt="Profile">
                        </div>
                        <div class="profile-dropdown-info">
                            <div id="profile-dropdown-name" class="profile-dropdown-name">Loading...</div>
                            <div id="profile-dropdown-email" class="profile-dropdown-email">user@example.com</div>
                        </div>
                    </div>
                    <div class="profile-dropdown-body">
                        <a href="/personal/profile.html" class="profile-dropdown-item" data-menu-profile>
                            <i class="bi bi-person-circle"></i>
                            <span>Profile</span>
                        </a>
                        <a href="/personal/setting.html" class="profile-dropdown-item" data-menu-setting>
                            <i class="bi bi-gear"></i>
                            <span>Setting</span>
                        </a>
                        <a href="/personal/portfolio.html" class="profile-dropdown-item" data-menu-portfolio>
                            <i class="bi bi-briefcase"></i>
                            <span>Portfolio</span>
                        </a>
                        <div class="profile-dropdown-accordion" data-accordion="form">
                            <button class="profile-dropdown-item profile-dropdown-accordion-toggle" type="button" data-accordion-toggle="form">
                                <i class="bi bi-file-earmark-text"></i>
                                <span>Form</span>
                                <i class="bi bi-chevron-down ms-auto" data-accordion-chevron="form"></i>
                            </button>
                            <div class="profile-dropdown-accordion-content" data-accordion-content="form">
                                <a href="/personal/form-permit.html" class="profile-dropdown-item" data-menu-permit>
                                    <span>Permit</span>
                                </a>
                                <a href="/personal/form-reimburse.html" class="profile-dropdown-item" data-menu-reimburse>
                                    <span>Reimburse</span>
                                </a>
                            </div>
                        </div>
                    </div>
                    <div class="profile-dropdown-divider"></div>
                    <button class="profile-dropdown-item profile-dropdown-logout" type="button" data-profile-logout>
                        <i class="bi bi-box-arrow-right"></i>
                        <span>Logout</span>
                    </button>
                </div>
            </div>
        </div>
    </nav>`;
}

/**
 * Fill the rendered profile fields.
 * @param {HTMLElement} mount rendered topbar container
 * @param {{name:string,email:string,photo:string,position:string}} profile
 */
export function applyProfile(mount, profile) {
  const name = profile.name || "";
  const email = profile.email || "";
  const photo = profile.photo || DEFAULT_PHOTO;
  const position = profile.position || "";

  const nameDisplay = mount.querySelector("#user-name-display");
  const roleDisplay = mount.querySelector("#user-role-display");
  const dropdownName = mount.querySelector("#profile-dropdown-name");
  const dropdownEmail = mount.querySelector("#profile-dropdown-email");
  const mainPhoto = mount.querySelector("#user-photo-display");
  const dropdownPhoto = mount.querySelector("#profile-dropdown-photo");

  if (nameDisplay) nameDisplay.textContent = name;
  if (roleDisplay) roleDisplay.textContent = position || "Staff";
  if (dropdownName) dropdownName.textContent = name;
  if (dropdownEmail) dropdownEmail.textContent = email;
  if (mainPhoto) mainPhoto.src = photo;
  if (dropdownPhoto) dropdownPhoto.src = photo;
}

/**
 * Wire all topbar DOM events.
 * @param {HTMLElement} mount rendered topbar container
 * @param {{ onLogout: Function }} handlers
 */
export function bindTopbarEvents(mount, { onLogout }) {
  const wrapper = mount.querySelector(".profile-dropdown-wrapper");
  const toggle = mount.querySelector("#profileDropdownToggle");
  const menu = mount.querySelector("#profileDropdownMenu");

  if (toggle && menu && wrapper) {
    toggle.addEventListener("click", (ev) => {
      ev.stopPropagation();
      menu.classList.toggle("show");
    });
    document.addEventListener("click", (ev) => {
      if (!menu.classList.contains("show")) return;
      if (!wrapper.contains(ev.target)) {
        menu.classList.remove("show");
      }
    });
  }

  const logoutBtn = mount.querySelector("[data-profile-logout]");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (typeof onLogout === "function") onLogout();
    });
  }

  const settingLink = mount.querySelector("[data-menu-setting]");
  const portfolioLink = mount.querySelector("[data-menu-portfolio]");

  function attachUnderDevelopment(linkEl) {
    if (!linkEl) return;
    linkEl.addEventListener("click", (ev) => {
      ev.preventDefault();
      alert("under development");
    });
  }

  attachUnderDevelopment(settingLink);
  attachUnderDevelopment(portfolioLink);

  const accordionToggles = mount.querySelectorAll("[data-accordion-toggle]");
  accordionToggles.forEach((toggleEl) => {
    const key = toggleEl.getAttribute("data-accordion-toggle");
    if (!key) return;
    const contentEl = mount.querySelector(`[data-accordion-content="${key}"]`);
    const chevronEl = mount.querySelector(`[data-accordion-chevron="${key}"]`);
    if (!contentEl) return;
    contentEl.style.display = "none";
    toggleEl.addEventListener("click", (ev) => {
      ev.preventDefault();
      const isHidden = contentEl.style.display === "none";
      contentEl.style.display = isHidden ? "block" : "none";
      if (chevronEl) {
        chevronEl.style.transform = isHidden ? "rotate(180deg)" : "";
      }
    });
  });

  if (window.DLGTheme && window.DLGTheme.syncIcons) window.DLGTheme.syncIcons();
}