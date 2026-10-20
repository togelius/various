# Critique: can this be built, in this repo, with AI assistants doing most of the typing?

*Lens: a pragmatic technical lead who will build ACCESSION in `togelius/various`. I read the repo's conventions and the drafts for scope, schedule, technical risk and technical errors. Review only; no draft or repo file was changed.*

**What I read.**
- In full: `brief.md`, `direction.md`, `research/tech-art.md`.
- The technical sections of every draft:
  - `core-systems.md` §§0–6, 8–17;
  - `difficulty.md` §§0–3, 8, 11–13;
  - `layout.md` §§0–2, 12–13, 17–21;
  - `pipeline.md` §§0–5, 7, 11–14;
  - `meta.md` §§0, 3, 4.4, 14–18;
  - `vocabulary.md` §§0, 5.4, 6, 11, 15;
  - `samples.md` §§0, 6–8.
- From the repo:
  - `README.md`, `AGENTS.md`, `CLAUDE.md`;
  - `steelhag2/DESIGN.md` §§1 (D2), 9, 11;
  - `clack-stack/DESIGN.md` §14 (the newest build plan in the repo);
  - `grift-city/DEVELOPMENT.md`;
  - `absorb-this/tools/README.md`;
  - the file listings and line counts of `vanguard-zero/`, `scriptprof/`, `grift-city/` and `absorb-this/tools/`;
  - `accession/prototypes/`.
- I skimmed the two sibling critiques (`critique/fun.md`, `critique/pcg.md`) so as not to repeat them. Where I overlap I say so and add only the technical angle.

**What I checked rather than read.**
- **The layout prototype.** I re-ran `accession/prototypes/layout/proto.js` (Node 22.22, this container). Enfilade came out at 9.1 ms p50, 14.5 ms p95 and 74 ms max, with 0 failures in 90 layouts. That matches L §2.1.
- **Every Claude API claim**, against the bundled `claude-api` skill docs (model table cached 2026-10-06). Results are in §5.
- **The repo's real overrun ratios**, from line counts and git history (§1.3).

Abbreviations follow the drafts: CS core-systems, D difficulty, L layout, P pipeline, M meta, V vocabulary, S samples, TA tech-art.

---

## 0. Verdict

- **The technical foundations are right.** These choices are cheap in a turn-based game and fit the repo:
  - a pure, seeded, integer core that runs headless in Node;
  - classic scripts with a single-file build;
  - code-drawn index-grid art;
  - LLMs offline only, choosing from closed enums and never writing numbers.
- **The scope is not buildable as a v1.**
  - As drafted, the design is about 50,000–70,000 lines of code. It also needs about 150 vocabulary ids, each with five artefacts, 30 curated departments with about 50,000–70,000 words of text, and a second product (the LLM pipeline with its curator console).
  - That is three to four times the largest thing in this repo. The repo's own history says plans grow three to four times in the building.
  - No draft has a production section, a slice or a schedule.
  - The sections' "never cut" lists, taken together, are most of the design.
- **The determinism contract is realistic in plain JS, but the drafts break it in five places.** All five are fixable (MAJOR 1).
- **The compute arithmetic is correct, but its inputs are unmeasured, and the loop as drafted is unusable while the rules are still changing.**
- **The fix is mostly ordering, not deletion.**
  - Build a three-department slice on two layout embedders, with hand-authored packs (the samples already contain the text) and no pipeline. Run a written human-play gate, as steelhag2 does.
  - Run one off-critical-path API spike to de-risk the pipeline.
  - Measure the five numbers every draft guesses at.
  - Then build the factory against the rules that survive.

## 1. Size: the design as drafted, a credible v1, and a slice

### 1.1 Code

These are estimates by area, in the repo's density. They are extrapolated from the prototypes, the repo's sibling games and the systems the drafts specify. Treat them as ±40%.

