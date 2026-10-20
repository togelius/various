# Levels, dungeons, QD-PCG, experience-driven PCG, procedural personas and generator evaluation

*Research brief for the museum roguelike. Topic: Julian Togelius's work and close co-author work on level/dungeon generation, search-based and quality-diversity PCG, EDPCG, procedural personas, and evaluating generators. Compiled 2026-10-20.*

**Bottom line.** The literature points to the following architecture. Departments are **specs** (theme plus mechanical parameters) that are curated and tuned **offline** with persona simulation and a constrained MAP-Elites archive. Each run turns them into **layouts online** with a fast, guaranteed pipeline: a visit-plan graph, then a typology-specific floor plan, then rule-based "curation" (furnishing), then cheap validation, which includes a worst-case runner check. Every generator that touches a department reads one shared department schema. Personas should be cheap utility agents with skill handicaps. MCTS personas are useful as a small-sample upper bound, but the published runtimes rule them out for bulk use. "Type of challenge" can be measured as *which persona dominates* a department. That measure gives a QD axis and a sequencing rule.

---

## 1. Sources actually read

Legend: **[F]** most or all of the text; **[M]** abstract plus method and results; **[A]** abstract and conclusions (plus specific passages cited).

**Frameworks and surveys**
1. Togelius, Yannakakis, Stanley & Browne (2011). *Search-based procedural content generation: a taxonomy and survey.* IEEE TCIAIG 3(3):172–186. http://julian.togelius.com/Togelius2011Searchbased.pdf **[M]** (§II, §III, §V)
2. Yannakakis & Togelius (2011). *Experience-driven procedural content generation.* IEEE Trans. Affective Computing 2(3):147–161. http://julian.togelius.com/Yannakakis2011Experiencedriven.pdf **[M]** (§2, §5, §6)
3. Togelius, Champandard, Lanzi, Mateas, Paiva, Preuss & Stanley (2013). *Procedural content generation: goals, challenges and actionable steps.* In *Artificial and Computational Intelligence in Games*, Dagstuhl Follow-Ups 6:61–75. http://julian.togelius.com/Togelius2013Procedural.pdf **[M]**
4. Togelius, Justinussen & Hartzen (2012). *Compositional procedural content generation.* FDG Workshop on PCG. http://julian.togelius.com/Togelius2012Compositional.pdf **[F]**
5. Shaker, Togelius & Nelson (2016). *Procedural Content Generation in Games.* Springer. http://pcgbook.com. Ch. 3 (Shaker, Liapis, Togelius, Lopes & Bidarra, constructive dungeons) **[M]**; ch. 5 (Togelius, Shaker & Dormans, grammars, §5.5 missions/spaces) **[M]**; ch. 8 (Nelson & Smith, ASP) **[M]**; ch. 12 (Shaker, Smith & Yannakakis, evaluating generators) **[F]**.
6. Yannakakis & Togelius (2025). *Artificial Intelligence and Games*, 2nd ed. Springer. §8.3 (pp. 270–272), §9.1 (pp. 287–289), §9.7 (pp. 305–309) **[M]**
7. Risi & Togelius (2020). *Increasing generality in machine learning through procedural content generation.* Nature Machine Intelligence 2(8):428–436. https://arxiv.org/abs/1911.13071 **[A]**
8. Justesen, Rodriguez Torrado, Bontrager, Khalifa, Togelius & Risi (2018). *Illuminating generalization in deep reinforcement learning through procedural level generation.* NeurIPS Deep RL Workshop. https://arxiv.org/abs/1806.10729 **[A]**
9. Summerville, Snodgrass, Guzdial, Holmgård, Hoover, Isaksen, Nealen & Togelius (2018). *Procedural content generation via machine learning (PCGML).* IEEE Trans. Games 10(3):257–270. https://arxiv.org/abs/1702.00539 **[A]**
10. Liu, Snodgrass, Khalifa, Risi, Yannakakis & Togelius (2021). *Deep learning for procedural content generation.* Neural Computing and Applications 33(1):19–37. https://arxiv.org/abs/2010.04548 **[A]**

**Caves, patterns, dungeons**
11. Johnson, Yannakakis & Togelius (2010). *Cellular automata for real-time generation of infinite cave levels.* PCG Workshop at FDG 2010. http://julian.togelius.com/Johnson2010Cellular.pdf **[F]**
12. Dahlskog & Togelius (2014a). *Procedural content generation using patterns as objectives.* EvoApplications 2014, 325–336. http://julian.togelius.com/Dahlskog2014Procedural.pdf **[A]**
13. Dahlskog & Togelius (2014b). *A multi-level level generator.* IEEE CIG 2014, 389–396. http://julian.togelius.com/Dahlskog2014Multi.pdf **[F]**
14. Dahlskog, Björk & Togelius (2015). *Patterns, dungeons and generators.* FDG 2015. http://julian.togelius.com/Dahlskog2015Patterns.pdf **[F]**
15. Green, Khalifa, Alsoughayer, Surana, Liapis & Togelius (2019). *Two-step constructive approaches for dungeon generation.* FDG 2019 PCG Workshop. https://arxiv.org/abs/1906.04660 **[F]**
16. Alvarez, Dahlskog, Font & Togelius (2019). *Empowering quality diversity in dungeon design with interactive constrained MAP-Elites.* IEEE CoG 2019. https://arxiv.org/abs/1906.05175 **[M]**. Also Alvarez et al. (2022), IEEE Trans. Games 14(2):202–211, https://arxiv.org/abs/2003.03377 **[A]**

