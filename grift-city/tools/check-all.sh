#!/usr/bin/env bash
# The whole gate: node suites, syntax and the release build, then every browser playtest one at a time (SwiftShader
# is CPU-bound and two browsers at once can exhaust memory). Prints one line per browser suite; exits non-zero if
# any fails.
set -uo pipefail
cd "$(dirname "$0")/.."
./tools/check-overhaul.sh || exit 1
# Python's timeout works on macOS as well as Linux; no GNU coreutils dependency.
python3 - <<'PYGATE'
import os, pathlib, re, subprocess, sys, tempfile
logs = pathlib.Path(tempfile.gettempdir()) / 'grift-check'
logs.mkdir(exist_ok=True)
failed = False
for name in ['visual', 'persistence', 'vehicles', 'enter_test', 'docks_test', 'repo_test', 'rev_test', 'missions_all', 'soak', 'pursuit']:
    try:
        result = subprocess.run(['node', f'tools/playtest/tests/{name}.js'], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=1800)
        output, code = result.stdout, result.returncode
    except subprocess.TimeoutExpired as error:
        output = error.stdout or b''
        if isinstance(output, bytes): output = output.decode(errors='replace')
        output += '\nTimed out after 30 minutes\n'
        code = 124
    (logs / f'{name}.log').write_text(output)
    bad = len(re.findall(r'^FAIL|PAGEERROR|Uncaught|TypeError|ReferenceError', output, re.MULTILINE))
    print(f'{name:12} exit={code} bad={bad}', flush=True)
    failed |= code != 0 or bad != 0
print(f'Browser logs: {logs}', flush=True)
sys.exit(1 if failed else 0)
PYGATE
