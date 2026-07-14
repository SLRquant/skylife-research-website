# Direction A — "INSTRUMENT"

> **Prerequisite: read `00-FOUNDATION.md` completely first.** Everything there is binding.
> This file defines ONLY the art direction: palette expression, typography, composition, and the
> signature's treatment.

---

## 1. The thesis

> **The website is the faceplate of a scientific instrument.**

Not a SaaS landing page that happens to be dark. A piece of **measurement apparatus** — the visual
register of a Braun oscilloscope, a Teenage Engineering unit, a lab bench. Everything is engraved,
hairline, silkscreened, and *snapped to a grid*. Nothing floats. Nothing glows. Nothing is rounded.

The graph sits inside a **recessed screen bezel**, like a readout on a machine.

**Why this direction is right for the brief:** the audience is quants. They trust *precision* and
distrust *marketing*. An instrument does not persuade you — it **reports**. That posture is the
brand: honest, measured, unembellished. It is also the lowest-risk way to look intentional rather
than templated, because templates fake structure with shadows and gradients, and this direction
has neither.

**The one risk to manage:** "dark + mono + hairlines" is one bad decision away from the generic
terminal template you're replacing. **The escape is total commitment**: real engraved detail, a
real grid that content actually snaps to, real numbers as ornament, zero radius, zero shadow, and
exactly one signal colour. A half-hearted instrument reads as template; a total one reads as art
direction.

---

## 2. Palette

**Ground:** graphite/anthracite with a faint **warm** bias (an instrument is metal, not a void).

```css
:root {
  /* surfaces — warm graphite, NOT neutral gray, NOT pure black (OLED smear) */
  --ink-900: #0b0f19;   /* page (FOUNDATION ground; keep) */
  --ink-800: #12151c;   /* panel / faceplate */
  --ink-700: #191d25;   /* recessed screen bezel */
  --ink-600: #23272f;   /* raised key */

  /* rules — hierarchy comes from RULE WEIGHT, not elevation */
  --rule-1: rgba(255,255,255,.06);   /* the grid */
  --rule-2: rgba(255,255,255,.12);   /* panel edge */
  --rule-3: rgba(255,255,255,.22);   /* active / engraved */

  /* ink */
  --text:   #e8eaed;
  --text-2: #a8adb8;
  --label:  #6f7684;   /* silkscreen micro-labels. >= 4.5:1 on --ink-800 — VERIFY */

  /* THE ONE SIGNAL COLOUR — sodium amber. Used ONLY for live values. */
  --signal: #ff9e2c;

  /* status — reserved, ship with an icon/label, never colour alone */
  --up:   #35c26a;
  --down: #e5484d;
}
```

### Why amber, not cyan
Cyan is the default "tech" accent and it is what the old site drowned in. **Sodium amber** is the
colour of a nixie tube, a warning lamp, a Braun dial — it reads as *instrumentation*, not *SaaS*.
Critically, it is **rare on the web**, and it separates cleanly from both the up-green and the
down-red, so it can never be confused with a directional signal.

**The rule that makes it work:** amber is applied **only to a live measured value**. Never to an
eyebrow, never to a heading `<em>`, never to a CTA background, never to a hover state. If a number
is amber, it came out of the engine. That is the whole language.

### Cluster + series palettes
Generate and validate per **FOUNDATION §5.4**. Constrain the cluster hues to feel like **engraved
enamel inlays** — slightly desaturated, sitting *in* the faceplate rather than glowing on top of
it. Hulls fill at ~6% alpha with a 1px stroke at ~25%.

---

## 3. Typography

| Role | Face | Notes |
|---|---|---|
| **Display** | **Martian Mono** (variable, has a **width axis**) | Headlines set in *mono* at 56–96px, leading **0.95**, tight tracking. Self-host. |
| **Body** | **Inter Tight** (already loaded) | Weight capped at **500**. No 700. |
| **Data** | **Martian Mono** | Tabular figures, tickers, timestamps |

*(Free alternates if Martian Mono is awkward: **Commit Mono** (slashed zero, cursive axis),
**Departure Mono** (bitmap — stronger, riskier), **JetBrains Mono**, **Geist Mono**.)*

