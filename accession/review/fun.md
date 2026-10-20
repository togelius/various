# Critique: is the moment-to-moment game fun, legible and deep?

*Reviewer lens: a designer who has shipped turn-based roguelikes (SPD, Brogue, DCSS, Into the Breach school). Read in full: `brief.md`, `direction.md`, `design/core-systems.md` (CS), `design/difficulty.md` (D), `design/meta.md` (M), `design/vocabulary.md` (V), `design/samples.md` (S); read in part: `design/layout.md` (L: overview, §11, §14, §17–§21), `design/pipeline.md` (P: §0–§1), `research/roguelike-systems.md` (RS §2). Review only; nothing else was changed.*

**Verdict in one paragraph.** There is a good game in here: a case-heist loop over dormant exhibits. You approach a case, decide whether to kill, skirt or lull what sleeps beside it, open or smash the glass, then handle what wakes. That loop has telegraphs that never lie, Brogue's odds readout and a clock that ends the evening. It is buried under a pile of universal systems. A first-run player meets about 32 of them in the first eight minutes, roughly three times what SPD shows in its whole first region. The drafts' "never cut" lists protect exactly the universal layer that causes the overload. Six drafts also disagree on what the core rules *are*. Several presented choices are not real choices: View beats Fight, Wings beat Cabinets, retiring beats dying, and the general perk beats the narrow one. The fixes mostly point one way, so pillar 1 can survive. Make the universal layer thin and let departments own the systems. That improves legibility, makes departments feel distinct, and gives an onboarding path through random order.

---

## What works and must be kept

- **Dormancy as the default state** (pillar 3). The player chooses the order of engagement, and every fight can open with an ambush. This is SPD's sleeping monster turned into the whole premise. Keep it, simplified.
- **Telegraphs that never lie, dice for basic attacks, and the Brogue odds sentence on examine** (CS §2.4, §2.7).
- **Vitrines block movement but not sight** (V §7.1). It is a real tactical cell no dungeon has. A.4's "break the glass to reach the original or fight the spares in the aisle" (S §4.3) is the best decision in the drafts.
- **Depth sets power**, with role curves in lockstep, one b(d) per department, the orientation pool and complexity caps by row (D §3). This is the strongest answer to random order I have seen.
- **Quotas shown in the Highlights box**, decks and meters, and the Consolidant floor (CS §8.6, D §4).
- **The Night Watch as an embodied Zot clock that is non-lethal itself** (CS §5.3, Challenges 2).
- **Accession lent back at no cost**, the measured Loan budget and "Not for loan" (M §4–§5). Also the death screen as a label.
- **S.9 as a model department.** House rule, module, voice, Masterpiece and keepable all say "watching versus being watched". Keep S §8.4's `house_rule` field and its system-count cap by ordinal.

---

## Findings, ranked

Each finding is tagged **Error** (fix it) or **Design** (a disagreement to put to Julian as options).

### BLOCKER 1. The complexity budget is blown, and the drafts protect the overload (Design, plus one Error)

**Where.** CS §0–§13 as a whole; CS §17 "Never cut"; V §15 "Never cut"; D §12 "Never cut"; CS §13.4; L §11.1; D §3.6.

**What is wrong.** Appendix A counts the systems a Night Guard meets in departments 1–3 of run 1. There are about 32, and about 20 of them have no analogue in SPD's first region (floors 1–5, roughly 30–45 minutes of play). Among them:
- five awareness states plus a 3-pip meter;
- 13 trigger glyphs and about 45 pictograms;
- noise by floor material against three hearing classes;
- five lux bands with asymmetric sight;
- lantern and tiptoe toggles;
- guards with five breach types, four states, Custody pips and confiscation;
- two alarm levels, and a clock with three stages and eight effects;
- Clearance doing three jobs, a 6-rung ladder, forgeries with six defects, and 12 consumable kinds;
- Restoration per slot, Certificates with eight perk families, the sketch, coins with six NPC services, a department module, placards with five or more icons, and the accession slip.

SPD teaches its systems across 25 floors in a fixed order. ACCESSION loads its heaviest system, the stealth simulation, into department 1 and into every department after it.

The drafts' never-cut lists include "the pip meter, the noise and lux model, vitrine breaking, the clock stages, the 12 kinds with seals" (CS §17) and "the dormancy and wake system" (V §15). That universal layer is exactly where the weight sits.

**Error inside it: there is no onboarding plan for the universal layer.**
- CS §13.4 says the 13 trigger glyphs and 5 state glyphs are introduced "in the Intro gallery of the first department".
- L §11.1 and D §3.6 limit every Intro to *one* mechanic, at most 3 hostiles and the signature module only.
- Both cannot be true, and nothing else teaches guards, alarms, Clearance, the ladder or the clock.

**Why it matters for Julian.** Pillar 1 promises that every department is "familiar to play". When the familiar layer is this large, "familiar" takes ten runs, and every department plays as the same heavy stealth sim with a gimmick on top (see MAJOR 8). On a phone this is fatal. The tombstone line is about 45 characters (CS §13.2), and CS's own Risk 1 already counts six meters.

**Resolution.**
1. Put an explicit **complexity budget** in the doc as a decision: at most about 10 universal systems, at most about 15 glyphs a player must know in department 1, and at most 2 new systems per department.
2. **Invert the weight.** Universal: bump combat with dice and telegraphs, three awareness states, a presence ring (MAJOR 1), lit/dim/dark, cases, the clock with two stages, gear plus Clearance, 8–10 consumable kinds, kits and Certificates, and the Masterpiece. Everything else becomes **module-owned**:
   - guards and alarms belong to `alarm_network` / Guarded (MAJOR 6);
   - fine-grained noise belongs to Machines (escapements) and to anything with `noise(n)`;
   - LIGHT/DARK triggers belong to Light;
   - forgeries belong to the Copies family or the Strict Provenance directive;
   - Pose and tours belong to Attendance.
