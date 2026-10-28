# STORTORGET

A friendly, fully local tower defence game set on the real streets around Stortorget in Malmö. Defend the Karl X Gustav statue against eight waves of cartoon danskjävlar.

## Play

### Mac

Open `index.html` in Safari, Chrome, or Firefox. There is no build step and no dependency installation.

For a local web server (and to play on your phone), run:

```sh
npm start
```

Then open **http://localhost:8080**. Node is only used for the tiny static server; the game itself also works from `file://`.

### iPhone

1. Connect the iPhone and Mac to the same Wi-Fi network.
2. Run `npm start` on the Mac.
3. The terminal prints an **On iPhone** address such as `http://192.168.1.20:8080`. Open that address in Safari.
4. Optionally use Safari’s Share button → **Add to Home Screen** for a full-screen shortcut.

If macOS asks whether Node may accept local network connections, allow it. No game data leaves the device.

## How to play

### American or Skånska

The intro screen (and the **US / SK** button in the header) switches between two editions. Each one renames everything and tweaks a few rules; switching during a run starts a new run.

| | 🇺🇸 American | Skånska |
|---|---|---|
| Statue | Some guy on a horse | Kalle på hästen |
| Defences | Freedom fry truck, Donut cannon, Slushie truck, Drive-thru coffee, Leaf blower | Falafelkiosken, Spiddekagakastaren, Glassbilen, Bärstältet, Skånsk blåst |
| Supersized | Towers reach 15% further, splash 20% wider and cost 20% more; the Danes have 25% more health and are bigger | — |
| Money | Every kill pays a 5–15% tip | A battered Dane hit by wind gives up, goes home *i rulleböre* and pays a 6 kr bridge toll on top of the bounty |
| Special | **Happy Hour**: five volleys of fireworks hit every attacker on the map | **Fika** lasts 7 s; wind pushes 30% further; a **Skånsk blåst** gust shoves every Dane back every 15 s |
| Pickup | Golden donut 🍩 | En bärs 🍺 |
| Units | feet and dollars | metres and kronor |

Locals shout back in mint-coloured bubbles — in Skånska that means *Ditt ålahue!*, *Bonnaröv!*, *Din klydderöv!*, *Jau grinar ihjäl mig!* and *Haur du sitt Malme? Nu haur du dä!*; in American, *Not today, Hamlet!* and *Supersize THIS!*. The Skånska copy, its spelling conventions and sources are collected in **[SKANSKA.md](SKANSKA.md)**. The edition is remembered per browser; first-time visitors with a Swedish browser start in Skånska.

### Both editions

- **Streaks pay.** Kills less than 1.35 s apart build a streak; every fifth kill in a row pays a bonus (5, 10, 15, 20, then 25 kr).
- **Golden pickups.** Every ninth kill drops a donut or a bärs. Tap it within seven seconds for 12 kr plus 2 kr per wave.
- **Canal splashes.** Danes who fall near the canals by Malmö Central go in with a splash.
- **Endless mode.** Winning all eight waves offers *Keep going — endless* / *Fortsätt — bron e öppen*: generated waves on every street, 16% tougher each time, with a boss every third wave. Each edition keeps its own record of waves cleared.

### Defences

Choose one of five defences, then choose a white build site on the map:

- **Falafel stand:** quick shots and 50% bonus damage against tanks and bosses.
- **Bun mortar:** heavy hits and splash damage against crowds.
- **Ice-cream van:** slows attackers so other towers have more time to fire.
- **Espresso cart:** boosts the fire rate of nearby attacking defences; only the strongest overlapping aura applies.
- **Öresund wind:** knocks attackers backwards along their route, with reduced effect on heavy enemies.

Tap a built defence to **upgrade** it twice or **sell** it. Espresso boosts appear as support links and a small gold marker on affected towers.

Attacks arrive along named, real streets. Route previews show which approaches the next wave uses; later waves merge from several directions. **Fika break** slows every attacker for five seconds and recharges during and between waves. Clearing a wave earns funds and repairs one statue health. Starting the next wave before the countdown ends earns an early bonus of up to 20 kr. There is no timer before wave 1.

Combat includes recoil, muzzle flashes, projectile trails, impact particles, damage numbers, explosion shockwaves, screen shake, kill streaks, and synthesized sound effects. Sound starts after the first user gesture, and reduced-motion preferences disable shake and heavy animation.

The attackers speak real Danish, and plenty of it. Stock lines per attacker type live in `js/levels.js`; `js/danish.js` adds about 150 more, drawn from shuffled bags so a pool plays through before anything repeats. The first Dane on each street comments on where they are, and there are separate pools for being slowed by ice cream, knocked back, blown by a gust, dazzled by Happy Hour fireworks, sent home over the bridge, falling into the canal, leaking onto the square and dying. A few lines answer the edition you chose.

The rivalry material:

