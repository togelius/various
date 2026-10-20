# Roguelike systems precedents for the museum roguelike

Research brief on the game-design layer: combat, run structure, choice, difficulty and meta-progression. Prepared 2026-10-20 as input to the design document. Each finding ends with **→ Museum**, which names the subsystem(s) it touches.

**Verification legend.**
- **[code]**: read in the game's own source or in-game text.
- **[dev]**: the developer's own writing.
- **[wiki]**: a community wiki page read directly.
- **[search]**: confirmed only through search-engine summaries of guides or reviews. Treat the numbers as indicative.
- **(unverified)**: could not be confirmed.

---

## 1. Sources actually read

**Game source and in-game text (primary)**
- Debenham, E. *Shattered Pixel Dungeon* (SPD) source, GitHub `00-Evan/shattered-pixel-dungeon`, master, read 2026-10-20. https://github.com/00-Evan/shattered-pixel-dungeon. Files read:
  - `Dungeon.java` (`posNeeded`, `souNeeded`, `asNeeded`, `enchStoneNeeded`, `intStoneNeeded`, `trinketCataNeeded`, `labRoomNeeded`, `bossLevel`, `shopOnLevel`)
  - `items/Generator.java` (deck system, `floorSetTierProbs`)
  - `levels/RegularLevel.java` (`createItems`)
  - `actors/buffs/Hunger.java`, `actors/hero/Talent.java`, `HeroSubClass.java`
  - `items/weapon/Weapon.java` (use-identification)
  - `assets/messages/journal/journal.properties` (the in-game guide)
  - `assets/messages/misc/misc.properties` (challenge texts)
- Walker, B. and contributors. *Brogue: Community Edition* source, GitHub `tmewett/BrogueCE`, master, read 2026-10-20. https://github.com/tmewett/BrogueCE. Files read:
  - `src/brogue/Items.c` (`populateItems`)
  - `src/variants/GlobalsBrogue.c` (`meteredItemsGenerationTable_Brogue`, and the blueprint catalogue of reward rooms and key puzzles)
  - `src/brogue/Monsters.c` (monster description text)
- DCSS devteam. *Dungeon Crawl Stone Soup* manual, `crawl-ref/docs/crawl_manual.rst`: Appendix N "Philosophy (pas de faq)", §E Experience, §J Religion, §D "Zot". https://github.com/crawl/crawl

**Developer writing**
- Debenham, E., on the shatteredpixel.com blog (`https://shatteredpixel.com/blog/<slug>.html`):
  - "Coming Soon to Shattered: Better Secrets!" (2017-10-23)
  - "…Too Many Consumables" (2018-07-25)
  - "…Better Bosses" (2020-04-08)
  - "…Talented Heroes!" (2020-09-23)
  - "…Levelgen Refinements" (2020-10-30)
  - "…Item Changes, Challenges, Abilities" (2021-03-31)
  - "…Seeded Runs" (2022-05-02)
  - "…Badges and Ascension" (2022-06-24)
  - "Presenting at Roguelike Celebration 2022" (2022-10-20; the abstract of his talk "Smoothing the Sharp Edges of RNG", which I did not watch)
  - "…Trinkets" (2024-04-30)
  - "Ten Years of Shattered Pixel Dungeon" (2024-08-05)
- Bénard, S. (2017-03-29). "Building the Level Design of a procedurally generated Metroidvania: a hybrid approach." *Game Developer* (originally Gamasutra). https://www.gamedeveloper.com/design/building-the-level-design-of-a-procedurally-generated-metroidvania-a-hybrid-approach-
- Tokarev, K. (2017-06-08). "Interview with the developers of Dead Cells" (Steve Filby, Motion Twin). *80.lv*. https://80.lv/articles/interview-with-the-developers-of-dead-cells
- DCSS devteam (2021). "0.26: Roll Around the Clock" (release announcement). https://crawl.develz.org/wordpress/0-26-roll-around-the-clock
- *Can I Play That?* (2021-08-11). "Hades God Mode explained by Supergiant Games" (quotes Greg Kasavin via *Inverse*). https://caniplaythat.com/2021/08/11/hades-god-mode-explained-by-supergiant-games
- *Kotaku* (2019). "The creators of Into the Breach came very close to giving up" (Justin Ma and Matthew Davis, after their talk). https://kotaku.com/the-creators-of-into-the-breach-came-very-close-to-givi-1833498295
  - The talk itself: Davis, M. (2019). "'Into the Breach' Design Postmortem", GDC. https://gdcvault.com/play/1025772/ (not watched).

**Wikis read directly [wiki]**
- brogue.wiki: "Brogue walkthrough" (CE 1.15.1) and "Scroll of enchanting".
- slaythespire.wiki.gg: "Map Locations", "Map Generation" and "Ascension".
- deadcells.wiki.gg: "Blueprints" and "Boss Stem Cells".
- bindingofisaacrebirth.wiki.gg: "Item Pool".
- vampire.survivors.wiki: "PowerUps".
- Wikipedia: "Hoplite (video game)", "Hades (video game)", "Dead Cells" and "Brogue (video game)".
- waltorious, *Waltorious Writes About Games*: "Roguelike Highlights: Brogue" (2011-10-26) and "Roguelike Updates: Who Needs Leveling, Anyway?" (2012-11-07).

**Confirmed only through search summaries [search]**
- Hades door symbols (Shacknews and Prima Games guides).
- Hades keepsakes (Fextralife wiki).
- Pact of Punishment bounties (*Kotaku* 2020, "Everything you need to know about Hades' endgame").
- Spelunky HD Tunnel Man (Spelunky Wiki).
- Rogue Legacy (Wikipedia and Hardcore Gaming 101).
- Returnal carry-over (TechRadar and GamingBolt).
- Loop Hero retreat percentages (BlueStacks guide).
- Balatro stakes (Kosgames and Platget).
- Into the Breach pilot carry-over (GeekWire review, 2018).
- Mark Brown, *Game Maker's Toolkit*, "Roguelikes, Persistency, and Progression" (2019-01-28). The title and date come from TheTVDB; I did not watch the video.

