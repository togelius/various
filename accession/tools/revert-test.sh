#!/usr/bin/env bash
# ACCESSION — the revert test (BUILD.md §6.3): copy the game to a temporary directory,
# remove the 3D view there with tools/remove-3d.sh, then build, run the Node tests, check
# the build holds no trace of three.js, and run the browser smoke and screen checks.
# Exits 77 (SKIPPED) if the browser checks could not run.
#   tools/revert-test.sh                  all of it, one step after another
#   tools/revert-test.sh --prepare <dir>  only the copy, the removal, the build and the trace
#                                         check, in <dir> (empty), which it keeps: check-all's
#                                         pool then runs each Node test file and the smoke and
#                                         screen checks there as jobs of their own (§10.2)
set -uo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
if [ "${1:-}" = "--prepare" ]; then
  [ -n "${2:-}" ] && [ -d "$2" ] || { echo "revert-3d: --prepare takes an empty folder"; exit 1; }
  tmp="$(cd "$2" && pwd)"; prepare_only=1
else
  tmp="$(mktemp -d)"; prepare_only=0
  trap 'rm -rf "$tmp"' EXIT
fi
tar -C "$here" --exclude=./prototypes --exclude=./research --exclude=./review --exclude=./design \
  --exclude=./dist --exclude=./test/shots -cf - . | tar -C "$tmp" -xf -
# The release builds stay (BUILD.md §3.6): a retired golden run is played in its build's core
# (§3.5), and the copy's own build writes only dist/'s two pages beside them.
if [ -d "$here/dist/builds" ]; then mkdir -p "$tmp/dist" && cp -R "$here/dist/builds" "$tmp/dist/builds"; fi
cd "$tmp"
fail() { echo "revert-3d: $*"; exit 1; }
bash tools/remove-3d.sh >/dev/null || fail "remove-3d.sh failed"
python3 tools/build-single.py >/dev/null || fail "the build failed without 3D"
grep -q -e 'x-three' -e 'WebGLRenderer' dist/accession.html && fail "dist/accession.html still holds three.js"
size=$(wc -c < dist/accession.html)
if [ $prepare_only -eq 1 ]; then echo "revert-3d: without 3D the build ($size bytes)"; exit 0; fi
out="$(node test/run.js 2>&1)" || { echo "$out"; fail "Node tests failed without 3D"; }
skipped=0
for s in check-smoke check-screens; do
  [ -f "tools/browser/$s.mjs" ] || continue
  o="$(node "tools/browser/$s.mjs" 2>&1)"; c=$?
  [ $c -eq 77 ] && { skipped=1; continue; }
  [ $c -eq 0 ] || { echo "$o"; fail "$s failed without 3D"; }
done
[ $skipped -eq 1 ] && { echo "SKIPPED: browser checks could not run (build without 3D: $size bytes)"; exit 77; }
echo "revert-3d: without 3D the build ($size bytes), $(echo "$out" | tail -n 1 | sed 's/^tests: //'), smoke and screens pass"
