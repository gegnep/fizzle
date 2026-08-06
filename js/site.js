/* AI-ASSISTED: portions of this file were written with the help of an AI assistant (Claude), per course policy. */
/* site.js: shared shell behavior for every page.
   1. Dark/light theme toggle, saved to localStorage "fizzle-theme".
   2. Ticker marquee: duplicates the message track so the CSS loop is seamless. */

(function () {
  "use strict";

  /* ---------- theme ----------
     On a server, localStorage is shared across the site and the choice simply
     persists. Opened straight from a folder the pages are file:// URLs, and
     every file gets its own null origin, so page two cannot read what page one
     saved and the theme appears to reset on every click. When that is the case,
     carry the choice in the link instead. */
  var LOCAL_FILE = location.protocol === "file:";

  function readSaved() {
    try { return localStorage.getItem("fizzle-theme"); } catch (e) { return null; }
  }

  function writeSaved(value) {
    try { localStorage.setItem("fizzle-theme", value); } catch (e) {}
  }

  function fromUrl() {
    var m = /[?&]t=(d|l)/.exec(location.search);
    return m ? (m[1] === "d" ? "dark" : "light") : null;
  }

  var choice = (LOCAL_FILE ? fromUrl() : null) || readSaved();
  var prefersDark = window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (choice === "dark" || (choice === null && prefersDark)) {
    document.body.classList.add("dark");
  }

  /* Stamp the current theme onto every internal link, so a local copy keeps it
     across pages. On a server this does nothing and the URLs stay clean. */
  function carryTheme() {
    if (!LOCAL_FILE) { return; }
    var flag = document.body.classList.contains("dark") ? "d" : "l";
    var links = document.querySelectorAll("a[href]");
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute("href");
      if (!href || /^(https?:|mailto:|#)/.test(href) || href.indexOf(".html") === -1) {
        continue;
      }
      var hash = "";
      var cut = href.indexOf("#");
      if (cut >= 0) { hash = href.slice(cut); href = href.slice(0, cut); }
      links[i].setAttribute("href", href.split("?")[0] + "?t=" + flag + hash);
    }
  }

  function initShell() {
    var themeBtn = document.querySelector(".fz-theme");
    if (themeBtn) {
      themeBtn.addEventListener("click", function () {
        var dark = document.body.classList.toggle("dark");
        writeSaved(dark ? "dark" : "light");
        carryTheme();
        /* Canvas demos read their colors from CSS, so they need a nudge to
           repaint. CSS alone cannot reach a painted canvas. */
        document.dispatchEvent(new CustomEvent("fizzle:theme",
          { detail: { dark: dark } }));
      });
    }
    carryTheme();

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
