// The paper playground. It opens on what tokens.css has, shows the page stock with
// one card square on it, and lets every paper color and number be changed live,
// in light and dark. Save CSS downloads look.css (lines for the app's tokens.css);
// Save look.json downloads the look, to open again here.

// ---------------------------------------------------------------------------
// The look: what the tool dials in, and how it reads tokens.css and writes CSS.

const MODES = ["light", "dark"];

// The ramps and steps a paper color can take, as tokens.css names them
// (--paper-100, --blue-900, …). A swatch is "paper-100", or "black" / "white".
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const RAMP_NAMES = ["paper", "red", "orange", "yellow", "green", "blue", "violet", "pink"];

// The colors the paper is made of. Picking a step on the paper ramp follows the
// hue and tint knobs; another ramp keeps its own color.
const ROLES = [
  { token: "--color-bg", label: "Page stock" },
  { token: "--color-surface", label: "Card stock" },
  { token: "--color-surface-muted", label: "Muted stock" },
  { token: "--paper-speck", label: "Grain and mottle" },
  { token: "--paper-shine", label: "Sheen" },
];

// The number tokens the tool has a knob for, with tested bounds.
const KNOBS = [
  { token: "--paper-gloss", label: "Gloss", hint: "sheen across the sheet", min: 0, max: 0.3, step: 0.01, unit: "" },
  { token: "--paper-grain", label: "Grain", hint: "fine tooth", min: 0, max: 0.3, step: 0.01, unit: "" },
  { token: "--paper-grain-size", label: "Grain size", hint: "px per tile", min: 64, max: 512, step: 16, unit: "px" },
  { token: "--paper-mottle", label: "Mottle", hint: "slow unevenness", min: 0, max: 0.3, step: 0.01, unit: "" },
  { token: "--paper-mottle-size", label: "Mottle size", hint: "px per tile", min: 200, max: 1400, step: 20, unit: "px" },
];

const wrap = (h) => ((h % 360) + 360) % 360;
const isNum = (n) => typeof n === "number" && Number.isFinite(n);

/**
 * An oklch() value as [l, c, h]. Takes lightness as a number or a percentage, hue
 * with or without "deg", and an alpha (dropped). Null for anything else.
 */
function parseOklch(value) {
  const m = value?.match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*[\d.]+%?\s*)?\)$/);
  if (!m) return null;
  return [m[2] ? +m[1] / 100 : +m[1], +m[3], +m[4]];
}

function declarations(block) {
  const out = {};
  for (const m of block.matchAll(/(--[\w-]+):\s*([^;]+);/g)) out[m[1]] ??= m[2].trim();
  return out;
}

/**
 * The look tokens.css has, read from its source text:
 *   palette   every ramp step, by swatch, as [l, c, h]
 *   baseHue   the paper ramp's hue there (its tint there is 1)
 *   rampRead  false when the paper ramp couldn't be read (hue and tint are then off)
 *   paper     { hue, tint }: shared by both modes, as the ramp is
 *   roles     paper colors, per mode, by token
 *   knobs     paper numbers, per mode, by token
 */
