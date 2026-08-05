/* AI-ASSISTED: portions of this file were written with the help of an AI assistant (Claude), per course policy. */
/* decay.js: Nuclide Decay.
   Left panel: a schematic chart of nuclides (N across, Z up). It draws the shape
   of the valley of stability rather than plotting measured nuclides, with
   stability and the predicted island of stability marked.
   Right panel: 400 atoms, each rolling its own dice per tick against the real
   half-life, so the curve is genuinely stochastic. Time is display-scaled. */

(function () {
  "use strict";

  var N_ATOMS = 400;
  var TICK_MS = 100;          /* one animation tick */
  var TICKS_PER_HALFLIFE = 24; /* display scale: a half-life takes 2.4 s at 1x */

  /* Presets: real half-lives, simplified named decay chains. */
  var ISOTOPES = [
    { id: "c14",  label: "C-14",   z: 6,  n: 8,   hl: "5,730 years",   mode: "beta minus",
      chain: ["C-14", "N-14 (stable)"],
      note: "Radiocarbon dating. Made in the atmosphere, taken up by everything alive." },
    { id: "c12",  label: "C-12",   z: 6,  n: 6,   hl: "stable",        mode: "none",
      chain: ["C-12 (stable)"], stable: true,
      note: "The control. Press play and nothing happens, which is the point." },
    { id: "tc99", label: "Tc-99m", z: 43, n: 56,  hl: "6.0 hours",     mode: "gamma",
      chain: ["Tc-99m", "Tc-99", "Ru-99 (stable)"],
      note: "The workhorse of medical imaging. Short enough to leave the body fast." },
    { id: "i131", label: "I-131",  z: 53, n: 78,  hl: "8.0 days",      mode: "beta minus",
      chain: ["I-131", "Xe-131 (stable)"],
      note: "Used to treat thyroid disease, and released by reactor accidents." },
    { id: "ra226", label: "Ra-226", z: 88, n: 138, hl: "1,600 years",  mode: "alpha",
      chain: ["Ra-226", "Rn-222", "Po-218", "Pb-206 (stable)"],
      note: "Marie Curie's radium. The chain here is shortened to its named steps." },
    { id: "u238", label: "U-238",  z: 92, n: 146, hl: "4.5 billion years", mode: "alpha",
      chain: ["U-238", "Th-234", "Ra-226", "Pb-206 (stable)"],
      note: "Older than the Earth's crust, and still most of the uranium in it." }
  ];

  var chart, presets, atomBox, timeline, playBtn, resetBtn, speedBtn, chainEl, read;
  var atoms = [], alive = N_ATOMS, tick = 0, timer = null, speed = 1, sel = ISOTOPES[0];

  /* ---------- chart of nuclides ---------- */
  function buildChart() {
    var W = 60, H = 50;   /* N up to 180, Z up to 120, binned */
    var cells = [];
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var N = x * 3, Z = y * 2.5;
        if (Z < 2) { continue; }
        /* the valley of stability: N/Z about 1 for light, rising to about 1.5 heavy */
        var want = Z + Z * Z / 100;
        var off = Math.abs(N - want);
        if (off > 16 || Z > 118) { continue; }
        var cls, tone;
        if (off < 2.2) { tone = "var(--chem)"; cls = "stable"; }
        else if (N > want) { tone = "color-mix(in oklab, var(--phys) 55%, var(--card))"; cls = "b-"; }
        else { tone = "color-mix(in oklab, var(--yellow) 60%, var(--card))"; cls = "b+"; }
        if (Z > 84 && off < 8) { tone = "color-mix(in oklab, var(--pink) 55%, var(--card))"; cls = "alpha"; }
        cells.push('<span style="left:' + (x / W * 100) + '%;bottom:' + (y / H * 100) +
          '%;background:' + tone + '" data-c="' + cls + '"></span>');
      }
    }
    chart.innerHTML =
      '<div class="dk-cells">' + cells.join("") + "</div>" +
      '<div class="dk-island" title="predicted island of stability"></div>' +
      '<div class="dk-islandlab">island of<br>stability?</div>' +
      '<div class="dk-markers"></div>';
    chart.style.aspectRatio = "6 / 5";

    /* preset markers, positioned on the same scale */
    var mk = chart.querySelector(".dk-markers");
    ISOTOPES.forEach(function (iso) {
      var d = document.createElement("button");
      d.type = "button";
      d.className = "dk-mark";
      d.style.left = (iso.n / 180 * 100) + "%";
      d.style.bottom = (iso.z / 125 * 100) + "%";
      d.setAttribute("aria-label", "Select " + iso.label);
      d.setAttribute("data-iso", iso.id);
      d.addEventListener("click", function () { choose(iso.id); });
      mk.appendChild(d);
    });
  }

  /* ---------- simulation ---------- */
  function reset() {
    stop();
    tick = 0;
    alive = N_ATOMS;
    atomBox.innerHTML = "";
    atoms = [];
    for (var i = 0; i < N_ATOMS; i++) {
      var a = document.createElement("span");
      atomBox.appendChild(a);
      atoms.push(a);
    }
    drawTimeline();
    render();
  }

  function drawTimeline() {
    var html = "";
    for (var h = 1; h <= 4; h++) {
      var pct = (h / 4.6) * 100;
      html += '<span class="tick" style="left:' + pct + '%"><em>' + h + " t½</em></span>";
    }
    html += '<span class="cursor" id="dk-cursor" style="left:0%"></span>';
    timeline.innerHTML = html;
  }

  function step() {
    if (sel.stable) { return; }
    tick += speed;
    /* probability an individual atom decays this tick */
    var p = 1 - Math.pow(0.5, speed / TICKS_PER_HALFLIFE);
    for (var i = 0; i < atoms.length; i++) {
      if (!atoms[i].classList.contains("gone") && Math.random() < p) {
        atoms[i].classList.add("gone");
        alive--;
      }
    }
    var cur = document.getElementById("dk-cursor");
    if (cur) {
      cur.style.left = Math.min(100, (tick / TICKS_PER_HALFLIFE / 4.6) * 100) + "%";
    }
    render();
    if (alive === 0 || tick > TICKS_PER_HALFLIFE * 4.6) { stop(); }
  }

  function render() {
    var elapsed = (tick / TICKS_PER_HALFLIFE).toFixed(2);
    read.innerHTML = "";
    var strong = document.createElement("strong");
    strong.textContent = sel.label;
    var counts = document.createElement("span");
    counts.textContent = "parent " + alive + " · daughter " + (N_ATOMS - alive) +
      " · elapsed " + elapsed + " half-lives · half-life " + sel.hl + " · " + sel.mode;
    var note = document.createElement("span");
    note.textContent = sel.note;
    read.appendChild(strong);
    read.appendChild(counts);
    read.appendChild(note);

    /* chain readout steps forward as the parent population drains */
    var done = 1 - alive / N_ATOMS;
    var stepIdx = Math.min(sel.chain.length - 1, Math.floor(done * sel.chain.length));
    chainEl.innerHTML = "";
    sel.chain.forEach(function (nuc, i) {
      if (i) { chainEl.appendChild(document.createTextNode(" → ")); }
      if (i === stepIdx) {
        var s = document.createElement("strong");
        s.textContent = nuc;
        chainEl.appendChild(s);
      } else {
        chainEl.appendChild(document.createTextNode(nuc));
      }
    });
    chainEl.appendChild(document.createTextNode("  (simplified chain)"));
  }

  function play() {
    if (timer || sel.stable) { return; }
    timer = setInterval(step, TICK_MS);
    playBtn.innerHTML = "&#10073;&#10073; Pause";
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    playBtn.innerHTML = "&#9654; Play";
  }

  function choose(id) {
    sel = ISOTOPES.filter(function (x) { return x.id === id; })[0] || ISOTOPES[0];
    presets.querySelectorAll(".fz-btn").forEach(function (b) {
      var on = b.getAttribute("data-iso") === id;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    chart.querySelectorAll(".dk-mark").forEach(function (m) {
      m.classList.toggle("on", m.getAttribute("data-iso") === id);
    });
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

    buildChart();

    ISOTOPES.forEach(function (iso) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "fz-btn";
      b.textContent = iso.label;
      b.setAttribute("data-iso", iso.id);
      b.addEventListener("click", function () { choose(iso.id); });
      presets.appendChild(b);
    });

    playBtn.addEventListener("click", function () {
      if (timer) { stop(); } else { play(); }
    });
    resetBtn.addEventListener("click", reset);
    speedBtn.addEventListener("click", function () {
      speed = speed === 1 ? 4 : speed === 4 ? 12 : 1;
      speedBtn.textContent = "Speed " + speed + "×";
    });

    choose("c14");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