**Map sketches, novelty, diversity**
17. Liapis, Yannakakis & Togelius (2013a). *Sentient Sketchbook: computer-aided game level authoring.* FDG 2013, 213–220. http://julian.togelius.com/Liapis2013Sentient.pdf **[F]**
18. Liapis, Yannakakis & Togelius (2013b). *Towards a generic method of evaluating game levels.* AIIDE 2013, 30–36. http://julian.togelius.com/Liapis2013Towards.pdf **[M]**
19. Liapis, Yannakakis & Togelius (2015). *Constrained novelty search: a study on game content generation.* Evolutionary Computation 23(1):101–129. http://julian.togelius.com/Liapis2014Constrained.pdf **[A]**
20. Preuss, Liapis & Togelius (2014). *Searching for good and diverse game levels.* IEEE CIG 2014. http://julian.togelius.com/Preuss2014Searching.pdf **[A]**
21. Togelius, Preuss, Beume, Wessing, Hagelbäck, Yannakakis & Grappiolo (2013). *Controllable procedural map generation via multiobjective evolution.* Genetic Programming and Evolvable Machines. http://julian.togelius.com/Togelius2013Controllable.pdf **[A]**

**Procedural personas (MiniDungeons)**
22. Holmgård, Liapis, Togelius & Yannakakis (2014a). *Generative agents for player decision modeling in games.* FDG 2014. http://julian.togelius.com/Holmgard2014Generative.pdf **[M]**
23. Holmgård et al. (2014b). *Evolving personas for player decision modeling.* IEEE CIG 2014. http://julian.togelius.com/Holmgard2014Evolving.pdf **[A]**
24. Holmgård et al. (2014c). *Personas versus clones for player decision modeling.* ICEC 2014, 159–166. http://julian.togelius.com/Holmgard2014Personas.pdf **[A]**
25. Holmgård et al. (2015). *Monte-Carlo tree search for persona based player modeling.* AIIDE Workshop on Player Modeling. http://julian.togelius.com/Holmgard2015Monte.pdf **[A]**
26. Liapis, Holmgård, Yannakakis & Togelius (2015). *Procedural personas as critics for dungeon generation.* EvoApplications 2015, 331–343. http://julian.togelius.com/Liapis2015Procedural.pdf **[F]**
27. Holmgård, Green, Liapis & Togelius (2019). *Automated playtesting with procedural personas through MCTS with evolved heuristics.* IEEE Trans. Games. https://arxiv.org/abs/1802.06881 **[M]**
28. Green, Khalifa, Charity & Togelius (2022a). *Persona-driven dominant/submissive map (PDSM) generation for tutorials.* FDG 2022. https://arxiv.org/abs/2204.05217 **[M]**
29. Green, Khalifa, Charity, Bhaumik & Togelius (2022b). *Predicting personas using mechanic frequencies and game state traces.* IEEE CEC 2022. https://arxiv.org/abs/2203.13351 **[A]**

**Quality-diversity PCG**
30. Gravina, Khalifa, Liapis, Togelius & Yannakakis (2019). *Procedural content generation through quality diversity.* IEEE CoG 2019. https://arxiv.org/abs/1907.04053 **[F]**
31. Khalifa, Lee, Nealen & Togelius (2018). *Talakat: bullet hell generation through constrained MAP-Elites.* GECCO 2018, 1047–1054. https://arxiv.org/abs/1806.04718 **[M]**
32. Khalifa, Green, Barros & Togelius (2019). *Intentional computational level design.* GECCO 2019, 796–803. https://arxiv.org/abs/1904.08972 **[M]**
33. Charity, Green, Khalifa & Togelius (2020). *Mech-Elites: illuminating the mechanic space of GVG-AI.* FDG 2020. https://arxiv.org/abs/2002.04733 **[A]**
34. Hsu, Fontaine, Earle, Edwards, Togelius & Nikolaidis (2022). *Generating diverse indoor furniture arrangements.* SIGGRAPH 2022 Posters. https://arxiv.org/abs/2206.10608 **[F]**
35. Sfikas, Liapis & Yannakakis (2021). *Monte Carlo Elites: quality-diversity selection as a multi-armed bandit problem.* GECCO 2021. https://arxiv.org/abs/2104.08781 **[A]**. Gallotta, Liapis & Yannakakis (2024). *Dynamic quality-diversity search.* arXiv. https://arxiv.org/abs/2404.05769 **[A]** (Togelius is not an author of either paper; they come from the Malta co-author group.)

**Learned generators**
36. Khalifa, Bontrager, Earle & Togelius (2020). *PCGRL: procedural content generation via reinforcement learning.* AIIDE 2020, 95–101. https://arxiv.org/abs/2001.09212 **[A]**
37. Earle, Edwards, Khalifa, Bontrager & Togelius (2021). *Learning controllable content generators.* IEEE CoG 2021. https://arxiv.org/abs/2105.02993 **[A]**
38. Earle, Snider, Fontaine, Nikolaidis & Togelius (2022). *Illuminating diverse neural cellular automata for level generation.* GECCO 2022, 68–76. https://arxiv.org/abs/2109.05489 **[A]**
39. Earle, Jiang & Togelius (2024). *Scaling, control and generalization in reinforcement learning level generators.* IEEE CoG 2024. https://arxiv.org/abs/2408.12525 **[A]**
40. Earle, Jiang, Vinitsky & Togelius (2025). *Video game level design as a multi-agent reinforcement learning problem.* arXiv. https://arxiv.org/abs/2510.04862 **[A]**
41. Khalifa & Togelius (2020). *Multi-objective level generator generation with Marahel.* FDG 2020. https://arxiv.org/abs/2005.08368 **[A]**

