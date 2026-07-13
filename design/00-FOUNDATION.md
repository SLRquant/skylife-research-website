# Skylife Research — Design Foundation (shared by both directions)

> **Read this file completely before writing a single line of code.**
> It is the shared substrate for **Direction A (`01-DIRECTION-A-INSTRUMENT.md`)** and
> **Direction B (`02-DIRECTION-B-PLOTTER.md`)**. Those two files differ ONLY in art direction —
> palette *expression*, typography, layout composition, and the signature element's treatment.
> Everything in *this* file is true for both and is not up for reinterpretation.

---

## 0. TL;DR for an agent picking this up cold

You are redesigning a quantitative-finance research platform. The client rejected the previous
design as "trash." A three-agent investigation (design research, a measured visual audit, and
animation research) found the problem is **not decoration — it is that the site has no thesis and
its data visualisation is factually broken.**

Your job:
1. Fix the **five severe defects** in §3 (they are measured, not opinions).
2. Build the **design system** in §5–§7 (color is *computed*, not chosen — do not eyeball it).
3. Build the **signature element** in §8 — the temporal morph engine. This is the product.
4. Delete everything in §9. Do not soften it. Delete it.
5. Never ship anything on the anti-pattern list in §10.
6. Verify with §12 before claiming done.

**The one sentence that governs every decision:**

> **The graph is not an illustration on the page. The graph *is* the page — and the only thing
> that matters about it is that it MOVES.**

---

## 1. Product context (you need this to design honestly)

**Skylife Research** does graph/network analysis of the Indian stock market.

- **Universe:** NIFTY-50 → **49 tradable names** (TMPV is excluded — no price history). NSE.
- **Data:** 1-minute OHLCV bars from **2025-01-01** (≈377 usable daily bars). Resampled to
  `1m / 5m / 15m / 1h / 1d`. *(There is no `1w`. There is no history before 2025.)*
- **Pipeline:** log returns over a trailing window → Pearson/Spearman correlation matrix →
  sparsified into a graph (**MST** default, or kNN / threshold / complete) → **Louvain**
  communities → **5 centrality metrics** per stock.
- **The 5 metrics:** `degree_strength`, `eigenvector_centrality`, `betweenness_centrality`,
  `closeness_centrality`, `pagerank`.
- **The product:** rebuild the graph for **every as-of day** in a window, so you can watch each
  stock's position in the network *change*. Currently fixed at **10 as-of days**.

**Real numbers you may use as content (these are true — verify via `/api/public/pulse`):**
- 49 stocks · ~48 edges (MST) · **5–8 communities** · **modularity ≈ 0.44–0.72**
- A recent most-central stock: **ULTRACEMCO** (eigenvector ≈ 0.50), then JIOFIN, BAJAJFINSV
- A live full-universe computation takes **~10–15 seconds**

> ⚠️ **HONESTY IS THE BRAND.** A quant audience spots a fake t-statistic instantly, and if they
> do, you are dead. **Every number on the page must be real.** If you cannot source it, do not
> display it. The site's best existing asset is its honest copy ("Is this a signal I can trade
> directly?" → *"No — and we'd rather say so."*). Protect that.

> ⚠️ **DO NOT ANIMATE DIRECTED FLOW BETWEEN STOCKS.** Skylife's own research found **lead-lag is
> dead** (0 of 2,450 directed pairs survive an FDR-10% null). Any animation implying causal
> flow from stock A → stock B is a lie the company's own paper rejects. Edge particles must be
> **undirected** (or oscillate, or run core→periphery, which is a *structural* claim, not a
> causal one).

---

## 2. Tech constraints (non-negotiable)

| | |
|---|---|
| Stack | Next.js 16 (App Router), React 19, plain CSS + Tailwind v4, TypeScript |
| Installed & usable | `d3`, `framer-motion`, `swr`, `zod`, `firebase`, `firebase-admin` |
| **No paid libraries.** No new heavy deps. | |
| Graph rendering | **Canvas 2D. Not WebGL.** At 49 nodes / 48–144 edges, Canvas 2D wins on every axis including dev time. Revisit only past ~5,000 edges. |
| Reduced motion | **Must be respected — including in canvas.** CSS media queries do nothing for canvas; check `matchMedia('(prefers-reduced-motion: reduce)')` in JS and render a static frame. |
| Hosting | Vercel **Hobby** — serverless functions cap at 60s. |
| Auth | Firebase (Google + email/password). The tool is **Google-only**. |
| Tiers | `free` (1d only, mst/knn, lookback ≤100, 5 runs) and `paid` (everything, unlimited). Enforced **server-side** in `app/api/graph-stats/run/route.ts`. **Do not touch the tier logic.** |