**Research by Togelius and colleagues**, verified against the user's CV, the *AI and Games* 2e bibliography, arXiv or a publisher record:
- de Mesentier Silva, F., Salge, C., Isaksen, A., Togelius, J., Nealen, A. (2018). "Drawing without replacement as a game mechanic." *FDG 2018*, 57:1–57:6. doi:10.1145/3235765.3235822 (abstract only).
- Holmgård, C., Green, M.C., Liapis, A., Togelius, J. (2019). "Automated Playtesting with Procedural Personas through MCTS with Evolved Heuristics." *IEEE Transactions on Games*. arXiv:1802.06881.
- Isaksen, A., Gopstein, D., Nealen, A. (2015). "Exploring Game Space Using Survival Analysis." *FDG 2015*.
- Isaksen, A., Gopstein, D., Togelius, J., Nealen, A. (2018). "Exploring Game Space of Minimal Action Games via Parameter Tuning and Survival Analysis." *IEEE Transactions on Games* 10(2):182–194.
- Mahlmann, T., Togelius, J., Yannakakis, G.N. (2012). "Evolving Card Sets Towards Balancing Dominion." *IEEE CEC*.
- Fontaine, M.C., Lee, S., Soros, L.B., de Mesentier Silva, F., Togelius, J., Hoover, A.K. (2019). "Mapping Hearthstone deck spaces through MAP-Elites with sliding boundaries." *GECCO 2019*: 161–169.
- Lantz, F., Isaksen, A., Jaffe, A., Nealen, A., Togelius, J. (2017). "Depth in strategic games." AAAI WNAIG workshop.
- Liapis, A., Holmgård, C., Yannakakis, G.N., Togelius, J. (2015). "Procedural Personas as Critics for Dungeon Generation." *EvoApplications*: 331–343.
- Yannakakis, G.N., Togelius, J. (2011). "Experience-driven procedural content generation." *IEEE Transactions on Affective Computing* 2(3):147–161.
- Yannakakis, G.N., Togelius, J. (2025). *Artificial Intelligence and Games*, 2nd ed., Springer: §6.5 (pp. 214–216) and §13.2.2 (pp. 416–418).

**Museum practice (for theming)**
- Gilman, B.I. (1916). "Museum Fatigue." *The Scientific Monthly*, January 1916. Confirmed via the Wikipedia pages "Museum fatigue" and "Benjamin Ives Gilman"; I did not read the article itself.
- Auction-house cataloguing terms ("Attributed to", "Studio/Workshop of", "Circle of", "Follower of", "Manner of", "After"), e.g. Roseberys, "Explanation of Picture Cataloguing Terms," https://www.roseberys.co.uk/picture-cataloguing-terms [search].

**Unverified or not consulted**
- Grinblat, J., Bucklew, C.B. (2017). "Subverting historical cause & effect: generation of mythic biographies in Caves of Qud." FDG 2017 PCG workshop (unverified; I could not find the record this session).
- Juul, J. (2013). *The Art of Failure*. MIT Press. The book exists, but I did not consult it for this brief.
- Caves of Qud's mutation and tinkering systems and Darkest Dungeon's hamlet are described from general knowledge. They are marked as such where used.

---

## 2. Key findings

### A. Shattered Pixel Dungeon: what to borrow, and why it works

**F1. SPD guarantees its upgrade economy per region and tells the player so.**
- **The rule [code].** Five 5-floor regions, with bosses on floors 5, 10, 15, 20 and 25 (`Dungeon.bossLevel`). Each region guarantees:
  - 2 Potions of Strength, dropped every two floors (`posNeeded`);
  - 3 Scrolls of Upgrade, spawned with probability "floors left / scrolls left" (`souNeeded`);
  - 1 arcane stylus (`asNeeded`);
  - 1 alchemy lab, on floor 3 or 4 of each region (`labRoomNeeded`).
  - One-offs: an intuition stone and a trinket catalyst on floors 1–3; an enchantment stone in region 2 or 3.
  - Shops on floors 6, 11 and 16.
- **The disclosure [code].** The in-game guide tells the player outright: *"You will always be able to find 2 potions of strength and 3 scrolls of upgrade in each five floor dungeon region, so they're a great indicator of how well you're exploring."* (`journal.properties`, `guide.looting`).
- **Ambient loot [code].** Regular items are 3/4/5 per floor at 60/30/10% (`RegularLevel.createItems`). Weapon and armour tier depends on the region via `floorSetTierProbs`: region 1 is 75% tier-2, region 5 is 80% tier-5.
- **→ Museum** (items, difficulty and balance, player choice). Give each *department* a guaranteed quota of the run's core progression items, keyed to *run position*, and show the quota diegetically on the floor plan ("Highlights of this collection: 3"). Item *tier* must follow run depth, never the department's identity, because departments arrive in random order.

**F2. SPD and Brogue both meter their randomness. RNG is smoothed rather than raw.**
- **SPD [code].** `Generator.java` uses decks: "the probs decrement as items are picked until they are all 0, and then they reset". Category draws use "two decks of 35 items", and artifacts never duplicate. Debenham's Roguelike Celebration 2022 talk "Smoothing the Sharp Edges of RNG" is described as techniques "to make the game's randomness feel more fair, without just making the game easier" [dev; abstract only].
- **Brogue [code].** `meteredItemsGenerationTable_Brogue` rubber-bands its key items:
  - Scroll of enchanting: initial frequency 60, +30 per level, −50 each time one spawns.
  - Potion of strength: initial 40, +17 per level, −50 per spawn.
  - Potion of life: spawned by a hard threshold rule.
  - Food: guaranteed against a curve, "the approximate equivalent of one ration every four levels".
  - Gold: piles adjusted ±2 when generation runs behind or ahead of schedule.
  - An item "heat map" biases items behind secret doors, because empty secret rooms are "demoralizing after you take the trouble to find them" (`Items.c`).
- **Dead Cells.** "We keep a short leash on the RNG so that you don't find yourself in undesirable situations" (Filby, 80.lv 2017).
- **Research.** de Mesentier Silva et al. (FDG 2018) compare deck (without replacement) and dice models for random outcomes on salience, disparity, fairness and obfuscation. This is the formal version of SPD's choice.
- **→ Museum** (items, difficulty and balance, testing). Decks and meters keyed to the run counter go in from day one. Generated departments supply *skins and flavour* for slots in the deck; they never decide how many upgrades exist.

