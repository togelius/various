# Critique: the PCG design, read as Julian would read it

*Lens: a PCG researcher reading a design that says it is inspired by their work (search-based PCG, experience-driven PCG, quality-diversity, procedural personas, data games, orchestration, LLM PCG, AI&G 2e chs. 7–9). Review only; no draft was changed.*

**What I read.**
- In full: `brief.md`, `direction.md`, `design/pipeline.md`, `design/vocabulary.md`, `design/difficulty.md` (except §4), and the research briefs `book-pcg.md`, `papers-levels.md` and `papers-semantic.md`.
- In part: `design/layout.md` (§§0–4.0, 9–13, 17–21), `design/samples.md` (§0, §8), `design/core-systems.md` (§8.4–8.7) and `design/meta.md` (§1.3, §14.3–14.5).
- Checked against the extracted book text: AI&G 2e pp. 243–247 (autonomy and Fig. 7.3) and pp. 299–301 (rules).

Abbreviations follow the drafts: P = pipeline, V = vocabulary, D = difficulty, L = layout, S = samples, CS = core-systems, M = meta, BK / PL / PS = the three briefs.

---

## 0. Verdict

- **As engineering, the PCG is well-founded.** The work is unusually careful. Functional content is never left unchecked. Every generator has a validator, a repair step and a log. The layout section measured a prototype, and the measurements overturned two of the frame's assumptions.
- **As research, it is timid.** Julian's methods appear almost only as quality control, not as sources of novelty:
  - the LLM names things and chooses from enums;
  - QD is a coverage grid;
  - personas are a gate;
  - experience-driven adaptation is rejected;
  - mechanics are frozen, apart from a side track in V §11.4 that the pipeline never mentions.
- **On infinity, the curated v1 is the right call for shipping a good game.** But the decision as written leaves out the option a PCG researcher would actually weigh. By the pipeline's own argument (P §1.6, item 3), its v2 and v3 are reskinning, because the verbs never grow at machine pace.
- **None of this needs v1 to change shape.** Five additions would make the design both braver and a credible testbed:
  1. a module DSL;
  2. QD where evaluation is cheap;
  3. a learned surrogate of the simulation gate;
  4. a human-data channel;
  5. door choices used as preference data.

## 1. What works and must be kept

- **The functional/decorative split, enforced.** The LLM writes no number (P §2.2 tags). Numbers come from a balancer and S3 calibration. This is AI&G 2e p. 238 applied properly.
- **The no-decoration trace map, no silent fallback, and the unmatched-concept queue** (P C3, C7; V contract 2). Together they answer A Rogue Dream's failure directly, and the queue is a dataset.
- **The round-trip honesty check (T1), with lies allowed only inside a declared module** (`lying_labels`). It is also a publishable metric (R7).
- **The curation log** (P §3.9):
  - reason codes;
  - the blind first look;
  - CC per generator version;
  - Revise as a language-level edit.
  This is the evidence base for every later automation step.
- **Layout:**
  - an archive of *generator presets* rather than levels (L §13.4, PL F20);
  - structural Intro invariants (`cut`, `near`, `seen`, `refuge`, `window`) backed by offline limited-agent certification (L §11.2);
  - a certified fallback, with CI tests that the validator rejects broken mutants (L §10.3);
  - measured envelopes that are honest about being circular (L §13.2).
- **Difficulty:**
  - one scalar b(d) per department;
  - the median across personas as the reference;
  - held-out personas;
  - heat values fitted, not declared (D §3.8, §7.3, §8.1).
- **The oatmeal ratio on bot-play descriptors, validated against human distinctness judgements** (P §9.2).
- **Directory lines that become recipes in v2** (P §5.3): a door closed in run 5 opens as an exhibition in run 12. It is the best bridge in the document between the fiction of infinity and the real thing.

---

## 2. Findings

### BLOCKER

#### B1. The infinity decision leaves out its strongest option and argues against a weaker one

**Where:** P §1.2–1.7, D-P1, §7; direction pillar 5.

**Type:** mostly framing errors (fix them), plus one design disagreement (add an option).

**What is wrong.**

1. **The roadmap never reaches what it calls infinity.** P §1.6 item 3 says "Playable infinity without vocabulary growth is reskinning" and puts the bound at about 130 mechanical identities. The roadmap grows the vocabulary only through the human-reviewed path at 2–4 ids per update (P §1.6; V §11.4). So every runtime stage is reskinning by the document's own standard: v2 Temporary Exhibitions, the T1b "Infinite Accession" and v3 Commissions. V §11.4 does have an LLM research track for new mechanics, but P never connects it to the infinity question.