function lookFromTokens(css) {
  const DARK = "@media (prefers-color-scheme: dark)";
  const light = declarations(css.slice(0, css.indexOf(DARK)));
  const dark = { ...light };
  for (let at = css.indexOf(DARK); at >= 0; at = css.indexOf(DARK, at + 1)) {
    const next = css.indexOf("@media", at + 1);
    Object.assign(dark, declarations(css.slice(at, next > 0 ? next : undefined)));
  }
  const values = { light, dark };

  const swatch = (value) => {
    const ref = value?.match(/^var\(--([\w-]+-\d+)\)$/);
    if (ref) return ref[1];
    if (value && /^#(000|000000)$/i.test(value)) return "black";
    if (value && /^#(fff|ffffff)$/i.test(value)) return "white";
    return "paper-500";
  };

  const palette = {};
  for (const name of RAMP_NAMES) {
    for (const step of STEPS) {
      const v = parseOklch(light[`--${name}-${step}`]);
      if (v) palette[`${name}-${step}`] = v;
    }
  }
  const rampRead = STEPS.every((step) => palette[`paper-${step}`]);
  const baseHue = palette["paper-500"]?.[2] ?? 85;
  const perMode = (fn) => Object.fromEntries(MODES.map((mode) => [mode, fn(mode)]));

  return {
    palette,
    baseHue,
    rampRead,
    paper: { hue: baseHue, tint: 1 },
    roles: perMode((mode) => Object.fromEntries(ROLES.map((r) => [r.token, swatch(values[mode][r.token])]))),
    knobs: perMode((mode) => Object.fromEntries(KNOBS.map((k) => [k.token, parseFloat(values[mode][k.token]) || 0]))),
  };
}

/** From hue a toward hue b, the short way round, by t. */
const leanHue = (a, b, t) => wrap(a + ((((b - a) % 360) + 540) % 360 - 180) * t);

/**
 * A saved look.json on top of tokens.css. Only the paper colors, numbers, hue and
 * tint are taken; anything missing or malformed comes from tokens.css. Saves from
 * the older, bigger look tool (version 2) open too. `note` says what of an old
 * save couldn't be carried over.
 */
function withSave(fromTokens, saved) {
  let paper = fromTokens.paper;
  let note;
  if (saved.paper && isNum(saved.paper.hue) && isNum(saved.paper.tint)) {
    paper = { hue: wrap(saved.paper.hue), tint: Math.max(0, saved.paper.tint) };
  } else if (saved.version === 2 && saved.ramps?.paper) {
    // The older tool's paper color: the ramp's own hue and strength, then the
    // global knobs on top (a hue turn, the paper tint, a cast to lean toward).
    const old = saved.ramps.paper;
    const g = saved.global ?? {};
    const hue = wrap((isNum(old.hue) ? old.hue : fromTokens.baseHue) + (isNum(g.hue) ? g.hue : 0));
    paper = {
      hue: +leanHue(hue, isNum(g.castHue) ? g.castHue : hue, isNum(g.cast) ? g.cast : 0).toFixed(1),
      tint: +((isNum(old.chroma) ? old.chroma : 1) * (isNum(g.neutrals) ? g.neutrals : 1)).toFixed(3),
    };
    if ((isNum(g.light) && g.light !== 0) || (isNum(g.spread) && g.spread !== 1)) {
      note = "its lightness and spread knobs aren't in this tool, so the paper may look lighter or darker than saved";
    }
  }

  const isSwatch = (v) => typeof v === "string" && (v === "black" || v === "white" || v in fromTokens.palette);
  const pick = (from, keys, ok) => Object.fromEntries(keys.filter((k) => ok(from?.[k])).map((k) => [k, from[k]]));
  const roleKeys = ROLES.map((r) => r.token);
  const knobKeys = KNOBS.map((k) => k.token);
  const look = {
    ...fromTokens,
    paper,
    roles: Object.fromEntries(
      MODES.map((m) => [m, { ...fromTokens.roles[m], ...pick(saved.roles?.[m], roleKeys, isSwatch) }]),
    ),
    knobs: Object.fromEntries(
      MODES.map((m) => [m, { ...fromTokens.knobs[m], ...pick(saved.knobs?.[m], knobKeys, isNum) }]),
    ),
  };
  return { look, note };
}

/** A swatch as a CSS value: a ramp step's token, or black / white. */
const swatchCss = (swatch) => (swatch === "black" ? "#000000" : swatch === "white" ? "#ffffff" : `var(--${swatch})`);

/** A knob's value as CSS, e.g. "96px". */
const knobCss = (knob, value) => `${+value.toFixed(3)}${knob.unit}`;

/** Whether hue or tint differ from tokens.css. */
const paperChanged = (look) => look.paper.hue !== look.baseHue || look.paper.tint !== 1;

/** A swatch as [l, c, h], with the hue and tint knobs on the paper ramp. */
function oklchOf(swatch, look) {
  if (swatch === "black") return [0, 0, 0];
  if (swatch === "white") return [1, 0, 0];
  const v = look.palette[swatch];
  if (!v) return null;
  return swatch.startsWith("paper-") ? [v[0], v[1] * look.paper.tint, look.paper.hue] : v;
}

/** The paper ramp with the hue and tint knobs applied, by token. Empty when unchanged. */
function paperRamp(look) {
  if (!look.rampRead || !paperChanged(look)) return {};
  return Object.fromEntries(
    STEPS.map((step) => {
      const [l, c, h] = oklchOf(`paper-${step}`, look);
      return [`--paper-${step}`, `oklch(${+l.toFixed(4)} ${+c.toFixed(4)} ${+h.toFixed(1)})`];
    }),
  );
}

/** The CSS custom properties a mode's look sets, by name. */
function tokenValues(look, mode) {
  const out = paperRamp(look);
  for (const r of ROLES) out[r.token] = swatchCss(look.roles[mode][r.token]);
  for (const k of KNOBS) out[k.token] = knobCss(k, look.knobs[mode][k.token]);
  return out;
}

/** Lines for tokens.css: the paper ramp if it moved, then each mode's paper colors and numbers. */
function exportCss(look) {
  const block = (mode, indent) => {
    const out = [];
    const differs = (light, v) => mode === "light" || v !== light;
    for (const r of ROLES) {
      const v = look.roles[mode][r.token];
      if (differs(look.roles.light[r.token], v)) out.push(`${indent}${r.token}: ${swatchCss(v)};`);
    }
    for (const k of KNOBS) {
      const v = look.knobs[mode][k.token];
      if (differs(look.knobs.light[k.token], v)) out.push(`${indent}${k.token}: ${knobCss(k, v)};`);
    }
    return out;
  };
  const ramp = Object.entries(paperRamp(look));
  return [
    ...(ramp.length ? ["/* Paper ramp (hue and tint) */", ":root {", ...ramp.map(([t, v]) => `  ${t}: ${v};`), "}", ""] : []),
    "/* Paper, light */",
    ":root {",
    ...block("light", "  "),
    "}",
    "",
    "/* Dark mode: only what differs from light */",
    "@media (prefers-color-scheme: dark) {",
    "  :root {",
    ...block("dark", "    "),
    "  }",
    "}",
    "",
  ].join("\n");
}

/** What look.json keeps: enough to open the look again here. */
const saveJson = (look) => JSON.stringify({ version: 3, paper: look.paper, roles: look.roles, knobs: look.knobs }, null, 2) + "\n";

// ---------------------------------------------------------------------------
// Light / dark. The app has no toggle: tokens.css follows the system. This fakes
// one by switching every "(prefers-color-scheme)" rule in the page's stylesheets
// on or off; "system" puts them back.

const DARK_QUERY = "(prefers-color-scheme: dark)";
const darkQuery = window.matchMedia(DARK_QUERY);
const mediaText = new WeakMap();

function forceScheme(choice) {
  const walk = (rules) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSMediaRule) {
        const text = mediaText.get(rule) ?? rule.media.mediaText;
        if (/prefers-color-scheme/.test(text)) {
          mediaText.set(rule, text);
          const forDark = /dark/.test(text);
          rule.media.mediaText = choice === "system" ? text : forDark === (choice === "dark") ? "all" : "not all";
        }
      }
      if ("cssRules" in rule) walk(rule.cssRules);
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      walk(sheet.cssRules);
    } catch {
      // Another site's stylesheet (the fonts): can't be read, and isn't ours anyway.
    }
  }
  document.documentElement.style.colorScheme = choice === "system" ? "" : choice;
}

