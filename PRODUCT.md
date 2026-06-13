# Product

> Scope: **`dwr-site/`** — "DWR Decoded", the public explainer site for the
> PFAS-free durable-water-repellency research (linked from a poster QR code and
> shared with Finisterre). The sibling bench tool has its own context at the repo
> root `PRODUCT.md` (product register).

## Register

brand

## Users

Members of the public who scan a QR code on a research poster, the Finisterre
contact(s) the work is shared with, and anyone landing on the site cold. They are
mostly non-specialists with a passing-to-genuine interest in sustainable materials,
arriving on a phone, giving the page seconds to earn the next scroll. A smaller
audience is technically literate (supervisors, peers) who will check the data and
the claims. The page has to satisfy curiosity quickly and reward deeper reading.

## Product Purpose

Explain, accessibly and credibly, how this masters project rebuilds durable water
repellency on cotton without PFAS "forever chemicals" — the story, the chemistry,
and the data. It exists to make a year of lab work legible and trustworthy to people
who will never read the dissertation: to turn a poster glance into understanding,
and to represent the work well to an industry partner. Success = a non-specialist
leaves understanding what was done and why it matters, with their trust intact.

## Brand Personality

Credible but warm and human. Rigorous UCL research told like a story — science you
can trust, explained plainly and invitingly rather than lectured. Confident without
being slick; the ambition shows in clarity and craft, not in shouting. The voice is
a knowledgeable person walking you through their work, not a brochure.

## Anti-references

- **Dark AI/SaaS dashboard** — no charcoal-and-neon, gradient hero-metric template,
  or product-launch landing-page grammar.
- **Greenwashed eco cliché** — no kraft paper, leaf icons, hand-drawn "natural"
  fonts, or sage-and-beige sustainability-startup styling. Credibility, not virtue signalling.
- **Corporate chemical-industry** — no blue-gradient "innovation" corporate site,
  stock lab-goggle photography, or hexagon molecule motifs.
- **Generic Bootstrap template** — no centered hero + three identical feature cards +
  default shadows + eyebrow-on-every-section scaffolding.

## Design Principles

- **Earn each scroll.** Every section justifies the one before it; the chemistry
  walkthrough reveals progressively, never as a wall.
- **Show the science, don't decorate it.** The animated schematic and data exist to
  explain, not to impress; motion clarifies the mechanism.
- **Credibility is a feature.** Real numbers, honest claims, supervisor-checked
  before anything public — trust is the product.
- **Warmth through voice and clarity, not props.** Approachability comes from plain
  language and pacing, never from eco-cliché texture.
- **Mobile-first, poster-to-page.** Designed for the phone of someone who just
  scanned a QR; fast, legible, and complete on a small screen.

## Accessibility & Inclusion

Target **WCAG 2.2 AA**: body text ≥4.5:1, large text ≥3:1, full keyboard
operability, visible focus, meaningful alt text on figures/diagrams. The site
leans on GSAP scroll animation, so `prefers-reduced-motion` must yield a fully
legible, non-animated reading experience (the existing `<noscript>` fallback is the
right instinct — extend it to reduced-motion). Content must be understandable
without color alone.