**Mono-as-display is the typographic signature.** It says "this output was computed" before a
single word is read. Because Martian Mono has a **width axis**, section headings can *physically
expand* on scroll (see §6) — kinetic without being a fade-up.

**Silkscreen micro-labels** are the second signature: `10–11px`, uppercase, `letter-spacing: .18em`,
`--label` colour. They label panels the way a legend is silkscreened onto a circuit board.

```css
.label { font: 500 var(--text-2xs)/1.2 var(--font-mono);
         text-transform: uppercase; letter-spacing: .18em; color: var(--label); }
```

---

## 4. Composition — the hairline grid

**A visible engineering grid, and content actually snaps to it.** This is the single cheapest way
to look intentional, because templates *fake* structure with shadows.

- 12 columns × **96px** rows, drawn as a fixed background layer.
- 1px lines at `--rule-1`.
- Small **`+` marks at intersections** (silkscreen fiducials).
- **`border-radius: 0` everywhere. `box-shadow: none` everywhere.** Hierarchy = rule weight + overlap.

```css
.grid-bg {
  position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background-image:
    repeating-linear-gradient(to right,  var(--rule-1) 0 1px, transparent 1px var(--col)),
    repeating-linear-gradient(to bottom, var(--rule-1) 0 1px, transparent 1px 96px);
  /* + fiducials: one inline-SVG background at 96px intervals */
}
```

**Every section must align to it.** If a panel edge doesn't land on a grid line, move the panel —
don't move the grid.

### Data-as-ornament (the highest-value, lowest-cost move)
Fill the **left gutter** with real, rotated micro-type — a lab notebook margin:

```css
.gutter { writing-mode: vertical-rl; font-size: var(--text-2xs);
          letter-spacing: .08em; color: var(--label); opacity: .55; }
```
Content: **real** values from `/api/public/pulse` — `modularity 0.723 · n=49 · louvain · mst · asof 2026-07-10`.

⚠️ **The numbers must be real.** See FOUNDATION §1.

### Hero wireframe

```
┌────────────────────────────────────────────────────────────────────┐
│ SKYLIFE RESEARCH        platform  network  method  pricing   [sign in]│
├─+──────────+──────────+──────────+──────────+──────────+──────────+─┤
│ │          │          │          │          │          │          │ │
│m│  ┌─ recessed screen bezel ─────────────────────────────────┐   │ │
│o│  │                                                          │   │ │
│d│  │        THE REAL NIFTY-50 CORRELATION GRAPH               │   │ │
│u│  │        (canvas, live, deterministic, interactive)        │   │ │
│l│  │                                                          │   │ │
│a│  │   ── scrub ────────●───────────────────────────────      │   │ │
│r│  │      2025-01           2026-07-10                        │   │ │
│i│  └──────────────────────────────────────────────────────────┘   │ │
│t│                                                                  │ │
│y│  THE MARKET IS NOT                       ← Martian Mono, 88px    │ │
│ │  A LIST.                                    leading 0.95         │ │
│0│                                                                  │ │
│.│  Rebuilt every session. 49 names. Watch the structure move.      │ │
│7│                                                                  │ │
│2│  [ RUN THE GRAPH ]  [ today's clusters ]   ← square, 0 radius    │ │
│3│                                                                  │ │
├─+──────────+──────────+──────────+──────────+──────────+──────────+─┤
│ STOCKS 49 │ CLUSTERS 7 │ MODULARITY 0.723 │ MOST CENTRAL ULTRACEMCO│ ← amber
└────────────────────────────────────────────────────────────────────┘
```

The hero is **the instrument's screen**, not a headline with a picture beside it. The graph is
**above** the words.

### Section rhythm — break the monotony
The audit found five sections with **byte-identical** `sec-head` rhythm and five arbitrary
dingbats. **Kill the dingbats.** Vary the *composition*, not the decoration:

- **Methodology** → keep the numbered vertical rail (the only real compositional idea in the repo)
- **Pricing** → a **comparison table**, not three cards. An instrument has a spec sheet.
- **FAQ** → two-column list, no accordion chrome
- **Platform** → **engineering-schematic diagrams** (boxes, arrows, labels) — *à la* Modal — not
  icon + heading + copy cards

---

## 5. The signature — a recessed graph readout, plotter-drawn