// ---------------------------------------------------------------------------
// State, and putting it on the page.

let look = null;
let tokensText = "";
let forced = "system";
let seed = 0;
let applied = [];

const $ = (id) => document.getElementById(id);
const systemMode = () => (darkQuery.matches ? "dark" : "light");
const mode = () => (forced === "system" ? systemMode() : forced);
const setStatus = (text) => ($("status").textContent = text);

// Parts of the panels that change without rebuilding them.
const live = { exportPre: null, hueInput: null, reset: null };

/** Puts the look on <html>, so tokens built from other tokens follow it too. */
function apply() {
  const root = document.documentElement.style;
  for (const name of applied) root.removeProperty(name);
  const values = tokenValues(look, mode());
  for (const [name, value] of Object.entries(values)) root.setProperty(name, value);
  applied = Object.keys(values);

  $("page").style.setProperty("--seed", seed);
  $("card").style.setProperty("--seed", seed + 17);

  if (live.exportPre) live.exportPre.textContent = exportCss(look);
  if (live.reset) live.reset.disabled = !paperChanged(look);
  if (live.hueInput) {
    // Every hue at the page's lightness and the paper's chroma at this tint, so
    // the track shows what each hue would give. A floor keeps the hues readable
    // when the tint is near grey (the paper itself is fainter than the track then).
    const [l, c] = oklchOf("paper-100", look);
    const chroma = Math.max(0.04, c * 2).toFixed(4);
    const stops = Array.from({ length: 13 }, (_, i) => `oklch(${l} ${chroma} ${i * 30})`).join(", ");
    live.hueInput.style.setProperty("--track", `linear-gradient(to right, ${stops})`);
  }
}

