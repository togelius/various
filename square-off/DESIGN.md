# SQUARE OFF — Design Document

*A single-player real-time strategy game set in Washington Square Park, NYC.*
Tagline: **"Five minutes, five dollars, the whole park."**

This is the build spec. Every number in it is a starting value. All tunables live in `js/data/*.js`, so the headless sim can rebalance them without touching code.

---

## 0. Judging the three proposals

Scores run from 1 to 10.

| Proposal | Access. | Depth | Fun | Park fidelity | Implementable | Total |
|---|---|---|---|---|---|---|
| **A "accessible"** | 9 | 6 | 8 | 8 | 7 | 38 |
| **B "depth"** | 5 | 9 | 7 | 8 | 5 | 34 |
| **C "fun"** | 7 | 8 | 9 | 9 | 5 | 38 |

**Ideas taken from each proposal**

- **A (accessible).**
  - One currency.
  - Shape-coded counter triangle.
  - Tap-a-place-to-go.
  - Landmarks that defend themselves with free regulars.
  - Mission 1 cannot be lost and starts within one second.
  - Telegraphed events.
  - Canopy fade for readability.
  - Strict cut order.
  - "Chill it down?" offer instead of silent rubber-banding.
- **B (depth).**
  - The day clock as phases that re-value the map. In Night the Arch lights up and is worth double.
  - Setups flip to whoever captures the landmark, so building is a stake.
  - Readable AI barks that announce the AI's intent.
  - The three-layer AI.
  - Lanchester-style retreat logic.
  - Hysteresis for the AI.
  - Headless balance sims.
  - The "Weak to:" line.
  - The Empire State Building framed through the Arch as the signature shot.
- **C (fun).**
  - The real-place-first identity.
  - The Crew Call meter that charges from holding landmarks and sending enemies home.
  - The comic "left the park" defeat.
  - The Park Report end screen.
  - Lamps as a vision network at night, kept as flavor.
  - Squirrels you tap to shoo.
  - The dosa cart buff.
  - The Park House "only bathroom" joke.
  - Concrete GEO-derived coordinates for the chess tables and the NW grove.

**Backbone of the synthesis.**
- The economy, phases and stakes come from **C**, tightened with **B**'s phases and Setup-flipping.
- The interaction model and onboarding come from **A**.
- Cut:
  - per-unit active abilities (too much touch micro);
  - heroes;
  - tech tiers and doctrines;
  - Skaters (kept as a post-launch fifth faction);
  - three-or-more-way free-for-all outside the finale.

---

## 1. Pillars

1. **The place is the star.** The game uses the real OSM footprints and heights, 417 real trees, 399 benches, 147 lamps, the Arch, the fountain and the fenced dog runs. A New Yorker should be able to recognize their own bench.
2. **Two verbs to play, ten to master.** Select a group, then tap a place. Depth comes from four sources:
   - the counter triangle;
   - which landmarks you hold (income, perks, phases);
   - building on fixed pads;
   - timing your one Crew Call around park events.
3. **Nobody gets hurt.** Units have *Composure* instead of HP. At zero a unit is **Over It**: it shrugs, shows a bubble ("I'm going to Think Coffee") and walks to the nearest gate.
4. **One more match.** Matches last 5–9 minutes and end with a Park Report of comic stats. There is also a Daily Park seed.

Tone: affectionate, grounded comedy. There are no real named individuals; "the Piano Guy" and "the Pigeon Lady" are archetypes. There is no violence, no mocking of homelessness, and no drug jokes.

---

## 2. Factions (4 playable)

The player controls **one faction per match** against 1–3 AI factions.

### 2.1 Shared combat model

Every unit has these stats:
- Composure (HP)
- Sway (damage per second)
- Range (m)
- Speed (m/s)
- Cost (Clout)
- Pop
- **Class**

The class is shown as a white shape with a faction-colored rim, floating above each unit and on every card.

- **CROWD ●** (circle): cheap pairs, melee.
- **TALKER ▲** (triangle): ranged persuaders.
- **HEAVY ■** (square): big presences with splash damage.

**Counter cycle: ● beats ▲, ▲ beats ■, ■ beats ●.** You can't monologue at a mob, you can argue a big guy down from range, and splash damage scatters crowds.
- The winning matchup deals **×1.5** Sway.
- The losing matchup deals **×0.7**.
- Same class: ×1.0.
- Neutrals take ×1.0 from everything.

**Base class template.** Each faction's units deviate by at most ±20% from these values.

| Class | Cost | Pop | Composure | Sway/s | Range | Speed | Splash | Capture weight |
|---|---|---|---|---|---|---|---|---|
| ● Crowd (recruited as a pair) | 40 for 2 | 1 each | 45 | 6 | 1.5 | 5.0 | – | 1 |
| ▲ Talker | 55 | 1 | 55 | 9 | 11 | 4.2 | – | 1 |
| ■ Heavy | 95 | 2 | 220 | 9 | 2.5 | 3.4 | 3 m | 2 |

**Combat rules**
- Combat is automatic: a unit engages any enemy within range + 4 m.
- Target priority:
  1. the class this unit counters;
  2. the lowest Composure;
  3. sticky for 2 s.
- Talkers hold at 80% of their range and back off 3 m when an enemy ● closes to within 4 m.
- Regen: 2 Composure/s after 5 s out of combat.
- Terrain speed: ×0.85 on lawn, ×1.0 on paths and plazas. Fences and buildings block movement. The fountain basin is wadeable at ×0.6.
- Over It: the unit becomes untargetable, walks to the nearest gate at 1.3× speed and fades at the street.
- Grudge: the owner gets 25% of the unit's cost back.
- Recruit time: ● pair 6 s, ▲ 7 s, ■ 11 s. The queue holds 5 per spawn point.
- Pop cap: 20 + 2 per landmark held + Bench Clusters. Hard maximum 50.

### 2.2 The four crews

**THE HUSTLE** (chess hustlers and old heads). Color: slate blue `#3D7BE0`. Home flavor: the Chess Plaza.
- **Passive "Side Bets":** +5 Clout every time an enemy goes Over It within 20 m of a Hustle unit.
- **● Kibitzers:** 40 per pair; Composure 45; Sway 5; Speed 5.0.
  - *Unsolicited Advice:* each Kibitzer adjacent to an enemy (within 2 m) gives that enemy −10% Sway. Stacks to −30%.
- **▲ Speed Hustler:** 55; Composure 55; Sway 10; Range 12; Speed 4.2.
  - *Hit the Clock:* its first hit on a new target slows that target 30% for 2 s.
- **■ Old Head with lawn chair:** 95; Composure 240; Sway 8; splash 3 m; Speed 3.2.
  - *Seen It All:* immune to slows and knockback.
  - Bark: "Back in '79 this was all hustlers."
- **CREW CALL "TOURNAMENT"** (tap a target):
  - Every enemy within 14 m sits down at a board for **5 s**. Frozen enemies can't move or attack, but can still be hit.
  - Effect: a giant chess clock slams down with a ding.

**THE NOISE** (buskers). Color: orange `#FF8A1F`.
- **Passive "Pass the Hat":** +0.3 Clout/s for each Noise unit standing inside one of your landmark rings. Capped at +3/s.
- **● Tambourine Kids:** 40 per pair; Composure 42; Sway 6; Speed 5.4.
  - Allies within 6 m get +10% speed.
