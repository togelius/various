# SQUARE OFF

*A five-minute game about getting the best spots in the real Washington Square Park, NYC.*
**Hang out to score. Make the others leave.**

Your crew has three groups of regulars. There are five good spots in the park. A group that hangs out at a spot
earns your crew a point every second; a rival group that turns up starts an argument, and arguing wears down
patience. Out of patience means a coffee break. Most points when the 5:00 clock runs out wins.

Pick one of four crews: the Hustle (chess hustlers), the Noise (buskers), the Violets (NYU students) or the Pack
(dog people). They look and talk differently; they all play by the same rules.

The park is built from OpenStreetMap data: 346 real building footprints with heights, 417 trees, 399 benches,
147 lamps, the Arch, the Fountain and the fenced dog runs.

## Run it

- **Easiest:** double-click `index.html`. It runs from `file://` with no build step and no server.
- **Single file:** run `npm run build:standalone`, then open `dist/square-off.html`. You can copy, mail or host that
  one file anywhere.
- **On your phone:** run `npm start`, then open `http://<your computer's IP>:8080` on a phone on the same Wi-Fi.
  Add it to the home screen for full screen.

The title screen has one big **PLAY** button. The first time, it asks which crew you are and starts the tutorial
("First morning in the park", about four minutes). After that, PLAY is a 5-minute match against an Easy crew, and
against a Normal crew once you have won one. The title also has the Tutorial again, a Custom match (your crew,
their crew, Easy / Normal / Hard), How to play, Options and The park (a map of the five spots).

