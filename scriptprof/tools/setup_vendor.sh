#!/usr/bin/env bash
# Fetch and build the vendored PuzzleJAX / script-doctor engine for ScriptProf.
#
#   tools/setup_vendor.sh
#
# Creates vendor/script-doctor (pinned), vendor/script-doctor/PuzzleScript
# (pinned upstream engine sources), applies vendor-patches/script-doctor.patch
# (rule-firing counters, Node compatibility), builds a Python venv and the C++
# extension. Requires: git, node, uv.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SD_COMMIT=7b46a9a6f5ce82b8e9b66f3bc722d247b37ce93e
PS_COMMIT=d236596d993b6ebb7988f1a078f582c0840ccbca
mkdir -p "$ROOT/vendor"
cd "$ROOT/vendor"
if [ ! -d script-doctor ]; then
  git clone https://github.com/smearle/script-doctor.git
fi
cd script-doctor
git fetch -q origin "$SD_COMMIT" || true
git checkout -q "$SD_COMMIT"
if [ ! -d PuzzleScript ]; then
  git clone https://github.com/increpare/PuzzleScript.git
fi
(cd PuzzleScript && git fetch -q origin "$PS_COMMIT" || true; git checkout -q "$PS_COMMIT")
git apply --check "$ROOT/vendor-patches/script-doctor.patch" 2>/dev/null && git apply "$ROOT/vendor-patches/script-doctor.patch" || echo "patch already applied or failed; check manually"
if [ ! -d .venv ]; then
  uv venv -q -p 3.13 .venv
fi
grep -v -E '^(#|$)|jax\[cuda\]|selenium|webdriver|wandb|hydra-submitit|submitit|opencv|scikit-image|javascript==' requirements.txt > /tmp/scriptprof-req.txt
uv pip install -q -p .venv/bin/python -r /tmp/scriptprof-req.txt pybind11 setuptools
.venv/bin/python setup_cpp.py build_ext --inplace
echo "vendor ready: $ROOT/vendor/script-doctor"
