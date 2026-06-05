# Design System: triagekit

> Single source of truth for generating triagekit screens (in Stitch or by hand).
> triagekit is a **dense, backend-free triage cockpit** — a tool operators stare at to
> decide what to fix first. It is software, not a landing page. Every rule below favors
> legibility-under-density and calm authority over decoration.

---

## 1. Visual Theme & Atmosphere

A **dark-first operations cockpit** — quiet, high-contrast, and information-dense without
feeling cramped. The mood is a well-run NOC at 2am: matte charcoal surfaces, a single cool
accent that only appears where action lives, and a disciplined semantic color ramp that
lets you read priority at a glance. Restraint is the aesthetic — the data is the
decoration. Layouts are confidently asymmetric (a fixed command rail beside a wide content
field), motion is present but weighty and brief, never theatrical.

- **Density:** 8 / 10 — Cockpit Dense. Tables, stat rows, and detail panels pack tightly;
  whitespace is earned, not sprayed. Per the high-density override, **all numerals render
  in monospace.**
- **Variance:** 5 / 10 — Offset Asymmetric. Structure comes from an off-center rail +
  content split, not from chaotic placement. Dashboards reward predictability inside an
  asymmetric frame.
- **Motion:** 5 / 10 — Fluid, weighty, restrained. Spring physics on interaction, shimmer
  on load, staggered row reveals. No looping spectacle.

Light mode exists as a first-class peer (operators in bright rooms), but dark is primary.

---

## 2. Color Palette & Roles

**One accent only. Saturation < 80%. The accent (Kelp Teal) deliberately sits outside the
red→green priority ramp so "actionable" never reads as "severe."** No blue (avoids the
GitHub/AI-neon default), no purple, no neon glow, no pure black.

### Dark (primary)
- **Void Zinc** (`#0A0A0B`) — Primary canvas. Off-black, never `#000000`.
- **Carbon Panel** (`#141417`) — Raised surfaces: rails, drawer, stat tiles, row hover.
- **Slate Panel** (`#1C1C21`) — Secondary fill: inputs, inset blocks, table header band.
- **Graphite Line** (`rgba(255,255,255,0.08)`) — Hairline borders & row dividers (1px).
- **Bone White** (`#ECECEE`) — Primary text and key numerals.
- **Ash Gray** (`#8A8A92`) — Secondary text, labels, metadata, column headers.
- **Kelp Teal** (`#2E9E96`) — THE accent. Primary CTA fill, focus rings, active tab
  underline, links. Saturation ~60%.
- **On-Accent Ink** (`#0A0A0B`) — Text/icons on a Kelp Teal fill.

### Light (peer)
- **Paper** (`#FAFAF9`) — Primary canvas.
- **Pure Surface** (`#FFFFFF`) — Raised surfaces.
- **Mist Panel** (`#F1F1EF`) — Secondary fill.
- **Ink Line** (`rgba(9,9,11,0.10)`) — Hairline borders & dividers.
- **Charcoal Ink** (`#1A1A1E`) — Primary text.
- **Stone Gray** (`#6B6B73`) — Secondary text/metadata.
- **Deep Kelp** (`#1F7E77`) — Accent (darkened for AA contrast on light).
- **On-Accent** (`#FFFFFF`) — Text on accent fill.

### Semantic priority ramp (both themes — functional, NOT brand)
Muted, premium, distinct from the teal accent. Used for tier pills and severity text.
- **P0 / Critical — Crimson** (`#D6504A`)
- **P1 / High — Ember** (`#C9783F`)
- **P2 / Medium — Amber** (`#C2A23E`)
- **P3 / Low — Sage** (`#5E9E6A`)
- **Inert / Unknown — Ash** (`#6E7681`)

Tier pills fill with the ramp color + On-Accent-dark text. Severity in tables is colored
text only (no fill) to keep the grid quiet.

---

## 3. Typography Rules

Dashboard mandate: **sans pairing + monospace numerals.** No serifs anywhere.

- **Display / Headings:** `Satoshi` — track-tight (`-0.02em`), weight-driven hierarchy
  (600/700), controlled scale. Headings communicate by weight and color, not size.