2. **The dud evidence comes from systems unlike this one.**
   - P §1.3 and §1.6 cite A Rogue Dream's 66% curation coefficient (2014, verbs from Google autocomplete).
   - They also cite Word2World's "90% playability", which is 9 of 10 worlds: n = 10, with a 95% interval of roughly 0.3–45% unplayable (PS F9).
   - Neither system has a closed-enum compile, a trace map or a simulation gate. Neither is evidence about the automated version of this pipeline, whose p is simply unmeasured.
   - P's own funnel guesses a curation coefficient of about 0.65 for *gated* departments (§3.11). That means Julian would turn down about 35% of what passes every automated check. It says nothing about how those rejections split between broken and dull, which is the split that decides v2.

3. **The arithmetic is asymmetric.** Duds are counted per visit. Staleness is not counted at all.
   - For N = 30, the expected number of new departments drops to 0.36 per run after run 10 and to 0.02 after run 20 (P §1.5).
   - After that, every department in every run is a revisit.
   - Recurrence is called a feature (learning a Masterpiece), but its cost to "an infinite collection … organized in no discernible manner" is never priced.

4. **The v2 gate is set above the pipeline's own expected acceptance rate.** P §1.7 requires that Julian accept at least 70% of automated-passed departments without major edits. P §3.11 expects 0.65. By the document's own estimates, v2 does not unlock unless the pipeline improves. Julian should see that the gate, as set, is effectively a "no".

5. **The ~130-identity bound is an artifact of its definition.**
   - It defines a department's identity as the triple (signature module, primary challenge, programme).
   - By construction that excludes bestiary composition (C(25,6) ≈ 177,000 six-archetype rosters before modifiers), the secondary module and the Masterpiece assembly.
   - It also counts six programmes, but L §13.2 measured four of them as one room-graph scaffold.
   - The measurable version is the mechanical-twin rate (O(d) < 1, P §9.2) as a function of pool size.

6. **Three enablers are missing from "What it would take" (P §1.6):**
   - **(a) Generated vocabulary:** modules expressed in a DSL and gated by V1–V4 (see M1).
   - **(b) A learned surrogate of S3.** This makes gating cheap enough for a nightly buffer, and later for runtime (see M4). "Surrogate models of simulation" is an open problem in Gravina et al. 2019 (PL F16).
   - **(c) Distillation.** Train an in-browser generator on the corpus the offline pipeline produces (ELM, Moonshine; PS F13, F19). That removes the server, the API key and the non-determinism together.

**Why it matters.** This is the headline question in Julian's brief: "literally infinite … (how? LLMs?)". Julian will see that all five options in D-P1 share the same frozen verbs, and that the evidence was chosen to make (c) look bad, and will then discount the lean even where it is right.

**Resolution.**
- Keep E as the v1 lean.
- Add an option (f), **the mechanical frontier**, sketched in §3 below.
- Restate the evidence: the dud rate is "unmeasured for our pipeline; v1's reason codes measure it".
- Split the v2 gate into p_broken (hard, ≤ 1%) and p_dull (tolerable under optional placement plus the `exit_jump` valve).
- Add the "good new departments per run" table from §4 below, which prices duds and staleness together.
- Replace the 130 bound with a commitment to plot twin rate against pool size.
- Flag that 70% is greater than 0.65.

### MAJOR

#### M1. "Open nouns, closed verbs" closes at the wrong grain, and cites the book for a ban the book does not make

**Where:** direction pillar 1; V contract 1, §6, §11.2, §11.4, D-V8; BK F12 ("(c) is ruled out by p. 300"); S §8.2.

**Error (fix it).** AI&G 2e p. 300 does not rule out generated rules. I checked the extracted text (ch. 9, lines 579–581 and what precedes them). The page says that no attempt to generate *video games* has produced games anyone would want to play. On the same page, it says a combination of LLMs and search-based PCG "has been used to create novel, playable and interesting games" [1135] (GAVEL), and it presents Mechanic Miner as evolving mechanics through simulated playthroughs. The page is about whole-game rule generation. The book's stated obstacle is that rules "are almost impossible to evaluate in isolation" (p. 299). That obstacle disappears for a module inside a fixed, fully simulated game, because the module is evaluated in context by limited agents. Citing p. 300 for a ban will read to Julian, a GAVEL co-author, as a misreading of their own book.

