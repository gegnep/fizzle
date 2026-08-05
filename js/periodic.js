/* AI-ASSISTED: portions of this file were written with the help of an AI assistant (Claude), per course policy. */
/* periodic.js: the Periodic Trends explorer.
   Renders all 118 elements (data in periodic-data.js) into an 18-column CSS
   grid, colors them by the selected trend, and shows a readout for the
   selected element. */

(function () {
  "use strict";

  var TRENDS = {
    radius: { label: "Atomic radius", unit: "pm", arrow: "radius shrinks → across a period" },
    en:     { label: "Electronegativity", unit: "", arrow: "electronegativity climbs → toward fluorine" },
    ie:     { label: "Ionization energy", unit: "kJ/mol", arrow: "ionization energy climbs → across a period" }
  };

  var state = { trend: "radius", sel: null };
  var grid, readout, arrowEl, buttons;

  function extent(key) {
    var min = Infinity, max = -Infinity;
    FZ_ELEMENTS.forEach(function (e) {
      var v = e[key];
      if (typeof v === "number") { if (v < min) min = v; if (v > max) max = v; }
    });
    return [min, max];
  }

  function paint() {
    var key = state.trend;
    var ext = extent(key);
    /* Selection is shown with an outline, not a color, so the scale stays
       readable: every tile keeps the background its own value earned. */
    FZ_ELEMENTS.forEach(function (e) {
      var btn = e._btn;
      if (!btn) { return; }
      var v = e[key];
      if (typeof v !== "number") {
        /* no accepted published value for this element on this trend */
        btn.style.background = "var(--card)";
        btn.classList.add("nodata");
        return;
      }
      btn.classList.remove("nodata");
      var t = (v - ext[0]) / (ext[1] - ext[0]);
      var pct = Math.round(6 + t * 80);
      btn.style.background = "color-mix(in oklab, var(--chem) " + pct + "%, var(--card))";
    });
    arrowEl.textContent = TRENDS[key].arrow;
  }

  function fmt(v, unit) {
    if (typeof v !== "number") { return "no accepted value"; }
    return v + (unit ? " " + unit : "");
  }

  function select(e) {
    if (state.sel && state.sel._btn) { state.sel._btn.classList.remove("sel"); }
    state.sel = e;
    e._btn.classList.add("sel");
    readout.innerHTML = "";
    var strong = document.createElement("strong");
    strong.textContent = e.sym + " · " + e.name.toLowerCase();
    var data = document.createElement("span");
    data.textContent = "radius " + fmt(e.radius, "pm") +
      " · electronegativity " + fmt(e.en, "") +
      " · ionization " + fmt(e.ie, "kJ/mol");
    var quip = document.createElement("span");
    quip.textContent = "“" + e.quip + "”";
    readout.appendChild(strong);
    readout.appendChild(data);
    readout.appendChild(quip);
    paint();
  }

  function init() {
    grid = document.getElementById("pt-grid");
    readout = document.getElementById("pt-read");
    arrowEl = document.getElementById("pt-arrow-label");
    buttons = document.querySelectorAll(".pt-controls .fz-btn");
    buttons.forEach(function (b) {
      b.setAttribute("aria-pressed", b.classList.contains("on") ? "true" : "false");
    });

    grid.style.gridTemplateRows = "repeat(7, auto) 12px repeat(2, auto)";

    /* f-block placeholder markers */
    [["57-71", 6], ["89-103", 7]].forEach(function (m) {
      var d = document.createElement("div");
      d.className = "lbl56";
      d.textContent = m[0];
      d.style.gridRow = m[1];
      d.style.gridColumn = 3;
      grid.appendChild(d);
    });

    FZ_ELEMENTS.forEach(function (e) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "el";
      btn.textContent = e.sym;
      btn.setAttribute("aria-label", e.name + ", element " + e.z);
      /* rows 9/10 (f-block) land after the 12px spacer row (grid row 8) */
      btn.style.gridRow = e.row;
      btn.style.gridColumn = e.col;
      btn.addEventListener("click", function () { select(e); });
      e._btn = btn;
      grid.appendChild(btn);
    });

    buttons.forEach(function (b) {
      b.addEventListener("click", function () {
        buttons.forEach(function (x) {
          x.classList.remove("on");
          x.setAttribute("aria-pressed", "false");
        });
        b.classList.add("on");
        b.setAttribute("aria-pressed", "true");
        state.trend = b.getAttribute("data-trend");
        paint();
      });
    });

    /* start with chlorine selected, like the mock */
    var cl = FZ_ELEMENTS.filter(function (e) { return e.sym === "Cl"; })[0];
    select(cl || FZ_ELEMENTS[0]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
