/* AI-ASSISTED: portions of this file were written with the help of an AI assistant (Claude), per course policy. */
/* site.js: shared shell behavior for every page.
   1. Dark/light theme toggle, saved to localStorage "fizzle-theme".
   2. Ticker marquee: duplicates the message track so the CSS loop is seamless. */

(function () {
  "use strict";

  /* ---------- theme ---------- */
  var saved = null;
  try { saved = localStorage.getItem("fizzle-theme"); } catch (e) {}
  var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (saved === "dark" || (saved === null && prefersDark)) {
    document.body.classList.add("dark");
  }

  function initShell() {
    var themeBtn = document.querySelector(".fz-theme");
    if (themeBtn) {
      themeBtn.addEventListener("click", function () {
        var dark = document.body.classList.toggle("dark");
        try { localStorage.setItem("fizzle-theme", dark ? "dark" : "light"); } catch (e) {}
      });
    }

    /* ---------- ticker ---------- */
    /* Ticker copy lives in the HTML (easy to edit). JS only clones the
       track once so the translateX(-50%) marquee loops without a gap. */
    var track = document.querySelector(".fz-ticker .track");
    if (track) {
      var sep = document.createElement("span");
      sep.className = "sep";
      sep.textContent = "●";
      track.appendChild(sep);
      track.innerHTML += track.innerHTML;
    }

    /* The NEW flag doubles as a pause button, so the marquee can be stopped
       without a mouse. Hover pausing is handled in CSS. */
    var ticker = document.querySelector(".fz-ticker");
    var tickBtn = document.getElementById("fz-tick-btn");
    if (ticker && tickBtn) {
      tickBtn.addEventListener("click", function () {
        var paused = ticker.classList.toggle("paused");
        tickBtn.setAttribute("aria-pressed", paused ? "true" : "false");
        tickBtn.setAttribute("aria-label",
          paused ? "Resume the scrolling news ticker" : "Pause the scrolling news ticker");
      });
      tickBtn.setAttribute("aria-label", "Pause the scrolling news ticker");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initShell);
  } else {
    initShell();
  }
})();
