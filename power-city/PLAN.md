# POWER CITY — improvement plan

## What the agents found (baseline, before changes)

Four bot personas played the game headlessly with full telemetry:
**masher** (button-mashing casual), **walker** (simple seek-and-punch),
**brawler** (uses combos, dodges, grabs, items), **runner** (speedrun-minded).
Key numbers from ~25 recorded runs:

| finding | number |
| --- | --- |
| Masher deaths by clock timeout | 30 of 30 — every single one |
| Hits taken from behind (brawler/runner) | 77–84% |
| Playtime spent on the floor (skilled bots) | 18–23% |
| Hits taken within 0.5s of standing up | up to 34 per run |
| Enemy time spent walking in circles | 53–63% |
| Enemy time spent actually attacking | 4.5–19% |
| Longest boss fight | 330 seconds (VIPER) |
| Downtime (nothing to fight within 90px) | 17–33% |
| Hearts found per full campaign | 1–3 |
| Jump-kick land rate | 9.7% |
| Dumb walker-bot campaign deaths | 3, zero continues |

## Diagnosis

1. **The clock is the real final boss.** `timeUp` deals 999 damage to
   everyone. A casual player cannot clear an encounter inside 125 seconds,
   so they die over and over to an invisible killer, restart, and learn
   nothing.
2. **The gang flanks like it's their job.** 45% of idle decisions send
   enemies on cross-overs; enemies spawn behind you; the player has no
   off-screen indicators and no auto-face on being hit. Three quarters of
   all damage arrives from behind.
3. **Knockdown economy is broken.** Nearly every enemy move knocks down,
   the player has no poise, and the floor is not safe: you can be hit while
   down (rare, but it happens) and almost half of all knockdowns are
   punished with a hit within half a second of getting up.
4. **Enemies are polite to a fault.** Two attack tokens, long think timers,
   long attack cooldowns, 40–54 frame lie-downs, retreat-intent bosses. The
   gang circles you like a weather system. Fights stretch to 45–330 seconds.
5. **Bosses are HP walls.** No phases, no patterns worth learning, armor
   that eats combos, knockback resistance that makes the hook finisher feel
   like a love tap. VIPER retreats 40% of the time and keeps away longer
   than most players' patience.
6. **The street is dead.** A heart or two per stage, coins that the stage
   data never spawns, crates nobody lifts, weapons the winners never pick
   up. Nothing to break, nothing to find.
7. **The move list is bait.** Jump kick lands 9.7%, high kick 8%, and the
   rest of the vocabulary is strictly worse than walking forward and
   pressing punch — which is exactly what the winning bot does.

## The plan

Six phases, each verified by re-running the agents and comparing telemetry.

### Phase 1 — Fairness first
- Clock: at zero it drains health (with klaxon + flashing) instead of
  instakill; encounters and kills give small time back; boss fights get
  their own generous clock.
- Knockdowns: light hits stagger the player, only heavies (big damage,
  launches, boss moves, throws, explosions) knock them down; the player is
  invulnerable while down and for a beat after getting up; wake-up hits
  become impossible.
- Rear defense: taking a hit turns the player to face the attacker; arrows
  at the screen edges mark off-screen enemies; enemies spawning behind are
  not allowed to attack until they have been on screen a moment.
- Spawn-in telegraph: new enemies walk in with a brief "!" instead of
  popping into existence mid-swing.

### Phase 2 — A gang that fights
- Attack tokens scale: 2 base, +1 at four enemies on screen, +1 in later
  stages, +1 with two players.
- Faster brains: shorter think/cooldown timers, more approach intent, less
  orbiting; enemies get up sooner; fewer polite retreats.
- Waves come thicker and faster: shorter spawn delays, larger caps, more
  simultaneous enemies — but spaced so the screen never floods.
- Enemy HP tuned so a combo means something; trash dies faster, heavies
  still require work.

