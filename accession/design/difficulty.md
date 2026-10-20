# Run structure, difficulty and balance

*ACCESSION design document, section: run structure, difficulty and balance. Draft 1, 2026-10-20. Written inside the direction memo's frame (`direction.md`) and against the sibling draft `design/core-systems.md` (CS), whose stats, quotas, clock and perk families this section uses unchanged. Research is cited only from the briefs: `roguelike-systems.md` (RS), `papers-levels.md` (PL), `book-pcg.md` (BK), `museum-layouts.md` (ML), `tech-art.md` (TA), `literature-museology.md` (LM). Every number is a first draft for the persona harness to move.*

**What this section owns:** the shape of a run, floors and Stair Halls, the Exit and its final encounter, door offers and the sequencer, the difficulty model (depth, budgets, calibration, target death rates), the item economy's guarantees, the challenge-type list, Masterpiece design rules, heat, the balancing harness and the difficulty assist.

**What it borrows:** combat maths, role anchor stats, the clock, quotas and perk families (CS §2, §5, §6, §8); behaviour archetypes and Masterpiece movesets (enemies section); room graphs, `L_tour` and placement (layout section); Accession, Loans, the Gift Shop currency (meta section).

**Prototype code.** Four small scripts back the numbers below. They live in `../prototypes/difficulty/`: `roles.py` (role curves and duel costs), `pstar.py` (death curves and clear rates), `seq_floor.py` with `sequencer.py` (the sequencer on a synthetic pool), and `compute.py` (simulation cost).

---

## 0. Proposals at a glance

| Topic | Proposal |
|---|---|
| Run shape | Entrance Hall → 3 departments → Stair Hall → 3 departments → Stair Hall → 2 departments → Stair Hall → the Exit. About 80 minutes (range 75–90). |
| Department sizes | Three classes under a per-path time budget: **Cabinet** (5–6 galleries, ~6 min), **Department** (7–8, ~8 min), **Wing** (9–10, ~11 min). |
| Stair Halls | No clock, no enemies. A café choice of one from three (heal 40%, a free Restoration level, or full cataloguing), a kiosk, the Conservator and Registrar, the Directory. Run beats: *Appointment* at the first, *Master Key* at the second, the Exit preview at the third. |
| The Exit | Depth 9. The Registrar tries to accession you (tags, not damage) while recalling exhibits from departments you visited. Win by defeating it or by signing out through the revolving doors. |
| Route choice | 2–3 doors with placards at 8 choice points. A hidden graph is generated **one floor at a time**, at the Entrance Hall and each Stair Hall, conditioned on what you have visited. |
| Variety guarantee | No primary challenge type twice in a row; doors from one room offer distinct primaries; per run at most two types repeat, each at most twice and at least three departments apart. Prototype: ≥6 distinct primaries in 94.5% of runs, ≥5 in 100%, all 8 types offered on placards in practically every run. |
| Difficulty | Depth sets stats (CS role curves). Budget in **fodder equivalents (FE)**: `E = E0[size] × base(t) × e^{b(d)}`. `base(t)` is fitted globally; `b(d)` per department, one scalar, bounded ±0.6. |
| Target | Sawtooth death curve p\*(t) = 3, 5, 7 \| 6, 8, 10 \| 10, 12 \| Exit 15 (%). Median-persona clear ≈ 45%; novice ≈ 13%; expert ≈ 74%. |
| Economy | CS quotas (2 Restoration kits, 1 Clearance card, 7 consumables) plus placement rules, floors and pity meters. Essentials never in secret rooms, never in the Masterpiece hall. |
| Challenge types | Swarm, Artillery, Guarded, Darkness, Hazard, Locks, Attrition, Social. Social is secondary-only until a social family ships. Each has a measured persona fingerprint, and the placard icon must pass a fingerprint gate. |
| Masterpieces | 2–3 phases, 6 exposed knobs, shaped by gallery events, sealed hall. Fight by default; a *Treasure* (heist) form for Guarded and Locks departments. Bypass by viewing (Certificate) or skipping (nothing). |
| Heat | 10 Trustees' Directives, 6 of them additive. Unlocked after the first escape. Heat points fitted so 1 point ≈ ×1.10 death odds per department. Rewards: first-clear bounties and Restricted Wings. No power. |
| Harness | 6 personas × 3 skill tiers + limited agents + 2 held-out personas. Per-department sims with sampled kits during development; whole runs nightly. 12 shipping gates. About 1.4–4.8 CPU-hours to calibrate one department. |
| Assist | **Patron Membership**: damage taken −20%, rising 2% per death to a 60% cap, plus three sub-toggles. Labelled on the credit line, never hidden. |

---

## 1. Run structure

### 1.1 The shape of a visit

```
ENTRANCE HALL (hub: Your Collection, Information Desk, Directory; choose 1 of 3 doors)
  │
  ├─ FLOOR 1   dept 1 ──► dept 2 ──► dept 3          (depths 1–3)
  │                                     │
  │                               STAIR HALL 1       (café choice · kiosk · Conservator · Registrar
  │                                     │             · Directory of floor 2 · APPOINTMENT)
  ├─ FLOOR 2   dept 4 ──► dept 5 ──► dept 6          (depths 4–6)
  │                                     │
  │                               STAIR HALL 2       (as above · MASTER KEY)
  │                                     │
  ├─ FLOOR 3   dept 7 ──► dept 8                     (depths 7–8)
  │                          │
  │                    STAIR HALL 3                  (café choice · kiosk · EXIT PREVIEW)
  │                          │
  └─ THE EXIT  Main Hall · Gift Shop · revolving doors · the Registrar   (depth 9)
```

- **One department is one level** (frame). Inside it: an Intro gallery, 2–4 sections, the Masterpiece hall, a coda with the gift-shop kiosk, and the exit lobby with its doors (ML §3.4).
- **There is no way back.** Each door closes behind you ("This gallery is now closed").
- **Floor names and stair direction** belong to the narrative section. This section needs only the 3/3/2 grouping.
- **Choice points: 8.** The Entrance Hall offers 3 doors. Departments 1, 2, 4, 5 offer 2–3. Stair Halls 1 and 2 offer 3. Department 7 offers 2. Departments 3, 6 and 8 lead to their Stair Hall.

### 1.2 Why eight departments on three floors

The frame leans to 8 departments in a 3/3/2 shape. RS D1 leaned to 5 larger departments. The comparison, at a fixed 80-minute target:

