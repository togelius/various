# Deterministic balance lab

This harness uses synthetic players to smoke-test tower, wave, and economy balance. It is designed for fast comparisons while editing content: run the same personas and seed before and after a change, then inspect trends in outcomes, leaks, and tower use. It does **not** establish that the game is fun or that its difficulty is right for humans.

## Commands

Run from `stortorget`:

```sh
# Six personas × four scenarios, one seed per cell (24 games)
node tools/balance-lab.js

# Three seeds per cell (72 games); seed, seed + 1, and seed + 2
node tools/balance-lab.js --deep

# Focus a run and choose its base decision seed
node tools/balance-lab.js --persona architect --scenario baseline --seed 42

# Full runs, per-wave records, aggregates, and findings as JSON on stdout
node tools/balance-lab.js --json --deep

# Under an edition's rules: classic (default), american, or skanska
node tools/balance-lab.js --mode american --deep

# Harness regressions
node --test test/personas.test.js
```

Valid persona IDs are `allrounder`, `rookie`, `striker`, `warden`, `architect`, and `sprinter`. Valid scenario IDs are `baseline`, `fortified`, `rush`, and `lean-start`. The CLI has no dependencies and does not write report files.

## Editions

`--mode` runs every persona under the American or Skånska rule tweaks (see `MODES` in `js/levels.js`); `classic` is the shared content with no tweaks, which the unit tests use. Streak payouts and golden pickups apply in every mode, but personas never tap pickups, so simulated income from pickups is zero.

Deep runs (72 games per mode, base seed 7) when the editions were introduced:

| Persona | Classic win | American win | Skånska win |
|---|---|---|---|
| allrounder | 100% | 100% | 100% |
| rookie | 8% | 17% | 17% |
| striker | 100% | 100% | 100% |
| warden | 42% | 100% | 42% |
| architect | 100% | 100% | 100% |
| sprinter | 100% | 100% | 100% |

American is the forgiving edition: Happy Hour's fireworks clear crowds, which rescues the cautious warden, even though towers cost 20% more and the Danes have 25% more health. Tips average about 300 kr per game. Skånska plays close to classic; the warden, the persona that buys wind, sends about five Danes home per game. The personas rarely buy wind, so the lab undersells the Skånska wind bonus for players who like it.

## Player model

Each game uses the real CommonJS engine with a fixed 0.1-second step and a 900-simulated-second guard. A `timeout` result is therefore distinct from an engine win or loss. Purchases are planned at the start and during intermissions; agents do not sell or make mid-wave purchases.

At each planning point, an agent scores **every affordable tower-type/build-pad combination and upgrade**. It does not replay a build order. The lightweight utility estimate includes:

- sampled route exposure, extra exposure near the statue, and coverage of the next and upcoming routes;
- raw damage and fire rate, splash opportunities from the next wave's composition, slows, and knockback;
- existing control allies, actual espresso aura ranges, supported ally DPS, and support upgrades;
- purchase cost, cash reserve, repeated-type and overlapping-control diminishing returns, and upgrade value;
- persona-specific utility and tower preference weights.

`strategy` controls planning horizon and residual evaluation error. Seeded decision noise perturbs utility scores rather than engine combat. `reaction` controls how often an agent reassesses fika and early calls. Each persona also has an early-call preference, purchase cap, reserve, and fika threat threshold. Thus strategy and reaction can change purchases, fika timing, income, and survival.

The six archetypes are:

- **Allrounder:** competent baseline with balanced damage, coverage, economy, and upgrades.
- **Rookie:** noisy short-horizon choices, one purchase per planning point, slow reactions, and a large reserve.
- **Striker:** damage/splash emphasis, concentrated upgrades, fast reactions, and nearly immediate wave calls.
- **Warden:** cautious late calls with strong slow, knockback, coverage, and statue-safety weights.
- **Architect:** longer planning horizon with strong espresso, synergy, and upgrade utilities.
- **Sprinter:** quick but imprecise decisions, little economic caution, and aggressive wave calls.

