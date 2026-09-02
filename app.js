// app.js — grid rendering, search/filter, settings, and the detail modal
// Relies on ELEMENTS (from data.js) and window.AtomViewer (from atom.js)

const CATEGORY_COLORS = {
  "alkali-metal": "#f2545b",
  "alkaline-earth-metal": "#f2913d",
  "transition-metal": "#f2c14e",
  "post-transition-metal": "#8fcb6b",
  "metalloid": "#4fcdba",
  "reactive-nonmetal": "#4ea1f2",
  "halogen": "#6c7ff2",
  "noble-gas": "#b57ef2",
  "lanthanide": "#f26fa8",
  "actinide": "#d6336c",
  "unknown": "#5c6478",
};

const CATEGORY_ORDER = [
  "alkali-metal", "alkaline-earth-metal", "transition-metal", "post-transition-metal",
  "metalloid", "reactive-nonmetal", "halogen", "noble-gas", "lanthanide", "actinide",
];

const SUP_DIGITS = { "0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹" };

const ELEMENTS_BY_NUM = {};
ELEMENTS.forEach((e) => (ELEMENTS_BY_NUM[e.number] = e));

let activeCategory = null;
let searchTerm = "";
let currentElement = null;

// ---------- Settings (persisted locally in the browser only) ----------

function loadSettings() {
  const defaults = { tempUnit: "C", massPrecision: "compact" };
  try {
    const raw = localStorage.getItem("periodicTableSettings");
    if (raw) return Object.assign(defaults, JSON.parse(raw));
  } catch (e) { /* localStorage unavailable — fall back to defaults */ }
  return defaults;
}

function saveSettings() {
  try {
    localStorage.setItem("periodicTableSettings", JSON.stringify(settings));
  } catch (e) { /* ignore — settings just won't persist */ }
}

let settings = loadSettings();

// ---------- Formatting helpers ----------

function formatMass(el) {
  if (el.mass == null) return "—";
  if (el.massIsEstimate) return `(${Math.round(el.mass)})`;
  return settings.massPrecision === "full" ? String(el.mass) : el.mass.toFixed(2);
}

function formatTemp(k) {
  if (k == null) return null;
  if (settings.tempUnit === "K") return `${k.toFixed(1)} K`;
  if (settings.tempUnit === "F") return `${(k * 9 / 5 - 459.67).toFixed(1)} °F`;
  return `${(k - 273.15).toFixed(1)} °C`;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toSuperscript(n) {
  return String(n).split("").map((c) => SUP_DIGITS[c] || c).join("");
}

function ionLabel(state) {
  const mag = Math.abs(state);
  const magStr = mag === 1 ? "" : toSuperscript(mag);
  return `${magStr}${state > 0 ? "⁺" : "⁻"}`;
}

// ---------- Grid ----------

function buildGrid() {
  const grid = document.getElementById("periodic-grid");
  grid.innerHTML = "";

  ELEMENTS.forEach((el) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = `element-tile cat-${el.category}`;
    if (el.row === 8) tile.classList.add("lanthanide-row-start");
    tile.style.gridRow = el.row;
    tile.style.gridColumn = el.col;
    tile.dataset.number = el.number;
    tile.setAttribute("aria-label", `${el.name}, atomic number ${el.number}`);
    tile.innerHTML = `
      <span class="tile-number">${el.number}</span>
      <span class="tile-symbol">${el.symbol}</span>
      <span class="tile-mass">${formatMass(el)}</span>
    `;
    tile.addEventListener("click", () => openModal(el));
    grid.appendChild(tile);
  });

  addPlaceholder(grid, 6, 3, "57–71");
  addPlaceholder(grid, 7, 3, "89–103");
}

function addPlaceholder(grid, row, col, label) {
  const div = document.createElement("div");
  div.className = "tile-placeholder";
  div.style.gridRow = row;
  div.style.gridColumn = col;
  div.textContent = label;
  grid.appendChild(div);
}

function updateTileMasses() {
  document.querySelectorAll(".element-tile").forEach((tile) => {
    const el = ELEMENTS_BY_NUM[tile.dataset.number];
    const span = tile.querySelector(".tile-mass");
    if (span) span.textContent = formatMass(el);
  });
}

// ---------- Legend / filter ----------

function buildLegend() {
  const legend = document.getElementById("legend");
  legend.innerHTML = "";

  CATEGORY_ORDER.forEach((cat) => {
    const sample = ELEMENTS.find((e) => e.category === cat);
    if (!sample) return;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "legend-chip";
    chip.style.setProperty("--chip-color", CATEGORY_COLORS[cat]);
    chip.dataset.category = cat;
    chip.innerHTML = `<span class="legend-swatch"></span>${sample.categoryLabel}`;
    chip.addEventListener("click", () => toggleCategoryFilter(cat));
    legend.appendChild(chip);
  });
}

