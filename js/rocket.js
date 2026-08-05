/* AI-ASSISTED: portions of this file were written with the help of an AI assistant (Claude), per course policy. */
/* rocket.js: Rocket Lab.
   Tsiolkovsky rocket equation: dv = Isp * g0 * ln(m0 / m1).
   Sliders set dry mass, fuel mass, and engine. Everything recomputes live. */

(function () {
  "use strict";

  var G0 = 9.80665;          /* standard gravity, m/s^2 */
  var ORBIT = 9400;          /* rough low Earth orbit budget, m/s, losses included */
  var SCALE_MAX = 14000;     /* full width of the delta-v bar */

  var ENGINES = [
    { name: "solid booster", isp: 250 },
    { name: "kerolox", isp: 311 },
    { name: "hydrolox", isp: 450 },
    { name: "ion thruster (in space only)", isp: 3000 }
  ];

  var VERDICTS = [
    [0.30, "Lawn dart", "it goes up, it comes down, quickly"],
    [0.60, "Impressive firework", "you cleared the tower and not much else"],
    [0.85, "Suborbital hop", "space, briefly. no orbit."],
    [1.00, "So close", "a little more fuel or a better engine"],
    [1.35, "Orbit", "you made it around, congratulations"],
    [99.0, "Escape trajectory", "you have more delta-v than you know what to do with"]
  ];

  var dry, fuel, isp, dryOut, fuelOut, ispOut, fill, goal, dvLabel, verdict, read, tank, flame;
  var pathEl, craftEl, orbitLab;

  /* ---------- trajectory drawing ----------
     Side view of Earth: centre (160,176), radius 88, launch site at the top
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

  function update() {
    var m1 = parseFloat(dry.value);                 /* dry mass, tonnes */
    var mf = parseFloat(fuel.value);                /* fuel mass, tonnes */
    var eng = ENGINES[parseInt(isp.value, 10)];
    var m0 = m1 + mf;
    var dv = eng.isp * G0 * Math.log(m0 / m1);

    dryOut.textContent = m1 + " t";
    fuelOut.textContent = mf + " t";
    ispOut.textContent = eng.name + ", " + eng.isp + " s";

    var pct = Math.min(100, (dv / SCALE_MAX) * 100);
    fill.style.width = pct.toFixed(1) + "%";
    goal.style.left = ((ORBIT / SCALE_MAX) * 100).toFixed(1) + "%";
    dvLabel.textContent = "Δv " + Math.round(dv).toLocaleString("en-US") + " m/s";

    var ratio = dv / ORBIT;
    var v = VERDICTS.filter(function (x) { return ratio <= x[0]; })[0];
    /* An ion thruster has the delta-v on paper but nowhere near the thrust to
       leave the pad, so it never gets a launch verdict. */
    if (eng.isp >= 3000) {
      v = ["", "Still on the pad",
        "the delta-v is real, the thrust is not. ion engines only work once you are already in space."];
    }
    verdict.innerHTML = "";
    verdict.appendChild(document.createTextNode(v[1]));
    var sub = document.createElement("span");
    sub.className = "sub";
    sub.textContent = v[2];
    verdict.appendChild(sub);

    /* fuel tank fills from the bottom of the airframe */
    var h = Math.max(6, (mf / 400) * 88);
    tank.setAttribute("height", h.toFixed(1));
    tank.setAttribute("y", (200 - h).toFixed(1));
    flame.style.opacity = ratio >= 1 ? "1" : String(0.25 + ratio * 0.6);

    read.innerHTML = "";
    var strong = document.createElement("strong");
    strong.textContent = "mass ratio " + (m0 / m1).toFixed(2);
    var detail = document.createElement("span");
    detail.textContent = "wet " + m0 + " t · dry " + m1 + " t · " + eng.name +
      " (Isp " + eng.isp + " s) · exhaust velocity " +
      Math.round(eng.isp * G0).toLocaleString("en-US") + " m/s";
    read.appendChild(strong);
    read.appendChild(detail);

    /* an ion thruster never leaves the pad, whatever the equation says */
    drawPath(eng.isp >= 3000 ? 0 : ratio);
  }

  function init() {
    dry = document.getElementById("rk-dry");
    fuel = document.getElementById("rk-fuel");
    isp = document.getElementById("rk-isp");
    dryOut = document.getElementById("rk-dry-out");
    fuelOut = document.getElementById("rk-fuel-out");
    ispOut = document.getElementById("rk-isp-out");
    fill = document.getElementById("rk-fill");
    goal = document.getElementById("rk-goal");
    dvLabel = document.getElementById("rk-dv");
    verdict = document.getElementById("rk-verdict");
    read = document.getElementById("rk-read");
    tank = document.getElementById("rk-tank");
    flame = document.getElementById("rk-flame");
    pathEl = document.getElementById("rk-path");
    craftEl = document.getElementById("rk-craft");
    orbitLab = document.getElementById("rk-orbitlab");

    [dry, fuel, isp].forEach(function (el) {
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