**Benchmarks and work from 2023–2026**
42. Khalifa, Gallotta, Barthet, Liapis, Togelius & Yannakakis (2025). *The Procedural Content Generation Benchmark: an open-source testbed for generative challenges in games.* FDG 2025. https://arxiv.org/abs/2503.21474 **[M]**
43. Todd, Earle, Nasir, Green & Togelius (2023). *Level generation through large language models.* FDG 2023. https://arxiv.org/abs/2302.05817 **[A]**
44. Nasir & Togelius (2023). *Practical PCG through large language models.* IEEE CoG 2023. https://arxiv.org/abs/2305.18243 **[A]**
45. Nie, Middleton, Merino, Kanagaraja, Kumar, Zhuang & Togelius (2025). *Moonshine: distilling game content generators into steerable generative models.* AAAI 2025. https://arxiv.org/abs/2408.09594 **[A]**
46. Bhaumik, Togelius, Yannakakis & Khalifa (2025). *Evolutionary level repair.* arXiv. https://arxiv.org/abs/2506.19359 **[A]**
47. Yiu, Lu, Li, Joseph, Zhang, Togelius, Merino & Earle (2025). *A Markovian framing of WaveFunctionCollapse for procedurally generating aesthetically complex environments.* CEUR Workshop Proceedings 4090. https://arxiv.org/abs/2509.09919 **[A]**
48. Wen, Huang, Zhou, Zeng, Po, Togelius, Merino & Earle (2025). *All stories are one story: emotional arc guided procedural game level generation.* arXiv. https://arxiv.org/abs/2508.02132 **[M]**
49. Wen, Huang, Zhou, Zeng, Weng, Merino, Togelius, Kreminski & Earle (2026). *The Garden of Forking Paths: threading narrative archetype as a semantic signal through gameplay planning.* arXiv. https://arxiv.org/abs/2605.01245 **[A]**
50. Bhaumik, Togelius, Yannakakis & Khalifa (2026). *Learning local constraints for reinforcement-learned content generators.* arXiv. https://arxiv.org/abs/2605.13570 **[A]**
51. Rajesh, Khalifa & Togelius (2026). *Evolutionary wave function collapse.* arXiv. https://arxiv.org/abs/2607.02082 **[M]**
52. Siper, Khalifa & Togelius (2026). *Procedural content metageneration via program search and continual abstraction discovery.* arXiv. https://arxiv.org/abs/2608.17947 **[A]**
53. Khalifa, Nasir, Siper, James & Togelius (2026). *Programmable cellular automata.* arXiv. https://arxiv.org/abs/2609.06102 **[A]**

**Cited second-hand and not read (details unverified):** Dormans (2010), *Adventures in level design*, PCG Workshop, known to me through PCG book ch. 3 and ch. 5. Horswill & Foged (2012), *Fast procedural level population with playability constraints*, AIIDE, from the ch. 8 reference list. Butler, Smith, Liu & Popović (2013), *A mixed-initiative tool for designing level progressions in games*, UIST, from the ch. 8 reference list. Smith & Whitehead (2010), *Analyzing the expressive range of a level generator*, from ch. 12. Green et al. (2018), *AtDelfi* (FDG 2018) and *Generating levels that teach mechanics* (FDG PCG Workshop 2018), which I know only from the CV and arXiv listings.

**Repo context checked (read-only):** `absorb-this/tools/` (persona playtest harness: seeded runs, competence tables, source SHA in reports) and `scriptprof/` (MAP-Elites grid with a BFS playtester, plus an "evolve and play an elite" UI). Both patterns should be reused.

---

## 2. Key findings

**F1. The taxonomy axes are design decisions** (Togelius et al. 2011, §II.A–E, §V). The axes are online vs offline, necessary vs optional, seed vs parameter vector, and constructive vs generate-and-test. *Necessary* content "always needs to be correct", including difficulty that is not "wildly out of step". Catastrophic failure is the industry's objection to online PCG. There are three answers: make content optional, guarantee correctness through the representation (which costs diversity), or guarantee it through simulation (which costs compute). There are three classes of evaluation function: direct, simulation-based and interactive (§III.B). → *Museum: department layouts are necessary and must be generated online, so they need constructive guarantees. Department concepts and generator parameters can be offline and simulation-tuned. Side galleries can be "optional" content where riskier generation is tolerated.* [layout, difficulty, pipeline]

**F2. Experience-driven PCG** (Yannakakis & Togelius 2011, §2, §5.2). EDPCG has four components: player experience model, content quality, content representation and generator. The Mario example used a small parameter vector, pairwise preference reports and evolved neural predictors of fun and frustration. The authors warn that "there are players that dislike adaptation", and that the generator must decide "if, how much and how often" to adapt. → *Start theory-driven (personas). If we adapt at all, adapt which departments are offered, not hidden in-run difficulty. Treat telemetry-based models as phase 2.* [difficulty, player choice]

**F3. CA caves are cheap, controllable by four parameters, and stitchable** (Johnson et al. 2010, §3–6). The parameters are rock ratio r=0.5, iterations n, threshold T=5 and Moore radius M, plus a seed. A single 50×50 grid takes about 0.41 ms, and a 3×3 block of grids takes 349 ms. Neighbouring grids are joined by carving a tunnel and running two extra CA passes across the seam. The seed is stored so a grid can be regenerated. → *Use for "organic" departments (grottoes, drowned or overgrown wings) and as a seam-smoothing pass. CA guarantees no connectivity, so add island-filling (as Green et al. 2019 do) and graph checks.* [layout, visuals]

**F4. Micro, meso and macro patterns** (Dahlskog & Togelius 2014b, §III–VII). Micro-patterns (slices) are the representation. Meso-patterns (hordes, valleys, multi-path) are the objectives. Macro-patterns are the order of meso-patterns, including "pedagogic" macro-patterns where an obstacle first appears in a simple form and then in a complex one. Counting every pattern occurrence produced dense, simple-pattern-heavy levels, so balanced weights were needed. Scoring macro order cost about 10× runtime and pushed generation offline. → *Gallery set pieces are meso-patterns. The department's visit route is the macro-pattern. Each department should introduce its signature mechanic simply before compounding it.* [layout, encounters]

