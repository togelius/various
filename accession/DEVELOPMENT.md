# ACCESSION: development status and validation log

The build contract is [`BUILD.md`](BUILD.md); this file records what has been built and how it was checked. Every entry gives the commands that were run and their results, so anyone can rerun them.

## How to run things

| What | Command |
|---|---|
| Play (development) | open `index.html` in a browser |
| Play (single file) | `python3 tools/build-single.py`, then open `dist/accession.html` |
| Everything | `./check-all.sh` (`--no-browser --allow-skip` leaves out the Playwright checks; never for acceptance) |
| Tests only | `node test/run.js [filter]` |
| Cross-browser hash | open `dist/accession-hash.html` in Safari, Firefox or Chrome: every line should say PASS |
| Regenerate golden hashes | `node tools/golden.js` (only when a rule changed on purpose; log why below) |
| Layout sweep | `node tools/layout-sweep.js 1000 --locality [--maps]` |
| Screenshots | `node tools/browser/shoot.mjs "dept=M11&board=board3d" name` → `test/shots/name.png` |
| Pick a department in a link | add `?dept=A4&seed=7`, or `#A4.7` where only an anchor passes (an Artifact page) |
| Art contact sheet | `python3 tools/art-sheet.py` → `test/shots/art-sheet.png` |

## Milestones

| | Status |
|---|---|
| M0 Core skeleton | accepted, 23 October 2026 (Chromium; Safari and Firefox hash checks pending) |
| M1 Layout | accepted, 23 October 2026 |
| M2 Look and read | accepted, 23 October 2026 |
| M2b The 3D board | the 3D checks and every M2 screen check pass in both views; waiting on Julian's side-by-side look and device numbers |
| M3 Exhibits wake | not started |
| M4 Three departments | not started |
| M5 A run | not started |
| M6 Sound | not started |
| M7 The slice gate | not started |

## Checks Julian runs (this environment has only Chromium)

| Check | How | Last result |
|---|---|---|
| Hash page in Safari (Mac) | open `dist/accession-hash.html` | pending |
| Hash page in Safari (iPhone) | open the hosted hash page | pending |
| Hash page in Firefox | open `dist/accession-hash.html` | pending |
| The game on the iPhone, both board views | open the hosted or Artifact build; walk, read a label, switch Board in Settings | pending |
| 3D cost on the iPhone and the Mac | Settings → Board: 3D; note how smooth walking feels; leave the page in the background for a minute mid-department and come back | pending |

## Validation log

### 23 October 2026: BUILD.md reviewed

