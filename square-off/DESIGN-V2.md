# Square Off v2: "Hang Out"

Date: 2026-10-31. Status: implemented and the default game: rules, AI, lab and tests (this document), plus the 3D view
(`js/render/hangout-view.js`), HUD (`js/ui/hangout-hud.js`) and tutorial (`js/ui/hangout-tutorial.js`); §10 lists
the presentation decisions.

This is the concrete spec of the new default game, built from the brief in
[DESIGN-RECOMMENDATIONS.md](DESIGN-RECOMMENDATIONS.md) (Round 3), and the measurements behind every number.
The classic RTS in [DESIGN.md](DESIGN.md) is unchanged and stays reachable as "Classic".

| File | What it is |
|---|---|
| `js/data/hangout.js` | Every tunable, the 5 spots, entrances, crews (named groups and lines), Park Report lines, AI difficulties, tutorial scenarios |
| `js/sim/hangout.js` | The rules: `SQ.Hangout` (headless, deterministic, 20 Hz) |
| `js/sim/hangout-ai.js` | The AI: `SQ.HangoutAI` (plays only through `match.order`) |
| `tools/hangout-lab.js` | The lab: travel times, AI ladder, the incumbent-dominance test, checks |
| `test/hangout.test.js` | 16 tests: rules, edge cases, determinism, AI, scenarios, the incumbent property |

## 1. The game in five sentences

1. Each crew has three named groups; tap a group, then tap a spot (or the ground).
2. A group that stands at an empty spot for 3 quiet seconds is **hanging out** there: its crew gets +1 point a second.
3. Rival groups at the same spot **argue**: each rival drains your **patience**. You keep earning while you argue.
4. At zero patience a group **goes for coffee**, comes back through its entrance 15 seconds later and walks back
   to its spot (unless it was given another order meanwhile).
5. Most points when the 5:00 clock runs out wins.

The goal line for the UI: *"Your crew earns by hanging out somewhere. The other crew has to make it leave."*
Vocabulary (in `SQ.data.hangout.vocab`): spot, hanging out, settling in, arguing, patience, went for coffee,
back in 0:12, points. No Clout, Turf, Sway, pop, perks, counters or setups.

## 2. Rules, exactly (`SQ.data.hangout.rules`)

| Rule | Value | Notes |
|---|---|---|
| Match length | 300 s | A 5:00 countdown. `length: 0` = untimed (tutorials) |
| Groups per side | 3 | Persistent. 4 to 6 people each, drawn by render (cosmetic) |
| Walking speed | 4.5 m/s on paths | Lawn x0.77, fountain basin x0.56, beds x0.33 (= 10 / nav cost, so flow-field distance / 4.5 is the exact walking time) |
| Settling in | 3 s | An arrived (standing) group at a spot nobody holds, with no rivals there |
| Points | 1 per second per spot held | Two of your groups at one spot still earn 1 |
| Patience | 100 | One bar per group |
| Drain | 9/s per rival group at your spot | 1 v 1 lasts 11.1 s; the single group in a 2 v 1 lasts 5.6 s while each of the two loses 50 |
| Recovery | 4/s | Whenever nobody is arguing with you (walking, standing anywhere, hanging out alone) |
| Coffee break | 15 s | Then back at its entrance with full patience |
| After coffee | walks back to the last spot it was sent to | Orders given during the break are queued and used instead |
| Ties | the holder stays | The one change from the brief, §5 |
| Patience floor | off | `rules.patienceFloor` (a number, or one per side): arguing never drains below it. Tutorial only: lessons 5-7 hold an argument still until the player acts |

Edge rules:

- **Being at a spot** = inside its circle (or fence) *and* sent there. Walking through a spot on the way
  elsewhere is not being there. Tapping the ground inside a spot is an order to that spot.
- **Earning** starts when settling completes and stops the tick the last group of that crew is ordered away
  or goes for coffee ("departure immediately stops earning").
- **Arguments** happen only between groups at the same spot. Each group loses 9/s for each rival group
  there. Arguing does not stop movement or earning.
- **An established occupant keeps earning** while argued with, until it leaves or goes for coffee.
- **Claiming an empty spot together:** nobody settles while two crews are there; the one that remains
  settles (3 s from zero).
- **Ties:** when everybody at a spot runs out of patience at the same moment, the crew that was hanging out
  there stays (at 1 patience) and only the others go for coffee. At a spot nobody held, everyone leaves.
