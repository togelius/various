# ACCESSION: should the board be isometric 3D? A probe

**Question (Julian):** "What about isometric 3D?" instead of top-down 2D tiles.

**Answer:** Keep top-down 2D for play. At the classic isometric angle with realistic gallery walls, the camera hides 27–47% of the floor tiles the player can see in the game, and about half the positions where an exhibit could stand. The tiles are also too small to tap reliably. Each fix either gives up the 3D or brings its own readability cost. 3D is worth using offline as a sprite source, and on screens where nobody has to read the board.

## 1. What I built

The code and data are in [`../prototypes/iso-probe/`](../prototypes/iso-probe/).

- **Layouts**, unmodified output of `proto.js`:
  - `--show sculpture_court 6 1`: the §10.4 court, 37×27, 702 walkable tiles.
  - `--show enfilade 3 0`: a Cabinet, 36×20, 523 walkable tiles.
- **Shared logic** (`common.js`):
  - proto.js's movement and sight sets: vitrine, pool and low plinth block movement only; wall, column and partition block both;
  - symmetric-shadowcasting line of sight and BFS tap-to-move paths.
- **Scenario per layout:**
  - a player;
  - five exhibits: A in a vitrine; B behind a column (court) or a statue (enfilade) as seen from the camera; C in the open, awake, telegraphing a lunge; D on a plinth; E one tile in front of a south wall;
  - a tap target with its path, and the presence ring.
- **Same chrome in both views:** a top bar and a two-row strip plus action bar, leaving a 390×692 CSS px play area on the phone.
- **Top-down** (`topdown.html`): Canvas 2D, 16×16 flat-colour tiles with glyphs, integer-scaled, tiles out of line of sight dimmed.
- **Isometric 3D** (`iso.js`, three.js r180):
  - orthographic camera at 35.26° (true isometric), from the south-east;
  - one tile is 1.5 m, so walls of 3 units are 4.5 m and figures are about 1 unit;
  - glass vitrines with frames, columns, plinths, benches and a pool;
  - a sun with shadows and two spotlight pools; line of sight dims floor and furniture.
  - Scale *s* is CSS px per tile edge: s32 and s48 match the top-down 2× and 3×.
- **Occlusion fixes:**
  - **cutaway:** walls within 7 tiles, or between the camera and the player's surroundings (XCOM-style, along the view ray), cut to 0.3;
  - **x-ray:** the same walls at 22% opacity, plus silhouettes of hidden figures;
  - **walls down:** every wall at 0.35.
  - I also rendered a 60° camera and the 2:1 pixel-art angle (30°).
- **Measurement comes from the render, not an estimate.**
  - An ID buffer draws every walkable floor top, piece of furniture, wall and figure in a unique flat colour. Visible pixels with occluders are divided by pixels without them. Under 25% counts as **hidden**, 25–75% as **partly hidden**.
  - An independent CPU ray-cast agrees: 56.0% hidden in the court, against 53.3% from the ID buffer.
  - **Whole-map figure test:** a figure on every walkable tile, in nine non-overlapping passes.
  - **Tap tolerance:** the radius of the largest disc around a tile's centre that hits only that tile, picking the first object hit.

## 2. Measured

**Viewport.** The phone's play area is 390×692 and the Mac's is 1440×748. Where two values are given, they are court / enfilade.

