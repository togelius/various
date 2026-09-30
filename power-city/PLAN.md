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