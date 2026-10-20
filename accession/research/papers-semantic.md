# Generating meaningful departments: semantic PCG, data games, LLMs, and "infinite or curated?"

Research brief for the museum-roguelike design document. Topic: how to generate *whole, thematically coherent* museum departments (theme, exhibits, creatures, items, NPCs, wall text) and how to answer "literally infinite departments (via LLMs?) or a pre-generated set?". Written for Julian; I have tried to read the papers rather than recall them, and I mark anything I did not read.

**Bottom line.**
1. Every strand of the literature, from Data Games (2013) through Caves of Qud (2017) to GAVEL and ScriptDoctor (2024–25), says the same thing: generated *meaning* only reads as variety when it is wired to *mechanics*. Decorative theming becomes oatmeal fast. So the central design artefact is a closed, authored **mechanical vocabulary** that department concepts compile into, not the concepts themselves.
2. LLMs are today's "open data": a vast, biased, trope-heavy association engine. Treat them the way the Data Adventures line treated Wikipedia: select, transform, validate, curate.
3. Lean: **an offline LLM pipeline that writes inside a schema, followed by simulation and then human curation, shipped as a data pool** ("the Permanent Collection", tens to low hundreds of departments). Add a cheap grammar-generated **Directory** that makes the museum *feel* infinite, and later, optionally, cached "Temporary Exhibitions" and player commissions. Do not put an LLM on the critical path at runtime.
4. Learnability: keep behaviour archetypes, silhouettes and label pictograms constant across departments. Then the museum label *is* the bestiary, and players' roguelike knowledge transfers even when the skin is new.

---

## 1. Sources actually read

Depth codes: **F** = read in full or nearly so; **S** = read the relevant sections; **A** = abstract and intro only; **NR** = not read, citation verified from a reference list or publisher listing.

**Data games line (Togelius et al.)**
1. M. Gustafsson Friberger, J. Togelius, A. B. Cardona, M. Ermacora, A. Mousten, M. Møller Jensen, V. Tanase, U. Brøndsted (2013). "Data Games." *4th Workshop on Procedural Content Generation in Games (PCG@FDG 2013).* http://julian.togelius.com/Friberger2013Data.pdf — **F**
2. G. A. B. Barros, A. Liapis, J. Togelius (2015). "Data Adventures." *FDG Workshop on PCG 2015.* http://julian.togelius.com/Barros2015Data.pdf — **S** (intro and pipeline)
3. G. A. B. Barros, A. Liapis, J. Togelius (2016). "Playing with Data: Procedural Generation of Adventures from Open Data." *DiGRA/FDG 2016.* http://julian.togelius.com/Barros2016Playing.pdf — **S**
4. G. A. B. Barros, A. Liapis, J. Togelius (2016). "Murder Mystery Generation from Open Data." *ICCC 2016.* http://julian.togelius.com/Barros2016Murder.pdf — **S**
5. G. A. B. Barros, M. C. Green, A. Liapis, J. Togelius (2019). "Who Killed Albert Einstein? From Open Data to Murder Mystery Games." *IEEE Transactions on Games* 11(1):79–89. doi:10.1109/TG.2018.2806190, arXiv:1802.05219 — **F**
6. M. C. Green, G. A. B. Barros, A. Liapis, J. Togelius (2018). "DATA Agent." *FDG 2018.* doi:10.1145/3235765.3235792, arXiv:1810.02251 — **S**
7. G. A. B. Barros, M. C. Green, A. Liapis, J. Togelius (2018). "Data-driven Design: A Case for Maximalist Game Design." *ICCC 2018.* arXiv:1805.12475 — **F**

**Orchestration and the book**
8. A. Liapis, G. N. Yannakakis, M. J. Nelson, M. Preuss, R. Bidarra (2019). "Orchestrating Game Generation." *IEEE Transactions on Games* 11(1):48–68. doi:10.1109/TG.2018.2870876 — **S** (§§I, IV, VII-B/C, VIII, IX)
9. G. N. Yannakakis, J. Togelius (2025). *Artificial Intelligence and Games*, 2nd ed., Springer. — **S**: §8.3 (pp. 270–271), §8.5.4 (pp. 279–281), §9.4 (pp. 295–298), §9.7 (pp. 305–307), §14.1.2 (pp. 425–426), "Text-to-Game" (p. 430). The book is covered in depth in the sibling brief `book-pcg.md`.

