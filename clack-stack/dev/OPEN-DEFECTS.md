# Open defects after the component build

Each chain's last verifier round found these; none has been fixed yet. Verify each before fixing.

## core-m12 (final verifier, unfixed)

### core-m12-1: Ghost honesty for mouse players right after the game starts or resumes
**Evidence:** `stale.cjs` at 844x390:
(a) After clicking TAP on the title at x=640, the hand is drawn at x=422 with a ghost on `sq:-2,0,0` (sx 397). Clicking again without moving the mouse locks a MISS (`lastRelease.ghostKey` null).
(b) Pause, then click RESUME at x=422: the hand is drawn at x=250 showing the red X. Clicking without moving lands a CLACK on `sq:-2,0,0`.
Cause: `onPointerMove` (`index.html` 1566–1569) only moves the hand while phase is 'play'. `startGame` (1424) puts the hand at the centre and `resumeGame` (1486) leaves it at its old x. `onPointerDown` (1559) then calls `setHandX(clientX)`, so the drop goes to a different slot than the ghost on screen. This breaks 'the ghost never lies' for the first click after the title or a resume.

**Suggested fix:** Track the mouse x in every phase:
`let PTR = {x: 0, has: false};`
`onPointerMove`: `if (e.pointerType === 'mouse') { PTR.x = e.clientX; PTR.has = true; if (S.phase === 'play') setHandX(e.clientX); return; }`
Also set PTR in `onPointerDown`. At the end of `startGame()` and in `resumeGame()`: `if (S.inputType === 'mouse' && PTR.has) HAND.x = HAND.dx = clamp(PTR.x, 0, CAM.W);`
Add a check to `tools/feel.cjs`: click the title off-centre (and click RESUME), then mousedown without moving; `lastRelease.ghostKey` must equal the `CS.ghost().key` shown before the click.

### core-m12-2: Screenshots at 844x390: the ghost is visible (first-run hint state)
**Evidence:** `hint2.cjs` measured the hint label against the first ghost:
- 844x390: label y 271–303, ghost y 277–328, overlapping.
- 667x375: label 265–297, ghost 267–315, overlapping.
- 390x844 and 1366x1024: clear.
`vfy12/sheet_hint.png` shows 'MOVE… CLICK!' and '← → … SPACE!' written over the dashed ghost on the car base. That is the drop target a first-time player is being taught to look at, and it stays covered until the first clack. Cause: `drawHint` (`index.html` 1989–2022) puts the label at a fixed `CAM.handY + 2.6·L + 96`, which in short landscape lands on the car top (groundY 353).

**Suggested fix:** Place the label in free space instead of a fixed offset. For example: `const ghostTop = S.ghost ? w2s-based top y : CAM.baseY - 1.5*L; labelY = Math.min(y + 96, ghostTop - 0.4*L - size/2);`
If that collides with the finger icon in landscape, move the finger to `CAM.handY + 1.5*L` and the label just under it. Alternatively, draw the label beside the hand line, at x = originX ± (half + 2.2)·L.
Add a label-versus-ghost rectangle overlap check to `tools/shots.cjs` for the hint state at 844x390 and 667x375.


**Verifier notes (non-failures, consider):**
holds the hand for 0.117 s, once per slot entered.
- **Touch probe:** a tap in HOLD swaps without dropping; the pause button and RESUME work. Pinches, swipes and double taps never zoom or scroll the page. Only the first finger moves the hand and drops; touchcancel never drops.
- **Ghost flicker:** slow sweeps of 0.5 px per frame with the mouse and touch drags, across 5 built towers and 3 viewports, produced 0 A→B→A flips.
- **Soak:** 1,500 mixed mouse, touch and key releases across normal, BIG MAGNETS (cubes), L3, ?debug, 1366x1024 and 667x375 gave 0 mismatches and 0 errors. 60 spam clicks, a resize mid-flight, an orientation flip (auto-pause), pause mid-flight, a hidden tab, and MENU then restart all behaved; BIG has no fuse.
- **Contract:** every Art and Sfx function in BUILD.md exists with the right parameters, and no Art call changes the canvas state. Every Sfx call is safe before unlock; clack, zzip and miss play once audio is unlocked. Sections are in order, there is one classic script, nothing loads from `dev/`, and `Math.random` is only used for cosmetic effects.
- **Performance:** about 3.5 ms of JS per frame with an 18 L tower and 53 debris.
- **Screenshots** at 390x844, 844x390, 1366x1024 and 360x740: the build, hand, ghost and HUD are visible and not clipped.
- **Feel:** I watched slow-motion frames of a drop. They show the lean, the yank, the white flash, edges glowing, sparks, the squash, the PERFECT ring, stacked "PERFECT ×3!" and "TRIPLE CLACK!" pops, "+75", the ×N chip and the rug pulse. It is clearly on the way to super fun and fast paced.