3. **Extend H5** (complexity cap by row, D §2.4) to count *systems* as well as module intensity. Random order then still delivers a curriculum.
4. Rewrite the never-cut lists against this budget.

### BLOCKER 2. Two incompatible core rule sets, plus four smaller forks (Error)

**Where.** CS against V, with D, M and S each following one or the other.

**What is wrong.** The documents Julian would read define the core rules twice, and differently. The full table is Appendix B. The headlines:
- **The 12 consumable kinds are two different lists.**
  - CS §6.4: Consolidant, Fixative, Fumigant, Solvent, Lamp Oil, Developer, Catalogue Card, Floor Plan, "Quiet, Please", Re-admission Ticket, Deaccession Form, Evacuation Notice.
  - V §5.4: tonic, catalogue_card, floor_plan, audio_guide_cassette, solvent, evacuation_card, late_pass, flash_bulb, spirit_lamp, dust_sheet, wet_floor_sign, closed_sign.
  - S uses V's list; D §1.6 uses CS's; M §7.3 cites both in one cell.
- **Awareness states:** five in CS, four in V. They lose you after 8 turns in CS and 20 in V.
- **Triggers:** 13 in CS (PROXIMITY by path distance) against 15 in V (prox needs line of sight, plus period, path, tether and ally_hit).
- **Noise:** loudness minus path distance in CS; fixed radii of 3, 6 and 10 in V.
- **Light:** five bands in CS against four classes in V. The lantern is on/off in CS and off/low/high in V.
- **Guards:**
  - CS has unharmable staff with no cone that react only to breaches.
  - V's `patrol_guard` has a 90° cone and raises the alarm on sighting you.
  - V's `night_watchman` "if defeated, returns after 20 turns", while CS says Watchmen cannot be harmed.
- **Damage kinds:** five in V, with resistances; none in CS's combat maths.
- **Patron Membership:** one God-Mode track that blocks Directives in D §9; four tiers with +HP, +clock and a second Loan slot that "blocks nothing" in M §8.

**Why it matters.** Julian cannot judge whether the game is legible when the rules disagree. The union of both rule sets is what a reader will assume is being proposed, and that union is even heavier than BLOCKER 1.

**Resolution.**
- Before the doc goes out, name **one owner for player-facing rules (CS)**. V becomes the *data vocabulary* that compiles to CS's rules, never a second rulebook.
- Add Appendix B to the doc as a reconciliation table, with the chosen side for each row.
- Where both sides have merit, raise it as one decision: V's off/low/high lantern against CS's toggle, and the consumable list.

### MAJOR 1. Stealth is opaque turn by turn, and tiptoe is a trap (Error in the model; Design for the fix)

**Where.** CS §1.2, §3.2–§3.4, Decision C4; §13.4 "Sound ring"; Risk 1 ("noise rings belong to an instrument"); D §8.1 persona verbs.

**What is wrong. Run CS's own numbers:**
- **Footsteps almost never wake anything.** Volume is L minus path distance. Carpet (0) and parquet (1) never reach a hearing-2 sleeper. Stone (2) reaches only light sleepers, and only when adjacent. Only water (3) and shards (5) wake normal sleepers. Tiptoe's one benefit, silence, therefore matters only on water, on shards, in a heavy garment or a Loud forgery, or next to light sleepers.
- **The triggers that do wake things fire per turn** (PROXIMITY, SEES_YOU, UNOBSERVED, TAG_NEARBY, LIGHT, DARK: "1 per turn"). A tiptoe step costs two turns, so tiptoeing past a dormant exhibit *doubles* the pips you collect, and it also burns clock.
- **Tiptoe therefore makes stealth worse in most rooms.** D §8.1 nonetheless gives the Tourist persona "Tiptoe past" as a required verb.
- **The default UI does not show noise propagation.** Risk 1 assigns noise rings to the Hearing Trumpet curio. A player who cannot see why things woke will tiptoe everywhere "to be safe", which doubles both tedium and wakes.
- **The worked fight (CS §2.8) contradicts §3.4.** The Hound has "1 pip from your earlier step on parquet within 2 tiles", but parquet is inaudible at that range. The model is hard to predict even for its author.

**Why it matters.** Turn-based stealth is fun when the player can plan against complete, simple information: Invisible Inc's cones and noise radius, Hitman GO's grid, Brogue CE's single stealth range. Here the inputs are many:
- floor material and hearing class;
- the lux of your tile and of the target's tile, plus the lantern radius;
- 13 triggers with per-turn caps;
- decay of 1 pip per 10 turns that stops at the First Bell;
- doors +4 and curtains +1.

The outputs (pips) are visible, but the causes are not. That is how a stealth sim comes to feel random.

**Resolution (options for Julian).**
- **(a) Lean: a Brogue CE-style presence ring.** One number per action, set by stance (normal, fighting or resting) and garment, drawn as a ring around the player at all times. Exhibits inside the ring with line of sight gain a pip per turn. Each species adds at most one *special* trigger from a short list (LIGHT, OBSERVED/UNOBSERVED, CASE_TOUCHED, TAG), shown as its single pictogram. Cut tiptoe. Keep loud floors as data: shards and water enlarge the ring.
- **(b) Keep CS's model**, but show your last action's noise ring by default, make PROXIMITY count only on turns you *move* within r, and set tiptoe to 150 ticks.
- **(c) Cut stealth to dormancy only**: awake on proximity, no pips. Simplest, but it loses the department-specific triggers that make Light and Specimens interesting.

