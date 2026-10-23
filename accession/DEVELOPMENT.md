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
| Art contact sheet | `python3 tools/art-sheet.py` → `test/shots/art-sheet.png` |

## Milestones

| | Status |
|---|---|
| M0 Core skeleton | accepted, 23 October 2026 (Chromium; Safari and Firefox hash checks pending) |
| M1 Layout | accepted, 23 October 2026 |
| M2 Look and read | in progress: view model, top-down board, labels, strip, pictograms, sprites |
| M2b The 3D board | in progress: renders behind the setting; the §6 revisions and checks are not done |
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