- **▲ Sax Player:** 60; Composure 50; Sway 8, splashing 2.5 m at the target; Range 11; Speed 4.2.
- **■ Bucket Drummer:** 95; Composure 220; Sway 10; splash 4 m; Speed 3.4.
  - Each hit has a 10% chance to *flinch* the target, interrupting it for 0.5 s.
- **CREW CALL "DRUM CIRCLE"** (tap a target):
  - A 16 m circle lasts 12 s.
  - Your units inside heal 6/s.
  - Enemies inside take 5/s and move at ×0.7.
  - Effect: drummers fade in around the ring.

**THE VIOLETS** (NYU students). Color: violet `#9B5CFF`.
- **Passive "Group Project":** +25% capture speed, but all units have −10% Composure.
- **● Freshmen:** **32** per pair; Composure 38; Sway 5; Speed 5.4.
- **▲ Debate Team:** 55; Composure 50; Sway 9; Range **14** (the longest); Speed 4.2.
  - *Well, Actually:* +40% Sway against other ▲.
- **■ Club Rugby:** 90; Composure 210; Sway 10; splash 3 m; Speed 3.6.
  - *Scrum:* its first contact after moving at least 6 m knocks enemies back 3 m. Automatic, 12 s cooldown.
- **CREW CALL "GROUP CHAT"** (tap a held landmark):
  - 6 Freshmen appear there instantly and ignore the pop cap.
  - Effect: phones light up and the Freshmen stream out of the crowd.

**THE PACK** (dog people). Color: brick red `#E0453A`.
- **Passive "Off Leash":** no lawn penalty. Every Pack unit is Animal-tagged and scares off pigeons and squirrels.
- **● Small-Dog Walkers:** 40 per pair; Composure 40; Sway 7; Speed **6.4**, the fastest in the game.
- **▲ Ball-Launcher Dad:** 60; Composure 55; Sway 9; Range 12; Speed 4.2.
  - *Fetch!:* every third hit pulls the target 3 m toward the Dad.
- **■ Pro Dog Walker (8 leashes):** 100; Composure 240; Sway 9; splash 4 m; Speed 3.4.
  - Enemies it hits are slowed 25% for 2 s.
- **CREW CALL "ZOOMIES"** (swipe or drag a line up to 40 m):
  - 8 dogs sprint along the line.
  - Each enemy they touch takes 30 Sway and is knocked back 4 m.
  - Your units within 15 m of the line get +60% speed for 6 s.
  - Effect: dust trails, with a 2-frame hit-stop on impact.

**Crew Call meter** (0–100):
- +0.4/s base.
- +0.15/s per landmark held.
- +5 per enemy that goes Over It.
- That works out to roughly one Crew Call every 90–120 s. The meter starts at 30.

### 2.3 Neutrals

- **Pigeons:**
  - Ambient flocks of about 30 instanced birds per flock.
  - Flocks scatter from units.
  - During events they slow units in a zone.
- **Squirrels:**
  - They raid Food Carts that have no friendly unit within 8 m, taking −20 Clout per heist.
  - Tapping or clicking a squirrel shoos it and pays +5.
- **PEP officers (Parks Enforcement):**
  - Event NPCs.
  - Units within 8 m of an officer cannot attack.
- **Tourists and graduates:** neutral crowds that slow pathing.
- **NY Dosas cart** at (-100,57), real GEO:
  - Pay 50 Clout there (tap the cart while your units are within 20 m).
  - Your units within 20 m get +20% Sway for 20 s.
- **Park House "The Only Bathroom"**, building at x -71..-43, z 41..52:
  - Neutral and not capturable.
  - Any unit within 10 m of its north door at (-57,38) heals 4/s.
  - The AI over-values it as a running joke, and its barks mention it.

---

## 3. Economy, territory and victory

### 3.1 Resources

- **Clout:** the only currency.
  - Start: 150.
  - Your Home Spot gives +1.5/s.
  - Each held landmark gives the rate in the table below.
  - Target income: early game 3–5/s, a strong mid-game 9–13/s.
- **Pop:** see §2.1.
- **Crew Call meter:** see §2.2.

### 3.2 Capture

- Every landmark has a ring and a capture meter that runs 0–100.
- Capture rate is `12.5 × min(4, Σweight)^0.6` per second. Only uncontested units count.
  - 1 Crowd unit takes 8 s.
  - 3 units take about 4.3 s.
  - The cap is reached at a weight of 4, about 3.5 s.
- An enemy landmark must first be drained to 0, which is neutral, and then filled.
- If units of two factions are inside, the meter freezes and the ring flashes **CONTESTED**.
- An owned landmark's meter regenerates at 5/s.
- **Regulars:** every owned landmark spawns 1 free ● of the owner's faction every 40 s, up to a maximum of 2 per landmark. Regulars stay and guard within the ring, and they do count against pop.
- On a flip:
  - a chalk tag in the faction color stamps onto the paving;
  - the landmark's Setups switch to the capturer (see §3.4);
  - the capturer gets a +25 Clout "flip bonus".

### 3.3 Victory and the day clock

- **Turf:** each held landmark adds Turf per second to its owner (see the table). The Fountain adds 2/s.
- **First faction to 1500 Turf wins.**
- **Park closes at 10:00 of match time (1 AM in game).** If no one has reached 1500, the highest Turf wins. A tie goes to a 60 s sudden death at the Fountain.
- **Elimination:** a faction with no units, no landmarks and less than 40 Clout is out.

**Phases.** The lighting is the timer, and each phase re-values the map.

| Phase | Clock (game time) | Match time | Effects |
|---|---|---|---|
| Afternoon | 4 PM–7 PM | 0:00–3:20 | Dog runs Clout ×1.5 (after-work dog rush) |
| Golden Hour | 7 PM–10 PM | 3:20–6:40 | Fountain Clout ×1.5; Main Playground Clout ×0.5 (kids go home) |
| Night | 10 PM–1 AM | 6:40–10:00 | **Arch Turf 2/s** (floodlit); Hangman's Grove aura on; lamps on |

- A HUD warning and an announcer line fire 20 s before each phase change.
- The AI anticipates phase changes 25 s ahead.

**Comeback: "Word of Mouth."** A faction that is 250 or more Turf behind the leader gets two things: recruit costs −20% and capture speed +25%. The leader is also the preferred PEP target (§6).

**Pacing check.** In 1v1, a 7-vs-5 points-per-second split from minute 2 reaches 1500 at about 5:30. A dominant 10 points per second finishes at about 3:30. A stalemate goes to the clock.

### 3.4 Light building ("Setups")

- Every landmark has 2 fixed **build pads**. The Chess Plaza has 4. Each Home Spot has 3.
- Pads are glowing paver squares placed next to real GEO benches.
- Building takes 6 s.
- Setups have no HP and can't be attacked. **They flip with the landmark**, so a well-built landmark is a jackpot target.

| Setup | Cost | Effect |
|---|---|---|
| Food Cart (halal / ice cream) | 90 | +1.0 Clout/s; allies within 8 m heal 2/s; squirrel bait |
| Boombox | 80 | Allies within 14 m: +15% Sway |
| Bench Cluster | 60 | +4 pop cap; your ■ within 10 m get +20% Composure |
| Faction special (one per landmark) | 110 | see below |

