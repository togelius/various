# Critique: do the seven drafts form one design?

*Reviewer's lens: a meticulous editor checking that `core-systems.md` (CS), `vocabulary.md` (V), `difficulty.md` (D), `layout.md` (L), `meta.md` (M), `pipeline.md` (P) and `samples.md` (S) describe one game. Read against `brief.md` and `direction.md`. Review only; no draft was modified. Section numbers refer to each draft's own headings.*

## Verdict in one paragraph

The drafts agree on the frame (8 departments in 3/3/2, six launch families, six programmes, the S0–S7 pipeline, depth-indexed power, a Registrar finale, accession plus one Loan). They do **not** agree on the rules underneath it. There are two incompatible rulebooks. **CS** (adopted by **D** and partly by **M**) has a pip meter, 13 uppercase wake triggers, five lux bands, loudness that falls off by 1 per tile, form+tier+property items, seal-identified "Solutions and Ephemera", 7 combat roles and unharmable staff guards. **V** (adopted by **P**, **S** and mostly **L**) has alert timers, 15 lowercase triggers, four light classes, five radius-based noise levels, primitive-budget items, twelve different consumable kinds, 10 roles with their own encounter costs, and killable `patrol_guard` and `night_watchman` archetypes. Because pillar 1 makes V's ids the contract that every generated department compiles into, a game built from CS cannot run the departments in S, and the balancer in D cannot price them. Fix this before Julian reads the decisions: about a third of the 66 decisions Julian would be asked to make rest on mechanics that two drafts define differently.

## What works and must be kept

- V's closed-id contract. S compiles five full departments into it with **no invented mechanical id**: every gap is flagged as a gap (§8.2 of S). This is the strongest evidence in the set that pillar 1 works.
- Most drafts flag the clashes they found themselves: L §19.5 (Wing, Special Exhibition), M §15.8–9 (three gift shops, `V.14.412`), P §11.4 (catalogue cards), and S §1.10 (Tourist in hazard departments, V vs D). Keep the habit; this critique finishes the job.
- L's measurements, which are the only measured numbers in the set. They should overrule assumed numbers wherever the two disagree (finding M2).
- D's per-floor sequencer, the p\* calibration and the fingerprint gate as a *concept*, and P's dud arithmetic.

---

## Part 1. Findings, ranked

Type: **E** = an error to fix, with one right answer. **J** = a real design fork to present to Julian as options.

### BLOCKERS

**B1. Two rulebooks: CS and V define the core mechanics incompatibly.** *(E, with a few embedded J forks)*
- **Where:** CS §1.2, §3.1–3.6, §6.3–6.4, §7.4, §2.6 against V §1.2–1.5, §3, §4, §5.1–5.4. D §1.6, §3.5, §4.2 and §8.1 build on CS's versions. P §2.2, S throughout, L §9.2 and L §15.2 build on V's.
- **What is wrong** (details in Tables A–C):
  - stealth state machine: CS Dormant → Stirring → Awake → Hunting → Returning with a 3-pip meter; V dormant / alert / hunting / returning with timers;
  - wake triggers: CS's 13 vs V's 15, with different names and parameters, and only about 9 corresponding in meaning;
  - noise: CS has loudness falling 1 per tile; V has 5 levels with fixed hearing radii;
  - light: CS has 5 bands (Dark, Dim, Low, Bright, Spotlit) with sight 1/4/8/12/12; V has 4 classes (dark, dim, lit, bright) with sight 1/4/7/9;
  - items: CS uses form × tier × "one property from the closed effect-primitive registry"; V uses category plus 1–3 primitives with S/M/L, a budget and a drawback;
  - the twelve consumable kinds: only Solvent, Catalogue Card and Floor Plan exist in both lists, and Solvent does different things in each;
  - damage kinds: V has five, CS has none;
  - enemy modifiers: CS has "On the Beat, Armoured +2 Padding/−25% HP, Fragile, Swarming"; V has 18 ids, none of these four;
  - statuses: CS "Fixed (cannot move or act)" vs V `rooted` ("can still attack and use items").

  CS's instruments and curios (Tuning Fork lure, Glass Cutter, Magnifier, Lucky Coin, Ticket Stub, Cotton Gloves) have no V primitive at all, although CS §6.3 says items draw from "the closed effect-primitive registry".