**LLM-era work with Togelius as co-author**
10. G. Todd, S. Earle, M. U. Nasir, M. C. Green, J. Togelius (2023). "Level Generation Through Large Language Models." *FDG 2023.* doi:10.1145/3582437.3587211, arXiv:2302.05817 — **S**
11. M. U. Nasir, J. Togelius (2023). "Practical PCG Through Large Language Models." *IEEE CoG 2023.* arXiv:2305.18243 — **A**
12. R. Gallotta, G. Todd, M. Zammit, S. Earle, A. Liapis, J. Togelius, G. N. Yannakakis (2024). "Large Language Models and Games: A Survey and Roadmap." *IEEE Transactions on Games.* arXiv:2402.18659 — **S** (§§3.7–3.9, 4, 5, 6)
13. M. U. Nasir, S. James, J. Togelius (2024). "Word2World: Generating Stories and Worlds through Large Language Models." arXiv:2405.06686 (the PDF carries an AAAI copyright line; the venue is unverified) — **S**
14. G. Todd, A. Padula, M. Stephenson, É. Piette, D. Soemers, J. Togelius (2024). "GAVEL: Generating Games via Evolution and Language Models." *NeurIPS 2024.* arXiv:2407.09388 — **S** (§§3–4, 6.2, 7)
15. S. Earle, A. Khalifa, M. U. Nasir, Z. Jiang, G. Todd, A. Banburski-Fahey, J. Togelius (2025). "ScriptDoctor: Automatic Generation of PuzzleScript Games via Large Language Models and Tree Search." *IEEE CoG 2025.* doi:10.1109/CoG64752.2025.11114269, arXiv:2506.06524 — **F**
16. S. Earle, F. Kokkinos, Y. Nie, J. Togelius, R. Raileanu (2024). "DreamCraft: Text-Guided Generation of Functional 3D Environments in Minecraft." *FDG 2024.* arXiv:2404.15538 — **A** (the brief says it won best paper; I did not verify that)
17. Y. Nie, M. Middleton, T. Merino, N. Kanagaraja, A. Kumar, Z. Zhuang, J. Togelius (2025). "Moonshine: Distilling Game Content Generators into Steerable Generative Models." *AAAI 2025*, 39(13):14344–14351. arXiv:2408.09594 — **A+S**
18. T. Merino, R. Negri, D. Rajesh, M. Charity, J. Togelius (2023). "The Five-Dollar Model: Generating Game Maps and Sprites from Sentence Embeddings." *AIIDE 2023.* arXiv:2308.04052 — **A**
19. A. Anjum, Y. Li, N. Law, M. Charity, J. Togelius (2024). "The Ink Splotch Effect: A Case Study on ChatGPT as a Co-Creative Game Designer." *FDG 2024.* arXiv:2403.02454 — **A+S**
20. R. Nair, T. Merino, J. Togelius (2025). "God's Innovation Project — Empowering the Player with Generative AI." arXiv:2504.13874 — **S**
21. Y. Wen, C. Huang, H. Zhou, Z. Zeng, Y. Weng, T. Merino, J. Togelius, M. Kreminski, S. Earle (2026). "The Garden of Forking Paths: Threading Narrative Archetype as a Semantic Signal Through Gameplay Planning." arXiv:2605.01245 — **S**
22. Y. Wen et al. incl. J. Togelius, S. Earle (2025). "All Stories Are One Story: Emotional Arc Guided Procedural Game Level Generation." arXiv:2508.02132 — **A**
23. M. U. Nasir, Y. Li, S. James, J. Togelius (2026). "Mortar: Evolving Mechanics for Automatic Game Design." *GECCO 2026.* arXiv:2601.00105 — **A+S**
24. S. Earle, K. Arulkumaran, A. Dai, A. Kumar, J. Togelius, S. Risi (2026). "In Search of the Ingredients of Open-Endedness: Replicating Picbreeder with Large Vision-Language Models." *GECCO 2026.* arXiv:2605.23908 — **S**
25. M. Siper, A. Khalifa, J. Togelius (2026). "Procedural Content Metageneration via Program Search and Continual Abstraction Discovery." *IEEE CoG 2026.* arXiv:2608.17947 — **A**
26. M. Siper, A. Khalifa, J. Togelius (2026). "ELMER: Evolutionary Language Model that Explores and Refines." arXiv:2608.10196 — **A**
27. M. Edwards, J. Togelius (2026). "Nonslop: A Gamified Experiment in Human-AI Collaborative Writing." *IEEE CoG 2026.* arXiv:2606.12350 — **A**
28. T. Merino, S. Earle, R. Sudhakaran, S. Sudhakaran, J. Togelius (2024). "Making New Connections: LLMs as Puzzle Generators for The New York Times' Connections Word Game." arXiv:2407.11240 — **A**

**Non-Togelius essentials**
29. K. Compton (Feb 2016). "So you want to build a generator…" Blog post. https://galaxykate0.tumblr.com/post/139774965871/so-you-want-to-build-a-generator — **F** (the source of "10,000 bowls of oatmeal")
30. E. Short (21 Sep 2016). "Bowls of Oatmeal and Text Generation." Blog post. https://emshort.blog/2016/09/21/bowls-of-oatmeal-and-text-generation/ — **F**
31. J. Grinblat, C. B. Bucklew (2017). "Subverting Historical Cause & Effect: Generation of Mythic Biographies in Caves of Qud." *FDG 2017.* doi:10.1145/3102071.3110574, PDF: https://www.freeholdgames.com/papers/Generation_of_mythic_biographies_in_Cavesofqud.pdf — **F**
32. J. Grinblat, C. B. Bucklew (2020). "Warm Rocks for Cold Lizards: Generating Meaningful Quests in Caves of Qud." *Joint Proceedings of the AIIDE 2020 Workshops*, CEUR-WS Vol-2862, paper 5. https://ceur-ws.org/Vol-2862/paper5.pdf — **F**
33. M. Cook, S. Colton (2014). "A Rogue Dream: Automatically Generating Meaningful Content for Games." *AIIDE Workshop on Experimental AI in Games.* https://ojs.aaai.org/index.php/AIIDE/article/view/12745 — **F**
34. M. Zammit, A. Liapis, G. N. Yannakakis (2024). "CrawLLM: Theming Games with Large Language Models." *IEEE CoG 2024.* doi:10.1109/CoG60054.2024.10645576 — **F**. I also read the longer journal version, "CrawLLM: An LLM-Based Pipeline for Game Asset Generation" (venue unverified), §§IV–V.
35. H. Bradley, A. Dai, H. Teufel, J. Zhang, K. Oostermeijer, M. Bellagente, J. Clune, K. Stanley, G. Schott, J. Lehman (2023). "Quality-Diversity through AI Feedback." arXiv:2310.13032 (ICLR 2024 from memory; unverified) — **S** (§§1–3, 6, Fig. 5)
36. J. Lehman, J. Gordon, S. Jain, K. Ndousse, C. Yeh, K. O. Stanley (2022). "Evolution through Large Models." arXiv:2206.08896; also a chapter in the *Handbook of Evolutionary Machine Learning* (Springer, 2023) — **A+S**
37. L. Jiang et al. (2025). "Artificial Hivemind: The Open-Ended Homogeneity of Language Models (and Beyond)." *NeurIPS 2025 Datasets & Benchmarks.* arXiv:2510.22954 — **A**
38. R. Schaeffer, B. Miranda, J. Kazdan, J. Chudnovsky, S. Koyejo (2026). "How Strong Is the Evidence for the Artificial Hivemind?" arXiv:2609.33936 — **A**
39. B. R. Anderson, J. H. Shah, M. Kreminski (2024). "Homogenization Effects of Large Language Models on Human Creative Ideation." *C&C 2024.* arXiv:2402.01536 — **A**
40. P. J. Wang, M. Kreminski (2024). "Guiding and Diversifying LLM-Based Story Generation via Answer Set Programming." *Wordplay @ ACL 2024.* arXiv:2406.00554 — **A**
41. M. Zammit, A. Liapis, G. N. Yannakakis (2024). "MAP-Elites with Transverse Assessment for Multimodal Problems in Creative Domains." *EvoMUSART 2024.* arXiv:2403.07182 — **A**
42. J. Zhang, J. Lehman, K. Stanley, J. Clune (2023). "OMNI: Open-endedness via Models of human Notions of Interestingness." arXiv:2306.01711 — **A**