/** A small element maker: h("p", { className: "x" }, "text", child). */
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith("on")) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "style") Object.assign(el.style, value);
    else if (value !== undefined && value !== false) el[key] = value;
  }
  el.append(...children.filter((c) => c != null));
  return el;
}

function slider({ label, hint, value, min = 0, max, step, painted, onInput }) {
  const output = h("output", {}, String(+value.toFixed(2)));
  const input = h("input", {
    type: "range",
    min,
    max,
    step,
    value,
    className: painted ? "painted" : undefined,
    onInput: (e) => {
      const v = +e.target.value;
      output.textContent = String(+v.toFixed(2));
      onInput(v);
    },
  });
  const el = h(
    "label",
    { className: "slider" },
    h("span", { className: "slider-head" }, h("span", {}, label + " ", h("span", { className: "hint" }, hint)), output),
    input,
  );
  return { el, input };
}

// Which groups are open, kept across rebuilds (a mode change rebuilds them).
const open = { knobs: true, hue: true, colors: true, export: false };

function group(key, title, intro, ...children) {
  const el = h("details", { className: "group", open: open[key] }, h("summary", {}, title));
  el.addEventListener("toggle", () => (open[key] = el.open));
  if (intro) el.append(h("p", { className: "intro" }, intro));
  el.append(...children);
  return el;
}

function knobsPanel(m) {
  const sliders = KNOBS.map(
    (k) =>
      slider({
        ...k,
        value: look.knobs[m][k.token],
        onInput: (v) => {
          look.knobs[m][k.token] = v;
          apply();
        },
      }).el,
  );
  const seedSlider = slider({
    label: "Seed",
    hint: "shifts each sheet (preview only)",
    value: seed,
    max: 20,
    step: 1,
    onInput: (v) => {
      seed = v;
      apply();
    },
  }).el;
  return group("knobs", `Paper, ${m} mode`, null, ...sliders, seedSlider);
}

function huePanel() {
  if (!look.rampRead) {
    return group("hue", "Paper hue", "Off: this tokens.css has no paper ramp (--paper-50 to --paper-950 as oklch()) the tool can read.");
  }
  const hue = slider({
    label: "Hue",
    hint: "degrees round the color wheel",
    value: look.paper.hue,
    max: 360,
    step: 1,
    painted: true,
    onInput: (v) => {
      look.paper.hue = v;
      apply();
    },
  });
  const tint = slider({
    label: "Tint",
    hint: "grey ↔ colored (1 is as tokens.css has it)",
    value: look.paper.tint,
    max: 8,
    step: 0.1,
    onInput: (v) => {
      look.paper.tint = v;
      apply();
    },
  });
  const reset = h(
    "button",
    {
      type: "button",
      className: "small-button",
      onClick: () => {
        look.paper = { hue: look.baseHue, tint: 1 };
        render();
      },
    },
    "Back to tokens.css",
  );
  live.hueInput = hue.input;
  live.reset = reset;
  return group(
    "hue",
    "Paper hue",
    "Turns the whole paper ramp, in both modes. Stocks set to a paper step follow it; white or black don't. Turn Tint up to see more color.",
    hue.el,
    tint.el,
    reset,
  );
}

function colorsPanel(m) {
  const rows = ROLES.map((r) => {
    const select = h(
      "select",
      {
        onChange: (e) => {
          look.roles[m][r.token] = e.target.value;
          apply();
        },
      },
      ...RAMP_NAMES.map((name) =>
        h("optgroup", { label: name }, ...STEPS.map((step) => h("option", { value: `${name}-${step}` }, `${name} ${step}`))),
      ),
      h("optgroup", { label: "ends" }, h("option", { value: "black" }, "black"), h("option", { value: "white" }, "white")),
    );
    select.value = look.roles[m][r.token];
    return h(
      "label",
      { className: "role-row" },
      h("span", { className: "role-swatch", style: { background: `var(${r.token})` }, ariaHidden: "true" }),
      h("span", { className: "role-label" }, r.label),
      select,
    );
  });
  return group("colors", `Paper colors, ${m} mode`, "Which ramp step each one uses. Light and dark are picked separately.", ...rows);
}

function exportPanel() {
  live.exportPre = h("pre", { className: "export" });
  return group("export", "What Save writes (CSS)", null, live.exportPre);
}

