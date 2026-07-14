# Direction B — "PLOTTER / PRINT"

> **Prerequisite: read `00-FOUNDATION.md` completely first.** Everything there is binding.
> This file defines ONLY the art direction: palette expression, typography, composition, and the
> signature's treatment.

---

## 1. The thesis

> **The market as a printed scientific figure. The site is a plate torn from a 1987 econophysics
> paper.**

Not a dashboard. Not a SaaS site. A **document**. The graph is not *rendered* — it is **drawn**, by
a pen plotter, in hairline strokes, with **ordered dithering** standing in for shading and
**halftone** for density. The typographic register is a physics journal: a real **serif** for
display against **monospace** for data.

**Why this direction is right for the brief:** every competitor in this category is a black
dashboard with a cyan accent. This one is *unmistakably not that*. It also happens to be
**semantically honest** — dithering is literally what you do when you have limited signal and must
decide; econophysics *is* where correlation-network analysis comes from (Mantegna's minimum
spanning tree, which is your default graph method, is a 1999 physics paper). **The aesthetic is the
provenance.**

**And the move no competitor can copy quickly:** a real, first-class **light mode**. Paper. In a
category where everything is black, a research platform that prints is genuinely startling — and
it doubles as an accessibility and print-to-PDF win.

**The risk:** this needs a confident hand. A bad version looks like an Instagram filter. The escape
is that the dither and halftone must be **real** (a Bayer threshold matrix, actual halftone cells)
and applied to **real data** — not a texture overlay slapped on a normal dark UI.

*(Reference provocation: **MotherDuck** — a data-warehouse company that went warm-paper and
hand-drawn while everyone else went black. Instantly recognisable.)*

---

## 2. Palette — two modes, both first-class

This is the only direction with a **real light mode**. Build both; neither is an afterthought.

```css
:root {                      /* PAPER (default) */
  --paper:    #f4f1ea;       /* warm stock, not white */
  --paper-2:  #e9e4d9;       /* plate / figure background */
  --ink:      #16150f;       /* press black, warm */
  --ink-2:    #4a4740;
  --ink-3:    #8a857a;       /* caption grey — VERIFY >= 4.5:1 */
  --rule:     rgba(22,21,15,.16);
  --plate:    #ffffff;       /* the figure itself */
  --signal:   #b23a1e;       /* OXIDE RED — the one accent (see below) */
  --up:       #1f6b3f;
  --down:     #a8321f;
}
:root[data-theme="ink"] {    /* INK (dark) */
  --paper:    #0b0f19;       /* FOUNDATION ground */
  --paper-2:  #12161f;
  --ink:      #ece8df;
  --ink-2:    #a8a294;
  --ink-3:    #6e6a60;
  --rule:     rgba(236,232,223,.14);
  --plate:    #0f1219;
  --signal:   #e8632f;       /* oxide red, lifted for the dark surface */
  --up:       #3fbf74;
  --down:     #e5544a;
}
```

### Why oxide red
It is the colour of **iron-oxide plotter ink** and of the red used in printed scientific figures to
mark the *significant* series. Like Direction A's amber, it is **reserved for the measured value** —
never an eyebrow, never a CTA background, never a hover.

⚠️ Oxide red sits close to `--down`. **Therefore: never use `--signal` and `--down` in the same
visual context.** Direction/status always ships with an arrow glyph **and** a label, never colour
alone (FOUNDATION §5.3).

### Cluster + series palettes
Generate and validate per **FOUNDATION §5.4** — **and you must validate BOTH modes** (`--mode dark
--surface "#0b0f19"` *and* `--mode light --surface "#f4f1ea"`). A dark palette flipped to light is
not a light palette; it must be **selected**, with its own steps from the same ramps.

Constrain the cluster hues to read like **risograph spot inks**: limited, slightly impure,
overprinting. In the figure, clusters may be distinguished by **halftone pattern as well as hue**
(45° / 135° hatching) — which is exactly the "secondary encoding" that FOUNDATION §5.1 says you
need beyond 6 clusters. **This direction gets 7+ clusters for free.**

---

## 3. Typography

