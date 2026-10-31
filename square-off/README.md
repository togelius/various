# SQUARE OFF

*A single-player real-time strategy game set in the real Washington Square Park, NYC.*
**Five minutes, five dollars, the whole park.**

Four crews fight over the park's real landmarks: the Hustle (chess hustlers), the Noise (buskers), the Violets
(NYU students) and the Pack (dog people). Units have Composure instead of HP and nobody gets hurt. At zero a unit
is *Over It* and walks out of the park ("I'm going to Think Coffee").

The park is built from OpenStreetMap data: 346 real building footprints with heights, 417 trees, 399 benches,
147 lamps, the Arch, the Fountain and the fenced dog runs.

## Run it

- **Easiest:** double-click `index.html`. It runs from `file://` with no build step and no server.
- **Single file:** run `npm run build:standalone`, then open `dist/square-off.html`. You can copy, mail or host that
  one file anywhere.
- **On your phone:** run `npm start`, then open `http://<your computer's IP>:8080` on a phone on the same Wi-Fi.
  Add it to the home screen for full screen.

On first launch the game goes straight into Mission 1, a two-minute tutorial. After that you land on the title
screen with the Campaign (6 missions), Quick Play, Skirmish (up to 4 crews and 6 maps), the Daily Park, the Field
Guide and Options. Quick Play is against a Chill AI until you have beaten Mission 3, and against a Regular AI after
that.

Optional URL flags:

| Flag | What it does |
|---|---|
| `?quick` | Quick Play right away (add `&crew=pack`) |
| `?skirmish=1&faction=hustle&opp=noise&diff=hard&map=whole&opponents=3` | A specific skirmish |
| `?title` | Show the title screen, even on first launch |
| `?q=low\|med\|high` | Force a graphics tier (normally picked automatically and lowered if frames are slow) |
| `?nointro` | Skip the opening camera flight |
| `?start=night` | Start the match at Golden Hour or Night |

## How to play

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

### Phone (touch)

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

### Desktop (mouse and keyboard)

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
npm test                   # node --test: nav, combat, capture, economy, determinism, match, AI, campaign, world
npm run check              # node --check every script
npm run test:browser       # headless Chromium smoke test (needs: npm i --no-save playwright)
npm run build:standalone   # single-file dist/square-off.html
npm run sim:batch -- --n 100   # AI-vs-AI balance runs
```

- `DESIGN.md` is the full design and module plan (§12). Every tunable number is in `js/data/*.js`.
- `js/core/contracts.js` documents the match state, the `SQ.cmd` command API and all bus events.
- The code is classic `<script defer>` files attached to `window.SQ`. There are no modules and no bundler.
- **Headless rule:** `js/core`, `js/data` and `js/sim` never touch THREE or the DOM. That lets the whole
  simulation run in Node (`test/load.js`). The sim ticks at a fixed 20 Hz and is deterministic for a given seed.
- `js/geo.js` is generated from `data/raw/osm.json` by `tools/bake-osm.py`. Its coordinates are local meters:
  +x is east, +z is south, and the origin is at the fountain.
- `dev/env.html` is a standalone viewer for the 3D park. `dev/audio.html` is a test bench for every sound.

| Folder | What's in it |
|---|---|
| `js/core` | Namespace, seeded RNG, event bus, contracts |
| `js/data` | Units, factions, landmarks, maps, missions, events, text, nav overrides |
| `js/sim` | Nav grid and flow fields, world, movement, combat, capture, economy, abilities, match, AI, director, campaign |
| `js/render` | three.js world (ground, buildings, landmarks, props, sky), units, effects |
| `js/ui` | Camera, input, HUD, menus, tutorial |
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
