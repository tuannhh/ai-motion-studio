#!/usr/bin/env python3
"""CLI for the standalone Diagram Video Tool."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any


CANVAS_WIDTH = 1080
CANVAS_HEIGHT = 1920
SAFE_LEFT, SAFE_RIGHT = 64, 1016
SAFE_TOP, SAFE_BOTTOM = 440, 1680
DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT = 340, 152
ALLOWED_KINDS = {"input", "focal", "store", "service", "optional"}
MAX_SCENES, MAX_NODES, MAX_EDGES = 6, 10, 16


def root() -> Path:
    configured = os.environ.get("DIAGRAM_VIDEO_TOOL_ROOT")
    return Path(configured).resolve() if configured else Path(__file__).resolve().parents[2]


def fail(message: str) -> None:
    raise SystemExit(f"error: {message}")


def sha256(path: Path) -> str:
    hash_value = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            hash_value.update(block)
    return hash_value.hexdigest()


def command_output(command: list[str]) -> tuple[bool, str]:
    try:
        done = subprocess.run(command, capture_output=True, text=True, timeout=10, check=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        return False, str(exc)
    text = (done.stdout or done.stderr).strip().splitlines()
    return done.returncode == 0, text[0] if text else f"exit {done.returncode}"


def node_major() -> int | None:
    ok, output = command_output(["node", "--version"])
    if not ok:
        return None
    try:
        return int(output.lstrip("v").split(".", 1)[0])
    except ValueError:
        return None


def project_problems(project: Path) -> list[str]:
    problems: list[str] = []
    for name in ("package.json", "package-lock.json", "src/Root.tsx", "public/diagram-video.json"):
        if not (project / name).is_file():
            problems.append(f"missing {name}")
    if not (project / "node_modules" / ".bin" / "remotion").exists():
        problems.append("local Remotion CLI is missing; run install-project")
    return problems


def doctor(project: Path | None) -> int:
    bundle = root()
    failures = 0
    print(f"tool_root={bundle}")
    for relative in ("PACKAGE.json", "SKILL.md", "install.sh", "verify.sh", "bin/diagram-video", "project/package.json", "project/package-lock.json", "design-skill/SKILL.md"):
        if (bundle / relative).is_file():
            print(f"OK   present {relative}")
        else:
            print(f"FAIL missing {relative}", file=sys.stderr)
            failures += 1
    manifest = bundle / "MANIFEST.sha256"
    if manifest.is_file():
        for line in manifest.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            expected, relative = line.split("  ", 1)
            candidate = bundle / relative
            if not candidate.is_file() or sha256(candidate) != expected:
                print(f"FAIL manifest mismatch: {relative}", file=sys.stderr)
                failures += 1
        if not failures:
            print("OK   manifest")
    else:
        print("WARN manifest is absent (source checkout; packaged ZIP includes one)")

    required = ("python3", "node", "npm", "ffmpeg", "ffprobe")
    for command in required:
        executable = shutil.which(command)
        if executable:
            print(f"OK   {command} -> {executable}")
        else:
            print(f"FAIL {command} not found on PATH", file=sys.stderr)
            failures += 1
    if sys.version_info < (3, 10):
        print(f"FAIL Python {sys.version.split()[0]} is below 3.10", file=sys.stderr)
        failures += 1
    else:
        print(f"OK   Python {sys.version.split()[0]}")
    major = node_major()
    if major is None or major < 20:
        print("FAIL Node.js 20 or newer is required", file=sys.stderr)
        failures += 1
    else:
        print(f"OK   Node.js major {major}")

    if project:
        checked = project.resolve()
        problems = project_problems(checked)
        if problems:
            print(f"FAIL project {checked}", file=sys.stderr)
            for issue in problems:
                print(f"  - {issue}", file=sys.stderr)
            failures += 1
        else:
            print(f"OK   project {checked}")
    print("doctor: all critical checks passed" if not failures else f"doctor: {failures} failure(s)")
    return 0 if not failures else 1


def number(value: Any, label: str) -> float:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        fail(f"{label} must be a number")
    return float(value)


def validate_node(node: Any, scene_index: int, node_index: int) -> str:
    label = f"scenes[{scene_index}].nodes[{node_index}]"
    if not isinstance(node, dict):
        fail(f"{label} must be an object")
    node_id = node.get("id")
    if not isinstance(node_id, str) or not node_id.strip():
        fail(f"{label}.id must be a non-empty string")
    if not isinstance(node.get("title"), str) or not node["title"].strip():
        fail(f"{label}.title must be a non-empty string")
    if node.get("kind", "service") not in ALLOWED_KINDS:
        fail(f"{label}.kind must be one of: {', '.join(sorted(ALLOWED_KINDS))}")
    x, y = number(node.get("x"), f"{label}.x"), number(node.get("y"), f"{label}.y")
    width = number(node.get("width", DEFAULT_NODE_WIDTH), f"{label}.width")
    height = number(node.get("height", DEFAULT_NODE_HEIGHT), f"{label}.height")
    if width <= 0 or height <= 0:
        fail(f"{label} width and height must be positive")
    if x < SAFE_LEFT or x + width > SAFE_RIGHT or y < SAFE_TOP or y + height > SAFE_BOTTOM:
        fail(f"{label} falls outside the safe diagram area")
    return node_id


def validate_edge(edge: Any, scene_index: int, edge_index: int) -> None:
    label = f"scenes[{scene_index}].edges[{edge_index}]"
    if not isinstance(edge, dict):
        fail(f"{label} must be an object")
    points = edge.get("points")
    if not isinstance(points, list) or len(points) < 2:
        fail(f"{label}.points needs at least two points")
    parsed: list[tuple[float, float]] = []
    for point_index, point in enumerate(points):
        if not isinstance(point, list) or len(point) != 2:
            fail(f"{label}.points[{point_index}] must be [x, y]")
        x, y = number(point[0], f"{label}.points[{point_index}][0]"), number(point[1], f"{label}.points[{point_index}][1]")
        if not 0 <= x <= CANVAS_WIDTH or not 0 <= y <= CANVAS_HEIGHT:
            fail(f"{label}.points[{point_index}] is outside the canvas")
        parsed.append((x, y))
    if any(start[0] != end[0] and start[1] != end[1] for start, end in zip(parsed, parsed[1:])):
        fail(f"{label} has a diagonal segment; use orthogonal routing")


def load_and_validate(spec_path: Path) -> dict[str, Any]:
    if not spec_path.is_file():
        fail(f"spec does not exist: {spec_path}")
    try:
        spec = json.loads(spec_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        fail(f"invalid JSON in {spec_path}: {exc}")
    if not isinstance(spec, dict) or not isinstance(spec.get("title"), str) or not spec["title"].strip():
        fail("title must be a non-empty string")
    scenes = spec.get("scenes")
    if not isinstance(scenes, list) or not scenes:
        fail("scenes must be a non-empty list")
    if len(scenes) > MAX_SCENES:
        fail(f"use at most {MAX_SCENES} scenes")
    for scene_index, scene in enumerate(scenes):
        label = f"scenes[{scene_index}]"
        if not isinstance(scene, dict) or not isinstance(scene.get("title"), str) or not scene["title"].strip():
            fail(f"{label}.title must be a non-empty string")
        duration = number(scene.get("durationSeconds"), f"{label}.durationSeconds")
        if not 3 <= duration <= 30:
            fail(f"{label}.durationSeconds must be between 3 and 30")
        nodes, edges = scene.get("nodes"), scene.get("edges", [])
        if not isinstance(nodes, list) or not nodes:
            fail(f"{label}.nodes must be a non-empty list")
        if len(nodes) > MAX_NODES or not isinstance(edges, list) or len(edges) > MAX_EDGES:
            fail(f"{label} exceeds the node or edge complexity budget")
        node_ids = [validate_node(node, scene_index, index) for index, node in enumerate(nodes)]
        if len(node_ids) != len(set(node_ids)):
            fail(f"{label} repeats a node id")
        for edge_index, edge in enumerate(edges):
            validate_edge(edge, scene_index, edge_index)
    return spec


def init(spec_path: Path, project: Path, voice: Path | None) -> None:
    spec = load_and_validate(spec_path.resolve())
    target = project.resolve()
    if target.exists() and any(target.iterdir()):
        fail(f"project directory is not empty: {target}")
    template = root() / "project"
    if not template.is_dir():
        fail("bundled project template is missing")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(template, target, dirs_exist_ok=True)
    if voice:
        source = voice.resolve()
        if not source.is_file():
            fail(f"voice does not exist: {source}")
        assets = target / "public" / "assets"
        assets.mkdir(parents=True, exist_ok=True)
        destination = assets / f"voice{source.suffix.lower() or '.wav'}"
        shutil.copy2(source, destination)
        spec["voiceSrc"] = f"assets/{destination.name}"
    (target / "public" / "diagram-video.json").write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (target / "output").mkdir(exist_ok=True)
    print(json.dumps({"project": str(target), "spec": str(target / "public" / "diagram-video.json")}, ensure_ascii=False))


def run_npm(project: Path, command: list[str]) -> None:
    environment = os.environ.copy()
    environment.setdefault("npm_config_cache", str(project / ".npm-cache"))
    environment.setdefault("npm_config_update_notifier", "false")
    try:
        subprocess.run(command, cwd=project, env=environment, check=True)
    except subprocess.CalledProcessError as exc:
        fail(f"command failed in {project}: {' '.join(command)} (exit {exc.returncode})")


def install_project(project: Path) -> None:
    target = project.resolve()
    for name in ("package.json", "package-lock.json"):
        if not (target / name).is_file():
            fail(f"not a generated Diagram Video project: missing {name}")
    print("Installing pinned npm dependencies and ensuring Remotion Chrome Headless (network may be needed on first run)…")
    run_npm(target, ["npm", "ci", "--no-audit", "--no-fund"])
    run_npm(target, ["npx", "remotion", "browser", "ensure"])
    print(f"Installed project dependencies and browser runtime: {target}")


def render(project: Path) -> None:
    target = project.resolve()
    problems = project_problems(target)
    if problems:
        fail("project is not ready: " + "; ".join(problems))
    run_npm(target, ["npm", "run", "still"])
    run_npm(target, ["npm", "run", "render"])
    final = target / "output" / "final.mp4"
    if not final.is_file() or final.stat().st_size == 0:
        fail("Remotion completed but final.mp4 is missing or empty")
    print(json.dumps({"preview": str(target / "output" / "preview.png"), "video": str(final)}, ensure_ascii=False))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    actions = parser.add_subparsers(dest="action", required=True)
    doctor_parser = actions.add_parser("doctor", help="check tool, host and optional project")
    doctor_parser.add_argument("--project", type=Path)
    init_parser = actions.add_parser("init", help="create a project from a semantic spec")
    init_parser.add_argument("--spec", required=True, type=Path)
    init_parser.add_argument("--project", required=True, type=Path)
    init_parser.add_argument("--voice", type=Path)
    install_parser = actions.add_parser("install-project", help="install pinned dependencies for a generated project")
    install_parser.add_argument("--project", required=True, type=Path)
    render_parser = actions.add_parser("render", help="render still and MP4")
    render_parser.add_argument("--project", required=True, type=Path)
    args = parser.parse_args()
    if args.action == "doctor":
        return doctor(args.project)
    if args.action == "init":
        init(args.spec, args.project, args.voice)
    elif args.action == "install-project":
        install_project(args.project)
    elif args.action == "render":
        render(args.project)
    return 0


if __name__ == "__main__":
    main()
