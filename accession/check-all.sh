#!/usr/bin/env bash
# ACCESSION — every lint and test, then both builds and the browser checks (BUILD.md §10.2).
# Usage: ./check-all.sh                            every step; all must pass
#        ./check-all.sh --no-browser --allow-skip    without the browser checks (not for acceptance)
set -u
cd "$(dirname "$0")"
# A step that exits 77 could not run (Playwright missing): SKIPPED, which fails the run
# unless --allow-skip is given. Milestone acceptance never uses --allow-skip.
pass=(); fail=(); skip=()
allow_skip=0; for a in "$@"; do [ "$a" = "--allow-skip" ] && allow_skip=1; done
run() {
  local name="$1"; shift; local out code
  out="$("$@" 2>&1)"; code=$?
  if [ $code -eq 0 ]; then pass+=("$name"); echo "ok    $name: $(echo "$out" | tail -n 1)"
  elif [ $code -eq 77 ]; then skip+=("$name"); echo "SKIP  $name: $(echo "$out" | tail -n 1)"
  else fail+=("$name"); echo "FAIL  $name"; echo "$out" | sed 's/^/      /'; fi
}

run lint-core      node tools/lint-core.js
run lint-tools     node tools/lint-core.js tools/arena.js tools/monkey.js tools/replay.js tools/policies/*.js
run lint-numbers   node tools/lint-numbers.js
run lint-registry  node tools/lint-registry.js
run art-up-to-date node tools/build-art.js --check
# BUILD.md §12: every build the log links, dist/builds/<coreHash>.html, is kept.
run linked-builds  node tools/report.js --check-builds DEVELOPMENT.md
run tests          node test/run.js
# The short sims (§10.2 step 4): the short battery (tools/battery.js), alone, held to 60 s.
run short-sims     node test/run.js m3-battery
run build          python3 tools/build-single.py
# The revert test runs while there is a 3D view to remove; after a real revert there is not.
if [ -f js/view/board3d.js ]; then run revert-3d bash tools/revert-test.sh
else echo "ok    revert-3d: no 3D view in this tree, nothing to revert"; fi
# --no-browser does not run the browser checks: each prints SKIPPED, so the run fails
# unless --allow-skip is also given (BUILD.md §10.2).
no_browser=0; for a in "$@"; do [ "$a" = "--no-browser" ] && no_browser=1; done
for s in tools/browser/check-*.mjs; do
  [ -f "$s" ] || continue
  if [ $no_browser -eq 1 ]; then skip+=("$(basename "$s" .mjs)"); echo "SKIP  $(basename "$s" .mjs): --no-browser"
  else run "$(basename "$s" .mjs)" node "$s"; fi
done

echo
failed_names=""; [ ${#fail[@]} -gt 0 ] && failed_names=" (${fail[*]})"
skipped_names=""; [ ${#skip[@]} -gt 0 ] && skipped_names=" (${skip[*]})"
echo "check-all: ${#pass[@]} passed, ${#skip[@]} skipped${skipped_names}, ${#fail[@]} failed${failed_names}"
[ ${#fail[@]} -eq 0 ] && { [ ${#skip[@]} -eq 0 ] || [ $allow_skip -eq 1 ]; }
