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
  var INFLUX = 0.20;      /* share of each generation that flies in from nearby woods */
  var MIN_MORPH = 2;      /* never let either form disappear entirely */
  var CHART_WINDOW = 30;  /* free play runs as long as you like, so the chart scrolls */
  var CATCHES = 5;
  var GENS_PER_ERA = 4;
  var MAX_GEN = 12;          /* 3 eras of 4 generations each */

  /* The eras run in order and advance on their own, so twelve generations
     tell the historical story: lichen, then soot, then clean air again. */
  var ERAS = [
    { name: "1800 · pre-industrial", a: "#d8cfb8", b: "#c8bfa6",
      note: "Pale lichen covers the bark. Dark moths stand out." },
    { name: "1900 · peak soot", a: "#6b6358", b: "#5b5449",
      note: "Coal soot has killed the lichen. Now the pale moths stand out." },
    { name: "1970 · after the Clean Air Acts", a: "#c9bda6", b: "#b7a98e",
      note: "The bark is recovering, and the advantage swings back." }
  ];

  var scene, genEl, genMaxEl, leftEl, pctEl, liteEl, darkEl, chart, chartFrom, read, nextBtn, resetBtn, eraBtns;
  var moths = [], gen = 1, left = CATCHES, era = 0, history = [], freeplay = false;

  /* Which era generation n belongs to, while the run is still going. */
  function eraForGen(n) {
    return Math.min(ERAS.length - 1, Math.floor((n - 1) / GENS_PER_ERA));
  }

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
    ensureBoth();
  }

  /* Guarantee a couple of each form. A binomial draw at a low frequency can
     still come out empty, and an empty morph makes the next era unplayable. */
  function ensureBoth() {
    [true, false].forEach(function (want) {
      var have = moths.filter(function (x) { return x.dark === want; });
      var others = moths.filter(function (x) { return x.dark !== want; });
      for (var k = have.length; k < MIN_MORPH && others.length > k; k++) {
        others[k].dark = want;
      }
    });
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
    genMaxEl.textContent = freeplay ? " · free play" : " of " + MAX_GEN;
    leftEl.textContent = left;
    pctEl.textContent = pct + "%";
    liteEl.style.width = (100 - pct) + "%";
    darkEl.style.width = pct + "%";

    chart.innerHTML = "";
    var all = history.concat([pct]);
    var from = Math.max(0, all.length - CHART_WINDOW);
    var shown = all.length - from;
    /* Keep a slot for every generation of the scripted run, so one early bar
       is one twelfth of the width instead of the whole chart. */
    var slots = Math.max(shown, freeplay ? shown : MAX_GEN);
    var width = "calc((100% - " + ((slots - 1) * 3) + "px) / " + slots + ")";
    for (var j = 0; j < slots; j++) {
      var idx = from + j;
      var g = idx + 1;                     /* absolute generation number */
      var bar = document.createElement("span");
      bar.style.width = width;
      var cls = "";
      if (idx < all.length) {
        bar.style.height = Math.max(2, all[idx]) + "%";
        if (idx === all.length - 1) { cls = "now"; }
        bar.title = "generation " + g + ": " + all[idx] + "% dark";
      } else {
        cls = "todo";
        bar.title = "generation " + g + ": not bred yet";
      }
      /* a rule marks each era change, which only happens in the scripted run */
      if (g > 1 && g <= MAX_GEN && (g - 1) % GENS_PER_ERA === 0) { cls += " eraline"; }
      if (cls) { bar.className = cls.trim(); }
      chart.appendChild(bar);
    }
    if (chartFrom) { chartFrom.textContent = "generation " + (from + 1); }
    eraBtns.forEach(function (b) {
      var on = parseInt(b.getAttribute("data-era"), 10) === era;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.disabled = !freeplay;
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
    /* The scripted run is twelve generations across three eras. Reaching the
       end unlocks the era buttons, and breeding continues without limit. */
    var justUnlocked = false;
    if (gen >= MAX_GEN && !freeplay) {
      freeplay = true;
      justUnlocked = true;
    }
    var darkFrac = alive.filter(function (m) { return m.dark; }).length / alive.length;
    history.push(Math.round(darkFrac * 100));
    /* Resample the survivors color frequency, then mix in moths arriving from
       neighboring woodland. That gene flow is real biology, and it is also
       what keeps a wiped-out morph available for a later era to select on. */
    var next = darkFrac * (1 - INFLUX) + 0.5 * INFLUX;
    gen++;
    left = CATCHES;
    var wasEra = era;
    if (!freeplay) { era = eraForGen(gen); }
    spawn(next);
    draw();
    if (justUnlocked) {
      say("Twelve generations done. The era buttons are yours now. Set the bark " +
          "wherever you like and keep breeding for as long as you want.");
    } else if (era !== wasEra) {
      say("The bark changed. " + ERAS[era].name + ": " + ERAS[era].note);
    } else {
      say("Survivors bred. The new generation inherits their color mix.");
    }
  }

  function reset() {
    gen = 1;
    left = CATCHES;
    history = [];
    freeplay = false;
    era = 0;
    spawn(0.5);
    draw();
    say("Fresh population, a rough even mix. " + ERAS[era].note +
        " Eat " + CATCHES + " moths, then breed.");
  }

  function init() {
    scene = document.getElementById("mo-scene");
    genEl = document.getElementById("mo-gen");
    genMaxEl = document.getElementById("mo-genmax");
    leftEl = document.getElementById("mo-left");
    pctEl = document.getElementById("mo-pct");
    liteEl = document.getElementById("mo-lite");
    darkEl = document.getElementById("mo-dark");
    chart = document.getElementById("mo-chart");
    chartFrom = document.getElementById("mo-chartfrom");
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
        if (!freeplay) { return; }
        era = parseInt(b.getAttribute("data-era"), 10);
        draw();
        say("Bark set to " + ERAS[era].name + ". " + ERAS[era].note);
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
