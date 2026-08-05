/* AI-ASSISTED: portions of this file were written with the help of an AI assistant (Claude), per course policy. */
/* decay.js: Nuclide Decay.

   Left panel: a chart of nuclides, neutrons across and protons up. The faint
   band behind is a schematic of the valley of stability. On top of it sit the
   30 nuclides from decay-data.js, at their true (N, Z) and colored by decay
   mode. Any of them can be selected, by mouse or by keyboard.

   Right panel: 400 atoms walking down the decay chain. Every atom carries its
   own position in the chain and rolls its own dice each tick against the real
   half-life of whichever nuclide it currently is, so daughters decay too and
   the curve is stochastic rather than scripted.

   Time is scaled to the parent: one parent half-life always takes the same
   wall time. Steps far faster than the parent are held to a floor of MIN_TICKS
   so they stay visible instead of flashing past in a single frame. That floor
   is the one deliberate distortion here, and the caption says so. */

(function () {
  "use strict";

  var N_ATOMS = 400;
  var TICK_MS = 100;
  var TICKS_PER_HALFLIFE = 24;   /* for the parent, at 1x */
  var MIN_TICKS = 4;             /* visibility floor for very fast daughters */
  var SPAN = 4.6;                /* how many parent half-lives a run covers */

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

  var UNIT_S = { s: 1, min: 60, h: 3600, d: 86400, y: 31557600,
                 ky: 3.15576e10, My: 3.15576e13, Gy: 3.15576e16, Ey: 3.15576e25 };
  var UNIT_LABEL = { s: "seconds", min: "minutes", h: "hours", d: "days",
                     y: "years", ky: "thousand years", My: "million years",
                     Gy: "billion years", Ey: "billion billion years" };

  /* one color per position in the chain; the last step is always the calm one */
  var CHAIN_COLORS = ["var(--pink)", "var(--phys)", "var(--yellow)",
                      "var(--lavender)", "var(--chem)"];

  var chart, presets, atomBox, timeline, timesEl, playBtn, resetBtn, speedBtn,
      chainEl, read, legendEl;
  var atoms = [], stages = [], stageTicks = [], counts = [];
  var tick = 0, timer = null, speed = 1, sel = null;

  function name(nuc) { return nuc.sym + "-" + nuc.a + (nuc.m ? "m" : ""); }
  function secondsOf(step) { return step.stable ? Infinity : step.v * UNIT_S[step.u]; }
  function lastIndex() { return sel.chain.length - 1; }

  function colorOf(i) {
    return i === lastIndex() ? "var(--bio)" : CHAIN_COLORS[i % CHAIN_COLORS.length];
  }

  function num(x) {
    return x >= 1000 ? Math.round(x).toLocaleString("en-US") : String(x);
  }

  /* half-life text keeps the unit it was authored in, which is the usual one */
  function fmtHL(step) {
    return step.stable ? "stable" : num(step.v) + " " + UNIT_LABEL[step.u];
  }

  /* elapsed and axis times are computed, so they get a general humanizer */
  function fmtDuration(s) {
    function t(x) {
      if (x >= 1000) { return Math.round(x).toLocaleString("en-US"); }
      if (x >= 100) { return String(Math.round(x)); }
      return (x >= 10 ? x.toFixed(1) : x.toFixed(2)).replace(/\.?0+$/, "");
    }
    if (!isFinite(s)) { return "never"; }
    if (s < 90) { return t(s) + " seconds"; }
    if (s < 5400) { return t(s / 60) + " minutes"; }
    if (s < 172800) { return t(s / 3600) + " hours"; }
    var y = s / UNIT_S.y;
    if (y < 1) { return t(s / 86400) + " days"; }
    if (y < 1e5) { return t(y) + " years"; }
    if (y < 1e6) { return t(y / 1e3) + " thousand years"; }
    if (y < 1e9) { return t(y / 1e6) + " million years"; }
    if (y < 1e12) { return t(y / 1e9) + " billion years"; }
    return t(y / 1e18) + " billion billion years";
  }

  /* compact form for the four axis marks, which have little room */
  function fmtShort(s) {
    function t(x) { return x >= 100 ? String(Math.round(x)) : (x >= 10 ? x.toFixed(1) : x.toFixed(2)).replace(/\.?0+$/, ""); }
    if (!isFinite(s)) { return "never"; }
    if (s < 90) { return t(s) + " s"; }
    if (s < 5400) { return t(s / 60) + " min"; }
    if (s < 172800) { return t(s / 3600) + " h"; }
    var y = s / UNIT_S.y;
    if (y < 1) { return t(s / 86400) + " d"; }
    if (y < 1e3) { return t(y) + " yr"; }
    if (y < 1e6) { return t(y / 1e3) + " kyr"; }
    if (y < 1e9) { return t(y / 1e6) + " Myr"; }
    if (y < 1e12) { return t(y / 1e9) + " Gyr"; }
    return t(y / 1e18) + " Eyr";
  }

  function px(n) { return X0 + (n / N_MAX) * (X1 - X0); }
  function py(z) { return Y0 + (z / Z_MAX) * (Y1 - Y0); }

  /* ---------- chart ---------- */
  function buildChart() {
    var svg = ['<svg viewBox="0 0 ' + VW + ' ' + VH + '" role="group" ' +
      'aria-label="Chart of nuclides. Neutrons across, protons up. Select a nuclide.">'];

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

    svg.push('<rect x="' + px(174).toFixed(1) + '" y="' + py(120).toFixed(1) +
      '" width="' + (px(194) - px(174)).toFixed(1) + '" height="' + (py(106) - py(120)).toFixed(1) +
      '" fill="none" stroke="var(--pink)" stroke-width="1.2" stroke-dasharray="4 3"/>');
    svg.push('<text x="' + px(172).toFixed(1) + '" y="' + (py(113) + 3).toFixed(1) +
      '" font-size="7.5" fill="var(--pink)" text-anchor="end" font-family="monospace">island of stability?</text>');

    FZ_NUCLIDES.forEach(function (nuc) {
      svg.push('<g class="dk-nuc" data-id="' + nuc.id + '" tabindex="0" role="button" ' +
        'aria-label="' + name(nuc) + ", " + MODES[nuc.mode].label +
        ", half-life " + fmtHL(nuc.chain[0]) + '">' +
        '<circle cx="' + px(nuc.n).toFixed(1) + '" cy="' + py(nuc.z).toFixed(1) +
        '" r="5" fill="' + MODES[nuc.mode].color + '" stroke="var(--border)" stroke-width="1.2"/>' +
        "</g>");
    });

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
    var left = x > VW - 70;
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
  function prepare() {
    /* how many ticks one half-life of each step is worth, on a clock scaled
       to the parent. A daughter far faster than its parent would otherwise
       finish within one frame, so hold it to a visible floor. */
    var base = secondsOf(sel.chain[0]);
    stageTicks = sel.chain.map(function (step) {
      if (step.stable || !isFinite(base)) { return Infinity; }
      return Math.max(MIN_TICKS, TICKS_PER_HALFLIFE * (secondsOf(step) / base));
    });
  }

  function reset() {
    stop();
    tick = 0;
    prepare();
    atomBox.innerHTML = "";
    atoms = [];
    stages = [];
    var c0 = colorOf(0);
    var frag = document.createDocumentFragment();
    for (var i = 0; i < N_ATOMS; i++) {
      var a = document.createElement("span");
      a.style.background = c0;
      frag.appendChild(a);
      atoms.push(a);
      stages.push(0);
    }
    atomBox.appendChild(frag);
    drawTimeline();
    tally();
    render();
  }

  function drawTimeline() {
    var marks = "", times = "";
    var base = secondsOf(sel.chain[0]);
    for (var h = 1; h <= 4; h++) {
      var left = (h / SPAN) * 100;
      marks += '<span class="tick" style="left:' + left + '%"><em>' + h + " t½</em></span>";
      times += '<span style="left:' + left + '%">' +
        (isFinite(base) ? fmtShort(h * base) : "never") + "</span>";
    }
    marks += '<span class="cursor" id="dk-cursor" style="left:0%"></span>';
    timeline.innerHTML = marks;
    timesEl.innerHTML = times;
  }

  function tally() {
    counts = sel.chain.map(function () { return 0; });
    for (var i = 0; i < stages.length; i++) { counts[stages[i]]++; }
  }

  function step() {
    var last = lastIndex();
    if (last === 0) { return; }              /* a stable nuclide does nothing */
    tick += speed;

    /* every atom rolls against the half-life of whatever it currently is */
    for (var i = 0; i < atoms.length; i++) {
      var st = stages[i];
      if (st >= last) { continue; }
      var tph = stageTicks[st];
      if (!isFinite(tph)) { continue; }
      if (Math.random() < 1 - Math.pow(0.5, speed / tph)) {
        stages[i] = st + 1;
        atoms[i].style.background = colorOf(st + 1);
      }
    }

    var cur = document.getElementById("dk-cursor");
    if (cur) { cur.style.left = Math.min(100, (tick / TICKS_PER_HALFLIFE / SPAN) * 100) + "%"; }

    tally();
    render();
    if (counts[last] === N_ATOMS || tick > TICKS_PER_HALFLIFE * SPAN) { stop(); }
  }

  function render() {
    var base = secondsOf(sel.chain[0]);
    var elapsed = tick / TICKS_PER_HALFLIFE;

    read.innerHTML = "";
    var strong = document.createElement("strong");
    strong.textContent = name(sel);
    var line = document.createElement("span");
    line.textContent = "half-life " + fmtHL(sel.chain[0]) + " · " + MODES[sel.mode].label +
      " · elapsed " + elapsed.toFixed(2) + " half-lives" +
      (isFinite(base) ? " (" + fmtDuration(elapsed * base) + ")" : "");
    var note = document.createElement("span");
    note.textContent = sel.note;
    read.appendChild(strong);
    read.appendChild(line);
    read.appendChild(note);

    /* the chain doubles as the color key for the atom grid */
    chainEl.innerHTML = "";
    sel.chain.forEach(function (stp, i) {
      var li = document.createElement("li");
      if (counts[i] > 0) { li.className = "live"; }

      var sw = document.createElement("span");
      sw.className = "sw";
      sw.style.background = colorOf(i);

      var nm = document.createElement("strong");
      nm.textContent = stp.n;

      var hl = document.createElement("span");
      hl.className = "hl";
      hl.textContent = fmtHL(stp);

      var ct = document.createElement("span");
      ct.className = "ct";
      ct.textContent = counts[i];

      li.appendChild(sw);
      li.appendChild(nm);
      li.appendChild(hl);
      li.appendChild(ct);
      chainEl.appendChild(li);
    });
  }

  function play() {
    if (timer || lastIndex() === 0) { return; }
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
    timesEl = document.getElementById("dk-times");
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
    choose("u238");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
