/* AI-ASSISTED: portions of this file were written with the help of an AI assistant (Claude), per course policy. */
/* cells.js: the Cell Explorer.
   Three hand-drawn SVG cells. Every organelle is a clickable shape paired with
   a list entry; selecting either fills the readout strip.

   TODO: this demo is the least finished of the five and is due for a rework.
   The diagrams are rough, the organelle shapes are approximate, and the
   layout does not use the stage as well as the other experiments do.
   Deliberately left as is pending that pass. See NOTES.md. */

(function () {
  "use strict";

  /* Each part: id, label, one-line job, and the SVG shape markup. */
  var CELLS = {
    animal: {
      name: "Animal cell",
      note: "A typical human cell. No wall, no chloroplasts, one small vacuole at most.",
      outline: '<ellipse cx="250" cy="180" rx="228" ry="158" fill="var(--bio-soft)" stroke="var(--bio)" stroke-width="4"/>',
      parts: [
        ["nucleus", "Nucleus", "Stores the DNA and decides which genes get copied.",
         '<circle class="org" cx="215" cy="165" r="54" fill="#8fce78" stroke="#2f7d20" stroke-width="3"/>'],
        ["nucleolus", "Nucleolus", "Builds ribosomes inside the nucleus.",
         '<circle class="org" cx="228" cy="152" r="15" fill="#2f7d20" stroke="#1e5615" stroke-width="2"/>'],
        ["mito", "Mitochondrion", "Burns sugar with oxygen to make ATP, the cell's energy currency.",
         '<g class="org"><ellipse cx="345" cy="120" rx="36" ry="19" fill="#f0c987" stroke="#c98b2d" stroke-width="3" transform="rotate(-18 345 120)"/><path d="M325 116 q10 -8 18 2 q10 10 20 0" fill="none" stroke="#c98b2d" stroke-width="3"/></g>'],
        ["er", "Endoplasmic reticulum", "Folds and ships proteins through a stack of membranes.",
         '<path class="org" d="M120 235 q42 26 88 8 q40 -16 78 6" fill="none" stroke="#5b8fc9" stroke-width="9" stroke-linecap="round"/>'],
        ["golgi", "Golgi apparatus", "Packages finished proteins and labels their destination.",
         '<g class="org"><path d="M330 235 q34 10 60 0" fill="none" stroke="#c77dbb" stroke-width="7" stroke-linecap="round"/><path d="M334 250 q30 9 52 0" fill="none" stroke="#c77dbb" stroke-width="7" stroke-linecap="round"/><path d="M338 265 q26 8 44 0" fill="none" stroke="#c77dbb" stroke-width="7" stroke-linecap="round"/></g>'],
        ["lyso", "Lysosome", "Holds digestive enzymes that break down worn-out parts.",
         '<circle class="org" cx="152" cy="120" r="20" fill="#e08585" stroke="#a83f3f" stroke-width="3"/>'],
        ["membrane", "Cell membrane", "Controls what enters and leaves the cell.",
         '<ellipse class="org" cx="250" cy="180" rx="228" ry="158" fill="none" stroke="#2f7d20" stroke-width="9"/>']
      ]
    },
    plant: {
      name: "Plant cell",
      note: "Same eukaryotic parts, plus a rigid wall, chloroplasts, and one enormous vacuole.",
      outline: '<rect x="26" y="30" width="448" height="300" rx="14" fill="var(--bio-soft)" stroke="var(--bio)" stroke-width="4"/>',
      parts: [
        ["wall", "Cell wall", "A rigid cellulose box that gives the cell its shape.",
         '<rect class="org" x="26" y="30" width="448" height="300" rx="14" fill="none" stroke="#7a8f3a" stroke-width="12"/>'],
        ["membrane", "Cell membrane", "Sits just inside the wall and controls what crosses.",
         '<rect class="org" x="42" y="46" width="416" height="268" rx="10" fill="none" stroke="#2f7d20" stroke-width="6"/>'],
        ["vacuole", "Central vacuole", "A water balloon that presses outward and keeps the plant upright.",
         '<rect class="org" x="150" y="90" width="240" height="180" rx="40" fill="#a8d8ef" stroke="#3a86ad" stroke-width="3"/>'],
        ["nucleus", "Nucleus", "Stores the DNA, pushed to the edge by the vacuole.",
         '<circle class="org" cx="98" cy="180" r="44" fill="#8fce78" stroke="#2f7d20" stroke-width="3"/>'],
        ["chloro", "Chloroplast", "Runs photosynthesis, turning light and carbon dioxide into sugar.",
         '<g class="org"><ellipse cx="410" cy="105" rx="34" ry="20" fill="#5aa832" stroke="#2f7d20" stroke-width="3"/><ellipse cx="400" cy="290" rx="34" ry="20" fill="#5aa832" stroke="#2f7d20" stroke-width="3"/><ellipse cx="120" cy="298" rx="30" ry="18" fill="#5aa832" stroke="#2f7d20" stroke-width="3"/></g>'],
        ["mito", "Mitochondrion", "Still here. Plants respire too, day and night.",
         '<ellipse class="org" cx="112" cy="80" rx="30" ry="16" fill="#f0c987" stroke="#c98b2d" stroke-width="3" transform="rotate(-14 112 80)"/>'],
        ["plasmo", "Plasmodesmata", "Channels through the wall that connect neighboring cells.",
         '<g class="org"><rect x="240" y="24" width="12" height="18" fill="#c9a227" stroke="#8a6b12" stroke-width="2"/><rect x="290" y="24" width="12" height="18" fill="#c9a227" stroke="#8a6b12" stroke-width="2"/><rect x="265" y="318" width="12" height="18" fill="#c9a227" stroke="#8a6b12" stroke-width="2"/></g>']
      ]
    },
    bacteria: {
      name: "Bacterial cell",
      note: "Prokaryotic. No nucleus and no membrane-bound organelles, and it divides in about twenty minutes.",
      outline: '<rect x="60" y="105" width="380" height="150" rx="75" fill="var(--bio-soft)" stroke="var(--bio)" stroke-width="4"/>',
      parts: [
        ["wall", "Cell wall", "A peptidoglycan shell. This is what penicillin attacks.",
         '<rect class="org" x="60" y="105" width="380" height="150" rx="75" fill="none" stroke="#7a8f3a" stroke-width="11"/>'],
        ["nucleoid", "Nucleoid", "A loose coil of DNA sitting free in the cytoplasm, with no nucleus around it.",
         '<path class="org" d="M180 160 q30 -22 58 0 q28 22 58 0 q26 -20 40 10 q-24 34 -58 16 q-30 -16 -58 6 q-30 22 -40 -32" fill="#8fce78" stroke="#2f7d20" stroke-width="3"/>'],
        ["plasmid", "Plasmid", "A small DNA ring that bacteria trade with each other, often carrying resistance genes.",
         '<circle class="org" cx="140" cy="215" r="17" fill="none" stroke="#c77dbb" stroke-width="6"/>'],
        ["ribo", "Ribosomes", "Build proteins. Bacteria have them by the thousand.",
         '<g class="org"><circle cx="200" cy="215" r="6" fill="#a83f3f"/><circle cx="230" cy="130" r="6" fill="#a83f3f"/><circle cx="300" cy="220" r="6" fill="#a83f3f"/><circle cx="340" cy="140" r="6" fill="#a83f3f"/><circle cx="380" cy="195" r="6" fill="#a83f3f"/></g>'],
        ["flagellum", "Flagellum", "A rotating tail that drives the cell forward like a propeller.",
         '<path class="org" d="M440 180 q28 -26 52 0 q24 26 48 0" fill="none" stroke="#3a86ad" stroke-width="6" stroke-linecap="round"/>'],
        ["capsule", "Capsule", "A sticky outer coat that helps the cell hide from immune systems.",
         '<rect class="org" x="46" y="91" width="408" height="178" rx="89" fill="none" stroke="#3a86ad" stroke-width="4" stroke-dasharray="9 7"/>']
      ]
    }
  };

  var svgBox, list, readout, tabs;
  var current = "animal";

  function show(key, partId) {
    var cell = CELLS[key];
    current = key;

    var shapes = cell.parts.map(function (p) {
      return p[3].replace('class="org"', 'class="org" data-id="' + p[0] + '" tabindex="0" role="button" aria-label="' + p[1] + '"');
    }).join("");

    svgBox.innerHTML = '<svg viewBox="-20 0 560 360" role="img" aria-label="Diagram of a ' +
      cell.name.toLowerCase() + '">' + cell.outline + shapes + "</svg>";

    list.innerHTML = "";
    cell.parts.forEach(function (p) {
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = p[1];
      b.setAttribute("data-id", p[0]);
      b.addEventListener("click", function () { pick(p[0]); });
      li.appendChild(b);
      list.appendChild(li);
    });

    svgBox.querySelectorAll(".org").forEach(function (el) {
      el.addEventListener("click", function () { pick(el.getAttribute("data-id")); });
      el.addEventListener("mouseenter", function () { pick(el.getAttribute("data-id")); });
      el.addEventListener("focus", function () { pick(el.getAttribute("data-id")); });
      el.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); pick(el.getAttribute("data-id")); }
      });
    });

    pick(partId || cell.parts[0][0]);
  }

  function pick(id) {
    var cell = CELLS[current];
    var part = cell.parts.filter(function (p) { return p[0] === id; })[0];
    if (!part) { return; }

    svgBox.querySelectorAll(".org").forEach(function (el) {
      el.classList.toggle("sel", el.getAttribute("data-id") === id);
    });
    list.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-id") === id);
    });

    readout.innerHTML = "";
    var strong = document.createElement("strong");
    strong.textContent = part[1];
    var job = document.createElement("span");
    job.textContent = part[2];
    var note = document.createElement("span");
    note.textContent = "· " + cell.name;
    readout.appendChild(strong);
    readout.appendChild(job);
    readout.appendChild(note);
  }

  function init() {
    svgBox = document.getElementById("cx-svg");
    list = document.getElementById("cx-list");
    readout = document.getElementById("cx-read");
    tabs = document.querySelectorAll(".cx-tabs .fz-btn");
    tabs.forEach(function (t) {
      t.setAttribute("aria-pressed", t.classList.contains("on") ? "true" : "false");
    });

    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        tabs.forEach(function (x) {
          x.classList.remove("on");
          x.setAttribute("aria-pressed", "false");
        });
        t.classList.add("on");
        t.setAttribute("aria-pressed", "true");
        show(t.getAttribute("data-cell"));
      });
    });

    show("animal");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
