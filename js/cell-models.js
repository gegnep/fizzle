/* AI-ASSISTED: portions of this file were written with the help of an AI assistant (Claude), per course policy.
   cell-models.js — geometry and copy for the three cells.

   Every organelle with internal structure is built as a `hull` plus `inner`
   shapes. The renderer clips inner to hull, so cristae, grana and chromatin are
   contained by the organelle that owns them instead of floating through it.
   Shapes that belong outside the cell (flagellum, pili, plasmodesmata, sugar
   coat) go in `outer`, which skips the envelope clip.

   Sizes are schematic, not to scale. */

(function (global) {
  "use strict";

  var PAL = {
    membrane: [82, 176, 116], wall: [178, 150, 92], nucleus: [126, 114, 218],
    nucleolus: [72, 58, 152], chromatin: [158, 148, 232], mito: [234, 140, 74],
    er: [72, 146, 198], golgi: [208, 112, 186], lyso: [226, 84, 84],
    vesicle: [242, 182, 62], ribo: [216, 76, 76], skel: [148, 162, 184],
    centro: [140, 124, 218], chloro: [62, 156, 76], grana: [32, 98, 44],
    vacuole: [118, 196, 234], plasmid: [208, 112, 186], nucleoid: [104, 196, 116],
    flag: [72, 146, 198], coat: [148, 206, 218], pili: [192, 178, 142]
  };

  /* ---------- shape constructors ---------- */
  function ball(p, r, st) { return { k: "ball", p: p, r: r, st: st || {} }; }
  function ellip(p, r, rot, st) { return { k: "ellip", p: p, r: r, rot: rot || [0, 0, 0], st: st || {} }; }
  /* a flat plate. `plate` tells the renderer to shade it as a surface rather
     than a ball, which is what keeps a face-on disc from looking spherical. */
  function disc(p, r, rot, st) {
    var s = {};
    for (var k in st) { if (Object.prototype.hasOwnProperty.call(st, k)) { s[k] = st[k]; } }
    s.plate = 1;
    return { k: "ellip", p: p, r: [r[0], r[1], 0.006], rot: rot || [0, 0, 0], st: s };
  }
  function tube(pts, r, st) { return { k: "tube", pts: pts, r: r, st: st || {} }; }
  function ring(p, r, w, rot, st) { return { k: "ring", p: p, r: r, w: w, rot: rot || [0, 0, 0], st: st || {} }; }

  /* The renderer's own axis convention. Looked up lazily so load order can't
     bite, and shared so an interior can never be laid out along an axis the
     renderer does not project it by. */
  function basis(rot) { return global.CellRender.basis(rot); }

  /* deterministic noise, so a cell looks the same every load */
  function rng(seed) {
    var s = seed || 1;
    return function () { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  }

  /* scatter granules through a cytoplasm shell, skipping keep-out spheres */
  function scatter(n, seed, lo, hi, r, st, avoid, radii) {
    var out = [], rand = rng(seed), guard = 0;
    /* radii shapes the cloud to the container it lives in. A number squashes y
       only; a triple matches an ellipsoid envelope on all three axes, which is
       what keeps granules off the membrane. */
    var E = !radii ? [1, 1, 1] : (typeof radii === "number" ? [1, radii, 1] : radii);
    while (out.length < n && guard++ < n * 40) {
      var u = rand() * 2 - 1, a = rand() * Math.PI * 2;
      var s = Math.sqrt(1 - u * u);
      var rad = lo + (hi - lo) * rand();
      var p = [s * Math.cos(a) * rad * E[0], u * rad * E[1], s * Math.sin(a) * rad * E[2]];
      var ok = true;
      for (var i = 0; avoid && i < avoid.length; i++) {
        var d = Math.sqrt(Math.pow(p[0] - avoid[i][0][0], 2) + Math.pow(p[1] - avoid[i][0][1], 2)
          + Math.pow(p[2] - avoid[i][0][2], 2));
        if (d < avoid[i][1]) { ok = false; break; }
      }
      if (ok) { out.push(ball(p, r * (0.72 + rand() * 0.56), st)); }
    }
    return out;
  }

  /* a lozenge with parallel internal folds: the mitochondrion pattern.
     The folds are discs perpendicular to the long axis, so they read as
     cristae rather than scribbles, and the hull clip contains them. */
  function foldedBody(p, r, rot, color, folds, seed) {
    var inner = [], rand = rng(seed);
    var span = r[0] * 1.42;
    /* space the cristae along the body's OWN long axis, as the renderer defines it */
    var axis = basis(rot)[0];
    for (var i = 0; i < folds; i++) {
      var t = (i + 0.5) / folds - 0.5;
      var c = [p[0] + axis[0] * t * span, p[1] + axis[1] * t * span, p[2] + axis[2] * t * span];
      var wob = 0.82 + rand() * 0.3;
      inner.push(ellip(c, [r[0] * 0.055, r[1] * 0.94 * wob, r[2] * 0.94 * wob], rot,
        { color: [color[0] * 0.52, color[1] * 0.44, color[2] * 0.4], alpha: 0.92, rim: 0 }));
    }
    return inner;
  }

  /* a stack of flattened plates: Golgi cisternae, and grana inside a chloroplast */
  function stack(p, n, r, gap, rot, st, taper) {
    var out = [];
    /* stack along the plates' own thin axis, so the pile stays square to them */
    var up = basis(rot)[2];
    for (var i = 0; i < n; i++) {
      var t = i - (n - 1) / 2;
      var f = taper ? 1 - Math.abs(t) / (n * 0.9) : 1;
      out.push(disc([p[0] + up[0] * t * gap, p[1] + up[1] * t * gap, p[2] + up[2] * t * gap],
        [r * f, r * f * 0.86], rot, st));
    }
    return out;
  }

  /* ---------- animal ---------- */
  function animal() {
    var parts = [];
    var NUC = [-0.30, 0.12, -0.08], NR = 0.40;

    var membrane = {
      id: "membrane", label: "Cell membrane", color: PAL.membrane,
      job: "Controls what enters and leaves. A double layer of fat with proteins set through it.",
      anchor: [0, 1.0, 0],
      shapes: scatter(26, 3, 0.9, 0.94, 0.028, { color: [122, 200, 150], rim: 0 })
    };
    parts.push(membrane);

    parts.push({
      id: "nucleus", label: "Nucleus", color: PAL.nucleus,
      job: "Holds the DNA and decides which genes get copied. The pores in its wall meter the traffic.",
      anchor: [NUC[0], NUC[1] + NR, NUC[2]],
      hull: ball(NUC, NR, { shell: 1, alpha: 0.92, spec: 0.5 }),
      inner: (function () {
        var it = [], rand = rng(11);
        /* chromatin: loose threads coiled inside the envelope */
        for (var t = 0; t < 5; t++) {
          var pts = [], a0 = rand() * 6.28, b0 = rand() * 6.28;
          for (var i = 0; i <= 9; i++) {
            var u = i / 9;
            var a = a0 + u * 4.4, b = b0 + u * 3.1;
            var rr = NR * (0.30 + 0.46 * Math.sin(u * 3.1 + a0));
            pts.push([NUC[0] + Math.cos(a) * Math.cos(b) * rr,
              NUC[1] + Math.sin(b) * rr,
              NUC[2] + Math.sin(a) * Math.cos(b) * rr]);
          }
          it.push(tube(pts, 0.017, { color: PAL.chromatin, alpha: 0.95 }));
        }
        return it;
      })(),
      /* nuclear pores sit in the envelope surface */
      shapes: scatter(16, 5, NR * 0.99, NR * 1.0, 0.026,
        { color: [86, 76, 168], rim: 0 }).map(function (b) {
          b.p = [b.p[0] + NUC[0], b.p[1] + NUC[1], b.p[2] + NUC[2]];
          return b;
        })
    });

    parts.push({
      id: "nucleolus", label: "Nucleolus", color: PAL.nucleolus,
      job: "A dense knot inside the nucleus that builds ribosomes and ships them out.",
      anchor: [NUC[0] + 0.08, NUC[1] + 0.06, NUC[2] + 0.12],
      hull: ball([NUC[0] + 0.07, NUC[1] + 0.04, NUC[2] + 0.10], 0.145, { spec: 0.3 }),
      inner: scatter(10, 23, 0.02, 0.11, 0.026, { color: [56, 44, 128], rim: 0 })
        .map(function (b) {
          b.p = [b.p[0] + NUC[0] + 0.07, b.p[1] + NUC[1] + 0.04, b.p[2] + NUC[2] + 0.10];
          return b;
        })
    });

    parts.push({
      id: "er", label: "Endoplasmic reticulum", color: PAL.er,
      job: "Folded sheets wrapped around the nucleus. Rough ER carries ribosomes and folds proteins.",
      anchor: [0.28, 0.16, 0.42],
      shapes: (function () {
        /* an overlapping fan of sheets on one flank of the nucleus, so it reads as
           folded membrane rather than separate lumps */
        var it = [], rand = rng(19);
        for (var i = 0; i < 6; i++) {
          var a = 1.52 + i * 0.23;
          var rad = NR + 0.145 + (i % 2) * 0.04;
          var c = [NUC[0] + Math.cos(a) * rad, NUC[1] - 0.17 + i * 0.075, NUC[2] + Math.sin(a) * rad];
          /* face each sheet along the nuclear radius at its own position. A disc's
             thin axis is basis(rot)[2] ~ [sin(yaw),0,cos(yaw)], and the radial
             direction here is [cos(a),0,sin(a)], so yaw must be PI/2 - a. */
          it.push(ellip(c, [0.225, 0.155, 0.012], [Math.PI / 2 - a, 0.30, 0.14],
            { alpha: 0.96, plate: 1 }));
        }
        /* ribosomes stud the rough face */
        for (var k = 0; k < 12; k++) {
          var ak = 1.55 + rand() * 1.5, rk = NR + 0.17 + rand() * 0.12;
          it.push(ball([NUC[0] + Math.cos(ak) * rk, NUC[1] - 0.17 + rand() * 0.44, NUC[2] + Math.sin(ak) * rk],
            0.019, { color: PAL.ribo, rim: 0 }));
        }
        return it;
      })()
    });

    parts.push({
      id: "golgi", label: "Golgi apparatus", color: PAL.golgi,
      job: "A stack of sorting trays. It finishes proteins, labels them, and buds off the delivery.",
      anchor: [0.40, -0.36, 0.28],
      shapes: stack([0.40, -0.38, 0.26], 6, 0.20, 0.052, [0.5, 0.26, 0], { alpha: 0.97, spec: 0.3 }, true)
        .concat([
          ball([0.60, -0.52, 0.34], 0.045, { color: PAL.vesicle, spec: 0.6 }),
          ball([0.30, -0.58, 0.36], 0.036, { color: PAL.vesicle, spec: 0.6 })
        ])
    });

    (function () {
      var m1 = [0.52, 0.40, 0.14], r1 = [0.28, 0.135, 0.135], rot1 = [-0.7, 0.34, 0];
      var m2 = [0.08, -0.58, -0.32], r2 = [0.235, 0.115, 0.115], rot2 = [0.5, -0.22, 0];
      parts.push({
        id: "mito", label: "Mitochondrion", color: PAL.mito,
        job: "Burns sugar with oxygen to make ATP. The folds inside add the surface area to do it.",
        anchor: m1,
        bodies: [
          { hull: ellip(m1, r1, rot1, { spec: 0.34 }), inner: foldedBody(m1, r1, rot1, PAL.mito, 9, 31) },
          { hull: ellip(m2, r2, rot2, { spec: 0.34 }), inner: foldedBody(m2, r2, rot2, PAL.mito, 8, 47) }
        ]
      });
    })();

    parts.push({
      id: "lyso", label: "Lysosome", color: PAL.lyso,
      job: "An acid bag of digestive enzymes. It breaks down worn out parts and keeps them sealed away.",
      anchor: [-0.62, 0.30, 0.34],
      hull: ball([-0.62, 0.30, 0.34], 0.115, { spec: 0.45 }),
      inner: scatter(8, 53, 0.02, 0.08, 0.024, { color: [170, 54, 54], rim: 0 })
        .map(function (b) { b.p = [b.p[0] - 0.62, b.p[1] + 0.30, b.p[2] + 0.34]; return b; })
    });

    parts.push({
      id: "vesicle", label: "Vesicles", color: PAL.vesicle,
      job: "Small bubbles that carry cargo between compartments and out through the membrane.",
      anchor: [0.70, -0.16, 0.28],
      shapes: [
        ball([0.70, -0.14, 0.26], 0.062, { spec: 0.7 }),
        ball([0.54, 0.04, 0.46], 0.046, { spec: 0.7 }),
        ball([-0.16, -0.66, 0.24], 0.053, { spec: 0.7 }),
        ball([-0.44, -0.30, 0.60], 0.040, { spec: 0.7 })
      ]
    });

    parts.push({
      id: "ribo", label: "Ribosomes", color: PAL.ribo,
      job: "Protein factories. They read the message copied from DNA and build the chain one link at a time.",
      anchor: [0.10, 0.62, 0.45],
      shapes: scatter(30, 71, 0.42, 0.88, 0.021, { rim: 0 }, [[NUC, NR + 0.07]])
    });

    parts.push({
      id: "skel", label: "Cytoskeleton", color: PAL.skel,
      job: "A scaffold of protein rods. It holds the shape, anchors organelles, and pulls the cell apart when it divides.",
      anchor: [0.0, -0.80, 0.34],
      shapes: (function () {
        /* filaments run between two points on the cortex, bowed toward the middle.
           Kept thin and faint: they are scaffolding behind the organelles, and at
           full weight they read as scratches across the cell. */
        var it = [], rand = rng(89);
        for (var i = 0; i < 7; i++) {
          var a = rand() * 6.28, b = (rand() - 0.5) * 1.5;
          var a2 = a + 2.0 + rand() * 1.4, b2 = (rand() - 0.5) * 1.5;
          var A = [Math.cos(a) * Math.cos(b) * 0.9, Math.sin(b) * 0.9, Math.sin(a) * Math.cos(b) * 0.9];
          var B = [Math.cos(a2) * Math.cos(b2) * 0.9, Math.sin(b2) * 0.9, Math.sin(a2) * Math.cos(b2) * 0.9];
          var M = [(A[0] + B[0]) * 0.34, (A[1] + B[1]) * 0.34, (A[2] + B[2]) * 0.34];
          it.push(tube([A, M, B], 0.0068, { alpha: 0.42 }));
        }
        return it;
      })()
    });

    parts.push({
      id: "centro", label: "Centrosome", color: PAL.centro,
      job: "Two short barrels set at right angles. They organise the fibres that pull chromosomes apart.",
      anchor: [-0.28, 0.54, -0.28],
      shapes: [
        ellip([-0.30, 0.54, -0.26], [0.075, 0.030, 0.030], [0.4, 0, 0], { spec: 0.3 }),
        ellip([-0.19, 0.49, -0.30], [0.030, 0.030, 0.075], [0.4, 0, 0], { spec: 0.3 })
      ]
    });

    return {
      key: "animal", name: "Animal cell", kind: "Eukaryote",
      note: "A typical human cell. No wall, no chloroplasts, and no vacuole worth the name.",
      envelope: ball([0, 0, 0], 1.0, { color: PAL.membrane, alpha: 0.92, shell: 1, env: 1 }),
      cyto: [24, 42, 36],
      envelopePart: membrane,
      parts: parts
    };
  }

  /* ---------- plant ---------- */
  function plant() {
    var parts = [];
    var R = [1.0, 0.78, 0.78];
    var VAC = [0.06, 0.10, 0.0];

    var wall = {
      id: "wall", label: "Cell wall", color: PAL.wall,
      job: "A rigid cellulose box outside the membrane. It sets the shape and stops the cell bursting.",
      anchor: [0, R[1], 0]
    };
    parts.push(wall);

    parts.push({
      id: "membrane", label: "Cell membrane", color: PAL.membrane,
      job: "Sits just inside the wall and does the real gatekeeping. The wall is scaffolding, not a filter.",
      anchor: [0, R[1] - 0.08, 0.4],
      shapes: [ellip([0, 0, 0], [R[0] * 0.955, R[1] * 0.945, R[2] * 0.945], [0, 0, 0],
        { shell: 1, alpha: 0.5 })]
    });

    parts.push({
      id: "vacuole", label: "Central vacuole", color: PAL.vacuole,
      job: "A water balloon that fills most of the cell. Its pressure against the wall is what holds a leaf up.",
      anchor: [VAC[0], VAC[1] + 0.5, VAC[2] + 0.3],
      shapes: [ellip(VAC, [0.575, 0.465, 0.465], [0.2, 0.1, 0],
        { shell: 1, alpha: 0.5, spec: 0.5 })]
    });

    parts.push({
      id: "nucleus", label: "Nucleus", color: PAL.nucleus,
      job: "Holds the DNA. The vacuole pushes it out to the edge, which is where you always find it.",
      anchor: [-0.64, -0.30, 0.24],
      hull: ball([-0.64, -0.30, 0.22], 0.235, { shell: 1, alpha: 0.92, spec: 0.5 }),
      inner: [ball([-0.62, -0.28, 0.26], 0.085, { color: PAL.nucleolus })].concat(
        (function () {
          var it = [], rand = rng(13);
          for (var t = 0; t < 3; t++) {
            var pts = [], a0 = rand() * 6.28;
            for (var i = 0; i <= 8; i++) {
              var u = i / 8, a = a0 + u * 4.2;
              var rr = 0.235 * (0.34 + 0.42 * Math.sin(u * 3 + a0));
              pts.push([-0.64 + Math.cos(a) * rr, -0.30 + (u - 0.5) * 0.3, 0.22 + Math.sin(a) * rr]);
            }
            it.push(tube(pts, 0.013, { color: PAL.chromatin }));
          }
          return it;
        })())
    });

    parts.push({
      id: "chloro", label: "Chloroplast", color: PAL.chloro,
      job: "Runs photosynthesis. The green stacks inside catch light and drive carbon dioxide into sugar.",
      anchor: [0.58, 0.42, 0.40],
      bodies: (function () {
        var rand = rng(29);
        var specs = [
          [[0.50, 0.33, 0.28], [0.19, 0.10, 0.135], [-0.5, 0.3, 0], 5],
          [[-0.34, 0.42, 0.22], [0.17, 0.095, 0.125], [0.8, -0.3, 0], 4],
          [[0.22, -0.44, -0.28], [0.17, 0.095, 0.125], [0.2, 0.6, 0], 4]
        ];
        return specs.map(function (s) {
          var inner = [];
          for (var g = 0; g < s[3]; g++) {
            var c = [s[0][0] + (rand() - 0.5) * s[1][0] * 1.05,
              s[0][1] + (rand() - 0.5) * s[1][1] * 0.9,
              s[0][2] + (rand() - 0.5) * s[1][2] * 0.9];
            inner = inner.concat(stack(c, 4, s[1][1] * 0.44, s[1][1] * 0.21,
              [rand() * 3, 0.5 + rand(), 0], { color: PAL.grana, alpha: 0.95, rim: 0 }, false));
          }
          return { hull: ellip(s[0], s[1], s[2], { spec: 0.36 }), inner: inner };
        });
      })()
    });

    parts.push({
      id: "mito", label: "Mitochondrion", color: PAL.mito,
      job: "Still here. Plants respire day and night, and burn the sugar the chloroplasts made.",
      anchor: [-0.66, 0.44, 0.18],
      hull: ellip([-0.64, 0.44, 0.16], [0.20, 0.10, 0.10], [0.6, 0.3, 0], { spec: 0.34 }),
      inner: foldedBody([-0.64, 0.44, 0.16], [0.20, 0.10, 0.10], [0.6, 0.3, 0], PAL.mito, 7, 37)
    });

    parts.push({
      id: "golgi", label: "Golgi apparatus", color: PAL.golgi,
      job: "Packs proteins, and in a plant also builds the sugars that go into the wall.",
      anchor: [-0.22, -0.54, 0.28],
      shapes: stack([-0.24, -0.54, 0.26], 5, 0.155, 0.046, [0.7, 0.2, 0], { alpha: 0.97, spec: 0.3 }, true)
    });

    parts.push({
      id: "ribo", label: "Ribosomes", color: PAL.ribo,
      job: "Protein factories, scattered loose in the cytoplasm and stuck along the ER.",
      anchor: [0.5, -0.5, 0.5],
      shapes: scatter(26, 73, 0.60, 0.90, 0.019, { rim: 0 }, null, [R[0] * 0.97, R[1] * 0.97, R[2] * 0.97])
    });

    parts.push({
      id: "plasmo", label: "Plasmodesmata", color: PAL.vesicle,
      job: "Lined channels straight through the wall. Neighbouring cells trade water and signals through them.",
      anchor: [0, R[1] + 0.06, 0],
      outer: (function () {
        /* Short lined channels through the wall. The envelope is an ELLIPSOID, so
           each channel is placed on its surface by scaling a unit direction by
           the envelope radii; a unit sphere left them floating off the flanks. */
        var it = [], rand = rng(41);
        function at(n, t) { return [n[0] * R[0] * t, n[1] * R[1] * t, n[2] * R[2] * t]; }
        for (var i = 0; i < 9; i++) {
          var a = rand() * 6.2832, b = (rand() - 0.5) * 1.5;
          var n = [Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b)];
          it.push(tube([at(n, 0.945), at(n, 1.035)], 0.017, { alpha: 0.95 }));
        }
        return it;
      })()
    });

    return {
      key: "plant", name: "Plant cell", kind: "Eukaryote",
      note: "The same eukaryotic parts, plus a rigid wall, chloroplasts, and one enormous vacuole.",
      envelope: ellip([0, 0, 0], R, [0, 0, 0], { color: PAL.wall, alpha: 0.95, shell: 1, env: 1 }),
      cyto: [30, 43, 32],
      envelopePart: wall,
      parts: parts
    };
  }

  /* ---------- bacteria ---------- */
  function bacteria() {
    var parts = [];
    var R = [0.95, 0.42, 0.42];

    parts.push({
      id: "coat", label: "Capsule", color: PAL.coat,
      job: "A sticky sugar coat. It sheds antibodies and glues the cell to surfaces.",
      anchor: [0, R[1] + 0.12, 0],
      outer: [ellip([0, 0, 0], [R[0] + 0.09, R[1] + 0.09, R[2] + 0.09], [0, 0, 0],
        { shell: 1, alpha: 0.34 })]
    });

    var wall = {
      id: "wall", label: "Cell wall", color: PAL.wall,
      job: "A peptidoglycan mesh that holds the rod shape. Penicillin works by stopping cells building it.",
      anchor: [0, R[1], 0.2]
    };
    parts.push(wall);

    parts.push({
      id: "membrane", label: "Cell membrane", color: PAL.membrane,
      job: "The real barrier, just inside the wall. It also does the work mitochondria do in your cells.",
      anchor: [0, R[1] - 0.06, 0.3],
      shapes: [ellip([0, 0, 0], [R[0] * 0.94, R[1] * 0.88, R[2] * 0.88], [0, 0, 0],
        { shell: 1, alpha: 0.55 })]
    });

    parts.push({
      id: "nucleoid", label: "Nucleoid", color: PAL.nucleoid,
      job: "One coiled loop of DNA sitting free in the cytoplasm. No nucleus, no envelope, no pores.",
      anchor: [0, 0.18, 0.2],
      shapes: (function () {
        /* a helix along the rod axis: coiled DNA reads as order, where the old
           mixed-frequency curve just read as a scribble */
        var pts = [], N = 44;
        for (var i = 0; i <= N; i++) {
          var u = i / N, a = u * Math.PI * 4.2;
          var taper = Math.sin(Math.PI * (0.12 + u * 0.76));
          pts.push([(u - 0.5) * 1.16, Math.sin(a) * 0.135 * taper, Math.cos(a) * 0.135 * taper]);
        }
        return [tube(pts, 0.017, { alpha: 0.96 })];
      })()
    });

    parts.push({
      id: "plasmid", label: "Plasmid", color: PAL.plasmid,
      job: "A spare DNA ring, copied and passed between cells. This is how resistance genes travel.",
      anchor: [-0.46, -0.18, 0.2],
      shapes: [
        ring([-0.46, -0.16, 0.12], 0.10, 0.018, [0.6, 0.4, 0], {}),
        ring([0.40, 0.20, -0.14], 0.078, 0.016, [1.5, -0.3, 0], {})
      ]
    });

    parts.push({
      id: "ribo", label: "Ribosomes", color: PAL.ribo,
      job: "Smaller than yours, and different enough that some antibiotics jam theirs and leave yours alone.",
      anchor: [0.3, -0.28, 0.3],
      shapes: (function () {
        /* Keep every ribosome inside the rod. The cross-section narrows toward the
           poles, so sample that profile instead of a straight cylinder, which is
           what pushed granules out through the ends. sqrt() spreads them evenly
           over the cross-section rather than bunching them on the axis. */
        var it = [], rand = rng(97);
        for (var i = 0; i < 34; i++) {
          var x = (rand() - 0.5) * 1.66;
          var prof = Math.sqrt(Math.max(0, 1 - (x / R[0]) * (x / R[0])));
          var a = rand() * 6.2832;
          var rr = Math.sqrt(rand()) * 0.78 * R[1] * prof;
          it.push(ball([x, Math.sin(a) * rr, Math.cos(a) * rr], 0.017 + rand() * 0.008, { rim: 0 }));
        }
        return it;
      })()
    });

    parts.push({
      id: "flag", label: "Flagellum", color: PAL.flag,
      job: "A stiff corkscrew driven by a rotary motor in the membrane. It spins, and the cell swims.",
      anchor: [1.25, 0.08, 0],
      outer: (function () {
        var pts = [];
        for (var i = 0; i <= 36; i++) {
          var u = i / 36;
          var a = u * Math.PI * 4.2;
          var amp = 0.08 * Math.min(1, u * 4);
          pts.push([0.92 + u * 0.58, Math.sin(a) * amp, Math.cos(a) * amp]);
        }
        return [tube(pts, 0.020, {})];
      })()
    });

    parts.push({
      id: "pili", label: "Pili", color: PAL.pili,
      job: "Short hairs for grip. One special pilus reels in another cell so the two can swap a plasmid.",
      anchor: [-0.85, 0.28, 0],
      outer: (function () {
        /* Short radial hairs raised off the real rod surface, using the same
           cross-section profile as the ribosomes so they root in the wall. */
        var it = [], rand = rng(59);
        for (var i = 0; i < 10; i++) {
          var x = (rand() - 0.5) * 1.5;
          var a = rand() * 6.2832;
          var prof = Math.sqrt(Math.max(0.05, 1 - (x / R[0]) * (x / R[0])));
          var s0 = R[1] * prof;
          var ry = Math.sin(a), rz = Math.cos(a);
          var A = [x, ry * s0 * 0.92, rz * s0 * 0.92];
          var B = [x + (rand() - 0.5) * 0.05, ry * (s0 + 0.12), rz * (s0 + 0.12)];
          it.push(tube([A, B], 0.0075, { alpha: 0.8 }));
        }
        return it;
      })()
    });

    return {
      key: "bacteria", name: "Bacterial cell", kind: "Prokaryote",
      note: "Prokaryotic. No nucleus, no membrane bound organelles, and it divides in about twenty minutes.",
      envelope: ellip([0, 0, 0], R, [0, 0, 0], { color: PAL.wall, alpha: 0.95, shell: 1, env: 1 }),
      cyto: [34, 40, 30],
      envelopePart: wall,
      parts: parts
    };
  }

  /* Offset every point in a model. The model spins about the ORIGIN, so its
     bounding sphere (and therefore how large it can be drawn) shrinks a lot when
     the geometry sits off-centre. A flagellum on one end does exactly that, so
     the rod gets recentred before it is handed to the renderer. */
  function shiftModel(model, d) {
    function move(p) { return [p[0] + d[0], p[1] + d[1], p[2] + d[2]]; }
    function walk(list) {
      (list || []).forEach(function (s) {
        if (s.pts) { s.pts = s.pts.map(move); } else { s.p = move(s.p); }
      });
    }
    if (model.envelope) { walk([model.envelope]); }
    model.parts.forEach(function (part) {
      walk(part.shapes); walk(part.inner); walk(part.outer);
      if (part.hull) { walk([part.hull]); }
      (part.bodies || []).forEach(function (b) { walk([b.hull]); walk(b.inner); });
      if (part.anchor) { part.anchor = move(part.anchor); }
    });
    return model;
  }

  global.CellModels = {
    PAL: PAL,
    build: function () {
      return {
        animal: animal(),
        plant: plant(),
        /* centred on the span of envelope PLUS flagellum, so neither end drives
           the bounding radius alone and the rod draws as large as it can */
        bacteria: shiftModel(bacteria(), [-0.275, 0, 0])
      };
    }
  };
})(window);
