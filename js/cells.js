/* AI-ASSISTED: portions of this file were written with the help of an AI assistant (Claude), per course policy.
   js/cells.js — bootstrap for the Cell Explorer.

   The drawing engine now lives in three files that load before this one:

     js/cell-render.js   the painter        -> window.CellRender
     js/cell-models.js   the three cells    -> window.CellModels
     js/cell-viewer.js   controls + loop    -> window.CellViewer

   This file is only the mount point. It keeps the name cells.html already
   references, so the page needs three added <script> tags and nothing removed.

   Every id below is optional except viewport and canvas. A missing element is
   skipped, so the same bootstrap works on a page that has no note line, no part
   count, or no cell tabs. */

(function () {
  "use strict";

  function boot() {
    if (!window.CellViewer) { return; }
    window.cellViewer = window.CellViewer.mount({
      viewport: "cx-viewport",
      canvas: "cx-canvas",
      tabs: "cx-tabs",
      list: "cx-list",
      read: "cx-read",
      note: "cx-note",
      count: "cx-count",
      spin: "cx-spin",
      zin: "cx-in",
      zout: "cx-out",
      reset: "cx-reset"
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