**Notes that are not counted as failures:**
1. **Font console error.** If tests abort the font requests (as BUILD.md tells them to) or the page is offline, the Google Fonts link logs a `Failed to load resource` console.error. The builder's harness answers font requests with an empty stylesheet instead, which avoids it. The lead's harness should do the same.
2. **Zoom padding changed without saying so.** The code uses G + 1.8 where §9 says G + 0.8 (`index.html` lines 44–46). The change is justified: the spec formula puts the ribbon through the held tile at 844x390. It only changes landscape phones (L 50.5 instead of 61), but the report doesn't list it.
3. **Report vs code on dead ends.** The report lists dead ends as a known gap, but the code handles them with a TOPPLE and a new base rolling in.
4. **`handReady` during TOPPLE.** It stays true while drops are refused, so bots must also check `state().locked`.

I accidentally overwrote a scratch file, `scratchpad/contract.cjs`, that another agent had left there; everything of mine is now in `scratchpad/vfy12/`. My probes are in `/tmp/claude-0/-home-user-various/eea7fc80-8598-5a7a-a3e6-cdbd34e6e76d/scratchpad/vfy12/`: `flicker.cjs`, `contract.cjs`, `inputs.cjs`, `tall.cjs`, `soak.cjs`, `film.cjs`, `hint.cjs`, `hint2.cjs`, `stale.cjs` and `abort.cjs`, plus the `mut/` copies and the frame sheets. I did not edit `index.html` or anything in `tools/`.

## core-m3 (final verifier, unfixed)

### core-m3-1: Crash reads clearly and is glorious in landscape (and whenever the camera has scrolled up at minimum zoom)
**Evidence:** `camprobe.cjs` at 844x390, level 5, crash of a 12.7 L tower: at the crash the camera offset is 179 px, so the wheel/rug line is at screen y=532 on a 390 px screen. The burst (t+0.14 to 0.27 s game time) and the car flip happen entirely below the bottom edge. The old car first appears at about t+0.73 s, the rug line re-enters only at t+0.79 s, and the new base is ready at t+0.98 s with the rug 16 px from the bottom. The camera keeps its scroll from the old tower top until `newBase()` resets the top, then eases back at only 3/s. Frames `crashL/frame-03.png`, `-08.png` and `-11.png` show the tower cut off at the bottom and tiles falling out of view. Portrait 390x844 is fine (camera offset 0 throughout). In 844x390 the scroll starts at towers above about 7.3 L, so this hits most landscape crashes from L5 on.

**Suggested fix:** In `updateCamera()` (index.html ~2413), while `S.phase === 'crash'` (set in `doCrash`) use a camera target of 0 (the rug in view) and a faster ease. For example k = 1 - exp(-10*dt) during `CR.stage` 'fall'/'unzip'; the 0.35 s slow motion leaves time for the pan. `debrisHalfW()` already handles the zoom change. Optionally also cap the zoom-out during the crash so the pile fills the view.

### core-m3-2: SAVE juice timing (DESIGN §8: 'SAVE | the wheel slaps down with a thump and a rising whoosh')
**Evidence:** `saveP/sheet-s1.png` (seed 1, level 3): the counterweight lands at t=4.36 (DOUBLE CLACK) and the wheel is back down at about t=4.83 (θ/α 0.00). `Sfx.save()`, 'SAVE!' and the +150 only arrive at t=5.30: 0.47 s after the slap and 0.94 s after the counterweight. The cause is in `stepTip()` (~1442-1450): `doSave()` waits for `SAVE_REST` (0.2 s) of stillness with nothing in the air and a clean look-ahead, after the remaining small rocks settle. The reward is detached from the moment the player saved it.

**Suggested fix:** Pay the SAVE on the first slap-down (`TW.evSlap` or `evRest`) of an excursion that has `EXC.saveSide` set, when nothing is in the air and `predictCrash(CFG.DOOM_HORIZON) < 0`. With no new input the look-ahead runs the same physics as the game, so the SAVE cannot be revoked. Keep the existing rest check only as a fallback for excursions that never slap.

### core-m3-3: Builder report accuracy (kick inertia)
**Evidence:** The report says 'Kick size uses the reference tower's inertia, not the live tower's'. The code uses a blend: `kickInertia()` (index.html:1226-1230) returns I_ref^0.65 · I_P^0.35 (`CFG.KICK_I_EXP = 0.35`, line 69). The config comment says pure I_ref would let one CLACK fell a 10 L tower. The behaviour is reasonable, but the report misstates it.

**Suggested fix:** Correct the report and handoff notes to describe the I_ref^0.65 · I_P^0.35 blend; no code change needed.


**Verifier notes (non-failures, consider):**
 own checks (scripts in `/tmp/claude-0/-home-user-various/eea7fc80-8598-5a7a-a3e6-cdbd34e6e76d/scratchpad/v/`)**
