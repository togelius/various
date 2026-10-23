# ACCESSION: decisions, round 1

*Julian's answers to the fourteen decisions in [`DESIGN.md`](DESIGN.md) (23 October 2026), what follows from them, the implementation alternatives Julian asked about, the playtesting plan, and Julian's answers to the follow-up questions. Where this file and `DESIGN.md` disagree, this file wins. The build contract that follows from it is [`BUILD.md`](BUILD.md).*

## The principle

Every design decision must keep its result understandable by, and explainable to, humans: the player reading the screen, Julian curating departments, and anyone reading the research.
- **For players:**
  - every rule fits in one sentence, and that sentence is somewhere on screen;
  - every event says what caused it;
  - the numbers that decide a fight are shown before the player commits;
  - nothing adapts in secret.
- **For the designer:** every generated or calibrated thing comes with a reason in words. A department ships with a short report card; a failed test names the rule it broke and links a replay that reproduces it.
- **For research:** results are plain statistics with intervals. A learned model that screens content must be inspectable, or only advisory.
- **For engineering:** the core is deterministic, so every bug, death and test failure can be replayed exactly, by anyone, in a browser.

## Decisions taken

- **D1.** A curated collection. Agreed.
- **D2.** The game's rules are fixed; the levels are not. Rule invention stays a research track, and invented rules appear only behind opt-in doors, so there is always a version of the game whose rules are fixed.
- **D3.** Instrumented. Agreed.
- **D4.** Tactics first. Agreed.
- **D5.** At most ten universal systems, each one legible. Proposal: nine (below).
- **D6.** Runs of about 30 minutes, with robust autosave. Proposal: six small departments (below).
- **D7.** Agreed.
- **D8.** Agreed, kept suggestive *and* weird. The game assumes nothing about where the player character is from, and the familiar can be the weirdest thing in the building.
- **D9.** No experience points, as long as power stays legible. Proposal: one visible number, the grade (below).
- **D10.** Explained in plain terms below, with a simpler recommendation.
- **D11.** Agreed, but simplified for v1 to three parts.
- **D12.** Phone first, and playable elsewhere, in particular on a Mac with a one-button mouse. Implementation alternatives were examined before deciding (below).
- **D13.** The slice first. Agreed.
- **D14.** Runtime generators plus offline quality-diversity over their parameters. Agreed.

## What follows from the decisions

### Nine universal systems (D5)

The cap is ten. The proposal uses nine, leaving one slot for something the slice proves necessary. Each system has one icon and one sentence; the sentence below is the one the player is taught.

1. **Moving and fighting.** Tap to move; bump into something to attack it. Ordinary blows roll dice, and the odds are shown before you commit. Dangerous moves are marked on the floor with their exact damage, and never miss. Your health recovers slowly.
2. **Waking.** Every exhibit is asleep, stirring or awake. Being close or making noise fills its three pips; the ring around you shows what counts as close. A species may have one extra trigger, shown as one icon.
3. **Cases.** You can see through glass but not walk through it. Open a case if your grade allows, or break it, loudly.
4. **The clock.** At the bell your recovery slows; later the night watch begins its rounds, waking whatever is nearest to you.
5. **Your kit.** A weapon, a garment, two curios and an instrument. Restoration kits improve them.
6. **Consumables.** A handful of kinds, unlabelled until you have used one or read about it.
7. **Grade.** Each department's Certificate, earned by defeating or viewing its Centrepiece, raises your grade by one: more health, a perk chosen from three, heavier objects, higher-grade cases.
8. **Labels.** Every exhibit and object has one: a plain Behaviour line that states exactly what it does, and a paragraph that is only for reading.
9. **Doors.** Each department ends in doors whose placards say what kind of trouble lies behind each.

**What changed to get under the cap:**
- **Health** is folded into fighting.
- **Handling Clearance** is folded into the grade (D9).
- **Light leaves the universal list.** In most departments the lights are on. Darkness, lanterns and light-sensitive exhibits become a system that Light and Darkness departments own.