**Design disagreement (present as options).**
- **The vocabulary already makes modules its variation layer.** V §11.2 says archetypes are "the stable layer that mastery rests on; modules are the layer that makes a run feel different". A given signature module appears in only about 49% of runs. Modules are therefore exactly where generating new content costs the least learnability.
- **The design has built the evaluator for rule generation and does not use it.** Its pieces are:
  - V1–V4 (fires, matters, teachable, not degenerate);
  - the micro-arena tests;
  - the layout's structural Intro predicates (`cut`, `window`, `refuge`).

  Together these amount to a fitness function, and they cover the book's own rule proxies: skill gap, learnability and depth.
- **The grain is already too coarse for human authors.** S §8.2 found 11 vocabulary gaps in five hand-worked departments. An LLM compiler will hit C7 (`unmatched`) constantly.

**Options for Julian.**
- **(a) As drafted.** Bespoke module code; the LLM research track writes code and waits behind human-written semantics (V §11.4).
- **(b) A small module DSL from day one.** All 13 launch modules are hand-written in a small event–condition–effect DSL:
  - trigger: the closed V §1.2 set (wake triggers, `period`, `clock`, `alarm`, lux, observed);
  - condition: closed predicates over tiles, species and items;
  - effect: closed set (statuses, surfaces, displacement, spawns, lux, noise);
  - scope;
  - a mandatory telegraph.

  Essential lines and pictograms can then be derived from the DSL form, so T1 becomes partly exact rather than LLM-judged. Cost: an interpreter in the core and up-front engine design. A few modules (`moving_partitions`, `scale_models`) stay bespoke.
- **(c) (b), plus an offline ScriptDoctor/GAVEL loop.**
  - An LLM proposes DSL modules, seeded from the unmatched-concept queue.
  - V1–V4, the micro-arenas and intro-template synthesis (the L §11.2 predicates are already a template language) filter them.
  - Julian reviews.
  - Generated modules first appear as secondary modules, or only inside Temporary Exhibitions, labelled "uncatalogued mechanism".

**Suggested lean.** (b) for v1, as cheap insurance; (c) as the main research track. Re-word pillar 1 as **"closed grammar, open sentences"**: players learn the primitives and how they combine, and departments can say new things in that grammar. Correct BK F12 and V contract 1.

#### M2. QD sits where it cannot work and is missing where it would

**Where:** P §4.1–4.4, D-P3, R6; L §13.4 (persona tier); V §2.4, §5; CS §8.5; D §6.

**What is wrong.**

1. **The department archive is not illumination.**
   - Its axes are categorical.
   - One axis, the programme, is an S1 input (`frame.programme` is `[L·enum]`).
   - The other, the measured primary, is pushed toward the declared value by D's fingerprint gate and P's G10 relabelling.
   - There are at most 38 legal cells, for a 30-department pack fed by about 48 full-gate candidates per batch. No generations run.
   - P itself says "an archive axis that is also a generator input only confirms itself" (§4.1), and keeps the axis anyway.
   - The CI line "QD-score 18.7" (P §4.4) measures nothing.

2. **Evaluation cost rules out iteration.** At D's 1.4–4.8 CPU-hours per department (§8.7), every child of the grammar operator needs a full gate. A thousand evaluations is 1,400–4,800 CPU-hours.

3. **R6 mis-transfers scriptprof.** There the structural operator won on throughput because evaluation (compile plus BFS) was cheap. Here evaluation costs three or four orders of magnitude more than mutation, so operator speed is irrelevant. The measure that matters is archive gain per evaluation.

4. **The defining move of LLM-in-QD is forbidden.** In ELM, GAVEL, QDAIF and scriptprof's LLM mode, the LLM is a *mutation* operator applied to a parent.
   - P bans it: "no department is ever generated from another" (§0, §3.1).
   - The justification is Garden of Forking Paths' 2.6×, but that result concerns hierarchical conditioning *during generation*, not variation under selection.
   - ELMER's abstract points the other way: language mutations preserve more parent fitness at matched behavioural displacement (PS F19).
   - P's own Revise action is already a human-directed language mutation.