Build the **temporal morph engine** exactly as FOUNDATION §8 specifies. The *treatment* here:

- The graph lives in a **recessed bezel**: `--ink-700` background, a 1px `--rule-3` inner top edge
  and a 1px `--rule-1` inner bottom edge (an *engraved* inset — done with rules, **not** shadow).
- **Nodes are squares**, not circles. A plotter draws squares. Size ∝ centrality.
- **Edges are hairlines.** Use the 3-pass additive glow (FOUNDATION §8.2) but keep the widest pass
  faint — this is a *plot*, not a neon sign.
- **Hulls** are hairline outlines with a 6% fill — engraved regions on the faceplate.
- **Crosshair cursor**, not a pointer: two 1px full-bleed hairlines with `mix-blend-mode: difference`
  so they invert against whatever is beneath, plus a small tabular readout that follows:
  `ULTRACEMCO · C3 · eig 0.500`. This is a **Bloomberg/oscilloscope gesture** and it turns the hero
  from a picture into an instrument. **Far more differentiating than a magnetic button.**

```css
.crosshair-v, .crosshair-h {
  position: absolute; background: var(--text); mix-blend-mode: difference;
  pointer-events: none;
}
.crosshair-v { width: 1px; inset-block: 0; }
.crosshair-h { height: 1px; inset-inline: 0; }
```
Snap the crosshair to the nearest node with a short spring. Nearest-node lookup via a prebuilt
grid hash, **not** a linear scan.

- **Motion is mechanical.** Things *index* into place: `cubic-bezier(.2,0,0,1)`, **180ms**. Nothing
  eases lazily. Panels **assemble** (translate + clip + opacity, staggered **30ms**) — the Fey move
  — rather than fading up.

---

## 6. Two enhancements (both progressive, both cheap)

**Variable-font width unfurl on scroll** — headings go `wght 300 / wdth 75` → `wght 700 / wdth 125`
as they cross the viewport. The letters **physically expand**, like a signal amplifying.

```css
@supports (animation-timeline: view()) {
  h2 { animation: unfurl linear both;
       animation-timeline: view();
       animation-range: entry 20% cover 45%; }
  @keyframes unfurl {
    from { font-variation-settings: 'wght' 300, 'wdth' 75; }
    to   { font-variation-settings: 'wght' 700, 'wdth' 125; }
  }
}
@media (prefers-reduced-motion: reduce) { h2 { animation-timeline: none; } }
```
Support: Chrome 115+, Safari 26+; **Firefox stable still lacks it (~83% global)**. `@supports`
degrades to static type — fine. ⚠️ Width changes advance-width → **layout shift**; wrap headings in
a fixed `min-width` box or accept the reflow only on non-body text.

**Baked film grain** — a fixed 3–5% noise overlay, `mix-blend-mode: overlay`. Kills the flat
"digital black" and unifies canvas + DOM into one image.
⚠️ **Bake it once to a 128px tile** (generate in a canvas at boot, use as a repeating background).
**Never** ship a live full-viewport `feTurbulence` filter — that's 10–30ms/frame and the single
most common perf disaster on "designer" sites.

---

## 7. What this direction must NOT do

- No glow. No `box-shadow`. No `border-radius`. Not once.
- No gradient text. No glassmorphism.
- **No second accent.** Amber is the only accent. Up-green and down-red are *status*, not accent.
- No mono on prose (see FOUNDATION §6 — mono is for figures and identifiers).
- No fake terminal chrome. You are a real instrument; cosplay reads as insecurity.

---

## 8. Definition of done

All of FOUNDATION §12, plus:

- [ ] `grep -rE "border-radius|box-shadow" app/globals.css` → only `0` / `none`
- [ ] `--signal` (amber) appears **only** on live measured values. Grep every usage and justify it.
- [ ] Every panel edge lands on a **96px grid line** (screenshot with the grid visible and check)
- [ ] The gutter micro-type contains **real** values from `/api/public/pulse`
- [ ] Crosshair cursor works on the graph and reads out the nearest node
- [ ] The graph **cools** (alpha decay) — Playwright can screenshot without a stability timeout
- [ ] 8 highlighted chart series render in **8 distinct colours**
- [ ] Palette validator PASSES; screenshot the report into `design/artifacts/`
</content>