**Faction specials**
- **Chess Table (Hustle):** +1.2 Clout/s. Enemies capture this landmark at ×0.6 speed.
- **Tip Jar (Noise):** +0.15 Clout/s for every unit of *any* faction within 15 m. Capped at 3/s.
- **Club Fair Table (Violets):** this landmark becomes a recruit point, and ● cost −25% here.
- **Water Bowl (Pack):** units within 10 m heal 5/s and get +10% Sway.

There is no tech tree.

### 3.5 Spawn points

- Units appear at your **Rally point**. This is your Home Spot by default.
- You can set any landmark you hold (with a Club Fair Table, for the Violets: any) as the Rally point. Long-press it and pick "Rally here", or press R on the hovered landmark.
- Non-Violet factions may rally only at the Home Spot or at a held landmark **within 90 m of the Home Spot**, so that forward spawning stays a decision.

---

## 4. The map: "The Whole Square"

Coordinates are in GEO meters: +x east toward University Pl, +z south toward W 4th, origin at the fountain center.

### 4.1 Home Spots

Home Spots sit at the park's corner entrances. They can't be captured and each has 3 build pads.

| Spot | Position | Notes |
|---|---|---|
| NW, MacDougal & Waverly | (-150, -66) | |
| SE, LaGuardia & W 4th (Bobst) | (126, 66) | |
| SW, MacDougal & W 4th | (-152, 66) | |
| NE, University Pl & Washington Sq N | (126, -64) | Near the NYU Trolley Stop (144,-59) |

- **1v1 uses NW vs SE.** Each side has two nearby landmarks; the mirror pairs are Grove↔Bobst Gate and Holley↔Small Run.
- 3- and 4-player games add SW, then NE.

### 4.2 The 11 landmarks

| # | Landmark | Ring center | Radius | Clout/s | Turf/s | Perk |
|---|---|---|---|---|---|---|
| 1 | **The Fountain**, "Center Stage" | (0, 0) | 16 | 3 | **2** | Vision 60 m. Basin (r < 11) wading ×0.6, and units in the water regen 3/s |
| 2 | **Arch Plaza**, "Photo Op" (the plaza south of the Arch at x -9..10, z -58..-50) | (0, -42) | 13 | 2 | 1 (2 at Night) | Reveals the north half (z < 0); your units in the ring get +10% Sway |
| 3 | **Chess Plaza** (real tables at x -143..-126, z 40..58) | (-134, 49) | 14 | 2.5 | 1 | 4 build pads; ▲ recruited while it's held cost −15% |
| 4 | **Hangman's Grove**, NW picnic tables (x -143..-127, z -55..-40) with the hero elm at (-150,-54) | (-136, -48) | 13 | 1.5 | 1 | Night: enemies within 15 m get −20% Sway ("creepy old tree") |
| 5 | **Holley Monument & Mutual Aid table** (-76,-11) / (-74,7) | (-76, -3) | 12 | 1.5 | 1 | All your units heal +1/s everywhere |
| 6 | **Garibaldi** (58,-6) | (58, -6) | 12 | 1.5 | 1 | Defenders in the ring get +20% Composure |
| 7 | **Big Dog Run** (fenced, x -86..-34, z 48..68; 2 gates) | (-60, 58) | rectangle | 2 | 1 | ● recruited while held cost −10%. The fence makes it a fortress |
| 8 | **Main Playground** (x 31..80, z -43..-21) | (55, -32) | 15 | 1.5 | 1 | Units inside regen 4/s even in combat ("juice boxes") |
| 9 | **Small Dog Run & Kempner** (run x 22..42, z 58..67; Kempner at (15,48)) | (28, 56) | 13 | 1.5 | 1 | +6 pop cap |
| 10 | **Bobst Gate**, SE entrance facing Bobst Library (43 m) | (104, 60) | 13 | 2 | 1 | Recruit time −25% |
| 11 | **Judson Steps** (across Washington Sq S, in front of Judson Memorial Church) | (-32, 86) | 11 | 1.5 | 1 | Crew Call charge +25% |

**Fenced capture areas.** For the dog runs, the ring is the real fence polygon, and units capture only inside it.

**Gates.** Gates are taken from gaps in `GEO.barriers`. Overrides go in `js/data/navOverrides.js`. Verify the 2 gates of the big run and the 1 gate of the small run against the debug overlay.

**Other maps** reuse the same landmark table:
- **North Side:** Arch, Grove, Holley, Garibaldi, Main Playground, Fountain, plus the Toddler Playground at (-50,-60). 1v1 starting from the NW and NE Home Spots; a 4–5 minute layout with the Turf target at 900.
- **South Side:** Chess, Big Run, Small Run, Bobst Gate, Judson, Fountain, plus Play Hills at (-105,42). SW vs SE; 900 Turf.
- **Random Spots:** 7 landmarks picked from the 13 by a seed.

---

## 5. Controls and HUD

### 5.1 Selection model

- Units belong to **squads**.
- New recruits join the **Reserve** squad at the Rally point.
- There are up to 5 named squads plus the Reserve, and each appears as a **squad chip** in the bottom tray.
- A chip shows:
  - the class mix as pips (●●▲■);
  - a Composure ring;
  - an idle badge.

### 5.2 Touch (designed first, landscape and portrait)

| Gesture | Effect |
|---|---|
| Tap a unit | Selects its squad (double-tap: that unit only) |
| Tap a squad chip | Selects the squad. Double-tap: camera jumps to it |
| Drag a squad chip onto the map | Sends it there. A ghost path line follows the finger and snaps to landmarks within 40 px |
| Tap ground / landmark / enemy with a selection | Attack-move / take-and-hold / focus attack |
| Tap a landmark with no selection | **Landmark card**: owner, perk, Setups, build pads, Rally toggle, and "Send nearest idle squad" |
| Long-press a landmark (0.5 s, radial fill) | **Rally all**: every idle squad goes there |
| Long-press ground (0.3 s), then drag | Lasso select |
| One-finger drag on empty ground | Pan |
| Pinch / twist | Zoom / rotate (rotation snaps to 8 headings when released) |
| ARMY button | Selects all combat units |
| Crew Call button (bottom right; it glows at 100) | Tap, then tap a target (Pack: swipe a line). Tap the button again to cancel |
| Recruit bar (3 big buttons ● ▲ ■ with costs) | Queues at the Rally point. Long-press shows the stat card |

- Hit targets are at least 48 px.
- Tap priority: HUD, then squad chip, then unit (within 24 px), then squirrel, then landmark disc, then ground.
- **"↶ undo order"** toast appears for 2 s after every order.
- **Tactical Pause:** a pause button that still lets you give orders. On by default for touch.

### 5.3 Desktop

