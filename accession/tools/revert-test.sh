#!/usr/bin/env bash
# ACCESSION — the revert test (BUILD.md §6.3): copy the game to a temporary directory,
# remove the 3D view there with tools/remove-3d.sh, then build, run the Node tests, check
# the build holds no trace of three.js, and run the browser smoke and screen checks.
# Exits 77 (SKIPPED) if the browser checks could not run.
set -uo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
tar -C "$here" --exclude=./prototypes --exclude=./research --exclude=./review --exclude=./design \
  --exclude=./dist --exclude=./test/shots -cf - . | tar -C "$tmp" -xf -
cd "$tmp"
fail() { echo "revert-3d: $*"; exit 1; }
bash tools/remove-3d.sh >/dev/null || fail "remove-3d.sh failed"
python3 tools/build-single.py >/dev/null || fail "the build failed without 3D"
out="$(node test/run.js 2>&1)" || { echo "$out"; fail "Node tests failed without 3D"; }
grep -q -e 'x-three' -e 'WebGLRenderer' dist/accession.html && fail "dist/accession.html still holds three.js"
skipped=0
for s in check-smoke check-screens; do
  [ -f "tools/browser/$s.mjs" ] || continue
  o="$(node "tools/browser/$s.mjs" 2>&1)"; c=$?
  [ $c -eq 77 ] && { skipped=1; continue; }
  [ $c -eq 0 ] || { echo "$o"; fail "$s failed without 3D"; }
done
size=$(wc -c < dist/accession.html)
[ $skipped -eq 1 ] && { echo "SKIPPED: browser checks could not run (build without 3D: $size bytes)"; exit 77; }
echo "revert-3d: without 3D the build ($size bytes), $(echo "$out" | tail -n 1 | sed 's/^tests: //'), smoke and screens pass"
