#!/usr/bin/env bash
# ACCESSION — builds vendor/three/three.iife.js from a pinned three.js release (BUILD.md §6.4).
# three.js ships as ES modules only, so esbuild bundles it into one IIFE that defines
# window.THREE. Run once per version change; the output is committed and the game's build
# never touches the network.
set -euo pipefail
THREE_VERSION=0.180.0
ESBUILD_VERSION=0.25.10
here="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cd "$tmp"
npm init -y >/dev/null
npm install --no-audit --no-fund "three@$THREE_VERSION" "esbuild@$ESBUILD_VERSION" >/dev/null
echo "export * from 'three';" > entry.js
npx esbuild entry.js --bundle --minify --format=iife --global-name=THREE --target=es2019 --legal-comments=none --outfile=three.iife.js
mkdir -p "$here/vendor/three"
{ echo "/* three.js r${THREE_VERSION#0.} (MIT, see LICENSE), bundled by tools/vendor-three.sh */"; cat three.iife.js; } > "$here/vendor/three/three.iife.js"
cp node_modules/three/LICENSE "$here/vendor/three/LICENSE"
sha=$(sha256sum "$here/vendor/three/three.iife.js" | cut -d' ' -f1)
printf 'three %s\nesbuild %s\nsha256 %s\n' "$THREE_VERSION" "$ESBUILD_VERSION" "$sha" > "$here/vendor/three/VERSION"
echo "vendor/three: three $THREE_VERSION, $(wc -c < "$here/vendor/three/three.iife.js") bytes, sha256 $sha"