| Role | Face | Notes |
|---|---|---|
| **Display** | **Instrument Serif** *(or **Editorial New** / a GT-Sectra-alike)* | Large, tight, high-contrast. This is the journal-plate voice. |
| **Body** | **Source Serif 4** *(or Newsreader)* | Long-form, readable. A paper is *read*. |
| **Data / caption** | **JetBrains Mono** *(or Commit Mono)* | Tabular figures, tickers, figure captions |

**The serif is the signature.** No competitor in dark-quant-SaaS is running a serif display. It
instantly reads as *published research* rather than *product marketing* — which is exactly the
posture the brand wants.

**Figure captions are a first-class type style** — the tell that this is a document:

```css
.fig-caption {
  font: 400 var(--text-xs)/1.5 var(--font-mono);
  color: var(--ink-3);
}
/* "Fig. 3 — NIFTY-50 correlation network, MST, 60-bar window, as of 2026-07-10.
    Louvain communities (n=7), modularity 0.723." */
```
Number your figures. **Fig. 1, Fig. 2, Fig. 3.** They are the sections.

⚠️ Numbering is only legitimate because the content **genuinely is a numbered sequence of figures**
in a paper. (Do not add `01 / 02 / 03` markers to things that aren't a sequence — that's a generic
tell.)

---

## 4. Composition — the plate

The page is a **paper**: an abstract, numbered figures with captions, a methods section, a
references/disclosure block.

```
┌──────────────────────────────────────────────────────────────────┐
│ SKYLIFE RESEARCH                          [◐ ink/paper]  [sign in]│
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   Structure and Its Motion in the                 ← Instrument    │
│   Indian Equity Market                              Serif, 72px   │
│                                                                   │
│   Skylife Research · NSE · NIFTY-50 (n=49) · 2025-01 → 2026-07    │
│   ───────────────────────────────────────────────────────────     │
│                                                                   │
│   ABSTRACT                                        ← serif body    │
│   We rebuild the correlation graph of the NIFTY-50 for every      │
│   trading session and measure each stock's position within it.    │
│   Community structure is recovered by Louvain (modularity 0.723). │
│   We make no directional claim: lead-lag does not survive an      │
│   FDR-10% null.                            ← THE HONESTY, up front│
│                                                                   │
│   ┌── Fig. 1 ──────────────────────────────────────────────┐     │
│   │                                                         │     │
│   │      [ THE GRAPH — plotter-drawn, Bayer-dithered ]      │     │
│   │      hairline strokes · halftone density · real         │     │
│   │                                                         │     │
│   │   ── 2025-01 ────────────●──────────── 2026-07-10       │     │
│   └─────────────────────────────────────────────────────────┘     │
│   Fig. 1 — Correlation network, MST, 60-bar window. Drag the      │
│   scrubber to advance the as-of date. n=49, 7 communities.        │
│                                                                   │
│   [ Run it yourself → ]                                           │
└──────────────────────────────────────────────────────────────────┘
```

- **Zero border-radius. Zero shadow.** Rules only. (Same as Direction A — but here it reads as
  *print*, not *engraving*.)
- **Hairline rules** between sections, occasionally **wobbled** with an SVG displacement filter so
  they read as a seismograph trace / a noisy signal (⚠️ 1px-tall elements ONLY — see §6).
- The **theme toggle is a visible, celebrated control** (`◐ ink / paper`), not hidden in a menu.
  It's a feature, not a setting.

---

## 5. The signature — the Bayer-dithered plotter graph

Build the **temporal morph engine** exactly as FOUNDATION §8 specifies. The *treatment*:

### 5.1 Draw it like a plotter
- **Hairline vector strokes.** Edges are 1px, no glow, no additive blending. A pen has one width.
- **Nodes are small circles or crosses**, sized by centrality — drawn, not lit.
- **Density is halftone, not opacity.** Where the graph is dense, dot size grows; it does not fade.
- **Hulls are hatched**, not filled: 45° hairlines for one cluster, 135° for the next. This is the
  secondary encoding that lets you exceed 6 clusters safely.

### 5.2 The Bayer dither pass (the thing people will screenshot)
Render the Canvas 2D graph to a texture, then quantise it to 2–4 levels through an **8×8 Bayer
threshold matrix** in a single WebGL2 fullscreen fragment pass.