- **What:** five adversarial reviews of BUILD.md (consistency, engineering, rules, testability, the 3D view's revertibility), each finding then checked by a separate verifier.
- **Found:** 79 findings, all of which changed the text. Among them:
  - the treasure route conflicted with hall sealing;
  - viewing could never succeed as written;
  - a shaken-off hunter could be surprise-hit forever, and closing a door was a total escape;
  - the odds readout could divide by zero;
  - a dead run could come back from a stale localStorage copy;
  - viewing a replay would have overwritten the live save;
  - several acceptance tests could pass without testing anything.
- **Also caught:** BUILD.md referred to Julian as "he/his" in two places; fixed to they/them.
- **The 3D view** moved to its own milestone, M2b, alongside M3, so it cannot hold up the core.

### 23 October 2026: M0 accepted

- **Commands:** `./check-all.sh` (7 steps passed, 0 skipped); `node test/run.js` 35/35.
- **Golden run.** The monkey golden run, 10,000 actions on seed 20261023, gives hash 1695131025:
  - twice in Node;
  - again with the state cloned after every step;
  - and in Chromium on `dist/accession-hash.html` (235 ms).
- **Golden hash changes, all deliberate:**
  - 1225500262 (first version);
  - 1430715792, after the code review (sleeping exhibits are no longer scheduled; the monkey draws from `Step.legal`; kit numbers come from the table);
  - 1695131025, when remembered tiles entered the state.
- **Lints.**
  - The determinism lint now parses with acorn (vendored, MIT). It catches 22 planted forms, including `Math['random']`, aliasing, regex literals and `${}` expressions, and passes 6 legal ones.
  - The core runs under a hardened context where `Date`, `Intl`, `eval` and `Math.random` throw.
  - The numbers lint catches a planted mismatch, and the plain-data check rejects floats, NaN, undefined, holes, Maps and typed arrays.
- **Scenario tests:** ties go to you then spawn order; turn boundaries resolve before actors; the waking beat; the damage floor; the hit boundary; action costs; refusals change nothing; `Step.legal` matches `step()` exactly.
- **Code review:** 3 reviewers and 3 verifiers. 21 findings, all confirmed and fixed. Chief among them: tests whose names promised checks they did not make, a lint that regex literals could blind, and a plan fallback that was never actually tested.
- **Pending:** Julian's hash checks in Safari (Mac, iPhone) and Firefox. They need the hosted page (GitHub Pages) or an Artifact copy.

### 23 October 2026: M1 accepted

- **Command:** `node tools/layout-sweep.js 1000 --locality`, Cabinet size, seeds 1–1,000 per programme.

| Programme | Fallback | Reseeded | L_tour p5/p50/p95 | ms p50/p95/max |
|---|---|---|---|---|
| Enfilade | 0.0% | 0 | 49/59/75 | 6.5/12.4/62.1 |
| Case labyrinth | 0.0% | 49 | 55/66/81 | 7.2/13.3/33.4 |
| Sculpture court | 0.0% | 59 | 59/70/79 | 8.7/17.0/31.2 |

- **Locality.** 600 + 399 + 399 rooms were re-curated over 100 seeds; the perturbed room changed in 375, 365 and 371 of them; 0 tiles changed in any other room.
- **Why plans were reseeded:**
  - labyrinth: 35 × maze crossed too directly, 9 × too few narrow tiles, 8 × no lectern at the viewing distance, 1 × glass;
  - court: 45 × fewer than 8 pillar loops, 23 × no lectern.
- **Finding:** the court's pillar-loop identity check rejects 4.5% of first attempts, above `design/layout.md` §13.2's guide of 1%. Reseeds absorb it (fallback 0%); revisit the court's knobs before v1.
- **Tests:** the real fallback path passes and is used when every attempt is forced to fail; planted faults (blocked exits, a short arena loop, a fixture on a gate) are caught with their tiles marked; both Intro repairs run and are logged; every viewing tile is exactly 3 walking tiles from the Centrepiece.
- **Change from the prototype:** the Centrepiece footprint is 2×2, and the lectern is placed by walking distance.

### 23 October 2026: M2 accepted; M2b's checks pass

- **Command:** `./check-all.sh`: 12 steps passed, none skipped. `node test/run.js` gives 64/64. The golden hash is unchanged at 1695131025.
- **The M2 acceptance criteria (BUILD.md §11), each a check in `check-all.sh`:**
  - **No horizontal scroll** at 390×844 or 1280×800, with the board, Settings, "How the museum works" and a label each open (`check-screens`). The check also fails any box whose content is wider than the box itself; that is how it caught the label sheet scrolling sideways unseen.
  - **No UI target under 44 px,** including a label's action button beside an exhibit. The 44-px zoom step exists: top-down 48 px, and 3D s = 52 with a 45-px disc.
  - **Tap tolerance:** the 10th-percentile tap radius is 15 px at 32 px (12 needed) and 23 px at 48 px (22 needed). In 3D it is 17 px at s = 40 and 22 px at s = 52.
  - **A left-click-only script** (`check-play`), at both sizes and in both views, does all of the following with only left clicks on what is on screen, and fails if it ever has to click off-screen:
    - walks to the tile it clicked;
    - approaches an exhibit and examines it;
    - reads its paragraph from 2 tiles;
    - closes the label;
    - opens "How the museum works" from the top bar and from Settings;
    - zooms;
    - walks with "tap twice".
  - **The hostile mark:** every hostile on the clear part of the board carries the hostile mark by `renderer.inspect()`, and every actor in the view model is on the board or marked by an edge arrow.
  - **The colour check:** under normal vision and the Machado protanopia, deuteranopia and tritanopia simulations, the reserved colours differ pairwise by CIEDE2000 ΔE ≥ 15.5 (needed 15) and stand ≥ 10.2 from every floor and wall (needed 10). Every other department colour is ≥ 10 from them in normal vision and ≥ 5 in each simulation. The reserved palette was re-chosen by search to pass: the old one had hazard against item at ΔE 7.5 under deuteranopia.
  - **The revert test:** `tools/remove-3d.sh` runs in a temporary copy, then the build, the Node tests and the smoke and screen checks run there. The build without 3D is 278,218 bytes.
- **M2b, the 3D checks (`check-3d`)** run in the enfilade (M.11), the case labyrinth (A.4) and the sculpture court (S.9), at both zooms and at the entrance:
  - **Occlusion:** 0% of unmarked visible tiles under 25% visible. The least visible tile shows 29–31% of its floor, as predicted for 1.2-high walls (31%).
  - **Wall height:** with 1.5-high walls, as BUILD.md first had them, 3–15% of tiles fall under 25%, so the walls are 1.2.
  - **Actors and marks on top**, checked from the id buffer and on the page as composited.
  - **Entrance and exit mats** show.
  - **Consistency, and context loss and restore,** pass.
  - **Frame time** is 2–5 ms in SwiftShader (recorded, not gated).
  - **The overlay canvas** matches a reference repaint of the display list at device pixel ratios 1 and 2.
  - **A melee frame** (you directly north of an exhibit you have just struck, a 2×2 Centrepiece where one can be reached) passes in all three programmes.
  - **Still to come:** Julian's look and device numbers.
- **Sizes:**
  - `dist/accession.html` is 783,221 bytes (205,710 gzipped).
  - three.js r180, tree-shaken to the 11 names `board3d.js` uses, is 482,356 bytes (701,495 untrimmed).
- **Reviews.** Three adversarial rounds; each finder's findings were checked by a separate verifier.
  - **Round 1:** 46 confirmed findings, all fixed. Among them:
    - taps landed on stale tiles after the strip grew;
    - the laptop layout hid the log;
    - walks could turn into attacks;
    - 2×2 Centrepieces were their anchor tile only;
    - the surprise rule did not match §8.1;
    - two archetypes had different silhouettes in different departments;
    - several checks could pass while broken.
  - **Round 2:** 41 of the 46 were confirmed fixed at HEAD; 18 new findings, all fixed. Most were checks that could not fail, now shown failing on planted faults:
    - a stacking bug;
    - an oversized mark;
    - a one-line log;
    - a transparent label;
    - missing path and selection marks.
  - **Round 3:** 16 findings, all fixed. Among them:
    - hostiles cut by an edge showed neither bar nor arrow;
    - the on-top rule failed ordinary melee frames;
    - the camera's fit test was off by one;
    - checks did not look at where marks were drawn.
  - **Round 4:** 7 findings, all fixed. Among them:
    - arrows stacked at corners;
    - the paint check could not see order or state bugs, so it now compares the overlay with a reference repaint;
    - the health number on 360-px phones.
  - **Every strengthened check** was shown failing on a planted fault before it was committed.
  - **Round 5:** 7 findings, all fixed. Among them:
    - a 2×2 Centrepiece's 3D sprite buried you when you stood north of it;
    - opening an adjacent exhibit's label could move the board, so a second tap missed.
  - **Round 6:** 7 findings, all fixed. Among them:
    - the same for a 2×2 Centrepiece's far row;
    - an on-top rule that had become a tautology;
    - arrows over sleep glyphs;
    - a band of phone widths where the health number overflowed.
  - **Round 7:** running when this was written; its outcome will be logged with M2b.
  - **The trend:** 46, 18, 16, 7, 7 and 7 findings. From round 4 on, they were mostly about how strict the checks were, plus edge cases on the board.
- **Findings worth remembering:**
  - **Walls.** From due south at 60°, a wall of height h hides h ÷ tan 60° of the tile behind it. The probe's 1–2% figure came from the south-east.
  - **Colour.** Five reserved colours that stay apart under all three simulations leave little room. The best found clears 15 by 0.5; a sixth reserved colour would not fit.
  - **Close-ups** are generated placeholders (Scale2x, lit, with a cast shadow) until redrawn by hand. The redrawn plodder and herald sprites share one outline each and are placeholders too.
- **Known and left for later milestones:**
  - Every exhibit starts asleep. M2's placement is a stand-in; population and modes are M3 and M4. So the Wader's label says "It never sleeps" beside a sleeping icon.
  - The odds readout is tested over varied states now, but M3 owns it.
- **Pending for Julian:** see "Checks Julian runs" above.