| Input | Effect |
|---|---|
| Left-click / left-drag | Select / box select. Double-click selects that unit type on screen |
| Right-click | Context order: move (attack-move), take landmark, attack enemy, build on a pad |
| Shift + right-click | Queue order |
| Long right-click (0.5 s) on a landmark | Rally all |
| 1–5 / Ctrl+1–5 | Squads (recall / assign). Pressing the number twice centers the camera on the squad |
| ` (backtick) | ARMY |
| Z / X / C | Recruit ● / ▲ / ■ |
| F | Crew Call |
| B | Build menu on the hovered landmark |
| R | Set Rally point on the hovered landmark |
| S / H | Stop / hold |
| WASD, arrow keys or screen edges | Pan |
| Q / E | Rotate |
| Mouse wheel | Zoom |
| Middle-drag | Rotate and tilt |
| Space | Jump to latest alert |
| Tab | Cycle your landmarks |
| P / Esc | Pause |

Every action is also available with the mouse alone through the HUD buttons.

### 5.4 Camera

- Perspective camera with FOV 40, orbiting a ground target.
- Height range 30–230 m.
- Pitch eases from 38° when zoomed in, to 55° at mid zoom, to 68° when zoomed out.
- The target is clamped to the park bounding box plus 50 m.
- Opening shot, every match: north-up, looking down Fifth Avenue through the Arch toward the Fountain.
- **Director nudge** (on in M1–M2, optional later): the camera eases toward the largest fight if the player hasn't touched the camera for 4 s.
- Buildings between the camera and the target fade to 25% opacity using a dithered fade.

### 5.5 HUD

The HUD is DOM over the canvas.

- **Top center:** Turf bars, one per faction, toward 1500. Under them, a sun/moon arc showing phase and time.
- **Top left:** Clout with an income/s figure, pop as "14/26", and the menu button.
- **Top right:** a strip of 11 **landmark chips** in the owner's color. A chip pulses when its landmark is under attack; tap it to jump there.
- **Bottom left:** squad chips and the ARMY button.
- **Bottom center:** recruit bar (● ▲ ■).
- **Bottom right:** the Crew Call button with a charge ring, and the pause button.
  - Left-handed mode mirrors the whole bottom row.
- **Minimap** (optional, toggle; on by default on desktop, off on phone): a top-down plan drawn from GEO areas and paths.
- **Counter hint:**
  - with a selection, enemies show a green ▲ or red ▼ chevron for the matchup against your selection;
  - long-pressing or hovering an enemy shows "Weak to: ■".
- **Off-screen alert arrows** sit on the screen edge when one of your landmarks is contested.
- **Event toasts:** a single line with an icon and a countdown, plus a "Go there" button.
- **Announcer:** at most one line every 6 s, priority-queued.
- All text is at least 14 px on mobile.

### 5.6 Accessibility options

- Game speed 0.75× / 1× / 1.25×.
- Colorblind mode: shapes always carry the meaning, and team rings get stripe or dot patterns.
- Text size.
- Bubbles on / text only / off.
- Reduced motion.
- Left-handed layout.
- Captions for event audio.
- Assist mode: idle squads auto-defend contested landmarks that are within 60 m. On by default in M1–M2.

---

## 6. Park events

There is one event every 70–100 s (Calm mode: 120–160 s; Chaos mode: 40–60 s). The first event comes at 1:30. Each event is announced **8 s ahead** with a map marker, a toast and a sting. The director won't target a faction that is more than 300 Turf behind, and targets the leader 60% of the time.

| Event | Duration | Effect |
|---|---|---|
| **The Piano Guy** | 45 s | A neutral grand piano rolls to Kempner (15,48) or Arch Plaza. Units within 15 m: +25% speed, +2 regen. A procedural piano tune plays positionally |
| **Pigeon Lady** | 30 s | She sits on a bench near the target landmark. 120 pigeons in a 20 m radius: Sway ×0.8, speed ×0.7. Pack units in the cloud scatter it 2× faster |
| **Squirrel Heist** | until shooed | 3–5 squirrels sprint for the richest unguarded Food Carts. Tap them to shoo (+5 Clout each) |
| **PEP Sweep** | 25 s | 2 officers walk a real footpath loop near the leader. A moving truce zone of 8 m, where nobody can attack. Useful for retreating |
| **Tourist Bus** | 40 s | Arrives on Washington Sq N. 20 tourists cross the Arch toward the Fountain. The Arch holder gets +1 Clout per tourist; tourists slow pathing |
| **Summer Shower** | 30 s | Rain. ▲ range −30%. Units under the Arch (z -58..-50) or within 4 m of tree trunks are sheltered and get +15% Sway. Puddle sheen |
| **Ice Cream Truck** | 30 s | Parks on Washington Sq S near the closest landmark. That landmark gives +2 Clout/s |
| **Judson Bells** | 2 s | Flavor. The bells chime, every unit pauses 1 s and looks south. A breather |
| **NYU Graduation** (campaign M3 only) | 50 s | 80 neutral graduates in gowns walk Fifth Ave → Arch → Fountain. Violets +20% speed |

---

## 7. AI

The AI is a utility AI, deterministic given a seed. It has no DOM or THREE dependency, so it runs headless in `node --test`.

### 7.1 Three layers

**STRATEGIST** (every 2 s, staggered between factions). For each landmark L it computes:

```
value(L)  = 3*turfRate*phaseMult + 2*clout*phaseMult + perkW[pers][L.perk] + setupValue(L)
          + 4*(L is Fountain) + 2*(L is Park House adjacency joke flag)
