# Brand onboarding

Use this only when the project has a brand or an existing design system. The goal is to map external values into stable semantic roles, not to reproduce a website screenshot.

## URL flow

1. Fetch the homepage or use the supplied local snapshot.
2. Inspect computed or declared values for body background, primary text, secondary text, cards/containers, CTA/link colors, `h1`, body, and code font stacks.
3. Propose a token diff mapping them to `paper`, `paper-2`, `ink`, `muted`, `accent`, `title`, `node-name`, and `sublabel`.
4. Check `ink`/`paper` contrast and adjust only when necessary; explain the adjustment.
5. Ask for approval before writing the project style guide. Do not silently mutate a shared brand file.

## Local design-system flow

Search the supplied folder for CSS, JSON, YAML, or token files. Prefer explicit design tokens over guessed values from screenshots. Map aliases into the semantic roles and keep the original source names in a small mapping note.

## Manual flow

Accept a compact token map such as:

```text
paper: #f7f4ee
ink: #1e2420
muted: #647067
accent: #c95b3b
title font: Fraunces
node font: Inter
mono font: IBM Plex Mono
```

Validate contrast and preserve the one-accent rule. If a brand has many colors, keep the three that explain the visual hierarchy and turn the rest into low-contrast muted variants.

## First-run gate

If the project is branded and the style guide is still default, ask whether to onboard, paste tokens, or proceed with the default. Once the user explicitly chooses a skin, reuse it for later diagrams rather than asking again.