- **Stress test (`stress.cjs`):** about 4,500 releases of random real-input play (mouse, double-clicks, HOLD, right-click, keys, touch) at levels 1, 3, 5, 7 and 9.
  - No NaN, no tower stuck mid-tilt, no endless rocking, no debris below the rug, no piece jittering awake.
  - Every crash returned to play in 0.84–0.99 s, and every crash had a `tipwarn` before it.
  - About 10% of random-play crashes were warned only 0.41–0.49 s ahead. These are towers knocked over by the landing kick of the tile that dooms them. One traced case: a CLACK took the rock from 0.26 to 3.48 rad/s on a 1 L tower, which went over 17 ms after landing. The warning fires when that tile is released, so the lead can never exceed its fall time. The design's "0.6–0.9 s to save" does not hold for these. EdgeBot's crashes are slow tip-overs, so its acceptance check is unaffected. One earlier run showed a 0.158 s lead that I could not reproduce in 165 more crashes.
  - Once in about 290 piles, a car piece at L1 was still sliding 3 s after a crash. Not reproduced.
- **Ghost honesty while rocking (`rockhonest.cjs`):** 200 releases, 170 while the tower was moving. The ghost shown, the slot locked and the slot landed in matched every time, and a gold ghost always gave PERFECT.
- **Debris fuzz (`debfuzz.cjs`):** 24 bursts of 40 pieces each, all asleep by 2.27–2.67 s. A car dropped on its end falls flat and sleeps, a ring rolls and stops, a square on its corner falls flat.
- **Crash interruptions (`crashedge.cjs`):** pause by P, Esc, the pause button, a hidden tab and a rotation, and MENU, at each crash stage (fall, unzip, pile): 18/18 freeze and resume or restart cleanly.
- **RandomTapper at L1:** goal reached in 10/10 seeds, 4.7–17.3 s, with zero crashes.
- **Performance:** about 2.1 ms JS per frame with a 14 L tower and 53 debris.

**Visual verdict**
- **Portrait crash:** reads well. Red blush and vignette, TIMBER!, a top-first burst, the car flipping wheels-up, dust, dizzy stars, and the new car shoving the colour-mixed pile. Pieces only "pop" (speed capped at 5.5 L/s), so the spread is modest but fine.
- **Near-tip SAVE and BRACE:** both read clearly.
- **TIPPY ghost:** red dashed rim with a "!".
- **Overall:** with Art and Sfx still stubs, it is on its way to "super fun and fast paced", apart from the landscape crash camera.

**Smaller notes for you**
- **GREAT barely rocks the tower.** It peaks at 0.108 α instead of 0.25 α, and CLACK flex is 0.049 L instead of about 0.2 L, so the moving target sways very little except after CLACKs.
- **The tip tell looks ahead,** so `tipwarn`, the red vignette and blush, and a full-volume creak can fire while the tower is still upright, as soon as a doomed tile is released.
- **Keyboard detent on a rocking tower:** it parks the hand for 0.12 s while the slot keeps moving.

I edited nothing in the repo; all my files are in the scratchpad.

## core-m47 (final verifier, unfixed)

### core-m47-1: Play loop clarity at the crown moment (portrait): the goal label covers the crown's target slot
**Evidence:** In checkGoal() (index.html ~line 2402), y = clamp(_s.y - 30, …), where _s.y is the ribbon's screen y. The full-width goal label, the stacked '+bonus' pop and confetti_burst at the ribbon all land on the top of the tower: exactly where the crown's slot and ghost are, at the moment giveCrown() puts the crown in the hand. The label lives 1.4 s. Measured at 390x844 L1, seed 4: label box y 506–542, x 12–378; the highest crown slot y 494–539, x 143–195. They overlap. With the real art (scratchpad/ver3/seqP/smash frame 'crown-aim') the crown ghost is barely visible under 'TALLER THAN THE WATERMELON BAG' plus '+160'. In landscape (844x390) the clamp pushes the label below the slot, so there is no overlap (slot y 91–135, label y 235–285).

**Suggested fix:** Keep the label out of the band from about 1 L under the ribbon to 1.5 L above it. For example, place it over the tower body: y = clamp(ribbonY + 1.3*L + 20, hudBottom + L*1.6 + 40, groundY - 120). Or use the side spot juiceLand() uses when there is more than 120 px beside the tower. Also emit the confetti from that label position instead of the ribbon, and shorten the label's life to about 0.9 s so the crown aim is clear.

### core-m47-2: M7 acceptance after integration: with level=15, tile bodies differ from the background behind them by at least 40 luminance
**Evidence:** tools/hazards.cjs passes against index.html with the stub Art (worst 60 portrait, 62 landscape). The same game with the real dev/art.js and dev/audio.js inlined (CLACK_GAME=scratchpad/v/integ.html) fails: '390x844 worst 26: purple/up 121:94, orange/sq 135:96'; '844x390 worst 39: red/sq 106:67'. The low cases are darker tile colours in front of the lamp-lit console and wall of the real night room. flow.cjs passes fully on the same integration copy. The builder's 'at least 57' figure applies only to the stub.

