# Working notes

Scratch notes for work in progress. Not part of the site itself.

## Cell Explorer needs a rework

`cells.html` and `js/cells.js` are the least finished part of the site and
are deliberately left alone for now.

What needs attention:

- The SVG diagrams are rough. Organelle shapes are approximate rather than
  anatomically careful, and the three cell types do not share a visual
  system the way the rest of the site does.
- The stage layout wastes space. The diagram and the organelle list sit
  side by side without a clear hierarchy.
- Hovering an organelle changes the readout, which competes with clicking.
  Pick one interaction and commit to it.
- The prose is fine and can stay.

Everything else on the site is finished and verified.

## Ideas parked for later

- Periodic Trends: an orbital or electron-shell visualizer. Out of scope
  before the deadline. The block view added on 2026-08-04 covers part of
  the same ground for far less work.
- Nuclide Decay: the full chart of roughly 3,300 known nuclides. Needs a
  real dataset, which is not worth sourcing before the deadline. The
  curated nuclide set covers the teaching goal.

## Visual pass, all five experiments

Flagged 2026-08-04. The demos work and each is internally consistent, but
they were built one at a time and do not share a visual system beyond the
page shell. Worth one coordinated pass rather than five separate ones.

What to look at:

- Stage interiors have no common rhythm. Spacing, panel headings, and the
  gap between a control cluster and its output differ per demo.
- Control clusters are laid out ad hoc. Sliders, pill buttons, and preset
  rows each solve the same problem differently.
- The readout strip is consistent, which is the one thing that works. Use
  it as the reference for everything else.
- Rocket Lab has the most going on: rocket diagram, orbit panel, sliders,
  bar, verdict. It reads as four things rather than one instrument.

## Footer badges, parked

`images/badge-1.svg` through `badge-4.svg` are still in the repo but nothing
references them. The 88x31 badge strip and the visitor counter came out of
the footer on 2026-08-05, to be revisited in the design pass. Delete the
files or wire them back in then.

## The visitor counter was never real

Worth knowing before it comes back. The counter read and incremented a
localStorage integer and added a fixed offset so the number looked
plausible. It counted one visitor's own page loads in one browser, not
visitors. A real count needs a server, and this site deliberately has none.
If it returns, it should be honest about being a personal visit count, or
be a static piece of decoration that does not claim to be a measurement.
