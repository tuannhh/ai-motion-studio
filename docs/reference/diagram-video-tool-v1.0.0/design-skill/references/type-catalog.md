# Diagram grammar catalog

Choose one grammar based on the relationship the reader needs to understand. Load only the relevant row(s); do not combine grammars unless one is clearly a supporting annotation.

| Type | Best for | Layout emphasis | Common failure |
|---|---|---|---|
| Architecture | Components + connections | Zones, left→right flow, grouped stores | Turning every dependency into a crossing arrow |
| IT current-state | Legacy landscape before modernization | Departments/phases, boundaries, risk points | Pretending the current state is a clean target architecture |
| Flowchart | Decisions and branches | One entry, explicit yes/no labels, terminal outcomes | Using diamonds for ordinary services |
| Sequence | Messages over time | Lifelines, activation bars, vertical chronology | Encoding architecture as a sequence |
| State machine | States, transitions, guards | State nodes, labeled transitions, start/end | Showing steps instead of durable states |
| ER/data model | Entities and fields | Table rows, cardinality, relationship labels | Decorating fields that do not affect the model |
| Timeline | Events on time | Single axis, dated milestones, short annotations | Using it for parallel task duration |
| Swimlane | Handoffs between roles | One lane per actor/team/system, horizontal flow | Lanes with no meaningful ownership change |
| Quadrant | Two-axis positioning | Clearly named axes, readable cells, 2–4 focal points | Treating arbitrary prose as quantitative data |
| Consultant 2×2 | Named scenarios in a matrix | Four explicit scenario cells and decision labels | Hiding the takeaway in a legend |
| Radar/spider | 3–5 quantitative criteria across entities | One shared scale, limited series, one focal series | Using it for unrelated scales or too many series |
| Loop/flywheel | Reinforcing cycle around shared state | Stations around a hub, directional cycle, write-backs dashed | Drawing a circle without causal verbs |
| Nested | Hierarchy through containment | Parent boundaries and increasing scope | Using nested boxes for a simple tree |
| Tree | Parent → children | One root, fan-out, consistent depth | Showing ownership or routing instead of taxonomy |
| Org chart | Ownership, reporting, routing, escalation | Role hierarchy and explicit owners | Mixing technical dependencies into reporting lines |
| Layer stack | Stacked abstraction levels | Parallel horizontal layers, adjacent flow | Adding arrows that layout already implies |
| Venn | Set overlap | 2–3 sets, meaningful intersections | More than 3 sets or fake overlaps |
| Pyramid/funnel | Ranked hierarchy or drop-off | Monotonic width/priority, stage counts if factual | Using width as decoration without a rank |
| Bar chart | Category comparison | Shared baseline and ordered categories | Omitting units/baseline context |
| Line chart | Trend over time | True time axis, few series, visible trend | Connecting categorical points as if continuous |
| Gantt | Tasks/phases over time | Time axis plus row ownership and duration | Using it for events with no duration |
| Scatter plot | Distribution/correlation | Two numeric axes, clusters/outliers, scale labels | Claiming causation from position alone |
| High-Level | End-to-end stack on a cluster | Containers/zones with major data path | Mixing overview and implementation detail |
| Process | Multi-actor sequential workflow | Actors, step order, data handoffs | Duplicate of a swimlane with no role distinction |
| Medallion | Bronze/silver/gold data tiers | Tier boundaries, quality/access progression | Treating tiers as generic layers |
| Data flow | Role-scoped pipeline | Who does what at each stage, payload labels | Showing only boxes and no ownership |
| DP integration | Sources → core → consumers | Three-stage topology and contracts | Hiding the central model behind vendor logos |
| DP security matrix | Per-role/component permissions | Rows = roles, columns = assets, compact permission marks | Using colors without a text/key explanation |

### Tie-breakers

- If a 3-column table tells the story, use the table.
- If the dominant axis is time, use timeline/sequence/Gantt; if it is ownership, use swimlane/process/org chart.
- If the same system can be described as architecture or flowchart, use architecture unless decisions are the actual subject.
- For data-platform requests, choose the smallest grammar that preserves the question: storage quality → medallion; integration topology → DP integration; role permissions → security matrix.
