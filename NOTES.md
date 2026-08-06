# Working notes

Scratch notes for work in progress. Not part of the site itself.

## Done in the design pass, 2026-08-05

### Cell Explorer, rebuilt in 3D

`js/cells.js` is now a small 3D viewer painted on a 2D canvas. No library.
The file carries its own vector math, projects each shape, sorts back to
front, and shades with gradients. Three primitives cover everything:
ellipsoid, capsule, and flat panel.

- Drag turns the model. The wheel zooms, but only once the canvas has focus,
  so page scrolling is never trapped. Arrow keys turn, plus and minus zoom.
- Hover highlights a part, clicking selects it. The list beside the canvas
  does the same job and turns the model to face the part it picked.
- Every part in all three cells is reachable by clicking, not only from the
  list. Verified with a script, see "Testing" below.
- `cells.html#plant` and `#bacteria` open on that cell type.
- Organelle colors are fixed rather than themed, so a mitochondrion stays
  orange in both themes and the color itself carries meaning.

### Contrast, measured and fixed

Every text and background pair was measured, not eyeballed. Three separate
faults, all now clearing WCAG AA at 4.5 to 1:

1. **Tile ink.** Tile colors are mixed in JavaScript rather than left to CSS
   `color-mix`, because the file needs the finished color anyway to pick ink
   that passes against it.

2. **The dead band.** Picking the better of two inks is not enough. Between
   roughly 16% and 22% background luminance, both the dark ink and the light
   ink land under 4.5 to 1, so the middle of every dark-theme ramp measured
   about 4.1. `tint()` in `js/periodic.js` now pushes such a tile further
   along the ramp it already sits on until an ink clears. Only tiles inside
   that narrow band move, and they move the way the scale was already
   heading, so the order still reads low to high. Measured worst case went
   from 4.08 to 4.50.

3. **Accents used as words.** The display accents are picked to look right
   as fills and fail as text. On white, yellow measured 2.62 and pink 2.64,
   which is what made the trend label above the table hard to read. The same
   fault hit the subject headings on the hub, the subject chips, the ready
   pills, and the ticker highlight. `--chem-text`, `--bio-text`,
   `--phys-text` and `--ticker-em` are the text-safe variants: same hue,
   darkened (or lightened in dark theme) until they clear 4.5 to 1 on the
   page, on a card, and on their own soft fill. Use them for words and the
   display accents for fills, borders and swatches.

Also added to the table: atomic numbers on every tile, a color scale bar
with real min and max values, and `periodic.html#density` style deep links.

The measuring script is not in the repo. It lives in the session scratchpad
and replicates the Oklab math from `js/periodic.js`, then sweeps 101 steps
of all five numeric ramps in both themes.

### Rocket Lab, one instrument

The page used to read as four separate things. Now it runs top to bottom:
engine, vehicle and trajectory side by side, then one delta-v meter that
answers the whole page, then the verdict, then the readout.

- The engine is a row of buttons, not a slider. A slider for a categorical
  choice was the least intuitive control on the site.
- The meter is banded at 9,400 (orbit) and 12,690 (escape). Both numbers
  come from the same constants the physics uses, so the bar and the verdict
  can never disagree.
- The equation shows your own numbers going into it and the answer coming
  out.
- `rocket.html#dry=4&fuel=180&eng=2` shares a design.

### Shared demo furniture

`.fz-ctl`, `.fz-ctlrow`, `.fz-ctllab`, `.fz-pills`, `.fz-ctlnote` and
`.fz-panelhead` in `fizzle.css` are the common control cluster and panel
heading. All five demos use them, so the stages read as one family.

### Peppered Moths chart

The generation chart drew one bar stretched across the full width, which
looked broken. It now keeps a slot per generation of the scripted run, so
generation 1 is one twelfth of the chart and the rest fills in.

### Footer badges, wired back in

`images/badge-1.svg` to `badge-4.svg` are now a third footer column on all
eleven pages. Every claim on them is true for this site.

## Testing

Screenshots and the DOM harness live outside the repo, in the session
scratchpad. Two node scripts drove the cell viewer against a stubbed DOM:
one checks that every number reaching the canvas is finite and on screen
across cell switches, drags, zoom limits, keyboard control and 400 spin
frames; the other sweeps the pointer over the canvas at twelve rotations
and confirms all 11 animal, 9 plant and 8 bacterial parts can be clicked.

## Still open

- **About photos are placeholders.** `images/about-photo-1.svg` and
  `-2.svg` say so themselves. They need real photos.
- **Source citations.** `reference.html` names sources but gives few direct
  URLs. Nuclide data, star distances, and the moth history need real
  citations.
- **AI attribution.** Every file carries the required comment. The About
  page statement is broad. Naming which sections were AI-assisted would be
  stronger.
- **The visitor counter stays gone.** It read a localStorage integer and
  added a fixed offset so the number looked plausible. It counted one
  browser's page loads, not visitors. If it ever returns it must say it is
  a local count, or be plain decoration that claims nothing.
- **Decay chains** run to six named steps for U-238. The original spec said
  three or four. The longer chain teaches better; decide which wins.
- **Moth catches** are 5 per generation. The original spec said about 8.

## Ideas parked for later

- Periodic Trends: an orbital or electron-shell visualizer. The block view
  covers part of the same ground for far less work.
- Nuclide Decay: the full chart of roughly 3,300 known nuclides. Needs a
  real dataset. The curated nuclide set covers the teaching goal.
- The hero illustrations are flat SVGs from before the 3D work. On
  `cells.html` the contrast with the viewer below it is noticeable.
