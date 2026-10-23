#!/usr/bin/env bash
# ACCESSION — removes the 3D board view, leaving the game top-down only (BUILD.md §6.3).
# Deletes the renderer, three.js, their tools and checks, the two placeholders in
# index.html and three.js's entries in the asset ledger. Nothing else needs editing: the
# build inlines whatever placeholders index.html still has, the settings line disappears
# with the second view, and multi-view tests loop over Views.list(). The revert test runs
# this in a temporary copy on every check-all.sh.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf js/view/board3d.js vendor/three tools/vendor-three.sh tools/browser/check-3d.mjs
python3 - <<'PY'
import json, os, re
html = open('index.html', encoding='utf-8').read()
html = re.sub(r'<script type="text/x-three"[^>]*></script>\n?', '', html)
html = html.replace('<script src="js/view/board3d.js"></script>\n', '')
open('index.html', 'w', encoding='utf-8').write(html)
if os.path.exists('art/ledger.json'):
    led = json.load(open('art/ledger.json', encoding='utf-8'))
    led['entries'] = [e for e in led['entries'] if not e['file'].startswith('vendor/three/')]
    open('art/ledger.json', 'w', encoding='utf-8').write(json.dumps(led, indent=1, ensure_ascii=False) + '\n')
PY
# Last, the revert's own machinery, which has nothing left to do.
rm -f tools/revert-test.sh tools/3d-allowlist.txt tools/remove-3d.sh
echo "remove-3d: the 3D board view is gone; the game is top-down only"