**F5. A ready-made dungeon pattern language** (Dahlskog, Björk & Togelius 2015, §3–4, Tables 1–4). The authors analysed 91 RPGs (1975–1993) and found five topologies: Connected Rooms, Rooms & Corridors, Labyrinth (unicursal), Maze (multicursal) and Open Area. Tiles carry two attributes, *Passable* and *Seethru*. Micro-patterns can be dropped in with only local checks: Room, Corridor, Connector, Door, Hidden Door, Key, Props, Obstacles, Installations, Containers, Stairs, Impassable Space, Traps, Enemies, Spawn Points, Portals. Meso-patterns can be recognised mechanically: Choke Points, Special Rooms, Dead Ends, Conditional Passageways, One-Way Travel, Flanking Routes. Macro-patterns include Quick Returns, Backtracking Levels and Sniper Locations. → *This maps almost one-to-one onto museum architecture (table in §3). It gives us a vocabulary for spec authors and validator predicates.* [layout, exhibits, text]

**F6. Constructive dungeons are a three-part process** (PCG book ch. 3, §3.1, §3.7.1, §3.9). The parts are (1) an abstract representational model, (2) a way to construct it and (3) a geometry step. Spelunky is the canonical case: a 4×4 room grid with the solution path laid first, rooms drawn from 8×10 templates with randomised chunks, then obstacle and monster passes. The chapter calls constructive methods fast but offering "rather limited control". → *Graph first, template rooms, multi-pass furnishing. This is cheap, controllable and proven in shipped games.* [layout]

**F7. Missions vs spaces** (PCG book ch. 5, §5.5.2–5.5.4). A level is a mission (tasks, locks, keys; flow, pacing, causality) plus a space (connectedness, distance, signposting). Graph grammars are hard to control unless rules are applied as sequences. A good strategy is "one simple step to create a highly randomised graph and a second step to restructure it". The chapter names three mission/space strategies: transform mission to space, transform mission to build instructions, or build space first and extract missions. → *A department's "visit plan" (entrance, galleries, highlight, shop, exits, closed-wing locks and ticket keys) is the mission. The floor plan is the space.* [layout, sequencing within a department]

**F8. Composition: an inner generator guarantees, an outer one optimises** (Togelius et al. 2012, §2–3). The paper presents a pyramid of properties: well-formed and playable at the base, challenge and fairness in the middle, "interesting" and "sublime" at the top. Solvers or constructive generators guarantee the base. Simulation-based search scores the middle as a continuum. Humans handle the top. The example used ASP for winnability inside an evolution strategy that scored *skill differentiation*: a "smart" A* agent that avoids threats against a "reckless" shortest-path agent. Fitness was averaged over 20 answers per genotype because variance within one parameter set was high. → *Use the same split: a constructive generator plus validator inside, offline QD over parameters outside, and human curation at the top. Evaluate specs over many seeds.* [pipeline, difficulty]

**F9. Map sketches and FI-2pop** (Liapis et al. 2013a, §3–4, Table 1; 2013b). The idea is to design and evaluate at coarse sketch resolution, then refine with CA. The "Dungeon" rendering turns segments into rooms and chokepoints into corridors. On 16×16 sketches with 8 bases, FINS found feasible maps in 20/20 runs (about 11 generations). A standard GA succeeded in 1/20 runs and minimal-criteria novelty search in 0/20. The generic metrics are area control, exploration (flood-fill coverage until the target is found) and balance. In roguelike dungeons, treasure is typically guarded by monsters (2013b). → *Search over room graphs and sketch tiles, never full tilemaps. Use FI-2pop wherever constraints bite. "Exploration" is a usable measure of how hard the exit is to find.* [layout, testing]

**F10. Diversity depends on the distance measure** (Preuss et al. 2014; Liapis et al. 2015 EC; Gravina et al. 2019, §I). Diversity preservation yields good and diverse content "only when using appropriate distance measures". Constrained novelty search variants trade speed of finding feasible content (FINS) against diversity (FI2NS). The No Man's Sky backlash is cited as diversity that players did not perceive. → *Measure department diversity behaviourally (persona outcomes, route structure) and thematically, not by tile difference.* [QD, testing]

**F11. Persona archetypes can be authored and still be valid** (Holmgård et al. 2014a, §3–6; 2014c). MiniDungeons is 12×12, with 40 HP, monsters dealing 5–14 damage and potions healing 10. Personas were Q-learning agents trained per level (2.5·10⁵ games), each with one extra reward on top of the base reward: Runner, Survivalist, Monster Killer, Treasure Collector, Baseline. Crowdsourced humans matched the Treasure Collector most often, which the authors suspect reflects the prize framing. Designer-authored personas matched humans about as well as clones trained on traces at the action level; clones did better at the affordance level (2014c). → *Hand-authored utility personas are a defensible start. Our framing (scores, achievements) will shift which persona real players resemble.* [testing, difficulty]

**F12. Personas as critics: three lessons** (Liapis et al. 2015, §3.2–4.2, Table 1).
- Of 10⁶ random levels only 360 were feasible. FI-2pop found the first feasible level in about 14 generations, while a death-penalty GA failed in 21/80 runs.
- Feasibility combined reachability, *worst-case* baseline survival (every monster at maximum damage) and a minimum exploration of at least 12 tiles, so that the exit is not next to the entrance.
- Maximising persona utility gave trivial levels: the Treasure Collector got 7/7 treasures with zero deaths, because "the player does not take a decision at any point". Maximising variance across playthroughs moved monsters onto chokepoints, but the Monster Killer variance objective was gamed by dying (death ratio 0.92). Personas also showed biases inherited from the levels they were trained on.

→ *Copy the worst-case runner constraint directly. Never optimise a single persona's utility. Any risk or variance objective needs a death cap.* [testing, difficulty]

**F13. MCTS personas work but are slow and fiddly** (Holmgård et al. 2019, §IV–VI, Tables II–IV). MiniDungeons 2 is a 10×20 deterministic game with five monster behaviours, including an A*-chasing, unkillable Minitaur. Utilities are weighted metrics with a −5 death penalty. Rollouts last 10 random moves, and trees hold 2–5 M nodes. With GP-evolved tree policies, the Runner won 100% of maps at about 3.2 s per map, the Treasure Collector only 54% (time-outs) at 151 s, and UCB1 baselines won ≤13% at about 280 s. The Completionist underperformed the Treasure Collector; the authors attribute this to its utility being normalised over about 20 objects. → *Use MCTS only as a small-sample "expert" reference. Utility normalisation must be per affordance count.* [testing, tooling]

