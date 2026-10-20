# The PCG part of *AI and Games* 2e, read for the museum roguelike

Researcher brief. Topic: Part III (Chs. 7–9) of Yannakakis & Togelius, *Artificial Intelligence and Games*, 2nd ed. (Springer 2025; extracted text dated 15 Nov 2024), plus §6.5, §13.2.2 and Ch. 14.

Citation conventions:
- Page numbers come from the running headers, cited as "AI&G 2e p. N".
- [n] is the book's bibliography number, which I resolved against the book's reference list.

---

## 1. Sources actually read

**In full**
- AI&G 2e Ch. 7 (pp. 235–252): why generate, taxonomy, roles.
- AI&G 2e Ch. 8 (pp. 253–285): constructive, search-based, QD, solvers, PCGML/LLMs, PCGRL/EDRL.
- AI&G 2e Ch. 9 (pp. 287–311): levels, visuals, audio, narrative, rules, games, §9.7 evaluation.
- AI&G 2e §13.2.2 (pp. 412–416), with the §13.2.3 paragraphs on player models driving PCG (pp. 416–418).
- AI&G 2e Ch. 14 (pp. 421–435). Focus on §14.1.2 (pp. 424–426), Text-to-Game (p. 430), Game Directing (p. 431), Creative Inspiration (pp. 432–433) and AI-Based Game Design (p. 434).
- AI&G 2e §6.5 (pp. 214–216).

**In part (located by grep)**
- §3.6.7 LLMs (pp. 123–124).
- §4.2.1.3 "Ghosts and Personas" (pp. 147–148).
- Cicero (p. 220).
- pp. 6 and 26 on "infinite" content.
- Ch. 15 on adaptation and filter bubbles (pp. 438–439, 444–445).

**Primary sources checked directly**
- Togelius, Shaker & Nelson, "Introduction", ch. 1 of Shaker, Togelius & Nelson (eds.), *Procedural Content Generation in Games*, Springer 2016. I read §1.5 (desirable properties) and §1.6 (the 2016 taxonomy). https://pcgbook.com/chapter01.pdf
- Liapis, Yannakakis, Nelson, Preuss & Bidarra, "Orchestrating Game Generation", *IEEE Transactions on Games* 11(1):48–68, 2019, doi:10.1109/TG.2018.2870876 [626]. I read §§III–IV in full. https://www.kmjn.org/publications/OrchestratingGenerators_IEEEToG.pdf
- Zammit, Liapis & Yannakakis, "CrawLLM: Theming Games with Large Language Models", IEEE CoG 2024 (2-page demo) [1289]. Read in full. https://www.antoniosliapis.com/papers/crawllm_theming_games_with_large_language_models.pdf
- Zammit, Liapis & Yannakakis, "CrawLLM: An LLM-Based Pipeline for Game Asset Generation", authors' preprint; venue and year unverified (PDF dated Jan 2026). I read the user-study section. https://www.antoniosliapis.com/papers/crawllm_an_llm-based_pipeline_for_game_asset_generation.pdf
- arXiv abstracts:
  - Todd, Earle, Nasir, Green & Togelius, "Level Generation Through Large Language Models", FDG 2023 [1134], arXiv:2302.05817.
  - Nasir, James & Togelius, "Word2World" [787], arXiv:2405.06686 (2024).
  - Gallotta et al., "Large Language Models and Games: A Survey and Roadmap", IEEE ToG 2024 [357], arXiv:2402.18659.
  - Zammit, Liapis & Yannakakis, "MAP-Elites with Transverse Assessment…", EvoMUSART 2024 [1290], arXiv:2403.07182. The book writes "MeLITA"; the paper says MEliTA.
  - Gravina, Khalifa, Liapis, Togelius & Yannakakis, "Procedural Content Generation through Quality Diversity", IEEE CoG 2019 [395], arXiv:1907.04053.
  - Galanos, Liapis & Yannakakis, "Architext" [356], arXiv:2303.07519.
  - Summerville et al., "PCGML" [1092], arXiv:1702.00539; IEEE ToG 10(3):257–270, 2018.
- Repo, read-only: `scriptprof/README.md` (MAP-Elites + grammar mutation + BFS playtester, after ScriptDoctor/GAVEL/PuzzleJAX) and `absorb-this/tools/README.md` (persona playtest bots with documented competence limits).

### Grep report, whole book