- **Withdrawal** is just an order elsewhere; it is counted (Park Report, AI) when the group had patience left.
- **End:** at 0:00 the higher whole-number score wins; equal = draw (`winner: -1`).
- No economy, no recruitment, no events with effects, no faction differences: crews are presentation only.

## 3. The map: five spots, two entrances (chosen by measurement)

Spots were searched over the 13 classic landmarks plus GEO points, for pairs of real entrances, scoring
mirror symmetry of walking times (an involution of the five spots) and spacing; then hand-adjusted by
measuring actual walks until the races that decide fights were even.

| Spot | Where (GEO m) | Area | Why it is there |
|---|---|---|---|
| Toddler Playground | (-46, -52), r 7 | circle at the playground gate | North's near spot. The fenced interior was 2.8 s farther from Fifth Ave than the Dog Run is from Thompson St |
| Holley Plaza | (-64, 0), r 11 | circle | The plaza between the Holley bust and the Fountain; at the bust it was 2.4 s farther from the Fountain than Garibaldi |
| The Fountain | (0, 0), r 17 | circle (standing places on the rim, r 13) | The middle. Exactly as far from both entrances |
| Garibaldi | (61, -6), r 11 | circle (statue inside) | Mirror of Holley |
| Small Dog Run | (31.5, 62.5) | the real fence | South's near spot; one gate on the Kempner side |

Entrances: **north = Fifth Avenue under the Arch (0, -73)**, **south = Thompson Street (-12, 70)**; for 3-4 players
also west (West Washington Pl) and east (Washington Pl). Each crew's three standing places at a spot are
about 3.5 m apart on the side facing its own entrance, so rivals face each other. They are chosen in turn (every
crew's first place, then every crew's second, ...) and each keeps at least 2.2 m from every place already taken
(1.75 m with four crews): two crews' fallback places used to coincide at Garibaldi and the Small Dog Run. The
measured walking times below did not change.

One name per spot everywhere (signs, tags, cards, messages, Park Report): `name` on the sign, `short` without
"The", `the` in a sentence ("at the Toddler Playground").

Measured walking time (s) until a group is *at* the spot (best of the crew's three groups for the entrances;
`node tools/hangout-lab.js travel`):

| from \ to | Toddler | Holley | Fountain | Garibaldi | Dog Run |
|---|---:|---:|---:|---:|---:|
| north entrance | 10.0 | 23.0 | 12.1 | 22.3 | 33.6 |
| south entrance | 31.9 | 21.0 | 12.1 | 23.0 | 9.9 |
| Toddler | – | 13.9 | 13.9 | 26.0 | 37.1 |
| Holley | 13.8 | – | 11.8 | 27.4 | 27.6 |
| Fountain | 14.2 | 14.0 | – | 12.8 | 22.5 |
| Garibaldi | 26.7 | 28.0 | 11.2 | – | 20.1 |
| Dog Run | 33.6 | 25.6 | 13.7 | 16.6 | – |

So: each crew has one near spot (10 s), the Fountain is a dead heat (12.1 / 12.1), Holley and Garibaldi are
within 2 s for both (a real race), and nothing is adjacent (11-37 s between spots: a walk is a commitment).
The side-specific races that decide fights are within 0.5 s (north's Garibaldi->Fountain vs south's
Holley->Fountain, near/far middle races). 3-4 players work mechanically but the west and east entrances are
far from the Fountain (36.6 s / 30.5 s vs 13 s): not balanced, not tuned.

## 4. Tuning

Started from the brief's provisional values (settle 3 s, break 15 s) and swept drain, recovery, break and
settle with the incumbent test and Hard-vs-Hard batches (40 matches per row; "wins of 6" = the best
challenger plan wins the 180 s incumbent match from 20 points down; Δ = change of the leader's lead over
120 s versus the challenger doing nothing; negative = challenger gained):

| Variant (others baseline) | best plan wins vs ignore / reinforce / withdraw / counter / Hard AI | Δ vs withdraw | Δ vs Hard | lead changes per Hard mirror | longest unchanged map (s) |
|---|---|---:|---:|---:|---:|
| drain 6, ties: holder | 6 / 5 / 4 / 6 / 0 | -94 | -106 | 0.10 | 35 |
| ties: both (the brief) | **0** / 5 / 4 / 6 / 0 | -110 | -106 | 0.23 | 35 |
| ties: first-there (+1 s dead heat) | 6 / 6 / 1 / 6 / 0 | -42 | -57 | 0.13 | 34 |
| drain 4 | 6 / 4 / 2 / 6 / 0 | -90 | -93 | 0.03 | 41 |
| **drain 9 (chosen)** | 6 / 6 / 5 / 6 / 0 | -102 | -104 | **0.80** | **32** |
| recovery 2 | 0 / 6 / 4 / 5 / 0 | -101 | -107 | 0 (north won 36/36) | 111 |
| break 10 | 6 / 4 / 4 / 4 / 0 | -99 | -100 | 0 (north won 39/39) | 79 |
| break 25 | 6 / 5 / 2 / 6 / 0 | -89 | -97 | 0.10 | 40 |
| settle 6 | 6 / 6 / 2 / 6 / 0 | -89 | -106 | 0.30 | 37 |