**Do not break these existing, working systems** (they are tested and correct):
- `lib/graph-stats-schema.ts` — the Zod schema shared by form *and* server
- `lib/quota.ts` — atomic reserve/refund (verified under race conditions)
- `app/api/graph-stats/run/route.ts` — auth → tier → quota → upstream → refund
- The cancel-and-refund flow

**API you consume:**
- `GET /api/public/pulse` — public, cached 1h, real headline numbers (no auth, no quota)
- `GET /api/network-graph` — public, cached 1h, the real live graph (nodes/edges/communities)
- `POST /api/graph-stats/run` — authenticated, metered; returns rolling per-stock series + `latest_graph`

---

## 3. The five severe defects (MEASURED — fix these first)

### DEFECT 1 — The flagship chart is unreadable ⚠️ WORST
`components/graph-stats/TimeSeriesChart.tsx:221,236` — `stroke={clusterColor(s.community)}`

Color encodes **cluster**, but the user is tracking a **stock**. Measured live, 8 highlighted
series render in **4 colors**:

```
#e879f9 → ULTRACEMCO, HINDUNILVR, GRASIM   ← three IDENTICAL magenta lines
#4dd4ac → BAJAJFINSV, SHRIRAMFIN           ← two identical green lines
#6ea8fe → JIOFIN, ADANIPORTS               ← two identical blue lines
```
The end-labels are cluster-colored too, so the legend cannot disambiguate them either.

**FIX:** color by **series** (the stock). Cluster moves to a secondary channel (a dot in the
label, and the hull the node sits inside). See §5.

### DEFECT 2 — The force simulation never cools (CPU burn)
`components/GraphCanvas.tsx:154–158` — the rAF loop calls `tick()` every frame **forever**. No
alpha decay, no stop condition. O(n²) repulsion (1,176 pairs) + 144 edge springs at 60fps,
indefinitely, after the layout has already settled.

*Proof:* **Playwright could not screenshot the page** — it timed out on "waiting for element to
be stable." Collapsing the graph panel made the screenshot succeed instantly.

**FIX:** `alpha *= 0.99` per tick; stop below `0.005`. Reheat on drag/resize/data-change.

### DEFECT 3 — The graph uses ~35% of its canvas
`GraphCanvas.tsx:16–17,61,122` — `W=1000,H=700` but zoom fits the **viewBox**, not the
**content**, while `CENTER_PULL` drags all 49 nodes into a ~420px disc. ~150px dead space top,
~200px left.

**FIX:** after warm-up, compute the node bounding box and set initial `k`/`tx`/`ty` to fit *that*
with a margin. Makes the graph ~2.5× larger for free.

### DEFECT 4 — Two reveal systems fight; a non-scrolled render is blank
`components/ScrollReveal.tsx` adds `.reveal` (`opacity:0`) to every `.section`, while
framer-motion **independently** animates the children of those same sections from `opacity:0`.
Two stacked opacity-0 layers, different triggers, different durations. Content fades in **twice**.

Worse: a full-page render (OG image, PDF, crawler) is **~4,000px of pure black**.

**FIX:** delete `ScrollReveal.tsx` and all `.reveal` / `.js-ready` CSS. One system only.

### DEFECT 5 — Pricing sells features the same page disowns
`components/sections/Pricing.tsx:85,89,93` advertises "Cluster-break alerts (intraday)",
"Co-integrated pairs report", "Portfolio risk graph" — while `Platform.tsx:134` marks Portfolio
Overlap **"IN BUILD"** and `FAQ.tsx` explicitly says those features don't exist. **One scroll apart.**

**FIX:** sell only what exists. The real feature ladder is the **tier system** (intervals, graph
methods, lookback depth, run count). Leave prices as `TBD`.

