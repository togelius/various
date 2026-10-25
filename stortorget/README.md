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

- Select **Falafel stand**, **Bun mortar**, or **Ice-cream van**, then choose a white build site on the map.
- Falafel fires quickly, buns damage groups, and ice cream slows attackers.
- Tap a built defence to **upgrade** it twice or **sell** it.
- Attacks arrive along named, real streets. Route previews show which approaches the next wave uses; later waves merge from several directions.
- **Fika break** slows every attacker for five seconds. It recharges during and between waves.
- Clearing a wave earns funds and repairs one statue health. Starting the next wave before the countdown ends earns an early bonus of up to 20 kr.
- There is no timer before wave 1. You can also pause or switch to 2× speed at any time.

**Controls:** drag to pan; pinch or scroll to zoom; use the map buttons to zoom or fit the whole neighbourhood. Keyboard shortcuts: `1`–`3` select defences, `F` activates fika, `P` pauses, `Space` starts the next wave, and `0` refits the map.

## Map and design

The bundled map covers approximately 800 × 680 metres around Stortorget, including Lilla Torg, Malmö Central, Norra Vallgatan, Gustav Adolfs torg, Södergatan, and Djäknegatan. Six hand-traced routes follow the streets and enter the square along its pedestrian diagonals. Fixed pavement sites avoid path-blocking and make placement reliable on touchscreens.

Map image: **© OpenStreetMap contributors**, rendered from the OSM Standard tiles at zoom 16 and cropped to `55.6022–55.6094° N, 12.9950–13.0058° E`. Map data is available under the [Open Database License](https://www.openstreetmap.org/copyright). The statue marker uses coordinates `55.6061333, 13.0002444`. The game and all map assets run locally with no tile requests or API keys.

## Development

Plain JavaScript, HTML, Canvas 2D, and CSS. No runtime dependencies.

- `js/levels.js` — map geometry, routes, build sites, unit statistics, and waves
- `js/engine.js` — deterministic fixed-step simulation, economy, combat, and win/loss rules
- `js/ui.js` — DPR-aware canvas renderer, input, sound, and interface
- `test/engine.test.js` — dependency-free rules and balance regression tests

```sh
npm run check
npm test
```

The simulation runs at 60 fixed steps per second and is independent of the renderer, so complete games can be tested quickly in Node.
