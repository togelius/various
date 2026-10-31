#!/usr/bin/env bash
# ACCESSION — every lint and test, both builds and the browser checks (BUILD.md §10.2).
# Usage: ./check-all.sh                  every step, all must pass: the full check, which every
#                                        landing on main passes
#        ./check-all.sh --fast [--with revert-3d,check-3d,check-keys,check-touch]
#                                        a builder's check: leaves out the revert test and the three
#                                        longest browser checks, except those --with names
#        ./check-all.sh --no-browser --allow-skip    without the browser checks (not for acceptance)
#        ./check-all.sh --list [--fast …]  the steps and the pool's jobs, without running them
#        ./check-all.sh --timings          the full check, also recording test/timings.json
# It runs the lints, then the Node tests (ACCESSION_TEST_JOBS workers, default 4, the longest
# file first), then the build, then one pool of ACCESSION_CHECK_JOBS slots (default 4;
# tools/pool.js) holding, longest first, the short sims, every browser check, and the revert
# test's jobs (the reverted copy made and built, each of its Node test files, its smoke and
# screen checks). Each step prints its wall and CPU time, and the end a table of them.
set -u
cd "$(dirname "$0")"
# A step that exits 77 could not run (Playwright missing): SKIPPED, which fails the run
# unless --allow-skip is given. Milestone acceptance never uses --allow-skip.
res="$(mktemp)"; trap 'rm -f "$res"' EXIT; trap 'exit 130' INT TERM
node tools/pool.js --begin --results "$res" "$@" || exit 2
# Each step is run and timed by the pool's step timer, which records how it went in $res; if the
# timer itself stops, the step is recorded as failed.
run() {
  local name="$1"; shift
  node tools/pool.js --step "$name" --results "$res" ${flags[@]+"${flags[@]}"} -- "$@" || echo "step $name fail 0 0" >> "$res"
}
flags=("$@"); timings=(); for a in "$@"; do [ "$a" = "--timings" ] && timings=(--write-timings); done

run lint-core      node tools/lint-core.js
run lint-tools     node tools/lint-core.js tools/arena.js tools/monkey.js tools/replay.js tools/policies/*.js
run lint-numbers   node tools/lint-numbers.js
run lint-registry  node tools/lint-registry.js
run art-up-to-date node tools/build-art.js --check
# BUILD.md §12: every build the log links, dist/builds/<coreHash>.html, is kept.
run linked-builds  node tools/report.js --check-builds DEVELOPMENT.md
run tests          node test/run.js ${timings[@]+"${timings[@]}"}
run build          python3 tools/build-single.py
# The pool: the short sims (§10.2: tools/battery.js, held to 60 CPU-s), every
# tools/browser/check-*.mjs, and the revert test (§6.3) while there is a 3D view to remove.
# --no-browser does not run the browser checks: each prints SKIPPED, so the run fails unless
# --allow-skip is also given.
node tools/pool.js --check-all --results "$res" "$@" || echo "group pool fail 0 0" >> "$res"
node tools/pool.js --summary --results "$res" "$@"
