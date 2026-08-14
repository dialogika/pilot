// assets/js/theme.js
// Shared dark/light theme manager. Applies <html data-theme="dark|light">.
// Usage:
//   <script src="assets/js/theme.js" defer></script>
//   <button class="theme-toggle">...</button>   -> auto toggles on click
//   or call window.DLGTheme.toggle() from your own handler.

(function () {
  const STORAGE_KEY = "dlg-theme";
  const THEME = {
    get current() {
      return document.documentElement.getAttribute("data-theme") || "light";
    },
    apply(theme) {
      if (theme === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
      try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
      syncIcons();
    },
    toggle() {
      this.apply(this.current === "dark" ? "light" : "dark");
    },
    init() {
      let saved = null;
      try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
      // Default: respect OS preference if nothing saved
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      this.apply(saved || (prefersDark ? "dark" : "light"));
      this.bindToggles();
    },
    bindToggles() {
      // Event delegation handles toggles injected dynamically after init
      // (e.g. the topbar rendered by renderTopBar()).
      if (delegated) return;
      delegated = true;
      document.addEventListener("click", onToggle);
    },
    syncIcons() {
      syncIcons();
    }
  };

  let delegated = false;

  function onToggle(e) {
    if (!e.target.closest(".theme-toggle")) return;
    e.preventDefault();
    THEME.toggle();
  }

  function syncIcons() {
    const isDark = THEME.current === "dark";
    document.querySelectorAll(".theme-toggle [data-icon-dark], .theme-toggle [data-icon-light]").forEach((el) => {
      const dark = el.getAttribute("data-icon-dark");
      const light = el.getAttribute("data-icon-light");
      el.className = isDark ? (dark || el.className) : (light || el.className);
    });
  }

  window.DLGTheme = THEME;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => THEME.init());
  } else {
    THEME.init();
  }
})();