| Term | What it turns up |
|---|---|
| museum, Borges, Calvino, Brogue, Pixel Dungeon, Caves of Qud, Dwarf Fortress, Tracery, "data games", "open data" | **No hits.** The book has nothing on museal or literary framing, on text grammars like Tracery, or on data games; Barros et al.'s Wikipedia-driven games are not cited. These need other sources. "Wikipedia" appears only in image credits. |
| roguelike / Rogue | p. 6: Rogue generates dungeons "and the placement of creatures and items in them" each game. p. 241: "many of the ad-hoc constructive generators found in roguelikes are stochastic but not controllable". p. 243: "Roguelikes and roguelites, such as Hades (Supergiant, 2020), all build on runtime PCG". pp. 214–216: NetHack and MiniDungeons. p. 371: RL player modelling "in roguelike adventure games [451, 450]". Nothing on meta-progression. |
| Spelunky | p. 288: players "are allowed to modify a level which is not playable… by blowing up the blocking tiles with a bomb". This is a design answer to generator failure. |
| NetHack | p. 215: "standard Deep RL agents are very far from solving the game, or even playing the game well". Don't expect learned agents to playtest a rich roguelike. |
| No Man's Sky / oatmeal | p. 270: backlash "partly due to the perceived similarity in the generated worlds of the game [680]". [680] is Maiberg, "'No Man's Sky' is like 18 quintillion bowls of oatmeal", *Vice*, Aug 2016. "Oatmeal" appears only there; Compton's "10,000 bowls of oatmeal" essay is not cited (unverified here). |
| infinite / endless | p. 6: "potentially infinite—content without having to design it by hand". p. 26: "truly endless games" if "sufficient variety, quality and quantity". p. 236: "no reason why games need to end". p. 243: "infinitely replayable". pp. 257–259: Johnson et al.'s infinite CA caves. p. 413: "an infinite supply of test environments". |
| orchestration / facet | p. 287 (six facets [633]); pp. 301–304 (game generation, Karavolos fusion); pp. 424–426 (facet orchestration); p. 347: "in-game stimuli are always orchestrated [626]". |
| experience-driven, persona, expressive range | pp. 247–250, 283–284, 418, 430, 444 (EDPCG/EDRL); pp. 147–148, 216, 307, 445 (personas); pp. 267, 271, 306–308 (expressivity, Fig. 9.9). |
| LLM / language model | pp. 123–124; 279–281 (§8.5.4); 296–298 (narrative, chatter [773]); 300 (GAVEL [1135], Sumplete); 305 (hallucinations); 220 (Cicero ungrounded claims); 430 (Text-to-Game, Word2World); 432 (ideation); 439 (copyright). |

---

## 2. Key findings

**F1. The 2e taxonomy** (AI&G 2e pp. 237–250) has three parts:

| Part | Dimensions (page) |
|---|---|
| **Content** | Type: necessary vs optional (p. 237); Functionality: decorative vs functional (p. 239); Spatiality (p. 239) |
| **Methods** | Determinism (p. 240); Controllability (p. 240); Testing: constructive vs generate-and-test (p. 241); Learning: authored vs trained (p. 241); Iterativity: single-pass vs iterative (p. 242) |
| **Roles** | Temporality: runtime vs offline; Autonomy: mixed-initiative vs autonomous; Adaptivity: experience-driven vs experience-agnostic (p. 243) |

Mapping from the 2016 PCG-book taxonomy (Togelius, Shaker & Nelson 2016, pp. 7–10):

| 2016 dimension | 2e dimension |
|---|---|
| online vs offline | temporality |
| degree and dimensions of control | controllability |
| generic vs adaptive | adaptivity |
| automatic generation vs mixed authorship | autonomy |
| stochastic vs deterministic | unchanged |
| constructive vs generate-and-test | unchanged |

New in 2e relative to that list: functionality, spatiality, learning and iterativity.

Key sentences:
- "Necessary content should always be correct while this condition does not hold for optional content" (p. 238).
- "A game level is more like program code than like natural language text" (p. 239).
- "If you played a game blind… only functional content would matter" (p. 239).
- Prompting is autonomous generation: "the initiative of the designer is limited to algorithmic parameterizations or instantiations before the generation starts. Examples include prompting" (p. 247).

**What this means:** the functional/decorative axis is the key lens for the infinite-departments question.
- A department's conceit, names, prose and palette are decorative. They "degrade gracefully" (p. 239), so an LLM can produce them with light checks.
- Its layout, encounters, item effects and department rule are functional. They must be correct by construction or verified.

→ **Split every department into a functional skeleton and a decorative skin.** (Department concept, layout, enemies, items, text.)

**F2. Representation and control** (pp. 241, 267). The book uses roguelike generators as its example of "stochastic but not controllable". Representations run from tiles down to "most indirectly, as a random number seed", and "it clearly makes no sense to evolve random number seeds" (p. 267).

**What this means:** represent a department as a semantically meaningful parameter vector: style, size, branching, bestiary roles, modules. Seeds drive only the final constructive step. That makes the generator searchable offline and cheap at runtime. (Layout, department concept, tooling.)

**F3. Constructive methods and their guarantees.**
- **Grammars** have generated "missions and dungeons [285, 286]" (p. 254). Refs: Dormans, PCG Workshop 2010; Dormans & Bakkes, IEEE TCIAIG 3(3), 2011.
- **CA** "cannot guarantee properties such as playability or solvability", and "gameplay features are disjoint from the control parameters" (p. 260). Johnson, Yannakakis & Togelius's infinite caves (PCG Workshop 2010 [505], pp. 257–259) work only with a tunnel-drilling repair between rooms.
- **WFC** satisfies "local ones such as connectivity" rather than "global constraints such as feasibility of playability" (p. 263). It can end in contradiction (p. 265). Its collapse step "can be selected by a human" (p. 265). Refs: Karth & Smith, IEEE ToG 14(3), 2021 [538]; Gumin 2016 [405].

**What this means:**
- Grammar / graph rewriting for the macro floor plan. A museum is already a mission graph with gates ("Closed for Reinstallation", "Staff Only").
- WFC for micro decoration: parquet, mosaics, vitrine arrangements from example rooms.
- CA only for department variants: flooded storage, grotto collection, overgrown natural-history wing.
- Always a reachability and repair pass. (Layout, placement, visuals.)

