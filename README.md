# Interactive Periodic Table

A browser-based periodic table. Click any element for its data plus a rotating
3D model of its atom (nucleus + electron shells, built with Three.js).

## What's new since v1

Inspired by looking at other interactive periodic table apps (Zperiod, in
particular), on top of the original grid + 3D atom:

- **Subatomic particle cards** — protons / neutrons / electrons shown per element.
- **Common ions** — cation/anion chips (e.g. Fe²⁺, Fe³⁺) derived from real
  oxidation-state data.
- **Isotopes tab** — key isotopes with stability and natural abundance (or
  half-life for radioactive-only elements).
- **Uses tab** — a short real-world-use summary where data exists.
- **More properties** — ionization energy, electron affinity, atomic radius,
  specific heat, name origin, radioactivity flag.
- **Settings panel** — toggle temperature between °C / K / °F and mass
  between compact/full precision; saved in the browser via `localStorage`
  (fine here since this is a real page, not a sandboxed preview).
- **Atom viewer controls** — play/pause the electron animation, a speed
  slider, and a "reset view" button that returns the camera to its default
  framing.

## Running it


No install, no build step, no server needed.

1. Unzip the folder.
2. Double-click `index.html`. It opens in your default browser.

You do need an internet connection the first time each file loads, because
`index.html` pulls two things from the web: Three.js (for the 3D atom) and
two Google Fonts (Space Grotesk, IBM Plex Mono). Once your browser has
cached them, it'll work offline too.

## How it's built (and why, for a beginner)

- **`data.js`** — all 118 elements as one JS array (`const ELEMENTS = [...]`).
  Generated from the open-source `mendeleev` Python package: atomic number,
  mass, category, period, electron configuration, electrons-per-shell,
  electronegativity, density, melting/boiling point, discovery info, and a
  pre-computed grid position (row/col) for every element, including the
  lanthanide/actinide rows.

  It's a plain JS file (not a `.json` fetched with `fetch()`) on purpose:
  browsers block `fetch()` of local files when you open an HTML file
  directly (`file://`) instead of serving it from a server — a common
  gotcha. Loading it as a `<script>` sidesteps that entirely, so the page
  works with a plain double-click.

- **`app.js`** — builds the grid from `data.js`, wires up the search box and
  the category-legend filter, and opens/fills the detail modal on click.

- **`atom.js`** — the 3D scene. Loaded as an ES module (`type="module"`),
  which is why `index.html` has an `importmap` pointing `"three"` at a CDN
  build of Three.js — no npm install required. For each element it draws a
  nucleus sized by atomic number, one ring per electron shell (each tilted
  at a different angle so they don't overlap visually), and orbiting
  electrons matching that shell's real electron count. Drag to orbit,
  scroll to zoom (via Three.js's `OrbitControls`).

- **`style.css`** — dark, lab-at-night palette. The 10 element categories
  (alkali metal, noble gas, halogen, etc.) are the actual accent-color
  system — each tile's color, border, and the legend chips all come from
  the same set of CSS variables, so the color-coding *is* the theme rather
  than a decoration on top of one.

## Where to take it next

- **Isotopes**: `mendeleev` also has isotope data — add a toggle to show
  neutron count changing the nucleus.
- **Compare mode**: pick two elements, show both atom models side by side.
- **Trends**: a line chart of electronegativity or atomic radius across a
  period (Chart.js or a hand-rolled SVG would both work).
- **Quiz mode**: hide the symbol, show the atom model, ask the user to
  guess the element.
- **PWA**: add a manifest + service worker so it installs and works fully
  offline.
- **Deploy**: push this folder to a GitHub repo and turn on GitHub Pages —
  free hosting, and you get a real link for your resume/portfolio.