**F3. Hunger is a clock, and DCSS replaced it with a better one.**
- **SPD [code].** Hunger rises 1 per turn: "Hungry" at 300, "Starving" at 450, then about 0.1% of max HP lost per turn. It pauses while a level is locked (boss fights).
- **Searching costs hunger [dev 2017].** This is deliberate, so that "excess food now rewards you with the ability to search more."
- **DCSS [dev].** DCSS 0.26 (2021) removed food: "food is gone, replaced with a Zot clock that prevents players from lingering too long in one branch." The manual says Zot "can only sense adventurers once they've spent an inordinately long time in one area", and leaving or descending diffuses its attention.
- **→ Museum** (difficulty, player choice, exploration). A *per-department* clock fits a museum far better than food. Call it "closing time": a bell, then the lights dim, then the night watch. It is an anti-scumming device with no inventory micromanagement. A visitor-fatigue meter is a thematic alternative (Gilman 1916 coined "museum fatigue"), but it reintroduces hunger-style rationing.

**F4. SPD identification, and how it resists grinding.**
- **Unknown appearances [code].** Potion colours and scroll runes are reshuffled every run.
- **Use-identification for equipment [code].** A weapon identifies after 20 uses. Only 10 uses are "available" at a time, and they recharge only as the hero gains XP ("gains enough uses to ID over 0.5 levels", `Weapon.java`). You cannot identify a sword by hitting a rat for 200 turns.
- **Brogue [wiki].** Equipment also identifies by use: armour after 1000 turns worn, rings after 1500, weapons after 20 kills.
- **Vault exception [code].** Items in Brogue's choice vaults are flagged `ITEM_KIND_AUTO_ID` in the blueprint, so pick-one choices are always *informed*.
- **DCSS on spoilers [code].** "The joy of discovering something spoily is nice, once… The joy of dealing with ever-changing… situations that arise out of transparent rules… is nice again and again."
- **→ Museum** (items, text and labels). Identification maps naturally onto museum *attribution* (see 3.6). Gate identification progress by exploration, not repetition. Never make a pick-one choice blind.

**F5. "Leveling up in Shattered isn't fun" [dev, 2020].**
- **The diagnosis.** Debenham added talents because "the frequent levelling… is necessary for the stat boost but does nothing for the game's fun factor."
- **Talent design.** He rejects skill trees: they are "geared toward a completed build… but runs don't always make it that far", and force early planning before you know your gear. He also rejects pure random picks ("more at the mercy of RNG"). He chose *independent tiers*: tier thresholds at levels 2, 7, 13 and 21 (`Talent.tierLevelThresholds`), and early tiers deliberately weak late.
- **Talent types.** The best are *triggered* talents: "they enhance the player's interaction with specific parts of the game without the complexity burden of activating them directly". Actives add complexity, and pure stat passives "don't noticeably affect gameplay".
- **Pacing beats [code + dev 2021].** Six heroes, each with two subclasses (12 in `HeroSubClass`). The subclass comes from Tengu's Mask (the floor-10 boss) and the armour ability from Dwarf King's Crown (floor 20), which was added because "by floor 20 the player's build is pretty finalized… the satisfaction of progressing begins to ebb away."
- **→ Museum** (player choice, meta-progression). If we have perks, use tiered, mostly-triggered perks offered at fixed beats (department exits), not a tree. Give the last third of the run its own progression arc.

**F6. SPD level "feelings" and regional rooms carry variety more cheaply than new mechanics.**
- **Feelings [dev 2020].** SPD announces a level variation on arrival:
  - Original four: grass, water, chasm and dark.
  - Added in 2020: *large* (1.5× rooms with more items), *trap* (5× traps, 4/5 visible, "chances to use traps against your enemies") and *secret* (a bonus secret room plus more hidden doors).
- **Rooms.** Distinctively shaped regional rooms "have had the most meaningful impact on how distinct each region feels".
- **Exploration safeguard [dev 2017].** "Every standard room must have an uninterrupted visible path to the level entrance." Purpose-built secret rooms reward "the game's rarer consumables" and rarely gear, because "upgrade items and weapons/armor… are necessary and shouldn't be hidden".
- **→ Museum** (layout generation, difficulty, exhibit placement). A department's *challenge signature* can be built from feeling-like modifiers plus signature room shapes. Essentials are never placed in secret storerooms.

**F7. Bosses should ramp, resist cheese, and expose tuning knobs [dev 2020, 2021].**
- **The redesign.** SPD's boss redesign targets bosses that "spend it all right at the start".
  - DM-300 got fight/flee phases.
  - Dwarf King's summons became consistent rather than manipulable.
  - Yog now summons 3 of 6 possible fists as its eye takes damage.
  - Yog is "the only boss whose difficulty is directly affected by player action on the floors above" (demon spawners left alive).
- **Knobs.** Bosses were built "with a bunch of mechanics that could be tuned", which later became the *Badder Bosses* challenge.
- **→ Museum** (enemies, difficulty). Each department's "Masterpiece" fight should be parameterised by depth and heat, ramp up within the fight, and be shaped by what the player did in the galleries (e.g. alarms tripped, wardens left awake).

**F8. Challenges and trinkets: variety that is not power [code, dev].**
- **Challenges.** SPD's nine challenges multiply score: On diet, Faith is my armor, Pharmacophobia, Barren land, Swarm intelligence, Into darkness, Forbidden runes, Hostile champions and Badder bosses (`misc.properties`). Debenham notes that most "focus on taking mechanics out of the game", and that additive ones (Hostile Champions) were "a welcome change of pace".
- **Trinkets (2024).** They are "more about tweaking gameplay variables than giving direct power": rarer enemies more often, more visible traps, swingier damage. You choose one of three per run and can upgrade it +0…+3.
- **Ascension rework (2022).** The optional climb back was made into "a proper gauntlet" with a growing debuff that only kills relieve. Enemies get per-type multipliers (×10 for rats). Surviving pays a 2.5× score multiplier versus 2× for a normal win.
- **→ Museum** (meta-progression, difficulty). The heat system should *add* departmental complications rather than only subtract tools. A trinket-like "lens" that skews generation (more forgeries, more live exhibits) is a story-free variety lever.