- **Body / UI:** `Satoshi` — 400/500, relaxed leading (1.5), secondary copy in Ash Gray,
  prose capped at 65ch.
- **Mono / Numerals & Metadata:** `JetBrains Mono` — **mandatory for every number**
  (signal, score, CVSS, counts, percentages), plus IDs, timestamps, package versions, and
  tier labels. Tabular figures so columns align.
- **Scale (clamp-driven):**
  - App title / page H1: `clamp(1.25rem, 1rem + 1vw, 1.625rem)` (20–26px), weight 700
  - Section / panel H2: `1.125rem` (18px), weight 600
  - Body / table cell: `0.875rem` (14px)
  - Label / column header: `0.75rem` (12px), Ash Gray, `0.04em` tracking, uppercase
  - Stat value: `1.5rem` (24px) JetBrains Mono, weight 600
- **Banned:** `Inter`, system-default stacks for chrome, ALL serifs (`Times`, `Georgia`,
  `Garamond`), and any decorative display face.

---

## 4. Entry & Empty States (the "first screen")

triagekit has no marketing hero. The first impression is the **command bar + an inviting,
composed empty state** — these must feel intentional, never like an unstyled void.

- **Command bar (appbar):** Left-aligned brand/title in Satoshi 700, then the runtime
  inputs (org, repos, token) as a tidy inline cluster, then a single primary action
  (`Load`). Asymmetric, left-weighted — never centered.