**Also broken (lower severity, still fix):**
- `ToolCursorGlow.tsx:8` queries `.tool` — **0 elements exist**. The `--mx/--my` custom props are
  never set, so `.bento-card::after`'s "cursor spotlight" is a frozen blob at `50% 0%`.
- `Leaderboard.tsx:38–40` — each sparkline is autoscaled to **its own** min/max, so they are not
  comparable. And `pct = delta/|first|*100` on a 0–1 centrality yields nonsense like **"+1287%"**.
  Share one y-domain; drop the % column.
- Contrast failures: `--mute-2 #4a556e` on `--bg-card` = **2.50:1** ❌ — and it is used for
  `.gs-hint`, the **helper text on the paid tool's form**. `.gs-chip.on` = **3.10:1** ❌.

---

## 4. The audit's systemic findings

| Metric | Measured | Target |
|---|---|---|
| Distinct `font-size` values | **37** (incl. `9.5px`, `10.5px`, `13.5px`) | **7** |
| Distinct `padding` values | **64** | **6** |
| Distinct `gap` values | 20 | 6 |
| CSS selectors declared 2+ times | **69** | 0 |
| Dead CSS | **~120 lines** | 0 |

**Monospace is inverted.** Today `.mono` is on eyebrows, nav, footers, and legal text (costume),
while the actual *numbers* render in Inter Tight. **Mono is for tabular figures, tickers, and
timestamps. Nowhere else.**

**Cyan is over-used.** `--accent #00e1ff` appears on every eyebrow, every `<em>`, every CTA, every
tag, every hover, the logo, the focus ring, and both hero gradient stops. When everything is the
accent, nothing is. **The accent belongs to the data.**

---

## 5. COLOR — computed, not chosen

> **Never eyeball whether a palette is colorblind-safe. Run the validator.**
> `node scripts/validate_palette.js "<hex,…>" --mode dark --surface "#0b0f19"`
> (in the `dataviz` skill directory)

### 5.1 The hard finding

I searched OKLCH space against the validator. **You cannot encode 7 clusters by color alone on a
dark surface.** This is a gamut fact, not a taste call:

```
Max achievable worst-PAIR CVD separation (dark surface, all pairs):
  n=4   ΔE 30.0   safe on colour alone
  n=5   ΔE 15.8   safe on colour alone
  n=6   ΔE 14.7   safe on colour alone     ← the ceiling
  n=7   ΔE 10.8   NOT SAFE — needs secondary encoding
```

**Why:** Okabe-Ito (the reference CVD-safe palette) separates its sky-blue from its blue by
**lightness**. A dark surface forces every categorical hue into a narrow lightness band
(OKLCH **L 0.48–0.67**) — which *destroys exactly that separation*. Hues must therefore be
separable by **hue alone**, and there is only so much hue circle to go around.

**The current palette FAILS:** `#e879f9` ↔ `#6ea8fe` = **ΔE 9.8 under deuteranopia**. ~6% of men
cannot tell two of your clusters apart. It also fails the lightness band (all 8 sit at L 0.68–0.84).

### 5.2 The consequence — restructure the encoding

| Channel | Encodes | Rationale |
|---|---|---|
| **Line / node colour** | **the STOCK** (≤8 highlighted at once) | It's what the user tracks. Fixes DEFECT 1. |
| **Cluster** | a **dot** beside the label + the **hull** the node sits in | Secondary channel; stops competing for hue |
| **Signal colour** | **UP/DOWN only** | Reserved. Never decorative. |

So you need **two** palettes:
- **Series palette** — 8 hues, for the ≤8 highlighted stocks (`TOP_N = 8`).
- **Cluster palette** — ≤6 hues, safe on colour alone; used for hulls + dots, **never** for lines.

### 5.3 Validated values

**Ground (both directions):** `#0b0f19` — deep ink, blue-violet bias. **Not** `zinc`/neutral gray
(that is the template fingerprint).

**Cluster palette (n=6, worst all-pairs CVD ΔE 14.7 — PASSES all four checks):**
```
#f10000  #00af6e  #388df1  #ec00e6  #f200ac  #f20089
```
⚠️ Those last three are too close *perceptually* for comfort even though they pass. **Re-run the
search yourself** (§5.4) and pick a set you're happy with — the constraint is ΔE ≥ 12 all-pairs,
L ∈ [0.48,0.67], C ≥ 0.10, contrast ≥ 3:1 vs `#0b0f19`. **If Louvain returns >6 communities,
merge the smallest into "Other" — do not generate a 7th hue.**