- **History:** 1658 and the frozen Belts, Lund 1676 ("var uafgjort!" — it wasn't), the Kalmar Union, Ven and Tycho Brahe, Kristianstad named after Christian IV, Skåne, Halland and Blekinge.
- **Bron/Broen:** Saga Norén, Martin Rohde and the body on the border ("Halvt dansk, halvt svensk!"), Øresundstoget running late, the bridge toll.
- **Riget:** Stig Helmer screamed *Danskjävlar!* from the hospital roof; the boss answers "Danskjävlar? Ja tak!" and "Hils Helmer!".
- **Football:** Denmark won EM '92 in Gothenburg, in Sweden, without even qualifying. "Mål! Som i '92!", "Schmeichel tog den!".
- **Poking at Swedes:** Systembolaget, lagom, queuing, Volvo, the weaker krona ("Jeres kroner er legepenge!"), IKEA naming rugs after Danish towns ("Tørrer I fødderne på Danmark?").
- **How Swedes mock Danes, turned around:** the potato-in-the-mouth pronunciation ("Vi taler ikke med kartofler!"), the numbers ("Halvfems! Prøv at sige det!"), rødgrød med fløde.
- **Real Danish:** sgu, pyt, hold da op, hold da helt ferie, puha, av for pokker, øv bøv, skidegodt (Olsen-banden's Benny, along with Egon's "Jeg har en plan!"), hygge, guf and flødebolle on the soft ice.

A tiny phrasebook (taunts, not historical claims):

- **Skåne er dansk!** — "Skåne is Danish!"
- **Jeres kroner er legepenge!** — "Your kronor are play money!"
- **Lund 1676 var uafgjort!** — "Lund 1676 was a draw!"
- **Hold da helt ferie!** — "Take a whole holiday!", i.e. "Holy cow!"
- **Pyt med det!** — "Never mind!"
- **Vi taler ikke med kartofler!** — "We don't talk with potatoes!"

**Controls:** drag to pan; pinch or scroll to zoom; use the map buttons to zoom or fit the whole neighbourhood. Keyboard shortcuts: `1`–`5` select defences, `F` activates fika, `P` pauses, `Space` starts the next wave, and `0` refits the map. The header also provides pause, 2× speed, sound, and help controls.

## Map and design

The bundled map covers approximately 800 × 680 metres around Stortorget, including Lilla Torg, Malmö Central, Norra Vallgatan, Gustav Adolfs torg, Södergatan, and Djäknegatan. Six hand-traced routes follow the streets and enter the square along its pedestrian diagonals. Fixed pavement sites avoid path-blocking and make placement reliable on touchscreens.

Map image: **© OpenStreetMap contributors**, rendered from the OSM Standard tiles at zoom 16 and cropped to `55.6022–55.6094° N, 12.9950–13.0058° E`. Map data is available under the [Open Database License](https://www.openstreetmap.org/copyright). The statue marker uses coordinates `55.6061333, 13.0002444`. The game and all map assets run locally with no tile requests or API keys.

## Development

Plain JavaScript, HTML, Canvas 2D, and CSS. No runtime dependencies.

- `js/levels.js` — map geometry, routes, build sites, unit statistics, enemy personalities, and waves
- `js/engine.js` — deterministic simulation, economy, combat, support/control effects, telemetry, and win/loss rules
- `js/ui.js` — DPR-aware renderer, animation, sound, speech, input, and interface
- `test/engine.test.js` — dependency-free mechanics and complete-game regression tests
- `tools/personas.js` — seeded utility-driven synthetic players and cloned content scenarios
- `tools/balance-lab.js` — balance matrix, aggregates, and findings CLI
- `test/personas.test.js` — persona determinism, diversity, viability, and telemetry tests
- `test/browser-smoke.cjs` — optional real-browser UI, combat-effect, and mobile checks

```sh
npm run check
npm test
```

- `js/text.js` — interface copy for the American and Skånska editions

Mode rules live in `MODES` in `js/levels.js`; `applyMode` derives a mode's towers, attackers, wave names and config without mutating the shared content, and `new Game({ mode })` uses it. Tips are a hash of the attacker id, so every mode stays deterministic.

The game simulation runs at 60 fixed steps per second and is independent of the renderer, so complete games can be tested quickly in Node.

## Balance lab

```sh
# Six personas × four scenarios (24 complete games)
npm run balance

# Three deterministic seeds per cell (72 complete games)
npm run balance:deep

# The same matrix under each edition's rules
npm run balance:american
npm run balance:skanska

# Focus a particular player/content combination
node tools/balance-lab.js --persona warden --scenario fortified --seed 42

# Machine-readable runs, per-wave records, aggregates, and findings
node tools/balance-lab.js --deep --json
```

The lab compares six utility-driven play styles across baseline, higher-HP, denser-spawn, and lower-starting-funds variants. It reports wins, wave progress, leaks, fika use, early income, tower spending/damage/shots, support coverage, and wave spikes. See **[BALANCE.md](BALANCE.md)** for the model, metrics, research links, and limitations.

The design is inspired by [Automated Playtesting with Procedural Personas through MCTS with Evolved Heuristics](https://arxiv.org/abs/1802.06881) and [Talakat](https://arxiv.org/abs/1806.04718). These are lightweight deterministic heuristics, not MCTS or MAP-Elites. They are regression and investigation tools, not proof of human difficulty or fun.

## Browser smoke tests

The optional browser runner checks direct-file launch, construction and upgrades, a complete first wave, all eight waves through victory and restart, combat effects, espresso/wind mechanics, Danish speech, explosion shake, shake-aligned placement, and two mobile viewports with touch placement and pinch zoom.

```sh
npm install --no-save playwright
npx playwright install chromium
npm run test:browser
```

Playwright is only a development/test dependency; it is not needed to play or run the unit/balance suites. Screenshots default to the system temporary directory. Set `STORTORGET_SCREENSHOTS` to choose another output directory.
