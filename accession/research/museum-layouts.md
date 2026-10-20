# Museum floor plans that play well: architecture, space syntax and roguelike level generation

*Research brief for the museum roguelike, compiled 2026-10-20. It complements `papers-levels.md` (QD, personas, the generic pipeline) and `literature-museology.md` (text and museum conventions). This brief covers architecture, space syntax and roguelike level-generation code.*

**Bottom line.**
- **Programmes, not a generic dungeon.** Each department's floor plan should come from an *architectural programme*: a small parameterised generator with its own tactical character (enfilade, rotunda with radials, glass labyrinth of cases, spiral ramp and so on).
- **Space syntax gives museum-native metrics.** Visitor movement follows *integration*. Single-sequence layouts behave *deterministically* and networks *probabilistically* (Choi). Centrepieces at the end of a vista pull visitors along the axis (Tzortzi). Spaces sort into a/b/c/d types: dead ends, corridors to dead ends, rings and choice points (Hillier). This gives a citable vocabulary for the loops, dead ends and chokepoints roguelike designers tune by feel.
- **Proven code to copy.** Brogue adds loops wherever two adjacent floor cells are more than 20 steps apart and places reward rooms behind computed chokepoints. SPD builds around one or two loops with a "landmark" room at the junction. Unexplored builds around a single big cycle chosen from 24 types.
- **The museum's own tactical contribution** is furniture that *blocks movement but not sight*: vitrines, balustrades, diorama glass and atrium voids.

Legend for how each source was read: **[F]** most or all of the text; **[M]** method and results; **[A]** abstract only; **[C]** source code; **[S]** secondary (search summary, Wikipedia or a museum page); **[cit]** citation verified, text not read.

---

## 1. Sources actually read

**Museum space and space syntax**

- Choi, Y.K. (1997). "The morphology of exploration and encounter in museum layouts." *Proc. 1st Int. Space Syntax Symposium*, London, Vol. I, paper 16. https://www.spacesyntax.net/symposia-archive/SSS1/ **[F]**
  - Journal version: Choi (1999), *Environment and Planning B* 26(2):241–250, doi:10.1068/b4525 **[A]**.
- Tzortzi, K. (2003). "An approach of the microstructure of the gallery space: the case of the Sainsbury Wing." *Proc. 4th Int. Space Syntax Symposium*, London, paper 67. https://www.spacesyntax.net/symposia-archive/SSS4/fullpapers/67Tzortzpaper.pdf **[F]**
- Tzortzi, K. & Bakola, E. (2022). "Interrogating space in archaeological site museums." *Proc. 13th Int. Space Syntax Symposium*, Bergen, paper 375. https://www.hvl.no/siteassets/hvl-internett/arrangement/2022/13sss/375tzorzi.pdf **[M]**
  - The authors' names are garbled by the PDF's font encoding; I decoded them myself.
- Peponis, J., Conroy Dalton, R., Wineman, J. & Dalton, N. (2004). "Measuring the effects of layout upon visitors' spatial behaviors in open plan exhibition settings." *Environment and Planning B* 31(3):453–473, doi:10.1068/b3041 **[A]**
- Turner, A., Doxa, M., O'Sullivan, D. & Penn, A. (2001). "From isovists to visibility graphs." *Environment and Planning B* 28(1):103–121, doi:10.1068/b2684 **[A]**
- Bitgood, S. (2006). "An analysis of visitor circulation: movement patterns and the general value principle." *Curator* 49(4):463–475 **[S]**
- Space syntax applied to games, both **[S]**:
  - Martin, P. (2014). "A spatial analysis of the JBA headquarters in Splinter Cell: Double Agent." *Entertainment Computing* 5(1).
  - Bıyık & Sürer (2020). "Developing a space syntax-based evaluation method for procedurally generated game levels." *Muğla J. Sci. Tech.* First names unverified.
- Cited via Tzortzi's papers **[cit]**:
  - Hillier & Hanson (1984). *The Social Logic of Space*. CUP.
  - Hillier (1996). *Space is the Machine*. CUP, ch. 8.
  - Benedikt (1979). "To take hold of space: isovists and isovist fields." *Env. & Planning B* 6:47–65.
  - Hillier & Tzortzi (2006). "Space syntax: the language of museum space." In Macdonald (ed.), *A Companion to Museum Studies*, Blackwell, 282–301.
  - Tzortzi (2015). *Museum Space*. Routledge.

**Museum buildings [S]** (Wikipedia, AMNH and Dezeen pages): Dulwich Picture Gallery (1817), Guggenheim (1959), Pitt Rivers, Soane's Museum, Akeley Hall (AMNH, 1936), Depot Boijmans (2021), Altes Museum, Glyptothek.

**Roguelike source code [C]**, all read 2026-10-20.
- *Shattered Pixel Dungeon* (`00-Evan/shattered-pixel-dungeon`):
  - `levels/builders/{Builder,RegularBuilder,LoopBuilder,FigureEightBuilder}.java`
  - `RegularLevel.java`, `SewerLevel.java`
  - `rooms/{Room,standard/StandardRoom,connection/ConnectionRoom,special/SpecialRoom}.java`
  - `painters/RegularPainter.java`
- *Brogue CE* (`tmewett/BrogueCE`), `src/brogue/Architect.c`: `carveDungeon`, `attachRooms`, `addLoops`, `analyzeMap`, `designLakes`, `buildABridge`, `digDungeon`, `buildAMachine`.
- *DCSS* (`crawl/crawl`):
  - `dat/des/builder/layout.des` and `layout_loops.des`
  - `docs/develop/levels/introduction.txt`

**Developer writing**
- Boris the Brave (2021, updated 2025). "Dungeon Generation in Unexplored." https://www.boristhebrave.com/2021/04/10/dungeon-generation-in-unexplored/ **[F]**
- Nystrom, B. (2014). "Rooms and Mazes." https://journal.stuffwithstuff.com/2014/12/21/rooms-and-mazes/ **[F]**
- Kazemi, D. "Spelunky Generator Lessons" pt. 1. https://tinysubversions.com/spelunkyGen/ **[F]**
- CrawlWiki, "Pillar dancing." http://crawl.chaosforge.org/Pillar_dancing **[F]**
- Ge, J. ("Kyzrati") (2015). "FAQ Friday #23: Map Design," r/roguelikedev **[S]**