**Suggested fix:** Flag this to the lead and the art builder: the cause is in dev/art.js, not index.html. Art's night tile body needs more lift against the lit room: §9 asks for source-over at alpha 0.8 plus a 'screen' glow, so raise the glow or add a lighter rim for purple, red and blue. Alternatively, keep the night room's lit areas behind the build dimmer at skyT=1. Then re-run hazards.cjs with CLACK_GAME pointing at an integration build before inlining.

### core-m47-3: Rotation during the title shove (the 'start' phase, 0.45 s)
**Evidence:** layout() deliberately skips updateCamera() while the phase is 'start' or paused from 'start', so CAM.L and CAM.baseY keep the old orientation. drawTitleScene(), however, re-lays out the build for the new size. Test (scratchpad/ver3/rot.cjs): title at 844x390, tap, rotate to 390x844 after 100 ms. The game pauses correctly, but the paused frame shows the title build re-laid out on the rug while the cube and striped arm float mid-screen at about y=290–350 (screenshot scratchpad/ver3/rot-start-paused.png). On resume, the burst debris and camera jump when startGame('intro') resets CAM.baseY. No errors, and play then proceeds normally.

**Suggested fix:** In layout(), when the phase is 'start' or paused from 'start', recompute the shove frame from the new layout: T = titleScene(); CAM.L = T.L; CAM.camY = 0; CAM.baseY = CAM.groundY; recompute ST.dx and the cube x/y as beginStart() does (before the hit), or shift existing debris by the new offset (after the hit). The simplest alternative is to finish the shove instantly on rotation: call startGame('intro') if ST.hit is true, otherwise return to the title.

### core-m47-4: Input: an invisible pause button is live during the start sequence
**Evidence:** onPointerDown (index.html line 2958): if (S.phase === 'start' && hit(UI.pause, x, y)) pauseGame(). drawHUD() is never called in the title/start render branch, so no pause button is drawn. Probe H (scratchpad/ver3/edge.cjs): clicking the empty top-left corner 60 ms after the title tap gives phase 'paused'.

**Suggested fix:** Either draw the pause button (hudBox plus the two bars) during 'start', or remove that branch and let P or Esc pause the shove.

### core-m47-5: HUD legibility: level number and box labels at 9 px
**Evidence:** drawHUD() draws 'LEVEL N' (plus '· BIG') with font(9, 600) at 70% alpha. drawPieceBox() draws 'NEXT' and 'HOLD' at 9 px; the results stat labels are 10 px. During play the current level appears only in that 9 px label. Seen in screens at 390x844, 320x568 and 1366x1024: readable when zoomed in, but tiny on a phone and lost on a tablet.

**Suggested fix:** Use about 11–12 px for 'LEVEL N' (the 46 px clock box has room if the digits move down 2 px) and 10–11 px for NEXT/HOLD and the card's stat labels. Consider scaling the corner HUD by about 1.25 when min(W, H) is at least 700 (1024x768, 1366x1024).


**Verifier notes (non-failures, consider):**
 no page or console errors:
- **selftest:** PASS.
- **feel:** all pass, including 500 ghost-honesty releases with 0 mismatches.
- **bots:** all pass. PerfectBot reached 10 L in 10/10 seeds; EdgeBot, SaveBot, TIPPY, the debris cap and calibration also pass.
- **shots, crashframes:** clean.
- **flow:**
  - Title tap reaches play in 0.48 s game time; tile in hand by 0.92 s.
  - RandomTapper clears L1 in 10/10 normal seeds (7.3–17.6 s) and 10/10 with big=1 (5.1–9.6 s).
  - 24 levels logged goal, crown, smash, level in order. The clock never ticked down in 20 SMASHes.
  - setClock(0.5) reaches TIME! in 0.51 s. The lockout tap does nothing; AGAIN gives play in 0.02 s with score 0.
  - Best and bestBig are kept separately. P, Esc, a hidden tab and rotation all pause with the clock frozen. Mute persists.
- **hazards:** honk exactly 1.2 s before each bump; bumps 12.000 s apart; L8 alternates bump, foot, bump, foot; 0 hazard events with big=1.

My own edge probes (scripts in scratchpad/ver3) also pass:
- TIME! during a crash's freeze or slow motion.
- TIME! with two tiles in the air.
- Pause during a PERFECT hit-stop.
- Esc in a SMASH, then MENU, then a clean new run.
- A crash with the crown in HOLD loses it.
- Rotation during a SMASH.
- Safe-area insets simulated at 47/34 px and 47/21 px.
- 320x568 and 667x375.
- Rotation on the title and results card.

No soft-locks found. Performance with the real Art is 2–3 ms JS per frame.

Screens at 390x844, 844x390, 1024x768 and 1366x1024: nothing scrolls and every HUD box is inside the viewport. With the real art and audio inlined (integration copy at scratchpad/v/integ.html), the loop reads clear and fast:
- The title shove bursts the build, the letters fly off, and the cars couple at about 0.9 s.
- Each SMASH has its tally, the "+10" flying into the clock, and the level banner, all within about 1.4 s.
- The results card counts up, then NEW BEST with confetti.

So the game is well on its way to "super fun and fast paced".