**Repo**
43. `scriptprof/README.md`, `scriptprof/NOTES.md` (the "Structural mutation instead of a language model" and "The novelty term got gamed" sections), `scriptprof/FINDINGS.md` (operator comparison), and a skim of `scriptprof/js/evolve.js` — **S**

**Cited but not read (NR):** Tracery (K. Compton, B. Kybartas, M. Mateas, *ICIDS 2015*, pp. 154–161); Game-O-Matic (M. Treanor, B. Blackford, M. Mateas, I. Bogost, *PCG Workshop 2012*), which I know only through Liapis et al. 2019 §VII-B; LLMaker and "Consistent game content creation via function calling for LLMs" (R. Gallotta, A. Liapis, G. N. Yannakakis, both *IEEE CoG 2024*, via the survey's refs [125, 126]); D. Karavolos, A. Liapis, G. N. Yannakakis, "Learning the patterns of balance in a multi-player shooter game" (*PCG Workshop 2017*, via the book's ref 531); G. Smith, J. Whitehead, "Analyzing the expressive range of a level generator" (*PCG Workshop 2010*); M. R. Johnson, "Towards Qualitative Procedural Generation" (*CCGW 2016*, via Grinblat & Bucklew's ref [8]); T. X. Short, T. Adams (eds.), *Procedural Storytelling in Game Design* (CRC Press, 2019), confirmed from the publisher listing only.

---

## 2. Key findings

**F1. The museum is a textbook data-games target, and the data-games taxonomy had empty cells exactly where we need them.** Friberger et al. 2013 (§2.8) list *MuseumVILLE*, in which the player curates exhibitions from Europeana images. Their Table 1 (§3.4) lists the data transformations "rules", "dialogue" and "enemies and NPCs" with **"No examples"**. They also note that the most powerful transformation may not be the literal one: "transforming, for example, political arguments into spells" (§3.4).
→ *Museum (department concept generation, enemies, NPCs):* our game fills those empty cells: exhibits become enemies, docents become NPCs, collecting policies become rules. The "perspective change" line is the Calvino move: a department of *weather instruments* whose enemies are barometers that change the floor's pressure.

**F2. Design-by-data is "selecting and ordering data to fit genre conventions".** Barros et al. 2015 (§1): "the real world already contains almost everything we need … design is mostly a matter of selecting and ordering data so as to fit with genre conventions." They also note that "simply generating random names and descriptions is likely to lead to an underwhelming experience."
→ *Concept generation, tooling:* swap "Wikipedia" for "LLM" and the sentence describes our pipeline. The genre conventions to fit are *two*: roguelike conventions and museum conventions (tombstone labels, credit lines, accession numbers, section panels). Treat both as hard schema.

**F3. Two axes for any data-driven content: transformation vs. fidelity, and functional vs. decorative.** Barros et al. 2018 ("Designing Games for Maximalism"). A Rogue Dream's ability names are *decorative*: "the in-game effects of the abilities are not affected by their names". OpenTrumps data is *functional*. In the "Human Computation" section they propose that players flag bad generated content with a "report" button and that the generator learns from it.
→ *All subsystems:* every generated department must land in the *functional* half. A department's theme must change what you do, not just what you read. The report-button idea is directly usable as telemetry for pool curation.

**F4. Uncontrolled association sources produce hilarious, absurd and sometimes offensive juxtapositions, and filtering cannot fully prevent them.** WikiMystery (Barros et al. 2019, §IX, Fig. 6): an image of Confucius is assigned to Hermann Einstein next to the dialogue line "Ask about Jews". The 8 most popular locations across 100 games were in North America (Barros et al. 2018, "Misinformation & Bias"). Cook & Colton 2014 ("Discussion"): A Rogue Dream felt "like playing a videogame against The Internet", and its data is "tainted by popular belief, misconception, stereotype and prejudice"; the input *man* yields the ability to "lie and cheat".
→ *Text and labels, NPCs, guardrails:* LLMs inherit exactly this, especially for "faraway lands". Rule: all cultures are fictional; no real ethnic, religious or national markers; no ethnographic-display tropes. The British Museum framing invites colonial-collection politics, so engage with that only on purpose.

**F5. Generated text needs a functional typology.** DATA Agent (Green et al. 2018, Table 1) types every dialogue line as **Essential**, **Fact-giving** or **Flair**.
→ *Text and labels:* adopt the typing for wall text. Essential lines carry mechanics ("Please do not touch" means contact damage). Fact-giving lines carry knowledge you can use (weak points, puzzle clues). Flair is Calvino. The generator must emit at least one Essential and one Fact-giving line per exhibit.

**F6. The theme-to-mechanics link is the hard, unsolved part, and naive systems quietly decouple it.** Liapis et al. 2019 (§VII-C): A Rogue Dream matches verbs from Google autocomplete to a pre-scripted ability list, "if no match is found, a random ability is linked to the verb (i.e. there is a fallback that decouples narrative and rules, if orchestration is impossible)", and "the level generator however was not connected to the remaining facets". Game-O-Matic (§VII-B) lets authors use *any* entity, but verbs "must be chosen from a pre-determined yet extensive list" that maps to mechanics by rule.
→ *Department concept generation, enemies, items:* this is the core design pattern: **open nouns, closed verbs**. The LLM may invent any exhibit; it must pick its behaviour from our authored archetype list. And never allow a silent random fallback: an unmatched concept is rejected, not reskinned.

**F7. Orchestration: a top-down "frame", shared labels, and a post-production repair step.** Liapis et al. 2019 §IV-A: a generated or human "frame" (a general game description) drives facet directors and then specialised generators. §IV-B3: "using common labels between generators … would allow for a fairly simple coherency evaluation. This shortcut comes at the cost of expressiveness." §IV-C2: the "fake sheet", the minimal frame that all generators improvise on. §IV-C4: post-production (repair) "could be considered the main method for orchestration itself". The book makes the same point for LLMs (p. 430): their power "can be amplified (and its shortcomings mitigated) by dividing up the generation process in multiple steps, and using other algorithms to check and repair its outputs, as is done in e.g. the Word2World game generator".
→ *Tooling and pipeline:* the **Department Frame** is our fake sheet, and its shared tags (domains, challenge type, palette slots) are the common labels. Accept the expressiveness cost in exchange for coherence checks that are mechanical.

**F8. LLMs are strong at semantics and weak at space and numbers.** Todd et al. 2023 (§7.3): prompt control over Sokoban *solution length* hit 17% accuracy, which is chance level, and the combined condition stayed at or below 3%. Small datasets yield levels that are novel *or* playable but not both (§7.2). ScriptDoctor (Tables I–II): without few-shot human games, 30% compile and 0% solvable. With them, GPT-4o/o1/o3-mini compile 67/87/93% and have *all* levels solvable in only 7/7/20% of games, and "ScriptDoctor outputs levels that admit overly short solutions" (§VI). Practical PCG (Nasir & Togelius 2023): 37% playable-and-novel from 60 rooms with human-in-the-loop fine-tuning.
→ *Layout, difficulty and balance:* the LLM never writes layouts or stat numbers. It picks *roles* ("fragile glass-cutter: hits hard, breaks easily"). A deterministic balancer converts roles to numbers by difficulty tier, and a constructive generator (sibling brief `papers-levels.md`) builds space.

**F9. Decomposition plus repair loops buy reliability, and homogeneity remains.** Word2World (Ablation results; Discussion): 9 of 10 worlds playable with the full multi-step pipeline, against 60% with one round. Limitations include "game mechanics are predefined", cost of "around $0.5 to $1 per generation", and, tellingly, **"Stories generated follow almost the same set of events placed in different environments."** Tiles are chosen by embedding retrieval from a hand-labelled library (473 environment and 213 character rows).
→ *Concept generation, visuals:* expect structural sameness under surface variety from naive prompting. Retrieval from a labelled authored library is a good, cheap pattern for sprites and furniture.

**F10. LLM themes gravitate to tropes and vagueness, and only specific themes survive into visuals.** CrawLLM (CoG 2024 §§II–IV; journal version §V). There were 20 *pre-generated, uncurated* themes, because sequential asset generation was too slow to do live. Prompts "have to be meticulously crafted and tuned". Enemies were limited to humanoids by the pose templates. Users recognised setting but not epoch or style. Themes came through "only when all such details were highly specific (e.g., when describing a particular place rather than a general genre trope)". The generated set contained near-duplicates ("Gothic Victorian" / "Victorian era") and trope magnets ("mystical underwater cities", "asteroid mining").
→ *Concept generation, testing:* enforce specificity: concrete nouns, a named material, a named practice. Dedupe the pool on meaning, not on strings.

**F11. Homogeneity is a real but contested property of LLMs, and symbolic structure and noise counteract it.** Jiang et al. 2025 report intra-model repetition and inter-model homogeneity in open-ended prompts. Schaeffer et al. 2026 argue the evidence is weaker than claimed and that *prompting reliably raises measured diversity*. Anderson et al. 2024: ChatGPT-assisted users produced less semantically distinct ideas across users. Wang & Kreminski 2024: answer-set-programming outlines make LLM stories more diverse than unguided generation. Garden of Forking Paths (§5): **generate-first-constrain-later gave 2.6× the entity diversity (0.678 vs 0.261) of a hierarchical baseline that conditions each plot on the previous framing**. Picbreeder-VLM (§1, §6): VLM "users" mode-collapse; small exploratory noise and more behaviourally diverse agents help, and *more* context led to "pathological behavior".
→ *Concept generation, sequencing:* do not chain departments ("next, a department related to the last one"). Generate many candidates independently with varied seeds, constraint cards and personas, then select into a diversity archive. Keep context per call small.

**F12. A semantic signal can be carried through to mechanics and verified by a bot.** Garden of Forking Paths (§§4.3, 4.4.2, 5): a "shared symbolic schema preserves narrative entities and gameplay configurations". Narrative threat conditions encounter composition, and damage taken by a *threat-blind* scripted agent rises with it (Spearman ρ = 0.494). Art is "schema-constrained": the LLM emits validated vector primitives in two stages (silhouette category, palette slots, features, cached per entity; then layers), with a repair pass on invalid output.
→ *Difficulty, visuals, testing:* this is the validation template. A department claims "attrition challenge", and a frame-blind bot's resource curve must show attrition. Sprites can be *spec'd* by the LLM and *drawn* by our code.

**F13. QD around a language-model operator gives diverse, valid archives, but the descriptors must be semantic and the judges are hackable.** GAVEL (§4, §6, §7): MAP-Elites over PCA of Ludii's semantic "concepts". From 14 held-out seeds it produced 185 novel games in 500 generations: 130 playable, 62 in cells no Ludii game occupies. Its failure modes: "unused game components" (dice added but never used), shared features inherited from seeds, and reliance on expert evaluators to pick the interesting ones. QDAIF (§6, Fig. 5): AI-judged quality decorrelates from human judgment above 0.995 fitness ("reward hacking"), and diversity axes still have to be named by hand. ELM: a few hand-written seeds plus LLM mutation inside MAP-Elites bootstrap a corpus, which then trains a *conditional* generator.
→ *Testing, pool management:* use a MAP-Elites archive over **mechanical** descriptors (challenge type × theme category × difficulty profile). Never ship an AI-judge's top-1 unseen. Check for unused components.

**F14. In this repo, a grammar operator beat the LLM operator on throughput and validity, and the novelty term was gamed.** `scriptprof/NOTES.md`: the Ollama LLM operator took "roughly a minute per mutation". The structural grammar operator produced 96.6% compiling children at 864 µs per edit, "roughly 3000x" faster. `FINDINGS.md`: the LLM's contribution must be measured "as quality per unit time" and by "whether its children land in archive cells the grammatical operator cannot reach". `NOTES.md`, "The novelty term got gamed": after ~9,000 candidates, the top elite had added the no-op win condition `Some Background` twice, which changed the concept vector and nothing about play.
→ *Tooling, testing:* build a grammar or combinatorial department operator first, as a baseline and fallback. Measure novelty on *played behaviour* or mechanics, never on declared tags or text alone.

**F15. Caves of Qud shows how to get coherent, characterful lore cheaply: domains, state, a replacement grammar, and rationalisation after the fact.** Grinblat & Bucklew 2017 (§§3–6). Each sultan gets an archetypal **domain** (glass, jewels, ice, stars, might, scholarship, chance…). Events are chosen *at random*, then their causes are rationalised from the sultan's state ("the effect causes the cause", §4.3). A Tracery-like grammar keyed by domain supplies text ("domains act as narrative threads", §4.4). **Items named in the history are instantiated in the world with mechanics:** the hammer Frostycus Catsfriend deals frost damage and grants reputation with cats (§4.6). All of this comes from just **10 domains and 19 events** (§6). The weak spot: coherence only emerged once players could juxtapose fragments in a journal (§5). The 2020 quest paper adds a two-phase world-gen/zone-gen with annotations, and an aesthetic of "let our generators run wild … but ensure that they smooth the rough edges off their output".
→ *Text and labels, items, meta-progression:* a department is a Qud sultan. Each has 2–3 domains, a generated **collector or founder biography** whose named objects become the department's unique, keepable artifact, and labels written from state. Ship a **Catalogue** UI, because the coherence lives there.

**F16. Oatmeal is avoided by mechanical consequence, plus a few characterful pieces among background.** Compton 2016 ("Aesthetics: the toughest challenge"): "Perceptual uniqueness is the real metric"; perceptual *differentiation* is an easier bar; "many artifacts can [be] drab background noise, highlighting the few characterful artifacts". Short 2016: "the key question in oatmeal-avoidance is whether the generation is connected to anything mechanical … all that generation is purely decorative unless it is tightly correlated with gameplay — and the player will soon realize that it is decorative and start looking past it". Procgen text works well as "low-level, layered consequence" of state.
→ *Exhibit placement, text:* per department, author or generate **1 centerpiece, 2–3 highlights, and many study-collection cases**. Only the first two tiers need full LLM labels. The rest come from the runtime grammar, perceptually differentiated but not unique.

**F17. Runtime LLM generation is slow, costly, non-deterministic, and best hidden behind a game mechanic.** Survey §5: "real time" design responses take "around 30 seconds to over a minute". LLM cost is "a recurring cost, and cannot be properly estimated beforehand". Generative Agents simulations cost "thousands of dollars in token credits". Survey §3.7: Infinite Craft "appears" to prompt the model once per combination and store the result for reuse, which buys consistency. God's Innovation Project (§V-B): constraining prompts to *collected words* reduced out-of-distribution prompts, so "a sub-par generated map results from limited in-game resources, rather than due to an under-performing model". 84.2% of 19 players found terrain relevant.
→ *Player choice, meta-progression:* if we ever generate live, (a) cache forever by ID, (b) generate one department ahead while the player plays the current one, and (c) make the player's input a collected resource (catalogue cards), never free text.

**F18. Human preference still beats LLM design suggestions, and curation is the norm in every working system.** Ink Splotch (FDG 2024): participants "almost consistently rated the human-designed games higher than the ChatGPT-suggested games", and ChatGPT "often gave vague instructions". A Rogue Dream ("Notes on Success Rate"): 60% of 30 inputs fully skinned, 96% all-but-one, and a *curation coefficient* of 66% ("worthy of showing others"). GAVEL relied on experts to find the interesting games. CrawLLM shipped uncurated output with visible flaws.
→ *Testing and evaluation:* report a curation coefficient for the department pipeline and budget human review time. Julian is the head curator.

**F19. Steerable and distilled generators exist, but they answer a later question.** DreamCraft (FDG 2024, abstract) folds *functional* constraints into a text-guided, quantised NeRF in Minecraft. Moonshine (AAAI 2025) labels a constructive generator's output (Brogue maps) with an LLM, then trains text-conditioned map models. ELM bootstraps a corpus and then a conditional model. Siper et al. (CoG 2026, abstract) evolve whole generator *programs* with LLM mutation and "Continual Abstraction Discovery" of reusable primitives. ELMER (2026, abstract) uses *natural-language* descriptions as the genotype, compiled to a typed DSL, with steerable mutation strength; its abstract reports that language mutations "preserve more parent fitness at matched small-to-moderate behavioral displacement".
→ *Tooling, layout:* none of this is needed for v1. ELMER's representation is, however, exactly S1→S2 below: the department's genotype is its natural-language frame, compiled into the mechanical schema. Language-level edits ("make it more tidal, less martial") are the right curator tool for revising a department. A Moonshine-style "frame text → layout parameters" model is a v3 idea.

**F20. LLMs are good at semantic-association puzzles.** Merino et al. 2024 (abstract): with Tree-of-Thoughts prompting, GPT models generated Connections puzzles that human players judged "enjoyable, challenging, and creative" in comparison with published ones.
→ *Player choice, challenge types:* a **curatorial puzzle** challenge type plays to LLM strengths. Example: rehang the gallery by grouping 16 exhibits into 4 hidden collections to open the vault. It is cheap to validate with a solver call plus a human glance, unlike spatial puzzles (F8).

---

## 3. Ideas for the museum roguelike

### 3.1 The option space for "where departments come from"

| | **A. Hand-authored set** | **B. Offline LLM, validated + curated pool** | **C. Online LLM at runtime** | **D. Grammar/combinatorial from authored parts** | **E. Hybrid (recommended: schema-bound B, with D as baseline and fallback, C only as cached extras)** |
|---|---|---|---|---|---|
| Perceived novelty | High per department, exhausted fast (10–20) | High; specificity enforced; pool of ~50–150 | Highest at first, then trope-sameness shows (F9–F11) | Medium; templates become visible ("Department of [X] of the [Y]") | High: LLM nouns and text over authored verbs, plus an infinite Directory |
| Actual variety | Low count, high depth | Medium count, high depth | Unbounded count, uncertain depth | High count, shallow | Medium-high count, high depth |
| Learnability | Excellent: departments recur and can be mastered | Excellent if archetypes are shared | Poor: knowledge doesn't transfer and every department is a first visit | Good: parts recur visibly | Excellent: shared archetypes, honest labels, recurring permanent collection |
| Cross-facet coherence | Excellent | Good after validation and curation | Variable; failures reach players | Automatic via shared tags, but bland | Good: shared-tag checks plus round-trip label checks |
| Balance | Hand-tuned | Simulated + curated offline | Simulation needed in-browser, per department, per run | Simulatable | Simulated offline; runtime only sequences |
| Cost | Authoring time (very high per department) | Tokens offline (tens to hundreds of dollars; estimate) plus curation hours | Per player per run; needs a server for keys; ~$0.5–1 per department in 2024 terms (Word2World) | Near zero | Offline tokens plus curation; optional server later |
| Engineering / house fit | Fits single-file convention | Fits: ships as JSON in the build | Breaks it: needs backend, key management, moderation, caching | Fits | Fits for v1; service optional |
| Determinism (seeds, daily runs, sharing) | Yes | Yes | No (model drift and deprecation) unless cached | Yes | Yes (accession numbers are content addresses) |

**The dud arithmetic decides it.** A run visits *n* departments. If each has an independent probability *p* of being a dud (incoherent, unfair, boring), the chance a run contains at least one dud is 1 − (1−p)^n. For n = 10: p = 5% gives 40%, p = 10% gives 65%, and p = 34% (A Rogue Dream's curation coefficient) gives 98%. Roguelike runs are long and fragile, and one broken department spoils an hour. Option C ships its p directly to players. B and E push p toward zero by doing the rejection offline.

**The recurrence arithmetic says the pool needn't be huge.** If a run draws n = 10 of N departments, the expected number of distinct departments seen after R runs is N(1 − (1 − n/N)^R). With N = 60, a player has seen ~58 of them after 20 runs, and each recurs ~8 times by run 50. Hades-style familiarity is a feature: mastery of the Department of Tidal Clocks is something to *learn*. Novelty at the frontier comes from Temporary Exhibitions (below), not from making every department disposable.

**On "literally infinite".** The infinity is a *fiction* worth honouring, and it can be honoured cheaply, Borges-style. Signage, floor plans and the museum **Directory** list endless departments generated by a grammar: "Department of Unfinished Maps (closed for reinstallation)", "Hall of Salt Diplomacy, Lower Mezzanine". Only the curated ones are open. Perceived infinity costs strings; playable infinity costs everything in F4–F18.

### 3.2 Lean: Permanent Collection + Directory now; Temporary Exhibitions and Commissions later

- **Permanent Collection (v1).** 20–40 departments at launch, growing toward 100+, produced by the offline pipeline below, curated by Julian, and shipped as accession-numbered data. This is the learnable core.
- **The Directory (v1).** Grammar-generated names of unvisitable departments on signage, maps and the elevator panel. It sells the Borges/Calvino infinity at zero risk.
- **Temporary Exhibitions (v2, optional).** The same pipeline runs server-side with automated gates only. Each result is stored forever under its accession number (Infinite Craft-style caching) and labelled in-fiction as "not yet catalogued". Players opt in. These departments are higher risk and higher reward, and they are promoted to the Permanent Collection if their telemetry and curation pass.
- **Commissions / Bequests (meta-progression, v2+).** Players collect **catalogue cards** (words: domains, materials, practices) during runs. Between runs they compose a commission from cards only, never free text (GIP, F17). The pipeline realises it offline or on a server, and it appears in later runs as "Gift of [player]". This turns the generator itself into a roguelite reward.

### 3.3 Architecture sketch of the generation pipeline

Stage S0 is authored. S1–S6 run offline in Node or Python scripts beside the game. Runtime is plain browser JS.

| Stage | Who / what | Output | Validated by |
|---|---|---|---|
| **S0 Substrate** | Human-authored | **Mechanical vocabulary**: ~25–40 behaviour archetypes (charger, kiter, summoner, splitter, reflector, mimic-in-case, patrol-guard, swarm, sleeper, conservator-healer…), ~20 status effects, ~15 furniture/hazard types (vitrines, velvet ropes, plinths, dioramas, dark rooms, mirror galleries), ~40 item-effect primitives, ~10 **challenge types** (attrition, swarm, stealth, puzzle, hazard, time-pressure, scarcity, boss, social/NPC, navigation), room archetypes. **Museum conventions**: label templates (tombstone: Title / Date in a fictional calendar / Medium / Dimensions / Credit line / Accession no.), panel types, pictograms. **Domain lexicon** à la Qud (seed ~30 domains: glass, tides, debt, bells, salt, grief, cartography…). Style guide and guardrails (fictional cultures only). | Unit tests; each primitive has bot-testable semantics |
| **S1 Frame** | LLM, many independent candidates; high temperature; varied personas; seeds = 2 domains + 1 constraint card ("a collection defined by absence", "every object is a copy") + target cell of the archive | `DepartmentFrame` JSON: title, conceit (≤80 words), domains[2–3], category (technology / land / era / other), collecting policy, curatorial voice, palette slots, **challenge signature** (primary and secondary type), 3 centerpiece pitches, keepable-artifact pitch | JSON schema; guardrail filter; **specificity** (concrete nouns, named material and practice; F10); duplicate check against pool by embedding *and* by challenge signature; insertion into MAP-Elites archive (challenge type × category × tier) |
| **S2 Mechanical compile** | LLM via function calls into the S0 vocabulary (LLMaker / Game-O-Matic pattern: open nouns, closed verbs) | `DepartmentSpec`: bestiary of 4–8 species (archetype + 1–2 modifiers + role on the difficulty curve + domain tags), 6–12 items (effect primitive + magnitude class), 0–2 NPC role templates (docent, guard, conservator, rival visitor, talking exhibit), furniture/hazard set, room-archetype weights for the layout generator, a centerpiece (boss: archetype combination + 1 rule from an authored "centerpiece rules" list), the keepable artifact. **Numbers come from a deterministic balancer, not the LLM.** | Type check; **no-decoration rule**: every frame domain drives ≥1 mechanic, and every mechanic traces to the frame (F3, F6); **no unused components** (F13); counterplay check (every enemy has an answer in the base kit or the department's items); no silent fallbacks (F6) |
| **S3 Simulation** | Headless JS engine + bot personas (greedy melee, cautious, ranged/kiting, stealthy) on N layout seeds per tier | `DifficultyProfile`: win rate, HP and resources spent, turns per tier and persona; **skill ordering** holds (stronger bots do better; Mortar); **measured challenge fingerprint**, e.g. the stealth bot outperforms in a "stealth" department (Garden's frame-blind agent test, F12) | Thresholds; failures go back to S2 with diagnostics (ScriptDoctor-style loop); the department is assigned a tier band (early / mid / late) |
| **S4 Text** | LLM, *after* mechanics are frozen (Qud: rationalise after the fact) | Intro panel, 2–4 section panels, tombstone labels for each species, item and centerpiece (≤60-word body with ≥1 Essential and ≥1 Fact-giving line; F5), docent and guard barks, **collector biography** (6–10 Qud-style events naming the keepable artifact and centerpiece), and a **domain-keyed replacement grammar** for runtime minor labels | **Round-trip honesty check**: a separate extractor reads each label and predicts mechanic tags, which must match the spec; repetition check across the whole pool (n-gram and embedding; a banned-cliché list: "ethereal", "whispers", "echoes of"…); length caps; guardrails |
| **S5 Visuals** | LLM emits a sprite *spec*; our code draws | Per entity: silhouette class (**fixed by archetype** for learnability), palette slots from the frame, 1–2 domain features from an authored part library; tileset tint and furniture variants | Silhouettes distinct within the department; contrast; human pass |
| **S6 Curation** | Julian, in a single-page curator console (the scriptprof gallery pattern) | Accept / edit / reject with reasons; curation coefficient logged; reasons fed back into prompts and the vocabulary | Human |
| **S7 Packaging** | Script | Accession-numbered JSON (e.g. `1931.07`) embedded in the build; each object's accession number is its content address and RNG seed | Build tests: every department loads, simulates and renders |

**Runtime (browser, deterministic from run seed).**
1. *Sequencer.* It picks the next 2–3 doors from the pool by tier, challenge-type rotation and theme contrast. "Organised in no discernible manner" is a lie the sequencer tells.
2. *Layout generator.* Constructive (sibling brief), parameterised by the room-archetype weights.
3. *Exhibit placer.* Puts the centerpiece, highlights and study collection into rooms, with furniture.
4. *Runtime grammar.* Fills minor labels and plaques.
5. *Directory.* Shows unvisitable departments.
6. *Catalogue.* Records what the player has seen.

### 3.4 Concrete ideas by subsystem

- **Department concept generation.** The LLM is the open-data source, and the frame is the fake sheet. Seed every call with sampled domains plus a Calvino-style constraint card so candidates don't converge (F11). Generate breadth first, then select into archive cells; never chain each department on the previous one. Prefer *specific* conceits, such as "the Department of Tidal Clocks of the Salt Republic, whose clocks run on grief", over genre labels (F10).
- **Sequencing.** Embrace maximalist collisions (F3) between adjacent departments, but check adjacency for unfortunate pairings (F4). Rotate challenge types, so that "the type of challenge also [varies]" is guaranteed by the sequencer rather than hoped for.
- **Exhibit placement.** One centerpiece (boss or set piece), 2–3 highlights (named, full labels), and many study-collection cases (grammar labels, minor loot) (F16). Exhibits are both furniture and foes: "dormant" exhibits wake when you break a rope line or take a photo.
- **Enemies.** Enemies are exhibits that come alive, guards, and rival visitors. Behaviour comes from the archetype list only (F6). Archetype → silhouette and idle animation are constant across departments, so a kiter always reads as a kiter.
- **Items.** Items are museum objects with effect primitives. The **keepable artifact** per department comes from the collector biography (Qud's Frostycus Catsfriend, F15). That is a natural fit for the brief's "keep a single item from each department".
- **NPCs.** Role templates (docent = hints, conservator = repair or upgrade, guard = neutral/hostile toggle, rival curator = bargains). Dialogue typed Essential / Fact-giving / Flair (F5).
- **Text and labels.** Tombstone conventions as schema. **Pictogram signage as mechanics legend:** "Do not touch" = contact damage; "No flash photography" = light-sensitive; "Fragile" = shatters (AoE); "Climate controlled" = cold aura; "Temporarily removed for conservation" = missing loot. Labels stay short, and long text is optional (audio-guide button). Labels are "honest": they are written from the spec and round-trip checked (S4).
- **Visuals and sprites.** Schema-spec'd sprites drawn by code (F12), or retrieval from a labelled authored library (F9). Avoid text-to-image for v1: CrawLLM shows noisy tiles, inconsistent characters across generations, and a humanoid-only bias.
- **Audio.** Per-domain motif tags chosen in S1 can select from an authored stinger and ambience set; no generation needed.
- **Difficulty and balance.** Roles → numbers via a tier-aware balancer. Simulation gates (S3). Later, a Karavolos-style learned surrogate could predict difficulty from spec features for fast sequencing (NR).
- **Player choice.** Choose among 2–3 doors whose signage shows the department title, a challenge-type pictogram and a "permanent" or "temporary exhibition" tag (risk/reward).
- **Meta-progression.** The **Catalogue**: the first encounter adds a card, and repeat encounters reveal stats. That is a codex rewarding learning, and the journal Qud needed (F15). Kept artifacts and catalogue cards feed **Commissions** (§3.2).
- **Testing and evaluation.** Curation coefficient per pipeline version (F18). Expressive range over *mechanical* descriptors (book §9.7). A pool-wide text-diversity report. In-game "report this exhibit" telemetry (F3). Track the real dud rate *p* and keep 1 − (1−p)^10 visible on the dashboard.
- **Tooling.** Version prompts and store all outputs (models get deprecated, so outputs, not prompts, are the canonical asset). Build a grammar operator first (F14) and measure what the LLM adds as cells reached per hour.

---

## 4. Pitfalls and risks

1. **Decorative drift.** It is easy to end with 60 reskins of the same 8 monsters. A Rogue Dream's silent fallback (F6), GAVEL's unused components (F13) and scriptprof's no-op novelty (F14) all fail this way. Countermeasures: the S2 no-decoration rule and S3 measured fingerprints.
2. **Trope gravity and LLM voice.** Departments converge on "forgotten", "ethereal", "echoes of", underwater cities and clockwork everything (F9–F11). Countermeasures: constraint cards, generate-then-select, pool-wide repetition checks, and Julian's red pen. The *Nonslop* framing (Edwards & Togelius 2026) of disincentivising AI-like writing could even become a curation metric.
3. **Hierarchical conditioning kills diversity** (2.6×, F11). It is tempting to generate "department 2 inspired by department 1"; don't.
4. **Judge hacking.** LLM judges for "Calvino-ness" or "coherence" will be gamed at the top of the ranking (QDAIF, F13; Picbreeder-VLM notes that its semantic-fidelity metric "can easily be gamed"). Use judges as filters, not as the objective, and keep the human in the loop.
5. **Numbers and space in the LLM's hands** (F8). Stats, spawn counts and layouts generated by an LLM will be miscalibrated and invisible until playtested.
6. **Compounding duds** across a run (§3.1 arithmetic).
7. **Runtime LLM costs.** API keys cannot live in a single-file browser game, so a server is needed. Per-run token cost scales with players. Latency is tens of seconds (F17). Outputs are non-deterministic and models get deprecated, which breaks seeds, daily runs and shared runs. Player prompts invite jailbreaks. *Every one of these disappears if runtime generation is optional and cached.*
8. **Bias and offence** (F4). "Faraway lands" are where LLM orientalism lives; museums of empire are a real political topic. Decide deliberately whether the game *comments* on that or stays wholly fictional.
9. **Text overload.** Roguelike players skip text, and Qud's coherence only appeared once a journal existed (F15). Short labels, an optional audio guide, and a Catalogue.
10. **Pipeline brittleness and maintenance.** CrawLLM's prompts had to be "meticulously crafted and tuned" (F10). Every vocabulary change ripples through S1–S5 prompts and validators; budget for it.
11. **Copyright and pastiche.** The survey (§6) flags unsettled ownership of LLM output. Low risk for a free browser game, but don't let the generator quote Calvino or Borges, and don't name Borges' actual creatures.
12. **Learnability collapse** if departments never recur or archetypes don't read consistently (§3.1).

---

## 5. Decisions for the design discussion

**D1. Where do departments come from?**
(a) Hand-authored set (A). (b) Offline LLM pool, curated (B). (c) Runtime LLM (C). (d) Grammar from parts (D). (e) Hybrid E: schema-bound B, D as baseline and Directory, C only as cached extras.
*Lean: (e).* B gives depth and safety, D gives the infinite facade and a fallback, and C stays an optional, cached v2 experiment.

**D2. How big is the Permanent Collection, and does it recur?**
(a) 12–20 hand-polished departments. (b) 30 at launch growing toward 100–150, with recurrence. (c) Thousands, lightly curated. (d) Unbounded.
*Lean: (b).* Recurrence is a learning feature (F16 and §3.1 arithmetic), and curation capacity, not tokens, is the binding constraint.

**D3. What varies when you revisit a department?**
(a) Layout only. (b) Layout, plus which highlights and study-collection objects are "on view", plus grammar label variants, plus loaned items from other departments. (c) Full regeneration each visit.
*Lean: (b).* That is the museum logic of rotating displays and loans.

**D4. How much mechanical novelty per department?**
(a) Reskins of a fixed bestiary. (b) Authored archetype vocabulary with per-department combinations and modifiers, plus one centerpiece rule from an authored list. (c) LLM-written new mechanics as code (ScriptDoctor, Mortar, PCG metageneration).
*Lean: (b) for the game,* with (c) as an offline research track feeding new archetypes into S0 only after human review.

**D5. Who writes wall text, and when?**
(a) Humans. (b) LLM offline, after mechanics are fixed, plus a runtime domain grammar. (c) Runtime LLM.
*Lean: (b),* with the round-trip honesty check.

**D6. Runtime LLM at all?**
(a) Never. (b) Optional Temporary Exhibitions via a server, cached by accession number. (c) Bring-your-own-key. (d) Local WebGPU model.
*Lean: (a) for v1, (b) as a v2 experiment.* (c) and (d) add friction or a large download for worse quality.

**D7. Player-commissioned departments?**
(a) No. (b) Yes, composed from collected catalogue cards and realised between runs. (c) Yes, as live free-text.
*Lean: (b) as a stretch meta-progression.* Gamifying the inputs hides model faults (F17).

**D8. How do we protect learnability?**
(a) Accept full novelty. (b) Constant archetypes, silhouettes and pictograms, plus honest labels. (c) (b) plus a Catalogue that reveals stats on repeat encounters.
*Lean: (c).*

**D9. Theme guardrails.**
(a) Anything goes. (b) Wholly fictional cultures and calendars, no real ethnic or religious markers, Calvino/Borges register. (c) (b) plus a deliberate in-fiction critique of collecting and empire.
*Lean: (b) by default.* Decide (c) explicitly; it is a strong theme, but it needs authored framing, not generated framing.

**D10. How do we manage diversity of the pool?**
(a) Sample independently and dedupe. (b) MAP-Elites archive over mechanical descriptors (challenge type × category × tier). (c) (b) plus LLM-judged soft descriptors (tone, register) à la QDAIF.
*Lean: (b),* with (c) as advisory only (F13).

**D11. Visual pipeline for generated entities.**
(a) Hand-drawn per department. (b) LLM sprite spec plus a code-drawn part library. (c) Text-to-image, then pixelised. (d) Tiny trained text-to-sprite model (Five-Dollar style).
*Lean: (b).* It fits the house "everything drawn in code" convention and keeps archetype silhouettes stable.