### Phase 3 — Bosses worth beating
- HP, armor and knock-resistance cut to honest sizes (no 330-second
  fights).
- Phase changes at 2/3 and 1/3 health: new moves, faster, a roar that
  announces the turn, the music knows about it.
- VIPER redesigned as a rushdown duelist, not a keep-away slog; JAWS and
  MR. POWER gain readable signature moves with real telegraphs.
- Boss bar with phase ticks; last sliver of boss health triggers a finish
  flourish.

### Phase 4 — A street worth walking
- Enemy drops: weapon-carriers drop their weapon when floored; random
  enemies drop hearts/coins/sometimes a weapon on death; crates and drums
  scattered through every encounter.
- Breakables: hydrants, trash cans, mailboxes that smash into loot and
  score.
- Encounter variety: rush waves, rear ambushes (with warning), no-lock
  drop-in fights, boss escorts re-choreographed, item rain on clears.

### Phase 5 — A move list worth learning
- Kick/jump-kick/high-kick frame data fixed until they earn their buttons;
  uppercut lunges; every move has a use the agents can discover.
- Combo counter with escalating popups; hit-from-behind indicator; KO
  slow-mo flourish on the last enemy of a wave.
- Slightly faster walk/run; snappier camera.

### Phase 6 — Regression
- All personas re-run; targets:
  - masher survives a stage without clock deaths; dies to the gang, if at
    all, in visible fights;
  - brawler/runner: hits from behind < 35%, floor time < 8%, wake-up hits
    ≈ 0;
  - enemy attack share > 25%, downtime < 15%;
  - every boss 20–45 seconds for a competent player;
  - walker can still clear the game — it is the floor, not the ceiling;
  - move usage spread across at least 6 moves for the skilled bot;
  - hearts/coins/weapons found: dozens per campaign, not ones.
- `test/check.js` extended for every new table; dist rebuilt.

## Results (same bots, same seeds, before → after)

Twenty recorded campaigns per build (4 personas × 5 starting points), both
sides measured by the same fixed harness:

| metric | before | after |
| --- | --- | --- |
| wake-up hits (all 20 runs) | 35 | **0** |
| hits while on the floor (all 20 runs) | 21 | **0** |
| masher deaths per run | 5, clock instakills | 3, real fights |
| masher damage taken per run | ~500 (999-dmg clock hits) | 55–187 |
| VIPER, longest fight | 92 s | 30–62 s (typically ~25 s) |
| hearts per campaign | 1–3 | 6–9 |
| weapons per campaign | 3–10 | 10–18 |
| skilled-bot move usage | jab-spam; jump kick lands 9.7% | 12 moves, land rates 89–108% |
| throws per campaign (skilled bot) | ~12 | ~50 |
| walker campaign deaths | 2–3 | 2–3 (still clears) |
| co-op | untested | recorded campaign, no crashes, bosses 25–30 s |

Not met, with reasons:

- *hits from behind < 35%:* 74–77% for the two dodging bots, 14–21% for the
  bot that keeps facing the crowd. The bots that turn their backs get hit in
  the back; the game-side mitigations (edge chevrons, rear flash, spawn
  guards, flank reduction) are in and the aggressive-stander shows the real
  number.
- *enemy attack share > 25%:* settled at 11–14% with double the attacks per
  fight. The share is bounded by approach time; the felt pressure is the
  always-held tokens plus reinforcement waves.
- *downtime < 15%:* 23–30%, which for this genre is the stroll between
  fights - now textured with litter, trash cans and drive-by chases.

## The look (added after the gameplay pass)

`tools/visual-audit.js` renders every stage with and without the actors
and measures what an eye would care about. Baseline: readable (figure-ground
contrast ~70/255, 41% pure-black keyline pixels) but static and grey —
POWER TOWER ran 103 distinct colours a frame, and nothing on the street
moved but the fighters.

