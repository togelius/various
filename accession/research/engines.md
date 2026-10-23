# ACCESSION: engine and stack options

Research note, 23 October 2026, for D12 in `accession/DESIGN.md`. Unity and the isometric probe are covered elsewhere. *(Unverified)* marks anything not checked against a primary source or a measurement here.

## Short answer

Keep D12: vanilla JavaScript, Canvas 2D, a pure integer core and a single-file build. Nothing here beats it for a phone-web game whose core must also run thousands of headless runs in Node. Two changes are worth making:

- make IndexedDB the primary save store, with localStorage as a mirror (§4);
- hold PixiJS 8 in reserve as a render-only layer, or three.js if the iso probe wins.

Godot 4.7 runs well in the container. Here, though, it costs:

- a 7–10 MB download on the phone;
- a second core, or a slower one;
- known iOS Safari risk.

## 1. Measured in this container

The container has 4 cores and no GPU, and was shared with other agents (load average 2–7), so expect about ±30% noise. Tools: Node 22.22.0, Chromium 141 (Playwright 1.56.1, SwiftShader) and the official Godot 4.7.2 Linux build, whose SHA-512 matched the release's `SHA512-SUMS.txt`.

| What | Result |
|---|---|
| Godot editor download and startup | 77.9 MB zip, unpacking to a 146 MB binary with only libc-level dependencies. Headless start reaches the first script line in about 145 ms; a trivial script takes about 0.3 s wall time (Node: 36 ms) |
| Flood fill: 40×27 grid, 10,000 fills (5,165,769 cells), 3 runs each | Node with `Int32Array`: **185–220 ms**. Typed GDScript: **2,147–2,642 ms (about 11–14×)**. Untyped GDScript: 5,216–5,608 ms (about 25–30×). Identical checksums |
| Godot `--import` / `--export-release "Web"`, headless | 9.6 s / 5.8 s for a toy project |
| Godot web export (single-threaded) | `index.wasm`: 39.5 MB raw, **10.1 MB gzip, 7.1 MB brotli**, plus 60 KB of JS (brotli). The full template bundle is 1.28 GB; the web template alone is 10.2 MB |
| That export in headless Chromium, from localhost | `_ready` 1.9–2.3 s after navigation. Flood fill in the browser: GDScript (wasm) 488–575 µs per fill, JavaScript in the same page 20–35 µs |
| Screenshot tests | Godot `--headless` cannot capture (the dummy renderer returns no image). Under Xvfb with Mesa llvmpipe: 9.1 s cold, 0.9 s warm. Playwright Chromium canvas shot at 390×844 @3×, launch included: **0.5–0.7 s** |
| Minimal-app bundles (esbuild, minified), brotli | Phaser 4.2.1: **297 KB** (1.39 MB raw). PixiJS 8.22.0: **126 KB**. Kaplay 3001.0.19: 60 KB. Excalibur 0.32.0: 104 KB. three.js 0.186.1: **110 KB**. Babylon.js 9.32.0: 270 KB. All of `vanguard-zero.html`, art and music included: **58 KB** |
| Plain `import` in Node 22 | Phaser and Excalibur throw `window is not defined`; PixiJS, three.js and Babylon load |
| Save survival after SIGKILL of the whole browser (Chromium) | Godot `user://`: lost when killed immediately (2/2), kept from 10 ms on (7/7). `localStorage`: **lost when killed 0–3 s after the write (6/6)**; kept at 5–12 s and after a normal close (4/4) |
| TypeScript | Node 22.22.0 runs `.ts` directly (type stripping) |

The flood-fill benchmark (Godot and Node) is in [`../prototypes/bench/godot/`](../prototypes/bench/godot/). The browser-kill save test was rewritten to be self-contained as [`../prototypes/save-kill/savekill.cjs`](../prototypes/save-kill/savekill.cjs); the other probe scripts were not kept.

## 2. Options

### 2.1 Vanilla JavaScript and Canvas 2D (the D12 plan)

**What it keeps.**
- One file, `file://`, no dependencies.
- One core for the browser, the bots and the gate.
- The fastest headless simulation measured here.
- Node and Playwright tests, both already installed here. Playwright's WebKit (for D12's cross-engine hash test) is a 99 MB download, reachable through the proxy but not installed.

**What it gives up:**
- GPU batching and a scene graph;
- tween, particle and camera libraries;
- shader lighting and filters.

At 16-pixel tiles, turn by turn, each is a small module. The repo already hand-rolls effects (`vanguard-zero/js/fx.js`) and a real-time Web Audio synth (`vanguard-zero/js/audio.js`).

