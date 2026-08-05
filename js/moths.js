/* AI-ASSISTED: portions of this file were written with the help of an AI assistant (Claude), per course policy. */
/* moths.js: Peppered Moths.
   Twenty moths on bark. The player is the predator. Moths that contrast with
   the bark are easier to spot, so they get eaten more. Survivors breed the next
   generation by resampling the survivors color frequency, with a small mutation
   rate. This tracks phenotype frequency, not genotypes.
   Population size and catches per generation are fixed. */

(function () {
  "use strict";

  var POP = 20;
  var CATCHES = 8;
  var MAX_GEN = 10;

  var ERAS = [
    { name: "1800 clean", a: "#d8cfb8", b: "#c8bfa6", dark: 0.15 },
    { name: "1900 sooty", a: "#6b6358", b: "#5b5449", dark: 0.75 },
    { name: "Today",      a: "#c9bda6", b: "#b7a98e", dark: 0.35 }
  ];

  var scene, genEl, leftEl, pctEl, liteEl, darkEl, chart, read, nextBtn, resetBtn, eraBtns;
  var moths = [], gen = 1, left = CATCHES, era = 1, history = [];

  function rand(a, b) { return a + Math.random() * (b - a); }

  function spawn(darkFrac) {
    moths = [];
    for (var i = 0; i < POP; i++) {
      moths.push({
        dark: Math.random() < darkFrac,
        x: rand(8, 92),
        y: rand(10, 90),
        eaten: false
      });
    }
  }

  function mothSVG(dark) {
    var body = dark ? "#3a3630" : "#e0d5ba";
    var wing = dark ? "#4a443c" : "#efe7d2";
    var line = dark ? "#2e2a24" : "#9c8f74";
    return '<svg viewBox="-56 -32 112 64" aria-hidden="true">' +
      '<path d="M-6 -8 q-38 -26 -44 4 q-4 22 38 14 z" fill="' + wing + '" stroke="' + line + '" stroke-width="3"/>' +
      '<path d="M6 -8 q38 -26 44 4 q4 22 -38 14 z" fill="' + wing + '" stroke="' + line + '" stroke-width="3"/>' +
      '<ellipse cx="0" cy="2" rx="9" ry="24" fill="' + body + '" stroke="' + line + '" stroke-width="3"/></svg>';
  }

  function draw() {
    var e = ERAS[era];
    scene.style.setProperty("--bark-a", e.a);
    scene.style.setProperty("--bark-b", e.b);
    scene.innerHTML = "";
    moths.forEach(function (m, i) {
      if (m.eaten) { return; }
      var b = document.createElement("button");
      b.type = "button";
      b.className = "moth";
      b.style.left = m.x + "%";
      b.style.top = m.y + "%";
      b.setAttribute("aria-label", (m.dark ? "dark" : "pale") + " moth");
      b.innerHTML = mothSVG(m.dark);
      b.addEventListener("click", function () { eat(i); });
      scene.appendChild(b);
    });
    stats();
  }

  function eat(i) {
    if (left <= 0 || moths[i].eaten) { return; }
    moths[i].eaten = true;
    left--;
    draw();
    /* draw() rebuilt the scene, so keyboard focus would otherwise be lost.
       Move it to the next surviving moth. */
    var next = scene.querySelector(".moth");
    if (next && document.activeElement === document.body) { next.focus(); }
    if (left === 0) {
      say("Out of catches. Breed the next generation.");
    }
  }

  function living() { return moths.filter(function (m) { return !m.eaten; }); }

  function stats() {
    var alive = living();
    var dark = alive.filter(function (m) { return m.dark; }).length;
    var pct = alive.length ? Math.round(dark / alive.length * 100) : 0;
    genEl.textContent = gen;
    leftEl.textContent = left;
    pctEl.textContent = pct + "%";
    liteEl.style.width = (100 - pct) + "%";
    darkEl.style.width = pct + "%";

    chart.innerHTML = "";
    history.concat([pct]).forEach(function (p, i) {
      var bar = document.createElement("span");
      bar.style.height = Math.max(2, p) + "%";
      if (i === history.length) { bar.className = "now"; }
      bar.title = "generation " + (i + 1) + ": " + p + "% dark";
      chart.appendChild(bar);
    });
  }

  function say(msg) {
    var alive = living();
    var dark = alive.filter(function (m) { return m.dark; }).length;
    read.innerHTML = "";
    var strong = document.createElement("strong");
    strong.textContent = "generation " + gen;
    var s = document.createElement("span");
    s.textContent = alive.length + " moths left · " + dark + " dark · " +
      (alive.length - dark) + " pale · bark: " + ERAS[era].name;
    var m = document.createElement("span");
    m.textContent = msg;
    read.appendChild(strong);
    read.appendChild(s);
    read.appendChild(m);
  }

  function breed() {
    var alive = living();
    /* selection only means something once you have actually hunted */
    if (left > 0 && alive.length) {
      say("Eat all " + CATCHES + " moths first. Selection needs you to be picky.");
      return;
    }
    if (!alive.length) {
      say("You ate everything. That population is gone, so this is a reset.");
      reset();
      return;
    }
    if (gen >= MAX_GEN) {
      say("Ten generations done. Reset to run it again, or switch eras first.");
      return;
    }
    var darkFrac = alive.filter(function (m) { return m.dark; }).length / alive.length;
    history.push(Math.round(darkFrac * 100));
    /* resample the survivors color frequency, with a small mutation rate */
    var mutation = 0.02;
    var next = darkFrac * (1 - mutation) + (1 - darkFrac) * mutation;
    gen++;
    left = CATCHES;
    spawn(next);
    draw();
    say("Survivors bred. The new generation inherits their color mix.");
  }

  function reset() {
    gen = 1;
    left = CATCHES;
    history = [];
    spawn(0.5);
    draw();
    say("Fresh population, half dark and half pale. Start hunting.");
  }

  function init() {
    scene = document.getElementById("mo-scene");
    genEl = document.getElementById("mo-gen");
    leftEl = document.getElementById("mo-left");
    pctEl = document.getElementById("mo-pct");
    liteEl = document.getElementById("mo-lite");
    darkEl = document.getElementById("mo-dark");
    chart = document.getElementById("mo-chart");
    read = document.getElementById("mo-read");
    nextBtn = document.getElementById("mo-next");
    resetBtn = document.getElementById("mo-reset");
    eraBtns = document.querySelectorAll("#mo-era .fz-btn");
    eraBtns.forEach(function (b) {
      b.setAttribute("aria-pressed", b.classList.contains("on") ? "true" : "false");
    });

    nextBtn.addEventListener("click", breed);
    resetBtn.addEventListener("click", reset);
    eraBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        eraBtns.forEach(function (x) {
          x.classList.remove("on");
          x.setAttribute("aria-pressed", "false");
        });
        b.classList.add("on");
        b.setAttribute("aria-pressed", "true");
        era = parseInt(b.getAttribute("data-era"), 10);
        draw();
        say("Bark changed to " + ERAS[era].name + ". Notice which moths are now easy to spot.");
      });
    });

    reset();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