**PCG research**
- Shaker, Liapis, Togelius, Lopes & Bidarra (2016). "Constructive generation methods for dungeons and levels." Ch. 3 of Shaker, Togelius & Nelson, *Procedural Content Generation in Games*, Springer. http://pcgbook.com/chapter03.pdf **[M]**
- Dormans, J. & Bakkes, S. (2011). "Generating missions and spaces for adaptable play experiences." *IEEE TCIAIG* 3(3):216–228 **[F]**, §IV–VI and VIII.
- Yannakakis & Togelius (2025). *Artificial Intelligence and Games*, 2nd ed., §9.1, pp. 287–288 **[F]**.
- Cooper, S. (2023). "Sturgeon-MKIII: simultaneous level and example playthrough generation via constraint satisfaction with tile rewrite rules." FDG 2023, doi:10.1145/3582437.3587205 **[M]**
- Cooper, S. & Bazzaz, M. (2024). "Literally unplayable: on constraint-based generation of uncompletable levels." FDG 2024, doi:10.1145/3649921.3659844 **[A]**
- Citations verified, text not read **[cit]**:
  - Cooper (2022). "Sturgeon: tile-based procedural level generation via learned and designed constraints." *AIIDE* 18(1):26–36.
  - Karth & Smith (2017). "WaveFunctionCollapse is constraint solving in the wild." FDG, doi:10.1145/3102071.3110566.
  - Gumin (2016). WaveFunctionCollapse, GitHub.
  - Smith & Mateas (2011). "Answer set programming for procedural content generation: a design space approach." *IEEE TCIAIG* 3(3):187–200.
  - Smith & Whitehead (2010). "Analyzing the expressive range of a level generator." PCG Workshop.
  - Dormans (2010). "Adventures in level design." PCG Workshop.
  - Lynch (1960). *The Image of the City*. MIT Press.
- Mouret & Clune (2015). "Illuminating search spaces by mapping elites." arXiv:1504.04909 **[A]**
- Hsu, Fontaine, Earle, Edwards, Togelius & Nikolaidis (2022). "Generating diverse indoor furniture arrangements." SIGGRAPH Posters, arXiv:2206.10608 **[A]**

**Interior layout**
- Merrell, Schkufza, Li, Agrawala & Koltun (2011). "Interactive furniture layout using interior design guidelines." *ACM TOG* 30(4):87. https://paulmerrell.org/furnitureLayout2.pdf **[M]**, §4.
- Yu, Yeung, Tang, Terzopoulos, Chan & Osher (2011). "Make it home: automatic optimization of furniture arrangement." *ACM TOG* 30(4), doi:10.1145/1964921.1964981 **[A/M]**
- Merrell, Schkufza & Koltun (2010). "Computer-generated residential building layouts." *ACM TOG* 29(6):181 **[S]**
- Lopes, Tutenel, Smelik, de Kraker & Bidarra (2010). "A constrained growth method for procedural floor plan generation." GAME-ON **[S]**

**Not used.** A circulation typology attributed to Lehmbruck (1974) ("arterial/comb/chain/star/block") could not be confirmed, so I left it out.

---

## 2. Key findings

**F1. Integration predicts where visitors walk, except in single sequences** (Choi 1997, §3–5, Tables 1–3).
- **Study.** Choi tracked 20 visitors on each of eight art-museum floors (High Museum, LACMA, MOCA, Oakland, Asian Art).
- **What layout predicts.**
  - Spaces visited correlated with integration (mean r = −0.455 convex, −0.508 axial; RRA is inverse, so the sign is expected).
  - Visit frequency correlated with connectivity (mean 0.711).
  - Where people *stood* was unrelated to configuration.
- **The exception.** LACMA's Hammer building, "a single viewing sequence", breaks every correlation. Choi calls it the *deterministic* model, as against the *probabilistic* model of networks.
- **Intelligibility** (the correlation between connectivity and integration) governs how predictable movement is.
- → *Museum:*
  - Wandering and patrolling AI should favour high-integration rooms, because that is where encounters happen.
  - Each programme declares itself deterministic or probabilistic and is validated accordingly.
  - Low intelligibility is a dial for "disorienting" departments.
- [layout, enemies, difficulty]

**F2. Accessibility predicts contact; co-visibility predicts engagement** (Peponis et al. 2004, abstract).
- → *Museum: put must-notice items where many tiles can see them, and optional loot in visually segregated depth.* [exhibit placement, items]

**F3. A centrepiece at the end of a vista pulls movement, and a non-Hamiltonian plan strands visitors** (Tzortzi 2003, §3.1, §4).
- **Axes.** The Sainsbury Wing's axes are terminated by altarpieces.
- **Movement.** "50% move along the perspective axis, attracted by the visual strength of the picture at the end of the long vista." The central enfilade gets only about a quarter of the movement because it is not connected to the entrance.
- **Graph.** The plan is non-Hamiltonian: visitors "cannot get to all spaces without crossing some of them more than once or missing out parts of the gallery". One added opening would fix this.
- → *Museum:*
  - Put the centrepiece (boss, Masterpiece or exit) at the end of an axis visible from an early room. It is free signposting.
  - Test the room graph (20 or fewer nodes) for a Hamiltonian cycle. Then decide per programme whether completionists can sweep it without backtracking, adding one opening when they should.
- [layout, player choice, text]

**F4. The four space types, and museum ratios** (Tzortzi & Bakola 2022, Table 1, §5; after Hillier 1996, ch. 8).
- **Types.**
  - a = dead end;
  - b = controls access only to a- or b-spaces;
  - c = on a ring;
  - d = on more than one ring (route choice).
- **Ratios.** In three Greek site museums c-spaces dominated, a-spaces were "between a quarter and a third", and b- and d-spaces were absent.
- **Depth.** At Delphi the "hierarchy of access … culminates in the deepest space", the Charioteer's.
- → *Museum: a citable target profile. Aim for about 70% ring rooms and 25–33% rewarding alcoves, with few b-spaces (long dead-end corridors) and a few d-spaces in hub programmes. The deepest a-space holds the best optional exhibit.* [layout, items, validation]

**F5. Visitors minimise steps and backtrack only for visible payoff** (Bitgood 2006, secondary). Under the "general value principle", visitors weigh benefit against time and effort.
- → *Museum: players do the same. Every a-space needs a visible lure (a glinting vitrine, a lit diorama).* [layout, items]

