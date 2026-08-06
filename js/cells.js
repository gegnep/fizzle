/* AI-ASSISTED: portions of this file were written with the help of an AI assistant (Claude), per course policy. */
/* cells.js: the Cell Explorer.

   A small 3D viewer painted on a 2D canvas. There is no 3D library here. This
   file carries its own vector math, turns each shape into a screen shape,
   sorts the shapes back to front, and paints them with gradients for shading.

   Three primitives cover every organelle:
     ellipsoid  spheres, ovals and flattened discs
     capsule    rods and tubes with round ends
     face       a flat panel, used for the plant cell wall

   A cell is a list of parts. A part is one organelle and holds its primitives
   in model space. Model space centres the cell on the origin at radius 1.

   Drag to turn the cell. Scroll to zoom. Hover to highlight, click to select.
   The list beside the canvas selects the same parts, so the demo also works
   from the keyboard alone. */

(function () {
  "use strict";

  /* ---------- vector math ---------- */

  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function norm(a) {
    var l = Math.sqrt(dot(a, a)) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  }
  /* any unit vector at right angles to a */
  function perp(a) {
    var t = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    return norm(cross(a, t));
  }

  /* ---------- colour ---------- */

  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function lift(c, t) {
    /* t above zero lightens, t below zero darkens */
    return t >= 0 ? mix(c, [255, 255, 255], t) : mix(c, [10, 12, 24], -t);
  }
  function rgba(c, a) {
    return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," +
      Math.max(0, Math.min(1, a)).toFixed(3) + ")";
  }
  function readHex(name, fallback) {
    var s = getComputedStyle(document.body).getPropertyValue(name).trim();
    var m = /^#?([0-9a-f]{6})$/i.exec(s);
    if (!m) { return fallback; }
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /* ---------- repeatable random ---------- */
  /* The scattered parts must land in the same place on every repaint, so the
     generator is seeded rather than taken from Math.random. */
  function rng(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function scatter(count, seed, keep) {
    var r = rng(seed), out = [], guard = 0;
    while (out.length < count && guard++ < count * 60) {
      var p = [r() * 2 - 1, r() * 2 - 1, r() * 2 - 1];
      if (keep(p)) { out.push(p); }
    }
    return out;
  }

  /* ---------- primitives ---------- */
  /* ell: centre plus three semi-axis vectors. cap: two ends plus a radius.
     face: a flat ring of points. opt carries the paint options. */

  function ell(p, axes, opt) { return { t: "e", p: p, ax: axes, o: opt || {} }; }
  function cap(a, b, r, opt) { return { t: "c", a: a, b: b, r: r, o: opt || {} }; }
  function face(pts, opt) { return { t: "f", pts: pts, o: opt || {} }; }

  function ball(p, r, opt) {
    return ell(p, [[r, 0, 0], [0, r, 0], [0, 0, r]], opt);
  }
  /* an egg shape: r1 along dir, r2 across it */
  function ovoid(p, dir, r1, r2, opt) {
    var u = norm(dir), v = perp(u), w = cross(u, v);
    return ell(p, [mul(u, r1), mul(v, r2), mul(w, r2)], opt);
  }
  /* a flat disc of radius r and half-thickness th, facing dir */
  function disc(p, dir, r, th, opt) {
    var u = norm(dir), v = perp(u), w = cross(u, v);
    return ell(p, [mul(u, th), mul(v, r), mul(w, r)], opt);
  }
  /* a path swept with a round profile, cut into capsules so each piece sorts
     by its own depth. A long curve otherwise sorts as one lump. */
  function tube(pts, r, opt) {
    var out = [];
    for (var i = 0; i < pts.length - 1; i++) {
      out.push(cap(pts[i], pts[i + 1], typeof r === "function" ? r(i / (pts.length - 1)) : r, opt));
    }
    return out;
  }
  /* a ribbon: one quad per step along a path, with the width along side */
  function strip(pts, side, w, opt) {
    var out = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var sa = mul(side, w), sb = mul(side, w);
      out.push(face([add(pts[i], sa), add(pts[i + 1], sb),
        sub(pts[i + 1], sb), sub(pts[i], sa)], opt));
    }
    return out;
  }
  function push(list, items) {
    for (var i = 0; i < items.length; i++) { list.push(items[i]); }
    return list;
  }

  /* ---------- organelle colours ---------- */
  /* Fixed rather than themed. A mitochondrion stays orange in both themes so
     the colour itself carries meaning. */
  var PAL = {
    membrane: [82, 176, 116], wall: [178, 150, 92], nucleus: [126, 114, 218],
    nucleolus: [72, 58, 152], chromatin: [158, 148, 232], mito: [234, 140, 74],
    er: [72, 146, 198], golgi: [208, 112, 186], lyso: [226, 84, 84],
    vesicle: [242, 182, 62], ribo: [216, 76, 76], skel: [148, 162, 184],
    centro: [140, 124, 218], chloro: [62, 156, 76], grana: [32, 98, 44],
    vacuole: [118, 196, 234], plasmid: [208, 112, 186], nucleoid: [104, 196, 116],
    flag: [72, 146, 198], coat: [148, 206, 218], pili: [192, 178, 142]
  };

  /* ---------- the animal cell ---------- */

  function buildAnimal() {
    var parts = [];
    var NUC = [-0.20, 0.08, -0.02], NR = 0.38;

    parts.push({
      id: "membrane", label: "Cell membrane", color: PAL.membrane,
      job: "Controls what enters and leaves. A double layer of fat with proteins set through it.",
      anchor: [0, 1.0, 0],
      items: [ell([0, 0, 0], [[1.05, 0, 0], [0, 0.92, 0.04], [0, 0, 0.98]],
        { color: PAL.membrane, glass: 0.30, rim: 1 })]
    });

    parts.push({
      id: "nucleus", label: "Nucleus", color: PAL.nucleus,
      job: "Holds the DNA and decides which genes get copied. The pores in its wall meter the traffic.",
      anchor: add(NUC, [0, NR, 0]),
      items: (function () {
        var it = [ball(NUC, NR, { color: PAL.nucleus, glass: 0.34, rim: 1 })];
        /* pores read as beads set into the nuclear envelope */
        var r = rng(7);
        for (var i = 0; i < 22; i++) {
          var u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
          it.push(ball(add(NUC, mul([s * Math.cos(a), u, s * Math.sin(a)], NR)), 0.032,
            { color: lift(PAL.nucleus, -0.25), flat: 1 }));
        }
        /* chromatin: loose threads inside the envelope */
        for (var k = 0; k < 5; k++) {
          var q = rng(31 + k), pts = [], c = [q() - 0.5, q() - 0.5, q() - 0.5];
          for (var j = 0; j <= 9; j++) {
            var d = mul([q() - 0.5, q() - 0.5, q() - 0.5], 0.30);
            c = [c[0] * 0.55 + d[0], c[1] * 0.55 + d[1], c[2] * 0.55 + d[2]];
            pts.push(add(NUC, mul(norm(c), NR * 0.62 * (0.4 + q() * 0.6))));
          }
          push(it, tube(pts, 0.016, { color: PAL.chromatin, flat: 1, alpha: 0.85 }));
        }
        return it;
      })()
    });

    parts.push({
      id: "nucleolus", label: "Nucleolus", color: PAL.nucleolus,
      job: "A dense knot inside the nucleus that builds ribosomes and ships them out.",
      anchor: add(NUC, [0.06, 0.06, 0.10]),
      items: [ball(add(NUC, [0.06, 0.05, 0.09]), 0.135, { color: PAL.nucleolus, speckle: 6 })]
    });

    parts.push({
      id: "er", label: "Endoplasmic reticulum", color: PAL.er,
      job: "Folded sheets wrapped around the nucleus. Rough ER carries ribosomes and folds proteins.",
      anchor: add(NUC, [0.50, 0.10, 0.24]),
      items: (function () {
        /* Curved plates wrapped part way round the nucleus. Sheets, not pipes,
           and only on one flank so the nucleus stays in view. */
        var it = [], r = rng(19);
        var sheets = [[NR + 0.13, -0.20, 0.145, 1.8], [NR + 0.25, 0.03, 0.125, 1.5],
          [NR + 0.36, 0.24, 0.105, 1.2]];
        sheets.forEach(function (s, si) {
          var rad = s[0], yc = s[1], hw = s[2], span = s[3];
          /* the band sits on one flank of the nucleus, not across its face */
          var from = 1.95 + si * 0.22, pts = [], N = 15;
          for (var i = 0; i <= N; i++) {
            var a = from + (i / N) * span;
            var wob = 1 + 0.075 * Math.sin(i * 0.95 + si);
            pts.push(add(NUC, [Math.cos(a) * rad * wob, yc + 0.055 * Math.sin(i * 0.8),
              Math.sin(a) * rad * wob]));
          }
          push(it, strip(pts, [0, 1, 0], hw, { color: PAL.er, alpha: 0.88 }));
          /* thin rails give the sheet a crisp edge */
          push(it, tube(pts.map(function (p) { return add(p, [0, hw, 0]); }), 0.011,
            { color: lift(PAL.er, -0.22), flat: 1, alpha: 0.9 }));
          push(it, tube(pts.map(function (p) { return sub(p, [0, hw, 0]); }), 0.011,
            { color: lift(PAL.er, -0.22), flat: 1, alpha: 0.9 }));
          /* ribosomes stud the rough face */
          for (var k = 0; k < 10; k++) {
            var p = pts[1 + ((r() * (N - 1)) | 0)];
            it.push(ball(add(p, [0, (r() * 2 - 1) * hw, 0]), 0.020,
              { color: PAL.ribo, flat: 1 }));
          }
        });
        return it;
      })()
    });

    parts.push({
      id: "golgi", label: "Golgi apparatus", color: PAL.golgi,
      job: "A stack of sorting trays. It finishes proteins, labels them, and buds off the delivery.",
      anchor: [0.42, -0.34, 0.30],
      items: (function () {
        var it = [], base = [0.44, -0.36, 0.28], up = norm([0.22, 1, 0.3]);
        for (var i = 0; i < 6; i++) {
          var k = i / 5;
          it.push(disc(add(base, mul(up, (i - 2.5) * 0.062)), up, 0.24 - Math.abs(k - 0.4) * 0.16,
            0.020, { color: lift(PAL.golgi, i * 0.035), bend: 1 }));
        }
        var r = rng(5);
        for (var v = 0; v < 4; v++) {
          it.push(ball(add(base, [0.24 + r() * 0.18, -0.12 - r() * 0.2, r() * 0.24 - 0.1]),
            0.045 + r() * 0.02, { color: PAL.vesicle }));
        }
        return it;
      })()
    });

    parts.push({
      id: "mito", label: "Mitochondrion", color: PAL.mito,
      job: "Burns sugar with oxygen to make ATP. The folds inside add the surface area to do it.",
      anchor: [0.52, 0.36, 0.12],
      items: (function () {
        var it = [], set = [
          [[0.52, 0.36, 0.10], [0.7, 0.5, -0.4]],
          [[-0.02, -0.52, 0.35], [1, 0.1, 0.5]],
          [[-0.58, -0.22, 0.30], [0.3, -0.8, 0.4]],
          [[0.30, 0.10, -0.55], [-0.5, 0.5, 0.6]],
          [[-0.46, 0.44, 0.28], [0.9, 0.3, 0.2]]
        ];
        for (var i = 0; i < set.length; i++) {
          it.push(ovoid(set[i][0], set[i][1], 0.26, 0.115,
            { color: PAL.mito, stripes: 5, stripeColor: lift(PAL.mito, -0.42) }));
        }
        return it;
      })()
    });

    parts.push({
      id: "lyso", label: "Lysosome", color: PAL.lyso,
      job: "An acid bag of digestive enzymes. It breaks down worn out parts and keeps them sealed away.",
      anchor: [-0.60, 0.30, 0.35],
      items: [
        ball([-0.62, 0.32, 0.34], 0.105, { color: PAL.lyso, speckle: 5 }),
        ball([0.18, -0.62, -0.18], 0.085, { color: PAL.lyso, speckle: 4 }),
        ball([-0.30, -0.10, 0.60], 0.078, { color: PAL.lyso, speckle: 4 })
      ]
    });

    parts.push({
      id: "vesicle", label: "Vesicles", color: PAL.vesicle,
      job: "Small bubbles that carry cargo between compartments and out through the membrane.",
      anchor: [0.70, -0.18, 0.30],
      items: (function () {
        var r = rng(41);
        return scatter(7, 41, function (p) {
          var d = Math.sqrt(dot(p, p));
          return d < 0.86 && d > 0.42;
        }).map(function (p) { return ball(p, 0.038 + r() * 0.022, { color: PAL.vesicle }); });
      })()
    });

    parts.push({
      id: "ribo", label: "Ribosomes", color: PAL.ribo,
      job: "Protein factories. They read the message copied from DNA and build the chain one link at a time.",
      anchor: [0.10, 0.62, 0.45],
      items: scatter(46, 3, function (p) {
        var d = Math.sqrt(dot(p, p));
        var n = [p[0] - NUC[0], p[1] - NUC[1], p[2] - NUC[2]];
        return d < 0.88 && Math.sqrt(dot(n, n)) > NR + 0.10;
      }).map(function (p) { return ball(p, 0.024, { color: PAL.ribo, flat: 1 }); })
    });

    parts.push({
      id: "skel", label: "Cytoskeleton", color: PAL.skel,
      job: "A scaffold of protein rods. It holds the shape, anchors organelles, and pulls the cell apart when it divides.",
      anchor: [0.0, -0.80, 0.35],
      items: (function () {
        var it = [], r = rng(23);
        for (var i = 0; i < 7; i++) {
          var a = norm([r() * 2 - 1, r() * 2 - 1, r() * 2 - 1]);
          var b = norm([r() * 2 - 1, r() * 2 - 1, r() * 2 - 1]);
          push(it, tube([mul(a, 0.88), mul([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], 0.5),
            mul(b, 0.88)], 0.0075, { color: PAL.skel, alpha: 0.55, flat: 1 }));
        }
        return it;
      })()
    });

    parts.push({
      id: "centro", label: "Centrosome", color: PAL.centro,
      job: "Two short barrels set at right angles. They organise the fibres that pull chromosomes apart.",
      anchor: [-0.30, 0.52, -0.30],
      items: (function () {
        var it = [], c = [-0.30, 0.50, -0.32];
        var axes = [[1, 0.2, 0.1], [0.1, 0.3, 1]];
        for (var k = 0; k < 2; k++) {
          var u = norm(axes[k]), v = perp(u), w = cross(u, v);
          for (var i = 0; i < 7; i++) {
            var a = (i / 7) * Math.PI * 2;
            var off = add(mul(v, Math.cos(a) * 0.055), mul(w, Math.sin(a) * 0.055));
            it.push(cap(add(add(c, off), mul(u, -0.075)), add(add(c, off), mul(u, 0.075)), 0.016,
              { color: PAL.centro, flat: 1 }));
          }
        }
        return it;
      })()
    });

    return {
      name: "Animal cell", fit: 1.0,
      note: "A typical human cell. No wall, no chloroplasts, and no vacuole worth the name.",
      parts: parts
    };
  }

  /* ---------- the plant cell ---------- */

  function buildPlant() {
    var H = [0.98, 0.74, 0.74];          /* half sizes of the box */
    var parts = [];

    function corners(h) {
      var c = [];
      for (var i = 0; i < 8; i++) {
        c.push([(i & 1 ? 1 : -1) * h[0], (i & 2 ? 1 : -1) * h[1], (i & 4 ? 1 : -1) * h[2]]);
      }
      return c;
    }
    var FACE_IDX = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]];
    var EDGE_IDX = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7],
      [0, 4], [1, 5], [2, 6], [3, 7]];

    parts.push({
      id: "wall", label: "Cell wall", color: PAL.wall,
      job: "A rigid cellulose box outside the membrane. It sets the shape and stops the cell bursting.",
      anchor: [0, H[1], 0],
      items: (function () {
        var c = corners(H), it = [];
        FACE_IDX.forEach(function (f) {
          it.push(face([c[f[0]], c[f[1]], c[f[2]], c[f[3]]], { color: PAL.wall, alpha: 0.13 }));
        });
        EDGE_IDX.forEach(function (e) {
          it.push(cap(c[e[0]], c[e[1]], 0.032, { color: PAL.wall, alpha: 0.95 }));
        });
        return it;
      })()
    });

    parts.push({
      id: "membrane", label: "Cell membrane", color: PAL.membrane,
      job: "Sits just inside the wall and does the real gatekeeping. The wall is scaffolding, not a filter.",
      anchor: [0, H[1] - 0.07, 0.4],
      items: (function () {
        var c = corners([H[0] - 0.06, H[1] - 0.06, H[2] - 0.06]), it = [];
        FACE_IDX.forEach(function (f) {
          it.push(face([c[f[0]], c[f[1]], c[f[2]], c[f[3]]], { color: PAL.membrane, alpha: 0.15 }));
        });
        EDGE_IDX.forEach(function (e) {
          it.push(cap(c[e[0]], c[e[1]], 0.016, { color: PAL.membrane, alpha: 0.9, flat: 1 }));
        });
        return it;
      })()
    });

    parts.push({
      id: "vacuole", label: "Central vacuole", color: PAL.vacuole,
      job: "A water balloon that fills most of the cell. Its pressure against the wall is what holds a leaf up.",
      anchor: [0.05, 0.42, 0.30],
      items: [ell([0.05, 0.02, 0.02], [[0.62, 0, 0], [0, 0.50, 0], [0, 0, 0.48]],
        { color: PAL.vacuole, glass: 0.30, rim: 1 })]
    });

    parts.push({
      id: "nucleus", label: "Nucleus", color: PAL.nucleus,
      job: "Holds the DNA. The vacuole pushes it out to the edge, which is where you always find it.",
      anchor: [-0.62, -0.34, 0.30],
      items: [
        ball([-0.62, -0.36, 0.26], 0.26, { color: PAL.nucleus, glass: 0.34, rim: 1 }),
        ball([-0.60, -0.34, 0.32], 0.095, { color: PAL.nucleolus, speckle: 5 })
      ]
    });

    parts.push({
      id: "chloro", label: "Chloroplast", color: PAL.chloro,
      job: "Runs photosynthesis. The green stacks inside catch light and drive carbon dioxide into sugar.",
      anchor: [0.60, 0.44, 0.42],
      items: (function () {
        var set = [
          [[0.60, 0.42, 0.40], [1, 0.3, 0.2]], [[-0.28, 0.52, 0.44], [0.6, -0.2, 0.8]],
          [[0.30, -0.50, 0.46], [1, 0.4, -0.3]], [[-0.70, 0.30, -0.30], [0.2, 0.9, 0.3]],
          [[0.72, -0.28, -0.34], [0.8, -0.4, 0.4]], [[-0.10, -0.56, -0.42], [0.5, 0.6, 0.6]]
        ], it = [];
        set.forEach(function (s) {
          it.push(ovoid(s[0], s[1], 0.24, 0.125,
            { color: PAL.chloro, grana: 4, stripeColor: PAL.grana }));
        });
        return it;
      })()
    });

    parts.push({
      id: "mito", label: "Mitochondrion", color: PAL.mito,
      job: "Still here. Plants respire day and night, and burn the sugar the chloroplasts made.",
      anchor: [-0.66, 0.46, 0.20],
      items: [
        ovoid([-0.68, 0.46, 0.18], [0.9, 0.4, 0.2], 0.22, 0.10,
          { color: PAL.mito, stripes: 4, stripeColor: lift(PAL.mito, -0.42) }),
        ovoid([0.14, 0.56, -0.42], [0.3, 0.2, 1], 0.20, 0.095,
          { color: PAL.mito, stripes: 4, stripeColor: lift(PAL.mito, -0.42) }),
        ovoid([0.44, -0.52, 0.06], [1, -0.3, 0.4], 0.19, 0.09,
          { color: PAL.mito, stripes: 4, stripeColor: lift(PAL.mito, -0.42) })
      ]
    });

    parts.push({
      id: "golgi", label: "Golgi apparatus", color: PAL.golgi,
      job: "Packs proteins, and in a plant also builds the sugars that go into the wall.",
      anchor: [-0.22, -0.52, 0.30],
      items: (function () {
        var it = [], base = [-0.24, -0.52, 0.26], up = norm([0.3, 1, 0.1]);
        for (var i = 0; i < 5; i++) {
          it.push(disc(add(base, mul(up, (i - 2) * 0.058)), up,
            0.19 - Math.abs(i / 4 - 0.4) * 0.10, 0.018, { color: lift(PAL.golgi, i * 0.04), bend: 1 }));
        }
        return it;
      })()
    });

    parts.push({
      id: "ribo", label: "Ribosomes", color: PAL.ribo,
      job: "Protein factories, scattered loose in the cytoplasm and stuck along the ER.",
      anchor: [0.5, -0.6, 0.5],
      items: scatter(40, 11, function (p) {
        var q = [p[0] * H[0], p[1] * H[1], p[2] * H[2]];
        var v = [q[0] - 0.05, q[1] - 0.02, q[2] - 0.02];
        var inside = Math.abs(q[0]) < H[0] - 0.12 && Math.abs(q[1]) < H[1] - 0.12 &&
          Math.abs(q[2]) < H[2] - 0.12;
        var outVac = (v[0] * v[0]) / 0.50 + (v[1] * v[1]) / 0.34 + (v[2] * v[2]) / 0.32 > 1.25;
        return inside && outVac;
      }).map(function (p) {
        return ball([p[0] * H[0], p[1] * H[1], p[2] * H[2]], 0.023, { color: PAL.ribo, flat: 1 });
      })
    });

    parts.push({
      id: "plasmo", label: "Plasmodesmata", color: PAL.vesicle,
      job: "Lined channels straight through the wall. Neighbouring cells trade water and signals through them.",
      anchor: [0, H[1] + 0.05, 0],
      items: (function () {
        var it = [], spots = [[-0.4, 0.3], [0.1, -0.2], [0.5, 0.35]];
        spots.forEach(function (s) {
          it.push(cap([s[0], H[1] - 0.10, s[1]], [s[0], H[1] + 0.10, s[1]], 0.048,
            { color: PAL.vesicle }));
          it.push(cap([s[1], -H[1] - 0.10, s[0]], [s[1], -H[1] + 0.10, s[0]], 0.048,
            { color: PAL.vesicle }));
        });
        return it;
      })()
    });

    return {
      name: "Plant cell", fit: 0.78,
      note: "The same eukaryotic parts, plus a rigid wall, chloroplasts, and one enormous vacuole.",
      parts: parts
    };
  }

  /* ---------- the bacterial cell ---------- */

  function buildBacteria() {
    var L = 0.52, R = 0.44;              /* half length of the straight part, and radius */
    var A = [-L, 0, 0], B = [L, 0, 0];
    var parts = [];

    parts.push({
      id: "coat", label: "Capsule", color: PAL.coat,
      job: "A sticky sugar coat. It sheds antibodies and glues the cell to surfaces.",
      anchor: [0, R + 0.10, 0],
      items: [cap(A, B, R + 0.10, { color: PAL.coat, glass: 0.16, rim: 1, dash: 1 })]
    });

    parts.push({
      id: "wall", label: "Cell wall", color: PAL.wall,
      job: "A peptidoglycan mesh that holds the rod shape. Penicillin works by stopping cells building it.",
      anchor: [0, R, 0.2],
      items: [cap(A, B, R, { color: PAL.wall, glass: 0.26, rim: 1 })]
    });

    parts.push({
      id: "membrane", label: "Cell membrane", color: PAL.membrane,
      job: "The real barrier, just inside the wall. It also does the work mitochondria do in your cells.",
      anchor: [0, R - 0.05, 0.3],
      items: [cap(A, B, R - 0.055, { color: PAL.membrane, glass: 0.22, rim: 1 })]
    });

    parts.push({
      id: "nucleoid", label: "Nucleoid", color: PAL.nucleoid,
      job: "One coiled loop of DNA sitting free in the cytoplasm. No nucleus, no envelope, no pores.",
      anchor: [0, 0.2, 0.2],
      items: (function () {
        var pts = [];
        for (var i = 0; i <= 72; i++) {
          var a = (i / 72) * Math.PI * 2;
          var rad = 0.20 + 0.075 * Math.sin(a * 3);
          pts.push([Math.cos(a) * rad * 2.5, Math.sin(a) * rad * 1.05, Math.sin(a * 2 + 1) * 0.17]);
        }
        return tube(pts, 0.030, { color: PAL.nucleoid });
      })()
    });

    parts.push({
      id: "plasmid", label: "Plasmid", color: PAL.plasmid,
      job: "A spare DNA ring, copied and passed between cells. This is how resistance genes travel.",
      anchor: [-0.45, -0.20, 0.2],
      items: (function () {
        var it = [], rings = [
          [[-0.46, -0.19, 0.14], [0.3, 1, 0.4], 0.105],
          [[0.50, 0.20, -0.10], [1, 0.2, 0.5], 0.085]
        ];
        rings.forEach(function (r) {
          var u = norm(r[1]), v = perp(u), w = cross(u, v), pts = [];
          for (var i = 0; i <= 26; i++) {
            var a = (i / 26) * Math.PI * 2;
            pts.push(add(r[0], add(mul(v, Math.cos(a) * r[2]), mul(w, Math.sin(a) * r[2]))));
          }
          push(it, tube(pts, 0.024, { color: PAL.plasmid }));
        });
        return it;
      })()
    });

    parts.push({
      id: "ribo", label: "Ribosomes", color: PAL.ribo,
      job: "Smaller than yours, and different enough that some antibiotics jam theirs and leave yours alone.",
      anchor: [0.3, -0.3, 0.3],
      items: scatter(60, 13, function (p) {
        var x = p[0] * (L + R * 0.4), y = p[1] * (R - 0.12), z = p[2] * (R - 0.12);
        return y * y + z * z < (R - 0.13) * (R - 0.13) && Math.abs(x) < L + 0.16;
      }).map(function (p) {
        return ball([p[0] * (L + R * 0.4), p[1] * (R - 0.12), p[2] * (R - 0.12)], 0.026,
          { color: PAL.ribo, flat: 1 });
      })
    });

    parts.push({
      id: "flag", label: "Flagellum", color: PAL.flag,
      job: "A stiff corkscrew driven by a rotary motor in the membrane. It spins, and the cell swims.",
      anchor: [1.3, 0.1, 0],
      items: (function () {
        var pts = [];
        for (var i = 0; i <= 64; i++) {
          var t = i / 64, x = L + R * 0.6 + t * 1.15, a = t * Math.PI * 7.5;
          var g = Math.min(1, t * 5) * 0.155;
          pts.push([x, Math.sin(a) * g, Math.cos(a) * g]);
        }
        return tube(pts, 0.026, { color: PAL.flag });
      })()
    });

    parts.push({
      id: "pili", label: "Pili", color: PAL.pili,
      job: "Short hairs for grip. One special pilus reels in another cell so the two can swap a plasmid.",
      anchor: [-0.9, 0.3, 0],
      items: (function () {
        var it = [], r = rng(29);
        for (var i = 0; i < 14; i++) {
          var a = r() * Math.PI * 2, x = (r() * 2 - 1) * L;
          var d = [Math.cos(a), Math.sin(a)];
          var base = [x, d[0] * R, d[1] * R];
          var tip = [x + (r() - 0.5) * 0.14, d[0] * (R + 0.17), d[1] * (R + 0.17)];
          push(it, tube([base, tip], 0.010, { color: PAL.pili, flat: 1 }));
        }
        return it;
      })()
    });

    return {
      name: "Bacterial cell", fit: 0.76,
      note: "Prokaryotic. No nucleus, no membrane bound organelles, and it divides in about twenty minutes.",
      parts: parts
    };
  }

  /* Move a whole cell in model space, so a lopsided one still sits centred.
     The bacterium needs this: its flagellum only grows from one end. */
  function shiftCell(cell, d) {
    cell.parts.forEach(function (part) {
      part.anchor = add(part.anchor, d);
      part.items.forEach(function (it) {
        if (it.t === "e") { it.p = add(it.p, d); }
        else if (it.t === "c") { it.a = add(it.a, d); it.b = add(it.b, d); }
        else { it.pts = it.pts.map(function (p) { return add(p, d); }); }
      });
    });
    return cell;
  }

  var CELLS = {
    animal: buildAnimal(),
    plant: buildPlant(),
    bacteria: shiftCell(buildBacteria(), [-0.42, 0, 0])
  };

  /* ---------- state ---------- */

  var canvas, ctx, viewport, listEl, readEl, tabEls, hintEl;
  var W = 0, H = 0, DPR = 1;
  var view = { yaw: -0.62, pitch: -0.26, zoom: 1, spin: true };
  var tween = null;
  var current = "animal", selected = null, hovered = null;
  var dirty = true, running = false, visible = true;
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var theme = { bg: [255, 255, 255], haze: [230, 235, 245], ink: [76, 79, 105], dark: false };
  var LIGHT = norm([-0.42, 0.62, 0.66]);
  var CAM = 5.4;
  var hits = [];                          /* screen shapes for hit testing, front first */

  function readTheme() {
    theme.dark = document.body.classList.contains("dark");
    theme.bg = readHex("--card", theme.dark ? [49, 50, 68] : [255, 255, 255]);
    theme.ink = readHex("--text", theme.dark ? [205, 214, 244] : [76, 79, 105]);
    theme.haze = theme.dark ? mix(theme.bg, [10, 12, 26], 0.35) : mix(theme.bg, [214, 226, 236], 0.75);
    dirty = true;
  }

  /* ---------- projection ---------- */

  var cy_ = 1, sy_ = 0, cp_ = 1, sp_ = 0, SCALE = 100, OX = 0, OY = 0;

  function setCamera() {
    cy_ = Math.cos(view.yaw); sy_ = Math.sin(view.yaw);
    cp_ = Math.cos(view.pitch); sp_ = Math.sin(view.pitch);
    SCALE = Math.min(W, H * 1.28) * 0.40 * view.zoom * CELLS[current].fit;
    OX = W / 2; OY = H / 2;
  }
  /* model space to view space */
  function toView(p) {
    var x = p[0] * cy_ + p[2] * sy_;
    var z = -p[0] * sy_ + p[2] * cy_;
    var y = p[1];
    return [x, y * cp_ - z * sp_, y * sp_ + z * cp_];
  }
  /* view space to screen, with a light perspective divide */
  function toScreen(v) {
    var k = CAM / (CAM - v[2]);
    return [OX + v[0] * SCALE * k, OY - v[1] * SCALE * k, k];
  }

  /* ---------- turning primitives into screen shapes ---------- */

  function ellipseOf(item) {
    var c = toView(item.p), s = toScreen(c), k = s[2] * SCALE;
    /* project the three semi-axes, then read the outline off the 2x2 form */
    var a = toView(item.ax[0]), b = toView(item.ax[1]), d = toView(item.ax[2]);
    var xx = a[0] * k, xy = b[0] * k, xz = d[0] * k;
    var yx = -a[1] * k, yy = -b[1] * k, yz = -d[1] * k;
    var m11 = xx * xx + xy * xy + xz * xz;
    var m22 = yx * yx + yy * yy + yz * yz;
    var m12 = xx * yx + xy * yy + xz * yz;
    var half = (m11 + m22) / 2, diff = (m11 - m22) / 2;
    var root = Math.sqrt(diff * diff + m12 * m12);

    /* A plate needs flat shading, not the round gradient a ball gets. Compare
       the shortest semi-axis with the longest to tell the two apart. */
    var la = Math.sqrt(dot(a, a)), lb = Math.sqrt(dot(b, b)), ld = Math.sqrt(dot(d, d));
    var lo = Math.min(la, lb, ld), hi2 = Math.max(la, lb, ld);
    var thin = lo === la ? a : (lo === lb ? b : d);

    return {
      kind: "e", z: c[2], cx: s[0], cy: s[1],
      ra: Math.sqrt(Math.max(0.12, half + root)),
      rb: Math.sqrt(Math.max(0.12, half - root)),
      th: 0.5 * Math.atan2(2 * m12, m11 - m22),
      squash: hi2 > 0 ? lo / hi2 : 1,
      face: lo > 0 ? [thin[0] / lo, thin[1] / lo, thin[2] / lo] : [0, 0, 1]
    };
  }

  function capsuleOf(item) {
    var va = toView(item.a), vb = toView(item.b);
    var sa = toScreen(va), sb = toScreen(vb);
    var z = (va[2] + vb[2]) / 2;
    var k = CAM / (CAM - z);
    return {
      kind: "c", z: z, ax: sa[0], ay: sa[1], bx: sb[0], by: sb[1],
      r: Math.max(0.4, item.r * SCALE * k)
    };
  }

  function faceOf(item) {
    var pts = [], vs = [], zsum = 0, i;
    for (i = 0; i < item.pts.length; i++) {
      var v = toView(item.pts[i]), s = toScreen(v);
      vs.push(v);
      pts.push([s[0], s[1]]);
      zsum += v[2];
    }
    /* the panel normal sets its tone, the signed area tells which way it faces */
    var n = norm(cross(sub(vs[1], vs[0]), sub(vs[2], vs[0])));
    var area = 0;
    for (i = 0; i < pts.length; i++) {
      var j = (i + 1) % pts.length;
      area += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
    }
    return {
      kind: "f", z: zsum / item.pts.length, pts: pts, front: area < 0,
      lit: 0.30 + 0.70 * Math.abs(dot(n, LIGHT))
    };
  }

  /* ---------- painting ---------- */

  function depthTint(color, z, alpha) {
    /* Far shapes sink into the haze. Near shapes keep their colour. */
    var t = Math.max(0, Math.min(1, (z + 1.15) / 2.3));
    var c = mix(color, theme.haze, (1 - t) * 0.45);
    return { color: c, alpha: alpha * (0.72 + t * 0.28) };
  }

  function highlightDir(th) {
    /* the light direction expressed in the shape's own screen frame */
    var lx = LIGHT[0], ly = -LIGHT[1];
    var c = Math.cos(th), s = Math.sin(th);
    var u = lx * c + ly * s, v = -lx * s + ly * c;
    var m = Math.hypot(u, v) || 1;
    return [(u / m) * 0.46, (v / m) * 0.46];
  }

  function paintEllipse(sh, item, glow) {
    var o = item.o;
    var tint = depthTint(o.color, sh.z, o.alpha === undefined ? 1 : o.alpha);
    var col = tint.color, al = tint.alpha;
    var h = highlightDir(sh.th);
    var ra = Math.max(0.4, sh.ra), rb = Math.max(0.4, sh.rb);

    if (o.glass) {
      /* the far shell, then the near shell as a rim. Anything between them
         sorts in on its own depth, so the inside stays visible. */
      var far = sh.far, up = glow ? 1.9 : 1;
      ctx.save();
      ctx.translate(sh.cx, sh.cy); ctx.rotate(sh.th); ctx.scale(ra, rb);
      var g = ctx.createRadialGradient(h[0], h[1], 0.04, 0, 0, 1);
      if (far) {
        g.addColorStop(0, rgba(lift(col, 0.18), o.glass * 0.75 * up));
        g.addColorStop(1, rgba(lift(col, -0.28), Math.min(1, o.glass * 1.05 * up)));
      } else {
        g.addColorStop(0, rgba(col, 0));
        g.addColorStop(0.62, rgba(col, o.glass * 0.34 * up));
        g.addColorStop(1, rgba(lift(col, 0.30), Math.min(1, o.glass * 1.9 * up)));
      }
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, 1, 0, 6.2832); ctx.fill();
      if (!far) {
        var sp = ctx.createRadialGradient(h[0] * 1.05, h[1] * 1.05, 0.02, h[0] * 1.05, h[1] * 1.05, 0.5);
        sp.addColorStop(0, "rgba(255,255,255," + (theme.dark ? 0.30 : 0.55) + ")");
        sp.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = sp;
        ctx.beginPath(); ctx.arc(0, 0, 1, 0, 6.2832); ctx.fill();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.ellipse(sh.cx, sh.cy, ra, rb, sh.th, 0, 6.2832);
      ctx.strokeStyle = rgba(lift(col, far ? -0.15 : (glow ? 0.4 : 0.12)),
        far ? 0.35 : (glow ? 1 : 0.8));
      ctx.lineWidth = far ? 1 : (glow ? 3 : 1.8);
      if (o.dash) { ctx.setLineDash([6, 5]); }
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }

    if (glow) { ctx.shadowColor = rgba(lift(o.color, 0.25), 0.95); ctx.shadowBlur = 18; }
    ctx.save();
    ctx.translate(sh.cx, sh.cy); ctx.rotate(sh.th); ctx.scale(ra, rb);
    if (o.flat || ra < 3) {
      ctx.fillStyle = rgba(lift(col, glow ? 0.22 : 0), al);
    } else if (sh.squash < 0.30) {
      /* a plate: one normal, so one tone across the whole face */
      var f = 0.30 + 0.70 * Math.abs(dot(sh.face, LIGHT));
      var plate = lift(col, (f - 0.62) * 0.85 + (glow ? 0.3 : 0));
      var pg = ctx.createLinearGradient(-h[0] * 1.6, -h[1] * 1.6, h[0] * 1.6, h[1] * 1.6);
      pg.addColorStop(0, rgba(lift(plate, -0.10), al));
      pg.addColorStop(1, rgba(lift(plate, 0.10), al));
      ctx.fillStyle = pg;
    } else {
      var gg = ctx.createRadialGradient(h[0], h[1], 0.05, 0, 0, 1.05);
      gg.addColorStop(0, rgba(lift(col, glow ? 0.55 : 0.40), al));
      gg.addColorStop(0.5, rgba(lift(col, glow ? 0.16 : 0), al));
      gg.addColorStop(1, rgba(lift(col, -0.34), al));
      ctx.fillStyle = gg;
    }
    ctx.beginPath(); ctx.arc(0, 0, 1, 0, 6.2832); ctx.fill();

    /* inner texture, clipped to the shape: cristae, grana, or a speckle */
    if ((o.stripes || o.grana || o.speckle) && ra > 6) {
      ctx.clip();
      ctx.strokeStyle = rgba(mix(o.stripeColor || lift(col, -0.4), theme.haze, 0.1), 0.75);
      ctx.lineWidth = 0.09;
      ctx.lineCap = "round";
      var n, i;
      if (o.stripes) {
        n = o.stripes;
        for (i = 0; i < n; i++) {
          var x = -0.8 + (i + 0.5) * (1.6 / n);
          ctx.beginPath();
          ctx.moveTo(x, -1);
          ctx.bezierCurveTo(x + 0.34, -0.35, x - 0.34, 0.35, x, 1);
          ctx.stroke();
        }
      }
      if (o.grana) {
        ctx.fillStyle = rgba(o.stripeColor || lift(col, -0.4), 0.8);
        n = o.grana;
        for (i = 0; i < n; i++) {
          var gx = -0.62 + (i + 0.5) * (1.24 / n);
          for (var j = 0; j < 3; j++) {
            ctx.beginPath();
            ctx.ellipse(gx, -0.3 + j * 0.3, 0.20, 0.075, 0.2, 0, 6.2832);
            ctx.fill();
          }
        }
      }
      if (o.speckle) {
        ctx.fillStyle = rgba(lift(col, -0.35), 0.5);
        var q = rng(o.speckle * 17);
        for (i = 0; i < 9; i++) {
          ctx.beginPath();
          ctx.arc(q() * 1.4 - 0.7, q() * 1.4 - 0.7, 0.09 + q() * 0.09, 0, 6.2832);
          ctx.fill();
        }
      }
    }
    ctx.restore();
    ctx.shadowBlur = 0;

    if (ra > 4) {
      ctx.beginPath();
      ctx.ellipse(sh.cx, sh.cy, ra, rb, sh.th, 0, 6.2832);
      ctx.strokeStyle = rgba(lift(col, glow ? 0.5 : -0.35), glow ? 0.95 : 0.32);
      ctx.lineWidth = glow ? 2 : 1;
      ctx.stroke();
    }
  }

  function capsulePath(sh) {
    var a1 = Math.atan2(sh.by - sh.ay, sh.bx - sh.ax);
    ctx.beginPath();
    ctx.arc(sh.ax, sh.ay, sh.r, a1 + Math.PI / 2, a1 + Math.PI * 1.5, false);
    ctx.arc(sh.bx, sh.by, sh.r, a1 - Math.PI / 2, a1 + Math.PI / 2, false);
    ctx.closePath();
  }

  function paintCapsule(sh, item, glow) {
    var o = item.o;
    var tint = depthTint(o.color, sh.z, o.alpha === undefined ? 1 : o.alpha);
    var col = tint.color, al = tint.alpha;
    capsulePath(sh);

    if (o.glass) {
      var far = sh.far, up = glow ? 1.9 : 1;
      ctx.fillStyle = rgba(far ? lift(col, -0.2) : col,
        Math.min(1, o.glass * (far ? 0.55 : 0.42) * up));
      ctx.fill();
      ctx.strokeStyle = rgba(lift(col, far ? -0.1 : (glow ? 0.42 : 0.18)),
        far ? 0.3 : (glow ? 1 : 0.75));
      ctx.lineWidth = far ? 1 : (glow ? 3 : 1.8);
      if (o.dash) { ctx.setLineDash([6, 5]); }
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }

    if (glow) { ctx.shadowColor = rgba(lift(o.color, 0.25), 0.95); ctx.shadowBlur = 16; }
    if (sh.r < 2.2) {
      ctx.fillStyle = rgba(lift(col, glow ? 0.3 : 0), al);
    } else {
      /* shade across the rod, so it reads as round rather than flat */
      var dx = sh.bx - sh.ax, dy = sh.by - sh.ay, d = Math.hypot(dx, dy) || 1;
      var px = -dy / d, py = dx / d;
      var side = (LIGHT[0] * px + -LIGHT[1] * py) >= 0 ? 1 : -1;
      var mx = (sh.ax + sh.bx) / 2, my = (sh.ay + sh.by) / 2;
      var g = ctx.createLinearGradient(mx + px * sh.r * side, my + py * sh.r * side,
        mx - px * sh.r * side, my - py * sh.r * side);
      g.addColorStop(0, rgba(lift(col, glow ? 0.6 : 0.42), al));
      g.addColorStop(0.45, rgba(lift(col, glow ? 0.18 : 0), al));
      g.addColorStop(1, rgba(lift(col, -0.36), al));
      ctx.fillStyle = g;
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    if (sh.r > 3) {
      ctx.strokeStyle = rgba(lift(col, glow ? 0.5 : -0.34), glow ? 0.95 : 0.3);
      ctx.lineWidth = glow ? 2 : 1;
      ctx.stroke();
    }
  }

  function paintFace(sh, item, glow) {
    var o = item.o;
    var tint = depthTint(o.color, sh.z, o.alpha === undefined ? 1 : o.alpha);
    ctx.beginPath();
    ctx.moveTo(sh.pts[0][0], sh.pts[0][1]);
    for (var i = 1; i < sh.pts.length; i++) { ctx.lineTo(sh.pts[i][0], sh.pts[i][1]); }
    ctx.closePath();
    ctx.fillStyle = rgba(lift(tint.color, (sh.lit - 0.64) * 0.85 + (glow ? 0.28 : 0)),
      Math.min(1, tint.alpha * (sh.front ? 0.86 : 1.16) * (glow ? 2.2 : 1)));
    ctx.fill();
  }

  /* ---------- the frame ---------- */

  function backdrop() {
    var g = ctx.createRadialGradient(W * 0.42, H * 0.34, 10, W * 0.5, H * 0.5, Math.max(W, H) * 0.78);
    g.addColorStop(0, rgba(mix(theme.bg, theme.dark ? [92, 104, 150] : [255, 255, 255], 0.5), 1));
    g.addColorStop(1, rgba(mix(theme.bg, theme.dark ? [8, 9, 20] : [196, 210, 226], 0.55), 1));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    /* out of focus specks, turning with the model so the depth reads */
    var r = rng(97);
    for (var i = 0; i < 46; i++) {
      var u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      var rad = 1.7 + r() * 0.9;
      var v = toView([s * Math.cos(a) * rad, u * rad, s * Math.sin(a) * rad]);
      var sc = toScreen(v);
      var t = (v[2] + 2.6) / 5.2;
      ctx.beginPath();
      ctx.arc(sc[0], sc[1], 0.8 + t * 2.6, 0, 6.2832);
      ctx.fillStyle = rgba(theme.dark ? [190, 205, 245] : [90, 110, 150], 0.05 + t * 0.10);
      ctx.fill();
    }
  }

  function collect() {
    var cell = CELLS[current], out = [];
    for (var i = 0; i < cell.parts.length; i++) {
      var part = cell.parts[i];
      for (var j = 0; j < part.items.length; j++) {
        var item = part.items[j], sh;
        if (item.t === "e") { sh = ellipseOf(item); }
        else if (item.t === "c") { sh = capsuleOf(item); }
        else { sh = faceOf(item); }
        sh.item = item; sh.part = part;
        if (item.o.glass) {
          /* a shell needs a near half and a far half so the contents sort between */
          var span = item.t === "c" ? item.r : Math.max(
            Math.sqrt(dot(item.ax[0], item.ax[0])),
            Math.sqrt(dot(item.ax[1], item.ax[1])),
            Math.sqrt(dot(item.ax[2], item.ax[2])));
          var back = {}, front = {};
          for (var k in sh) { back[k] = sh[k]; front[k] = sh[k]; }
          back.z = sh.z - span; back.far = true;
          front.z = sh.z + span; front.far = false;
          out.push(back); out.push(front);
        } else {
          out.push(sh);
        }
      }
    }
    out.sort(function (a, b) { return a.z - b.z; });
    return out;
  }

  function labelChip(sh, part, sub) {
    var ax, ay;
    if (sh.kind === "e") { ax = sh.cx; ay = sh.cy; }
    else if (sh.kind === "c") { ax = (sh.ax + sh.bx) / 2; ay = (sh.ay + sh.by) / 2; }
    else { ax = sh.pts[0][0]; ay = sh.pts[0][1]; }

    var right = ax < W * 0.55;
    var lx = ax + (right ? 46 : -46), ly = ay - 34;
    ly = Math.max(20, Math.min(H - 30, ly));

    ctx.font = "700 12px 'Hack', 'IBM Plex Mono', monospace";
    var w1 = ctx.measureText(part.label).width;
    ctx.font = "11px 'Hack', 'IBM Plex Mono', monospace";
    var w2 = sub ? ctx.measureText(sub).width : 0;
    var w = Math.max(w1, w2) + 22, h = sub ? 38 : 24;
    var bx = right ? lx : lx - w;
    bx = Math.max(6, Math.min(W - w - 6, bx));

    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(right ? bx : bx + w, ly + h / 2);
    ctx.strokeStyle = rgba(part.color, 0.9);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath(); ctx.arc(ax, ay, 3.2, 0, 6.2832);
    ctx.fillStyle = rgba(lift(part.color, 0.2), 1); ctx.fill();

    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(bx, ly, w, h, 7); }
    else { ctx.rect(bx, ly, w, h); }
    ctx.fillStyle = rgba(theme.dark ? mix(theme.bg, [0, 0, 0], 0.25) : [255, 255, 255], 0.94);
    ctx.fill();
    ctx.strokeStyle = rgba(part.color, 0.85);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = rgba(theme.ink, 1);
    ctx.font = "700 12px 'Hack', 'IBM Plex Mono', monospace";
    ctx.textBaseline = "middle";
    ctx.fillText(part.label, bx + 11, ly + (sub ? 13 : 12));
    if (sub) {
      ctx.fillStyle = rgba(mix(theme.ink, theme.haze, 0.35), 1);
      ctx.font = "11px 'Hack', 'IBM Plex Mono', monospace";
      ctx.fillText(sub, bx + 11, ly + 27);
    }
  }

  function render() {
    if (!ctx) { return; }
    setCamera();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    backdrop();

    var list = collect(), i, sh;
    hits = [];
    for (i = 0; i < list.length; i++) {
      sh = list[i];
      var glow = sh.part.id === selected || sh.part.id === hovered;
      if (sh.kind === "e") { paintEllipse(sh, sh.item, glow); }
      else if (sh.kind === "c") { paintCapsule(sh, sh.item, glow); }
      else { paintFace(sh, sh.item, glow); }
      if (!sh.far) { hits.push(sh); }
    }
    hits.reverse();                        /* front first, so picking hits the top shape */

    /* one chip for the selection, one for whatever the pointer is over */
    var cell = CELLS[current];
    function biggest(id) {
      var best = null, area;
      for (var k = 0; k < list.length; k++) {
        if (list[k].part.id !== id || list[k].far) { continue; }
        area = list[k].kind === "e" ? list[k].ra * list[k].rb
          : list[k].kind === "c" ? list[k].r * list[k].r * 3 : 40;
        if (!best || area > best.a) { best = { s: list[k], a: area }; }
      }
      return best && best.s;
    }
    if (selected) {
      var s1 = biggest(selected);
      if (s1) { labelChip(s1, partById(selected), cell.name.toLowerCase()); }
    }
    if (hovered && hovered !== selected) {
      var s2 = biggest(hovered);
      if (s2) { labelChip(s2, partById(hovered), null); }
    }
  }

  function partById(id) {
    var p = CELLS[current].parts;
    for (var i = 0; i < p.length; i++) { if (p[i].id === id) { return p[i]; } }
    return null;
  }

  /* ---------- picking ---------- */

  function segDist(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    var t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  }

  function pick(x, y) {
    for (var i = 0; i < hits.length; i++) {
      var s = hits[i], o = s.item.o;
      var pad = o.glass ? 0 : 3;           /* small shapes stay easy to hit */
      if (s.kind === "e") {
        var c = Math.cos(-s.th), sn = Math.sin(-s.th);
        var dx = x - s.cx, dy = y - s.cy;
        var u = (dx * c - dy * sn) / (s.ra + pad), v = (dx * sn + dy * c) / (s.rb + pad);
        if (u * u + v * v <= 1) {
          /* a shell is only pickable near its rim, so the inside stays reachable */
          if (o.glass && u * u + v * v < 0.82) { continue; }
          return s.part.id;
        }
      } else if (s.kind === "c") {
        var d = segDist(x, y, s.ax, s.ay, s.bx, s.by);
        if (d <= s.r + pad) {
          if (o.glass && d < s.r * 0.86) { continue; }
          return s.part.id;
        }
      } else if (s.front) {
        var inside = false, n = s.pts.length;
        for (var a = 0, b = n - 1; a < n; b = a++) {
          var pa = s.pts[a], pb = s.pts[b];
          if ((pa[1] > y) !== (pb[1] > y) &&
            x < (pb[0] - pa[0]) * (y - pa[1]) / (pb[1] - pa[1]) + pa[0]) { inside = !inside; }
        }
        if (inside) { continue; }          /* wall panels never steal a click */
      }
    }
    return null;
  }

  /* ---------- selection ---------- */

  function select(id, turn) {
    var part = partById(id);
    if (!part) { return; }
    selected = id;
    var buttons = listEl.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle("on", buttons[i].getAttribute("data-id") === id);
      buttons[i].setAttribute("aria-pressed", buttons[i].getAttribute("data-id") === id ? "true" : "false");
    }
    readEl.innerHTML = "";
    var strong = document.createElement("strong");
    strong.textContent = part.label;
    var job = document.createElement("span");
    job.textContent = part.job;
    var where = document.createElement("span");
    where.textContent = "· " + CELLS[current].name.toLowerCase();
    readEl.appendChild(strong);
    readEl.appendChild(job);
    readEl.appendChild(where);
    if (turn) { faceTo(part.anchor); }
    dirty = true;
    start();
  }

  /* turn the model so the chosen part faces the viewer */
  function faceTo(a) {
    var yaw = Math.atan2(-a[0], a[2]);
    var flat = Math.hypot(a[0], a[2]);
    var pitch = Math.max(-1.1, Math.min(1.1, Math.atan2(a[1], flat || 0.001)));
    /* take the short way round */
    while (yaw - view.yaw > Math.PI) { yaw -= Math.PI * 2; }
    while (yaw - view.yaw < -Math.PI) { yaw += Math.PI * 2; }
    if (reduced) { view.yaw = yaw; view.pitch = pitch; return; }
    tween = { fy: view.yaw, fp: view.pitch, ty: yaw, tp: pitch, t: 0 };
  }

  /* ---------- loop ---------- */

  var last = 0;
  function frame(now) {
    running = false;
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;

    if (tween) {
      tween.t = Math.min(1, tween.t + dt * 2.4);
      var e = 1 - Math.pow(1 - tween.t, 3);
      view.yaw = tween.fy + (tween.ty - tween.fy) * e;
      view.pitch = tween.fp + (tween.tp - tween.fp) * e;
      if (tween.t >= 1) { tween = null; }
      dirty = true;
    } else if (view.spin && !reduced && visible) {
      view.yaw += dt * 0.28;
      dirty = true;
    }
    if (dirty) { dirty = false; render(); }
    if ((view.spin && !reduced && visible) || tween) { start(); }
  }
  function start() {
    if (running) { return; }
    running = true;
    requestAnimationFrame(frame);
  }

  /* ---------- sizing ---------- */

  function resize() {
    if (!canvas || !ctx) { return; }
    var r = viewport.getBoundingClientRect();
    var w = Math.max(220, Math.round(r.width));
    var h = Math.max(200, Math.round(r.height));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w === W && h === H && dpr === DPR) { return; }
    W = w; H = h; DPR = dpr;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    /* Setting the width wipes the canvas, so repaint now. Waiting for the next
       animation frame would leave the viewer blank in between. */
    dirty = false;
    render();
  }

  /* ---------- input ---------- */

  function localPoint(ev) {
    var r = canvas.getBoundingClientRect();
    return [ev.clientX - r.left, ev.clientY - r.top];
  }

  function bindPointer() {
    var drag = null, moved = 0;

    canvas.addEventListener("pointerdown", function (ev) {
      canvas.setPointerCapture(ev.pointerId);
      drag = { x: ev.clientX, y: ev.clientY };
      moved = 0;
      tween = null;
      canvas.classList.add("grabbing");
    });

    canvas.addEventListener("pointermove", function (ev) {
      if (drag) {
        var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
        moved += Math.abs(dx) + Math.abs(dy);
        view.yaw += dx * 0.009;
        view.pitch = Math.max(-1.35, Math.min(1.35, view.pitch + dy * 0.009));
        drag.x = ev.clientX; drag.y = ev.clientY;
        dirty = true; start();
        return;
      }
      var p = localPoint(ev), id = pick(p[0], p[1]);
      if (id !== hovered) {
        hovered = id;
        canvas.style.cursor = id ? "pointer" : "grab";
        dirty = true; start();
      }
    });

    function release(ev) {
      if (!drag) { return; }
      canvas.classList.remove("grabbing");
      var wasClick = moved < 6;
      drag = null;
      if (wasClick) {
        var p = localPoint(ev), id = pick(p[0], p[1]);
        if (id) { select(id, false); }
      }
    }
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("pointerleave", function () {
      if (hovered) { hovered = null; dirty = true; start(); }
    });

    /* The wheel only zooms once the canvas has focus, so scrolling past the
       page never gets trapped by the viewer. */
    canvas.addEventListener("wheel", function (ev) {
      if (document.activeElement !== canvas) { return; }
      ev.preventDefault();
      zoomBy(ev.deltaY > 0 ? 0.9 : 1.111);
    }, { passive: false });

    canvas.addEventListener("keydown", function (ev) {
      var step = 0.16, done = true;
      if (ev.key === "ArrowLeft") { view.yaw -= step; }
      else if (ev.key === "ArrowRight") { view.yaw += step; }
      else if (ev.key === "ArrowUp") { view.pitch = Math.max(-1.35, view.pitch - step); }
      else if (ev.key === "ArrowDown") { view.pitch = Math.min(1.35, view.pitch + step); }
      else if (ev.key === "+" || ev.key === "=") { zoomBy(1.15); }
      else if (ev.key === "-" || ev.key === "_") { zoomBy(1 / 1.15); }
      else { done = false; }
      if (done) { ev.preventDefault(); tween = null; dirty = true; start(); }
    });
  }

  function zoomBy(f) {
    view.zoom = Math.max(0.62, Math.min(2.6, view.zoom * f));
    dirty = true; start();
  }

  function setSpin(on) {
    view.spin = on;
    var b = document.getElementById("cx-spin");
    if (b) {
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    }
    start();
  }

  /* ---------- the list and the tabs ---------- */

  function buildList() {
    var cell = CELLS[current];
    listEl.innerHTML = "";
    cell.parts.forEach(function (part) {
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("data-id", part.id);
      b.setAttribute("aria-pressed", "false");
      var sw = document.createElement("span");
      sw.className = "sw";
      sw.style.background = rgba(part.color, 1);
      b.appendChild(sw);
      b.appendChild(document.createTextNode(part.label));
      b.addEventListener("click", function () { select(part.id, true); });
      b.addEventListener("mouseenter", function () { hovered = part.id; dirty = true; start(); });
      b.addEventListener("mouseleave", function () { hovered = null; dirty = true; start(); });
      b.addEventListener("focus", function () { hovered = part.id; dirty = true; start(); });
      b.addEventListener("blur", function () { hovered = null; dirty = true; start(); });
      li.appendChild(b);
      listEl.appendChild(li);
    });
  }

  /* A link can name a cell type, so cells.html#plant opens on the plant cell. */
  function fromHash() {
    var key = (location.hash || "").replace("#", "");
    return CELLS[key] ? key : null;
  }

  function showCell(key) {
    current = key;
    var cell = CELLS[key];
    canvas.setAttribute("aria-label",
      "Rotating three dimensional model of a " + cell.name.toLowerCase() + ". " + cell.note);
    var noteEl = document.getElementById("cx-note");
    if (noteEl) { noteEl.textContent = cell.note; }
    buildList();
    view.zoom = 1;
    selected = null;
    hovered = null;
    select(cell.parts[1] ? cell.parts[1].id : cell.parts[0].id, false);
  }

  /* ---------- init ---------- */

  function init() {
    viewport = document.getElementById("cx-viewport");
    canvas = document.getElementById("cx-canvas");
    listEl = document.getElementById("cx-list");
    readEl = document.getElementById("cx-read");
    hintEl = document.getElementById("cx-hint");
    if (!canvas || !canvas.getContext) { return; }
    ctx = canvas.getContext("2d");

    readTheme();
    document.addEventListener("fizzle:theme", readTheme);

    tabEls = document.querySelectorAll(".cx-tabs .fz-btn");
    function pickTab(key) {
      tabEls.forEach(function (x) {
        var on = x.getAttribute("data-cell") === key;
        x.classList.toggle("on", on);
        x.setAttribute("aria-pressed", on ? "true" : "false");
      });
      showCell(key);
      dirty = true; start();
    }
    tabEls.forEach(function (t) {
      t.setAttribute("aria-pressed", t.classList.contains("on") ? "true" : "false");
      t.addEventListener("click", function () { pickTab(t.getAttribute("data-cell")); });
    });
    window.addEventListener("hashchange", function () {
      var key = fromHash();
      if (key && key !== current) { pickTab(key); }
    });

    var spin = document.getElementById("cx-spin");
    if (spin) { spin.addEventListener("click", function () { setSpin(!view.spin); }); }
    var zin = document.getElementById("cx-in");
    if (zin) { zin.addEventListener("click", function () { zoomBy(1.2); }); }
    var zout = document.getElementById("cx-out");
    if (zout) { zout.addEventListener("click", function () { zoomBy(1 / 1.2); }); }
    var reset = document.getElementById("cx-reset");
    if (reset) {
      reset.addEventListener("click", function () {
        view.zoom = 1; tween = null;
        view.yaw = -0.62; view.pitch = -0.26;
        dirty = true; start();
      });
    }

    bindPointer();
    if (window.ResizeObserver) {
      new ResizeObserver(resize).observe(viewport);
    } else {
      window.addEventListener("resize", resize);
    }
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (e) {
        visible = e[0].isIntersecting;
        if (visible) { start(); }
      }).observe(viewport);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { dirty = true; start(); });
    }
    if (reduced) { setSpin(false); }
    if (hintEl && reduced) { hintEl.textContent = "Drag to turn · arrow keys also turn · click a part"; }

    resize();
    pickTab(fromHash() || "animal");
    /* paint once here rather than waiting for the first animation frame, so
       the cell is on screen the moment the page settles */
    dirty = false;
    render();
    start();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
