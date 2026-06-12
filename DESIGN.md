---
name: triagekit
description: Backend-free repo triage dashboard. One HTML file.
colors:
  void: "#0A0A0B"
  carbon: "#141417"
  slate: "#1C1C21"
  bone: "#ECECEE"
  ash: "#8A8A92"
  kelp-teal: "#2E9E96"
  kelp-teal-light: "#1F7E77"
  on-accent: "#0A0A0B"
  p0-critical: "#D6504A"
  p1-high: "#C9783F"
  p2-medium: "#C2A23E"
  p3-low: "#5E9E6A"
  inert: "#6E7681"
  line: "rgba(255,255,255,0.08)"
  line-strong: "rgba(255,255,255,0.14)"
typography:
  display:
    fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.3rem, 1rem + 1.1vw, 1.7rem)"
    fontWeight: 640
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.005em"
  label:
    fontFamily: "'JetBrains Mono', ui-monospace, 'SF Mono', monospace"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.04em"
  mono:
    fontFamily: "'JetBrains Mono', ui-monospace, 'SF Mono', monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "14px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "14px"
  lg: "18px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.kelp-teal}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.md}"
    padding: "8px 18px"
  button-primary-hover:
    backgroundColor: "{colors.kelp-teal}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.md}"
    padding: "8px 18px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.bone}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  button-ghost-hover:
    backgroundColor: "{colors.carbon}"
    textColor: "{colors.bone}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  status-chip:
    backgroundColor: "{colors.slate}"
    textColor: "{colors.bone}"
    rounded: "{rounded.pill}"
    padding: "6px 12px 6px 11px"
  tier-p0:
    backgroundColor: "{colors.p0-critical}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    padding: "2px 9px"
  tier-p1:
    backgroundColor: "{colors.p1-high}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    padding: "2px 9px"
  tier-p2:
    backgroundColor: "{colors.p2-medium}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    padding: "2px 9px"
  tier-p3:
    backgroundColor: "{colors.p3-low}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    padding: "2px 9px"
  input-field:
    backgroundColor: "{colors.slate}"
    textColor: "{colors.bone}"
    rounded: "{rounded.md}"
    padding: "9px 11px"
  nav-rail-item:
    backgroundColor: "transparent"
    textColor: "{colors.ash}"
    rounded: "{rounded.md}"
    padding: "8px 10px"
  nav-rail-item-active:
    backgroundColor: "{colors.carbon}"
    textColor: "{colors.bone}"
    rounded: "{rounded.md}"
    padding: "8px 10px"
---

# Design System: triagekit

## 1. Overview

**Creative North Star: "The Operator's Cockpit"**

triagekit's visual system is built around the premise that a triage session is an act of focused, high-stakes decision-making. The interface is a flight deck: every element on screen exists to help the operator locate, assess, and act. Ambient decoration — gradients that don't carry information, cards that add hierarchy without adding meaning, transitions that animate for their own sake — is not a design choice. It's an error.