| Area | As drafted (v1 leans) | Credible v1 (after §3's cuts) | Slice (§3) |
|---|---|---|---|
| Core simulation (scheduler, combat, statuses, awareness with 13 triggers, noise, 5 lux bands, sight, guards, Custody, 2 alarm levels, clock, furniture, vitrines, 7 hiding methods) | 7,000–9,000 | 5,000–6,500 | 3,000–4,000 |
| Mechanics content (25 archetypes, 8 specials, Masterpiece assembly, 30 primitives, 12 consumables, curios and instruments, 13 modules, 32 perks, sketch, 2 classes, 6 NPC services, attribution ladder, forgeries) | 9,000–12,000 | 5,000–7,000 | 2,500–3,500 |
| Run structure (sequencer, door graph, Stair Halls, Exit and Registrar, balancer, encounter budgets) | 2,000–3,000 | 1,500–2,000 | 500–800 |
| Layout L1–L8 (6 programmes, staff layer, vestibule, Intro templates, curation, lighting, population, LV1–LV14, repair, fallback; the prototype is about 860 lines and covers part of L2–L4) | 5,000–7,000 | 3,500–4,500 | 2,000–2,500 |
| Runtime text (Directory grammar, domain-keyed replacement grammar, credit lines, numbering) | 800–1,200 | 600–900 | 200–400 |
| Art and render (palettes and reserved colours, grid decoder, parts and ornaments, Bollinger masks, paintings, 3/4 walls, light pools, 45 pictograms at 2 sizes, clock dial, floor plan), plus grid data | 4,000–6,000 | 3,000–4,000 | 2,000–2,500 |
| UI (HUD with six meters, tombstone line, label panel, odds readout, bag, quickslots, map, Entrance Hall screens, menus, settings, accessibility) | 5,000–7,000 | 3,500–5,000 | 2,000–3,000 |
| Audio (vanguard-zero fork, motifs, ambience, stingers) | 1,500–2,500 | 1,200–1,800 | 800–1,000 |
| Meta and persistence (M's 15 layers; M §3.1 itself estimates 30–45 developer-days) | 4,000–6,000 | 2,000–3,000 | 400–700 |
| Tools: check, lint, determinism, bots and personas, calibration, the D §8.8 dashboard, qd, shots | 6,000–9,000 | 4,000–6,000 | 1,500–2,500 |
| Pipeline `gen/` S1–S7, curator console, atelier | 5,000–8,000 | 2,500–4,000 (authoring-aid mode, §2 MAJOR 5) | 0 (spike: about 500, throwaway) |
| **Total** | **about 50,000–70,000** | **about 32,000–45,000** | **about 15,000–21,000** |

### 1.2 Content and other work

| Item | As drafted | Slice |
|---|---|---|
| Vocabulary ids at launch | about 150 (V §0), each with a pure function, an icon, an Essential-line template, counter tags and a micro-arena test with two scripted bots (V contract 7): about 750 deliverables | about 45 |
| Pictograms | about 45 at 8×8 and 12×12 (CS §13.4) | about 25 |
| Sprite sources | 40–60 silhouette grids, ornament overlays, a mask per archetype (25), about 30 material ramps, tiles for 16 fixtures and 5 surfaces | about 20 silhouettes, 3 palettes, 10 fixtures |
| Intro templates to certify | at least 26 (13 modules × 2), across 6 programmes and 3 positions (L §20, risk 6) | 4 |
| Departments | 30 at launch, about 700 authored or generated entities | 3, hand-authored |
| Department text | about 1,700 words each (S §0.3, measured), so about 50,000 words, plus up to about 20,000 more if CS §6.4's twelve 40–70-word identifying consumable labels per department stand | about 5,000 words, which already exist in S §§2–4 |
| Other text | about 8,000 words of barks (M §12.5); the Directory lexicons (about 250 fillers and 30–60 hand lines); 60 constraint cards; 48 domains; 8 voices; 6 exemplar sets | about 20 barks; a static Directory |
| LLM pipeline | 4 generation stages, about 25 validators, repair operators, batch orchestration, a theme archive, a curator console. Tokens are trivial (about $35 a batch). Wall-clock is 1–3 days a batch, because 6–9 batch round trips are chained (§5, claim 2) | none; a one-week API spike off the critical path |
| Julian's curation | P: 8 hours per 48 presented. My estimate: 20–30 hours (§2 MAJOR 3) | about 3 hours of editing the samples |
| Compute | D: 1.4–4.8 CPU-hours per department and 145 CPU-hours per full-pool recalibration. My view: unknown to within about 5× (§2 MAJOR 2) | negligible |

### 1.3 Calibrated against this repo

- **Clack Stack.**
  - Its build plan budgeted 2,700–3,000 lines (`clack-stack/DESIGN.md` §14).
  - It shipped 11,460 lines of `index.html` plus about 7,000 lines of `tools/`, over 10 days of AI-driven sessions and three revisions (git log 2026-10-10 to 10-20).
  - Lesson: AI assistants type fast (about 2,000 working lines a day), and plans grow about 4× once tuning starts.
- **Stålhagen II.**
  - D2 planned 28,600 lines, and 17–18 months for one person with an AI pair.
  - What exists is a 4,220-line vertical slice.
  - Lesson: in this repo, large designs get built as slices.
- **vanguard-zero** (the closest art and audio precedent) is about 7,800 lines in its dist plus about 2,500 lines of agent tools.
- **What follows.**
  - The slice is about 4–8 weeks of AI-assisted sessions, including a human playtest. Most of the calendar is play and decisions, not typing.
  - A credible v1 is about 4–7 months.
  - The design as drafted is 9–15 months before tuning. The risk sits in integration and balance iteration, not in code volume.
  - These are guesses with the repo's own overrun ratio built in.

---

## 2. Findings, ranked

### BLOCKER 1. No production plan, and the union of "never cut" lists is most of the game (Design and process)

**Where.**
- No draft has a production section.
- D §2.5 and §8.7 refer to "build milestone M2" and "M4". Those are TA §6.3's research-brief milestones, which no draft adopts.
- The never-cut lists: CS §17 (9 systems), V §15 (6), L §21 (7), D §12 (6, including "b(d) calibration with the six-persona battery and gates G1–G5"), P §13 (8, including S2, the S3 quick screen, T1 and sensitivity) and M §17 (5 layers).

**What is wrong.**
- The brief says "before we start building… surface key design and technical decisions." The largest technical decision, what gets built first and what the first playable is, is not in the document.
- Each section protects its own core. Taken together, the protected set means the first department cannot ship before all of these exist:
  - the persona battery and calibration;
  - the Intro certification;
  - the pipeline's S2, S3 and T1;
  - the action-log save;
  - the Atlas with ordinal gating;
  - the attribution ladder;
  - the 12-kind seals.
- At about 50,000–70,000 lines (§1.1), this is three to four times the repo's largest game. It is twice the 28,600-line Stålhagen II plan, of which only a slice was built.
- steelhag2/DESIGN.md §§9.3 and 11 shows what Julian is used to receiving: milestones with acceptance tests, two gates, a cut order across the whole game, schedule tracks by team size, a size budget, a risk register and "what not to build".

**Why it matters.** Julian asked for the decisions to go through *before building*. Without a slice and a cut order, every other decision is made against an unbuildable whole. Each section's cut line also optimises its own section, so there is no single order to apply when the schedule slips.

**Resolution (fix).** Add a Production section in steelhag2's shape:
1. The vertical slice (§3 below).
2. Milestones with `?scene=`-style hooks and acceptance tests (§4).
3. One slice gate, judged by humans with a written procedure.
4. One cross-section cut order.
5. A size budget per module.
6. A risk register.
7. A "what not to build" list.

Replace the six never-cut lists with one *slice contract*: what must exist for the first playable, and nothing else. (This overlaps fun MAJOR 10. My addition is the arithmetic, the cross-section union and the repo's own overrun ratios.)

### MAJOR 1. The determinism contract is realistic in JS, but the drafts break it in five places (Errors)

**What holds.** A turn-based core with integer ticks, named streams and a `step(state, action) → events` mutator is easy to keep deterministic in JS. IEEE-754 `+ − × ÷` are correctly rounded in every engine, and integer arithmetic below 2^53 is exact. TA §3.2's contract is sound. The layout prototype already obeys it (no `Math.random`, `Date.now` or transcendental `Math` calls).

**Where the drafts break it.**
1. **Transcendental functions in runtime code.**
   - D §2.4's sequencer weights S1 and S2 are `exp(…)`.
   - D §3.4's encounter budget uses `e^{b(d)}`, which the population pass (L §7.2) and V §10.4 spend at runtime.
   - TA §3.2 bans these in `core/` by lint, and the spec leaves `exp`, `pow`, `sqrt` and their relatives implementation-approximated.
   - *Fix:* the balancer writes integer per-mille budgets per depth into the pack (8 depths × 1 integer). The sequencer reads integer weight tables (complexity offset → weight; quantised theme distance → weight).
2. **Float theme embeddings at runtime.** D §2.4's theme distance takes `‖embedding difference‖` from vectors shipped in the pack.
   - *Fix:* precompute the pairwise distance in the pack build, quantised to 0–100 (30 × 30 bytes). No vectors and no `sqrt` at runtime.
3. **Runs are not reproducible from `pack · runSeed`.**
   - TA §3.2 says "a run's share code is `pack v · runSeed`". D §2.2 says "two players on the same daily seed who make the same choices see the same doors".
   - But the sequencer's S4 weight uses per-player novelty counts (D §2.6). Your pool depends on accessioned kinds, the Loan, Atlas ordinal gating, Gift Shop toggles and the Patron tier (M §§4–8).
   - So doors and loot depend on meta state. Share codes, daily seeds, replays-as-bug-reports and the persona "arrival library" all silently assume otherwise.
   - *Fix:* a replay header carries `{packVersion, coreVersion, runSeed, metaDigest, metaSlice}`, where `metaSlice` is exactly the meta fields the run reads. Daily and Seeded visits run with a fixed meta slice (M §15.10 already half-says this) and with S4 off.
4. **RNG keys disagree.**
   - P §3.10 derives every per-department stream from `number@digest`, so a label typo reshuffles layouts and loot and invalidates every stored simulation result.
   - L §12.1 keys layout streams by `accession@layoutPin`, so that text edits never move a layout.
   - TA §3.2 uses `deptId = hash of the department JSON`.
   - *Fix:* RNG keys use `accession@{layoutPin, balancePin}` only. The digest pins content for replay validation and never seeds anything.
5. **Action-log replay across code versions.**
   - M §14.3 restores a run save by replaying the action log from the last snapshot.
   - The repo pushes to `main` and hosts from it, so any deploy mid-run changes `coreVersion`, and the replay diverges or must be refused.
   - *Fix:* see MAJOR 7.

**The rest of the lint the contract needs.** TA lists `Math.random`, `Date.now` and `performance.now`. AI assistants also reach for these, so ban them in `core/`:
- every `Math.*` except `abs`, `min`, `max`, `floor`, `ceil`, `trunc`, `sign`, `imul` and `clz32`;
- the `**` operator;
- `localeCompare` and `Intl` (locale-dependent ordering);
- `toFixed` and `toString(radix)` in anything hashed;
- `for…in`;
- `sort` without an explicit total-order comparator with a tie-break by id (inconsistent comparators order differently in V8 and JavaScriptCore).

Also:
- Hash state through a canonical serialiser, not `JSON.stringify`.
- Encode the layout's typed arrays (L §1.2: `Uint8Array`, `Int16Array`) explicitly in snapshots, because they do not round-trip through JSON.
- Prefer integer per-mille to float multiplier chains. `B × 0.75 × 0.8 × 1.1` (CS §5.1) is deterministic but rounds unpredictably at `round10` boundaries.

**How to verify.** `tools/check.js --hash` steps one scripted 10,000-action log in Node. A Playwright test runs the same log in Chromium, WebKit and Firefox via `page.evaluate`. All four hashes must be equal. Run this per commit; it is about 20 seconds.

### MAJOR 2. Compute: the arithmetic is right, the inputs are guesses, and the loop does not fit development (Error and Design)

**Where.** D §8.7; P §3.6 and §3.11; TA F4.

**What is right.** I re-derived D's table:
- 6 × 5 × 3 × 120 = 10,800 plays × 600 turns × 1 ms = 1.8 CPU-hours, and the rest follows.
- The standard error at n = 200 and p = 8% is 1.9 points.

**What is wrong or unsupported.**
1. **"1 ms per turn" is an estimate built on rot.js *primitive* timings, not on a persona.**
   - The cost of a persona decision is several A\* or Dijkstra queries to candidate goals (cases, exits, Highlights, benches, hiding spots), threat projection, and, for experts, 2-turn lookahead on cloned state.
   - A `structuredClone` of a department state is roughly 50–100 µs. Lookahead over about 8 actions × 8 replies is 64 clones, or 3–6 ms per expert decision. That is not "3×".
   - Dormant exhibits are cheap, but every one needs a SEES_YOU and OBSERVED check each turn.
   - My guess is 0.3–5 ms per turn depending on engineering, so D's "1.4–4.8" is a point estimate wearing a range.
2. **The turn count is pessimistic.** D assumes 600 turns per department play. L §17.2's model of the measured layouts gives about 250–280 for a median Department. That halves compute, if it holds.
3. **P and D disagree by 2.5–8×** on what S3 costs (34 core-minutes against 1.4–4.8 CPU-hours). pcg M4 covers this; I agree.
4. **TA F4's "four cores give thousands of department playthroughs per minute"** needs about 0.2 ms per turn at 300 turns. At D's 1 ms and 600 turns, four cores give about 400 per minute.

**Is it acceptable?**
- 1.4–4.8 CPU-hours to recalibrate one changed department overnight on this 4-core container is fine.
- A full-pool recalibration after any rules change (145 CPU-hours, or 36 hours on 4 cores) is not acceptable during development, when combat, clock and stealth numbers will change daily.

**Resolution.**
- **(fix) A measurement gate before scaling.** At the harness milestone, the median persona on a real department must run at ≤ 1.0 ms per turn p50 in Node over 200 seeds, or the harness is optimised before any calibration is built on it. The levers:
  - typed-array grids;
  - one shared Dijkstra map per goal type per turn, not one per actor;
  - incremental FOV;
  - lookahead with an undo log instead of clones.
- **(design, for Julian) Two calibration modes.**
  - *Development mode:* the D §8.8 canary of 3 departments × 6 personas × 50 seeds. Its 0.35-logit tolerance is replaced by "direction of change" checks.
  - *Ship mode:* the full grid, but with common random numbers, 3 b-values, 2 depths and 80 seeds, which is about 2,900 plays, or 0.2–0.8 CPU-hours.
  - Full-pool recalibration is weekly, on a rented 32-core machine (4.5 hours at D's own numbers).
- Run sims across `worker_threads`, one per core. Record the source hash with every result (absorb-this practice).

### MAJOR 3. Julian's curation time is underestimated two to three times, and it is the budget the drafts say binds (Error)

**Where.** P §3.9 ("about 6 minutes per presented department, plus playing one in three for 10 minutes … about 8 hours"); P §1.3, §12 risk 1; S §0.3.

**What is wrong.**
- A presented department is about 1,700 words of player-facing text (S §0.3, measured). At 250 words a minute, reading it alone is about 7 minutes.
- The console also asks Julian to check:
  - the trace map;
  - the spec;
  - persona bars and fingerprint;
  - 6 floor plans;
  - sprites under the palette;
  - every label's Essential line against T1.
- K.6 alone has five systems (S §8.1).
- A careful accept is 15–25 minutes, and one with E1–E4 edits is longer. 48 presented is 12–20 hours of review plus about 3 hours of play: **about 15–25 hours per launch batch**, not 8.
- The drafts argue, correctly, that Julian's hours are the binding cost. So D-P2 (pool size), D-P8 (curation depth) and the v1 date all move with this number.

**Resolution.**
- **(fix)** Measure it. In the API spike (§4, P0), Julian reviews 10 generated departments with a stopwatch.
- **(design, for Julian)** Options:
  - (a) tiered review: a 60-second gut call on everything, and the full console only on "keep" and "maybe";
  - (b) a hard text budget per department (for example 1,000 words, with consumable skins as names only, under V's D-V7(b) binding);
  - (c) a launch pool of 18 rather than 30, growing by update.
- Put the measured minutes per department into P §3.11.

### MAJOR 4. The layout generator is the right design at the wrong size for v1 (Design)

**Where.** L as a whole: about 20,000 words, 6 launch programmes plus 6 later, L1–L8, LV1–LV14, at least 26 Intro templates to certify, and knob MAP-Elites. L §19.2 shows the six programmes are three macro shapes.

**What is wrong.**
- The prototype is the best evidence in the whole document. It is fast (verified: 9 ms p50 and 14.5 ms p95 in Node), robust (0 retries) and it falsified the clock's assumptions.
- But the spec builds out every programme, the staff layer, the ticketed room, closed-for-reinstallation detours, hinged panels, balconies, the glazed-screen variant, bay templates, band styles and knob archives before anything is playable.
- L1, the narrative graph, is not prototyped at all.
- The Intro templates multiply with modules × programmes × positions (L §20, risk 6), and each needs offline limited-agent certification, which needs the persona harness.

**Resolution (design, for Julian).**
- **Slice: two embedders, three programmes.**
  - The enfilade.
  - The quadrangle scaffold with two fillers (sculpture court, case labyrinth).
  - Department size only.
  - No staff layer unless `alarm_network` needs a patrol corridor.
  - One Intro template per slice module, certified by a scripted aware-versus-blind bot pair rather than the persona battery.
  - Keep LV1–LV8, the worst-case runner, the certified fallback and the layout pin.
- **v1: four programmes on three embedders.** Add the rotunda; keep L-D3(a).
- **Defer:**
  - knob MAP-Elites (hand presets: L cut line 2);
  - the ticketed room;
  - closed rooms;
  - glazed screens;
  - band styles;
  - staff plans as items;
  - balconies (except with `tide_cycle`);
  - the offline research metrics.
- Prototype L1 before writing more of it.
- **Do not grow departments to fit the clock** (L-D1(b)). Measure turns per minute in the slice first. fun MAJOR 4 covers the clock side.

### MAJOR 5. The LLM pipeline is a second product on v1's critical path (Design)

**Where.** P §§3–4, §13; D-P1(e) puts the curated batch pipeline in v1.

**What is wrong.**
- S0–S7 with about 25 validators, grammar repair, two archives, a curator console, packaging and CI coverage is about 5,000–8,000 lines.
- It also needs:
  - prompt tuning per stage;
  - 6 exemplar sets;
  - 60 constraint cards;
  - 48 domains;
  - 8 voices;
  - the banned lists.
- It churns with the vocabulary: S §8.2 found 11 vocabulary gaps in just 5 hand-worked departments. Every vocabulary change regenerates prompts and re-simulates departments (P §12, risk 5).
- **Wall-clock.** S1 → S2 (+ up to 2 repairs) → S3 → LLM repair → S4 (+ up to 2 label repairs) → S5 is 6–9 dependent batch round trips. Most batches end within an hour and expire at 24, so a launch batch is 1–3 days wall-clock, not "within an hour". Prompt development needs the interactive API, which doubles a trivial cost.

**Resolution (design, for Julian).**
- **(a) Authoring-aid mode for v1.** Claude *sessions* write departments against the machine-readable registry, using the same S1–S4 contracts and the same validators run as a CLI lint, with Julian editing in a text editor. The batch pipeline, the archives and the console become v1.x, once the vocabulary has stopped moving. P already lists this as the outcome of D-P1(a); it is also the cheapest route to v1's 18–30 departments.
- **(b)** Keep the batch pipeline in v1, but start it only after the slice gate and the vocabulary freeze.
- **Either way,** run the one-week P0 spike now (§4), off the critical path. Use S1 and S2 only, with structured outputs carrying the registry's enums, on 20 recipes. It answers the questions that matter:
  - whether the S2 schema compiles at that size;
  - the static pass rate after repair;
  - cost per department;
  - Julian's minutes per department.

### MAJOR 6. The vocabulary is sized for the full game, and its registry exists twice (Design, plus an Error)

**Where.** V §0 (about 150 launch ids, five artefacts each), V §11.1, CS §§6.3–6.4, §8.5, §13.4.

**Errors.**
- **Two consumable registries.** CS §6.4 lists Consolidant … Evacuation Notice. V §5.4 lists `tonic` … `closed_sign`. Only four names are shared.
- **Two instrument sets.** CS has the Flash Camera, Tuning Fork, Glass Cutter, Window Pole, Catapult and Magnifier. V has `animate_ally`, `extinguish`, `recase` and `pass_wall`.
- S is written against V. D §8.1's persona verbs use CS's names.
- fun BLOCKER 2 covers the rules. The technical point is that ids defined in prose in two places will be implemented twice by two assistant sessions.
- *Fix:* one `registry.json` (or `registry.js`), versioned, as the single source. From it generate:
  - V's tables in DESIGN.md;
  - the S2 enums;
  - the pictogram list;
  - the Essential-line templates;
  - the micro-arena test stubs.
- A lint fails the build when a draft table or a pack names an id that is not in the registry. This is steelhag2 §9.1's "numbers of record in `levels.js`, checked by `check-logic.js`" applied to ids.

**Design.** About 150 ids × (function, icon, template, tags, two-bot test) is the most expensive table in the document, and coverage does not need it. The arithmetic follows V §11.2: 24 departments × 5 archetypes is 120 slots, or 7.5 departments per archetype at 16 archetypes.

| | Slice | v1 (proposal) | V launch |
|---|---|---|---|
| Archetypes | 10 + 2 Masterpieces | 16 | 25 (+8 L+) |
| Specials | 5 | 8 | 8 |
| Modifiers | 6 | 8 | 12 |
| Statuses | 6 | 8 | 12 |
| Primitives | 12 | 20 | 30 + 4 drawbacks |
| Consumable kinds | 8 | 10 | 12 |
| Modules | 4 | 8 (6 signature, 2 generic) | 13 |
| Perks | 8 | 12–16 (fun MAJOR 3) | 32 |
| Pictograms | about 25 | about 35 | about 45 |

### MAJOR 7. Persistence and run saves will lose players' runs on every deploy, and the hosting context is unexamined (Error)

**Where.** M §§14.2–14.4; TA F15, §3.7, T14.

**What is wrong.**
1. **Replay across versions** (MAJOR 1, item 5).
   - The run save is a snapshot at each Stair Hall and on `pagehide`, plus an action log replayed on load.
   - After a push to `main`, the stored log replays on new code. The run either diverges silently or must be refused.
2. **`pagehide` on iOS.**
   - The run store is IndexedDB, and IndexedDB writes are asynchronous.
   - A write started in `pagehide` or `visibilitychange` is not guaranteed to complete before Safari freezes or kills the tab.
3. **The hosting context.**
   - TA T14 names GitHub Pages or itch.
   - On itch the game runs in a cross-site iframe, where storage is partitioned and subject to each browser's third-party rules.
   - The repo also builds `-artifact.html` dists (vanguard-zero, steelhag2), where storage is per artifact and can come back empty in previews.
   - From `file://` there is no service worker and no PWA, and IndexedDB is unreliable in Firefox.
   - M's "two localStorage slots" is right; the rest assumes one top-level HTTPS origin.

**Resolution (fix).**
- Snapshot the *state* (not the log) to localStorage, which writes synchronously:
  - on department entry;
  - every 25 turns;
  - on `visibilitychange`.
- A snapshot is 50–200 KB, well inside the quota. Keep the action log only for replays and bug reports.
- Store `coreVersion` and `packVersion` in the snapshot. On a mismatch, resume from the snapshot if the schema migrates, and otherwise offer "the museum was rehung while you were away" with the run ended and meta kept.
- Name the one supported host for meta persistence (GitHub Pages, top-level). Test persistence there, inside an itch iframe and from `file://`, with Playwright WebKit and once on a real iPhone.
- M's 4–6 days stands.

### MAJOR 8. The persona harness is a research project made into a ship gate; its fidelity, not its compute, is the risk (Design)

**Where.** D §8 (6 personas × 3 skill tiers, limited agents, 2 held-out personas, an MCTS reference, an arrival library, 12 gates); CS §14 ("the Cautious and Tourist personas *must* be able to use tiptoe, the lantern toggle, Pose and Solvent"); L §11.2; V §6.1.

**What is wrong.**
- A competent stealth bot that plans tiptoe, lantern, Pose and Solvent against 13 wake triggers is the hardest code in the design, and the least verifiable.
- vanguard-zero needed about 2,500 lines of planning agent for a platformer. absorb-this's personas are explicitly "a negative control rather than a pacifist-solution claim".
- If the Sneak persona is weak, every Guarded and Darkness department calibrates as too hard and gets nerfed. The gate then encodes the bot's incompetence, which is PL pitfall 2, Goodharting, in reverse.
- Budget 3,000–5,000 lines and 4–8 weeks to reach a harness whose numbers mean something, measured by agreement with human play. The drafts budget nothing.

**Resolution (design, for Julian).**
- In the slice, bots check failure only:
  - reachability and soft-locks;
  - the worst-case runner;
  - module fires (V1);
  - aware beats blind (V2);
  - determinism and soak;
  - ms per turn.
- The numbers come from humans: a first-pass p\*(t) set from slice playtests.
- Build the persona battery after the slice gate, against the rules that survived. Its first acceptance test is agreement: on the slice departments, the median persona's death-rate *ranking* of departments matches the human ranking.
- This agrees with fun MAJOR 10 and pcg M3. My addition is the cost and the agreement test.

### MAJOR 9. A 128,000-word design cannot be the build contract for AI assistants, and its numbers already disagree (Process)

**Where.** The seven drafts total about 128,000 words, against 50,000 for steelhag2/DESIGN.md and 13,000 for clack-stack/DESIGN.md. The disagreements already found:
- L_tour of 150/220/280 (CS, D) against a measured 59–177 (L);
- three gate tables (P, D, V/L; pcg M4);
- two consumable lists (MAJOR 6);
- three RNG keyings (MAJOR 1);
- three Intro thresholds (pcg M4);
- three things called "Special/Temporary/ticketed exhibition" (L §19.5);
- "Wing" used twice (L §1.1).

**What is wrong.** Assistant sessions implement from what they are given. Given 128,000 words with conflicting numbers, each session picks one, and the conflicts become bugs that surface as balance drift.

**Resolution (fix).** Two documents:
- `DESIGN.md`, for Julian's decisions.
- `BUILD.md`, the slice contract: at most 10,000 words, in clack-stack §14's shape.
  - test hooks;
  - milestones with *Builds* and *Accept*;
  - a size budget per module;
  - a **numbers-of-record** table (steelhag2 §9.1) that lives in `core/numbers.js` and is linted against `BUILD.md` and the packs.

Each later phase gets its own `BUILD.md` revision, as clack-stack did with revisions 2 and 3.

### MINOR 1. The single-file convention is compatible, with four adjustments (Errors with easy fixes)

The runtime side is fine. Packs inline as data; 30 departments are about 1 MB, and steelhag2's dist is 2.4 MB. The DOM overlay and inlined font are fine. The four adjustments:
1. **`fetch()` of `content/pack-0001.json` fails from `file://`** in Chromium, and the house convention is "open `index.html`". Emit packs as script files that assign a global (`ACCESSION_PACKS.push({...})`). Node tools read the same file through a tiny loader. The build inlines it.
2. **`new Worker('x.js')` fails from `file://`.** Layout prefetch (L §2.3) can run on the main thread: 3 × ≤ 50 ms while placards are read, sliced with `requestIdleCallback`. The BYOK quick-screen in a worker (P §7.3) needs a Blob-URL worker, which steelhag2's painter worker already does.
3. **Tools need npm dependencies** (`@anthropic-ai/sdk`, `ajv`, `playwright`); the game needs none. Add `accession/tools/package.json` with exact pins, never imported by `js/`. absorb-this relies on preinstalled Playwright, which is fragile.
4. **The PWA is a hosted three-file build** (M §14.4 already says so). Say in `BUILD.md` which build is canonical for persistence.

Also: committed generator outputs (raw S1–S5 JSON, curation logs) belong under `accession/content/raw/`, outside `dist/`. Budget about 5–10 MB per batch in git, or keep raw batches out of the repo and commit only accepted packs plus the log.

### MINOR 2. Technical claims to correct or verify (Errors, mostly small)

The full table is in §5. The ones that change a number or a design:
- the Batch "all within 24 hours";
- the Worker-hosted S3 gate (P §7.2, TA §3.6 diagram);
- the local embedding model for the theme archive;
- "thousands of playthroughs per minute".

### MINOR 3. v2 cost tables count tokens only (Error)

- P §7.4's "$100–400 a month" omits compute.
- The nightly full gate for 20 accepted exhibitions a day (40 candidates at 50% acceptance) is 56–190 CPU-hours a day at D's numbers. That is a dedicated machine, not a Worker.
- Add a compute line and an operations line (a monitored VM, storage, a moderation queue). pcg M4 makes the same point; I add the hosting consequence.

### MINOR 4. Phone performance is unmeasured everywhere

- Layout at 2–4× Node on a phone is a guess (L §20, risk 1).
- The per-turn simulation, the DOM label panel and the Canvas render on a mid-range Android are unmeasured.
- Put a perf gate in the slice:
  - layout p95 ≤ 60 ms and turn resolution p95 ≤ 16 ms in Chromium with 4× CPU throttling;
  - one real mid-range Android and one iPhone measurement pasted into `DEVELOPMENT.md` (grift-city's practice).

### MINOR 5. Meta is a month and a half of work; build it last

- M §3.1 estimates 30–45 developer-days for the v1 meta layers.
- The slice needs only a death label, one accession slot shown in the Entrance Hall, two save slots and an archive export, which is about 3 days.
- Everything else waits for content to persist.

---

## 3. The vertical slice I would build

**The question the slice answers.** Do three departments with different rules, drawn from one closed vocabulary, on generated museum layouts, read as a museum and play as a roguelike for a stranger on a phone and a laptop? And what are the real turns per minute, minutes per department, label-open rate and wake comprehension?

### In

- **Departments: 3, hand-authored as pack data.** They come from S's worked samples, trimmed to the slice vocabulary. The text already exists, so Julian's editing time is about 3 hours.

  | Dept | Programme (embedder) | Signature module | Masterpiece | Trims |
  |---|---|---|---|---|
  | S.9 Animals Not Yet Seen by the Day Staff | sculpture court (quadrangle) | `unobserved_motion`, with `alarm_network` as the slice's one guard department | Treasure, `completing_guardian`: tests the "view or sneak" claim | none |
  | A.4 Things Kept in Duplicate, Before the Repeal | case labyrinth (quadrangle) | `copies_weaken` | Fight, `mp_ensemble` | drop the `diorama_spawner`, `breaker` and `attribution` dependencies |
  | M.11 Long Galleries, Considered as Telegraph Lines | enfilade | `hourly_demonstration` | Fight, `mp_tableau` | drop `weather_cases`; staff corridor optional |

- **Run.**
  - Entrance Hall.
  - 3 departments on one floor, with the player choosing the order at doors with placards.
  - A Stair Hall stub (café, one of three).
  - The Exit stub: sign out through the revolving doors, with no Registrar fight.
  - About 20–30 minutes.
- **Class.** The Night Guard only.
- **Systems.**
  - The integer scheduler.
  - Bump combat with dice, telegraphed specials and the odds readout.
  - Awareness: Dormant, Stirring with pips, and Hunting (Awake if cheap).
  - 6 wake triggers: PROXIMITY, NOISE, LIGHT, SEES_YOU, UNOBSERVED and CASE_TOUCHED.
  - Noise by BFS; 3 light bands with a lantern on/off.
  - Vitrines with 2 glass grades.
  - The clock in 3 stages, with one Watchman.
  - Room alarm only; guards and Custody only in S.9.
  - Equipment known on pickup: 3 weapon forms, 2 garments, 4 curios, 2 instruments.
  - 8 consumable kinds with seals, from the reconciled list.
  - Restoration kits, Clearance, and a Certificate with +HP and 1 of 3 from 8 perks.
  - View-the-Masterpiece.
- **Layout.**
  - Two embedders (enfilade and quadrangle), Department size, one Intro template per module, the vestibule and safe zone.
  - LV1–LV8, the worst-case runner and the certified fallback.
  - Room numbering, L_tour and the layout pin.
- **Art and audio.**
  - About 20 silhouette grids, a mask per slice archetype, 3 palettes with reserved semantic colours, 3/4 walls, light pools and about 25 pictograms.
  - The DOM label panel and tombstone line.
  - The vanguard-zero audio fork with 3 motifs, wake stingers and the alarm bell.
- **Meta.** A death label ("Figure of a Visitor, Run n"), one accession slot shown in the Entrance Hall, two localStorage slots, an archive export and state snapshots (MAJOR 7).
- **Text.** A static Directory with about 15 lines and the grammar if cheap (it carries the brief's infinity for about 200 lines of code). About 20 barks.
- **Tools.**
  - `check.js`: vm-load, the forbidden-API lint, the registry lint, cross-engine hashes, layout validity on 1,000 seeds.
  - `bot.js`: explorer, fighter and sneak-lite policies, plus aware and blind pairs per module, for failure checks, soak and ms per turn.
  - `shot.js`: Playwright contact sheets at 390×844 and 1280×720.
  - `build-single.py`.

### Out (until the slice gate)

- The universal sketch and the Copyist. These come first after the gate, because the sketch is the design's signature verb, and the gate will say whether players observe at all.
- Forgeries, the attribution ladder and Inspect.
- Pose, tours and the department alarm.
- Elevation and balconies.
- Size classes, the sequencer, heat and Patron.
- The Gift Shop, Atlas, Catalogue UI, object zero and Lost Property.
- The persona battery, b(d) calibration and the dashboard.
- The pipeline (except the P0 spike), MAP-Elites, the curator console, atelier and LLM sprite grids.
- Tiptoe stays out unless Julian decides otherwise (Decision F2 below).

---

## 4. Milestones, in the repo's style

**Test hooks** (shipped; tiny):

| Kind | Hooks |
|---|---|
| URL | `?seed=`, `?dept=S.9`, `?depth=1..8`, `?prog=`, `?bot=explorer\|fighter\|sneak`, `?ts=` (turns per frame for bots), `?selftest`, `?mute=1`, `?reveal=1` (exhibit states through walls), `?lights=0` |
| `window.ACC` | `state()`, `step(action)`, `events`, `hash()`, `layout()` (tiles plus metrics), `perf()` (`{msPerTurn, layoutMs, frameMs}`), `selftest()` |

The bots drive `step()` in Node. In the browser they drive real pointer and key events, as Clack Stack does.

**M0. Core skeleton and determinism (week 1).**
- *Builds:*
  - `core/rng.js` (sfc32 from a string hash, named streams);
  - `core/grid.js` (typed arrays, symmetric shadowcasting, BFS and Dijkstra);
  - the integer scheduler;
  - `step()` with events, a canonical hash and the UMD wrapper;
  - the forbidden-API lint and the registry lint;
  - `build-single.py`;
  - a one-room department with 10 actors.
- *Accept:*
  - the same seed and a scripted 10,000-action log give an identical hash twice in Node, and identically in Playwright Chromium, WebKit and Firefox;
  - a planted `Math.random`, `Math.hypot` or `**` in `core/` fails the lint;
  - `?selftest` logs `SELFTEST PASS`;
  - ms per turn ≤ 0.2 p50 for the one-room case.

**M1. Layout from the prototype (weeks 1–3).**
- *Builds:*
  - port `proto.js` into `core/layout.js` (enfilade and the quadrangle with two fillers);
  - the vestibule, the safe zone and Intro stamps;
  - LV1–LV8, the worst-case runner and the certified fallback;
  - room numbers and L_tour;
  - the layout pin and role-keyed substreams.
- *Accept:*
  - 3 programmes × 1,000 seeds: zero unreachable exits, fallback ≤ 1%, p95 ≤ 25 ms in Node and ≤ 60 ms in Chromium at 4× CPU throttle;
  - a planted blocked archway fails LV1, and a planted 8-tile arena loop fails LV8;
  - the locality test: change one bay template, and every other room's furniture hash is unchanged.

**M2. Look and read (weeks 2–4).**
- *Builds:*
  - the Canvas renderer with integer zoom and a baked static layer;
  - 3/4 walls, 3 palettes and the reserved colours;
  - about 20 silhouettes and light pools;
  - the DOM label panel and tombstone line, and about 25 pictograms;
  - tap-to-path, long-press examine and keys.
- *Accept:*
  - at 390×844, 844×390 and 1280×720: no horizontal scroll, and the label panel inside the viewport;
  - every hostile sprite contains a reserved hostile pixel, and no department palette colour is within ΔE 10 of a reserved colour;
  - no grey pixels in Tiny5 at 2×;
  - a human gate: Julian picks museum or dungeon on three blind screenshots, and so do two others.

**M3. Exhibits wake (weeks 3–6).**
- *Builds:*
  - awareness and the 6 triggers;
  - noise BFS (door +4) and the lux bands and lantern;
  - vitrines;
  - combat with dice, telegraphs and the odds readout;
  - 10 archetypes, 5 specials and 6 statuses;
  - 8 consumables with seals, and the equipment;
  - the clock and Watchman, and the room alarm.
- *Accept:*
  - the examine hit% matches measured hits over 10,000 rolls within 1 point;
  - a telegraph's shown damage equals its dealt damage in 100% of 1,000 seeded resolutions;
  - a normal sleeper 3 tiles away wakes on a melee swing and not on a marble step (CS §3.4's worked numbers);
  - each archetype's micro-arena test: the counterplay bot beats the naive bot by its declared margin over 200 seeds;
  - one medium department of 30 actors at ≤ 1.0 ms per turn p50 in Node.

**M4. Three departments (weeks 5–8).**
- *Builds:*
  - the modules `unobserved_motion`, `copies_weaken`, `hourly_demonstration` and `alarm_network`, with guards and Custody;
  - 2 fight Masterpieces and 1 Treasure, plus the view lectern;
  - the Certificate and 8 perks; kits and Clearance;
  - `content/pack-slice.js` for S.9, A.4 and M.11.
- *Accept:* per department, over 100 seeds:
  - the module fires in ≥ 90%;
  - the aware bot beats the blind one by V Table B's margin;
  - the blind bot fails the Intro in ≥ 30%;
  - the worst-case runner reaches an exit in 100%;
  - zero soft-locks in a 10,000-turn soak;
  - every label's essential id matches the spec (lint).

**M5. A run and a death (weeks 7–9).**
- *Builds:*
  - the Entrance Hall and doors with placards;
  - the Stair Hall stub and the Exit stub;
  - the death label, one accession slot and the Entrance Hall display;
  - two save slots, state snapshots, archive export and import;
  - the static Directory.
- *Accept:*
  - the explorer bot completes a full run in ≥ 30% of 200 seeds, and the fighter in ≥ 15%;
  - a reload mid-department resumes at the last snapshot with an identical `hash()`;
  - a snapshot from a bumped `coreVersion` takes the documented path;
  - a meta schema fixture migrates;
  - persistence passes in Playwright WebKit on the hosted build and from `file://`.

**M6. Audio (week 9).**
- *Builds:* the vanguard-zero fork, 3 motifs, stingers, the bell and room tone.
- *Accept:* voices stay under the cap through an alarm and a Masterpiece; mute persists; no console errors with `mute=1`.

**M7. The slice gate (week 10). A human judgement, by written procedure, as in steelhag2 §11.2.**
- Julian plus 3–5 players who have not seen the design each play one run on a phone or laptop. The session is logged by `ACC.events`.
- Measured:
  - turns per minute;
  - minutes per department;
  - the share of labels opened;
  - deaths by cause.
- After each wake, a prompt asks "why did that wake?" (the trigger list as choices).
- **Pass:**
  - correct wake attribution ≥ 70%;
  - at least 3 of 5 players describe the three departments by their rules, not their art;
  - no player's median department exceeds 15 minutes;
  - frame and turn budgets hold on the two pasted devices.
- **Decisions made at the gate, from the data:**
  - departments per run, and the clock's B multiplier, from measured turns per minute (L-D1);
  - which stealth rules survive (tiptoe, Pose, two-level alarms);
  - whether the sketch comes next or the Copyist is cut;
  - D-P1's v1 content route (MAJOR 5).
- **If it fails:** two weeks on readability (pips, presence ring, pictograms), then re-judge.

**P0. The pipeline spike (one week, any time after M3's registry exists; off the critical path).**
- *Builds:* S1 and S2 only, on the interactive API, with structured outputs carrying the registry's enums, over 20 recipes. The code is throwaway.
- *Accept:*
  - the schema compiles, with the first-request latency and any 400 logged;
  - ≥ 70% of S2 specs pass the static validators after ≤ 2 repairs;
  - cost per department is logged;
  - Julian's stopwatch minutes per department are recorded (MAJOR 3);
  - nothing in `js/` imports it.

**After the gate**, in this order: the sketch; the persona harness against surviving rules (MAJOR 8); vocabulary to v1 size (MAJOR 6); the rotunda; size classes and the sequencer (once the pool is ≥ 16); content production by the chosen route; meta layers; heat.

**Cut order across the whole game** (one list, applied from the top):
1. Commissions and Temporary Exhibitions.
2. Heat.
3. The Gift Shop beyond 4 items.
4. Size classes.
5. The second and later classes.
6. Forgeries and the attribution ladder.
7. Balconies and `tide_cycle`.
8. Pose and tours.
9. The 32 perks, down to 12.
10. Departments per run, down to 6 (2/2/2).

**Never cut:** the deterministic core and its cross-engine test; layout validation and fallback; the closed registry; the label panel with pictograms; the death label and save.

---

## 5. Technical claims checked

| # | Claim (where) | Verdict | How to verify |
|---|---|---|---|
| 1 | Opus 5.5 at $4/$20, cache read $0.20; Haiku 5.5 at $0.10/$0.50; Batch at 50% (TA F7, P §3.11) | **Correct** (skill docs, models table cached 2026-10-06) | Recheck the pricing page before any budget |
| 2 | "Most batches finish within an hour and all within 24 hours" (P §3.11) | **Half right.** Most end within an hour. Requests not processed by 24 hours *expire* and must be resubmitted, which is not completion. With 6–9 chained stages, a launch batch is 1–3 days wall-clock | P0 spike: log `created_at` → `ended_at` per batch; handle the `expired` result type |
| 3 | Cache reads priced into every Batch call (TA §3.6, P §3.11) | **Optimistic.** Cache hits inside a concurrent batch are best-effort (skill, cost-optimization §2.5). The cost effect is under $0.03 a call, so the conclusion stands | `usage.cache_read_input_tokens` in batch results |
| 4 | Sonnet 5.5 cache read $0.10 (TA F7 table) | **Wrong:** $0.20 per the skill. No design impact | Pricing page |
| 5 | Forced `tool_choice` returns 400 on Opus 5.5; use structured outputs (P §3.4) | **Correct** | n/a |
| 6 | `temperature`, `top_p` and `top_k` rejected; no seed; thinking cannot be disabled on Opus 5.5 (TA F5) | **Correct** | n/a |
| 7 | Structured outputs guarantee "every id exists" (P §3.4) | **Correct for enum fields only.** Numeric and length constraints are stripped (the SDK validates them client-side), recursion is unsupported, a refusal or `max_tokens` can return off-schema output, and a new large schema pays a compile on first use. Whether a registry-sized S2 schema (hundreds of enum values across nested arrays) hits a complexity limit is untested | P0: send the real S2 schema once and record latency and errors; read the structured-outputs limits page before relying on it |
| 8 | Minimum cacheable prefix 512 tokens on all three models (TA F7) | **Correct** per the skill, which says "check the docs before relying" | `cache_creation_input_tokens` > 0 on the first call |
| 9 | "core/ runs in the Worker" for the S3 gate (TA §3.6 diagram, P §7.2 T1b) | **Implausible.** Serverless workers have per-invocation CPU limits of seconds to minutes; the gate is 34 core-minutes (P) or hours (D) | Read the current Cloudflare Workers CPU-limit docs; plan a VM for any gate |
| 10 | The theme archive embedding needs "a local sentence-embedding model" (P §4.2) | **Adds a Python or ONNX toolchain** to a JS-only repo | Use TF-IDF plus domain Jaccard for v1 (P's own fallback and cut line 6); revisit at 100+ departments |
| 11 | "Four cores give thousands of department playthroughs per minute" (TA F4) | **Overstated** by about 5× at D's 1 ms per turn and 600 turns (about 400 a minute) | M3's ms-per-turn gate |
| 12 | Layout 7–9 ms p50, 11–16 ms p95 (L §2.1) | **Reproduced** in Node 22 here (enfilade 9.1 / 14.5 ms, max 74 ms). Phone 2–4× is a guess | Chromium at 4× throttle, then one real device (M1) |
| 13 | IEEE `+ − × ÷` exactly specified; ban transcendental functions (TA §3.2) | **Correct.** Extend the ban list (MAJOR 1). Note that the spec leaves `sqrt` and `pow` implementation-approximated too | The M0 cross-engine hash |
| 14 | Safari's 7-day storage deletion; home-screen apps keep their own counter; `persist()` granted heuristically (TA F15, M §14.4) | **Correct as quoted, for a top-level origin.** Untested for an itch iframe, an artifact or `file://` | M5 persistence tests on each host; one real iPhone |
| 15 | "A run's share code is `pack v · runSeed`"; "same daily seed, same choices, same doors" (TA §3.2, D §2.2) | **Wrong.** Meta state changes doors and pools | The MAJOR 1 item 3 replay header; a test that replays one log under two meta states and expects different doors unless the run is Seeded |
| 16 | Per-department streams keyed by `number@digest` (P §3.10) | **Contradicts L §12.1**, and makes text edits reshuffle play | Key by pins; a test that a label edit leaves `layout().hash` unchanged |
| 17 | The run save replays the action log on load (M §14.3) | **Breaks across deploys** | The M5 version-bump test |
| 18 | Visitor's card ≈ 195 characters (M §14.5) | **Correct** (970 bits / 5 ≈ 194) | n/a |
| 19 | D §8.7's compute table | **Arithmetic correct.** Inputs unmeasured; the turn count is about 2× high by L §17.2; persona cost is likely higher than 1 ms with lookahead | M3 and M4 ms per turn with a real policy |
| 20 | "About 8 hours" of curation per launch batch (P §3.9) | **Likely 2–3× low** | P0 stopwatch |

---

## 6. Answers to the questions this lens was asked

- **Is the total scope realistic?**
  - Not as a v1: about 50,000–70,000 lines, about 750 vocabulary deliverables, 30 departments and a pipeline.
  - As a roadmap, yes, if the slice comes first and the factory is built against measured rules.
- **What eats the schedule, most likely first?**
  1. The awareness simulation × modules × archetypes: combinatorial interaction bugs, plus readability iteration on phones.
  2. Persona fidelity (MAJOR 8).
  3. Layout beyond the prototype: L1, Intro certification, curation and population (MAJOR 4).
  4. UI on phones: six meters, the label panel, about 45 pictograms, the map and the hub screens. UI is where Clack Stack's lines went.
  5. Pipeline prompt tuning and vocabulary churn (MAJOR 5).
  6. Meta (30–45 days by M's own count).
  7. Julian's curation hours (MAJOR 3).
- **Is the determinism contract realistic in plain JS?** Yes, and cheaply, once the five breaks in MAJOR 1 are fixed and the cross-engine hash test exists from M0.
- **Is the single-file convention compatible?** Yes, with four adjustments: packs as script globals, no file-URL workers, `tools/package.json`, and a named canonical hosted build (MINOR 1).
- **Are the layout generator and the vocabulary too much for v1?**
  - Yes. Ship two embedders and three programmes in the slice, and four programmes in v1. Keep all the validation; cut the knob archive and the rare room types.
  - Size the vocabulary to the slice and v1 table in MAJOR 6, and keep one registry.
- **Is 1.4–4.8 CPU-hours per department credible and acceptable?**
  - The arithmetic is right, but the per-turn cost and the turn count are unmeasured in opposite directions.
  - It is acceptable per changed department overnight. It is not acceptable as a full-pool loop during development.
  - Gate it on a measured ms per turn, and split development and ship calibration (MAJOR 2).
- **The slice and the milestones:** §3 and §4.
- **Technical claims:** §5.

---

## 7. What works and must be kept

- **TA §§3.1–3.2:** the pure, seeded, integer core, `require`d by the game, the bots and the pipeline alike. It is the single best decision in the document.
- **The layout prototype and its discipline:**
  - measured envelopes, honestly labelled circular;
  - role-keyed substreams and a layout pin;
  - validation, repair, reseed and a certified fallback, all logged.
- **LLMs offline only in v1:**
  - closed enums;
  - no numbers from the model;
  - stored outputs as the canonical asset;
  - Batch for production.
- **Vanilla JS, Canvas 2D, IIFE/UMD and `build-single`; the DOM label overlay; code-drawn index-grid art with reserved semantic colours.**
- **Two alternating localStorage slots with checksums, plus an archive export.**
- **Every section has a cut line and labels its numbers as unmeasured.** That honesty is what makes a measured slice possible.

## 8. Decisions this critique adds for Julian

| # | Decision | Options | Lean |
|---|---|---|---|
| F1 | What is the first playable? | (a) The §3 slice: 3 hand-authored departments, 2 embedders, 1 class, no pipeline. (b) fun MAJOR 10's version: hand-built maps, no layout generator. (c) As drafted: the pipeline, harness and meta first | **(a).** The generator is the brief's promise, and its prototype already works |
| F2 | Tiptoe in the slice? | (a) In: it is cheap code and the gate measures its use. (b) Out: fun MAJOR 1 calls it a trap | (a), measured at the gate |
| F3 | How v1 departments are made | (a) Authoring-aid: Claude sessions plus the validators as a CLI. (b) The batch pipeline in v1 after a vocabulary freeze | **(a)**, with P0's data deciding |
| F4 | The calibration regime | (a) Development canary plus weekly ship calibration on a rented machine. (b) D §8 as drafted on the 4-core container | **(a)** |
| F5 | Canonical host for saves | (a) GitHub Pages, top-level, with a PWA. (b) itch. (c) `file://` only, with export | **(a)**, with (c) still playable and export always offered |
| F6 | Two documents | (a) `DESIGN.md` for decisions plus `BUILD.md` as the slice contract with numbers of record. (b) One document | **(a)** |