**F14. Split the architect from the furnisher** (Green et al. 2019, §4–5, Tables 2–4). Three layout "creators" (constraint/TinyKeep-like, CA, digger) were crossed with three "furnishers" (constraint rules, CA neighbourhood rules, agent-based) to make 9,000 levels. Example constraint rules: entrance within 8 tiles of one end of the longest path; treasure in alcoves with 2 or more walls; goblins on or near the shortest path; mages adjacent to goblins. In the agent furnisher, objects *move* toward preferred contexts: treasures seek goblins, goblins avoid each other. Visible differences came mostly from creators, while gameplay differences came from furnishers. Personas showed that the constraint-creator plus constraint-furnisher combination was hardest. → *This is the "architect + curator" split for museums. An agent-based curator is a lovely diegetic fit for "living exhibits".* [layout, exhibits]

**F15. Persona dominance is a behaviour descriptor** (Green et al. 2022a). Constrained MAP-Elites used each persona's remaining HP as dimensions and simplicity as fitness. The result was levels where a given persona *dominates* (finishes with the most HP) or is *submissive*. A caution comes from Green et al. (2022b): persona labels were predictable from mechanic frequencies, but self-reported play styles "utterly" were not. → *Use persona dominance as the "type of challenge" axis of a department. Do not claim it describes players' identities.* [QD, sequencing]

**F16. The anatomy of QD-PCG** (Gravina et al. 2019, §II–V; AI&G 2nd ed., §8.3). Diversity comes either from behaviour-space distance or from partitioning. Quality comes from local competition or from constraints. Algorithms include MAP-Elites, sliding boundaries, constrained novelty and surprise search, constrained MAP-Elites, NS-LC and SS-LC. The case for QD is generative efficiency, fitness-free search, online expressivity analysis, co-creation and explainability. Open problems are the choice of behaviour characterisation, dimensionality and granularity, surrogate models of simulation, and diverse agents for testing content. → *Keep two or three coarse, designer-meaningful axes. A QD run doubles as an expressive-range report.* [QD, testing]

**F17. Constrained MAP-Elites with handicapped agents** (Khalifa et al. 2018, §4). Each cell holds a feasible and an infeasible population. The cell axes (entropy, risk, bullet distribution) are measured *by the playing agent*. The agent has a *dexterity error* (forced action repeats) and a *strategy error* (less thinking time), which make difficulty targetable. The paper's advice is to use the metrics as dimensions and "only playability for the fitness". → *Turn-based analogues of the handicaps are decision noise, lookahead depth and item-use competence.* [difficulty, testing]

**F18. Mechanic-intentional levels** (Khalifa et al. 2019, §3, Discussion; Charity et al. 2020). Three methods were compared. *Limited Agents*: the full agent wins and an agent missing a mechanic fails. *Punishing Model*: the forward model penalises use of the mechanic. *Mechanics Dimensions*: constrained MAP-Elites cells indexed by which mechanics fire. Imperfect agents let wrong scenes pass. The Mechanics Dimensions method guarantees that a mechanic is *possible*, not that it is *required*. Mech-Elites generates the simplest levels for each mechanic combination, intended for tutorials. → *Each department's opening "vestibule" gallery can be validated so that its signature mechanic is required, using a limited-agent test.* [layout, text/labels, player learning]

**F19. Room-graph dungeon QD for designers** (Alvarez et al. 2019, §III–IV). The Evolutionary Dungeon Designer treats a dungeon as a graph of rooms from 3×3 to 20×20. It is feasible if every passable tile is reachable from the start room. Room suggestions come from interactive constrained MAP-Elites with dimensions for symmetry, similarity, meso-patterns (treasure room, guard room, ambush), spatial patterns (chamber, corridor, connector) and linearity. Experiments used 13×7 rooms, as in The Binding of Isaac. → *A ready list of room-level descriptors, and a model for a "curator's console" development tool.* [exhibits, tooling]

**F20. Learned generators: the transferable idea is an archive of generators** (Khalifa et al. 2020; Earle et al. 2021, 2022, 2024, 2025; Khalifa & Togelius 2020; Siper et al. 2026). PCGRL frames design as an MDP, and its trained generators are fast. Goal-aware conditioning makes them controllable. CMA-ME over neural cellular automata yields an *archive of generators*, each optimised to produce *batches* of valid levels with reliable features. JAX scaling (1e9 steps) and small observation windows generalise to new map shapes, and multi-agent designers generalise further. LLM program search can now write generator code. → *The practical lesson for us is to archive generators (specs), not individual levels, and score each over a batch of seeds. RL training is overkill for a single-file browser game in v1.* [QD, pipeline]

**F21. Local generators cannot enforce global structure** (Rajesh et al. 2026; Yiu et al. 2025; Bhaumik et al. 2026; Khalifa et al. 2026). Evolving WFC inputs works when properties emerge locally (mazes) but fails on global constraints such as one key, one door and progression order. Decoupling WFC propagation (local constraints) from optimising global objectives beats joint optimisation. Adding global functions to CA cuts iterations and makes some problems solvable. → *Use WFC or CA only for local texture (mosaic floors, overgrowth, vitrine rows). Global structure comes from the graph.* [layout, visuals]

**F22. LLMs as generators need data, validation and repair** (Todd et al. 2023; Nasir & Togelius 2023; Nie et al. 2025; Bhaumik et al. 2025). LLM Sokoban generation scales strongly with dataset size. Prompt control worked for simple statistics and broke on solution length. With human-in-the-loop GPT-3 fine-tuning, 60 hand-made rooms gave 37% "playable-novel" rooms. Moonshine distils a constructive generator into a text-conditioned model using LLM-written labels. Evolutionary repair fixes broken levels: MAP-Elites repairs with fewer changes, while an ES needs about 10× fewer evaluations. → *If LLMs are used for departments, they should write specs in our schema, which are then validated, repaired and archived. They should not write tilemaps.* [concept generation, pipeline]