**F9. Consumable overload is SPD's own admitted failure mode [dev 2018, 2024].**
- **The problem.** "There are about 50 different types of consumable items… it's a very common situation for players to win the game or to die with loads of consumables that they've basically forgotten about."
- **The fix and its limits.** Alchemy converts many items into fewer, stronger choices. By 2024 Debenham concluded that alchemy "is at its best when its streamlined and gets out of the way."
- **→ Museum** (items, text). Department-specific consumables multiply this risk with every department. Keep a small fixed set of consumable *kinds* and let departments re-skin them. Provide a light recycling step at a conservation lab.

### B. Brogue and DCSS: the purist line

**F10. Brogue removed experience levels in v1.7 (2012).**
- **What replaced XP [wiki].** Strength and life come from rationed potions, and builds come from scrolls of enchanting. Enchanting is "what allow[s] a player to choose a build among the items that they have… finite… They are metered" (brogue.wiki; about 14.8 per run per its infobox).
- **The effect on stealth.** A contemporary reviewer noted that once strength no longer needed fighting, "stealthy tactics were more viable" (waltorious 2012). I could not locate Walker's own statement of reasons; a 2011 Roguelike Radio interview is cited on forums but I did not hear it.
- **→ Museum** (player choice, enemies, items). No XP is the cleanest way to make *sneak past the exhibit* a real option, which a museum after hours begs for. Power then comes from accession, not slaughter.

**F11. Brogue's vaults *are* museum rooms [code].**
- **Reward rooms.** The blueprint catalogue includes:
  - "Mixed item library -- can check one item out at a time" (items on caged altars; returning one reopens the others);
  - "Single item category library";
  - "Commutation altars";
  - "Kennel -- allies locked in cages… choose one or two to unlock";
  - "Legendary ally".
- **Key puzzles.** These include:
  - "Statuary -- key on an altar, area full of statues; take key to cause statues to burst and reveal monsters";
  - "Flood room";
  - "Collapsing floor area";
  - "Throwing tutorial -- toss an item onto the pressure plate";
  - "Worms in the walls";
  - "Zombie crypt".
- **Designer judgement in comments.** One entry reads "Summoning circle… DISABLED. (Not fun enough.)"
- **Legibility.** Examining a monster states: "X has a N% chance to hit you, typically hits for N% of your current health, and at worst, could defeat you in N hits" (`Monsters.c`).
- **Feats.** Brogue's feats include "Paladin: Ascend without attacking an unaware or fleeing creature" and "Untempted: Ascend without picking up gold". These are conduct challenges with no meta power.
- **→ Museum** (exhibit placement, items, NPCs/allies, text, meta). This is a ready-made grammar for museal set pieces:
  - the library becomes the **Loan Desk** (borrow one exhibit at a time, swap allowed);
  - the kennel becomes **Conservation Storage** (wake one dormant exhibit as an ally);
  - the statuary *is* a sculpture gallery.
  - Show odds in the examine panel. Conduct feats are free replay value.

**F12. DCSS design philosophy (manual, Appendix N) [code].**
- **Major goals.** "Challenging and random gameplay, with skill making a real difference; meaningful decisions (no no-brainers); avoidance of grinding (no scumming); … painless interface."
- **Grinding** is defined as "activities that have low risk, take a lot of time, and bring some reward. This is bad… because it encourages players to bore themselves. Even worse, it may be optimal to do so." Hence shops don't buy.
- **Diversity.** "It is no good to provide dozens of weapons with different names… if, in the end, they all play the same."
- **Invincibility.** "Games are pointless if you can reach the invincible state."
- **Out-of-depth monsters** are intentional ("keep players on their toes").
- **Vaults** "force players to decide between safety and greed".
- **Gods** are a run-defining early choice made at altars, each with conducts (§J).
- **→ Museum** (all subsystems, especially generation and meta).
  - The *diversity* clause is the strongest argument against unbounded LLM item generation without a mechanical vocabulary.
  - The *anti-grinding* clause rules out selling loot and repeatable farms.
  - The *invincibility* clause is the test for any meta-progression.
  - Gods suggest *patrons/benefactors* as an alternative to department-themed perks.

### C. Tactical clarity: Hoplite and Into the Breach

**F13. Determinism and telegraphs turn turns into puzzles.**
- **Hoplite [wiki].** Turn-based on a hex grid, with movement-based attacks instead of bump-to-attack, four enemy types, and altar prayers granting upgrades. Critics noted its "punishing difficulty [is] balanced by short levels".
- **Into the Breach.** "The enemies telegraph their moves, turning each match into a kind of puzzle" (*Game Developer*, Road to the IGF [search]).
- **ITB scope cutting.** Ma and Davis cut city-building, research trees, multiple squads and FTL-style events. Ma called what remained "30 percent of what we were hoping" (*Kotaku*, 2019).
- **ITB carry-over [search].** When a timeline ends, ITB lets you keep *one* surviving pilot, with XP intact, for the next attempt.
- **→ Museum** (enemies, combat, meta, tooling).
  - A hybrid fits the SPD-like brief: ordinary attacks keep RPG dice, but *dangerous* specials (elites, Masterpieces) are telegraphed a turn ahead on the tiles.
  - ITB's "keep one" is exactly the user's "keep one item" idea, and it works because it is *one* slot.
  - ITB's cut list is a scope warning against hub-building and research trees.

### D. Run maps, doors and pools