**F4. Search-based PCG** (pp. 266–270). It has three parts: algorithm, representation and evaluation.
- The evaluation function is "often among the hardest tasks" and arguably "AI-complete" (pp. 266–267).
- There are three kinds of evaluation: direct, simulation-based ("an AI agent that imitates human behavior" for experience), and interactive (p. 268).
- Veto for runtime: it is "unsuitable for time-critical content generation, such as when you only have a few seconds to serve up a new level" (p. 269).

**What this means:** use search **offline only**, to tune enemies, items, layout-style parameters and the department catalogue. At runtime, use constructive generation plus cheap tests.

**F5. Quality-diversity is the book's answer to sameness** (pp. 270–272).
- "Content with insufficient diversity can lead to player fatigue" (p. 270).
- MAP-Elites' behaviour partitioning "allows designers to control and illuminate the design space" (p. 270).
- QD gives "online expressivity analysis [1046] as a byproduct" and suits mixed-initiative design (p. 271).
- Constrained surprise search [396] (Gravina, Liapis & Yannakakis, CIG 2016) produced "surprising yet balanced" weapons (p. 291). Constrained novelty search [634] is Liapis, Yannakakis & Togelius, *Evol. Comput.* 23(1), 2015.

**What this means:** the department catalogue, the bestiary and the artifact pool should each be a **QD archive with designer-chosen descriptors**, so "is it diverse?" becomes a coverage number. `scriptprof/` already has this loop. (Concept, enemies, items, testing.)

**F6. Solvers** (pp. 272–274). They prune partial solutions and handle hard constraints. ASP refs: Smith & Mateas, IEEE TCIAIG 3(3), 2011 [1044]; Nelson & Smith, PCG book ch. 8, 2016 [794]. But "it is generally complicated to include simulation-based tests or any other call to the game engine inside a constraint satisfaction program" (p. 273).

**What this means:** exhibit placement and lock/key order are purely structural:
- a label tile beside every vitrine;
- no furniture in doorways;
- the key is reachable before its gate;
- a sightline from the entrance to the centrepiece.

For a no-dependency single HTML file, write a small custom checker and repairer rather than shipping an ASP solver. (Placement, layout.)

**F7. PCGML and LLMs, as the book states them** (pp. 274–281, 300, 305, 430–432).

The two core problems:
- "'Mostly correct' images… are less suitable for generating mazes which must have an exit" (p. 275).
- "There simply isn't enough existing content to train on" (p. 275).

LLM level generation:
- MarioGPT [1087] (Sudhakaran et al., NeurIPS 36) is "a hybrid PCG algorithm that combines ML and search" (p. 281).
- For Sokoban [1134], performance "scales dramatically with dataset size" (abstract).

The book is **thin on failure modes**. What it says:
- "unpredictable hallucinations" (p. 305);
- Cicero said "things that fit into the conversational format but were not grounded in facts" (p. 220);
- text-to-game "lacks certain degrees of controllability" (p. 430).

Its prescription: "the power of the LLM can be amplified (and its shortcomings mitigated) by dividing up the generation process in multiple steps, and using other algorithms to check and repair its outputs, as is done in e.g. the Word2World game generator [787]" (p. 430).

Positive evidence:
- GAVEL [1135] (Todd, Padula, Stephenson, Piette, Soemers & Togelius, NeurIPS 2024) combines LLMs and search to get "novel, playable and interesting games" (p. 300).
- LLM NPC chatter [773] (Müller-Brockhausen, Barbero & Preuss, CoG 2023) is mostly "relevant to the context of a given NPC persona" (p. 298).
- LLMs serve as "conceptual assistants or as content production assistants", and "it can be simpler to generate an idea for new games, that are then designed by humans" (p. 432).

**What this means:** the book supports LLMs for the decorative skin and as a proposal or mutation operator inside a checked loop. It gives no support for unverified LLM functional content. For a single-file browser game, that means **offline** LLM use. (Concept, text, NPCs, tooling.)