score(L)  = value * (1 + 0.5*enemyOwned) / (1 + travelTime(L)/30) - 1.2*threat(L)*riskTol
threat(L) = Σ visible enemy power within 25 m, where power = Composure*Sway*matchupMult
```

- **Hysteresis:** the Strategist switches a squad's target only if the new score beats the current one by at least 25%. A squad stays committed for 15 s minimum.
- **Phase anticipation:** 25 s before a phase change, it uses the next phase's multipliers.
- **Events:** announced events count as temporary value bonuses on the affected landmark (the Piano, the ice-cream truck) or as penalties (PEP).
- **Squads:**
  - Main squad: about 60% of the army.
  - Raider squad: the fastest units, about 20%.
  - Home Guard: about 20%, plus the regulars.
- **Defense:** it reinforces a contested owned landmark if its sendable power within 15 s is at least 0.7× the attacker's. Otherwise it writes the landmark off and counter-raids the attacker's weakest landmark.

**QUARTERMASTER** (every 3 s).
- Target mix starts at the personality default.
- With probability `counterP`, it shifts 30 points toward the class that beats the plurality of visible enemy units.
- Building:
  - When Clout exceeds cost + 40, it builds from the personality's priority list on the safest owned pad. Safety is the distance to the nearest visible enemy.
  - It builds a Bench Cluster when at the pop cap.
  - It builds a Food Cart when income is below 5/s.
- It keeps 40 Clout in reserve.

**SQUAD TACTICIAN** (every 0.5 s per squad).
- Formation: ■ in front, ▲ 6 m behind, ● on the flanks.
- Lanchester estimate: `ratio = Σ(own Sway*mult*Composure) / Σ(enemy ...)`.
  - It engages if ratio ≥ `engageT`.
  - It retreats to the nearest owned heal source (Playground, Food Cart, Water Bowl, Park House, Home) if ratio < 0.6.
- **Crew Call:** fires when the predicted effect hits at least 4 enemies, flips a contested capture, or saves a squad that is retreating.

### 7.2 Personalities

Each personality has a portrait and a quote on the skirmish screen.

| Personality | Default mix ● / ▲ / ■ | Behavior | Weakness |
|---|---|---|---|
| **Hustler** (greedy) | 40 / 40 / 20 | Expands to 4 landmarks fast, builds Food Carts and Chess Tables early, fights only at ratio ≥ 1.3 | Early rush |
| **Mosh Pit** (rush) | 70 / 20 / 10 | All ● until 2:00, then repeated attacks on the player's nearest landmark | ■ and Boomboxes |
| **Turtle** | 25 / 35 / 40 | Fountain plus 2 adjacent landmarks, builds every pad, pushes only at Night | Being out-scored elsewhere; long ▲ sieges |
| **Opportunist** (raider) | 50 / 40 / 10 | 2–3 small squads hit empty landmarks and carts, avoids the main army | Grouped defense, Hangman's Grove at Night |

Default pairing: Hustle → Turtle, Noise → Turtle, Violets → Mosh Pit, Pack → Opportunist.

### 7.3 Difficulty

| Difficulty | Reaction delay | counterP | engageT | Income | Other |
|---|---|---|---|---|---|
| **Chill** | 1.5 s | 0.3 | 0.9 (reckless) | ×0.85 | No attacks before 1:30; Crew Call delayed 30 s after it fills; attacks pinged 5 s ahead on the map |
| **Regular** | 0.8 s | 0.6 | 1.1 | ×1.0 | |
| **Hard** | 0.4 s | 0.85 | 1.2 | ×1.0 | Feints and 2-prong raids |
| **Park Legend** | 0.25 s | 0.95 | 1.2 | ×1.15 | Sees 30% further |

- **Fog:** the AI uses the same vision rules as the player (unit sight 25 m, plus landmark perks).
- **Barks** (all difficulties): the AI announces its committed attacks, e.g. "The Rugby Club is heading for the Arch!". This makes the AI feel like a character and gives the player a beat to react.
- **Campaign:** after 2 losses on the same mission, the game offers **"Chill it down?"**, which drops one difficulty step and turns on Assist mode. It never adjusts difficulty silently.

### 7.4 Pathfinding

- **Walk grid:** 1 m cells over x -200..170, z -110..130. That is 370×240 = 88,800 cells, a Uint8 cost grid.
- Costs:
  - path, plaza, sidewalk: 10;
  - lawn: 13;
  - flowerbed, shrubbery: 30;
  - fountain basin: 18;
  - road: 12 (only outside the park and at crosswalks);
  - buildings, fences, Arch piers, statue plinths: 255 (blocked).
- Gates: taken from gaps in `GEO.barriers` that are at least 1.2 m wide, plus `navOverrides`.
- **Flow fields** (Dijkstra into an Int16 distance field) are precomputed at load for every landmark and Home Spot, about 15 fields at ≤ 8 ms each.
- Ad-hoc ground orders use A* on a 2 m grid.
- Steering: separation within 0.9 m, slight overlap allowed, arrival spread around the ring.
- The sim runs at a fixed **20 Hz**. Rendering interpolates between ticks.

---

## 8. Campaign: "One Day in the Square"

Six short missions run through one Saturday. Each teaches one thing, and each has 3 stars: win, beat a time target, and a bonus. The first launch drops straight into M1, with no menu wall.

1. **FIRST LIGHT** (7 AM, Pack vs a passive Squirrel Gang). *Teaches tap-to-send, capture and the Crew Call.*
   - A 4-landmark slice of the SE quarter.
   - About 3 minutes. **The mission cannot be lost.**
   - Squirrels (Composure 25, Sway 3, flee at 50%).
   - Beats:
     1. Camera swoop through the Arch.
     2. "Tap the Small Dog Run."
     3. Capture with confetti.
     4. Recruit a pair.
     5. "Tap the Big Dog Run" to chase off 4 squirrels.
     6. A pre-charged ZOOMIES: "Swipe to unleash!"
   - Win: hold 3 landmarks.
   - Bonus: shoo 3 squirrels.
2. **OPENING GAMBIT** (10 AM, Hustle vs Violets, Mosh Pit/Chill). *Teaches the counter triangle.*
   - The enemy spams ● Freshmen. A 3-panel comic card explains ● > ▲ > ■ > ●.
   - The chevron counter hint is introduced, and the game prompts you to recruit ■ Old Heads.
   - West half of the map. Turf target 600.
   - Bonus: never lose the Chess Plaza.
3. **COMMENCEMENT** (noon, Violets vs Hustle, Hustler/Regular). *Teaches Clout, Setups and the flip stakes.*
   - Build 2 Food Carts and a Club Fair Table.
   - The NYU Graduation event fires at 2:00.
   - Bonus: capture a landmark that holds an enemy Chess Table.
4. **THE PIANO COMES OUT** (3 PM, Noise vs Pack, Opportunist/Regular). *Teaches events and Crew Call timing.*
   - The scripted Piano Guy, Squirrel Heist and PEP Sweep all fire.
   - Hold the Fountain for a cumulative 150 s.
   - Bonus: a Drum Circle that hits 6 or more enemies.
5. **GOLDEN HOUR** (starts at the Golden Hour phase, your pick of crew vs Turtle/Regular). *Teaches phases.*
   - The Night Arch spike decides the match.
   - Full map.
   - Bonus: hold the Arch for the last 60 s.
6. **SQUARE OFF AT MIDNIGHT** (your pick vs 2 AIs, FFA, Regular). *Puts everything together.*
   - The clock starts at 9 PM, so the match covers Golden Hour → Night.
   - Finale: everyone sits on the fountain rim with all the colors mixed. Card: "Same time tomorrow?"

**Unlocks**
- Factions:
  - The Pack, the Hustle and the Violets are unlocked by playing M1–M3.
  - The Noise unlocks with M4.
  - Skirmish has all four unlocked after M2.
- Stars unlock cosmetics (seasonal outfits) and skirmish modifiers.
- Progress is saved in `localStorage` under the key `squareoff.v1`, wrapped in try/catch.

**Skirmish options**
- Crew: one of 4.
- Opponents: 1–3 AIs, each with a crew, personality and difficulty.
- Map: Whole Square / North Side / South Side / Random Spots.
- Start phase.
- Events: Calm / Normal / Chaos.
- Turf target: 900 / 1500.
- **Quick Play:** one tap, a random crew vs a Regular AI.

**Daily Park.** A date-seeded skirmish with a fixed matchup, a fixed event schedule and one modifier (e.g. "Pianos for everyone", "Heatwave: regen ×0.5"). The best Turf margin is saved locally.

**Park Report** (end screen) shows:
- Turf curves;
- MVP squad;
- comic stats ("Units who left the park: 23 — most common reason: 'needed a bathroom'", "Squirrel heists: 2", "Longest held: Fountain 4:12");
- **one actionable tip** based on how the match went.

**Tutorial rules for all missions**
- One line of text at a time, with no blocking popups.
- If you're idle for 8 s, the hint re-pulses.
- Context tips are triggered by behavior (e.g. you lose a fight to a counter → "Squares beat circles — bring a ■"). Each tip shows at most twice and auto-dismisses after 4 s.
- Pan, zoom and rotate are taught only the first time something important is off-screen.
- The **Field Guide** codex in the menu has every unit, landmark and event, each with two lines of real park trivia.

---

## 9. Audio (procedural WebAudio, no samples required)

- **Ambient bed**, mixed by camera position and zoom:
  - city hum (brown noise through a low-pass);
  - occasional siren sweeps and horn pairs;
  - subway rumble from W 4th;
  - fountain noise (band-passed noise whose gain is ∝ 1/distance to (0,0));
  - FM pigeon coos;
  - wind in the trees;
  - birds by day, crickets at Night.
- **Adaptive music**, a busker band sequencer at 96 BPM in a pentatonic key:
  - the base layer is a bucket-drum groove;
  - +1 layer for every 2 landmarks held: bass, then keys, then a sax lead;
  - +8 BPM when any faction is within 200 Turf of the target;
  - a minor variant plays while you are behind;
  - at Night the band swaps to a brushed jazz-trio patch.
- **Faction stings** (2 bars each) play on capture: Hustle clock slap and rimshot; Noise sax lick; Violets crowd cheer; Pack triple bark.
- **Voice blips:** pitched synth syllables per faction (Animal-Crossing style) for acknowledgements. Barks appear as text bubbles, at most 2 on screen at a time.
- **UI sounds:**
  - wood-block click on select;
  - skate-pop on send;
  - whistle when a recruit completes;
  - coin plinks, capped at 4 per second;
  - a car-horn double tap for "under attack", at most once per 4 s per landmark;
  - a distinct "gained" chime.
- **Mixing:** a cap of 16 voices, with positional panning by screen x.
- **Haptics:** `navigator.vibrate(15)` on captures and Crew Calls.

---

## 10. Juice

- **Capture:**
  - the ring fills with a chalk-scribble dashed arc;
  - on a flip, chalk dust bursts, confetti falls in the faction color, the tag stamps on over 0.6 s, the camera punches 4%, and every unit in the ring squashes;
  - a floating title appears ("CHECKMATE AT THE CHESS PLAZA").
- **Sway:** shown as glyph particles flying between units instead of projectiles: ♪ $ ! ? ♞ "woof".
  - A counter hit pops a small shape icon with a "CRIT" punch, so players learn the triangle by seeing it.
- **Over It:** the unit throws up its hands, turns desaturated, shows a bubble (about 80 exit lines in `text.js`) and walks out.
  - A whole squad wiped out gets a big comic word: SCHOOLED! / OUT-HUSTLED / DROPPED THE BEAT / BAD DOG DAY.
- **Crew Call:** a 0.3 s slow-motion, a faction color wash, and the faction's signature effect (§2.2).
- **Win:** 0.4 s slow-motion on the final Turf tick, then fireworks over the Arch.
- **Reduced-motion mode** disables shake, slow-motion and confetti.

---

## 11. Rendering plan (three.js r158 UMD, `js/vendor/three.min.js`)

Everything is generated at load from GEO and canvas textures. There are no model files and no fetch, so the game works from `file://`.