**Series palette (8 hues):** must also pass the validator. Generate it the same way. It may use a
wider lightness range than the cluster palette *because the lines are direct-labelled* (secondary
encoding present → the 8–12 ΔE floor band is legal).

**Status colours (reserved, never reused as a series):**
`up` = a green in-band · `down` = a red in-band · `warn` = amber. Ship with an **icon or label**,
never colour alone.

### 5.4 How to regenerate a palette (do this, don't guess)

```js
// OKLCH -> sRGB hex, then feed the validator. Search hues; hold L in the band.
// Anchors in TRUE OKLCH degrees (NOT HSL):
//   ~25 vermilion · ~85 amber · ~150 green · ~200 cyan · ~260 blue · ~305 violet · ~350 rose
// Gate HARD on: worst ALL-PAIRS CVD ΔE >= 12 (pairs:'all', not 'adjacent').
// 'adjacent' is for legends; a NETWORK shows every cluster at once, so all-pairs is the right test.
```
Import `validate()` from the dataviz skill's `scripts/validate_palette.js`. On Windows, run the
script *from inside that directory* (ESM needs a `file://` URL for absolute imports).

### 5.5 Contrast floor
Every text/background pair ≥ **4.5:1** (AA). Retire `--mute-2` as a *text* colour — keep it for
borders only. `.gs-chip.on` must use `background: var(--accent); color: #02141a` (= 11.8:1), which
is the pairing `.btn-primary` already uses.

---

## 6. TYPE — one scale, seven steps

Replace all 37 sizes. Put these in `:root` and **use only these**.

```css
:root {
  --text-2xs: 0.6875rem;  /* 11px — micro-labels, gutter data */
  --text-xs:  0.75rem;    /* 12px — helper text (NOT 10.5px) */
  --text-sm:  0.8125rem;  /* 13px — captions, table cells */
  --text-md:  0.9375rem;  /* 15px — body */
  --text-lg:  1.25rem;    /* 20px — card titles */
  --text-xl:  1.75rem;    /* 28px — section headings */
  --text-2xl: clamp(2.5rem, 6vw, 5rem);  /* display */
}
```

**Rules (both directions):**
- `font-variant-numeric: tabular-nums slashed-zero` **globally**. To a quant, a slashed zero is a
  correctness signal, and tabular figures stop live numbers from jittering.
- **Mono = tabular figures, tickers, timestamps, identifiers. NOTHING else.** No mono eyebrows,
  no mono footers, no mono legal text.
- Line-height 1.5–1.65 for body; ≤1.05 for display.
- Measure: 60–75ch body, 35–60ch on mobile.
- `h1,h2 { text-wrap: balance }` · `p { text-wrap: pretty }`.
- **Never animate a price.** Animate aggregates (score, centrality, counts). A price mid-tween is
  a *wrong price on screen* — in a trading context that is a defect, not a delight. Prices flash
  (200ms background tint), then change instantly.

The two directions choose **different typefaces** — see their own files.

---

## 7. SPACE & MOTION tokens

```css
:root {
  /* 8pt scale — replaces 64 ad-hoc paddings */
  --space-1: 4px;  --space-2: 8px;   --space-3: 16px;
  --space-4: 24px; --space-5: 40px;  --space-6: 64px;

  /* motion — ONE rhythm for the whole product */
  --dur-fast: 140ms;   /* state change: hover, press */
  --dur-base: 240ms;   /* micro-interaction */
  --dur-slow: 420ms;   /* transition, morph */
  --ease-out:  cubic-bezier(.16, 1, .3, 1);     /* entering — settles, doesn't bounce */
  --ease-in:   cubic-bezier(.4, 0, 1, 1);       /* exiting */
}
```
- Exit animations ≈ 60–70% of enter duration.
- Animate **`transform` and `opacity`** (and registered custom props). Never `width`/`height`/`top`.
- **Stagger 30–50ms**, never 100ms.
- Animate **1–2 key elements per view**, not everything.

---

## 8. THE SIGNATURE — the temporal morph engine