Everything else is owned by departments: guards and alarms, fine-grained hearing, tides, demonstrations on the hour, copies and forgeries, class-wide waking, moving when unobserved. A department owns at most two such systems, and in early runs brings at most one the player has not met.

**How each stays legible:**
- **No hidden meters.** Pips over exhibits, the clock dial, your grade, your health and the odds of every attack are always on screen.
- **Every event names its cause** in one plain sentence: "The doorstep woke: you came within two tiles."
- **Every death gets a recap:** what killed you, why it was awake, and when it woke.
- **One tap opens "How the museum works":** the nine sentences with their icons.
- **The cap is enforced in code.** The grammar registry counts universal systems and first-run icons, and an eleventh fails the build.
- **The slice gate tests it.** After one run, players explain each of the nine in their own words. A system most players cannot explain is redesigned or cut.

### A 30-minute run (D6)

**Six small departments on three floors of two**, with a short Stair Hall after each of the first two floors (one screen: rest, a free upgrade, or the kiosk) and a short Exit.

| Part | Minutes |
|---|---|
| Entrance Hall: one tap to start, plus the Loan | about 0.5 |
| Six departments of the smallest size (5–7 rooms) | 18–27 |
| Six door choices | about 1.5 |
| Two Stair Halls | about 2 |
| The Exit | about 2 |
| **Total** | **about 24–33** |

The department row uses the layout prototype's estimate of 190–240 turns for a median visit to a small department, at 50–60 turns per minute. The slice measures the real turn rate. If departments run long, they shrink before the count drops.

**The door sequencer, rerun for six-department runs** (200 simulated runs per pool size; [`prototypes/difficulty/seq6.py`](prototypes/difficulty/seq6.py)):
- **Pool sizes.** With three floors of two, every run built with two-door offers from a pool of 14, and with three-door offers from 24.
- **Variety.** Every run met at least five different challenge types once the pool reached 20, and about a third met six.
- **The guarantee is five types, not six.** Six different types in every run could almost never be built alongside the rule that doors from one room show different types.
- **Two floors of three** also builds, but rarely reached six types: in at most 6% of runs with two-door offers from a pool of 14 (none at 24), and in about a fifth to a quarter with three.

**What else changes:**
- **v1's pool can be smaller.** 24 departments already support three-door offers.
- **The target death curve is refitted** for six departments and the Exit. It keeps its shape (a rise on each floor, relief at the Stair Hall) and about the same overall clear rate.
- **Content is used up faster.** A player meets about 12 departments an hour rather than about 8, so the curated pool is seen sooner, and D1's roadmap (Temporary Exhibitions) matters earlier.
- **A run fits one commute,** and autosave lets it span two.

### Autosave (D6)

- **Saved after every action.** The game state is a snapshot written after each turn, so a killed tab or browser loses at most the action in progress.
- **IndexedDB first, localStorage as a mirror.** A kill test here found that Chromium holds localStorage writes in memory for several seconds. When the whole browser was killed 0–4 seconds after a save, localStorage had lost it in 18 of 18 trials; IndexedDB had kept it in 18 of 18, even when killed immediately after the write ([`prototypes/save-kill/`](prototypes/save-kill/)). So each snapshot goes to IndexedDB in one transaction, into two alternating slots with checksums, and is mirrored to localStorage.
- **Saved again when the page is hidden.** A phone may then kill the tab without warning, and mobile browsers often never fire the unload events. Chrome calls the hidden state "the last reliable time to save".
- **On load, the newest valid slot wins.** If it is damaged, the older one is used and the game says so in a sentence.
- **Resuming is exact.** The core is deterministic and the snapshot includes the random streams, so play continues exactly as it would have.
- **No save-scumming.** There is one current state and no manual load; death is final.
- **Losing storage.** Safari may delete a site's storage after seven days without a visit. Installing the game to the Home Screen avoids that. The visitor's card and a full archive download restore progress, and the game asks the browser to keep its storage.
- **Tested on every build** by killing the page at random moments in Chromium and WebKit (see playtesting below). There is also one check per release on a real iPhone, because WebKit's behaviour could not be tested here.

### The visitor comes from nowhere in particular (D8)

