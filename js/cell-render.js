/* AI-ASSISTED: portions of this file were written with the help of an AI assistant (Claude), per course policy.
   cell-render.js — the drawing engine for the Cell Explorer.

   A small 3D painter on a plain 2D canvas. No library. What it fixes over the
   first pass:

   - Ellipsoids and discs get their TRUE projected outline. A rotated ellipsoid
     silhouettes as an ellipse; that ellipse is recovered exactly from the 2x2
     covariance of its projected semi-axes, so lens shapes and tilted discs stop
     wobbling between frames.
   - Every part may carry a `hull`. Its interior detail is clipped to that hull,
     so cristae never leak out of a mitochondrion.
   - The cell envelope clips every organelle, so nothing pokes through the
     membrane at any angle.
   - The camera fits the model's bounding sphere, so no part can ever cross the
     viewport edge no matter how it is turned.
   - Sizing reads offsetWidth/offsetHeight, which ignore CSS transforms, so the
     canvas stays sharp even inside a scaled design canvas.

   Shapes a model may emit:
     {k:'ball',  p, r}
     {k:'ellip', p, r:[a,b,c], rot:[yaw,pitch,roll]}
     {k:'disc',  p, r, rot}                     flat plate, one axis collapsed
     {k:'tube',  pts:[...], r}
     {k:'ring',  p, r, w, rot}
   Style keys: color, alpha, shell, spec, flat, rim, haze. */

