/* AI-ASSISTED: portions of this file were written with the help of an AI assistant (Claude), per course policy. */
/* starship.js: Starship Clock.

   Two ways to cross interstellar distance, compared on the same trip.

   Steady cruise: hold one speed the whole way.
     Earth time  t = d / beta
     your time    tau = t / gamma,  gamma = 1 / sqrt(1 - beta^2)

   Constant boost: burn at a fixed proper acceleration to the midpoint, flip,
   and decelerate in, so you arrive at rest. For each half of distance D:
     Earth time  t = sqrt(D^2 + 2D/a)
     your time    tau = arccosh(a*D + 1) / a

   Units throughout are light years and years, which makes c = 1 and keeps the
   arithmetic honest. Proper acceleration is what the crew feels as gravity,
   which is why one g is the comfortable choice.

   Checked against published figures: one g to Proxima Centauri gives about
   3.5 years aboard and 5.9 on Earth, and one g to Andromeda gives about 28
   years aboard against two and a half million on Earth. */

(function () {
  "use strict";

  /* one g expressed in light years per year squared */
  var G = 9.80665 * Math.pow(3.15576e7, 2) / 9.4607304725808e15;   /* about 1.032 */
  var T_MAX_LOG = 8;              /* the time axis runs 1 year to 100 million */

  var DESTINATIONS = [
    { id: "proxima", name: "Proxima Centauri", d: 4.2465,
      note: "The nearest star to the Sun, with a planet in its habitable zone." },
    { id: "alphacen", name: "Alpha Centauri A", d: 4.37,
      note: "A sun-like star, and the brighter neighbour Proxima orbits." },
    { id: "barnard", name: "Barnard's Star", d: 5.96,
      note: "A red dwarf, and the fastest-moving star in our sky." },
    { id: "sirius", name: "Sirius", d: 8.60,
      note: "The brightest star in the night sky, and a white dwarf companion." },
    { id: "tauceti", name: "Tau Ceti", d: 11.9,
      note: "A quiet sun-like star, and a long-standing favourite target." },
    { id: "trappist", name: "TRAPPIST-1", d: 40.7,
      note: "Seven rocky planets crowded around one dim red dwarf." },
    { id: "kepler186", name: "Kepler-186", d: 580,
      note: "Home to the first Earth-sized planet found in a habitable zone." },
    { id: "sgra", name: "Galactic centre", d: 26000,
      note: "Sagittarius A star, the black hole our whole galaxy turns around." },
    { id: "lmc", name: "Large Magellanic Cloud", d: 163000,
      note: "A satellite galaxy, and the site of the nearest recent supernova." },
    { id: "andromeda", name: "Andromeda Galaxy", d: 2537000,
      note: "The nearest large galaxy, and the one we are on course to merge with." }
  ];

  var MARKERS = [
    ["you-boost", "you, under boost", "var(--phys)"],
    ["you-cruise", "you, at cruise", "var(--yellow)"],
    ["earth", "Earth, under boost", "var(--subtext)"]
  ];

  var betaEl, accelEl, betaOut, accelOut, mapEl, axisEl, legendEl, read;
  var bYou, bEarth, bPeak, cYou, cEarth, cGamma, destName, destDist;
  var sel = DESTINATIONS[0];

  function acosh(x) { return Math.log(x + Math.sqrt(x * x - 1)); }

  /* accelerate to the midpoint, flip, decelerate in */
  function boost(d, gs) {
    var a = gs * G, D = d / 2;
    var tHalf = Math.sqrt(D * D + 2 * D / a);
    var tauHalf = acosh(a * D + 1) / a;
    var v = a * tHalf;
    return { earth: 2 * tHalf, you: 2 * tauHalf, peak: v / Math.sqrt(1 + v * v) };
  }

  function cruise(d, beta) {
    var earth = d / beta;
    var gamma = 1 / Math.sqrt(1 - beta * beta);
    return { earth: earth, you: earth / gamma, gamma: gamma };
  }

  /* years, at every scale from a single trip to the age of a galaxy */
  function yrs(t) {
    if (t < 10) { return t.toFixed(2); }
    if (t < 1000) { return t.toFixed(1); }
    if (t < 1e6) { return Math.round(t).toLocaleString("en-US"); }
    if (t < 1e9) { return (t / 1e6).toFixed(2) + " million"; }
    return (t / 1e9).toFixed(2) + " billion";
  }

  function pos(t) {
    var p = Math.log(Math.max(t, 1)) / Math.LN10 / T_MAX_LOG * 100;
    return Math.max(0, Math.min(100, p));
  }

  function settings() {
    return { beta: parseInt(betaEl.value, 10) / 100, gs: parseInt(accelEl.value, 10) / 10 };
  }

  function buildMap() {
    mapEl.innerHTML = "";
    DESTINATIONS.forEach(function (dst) {
      var row = document.createElement("button");
      row.type = "button";
      row.className = "ss-row";
      row.setAttribute("data-id", dst.id);
      row.setAttribute("aria-pressed", "false");

      var nm = document.createElement("span");
      nm.className = "nm";
      nm.textContent = dst.name;

      var track = document.createElement("span");
      track.className = "track";
      var link = document.createElement("span");
      link.className = "link";
      track.appendChild(link);
      MARKERS.forEach(function (m) {
        var dot = document.createElement("span");
        dot.className = "dot " + m[0];
        dot.style.background = m[2];
        track.appendChild(dot);
      });

      row.appendChild(nm);
      row.appendChild(track);
      row.addEventListener("click", function () { choose(dst.id); });
      mapEl.appendChild(row);
    });

    axisEl.innerHTML = "";
    [[1, "1 yr"], [10, "10 yr"], [100, "100 yr"], [1e3, "1 kyr"],
     [1e4, "10 kyr"], [1e5, "100 kyr"], [1e6, "1 Myr"], [1e7, "10 Myr"], [1e8, "100 Myr"]]
      .forEach(function (t) {
        var s = document.createElement("span");
        s.style.left = pos(t[0]) + "%";
        s.textContent = t[1];
        axisEl.appendChild(s);
      });

    legendEl.innerHTML = "";
    MARKERS.forEach(function (m) {
      var s = document.createElement("span");
      var sw = document.createElement("span");
      sw.style.background = m[2];
      s.appendChild(sw);
      s.appendChild(document.createTextNode(m[1]));
      legendEl.appendChild(s);
    });
  }

  function paintMap() {
    var st = settings();
    DESTINATIONS.forEach(function (dst) {
      var row = mapEl.querySelector('[data-id="' + dst.id + '"]');
      if (!row) { return; }
      var b = boost(dst.d, st.gs), c = cruise(dst.d, st.beta);
      var pB = pos(b.you), pC = pos(c.you), pE = pos(b.earth);

      row.querySelector(".you-boost").style.left = pB + "%";
      row.querySelector(".you-cruise").style.left = pC + "%";
      row.querySelector(".earth").style.left = pE + "%";

      /* the bar spans from the fastest arrival to what Earth sits through */
      var lo = Math.min(pB, pC), hi = Math.max(pE, pC);
      var link = row.querySelector(".link");
      link.style.left = lo + "%";
      link.style.width = Math.max(0, hi - lo) + "%";

      row.setAttribute("aria-label", dst.name + ", " + yrs(dst.d) +
        " light years. Under boost you experience " + yrs(b.you) +
        " years and Earth waits " + yrs(b.earth) +
        ". At cruise you experience " + yrs(c.you) + " years and Earth waits " + yrs(c.earth) + ".");
      row.classList.toggle("on", dst.id === sel.id);
      row.setAttribute("aria-pressed", dst.id === sel.id ? "true" : "false");
    });
  }

  function update() {
    var st = settings();
    betaOut.textContent = Math.round(st.beta * 100) + "% of c";
    accelOut.textContent = st.gs.toFixed(1) + " g";

    var b = boost(sel.d, st.gs), c = cruise(sel.d, st.beta);

    destName.textContent = sel.name;
    destDist.textContent = yrs(sel.d) + " light years away";

    bYou.textContent = yrs(b.you);
    bEarth.textContent = yrs(b.earth);
    /* round down, never up: nothing reaches c, so the readout must not say 100 */
    var pk = b.peak * 100, digits = pk > 99.9 ? 3 : 1, f = Math.pow(10, digits);
    bPeak.textContent = (Math.floor(pk * f) / f).toFixed(digits) + "%";

    cYou.textContent = yrs(c.you);
    cEarth.textContent = yrs(c.earth);
    cGamma.textContent = c.gamma.toFixed(2);

    read.innerHTML = "";
    var strong = document.createElement("strong");
    strong.textContent = sel.name;
    var line = document.createElement("span");
    line.textContent = "boost gets you there in " + yrs(b.you) + " years and costs Earth " +
      yrs(b.earth) + " · cruise takes you " + yrs(c.you) + " and costs Earth " + yrs(c.earth);
    var note = document.createElement("span");
    note.textContent = sel.note;
    read.appendChild(strong);
    read.appendChild(line);
    read.appendChild(note);

    paintMap();
  }

  function choose(id) {
    var next = DESTINATIONS.filter(function (x) { return x.id === id; })[0];
    if (!next) { return; }
    sel = next;
    update();
  }

  function init() {
    betaEl = document.getElementById("ss-beta");
    accelEl = document.getElementById("ss-accel");
    betaOut = document.getElementById("ss-beta-out");
    accelOut = document.getElementById("ss-accel-out");
    mapEl = document.getElementById("ss-map");
    axisEl = document.getElementById("ss-axis");
    legendEl = document.getElementById("ss-legend");
    read = document.getElementById("ss-read");
    destName = document.getElementById("ss-dest");
    destDist = document.getElementById("ss-dist");
    bYou = document.getElementById("ss-b-you");
    bEarth = document.getElementById("ss-b-earth");
    bPeak = document.getElementById("ss-b-peak");
    cYou = document.getElementById("ss-c-you");
    cEarth = document.getElementById("ss-c-earth");
    cGamma = document.getElementById("ss-c-gamma");

    buildMap();
    [betaEl, accelEl].forEach(function (el) {
      el.addEventListener("input", update);
    });
    update();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
