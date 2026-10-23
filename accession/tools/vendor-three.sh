#!/usr/bin/env bash
# ACCESSION — builds vendor/three/three.iife.js from a pinned three.js release (BUILD.md §6.4).
# three.js ships as ES modules only, so esbuild bundles it into one IIFE that defines
# window.THREE, exporting only the names js/view/board3d.js uses (read from its source as
# T.Name), so the rest of three.js is shaken out. Run when the version or those names
# change; the output is committed and the game's build never touches the network.
set -euo pipefail
THREE_VERSION=0.180.0
ESBUILD_VERSION=0.25.10
here="$(cd "$(dirname "$0")/.." && pwd)"
names=$(grep -o 'T\.[A-Z][A-Za-z0-9]*' "$here/js/view/board3d.js" | cut -c3- | sort -u | paste -sd, -)
[ -n "$names" ] || { echo "no three.js names found in board3d.js" >&2; exit 1; }
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cd "$tmp"
npm init -y >/dev/null
npm install --no-audit --no-fund "three@$THREE_VERSION" "esbuild@$ESBUILD_VERSION" >/dev/null
echo "export { $names } from 'three';" > entry.js
npx esbuild entry.js --bundle --minify --format=iife --global-name=THREE --target=es2019 --legal-comments=none --outfile=three.iife.js
mkdir -p "$here/vendor/three"
{ echo "/* three.js r${THREE_VERSION#0.} (MIT, see LICENSE), bundled by tools/vendor-three.sh */"; cat three.iife.js; } > "$here/vendor/three/three.iife.js"
cp node_modules/three/LICENSE "$here/vendor/three/LICENSE"
sha=$(sha256sum "$here/vendor/three/three.iife.js" | cut -d' ' -f1)
bytes=$(wc -c < "$here/vendor/three/three.iife.js")
printf 'three %s\nesbuild %s\nexports %s\nbytes %s\nsha256 %s\n' "$THREE_VERSION" "$ESBUILD_VERSION" "$names" "$bytes" "$sha" > "$here/vendor/three/VERSION"
echo "vendor/three: three $THREE_VERSION, $bytes bytes, sha256 $sha"