Defects found:
1. In portrait, the "TALLER THAN …" goal label sits right on the crown's target slot for 1.4 s, just as the crown drops into the hand.
2. With the real dev/art.js inlined, the M7 night check fails (worst 26 portrait, 39 landscape, against 40). The builder's "at least 57" holds only for the stub.
3. Rotating the device during the 0.45 s title shove leaves the cube and arm floating mid-screen.
4. An invisible pause hit area is live during the shove.
5. The LEVEL and NEXT/HOLD labels are drawn at 9 px.

Nits, not counted as failures:
- After the post-SMASH roll-in, an old debris car can come to rest upright on its tow-hook end (cosmetic, from the M3 debris rest model).
- After a crown miss, the fresh crown arrives in 0.18 s, not DESIGN's 0.4 s. The builder documented this; it keeps M2's 0.2 s hand-ready check passing.
- In landscape phones from L5, and portrait from about L13, the ribbon and its label show only in the gauge until the top nears G. This follows §9's own zoom formula.

## art (final verifier, unfixed)

### art-1: No exceptions or lasting damage from odd arguments (resize/drawRoom/drawRug groundY slot)
**Evidence:** In `dev/art-verify.cjs` (section 3), on both viewports:
- `Art.resize(W,H,dpr)` with `groundY` undefined throws "createLinearGradient: The provided double value is non-finite". So does a `groundY` of 'abc', {}, Infinity or -Infinity.
- After undefined, 'abc' or {}, a correct `Art.resize(W,H,dpr,764)` followed by `drawRoom` still throws "drawImage: The provided value is not of type ..." on every call. The rug pixel stays 0,0,0,0, so nothing is painted.
- Cause, in `ensureLayout` (`art.js` ~1780-1796):
  - `if (!(G === G))` only catches NaN, so undefined, strings and objects reach `computeLayout` and every layout field becomes NaN.
  - `LAY.W`, `LAY.H` and `LAY.dpr` are written before the builds that throw.
  - The early return then trusts the half-built state: `floorC` is set, and `Math.abs(764 - undefined) >= 0.5` is false, so it never rebuilds.
- `art-contract.cjs` claims every slot is safe with odd types, but it only puts NaN in `resize`'s `groundY` slot.

**Suggested fix:** In `ensureLayout`:
- Coerce first with `G = +G`, and replace the NaN check with `if (!Number.isFinite(G)) G = (LAY.G > 0 && LAY.H === H) ? LAY.G : H * 0.86;`.
- Treat a non-finite `LAY.G` as needing a rebuild.
- Commit `LAY.W`, `LAY.H` and `LAY.dpr` only after `buildFloor`, `buildRoom` and `buildStars` succeed. Alternatively, wrap them in try/catch that resets `LAY.W = 0` and nulls `floorC` and `roomC`.
- Make `gOff` use `fin(G)`.
- Add undefined, 'abc', {} and ±Infinity to the contract's `resize`, `drawRoom` and `drawRug` `groundY` cases, and assert that a correct call afterwards recovers.

### art-2: Frame budget: no per-frame hitches on documented API paths (drawRoom skyT 0..1)
**Evidence:** `skyT` is a continuous 0..1 input; DESIGN says the sky goes to dusk and then night from L15.
- `curDim` is quantised to steps of 0.04 (`art.js` 2322). Each step rebuilds `roomAt(dim)` (2228-2272) at device resolution with a 'high'-quality upscale, plus `floorAt(dim)` (2374-2395).
- Measured (probe5): ramping `skyT` from 0 to 1 over 180 frames while the camera scrolls gives 17 frames over 16 ms, with the worst frame at 64 to 66 ms and about 0.8 s of JS spent in spikes. Same at 390x844@2, 390x844@3 and 1366x1024@1.
- A single step costs 48 to 52 ms at 390x844@3 and 113 to 123 ms at 1024x768@2; the median frame is 0.1 ms.
- The contract only times a constant `skyT = 1`, so it never sees this.

**Suggested fix:** Make changing `skyT` cheap:
- Bake 2 to 3 full-resolution room layers (day, dusk, night, with the lamp and window light) and the matching floor layers once, lazily or spread over idle frames.
- Each frame, crossfade the two neighbouring layers with `globalAlpha`: one extra blit and no rebuilds.
- Or apply the evening tint at draw time with a single multiply `fillRect` and a cached light overlay.
- If you keep the quantised rebuilds, spread each step over several frames (quarter-resolution pass, then the upscale) and keep drawing the previous step until the new one is ready.
- Add a contract check that times a `skyT` ramp and fails if any frame exceeds 16 ms.

### art-3: The room as the goals: the L2 goal object (the tile box) is visible during play
**Evidence:** In `paintRoom`, `at(0.2, 2.9); boxShape(g, X(0.2), ...)` (`art.js` ~2072) puts the box dead centre on the floor in every wide layout. It spans about cx-1.15U to cx+1.55U: 586 to 813 px at 1366x1024 and centred at 1024x768 (`room-1366.png`, `room-1024x768@2.png`).

