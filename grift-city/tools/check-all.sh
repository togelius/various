#!/usr/bin/env bash
# The whole gate: node suites, syntax and the release build, then every browser playtest one at a time (SwiftShader
# is CPU-bound and two browsers at once can exhaust memory). Prints one line per browser suite; exits non-zero if
# any fails.
set -uo pipefail
cd "$(dirname "$0")/.."
./tools/check-overhaul.sh || exit 1
status=0; logs="${TMPDIR:-/tmp}/grift-check"; mkdir -p "$logs"
for t in visual persistence vehicles enter_test docks_test repo_test rev_test missions_all soak pursuit; do
  out=$(timeout 1800 node "tools/playtest/tests/$t.js" 2>&1); code=$?; printf '%s\n' "$out" > "$logs/$t.log"
  bad=$(printf '%s\n' "$out" | grep -cE '^FAIL|PAGEERROR|Uncaught|TypeError|ReferenceError' || true)
  printf '%-12s exit=%s bad=%s\n' "$t" "$code" "$bad"
  if [ "$code" != 0 ] || [ "$bad" != 0 ]; then status=1; fi
done
[ $status = 0 ] || echo "logs in $logs"
exit $status