**F14. Slay the Spire's act map [wiki].**
- **Node types.** Seven: monster, elite, rest, unknown, treasure, merchant and boss.
- **Guaranteed rows.** Floor 1 is easy combats, floor 9 is treasure, floor 15 is rest before the boss.
- **Baseline random-room weights.** 53% normal, 8% elite, 12% rest, 5% merchant, 22% unknown.
- **Unknown rooms use pity counters**: a type "has its probability reset… and the others increase".
- **Encounter pools.** "The first three encounters in Act 1, and the first two encounters in Act 2 and Act 3, are drawn from the easy pool." The same elite cannot occur twice in a row.
- **Ascension.** 20 cumulative levels, unlocked per character by beating the Act 3 boss. They mix enemy stat buffs (A2–4, A7–9), economy cuts (A13, A16), moveset changes (A17–19) and a double boss (A20).
- **→ Museum** (department sequencing, enemies, difficulty, heat).
  - The first rooms of *every* department should draw from an "orientation" (easy) pool. That fixes most of the random-order problem.
  - A small route graph with guaranteed rows (e.g. a rest/café department before the finale) gives choice without chaos.
  - Ascension levels that change *movesets* are more interesting than stat bumps.

**F15. Hades: doors that preview their rewards, and run vs meta on every door [search, wiki].**
- **Previews.** Each chamber door shows its reward. Gold laurels mark run-power (boons, money, Centaur Hearts); blue laurels mark persistent currencies (Darkness, Keys, Nectar). A skull marks a harder encounter with better reward.
- **Boons.** Themed by god, chosen one of three.
- **Keepsakes.** One equipped, swappable between regions only via an upgrade (Fextralife).
- **God Mode.** Starts at 20% damage resistance and adds 2% per death to an 80% cap. Kasavin: "Our big focus from the start with Hades was how to take the sting of failure and reduce that as much as possible"; such settings "may need to be proprietary to the game… not a one size fits all solution" (*Can I Play That?*, 2021).
- **Pact of Punishment.** Unlocked after the first clear. Bounties pay per weapon per heat level, so heat is a *ladder* with first-clear rewards (*Kotaku*, 2020 [search]).
- **What survives without the story.** Previewed doors, themed boon pools, keepsakes and heat all work without narrative. The relationship and dialogue meta does not.
- **→ Museum** (department sequencing, player choice, meta). Department exits should be *doors with placards*: department name, a one-line curatorial blurb, a reward icon, a challenge-signature icon, and a crowd/danger marker. Each placard is a short readable label, which is very museal.

**F16. Dead Cells: unlock into the pool, not into the stats [wiki, dev].**
- **Blueprints.** Dropped by enemies (capped at one outfit and one other per biome per run). They are "lost for the run when the player dies before delivering it to the Collector". Cells pay to unlock the item, which then can appear in runs.
- **Fixed world, random layouts.** The world layout is fixed and includes "the keys to unlock new paths for your future runs" (Bénard 2017). Levels are "50% procedurally generated and 50% hand-crafted" (Filby 2017).
- **Per-biome concept graph.** "Acts like a set of instruction to the procedural generation algorithm", setting length, special rooms and how labyrinthine the biome is.
- **Boss Stem Cells.** Five difficulty levels that cut healing, widen detection and remove flask refills, *and* unlock new doors and routes and raise loot quality.
- **→ Museum** (meta, sequencing, layout).
  - "Accessioning" an item to unlock it into future pools is the variety-not-power model the user's "keep one item" idea needs.
  - Heat that *opens restricted wings* turns difficulty into exploration.