Level 2 is "TALLER THAN THE TILE BOX" on a 2-car (4 L) base centred at W/2. In the 1366x1024, 844x390 and 1024x768 scene shots the box is completely hidden behind the base and tower. Only the portrait layout shifts it to the right, where it shows.

**Suggested fix:** In the wide branch, place the box at least 3 U off-centre. For example, `at(2.4..3.0)` between the side table and the armchair, or left of centre in front of the egg chair's pedestal, so it clears the 4 L base (and the 2 L one) at every zoom. Assert it in the room shots.

### art-4: Visual: stained-glass light pass on the rug is visible
**Evidence:** `drawLight` projects tiles back and right: y squashed by 0.22 about the ground line, skew `LIGHT_SK` = 0.42. The rug band behind the base is only about 57 px at 390x844, so the projection lands right behind the cars and the bottom row of tiles, which hide it.

What shows (`v_tower390.png`, `v_tower1366.png`, `c_rug.png`) is a red smear under the car between the wheels and a thin green and orange sliver right of the right wheel. The signature effect is close to invisible at phone size.

**Suggested fix:** Push the coloured shapes clear of the base:
- Raise `LIGHT_SK` to about 0.9 to 1.2, or add a constant rightward offset of about 1 to 1.5 L.
- Or, as a spec change for the lead, cast forward onto the larger front band below `groundY`, as light from the window behind would.
- Keep the multiply plus 'lighter' passes, and consider a slightly stronger multiply where it lands in the open.

### art-5: Visual: consistent lighting across a Δ∇Δ band
**Evidence:** A down triangle is the up sprite turned 180°: `quarter()` applies `scale(-1,-1)` and the same `K_BODY` and `K_DETAIL` sprites are blitted.

So its bright bevel lip, gloss streak and lighter body gradient sit bottom-right, while every other tile is lit from the top-left. In the gallery 'tri down' row (`v_tris.png`) the highlight runs along the lower-right edges; in the tower's Δ∇Δ bands the light direction alternates tile to tile.

**Suggested fix:** Build a separate down-triangle sprite variant, keyed by the rotation being near π: draw the flipped geometry but put the gloss streak, bevel highlight and body gradient in unrotated sprite space. Or draw the gloss and lip as a screen-aligned overlay after the rotated blit.

### art-6: Visual: the cube reads as the photo-3 cube (red top, yellow left, orange front)
**Evidence:** At phone size the oblique top and left faces are 0.14 to 0.16 L strips (`CUBE_KX` 0.07, `CUBE_KY` 0.08) at body alpha 0.7 (`CUBE_SIDE_A`). In the 390x844 scene and the zoomed `v_cube.png` the red top is a thin maroon line and the yellow side a hairline, so the cube reads as a plain orange 2x2 block. This complies with the contract's "thin" faces, but the photo's signature red top is lost.

**Suggested fix:** Keep the depth limit of 0.2 L or less, but:
- make the oblique strips full-saturation red and yellow (`CUBE_SIDE_A` 1 on the strip, brighter frame lines);
- add a bright red edge highlight along the top lip;
- or push `CUBE_KY` to about 0.09 so the top reads as a red lid.

### art-7: Juice: car wheels animate when cars roll in or the bump car zooms
**Evidence:** `drawCar(ctx, x, y, rot, L, color, o)` accepts `o.t` but never uses it (`art.js` 1066-1086). The hubs are static circles with a fixed highlight dot, so the cars rolling in after a crash or SMASH, and the green bump car zooming along the rug, slide with frozen wheels.

**Suggested fix:** Use `o.t` (or a distance passed by the game) to rotate a hub mark, for example 3 spokes or an offset highlight, by angle = distance / (0.2 L).


**Verifier notes (non-failures, consider):**
green); night contrast is 78 to 79.
- **Screenshots:** `dev/art-shots.cjs` passes with no console errors; I looked at all 12 PNGs.
- **My checks:** I wrote `/home/user/various/clack-stack/dev/art-verify.cjs`. Results on 390x844@2 and 844x390@2:
  - All 18 functions have exactly the parameter counts in BUILD.md.
  - About 250 calls at L = 1, 2, 6, 200 and 500 throw nothing and leave the canvas state unchanged, including miterLimit, imageSmoothingQuality, direction, letterSpacing and fontKerning.
  - Up and down triangles sit exactly on their centroids (0.07 px off). In a Δ∇Δ band the shared slanted edges have no gaps and no overlaps at 70 probes on each edge.
  - Car wheels touch exactly 0.5 L below the plate top, and the car rotates about (x,y).
  - When gripping, the fingertips reach 0.3 L below the tile's top edge, centred on x.
  - `drawCubeNet` at fold 1 is pixel-identical to `drawTile('cube')` under rotation and the caller's alpha. A still, rotated tile switches to a pre-rotated sprite after 4 frames (mean change 0.03 to 0.13 per channel, a one-off at the edges); that is not a defect.
  - The cube's front face is exactly 2L x 2L around its centre.
  - `titleBuild`: 31 tiles in L units with y up, lowest point at y = 0, the crown is the highest point, both rings sit on wall tiles, the cube stands on the rug, origin is roughly the base centre.
  - A crash frame with 60 spinning debris costs 1.3 to 1.45 ms of Art JS time.