/** Builds the panels for the current mode and look, then applies the look. */
function render() {
  const m = mode();
  live.hueInput = live.reset = null;
  $("panels").replaceChildren(knobsPanel(m), huePanel(), colorsPanel(m), exportPanel());
  for (const button of document.querySelectorAll("[data-scheme]")) {
    button.setAttribute("aria-pressed", String(button.dataset.scheme === forced));
  }
  $("system-scheme").textContent = `System (${systemMode()})`;
  apply();
}

// ---------------------------------------------------------------------------
// Buttons and files.

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  h("a", { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Opens the file picker and reads the chosen file. Null when nothing was picked
 * or it couldn't be read (a cancel just leaves the picker's promise unsettled,
 * which is harmless: the next click makes a new one).
 */
const readFile = (input) =>
  new Promise((resolve) => {
    input.value = "";
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return resolve(null);
      try {
        resolve({ text: await file.text(), name: file.name });
      } catch {
        setStatus(`Couldn't read ${file.name}`);
        resolve(null);
      }
    };
    input.click();
  });

/** Whether a stylesheet has the tokens this tool and its page are built on. */
function isTokens(css) {
  const has = declarations(css);
  return [...ROLES, ...KNOBS].every((t) => t.token in has) && "--space-4" in has;
}

/** The buttons that need a look: off until tokens.css has been read. */
const needLook = ["save-css", "save-json", "open-look", "open-tokens"];
const ready = () => needLook.forEach((id) => ($(id).disabled = false));

for (const button of document.querySelectorAll("[data-scheme]")) {
  button.addEventListener("click", () => {
    forced = button.dataset.scheme;
    forceScheme(forced);
    if (look) render();
  });
}
// The system's own light/dark: rebuild only when the page follows it; otherwise
// just keep the "System (…)" label true, so a slider being dragged keeps focus.
darkQuery.addEventListener("change", () => {
  if (look && forced === "system") render();
  else $("system-scheme").textContent = `System (${systemMode()})`;
});

// One download per button: browsers block or ask about a second download that a
// single click starts.
$("save-css").addEventListener("click", () => {
  download("look.css", exportCss(look), "text/css");
  setStatus("Downloaded look.css: lines for the app's tokens.css");
});
$("save-json").addEventListener("click", () => {
  download("look.json", saveJson(look), "application/json");
  setStatus("Downloaded look.json: Open a look.json brings it back here");
});

$("open-look").addEventListener("click", async () => {
  const file = await readFile($("look-file"));
  if (!file) return;
  try {
    const result = withSave(lookFromTokens(tokensText), JSON.parse(file.text));
    look = result.look;
    setStatus([`Opened ${file.name}`, result.note].filter(Boolean).join("; "));
    render();
  } catch {
    setStatus(`Couldn't open ${file.name}: it isn't a look.json`);
  }
});

// Another tokens.css (say the app's): it replaces this one on the page too, so
// everything built on it (spacing, fonts, the ramps) matches what's read. A file
// without the tokens is turned away, so the page keeps the ones it has.
$("open-tokens").addEventListener("click", async () => {
  const file = await readFile($("tokens-file"));
  if (!file) return;
  if (!isTokens(file.text)) {
    setStatus(`Didn't use ${file.name}: it doesn't look like a tokens.css (no paper or spacing tokens)`);
    return;
  }
  $("tokens").replaceWith(h("style", { id: "tokens" }, file.text));
  tokensText = file.text;
  forceScheme(forced);
  look = lookFromTokens(file.text);
  setStatus(`Using ${file.name}` + (look.rampRead ? "" : "; couldn't read its paper ramp, so hue and tint are off"));
  render();
});

// ---------------------------------------------------------------------------
// Start: read tokens.css (the same file the page uses).

fetch("tokens.css")
  .then((r) => {
    if (!r.ok) throw new Error(r.statusText);
    return r.text();
  })
  .then((text) => {
    tokensText = text;
    look = lookFromTokens(text);
    setStatus(
      "Opened what tokens.css has now" + (look.rampRead ? "" : "; couldn't read its paper ramp, so hue and tint are off"),
    );
    render();
    ready();
  })
  .catch(() =>
    setStatus(
      location.protocol === "file:"
        ? "Couldn't read tokens.css: open this through a local server (see the README), not as a file"
        : "Couldn't read tokens.css: reload to try again",
    ),
  );
