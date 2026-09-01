# Diagram Video Tool v1.0.0

Create a 9:16 editorial diagram video from a semantic JSON specification. The tool generates a fresh Remotion project, checks it, renders a still, then renders an MP4. It is a standalone local tool: the `video-agent` repository is not required after extraction.

## Instructions for ChatGPT, Codex, Cursor, or Claude

Use this tool only in an agent environment that can read local files and run terminal commands. ChatGPT web alone cannot run it.

The user can start with this prompt:

```text
Use Diagram Video Tool in the current folder. Read README.md and SKILL.md first, run doctor, then create a diagram video about: [topic].
```

The agent must then:

1. Read `SKILL.md`, plus `design-skill/SKILL.md` and `design-skill/references/type-catalog.md` before choosing the diagram grammar.
2. Run `./install.sh --workspace ./workspace` followed by `./bin/diagram-video doctor`.
3. If `doctor` reports a missing system runtime, stop, name the missing item, and request permission before installing it. Do not silently install Python, Node, FFmpeg, or FFprobe.
4. Turn the topic into one visual story, write a semantic JSON specification, and use the CLI in the order `init` → `install-project` → `render`.
5. Inspect the preview PNG before delivering the absolute path to the final MP4.

`install-project` downloads pinned npm dependencies and, when needed, Remotion Chrome Headless. It may request network permission on the first run; it does not need credentials or the original `video-agent` project.

## Requirements

- Python 3.10 or newer
- Node.js 20 or newer and npm
- FFmpeg and FFprobe on `PATH`
- npm registry access and access to Remotion's Chrome Headless download on the first project installation

The installer never installs system software. Run `doctor` first and install any missing runtime using your normal system package manager with your own approval.

## Install and check

```bash
unzip diagram-video-tool-v1.0.0-portable.zip
cd diagram-video-tool-v1.0.0
./install.sh --workspace ./workspace
./bin/diagram-video doctor
```

`install.sh` validates the bundle and makes a workspace for specifications and generated projects. It does not download npm packages or Chrome until a project is created. `install-project` then downloads the pinned npm dependencies and, if needed, Remotion's Chrome Headless runtime.

## Make a video

First turn the topic into one diagram story. The bundled [design skill](design-skill/SKILL.md) gives the grammar and editorial constraints. Start with a spec such as [minimal.json](examples/minimal.json), then:

```bash
./bin/diagram-video init \
  --spec examples/minimal.json \
  --project workspace/projects/order-flow

./bin/diagram-video install-project --project workspace/projects/order-flow
./bin/diagram-video doctor --project workspace/projects/order-flow
./bin/diagram-video render --project workspace/projects/order-flow
```

The result is written to `workspace/projects/order-flow/output/final.mp4`; its frame preview is `output/preview.png`.

For narration already available on disk, add `--voice /path/to/narration.wav` to `init`. The audio is copied into the project — the original is untouched.

## Agent use

An agent should read [SKILL.md](SKILL.md), run `doctor`, and use the CLI rather than copying project files manually. ChatGPT web alone cannot run a local tool; ChatGPT/Codex desktop or another local-shell agent can run it after the user has this bundle locally.
