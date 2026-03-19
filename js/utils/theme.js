/* ==========================================
   Theme — Dark / Light mode via console
   Usage: darkmode()  |  lightmode()
   Preference is saved in localStorage (key: pm_theme)
   ========================================== */

(function () {
  const STORAGE_KEY = "pm_theme";

  function applyTheme(mode) {
    document.documentElement.setAttribute("data-theme", mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }

  window.darkmode = function () {
    applyTheme("dark");
    console.log(
      "%c🌙 Dark mode activated",
      "color: #a78bfa; font-weight: bold; font-size: 14px;"
    );
  };

  window.lightmode = function () {
    applyTheme("light");
    console.log(
      "%c☀️  Light mode activated",
      "color: #f59e0b; font-weight: bold; font-size: 14px;"
    );
  };

  // Restore saved preference immediately (before render) to avoid flash
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  }

  // Wire up the pill toggle button once the DOM is ready
  document.addEventListener("DOMContentLoaded", function () {
    const btn = document.getElementById("themeToggleBtn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      if (isDark) {
        window.lightmode();
      } else {
        window.darkmode();
      }
    });
  });
})();