**Classic mode**, the original full real-time strategy game, is still there: the small "Classic mode" link at the
bottom of the title screen (see [Classic mode](#classic-mode-the-full-rts) below).

Optional URL flags:

| Flag | What it does |
|---|---|
| `?tutorial` | Start the tutorial right away (add `&as=pack` to pick the crew) |
| `?ho` | A 5-minute match right away (add `&crew=pack&rival=noise&diff=easy\|normal\|hard&len=300&seed=1`) |
| `?classic` | Open the Classic menu |
| `?title` | Show the title screen |
| `?q=low\|med\|high` | Force a graphics tier (normally picked automatically and lowered if frames are slow) |
| `?mute` | No sound at all. Automated browsers (Playwright, WebDriver) are always silent, so playtests never make noise |
| `?quick`, `?skirmish=1&...`, `?mission=m1`, `?nointro`, `?start=night` | Classic matches (see below) |

## How to play

**The goal:** have more points than the other crew when the clock runs out.

1. **Hang out at a spot to score.** Send a group to one of the five spots (the signs in the park: the Fountain,
   Holley Plaza, Garibaldi, the Toddler Playground and the Small Dog Run). It settles in for 3 quiet seconds, then
   your crew gets +1 point every second it stays. A "+1" rises over the group that earns it. Two of your groups at
   one spot still earn just +1, so spread out.
2. **Rivals at the same spot argue.** Each rival group there drains your group's **patience** (the bar on its card
   and over its head). A group that was already hanging out keeps earning while it argues. Patience refills when
   nobody is arguing with you, so walking away early is free.
3. **Out of patience means coffee.** The group leaves for 15 seconds ("back in 0:12" on its card), comes back
   through your entrance and walks back to the spot it left, unless you tap its card and send it somewhere else.

To make a group leave a spot, send **two** of yours: two against one drains them twice as fast. One against one,
if both run out of patience at the same moment, the group that was there first stays. Five spots and three groups
each: somebody is always short, so the game is about where to commit, when to walk away and where to cause trouble.

The cards at the bottom say what each group is doing in words ("Walking to the Fountain, 8 s away", "Patience:
you 40, them 25 (they give up first)", "Getting coffee, back in 0:12, then back to Fountain"). One short message
at a time explains what just happened and why ("Two against one: you ran out first."). The Park Report at the end
says why you won or lost.

### Controls

**Giving orders is two taps: tap a group, then tap a spot.** Tap a group's card at the bottom (or the people in the
park; keys 1, 2 and 3 on a keyboard), then tap a spot's circle or its sign. Every order lets go of the group, so a
stray tap later never moves anyone. A small note where you tapped says what happened ("Old Heads → Fountain",
"Pick a group first"). Tapping a selected card again moves the view to that group.

**Moving the view:**

| | Phone / tablet | Mouse and keyboard |
|---|---|---|
| Look around | Drag with one finger | Drag, W A S D or the arrow keys, or push the mouse against the screen edge |
| Zoom | Pinch, or the + and − buttons | Mouse wheel, or + and − |
| Turn | Twist two fingers, or ⟲ ⟳ | Q and E, right-drag, or ⟲ ⟳ |
| Find my groups | ⌖ | Space, or ⌖ |
| Jump somewhere | Tap the round map | Click the round map |

The camera buttons sit on the right (on phones held upright, in a row just above the cards). The round map turns
with the view. A match opens with all five spots on screen.

**Other:** on a touch screen a tap on bare ground (not a spot) just lets go of the selected group; with a mouse it
walks the group there, inside the park. Right-click also sends. **Pause** (the button top left, or P) stops the
clock but keeps the view and the cards working, so you can look around and line up orders; its Menu has How to
play, Options, Start over and Quit. Esc lets go of a group, or opens the menu.

Options has coach tips, edge scrolling (on by default with a mouse), colour-blind colours, text size, reduced
motion, left-handed layout, graphics and volumes.

## Classic mode: the full RTS

*Five minutes, five dollars, the whole park.* The original game, unchanged: from the title screen choose
"Classic mode". On first launch it goes straight into Mission 1, a two-minute tutorial. After that it has the
Campaign (6 missions), Quick Play, Skirmish (up to 4 crews and 6 maps), the Daily Park, the Field Guide and Options.
Quick Play is against a Chill AI until you have beaten Mission 3, and against a Regular AI after that. Units have
Composure instead of HP; at zero a unit is *Over It* and walks out of the park ("I'm going to Think Coffee").

You win by holding landmarks. First crew to the Turf target (usually 1500) wins. If nobody gets there, the crew
with the most Turf wins when the park closes at 1 AM, which takes 10 minutes of play. The light is the timer:
Afternoon, then Golden Hour, then Night.

**There are two verbs: select a squad, then tap a place.**

- **Take a landmark:** send units into its ring and stand there. More units capture faster. A landmark pays Clout
  (money) and Turf (score) every second.
- **Counters:** ● beats ▲, ▲ beats ■, ■ beats ●.
  - ● is a Crowd: cheap and fast.
  - ▲ is a Talker: ranged.
  - ■ is a Heavy: tanky, with splash damage.

  Select units and every enemy shows a green ▲ (good fight) or a red ▼ (walk away).
- **Recruit:** use the three ●▲■ buttons at the bottom. Recruits appear at your rally point. Spend your Clout:
  an idle wallet loses parks.
- **Setups:** open a landmark you hold to build on its glowing pads. Food Carts pay Clout, Bench Clusters raise
  your population cap, and each crew has its own special Setup. Setups flip to whoever takes the landmark.
- **Crew Call:** your ultimate. It charges in fights. Tap it, then aim:
  - Hustle Tournament freezes enemies.
  - Noise Drum Circle hurts enemies and heals your own.
  - Violets Group Chat spawns reinforcements at a landmark you hold.
  - Pack ZOOMIES: swipe a line through the enemy.
- **Park events:** the Piano Guy, the Pigeon Lady, squirrel heists (tap squirrels to shoo them), PEP sweeps,
  showers, the ice-cream truck and more. Each one is announced 8 s ahead. Tap "Go there" to jump to it.

#### Classic on a phone (touch)

| Do this | And this happens |
|---|---|
| Tap a unit | Selects its squad |
| Tap a landmark / enemy / ground | Sends the selection there |
| Tap a squad chip, or ARMY | Selects that squad, or everyone |
| Drag a squad chip onto the map | Sends that squad without finding it first |
| Double-tap a squad chip | Jumps the camera to that squad |
| Drag with one finger | Pans the map |
| Pinch / twist with two fingers | Zoom / rotate |
| Hold 0.3 s, then drag | Lasso-select |
| Hold a landmark | Rallies all idle units there |
| Hold an enemy | Shows what it is weak to |
| Pause button | Tactical pause (you can still give orders) |

#### Classic on a desktop (mouse and keyboard)

| Do this | And this happens |
|---|---|
| Left-click a unit / drag a box | Select (Shift adds; double-click selects that type on screen) |
| Left-click a landmark or enemy | Sends the selection there |
| Right-click | Order (Shift queues) |
| Right-drag, edge of screen, or WASD / arrows | Pan |
| Middle-drag, or Q / E | Rotate |
| Wheel | Zoom |
| 1–5 | Select a squad (press twice to jump there) |
| Ctrl+1–5 | Make the selection a squad |
| \` | Select the whole army |
| Z / X / C | Recruit ● / ▲ / ■ |
| F | Crew Call |
| B | Build at the hovered landmark |
| R | Set the rally point to the hovered landmark |
| S / H | Stop / hold |
| Space | Jump to the latest alert |
| Tab | Cycle through landmarks |
| U or Ctrl+Z | Undo the last order |
| P | Pause |
| Esc | Cancel, close a card, or open the menu |

Options has colour-blind colours, text size, reduced motion, left-handed layout, captions for sounds,
Assist mode, game speed and volumes.

## Develop

```sh
npm test                   # node --test: Hang Out rules, AI, tutorial scenes, 3D view; Classic nav, combat, ...
npm run check              # node --check every script
npm run test:browser       # headless Chromium smoke test of Classic (needs: npm i --no-save playwright)
npm run build:standalone   # single-file dist/square-off.html
npm run sim:batch -- --n 100   # Classic AI-vs-AI balance runs
node tools/hangout-lab.js travel|ladder|incumbent|checks   # the measurements behind DESIGN-V2.md
```

- `DESIGN-V2.md` is the spec of the default game (rules, map, tuning, AI, validation, interfaces);
  `DESIGN-RECOMMENDATIONS.md` is the brief it was built from. `DESIGN.md` is the Classic design and module plan
  (§12). Every tunable number is in `js/data/*.js` (Hang Out: `js/data/hangout.js`).
- `js/core/contracts.js` documents the match state, the `SQ.cmd` command API and all bus events.
- The code is classic `<script defer>` files attached to `window.SQ`. There are no modules and no bundler.
- **Headless rule:** `js/core`, `js/data` and `js/sim` never touch THREE or the DOM. That lets the whole
  simulation run in Node (`test/load.js`). The sim ticks at a fixed 20 Hz and is deterministic for a given seed.
- `js/geo.js` is generated from `data/raw/osm.json` by `tools/bake-osm.py`. Its coordinates are local meters:
  +x is east, +z is south, and the origin is at the fountain.
- `dev/env.html` is a standalone viewer for the 3D park. `dev/audio.html` is a test bench for every sound.
  `dev/hangout.html` plays a scripted Hang Out match through the 3D view without the HUD.

| Folder | What's in it |
|---|---|
| `js/core` | Namespace, seeded RNG, event bus, contracts |
| `js/data` | Hang Out (`hangout.js`: rules, spots, crews' groups and lines, AI levels, tutorial scenes); Classic units, factions, landmarks, maps, missions, events, text, nav overrides |
| `js/sim` | Hang Out rules (`hangout.js`) and AI (`hangout-ai.js`); nav grid and flow fields; Classic world, movement, combat, capture, economy, abilities, match, AI, director, campaign |
| `js/render` | three.js world (ground, buildings, landmarks, props, sky), the Hang Out view (`hangout-view.js`), Classic units and effects |
| `js/ui` | Camera, input, menus; Hang Out HUD and tutorial (`hangout-hud.js`, `hangout-tutorial.js`); Classic HUD and tutorial |
| `js/audio` | Procedural ambience, sound effects and adaptive busker music (Web Audio, no sample files) |

## Credits and licences

- **Map data** © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, available under the
  [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/). The park geometry in `js/geo.js`
  and `data/raw/osm.json` is derived from it.
- **[three.js](https://threejs.org/)** r158, © 2010–2023 three.js authors, [MIT License](https://github.com/mrdoob/three.js/blob/dev/LICENSE).
  It is vendored as `js/vendor/three.min.js`.
- **Fonts:** Barlow, Barlow Condensed and Caveat Brush come from Google Fonts (SIL Open Font License) and load
  online. Offline the game falls back to system fonts.
- All characters are archetypes, not real people. Washington Square Park is run by NYC Parks. This game is not
  affiliated with NYC Parks or NYU.