- **Art judgement:** it's charming and legible at phone size. The boy would recognise his tiles: candy plastic with darker frames, rivets, X-and-diamond on the orange square, inner triangle with dot, porthole with screw dots, magenta rings. He'd also recognise his room: white egg pod with canopy, raspberry armchair on wooden legs, window and AC, side table, watermelon bag. The rug is right in kind but paler than the photo. The hand with its striped cuff and red scribbles is cute; ghosts read on the wall, rug, armchair and night sky; the title and tile box look good; dusk and night are lovely. It's on its way to "super fun and fast paced".

**Real defects**
1. **Crash on a bad `groundY` (robustness):** `resize` throws when `groundY` is missing, non-numeric or infinite. For missing or non-numeric values Art then stays broken: `drawRoom` throws on every later call, even after a correct `resize`.
2. **Stutter when `skyT` changes (performance):** each 0.04 step rebuilds the night room and floor, costing 48 to 123 ms in one call.

**Weaker issues**
- The tile box (the L2 goal object) is hidden behind the base on every landscape and desktop layout.
- The stained-glass light mostly lands behind the base, where the tower and car hide it.
- Down triangles are lit from the opposite direction to up triangles.
- The cube's red top and yellow side are barely visible.
- Car wheels never spin, because `drawCar` ignores `o.t`.

The builder's "known gaps" are partly out of date: the light no longer reaches past the rug, and it does dim at night.

## audio (final verifier, unfixed)

### audio-1: Clack (and every panned sound) has a consistent level whatever the pan
**Evidence:** Offline render of a GREAT clack (combo 2):
- pan 0 or 0.005: total power −18.29 dB, both channels peak −5.66 dBFS.
- pan 0.011: −19.92 dB (peaks −7.33 / −7.18).
- pan 0.1: −20.12 dB.
zzip, miss and poke at pan 0 vs 0.02 lose exactly 3.01 dB (they sit below the compressor, so nothing softens the step).
Cause: `voice()` (audio.js line 205) adds a StereoPannerNode only when |pan| > 0.01. An unpanned mono voice is up-mixed to 1.0 in each channel, but an equal-power panner at centre gives 0.707 per channel.
Effect: the game sets pan = (sx − W/2)/(W/2), which is almost never exactly 0. So in-game clacks play 1.7–3 dB below the levels audio-test.cjs tuned (it renders the clack at pan 0). They also jump in level whenever a tile lands within about 2 px of screen centre.

**Suggested fix:** Send every mono voice through the same law: always create the panner when it exists, or insert a 0.7071 gain when |pan| ≤ 0.01. Then retrim (about +3 dB on sfxBus, −3 dB inside crash/smash, which already pan every part). Add a test that the clack's total power at pan 0, 0.02 and 0.5 agrees within 0.5 dB.

### audio-2: Music sits UNDER the sfx (at the ×4/×5 layers)
**Evidence:** A-weighted 50 ms windows, power summed over both channels:
- GREAT clack, combo 0, pan 0.15: −23.2 dB.
- ×5 groove: max −23.8 dB, 90th percentile −26.9 dB.
- ×4: −24.2; ×3: −27.0; ×1: −29.8.
So a typical in-game clack is only +0.6 dB over the ×5 groove's loud moments and +3.7 dB over its 90th percentile. A pan-0.5 clack (−24.1) is quieter than the groove's peaks. With phone-speaker weighting, a combo-9 clack is only +0.1 dB over ×5. In the rendered waveform the clacks barely stand out at ×5.
The ×4 claps (pk 2.2) add 2.8 dB to the groove's peaks.
The builder's claim that ×5 sits 7.8–8.2 dB under a clack compares the clack's 50 ms window with the music's 400 ms window (which averages in the gaps between hits), and uses the centred, unpanned clack.

**Suggested fix:** Bring the ×4/×5 peaks down about 4–6 dB: clap peak 2.2 → about 1.0, sparkle 0.3 → about 0.18, and/or MUSIC_VOL 0.14 → about 0.10. Also fix the pan law above. Change the audio-test.cjs balance check to compare like with like: a pan-0.15 clack's 50 ms window must be at least 6 dB over the ×5 groove's maximum 50 ms window, A-weighted and phone-weighted.

### audio-3: Every envelope ramps, with no clicks, in browsers without AudioParam.cancelAndHoldAtTime (Firefox, as far as I know)
**Evidence:** The `hold()` fallback (audio.js lines 78–81) reads `p.value` now, then calls `cancelScheduledValues(T)` with T = now + LAT. That also deletes the end event of a ramp already in progress, so the param snaps back to the previous event's value until T.
I emulated this by deleting `AudioParam.prototype.cancelAndHoldAtTime` in Chromium. A `duck(1)` landing 1.2 s after another (during its recovery ramp) steps the music gain from 0.638 to 0.356 within 1 ms, back up at T, then ramps down: an audible two-step glitch. With `cancelAndHoldAtTime` (Chromium) the largest 1 ms step is 0.017.
`setMuted()` (rapid toggles) and `creakOff()` use the same fallback.