### 11.1 Ground (1 draw call)

- **Ground plane:** one plane over x -260..260, z -180..180.
- **Ground atlas:** a canvas texture, 4096×2816 (High) or 2048×1408 (Phone/Low). It is painted in this order:
  1. Base sidewalk concrete in pale grey with a 1.5 m joint grid.
  2. Roads (`GEO.roads`): asphalt with noise, yellow center lines, and white crosswalk zebras at the park entrances.
  3. Lawns (`grass`, `garden`, `park`): 3 tones of green from value noise, plus mow stripes and worn desire-lines. The dog runs get gravel/rubber; `sand` gets sand; playgrounds get colored rubber.
  4. Paths (`GEO.paths` with `area:false`, stroked to their width; default 3 m): the park's hexagonal pavers in grey-brown, with a lighter edge stroke.
  5. The Fountain plaza: a granite ring with concentric seams out to r 30.
  6. **Baked AO:** soft dark ellipses under every tree, a 2 m halo along building footprints, and small blobs under benches.
- **Detail texture:** a second 512² tiling texture (hex pavers and grass blades) blended in by distance in `onBeforeCompile`, for crispness at close zoom.
- **Curbs:** a 0.15 m extruded strip along the road edges, merged into one mesh.

### 11.2 Buildings (346 footprints, real `h`)

- `ExtrudeGeometry` from `pts` with depth `h`, rotated to Y-up.
- Wall UVs are in world meters: u = running wall length, v = height.
- Geometry is merged by a hand-written `mergeGeometries` (r158 UMD has no `BufferGeometryUtils`) into **material class × 4 spatial quadrants**, which keeps building draw calls at 24 or fewer.
- **Material classes**, assigned by name, kind, then position, with a hashed fallback:
  - **The Row Brick:** north side, z -110..-78, h < 25. Red Flemish-bond brick, 6-over-6 windows with white lintels, plus instanced white stoops and cornices along the street face.
  - **NYU Sandstone:** Bobst, Kimmel, Silver, Kaufman, Tisch, Warren Weaver, Lipton, Furman (matched by name). Red sandstone, horizontal spandrel bands and a dense window grid.
  - **Judson:** yellow Roman brick with round-arched windows.
  - **Brownstone:** generic h < 22.
  - **Limestone:** generic h ≥ 22.
  - **Modern Glass:** h ≥ 40 when not NYU, or by name.
- **Facades:** each class has a 512² canvas texture tile covering one bay × one floor. The tile has brick or stone with mortar, a window with frame, sill and lintel, glass with a sky-gradient reflection, and a hashed variant of the blinds.
  - Floor height 3.4 m (The Row 3.8 m); bay 2.6 m.
  - A ground-floor band uses a storefront variant.
- **Night windows:** a shader branch hashes floor×bay and lights about 30% of windows warm, driven by a uniform `uNight`.
- **Roofs:** gravel grey with a parapet lip. Instanced water towers (a cylinder, a cone and 4 legs) go on about 15% of roofs over 25 m, plus HVAC boxes.
- Buildings more than 140 m outside the park use the flat material (no facade texture) and get fog.

### 11.3 Hero models (code-built, real proportions)

- **Washington Square Arch** (GEO footprint x -9..10, z -58..-50, h 20.5):
  - 2 piers of 5.6 m × 8 m, each with a plinth, an impost cornice at 9 m and a Shape+`ExtrudeGeometry` archway with a semicircular hole about 9 m wide and 14 m to the crown;
  - entablature and frieze at 16–18 m, an attic to 20.5 m, and a balustrade line;
  - two low-poly Washington statue groups on the north pier faces;
  - white marble material (warm tint) with a canvas detail texture for rosettes and spandrels;
  - about 4k triangles.
- **Fountain** (r 11):
  - stepped granite rim (`LatheGeometry`) and basin;
  - water disc with a ShaderMaterial (two scrolling procedural normals, Fresnel sky reflection);
  - a central jet plus a ring of jets as GPU `Points` (600 High / 250 Phone);
  - a mist sprite.
- **Judson Memorial Church:** a campanile added on top of its footprint: a 3-tier box tower with arched openings and a pyramid roof.
- **Garibaldi and Holley:** a stepped plinth plus a low-poly bronze figure of about 400 triangles each.
- **Kempner:** a small stone marker.
- **Park House:** a low box with a slatted canopy.
- **Chess Plaza:** the 27 `picnic_table` points become instanced stone tables with checkerboard tops (canvas texture).
- **Playgrounds:** instanced towers, slides and swings in bright colors.
- **Hangman's Elm:** the hero tree at (-150,-54), 1.6× scale, with a gnarled trunk made of 3 bent cylinders.
- **Fences** (`GEO.barriers`): a black 1.1 m iron fence as one merged mesh (posts plus 2 rails) plus an alpha-tested picket quad strip.
- **Midtown backdrop:** silhouette cards of the skyline to the north, with an Empire State Building framed by the Arch from the opening camera. This is the signature shot.

