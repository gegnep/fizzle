/* AI-ASSISTED: portions of this file were written with the help of an AI assistant (Claude), per course policy. */
/* periodic.js: the Periodic Trends explorer.
   Renders all 118 elements (data in periodic-data.js, mass and density in
   periodic-extra.js) into an 18-column CSS grid.

   Two kinds of view:
   - numeric  : colors tiles on a scale of the subject color, low to high
   - category : colors tiles by which group they fall in, with a legend
   Selection is marked with an outline so a tile never loses its scale color. */

(function () {
  "use strict";

  /* ---------- category rules, from position and standard practice ---------- */
  var NOBLE = "He Ne Ar Kr Xe Rn Og".split(" ");
  var METALLOID = "B Si Ge As Sb Te Po At".split(" ");
  var NONMETAL = "H C N O F P S Cl Se Br I".split(" ");

  function blockOf(e) {
    if (e.row >= 9) { return "f"; }
    if (e.sym === "He") { return "s"; }
    if (e.col <= 2) { return "s"; }
    if (e.col >= 13) { return "p"; }
    return "d";
  }

  function categoryOf(e) {
    if (NOBLE.indexOf(e.sym) !== -1) { return "noble"; }
    if (METALLOID.indexOf(e.sym) !== -1) { return "metalloid"; }
    if (NONMETAL.indexOf(e.sym) !== -1) { return "nonmetal"; }
    return "metal";
  }

  var BLOCKS = [
    ["s", "s block", "var(--lavender)"],
    ["p", "p block", "var(--chem)"],
    ["d", "d block", "var(--phys)"],
    ["f", "f block", "var(--yellow)"]
  ];
  var CATEGORIES = [
    ["metal", "Metal", "var(--phys)"],
    ["metalloid", "Metalloid", "var(--yellow)"],
    ["nonmetal", "Nonmetal", "var(--chem)"],
    ["noble", "Noble gas", "var(--pink)"]
  ];

  /* ---------- the views ---------- */
  var TRENDS = {
    radius: {
      kind: "num", key: "radius", unit: "pm",
      arrow: "radius shrinks → across a period",
      why: "Atoms get smaller across a period because the nucleus gains protons while the electrons stay in the same shell, so the pull tightens. They get larger down a group because each row adds a shell."
    },
    en: {
      kind: "num", key: "en", unit: "",
      arrow: "electronegativity climbs → toward fluorine",
      why: "Electronegativity is how hard an atom pulls on shared electrons. Fluorine wins because it is small and barely screened. Most noble gases have no value at all, because they rarely bond."
    },
    ie: {
      kind: "num", key: "ie", unit: "kJ/mol",
      arrow: "ionization energy climbs → across a period",
      why: "This is the energy needed to strip one electron away. It rises across a period as the pull tightens, and falls down a group as the outer electron sits further out. The peaks are the noble gases, which is exactly why they are unreactive."
    },
    mass: {
      kind: "num", key: "mass", unit: "u",
      arrow: "atomic mass rises → with atomic number",
      why: "Mass climbs steadily with atomic number, so this view mostly shows the counting order. The interesting part is that it is not perfectly smooth: isotope mixtures make a few neighbors swap places, which is why tellurium outweighs iodine."
    },
    density: {
      kind: "num", key: "density", unit: "g/cm³",
      arrow: "density peaks → in the middle of the d block",
      why: "Density depends on how heavy the atoms are and how tightly they pack. It peaks at osmium and iridium, the two densest elements, and sits near zero for the gases in the top right. Blank tiles have no reliable measured value."
    },
    block: {
      kind: "cat", of: blockOf, legend: BLOCKS,
      arrow: "the blocks are the shape of the table",
      why: "Each block is named for the orbital its outermost electrons occupy. This is why the table has the shape it does: two columns of s, six of p, ten of d, and fourteen of f pulled out below. The outline of the table is a picture of how electrons stack."
    },
    metal: {
      kind: "cat", of: categoryOf, legend: CATEGORIES,
      arrow: "metals to the left, nonmetals to the upper right",
      why: "Metals give electrons up, nonmetals take them, and metalloids sit on the staircase between the two and do a bit of both. Most of the table is metal. Classifications past element 103 are predicted rather than measured."
    }
  };

  var state = { trend: "radius", sel: null };
  var grid, readout, arrowEl, whyEl, legendEl, buttons;

  function valueOf(e, key) {
    if (key === "mass" || key === "density") {
      var x = (typeof FZ_EXTRA !== "undefined") && FZ_EXTRA[e.sym];
      return x ? x[key] : null;
    }
    return e[key];
  }

  function extent(key) {
    var min = Infinity, max = -Infinity;
    FZ_ELEMENTS.forEach(function (e) {
      var v = valueOf(e, key);
      if (typeof v === "number") { if (v < min) { min = v; } if (v > max) { max = v; } }
    });
    return [min, max];
  }

  function paint() {
    var t = TRENDS[state.trend];

    if (t.kind === "cat") {
      FZ_ELEMENTS.forEach(function (e) {
        if (!e._btn) { return; }
        var g = t.of(e);
        var color = t.legend.filter(function (x) { return x[0] === g; })[0][2];
        e._btn.style.background = "color-mix(in oklab, " + color + " 45%, var(--card))";
        e._btn.classList.remove("nodata");
      });
      legendEl.innerHTML = "";
      t.legend.forEach(function (l) {
        var s = document.createElement("span");
        var swatch = document.createElement("i");
        swatch.style.background = "color-mix(in oklab, " + l[2] + " 45%, var(--card))";
        s.appendChild(swatch);
        s.appendChild(document.createTextNode(l[1]));
        legendEl.appendChild(s);
      });
      legendEl.hidden = false;
    } else {
      var ext = extent(t.key);
      FZ_ELEMENTS.forEach(function (e) {
        if (!e._btn) { return; }
        var v = valueOf(e, t.key);
        if (typeof v !== "number") {
          /* no accepted published value for this element on this trend */
          e._btn.style.background = "var(--card)";
          e._btn.classList.add("nodata");
          return;
        }
        e._btn.classList.remove("nodata");
        var f = (v - ext[0]) / (ext[1] - ext[0]);
        /* density and ionization energy span a wide range, so compress them */
        if (t.key === "density" || t.key === "ie") { f = Math.pow(f, 0.55); }
        e._btn.style.background =
          "color-mix(in oklab, var(--chem) " + Math.round(6 + f * 80) + "%, var(--card))";
      });
      legendEl.hidden = true;
    }

    arrowEl.textContent = t.arrow;
    whyEl.textContent = t.why;
    /* the arrow line means direction, which a category view does not have */
    var line = document.querySelector(".pt-arrow .line");
    if (line) { line.hidden = t.kind === "cat"; }
  }

  function fmt(e, key, unit) {
    var v = valueOf(e, key);
    if (typeof v !== "number") { return "no accepted value"; }
    if (key === "density" && v < 0.01) { return v.toFixed(5) + " " + unit; }
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
    data.textContent =
      "number " + e.z +
      " · mass " + fmt(e, "mass", "u") +
      " · radius " + fmt(e, "radius", "pm") +
      " · electronegativity " + fmt(e, "en", "") +
      " · ionization " + fmt(e, "ie", "kJ/mol") +
      " · density " + fmt(e, "density", "g/cm³") +
      " · " + blockOf(e) + " block, " + categoryOf(e);

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
    whyEl = document.getElementById("pt-why");
    legendEl = document.getElementById("pt-legend");
    buttons = document.querySelectorAll(".pt-controls .fz-btn");

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
      btn.style.gridRow = e.row;
      btn.style.gridColumn = e.col;
      btn.addEventListener("click", function () { select(e); });
      e._btn = btn;
      grid.appendChild(btn);
    });

    buttons.forEach(function (b) {
      b.setAttribute("aria-pressed", b.classList.contains("on") ? "true" : "false");
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

    var cl = FZ_ELEMENTS.filter(function (e) { return e.sym === "Cl"; })[0];
    select(cl || FZ_ELEMENTS[0]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