**F23. Run-level arcs and a shared schema** (Wen et al. 2025; Wen et al. 2026; Justesen et al. 2018; Togelius et al. 2013, §3.6). *All Stories* turns Rise/Fall emotional arcs into a DAG of seven nodes rendered as a sequence of dungeons, with difficulty tied to the arc. Its 16 participants rated it above a flat-arc baseline on enjoyment and engagement. *Forking Garden* threads the archetype through every generator via one symbolic schema. Its "narrative threat" predicted damage taken by a threat-blind combat agent, and "generate-first-constrain-later" gave 2.6× the entity diversity of a hierarchical baseline. Progressive PCG adapts difficulty to performance. Togelius et al. warn that waterfall pipelines between generators force "bland" content and call for opportunistic control flow. → *A department schema should be read by every generator (layout, encounters, items, labels). Departments should be sequenced with tension and relief, and candidates generated freely, then assembled under constraints.* [sequencing, pipeline, text]

**F24. Evaluate generators, not samples** (PCG book ch. 12, §12.2–12.4; AI&G §9.7.3; Khalifa et al. 2025). Expressive-range heatmaps reveal bias. Ch. 12 advises choosing metrics "as far as possible from the input parameters", because otherwise results are only confirmatory. Human studies should use rankings, not ratings. The AI&G book names three evaluation routes: visualisation, AI players including procedural personas, and humans. The PCG Benchmark scores a batch on **quality %, diversity %, controllability %**, with per-artifact closeness values in [0,1] usable as fitness or reward. It includes a MiniDungeons "Dungeons" problem and an Isaac-style dungeon-layout problem (start, boss, treasure and shop rooms). → *Adopt the three percentages as the per-department CI contract.* [testing, tooling]

**F25. Diverse layouts by latent-space illumination** (Hsu et al. 2022). A GAN was trained on human furniture layouts, and its latent space was searched with CMA-ME along price × piece count. Imperfect occupancy grids needed repair, and accessibility was flagged as future work. → *A possible later route to "convincing" exhibit arrangements, but it needs a corpus we do not have. Rule-based furnishing first.* [exhibits]

---

## 3. Ideas for the museum roguelike, by subsystem

**Museum translation of the dungeon pattern language (F5).** The table is my mapping, built on Dahlskog, Björk & Togelius (2015).

| Dungeon pattern | Museum instance | Gameplay role |
|---|---|---|
| Connected Rooms / Rooms & Corridors / Labyrinth / Maze / Open Area | Enfilade of period rooms / gallery wing off a corridor / one-way blockbuster route or spiral ramp / storerooms and archive stacks / great hall or sculpture court with partitions | One **typology per department**, which sets tactics (corridor fights vs open flanking) |
| Obstacle that is Impassable but Seethru | Glass vitrine, roped-off mosaic, atrium void | Line-of-sight without passage: ranged duels, peeking |
| Container | Locked vitrine (breaking it sets off the alarm) | Risk/reward loot |
| Installation | Audio-guide kiosk, fountain, donation box | Heal, lore, buffs |
| Spawn Point | Diorama, sarcophagus, "workshop" | Enemy source to shut down |
| Hidden Door / Portal | Staff door in panelling; painted door, dumbwaiter | Secrets, shortcuts |
| Choke Point / Conditional Passageway | Turnstile, ticket check, "Members only", "Closed for installation" | Locks and keys (ticket, keycard) |
| Special Room | Gift shop (shop), conservation lab (upgrade), café (heal), cloakroom (stash), the Highlight gallery (boss) | Pacing beats |
| One-Way Travel | "Exit through the gift shop" | Mandatory shop beat before the exit |
| Sniper Location | Mezzanine or balcony over an atrium | Ranged enemies, or a vantage point for the player |
| Quick Return | Service lift to the atrium | Backtracking relief |

**Layout generation.** Generate at sketch resolution (F9): a room graph plus a coarse grid, with search, if any, happening only here. Then refine rooms from typology-specific templates with randomised chunks (F6). CA is for organic wings only (F3). Each department spec names a typology plus parameter ranges.

**Exhibit placement (curation).** A rule-based furnisher in passes (F14):
1. Walkway reservation: shortest paths between doors stay clear.
2. Centrepieces on room centroids in highlight galleries.
3. Vitrine rows along walls and aisles.
4. Labels adjacent to exhibits, facing the walkway.
5. Benches facing centrepieces.
6. Encounters as "dormant exhibits" on plinths, using guard-room, treasure-room and ambush meso-patterns (F19).

Vitrines must never sit on chokepoints. An optional agent-based curator, where exhibits jostle toward preferred neighbours, could be the signature mechanic of a "living collection" department.

**Encounters.** Each department spec carries a roster of exhibit-enemies tagged by role (brute, ranged, swarm, ambusher, guardian, hazard-maker). An encounter budget is computed per tier (§6.ii). Ranged roles prefer Sniper Locations, and guardians prefer containers and chokepoints. This rule follows Liapis et al. (2013b): treasure is usually guarded.

**Signature mechanic tutorialisation.** The first gallery after the entrance is a "vestibule" validated with a limited-agent test (F18). A persona that ignores the mechanic must fail it, and the full persona must pass. Its label text explains the mechanic in museum voice, which turns a tutorial into a placard.

**Difficulty and challenge type.** Difficulty is tier-parametric (every spec must work at every depth, because order is random). "Type of challenge" is persona dominance (F15). Skill differentiation (F8) and inter-persona disagreement are measures of quality.

