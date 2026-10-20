# Section drafts (revision 0)

These seven drafts were written in parallel, inside one shared frame, before the review in [`../review/`](../review/). They are the detail behind [`../DESIGN.md`](../DESIGN.md) and are kept as reference material. They are **not** the build contract. A `BUILD.md` of about 10,000 words will be written after Julian's decisions, with one numbers-of-record table that a lint checks against the code.

**Where a draft and `DESIGN.md` disagree, `DESIGN.md` wins.** The drafts also disagree with each other in places. The full table of those disagreements is [`../review/consistency.md`](../review/consistency.md). The rule for resolving them:
- `vocabulary.md` owns ids;
- `core-systems.md` owns player-facing numbers and UI;
- `difficulty.md` owns the role table and the one simulation-gate table.

| Draft | Covers |
|---|---|
| [`core-systems.md`](core-systems.md) | Turns, combat, awareness and stealth, furniture, the closing clock, inventory, identification, in-run progression, the sketch, classes, NPCs, death, UI |
| [`difficulty.md`](difficulty.md) | Run shape, Stair Halls, the Exit, door offers and the sequencer, the difficulty model and calibration, the item economy, challenge types, Centrepieces, heat, the balancing harness, the assist |
| [`pipeline.md`](pipeline.md) | The infinity decision, the department data model (every field tagged), the generation pipeline S0–S7, archives, the Directory, runtime text, Temporary Exhibitions, Commissions, generator evaluation, research angles |
| [`layout.md`](layout.md) | The layout generator, programme by programme, with a measured prototype ([`../prototypes/layout/`](../prototypes/layout/)) |
| [`vocabulary.md`](vocabulary.md) | The authored grammar: archetypes, modifiers, statuses, item primitives, consumable kinds, rule modules, furniture, challenge types, families, the role-to-numbers contract |
| [`meta.md`](meta.md) | Meta-progression: Accession, the Loan, the Catalogue and Atlas, Stamps and the Gift Shop, Patron membership, the record of visits, the recurring cast, persistence |
| [`samples.md`](samples.md) | Five fully worked departments, thirty pitches, a Directory excerpt, and a self-critique |

## What `DESIGN.md` supersedes, draft by draft

The numbers in brackets point to `DESIGN.md`: D1–D14 are decisions; #1–#45 are the defaults in §4.