### 11.4 Instanced props (1 draw call per type)

| Prop | Source | Detail |
|---|---|---|
| Trees ×417 | `GEO.trees` | Trunk (8-sided, tapered) plus 3 merged icosphere crowns, vertex-color gradient; scale 9–17 m from a hash; London plane palette; wind sway in the vertex shader keyed to instance id |
| Benches ×399 | `GEO.benches` | Green slats, iron frame, about 120 triangles, oriented to the nearest path |
| Lamps ×147 | `GEO.lamps` | Post plus globe. At Night the globe is emissive, with an additive glow sprite and a ground light-pool decal |
| Picnic and chess tables, trash baskets (55), drinking fountains (8), Citi Bike docks | `GEO.points` | Instanced |
| Parked cars and cabs | Spline along `GEO.roads` curbs | About 60 parked; about 20 driving on Fifth Ave and the Washington Sq loop (High only) |

**Canopy readability**
- Canopies within 25 m of the screen-center ground point dither to 35% when the camera height is under 120 m or the selection is underneath.
- Selected units also render a silhouette pass with depth test off.

### 11.5 Units and people

- Units are stylized "diorama people" of 150–300 triangles each, built from capsules and boxes.
- Each faction has a silhouette prop:
  - Hustle: flat cap and lawn chair;
  - Noise: bucket, sax or tambourine;
  - Violets: hoodie and backpack;
  - Pack: an actual dog mesh beside the walker (the Heavy has 6 dogs on leashes).
- One `InstancedMesh` per (faction × unit type), with per-instance color and phase attributes.
- Walk bob and arm and leg swing are done in the vertex shader; there are no skeletons.
- Each unit has a team ground ring (instanced decal) and a floating class glyph. The glyph is a billboard that scales up as the unit fades out past a camera height of 150 m.
- Ambient civilians: 100 on High, 40 on Phone. They are desaturated, walk the paths, and step away from fights.
- Pigeons, squirrels, tourists and graduates are instanced billboards or tiny meshes.

### 11.6 Lighting and time of day

- `HemisphereLight` plus one `DirectionalLight` sun, ACES tone mapping, sRGB output.
- **Keyframes per phase:**
  - Afternoon: high, neutral-warm.
  - Golden Hour: a low sun from the WSW down the cross streets, with long shadows from The Row across the lawns.
  - Night: blue moonlight and sodium lamp glow, with windows lit.
- Transitions take 6 s, and at Night the lamps come on in a wave outward from the Arch.
- **Sky:** a gradient dome shader with a sun disk. Fog color matches the sky.
- **Readability:**
  - the environment is desaturated by about 12% in the shader chunk, while faction colors stay fully saturated;
  - capture rings draw with depth test off.

### 11.7 Shadows, quality tiers and budgets

| Tier | Pixel ratio | Ground | Shadows | Particles / civilians | Notes |
|---|---|---|---|---|---|
| High (desktop) | ≤ 2 | 4096 | 2048 map, buildings + trees + units cast | full / 100 | Moving cars, detail grass off by default |
| Phone | 1.25 | 2048 | 1024 map, buildings + Arch only | half / 40 | 2 crowns per tree |
| Low | 1.0 | 2048 | off (baked AO carries the look) | quarter / 20 | 1 crown per tree; buildings > 80 m outside the park culled |

- The shadow camera is orthographic, fitted to the view-frustum footprint, and clamped to 260 m. Shadows update every 2nd frame on Phone.
- **Auto-tier:** measured by a 2 s frame-time probe after load; the player can override it.
- **Dynamic resolution:** the pixel ratio drops by 0.1 when the frame time averages more than 20 ms for 2 s.
- **Budgets:**
  - Phone: ≤ 120 draw calls, ≤ 350k visible triangles, ≤ 120 MB textures, 60 fps on a 2021 mid-range phone (30 fps floor).
  - Desktop: ≤ 250 draw calls, ≤ 1.2M triangles.
- **Load time:** the world must build in under 2 s on a phone. A progress bar shows park facts during loading.
- **Render on demand:** only while the game is paused.

---

## 12. Module plan

All files are classic `<script defer>` scripts. Each attaches to `window.SQ`:

```js
(function (SQ) { 'use strict'; /* … */ SQ.Thing = {…}; })(window.SQ = window.SQ || {});
```

- **Load order** (in `index.html`): `vendor/three.min.js`, `geo.js`, `core/*`, `data/*`, `sim/*`, `render/*`, `ui/*`, `audio/*`, `main.js`.
- **Headless rule:** `core`, `data` and `sim` must never touch `THREE`, `document` or `window` beyond the `SQ` attach.
- **Tests:** tests load these files with `globalThis.window = globalThis` and `require()` (helper `test/load.js`).
- **Ownership:** one engineer owns each row and only edits files in their row. Shared contracts live in `js/core/contracts.js`, which is owned by the lead and changed only through review.

### 12.1 Files and owners