**Suggested fix:** In the fallback, anchor at the current time rather than T: `const v = p.value; p.cancelScheduledValues(now); p.setValueAtTime(v, now);`. Better still, for duckG and master the module knows its own ramps, so compute their value at T in JS and `setValueAtTime(thatValue, T)` after `cancelScheduledValues(T)`. Test it by deleting `cancelAndHoldAtTime` in the offline harness and checking that the duck curve has no jump larger than 0.03 per ms.

### audio-4: MISS: a dull tok plus a SOFT two-note aww (DESIGN §8/§10); misses are frequent for kids
**Evidence:** A-weighted, compared with a typical clack (pan 0.15):
- `aww()` total energy: −25.5 vs −36.2 dB (+10.7 dB).
- 400 ms max: −22.5 vs −32.2 dB.
- 50 ms max: −21.1 vs −23.2 dB.
So the 0.57 s sawtooth "aww" is the loudest event in ordinary play, louder than the clack. Kids miss often (the RandomTapper target), so this will dominate and can feel punishing.

**Suggested fix:** Lower the aww by about 8 dB (`envH` peak 0.24 → about 0.1, or g2 0.6 → 0.4 with peak 0.12) so its A-weighted 400 ms level stays under a clack's. Keep the miss tok as it is.


**Verifier notes (non-failures, consider):**
alance problems and one browser-specific click. No repo files were edited; all my probes are in /tmp/claude-0/-home-user-various/eea7fc80-8598-5a7a-a3e6-cdbd34e6e76d/scratchpad/av/.

What passed:
- **Existing suites:** `dev/audio-test.cjs --report` passes (62 s), and so does the earlier `dev/audio-verify.cjs`.
- **API:** all keys exactly match BUILD.md, `muted` is a read-only getter, and no other globals leak.
- **Before unlock:** no AudioContext and no nodes are created. A `music.start()` + `setMult(3)` made before unlock is remembered and plays once unlocked.
- **Parameter sweep:** clack (combo 0..200, mass 0.45..3, pan −1..1, edges 1..3, every grade), tally, cubeFold, clockTick, crash (n 0..200, x −1..1), whooo and setLevel 1..40. Zero NaN/Infinity, zero negative times, zero exponential ramps to 0, and zero out-of-order automation events.
- **Voice cap:** 100 triple-PERFECT clacks + crash + smash + 30 tallies, polled every 5 ms: max 24, peakVoices 24.
- **Mute:** 0 nodes created, 0 output, and the music stays on the 16th-note grid.
- **Hide/show:** the context suspends, 0 notes play while hidden, and it resumes exactly on the grid with no catch-up burst. Hide and show in the same task is also fine.
- **Music scheduling:** only the 25 ms timer drives it; notes are scheduled on the audio clock. Rapid start/stop leaves no timers behind.
- **Creak every frame for 60 s** (3603 frames, including a worst case toggling 0 ↔ 0.95 every 0.4 s): 516 nodes made in total, 0 alive after GC, no timers left.
- **150 s realistic real-time session:** live nodes plateau at 58–116 and end at 8, the heap levels off around 1.9 MB, timers return to 0, and there are no errors.
- **Integrated into a scratch copy of index.html:**
  - `tools/feel.cjs --only=audio,keys` passes; audio runs after the first touch, mouse or key under Chromium's default autoplay policy.
  - 60 s of real-mouse play with the music on: 0 errors, at most 4 voices, output peak −4 dBFS, 2.1 ms JS per frame.
- **Load:** the densest case (crash + smash + tally + 40 clacks/s + ×5 groove) renders at about 12× real time. A crash builds 206 nodes in 2.5 ms on the main thread.
- **Spectrograms:**
  - The clack has a bright snap (3–9 kHz click plus 2.4–6.3 kHz modes), a 0.25 ms attack and a pitched tock that climbs the pentatonic.
  - A DOUBLE/TRIPLE is a clear 28 ms marimba run, and PERFECT adds the ting.
  - The crash is a dense clatter with the whistle sliding down.
  - The groove (C | Am | Dsus | G, an 8-bar cycle) is in key.
- **Preview page:** works at 390 px and 1280 px, 48 controls, no errors.

Not audio-module defects (for the core builder): index.html never calls `music.start()`, `music.setLevel()` or `creak()`, and does not reset `setMult(1)` after a miss. So the shipped game currently has no music and no creak.

Suggestion, not counted as a defect: the ×5 sparkle is a non-stop 16th-note sine run at 1.3–3.1 kHz. It may tire experts who hold ×5 for minutes; consider sparser notes or a lower level.