The palette is dark-native by design, not by convention. Void Zinc (#0A0A0B) is the canvas because it forces every piece of information to be the thing that provides its own light. The single accent — Kelp Teal (#2E9E96) — is reserved for interactive affordances and the "healthy" state. It is rare on-screen. Its rarity is the signal. The P0–P3 priority ramp (Critical Red → High Orange → Medium Amber → Low Green) is the other half of the chromatic vocabulary: purposeful, unsentimental, calibrated so severity is legible at a glance even in peripheral vision.

Typography is dual-register. Space Grotesk carries the interface's navigation, labels, and body copy — its variable weight axis allows tight tonal control from 300 (explanatory prose) to 640 (brand mark) without switching families. JetBrains Mono carries all numeric and identifier content: scores, handles, repository names, tier labels. The distinction is functional, not decorative. Monospace tabular numerals prevent reflow when scanning ranked lists. The brain reads one register as "UI" and the other as "data", without being told.

The grain overlay (fractal SVG noise at 3.5% opacity, overlay blend) breaks the flat-dark sterility that makes dense dark-mode interfaces feel depthless. It is the single texture in the system. Everything else earns its visual weight through color and spacing, not texture.

**Key Characteristics:**
- Dark-first, light-capable: `[data-theme="light"]` rebalances the full token ramp; the architecture never assumes dark
- Dual-register typography: Space Grotesk for interface language, JetBrains Mono for data identity
- Single accent: Kelp Teal used only for affordances and success state; rarity is the signal
- Purposeful priority ramp: P0–P3 colors calibrated for glanceability, not brand aesthetics
- Grain over glass: one texture layer; no blur, no glassmorphism, no gradient overlays
- Responsive and precise: spring easing (cubic-bezier(.22,1,.36,1)) on interactive elements; reduced motion always handled

## 2. Colors: The Void–Kelp Palette

A controlled, dark-native palette with one accent and a four-step priority ramp. Every color earns its place by carrying information.

### Primary

- **Kelp Teal** (#2E9E96 dark / #1F7E77 light): The single interactive accent. Used for primary buttons, focus rings, active nav states, success chips, and the healthy status indicator. Appears on ≤10% of any given screen. In light mode the value darkens to maintain contrast — the same hue, not a tint substitution.

### Neutral

- **Void Zinc** (#0A0A0B): The canvas. Background of the body and the entire app shell. The darkest surface — nothing sits below it.
- **Near-Black** (#141417 `carbon`): The primary card/panel surface. Drawers, settings panel, table-row hover, sticky table headers.
- **Raised Zinc** (#1C1C21 `slate`): Secondary surface. Input backgrounds, sidebar active states, section backgrounds within panels. Also the `[data-theme="light"]` canvas equivalent (#FAFAF9) swaps in here.
- **Bone** (#ECECEE `fg`): Primary text. All readable interface copy. Against Void Zinc (#0A0A0B), this achieves ~18:1 contrast.
- **Ash** (#8A8A92 `muted`): Secondary text, labels, metadata, placeholder text. Used only where the content is genuinely secondary — not where space or visual quietness is desired.
- **Inert** (#6E7681): Disabled states and the "no status" dot in status chips. Distinct from Ash so disabled and secondary don't read the same.

### Priority Ramp (Semantic)

- **Critical Red** (#D6504A `--p0`): P0 tier — CVE critical, severity critical. Never used decoratively.
- **High Orange** (#C9783F `--p1`): P1 tier — high severity, age-breached items.
- **Medium Amber** (#C2A23E `--p2`): P2 tier — medium severity, unsaved-changes indicator dot.
- **Low Green** (#5E9E6A `--p3`): P3 tier — low severity, CI pass state.

### Named Rules

**The One Accent Rule.** Kelp Teal appears on interactive affordances (primary buttons, focus rings, active nav, links) and on positive-state indicators (healthy status chip, selected chips). It does not appear on decorative borders, section headings, or anything that isn't actionable or explicitly "OK". Its rarity is the brand signal.

**The Ramp Is Data Rule.** The P0–P3 colors are semantic, not stylistic. They must never be used outside their tier context. P0 red is not "an error color" — it is specifically "a P0-priority item." Using it for a generic form error blurs the system's meaning.

**The Ash Floor Rule.** Never use Ash (#8A8A92) for body text that must be read, only for text that is genuinely secondary. Verify contrast ≥ 4.5:1 against the surface it sits on. Against Raised Zinc (#1C1C21), Ash achieves ~4.7:1 — it passes but has no margin; prefer Bone (#ECECEE) for anything the user needs to read.

## 3. Typography: Space Grotesk + JetBrains Mono

**Display Font:** Space Grotesk (variable, 300–700 weight axis, Latin subset, self-hosted)
**Data/Code Font:** JetBrains Mono (400 and 600 static weights, self-hosted)

**Character:** Space Grotesk's variable axis gives the interface the ability to signal hierarchy through weight alone — no font-family switch needed for navigation, body, or display contexts. JetBrains Mono's tabular numerals keep score columns scannable at any width. The pairing is functional first: the brain reads "interface" and "data" as distinct registers without conscious parsing.

Both fonts are inlined as base64 woff2 at build time. The `data:` font-src CSP allowance is the only non-none font source. System fallbacks (`ui-sans-serif`, `ui-monospace`) exist but are never the intended experience.

### Hierarchy

- **Display** (640 weight, clamp(1.3rem, 1rem + 1.1vw, 1.7rem), lh 1.2, ls -0.035em): Brand mark / logo type only. The `triagekit` wordmark in the command bar. Not reused for page headings.
- **Headline** (600 weight, 1.125rem / 18px, lh 1.4, ls -0.01em): Drawer titles, panel headings, section names. Space Grotesk.
- **Body** (400 weight, 14px, lh 1.5, ls -0.005em): All interface prose — table cells, metadata, helper text, panel body copy. The base font-size is 14px, not 16px; the density is intentional.
- **Label** (600 weight, 11–12px, ls 0.04em, uppercase): Column headers, group labels, category kickers, `SOON` badges. JetBrains Mono. Used sparingly — uppercase monospace at this scale is high-contrast and must carry genuine structural meaning.
- **Mono** (400/600 weight, 13px, tabular-nums): Repository names, usernames, scores, tier labels, timestamps. JetBrains Mono. `font-variant-numeric: tabular-nums` is active on all numeric columns.

### Named Rules

**The Two-Register Rule.** Every rendering context is either "interface" (Space Grotesk) or "data identity" (JetBrains Mono). Never use Space Grotesk for scores, handles, or repo names. Never use JetBrains Mono for prose explanations or navigation labels. The distinction is load-bearing.

**The No-Upcase-Prose Rule.** Uppercase letter-spacing (`text-transform: uppercase` + `letter-spacing`) is reserved for label/category contexts (column headers, rail group labels, badge text). It is never applied to sentence-case text or anything over 13px. Upcase at body size reads as shouting; upcase in labels reads as structure.

## 4. Elevation

The system is flat by default. Background surfaces use the Void → Carbon → Slate tonal ramp to express layering; no shadow is needed to convey "this is a different surface." Shadows appear only when an element is physically floating above the canvas in a modal sense: drawers, popovers, dropdown panels. Never on cards, table rows, or navigation items at rest.

The single accent glow (`0 2px 14px color-mix(in srgb, var(--accent) 26%, transparent)`) is reserved for the primary button — a affordance cue, not a depth cue.

### Shadow Vocabulary

- **Float Shadow** (`-8px 0 32px rgba(10,10,11,0.45)` + `–1px 0 0 color-mix(in srgb, kelp-teal 22%, transparent)`): Right-edge drawers and the settings panel. The 1px accent-tinted left border is the "open" signal; the shadow grounds it in space.
- **Scrim** (`rgba(10,10,11,0.55)` at full viewport coverage): Behind open drawers and panels only. Not used for tooltips or inline popovers.
- **Accent Glow** (`0 2px 14px color-mix(in srgb, kelp-teal 26%, transparent)`, expands to 32% on hover): Primary button only. Hover state expands the spread.

### Named Rules

**The Float-Only Rule.** Shadows signal physical elevation above the canvas — something the user can reach out and grab. A card in a list is not elevated; it is adjacent. Never add `box-shadow` to cards, table rows, section containers, or nav items. The tonal ramp is the depth system; shadows are the exception.

## 5. Components

### Buttons

**Character:** Responsive and precise — small Y-axis transforms on press, spring easing on transitions. They behave like physical controls without theatrical animation.

- **Shape:** Gently rounded edges (8px radius)
- **Primary:** Kelp Teal fill (`#2E9E96`), Void text (`#0A0A0B`), accent glow shadow. Padding 8px 18px, min-height 38px. Hover: `brightness(1.06)` + expanded glow. Active: `translateY(1px)` + collapsed glow. Transition: 0.08s spring transform, 0.15s linear filter/shadow.
- **Ghost:** Transparent fill, Bone text, `line-strong` border. Hover: Carbon background fill. Same active transform. Used for secondary actions alongside a Primary.
- **Icon:** 38×38px square, `line-strong` border, Ash icon color. Hover: Bone icon + Carbon bg. Used for the theme toggle, refresh, settings trigger.
- **Disabled:** 40% opacity via `.act[disabled]` pattern. Cursor `not-allowed`. Never change the color to gray — preserve the shape so disabled is identifiable, not invisible.

### Status Chip

The merged health indicator in the command bar — provider mark + repository ID + a leading dot that carries the health state.

- **Default:** Raised Zinc bg, `line` border, pill radius, Ash dot (inert state)
- **Healthy (ok):** Kelp Teal dot with `0 0 0 3px` teal halo at 22% opacity
- **Warning:** Medium Amber dot

### Tier Badges

The P0–P3 tier indicators — the most frequently scanned element in the triage table.

- **Shape:** Pill (999px radius), mono 12px 600 weight, 0.02em letter-spacing, 2px 9px padding
- **P0:** Critical Red fill (`#D6504A`), Void text. **P1:** High Orange (`#C9783F`). **P2:** Medium Amber (`#C2A23E`). **P3:** Low Green (`#5E9E6A`).
- These are the only full-fill colored elements in the table. Everything else is text or icon.

### Inputs / Fields

- **Style:** Raised Zinc bg (`#1C1C21`), `line` border (1px, rgba(255,255,255,0.08)), 8px radius, Bone text, Ash placeholder
- **Focus:** Kelp Teal border + `0 0 0 2px color-mix(in srgb, teal 45%, transparent)` focus ring. No box-shadow on focus — only the ring.
- **Error:** P0 red border + P0 red ring at 40% opacity. `aria-invalid="true"` drives this.
- **Checkboxes/Radios:** Reset to native control sized to glyph, tinted to Kelp Teal via `accent-color`. Not full-width — they must never inherit the 40px min-height text-field treatment.

### Domain Rail Navigation

The 200px left sidebar — vertical Findings/Work group structure.

- **Default item:** Full-width, transparent bg, Ash text, 8px radius, 1px transparent border. Hover: Bone text.
- **Active item:** Carbon bg, Bone text, `line` border — one step above the void, just enough to be "selected."
- **Group labels:** JetBrains Mono, 10.5px, 0.09em tracking, uppercase, Ash. Non-interactive. Separated by a `line`-colored top border + 14px margin gap.
- **Upcoming items:** 60% opacity; `rail-soon` badge (mono 9.5px uppercase, pill).

### Drawer (Detail Panel)

The right-edge slide-over for PR/issue/alert detail.

- **Width:** `min(520px, 92vw)`. Full-viewport height. Spring-animated transform: `translateX(100%)` → `translateX(0)` in 0.32s.
- **Structure:** Fixed header (title + tier + provider ref + close), scrollable body, sticky footer (action buttons).
- **Close button:** 30×30px, 7px radius, `line-strong` border, Ash icon. Hover: Bone + Slate bg.
- **On mobile (≤768px):** Left and right inset both 0 — full-width panel.

### Settings Panel

Full-viewport surface with a two-column layout (190px fixed sidebar + flexible content, capped at 1440px centered).

- **Sidebar:** Vertical category list. Active category: Kelp Teal 12% bg tint + `inset 3px 0 0 var(--accent)` left-edge indicator. The inset box-shadow is the only box-shadow used on a navigation surface — it signals "selected tab" not "elevation."
- **Content:** `repeat(auto-fit, minmax(300px, 1fr))` grid. Wide sections opt out with `.wide`.
- **Section cards:** Raised Zinc bg, `line` border, 12px radius, 18px internal padding.

### Chips and Labels

- **Priority chip (`.chip`):** Mono 11px, Ash text, Raised Zinc bg, `line` border, pill
- **Badge (`.badge`):** Kelp Teal text at 100% + 14% bg tint + 40% border, mono 11px uppercase. Used for "SOON" roadmap artifacts.
- **PR/Issue labels (`.lbl`):** Color from the GitHub label's `--lbl` custom property. Default falls back to Ash. The bg and border are always `color-mix(in srgb, var(--lbl) 14%/45%, transparent)` — labels inherit their palette from the data, not from the design system.

## 6. Do's and Don'ts

### Do:

- **Do** use Kelp Teal only for interactive affordances (primary buttons, focus rings, active nav, links) and positive-state indicators. If the element isn't clickable or explicitly "OK", it doesn't get teal.
- **Do** use JetBrains Mono for all numeric, identifier, and code-like content: scores, usernames, repo names, timestamps, tier labels. The register distinction is load-bearing.
- **Do** use spring easing (`cubic-bezier(.22,1,.36,1)`) for interactive transforms. Reserve linear easing for skeleton shimmer and spinner rotation only.
- **Do** handle `prefers-reduced-motion` for every animation. The grain overlay reduces to 2% opacity; spinners stop animating; transitions collapse to instant crossfades.
- **Do** use the Void → Carbon → Slate tonal ramp to convey surface layering. These three steps are the depth system.
- **Do** verify contrast ≥ 4.5:1 for body text, ≥ 3:1 for large/bold text. Against Void Zinc, Bone achieves ~18:1 — do not substitute Ash for body text, even for "visual quietness."
- **Do** include both `tier` label text (P0/P1/P2/P3) and color when displaying priority. Color is not the sole differentiator — the label is always present.

### Don't:

- **Don't** make the interface look like a GitHub reskin. triagekit has its own identity. Navigation should not mirror GitHub's sidebar; the data model should not mirror GitHub's visual hierarchy. The tool feeds from GitHub; it doesn't wear it.
- **Don't** use the generic dev-tool dark mode palette — #1e1e1e / #252526 backgrounds, VSCode-grey surfaces, blue (`#007acc` / `#0ea5e9`) accents. This system uses Void Zinc (#0A0A0B) and Kelp Teal (#2E9E96) as its specific, non-generic identity.
- **Don't** use security vendor dashboard patterns — badge-heavy layouts, chart-per-metric grids, corporate card-with-icon layouts, padded whitespace that implies an enterprise audience. triagekit is a developer's tool, not a compliance dashboard.
- **Don't** use SaaS-slick patterns — gradient cards, generous whitespace, marketing-grade entrance animations. The landing page can be more expressive; the app interior must not be.
- **Don't** add box-shadow to cards, table rows, or nav items at rest. The Float-Only Rule: shadows are for physically elevated surfaces (drawers, popovers) only.
- **Don't** use border-left greater than 1px as a colored accent stripe on cards or list items. The only exception is the Settings sidebar's `inset 3px 0 0 var(--accent)` active indicator — that is a tab selection signal, not decoration.
- **Don't** use gradient text (`background-clip: text`). All text is a single solid color.
- **Don't** use P0–P3 colors outside their priority tier context. Critical Red is not a generic error color. Medium Amber is not "caution yellow." These colors carry scoring meaning; reusing them for unrelated UI states destroys the ramp's legibility.
- **Don't** apply `text-transform: uppercase` to text over 13px or to sentence-case prose. Uppercase is structural (column headers, group labels, badge text) — never rhetorical.
- **Don't** nest cards. A section card (`.set-section`) inside a panel inside a sheet is the correct depth; a card-inside-a-card-inside-a-card compounds depth without adding hierarchy.
