# Output dials

Set these before layout. They change node count, type scale, wording, and safe areas.

| Dial | Options | Default |
|---|---|---|
| Format | `html`, `svg`, `png`, `html+png` | `html` |
| Size | `doc-inline`, `doc-wide`, `slide-16x9`, `slide-4x3`, `social-og`, `social-square`, `print-a4-landscape`, `fit` | `doc-inline` |
| Detail | `simplified`, `balanced`, `faithful` | `balanced` |
| Audience | `executive`, `mixed`, `engineer` | `mixed` |

## Size presets

| Preset | ViewBox | Use |
|---|---|---|
| `doc-inline` | `0 0 960 600` | Blog, README, inline docs |
| `doc-wide` / `slide-16x9` | `0 0 1280 720` | Full-width docs or slides |
| `slide-4x3` | `0 0 1024 768` | Legacy decks |
| `social-og` | `0 0 1200 632` | Link preview; keep 64px clear on all sides |
| `social-square` | `0 0 1080 1080` | Feed/carousel |
| `print-a4-landscape` | `0 0 1120 792` | Print; export at scale 3 |
| `fit` | Content bounds rounded up to 4px + margins | SVG handoff |

Use 40px outer margin by default; keep 60–80px clear at the bottom when a slide/footer may crop. All dimensions stay on the 4px grid.

## Detail budget

| Level | Nodes | Edges | Guidance |
|---|---:|---:|---|
| `simplified` | ≤7 | ≤9 | Capabilities and the main path only |
| `balanced` | ≤12 | ≤16 | Story-carrying components; collapse leaves |
| `faithful` | ≤24 | ≤32 | Zone every node above 9; split above 24 |

Reduce in this order: decorative notes/legends, exact duplicates, leaf clusters, unimportant sinks, cross-cutting infrastructure, then split into overview + detail. Never silently omit meaningful source content.

## Audience rewriting

| Audience | Node labels | Sublabels | Edge labels |
|---|---|---|---|
| `engineer` | Exact services/components | Protocol, port, version | `POST /v2/orders`, `gRPC`, `SQL` |
| `mixed` | Components with acronyms expanded | Only decision-relevant tech | `verifies`, `writes`, `notifies` |
| `executive` | Capabilities/outcomes | None | `approves`, `pays`, `retains` |

Do not invent a business meaning to replace an opaque source label. Preserve proper nouns when correct, and state uncertainty.

## Fidelity ledger

For any import or reduction, report a short ledger after the output:

```text
Detail: balanced · 18 source nodes → 9 drawn
Merged: worker-01..06 → “Ingest Worker ×6”
Collapsed: Observability group → one node
Dropped: 2 sticky notes and an unconnected legacy path
Kept in full: Client → Gateway → Orders → Postgres
```
