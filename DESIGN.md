---
name: Fluorine-Free Superhydrophobic Cotton Coating
description: Calm, credible public explainer for PFAS-free durable water repellency research at UCL.
colors:
  accent-sea-green: "#0e6e5c"
  accent-deep: "#0a5546"
  accent-tint: "#dfeee8"
  water: "#afd3e6"
  water-deep: "#5e9dc0"
  rust-restricted: "#a6502f"
  paper: "#f8f9f7"
  panel: "#ffffff"
  ink: "#1c2522"
  ink-soft: "#51605a"
  line: "#dce2de"
  faint: "#e7ebe7"
typography:
  display:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "clamp(2.7rem, 7.2vw, 6.2rem)"
    fontWeight: 640
    lineHeight: 0.99
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Geist, sans-serif"
    fontSize: "clamp(2.2rem, 5vw, 3.6rem)"
    fontWeight: 640
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 640
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "normal"
  label:
    fontFamily: "'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  panel: "16px"
  pill: "999px"
  focus: "4px"
spacing:
  section: "clamp(4.5rem, 11vh, 8rem)"
  wrap-inline: "clamp(1.25rem, 4vw, 2.5rem)"
  gap-scrolly: "clamp(1.5rem, 4vw, 4.5rem)"
components:
  button-primary:
    backgroundColor: "{colors.accent-sea-green}"
    textColor: "{colors.panel}"
    rounded: "{rounded.pill}"
    padding: "0.85rem 1.6rem"
  button-primary-hover:
    backgroundColor: "{colors.accent-deep}"
    textColor: "{colors.panel}"
    rounded: "{rounded.pill}"
    padding: "0.85rem 1.6rem"
  link-inline:
    textColor: "{colors.accent-sea-green}"
  link-inline-hover:
    textColor: "{colors.accent-deep}"
---

# Design System: Fluorine-Free Superhydrophobic Cotton Coating

## 1. Overview

**Creative North Star: "The Coastal Field Report"**

This is a working scientist's explainer, not a product launch. The page reads like
a calm, well-set field report from someone who knows the chemistry and respects the
reader's time: generous white (paper) space, one confident deep-sea-green voice, and
a single animated schematic that does the explaining. The Finisterre connection and
the water-repellency subject earn a coastal palette — sea green and a cool water blue
— but warmth comes from plain language and pacing, never from eco-cliché texture.
The system is built to satisfy a curious phone-scanner in seconds and reward a
supervisor reading every number.

It explicitly rejects the four anti-references from PRODUCT.md: the dark AI/SaaS
dashboard, the greenwashed eco-startup (kraft paper, leaf icons, hand-drawn fonts),
the corporate chemical-industry look (blue-gradient "innovation", stock goggles,
hexagon molecules), and the generic Bootstrap template (centered hero + three
identical cards). Credibility is the product; the design stays out of the science's way.

**Key Characteristics:**
- One accent (deep sea green) carries the whole site; rust is semantic-only.
- Variable Geist for everything, Geist Mono for numbers, captions, and metadata.
- Flat surfaces on paper; depth via one soft accent-tinted shadow and sticky layering.
- GSAP-driven scrollytelling with a full reduced-motion / no-JS reading fallback.
- Asymmetric, editorial spacing — section heads drift, rhythm varies, nothing boxed.

## 2. Colors

A restrained coastal palette: one deep sea-green doing the work, cool water blues as
support, and a single rust reserved strictly for meaning.

### Primary
- **Deep Sea Green** (`#0e6e5c`): The single brand voice. Links, primary buttons,
  selection, focus rings, the wordmark droplet, accented words in headings.
- **Sea Green Deep** (`#0a5546`): Hover/active state for every green element; the
  darker `.accent-word` / `<em>` emphasis inside headings.
- **Sea Green Tint** (`#dfeee8`): Selection background, nav-link hover/active fill,
  quiet accent washes behind small elements.

### Secondary
- **Water** (`#afd3e6`) and **Water Deep** (`#5e9dc0`): The hero render and
  diagram water/droplet tones. Atmospheric, never used for text.

### Tertiary
- **Restricted Rust** (`#a6502f`): Semantic only. Marks PFAS / "restricted" content
  in the schematic and diagrams. Never decorative, never a second brand color.

### Neutral
- **Paper** (`#f8f9f7`): Body background — a true near-white, faintly cool, NOT a warm cream.
- **Panel** (`#ffffff`): Cards, figures, the blurred nav surface.
- **Ink** (`#1c2522`): Primary text. ~12:1 on paper.
- **Ink Soft** (`#51605a`): Lede, captions, muted prose. ~6:1 on paper — AA-safe for body.
- **Line** (`#dce2de`): Borders, dividers, nav underline.
- **Faint** (`#e7ebe7`): The giant footer watermark and other barely-there marks only.

### Named Rules
**The One Green Rule.** There is exactly one accent — deep sea green — and it appears
everywhere interactive. Rust is not a second accent; it is a warning label. If a new
color is tempting, the answer is a tint of green or a neutral.

