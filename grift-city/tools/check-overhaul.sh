#!/usr/bin/env bash
# From any directory: run the dependency-free simulation checks and rebuild the release.
set -euo pipefail
cd "$(dirname "$0")/.."
for source in js/*.js; do node --check "$source"; done
for suite in gameplay-polish character-geometry character-motion vehicle-geometry control-foundation weighted-skin streets driving decisions city-continuity audio-mix campaign-node getaway; do
  node "test/$suite.js"
done
python3 tools/build-single.py
git diff --check -- .