- **The game assumes nothing about the player character:** no home country, culture, age or gender. The visitor is simply a visitor.
- **No department is "foreign" and none is "ours".** The text never calls anything *exotic*, *foreign* or *native*, and never speaks of "our" culture. The only fixed point is the museum's own institutional culture, which is as strange as anything in it.
- **The familiar, catalogued.** *The everyday* joins the subjects (kitchens, commuting, offices, school, shopping, keys, receipts), treated with the same deadpan seriousness as a lost civilisation. Precedents:
  - Perec put the method in one line: "Not the exotic anymore, but the endotic" ("Approaches to What?", 1973).
  - Horace Miner's "Body Ritual among the Nacirema" (1956) is the classic demonstration that the familiar, described from outside, becomes strange.
  - The Museum of Everyday Life in Glover, Vermont, has run whole exhibitions on the match, the safety pin and the toothbrush.

  Some pitches:
  - *Umbrellas Left on the Last Bus, Sorted by the Weather They Were Expecting.*
  - *Keys to Doors That Have Since Been Replaced.*
  - *Waiting-Room Chairs, Still Waiting.*
  - *The Contents of One Kitchen Drawer, Expanded to Fill a Wing.*
- **Suggestive and weird.** The labels hint and never explain, the museum never explains itself, and a department may leave its central question open.

### The grade: legible power without experience points (D9)

Experience points are legible because they are one number that goes up. The grade keeps that and drops the killing:
- **Your grade** is printed on your visitor's badge ("Handling Clearance, Grade IV"). It rises by one with each department's Certificate, earned by defeating or viewing its Centrepiece.
- **Each grade** gives more health, a perk chosen from three, and the right to handle heavier objects and open higher-grade cases.
- **Restoration kits,** two per department and listed on its Highlights card, improve your equipment.

That leaves two things to track, the grade and the kits; SPD has four (experience, strength, upgrades, talents). Walking past a Centrepiece is a plain trade-off: you leave sooner and do not go up a grade. The grade rises at most six times in a run, which keeps difficulty calibration simple.

### Labels, plainly (D10)

D10 bundled three things; only the first matters much.
1. **The Behaviour line: keep.** Each label carries one plain sentence of rules ("Moves only on every second turn. Follows anything that ticks."). It is generated from the game's own data and checked against it, so it cannot lie, and the literary paragraph never has to carry rules. This is the main tool for keeping the game explainable.
2. **Unknown consumables: keep, gently.** In the roguelike tradition, each kind looks different every run, and you learn what it does by using it or reading a department's labels. "Gently" means a first, unidentified use can never kill you, and what you learn is recorded at once.
3. **Attribution of equipment: cut from v1.** Museum-style hidden quality grades ("Workshop of", "Follower of") discovered by cataloguing. Charming, but a hidden layer, and the visible grade already does the job.

### Between runs, in three parts (D11)

v1 keeps only:
1. **Your Collection.** One object accessioned from each department whose Certificate you earn; its kind joins future runs.
2. **The Loan.** Borrow one Collection object into each run.
3. **The record.** The Catalogue of everything seen, and the figure left behind by each death.

Patron membership, the opt-in assist, is a setting, not a system. Stamps, the Gift Shop, the Directives, the Atlas, Lost Property, the daily and Commissions wait. Each comes back only if playtests show runs need more pull, and only if it can be explained in one sentence on the Entrance Hall screen.

### Platforms and input (D12)

