# POWER CITY — The Midnight Rescue

A compact, free-play arcade brawler with a neon 1991 mood. One night, four
blocks, four bosses, and a brother to rescue. Solo or local two-player co-op.

Open `index.html`, press Enter, and go. `dist/power-city.html` is the complete
standalone game; `dist/power-city-artifact.html` adds a clickable cabinet panel.
No install, dependencies, external assets, or build step needed to play.

## Three buttons

| Action | Player 1 | Player 2 | Gamepad |
| --- | --- | --- | --- |
| Move | WASD or arrows | Arrows after joining | Stick / D-pad |
| Attack — hold for combos | Z / J | Comma / numpad 1 | X / square |
| Breakout — escape a crowd | X / K | Period / numpad 2 | B / circle |
| Jump kick — one press | Space / C / L | Slash / numpad 3 | A / cross |
| Start / join | Enter / 1 | 2 / numpad 0 | Start |

Esc pauses and shows controls. M mutes. F goes fullscreen. Touch devices get
three large buttons and a direction pad. Click or tap the title to start.

**Holding Attack is enough to learn.** You automatically chain punches into
a launching finisher and kick through raised guards. A small amount of aim
assistance forgives imperfect alignment. Walk toward the fight while holding
the button. Attack also picks up nearby weapons and throws carried objects;
a dizzy opponent can be thrown into their friends.

**Breakout is your escape.** When the gold meter is full, press X to knock
back enemies on both sides. It works while staggered or grabbed, costs no
health, and recharges over time and through ordinary hits. An empty meter
cannot trigger it. If grabbed without charge, hold Attack to struggle free.

**Jump is already a flying kick.** There is no second input to time. Move up
or down to change lanes. Orange floor warnings show incoming enemy attacks.
Food and coins collect on contact; food is saved until you need it. Weapons
drop when enemies are knocked down. Bosses commit to their big attacks:
change lanes to dodge, or spend Breakout to interrupt, then punish the recovery.

The opening introduces one opponent, a small crowd, and an ambush before the
boss. Later blocks mix weapons, heavy enemies, jumpers, and boss phases.
Clearing a fight restores a little health; each stage refills it. The clock
only pays a score bonus. Continues are free.

## The four blocks

- **Neon Row:** Lucky Star arcade, Video 88, an all-night diner, and Crusher.
- **Starlight Strip:** club doors, subway stairs, neon reflections, and Viper.
- **Dead End Docks:** cranes, freight shutters, wet boards, and Jaws.
- **Power Tower:** marble, gold, the city below the windows, and Mr. Power.

## Implementation

Plain JavaScript and Canvas, at 480×270 with a fixed 60 Hz simulation.
Characters are articulated poses baked into pixel sprites at startup. Shop
fronts are authored canvas compositions; backgrounds are baked per stage.
Music and effects are synthesized with Web Audio. Source scripts live in
`js/`: core/input, art/rig/cast, city, audio/music, actors/items/player/enemies,
stages, HUD, game flow, and touch controls.

```sh
node power-city/test/check.js       # data and asset-table validation
node power-city/test/runtime.js     # real combat and campaign regressions
python3 power-city/tools/build-single.py
```

`test/review.html` is a muted playtest desk with stage and boss selectors,
co-op join, a beginner demo, and visible state. It is not part of the shipped
game. `test/phone.html` previews portrait and landscape touch layouts.
The older Playwright telemetry tools remain in `tools/`, but their old
personas and conclusions in `PLAN.md` predate the simpler controls.

Runtime checks cover held combos, guards, escape from grabs, the Breakout
meter, jump kicks, buffered input, safe clock expiry, charge timing, co-op
collision, boss interruption, food collection, stage bonuses, the rescue
ending, and seeded solo/co-op campaigns. These are regression
checks, not proof of fun; visual inspection and actual input playtests still
matter.