## 3. Typography

**Display / Body Font:** Geist (variable, with `-apple-system` fallback)
**Label / Mono Font:** Geist Mono (with `ui-monospace` fallback)

**Character:** One humanist-geometric variable family in many weights, paired only
with its own monospace sibling. The contrast axis is sans-vs-mono, never two similar
sans. Geist Mono signals "measured data" — numbers, captions, the hero caption,
metadata — and keeps the prose voice and the evidence voice visually distinct.

### Hierarchy
- **Display** (640, clamp(2.7rem→6.2rem), lh 0.99, ls -0.04em): The index hero `h1`
  only, capped at 13ch so it never overflows.
- **Headline** (640, clamp(2.2rem→3.6rem), lh 1.08, ls -0.025em): Section `h2`s; `text-wrap: balance`.
- **Title** (640, 1.15rem, lh 1.35): `h3` and card headings.
- **Body** (400, 1.0625rem, lh 1.7): Prose, capped at 65ch (lede at 56ch).
- **Label** (500 mono, 0.75rem): Hero caption, figure metadata, inline `.num` values.

### Named Rules
**The Mono-Means-Measured Rule.** Geist Mono is reserved for things that are counted
or measured (contact angles, sample IDs, captions, dates). Prose is always Geist sans.

## 4. Elevation

Predominantly flat. Surfaces sit on paper and are separated by hairline borders
(`--line`) and tonal shift (paper → panel white), not by stacked shadows. Depth is
spatial, created by the sticky scrollytelling figure holding still while text scrolls.

### Shadow Vocabulary
- **Ambient Soft** (`box-shadow: 0 10px 30px rgba(14, 110, 92, 0.08)`): The single
  shadow token. Accent-tinted, diffuse, low-opacity — used sparingly on raised
  figures/cards. It reads as a faint green glow, not a drop shadow.

### Named Rules
**The Flat-On-Paper Rule.** Default state is flat. Never stack shadows for hierarchy;
use border, tonal contrast, or position. The one shadow is ambient, never structural.

## 5. Components

### Buttons
- **Shape:** Full pill (`999px`).
- **Primary:** Sea-green fill, white text, padding `0.85rem 1.6rem`, weight 560.
- **Hover / Focus:** Background → `#0a5546`, lift `translateY(-1px)`; `:active` scales to 0.98. Focus-visible: 2px sea-green outline, 3px offset.
- **Quiet link:** Inline text link in sea green (weight 540), underline 1px with 3px offset; hover → deep.

### Cards / Containers
- **Corner Style:** 16px (`--radius-panel`) for every panel, card, and figure. Nothing else is rounded except pills.
- **Background:** White panel on paper.
- **Shadow Strategy:** Flat by default; Ambient Soft only when genuinely raised.
- **Border:** 1px `--line` hairline.

### Navigation
- **Style:** Sticky, 64px, semi-transparent paper (`rgba(248,249,247,0.86)`) with `blur(10px)` backdrop, hairline bottom border.
- **Wordmark:** Droplet SVG + compact text ("Fluorine-Free DWR"); text hides below 480px.
- **Links:** Pill-padded; hover and `aria-current` use sea-green-tint fill with deep-green text.

### Schematic (signature component)
The chemistry walkthrough is an inline SVG state machine: each `<g data-on="...">`
declares the steps it appears in; `.draw` elements stroke themselves on, `.pop`
elements spring in, driven by GSAP. Rust marks restricted/PFAS content. This is the
site's centerpiece — it must remain fully legible in the `<noscript>` / reduced-motion
fallback (all groups visible, no transforms).

## 6. Do's and Don'ts

### Do:
- **Do** keep one accent: deep sea green (`#0e6e5c`) for everything interactive, deep (`#0a5546`) for hover.
- **Do** reserve rust (`#a6502f`) strictly for "restricted / PFAS" meaning in diagrams.
- **Do** use Geist Mono only for measured values, captions, and metadata.
- **Do** cap body at 65ch, hero `h1` at 13ch, and test every heading at mobile width — the viewport is part of the design.
- **Do** ship a complete reading experience with no JS and with `prefers-reduced-motion` (extend the existing `<noscript>` instinct).
- **Do** keep surfaces flat on paper; reach for border or position before shadow.

### Don't:
- **Don't** build a **dark AI/SaaS dashboard** — no charcoal-and-neon, no gradient hero-metric template.
- **Don't** go **greenwashed eco cliché** — no kraft paper, leaf icons, hand-drawn "natural" fonts, or sage-and-beige. The green is clinical sea-green, not "sustainability".
- **Don't** look **corporate chemical-industry** — no blue-gradient "innovation", stock lab-goggle photos, or hexagon molecule motifs.
- **Don't** fall into the **generic Bootstrap template** — no centered hero + three identical feature cards + default shadows + an eyebrow above every section.
- **Don't** introduce a second accent color; tint the green or use a neutral.
- **Don't** use `--faint` for anything readable — it is watermark-only.