**F6. Isovists and visibility graphs** (Turner et al. 2001; Benedikt 1979). The visibility graph links mutually visible locations, and its measures describe both visibility and accessibility.
- → *Museum: compute visual integration offline (O(n²) in tiles) on downsampled grids. Use it for metrics and to place snipers (high isovist area) and ambushers (low).* [testing, enemies]

**F7. Museum typologies are tactical typologies** [S]. Dulwich is "a series of interlinked rooms lit by natural light through overhead skylights". Guggenheim visitors "rode an elevator to the top of the building and descended the ramp". Pitt Rivers is "arranged typologically" in a hall with "two mezzanine levels". Akeley Hall has 28 dioramas on two floors around eight elephants. Soane's Picture Room walls are "moveable planes". Depot Boijmans opens storage of about 151,000 works.
- → *Museum: each becomes a programme in §3.3.* [layout, enemies]

**F8. SPD builds levels around loops, with a landmark at the junction** [C].
- **Builders.** `RegularLevel.builder()` picks `LoopBuilder` or `FigureEightBuilder` 50/50.
  - *Loop:* main-path rooms go around a parametric curve, with the entrance at its start and the exit halfway round. Other rooms branch toward the centre.
  - *Figure-eight:* threads two loops through a *landmark room* (the largest main-path room with at least 4 connections), with the entrance halfway round loop 1 and the exit halfway round loop 2.
- **Parameters.**
  - Main path = 25% of multi-connection rooms plus jitter.
  - 0–2 "tunnel" rooms between path rooms.
  - `extraConnectionChance` 0.30, checked twice per adjacency, so about 50% of adjacent pairs connect.
  - Room size categories: NORMAL 4–10, LARGE 10–14, GIANT 14–18.
  - `connectionWeight = sizeFactor²`, so big rooms become hubs.
  - Sewer floors have only 4–6 standard room units and 1–2 specials.
- **Painter.**
  - Merges adjacent rooms into openings at least 3 wide.
  - Hidden-door chance is depth/20, but standard rooms keep an unbroken path.
  - Cosmetics use a *separate RNG*.
- **Population.** No mobs within 8 tiles of the entrance by FOV or walk.
- → *Museum: the figure-eight is the rotunda plan, and the loop is the courtyard circuit. Copy the size categories, hub weighting, archways versus doors, the cosmetic RNG and the entrance safe zone. Keep levels small.* [layout, determinism, difficulty]

**F9. Brogue: accretion, then loops by path distance, then chokepoint analysis** [C].
- **Accretion.** `attachRooms` makes 35 attempts to fit rooms designed "in hyperspace" against existing walls.
- **Loops.** `addLoops(grid, 20)` turns a wall cell into a doorway if the floor cells on either side are more than 20 steps apart.
- **Lakes and bridges.** Lakes are placed only if `lakeDisruptsPassability` is false, with 10 tries. Bridges are built only if they shorten pathing by a depth-dependent ratio.
- **Chokepoints.** `analyzeMap` marks loop cells and chokepoints and builds a `chokeMap` (cells cut off if blocked). Room "machines" (vaults) go at gate sites whose enclosed area fits the blueprint.
- **Doors.** 60% of door sites become doors.
- → *Museum:*
  - `addLoops` with a per-programme threshold *d* is the most useful single post-pass.
  - The `chokeMap` finds "galleries behind one door" for special exhibitions, and forbids vitrines on gate cells.
  - Atria and pools are Brogue lakes.
- [layout, items, validation]

**F10. DCSS separates layouts from vaults and warns against fixed chokepoints** [C].
- **Layouts.** Layouts are "ORIENT: encompass and TAGS: layout … not true vaults, in that the dungeon builder can add other vaults on top of them", tagged `layout_type_open`, `layout_type_city` and so on.
- **Floating vaults** connect through explicit `@` exits.
- **Minivaults** are placed after the layout and must overlap it.
- **The developers' advice:** "Small is good!" and "Randomise!", because if "a good chokepoint to fight in [is] always put in the same place, it's a no-brainer for those who know" (`introduction.txt` §F).
- → *Museum: programmes are DCSS layouts. Period rooms and set pieces are vaults with SHUFFLE/SUBST-style variants. Never fix the fighting position.* [layout, tooling]

**F11. Loops enable pillar dancing, which DCSS had to nerf** (CrawlWiki).
- **What it is.** Fleeing a same-speed monster around "anywhere from a 1x3 block to a whole ring of rooms" to regenerate.
- **The fix.** It was "severely nerfed as of version 0.29" by attacks of opportunity: a 33% free hit when a same-speed adjacent enemy re-approaches.
- → *Museum: sculpture courts and colonnades are pillar-dancing machines. Choose a counter up front (D6).* [difficulty]

**F12. Loops are what make maps decisions** (Nystrom 2014; Kyzrati 2015 [S]).
- **Nystrom.** His generator builds a spanning tree, adds an "extra connector chance", then prunes dead ends. "Fundamentally, games are about making decisions from a set of alternatives". Without loops, "you can't circle around to avoid certain enemies, or sneak out a back passage."
- **Kyzrati.** Long dead ends without reward are "the worst".
- → *Museum: every probabilistic programme gets at least one circuit through the Intro. Long dead ends are rewarded or removed.* [layout, player choice]

**F13. Unexplored builds each level around one cycle** (Boris 2021).
- **Cycle.** Start, goal and one loop on a 5×5 node grid. The entrance and goal split the loop into two arcs, and one of 24 cycle types (lock-and-key, hidden shortcut, ThreeLeverHub, hub, lake, …) sets their pacing.
- **Embellishment.** Minor cycles and dead ends are then added.
- **Late binding.** "Biomes" annotate theme, enemy pools and room types; nonterminals ("Obstacle") resolve late.
- **Tiles.** The grid is doubled for connectors and scaled ×5; set pieces are placed by pattern ("bookshelves against walls without blocking doors").
- **Repair.** Lock/key links are stored so the game can unblock progress ("Pray For Help").
- **Scale.** About 5,000 rules in 50 modules. Dormans: "it is so much more interesting to generate small levels than it is to generate large ones."
- → *Museum: "biome" = department spec, and cycle type = exhibition structure (§3.4). Store lock links for a diegetic "ask a guard" rescue. Variety will come from many small hand-written cases.* [layout, tooling, NPCs]