| View | One tile on screen (CSS px) | Tiles across × down | Map tiles on screen | Reach from player | Safe tap radius |
|---|---|---|---|---|---|
| Top-down 2× | 32×32 square | 12.2 × 21.6 | 273 / 247 | 6 E–W, 10 N–S | 16 px |
| Top-down 3× | 48×48 square | 8.1 × 14.4 | 135 / 135 | 4 E–W, 7 N–S | 24 px |
| Iso s32 | 45×26 diamond | 8.6 × 26.5 diamonds | 376 / 329 | 8 along map axes; **4 NE–SW**, 12–13 NW–SE | ≤ 11.3 px, median **0** |
| Iso s48 | 68×39 diamond | 5.7 × 17.7 | 192 / 180 | 5; **2 NE–SW**; 8–9 NW–SE | ≤ 16.6 px |
| 3D, 60° camera, s32 | 45×39 | 8.6 × 17.7 | 300 / 279 | 8; 4; 8–9 | median 13.6 / 8.1 px |
| Mac, top-down 2× / 3× | 32 / 48 | 45 × 23.4 / 30 × 15.6 | 782 / 720 (whole enfilade) | 22 / 15 E–W | 16 / 24 px |
| Mac, iso s32 / s48 | 45×26 / 68×39 | 31.8 × 28.7 / 21.2 × 19.1 | 926 / 720 (whole map) | 27–29 / 18–20 | ≤ 11.3 / 16.6 px |

**Occlusion on the phone, iso s32.** Court / enfilade.

| | No fix | Cutaway | X-ray | Walls down | 60° camera, no fix |
|---|---|---|---|---|---|
| Walkable tiles on screen that are hidden | 48% / 61% | 39% / 35% | 39% / 35% | 5% / 1% | 16% / 25% |
| …of those in the player's **line of sight** | **27% / 47%** | 17% / 11% | 17% / 11% | 3% / 1% | 7% / 18% |
| Tile centres covered by another object (untappable) | 57% / 67% | 49% / 40% | 49% / 40% | 15% / 4% | 21% / 27% |
| Player visible | 39% / 100% | 100% | 100% | 100% | 100% |
| Exhibits hidden (under 25% visible) | B; E off-screen | B | B, shown as a silhouette | B | B |
| Exhibits partly hidden | A (70%, through glass and frame), C (52%) | A, C | A, C (hidden part as a silhouette) | A, C | — |
| Enfilade exhibits hidden | B (6%), E (0%); A partly (72%) | B (11%) | B, shown as a silhouette | B | E (0%) |

**Whole map: every walkable tile, a figure on every tile.**

| Camera | Wall height | Floor hidden | Figure positions hidden | Figure positions partly hidden |
|---|---|---|---|---|
| 30° (2:1 pixel isometric) | 3 | 57% / 61% | 57% / 60% | 14% / 20% |
| **35.26° (isometric)** | **3** | **53% / 60%** | **45% / 48%** | **16% / 19%** |
| 35.26° | 1.5 | 22% / 25% | 23% / 24% | 7% / 6% |
| 45° | 3 | 40% / 47% | 44% / 48% | 4% / 5% |
| 60° | 3 | 22% / 27% | 24% / 27% | 2% / 2% |
| 60° | 1.5 | 1% / 2% (25% partly) | 0% / 0% | 21% / 26% |
| 35.26°, walls down | 0.35 | 4% / 1% | 6% / 1% | 6% / 1% |

**Other measurements.**
- **Camera rotation:** 42% / 40% of all floor tiles are hidden in the default view but visible from at least one other 90° angle. 11% / 20% stay hidden from all four: the 2-wide staff corridor and narrow galleries. Each view still hides about half the floor, so players would rotate constantly.
- **Load size:** the tree-shaken, minified three.js bundle of the iso view is 545 KB, 140 KB gzipped. Canvas 2D needs no library; `vanguard-zero`'s whole game is 293 KB.
- **Scene cost:** 39–47 draw calls and 14–26k triangles, with geometry merged.
- **Determinism:** both renderers gave identical PNG bytes across runs, fresh browsers, and both Chromium headless modes on SwiftShader, MSAA WebGL included.

## 3. Readability judgement: phone, line-of-sight tactics

This judgement is mine, from the screenshots; no players have seen them.

