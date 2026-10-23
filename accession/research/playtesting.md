# Automated playtesting for ACCESSION

*A survey of the field (2014–2026) and a layered plan. Written 23 October 2026 for the design discussion with Julian Togelius, against DESIGN.md revision 2 (§9, §10.3, §13, §14, D2, D3, D13). Claims I could not check against their source are marked "(unverified)"; run times are my estimates unless DESIGN.md measured them.*

## The short answer

- **Several approaches, in layers, each answering one question.** Exact checks run on every commit, playing bots nightly, and people decide at the slice gate. The layers check each other (§2.3).
- **In the slice, bots only look for failures**: crashes, soft-locks, unreachable exits, rules that never fire or do not matter. Difficulty and run length come from the human gate (M7); the persona battery follows it, and must first agree with people (DESIGN.md §9.4, §14).
- **Explainability starts in the core.** Every event records its cause, every number carries its interval and seeds, every claim links to a replay of the exact build, and "does the rule matter?" is a rerun with the rule switched off.
- **Language-model agents get one cheap job**: testing whether the labels' words carry the rules to a reader who has only the words, on the questions people answer at the gate.

## 1. The field, 2014–2026

### 1.1 Twelve approaches

| Approach (main sources) | Catches | Misses | Cost | Making results explainable |
|---|---|---|---|---|
| **Rule tests**: unit, property-based, model-based (QuickCheck; fast-check; *Sea of Thieves*; Riot runs about 100,000 tests a day and fixes automation-found bugs eight times faster) | Wrong arithmetic, broken invariants, shown odds ≠ rolled odds, nondeterminism | Fun, clarity, balance | Seconds per commit | Properties written as sentences; failures shrunk to the smallest room and action list that still fails |
| **Scenarios, golden replays, seed catalogues** (Brogue CE diffs a text catalogue of what 25 seeds generate and replays recorded games; Factorio's debug mode saves, loads and compares state every tick) | Unintended changes to rules or generation | Anything unscripted; intended changes need re-approval | Cheap | The diff is the explanation: "seed 14, depth 2: room 412 now holds a second warden" |
| **Random "monkey" and fuzz agents** (NetHack 3.7's `#debugfuzzer`, whose fix log records an out-of-bounds access it found; Wuji, after analysing 1,349 real bugs) | Crashes, hangs, soft-locks, corrupt states | Deep states; anything about experience | Very cheap | Seed and action log, minimised by delta debugging; a replay link |
| **Search agents on a forward model**: MCTS, beam search, Go-Explore (Ticket to Ride agents reached states its rules do not cover) | Dominant strategies, exploits, unwinnable seeds | Human limits: the agents are tireless and far-sighted | High: MCTS agents took 3–280 s per small map in Holmgård et al. (2019) | Annotated exploit replays; the expert's margin over the median persona |
| **Procedural personas; personas as critics** (Holmgård et al. 2014, 2019; Liapis et al. 2015; Mugrai et al. 2019; Barthet et al. 2022; Ariyurek et al. 2023) | Whether each style gets through; which style a level favours | Real people: persona labels from traces matched players' own reports no better than chance (Green et al. 2022b) | 1.4–4.8 CPU-hours per department (DESIGN.md) | Readable utility weights; each decision can print its options and their utility terms |
| **Limited agents** (Khalifa et al. 2019) | Decorative rules; teaching galleries that do not require their rule | Whether people notice the rule | Low: paired runs | Contrastive by construction: "with the rule, X; without it, Y" |
| **RL playtesters** (EA SEED; Ubisoft's CARMI; Rovio with Aalto; Tactile; EA on human-likeness) | Coverage of large 3D spaces; difficulty *rankings* that track players' | Absolute rates; retraining after each rule change; on NetHack, symbolic bots beat deep RL by a wide margin | Hours to days of training | Hard: opaque policies, explained only by heatmaps and replays |
| **Clones learned from human traces** (Holmgård et al. 2014, personas vs clones; King's Candy Crush network 2018, supervised on human moves, not RL; Dungeons & Replicants 2020; EA SEED 2023) | Human-like choices and mistakes | New content: King's network needs retraining when new elements arrive | Data collection | Only if small: a shallow tree reads as rules |
| **Surrogate models** (Karavolos et al. 2021; DSAGE 2022) | Cheap pre-screening; which features drive outcomes | Content unlike the training data | Thousands of logged runs | Models that are their own explanation: regression, shallow trees, additive models (Rudin 2019; Caruana et al. 2015) |
| **LLM agents and playtesters** (§1.2) | Whether text communicates rules; bug reports; rough difficulty rankings | Long play; human perception; reproducibility | Cents to dollars per play | Rationales read well but can be unfaithful to what drove the answer (Turpin et al. 2023) |
| **Visual, UI, accessibility** (Playwright screenshots; axe-core; WCAG 2.2; colour-vision simulation) | Layout regressions at 390 px, colours that collapse for colour-blind players, small tap targets | Whether a screen reads well; vision models miss glitches (GPT-4V averaged about 41% on GlitchBench; see also VideoGameQA-Bench 2025) | Minutes per commit | Before, after and difference images; contact sheets as colour-blind viewers see them |
| **Telemetry and human playtests** (*Slay the Spire*'s metrics-driven balancing; Glyph's views of strategies) | What people do, read and misunderstand; real minutes | Small samples early; self-selected donors | People's time | Death maps, drop-off funnels, a replay per death, quotes |

Developers still rely almost entirely on manual play-testing (Politowski et al. 2021), and a September 2026 survey still calls automated testing less established (Luo et al. 2026).

### 1.2 What changed in 2024–2026

- **LLM agents play, but not long games well.** On BALROG (ICLR 2025), the best NetHack progression on the leaderboard is 13.2% (an entry of 18 September 2026). NetPlay (CoG 2024) followed detailed instructions but struggled with open goals, and a simple rule-based agent matched it. A hobbyist reports the first LLM-agent ascension in September 2026, after twelve days, with human help (unverified).
- **They rank difficulty rather than measure it.** Xiao & Yang's agents played Wordle and *Slay the Spire* worse than people, but their difficulty order correlated with players'. TextGames found people and LLMs disagree about what is easy. RL agents showed the same pattern earlier (Kristensen et al. 2020).
- **LLMs as QA engineers.** TITAN tests an MMORPG (95% task completion, four new bugs); SMART reads code diffs to steer RL toward changed code; on GBQA (124 verified bugs in 30 games) the best model found about 48%.
- **Rules and comprehension.** SPRING played Crafter from the game's paper; Learn2Play (October 2026) finds agents learn novel rules but struggle to use them; MeepleLM (ACL 2026) critiques rulebooks per player type. I found no study testing LLM-written explanations of mechanics on players; the nearest work builds tutorials from rule graphs (AtDelfi 2018) or manuals from Ludii (2021).
- **Industry** sells bot and LLM-agent QA (modl.ai, nunu.ai), with vendor-reported savings (unverified).

### 1.3 Explainable results for designers

Zhu et al. (2018) argued that AI for designers must be judged by usability and practical interpretability, not by its algorithms; in Guzdial et al. (2018), a generator explained through design patterns did better with five expert designers than one without. The nearest newer evidence is EA SEED's study in which industry experts trained testing agents by demonstration and judged them useful (Sestini et al. 2023). I found no 2022–2026 study of how designers understand playtesting results: an open gap, and a paper ACCESSION could produce. Eight rules apply to every layer:

1. **Exact causes.** Every damage and wake event records its chain: attacker, special, trigger, rule module.
2. **Contrastive questions.** People ask "why this rather than that" (Miller 2019). "Would the persona have survived without the rule?" is a rerun of the same seeds with the rule off, a but-for test in Halpern and Pearl's sense. It stays clean only if random streams are keyed per actor too, so removing one thing does not reshuffle the rest: worth adding to the determinism contract.
3. **Every number with its n, interval and seeds**; comparisons paired on the same seeds.
4. **Every claim links to a replay of the build that made it.** Replays break across core versions (default 41), so every tagged build stays hosted at its own path.
5. **Replays chosen by rule**, each also a short GIF: the commonest death, the median visit, the fastest exit, the strangest outlier.
6. **Readable models.** Reports print persona weights ("Looter: +1 per case opened, −5 for dying, normalised by cases"); surrogates are regressions, shallow trees or additive models.
7. **Reports written from numbers by templates.** A language model may help word a template once; it never writes a number.
8. **Expressive-range plots** for generators and bot outcomes, with metric pairs chosen on purpose (Smith & Whitehead 2010; Withington & Tokarchuk 2023).

## 2. The plan for ACCESSION

### 2.1 Ten layers

| # | Layer | When | Question | Output for people | Run time, 4 cores |
|---|---|---|---|---|---|
| 1 | Rules, determinism, golden scenarios | M0 on, every commit | Does each rule do exactly what its label says, on every engine? Did a change alter anything unintended? | Pass/fail sentences; smallest failing room as ASCII with a replay; text diff of the seed catalogue | 1–3 min, three browsers included |
| 2 | Monkeys, soak, save fuzzing | M0–M5 | Can anything crash, hang, soft-lock or lose a save? | A crash card: seed, minimised actions, first bad turn, replay | 1–2 min per commit; 20–40 min nightly |
| 3 | Layout validators, worst-case runner | M1 | Is every plan legal and survivable in the worst case? | Fallback rate; failing plans as ASCII, problem tiles marked | About 10 s (3 × 1,000 seeds at the measured 7–9 ms) |
| 4 | Screens and accessibility | M2 on | Does every screen fit, read and stay distinguishable on a phone? | Diff sheets, colour-blind sheets, small targets listed | 2–4 min |
| 5 | Paired scripted bots | M3–M4 | Does each archetype have counterplay? Does each rule fire, and matter? | Paired differences with intervals, a sentence each; replays of the largest gaps | 2–4 min for the slice |
| 6 | Expert search probe | M4 on, nightly | What could a tireless player do that we would not want? Which seeds cannot be won? | Annotated exploit replays; the expert's margin | 0.5–2 h nightly |
| 7 | LLM reader probe | M4 on; compared at M7 | Do the labels' words carry the rule to a reader with only the words? | Item table, LLM against people; stored transcripts | Minutes; under $1 (Haiku 5.5) to about $30 (Opus 5.5) per sweep |
| 8 | Human slice gate | M7 | Do strangers read, understand wakes and finish in time? | A page per player; a table per department; a replay per death | About 1 h per player |
| 9 | Persona battery and calibration | After the gate | Is each department as hard as intended, for whom, and is its placard honest? | The department report (§2.2), dashboard, chosen replays | 0.35–1.2 h per department; canary under 3 min; nightly whole runs 1–3 h (DESIGN.md) |
| 10 | Telemetry, clones, surrogate | v1 on | Do bots still agree with people? Which spec features drive difficulty? | Agreement scores; surrogate terms in plain words | Minutes to fit; months to collect |

**Notes.**
- **Layer 1** carries M0's hash test and M3's odds and telegraph tests. fast-check drives `step()` with random command sequences against small reference models (hit table, telegraph damage, pips) and shrinks failures. The design's worked examples ("the doorstep drowns at high water") become scenarios (an ASCII room, scripted actions, expected events) that double as documentation and as layer 7's items.
- **Layer 2** plays randomly, weighted toward breaking glass, throwing and saving; checks invariants each step; and flags a soft-lock when no exit is reachable and nothing changes for N turns. A Playwright monkey taps and types at random. Every crash becomes a golden replay.
- **Layer 5** is the feasibility review's `bot.js` (explorer, fighter, sneak-lite, aware and blind pairs); M3's naive bot can serve as the held-out Masher. Each comparison adds a third run with the rule off.
- **Layer 6** runs beam search and MCTS with an undo log rather than clones, plus a Go-Explore-style archive (room × health band × clock stage) that later starts personas in deep states.
- **Layer 7** asks multiple-choice and predict-what-happens questions built from layer-1 scenarios, so the simulation computes the answer key and no model grades another. Text only (BALROG found images hurt); five repeats per item; a second run with the Behaviour line deleted measures what that line carries (D10). A few think-aloud plays of each teaching gallery (about $0.10 on Haiku, $3–5 on Opus) find misleading labels. Costs use DESIGN.md §12.3's prices.
- **Layer 8** is M7 plus layer 7's items, asked after each department. **Layer 9** is DESIGN.md §9.4; with three slice departments a rank correlation means nothing, so its first agreement test compares death causes and encounters.
- **Layer 10** uses D3's donated replays: shallow-tree clones against personas (research angle 6) and a readable surrogate (angle 4) that pre-screens and explains, never ships.

### 2.2 A department report (illustrative numbers)

> **S.9 Animals Not Yet Seen by the Day Staff, depth 2, build 0.7.3, 200 seeds.** The median simulated visitor died in 6% of visits (target 5%; 95% interval 3–10%). Most deaths (11 of 17) came from a Long-Necked Grazer reaching the visitor from a dark bay, where it could move unobserved. The rule matters: on the same seeds with it switched off, deaths fell to 2%. The Sneak did best, leaving with 71% of its health on average, and the Vandal worst, which fits the Guarded placard. The Pacifist got out alive in 93% of visits. A typical visit took 240 turns, about four and a half minutes at the 53 turns per minute measured at the gate. Replays: commonest death #37, median visit #88, fastest exit #112, strangest outlier #9.

### 2.3 How the layers check each other

- **People against ground truth**: answers to "why did that wake?" scored against the logged cause, per trigger.
- **LLM against people, item by item.** Both wrong: the words fail. LLM right, people wrong: the words work but people did not see them (strip, pictogram, light). People right, LLM wrong: usually the rendering; ignore unless it repeats.
- **Personas against people**: death causes, encounters and turns per department at the gate; department rankings once replays are donated.
- **Blind bot (layer 5) against limited persona (layer 9)**: both ask whether the rule matters, and must agree in sign.
- **Expert against personas**: a large gap means an exploit or a weak persona; the replay says which.
- **Worst-case runner against Pacifist**: both claim you can leave alive.
- **Surrogate against battery** on held-out departments, its error published.
- **Run-length model against the stopwatch** after every human playtest.

### 2.4 Autosave

DESIGN.md default 41 keeps two alternating checksummed snapshots. Four tests:

1. **Round trip.** For 10,000 states sampled from layers 2 and 5, `hash(load(save(s))) = hash(s)`, and 500 more random actions from loaded and original state give identical events (Factorio's save–load–compare).
2. **Kill at a random point.** In Playwright on Chromium, WebKit and Firefox, a bot plays and the page is killed at a random moment, mid-write included, without unload handlers. A storage shim also fails, truncates or corrupts the k-th write, sweeping k across a scripted session as SQLite's crash tests move their failure point. After reload, one slot passes its checksum, the state equals the last committed snapshot (hash recorded at commit), meta loses at most the current department, and the player reads a plain sentence: "Your last save was damaged; you resume at the Stair Hall."
3. **Save on `visibilitychange` to hidden**, and test that this path suffices alone: `pagehide` and `unload` often do not fire on mobile (Chrome's Page Lifecycle documentation).
4. **Version and export.** An older `coreVersion` snapshot takes the documented path (M5); the visitor's card round-trips for 10,000 random meta states and rejects one-character typos.

Round trips take about a minute, 200 browser kills 5–10 minutes. WebKit's eviction cannot be simulated, so one real-iPhone check per release stays manual.

### 2.5 Run length

This report was asked to check a 30-minute run; DESIGN.md says 50–75 minutes for v1, and the feasibility review about 20–30 for the slice's three departments. So the check reads its target from the numbers-of-record table:

1. **A three-term time model fitted at M7**: minutes = turns ÷ turns per minute + labels opened × seconds per label + fixed hall-and-door time. This Keystroke-Level-Model-style estimate (Card, Moran & Newell 1980) reads as plain facts ("a label costs 9 seconds"). If its error on gate sessions exceeds about 20%, add path taps.
2. **Nightly prediction.** The explorer bot, later the median persona, emits the same counts over 200 seeded runs; the report gives the median, the 10th–90th percentiles and the share of visits that ran past the bell.
3. **Gates.** Fail if the median leaves 30 ± 5 minutes or the 90th percentile exceeds 45; warn if the median moves 10% in a week, naming the department that moved most. Refit after every human playtest and publish predicted against actual.

## 3. Pitfalls

1. **Bots misjudge people, worst for stealth.** A bot knows every pip and sightline; a person sees a ring and three pips, and misreads them. Bot stealth overstates human stealth, yet a weak Sneak makes Guarded and Darkness departments look too hard, so calibration nerfs them (the feasibility review's "Goodharting in reverse"). Mitigations: bots see only what the screen shows; human numbers first; agreement with people as the harness's first test; a competence table per bot, as `absorb-this/tools/README.md` has. Whether an unseen route exists should be computed, as Tremblay et al.'s stealth-analysis tools do.
2. **Content overfitted to bots.** Departments tuned until six personas pass become departments for those six. Mitigations: the held-out Pacifist and Masher, perturbed-weight variants, seed sets rotated weekly, and people deciding anything about feel.
3. **Goodhart effects.** In Liapis et al. (2015), maximising a persona's utility produced levels without decisions, and a variance objective was gamed by dying; Lehman et al. (2020) and Dharna et al. (2026) collect many such cases. Mitigations: playability as the only fitness (default 36), other terms as bands, death caps, and a weekly look at replays from the extremes of anything a search optimised.
4. **LLM cost and nondeterminism.** Current Claude models reject sampling parameters and take no seed, and "deterministic" settings still vary: Atil et al. saw accuracy swing by up to 15% between runs, and Thinking Machines got 80 different completions from 1,000 identical temperature-0 requests. Store every transcript (prompt, model id, date, usage, reply), report rates over five or more repeats with intervals, never gate a commit on a model, and rerun the probe whenever the model changes.
5. **Flaky tests.** The simulation is deterministic, so flakiness comes from statistical gates near a threshold, screenshots across machines (Playwright warns that rendering varies with OS, version and hardware), timing and language models. Fix seed sets so a commit always gets the same answer; near a threshold, add seeds sequentially with stated error rates, as Stockfish's Fishtest does with SPRT, instead of rerunning until green. Make baselines in one pinned container; quarantine and count flaky tests rather than retrying silently (Luo et al. 2014; Parry et al. 2022).
6. **Explanations that mislead.** A fluent rationale is not a cause (Turpin et al. 2023), and explanations of black boxes only approximate them (Rudin 2019). Hence exact cause chains, counterfactual reruns and readable models.

## 4. What I could not verify

- The September 2026 LLM NetHack ascension (one blog post); vendor claims by modl.ai and nunu.ai.
- The GDC talks on *Sea of Thieves* and *Slay the Spire* beyond their published descriptions; what Brogue CE's replay test checks beyond the exit code.
- Any 2022–2026 empirical study of explanations for level designers (none found).
- Run times not marked as measured, and the LLM costs (DESIGN.md's prices, which match the API reference cached on 6 October 2026).
- Which run length is the target: the 30 minutes asked for here, or DESIGN.md's 50–75.

## Sources

**Rule tests, replays, fuzzing, saves, flakiness**
- Claessen & Hughes 2000. QuickCheck. ICFP. https://doi.org/10.1145/351240.351266
- fast-check, model-based testing. https://fast-check.dev/docs/advanced/model-based-testing/
- Masella 2019. Automated testing of gameplay features in *Sea of Thieves*. GDC. https://gdcvault.com/play/1026366/Automated-Testing-of-Gameplay-Features
- Merrill 2016. Automated testing for *League of Legends*. Riot Games. https://www.riotgames.com/en/news/automated-testing-league-legends
- Brogue CE regression tests (seed catalogues, recorded games). https://github.com/tmewett/BrogueCE/tree/master/test
- Factorio Friday Facts #55 (save, load and check every tick). https://factorio.com/blog/post/fff-55 ; heavy mode: https://forums.factorio.com/53851
- NetHack 3.7 fixes log (`#debugfuzzer`). https://github.com/NetHack/NetHack/blob/NetHack-3.7/doc/fixes3-7-0.txt
- Zheng et al. 2019. Wuji. ASE. https://doi.org/10.1109/ASE.2019.00077
- Zeller & Hildebrandt 2002. Simplifying and isolating failure-inducing input. IEEE TSE. https://doi.org/10.1109/32.988498
- SQLite. How SQLite is tested (crash and I/O-error tests). https://www.sqlite.org/testing.html
- Chrome. Page Lifecycle API. https://developer.chrome.com/docs/web-platform/page-lifecycle-api
- Luo et al. 2014. An empirical analysis of flaky tests. FSE. https://doi.org/10.1145/2635868.2635920
- Parry et al. 2022. A survey of flaky tests. ACM TOSEM. https://doi.org/10.1145/3476105
- Stockfish Fishtest FAQ (SPRT). https://github.com/official-stockfish/fishtest/wiki/Fishtest-faq
- Politowski, Petrillo & Guéhéneuc 2021. A survey of video game testing. AST. https://arxiv.org/abs/2103.06431
- Luo et al. 2026. AI for games in the foundation model era. https://arxiv.org/abs/2609.16679

**Search agents, personas, limited agents**
- de Mesentier Silva, Lee, Togelius & Nealen 2017. AI-based playtesting of contemporary board games. FDG. https://doi.org/10.1145/3102071.3102105
- Ecoffet et al. 2021. First return, then explore (Go-Explore). Nature. https://www.nature.com/articles/s41586-020-03157-9
- Holmgård, Liapis, Togelius & Yannakakis 2014. Personas versus clones for player decision modeling. ICEC. http://julian.togelius.com/Holmgard2014Personas.pdf
- Holmgård, Green, Liapis & Togelius 2019. Automated playtesting with procedural personas through MCTS with evolved heuristics. IEEE ToG. https://arxiv.org/abs/1802.06881
- Liapis, Holmgård, Yannakakis & Togelius 2015. Procedural personas as critics for dungeon generation. EvoApplications. http://julian.togelius.com/Liapis2015Procedural.pdf
- Mugrai, de Mesentier Silva, Holmgård & Togelius 2019. Automated playtesting of matching tile games. CoG. https://arxiv.org/abs/1907.06570
- Green et al. 2022b. Predicting personas using mechanic frequencies and game state traces. CEC. https://arxiv.org/abs/2203.13351
- Barthet, Khalifa, Liapis & Yannakakis 2022. Generative personas that behave and experience like humans. FDG. https://arxiv.org/abs/2209.00459
- Ariyurek, Sürer & Betin-Can 2023. Playtesting: what is beyond personas. IEEE ToG. https://arxiv.org/abs/2107.11965
- Khalifa, Green, Barros & Togelius 2019. Intentional computational level design. GECCO. https://arxiv.org/abs/1904.08972
- Tremblay, Torres & Verbrugge 2014. An algorithmic approach to analyzing combat and stealth games. CIG. https://www.cs.mcgill.ca/~jtremb59/Papers/CIG-2014-JTremblay.pdf

**Reinforcement and imitation learning**
- Bergdahl, Gordillo, Tollmar & Gisslén 2020. Augmenting automated game testing with deep RL. CoG. https://arxiv.org/abs/2103.15819
- Gordillo, Bergdahl, Tollmar & Gisslén 2021. Improving playtesting coverage via curiosity driven RL agents. https://arxiv.org/abs/2103.13798
- Le Pelletier de Woillemont, Labory & Corruble 2022. Automated play-testing through RL based human-like play-styles generation. AIIDE. https://arxiv.org/abs/2211.17188
- Roohi et al. 2020. Predicting game difficulty and churn without players. CHI PLAY. https://arxiv.org/abs/2008.12937
- Kristensen, Valdivia & Burelli 2020. Estimating player completion rate in mobile puzzle games using RL. CoG. https://arxiv.org/abs/2306.14626
- Zhao et al. 2020. Winning isn't everything. IEEE ToG. https://arxiv.org/abs/1903.10545
- Hambro et al. 2022. Insights from the NeurIPS 2021 NetHack Challenge. https://arxiv.org/abs/2203.11889
- Gudmundsson et al. 2018. Human-like playtesting with deep learning. CIG. https://www.gwern.net/doc/reinforcement-learning/imitation-learning/2018-gudmundsson.pdf
- Pfau, Liapis, Volkmar, Yannakakis & Malaka 2020. Dungeons & Replicants. CoG. https://www.antoniosliapis.com/papers/dungeons_and_replicants_automated_game_balancing_via_deep_player_behavior_modeling.pdf
- Sestini et al. 2023. Towards informed design and validation assistance in computer games using imitation learning. CoG. https://arxiv.org/abs/2208.07811
- Ahlberg, Sestini, Tollmar & Gisslén 2023. Generating personas for games with multimodal adversarial imitation learning. CoG. https://arxiv.org/abs/2308.07598

**Surrogates, explainability, visualisation**
- Karavolos, Liapis & Yannakakis 2021. A multifaceted surrogate model for search-based PCG. IEEE ToG. https://ieeexplore.ieee.org/abstract/document/8778792
- Bhatt, Tjanaka, Fontaine & Nikolaidis 2022. Deep surrogate assisted generation of environments. NeurIPS. https://arxiv.org/abs/2206.04199
- Rudin 2019. Stop explaining black box models for high stakes decisions. Nature Machine Intelligence. https://doi.org/10.1038/s42256-019-0048-x
- Caruana et al. 2015. Intelligible models for healthcare. KDD. https://doi.org/10.1145/2783258.2788613
- Zhu, Liapis, Risi, Bidarra & Youngblood 2018. Explainable AI for designers. CIG. https://research.tudelft.nl/en/publications/explainable-ai-for-designers-a-human-centered-perspective-on-mixe/
- Guzdial, Reno, Chen, Smith & Riedl 2018. Explainable PCGML via game design patterns. EXAG. https://arxiv.org/abs/1809.09419
- Miller 2019. Explanation in artificial intelligence: insights from the social sciences. Artificial Intelligence. https://arxiv.org/abs/1706.07269
- Halpern & Pearl 2005. Causes and explanations: a structural-model approach. https://arxiv.org/abs/cs/0011012
- Smith & Whitehead 2010. Analyzing the expressive range of a level generator. PCG workshop. https://www.pcgworkshop.com/archive/smith2010analyzing.pdf
- Withington & Tokarchuk 2023. The right variety. FDG. https://arxiv.org/abs/2304.02366
- Nguyen, Seif El-Nasr & Canossa 2015. Glyph. FDG. https://arxiv.org/abs/2106.13742
- Giovannetti 2019. *Slay the Spire*: metrics driven design and balance. GDC. https://www.gdcvault.com/browse/gdc-19/play/1025731
- Card, Moran & Newell 1980. The keystroke-level model. CACM. https://doi.org/10.1145/358886.358895

**Language models**
- Paglieri et al. 2025. BALROG. ICLR. https://arxiv.org/abs/2411.13543 ; leaderboard https://balrogai.com/
- Jeurissen et al. 2024. Playing NetHack with LLMs (NetPlay). CoG. https://arxiv.org/abs/2403.00690
- Claimed LLM NetHack ascension, 21 September 2026 (blog). https://kenforthewin.github.io/blog/posts/llm-nethack-ascension/
- Xiao & Yang 2024. LLMs may not be human-level players, but they can be testers. https://arxiv.org/abs/2410.02829
- TextGames 2025. https://arxiv.org/abs/2502.18431
- Wang et al. 2025. TITAN: LLM agents for automated video game testing. https://arxiv.org/abs/2509.22170
- Mu et al. 2025. SMART: coverage-aware playtesting with LLM-guided RL. https://arxiv.org/abs/2512.12706
- Jiang, Chen & Chen 2026. GBQA. https://arxiv.org/abs/2604.02648
- Li et al. 2026. MeepleLM. https://arxiv.org/abs/2601.07251
- Li et al. 2026. Learn2Play Bench. https://arxiv.org/abs/2610.08215
- Wu et al. 2023. SPRING. NeurIPS. https://arxiv.org/abs/2305.15486
- Green et al. 2018. AtDelfi. FDG. https://arxiv.org/abs/1807.04375
- Stephenson, Piette, Soemers & Browne 2021. Automatic generation of board game manuals. ACG. https://arxiv.org/abs/2109.09507
- Turpin, Michael, Perez & Bowman 2023. Unfaithful explanations in chain-of-thought prompting. NeurIPS. https://arxiv.org/abs/2305.04388
- Atil et al. 2024. Non-determinism of "deterministic" LLM settings. https://arxiv.org/abs/2408.04667
- He 2025. Defeating nondeterminism in LLM inference. Thinking Machines. https://thinkingmachines.ai/blog/defeating-nondeterminism-in-llm-inference/
- modl.ai https://modl.ai ; nunu.ai https://www.ycombinator.com/companies/nunu-ai

**Screens and accessibility**
- Playwright visual comparisons. https://playwright.dev/docs/test-snapshots
- axe-core. https://github.com/dequelabs/axe-core
- WCAG 2.2, 2.5.8 Target Size (Minimum). https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- Machado, Oliveira & Fernandes 2009. Simulation of colour vision deficiency. IEEE TVCG. https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html
- Taesiri et al. 2024. GlitchBench. CVPR. https://arxiv.org/abs/2312.05291
- Taesiri et al. 2025. VideoGameQA-Bench. NeurIPS. https://asgaardlab.github.io/videogameqa-bench/

**Goodhart effects**
- Lehman et al. 2020. The surprising creativity of digital evolution. Artificial Life. https://arxiv.org/abs/1803.03453
- Dharna et al. 2026. AI finds a way. https://arxiv.org/abs/2608.23875