Decision and cosmetic random streams are independently derived from the integer seed and persona ID. The cosmetic stream only selects the ignored-in-analysis `flair` field; it cannot affect play. There is no `Math.random()` in the harness. Identical persona, content, seed, and step inputs produce identical results and decision logs.

## Content scenarios

`createScenarioLevels()` recursively clones level data before applying modifiers. Routes retain their prepared points, segments, and lengths. The engine may continue to use the canonical module's `pointOnRoute(route, distance)` for geometry; it operates on the supplied prepared route. Neither scenario creation nor simulation mutates `js/levels.js`.

- **baseline:** canonical content.
- **fortified:** multiplies every wave's `hpScale` by 1.25.
- **rush:** multiplies group `at` and `every` by 0.75, shortening delays and increasing spawn density.
- **lean-start:** sets starting funds to 180 kr.

Custom scenario objects use the same `enemyHpScale`, `spawnTempo`, and optional `startingMoney` fields. A prebuilt custom level object can instead be passed directly:

```js
const { runPersona, createScenarioLevels } = require("./tools/personas.js");

const custom = createScenarioLevels({
  id: "local-experiment",
  enemyHpScale: 1.1,
  spawnTempo: 0.9,
  startingMoney: 210,
});
const result = runPersona("warden", { levels: custom, seed: 9, decisionLog: true });
```

## Metrics and findings

`runPersona()` returns the outcome, reached/completed waves, health, kills, leaks and leak damage, funds and elapsed time, fika uses, early-call income, total damage/shots/knockback, and damage/shots/spending by tower type. Tower telemetry includes final pads, levels and investment, per-type counts, and level lists. Aura checks are exposed as `supportedTowers` and `maxFireRateMultiplier`.

`perWave` records early bonus, kills, leaks, leak damage, health, funds, duration, tower count, and a cleared/lost/timeout outcome. Pass `decisionLog: true` for compact build, upgrade, fika, and wave-call decisions. The JSON CLI includes complete run records plus persona, scenario, persona/scenario-cell, and wave aggregates.

Human output emphasizes:

- win rate, average wave reached and remaining health;
- leaks, leak damage, fika use, early income, and tower counts;
- leading tower by historical spending and its share;
- waves with high average leak damage or losses;
- possible opening walls, unused tower types, and spending concentration above 45%.

A one-seed cell can only report 0% or 100% wins. Use `--deep` or several explicit seeds before treating a difference as stable. Wave averages include only runs that reached that wave, so late-wave results have a survivorship bias. Spending share measures these agents' preferences, not tower power by itself.

## Research inspiration

- Holmgård, Green, Liapis, and Togelius, [Automated Playtesting with Procedural Personas through MCTS with Evolved Heuristics](https://arxiv.org/abs/1802.06881) (2018), uses archetypal synthetic players and varied utility/decision criteria for automated content evaluation. Its implementation uses MCTS with evolved node-selection heuristics. This lab borrows the idea of comparing distinguishable play styles, **not** that search algorithm.
- Khalifa, Lee, Nealen, and Togelius, [Talakat: Bullet Hell Generation through Constrained MAP-Elites](https://arxiv.org/abs/1806.04718) (2018), evaluates generated content through simulation with agents tunable along strategy and dexterity. This lab borrows simulation-based evaluation and skill parameters, **not** Talakat's best-first agent, constrained MAP-Elites, or content generator.

## Limitations

These are deterministic utility-weighted heuristic agents, not human players, MCTS, evolutionary computation, or MAP-Elites. The scenarios are a few hand-authored content variants, not a searched content space. “Reaction” is a decision polling interval, not motor dexterity, and the planners have exact statistics and upcoming-wave information.

The same utility approximations can systematically overvalue or undervalue a mechanic. For example, heavy simulated spending on one tower may reveal genuine dominance, a flawed splash estimate, or both. Restricted intermission-only buying and the absence of selling also omit real player strategies. Fixed-step results can differ at another step size, and a few decision seeds cannot characterize human variance.

Use the lab to find regressions, impossible openings, sharp wave spikes, neglected mechanics, and robust differences between content versions. Confirm important changes with alternative policies, engine-level mechanics tests, and human playtesting. Trends are evidence for investigation, never proof of fun, fairness, or human difficulty.