### MAJOR 2. The Masterpiece is neither a real choice nor a reliable climax (Design)

**Where.** CS §5.4, Decision C5; D §6.2–§6.3.

**What is wrong.**
- **Viewing is nearly free.** The read costs 0 ticks (CS §1.3). The lectern stands 3–4 tiles from the plinth and can be read from 2 tiles away. From the lectern's far side you are 5–6 tiles from a Masterpiece whose usual trigger is PROXIMITY 2.
- **Nothing stops you from viewing first and fighting afterwards.** View-then-Fight therefore *strictly dominates* Fight: you get a free Certificate and perk before the fight, with a Re-admission Ticket as the exit. Skip is dominated by View everywhere before Lights Down.
- **The Certificate stops being a decision.** Over eight departments, Masterpieces collapse into "read a lectern", plus an optional loot fight against one of four cores (V §2.4, D-V5) that the player will recognise by run 3.
- D §6.3's target, that the median Sneak views successfully in ≥60% of seeds, implies viewing was meant to be a real stealth test. CS's geometry does not deliver one.

**Why it matters.** The Masterpiece carries the Certificate (+5 HP and a perk), the Signature piece, the Treasure form and the accession pick. If its central decision is fake, a department has no climax.

**Resolution (options).**
- **(a) Lean: View and Defeat are exclusive, and both cost something.** Viewing is a channelled action, say 4 turns at the lectern, inside the Masterpiece's trigger radius, under OBSERVED rules. Viewing "closes the exhibit" (a dust sheet goes over it), so no fight follows.
- **(b) Differentiate the rewards.** Defeat offers a choice of perks from 4; View offers 2.
- **(c) Keep both open,** and accept that Defeat is purely a loot gamble. In that case say so, and cut the Fight form from more departments to avoid fatigue (D R7).

### MAJOR 3. Perk families tied to challenge types fight the rotation rules (Design)

**Where.** CS §8.4–§8.5; D §2.4 (H2, H3, H6), §5.4 "Perk coupling".

**What is wrong.**
- Two of the three perks in each Certificate offer come from the department's primary challenge family. Yet the sequencer *forbids* repeating a primary type back to back (H2) and caps repeats at two types, twice each, at least two departments apart (H6).
- A type-specific perk therefore pays in at most one or two later departments. By my count about 12 of the 32 perks are narrow:
  - Swarm: Crowd Management, Elbow Room;
  - Artillery: Behind Glass, Spotter, Close the Distance;
  - Darkness: Afterimage, Moth Sense;
  - Hazard: Wader, Firebreak, Surveyor;
  - Locks: Puzzle Box;
  - Social: Tour Regular.
- Attrition's and Social's perks are all general, and some general ones are strong (Second Wind, Master Key).
- The pick degenerates into "take the general one", and the family with the best general perks becomes the preferred door. CS §8.4 claims the placard icon is "a build choice, as a Hades god is". The variety guarantee prevents you from chasing a god, and narrow perks are traps.
- Rank 2 needs the same family twice, which H6 makes rare, so ranks mostly go unused.

**Why it matters.** Builds are the long-run depth of a roguelike. Here every run yields roughly eight rank-1 perks drawn from six or seven families: a scatter, not a build.

**Resolution (options).**
- **(a) Lean: playstyle families.** Use Fight, Sneak, Look and Endure, decoupled from challenge types, about 12–16 perks for launch, mostly triggered. The challenge icon keeps its texture role, and the perk offer reads the player's history (two from the family they used most, one from another).
- **(b) Keep the coupling but loosen H6** so that a player can chase a type: "at most three of one type".
- **(c) Keep the coupling,** and rewrite every narrow perk so that it also pays elsewhere (Behind Glass also applies to Masterpiece specials, and so on).

### MAJOR 4. The clock and the run length rest on numbers the layout section has already falsified, and the clock bites the wrong player (Error and Design)

**Where.** CS §5.1, §5.6, Challenges 5; D §1.3, §10.6; L §17.2 and L-D1.

**What is wrong.**
- **The assumptions do not hold.**
  - CS sized B (480/650/800) on an L_tour of 150/220/280. L's prototype measured L_tour p50 of 59–77 for a Cabinet, 84–108 for a Department and 115–177 for a Wing, about 40% lower.
  - On measured layouts, a median Department takes about 250–280 turns. At CS's unmeasured 80 turns per minute, that gives a 40–45 minute run, not D's "82 minutes".
- **The clock is toothless for the players it targets.** Using L's own estimates, the median player uses about 75–85% of B and finishes before the First Bell. Fighters and pillar-dancers, the clock's stated targets (CS §5.6), never see Lights Down.
- **It binds on the wrong players**: the Completist, and anyone who tiptoes. Tiptoeing doubles steps to about 2.6 × L_tour against a B of 2.5 × L_tour + 100. The clock therefore taxes stealth more than stalling, which inverts pillar 3.
- **It also carries eight separate effects:**
  - pips stop decaying;
  - guards sweep the galleries;
  - ambient light drops by one band, then by two;
  - regeneration halves, then stops;
  - the Masterpiece goes to Stirring;
  - Watchmen arrive;
  - more Watchmen escalate in;
  - the dormant exhibits nearest you wake every 50 turns.

**Why it matters.** Session length is the most important product decision for a browser and phone roguelite, and the doc presents it as settled when its inputs are known to be wrong. The clock is the anti-stall system; if it does not bite, players will rest at benches until the dial reads First Bell in every department. That is mild, but it is a habit.

