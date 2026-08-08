# fizzle.

A tiny science playground. Six interactive demos in chemistry, biology,
and physics, live at [fizzle.zainham.com](https://fizzle.zainham.com).

Built as the final project for Comm 360 (Website Development) at the
University of Louisville, Summer 2026. Now it just lives here.

## Experiments

| # | Experiment | Subject | What you do |
|---|-----------|---------|-------------|
| 01 | [Periodic Trends](https://fizzle.zainham.com/periodic.html) | chemistry | Color all 118 elements by radius, electronegativity, or ionization energy |
| 02 | [Cell Explorer](https://fizzle.zainham.com/cells.html) | biology | Turn animal, plant, and bacterial cells in 3D and click the parts |
| 03 | [Rocket Lab: Δv](https://fizzle.zainham.com/rocket.html) | physics | Feed the Tsiolkovsky equation and see if your design reaches orbit |
| 04 | [Nuclide Decay](https://fizzle.zainham.com/decay.html) | chemistry | Watch 400 atoms walk their decay chains against real half-lives |
| 05 | [Peppered Moths](https://fizzle.zainham.com/moths.html) | biology | Play predator and shift a population across twelve generations |
| 06 | [Starship Clock](https://fizzle.zainham.com/starship.html) | physics | Compare ship time and Earth time for relativistic trips |

## Design

- Plain HTML, one external stylesheet, one small script per demo.
- No framework, no bundler, no build step, no CDN. The site works offline.
- Fonts and icons are stored in the repo, not fetched.
- Two themes (Catppuccin Latte and Mocha) with a toggle in the header.
- The guestbook writes to localStorage. There is no backend on purpose.

## Local development

There is nothing to install. Open `index.html` in a browser, or serve
the folder with any static file server. The 404 page uses absolute
paths for GitHub Pages and only renders correctly behind a server.

## Hosting

GitHub Pages serves the `main` branch root. `CNAME` pins the custom
domain and `.nojekyll` skips the Jekyll build.

## AI assistance

An AI assistant (Claude) helped write parts of this site, including
HTML structure, CSS, JavaScript, and drafts of the prose. Each file
carries a comment at the top saying so. Design direction, choice of
experiments, and final editing are mine. The
[about page](https://fizzle.zainham.com/about.html) has the full note.

## Licensing

- Code (HTML, CSS, JavaScript): [MIT](LICENSE).
- Prose and photographs: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- [Twemoji](https://github.com/twitter/twemoji) icons: CC BY 4.0,
  copyright Twitter/X and contributors.
- Fonts: [Sora](https://fonts.google.com/specimen/Sora) and
  [Karla](https://fonts.google.com/specimen/Karla) under the
  [SIL Open Font License](https://openfontlicense.org/), and
  [Hack](https://github.com/source-foundry/Hack) under its
  MIT-style license with Bitstream Vera terms.
- Element data comes from [PubChem](https://pubchem.ncbi.nlm.nih.gov/);
  rocket figures come from public [NASA](https://www.nasa.gov/)
  documentation. Facts and public-domain data carry no license.
