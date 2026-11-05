#!/usr/bin/env bash
# Idempotent dependency bootstrap for the `various` monorepo.
#
# Every project here is deliberately zero-dependency at runtime: the browser
# games are plain HTML/JS with no build step, and roguelius uses only the
# Python standard library. Nothing needs to be installed to *run* them.
#
# The one exception is tooling: grift-city/ and vanguard-zero/ ship headless
# playtest/screenshot tools that drive the game in a real browser via
# Playwright + Chromium. We install those into a repo-root node_modules (which
# .gitignore already excludes) so the tools' `require('playwright')` resolves.
set -euo pipefail

cd "$(dirname "$0")/.."

# Playwright client library -> ./node_modules (gitignored).
npm install playwright

# Browser binaries -> ~/.cache/ms-playwright (persists in the snapshot).
npx --yes playwright install chromium

# Keep the repository manifest-free: npm writes these, but they are not part of
# this repo (node_modules and package-lock.json are already gitignored, and the
# repo intentionally has no package.json).
rm -f package.json package-lock.json

echo "install: playwright + chromium ready; all projects run with no build step."
