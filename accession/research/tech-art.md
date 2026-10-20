# Technical architecture and the art, text, audio and LLM pipeline

*Research brief for the museum roguelike. Topic: platform, architecture, 16-bit art without an art team, label text, audio, and the logistics of LLM generation. Written 2026-10-20. Prices and versions were checked that day.*

This brief takes the sibling briefs' content position as given: `papers-semantic.md` recommends a curated, accession-numbered pool with an optional runtime LLM later, and `book-pcg.md` and `papers-levels.md` cover generator methods. This brief asks what the machine has to look like for that position to work, and what it would cost to go further.

---

## 1. Sources actually read

**The repository (read, not skimmed, unless noted).**
- `README.md`, `AGENTS.md`, `CLAUDE.md`, `LICENSE` (MIT).
- `steelhag2/DESIGN.md`: D1 (engine), §2.10 (tech stance), §9.2 (file layout, the "site contract"), §9.3 (milestones with acceptance tests), §11.4–11.8 (harness, schedule, risk register, "what not to build").
- `grift-city/README.md`: "How it is put together", "Saving and regression checks", "Imported art". Also `grift-city/DEVELOPMENT.md`, `tools/build-single.py`, `tools/check-all.sh` and `tools/assets/SOURCES.md`.
- `vanguard-zero/README.md`, `js/art.js` (sprite decoder, 5×7 font), `js/sprites.js` (palette-indexed grids), `js/audio.js` and `js/music.js` (tracker with an S-DSP-style echo), `tools/build-single.js`, `tools/agent/README.md`.
- `absorb-this/tools/README.md` and the header of `personas.cjs`.
- `scriptprof/README.md`, `js/evolve.js` (UMD wrapper, seeded LCG, MAP-Elites), `test/check.js`.
- `roguelius/README.md` and `roguelius.py` (autoplay and balance statistics).
- `jevslop/README.md` and `textstats.py`.
- `gasp/README.md` (grep only).

**The book.** G. N. Yannakakis and J. Togelius (2025), *Artificial Intelligence and Games*, 2nd ed., Springer. I read §8.5.4 "LLMs" (pp. 279–281), §9.2 "Visuals" (pp. 289–292), §9.3 "Audio" (pp. 292–294) and §9.7.3 "How Can We Evaluate a Generator?" (pp. 306–309), and resolved their reference numbers in the bibliography.

**Papers (read as stated).**
- M. Zammit, A. Liapis, G. N. Yannakakis (2024). "CrawLLM: Theming Games with Large Language Models." IEEE Conference on Games (2-page demo). Read in full. https://www.antoniosliapis.com/papers/crawllm_theming_games_with_large_language_models.pdf
- M. Zammit, A. Liapis, G. N. Yannakakis. "CrawLLM: An LLM-Based Pipeline for Game Asset Generation." Authors' preprint; venue and year unverified. I read §III (model choice, tileset and spritesheet generation). https://www.antoniosliapis.com/papers/crawllm_an_llm-based_pipeline_for_game_asset_generation.pdf
- T. Merino, R. Negri, D. Rajesh, M. Charity, J. Togelius (2023). "The Five-Dollar Model: Generating Game Maps and Sprites from Sentence Embeddings." AIIDE 2023. Abstract only. https://arxiv.org/abs/2308.04052
- B. Zou, M. Cai, J. Zhang, Y. J. Lee (2024). "VGBench: Evaluating Large Language Models on Vector Graphics Understanding and Generation." arXiv:2407.10972. Abstract only.
- A. Nedungadi, S. Oehmcke, S. Lüdtke (2026). "Autoregressive Mosaics: Probing 2D Spatial Reasoning in Text-Only Language Models." arXiv:2608.30751, preprint. Abstract only.
- A. Saravanan, M. Guzdial (2022). "Pixel VQ-VAEs for Improved Pixel Art Representation." EXAG 2022, arXiv:2203.12130. Abstract only.

**Cited through the book's bibliography (not re-read).**
- Scirea, Eklund, Togelius, Risi (2018). "Evolving in-game mood-expressive music with MetaCompose." Audio Mostly 2018 [998].
- Lopes, Liapis, Yannakakis (2015). "Sonancia: Sonification of procedurally generated game levels." ICCC Workshop on Computational Creativity & Games [651].
- Holmgård, Liapis, Togelius, Yannakakis (2014). "Evolving personas for player decision modeling." IEEE CIG [450].
- Smith, Whitehead (2010). "Analyzing the expressive range of a level generator." PCG Workshop [1046].
- Liapis, Yannakakis, Nelson, Preuss, Bidarra. "Orchestrating game generation." IEEE Transactions on Games 11(1):48–68 (2019; listed as 2018 in the book) [626].
- Gallotta et al. (2024). "Large language models and games: A survey and roadmap." IEEE Transactions on Games [357].

**Software, licences and documentation (checked 2026-10-20).**
- **rot.js 2.2.1.** npm, BSD-3-Clause, last release 2024-11-13. I read the tarball's `license.txt`, `lib/rng.js`, `lib/map/digger.js` and `lib/map/cellular.js`, and benchmarked it (F4).
- **Other libraries (npm registry; bundle sizes measured from jsDelivr).** Phaser 4.2.1 (MIT; min.js 1.38 MB, 355 KB gzipped), PixiJS 8.22.0 (MIT; 841 KB, 237 KB gzipped), ZzFX 1.3.2 (MIT; 10 KB, 3.5 KB gzipped), Tone.js 15.1.22 (MIT), ajv 8.20.0 and zod 4.6.7 (MIT), idb-keyval 6.3.0 (Apache-2.0), @mlc-ai/web-llm 0.2.86 (Apache-2.0), and @anthropic-ai/sdk 0.135.0 (MIT). The SDK README says browser use is "disabled by default… Enable browser support by explicitly setting `dangerouslyAllowBrowser` to `true`."
- **Godot.** "Exporting for the Web", Godot 4.7 docs: https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html
- **WebKit storage.**
  - J. Wilander, "Full Third-Party Cookie Blocking and More", WebKit blog, 2020-03-24: https://webkit.org/blog/10218/
  - S. Liu, "Updates to Storage Policy", WebKit blog, 2023-08-10: https://webkit.org/blog/14403/
- **Art.**
  - Dungeon Crawl 32×32 tiles on OpenGameArt: CC0, over 3,000 tiles, "No attribution is required." https://opengameart.org/content/dungeon-crawl-32x32-tiles
  - Kenney Tiny Dungeon (16×16, CC0) and 1-Bit Pack (16×16, 1,078 files, CC0): https://kenney.nl/assets/tiny-dungeon and https://kenney.nl/assets/1-bit-pack
  - Z. Fedoran's `pixel-sprite-generator` (MIT, 2014): README, LICENSE and source read. It is a JavaScript version of Dave Bollinger's "pixelrobots" and "pixelspaceships". Bollinger's own archived page could not be fetched, so his dates are unverified.
- **Fonts.**
  - m5x7 by Daniel Linssen (CC0, itch page) and monogram by datagoblin (CC0, itch page).
  - Tiny5 (OFL, licence text read), Silkscreen (OFL), Press Start 2P, VT323, Micro 5, Bytesized and Pixelify Sans. I downloaded these from Google Fonts. The OFL is Google Fonts' standing licence, but I did not read each font's licence file.