Chosen: drain 9, recovery 4, break 15, settle 3, spot radius 7-17 m. Slow recovery or short breaks freeze
the game (recovery is what makes withdrawal productive; a short break makes the loser's return race
decisive). Faster arguments made comebacks and lead changes far more common without hurting the defender's
good replies. Settle time barely matters above ~1.5 s; 3 s reads well.

## 5. The one rule change: the holder keeps ties

With the brief's rule (everyone at zero leaves), a fresh 1 v 1 always ends in a mutual walkout. Both groups
come back and walk out again: the spot is neutralised for good. Challengers could stop a leader's lead from
growing but never overtake a leader who simply sat (0 of 6), and AI mirrors drifted into permanent
Fountain stalemates. "Ties go to whoever was there first" helped attackers less (1 of 6 against withdrawal)
and made arrival order to the tenth of a second decisive.

**Rule:** *If everybody at a spot runs out of patience at the same moment, the crew that was hanging out
there stays.* Effects: one-for-one attacks on a fresh holder fail (they only tire it out: a second fresh
group then wins easily: rotation), two against one wins, and a lone group coming back from coffee cannot
undo a two-against-one by itself. It is one sentence, it only matters for exact ties, and the comic beat is
built in ("Both gave up. They were here first, so they stay."). Variants stay in the code
(`rules.ties: 'holder' | 'both' | 'first'`, plus `settleDrains`, `evictBonus`) for the lab.

## 6. AI (`SQ.HangoutAI`, difficulties in `SQ.data.hangout.ai`)

A crew boss with tactical rules in priority order and commitment: finish operations (two-against-one with
timed departure so the pulled holder's spot is empty as briefly as possible, then the more tired attacker
goes back; help), **defend** (send a spare group that arrives in time and wins the argument, otherwise walk
away to an empty spot = swap), **fill** (least-total-walking assignment of spare groups to empty spots;
symmetric openings), **attack** (two against one, or one against a worn-out group, including groups still on
a coffee break as reinforcements). Attacks are scored by a small forward model of the same rules (walking
times from the flow fields, settling, drains, coffee, ties) against "carry on". It sees positions, patience
and where groups were sent, `react` s late; no fog exists in this mode.

| | Easy | Normal | Hard |
|---|---|---|---|
| thinks every / notices after | 5 s / 4 s, starts 10 s late | 2 s / 1.5 s | 1 s / 0.5 s |
| helps, walks away, avoids lost returns | no | yes (walks away at the last 3 s) | yes (swaps as soon as outnumbered) |
| two against one, pulling a holder | one attack per 150 s | every 20 s if it pays by 4+ | whenever it pays by 2+ |
| notices a spot that came free | after 15 s | at once | at once |

Ladder (60 matches per row, sides alternate; `node tools/hangout-lab.js ladder`):

| Pairing | Result | North : south wins | Lead changes / match | Unchanged map, mean (max) s |
|---|---|---|---:|---:|
| reacting newcomer bot v Easy | 60 - 0 (was 26 - 34) | 30 : 30 | 0 | 43 (52) |
| newcomer v Normal | 0 - 60 | 30 : 30 | 1.0 | 204 (222) |
| Easy v Normal | 1 - 59 | 31 : 29 | 0.05 | 113 (193) |
| Normal v Hard | 24 - 36 | 30 : 30 | 1.08 | 36 (77) |
| Easy v Hard | 0 - 60 | 30 : 30 | 0 | 108 (178) |
| Hard v Hard | – | 28 : 32 | 0.75 | 33 (89) |
| Normal v Normal | – | 25 : 35 | 1.17 | 44 (90) |