**This is the product. Everything else stays quiet around it.**

### 8.1 The rule
> **Never re-lay-out the graph from scratch between time steps.**

A naïve rebuild makes every node teleport → the user learns nothing → it's a lava lamp. Instead:

1. **Preserve node identity** (tickers are stable — trivial).
2. **Warm-start**: seed step *t+1*'s simulation with step *t*'s final positions.
3. **Low reheat**: `alpha(0.15)`, **not** `alpha(1)`. The layout *relaxes* into the new structure.
4. **Anchor drift**: a weak force pulling each node toward its **previous** position, with strength
   ∝ its **stability** (1 − normalised |Δcentrality|).

The payoff, and it is the whole value proposition:

> **Stable stocks barely move. Stocks whose structural role actually changed MIGRATE VISIBLY.
> Displacement becomes information.**

*"MARUTI just walked out of the auto cluster into financials"* becomes something the user
**watches happen**. Nothing else in fintech does this.

```js
function stepTo(nextGraph) {
  const prev = new Map(sim.nodes().map(n => [n.id, { x: n.x, y: n.y }]));
  const nodes = nextGraph.nodes.map(n => {
    const p = prev.get(n.id);
    return { ...n,
      x: p?.x ?? cx + (Math.random()-.5)*40,   // new listings born near centre
      y: p?.y ?? cy + (Math.random()-.5)*40,
      px: p?.x, py: p?.y };                    // anchor targets
  });
  sim.nodes(nodes)
     .force('anchor', anchorForce(nodes))
     .force('link', forceLink(nextGraph.links).id(d => d.id)
              .distance(l => 30 + 90*(1 - Math.abs(l.rho)))   // strong corr = short edge
              .strength(l => Math.abs(l.rho)))
     .alpha(0.15).alphaDecay(0.06).restart();                 // ~40 ticks, settles < 700ms
}

function anchorForce(nodes) {
  let ns;
  const f = (alpha) => {
    for (const n of ns) {
      if (n.px == null) continue;
      const k = 0.08 * alpha * n.stability;   // stability in [0,1]
      n.vx += (n.px - n.x) * k;
      n.vy += (n.py - n.y) * k;
    }
  };
  f.initialize = (_) => { ns = _; };
  return f;
}
```
Cost: ~0.4 ms/tick at n=500. Negligible.

### 8.2 Supporting motion (meaningful only — each states what it ENCODES)

**Hop-by-hop hover trace** — hover a node; its influence neighbourhood lights up **BFS by hop**
(~70ms/hop) rather than all at once.
*Encodes:* embeddedness. A tight cluster flashes at once; a **bridge** lights up in slow, thin
chains. **Centrality made experiential.** ~30 lines, <0.1ms.

**Breathing community hulls** — a soft hull around each Louvain community; **hull padding ∝
(1 − coherence)**.
*Encodes:* community cohesion. A sector tightening **contracts and saturates**; one about to split
**swells and desaturates**. Makes birth/death/merge/split legible.
Convex hull → inflate along normals → 2× Chaikin → Catmull-Rom to bezier. Recompute every 3rd
frame. On split: **cross-fade two hulls** while the sim separates the members — do NOT attempt
true path morphing (different vertex counts → garbage).

**Edge-flow particles** — **speed ∝ |ρ|**; colour by **sign** of ρ.
⚠️ **UNDIRECTED ONLY** (see §1). Negative-ρ edges run the other way — an honest, beautiful visual
for a hedge pair. Gate on `|ρ| > 0.35`. `globalCompositeOperation = 'lighter'`. ~0.6ms.

**3-pass additive edge glow** — draw the same edges 3× (wide/faint → narrow/bright) with
`'lighter'`. Real luminous depth, no shader. ~1.2ms.

**Fit-to-content zoom, alpha decay** — see DEFECT 2 and 3.

### 8.3 Canvas performance rules
- **Batch by style.** One `beginPath()` per colour/width *bucket* (use `Path2D`), not per edge.
  1,494 begin/stroke pairs → ~6.
- **Text is the bottleneck**, not the graph (~9ms for 500 labels). **Cull labels** to top-k by
  centrality + hover/selection. Never draw 49 labels at once.