- **Shattered Pixel Dungeon.** GitHub `00-Evan/shattered-pixel-dungeon`: README, LICENSE (GPLv3), and `tiles/DungeonTilemap.java` (`public static final int SIZE = 16;`).
- **Anthropic.**
  - Pricing: https://platform.claude.com/docs/en/about-claude/pricing
  - Models overview: https://platform.claude.com/docs/en/about-claude/models/overview
  - The `claude-api` skill's notes on structured outputs, prompt caching, sampling parameters and batches.

**Experiments I ran** (scripts now in `../prototypes/`, outputs listed in §3.4).
- `../prototypes/art-probe/museum_probe.py` renders sprites written as index grids, palette swaps, Bollinger-style beings, procedural paintings, three gallery mock-ups and a font legibility sheet.
- `../prototypes/bench/rotbench.cjs` times rot.js map generation, FOV and pathfinding in Node 22 on this 4-core container.

---

## 2. Key findings

**F1. The repo already has every architectural pattern this game needs, but in five places.** These are the pieces, and the role each plays:

| Project | Pattern it supplies |
|---|---|
| vanguard-zero | 16-bit pixel art drawn from character grids with a palette per sprite (`Art.sprite(rows, pal)`), a bitmap font, a WebAudio tracker with "a delay with a lowpass in the feedback path — the same trick the SNES S-DSP used", integer canvas scaling, and a planning bot |
| scriptprof | A UMD wrapper so the same file runs under Node `require` and in the browser, a seeded RNG, MAP-Elites and a Node regression script |
| roguelius | A turn-based roguelike whose `Game(seed)` / `player_turn(action)` loop is already headless. Its `--autoplay` bot "wins roughly half its runs", and its "difficulty numbers were tuned against thousands of bot games" (README, "Balance") |
| absorb-this | Eight persona policies "in the spirit of procedural personas (Holmgård, Liapis, Togelius & Yannakakis)" with telemetry and screenshots |
| grift-city and steelhag2 | Modules plus a single-file `dist/` via `build-single.py`, `__sim` deterministic stepping, Playwright screenshot suites, and acceptance tests per milestone |

*What this means for the museum roguelike (tooling and pipeline, testing):* none of the engine has to be invented. The new piece is putting the roguelius-style headless core in JavaScript, so that the same code runs the browser game, the persona bots and the generator's simulation gate.

**F2. The persona harness in absorb-this has to drive a browser, and a turn-based core should not.** absorb-this runs Playwright and Chromium, installs a virtual clock and seeds `Math.random` by monkey-patching (`personas.cjs`, `installClock`). Its README warns that "matching seed numbers alone do not mean matching encounters across source versions, because changes may consume different random draws". vanguard-zero's agent README adds: "a planner that draws from the live generator changes the future it is predicting". steelhag2 §11.4 states: "nothing that moves uses the RNG".

*What this means (testing and evaluation, architecture):* make the core pure data plus pure functions, with no DOM and no `Math.random`, and give each purpose its own named RNG stream. A turn-based game makes this cheap. Then bots, replays, save games and Monte-Carlo balance runs all clone the same plain-object state in Node, with no browser in the loop.

**F3. rot.js is a good library, but it is effectively in maintenance mode, and it has a determinism trap.** Version 2.2.1 is the latest (released 2024-11-13; the previous release was 2021), under BSD-3-Clause. Its `lib/` provides FOV (precise, discrete and recursive shadowcasting), A* and Dijkstra, schedulers with an engine and event queue, map generators (Digger, Uniform, Rogue, Cellular, three mazes), simplex noise, a Markov `StringGenerator`, lighting and displays. The README calls it "largely considered feature-complete". The minified bundle is 68.7 KB, or 22 KB gzipped.

The trap: `lib/rng.js` ends `export default new RNG().setSeed(Date.now());`, and the map generators call that **global singleton** (`map/cellular.js`, `map/digger.js`). Interleaved calls across subsystems silently couple their random streams.

*What this means (layout generation, testing):* rot.js FOV and pathfinding are safe, since they use no RNG. Its map generators are unsuitable for department layouts, which the levels brief wants as room-graph generators anyway. If we do call them, reseed the global immediately before each call.

**F4. The headless core will be fast.** Measured in Node 22 on this container, using rot.js primitives on a 64×40 map:

| Operation | Time each |
|---|---|
| Digger map | 2.3 ms |
| Recursive-shadowcasting FOV, radius 8 | 13 µs |
| Precise-shadowcasting FOV | 59 µs |
| A* between random points, 8-connected | 0.35 ms |
| Dijkstra to one goal | 0.56 ms |

The same seed gave the same map hash, and different seeds gave different hashes.

*What this means (difficulty and balance, testing):* a department of a few hundred turns, with about ten monsters running FOV and occasional pathing, costs on the order of 1 ms per turn, so well under a second per department per bot (an estimate from these measurements). Four cores give thousands of department playthroughs per minute. That is enough to run `papers-semantic.md`'s S3 simulation gate over every pool candidate and persona.

**F5. Current Claude models cannot be made deterministic, and their sampling cannot be turned up for diversity.** Per the `claude-api` skill's thinking and sampling table, `temperature`, `top_p` and `top_k` are rejected:
- On Claude Opus 5.5: "Removed - 400".
- On Sonnet 5.5 and Haiku 5.5: "Non-default values - 400".

Thinking cannot be disabled on Opus 5.5 (effort is the only control, and it defaults to `medium`). There is no seed parameter.

*What this means (department concept generation, reproducibility):*
1. "Seed → same department" can only come from **storing outputs**, never from re-generating them.
2. Diversity must come from varied *inputs* (domain pairs, constraint cards, target archive cells), not from temperature. This corrects a detail in `papers-semantic.md` S1, which calls for "high temperature": that setting returns a 400 on these models. Its other diversity levers still apply.

**F6. Structured outputs cover the shape of a department but not its sizes.** Per the `claude-api` skill:
- **Supported:** objects, arrays, enums, `const`, `anyOf`/`allOf`, `$ref`. Every object must set `additionalProperties: false`.
- **Not supported:** recursive schemas; numeric constraints (`minimum`, `maximum`, `multipleOf`); string-length constraints; "complex array constraints".
- New schemas pay a one-time compilation cost, and are then cached for 24 hours.
- A refusal (`stop_reason: "refusal"`) "may not match your schema".

*What this means (text and labels, tooling and pipeline):*
- Let the model choose from **closed enums**: archetype, material, ornament, behaviour, effect primitive, challenge type, room type. This alone guarantees that every generated noun points at code that exists.
- Enforce label length, numeric ranges and cross-references in a second, hand-written lint, with a repair-or-reject loop.
- Never let the LLM write numbers. `papers-semantic.md` reaches the same conclusion from the balance side.

**F7. Current prices make generation cheap. Latency is the constraint.** Verified 2026-10-20 on the pricing page:

