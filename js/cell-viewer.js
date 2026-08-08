/* AI-ASSISTED: portions of this file were written with the help of an AI assistant (Claude), per course policy.
   cell-viewer.js — controls, list, readout, and the animation loop.

   Sizing note: the renderer measures offsetWidth/offsetHeight, which ignore CSS
   transforms, so the backing buffer stays correct inside a scaled or zoomed
   ancestor. Wheel zoom only engages once the canvas has focus or the pointer is
   over it, so the page never traps a scroll. */

(function (global) {
  "use strict";

  var R = global.CellRender, M = global.CellModels;

  /* "an animal cell", "a plant cell" */
  function article(name) {
    return /^[aeiou]/i.test(name) ? "an" : "a";
  }

  function CellViewer(opts) {
    this.el = opts;
    this.cells = M.build();
    this.order = ["animal", "plant", "bacteria"];
    this.current = "animal";
    this.selected = null;
    this.reduced = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.spin = !this.reduced;
    this.tween = null;
    this.dirty = true;
    this.running = false;
    this.visible = true;
    this.rend = new R.Renderer(opts.canvas);
    /* bind the frame callback BEFORE wiring observers: ResizeObserver fires
       synchronously on observe(), which can reach start() -> requestAnimationFrame */
    this.loop = this.loop.bind(this);
    this.furnish();
    this.bind();
    this.setCell(this.fromHash() || "animal");
    /* push the real spin value into the button: under prefers-reduced-motion the
       constructor starts with spin off, while the markup ships it pressed */
    this.setSpin(this.spin);
    this.rend.resize();
    this.frame(0);
    this.start();
  }

  /* Chamber furniture: a kind badge, a scale chip, and the hover tip. Built
     here rather than in the page so any host page gets them for free; they
     live in the DOM so the text stays crisp and uses the site fonts. */
  CellViewer.prototype.furnish = function () {
    var vp = this.el.viewport;
    if (!vp) { return; }
    function chip(cls) {
      var d = document.createElement("div");
      d.className = cls;
      vp.appendChild(d);
      return d;
    }
    this.kindEl = chip("cx-kind");
    this.scaleEl = chip("cx-scale");
    this.tipEl = chip("cx-tip");
    this.tipEl.hidden = true;
    /* hover-only duplicate of the legend row, so screen readers skip it */
    this.tipEl.setAttribute("aria-hidden", "true");
    this.tipSw = document.createElement("span");
    this.tipSw.className = "sw";
    this.tipNm = document.createElement("span");
    this.tipEl.appendChild(this.tipSw);
    this.tipEl.appendChild(this.tipNm);
  };

  /* place the hover tip beside the pointer, clamped inside the chamber */
  CellViewer.prototype.tip = function (ev, id) {
    var t = this.tipEl;
    if (!t) { return; }
    var part = id ? this.partById(id) : null;
    if (!part) { t.hidden = true; return; }
    this.tipSw.style.background = R.css(part.color);
    this.tipNm.textContent = part.label;
    t.hidden = false;
    var r = this.el.viewport.getBoundingClientRect();
    var x = ev.clientX - r.left + 15, y = ev.clientY - r.top + 14;
    x = Math.max(8, Math.min(x, r.width - t.offsetWidth - 8));
    y = Math.max(8, Math.min(y, r.height - t.offsetHeight - 8));
    t.style.left = x + "px";
    t.style.top = y + "px";
  };

  CellViewer.prototype.fromHash = function () {
    var k = (global.location.hash || "").replace("#", "");
    return this.cells[k] ? k : null;
  };

  CellViewer.prototype.model = function () { return this.cells[this.current]; };

  /* ---------- cell switching ---------- */
  CellViewer.prototype.setCell = function (key) {
    if (!this.cells[key]) { return; }
    this.current = key;
    var m = this.model();
    this.rend.setModel(m);
    this.selected = null;
    this.rend.selected = null;
    this.rend.hovered = null;
    if (this.el.tabs) {
      var t = this.el.tabs.querySelectorAll("[data-cell]");
      for (var i = 0; i < t.length; i++) {
        var on = t[i].getAttribute("data-cell") === key;
        t[i].classList.toggle("on", on);
        t[i].setAttribute("aria-pressed", on ? "true" : "false");
      }
    }
    if (this.el.canvas) {
      this.el.canvas.setAttribute("aria-label",
        "Rotating three-dimensional model of " + article(m.name) + " " + m.name.toLowerCase()
        + ". " + m.note);
    }
    /* optional: the page's one-line description of the current cell */
    if (this.el.note) { this.el.note.textContent = m.note; }
    if (this.kindEl) { this.kindEl.textContent = m.kind; }
    if (this.scaleEl) { this.scaleEl.textContent = m.scale || ""; }
    if (this.tipEl) { this.tipEl.hidden = true; }
    this.buildList();
    this.resetRead();
    this.dirty = true;
    this.start();
  };

  /* ---------- the parts legend ---------- */
  CellViewer.prototype.buildList = function () {
    var self = this, list = this.el.list;
    if (!list) { return; }
    list.innerHTML = "";
    this.model().parts.forEach(function (part) {
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("data-id", part.id);
      b.setAttribute("aria-pressed", "false");
      var sw = document.createElement("span");
      sw.className = "sw";
      sw.style.background = R.css(part.color);
      b.appendChild(sw);
      b.appendChild(document.createTextNode(part.label));
      b.addEventListener("click", function () { self.select(part.id, true); });
      b.addEventListener("mouseenter", function () { self.hover(part.id); });
      b.addEventListener("mouseleave", function () { self.hover(null); });
      b.addEventListener("focus", function () { self.hover(part.id); });
      b.addEventListener("blur", function () { self.hover(null); });
      li.appendChild(b);
      list.appendChild(li);
    });
    if (this.el.count) {
      this.el.count.textContent = this.model().parts.length + " parts";
    }
  };

  CellViewer.prototype.partById = function (id) {
    var p = this.model().parts;
    for (var i = 0; i < p.length; i++) { if (p[i].id === id) { return p[i]; } }
    return null;
  };

  CellViewer.prototype.hover = function (id) {
    if (this.rend.hovered === id) { return; }
    this.rend.hovered = id;
    this.dirty = true;
    this.start();
  };

  CellViewer.prototype.resetRead = function () {
    var read = this.el.read;
    if (!read) { return; }
    /* drop the accent set by a previous selection, or the neutral prompt keeps a
       border keyed to an organelle that is no longer selected */
    read.style.removeProperty("--pick");
    read.innerHTML = "";
    var s = document.createElement("strong");
    s.textContent = "Pick a part";
    var j = document.createElement("span");
    j.textContent = "Click any part of the model, or choose one from the list. The model turns to face what you pick.";
    var w = document.createElement("span");
    w.textContent = "\u00b7 " + this.model().kind.toLowerCase() + " \u00b7 nothing selected";
    read.appendChild(s); read.appendChild(j); read.appendChild(w);
  };

  CellViewer.prototype.select = function (id, turn) {
    var part = this.partById(id);
    if (!part) { return; }
    this.selected = id;
    this.rend.selected = id;
    if (this.el.list) {
      var bs = this.el.list.querySelectorAll("button");
      for (var i = 0; i < bs.length; i++) {
        var on = bs[i].getAttribute("data-id") === id;
        bs[i].classList.toggle("on", on);
        bs[i].setAttribute("aria-pressed", on ? "true" : "false");
      }
    }
    var read = this.el.read;
    if (read) {
      read.innerHTML = "";
      var s = document.createElement("strong");
      s.textContent = part.label;
      var j = document.createElement("span");
      j.textContent = part.job;
      var w = document.createElement("span");
      w.textContent = "\u00b7 " + this.model().name.toLowerCase();
      read.appendChild(s); read.appendChild(j); read.appendChild(w);
      read.style.setProperty("--pick", R.css(part.color));
    }
    /* face overrides anchor as the aim: surface features aim three-quarter on,
       so they stay visible instead of foreshortening dead-center */
    if (turn && part.anchor) { this.faceTo(part.face || part.anchor); }
    this.dirty = true;
    this.start();
  };

  /* turn the model so a chosen part faces the viewer */
  CellViewer.prototype.faceTo = function (a) {
    var yaw = Math.atan2(-a[0], a[2]);
    var flat = Math.sqrt(a[0] * a[0] + a[2] * a[2]);
    var pitch = Math.max(-1.05, Math.min(1.05, Math.atan2(a[1], flat || 0.001)));
    while (yaw - this.rend.yaw > Math.PI) { yaw -= Math.PI * 2; }
    while (yaw - this.rend.yaw < -Math.PI) { yaw += Math.PI * 2; }
    if (this.reduced) { this.rend.yaw = yaw; this.rend.pitch = pitch; return; }
    this.tween = { fy: this.rend.yaw, fp: this.rend.pitch, ty: yaw, tp: pitch, t: 0 };
  };

  CellViewer.prototype.zoomBy = function (f) {
    this.rend.zoom = Math.max(0.62, Math.min(2.6, this.rend.zoom * f));
    this.dirty = true;
    this.start();
  };

  /* ---------- input ---------- */
  CellViewer.prototype.local = function (ev) {
    var r = this.el.canvas.getBoundingClientRect();
    /* map through the element's own scale so picking stays true inside a
       transformed ancestor */
    var sx = r.width ? this.rend.W / r.width : 1;
    var sy = r.height ? this.rend.H / r.height : 1;
    return [(ev.clientX - r.left) * sx, (ev.clientY - r.top) * sy];
  };

  CellViewer.prototype.bind = function () {
    var self = this, cv = this.el.canvas, drag = null, moved = 0, over = false;

    cv.addEventListener("pointerdown", function (e) {
      cv.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY };
      moved = 0;
      cv.classList.add("grabbing");
      self.spinPaused = true;
      if (self.tipEl) { self.tipEl.hidden = true; }
    });
    cv.addEventListener("pointermove", function (e) {
      if (drag) {
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        drag.x = e.clientX; drag.y = e.clientY;
        moved += Math.abs(dx) + Math.abs(dy);
        self.tween = null;
        self.rend.yaw -= dx * 0.0092;
        self.rend.pitch = Math.max(-1.28, Math.min(1.28, self.rend.pitch - dy * 0.0092));
        self.dirty = true;
        self.start();
        return;
      }
      var p = self.local(e);
      self.hover(self.rend.pick(p[0], p[1]));
      /* the tip follows the pointer, so it repositions on every move even
         when the hovered part has not changed */
      self.tip(e, self.rend.hovered);
      cv.style.cursor = self.rend.hovered ? "pointer" : "grab";
    });
    cv.addEventListener("pointerup", function (e) {
      var wasDrag = moved > 5;
      if (drag) { cv.releasePointerCapture(e.pointerId); }
      drag = null;
      cv.classList.remove("grabbing");
      self.spinPaused = false;
      if (!wasDrag) {
        var p = self.local(e);
        var id = self.rend.pick(p[0], p[1]);
        if (id) { self.select(id, false); }
      }
    });
    cv.addEventListener("pointerleave", function () {
      self.hover(null);
      if (self.tipEl) { self.tipEl.hidden = true; }
      cv.style.cursor = "grab";
    });
    cv.addEventListener("mouseenter", function () { over = true; });
    cv.addEventListener("mouseleave", function () { over = false; });

    /* the wheel only zooms once the canvas is focused or hovered, so the page
       keeps its own scroll */
    cv.addEventListener("wheel", function (e) {
      if (!over && document.activeElement !== cv) { return; }
      e.preventDefault();
      self.zoomBy(e.deltaY < 0 ? 1.09 : 1 / 1.09);
    }, { passive: false });

    cv.addEventListener("keydown", function (e) {
      var k = e.key, step = 0.16;
      if (k === "ArrowLeft") { self.rend.yaw -= step; }
      else if (k === "ArrowRight") { self.rend.yaw += step; }
      else if (k === "ArrowUp") { self.rend.pitch = Math.max(-1.28, self.rend.pitch - step); }
      else if (k === "ArrowDown") { self.rend.pitch = Math.min(1.28, self.rend.pitch + step); }
      else if (k === "+" || k === "=") { self.zoomBy(1.14); }
      else if (k === "-" || k === "_") { self.zoomBy(1 / 1.14); }
      else { return; }
      e.preventDefault();
      self.tween = null;
      self.dirty = true;
      self.start();
    });

    if (this.el.tabs) {
      this.el.tabs.addEventListener("click", function (e) {
        var b = e.target.closest("[data-cell]");
        if (b) { self.setCell(b.getAttribute("data-cell")); }
      });
    }
    function hook(el, fn) { if (el) { el.addEventListener("click", fn); } }
    hook(this.el.spin, function () { self.setSpin(!self.spin); });
    hook(this.el.zin, function () { self.zoomBy(1.2); });
    hook(this.el.zout, function () { self.zoomBy(1 / 1.2); });
    hook(this.el.reset, function () {
      self.tween = null;
      self.rend.yaw = -0.62; self.rend.pitch = -0.24; self.rend.zoom = 1;
      self.dirty = true; self.start();
    });

    if (global.ResizeObserver) {
      new ResizeObserver(function () {
        if (self.rend.resize()) { self.dirty = true; self.start(); }
      }).observe(this.el.viewport);
    } else {
      global.addEventListener("resize", function () {
        if (self.rend.resize()) { self.dirty = true; self.start(); }
      });
    }
    if (global.IntersectionObserver) {
      new IntersectionObserver(function (en) {
        self.visible = en[0].isIntersecting;
        if (self.visible) { self.dirty = true; self.start(); }
      }).observe(this.el.viewport);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { self.dirty = true; self.start(); });
    }
    global.addEventListener("hashchange", function () {
      var k = self.fromHash();
      if (k) { self.setCell(k); }
    });
  };

  CellViewer.prototype.setSpin = function (on) {
    this.spin = on;
    if (this.el.spin) {
      this.el.spin.classList.toggle("on", on);
      this.el.spin.setAttribute("aria-pressed", on ? "true" : "false");
    }
    this.start();
  };

  /* ---------- loop ----------
     Visibility gates the idle SPIN only. A pending dirty render always runs, so
     an offscreen-then-onscreen flip (or a spurious IntersectionObserver miss)
     can never leave the canvas showing a stale cell. */
  CellViewer.prototype.start = function () {
    if (this.running) { return; }
    this.running = true;
    global.requestAnimationFrame(this.loop);
  };

  CellViewer.prototype.loop = function (now) {
    this.running = false;
    this.frame(now);
    var busy = this.tween || (this.spin && !this.spinPaused && this.visible);
    if (busy || this.dirty) { this.start(); }
  };

  CellViewer.prototype.frame = function (now) {
    var dt = Math.min(0.05, (now - (this.last || now)) / 1000 || 0.016);
    this.last = now;
    if (this.tween) {
      this.tween.t = Math.min(1, this.tween.t + dt * 2.5);
      var e = 1 - Math.pow(1 - this.tween.t, 3);
      this.rend.yaw = this.tween.fy + (this.tween.ty - this.tween.fy) * e;
      this.rend.pitch = this.tween.fp + (this.tween.tp - this.tween.fp) * e;
      if (this.tween.t >= 1) { this.tween = null; }
      this.dirty = true;
    } else if (this.spin && !this.spinPaused && this.visible) {
      this.rend.yaw += dt * 0.19;
      this.dirty = true;
    }
    if (this.dirty) {
      this.dirty = false;
      this.rend.render();
    }
  };

  global.CellViewer = {
    mount: function (ids) {
      function g(id) { return document.getElementById(id); }
      var el = {
        viewport: g(ids.viewport), canvas: g(ids.canvas), list: g(ids.list),
        read: g(ids.read), count: g(ids.count), spin: g(ids.spin),
        zin: g(ids.zin), zout: g(ids.zout), reset: g(ids.reset),
        tabs: g(ids.tabs), note: g(ids.note)
      };
      if (!el.canvas || !el.canvas.getContext) { return null; }
      return new CellViewer(el);
    }
  };
})(window);
