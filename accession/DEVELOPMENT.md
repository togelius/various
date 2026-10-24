# ACCESSION: development status and validation log

The build contract is [`BUILD.md`](BUILD.md); this file records what has been built and how it was checked. Every entry gives the commands that were run and their results, so anyone can rerun them.

## How to run things

| What | Command |
|---|---|
| Play (development) | open `index.html` in a browser |
| Play (single file) | `python3 tools/build-single.py`, then open `dist/accession.html` |
| Everything | `./check-all.sh` (`--no-browser --allow-skip` leaves out the Playwright checks; never for acceptance) |
| Tests only | `node test/run.js [filter]` (the filter matches the path from `test/`: `behaviour` runs the Behaviour-line scenarios) |
| Cross-browser hash | open `dist/accession-hash.html` in Safari, Firefox or Chrome: every line should say PASS (PENDING, with its hash, while a wave changes the state; `check-hash` compares that with Node) |
| Regenerate golden hashes | `node tools/golden.js` (only when a rule changed on purpose; log why below); `--pending "reason"` marks the runs pending and keeps the pins; `--check` compares without writing |
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
| M3 Exhibits wake | underway: Wave 0 (the backbone), parts W0a, W0b, W0c and W0d landed |
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
  - **Round 7:** 7 findings, all fixed. Among them:
    - with another exhibit's label open, opening an adjacent exhibit's label re-centred the board, so a second click missed; the camera now stays where the last frame had it while you and the exhibit fit there;
    - the second-click check began with the exhibit already selected, so its first click struck and it tested nothing;
    - the on-top check hit-tested the 2D layer instead of looking at the page; it now compares a screenshot with what was painted, which also found a real fault: at a fractional board height both views' canvases were resampled by the page, blurring the sprites by a device pixel;
    - the on-top rule would have failed a telegraph's fill under you, which §6.2 draws beneath the actors on purpose; a telegraphed melee frame now tests it;
    - a door cut by the board's edge failed the mat check; check-3d now runs at laptop size too.
  - **The trend:** 46, 18, 16, 7, 7, 7 and 7 findings. From round 4 on, they were mostly about how strict the checks were, plus edge cases on the board.
- **Findings worth remembering:**
  - **Walls.** From due south at 60°, a wall of height h hides h ÷ tan 60° of the tile behind it. The probe's 1–2% figure came from the south-east.
  - **Colour.** Five reserved colours that stay apart under all three simulations leave little room. The best found clears 15 by 0.5; a sixth reserved colour would not fit.
  - **Close-ups** are generated placeholders (Scale2x, lit, with a cast shadow) until redrawn by hand. The redrawn plodder and herald sprites share one outline each and are placeholders too.
- **Known and left for later milestones:**
  - Every exhibit starts asleep. M2's placement is a stand-in; population and modes are M3 and M4. So the Wader's label says "It never sleeps" beside a sleeping icon.
  - The odds readout is tested over varied states now, but M3 owns it.
- **Pending for Julian:** see "Checks Julian runs" above.

### 24 October 2026: M3 underway; Wave 0, part W0a (grammar and words)

- **How M3 is built.** In four waves, each landing on `main`:
  - **Wave 0, the backbone,** in five serial parts: W0a (the grammar and its words), W0b (test and determinism infrastructure), W0c (the action core), W0d (the exhibit core), W0e (the department core). Each part writes its own BUILD.md sections, `index.html` entries and legacy-test rewrites in its own commit.
  - **Wave 1:** fourteen packages in parallel (waking, modes, combat, cases, clock, kit, statuses, consumables, content, three archetype groups, sims, golden runs), each calling only Wave 0's interfaces.
  - **Wave 2a and 2b:** the view model, labels and joined-up behaviour scenarios; then the arenas, the sim battery and the play and Bag screens.
  - **Wave 3:** the M3 acceptance run (BUILD.md §11).