- **Clamp DPR to 2.**
- **Two layers:** static (edges, hulls) redrawn only when the sim moves; interactive (hover ring,
  particles) every frame.
- **Pause when off-screen** (`IntersectionObserver`) — `HeroCanvas.tsx` already does this
  correctly; copy its discipline.

### 8.4 `@property` as the design system's spine

`@property` is **Baseline** (Chrome 85+, Safari 16.4+, Firefox 128+). Ship it unconditionally.
It lets **data magnitude drive visual intensity declaratively**:

```css
@property --conf { syntax: "<number>"; inherits: true;  initial-value: 0; }
@property --glow { syntax: "<length>"; inherits: false; initial-value: 0px; }

.node-chip {
  --glow: calc(var(--conf) * 18px);
  box-shadow: 0 0 var(--glow) color-mix(in oklch, var(--sig) calc(var(--conf) * 70%), transparent);
  transition: --conf var(--dur-slow) var(--ease-out);   /* the DATA VALUE tweens */
}
```
Set `--conf` / `--centrality` once from React; CSS derives glow, weight, hue. **Data *is* the
theme** — no framer-motion, no springs, no re-render.

⚠️ Registered props that feed `background`/`box-shadow` trigger **paint** per frame. A handful of
elements: free. **200 rows all pulsing: don't.**

---

## 9. DELETE (do not soften — delete)

| File / thing | Why |
|---|---|
| `components/ScrollReveal.tsx` + all `.reveal` / `.js-ready` CSS | DEFECT 4 — two reveal systems |
| `components/ToolCursorGlow.tsx` | Binds to **0 elements** |
| `components/NetworkGraph.tsx` (166 lines) | Imported by nothing |
| `components/TerminalTicker.tsx` (56) | Imported by nothing |
| `components/RunStamp.tsx` (20) | Imported by nothing |
| `components/HeroCanvas.tsx` | **Fake nodes.** Well-written, but it's a lie. Keep its *discipline*, delete the file. |
| `components/CountUp.tsx` | Count-up-on-scroll is a top-5 AI-tell. (Exemplary code; wrong idea.) |
| ~120 lines of dead CSS | `.terminal`, `.term-*`, `.tools`, `.tool`, `.tool-num`, `.tool-ico`, `.tool-link`, `.caps`, `.cap*`, `.link-arrow`, `.muted-h`, `.faq-more`, `.gs-side`, `.gs-graph-*` |
| All **69** duplicated selectors | `.hero`, `.hero-sub`, `.live-strip`, `.live-cell`, `.live-value`, `.coverage`, `.cov*`, `.gs-params-grid`, `.gs-field` are each declared **twice** |
| `.hero-h-accent` gradient headline | Anti-pattern |
| `.glow`, `.btn-glow` | Anti-pattern |
| The fake macOS traffic-light terminal | Cosplay. You're a *real* technical product. |

That's roughly **−25% of the stylesheet**.

---

## 10. ANTI-PATTERNS — never ship these

These are the exact things that make a dark dev-tool site read as AI-generated. The previous
design contained **almost all of them**.

**Colour/surface:** raw Tailwind `zinc`/`neutral`/`slate` · purple/indigo radial glow behind the
hero · aurora/mesh-gradient blobs · glassmorphism (`backdrop-blur` + `border-white/10`) ·
spotlight cards · **gradient-filled headline text (`bg-clip-text`)** · two accent colours.

**Layout:** the 6-card bento with icon + 3-word heading + 1 line of copy · grayscale "Trusted by"
logo strip · dot-grid background · `rounded-2xl` on everything (**go to 0px**) · drop shadows for
hierarchy (use **rules and overlap**) · fake terminal windows · screenshots floated in 3D
perspective.

**Motion:** framer-motion `fade-up, y:20, duration .6, stagger .1` on every section (this is the
motion equivalent of Lorem Ipsum) · cursor-spotlight card borders · animated "beam" lines ·
**number count-up on scroll** · typewriter text · a rotating 3D globe with arcs (*especially* bad
here — it implies **geography**; your product is **topology**).

**Type:** Inter + `tracking-tight` + `font-semibold` · Lucide icons (draw 6 technical glyphs
yourself on the grid instead).