5. **Persona fitness for layout elites is noise.** L §13.4 budgets about 2 core-minutes per elite: about 200 plays across 18 persona × skill combinations, or about 11 each. That cannot estimate a skill gap at death rates of 5–10%. Elites chosen by the maximum of a noisy fitness are biased upward (the winner's curse).

**Where QD would work.** In each case evaluation is cheap, candidates are many and descriptors can be continuous.

| Level | Genome | Descriptors | Fitness | Payoff |
|---|---|---|---|---|
| **Encounters and bestiaries** | Archetype × modifier × count compositions (V §2–3) | Damage-source mix × persona dominance | Feasible, and counterplay satisfiable | A Mech-Elites analogue (Charity et al. 2020, PL F18). S2 then picks from pre-validated encounter elites instead of composing blind, which should cut S3 failures. Evaluated in one-room micro-arenas: seconds each, and the harness already exists. |
| **Masterpiece assemblies** | Core × attachments × specials × module (V §2.4) | Phase structure × dominant persona | D §6.3 targets | Answers D-V5's "sameness among Masterpieces that share a core". |
| **Items, keepables and perk builds** | Primitive combinations under the V §5.1 budget; perk sets from CS §8.5 | Which persona's utility a build raises × which challenge type it counters | — | Finds dominant builds before players do; G9 is only a symptom check. Constrained surprise search can find "surprising yet balanced" keepables (Gravina et al., AI&G 2e p. 291, BK F5). |

**Resolution.**
1. Either rename the department archive honestly ("stratified coverage grid") or rebuild it on continuous play descriptors: the six-persona dominance vector, reduced by PCA or a CVT, after Green et al. 2022a (this is P's own option D-P3 (c)). Keep programme and family as quotas.
2. Run MAP-Elites at the three component levels above.
3. Add an LLM mutation operator, at the frame level (language edits) and the spec level. Compare operators per evaluation.
4. Re-evaluate elites on fresh seeds before admitting them, or use structural fitness only for layout elites.

#### M3. The fitness terms and gates invite Goodharting, and new players pay for it

**Where:** P §4.1 (fitness); L §13.4; D §3.9, §5.1, §8.1, §8.6.

**What is wrong.**

1. **Two quality measures are maximised while calibration pins only the median.** Skill differentiation and route divergence are objectives; calibration fixes only the median persona's death rate.
   - Maximising the expert-minus-novice gap with the median fixed pushes novice deaths up.
   - D's gates apply at median skill, except G7 (the Intro). Nothing caps novice lethality.
   - D §3.9 already predicts a 3.5% first-run clear for first-time humans under the lean, and archive selection would push that lower.

   The literature says why this is risky:
   - Liapis et al. 2015 found that persona objectives get gamed: the Monster Killer's variance objective was gamed by dying, with a death ratio of 0.92 (PL F12).
   - Khalifa et al. 2018 advise using metrics as dimensions and "only playability for the fitness" (PL F17). P cites that paper for its feasible/infeasible populations but not for this advice.

2. **The fingerprint is partly circular.** The personas were authored one-to-one with the challenge types: Sneak with guarded, Vandal with swarm, Cautious with artillery, Tourist with hazard, Completist with locks (V §1.1, D §5.1). So "measured, not asserted" is partly baked in by the persona design. Green et al. 2022b found persona labels predictable from mechanic frequencies (PL F15), so the fingerprint is close to a mechanic-frequency classifier. That is fine for placard honesty, but it is weaker evidence than the text claims.

3. **The held-out personas are both extremes.** There are only two, Pacifist and Masher (D §8.1).

**Resolution.**
- Make skill gap and route divergence *band constraints*, for example a novice-to-expert logit gap in [1.2, 2.5].
- Add a per-depth novice gate (novice death ≤ 2.5–3 × p\*(t)). Novices are the only stand-in for first-time players.
- Restrict fitness to playability, with novelty supplied by the descriptors.
- Compute the fingerprint also on held-out *variants* of each persona (perturbed utility weights), so that it survives a change in persona authoring.
- Validate fingerprints against human replays once they exist (M5).

#### M4. The pipeline and difficulty sections disagree on S3's cost and gates, and the pipeline's figures are the optimistic ones

**Where:** P §1.3 ("~34 core-minutes"), §3.6, §3.11, §7.2, §7.4; D §3.6, §8.6–8.7; V §6.1; L §9.2, §11.2.

**Errors (fix them).**

1. **The two sections disagree on cost by 2.5–8×.**
   - P budgets 4,050 playthroughs at 0.5 s, about 34 core-minutes per department.
   - D budgets 21,600 plays, 1.4–4.8 CPU-hours.
   - A 60-department full-gate batch is therefore 84–288 CPU-hours, not "about 4 hours on 8 cores".
   - The 34-minute figure is also what §1.3 uses to argue that runtime gating is impossible.

2. **P's 50 seeds per tier cannot resolve D's tolerance.** At p = 8%, the logit standard error is about 1/√(50 × 0.08 × 0.92) ≈ 0.52, which is above D's 0.35-logit residual tolerance. D's 200 seeds (≈ 0.26) is what the gate needs.

3. **Two gate tables, both numbered from G1, disagree.** P has G1–G10 and D has G1–G12.

   | Gate | P | D |
   |---|---|---|
   | Calibration bound | b in [−0.5, +0.5] | \|b\| ≤ 0.6 |
   | Skill matters | expert − novice survival Δ ≥ 0.15 | logit gap ≥ 1.2 |
   | Choices exist | route divergence > 0.2 | ≥ 0.3 for ≥ 3 persona pairs |
   | Fingerprint | "identifies a primary"; relabel if not | declared primary ranks #1 or #2 |

   The Intro thresholds also differ in three places:
   - V §6.1: the blind persona fails ≥ 30%;
   - D G7: the limited agent fails ≥ 80%;
   - L §11.2: the blind persona is punished in ≥ 80% *and* fails in ≥ 30%.

   The worst-case runner differs too: P G2 uses "minimum kit, reaches an exit", while L §9.2 uses "median build minus one Certificate, ≤ 80% of HP".

4. **The v2 cost table counts tokens only.** At 20 exhibitions a day, compute is 1.4–4.8 CPU-hours each, or 28–96 CPU-hours a day.

5. **Recalibration will dominate operations.** Any change to core rules recalibrates the whole pool: 145 CPU-hours for 30 departments at 1 ms per turn (D §8.7). At 100+ departments plus a buffer of hundreds of exhibitions, this is the main operating cost.

**Resolution.**
- Keep one gate table, owned by D and referenced by P, V and L.
- Recompute P's cost tables from D §8.7, and add a compute line to P §7.4.
- Build a **learned surrogate** that predicts b(d), the fingerprint and gate-pass probability from spec plus layout descriptors, trained on S3 logs. This follows Karavolos et al.'s balance surrogate (AI&G 2e pp. 303–304). Use it as the pre-screen for QD (M2), for the v2 buffer and for the sequencer. Every S3 run already produces its training data, so start logging in that format now.

#### M5. The research programme needs human play data that the design never collects

**Where:** M §14.3 (the run save is deleted on death); M risk 5 ("v1 has no telemetry"); D risk 2; P §9, §10.

**What is wrong.** Most of the research the drafts propose needs human data across runs, and none is collected:
- R1 (learning across runs);
- R4 (what players read from a placard);
- persona validity (D risk 2 says "re-weight personas from telemetry", but there is no telemetry);
- P's v3 promotion by telemetry;
- everything in M6.

P §9.4–9.5 are lab studies, which is good, but they are one-shot. Meanwhile the deterministic core already reduces a run to `{packVersion, coreVersion, runSeed, actions[]}`, a few KB, and M §14.3 deletes it at death.

**Resolution.**
- Keep finished runs locally in a bounded ring.
- Add an opt-in **"Donate this visit to the Archive"**. It fits the fiction. It can be a file export, or one POST to a tiny endpoint.
- Compile research flags into the build, selectable by seed or setting, so that between-subject studies run on the shipped game:
  - tags on or off;
  - honest labels on or off;
  - curated or automated pool;
  - the novelty weight S4.
- Make sure replays contain door offers and choices, label opens and examine actions. They already do, implicitly.

**Decision for Julian:** no data (game only), donated files, or an opt-in endpoint.

#### M6. Experience-driven PCG is rejected against a straw man, while the game produces preference data for free

**Where:** D R12, §2.4 (S2, S4), §2.6, §3.9; BK F17; PL F2.

**What is wrong.**
- **R12's options misdescribe EDPCG.** They are (a) none, (b) novelty, and (c) "skill-adaptive offers or difficulty (EDPCG)". EDPCG (Yannakakis & Togelius 2011) means content driven by a model of player experience, whether subjective, objective or gameplay-based. It is not dynamic difficulty adjustment.
- **The cautions answer something nobody proposed.** "Players dislike adaptation" and the filter bubble (AI&G 2e p. 445) are arguments against hidden in-run adaptation.
- **The design already uses theory-driven experience models without naming them:** the sawtooth p\*(t), after Wen et al.'s rise-and-fall arcs, and S2's EDRL-style moderate-distance weight.

**The missed opportunity.** Every exit lobby asks the player to rank 2–3 placards. Each choice is a ranking over department features:
- challenge icons;
- size;
- family;
- title;
- Masterpiece form;
- reward icons.

That is the pairwise-preference method of EDPCG (Pedersen, Togelius & Yannakakis 2010), which P §9.5 cites for its lab study, available at every choice point of every run. It supports three uses:
1. **An offline experience model.** A Plackett–Luce model over placard features, per player cluster, can drive pool selection, the promotion of Temporary Exhibitions, and a constraint in the archive. The book places EDPCG mainly at runtime (p. 244), so this offline use is a deliberate and novel variant.
2. **Placard diagnostics.** D §8.5 already wants to know which departments nobody picks.
3. **An optional, openly labelled "Curator's Recommendation" door.** One of the three doors is chosen by the player model and marked as such, with S4's novelty weight against the filter bubble. This is legible adaptation, not hidden adaptation.

Caveat: door choice mixes preference with perceived risk and build fit, because perk families follow challenge type. The model needs those as covariates.

**Resolution.**
- Add option (d) to R12: transparent, experience-driven offers.
- Log choices from v1 onward (M5).
- Describe p\*(t) and S2 in the document as theory-driven EDPCG.

### MINOR

#### m1. Citation overreach

Several of these papers are co-authored by Julian, who will check them.

| Where | Claim | What the source or brief supports | Fix |
|---|---|---|---|
| Direction pillar 1; V contract 1; BK F12 | AI&G 2e p. 300 rules out generated mechanics | p. 300 concerns whole video games, and on the same page praises the LLM-plus-search work [1135] and Mechanic Miner | See M1 |
| P §3.2 rule 2 | "This keeps the 2.6× effect" | Garden's 2.6× is entity diversity against a hierarchical baseline inside one game's planning pipeline (PS F11). It says nothing about independent API calls or targeted rounds | Say "motivated by"; drop "keeps" |
| P §3.2 rule 3 | More context produced "pathological convergence" in Picbreeder-VLM | That study used VLM agents acting as users in interactive evolution (PS F11). Applying it to prompt-prefix size is a hypothesis | Label it a hypothesis; measure prefix size against diversity on one batch |
| P §1.3, §1.6 | Word2World's "90% playability"; A Rogue Dream as "the evidence today" | Word2World is 9 of 10 worlds; A Rogue Dream is a 2014 autocomplete system; neither is gated | Give n; say they are not evidence about this pipeline (B1) |
| L §11.2 | Khalifa et al. "recommended limited agents" | PL F18 reports a comparison of three methods, notes that imperfect agents let wrong scenes pass, and that Mechanics Dimensions guarantees a mechanic is possible, not required. No recommendation is reported | Write "compared". Credit the structural predicates for mitigating the false-positive risk |
| D §2.4 S2 | EDRL's "moderate degrees of content diversity", applied to theme distance | EDRL measured diversity between the content of consecutive level segments (BK F9) | Call it an analogy. EDRL itself would point to distance in play descriptors |
| P §9.2, §4.4 | The oatmeal ratio as a contract (≥ 2.0) | BK §3.5 labels it the brief writer's own proposal. It is a between/within dispersion ratio, akin to an ANOVA F or an intraclass correlation | Name the relation and report the ICC alongside. P already says to calibrate the threshold |
| P §3.9 | Revise is "ELMER's idea" | ELMER was read at abstract level only (PS source 26) | Mark it "from the abstract" |
| P §4.1 | Khalifa et al. 2018 cited for feasible and infeasible populations | Same paper: "only playability for the fitness" | See M3 |

#### m2. No draft places its generators in the AI&G 2e taxonomy

Only the BK §3.1 table does, and it needs corrections. Julian asked for inspiration from chs. 7–9, so a corrected table in the final document would be cheap and visible:

| Generator | Necessary / optional | Functional / decorative | Temporality | Testing | Learning | Autonomy | Adaptivity |
|---|---|---|---|---|---|---|---|
| Department pipeline S1–S5 + S3 | Slot necessary; instance optional (necessary once on a run's path) | Spec functional; frame and skin decorative | Offline | Generate-and-test (validators, simulation) | **Trained (LLM) inside an authored grammar (enums) with search (archive): a hybrid of ML and search, as with MarioGPT or GAVEL** (pp. 281, 300) | — | Agnostic |
| S6 curation and Revise | — | — | Offline | Human evaluation | — | **Mixed-initiative at the computer-initiative end of Fig. 7.3** (like interactive-evolution tools); Revise moves it toward the middle | — |
| Labels (S4) | **Necessary** | **Functional** (pillar 2 makes the didactic and tombstone the stat card), so necessary-content correctness applies; minor runtime labels are decorative | Offline | T1 round trip | Trained | — | — |
| Balancer | Necessary | Functional | Offline | Simulation-calibrated | Authored | Autonomous | Agnostic |
| Layout L1–L8 | Necessary | Functional | Runtime | Constructive, plus generate-and-test with repair, reseed and fallback | Authored | Autonomous | Agnostic |
| Layout knob archive | — | — | Offline QD over *generator parameters* | — | — | — | — |
| Sequencer | — | — | Runtime | Constrained search with relaxation | — | — | **S4 adapts to the player's history; it is not experience-driven.** p\*(t) and S2 are theory-driven experience models (M6) |
| Directory and minor-label grammars | Optional | Decorative | Runtime | Constructive; static lexicon checks | Authored | — | — |

#### m3. Data games, the most museal of Julian's lines, go unused

The drafts take "LLMs are today's open data" from PS but never use actual open data. Museum vocabularies are open and fit the tone pillar if they are used only for *materials, processes and object types*, never for cultures, places or people:
- the Getty Art & Architecture Thesaurus;
- the medium and technique fields of the Met, Smithsonian and Cooper Hewitt open-access collections.

They could seed:
- the domain lexicon (currently about 48 hand-authored domains);
- the practice suit of index cards;
- the Directory nouns;
- S1's "named material, named practice" specificity check (BK F8).

This applies Friberger's "perspective change" (PS F1) and Barros's "select and order data to fit genre conventions" (PS F2) directly, and it turns a soft spot (LLM trope gravity) into an experiment: open-data seeds against hand-authored seeds against LLM-only seeding, comparing frame specificity, diversity and curation coefficient. Risk: real-world leakage. Mitigation: a whitelist of AAT facets, plus the existing F5/F6 checks.

#### m4. The curator console selects; it does not collaborate

S6 sits at the computer-initiative end of the mixed-initiative spectrum. Moving it toward Sentient Sketchbook would make it both a better tool and a study. The console could propose:
- targeted variants for archive gaps;
- repair suggestions after a reject;
- live S3 or surrogate feedback while Julian edits.

The study would measure designer agreement and time saved. With active learning, the automated curator (R5) can send Julian the departments it is least sure about, which cuts Julian's hours, P's own binding constraint.

---

## 3. The strongest infinite design, stated fairly

Call it **the Open Stacks**. It is P's Infinite Accession plus the parts that make it mechanically, and not only nominally, infinite.

1. **Persistent shared generation.** A department is generated once on first request, stored forever under a TX number, credited to the visitor who opened it, and replayable by anyone. This is P §1.6, unchanged.
2. **Verbs that grow.** Modules live in a DSL (M1 (b)). An offline LLM-plus-simulation loop proposes new modules continuously, seeded from the unmatched-concept queue and from frames the compiler could not express. V1–V4, the micro-arenas and intro-template synthesis filter them. A generated module enters Temporary Exhibitions first, as an "uncatalogued mechanism", and is accessioned into the Permanent vocabulary only after Julian reviews it. Archetypes stay closed, so mastery still rests on a stable layer.
3. **A cheap gate.** A learned surrogate (M4) pre-screens thousands of candidate specs per night. The full S3 gate runs only on survivors.
4. **An automated curator** trained on Julian's curation log, and judged by agreement with Julian on held-out batches. It uses active learning: Julian audits the uncertain cases and a random sample.
5. **Promotion by players.** Door choices as revealed preference (M6), completion against calibration, and the report button. Promotion into the Permanent Collection and deaccessioning both run as an Acquisitions Committee in the fiction.
6. **Optional placement and an exit valve.** At most one Temporary Exhibition per transition, never in positions 1–2, always with a free `exit_jump`. This is P §7.1, unchanged.
7. **A route to no server.** Once the corpus holds thousands of gated departments, distil an in-browser steerable generator (ELM, Moonshine) and ship the surrogate as the runtime gate. That restores determinism and the single-file convention.

**What it costs:**
- a server and nightly compute (M4);
- Julian's audit hours, falling as the curator improves;
- engine work for the DSL.

**What it yields:** at least four papers (§5, angles 1–4) and a game whose fiction is true.

**What v1 must do to keep this door open.** Each item is cheap, and none changes the v1 game.
- Write the launch modules in the DSL (M1 (b)).
- Log S3 runs in a format a surrogate can learn from.
- Run the fully automated pipeline in shadow next to curation, using the existing blind first look.
- Keep replays and offer donation (M5).
- Log door choices.

## 4. A fairer comparison than the dud table alone

The useful quantity is **good new departments visited per run**: new visits multiplied by (1 − p_dud). This is an illustration under stated assumptions, not a measurement:
- curated pool with N = 30, uniform draws (P §1.5);
- in the hybrid, the player takes 2 Temporary Exhibitions per run;
- p_dud for Temporary Exhibitions is 10–35%; the upper end is P's own implied rejection rate.

| | Run 5 | Run 10 | Run 20 |
|---|---|---|---|
| Curated only (N = 30) | 1.70 | 0.36 | 0.02 |
| Curated + 2 Temporary Exhibitions per run | 3.0–3.5 | 1.7–2.2 | 1.3–1.8 |
| Cost: dud visits per run in the hybrid (minutes each, behind `exit_jump`) | 0.2–0.7 | 0.2–0.7 | 0.2–0.7 |

Julian should decide on this trade-off: about one-and-a-half extra good new departments per run, against a fraction of a dud visit. The current table shows Julian only the dud side.

---

## 5. Research angles worth putting to Julian (ranked)

Each entry gives the question, what the game supplies for free, and the main risk.

1. **Generating rules inside a rich, fixed game.**
   - *Question:* can an LLM-plus-simulation loop generate rule modules that are learnable, matter, and survive a playtest, when evaluated in context by limited agents rather than in isolation?
   - *Free from the game:* V1–V4, the micro-arenas, the Intro predicates, the unmatched-concept queue as a demand signal.
   - *Risk:* DSL design cost; legibility of generated rules.
2. **Generation as curation.**
   - *Question:* can a designer's taste be modelled from the curation log (reason codes, edits, blind first look), and can an active-learning curator cut human review while holding the dud rate? This is also the v2 gate.
   - *Free:* the S6 log.
   - *Risk:* one curator, small n.
3. **Door choices as revealed preferences.**
   - *Question:* does a ranking model over placard features predict choices, enjoyment and return, and does using it offline for pool selection beat novelty alone? This is EDPCG without in-run adaptation.
   - *Free:* every choice point.
   - *Risk:* needs M5; preference is confounded with build fit.
4. **A surrogate of the persona battery.**
   - *Question:* how well do spec and layout descriptors predict calibrated difficulty and challenge fingerprint, and does surrogate-assisted QD find departments that exhaustive S3 would not? This is an open problem in Gravina et al. 2019.
   - *Free:* S3 logs.
   - *Risk:* the surrogate drifts whenever the rules change.
5. **Knowledge transfer under open nouns** (P's R1, extended to generated modules).
   - *Question:* does a closed archetype layer plus a module grammar let players transfer skill to departments they have never seen?
   - *Risk:* needs many players over many runs (M5).
6. **Persona validity against human replays.**
   - *Question:* personas against clones (Holmgård et al. 2014c), fitted on donated replays; does a placard's persona-dominance icon predict what players perceive (R4)?
   - *Risk:* a self-selected sample.
7. **QD at the component level.**
   - *Question:* bestiary and encounter elites (a Mech-Elites analogue), Masterpiece assemblies, and keepable and perk builds (constrained surprise). Does a pre-illuminated component archive raise S2's pass rate and catch degenerate builds before release?
   - *Risk:* little; mainly engineering.
8. **Orchestration through a closed vocabulary, measured.**
   - *Question:* P's R2 and R7. How much decorative drift and label dishonesty do the trace map and T1 catch, and does the oatmeal ratio (as an intraclass correlation) predict human distinctness judgements?
   - *Risk:* the findings may be specific to this vocabulary.
9. **Data games revisited** (m3).
   - *Question:* do open museum vocabularies, transformed, make frames more specific and less trope-bound than LLM-only seeding?
   - *Risk:* real-world leakage.
10. **Distilling the offline pipeline into an in-browser generator** (Moonshine, ELM).
    - *Question:* can the shipped game carry its own infinite generator?
    - *Risk:* quality loss; worth doing only after angles 2 and 4.
11. **Museum layouts as a PCG Benchmark problem.**
    - *Question:* package programme × validation × space-syntax descriptors as a problem for Khalifa et al. 2025's benchmark (PL F24). P's R3 fits here.
    - *Risk:* little; mainly porting work.

## 6. What makes it both a good game and a credible testbed

- **Research content stays out of the player's way.** Experimental departments and generated modules appear only behind opt-in Temporary Exhibition doors, under "uncatalogued" signage. The Permanent Collection stays curated.
- **One data channel** (M5), and ablation flags compiled into the shipped build.
- **Versioning that supports reproducibility.** This is mostly in place: generator versions, pins, digests, stored outputs and seeds. Add surrogate and curator versions.
- **One gate table** with one set of thresholds and stated statistical power (M4).
- **Release the department dataset:** specs, S3 outcomes and curation decisions with reason codes. Curation logs with reasons are rare and valuable.
- **Research instruments never become mechanics.** Placards stay honest and are not used as tests. Novices stay protected from fitness pressure (M3).