**Resolution.**
- Adopt L-D1(a): keep the measured sizes and re-base B on measured L_tour.
- Make **turns per minute the first measurement of the first playable**, and treat run length as an outcome.
- Put run length to Julian as a decision:
  - **(a)** 8 small departments, about 50–60 minutes (my lean for a phone roguelite whose meta turns over per run);
  - **(b)** 8 grown departments, about 80 minutes (L-D1(b), with maps beyond 48×36);
  - **(c)** 6 departments.
- Collapse the clock to **two stages**:
  - **Bell**: pips stop decaying, regeneration stops, the Masterpiece stirs;
  - **Night Watch**: escort to the exit.
- Drop tiptoe (MAJOR 1), so stealth is not what the clock punishes.

### MAJOR 5. Choices the drafts call real are dominated: retiring beats dying, and the Wing beats the Cabinet (Error)

**Where.** CS §11–§12; M §4.2, §4.6, §5.3; L §14.4 (staff telephone); D §1.4, §2.1.

**Retiring beats dying.**
- **How it works.** Retirement is "a conversation with a neutral guard". L §14.4's staff telephone summons a guard in 10 turns "if… the player asks". Retirement keeps the current department's accession pick when its Certificate has been earned (CS §12). M §5.3 sends the Loan into conservation only "if you die".
- **The consequence.** At low HP, the right play is to walk to a guard (or phone one) and retire. Death never stings, and doing this becomes a chore players feel obliged to perform. This is also the real "save-scum the Loan" leak; the action-log save closes the reload route (M §4.6).
- **Resolution.** Treat retirement exactly as death for meta purposes. Alternatively, allow it only at the Entrance Hall and Stair Halls, or only when nothing is Hunting you. Allow the staff telephone only when the soft-lock check fires.