**Sequencing and player choice.** Each department ends with 2–3 exit doors to departments drawn from *different* challenge cells, each shown with a directory placard. The run follows a loose Rise/Fall template (F23). For example, a "rest" department (sculpture garden, café wing) is permitted after two Fall departments.

**Text and labels.** Placard text consumes the same department schema as everything else (F23), so labels can truthfully describe the mechanics present: "Do not touch: these specimens are only sleeping".

**Testing, evaluation and tooling.**
- A headless JS simulation that shares game code.
- Seeded runs with a source hash in every report, as in `absorb-this`.
- PCG-Benchmark-style quality, diversity and controllability per department (F24).
- Expressive-range plots per typology.
- A "curator's console" page in the style of `scriptprof` and EDD: view the archive grid, play any elite, lock or reject it (F19).

---

## 4. Pitfalls and risks

1. **Degenerate objectives.** Utility maximisation gives trivial levels, and variance objectives are gamed by dying (F12). Cap death rates in any risk objective and always combine it with a minimum-decision measure.
2. **Persona validity and bias.** Personas inherit bias from the levels they were tuned on (F12). They predict persona labels but not players' self-descriptions (F15). Our scoring framing will skew real behaviour, as the prize framing did in F11. Keep a held-out persona set and some human playtests. Otherwise the generator Goodharts the persona battery; that last risk is my inference, not a published result.
3. **False positives from imperfect agents.** A dumb agent dying by accident can make a broken level look "hard", or a level that should fail look "requires mechanic X" (F18). Run multiple seeds and agents.
4. **Compute.** MCTS personas took 3–280 s per small map (F13). Macro-level fitness cost about 10× (F4). QD multiplies everything by archive size × seeds × tiers. Bulk simulation must use cheap agents.
5. **Local methods for global constraints.** WFC and CA will not deliver key-before-lock, a single exit or progression order (F21).
6. **Imperceptible diversity.** Theme reskins over identical mechanics are the No Man's Sky failure (F10). A department must change *how you play*, not only sprites and nouns.
7. **Waterfall blandness.** If theme decides rules, rules decide layout and layout decides enemies, each stage must be bland enough for any successor (F23). Allow feedback, for example letting the encounter stage exploit a mezzanine the architect produced.
8. **Tier explosion.** Random order means N specs × T tiers of calibration. This is only tractable if difficulty scaling is a small, smooth function (§6.ii).
9. **Confirmatory metrics.** Expressive-range axes that are just the generator's inputs prove nothing (F24).
10. **Hidden adaptation.** In-run DDA conflicts with the roguelike norms of mastery and fairness, and EDPCG itself warns some players dislike adaptation (F2).
11. **LLM tilemaps.** They are data-hungry and hard to control on functional metrics (F22).
12. **Seed drift.** The same seed is not the same layout across code versions. Record a source hash alongside every simulation result, as in `absorb-this`.

---

## 5. Decisions for the design discussion

**D1. Where does layout generation run?**
- (a) Fully online, per run, from validated specs.
- (b) Offline layout pools per department.
- (c) Hybrid: online instantiation of offline-tuned specs.

*Lean: (c).* Option (b) contradicts "layout randomized every time" and caps variety.

**D2. Layout generator family.**
- (a) Graph-first plus typology-specific constructive embedding (BSP, digger, CA).
- (b) Spelunky-style room templates stitched on a grid.
- (c) Online search (evolve each level).
- (d) Learned (PCGRL, NCA, WFC).

*Lean: (a) with (b) inside rooms.* (c) is too slow and unpredictable. (d) only for local texture.

**D3. Runtime validation strength.**
- (a) Static checks only (reachability, lock order).
- (b) Static checks plus a worst-case runner simulation.
- (c) A persona battery online.

*Lean: (b).* It costs milliseconds and closes the main failure mode in F12.

**D4. Persona implementation.**
- (a) Utility-weighted strategy selectors with a tactical layer.
- (b) MCTS with persona utilities.
- (c) RL agents.
- (d) LLM agents.

*Lean: (a) for bulk simulation, (b) as a small expert reference.* (c) and (d) are not worth it for v1.

**D5. Difficulty control.**
- (a) Depth-tier scaling with per-department offline calibration.
- (b) Hidden in-run adaptation (EDPCG).
- (c) Player-selected risk via exit choice.
- (d) Meta-level heat or ascension levels.

*Lean: (a)+(c) now, (d) as meta-progression, no (b).*

**D6. QD archive axes.**
- (a) Challenge profile (persona dominance) × spatial structure.
- (b) Mechanics-fired cells (Mech-Elites style).
- (c) Aesthetic axes (symmetry, density).

*Lean: (a),* with (b) recorded as metadata.

**D7. Department sequencing.**
- (a) Uniform random.
- (b) Constrained random: no repeated challenge cell back to back, plus a Rise/Fall template.
- (c) Player picks among 2–3 doors.

*Lean: (b)+(c).*

**D8. Size of the department pool, from the generation side.**
- (a) Fixed pool of hand- or LLM-written concepts, offline.
- (b) An offline "acquisitions" pipeline (LLM spec, then repair, then persona validation, then archive).
- (c) LLM calls at runtime.

*Lean: (a) for v1, (b) as a stretch goal, and never (c) for mechanics.*

**D9. Exhibit placement.**
- (a) Rule or constraint furnisher.
- (b) Agent-based furnisher.
- (c) Solver (ASP or CSP).
- (d) Learned (GAN plus QD, as in Hsu et al. 2022).

*Lean: (a), with (b) as one department's gimmick.*

---

## 6. Concrete proposal

### (i) How department layouts are generated and validated

**Online, per department, seeded.** The inputs are `DepartmentSpec`, tier *t* and a seed.