function toggleCategoryFilter(cat) {
  activeCategory = activeCategory === cat ? null : cat;
  document.querySelectorAll(".legend-chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.category === activeCategory);
  });
  applyFilters();
}

function applyFilters() {
  const term = searchTerm.trim().toLowerCase();
  document.querySelectorAll(".element-tile").forEach((tile) => {
    const el = ELEMENTS_BY_NUM[tile.dataset.number];
    let visible = true;
    if (activeCategory && el.category !== activeCategory) visible = false;
    if (term) {
      const matches =
        el.name.toLowerCase().includes(term) ||
        el.symbol.toLowerCase() === term ||
        String(el.number) === term;
      if (!matches) visible = false;
    }
    tile.classList.toggle("dimmed", !visible);
  });
}

// ---------- Modal: particles / ions / stats / isotopes / uses ----------

const backdrop = document.getElementById("modal-backdrop");

function renderParticleRow(el) {
  document.getElementById("particle-row").innerHTML = `
    <div class="particle-card"><span class="particle-value">${el.protons}</span><span class="particle-label">p⁺ protons</span></div>
    <div class="particle-card"><span class="particle-value">${el.neutrons}</span><span class="particle-label">n⁰ neutrons</span></div>
    <div class="particle-card"><span class="particle-value">${el.protons}</span><span class="particle-label">e⁻ electrons</span></div>
  `;
}

function renderIonRow(el) {
  const row = document.getElementById("ion-row");
  if (!el.oxidationStates || !el.oxidationStates.length) {
    row.innerHTML = '<p class="ion-empty">No common ionic forms recorded.</p>';
    return;
  }
  row.innerHTML = el.oxidationStates
    .slice()
    .sort((a, b) => b - a)
    .map((s) => {
      const kind = s > 0 ? "cation" : "anion";
      return `<span class="ion-chip">${el.symbol}${ionLabel(s)}<small>${kind}</small></span>`;
    })
    .join("");
}

function statsRows(el) {
  const rows = [
    ["Category", el.categoryLabel],
    ["Period / block", `${el.period} · ${el.block}-block`],
    ["Phase at room temp", capitalize(el.phase)],
    ["Electron configuration", el.econf],
    ["Electrons per shell", el.shells.join(", ")],
  ];
  if (el.electronegativity != null) rows.push(["Electronegativity (Pauling)", el.electronegativity.toFixed(2)]);
  if (el.ionizationEnergyKJ != null) rows.push(["1st ionization energy", `${el.ionizationEnergyKJ} kJ/mol`]);
  if (el.electronAffinityKJ != null) rows.push(["Electron affinity", `${el.electronAffinityKJ} kJ/mol`]);
  if (el.atomicRadiusPm != null) rows.push(["Atomic radius (empirical)", `${el.atomicRadiusPm} pm`]);
  if (el.density != null) rows.push(["Density", `${el.density} g/cm³`]);
  if (el.specificHeat != null) rows.push(["Specific heat", `${el.specificHeat} J/(g·K)`]);
  if (el.meltingPointK != null) rows.push(["Melting point", formatTemp(el.meltingPointK)]);
  if (el.boilingPointK != null) rows.push(["Boiling point", formatTemp(el.boilingPointK)]);
  if (el.isRadioactive) rows.push(["Radioactive", "Yes"]);
  if (el.nameOrigin) rows.push(["Name origin", el.nameOrigin]);
  if (el.discoveredBy) rows.push(["Discovered by", el.discoveredBy]);
  if (el.discoveryYear != null) rows.push(["Discovery year", el.discoveryYear]);
  return rows;
}

function renderStats(el) {
  document.getElementById("modal-stats").innerHTML = statsRows(el)
    .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
    .join("");
}

function renderIsotopes(el) {
  const container = document.getElementById("isotope-list");
  if (!el.isotopes || !el.isotopes.length) {
    container.innerHTML = '<p class="isotope-empty">No isotope data available.</p>';
    return;
  }
  container.innerHTML = el.isotopes
    .map((iso) => {
      const stability = iso.stable
        ? '<span class="iso-tag stable">Stable</span>'
        : `<span class="iso-tag radioactive">Radioactive${iso.halfLife ? " · t½ " + iso.halfLife : ""}</span>`;
      const abundance = iso.abundance != null ? `<span class="iso-abundance">${iso.abundance}% natural abundance</span>` : "";
      return `<div class="isotope-row"><span class="iso-name">${el.symbol}-${iso.massNumber}</span>${stability}${abundance}</div>`;
    })
    .join("");
}

function renderUses(el) {
  const p = document.getElementById("uses-text");
  const tabBtn = document.querySelector('.modal-tab[data-tab="uses"]');
  if (el.uses) {
    p.textContent = el.uses;
    tabBtn.classList.remove("tab-disabled");
  } else {
    p.textContent = "No summarized use-case data available for this element yet.";
    tabBtn.classList.add("tab-disabled");
  }
}