- **Line of sight fails at the core.** The rule is "it woke because it saw you", and the labels must explain wakes. At the classic angle, a quarter to a half of the tiles the player sees in the game are hidden on screen behind walls or columns. Exhibit B, a stirring exhibit the player must watch, is hidden in every fix except x-ray (and, in the enfilade, the 60° camera). In the court, a wall three tiles away hides the player's own telegraphed tile. Top-down shows all five exhibits and every telegraphed tile, by construction.
- **Every fix changes what the walls mean.**
  - **Cutaway:** a cut wall reads as a low wall, yet still blocks sight, so a wall stub and a vitrine base look alike. The cut region also shifts with every step.
  - **X-ray:** shows figures but not the floor behind walls.
  - **Walls down:** leaves 1–5% of the floor hidden, but it is then a top-down plan with extruded furniture: top-down at 3D's cost.
- **Lighting fights the line-of-sight shading.** Shadow under columns and floor out of sight are both "darker floor", and in the renders they are hard to tell apart.
- **Glass is 3D's real win.** A framed translucent box says "solid but see-through" without a legend, far better than top-down's pale square, so "see the loot you can't reach" reads at a glance. The exhibit inside is 70–82% visible through the frame.
- **Tapping is unreliable.**
  - At s32, no tile allows a tap disc wider than 22.6 px. That is below [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)'s 24-px minimum, let alone [Apple's](https://developer.apple.com/design/human-interface-guidelines/accessibility) 44-pt target. More than half the tile centres on screen are covered by a wall, a column or another figure.
  - A 44-px disc inside an isometric diamond needs s ≈ 62: an 88×51-px diamond, 4.4 across the phone.
  - In top-down, 3× gives 48-px tiles; integer device scaling on a DPR-3 phone also gives 42.7 px (8 device px per art pixel, about 9 across).
- **Portrait skews the isometric view.** It shows 12–13 tiles along one diagonal but only 4 along the other, so a threat 5 tiles NE is off screen while one 12 tiles SE is on it. In the enfilade this happened to help: C, eight tiles west, is on screen in iso but not in top-down 2×. Portrait-oriented layouts would do the same in 2D.
- **On the Mac,** hover highlighting removes most of the targeting problem, and the diorama looks lovely. The occlusion is the same.

## 4. Precedents

- **Readable phone tactics keep the board small or flat.**
  - [Into the Breach](https://gameinformer.com/games/into_the_breach/b/pc/archive/2018/02/26/game-informer-review-into-the-breach): 2D isometric pixel art, an 8×8 board all on screen, low terrain. Its port needed a ["revisited and redesigned" touch interface](https://www.gamedeveloper.com/game-platforms/netflix-subscribers-will-be-able-to-play-into-the-breach-on-ios-and-android).
  - Hoplite: levels fit on one screen ([iPhoneSoft](https://iphonesoft.fr/2014/01/07/test-hoplite-iphone-ipad)).
  - Hitman GO and Lara Croft GO: 3D dioramas, but movement on sparse nodes ([TouchArcade](https://toucharcade.com/2014/02/13/hitman-go-announcement/)).
  - Shattered Pixel Dungeon: top-down with large squares ([review](https://goodolddays.net/en/game/Shattered-Pixel-Dungeon)); players still report mis-taps and ask for a confirm step ([thread](https://old.lemmy.dbzer0.com/comment/11545759)).
- **Full 3D tactics struggles on phones.** On iOS, XCOM 2's phone UI "takes a bit of getting used to for touch targets" ([TouchArcade](https://toucharcade.com/2020/11/09/xcom-2-collection-ios-review-ipad-pro-iphone-comparison-ps4-dlc-download-controls/)). On Android it is "too hard to play on a phone, thanks to the tiny/laggy UI" ([Android Police](https://www.androidpolice.com/2021/07/13/xcom-2-collection-android/)). Both quotes are from search summaries.
- **Others:**
  - [Tactical Breach Wizards](https://en.wikipedia.org/wiki/Tactical_Breach_Wizards): isometric, PC only; its occlusion handling is unverified.
  - Cogmind: top-down, built for readability, not on mobile.
  - [Monument Valley](https://www.vam.ac.uk/event/BdWbM4YE/the-making-of-monument-valley-sept-2018): the isometric phone look works for single-screen dioramas with no hidden-information grid.
- **Occlusion fixes:**
  - The Sims' walls up, cutaway and down ([guide](https://twinfinite.net/?p=314684));
  - camera-ray cutouts, x-ray silhouettes and 90° rotation;
  - cutaways remove context ([Burns & Finkelstein 2008](https://pixl.cs.princeton.edu/pubs/Burns_2008_ACF/adaptive_cutaways.pdf)).
  - A museum-heist developer hit exactly this: "closed-space locations, such as museums" ([Purplane devlog, 2022](https://itch.io/devlog/370116/top-down-view-and-character-obstruction.amp)).

## 5. Costs

- **Architecture and furniture** are cheap: everything in this probe is code-built primitives.
- **Exhibits and beings are the expensive part.**
  - **Voxel grids written by a language model.** I wrote two objects as text slices without previewing: an amphora and a haloed plaster saint, 1,192 voxels, about 1,600 characters each (6× a 16×16 grid; a 16³ grid would be 16×). Rendered once (`../prototypes/iso-probe/shots/voxel_llm_test.png`), both are recognisable. But the amphora's handles merged into a lump, the halo lies flat like a lid, and the eye sits on the side of the head. This was one attempt, with no repair loop, judged only by me. The [.vox format](https://github.com/ephtracy/voxel-model/blob/master/MagicaVoxel-file-format-vox.txt) is documented; [LLaMA-Mesh](https://arxiv.org/pdf/2411.09595) found that untrained models write only simple shapes.
  - **CC0 kits:** [Kenney Mini Dungeon](https://kenney-assets.itch.io/mini-dungeon), [Kenney Furniture Kit](https://opengameart.org/content/furniture-kit), [KayKit Dungeon Remastered](https://kaylousberg.itch.io/kaykit-dungeon-remastered), [Quaternius](https://opengameart.org/content/lowpoly-modular-dungeon-pack). Fine for grey-box; no exhibits, and an imposed style.
  - **Image-to-3D models (offline, need curation):**
    - [TRELLIS.2](https://huggingface.co/microsoft/TRELLIS.2-4B): MIT licence, Dec 2025, 24 GB NVIDIA GPU, Linux.
    - [Stable Fast 3D](https://huggingface.co/stabilityai/stable-fast-3d): Community licence, free under US$1M annual revenue; about 6 GB VRAM ([repo](https://github.com/Stability-AI/stable-fast-3d)).
    - [TripoSR](https://huggingface.co/stabilityai/TripoSR): MIT, 2024, weaker.
    - [Hunyuan3D 2.1](https://huggingface.co/tencent/Hunyuan3D-2.1/raw/main/LICENSE): the licence excludes the EU, UK and South Korea, needs Tencent's permission above 1M monthly users, and bans using outputs to improve other models. Unsuitable for a game shipped worldwide.
    - At a 26-px diamond, most of their detail is invisible anyway.
- **Animation:** 2D is 2–4-frame grids. In 3D, rigid tweens (bob, lunge) are cheap, but skeletal animation needs rigs. Mixamo is free for games ([FAQ repost](https://community.adobe.com/t5/mixamo-discussions/mixamo-faq-licensing-royalties-ownership-eula-and-tos/m-p/13234775)) but rigs humanoids only ([guide](https://app.cinevva.com/guides/free-character-animations-rigging)).
- **Engineering:**
  - the occlusion system, occlusion-aware picking with a confirm step, and lighting tuned not to fight line of sight;
  - capping DPR: by my arithmetic, 4× MSAA at DPR 3 needs about 95 MB of buffers, and the probe's 4096² shadow map about 64 MB;
  - handling WebGL context loss when iOS backgrounds the page ([WebKit 261331](https://bugs.webkit.org/show_bug.cgi?id=261331));
  - the extra 140 KB gzipped.
- **Performance and battery** should be fine if frames render only on change ([three.js manual](https://threejs.org/manual/en/rendering-on-demand.html)). Not measured on a phone.
- **Tests:**
  - Canvas 2D at integer scale is exact.
  - WebGL is exact on one software renderer, but across GPUs it needs tolerances. three.js's own CI uses software Vulkan, a 0.1 per-pixel threshold, at most 0.1% differing pixels, and an exception list that includes shadow maps ([puppeteer.js](https://github.com/mrdoob/three.js/blob/dev/test/e2e/puppeteer.js)). Playwright warns that rendering varies with "host OS, version, settings, hardware, power source" ([docs](https://playwright.dev/docs/test-snapshots)).
  - ID-buffer assertions like the ones used here (which tiles are visible) are a robust semantic alternative.
- **Isometric 2D pixel art** has the same occlusion problem, plus 2–4× the art per object, and four rotations if it offers rotation.

## 6. Recommendation

1. **Play stays top-down Canvas 2D (D12).**
   - On DPR-3 phones, default to 42.7-px tiles (8 device px per art pixel, about 9 across) or 48 px (3×); pinch to 2× for overview.
   - Add the planned 3/4 wall face, and keep tall sprites within about 4 px of their tile.
2. **Use 3D offline, as a sprite source.** Render primitive or voxel models to 16×16 or 32×32 sprites at a fixed 3/4 angle, with baked light and glass highlights. Dead Cells used 3D models rendered to 2D sprites so that one artist could animate quickly ([80.lv](https://80.lv/articles/interview-with-the-developers-of-dead-cells)).
3. **Use isometric 3D set-pieces where the board is not being read:**
   - a department's opening diorama;
   - viewing the Centrepiece at the lectern;
   - the Stair Hall;
   - the Directory or Atlas.
   - These could also help the "museum or dungeon" blind test at M2.
4. **If 3D in play is still wanted,** the least-bad configuration is:
   - a 55–60° camera, walls of 1.5 units or less, and the camera-ray cutaway;
   - x-ray silhouettes and 90° rotation;
   - ground-plane picking with a confirm tap, and s ≥ 62 on phones.
   - Test it on a real phone before the slice gate, and expect it to look like top-down with extrusions.

## 7. What I could not verify

- **No real phone was used.** Frame time, battery, heat, memory, context loss and touch accuracy are all unmeasured. SwiftShader's 120–190 ms per frame on the CPU says nothing about a phone GPU.
- **No players saw the screenshots;** readability is my judgement.
- **Precedents:** Into the Breach's mobile orientation, Tactical Breach Wizards' occlusion handling and XCOM's cutaway internals. Some quotes come from search summaries. TouchArcade's Into the Breach interview returned HTTP 403, and Apple's guidelines page could not be read as text (WCAG's 24 px was verified).
- **Licences:** the full Stable Fast 3D licence text and TRELLIS.2's dependency licences.
- **Assumptions in the numbers:** walls of 3 units (4.5 m) and figures of about 1 unit are mine; taller galleries make things worse. The statistics cover two layouts; the staff corridor inflates "hidden from all four angles". The cutaway radii are one choice among many.

## Appendix: files

In [`../prototypes/iso-probe/`](../prototypes/iso-probe/):
- **Code:** `common.js`, `topdown.html`, `iso.html`, `iso.js`, `ui.js`, `layouts.js`, `shoot.mjs`, `run_all.mjs`, `sweep.mjs`, `cpu_check.js`, `check_scen.js`, `determinism.mjs`, `voxel.html`, `voxels.js`.
- **Data:** `results.json`, `sweep.json`, and the two layouts in `layouts/`.
- **Images kept:** the four overview sheets (`shots/sheet_sc_phone.png`, `shots/sheet_enf_phone.png`, `shots/sheet_fixes_phone.png`, `shots/sheet_sc_mac.png`, at half resolution), `shots/crop_sc_phone_native.png` and `shots/voxel_llm_test.png`.
- The 40 individual screenshots were not kept. `npm install`, then `node run_all.mjs` and `node sweep.mjs`, regenerate them and the numbers (about 5 minutes on SwiftShader). The `_labels` variants draw the exhibit letters on top, even over hidden exhibits.