(function (global) {
  "use strict";

  /* ---------- colour ---------- */
  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  /* positive lifts toward a warm white, negative sinks toward a cool black:
     tinting the extremes rather than using pure white/black keeps the shading
     from looking chalky */
  function lift(c, t) {
    return t >= 0 ? mix(c, [255, 251, 244], t) : mix(c, [8, 9, 18], -t);
  }
  function css(c, a) {
    var r = c[0] | 0, g = c[1] | 0, b = c[2] | 0;
    return a === undefined || a >= 1 ? "rgb(" + r + "," + g + "," + b + ")"
      : "rgba(" + r + "," + g + "," + b + "," + (a < 0 ? 0 : a).toFixed(3) + ")";
  }

  /* ---------- vectors ---------- */
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function scl(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function len(a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); }
  function norm(a) { var l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

  /* euler -> 3 basis vectors, used to orient ellipsoids, discs and rings */
  function basis(rot) {
    var y = rot ? rot[0] || 0 : 0, p = rot ? rot[1] || 0 : 0, r = rot ? rot[2] || 0 : 0;
    var cy = Math.cos(y), sy = Math.sin(y), cp = Math.cos(p), sp = Math.sin(p),
      cr = Math.cos(r), sr = Math.sin(r);
    return [
      [cy * cr + sy * sp * sr, cp * sr, -sy * cr + cy * sp * sr],
      [-cy * sr + sy * sp * cr, cp * cr, sy * sr + cy * sp * cr],
      [sy * cp, -sp, cy * cp]
    ];
  }

  /* symmetric 2x2 eigen decomposition: turns the projected covariance of an
     ellipsoid's semi-axes into (semi-major, semi-minor, angle) */
  function eigen2(a, b, c) {
    var tr = a + c, det = a * c - b * b;
    var d = Math.sqrt(Math.max(0, tr * tr / 4 - det));
    var l1 = tr / 2 + d, l2 = Math.max(0, tr / 2 - d);
    var th;
    if (Math.abs(b) > 1e-9) { th = Math.atan2(b, l1 - c); }
    else { th = a >= c ? 0 : Math.PI / 2; }
    return [Math.sqrt(Math.max(0, l1)), Math.sqrt(l2), th];
  }

  var LIGHT = norm([-0.44, 0.68, 0.58]);

  function Renderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.W = 0; this.H = 0; this.DPR = 1;
    this.cam = 5.6;
    this.yaw = -0.62; this.pitch = -0.24; this.zoom = 1;
    this.bg = [17, 17, 27];
    this.haze = [12, 12, 22];
    this.model = null;
    this.hits = [];
    this.selected = null;
    this.hovered = null;
  }

  Renderer.prototype.setTheme = function (bg, haze) {
    this.bg = bg; this.haze = haze;
  };

  /* offsetWidth/offsetHeight are transform independent, so a scaled ancestor
     (a design canvas, a zoomed page) can't shrink the backing buffer */
  Renderer.prototype.resize = function () {
    var host = this.canvas.parentNode || this.canvas;
    /* clientWidth/Height are the padding box, so a border on the chamber does
       not push the buffer oversize; both ignore CSS transforms */
    var w = Math.max(240, host.clientWidth || host.offsetWidth || 0);
    var h = Math.max(200, host.clientHeight || host.offsetHeight || 0);
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    if (w === this.W && h === this.H && dpr === this.DPR) { return false; }
    this.W = w; this.H = h; this.DPR = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    return true;
  };

  Renderer.prototype.setModel = function (model) {
    this.model = model;
    this.selected = null;
    this.hovered = null;
    /* Bounding sphere about the origin. Interior shapes are CLIPPED to the
       envelope, so they can never widen the silhouette and must not drive the
       fit; only the envelope and anything explicitly outside it count. */
    var R = 0.001;
    function reach(s) {
      var e = 0;
      if (s.k === "ball") { e = len(s.p) + s.r; }
      else if (s.k === "ellip" || s.k === "disc") { e = len(s.p) + Math.max(s.r[0], s.r[1], s.r[2]); }
      else if (s.k === "ring") { e = len(s.p) + s.r + s.w; }
      else if (s.k === "tube") {
        for (var q = 0; q < s.pts.length; q++) { e = Math.max(e, len(s.pts[q]) + s.r); }
      }
      return e;
    }
    if (model.envelope) { R = Math.max(R, reach(model.envelope)); }
    model.parts.forEach(function (part) {
      (part.outer || []).forEach(function (s) { R = Math.max(R, reach(s)); });
    });
    this.R = R;
  };

  /* rotate world -> view */
  Renderer.prototype.rot = function (p) {
    var cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    var cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    var x = p[0] * cy - p[2] * sy;
    var z = p[0] * sy + p[2] * cy;
    var y = p[1] * cp - z * sp;
    z = p[1] * sp + z * cp;
    return [x, y, z];
  };

  /* perspective project view-space -> screen */
  Renderer.prototype.proj = function (v) {
    var s = this.cam / (this.cam - v[2]);
    return [this.cx + v[0] * s * this.k, this.cy - v[1] * s * this.k, s];
  };

  /* scale so the bounding sphere always fits, then apply user zoom */
  Renderer.prototype.fit = function () {
    this.cx = this.W / 2;
    this.cy = this.H / 2;
    var half = Math.min(this.W, this.H) / 2;
    var worst = this.R * (this.cam / (this.cam - this.R));
    this.k = ((half - 10) / worst) * this.zoom * (this.model.fit || 1);
  };

  /* ---------- shading ---------- */

  /* Draws one shaded convex blob in a local space where it is a unit circle.
     `t` is the depth term (0 near, 1 far) and drives the haze mix. */
  Renderer.prototype.blob = function (cx, cy, ra, rb, th, col, st, t, nz) {
    var ctx = this.ctx;
    var base = mix(col, this.haze, (st.haze === undefined ? 0.34 : st.haze) * t);
    var alpha = st.alpha === undefined ? 1 : st.alpha;
    if (ra < 0.25 || rb < 0.25) { return; }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(th);
    ctx.scale(1, Math.max(0.02, rb / ra));

    var lx = LIGHT[0], ly = -LIGHT[1];
    if (st.flat) {
      ctx.fillStyle = css(lift(base, 0.06), alpha);
      ctx.beginPath(); ctx.arc(0, 0, ra, 0, 6.2832); ctx.fill();
    } else if (st.plate) {
      /* A flat plate. Its surface normal barely varies across the face, so the
         ball gradient is simply wrong here: it makes a disc seen face-on read as
         a sphere. Shade it almost flat, with a soft directional wash and a
         defined edge. The light vector is counter-rotated out of the shape's own
         frame so the wash stays lit from one direction on screen. */
      var cth = Math.cos(th), sth = Math.sin(th);
      var gx = (lx * cth + ly * sth) * ra, gy = (-lx * sth + ly * cth) * ra;
      var pg = ctx.createLinearGradient(gx, gy, -gx, -gy);
      pg.addColorStop(0, css(lift(base, 0.26), alpha));
      pg.addColorStop(0.5, css(lift(base, 0.02), alpha));
      pg.addColorStop(1, css(lift(base, -0.2), alpha));
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(0, 0, ra, 0, 6.2832); ctx.fill();
      ctx.lineWidth = Math.max(0.5, ra * 0.05);
      ctx.strokeStyle = css(lift(base, -0.36), alpha * 0.85);
      ctx.beginPath(); ctx.arc(0, 0, ra * 0.98, 0, 6.2832); ctx.stroke();
    } else if (st.shell) {
      /* A translucent enclosing shell. The middle stays nearly clear so the
         organelles behind it keep their colour; opacity is concentrated in the
         last few percent of the radius, which is all the eye needs to read a
         surface. */
      var sg = ctx.createRadialGradient(0, 0, ra * 0.42, 0, 0, ra);
      sg.addColorStop(0, css(base, alpha * 0.015));
      sg.addColorStop(0.74, css(lift(base, 0.04), alpha * 0.1));
      sg.addColorStop(0.9, css(lift(base, 0.16), alpha * 0.34));
      sg.addColorStop(0.975, css(lift(base, 0.36), alpha * 0.8));
      sg.addColorStop(1, css(lift(base, 0.1), alpha * 0.3));
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(0, 0, ra, 0, 6.2832); ctx.fill();
    } else {
      var g = ctx.createRadialGradient(lx * ra * 0.46, ly * ra * 0.46, ra * 0.04, 0, 0, ra * 1.02);
      g.addColorStop(0, css(lift(base, 0.44 * (nz === undefined ? 1 : nz)), alpha));
      g.addColorStop(0.42, css(lift(base, 0.08), alpha));
      g.addColorStop(0.8, css(lift(base, -0.2), alpha));
      g.addColorStop(1, css(lift(base, -0.42), alpha));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, ra, 0, 6.2832); ctx.fill();
      /* rim light opposite the key, which separates dark organelles from the
         dark chamber behind them */
      if (st.rim !== 0 && ra > 3) {
        var r2 = ctx.createRadialGradient(0, 0, ra * 0.78, 0, 0, ra);
        r2.addColorStop(0, "rgba(0,0,0,0)");
        r2.addColorStop(1, css(lift(base, 0.5), alpha * 0.5));
        ctx.fillStyle = r2;
        ctx.beginPath(); ctx.arc(0, 0, ra, 0, 6.2832); ctx.fill();
      }
      if (st.spec && ra > 4) {
        var s2 = ctx.createRadialGradient(lx * ra * 0.5, ly * ra * 0.5, 0, lx * ra * 0.5, ly * ra * 0.5, ra * 0.42);
        s2.addColorStop(0, "rgba(255,255,255," + (0.5 * st.spec * alpha).toFixed(3) + ")");
        s2.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = s2;
        ctx.beginPath(); ctx.arc(0, 0, ra, 0, 6.2832); ctx.fill();
      }
    }
    ctx.restore();
  };

  /* project one shape into a screen record: ellipse or thick polyline */
  Renderer.prototype.place = function (s) {
    var v, sc, e, i;
    if (s.k === "ball") {
      v = this.rot(s.p); sc = this.proj(v);
      var r = s.r * sc[2] * this.k;
      return { t: "e", z: v[2], cx: sc[0], cy: sc[1], ra: r, rb: r, th: 0, s: s };
    }
    if (s.k === "ellip" || s.k === "disc") {
      v = this.rot(s.p); sc = this.proj(v);
      var B = basis(s.rot);
      /* project each semi-axis, accumulate covariance, decompose */
      var a11 = 0, a12 = 0, a22 = 0;
      for (i = 0; i < 3; i++) {
        var ax = this.rot(scl(B[i], s.r[i]));
        var px = ax[0] * sc[2] * this.k, py = -ax[1] * sc[2] * this.k;
        a11 += px * px; a12 += px * py; a22 += py * py;
      }
      e = eigen2(a11, a12, a22);
      return { t: "e", z: v[2], cx: sc[0], cy: sc[1], ra: e[0], rb: e[1], th: e[2], s: s };
    }
    if (s.k === "ring") {
      v = this.rot(s.p); sc = this.proj(v);
      var Br = basis(s.rot), c11 = 0, c12 = 0, c22 = 0;
      for (i = 0; i < 2; i++) {
        var rx = this.rot(scl(Br[i], s.r));
        var qx = rx[0] * sc[2] * this.k, qy = -rx[1] * sc[2] * this.k;
        c11 += qx * qx; c12 += qx * qy; c22 += qy * qy;
      }
      var er = eigen2(c11, c12, c22);
      return { t: "r", z: v[2], cx: sc[0], cy: sc[1], ra: er[0], rb: er[1], th: er[2],
        w: Math.max(1, s.w * sc[2] * this.k), s: s };
    }
    /* tube */
    var pts = [], zs = 0;
    for (i = 0; i < s.pts.length; i++) {
      var vv = this.rot(s.pts[i]);
      var pp = this.proj(vv);
      pts.push([pp[0], pp[1]]);
      zs += vv[2];
    }
    var mid = this.rot(s.pts[(s.pts.length / 2) | 0]);
    var ms = this.cam / (this.cam - mid[2]);
    return { t: "t", z: zs / s.pts.length, pts: pts, w: Math.max(1, s.r * 2 * ms * this.k), s: s };
  };

  Renderer.prototype.drawRec = function (rec, col, st, t) {
    var ctx = this.ctx;
    if (rec.t === "e") {
      this.blob(rec.cx, rec.cy, rec.ra, rec.rb, rec.th, col, st, t);
    } else if (rec.t === "r") {
      var base = mix(col, this.haze, 0.5 * t);
      ctx.save();
      ctx.translate(rec.cx, rec.cy); ctx.rotate(rec.th);
      ctx.scale(1, Math.max(0.02, rec.rb / rec.ra));
      ctx.lineWidth = rec.w;
      ctx.strokeStyle = css(lift(base, 0.1), st.alpha === undefined ? 1 : st.alpha);
      ctx.beginPath(); ctx.arc(0, 0, rec.ra, 0, 6.2832); ctx.stroke();
      ctx.restore();
    } else {
      var b2 = mix(col, this.haze, 0.5 * t);
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      /* a dark under-stroke then a lit core reads as a rounded tube rather
         than a flat ribbon */
      ctx.lineWidth = rec.w;
      ctx.strokeStyle = css(lift(b2, -0.3), st.alpha === undefined ? 1 : st.alpha);
      this.path(rec.pts); ctx.stroke();
      ctx.lineWidth = Math.max(0.6, rec.w * 0.52);
      ctx.strokeStyle = css(lift(b2, 0.26), st.alpha === undefined ? 1 : st.alpha);
      this.path(rec.pts); ctx.stroke();
    }
  };

  Renderer.prototype.path = function (pts) {
    var ctx = this.ctx, i;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    /* centripetal-ish smoothing: midpoint quadratics keep threads from kinking */
    for (i = 1; i < pts.length - 1; i++) {
      var mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  };

  Renderer.prototype.ellipsePath = function (rec, grow) {
    var ctx = this.ctx;
    ctx.beginPath();
    ctx.ellipse(rec.cx, rec.cy, Math.max(0.5, rec.ra + (grow || 0)),
      Math.max(0.5, rec.rb + (grow || 0)), rec.th, 0, 6.2832);
  };

  /* depth term: 0 at the near pole, 1 at the far pole */
  Renderer.prototype.depth = function (z) {
    var t = 0.5 - z / (2 * this.R);
    return t < 0 ? 0 : t > 1 ? 1 : t;
  };

  Renderer.prototype.render = function () {
    var ctx = this.ctx, i, j;
    if (!this.model || !this.W) { return; }
    this.fit();
    ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);

    /* chamber floor: a soft contact shadow grounds the cell */
    var gy = this.cy + this.R * this.k * 0.92;
    var sh = ctx.createRadialGradient(this.cx, gy, 0, this.cx, gy, this.R * this.k * 1.15);
    sh.addColorStop(0, "rgba(0,0,0,0.34)");
    sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.translate(0, 0); ctx.fillStyle = sh;
    ctx.beginPath(); ctx.ellipse(this.cx, gy, this.R * this.k * 1.1, this.R * this.k * 0.2, 0, 0, 6.2832);
    ctx.fill(); ctx.restore();

    var model = this.model;
    var env = model.envelope ? this.place(model.envelope) : null;

    /* Shapes that legitimately live OUTSIDE the envelope (a flagellum, pili,
       plasmodesmata, a sugar coat). Split by depth so a tail behind the cell
       draws behind it and one in front draws over it. */
    var outer = [], oi;
    for (i = 0; i < model.parts.length; i++) {
      var op = model.parts[i].outer || [];
      for (j = 0; j < op.length; j++) {
        outer.push({ part: model.parts[i], rec: this.place(op[j]) });
      }
    }
    outer.sort(function (a, b) { return a.rec.z - b.rec.z; });
    for (oi = 0; oi < outer.length; oi++) {
      if (outer[oi].rec.z >= 0) { break; }
      var ob = outer[oi], obst = ob.rec.s.st || {};
      this.drawRec(ob.rec, obst.color || ob.part.color, obst, this.depth(ob.rec.z));
    }

    /* collect one drawable per part-group, keyed on depth */
    var items = [];
    for (i = 0; i < model.parts.length; i++) {
      var part = model.parts[i];
      /* a part may own several closed bodies (two mitochondria, three
         chloroplasts); each clips its own interior */
      var bodies = part.bodies || (part.hull ? [{ hull: part.hull, inner: part.inner }] : []);
      for (var bi = 0; bi < bodies.length; bi++) {
        var hr = this.place(bodies[bi].hull);
        items.push({ z: hr.z, part: part, hull: hr, inner: bodies[bi].inner || [] });
      }
      var loose = part.shapes || [];
      for (j = 0; j < loose.length; j++) {
        var rr = this.place(loose[j]);
        items.push({ z: rr.z, part: part, rec: rr });
      }
    }
    items.sort(function (a, b) { return a.z - b.z; });

    this.hits = [];
    /* record the behind-cell outer shapes for picking */
    for (var ob2 = 0; ob2 < oi; ob2++) { this.record(outer[ob2].rec, outer[ob2].part); }

    /* everything inside the cell is clipped to the envelope silhouette, so no
       organelle can cross the membrane */
    ctx.save();
    if (env) {
      var envClip = this.envPath(env, -0.75);
      ctx.clip(envClip);
      /* Cytoplasm. Drawn behind the organelles and inside the envelope clip, so
         the cell reads as a filled volume instead of a hollow ring. Kept dark
         and desaturated so the organelle colours stay the loudest thing. */
      if (model.cyto) {
        var cg = ctx.createRadialGradient(env.cx - (env.ra || 40) * 0.3,
          env.cy - (env.rb || 40) * 0.4, (env.ra || 40) * 0.08,
          env.cx, env.cy, (env.ra || 40) * 1.06);
        cg.addColorStop(0, css(lift(model.cyto, 0.16)));
        cg.addColorStop(0.6, css(model.cyto));
        cg.addColorStop(1, css(lift(model.cyto, -0.4)));
        ctx.fillStyle = cg;
        ctx.fill(envClip);
      }
    }

    for (i = 0; i < items.length; i++) {
      var it = items[i];
      var t = this.depth(it.z);
      var st = it.rec ? (it.rec.s.st || {}) : (it.hull.s.st || {});
      var col = st.color || it.part.color;
      if (it.rec) {
        this.drawRec(it.rec, col, st, t);
        this.record(it.rec, it.part);
      } else {
        this.drawRec(it.hull, col, st, t);
        this.record(it.hull, it.part);
        if (it.inner.length && it.hull.t === "e") {
          ctx.save();
          this.ellipsePath(it.hull, -0.75);
          ctx.clip();
          var inner = [];
          for (j = 0; j < it.inner.length; j++) { inner.push(this.place(it.inner[j])); }
          inner.sort(function (a, b) { return a.z - b.z; });
          for (j = 0; j < inner.length; j++) {
            var ist = inner[j].s.st || {};
            this.drawRec(inner[j], ist.color || col, ist, this.depth(inner[j].z));
          }
          ctx.restore();
          /* re-lay the hull's rim over its own interior so the silhouette reads */
          if (!st.flat) {
            ctx.save();
            this.ellipsePath(it.hull, 0);
            ctx.clip();
            this.blob(it.hull.cx, it.hull.cy, it.hull.ra, it.hull.rb, it.hull.th, col,
              { shell: 1, alpha: 0.5, haze: st.haze }, t);
            ctx.restore();
          }
        }
      }
      /* hover and selection glow, drawn tight to the shape */
      var hi = this.selected === it.part.id ? 1 : this.hovered === it.part.id ? 0.55 : 0;
      if (hi) { this.glow(it.rec || it.hull, hi); }
    }
    ctx.restore();

    /* the envelope itself, over the top, translucent */
    if (env) {
      var est = model.envelope.st || {};
      var ecol = est.color || [180, 190, 210];
      this.drawRec(env, ecol, { shell: 1, alpha: est.alpha === undefined ? 0.9 : est.alpha }, 0.1);
      this.record(env, model.envelopePart || model.parts[0]);
      var ehi = this.selected === (model.envelopePart && model.envelopePart.id) ? 1
        : this.hovered === (model.envelopePart && model.envelopePart.id) ? 0.55 : 0;
      if (ehi) { this.glow(env, ehi); }
    }

    /* outer shapes in front of the cell */
    for (; oi < outer.length; oi++) {
      var of2 = outer[oi], ofst = of2.rec.s.st || {};
      this.drawRec(of2.rec, ofst.color || of2.part.color, ofst, this.depth(of2.rec.z));
      this.record(of2.rec, of2.part);
      var ohi = this.selected === of2.part.id ? 1 : this.hovered === of2.part.id ? 0.55 : 0;
      if (ohi) { this.glow(of2.rec, ohi); }
    }
  };

  /* A clip region for the cell envelope. An ellipse is direct; a capsule is the
     union of a circle at each spine point plus a quad between consecutive pairs,
     which clips identically to a round-capped stroke. */
  Renderer.prototype.envPath = function (rec, grow) {
    var p = new Path2D(), i;
    if (rec.t !== "t") {
      p.ellipse(rec.cx, rec.cy, Math.max(0.5, rec.ra + grow), Math.max(0.5, rec.rb + grow),
        rec.th, 0, 6.2832);
      return p;
    }
    var r = Math.max(1, rec.w / 2 + grow);
    for (i = 0; i < rec.pts.length; i++) {
      p.moveTo(rec.pts[i][0] + r, rec.pts[i][1]);
      p.arc(rec.pts[i][0], rec.pts[i][1], r, 0, 6.2832);
    }
    for (i = 0; i < rec.pts.length - 1; i++) {
      var a = rec.pts[i], b = rec.pts[i + 1];
      var dx = b[0] - a[0], dy = b[1] - a[1];
      var L = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / L * r, ny = dx / L * r;
      p.moveTo(a[0] + nx, a[1] + ny);
      p.lineTo(b[0] + nx, b[1] + ny);
      p.lineTo(b[0] - nx, b[1] - ny);
      p.lineTo(a[0] - nx, a[1] - ny);
      p.closePath();
    }
    return p;
  };

  Renderer.prototype.glow = function (rec, a) {
    var ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255," + (0.5 * a).toFixed(3) + ")";
    ctx.lineWidth = 1.6;
    if (rec.t === "t") {
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.lineWidth = rec.w + 2.4;
      ctx.strokeStyle = "rgba(255,255,255," + (0.28 * a).toFixed(3) + ")";
      this.path(rec.pts); ctx.stroke();
    } else {
      this.ellipsePath(rec, 1.4); ctx.stroke();
    }
    ctx.restore();
  };

  Renderer.prototype.record = function (rec, part) {
    if (!part) { return; }
    this.hits.push({ rec: rec, part: part });
  };

  function segDist(x, y, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var L = dx * dx + dy * dy;
    var t = L ? ((x - a[0]) * dx + (y - a[1]) * dy) / L : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var px = a[0] + dx * t - x, py = a[1] + dy * t - y;
    return Math.sqrt(px * px + py * py);
  }

  /* front-to-back pick. `hits` is filled in draw order, so walk it backwards. */
  Renderer.prototype.pick = function (x, y) {
    for (var i = this.hits.length - 1; i >= 0; i--) {
      var h = this.hits[i], rec = h.rec, st = (rec.s && rec.s.st) || {};
      if (rec.t === "t") {
        for (var j = 0; j < rec.pts.length - 1; j++) {
          if (segDist(x, y, rec.pts[j], rec.pts[j + 1]) <= rec.w / 2 + 3) { return h.part.id; }
        }
      } else {
        var dx = x - rec.cx, dy = y - rec.cy;
        var c = Math.cos(-rec.th), s = Math.sin(-rec.th);
        var u = (dx * c - dy * s) / Math.max(1, rec.ra + 3);
        var v = (dx * s + dy * c) / Math.max(1, rec.rb + 3);
        var d2 = u * u + v * v;
        if (d2 <= 1) {
          /* Concentric translucent shells: each claims only a thin outer band so
             whatever sits inside stays reachable. The envelope's band is the
             thinnest, otherwise it would cover the membrane shell just inside it. */
          if (st.env && d2 < 0.93) { continue; }
          if (st.shell && d2 < 0.76) { continue; }
          if (rec.t === "r" && d2 < 0.5) { continue; }
          return h.part.id;
        }
      }
    }
    return null;
  };

  global.CellRender = {
    Renderer: Renderer,
    mix: mix, lift: lift, css: css,
    add: add, scl: scl, norm: norm, len: len,
    /* exported so the models lay interiors out along the SAME axes the renderer
       projects them by. Two definitions of this drift, and interiors then shear
       against their own hull as the cell turns. */
    basis: basis
  };
})(window);
