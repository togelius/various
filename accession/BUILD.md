# ACCESSION: the build contract

*What gets built for the vertical slice, how, and how each part is shown to work. Written 23 October 2026 from [`DECISIONS.md`](DECISIONS.md) and Julian's answers to it, then revised after five adversarial reviews (consistency, engineering, rules, testability, and the 3D view's revertibility). Those reviews found rules an implementer would otherwise have guessed, and fixing them took the file past DESIGN's 10,000-word cap, to about 16,000; it is written for the build, not for reading through. Precedence: this file, then `DECISIONS.md`, then `DESIGN.md`, then the drafts in `design/`, which are reference material. Where this file fixes a rule or a number, the code follows this file; changing either means changing both in the same commit, and a lint checks the numbers.*

## 0. The principle, applied to building

Every result must be understandable by and explainable to a person. In the code that means four things:
1. **The core is deterministic,** so any bug, death or test failure can be replayed exactly from a seed and a list of actions, in a browser, by anyone.
2. **Every event carries its cause,** recorded where it happens, and every sentence the player reads about the rules is generated from the same data the rules run on.
3. **Every claim a test or bot makes comes with its numbers and a replay:** sample size, interval, seeds, build.
4. **The drawing never decides anything.** Both board views draw the same view model; the rules never ask a renderer a question.

---

## 1. What the slice contains

The slice answers one question: do three departments with different rules, drawn from one grammar on generated museum layouts, read as a museum and play as a roguelike for a stranger on a phone, in about 30 minutes?

**In:**
- **The rules:** the nine universal systems (§8), as the player is taught them.
- **Three hand-authored departments,** trimmed from the worked samples:
  - S.9 *Animals Not Yet Seen by the Day Staff*;
  - A.4 *Things Kept in Duplicate, Before the Repeal*;
  - M.11 *Long Galleries, Considered as Telegraph Lines*.

  Between them they bring five department-owned modules (§5.4) and three Centrepiece forms: a treasure and two fights.
- **Three layout programmes:**
  - enfilade (M.11);
  - case labyrinth (A.4);
  - sculpture court (S.9).

  The last two share the quadrangle scaffold, all are at Cabinet size (5–7 rooms), and each has an authored Intro gallery.
- **A run** of six departments on three floors of two, drawn from the three, with two Stair Halls and a short Exit (§8.9).
- **Two board views:** top-down (the reference) and the 3D view, behind one setting (§6).
- **Saves:** autosave after every action, the visitor's card, and an archive download.
- **Meta:**
  - the death label and its recap;
  - Your Collection, with one accession per department visit whose Certificate you earned;
  - the Catalogue of exhibits seen.
- **Sound,** with a visual twin and a caption for every sound that carries information.
- **Tooling:**
  - the test layers 1–8 of the playtesting plan (§10);
  - bots;
  - the single-file build.

**Out of the slice:**

| Feature | Status |
|---|---|
| Light, lanterns and lux | Department-owned systems, not universal (D5); none of the three slice departments owns light, so every tile is lit |
| Tiptoe | Cut (DESIGN default 5) |
| Search and hidden panels | Cut for the slice by this file; hinged panels are not generated |
| Staff guards, Custody and escort | Department-owned; S.9's guards are exhibits |
| Coins, shops, NPCs | After the gate |
| The Loan | Kept for v1 by D11; deferred past the slice gate by this file |
| Fire, damage kinds, forgeries, equipment attribution | Cut or after the gate |
| The sketch verb and classes | After the gate; the visitor has no class |
| The generation pipeline, the persona harness, the sequencer at pool size | After the gate |
| Patron membership, Directives, heat | After the gate |

**Size, to calibrate expectations:** the drafts estimated 15,000–21,000 lines for a slice of this kind, ±40%. This repository's history says plans grow.

---

## 2. Architecture and repository layout

Plain JavaScript, classic `<script>` tags, no bundler for the game. Each file defines one global namespace object (`const Rng = (() => { … })();`), as in `grift-city/`. The same files load in the browser, in Node tests (through a `vm` context) and in the bots.

```
accession/
  index.html               development entry: one <script> tag per file, in dependency order
  css/game.css, bag.css
  js/core/                 PURE: no DOM, no clock, no Math.random, integers only (§3)
    rng.js, int.js         string-keyed streams (hash → mulberry32); integer helpers with stated rounding
    state.js               canonical serialisation, hashing, cloning, the plain-data check
    numbers.js             the numbers of record (§8.10), the only home of rule constants
    registry.js, reg/      the grammar's API and the nine systems; one fragment per owner in reg/ (system,
                           waking, modes, combat, …) holding its entries, clause templates and event schemas (§5.1)
    clauses.js             Behaviour lines, filled from the clause templates at the department's depth (§5.3)
    grid.js, vision.js     tiles, line of sight, walking distance; what you see, your ring
    path.js, clock.js      paths for taps; the clock's budget and reads (rules/clock.js has its turn step)
    roles.js               exhibit numbers from role and depth
    layout/                build kit, programmes, curation, analysis, validation, repair, fallback
    rules/                 step.js (the only mutator); actions.js (the action table, §4.2); actors.js (actor
                           fields, costs, the scheduler); archetypes.js (archetype and modifier hooks, with one
                           file each in arch/ and mods/); options.js; causes.js (events and their causes, §3.4);
                           modules.js (M4's hooks); ai.js (an exhibit's turn); then one file per system
                           (wake, noise, combat, specials, ranged, health, doors, …)
    text.js, text/         sentences keyed by event kind and cause, refusals, the recap; one fragment per
                           owner in text/, as in reg/ (§4.3)
    labels.js              labels, odds readouts, the strip
    packs.js, dept.js      the pack registry and shared species; a department visit's starting state
    setup.js               the parts every state has, and a state for one room (tests, scenarios, arenas)
    run.js                 run structure: doors, sequencer, Stair Halls, the Exit (M5)
    viewmodel.js           derive(state, ui) → a plain description of what to draw (§6.1)
  js/view/                 RENDERERS: read the view model, never the state
    views.js               the renderer registry and fallback
    topdown.js             TopDownView, Canvas 2D: the reference
    board3d.js             Board3DView, three.js: optional (§6)
    art.gen.js             sprite grids and palettes, generated from art/ by tools/build-art.js
    sprites.js             sprite canvases per palette, and the 64×64 close-ups (Scale2x twice)
    pictograms.js          pictograms as 8×8 shapes, drawn as SVG or on the board
  js/ui/                   DOM: top bar, strip, label panel, doors, halls, menus, settings, captions; bag.js,
                           the Bag (your kit and tote, quickslots, aiming)
  js/input.js              pointer and keyboard → intents (§7)
  js/store.js              autosave, the visitor's card, the archive (§4.4)
  js/audio.js              synthesiser and tracker (M6)
  js/main.js               boot and wiring
  content/                 department packs, one file each (S9.js, A4.js, M11.js); shared species in no
                           department (watch.js, the Night Watchman); the test room
  art/                     sprite sources (text grids), palettes, the asset ledger (ledger.json)
  vendor/three/            three.iife.js (built once, pinned), LICENSE, VERSION (§6.4)
  tools/
    build-single.py        inline css and js into dist/ (the game and the hash page), stamped with coreHash; --out <dir> builds elsewhere
    build-art.js           art/ → js/view/art.gen.js; art-sheet.py renders a contact sheet
    core-context.js        loads the core into a hardened vm context for tests and tools
    lint-core.js           the determinism lint on acorn's syntax tree (§3.3); vendor/acorn
    lint-numbers.js        the §8.10 table against js/core/numbers.js
    lint-registry.js       ids, caps, Behaviour-line coverage, ledger coverage
    golden.js, monkey.js   golden runs (re-pin, mark pending, check, add, --against a commit) and the monkey
                           (every action kind a player has, drawn weighted on its own stream)
    battery.js             the M3 sim battery: monkeys, arenas, wander and soaks, every check after every
                           step, and the death recap rebuilt from the event log (§10.3)
    hash-compare.js        the Node side of the hash page's check of pending runs (§3.5)
    replay.js              replays: where they start, playing them, the golden runs' player (§3.5, §3.6)
    shrink.js              crash cards: ddmin over an action list, the state's JSON-path diff (§10.2)
    core-hash.js           coreHash and vmHash (§3.6, §6.1)
    invariants.js          loads the Behaviour-line invariants and checks them after each step (§5.3)
    stats.js               the statistics of §10.3; plain Node, never loaded into the core
    layout-sweep.js        the 1,000-seed layout sweep (§11, M1)
    sim.js, report.js      headless bots and paired comparisons; reports from their output, with replays
                           chosen by rule and crash cards, and the linked-build check (§12)
    arena.js               archetype arenas: the stamp format, building one for a seed, judging its goal (§10.3)
    policies/              the bots: lib.js (what a policy sees, its helpers, the registry), cards.js, a file
                           per arena, wander.js (the battery's department visitor), README.md (generated
                           from the cards)
    hash-template.html     the cross-browser hash page (§3.5)
    remove-3d.sh           reverting the 3D view (§6.3); vendor-three.sh
    browser/*.mjs          Playwright scripts: smoke, screens, clicks, kills, 3D checks
  test/                    *.test.js, golden/ (expected hashes), behaviour/ (scenarios, invariants and
                           _harness.js), arena/, run.js (m3-battery.test.js is check-all's short sims)
  dist/accession.html      the single-file build (committed, as elsewhere in this repo)
  check-all.sh             every lint and test; the gate before each commit
  DEVELOPMENT.md           milestone status and the validation log (§12)
```

**Rules for the layers:**
- `js/core` may not read anything outside `js/core` and `content/`.
- `js/view` reads only the view model and art.
- `js/ui` reads the view model and calls `text.js` for sentences.
- Only `main.js` and `input.js` call `step()`.
- A test loads `js/core` alone in a bare `vm` context with no `window`, which proves the first rule.

**Browsers:** current Safari (iOS and macOS), Chrome, Firefox and Edge. `dist/accession.html` runs from `file://` and from any static host.

**Hosting.** The canonical build is served by GitHub Pages from this repository's `main` branch (DESIGN default 42), including `dist/builds/` and `dist/accession-hash.html`; Julian switches Pages on once in the repository settings. Device checks, Home Screen installs and replay links use that URL. Until it exists, builds go to Julian as private Artifact pages.

---

## 3. The determinism contract

### 3.1 State and the one mutator

- **The whole game is one plain object, `state`:** `null`, booleans, strings, safe integers, arrays without holes, and objects with no `undefined` values (an empty curio slot is `null`). It holds no floats, functions, `Map`s, typed arrays or cycles. After every step, in every test run, a check confirms that the state is plain data of this kind.
- **Anything the core iterates is an array in a stated order** (actors in spawn order, modules in pack order, tiles in row-major order). The core never iterates an object's keys, so a state that has been through JSON behaves exactly like the original.
- **`step(state, action) → events` is the only function that changes `state`.** It mutates in place for speed and returns the list of events it caused. Bots that need to branch clone the state with `State.clone()`, a JSON round trip. `step()` never saves; `main.js` does (§4.4).
- **Free actions** (examine, open the label panel, look at the map) never call `step()`. Reading a label, which can identify a consumable kind, is a 0-tick action through `step()`, so the knowledge it grants is in the state and in the replay.
- **Rendering, sound and animation timing** live outside the state.

### 3.2 Random streams

- **Derivation.** A stream is named by a path string. Its seed is `hash32(runSeed + '/' + path)`, and its generator is mulberry32, as in `prototypes/layout/proto.js`.
- **Storage.** The current 32-bit state of every stream that outlives one call is stored in `state.rng[path]`, created on first use, so a snapshot resumes every stream exactly. Layout and loot generation run in one call, so their streams are local and never stored. On leaving a department, its `combat/`, `ai/` and `module/` streams are deleted. When an actor is destroyed, its own `combat/` and `ai/` streams are deleted (after its `onDied` effects, in `Combat.die`, §8.1), so Night Watchman returns and splits do not grow the table. A soak test checks that `state.rng` never holds more than 150 keys.
- **Integer draws only.** The draws are `int(lo, hi)` (by modulo, whose bias is below 10⁻⁷ at the sizes used), `chance(permille)`, `d100`, `pick`, `shuffle` and `weighted`.
- **Streams are keyed per purpose and per actor**, so removing one exhibit or switching off one rule does not reshuffle anything else. That is what lets "does this matter?" be answered by rerunning the same seeds with one thing switched off:

| Path | Used for |
|---|---|
| `doors` | the door sequencer |
| `seals` | the per-run seal shuffle |
| `deck` | the consumable deck |
| `layout/<acc>@<pin>/d<depth>/a<k>/{knobs,embed,openings,aspace}` and `…/a<k>/room/<roleKey>/curate` | layout, local; k is the reseed attempt. This extends `design/layout.md` §12.1 with the depth |
| `…/a<k>/room/<roleKey>/populate` and `…/a<k>/staff` | what is placed in one room, in this order: its cases (each case's glass, then lock, then whether it is on loan), then its items (each one's place, then a weapon's, garment's or instrument's tier), then its consumables; staff-door grades, in row-major order; local. One holder serves the whole department while it is made, so a room's stream runs on from the cases to the items to the consumables rather than starting again for each. The port replaces the prototype's department-wide `/populate` stream |
| `…/a<k>/items` | which of the pack's weapons and garments, then which of its curios and instruments, are placed (each list shuffled), then which room each placed item and consumable goes in; local. Added in M3 (§3.2 had no department-level placement stream), for Julian to confirm |
| `place/<acc>/d<depth>` | the stand-in placement of exhibits, until M4's population replaces it; local |
| `combat/<actorUid>` | every hit and damage roll made *by* that actor |
| `ai/<actorUid>` | every choice that actor makes, including ties between equally short steps, and a mimic's disguise (its case's glass, lock and loan, drawn as a real case's are) |
| `module/<moduleId>/<acc>/d<depth>` | one module's own draws |
| `cosmetic/…` | renderer only, derived from the layout key, never stored and never read by the core |
| `policy/<name>/<seed>`, `arena/<id>/variant`, `bootstrap/…` | the tools' own: a policy's choices, an arena's variant for a seed, a bootstrap's resamples (§10.2, §10.3). Each is on a holder of its own, never in the state, so none of them moves a game stream |

- **`…/a<k>`** is the layout attempt that made the plan (k from 0; a certified fallback counts as attempt 5), and a department's placement streams are named under it.
- **Role keys** name rooms without dots: `intro`, `s1`, `s2` … (section galleries in tour order), `study1` …, `centre`, `coda`, `staff`.
- **Actor uids are stable names, not indices:** `<acc>.<depth>.<roleKey>.<n>`, n counted from 1 in each room in placement order, for example `M11.3.s2.4`. The player is `you`. A body created mid-run (a splitter's half, a summoned trolley) is `<parentUid>/<k>`, with k from the parent's counter (`kids`, from 1); the Night Watchman is `<acc>.<depth>.watch.<k>`; the Exit's recalled exhibits are `exit.7.<k>`.
- **Item uids are stable names too,** since replays carry `take(uid)` and `use(uid)`: `you.w` and `you.g` for the weapon and garment you start with; `<acc>.<depth>.<roleKey>.i<n>` for an item placed in a room, n counted per room in placement order; `<parentUid>/<k>` for a stack split from another, with k from the run's counter (`run.items`).
- **Removing an exhibit** (`without`, §3.6) marks it `gone` after every exhibit has taken its uid and its tile and before anything else is placed; a removed exhibit keeps its tile for placement, so no uid, tile, stream or item of anything else changes. A body made during a visit that `without` names (a Night Watchman, or a splitter's half by its `<parentUid>/<k>`) is made and at once marked `gone`, with no event; a splitter still loses that half's share of its health and counts it, so every later half keeps its uid.
- **`<pin>` is the layout version.** A layout code change bumps it.

### 3.3 What the core may not do

`tools/lint-core.js` reads each file in `js/core` and `content/`, and, from `check-all.sh`, `tools/arena.js`, `tools/monkey.js`, `tools/replay.js` and `tools/policies/`, which run beside the core in the same hardened context (the monkey and the replay also on the hash page, which has no hardening), with string literals, template text and comments removed, so "Long-Handled Date Stamp" in a label or `'window'` as a knob value is fine. It fails on:
- the identifiers `Date`, `performance`, `crypto`, `setTimeout`, `setInterval`, `requestAnimationFrame`, `window`, `document`, `globalThis`, `localStorage`, `indexedDB`, `navigator`, `fetch`, `Intl`, `parseFloat`, `WeakRef` and `FinalizationRegistry` (whose timing is the garbage collector's);
- `Math.X` for any X outside `imul`, `abs`, `min`, `max`, `floor`, `ceil`, `trunc` and `sign`, and any other way of reaching `Math` (`Math[…]`, aliasing `Math`);
- the members `localeCompare`, `toLocaleString`, `toLocaleDateString`, `toLocaleTimeString`, `toLocaleUpperCase`, `toLocaleLowerCase`, `toFixed`, `toPrecision` and `parseFloat` (so `Number.parseFloat` too), however reached, a destructured one included;
- a call through `.constructor` (which reaches the Function constructor from any function);
- the `**` operator;
- `.sort()` and `.toSorted()` with no comparator, with `undefined` or `null` for one, or with one that returns a comparison (`(a, b) => a > b`, true or false) rather than a number, whose order differs between engines, and `for … in`;
- in a policy file (`tools/policies/`, one that calls `Policies.add`, not `lib.js`), state of its own: a `let` or `var` outside a function (or in a function called where it is written at the top), or a `const` there holding an object, an array or a `new` one that is not frozen, since the sim loads the file once and shares it between runs (§10.2).

`WeakMap` and `WeakSet` stay allowed: they cannot be iterated, so nothing can depend on their order (the invariants use one as a cache).

**Integer helpers** live in `js/core/int.js` and state their rounding: `idiv(a, b)` (floor division), `ceilDiv(a, b)`, `round10(num, den)` (to the nearest 10, halves up) and `pct(a, p)` (`idiv(a × p, 100)`). Rule arithmetic uses them rather than `/`. The plain-data check in §3.1 is the backstop for anything that slips through.

**Order.** `Array.prototype.sort` is always given a comparator that breaks ties on a stable key. Actors are only ever appended during a department, never removed or reordered (a dead one is marked `gone`), so array order is spawn order; they are compacted when you leave.

### 3.4 Events carry causes

- **Every event is a plain object:** `{k, turn, tick, …, cause}`. Every rule makes its events with `Causes.emit(state, ev, k, fields, cause)`, never by hand: it stamps the turn and tick, copies the fields and the cause (so nothing outside the state reaches into it), adds the event to the list `step()` returns, keeps it in the cause records if its kind is recorded, and then calls M4's module hook (`Modules.onEvent`, empty in M3). A field or cause value that is not plain data (NaN, an infinity, a fraction) stops the game with an error when it is emitted, rather than being copied as null; a field left undefined counts as absent. The same holds for the causes an actor keeps in its story.
- **`cause` says why, in data:**
  - a wake event names the trigger, the source and the distance;
  - a damage event names the attacker, the attack, the hit chance, the roll, the damage roll, the Padding and the result; whatever made it, its cause may also say `saved` (an invulnerable run kept you at 1 HP) and `side` (it came through an `old_repair` exhibit's repaired side);
  - a module event names the module and the rule within it.
- **`text.js` turns events into sentences.** No sentence about the rules is written anywhere else.
- **Each actor keeps its own story:** `woke: {turn, cause}` for its most recent waking and `hunted: {turn, cause}` for when it began hunting you, set where those happen. An actor created awake (a patrol, the Night Watchman, a summoned body) gets `woke` at its creation, with the cause `awake`, `patrol`, `night_watch` or `summoned`. Of an exhibit a room starts awake (`Setup.settleActors`), only one whose trigger stands for the wake clause (`awake`) gets `awake`, told "it never sleeps"; any other, which a room for tests or an arena stamp's `mode=` made awake but which can sleep, gets `placed`, told "it was set out awake when the room was made". Neither has an event: a log-only reader takes them from the starting state. The death recap ("what killed you, why it was awake, and when it woke") reads them from the killer, so it never depends on how much else happened since.
- **Every event kind has a cause schema** in the registry (its required fields and their types). `Causes.check(e)` checks an event's fields against its kind's schema and its cause against its cause's, allowing no field outside them, and names the first problem (`damaged.cause.roll: missing int`); `moved`, `closed` and `refused` have their fields checked but not their cause. A test runs it on every event of monkey runs in the test room and the three departments, and checks that no sentence from `text.js` contains "undefined", "NaN" or "[object".
- **The state also keeps the last `CAUSE_RECORDS` (64) cause records,** for the recap's narrative.
- **Sim runs can log every event in full.**

### 3.5 Hashes and the cross-engine check

- **The state hash** is a 32-bit FNV-1a over canonical JSON (sorted keys, no whitespace).
- **Golden runs** live in `test/golden/golden.js` (as JavaScript, so a page opened from `file://` can load them). Each is a seed plus a policy or an action list (a 10,000-action monkey run, and one replay per milestone) with the expected final hash and hashes at fixed checkpoints. M3's acceptance added `m3Replay` (309 actions of the wander policy on M.11 at depth 3, seed 116, with a use and a bash put in at their first chance: it applies a Restoration kit, breaks a case, hears the bell, opens a case, and dies to the Night Watchman in the night watch) and one 1,000-action monkey per department at depth 3 (`m3MonkeyS9`, `m3MonkeyA4`, `m3MonkeyM11`). A run is one of two kinds: a monkey, `{kind: 'monkey', seed, actions, make}`, which plays that many monkey actions in the test room (`make: null`) or a department (`make: {dept, depth}`), folding a checkpoint in every 1,000 actions; or a replay, `{kind: 'replay', start, options, actions}` (§3.6), whose checkpoints are the state's hash after every 100th action and whose hash is its final state's. `node tools/golden.js --add <name> <file>` adds one, pinned, or unpinned and pending; the file may hold a golden entry, a replay as the tools write it (a replay without `kind` is read as a replay), or a crash card holding one.
- **Clone-stability.** `test/golden.test.js` plays every golden run three times: twice continuously, and once with `state = State.clone(state)` after every step. The three must give the same checkpoint hashes, and a pinned run must give its recorded ones. When a play throws, or the second or the cloned play differs, the test names the first step where it happens and prints the crash card (§10.2) of the visit that step is in. Beside the department golden runs (M3's acceptance), `test/m3-backbone-dept.test.js` also plays a 300-action monkey (every action kind a player has, weighted, the one the golden runs use) in each department at depths 2 and 5 (the seeds too), with your health 999, once continuously and once with a clone after every step. It compares their hashes every 10 steps (a difference, once there, stays) and checks plain data after every step; a difference is played again step by step, so its failure names the first step that differs, its action and events, and the first field of the state that differs. A scenario can ask the harness for a clone check too (§10.2).
- **Pending runs.** While a stretch of work changes the state on purpose (in M3, each wave of the build), a golden run may carry `pending` with its reason (`node tools/golden.js --pending "reason"`). A pending run is still played three times and must agree with itself and with its clone, but it is not held to its pin. The hash page prints `PENDING <name>: hash H, checkpoints …` for it, and its title is PENDING when every pinned run passes; `tools/browser/check-hash.mjs` then plays each pending run in Node through `tools/core-context.js` on the same tree and passes only if the page's hash and every checkpoint equal Node's, so the check that browsers and Node agree never lapses. A re-pin (`node tools/golden.js`) ends the stretch: it writes the new hashes with no `pending`, and the log records the old hash, the new one and why. Only that bare command re-pins: `node tools/golden.js --help` prints the usage, and an option or word the tool does not know, or two of `--add`, `--against`, `--pending` and `--check` at once, is refused with a message; neither writes anything. Julian's browser rows stay "pending" while any run is.
- **Finding a divergence.** A golden run also stores a hash after every step (4 bytes a step, in base64, as `steps`), written at each re-pin. On a mismatch, Node (the golden test and `node tools/golden.js --check`) and the hash page play the run again against those hashes and print, in the same words, the first diverging step, its action, and the events of that step; the hash page shows them as a copyable text block with a Download button, so Julian can send it back. A pin without per-step hashes can name only the first diverging checkpoint. A re-pin prints the first step at which the new hashes leave the old ones, and `node tools/golden.js --against <commit>` plays each run on this tree and on that commit's core (its files from git, in a temporary directory) and prints the first step at which they differ, with each side's action and events, and the first fields that differ when the starting states already do. `check-hash.mjs` also loads the page with planted runs (a replay with one action changed, a monkey whose pin has one step changed) and passes only if the page names each one's first diverging step in Node's words, and its Download button saves them; among them is a replay with switched options, pinned in Node, which the page must pass, and the same replay pending, whose hash and checkpoints on the page must equal Node's. It also checks that the hash page and the game carry this tree's `coreHash` (and the game its `vmHash`).
- **Where they are checked:**
  - Node runs them on every `check-all.sh`;
  - `build-single.py` also writes `dist/accession-hash.html`, with the core and the golden runs inlined; Chromium runs it through Playwright;
  - Julian opens the hosted copy (§2) in Safari on the Mac and the iPhone, and in Firefox, once per milestone. It prints PASS, the first diverging checkpoint, or PENDING with its hash. This environment has only Chromium; WebKit cannot be installed here.

### 3.6 Replays and counterfactual reruns

- **`coreHash`** is a hash of the source of `js/core` and `content/`, except `viewmodel.js`, stamped into each build. A change to the UI does not change it. Sim output also records `vmHash` (§6.1). Both are FNV-1a, written as 8 hex digits, over each file's path and text (line endings as `\n`), in path order (`tools/core-hash.js`); `build-single.py` stamps them into the game's head (`<meta name="accession-core-hash">`, `accession-vm-hash`) and onto the hash page.
- **A replay is** `{coreHash, layoutPin, start, options, actions}`. `start` is the run seed, or a snapshot where logging restarted. Until M5 builds the run, a start is `{seed, room: 'T0'}` (the test room), `{seed, dept, depth}` (one department visit) or `{state}` (a snapshot, which keeps its own options), and a tool may register another (an arena's) with `Replay.starter`. `node tools/replay.js <file> [--log] [--inv]` plays a replay file (a sim run's from an arena too, its room rebuilt by `tools/arena.js`, whose hash it compares with the one the start records), or a crash card holding one, and prints what happened. `options` holds:
  - `firstRun` (which adds the Orientation room);
  - `rulesOff` (switch off a rule by id: a modifier in M3, a module from M4);
  - `without` (remove an actor by uid);
  - `sequence` (pin the departments).

  These are the hooks the paired bots and the reports use. A visit keeps its own switches in `state.options` (`Options.make`: `rulesOff`, `without`, and `invulnerable`, the sims' and tests' option that keeps your HP at least 1, §10.2), and a rule asks `Options.off(state, id)`.
- **Replay length.** The save record carries the run's replay so far (§4.4). Loading a save in a build with a different `coreHash` starts a new replay from the loaded snapshot, and the death label then says that the replay starts at turn N.
- **A replay link** encodes the replay in the URL fragment. Opening it in any build with the same `coreHash` plays it back with a scrubber.
- **Release builds** (one per milestone and every slice-gate build) are kept as `dist/builds/<coreHash>.html` (`python3 tools/build-single.py --release`), so old replays keep working.

---

## 4. State, actions, events and saves

### 4.1 The state, in outline

```
state = {
  v, coreHash, runId, seed,             save format version, core hash, run id, run seed
  rng: { path: uint32 },
  tick, turn,
  options: { rulesOff, without, invulnerable },   the visit's switches (§3.6)
  run: { grade, seals, knownSeals, deck, items,
         floor, slot, depth, sequence, offered, certificates, perks, collectionPicks },
  dept: { acc, pin, depth, programme, w, h, tiles, rooms, roomOf, ltour,
          entrance, exits, lectern, viewTile,
          clock: { B, G, stage, count, pausedSince, nightBells, watch: { k, back } },
          fixtures: [ case | staff | plaque ],
          surfaces: [ { kind, x, y, size, until, by } ],
          highlights: [ { uid, room } ], planRead, entryGrade,
          modules: [ { id, …moduleState } ],   in pack order
          seen },                       the map as you last saw it: one character a tile, ' ' where never seen
  actors: [ actor ],                    in spawn order; actors[0] is you
  items:  [ item ],
  you:    { kit: { weapon, garment, curio: [null, null], instrument }, tote: [ uid … ] },
  causes: [ last 64 cause records ],
  over:   null | { k: 'died' | 'left', turn, by, door, cause },   the visit's end
  ui:     { pendingChoice }             a seal, perk, door or hall choice waiting for an answer, {k, options}
}

actor = { uid, sp, arch, role, mods, modParams, trigger, group,     copied from the species at spawn
          size, x, y, hp, maxHp, acc, eva, pad, dmin, dmax, speed,
          next, notBefore, mode, pips, stim, pipTurns, sawYou,
          home, target, lastKnown, guards, route, plan, facing,
          statuses: [ { id, until, turns, from } ], telegraph, acts,
          woke, hunted, kids, gen, gone, ax }

item   = { uid, kind, ref, where, form, tier, level, prims, charges, max, rechargeAt, ck, seal, n, from }
case   = { k: 'case', x, y, room, num, glass, lock, hits, st, loan, holds, mimic }
staff  = { k: 'staff', x, y, grade }
plaque = { k: 'plaque', x, y, ck }
```

**Every state has every part,** made by `Setup.base` (a department's by `Dept.create`, a room's for tests, scenarios and arenas by `Setup.room`), with plain-data defaults, and with your health your grade's (§8.1), so a room made at a grade above I gives you more. A room for tests is given exactly what it holds: an item given at the tote or in a slot is carried or worn (a weapon or garment taking the place of the one you start with), an exhibit's statuses, target, last-known tile and `sawYou`, and your statuses, are as given (statuses settled as the room is made), and a field `Setup.room` does not know, a slot given twice, an item of the wrong kind for its slot or a status not in the registry is an error, never silently left out.
- **The run:** `grade` (I at the start), `seals` (null until the run's seals are shuffled, then `{sol: [4 kind indices], eph: [4]}`), `knownSeals` (those identified), `deck` (the cards left of each kind, in `DECK`'s order, full at the start), `items` (the counter for split stacks' uids, §3.2); the rest is the run structure of M5.
- **The department:** its rooms keep their id, role key, role and number; `clock` (none in a room for tests unless asked): `stage` 0 while open, 1 after the bell, 2 in the night watch, `count` the clock turns since entry, which a sealed hall stops, `pausedSince` the turn a hall sealed (M4), `nightBells` the night-watch bells rung so far, and `watch`, with `k` the Night Watchmen so far and `back` the count at which the next enters; `fixtures`: the cases and staff doors in row-major order, then each fixture added after them in the order it was added (while the department is made, a mimic's disguise and then the identifying labels); `surfaces`, in the order laid (§8.1); `highlights`, each Highlight's uid and room (in M3 the two Restoration kits, §8.5); `planRead`, the turn a Floor Plan was read here, or null; `entryGrade`, your grade when you came in.
- **An item:** `kind` (weapon, garment, curio, instrument, kit or consumable); `ref` (its pack item's id; `restoration` for a Restoration kit; null for the kit you start with); `where` (`{at: 'floor' | 'case', x, y}`, `{at: 'tote'}`, `{at: 'kit', slot}` with slot weapon, garment, curio0, curio1 or instrument, or `{at: 'gone'}`); a weapon's or garment's `form`, or which instrument an instrument is (`fork`, `pin_driver` or `pole`); a weapon's, garment's or instrument's `tier` (1–4, drawn from depth when it is placed, never from the pack, §8.1); `level` (Restoration levels; a curio's rank); `prims` (`[{id, cls}]`); an instrument's `charges`, `max` and `rechargeAt` (the turn at whose boundary it next gets a charge back; null when it is full); a consumable's `ck` (kind), `seal` and `n` (count); `from`, the department it was first taken in.
- **A case:** `room` (its room's role key), `num` (its accession number: null only for a mimic's case, which is its tell), `glass` (1–3: Plate, Laminated, Security), `lock` (the grade it needs, 1–7), `hits` (bashes taken), `st` (`shut`, `open`, `broken`, `dissolved` or `revealed`), `loan` (on loan elsewhere: a label with no object), `holds` (an item uid or null), `mimic` (the uid of the mimic it is, or null).
- **You** start with a T1 Balanced weapon (`you.w`) and a T1 Standard garment (`you.g`) equipped, and your derived stats are those `Kit.derive` gives for what you wear (§8.1).

**Tiles change only in these ways,** and a test watches every tile through monkey runs: a door opening or closing (`+` and `'`, `S` and `s`); a case opened or dissolved (`v` to `u`), broken (`v` to `k`), or a mimic revealed (`v` to `.`); a mimic's disguise (`.` to `v`, only when the department is made); shards (`.` or `,` to `x`). So no rule ever writes over an exit, the entrance, a bench, an opened or broken case or a wall.

**Actors** are made by `Actors.spawn(state, rec)`, which appends one with every field set to plain data (`null`, never `undefined`):
- **From the species,** at spawn: `arch` (an exhibit with none is a plodder), `role`, `mods`, `modParams` (a modifier's own values, such as `old_repair`'s side), `trigger` and `group`. Rules read the actor, never the pack. `speed` is its archetype's or a modifier's (§8.1). An exhibit a room for tests names by a pack or shared species takes that species' archetype, role, modifiers, `modParams`, trigger and group unless it gives its own, so its label never says what it is not.
- **Waking and modes** (§8.2): `mode`, `pips`, `stim` (the turn of its last stimulus), `pipTurns` (the turn each trigger last added a pip), `sawYou` (it has seen you since it last woke), `home`, `target`, `lastKnown`, `guards` (the tile a tethered exhibit guards).
- **Scheduling** (§8.1): `next`, and `notBefore`, the earliest tick of its next action after it marks a special, which only the scheduler reads and clears.
- **The story** (§3.4): `woke` and `hunted`; `kids` and `gen` count the bodies split from it and its generation (each split moves both halves one generation on); `gone` marks an actor destroyed or removed, which is never taken out of the list during a visit.
- **`ax`** is plain data that only its archetype's file reads or writes; `acts` counts its actions since it last woke, the one it is taking included; `telegraph` is its pending special, `{ sp, tiles, from, via, gross, effect, turn, tick }`: the marked tiles in row-major order, each once and fixed when shown, and for each the tile its damage comes from and the reflector that sent a beam back before it reached that tile, or `null` (§8.1).
- **Kept for M4, always `null` in M3:** `route` (patrols), `plan` (clockwork's shown next move) and `facing` (there is no facing, §5.4).
- **You** carry the same fields, and also `still` and `lastAct` (your last action that cost time sets your ring, §8.2), `seated` (on a bench), `regen` (the regeneration store) and your derived stats (`weaponForm`, `reach`, `quiet`, `breaker`, `acc`, `eva`, `pad`, `dmin`, `dmax`), which `Kit.settle` keeps up to date at the end of every step.

**The snapshot stores the generated layout itself,** not only its seed (about 1,000 tiles: a few kilobytes). A save therefore resumes correctly even if the layout code has changed since.

**Size.** An actor has `size` 1 or 2 (a Centrepiece is 2×2), anchored at its top-left tile. Distance, adjacency and line of sight use the nearest of its tiles; it is observed if any of its tiles is in sight; it moves only where all its tiles are free.

**Scheduling.** Sleeping exhibits are not scheduled: they act only once woken, and waking sets `next` to now plus one action (§8.1).

### 4.2 Actions

**One small vocabulary**, the same for people, bots and replays:

| Kind | Actions |
|---|---|
| Moving | `move(dir)` (8 directions; into an exhibit it is an attack, into a closed door it opens it); `wait`; `rest` (one turn of a repeated wait); `close(x,y)` (a door beside you) |
| Fighting | `attack(uid)` (beside you, or 2 tiles away with a Reach weapon) |
| Cases | `open(x,y)`; `bash(x,y)`; `push(x,y,dir)` (weather jars, M4) |
| Items | `take(uid)`; `drop(uid)`; `equip(uid)`; `unequip(slot)`; `use(uid[, x, y][, how][, on])` (an instrument at a tile, the Window Pole with `how` push, pull or take; a kit on an item; a consumable); `throw(uid,x,y)` |
| Reading and viewing | `read(x,y)` (0 ticks); `view` (one turn of the Centrepiece viewing, M4) |
| Places | `sit` (on a bench); `leave(i)` (on exit tile i) |
| Choices | `choose(index)` (a seal, a perk, a door, a hall offer, an accession) |

**The action table** (`js/core/rules/actions.js`). Each action kind is defined once, by the file of the system that owns it: `Actions.define(id, {legal, candidates, apply})`, where `legal(state)` lists the legal actions of that kind, `candidates(state)` a superset with illegal ones, and `apply(state, action, ev)` returns the cost in ticks or a refusal code, checking everything before it changes anything. The kinds are closed, in the order `wait, rest, sit, move, attack, close, open, bash, push, take, drop, equip, unequip, use, throw, read, view, choose, leave` (`Actions.ORDER`); `push` and `view` are reserved for M4 and have no handler in M3. A pending choice is answered by `choose(index)`, which hands it to the function defined for its kind (`Actions.defineChoice`) and costs what that function says (choosing a seal costs nothing: reading the Catalogue Card was the cost).

**Paths are a UI feature.** A tap on a distant tile becomes a sequence of `move` actions, issued one at a time and stopped by the interrupt rule (§7.1), so a replay never contains a path.

**Illegal actions are refused before they cost anything:** `step()` returns a single `refused` event with a reason code (`corner`, `behind_glass`, `rooted`, …), and neither the state nor any random stream changes; `Text.refusal(code)` gives its sentence. `step()` refuses, in this order: when the visit is over (`visit_over`); when a choice is waiting and the action is not `choose` (`choice_pending`); an action with no handler (`unknown_action`); one a status forbids (`Status.blocks`: while fixed you may only wait, rest or answer a choice already waiting, `fixed`; while rooted you may not make a move that would change your tile, `rooted`, though bumping a door, an exhibit or a case, which leaves you where you are, still works, so a bump into a case is refused as glass whether you are rooted or not, as one into a mimic in its disguise is); and whatever the action's handler refuses.

**`Step.legal(state)`** lists every legal action: each handler's legal actions in `Actions.ORDER` that no status forbids (only `choose`'s while a choice waits, and none once the visit is over). A test asserts that `step()` refuses exactly the actions it leaves out, over every handler's candidates, and monkeys draw from it.

### 4.3 Events

Event kinds (`k`):
- **Movement:** `moved`, `opened`, `closed`.
- **Fighting:** `attacked`, `missed`, `damaged`, `died`, `telegraphed`, `special`.
- **Health and statuses:** `waited`, `regenerated`, `healed`, `status`.
- **Waking:** `noise`, `pip`, `woke`, `hunting`, `alerted`, `lost`, `returned`.
- **Cases:** `case_opened`, `glass_cracked`, `glass_broke`.
- **Items:** `took`, `dropped`, `equipped`, `used`, `identified`.
- **Clock and alarms:** `stage`, `alarm`.
- **Progress:** `certificate`, `grade`, `perk`, `viewed`.
- **Modules:** `module`.
- **Places and system:** `entered`, `left`, `refused`.
- **Surfaces:** `surface`.

The list is closed and lives in the registry (`Registry.EVENT_KINDS`); `tools/lint-registry.js` fails if it and this list differ. `alerted` sends an exhibit that is not hunting to look at a noise, or, when its search ends and it may not go back, or other actors block its way home, to wander; `healed` is any gain of health but regeneration; `status` is a status put on or ended; `surface` is a surface laid (a plaster cast's dust, cause `died` by the cast; a thrown Fumigant's cloud, cause `item`), with its kind, centre, side and turns, so the log says why sight is blocked; unequipping is `equipped` with no item. Each kind has a schema (its fields and their types: uid, uids, int, str, bool, tile, tiles, obj, with `?` for an optional field), and so does each of its causes, `Registry.defineEvent(k, …)` and `Registry.defineCause(k, causeK, …)`, in the fragment of the rule that emits it (§5.1).

**Sentences** are keyed by kind and cause, because many rules emit the same kind for their own reasons:
- `Text.define(k, fn)` gives a kind's default sentence, `Text.defineCause(k, causeK, fn)` the sentence for one of its causes, and `Text.defineRefusal(code, fn)` a refusal's, each in the owner's fragment `js/core/text/<part>.js`; `Text.provide(name, fn)` supplies the clock dial's sentence and the stage chip's words (§7.2; `Text.clock`, `Text.stage`), the death recap, the confirmations' words (§7.1; `Text.confirm`, in `js/core/text/confirm.js`) and a long rest's line (§7.1; `Text.rest`).
- `Text.event(e, nameOf)` uses the cause's sentence, and falls back to the kind's.
- `Text.log(events, nameOf, visible)` chooses what reaches your log: it leaves out steps, closed doors, the announcement of a blow (its hit or miss is logged), waits and regeneration, and pips, statuses and doors of exhibits out of view; an exhibit that wakes straight into a hunt gets one sentence; and exhibits of one name that stir alike in one step (a swarm's bodies) get one sentence, which says how many more did the same.

lint-registry fails if a kind or a (kind, cause) pair has no sentence. A test checks that every `damaged` and `woke` event has a non-empty cause.

### 4.4 Saves

The design in [`DECISIONS.md`](DECISIONS.md) (Autosave) is the contract. The mechanics:
- **Only play mode saves.** `store.js` is used by `main.js` in play mode only; replays, the hash page and tests never open IndexedDB or localStorage.
- **After every `step()` that returned at least one event,** `main.js` has `store.js` serialise the state and write it to IndexedDB, in one transaction, into the older of two slots.
- **The record** is `{runId, seq, v, coreHash, savedAt, checksum, payload, replay}`:
  - `seq` is device-wide and never decreases (kept in the meta store);
  - `checksum` is the FNV-1a of `payload`;
  - `replay` is the run's action log so far (§3.6);
  - `savedAt` is display only.
- **Writes are coalesced:** at most one routine write is in flight, and the next carries the newest state.
- **The same record is mirrored to localStorage.**
- **It is written again on `visibilitychange` to hidden and on `pagehide`,** started at once even while another write is in flight (IndexedDB orders the transactions).
- **Meta changes go with their snapshot.** Changes an action causes in the meta store (an accession, a Catalogue entry) are written in the same IndexedDB transaction as the snapshot that contains that action.
- **`navigator.storage.persist()`** is requested after the first completed department, with a sentence saying why.
- **On load,** every slot in both stores is read. The record with the highest `seq`, a valid checksum and a loadable `v` wins. If it is not the newest record, the game says so in one sentence ("The last move before the page closed could not be recovered; you are one turn earlier.").
- **Death is a tombstone, not a deletion.** One IndexedDB transaction writes `{runId, seq, dead: true}` to both slots together with the meta update (the death label, the record). The death label is shown only once that transaction completes, and localStorage is cleared afterwards. On load, a tombstone outranks every record of its run, so a stale localStorage copy can never bring a dead run back.
- **No manual save or load.**
- **Versions.**
  - A save from an older `v` is migrated by a listed function or retired with a sentence naming the version.
  - A build that finds a record with a newer `v` than it knows leaves storage untouched and says "This save belongs to a newer version of the game."; it can still play replays.
  - The meta store (Collection, Catalogue, record) has its own version and migrations, and is never retired.
- **The visitor's card** is a short text code of the meta store (compressed, base64url, with a checksum), shown on the Entrance Hall screen with Copy and Paste buttons.
- **The archive** is a JSON file download of the meta store plus the current snapshot. Import reads both.
- **If IndexedDB is unavailable,** localStorage alone is used, and the settings screen says so.
- **Installable.** `dist/accession.html` carries the `apple-mobile-web-app-capable` and theme metas, an apple-touch-icon and an inline manifest (`display: standalone`). The canonical build is hosted at one URL (GitHub Pages, DESIGN default 42), and the persist() sentence and Settings explain Add to Home Screen, which keeps Safari from deleting the save after seven days without a visit. M5 checks the metas; Julian's iPhone checklist covers an installed launch.

---

## 5. Content: the grammar registry and the department packs

### 5.1 The registry

`js/core/registry.js` is the one machine-readable grammar. It holds:
- the **nine universal systems**, each with an icon id and its one sentence (§8);
- the **slice subsets** of triggers, archetypes, modifiers, specials, statuses, surfaces, item primitives, instruments, fixtures, glasses, wake causes, refusal codes and modules;
- the **8 consumable kinds**, their seals, and (M4) the **8 perks**;
- the **event kinds** and their schemas.

**Fragments.** `registry.js` holds only the systems and the API; every entry lives in a fragment, `js/core/reg/<part>.js`, owned by the package that implements and tests it (`reg/waking.js` for the triggers it builds, `reg/arch-b.js` for the kiter, and so on), so no two packages edit one file:
- `Registry.define(table, id, entry)` adds an entry; each id has one owner, and a second definition throws;
- `Registry.defineEvent(k, schema)` and `Registry.defineCause(k, causeK, schema)` add event and cause schemas (§4.3);
- `Registry.order(table)` gives a table's ids in definition order, so the core never iterates an object's keys (§3.1).

**Every entry carries:**
- `built`: `'M3'` or `'M4'`, the milestone that builds it (§11);
- `ready`: `false`; `'unit'` once its scenarios pass with the other systems' hooks stubbed or driven directly; `true` once the joined-up scenarios pass;
- `tests` (scenario files under `test/`) and `inv` (its invariant file, `test/behaviour/<inv>.inv.js`);
- for an id with a clause: its parameters (`params`), its Behaviour-line clause template (§5.3), the event kinds the clause accounts for (`covers`), and its pictogram.

`tools/lint-registry.js` fails the build when:
- there are more than ten universal systems;
- an id is unknown or duplicated, or (from M3) a `built: 'M3'` id is referenced by no pack, scenario test or arena fixture. A pack references the archetype, trigger and modifiers of each of its species, that archetype's special, inflicted statuses and wake clause, its role's clause (if the role has one), its items' primitives, instrument (with an instrument's `charges`) and weapon or garment clause, and the consumable kinds it labels; a scenario test references an id when one of the files its entry names in `tests` names it in quotes (`'id'` or `'TABLE.id'`); an arena fixture references one when a stamp in `test/arena/` names it as a word. So an id only the core reaches (a refusal code, a glass, a seal) is referenced by the scenario that makes the core reach it;
- a pack uses an id not in the registry, or an item primitive outside §8.5's set;
- a Behaviour-line clause has no test: an entry at `'unit'` or above names no tests, or a test or invariant file that does not exist, or an entry at `true` names no joined-up scenario file (`test/behaviour/*.test.js`); with `--strict` (M3's acceptance), any `built: 'M3'` entry is below `true` or lacks its tests or invariant; with `--strict --follow-ups` (the joined-up scenarios' done condition in Wave 2a), such an entry passes while `test/behaviour/follow-ups.json` (`{"TABLE.id": "the follow-up"}`) holds an open follow-up for it, and a follow-up for an entry that is at `true`, or is not an M3 entry, fails;
- a clause template names a parameter, special or status its entry does not define, or a pack species' line cannot be filled at some depth 1–7;
- an event kind or a (kind, cause) pair has no schema or no sentence, or the kinds differ from §4.3;
- a species has more than one special trigger;
- a department owns more than two modules;
- a pack's Intro teaches anything but its signature module (from M4, which builds the modules and the Intro's panels; M3's lint does not check it);
- an image or vendored file is missing from the asset ledger.

### 5.2 What a department pack holds

A pack is data: `content/S9.js` registers one object with `Packs.add({…})`. It holds:
- **The card:** accession, title, family, challenge claim (primary and secondary types), house rule, and placard blurb.
- **The programme and its knobs,** the Intro stamp (an ASCII map with a legend), and the gallery list with role keys.
- **The palette:** material, accent, wall and floor colours, checked against the reserved semantic colours.
- **Modules,** with parameters.
- **Species:** the archetype, at most two modifiers, at most one special trigger, a role, the skin (name, silhouette, sprite ids), the label (tombstone fields and a paragraph of 40–70 words; the M2 paragraphs taken from the samples are kept as written, nine of them shorter or longer, and `test/m3-content.test.js` pins which), and, where a rule reads them, a `group` (the exhibits an `ally_hit` trigger listens to) and `modParams` (a modifier's own values, such as `old_repair`'s side).
- **Items:** equipment and the Signature piece, with their primitives and labels, each `{ id, kind, form?, instrument?, prims, name, tomb, paragraph }`: `kind` is `weapon`, `garment`, `curio` or `instrument`; `form` a weapon's (`light`, `balanced`, `heavy`, `reach`) or a garment's (`light`, `standard`, `heavy`); `instrument` one of `fork`, `pin_driver`, `pole`; `prims` a list of `{id, cls}`, a primitive with its magnitude class S, M or L. Every primitive must be one the slice implements (§8.5). An item has no tier: its tier is drawn from depth when it is placed (§8.1), and an instrument's charges and recharge come from its row in §8.10.
- **Local names** for the 8 seals, and identifying labels for the 8 consumable kinds: `consumables: { names: [8 local names, one for each seal: the 4 Solutions' seals, then the 4 Ephemera's], labels: { <kind>: paragraph } }`. Since the seals are shuffled every run, a local name never names a kind or a seal family, nor a thing that one of its pack's labels describes (its main noun is in none of them); a label (40–70 words) names its own kind, no other, and no local name, and says its kind's effect in words, never another kind's.
- **The Centrepiece:** form, core, attachments, phases, gateway label, and lectern position.
- **Panels:** the intro panel and the section panels.
- **The audio motif** (M6).

**Shared species** belong to no department: the Night Watchman (`content/watch.js`) is registered with `Packs.addShared`, and an actor's species is looked up in its department's pack, then its Centrepiece, then the shared species (`Packs.speciesFor`), so labels, the view model and the lint treat it as any other.

**Numbers come from depth, never from the pack.** A pack names roles and magnitude classes (S, M, L), and the role curves (§8.10) turn them into numbers at the department's depth. A pack may override a number only through a named field the lint lists in the department's report, so every override is visible.

### 5.3 Behaviour lines are generated

- **A label's Behaviour line is assembled from clause templates,** one part for every registry id the species uses (`Clauses.of(sp, {depth, rulesOff})`; `Clauses.line` joins them):
  - the archetype's clause ("Walks one tile at a time and strikes from beside you for {dmg}.");
  - its special's clause and each status it inflicts, set inside the archetype's clause where it says `{special}` and `{status:<id>}`;
  - its role's clause, when the role has a rule of its own (`CLAUSES.role_<role>`): only the brute's, "Each of its blows takes {COST_ATTACK_HEAVY} ticks, not {COST_ATTACK}." (§8.1); a role whose numbers only fill other clauses (`role:HP`, `role:DMG`, a curve) adds none;
  - each modifier's clause, unless `rulesOff` switches the modifier off;
  - the wake clause ("Wakes when you stay inside your ring or make noise near it", or, for a species that gains no pips, "Wakes only when it is opened, bashed, dissolved or struck"), joined to the special trigger's clause; a trigger that stands instead of it ("It never sleeps.") replaces it;
  - any module flag's clause (M4).
- **Parameters are filled at the department's depth:** `N:KEY` is a number of record, and `N:KEY[i]` one of its values; `curve:KEY` is a role curve at the depth; `role:HP` and `role:DMG` are the species role's health and damage range at the depth; `mod:NAME` is a value the pack gives the modifier (`modParams`); `lock:GLASS[i]` is the locks a case of glass i + 1 can have at the depth (§8.3: its glass's range, never above the depth + 1), so a case's label never names a lock its department cannot hold. So "strikes from beside you for 4–9" names the numbers a blow can roll.
- **Event kinds that need no clause** are the ones any exhibit may cause or suffer (`Clauses.UNIVERSAL`: moving, doors, noise, pips, waking and mode changes, damage and death); blows, specials and statuses are covered by the clauses of the archetypes that make them.
- **The panel shows it under the title,** above the literary paragraph, and the strip shows it in runs 1–3 (DESIGN default 24).
- **Length.** The longest line in the packs, with depth 7's numbers, must fit the strip at 390×844 at every text size and leave the board at least 40% of the window's height (`check-screens`); a clause that would break this is reworded, never cut.
- **Each clause is checked four ways:**
  1. **An invariant.** Each clause has a predicate over the state before a step, its events, and the state after, in the invariant file its entry names (`test/behaviour/<inv>.inv.js`). The file exports `(C) => ({id, applies(actor, state), check(pre, events, post, ctx)})`, or a list of them, one per clause; `check` returns null, or a message saying what broke the clause. `tools/invariants.js` loads every file and checks each invariant after every step of every monkey, soak, scenario and bot run, once for each actor its `applies` accepts (an actor already gone when the step began is skipped; one created during it has no `before`); a violation prints the clause, species, seed, step and replay.
  2. **Scenarios** in `test/behaviour/`, written as functions of the clause's parameters and run for every species and depth that the three packs and the Exit produce, with pack overrides applied; a clause no species' line has (a status's, a surface's, a consumable's, an item's) is run at every depth 1–7 in a room of its own, and its scenario may name its entry `'TABLE.id'`, which takes the parameters of that table's entry. The scenarios that put an entry at `ready: true` run joined up: the room is made as a test makes it (its map, actors, items and statuses, what you know and where you stand), and from then on only real actions are played, in the real core with every rule in place and nothing stubbed; every invariant is checked after every step, and every event must pass its cause schema and read as a clean sentence. Beside them a file may keep unit-level tests that plant a hook or call a rule directly, to time or isolate it (an action of each length for the status timing table, an exhibit that only marks its ring), and tests that plant a fault to show that a check catches it; each says what it plants. Every refusal code M3 gives is made to happen by a real action at every depth 1–7 (`behaviour/refusals.test.js`).
  3. **Sensitivity.** Each module and modifier clause's scenario is rerun with `rulesOff`, and must then fail; the harness's sweep reruns every scenario of a modifier's clause so, and `test/behaviour.test.js` runs each M3 modifier's scenario files and fails unless they make such reruns. A scenario that shows what a modifier leaves as it is (marble's blows, the sides an old repair does not cover) holds with it off as well, and says so, with why, instead of being rerun.
  4. **Completeness.** Every registry id a species uses (archetype, a role with a rule of its own, modifiers, trigger, special, module flag, inflicted status) contributes a clause part (`test/behaviour.test.js` checks it for every species at every depth, and with each modifier switched off), and soak runs flag any event kind an actor causes that is neither universal nor covered by a clause of its line.

  Vague words are not allowed in a clause: "strikes hard" names its number class from §8.10. A Behaviour line therefore cannot say anything the code does not do.
- **Paragraphs carry no rules** (D10: "a paragraph that is only for reading"). A paragraph may echo, in the museum's voice, something its Behaviour line already states; it never adds a rule. The samples' Essential lines that describe systems the slice cuts (light, lamp cones) are rewritten as flavour. The paragraph lint (`test/m3-content.test.js`) checks every string in the three packs and in the shared species: a number, in digits or in words (hyphenated or not), next to a rule word (tiles or paces, turns, damage, %, pips, HP, Padding, Acc, Eva, charges, range or radius, rank or level, times, or a grade word), or a blow's damage ("strikes for 3"), fails, unless the species' own Behaviour line states the same number of the same thing, so the Brooder's "two paces from the nest" passes on its line's "2 tiles". Plain digits stay legal, as in "Round Book 3". The lint finds numbers, not every rule: a rule in words alone is caught where the test knows the rule, in each identifying label (its kind's effects, and none of another kind's) and in each item's paragraph (nothing its item does not do).

### 5.4 Modules: the event–condition–effect form

DECISIONS D2: the rules are fixed; invented rules wait behind opt-in doors. The slice still writes its modules in the small form that future invention would target, because the form is also what makes Behaviour lines and section-panel sentences derivable and checkable.

```
{ id, params, sentence,                          the panel sentence, a template over params
  rules: [ { on: <event or 'turn' or 'period'>,
             when: <predicate over the event, tiles, species, flags>,
             do: [ <effect> … ],                 a closed set: status, surface, wake, pips,
                                                 move, special, alarm, clock, tier, flag
             telegraph: <what is shown first, and for how many turns> } ],
  bespoke: <name of a hand-written function, or null> }
```

**When a rule does not fit the form,** the module uses `bespoke`, with a hand-written sentence and a scenario test. The validation log records which modules needed it, as evidence for D2's research track.

**The five slice modules:**

| Module | Department | The sentence the player is taught | Parameters (slice) |
|---|---|---|---|
| `unobserved_motion` | S.9 | "The animals move only when you cannot see them." | flagged species; 2 tiles a turn while unobserved |
| `alarm_network` | S.9 | "The waders raise the alarm when they see you; then the whole court is awake." | 2 patrolling exhibits (the Waders); see below |
| `copies_weaken` | A.4 | "When an original is broken, its spares lose heart." | groups of 3–4; see below |
| `hourly_demonstration` | M.11 | "On the chime, the stations exchange signals down the length of the gallery." | see below; every forced crossing has a window of at least `DEMO_WINDOW` (3) turns, checked by a layout validator |
| `weather_cases` | M.11 | "Some cases hold weather. Break one, and the weather gets out." | about 20% of cases; fog (blocks sight, 10 turns) or rain (soaks a 3×3 for 10 turns; a soaked clockwork exhibit stops for 2 turns) |

**"Unobserved" is defined once:** the exhibit's tile is not in your line of sight within your sight range. You see all round (DESIGN default 7). There is no facing. An unobserved mover checks before each of its steps; it may end a step in view, and then it stops for the turn.

**The alarm** (`alarm_network`). When a Wader sees you and no alarm is running, it telegraphs for one turn, then calls: a crash at its tile, and every sleeping exhibit in the department except the Centrepiece wakes awake, investigating your tile at the moment of the call (cause: alarm, and the Wader's uid). For `ALARM_TURNS` (30) turns pips do not decay, awake exhibits do not return, and no new alarm can be raised. Each alarm moves the next clock stage `ALARM_CLOCK_ADVANCE` (30) turns earlier, never earlier than the next turn boundary.

**Weakened spares** (`copies_weaken`). Exhibits have no tier, so "losing heart" is stated directly: when an original dies, each of its spares, and any body split from them, loses `COPY_WEAKEN_PCT`% of its maximum and current health and of its damage (rounded down, at least 1), loses `COPY_WEAKEN_ACC` Acc, and gains the `slowed` status for the rest of the visit. The A.4 Centrepiece's surviving copies use the same rule. A scenario test checks it at depth 1, where A.4's Intro teaches it.

**The chime** (`hourly_demonstration`). The module counts turns from department entry, not the clock, so it keeps running in a sealed hall; all stations share the count. When the turn is `DEMO_WARNING` (2) short of a multiple of the period, a chime sounds and every station wakes (cause: period) and marks its line; this two-turn telegraph replaces the one-action telegraph of other specials. The line resolves on the multiple, dealing `DEMO_LINE_DMG` (gross, §8.1), and the station returns to sleep with the pips it had. A station never hunts or leaves its rail: woken by anything else it goes awake and still acts only on the chime. Periods: `DEMO_PERIOD_INTRO` (8) in the Intro, `DEMO_PERIOD_HALL` (8) in the Centrepiece hall, `DEMO_PERIOD` (12) elsewhere. The module's sound is a chime, never "the bell", which is the clock's.

### 5.5 The slice departments, trimmed

**Every department is Cabinet size (5–7 rooms):**
- an Intro gallery, entered from the west; its first tiles are the vestibule, and every tile within 8 walking tiles of the entrance is the safe zone, where no hostile is placed (`design/layout.md` §7.1);
- two to four section galleries;
- the Centrepiece hall;
- a coda with the exit doors.

The samples list more galleries than a Cabinet holds. Each pack maps its sample galleries onto the generated rooms by role: the Intro contents into the Intro, the samples' study-room contents into the last section in tour order, and the rest in tour order. Measured at M1, `L_tour` runs 49–80 (p5–p95), which puts the bell at about 220–300 turns.

Species, items and labels come from `design/samples.md` §§2–4, with these trims.

**General trims:**
- A modifier's effect is the vocabulary's sentence (`design/vocabulary.md` §3) minus any clause that needs a system the slice lacks: fire, light, or damage kinds. The registry stores the trimmed sentence, and the Behaviour line is generated from it.
- `textile`, `luminous` and `paper` have no slice effect and are dropped from the species that carried them.
- Item primitives outside the slice's set are replaced with one in it, of the same budget, or the item is cut. A budget counts S as 1, M as 2 and L as 3, and a flag (`reach`, `quiet`, `breaker`) as 2, as the samples price them; each of the slice's instruments counts as 2, the Pin-Driver's price as the sample's `bolt(edge, M)`, so a sample instrument worth less (the Stamp Moistener's `bolt(water, S)`, 1) is cut. A weapon keeps its sample's form (Balanced where the sample names none), so a flag never becomes the Reach form. Signature pieces wait for M4.

**S.9 (sculpture court):**
- Grazers (`unobserved_mover`), Waders (`patrol_guard`), the Dawn-Caller (`herald`), the Brooder (`tethered_warden`), the Cabinet-Backed Tortoise (`mimic_vitrine`) and Hoppers (`darter`).
- The Waders are exhibits on two patrol routes, with no lamp cone: they see as every exhibit sees.
- Items: the Overshoes' `muffled` becomes `quiet`; the Long Tongs' `knockback` becomes Acc; Round Book 9's `perception` becomes Eva; the Spring Pin-Driver is kept.
- The Intro gallery is redrawn for all-round vision: a corridor with staggered plinths, so walking past the Grazer breaks sight of it unless you route to keep it in view.
- The Day Curator's Lamp becomes a toggled curio, taken hooded. Lighting or hooding it costs 100 ticks. While it is lit, exhibits within `LAMP_OBSERVE_RANGE` (4) of you count as observed, even out of sight, and your ring is `LAMP_RING` (1) larger, which stands in for the sample's drawback that you are never in the dark. Any range of 3 or more means a Grazer cannot reach you while the Lamp is lit, so the larger ring is the price; the paired bots check that Lamp-lit play is not strictly better in S.9.
- The Centrepiece is a treasure, the Composite (`completing_guardian`) standing over the Lamp in a Security case (Laminated at depths 1–2, §8.3):
  - carrying the Lamp out of the hall alive is S.9's form of defeating its Centrepiece: it earns the Certificate and the Signature piece. The placard and the Composite's Behaviour line say so;
  - viewing earns the Certificate alone;
  - a treasure hall does not seal when the Composite starts hunting. It seals `TREASURE_SEAL_TURNS` (12) turns after the case is touched, or when the Composite falls to `TREASURE_SEAL_HP_PCT` (34)% health, as in `design/samples.md` §3.8. Crossing the hall's threshold with the Lamp before then, or leaving by Re-admission Ticket while carrying it, counts as carrying it out;
  - the sample's phase 2 is trimmed to "the Composite gains one stage; if `alarm_network` is on, the alarm is raised". Security lighting is dropped with light.

**A.4 (case labyrinth):**
- Seated Clerks (`plodder`; the original `marble`, its spares `plaster`), the Proposing Trustee and spares (`splitter`), Carbon Flimsies (`mote_swarm`) and the Countersigning Clerk (`conservator_healer` + `clockwork`).
- The Spirit Duplicator takes the sample's own fallback: a `herald`, "Copying-Room Bell".
- The `ally_hit` groups are the clerks (the Seated Clerk and its spare) and the trustees (the Bust and its spare).
- Items: the Date Stamp, Light as in the sample, swaps its `sweep` for the `reach` flag; the Sleeve Protectors' fire resistance becomes Eva; the Register takes the sample's own fallback without L+, `perception(M)`, as Acc; the Paperweight is kept; the Stamp Moistener is cut, since it is worth 1 and each instrument 2.
- The Centrepiece is the `mp_ensemble` fight described in `design/samples.md` §4.8, with its gallery hooks.

**M.11 (enfilade, with a parallel staff corridor):**
- Heliographs (`axis_sniper` + `glass`), Semaphore Stations (`demonstrator` + `clockwork`), Signal Lamps (`kiter` + `old_repair`), Reflecting Dishes (`reflector`) and Logbook Trolleys (`plodder`).
- `glass` keeps its shards (the one shard rule, §8.3) and its reflection, which turns back shots as well as beams, as a reflector does (§8.1); it drops "blunt ×1.5" (a damage kind) and "its body does not block sight" (no body blocks sight, §8.2).
- `old_repair` doubles the damage that comes from its repaired side, after Padding and the minimum: `max(DMG_MIN_ON_HIT, raw − Padding) × OLD_REPAIR_PCT %`, and the cause says `side`. The side is a compass point in the species' `modParams` (the Signal Lamps': west). Damage comes from it when its `from` tile (§8.1) lies toward that point, or either point beside it (for west: north-west, west and south-west), seen from the body's nearest tile; so a blow, a Reach blow, a shot or a beam from that side counts.
- The Centrepiece is the `mp_tableau` fight in `design/samples.md` §2.8, with rain jars when `weather_cases` is on.
- Items: the Hand Lamp's bolt of light becomes the Pin-Driver's ranged attack; the Smoked Apron's armour and light resistance become Padding; the Signal Flag keeps its `reach` flag, on a Balanced weapon, since its sample names no form; the Spare Lamp Hood is cut, since it needs light.

**Archetype count:**
- 14 non-Centrepiece archetypes, plus `night_watchman`, plus three Centrepiece cores (`completing_guardian`, `mp_ensemble`, `mp_tableau`).
- M3 builds eleven: `plodder`, `darter`, `kiter`, `axis_sniper`, `splitter`, `mote_swarm`, `herald`, `tethered_warden`, `reflector`, `mimic_vitrine`, and `night_watchman` for the clock.
- M4 builds the rest with the modules.
- **Until M4, a department places only species whose archetype M3 builds, and no Centrepiece,** since the others' Behaviour lines could not yet be true (§5.3). The stand-in placement puts one of each such species in the sections and studies, outside the safe zone; a `mote_swarm` comes as `SWARM_BODIES[0]` bodies, on the nearest free floor tiles of its room. M4's population places the rest.

---

## 6. The board views: top-down and 3D, and how to revert

Julian's answer: try the 3D view, built so that going back to top-down is easy. The design makes the 3D view a second renderer of the same view model, never a second game, and gives it its own milestone (M2b, §11) so that it can never hold up the core.

### 6.1 The view model

`ViewModel.derive(state, ui) → vm` is pure and lives in `js/core`, so it is tested headless. It holds:
- the map size and its tiles: each tile in view as it is now, each remembered tile as you last saw it (`dept.seen`, written for the tiles in view at the end of every step), and each tile you have never seen as `' '` (masked), so a board rebuilt from the view model shows only what you have seen: a door an exhibit opened out of your sight shows shut until you see it again (the log only says a door opened nearby, as its noise). Reading a Floor Plan remembers every tile as it is then, and an arena's `seen: all` every tile as built;
- per tile: unseen, remembered or visible, and inside your ring;
- the actors on visible tiles (and you), each with uid, position, size, sprite id, mode, pips, whether it is hostile, the special it is marking, its statuses and whether it stands in an intact case; never one that shows as something else (a mimic in its disguise, which is listed as the case it looks like);
- **marks,** one a tile of each kind: telegraphed tiles with their exact damage to you, and a herald's call, on visible tiles; noise rings: the noises made since your last action that took time (all of a long action's turns, such as a garment's three), on the tiles an exhibit could stand on (`Grid.hold`) that each reached as hearing measures it, so walls and fixtures are not marked, and on tiles you see or remember, each measured on the map as it stood when the noise was made (a door opened later in the turn does not widen it), the loudest class where two noises reach a tile; an action that takes no time (a refusal, such as a bump into a wall, or a free read) leaves them as they were, as it leaves your ring (§8.2); the tile you aim at and a thrown Solution's square round it, its own kind's once you know the kind and, while you do not, the largest any Solution has (5×5, the area §8.6's throw refusal measures), so the square says nothing of the kind; the path preview; the selection;
- what stands or lies on visible tiles: cases (a mimic's disguise exactly as a real case, with no accession number), staff doors and their grades, items (a consumable by its seal's shape), identifying labels and surfaces;
- your health, grade, statuses, kit, tote and charges; the clock; once a Floor Plan is read, the rooms that still hold a Highlight;
- the camera target: you, leaning at most two tiles towards a telegraph that covers you;
- one-turn animation cues (the tile an actor moved from, only where that tile is in view; hit flash; glass that broke in view; a special gone off), from the same events as the noise rings: those of your last action that took time.

**It holds no field that only one renderer reads.** Wall and fixture heights, billboard sizes, silhouettes and camera placement are computed inside each renderer from `vm.tiles` and `vm.actors`: these are drawing choices, not game decisions. A test lists every vm field and the renderers that read it. Neither renderer reads `state`, computes visibility or decides anything.

`coreHash` (§3.6) covers `js/core` and `content/` except `viewmodel.js`. Because the bots read the view model (§10.2), sim output also records `vmHash`, a hash of `viewmodel.js`.

### 6.2 The renderer interface

```
Views.register(id, label, factory)   factory(host) → renderer
Views.list()                         → [{ id, label }]; the settings line is built from it
Views.active()                       → { id, note }
renderer.ready                       Promise: resolves when it can draw; rejects on a failed load, which falls back
renderer.draw(vm)                    draw one frame; called only when the vm, the zoom, the size or a cue changes
renderer.pick(clientX, clientY)      → { x, y } or null (below)
renderer.tileRect(x, y)              → { centre, rect, tapRadius } in CSS pixels
renderer.zooms, renderer.zoom        the view's zoom table, and the index in use
renderer.setZoom(index)
renderer.setInset(px)                how much of the board's foot the phone's label sheet covers; the camera centres in the rest
renderer.inspect()                   → [{ kind: 'tile' | 'actor' | 'mark', id, x, y, rect }] drawn in the last frame
renderer.idBuffer(opts)              3D only: → { w, h, ids, legend } for the occlusion check; { floorOnly: true } draws the
                                     floor alone, { scene: true } the floor and what stands on it, and the default adds every
                                     actor and mark, each legend entry recording its pixels alone and those shown over the scene
renderer.dispose()
```

**On the board.** An actor counts as on the board when at least a quarter of its square shows each way in the part no interface covers; a hostile on the board keeps its hostile bar inside the part that shows, and any other hostile in sight gets an edge arrow, slid along the edge clear of every actor and other arrow.

**Canvases.** Every canvas a view draws is a whole number of device pixels, and its box on the page exactly that size divided by the pixel ratio, so the page never resamples it: a board of fractional height would otherwise blur the pixel art and shift each mark by up to a device pixel.

**The display list.** Both views build their overlays with `Marks.list()` (`js/view/marks.js`): surfaces, the ring, calls, noise rings and a Solution's square, the moved-from cue, the path preview, telegraph fills, case glyphs (the lock with a bar per grade, cracks, what a case holds or the empty frame of a loan), staff-door grades, labels and items (each of these glyphs of what stands or lies on a tile sits on a dark backing, black at 45% or more and the lock on black, a crack over a wider dark line, so that no wall, floor or glass, however pale, hides it: over its backing on any department's walls, floors and glass each glyph's colour has WCAG contrast 3:1 or more; a lock's bars are each at least 2 pixels wide with a pixel between, at every zoom of both views), actors back to front, each actor's marks (its bar; its glyph row above it, or beside its head where another actor or another's row is above, so it never covers one, and, only where both sides are taken too, shrunk to fit along the top of its own square; its hit cue, the cue of its special gone off and its selection), the aim, glass that has just broken, a selected tile, edge arrows for hostiles off the board, and the telegraph numbers last. Every colour that carries meaning is a reserved one, and every mark's meaning is in its shape too. Each item carries its own paint function, so a view paints the list, `inspect()` reports it, and the 3D id buffer repaints each item alone, so the checks measure exactly what was drawn.

**TopDownView** (`topdown.js`, Canvas 2D) is the reference:
- 16×16 art drawn at 32 px a tile on a phone (2×, 12 tiles across 390 px), with a second zoom step at 48 px (3×, about 8 across);
- three-quarter wall faces;
- `pick` is the tile under the pointer.

**Board3DView** (`board3d.js`, three.js):
- **Camera:** orthographic, 60° above the floor, from the south, so north stays up as in top-down. Scale s is CSS pixels per tile edge, the same everywhere on screen; a tile shows as an s × 0.87s rectangle. Zoom table: s = 40 and s = 52, the second giving a 44-px disc inside each tile.
- **Units and heights.** One tile edge is 1 unit. Walls, door frames, staff doors and columns 1.2; partitions and shelving 1.0; vitrine base 0.25 with glass up to 0.85; plinth 0.5; bench 0.3; lectern 0.7. From due south at 60°, a block of height h hides h ÷ tan 60° of the tile behind it. The probe's 1.5 hid 1–2% of the floor from the south-east, but from due south it would hide 87% of every room's back row and fail the occlusion check; 1.2 hides 69%.
- **Actors and overlays are never hidden.** Sprites (16×16, nearest-neighbour, standing on the south edge of the actor's footprint: n·s wide and s·(n·sin 60° + 1 − sin 60°) tall, so an s × s square for one tile, and a 2×2 Centrepiece reaches no further into the row north of it than a one-tile figure does) are drawn on a 2D layer above the WebGL scene, back to front, and so are the overlays: telegraphs and their numbers, the hostile mark, pips and state glyphs, the selection, the ring and the path preview. Both views draw these with the same code (`js/view/marks.js`), so they look the same. Walls can hide floor, never a visible exhibit or a mark. There is no cutaway and no x-ray in the slice; the occlusion check (§6.3) says whether one is needed.
- **Lighting:** faces are shaded by direction (tops in the palette's top colour, south faces in its wall colour, the sides darker), a fixed light baked into the vertex colours, with no shadows, so that no lighting effect implies a line-of-sight rule.
- **`pick`** returns the anchor tile of the nearest actor with an opaque sprite pixel under the point; otherwise the floor tile where the ray meets the floor plane, ignoring walls; otherwise null.
- **Budget.** Device pixel ratio capped at 2, antialiasing off, and it renders only on change.
- **Context loss.** On `webglcontextlost` the board shows the top-down view at once; on `webglcontextrestored` the 3D view rebuilds from the last vm.

### 6.3 Switching, fallback, and the revert test

- **The switch.** Settings has one line, "Board: Flat / 3D", built from `Views.list()` and hidden when only one view is registered. Switching rebuilds the renderer at once; the game state is untouched.
- **The fallback.** If `board3d.js` is absent, three.js fails to load, or WebGL is unavailable, the registry falls back to top-down and the settings line says why in one sentence.
- **Input is the same in both views.** Walking confirmation is its own setting, "Walk: one tap / tap twice", independent of the board, default one tap. Renderers have no input rules.
- **Reverting is one script,** `tools/remove-3d.sh`. It deletes `js/view/board3d.js`, `vendor/three/`, `tools/vendor-three.sh` and `tools/browser/check-3d.mjs`, the two tags in `index.html` (the `board3d.js` script and the inert three.js placeholder, §6.4) and the `vendor/three` entries in the asset ledger. Nothing else needs editing: `build-single.py` has one generic rule for any `<script type="text/x-…" data-src>` placeholder, the settings line disappears with the second view, and tests that cover several views loop over `Views.list()`.
- **The revert test.** `check-all.sh` copies the repository to a temporary directory, runs `tools/remove-3d.sh` there, then builds and runs the Node tests and the browser smoke and screen checks there. They must all pass.
- **The guard.** A test scans `index.html`, `js/`, `css/`, `tools/`, `test/` and `art/` for `board3d`, `Board3D`, `THREE`, `x-three`, `vendor/three` and a `'3d'` id, and fails on any file not in the allowlist committed beside the script.
- **The 3D checks** (Playwright, Chromium with software WebGL, which works here through SwiftShader) run on fixed scenes in all three slice programmes, at both zoom steps, at phone and laptop size, and each first asserts that `Views.active()` is the 3D view, so a silent fallback cannot pass them.
  - **Occlusion.** From `idBuffer()`: fail if more than 2% of the visible tiles without a mark (the faint rings of a noise, a call and a Solution's square do not count, since the floor shows through them) show less than 25% of their floor pixels (a tile's own case, plinth or bench counts as showing it), or if an entrance or exit whose tile lies wholly in the clear part of the board shows none of its mat. Marks and actors are drawn on top: each mark shows at least 90% of its pixels as itself, as another mark (one drawn after it, or a telegraph's number) or, for the marks §6.2 draws beneath the actors (the path preview, a telegraph's fill, calls, noise rings, a Solution's square, and the glyphs of what stands or lies on a tile), as an actor drawn over it, and never as the scene; every actor wholly on the board shows at least 75% of its pixels as itself (a nearer actor drawn over a farther one is depth, within that allowance); the 2D layer is the topmost element over each of them; a screenshot of the page shows at least 95% of the 2D layer's fully opaque actor and mark pixels in the clear part of the board in the colour painted there (so a 2D layer hidden by opacity, a filter or a blend mode, set off the board, or resampled by the page fails); and the overlay canvas matches a reference painted from the same display list, item by item in order, at 98% of their pixels (at a device pixel ratio of 1 and of 2). One scene stands you directly north of an exhibit you have just struck, a 2×2 Centrepiece where one can be reached, and is measured again with telegraphs on your tile, on the exhibit's tiles and on a free tile beside you. Two more are staged round you and measured at both zooms: an opened case, a broken one, shards and an open staff door, with a cracked case, a noise ring and a herald's call; and two awake exhibits in a column, the farther in a case and the nearer marking a special.
  - **Tap tolerance.** For every visible tile on screen, the radius of the largest disc round its centre in which every sampled `pick` returns that tile, or an actor standing on it (as `research/isometric.md` §1 measured). Fail if the 10th percentile is below 12 px at the default zoom or below 22 px at the 44-px step. The same check runs in top-down.
  - **Consistency.** Every actor and mark in the vm appears in `inspect()` with a rect inside the board, in both views.
  - **Context loss.** `WEBGL_lose_context` forces a loss and a restore; the board keeps drawing.
  - **Cost.** Frame time and load time are recorded, not gated, because this environment has no GPU. Julian's phone and Mac numbers go in the validation log, and the phone check includes leaving the page in the background for a minute mid-department.
- **Default.** Top-down stays the default until the slice gate, where half the players start in each view and the gate decides (§11, M7).

### 6.4 Vendoring three.js

- **The build.** `tools/vendor-three.sh` pins three@0.180.0 (r180, the version the probe measured) and esbuild@0.25.10, bundles an entry that re-exports only the names `board3d.js` uses, minifies it into an IIFE that defines `window.THREE`, and writes `vendor/three/three.iife.js`, `LICENSE` (MIT) and `VERSION` (the versions, the output's SHA-256 and its size). The output is committed; the build does not touch the network.
- **In development,** `index.html` holds an inert placeholder, `<script type="text/x-three" data-src="vendor/three/three.iife.js"></script>`, and `board3d.js` loads that file with a new script element when 3D is first chosen; `renderer.ready` waits for it.
- **In `dist/accession.html`,** it is inlined as an inert block, run on first use by copying its text into a new script element. It is not compiled until 3D is switched on, but every load downloads it; the validation log records the dist size with and without it.

---

## 7. Input and interface

### 7.1 One input model

**Taps:**
- **A tile:** walk there. The walk stops when a hostile comes into view, a pip appears on a visible exhibit, a telegraph appears, or an event names you. As built (`js/main.js`): it stops after a step whose events the log tells you of and that include a refusal, a door opened, a hunt begun, a hit or a miss, a death, a mark, a waking, an alert, a clock stage, an arrival, a case opened, cracked or broken, an item taken or used, a seal identified, or a status of yours beginning or ending; when an exhibit in view changes its mode or pips, or one comes into view that you have not seen this visit or that is not as you last saw it (its mode, pips or tile), never for one going out of view or one you have seen coming back into view as it was; when a new mark appears; on the first loud tile it brings you onto; and where the next tile is taken. A step that needs a confirmation (below) ends the walk: the sheet asks, and its answer takes that one step or none.
- **An exhibit or object,** adjacent or not: examine it and select it. The strip and panel show it, with its action as a button ("Attack: 75%, 3–5 damage"; "Open: Grade III"; "Break the glass: loud"). Tapping a selected adjacent exhibit again does its first action, which for a hostile is Attack. A case, an item on the floor, an identifying label and a staff door are selected the same way, and tapping what is selected does its label's first action (Open, or on a case your grade cannot open Break the glass, which asks first; Take; Read; Open or Close a staff door); with none, the next thing on that tile is selected (a case under the exhibit standing in it), or, where you can stand, you walk there. Every label button acts through the same confirmations as a tap.
- **Yourself:** Wait, Rest, Sit on a bench, and Leave on an exit.
- **Tapping yourself** shows your label with those buttons, and tapping yourself again waits; an item lying on your tile is selected before you. Rest repeats under the walk's stop rules until you are at full health, or after one rest while no health can come back (the night watch); a rest that repeated leaves one line in the log when it ends, however it ends: the turns it took and the health that came back (`Text.rest`).
- **Walking confirmation** is a setting, "Walk: one tap / tap twice", the same in both views; with "tap twice", a tile tap previews the path and a second tap on the same tile goes.
- **Keys:** a direction key into an exhibit attacks it, as bumping does.

**Confirmations** come before:
- stepping onto shards (from a tile without them; a broken case's tile holds its glass, so it counts as shards);
- breaking glass (each blow, saying whether it cracks or breaks it);
- entering a Centrepiece hall;
- leaving by an exit (a minimal confirmation: the visit ends);
- any action that would leave you on a tile marked for damage by a special that resolves before your next decision (`Specials.threat`, §8.1), saying whose special it is and what it would deal you.

A confirmation is a sheet over the board, saying what the action would do in `Text.confirm`'s words (`main.js` decides when to ask, never what to say), with a button of at least 44 px that does it and one that cancels; Enter does it, and Escape or a tap beside the sheet cancels. An action `step()` would refuse is never asked about: its refusal says why.

**Everything works with one button:**
- no right-click, long-press, hover-only information or scroll wheel;
- zoom has buttons;
- a test drives the whole slice with left clicks only (§10).

**Keyboard extras on a Mac or PC, never required:**

| Keys | Action |
|---|---|
| Arrows, vi-keys or numpad | Move |
| `.` | Wait |
| `x` | Examine |
| `r` | Read the nearest label |
| `i` | Bag |
| `1`–`6` | Quickslots |
| `m` | Floor plan |
| Enter | Confirm |

### 7.2 Screens

**Portrait phone (390×844 CSS pixels):**
- **Top bar:**
  - health;
  - the stage chip ("Open: bell in N turns", "After the bell: night watch in N turns", "Night watch: next bell in N turns", in `Text.stage`'s words) and your statuses, each its pictogram (`Registry.STATUSES[id].icon`) with the turns it still covers, on a second row on a phone;
  - the clock dial, with the bell and night-watch segments and module countdowns beside it, its hand the clock's count and its label `Text.clock`'s sentence;
  - the grade badge;
  - the alarm bell, when a department owns one.
- **The board.** Nothing of the interface lies over it, so no button can cover a tile or a mark.
- **A two-row strip:** a short title with the state and pips, then pictograms. In runs 1–3 the Behaviour line follows (DESIGN default 24). The newest log entry (all the sentences one action produced) takes its place until the next action. Zoom is a button at the strip's right end.
- **Bottom bar:** Wait · Bag · Q1 · Q2 · Q3 · Map.
- **The label panel** opens as a bottom sheet. While it is open the camera centres you and the selected exhibit in the part of the board it leaves clear (if both cannot fit, it keeps you in view and leans towards the exhibit). Beside the exhibit, if you and it already fit in that part round the camera the board last used, the board stays put, so on a laptop a second click on the same point strikes it; on a phone, opening the sheet can move the board when they do not fit above it. Closing the label keeps the selection, so tapping the exhibit again still acts. An open label follows every action while what it names is in view (`ViewModel.shows`: an exhibit the view model lists; a case, staff door or identifying label on a tile in view; an item you carry or one in view); once it is gone or out of sight the label closes and the selection is dropped, since a label shows only what sight gives (§8.8), never an exhibit's health, mode or statuses behind a wall.

**Laptop:** the board on the left, with Wait · Bag · Map and Zoom under it; the strip with the last six log entries (newest kept in view), the label panel and six quickslots in a right column.

**The Bag** (`js/ui/bag.js`), opened by the bar's Bag or `i`:
- **What it shows:** what you wear, slot by slot, then your tote. A tap on an item shows its label (§8.8) with its buttons, each acting through the confirmations (§7.1). A Catalogue Card's choice, one button for each seal you do not know, opens the Bag by itself and stays at its top until it is answered; closed, it opens again when anything else is tried, since nothing else can be done first.
- **Quickslots** hold your instrument, then your consumables in the order of your tote: three on a phone, six on a laptop. An instrument's quickslot aims it (pressed again, it stops aiming); a consumable's shows it in the Bag with its buttons; an empty one opens the Bag.
- **Aiming at a tile** (a throw, an instrument): on a phone the strip's place, on a laptop the bar under the board, says what you aim and what a tap does, at a height set by the text size alone (enough for its longest words), so the board never moves between taps. The first tap on a tile marks it (with a thrown Solution's square, §6.1) and says what a second tap would do there, or the refusal `step()` would give; Enter does what a second tap would. The second tap does it, through the confirmations, or, where it cannot be done, is refused with that sentence, and the aim stays for another tile, as it does when a confirmation is cancelled. The aim ends once time passes, by its action or another (a Wait), so the strip it stands in for shows what happened; Cancel or Escape ends it too. Where the Window Pole can do more than one thing, the second tap opens a sheet with a button for each, in the order push, pull, take; while it asks, keys do nothing to the game, and a tap beside it cancels.
- **A Restoration kit** is aimed in the Bag: the items it can be used on are listed in `Kit.useLegal`'s order (what you wear in slot order, then your tote); a first tap on one shows what a level would give it, and a second uses the kit on it.
- **The floor plan** (the bar's Map or `m`): the department as you have seen and remember it, with you, the exits and the entrance; once a Floor Plan has been read in this department, all of it, with the rooms whose Highlights have not been taken outlined and numbered. A door, a staff door and a case each have a shape there as well as a tint (a band across the tile; a band with a dot; a frame, filled while the case is shut).

**Other screens:**
- the Entrance Hall;
- door placards;
- the Stair Hall;
- the perk choice;
- the death label and its recap (in M3 the recap, `Text.recap`, is an overlay with "Another visit", which starts the same department at the same depth with the next seed until M5's run; leaving shows the end of the visit's sentence with the same button);
- Your Collection;
- the Catalogue;
- Settings;
- "How the museum works" (the nine sentences with their icons, one tap from any screen).

**Accessibility:**
- **Colour.** At most six meaning-carrying colours, and shape always carries the meaning too.
- **Text.** Size steps; a readable-font option.
- **Motion.** A reduced-motion setting.
- **Sound.** Captions for every informative sound.
- **Off-screen threats.** Edge markers.
- **Telegraphs.** Auto-pan when a telegraph targets you.
- **Targets.** No interactive UI target (buttons, strip, panel, quickslots) smaller than 44×44 CSS pixels. Board tiles are exempt at the default zoom (32 px; D12 leaves comfortable tapping to zoom), but each view's zoom table includes a step with a disc of at least 44 px inside each tile (48 px in top-down, s = 52 in 3D), and the screen test checks that it exists.

---

## 8. Rules of record

These are the rules the slice implements. Each system opens with its sentence from [`DECISIONS.md`](DECISIONS.md).

### 8.1 Moving and fighting

*"Tap to move; bump into something to attack it. Ordinary blows roll dice, and the odds are shown before you commit. Dangerous moves are marked on the floor with their exact damage, and never miss. Your health recovers slowly."*

**Time:**
- **Ticks.** A turn is 100 ticks. Every awake actor has an integer `next`. The scheduler takes the smallest; ties go to you, then to actors in spawn order (§3.3). Sleeping exhibits are not scheduled.
- **Turn boundaries.** Turn k's world effects resolve at tick 100k, before any actor whose `next` is 100k acts, in this order:
  1. surfaces (a Fumigant cloud takes a pip from each sleeping exhibit inside; fog and rain in M4);
  2. status timers (statuses that have run their turns end);
  3. regeneration;
  4. wake checks (your ring, `axis`, `tether`), from your tile at tick 100k and the ring radius of your last action that cost time; then the statuses' per-turn effects (a cough's noise, restoring's healing), so that a noise they make comes after the wake checks (§8.2, one action's wake order);
  5. pip decay;
  6. the clock stage;
  7. alarm decay;
  8. module turn rules.

  Each step is one named function, called in this order by `Step.boundary` and nowhere else: `Surfaces.tick`; `Status.tick`, then `Kit.recharge`; `Health.regenerate`; `Wake.boundary`, then `Status.effects`; `Wake.decay`; `ClockRules.boundary`; `Modules.alarmDecay`; `Modules.turn`. Noise, damage and the other event triggers act at once, when their event happens.
- **Every action of yours that costs time costs at least a turn** (100 ticks; a Heavy blow costs 150), so at least one turn boundary runs between any two of your decisions, after your action has moved you and set your ring. `step()` stops with an error on an action that costs less. (M4's perks Duck and Cover and Close the Distance break this, and must restate the ring's timing and the status rule below when they arrive.)
- **An exhibit's action is charged after it acts:** its `next` becomes next + the action's cost, or the tick its action set in `notBefore`, if that is later (a special's mark holds its resolve until after your next decision; Specials, below). Nothing an exhibit does in its own turn writes its own `next`. Time only moves forward: every action of an exhibit costs time, and `step()` stops with an error on one that costs none, or on an actor scheduled before the present tick (one made during the visit without its beat).
- **Waking costs a beat.** An exhibit that wakes is scheduled to first act at now + its action cost. So is an actor made during the visit (the Night Watchman, a splitter's halves), which therefore never acts in the instant it appears.
- **An exhibit's turn,** in this order (`AI.act`): if it is fixed, its pending special is called off and it waits; otherwise it looks for you (it sees you as §8.2 says, and if it was not already hunting it now hunts you); a pending special resolves; its archetype acts, if it has something to do; otherwise it acts as its mode says (§8.2). Every turn it takes, a forced wait included, counts as one of its actions (`acts`).
- **Speed.** Fast actors pay half, slow actors double, for their steps; attacks and every other action cost the usual, unless the archetype says its speed covers every action (the mimic is slow at everything). The `slowed` status doubles every action again. An actor's speed is its archetype's, or a modifier's (marble is slow) unless that modifier is switched off; a fast archetype with a slow modifier moves at the usual speed.
- **Surfaces.** A surface laid for N turns (a Fumigant cloud, plaster dust) acts at the next N turn boundaries and is cleared at the boundary after them; while it lies, a sight-blocking one blocks line of sight across its square (§8.2). At each of those boundaries a Fumigant cloud takes 1 pip from every sleeping exhibit with a tile under it, at most one a turn however many clouds cover it, and nothing from one with none; plaster dust only blocks sight.
- **Statuses.** A status of N turns covers the N turns that start at its bearer's next decision. Once the action that put it on is over, it lasts until the boundary of turn `idiv(next, 100) + N`, where `next` is the bearer's next decision (for a sleeping exhibit, the next turn + N); its per-turn effect acts at the boundaries of those N turns, and it ends at the boundary of the last. A decision at tick t falls in turn `idiv(t, 100)`, because that turn's boundary runs before anyone who acts at its tick. So Fixative gives exactly 4 forced waits whatever the action before it, and a grip of 2 turns put on during a 200-tick open still holds you at your next 2 decisions. Put on again while held, a status lasts to the later end. What each does: `fixed`, its bearer can only wait (you may wait, rest or answer a choice already waiting), and blows against it have +20 to hit; `rooted`, you cannot step off your tile, though a bump that leaves you where you are (into a door, an actor or a case) is still yours; `coughing`, a soft noise at its bearer's tile at each of its turns, the bearer's own noise; `restoring`, its share of healing at each of its turns, 25% of maximum health over 5 turns in shares within 1 of one another, every 5 of them adding up to the total, never past maximum health (put on again while held, it heals at the same rate for longer); `slowed`, every action takes 200% of its time; `dazed`, its bearer's blows have −20 to hit.

**Action costs (ticks):**

| Action | Ticks |
|---|---|
| Step | 100 |
| Wait or rest | 100 |
| Attack | 100 (Heavy weapon or brute 150) |
| Open or close a door | 100 |
| Open a case | 200 |
| Bash glass | 100 (Heavy 150, counting as two bashes) |
| Take or drop | 100 |
| Use or throw | 100 |
| Equip, or take off (unequip) | 100 (garment 300) |
| Push a jar | 100 |
| Sit | 100, then rest at double rate |
| View | 100 per viewing turn |
| Read, examine | 0 |

**Hit and damage:**
- **Hit chance:** `clamp(75 + 5 × (Acc_attacker − Eva_defender) + mods, 10, 95)`. Roll d100 on the attacker's combat stream; a roll at or below the chance hits.
- **Modifiers:** +20 against a fixed target; −20 for a dazed attacker.
- **Damage:** a uniform roll in [min, max], minus the defender's Padding, at least 1 on a hit. Its sentence in the log shows the sum (the roll against the chance, the damage less Padding) and anything the defender's archetype or modifiers changed: through an `old_repair` exhibit's repaired side the damage is doubled, and a body that falls to any one blow loses all its health.
- **No critical hits.**
- **Shots** (a kiter's, the Pin-Driver's) are rolled as blows are. A shot's cause names it a shot (or, fired by an instrument, the instrument) with its range, and its damage comes from the last tile the bolt crossed before its target; an instrument's bolt is made with its own damage range and your Acc without the weapon's.
  - **A bolt** is aimed at a tile in line of sight within its range (a disc, as "within r" is, §8.2: `ROLE_ARTILLERY_RANGE` for an exhibit, the Pin-Driver's for you) and hits the first body on the line toward it. It passes only what can be seen through and is not glass, so nothing is shot into, out of or through a case. A shot is refused before it costs anything if its bolt would meet glass first (`behind_glass`, so a case, an exhibit in one and a mimic's disguise look the same), nothing at all (`no_target`), or if its tile is outside its range (`out_of_reach`) or out of sight (`blocked`).
  - **A reflector** (the `reflector` archetype, or a body with the `glass` modifier while it is on) is not hit by a bolt: it sends it back along the tiles it came by, into the first body on them, which is its shooter, so nothing behind the reflector is hit. The bolt sent back is rolled as a shot at its shooter, with the numbers it was fired with (the shooter's Acc and damage, or the instrument's), against the shooter's own Eva and Padding, on its own stream, never a surprise; it comes back at most once, and its way back does not count toward its range. Its cause is the reflector's (`reflected`), naming who fired it (`shooter`), and its damage comes from the tile next to the shooter on its way back.
  - **The kiter** keeps `KITER_HOLD` (3 to 5) steps from you, counted as it would walk to you, while it hunts and sees you. Its posts are the tiles 3 to 5 steps from you with a clear shot (you within its range, in line of sight, and the first body on its bolt's line); it walks to a post only by a way that never comes nearer than 3 steps to you, and its nearest post is the nearest by that way, ties in row-major order. Beside you, or nearer than 3 steps, it backs away; farther than 5, it walks toward its nearest post. Then, if it did not move and has a clear shot, it shoots; otherwise, 3 steps or more from you, it walks toward its nearest post, or, farther than 5 with no post to walk to, steps toward you; failing all of these it waits. So it never comes nearer than 3 steps of its own accord, and cornered beside you it shoots from there. With no way to walk to you it shoots whenever it has a clear shot, and otherwise acts as a plodder does, as it does out of sight or in an intact case.
- **Reach.** A Reach weapon also strikes a target exactly `REACH_RANGE` (2) tiles away in one of the 8 directions, over the tile between, which must be one you could walk onto and see through (not a wall, a closed door or a case, and not under a Fumigant cloud or plaster dust, which block sight) with no actor on it (refused `blocked`); a diagonal Reach blow keeps the corner rule on both of its halves (`corner`). So Reach strikes only what you can see. A target beside you is struck as usual. A Reach blow is a blow like any other: it comes from your tile, costs your weapon's blow, and never reaches into a case.
- **Surprise.** An attack hits automatically for maximum damage (×1.5, rounded down, with a Light weapon's melee blow) on an exhibit that is asleep or stirring, or awake and has not seen you since it last woke; any blow of yours can surprise, a Reach blow or a shot included. The target then hunts you. Searching, returning and reinstalling exhibits are never surprised. Against a Centrepiece a surprise blow hits automatically but rolls damage, and it starts the encounter.

**Specials** (telegraphed): one action marks the tiles, each showing the exact damage you would take. The exhibit's next action resolves the special, with no rolls, and costs an attack plus `SPECIAL_RECOVERY` (100), so the exhibit's action after that comes 200 ticks after the resolve: marked at tick 400, resolved at 500, its next action at 700. Every special number in §8.10 is gross: a marked tile shows, and the special deals, `max(DMG_MIN_ON_HIT, gross − your Padding)`, recomputed from your Padding at every view-model update, so what resolves is what the floor showed the moment before. Specials ignore Eva.
- **Who marks.** Only a hunting exhibit marks a special, and only one at a time. An exhibit in an intact case may mark only a beam (which passes glass) or a call (which is sound), never a ring of blows. Nor does a ring strike into an intact case: only a beam passes glass, so a ring never marks a case's tile, and an exhibit in a case, or a mimic in its disguise, is never hit by one.
- **No unseen special.** After a mark, the exhibit's next action comes no earlier than your next decision, and ties go to you, so you always see a mark before it resolves. If you start a 300-tick equip at 400 and an exhibit marks at 400, it resolves at 700, just after your decision at 700; a fast exhibit that marks at 400 while your next decision is at 500 resolves at 500, not at 450.
- **No overlaps.** No two pending damage marks share a tile: an exhibit whose special would mark a tile already marked for damage does not mark, and acts otherwise. A herald's call neither blocks a damage mark nor is blocked by one, and is drawn beneath them.
- **Each actor is hit once,** whoever it is, however many of its tiles are marked and however often a beam crosses its tile, each through its own Padding; the marks show only your number. A beam goes straight through glass, stops at what blocks sight (a tile that cannot be seen through, or one a Fumigant cloud or plaster dust covers), and turns back along its line where it meets a reflector, the way back counting toward its range, so nothing behind the reflector is hit and the shooter's own tile is on the way back: a sniper can be hit by its own beam. On the tiles a beam reaches only on its way back (its owner's tile and those behind it) the damage is the reflector's, as a bolt sent back is: its cause is `reflected`, by the reflector, naming the beam's owner as `shooter`, with the special's numbers (`sp`, `gross`, `pad`, `net`, the tile), so the log says the dish sent the beam back. A reflector on a beam's tile is struck by it, as everything on its tiles is, as it sends it back. The damage of each marked tile comes from the tile next to it that the special came from (the owner's, for a ring; the one the beam crossed before, for a beam), which is the side a blow comes from for `old_repair`.
  A beam's tiles, its way back included, are fixed when it is marked, so what comes onto them or leaves them while the mark is shown changes nothing, and what the floor showed is what resolves: a cloud or dust laid on them does not cut it; a reflector that steps or is moved onto them does not turn it, but is struck like anything else on its tiles, and what stands behind it is struck too; and one that leaves them after turning it still turns it where it stood. So a reflector shields what is behind it only from a beam marked while it is in the beam's way, as its Behaviour line says.
- **A damage special is an attack,** so its resolve makes a soft noise at its owner's tile, after its damage. A special that hits several actors applies every hit, with the wakes each causes (`ally_hit` included), before any noise, the loud noise of an exhibit it destroys included. A call makes no noise: it wakes directly.
- **The axis_sniper** marks its `line` while it hunts and sees you, when it shares your row or column within `AXIS_BEAM_RANGE` and its beam's way out would reach you before anything that blocks sight and before any reflector (it never fires into one, which would send the beam back at it). Otherwise it walks toward the nearest tile from which it would (by its own walking distance, ties in row-major order), and waits if there is none, or if another pending damage mark holds one of its line's tiles. It has no blow and shoots no bolts.
- **Cancelling.** A pending special is called off when its owner is fixed (at once, in the action that fixes it, so the mark is neither shown nor held against other marks), stops hunting (it lost you, was quieted, or you left by the Ticket), goes back to sleep, or is destroyed. Nothing else calls one off: a tethered warden's ring shown while you stood within its tether still goes off if you step outside it (§8.2).
- **The threat** (`Specials.threat(state, action)`) is the mark an action of yours would leave you on, when its special resolves before your next decision: the tile is where the action leaves you, your next decision comes when the action's ticks are done, and the special resolves first if its owner's next action comes earlier (ties go to you). Its number is what the mark shows, which is what resolves. The interface asks before such an action (§7.1). A mark the action calls off (its owner fixed, quieted, or losing you to the Ticket) is no threat, and nor is any mark when the action ends the visit. Nothing you could not know before the action is looked at, so the answer gives nothing away: a mark whose owner the action destroys still counts, since whether a blow destroys is not known before it is made, and an action with a consumable whose kind you have not identified is judged as if it left you where you are and called nothing off.
- **The readout's line** for a special (`Specials.readout`) gives what it would deal you now through your Padding (none for a call), its gross number, its cadence in actions and its reach.

**Weapons** (t is the tier):

| Form | Damage | Cost | Acc | Grade needed | Note |
|---|---|---|---|---|---|
| Light | [t, 3t+1] | 100 | +2 | one less | Surprise ×1.5; cannot break Laminated or Security glass |
| Balanced | [t+1, 3t+3] | 100 | 0 | base | none |
| Heavy | [t+2, 4t+4] | 150 | −1 | one more | One bash counts as two |
| Reach | [t, 3t+1] | 100 | 0 | base | Hits 2 tiles away in a straight line over an empty tile |

**Garments:**

| Form | Padding | Eva |
|---|---|---|
| Light | tier − 1 | +1 |
| Standard | tier | 0 |
| Heavy | tier + 1 | −1 |

**Grade requirements and tiers:**
- **Base grade needed for tier t:** 2t − 1 (T1 I, T2 III, T3 V, T4 VII).
- **Each grade short:**
  - a weapon gives −2 Acc;
  - a garment gives −1 Padding.
- **A need above VII,** the highest grade (§8.7), comes only from a T4 Heavy weapon or garment (VII + 1): such an item is always worn at least 1 grade short (−2 Acc for a weapon, −1 Padding for a garment), and its label says so in words, never as a grade VIII.
- **Tier follows depth,** 60/40 between the tiers on offer (`TIER_LOW_BY_DEPTH`): the lower one and the next, never above T4, the highest, so where the lower is T4 (depth 7) only T4 is offered.

**Your starting stats:**
- HP 20 (+5 per grade above I);
- Acc 3;
- Eva 2;
- Padding from the garment;
- a T1 Balanced weapon and a T1 Standard garment.

**Exhibits' stats** come from the role curves in §8.10, by depth (1–7, the Exit is 7), interpolated linearly between the anchors and rounded down.

**Bodies that dart, split, swarm or crumble** (their Behaviour lines say the same):
- **A darter's step back** is part of its blow: hunting and beside you, it strikes, then at once steps `DARTER_STEP_BACK` tile to an empty tile beside it that is farther from you by walking distance, never into a closed door, ties broken on its own stream; the blow and the step back together cost one blow. With no such tile it is cornered and stays.
- **A splitter splits** after any hit it survives with 2 or more health, if a tile beside it is free (the first in direction order that it could step to, not a closed door, with nobody on it): the new half takes `SPLIT_HP_PCT`% of its health, rounded down and at least 1, and it keeps the rest. Both are then one generation on, and a body of generation `SPLIT_MAX` does not split. The half copies the body's species, numbers, maximum health and speed, hunts as the body does, starts with no statuses, and has the tile it appeared on as its home; its story is `summoned`, naming how it was made (`split`), the body it came from, who hit it, and a copy of the body's own waking.
- **A swarm's bodies** each lose all their health to any hit, of whatever kind.
- **A plaster cast** has `PLASTER_HP_PCT`% of its role's health and maximum health (rounded down, at least 1; a half split from a cast keeps the cast's maximum). Destroyed, it leaves dust on its tile, `PLASTER_DUST_SIZE` tiles a side, for `PLASTER_DUST_TURNS` turns.

**The odds readout** (on examine, live), all integer through `int.js`. Let d(r) = max(1, r − Padding) be the net damage of a roll r, and n the number of rolls in the range:
- Its chance to hit you, in percent.
- "Typically" = 100 × Σ d(r) ÷ (n × your current HP), rounded half up, as a percentage of your current health.
- "At worst" = ceilDiv(your HP, max d(r)) hits.
- An archetype whose attacks are shots (the kiter, which never strikes: cornered beside you it shoots, by its rules above): its first line says it shoots, within `ROLE_ARTILLERY_RANGE`, with its Acc and damage range used as a blow's would be, so the chance, "typically" and "at worst" are its shots'; no line tells of a blow.
- Your chance to hit it, and hits needed = ceilDiv(its HP × n, Σ d(r)) with your rolls against its Padding; a body that loses all its health to any hit (a swarm's) needs 1. A splitter that can still split (below generation `SPLIT_MAX`, one tile in size) counts the hits on it and on every half it splits off, and its line says "to destroy it and every half it splits off": each hit deals the mean net hit, Σ d(r) ÷ n, with health counted in n-ths of a point so that the count stays exact in integers; after a hit a body survives with 2 or more health below generation `SPLIT_MAX`, `SPLIT_HP_PCT`% of what it has left (rounded down, at least 1 health) goes to a new half, both a generation on, and each half is counted the same way; each body's last hit is spent on it whole. It assumes room beside it for every split. When no split would come before it falls, the count is the plain one and the line says "to destroy it". Your figures (the hits needed, the surprise figure and the Attack button's damage) are those of a blow from your tile as its archetype and modifiers take it (`Archetypes.adjustDamage`), so through an `old_repair` exhibit's repaired side each d(r) is doubled.
- With Reach (a Reach weapon, or any weapon with the reach primitive, a Light one included, §8.5), a line saying that your weapon also strikes it with Reach from `REACH_RANGE` away in a straight line, over a clear tile.
- Its surprise figure, while a blow now would surprise it; with Reach, when a surprise Reach blow from `REACH_RANGE` away would deal otherwise (only a Light weapon's blow beside it deals ×1.5), both figures.
- One line per special, with its exact net damage and cadence.
- An exhibit with no blow (its archetype says so through `Archetypes.readout`: the axis_sniper, which "never strikes") shows none of the first three lines, nor its Acc and damage among its pictograms, since it never uses them: what it threatens you with is told by its special's line. Your chance to hit it, the hits needed and the surprise line stay. An exhibit in an intact case, which never strikes out (§8.3), keeps its lines, which say what its blows would do once it is out, but not the surprise line: no blow of yours reaches it now (`behind_glass`), and getting it out wakes it (breaking the case wakes a sleeper inside hunting; opening it beside the exhibit fills its pips), so no blow could catch it as that line would say.

**Health:**
- **Regeneration:** 1 HP every `max(4, floor(400 / maxHP))` turns (the interval). It is kept as a store of units (`regen`), so that halving and doubling the rate stay exact on an odd interval: at boundary step 3, below full health, the store gains `REGEN_BELL_MULT` (2) units a turn, and when it reaches `REGEN_BELL_MULT` times the interval it gives you 1 HP and gives up that many units. At full health the store is empty, so nothing builds up to spend later. So at 20 maximum health you regain 1 every 20 turns; at 30, every 13, and on a bench every 7 and 6 turns in turn.
- **Benches** double it while you sit on one (4 units a turn); standing on one does not. `sit` is legal on a bench when you are not seated already (refused `no_bench` or `seated`) and costs `COST_SIT`; waiting and resting keep you seated, and any other action that costs time gets you up. `rest` is a wait under its own name, which the interface repeats.
- **After the bell** the interval is multiplied by `REGEN_BELL_MULT`, so it doubles (1 unit a turn; 2 on a bench). Regeneration runs before the clock's step, so on the bell's own boundary it is still the open rate.
- **In the night watch,** and while a Centrepiece hall is sealed, regeneration stops (no units).
- **Healing** that is not regeneration (Consolidant, restoring, a warden back home) is a `healed` event with its cause, and never takes anyone past their maximum; when nothing is regained, nothing is said.
- **Death** opens the death label and its recap: what killed you, why it was awake, and when and how it woke, read from the killer's own story (§3.4). `Text.recap(state, nameOf)` gives the killer (the killing cause's `by`, so a bolt or beam a reflector sent back is the reflector's), the turn and cause of its most recent waking, the turn its hunt began, and the lines: who defeated you and on which turn; the blow that did it, as the log told it; then its story, oldest first, in its causes' own sentences: for a body split from another, how that body woke and then how it split; how it woke; and when it began hunting you, if that came later. The story is the killer's own, never the cause records, so it is the same however much has happened since.

### 8.2 Waking

*"Every exhibit is asleep, stirring or awake. Being close or making noise fills its three pips; the ring around you shows what counts as close. A species may have one extra trigger, shown as one icon."*

**States:**

| Mode | Shown as | Acts | Leaves it when |
|---|---|---|---|
| dormant | asleep (Zz), or stirring with 1–2 pips | no | 3 pips → woken (below); damage → hunting |
| awake | ! | investigates its last stimulus, or wanders its room | sees you → hunting; 20 turns without stimulus → returning |
| hunting | !! | pursues and attacks | out of sight for 8 turns → searches your last-known tile for 3 turns (sees you → hunting) → returning |
| returning | ↩ | walks home, then reinstalls for 3 turns | sees you → hunting; reinstalled → dormant with 1 pip |

- **An exhibit with no home** (its case was broken or dissolved) never returns. It stays awake and wanders. Nor does an exhibit that never sleeps (`awake`) go back: when a search of either ends, it wanders instead; and one going back or settling in that loses its home wanders from where it is.
- **What each mode does** (`AI.byMode`, every exhibit's behaviour when its archetype has nothing of its own to do, and all of the plodder's). Each timer counts turns from the exhibit's `stim`, which is its last stimulus while awake, the last turn it saw you (or began the hunt) while hunting, and its arrival while searching or reinstalling:
  - **awake:** it walks to what it was sent to look at (onto the tile, or beside it if no exhibit can stand there or another actor stands there), then wanders: it walks to a tile of its home room (the room it stands in, if it has no home) that it can reach, drawn on its own stream, then to another; when other actors leave it no way to a place, it gives that place up and picks another;
  - **hunting:** it strikes you if it can; otherwise it walks toward you while it sees you, else to your last-known tile, and waits there; 8 turns after it last saw you it searches;
  - **searching:** it walks on to your last-known tile, and its 3 turns start when it arrives, or once no step gets it closer;
  - **returning:** it walks home (a 2×2 body until its anchor stands on its home tile), and reinstalls on arriving; when other actors leave it no step home (one stands on its home, or in every way to it), it wanders its room instead, and goes back again after 20 turns undisturbed;
  - **reinstalling:** it waits at home, and 3 turns after arriving it is asleep with 1 pip (a pipless exhibit with none); moved off its home meanwhile, it goes back to it.

  An exhibit in an intact case changes mode by the same timers, but only ever waits.
- **A patrolling exhibit** (`awake`) walks its round instead of wandering, and never returns to sleep: after 20 turns without you it resumes the round.
- **Mode on waking.** Hunting, from the ring, `axis`, `tether`, `touch_case`, `ally_hit`, being seen, damage and the night-watch bell (its last-known tile is yours). Awake, investigating the source, from noise, a herald's call (it goes to look at your tile at the moment of the call) and the alarm. The trigger that adds the third pip decides; if two complete it at once, hunting wins.
- **One action's wake order.** Within one action, every other wake effect is applied before that action's noise. So a blow wakes the victim's group (`ally_hit`) before its soft noise; a special that hits several actors applies every hit and its wakes before any noise, even the noise of an exhibit it destroys; opening a case, and every bash, touches it (`touch_case`) before its noise; the breaking bash releases the sleeper inside before its crash; and a mimic's grip comes before the noise of the open or bash that touched it. A sleeper at 2 pips touched by any of these therefore wakes hunting, not awake. At a turn boundary, likewise, noise comes after the ring, `axis` and `tether` (§8.1, step 4), so a sleeper at 2 pips inside your ring wakes hunting while you cough.
- **Waking and changing mode.** Waking is leaving dormant, and only waking resets what belongs to one waking: whether it has seen you (`sawYou`), its count of actions, and its archetype's per-waking state (a herald's one call). It costs a beat, starts the exhibit's story (`woke`, and `hunted` if it hunts), and is told by a `woke` event, then a `hunting` event if it hunts. Every other change of mode resets nothing, so a returning exhibit that has seen you and is sent to look by a noise is not surprised by your blow. Each change has its event: into hunting, `hunting`; from searching, returning or reinstalling to awake, or a new place to look while awake, `alerted`; returning to reinstalling and reinstalling to dormant, `returned`; any other change (losing you, going back, settling), `lost`. A hunt begins with your tile as its last-known tile, whether the exhibit is woken into it, turns to it, or is made hunting.
- **Pipless exhibits.** A mimic is pipless while it sleeps, in its disguise or, after it has shown itself, asleep again: it gains no pips, hears nothing, and only damage, its case being opened or bashed, or its case being dissolved wake it. So your ring, noise, a herald's call, the night-watch bell, "Quiet, Please" and Fumigant never touch a sleeping mimic, and its Behaviour line ("Wakes only when it is opened, bashed, dissolved or struck") stays true whenever it sleeps. Awake, it hears noise and can be quieted as every exhibit can.
- **A herald's call.** A herald calls once each time it wakes, the first time it then sees you: the call is its special (§8.1), marking every tile an exhibit could stand on within `HERALD_RANGE` of it, and when it goes off every sleeping exhibit standing on a marked tile that can hear (so not a pipless one, below) wakes awake, to look at the tile you stand on then. A call called off is still that waking's one call.
- **A tethered warden** never steps outside the disc of `TETHER_RANGE` round the tile it guards (its own, when it is made), so a noise draws it only as far as the edge. If you are outside that disc at its action while it hunts or searches for you, it starts no fight with you: no blow and no new ring. A ring it has already shown still goes off at that action, as every shown special does (§8.1, Cancelling), so what the floor showed is what you take. While it sees you (and so hunts you), it walks back to its place (its home, or with none what it guards) and waits there, still hunting, with no change of mode, so a warden you watch from outside its tether stands its ground quietly. Once it does not see you, it goes back (`lost`, cause `tether`), heals fully when it reaches home (`healed`, cause `home`), and settles; an exhibit with no home never goes back, so it stays awake. It marks its ring (§8.1) only with you on it, within its tether: at its `ROLE_WARDEN_SPECIAL_EVERY`th action since it woke or the first one after that, then no sooner than `ROLE_WARDEN_SPECIAL_EVERY` actions after each mark.

**Your ring** is drawn round you at all times:
- **Radius:** 3 if your last action that cost time was anything but wait, rest, view or sit; otherwise 2. Actions that cost no time (reading, examining) never change it. +2 while you stand on a loud floor (shards, water). Perks and items can shrink it, never below `RING_MIN` (1).
- **What it does:** a sleeping exhibit within that walking distance, with line of sight to you, gains 1 pip a turn.
- **What is shown:** a tile is drawn as inside the ring exactly when a sleeping exhibit standing on it would gain a pip at a boundary with the map as it is now; one predicate (`Vision.inRing`) decides both. Only tiles an exhibit can stand on are drawn (`Grid.hold`), and a 2×2 exhibit gains its pip if any of its tiles is inside. A test checks that equivalence over whole layouts.
- **Which turn.** The ring drawn is from your current tile, on the map as it is now, with the radius of your last action that cost time. Since every action of yours that costs time costs at least a turn (§8.1), a boundary runs after each such action and before your next decision, so the ring drawn is the ring that boundary applied, from the same tile with the same radius, unless a tile or a surface changed after it. That can happen only when your decision falls mid-turn (after a 150-tick Heavy blow or bash), since exhibits then act between the boundary and your decision: a door one opens then is open in the ring drawn, though the boundary found it shut. It cannot show the next boundary's ring, whose radius depends on the action you have not yet chosen.

**Noise:**
- **Classes:**
  - soft, heard within 3 walking tiles: an attack, hit or miss (heard from the attacker's tile, and made last in the blow, after everything else the blow does); opening a case or a door, or closing a door (heard from the door); a thrown item landing;
  - loud, within 6: bashing glass; an exhibit destroyed;
  - crash, within 10: glass breaking; an alarm.
- **Doors.** A closed door counts as 3 extra tiles.
- **Hearing.** An exhibit never reacts to a noise it made itself.
  - A sleeping exhibit that hears a noise gains 1 pip; it gains at most 1 pip from noise per turn. If that pip is its third, it wakes awake and goes to look at the noise's tile.
  - An awake exhibit that hears one goes to investigate the noise's tile, and so does a searching, returning or reinstalling one (it is alerted); a noise from the tile it is already going to look at only counts as a stimulus.
  - A hunting exhibit moves your last-known tile to the tile of a noise you made (a Tuning Fork's included); another exhibit's noise says nothing about where you are. Noise does not reset its turns out of sight.
- **What is shown:** the tiles an exhibit could stand on that a noise reached (as hearing measures it; walls and fixtures are not marked) flash as a ring until your next action that takes time, with a caption ("Crash: glass breaking, heard 10 tiles away"); a long action shows every noise of its turns, and an action that takes no time (a refusal, a free read) leaves the rings as they were (§6.1).

**Pips:**
- 3 to wake, for every exhibit;
- 1 pip decays per 10 turns without stimulus, before the bell, counted from its last pip gained (or the turn it went to sleep) and from its last decay: a sleeper left at 2 pips on turn t has 1 on turn t + 10 and none on turn t + 20;
- none decay after the bell;
- each trigger adds at most once per turn.

**Special triggers,** at most one per species, shown as one icon:

| Trigger | Fires when | Pips |
|---|---|---|
| `axis(r)` | you stand in its row or column within r of one of its tiles, in line of sight from that tile | 1 a turn |
| `period` | its module's chime (§5.4) | wakes for the demonstration, then sleeps again with the pips it had |
| `tether(r)` | you come within r of the tile it guards (a tethered warden guards its own); no sight is needed | 3 |
| `touch_case` | its case, or the case it is, is opened or bashed (touched, §8.3) | 3 |
| `ally_hit` | a member of its group within 5 of it takes any damage (only sleepers whose own trigger is `ally_hit` answer) | 3 |
| `awake` | it is never dormant, and never goes back to sleep: it is never returning or reinstalling | none |

The alarm is not a species trigger: `alarm_network` wakes the department itself (§5.4).

At a turn boundary the wake checks (your ring, `axis`, `tether`) are all made from your tile at that tick before any is applied; then each sleeper, in spawn order, takes its ring pip, its `axis` pip and its `tether` pips, in that order, so the one that adds its third pip is what it woke for.

**Damage always wakes, straight to hunting.**

**Sight:**
- You see every tile in line of sight within 12. Since every tile is lit, light plays no part.
- An exhibit that is awake, hunting, searching, returning or reinstalling sees you within 8 (`within r`, below) of any of its tiles, with line of sight from that tile. Seeing you turns any of these modes into a hunt, and a hunter that sees you knows your tile. A sleeping exhibit sees nothing.

**Geometry, defined once in `grid.js` and used by every rule:**
- **Line of sight:** a Bresenham line traced from whichever endpoint comes first in row-major order, blocked by any sight-blocking tile between the ends, or by a tile between them that a sight-blocking surface covers (a Fumigant cloud or plaster dust: the `size` × `size` square centred on its tile; fog in M4). Glass passes sight; closed doors block it; actors do not. It is symmetric by construction, and a test checks `los(a, b) === los(b, a)` over whole layouts.
- **Within r** (sight, the Lamp, `axis`, `tether`, `ally_hit`, a herald's call, a shot's range): `dx² + dy² ≤ r² + r`, the layout prototype's disc.
- **Walking distance** (the ring, noise, "walking tiles"): 8-connected steps, where a diagonal step is allowed only if both orthogonal neighbours could be stepped onto; actors never block it, and staff doors count as doors. To something on a tile you cannot step onto (an exhibit in a case or on a plinth, a Centrepiece's footprint, a lectern), it is 1 + the walking distance to the nearest neighbouring tile you could step onto (`Grid.reachDist`). A closed door, ordinary or staff, adds `NOISE_DOOR` (3) for noise (`Noise.reach`). There is no other limit on distance.
- **Moving:** `move(dir)` follows the same diagonal rule. A pursuing actor (an exhibit hunting you, or walking on to your last-known tile to search it) takes the first step of a shortest walking path, breaking ties on its own `ai/` stream. An exhibit walking anywhere else (to look, to wander, home) goes round the other actors where they stand now: it takes the first step of a shortest walking path that crosses no tile another actor stands on, ties likewise. For an exhibit, staff doors, open or closed, are walls, also for the diagonal rule, and it never steps out of an intact case (`Grid.canStep(m, x, y, d, 'exhibit')`).
- **Where an exhibit can stand** (`Grid.hold`): every walkable tile, a vitrine and a plinth.
- **Doors.** Closed doors block sight and movement. An exhibit opens a closed door by stepping into it, as you do (`COST_DOOR`, a soft noise). You close an open door (`'` or `s`) beside you that you could step into, with `close(x, y)`, for `COST_DOOR` and a soft noise at the door; closing one with an actor in its doorway is refused (`doorway_occupied`), as is a tile that is not an open door beside you (`no_door`) or one past a corner (`corner`). Exhibits treat staff doors as walls, so a staff corridor is a refuge you pay a grade for, and its section panel says so.

### 8.3 Cases

*"You can see through glass but not walk through it. Open a case if your grade allows, or break it, loudly."*

**Glass grades:**

| Grade | Bashes to break | Lock (grade needed to open) |
|---|---|---|
| Plate | 1 | I–II |
| Laminated | 2 | II–IV |
| Security | 3 | IV–VII |

**Placement.**
- Glass by depth follows `GLASS_MIX_D1` … `GLASS_MIX_D6` (§8.10): Security joins the mix from depth 3.
- A case's lock is drawn uniformly from the overlap of its glass range and I to (depth + 1). If they do not overlap, the lock is the glass range's minimum.
- Every vitrine inside a room is a case. A vitrine in a wall's place (a glazed screen, which belongs to no room) is fixed glazing: it is seen through and refused like a case when bumped, and it is never opened or bashed.
- A case's accession number is the department's number, its room's number and its place among the room's cases in row-major order, counted from 1 (`S.9.103.2`), with no draw; an on-loan case keeps its number.
- A staff door's grade is drawn uniformly from I to (depth + 1), never above VII, on the department's staff stream, the doors in row-major order.
- Each case draws its glass, then its lock, then whether it is on loan. A mimic's case is drawn the same way, on the mimic's own stream (§3.2), so it differs from a real case only in having no accession number.
- A Highlight is never behind a lock above the grade you enter the department with, nor in a case on loan, a mimic's case or one that already holds something (`Cases.highlightOk`).

**Opening** costs 200 ticks, makes a soft noise and fires `touch_case`. An opened case is passable, with no shards (its tile becomes `u`, as a dissolved one's does); an exhibit in it may leave, keeps its home there, and can return to it.

**`open(x, y)` and `bash(x, y)`** take an intact case beside you, never diagonally past a corner (as a blow). Anything else is refused before it costs anything: no intact case there (`no_case`), not beside you (`out_of_reach`), past a corner (`corner`), a lock above your grade (`case_locked`, to open), or glass your weapon cannot break (`glass_too_strong`, to bash).

**A touch.** Opening a case, and every bash, touches it (Solvent never does, and a bump is refused). Every exhibit standing in it or at home in it whose trigger is `touch_case` gains 3 pips, so it wakes at once, hunting; the mimic whose case it is wakes at once, hunting, without pips. In one open or bash the touch comes first; then the case changes (it opens, its glass cracks, or it breaks, releasing what stood in it and laying its shards); then the case's event; and last its noise, from the case tile (§8.2, one action's wake order).

**Bashing:**
- each bash costs 100 ticks and makes a loud noise;
- the breaking bash makes a crash;
- a Heavy weapon counts two bashes a swing;
- a Light weapon cannot break Laminated or Security glass;
- `breaker` adds one bash to each swing (`BREAKER_BASHES`), but never lets a Light weapon break Laminated or Security glass, and no swing counts more bashes than break the glass.

**A broken case:**
- becomes passable, with shards, and shards spread to one floor tile on your side: the tile you bashed from, by the shard rule below;
- its contents can be taken from an adjacent tile;
- a sleeping exhibit inside wakes hunting and has no home; one already awake inside turns to the hunt, homeless too; and an exhibit whose home it was, standing elsewhere, loses that home.

**A mimic's case** is opened and bashed as a real case is, with the same refusals, but nothing opens or cracks: the touch reveals the mimic (its tile becomes floor) and wakes it, before the noise. Solvent reveals it and wakes it hunting, silently and without its grip. A case whose mimic is gone shows itself floor when it is touched or dissolved.

**An exhibit in an intact case** gains pips as usual. If it wakes, it stays inside, shown awake or hunting, and acts only by specials and ranged attacks that pass glass: it can never step out of the case, and nothing strikes into or out of an intact case. A bump into a case, and a blow at anything standing in one, are refused alike (`behind_glass`, "Glass is in the way."), so a mimic in its disguise is refused exactly as a case is. Solvent leaves it homeless and wakes it hunting, silently. The night-watch bell never picks an encased exhibit.

**A mimic** is made, asleep, as a case on its own floor tile; a mimic made asleep anywhere else (not one tile, not on a floor tile, or on a fixture) is a content error, and the room or department is not built. Opened or bashed, it shows itself (its case `revealed`, its tile floor again) and grips whoever touched it: `rooted` for `MIMIC_GRIP_TURNS` turns, which covers your next 2 decisions; then the touch wakes it, hunting (`touch_case`), all before the noise of the open or bash. Its first action, after its beat, is a rolled blow from beside you, and it is slow at everything. Struck while it is still a case (only a beam reaches it), it shows itself and wakes without the grip; dissolved by Solvent, it shows itself and hunts silently, without the grip.

**Staff doors** (the M.11 staff corridor, and any staff layer a programme draws) open like case locks: each carries a grade, drawn as locks are, and opens for 100 ticks with a soft noise at that grade or above (an open staff door is `s`, which can be seen through). Below it, it is a wall (`staff_grade`), and a path for a tap never goes through it. Nothing required lies behind one (`design/layout.md` LV5). A department records every staff door's grade; a room built for a test or an arena records one only when it is given one, and a bump opens a staff door with no recorded grade at grade I. A path for a tap goes through a closed staff door only where its grade is recorded and within yours: never through one with no recorded grade, and never through any on a board that records no grades, as a policy's board rebuilt from the view model does unless it carries the staff doors' grades and yours (`Path.to`).

**Other rules:**
- **Shards** only ever land on floor or an archway (`Cases.shardTile`): on the tile they fall to (a glass exhibit's own tile; for a broken case, the tile on your side), if it is one; otherwise on that tile's first floor or archway neighbour in direction order (N, NE, E, … NW); otherwise nowhere. So shards never cover a door, an exit, the entrance, a bench or a case.
- Solvent, thrown, dissolves every case in a 3×3 silently: no noise, no shards, no `touch_case`. Its tile becomes `u`, what stood in it is released as from a broken case, and each case dissolved is told by one `glass_broke` with no shards.
- About one case in six is "on loan elsewhere": a label with no object.
- Vitrines never stand on gate cells (`design/layout.md` LV10).

### 8.4 The clock

*"At the bell your recovery slows; later the night watch begins its rounds, waking whatever is nearest to you."*

**Open hours** are set by the department's tour length `L_tour` (`design/layout.md` §13.1):
- **The bell:** `B = round10(2.5 × L_tour + 100)` turns after entry; about 220–300 at Cabinet size, from M1's measured `L_tour`.
- **The night watch:** at B + G, where `G = max(60, round10(0.15 × B))`.
- **Calibration** happens at the slice gate.
- **The count.** The clock counts the turns since entry (`dept.clock.count`), one at each turn boundary, at step 6 (§8.1). The bell, the night watch and each night-watch bell come at the boundary where the count reaches them, after that boundary's regeneration (step 3) and pip decay (step 5), so they take effect from the next boundary; each is told by a `stage` event. A clock made part-way through (an arena's or a test's) takes its stage, and the night-watch bells already rung, from its count, with no events.

**The bell:**
- pips stop decaying;
- the regeneration interval doubles;
- an announcement and a section-panel banner. Section panels come with M4's content, so in M3 the announcement is a plain banner in the strip, with the stage on the dial.

**The night watch:**
- regeneration stops;
- a Night Watchman (`night_watchman`, a shared species with the warden curve's numbers at the department's depth) enters at the department entrance, or, if someone stands there, on the nearest free tile by an exhibit's walking distance (ties in row-major order; free: a tile an exhibit can step onto and stand on, not a closed door, with no one on it), and its announcement then says it came in near the entrance. It is created hunting, its story reading "began its rounds, hunting you from the start" (cause `night_watch`, §3.4), so it is never caught by surprise, and it first acts one action after it enters (§8.1). It walks to your actual position over the whole map, never to a tile where it only last knew you were, and it never searches or goes back. Staff doors are walls to it, as to every exhibit (§8.2), so when no walk reaches you it goes to the tile it can reach that is nearest you and waits there. There is never more than one. If defeated, the next enters `WATCHMAN_RETURN` (20) clock counts later, as `<acc>.<depth>.watch.<k>` with k counting up (§3.2);
- the Night Watchman is an exhibit, not a member of staff: DESIGN.md and `design/core-systems.md` §5.3 describe night staff who cannot be harmed, this section wins by precedence, and its label never calls it staff;
- every 30 turns after the night watch begins (`NIGHT_WAKE_EVERY`; the first at B + G + 30, since the Watchman alone marks B + G), a night-watch bell rings, and the 3 sleeping exhibits nearest to you by walking distance (`NIGHT_WAKE_COUNT`; from your tile, as for the ring, §8.2; ties in spawn order) wake hunting you, with your tile as their last-known tile. It wakes only sleepers that a walk from you reaches, that are not in an intact case and that are not pipless (a sleeping mimic, in its disguise or not, §8.2). The walk is the ring's: staff doors count as doors whatever their grade, so the bell can wake a sleeper behind a staff door you cannot open, which then cannot come through it (§8.2). The bell is not a noise: it wakes them directly.

**A Centrepiece hall** seals while its Centrepiece hunts you (a treasure hall seals later, §5.5). While it is sealed, the count toward the bell and the night watch and the night-watch bells stop, and so does regeneration. Every other turn-boundary step runs as usual: surfaces, statuses, pip decay, alarm decay, module turn rules and chimes. If the Centrepiece has neither reached you nor dealt damage for `SEAL_LIFT_TURNS` (50) turns, the seal lifts. A Re-admission Ticket unseals it and returns you to the entrance; the Centrepiece regains `SEAL_HEAL_PCT` of its maximum health and returns.

**Leaving.** The exit doors work at any time: `leave(i)`, made standing on exit door i, costs no time and ends the visit (`over` with k `left`, and a `left` event that names the door and the clock's stage); it is refused on any other tile (`not_on_exit`) and for a door that does not exist (`no_exit`). Leaving forfeits unearned Highlights and the Certificate. There is no time bonus. In M3 leaving only ends the visit; the doors' placards and the run's next department are M5's (§8.9).

### 8.5 Your kit

*"A weapon, a garment, two curios and an instrument. Restoration kits improve them."*

**Slots and carrying:**
- weapon, garment, two curios, an instrument;
- a tote of 16 slots, with one slot per consumable kind (stacking) and one per unequipped item;
- no weight.

**Restoration kits:**
- **Two per department,** as Highlights: never in a dead end beyond a lock above your grade, never secret.
- **Each adds a level to one item:**

  | Slot | +1 level gives |
  |---|---|
  | Weapon | +1 min and max damage, and +1 Acc at every even level |
  | Garment | +1 Padding |
  | Curio | +1 rank |
  | Instrument | +1 charge |

**Item primitives the slice implements** (closed):
- damage, Acc, Eva and Padding bonuses;
- `reach`;
- `quiet` (your ring −1 when you move or strike);
- `breaker` (+1 bash);
- `observing` (the Lamp's rule);
- `charges` (for instruments);
- one effect per instrument from: Tuning Fork (a soft noise at a tile within 8; 3 charges, recharge 40 turns), Pin-Driver (a ranged attack, damage [t, 2t+2]; 4 charges, recharge 30), Window Pole (push or pull 1 tile, or take from an open case at range 2; 4 charges, recharge 40).

**Each department places:**
- 2 pieces of equipment;
- 1 curio or instrument;
- 5 consumables;
- the Centrepiece's Signature piece.

**Using your kit** (`js/core/rules/kit.js`):
- **Taking and dropping.** You take an item from your tile or one beside you (a diagonal one not past a corner, as a blow), lying on the floor or in an opened or broken case; walking over an item never takes it. It goes into your tote, a consumable into the stack of its kind and seal if you have one (the stack keeps the department it was first taken in, `from`), and a full tote refuses. You drop an item from your tote onto your tile. Each costs `COST_TAKE`.
- **Equipping.** Only from the tote. A weapon, garment or instrument takes the place of the one you wear, which goes into the tote where the new one was, so a full tote never stops it; a curio takes the first empty curio slot, and is refused when both are full. Taking an item off puts it in the tote, costs what putting it on does, and is refused when the tote is full; the weapon slot is never empty, so a weapon is changed by equipping another. Like every action, item actions take twice as long while you are slowed.
- **Bonuses.** Every primitive on what you wear (weapon, garment, curios and instrument) counts: a damage, Acc, Eva or Padding bonus adds its size's value (`BONUS_*`: S, M, L), the damage bonus to both ends of your damage; a curio's rank (its Restoration levels) adds 1 to each of its bonuses; a garment's own Padding is never below 0, however far short of it you are, and Padding bonuses add to it, so taking a garment off never raises your Padding; `reach` makes your blows Reach blows; `quiet` and `breaker` count once however many items have them. Your stats change once your action's ticks are done (§8.1).
- **Quiet.** Your ring is `QUIET_RING` smaller while your last action that cost time was a move or an attack and you wear a quiet item. Any move counts, a bump into an exhibit or a door included, so a blow counts however it is struck.
- **Instruments** are used only from your instrument slot, at a tile within their range (a disc, as "within r" always is) in your line of sight, for `COST_USE` and one charge. An instrument that is not full gets one charge back every recharge turns from its first use, wherever it is; Restoration's charge comes filled. The Tuning Fork makes a soft noise of yours at any tile an exhibit could stand on. The Pin-Driver fires a bolt (§8.1, Shots) at an exhibit you can see with a clear line, since bolts stop at glass, and is refused as a shot is (`out_of_reach`, `blocked`, `behind_glass`, `no_target`), so an exhibit in a case, one behind glazing, an empty case and a mimic's disguise are all refused alike: damage `PIN_DRIVER_DMG` at its tier, rolled with your Acc without the weapon's (`PLAYER_ACC` and the Acc bonuses of your garment, curios and instrument). The Window Pole, with `how` push or pull, moves a one-tile exhibit not in a case, and with no special marked (it would leave or enter tiles already shown), one tile straight away from you or toward you, only where it could step itself and onto no actor or closed door, without waking it; with `how` take, it takes the item from an opened or broken case into your tote. A use's `used` event comes before what it does: the noise, the bolt, the move or the take. A use is refused before it costs anything, with nothing changed (`Kit.aimCode`): what is not a known instrument with `no_item` or `no_use`, and a `how` or `on` it does not take with `bad_use`; every instrument with `not_equipped` (not in your instrument slot), `no_charges` (none left), `no_aim` (no tile of the board) or `own_tile` (your own); the fork and the pole with `out_of_range` (outside the disc of its range) or `no_line` (out of your sight); the fork with `not_a_place` (no tile an exhibit could stand on); the pole with `no_exhibit`, `too_big`, `in_case`, `marked` or `cannot_move` for a push or pull, and `nothing_to_take` or `tote_full` for a take; the Pin-Driver with a shot's codes above.
- **Restoration.** `use(kit, on)`: a kit in your tote, on a weapon, garment, curio or instrument you wear or carry, for `COST_USE`; the kit is used up.

**The stand-in placement** (`Kit.standIn`, until M4's population): on `…/a<k>/items`, `EQUIPMENT_PER_DEPT` of the pack's weapons and garments and `CURIO_OR_INSTRUMENT_PER_DEPT` of its curios and instruments, each list shuffled and taken in turn (from its start again if it is short), then `KITS_PER_DEPT` Restoration kits; then each piece's room, among the sections and studies (the next one in order if it has no place left). On that room's populate stream: its place, a floor tile on which no actor stands (a removed one included) and no item lies, or an empty case (shut, not on loan, not a mimic's); then a weapon's, garment's or instrument's tier. Item uids are counted per room (§3.2). The kits are the department's Highlights, recorded in `dept.highlights` with their rooms: never where the entrance cannot be walked to without a staff door, and in a case only within the grade you came in with (`Cases.highlightOk`).

### 8.6 Consumables

*"A handful of kinds, unlabelled until you have used one or read about it."*

**Eight kinds.** Solutions are drunk or thrown (thrown: a 3×3 unless the kind says otherwise, soft noise); Ephemera are read. You use them from your tote, one of a stack at a time, for `COST_USE`. A throw lands on a tile you can see through, within `THROW_RANGE` (a disc) and in line of sight, and reaches every creature with a tile in its square, you included, except one inside an intact case, which is behind glass.

| Kind | Effect | Deck cards |
|---|---|---|
| Consolidant | Drink: heal 50% of max HP now and 25% over 5 turns. Throw: heals every creature in the 3×3 by 50% | 20 |
| Fixative | Drink (harmful): you are fixed (cannot move or act) for 4 turns. Throw: fixes every creature in the 3×3 for 4 turns | 8 |
| Fumigant | Drink (harmful): you cough, a soft noise each turn for 5 turns. Throw: a 5×5 cloud for 10 turns that blocks sight; sleeping exhibits inside lose 1 pip a turn | 10 |
| Solvent | Drink: removes your harmful statuses. Throw: dissolves case glass in the 3×3 silently | 8 |
| Catalogue Card | Read: identify one unknown seal, of your choice (with only one left, that one at once); a known Card cannot be read once every seal is known | 14 |
| Floor Plan | Read: reveals the department's plan (every tile counts as explored, remembered as it is when read) and the rooms of the remaining Highlights | 8 |
| "Quiet, Please" | Read: every exhibit within 8 walking tiles loses all pips; awake exhibits that are not hunting settle where they stand; hunters drop to awake | 8 |
| Re-admission Ticket | Read: return to this department's entrance (or, if someone stands there, the free tile nearest it by walking distance, then in row-major order), even while you are rooted, since it is not a step; hunters lose you; unseals a Centrepiece hall. With no entrance to return to, a Ticket not yet identified is identified and does nothing, and a known one cannot be read, so no refusal gives an unknown one away | 5 |

**"Quiet, Please" and the Ticket on exhibits.** "Quiet, Please" measures its 8 walking tiles from you to an exhibit's nearest tile, with no extra for doors. An exhibit awake but not hunting (awake, searching, going back or settling back in) goes to sleep where it stands, its home unchanged; a hunter drops to awake with nothing to look at, and its pending special is called off. It leaves alone the Night Watchman, a species that never sleeps, and a mimic in its disguise. The Ticket's "hunters lose you" means that each hunter but the Night Watchman searches where it last knew you were, and its pending special is called off.

**Seals.** Each run shuffles 4 wax seals over the Solutions and 4 ink stamps over the Ephemera. The seal carries identification through the run. Each department gives every seal a local name ("Rainwater, Collected at Slack Tide · verdigris seal"; its pack's `consumables.names`, by the seal's position), so a name says nothing about the kind from one run to the next; a stack keeps the name of the department where it was first taken.

**Identification:**
- **By use.** A first use of an unidentified kind never harms you: a harmful drink is identified and does nothing, and the game says what it would have done; a throw of an unidentified Solution is refused if a 5×5 area (the largest any Solution has) centred on the target would include you, with a sentence that names no kind. Otherwise a throw does what its kind does, healing hostiles included. Use identifies at once, and the kind is recorded in the Catalogue.
- **By label.** Each department shows at least 2 identifying labels for kinds you do not know, one in the Intro or the first section. Reading the full label identifies the kind. A label is a plaque on a wall, read with `read(x, y)` within `READ_RANGE` (a disc) and in line of sight, at no cost in time, while its kind is unknown.
- **By Catalogue Card.**

**The deck.** Ambient consumables are drawn from one run deck of the cards above (81), without replacement, refilled when empty. Until M4's population, a department places `CONSUMABLES_PER_DEPT` of them on free floor tiles of its sections and studies that you can walk to from the entrance without passing a staff door, and its labels on wall tiles each beside a floor tile of its Intro, a section or a study that you can walk to in the same way, the first by the Intro or the first section (on §3.2's placement streams; the walk is measured on the map as laid out, a mimic's disguise counting as the floor it stands on).

### 8.7 Grade

*"Each department's Certificate, earned by defeating or viewing its Centrepiece, raises your grade by one: more health, a perk chosen from three, heavier objects, higher-grade cases."*

**The grade:**
- starts at I and rises by one per Certificate, so VII at most in a six-department run;
- is printed on the badge: "Handling Clearance, Grade IV".

**Each Certificate gives:**
- +5 max HP, and heals 5;
- a perk chosen from three: two from the department's primary challenge family and one from its secondary, with a perk you hold offered at rank 2 where possible.

**Three ways to the Certificate:**
- **Defeat** the Centrepiece: the Certificate and its Signature piece.
- **View** it: four viewing turns standing on the lectern's reading tile while it sleeps; `view` is legal only there. The layout puts a lectern against a wall with a reading tile beside it exactly `VIEW_DISTANCE` (3) walking tiles from the Centrepiece (§8.2's rule for tiles you cannot step onto), with line of sight to it. Viewing is standing still, so a viewer's ring (2) adds no pips; but the steps that bring you within 3 do, and so does any noise. A pip that wakes it interrupts the view. A completed view earns the Certificate and closes the exhibit for the night (a dust sheet), so no fight follows. This keeps DESIGN default 9's rule and makes "inside its wake radius" precise: the lectern sits at the edge of the ring you have while moving.
- **Treasure** (S.9): carry the Lamp out of the hall alive for the Certificate and the Signature piece, or view for the Certificate alone.

**The eight slice perks** (each has two ranks):

| Family | Perk | Rank 1 | Rank 2 |
|---|---|---|---|
| Guarded | Soft Soles | Your ring is 1 smaller | 2 smaller |
| Guarded | Vanishing Act | A hunter that loses sight of you skips its 8 turns and searches at once | and loses its next action |
| Guarded | Light Fingers | Opening a case costs 100 ticks and makes no noise | and opens locks one grade above yours |
| Swarm | Single File | An enemy that steps into a doorway beside you loses its next action, once per enemy | and takes 3 damage |
| Swarm | Elbow Room | +3 Padding while 3 or more enemies are adjacent | +5 |
| Artillery | Duck and Cover | When a special resolves and misses you, your next action costs 50 ticks less | and your next attack is a surprise attack |
| Artillery | Close the Distance | Your first step toward an exhibit targeting you costs 0 ticks, once per exhibit | two steps |
| Attrition | Second Wind | Once per department, falling below 25% HP heals 25% of max HP over 5 turns | 40% |

**Families in the slice.** Placards show the challenges each visit actually holds: S.9 guarded only (its sample secondary, darkness, rests on lamps the slice cuts, §1), A.4 swarm and locks, M.11 artillery and hazard. S.9's missing secondary, and locks and hazard, have no slice perks, so their offer slot is filled from attrition, then guarded. If a slot's family has nothing left to offer (every perk held at rank 2), it is filled from the other family, then from any family. An offer never shows the same perk twice.

### 8.8 Labels

*"Every exhibit and object has one: a plain Behaviour line that states exactly what it does, and a paragraph that is only for reading."*

**Examining** anything visible is free. The strip shows the nearest readable thing within 2 tiles (as Distance, below, counts them), in this priority: hunting or awake exhibit, sleeping exhibit, case contents (a shut case, by what it holds, an object on loan elsewhere, or nothing; an opened, broken or dissolved case only while it still holds its object, since an empty one has nothing left to read), plaque; nearest first within each, then the actors' and the fixtures' order. A mimic in its disguise is on it only as its case, which is shut and reads as a real empty shut case does.

**The full panel shows:**
1. the title, with the state and pips (the state icon is the board's glyph, §8.2's "Shown as": searching shows as hunting, reinstalling as returning);
2. the tombstone fields (maker, date, medium, dimensions, credit line, accession number); an exhibit's accession number is its pack id read as family letter, department and item (S.9.5), and a shared species (the Night Watchman), which no department accessioned, shows none;
3. the pictogram row; an exhibit's begins with its wake pictograms, from the same entries as its Behaviour line's wake and trigger parts: the ring ("ring") only beside the generic wake clause (never for a mimic, whose pipless clause the ring never touches, nor for an exhibit that never sleeps), then its trigger's icon, "never sleeps" for `awake` and "wakes" for the others;
4. the Behaviour line;
5. the odds readout;
6. the paragraph;
7. action buttons.

**Distance:** the paragraph and identification need you within 2 tiles (`READ_RANGE`). For an exhibit (from its nearest tile), a case and an item, the tiles are counted as a king moves, a diagonal step counting one, so the far corners 2 tiles off on both axes are within it. A plaque is read with `read(x, y)`, whose reach is the disc of "within r" (§8.2, §8.6), so a plaque in those corners is not, and its label offers Read exactly where `read` is taken. Farther away, the panel shows what sight gives and "Come closer to read".

**What each label holds** (`js/core/labels.js`). Every label has the panel's fields, and its buttons are only actions `step()` would take now: each is checked against its action's own legal list and your statuses, as `Step.legal` checks them.
- **An exhibit:** as above. Its Attack button names the blow you would make now (beside it, or with Reach) and what it would do, a surprise blow's certain hit included. A body split from another (a splitter's half, known by its uid `<body uid>/<k>`, §3.2) is named "a split of" its species, on its label and in every sentence, however often it settles back and is woken again.
- **A case:** what it holds, that its object is on loan elsewhere, that it is empty, or the exhibit standing in it; its glass, its lock and its cracks as pictograms; its rules (its fixture's and its glass's clauses); whether your grade opens its lock, and in how many blows your weapon breaks it; its accession number on its tombstone. Its buttons are "Open: Grade III" and "Break the glass: 2 blows, loud, the last a crash", or Take once it is no longer shut. A mimic's case gives exactly the label of a real empty case with its glass, lock and loan, but no number (§8.3).
- **A staff door:** its grade, and whether yours opens it; Open (a step into it) or Close.
- **An identifying label** (a plaque): the seal of the kind it describes (the pictogram of its shape, `seal_<shape>`, one for each of the eight seals, as on a consumable's label and in a case), and its rule; Read, within reach. Its text, which names the kind, shows only once the kind is identified.
- **An item:** a consumable's local name, its seal and its line (its kind's clause once identified, else the rule for a first use); any other item's name, tombstone and Behaviour line, its own numbers at your grade before any bonus, the grade it needs and how far short of it you are, its bonuses, and an instrument's charges. Its buttons are the actions that need no target (take, equip, take off, drop, drink, read); one that needs a target (a throw, an instrument's tile, a Restoration kit's item) is aimed in the Bag.
- **You:** your grade, your numbers, your ring now, and your statuses with the turns each still covers; Wait, Rest, Sit on a bench, and Leave on an exit.

**Pictograms:**
- about 55 in the slice, among them one for each status and each surface, keyed by its id, so the top bar and a label show what is on you or on a tile, one for each item kind, and one shape for each seal;
- each a fixed shape;
- colour from the reserved semantic set: hostile, hazard, readable, item, player.

### 8.9 Doors, and the run

*"Each department ends in doors whose placards say what kind of trouble lies behind each."*

**A placard shows:**
- the department's number and title;
- a one-line blurb;
- the challenge icons;
- the Centrepiece's name and form (fight or treasure).

**The slice run:**
- **Entrance Hall:** one tap to start; Your Collection on show. On the first run only, a one-room Orientation that teaches moving, examining, the ring, pips and bumping (about a minute).
- **Three floors of two departments,** with a Stair Hall after floors 1 and 2. The Stair Hall offers one of three: rest to full health, a free Restoration level, or one of three consumables shown by kind (taking one identifies its seal for the run; the two left identify nothing).
- **The Exit:** one hall at depth 7 with two exhibits recalled from this run, sleeping on pedestals, then the revolving doors and the run's summary label.

**The slice sequencer** (pool of 3):
- each department appears exactly twice;
- never twice on one floor;
- never the same department twice in a row;
- the doors from one room always show different departments.

The first department is drawn on the `doors` stream from all three. After that, each coda offers every department that fits, one door each; a department fits if some completion of the run satisfies every rule. Of the 48 sequences the first four rules allow, 30 remain; every prefix extends, and the doors after departments 1–5 number 2, 2, 1–2, 1–2 and 1. A test enumerates this.

**At most one new system per visit** (DECISIONS: "in early runs brings at most one the player has not met"). If both of a department's modules are unmet, its secondary is off for that visit, logged as an option, and the placard shows one module icon. The visitor's Catalogue records the modules met. In a slice run each department comes twice, so the second visit adds its secondary.

**Departures from DESIGN's run shell, made here:**
- The Orientation is one room of about a minute, not DESIGN default 23's five rooms with the Guard at Post One, because staff guards are out of the slice. It is excluded from the run time.
- The Stair Hall's third offer is one of three identified consumables, replacing the kiosk, because coins are out.
- DESIGN default 22's first-department rule for first-time players is deferred: the gate records how first departments go, and decides.

**Accession.** Leaving a department visit whose Certificate you earned lets you accession one piece of equipment you acquired there into Your Collection (D11). In the slice the kind does not yet join future loot pools.

**Second visits.** A second visit uses the same pack at the new depth with a fresh layout, and its Certificate counts again. If you hold, or have accessioned this run, that department's Signature piece, defeating its Centrepiece (or carrying out the Lamp) gives a Restoration kit in its place.

### 8.10 The numbers of record

`tools/lint-numbers.js` reads every row between the markers below and compares it with `js/core/numbers.js`. A mismatch fails `check-all.sh`. Values separated by ` / ` are lists: depth anchors 1 / 4 / 8 for the role curves, interpolated as §8.1 says.

<!-- numbers:begin -->
| Key | Value | Meaning |
|---|---|---|
| TICKS_PER_TURN | 100 | ticks in one turn |
| COST_STEP | 100 | step |
| COST_WAIT | 100 | wait or one turn of rest |
| COST_ATTACK | 100 | attack |
| COST_ATTACK_HEAVY | 150 | a brute's blow; a Heavy weapon's blow costs FORM_HEAVY[3], and a test checks the two are equal |
| COST_DOOR | 100 | open or close a door |
| COST_OPEN_CASE | 200 | open a case |
| COST_BASH | 100 | one bash (Heavy: 150 for two) |
| COST_TAKE | 100 | take or drop |
| COST_USE | 100 | drink, read a consumable, throw, use an instrument or apply a Restoration kit (reading a label costs nothing) |
| COST_BASH_HEAVY | 150 | one Heavy swing at glass, counting as two bashes |
| COST_EQUIP | 100 | equip a weapon, curio or instrument |
| COST_EQUIP_GARMENT | 300 | equip a garment |
| COST_PUSH | 100 | push a jar |
| COST_VIEW | 100 | one viewing turn |
| COST_SIT | 100 | sit on a bench |
| SPECIAL_RECOVERY | 100 | added to the cost of a special's resolve, so the exhibit's next action comes that much later |
| SPEED_FAST_PCT | 50 | fast actors' cost |
| SPEED_SLOW_PCT | 200 | slow actors' cost |
| HIT_BASE | 75 | hit chance at equal Acc and Eva |
| HIT_PER_POINT | 5 | per point of Acc − Eva |
| HIT_MIN | 10 | floor |
| HIT_MAX | 95 | ceiling |
| HIT_FIXED_TARGET | 20 | against a fixed target |
| HIT_DAZED_ATTACKER | -20 | dazed attacker |
| DMG_MIN_ON_HIT | 1 | minimum damage on a hit |
| SURPRISE_LIGHT_PCT | 150 | Light weapon surprise multiplier |
| PLAYER_HP | 20 | starting max HP |
| HP_PER_GRADE | 5 | max HP per grade above I |
| CERT_HEAL | 5 | heal on a Certificate |
| PLAYER_ACC | 3 | starting Acc |
| PLAYER_EVA | 2 | starting Eva |
| GRADE_START | 1 | grade at the start of a run |
| GRADE_MAX | 7 | grade after six Certificates |
| SHORT_ACC | 2 | Acc lost per grade short, weapons |
| SHORT_PAD | 1 | Padding lost per grade short, garments |
| REGEN_NUM | 400 | regeneration: turns per HP = max(MIN, floor(NUM / maxHP)) |
| REGEN_MIN | 4 | regeneration floor |
| REGEN_BELL_MULT | 2 | interval multiplier after the bell |
| BENCH_MULT | 2 | regeneration multiplier on a bench |
| PIPS_TO_WAKE | 3 | pips that wake any exhibit |
| PIP_DECAY_TURNS | 10 | turns without stimulus per pip lost, before the bell |
| RING_STILL | 2 | ring radius while standing still |
| RING_MOVING | 3 | ring radius when acting or moving |
| RING_LOUD_FLOOR | 2 | added on shards or water |
| RING_MIN | 1 | the smallest the ring can be made |
| NOISE_SOFT | 3 | soft noise range, walking tiles |
| NOISE_LOUD | 6 | loud noise range |
| NOISE_CRASH | 10 | crash noise range |
| NOISE_DOOR | 3 | extra tiles through a closed door |
| SIGHT_PLAYER | 12 | your sight range |
| SIGHT_EXHIBIT | 8 | an awake exhibit's sight range |
| AWAKE_IDLE_TURNS | 20 | awake without stimulus, then returning |
| LOSE_TRACK_TURNS | 8 | hunter out of sight, then searching |
| SEARCH_TURNS | 3 | turns searching your last-known tile |
| REINSTALL_TURNS | 3 | turns reinstalling before sleeping |
| ALLY_HIT_RANGE | 5 | ally_hit range |
| AXIS_RANGE | 8 | the `axis` trigger's reach |
| TETHER_RANGE | 2 | the `tether` trigger's reach, and the tethered_warden's leash |
| HERALD_RANGE | 6 | a herald's call |
| CLOCK_MULT_PCT | 250 | B = round10(MULT × L_tour / 100 + ADD) |
| CLOCK_ADD | 100 | |
| STAGE_GAP_PCT | 15 | G = max(MIN, round10(PCT × B / 100)) |
| STAGE_GAP_MIN | 60 | |
| NIGHT_WAKE_EVERY | 30 | turns between night-watch bells |
| NIGHT_WAKE_COUNT | 3 | exhibits woken per night-watch bell |
| WATCHMAN_RETURN | 20 | turns before a defeated Watchman returns |
| SEAL_HEAL_PCT | 25 | Centrepiece heal when a hall is unsealed, % of its maximum |
| SEAL_LIFT_TURNS | 50 | a seal lifts after this long without the Centrepiece reaching you or dealing damage |
| VIEW_TURNS | 4 | viewing turns for a Certificate |
| VIEW_DISTANCE | 3 | walking tiles from the lectern's reading tile to the Centrepiece |
| TREASURE_SEAL_HP_PCT | 34 | a treasure hall also seals when its Centrepiece falls to this share of its health |
| TREASURE_SEAL_TURNS | 12 | turns after a treasure's case is touched before its hall seals |
| CAUSE_RECORDS | 64 | cause records kept in the state |
| READ_RANGE | 2 | tiles from a label to read it |
| TOTE_SLOTS | 16 | tote size |
| CURIO_SLOTS | 2 | curio slots |
| KITS_PER_DEPT | 2 | Restoration kits per department |
| CONSUMABLES_PER_DEPT | 5 | ambient consumables per department |
| EQUIPMENT_PER_DEPT | 2 | ambient weapons and garments per department |
| CURIO_OR_INSTRUMENT_PER_DEPT | 1 | |
| ID_LABELS_PER_DEPT | 2 | identifying labels per department, minimum |
| CASE_EMPTY_ONE_IN | 6 | one case in N is "on loan elsewhere" |
| CONSOLIDANT_NOW_PCT | 50 | Consolidant, immediate heal |
| CONSOLIDANT_HOT_PCT | 25 | Consolidant, heal over time |
| CONSOLIDANT_HOT_TURNS | 5 | |
| CONSOLIDANT_THROW_PCT | 50 | a thrown Consolidant's heal, % of each creature's max HP |
| FIXATIVE_TURNS | 4 | fixed |
| FUMIGANT_TURNS | 10 | cloud duration |
| FUMIGANT_SIZE | 5 | cloud side |
| COUGH_TURNS | 5 | coughing |
| QUIET_RANGE | 8 | "Quiet, Please" range |
| THROW_RANGE | 5 | how far you can throw |
| THROW_AREA | 3 | the side of a thrown Solution's square |
| DECK | 20 / 8 / 10 / 8 / 14 / 8 / 8 / 5 | Consolidant, Fixative, Fumigant, Solvent, Catalogue Card, Floor Plan, "Quiet, Please", Re-admission Ticket |
| GLASS_BASHES | 1 / 2 / 3 | Plate, Laminated, Security |
| GLASS_LOCK_MIN | 1 / 2 / 4 | the lowest lock grade: Plate, Laminated, Security |
| GLASS_LOCK_MAX | 2 / 4 / 7 | the highest lock grade, likewise |
| GLASS_MIX_D1 | 70 / 30 / 0 | Plate, Laminated, Security % at depth 1; provisional |
| GLASS_MIX_D2 | 70 / 30 / 0 | |
| GLASS_MIX_D3 | 40 / 40 / 20 | |
| GLASS_MIX_D4 | 40 / 40 / 20 | |
| GLASS_MIX_D5 | 30 / 40 / 30 | |
| GLASS_MIX_D6 | 30 / 40 / 30 | the Exit uses depth 6's mix |
| SHARD_SPREAD | 1 | floor tiles on your side that get shards when glass breaks |
| FORM_LIGHT | 0 / 3 / 1 / 100 / 2 / -1 | weapon: min = t + a, max = b·t + c, cost, Acc, grade offset |
| FORM_BALANCED | 1 / 3 / 3 / 100 / 0 / 0 | |
| FORM_HEAVY | 2 / 4 / 4 / 150 / -1 / 1 | |
| FORM_REACH | 0 / 3 / 1 / 100 / 0 / 0 | |
| REACH_RANGE | 2 | tiles away a Reach weapon hits |
| GARMENT_LIGHT | -1 / 1 / 0 | Padding = tier + a, Eva, grade offset |
| GARMENT_STANDARD | 0 / 0 / 0 | |
| GARMENT_HEAVY | 1 / -1 / 1 | |
| TIER_LOW_BY_DEPTH | 1 / 1 / 2 / 2 / 3 / 3 / 4 | the lower tier on offer at depths 1–7 |
| TIER_LOW_PCT | 60 | share of items at the lower tier |
| BONUS_ACC | 1 / 2 / 3 | Acc from an S / M / L primitive; provisional |
| BONUS_EVA | 1 / 2 / 3 | Eva, likewise |
| BONUS_PAD | 1 / 2 / 3 | Padding, likewise |
| BONUS_DMG | 1 / 2 / 3 | min and max damage, likewise |
| BREAKER_BASHES | 1 | extra bashes per swing with `breaker` |
| QUIET_RING | 1 | your ring is this much smaller when you move or strike with `quiet` |
| RESTORE_DMG | 1 | a weapon's min and max damage per level |
| RESTORE_ACC_EVERY | 2 | a weapon gains 1 Acc at every this many levels |
| RESTORE_PAD | 1 | a garment's Padding per level |
| RESTORE_RANK | 1 | a curio's rank per level |
| RESTORE_CHARGES | 1 | an instrument's charges per level |
| TUNING_FORK | 3 / 40 / 8 | charges, recharge turns, range |
| PIN_DRIVER | 4 / 30 / 5 | charges, recharge turns, range; damage [t, 2t + 2] |
| PIN_DRIVER_DMG | 0 / 2 / 2 | the Pin-Driver's damage at tier t: min = t + a, max = b·t + c |
| WINDOW_POLE | 4 / 40 / 2 | charges, recharge turns, range |
| LAMP_OBSERVE_RANGE | 4 | the Day Curator's Lamp, lit |
| LAMP_RING | 1 | added to your ring while the Lamp is lit |
| UNOBSERVED_STEP | 2 | tiles a turn for an unobserved mover |
| DEMO_PERIOD | 12 | turns between demonstrations |
| DEMO_PERIOD_INTRO | 8 | in an Intro gallery |
| DEMO_PERIOD_HALL | 8 | in the Centrepiece hall |
| DEMO_LINE_DMG | 4 / 7 / 10 | gross damage of a demonstration line; provisional |
| DEMO_WARNING | 2 | turns of warning chime |
| DEMO_WINDOW | 3 | minimum safe window at a forced crossing |
| ALARM_TURNS | 30 | an alarm's length |
| ALARM_CLOCK_ADVANCE | 30 | turns each alarm brings the bell closer |
| WEATHER_SHARE_PCT | 20 | cases holding weather |
| WEATHER_TURNS | 10 | fog or rain duration |
| RAIN_STOP_TURNS | 2 | a soaked clockwork exhibit stops |
| COPY_GROUP | 3 / 4 | smallest and largest copy group |
| COPY_WEAKEN_PCT | 33 | health and damage lost by a spare whose original falls; provisional |
| COPY_WEAKEN_ACC | 2 | Acc lost likewise; provisional |
| PERK_ELBOW_ROOM | 3 / 5 | Padding at ranks 1 and 2 |
| PERK_SECOND_WIND_PCT | 25 / 40 | |
| PERK_SINGLE_FILE_DMG | 3 | |
| PERK_DUCK_AND_COVER | 50 | ticks saved |
| PERK_SECOND_WIND_BELOW_PCT | 25 | |
| PERK_SECOND_WIND_TURNS | 5 | |
| PERK_LIGHT_FINGERS_COST | 100 | ticks to open a case with Light Fingers |
| DEPTS_PER_RUN | 6 | |
| DEPTS_PER_FLOOR | 2 | |
| EXIT_DEPTH | 7 | the Exit's depth for the role curves |
| SAVE_SLOTS | 2 | alternating IndexedDB slots |
| ROLE_FODDER_HP | 7 / 16 / 28 | |
| ROLE_FODDER_ACC | 2 / 3 / 4 | |
| ROLE_FODDER_EVA | 1 / 2 / 3 | |
| ROLE_FODDER_DMG | 1-4 / 3-8 / 5-13 | |
| ROLE_FODDER_PAD | 0 / 1 / 2 | |
| ROLE_SKIRMISHER_HP | 12 / 24 / 42 | |
| ROLE_SKIRMISHER_ACC | 3 / 4 / 5 | |
| ROLE_SKIRMISHER_EVA | 3 / 4 / 5 | |
| ROLE_SKIRMISHER_DMG | 2-5 / 4-9 / 7-14 | |
| ROLE_SKIRMISHER_PAD | 0 / 1 / 2 | |
| ROLE_ARTILLERY_HP | 10 / 20 / 35 | |
| ROLE_ARTILLERY_ACC | 4 / 5 / 6 | |
| ROLE_ARTILLERY_EVA | 1 / 2 / 3 | |
| ROLE_ARTILLERY_DMG | 2-5 / 4-11 / 7-16 | |
| ROLE_ARTILLERY_PAD | 0 / 0 / 1 | |
| ROLE_BRUTE_HP | 15 / 35 / 65 | attacks cost COST_ATTACK_HEAVY (150) |
| ROLE_BRUTE_ACC | 1 / 2 / 3 | |
| ROLE_BRUTE_EVA | 0 / 1 / 2 | |
| ROLE_BRUTE_DMG | 3-7 / 6-14 / 10-22 | |
| ROLE_BRUTE_PAD | 1 / 2 / 3 | |
| ROLE_CONTROLLER_HP | 12 / 26 / 46 | |
| ROLE_CONTROLLER_ACC | 3 / 4 / 5 | |
| ROLE_CONTROLLER_EVA | 2 / 3 / 4 | |
| ROLE_CONTROLLER_DMG | 1-3 / 2-5 / 3-8 | |
| ROLE_CONTROLLER_PAD | 0 / 1 / 2 | |
| ROLE_WARDEN_HP | 21 / 49 / 91 | |
| ROLE_WARDEN_ACC | 3 / 4 / 5 | |
| ROLE_WARDEN_EVA | 2 / 3 / 4 | |
| ROLE_WARDEN_DMG | 2-5 / 4-10 / 7-15 | |
| ROLE_WARDEN_PAD | 1 / 2 / 3 | |
| ROLE_WARDEN_SPECIAL | 6 / 12 / 17 | gross damage of the tethered_warden's ring special (§8.1) |
| ROLE_WARDEN_SPECIAL_EVERY | 3 | the tethered_warden's ring special comes every this many actions |
| ROLE_ARTILLERY_SPECIAL | 5 / 11 / 16 | gross damage of the axis_sniper's beam (§8.1) |
| MEDIAN_PADDING | 1 / 2 / 3 | the median visitor's Padding; provisional |
| ROLE_SUPPORT_HP | 10 / 20 / 35 | new for the slice: provisional |
| ROLE_SUPPORT_ACC | 2 / 3 / 4 | |
| ROLE_SUPPORT_EVA | 2 / 3 / 4 | |
| ROLE_SUPPORT_DMG | 1-2 / 1-3 / 2-4 | |
| ROLE_SUPPORT_PAD | 0 / 1 / 1 | |
| ROLE_SWARM_HP | 2 / 4 / 7 | per body; new for the slice: provisional |
| ROLE_SWARM_ACC | 2 / 3 / 4 | |
| ROLE_SWARM_EVA | 1 / 2 / 3 | |
| ROLE_SWARM_DMG | 1-2 / 1-3 / 2-4 | |
| ROLE_SWARM_PAD | 0 / 0 / 0 | |
| ROLE_AMBUSHER_HP | 12 / 24 / 42 | new for the slice: provisional |
| ROLE_AMBUSHER_ACC | 4 / 5 / 6 | |
| ROLE_AMBUSHER_EVA | 2 / 3 / 4 | |
| ROLE_AMBUSHER_DMG | 3-6 / 5-11 / 8-16 | |
| ROLE_AMBUSHER_PAD | 0 / 1 / 2 | |
| ROLE_CENTREPIECE_HP | 45 / 105 / 195 | shared pool for an ensemble |
| ROLE_CENTREPIECE_PAD | 1 / 2 / 3 | |
| ROLE_CENTREPIECE_ACC | 3 / 4 / 5 | provisional |
| ROLE_CENTREPIECE_EVA | 1 / 2 / 3 | provisional |
| ROLE_CENTREPIECE_DMG | 3-6 / 5-11 / 8-17 | basic blows; provisional |
| ROLE_CENTREPIECE_SPECIAL_PCT | 25 / 30 / 35 | gross special damage = pct(MEDIAN_MAX_HP, this) + MEDIAN_PADDING, at that depth |
| ROLE_ARTILLERY_RANGE | 6 | |
| ROLE_CONTROLLER_SPECIAL_EVERY | 3 | a status special every third action |
| AXIS_BEAM_RANGE | 10 | the axis_sniper's beam, in tiles |
| KITER_HOLD | 3 / 5 | the kiter's distance from you, nearest and farthest |
| DARTER_STEP_BACK | 1 | tiles a darter steps back after its blow |
| SPLIT_MAX | 2 | splits per lineage |
| SPLIT_HP_PCT | 50 | each half's share of the remaining health |
| SWARM_BODIES | 3 / 8 | bodies in a swarm, fewest and most; provisional; the M3 stand-in places the first |
| MIMIC_GRIP_TURNS | 2 | turns a mimic's grip roots you |
| OLD_REPAIR_PCT | 200 | damage through an old repair's side |
| PLASTER_HP_PCT | 70 | a plaster cast's share of its role's health |
| PLASTER_DUST_TURNS | 3 | turns a plaster cast's dust blocks sight |
| PLASTER_DUST_SIZE | 3 | the side of the dust square |
| MEDIAN_MAX_HP | 20 / 25 / 30 / 35 / 40 / 45 / 50 | at depths 1–7, assuming a Certificate in each earlier department; provisional |
<!-- numbers:end -->

The rows for the archetypes, triggers, locks, throwing, primitives and Restoration were added when M3 began, so that every clause names its number. The support, swarm and ambusher rows and the Centrepiece's Acc, Eva and damage are new; the drafts gave them only shapes (`design/vocabulary.md` §10.3). They are first guesses for M3's paired bots to move, and the validation log records every change to the table. The slice places exhibits by hand from the packs (D13), so it needs no encounter budget; the drafts' fodder-equivalent costs and LV12's budget check wait for generated departments.

---

## 9. Art, sound and the asset ledger

### 9.1 Art

**The board:**
- 16×16 sprites as palette-indexed text grids (`art/sprites/*.txt`), as in `vanguard-zero/`; every cell is clear, glass, or a key every department palette has, which `build-art.js` enforces, so no outline changes with the department;
- silhouettes fixed by archetype;
- departments differ by palette, wall colour, floor material and ornament;
- the reserved semantic colours (hostile, hazard, readable, item, player) never appear in a department palette, which a test checks.

**Close-ups:**
- every exhibit and Centrepiece has a 64×64 close-up (`art/closeups/*.txt`), shown in its label like a catalogue photograph. A close-up has a colour layer and a shade layer (lit, shadow, deep shadow). `tools/make-closeups.js` writes a first one from the board sprite (Scale2x to 64, lit from the upper left, with a cast shadow) and never overwrites, so each can be redrawn by hand;
- Centrepieces occupy 2×2 tiles on the board.

**Pictograms** are drawn in code.

**Fonts:** system fonts for labels, and at most one pixel font for headings, from a licence the ledger accepts (OFL or CC0).

**`tools/build-art.js`** turns the sources into `js/view/art.gen.js`. A test fails if the generated file is out of date.

### 9.2 Image models and downloads

- **Image-model output is offline reference only** (Julian's answer 3). It may be committed under `art/reference/`, with its ledger entry naming the model, its licence, the prompt and the date. The build excludes the folder, and a lint fails if anything in it is referenced by the game.
- **Game art is drawn by people or by code,** with its ledger entry saying who.
- **CC0 packs** may be placeholders, ledgered, and must be gone by the slice gate.

### 9.3 The asset ledger

`art/ledger.json` has one entry per file in `art/`, `vendor/` and `tools/vendor/`, with:
- `file`, `kind`;
- `source`: `hand`, `code`, `cc0`, `vendored` or `reference`;
- `author` or `model` and `prompt`;
- `licence`;
- `derivedFrom`, `changes`;
- `approvedBy`, `date`.

Credits are generated from it. `lint-registry.js` fails on an unledgered file.

### 9.4 Sound (M6)

- A fork of `vanguard-zero`'s synthesiser and tracker, with its echo.
- Per department: a mode, an instrument family, a tempo and a motif (`design/samples.md`).
- Module bells scheduled from the core's events.
- Every informative sound has a visual twin and a caption.

---

## 10. Testing

The ten layers are in [`DECISIONS.md`](DECISIONS.md) (Automatic playtesting); the slice builds layers 1–8. Every layer reports in words, with a replay.

### 10.1 What runs when

| Layer | Runs | Gate |
|---|---|---|
| 1. Rule tests, golden scenarios, Behaviour-line scenarios and invariants, hashes | every `check-all.sh` | yes |
| 2. Monkeys (random legal actions), 10,000-turn soak, save fuzzing | every `check-all.sh` (short); per milestone (long) | yes |
| 3. Layout validators, the worst-case runner, 1,000-seed sweeps | every `check-all.sh` (100 seeds); per milestone (1,000) | yes |
| 4. Screens: no horizontal scroll, 44-px targets, colour-blind check, left-click-only play, both views | per milestone, and when UI changes | yes |
| 5. Paired scripted bots: counterplay against naive, rule-aware against rule-blind, on the same seeds | per milestone from M3 | yes, at the margins of §10.3 |
| 6. An expert search bot over the core, looking for exploits | M4 onward, per milestone | no: reports annotated replays |
| 7. A language-model reader of the labels | M4, then on label changes, when an API key is available | never |
| 8. People, at the slice gate | M7 | the gate itself |

### 10.2 Tooling

- **`test/run.js`** loads `js/core`, `content/` and the tests into a `vm` context and reports one line per failure. It runs `test/*.test.js` and every `*.test.js` under `test/behaviour/` and `test/arena/`, and its filter matches a file's path from `test/`, so `node test/run.js behaviour` runs the Behaviour-line scenarios. `test/m3-battery.test.js` is check-all's short sims, a step of its own run alone so that the battery's time is its own: a run with no filter leaves it out, and `node test/run.js m3-battery` runs it. It shares the files out among worker processes, one per CPU up to 4 (`ACCESSION_TEST_JOBS` sets the number), each file running whole in one worker, and prints the output file by file in path order. A scenario failure names the rule and gives the seed, the room as text and a replay.
- **The scenario harness,** `test/behaviour/_harness.js`, which every Behaviour-line test uses (§5.3, checks 1–3):
  - `scenario({name, id, build(params, sp, depth), actions, expect})`: a scenario for the clause of registry id `id`, written as a function of that clause's parameters, which the harness reads from `Clauses.of` at the species and depth;
  - `species(C, id)`: every pack species whose Behaviour line has that clause, at depths 1–7, as the packs give them, so a pack's override fields apply; species whose archetype is not yet built are left out, as departments leave them out;
  - `sweep` runs a scenario for each of them, with every invariant checked after every step (`play`), and each failure names the scenario, the species, the depth and the seed; a sweep over no species is refused;
  - `play` also checks after every step that the state is plain data (§3.1), whatever the invariants, and with `clone` (a scenario's `clone: true`) plays a twin that is cloned after every step and reports the first step whose hash differs (§3.5);
  - `sensitivity(C, scenario, id)` reruns it with `id` in `rulesOff`, and fails unless every run then fails. A scenario's `build` must pass `rulesOff` on to `Setup.room`'s options, since a rule switched off after the state is made is only half off (a modifier's speed is fixed at spawn); one that does not fails, saying so.
- **Crash cards** (`tools/shrink.js`). Monkey, soak and golden failures are shrunk with ddmin over the action list, replaying from the seed (time limit 60 s); a monkey's failure replays from the seed of the visit it happened in, and a visit in which the core throws keeps its actions up to and including the one that threw. The shrunk list still fails the same way, and removing any one of its actions makes it pass. The card gives the seed, `coreHash`, the shrunk action count, the first bad step with its events and a JSON-path diff of the state across that step, and the replay with the command that plays it; the replay link is pending M5. When the bad step threw, the card says so, and gives the events it had emitted and what it had changed before it threw. When the failure is that two plays part (a second play, or one cloned after every step), the card also lists where their states differ after that step.
- **`tools/sim.js`** runs policies headless over N seeds and writes JSON with the run's `coreHash`, `vmHash`, seeds and per-run outcomes. It supports `--policy`, `--seeds`, `--depth`, `--dept`, `--arena`, the counterfactual switches `--rules-off` and `--without`, `--paired` (two policies or two option sets on identical seeds: each side is a policy, optionally with its own switches, `counter@rules-off=marble`) and `--invulnerable` (a sim-only option that keeps your HP at least 1 and logs the would-be deaths); `--help` lists the rest.
  - **A run** stops when its arena's goal is met, the visit is over, or the turn cap is reached; after cap × 10 steps (refusals take no time); after 50 refusals in a row; or on an error, when the policy fails to decide, gives no action or no reason in words, or changes the game state while deciding, or the state stops being plain data. A policy's action that is not legal is refused by `step()`, as a player's would be, and listed as a violation. After every step the state must be plain data, and `--check` runs every invariant and confirms that deciding left the state as it was. A violation names its step, counted from 1. With `--check` the command is also a gate a script can run (§10.3): it exits 1, saying why, when a paired verdict is not a pass or a run stopped on an error or has a violation (a `--without` that removed nothing stays a note); without it, the command only reports.
  - **Removing an exhibit.** In an arena, `--without` may name an exhibit by its letter in the stamp, which stands for its uid on each seed. A uid that no actor of a visit has removes nothing there; the run lists that as a violation, and the verdict names the seeds.
  - **Each run's JSON** holds its outcome, a reason for every decision, the labels it read, its violations and its replay (`{coreHash, start, options, actions}`, with `start` saying how the state was made: an arena's holds the parsed stamp and the hash of `tools/arena.js`, so the replay rebuilds its room alone); a paired run adds the statistics of §10.3 and the verdict in words. A limit without bound is written `"Infinity"`.
- **The policies.** Random monkey; naive; one counterplay policy per archetype; rule-aware and rule-blind per module; wander (explores a department and fights whatever it meets, never leaving, so the battery's department visits end in deaths, §10.3); explorer (finishes departments and runs); a 2-ply expert search (layer 6).
  - **The monkey** (`tools/monkey.js`) draws, each step, an action kind among those legal now by its weight (mostly moves, as a player's are, then blows, waits and the rest; a pending choice is always chosen), then one legal action of that kind, on its own stream (`monkey`, on a holder of its own), so it uses every action kind a player has.
  - **They see what a player sees.** Every policy except the monkey and the expert observes only `ViewModel.derive(state, {events})` (with the events of its last action that took time, so the noise rings and one-turn cues a player sees are there, kept across a step that takes none as the player's are, §6.1), the log's sentences for the last step, and the text of labels it has read, the paragraph only within reading distance (§8.8); it chooses from `Step.legal`, the player's buttons. The view model lists only actors on visible tiles, masks every tile you have not seen, and shows a remembered tile as you last saw it. `Obs.make` in `tools/policies/lib.js` builds exactly this, as a frozen copy, so nothing a policy does reaches the game, and its helpers read nothing else.
  - **They are deterministic.** A policy draws any choice from its own stream, `policy/<name>/<seed>`, on a holder of its own and never in the state, and it runs in the hardened core context, where `Math.random` and the clock are not there; `tools/lint-core.js` checks `tools/policies/` as it checks the core. What a policy remembers (a lure's stage, a herald's last tile) it keeps in `obs.memory`, one plain object for each run, empty at its start and never in the state; a policy file keeps no state of its own, since the sim loads the files once and shares them between runs (§3.3's lint). Two runs on one seed make the same decisions, whatever ran before them.
  - **Each has a card** in `tools/policies/README.md`: its rules in order and its weights, printed in every report. The file is generated from the cards (`node tools/sim.js --cards --write`) and a test fails when it is out of date.
  - **Each decision has a reason.** It appends one line to the sim log ("attack M11.3.s2.4: 80% to hit, kills in 2"), and the replay scrubber shows it.
  - **The expert** may read the whole state; each exploit it reports is annotated per step with its evaluation and the cause records of the gain, and flagged when it relies on what the view model does not show.
- **`tools/report.js`** fills sentence templates from sim JSON (and the battery's), with the statistics of §10.3. Every claim links a replay chosen by rule: for a rate, a run with the commonest outcome (the median seed among those runs) and the median seed; for a paired comparison, the seed with the largest paired difference in the arena's metric (the largest |B − A|, the lowest seed on a tie) and the median-difference seed (the seeds in order of B − A, then of seed, the lower middle one); for a failure, its crash card (`--cards`, shrunk with the battery's own checks). A replay is written as a file with the command that plays it (`node tools/replay.js <file>`), its link pending M5, and a report names the build its coreHash runs in, `dist/builds/<coreHash>.html` (§12). No language model writes a number in a report.
- **`tools/browser/*.mjs`** (Playwright, Chromium; WebKit when run on a Mac) cover:
  - smoke: boot `dist/accession.html` from `file://` at phone size, play 200 left clicks on the board and 150 anywhere in the window, and fail on a console error, sideways scroll, or "undefined", "NaN" or "[object" on screen;
  - screens at 390×844 and 1280×800;
  - play: the left-click-only script of §7.1, at both sizes and in both views;
  - the Bag: its quickslots, aiming and floor plan with left clicks (§7.2), at both sizes and in both views;
  - the hash page;
  - the 3D checks (§6.3);
  - the kill test (§10.4, from M5).
- **`check-all.sh`** runs, in order:
  1. lints;
  2. art up to date, and every build the log links kept (§12);
  3. Node tests;
  4. short sims: the short battery (§10.3), alone, in at most 60 s;
  5. the build, and the revert test in a temporary copy (§6.3);
  6. browser smoke, hash and 3D checks.

  It prints a summary table. A step it cannot run prints SKIPPED and makes the run fail, unless `--allow-skip` is given; milestone acceptance never uses `--allow-skip`. A commit happens only after it passes.

### 10.3 Margins and statistics

- **Seeds.** Seed sets are fixed and named: seeds 1–200 for bot gates, 1–1,000 for layout sweeps.
- **Pairing.** Paired runs share seeds and per-actor streams, so the rooms and every actor's dice are the same. Once two policies act differently, the same draws serve different blows, so a single seed's difference can still be luck; the statistics below are over all seeds.
- **Statistics, by kind:**
  - a single rate (death, fires, fallback) gets a 95% Wilson interval (`Stats.wilson(k, n, z)` in `tools/stats.js`, which runs beside the core, never in it, since it needs floating point);
  - the hit-chance check (M3) rolls `Combat.rollHit` 10,000 times at each chance the slice can show, on one fixed `combat/test` stream, and requires each rate inside its 99.9% Wilson interval (z = 3.2905); it prints how many intervals it checked, of which about one in a thousand could fall outside by chance, and any that does is a finding;
  - a paired binary difference (death with and without a rule) gets Newcombe's paired-difference interval (Newcombe 1998, paired data, method 10; `Stats.newcombe`);
  - a continuous paired quantity (HP lost, turns) is reported as the mean per-seed difference with a 95% percentile-bootstrap interval: 10,000 resamples of seeds on a fixed resampling stream (the core's derivation, seed 1, `bootstrap/<arena>/<metric>`), so the result is deterministic; the interval runs from the 251st resample from the bottom to the 251st from the top, so it holds the middle 9,500;
  - a ratio margin is a ratio of sums over seeds (counterplay's total over naive's), with the same bootstrap; there is no ratio when naive's total is zero.
- **Pass** = the point estimate meets the margin, and the 95% interval of the per-seed paired difference excludes zero (`Stats.margin`). A Newcombe comparison passes when the rate is lower and its interval excludes zero; one in which neither policy ever has the outcome is a finding, not a pass.
- **"Fires"** means the module's own events (`module` with its id) occur in at least 90% of single-department runs of its department at depths 2 and 5, by the explorer, with the module on.
- **Archetype arenas** (M3). Each arena is an ASCII stamp in `test/arena/<id>.txt`, with a goal and a turn cap of 200: a header (`arena`, `goal`, `cap`, `species`, `depths`, `kit`, `clock`, `seen`, `grade`, `metric`, `legend`, `variants`), a blank line, then the map, whose letters the legend explains; `tools/arena.js` reads it, and the format is written at the top of that file. A case written `like=<ch>` takes the glass, lock and loan of the case that letter's tile holds once the room is made, a mimic's disguise included, so the mimic arena's real case differs from the mimic's only in its accession number (§8.3). Since a label reads its species (§5.3), an exhibit of a species keeps the species' archetype, role, trigger and modifiers: a stamp that gives it others is refused (use a pack species that has them; an unnamed, role-only exhibit has no Behaviour line and is for the tools' own tests), and a swarm's species is placed as the `SWARM_BODIES[0]` bodies its line says, or the stamp is refused. A weapon, garment or instrument the stamp gives with no tier gets the lower tier on offer at the depth (`TIER_LOW_BY_DEPTH`); a tier is 1–4. HP lost is what the blows, shots and specials you took removed, summed, at most your maximum HP, and it counts your maximum HP if you die.
  - **The arena's kit** (one rule for every arena). At depth d you are the visitor `MEDIAN_MAX_HP` assumes, with a Certificate from each earlier department: grade d (§8.7: I, and one more a Certificate), with that grade's health (§8.1), wearing a weapon and a garment of the lower tier on offer at d (`TIER_LOW_BY_DEPTH`, §8.1), Balanced and Standard (the forms a run starts with) unless the stamp or a policy's kit names a form (§10.3's splitter row: naive's Light weapon), at Restoration level 0, and carrying what the stamp adds (an instrument, of that tier unless it says). Grade d always meets that tier's base grade (2t − 1 ≤ d), so only a Heavy form is ever short, by one grade at odd depths. So with the usual depths you are at grade II with 25 HP in T1 kit, and at grade V with 40 HP in T3 kit; a lock can be one grade above you (§8.3: up to the depth + 1), so the mimic arena's policies break the glass of a case whose lock they cannot open. A stamp's `grade` and a kit line's `tier=` set another grade or tier, for the tools' own tests only; none of the arenas below does. **For Julian** (Wave 3 tune): before, the plodder, darter, splitter, swarm, sniper, herald, warden and Watchman arenas used the starting kit at grade I, the kiter and reflector T3 at grade V, and the mimic grade VI; at depth 5 the starting kit died on every seed of the plodder, darter and splitter arenas, whatever it played.
  - **Each seed's setting.** Seed s uses depths[(s − 1) mod D] and the pack species of the archetype in turn, species[⌊(s − 1) / D⌋ mod S]; with the usual depths, 2 and 5, odd seeds are at depth 2 and even ones at 5, and every species meets both. A stamp's variant (such as which of two cases is the mimic) is drawn per seed on `arena/<id>/variant`, so paired runs share it.

  | Archetype | Arena and goal | Naive | Counterplay | Metric, margin |
  |---|---|---|---|---|
  | plodder | three plodders in a room with a doorway (one reaches you as easily in the open); kill them | fight in the open | fight from the doorway | HP lost ≤ 90% |
  | darter | a room, and you with a Pin-Driver; kill it | chase it | shoot it while it is out of reach, and corner it, its back to a wall, where it cannot step back | HP lost ≤ 70% |
  | kiter | pillars; kill it | straight line | approach behind pillars | HP lost ≤ 70% |
  | axis_sniper | cross to a door | straight across | step off its row and column | HP lost ≤ 50% |
  | splitter | a room with a doorway; kill it | a Light weapon, in the open | the Balanced weapon, from the doorway | HP lost ≤ 70% |
  | mote_swarm | a 1-wide doorway; kill all | fight in the open | fight in the doorway | HP lost ≤ 70% |
  | herald | a herald and 3 sleeping fodder within 6; reach the far door | walk up | break its line of sight | exhibits woken ≤ 50% |
  | tethered_warden | take the guarded item | walk in | lure it with the Tuning Fork | HP lost ≤ 50% |
  | reflector | a dish and an artillery piece behind it; kill the artillery | shoot through the dish | melee the dish first | HP lost ≤ 70% |
  | mimic_vitrine | two cases, one a mimic; open the real one | open the nearest | examine first | HP lost ≤ 30% |
  | night_watchman | the night watch begins; reach the exit | stay and fight | leave | death rate lower, Newcombe |

  **Two rows changed at the Wave 3 tune** (for Julian), each because, with the arena's kit, no play of the old row's counterplay could meet its margin:
  - **darter.** Cornering alone measured 0.835 against 0.70: a cornered darter trades blow for blow, which costs the visitor about half its health; driving it to a wall from the middle of the room costs about 3.5 blows you cannot answer, which even the best order of approach (worked out over the room's positions) does not lower; and the chaser's loss stops at its maximum health when it dies. The counterplay now also shoots it while it is out of reach, the design's other counterplay ("corner it against walls or glass; ranged", `design/vocabulary.md` §2.1), and the arena gives you a Pin-Driver, which naive carries but does not use; shooting alone gives 0.80, both 0.67. No room shape (smaller rooms, cases) or other approach (waiting for it) did better.
  - **splitter.** A Heavy weapon is not a counterplay to splitting under §8.1: by its label's count of hits to destroy a splitter and every half, it takes longer than a Balanced weapon at both depths and for both species, since its blows cost 150 ticks and have 1 less Acc and it saves at most 2 hits, and at depth 5 a T3 Heavy weapon is a grade short (2 Acc more); measured by depth, Heavy against Light is 0.84 at depth 2 and 1.00–1.03 at depths 3–6. And in the open every half strikes with the body's blow, so both policies died on most seeds. The arena now has a doorway, naive brings a Light weapon and fights in the open, and the counterplay keeps the Balanced weapon and fights from the doorway, where the halves come one at a time: 0.55 (the doorway alone, with a Light weapon, 0.71; the Balanced weapon alone, in the open, 0.89). The other ways to keep "big single hits" are a §8.1 change that makes a Heavy blow worth its time, or a split that needs a small hit.

- **Module margins** (M4), with metrics taken from cause records:

  | Module | Aware vs blind | Metric, margin |
  |---|---|---|
  | `unobserved_motion` | keeps Grazers in view vs ignores them | damage from flagged species, blind ÷ aware ≥ 2 |
  | `alarm_network` | avoids Waders' sight vs ignores them | blind raises ≥ 2 alarms a visit, and takes ≥ 1.15× aware's damage |
  | `copies_weaken` | breaks originals first vs nearest first | damage in copy-group fights, blind ÷ aware ≥ 1.25 |
  | `hourly_demonstration` | waits for the chime vs ignores it | damage from demonstrations, blind ÷ aware ≥ 3 |
  | `weather_cases` | breaks jars on purpose vs never | HP at exit as % of maximum, aware − blind ≥ 10 points |

- **The M3 battery** (`tools/battery.js`; `node tools/battery.js short|long`). Its runs:
  - **short**, check-all's (`test/m3-battery.test.js`, which fails past 60 s and prints the arenas it ran and the ms a step): the monkey in the test room on the golden seed for 2,000 actions; a 1,000-action monkey in each department at depth 3; seed 1 of each arena found, with both its policies (a stamp `test/arena/<id>.txt` whose policy file `tools/policies/<id>.js` registers `<id>.naive` and `<id>.counter`; another stamp is skipped and named); a 1,000-turn soak on M.11 at depth 3, the monkey never leaving and your HP kept at 1 or more, which crosses the bell and the night watch;
  - **long**, each milestone's (its time reported, not held to anything; `--slice` runs it in pieces): the golden monkey's 10,000 actions; 1,000-action monkeys in each department at depths 1, 4 and 7, seeds 1–20; every arena found × both policies × seeds 1–200; wander in each department at depths 1–7, seeds 1–50, capped at 1,000 turns; a 10,000-turn soak in each department at depth 3.

  A monkey's visit that ends (you die or leave, or every exhibit is gone) starts the next on the next seed, as `Monkey.run`'s do. After every step of every run the battery checks: the state is plain data; every event passes its cause schema (`Causes.check`) and reads as a sentence with no "undefined", "NaN", "[object" or "null"; every invariant (§5.3 check 1); every special's damage to you equals its mark on your tile in the view model taken before the step, a beam sent back by a reflector counting as its shooter's (criterion 3); completeness (§5.3 check 4): no exhibit causes an event kind that is neither universal nor covered by a part of its Behaviour line, where who causes an event is its cause's `by`, or else the acting subject of a kind whose subject acts (who moves, opens, strikes, marks, enters), never one who only suffers it; `state.rng` holds at most 150 streams and `state.causes` at most 64 records; in a run's first state every exhibit not dormant has the story a room, an arena or a department starts it with (§3.4), which `Recap.fromLog` reads there and so is held to that rule, not to itself: it woke at that state's turn, `awake` if its trigger stands for the wake clause and `placed` otherwise, and a hunter's hunt began then for the same cause; and at your death, the recap's killer, wake turn, wake trigger and hunt turn equal those rebuilt from the run's full event log by `Recap.fromLog` (criterion 6): the killer is the `by` of your death's cause; its waking is its last `woke` event (the Night Watchman's and a split half's creation included), its hunt its last `hunting` event or a creation into a hunt; and an exhibit not dormant in the first state, whose starting waking no event tells, is read from that state until an event says otherwise. A step that throws, a policy that fails and a policy's illegal action count too. Each failure keeps the replay that reaches it, which `node tools/report.js --cards` shrinks to a crash card.
- **A failing comparison is a finding, not a flake.** It is fixed in the rule, the content or the margin, and the log says which.

### 10.4 Save tests

- **Round trip:** save, load, and continue 1,000 actions from both; the hashes match.
- **Kills.** In test mode the page logs `W-BEGIN seq hash` when a transaction opens and `W-DONE seq` on its complete event. Of 100 kills per milestone from M5, 40 are fired 0–5 ms after a `W-BEGIN`, so they land mid-write, and 60 at uniform random times. A storage shim also fails, truncates or corrupts writes in turn. Pass: the resumed `seq` lies between the last `W-DONE` and the last `W-BEGIN` and its hash equals that `seq`'s logged hash, or it is lower and the fallback sentence is shown. A resumed record with a bad checksum is a failure.
- **Hidden pages:** the hidden-page save is tested on its own.
- **Versions:**
  - every `v` ever released has a fixture save in `test/golden/saves/` that must load or retire with its sentence;
  - the visitor's card and the archive round-trip.
- **WebKit and the iPhone:** Julian runs the same kill script in WebKit on the Mac, and the iPhone checklist in `DEVELOPMENT.md` by hand, once per milestone from M5.

---

## 11. Milestones

Each milestone ends in an acceptance test that a command shows passing, recorded in the validation log. Weeks are estimates, in AI-assisted sessions.

| | Weeks | Builds | Accepted when |
|---|---|---|---|
| **M0** | 1 | The core skeleton: the repo layout; `rng.js`, `state.js`, `int.js`, `grid.js`, the integer scheduler, `step()` with move, wait and bump attack in a test room, and `Step.legal`; `numbers.js` and its lint; `lint-core.js`; the plain-data check; the test runner; `build-single.py`; `check-all.sh`; the hash page; `DEVELOPMENT.md` | A 10,000-action monkey log gives the golden hash twice in Node, again when the state is cloned after every step, and the same in Chromium on `dist/accession-hash.html`; scenario tests pin the scheduler's ties, turn boundaries, the waking beat, the damage floor and the hit boundary; a planted `Math.random`, float and undefined each fail; the numbers lint catches a planted mismatch; `dist/accession.html` opens from `file://` and shows the test room |
| **M1** | 1–3 | Layout ported from `prototypes/layout/proto.js`: the enfilade and quadrangle embedders with the labyrinth and court fillers; role keys; the Centrepiece hall rules (a lectern at exactly `VIEW_DISTANCE` walking tiles with line of sight, the arena); room numbers; `L_tour`; the validators that layout alone decides (LV1, LV3–5, LV8–10, LV14 with each programme's identity checks), each reporting the tiles at fault; local repair (both of the prototype's LV4 repairs), up to 4 reseeds and a certified fallback per programme. LV6, LV7 and LV11 need exhibits and arrive in M4 | 3 programmes × 1,000 seeds: no unreachable exit, fallback ≤ 1%, p95 ≤ 25 ms in Node; the fallback path itself is certified by a test that forces it; the locality test (`design/layout.md` §12.2) runs on every curated room over 100 seeds and shows that the perturbed room changed in most of them; planted faults (a blocked gate, a cut room, a column in the arena) are caught, and their plans print as text maps with the offending tiles marked |
| **M2** | 2–4 | Look and read: the view model; the renderer interface of §6.2; TopDownView; about 20 silhouettes and their close-ups; palettes; the label panel and the strip; about 25 pictograms; one-button input and the keys; zoom; the top bar; "How the museum works"; the revert test and the guard, against the 3D view as it then stands | No horizontal scroll at 390×844 or 1280×800; no UI target under 44 px, and the 48-px zoom step exists; the tap-tolerance check passes in top-down; a left-click-only script walks, examines and reads; every hostile in the viewport carries the hostile mark, by `renderer.inspect()`; the colour check passes (under the Machado et al. 2009 protanopia, deuteranopia and tritanopia simulations, the reserved colours differ pairwise by CIEDE2000 ΔE ≥ 15, and each differs by ΔE ≥ 10 from every floor and wall colour); the revert test passes |
| **M2b** | 1–2, alongside M3 | **Board3DView behind the setting** (§6.2), vendoring (§6.4) and the 3D checks; shown to Julian side by side with top-down | The 3D checks pass (§6.3); every M2 screen check passes in both views. M2b must pass before M7; if it has not by the end of M6, `tools/remove-3d.sh` is run and the log says why |
| **M3** | 3–6 | Exhibits wake: modes, the ring, noise, pips and special triggers; combat, specials and the odds readout; cases and glass; the clock with its two stages; regeneration and benches; the kit and Restoration; the 8 consumable kinds with seals and gentle identification; the 11 archetypes of §5.5; cause sentences and the death recap | For every Acc − Eva difference and modifier in the slice, the shown hit chance equals the number of d100 faces that hit, and 10,000 rolls fall inside its 99.9% Wilson interval; for every attacker and defender in the packs at depths 1–7, the odds readout equals an independent enumeration; each special's dealt damage equals its mark in the view model taken immediately before the resolving step; each archetype's counterplay bot beats its naive bot (§10.3); every Behaviour-line clause holds as an invariant over the M3 sim battery and its scenarios are sensitive (§5.3); every event's cause passes its schema, and for every death in the battery the recap's killer, wake turn and wake trigger equal those reconstructed from the full event log |
| **M4** | 5–8 | Three departments: the S.9, A.4 and M.11 packs, with their Intro stamps and gallery mapping; population, the safe zone and LV6, LV7 and LV11 (the worst-case runner); the five modules in the form of §5.4; the remaining archetypes; three Centrepieces (two fights, one treasure); viewing; Certificates, the grade and the 8 perks; generated Behaviour lines | Each module fires (§10.3); each rule-aware bot beats its rule-blind bot (§10.3); no soft-lock in a 10,000-turn soak per department, restarting on death, where a soft-lock is an exception, a failed state or invariant check, `Step.legal` holding no time-costing action, no exit door reachable over tiles you could step onto (ignoring actors and statuses; a sealed hall's doors count as reachable while its Centrepiece lives), or 200 turns in which the state hash, ignoring tick, turn and rng, cycles with no damage dealt or taken, each printed as a crash card; the worst-case runner passes on 1,000 seeds per department with no exhibit removed (moves are logged and counted); the expert bot's report is filed; the language-model reader's question set and answer key are committed, and its table is filed when an API key is available, otherwise logged "pending: no API key" |
| **M5** | 7–9 | A run: the Entrance Hall and the Orientation room; doors, placards and the sequencer; two Stair Halls; the Exit; the death label; Your Collection and accession; the Catalogue; autosave, the visitor's card, the archive; replay links; builds kept | With `--invulnerable`, the explorer reaches the revolving doors in 200 of 200 seeds, every failure a crash card; the completion rate with normal rules is reported with its interval and death-cause table, not gating; a reload mid-run resumes with an identical hash; the save tests of §10.4 pass in Chromium; Julian's WebKit and iPhone checks are requested, and their rows read "pending" until they report; the predicted run lies in 25–35 minutes, where it is the sum over six department slots of the median per-department "decision turns" (time-costing actions, not counting the second and later turns of a rest or sit streak) ÷ 55, plus label opens × 10 s, plus 6 minutes of halls, doors and the Exit, taken over invulnerable runs (55 and 10 s are placeholders the M7 fit replaces) |
| **M6** | 9 | Sound | Every informative sound has a caption and a visual twin; muted play loses no information (a test compares the event-to-cue table) |
| **M7** | 10 | **The slice gate:** Julian plus 3–5 players who have not seen the design, on phones and laptops, with sessions logged and replays kept; half start in each board view | Comprehension measures exclude Julian. **Wake causes:** after each department the player watches two wakes chosen by rule from their own replay (the last wake before damage they took, and one drawn by seed) and answers "Why did it wake?"; Julian scores it against the trigger class in the cause record; pass at ≥ 70% pooled, with its interval and per-player rates. **Rules, not art:** ≥ 60% of players describe the departments by their rules. **The nine systems:** each is scored against a one-line rubric committed before the gate; any system fewer than half can explain is flagged for redesign. **Time:** turn rate, decision turns and label opens are fitted to the three-term model of DECISIONS on every department visit; pass if the predicted median department is at most 4.5 minutes and the predicted run 30 ± 5 minutes. **Board view:** taps, mis-taps (a tap followed by an undo-like move within 2 s) and switches are logged per view; the view decision is a judgement recorded with those numbers. **Decided here from data:** department size and the clock multiplier; which board view is the default, or whether 3D goes; which department-owned systems survive; what is built next |

---

## 12. Working rules

- **Order.** Milestones are built in order. Within one, the core comes first, then its tests, then the view.
- **Before each commit:** `check-all.sh` passes, and `dist/accession.html` is rebuilt.
- **At the end of each milestone:**
  1. an adversarial review (consistency with this file, correctness, explainability, and for M2 the revertibility of the 3D view);
  2. its fixes;
  3. the acceptance run.

  The results go in the validation log before the milestone is called done.
- **The validation log** in `DEVELOPMENT.md` gets one entry per milestone and per significant change: the date, the commit, the commands run, the numbers with their n and seeds, what failed and what was changed, and links to replays. Every `coreHash` a report or log entry links is kept as `dist/builds/<coreHash>.html` in the same commit, and `check-all.sh` fails if a linked build is missing: a link is that path, `dist/builds/<coreHash>.html` (a coreHash only named is not one), and check-all's linked-builds step (`node tools/report.js --check-builds`) reads every one in `DEVELOPMENT.md`.
- **Changes to this file** happen in the same commit as the code they describe. A rule or number that moves gets a line in the log saying why.
- **Commits** go to `main` and are pushed, as the repository's rules say. Messages say what changed and what was checked.
- **Reporting to Julian** happens at the end of M2, at M2b (both views, side by side, on their phone and Mac), at M4 and M5, and at the gate.

---

## 13. Risks and open points

| Risk | What happens |
|---|---|
| **The 3D view costs more than it gives.** It may be slower on older phones, harder to tap, or tempt rules into the renderer | The renderer interface keeps it separate, the revert test keeps it removable, and the gate decides with data |
| **Departments run long.** The 30-minute run rests on an assumed 50–60 turns a minute | The bots' prediction is checked at M5, and the gate measures the real turn rate; departments shrink before the count drops (DECISIONS D6) |
| **The ring is too lenient or too harsh** | `RING_*`, `NOISE_*` and `PIP_DECAY_TURNS` are the first numbers the paired bots tune; each change is logged |
| **The provisional role rows** (support, swarm, ambusher) are guesses | M3's arena bots set them; until then they are marked provisional in §8.10 |
| **Modules may not fit the form** (§5.4). `unobserved_motion` and `alarm_network` touch movement and AI, not just effects | The bespoke escape hatch, logged as evidence for D2 |
| **No WebKit here** | Julian runs the WebKit kill and hash checks on the Mac, and the iPhone checklist, per milestone; until then those rows in the log say "pending", not "passed" |
| **Repetition within a run.** In the slice each department appears twice in a run, which may bias minutes per department | Gate measurements are split by first and second visit |
| **Art volume.** About 20 board sprites and 20 close-ups by M2, about 35 of each by M4 | Close-ups for the M4 species may land late; the label then shows the board sprite scaled, marked as a placeholder in the ledger |
