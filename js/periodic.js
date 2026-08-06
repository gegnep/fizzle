/* AI-ASSISTED: portions of this file were written with the help of an AI assistant (Claude), per course policy. */
/* periodic.js: the Periodic Trends explorer.
   Renders all 118 elements (data in periodic-data.js, mass and density in
   periodic-extra.js) into an 18-column CSS grid.

   Two kinds of view:
   - numeric  : colors tiles on a scale of the trend color, low to high
   - category : colors tiles by which group they fall in, with a legend
   Selection is marked with an outline so a tile never loses its scale color.

   The tile colors are mixed here in JavaScript rather than left to CSS. The
   file needs the finished color anyway, to pick readable ink for the symbol.
   A pale yellow tile needs dark text and a deep teal tile needs light text,
   and only the mixed color knows which. */

(function () {
  "use strict";

  /* ---------- color: mixing in Oklab, and picking readable ink ---------- */

  function toLinear(c) {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function toByte(c) {
    var v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(v * 255)));
  }
  function toOklab(rgb) {
    var r = toLinear(rgb[0]), g = toLinear(rgb[1]), b = toLinear(rgb[2]);
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    var m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    var s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    ];
  }
  function fromOklab(lab) {
    var l = lab[0] + 0.3963377774 * lab[1] + 0.2158037573 * lab[2];
    var m = lab[0] - 0.1055613458 * lab[1] - 0.0638541728 * lab[2];
    var s = lab[0] - 0.0894841775 * lab[1] - 1.2914855480 * lab[2];
    l = l * l * l; m = m * m * m; s = s * s * s;
    return [
      toByte(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
      toByte(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
      toByte(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
    ];
  }
  /* the same ramp CSS color-mix(in oklab, ...) would give */
  function blend(a, b, t) {
    var x = toOklab(a), y = toOklab(b);
    return fromOklab([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t,
      x[2] + (y[2] - x[2]) * t]);
  }
  function luminance(rgb) {
    return 0.2126 * toLinear(rgb[0]) + 0.7152 * toLinear(rgb[1]) + 0.0722 * toLinear(rgb[2]);
  }
  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  /* Catppuccin crust and base, the darkest and lightest neutrals in the theme */
  var INK_DARK = [17, 17, 27], INK_LIGHT = [239, 241, 245];
  var AA = 4.5;                    /* WCAG AA for normal size text */
  function readableInk(bg) {
    return contrast(bg, INK_DARK) >= contrast(bg, INK_LIGHT) ? INK_DARK : INK_LIGHT;
  }
  function css(rgb) { return "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")"; }

  var varCache = {};
  function readVar(name) {
    if (varCache[name]) { return varCache[name]; }
    var s = getComputedStyle(document.body).getPropertyValue(name).trim();
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
    var out = [128, 128, 128];
    if (m) {
      var h = m[1];
      if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
      var n = parseInt(h, 16);
      out = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    varCache[name] = out;
    return out;
  }

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
    ["s", "s block", "--lavender"], ["p", "p block", "--chem"],
    ["d", "d block", "--phys"], ["f", "f block", "--yellow"]
  ];
  var CATEGORIES = [
    ["metal", "Metal", "--phys"], ["metalloid", "Metalloid", "--yellow"],
    ["nonmetal", "Nonmetal", "--chem"], ["noble", "Noble gas", "--pink"]
  ];

  /* ---------- the views ---------- */
  var TRENDS = {
    radius: {
      kind: "num", color: "--chem", key: "radius", unit: "pm", label: "Atomic radius",
      arrow: "radius shrinks → across a period",
      why: "Atoms get smaller across a period because the nucleus gains protons while the electrons stay in the same shell, so the pull tightens. They get larger down a group because each row adds a shell."
    },
    en: {
      kind: "num", color: "--pink", key: "en", unit: "", label: "Electronegativity",
      arrow: "electronegativity climbs → toward fluorine",
      why: "Electronegativity is how hard an atom pulls on shared electrons. Fluorine wins because it is small and barely screened. Most noble gases have no value at all, because they rarely bond."
    },
    ie: {
      kind: "num", color: "--phys", key: "ie", unit: "kJ/mol", label: "Ionization energy",
      arrow: "ionization energy climbs → across a period",
      why: "This is the energy needed to strip one electron away. It rises across a period as the pull tightens, and falls down a group as the outer electron sits further out. The peaks are the noble gases, which is exactly why they are unreactive."
    },
    mass: {
      kind: "num", color: "--lavender", key: "mass", unit: "u", label: "Atomic mass",
      arrow: "atomic mass rises → with atomic number",
      why: "Mass climbs steadily with atomic number, so this view mostly shows the counting order. The interesting part is that it is not perfectly smooth: isotope mixtures make a few neighbors swap places, which is why tellurium outweighs iodine."
    },
    density: {
      kind: "num", color: "--yellow", key: "density", unit: "g/cm³", label: "Density",
      arrow: "density peaks → in the middle of the d block",
      why: "Density depends on how heavy the atoms are and how tightly they pack. It peaks at osmium and iridium, the two densest elements, and sits near zero for the gases in the top right. Blank tiles have no reliable measured value."
    },
    block: {
      kind: "cat", color: "--lavender", of: blockOf, legend: BLOCKS, label: "Block",
      arrow: "the blocks are the shape of the table",
      why: "Each block is named for the orbital its outermost electrons occupy. This is why the table has the shape it does: two columns of s, six of p, ten of d, and fourteen of f pulled out below. The outline of the table is a picture of how electrons stack."
    },
    metal: {
      kind: "cat", color: "--lavender", of: categoryOf, legend: CATEGORIES, label: "Metal or nonmetal",
      arrow: "metals to the left, nonmetals to the upper right",
      why: "Metals give electrons up, nonmetals take them, and metalloids sit on the staircase between the two and do a bit of both. Most of the table is metal. Classifications past element 103 are predicted rather than measured."
    }
  };

  var state = { trend: "radius", sel: null };
  var grid, readout, arrowEl, whyEl, legendEl, scaleEl, buttons, well;

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

  /* density and ionization energy span a wide range, so compress them */
  function ramp(t, key) {
    var f = key === "density" || key === "ie" ? Math.pow(t, 0.55) : t;
    return 0.08 + f * 0.80;
  }

  /* Mix one tile, then guarantee its label is readable.

     Neither ink works on a mid tone: between roughly 16% and 22% luminance
     the dark ink and the light ink both land under 4.5 to 1, which is what
     made the middle of every dark-theme ramp hard to read. The fix is to
     keep pushing that tile further along the ramp it already sits on, until
     one of the two inks clears AA. Only tiles inside that narrow band move,
     and they move the way the scale was already heading, so the ramp still
     runs light to dark in the same order. */
  function tint(card, color, amount) {
    var bg = blend(card, color, amount);
    var ink = readableInk(bg);
    if (contrast(bg, ink) < AA) {
      var up = luminance(color) >= luminance(card) ? 1 : -1;
      var lab = toOklab(bg);
      for (var i = 0; i < 90 && contrast(bg, ink) < AA; i++) {
        lab[0] = Math.max(0, Math.min(1, lab[0] + up * 0.008));
        bg = fromOklab(lab);
        ink = readableInk(bg);
      }
    }
    return { bg: bg, ink: ink };
  }

  function paint() {
    var t = TRENDS[state.trend];
    var card = readVar("--card");
    var color = readVar(t.color);
    well.style.setProperty("--trend", "var(" + t.color + ")");

    if (t.kind === "cat") {
      FZ_ELEMENTS.forEach(function (e) {
        if (!e._btn) { return; }
        var g = t.of(e);
        var entry = t.legend.filter(function (x) { return x[0] === g; })[0];
        var c = tint(card, readVar(entry[2]), 0.50);
        e._btn.style.background = css(c.bg);
        e._btn.style.color = css(c.ink);
        e._btn.classList.remove("nodata");
      });
      legendEl.innerHTML = "";
      t.legend.forEach(function (l) {
        var c = tint(card, readVar(l[2]), 0.50);
        var s = document.createElement("span");
        var swatch = document.createElement("span");
        swatch.style.background = css(c.bg);
        s.appendChild(swatch);
        s.appendChild(document.createTextNode(l[1]));
        legendEl.appendChild(s);
      });
      legendEl.hidden = false;
      scaleEl.hidden = true;
    } else {
      var ext = extent(t.key);
      FZ_ELEMENTS.forEach(function (e) {
        if (!e._btn) { return; }
        var v = valueOf(e, t.key);
        if (typeof v !== "number") {
          /* no accepted published value for this element on this trend */
          e._btn.style.background = "";
          e._btn.style.color = "";
          e._btn.classList.add("nodata");
          return;
        }
        e._btn.classList.remove("nodata");
        var c = tint(card, color, ramp((v - ext[0]) / (ext[1] - ext[0]), t.key));
        e._btn.style.background = css(c.bg);
        e._btn.style.color = css(c.ink);
      });
      /* a real key for the scale, so a color can be read back as a number */
      var stops = [];
      for (var i = 0; i <= 8; i++) {
        stops.push(css(tint(card, color, ramp(i / 8, t.key)).bg) + " " + (i * 12.5) + "%");
      }
      scaleEl.innerHTML = "";
      var bar = document.createElement("div");
      bar.className = "bar";
      bar.style.backgroundImage = "linear-gradient(to right," + stops.join(",") + ")";
      var lo = document.createElement("span");
      lo.className = "lo";
      lo.textContent = fmtNum(ext[0]) + (t.unit ? " " + t.unit : "");
      var hi = document.createElement("span");
      hi.className = "hi";
      hi.textContent = fmtNum(ext[1]) + (t.unit ? " " + t.unit : "");
      var cap = document.createElement("span");
      cap.className = "cap";
      cap.textContent = t.label;
      scaleEl.appendChild(cap);
      scaleEl.appendChild(lo);
      scaleEl.appendChild(bar);
      scaleEl.appendChild(hi);
      scaleEl.hidden = false;
      legendEl.hidden = true;
    }

    arrowEl.textContent = t.arrow;
    whyEl.textContent = t.why;
    /* the arrow line means direction, which a category view does not have,
       and its swatch means one scale color, which a category view also lacks */
    var line = document.querySelector(".pt-arrow .line");
    if (line) { line.hidden = t.kind === "cat"; }
    var swatch = document.querySelector(".pt-arrow .swatch");
    if (swatch) { swatch.hidden = t.kind === "cat"; }
    if (state.sel && state.sel._btn) { state.sel._btn.classList.add("sel"); }
  }

  function fmtNum(v) {
    if (v >= 1000) { return v.toLocaleString("en-US"); }
    if (v < 0.01) { return v.toFixed(5); }
    return String(v);
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
  }

  function setTrend(key) {
    if (!TRENDS[key]) { return; }
    state.trend = key;
    buttons.forEach(function (x) {
      var on = x.getAttribute("data-trend") === key;
      x.classList.toggle("on", on);
      x.setAttribute("aria-pressed", on ? "true" : "false");
    });
    paint();
  }

  function init() {
    grid = document.getElementById("pt-grid");
    well = document.querySelector(".fz-stage .well");
    readout = document.getElementById("pt-read");
    arrowEl = document.getElementById("pt-arrow-label");
    whyEl = document.getElementById("pt-why");
    legendEl = document.getElementById("pt-legend");
    scaleEl = document.getElementById("pt-scale");
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
      var z = document.createElement("b");
      z.className = "z";
      z.textContent = e.z;
      var sym = document.createElement("span");
      sym.className = "sym";
      sym.textContent = e.sym;
      btn.appendChild(z);
      btn.appendChild(sym);
      btn.setAttribute("aria-label", e.name + ", element " + e.z);
      btn.style.gridRow = e.row;
      btn.style.gridColumn = e.col;
      btn.addEventListener("click", function () { select(e); });
      e._btn = btn;
      grid.appendChild(btn);
    });

    buttons.forEach(function (b) {
      var key = b.getAttribute("data-trend");
      if (TRENDS[key].kind === "num") {
        var dot = document.createElement("span");
        dot.className = "dot";
        dot.style.background = "var(" + TRENDS[key].color + ")";
        b.insertBefore(dot, b.firstChild);
      }
      b.setAttribute("aria-pressed", b.classList.contains("on") ? "true" : "false");
      b.addEventListener("click", function () { setTrend(key); });
    });

    /* the theme swap changes every mixed color, so mix them again */
    document.addEventListener("fizzle:theme", function () {
      varCache = {};
      paint();
    });
    /* a link can name a view, so periodic.html#density opens on density */
    function fromHash() {
      var k = (location.hash || "").replace("#", "");
      return TRENDS[k] ? k : null;
    }
    window.addEventListener("hashchange", function () {
      var k = fromHash();
      if (k) { setTrend(k); }
    });

    var cl = FZ_ELEMENTS.filter(function (e) { return e.sym === "Cl"; })[0];
    select(cl || FZ_ELEMENTS[0]);
    setTrend(fromHash() || "radius");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