(Re-measured after the standing-place fix in §3 and the gentler Easy below.) The "newcomer" bot sends idle
groups to the nearest empty spot (else the nearest rival spot) and, when one of its spots is argued over, sends
its nearest other group to help; it never walks away and never brings two. It beat the first Easy 41 - 18. The
standing-place fix moved only the south crew's third standing place at the Small Dog Run (it used to share a point
with a north group); that changed which Easy group the AI sends first, Easy then re-took Garibaldi whenever the
bot left it, and the bot lost 26 - 34, attacking one against one and losing every tie to the holder.

Easy is what a new player meets after the tutorial, so it was made gentler without touching the rules: it starts
an argument of its own only every 150 s (was 90 s), and a spot that comes free during the match counts as empty
for it only after 15 s (`noticeFree`; spots free at its first look count at once), so it no longer pounces on
every spot a newcomer leaves to help a friend. The bot now beats Easy 60 - 0, by about 100 points. Easy still
takes spots and argues (8.7 spot changes a match, as before), Normal and Hard are unchanged, and any crew that
brings two still beats Easy every time.

## 7. Validation

**Incumbent dominance** (the brief's test; `node tools/hangout-lab.js incumbent`). Leader: three settled
fresh groups on its near spot plus two middle spots; challenger: two settled spots plus a fresh group at its
entrance; 20 points to the leader, 180 s left; 3 splits x 2 sides; challenger plans x leader responses,
each plan at its best target:

| Challenger plan | ignore | reinforce | withdraw | counter | Normal AI | Hard AI |
|---|---:|---:|---:|---:|---:|---:|
| 1 v 1 trade / feint / trade-and-race | 0 [0/6] | -87 [0/6] | 0 [0/6] | 0 [0/6] | 0 [0/6] | 0 [0/6] |
| two against one (timed) | -156 [6/6] | -156 [2/6] | -97 [4/6] | -159 [5/6] | -113 [0/6] | -54 [0/6] |
| rotate (tire it out, fresh group finishes) | -120 [6/6] | -106 [1/6] | -95 [5/6] | -141 [5/6] | -96 [0/6] | -104 [0/6] |
| Normal AI challenger | -154 [6/6] | -143 [6/6] | 1 [0/6] | -166 [5/6] | -101 [1/6] | -11 [0/6] |
| Hard AI challenger | -155 [6/6] | -152 [5/6] | -10 [0/6] | -166 [6/6] | -92 [4/6] | -30 [0/6] |

(Re-measured after the standing-place fix in §3; the scripted plans moved by at most 6 points and no win count
changed; the AI challengers moved by one win in three cells.)

Cells: Δ of the leader's lead over 120 s vs. the challenger doing nothing (the static 3-2 grows it by +120),
[challenger wins from 20 down]. Readings: concentration and rotation are genuine winning plays (not one
contrived route); one-for-one attacks on a fresh holder do nothing; good leader replies are rewarded
(reinforcing beats rotation, the Hard AI concedes points but keeps the match); every attack still shrinks
the gap, so a trailing player always has a move.

**Checks** (Hard v Hard, 60 matches each; `node tools/hangout-lab.js checks`):

- *One group going for coffee doesn't decide the match:* forcing one of a crew's groups on a break at 1:00
  drops its win rate from 48% to 30% (re-measured after the §3 fix: 50% to 20%, within the noise of 60
  matches); at 4:00, to 47% (48%). The first crew to go for coffee loses 55% (50%).
- *Concentration, spreading and withdrawal each win somewhere:* Hard beats a copy without walk-aways 98 - 2,
  a copy without two-against-one 81 - 19 and a copy that never attacks 73 - 27; and spreading (sitting on
  three spots) beats every one-for-one plan and Easy's single raids.
- *No static 3-2:* Hard mirrors change a spot's holder 17.6 times a match (16.1 after the §3 fix), the map
  never stays unchanged for longer than 37 s on average (35 s; 90 s at most) and spends 16.5 s of 300 in a
  3-2 split (19 s).
- *Side fairness:* north : south 27 : 33 (Hard mirror), 33 : 27 (Normal mirror); over 200 matches, north
  wins 54% (Hard mirror) and 49% (Normal mirror); the Fountain race is a dead heat.

## 8. Interface (for UI, render, tutorial)

```js
const m = SQ.Hangout.create({ seed, players: [{ crew: 'hustle', ai: false }, { crew: 'pack', ai: { difficulty: 'normal' } }],
  layout: 'park', quiet: false, length: 300, scenario: 'firstSpot' | {...}, crew, rival, rules: {...} /* lab only */ });
m.tick();                         // one 0.05 s step; call 20x a second
m.order(side, groupId, target);   // target: 'fountain' | spot index | {x, z} (inside a spot = that spot) | 'stop' | 'entrance'
                                  // -> {ok:true} | {ok:true, queued:true} (on a break) | {ok:false, reason}
m.state; m.bus; m.report(); m.hash(); m.finish(winner, reason); m.eta(groupId, spotIdx); m.forceCoffee(groupId)
SQ.Hangout.spotAt(state, x, z); SQ.Hangout.groupAt(state, x, z, r, side?); SQ.Hangout.checkGoal(m, goal); SQ.Hangout.replay(cfg, log, ticks)
```

State: `{ t, tick, length, timeLeft, over, winner, reason ('time'|'draw'|...), player, sides[], groups[], spots[], history[] }`.
`side = { idx, crew, name, color, isPlayer, entrance {id,name,x,z}, score, points (whole), rate, holding, groups[ids], stats }`.
`group = { id, side, slot, name, short, members, offsets[[dx,dz]], x, z, px, pz (interpolate), facing,
spot (sent to, -1 ground), lastSpot, at (spot it is at, -1), moving, patience, arguing, rivals, earning,
status ('idle'|'walking'|'settling'|'hanging'|'arguing'|'coffee'), coffee, backAt, backIn, leftAt, pending, say {text, kind, t} }`.
`spot = { idx, id, name, short, the, x, z, r, poly, holder, settleSide, settle (0..3 s), present[side], contested,
arguing, slots[side][slot] {x,z}, changes }`.

Bus events (`match.bus`, also `SQ.bus` unless `quiet`): `matchStart`, `ordered {side, group, spot, x, z, queued}`,
`cmdRejected`, `settleStart {spot, side, group, x, z, time}`, `settled {spot, side, groups, x, z}`,
`spotFree {spot, side, reason 'left'|'coffee'}`, `earning {t, spots:[{spot, side, x, z, amount}], score}` and
`score {score, rate, timeLeft}` every second, `argueStart {spot, sides, groups, holder}`, `argueEnd`,
`wentForCoffee {group, side, spot, x, z, line, backAt, backIn, mutual, tie, rivals, mates, holder, stayed}` (why it
ended: `mutual` = nobody stayed, a spot nobody held; `tie` = everyone ran out together and the holder stayed;
`rivals` / `mates` = groups of other crews / this crew at the spot as it ran out), `returned {group, side, entrance, dest, line}`,
`bark {group, side, kind, text, spot}` (settle, settled, argue, tired, still, evict, withdraw; one per group per
6 s; the UI decides what to show), `clockWarn {timeLeft: 60|30|10}`, `matchEnd {winner, reason, score, report, playerWon}`.

Park Report (`m.report()` / `matchEnd.report`): per side held/argued seconds per spot, coffees, evictions,
two-against-one wins, walk-aways, mutual walkouts (and `mutualAt`: where they happened, so the report names the
real spot), biggest lead and deficit; per group walked metres,
longest hang; and up to four observation `lines`, e.g. "Held The Fountain for eleven seconds. Argued about
it for three minutes." / "Came back from 40 points down." / "The Kibitzers went for coffee 4 times."

Tutorial scenarios (`SQ.data.hangout.scenarios`, `create({scenario: id, crew})`; goals via `checkGoal`):
`lookAround` (camera; passive rival), `firstSpot` (one group, the Fountain only; goal 10 points),
`spread` (three groups, the rival sits on the Dog Run; goal: hang out at 3 spots), `argue` (two groups vs one
holder; goal: take the Fountain), `walkAway` (two rivals arrive; slowed arguments; goal: walk away and
recover, or come back from coffee), `firstMatch` (a full match against Easy). AI flags for scripting:
`passive`, `holdOnly`, `singleGroup`, `noReturn`, `noReinforce`, `script: [{at, group, to}]`, `targets`.

## 9. Open risks

- **Easy against real newcomers.** The reacting-newcomer bot beats the gentler Easy 60 - 0 (§6), but the bot is
  only a stand-in: watch whether first-time players win their first match, and whether Easy now feels too passive.
- **Hard v Hard rarely changes leader** (0.85 lead changes a match, mean margin ~136): an early two-against-one
  that works tends to stick. Against humans this may be fine; watch real matches.
- **Two passive players draw** (a 2-2 split with the Fountain in a permanent mutual-walkout loop). Any crew
  that attacks wins, but newcomers may see long standoffs. The UI explains each walk-out ("Nobody held the
  Fountain, so you both gave up. Bring two next time.") and every coffee card says where the group will walk back
  to ("tap to change").
- **The AI does not find the best play against a leader who swaps** (scripted two-against-one wins 4/6 there,
  the AIs 0-1/6), and Hard as leader is never overtaken from 20 down in 3:00. Hard is strong but not perfect.
- An **early coffee break costs a crew ~18 points of win rate** (at 1:00); late ones cost nothing.
- **Small residual side asymmetries** (the Toddler Playground is a circle at its gate, outside the fence, Holley Plaza is 16 m
  from the bust; the north home is still 0.1 s farther; 3-4 player entrances are unbalanced).
- Untested with people: whether newcomers can explain why an encounter was won (criterion 1) and whether
  they poke at spots (criterion 6) needs playtests; the rules give poking no reward (walking through a spot
  does nothing and a 1 v 1 against a holder fails).

**Still open after the 2026-11-01 re-check** (simulated newcomer playtests on laptop and phone, a re-check of the
21 earlier findings, and a code review; notes and screenshots in the git-ignored `.shots/v3/r2/`). Fixed in that
round: the false "your help got there after your first group left" coach line on a first one-against-one, the
Park Report printing "1.9 spots, to your 1.9" when the crews differ, the silent score reset between tutorial lessons,
"tap" wording on desktop cards, and find-my-crew zooming in until no spot was on screen. Not yet fixed:

- **Phone, tutorial step 4 (blocker on phones):** in 2 of 4 runs the ghost hand sat on the selected group's own name
  tag (the target spot's sign was not drawn), so tapping where the hand points let go of the group and the step
  looped.
- **The HUD covers the 3D labels:** the score bar, mini map, camera buttons and cards can sit on top of spot signs
  and name tags; in landscape a tap on a sign under the score bar picked a group instead of sending one. Tags avoid
  each other and the signs, but not the HUD panels.
- A name tag pushed up out of the way can land on another spot's sign, so the group seems to be there; the coach
  card can cover the argument it describes.
- Wording: "Patience: you 40, them 30 (you give up first)" against two rivals reads as a contradiction; both
  cards at a shared, contested spot say "still earning +1/s"; the Park Report can say both "nobody ever hung out at
  Holley Plaza" and "both crews gave up there twice".
- Seen once each: a click during the opening camera move became a ground order, and a right-click on a spot sign
  did not send the selected group.

## 10. Presentation and teaching (what the UI does with the rules)

The rules above are all there is; the UI's job is to make each of them visible where it happens and explained in
plain words when it matters. Decisions made after the first newcomer playtests (by reviewers, not yet real players):

- **Control: tap a group, then tap a spot.** Every order lets go of the group, so a later stray tap never moves
  anyone (no timer). On touch screens a tap on bare ground only lets go ("Not a spot: … stay put"); with a mouse it
  walks the group there, inside the park only. A note at the tap point says what happened ("Old Heads → Fountain",
  "Pick a group first"). Keys 1-3 pick groups; Esc lets go.
- **The view:** a match opens framing all five spots, their signs and your groups (on portrait phones turned 45° and
  higher up, so the spots line up along the tall side). Visible camera buttons (zoom, turn, ⌖ find my groups; on
  portrait phones in a row above the cards), the round map jumps the view, drag / WASD / edge scrolling pan at
  30-55 m/s and the view stays over the playing area. Buildings between the camera and a spot are see-through, and
  signs and tags slide along the screen edge instead of being cut off; their text is never below ~12 CSS px.
- **One message at a time,** prioritized, and every argument's end says why: "Two against one: you ran out first.",
  "You both ran out at the same moment. You were here first, so you stay.", "Nobody held the Fountain, so you both
  gave up. Bring two next time." While arguing, the group's card compares patience ("you 40, them 25: they give up
  first"). Speech bubbles in the park wait while a message is up. Park events are ambience only.
- **Coffee:** the card counts down and says where the group will walk back to ("then back to Fountain (tap to
  change)"); an order given during the break replaces that.
- **Pause is a think pause:** the clock stops, but the view, the map and the cards keep working; Menu opens the full
  pause card (How to play, Options, Start over, Quit). Classic's game-speed option never applies here.
- **Tutorial** ("First morning in the park", 8 steps): one idea per step and every step waits for the player. Steps
  5-7 hold the argument still with `rules.patienceFloor` (at 60 until help arrives; at 40 for your group and 30 for
  theirs until you walk away), say so on screen, and replay step 7 if the group still goes for coffee. Rules
  lessons end with a Next button; the other steps' "done" lines stay up at least 4 s. Skip appears after 7 s.