- **Why it matters:** pillar 1 says generated departments are "selected and parameterised from the vocabulary". P and S emit V ids such as `tonic`, `evacuation_card`, `noise(2)` and `strike_kind(blunt, M)`. The engine CS specifies cannot execute them, D's harness simulates CS's rules, and the Exit (D §1.6) depends on CS-only kinds (Deaccession Form, a drinkable Solvent).
- **Resolution:**
  1. Declare V the single registry of *ids* and CS the owner of *numbers and UI* for those ids. Rewrite CS §3.3, §6.3 and §6.4 as parameter tables over V ids. Rewrite V §1.2–1.4 as id lists with "numbers: see CS".
  2. Four forks are real design choices; put them to Julian as one decision, "The core sensing model":
     - (a) pip meter vs alert timers (lean: CS's pip meter, because it shows progress);
     - (b) noise by falloff vs noise by radius (lean: CS's falloff, because L's guard-window checks and D's harness need distances);
     - (c) 4 or 5 light bands (lean: 5, because L §6.5 already uses CS's);
     - (d) which twelve consumable kinds (the two lists in Table A1).
  3. Everything else is editorial: rename, merge and delete duplicates. Ownership is proposed in Part 7.

**B2. The balancer cannot price the departments the pipeline emits: roles and encounter currency differ.** *(E)*
- **Where:** V §10.3 (10 roles: fodder, skirmisher, artillery, brute, controller, warden, support, swarm, ambusher, masterpiece_component, each with an encounter cost) vs CS §2.6 and D §3.3 (7 roles, with no support, swarm or ambusher).
  - Costs disagree. V gives artillery 2, controller 3, warden 3 (halved if tethered and avoidable), support 2 plus 25%, swarm 0.5 a body, ambusher 3. D gives skirmisher 2.5, artillery 4, brute 4, controller 2 and warden 7 FE.
  - Champions disagree. V §3 allows "`champion` ... at most one species per department", chosen by S2 in the spec. D §3.5 places 0/0/1/2 champions by depth *at runtime*, and Rotating Collection adds "+1 champion per section".
- **Why it matters:** S's five departments field 4 ambusher, 4 support and 3 swarm species, plus support attachments on two Masterpieces. CS has no stat curve and D no FE cost for any of them. D's role-mix table (§3.5) cannot allocate them. Calibration b(d) (D §3.8) and V's role → numbers contract (V §10, "never cut") cannot both run.
- **Resolution:** keep one role table, in V §10.3, extended with CS's depth anchors and D's FE cost for all 10 roles. Delete V's encounter-cost column, or D's FE column, whichever loses. Decide whether champions belong to the spec (S2) or to runtime depth (D); the lean is spec-only, with D's depth table capping how many may *wake*, so that S3 validates what ships.

**B3. Run 1 cannot be sequenced under the leans: meta's ordinal gating starves D's sequencer, and D's variety numbers assume content its own lean forbids.** *(J, plus E)*
- **Where:**
  - M §6.2: "Twelve ordinal-I departments are open on run 1."
  - D §2.5: "A pool of **16 is the minimum for 2-door offers**, and **24 for 3-door offers**". At pool 12 with 2-door graphs, only 57/100 runs were built and 12% at the strictest rule. Each floor graph has up to 9 nodes, and H1 says "No department twice in a run".
  - D §2.5: its headline variety result (≥6 distinct primaries in 94.5% of runs; "all 8 types offered on placards in practically every run", D §0) used a pool in which "2 departments are Social-primary". D's own lean R6 (and V D-V3) makes Social secondary-only, so only 7 primaries exist at launch.
- **Why it matters:** the brief's variety sentence and the frame's door choice fail on exactly the runs a new player sees first. M says 12 is "thin" but enough; D's prototype says it is not. Both cannot be leans.
- **Resolution:**
  - **E:** rerun D's prototype with 0 Social primaries and with the run-1 pool that M proposes, and report both numbers.
  - **J:** choose one of:
    - (a) M5(b), no Atlas gating, with D's complexity caps (H5) as the only onboarding;
    - (b) gating that never drops the open pool below 24 (for example ordinals I–II open at start);
    - (c) 2-door offers and H6 off until 16 departments are open.

  Lean (a) or (b). Merge M5 and D H5 into a single "onboarding by complexity" decision (see M13).

### MAJOR

**M1. Can guards be harmed? Staff vs exhibit is defined three ways.** *(E plus J)*
- **The three definitions:**
  - CS §3.7: guards "cannot be damaged"; Watchmen "cannot be harmed" (§5.3); capture is Custody, not death; violence against staff "breaks the tone" (C3 option d).
  - V §2.1 has `patrol_guard` as a warden *archetype* (encounter cost, HP and damage by role) and `night_watchman` as a launch (L) archetype that "pursues relentlessly; if defeated, returns after 20 turns".
  - P §2.2 compiles `patrol_guard` into M.7 as a budgeted species ("Night Regulator").
  - D §1.6 makes the Registrar, explicitly "staff, not an exhibit", a 217-HP boss you can defeat.
- **Also inconsistent:**
  - guard counts: CS §3.7 gives 1/2/3 by challenge type; V's `alarm_network` gives "2–5 guards"; V Table B caps `sculpture_court` at "≤2 guards". S §3.3 shows that CS's 3 for a Guarded primary breaks the cap;
  - facing cones: CS §3.6 says guards "have no facing cone"; V `patrol_guard` has "a 90° lamp cone", and S.9's hidden line repeats it;
  - whether guards exist everywhere: CS puts them in every department, while V makes alarms a module, "secondary", that is "never cut".
- **Resolution:** adopt S §10.4's proposal.
  - Staff (guards, Watchmen, Registrar) are NPCs under CS rules.
  - `patrol_guard` is always an exhibit; Table B's caps count both.
  - Retire the `night_watchman` archetype, or make it the id for CS's staff Watchman with no HP.
  - **J:** whether the Registrar can be "defeated" by damage at all. Options: (a) as D, accepting a staff boss; (b) defeat means emptying its desk or out-stamping it, with no HP; (c) sign-out is the only win.

**M2. The clock, minutes and size classes rest on an `L_tour` that the only measurement says is about 40% too high.** *(E, then J via L-D1)*
- CS §5.1 sets B = 480/650/800 from assumed `L_tour` 150/220/280. D §1.3–1.4 inherits it for "Allow 5/8/11 minutes", the 82-minute run and the 600-turn compute basis (D §8.7). P §3.6 assumes about 500 turns.
- L §17 measured `L_tour` p50 59–77, 84–108 and 115–177, B of 250–540, and a median Department of about 250–280 turns. That is "about 40–45 minutes, not 70–90" at CS's 80 turns per minute.
- **Names:** CS uses Small/Medium/Large, D uses Cabinet/Department/Wing, and "Wing" collides with L's hierarchy level (L §1.1). "Department" as a size class also collides with the unit itself.
- **Why it matters:** the run length the brief and frame promise, the placard's time line, the compute plan and the Stair Hall pacing all inherit a number nobody measured.
- **Resolution:**
  - **E:** mark CS §5.1's table and D §1.3–1.4 as superseded by L §17. Recompute B from measured `L_tour`. Rename the size classes (L proposes Cabinet / Department / Annexe; Cabinet / Gallery / Wing also avoids both clashes).
  - **J:** L-D1 as the one question, merged with D R2 and D Challenge 6.

**M3. Three simulation-gate specs with the same labels and different thresholds.** *(E)*
- P §3.6 says S3 is G1–G10. D §8.6 says "This section's gates G1–G12 *are* the S3 simulation gate" (D §14). V §6.1 adds V1–V4, and L §11.2 merges two of them.

  | Check | P | D | V | L |
  |---|---|---|---|---|
  | b(d) bound | ±0.5 (G3) | ±0.6 (G1) | – | – |
  | Consistency | SD ≤ 0.08 (G4) | SD ≤ max(3 pts, 0.4p\*) (G2) | – | – |
  | Skill | Δsurvival ≥ 0.15 (G5) | logit gap ≥ 1.2 (G3) | – | – |
  | Route divergence | > 0.2 (G6) | ≥ 0.3 for ≥ 3 pairs (G6) | > 0 (V4) | – |
  | Mechanic matters | V's margin | < 3 points means decorative (§8.3) | +10 pp death or −15% HP (V2) | – |
  | Intro, blind agent | – | fails ≥ 80% (G7) | fails ≥ 30% (V3) | both (§11.2) |
  | Intro, aware novice | – | survives ≥ 99% | passes ≥ 95% | both |
  | Worst-case runner | min kit; "reaches an exit" (G2) | – | – | median −1 Certificate −1 level; ≤ 80% HP (LV11) |
  | Compute per department | 34 core-min | 1.4–4.8 CPU-h | 3 tiers × 50 seeds | – |

- **Why it matters:** the S3 gate is the "never cut" quality filter in four drafts, and the 3–8× compute gap changes the curation calendar in P §3.11.
- **Resolution:** one S3 spec, owned by D, which P §3.6 cites. Keep V1–V4 as module-level sub-checks inside it. Keep one worst-case runner, L's, because it is defined precisely. Renumber so that G-labels are unique.

**M4. The eight challenge types are defined twice, and the definitions disagree on what proves them.** *(E, with S's contested cases as J)*
- **Where:** V §8.1–8.2 vs D §5.1.
- **Dominant persona:**
  - Hazard: V says "Tourist punished"; D says Tourist is dominant. S §1.10 flags this.
  - Attrition: V says "Cautious dominates"; D lists Cautious as submissive.
- **Budget rules:**
  - Swarm: V "≥40% of budget on swarm and fodder"; D "Fodder ≥ 50% FE".
  - Locks: V "≤50% of the normal combat budget"; D ×0.85.
  - Social: V "hostile budget −40%"; D ×0.80.
  - Guarded: V "≥30% on wardens and heralds"; D "wardens ≥ 25% FE" with a 30% role mix.
- **Requirements:** for Attrition, V requires "≥2 benches" while D's producer list says "fewer benches".
- **Fingerprints:** every type's measured-signature thresholds differ between the two tables (Swarm: V "≥40% of damage from swarm and fodder"; D "≥45% of damage from fodder" and "≥3 simultaneous awake").
- **Masterpiece per type:** V §8.2 makes Guarded and Locks Masterpieces fights ("wakes on alarm", "an ensemble whose original must be identified first"); D §6.4 makes them Treasures. S reconciles the two only by inventing a "Sentinel" (D-S4).
- **Why it matters:** the fingerprint gate (D §5.3, P G10) decides what the placard prints. With two tables, the placard's honesty is undefined.
- **Resolution:** one table, in V §8 because it is the registry, carrying D's measurement columns. Leave the Tourist and Cautious cases as hypotheses for S3, not assertions. Merge D-S4 into D R7.

**M5. Patron and Directives: two incompatible designs for the same two systems.** *(J, merged)*
- **Patron:**
  - D §9 / R10: damage −20%, +2% per death, cap **60%**, three sub-toggles. "Trustees' Directives and their bounties are unavailable while Patron is on."
  - M §8 / M9: four earned tiers, −15/−20/−30/−40% damage, *plus* +2 to +8 max HP, +10–25% open hours, a full-heal café, free Re-admission Tickets, "a second Loan slot". "**It blocks nothing.**"
- **Directives:**
  - Launch tier: D R9 ships "directives 1–8 at launch"; M §0 marks Directives **v1.x**.
  - Restricted Wings: D §7.2 at "heat ≥ 3, 6 or 10"; M §9 at "Directive totals 4, 8 and 12".
  - Extended Hours: CS §5.1 "B × 0.8"; D §7.1 "B × 0.85 / B × 0.70".
  - M §9 wants "No Loans" and "Uninsured Loans" Directives that D's list of ten does not contain.
  - D's Strict Provenance rank 2 ("Your Loan starts Uncatalogued") contradicts M §5.1 and CS §7.5 ("never an uninformed choice").
- **Resolution:** one decision, "Assist model", with D's and M's designs as options (a) and (b). One owner for Directives (D), with M's hooks merged into D's list. Fix the three number clashes once the owner is chosen.

**M6. The worked example "Instruments That Keep Time Badly" is a different department in every draft.** *(E)*

  | | CS | P / L | M | D |
  |---|---|---|---|---|
  | Ordinal | "Machines 1" (§6.4) | "ordinal 2 … Machines II" (P §2.2, L §3.5) | – | – |
  | Challenge | "primary Guarded, secondary Artillery" (§2.8) | `hazard_terrain` / `guarded` | – | – |
  | Masterpiece | "The Regulator's Clock, Room 430" (§8.6) | "The Committee of Clocks", Room 407 (L §8.1, §15.1) | "the Committee of Clocks in Room 430" (§4.5) | "the Regulator's Clock" (§1.5) |
  | Pocket Watch | "+5% B; HUD shows exact turns" (§6.3) | `clock_extension` M + `ticking` | "+20%" (§5.4) | – |
  | Tuning Fork | noise-8 lure instrument (§6.3) | "Damped Tuning Fork": `lull` M | – | – |
  | Room range | "Rooms 400–431" | 401–408 | 412, 415, 430 | – |

- "Works on Paper" is "Light 1, *Kept Dark*" (CS §6.4, M §6.1), "*After Hours*, ordinal 2" (V §10.6), and "Light 3, *Works on Paper, Kept Dark*" (D §3.7).
- **Why it matters:** Julian will read one department described five ways. These examples are also S1 and S4 exemplars (P §3.2).
- **Resolution:** P §2.2's card is canonical. Every other draft cites its fields, and conflicting mentions are rewritten. Do the same for "Works on Paper": pick V's or CS's title and one ordinal.

**M7. The sketch verb, the candidate core verb, has two incompatible yield rules.** *(E, inside J C6)*
- **CS §9.1:**
  - a page holds "a player version of the archetype's signature special" at 50% (everyone) or 75% (Copyist);
  - its charges "recharge when you enter a new gallery";
  - "An archetype with no special yields its movement trait".
- **V §2.6:**
  - "a one-charge instrument at magnitude S" built from primitives;
  - archetypes not on its list yield "nothing".
- **The examples clash:**
  - Escapement: CS "Double Step"; V `hasted` S.
  - Lectern Moth / `light_swarm`: CS "Moth Lure"; V `flash` S.
  - Diorama: CS "Tableau: Pose anywhere"; V `animate_ally` S.
- **Resolution:** adopt V's mechanism (primitives only, so sketching adds no verbs, as V Challenge 6 requires) with CS's charge and magnitude scheme, expressed as magnitude classes. Then present C6 (class ability vs universal) on one rule.

**M8. Consumable identification is specified twice.** *(J, D-V7 merged with CS §6.4)*
- CS §6.4: a per-run *seal* carries identity, and departments supply hinting names ("Fumigant → Jar of Sea Fret", "Floor Plan → Tide Table, Annotated"); that is D-V7's option (a) or (c).
- V D-V7(b), P §2.2 and S use "neutral appearances … no functional hint" bound by the run seed.
- CS has no consumable forgeries; its harmful kinds (Fixative, Fumigant, Lamp Oil) play the curse role. V gives every kind a forgery effect, and L §15.2 uses V's ("superseded" Floor Plan).
- **Resolution:** one decision for Julian with both schemes as options. Pillar 2's "reading a department's labels identifies kinds" is satisfied by either.

**M9. How many classes ship is ambiguous, and M's first hour depends on the answer.** *(J, merge CS C7 + M M12)*
- CS C7 leans to "2 (Night Guard, Copyist)", calls (c) "4" a scope risk ("ally AI and the upgrade economy must both be finished"), and cuts Docent first.
- M §10.5 / §13.1 unlocks the Copyist after run 1 (so run 1 is "Night Guard only"), the Conservator at 5 accessions (around run 2) and the Docent at the first escape. M §13.2 expects "3–4 classes" by hour 10.
- **Resolution:** state whether Conservator and Docent are v1 content. If not, M's unlock ladder needs two other milestones; if so, C7's lean is really (c).

**M10. Decisions that appear nowhere, and sections that nobody wrote.** *(J / E)*
- **Required by the frame but missing:**
  - XP (CS §8.1 argues it but it is not in CS §18);
  - who the player is and the museum's stance (antagonist, indifferent or benevolent-but-collecting): M §6.4 asserts "the direction memo's lean", but the memo lists it as open;
  - how strongly to engage provenance and empire;
  - the art pipeline;
  - the tech stack (M §14.4's PWA makes the hosted build "three files", against the house single-file convention);
  - the working title;
  - the scope of the vertical slice (D says "a 12-department vertical slice", S D-S2 means 3 sample departments, V and L mean prototypes of systems).
- **Orphaned owners:**
  - the "enemies section" (CS §0, §19; D §6.1, §14; S §8.2 item 7), which is supposed to own Masterpiece movesets, the champion list, Registrar behaviours, companion tagging and the "original" rule of `mp_ensemble`;
  - the "narrative section" (D §1.1);
  - the "text drafter" (P §15; S D-S1);
  - the art/audio owner (P §15);
  - the content of the Stair Hall Appointment subclasses (D §1.5: "belongs to the core/classes owner"; CS does not define them).
- **Resolution:** add these to the decision list (Part 3), and either assign V to absorb "enemies" or write that section.

**M11. Colour semantics collide.** *(E, under D-V2)*
- V §1.8 reserves nine hues for behaviour tags: pursuer red, ranged orange, warden blue, masterpiece gold, and so on.
- CS §13.4 uses red for every "hostile" pictogram (all 13 trigger glyphs), orange for hazards and telegraphs, blue for the player and gold for items.
- So a blue trim means *warden* on the sprite and *you* on the HUD, gold means Masterpiece and item, and a red glyph on a support exhibit's tombstone line reads as "pursuer".
- **Resolution:** one palette table, owned by the art section, listing the semantic hues and the tag hues together, with no reuse.

**M12. The rules for what an Intro may contain disagree, and S's Intros break them.** *(E)*
- **The rules:**
  - V §10.5: orientation pool "plus the signature module's teaching instance, plus at most one telegraphed controller".
  - D §3.6: fodder and skirmishers only; "Packs of at most 2"; wardens excluded; "Every orientation exhibit carries the department's **signature wake trigger**".
  - L §11.1: "no ambushers".
- **The teaching instances that break them:**
  - `unobserved_motion` (V Table A: "2 statues", which are ambushers);
  - `copies_weaken` ("one original bust and two plaster copies": a pack of 3);
  - `alarm_network` ("one guard", a warden if it is V's archetype);
  - L's own `hourly_demonstration` Intro uses a demonstrator (a controller) whose mechanic is not a status.
- **The samples:** S.9's Intro has an ambusher (the Grazer). M.11's and S.9's orientation exhibits lack the signature trigger. S §4.4 (A.4) cites a D §3.6 check, "reach the exit with ≥ 70% HP", that D does not contain.
- **Resolution:** one Intro rule in D §3.6 that exempts the module's teaching instance from the role and pack caps. Drop the "signature wake trigger on every orientation exhibit" rule, or make it apply only where the signature is a trigger.

**M13. Ordinal vs complexity: one concept, four scales.** *(E)*
- V §11.3: "Family ordinals ('Tides 3') encode complexity, not power."
- P §2.2: `ordinal` is "[C] complexity 1–4 from module parameters", so it is *computed*.
- M §6.2: ordinals I–IV per family, plus a Restricted "ordinal V". The pool is *designed* as "ordinals I, I, II, III, IV", which a computed field cannot guarantee.
- D §2.4 / §3.1: a separate "complexity rating 1–5" ("*Tides 2*, complexity 3"). Complexity 5 belongs both to the normal pool (its prototype has 3 such departments, and H5 caps rows 6–8 at 5) and to "Restricted Wings … complexity-5 departments".
- L §3.4 caps features by `ordinal` 1, 2, ≥3. S §8.4 caps "systems" by ordinal.
- Placards print "TIDES 2" (D §2.1), which is ambiguous when two departments share an ordinal (M's I, I).
- **Resolution:** one field, "complexity 1–4", computed by P, used by D's caps, L's caps and M's Atlas. Restricted becomes a separate flag. Placards print the accession number or title, not "family + ordinal".

**M14. D adds runtime content that no S3 run has validated.** *(E or J)*
- Out-of-depth loans import "an exhibit from another pool department … keeps its home department's skin and **wake trigger**" (D §3.7) at 25–45% of departments from depth 2. Gallery Merger runs "the previous department's rule module" on top of the department's own (D §7.1). Runtime champions (B2) do the same thing.
- V's contract validates exactly the spec's species × modules, with forbidden pairs (V §6.4: `unobserved_motion` × `gaze_wake`, and so on). D §3.7's loans also collide with V's `on_loan` modifier (V §3: "one tier stronger; destroying it raises a Claim", ship *later*).
- **Resolution:**
  - (a) Loans and merged modules may use only ids in the host's compatibility matrix, and S3 simulates each department with its loan pool. Or (b) defer loans to a directive, as D's own cut line #4 already allows.
  - Merge D's loans with V's `on_loan`.
  - Gallery Merger must respect D-V6's "≤2 modules" and the forbidden pairs.

### MINOR

- **m1. "Highlight" means three things, and one sample breaks the essentials rule because of it.**
  - The three meanings:
    - CS §6.6, the quota items ("Highlights: 2 Restoration kits, 1 Clearance card");
    - V §5.1, an item tier with a budget cap ("Highlights: 4 or fewer");
    - P §6.1 and M §11, a featured label.
  - D §5.1's Locks fingerprint asks for "≥ 40% of Highlights and items behind puzzle gates", while D §4.6 says essentials are "never behind a lock you cannot yet open".
  - S §5.3 puts "the department's second Restoration kit" in K.6's puzzle-gated Unclaimed Room. That is an **error**: move the kit out.
  - Rename: "quota items" or "essentials" for CS's sense, and keep "Highlight" for featured items.
- **m2. The attribution ladder's bottom rung.**
  - CS C9 proposes "Uncatalogued", and D's Strict Provenance already uses it.
  - V §5.1 keeps "After" as the category rung, V §5.4 and P §6.2 use "After [department]" or "After M.7" for unidentified consumables, and CS, P §6.4 and M §4.7 use "After [maker]" for copies and forgeries.
  - Once C9 is decided, make one global substitution.
  - V's rung 0 reveals "category"; CS's reveals "Form, tier, Clearance requirement, nominal +0 stats". Align them.
- **m3. Masterpiece fight numbers.**
  - Length: V §10.3 "the fight lasts 15–30 turns"; D §1.3 "30–60".
  - Special damage: V "20–35% of HP"; CS §2.6 text "25–30%", CS table "25–35%"; D M5 "≤35%".
  - Phases: D M1 has "two phases at depths 1–2", V §2.4 always three.
- **m4. S's Masterpiece halls break the arena rule.**
  - T.5's Breakwater hall has "6 columns" (S §1.3), and phase 3 "topples columns". M.11's lectern is "behind a column".
  - L §6.3 allows "Only wall-attached blockers in the hall"; D M4 forbids pillar loops under 16 tiles.
  - Fix: pilasters and rubble, plus `swims` and rubble added to V (S's own gaps 1 and 8).
- **m5. Stair Hall regeneration.**
  - D §1.5: "no regeneration … Nothing in it can be farmed". L §16.1's template has a bench `b`, and CS benches regenerate ×2.
  - M §7.5's "cosmetic" Memorial Bench is placed "in a department's gallery on later runs (benches are already furniture with a regeneration role)". So it is a balance change, which contradicts "cosmetic" and the ±2 pp rule.
  - Fix: benches in Stair Halls and memorial benches have no mechanical effect.
- **m6. Members' Preview is redundant.**
  - M §7.3 item 4 sells "Choose department 1 from three placards" for 10 Stamps.
  - D §1.1's base Entrance Hall already offers it: "choose 1 of 3 doors".
- **m7. Names with opposite or double meanings.**
  - "Extended Hours" (a Directive that *shortens* B, D §7.1) and "Extended Visiting Hours" (an assist that lengthens it, D §9).
  - "Master Key" (a CS §8.5 perk and a D §1.5 run beat).
  - "Reading Room" (M §3.2's Catalogue room and D §1.5's café option).
  - "Recent Acquisitions" (M §3.2's latest death figure and L §16.2's run-slip cases at the Exit).
  - "Tuning Fork" (M6).
- **m8. Numbering formats.**
  - Rooms: CS §1.2 "d00–d99" with Room 412 and 430; L §8.1 "`D·100 + n`" from 01 with 5–13 rooms; P §6.3 reads "412" as "gallery 12", which L never produces.
  - Death figures: CS §12 "V.14.412" vs M §10.1 "FV.14.517". M flags this; adopt FV.
  - S's accession numbers (M.11, S.9) imply 9–11 accepted departments in a family register against "4–5 per family" (P §1.7). Either renumber the samples or say that registers include candidates.
- **m9. Label-scheme collisions** (see Part 5). "D M3", "M3" and "R7" each mean two or three things across drafts.
- **m10. Reading time.** CS §1.3 makes reading free. V's `photosensitive` counterplay says "read labels quickly", and its Table B speaks of "aware reads fewer labels". Change V's wording to "read labels from lit tiles".
- **m11. Out-of-step scope tiers.**
  - V §7.3 marks crowds "later", while D ships Popular Exhibition (crowds) among directives 1–8 at launch.
  - M's Late Opening (a 12-department mode, "3/3/3/3") has no support in D's depth model (calibration to depth 8 plus the Exit at 9).
- **m12. Unpriced or unowned rewards.**
  - "Escaped, with a receipt" (D §1.6 leaves it to M, which does not decide).
  - Temporary Exhibition reward (P §7.1 leaves it to the run-structure drafter, which does not price it).
  - The Exit's order of revolving doors and Gift Shop (D §1.6 lists "Main Hall · Gift Shop · revolving doors"; L §16.2 puts the shop beyond the doors and says "D owns the order").
- **m13. Exits per department.** D §1.1 says departments 3, 6 and 8 "lead to their Stair Hall" (one door). L §7.7 always places "2–3 exit doors with placards".
- **m14. Evaluation descriptors that L found degenerate.**
  - P §9.1 and P §2.2's descriptors use "chokepoints" ("choke: 0.22") and openness. L §13.1 measured choke "p95 ≤ 0.015" everywhere and openness as compressed.
  - D §14 calls "the persona dominance vector … the QD archive's challenge axis", while P D-P3 leans to the measured fingerprint and lists dominance as option (c).
- **m15. The Signature piece and the Loan Desk.** CS §6.5 says Signature pieces come "from the Masterpiece on defeat, or from a Loan Desk" and are "always eligible for accession". M §4.2 makes Loan Desk items ineligible ("The lender would object"). Drop "or from a Loan Desk".
- **m16. Text lengths.**
  - Didactics: CS §13.3 and §6.4 give 40–70 words; P §3.7 gives 50–90 (gateway 120).
  - Intro panels: S's run 163–170 words against P's cap of ≤120. S raises this as D-S1.
  - Text per department: M §12.5 says 8,250 words is "roughly the free text of two departments", implying about 4,000 each; S §0.3 measured about 1,700.
- **m17. Seam rooms.** D §1.1 gives Stair Hall 3 only "café choice · kiosk · EXIT PREVIEW", while L §16.1's template has all services. The frame lists a cloakroom in the Stair Hall; M §3.2 moves it to the Entrance Hall.
- **m18. Who owns `heist_plinths`.** V Table A gives its family as "Specimens (Classification)". If the parenthesis means "also Classification", K.6's secondary breaks V §6.4's "secondary module never comes from the signature's family". Define what parentheses mean in Table A.
- **m19. Alarms and clock stages.**
  - A department alarm advances the clock "+50" in CS §3.8 and "S" (30) under V `alarm_network` (S.9 uses 30).
  - V §1.2: "From closing stage 2, every dormant exhibit's wake radius grows by 1". CS §5.2 has no such effect; its stage 1 stops pip decay instead.
- **m20. The perk-family basis changed without a flag.** The frame says "perks in signature-family groups". CS §8.4–8.5 groups perks by challenge type and does not list this as a Challenge to the frame. The change is probably right, but it should be stated.

---

## Part 2. Disagreement tables

Each row quotes both sides with file and section. **Rec.** gives the resolution: **fix** (editorial, one right answer) or **J** (decision for Julian).

### Table A. Names

| # | Topic | Side 1 | Side 2 (and others) | Rec. |
|---|---|---|---|---|
| A1 | The 12 consumable kinds | CS §6.4: Consolidant, Fixative, Fumigant, Solvent, Lamp Oil, Developer; Catalogue Card, Floor Plan, "Quiet, Please", Re-admission Ticket, Deaccession Form, Evacuation Notice. D §1.6, §4.2 and §4.5 use these | V §5.4: `tonic`, `catalogue_card`, `floor_plan`, `audio_guide_cassette`, `solvent`, `evacuation_card`, `late_pass`, `flash_bulb`, `spirit_lamp`, `dust_sheet`, `wet_floor_sign`, `closed_sign`. P, S and L §15.2 use these | **J** (B1d): pick one list; it should keep CS's two Exit-critical kinds or D must rewrite tag removal |
| A2 | The "get out" consumable | V §5.4 `evacuation_card` = `exit_jump` ("nearest exit door or … entrance"); P §7.1 "Evacuation card (`exit_jump`)" | CS §6.4 "Evacuation Notice" = exhibits flee, guards leave, noise 10; CS "Re-admission Ticket" = to the entrance, unseals the hall. M §7.3 writes "CS Re-admission Ticket / V evacuation_card" | fix with A1 |
| A3 | Solvent | CS §6.4: drink "Removes all negative statuses"; throw "Dissolves case glass in 3×3 silently" | V §5.4: "uncurse; cure stained. Thrown: removes warded and slick". D §1.6: "a Solvent drink removes 2" tags | fix with A1 |
| A4 | Wake triggers | CS §3.3: `PROXIMITY, NOISE, LIGHT, DARK, SEES_YOU, OBSERVED, UNOBSERVED, CASE_TOUCHED, ITEM_TAKEN, ALARM, CLOCK, SYMPATHY, TAG_NEARBY` ("13 … closed enum"). D §5.1 uses LIGHT/DARK | V §1.2: `prox, noise, light, seen, unseen, touch_case, take, alarm, clock, ally_hit, period, path, ticking, tether, awake` (15). S, P and L §9.2 use V's | fix: V's ids, plus CS's DARK and SYMPATHY if wanted; CS's pictogram set re-keyed |
| A5 | Alert states | CS §3.1: Dormant, Stirring (1–2 pips), Awake, Hunting, Returning | V §1.2: `dormant`, `alert` (10 turns), `hunting`, `returning` | **J** (B1a) |
| A6 | Light bands | CS §3.5: Dark, Dim, **Low**, Bright, **Spotlit** (0–4). L §6.5 uses CS's | V §1.4: dark, dim, **lit**, bright (0–3), "150 lux" = lit. S §3.4 uses V's ("dim or brighter") | **J** (B1c) |
| A7 | Enemy modifiers | CS §2.6: "On the Beat, Armoured +2 Padding/−25% HP, Fragile, Swarming"; D §3.5 "the *Swarming* modifier: 0.7 FE each" | V §3: 18 ids (`porcelain` … `champion`), none of these four; V's `escapement` is an archetype, not "On the Beat" | fix: map them to V ids or add them via V §11.4 |
| A8 | "Sentinel" | CS §3.8 "an awake Sentinel-archetype exhibit"; D §5.1 "Sentinel exhibits"; D §6.4 "watched by guards and Sentinels" | No V id. S D-S4 proposes "a 'Sentinel' role for cores" | fix: define it in V or remove it |
| A9 | Roles | CS §2.6 and D §3.3: Fodder, Skirmisher, Artillery, Brute, Controller, Warden, Masterpiece | V §10.3: those plus support, swarm, ambusher (`masterpiece_component`) | fix (B2) |
| A10 | Statuses | CS §6.4 "Fixed (cannot move or act)"; "Marked"; coughing | V §4 `rooted` ("cannot move; can still attack and use items"); no Marked or coughing | fix |
| A11 | Clearance item | CS §6.6 / §8.3 "Clearance card" | V §5.5 "**keycard**: Handling Clearance" | fix: "Clearance card" |
| A12 | The prize object | CS §6.5, D, M "Signature piece" | V §5.1 "keepable artifact"; P §2.2 `keepable`. S Challenge 6: "Signature piece everywhere" | fix: adopt S's proposal |
| A13 | Size classes | CS §5.1 Small / Medium / Large | D §1.4 Cabinet / Department / Wing; L §1.1 "Naming clash" with the hierarchy level "wing" | fix (M2) |
| A14 | Clock stage names | CS §5.2 "First Bell, Lights Down, Night Watch" | V §1.2 "1 bell, 2 dimming, 3 night watch" | fix: CS's names |
| A15 | The canonical Machines Masterpiece | CS §8.6 / D §1.5 "The Regulator's Clock" | P §2.2, L §3.5 and M §4.5 "The Committee of Clocks" | fix (M6) |
| A16 | "Works on Paper" | CS §6.4 "Light 1, *Kept Dark*"; D §3.7 "Light 3, *Kept Dark*"; M §6.1 "(Light 1)" | V §10.6 "*After Hours* … ordinal 2" | fix (M6) |
| A17 | Tuning Fork | CS §6.3: lure, "Noise of 8 at a target tile" | P §2.2 "Damped Tuning Fork": `lull` M | fix: rename one |
| A18 | Pocket Watch | CS §6.3: "HUD shows exact turns to the next stage; +5% B" | P §2.2 / M §5.4: `clock_extension` M (+20%) + `ticking` | fix |
| A19 | The other visitor | CS §11 "Fellow visitor" | V §2.1 `rival_visitor` (L+). S maps one to the other | fix: state the mapping in V |
| A20 | Death number | CS §12 `V.14.412` | M §10.1 `FV.14.517` (P §6.3 gives V to Absence) | fix: FV |
| A21 | Extended Hours | D §7.1 Directive "Extended Hours" (B × 0.85) | D §9 "Extended Visiting Hours" (B × 1.5) | fix: rename the Directive (e.g. "Early Closing") |
| A22 | Master Key | CS §8.5 perk "Master Key" | D §1.5 Stair Hall 2 beat "**Master Key**" | fix: rename the beat |
| A23 | Reading Room | M §3.2 the Entrance Hall's Catalogue room | D §1.5 café option "*Reading Room*" | fix |
| A24 | Recent Acquisitions | M §3.2 "(latest death figure)" | L §16.2 "Recent Acquisitions cases … this run's accession slips" | fix |
| A25 | Gift Shop | M §7 (Stamps, Entrance Hall) | in-run kiosks (CS §11) and the Exit shop (D §1.6). M §15.8 proposes a naming rule | fix: adopt M's rule |
| A26 | Special / Temporary / ticketed / Today's / Restricted | D §3.10 "Special Exhibition" (elite door); P §7 "Temporary Exhibitions" (v2 runtime); L §5.5 "ticketed room" (renamed from the frame's "ticketed special exhibition"); M §10.6 "Today's Exhibition" (daily); D §7.2 "Restricted Wings" | – | fix: put the five terms in a glossary |
| A27 | Index cards | Frame: "Commissions built from collected catalogue cards" | P §8.1 / M §11 "index cards" (agreed) | fix: update the frame wording |
| A28 | Highlight | CS §6.6 the quota items | V §5.1 the ≤4-point item tier; S "(Highlight)"; P §6.1 "highlights get full labels" | fix (m1) |
| A29 | Challenge-type labels | V ids `hazard_terrain`, `locks_puzzle` | D "Hazard", "Locks" | fix: ids in data, short names in UI (say so once) |
| A30 | Perk-family basis | Frame: "perks in signature-family groups" | CS §8.5: 8 challenge-type families | fix: state the change (m20) |

### Table B. Numbers

| # | Quantity | Side 1 | Side 2 (and others) | Rec. |
|---|---|---|---|---|
| B1 | Departments per run | CS, D, V, L, P: 8 (3/3/2) | M §7.3 "Late Opening": 12 (3/3/3/3), with no depth model in D | **J**: drop Late Opening from v1, or D extends its depth model |
| B2 | Choice points | D §1.1: 8 (Entrance Hall + 7) | P §1.5: "2–3 doors at each of 7 transitions" | fix |
| B3 | Run minutes | D §1.3: ~82 (75–88); CS §5.1: "fits 8 departments in a 70–90 minute run" | L §17.2: "about 40–45 minutes" at 80 turns per minute | **J** (L-D1); fix the CS and D tables |
| B4 | `L_tour` / B | CS §5.1: `L_tour` 150/220/280 → B 480/650/800 | L §17: measured `L_tour` p50 59–77 / 84–108 / 115–177; B 250–540 | fix (M2) |
| B5 | Turns per department (compute basis) | D §8.7: "600 turns per department play" | P §3.6: ~500 turns (0.5 s at 1 ms per turn); L §17.2: median 250–280 | fix |
| B6 | Footprint | Frame / D §1.4: Department "~40×30" | L §17.1: Department 35×31 to 44×23 at p50; cap 48×36 plus a vestibule of 40–60 tiles | fix to the measured values |
| B7 | Losing track | CS §3.1: Hunting "loses you for 8 turns" → search 3 → Returning; Awake → Returning after 20 | V §1.2: alert "for 10 turns"; hunting "loses you after 20 turns"; V `patrol_guard` "returns … after 20 turns" | **J** under B1a; then fix |
| B8 | Noise | CS §3.4: melee L5 (a normal sleeper hears it within 3); glass breaking L10 (within 8) | V §1.3: melee level 2 "loud", heard within 6; glass level 3 "crash", heard within 10. S A.4 and S.9: "noise 3" | **J** (B1b) |
| B9 | Sight | CS §3.6: you see 1/4/8/12/12; you are seen 1/3/6/9/12 | V §1.4: you see 1/4/7/9; you are noticed 1/3/6/9 | **J** (B1c) |
| B10 | Lantern | CS §3.5: on/off; radius 3 at least Low | V §1.4: off / low (+1 lux r2) / high (+2 lux r4) | **J** (B1c) |
| B11 | Effects of clock stage 2 | CS §5.2: ambient −1, regeneration ×2 interval, Masterpiece Stirring | V §1.2: "every dormant exhibit's wake radius grows by 1" | fix: one list, in CS |
| B12 | Clock cost of an alarm | CS §3.8: department alarm "Clock +50 turns" | V §6.2 `alarm_network`: "each alarm advances the clock by S" (30); S.9: 30 | fix |
| B13 | Guards per department | CS §3.7: "Default 1 … secondary 2 … primary 3" | V §6.2: "2–5 guards"; V Table B: `sculpture_court` "≤2 guards" | fix (M1) |
| B14 | Encounter cost by role | V §10.3: fodder 1, skirmisher 2, artillery 2, brute 4, controller 3, warden 3, support 2 + 25%, swarm 0.5, ambusher 3 | D §3.3: 1, 2.5, 4, 4, 2, 7 FE; champion ×1.75 (V: +2 cost class = +1.0) | fix (B2) |
| B15 | Champions | V §3 and §10.1: ≤1 per department, chosen by S2 | D §3.5: 0/0/1/2 by depth; Rotating Collection "+1 champion per section" | fix (B2) |
| B16 | Masterpiece fight length | V §10.3: 15–30 turns | D §1.3: 30–60 turns | fix (m3) |
| B17 | Special damage | CS §2.6: "Specials take 25–30%" (text), "25–35%" (table) | V §10.3: 20–35%; D M5: ≤35% | fix |
| B18 | Intro thresholds | V §6.1 V3: aware passes ≥95%; blind fails ≥30% | D §3.6 / G7: limited fails ≥80%; Cautious novice survives ≥99%; L §11.2 applies all four | fix (M3) |
| B19 | "Mechanic matters" | V V2: +10 pp death rate or −15% max HP | D §8.3: < 3 points means "decorative" | fix (M3) |
| B20 | Calibration bound | P G3: b in [−0.5, +0.5] | D G1: \|b\*\| ≤ 0.6 | fix |
| B21 | Skill gate | P G5: expert − novice survival ≥ 0.15 | D G3: logit gap ≥ 1.2 | fix |
| B22 | Route divergence | P G6: > 0.2 | D G6: ≥ 0.3 for ≥ 3 pairs; V V4: > 0 | fix |
| B23 | S3 compute per department | P §3.6: "34 core-minutes" | D §8.7: "1.4–4.8 CPU-h" | fix, then redo P §3.11's calendar |
| B24 | Worst-case runner | P G2: "tier's minimum kit … reaches an exit" | L §9.2 LV11: median build − 1 Certificate − 1 level; route ≤ 80% HP | fix: L's |
| B25 | Patron numbers | D §9: −20% + 2%/death, cap 60% | M §8.1: −15/−20/−30/−40%, + HP, + B, second Loan | **J** (M5) |
| B26 | Restricted Wing thresholds | D §7.2: heat ≥ 3, 6, 10 | M §9: totals 4, 8, 12 | fix after M5 |
| B27 | Extended Hours | CS §5.1: B × 0.8 | D §7.1: B × 0.85 / × 0.70 | fix |
| B28 | Text caps | P §3.7: intro ≤ 120, section ≤ 60, didactic 50–90; CS §13.3: body 40–70 | S §1.2 etc.: intro 163–170, section ~100 (S D-S1) | **J** (D-S1), then one cap table |
| B29 | Pool size | V §11.2, M §6.2: 30 (but 12 open on run 1); P D-P2: 24–30 | D §2.5: minimum 16 (2-door) / 24 (3-door) | **J** (B3) |
| B30 | Complexity scale | P §2.2: 1–4 (computed); M §6.2: I–IV + V | D §2.4: 1–5; L §3.4: 1 / 2 / ≥3 | fix (M13) |
| B31 | Room numbers | CS §1.2: "d00–d99"; §8.6 "Rooms 400-431" | L §8.1: `D·100 + n` from 01 (401–408); P §6.3: "412 … gallery 12" | fix: L's |
| B32 | Text per department | M §12.5: ~4,000 implied | S §0.3: 1,677 measured | fix: S's |
| B33 | Swarm budget | V §8.1: "≥40% of budget on swarm and fodder" | D §5.1: "Fodder ≥ 50% FE" | fix (M4) |
| B34 | Locks and Social budgets | V §8.1: Locks "≤50% of the normal combat budget"; Social "hostile budget −40%" | D §3.4: ×0.85; ×0.80 | fix (M4) |

### Table C. Mechanics

| # | Mechanic | Side 1 | Side 2 (and others) | Rec. |
|---|---|---|---|---|
| C1 | **What capture does** | CS §3.7 C3: Custody 3 pips → "escorted back to the department entrance, with confiscation … Clock +20"; Watchman: to the exit doors, no Certificate | V: `patrol_guard` "raises the alarm … then pursues" (no capture); `night_watchman` "pursues relentlessly". L §14.4: guard rescue, +20, "no confiscation". D §6.4: Treasure "before Custody" | fix: CS's rules apply to staff only (M1) |
| C2 | **Can guards be harmed?** | CS §3.7: "They cannot be damaged"; §5.3 Watchmen "cannot be harmed" | V §2.1: `patrol_guard` and `night_watchman` are warden archetypes ("if defeated, returns after 20 turns"); P §2.2 `M.7.s6` patrol_guard; D §1.6: Registrar "staff", HP 217, "Defeat the Registrar" | **J** for the Registrar; fix the rest (M1) |
| C3 | Guard sight | CS §3.6: "no facing cone. Cones are a later option" | V §2.1: "a 90° lamp cone"; S.9 hidden line | fix |
| C4 | Are guards universal? | CS §3.7: in every department | V §6.1: `alarm_network` is a generic secondary module ("Never cut") | fix: staff guards universal, the module adds exhibit patrols and alarm zones |
| C5 | **What the Loan risks** | M §5.3 M4: "goes into conservation for one run" | Frame: "One Loan slot per run, normalised to +0" (no risk); D §7.1: "Your Loan starts Uncatalogued"; S §5.8: Loans refused as heist substitutes | **J** (M4), then remove D's contradiction |
| C6 | Loan Desk | CS §6.6: "borrow 1 of 3 catalogued items, swaps allowed" | V §2.5: "taking one cages the others"; M §4.4: one offer from your kinds; nobody says whether the item leaves with you | fix: one rule, plus a decision on whether items return at the exit |
| C7 | **Does reading cost a turn?** | CS §1.3 C8: free ("Read a label (full text) 0 ticks") | V §6.2: `photosensitive` counterplay "read labels quickly"; M §6.1: "Reading costs no time" | fix V's wording (m10) |
| C8 | Reading light | CS §1.2: "lux ≥ 1, or your lantern is on" | V §6.2 `photosensitive`: "labels unreadable below lit" | fix: say that this is a module override |
| C9 | **Attribution ladder: rungs and order** | V §5.1: After (category) → Manner of (forgery) → Circle of (primitive families) → Workshop of (exact primitives) → Attributed to (restoration level) → By (everything) | CS §7.1: same order and content, but rung 0 "*I propose* **Uncatalogued**" (C9), revealing form, tier and Clearance; D §7.1 uses "Uncatalogued" | **J** (C9), then a global edit (m2) |
| C10 | How the ladder advances | CS §7.2: use, gated by "the first time" in a new gallery; Inspect 300 ticks | V §5.2: `attribution(m)` "use-identification 25%/50% faster" (faster on what clock?) | fix V's wording |
| C11 | Forgeries | CS §7.4: "a hold … one defect … Restoration −1 to −3"; consumable forgeries: none (harmful kinds instead) | V §5.1: "binds … one of its primitives is also inverted"; V §5.4: a forgery effect per consumable kind; L §15.2 uses V's | **J** (M8) for consumables; fix for equipment |
| C12 | Consumable identification | CS §6.4: per-run seals; hinting department names | V D-V7(b): neutral skins bound by the run seed; P §2.2 and S follow V | **J** (M8) |
| C13 | **What the Certificate gives** | CS §8.4: "+5 max HP, and heal 5; choose one perk from three" (2 primary family, 1 secondary) | D §6.2 agrees; M §4.2 adds the accession gate and +1 Stamp; frame "+max HP and one perk from three" | consistent; state the perk-family change (m20) |
| C14 | **How the Masterpiece is bypassed** | CS §5.4: View (read the gateway label while Dormant or Stirring) → Certificate without the Signature piece; Copyist sketch; skip → nothing | D §6.2 / §6.4: the same, plus Treasure (view → Certificate, take → Signature piece) and set piece (watch the cycle); V §8.2 Social: "may be bypassed by negotiation (a Certificate by bypass)"; S: Sentinel cores | fix: add V's negotiation path to D §6.2 or drop it |
| C15 | Masterpiece by challenge type | V §8.2: Guarded "wakes on alarm"; Locks "an ensemble whose original must be identified first"; Swarm `mp_ensemble`; Artillery `mp_tableau` | D §6.4: Guarded and Locks are "Treasure"; the rest are Fight | **J**: merge D R7, V D-V5 and S D-S4 |
| C16 | Sketch | CS §9.1: special at 50/75%; recharge per gallery; movement trait as fallback | V §2.6: one charge, magnitude S, primitives only; "nothing" for unlisted archetypes | fix to one rule (M7) |
| C17 | Damage kinds | V §1.5: blunt, edge, fire, water, light; resistances ×0.5 to ×2 | CS §2: none (Padding only); S §8.2 gap 5: "Enemy attacks have no damage kind" | **J** (D-V4), then CS adds kinds |
| C18 | Armour | CS §2.2: flat Padding (C2) | V §5.2: `armour(m)` "damage reduction class" (unmapped) | fix: S/M/L → Padding |
| C19 | Light weapons | CS §2.5: Light form attack costs 100 ticks, Acc +2 | V §5.2: `strike_kind` S "½-turn attack, −1 damage class" | fix |
| C20 | Healing | CS §6.4 Consolidant: "50% … plus 25% over 5 turns" | V §5.4 `tonic`: "heal M; cure cut, faded, slowed" | fix with A1 |
| C21 | Modules per department | V D-V6: "One signature plus at most one secondary"; forbidden pairs | D §7.1 Gallery Merger: "also runs the previous department's rule module"; D §7.2 Restricted: "two rule modules" | fix (M14) |
| C22 | Out-of-depth loans | D §3.7: exhibits from other departments, 25–45% from depth 2 | V §3 `on_loan`: "one tier stronger … raises a Claim" (later) | fix (M14) |
| C23 | Intro contents | V §10.5: plus "the signature module's teaching instance" | D §3.6: packs ≤ 2, no wardens, signature trigger on every exhibit; L §11.1: "no ambushers" | fix (M12) |
| C24 | Arena furniture | D M4 / L §6.3: wall-attached blockers only | S T.5 "6 columns"; S M.11 "behind a column" | fix (m4) |
| C25 | Stair Hall regeneration | D §1.5: "no regeneration" | L §16.1: a bench in the template; CS §4: benches regenerate ×2; M §8.1 Member: "café heals to full" | fix (m5) |
| C26 | Memorial benches | M §7.5: "Benches are cosmetic" | M §7.5 / CS §4: a bench placed "in a department's gallery" regenerates | fix (m5) |
| C27 | Exit tags | D §1.6: removed by "Deaccession Form … Solvent drink" (CS kinds) | V has neither effect | fix with A1 |
| C28 | Retirement | CS §12: "I'd like to leave" to a neutral guard; keeps the pick with the Certificate | M §4.2 agrees | consistent |

### Table D. Structure

| # | Topic | Side 1 | Side 2 (and others) | Rec. |
|---|---|---|---|---|
| D1 | Seam rooms | D §1.1: three Stair Halls, after floors 1, 2 and 3; Stair Hall 3 lists only café, kiosk and Exit preview | L §16.1: one template with all services; M §10.2: Lost Property in Stair Hall 1; frame: Stair Hall has a "cloakroom"; M §3.2: Cloakroom in the Entrance Hall | fix: one service table per Stair Hall |
| D2 | The Exit | D §1.6: depth 9, Registrar, recalls, revolving doors, "Gift Shop, a one-way coda" | L §16.2: supports either order ("D owns the order"); M §12.3: Registrar lines; CS §8.7: "Exit encounter assumes max HP 60" | fix the order; **J** on the Registrar's defeat (M1) |
| D3 | Programmes at launch | V §6.4, P §4.1, S: six ids | L §19.2: "three macro shapes" (L-D3) | **J** (L-D3) |
| D4 | Classes at launch | CS C7: 2 | M §10.5 / §13.1: four, unlocked within v1 | **J** (M9) |
| D5 | Exits per department | D §1.1: departments 3, 6, 8 have one door to the Stair Hall | L §7.7: "2–3 exit doors with placards" always | fix |
| D6 | Directives at launch | D R9: 1–8 at launch | M §0: v1.x | **J** (M5) |
| D7 | Gift Shop at launch | Frame: "later" | M M7: 10 items in v1 (flagged in M §15.1) | **J** (M7) |
| D8 | Social as a primary | V D-V3 / D R6: secondary-only | D §2.5 prototype pool: "2 departments are Social-primary" | fix: rerun (B3) |
| D9 | Vertical slice | D §2.5: "A 12-department vertical slice" | S D-S2: 3 sample departments; V Risk 4 / L L-D3: system prototypes | **J**: one slice definition |
| D10 | Atlas grid | M §6.2: 6 × 4 = 24 cells | M §14.5: "Atlas (12 families × 5 ordinals)" | fix: say that the card reserves space |
| D11 | Sequencer interface | D §14 needs complexity, sizes, Masterpiece form, orientation exhibits, a theme embedding, companions | P §3.10: "measured primary and secondary, ordinal, family, programme, placard data, … `never_first`" | fix: add D's fields to P §2.2 |

---

## Part 3. The same decision under different labels (merge these)

The drafts pose **66 decisions**: CS 9, D 12, V 8, P 9, M 16, L 7, S 5. After merging, about 45 remain. For a first meeting with Julian I suggest the 12 starred items.

| Merged decision | Appears as | Status |
|---|---|---|
| ★ The core sensing model (alert model, noise, light bands) | Implicit in CS §3 and V §1.2–1.4; no label | Conflict (B1) |
| ★ The twelve consumable kinds and their identification | CS §6.4 (no label), V D-V7 | Conflict (B1, M8) |
| ★ Social at launch | V D-V3, D R6 | Agree (secondary-only); merge |
| ★ Masterpiece construction and forms, including Treasure guards | V D-V5, D R7, S D-S4, D Challenge 4 | Partly in conflict (C15) |
| ★ Assist model (Patron) | D R10, M M9 | Conflict (M5) |
| ★ Heat: model, launch tier, rewards | D R9, M §9 (no label), M §0 tier column | Conflict (M5) |
| ★ Onboarding by complexity and ordinal gating | M M5, D H5 / §3.1, V §11.3 / Challenge 1, L §3.4, S §8.4 | Conflict (B3, M13) |
| ★ Department scale vs clock vs run length | L L-D1, D R1 / R2, D Challenge 6, CS §5.1 / Challenge 5 | Conflict (M2) |
| ★ Sketch: universal or Copyist, and what it yields | CS C6, V §2.6 / Challenge 6 | Conflict (M7) |
| ★ Classes at launch and how they unlock | CS C7, M M12 | Conflict (M9) |
| ★ Guard capture, and whether staff can be harmed | CS C3, L §14.4, D R8 (Registrar defeat) | Conflict (M1) |
| ★ Infinity and pool size | P D-P1 / D-P2, D R1 cut line ("6 departments if pool < 24"), M M5 | Agree on the lean; pool numbers conflict (B3) |
| Bottom rung of the ladder | CS C9; V §5.1 (no label) | Pending C9 |
| Text length and label anatomy | S D-S1 / D-S5, P §3.7 caps, CS §13.3 | Conflict (m16) |
| Signature-piece rider | S D-S3, CS §6.5 point 1 ("one trigger tied to the department's rule module") | CS asserts what V forbids; decide via D-S3 |
| Rule modules per department | V D-V6, D §7.1 Gallery Merger, D §7.2 Restricted Wings | Conflict (C21) |
| QD archive axes | P D-P3, L L-D6 (knob archive), D §14 ("persona dominance vector is the QD archive's challenge axis") | Conflict (m14) |
| Orientation plan and map knowledge | L L-D7, CS §13.5, Floor Plan kind | Agree; merge |
| Reading cost | CS C8, V's photosensitive wording | Agree once V is reworded |
| Commissions | P D-P5, M §11 (no label) | Agree; merge |
| Accession cost and eligibility | M M1 / M2, CS §12 / §19 ("rung 5" hook) | Agree; M's lean drops CS's rung-5 hook. Say so |
| Damage kinds | V D-V4; S §8.2 gap 5 (enemy kinds); CS (silent) | Open |
| Daily and seeded runs | M M15 / M16, D §2.2 (seed reproducibility) | Agree |
| Vertical slice | S D-S2, D §2.5 / Risk 6, V Risk 4, L L-D3 | Conflict (D9) |

## Part 4. Decisions missing entirely

Each is either asked for by the brief or frame, or needed to make the drafts cohere.

1. **XP.** The frame's open questions list it; CS §8.1 argues "No XP" but it is absent from CS §18. Add it as C10.
2. **Who the player is, and the museum's stance** (antagonist, indifferent, benevolent-but-collecting). The frame lists it as open; M §6.4 treats it as settled.
3. **Provenance and empire**: light mechanic, central, or absent. Only scattered rules exist (V Peoples later, CS Courier later).
4. **The art pipeline.** P §3.8 is S5's spec only; the drafts reference an "art and audio" owner who does not exist.
5. **The tech stack**, including M §14.4's PWA, which breaks the single-file house convention.
6. **The working title.** The frame says it is Julian's decision; no draft lists it.
7. **What the vertical slice is** (D9).
8. **Whether the Registrar can be damaged** (M1).
9. **Whether Loan Desk items leave the department with you**, and whether the Treasure can be protected from confiscation by equipping it (CS C3's "Equipping an item protects it" makes a heist trivially safe).
10. **Who places champions** (spec or runtime) and **whether enemy attacks have damage kinds** (B2, C17).
11. **Prices and payouts with no owner:** "Escaped, with a receipt" (D §1.6), the Temporary Exhibition reward (P §7.1), and the Exit's order of shop and doors (D2).
12. **Late Opening's depth model** (B1 in Table B).
13. **The content of the Appointment subclasses** (D §1.5), and the run-level late arc that CS §8.4 hands to D.
14. **The Night Watch at deep water** (S §1.11, owner CS), and **whether Security cases are fireproof** (S §5.11, owner CS).
15. **One accessibility settings list.** Pieces sit in CS C8(c), D §9 "Not assists" and M §8.1; there is no single list.

## Part 5. Terms used without definition, or overloaded

| Term | Problem | Where | Proposed definition or fix |
|---|---|---|---|
| **tier** | Five meanings: item tier T1–T5 (CS §2.5); run position "tier t" (V §10.3); "Each floor is a *tier*" (D §3.1); skill tier (D §8.2); Patron tier (M §8). P §3.6 "3 tiers" means 3 calibrated depths | all | Use "tier" for items only; "depth t" for run position; "skill level"; "membership level" |
| **accuracy class, damage class, speed class, damage reduction class** | Used throughout V (§2.1 "+1 accuracy class", §4 "−1 damage class", §5.2 "damage reduction class") with no mapping to CS's integers | V | V adds a table: 1 class = ±1 Acc / ±1 Padding / ×1.25 damage / one speed step |
| **Highlight** | Three meanings (m1) | CS, V, P, D, S | "Quota items" (kits, Clearance card) vs "Highlight" (a featured item, ≤ 4 points) |
| **Sentinel** | Used as if it were an archetype or role (CS §3.8, D §5.1, §6.4, S) | CS, D, S | Define it in V or delete it |
| **Swarming, On the Beat, Armoured, Fragile** (as enemy modifiers) | Not V ids | CS §2.6, D §3.5 | Map them to V ids |
| **companion piece** | A balance hook (D M3: "−8% Masterpiece HP") with no data field in P §2.2 | D, S | Add `companions[]` to the spec |
| **ordinal / complexity** | Four scales (M13) | V, P, M, D, L, S | One field |
| **keepable / keepable artifact / Signature piece** | One object, three names | V, P, CS | "Signature piece" |
| **Loan** | Six things: the meta Loan slot (M §5); the Loan Desk (CS §6.6); out-of-depth loan exhibits (D §3.7); `on_loan` (V §3); Peoples "lendable objects" (V `living_community`); "loan request" Commissions (P §8.3) | all | Keep "Loan" for the meta slot; use "Loan Desk", "touring exhibit", "Lent by …", "request" |
| **Claim** | Used as a mechanic (V `keeper` "Hostile only after a Claim"; `on_loan` "raises a Claim"; CS §13.4 "Claim (provenance)" pictogram) and never defined | V, CS | Define it in V §4 or §6 |
| **Wing / Department** | Size classes that collide with the hierarchy level and the unit | D, L | Rename (M2) |
| **B** | The open-hours budget (CS §5.1); "B(t)" the encounter budget (V §10.4); "Between" dispersion (P §9.2) | CS, V, P | V should write E(t), as D does |
| **choke** | V §1.9 assumes tile chokepoints; L measured them as near zero and redefined the term | V, L, P | Adopt L §19.1: "a 1-wide opening or aisle" |
| **observed** | CS §3.3 OBSERVED: "in *your* field of view and lit"; V §1.4: field of view + sight radius + "dim or brighter, or inside your lantern radius" | CS, V | V's three-part definition |
| **Custody, pips, FE, p\*, L_tour** | Defined once each (CS, D) and used elsewhere without a pointer | – | Add them to a shared glossary |
| **essential(s)** | D §4.6 defines "Essentials"; V and P use "Essential line" for label content | D, V, P | Rename D's to "quota items" |
| **Docent** | Both an NPC (CS §11) and a class (CS §10) | CS, S | Fine, but the label should say which |
| **heat / Directive total** | D says "heat"; M says "Directive total" | D, M | Use one |

**Label-scheme collisions** (for the merged document):

| Prefix | Meanings |
|---|---|
| G | P's S3 checks G1–G10; D's shipping gates G1–G12 |
| R | D's decisions R1–R12; P's reject codes R1–R11; P's research questions R1–R7; L's grid rules R1–R8 |
| H | D's hard constraints H1–H9; L's hypotheses H1–H7 |
| M | M's decisions M1–M16; D's Masterpiece rules M1–M6. "D M3" and "M3" mean different things |
| S | D's soft weights S1–S5; P's stages S0–S7 |
| T | P's text validators T1–T6; item tiers T1–T5 |
| C | CS's decisions C1–C9; P's compile validators C1–C7 |
| V | V's module checks V1–V4; the abbreviation "V"; the death number "V.14…" |
| D- | V's D-V*, P's D-P* and S's D-S* decisions, while "D" also abbreviates difficulty.md |

Fix: one prefix per draft and per kind of thing (for example DEC-CS-1, GATE-1, VAL-T1).

## Part 6. Does samples.md use vocabulary.md ids that exist?

**Method.** A script extracted every backticked `snake_case` token from S and compared it with every id in V. Then the species, item, module and Masterpiece tables were checked by hand against V §2.1–2.4, §3, §5.2, §6.2–6.4 and §10.1.

**Result: every mechanical id S uses exists in V.** This covers:
- archetypes, with role, tag and silhouette matching V §2.2 for all 29 species rows;
- modifiers (at most 2 per species, at most one material);
- the 8 modules;
- all specials (Masterpieces have 2–3, as V §2.4 requires);
- all primitives;
- all statuses;
- wake triggers, all within "one extra wake trigger" of each archetype's default;
- fixtures, personas, categories and challenge ids.

Module × programme pairs are all ++, + or "−" with the cap respected. Secondary modules come from other families, with the caveat in m18.

**Tokens S uses that are not in V** (all honestly flagged by S, so not errors):
- `swims` (a `tide_cycle` parameter), rubble, `schedule_sense`, a "Sentinel" role, flag-primitive prices ("I price a flag as 2 points"): all filed in S §8.2.
- `house_rule` and `voice_rule`: proposed P frame fields (S §8.4).
- Palette ramps (`wet_granite`, `tinplate`, `plaster_cast`, `cloakroom_oak` and others) and `essential_ref` belong to P's registries. P §3.8 promises "about 30 authored material ramps" but lists none, so these ids are unverifiable. Ask P to publish the ramp list.

**Problems found:**
1. S uses V's consumable ids (`tonic`, `evacuation_card`, `flash_bulb`, `dust_sheet`, `spirit_lamp`). They do not exist in CS's list of twelve, so S's consumable weights cannot be applied to the engine CS specifies (B1).
2. S uses the L+ ids `mp_colossus`, `diorama_spawner`, `breaker`, `attribution`, `recase` and `rival_visitor`, each with a stated fallback. Fine, but D-S2's slice lean (S.9, A.4, M.11) still pulls in A.4's three L+ ids.
3. Masterpieces with `mp_ensemble` (A.4, K.6) depend on an "original rule" that V does not define (S §8.2 item 7). V §2.1 says only "Kill order: the original first."
4. K.6's secondary `heist_plinths` may break the "not from the signature's family" rule, depending on how V Table A's parentheses are read (m18).
5. Mimic tells: S.9.5 and K.6.3 print accession numbers (`S.9.5`, `K.6.3`) on tombstones whose tell is "no catalogue number". S says the didactic shows only after reveal. Make the tombstone omit the number until then, or P §6.3's tell breaks.
6. The Tide Bell (T.5.5) is "Cast iron" to avoid a false `bronze` cue. The workaround is correct, but it shows V needs S's proposed neutral-materials list (S §8.3 item 2).

## Part 7. Suggested single owners (to make the merge mechanical)

| Topic | Owner | Others cite |
|---|---|---|
| Ids of archetypes, roles, modifiers, statuses, primitives, consumable kinds, triggers, fixtures, challenge types | V | CS, D, L, P, S |
| Numbers for those ids (stat curves, noise and light numbers, clock), UI and pictograms | CS | V, D, L |
| Encounter currency, p\*, the S3 gate spec, the sequencer, heat, assists | D | P, M, L, V |
| `L_tour`, sizes, room numbering, Intro templates, arena rules | L | CS, D |
| The department data model, canonical worked example, numbering, pack interface to the sequencer | P | all |
| Accession, Loan slot, Atlas, Stamps, persistence | M | CS, D |
| Enemies and Masterpiece movesets, Registrar behaviour | **unassigned**: give it to V or write it | – |
| Narrative, voice and text caps; art and audio palette | **unassigned** | – |
