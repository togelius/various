# Square Off: design recommendations

Date: 2026-10-31

## Status (after implementation)

This brief has been built. It is the default game, "Hang Out" (the title screen's PLAY); the exact rules, map,
tuning, AI, measurements and interfaces are in [DESIGN-V2.md](DESIGN-V2.md). The original RTS is unchanged and
still reachable as "Classic mode".

**Implemented as recommended (Round 3):** three named, persistent groups per side; five equal spots (the Toddler
Playground, Holley Plaza, the Fountain, Garibaldi, the Small Dog Run; picked by measured walking times, not
geography); a 5:00 clock; +1 point a second per spot held, whatever the number of groups there; 3 s of settling in;
an established occupant keeps earning while argued with; patience (the brief's Composure) drains for each rival at
the spot and refills away from arguments; at zero a 15 s coffee break, then the group comes back through its home
entrance and walks back to its spot; identical rules for every crew; no economy, recruitment, Setups, perks,
counters or events with effects. Humour carries the state: camps unfold while settling in, people check watches and
pack up as patience drains, and the punchline is the walk-out. The Park Report is built from what happened. A guided
tutorial teaches looking around, sending, settling, spreading out, arguing, two against one and walking away; the
screen shows one message at a time and says why an argument ended.

**One rule change:** when everyone at a spot runs out of patience at the same moment, the crew that was already
hanging out there stays. With the brief's rule (everyone leaves), every fresh one-on-one ended in a mutual walk-out,
and challengers could never overtake a leader who simply sat.

**What validation found (headless, `tools/hangout-lab.js`; human playtests still to come):**
- Incumbent dominance: concentration and rotation are real answers. From 20 points down with 3:00 left, two against
  one wins 6 of 6 against an idle leader, 2-5 of 6 against a leader who reinforces, withdraws or counters, and 0 of 6
  against the Hard AI. One-for-one attacks never win. Every attack still cuts the leader's lead growth by about
  50-160 points compared with doing nothing, so a player who is behind always has a move.
- Concentrating, spreading and withdrawing each matter: Hard beats a copy of itself that never walks away 98-2, one
  without two-against-one 81-19, and one that never attacks 73-27.
- No static split: in Hard mirrors spots change hands 16-18 times a match and the 3-2 split lasts 16-19 s of 300.
- Losing a group early hurts but is not decisive: a coffee break forced at 1:00 drops a crew's win rate from about
  50% to 20-30% (at 4:00, to 47%).
- Open risks: Hard-v-Hard matches change leader only 0.75-0.85 times a match; two passive crews end in a walk-out
  loop at the Fountain (the game now explains it: "Nobody held the Fountain, so you both gave up"); a simple bot
  that never brings two now loses to Easy (26-34), so whether newcomers beat Easy needs watching; criteria 1 and 6
  below (newcomers can explain an outcome; nobody pokes at spot edges) need real playtests.

## Original status

Status: proposed direction, following three rounds of concept development and critique. These recommendations have not been validated in playable prototypes and do not describe the current implementation. The existing design is documented in [DESIGN.md](DESIGN.md).

## Recommendation

Build Square Off around a small, persistent cast competing to occupy Washington Square Park. Focus the player's attention on where to commit, when to withdraw, and where to cause trouble. Make the comedy communicate those decisions and their consequences.

The preferred starting experiment is **three persistent groups per side, five equally valuable places, and a five-minute match**. Remove army production and the economic benefits of territory. Establish whether movement, concentration, withdrawal and recovery make an interesting game before adding faction exceptions or park events with mechanical effects.

The central dilemma should be immediately understandable:

> I could send everyone to take the Fountain, but who is going to keep those people out of the dog run?

## Diagnosis: simple commands, complicated consequences

The current game gives the player a simple order—send a squad somewhere—but attaches many consequences to it. Taking a landmark can change score, income, population capacity, reinforcements, recruitment options and combat strength. Predicting whether an order is good therefore requires understanding several interacting systems.

Combat has a similar problem. The counter triangle promises a clear explanation, but unit perks, faction passives, healing, setup auras and event modifiers complicate the result. More tutorial text cannot resolve that underlying burden.

The most valuable tensions to preserve are:

- Concentrating force versus covering several places.
- Committing to a walk across the park versus remaining available nearby.
- Holding a position versus withdrawing before a group becomes Over It.
- Winning an encounter versus gaining enough territory to justify the commitment.

These choices can produce depth without requiring several budgets and upgrade systems. Removing those systems also sacrifices army-building and some faction differentiation; that is a real tradeoff to evaluate.

## Round 1: three candidate directions

| Concept | Core change | Source of interesting decisions | Main concern |
|---|---|---|---|
| Smaller conventional RTS | Remove construction, population management and most perks; retain recruitment and composition. | What to recruit and where to fight. | Still divides attention between production and spatial conflict. |
| Three persistent groups | Replace the growing army with a fixed cast that recovers and returns. Remove the economy. | Concentration, coverage, travel and withdrawal. | Could become simple numerical superiority or a static territorial split. |
| Compete for audiences | Groups perform for arriving crowds; applause replaces combat and ownership. | Concentrate at a popular gathering or cover several smaller ones. | Could become a collection race with weak direct interaction. |

### Alternative worth testing: compete for audiences

Each side controls three permanent groups. Landmarks show approaching crowds and arrival countdowns. Moving is the only command; standing still for a short setup period starts a performance.

When a crowd arrives, its applause divides equally among the performing groups there. Twelve spectators watching two of your groups and one rival group award eight points to you and four to the rival. Crowds then leave, and the next arrivals are forecast. Points buy no additional power.

This gives travel and setup meaningful costs without money, health or reinforcement rules. It also produces appropriate social situations: chess hustlers and bucket drummers sharing graduation spectators, or dog walkers stealing part of a busker's audience.

The unresolved issue is whether taking audience share feels sufficiently confrontational and satisfying. Prototype the clear allocation rule before adding individual spectator preferences or faction-specific attraction rules. Those additions could make audience choice opaque.

The persistent-group tactics game is the preferred immediate direction because it preserves the existing game's spatial conflict. The audience game is a competing small experiment, especially if a less military feeling becomes a priority.

## Round 2: objections that changed the preferred design

### Three groups and three equal landmarks can become static

Simply reducing the number of units and objectives does not create good choices. A small, symmetric distribution can settle into everyone holding their assigned place. Start with more scoring places than each side can independently occupy.

### A double-value Fountain can dominate the park

Making the center worth twice as much gives players a clear destination, but risks turning the rest of the park into scenery around one central pileup. First test five equal places. A rotating bonus could also replace judgment with following a schedule, so it should not be part of the baseline.

### Natural roles can recreate the counter triangle

Fast, ranged and tough groups may be useful, but they still create matchups. Removing explicit damage multipliers does not establish that speed, range and automatic targeting will be easier to understand.

Use identical operational rules for the initial experiment. This isolates whether occupation and movement work. Distinct roles remain a candidate for later testing, rather than a rejected idea.

### Immediate contesting rewards ring poking

If an enemy merely entering a ring stops its score, a fast group can repeatedly touch the edge and flee. That encourages fiddly score denial.

Prefer this rule:

> Your crew earns by hanging out somewhere. Opponents have to make it leave.

An established occupant keeps earning while attacked. Entering the ring alone does not stop the score.

### One gimmick per faction can still be a large exception

Dogs moving faster, students summoning extra groups and hustlers defending better each change the whole territorial game. A short description is not necessarily a small learning burden. Establish shared rules before adding asymmetry.

## Round 3: proposed baseline prototype

### Groups and orders

- Each side has three persistent groups.
- A group is one controllable object with one shared Composure bar. Its people stay together; individual bodies do not require selection or replacement.
- Select a group, then choose its destination.
- Nearby rivals argue automatically. Moving away is the withdrawal command.
- Initially, groups share the same operational rules. Their presentation can differ by crew.

### Occupation and scoring

- Five places are active scoring objectives. All earn at the same rate.
- An empty place requires a short, visible settling action before it earns. Three seconds is a provisional starting value.
- A settled group must remain physically present to earn. Departure immediately stops earning.
- An established occupant continues earning during an argument until it leaves or becomes Over It.
- If opposing groups try to claim an empty place together, neither earns until only one side remains and it settles.
- Multiple friendly groups at one place do not multiply its score.
- Most points after five minutes wins. A tie can be a draw with a rematch.

There is no additional neutralization meter or ownership bonus. Show earning on the place and its occupying group so the cause is visible.

### Composure and recovery

- Groups recover Composure outside arguments, making timely withdrawal productive.
- At zero Composure, a group becomes Over It, leaves and takes a break.
- Its card shows when it will return. It returns as a complete group through its home entrance and must walk back.
- Both sides use the same recovery rules, regardless of score or territory.

A fifteen-second break is only an initial test value. Recovery duration, argument duration, entrance position and walking time must be tuned together. Removing economic growth prevents one kind of snowballing; it does not prove that an opening defeat is recoverable.

### Map and presentation

Keep the recognizable park, but expose only five strategic objectives in the baseline. Select those places and starting entrances together after examining travel times and approaches. Do not assume real geography produces a fair layout automatically.

Paths, fences and the Fountain should create understandable commitments and approaches. Trees, benches, buildings and ambient park life can enrich the setting without each carrying a special rule.

The ordinary camera should make the important groups and objectives easy to account for. Group cards should emphasize identity, Composure, destination and return status. The main match information is score and time remaining.

### Systems excluded from the baseline

- Clout, recruitment and queues.
- Population caps, grudge refunds and automatic regulars.
- Construction, build pads and Setups.
- Landmark perks and numeric counter bonuses.
- Faction combat passives and Crew Call charging.
- Changing landmark values and mechanically consequential random events.
- Cart purchases and squirrel-clicking obligations.

Lighting changes, ambient animals, occupation performances, arguments, departures and the Park Report remain. The prototype should have humour from its first version.

## Why the spatial game might be better

Suppose one side occupies three places and the other occupies two. The challenger can concentrate two groups to evict one defender, but doing so temporarily sacrifices coverage elsewhere. The leader can reinforce, withdraw into the newly available space, or accept that loss while threatening another place.

The question is whether winning the argument repays the time and pavement given up. A useful retreat should sometimes be preferable to a costly victory.

This is the intended source of depth. It is also the part that most needs testing.

## Strongest unresolved risk: incumbent dominance

The first side to settle three places might be able to preserve its lead too easily. Defenders keep earning during arguments. Equal one-for-one attacks may accomplish nothing, while two-for-one attacks may cost the challenger more coverage than they gain.

Do not conceal this problem with faction powers or random events. Test it directly from an unfavorable middle state:

1. Give the leader three occupied places and three fresh groups.
2. Give the challenger two occupied places and its third group available.
3. Let the challenger attempt a coordinated displacement while the leader rotates, reinforces or withdraws.
4. Compare the score gap before the commitment and after both sides regain their original group availability.
5. Swap sides and try other plausible attacks.

If successful, well-timed attacks consistently worsen the challenger's position, or simple matching always preserves the leader's three places, revise the territorial rules and timings before expanding the game. One contrived winning route is insufficient.

## Humour as part of understanding the game

### Occupation is an activity

Show a crew making itself comfortable. Hustlers unfold chairs and establish a chess game on the Fountain rim. Buskers turn the dog run into a venue. Students begin an unsolicited campus tour under the Arch.

The activity communicates the settling action and established occupation. The joke and the strategic information arrive together.

### Losing Composure is escalating exasperation

People check watches, gather belongings and make increasingly final remarks. Becoming Over It ends the encounter with a visible departure and a punchline.

### Persistent characters support recurring jokes

The same Old Head returns from coffee, sees the same students and says, "Still?" Returning groups create continuity that disposable recruits do not.

### Reports describe actual play

Use observed behaviour for the Park Report: "Held the Chess Plaza for eleven seconds. Argued about it for three minutes."

Avoid generic jokes unrelated to the player's match. Ambient squirrels can steal a sandwich without creating another task for the player.

The tone should remain affectionate: recognizable people enjoying the same public place in mutually inconvenient ways.

## Validation and expansion

Before adding content, establish that:

1. A newcomer can explain why an encounter was won or lost.
2. Concentrating, spreading and withdrawing each have useful situations.
3. A player behind on points can identify a plausible move that changes the game.
4. Losing one group leaves worthwhile orders to give the others.
5. Experienced play does not converge on a static split or one dominant pileup.
6. Players spend their attention choosing commitments rather than repeatedly touching capture boundaries.

If the territorial game works but lacks variety, test one meaningful addition at a time: distinct group roles, a single visible faction trick, or a carefully chosen map affordance. Judge whether it creates a new dilemma and whether players understand its consequences.

The design principle for the next iteration is: **taking over a public place should be the strategic act and the comic act simultaneously.**