**The meta anti-pattern:** *any effect that could be applied to a company selling something else.*
A purple glow makes sense for anyone, which is why it makes sense for no one. The temporal morph,
the hop-trace, the breathing hulls — those only make sense for **you**.

---

## 11. Reference sites (study these, don't copy them)

- **Fey (fey.com)** — the closest analogue. Panels *assemble* (translate+clip+opacity, staggered
  ~30ms) rather than fade. Charts are the decoration. No illustration anywhere.
- **Linear (linear.app)** — `#08090a` (green-blue bias, not gray), weight band **400–510** only,
  and an internal rule *banning* atmospheric gradients and spotlight cards. **What people copy
  from Linear is the stuff Linear itself banned.**
- **Teenage Engineering** — the "instrument faceplate" north star. Silkscreen micro-labels,
  hairline rules, extreme restraint, one accent.
- **Val Town** — deliberately anti-designed; distinctive by *refusing* the SaaS vocabulary.
- **Modal** — engineering-schematic diagrams instead of icon+heading feature cards.
- **Nomic Atlas / Connected Papers** — the hero is a **viewport into the real artifact**, interactive
  before you sign up.
- **MotherDuck** — a *data warehouse* that went warm-paper and hand-drawn in a category where
  everything is black. Instantly recognisable. (A provocation for Direction B.)

**Do NOT chase Awwwards-style full-WebGL 3D worlds.** Different sport, months of work, and for a
research platform it actively *undermines* credibility.

---

## 12. Verification — do this before claiming done

1. **Palette:** `node scripts/validate_palette.js "<your hexes>" --mode dark --surface "#0b0f19"`
   → must PASS all four checks. **Screenshot the report.**
2. **Contrast:** every text/bg pair ≥ 4.5:1. Check `.gs-hint` and `.gs-chip.on` specifically.
3. **Playwright:** navigate to `/`, `/network-graph`, `/dashboard/graph-stats`; take a **full-page**
   screenshot of each. *If a screenshot times out on "element is not stable", your canvas never
   cooled — DEFECT 2 is back.*
4. **A full-page screenshot must not be blank.** (Regression test for DEFECT 4.)
5. **Reduced motion:** emulate `prefers-reduced-motion: reduce` and confirm the canvas renders a
   **static frame** and no positional motion occurs.
6. **Chart:** run the tool, confirm **8 highlighted series render in 8 distinct colours**.
7. `npx tsc --noEmit` and `npm run build` both clean.
8. **No secrets in the client bundle:** `grep -rE 'slr_key_|BEGIN PRIVATE KEY' .next/static` → empty.
9. Responsive at **375 / 768 / 1024 / 1440**. No horizontal scroll.
10. Visible keyboard focus everywhere.

---

## 13. Build order (both directions)

**Phase 1 — stop the bleeding** *(changes perceived quality more than everything else combined)*
1. Chart: colour by **series**, not cluster (DEFECT 1)
2. `GraphCanvas`: **alpha decay** (DEFECT 2)
3. `GraphCanvas`: **fit-to-content zoom** (DEFECT 3)
4. Delete `ScrollReveal` + `ToolCursorGlow` (DEFECT 4)
5. Fix the Pricing copy (DEFECT 5)

**Phase 2 — the system**
6. `--text-*` / `--space-*` scales; migrate 37 sizes → 7, 64 paddings → 6
7. Merge the 69 duplicate selectors; delete dead CSS + the 3 dead components
8. Fix both contrast failures; unify `.gs-chip` / `.gs-tab` into one control

**Phase 3 — the signature**
9. Temporal morph engine (§8.1) + hop-by-hop hover trace + 3-pass additive edge glow
10. Breathing hulls driven by real community coherence
11. `@property` spine (§8.4)

**Phase 4 — the art direction**
12. Apply your direction's palette, type, layout, and signature treatment (see your own file)

---

## 14. Working agreement

- **Verify, don't assert.** Measure it, screenshot it, run the validator. The audit that produced
  this document found bugs by *driving the site*, not by reading it.
- **Honesty over polish.** If a number isn't real, don't show it. If a feature doesn't exist,
  don't sell it. This is the brand.
- **One loud thing.** Spend the boldness on the signature. Everything else is quiet and
  disciplined. *Before you leave the house, take one accessory off.*
</content>
</invoke>