| Model (`id`) | Input $/MTok | 5-min cache write | Cache read | Output $/MTok | Batch (input/output) |
|---|---|---|---|---|---|
| Claude Opus 5.5 (`claude-opus-5-5`) | 4 | 5 | 0.20 | 20 | 2 / 10 |
| Claude Sonnet 5.5 (`claude-sonnet-5-5`) | 2 | 2.50 | 0.10 | 10 | 1 / 5 |
| Claude Haiku 5.5 (`claude-haiku-5-5`), prompt ≤100K | 0.10 | 0.125 | 0.01 | 0.50 | 0.05 / 0.25 |

Other facts from the same sources:
- Batch is "50% off every token … including cache reads and writes" (skill, cost-optimization §2.5).
- The minimum cacheable prefix is 512 tokens on all three models.
- Opus 5.5 fast mode costs $8/$40 for "up to 2.5x higher output tokens per second", and is not available on Batch.
- The models page gives only *comparative* latency ("Moderate", "Fast", "Fastest") and no tokens per second, so every latency figure below is a labelled assumption.
- Retirement is "not sooner than" 2027-09-22 (Opus 5.5) and 2027-10-07 (Haiku 5.5). A runtime that depends on one model has about a year's guaranteed horizon; a shipped content pack has no such dependency.

*What this means (LLM logistics):* about $0.21 per department on Opus 5.5 and half a cent on Haiku 5.5. A full offline pool costs tens of dollars. Generation takes minutes, not milliseconds (§3.6).

**F8. A browser game cannot hold an API key. Every online design is therefore a server design, or "bring your own key".** The TS SDK refuses to run in a browser unless `dangerouslyAllowBrowser: true` is set (SDK README). With a hosted key, every visitor spends the owner's money.

*What this means (tooling and pipeline, LLM logistics):* online generation needs:
- a small proxy (a Cloudflare Worker or a tiny Node server);
- a server-side cache keyed by request, so that each department is generated once and served to everyone;
- per-IP and global daily caps;
- no free-text player input reaching the model.

The single-file, static-hosting convention survives for the offline pack and for v1.

**F9. Diffusion models are a poor fit for this game's sprites and tiles.** CrawLLM, the closest precedent, used Mixtral 8×7B locally via Ollama for text, and SDXL with ControlNet and IP-Adapter for visuals (preprint §III-B). It documents two problems:
- **Tilesets.** Generated separately, "the floor tiles were often too intricate or the walls offered little contrast to them". Generated as one image, SDXL "was unable to correctly distinguish between regions intended to be walls and those intended to be floors". The working version needed three-stage inpainting.
- **Spritesheets.** In one pass, "the generator often mistook back movement with front movement", so generation was split by orientation.

The 2e book (§9.2, pp. 290–291) surveys diffusion asset tools.

*What this means (visuals and sprites):* keep diffusion off the critical path. The **one** place painterly, off-grid imagery is justified inside the fiction is **paintings on the walls**. Inspecting a painting could open a 64×64 "detail view", made offline by diffusion or SVG and quantized to the department palette. Everything walkable or alive stays on the 16-px grid, drawn in code.

**F10. LLMs are now usable as pixel-grid authors when the grid is small and indexed. The evidence for this is my own probe, n = 5.** I wrote five 16×16 index grids directly in this session, without looking at any image while writing: amphora, clockwork automaton, docent, reliquary and astrolabe. I used vanguard-zero's convention (one character per palette slot, `.` for transparent).
- All five validated first time (16 rows of 16 characters, only known indices).
- Rendered, all five are recognisable at 1:1 (`../prototypes/art-probe/sprites_by_department.png`).

The literature supports the format choice:
- VGBench finds that LLMs have "less desirable performance on low-level formats (SVG)".
- AM-Bench (2026, preprint) finds that the *output medium* matters: "replacing procedural code with raw SVG improves layout scores across all models".
- A 16×16 palette-index grid is a lower-level medium still, and with only 256 cells it is easy to validate.