```glsl
// ~40 lines total. No three.js. Vertex shader = one fullscreen triangle.
const float bayer8[64] = float[](0.,32.,8.,40.,2.,34.,10.,42., /* … 64 values … */);
float t   = bayer8[(int(gl_FragCoord.y) % 8) * 8 + (int(gl_FragCoord.x) % 8)] / 64.0;
float lum = dot(texture(uTex, vUv).rgb, vec3(0.299, 0.587, 0.114));
float q   = step(t, fract(lum * LEVELS));
vec3  col = mix(floor(lum * LEVELS) / LEVELS, ceil(lum * LEVELS) / LEVELS, q) * uInk;
```
Feed the 2D canvas in via `texImage2D(gl.TEXTURE_2D, 0, …, canvas2d)`.

**Cost:** one fullscreen pass, **~0.3ms** on integrated graphics. Negligible.
**Guard:** behind `prefers-reduced-motion` **and** a WebGL-availability check, with the plain
hairline canvas as the fallback. It must degrade to something that still looks deliberate.

> This is the single cheapest way to make a dark data site look like **nothing else on the web** —
> and it is *semantically honest*: dithering is what you do when signal is limited and you must
> still decide.

### 5.3 ASCII mode (optional second render)
A toggle that renders the graph as a grid of monospace glyphs (`. : ; + * # @` by density).
Sample the canvas with `getImageData` on an 8×12 grid and `fillText`. **Redraw at ~10fps, not 60** —
~8–15ms per pass. The slow refresh *helps* the aesthetic (it should feel like a plotter, not a GPU).

---

## 6. Texture rules (get these wrong and it's a perf disaster)

- **Halftone** — pure CSS, free:
  ```css
  .halftone { background-image: radial-gradient(circle at center, currentColor .8px, transparent .9px);
              background-size: 4px 4px; opacity: .06; }
  ```
- **Anti-banding dither** — dark gradients band badly on 8-bit panels:
  ```css
  .dither { background-image:
      linear-gradient(180deg, #0b0e13, #05070a),
      repeating-conic-gradient(rgba(255,255,255,.006) 0 25%, transparent 0 50%);
    background-size: 100% 100%, 2px 2px; }
  ```
- **Grain** — **bake it once to a 128px tile.** Never a live full-viewport `feTurbulence`.
- ⚠️ **`feTurbulence` + `feDisplacementMap`** (the wobbled rules) re-evaluates Perlin noise over the
  element's bbox **every frame**: 2–6ms on a 400×200 element. **Apply ONLY to 1px-tall rules**, and
  toggle it off when off-screen. Never full-viewport. Never on scroll.

---

## 7. What this direction must NOT do

- No glow. No `box-shadow`. No `border-radius`. No glassmorphism. No gradient text.
- **The dither must be real.** A CSS "noise overlay" on a normal dark UI is a filter, not an art
  direction. If you can't do the WebGL pass, do a real halftone in Canvas 2D — but do not fake it.
- **No second accent.** Oxide red only.
- Do not let the serif leak into data. Numbers are **always** mono, **always** tabular.
- Do not ship light mode as an inverted dark mode. It must be **selected and validated separately**.

---

## 8. Definition of done

All of FOUNDATION §12, plus:

- [ ] **Both modes** ship and **both pass the palette validator** (`--mode dark --surface "#0b0f19"`
      *and* `--mode light --surface "#f4f1ea"`). Screenshot both reports into `design/artifacts/`.
- [ ] The theme toggle is visible in the header and persists (localStorage + `data-theme` on `:root`)
- [ ] The Bayer dither pass runs, and **degrades cleanly** to a hairline canvas without WebGL and
      under `prefers-reduced-motion`
- [ ] Figures are **numbered** and every one has a **real caption with real parameters**
- [ ] The abstract states the honest limitation (lead-lag does not survive the null) **above the fold**
- [ ] `grep -rE "border-radius|box-shadow" app/globals.css` → only `0` / `none`
- [ ] The graph **cools** (alpha decay) — Playwright can screenshot without a stability timeout
- [ ] 8 highlighted chart series render in **8 distinct colours**
- [ ] Print stylesheet: `Ctrl-P` on the landing page produces something that actually looks like a
      paper. (This direction has no excuse not to.)
</content>
