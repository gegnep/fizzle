/* AI-ASSISTED: portions of this file were written with the help of an AI assistant (Claude), per course policy. */
/* decay.js: Nuclide Decay.

   Left panel: a chart of nuclides, neutrons across and protons up. The faint
   band behind is a schematic of the valley of stability. On top of it sit the
   30 real nuclides from decay-data.js, placed at their true (N, Z) and colored
   by how they decay. Any of them can be selected, by mouse or by keyboard.

   Right panel: 400 atoms, each rolling its own dice per tick against the real
   half-life, so the curve is stochastic rather than scripted. Time is
   display-scaled: one half-life always takes the same wall time. */

(function () {
  "use strict";

  var N_ATOMS = 400;
  var TICK_MS = 100;
  var TICKS_PER_HALFLIFE = 24;   /* a half-life takes 2.4 s at 1x */

  /* chart geometry */
  var VW = 360, VH = 250;
  var N_MAX = 195, Z_MAX = 122;
  var X0 = 32, X1 = 352, Y0 = 232, Y1 = 12;

  var MODES = {
    "alpha":  { label: "alpha", color: "var(--pink)" },
    "beta-":  { label: "beta minus", color: "var(--phys)" },
    "beta+":  { label: "beta plus", color: "var(--yellow)" },
    "it":     { label: "gamma / isomeric", color: "var(--lavender)" },
    "stable": { label: "stable", color: "var(--chem)" }
  };

  var chart, presets, atomBox, timeline, playBtn, resetBtn, speedBtn, chainEl, read, legendEl;
  var atoms = [], alive = N_ATOMS, tick = 0, timer = null, speed = 1, sel = null;

  /* metastable nuclides carry a trailing m, as in Tc-99m */
  function name(nuc) { return nuc.sym + "-" + nuc.a + (nuc.m ? "m" : ""); }

  function px(n) { return X0 + (n / N_MAX) * (X1 - X0); }
  function py(z) { return Y0 + (z / Z_MAX) * (Y1 - Y0); }

  /* ---------- chart ---------- */
  function buildChart() {
    var svg = ['<svg viewBox="0 0 ' + VW + ' ' + VH + '" role="group" ' +
      'aria-label="Chart of nuclides. Neutrons across, protons up. Select a nuclide.">'];

    /* schematic valley of stability behind the real data */
    var band = [];
    for (var z = 1; z <= 118; z += 2) {
      var want = z + z * z / 100;
      for (var d = -7; d <= 7; d += 2) {
        var n = Math.round(want + d);
        if (n < 0 || n > N_MAX) { continue; }
        var op = d === 0 ? 0.30 : (Math.abs(d) < 5 ? 0.18 : 0.10);
        band.push('<rect x="' + px(n).toFixed(1) + '" y="' + (py(z) - 1.6).toFixed(1) +
          '" width="2.4" height="3.2" fill="var(--subtext)" opacity="' + op + '"/>');
      }
    }
    svg.push('<g aria-hidden="true">' + band.join("") + "</g>");

    /* axes */
    svg.push('<line x1="' + X0 + '" y1="' + Y0 + '" x2="' + X1 + '" y2="' + Y0 +
      '" stroke="var(--border)" stroke-width="1.5"/>');
    svg.push('<line x1="' + X0 + '" y1="' + Y0 + '" x2="' + X0 + '" y2="' + Y1 +
      '" stroke="var(--border)" stroke-width="1.5"/>');
    [0, 50, 100, 150].forEach(function (n) {
      svg.push('<text x="' + px(n).toFixed(1) + '" y="' + (Y0 + 12) +
        '" font-size="8" fill="var(--subtext)" text-anchor="middle" font-family="monospace">' + n + "</text>");
    });
    [20, 50, 82, 114].forEach(function (z) {
      svg.push('<text x="' + (X0 - 5) + '" y="' + (py(z) + 3).toFixed(1) +
        '" font-size="8" fill="var(--subtext)" text-anchor="end" font-family="monospace">' + z + "</text>");
    });

    /* the predicted island of stability, near Z 114 and N 184 */
    svg.push('<rect x="' + px(174).toFixed(1) + '" y="' + py(120).toFixed(1) +
      '" width="' + (px(194) - px(174)).toFixed(1) + '" height="' + (py(106) - py(120)).toFixed(1) +
      '" fill="none" stroke="var(--pink)" stroke-width="1.2" stroke-dasharray="4 3"/>');
    svg.push('<text x="' + px(170).toFixed(1) + '" y="' + (py(101) + 3).toFixed(1) +
      '" font-size="7.5" fill="var(--pink)" text-anchor="end" font-family="monospace">island of stability?</text>');

    /* the real nuclides */
    FZ_NUCLIDES.forEach(function (nuc) {
      svg.push('<g class="dk-nuc" data-id="' + nuc.id + '" tabindex="0" role="button" ' +
        'aria-label="' + name(nuc) + ", " + MODES[nuc.mode].label +
        ", half-life " + nuc.hl + '">' +
        '<circle cx="' + px(nuc.n).toFixed(1) + '" cy="' + py(nuc.z).toFixed(1) +
        '" r="5" fill="' + MODES[nuc.mode].color + '" stroke="var(--border)" stroke-width="1.2"/>' +
        "</g>");
    });

    /* label for whichever nuclide is selected */
    svg.push('<g id="dk-tag" aria-hidden="true"><rect rx="3"/><text font-size="9" ' +
      'font-family="monospace" fill="var(--text)"></text></g>');

    svg.push("</svg>");
    chart.innerHTML = svg.join("");

    chart.querySelectorAll(".dk-nuc").forEach(function (g) {
      var id = g.getAttribute("data-id");
      g.addEventListener("click", function () { choose(id); });
      g.addEventListener("focus", function () { choose(id); });
      g.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); choose(id); }
      });
    });

    legendEl.innerHTML = "";
    Object.keys(MODES).forEach(function (k) {
      var s = document.createElement("span");
      var swatch = document.createElement("span");
      swatch.style.background = MODES[k].color;
      s.appendChild(swatch);
      s.appendChild(document.createTextNode(MODES[k].label));
      legendEl.appendChild(s);
    });
  }

  function tagSelected() {
    var tag = document.getElementById("dk-tag");
    if (!tag || !sel) { return; }
    var text = tag.querySelector("text");
    var rect = tag.querySelector("rect");
    var label = name(sel);
    var x = px(sel.n), y = py(sel.z);
    var left = x > VW - 70;          /* keep the label inside the frame */
    var w = label.length * 5.6 + 8;

    text.textContent = label;
    text.setAttribute("x", (left ? x - 10 : x + 10).toFixed(1));
    text.setAttribute("y", (y - 8).toFixed(1));
    text.setAttribute("text-anchor", left ? "end" : "start");
    rect.setAttribute("x", (left ? x - 14 - w : x + 6).toFixed(1));
    rect.setAttribute("y", (y - 18).toFixed(1));
    rect.setAttribute("width", w.toFixed(1));
    rect.setAttribute("height", "13");
    rect.setAttribute("fill", "var(--card)");
    rect.setAttribute("stroke", "var(--border)");
    rect.setAttribute("stroke-width", "1");

    chart.querySelectorAll(".dk-nuc").forEach(function (g) {
      g.classList.toggle("on", g.getAttribute("data-id") === sel.id);
    });
  }

  /* ---------- simulation ---------- */
  function reset() {
    stop();
    tick = 0;
    alive = N_ATOMS;
    atomBox.innerHTML = "";
    atoms = [];
    var color = MODES[sel.mode].color;
    for (var i = 0; i < N_ATOMS; i++) {
      var a = document.createElement("span");
      a.style.background = color;
      atomBox.appendChild(a);
      atoms.push(a);
    }
    drawTimeline();
    render();
  }

  function drawTimeline() {
    var html = "";
    for (var h = 1; h <= 4; h++) {
      html += '<span class="tick" style="left:' + ((h / 4.6) * 100) + '%"><em>' + h + " t½</em></span>";
    }
    html += '<span class="cursor" id="dk-cursor" style="left:0%"></span>';
    timeline.innerHTML = html;
  }

  function step() {
    if (sel.mode === "stable") { return; }
    tick += speed;
    var p = 1 - Math.pow(0.5, speed / TICKS_PER_HALFLIFE);
    for (var i = 0; i < atoms.length; i++) {
      if (!atoms[i].classList.contains("gone") && Math.random() < p) {
        atoms[i].classList.add("gone");
        alive--;
      }
    }
    var cur = document.getElementById("dk-cursor");
    if (cur) { cur.style.left = Math.min(100, (tick / TICKS_PER_HALFLIFE / 4.6) * 100) + "%"; }
    render();
    if (alive === 0 || tick > TICKS_PER_HALFLIFE * 4.6) { stop(); }
  }

  function render() {
    read.innerHTML = "";
    var strong = document.createElement("strong");
    strong.textContent = name(sel);
    var counts = document.createElement("span");
    counts.textContent = "parent " + alive + " · decayed " + (N_ATOMS - alive) +
      " · elapsed " + (tick / TICKS_PER_HALFLIFE).toFixed(2) + " half-lives" +
      " · half-life " + sel.hl + " · " + MODES[sel.mode].label;
    var note = document.createElement("span");
    note.textContent = sel.note;
    read.appendChild(strong);
    read.appendChild(counts);
    read.appendChild(note);

    var done = 1 - alive / N_ATOMS;
    var stepIdx = Math.min(sel.chain.length - 1, Math.floor(done * sel.chain.length));
    chainEl.innerHTML = "";
    sel.chain.forEach(function (nuc, i) {
      if (i) { chainEl.appendChild(document.createTextNode(" → ")); }
      if (i === stepIdx && sel.chain.length > 1) {
        var s = document.createElement("strong");
        s.textContent = nuc;
        chainEl.appendChild(s);
      } else {
        chainEl.appendChild(document.createTextNode(nuc));
      }
    });
    if (sel.chain.length > 2) {
      chainEl.appendChild(document.createTextNode("   (simplified to named steps)"));
    }
  }

  function play() {
    if (timer || sel.mode === "stable") { return; }
    timer = setInterval(step, TICK_MS);
    playBtn.innerHTML = "&#10073;&#10073; Pause";
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    playBtn.innerHTML = "&#9654; Play";
  }

  function choose(id) {
    var next = FZ_NUCLIDES.filter(function (x) { return x.id === id; })[0];
    if (!next || (sel && next.id === sel.id)) { return; }
    sel = next;
    presets.querySelectorAll(".fz-btn").forEach(function (b) {
      var on = b.getAttribute("data-iso") === id;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    tagSelected();
    reset();
  }

  function init() {
    chart = document.getElementById("dk-chart");
    presets = document.getElementById("dk-presets");
    atomBox = document.getElementById("dk-atoms");
    timeline = document.getElementById("dk-timeline");
    playBtn = document.getElementById("dk-play");
    resetBtn = document.getElementById("dk-reset");
    speedBtn = document.getElementById("dk-speed");
    chainEl = document.getElementById("dk-chain");
    read = document.getElementById("dk-read");
    legendEl = document.getElementById("dk-legend");

    sel = FZ_NUCLIDES[0];
    buildChart();

    FZ_NUCLIDES.forEach(function (nuc) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "fz-btn";
      b.textContent = name(nuc);
      b.setAttribute("data-iso", nuc.id);
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () { choose(nuc.id); });
      presets.appendChild(b);
    });

    playBtn.addEventListener("click", function () { if (timer) { stop(); } else { play(); } });
    resetBtn.addEventListener("click", reset);
    speedBtn.addEventListener("click", function () {
      speed = speed === 1 ? 4 : (speed === 4 ? 12 : 1);
      speedBtn.textContent = "Speed " + speed + "×";
    });

    sel = null;
    choose("c14");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