Caveats: n = 5, judged by the author, and limited to common object classes. Strange Borgesian beings will be harder, and *animation frames that stay consistent* are the known hard case (compare CrawLLM's pose confusion).

*What this means (visuals and sprites, exhibits):* the offline pipeline asks the LLM for **one static 16×16 frame per signature exhibit**. Code validates it (shape, outline coverage, connected components, contrast). Optionally, a vision-model judge answers "which of these five names is this?", the visual equivalent of `papers-semantic.md`'s round-trip label check. Anything that fails falls back to an archetype silhouette. Animation is done in code (bob, a two-frame idle made by offsetting the upper half, palette cycling for glow), never asked of the LLM.

**F11. Bollinger-style mask sprites give individuals, not species.** I ported the algorithm with a seeded RNG. Fedoran's JS uses `Math.random`, so it is unseeded as shipped. Mask values follow his port: −1 always border, 0 empty, 1 empty-or-body, 2 border-or-body, mirrored, then outlined and shaded. Thirty-six beings (`bollinger_beings.png`) show that **one mask yields one recognisable family** with noisy interior detail. Every being shares the mask's silhouette and differs only in texture.

*What this means (enemies, NPCs, visuals):* this is exactly the right property for the "Imaginary Beings" of a department. Use one mask per department species, so that silhouette signals species and therefore behaviour, and the noise signals individuals. Two more requirements follow:
- **Masks are authored per archetype**, giving silhouette stability for learnability.
- A cleanup pass is needed: remove isolated pixels and fill single-pixel holes. The raw output is speckled.

**F12. Palette is the cheapest carrier of department identity, and it must not carry gameplay semantics.** The three probe departments ("Glass Weather", "Lacquered Hours", "Salt Saints") use identical sprites, tiles and layout. They read as three different places from palette, wall colour and floor material alone (`gallery_*.png`).

The probe also showed the risk. Under a department palette, a live automaton on the floor and an automaton-like being on a plinth look alike, and the plaque, plinth and vitrine whites are the only constant cues.

*What this means (visuals, enemies, items, player choice):*
- Copy the SNES discipline of sub-palettes (8 sprite palettes of 16 colours; general hardware knowledge, not a cited source). Each department gets a **material ramp** (outline + 4 shades) and an **accent ramp** (3).
- **Reserve a few semantic colours that no department palette may use:** hostile intent (eye glint, outline flash), item sparkle, hazard, interactive or readable (plaques), and the player.
- Live creatures get a shadow and an idle bob. Dormant exhibits stand on plinths behind a rope.
- A palette lint checks floor-to-outline luminance contrast and distance from the reserved colours.

**F13. Museum furniture carries "museal" identity at almost no cost.** In the mock-up, four cheap devices make the screen read as a gallery and not a dungeon, even with placeholder art:
- plinths, vitrines and label plaques;
- paintings hung in a row on the north wall;
- dithered spotlight pools on exhibits (three brightness levels with a 4×4 Bayer dither);
- a cream tombstone label panel in a pixel font.

Two weaknesses are visible:
- **Walls two tiles high read as a strip.** The galleries need a 3/4 wall face, a full tile of wall front as in SPD, so paintings hang on something.
- **Flat checker floors dominate the screen.** Floors need lower contrast than objects, so that light pools and plinths pop.

*What this means (exhibit and furniture placement, visuals):* furniture is a first-class part of the generator's vocabulary, and lighting is a gameplay-legible layer, since a spotlight marks an exhibit. Budget art time for walls and floors first.

**F14. Label text is the heaviest UI load in the game, and native-pixel fonts set its layout.** From the legibility sheet (`label_fonts.png`), rendered at native size with no antialiasing:

| Font | Licence | Native size | Assessment |
|---|---|---|---|
| Tiny5 | OFL | 8 px | Densest legible mixed-case font. About 48 characters per 192 px (about 4 px per character), so roughly 75–80 per 312-px line |
| Micro 5 | OFL | 11 px | Legible, slightly larger; used in the galleries |
| Bytesized | OFL | 8 px | Too cramped for paragraphs |
| Press Start 2P | OFL | 8 px | Classic look but about twice as wide; titles only |
| Silkscreen | OFL | 8 px | All capitals, so poor for paragraphs |
| VT323 | OFL | 16 px | Legible but terminal-flavoured |
| Pixelify Sans | OFL | 16 px | Not grid-aligned at small sizes (grey-pixel test) |
| m5x7 / monogram | CC0 | — | Licences verified, not tested (itch download only) |

On a portrait phone 390 CSS px wide with 16-px gutters, Tiny5 drawn at 2 CSS px per font pixel gives a 16 CSS px em and about 45 characters per line (arithmetic from the measured advance). A 60-word label is then about 8 lines.

*What this means (text and labels, UI):* labels need a **two-level design**. A one-line tombstone (title, date in the fictional calendar, medium) shows on proximity, and the full panel opens on tap. The text layer scales **independently of the world zoom**. The lint caps label bodies at 40–70 words.

**F15. Safari can delete the meta-progression.** Two policies apply:
- Wilander (2020): WebKit deletes "all of a website's script-writable storage after seven days of Safari use without user interaction on the site", including LocalStorage and IndexedDB. Home-screen web apps "have their own counter of days of use", which matches actual use.
- Liu (2023): Safari 17 grants `navigator.storage.persist()` "based on heuristics like whether the website is opened as a Home Screen Web App". Origin quota is up to 60% of disk for browsers.

*What this means (meta-progression):* keep meta-state small, in localStorage and IndexedDB. Call `navigator.storage.persist()`, encourage "Add to Home Screen" with a PWA manifest, and ship an **export/import save code**, framed in the fiction as a "visitor's card". A roguelite whose persistent progress silently vanishes after a week away is a bug.

**F16. Audio can be fully procedural in the house style. Per-department motifs are a data problem, not a synthesis problem.** vanguard-zero's tracker reads text patterns of note names ("4 rows per beat… '.' sustains the previous note, '_' cuts it") with pulse, triangle, saw and LFSR noise voices and an echo. That is a symbolic music format an LLM can write, in the same way it writes index grids.

The 2e book (§9.3, pp. 292–294) frames the space. Audio constraints are soft ("an inappropriate audio generation will not necessarily break the game"), and adaptive music is a "grand challenge". It cites MetaCompose [998] for mood-expressive evolved music and Sonancia [651] for mapping level tension to sound.

*What this means (audio):* a department's audio identity can be four pieces of data, checked by an in-scale and in-range lint: **mode** (enum), **instrument family** (enum mapped to synth patches), **tempo band**, and **a 2–4-bar motif in tracker text**. Room-level tension (an awake guard, a Masterpiece room) switches tracker layers, in the Sonancia direction. Gallery ambience (HVAC hum, footsteps in synthetic reverb sized to the room, clock ticks) does much of the "museal" work.

**F17. The single-file convention scales to a content-heavy game.**
- vanguard-zero's whole game, art and music included, is 293 KB as one HTML file.
- grift-city's dist is 6.0 MB, and steelhag2's is 2.4 MB.
- One department of about 10k output tokens is roughly 30–40 KB of JSON (estimate). A 100-department pack is about 4 MB raw and about 1 MB gzipped.
- vanguard-zero runs "straight off the filesystem with no server" because it uses classic `<script>` tags, not ES modules.

*What this means (tooling and pipeline):* keep classic IIFE/UMD modules (scriptprof's wrapper, so Node can `require` the core), a `build-single` inliner, and content packs as inlined JSON. No bundler is needed.

**F18. Godot, Phaser and PixiJS each buy something we would mostly not use.**
- **Godot 4.7.** Web export is now single-threaded by default and "works very well on macOS and iOS too". C# cannot export to the web. Size is unstated, but the docs say the WebAssembly module compresses to about a quarter of its size with gzip (paraphrase). It would give a mature editor and native mobile exports, but break the repo's code-only, single-file, Node-testable pattern. Headless Godot is possible but heavy.
- **Phaser 4 (355 KB gzipped) and PixiJS 8 (237 KB gzipped).** They bring WebGL batching, scene and tween systems and input, all designed for real-time games. A turn-based grid game with fewer than a few hundred sprites on screen fits in Canvas 2D with a baked static layer, as vanguard-zero does for a faster game.
- **Python/tcod.** The roguelius lineage, but it does not reach phones or the browser without Pyodide.
- **Shattered Pixel Dungeon.** GPLv3. Its code and art cannot be ported into this MIT repository. Its 16-px tile (`DungeonTilemap.SIZE = 16`) and its control conventions can be borrowed as ideas.

*What this means (platform):* vanilla JS with Canvas 2D, plus at most rot.js's FOV and path modules (or ports of them).

**F19. Small text-to-sprite models need training data we do not have, and the CC0 tile corpora are a style trap.**
- **The Five-Dollar Model** (Merino et al., 2023) generates "low dimensional images from an encoded text prompt" and is trainable "with limited amounts of training data". It is attractive for a later research track: train on the game's own validated sprites once there are a few hundred.
- **DCSS's 3,000+ CC0 tiles** are 32×32 and in a recognisable house style.
- **Kenney's 1-Bit Pack** (16×16, CC0) is monochrome, which suits palette tinting, but it loses the 16-bit richness.

*What this means (visuals):* CC0 packs are useful for **placeholders during grey-box** and as a **reference corpus**. They should not be the shipped look, which should stay code-drawn index art, fitting the house convention.

---

## 3. Ideas for the museum roguelike

### 3.1 Architecture in one paragraph *(architecture, testing, tooling)*

There are three layers, and only the outer one touches the browser:
- **`core/`** is a pure, deterministic, seeded simulation. State is plain JSON-able objects, all randomness comes from named RNG streams, and all arithmetic is integer. It has no DOM and no `Math.random`. Turning randomness and float maths off in it is enforced by a lint.
- **`art/`, `audio/`** and **`ui/`** turn core state into pixels, sound and text, from content-pack data plus authored part libraries.
- **`game.js`** wires them to input and storage.

The same `core/` is `require`d by `tools/sim.js` (persona bots, balance sweeps), `tools/qd.js` (MAP-Elites over departments) and the offline generation pipeline's simulation gate. Content is data: departments, exhibits, creatures, items and NPCs are JSON validated against a schema, and refer to authored registries by ID. The LLM, if used, appears only as a *producer of packs*, offline in v1 and optionally behind a caching proxy later.

### 3.2 The determinism contract *(testing, reproducibility, save)*

**Streams.**
- `rng(runSeed, 'layout', deptId)`, `rng(runSeed, 'loot', deptId)`, `rng(runSeed, 'ai', deptId)` and `rng(runSeed, 'combat', deptId)` are derived by hashing (for example, a tiny sfc32 or mulberry32 seeded from a string hash).
- `rng(cosmeticSeed, …)` drives animation, particles and music, and **never** touches gameplay streams. This avoids absorb-this's problem of "changes may consume different random draws".
- Room-level substreams (`'layout', deptId, roomId`) keep rooms independent, so editing one room generator does not reshuffle the whole department.

**Arithmetic.** IEEE-754 `+ − × ÷` are exactly specified. `Math.sin`, `exp` and `pow` are not guaranteed bit-identical across engines (steelhag2 §11.4 found cross-browser hashes "differ in the last ulp"). Ban transcendental functions in `core/` with a grep lint, and use integers for HP, damage and positions.

**State.** `state` is structured-clonable. `step(state, action) → events` is the only mutator. This gives four things at once:
- **Saves** are snapshots.
- **Replays** are `{packVersion, coreVersion, runSeed, actions[]}`. They double as bug reports, and as roguelius's "building permit" share codes.
- **Bot forward models** are clones, as in vanguard-zero's sandboxed world model.
- **Determinism tests** hash the state after N scripted steps, twice.

**Content addressing.** `deptId` is a hash of the department JSON. A run's share code is `pack v · runSeed`. A department reached by an online generation is replayable by anyone once it is in the archive (§3.6).

### 3.3 Data-driven content *(department concept, enemies, items, NPCs, text, tooling)*

Keep two schemas, deliberately:
1. **`llm-schema.json`.** This is the subset Claude's structured outputs accept: closed enums, `additionalProperties: false`, no numeric or length constraints.
2. **`pack-schema` plus `lint.js`.** This is the full game contract: lengths, ranges, references to registry IDs, palette contrast, reserved-colour distance, the label word cap, and checks for jevslop stock phrases and em-dash rate.

ajv validates in `tools/` only. The runtime trusts packs that passed the build and runs only a cheap shape check. A sketch of one department record:

```json
{
  "accession": "1931.07",
  "title": "Department of Glass Weather",
  "conceit": "≤80 words",
  "category": "technology",
  "palette": {"material": "glass_teal", "accent": "pewter", "wall": "slate_blue", "floor": "grey_marble"},
  "audio": {"mode": "lydian", "family": "bell", "tempo": "slow", "motif": "a4 . c5 e5 | d5 . . _ | ..."},
  "rooms": {"weights": {"enfilade": 3, "cabinet": 2, "rotunda": 1, "dark_room": 1}},
  "challenge": {"primary": "stealth", "secondary": "hazard"},
  "species": [{"id": "s1", "name": "...", "archetype": "patrol_guard", "mask": "insectoid_b",
               "modifiers": ["reflects_light"], "role": "skirmisher"}],
  "exhibits": [{"id": "e7", "name": "Astrolabe of the Lesser Hours", "silhouette": "astrolabe",
                "material": "brass", "ornaments": ["inlay", "glow_core"], "grid16": ["................", "..."],
                "label": {"tombstone": "Brass, glass, one captured noon. Seventh Lantern workshop.",
                          "body": "40–70 words", "credit": "Lent by the Department of Glass Weather"},
                "effect": null}],
  "items": [{"id": "i3", "effect": "reveal_room", "magnitude": "small", "label": {"...": "..."}}],
  "npcs": [{"id": "n1", "template": "docent", "barks": ["..."]}]
}
```

Numbers (HP, damage, prices) are filled in by a deterministic balancer from `role` × run depth, never by the LLM (compare `roguelike-systems.md` §3.3).

### 3.4 Art pipeline *(visuals and sprites, exhibit and furniture placement)*

**Probe outputs** (all in `../prototypes/art-probe/`):
- `sprites_by_department.png`: five LLM-written grids, three beings and two paintings, each under three department palettes.
- `bollinger_beings.png`: 36 mask-generated beings.
- `gallery_1_Glass_Weather.png`, `gallery_2_Lacquered_Hours.png`, `gallery_3_Salt_Saints.png`: a 320×176 mock-up plus label panel.
- `label_fonts.png`: the font sheet.

**Recommended layering.** Each layer is cheap on its own, and together they give a department its own look:

1. **Tile size: 16×16.** This is SPD's size and Kenney's, and the size at which an LLM index grid is 256 cells (roughly 100 tokens; my estimate). Use 32×32 (2×2 tiles) only for Masterpieces and bosses. A 24-px tile would mean fewer CC0 placeholders, larger grids for the LLM, and no clear gain at phone zoom.
2. **Logical resolution.** Variable, with integer zoom (vanguard-zero snaps "to whole or half pixels"). About 8–12 tiles across in portrait and 20 in landscape. The world draws into an offscreen canvas at 1× with `imageSmoothingEnabled = false`. Static tiles are baked once per department, as vanguard-zero bakes terrain into "one `drawImage` instead of ~400 tile draws".
3. **Sprite sources, in priority order:**
   - (a) authored **silhouette archetypes** as index grids (vases, idols, automata, quadrupeds, insectoids, scrolls, instruments, garments, specimen jars, maps, vitrines, plinths), roughly 40–60 to start;
   - (b) authored **ornament overlays** (inlay, gilding, cracks, eyes, runes, feathers, glow core) composited by anchor points, which is vanguard-zero's "torso + leg block + gun arm" trick;
   - (c) **Bollinger masks** for beings, one per archetype, with seeded fill and a cleanup pass;
   - (d) **LLM-authored 16×16 grids** for signature exhibits, validated and judged offline, falling back to (a)+(b);
   - (e) **procedural paintings** for wall art: landscape, portrait and still life, in a frame, drawn from the department's ramps. An optional 64×64 detail view comes from offline diffusion or SVG, quantized to the palette.
4. **Palette** (F12). Department ramps come from a small authored set of material ramps (about 30), chosen by the frame's `material` enum, never as free hex values. The reserved semantic colours sit outside every ramp, and the palette lint checks contrast and reserved-colour distance.
5. **Furniture and light** (F13). Furniture: plinth, vitrine, rope barrier, label plaque, bench, guard stool, dark room, mirror gallery. Light: spotlight pools as a gameplay layer (stealth departments can switch lights off). Walls get a 3/4 front face.
6. **The Atelier page.** A `tools/atelier.html` workbench, in the spirit of grift-city's contact sheets and scriptprof's gallery. It renders every exhibit and species of a pack under its palette, side by side with the reserved-colour overlay, so that Julian curates visuals in one screen.

### 3.5 Text and the label UI *(text and labels, UI, accessibility)*

- **Label tiers:** the **tombstone** (title, date in the fictional calendar, medium, credit line, accession number) appears in one line on proximity; the **body** (40–70 words) opens on tap or the examine key; **section panels** (department intro and room panels) are read at thresholds.
- **Rendering** has two options (T7). Lean: a **DOM overlay** for long text. A pixel webfont at integer CSS sizes is crisp, and gives free wrapping, scrolling, selection, screen-reader access and browser zoom. The canvas keeps in-world short text (plaque glyphs, floating numbers). In the dist the font is inlined as base64 (compare steelhag2 D13, which weighs Google Fonts faces against a stroke synthesiser for its documents).
- **Font:** Tiny5 (OFL) for bodies and Micro 5 or Press Start 2P for titles. Test m5x7 and monogram (both CC0) before committing.
- **Lint for generated prose:** word caps; a banned-phrase list seeded from `jevslop/tells.py`'s `STOCK_PHRASES` plus museum clichés; em-dash rate; sentence-length variance (jevslop's "burstiness"); and n-gram repetition across the whole pool.

### 3.6 LLM logistics: a cost and latency model *(department concept, LLM logistics, meta-progression)*

**Assumptions** (labelled; measure before committing). One department in a single pass:
- **Input:** about 12k tokens. Around 10k of these are a cacheable prefix (style guide, schemas, enum registries, two exemplar departments) and around 2k are per call (seed domains, constraint card, archive cell, a list of departments to avoid).
- **Output:** about 10k tokens. Around 8k of JSON (30 exhibits × ~150, 6 species, 8 items, 2 NPCs, panels, audio and palette fields, a few 16×16 grids) and around 2k of adaptive thinking at low effort, billed as output.

| Per department, single pass | Opus 5.5 | Sonnet 5.5 | Haiku 5.5 |
|---|---|---|---|
| Cached prefix read (10k) | $0.002 | $0.001 | $0.0001 |
| Uncached input (2k) | $0.008 | $0.004 | $0.0002 |
| Output (10k) | $0.20 | $0.10 | $0.005 |
| **Total, interactive** | **≈ $0.21** | **≈ $0.105** | **≈ $0.005** |
| Total, Batch API | ≈ $0.105 | ≈ $0.053 | ≈ $0.0027 |

The cache write is about $0.05 once per five-minute window on Opus. A multi-stage pipeline (several frame candidates, spec, text, round-trip check, sprite spec) is about 3× the tokens. An offline Permanent Collection of 100 departments with 3× over-generation is then about 300 × $0.32 ≈ **$100 on Opus via Batch**. That is a rounding error next to curation time, so use the strongest model offline, and Haiku 5.5 for judges and round-trip extractors. Online, one run of 10 departments that all miss the server cache costs about $2 on Opus, $1 on Sonnet, or $0.05 on Haiku.

**Latency.** No throughput is published. *Assuming* 50–150 output tokens per second (unverified), a 10k-token department takes about 70–200 s as one stream. To cut wall time:
- **Split it.** Run the concept call first (about 1.5k tokens), then three parallel exhibit-batch calls and one species/items/NPC call. Wall time is about concept + slowest branch, roughly 30–80 s by the same assumption.
- **Fast mode** (Opus 5.5, up to 2.5×, at twice the price).
- **Stream.** Start laying out the first rooms when the concept and first exhibits arrive.

Even so, **generation cannot happen at the door**. It has to happen *during the previous department*:
- When the player enters department N, request N+1. If doors offer a choice, request **concept-only stubs** (about 500 tokens) for each door, then the full department for the chosen one while the player walks a **Grand Staircase / connecting hall**. This is a diegetic loading room with a reading bench and the Directory (`papers-semantic.md`'s Borges signage).
- The first one to three departments of every run come from the static pack, so a cold start never waits.
- If generation fails, times out or is rejected by lint, take the next department from the static pack. The player never sees a spinner.

**Proxy design (v2, only if online generation is wanted).**

```
browser ── POST /dept {packVer, genVer, promptSeed, depth, avoid[]} ──► Worker
   Worker: key = hash(genVer, promptSeed)
           hit in KV/R2?  → return stored department (deterministic for everyone)
           miss → rate-limit (per IP/day, global $ cap) → Claude (structured output)
                → validate + lint + quick headless sim (core/ runs in the Worker)
                → store under accession number → return
   no free text from players ever reaches the prompt; commissions are card IDs
```

**Reproducibility reconciled.** The run seed picks *prompt seeds*, not outputs. The first visitor to cause a miss "accessions" the department for everyone, and later visitors with the same seed get the identical, stored department. Daily-seed runs are pre-warmed overnight with the Batch API. This is the Infinite Craft-style caching that `papers-semantic.md` (D6b) already proposes, and it is the only way to get a literally infinite museum that is also seedable.

**Alternatives considered:**
- **Bring your own key** (`dangerouslyAllowBrowser`): no server, but friction, key exposure in the user's own browser, and per-user cache only.
- **Local WebGPU model** (web-llm, Apache-2.0): multi-GB download, weak on phones, lower prose quality. CrawLLM ran Mixtral 8×7B locally, which is a desktop-GPU proposition.

### 3.7 Persistence *(meta-progression, save)*

- **localStorage** holds meta-state (unlocks, catalogue, keepsakes) as a versioned JSON object with a checksum, in grift-city's "older saves remain readable" spirit.
- **IndexedDB** caches content packs, server departments and baked sprite atlases.
- **Run save:** snapshot on `pagehide` and `visibilitychange`, since mobile Safari kills tabs, plus the action log. Delete the snapshot on death, roguelike-style.
- **Export:** a short "visitor's card" code for meta-state (compressed JSON, base32, a few dozen characters), plus file export. Request `navigator.storage.persist()`. Ship a PWA manifest so iOS users can install and get their own storage counter.

### 3.8 Input on desktop and phone *(player choice, UI)*

Borrow the conventions of SPD's mobile-first scheme as ideas only, since its code is GPL: tap a tile to path there (interrupted when something comes into view), tap an adjacent enemy to attack, tap an exhibit or plaque to read, long-press to examine, and a bottom bar for wait/search, inventory and two quickslots.

Keyboard gets vi-keys, arrows and the numpad, as in roguelius, plus an examine key (roguelius uses `v` to review everything visible). Turn-based play means no latency pressure on touch, but **misclick protection** is needed: confirm before stepping into a hazard or a known-dangerous room.

### 3.9 Audio *(audio)*

- Fork vanguard-zero's `audio.js` (S-DSP echo) and tracker. Give each department `mode × family × tempo × motif` (F16), with harmonisation from rules, and add a tension layer for awake guards and Masterpiece rooms.
- For SFX, use the forked synth or ZzFX (MIT, about 3.5 KB gzipped).
- Ambience: room tone, reverb by room size (steelhag2 synthesises impulse responses), footsteps on marble versus parquet, a distant docent, a guard's keys.
- MetaCompose-style evolution [998] is an optional research track for adaptive music, not a v1 need.

### 3.10 Testing and tooling *(testing and evaluation)*

These test layers follow the repo's practice of acceptance tests written before the content they check (steelhag2 §11.4):

| Layer | What it checks |
|---|---|
| `tools/check.js` (Node) | Every module loads, packs validate, determinism hashes (same seed and actions twice give the same hash), the forbidden-API lint, connectivity BFS on N layouts per department (vanguard-zero `validate.js`) |
| `tools/sim.js` (Node, multi-process) | Personas (fighter, sneak, explorer/reader, hoarder, pacifist, masher, as in absorb-this) × seeds × departments → CSV of win rate, turns, HP spent, causes of death (roguelius autoplay statistics). This is the S3 gate. Expressive-range plots per generator (book §9.7.3, pp. 306–308) |
| `tools/qd.js` | MAP-Elites over departments, reusing scriptprof's `evolve.js` shape. Axes are a design decision for the levels brief |
| `tools/shot.js` (Playwright, few tests) | Screenshot contact sheets per department, plus pixel checks: reserved colours present on hostile sprites, label panel inside the viewport at 390×844, nothing drawn off the integer grid |
| `tools/atelier.html`, `tools/curator.html` | The human gates |

---

## 4. Pitfalls and risks

1. **Hidden global randomness:** rot.js's `Date.now()`-seeded module RNG and the Bollinger port's `Math.random` (F3, F11). Grep-lint `core/` for `Math.random`, `Date.now` and `performance.now`.
2. **Expecting the LLM to be deterministic, or to be made more random.** Sampling parameters return 400 on the current models (F5). Seeds index *stored* content.
3. **Treating structured outputs as validation.** They guarantee shape, not lengths, ranges or references, and a refusal can break the schema (F6). Without the lint, a 400-word label or an unknown archetype gets into a pack.
4. **Palette swaps that erase gameplay semantics.** Exhibits, live enemies and items blur together (F12). Reserved colours and archetype-fixed silhouettes are not optional.
5. **Text volume on phones.** About eight lines per label, across 30 exhibits, is a lot. If players cannot skim and skip, they will resent the conceit. Make the tombstone useful on its own, for example by hinting at the exhibit's effect.
6. **Prose slop at scale.** Repetition across the pool is the real tell, more than any single label, so lint across the whole pool.
7. **A runtime dependency on one model** (retirement from about September 2027, F7). Version generators (`genVer`), cache forever, and treat a model change as a new generator.
8. **Cost and abuse of a public proxy.** Caps, server-side caching, and no free text (F8).
9. **Safari evicting meta-progression** (F15).
10. **Licence contamination.** SPD is GPLv3 and the repo is MIT, so take ideas only. Record every CC0 and OFL source in `SOURCES.md`, as grift-city does.
11. **Diffusion creep** into tiles and animated sprites (F9).
12. **Over-engineering the renderer** with WebGL frameworks a turn-based 16-px game does not need (F18).
13. **Animation drift in LLM-drawn grids.** Ask for static frames only.
14. **Cross-browser float drift.** Transcendental `Math` functions break replay hashes between engines, so keep gameplay integer (§3.2).

---

## 5. Decisions this raises for the design discussion

**T1. Platform and rendering.**
(a) Vanilla JS, Canvas 2D, single-file dist (house convention). (b) Phaser 4 or PixiJS 8. (c) Godot 4.7 with web and native exports. (d) Python/tcod.
*Lean: (a).* The game is turn-based with few sprites. Node-testability of the core matters more than renderer features, and every pattern needed is already in the repo (F1, F18).

**T2. rot.js or our own primitives.**
(a) Use rot.js 2.2.1 for FOV, pathfinding and the scheduler only. (b) Port the roughly 300 lines we need (recursive shadowcasting, A*, Dijkstra maps) into `core/grid.js`. (c) Use rot.js generators too.
*Lean: (b), with (a) acceptable.* The library is stable but dormant, adds 22 KB gzipped, and has the global-RNG trap (F3). The parts we need are small and well understood.

**T3. Module format and language.**
(a) Classic IIFE/UMD scripts, plain JS with JSDoc and optional `tsc --noEmit` checking, plus `build-single`. (b) ES modules with esbuild. (c) TypeScript with a build.
*Lean: (a).* It runs from `file://`, Node can `require` it, and it matches scriptprof and vanguard-zero (F17).

**T4. Tile size and resolution.**
(a) 16×16 with integer zoom, and 32×32 for Masterpieces. (b) 24×24. (c) 32×32 throughout.
*Lean: (a)* (F10, §3.4). It matches SPD's density on phones and makes LLM grids cheap.

**T5. Primary art source.**
(a) Code-drawn index-grid archetypes, ornament overlays, Bollinger masks and palettes, with LLM grids for signature exhibits. (b) CC0 packs (Kenney 1-bit tinted, or DCSS). (c) Offline diffusion, pixelised. (d) A small trained text-to-sprite model (Five-Dollar style).
*Lean: (a).* Use (b) only as grey-box placeholders. Use (c) only for painting detail views. (d) is a later research track once there is a corpus (F9–F11, F19).

**T6. Where the LLM sits.**
(a) Offline only: Batch API packs, curated, shipped. (b) (a) plus an online caching proxy for "uncatalogued" departments. (c) Bring your own key. (d) A local WebGPU model.
*Lean: (a) for v1 and (b) as v2*, matching `papers-semantic.md` D6. The cost is trivial. The real constraints are latency, abuse and model retirement (F7, F8, §3.6).

**T7. How label text is rendered.**
(a) A bitmap font drawn on canvas. (b) A DOM overlay with an inlined pixel webfont for long text, and canvas for in-world text. (c) A system font.
*Lean: (b)* for accessibility, zoom and wrapping, with Tiny5 or m5x7 after a device test (F14).

**T8. Model and effort per pipeline stage** (offline).
(a) Opus 5.5 everywhere. (b) Opus 5.5 for frames and text, and Haiku 5.5 for judges, round-trip extraction and lints. (c) Sonnet 5.5 everywhere.
*Lean: (b).* Measure frame quality at `low` versus `medium` effort on 20 seeds before picking a default.

**T9. Determinism contract.**
(a) Full contract: named streams, integer core, no transcendental `Math`, replayable action logs, hashing tests. (b) Seeded layout only, with combat randomness unconstrained.
*Lean: (a).* It is cheap in a turn-based game and pays for itself in bots, replays, bug reports and share codes (§3.2).

**T10. Persistence of meta-progression.**
(a) localStorage only. (b) localStorage plus IndexedDB, `persist()`, a PWA manifest and export codes. (c) A server account.
*Lean: (b)* (F15). Revisit (c) only if the proxy exists anyway.

**T11. Audio.**
(a) Fork vanguard-zero's synth and tracker, with LLM-written motifs in tracker text, linted. (b) ZzFX plus hand-written loops. (c) Tone.js.
*Lean: (a)*, with ZzFX for small SFX if convenient (F16).

**T12. Bot and simulation harness.**
(a) A pure Node core with personas (absorb-this's set, ported to turn-based policies) and roguelius-style statistics. (b) Playwright-driven bots like absorb-this.
*Lean: (a)*, with Playwright reserved for screenshots and touch tests (F2, F4).

**T13. Department pre-generation timing** (only if T6 is (b)).
(a) Full generation of every door option during the previous department. (b) Concept stubs for doors, then full generation of the chosen one during a staircase interstitial. (c) Generate the next department only after the choice, with the pack as a fallback.
*Lean: (b).*

**T14. Hosting.**
(a) Static files only (GitHub Pages or itch). (b) Static files plus a Worker for the optional proxy.
*Lean: (a) for v1.*

---

## 6. Recommended architecture

### 6.1 Diagram

```
 OFFLINE (Node, tools/)                                   RUNTIME (browser; one HTML file in dist/)
 ──────────────────────────────────────────────           ─────────────────────────────────────────────────────────
 authored substrate                                        content/pack-NNNN.json  (inlined; accession-numbered)
   registry: archetypes · masks · ornaments ·                       │
   materials/ramps · effects · rooms · furniture ·                  ▼
   label templates · synth patches                         ┌──────────── core/ (pure, seeded, integer, no DOM) ─────────┐
        │                                                  │ rng streams → sequence (doors) → layout → placement        │
        ▼                                                  │ → rules/turns (scheduler, combat, AI, items) → run/meta    │
 gen/ LLM pipeline (Claude; Batch API)                     │ state = plain data; step(state, action) → events           │
   S1 frame ×k → S2 spec (enums only) → S4 text            └───────────────┬────────────────────────────────────────────┘
   → S5 sprite spec / 16×16 grids / motif                                  │ snapshots + events
        │                                                  ┌───────────────▼─────────────────────────────────────────────┐
        ▼                                                  │ art/  palettes · grids+parts · masks · paintings · bake     │
 lint.js (lengths, refs, palette, prose tells)             │ view/ Canvas 2D, integer zoom, light pools                  │
 check.js (schema, determinism, connectivity)              │ ui/   labels (DOM overlay), HUD, catalogue, Directory       │
 sim.js  (personas × seeds, uses core/) ───────────┐       │ audio/ synth + tracker + motif + ambience                   │
 qd.js   (MAP-Elites archive, uses core/)          │       │ input/ keys + touch      store/ localStorage + IndexedDB    │
 atelier.html + curator.html (human gates)         │       │ net/  (v2, optional) ──► Worker proxy ──► Claude API         │
        │                                          │       └─────────────────────────────────────────────────────────────┘
        ▼                                          │                     ▲
 pack-NNNN.json  ──────────────────────────────────┴─────────────────────┘
   (the same core/ code runs in tools/, in the browser, and in the v2 Worker)
```

### 6.2 File and module layout

The project name is still to be decided. Global IIFE/UMD modules load in script order, and a file may only use modules above it (steelhag2 §9.2's rule).

```
museum/
  index.html            ?seed= ?pack= ?dept= ?persona= ?scene= ?lights=0
  css/style.css
  fonts/                tiny5.ttf (or m5x7), SOURCES.md with licences; inlined by build
  js/
    core/rng.js         string-hash → sfc32 streams; rng(seed, ...path)
    core/registry.js    authored archetypes, effects, rooms, furniture, materials (IDs only)
    core/pack.js        load + shape-check packs; deptId = content hash
    core/grid.js        map type, recursive shadowcasting FOV, A*, Dijkstra maps (ported, deterministic)
    core/sequence.js    department sequencer and door offers
    core/layout.js      room-graph → tiles (method per levels brief)
    core/placement.js   exhibits, furniture, label anchors, light pools as data
    core/actors.js      species behaviours (archetype → policy), awake/dormant
    core/items.js       effect primitives, identification-as-attribution
    core/balance.js     role × depth → numbers (never from the LLM)
    core/rules.js       energy/speed scheduler, step(state, action) → events
    core/run.js         run state, meta hooks, snapshot/replay
    art/palette.js      ramps, reserved semantic colours, contrast lint
    art/grid.js         index-grid decoder (from vanguard-zero art.js), flips, solid/tint
    art/parts.js        silhouettes + ornament overlays + anchors
    art/beings.js       Bollinger masks (seeded) + cleanup
    art/paintings.js    procedural paintings and frames
    art/tiles.js        walls (3/4 face), floors, vitrines, plinths, plaques; per-department bake
    view/render.js      Canvas 2D, integer zoom, baked static layer, light pools (Bayer)
    view/fx.js
    ui/labels.js        tombstone/body/panel tiers; DOM overlay
    ui/hud.js ui/menus.js ui/catalogue.js ui/directory.js
    audio/synth.js      fork of vanguard-zero audio.js
    audio/music.js      motif + mode → tracker patterns; tension layers
    audio/sfx.js audio/ambience.js
    input/keys.js input/touch.js
    store/save.js       meta (localStorage), packs/atlases (IndexedDB), visitor's-card export
    net/gen.js          (v2) proxy client, verify, cache
    game.js             boot, loop, state machine, __sim / __pt hooks
  content/
    pack-0001.json      curated departments
    directory.json      grammar for unvisitable departments
  tools/
    build-single.py     inline css/js/fonts/packs → dist/museum.html
    check.js            vm-load core, schema + lint packs, determinism hashes, connectivity
    sim.js personas.js  headless balance runs (multi-process)
    qd.js               MAP-Elites over departments (after scriptprof/js/evolve.js)
    gen/frame.js gen/spec.js gen/text.js gen/sprite.js gen/lint.js gen/batch.js
    atelier.html        sprite/palette workbench, contact sheets
    curator.html        accept/edit/reject with reasons
    shot.js             Playwright screenshots + pixel checks
  server/worker.js      (v2) /dept endpoint, KV cache, rate limits, runs core/ for the sim gate
  dist/museum.html
  DESIGN.md README.md DEVELOPMENT.md
```

### 6.3 Build order

Each milestone gets a `?scene=` demo and an acceptance test, as in steelhag2 §9.3:
- **M0:** rng, grid and rules with a one-room department; a determinism hash and a bot win in Node.
- **M1:** art and render; rebuild this brief's gallery mock-up at 390×844 and 1280×720.
- **M2:** layout and placement from one hand-written department; 1,000 layouts connected.
- **M3:** labels UI; a phone font test.
- **M4:** personas and `sim.js`; a win-rate table on three hand-written departments.
- **M5:** the `gen/` pipeline on 20 seeds; lint pass rate and curation coefficient logged.
- **M6:** audio.
- **M7:** meta and persistence; export, import and an iOS PWA device test.
- **M8 (v2):** the proxy.

---

## 7. The technical decisions to make, in one list

1. **T1 Platform:** vanilla JS and Canvas 2D, single file *(lean)*; or Phaser/Pixi; or Godot; or Python.
2. **T2 rot.js:** port FOV and pathing ourselves *(lean)*, or use rot.js for them; never its generators.
3. **T3 Modules:** IIFE/UMD with JSDoc and `build-single` *(lean)*, or ES modules and a bundler, or TypeScript.
4. **T4 Tile size:** 16×16, with 32×32 Masterpieces *(lean)*.
5. **T5 Art source:** code-drawn grids, parts, masks and palettes, with LLM grids for signature exhibits *(lean)*. CC0 for placeholders only. Diffusion for painting detail views only.
6. **T6 LLM placement:** offline Batch packs for v1 *(lean)*; a caching proxy for v2; no BYOK or local model.
7. **T7 Label rendering:** DOM overlay with a pixel webfont *(lean)*; font chosen after a phone test.
8. **T8 Models:** Opus 5.5 for generation, Haiku 5.5 for judges and lints *(lean)*; effort set by measurement.
9. **T9 Determinism:** the full contract *(lean)*.
10. **T10 Persistence:** localStorage and IndexedDB, `persist()`, PWA and export codes *(lean)*.
11. **T11 Audio:** fork vanguard-zero's synth and tracker, with linted LLM motifs *(lean)*.
12. **T12 Bots:** a pure Node core with personas *(lean)*; Playwright only for visuals.
13. **T13 Pre-generation** (v2): door stubs, then full generation during a staircase interstitial *(lean)*.
14. **T14 Hosting:** static for v1 *(lean)*; add a Worker only with v2.