**F14. Missions and spaces** (Dormans & Bakkes 2011).
- **Locks and keys.** Grammar rules add lock/key pairs, then *move locks forward and keys backward* (Figs. 9–10).
- **Layout.** A spring layout embeds the mission graph. Crossings are solved by teleporters or "stacking multiple 2-D levels … stairs". A shape grammar then adds detail, fast enough that there is "no need to generate multiple levels and select".
- **Difficulty in space** (§VIII.C): "a shorter, more difficult path, and longer, easier paths".
- → *Museum: the exhibition narrative is the mission. The short hard path versus the long easy one maps onto guarded staff corridors versus public galleries.* [layout, difficulty, player choice]

**F15. Constructive dungeon methods** (PCG book ch. 3).
- **BSP** (§3.2): "an all-seeing dungeon architect".
- **Diggers** (§3.3): organic shapes at the price of control.
- **Grammars** (§3.5): Adams; Dormans; van der Linden et al.
- **Spelunky** (§3.7.1): a 4×4 room grid with a solution path, and rooms from templates with randomised chunks. Kazemi details the walk: roll 1–5 for left, right or down, and room types 0–3 encode the exits.
- → *Museum: BSP for the basement, a Spelunky walk for the one-way temporary exhibition, templates with chunks for bays.* [layout]

**F16. Constraint solvers give guarantees at a cost** (Cooper 2023).
- **Speed.** Sturgeon-MKIII's lock-and-key dungeon, generated together with a playthrough, took a median of 18 s and a maximum of 67 s (Table 1).
- **Bias.** "the solver would often prefer to generate levels with very short, simple solutions."
- **Certification.** Cooper & Bazzaz (2024) generate *uncompletable* levels to certify that a generator only makes completable ones.
- **Related.** ASP (Smith & Mateas 2011) and WFC-as-constraint-solving (Karth & Smith 2017) are the related work [cit].
- → *Museum: use solvers offline only, for vault libraries and generator certification.* [tooling, testing]

**F17. Interior-design rules transfer to exhibit placement** (Merrell et al. 2011, §4; Yu et al. 2011).
- **Merrell's terms.**
  - *clearance*: Minkowski sums with the required free space;
  - *circulation*: the free configuration space of a person modelled as an 18-inch disc;
  - pairwise relationships and *conversation*;
  - *balance* and *alignment*;
  - *emphasis*: groups face a focal point.
- **Yu et al.** Priors on accessibility, visibility and pairwise relations learned from exemplars, optimised by simulated annealing.
- **Merrell et al. (2010)** [S]. An "architectural program" (from a Bayesian network) is realised as floor plans by stochastic optimisation. That is our programme → plan split.
- → *Museum: grid rules.*
  - Clearance = reserved door-to-door walkways.
  - Circulation = walkways stay at least 1 tile wide.
  - Alignment = cases parallel to walls.
  - Balance = mirror symmetry in formal programmes.
  - Emphasis = benches and sightlines face the centrepiece.
- [exhibit placement]

**F18. Levels as procedural architecture** (AI&G 2e §9.1, p. 288).
- "a sequence of identical rooms can easily make the player disoriented".
- Open worlds use "edges to constrain player freedom and landmarks to orient the player and motivate exploration" (Lynch 1960; Liapis et al. 2014).
- → *Museum: white walls and repeated vitrines invite disorientation. Every gallery needs a landmark, and every department one dominant landmark.* [visuals, layout]

**F19. Space syntax has barely been applied to game levels** [S].
- Martin (2014) used integration, isovist area and visibility/accessibility discrepancy on a Splinter Cell level.
- Bıyık & Sürer (2020) used integration, connectivity and depth to evaluate a procedural generator.
- → *Museum: space-syntax descriptors for QD and validation of roguelike levels look like open ground: a modest publishable angle.* [testing]

---

## 3. Ideas for the museum roguelike

### 3.1 The museum hierarchy as the generator hierarchy

| Museum unit | Generator object | Decided by |
|---|---|---|
| **Department** | One level: a seeded `DepartmentSpec` plus tier | Concept generator, sequencing |
| **Wing** | A plan region built by one programme. v1: a main programme, an optional side wing, and the staff layer | Programme embedder |
| **Gallery** | A room-graph node with a role (intro, section, centrepiece, study room, coda), a size class and a space type | Exhibition-narrative graph |
| **Bay** | A furniture template (a meso-pattern): "typological series", "case pair facing a bench", "plinth trio" | Curator pass |
| **Case** | A tile object (vitrine, plinth, diorama) holding an item or enemy, plus a label | Curator pass |

### 3.2 The tactical furniture vocabulary

The core matrix is **blocks movement** × **blocks sight**. This matches Dahlskog et al.'s *Passable* and *Seethru* attributes (`papers-levels.md` F5).

| | Sight passes | Sight blocked |
|---|---|---|
| **Movement passes** | floor, rope line `=` (costs a turn), bench `b`, archway | velvet curtain, darkened gallery, smoke |
| **Movement blocked** | **vitrine `v`, diorama glass, balustrade or void `~`, low furniture `f`** | wall, statue or column `o`, shelving `H`, partition `\|`, crate `c` |

The bold cell is the museum's distinctive contribution. It produces:
- ranged duels across glass;
- "see the loot you can't reach";
- balcony snipers;
- pathing distance much greater than visual distance.

**Glass should be breakable.** Breaking it:
- costs turns;
- makes noise (raising alert, bringing guards);
- leaves shard tiles;
- opens a shortcut;
- may release its contents.

**Sight-only blockers.** Curtains and darkness give walk-through hiding places.

