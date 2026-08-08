/* AI-ASSISTED: portions of this file were written with the help of an AI assistant (Claude), per course policy. */
/* rocket.js: Rocket Lab.
   Tsiolkovsky rocket equation: dv = Isp * g0 * ln(m0 / m1).
   Pick an engine, set dry mass and fuel mass, and everything recomputes live.

   One result drives the whole page: the delta-v number. It fills the budget
   meter, picks the verdict, and chooses which trajectory gets drawn. */

(function () {
  "use strict";

  var G0 = 9.80665;          /* standard gravity, m/s^2 */
  var ORBIT = 9400;          /* low Earth orbit budget, m/s, losses included */
  var ESCAPE = 12690;        /* orbit plus the 3,290 m/s that leaves Earth */
  var SCALE_MAX = 14000;     /* full width of the delta-v meter */

  var ENGINES = [
    { name: "solid booster", isp: 250,
      note: "Solid booster. Simple, powerful, and impossible to throttle or shut down once lit. Every Shuttle launch used two." },
    { name: "kerolox", isp: 311,
      note: "Kerolox burns kerosene with liquid oxygen. Dense, well understood, and the first stage of most rockets flying today." },
    { name: "hydrolox", isp: 450,
      note: "Hydrolox burns liquid hydrogen. The best exhaust speed of any chemical engine, but hydrogen is bulky and must be kept near absolute zero." },
    { name: "ion thruster", isp: 3000,
      note: "An ion thruster throws xenon out at enormous speed and pushes about as hard as a sheet of paper resting on your hand. Wonderful in space, useless on the pad." }
  ];

  var VERDICTS = [
    [0.30, "Lawn dart", "it goes up, it comes down, quickly"],
    [0.60, "Impressive firework", "you cleared the tower and not much else"],
    [0.85, "Suborbital hop", "space, briefly. no orbit."],
    [1.00, "So close", "a little more fuel or a better engine"],
    [1.35, "Orbit", "you made it around, congratulations"],
    [99.0, "Escape trajectory", "you have more delta-v than you know what to do with"]
  ];

  var dry, fuel, dryOut, fuelOut, fill, head, dvLabel, verdict, read, tank, flame;
  var pathEl, craftEl, orbitLab, engNote, engBtns, meter, eqEl, ratioEl, veEl;
  var engIndex = 1;

  /* ---------- trajectory drawing ----------
     Side view of Earth: center (160,176), radius 88, launch site at the top
     (160,88). The shape of the path is chosen by how much of the orbital
     budget you bought, which is the whole point of the page. */
  var CX = 160, CY = 176, R = 88;

  function trajectory(ratio) {
    if (ratio < 0.30) {
      /* barely leaves the pad */
      return { d: "M160 88 q9 -13 18 -2 q8 9 17 20", lab: "ballistic arc" };
    }
    if (ratio < 0.60) {
      /* a real arc, still falls straight back down */
      return { d: "M160 88 q30 -40 66 -6 q20 19 33 46", lab: "high ballistic arc" };
    }
    if (ratio < 0.85) {
      /* suborbital: crosses space, comes back */
      return { d: "M160 88 q52 -58 104 -8 q30 27 40 78", lab: "suborbital, comes back down" };
    }
    if (ratio < 1.0) {
      /* almost closes the circle */
      return { d: arc(0.82), lab: "almost an orbit, and almost does not count" };
    }
    if (ratio < 1.35) {
      /* a closed circular orbit */
      return { d: circle(R + 36), lab: "closed orbit", closed: true };
    }
    /* escape: opens out and never returns */
    return { d: "M160 88 C246 64 306 126 314 46", lab: "escape trajectory, never returns" };
  }

  function circle(r) {
    return "M" + CX + " " + (CY - r) +
      " a" + r + " " + r + " 0 1 1 -0.1 0 z";
  }

  function arc(frac) {
    /* an open arc of the orbit, swept clockwise from the launch site */
    var r = R + 30;
    var a = -Math.PI / 2 + Math.PI * 2 * frac;
    var x = CX + r * Math.cos(a), y = CY + r * Math.sin(a);
    var large = frac > 0.5 ? 1 : 0;
    return "M" + CX + " " + (CY - r) + " A" + r + " " + r + " 0 " + large + " 1 " +
      x.toFixed(1) + " " + y.toFixed(1);
  }

  function drawPath(ratio) {
    var t = trajectory(ratio);
    pathEl.setAttribute("d", t.d);
    orbitLab.textContent = t.lab;
    /* park the craft at the end of the drawn path */
    var len = pathEl.getTotalLength ? pathEl.getTotalLength() : 0;
    if (len) {
      var p = pathEl.getPointAtLength(t.closed ? len * 0.25 : len);
      craftEl.setAttribute("cx", p.x);
      craftEl.setAttribute("cy", p.y);
    }
  }

  function num(v) { return Math.round(v).toLocaleString("en-US"); }

  function update() {
    var m1 = parseFloat(dry.value);                 /* dry mass, tonnes */
    var mf = parseFloat(fuel.value);                /* fuel mass, tonnes */
    var eng = ENGINES[engIndex];
    var m0 = m1 + mf;
    var ve = eng.isp * G0;                          /* exhaust speed, m/s */
    var dv = ve * Math.log(m0 / m1);

    dryOut.textContent = m1 + " t";
    fuelOut.textContent = mf + " t";
    ratioEl.textContent = (m0 / m1).toFixed(2);
    veEl.textContent = num(ve) + " m/s";

    /* the equation with this rocket's own numbers in it */
    eqEl.innerHTML = "";
    [["Δv = ", "op"], [num(ve) + " m/s", "v"], [" × ln(", "op"],
      [m0 + " t", "v"], [" ÷ ", "op"], [m1 + " t", "v"], [") = ", "op"],
      [num(dv) + " m/s", "out"]].forEach(function (bit) {
        var s = document.createElement("span");
        s.className = bit[1];
        s.textContent = bit[0];
        eqEl.appendChild(s);
      });

    var pct = Math.min(100, (dv / SCALE_MAX) * 100);
    fill.style.width = pct.toFixed(1) + "%";
    head.style.left = pct.toFixed(1) + "%";
    head.classList.toggle("far", pct > 74);
    dvLabel.textContent = num(dv) + " m/s";

    var ratio = dv / ORBIT;
    var v = VERDICTS.filter(function (x) { return ratio <= x[0]; })[0];
    /* An ion thruster has the delta-v on paper but nowhere near the thrust to
       leave the pad, so it never gets a launch verdict. */
    if (eng.isp >= 3000) {
      v = ["", "Still on the pad",
        "the delta-v is real; the thrust is not. ion engines only work once you are already in space."];
    }
    verdict.innerHTML = "";
    verdict.appendChild(document.createTextNode(v[1]));
    var sub = document.createElement("span");
    sub.className = "sub";
    sub.textContent = v[2];
    verdict.appendChild(sub);
    meter.setAttribute("data-zone",
      eng.isp >= 3000 ? "pad" : dv >= ESCAPE ? "escape" : dv >= ORBIT ? "orbit" : "fall");

    /* fuel tank fills from the bottom of the airframe */
    var h = Math.max(6, (mf / 400) * 88);
    tank.setAttribute("height", h.toFixed(1));
    tank.setAttribute("y", (200 - h).toFixed(1));
    flame.style.opacity = eng.isp >= 3000 ? "0.15"
      : ratio >= 1 ? "1" : String(0.25 + ratio * 0.6);

    read.innerHTML = "";
    var strong = document.createElement("strong");
    strong.textContent = "Δv " + num(dv) + " m/s";
    var detail = document.createElement("span");
    detail.textContent = "wet " + m0 + " t · dry " + m1 + " t · " + eng.name +
      " (Isp " + eng.isp + " s) · mass ratio " + (m0 / m1).toFixed(2) +
      " · " + (ratio * 100).toFixed(0) + "% of the orbit budget";
    read.appendChild(strong);
    read.appendChild(detail);

    /* an ion thruster never leaves the pad, whatever the equation says */
    drawPath(eng.isp >= 3000 ? 0 : ratio);
    writeHash(m1, mf);
  }

  /* ---------- sharing a design ----------
     The whole design is three numbers, so it fits in the address bar. A link
     like rocket.html#dry=4&fuel=300&eng=2 opens someone else's rocket. */
  var hashLock = false;

  function writeHash(m1, mf) {
    if (hashLock || !history.replaceState) { return; }
    var h = "#dry=" + m1 + "&fuel=" + mf + "&eng=" + engIndex;
    if (location.hash !== h) { history.replaceState(null, "", h); }
  }

  function readHash() {
    var h = location.hash || "";
    function grab(key, lo, hi) {
      var m = new RegExp("[#&]" + key + "=(\\d+)").exec(h);
      if (!m) { return null; }
      var v = parseInt(m[1], 10);
      return v >= lo && v <= hi ? v : null;
    }
    var d = grab("dry", 1, 30), f = grab("fuel", 1, 400), e = grab("eng", 0, 3);
    if (d === null && f === null && e === null) { return false; }
    hashLock = true;
    if (d !== null) { dry.value = d; }
    if (f !== null) { fuel.value = f; }
    hashLock = false;
    setEngine(e === null ? engIndex : e);
    return true;
  }

  function setEngine(i) {
    engIndex = i;
    engBtns.forEach(function (b) {
      var on = parseInt(b.getAttribute("data-eng"), 10) === i;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    engNote.textContent = ENGINES[i].note + " Specific impulse " + ENGINES[i].isp + " seconds.";
    update();
  }

  function init() {
    dry = document.getElementById("rk-dry");
    fuel = document.getElementById("rk-fuel");
    dryOut = document.getElementById("rk-dry-out");
    fuelOut = document.getElementById("rk-fuel-out");
    fill = document.getElementById("rk-fill");
    head = document.getElementById("rk-head");
    dvLabel = document.getElementById("rk-dv");
    verdict = document.getElementById("rk-verdict");
    read = document.getElementById("rk-read");
    tank = document.getElementById("rk-tank");
    flame = document.getElementById("rk-flame");
    pathEl = document.getElementById("rk-path");
    craftEl = document.getElementById("rk-craft");
    orbitLab = document.getElementById("rk-orbitlab");
    engNote = document.getElementById("rk-engnote");
    meter = document.getElementById("rk-meter");
    eqEl = document.getElementById("rk-eq");
    ratioEl = document.getElementById("rk-ratio");
    veEl = document.getElementById("rk-ve");
    engBtns = document.querySelectorAll("#rk-engines .fz-btn");

    /* the meter bands come from the same constants the physics uses */
    meter.style.setProperty("--orbit", (ORBIT / SCALE_MAX * 100).toFixed(2) + "%");
    meter.style.setProperty("--escape", (ESCAPE / SCALE_MAX * 100).toFixed(2) + "%");

    engBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        setEngine(parseInt(b.getAttribute("data-eng"), 10));
      });
    });
    [dry, fuel].forEach(function (el) { el.addEventListener("input", update); });
    window.addEventListener("hashchange", function () { readHash(); });
    if (!readHash()) { setEngine(1); }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