1. **Visit plan (mission graph).** Start from a fixed skeleton: Entrance Hall → *k* galleries → Highlight (boss) → Gift Shop (one-way) → 2–3 exit doors. Then run a two-step grammar (F7). The first step scatters optional side galleries, special rooms named by the spec and 0–2 lock/key pairs (ticketed exhibition and ticket; staff door and keycard). The second step restructures so that every key precedes its lock and the vestibule comes first.
2. **Floor plan (space).** Embed the graph according to the spec's typology. Enfilade means aligned doors plus a service corridor as a flanking route. Rotunda means a hub with radial galleries. Wing means BSP rooms and corridors. Stacks means a digger maze. Hall means a large room with partitions. Spiral means a unicursal route. Do this at sketch resolution first (F9), then stamp room templates with randomised chunks (F6). Smooth seams with CA only in organic typologies (F3).
3. **Curation (furnishing).** Run the pass order from §3. The encounter budget for tier *t* is spent on roles from the spec's roster and placed via guard-room, treasure-room, ambush and sniper patterns (F5, F14, F19).
4. **Labels.** Fill templates from the spec lexicon with the actual exhibits and mechanics placed.
5. **Validate** (deterministic, milliseconds):
   - flood-fill reachability of all required nodes and every exit;
   - BFS over (position, keys) for lock order;
   - no vitrine or exhibit on a chokepoint;
   - minimum entrance-to-highlight path;
   - encounter budget within ±10% of target;
   - **worst-case runner**: an A* runner carrying the tier's *minimum* expected kit, with every enemy at maximum damage, reaches an exit alive (F12).
6. **On failure**, apply a local repair (open a wall, move an object), then reseed up to *N* times, then fall back to a known-good template for that typology. Log every fallback, because a rising fallback rate is a generator bug.

*Options:* replace step 2 with Spelunky-style grid stitching (simpler, less architectural), or replace step 5's sim with static checks only (riskier). *Lean: as written.*

### (ii) How persona-based simulated playtesting balances difficulty

**Persona roster.** These are utility-weighted strategy selectors in the spirit of Liapis et al. (2015). Each turn they pick among goals such as nearest exit, nearest unvisited gallery, nearest container, nearest enemy, retreat or heal. Then an A* and tactical layer acts, with utilities normalised per affordance count (F13).

| Persona | Utility |
|---|---|
| **Tourist** (Runner) | Exit, minimise turns |
| **Vandal** (Monster Killer) | Kill everything |
| **Looter** (Treasure Collector) | Open containers |
| **Completist** | Visit every gallery, read labels |
| **Cautious** (Survivalist) | Minimise damage taken |

**Skill variants.** Each persona comes in novice, median and expert versions via decision noise ε, threat lookahead (0, 1 or 2 turns) and item-use competence (F17). There are also limited variants that cannot use the department's signature mechanic (F18). A small MCTS expert gives an upper bound (F13).

**Simulate whole runs, not isolated levels.** Player power at tier *t* should then emerge from the item economy rather than being assumed. Per department instance, record:
- death rate;
- HP fraction at exit;
- turns;
- damage variance (risk);
- **skill differentiation** Δ = expert − novice survival (F8);
- **persona dominance vector** (F15);
- **choice richness**: route divergence and action disagreement between personas. If every persona takes the same path, the level offers no decisions (F12).

**Calibration.** Fit a per-spec difficulty offset *b(d)* so that the *median* persona's death rate in department *d* at tier *t* hits a target curve *p\*(t)*. Then encounter budget = base(t) × e^{b(d)}. Checks:
- ship a spec only if its calibrated death rate varies little across seeds (consistency);
- Δ must be clearly positive (skill matters);
- the Cautious novice survives the vestibule nearly always.

**The target curve is Julian's design call.** For scale, eight departments at a flat 10% death rate yield 0.9⁸ ≈ 43% run clears for that persona.

*Options:* (a) whole-run simulation (realistic power, higher cost); (b) per-department simulation with sampled kits (cheap, assumes an item model); (c) MCTS personas throughout (most human-like, infeasible at scale). *Lean: (b) during development, (a) nightly.* Later, use telemetry to re-weight personas (EDPCG, F2) rather than to adapt in-run.

### (iii) How a QD archive guarantees a diverse department pool

**Genome.** The mechanical part of `DepartmentSpec`:
- typology;
- graph parameters (galleries, branching, loops, locks);
- density parameters (vitrine ratio, sightline blockers);
- roster composition by role;
- one signature mechanic from a menu (darkness, alarms and guards, flooding, mirrors and portals, "closing time" clock, fragile floors, sleeping exhibits);
- item rules.

**Algorithm.** Constrained MAP-Elites, with a feasible and an infeasible population per cell (F17, F9).

**Feasibility.** The validator passes on ≥95% of *K* seeds at every tier, and calibration converges.

**Fitness among feasible specs.** Skill differentiation plus choice richness, minus cross-seed difficulty variance. Evaluate each spec on *K* seeds × 3 tiers × the persona roster, i.e. archive *generators* rather than levels (F20).

**Behaviour axes (lean).**
- **Challenge profile**: which persona dominates (Tourist, Vandal, Looter, Cautious, or balanced).
- **Spatial structure**: four buckets of linearity versus loops in the room graph.

Tempo (Runner turns) is an optional third axis. Record mechanics fired as metadata (F18).

**Themes as a second archive.** Themes (Calvino- or Borges-style concepts: name, premise, lexicon, enemy and item flavour, compatible mechanic tags) live in a separate novelty archive, with distance measured on text embeddings. An assignment step matches themes to compatible elite cells so that the shipped pool **covers at least M distinct mechanical cells and maximises theme spread**. The diversity guarantee is then a measurable QD coverage number in CI, not a hope.

**Upkeep.** Re-evaluate the archive whenever rules change, since dynamic-QD concerns apply (Gallotta et al. 2024). Show it in the curator's console for human pick, lock or veto, the top of the property pyramid (F8).

*Options:* (a) one archive with theme embedding as an axis (too high-dimensional, F16); (b) no QD, with hand curation plus expressive-range plots (fine for about 20 departments, does not scale); (c) the two-archive design above. *Lean: (c).*