| | **5 departments** | **8 (3/3/2)** | **12** |
|---|---|---|---|
| Minutes per department | ~13 (about 1,000 turns) | ~8 (about 650 turns) | ~5 (about 400 turns) |
| Department size needed | Above Wing: 12–14 galleries, past ML D10's 6–10 lean and into museum-fatigue territory | Cabinet to Wing, all inside the 6–10 range | Cabinet only; Intro + sections + Masterpiece no longer fit |
| Departments seen per run | 5, and about 12 placards | 8, and about 20 placards | 12, and about 30 placards |
| Distinct primary types per run (of 8) | at most 5 | ≥6 in 94.5% of runs (prototype, §2.5) | 8, with forced repeats |
| Certificates (perk picks) | 5: a thin build | 8 | 12: builds finalise by mid-run (RS F5's ebb) |
| Masterpieces per run | 5 | 8 (some are heists, §6) | 12: boss fatigue |
| Mean death rate per department for a 45% median clear | ~15% | ~9% | ~6% |
| Pool needed for 3-door offers (§2.5) | ~16 | ~24 | ~36 |
| Calibration depths | 5 | 8 | 12 |

**The argument for 8:**
- **It sells the premise.** "An infinite collection, organised in no discernible manner" needs many juxtapositions per visit. Five departments reads as a small museum.
- **It fits the clock.** CS §5.1 puts a medium department's First Bell at about 8 minutes (at an unmeasured 80 turns per minute). Eight of those plus seams and the Exit is about 80 minutes.
- **It carries the challenge-type promise.** With 8 types and 8 departments, the sequencer can guarantee 6 or more distinct primaries on almost every path. With 5 it cannot exceed 5.
- **Each death matters less.** A 9% hazard per department is gentle enough that a single bad department rarely ends a good run, while 8 of them still compound to a real challenge.

**What 5 has going for it:** half the content and calibration load, and room for a richer arc inside each department. It is the right fallback if the pool stays under 16 (see the cut line).

**Why 3/3/2 rather than 3/3/3 or 4/4:**
- **The beats land where SPD's do.** The Stair Halls fall after 37.5% and 75% of the departments. SPD places its subclass at floor 10 of 25 and its armour ability at floor 20, because "by floor 20 the player's build is pretty finalized… the satisfaction of progressing begins to ebb away" (RS F5). Those two Stair Halls carry the run's two progression beats (§1.5).
- **The finale arrives while the build is strong.** A short last floor keeps the deadliest departments few.
- **There is a rest row before the boss.** Stair Hall 3 sits immediately before the Exit, as Slay the Spire's rest row sits before its boss (RS F14).

**Decision R1: how many departments per run?**

| Option | Tradeoff |
|---|---|
| (a) 5 larger departments | Least content and calibration; undersells the premise; at most 5 challenge types per run. |
| (b) 6 (2/2/2) | 60–70 minutes; fits a pool of about 18; 5 distinct types typical. |
| (c) **8 (3/3/2)** | The premise, the clock and the variety guarantee all fit; needs a pool of about 24 for 3-door offers. |
| (d) 12 | The most "infinite"; departments too short for their own arc; boss fatigue. |

*Lean: (c).* If Julian picks (a) or (b), Stair Halls fall after every 2 departments, p\* rises per department to keep clear rates, and the per-path repeat rule (§2.4) loosens to "no back-to-back".

### 1.3 Time budget

**Assumption:** 80 turns per minute (CS §5.1, unmeasured). The turn counts use CS's open-hours budget B per size: 480, 650 and 800.

| Segment | Turns | Minutes | Notes |
|---|---|---|---|
| Entrance Hall | n/a | 2 | Loan, Information Desk, first doors |
| Cabinet | ~450 | ~5.6 | Completist uses ~90% of B, Tourist ~45% |
| Department | ~650 | ~8.1 | |
| Wing | ~850 | ~10.6 | |
| Masterpiece fight | 30–60 | inside the department's minutes | The clock pauses while the hall is sealed (CS §5.4) |
| Door decision | n/a | ~0.5 each, ×8 | Reading placards |
| Stair Hall | n/a | ~2 each, ×3 | Shopping, café, Directory |
| The Exit | ~300 | ~6 | |

**Expected run.** Size weights by floor are in §1.4. The expected minutes per department are 7.5 on floor 1, 8.2 on floor 2 and 8.6 on floor 3. Total: 3 × 7.5 + 3 × 8.2 + 2 × 8.6 + 2 + 4 + 6 + 6 ≈ **82 minutes**. The size caps in §1.4 bound every path to about **75–88 minutes**. Stealth play runs longer (CS Challenges 5); that is accepted, not corrected.

### 1.4 Size classes: Cabinet, Department, Wing

The frame describes a department as about 40×30 tiles with 6–10 galleries. Size classes split that range so that department length varies within a run, and so that the placard's "Allow N minutes" line is a real choice.

| Class | Galleries | Footprint | Clock B (CS §5.1) | Encounter base E0 | Ambient loot | Placard line |
|---|---|---|---|---|---|---|
| **Cabinet** | 5–6 | ~32×24 | 480 | 16 FE | 5 consumables, 1 equipment | "Allow 5 minutes" |
| **Department** | 7–8 | ~40×30 | 650 | 22 FE | 7 consumables, 2 equipment (CS §6.6) | "Allow 8 minutes" |
| **Wing** | 9–10 | ~48×34 | 800 | 28 FE | 9 consumables, 3 equipment, +1 optional vault | "Allow 11 minutes" |

**Fixed across sizes:** the quotas (2 Restoration kits, 1 Clearance card, 1 Certificate), the curio or instrument, and the Masterpiece. A Cabinet is therefore *efficient but lean*: the same essentials, less ambient loot, less danger, less time. A Wing is *rich but long*. That is a real door decision, not a dominant one, because ambient loot and danger both scale.

**How sizes are assigned.**
- The department spec lists its allowed sizes. "A Cabinet of …" concepts may pin Cabinet.
- The sequencer then draws a size per graph node with weights by floor:
  - floor 1: Cabinet .35 / Department .55 / Wing .10;
  - floor 2: .20 / .55 / .25;
  - floor 3: .15 / .50 / .35.
- **Per-path caps:** at most 2 Wings and 3 Cabinets on any path; at most 1 Cabinet on floor 3; never a Wing at depth 1.

**Decision R2: size classes?**

| Option | Tradeoff |
|---|---|
| (a) All departments the same size | Simplest to calibrate and to time; runs feel metronomic. |
| (b) **Three classes under per-path caps** | Varied pacing and a time line on the placard. One more calibration axis (E0 per size). |
| (c) Size fixed by the department spec | Concept-faithful, but the sequencer loses its time-budget control. |

*Lean: (b).* If Julian picks (a), every department is a Department, and the Stair Hall timings carry the pacing alone. Calibration cost falls by about a third.

### 1.5 Stair Halls (seam rooms)

A Stair Hall is a small authored room, about 16×12 tiles, with seeded dressing. ML §3.6 proposes stair halls as seams that "keep the museum continuous despite the random order".

**Rules:** no closing clock, no enemies, no regeneration. You leave when you choose. Nothing in it can be farmed.

**Services:**

| Service | What it offers | Cost |
|---|---|---|
| **Café** (choose exactly one) | *Tea and a Sit-Down*: heal 40% of max HP, clear statuses. *Workshop Hour*: +1 Restoration level on one item, applied by the Conservator. *Reading Room*: every carried item to rung 5, plus one seal identified. | Free |
| Gift-shop kiosk | Identified consumables, sometimes a curio | Coins (§4.5) |
| Conservator | Transfer levels, repair a forgery, sell one Restoration kit per floor (CS §11) | 30 / 40 / 120 coins (kit price reduced by §4.3) |
| Registrar | Fully catalogues one item free (CS §11) | Free |
| Directory | The coming floor's map (Decision R3) | Free |

The café choice is Slay the Spire's rest site (heal or upgrade, RS F14), given a third, museal option.

**Run beats.** A placeholder schedule; the class content belongs to the core/classes owner.

| Stair Hall | Beat | Example (illustrative) |
|---|---|---|
| 1 (after 3 of 8) | **Appointment**: choose 1 of 2 specialisations for your class (SPD subclass, RS F5) | Night Guard: *Head of Security* or *Night Porter* |
| 2 (after 6 of 8) | **Master Key**: choose 1 of 3 run-level actives, 1 charge per department (SPD's late ability) | *Close the Gallery* (seal a room's doors for 20 turns), *Lights Up* (one room Bright for 30 turns), *Visiting Expert* (the Registrar catalogues everything you carry, now) |
| 3 (after 8 of 8) | **Exit preview**: the Exit placard shows what the Registrar will recall (§1.6) | "The Registrar will recall: Swarm, Darkness, Hazard; and the Regulator's Clock" |

**Decision R11: the café.**

| Option | Tradeoff |
|---|---|
| (a) **One of three** (heal / restore / catalogue) | A real decision every floor; healthy players get power. |
| (b) Always heal 40%, plus a shop | No decision; more forgiving. |
| (c) Full heal | Removes attrition across floors; floor 1 damage stops mattering. |

*Lean: (a).* If Julian picks (b), Restoration supply drops by up to 3 per run and `base(t)` on floors 2–3 falls about 5%.

### 1.6 The Exit and the final encounter

**Where it sits.** Depth 9, reached from Stair Hall 3. It is an authored template with seeded variation:
- the **Main Hall**, a grand hall with mezzanine, about 30×20 (ML programme);
- the Information Desk and the Registrar's desk;
- the **Gift Shop**, a one-way coda where the shop is open as a last spend (PL §3 maps "Exit through the gift shop" onto one-way travel);
- the **revolving doors**.

**The Registrar.** It wants to accession you (frame lean). It is staff, not an exhibit, so the institution stays the joke (CS Challenges 2):
- **Stats.** HP 217 (the Masterpiece curve extrapolated to depth 9), Padding 3, Slow. Always aware, so it cannot be surprise-attacked.
- **Accession Stamp.** A telegraphed 3-tile line. It deals no HP damage. On a hit it pins **2 Accession tags** on you.
- **Accessioned.** At **10 tags** the run ends: "*Figure of a Visitor, Accessioned (Run N)*". This counts as a loss.
- **Removing tags.** A Deaccession Form removes all of them, and a Solvent drink removes 2. Both reuse existing consumable kinds (CS §6.4).
- **Recalls.** HP danger comes from the exhibits it recalls from departments you visited, at depth-9 stats, with their own roles and wake rules.

**Phases.** A phase ends at its HP threshold or after 30 turns, whichever comes first:

| Phase | Registrar | Recalls |
|---|---|---|
| 1 *Intake* | Stamp every 3rd action | 2 exhibits from your floor-1 departments |
| 2 *Cataloguing* | Stamp, plus a ring *Catalogue Sweep* around the desk every 4th action | 2 exhibits from floor 2. **The revolving doors start cycling:** open 3 turns in every 12, with a bell 2 turns ahead |
| 3 *Accession* | Stamp cadence every 2nd action | 1 exhibit from floor 3, plus **one Masterpiece "for a proper viewing"**: the one you engaged least (skipped, then viewed, then defeated), at 40% HP with its phase-1 pattern only |

**Two ways to win**, so fight, sneak and leave all stay legitimate:
- **Defeat the Registrar:** "Escaped, with a receipt".
- **Sign out:** pass the revolving doors during an open cycle with fewer than 10 tags: "Escaped".
- Both count as escapes. Whether "receipt" pays extra is the meta section's call.

**Calibration.** The target is p\*(9) = 15% for the median persona. The knobs are Registrar HP, stamp cadence, recall count (4–6) and the door cycle. Because recalls depend on the run, the harness calibrates the Exit on run histories sampled from nightly whole-run sims (§8.4), not on one fixed history.

**Decision R8: the Exit.**

| Option | Tradeoff |
|---|---|
| (a) **Registrar with two win paths** (defeat or sign out) | Respects fight/sneak/leave; the recalls make the finale a summary of the run; calibration needs run-history sampling. |
| (b) A pure boss fight | Simplest and most conventional; stealth builds are punished at the end. |
| (c) A pure escape set piece (no boss) | On tone; risks an anticlimax after 8 Masterpieces. |

*Lean: (a).* If Julian picks (b), the Sneak persona's clear rate needs its own gate, because stealth runs would end on a forced fight.

### 1.7 How "the type of challenge also varies" is guaranteed

The brief's unfinished sentence becomes six mechanisms:
1. **Declared types.** Every department has a primary and a secondary challenge type from the closed list of 8 (§5). Its placard shows both.
2. **The declarations are measured, not asserted.** The fingerprint gate (§5.3) ships a department only if simulated play shows its declared primary among its top two measured type scores.
3. **The sequencer enforces rotation** (§2.4):
   - no primary twice in a row;
   - distinct primaries behind the doors of one room;
   - per run, at most two types repeat, each at most twice and at least three departments apart.
4. **The Masterpiece form follows the type** (§6.4): Guarded and Locks departments end in a heist, not a fight.
5. **The architecture varies.** No architectural programme twice in a row (ML programmes P1–P12).
6. **The Exit recalls across the run** (§1.6), so the finale mixes the run's types.

**Prototype result** (synthetic pool of 30, 200 simulated runs with random door choices, §2.5):
- distinct primary types visited per run: 5 in 5.5%, 6 in 64.5%, 7 in 26%, 8 in 4%;
- types offered on placards: 7.97 of 8 on average.

---

## 2. Route choice

### 2.1 Doors and placards

Each department's exit lobby holds 2–3 doors. Each door carries a placard, which is a short readable label (RS F15, frame pillar 2). A placard has **five lines at most** and **icons for every mechanical fact**:

```
┌──────────────────────────────────────────────────┐
│ TIDES 2 · WEATHERS, DOMESTICATED                 │  name: family + ordinal + title (LM §3.2)
│ "Rain, fog and minor storms, collected at slack  │  curatorial blurb, one line on phones
│  tide and kept under glass."                     │
│ [≈ Hazard]  [⌛ attrition]        Allow 8 minutes │  primary (large), secondary (small), size
│ Featuring: The Barometer That Remembers  [⚔]     │  Masterpiece name and form icon
│ [Loan Desk]  [Conservation lab]                  │  reward icons (0–2)
└──────────────────────────────────────────────────┘
```

**What a placard shows:**
- **Name and blurb.** Generated text from the department pack.
- **Primary and secondary challenge type** as icons. These match the perk families (CS §8.5), so choosing a door is also choosing which perk family the Certificate will offer, as choosing a Hades god is (RS §3.4).
- **Size** as "Allow N minutes", a museum convention that doubles as a time cost.
- **The Masterpiece's name and form**: fight ⚔, heist ◇, set piece ◎ (§6.4).
- **Reward icons**, from a closed list: Loan Desk, Conservation lab, Registry desk, "Visitors reported" (a fellow visitor), Special Exhibition, Restricted.
- **A Special Exhibition ribbon**, when present: "SPECIAL EXHIBITION · Timed entry". This is the Hades skull (RS F15): more danger and an extra Highlight (§3.10).
- **A credit line**, only for Peoples departments: "Displayed at the request of …" (LM §4.2, rule 6).

**What a placard never shows:** the department's danger as a number. Depth sets danger, and every door at a given depth is calibrated to the same p\*(t). The only danger signal is the Special Exhibition ribbon.

### 2.2 The hidden graph, generated one floor at a time

The frame calls for Hades-style doors over a hidden, Slay-the-Spire-style graph with guaranteed rows (RS D2). This draft builds that graph **one floor at a time**:
- floor 1 at the Entrance Hall;
- floor 2 at Stair Hall 1;
- floor 3 at Stair Hall 2.

Each floor's graph is conditioned on the departments you actually visited.

**Graph shape:**

| Floor | Rows (departments) | Width per row | Out-degree | In-degree |
|---|---|---|---|---|
| 1 | 1, 2, 3 | 3, 3, 3 | 2 (25%: 3) | ≤ 2 |
| 2 | 4, 5, 6 | 3, 3, 3 | 2 (25%: 3) | ≤ 2 |
| 3 | 7, 8 | 3, 2 | 2 | ≤ 3 into row 8 |

The first row of each floor is offered whole: the Entrance Hall or the Stair Hall shows all 3 doors.

**Why per floor and not per run.** I first prototyped one graph for the whole run with the per-path variety rule (§2.4). A naive backtracking search failed on nearly every seed. Each node must satisfy the rule for every path through it, and the paths multiply. Generating per floor has three advantages:
1. The constraint problem shrinks to 9 nodes.
2. Constraints apply to the one real history rather than to every hypothetical one.
3. The Directory (§2.7) can still show the whole coming floor.

**Reproducibility.** Seeds stay reproducible, because a floor's graph is a pure function of the run seed and the departments already visited (TA §3.2, named streams: `rng(runSeed,'sequence',floor)`). Two players on the same daily seed who make the same choices see the same doors.

### 2.3 Guaranteed rows

| Guarantee | Rule | Precedent |
|---|---|---|
| **Orientation row** | Row 1: complexity ≤ 2, primary ∈ {Swarm, Artillery, Guarded, Hazard, Locks}, size ≠ Wing | StS easy pool for the first encounters (RS F14) |
| **Treasure row** | On every floor, every path passes at least one department with a Loan Desk | StS treasure row (RS F14) |
| **Rest rows** | Each floor's last row leads to a Stair Hall (§1.5) | StS rest before the boss |
| **Elite node** | Floors 2 and 3 each hold ≥1 Special Exhibition node; never row 1; never on consecutive rows of one path | StS elites, Hades skull doors |
| **Service before the finale** | Floor 3 holds ≥1 node with a Conservation lab or Registry desk | |
| **Restricted Wings** (heat, §7.4) | Rows ≥ 4 only, and only at or above their heat threshold | Dead Cells Boss Stem Cells (RS F16) |

### 2.4 Sequencer constraints

**Hard constraints** (H). The relaxation order on failure is given below.

| # | Constraint |
|---|---|
| H1 | No department twice in a run. |
| H2 | **No primary challenge type on consecutive departments**, across Stair Halls too (StS "the same elite cannot occur twice in a row", RS F14). |
| H3 | **Doors leaving one room offer pairwise distinct primaries.** Every choice is a choice of challenge. |
| H4 | Row-1 rules (§2.3). |
| H5 | **Complexity cap by row:** 2, 3, 3, 4, 4, 5, 5, 5. A department of complexity *c* is allowed only at rows whose cap is ≥ *c*. |
| H6 | **Per-path repeat rule:** at most 2 primary types repeat in a run, each at most twice, with at least 2 departments between the repeats. Hence ≥6 distinct primaries. |
| H7 | No family on consecutive departments. |
| H8 | No architectural programme on consecutive departments. |
| H9 | Peoples (when the family exists): ≤1 per run, rows 2–7, never a Special Exhibition (§2.6). |

**Relaxation ladder.** If a floor cannot be built in 30 restarts of a bounded backtracking search, the sequencer tries these in order:
1. H6 with 3 repeated types;
2. H6 with repeats 2 apart;
3. additionally drop H7/H8 and raise the H5 caps by 1;
4. H6 reduced to "each type at most twice per run", with H1–H3 kept.

Every relaxation is logged to the dashboard. A rising rate means the pool has a hole.

**Soft weights** (S), multiplied into each candidate's draw weight:

| # | Weight | Purpose |
|---|---|---|
| S1 | `exp(−0.5 × |c − c_target(t)|)`, with `c_target(t) = 1 + 4(t−1)/7` | Pushes complex departments later (frame) |
| S2 | `exp(−((dist − 0.65)/0.2)²)` on the theme distance to the previous department | EDRL's "moderate degrees of content diversity" between consecutive segments (BK F9, p. 250). *Low weight*: see Challenges §10.1 |
| S3 | ×2 if this primary has not appeared on the path yet | In-run pity for unseen types |
| S4 | `1 + 0.25 × k` (cap 3), k = runs since this department was last *offered* to this player | Novelty-driven door offers across runs (BK D6) |
| S5 | Size weights by floor (§1.4) | Pacing |

**Theme distance:**
- **Formula:** `dist = 0.35·[family differs] + 0.20·[subject category differs] + 0.20·[programme differs] + 0.25·min(1, ‖theme embedding difference‖)`.
- **Embeddings:** the content pipeline supplies the theme embeddings with each pack (PL §6(iii), the theme novelty archive).

### 2.5 Prototype results

Method:
- **Script:** `seq_floor.py`, in Python.
- **Pool:** a synthetic pool of 6 launch families × 5 departments. Primaries are biased by family motif (Light toward Darkness, Tides toward Hazard, and so on), 2 departments are Social-primary, and complexity is distributed 5/8/8/6/3 over levels 1–5.
- **Players:** door choices are uniform random, so this is a worst case for variety. Real players would favour some types.
- **Not modelled:** the Loan Desk row, Special Exhibition nodes and sizes. These are cheap to add, because each is a per-node attribute rather than a path rule.

| Pool | Graph | Runs built | Distinct primaries per run | Types offered (of 8) | Built at the strictest rule | Python time per run |
|---|---|---|---|---|---|---|
| 30 | 3-wide | 200/200 | 5: 5.5%, 6: 64.5%, 7: 26%, 8: 4% | 7.97 | 85.5% | 0.19 s |
| 24 | 3-wide | 100/100 | 5: 7%, 6: 54%, 7: 37%, 8: 2% | 7.98 | 79% | 0.09 s |
| 60 | 3-wide | 100/100 | 5: 5%, 6: 67%, 7: 27%, 8: 1% | 7.99 | 87% | 0.74 s |
| 16 | 3-wide | 43/50 | 5: 9%, 6: 63%, 7: 28% | 7.84 | 30% | 0.59 s |
| 16 | 2-wide | 100/100 | 5: 8%, 6: 48%, 7: 41%, 8: 3% | 7.85 | 78% | 0.06 s |
| 12 | 2-wide | 57/100 | 5: 30%, 6: 58%, 7: 12% | 6.81 | 12% | 0.39 s |

**What this says:**
- **Minimum pools.** A pool of **16 is the minimum for 2-door offers**, and **24 for 3-door offers**. A 12-department vertical slice cannot run the full sequencer. It should use 2-door offers with H6 off.
- **Runtime.** The sequencer must run in JS at a Stair Hall within about 200 ms. Python takes up to 0.74 s per *run* (three floors) for a pool of 60. Precomputing per-department candidate masks, and pruning on the closed type enum, should bring JS well under that. That is a guess to verify at build milestone M2.

### 2.6 Pity counters and Peoples rarity

- **Type pity, in-run:** S3.
- **Department novelty, across runs:** S4. This is stored in the player profile, so it is meta state, but it never changes difficulty: it changes only which departments are *offered* (BK F17: "adapt what is offered, not how hard it is").
- **Peoples, when the family ships:**
  - **Pool cap:** at most 1 in 4 departments of the pool (LM rule 1).
  - **Per run:** at most 1 Peoples node.
  - **Frequency:** included in a floor graph with probability 35%, plus 15 points for each run in which none was included, and reset when one is. That averages about one run in two.
  - **Constraints:** never a Special Exhibition, never in row 1, and never on a floor that holds a Restricted Wing.

### 2.7 Seeing further ahead

**Decision R3: how far can the player see?**

| Option | Tradeoff |
|---|---|
| (a) The next doors only (Hades) | Each door is a fresh decision; no planning beyond one step. |
| (b) **(a), plus the Directory at each Stair Hall** showing the whole coming floor as primary-type icons only (no names, rewards or sizes) | Three-step build planning per floor, a museal object (the directory board) and little analysis paralysis. |
| (c) The full floor with every placard detail | StS-style route optimisation; slower door decisions on phones. |
| (d) The whole run up front | Incompatible with per-floor generation; front-loads all planning. |

*Lean: (b).*
- **A paid upgrade.** A Floor Plan consumable read in an exit lobby also shows each door's *next* doors (icons only).
- **If Julian picks (a):** the Directory becomes decorative, and per-floor generation could become fully lazy (generate the offers at each door), which is simpler.
- **If (c):** placards need a compact map rendering on phones.

---

## 3. The difficulty model

### 3.1 Depth and tiers

- **Depth t.** The department's position in the run, 1–8; the Exit is 9. Depth alone indexes:
  - enemy stats (§3.2);
  - item tiers (CS §2.5);
  - composition unlocks and pack caps (§3.5);
  - complexity caps (H5);
  - p\*(t).
- **Tiers.** Each floor is a *tier* for naming and for item tiers. Floor 1 is depths 1–3, floor 2 is 4–6, floor 3 is 7–8.
- **Heat** adds directives on top (§7); it never changes t.
- **Calibration depths.** A department is calibrated only at depths it can occupy (H5):

  | Complexity | Allowed depths | Calibrated at |
  |---|---|---|
  | 1–2 | 1–8 | 1, 4, 8 |
  | 3 | 2–8 | 2, 5, 8 |
  | 4 | 4–8 | 4, 6, 8 |
  | 5 | 6–8 | 6, 7, 8 |

  The sequencer's complexity caps thus also shrink the calibration problem (PL pitfall 8: "tier explosion").

### 3.2 Role curves and the player power curve

**Role curves.** CS §2.6 gives anchors at depths 1, 4 and 8 and says to interpolate linearly. This section fixes the functional form so that every depth, and the Exit, is defined:
- **Interpolation.** `stat(t) = floor(lerp over the anchors 1→4→8)`.
- **Extrapolation.** Beyond 8, the 4→8 slope continues.
- **HP shape.** HP is close to linear with a small upward bend after depth 4. Fodder is exactly `7 + 3(t−1)`.

Computed by `roles.py`. Each cell is HP / damage / Padding:

| Role | t=1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | Exit (9) |
|---|---|---|---|---|---|---|---|---|---|
| Fodder | 7/1-4/0 | 10/1-5/0 | 13/2-6/0 | 16/3-8/1 | 19/3-9/1 | 22/4-10/1 | 25/4-11/1 | 28/5-13/2 | 31/5-14/2 |
| Skirmisher | 12/2-5/0 | 16/2-6/0 | 20/3-7/0 | 24/4-9/1 | 28/4-10/1 | 33/5-11/1 | 37/6-12/1 | 42/7-14/2 | 46/7-15/2 |
| Artillery | 10/2-5/0 | 13/2-7/0 | 16/3-9/0 | 20/4-11/0 | 23/4-12/0 | 27/5-13/0 | 31/6-14/0 | 35/7-16/1 | 38/7-17/1 |
| Brute | 15/3-7/1 | 21/4-9/1 | 28/5-11/1 | 35/6-14/2 | 42/7-16/2 | 50/8-18/2 | 57/9-20/2 | 65/10-22/3 | 72/11-24/3 |
| Controller | 12/1-3/0 | 16/1-3/0 | 21/1-4/0 | 26/2-5/1 | 31/2-5/1 | 36/2-6/1 | 41/2-7/1 | 46/3-8/2 | 51/3-8/2 |
| Warden | 21/2-5/1 | 30/2-6/1 | 39/3-8/1 | 49/4-10/2 | 59/4-11/2 | 70/5-12/2 | 80/6-13/2 | 91/7-15/3 | 101/7-16/3 |
| Masterpiece (HP) | 45 | 65 | 85 | 105 | 127 | 150 | 172 | 195 | 217 |

**Player power curve.** The median build at the start of each department (CS §8.7). The Exit column is my extrapolation from CS's "max HP 60, Clearance 18":

| t | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | Exit |
|---|---|---|---|---|---|---|---|---|---|
| Max HP | 20 | 25 | 30 | 35 | 40 | 45 | 50 | 55 | 60 |
| Mean weapon damage | 4 | 5 | 7 | 9 | 11 | 13 | 14 | 16 | 17 |
| Acc / Padding | 3/1 | 3/1 | 4/2 | 4/3 | 5/3 | 5/4 | 5/5 | 6/5 | 6/6 |
| HP index (t=1 = 1) | 1.00 | 1.25 | 1.50 | 1.75 | 2.00 | 2.25 | 2.50 | 2.75 | 3.00 |
| Damage index | 1.00 | 1.25 | 1.75 | 2.25 | 2.75 | 3.25 | 3.50 | 4.00 | 4.25 |
| Fodder HP index | 1.00 | 1.43 | 1.86 | 2.29 | 2.71 | 3.14 | 3.57 | 4.00 | 4.43 |

**How the two curves relate:**
- **Stats grow in lockstep.** Enemy HP grows with player damage (fodder HP ×4 against damage ×4). Enemy damage after Padding grows with player HP: a fodder hit stays at 6–9% of max HP at every depth, a brute hit at 19–22%.
- **Lockstep is the point of "depth sets power".** A role means the same threat at every depth, so a department's identity never fixes its difficulty (RS pitfall 1).
- **What rises with depth is composition.** Rising difficulty is carried by budget, composition, pack size, champions, loans and Masterpiece phases (§3.4–§3.7), and by p\*(t).
- **What the median build leaves out.** It excludes perks, curios, the Signature piece and the Appointment. That unmodelled power is what `base(t)` absorbs (§3.4).

### 3.3 What a role costs: fodder equivalents

A budget needs one currency. I use the expected fraction of max HP the median player loses in a **head-on duel** with one exhibit:
- **What it includes:** hit chances from CS §2.2; Padding; brute attacks at 150 ticks; 2 turns of approach under fire for artillery; half a turn of tempo lost per controller status; a 50% dodge on warden specials.
- **What it ignores:** surprise attacks, chokepoints, consumables and stealth. It is a currency, not a forecast.

| Role | Duel: turns / HP lost at t=1 | t=4 | t=8 | Cost in FE (range over t=1..9) | **FE used** |
|---|---|---|---|---|---|
| Fodder | 2.1 / 14% | 2.4 / 14% | 2.2 / 14% | 1.0 | **1** |
| Skirmisher | 4.0 / 40% | 4.0 / 34% | 3.7 / 34% | 2.2–3.0 | **2.5** |
| Artillery | 4.9 / 53% | 4.6 / 53% | 4.6 / 52% | 3.6–4.5 | **4** |
| Brute | 5.6 / 52% | 5.6 / 56% | 5.3 / 56% | 3.8–4.8 | **4** |
| Controller | 5.5 / 30% | 5.9 / 18% | 5.7 / 14% | 0.8–2.2 | **2** (fixed; its threat is the status, which the duel undercounts) |
| Warden | 8.7 / 95% | 8.8 / 98% | 8.2 / 89% | 6.3–7.5 | **7** |
| Champion modifier | | | | | ×1.75 |
| Out-of-depth loan at +Δt | | | | | ×(1 + 0.25Δt) |

**Two readings for Julian:**
- **Ratios are stable across depth.** FE costs vary by less than ±20% from t=1 to t=9, so constant FE costs are defensible. The residual sawtooth comes from the player's Padding stepping in whole points.
- **A head-on warden costs most of a health bar.** That is intended: wardens guard optional cases and Masterpiece approaches. Fighting one is a decision, made with the examine readout's odds (CS §2.7).

### 3.4 Encounter budget

```
E(d, t, size, heat) = E0[size] × base(t) × e^{b(d)} × M_type × M_special × H(heat)
```

| Term | Value | Source |
|---|---|---|
| E0 | Cabinet 16, Department 22, Wing 28 FE | §1.4 |
| base(t) | **First draft:** `1 + 0.06(t−1)`, i.e. 1.00, 1.06, … 1.42 at t=8. **Then fitted** to p\*(t) on the whole pool (§3.8) | PL §6(ii) |
| b(d) | Per-department offset, bounded to [−0.6, +0.6], so ×0.55 to ×1.82 | §3.8 |
| M_type | Locks 0.85, Social 0.80, all others 1.0. In those two types the danger lives elsewhere | §5 |
| M_special | 1.3 for a Special Exhibition | §3.10 |
| H(heat) | Directives act on composition, not E, except Touring Exhibition | §7 |

**First-draft budgets (FE)** at b = 0:

| Size \ t | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Cabinet | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 |
| Department | 22 | 23 | 25 | 26 | 27 | 29 | 30 | 31 |
| Wing | 28 | 30 | 31 | 33 | 35 | 36 | 38 | 40 |

**A worked depth-1 Department (22 FE):**
- **Roster:** 6 fodder (6), 2 skirmishers (5), 1 artillery (4), 1 warden (7).
- **Fighting all of it head on**, one at a time, costs about 3.1 health bars: 6 × 14% + 2 × 40% + 53% + 95%.
- **The median player's HP supply in a Department** is about 3 bars:
  - 1 bar at the start;
  - about 1 from regeneration over ~400 damaged turns (CS §5.6: full recovery takes about 400 turns);
  - about 1 from ~1.4 Consolidants at 75% each (§4.2).
- **So fight-everything sits at the edge.** A Vandal must use surprise attacks and chokepoints and skip the warden. A Sneak spends far less. That is the intended shape: fighting all is possible but not free (RS F10: "no XP… stealthy tactics were more viable").

**Where the budget goes inside a department:**

| Gallery role | Share | Rule |
|---|---|---|
| Intro | ≤ 8% | Orientation pool only (§3.6) |
| Sections (2–4) | ~70%, split 1 : 1.3 : 1.6 (: 1.9) | Later sections hold more: Dahlskog & Togelius's "pedagogic" macro-pattern (PL F4) |
| Optional rooms (vaults, special rooms, staff layer) | ~22% | Guardians of optional loot (PL F9: "treasure is typically guarded") |
| Coda, exit lobby | 0 | |
| Masterpiece hall | outside E | §6 |

**Spending.** The curator pass (layout section) spends each gallery's share greedily by the role mix (§3.5), placing roles by pattern (ML §3.4 step 5: snipers on high-isovist tiles, ambushers on aisle crossings). Leftover below 1 FE is dropped. The online validator checks that the placed budget is within ±10% of E (PL §6(i)).

### 3.5 Composition by depth and by challenge type

**Unlocks and caps by depth:**

| Depth | Controllers | Wardens | Champions | Loan probability (§3.7) | Pack cap (Swarm +2) | Mixed-role packs |
|---|---|---|---|---|---|---|
| 1 | 0 (1 if the signature mechanic is a status) | ≤ 1, dormant, guarding an optional case | 0 | 0 | 3 | no |
| 2–3 | ≤ 1 | ≤ 1 | 0 | 25% | 4 | fodder + skirmisher |
| 4–5 | ≤ 2 | ≤ 2 | 1 | 35% | 5 | + artillery escorts |
| 6–8 | ≤ 3 | ≤ 3 | 2 | 45% | 6 | any |

- **Pack cap:** the largest group one wake event can raise together.
- **Champions:** elite modifiers from the enemies section; SPD's Hostile Champions (RS F8).

**Role mix by primary type** (shares of FE):

| Primary | Fodder | Skirm. | Artillery | Brute | Controller | Warden | Also |
|---|---|---|---|---|---|---|---|
| Swarm | 55 | 25 | 5 | 5 | 5 | 5 | Fodder may take the *Swarming* modifier: 0.7 FE each, packs +2 |
| Artillery | 20 | 10 | 40 | 10 | 10 | 10 | Glass ratio ≥ 0.5, balconies |
| Guarded | 20 | 20 | 10 | 10 | 10 | 30 | 3 staff guards (CS §3.7) |
| Darkness | 25 | 30 | 5 | 15 | 15 | 10 | Ambushing skirmishers with DARK/LIGHT triggers |
| Hazard | 30 | 20 | 15 | 15 | 10 | 10 | The hazard module's tiles |
| Locks | 25 | 20 | 15 | 15 | 10 | 15 | ×0.85 budget; puzzle rooms |
| Attrition | 30 | 20 | 15 | 15 | 15 | 5 | Draining controllers; B × 0.75 (CS §5.1) |
| Social | 35 | 20 | 10 | 10 | 10 | 15 | ×0.80 budget; NPCs |

The secondary type blends in at 25%: `mix = 0.75 × primary + 0.25 × secondary`.

### 3.6 The orientation pool

**Where it applies.** The first encounters of **every** department draw from an orientation pool (RS F14: "The first three encounters in Act 1… are drawn from the easy pool"). This mitigates most of the random-order problem: whatever depth a department lands at, its first minute teaches its gimmick before it hurts. It covers:
- every encounter in the Intro gallery;
- the first two encounters of section 1;
- in department 1, all of section 1.

**Rules:**
- **Roles.** Fodder and skirmishers only, at the department's depth stats. One telegraphed controller is allowed if the signature mechanic is a status.
- **Packs** of at most 2.
- **Excluded:** champions, loans, wardens, and artillery with a sightline into the Intro.
- **They teach.** Every orientation exhibit carries the department's **signature wake trigger**, so the first thing the player learns is what wakes things here.
- **Placement.** Intro exhibits sit inside the ML §3.4 entrance safe zone's edge (8 tiles by FOV and by walk), never inside it.
- **Cost.** Orientation spend is ≤ 8% of E (§3.4).

**Validation**, after Khalifa et al.'s limited agents (PL F18):
- The Intro gallery must *require* the signature mechanic. The full median persona passes it in ≥ 95% of seeds; the limited persona without the mechanic fails its check in ≥ 80% of seeds.
- The Cautious novice survives the Intro in ≥ 99% of seeds (PL §6(ii)).
- **Department 1 extras.** Department 1 places one Consolidant and one Catalogue Card in section 1. This is CS Risk 7's "teach Consolidant and Catalogue Card in department 1".

### 3.7 Out-of-depth loans

**The precedent.** DCSS intends out-of-depth monsters "to keep players on their toes" (RS F12). We make them visible, optional and rewarded, after RS §3.3: "announced on a placard".

**What a loan is:**
- **Which exhibit.** An exhibit from another pool department, of role skirmisher, artillery, brute or warden, at stats for depth `min(t + 2, 9)`. Cost: 1.5× its FE.
- **What it brings.** It keeps its home department's skin and **wake trigger**. A Light-family moth lent to a Tides department still wakes on lantern light. Its placard shows that trigger as a pictogram: "*On loan from Light 3, Works on Paper, Kept Dark*".
- **What it guards.** A loan case holding an item one tier above the depth's higher tier (a T+1 weapon, garment or curio).

**Where loans may and may not appear:**
- **Frequency.** By the probabilities in §3.5, with at most one per department.
- **Forbidden places:** the Intro, section 1, the Masterpiece hall, and the shortest entrance-to-exit route. A loan is therefore always optional.
- **Heat.** *Touring Exhibition* (§7) lifts the route restriction and raises the depth offset.

### 3.8 Calibration: `base(t)` and `b(d)`

**The idea** (PL §6(ii)): fit a per-department offset b(d) so that the median persona's death rate in department d at depth t hits p\*(t). Two refinements make this tractable.

**1. "Median persona" means the median across the roster.**
- **The definition.** At depth t, the reference death rate `D̃(d,t,b)` is the median of the six personas' death rates, each at median skill (§8.1–8.2).
- **Why not one reference persona.** A department's challenge type is *meant* to make some persona dominant and another submissive (§5). A median across personas is robust to that by construction. A single reference persona would make every Guarded department look lethal to the Vandal.

**2. One scalar per department, two levels of fit.**
- **Global first.** With b fixed, fit `base(t)` (8 values plus the Exit) so that the median over the pool of `D̃` equals p\*(t). Constrain the pool mean of b to 0.
- **Then per department.** With base fixed, fit b(d) as the single scalar that minimises the squared logit error over the department's calibrated depths:
  ```
  logit D̃(d,t,b) ≈ α_d,t + γ_d · b          (logistic fit to a 5-point sweep, b ∈ {−0.4, −0.2, 0, 0.2, 0.4})
  b*(d) = Σ_t (logit p*(t) − α_d,t) / (|T_d| · γ_d)
  ```
- **Alternate the two fits two or three times.** This is the same separation PL §6(ii) proposes, written so that random order costs one parameter per department, not one per department per depth (PL pitfall 8).

**Failure handling:**
- **Saturated:** `|b*| > 0.6`. The department's danger is not budget-driven; its rule module is lethal or toothless. Use the secondary knob, module intensity κ (hazard density, lux band, flood period), or send the spec back.
- **Depth-inconsistent:** any calibrated depth leaves a residual `|logit D̃ − logit p*| > 0.35`. The department scales wrongly with depth. Fix its spec (often a module whose damage does not scale with t), or give it a per-department depth slope as a last resort.

**Worked example** (illustrative numbers, not simulation output). *Tides 2*, complexity 3, is calibrated at depths 2, 5 and 8. The sweep gives:

| b | −0.4 | −0.2 | 0 | +0.2 | +0.4 |
|---|---|---|---|---|---|
| D̃ at t=2 (target 5%) | 2.9% | 3.8% | 4.9% | 6.4% | 8.1% |
| D̃ at t=5 (target 8%) | 4.6% | 6.0% | 7.6% | 9.9% | 12.4% |
| D̃ at t=8 (target 12%) | 6.0% | 7.9% | 10.1% | 13.0% | 16.4% |

- **Fit.** The logistic fit gives γ ≈ 1.3 per unit b. The per-depth zero points are b = +0.01, +0.04 and +0.14. The least-squares b\* is **+0.06**.
- **Residuals.** At b\*, the logit residuals are 0.06, 0.02 and 0.10, all under 0.35, so it ships.
- **What the drift means.** The rising zero point says Tides 2 gets relatively easier with depth. Its flood damage probably scales with t more slowly than the role curves do. The dashboard flags that trend (residual slope) even when the gate passes.

**Other knobs calibrated the same way:** the Masterpiece (§6.3), the clock multiplier (CS §5.1's 2.5, by Completist Highlight completion), and heat values (§7.3).

### 3.9 The target death curve p\*(t) and clear rates

**Candidate p\*(t)**, the death rate per department for the median persona, conditional on arriving:

| t | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | Exit |
|---|---|---|---|---|---|---|---|---|---|
| **p\*(t)** | 3% | 5% | 7% | 6% | 8% | 10% | 10% | 12% | 15% |

**The sawtooth** gives each floor its own rise and a small relief after each Stair Hall. It echoes the tension-and-relief sequencing in Wen et al. (2025), whose rise/fall arcs beat a flat baseline with 16 participants (PL F23). Departments 1–3 are gentle, so first-time players see several departments.

**Clear rates by skill.**
- **The skill model.** Skill shifts the logit: `logit p_s(t) = logit p*(t) − β·s`, with β = 1. A novice (s = −1) has e ≈ 2.7 times the median's odds of dying in each department, and an expert (s = +1) a 2.7th. The harness measures the real β (gate G3 asks for a novice-to-expert gap of ≥ 1.2 logits, against 2 in this model).
- **Results** (`pstar.py`):

| Skill | s | Per-department death, t=1 → Exit | **Run clear** |
|---|---|---|---|
| First-time human (assumed) | −1.6 | 13% → 47% | **3.5%** |
| Novice persona | −1.0 | 8% → 32% | **13%** |
| **Median persona** | 0 | 3% → 15% | **45%** |
| Expert persona | +1.0 | 1% → 6% | **74%** |
| MCTS reference | +1.8 | 0.5% → 3% | **87%** |

**Where the median persona dies:** 26% of deaths on floor 1, 34% on floor 2, 25% on floor 3 and 14% at the Exit. Deaths are spread out, not front-loaded, so failed runs still last.

**For comparison:**
- **A linear curve** (3% → 15%) gives a 42% median clear but loads deaths later.
- **A flat 10%** gives 39% and makes department 1 as deadly as department 8, contradicting the brief's "difficulty generally increases".
- **The arithmetic behind any curve** is PL §6(ii)'s: eight departments at 10% each compound to 0.9⁸ ≈ 43%.

**Decision R4: how hard is the base game?**

| Option | Median clear | First-timer clear | Tradeoff |
|---|---|---|---|
| (a) Gentle: sawtooth × 0.7 | ~58% | ~9% | Most players see the Exit early; heat must carry mastery. |
| (b) **Sawtooth as above** | **~45%** | **~3.5%** | Competent play wins about half; first-timers learn over several runs. |
| (c) Hard: sawtooth × 1.4 | ~32% | ~1% | SPD-like; risks the "one run in thirty" plateau for new players. |

*Lean: (b).* Patron (§9) covers players who want (a), and heat covers those who want (c). If Julian picks (c), the first-floor targets should stay as in (b), so new players still see several departments.

### 3.10 Special Exhibitions

The elite door (RS F14, F15):
- **Danger.** `M_special = 1.3` on E. One extra warden or champion. Its own target is `p*(t) × 1.5`.
- **Extra Highlight.** One card from a run-level **bonus deck**: 2 Restoration kits and 1 curio, without replacement. At most 2 bonus kits per run, so the Restoration total stays between 16 and 18 (§4.1).
- **Placard.** It shows the ribbon and the extra Highlight's icon.
- **Placement.** Never in row 1 (§2.3).

---

## 4. Item economy and bad-luck protection

**The principle** (RS F1, F2): depth sets item *tier* and *quota*; the department supplies only skins. Decks and meters keyed to the run counter go in from day one. CS §6.6 and §8 fix the quantities. This section adds placement rules, floors and pity.

### 4.1 Quotas per department

| Item | Per department | Per run | Placement rules |
|---|---|---|---|
| **Restoration kit** | 2 (Highlights) | 16 (+0–2 from Special Exhibitions, +up to 3 bought, +up to 3 from the café) | (1) one in sections 1–2 and one in a later section; (2) **at least one within a 4-room detour of the shortest entrance-to-exit route**, so a Tourist can choose to get one cheaply; (3) never in a secret room, never in the Masterpiece hall, never behind a lock above the Clearance you will have at that point; (4) at most one behind glass you must break |
| **Clearance card** | 1 (Highlight) | 8 | Placed before the first Clearance-gated case it unlocks. Same exclusions as kits |
| **Certificate** | 1 | 8 | From the Masterpiece: defeat or view (CS §5.4) |
| **Ambient consumables** | Cabinet 5, Department 7, Wing 9 | ~56 | From the run deck (§4.2) |
| **Ambient equipment** | 1 / 2 / 3 | ~16 | Tier by depth (§4.4), with pity (§4.3) |
| **Curio or instrument** | 1 | 8 | From a run deck without replacement; no duplicates (Isaac pools, RS F17) |
| **Coins** | 30–50 | ~320 | CS §6.6 |

**What leaving early costs.** The quotas are *offered*, not *given*. Leaving early forfeits unfound Highlights (CS §5.5), which is the price of the Tourist's time saving. Expected kit collection per run, a calibration target for the harness:
- Tourist ≥ 10;
- median personas 13–15;
- Completist 16.

### 4.2 Consumable supply

**The deck** (CS §6.4):
- 100 cards in the 12 kinds' weights, drawn without replacement.
- A run draws about 56 cards, so the deck never refills mid-run and its proportions hold.
- Kiosks draw from a separate shop deck, so buying never depletes floor supply.

**Floors and caps:**

| Rule | Value | Why |
|---|---|---|
| Consolidant floor | ≥ 1 per department. If the draw lacks one, the last card drawn is swapped for the next Consolidant in the deck | Healing variance is the main cause of runs ended by bad luck. A floor is a meter with zero tuning (RS F2) |
| Department-1 teaching floor | ≥ 1 Catalogue Card in department 1 | CS Risk 7 |
| Per-kind cap | ≤ 3 of one kind per department | No floods of one kind |
| Harmful-kind cap | ≤ 2 of {Fixative, Fumigant, Lamp Oil} drunk-harmful kinds per department | Identification by drinking should not be a death lottery |

### 4.3 Pity meters

Brogue-style meters work on items whose absence hurts (RS F2, `meteredItemsGenerationTable_Brogue`):

| Meter | Rule |
|---|---|
| **Weapon tier pity** | If the player has not been *offered* (placed in a department they entered) a weapon of the depth's higher tier by the start of depth 3, 5 or 7, the next department places one in section 1 |
| **Garment tier pity** | The same, for garments |
| **Forgery streak cap** | At most 1 forgery among a department's ambient equipment and curio. At most 2 forgeries in a row among items the player picks up |
| **Kit catch-up** | Kits are never refunded. But the Stair Hall Conservator's kit price falls by 20 coins per kit the player *missed* on that floor (minimum 60). The cost of leaving early stays, and the spiral is capped |
| **Curio drought** | If a player reaches depth 4 with no curio equipped, the next Loan Desk or Special Exhibition offers a curio first |

### 4.4 Loot tiers by depth

| Depth | Weapon / garment tier (60/40, CS §2.5) | Curio / instrument rank | Signature piece | Loan case (§3.7) | Special Exhibition extra |
|---|---|---|---|---|---|
| 1–2 | T1 / T2 | 1 | T2 | T3 | T2 curio or kit |
| 3–4 | T2 / T3 | 1 | T3 | T4 | T3 |
| 5–6 | T3 / T4 | 1 (60%) / 2 (40%) | T4 | T5 | T4 |
| 7–8 | T4 / T5 | 1 (40%) / 2 (60%) | T5 | T5 +1 level | T5 |

### 4.5 Prices

All prices are in coins; the kiosk never buys (CS §11, RS F12).

| Item | Price |
|---|---|
| Identified consumable | 15–30 by kind (Consolidant 25, Catalogue Card 20, Evacuation Notice 30) |
| Curio or instrument at the kiosk (rare stock) | 70–100 |
| Restoration kit (Conservator, 1 per floor) | 120, less 20 per missed kit, minimum 60 |
| Forgery repair / level transfer / identification | 40 / 30 / 20 (CS §11) |

About 320 coins per run buys roughly two kits, or one kit and a handful of consumables. Coins are a minor lever, so economy calibration lives in the quotas.

### 4.6 What counts as essential

**Essentials** are never placed in secret rooms (RS F6: "upgrade items… are necessary and shouldn't be hidden"), never in the Masterpiece hall, and never behind a lock you cannot yet open:
- Restoration kits;
- the Clearance card;
- the Consolidant floor;
- the teaching floor;
- any label the Highlights box counts as "Labels that catalogue" (CS §8.6).

**What secrets hold:** the rarer consumables, coins, curios and accession-worthy oddities (SPD's purpose-built secrets, RS F6). Brogue biases items toward secret rooms because empty ones are "demoralizing" (RS F2). We bias rare *non-essentials* there.

**Enforcement.** The online validator checks all of this statically (PL §6(i) step 5).

---

## 5. Challenge types

### 5.1 The list

These eight are the frame's list. They match CS §8.5's perk families, so the placard icon, the perk offer and the measured fingerprint all name the same thing.

| Type | Definition (one sentence on the placard's help card) | Produced by | Expected dominant persona | Expected submissive persona | Measured signature (from simulated play, not from inputs) |
|---|---|---|---|---|---|
| **Swarm** | Many weak exhibits that wake together. | Fodder ≥ 50% FE, the Swarming modifier, pack cap +2; Copies (multiples), Specimens (hatching cases); case labyrinth or storage stacks (chokepoints) | Vandal (holds chokepoints) | Tourist (passing through wakes packs) | Mean simultaneous awake hostiles ≥ 3; ≥ 45% of damage from fodder |
| **Artillery** | Ranged, telegraphed threat across sightlines and glass. | Artillery ≥ 35% FE; enfilade, grand hall with mezzanine, sculpture court; glass ratio ≥ 0.5; balconies | Cautious (uses cover) | Vandal (approaches head on) | ≥ 40% of damage from ranged attacks and specials; mean engagement distance ≥ 3 |
| **Guarded** | Patrols and alarms: being seen is the danger. | 3 staff guards, wardens ≥ 25% FE, Sentinel exhibits; two-route layouts with staff corridors; Classification (shared alertness) | Sneak | Vandal, Looter (breaches) | Alarms and Custody events per play; ≥ 30% of wakes caused by guards or alarms |
| **Darkness** | You cannot see what is coming; light is both a resource and a trigger. | Lux bands Dim/Dark, LIGHT/DARK triggers; Light family; paper rooms; ambushing skirmishers | Cautious, Sneak | Looter, Completist (reading needs light) | ≥ 35% of damage from attackers not visible at the start of the player's previous turn; lantern toggles per 100 turns |
| **Hazard** | The floor is the enemy. | Water, fire, shards, floods, collapsing floors; Tides (periodic floods), Machines (demonstrations); court with pools, spiral | Tourist (fewest tiles crossed) | Completist (most tiles crossed) | ≥ 25% of damage from the environment; hazard tiles entered per 100 steps |
| **Locks** | Access is the challenge: keys, switches, sorting. | Lock-and-key rooms (Brogue blueprints, RS F11), sorting puzzles (Classification), staff keys; ×0.85 budget | Completist/Reader (labels carry the hints) | Tourist (skips the gated rewards) | ≥ 40% of Highlights and items behind puzzle gates; turns in puzzle rooms; the no-reading limited agent fails the gated Highlight |
| **Attrition** | The museum wears you down. | B × 0.75, fewer benches, draining controllers; Memory (fading rooms) later | Tourist | Completist, Cautious (slow) | ≥ 40% of Completist plays reach Lights Down; share of HP lost after First Bell |
| **Social** | People change the outcome. | NPCs, fellow visitors, tours, bargains; Peoples and Attendance families later; ×0.80 budget | Completist/Reader (talks to people) | Vandal (violence closes doors) | Gap in outcome between the persona and its no-NPC limited variant ≥ 3 points; NPC interactions per play |

**Dominance is measured** as expected HP fraction at exit (survival × remaining HP), z-scored across the six median personas. This follows Green et al. (2022a), whose personas' *remaining HP* defined dominant and submissive levels (PL F15). For Locks and Social, dominance is measured on the persona's own utility attainment, because those types move rewards more than survival.

**The caveat** (Green et al. 2022b, PL F15). Persona labels were predictable from mechanic frequencies, but players' self-reported play styles "utterly" were not. The icon therefore describes **the department's mechanics, never the player**. Help text says "Expect patrols and alarms", never "For stealthy players". The dominance vector is a QD axis and a sequencing input, not a claim about who will enjoy a department.

### 5.2 Social at launch

None of the six launch families (Copies, Light, Tides, Machines, Specimens, Classification) produces a Social department naturally. Social also has the weakest fingerprint, since combat personas barely register it.

**Lean:** at launch, Social appears **as a secondary type only**, through fellow visitors and Docents. Social primaries arrive with the Peoples and Attendance families. The variety guarantee (H6) still holds with 7 primaries; the prototype ran with only 2 Social-primary departments in 30.

**Decision R6: the challenge-type list.**

| Option | Tradeoff |
|---|---|
| (a) The frame's 8, all available as primaries at launch | Needs social content at launch that no launch family supplies. |
| (b) **The 8, with Social secondary-only until a social family ships** | Honest about launch content; the perk family still exists (CS). |
| (c) Replace Social with **Pursuit** (an unkillable or very tough stalker: a statue that moves when unobserved, a Night-Watch-like hunter) | Strong fingerprint (Tourist dominant, Completist submissive); overlaps Attrition and Guarded; CS perks need a rewrite. |

*Lean: (b).* If Julian picks (c), CS's Social perk family becomes a Pursuit family, and the enemies section owns one more archetype.

### 5.3 The fingerprint gate (placard honesty)

- **Type score vector.** For each department at each calibrated depth, the harness computes the 8 measured signatures (§5.1), z-scored against the pool.
- **Pass condition:** the declared primary ranks **#1 or #2**, and the declared secondary ranks **in the top 4**.
- **On failure:** either change the declaration, which reprints the placard, or change the spec.
- **Why it matters.** This is the brief's "type of challenge" made checkable. It also stops BK's "decorative-only departments" risk: a department whose fingerprint is indistinguishable from the pool mean fails, because no type ranks clearly first.
- **Why the scores are measured.** They are deliberately computed from play outcomes rather than spec inputs: PL F24 and ch. 12 advise metrics "as far as possible from the input parameters".

### 5.4 How the sequencer rotates types

| Scope | Rule |
|---|---|
| Within a run | H2, H3 and H6 (§2.4), plus S3 pity |
| Across runs | S4 novelty pushes departments, and with them types, that the player has not been offered recently |
| Perk coupling | The Certificate offers two perks from the primary family and one from the secondary (CS §8.4). Rotation therefore also spreads perk families, so builds diversify without a skill tree |

---

## 6. Masterpieces

### 6.1 Design rules

| # | Rule | Precedent |
|---|---|---|
| M1 | **Ramp in phases.** Three phases at 100–67–34% HP (two phases at depths 1–2). Phase 1 tests the primary type plainly, phase 2 adds the secondary, phase 3 adds the gallery-shaped element (M3) and shortens the special cadence. Never "spend it all at the start". | SPD boss redesign (RS F7) |
| M2 | **Six tunable knobs, all integer data:** HP multiplier `m_HP` ∈ [0.8, 1.3]; special cadence (every 4th, 3rd or 2nd action); telegraph lead (1 or 2 turns, never 0); adds per phase (0–3); arena hazard intensity κ (0–3); recall cap (0–2). | SPD's knobs became *Badder Bosses* (RS F7) |
| M3 | **Shaped by the galleries.** Each department alarm raised: +1 add in phase 2 (cap 2). Each *companion* exhibit destroyed: −8% Masterpiece HP (cap −24%). Each companion left Awake or Hunting joins phase 3 (cap 2). The examine readout lists these effects. | Yog's demon spawners (RS F7) |
| M4 | **Cannot be kited.** The hall seals and the clock pauses (CS §5.4). Regeneration stops in a sealed hall. The arena has no pillar loop shorter than 16 tiles of circumference. Every Masterpiece has one *reach* special (a line, ring or room-wide pattern) that covers its arena's loop. After 5 consecutive turns out of its melee reach, it uses a telegraphed gap-closer. | RS pitfall 7; ML pitfall 3 |
| M5 | **Telegraphs never lie.** Exact damage on marked tiles (CS §2.4). One special per resolution turn. At most 35% of the median max HP per special at that depth. | Into the Breach (RS F13) |
| M6 | **Companions are legible.** Companion exhibits share the Masterpiece's palette trim and carry "Companion piece to …" on their labels. | Frame pillar 2 |

**Who owns what.** Masterpiece movesets belong to the enemies section. These rules are the contract they must meet to pass the gate.

### 6.2 The three outcomes, and bypassing

| Outcome | How | Reward | Cost |
|---|---|---|---|
| **Defeat** | Fight in the sealed hall | Certificate + Signature piece (CS §6.5) | HP, consumables, time outside the paused clock |
| **View** | Read the gateway label at the lectern while the Masterpiece is Dormant or Stirring (CS §5.4). A Copyist may sketch it instead | Certificate | Stealth effort; impossible after Lights Down |
| **Skip** | Leave through the exit lobby | Nothing | You lose the Certificate's +5 HP and perk |

**Layout guarantee:** the exit lobby is reachable without entering the Masterpiece hall (ML §3.4: "exits beyond the centrepiece or opposite the entrance, so fighting the highlight is a choice").

### 6.3 Calibrating a Masterpiece

**Targets**, per depth:
- **Death share.** For the fighting personas (Vandal, Looter) at median skill, the hall accounts for **30–50% of the department's deaths**.
- **Fight quality.** The median Vandal entering at ≥ 70% HP finishes with 30–60% HP.
- **Viewing.** The median Sneak that attempts a view before Lights Down succeeds in ≥ 60% of seeds.

**Fit order:** bisection on `m_HP`, then on cadence if `m_HP` saturates. This is separate from the gallery budget, so b(d) and the Masterpiece knobs do not fight each other.

### 6.4 Fight, treasure or set piece

| Form | What it is | Default for | The Certificate | The Signature piece |
|---|---|---|---|---|
| **Fight** ⚔ | A creature or animated piece; phases M1–M5 | Swarm, Artillery, Darkness, Hazard, Attrition | Defeat or view | Defeat |
| **Treasure** ◇ (heist) | The Masterpiece is an object in a Security case, watched by guards and Sentinels. A two-phase escalation starts when the case is touched: room alarm, then department alarm, then the hall seals | Guarded, Locks | View | Take it and reach the exit lobby before Custody |
| **Set piece** ◎ | The room is the danger on a cycle: a Tides flood clock, a Machines demonstration. Operate the mechanism or survive N cycles | Stretch: Hazard, Attrition | Watch the cycle from the gallery balcony | Complete it |

**Decision R7: Masterpiece forms at launch.**

| Option | Tradeoff |
|---|---|
| (a) Fight everywhere | Simplest; 8 boss fights plus the Registrar in 80 minutes risks boss fatigue; stealth departments end in a forced choice of fight or view. |
| (b) **Fight, plus Treasure for Guarded and Locks** | About 2–3 heists per run break up the bosses and reward stealth; Treasure reuses the case, alarm and Custody systems already in CS. |
| (c) All three forms | Most variety; set pieces need bespoke timing per department. |

*Lean: (b), with (c) as a stretch.* If Julian picks (a), the RS D9 default holds, and the Sneak persona's view-success gate (§6.3) carries the stealth path alone.

---

## 7. Heat: the Trustees' Directives

### 7.1 Structure

- **Unlock.** Directives unlock **after the first escape** (frame), at a desk in the Entrance Hall.
- **Model.** Pick your own, as in Hades' Pact (RS F15, D11).
- **Ranks.** Each directive has 1–2 ranks with heat points per rank.
- **Additive by preference.** Following Debenham's note that additive challenges were "a welcome change of pace" (RS F8), six of the ten *add* complications rather than remove tools.

| # | Directive | Kind | Rank 1 | Rank 2 | Heat (r1 / r2) | Unlock |
|---|---|---|---|---|---|---|
| 1 | **Extended Hours** | subtractive (time) | Clock B × 0.85 | B × 0.70 | 1 / 3 | first escape |
| 2 | **Budget Cuts** | subtractive (economy) | One kit fewer in departments 2, 4, 6, 8 (12 per run) | One kit fewer in every department (8 per run) | 2 / 4 | first escape |
| 3 | **Popular Exhibition** | additive (crowds) | 4 ghost visitors per department: neutral moving obstacles that trip PROXIMITY triggers and make noise (ML §3.6) | 8, plus school parties that bump you | 1 / 2 | first escape |
| 4 | **Strict Provenance** | additive (items) | Forgery rate × 2 | Your Loan starts Uncatalogued | 1 / 2 | first escape |
| 5 | **Rotating Collection** | additive (enemies) | +1 champion per department | +1 champion per section | 2 / 4 | first escape |
| 6 | **Star Loan** | additive (Masterpieces) | Cadence −1, +1 add per phase | And a fourth phase | 2 / 4 | first escape |
| 7 | **Power Cut** | additive (environment) | Ambient light −1 band everywhere | And lantern radius −1 | 2 / 3 | a clear at heat ≥ 4 |
| 8 | **Touring Exhibition** | additive (out-of-depth) | A loan in every department at +2 depth, allowed on the main route | Two loans at +3 | 1 / 3 | a clear at heat ≥ 4 |
| 9 | **Gallery Merger** | additive (rules) | Every department also runs the previous department's rule module | (single rank) | 3 | a clear at heat ≥ 8 |
| 10 | **Hanging Committee** | information | Doors offer 2 placards, and reward icons are hidden | Only the primary icon is shown | 1 / 2 | a clear at heat ≥ 8 |

Maximum heat is 30. The values are first drafts; §7.3 fits them.

*Gallery Merger* is the purest expression of "the type of challenge varies". It is also the most expensive to test, because every ordered pair of rule modules must be validated.

### 7.2 Rewards

| Reward | Rule |
|---|---|
| **First-clear bounty** | Paid once per (class, heat bracket), in the meta section's currency. Brackets: 1–3, 4–7, 8–11, 12–15, 16+. Hades pays per weapon per heat level (RS F15) |
| **Restricted Wings** | Departments flagged Restricted enter the pool only on runs at heat ≥ 3, 6 or 10, and only at rows ≥ 4. They are complexity-5 departments with two rule modules and unique Signature pieces, so the reward is new content and accession candidates (Dead Cells: Boss Stem Cells "unlock new doors and routes", RS F16) |
| **Atlas marks** | A clear records its heat beside the departments visited (catalogue completion, RS §3.9) |
| **No power** | Heat never pays in stats, kits or perks (RS F20) |

### 7.3 Fitting heat values

**Target:** each heat point multiplies the median persona's death odds per department by about **1.10**. On the sawtooth p\*, that gives (`pstar.py`):

| Heat | 0 | 4 | 8 | 12 | 16 | 20 |
|---|---|---|---|---|---|---|
| Median clear | 45% | 32% | 20% | 10% | 4% | 1.4% |
| Expert clear | 74% | 64% | 53% | 40% | 27% | 16% |

**The audit** (weekly):
- **Method.** Each directive at each rank runs alone over 200 whole runs × 6 median personas. Its heat value is `round(Σ_t Δlogit_t / (9 × ln 1.10))`: the average per-department change in logit death odds, in units of ln 1.10.
- **Interactions.** A sample of pairs is audited too. A pair that interacts super-additively by more than 1 point gets a combination surcharge (say, *Power Cut* with *Popular Exhibition*).

**Why fit rather than declare.** Heat values in a Pact-style system are usually declared. Fitting them makes the number on the desk an honest measure, which matters for a researcher's game.

### 7.4 Decision R9: heat

| Option | Tradeoff |
|---|---|
| (a) **Pick-your-own Directives (Pact)** | Self-tuned difficulty and variety; needs the audit. |
| (b) Numbered levels (StS Ascension) | One ladder and easy to communicate; no player choice; "moveset changes are more interesting than stat bumps" (RS F14) still applies. |
| (c) No heat at launch | Saves the audit and Restricted Wings; less late-game longevity. |

*Lean: (a), shipping directives 1–8 at launch and 9–10 later.* If Julian picks (b), the ladder is directives 1, 3, 5, 2, 7, 6, 8, 4 at rank 1, then rank 2s, in that order.

---

## 8. The balancing harness

### 8.1 Personas

**Implementation.** Utility-weighted goal selectors over a shared tactical layer (A\*, threat projection, item use), in the spirit of Liapis et al. (2015) and PL D4(a).
- **Normalisation.** Utilities are normalised per affordance count. Holmgård et al. (2019) found that an un-normalised Completionist underperformed (PL F13).
- **Death penalty.** Every persona carries a −5 death penalty, as in that paper.
- **Required verbs.** The Cautious, Sneak and Tourist personas *must* be able to use tiptoe, the lantern toggle, Pose and Solvent. Otherwise stealth departments are under-rated (CS §14).

| Persona | Utility | Door policy (whole runs) | Masterpiece policy | Verbs it must use |
|---|---|---|---|---|
| **Tourist** (Runner) | Reach the exit; −turns | Smallest "Allow N minutes"; avoids Special Exhibitions | View if on the way, else skip | Tiptoe past, Floor Plan, Re-admission |
| **Vandal** (Fighter) | Exhibits destroyed / exhibits; Masterpiece defeated | Swarm, Artillery, Special Exhibitions | Defeat | Surprise attacks, chokepoints, Fixative and Lamp Oil throws |
| **Looter** (Treasure collector) | Cases opened / cases; Highlights; Loan Desk | Reward icons first | Defeat if it has a Signature piece and HP ≥ 60%, else view | Glass Cutter, Solvent, bashing glass |
| **Completist / Reader** | Galleries visited / galleries; labels read / labels | Unseen families; Locks, Social | View (reads the gateway label) | Lantern, reading, NPC talk, puzzles |
| **Cautious** (Survivalist) | −HP lost; Highlights | No Special Exhibitions; types where it holds perks | View if safe; defeat only at ≥ 80% HP | Retreat, benches, Consolidant timing, "Quiet, Please" |
| **Sneak** | −pips raised / exhibits; never seen by a guard; Highlights | Guarded, Darkness | View or sketch | Tiptoe, lantern toggle, Pose, Fumigant, curtains |

**Held-out personas.** These are never used in fitting, only in gates, which guards against the generator Goodharting the battery (PL pitfall 2):
- **Pacifist:** never attacks. It must reach an exit alive in ≥ 70% of median-skill department plays. This checks that "fight, sneak and leave are all legitimate" (frame pillar 3).
- **Masher:** bump-attacks the nearest exhibit and uses no items (absorb-this's set, TA §3.10). It must have the worst clear rate in every department. If the Masher beats the median personas anywhere, tactics do not matter there.

### 8.2 Skill tiers

After Khalifa et al.'s dexterity and strategy errors (PL F17), translated to turns:

| Parameter | Novice | Median | Expert |
|---|---|---|---|
| Decision noise ε (uniform pick among the top-3 actions) | 0.25 | 0.10 | 0.02 |
| Threat lookahead (turns of projected enemy action) | 0 | 1 | 2 |
| Steps out of a telegraphed tile | 60% | 90% | 100% |
| Uses a consumable when its trigger condition holds | 30% | 70% | 95% |
| Knowledge | Reads nothing | Reads labels on sight; learns wake triggers | Knows the full vocabulary (12 kinds' mechanics, all archetype triggers); not the seals |
| Retreat threshold (HP fraction) | 15% | 35% | 50% |
| Restoration allocation | Random slot | Weapon first | Build-aware |

**MCTS reference.** On 50 seeds per department and depth, as a small-sample upper bound (PL F13). Holmgård et al.'s MCTS took 3–280 s per small map, so it is unsuitable for bulk runs.

### 8.3 Limited agents

For each signature mechanic, a variant of the median persona that cannot use it: no lantern, no tiptoe, no sketch, no throwing, no reading, or no NPC talk. Two uses:
1. **Intro validity** (§3.6, PL F18): the mechanic is *required*, not just possible.
2. **Mechanic contribution:** the survival gap between the full and the limited persona. A department whose signature mechanic changes survival by less than 3 points has a decorative signature (BK pitfall 2).

### 8.4 What is simulated

| Mode | When | What | Kit |
|---|---|---|---|
| **Per department** | Every content change, and the S3 gate of the content pipeline | One department at its calibrated depths, many layout seeds | **Sampled**, not fixed. During development: the CS §8.7 median build ± variance (HP ±5; ±1 Restoration level; 0–2 curios; perks drawn from families in proportion to the pool's primary types; consumables from the deck). Once nightly runs exist: drawn from the **arrival library**, the actual states of whole-run personas arriving at depth t |
| **Whole runs** | Nightly | Full runs through the sequencer, with persona door policies | Emerges from the economy (PL §6(ii)) |
| **The Exit** | Nightly | The Exit at depth 9 | Arrival states *and* run histories (recalls) from the nightly library |
| **Directive audit** | Weekly | §7.3 | Whole runs |

**Why both.** A per-department hazard measured with sampled kits overstates the whole-run hazard, because the survivors who reach depth t carry better kits than the average. The arrival library corrects that bias over time. The dashboard shows both hazards side by side.

### 8.5 Metrics

**Per department × depth × persona × skill:**

| Metric | Definition |
|---|---|
| Death rate | Fraction of plays ending in death |
| HP at exit | Fraction of max HP on leaving |
| Turns; stage at exit | Turn count; clock stage (CS §5.2) |
| Highlights | Kits, Clearance and Certificate collected |
| Certificate path | Shares of defeat / view / skip |
| Damage-source mix | By role, special, environment and unseen attacker. Feeds §5.1 |
| Who woke what | The trigger behind each wake (CS §14) |
| **Skill differentiation** | `logit D(novice) − logit D(expert)`, per persona and pooled. After Togelius et al. (2012), who scored the gap between a "smart" and a "reckless" agent (PL F8); also Nielsen et al.'s skill gap (BK, ref. [802]) |
| **Persona dominance vector** | z-scored expected HP at exit, or utility for Locks and Social (§5.1) |
| **Choice richness** | (a) Route divergence: mean pairwise Jaccard distance between median personas' room sequences. (b) Action disagreement: share of sampled decision states where ≥ 3 personas pick different action classes. PL F12 warns that maximising one persona's utility gives levels where "the player does not take a decision at any point" |
| **Cross-seed variance** | SD of the death rate across 10 blocks of 20 layout seeds (Togelius et al. 2012 averaged 20 answers per genotype for the same reason, PL F8) |
| Mechanic contribution | §8.3 |
| Validator fallback rate | Share of seeds that needed repair or a certified fallback layout (PL §6(i)) |

**Run level (nightly):**
- clear rate by persona × skill;
- death location by depth (compare §3.9: 26 / 34 / 25 / 14);
- monotonicity of hazard within each floor;
- **variance decomposition**: the share of run-outcome variance explained by department identity after calibration (target < 10%), by door order, and by skill (BK §3.5, item 5);
- the dead-seed share: seeds the expert cannot clear in 20 tries (target ≤ 1%);
- door-choice statistics: a department nobody picks has a placard problem;
- kits, coins and consumables unused at death. SPD's admitted failure mode is dying with "loads of consumables" (RS F9).

### 8.6 Gates for shipping a department

All gates apply at every calibrated depth, median skill unless stated.

| Gate | Condition |
|---|---|
| G1 Calibrated | `|b*| ≤ 0.6`; logit residual ≤ 0.35 at every calibrated depth (§3.8) |
| G2 Consistent | Cross-seed SD of the death rate ≤ max(3 points, 0.4 × p\*(t)) |
| G3 Skill matters | Pooled novice-to-expert logit gap ≥ 1.2 |
| G4 No lockout, several styles | No persona's death rate > 3 × p\*(t); at least 2 personas within 1.5× of the best |
| G5 Honest placard | Fingerprint gate (§5.3) |
| G6 Choices exist | Route divergence ≥ 0.3 for ≥ 3 persona pairs; action disagreement ≥ 25% |
| G7 Intro | Cautious novice survives the Intro ≥ 99%; limited agent fails ≥ 80%; full persona passes ≥ 95% |
| G8 Generator | Online validator pass ≥ 95% of seeds (PL §6(iii)); fallback ≤ 2% |
| G9 Masterpiece | §6.3 targets |
| G10 Clock | Median Completist reaches every Highlight before Lights Down in 60–80% of seeds (CS §5.1 targets 70%) |
| G11 Economy | Median Tourist collects ≥ 1 kit in ≥ 80% of seeds; static check that no essential is in a secret room |
| G12 Held-out personas | Pacifist reaches an exit ≥ 70%; Masher is the worst persona |

**Pool-level gates** (run nightly over the pool):
- each primary type ≥ 3 departments, for the 7 launch primaries;
- the per-floor sequencer builds at the strictest rule in ≥ 80% of runs;
- the oatmeal ratio (BK §3.5: between-department over within-department dispersion of play descriptors) ≥ 2;
- class parity: each class's median-persona clear rate within ±5 points of the Night Guard's (CS §10).

### 8.7 Compute

**The basis.** TA F4 measured rot.js primitives in Node 22 on a 4-core container (FOV 13–59 µs, A\* 0.35 ms, Dijkstra 0.56 ms) and *estimated* "on the order of 1 ms per turn" for a department with about ten active monsters.
- **Dormant exhibits.** Ours mostly run no FOV until they stir, so 0.3 ms per turn is a plausible lower case.
- **Assumptions.** I assume 600 turns per department play, 5,200 per whole run, and 3× cost for expert lookahead. **The first measurement to take at milestone M4 is ms per turn.**

Computed by `compute.py`:

| Job | Plays | 1.0 ms/turn | 0.3 ms/turn |
|---|---|---|---|
| Calibration sweep, one department: 6 personas × 5 b-values × 3 depths × 120 seeds | 10,800 | 1.8 CPU-h | 0.5 CPU-h |
| Verification, one department: 6 personas × 3 skills × 3 depths × 200 seeds | 10,800 | 3.0 CPU-h | 0.9 CPU-h |
| Intro limited-agent check | 1,200 Intros | < 0.1 CPU-h | < 0.1 CPU-h |
| **One department, total** | | **4.8 CPU-h** | **1.4 CPU-h** |
| Full pool of 30 (after a rules change) | | 145 CPU-h: 36 h on 4 cores, 4.5 h on 32 | 43 CPU-h: 11 h on 4 cores, 1.4 h on 32 |
| Nightly: 6 personas × 3 skills × 300 whole runs | 5,400 runs | 13 CPU-h: 3.2 h on 4 cores | 3.9 CPU-h: 1.0 h on 4 cores |
| Weekly directive audit: 10 directives × 2 ranks × 6 personas × 200 runs | 24,000 runs | 35 CPU-h | 10 CPU-h |

**Precision.** At n = 200 per persona and depth, the standard error of an 8% death rate is about 1.9 points. That is enough for the 0.35-logit tolerance.

**Implications:**
- **Incremental calibration.** A changed department recalibrates alone, in 1.4–4.8 CPU-h.
- **Global rule changes** (combat maths, clock) trigger a full-pool recalibration. That needs a larger cloud machine, or must be batched weekly.
- **Common random numbers.** The same layout seeds across b-values, as in PL §6(ii)'s sweep design, cut the sweep's variance enough to drop to 80 seeds if compute binds.

### 8.8 The CI dashboard

A single generated HTML page, `tools/report.js`, in the house style, with a source hash and seeds in every report (absorb-this practice; PL pitfall 12):

| Tier | Contents | Runtime target |
|---|---|---|
| **Per commit** | Determinism hashes, validator pass rate on 200 layouts per department, and a **canary**: 3 reference departments × 6 median personas × 50 seeds at one depth | < 3 minutes |
| **Nightly** | Whole runs, arrival library refresh, Exit calibration, pool gates | ~1–3 h on 4 cores |
| **Weekly** | Full recalibration if rules changed; directive audit; MCTS reference | Cloud machine |

**Panels:**
1. p\*(t) against measured hazard by depth, with 95% bands (per-department and whole-run).
2. A department × depth heatmap of logit residuals, with b\* in the margin.
3. A persona dominance radar per department.
4. The **fingerprint confusion matrix**: declared against measured primary.
5. Skill-gap bars per department.
6. Clear rate by persona × skill as a trend over commits.
7. Economy: kits, Clearance, coins and unused consumables by depth and persona.
8. Death causes: top killers by role, archetype and special.
9. Certificate path shares per department.
10. Sequencer: relaxation-level usage, distinct types per run, never-picked departments.
11. The directive audit table.

---

## 9. Accessibility of difficulty: Patron Membership

**The precedent.** Hades' God Mode starts at 20% damage resistance and adds 2% per death to an 80% cap. Kasavin called such settings something that "may need to be proprietary to the game" (RS F15). The user's "minor stat bump" idea is recast here as an opt-in assist, as RS §3.9 proposes.

**Patron Membership:**
- **Where.** Offered at the Information Desk from the first run. The Desk offers it again, once, after the third death.
- **What it does.** Damage taken −20%, plus 2% per death while it is on, to a cap of **60%**. The cap is lower than Hades' because turn-based fights give the player more control per hit, and above about 60% the clock, not combat, becomes the only threat (an untested judgement).
- **Optional sub-toggles**, independent of the main assist:
  - *Extended Visiting Hours*: clock B × 1.5.
  - *Docent's Notes*: every exhibit's wake triggers are shown without reading.
  - *Spare Ticket*: once per run, death instead returns you to the current department's entrance at 50% HP.
- **Switching.** It toggles freely at the Information Desk and any Stair Hall. Turning it on mid-run marks the run.

**Labelling.** Honest and museal, never hidden and never shaming:
- A small "Patron" ribbon shows on the HUD.
- The escape or death label's credit line reads "*Visit supported by the Patrons' Circle*".
- Atlas entries show a ribbon beside clears made with it.
- Trustees' Directives and their bounties are unavailable while Patron is on. Accession, the Catalogue and the Collection are unaffected, so assisted players still build their museum.

**Not assists.** Accessibility settings that are not difficulty are labelled as plain settings and never carry the Patron ribbon: auto-opening labels (CS C8c), colour-blind telegraph patterns, slower animations, larger text.

**Harness check.** A "Patron novice" persona (novice skill, Patron on, damage reduction rising per simulated death) should clear at least one run in its first 8.

**Decision R10: the assist.**

| Option | Tradeoff |
|---|---|
| (a) **Growing damage reduction (Hades-like) + sub-toggles** | Proven shape; adapts to the player's need without hidden adaptation. |
| (b) Fixed damage reduction tiers (Friend 20% / Member 40%) | Simpler and predictable; the player must pick a level. |
| (c) Spare Ticket only | Minimal; does not help players stuck on the clock or on stealth. |

*Lean: (a).* If Julian picks (b), the Patron-novice gate uses the 40% tier.

---

## 10. Challenges to the frame

1. **Moderate thematic distance should be a soft weight, not a constraint.**
   - **The tension.** The brief asks for departments "organized in no discernible manner". EDRL's moderate-distance rule (BK F9) would, if enforced, produce a perceptible curatorial order: every neighbour sharing exactly one facet.
   - **What I did.** I kept it as soft weight S2, enforced only the *mechanical* distances hard (type, family, programme), and let themes juxtapose freely.
   - **What would change my mind.** If playtests find the sequence chaotic in a bad way, raise S2's weight; do not make it a constraint.
2. **The hidden graph should be per floor, not per run.**
   - **The evidence.** The prototype's whole-run search with the per-path variety rule failed on nearly every seed (§2.2).
   - **What is kept and what changes.** Per-floor generation keeps every guarantee and the Directory preview. What it gives up is a whole-run map, which the frame never asked to show.
3. **Social should not be a launch primary** (§5.2). No launch family produces it, and its fingerprint is the weakest.
4. **"The Masterpiece always tests the primary type"** (RS §3.4) should be "the Masterpiece's *form* follows the primary type" (§6.4). A heist is a better test of Guarded than a boss fight.
5. **"Department sets texture" does not cover the Exit.**
   - **The gap.** The frame treats the Exit as one final encounter. With random order, a fixed final boss would test a fixed challenge type, against the brief's variety sentence.
   - **My fix.** The Registrar's recalls make the finale reflect the run (§1.6).
6. **The 70–90 minute target depends on an unmeasured 80 turns per minute.**
   - **Why it matters.** Every timing in §1.3 inherits CS's estimate.
   - **The fallback.** If measured play is slower, change the size weights (more Cabinets) before cutting departments. Eight departments is what carries the premise.

---

## 11. Risks

1. **Calibration does not stay put.** Every rule change invalidates b(d) and base(t). Mitigations: per-commit canaries, b bounded to ±0.6, and weekly full recalibration on a larger machine.
2. **Personas are not humans** (BK pitfall 8: "Bots aren't humans", p. 309).
   - The β = 1 skill model and the "first-time human" row in §3.9 are assumptions.
   - Calibrate against a few human sessions early (BK §3.5, Nelson 2011), then re-weight personas from telemetry rather than adapting difficulty in-run (PL F2).
3. **Goodharting the battery.** Held-out personas and the MCTS reference catch some of this; humans catch the rest.
4. **Bypass snowball.** Skipping Masterpieces loses +5 HP and a perk each time (CS Challenges 4). Watch the Tourist's HP at depth 8 in nightly runs. The lever is moving +3 HP to the Stair Hall café.
5. **The Exit is hard to calibrate,** because recalls depend on the run. If variance across histories is high, cap recall roles at skirmisher and brute.
6. **Small pools.** A 12-department slice cannot run the sequencer (§2.5). The slice needs 2-door offers and H6 off, or 16 departments.
7. **Gallery Merger explodes the test matrix** (all ordered pairs of rule modules). It is in the cut line.
8. **Placard overload on phones.** Five lines plus icons is the ceiling. The blurb truncates first.
9. **Compute.** A full-pool recalibration at 1 ms per turn takes about 36 hours on the 4-core container. Measure ms per turn at M4 and plan cloud capacity before the pool passes 20.
10. **Heat values drift as content changes.** Re-audit weekly; show the fitted value on the desk only when its confidence interval is within ±1 point.

---

## 12. Cut line (drop first, in this order)

1. Directives 9–10 (*Gallery Merger*, *Hanging Committee*).
2. Set-piece Masterpieces (keep Fight and Treasure).
3. Size classes: every department becomes a Department.
4. Out-of-depth loans outside the *Touring Exhibition* directive.
5. The Directory preview (doors only, lazy offers).
6. The Stair Hall beats (*Appointment*, *Master Key*). Keep the café, kiosk and services.
7. Treasure Masterpieces (fights everywhere, RS D9 default).
8. The MCTS reference and the weekly directive audit (declare heat values instead).
9. Heat entirely, post-launch.
10. As a last resort, **6 departments (2/2/2)**, if the pool stalls below 24.

**Never cut:**
- depth-indexed role curves and FE budgets;
- the orientation pool;
- quotas with placement rules;
- b(d) calibration with the six-persona battery and gates G1–G5;
- placards with challenge icons;
- sequencer rules H1–H3.

---

## 13. Decisions for Julian (from this section)

| # | Question | Lean |
|---|---|---|
| R1 | Departments per run | 8 on three floors (3/3/2) |
| R2 | Size classes | Cabinet / Department / Wing under per-path caps |
| R3 | How far ahead the player sees | Next doors, plus each floor's Directory (type icons only) |
| R4 | Base difficulty | Sawtooth p\*: median clear ≈ 45% |
| R5 | Who the "median persona" is | The median across the six personas, at median skill (§3.8) |
| R6 | Challenge types | The frame's 8; Social secondary-only until a social family ships |
| R7 | Masterpiece forms | Fight, plus Treasure for Guarded and Locks |
| R8 | The Exit | The Registrar, with defeat or sign-out |
| R9 | Heat | Pick-your-own Directives; 8 at launch; heat values fitted |
| R10 | Assist | Patron Membership, growing damage reduction to 60%, labelled on the credit line |
| R11 | Stair Hall café | One of three: heal, restore, catalogue |
| R12 | Adaptivity | Novelty-weighted door offers across runs (S4); never difficulty adaptation (BK D6, PL F2) |

**R5 options:**
- (a) **the median across personas**: robust to intended dominance;
- (b) a fixed reference persona (say Cautious): simpler, but biases every department toward that persona's strengths;
- (c) the mean across personas: sensitive to one persona being locked out.

*Lean: (a).*

**R12 options:**
- (a) none;
- (b) **novelty-weighted offers**;
- (c) skill-adaptive offers or difficulty (EDPCG).

*Lean: (b).* EDPCG itself warns that "there are players that dislike adaptation" (PL F2). BK F17 warns that over-adaptation funnels players into "a narrow set of game experiences" (p. 445).

---

## 14. Interfaces with other sections

- **Core systems (CS).** This section uses unchanged:
  - the role anchors and median build (§2.6, §8.7);
  - the quotas (§6.6, §8.2);
  - the clock budgets and Attrition modifier (§5.1);
  - the perk families (§8.5);
  - Certificate rules (§8.4);
  - Masterpiece viewing (§5.4).

  It gives back:
  - the Stair Hall services and run beats (§1.5);
  - coin prices (§4.5);
  - the Exit (§1.6);
  - the challenge-type list behind the perk families (§5).
- **Enemies.** Masterpiece movesets must meet M1–M6 and expose the six knobs. The enemies section also owns:
  - the champion modifier list;
  - Registrar behaviours;
  - companion-piece tagging;
  - one *reach* special per Masterpiece;
  - Swarming and loan presentation.
- **Layout.** The layout section owns:
  - size classes as gallery counts;
  - `L_tour`;
  - the budget split by gallery role (§3.4);
  - kit and Clearance placement rules (§4.1);
  - the exit lobby reachable without the Masterpiece hall;
  - the Masterpiece arena loop rule (M4);
  - Intro safe-zone placement;
  - the online validator's checks for essentials and budget (±10%).
- **Content pipeline.** Each department spec must carry:
  - primary and secondary type;
  - a complexity rating 1–5;
  - allowed sizes;
  - Masterpiece form;
  - orientation-pool exhibits with the signature trigger;
  - a theme embedding;
  - companion pieces.

  This section's gates G1–G12 *are* the S3 simulation gate. The persona dominance vector is the QD archive's challenge axis (PL §6(iii)).
- **Meta.** The meta section owns:
  - the bounty currency and brackets;
  - Restricted Wings as unlocks;
  - Patron's interaction with accession (unaffected);
  - novelty counters stored in the profile (S4);
  - whether "Escaped, with a receipt" pays extra.