- **Pre-load empty state:** A composed prompt, not a sentence. A muted outline glyph
  (SVG, monochrome Ash) + one Satoshi line ("Enter an org and repos, paste a token, then
  Load") + the accent CTA. Occupies its own centered spatial zone within the content field.
- **Zero-results state:** Composed and affirmative — a calm checkmark glyph + "No open
  items for these targets." **No emoji.** (Kills the existing 🎉.)
- **CTA restraint:** Exactly one primary action visible at a time. No secondary "learn
  more" links. No "scroll to explore", chevrons, or filler.

---

## 5. Component Stylings

- **Buttons:** Flat. Primary = Kelp Teal fill + On-Accent ink, weight 600. Secondary =
  ghost (transparent fill, Graphite Line border, Bone text). Tactile feedback: `-1px`
  translate-y on `:active`. Focus = 2px Kelp Teal ring (offset 2px). **No outer glow, no
  gradient, no custom cursor.** Min 44px tap target.
- **View switch (tabs):** Text tabs in Ash Gray; active tab = Bone text with a 2px Kelp
  Teal underline. **Upcoming** sources render as a tab with a small mono `upcoming` chip
  (Slate Panel fill, Ash text) and are visibly inert until activated.
- **Tables (the core surface):** Borderless cells separated by Graphite Line `border-top`
  dividers — **no card grid, no zebra stripe.** Sticky header band in Slate Panel with
  uppercase Ash labels. Row hover = Carbon Panel fill, cursor pointer. Numeric columns
  (signal/score) right-adjusted, JetBrains Mono, tabular. Whole row is the click target →
  opens the detail drawer.
- **Tier & severity:** Tier = filled pill (ramp color, 999px radius, 12px mono, On-Accent
  ink). Severity = colored ramp text, no fill.
- **Stat tiles:** A horizontal row of compact tiles (Carbon Panel, Graphite Line, 12px
  radius). Mono value (24px) over an Ash uppercase label. Used sparingly — totals and
  P0/P1 counts only. In the densest views, prefer a single inline summary line over tiles.
- **Cards:** Avoid. Elevation is reserved for the **drawer** alone. Everywhere else use
  border-top dividers + negative space (per high-density doctrine).
- **Detail drawer:** Right-anchored panel, `min(440px, 92vw)`, Carbon Panel fill, 1px
  Graphite left border. Shadow is **tinted to canvas** — `-8px 0 32px rgba(10,10,11,0.45)`
  (never pure black). Definition list: Ash `dt`, Bone `dd`, mono for versions/scores.
  Single `Close` action.
- **Inputs:** Slate Panel fill, Graphite Line border, 8px radius, label above (Ash, 12px),
  helper/error below. Error text in Crimson. Focus = Kelp Teal ring. No floating labels.
  The token input is `type=password`, visibly distinct, with a "stored in this tab only"
  helper.
- **Loading:** **Skeleton shimmer** matching exact table dimensions — header band + 6–8
  ghost rows with shimmering cell blocks. **No circular spinner, no "Loading…" text.**
- **Warnings (partial failure):** Inline Amber-bordered block listing per-target failures;
  never blanks the table — degraded rows coexist with loaded data.

---

## 6. Layout Principles

- **Shell:** Fixed top command bar; a left-aligned view switch; a wide, max-width-contained
  content field (`max-width: 1400px`) with generous internal padding (24–32px). Asymmetric,
  left-weighted — centered page layouts are banned at this variance.
- **Grid over flex math:** CSS Grid for the shell and stat rows. Never `calc()` percentage
  hacks.
- **No overlap:** Every element owns a clean spatial zone. The drawer overlays via its own
  fixed layer with a scrim — content beneath does not visually collide.
- **Full-height:** Use `min-h-[100dvh]` for the shell. **Never `h-screen`** (iOS Safari
  jump).
- **Density discipline:** Tables breathe via row padding (8–10px vertical) and dividers,
  not via cards or shadows.

---

## 7. Responsive Rules

- **< 768px collapse:** The org/repos/token cluster stacks vertically; stat tiles become a
  2-up grid then 1-up; the table switches to stacked record rows (label: value pairs in
  mono) rather than a horizontally scrolling grid.
- **No horizontal scroll, ever** — overflow on mobile is a critical failure.
- **Drawer on mobile:** Becomes a full-width bottom sheet (`max-h: 88dvh`), slide-up.
- **Typography:** Headlines via `clamp()`; body min `0.875rem` (14px); mono numerals never
  shrink below 13px (legibility).
- **Touch targets:** All controls ≥ 44px. Whole table rows remain tappable.
- **Spacing:** Section gaps scale `clamp(1.5rem, 5vw, 2.5rem)`.

---

## 8. Motion & Interaction

- **Spring physics default:** `stiffness: 100, damping: 20` for drawer slide, tab
  underline, and hover lifts. **No linear easing.**
- **Staggered reveals:** Table rows cascade in on load (≈24ms stagger, brief) — never an
  instant dump. Cap the cascade so large lists don't feel slow.
- **Load shimmer:** Skeleton blocks use a left-to-right shimmer sweep (opacity/transform
  only).
- **Restraint:** No perpetual ambient loops on a data tool — motion serves state change
  (load, open, switch), then rests. The cockpit should feel still when you're reading.
- **Performance:** Animate **only** `transform` and `opacity`. Never `top/left/width/
  height`. Any grain/scrim on a fixed pseudo-element only.

---

## 9. Anti-Patterns (NEVER DO)

- **No emojis anywhere** (remove the existing 🎉 zero-state).
- No `Inter`; no system-default font stack for app chrome.
- No serif fonts of any kind (this is a dashboard).
- No pure black (`#000000`) — Void Zinc `#0A0A0B` is the floor.
- No blue or purple accent (avoids the GitHub/AI-neon default); no neon or outer-glow
  shadows; shadows are always tinted to the canvas hue.
- More than one accent color, or any accent above 80% saturation.
- Gradient text on headings; gradient fills on buttons.
- Custom mouse cursors.
- Overlapping/absolutely-stacked content (the drawer is the only intentional overlay).
- The generic "3 equal cards in a row" feature layout; card grids for tabular data.
- Circular/spinner loaders, or bare "Loading…" text — skeletons only.
- Centered page/hero layouts at this variance.
- Generic placeholder identities ("John Doe", "Acme", "Nexus") and fake round numbers
  (`99.99%`, `50%`).
- AI copywriting clichés ("Elevate", "Seamless", "Unleash", "Next-Gen").
- Filler UI text: "Scroll to explore", "Swipe down", scroll arrows, bouncing chevrons.
- Broken Unsplash links — use `picsum.photos` or inline SVG for any placeholder imagery.
```