### `core-systems.md`
- **The universal stealth model.** Five awareness states, 13 wake triggers, per-material noise against hearing classes, five lux bands and the tiptoe toggle are replaced by:
  - three visible states;
  - a presence ring;
  - at most one special trigger per species;
  - three light bands;
  - no tiptoe.

  (D5; #4–#7.)
- **Daytime guards** exist only in Guarded departments. Capture has one rule: escort to the exit doors, with no confiscation and no Custody pips (D7). The Night Guard's *Colleague* passive and the Copyist's "guards ignore you while you sketch" are to be rewritten (`review/fun.md` MAJOR 6).
- **Masterpiece is renamed Centrepiece.** Viewing is a four-turn channel at the lectern inside the wake radius, and it is exclusive with defeat (#9).
- **The clock** has two stages, with its budget set from measured layouts and measured turns per minute (#6, D6).
- **Perks** are 12–16 general triggered perks in playstyle families, not tied to challenge types (D9).
- **The sketch** belongs to the Copyist class, not to everyone (D9).
- **NPCs** (§11). The fellow visitor and the docent's gallery talk carry over as topic NPCs; tours stay with the later Attendance family; the clerk's kiosk in every department's coda goes, because shops are only at Stair Halls (#12, #44, #45; `DESIGN.md` §6.5).
- **A fodder hit** costs 6–9% of maximum health, not 7–9%: `difficulty.md` owns the role table.
- **Equipment** is known on pickup in the first playable. In v1, attribution is an object's hidden quality band, revealed by cataloguing, up or down (D10).
- **Mechanical truths** move to a Behaviour line on the tombstone (D10).
- **Retirement** counts as death for meta purposes (D7).
- **Shops** are only at Stair Halls. 8, 10 and 12 consumable kinds for the slice, v1 and the full game, from one list (#12).
- **The death label** uses no "Bequest"; it gets a medium line (`DESIGN.md` §11).

### `difficulty.md`
- **Run length.** The 82-minute run rested on tours of 150, 220 and 280 tiles, roughly twice what `layout.md` measured (medians 59–77, 84–108 and 115–177). The target is now 50–75 minutes, set at the slice gate from measured turns per minute (D6).
- **Size classes** are cut from v1 (#14).
- **The Registrar** has no hit points; the Exit is a retrospective (D7).
- **The challenge-type fitness terms.** Skill gap and route divergence are bands, not objectives, and a novice gate is added (#16, #36).
- **One simulation-gate table**, owned here and reconciled with `pipeline.md`'s G1–G10, at about 200 seeds per depth (#38).
- **The sequencer prototype** used two Social-primary departments, which the lean forbids. Rerun with seven primary types:
  - six or more distinct types in 73.5% of runs, not 94.5%;
  - five in all of them.

  The minimum pool sizes (16 for 2-door offers, 24 for 3-door) came from the same run. Rerun under the seven-type lean, the smallest pools that build every run are 20 and 28. `DESIGN.md` §9.3 and [`../prototypes/README.md`](../prototypes/README.md) have the details.
- **R12's framing of experience-driven PCG** is corrected (`review/pcg.md` M6; #19).
- **Patron membership** is merged with `meta.md`'s model (#21).

### `pipeline.md`
- **The infinity decision** gains option (f), the Open Stacks. The evidence is restated: the dud rate of a gated pipeline is unmeasured. The v2 gate is split into broken and dull, because the drafted 70% acceptance gate sat above the pipeline's own expected 0.65 (D1; `review/pcg.md` B1).
- **"Open nouns, closed verbs"** becomes "closed grammar, open sentences", with modules in a rule language as an option (D2). AI&G 2e p. 300 does not rule out generated rules.
- **The department archive** is a stratified coverage grid. MAP-Elites moves to encounters, Centrepiece assemblies, and items and perks (#35).
- **Simulation-gate cost.** It is about 1.4–4.8 CPU-hours per department (`difficulty.md`), not 34 core-minutes, and 50 seeds per depth cannot resolve the calibration tolerance (#38).
- **Random streams** are keyed by version pins, not content digest (#40).
- **Unprocessed Batch requests** expire at 24 hours; a multi-stage batch takes one to three days.
- **The curation estimate** is probably about 15–30 hours per 48-candidate batch, not 8.
- **Batch cost.** The §1 table says about $35 per batch and §3.11 about $33; `cost.py` gives $32.78. `DESIGN.md` uses about $33.
- **Structured outputs** (§3.4, S2's model line) do not strictly "guarantee that every id exists": enum capitalisation is not guaranteed, and a refusal or a `max_tokens` cut-off can break the shape. Check the stop reason, then compare ids without regard to case (`DESIGN.md` §12.3).
- **v1's departments** are made in authoring-aid mode, with the batch pipeline after a grammar freeze (D13).
- **Citations to soften** (`review/pcg.md` m1):
  - "keeps the 2.6× effect" becomes "motivated by";
  - the Picbreeder-VLM context claim is a hypothesis;
  - Word2World's 90% is 9 of 10 worlds;
  - the oatmeal ratio is an intraclass correlation in all but name;
  - ELMER was read from its abstract.

### `layout.md`
- **Programmes.** The six launch programmes are three macro shapes. The slice has two embedders and three programmes; v1 has four (`DESIGN.md` §10.1).
- **Khalifa et al. 2019** *compared* limited agents with other methods; the draft says it "recommended" them.
- **Layout-archive fitness** (§13.4) is playability alone, the share of seeds that pass validation without repair (#36), with route structure and texture as the axes. Persona fitness for layout elites was too noisy at the drafted budget anyway (`review/pcg.md` M2). The archive itself is D14's recommended option.
- **`L_tour`.** §17.2 says the measured tours are "about 40% lower" than assumed; its own table gives 37–62% lower, about half.
- **Kiosks** are only at Stair Halls (#12); the coda keeps its room and exit doors.
- **The staff telephone** follows the retirement rule (D7).

### `vocabulary.md`
- **Contract rule 1 and the p. 300 citation** (D2).
- **`patrol_guard` and `night_watchman`.** Staff are NPCs and are never harmed; `patrol_guard` is always an exhibit (D7).
- **One role table** (10 roles here, 7 in `core-systems.md` and `difficulty.md`), one consumable list and one awareness model, all to be reconciled (`review/consistency.md` B1–B2).
- **Sketch yields** conflict with `core-systems.md` §9; settle them after D9.
- **Launch sizes** are now first-playable / v1 / full: 10 / 16 / 35 archetypes and 4 / 8 / 24 modules (`DESIGN.md` §6.3).

### `meta.md`
- **Atlas ordinal gating** opened only 12 departments on run 1, below the sequencer minimum. The Atlas becomes a completion record (`DESIGN.md` §11).
- **Credit lines.** "Gift of the Visitor" becomes "Selected by Visitor *n*".
- **Patron membership** is merged with `difficulty.md`'s model (#21).
- **Triggers** are always visible from the first meeting (`review/newplayer.md` M3).
- **Directives** are v1.x (D11).
- **Saves** are state snapshots, not action-log replays (#41).

### `samples.md`
- **Register.** All five departments are told through an office's own paperwork; registers and quotas are added (#29).
- **One Essential line in the didactic** gives way to the Behaviour line, and the reporting-verb lint is dropped (D10).
- **Mimics.** Mimic exhibits print accession numbers in their tombstones, though "no number" is meant to be their tell.
- **Essentials.** K.6 places a Restoration kit inside a puzzle vault, against the essentials rule.
- **Labels with false claims.** Two hand-written labels make claims their mechanics do not support: the Reflecting Dish and the Hat Stand (`review/museal.md` §3).
- **Masterpiece** is renamed Centrepiece throughout.
