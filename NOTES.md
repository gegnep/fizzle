# Working notes

Scratch notes for work in progress. Not part of the site itself.

## Done in the design pass, 2026-08-05

### Cell Explorer, rebuilt in 3D

The viewer is a small 3D painter on a plain 2D canvas. No library. It carries
its own vector math, projects each shape, sorts back to front, and shades with
gradients.

- Drag turns the model. The wheel zooms, but only once the canvas has focus,
  so page scrolling is never trapped. Arrow keys turn, plus and minus zoom.
- Hover highlights a part, clicking selects it. The list beside the canvas
  does the same job and turns the model to face the part it picked.
- Every part in all three cells is reachable by clicking, not only from the
  list. Verified with a script, see "Testing" below.
- `cells.html#plant` and `#bacteria` open on that cell type.
- Organelle colors are fixed rather than themed, so a mitochondrion stays
  orange in both themes and the color itself carries meaning.

### Cell Explorer, the render engine, 2026-08-06

The drawing engine is now three files plus a mount point. Each layer points
one way only.

- `js/cell-render.js` draws shapes and knows no biology.
- `js/cell-models.js` holds the three cells as data and knows no canvas.
- `js/cell-viewer.js` wires both to the DOM: controls, legend, readout, loop.
- `js/cells.js` is a 40 line mount call. It keeps the name because
  `cells.html` loads it and the stage bar prints it as a caption.

Five primitives cover every organelle: ball, ellipsoid, disc, tube, and ring.
A part holds its shapes in buckets, and the bucket decides the clipping.
`hull` plus `inner` clips the interior to its own organelle, so cristae stay
inside a mitochondrion and grana inside a chloroplast. `outer` skips the
envelope clip, so a flagellum can sit outside the cell.

Four faults are now fixed by construction:

1. Organelle interiors stay inside their organelle.
2. Organelles stay inside the cell membrane.
3. The camera scale comes from the model's bounding sphere, so nothing
   crosses the frame edge and the cell never changes size as it spins.
4. Sizing reads `offsetWidth`, which ignores CSS transforms, so the canvas
   buffer stays correct inside a scaled ancestor.

**Maintenance trap.** `basis()` maps a yaw, pitch and roll triple to three
world axes. It is defined once, in `cell-render.js`, and exported. Anything in
`cell-models.js` that lays sub-shapes along a parent axis must call it. Two
copies of an axis convention drift, and interiors then shear against their own
hull as the cell turns. That reads fine head-on and wrong in motion.

The chamber is now pinned dark in both themes. The shading is built against a
dark backdrop and a white stage flattens the depth cue.
`Renderer.setTheme(bg, haze)` exists if a themed chamber is ever wanted; the
cytoplasm fills are dark only today.

The bacterium draws smaller than the other two cells. Its flagellum widens the
bounding sphere, and the fit is deliberately conservative so the model holds
one size through a turn. Shifting the model `-0.275` in x recovered most of
the loss. If the tail length changes, recompute the shift as
`-(max_x + min_x) / 2` over all geometry.

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

`images/badge-1.svg` to `badge-4.svg` were a third footer column on all
eleven pages. Every claim on them is true for this site.

**Removed again, 2026-08-06.** The footer is now two columns on every page.
The four SVG files stay in `images/` and nothing references them. Delete them
if the badges are not coming back.

## Testing

Screenshots and the DOM harness live outside the repo, in the session
scratchpad. One node script mounts the viewer against a stubbed DOM and runs
155 checks:

- The canvas buffer matches client size times device pixel ratio, on mount
  and after a resize.
- Each cell rebuilds the legend, the part count, the note line, the canvas
  `aria-label`, and the pressed tab.
- Every part of every cell selects from the list, fills the readout, and
  leaves the camera finite.
- All 11 animal, 9 plant and 8 bacterial parts can be clicked on the canvas.
  The script sweeps a pixel grid at twelve rotations per cell.
- Zoom, spin, reset, tabs, arrow keys, drag, and the pitch and zoom clamps.
- The wheel stays inert until the canvas is hovered or focused.
- Idle with spin off schedules no further frames.
- 72 rotations per cell: every painted point stays inside the frame, every
  number is finite, and the camera scale holds constant through the turn.

The harness tracks the canvas transform matrix. Without it every shape reads
as off screen, because the renderer draws at the origin under a translate.

The contact shadow is the one shape that leaves the frame. It is a fading
gradient under the cell, drawn wider and lower on purpose, and the canvas
clips it. The harness skips it by name.

Containment is not covered. Clipping happens inside `ctx.clip`, which a stub
cannot evaluate. Check cristae and grana by eye through a full turn.

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