**F8. CrawLLM is the closest precedent** ([1289] and the extended preprint).
- **Skeleton:** a fixed functional skeleton (grammar dungeons with "solvable door/key puzzles", after Unexplored's cyclic generation) re-themed by Mixtral 8x7B. The LLM writes theme, plot, location names, antagonist and minions, and image prompts for SDXL + ControlNet.
- **Framing:** the authors call it "a top-down pipeline for orchestration".
- **Stated limitations:**
  - prompts "have to be meticulously crafted and tuned to match the game mechanics";
  - character consistency across generations is hard;
  - enemies were humanoid-only because of the pose templates.
- **User study** (34 people guessing theme descriptors from screenshots or text):
  - accuracy above chance in 30 of 45 questions;
  - epoch hardest to convey (43% average), visual style next (45%);
  - themes came through "only when all such details were highly specific (e.g., when describing a particular place rather than a general genre trope)".

**What this means:**
1. Copy the architecture: fixed skeleton plus generated skin.
2. **Specificity is the coherence lever.** A Calvino-style *particular place with a conceit* will read better than a trope ("steampunk wing").
3. 16-bit pixels can't carry era. **Labels must carry period and provenance**, so text is load-bearing.
4. The theme-guessing protocol is a ready evaluation instrument.

**F9. PCGRL / EDRL** (pp. 281–284). PCGRL is Khalifa, Bontrager, Earle & Togelius, AIIDE 2020 [549].
- "Dense rewards seem to be necessary" (p. 282).
- RL has "a certain lack of control" and needs "a playability test or a repair function" (p. 283).
- EDRL (Shu, Liu & Yannakakis, CoG 2021 [1026]; Wang, Liu & Yannakakis, FDG 2022 [1225]) quantifies fun "as moderate degrees of content diversity" between consecutive segments (p. 250).

**What this means:** skip PCGRL. Steal EDRL's idea for **sequencing**: consecutive departments should sit at a moderate distance in descriptor space.

**F10. Levels: landmarks, districts and completability** (pp. 288, 434).
- Level generation draws on city planning: "edges to constrain player freedom and landmarks to orient the player and motivate exploration… and districts to break the world's monotony" (p. 288).
- "A sequence of identical rooms can easily make the player disoriented" (p. 288).
- Spelunky's bomb repairs unplayable levels (p. 288).
- "The lack of level generation methods that guaranteed balance and playability led to game designs where levels did not need to be completable" (p. 434).

**What this means:**
- Give each department one **landmark centrepiece**: the masterpiece, often the boss or the accession reward.
- Sub-galleries are districts, each with its own vitrine type and floor.
- Ship a diegetic **safety valve**, such as a janitor's keyring opening any service door, so generator bugs cost a resource rather than a run.
- Deliberate identical-room disorientation can be a department module (a Borgesian "Gallery of Copies").

**F11. Visuals and audio** (pp. 289, 293–294, 301).
- Visuals have "the fewest functionality constraints" (p. 289).
- Bad audio "will not necessarily break the game; it may, however, break the player's experience entirely" (p. 293).
- Sonancia [651, 652] (Lopes, Liapis & Yannakakis 2015/2016) derives sound from level tension (p. 294).
- p. 301: the Pac-Man rule generator "does not evolve the agents' color to indicate different playing strategies… red represents an aggressive behavior whereas orange represents a passive behavior".

**What this means:**
- Readability is the functional part of visuals: actors must contrast with exhibits.
- Use a **cross-department visual grammar for behaviour** (trim colour or idle animation per archetype), so knowledge transfers across skins.
- Audio can follow Sonancia: tension from the encounter budget sets the ambient layers.

**F12. Rules are the hardest facet** (pp. 299–300). Rules "are almost impossible to evaluate in isolation", and "none of these attempts to generate video games have been able to produce good games, i.e., games that anyone (except the creator of the system that creates the games) would want to play" (p. 300). Usable agent proxies:
- balance;
- outcome uncertainty;
- learnability [1156];
- performance gap between agents of different skill [802] (Nielsen, Barros, Togelius & Nelson, EvoApps 2015);
- depth [594] (Lantz, Isaksen, Jaffe, Nealen & Togelius, 2017).

**What this means:** departments should **select and parameterize rules from an authored module library**, not invent them. Examples:
- exhibits that move only when unobserved;
- alarms that summon guards;
- light-sensitive pigments;
- humidity that rusts weapons;
- mirrors that reflect bolts.

Use the skill-gap metric to check that each module adds depth.

**F13. Orchestration is the frontier, and the museum sits at its tractable end** (pp. 301–304, 424–426).
- Prior systems:
  - Game-O-Matic [1169] (Treanor, Blackford, Mateas & Bogost 2012) maps concept-map nouns and verbs to visuals and mechanics.
  - Nelson & Mateas [793] (IUI 2008) use ConceptNet and WordNet to match sprites to mechanic roles.
  - ANGELINA [230–233] and Puck [229] (Cook, AIIDE 2022).
  - Karavolos et al. [531, 532] (PCG workshop 2017; FDG 2018) train a CNN surrogate to predict whether a level + weapon set is balanced (pp. 303–304).
- "Orchestration may vary from a top-down, conductor-driven process to a bottom-up, free-from [sic] generation process [626]" (p. 425).
- "Currently the only genre for which generators have been built that can generate high-quality (complete) games is abstract board games" (p. 426).

**What this means:** a museum department has a strong, simple top-down frame, the exhibition brief. That puts it at the tractable end of the orchestration spectrum.

**F14. Liapis et al. 2019 give the architecture** ([626] §IV, read directly).
- **Top-down "composer":** a natural-language *frame* is refined by per-facet *directors* into constraints for "primitive" generators. "Constructive PCG methods likely suffice" for those, and "assurance of quality and consistency is done by directors".
- **Bottom-up "jam":** a blackboard of generators plus a coherence evaluator. The authors judge it to need "human-level aesthetic evaluation".
- **Middle ground:** a "creative maestro" who may reinterpret the frame; "jamming with fake sheets"; vertical slices; and post-production repair, which "is a core element of orchestration, and in certain cases could be considered the main method for orchestration itself".
- **Cheap coherence:** "using common labels between generators", at "the cost of expressiveness".

**What this means:** use a top-down brief, deterministic directors, constructive primitives, a repair pass and a shared tag vocabulary (§3.4).

**F15. Evaluating generators** (§9.7, pp. 305–309).
- "The generation of any content is trivial; the generation of valuable content for the task at hand… is a rather challenging procedure" (p. 305).
- "Content generation is a cheap process… design and gameplay are expensive tasks relying on humans who cannot afford the experience of bad content" (p. 305).

There are three evaluators:
- **The designer, via visualization:** expressive range [1046] (Smith & Whitehead, PCG Workshop 2010), heatmaps, autoencoder projections, QD maps and QD-score (p. 307).
- **AI players**, including procedural personas (p. 307).
- **Humans:** classes, scores or ranks, plus designer annotations (p. 309).

The book also says: "we can test to which degree the data we extract through AI agents relates to data we extract from human playtesting [790]" (p. 309).

**F16. Personas and forward models** (pp. 148, 216, 428).
- A persona is "the parameters of a utility vector that describe the preferences of a player" (p. 148).
- In MiniDungeons, a turn-based roguelike, styles were "formalized as procedural personas by attaching differing utilities to measures such as the number of treasures collected, the number of monsters killed or the number of turns taken to reach the exit" (p. 216). Refs: Holmgård, Liapis, Togelius & Yannakakis 2014 (CIG [450], FDG [451], ICEC [452]); Barthet et al., FDG 2022 [59].
- Ch. 14 asks for engines where "the game state is clearly separable from the presentation layer… it would be trivial to forward-simulate" (p. 428).

**What this means:** write the core as pure state transitions runnable headless in Node. Persona bots (Runner, Curator, Vandal, Survivor) can then search a forward model and play thousands of departments.

**F17. Adaptivity and its limits** (pp. 248, 431, 445). EDPCG has four components: experience model, quality, representation and generator (p. 248). The caution: "Excessive adaptation and personalization might have a similar effect [to filter bubbles], where players are funneled into a narrow set of game experiences" (p. 445).

**What this means:** adapt *what is offered* (door choices toward novelty), not *how hard it is*. Difficulty stays tied to depth and legible.

**F18. What the book says about "infinite" and "meaningful".**
- Infinity is conditional: "if new content can be generated with sufficient variety, quality and quantity, then it may become possible to create truly endless games" (p. 26).
- The counterexample is No Man's Sky's "perceived similarity" (p. 270).
- On meaning, a general generator's output should be "meaningful and playable as well as entertaining" (p. 424).
- On creativity, current generators mostly "possess only skill" rather than appreciation and imagination (p. 426, after Colton 2008 [223]).
- A static utility function is "mere generation" (p. 247).

**What this means:** the book never argues that infinity is valuable in itself. What it values is distinct, playable, valuable content. An LLM supplies skill; *appreciation* (judging which departments are good) must come from a curator or an evaluation function. That points to a catalogued design with Julian in the loop offline.

---

## 3. Ideas for the museum roguelike

### 3.1 Where each generator sits on the 2e taxonomy (recommended)

| Generator | Necessary / optional | Functional / decorative | Spatial | Determinism | Control | Testing | Learning | Iterativity | Time | Autonomy | Adaptivity |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Department brief** (conceit, tags, modules, bestiary roles, palette seed, label voice) | Slot necessary, instance optional | Skeleton functional, skin decorative | No | Stochastic offline, fixed at runtime | Tags + descriptor targets + prompts | Generate-and-test: schema, consistency, bot play, curator | LLM skin over authored modules | Iterative | **Offline** | **Mixed-initiative** (Julian curates) | Agnostic |
| **Run sequence / wing map** | Necessary | Functional | Graph | Seeded | Ramp, diversity band, no-repeat | Generate-and-test (resample) | Authored | Single pass + rejection | Runtime | Autonomous | Agnostic or novelty-driven (D6) |
| **Layout** (gallery graph + tiles) | Necessary | Functional | Yes | Seeded | Style parameters from brief | Constructive + reachability + repair | Authored | Iterative | Runtime | Autonomous | Agnostic |
| **Exhibit / furniture placement** | Mostly optional (cover is functional) | Mixed | Yes | Seeded | Rules per vitrine type | Constructive + constraint repair | Authored (WFC from examples) | Iterative | Runtime | Autonomous | Agnostic |
| **Enemies** (archetype × parameters × skin) | Role necessary, design optional | Functional (skin decorative) | Spawns only | Parameters offline; spawns seeded | Archetype library + depth budget | QD + bot sims offline | Authored behaviour, LLM skin | Iterative offline | Offline design, runtime pick | Mixed-initiative offline | Agnostic |
| **Items / artifacts** | Optional | Functional (skin decorative) | No | Unidentified looks seeded per run | Effect library + power budget | QD / constrained surprise offline | Authored effects, LLM labels | Iterative offline | Offline + runtime pick | Mixed-initiative offline | Agnostic |
| **NPCs** | Optional | Shop and quests functional, talk decorative | No | Seeded pick from pools | Persona + tags | Offline filters | LLM text | Single pass | Offline | Autonomous + curator | Agnostic |
| **Labels and wall text** | Optional | **Decorative, except mechanic-describing labels (functional)** | Placed spatially | Seeded templating | Slots from item/enemy tags | Generate-and-test (fact-check vs tags) | LLM fragments + authored templates | Single pass at runtime | Offline + runtime | Autonomous + curator | Agnostic |
| **Sprites / palettes** | Optional | Decorative; readability is functional | 2D | Seeded | Palette from tags; parts from archetype | Contrast check | Authored parts | Single pass | Runtime | Autonomous | Agnostic |
| **Audio** | Optional | Decorative | No | Seeded | Tension from encounter budget | Ear test | Authored synth | Single pass | Runtime | Autonomous | Reacts to game state |

### 3.2 Method applicability

Scale: 0 = no, 1 = marginal, 2 = useful, 3 = primary.

Column key: Concept = department brief; Seq = run sequence; Layout = department layout; Place = exhibit / furniture placement.

| Method (AI&G 2e §) | Concept | Seq | Layout | Place | Enemy | Item | NPC | Text | Visual | Audio |
|---|---|---|---|---|---|---|---|---|---|---|
| Grammars / graph rewriting (8.1.1) | 2 | 1 | **3** | 2 | 1 | 2 | 1 | **3** | 2 | 1 |
| Cellular automata (8.1.2) | 0 | 0 | 2\* | 1 | 0 | 0 | 0 | 0 | 1 | 0 |
| Noise / fractals (8.1.3) | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 2 | 1 |
| WFC (8.1.4) | 0 | 0 | 2 | 2 | 0 | 0 | 0 | 0 | 2 | 0 |
| Search-based (8.2) | 1† | 2 | 1† | 1 | 2† | 2† | 0 | 0 | 1 | 1 |
| QD / MAP-Elites (8.3) | **3**† | 1 | 2† | 0 | **3**† | **3**† | 0 | 1 | 1 | 0 |
| Solvers / constraints (8.4) | 0 | 2 | 2 | **3** | 0 | 1 | 0 | 0 | 0 | 0 |
| n-grams / Markov (8.5.1) | 1 | 0 | 1 | 0 | 0 | 0 | 1 | 2 | 0 | 1 |
| GANs / latent search (8.5.3) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| LLMs (8.5.4) | **3**† | 1 | 1 | 0 | 2† | 2† | 2† | **3**† | 1 | 0 |
| PCGRL / EDRL (8.6) | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

\* CA only for department variants (grotto, flood, overgrowth) and for in-game hazard spread; p. 257 notes CA for "heat and fire, rain and fluid flow".
† Offline only.

Notes on the ratings:
- **Grammars score 3 for text.** The tombstone label is a rigid genre: title / maker or culture / date / medium / dimensions / accession no. / credit line ("Gift of the Estate of…"). A runtime template grammar over offline fragments gives unlimited correct-looking labels. Accession numbers can encode seed and department ("1987.312.44"), which doubles as a diegetic seed display.
- **Grammars score 3 for layout.** A museum plan is a graph of enfilades, rotundas, cabinets, courts and stair halls with gates. This is Dormans' mission/space split, which CrawLLM also used.
- **GANs and PCGML score 0.** There is no corpus (p. 275).
- **PCGRL scores 0–1.** It needs dense rewards plus training infrastructure, and gains nothing over grammar plus repair.
- **LLMs score 1 for layout.** Word2World-style LLM tile placement works, but layout is necessary content and should stay deterministic and testable.

### 3.3 Design ideas by subsystem

- **Department concept generation.**
  - The *exhibition brief* is Liapis et al.'s frame. Fields:
    - a Calvino-style one-sentence conceit;
    - a shared tag vocabulary: material, region, epoch flavour, mood, motif;
    - a challenge-type vector: melee, ranged, swarm, observation/stealth, hazard, attrition, gate-puzzle;
    - 1–2 modules from the authored library;
    - bestiary *roles*: skirmisher, artillery, guardian, swarm, ambusher, elite, centrepiece;
    - a signature artifact;
    - an architectural style;
    - a palette seed;
    - a label voice ("dry 1920s registrar", "breathless audio guide", "translated from a lost catalogue").
  - Produce briefs offline: an LLM acts as the mutation operator in a MAP-Elites archive (the GAVEL / `scriptprof` pattern), with descriptors such as dominant challenge type × spatial character.
  - Checks run, then Julian curates. Following CrawLLM, *specificity* is an acceptance criterion.
- **Sequencing.**
  - Difficulty comes from depth; the department supplies the challenge type.
  - Branching floor plan with 2–3 signposted doors per transition ("→ Hall of Instruments for Measuring Regret").
  - Constraints:
    - offered doors differ in dominant challenge type;
    - consecutive departments sit in a moderate-distance band (EDRL);
    - no repeats within a run;
    - every k departments, a service room: gift shop (merchant), conservation lab (upgrades) or cloakroom (stash).
- **Layout.**
  - Path: entrance hall with intro panel → a loop or enfilade of galleries with cabinet spurs → landmark rotunda or court → exit, usually via the gift shop.
  - Gates are diegetic: "Gallery closed for reinstallation" (key from a guard) and "Staff Only" (keyring).
  - Rooms are parametric templates by style: Beaux-Arts symmetric, white cube, cabinet of curiosities, period rooms, storage stacks.
  - Axial mirroring is cheap and instantly reads as "museum".
- **Exhibit placement.**
  - Every exhibit has a label tile.
  - Rope lines are soft cover; vitrines are destructible loot and cover; benches are rest spots.
  - **Enemies begin as exhibits**, dormant on plinths or in cases with labels until disturbed. "Enemies drawn from the topic" becomes literal and teachable.
- **Enemies.**
  - A finite authored archetype library, tuned offline by persona-bot fights in a QD archive: charger, artillery, splitter, "statue" (moves only when unobserved), mimic vitrine, guard (alarm → summon), curator-boss.
  - Department skins supply name, specimen label and palette.
  - The behaviour → trim-colour grammar is constant across departments (F11).
- **Items.**
  - Roguelike identification becomes **attribution**: "Unattributed" → "Attributed to… / Workshop of…", through use or a provenance-research consumable.
  - Unidentified appearances are shuffled per seed.
  - Effects come from an authored library, balanced offline by constrained surprise or QD (p. 291).
  - One signature artifact per department.
- **NPCs.** Docent (hints, lore), guard (neutral until alarm), conservator (repairs), a recurring rival visitor, a gift-shop clerk. Chatter is written offline per department and picked at runtime.
- **Text, in three layers:**
  1. The intro panel: offline LLM, curated.
  2. Object labels: runtime grammar over offline fragments.
  3. **Functional labels** stating real mechanics in museum voice ("Specimen is known to remain motionless while observed"). These are generated *from* mechanic tags and verified.

  A deliberately unreliable catalogue can be a rule-checked *module*, never an accident.
- **Visuals.**
  - Archetype sprites drawn in code, recoloured from the brief palette with a contrast floor.
  - Small ornament grammars, e.g. L-system plants for a botanical department (p. 255).
  - One frame per architectural style.
- **Audio.** WebAudio ambient per department, with tension from the encounter budget (Sonancia) and sfxr-style effects (p. 292).
- **Difficulty.** Depth sets the budget. The department distributes it over its challenge types. Bots measure realized difficulty, and offline tuning pulls it onto the intended ramp.
- **Player choice:** doors; whether to loot a vitrine and trigger the alarm; optional galleries; which artifact to accession.
- **Meta-progression.**
  - **Accession** one artifact per department into a personal-collection hub, the "Museum of You". This is player-generated content in the book's sense (p. 243).
  - A **catalogue** of departments seen, which needs a finite catalogue.
- **Tooling.** Node scripts:
  - `brief-gen`: LLM + QD + checks.
  - `curate`: an HTML accept / edit / reject UI that logs reasons.
  - `simulate`: headless personas.
  - `era`: expressive-range heatmaps.

  The shipped game embeds the curated catalogue as JSON in the single HTML file.

### 3.4 Orchestration blueprint (§14.1.2 + Liapis et al. 2019)

1. **Frame** = the exhibition brief: offline and curated (the "composer").
2. **Directors**, deterministic, one per facet:
   - *Architect*: style, size, gates, sightline needs.
   - *Keeper of Specimens*: roles × depth budget → bestiary.
   - *Registrar*: item pool and accession scheme.
   - *Exhibition Designer*: vitrines, palette, floors.
   - *Label Writer*: voice and templates.
   - *Sound*.
3. **Cross-facet coupling rules:**
   - Bestiary → layout, Karavolos-style: artillery means long galleries with pillars; swarm means chokepoints; statue means long sightlines.
   - Mechanics → labels: labels must be truthful.
   - Archetype → trim colour.
   - Tension → audio.
   - Centrepiece → landmark room.
4. **Primitives:** constructive and seeded.
5. **Post-production / repair:**
   - reachability and gate order;
   - label adjacency;
   - contrast floor;
   - spawn fairness (no enemy within N tiles of the entrance);
   - text fit.
6. **Shared tag vocabulary** for cheap coherence checks: the "common labels" shortcut. The free-text skin restores richness.

Any "creative maestro" reinterpretation by the LLM happens offline, where the curator can veto it.

### 3.5 Evaluation plan (from §9.7)

1. **Prerequisite:** a pure-state core with a forward model (p. 428), headless, with seed-locked regression snapshots.
2. **Expressive range** per brief (1,000 samples).
   - Metrics:
     - room count;
     - entrance→exit path length;
     - branching;
     - dead-end ratio;
     - loops;
     - symmetry;
     - open-floor ratio;
     - exhibit density;
     - role mix;
     - mean sightline.
   - Plot heatmaps on pairs of metrics, as in Fig. 9.9 (p. 308).
   - **Oatmeal test** (my proposal): between-department distance divided by within-department dispersion, on these descriptors and on bot-play descriptors. A ratio near 1 means theming isn't changing content.
3. **QD archives** for briefs, enemies and items: coverage, QD-score (p. 307), and inspection of empty cells.
4. **Persona bots** (pp. 216, 307):
   - Personas: Runner, Curator (loots every vitrine), Vandal, Survivor.
   - Competence tiers: random, greedy, search on the forward model.
   - Metrics per department and depth:
     - survival, turns, HP lost, consumables used;
     - **damage-source mix** (realized challenge fingerprint vs the brief's intended vector);
     - **skill gap** (strong minus weak win rate, [802], p. 299) as a depth proxy;
     - **style gap**: are several playstyles viable?
5. **Run-level metrics:**
   - Is difficulty monotone in depth?
   - How much outcome variance comes from department order vs skill?
   - What share of seeds are dead, i.e. unwinnable by the strong bot?
6. **Text checks:**
   - tombstone fields complete;
   - length budget;
   - **fact consistency**: re-extract claims from functional labels and diff them against tags;
   - banned-entity filter;
   - a sampled human read.
7. **Humans:**
   - (a) The curation log itself, as designer annotations (p. 309).
   - (b) The **CrawLLM theme-recognition protocol**: show a screenshot or label and ask which of 4 departments it is.
   - (c) Pairwise department preferences on distinctness, "museumness" and fun. This follows the ranked-pairs design of Pedersen, Togelius & Yannakakis, IEEE TCIAIG 2(1), 2010 [848] (p. 249).
   - (d) A few think-aloud sessions.
   - (e) Calibrate bots against humans [790] (Nelson, AIIDE workshop 2011).
8. **Scorecard** of the PCG book's desirable properties (2016, pp. 6–7), per generator: speed, reliability, controllability, expressivity/diversity, creativity/believability.

---

## 4. Pitfalls and risks

1. **Oatmeal.** Literal infinity with perceptual sameness (p. 270, [680]). Measure distinctness, not count.
2. **Decorative-only departments.** If departments change only words and colours, players skip labels and the museal premise dies. Every department needs a functional fingerprint that bots can detect.
3. **LLM failure modes.**
   - From the book: hallucination (p. 305), ungrounded fluency (p. 220), weak controllability (p. 430).
   - From CrawLLM: prompts must be "meticulously crafted and tuned to match the game mechanics".
   - My own, not from the book: convergence on one house "Borges pastiche" voice (LLM oatmeal), and labels that misdescribe mechanics.
   - Mitigations: verification passes, diversity pressure in the archives, curator veto.
4. **Impersonation and IP.** The brief invokes the Met and the British Museum. Generated text must not name or imitate real institutions, curators or donors. The book flags copyright issues in LLM content (p. 439). Use a banned-entity filter and invented credit lines.
5. **Generated rules** (p. 300). Use a module library.
6. **Runtime search latency** (p. 269). Keep EA and QD offline.
7. **Constructive methods give no playability guarantee** (pp. 260, 263). Use repair plus a diegetic safety valve (p. 288).
8. **Bots aren't humans** (p. 309). Metric design takes "practical wisdom" (pp. 306–307), and deep RL can't even play NetHack well (p. 215). Use search over a forward model and calibrate against a few humans.
9. **No forward model** if rendering leaks into game logic (p. 428). This is a day-one architecture decision.
10. **Filter bubble** from over-adaptation (p. 445).
11. **Pixels can't carry epoch** (CrawLLM: epoch was the hardest descriptor). Labels, architecture and music must carry period.
12. **Mastery vs novelty** (my argument). Roguelike progression is largely knowledge of enemies and items. Endless novelty with no stable vocabulary leaves nothing to learn. Keep a finite mechanical vocabulary under the varying skin.
13. **House convention.** Runtime LLMs need network access, keys and money, which breaks the repo's single-file, no-dependency norm.

---

## 5. Decisions for the design discussion

**D1. Department supply.**
- (a) Hand-authored, ~20–30.
- (b) **Offline-generated, curated catalogue** of ~100–300: LLM proposals in a QD archive, plus checks, plus Julian's accept / edit / reject.
- (c) Runtime combinatorial grammar: infinite, from authored parts.
- (d) Runtime LLM: infinite, online.

*Lean: (b), with (c)-style variation inside each department, and optionally (d) later as an "Uncatalogued Wing" behind a user-supplied API key, using the same checks.* Reasons:
- the book values distinct, valuable content rather than quantity (pp. 26, 270, 305);
- appreciation must come from somewhere (p. 426);
- a finite catalogue supports collection meta-progression and community knowledge;
- (b) keeps the single-file convention.

**D2. Where the LLM sits.**
- (a) Nowhere.
- (b) **Offline only**: briefs, label fragments, chatter.
- (c) Offline plus runtime text.
- (d) Runtime functional content.

*Lean: (b).* This follows p. 430's "multiple steps… check and repair", with all functional content deterministic.

**D3. What a department may change mechanically.**
- (a) Skin only.
- (b) **Skin + selection from an authored module library** (hazards, archetype mix, item families, one signature rule).
- (c) Generated rules.

*Lean: (b), with one signature module per department at first.* The module library becomes the main content investment. (c) is ruled out by p. 300.

**D4. Layout method.**
- (a) Rooms-and-corridors / BSP.
- (b) **Museum floor-plan grammar + parametric rooms + repair.**
- (c) WFC-first.
- (d) Stitched prefabs.

*Lean: (b), with (d) for landmark rooms and WFC/CA as per-department variants.* Only (b) makes the space read as a museum.

**D5. Run structure.**
- (a) Linear random order.
- (b) **Branching floor plan with 2–3 signposted doors.**
- (c) Open hub.

*Lean: (b).* Doors differ in challenge type, consecutive departments stay at moderate distance, and difficulty follows depth.

**D6. Adaptivity.**
- (a) None.
- (b) **Novelty-driven door offers** (prefer what this player hasn't seen recently).
- (c) Full EDPCG / dynamic difficulty.

*Lean: (b).* It is legible and avoids the filter bubble.

**D7. Meta-progression.**
- (a) **Accession** one artifact per department into a personal-collection hub.
- (b) Catalogue completion (needs a finite catalogue).
- (c) Stat or skill store.
- (d) Mix.

*Lean: (a)+(b), with a thin (c)* ("membership tiers" unlocking starting kits).

**D8. Evaluation before scaling content.**
- (a) Seed regression only.
- (b) **Headless forward model + persona bots + expressive-range / oatmeal metrics from the first playable.**
- (c) Add QD archives and a human theme-recognition study.

*Lean: (b) now, (c) at about 30 briefs.* D1(b) is impossible without (b).

**D9. Visuals.**
- (a) **Archetype sprites drawn in code + palette and parts variation.**
- (b) Body-part sprite grammars.
- (c) Offline diffusion → pixel conversion.

*Lean: (a), adding (b) for specimen-heavy departments.* (c) breaks the house style and inherits CrawLLM's consistency and pose limits.