**The Wing beats the Cabinet.**
- **How it works.** D §1.4 calls size "a real door decision… because ambient loot and danger both scale". But every door at a given depth is calibrated to the *same* p\*(t) (D §2.1), and the quotas are fixed across sizes.
- **The consequence.** Inside the game, a Wing is the same death risk for more loot; the clock resets per department and leaving early earns no bonus (CS §5.5). The only cost is real-world minutes. Nothing calibrates net resources at exit by size.
- **Resolution (options).**
  - **(a)** Calibrate "HP plus consumables at exit" by size, so that the extra loot in a Wing is eaten by its budget.
  - **(b)** Give Cabinets a carried bonus (CS §5.5's Grace turns, or +HP).
  - **(c)** Cut the size classes (D's own cut 3).

### MAJOR 6. Guards that cannot be harmed are the right idea in the wrong place, and two class passives break them (Design, plus Errors)

**Where.** CS §3.7–§3.9, Decision C3, §10 (Night Guard *Colleague*, Copyist *Permit*), Risk 3.

**What is wrong.**
- **Daytime guards are universal.** Every department has 1–3 breach-policing staff, so every case in sight of a patrol becomes "wait until the guard leaves". That is a single repeated tap, with no "wait until…" command in the input spec (CS §13.6).
- **Capture is a setback with holes.**
  - Confiscation is dodged by equipping the item (CS calls this "a nice small rule"; players will call it a chore).
  - The escort to the entrance resets the alarm, and nothing says what happens to exhibits that were Hunting you. Unless the escort specifies it, capture works as a free Re-admission Ticket whenever you have something to flee.
- **Errors in the class passives.**
  - The Night Guard's *Colleague* says guards "never raise an alarm on merely seeing you, only on a witnessed breach". That is the baseline rule for every class (§0, §3.7), so half the passive does nothing. The other half ("Custody only at department alarm") makes the run-1 class almost immune to capture. The class every new player starts with never learns the guard system, and the D §8.6 class-parity gate will fail in Guarded departments.
  - The Copyist's "guards ignore you while you sketch" lets a pursued Copyist start a 2-turn sketch and shed pursuit and Custody indefinitely.

**Do unharmable guards work?** Yes for the **Night Watch**: it is the clock made visible, rare and late, and tonally right. Not for universal daytime enforcement.

**Resolution.**
- Daytime guards enforce breaches **only in departments with `alarm_network` / Guarded**. Elsewhere they are neutral NPCs who give directions.
- **One capture rule**, the same for guards and Watchmen: you are escorted to the exit doors and keep what you carry and any Certificate already earned. Unfound Highlights are lost. This drops Custody pips (adjacency at the end of your turn means caught), confiscation and the second alarm level.
- Rewrite *Colleague*, for example: "one witnessed breach per department is excused".
- Change the Copyist's permit to "sketching is never a breach". Delete the clause about guards ignoring you.

### MAJOR 7. Combat is pure cost, and the doc never decides which mode is primary (Design: missing decision)

**Where.** CS §6.6 "Exhibits drop nothing", §8.1; D §3.4 worked depth-1 department, §8.1 Pacifist gate; direction pillar 3.

**What is wrong.**
- **Killing pays nothing.** There is no XP (correct: Brogue F10, and random order). Exhibits drop nothing (CS §6.6, stated as fact, never offered as a decision), and kills buy only "access and safety". The Signature piece is the only fight-gated reward, and View undercuts it (MAJOR 2).
- **The brief asks for something else.** It asks for SPD-like RPG conventions and never mentions stealth. The drafts have built a Thief-style stealth sim, the most expensive code in the vocabulary (V Risk 5), and then require fight, sneak and leave to be at *parity* in every department (gates G4 and G12). Parity across three paths triples the tuning and makes each path shallower.

**Why it matters.** Without a primary mode, every system is built to the same standard and none becomes the deep one.

**Resolution: add a decision for Julian.**
- **(a) Lean: tactics first, stealth as a strong tool** (Brogue). The doc keeps no XP, but every department has 1–2 fight-gated rewards, such as a warden-guarded case holding the curio. Stealth is the main mode only in Guarded and Darkness departments.
- **(b) Stealth first** (Invisible Inc). Fighting is a failure state and combat stays thin.
- **(c) Parity**, as currently written, at three times the tuning cost.

Separately, raise "Exhibits drop nothing" and "Guards cannot be harmed" as explicit decisions. They are presented as facts.

### MAJOR 8. Departments will feel samey sooner than the drafts claim (Design)

**Where.** V §11.2, D-V1; L §19.2, L-D3; V §2.4, D-V5; S §8.1 (M.11 "signals collapse into generic ranged attacks").

**What is wrong.** Most turns are spent in the shared universal layer (BLOCKER 1), which is the same everywhere. The department layer is thin:
- **Modules.** A signature module appears in about 8% of departments and in a given run with p ≈ 0.49 (V §11.2). With 13 launch modules, a player has met all of them by run 3–4.
- **Programmes.** The six launch programmes are three macro shapes (L §19.2).
- **Masterpieces.** They are assembled from four cores (V §2.4), so a Masterpiece is recognisable by run 3.
- **Keepables.** They cannot reference their module (S §8.2 gap 9).
- **The vocabulary's own admission.** V D-V1 concedes that (a) "blurs together by about run 10". At (b) I would expect run 15, not much better.

S proves the method works when a module reshapes target priority (A.4: break the original first) or attention (S.9: keep the Grazers in view). It fails when the module is a hazard overlay on generic combat (S's own M.11).

**Resolution.**
- Apply BLOCKER 1's inversion, so that departments own subsystems. Then "the department where noise matters" and "the department with guards" become identities.
- Adopt S §8.4's `house_rule`, the system-count cap by ordinal and the keepable test.
- Adopt D-S3(b): Signature pieces carry module riders.
- Require the signature module to be **active in most galleries, not only the Intro**. Add a fingerprint metric for the share of turns in which the module changes the player's best action.
- Track **turn-share sameness** in the D §8.5 oatmeal ratio, not only design descriptors.

### MAJOR 9. Too many decisions, and the wrong ones (Design and process)

**Where.** The "Decisions for Julian" tables:
- CS C1–C9 (9);
- D R1–R12 (12);
- M M1–M16 (16);
- V D-V1–D-V8 (8);
- L L-D1–L-D7 (7);
- P D-P1–D-P9 (9);
- S D-S1–D-S5 (5).

That is **66 decisions**.

**What is wrong.**
- **Many are obvious or technical,** and their leans are not contestable:
  - C1 one hit table, C2 flat Padding, C8 reading is free, C9 (rung naming);
  - R5 the median persona, R11 the café, R12 adaptivity;
  - M8 currency, M12 class unlocks, M13 the cast, M14 persistence, M15 seeded runs;
  - D-V2 tag signalling, D-V8 who adds vocabulary;
  - L-D4 generation timing, L-D6 archive axes;
  - D-P6 model per stage, D-P7 telling S1 what exists, D-P9 numbering;
  - D-S5 truths per didactic.
- **The decisions that shape fun are missing or buried as facts:**
  - the primary mode (MAJOR 7);
  - the size of the universal rule layer and an explicit complexity budget (BLOCKER 1);
  - whether guards can be harmed, and whether they exist outside Guarded departments (MAJOR 6);
  - whether exhibits drop loot;
  - whether View and Defeat are exclusive (MAJOR 2);
  - retirement against death (MAJOR 5);
  - session length and platform priority, phone-first or not (MAJOR 4);
  - the first-playable scope and build order (MAJOR 10).

**Resolution.**
- Lead the doc with **at most 12 headline decisions**, including the missing ones above.
- Move about 50 decisions into an appendix of "defaults we will take unless you object".
- Merge cross-file duplicates. The Patron model appears twice (R10 and M9), sizes appear twice (R2 and L-D1), and Social appears twice (R6 and D-V3).

### MAJOR 10. The factory is built before the fun is found (Design and process)

**Where.** D §12 never-cut list ("b(d) calibration with the six-persona battery and gates G1–G5"); D §8 (6 personas × 3 skills, 12 gates, 145 CPU-hours per full-pool recalibration); V §15 never-cut list; L §21 never-cut list (offline Intro certification); P S0–S7.

**What is wrong.**
- The first department cannot ship, by the drafts' own rules, until the persona harness, limited agents, Intro certification and fingerprint gates exist. Yet every number in the drafts is labelled "a first draft for the simulator to move".
- The fun questions in this critique can be answered in a week of human play on hand-built departments, and the answers will change the rules the harness has to model:
  - Is the pip model readable?
  - Does View feel like cheating?
  - Is tiptoe used?
  - How many turns per minute do players take?

**Resolution.** Make the **first playable** the following:
- one class;
- three hand-built departments from S.9, A.4 and M.11 (S D-S2(a)), with hand-tuned numbers;
- no pipeline, no personas, no size classes, no heat, and no meta beyond a death label and a stub of the accession display;
- a human playtest with Julian at the end of it.

Build the harness after that, against the rules that survive. The harness is still worth building, but as the second step, not the first.

### MINOR 1. The attribution ladder and forgeries carry too much for what they give (Design)

**Where.** CS §7, §15.1; V §3 `forgery`, §5.1, §5.4; M §4.7.

- **The ladder.** It has six rungs, and an item in use reaches rung 5 within one department (CS §7.2). Rungs 1–4 are transient states that players will not care about; CS concedes rungs 4–5 are thin.
- **"Forgery" means four different things:**
  - an equipment curse;
  - a consumable variant;
  - an exhibit modifier ("Attributed to" a stronger archetype);
  - a meta case, the Chamber of False Things.
- **Fix.** In v1, equipment is known or unknown, and a forgery reveals itself on equip, as SPD does with curses. Forgeries live in the Copies family as a module, or behind the *Strict Provenance* directive. Keep the seals on consumables: they are cheap and fun.

### MINOR 2. Consumables will glut, and there are too many shopping stops (Design)

**Where.** CS §6.4, §6.6, §11; D §4.1–§4.2.

- **Supply.** Seven ambient consumables per Department makes about 56 per run, plus kiosks and café options. That is SPD's admitted failure mode (RS F9) in a game with far fewer turns.
- **Overlap.** CS's list has three escape or reset kinds ("Quiet, Please", Re-admission Ticket, Evacuation Notice) and two identification kinds (Catalogue Card, Deaccession Form).
- **Shopping stops.** A kiosk sits in every department's coda, as well as at every Stair Hall. That is 11 or more shopping stops in a run; SPD has 3–4.
- **Is 12 kinds right?** Yes for the full game (Brogue has about 31, SPD about 50).
- **Fix.** For the first playable, use 8 kinds, 4–5 ambient per department, and kiosks only at Stair Halls.

### MINOR 3. The universal sketch is a chore at half strength (Design)

**Where.** CS §9, Decision C6; V §2.6.

- For non-Copyists, the sketch is a channelled verb taking 3–12 turns, producing a page at 50% magnitude with 1 charge.
- It doubles the balance tables for every special.
- It overlaps with View as the "reward for looking".
- **Fix.** Make it Copyist-only, and add the Copyist as the first class after the first playable (CS cut 6).

### MINOR 4. The final encounter is solved by waiting (Design)

**Where.** D §1.6, Decision R8.

- Phase 2 starts after 30 turns whatever the Registrar's HP.
- The Registrar's stamps deal no HP damage and are telegraphed in a 3-tile line.
- **Result.** The dominant play is to dodge for 30 turns, then sign out at a door cycle. Defeating the Registrar ("receipt") has no stated reward.
- **Fix.** If that is intended (leaving is legitimate), say so and make the run's best moment somewhere else. Otherwise, make signing out require something from the run: tags under 5, or Certificates as "passes" through the doors.

### MINOR 5. Required Intros tax experienced players every visit (Design)

**Where.** L §11.2; D §3.6.

- Every department's Intro *requires* its mechanic through the `cut(Z)` invariants.
- By run 10, the player has crossed the tide gallery several times. That costs about 20–30 turns per department, eight times per run.
- **Fix.** Once the module is Documented in the Catalogue, open a "Members' entrance" that bypasses the gate, or switch to a harder variant.

### MINOR 6. Travel interruptions and waiting have no tooling (Error)

**Where.** CS §13.6.

- **Interruptions.** Tap-to-path stops "when… a pip appears on a visible exhibit". In stealth galleries that is every step.
- **Waiting.** There is no "wait until something changes" or "wait N turns" command for timing patrols and demonstrations (DCSS has a 5-turn rest; Hoplite has short levels instead).
- **Fix.** Interrupt only on an exhibit's first pip per approach. Add "wait until change".

### MINOR 7. The café's third option is dominated (Design)

**Where.** D §1.5, Decision R11.

- *Reading Room* (catalogue everything) loses to heal or +1 level from about depth 2. By then identification is cheap: labels, use, and the Registrar's free catalogue in the same room.
- **Fix.** Replace it with something museal that competes, such as a Loan Desk swap, a perk reroll, or "+1 Clearance".

### MINOR 8. The lantern flick is a UI tax (Design)

**Where.** CS §1.3, §3.5.

- Toggling and reading are both free, so the efficient habit is on, read, off: two extra taps per label in every dark room.
- **Fix.** Reading in the dark automatically counts as a one-turn lantern flash, so the LIGHT check still fires and the cost stays in the world.

### MINOR 9. Lockstep scaling flattens felt power: check that it does not erase the build fantasy (Design)

**Where.** D §3.2.

- By design a fodder takes about 2 hits at every depth (D §3.2). The feeling of growth must therefore come from kit concentration, perks and Signature pieces.
- **Check.** The nightly runs should confirm that a concentrated build (all kits into one weapon) can visibly outscale the median, which is Brogue's pleasure. The calibration on median builds must not tune that away.
- This is an observation, not a change request.

---

## Answers to the brief's questions

**A pile of systems, or fun?** Both. The core loop is good (see the verdict above). Around it sit about 32 systems, and the drafts protect the universal ones (BLOCKER 1).

**The complexity budget against SPD.** SPD's first region has about 10 systems over 30–45 minutes:
- move and bump, HP and regeneration, hunger, XP;
- strength, unknown potions and scrolls, gear with use-ID and curses;
- keys and doors, traps and search, and a boss.

SPD adds talents at level 2, alchemy at floor 3–4 and shops at floor 6. ACCESSION shows about 32 systems in departments 1–3 (Appendix A), about 20 of them without an SPD analogue, in about 20 minutes. Target about 10 universal systems, at most 2 new per department, and at most 15 glyphs in department 1.

**Dominant strategies.**

| Strategy | Verdict | Finding |
|---|---|---|
| Always sneak | Not dominant. Tiptoe is a trap; avoiding fights by walking wide lanes is efficient | MAJOR 1, MAJOR 7 |
| Always skip the Masterpiece | No. Always View, then fight only for loot | MAJOR 2 |
| Pillar-dance | Adequately priced by slow regeneration, the arena loop rule and the clock. The residue is "rest at a bench until the First Bell" | MAJOR 4 |
| Stall | Stair Halls have no regeneration; the in-department clock is too generous at measured tempo | MAJOR 4 |
| Save-scum the Loan | The action-log save closes reloading. Retiring instead of dying is the leak | MAJOR 5 |
| Farm Accession | Guarded by the Certificate and provenance; accession is free anyway. Banking by retiring is the leak | MAJOR 5 |
| Surprise-kill everything | Bounded by the vandalism breach and noise 5. "Waking costs a beat" means most fodder die without acting, which is fine. Watch Light weapon ×1.5 combined with *Sweeping Up* | CS Risk 2 |
| Pick Wing doors | Dominant inside the game | MAJOR 5 |
| Pick the general perk | Dominant | MAJOR 3 |
| Get captured to escape | A free Re-admission Ticket | MAJOR 6 |
| Sketch to shed guards (Copyist) | Exploit | MAJOR 6 |
| Dodge for 30 turns, then sign out | Dominant at the Exit | MINOR 4 |

**Is stealth viable and fun turn by turn?** It is viable: the asymmetric sight margin and dormancy make it so. It is not yet fun, because the causes are hidden and tiptoe is counter-productive (MAJOR 1). Two turns per step would be tedious if anyone used it, and correct play is not to.

**Unharmable guards and capture as a setback?** Yes for the Night Watch. Daytime guards should exist only in Guarded departments. Capture should mean escort to the exit, with no confiscation and no free teleport (MAJOR 6).

**Is "no XP" right?** Yes, for the reasons in CS §8.1. But it needs fight-gated rewards and an explicit primary mode, or fighting becomes a pure tax (MAJOR 7).

**The closing clock?** On measured layouts it is toothless for median and fighting play, and punishing for tiptoe and completists. It has eight effects where two would do (MAJOR 4).

**32 perks and 12 consumables?** Twelve kinds is right for the full game, eight for the first playable, but the two drafts have two different lists (BLOCKER 2). Thirty-two perks is a fine count with the wrong structure: tie families to playstyles, and use 12–16 general triggered perks at launch (MAJOR 3).

**Does random department order work with the difficulty model?** Yes. It is the best-reasoned part of the drafts. Its costs:
- the Intros repeat (MINOR 5);
- door choices are risk-flat, apart from the Special Exhibition ribbon (acceptable);
- the size classes are broken (MAJOR 5);
- power feels flat (MINOR 9).

**Is the run too long?** The 82 minutes is not real: the inputs are falsified, and on measured layouts at 80 turns per minute the run is 40–45 minutes. For a phone and browser roguelite, I lean towards 8 small departments at about 50–60 minutes. Measure turns per minute first (MAJOR 4).

**Does every department change how you play?** Only where the module changes *what you target or attend to* (A.4, S.9). Elsewhere departments will blur by around run 10–15 (MAJOR 8).

**Fake decisions and missing ones.** See MAJOR 9.

---

## The five cuts that would most improve the first playable

1. **Collapse the stealth simulation.**
   - Keep three awareness states (Dormant, Stirring with pips, Hunting) and a visible presence ring.
   - Each species gets at most one special trigger from a short list.
   - Use three light bands (lit, dim, dark) and a lantern on/off.
   - Remove tiptoe, Pose, tours, the two-level alarm, per-material noise, hearing classes, door and curtain sound costs, and pip decay rules beyond one constant.
   - *Effect:* this removes about 10 of the 32 first-run systems and most of the glyphs. It turns stealth from a simulation the player reverse-engineers into a plan they make.
2. **Make guards a module, not a universal rule.**
   - Breach-policing guards, Custody and confiscation exist only in `alarm_network` / Guarded departments.
   - Capture means escort to the exit for everyone.
   - The Night Watch stays.
   - *Effect:* every department no longer has a second fail state and a waiting game, and Guarded departments become distinctive.
3. **Cut equipment identification and forgeries.**
   - Equipment is known on pickup, and curses (if kept) reveal on equip.
   - Remove Inspect, the 6-rung ladder, the Deaccession Form and forgery repair.
   - Keep the consumable seals.
   - *Effect:* this deletes a second minigame and about six rules while keeping SPD's best ID game, the consumables.
4. **Cut perks to 12 general, triggered perks in 3–4 playstyle families, decoupled from challenge types.**
   - Also drop the Stair Hall beats (*Appointment*, *Master Key*) and the Conservator level transfer.
   - *Effect:* the Certificate pick becomes a build choice instead of a choice between a trap and the general perk.
5. **Cut the factory from the first playable.**
   - Use three hand-built departments (S.9, A.4, M.11), hand-tuned numbers and one class.
   - Leave out the pipeline, persona gates, size classes, heat, Patron and meta beyond a death label.
   - Playtest with humans, measure turns per minute, then build the harness against the rules that survived.
   - *Effect:* the fun question is answered in weeks rather than after the infrastructure exists.

The next cuts, in order:
- the universal sketch, together with the second class;
- the size classes;
- balconies;
- the five damage kinds (V D-V4(a): a single damage type for v1);
- coins below the Stair Halls.

---

## Appendix A. The systems a first-run Night Guard meets in departments 1–3

| # | System | Source | SPD floors 1–5 analogue |
|---|---|---|---|
| 1 | Bump combat, the hit table, damage dice, Padding, HP | CS §2.1–2.2 | yes |
| 2 | Telegraphed specials with exact damage | CS §2.4 | boss only |
| 3 | Odds readout | CS §2.7 | no (information only) |
| 4 | Five awareness states and a 3-pip stir meter | CS §3.1–3.2 | implicit sleep and hunt, no UI |
| 5 | 13 wake-trigger glyphs | CS §3.3, §13.4 | none |
| 6 | Noise by floor material, hearing classes, door and curtain costs | CS §3.4 | none |
| 7 | Five lux bands, sight asymmetry, lantern toggle with an instant LIGHT check | CS §3.5–3.6 | "dark" level feeling |
| 8 | Tiptoe toggle | CS §1.2, C4 | none |
| 9 | Guards: 5 breach types, 4 states, Custody pips, escort, confiscation | CS §3.7 | none |
| 10 | Alarms: 2 levels, security lighting, clock +50 | CS §3.8 | alarm traps |
| 11 | Hiding: dark, curtains, doors, Fumigant, Pose, staff corridors | CS §3.9 | none |
| 12 | About 20 furniture types, 3 glass grades, rope lines, plinth mounting, balconies at ±10 to hit | CS §4 | doors, traps |
| 13 | The clock: B, three stages, eight effects, Watchmen | CS §5 | hunger |
| 14 | The Masterpiece: seal, clock pause, view, defeat or skip, Re-admission | CS §5.4 | boss on floor 5 |
| 15 | Slots: weapon, garment, 2 curios, instrument, lantern, sketchbook, lanyard, tote, quickslots | CS §6.1 | similar, simpler |
| 16 | Handling Clearance doing 3 jobs, with a shortfall penalty | CS §6.2 | strength (1 job) |
| 17 | 4 weapon forms, 3 garment forms, tiers by depth | CS §2.5 | tiers |
| 18 | 12 consumable kinds, 2 families, seals, drink or throw, harmful drinks | CS §6.4 | potions and scrolls (similar) |
| 19 | The 6-rung ladder, Inspect, forgeries (hold, 6 defects, negative levels), 3 cures | CS §7 | use-ID and curses |
| 20 | Restoration kits per slot; Conservator transfer | CS §8.2 | upgrade scrolls |
| 21 | Certificates: +HP, 1 of 3 perks, 8 families, 2 ranks | CS §8.4–8.5 | talents from level 2 |
| 22 | The sketch: channelling, OBSERVED doubling, pages | CS §9 | none |
| 23 | Coins, a kiosk in every department, 6 NPC services | CS §11 | first shop on floor 6 |
| 24 | The department's rule module (signature, plus a secondary from ordinal II) | V §6 | level feelings |
| 25 | Behaviour tags (9 colours and glyphs) and idle tells | V §1.8, §2.2 | none |
| 26 | Material modifiers and 5 damage kinds | V §1.5, §3 | none |
| 27 | Statuses (up to 15) | V §4 | about 10 buffs |
| 28 | Placards: 2 challenge icons, size, Masterpiece form, reward icons, ribbon | D §2.1 | none (linear) |
| 29 | Highlights box and quotas | CS §8.6 | guide text |
| 30 | Stair Hall: café choice, kiosk, Conservator, Registrar, Directory, *Appointment* | D §1.5 | none before floor 10 |
| 31 | The accession slip at every exit | M §4 | none |
| 32 | Loan Desk (in half of departments) | CS §6.6 | none |

---

## Appendix B. Contradictions to reconcile before the doc is sent

| Topic | CS | V | Others |
|---|---|---|---|
| Consumable kinds | §6.4: Consolidant … Evacuation Notice | §5.4: tonic … closed_sign; only 4 names shared, and "evacuation" has different effects (CS: exhibits flee; V: exit_jump, which is CS's Re-admission Ticket) | S uses V's; D §1.6 uses CS's (Deaccession Form, Solvent drink); M §7.3 cites both |
| Awareness states | §3.1: 5 states with pips; lost after 8 turns | §1.2: 4 states (alert lasts 10 turns); lost after 20 | |
| Wake triggers | §3.3: 13; PROXIMITY by path distance | §1.2: 15; prox needs line of sight; adds period, path, tether, ally_hit, ticking, awake | S uses V's ids |
| Noise | §3.4: L − path distance against hearing 1/2/3; glass breaking 10 | §1.3: levels 0–4 with radii 0/3/6/10/whole department; glass breaking "crash" | S A.4 uses V's (breaking glass noise 3) |
| Light | §3.5–3.6: 5 bands; sight 1/4/8/12/12; lantern on/off, radius 3 | §1.4: 4 classes; sight 1/4/7/9; lantern off/low/high | |
| Guards | §3.7: unharmable staff, no cone, breach-only | §2.1 `patrol_guard`: 90° cone, alarm on sighting you | S §0.2 patches by making patrol_guard always an exhibit |
| Night Watch | §5.3: cannot be harmed | §2.1 `night_watchman`: "if defeated, returns after 20 turns" | |
| Damage kinds | none in combat maths | §1.5: 5 kinds, resistances from ×0.5 to ×2 | |
| Surprise | §2.3: auto-hit, maximum damage (Light ×1.5) | §4 `dormant`: "surprise multiplier"; §5.2 `surprise_bonus` ×1.5/×2/×3 | |
| Forgery | §7.4: hold, 1 of 6 defects, −1 to −3 | §5.1: bind and one primitive inverted; also an exhibit modifier and consumable forgeries | M §4.7: meta case |
| Ladder rung 0 | "Uncatalogued" (§15.1) | "After" reveals the category (§5.1) | |
| Clock budget | §5.1: B 480/650/800 from L_tour 150/220/280 | | L §17: L_tour p50 59–177, so B is about 250–540 |
| Run length | about 80 turns per minute, unmeasured | | D §1.3: 82 minutes; L §17.2: 40–45 minutes on measured layouts |
| Patron | | | D §9: −20% +2% per death, cap 60%, blocks Directives; M §8: 4 tiers (−15 to −40%, +HP, +clock, 2nd Loan), "blocks nothing" |
| "Wing" | | | D: a size class; L §19.5: a hierarchy level |
| Treasure guardian | | | D §6.4: guards plus a Security case; S D-S4: a core Sentinel |
| Universal-layer teaching | §13.4: the Intro of department 1 teaches 18 glyphs | | L §11.1, D §3.6: the Intro teaches one mechanic with at most 3 hostiles |
