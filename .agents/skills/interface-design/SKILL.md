---
name: interface-design
description: Craft-first interface design for dashboards, admin panels, mobile apps, tools, settings pages, and interactive products. Use when designing, building, reviewing, auditing, or refining product UI where visual craft, layout hierarchy, tokens, states, visual direction, or design-system consistency matter.
---

# Interface Design

Build product interfaces with the craft of top product design teams — Linear, Vercel, Stripe, Apple.
The difference between those and generic output is that every decision is *decided*, the hierarchy is unmistakable, and small details are correct at once.

---

## 1. Core Principles

- **One focal point per view**: Every screen has one primary job. Demote secondary controls intentionally.
- **Hierarchy through weight & contrast**: Use weight (`600` for primary values, `500` for labels, `400` for meta) and opacity rather than aggressive size jumps.
- **The 60 / 30 / 10 Rule**: 60% neutral canvas surface, 30% structural cards/elevations, 10% intentional accent. Color communicates action and status, not decoration.
- **Strict 8pt Spacing Grid**: Base on `4, 8, 12, 16, 24, 32, 48px`. Never use random spacing values (e.g. 13px, 17px, 23px).
- **Subtle Layering & Dark Mode Elevation**: Dark mode surfaces stack with gentle lightness steps (+7% → +9% → +12%) rather than harsh solid outlines.
- **Tactile Interaction**: Provide tactile haptic feedback (`Haptics.impactAsync`) on primary actions, tab switches, and key buttons.

---

## 2. Design System Memory

When working on UI:
1. Always read `.interface-design/system.md` to load the current project's design tokens, color palette, typography scale, and component patterns.
2. Ensure newly built components, cards, and modals strictly adhere to the project's tokens.
3. Update `.interface-design/system.md` whenever new design tokens or patterns are established.