- **The landing rule.** All work lands on `main` and is pushed; no other branch is created. From Wave 1 on, a package works in a scratch copy of the tree and hands back a patch and a report, and one landing at a time applies it to the current `main`, with the package's listed amendments, runs `./check-all.sh` with no skips, then commits and pushes. After Wave 0, BUILD.md, this file, `index.html`, `js/core/numbers.js` and the golden pins are written only at landing, from the packages' reports, in the commit of the code they describe (BUILD.md §12).
- **The golden hash goes pending within each wave.** W0b adds a pending mode, set before W0c changes the state. While a run is pending, the tests assert that two runs are equal and that a cloned state behaves the same, but not the pin, and the hash page prints PENDING with its hash, which `check-hash` compares with a Node run of the same tree, so the cross-engine check never lapses. The pin is re-pinned at the end of Wave 0, Wave 1, Wave 2a and Wave 2b, each with a line here (old → new, commit, reason, first diverging step), and set pending again at the next wave's start. Julian's Safari and Firefox rows stay "pending" until the Wave 3 build.
- **W0a, what changed** (no change to the state; the golden hash is unchanged at 1695131025):
  - **The registry is split into fragments,** `js/core/reg/<part>.js`, one per owner, through `Registry.define`, `defineEvent` and `defineCause`; `Registry.order(table)` gives definition order. Every entry carries `built`, `ready`, `tests` and `inv`, and a clause-bearing one its `params`, template and `covers` (§5.1). The `alarm` trigger is gone: the alarm is a module (§8.2).
  - **38 event kinds** (§4.3's 32 and `waited`, `regenerated`, `healed`, `status`, `dropped`, `alerted`) with schemas, and 105 (kind, cause) pairs.
  - **Sentences** are keyed by kind and cause, in `js/core/text/<part>.js`; every kind and pair has one. M2's six sentences are unchanged on the events M2 emits. The log (`Text.log`) shows what M2's showed, which a test checks on the test room over three seeds, with one addition: an exhibit in view that opens a door now gets a line.
  - **Behaviour lines** are built by `js/core/clauses.js`, one part per registry id a species uses, the special and inflicted statuses included, with every number filled at the department's depth: "strikes from beside you for 4–9", "for 11 before your Padding". The longest is the Heliograph's, 454 characters at depth 7 (M2's longest was 318). In the strip at 390×844 it leaves the board 523 px at text size 1 and 404 px at 1.3; `check-screens` now puts the longest line in the strip and fails if the board keeps less than 40% of the window's height, which it did on a planted 726-character line.
  - **34 new numbers of record** (§8.10, AXIS_RANGE to RESTORE_CHARGES) so that every clause names its number; `ROLE_WARDEN_SPECIAL_EVERY` moved out of a Meaning; the Meanings of `ROLE_WARDEN_SPECIAL` and `ROLE_ARTILLERY_SPECIAL` now name the archetypes that use them (specials belong to archetypes, not roles), and `COST_USE` covers applying a Restoration kit.
  - **The Signal Lamp** (M11.3) names its repaired side, `modParams: { old_repair: { side: 'W' } }`, which its line now states.
  - **lint-registry** checks the kinds against §4.3, a schema and a sentence for every pair, clause templates and their parameters, every pack species' line at depths 1–7, ready entries' tests and invariants, and pack items' primitives; `--strict` is M3's acceptance and fails until every M3 entry is ready.

### 24 October 2026: M3 Wave 0, part W0b (test and determinism infrastructure)

- **The golden run is pending** from this commit until the end of Wave 0 (`pending: "M3 Wave 0 in progress; re-pinned at the end of Wave 0"`), so that W0c can change the state. Nothing in the state changed here: the run still gives 1695131025, its pin, in Node and in Chromium.
  - `test/golden.test.js` holds the golden test, moved out of `test/m0.test.js`. It plays every run twice and once cloned after every step; the three must agree, and a pinned run must equal its pin.
  - The hash page prints `PENDING m0Monkey: hash 1695131025, checkpoints …` and titles itself PENDING. `check-hash` then plays the pending run in Node and passes only if the page's hash and all ten checkpoints equal Node's. Planted in the built page, a different seed and a shown hash that differed from the reported one each failed it; with the pending mark removed, the page said ALL PASS, and a pin off by one failed both the page and the Node test.
  - `node tools/golden.js --pending "reason"` marks the runs pending and keeps their pins; a plain re-pin clears the mark and prints old → new; `--check` reports a pending run's hash beside its old pin. A re-pin of the unchanged tree rewrote `golden.js` byte for byte.
- **The Behaviour-line harness** (`test/behaviour/_harness.js`, BUILD.md §10.2): `scenario`, `species`, `sweep`, `play` and `sensitivity`, with the invariants of `test/behaviour/*.inv.js` loaded and checked after every step by `tools/invariants.js` (§5.3). Wave 1 writes its scenarios and invariants against it.
- **`test/run.js`** also runs the `*.test.js` files under `test/behaviour/` and `test/arena/`, and its filter matches the path from `test/`.
- **`tools/stats.js`** has the Wilson interval, which matches Newcombe (1998), Table I, method 3, on its four worked examples (81/263, 15/148, 0/20, 1/29) to four places.
- **`test/m2-vm.test.js`** holds M2's two view-model tests, moved unchanged out of `test/m2.test.js`, so that the view model's and the labels' tests are in separate files.
- **Checks:** `test/m3-infra.test.js` (10 tests): the checker and the harness on planted invariants and scenarios (one the rules break, found on the right actors and steps against an independent count from the events; one they keep; one checked once a step), a planted modifier for sensitivity, the runner's folders and filter end to end, Wilson against the published values, and the pending comparison on seven planted mismatches. `node test/run.js`: 82/82 (72 before: the golden test moved, ten added). `./check-all.sh`: 12 passed, 0 skipped, 0 failed; `check-hash` reports "pending runs equal Node's: m0Monkey 1695131025".

### 24 October 2026: M3 Wave 0, part W0c (the action core)

- **The state changes from here,** as planned: the golden run is pending (it now gives 3992369947 against its pin 1695131025, in Node and on the hash page alike), and is re-pinned at the end of Wave 0. The changes behind it: every actor carries every field of BUILD.md §4.1 from `Actors.spawn`; the state has `options`, `items`, `ui` and an `over` with its cause; every event carries its tick; every blow is announced (`attacked`) and makes a soft noise, every door opened a soft noise; a destroyed exhibit makes a loud one, and its own random streams are deleted. What happens did not change otherwise: over 10,000 monkey steps in the test room, and 3,000 in each department at depth 3, the legal actions, the choices, every actor's tile, health, mode and schedule, and every other event are the same as before, except that in the departments an exhibit now has its archetype's speed (a darter steps at half cost, a mimic or a marble one at double; with speed set aside, the runs match exactly).
- **The action table** (`js/core/rules/actions.js`, BUILD.md §4.2): each action kind is defined once by the file of its system, `step()` dispatches on it, and `Step.legal` lists the legal actions in a fixed, closed order. Refusals are codes with sentences (`corner`, `behind_glass`, `fixed`, `rooted`, …); M2's English reasons are gone from the rules. A test checks legal against refused over every handler's candidates, in the test room, a department and planted states.
- **Archetype and modifier hooks** (`js/core/rules/archetypes.js`): one file per archetype and modifier registers its hooks, asked archetype first, then modifiers in order, skipping a modifier switched off (`state.options.rulesOff`).
- **Rules written into BUILD.md:**
  - §8.1: every action of yours that costs time costs at least a turn, so a turn boundary runs between any two of your decisions (`step()` stops on one that costs less); an exhibit's action is charged after it acts, at the later of next + cost and `notBefore`; speed scales steps only, unless an archetype says otherwise, and the slowed status every action; and the status rule: a status of N turns covers the N turns that start at its bearer's next decision, so Fixative gives exactly 4 forced waits whatever came before it.
  - §8.2: line of sight is blocked by sight-blocking surfaces; exhibits never step out of an intact case, and treat open staff doors as walls too; noise reaches through a closed staff door with the door's extra 3.
  - §8.3: nothing strikes into or out of an intact case, and a bump into a case or into anything in one is refused alike, so a disguised mimic gives nothing away. New tiles: `u` (an opened case) and `s` (an open staff door).
  - §3.4: events are made only through `Causes.emit`, and `Causes.check` tests any event against its kind's and its cause's schema. §3.6: `rulesOff` covers modifiers in M3. §4.1: the actor's fields.
- **Checks:** `test/m3-backbone.test.js` (18 tests): legal against refused; the actor fields; the one-turn cost floor, with a planted 50-tick handler caught; the boundary's eight steps in order, each wrapped; the exhibit's turn with `notBefore`; Fixative after 100-, 150-, 200- and 300-tick actions giving 4 forced waits, `rooted` 2 giving 2 blocked turns with the door and the blow still allowed, and a 5-turn status acting on exactly 5 boundaries; `Causes.check` on every event of 4,200 monkey steps and on 14 planted faults; a refusal for each of 13 codes leaving the hash and the streams alone; the exhibits' step rule; walking distance onto unsteppable tiles and sight through dust; noise through doors and who hears it; the order inside one blow; the hooks' order; the M4 hooks and stubs. Legacy tests rewritten: `m0` (costs take the state and the kind of action), `m2` (statuses are applied through `Status.apply`; the corner refusal is a code), `m3-grammar` (the log now also shows each noise). `node test/run.js`: 100/100. `./check-all.sh`: 12 passed, 0 skipped, 0 failed.

### 24 October 2026: M3 Wave 0, part W0d (the exhibit core)

- **Sleepers now wake.** Your ring gives a sleeping exhibit a pip at each turn boundary, and its third pip wakes it hunting; awake exhibits look for you every turn and hunt you when they see you. The golden run stays pending (it now gives 1067571164; W0c's tree gave 3992369947, the pin is still 1695131025). In the monkey runs of `m3-backbone`, sleepers you walk up to now wake in your ring before a blow can surprise them, so damage wakes are rarer there; they are tested on their own.
- **Waking and changing mode** (`js/core/rules/wake.js`, BUILD.md §8.2): `Wake.wake` takes an exhibit out of dormant, and only it resets what belongs to one waking (`sawYou`, its count of actions, its archetype's per-waking state), costs the beat and starts the story; `Wake.setMode` makes every other change and resets nothing, each change with its event (`hunting`, `alerted`, `returned` or `lost`). Pips (`Wake.addPips`) come at most once a turn from each trigger, and the third wakes the exhibit in its cause's mode. A pipless exhibit (a mimic in its disguise) gains no pips and wakes only when struck, touched or dissolved. An actor made during the visit gets a creation `woke` and a beat (`Wake.created`).
- **The ring** has one predicate, `Vision.inRing`, behind both the ring drawn and the ring pip, and is drawn only on tiles an exhibit can stand on (it used to include the walls at its edge). Its radius now takes the kit's `Kit.ringDelta`, still 0.
- **An exhibit's turn** (`js/core/rules/ai.js`, §8.1): fixed, look, a pending special, its archetype, its mode, in that order; `AI.towards`, `AI.away` and `AI.strike` are the moves every behaviour is made of. The behaviour by mode is still M2's (a hunter strikes or closes in; the rest wait) until W1-WAKE-B.
- **Specials** (`js/core/rules/specials.js`, `js/core/rules/ranged.js`, §8.1): marking, resolving and cancelling, with their rules written into §8.1: the resolve costs an attack plus `SPECIAL_RECOVERY` (marked at 400, resolved at 500, next action at 700; BUILD.md used to say "the action after that costs +100", which this scheduler would have applied an action late); after a mark the exhibit acts no earlier than your next decision, so no special resolves unseen; no two pending damage marks share a tile; each actor is hit once, through its own Padding; a beam turned back by a reflector lists each tile once and can hit its shooter; a mark is called off when its owner is fixed, stops hunting or is destroyed. No archetype marks yet: the archetypes' files (`rules/arch/`, `rules/mods/`) and `close(x, y)` (`rules/doors.js`) are named with nothing in them, for Wave 1.
- **Rules written into BUILD.md:** §8.1: an exhibit's turn, the beat for actors made during the visit, and the specials' rules above. §8.2: the herald's call wakes awake; one action's wake order (every other wake effect before that action's noise); waking against changing mode; pipless exhibits; the ring on hold tiles only, and which turn the drawn ring is (the one the last boundary applied); exhibit sight. §4.1: `acts` and the telegraph's fields. §8.10: `SPECIAL_RECOVERY`'s meaning.
- **`check-3d`'s melee frame** now places you north of the exhibit you strike instead of walking you there, because the walk now wakes the sleepers it passes and the frame then depended on them. Found doing it, for W2a-VM: two awake exhibits in a column in the 3D view, the farther shows only 67–70% of itself (the rule is 75%): the nearer one's figure rises into its row and the nearer one's state glyph covers more of it (S.9, seed 5, the old walk to the Centrepiece, at both sizes).
- **Checks:** `test/m3-backbone-ai.test.js` (15 tests): the order of an exhibit's turn, each step wrapped; `Wake.wake` (the reset, `onWake`, the beat, the story, two recorded events); a pipless sleeper against every wake cause; `Wake.setMode` through 14 changes, nothing reset, each change's event, and a returning exhibit sent to look not surprised by a blow; `addPips`, `toHunting` and `created`; ring pips at the boundary and the ring drawn, against an independent walking-distance and line-of-sight ring at 14 positions; a special marked at 400, resolved at 500 for the number shown, next action at 700; a fast exhibit that marks during your 300-tick action resolving just after your next decision; overlaps for damage and not for calls; a beam turned back by a stubbed reflector; cancelling when fixed, on leaving hunting and on death; `Specials.of` at depths 1, 4 and 7; moving toward and away; an encased exhibit over 300 monkey steps; the stubs. Eleven planted faults (the ring off hold tiles or one tile wider, no `notBefore`, no recovery, a beam listing tiles twice, `sawYou` kept by waking or reset by a change of mode, pips more than once a turn, overlaps allowed, no resolve, no cancel on death) each fail at least one of them. Legacy tests rewritten: `m0` (the sleeper waits behind a wall, outside your ring, before it is struck), `m3-backbone` (a sleeper struck wakes, then hunts; the monkey's events now include ring pips and wakes). `node test/run.js`: 115/115.
