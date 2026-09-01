#!/usr/bin/env bash
set -euo pipefail
BUNDLE_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

required=(PACKAGE.json README.md SKILL.md install.sh verify.sh bin/diagram-video cli/diagram_video/__main__.py project/package.json project/package-lock.json project/src/Root.tsx design-skill/SKILL.md examples/minimal.json)
failed=0
for relative in "${required[@]}"; do
  if [[ ! -f "$BUNDLE_DIR/$relative" ]]; then
    echo "MISSING: $relative" >&2
    failed=1
  fi
done
[[ "$failed" -eq 0 ]] || exit 1

if [[ -f "$BUNDLE_DIR/MANIFEST.sha256" ]]; then
  if command -v shasum >/dev/null 2>&1; then
    (cd "$BUNDLE_DIR" && shasum -a 256 -c MANIFEST.sha256 >/dev/null)
  elif command -v sha256sum >/dev/null 2>&1; then
    (cd "$BUNDLE_DIR" && sha256sum -c MANIFEST.sha256 >/dev/null)
  else
    echo "WARN: no sha256 verifier available; manifest was not checked" >&2
  fi
fi

python3 - "$BUNDLE_DIR/PACKAGE.json" <<'PY'
import json
import pathlib
import sys
package = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
assert package["kind"] == "standalone-tool"
assert package["packageId"] == "diagram-video-tool"
assert package["version"] == "1.0.0"
print("verify.sh OK")
PY