The three light bands map onto the palette-indexed sprites as per-tile ramp shifts and dither masks: exact, cheap and readable. Without WebGL the real costs are soft dynamic light, bloom, and hundreds of blended particles at 3× pixel density *(unverified on a phone)*. Redrawing only when something changes saves battery.

**Audio, for every web option.** Phone audio latency was not measured. iOS mutes Web Audio with the ringer switch unless the page sets `navigator.audioSession.type = "playback"` ([MDN](https://developer.mozilla.org/docs/Web/API/AudioSession/type), [WebKit bug 251532](https://bugs.webkit.org/show_bug.cgi?id=251532)).

**TypeScript.** JSDoc types checked by `tsc --noEmit` need no build step. `.ts` source needs a bundle step for the browser; the single-file build survives that.

### 2.2 JavaScript frameworks

Every framework below is free, and each can render a pure core. None replaces that core headless, so the core stays engine-free. Testing is the same for all: Vitest or `node:test` on the core, Playwright for pixels and input. All unify mouse and touch as pointers.

**Phaser 4 (MIT)**
- **Status.** 4.0.0 shipped on 10 April 2026; 4.2.1 is current (9 July). The last 3.x is 3.90.0 (May 2025), and phaser.io advises new projects not to start on v3 ([phaser.io, 13 May 2026](https://phaser.io/news/2026/05/phaser-3-vs-phaser-4)).
- **What changed in v4.** A rebuilt WebGL renderer, sprite lighting, filters and `TilemapGPULayer`. Mesh and Plane were removed, so there is no 3D. The 4.2.1 source keeps a Canvas renderer and the `HEADLESS` mode.
- **What it brings.** A full toolkit (tweens, particles, cameras, scaling, audio).
- **Cost.** About 300 KB brotli. The `dist` build can be inlined to keep one file.

**PixiJS 8 (MIT, 8.22.0, 1 October 2026)**
- A renderer only (WebGL or WebGPU), with no Node rendering without a custom adapter ([docs](https://pixijs.com/8.x/guides/concepts/environments)).
- The cheapest way to add a GPU later.

**Kaplay (MIT)**
- Small, but the stable 3001.0.19 is from June 2025 and v4000 is still in alpha (May 2026).

**Excalibur (BSD-2-Clause, 0.32.0, December 2025)**
- Pre-1.0 and TypeScript-first.
- WebGL with a Canvas 2D fallback.

**three.js (MIT, 0.186.1) and Babylon.js (Apache-2.0, 9.32.0, 22 October 2026)**
- The 3D and isometric route, as a render layer.
- three.js is lighter; Babylon.js has a `NullEngine` for Node that does not render ([docs](https://doc.babylonjs.com/setup/support/serverSide)).

### 2.3 Godot 4.7 (MIT)

**Status.** 4.7 shipped in mid-June 2026, 4.7.1 on 14 July and 4.7.2 on 18 August (commit `ed1daf0bf`, the build tested here) ([4.7.2](https://godotengine.org/article/maintenance-release-godot-4-7-2/), [4.7.1](https://godotengine.org/article/maintenance-release-godot-4-7-1/)).

**Web export** ([4.7 docs](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)):
- **Renderer.** Only the WebGL 2 Compatibility renderer.
- **Threads.** Single-threaded export is the default since 4.3. Threaded export needs `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`.
- **Safari and C#.** The docs warn of Safari WebGL 2 issues, and say C# projects "currently cannot be exported to the web".
- **iOS.** Community reports from the 4.3–4.4 era describe memory reloads, WebGL context loss and loading hangs ([progress report](https://godotengine.org/article/progress-report-web-export-in-4-3/), [forum](https://forum.godotengine.org/t/webgl-context-loss-and-app-crash-in-godot-4-3-exported-web-on-ios-browsers/81024)), not checked for 4.7.
- **Audio.** Default sample playback has low latency but no effects or procedural audio. Stream playback adds latency without threads, so the repo's synth would have to pre-render to samples.
- **`file://`.** Not expected to work *(unverified)*.

**Headless use and tests** ([command line](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html)).
- **Container.** Fully usable (§1).
- **GUT 9.x.** `-s addons/gut/gut_cmdln.gd -gexit`, with JUnit XML output ([docs](https://gut.readthedocs.io/en/latest/Command-Line.html)).
- **gdUnit4 6.2.0.** `runtest.sh`, with HTML and JUnit reports ([docs](https://godot-gdunit-labs.github.io/gdUnit4/latest/advanced_testing/cmd/)).
- **Not run here.** The proxy denied GitHub requests for both projects.
- **CI caveat.** Tested: a script that hits a runtime error never reaches `quit()` and hangs, so CI needs timeouts.

**Editing by an AI.** Scripts, `.tscn` and `.tres` files are text ([TSCN](https://docs.godotengine.org/en/stable/engine_details/file_formats/tscn.html)). Since 4.4, `.uid` sidecars must be committed and moved with their files ([Godot, January 2025](https://godotengine.org/article/uid-changes-coming-to-godot-4-4/)).

**MCP servers.** All are community projects, in two kinds:
- **No editor needed:**
  - `godot-mcp-runtime` 3.8.1 (September 2026) edits scenes without an editor window. Its screenshots and input on a running game need a display: here, Xvfb.
  - `@coding-solo/godot-mcp` 0.1.1.
- **Need a running editor:** `godot-mcp-bridge` 1.2.1 and `godot-ai` 4.3.0.

**Mac** ([docs](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_macos.html)).
- **Signing.** A Universal 2 `.app` can be exported and signed from Linux (`rcodesign`). Unsigned downloads are blocked by Gatekeeper.
- **Input.** Native builds treat Control-click as a right click ([source](https://github.com/godotengine/godot/blob/4.7-stable/platform/macos/godot_content_view.mm)).

**Web saves.** `user://` lives in IndexedDB.
- **How it syncs** ([source](https://github.com/godotengine/godot/blob/4.7-stable/platform/web/os_web.cpp)). Closing a written file marks the store dirty, and the sync starts at the next main-loop iteration.
- **Hidden tabs.** Hidden tabs pause that loop, so a save made just before hiding may wait until the tab is visible again *(inferred from the source, not tested)*.

**Fit.** The shared core would have to be one of:
- GDScript, with a gate about 11–14× slower than Node;
- a duplicate in JavaScript, which risks the two diverging;
- C#, which has no web export.

### 2.4 Defold and Bevy

- **Defold.** Lua; free under a source-available licence. Its web builds are tiny: an empty HTML5 project was 1.06 MB in 1.12.4 ([Defold, May 2026](https://defold.com/2026/05/04/Defold-1-12-4/)). But a Lua core cannot be shared with Node bots, so it is worth a look only if the JavaScript core is dropped.
- **Bevy 0.20.0** (8 October 2026). Not worth considering here:
  - Rust, with no stable editor;
  - 0.x releases break compatibility every few months;
  - multi-megabyte wasm *(unverified for 0.20)*;
  - slow compiles on 4 cores.

## 3. Comparison

| | Vanilla JS + Canvas 2D (D12) | Phaser 4 / PixiJS 8 | three.js / Babylon.js | Godot 4.7 |
|---|---|---|---|---|
| **Look** | Pixel-exact; palette-ramp light and dither; no shaders | WebGL filters, shader light, particles | True 3D or iso, real lights | Full 2D toolkit; web limited to the Compatibility renderer |
| **Feel** | Hand-rolled tweens and effects (the repo already has them); Web Audio synth | Phaser has built-in tweens and particles; Pixi needs add-ons | Tweens by hand or from a library | Best animation tooling; on the web, no procedural audio at low latency |
| **Auto-testability, headless simulation** | Same file runs in Node; fastest; screenshots 0.5–0.7 s | Same as vanilla while the core stays engine-free | Same as vanilla | Works headless, but GDScript 11–14× slower; screenshots need Xvfb |
| **Phone web: load and performance** | About 60–100 KB brotli | Adds 126–297 KB | Adds 110–270 KB | 7.1–10.1 MB wasm; about 2 s to `_ready` on desktop; iOS risk |
| **Mac with a single-button mouse** | Pointer events; limited only by the design | Same | Same | Same; a native `.app` needs signing |
| **Autosave on the web** | Full control of the store and of flushing | Same | Same | IndexedDB synced on the next frame; a gap when the tab is hidden |
| **AI-assisted development in cloud containers** | All text; Node and Chromium already present | npm and a bundler; v4 renamed some v3 APIs, which models may still write | npm | Headless works; text scenes, but `.uid` files and an import cache; community MCP servers |
| **Licence and cost** | Free (MIT) | MIT | MIT / Apache-2.0 | MIT; Apple Developer ID for signed Mac builds |
| **Fit with the repo's convention** | Exact | Partial (inline `dist` to keep one file) | Partial | Breaks it: separate project, export step, no `file://` |
| **Explainability of results** | One core: a gate seed replays identically in the browser | Same, if rules never depend on framework timing | Same | Only with a GDScript core (slower gate) or two cores (divergence) |

## 4. Autosave on the web

**What the kill test shows.**
- **localStorage.** Chromium held the writes in memory for seconds. This fits its DOM-storage commit timer, whose first delay a reviewer gives as 5 s ([Chromium review, 2015](https://codereview.chromium.org/1140013003)).
- **IndexedDB.** Writes survived from about 10 ms on. Chrome's default "relaxed" durability (since Chrome 121) writes to the OS without forcing it to disk ([Chrome blog](https://developer.chrome.com/blog/indexeddb-durability-mode-now-defaults-to-relaxed/)).
- **Tab kills.** These probably keep both stores *(unverified; iOS not tested)*.
- **Rerun with the self-contained script** (23 October 2026, Chromium, 3 trials per delay): localStorage survived 0 of 18 kills made 0–4 s after the write and 3 of 3 at 8 s; IndexedDB survived all 21, including kills made immediately after its transaction completed.

**Safari's policies.**
- **7-day cap.** After seven days of Safari use without interaction, all script-writable storage is deleted. Home Screen web apps keep their own day counter ([WebKit, 2020](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)).
- **Persistence and eviction.** Safari 17+ grants `persist()` by heuristic and otherwise evicts the least recently used origins ([WebKit, 2023](https://webkit.org/blog/14403/updates-to-storage-policy/)).

**Chrome's guidance.** Chrome calls the hidden state "the last reliable time to save" ([Page Lifecycle, updated 16 October 2026](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)).

**Proposed change to default 41.**
1. After every action, write the snapshot to IndexedDB: two alternating keys with checksums, in one transaction.
2. Mirror the same snapshot to localStorage.
3. Write again when the page becomes hidden (`visibilitychange`) and on `pagehide`.
4. Ask for `persist()` and invite players to install the web app.
5. Keep the visitor's card.
6. Run this kill harness in CI on Chromium and WebKit, and test once on a real iPhone.

## 5. Mac with a single-button mouse

**Design rules.**
- **Click = tap.** One click or tap moves, attacks or interacts (tap-to-path).
- **No hover-only information.** Hover may preview on a Mac, but touch has no hover.
- **Examine on screen.** An examine button, plus a second tap on an already-selected tile; long press as an extra. Never right-click or Control-click alone: Apple calls context menus "hidden by default" ([HIG](https://developer.apple.com/design/human-interface-guidelines/context-menus)), and GNOME warns against relying on controls only some pointing devices have ([GNOME HIG](https://developer.gnome.org/hig/guidelines/pointer-touch.html)).
- **Zoom and drag.** Zoom has buttons; dragging is never the only way to do something.
- **Action strip.** Wait, inventory, quickslots, examine and menu are always visible, identical on phone and Mac.
- **Keyboard as an extra.** Arrows, WASD and numpad move; space waits; `x` examines.

**Implementation.** Pointer Events with `touch-action: none` on the canvas. A `contextmenu` event becomes an examine shortcut, with `preventDefault()`. No engine above makes any of this harder.

## 6. Wrapping as a native Mac app

- **Tauri 2** (CLI 2.12.4) uses the system WKWebView, so builds are a few MB *(unverified)*. It needs Rust, and saves can go through native files ([docs](https://v2.tauri.app/concept/size/)).
- **Electron 45.0.0** bundles Chromium; its `darwin-arm64` runtime zip alone is 120.7 MB (measured).
- **A small Swift WKWebView app** loading the single HTML file is the smallest option, but needs Xcode.
- **All native routes** need a Developer ID and notarisation.

## 7. Bottom line

1. **Stack.** Stay with D12, optionally with JSDoc types.
2. **Saves.** Strengthen default 41 as in §4.
3. **Rendering.** Add PixiJS 8 (or three.js, if 3D) only as a render layer, if the look demands it.
4. **Godot.** A good engine with a container-friendly command line, but it means 7–10 MB on phones, iOS risk, and a slower gate or two cores. Revisit only if native-first.
5. **Defold and Bevy.** Not worth pursuing.

## 8. What could not be verified

- **No phone was available.** Load time, frame rate, memory, audio latency and iOS behaviour are unmeasured, including Godot 4.7 on iOS Safari and tab-kill durability on WebKit.
- **Not run:** GUT, gdUnit4 and the MCP servers (claims come from their documentation).
- **Not checked:**
  - Godot from `file://`;
  - the size of custom Godot templates;
  - Tauri, WKWebView and Bevy sizes;
  - Defold's current version;
  - Control-click in macOS browsers.
- **The benchmarks ran on a shared container** under load from other agents.

## Sources

Checked 23 October 2026 unless dated.

- **Version data.**
  - npm registry: phaser, pixi.js, kaplay, excalibur, three, @babylonjs/core, electron, @tauri-apps/cli, Godot MCP packages. PyPI: godot-ai.
  - Bevy: [crates.io](https://crates.io/crates/bevy).
  - Godot: [download page](https://godotengine.org/download/linux/) and its [checksums](https://github.com/godotengine/godot-builds/releases/download/4.7.2-stable/SHA512-SUMS.txt).
- **Everything else** (the Godot 4.7 documentation and source, framework and web-platform pages) is linked inline above.