The art pass: rain on the docks and drizzle downtown, dust in the alley,
embers on the tower; pulsing skyline beacons; breathing, cutting-out neon;
drifting clouds behind the skyline; a silhouette near-lane (lamp posts,
hydrants, signs) scrolling faster than the camera; a per-neighbourhood colour
gade — tint under the fighters so their keylines stay black, vignette over
the whole picture; and an eight-frame walk cycle blended from the keyframes.

Measured after:

| metric | before | after |
| --- | --- | --- |
| figure-ground contrast (mean) | 70.3 | 69.6 (held) |
| pure-black keyline share | 41.2% | 41.2% (held) |
| distinct colours per frame (mean) | 157 | **754** |
| POWER TOWER colours | 103 | **986** |
| moving elements per stage | 0 | weather, beacons, neon, clouds, near-lane |
| walk cycle | 4 frames | 8 blended frames |
## Second pass: fix the instrument, then play well, feel right, look sharp

### The instrument was lying

The "skilled" brawler bot walked away from every swing — walking sets
facing — so it died four times as often as a bot that just walks up and
punches, and every conclusion drawn from it was suspect. Rewritten with a
human reaction delay, the crowd kept in front, lane slips instead of
retreats. Runs became seeded, bots got their own random generator and
cosmetics a third, so two builds now face literally the same fights.

### What the honest instrument found (5 seeds × full campaign)

1. **The jump kick was the whole game.** A bot that did nothing else
   cleared every seed without dying, taking half the damage of the brawler.
2. **The difficulty ramp was wired backwards** — the damage multiplier
   scaled damage enemies *took*: stage-one thugs soaked 1.4× and nobody
   ever hit harder.
3. Armed players could not pick up food. Dizzy happened 0.7× a campaign.
   Wind-ups showed the strike pose, so nothing was readable.

### Fixes, and what they bought

| | before | after (3 seeds, same fights) |
| --- | --- | --- |
| jump-kick-only bot | 0 deaths, best of all | 2 deaths, worst skilled bot |
| brawler deaths / campaign | 13 (bot bug) → 0.6 | 0.7 |
| walker deaths / campaign | 3.4 | 2.0, now losing lives from stage 2 |
| runner deaths / campaign | 1.6 | 1.3 |
| co-op (walker + brawler) | softlocked one seed for 10 min | 3/3 clear, 0.3 deaths |
| errors | 0 | 0 |

New fight: **counters** (hit a big wind-up → dizzy), a **guard** on the
tougher thugs (jabs clink off; kicks, heavies, weapons, grabs break it),
**bowling** (thrown bodies knock over who they hit), five anticipation
poses, jump-kick landing lag, quick thugs side-stepping jump-ins.

### Feel

Driving the live loop with real key events found presses lost three ways:
during hit-stop (when everyone mashes), in the gap between a hit landing
and recovery ending, and when a release and re-press fell between polls.
Buttons are now latched every frame, follow-ups queued, keydown edges
counted. Counters, blocks and guards got their own sounds; score pops stack.

### Look

`tools/visual-audit.js` found the picture soft: a fifth of neighbouring
pixel pairs were near-duplicates, from a full-screen gradient vignette and
a translucent colour grade over hard pixel art. Both went; the palettes
carry the mood. Brick re-laid on a global grid with dark mortar, sprayed
graffiti, bevelled body parts and scowls on the cast, puddles instead of
pink boxes, pixel-crisp dithered clouds, and POWER TOWER rebuilt from a
pastel window quilt into the penthouse its title card promises: black
marble, gold trim, an elevator stopped at 88, Mr Power's portrait, the
city lit up far below the glass and mirrored in a polished floor.

| | before | after |
| --- | --- | --- |
| soft (near-duplicate) pixel pairs, mean | 21.3% | **4.2%** |
| figure-ground contrast, mean | 67.2 | 69.4 (held) |
| distinct colours per frame, mean (no vignette) | 210 | **523** |