**Further cheap properties:**
- *pushable* (crates, plinths on castors);
- *movable wall* (Soane's planes, compactor shelving);
- *elevated* (balcony tiles: a ranged bonus, unreachable by melee from below);
- *slow* (pools, ropes);
- *one-way* (turnstiles).

### 3.3 Twelve architectural programmes

**Sketch legend:**

| Symbol | Meaning | Movement / sight |
|---|---|---|
| `#` | wall | blocks both |
| `.` | floor | open |
| `+` | opening | open |
| `S` | hidden staff door | open once found |
| `v` | vitrine | blocks movement, not sight |
| `~` | void, balustrade, pool or diorama glass | blocks movement, not sight |
| `f` | low furniture | blocks movement, not sight |
| `o` | statue or column | blocks both |
| `H` | shelving | blocks both |
| `\|` | partition | blocks both |
| `c` | crate | blocks both |
| `C` | centrepiece | |
| `E` / `X` | entrance / exit | |
| `=` | rope line | |
| `b` | bench | |
| `:` | balcony | |
| `^` | stair | |
| `d` | diorama interior | |

**P1. Enfilade suite.**
- **Precedents:** Dulwich, Louvre Grande Galerie, Sainsbury Wing (F3, F7).
- **Tactics:**
  - The aligned door axis is one long sightline, which favours ranged play in both directions.
  - Doorways are chokepoints unless a parallel staff corridor adds flanking circuits.
  - The centrepiece terminates the vista.
- **Algorithm:**
  - A 1D chain of 4–8 rooms with doors on a shared axis row (SPD `LineBuilder` role).
  - An optional parallel corridor with 2–4 cross-links turns b-spaces into c-spaces.
- **Knobs:** axis alignment, number of cross-links, room-size variance.
```
##############################
#E...+....+....+....+.......C#
#.v.v#.v.v#..o.#.v.v#.o..o...#
#....#....#....#....#........#
##S#####S#######S#####S#####+#
#...........................X#
##############################
```

**P2. Rotunda and radials.**
- **Precedents:** Altes Museum; SPD's figure-eight landmark (F8).
- **Tactics:**
  - The hub has the highest integration, so patrols and fights converge there (F1).
  - A column ring gives short pillar loops.
  - Radials are a-spaces unless an ambulatory joins them.
  - The exit lies across the hub, making the hub a natural boss arena.
- **Algorithm:**
  - Polar embedding: a hub disc of radius 3–6 (midpoint circle).
  - k = 3–6 spokes at 360/k ± jitter.
  - An optional ring corridor through the spoke ends.
- **Knobs:** k, ambulatory on or off, column density.
```
###########+##########
#.v.v.v.v.#.#.v.v.v.v#
#.........+.+........#
######.####+####.#####
#.v.v#.#o.....o#.#v.v#
#E...+.+...C...+.+...X
#.v.v#.#o.....o#.#v.v#
######.####+####.#####
#.........+.+........#
#.v.v.v.v.#S#.v.v.v.v#
######################
```

**P3. Courtyard quadrangle.**
- **Precedent:** the British Museum's Great Court and Reading Room drum.
- **Tactics:**
  - Many circuits and almost no chokepoints: the most route choice of any programme.
  - The court is exposed and the ring is sheltered.
  - The drum is a giant pillar, and its interior is a one-door vault at a Brogue gate site.
- **Algorithm:**
  - A rectangular ring BSP-split into rooms around an inner court, with 4–8 openings between them.
  - The drum is placed as a connectivity-checked Brogue lake.
- **Knobs:** number of openings, court furniture, drum size.
```
############################
#E...+.....+.....+.....+...#
#.v..#.v.v.#.v.v.#.v.v.#.v.#
#....##+#######+#######+...#
#.v..#..................#..#
#....+.......####.......+..#
#.v..#.......#C.+.......#.v#
#....+.......####.......+..#
#.v..#..................#..#
#....##+#######+#######+...#
#.v..#.v.v.#.v.v.#.v.v.#.v.#
#....+.....+.....+.....+..X#
############################
```

**P4. Grand hall with mezzanine.**
- **Precedents:** Pitt Rivers, NHM Hintze Hall, Akeley Hall.
- **Tactics:**
  - Verticality on one map: balcony snipers shoot across the balustrade while melee enemies hold the floor.
  - The stairs are the chokepoints.
  - A skeleton sits on the axis.
- **Algorithm:**
  - One large rectangle with symmetric bays (Merrell's balance and alignment).
  - Balcony bands along the long walls, with stairs at the ends.
  - Balcony tiles flagged `elevated`.
- **Knobs:** balcony coverage, stair count, bay density.
```
##############################
#::::::::::::::::::::::::::::#
#^~~~~~~~~~~~~~~~~~~~~~~~~~~^#
#..v..v..v..o...o...v..v..v..#
#E............C.............X#
#..v..v..v..o...o...v..v..v..#
#^~~~~~~~~~~~~~~~~~~~~~~~~~~^#
#::::::::::::::::::::::::::::#
##############################
```

**P5. Typological labyrinth of cases.**
- **Precedent:** Pitt Rivers.
- **Tactics:**
  - A glass maze: you see everything and reach little.
  - Ranged enemies dominate.
  - Breaking glass is the recurring decision.
- **Algorithm:**
  - Randomised DFS over a coarse case grid, plus Nystrom's extra-connector chance of 0.1–0.25.
  - Cases are see-through walls.
  - Each bay holds one "type" (twelve keys, thirty spoons), which feeds the labels.
- **Knobs:** loop chance, aisle width, glass toughness.
```
###########################
#Ev...v...........v.......#
#.vvv.v.vvv.vvvvv.v.vvv.v.#
#...v.v.v...v.....v...v...#
#vv.v.v.v.vvv.vvvvv.v.vvv.#
#.v.v...v...v...v.....v...#
#.v.v.v.v.v.vvv.vvvvvvv.v.#
#.........v.............vX#
###########################
```

**P6. Open storage stacks.**
- **Precedent:** Depot Boijmans.
- **Tactics:**
  - Short sightlines, with ambushes at aisle crossings.
  - Parallel aisles form long circuits: stealth country.
  - Compactor shelving acts as movable walls, and crates can be pushed.
- **Algorithm:**
  - A Manhattan grid of shelf blocks (in the spirit of DCSS `layout_regular_city`).
  - Random deletion of blocks and insertion of cross-aisles.
- **Knobs:** block length, cross-aisle frequency, number of compactors.
```
###########################
#E.HHHHHH.HHHHHH.HHHHHH...#
#.........................#
#..HHHHHH.HHHHHH.HHHHHH.c.#
#..HHHHHH.HHHHHH.HHHHHH.c.#
#.....=.......=...........#
#..HHHHHH.HH.HHH.HHHHHH.cc#
#..HHHHHH.HH.HHH.HHHHHH...#
#........c.........S.....X#
###########################
```

**P7. Diorama hall.**
- **Precedent:** Akeley Hall.
- **Tactics:**
  - A dark, wide hall with a large attack surface, so it is easy to get surrounded.
  - Lit glass alcoves are *dormant spawners* that wake on a timer or on noise. That makes this a wave challenge.
  - The central group is both cover and landmark.
- **Algorithm:**
  - A perimeter ring of glass-fronted alcoves, painted by the department theme.
  - A central group and a light map.
- **Knobs:** alcove count, wake rule, light radius.
```
###########################
#ddd#ddd#ddd#ddd#ddd#ddd#d#
#~~~#~~~#~~~#~~~#~~~#~~~#~#
#.........................#
#...........o.o...........#
#E...........C...........X#
#...........o.o...........#
#.........................#
#~~~#~~~#~~~#~~~#~~~#~~~#~#
#ddd#ddd#ddd#ddd#ddd#ddd#d#
###########################
```

**P8. Period-room suite.**
- **Precedents:** Soane's Museum; the Met's period rooms (see `literature-museology.md`).
- **Tactics:**
  - Small rooms with low furniture that you can see over but not walk through.
  - Closing doors break sight.
  - Soane-style hinged panels act as hidden doors.
- **Algorithm:**
  - DCSS-style floating vaults from an authored library, each with explicit `@` exits, joined by a spine corridor.
  - Variants come from SHUFFLE/SUBST (F10).
- **Knobs:** vault set, hidden-door chance.
```
##############################
#E...+.f..f.#..ff..+.f....f..#
#....#......S......#.........#
#....#.ffff.#.f..f.#..ffff...#
#....#......#......#.........#
#....##+#####+######+#####.###
#............................X
##############################
```

**P9. Sculpture court.**
- **Precedent:** the Glyptothek.
- **Tactics:**
  - The most pillar loops and the least defensible ground.
  - Kiting and line-of-sight play, such as statues that move only when unseen.
- **Algorithm:**
  - Poisson-disc plinths with spacing of at least 3, which guarantees passability.
  - Optional mirror symmetry.
  - A central pool placed as a Brogue lake.
- **Knobs:** density, symmetry, fraction of statues that animate.
```
###########################
#E.....o.....o.....o......#
#..o.......o...o.......o..#
#......o...........o......#
#..o.......~~~~~.......o..#
#......o...~~C~~...o.....X#
#..o.......~~~~~.......o..#
#......o...........o......#
#..o.......o...o.......o..#
###########################
```

**P10. Spiral ramp.**
- **Precedent:** the Guggenheim.
- **Tactics:**
  - Choi's deterministic model: one route and no loops, so it plays as a gauntlet.
  - Each lap sees the others across void strips: enemies snipe, and the player can shoot back.
  - Compensation: a staff lift opens as a shortcut back once the centre is reached (Unexplored's "shortcut" cycle).
- **Algorithm:** a square-spiral carve with laps 1–2 tiles wide, separated by void strips, plus bays.
- **Knobs:** lap count, lap width, whether the void is see-through.
```
###########################
#E..........b.............#
#~~~~~~~~~~~~~~~~~~~~~~~~.#
#...........b...........~.#
#.~~~~~~~~~~~~~~~~~~~~~.~.#
#.~...................~.~.#
#.~.~C~~~~~~~~~~~~~~~.~.~.#
#.~.~X................~.~.#
#.~.~~~~~~~~~~~~~~~~~~~.~.#
#.~.........b...........~.#
#.~~~~~~~~~~~~~~~~~~~~~~~.#
#...........b.............#
###########################
```

**P11. Back of house (conservation basement).**
- **Tactics:**
  - Classic rooms and corridors with doors, traps and darkness.
  - It doubles as the **staff-only layer**, reached by hidden doors from any programme. This is F14's short, dangerous route.
- **Algorithm:** BSP (F15), then `addLoops(d≈20)`, then doors on 60% of door sites.
- **Knobs:** BSP depth, *d*, door ratio.
```
##############################
#E...#......+.....#.....+....#
#....+......#.....#.....#..c.#
#....#......#.....##+####....#
###+######+##...........+....#
#.........#...c..#.....###+###
#.........+......#.....#.....#
#..c......####S###.....+....X#
##############################
```

**P12. Temporary exhibition route.**
- **Tactics:**
  - A forced serpentine route behind a one-way turnstile.
  - The textbook sequence: intro panel, sections, centrepiece, then a coda that exits through the shop.
  - Suits set-piece or finale departments.
- **Algorithm:** a Spelunky-style path walk over a coarse grid (F15), with partitions and section templates.
- **Knobs:** path length, number of side bays.
```
##########################
#E...|...........|......X#
#....|..v..|..v..|...v...#
#....|.....|.....|.......#
#....|.....|.....|.......#
#..........|.............#
##########################
```

**The sketches, measured.** These numbers come from `../prototypes/space-syntax/metrics.py`. The maps are tiny, so read them as illustrative only.

Column definitions:
- **loops**: holes in the walkable region, split into pillar loops (a ring of 16 tiles or fewer) and circuits.
- **choke**: share of tiles whose removal cuts off at least 4 tiles (Brogue's definition).
- **defensible**: share of tiles with 2 or fewer walkable neighbours.
- **open**: mean share of floor within radius 7 that is in line of sight.
- **glass**: share of interior obstacles that are see-through.
- **tort**: path length divided by Chebyshev distance.

| programme | loops (pillar/circuit) | choke | defensible | open | glass | tort |
|---|---|---|---|---|---|---|
| enfilade | 7/3 | 0.00 | 0.63 | 0.44 | 0.60 | 1.07 |
| rotunda | 5/0 | 0.13 | 0.62 | 0.36 | 0.83 | 1.00 |
| courtyard | 11/3 | 0.00 | 0.37 | 0.55 | 0.95 | 1.24 |
| grand hall | 1/2 | 0.00 | 0.58 | 0.91 | 0.93 | 1.07 |
| case labyrinth | 3/2 | 0.30 | 0.88 | 1.00 | 1.00 | 1.58 |
| storage | 2/4 | 0.03 | 0.66 | 0.40 | 0.00 | 1.21 |
| diorama | 0/1 | 0.00 | 0.07 | 0.90 | 0.94 | 1.00 |
| period rooms | 6/2 | 0.00 | 0.40 | 0.57 | 1.00 | 1.07 |
| sculpture court | 14/1 | 0.00 | 0.15 | 0.66 | 0.39 | 1.00 |
| spiral | 0/0 | 0.95 | 1.00 | 0.98 | 0.99 | 25.7 |
| basement | 4/1 | 0.01 | 0.10 | 0.50 | 0.00 | 1.00 |
| temp. exhibit | 3/0 | 0.09 | 0.06 | 0.64 | 0.20 | 1.13 |

Even at this scale the programmes separate on a few axes:
- **Openness × glass** puts the labyrinth and the spiral (see but can't reach) apart from storage and the basement (can't see).
- **Chokepoints × loops** puts the spiral (a gauntlet) apart from the sculpture court (kiting).

These axes are the behaviour-characterisation candidates for §3.5.

### 3.4 The layout pipeline

This refines `papers-levels.md` §6(i) on the architectural side. It is a seeded function of the spec, the tier and the entry door. Budget: under 50 ms in the browser, with bounded retries.

**1. Exhibition-narrative graph (the mission).**
- **Skeleton:** `Intro` (orientation panel, plus the signature mechanic in its simplest form) → *k* = 2–4 `Section`s of 1–3 galleries each → `Centrepiece` (Masterpiece or boss) → `Coda` (shop or café) → 2–3 exit doors.
- **Optional nodes:**
  - study rooms and cabinets (loot a-spaces);
  - a ticketed special exhibition (lock: ticket);
  - "closed for installation" (a forced detour);
  - a parallel staff-only graph.
- **Cycle type**, from a small authored set (F13):
  - *Circuit*: the entrance and centrepiece share a ring.
  - *Two routes*: public galleries plus a short, guarded staff corridor (F14).
  - *Hub*.
  - *Lake*: a central void or court crossed by bridges.
  - *Gauntlet*: a forced route with a shortcut back.
- **Constraints:**
  - keys before locks (move locks forward and keys backward);
  - entrance-to-centrepiece room count within [Lmin, Lmax] for the tier;
  - at least one cycle through the Intro, except in deterministic programmes;
  - the centrepiece at maximum depth or on the far arc of the ring (F4);
  - exits beyond the centrepiece or opposite the entrance, so fighting the highlight is a choice;
  - staff edges never required.

**2. Spatial embedding.** Each programme maps graph nodes onto a coarse grid, Unexplored-style (about 5×5 nodes, doubled for connectors).
- **Embedding by programme:**
  - line (enfilade);
  - polar (rotunda);
  - ring (courtyard);
  - spiral;
  - Manhattan grid (storage);
  - BSP leaves (basement);
  - path walk (temporary exhibition).
- **Constraints:**
  - The plan is planar, or crossings become stairs or lifts (Dormans).
  - Size class follows role: centrepiece GIANT, sections LARGE or NORMAL.
  - Big rooms carry more edges.
  - Where the programme requires it, a straight entrance-to-centrepiece axis exists in an early room (F3).
  - Optional: add one opening if a Hamiltonian cycle is wanted and missing.

**3. Rooms and openings.**
- Rasterise rectangles, circles, octagons and apses.
- Each edge becomes an archway (at least 3 wide, as SPD does for formal suites) or a door (basement).
- Run `addLoops(d)` with d = ∞ for the spiral and temporary exhibition, about 20 by default, and about 12 for the courtyard.
- Voids and pools are connectivity-checked lakes. Bridges go in only where they shorten paths.
- Hidden staff doors follow SPD's rule that public rooms keep an unbroken path.

**4. Curation.** Bay templates per room role, placed by Merrell-style grid rules (F17):
- reserved walkways at least 1 tile wide;
- cases aligned with the walls;
- symmetry in formal programmes;
- benches facing the centrepiece;
- nothing blocking on a `chokeMap` gate cell.

Tactical seasoning:
- every combat-sized room has at least one sight-blocker and at least one see-through blocker;
- no room larger than 12×12 without cover;
- the room the player enters by has an escape other than the way back.

**5. Population.**
- An entrance safe zone of 8 tiles by FOV and by walk (SPD).
- Patrols on the integration core, the top quartile of rooms (F1).
- Snipers on high-isovist tiles and balconies; ambushers on low-isovist aisle crossings (F6).
- Dormant exhibits in cases and dioramas.
- Vaults behind gate sites whose `chokeMap` size fits.
- The best optional item in the deepest a-space, with a visible lure (F4, F5).

**6. Text hooks.**
- Gallery roles, bay types and placed exhibits are emitted as facts for the label generator.
- The Intro's orientation plan is drawn from the real graph (D9).

**7. Validation and repair.** The checks are deterministic and take milliseconds:
- reachability of all required nodes and exits;
- a BFS over (position, keys) for lock order;
- metrics inside the programme's envelope;
- the entrance safe zone;
- no long unrewarded dead end;
- the required axis is visible;
- staff paths are optional.

The sibling brief's worst-case runner follows. On failure:
1. local repair (open a wall cell, delete a case);
2. reseed, up to N times;
3. a certified fallback template, logged.

Cosmetic painting uses its own RNG stream (SPD).

### 3.5 Metrics, persona bots and MAP-Elites

| Metric | Definition | Controls |
|---|---|---|
| Path length | Entrance→exit and entrance→centrepiece, in tiles and rooms; tortuosity | Length, pacing |
| Loopiness | Room graph μ = E − V + 1; tile holes split into pillar loops and circuits | Kiting, flanking, escape |
| Space-type profile | Share of a/b/c/d rooms (F4) | Dead ends, route choice |
| Dead-end cost | Σ over a-spaces of 2 × entry depth ÷ total path | Backtracking burden |
| Chokepoints | Brogue cut cells (≥4 tiles cut off), number of gate sites | Corridor fights, vault sites |
| Openness | Mean isovist (r = 7) or VGA visual integration | Ranged threat, stealth |
| Glass ratio | See-through share of blockers | "See but can't reach" |
| Defensibility | Share of tiles with ≤2 walkable neighbours | Getting surrounded |
| Intelligibility | corr(connectivity, integration) over rooms (F1) | Wayfinding difficulty |
| Exhibit density | Cases per floor tile; bays per gallery | Clutter, loot, labels |
| Vista | Centrepiece on an axis visible early; longest axial line | Signposting, sniping |
| Hamiltonicity | A cycle through all public rooms exists (backtracking search for n ≤ 20) | Completionist flow |

**Uses.**

1. **Programme envelopes.** Each programme declares target ranges, for example case labyrinth: glass ≥ 0.8, choke 0.15–0.4, loops ≥ 2. The validator rejects outliers, so programmes stay recognisable.
2. **Persona bots.** Run the `papers-levels.md` roster (Tourist, Vandal, Looter, Completist, Cautious) on many seeds per programme, then regress outcomes on the metrics. Hypotheses to test, none of them established:
   - loopiness raises Cautious survival;
   - glass ratio raises the value of ranged kits;
   - low intelligibility raises Tourist turns.

   Drop any metric that predicts nothing.
3. **MAP-Elites over programme knobs, not tile maps** (`papers-levels.md` F20).
   - **Behaviour characterisations:** openness × loopiness as the general pair, and glass ratio × chokepoint density as the museal pair.
   - **Feasibility:** passes validation on at least 95% of seeds.
   - **Fitness:** skill differentiation plus route divergence between personas.

   Run one archive per programme, plus a cross-programme map with the same axes to confirm the programmes occupy different regions. Merge any that overlap.
4. **Expressive-range plots** per programme go in CI (Smith & Whitehead 2010).

### 3.6 Smaller ideas

- **Ghost visitors.** Crowd AI on Bitgood's value-over-cost rule and Tzortzi's "walks toward the visible masterpiece". Neutral, museal, moving obstacles.
- **Closing time.** Lights go out and shutters drop in stages while guards sweep the integration core. It is the anti-stall and anti-pillar-dancing clock (D6).
- **Lighting per programme.** Top-lit galleries are bright; diorama halls are dark with lit windows; textile rooms are dim. Lighting radius is a cheap difficulty and challenge-type knob.
- **Seam rooms.** A stair hall or lift lobby between departments keeps the museum continuous despite the random order.

---

## 4. Pitfalls and risks

1. **Sameness.** White cubes and repeated vitrines disorient players (F18). Programmes must differ in metrics, not just in tiles, and every gallery needs a landmark.
2. **Long sightlines through glass.** These give ranged enemies whole-map threat. Cap their vision by lighting and alert state, and give the player cheap sight-breakers.
3. **Pillar dancing** in courts and colonnades (F11). Without a counter, loops become free heals.
4. **Furniture soft-locks.** A vitrine on a gate cell, or a crate wedged into a 1-wide aisle, can block progress. Re-validate after every dynamic change, and keep lock records for a diegetic rescue (F13).
5. **Chance-reliant builders.** SPD's source comments say its loop builder "is lazy … relying on chance". Bound the retries and keep certified fallbacks.
6. **Over-reading space syntax.** Choi's correlations average roughly 0.45–0.7 and describe aggregate visitor movement, not fun. Use these metrics for diversity, legibility and placement, never as the objective.
7. **Hamiltonian flow invites full clears.** That works against "fight, sneak or leave" (`roguelike-systems.md`). Lures and closing time keep the choice real.
8. **Spoiled set pieces.** A vault with a fixed fighting position becomes solved knowledge (F10).
9. **Readability of verticality** in top-down 16-bit art. Needs a parapet line and drop shadows, plus simple rules: a height bonus for ranged attacks and no melee across the balustrade.
10. **Solver creep.** Constraint solvers take seconds to minutes and prefer trivial solutions (F16). Keep them offline.

---

## 5. Decisions for the design discussion

These complement `papers-levels.md` D1–D3 and D9.

**D1. How many programmes at launch?**
- (a) 3–4
- (b) 6, plus the basement as a shared staff layer
- (c) all 12
- (d) one generic parameterised generator

*Lean (b):* enfilade, rotunda, grand hall with mezzanine, case labyrinth, storage stacks and sculpture court. Option (d) loses architectural identity.

**D2. How does a department's theme pick its programme?**
- (a) the spec names it
- (b) at random
- (c) a weighted draw from theme tags (e.g. "tides" favours spiral and court)

*Lean (c), with (a) allowed as a pin, plus a small chance of a random draw.* Calvino-style mismatches are sometimes the point.

**D3. One programme per department, or composites?**
- (a) single
- (b) a main programme plus one side wing plus the staff layer
- (c) 2–4 wings joined by a hub

*Lean (b).* Real museums are composites, and (c) costs too much in seams and validation for v1.

**D4. Deterministic or probabilistic visits?**
- (a) always networked
- (b) chosen per programme (spiral and temporary exhibition forced, each with a shortcut)
- (c) chosen by the player via tickets

*Lean (b).* Choi's two models supply the brief's varying "type of challenge".

**D5. Verticality.**
- (a) none
- (b) elevated tiles on one map
- (c) multi-floor departments

*Lean (b).* Most of the tactics for little of the cost.

**D6. The counter to pillar dancing.**
- (a) attacks of opportunity (DCSS 0.29)
- (b) a few fast or furniture-vaulting archetypes
- (c) a closing-time clock with escalating sweeps
- (d) accept it

*Lean (c) plus a little (b).* It fits the fiction; (a) adds rules friction.

**D7. Glass semantics.**
- (a) indestructible
- (b) breakable, with noise, shards and loot
- (c) breakable, with contents that animate

*Lean (b) everywhere, and (c) for dioramas and some vitrines.* Breaking glass is the museum's best risk/reward verb.

**D8. Embedding approach.**
- (a) SPD-style angle placement
- (b) graph-first coarse-grid embedding per programme (Unexplored)
- (c) Spelunky templates only
- (d) a per-run constraint solver

*Lean (b)*, with templates for bays and period rooms, and solvers offline to certify vault libraries.

**D9. Orientation plan (the diegetic map).**
- (a) none (automap only)
- (b) the full plan, shown at the Intro
- (c) a partial plan: main ring, section names and the centrepiece
- (d) plans as findable items

*Lean (c), plus (d) for staff plans.* Museal, legible, and it keeps exploration.

**D10. Level scale.**
- (a) SPD-small: 6–10 galleries, about 40×30 tiles
- (b) 10–16 galleries
- (c) sprawling

*Lean (a) or (b), by programme.* Dormans: "it is so much more interesting to generate small levels". SPD floors are small, and museum fatigue is real.
