# Diagram style guide

Use semantic roles, not scattered hex values. Replace the default values when the project has an established visual identity.

## Default tokens

| Role | Light default | Dark default | Use |
|---|---|---|---|
| `paper` | `#f5f5f5` | `#2d3142` | Page/background |
| `paper-2` | `#ececec` | `#393e53` | Secondary container fill |
| `ink` | `#2d3142` | `#f5f5f5` | Primary text/stroke |
| `muted` | `#4f5d75` | `#bfc0c0` | Default arrows/secondary text |
| `soft` | `#7a8399` | `#8e98ac` | Sublabels/boundaries |
| `rule` | `rgba(45,49,66,.12)` | `rgba(245,245,245,.12)` | Hairlines |
| `accent` | `#eb6c36` | `#f08a59` | 1–2 focal elements |
| `accent-tint` | `rgba(235,108,54,.08)` | `rgba(240,138,89,.10)` | Focal fill |
| `link` | `#2e5aa8` | `#6a95d8` | HTTP/API/external arrows |

## Node treatments

| Semantic node | Fill | Stroke |
|---|---|---|
| Focal | `accent-tint` | `accent` |
| Backend/API/step | paper or white | ink |
| Store/state | ink at ~5% | muted |
| External/cloud | ink at ~3% | ink at ~30% |
| Input/user | muted at ~10% | soft |
| Optional/async | ink at ~2% | ink at ~20%, dashed |
| Security/boundary | accent at ~5% | accent at ~50%, dashed |

## Type and geometry

- Title: serif, about 28px standard / 40px presentation.
- Node name: sans, 12px standard / 16px presentation, semibold.
- Sublabel: mono, 9px standard / 12px presentation.
- Eyebrow/tag and arrow label: mono, small, tracked, uppercase only where useful.
- Editorial callout: serif italic; use sparingly.
- Default strokes: 0.8px tag, 1px normal, 1.2px emphasis. Default radii: 4px tag, 6px node, 8px container.
- Make every coordinate, dimension, and gap divisible by 4. Keep node interiors generous enough for labels.
- The default background is clean paper, without a dot pattern or card wrapper.

## Contrast and brand rules

- Check `ink` on `paper` for WCAG AA. Check `muted` on `paper` before using it below 12px.
- Keep one accent hue. Collapse extra brand colors into muted variants or series colors only for genuinely multi-series charts.
- Preserve the serif/sans/mono contrast even when the brand is all-sans; it is part of the editorial hierarchy.
- For non-Latin text, add a fallback font on the affected text elements and budget roughly 10% more width.