- **One input model everywhere.** Tap or click a tile to walk there; tap an exhibit to examine it. The action it allows appears as a button ("Attack: 75%, 3–5 damage").
- **Everything works with one button:** no right-click, no long-press, no hover-only information, no scroll wheel. Zoom has buttons.
- **Keyboard shortcuts are an extra** on a Mac, never required.
- **Phone portrait first;** on a laptop the label panel sits beside the map.
- **Tested** with Playwright in WebKit (Safari's engine) and Chromium, at phone and laptop sizes, by a script that uses left clicks only.

## Implementation: what was compared (D12)

Node is not the game engine in the current plan. The game runs in the browser, and Node runs the same rules core headless, for tests and bots. So the question is the web stack against an engine such as Unity or Godot. Five research notes and four probes back what follows:
- [`research/unity.md`](research/unity.md)
- [`research/engines.md`](research/engines.md)
- [`research/isometric.md`](research/isometric.md)
- [`research/art-sources.md`](research/art-sources.md)
- [`research/playtesting.md`](research/playtesting.md)

### Unity

- **The rules core would test just as well in C#.** A toy core (seeded random numbers, sleeping monsters, bump combat, `step(state, action)`) was written as a plain .NET library of the kind Unity uses, alongside a line-for-line JavaScript port ([`prototypes/csharp-spike/`](prototypes/csharp-spike/)). Both gave identical state hashes over 10,000 runs. The C# version was somewhat faster: 5–7 million steps a second, against Node's 3.5–4. .NET installed here in 18 seconds, with no account.
- **Everything above the core needs the Unity Editor and Julian's sign-in.** That means rendering, input, saves, screenshots and whole-game bots.
  - Since 1 September 2026, Unity's Personal seats "require online sign-in", and service accounts cannot activate licences, so an agent in a fresh cloud container cannot start the Editor alone.
  - Each container would also download about 6 GB, and the Editor officially wants a desktop with a GPU.
- **"Unity CLI or MCP" therefore means working on Julian's Mac.** Unity's official MCP route is now the free `unity` command-line tool's `unity mcp` mode, still in beta. Like the community MCP servers, it drives a *running* Editor.
- **Look: a higher ceiling.** 2D lights and shadows, particles, isometric tile maps and 3D are built in. The planned look (small palette sprites, spotlight pools, labels as HTML) needs little of it.
- **Feel on phones: worse in two ways.**
  - An empty Unity web build is 2–8 MB compressed, downloaded again after every tab kill; all of `vanguard-zero` is 58 KB.
  - Unity's web audio is basic, so the repo's synthesiser and its echo would need JavaScript glue or pre-rendered clips.
- **Timing.** Unity 7, on a new .NET runtime, is announced for early 2027: a major upgrade in the middle of the project.

### Godot and the JavaScript libraries

- **Godot 4.7** runs fully headless in a container, and its project files are text. But:
  - the rules would run 11–14 times slower in GDScript than in Node ([`prototypes/bench/godot/`](prototypes/bench/godot/));
  - C# cannot be exported to the web;
  - a phone would download 7–10 MB of engine.

  That means either a slow simulation gate or a second copy of the rules, in JavaScript, that could drift from the first.
- **JavaScript libraries can sit on top of the same core and change only the drawing.** Compressed, PixiJS 8 adds 126 KB, three.js 110 KB and Phaser 4 about 300 KB.

### Isometric 3D

A probe drew two generated departments both ways, at phone and laptop sizes, with the same player, exhibits, telegraphed attack and line of sight, and measured the renders ([`prototypes/iso-probe/`](prototypes/iso-probe/); start with `shots/sheet_sc_phone.png`).
- **At the classic isometric angle the camera hides 27–47% of the tiles the player can see in the game,** and about half the places an exhibit can stand. The rule "it woke because it saw you" then becomes hard to read off the screen.
- **Every fix changes what walls mean:**
  - **Cutting walls away near the player** makes a cut wall look like a low wall that still blocks sight.
  - **See-through walls** show figures but not floor.
  - **Lowering every wall** turns the view into top-down with extruded furniture.
- **Tapping is unreliable.** Isometric tiles at a readable scale are 45×26-pixel diamonds, over half their centres are covered by a wall, column or figure, and a 44-pixel target needs a zoom showing about four tiles across.
- **What 3D does better is glass.** A translucent box reads at once as "solid but see-through", and the scene looks like a museum.
- **A steeper camera nearly solves occlusion.** At 60° with half-height walls, almost nothing is hidden, but it still needs three.js, lighting that does not fight line of sight, and bigger tiles for tapping.

### Bigger sprites, generated or downloaded

- **Bigger art does not show more of the museum.** How much fits on screen depends on the tile's size on screen, not on the art's. Art of 16, 32 and 48 pixels all fill a 32-pixel tile, 12 across a phone, and at that size most of 48-pixel art's extra detail is too small to see. Bigger art does cost 4 to 9 times as much drawing, checking and animating. Comfortable tapping comes from a zoom setting, not bigger art.
- **Open image models draw plausible objects, often not the one asked for.** On this machine's CPU (SDXL with a pixel-art add-on, about 95 seconds an image), six museum prompts gave:
  - two usable sprites (a moth, a model crane);
  - two wrong readings (a post for a bollard, a dog in a saddle for a clockwork hound);
  - two failures (a doorway for a doorstep, a sprite sheet for a bell).

  The usable ones read well at 32 pixels after reduction to a fixed palette, but each needs perhaps 10–30 minutes of cleanup. See [`prototypes/art-probe/diffusion/contact_sheet.png`](prototypes/art-probe/diffusion/contact_sheet.png).
- **Licences.** The openly licensed models that would do better (FLUX.2 klein 4B and Z-Image-Turbo, both Apache-2.0) need a GPU with about 13–16 GB, or a hosted service at under a cent an image.
- **Provenance.** Most models do not disclose their training data. The usual pixel-art add-on was trained on 23 images whose source is stated nowhere: awkward in a game about provenance.
- **Downloads.** CC0 packs (Kenney, the Dungeon Crawl tiles, 0x72) are safe in a public MIT repository but are generic fantasy: wizards, ghosts, potions. The museum packs are paid and forbid redistribution, which a public repository is, and one forbids use "alongside 'AI' generated imagery".

### Recommendation

1. **Stay with the web stack.** Plain JavaScript (types checked through comments, with no build step), Canvas 2D, and the rules as a pure core shared by the game, the Node bots and the tests, built into one HTML file. Why:
   - a phone loads it, and reloads it after a tab kill, in a fraction of a second;
   - every test, bot and screenshot runs in a cloud container with no account;
   - any replay link reruns in any browser, which is what "explainable" needs;
   - it is the repo's convention.

   If Unity is wanted later, the core ports to C# mechanically (the spike shows identical hashes), and the presentation work happens on the Mac.
2. **Play top-down.** 16×16 art in 32-pixel tiles (12 across a phone), with a 48-pixel zoom step (3×) for comfortable tapping.
3. **Use bigger art where the screen has room for it,** not on the board:
   - **A 64×64 close-up of each exhibit in its label,** like a catalogue photograph.
   - **Centrepieces** two tiles by two.
   - **3D only where nobody has to read the board:** a department's opening view, viewing a Centrepiece at the lectern, the Stair Hall and Your Collection, with three.js loaded only for those screens.

   A steep 60° board view can be tried as a short experiment after the look-and-read milestone (M2), if wanted.
4. **Image models only offline, as reference,** cleaned up and approved by a person. CC0 packs only as placeholders.
5. **An asset ledger from the first commit.** Every image's source, licence, author or prompt, and changes, with the credits generated from it. A museum about provenance should know where its own pictures came from.

## Automatic playtesting

No single kind of bot answers every question, so testing comes in layers. Each layer answers one question and reports in words, with a replay. Exact checks run on every commit and playing bots nightly; people decide what bots cannot. Detail and sources: [`research/playtesting.md`](research/playtesting.md).

| Layer | From | Question it answers | What a person sees |
|---|---|---|---|
| 1. Rule tests and golden scenarios | M0 | Does each rule do exactly what its label says, identically in every browser? Did a change alter anything else? | A sentence per failure; the smallest failing room as text, with a replay; a diff of what 25 fixed seeds generate |
| 2. Monkeys, soak and save fuzzing | M0 | Can anything crash, hang, soft-lock or lose a save? | A crash card: seed, shortest action list, first bad turn, replay |
| 3. Layout validators and the worst-case runner | M1 | Is every floor plan legal, and survivable with the worst luck? | Failing plans as text maps, the offending tiles marked |
| 4. Screens and accessibility | M2 | Does every screen fit a phone, with big enough targets, readable when colour-blind, using one mouse button? | Before/after images; a list of small targets |
| 5. Paired scripted bots | M3 | Does each exhibit have counterplay? Does each department rule fire, and does it matter? | "With the rule, 31% of visits end in death; with it switched off on the same seeds, 9%", with replays of the biggest differences |
| 6. An expert search bot | M4 | What could a tireless player do that we would not want? | Annotated exploit replays |
| 7. A language-model reader | M4 | Do the labels' words alone carry the rules? | A question-by-question table, model against people; stored transcripts |
| 8. People, at the slice gate | M7 | Do strangers understand why things woke, read labels, and finish in time? | A page per player; a replay per death |
| 9. Simulated personas | After the gate | Is each department as hard as intended, and for whom? | A short report card per department (below) |
| 10. Human replays and a readable surrogate model | v1 | Do the bots still agree with people? Which features drive difficulty? | Agreement scores; the model's terms in words |

**The rules that keep the results explainable:**
- **Every damage and wake event records its cause:** who, which move, which trigger, which department rule. Deaths are explained from this record, not by inference.
- **"Does this matter?" is answered by rerunning the same seeds with the thing switched off.** That needs random streams keyed per actor as well as per purpose, so that removing one exhibit does not reshuffle the rest. This is added to the determinism contract.
- **Every number carries its sample size, interval and seeds,** and every claim links to a replay of the exact build that produced it. Old builds stay hosted, so old replays keep working.
- **Representative replays are chosen by rule:** the commonest death, the median visit, the fastest exit, the strangest outlier.
- **Persona definitions are printed as their weights** ("Looter: +1 per case opened, −5 for dying"). Any learned model that pre-screens content is a regression or a shallow tree, and only advises.
- **Reports are filled in from numbers by templates.** A language model never writes a number in a report.
- **Language-model players test comprehension, not difficulty.** They are still weak at long roguelike games and their answers vary between runs, so transcripts are stored, each question is asked five times, and no commit is ever gated on a model.

**A department report card, as it would read** (illustrative numbers):

> *S.9, Animals Not Yet Seen by the Day Staff,* depth 2, 200 seeds. The median simulated visitor died in 6% of visits (target 5%; 95% interval 3–10%). Most deaths (11 of 17) came from a Long-Necked Grazer reaching the visitor from a dark bay, where it could move unobserved. The rule matters: on the same seeds with it switched off, deaths fell to 2%. The Sneak did best and the Vandal worst, which fits the Guarded placard. The Pacifist got out alive in 93% of visits. A typical visit took 240 turns, about four and a half minutes at the turn rate measured at the gate. Replays: commonest death, median visit, fastest exit, strangest outlier.

**Autosave is tested four ways:**
1. **Round trip.** Saving then loading gives an identical state, and play continues identically from both.
2. **Kills.** The page is killed at random moments, mid-write included, in Chromium and WebKit, while a storage shim fails, truncates or corrupts writes in turn. After every kill the game resumes from the last committed state, or says in a plain sentence why it fell back one.
3. **Hidden pages.** The save made when the page is hidden is tested on its own.
4. **Versions and export.** Old saves load, or retire with an explanation; the visitor's card round-trips.

**Run length is checked automatically.** At the slice gate a three-term time model is fitted to the human sessions: minutes = turns ÷ turns per minute + labels opened × seconds per label + fixed hall time. Bots then report their turns and label opens every night, and the build warns when the predicted median run leaves 30 ± 5 minutes.

## Answered, 23 October 2026

1. **Stack:** the web stack.
2. **View:** try the 3D board view, built so that reverting to top-down is easy. The board is drawn by one of two interchangeable renderers over the same view model. Top-down stays the reference that every test runs against, and one setting switches between them. Removing the 3D view means deleting one renderer file, its vendor folder and a short list of named lines, and a test keeps that list from growing (`BUILD.md` §6.3).
3. **Art:** 16-pixel sprites on the board with 64-pixel close-ups in the labels; image-model output only as offline reference, recorded in the asset ledger.
4. **Run shape:** six departments on three floors of two.
5. **Simplifications:** all four accepted. The grade replaces Clearance and experience points; light belongs to Light and Darkness departments; equipment attribution is cut from v1; consumables are identified gently.

The build contract is [`BUILD.md`](BUILD.md).