| Owner | Files | Responsibility |
|---|---|---|
| **Lead / Core** | `js/core/ns.js` | `SQ.util` (seeded RNG `mulberry32`, clamp/lerp, `dist2`, hash), `SQ.bus` (`on/off/emit`) |
| | `js/core/contracts.js` | JSDoc typedefs plus `SQ.C` constants: classes, faction ids, tick rate 20 Hz, event names |
| | `js/main.js`, `index.html`, `css/style.css` | Boot, loading screen, game loop (fixed sim tick plus render interpolation), quality probe |
| **Data / Design** | `js/data/units.js` | `SQ.data.units[faction][class]`: stats table (§2), multipliers |
| | `js/data/factions.js` | Colors, passives, Crew Call parameters, AI default personality |
| | `js/data/landmarks.js` | §4 table: id, name, center, radius or polygon, clout, turf, perk id, pad positions, phase multipliers |
| | `js/data/maps.js` | Map variants: landmark id list, Home Spots, Turf target |
| | `js/data/missions.js` | Campaign scripts (declarative beats: `{when, hint, target, unlock}`) |
| | `js/data/events.js` | Event definitions (§6) |
| | `js/data/text.js` | Barks, exit lines, announcer lines, Field Guide trivia |
| | `js/data/navOverrides.js` | Gate and blocker overrides |
| **Sim A: World and Nav** | `js/sim/nav.js` | `SQ.nav.build(GEO)` → grid; `flowTo(targetId)`; `astar(from,to)`; `sample(x,z)` → terrain type |
| | `js/sim/world.js` | `SQ.World` state: units (struct-of-arrays), squads, landmarks, setups, factions; `spawnUnit`, `removeUnit`, spatial hash `query(x,z,r)` |
| | `js/sim/movement.js` | Steering, flow-field following, separation, terrain speed |
| **Sim B: Rules** | `js/sim/combat.js` | Targeting, Sway, counters, splash, Over It, Grudge, regen |
| | `js/sim/capture.js` | Capture meters, contest, flips, regulars, Setup flipping |
| | `js/sim/economy.js` | Clout, pop, recruit queues, Rally point, Setups and build pads, Turf, phases, comeback rule |
| | `js/sim/abilities.js` | Unit passives and the 4 Crew Calls |
| | `js/sim/match.js` | `SQ.Match.create(cfg)`, `tick(dt)`, victory, clock, `SQ.cmd` command API, replay log |
| **Sim C: AI and Director** | `js/sim/ai.js` | Strategist, Quartermaster and Tactician; personalities; difficulty. Uses `SQ.cmd` only |
| | `js/sim/director.js` | Event director, neutrals (pigeons, squirrels, PEP, tourists) |
| | `js/sim/campaign.js` | Mission runtime: beats, stars, tutorial triggers (no DOM; emits `hint` events) |
| **Render A: World** | `js/render/textures.js` | Canvas generators: facades (per material class), ground detail, chess top, marble, glyph atlas |
| | `js/render/ground.js` | Ground atlas bake, curbs |
| | `js/render/buildings.js` | Extrusion, material assignment, merge, night windows, water towers |
| | `js/render/landmarks.js` | Arch, Fountain (water shader, jets), Judson tower, statues, playgrounds, Hangman's Elm, fences, skyline cards |
| | `js/render/props.js` | Instanced trees, benches, lamps, tables, cans, bikes, cars; canopy fade |
| | `js/render/sky.js` | Lights, sky dome, fog, time-of-day keyframes, shadow fitting |
| **Render B: Actors and FX** | `js/render/scene.js` | Renderer, scene, quality tiers, dynamic resolution, `SQ.render.frame(state, alpha)` |
| | `js/render/units.js` | Instanced unit meshes, team rings, class glyph billboards, neutrals, civilians |
| | `js/render/fx.js` | Capture rings, chalk tags, confetti, Sway glyph particles, Crew Call effects, bubbles (rendered as DOM sprites via ui), weather |
| **UI** | `js/ui/camera.js` | Orbit RTS camera, clamps, Director nudge, opening flight |
| | `js/ui/input.js` | Unified pointer, touch and keyboard → `SQ.cmd` calls. Picking priority, lasso, long-press, chip drag, undo |
| | `js/ui/hud.js` | DOM HUD (§5.5), landmark card, build radial, toasts, announcer, bubbles |
| | `js/ui/menus.js` | Title, campaign map, skirmish setup, options, Field Guide, Park Report, `localStorage` save |
| | `js/ui/tutorial.js` | Renders hints, ghost hand and arrows from `hint` events |
| **Audio** | `js/audio/audio.js` | `SQ.audio`: context unlock, ambient bed, SFX synth, positional pan, voice cap |
| | `js/audio/music.js` | Adaptive busker sequencer |
| **Tools / QA** | `tools/build-standalone.js` | Inline everything into `dist/square-off.html` (pattern as in `stortorget/tools`) |
| | `tools/sim-batch.js` | Headless AI-vs-AI batches → win-rate and match-length CSV |
| | `test/*.test.js` | `node --test`: nav (gates reachable, every landmark reachable from every Home Spot), combat math, capture timing, economy pacing, AI completes a match in 4–10 min, determinism (same seed → same hash) |
| | `server.js` (optional) | Tiny static server |

### 12.2 Key interfaces (frozen in `contracts.js`)

```js
// Commands (only path from UI/AI into the sim; all validated, all logged for replay)
// (selection is UI-only) sim commands:
SQ.cmd.order(match, factionId, unitIds, {type:'move'|'attackMove'|'take'|'attack'|'stop'|'hold', x, z, targetId, queue})
SQ.cmd.recruit(match, factionId, cls)                 // cls: 'crowd'|'talker'|'heavy'
SQ.cmd.setRally(match, factionId, landmarkId)
SQ.cmd.build(match, factionId, landmarkId, padIdx, setupId)
SQ.cmd.crewCall(match, factionId, {x, z, x2, z2, landmarkId})
SQ.cmd.squad(match, factionId, unitIds, squadIdx)
SQ.cmd.shoo(match, factionId, neutralId)  /  SQ.cmd.buyDosa(match, factionId)

// State read by render/UI (never mutated outside sim)
match.state = { t, phase, factions[], units: {n, x, z, px, pz, hp, maxHp, cls, faction, type, anim, flags, squad}, landmarks[], setups[], neutrals[], events[] }

// Bus events (sim → render/ui/audio)
'capture' {lm, from, to}   'contested' {lm, faction}   'overIt' {unit, faction, line}
'hit' {from, to, counter}  'crewCall' {faction, kind, x, z}   'eventWarn'/'eventStart'/'eventEnd' {id, lm}
'phase' {phase}   'recruited' {faction, cls}   'built' {lm, pad, setup}   'hint' {id, text, target}
'aiBark' {faction, text, lm}   'victory' {winner, stats}
```

### 12.3 Milestones

1. **M1 World:** ground, buildings, props, Arch, Fountain and camera render from GEO on desktop and phone within budget.
2. **M2 Move:** nav grid, flow fields, selection and orders, for mouse and touch.
3. **M3 Rules:** combat, the triangle, capture, economy and Turf, with the Hustle in a mirror match.
4. **M4 AI:** all three layers, Regular difficulty, headless `sim-batch`.
5. **M5 Factions:** all 4 crews, passives, Crew Calls, Setups.
6. **M6 Life:** events, phases with lighting, audio and music, juice.
7. **M7 Game:** campaign M1–M6, menus, Park Report, standalone build.
8. **M8 Polish:** balance sims (target win rates 45–55% per pairing over 200 seeded runs, median match 5–8 min), phone performance tiers, accessibility pass.

---

## 13. Risks and cut order

**Risks and mitigations**
- **Phone performance:**
  - merge buildings by material and quadrant;
  - instance everything;
  - baked AO;
  - the Low tier;
  - early profiling on a mid-range Android device.
- **Readability under trees and among detail:**
  - canopy fade;
  - team rings and glyphs;
  - a desaturated world;
  - rings drawn on top;
  - a 375 px screenshot check every milestone.
- **Messy OSM gates:** the debug overlay (`?nav=1`), `navOverrides.js`, and a test that every landmark is reachable.
- **Touch precision:** squads and chips instead of box selection, generous hit radii, tactical pause, undo.
- **AI dithering:** hysteresis plus commitment timers.
- **Tone:** archetypes only and self-deprecating exit lines.

**Cut order** (cut from the top first)
1. Daily Park.
2. Random Spots, North Side and South Side.
3. Moving traffic and civilians beyond 20.
4. Ice Cream Truck, Judson Bells, Tourist Bus.
5. Faction special Setups.
6. Mission 6 FFA (replace it with a 1v1 finale).
7. The Noise faction (ship with 3).

**Never cut**
- The real-GEO park with the Arch, Fountain and facades.
- The counter triangle with its glyphs.
- 11 landmarks with distinct perks.
- Phases.
- Crew Calls.
- The "Over It" exits.
- Touch support.
- Mission 1, which can't be lost.

**Post-launch:** the Skaters faction (raids, speed on pavement, "Session" Crew Call), Seasons (Halloween fog at Hangman's Grove, Snow Day), and Legends.