**F17. Isaac's item pools [wiki].**
- **Pools by source.** Pools exist per room type and source: treasure, shop, boss, devil, angel, library, chests, beggars.
- **Removal and fallback.** "Touching an item will remove it from all item pools". Exhausted pools fall back to the treasure pool, and the final fallback is Breakfast.
- **Unlocks.** Achievements add items to the game (Isaac's main meta-progression).
- **→ Museum** (items, meta). Department pools sit over a global fallback pool. Meta unlocks *add* kinds to the global pool. A museum-themed "Breakfast" (e.g. a postcard from the gift shop) makes exhaustion a joke instead of a bug.

### E. Meta-progression models

**F18. Vampire Survivors' PowerUp shop [wiki].**
- **Price.** `InitialPrice × (1 + Bought) + floor(20 × 1.1^TotalBought)`.
- **Refund.** "Refund PowerUps" returns all gold.
- **Toggle.** Maxed PowerUps can be individually disabled.
- **→ Museum** (meta). The good parts are *refund* and *toggle-off*: power is visible, reversible and player-controlled, so self-imposed difficulty is free. Escalating fees keep it a long-term sink.

**F19. Other meta shapes (mostly [search]).**
- **Rogue Legacy.** Choose one of three heirs with random traits; spend gold on manor stat upgrades. Charon takes unspent gold before each run; the Architect can lock the layout for a fee. *Pure power creep*, made palatable by traits.
- **Spelunky HD.** The Tunnel Man builds shortcuts across *three* visits, each demanding bombs, ropes, money or items. Shortcuts are paid for with in-run resources.
- **Returnal.** Traversal gear, keys and unlocked weapon traits persist; Ether is capped at 30.
- **Loop Hero.** Retreating at camp keeps 100% of resources, mid-loop about 60%, death 30%. The camp buildings unlock cards and classes. The meta resource carries its own push-your-luck stakes.
- **Balatro.** Eight stakes per deck, cumulative (e.g. Blue −1 discard, Gold −1 hand size). Decks are unlocked by winning stakes. The meta is *variety and a difficulty ladder*, not power.
- **Darkest Dungeon.** Hamlet building upgrades bought with heirlooms (general knowledge). Hero attrition makes the hub the real character.
- **Caves of Qud** (general knowledge). Mutations chosen at creation and earned later, and item mods via tinkering. Build identity comes from *traits that change verbs*.
- **→ Museum** (meta). There is a spectrum: pure power (Rogue Legacy), options (Dead Cells, Isaac, Balatro), knowledge and shortcuts (Spelunky, Returnal), and opt-in assist (Hades God Mode).

**F20. The critique of meta power.**
- **GMTK.** Mark Brown's video contrasts Spelunky's fixed runs with Rogue Legacy's growing character (title and date verified; video not watched).
- **Community sentiment.** Typical in forums: power meta blurs self-evaluation ("hard to tell whether you're skilled or just under-leveled") and makes wins feel hollow; sideways unlocks are accepted.
- **DCSS** ("invincible state") and **SPD** (no meta power at all, only heroes, badges, challenges and seeds) take the purist line.
- **Hades** shows the middle path: the power meta is real, but there is an explicitly labelled assist (God Mode) and a heat ladder above it.
- **→ Museum** (meta, difficulty). Default to "unlock options, not power". Any power meta should be small, capped, refundable, or an opt-in assist.

### F. Research tools for balancing and testing

**F21. Persona and survival-analysis methods.**
- **Procedural personas.** MCTS agents with different utilities (fighter, treasure hunter, runner) used as playtesters (Holmgård et al. 2019) and as critics for dungeon generation (Liapis et al. 2015). The book (§6.5, pp. 214–216; §13.2.2, p. 417) frames them as models of human decision styles.
- **Survival analysis** estimates a level's or a parameter setting's hazard curve from simulated play (Isaksen et al. 2015; 2018).
- **Set balancing.** Evolutionary search over Dominion card sets (Mahlmann et al. 2012).
- **Build-space diversity.** MAP-Elites mapping of Hearthstone deck spaces (Fontaine et al. 2019).
- **Depth.** Lantz et al. (2017) frame strategic depth as a long ladder of skill.
- **→ Museum** (testing and evaluation, difficulty and balance, tooling).
  - Because any department can appear at any depth, *every generated department* must be balanced automatically.
  - Use persona bots per department at several depths, fit survival curves, and reject or retune outliers.
  - Run MAP-Elites over perk and item builds to check that several builds are viable.
  - Use experience-driven PCG (Yannakakis & Togelius 2011) for the optional adaptive layer.

---

## 3. Ideas for the museum roguelike

### 3.1 Core loop and run length *(sequencing, difficulty)*
- **Shape.** One run is "a visit":
  1. Entrance Hall: hub plus an *Information Desk* choice of starting perk, Neow-style (general knowledge of Slay the Spire's opening).
  2. **N departments**, each with an *orientation gallery*, one or two *main galleries* and a *Masterpiece Hall*.
  3. A final *Exit Through the Gift Shop* level.
- **Length.**
  - SPD is about 26 floors over 1–3 hours, roughly 4–7 minutes per floor.
  - A browser roguelike should aim for **45–75 minutes**, about 12–15 maps in total.
  - Lean: **5 departments × (2 gallery floors + Masterpiece Hall)**, plus the entrance and exit.
- **Variable size.** Departments come in three sizes, set by the sequencer under a total gallery-floor budget so runs stay in range:
  - *Cabinets*: 1 floor;
  - *Departments*: 2 floors;
  - *Wings*: 3 floors.

### 3.2 Department-to-department choice *(sequencing, player choice, text)*
- **Exits.** Each Masterpiece Hall opens onto **2–3 doors**, each with a placard (F15): department name; a curatorial one-liner ("Instruments for Measuring Regret, 14th–19th c."); a reward icon (which perk family it offers; whether it holds a Loan Desk); its **challenge-signature icon**; and a crowd/danger marker.
- **Hidden structure.** Under the doors sits a small Slay-the-Spire-style graph (F14) with guaranteed rows:
  - department 1 is always low-complexity;
  - the penultimate exit always offers a "Café/Rest" side gallery.
- **Constrained shuffle.** The sequencer forbids the same challenge signature twice in a row (like StS elites) and uses pity counters for signatures not yet seen.

### 3.3 Difficulty with departments in random order *(difficulty, enemies, generation)*
- **Depth sets power; the department sets texture.** A department defines a **roster by role**: fodder, skirmisher, artillery, brute, controller, warden, Masterpiece. Each role has stat curves indexed by **run depth**, the way SPD's `scalingDepth()` is used. Item tiers also come from run depth (F1).
- **Orientation pool.** The first two encounters in each department use only fodder and skirmisher roles plus one telegraphed controller. This teaches the department's gimmick before it hurts (F14's easy pool).
- **Complexity rating.** Each department brief gets one, and the sequencer pushes complex ones later.
- **Out-of-depth "loans".** An occasional exhibit borrowed from a deeper department, as DCSS intends its OOD monsters (F12), but announced on a placard ("On loan from the Department of Unfinished Weather").

### 3.4 Challenge-type variety (the brief's "type of challenge also…") *(difficulty, layout, enemies)*
- **Signatures.** Give every department one *primary* and one *secondary* signature from a fixed list of about 8. Each is implemented as a modifier pack (feeling-like, F6):

  | Signature | What it means |
  |---|---|
  | Swarm | many weak exhibits |
  | Artillery | ranged and telegraphed |
  | Guarded | patrols; stealth rewarded |
  | Darkness | vision shrinks; light sources matter |
  | Hazard terrain | water, fire, glass floors |
  | Locks and keys | Brogue key-puzzle rooms |
  | Attrition | shorter closing clock, fewer rests |
  | Social | NPCs, bargains, choices |

- **Masterpiece test.** The Masterpiece always tests the primary signature.
- **Perk families** match signatures, so a perk earned in one department helps against that signature later. Route choice then becomes a build decision, like choosing a Hades god.

### 3.5 Progression currencies inside a run *(items, player choice, balance)*
- **No XP** (F5, F10). Fighting costs resources and yields little. Sneaking past is legitimate.
- **Power comes from:**
  - **Restoration kits.** The single upgrade currency (scroll of upgrade / enchanting): +1 to an exhibit-item, and repairs "damage". Guaranteed **2 per department** via a deck (F1, F2).
  - **Handling Clearance.** A re-theme of SPD strength. Heavier and stranger exhibits need clearance; you gain it from **1 guaranteed keycard per department**.
  - **Department Certificate.** For clearing or bypassing the Masterpiece: +max HP plus **one perk from three**, drawn from that department's signature family (Hades boon model; SPD tier structure, so early perks are weak late).
- **Visible quotas.** "Highlights: 2 Restoration, 1 Keycard, 1 Loan Desk", ticked off as found (F1's disclosure).
- **Bad-luck protection.** Decks and meters keyed to run depth (F2). Essentials are never placed in secret storerooms (F6).

### 3.6 Identification as attribution *(items, text and labels)*
- **The ladder.** Unknown exhibits are **Uncatalogued**. Attribution climbs the auction-house ladder of certainty:

  | Level | Label | What the player knows |
  |---|---|---|
  | 0 | *After [Department]* | category only |
  | 1 | *Manner of …* | whether it is a **Forgery** (cursed) |
  | 2 | *Circle of …* | its effect family |
  | 3 | *Workshop of …* | its exact effect |
  | 4 | *Attributed to …* | its restoration level (+N) |
  | 5 | *By …* | fully catalogued |

- **How attribution advances.**
  - **Use**, gated by exploration rather than repetition (SPD `Weapon.java`, F4).
  - **Catalogue Cards** (identify scrolls).
  - **Reading wall labels** in the department. Labels identify a *kind* for the rest of the run, so the museal text *is* the mechanic.
- **Curses as forgeries.** Forgeries are the cursed items. "Deaccession" removes a forgery's hold.
- **Consumables.** Use per-run randomised appearances over a **fixed set of about 10–12 kinds**, so knowledge transfers (F9, F12). Department-specific exhibits come pre-labelled.
- **Loan Desk items are always fully catalogued** (Brogue `ITEM_KIND_AUTO_ID`, F4).

### 3.7 Fight, sneak, explore or leave *(player choice, enemies, layout)*
- **Dormant exhibits.** Many enemies are **dormant exhibits**: they wake on proximity, noise, touching a display case, or alarms. Guards patrol.
- **Surprise attacks.** SPD's surprise attacks always hit; the museal version is "do not touch the exhibits."
- **Closing time.** Each department has a clock: a bell, dimming, then the night watch (F3). Leaving early forfeits unfound highlights but saves HP and supplies.
- **Loan Desk.** Check out one of three catalogued exhibits, with swapping allowed (Brogue library, F11).
- **Conservation Storage.** Wake one dormant exhibit as an ally (Brogue kennel).
- **Telegraphs and odds.** Dangerous specials are telegraphed a turn ahead (F13). The examine panel shows Brogue-style odds (F11).

### 3.8 Masterpieces and heat *(enemies, difficulty, meta)*
- **Masterpieces.** One per department, with phases that ramp (F7), a few exposed knobs (HP, ability cadence, adds), and behaviour shaped by gallery events (e.g. alarms raised).
- **Trustees' Directives (heat).** Unlocked after the first escape. Directives stack, like Ascension and the Pact. Examples:
  - *Extended Hours* (shorter closing clock);
  - *Budget Cuts* (one fewer Restoration kit per department);
  - *Popular Exhibition* (crowds);
  - *Strict Provenance* (more forgeries);
  - *Rotating Collection* (champion variants, like Hostile Champions);
  - *Star Loan* (Badder-Bosses-style Masterpieces);
  - *Power Cut* (darkness everywhere).
- **Rewards.** Meta-currency multipliers, plus **Restricted Wings** (new department archetypes) unlocked at heat thresholds (Dead Cells Boss Stem Cells, F16).

### 3.9 Meta-progression *(meta, items, text)*

**The user's three ideas:**
- **"Keep one item per department."**
  - As *power carried forward*, it trivialises early departments, and it is undefined when a department never recurs.
  - As **Accession**, it is excellent. On leaving a department you may accession one exhibit you carried out:
    - it enters **Your Collection** (your own gallery in the Entrance Hall, with its generated label and provenance from this run);
    - its *kind* unlocks into future pools (Dead Cells, Isaac, F16–F17).
  - Before each run you may take **one Loan** from your Collection at +0 (Hades keepsake, ITB pilot, F13, F15). The power is one bounded slot.
- **"Minor stat bumps."**
  - As mandatory progression, they are Rogue Legacy creep, and they blur self-evaluation (F20).
  - Recast them as an opt-in **Patron Membership** assist, God-Mode-like (F15): small, clearly labelled, toggleable.
- **"Skill store à la Vampire Survivors."**
  - Fine as a **Gift Shop** if it mostly sells *options*: new archetypes, starting kits, Information Desk choices, Loan Desk slots, department-archetype unlocks, "Guidebook" entries that pre-catalogue a consumable kind.
  - Any power it sells must be capped and **refundable/toggleable** (F18).
- **Without story.**
  - The **Catalogue** of every department, exhibit and creature seen. In an infinite museum, the generator's output becomes the player's personal museum directory.
  - **Your Collection** gallery.
  - A **Donor Wall** of past visits.
  - Brogue-style **conduct feats**.
  - SPD-style **badges, seeds and a daily "Today's Exhibition"** [dev 2022].

### 3.10 Who is the player? *(classes, player choice)*

Each archetype owns one core verb:

| Archetype | Core verb | Signature mechanics |
|---|---|---|
| **Night Guard** | fight | keys and locks, a torch cone, stronger in Darkness and Guarded departments |
| **Art Thief** | sneak | cracks display cases silently, bonus surprise attacks, a second Loan Desk pick |
| **Conservator** | upgrade | Restoration efficiency, "repair" forgeries into usable items, a lab |
| **Docent** | allies | leads a "tour group" of awakened exhibits |
| **Curator** (unlockable) | catalogue | identification, and *rewriting labels* to change what an exhibit is |
| **Lost Visitor** (unlockable) | — | hard mode with high luck |

Following SPD (F5), offer a two-way specialisation choice at the department-3 Certificate, and a late-run arc at department 4–5 (a "signature exhibit" ability).

### 3.11 Testing *(testing, tooling)*
- **Headless simulation.** Run personas (Fighter, Sneak, Hoarder, Rusher) through every generated department at depths 1–5 and fit hazard curves (F21).
- **Gates for new departments.** Normalise or reject departments whose hazard is more than k SD from the depth target. MAP-Elites over builds makes sure each archetype has at least 3 viable perk families.
- **Seed lock.** Seeds must reproduce runs exactly, for dailies and bug reports.

---

## 4. Pitfalls and risks

1. **Identity-coupled difficulty.** If a department's danger is part of its identity ("the scary armoury"), random order produces unwinnable early spikes and trivial late ones. Depth must set power; the department sets texture (3.3).
2. **Infinite content destroys mastery.** Roguelike skill is largely knowledge of enemies, items and rules. DCSS's clarity and diversity principles (F12) require a **finite mechanical vocabulary**. Identification only works if item *kinds* are stable (F4, F9).
3. **Consumable bloat.** SPD's 50 consumables were already too many (F9). Department-specific consumables could multiply that tenfold.
4. **Power creep in the meta.** It blurs self-evaluation and makes wins hollow (F20). DCSS's "invincible state" warning (F12) applies too. Once given, stat creep is hard to remove.
5. **Grinding and scumming.** Watch for farming departments for accession currency, waiting out hunger, use-identification by repetition, and selling loot. Countermeasures:
   - the closing clock (F3);
   - exploration-gated identification (F4);
   - no shop buyback (F12);
   - first-clear-only heat bounties (F15).
6. **Hiding essentials.** Guaranteed items in secret rooms read as unfairness (F6).
7. **Front-loaded or cheesable bosses** (F7). The Masterpiece must ramp up, and must not be solvable by kiting.
8. **Skill trees in a short run** (F5). Players never finish them, and they force planning before loot.
9. **Inconsistent randomness.** A telegraphed special that then *misses* on a die roll feels like a lie. Decide which layer is deterministic (D8).
10. **Scope.** Into the Breach cut its hub, research and events to ship (F13). A Darkest-Dungeon-style hub-building meta is a second game.
11. **Seeds vs runtime generation.** Dailies and shareable seeds need deterministic content. A runtime LLM breaks this unless outputs are cached per seed (cross-ref the generation briefs).
12. **"Keep one" exploits.** If loans keep their restoration level, players will build a super-item over runs. Normalise loans to +0 and to the run's tier.

---

## 5. Decisions for the design discussion

**D1. Run length and department count.**
- (a) SPD-length: 5 departments × 4 floors + boss, about 25 maps, 1.5–3 h.
- (b) **5 departments × (2 galleries + Masterpiece Hall), 45–75 min.**
- (c) 8 one-floor departments, 30–45 min, more variety and shallower.
- (d) Variable-size departments (cabinets, departments, wings) under a floor budget.
- *Lean: (b) at launch, built so it can grow into (d).* It shows enough departments per run to sell the premise, at browser-game length.

**D2. Route choice between departments.**
- (a) Linear random order, SPD-style.
- (b) **Hades doors: 2–3 exits with placards.**
- (c) A Slay-the-Spire whole-run floor plan shown up front.
- (d) A Dead-Cells fixed graph with random layouts.
- *Lean: (b), with a hidden StS-style graph for guaranteed rows.* The placard is the most museal UI possible, and it makes each exit an informed build decision.

**D3. What sets difficulty.**
- (a) Each department has a fixed difficulty, and the sequencer orders by it.
- (b) **Run depth sets power via role-based stat curves; the department sets texture.**
- (c) An adaptive director (experience-driven PCG) on top of (b).
- *Lean: (b), with (c) only as an optional later layer.* (a) defeats random order.

**D4. XP or no XP.**
- (a) SPD-like XP plus talents.
- (b) **No XP: Brogue-style rationed items plus a per-department Certificate (HP and a perk pick).**
- (c) XP from *discovery* (reading labels, cataloguing) instead of kills.
- *Lean: (b), with (c) as a contender.* No XP makes stealth viable and fits a museum.

**D5. Upgrade economy and bad-luck protection.**
- (a) Fully random drops.
- (b) **Guaranteed per-department quotas (2 Restoration, 1 Keycard) via decks and meters, shown on the floor plan.**
- (c) The quota is only partly visible, revealed by exploring.
- *Lean: (b).* This is directly proven in SPD and Brogue.

**D6. Time pressure.**
- (a) SPD hunger.
- (b) **A per-department closing clock (Zot clock).**
- (c) A visitor-fatigue meter with benches and a café.
- (d) None.
- *Lean: (b).* It is thematic and anti-scumming, with no inventory chore.

**D7. Identification.**
- (a) SPD-style full identification of all kinds.
- (b) **An attribution ladder with forgeries as curses, a fixed core of consumable kinds re-skinned per department, and labels that identify kinds.**
- (c) Everything pre-labelled.
- *Lean: (b).* The museum premise was made for this mechanic.

**D8. Combat randomness.**
- (a) SPD dice for everything.
- (b) **Dice for basic attacks; telegraphed, deterministic specials; Brogue-style odds on examine.**
- (c) Fully deterministic (Hoplite/ITB).
- *Lean: (b).* It meets the brief's "turn-based RPG conventions" while keeping the dangerous moments readable.

**D9. Masterpiece cadence and type.**
- (a) **A combat Masterpiece every department.**
- (b) A Masterpiece every other department, with set-piece puzzles or heists in between.
- (c) A mix chosen by the department's primary signature.
- *Lean: (a) for a 5-department run, with (c) as a stretch.*

**D10. Meta-progression model.**
- (a) Rogue Legacy power upgrades.
- (b) **Accession and Collection (unlock kinds into pools) + one Loan slot + Trustees' Directives (heat) + a Gift Shop for options + an opt-in Patron assist.**
- (c) The Gift Shop alone (Vampire Survivors).
- (d) None beyond badges and seeds (SPD).
- *Lean: (b).* It gives replay through variety, a heat ladder and collection completion, without trivialising runs, and needs no story.

**D11. Heat structure.**
- (a) Numbered levels, as in StS Ascension.
- (b) **Pick-your-own Directives, as in the Pact.**
- (c) Balatro-style per-archetype stakes.
- *Lean: (b), with first-clear bounties per archetype.* Thresholds unlock Restricted Wings.

**D12. Player archetypes at launch.**
- (a) One generalist.
- (b) **Four (Guard, Thief, Conservator, Docent), each owning a verb.**
- (c) Six or more.
- *Lean: (b)*, with Curator and Lost Visitor as unlocks.

**D13. Perk source.**
- (a) Department-themed perks (Hades boons).
- (b) Patron or benefactor "gods" chosen at altars (DCSS).
- (c) **Signature-family perks skinned by department.**
- *Lean: (c).* A finite mechanical set keeps balance testable while departments stay infinite.
