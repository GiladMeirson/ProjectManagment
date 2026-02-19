/**
 * Loader Utility — Project Management System
 *
 * Self-contained full-page loader. Injects its own DOM & styles on first use.
 * No HTML changes required per page — just include this script and call:
 *
 *   startLoader();              // Spinner only
 *   startLoader("מתחבר...");   // Spinner + message
 *   stopLoader();               // Hide loader
 */

const Loader = (() => {
  let overlay = null;
  let messageEl = null;

  /* ── Build overlay & inject styles once ── */
  function _inject() {
    if (document.getElementById("__pm-loader")) return;

    const style = document.createElement("style");
    style.id = "__pm-loader-styles";
    style.textContent = `
      #__pm-loader {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 20px;
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.25s ease, visibility 0.25s ease;
        pointer-events: none;
      }

      #__pm-loader.is-visible {
        opacity: 1;
        visibility: visible;
        pointer-events: all;
      }

      /* Gradient ring spinner */
      #__pm-loader .pm-loader-ring {
        width: 56px;
        height: 56px;
        position: relative;
        flex-shrink: 0;
      }

      #__pm-loader .pm-loader-ring::before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: 50%;
        border: 4px solid #e5e7eb;
      }

      #__pm-loader .pm-loader-ring::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: 50%;
        border: 4px solid transparent;
        border-top-color: #667eea;
        border-right-color: #764ba2;
        animation: __pm-spin 0.75s linear infinite;
      }

      /* Optional text message */
      #__pm-loader .pm-loader-message {
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        font-size: 0.95rem;
        font-weight: 500;
        color: #4b5563;
        direction: rtl;
        text-align: center;
        min-height: 1.4em;
        letter-spacing: 0.01em;
      }

      @keyframes __pm-spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    overlay = document.createElement("div");
    overlay.id = "__pm-loader";
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-label", "טוען");
    overlay.setAttribute("aria-live", "polite");

    const ring = document.createElement("div");
    ring.className = "pm-loader-ring";

    messageEl = document.createElement("p");
    messageEl.className = "pm-loader-message";

    overlay.appendChild(ring);
    overlay.appendChild(messageEl);
    document.body.appendChild(overlay);
  }

  /* ── Public API ── */

  /**
   * Show the loader overlay.
   * @param {string} [message=""] - Optional Hebrew/English text shown below the spinner.
   */
  function startLoader(message = "") {
    _inject();
    messageEl.textContent = message;
    overlay.offsetHeight; // Force reflow so CSS transition fires on first call
    overlay.classList.add("is-visible");
  }

  /**
   * Hide the loader overlay.
   */
  function stopLoader() {
    if (!overlay) return;
    overlay.classList.remove("is-visible");
  }

  return { startLoader, stopLoader };
})();

/* ── Convenient globals so any page can just call startLoader() / stopLoader() ── */
const startLoader = Loader.startLoader.bind(Loader);
const stopLoader  = Loader.stopLoader.bind(Loader);