function buildSummary(el) {
  const parts = [];
  parts.push(
    `${el.name} (${el.symbol}) is a ${el.categoryLabel.toLowerCase()} with atomic number ${el.number}, in period ${el.period} of the table.`
  );
  parts.push(
    el.phase === "unknown"
      ? "Its phase at room temperature has not been confirmed experimentally — it's only ever been made in tiny, short-lived quantities."
      : `At room temperature it exists as a ${el.phase}.`
  );
  if (el.discoveryYear != null) {
    parts.push(`It was first identified in ${el.discoveryYear}${el.discoveredBy ? " by " + el.discoveredBy : ""}.`);
  } else if (el.discoveredBy) {
    parts.push(el.discoveredBy);
  }
  return parts.join(" ");
}

function resetToPropertiesTab() {
  document.querySelectorAll(".modal-tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === "properties"));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("hidden", p.id !== "tab-properties"));
}

function initTabs() {
  document.querySelectorAll(".modal-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".modal-tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
      document.getElementById(`tab-${btn.dataset.tab}`).classList.remove("hidden");
    });
  });
}

function openModal(el) {
  currentElement = el;

  document.getElementById("modal-number").textContent = el.number;
  document.getElementById("modal-symbol").textContent = el.symbol;
  document.getElementById("modal-mass").textContent = formatMass(el);
  document.getElementById("modal-name").textContent = el.name;

  const categoryEl = document.getElementById("modal-category");
  categoryEl.textContent = el.categoryLabel;
  categoryEl.style.setProperty("--tile-accent", CATEGORY_COLORS[el.category]);

  document.getElementById("modal-tile").className = `modal-tile cat-${el.category}`;
  document.getElementById("modal-summary").textContent = buildSummary(el);

  renderParticleRow(el);
  renderIonRow(el);
  renderStats(el);
  renderIsotopes(el);
  renderUses(el);
  resetToPropertiesTab();

  document.getElementById("atom-play-pause").textContent = "⏸";
  document.getElementById("atom-play-pause").setAttribute("aria-label", "Pause animation");
  document.getElementById("atom-speed").value = 1;

  backdrop.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  const host = document.getElementById("atom-viewer");
  window.AtomViewer.render(host, el, CATEGORY_COLORS[el.category]);
}

function closeModal() {
  backdrop.classList.add("hidden");
  document.body.style.overflow = "";
  window.AtomViewer.dispose();
  currentElement = null;
}

document.getElementById("modal-close").addEventListener("click", closeModal);
backdrop.addEventListener("click", (e) => {
  if (e.target === backdrop) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !backdrop.classList.contains("hidden")) closeModal();
});

document.getElementById("search-input").addEventListener("input", (e) => {
  searchTerm = e.target.value;
  applyFilters();
});

// ---------- Atom viewer controls ----------

document.getElementById("atom-play-pause").addEventListener("click", () => {
  const playing = window.AtomViewer.toggleAnimation();
  const btn = document.getElementById("atom-play-pause");
  btn.textContent = playing ? "⏸" : "▶";
  btn.setAttribute("aria-label", playing ? "Pause animation" : "Play animation");
});

document.getElementById("atom-speed").addEventListener("input", (e) => {
  window.AtomViewer.setSpeed(parseFloat(e.target.value));
});

document.getElementById("atom-reset-view").addEventListener("click", () => {
  window.AtomViewer.resetView();
});

// ---------- Settings panel ----------

function initSettingsUI() {
  document.querySelector(`input[name="temp-unit"][value="${settings.tempUnit}"]`).checked = true;
  document.querySelector(`input[name="mass-precision"][value="${settings.massPrecision}"]`).checked = true;

  const toggleBtn = document.getElementById("settings-toggle");
  const panel = document.getElementById("settings-panel");

  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const willShow = panel.classList.contains("hidden");
    panel.classList.toggle("hidden");
    toggleBtn.setAttribute("aria-expanded", String(willShow));
  });

  document.addEventListener("click", (e) => {
    if (!document.querySelector(".settings-wrap").contains(e.target)) {
      panel.classList.add("hidden");
      toggleBtn.setAttribute("aria-expanded", "false");
    }
  });

  document.querySelectorAll('input[name="temp-unit"]').forEach((r) => {
    r.addEventListener("change", (e) => {
      settings.tempUnit = e.target.value;
      saveSettings();
      if (currentElement) renderStats(currentElement);
    });
  });

  document.querySelectorAll('input[name="mass-precision"]').forEach((r) => {
    r.addEventListener("change", (e) => {
      settings.massPrecision = e.target.value;
      saveSettings();
      updateTileMasses();
      if (currentElement) document.getElementById("modal-mass").textContent = formatMass(currentElement);
    });
  });
}

// ---------- Init ----------

buildGrid();
buildLegend();
initTabs();
initSettingsUI();
