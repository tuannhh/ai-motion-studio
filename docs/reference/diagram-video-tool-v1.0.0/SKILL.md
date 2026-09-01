---
name: diagram-video-tool
description: Standalone local tool for creating a vertical animated diagram video and MP4 from a semantic specification. Use for processes, architecture, flows, sequences, hierarchies, timelines, and data relationships; not for a static diagram alone.
---

# Diagram Video Tool (standalone)

Use this extracted tool directory as the workspace; do not require the `video-agent` repository.

## Required flow

1. Run `./install.sh --workspace ./workspace` then `./bin/diagram-video doctor`. Stop and report any `FAIL` lines. Do not install missing system runtimes without the user's approval.
2. Before writing a spec, read `design-skill/SKILL.md` and its `references/type-catalog.md`. Choose one dominant visual grammar per scene; use diagrams only when the relationship is clearer than prose.
3. Write a semantic JSON spec. Keep nodes on the 4px grid, reserve the accent for the focal action, use only orthogonal connector segments, and keep multiline text at line-height 1.25 or greater.
4. Create and install the project with `init` and `install-project`; do not manually copy the starter. `install-project` needs network access once for npm and, when unavailable locally, Remotion Chrome Headless.
5. Run `doctor --project …`, then `render --project …`. Inspect `output/preview.png` before delivering `output/final.mp4`.

```bash
./bin/diagram-video init --spec examples/minimal.json --project workspace/projects/example
./bin/diagram-video install-project --project workspace/projects/example
./bin/diagram-video render --project workspace/projects/example
```

The tool validates title, scene duration, node safe areas, IDs, density, and orthogonal edge routing before creating the project. It has no TTS provider, credentials, image generation dependency, or hidden source-repository dependency.
