#!/usr/bin/env bash
# Bootstrap Diagram Video Tool without installing system software.
set -euo pipefail

BUNDLE_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
WORKSPACE="$BUNDLE_DIR/workspace"

usage() {
  printf '%s\n' "Usage: ./install.sh [--workspace DIR]" "" \
    "Validates this standalone bundle and creates workspace/{specs,projects}." \
    "System dependencies are checked but never installed automatically."
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --workspace)
      [[ $# -ge 2 ]] || { echo "ERROR: --workspace needs a directory" >&2; exit 2; }
      WORKSPACE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "ERROR: unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

"$BUNDLE_DIR/verify.sh"
for command in python3 node npm ffmpeg ffprobe; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "ERROR: missing dependency: $command" >&2
    echo "Install it with your normal system package manager, then rerun this command." >&2
    exit 1
  }
done

mkdir -p "$WORKSPACE/specs" "$WORKSPACE/projects"
chmod +x "$BUNDLE_DIR/bin/diagram-video"
echo "Install complete."
echo "Tool:      $BUNDLE_DIR"
echo "Workspace: $WORKSPACE"
echo "Next: ./bin/diagram-video doctor"
