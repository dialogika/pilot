export function renderRightbarRecruit() {
    if (document.getElementById("menuTrigger")) {
        return;
    }

    const trigger = document.createElement("div");
    trigger.className = "sticky-menu-trigger";
    trigger.id = "menuTrigger";
    trigger.innerHTML = '<i data-lucide="layout-grid"></i>';

    const overlay = document.createElement("div");
    overlay.className = "menu-overlay";
    overlay.id = "menuOverlay";

    const container = document.createElement("div");
    container.className = "menu-container";
    container.id = "menuContainer";
    container.innerHTML = `
        <div class="close-btn" id="closeBtn">
            <i data-lucide="x"></i>
        </div>
        <div class="menu-header">
            <h2>Recruitment Shortcut</h2>
        </div>
        <div class="menu-grid">
            <a href="/data/candidate-management.html" class="menu-item">
                <i data-lucide="users"></i>
                <span>Candidate Management</span>
            </a>
            <a href="/data/scouting-candidate.html" class="menu-item">
                <i data-lucide="search"></i>
                <span>Scouting Candidate</span>
            </a>
            <a href="/company-position" class="menu-item">
                <i data-lucide="briefcase"></i>
                <span>Head Count</span>
            </a>
            <a href="/quest/dashboard-recruitment.html" class="menu-item">
                <i data-lucide="layout-dashboard"></i>
                <span>Dashboard</span>
            </a>
        </div>
    `;

    document.body.appendChild(trigger);
    document.body.appendChild(overlay);
    document.body.appendChild(container);

    if (window.lucide) {
        window.lucide.createIcons();
    }

    const closeBtn = container.querySelector("#closeBtn");

    function toggleStickyMenu() {
        overlay.classList.toggle("active");
        container.classList.toggle("active");
    }

    trigger.addEventListener("click", toggleStickyMenu);
    if (closeBtn) {
        closeBtn.addEventListener("click", toggleStickyMenu);
    }
    overlay.addEventListener("click", toggleStickyMenu);

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && container.classList.contains("active")) {
            toggleStickyMenu();
        }
    });
}
