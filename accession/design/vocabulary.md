# The mechanical vocabulary (S0)

*Section draft for the ACCESSION design document, 2026-10-20. Written inside the direction memo. Readers: the sample-departments writer, the S2 compiler prompts and validators, the balancer, the layout pipeline, the label writer (S4) and the sprite spec (S5).*

## 0. What this section fixes

Pillar 1 says every department is new to read and familiar to play. This section is the "familiar to play" half: the closed list of verbs that every generated department must compile into.

- Everything a department can *do* is an id in one of the tables below.
- The S2 compiler (an LLM making function calls) chooses ids, roles and magnitude classes.
- A deterministic balancer turns those choices into numbers by run depth.
- The S3 simulation gate checks that every chosen id fires and matters.

**The contract (applies to every table).**
1. **Closed verbs, open nouns.** The LLM may invent any exhibit, name or conceit. Its behaviour must be an archetype from §2, its material a modifier from §3, its effects primitives from §5, and its department rule a module from §6 (Liapis et al. 2019 §VII-B/C via papers-semantic F6; AI&G 2e p. 300 via book-pcg F12).
2. **No silent fallback.** A concept that fits no id is rejected, not reskinned, and goes to the unmatched-concept queue (§11.4). A Rogue Dream's random fallback is the failure mode to avoid (papers-semantic F6).
3. **No numbers from the LLM.** It picks roles and magnitude classes (S/M/L). The balancer (§10) picks HP, damage, counts and durations (papers-semantic F8).
4. **No unused components.** Every chosen id must fire in at least 90% of simulated seeds (GAVEL's "unused game components", papers-semantic F13).
5. **No decoration.** Every frame domain drives at least one id, and every id in the spec traces back to the frame (papers-semantic §3.3, S2 row).
6. **Stable ids.** snake_case, unique across all tables, never renamed, never reused. A retired id stays as an alias (§11.5).
7. **Every id ships with five things:**
   - a pure function in the core;
   - an icon (pictogram);
   - an Essential-line template for labels, used by the S4 round-trip honesty check;
   - counter tags (§1.9);
   - a micro-arena test with two scripted bots (§11.4).

**Contents and counts.**

| Table | Full list | Launch | Section |
|---|---|---|---|
| Behaviour archetypes | 35 | 25 | §2 |
| Telegraphed specials | 10 | 8 | §2.3 |
| Modifiers | 18 | 12 | §3 |
| Status effects | 15 | 12 | §4 |
| Item effect primitives | 40, plus 5 drawbacks | 30, plus 4 | §5 |
| Consumable kinds | 12 | 10 | §5.4 |
| Rule modules | 24 | 13 (11 firm, 2 marked L+) | §6 |
| Furniture fixtures / surfaces | 19 / 5 | 16 / 5 | §7 |
| Challenge types | 8 | 7 primary; social as secondary only | §8 |
| Families / subject categories | 12 / 6 | 6 / 6 | §9 |

---

## 1. Shared enums

These are the small closed sets the tables refer to. Numbers marked "proposal" belong to the stealth and combat drafters, who may retune them. The ids are what the vocabulary depends on.

### 1.1 Personas

Personas are used in the "favours / punishes" columns and in every validation test.
- The first five are the roster in papers-levels §6(ii), after Holmgård et al. and Liapis et al. 2015.
- Sneak is added from roguelike-systems §3.11, because the guarded and darkness challenge types need a persona whose utility is not being seen.

| id | short | utility |
|---|---|---|
| `tourist` | Tou | reach the exit; minimise turns |
| `vandal` | Van | kill everything |
| `looter` | Loo | open every case |
| `completist` | Com | visit every gallery; read labels |
| `cautious` | Cau | minimise damage taken |
| `sneak` | Snk | minimise detections (proposed addition) |

Each persona comes in novice, median and expert variants. Each also has **blind variants**, which ignore one module or one archetype rule. Comparing a blind variant with an aware one is how this section proves that a verb matters (Khalifa et al. 2019, limited agents, via papers-levels F18).

### 1.2 Alert states and wake triggers

**States.**
- `dormant`: asleep on its plinth or in its case.
- `alert`: investigates a noise or a glimpse for 10 turns.
- `hunting`: knows your position; loses you after 20 turns without contact.
- `returning`: walks back to its case and goes dormant.

An exhibit whose case was broken cannot return, so it stays alert. That is the hidden cost of breaking glass.

**Universal rules.**
- Damage always wakes.
- An `alarm` wakes everything that lists it.
- From closing stage 2, every dormant exhibit's wake radius grows by 1.

| trigger | fires when | default |
|---|---|---|
| `prox(r)` | you are within r tiles and in its line of sight | r = 3 |
| `noise(n)` | a noise of level n or more reaches its tile (§1.3) | n = 2 |
| `light(l)` | it can see, within 4 tiles, a tile at lux l or more that is brighter than its own | l = lit |
| `seen(k)` | it has been observed (§1.4) for k consecutive turns | k = 2 |
| `unseen` | a gate, not a wake: it may act only on turns it is not observed | – |
| `touch_case` | you bump, open or break its case, or cross the rope line of its bay | own bay |
| `take` | an item is lifted anywhere in its room | room |
| `alarm` | the department alarm is raised | – |
| `clock(s)` | the closing clock reaches stage s (1 bell, 2 dimming, 3 night watch) | s = 2 |
| `ally_hit` | an awake ally within 5 tiles takes damage | r = 5 |
| `period(p)` | every p turns from department entry | p = 12 |
| `path` | you enter its gallery | – |
| `ticking` | a ticking item or actor comes within 6 tiles | r = 6 |
| `tether(r)` | you come within r tiles of the object it guards | r = 2 |
| `awake` | never dormant (guards, neutrals) | – |

### 1.3 Noise (proposal)

| level | name | heard within (path tiles) | typical sources |
|---|---|---|---|
| 0 | silent | 0 | muffled movement, reading, waiting |
| 1 | soft | 3 | walking, opening a door, a ticking clockwork actor |
| 2 | loud | 6 | melee, crossing a rope line, breaking a crate, a hit on bronze |
| 3 | crash | 10 | breaking glass, a charger hitting a case, a lobber burst |
| 4 | alarm | whole department | alarm bell, closing bell |

### 1.4 Light and observation (proposal)

Room lux comes from the material on display (Texas Historical Commission 2013, via literature-museology F26).

| class | diegetic label | your sight radius | hunters notice you on this tile within | typical rooms |
|---|---|---|---|---|
| 0 dark | "not lit" | 1 | 1 | storage, closed galleries |
| 1 dim | "50 lux" | 4 | 3 | paper, textile, photographs |
| 2 lit | "150 lux" | 7 | 6 | oils, wood, leather |
| 3 bright | "top-lit" | 9 | 9 | stone, metal, sculpture courts |

**Lantern settings.**
- off: +0.
- low: +1 lux within 2 tiles.
- high: +2 lux within 4 tiles, and your own tile counts as at least lit.

**Observed** means three things at once:
1. inside your field of view;
2. within your sight radius;
3. on a tile at dim or brighter, or inside your lantern radius.

This one definition drives `seen`, `unseen`, `unobserved_motion` and `gaze_wake`.

### 1.5 Damage kinds

There are five: `blunt`, `edge`, `fire`, `water` and `light`.
- Every weapon deals exactly one kind.
- Resistances come only from modifiers (§3) and garments (§5.2).
- They come in four steps: ×0.5, ×1, ×1.5 and ×2.

Decision D-V4 covers the alternatives.

### 1.6 Magnitude classes

The LLM writes S, M or L. The balancer owns the mapping; the table below is the reference mapping v0 it starts from. Anything that scales with power (damage, HP) is also scaled by run depth, never by the department.

| quantity | S | M | L |
|---|---|---|---|
| bonus (fraction of tier base) | +15% | +30% | +50% |
| conditional multiplier | ×1.5 | ×2 | ×3 |
| duration (turns) | 3 | 6 | 10 |
| radius (tiles) | 1 | 2 | 3 |
| range (tiles) | 3 | 5 | 8 |
| chance | 15% | 30% | 50% |
| instrument charges | 1 | 2 | 3 |
| heal (fraction of max HP) | 25% | 50% | 100% |
| clock shift (turns) | 30 | 60 | 100 |
| noise or detection shift | 1 | 2 | 3 |

### 1.7 Silhouette classes

| id | shape at 16×16 | example skins |
|---|---|---|
| `figure` | upright, 12–15 px tall | statues, attendants, automata on legs |
| `beast` | horizontal, about 14×9 | hounds, mounts, wheeled things |
| `small` | 8×8 or less | specimens, critters, single tools |
| `flier` | any shape, with a ground shadow 2 px below | moths, kites, hanging things |
| `case` | a box with a glass highlight line | mimic vitrines, dioramas |
| `tall` | full 16 px, narrow | clocks, bells, instruments on stands |
| `mass` | wide and low, 16×10 | heaps, bundles, cast blocks |
| `cluster` | 3–6 dots | swarms |
| `framed` | flat rectangle with a border | paintings, panels, pages |
| `huge` | 2×2 tiles | Masterpieces |

Each archetype has one primary silhouette and at most one alternate (§2.2). Two hostile species in the same department must differ in silhouette or in tag (§1.8).

### 1.8 Behaviour tags (trim colour and glyph)

This is the cross-department visual grammar for behaviour (book-pcg F11, after AI&G 2e p. 301 on colour signalling a strategy). In the fiction it is the inventory dot printed on every exhibit label. That is a convention of this museum, not a claim about real practice.

| tag | colour | glyph | means | used by |
|---|---|---|---|---|
| `pursuer` | red | filled circle | closes and hits | fodder, skirmisher, brute, swarm |
| `ranged` | orange | triangle | attacks from range | artillery |
| `controller` | violet | diamond | statuses, displacement, terrain | controller |
| `support` | green | plus | heals, buffs, spawns | support |
| `warden` | blue | square | guards, patrols, raises alarms | warden |
| `conditional` | white | ring | acts only under a stated condition | some ambushers, escapement, demonstrator |
| `hidden` | grey | dash | disguised; the tag appears once revealed | mimic_vitrine, wall_lurker |
| `neutral` | teal | half disc | not hostile unless provoked | keeper, rival_visitor |
| `masterpiece` | gold | star | Masterpiece parts; champions get a gold outline over their own tag | `mp_*`, champion |

**Where it shows.**
- The glyph appears on the label tile beside every exhibit, on the tombstone card and in the examine panel.
- While awake, the sprite carries a 1-px trim in the tag colour (collar, base or outline segment).
- The glyph carries the meaning for colour-blind players.
- S5 reserves these nine hues at full saturation: exhibit bodies may not use them.

### 1.9 Counter tags

The S2 counterplay check uses these. Each species needs at least two counter tags that can be satisfied at its tier by the base kit, the layout and the department's own item pool. At least one of the two must not be `avoid`.

| tag | means |
|---|---|
| `melee` | close-range attack |
| `ranged` | ranged attack |
| `aoe` | area attack |
| `burst` | one big hit |
| `choke` | a layout chokepoint |
| `los` | a sight-blocker |
| `light_ctl` | lantern setting, flash or light decoy |
| `displace` | push or pull |
| `stealth` | muffle, dark or uniform |
| `timing` | wait for a telegraph or a beat |
| `examine` | inspect or identify |
| `avoid` | no fight needed |
| `social` | ask, trade or return |
| `status` | inflict a status |

**What is always available.**
- The base kit supplies `melee`, `timing`, `examine`, `avoid`, and the lantern part of `light_ctl`.
- The layout rules in museum-layouts §3.4 supply `los` and `choke` in every combat-sized room.

---

## 2. Behaviour archetypes

There are 35 archetypes. A row is a verb, not a creature: the Escapement Hound and a clockwork postman are both `escapement`. The ten roles come from the task list; `neutral` is a flag, not a role.

### 2.1 Behaviour

| id | role | move / attack | wake (default) | counterplay |
|---|---|---|---|---|
| `plodder` | fodder | Moves 1, melee. No tricks. | prox(3), noise(2) | Doorways; anything. |
| `darter` | skirmisher | Moves 2; hits, then steps back 1. | prox(4) | Corner it against walls or glass; ranged. |
| `pack_hunter` | skirmisher | Waits 3 tiles off until 2 packmates can reach you; +1 accuracy class per adjacent packmate. | prox(5), ally_hit | Doors split the pack; kill the first to commit. |
| `pilferer` | skirmisher | Moves 2; a hit steals 1 consumable, then it flees to the nearest staff door. Drops the loot on death. | prox(4), take | Kill fast; block staff doors; carry less. |
| `charger` | brute | Telegraphs 1 turn, then rushes up to 5 tiles in a line. Dazed 2 turns if it hits a wall, column or case (the glass breaks). | prox(5), noise(3) | Sidestep; stand in front of a column. |
| `shield_bearer` | brute | Moves 1; ignores damage from its front 3 tiles; turning costs it a turn. | prox(3) | Flank; displace; statuses. |
| `kiter` | artillery | Holds 3–5 tiles away and shoots; retreats when you are adjacent. | prox(6), noise(2) | Approach behind cover; corner it; outrange it. |
| `lobber` | artillery | Marks a 3×3 area that is hit next turn; arcs over glass and low furniture. Weak in melee. | prox(6), alarm | Step off the marked tiles; rush it. |
| `axis_sniper` | artillery | Charges 1 turn (the line is shown), then fires a beam along its row or column to range 10. Beams pass through glass. | prox(8) on its axis | Step off the axis; opaque cover; a reflector. |
| `mote_swarm` | swarm | 3–8 bodies that die to one hit each; move 1–2; surround. | noise(2), prox(4) | Area attacks; chokepoints; sweep weapons. |
| `light_swarm` | swarm | Moves toward the brightest tile it can see, usually your lantern; bites. A hit may spoil 1 paper consumable. Ignores you in the dark. | light(lit), prox(2) | Lantern low or off; throw a light decoy. |
| `splitter` | brute | Moves 1; a hit that does not kill splits it into 2 at half HP (at most 2 splits). | prox(3) | Big single hits; fire; avoid it. |
| `binder` | controller | Range 4, telegraphed: target rooted 2 turns. Keeps its distance. | prox(5) | Break line of sight; kill it first. |
| `displacer` | controller | Range 3, telegraphed: pulls or pushes 2 tiles, into hazards or off balconies. | prox(5) | Back to a wall; stay away from edges. |
| `dimmer` | controller | Darkens the 5×5 around itself by 2 lux classes; when adjacent, puts your lantern out for 3 turns. | light(lit) | Flash; fight it from outside its dark. |
| `reflector` | controller | Moves 1; sends bolts and beams back along their line; shields allies behind it (from bolts, and from beams marked while it is in their way: a beam's tiles are fixed when marked, BUILD.md §8.1). Weak in melee. | prox(3) | Melee; blunt; lob over it; bank beams off it. |
| `demonstrator` | controller | Runs a fixed track. Every p turns it performs the demonstration printed on its label (a sweep, ring or line). Never chases. | period(p) | Read the schedule; time crossings; lure enemies into it. |
| `unobserved_mover` | ambusher | Moves 2 per turn, but only on turns it is not observed; strikes hard when adjacent. Frozen while observed. | unseen gate; prox(8) | Keep it in view; keep lamps on; back away facing it. |
| `mimic_vitrine` | ambusher | Looks like a loot case. When touched it grabs: rooted 2 and a hit. Then a slow brute. | touch_case | Examine it (its label has no accession number); throw something at it first. |
| `wall_lurker` | ambusher | Travels inside shelving and partitions; emerges adjacent to strike, then withdraws. | noise(2) | Walk aisle centres; fight in open rooms; listen. |
| `path_follower` | ambusher | Retraces your exact path 2 turns behind and triggers whatever you triggered. Harms only on contact, i.e. if you backtrack into it. | path | Never backtrack; use it to hold pressure plates. |
| `tethered_warden` | warden | Never leaves a radius-2 tether around its object or door; hits hard; heals and resets when you leave. | tether(2) | Avoid it; lure it aside with noise; shoot from outside the tether. |
| `patrol_guard` | warden | Walks a patrol route with a 90° lamp cone. On sighting you, raises the alarm (1 turn), then pursues; returns to its route after 20 turns. | awake (patrol), alarm | Sight-blockers; timing; uniform; closed sign. |
| `herald` | support | Slow. On sighting you it rings for 1 telegraphed turn, waking every dormant exhibit within 6 tiles. | prox(5) | Silent surprise kill; break line of sight; dust sheet. |
| `night_watchman` | warden | Enters at closing stage 3; pursues relentlessly; if defeated, returns after 20 turns. | clock(3) | Leave the department. |
| `conservator_healer` | support | Stays behind allies; channels 1 turn to restore an ally (M) or reseal a broken case; flees when approached. | ally_hit | Kill it first; interrupt the channel. |
| `pulse_emitter` | support | Stationary. Every 3 turns pulses a radius-2 aura with one status per species (warded allies, or slowed, soaked or faded on you). | prox(4) | Disable it (2 turns adjacent); fight outside the radius. |
| `diorama_spawner` | support | A glass-fronted scene. Once awake, releases 1 inhabitant every 3 turns, up to 4. Closing its shutter (2 turns adjacent) or breaking its frame stops it. | noise(3), touch_case | Close the shutter quietly; don't wake it. |
| `escapement` | skirmisher | Acts every second turn, moving 2; attacks only on its beat. Hunts ticking things and noise. | noise(2), ticking | Act on its off-beat; drop ticking items. |
| `keeper` | support (neutral) | A resident who lends, trades or refuses. Hostile only after a Claim (taking without asking, harming residents). | awake, neutral | Ask; return loans; don't steal. |
| `rival_visitor` | skirmisher (neutral) | Another visitor racing you to the highlights; trades items and rumours; fights if robbed or cornered. | awake, neutral | Bargain; race it; leave it be. |
| `completing_guardian` | masterpiece_component (or elite warden) | Guards the Centrepiece or an exit. Its stage (0–4) is galleries you have explored ÷ 2, and each stage adds a limb (an ability). If you leave its room it heals and drops one stage. | its room | Come early, or explore and bring the tools; retreat to strip a stage. |
| `mp_colossus` | masterpiece_component | 2×2, slow; telegraphed sweeps and slams that reshape the room (break cases, topple columns). | room entry | Read the telegraphs; use the rubble. |
| `mp_ensemble` | masterpiece_component | 3–5 linked pieces on one HP pool, one of them the original. When a piece falls, the rest gain its special. | room entry | Kill order: the original first. |
| `mp_tableau` | masterpiece_component | Stationary framed scene; casts telegraphed area patterns and summons from its frame; takes ×2 damage while summoning. | room entry | Dodge the patterns; punish the summons. |

`completing_guardian` is the A Bao A Qu pattern (literature-museology F4): a guardian that grows more complete as you climb, and tumbles back if you fail. It turns the exploration-versus-rushing choice into a fight parameter. The Completist brings more tools to a stronger guardian; the Tourist meets a weak one empty-handed.

### 2.2 Signals and fit

Persona column: + favours, − punishes, using the short names from §1.1. Ship column: L = launch, L+ = launch if time allows, later = after launch.

| id | silhouette (alt) | tag | idle tell (constant across departments) | challenge types | personas | counters | ship |
|---|---|---|---|---|---|---|---|
| `plodder` | figure (beast) | pursuer | slow two-frame sway | swarm, attrition | baseline | melee, choke | L |
| `darter` | beast (small) | pursuer | hops in place every 2 s | attrition | +Van −Tou | melee, choke, ranged | L |
| `pack_hunter` | beast | pursuer | head turns to nearest packmate | swarm | +Cau −Com | choke, aoe, burst | L+ |
| `pilferer` | small (figure) | pursuer | glances left, right | attrition | +Van −Loo | burst, ranged, choke | later |
| `charger` | beast (mass) | pursuer | front dips, scrapes | hazard_terrain | +Cau −Tou | timing, los, displace | L |
| `shield_bearer` | figure | pursuer | glint on its facing side | guarded | +Cau −Van | displace, status | L+ |
| `kiter` | figure (flier) | ranged | steps 1 px back and forth | artillery | +Van(ranged) −Com | los, ranged, choke | L |
| `lobber` | mass (figure) | ranged | top bobs up and down | artillery | +Tou −Cau | timing, melee | L |
| `axis_sniper` | tall | ranged | a glint runs along its row | artillery | +Snk −Tou | los, timing | L |
| `mote_swarm` | cluster | pursuer | dots jitter | swarm | +Van(aoe) −Com | aoe, choke | L |
| `light_swarm` | cluster (flier) | pursuer | dots orbit, drifting toward light | darkness, swarm | +Snk −Loo −Com | light_ctl, aoe | L |
| `splitter` | mass | pursuer | wobbles (1 px wider, narrower) | swarm, attrition | +Tou −Van | burst, aoe | L |
| `binder` | figure (framed) | controller | a thread flickers from it | artillery, guarded | +Cau −Tou | los, ranged | L |
| `displacer` | flier (figure) | controller | 1-px afterimage shimmer | hazard_terrain | +Cau −Tou | los, timing | L |
| `dimmer` | flier (small) | controller | dark halo pulses | darkness | +Snk −Loo −Com | light_ctl, burst | L+ |
| `reflector` | tall (figure) | controller | a highlight sweeps its surface | artillery | +melee −ranged builds | melee, aoe | L |
| `demonstrator` | tall (mass) | conditional | dial hand ticks; track arrows on the floor | hazard_terrain, locks_puzzle | +Cau −Tou | timing, avoid | L |
| `unobserved_mover` | figure | conditional | none: never animates while seen | guarded, darkness | +Cau −Tou −Snk | light_ctl, timing | L |
| `mimic_vitrine` | case | hidden | glass glint "breathes" every ~4 s | attrition | +Tou −Loo | examine, ranged | L |
| `wall_lurker` | small (beast) | hidden | dust trickles from its wall tile | guarded, darkness | +Van −Snk | examine, avoid | later |
| `path_follower` | figure | conditional | copies your last pose a beat late | locks_puzzle | +Tou −Com | timing, avoid | L |
| `tethered_warden` | figure (beast) | warden | faces its object; slow orbit | locks_puzzle, guarded | +Tou −Loo | ranged, displace | L |
| `patrol_guard` | figure | warden | lamp cone sweeps | guarded | +Snk −Van −Tou | stealth, los, timing | L |
| `herald` | tall (figure) | support | bell sways | guarded, swarm | +Snk −Tou | stealth, burst, los | L |
| `night_watchman` | figure | warden | lamp swings | attrition | +Tou −Com | avoid | L |
| `conservator_healer` | figure | support | green glint at its hands every 3 s | attrition | +Van(burst) −Cau | burst, ranged | L |
| `pulse_emitter` | tall (case) | support | a ring expands every 3 turns | hazard_terrain, attrition | +Van −Cau | burst, avoid | L+ |
| `diorama_spawner` | case | support | figures inside shift between frames | swarm | +Snk −Cau | stealth, timing, burst | L+ |
| `escapement` | beast | conditional | metronome step on its beat | guarded | +Snk −Loo | timing, stealth | L |
| `keeper` | figure | neutral | turns a page | social | +Com −Van −Loo | social | L+ |
| `rival_visitor` | figure | neutral | looks from exhibit to exhibit | social, attrition | +Tou −Com | social, avoid | L+ |
| `completing_guardian` | huge (figure) | masterpiece | missing limbs drawn dashed, filling in by stage | attrition | +Tou −Com | timing, burst | L |
| `mp_colossus` | huge | masterpiece | per Masterpiece | hazard_terrain | – | timing | L+ |
| `mp_ensemble` | figure ×3–5 | masterpiece | per Masterpiece | swarm | – | examine, burst | L |
| `mp_tableau` | framed (huge) | masterpiece | per Masterpiece | artillery | – | timing, burst | L |

**Notes on signals.**
- `unobserved_mover` is the only archetype with no idle animation. Its stillness is the tell.
- Ambushers must stay fair:
  - `mimic_vitrine` shows its tell on examine (a label with no accession number) and in a faint glass glint.
  - `wall_lurker` shows dust on its tile.
  - Neither shows its tag until it is revealed.
- Dormant exhibits play their idle tell once every 4 seconds at half amplitude. A player can therefore read a gallery's archetypes before waking it, which is what makes sneaking a planned activity.

### 2.3 Telegraphed specials

Only champions, wardens marked elite and Masterpiece parts carry specials. A special is deterministic: it always hits a marked tile and never hits anything off it. A telegraph that then misses on a die roll "feels like a lie" (roguelike-systems, pitfall 9).

| id | shape | telegraph | effect | ship |
|---|---|---|---|---|
| `line` | its row or column, range 8 | tiles marked 1 turn ahead | damage L | L |
| `cone` | 3-wide cone, range 4 | 1 turn | damage M plus one status | L |
| `ring` | the 8 tiles around it | 1 turn | damage M plus push 1 | L |
| `burst` | 3×3 at a target tile | 1 turn | damage M | L |
| `sweep` | 5-tile arc in front | 1 turn | damage L | L |
| `charge` | a line to range 5 | 1 turn | moves and hits; stops at obstacles and breaks glass | L |
| `summon` | from its frame or case | 2 turns | 1–2 fodder or swarm bodies of the department's species | L |
| `shatter_all` | every vitrine in the room | 2 turns | breaks them: shards, released contents | L |
| `cross` | row and column, range 5 | 1 turn | damage M | L+ |
| `pull` | a line to range 5 | 1 turn | pulls you adjacent | L+ |

### 2.4 Masterpiece assembly (ids only)

A Masterpiece is built from these parts:
1. **One core:** `mp_colossus`, `mp_ensemble`, `mp_tableau` or `completing_guardian`.
2. **One or two attachments** from {`herald`, `pulse_emitter`, `diorama_spawner`, `conservator_healer`, `reflector`, `demonstrator`, `tethered_warden`}.
3. **Two or three specials** from §2.3.
4. **The department's signature module** at its strongest setting. The Masterpiece always tests the primary challenge (roguelike-systems §3.4).
5. **Phases** at 2/3 and 1/3 HP. Each phase adds a special or wakes an attachment, after SPD's ramping bosses (roguelike-systems F7).
6. **Gallery hooks:**
   - if the alarm was raised, add one attachment;
   - awake wardens and heralds in the coda join the fight.

Whoever designs the Masterpiece fights owns them; this list is the vocabulary they may use.

### 2.5 Set pieces that need no new verbs

Brogue's blueprint catalogue (roguelike-systems F11) maps onto existing ids.

| Brogue blueprint | Museum set piece | Vocabulary used |
|---|---|---|
| Mixed item library ("check one item out at a time") | Loan Desk | 3 catalogued items; taking one cages the others |
| Kennel ("choose one or two to unlock") | Conservation Storage | `animate_ally` on one dormant exhibit |
| Statuary ("take key … statues burst") | Highlight on a pressure plinth | `heist_plinths` |
| Flood room | Sunken gallery | `tide_cycle` |
| Worms in the walls | Open storage | `wall_lurker` |
| Throwing tutorial (pressure plate) | Plinth switch | `throwable` plus a pressure plinth |

### 2.6 Sketch yields (provisional)

This applies only if the Copyist's sketch becomes a verb; that is the classes drafter's call. The rule:
- Sketching an exhibit yields its signature as a one-charge instrument at magnitude S.
- The yield is drawn from existing primitives (§5), so sketching never adds verbs.

| archetype | yields | archetype | yields |
|---|---|---|---|
| `charger` | `knockback` S on the next 3 hits | `unobserved_mover` | `not_on_view` on you, S |
| `shield_bearer` | `armour` S to department exit | `mimic_vitrine` | `recase` S |
| `kiter` | `bolt(edge)` S | `patrol_guard` | `uniform` S to department exit |
| `lobber` | `area_status(dazed)` S | `conservator_healer` | `heal` S |
| `axis_sniper` | `bolt(light)` S | `pulse_emitter` | `warded` on you, S |
| `binder` | `on_hit(rooted)` S, 3 hits | `diorama_spawner` | `animate_ally` S |
| `displacer` | `displace` S | `escapement` | `hasted` S |
| `dimmer` | `extinguish` S | `light_swarm` | `flash` S |
| `reflector` | `ranged_guard` S to department exit | (all others) | nothing; the Catalogue still records them |

### 2.7 Worked compile: the six sample labels

These are the six labels from literature-museology §3.3, compiled into ids.

| Sample label | Compiles to | Notes |
|---|---|---|
| Escapement Hound | `escapement` (skirmisher) + `clockwork` + `old_repair` (side: left); wake noise(2), ticking | "Acts every second turn, moving two tiles; aggro only toward ticking items and noise; weak on the left" is the archetype plus two modifiers. Ticking curios (pocket watches) in the item pool make it hunt you. |
| Lectern Moth | `light_swarm` (swarm) + `paper`; on_hit spoil(paper); module `photosensitive` | "Lowering the lantern hides you" is the module's counterplay. |
| Umbrella for Indoor Weather | curio, toggled: `ranged_guard` M; drawbacks `narrow_view` and `fragile` M | "Halves ranged and falling damage" is M; "three breaks left" is fragile M. It fits Tides via `weather_cases`. |
| Ledger of Debts Forgiven | **Does not compile.** It needs a shop-debt primitive and the `living_community` module. | Logged to the unmatched-concept queue; it ships with Peoples. This is the no-silent-fallback rule working. |
| Figure of a Visitor, Looking | `path_follower` (ambusher) + `plaster`; wake: path | "Follower of" is both its attribution and its AI. It belongs to Attendance (later) but is usable now in any family. |
| Portable Doorway, Folding | instrument: `pass_wall` M, with destination weights {coda shop 2/3, staff layer 1/3} | Weighted destinations are allowed only on unique (keepable) items. |

---

## 3. Modifiers

Modifiers stack on archetypes and are the main way a department's subject reaches its mechanics: a porcelain department breaks differently from a bronze one.

**Stacking rules.**
- At most two modifiers per species.
- At most one material and at most one provenance.
- `champion` goes on at most one species per department: the gateway exhibit.

**Effects are priced, not re-normalised.**
- The material sets the tombstone's Medium line, which the S4 round-trip check verifies.
- The cost class feeds the encounter budget (§10.4).

| id | kind | effect | tombstone cue | cost | ship |
|---|---|---|---|---|---|
| `porcelain` | material | HP ×0.6; blunt ×1.5; on death leaves shards in radius 1 | "porcelain"; Fragile icon | 0 | L |
| `bronze` | material | blunt ×0.5; cannot be pushed; every hit on it rings (noise 2) | "bronze"; bell icon | +1 | L |
| `marble` | material | edge ×0.5; one speed class slower; immune to cut and burning | "marble" | +1 | L |
| `paper` | material | fire ×2 and ignites; burning spreads to adjacent paper and textile; +1 stealth in dim | "paper"; flame icon | −1 | L |
| `glass` | material | its body does not block sight; reflects beams; blunt ×1.5; leaves shards on death | "glass" | 0 | L |
| `lacquer` | material | immune to rooted; leaves a slick trail for 5 turns | "lacquer" | 0 | L+ |
| `textile` | material | moves silently; faded on bright tiles; fire ×1.5 | "textile; shown at 50 lux" | 0 | L |
| `wax` | material | on fire or bright tiles: slowed, and leaves slick; regenerates S in cold rooms | "wax" | 0 | later |
| `plaster` | material | a cast: HP ×0.7; on death crumbles into a dust cloud (radius 1, 3 turns) | "plaster cast after …" | −1 | L |
| `clockwork` | material | ticks (noise 1 each turn, shown on the map); shows its next move as an arrow; immune to dazed; water stops it for 2 turns | "brass, steel; escapement" | −1 | L |
| `pigment` | material | its hits apply stained; immune to stained | "iron-gall ink" | +1 | L+ |
| `luminous` | condition | emits light (radius 2, +1 lux); draws light swarms; reveals not_on_view nearby | "luminous paint" | 0 | L |
| `old_repair` | condition | one marked side (a paler patch on the sprite) takes ×2 damage | "left foreleg a later repair" | −1 | L |
| `restored` | condition | regenerates S per turn while not adjacent to you | "recently conserved" | +1 | L+ |
| `pendant` | provenance | spawns as a pair; when one falls the other is hasted for the rest of the fight | "one of a pair" | +1 | L |
| `forgery` | provenance | the tombstone reads "Attributed to" a stronger archetype until examined at Circle of; it is actually one tier weaker | "Attributed to …" | −1 | later |
| `on_loan` | provenance | one tier stronger; destroying it raises a Claim with its lender; leaving it dormant earns a credit-line reward | "Lent by …" | +1 | later |
| `champion` | elite | +1 role tier; gains one special (§2.3); gold outline | gateway label | +2 | L |

**The honesty rule.** `forgery` is honest because "Attributed to" is the museum's own declared uncertainty (ARLIS/NA–VRA qualifiers, via literature-museology F24). Outright lies exist only inside the `lying_labels` module (§6), following literature-museology pitfall 7: unreliability belongs to a named module, never to accidents.

### 3.1 Material interactions (the complete list)

The engine implements these six interactions and no others. Every emergent combination of modifier, surface and status must come from them.
1. **Fire** on paper, textile or wooden furniture ignites it; burning spreads 1 tile per turn through flammables.
2. **Water** (soaked, flood, rain) puts out burning and stops clockwork for 2 turns.
3. **Blunt** hits on porcelain, glass, vitrines and lamps shatter them into shards.
4. **Light** (bright tiles, light bolts, flash) fades textile and melts wax. Photosensitive species respond as their module says.
5. **Beams** pass through glass bodies and vitrines, and reflect off reflectors and glass-modified bodies.
6. **Pushes** into furniture deal collision damage. A push into a vitrine cracks it. A push of 2+ tiles over a balustrade makes the target fall.

---

## 4. Status effects

Fifteen statuses, each one sentence long. "Both" means the status can apply to the player and to enemies.

| id | icon | effect | duration | typical sources | ends when | ship |
|---|---|---|---|---|---|---|
| `burning` | flame | S damage per turn; spreads to adjacent flammables; your tile counts as lit | S | spirit lamp, fire, paper | water, soaked, time | L |
| `soaked` | droplet | immune to burning; movement noise +1; paper and textile actors are slowed | M | tide, rain, pools | a dry room, time | L |
| `cut` | shard | lose a little HP per tile moved (not per turn) | until rest | shards | 3 turns standing still; tonic | L |
| `rooted` | pin | cannot move; can still attack and use items | S | binder, mimic, on-hit | time; displace frees you | L |
| `slowed` | snail | movement costs 2 turns; attacks are normal | M | cold rooms, wax, tides | time; hasted cancels it | L |
| `hasted` | wing | movement costs half a turn | S | consumables, pendant | time | L+ |
| `dazed` | swirl | skips its next action, then −1 accuracy class for 2 turns | S | flash, charger collision | time | L |
| `blinded` | closed eye | sight radius 1; cannot read labels; −2 ranged accuracy classes | S | flash, dimmer | time | L |
| `stained` | ink blot | hunters within 8 tiles know where you are, whatever the light or cover | M | pigment hits | solvent; soaking | L+ |
| `faded` | sun | −1 damage class | on bright tiles, then S | bright light on textile, light bolts | darkness | L |
| `warded` | glass pane | the next hit is absorbed completely; it breaks with a crack (noise 2) | until hit, or L | conservator, pulse emitter | the hit | L |
| `restoring` | green plus | regenerate S per turn | M | tonic, conservator | time | L |
| `dormant` | closed plinth | asleep; surprise attacks always hit and take the surprise multiplier | until woken | start state, dust sheet, lull | its wake triggers (§1.2) | L |
| `toured` | flag | an ally that follows you and fights for you; returns to its case at department exit | M, or to exit | animate_ally, Docent | you hit it; department exit | L |
| `not_on_view` | dotted outline | invisible until adjacent or until it acts; ranged attacks cannot target it | while its source lasts | the Absence module; a consumable for you | flash, luminous, dust sheet | later |

---

## 5. Items

### 5.1 Item schema and budget

**What an item is.** An item is:
- a category (weapon, garment, curio, instrument or consumable);
- one to three primitives, each with a magnitude;
- at most one drawback;
- a forgery state.

**Budget points.**

| Thing | Points |
|---|---|
| S primitive | 1 |
| M primitive | 2 |
| L primitive | 3 |
| a drawback | −1 (refund) |

Caps:
- Ordinary items: 3 points or fewer.
- Highlights: 4 or fewer.
- The department's keepable artifact: 5 or fewer, and it may use one parameterised primitive (weighted destinations, a chosen status).

The Handling Clearance requirement and all numbers come from run depth through the balancer.

**What each attribution rung reveals** (roguelike-systems §3.6):

| Rung | Reveals |
|---|---|
| After | category |
| Manner of | whether it is a forgery |
| Circle of | primitive families |
| Workshop of | exact primitives and magnitudes |
| Attributed to | restoration level |
| By | everything, including the drawback |

**Forgeries are the curses.**
- An equipment forgery binds: it cannot be unequipped until uncursed. One of its primitives is also inverted (for example, muffled becomes noisy).
- Consumable forgeries have the per-kind effects listed in §5.4.

### 5.2 Effect primitives by category (40)

**Weapon (8).** Every weapon has exactly one `strike_kind`.

| id | effect | S / M / L | ship |
|---|---|---|---|
| `strike_kind(kind)` | sets the damage kind (§1.5) and the weight class | S light and fast (½-turn attack, −1 damage class) / M standard / L heavy (+1 Handling Clearance, slower attack) | L |
| `reach` | attacks 2 tiles in a straight line | flag | L |
| `sweep` | hits all 3 front-arc tiles at −1 damage class | flag | L |
| `knockback(m)` | pushes the target 1/2/3 tiles; a collision adds damage and cracks glass | S/M/L | L |
| `surprise_bonus(m)` | damage against dormant or unaware targets ×1.5/×2/×3 | S/M/L | L |
| `breaker` | breaks cases and crates in one hit at −1 noise; ×1.5 against glass, porcelain and plaster | flag | L+ |
| `on_hit(status, m)` | 15/30/50% chance to apply one of: burning, soaked, rooted, dazed, stained, slowed | S/M/L | L |
| `throwable(m)` | can be thrown to range 3/5/8 and picked up again | S/M/L | L+ |

**Garment (7).**

| id | effect | S / M / L | ship |
|---|---|---|---|
| `armour(m)` | damage reduction class | S/M/L | L |
| `resist(kind, m)` | damage of one kind ×0.75/×0.5/×0.25 | S/M/L | L |
| `ranged_guard(m)` | projectile and falling damage ×0.75/×0.5/×0.25 | S/M/L | L+ |
| `muffled(m)` | your noise −1 when moving / −1 always / −2 always | S/M/L | L |
| `low_profile(m)` | hunters notice you 1/2/3 tiles later on dim or dark tiles | S/M/L | L |
| `sure_footed` | immune to slick, to cuts from shards, and to pushes of 1 | flag | L |
| `uniform(m)` | guards ignore you beyond 4/3/2 tiles until an alarm is raised | S/M/L | L+ |

**Curio (8).** Rings and artifacts; passive or toggled.

| id | effect | S / M / L | ship |
|---|---|---|---|
| `regen(m)` | HP regeneration | S/M/L | L |
| `evasion(m)` | enemy hit chance −5/−10/−15 points | S/M/L | L |
| `perception(m)` | S: hinged panels and mimic tells within 2 tiles; M: also not_on_view within 3; L: also the tag of dormant exhibits in view | S/M/L | L |
| `clock_extension(m)` | closing clock +10/20/30% (often paired with the `ticking` drawback) | S/M/L | L |
| `attribution(m)` | use-identification 25%/50% faster; L: new items start at Circle of | S/M/L | L+ |
| `ally_bond(m)` | toured allies +25% HP / +1 ally slot / both | S/M/L | later |
| `light_control(m)` | S: adds a hooded lantern setting (radius 1, does not draw swarms); M: +1 lantern radius; L: both | S/M/L | L |
| `wake_damper(m)` | dormant exhibits' prox and noise thresholds −1/−2/−3 (radius never below 1) | S/M/L | L+ |

**Instrument (8).** Wand analogues. Charges are 1/2/3 (S/M/L); the balancer sets recharge.

| id | effect | S / M / L | ship |
|---|---|---|---|
| `bolt(kind)` | ranged damage of one kind, range 5 | S/M/L | L |
| `displace` | push or pull a target 1/2/3 tiles | S/M/L | L |
| `pass_wall(dest)` | opens a doorway through a wall for 5/10/20 turns; `dest` defaults to the other side (weighted lists only on unique items) | S/M/L | L+ |
| `lull` | returns awake, not-hunting exhibits to dormant: one target / radius 1 / radius 2 | S/M/L | L |
| `animate_ally` | wakes a dormant exhibit as a toured ally for 10/20/40 turns; S fodder or skirmisher, M up to brute, L any non-Masterpiece | S/M/L | L |
| `flash` | dazed and blinded in radius 1/2/3; reveals not_on_view; lights the area for 5 turns; noise 2 | S/M/L | L |
| `extinguish` | lux −2 in radius 1/2/3 for 10 turns; puts out burning | S/M/L | L |
| `recase` | puts an adjacent enemy at ≤25/40/60% HP into an empty case or plinth; it leaves the fight for good | S/M/L | L+ |

**Consumable (9).** Single use. A consumable kind may also use any instrument primitive once, at the kind's magnitude.

| id | effect | S / M / L | ship |
|---|---|---|---|
| `heal(m)` | 25/50/100% of max HP | S/M/L | L |
| `cure(set)` | ends the listed statuses | flag | L |
| `identify(m)` | S: one rung on one item; M: one item fully; L: one item fully and flags every forgery you carry | S/M/L | L |
| `reveal(m)` | S: current gallery; M: department plan; L: plan, highlights and exit placards | S/M/L | L |
| `uncurse` | ends a forgery's bind on one item | flag | L |
| `clock_shift(m)` | closing clock back 30/60/100 turns (forward, for forgeries) | S/M/L | L |
| `area_status(status, m)` | a thrown zone of burning, soaked, dazed, blinded or slick, radius 1/2/3 | S/M/L | L |
| `place(feature)` | places a slick zone (radius 1) or a barricade (one doorway; enemies cannot path through) for L turns | flag | L+ |
| `exit_jump` | moves you to the nearest exit door or back to the department entrance (your choice) | flag | L |

### 5.3 Drawbacks (5)

Each drawback refunds one budget point.

| id | effect | ship |
|---|---|---|
| `noisy` | your noise +1 at all times | L |
| `ticking` | you count as ticking (escapements hunt you); noise 1 shown on the map | L |
| `luminous_self` | you emit light in radius 1, so your tile is never dark | L |
| `narrow_view` | while active, sight is a forward cone only | L |
| `fragile(m)` | breaks after 5/3/1 uses or hits taken | L+ |

### 5.4 The fixed consumable kinds (12)

SPD's own developer counts "about 50 different types of consumable items" as a failure mode: players die "with loads of consumables that they've basically forgotten about" (roguelike-systems F9). Department-specific consumables would multiply that problem. So there are twelve kinds. Departments reskin them; they never add kinds.

| id | museal name | effect | forgery effect | use | ship |
|---|---|---|---|---|---|
| `tonic` | Restorative tonic (café flask) | heal M; cure cut, faded, slowed | heal S and stained ("it was tea") | drink | L |
| `catalogue_card` | Catalogue card | identify M | blank: one carried item drops one rung | read | L |
| `floor_plan` | Floor plan | reveal M | superseded: reveal S only, stamped SUPERSEDED | read | L |
| `audio_guide_cassette` | Audio-guide cassette | perception L for 20 turns: tags, wake triggers and telegraphs of everything in view | plays aloud: noise 3 at your tile | play | L |
| `solvent` | Conservation solvent | uncurse; cure stained. Thrown: removes warded and slick | "it was ink": stained | apply / throw | L |
| `evacuation_card` | Evacuation card | exit_jump | sends you to a random gallery | read | L |
| `late_pass` | Late pass | clock_shift M | clock moves forward by S | show | L |
| `flash_bulb` | Flash bulb | flash M, thrown | goes off in your hand: dazed and blinded S | throw | L |
| `spirit_lamp` | Spirit lamp | burning S in radius 1, and the area lit for 10 turns | fizzles: only the light, which draws swarms | throw | L |
| `dust_sheet` | Dust sheet | lull S on one adjacent exhibit that is not hunting; it stays dormant until uncovered or hit. Thrown on a not_on_view actor, it shows the shape | too small: wakes the target | cover / throw | L |
| `wet_floor_sign` | Wet-floor sign | place a slick zone | the slick zone is under you | place | L+ |
| `closed_sign` | "Gallery closed" sign | place a barricade | it blocks you, not them | place | L+ |

**Reskin contract.** Each department supplies twelve skin slots, each with a name of four words or fewer, a material and a palette. The binding of kinds to skins is decision D-V7. Until a kind is known, an unidentified consumable's tombstone shows only "After [department]".

### 5.5 Never reskinned

Three items are economy anchors. Each has one appearance everywhere and is always identified:
- **Restoration kit**: the single upgrade currency;
- **keycard**: Handling Clearance;
- **Certificate**.

This keeps the guaranteed quotas legible across random department order (roguelike-systems F1).

---

## 6. Rule modules

### 6.1 Contract

- **Slots.** A department has exactly one **signature module** from its family's list. It may add at most one **secondary module**, either from another family or from the generic list (`alarm_network`, `climate_zones`). See D-V6.
- **Teaching.**
  - The Intro gallery teaches only the signature module, at its weakest setting.
  - The rest of the Intro comes from the orientation pool: fodder, skirmishers and the module's teaching instance.
  - The secondary module is announced on a section panel the first time it is met.
- **Text and icons.** Each module has a section-panel sentence (its Essential line) and a pictogram on the department's door placard.
- **Validation protocol.** This is run per department, at 3 tiers × 50 seeds:
  - **V1 Fires.** The module's events occur in at least 90% of seeds.
  - **V2 Matters.** The module-blind variant of the median persona does worse than the module-aware variant. The default margin is +10 percentage points in death rate, or −15% of max HP at exit. Each module may name its own margin (Table B).
  - **V3 Teachable.** The aware novice Cautious passes the Intro gallery at least 95% of the time; the blind one fails it at least 30% of the time. The Intro must *require* the mechanic (papers-levels F18).
  - **V4 Not degenerate.** The aware expert's death rate stays above a floor, so the module is not a free win. Route divergence between personas is above zero.

### 6.2 Modules: rules and teaching (Table A)

| id | family | parameters (defaults) | Intro gallery | counterplay |
|---|---|---|---|---|
| `unobserved_motion` | Specimens (Attendance) | scope: flagged species, or all `figure` exhibits; step 1–2 | A corridor gallery with 2 statues on plinths and a lamp. Panel: "Please keep the exhibits in view." | Keep them in view; walk backwards; keep the lamps on; flash. |
| `copies_weaken` | Copies | groups of 3–5; 1–2 generations; when the original dies, copies weaken (−1 tier, slowed) or shatter | One original bust and two plaster copies, numbered 14.2, 14.2/a, 14.2/b | Find the original (unsuffixed number, often behind glass) and break it first. |
| `identical_rooms` | Copies | 2–4 duplicate galleries; one differs by one detail and leads to the vault | Two adjoining identical rooms; plaque "Gallery 14 (copy)" | Mark rooms with dropped items; floor plan; look for the difference. |
| `photosensitive` | Light | 30–60% of species photosensitive; room lux; labels unreadable below lit | A dark gallery, one dormant lectern-moth swarm, one lit label. Panel: "Please lower your lantern." | Lantern low or off; throw light decoys; read labels quickly. |
| `staged_lights` | Light | each stage lasts 30–60 turns; far-to-near or random order; 1–3 fuse panels | A flickering lamp dies 6 turns after entry; a fuse panel restores it for 20 turns | Route through lit sections; restore fuses; carry a flash. |
| `tide_cycle` | Tides | period 12–20; peak stage 1 (shallow) or 2 (deep); 30–60% of floor at height 0 | Sunken gallery, raised walkway, tide gauge; first rise at turn 8 (§6.5) | High ground; time crossings; lure non-swimmers into deep water. |
| `weather_cases` | Tides | 20–40% of cases hold weather (rain, fog, gust, frost); 10 turns | A fog jar beside a dormant kiter: break it, then cross unseen | Break jars on purpose; keep artillery away from jars. |
| `hourly_demonstration` | Machines | period 8–16; a bell 2 turns ahead; demonstrators and clockwork species act on the bell | One automaton whose sweep crosses the only path; its label lists the times | Wait for the bell; lure enemies into the sweep. |
| `moving_partitions` | Machines | 2–6 movable blocks; on a schedule or crank-only; a crush deals M damage and pushes | One compactor aisle and a crank. Panel: "Do not enter aisles while shelving is in motion." | Crank to trap enemies or open routes; never stand in a closing aisle. |
| `climate_zones` | generic (Specimens, Tides) | rooms tagged cold, humid or dry; 1–2 thermostat panels | A cold room with a radiator and a slowed beast | Pass quickly; dry off; switch thermostats. |
| `heist_plinths` | Specimens (Classification) | wakes the room or the section; lockdown 0–6 turns; substitution on or off | One highlight on a pressure plinth, 2 dormant plodders, and a spare plaster bust beside it | Substitute an object of similar size; clear the room first; plan the exit. |
| `taxonomy_aggro` | Classification | 3–4 arbitrary classes, shown as a code letter on labels; scope section or department; +1 damage class against a class once you have read 3 of its labels | 3 exhibits in 2 classes; hitting one wakes its classmate across the room | Wake one class at a time; avoid the big class; read labels. |
| `sorting_vault` | Classification | 3–4 groups × 3–4 items; 0–2 red herrings; a wrong placement makes noise 2 | A 2×2 sort with obvious categories | Read labels; a catalogue card reveals one category. |
| `lying_labels` | Classification (Writing) | 20–40% of labels lie; a lie swaps archetype within role, or effect within category; where the errata sheet is | One wrong label in the Intro, with its "re-attribution pending" stamp visible. The panel names the disgraced registrar. | Trust the object (tag, idle tell), not the card; find the errata. |
| `alarm_network` | generic (Attendance) | 2–5 guards; zones = sections; alarm lasts 20–40 turns; each alarm advances the clock by S | One guard on a short loop and an alarmed rope line. Panel: "This gallery is alarmed." | Sight-blockers; patrol timing; disable panels; uniform; closed sign. |
| `fading_map` | Memory | fades after 40–80 turns unvisited; hunters forget you in half the time | A loop of 3 rooms; the first fades 12 turns after you leave it | Floor plan; landmarks; use the forgetting to shake pursuit. |
| `funes_rule` | Memory | scope: consumables, or all items | Two tonics labelled "this tonic at 3:14" and "this tonic at 3:15" | Catalogue cards; test by use; skip consumables. |
| `scale_models` | Scale | 1–2 enterable models; each linked to a door, lamp or guard post | A model of the Intro gallery itself | Scout and unlock through the model. |
| `absent_exhibits` | Absence | up to 40% of species invisible; dust footprints; revealed when adjacent | An empty plinth with a label, and dust leading away | Flash; dust sheets; follow footprints; listen. |
| `empty_plinths` | Absence | 2–4 empty plinths; a displayed item's aura covers the room; displayed items can be stolen | Put the lantern on a plinth: the room is lit | Place items before fights; guard the plinth. |
| `script_legibility` | Writing | 4–6 glyphs to learn; 1–3 inscriptions (each a one-shot instrument primitive at S) | A half-legible label teaches 1 glyph | Read early in safe rooms; the audio guide bypasses it. |
| `visitor_visibility` | Attendance | a tour line through 40–70% of galleries; a meter with 3 thresholds | A tour line on the floor; stepping off it raises the meter | Follow the tour; mingle with crowds; stay on dim tiles. |
| `gaze_wake` | Attendance | range 4–6; 2 consecutive observed turns wake | A portrait gallery. Panel: "Please do not stare." | Lantern low (you see less); move behind blockers; cross quickly. |
| `living_community` | Peoples | 3–6 residents; 2–4 lendable objects; Claim severity | A keeper at a table offers one loan; the panel has two voices | Ask; return loans; trade. |

**Parameter notes.**
- **`climate_zones`.** Cold rooms slow non-clockwork actors after 3 turns. Humid rooms cost metal weapons a damage class until dried, and make paper consumables unreadable until dried. Dry rooms double fire spread. Humidity rusting weapons is one of the book's own examples (book-pcg F12).
- **`lying_labels`.**
  - It extends pillar 2 rather than breaking it: the object never lies, only the card does.
  - The sprite's tag and idle tell stay true, so the module teaches the tell grammar.
  - The S4 honesty check runs against the declared list of lies and must find exactly those.
- **`sorting_vault`.**
  - Its categories are semantic, which suits LLMs (Connections puzzles, papers-semantic F20).
  - A solver certifies that there is exactly one solution, and Julian reviews the categories.
  - It is never on the critical path: failing it costs the vault, never the exit.

### 6.3 Modules: validation and compatibility (Table B)

"Blind vs aware" names the bot comparison that proves the module matters (V2). The programme column uses the launch programmes from the direction memo; ++ means preferred and × means forbidden.

| id | blind vs aware (V2) | produces | programmes | other constraints | ship |
|---|---|---|---|---|---|
| `unobserved_motion` | gaze-blind takes ≥2× damage from flagged species | guarded, darkness | ++ sculpture_court, grand_hall; storage_stacks ≤2 movers | × gaze_wake. With staged_lights: step 1 and ≤2 movers | L |
| `copies_weaken` | nearest-first takes ≥25% more damage in copy groups than original-first | swarm, locks_puzzle | ++ case_labyrinth, sculpture_court | ≥2 copy groups | L |
| `identical_rooms` | Tourist turns ≥ +30% against control; Completist finds the vault ≥80% | locks_puzzle, attrition | ++ enfilade, storage_stacks; × sculpture_court | never the first department of a run | L+ |
| `photosensitive` | always-high-lantern takes ≥2× damage from photosensitive species; aware reads fewer labels (a visible trade-off) | darkness, swarm | ++ storage_stacks, enfilade; grand_hall needs a lux override | ≥1 light decoy in the item pool | L |
| `staged_lights` | the naive router spends ≥30% of turns in the dark with dark-favoured enemies; aware ≤15% | darkness, attrition | all | with the Power Cut directive, cap at one darkness source | L |
| `tide_cycle` | tide-blind loses ≥20% more HP; ≥1 deep-water entrapment in ≥50% of seeds | hazard_terrain, attrition | ++ grand_hall, sculpture_court; case_labyrinth only with period ≥18; × storage_stacks | ≥15% high tiles reachable from every low region | L |
| `weather_cases` | jar-users beat non-users by ≥10% HP; weather releases in ≥80% of seeds | hazard_terrain, artillery | ++ case_labyrinth | artillery species present (they break jars) | L |
| `hourly_demonstration` | demonstration-blind takes ≥3× damage from demonstrations; experts kill ≥1 enemy with one in ≥30% of seeds | hazard_terrain, locks_puzzle | ++ rotunda, enfilade | every forced crossing has a safe window of ≥3 turns | L |
| `moving_partitions` | crank-users reach the exit in fewer turns; reachability holds in every partition state | locks_puzzle, hazard_terrain | ++ storage_stacks; × rotunda, grand_hall, sculpture_court | the layout validator checks every state | L+ |
| `climate_zones` | zone-blind takes ≥10% more damage or loses ≥1 consumable | attrition, hazard_terrain | all | secondary only at launch | L+ |
| `heist_plinths` | the naive Looter takes ≥20% more damage than the substituting Looter; Tourist is unaffected | locks_puzzle, guarded | ++ case_labyrinth | a substitute object within 6 tiles when substitution is on | L |
| `taxonomy_aggro` | class-blind has ≥30% more enemies awake at once | swarm, guarded | ++ case_labyrinth, storage_stacks | class names are never peoples, nations or faiths | L |
| `sorting_vault` | an oracle reader solves it; random placement fails ≥99%; the solver confirms a unique solution | locks_puzzle | ++ rotunda | optional reward only; Julian reviews | L |
| `lying_labels` | the label-trusting persona makes ≥1 costly misplay per department | locks_puzzle, attrition | all | × script_legibility; never in a run's first 2 departments | L+ |
| `alarm_network` | Sneak dominates; detection-blind raises ≥2 alarms and takes ≥15% more damage; every required route has a ≥3-turn window | guarded | ++ enfilade (staff corridor), storage_stacks; sculpture_court ≤2 guards | – | L |
| `fading_map` | the map-reliant persona takes 20% more turns; Sneak shakes pursuit faster | attrition, guarded | all except spiral | – | later |
| `funes_rule` | identifications per consumable used drop (low stakes) | attrition | all | secondary only | later |
| `scale_models` | model-users reach the vault in fewer turns | locks_puzzle | ++ rotunda, grand_hall | bespoke code | later |
| `absent_exhibits` | revealers take ≤½ the first-strike damage of blind bots | guarded, darkness | ++ sculpture_court, period_rooms; × storage_stacks | – | later |
| `empty_plinths` | placers finish with ≥10% more HP | any | all | – | later |
| `script_legibility` | readers identify ≥2 more kinds | locks_puzzle, attrition | all | × lying_labels; never gates the exit | later |
| `visitor_visibility` | the tour-follower survives more and loots less, both measured | guarded, social | ++ enfilade, temporary-exhibition route | – | later |
| `gaze_wake` | gaze-aware routing takes ≥25% less damage | guarded | ++ enfilade; × case_labyrinth | × unobserved_motion | later |
| `living_community` | the consent-respecting policy scores ≥ Vandal on the composite score; Vandal never dominates | social | ++ period_rooms, courtyard | sensitivity review; ≤1 department in 4 | later |

**Semantic modules need an oracle.** Bots cannot read. For `sorting_vault`, `lying_labels` and `script_legibility`, the bot gets an oracle with a "reading competence" parameter: novices place or believe correctly 50% of the time, experts 95%. The human review in S6 is the real gate for these three.

### 6.4 Module × programme matrix (launch)

Legend: ++ preferred (S2 weights it ×2); + allowed; − allowed only with the caps in Table B; × forbidden.

| module | enfilade | rotunda | grand_hall | case_labyrinth | storage_stacks | sculpture_court |
|---|---|---|---|---|---|---|
| `unobserved_motion` | + | + | ++ | + | − | ++ |
| `copies_weaken` | + | + | + | ++ | + | ++ |
| `identical_rooms` | ++ | + | − | + | ++ | × |
| `photosensitive` | ++ | + | − | + | ++ | − |
| `staged_lights` | + | + | + | + | ++ | + |
| `tide_cycle` | + | + | ++ | − | × | ++ |
| `weather_cases` | + | + | + | ++ | + | + |
| `hourly_demonstration` | ++ | ++ | + | + | + | + |
| `moving_partitions` | − | × | × | − | ++ | × |
| `climate_zones` | + | + | + | + | + | + |
| `heist_plinths` | + | + | + | ++ | + | + |
| `taxonomy_aggro` | + | + | + | ++ | ++ | + |
| `sorting_vault` | + | ++ | + | + | + | + |
| `lying_labels` | + | + | + | + | + | + |
| `alarm_network` | ++ | + | + | + | ++ | − |

**Forbidden pairs and stacking rules.**
- `unobserved_motion` × `gaze_wake`.
- `lying_labels` × `script_legibility`.
- The secondary module never comes from the signature's family.
- Stacking two darkness sources (for example, `staged_lights` plus the Power Cut directive) caps the darker effect.

### 6.5 Worked example: `tide_cycle` in full

The spec as the balancer receives it:

```json
{ "module": "tide_cycle",
  "params": { "period": 16, "peak_stage": 2, "low_floor_share": "M" },
  "essential_line": "In this department the tide reaches the second step every quarter hour.",
  "pictogram": "wave_over_step" }
```

The Intro gallery, from the orientation pool (the layout pipeline places it; this is the content it must contain):

```
###########
#E..====..#    =  raised walkway (height 1)
#.,,,,,,,.#    ,  low floor (height 0)
#.,,p,,,,.#    p  one dormant plodder, not amphibious
#.,,,,,,,G#    G  tide gauge (wall_panel); shows turns to next rise
#..====...X
###########
```

**What happens.**
1. At turn 8, the shallow stage arrives: low tiles slow you and soak you.
2. At turn 11, the deep stage arrives: low tiles become swim-only, with no attacks.
3. The tide recedes at turn 14.

**What the tests check.**
- The plodder drowns if it is lured onto the low floor at turn 10.
- V3 holds if the aware Cautious novice waits on the walkway ≥95% of the time.
- The blind novice, which crosses the low floor at turn 9, must be trapped in ≥30% of seeds.

---

## 7. Furniture and hazards

### 7.1 The movement × sight matrix

The core matrix is "blocks movement" × "blocks sight", after Dahlskog et al.'s Passable and Seethru attributes (via museum-layouts §3.2).

| | Sight passes | Sight blocked |
|---|---|---|
| **Movement passes** | floor, `rope_line` (costs a turn), `bench`, `balcony`, `pool` (slowed) | `curtain`, dark tiles, `dust_cloud` |
| **Movement blocked** | **`vitrine`, `diorama`, `low_furniture`, `balustrade`, occupied `plinth`, `weather_jar`** | wall, `column`, `shelving`, `partition`, `crate`, `hinged_panel` |

The bold cell is the museum's own contribution. It gives:
- ranged duels across glass;
- "see the loot you can't reach";
- beams through vitrines.

**Projectile rules.**
- Bolts and arrows stop at anything that blocks movement and stands above knee height. Vitrines take a crack instead.
- Lobbed attacks arc over vitrines and low furniture.
- Beams pass through glass.

### 7.2 Fixtures (19)

Column key:
- **shots**: what happens to bolts and arrows.
- **break**: hits to break it, and the result.
- **elev**: stand on it for height.
- **push**: can be pushed.
- **1-way**: passable in one direction only.

| id | move | sight | shots | break | noise | elev | push | 1-way | notes | ship |
|---|---|---|---|---|---|---|---|---|---|---|
| `column` | blocks | blocks | stop | – | – | – | – | – | statues and columns; pillar loops; a charger's target | L |
| `vitrine` | blocks | passes | stop, 1 crack each | 2: shards r1, contents released, alarm under `alarm_network` | 3 | – | – | – | the signature cell; an occupant whose case breaks cannot return to dormancy | L |
| `diorama` | blocks | passes | stop | 3: releases inhabitants | 3 | – | – | – | houses `diorama_spawner`; its shutter closes in 2 turns | L+ |
| `low_furniture` | blocks | passes | pass | – | 1 to climb | – | – | – | period chairs and tables; climbing over takes 2 turns | L |
| `plinth` | blocks if occupied; empty: climb in 2 turns | passes | pass | – | – | yes (empty) | castored variant | – | dormant exhibits stand here; a pressure variant serves `heist_plinths` | L |
| `shelving` | blocks | blocks | stop | – | – | – | compactor variant moves | – | `wall_lurker` habitat; `moving_partitions` | L |
| `partition` | blocks | blocks | stop | 3: opens a gap | 2 | – | – | – | "Closed for reinstallation" | L |
| `crate` | blocks | blocks | stop | 2: contents | 2 | – | yes | – | pushable cover | L |
| `rope_line` | passes, at the cost of a turn | passes | pass | – | 2 to cross | – | – | – | crossing counts as `touch_case` for its bay | L |
| `bench` | passes | passes | pass | – | – | – | – | – | resting here regenerates ×2 | L |
| `curtain` | passes | blocks | pass, but you cannot target through it | – | 0 | – | – | – | walk-through hiding place | L |
| `balustrade` | blocks | passes | pass | – | – | – | – | – | edge of a void or mezzanine; a push of 2+ over it makes the target fall (M damage, lands below) | L |
| `balcony` | passes | passes | pass | – | – | yes | – | – | +1 ranged accuracy class; no melee across the balustrade | L |
| `turnstile` | one way | passes | pass | – | 1 | – | – | yes | temporary-exhibition entry; forces a route | L+ |
| `hinged_panel` | blocks until found | blocks | stop | – | 1 to open | – | – | – | Soane's picture-room planes as secret doors; perception reveals them | L+ |
| `wall_panel` | wall fixture | – | – | 1: triggers its function badly (alarm sounds, fuse blows) | 1 | – | – | – | function: alarm, fuse, thermostat, crank or tide gauge; 2 turns to operate | L |
| `lamp` | floor lamps block | passes | pass | 1: −2 lux locally, shards | 2 | – | floor lamps | – | switched on or off in 1 turn | L |
| `pool` | shallow: slowed and soaked; deep: swim only | passes | pass | – | – | – | – | – | depth set by `tide_cycle`; puts out burning | L |
| `weather_jar` | blocks | passes | stop, and it breaks | 1: releases its weather for 10 turns | 3 | – | yes | – | rain (soaked zone), fog (dust cloud), gust (push 1 per turn), frost (slowed zone) | L |

### 7.3 Transient surfaces (5) and crowds

| id | effect | made by | ship |
|---|---|---|---|
| `shards` | cut for each tile moved, unless sure-footed or stepping carefully (half speed) | glass, porcelain, vitrines, lamps | L |
| `slick` | moving onto it slides you 1 tile further in the same direction | lacquer, wax, wet-floor sign, rain | L |
| `flood` | shallow: slowed and soaked; deep: swim only, no attacks, heavy items (Clearance 2+) drag | `tide_cycle`, burst pipes | L |
| `fire` | burning for occupants; spreads through paper, textile and wooden furniture | spirit lamp, burning actors | L |
| `dust_cloud` | blocks sight, not movement; 3 turns | plaster deaths, fog jars | L |

A **crowd** (ghost visitors, museum-layouts §3.6) is a neutral moving obstacle, not a surface. Crowd members block movement (swapping places costs a turn). Two or more crowd members adjacent to you hide you from detection. Crowds serve `visitor_visibility` and the Popular Exhibition directive (later).

---

## 8. Challenge types

These eight ids match the difficulty drafter's list: `swarm`, `artillery`, `guarded`, `darkness`, `hazard_terrain`, `locks_puzzle`, `attrition`, `social`. A department declares a primary and a secondary type. The sequencer rotates primaries. The Masterpiece tests the primary. S3 confirms the claim by measurement, as the frame-blind agent did in Garden of Forking Paths (papers-semantic F12) and with persona dominance (Green et al. 2022a, via papers-levels F15).

### 8.1 Definitions and producers

| id | the threat | budget rule (encounter director) | archetypes | modules | programmes |
|---|---|---|---|---|---|
| `swarm` | numbers and being surrounded | ≥40% of budget on swarm and fodder; encounters of 6+ bodies | mote_swarm, light_swarm, splitter, pack_hunter, diorama_spawner, plodder, herald | copies_weaken, taxonomy_aggro, photosensitive | case_labyrinth (chokes help you), sculpture_court (they hurt you) |
| `artillery` | range and telegraphs across glass and long axes | ≥35% on artillery and ranged controllers | kiter, lobber, axis_sniper, binder, reflector, displacer | weather_cases, hourly_demonstration | enfilade, grand_hall (balconies), case_labyrinth |
| `guarded` | patrols, alarms, detection; fighting possible but costly | ≥30% on wardens and heralds; ≥2 patrol routes | patrol_guard, herald, tethered_warden, escapement, unobserved_mover, shield_bearer | alarm_network, heist_plinths, taxonomy_aggro | storage_stacks, enfilade with staff corridor |
| `darkness` | sight shrinks; light is both a resource and a beacon | ≥50% of galleries dim or dark; ≥1 light-reactive species | light_swarm, dimmer, unobserved_mover, axis_sniper, wall_lurker | photosensitive, staged_lights | storage_stacks, enfilade |
| `hazard_terrain` | the floor: water, shards, slick, fire, moving walls, demonstrations | ≥1 terrain module; ≥30% of damage from terrain in simulation | displacer, charger, lobber, demonstrator, pulse_emitter; porcelain, glass, lacquer | tide_cycle, weather_cases, hourly_demonstration, moving_partitions, climate_zones | grand_hall, sculpture_court |
| `locks_puzzle` | progress or the best reward gated by keys, sequences, sorting or timing | ≤50% of the normal combat budget; ≥1 puzzle element before the Masterpiece or vault | tethered_warden, path_follower, demonstrator, mimic_vitrine, completing_guardian | sorting_vault, heist_plinths, copies_weaken, identical_rooms, lying_labels, moving_partitions | rotunda (locked radials), case_labyrinth |
| `attrition` | no single fight is deadly; resources drain over a long route against a short clock | clock −25%; one fewer healing card in the deck; +25% encounters at −20% each | conservator_healer, splitter, darter, rival_visitor, completing_guardian, night_watchman | climate_zones, staged_lights, identical_rooms | any |
| `social` | neutral parties, bargains, consent, reputation; violence possible but expensive | ≥2 neutral archetypes; hostile budget −40% | keeper, rival_visitor, patrol_guard (neutral until provoked), crowds | living_community, visitor_visibility | period_rooms, courtyard (later), enfilade |

### 8.2 Measurement and requirements

| id | S3 fingerprint (what proves the claim) | Masterpiece test | door pictogram | required counter (S2 rejects without it) |
|---|---|---|---|---|
| `swarm` | ≥40% of damage taken from swarm and fodder; Vandal with area attacks dominates | `mp_ensemble`, or a tableau that summons | three dots | ≥1 area item in the pool; ≥2 chokepoints per section |
| `artillery` | ≥40% of damage from range; Cautious (using sight-blockers) dominates; Tourist suffers on axes | `mp_tableau` with line and burst | arc | a sight-blocker in every combat room; ≥1 ranged or ranged_guard item |
| `guarded` | Sneak dominates; detection count predicts damage taken | the Masterpiece wakes on alarm; each alarm adds an attachment | peaked cap | ≥1 stealth item (muffled, low_profile, uniform, dust_sheet, closed_sign) |
| `darkness` | lantern-aware beats lantern-blind (V2); Looter and Completist punished (reading and looting need light) | the room darkens one class per phase | lamp, struck through | flash_bulb or spirit_lamp in the pool |
| `hazard_terrain` | ≥30% of damage from terrain; Tourist punished (shortest paths cross hazards) | `mp_colossus` reshaping the room | wave | sure_footed or a resist item; every hazard telegraphed ≥1 turn |
| `locks_puzzle` | turns high, damage low; Completist dominates; Tourist leaves without the vault | an ensemble whose original must be identified first | key | the critical path never depends on the puzzle; a solver certifies it; floor_plan in the pool |
| `attrition` | low variance in exit HP across personas; deaths come late in the department; Cautious dominates | a long fight with a healer attachment | hourglass | ≥2 benches; tonic metered |
| `social` | Vandal never dominates; outcomes differ by policy | may be bypassed by negotiation (a Certificate by bypass) | two quotation marks | none; secondary only at launch (D-V3) |

---

## 9. Families and subject categories

### 9.1 Families

A family is a Calvino-style series with a mechanical motif (literature-museology F1, §3.2). The family is the main source of a department's module, and it biases archetypes and modifiers. It never sets power.

| family | motif | signature modules | favoured archetypes | favoured modifiers | challenge affinity | programmes | source |
|---|---|---|---|---|---|---|---|
| **Copies** | everything in multiples; originals matter | copies_weaken, identical_rooms | splitter, mp_ensemble, path_follower, mimic_vitrine, reflector | plaster, porcelain, pendant, forgery | swarm, locks_puzzle | case_labyrinth, sculpture_court, enfilade | Tlön's hrönir, "After", Perec's *Cabinet* (F6, F9, F24) |
| **Light** | light as resource and threat | photosensitive, staged_lights | light_swarm, dimmer, reflector, axis_sniper, unobserved_mover | paper, textile, glass, luminous | darkness, artillery | storage_stacks, enfilade | lux by material (F26); Lectern Moth |
| **Tides** | periodic floods; weather kept in the collection | tide_cycle, weather_cases | displacer, lobber, mote_swarm, kiter, charger | lacquer, glass, wax | hazard_terrain, attrition | grand_hall, sculpture_court | Piranesi (F10); Umbrella for Indoor Weather |
| **Machines** | deterministic mechanisms; demonstrations on the hour | hourly_demonstration, moving_partitions | escapement, demonstrator, charger, shield_bearer, axis_sniper | clockwork, bronze, old_repair | hazard_terrain, locks_puzzle, artillery | rotunda, enfilade, storage_stacks | Escapement Hound |
| **Specimens** | dormant creatures behind glass; a compiler's bestiary | unobserved_motion, heist_plinths (climate_zones) | unobserved_mover, completing_guardian, diorama_spawner, pack_hunter, mimic_vitrine | marble, glass, textile, wax | swarm, guarded | sculpture_court, grand_hall | *Book of Imaginary Beings*, A Bao A Qu (F4) |
| **Classification** | an arbitrary taxonomy drives behaviour; sorting opens doors | taxonomy_aggro, sorting_vault (lying_labels) | herald, tethered_warden, patrol_guard, conservator_healer, mimic_vitrine | pigment, pendant, forgery | locks_puzzle, guarded, swarm | case_labyrinth, storage_stacks, rotunda | Celestial Emporium; Pitt Rivers typology (F3, F15) |
| Memory (later) | forgetting | fading_map, funes_rule | path_follower, wall_lurker, unobserved_mover | textile, paper | attrition, guarded | storage_stacks, period_rooms | Funes (F6) |
| Scale (later) | models and 1:1 maps | scale_models | mp_colossus, mote_swarm, lobber | – | hazard_terrain, locks_puzzle | grand_hall, rotunda | "On Exactitude in Science" (F7) |
| Absence (later) | inferred things; empty frames | absent_exhibits, empty_plinths | mimic_vitrine, unobserved_mover, wall_lurker | luminous (as the counter) | guarded, darkness | sculpture_court, period_rooms | Gardner's empty frames (F20) |
| Writing (later) | scripts and inscriptions | script_legibility, lying_labels | pilferer, herald, binder | paper, pigment | locks_puzzle, attrition | case_labyrinth, storage_stacks | Serafini, Wilkins (F3, F11) |
| Attendance (later) | you are the exhibit; being watched | visitor_visibility, gaze_wake, alarm_network | patrol_guard, path_follower, herald, unobserved_mover | – | guarded, social | enfilade, temporary-exhibition route | Bennett, Duncan (F27); Figure of a Visitor |
| Peoples (later, rare) | a living community with voice, loans and consent | living_community | keeper, rival_visitor, conservator_healer | on_loan | social | period_rooms, courtyard | Le Guin, Horniman (F12, F20) |

The F-numbers in the source column refer to literature-museology.

**Coverage.**
- Every launch family has two launch modules, so two departments in the same family can differ in rule.
- "Favoured" archetypes and modifiers are S2 weights (×2), not restrictions. Any archetype may appear in any family if the frame justifies it.

**Peoples.**
- Capped at 1 department in 4.
- Needs a sensitivity-review step in S6.
- No human remains, invented or not (literature-museology §4.2).

### 9.2 Subject categories

The category comes from the user's examples. It biases skins, materials and the presence of neutrals. It never chooses a module or sets difficulty. It is one axis of the S1 archive (challenge type × category × tier, papers-semantic §3.3).

| id | what it supplies | material bias | neutral bias | guardrail | example (family) |
|---|---|---|---|---|---|
| `technology` | devices, instruments, demonstrations | bronze, clockwork, glass | low | – | "Instruments That Keep Time Badly" (Machines) |
| `land` | a place, written as a Calvino conceit | from the conceit (salt, cane, oilcloth) | medium | no real-culture signifiers; a conceit about a place, not a people; review question: "which real group does this read as?" | "The Harbour Where Every Room Keeps Its Own Tide" (Tides) |
| `era` | an invented period anchored to institutional events ("after the Second Calibration") | period materials; low furniture | low | invented calendars only | "Furniture for Rooms That No Longer Exist" (Memory) |
| `natural_history` | specimens, dioramas, mounts | glass, wax, textile | none | no human remains | "Animals Described by Witnesses Who Did Not See Them" (Specimens) |
| `art_form` | a practice: prints, casts, glazes, weaving | paper, plaster, porcelain, textile, pigment | low | no real named artists | "Copies Better Than Their Originals" (Copies) |
| `concept_institution` | the museum's own machinery: labels, loans, storage, light | any | high (staff) | satire aims only at the institution | "Objects Never Unpacked" (Classification) |

---

## 10. The role → numbers contract

The LLM chooses ids and classes. The balancer does arithmetic. This section is the interface between them.

### 10.1 What S2 emits, and nothing more

```json
{ "species": "M.7.s2",
  "archetype": "escapement",
  "role": "skirmisher",
  "modifiers": ["clockwork", "old_repair"],
  "params": { "old_repair_side": "left" },
  "wake_extra": [],
  "on_hit": null,
  "elite": false,
  "count_class": null,
  "skin": { "name": "Escapement Hound", "silhouette": "beast", "palette": ["brass", "walnut"] } }
```

```json
{ "item": "T.3.i4", "category": "curio", "toggle": true,
  "primitives": [["ranged_guard", "M"]],
  "drawback": ["fragile", "M"],
  "skin": { "name": "Umbrella for Indoor Weather" } }
```

**What S2 may choose.**
- The archetype.
- A role, from the archetype's allowed roles.
- Up to two modifiers, under the §3 rules.
- One extra wake trigger, from the global list, if it is compatible.
- The on-hit slot, from the archetype's allowed list.
- An elite flag, at most one per department.
- A `count_class` (S 3–4, M 5–6, L 7–8 bodies) for swarms.
- Item primitives, magnitudes and a drawback.

**What S2 never chooses:** HP, damage, accuracy, counts, budgets, cooldowns, ranges, durations, tier or the Handling Clearance requirement.

### 10.2 What each archetype declares (authored in S0)

| field | values | example: `escapement` |
|---|---|---|
| `roles_allowed` | 1–2 roles | skirmisher |
| `speed_class` | slow, normal, fast, or a named pattern | pattern `beat2`: acts on every second turn, moves 2 |
| `range_class` | melee 1, reach 2, short 3, mid 5, long 8, axis 10 | melee |
| `on_hit_allowed` | none, a status from §4, `steal`, `spoil(paper)` | none |
| `specials_allowed` | ids from §2.3 (only when elite) | charge |
| `wake_default` | §1.2 | noise(2), ticking |
| `counter_tags` | §1.9 | timing, stealth |
| `silhouette`, `tag`, `idle` | §1.7, §1.8 | beast, conditional, metronome |
| `essential_line` | template for S4 | "It moves only on the beat of its own escapement." |
| `arena_test` | two scripted bots and a margin | off-beat attacker takes ≤50% of the damage the on-beat attacker takes |

### 10.3 Role profiles

These give the shape of each role, not its numbers.
- **TTK-in**: turns the reference player at tier t needs to kill one of these.
- **TTK-out**: turns this enemy alone needs to kill the reference player from full HP.

The reference player is the median kit at tier t from the whole-run item-economy simulation, which the difficulty drafter owns.

| role | encounter cost | HP | damage | acc. / def. | TTK-in | TTK-out | group size | composition limit |
|---|---|---|---|---|---|---|---|---|
| fodder | 1 | low | low | low / low | 1–2 | ≥14 | 2–5 | – |
| skirmisher | 2 | low-mid | mid | high / mid | 2–3 | 9–12 | 1–3 | – |
| artillery | 2 | low | mid, ranged | high / low | 1–2 once reached | 8–11 from range | 1–2 | needs a screen unless the type is artillery |
| brute | 4 | high | high | mid / mid | 4–6 | 5–7 | 1 | ≤2 per encounter |
| controller | 3 | mid | low | high / mid | 2–3 | ≥15 (the danger is the status) | 1 | ≤2 per encounter |
| warden | 3 (halved if tethered and avoidable) | high | high | mid / high | 5–8 | 5–7 | 1 | – |
| support | 2, plus 25% on allies' cost | low-mid | very low | – / mid | 1–2 | ≥20 | 1 | ≤1 per encounter |
| swarm (per body) | 0.5 | very low | low | mid / low | 1 | ≥30 alone; 6–9 as a group of 6 | 3–8 | ≥3 bodies |
| ambusher | 3 | mid | high first strike | high / mid | 2–3 | first strike 25–35% of HP, then 8–10 | 1 | never in the entrance safe zone (8 tiles) |
| masterpiece_component | own budget | – | specials deal 20–35% of HP | – | the fight lasts 15–30 turns | – | core + 1–2 attachments | one per department |

### 10.4 Balancer procedure

1. **Reference kit.** Take K(t) for run position t (1–8) plus heat.
2. **Solve base stats.** For each species, start from the role profile. Solve HP and damage dice so that a duel simulation reaches the middle of the TTK-in and TTK-out bands. The duel uses the archetype's real behaviour, in a standard arena, against K(t). Accuracy and defence come from the role's class. Duel simulation handles odd action economies (escapement, unobserved_mover) without hand formulas.
3. **Apply modifiers after solving, and price them.** `porcelain` really does make a weaker exhibit. Its cost class (−1, 0, +1, +2) shifts the species' encounter cost by 0.5 per class, so the department buys more of it.
4. **Spend the budget.** The encounter director spends B(t) × e^{b(d)} under the challenge type's budget rule (§8.1) and the composition limits. B(t) and the per-department offset b(d) are the calibration in papers-levels §6(ii).
5. **Calibrate.** S3 fits b(d) so that the median persona's death rate in this department, at tier t, hits the target curve. This holds whatever position the department appears in.
6. **Items.** Magnitude classes map to numbers through the §1.6 table, scaled by tier. Item tier follows run depth, never the department (roguelike-systems F1).

### 10.5 Encounter composition rules

- ≤1 support per encounter, ≤2 controllers, ≤2 brutes.
- Artillery always has a screen (fodder, brute or warden), unless the department's primary type is artillery and the room has ≥2 sight-blockers.
- No ambusher and no awake hostile within the 8-tile entrance safe zone (museum-layouts §3.4).
- **The Intro gallery uses the orientation pool only.** That is fodder and skirmishers, plus the signature module's teaching instance, plus at most one telegraphed controller. This follows Slay the Spire's easy pool (roguelike-systems F14).
- Swarm bodies count 0.5 each toward the cost; a group counts as one encounter slot.

### 10.6 Putting it together: one department compiled

"Works on Paper, After Hours" (Light × art_form, ordinal 2). This is an illustration for the sample-departments writer, not a final department.

| Slot | Choice |
|---|---|
| challenge | primary `darkness`, secondary `guarded` |
| programme | `storage_stacks` (print-room drawers) plus the staff layer |
| modules | signature `photosensitive` {share M, label_lux lit}; secondary `alarm_network` {guards S} |
| species | Lectern Moth: `light_swarm` + `paper`, on_hit spoil(paper), count M |
| | Loose Folio: `plodder` + `paper` |
| | Mezzotint Figure: `unobserved_mover` + `paper` |
| | Projection Lantern, Third Pattern: `axis_sniper` + `glass` |
| | Reading-Room Bell: `herald` |
| | Night Attendant: `patrol_guard` |
| Masterpiece | The Large Plate (State IV): `mp_tableau` + attachment `dimmer`; specials `burst`, `summon`; the room loses one lux class per phase |
| items | Archival Slippers: garment `muffled` M |
| | Hooded Reading Lamp: curio `light_control` M |
| | Bone Folder: weapon `strike_kind(edge)` S + `surprise_bonus` M |
| | Long-Handled Snuffer: instrument `extinguish` M |
| | pool weights: `flash_bulb` ×2, `spirit_lamp` ×1.5 |
| keepable artifact | Collector's Loupe with Lamp: curio `perception` M + `light_control` S, drawback `luminous_self` (2 points) |

**Validator outcomes (expected).**
- **Counters.** All satisfied:
  - moth {light_ctl, aoe}: lantern and flash bulb;
  - figure {light_ctl, timing};
  - projection lantern {los, timing}: shelving;
  - attendant {stealth, los, timing}: slippers and shelving.
- **Programme matrix.** Both modules are ++ in storage_stacks.
- **Predicted fingerprint.** Sneak dominates; Looter and Completist are punished because reading labels needs light.
- **The risk the simulation must check.** The spirit lamp in a paper department burns the room and the player alike. That is the intended emergent risk, and S3 must show it is not dominant.

---

## 11. Size and growth

### 11.1 Launch subset

| Table | Launch ids |
|---|---|
| Archetypes (25) | plodder, darter, charger, kiter, lobber, axis_sniper, mote_swarm, light_swarm, splitter, binder, displacer, reflector, demonstrator, unobserved_mover, mimic_vitrine, path_follower, tethered_warden, patrol_guard, herald, night_watchman, conservator_healer, escapement, completing_guardian, mp_ensemble, mp_tableau |
| Archetypes L+ (8) | pack_hunter, shield_bearer, dimmer, pulse_emitter, diorama_spawner, mp_colossus, keeper, rival_visitor |
| Modifiers (12) | porcelain, bronze, marble, paper, glass, textile, plaster, clockwork, luminous, old_repair, pendant, champion |
| Statuses (12) | burning, soaked, cut, rooted, slowed, dazed, blinded, faded, warded, restoring, dormant, toured |
| Primitives (30) | all marked L in §5.2 |
| Consumable kinds (10) | tonic, catalogue_card, floor_plan, audio_guide_cassette, solvent, evacuation_card, late_pass, flash_bulb, spirit_lamp, dust_sheet |
| Modules (13) | copies_weaken, photosensitive, staged_lights, tide_cycle, weather_cases, hourly_demonstration, unobserved_motion, heist_plinths, taxonomy_aggro, sorting_vault, alarm_network, plus identical_rooms and moving_partitions as soon as their L+ costs are paid (two per launch family) |
| Fixtures (16) and surfaces (5) | all marked L in §7 |

### 11.2 Coverage and recurrence arithmetic

With 30 launch departments using about 6 hostile archetypes each, there are 180 slots over 25 archetypes, or about 7 departments per archetype.
- **Quota per archetype:** at least 3 and at most 12 departments (40%). This guards against LLM popularity bias toward a few verbs (papers-semantic F11).
- **Archetypes recur.** An archetype in 24% of departments appears in an 8-department run with probability 1 − 0.76^8 ≈ 0.89. Players meet most of the vocabulary every run, so knowledge transfers.
- **Modules vary.** As a signature, a module sits in about 2.5 of 30 departments (8%). It appears in a given run with probability 1 − 0.92^8 ≈ 0.49.

That split is deliberate. Archetypes are the stable layer that mastery rests on; modules are the layer that makes a run feel different.

### 11.3 Ordinals

Family ordinals ("Tides 3") encode **complexity, not power**. Complexity means module parameter intensity and whether a secondary module is present. The sequencer pushes high ordinals later (roguelike-systems §3.3, complexity rating), and power still comes from run depth. See Challenges to the frame, item 1.

### 11.4 Adding vocabulary (the human-reviewed path)

1. **Demand.** Three sources feed it:
   - the **unmatched-concept queue**: concepts S2 rejected because no id fits, counted and ranked;
   - curator notes from S6;
   - player "report this exhibit" telemetry (papers-semantic F3).
2. **Proposal card.** It must include:
   - id, one-line semantics, role, counter tags, family and challenge served;
   - a distinctness argument: what existing id this is *not*, in counterplay and not just in numbers. DCSS: "It is no good to provide dozens of weapons with different names… if, in the end, they all play the same" (roguelike-systems F12).
3. **Implementation.** A pure core function, an icon, an Essential-line template, and a tag, idle tell and silhouette.
4. **Micro-arena test.** Two scripted bots, one using the counterplay and one ignoring it; the declared margin must hold over 200 seeds.
5. **Department battery.** Patch the id into 3 existing departments as variants and run S3. Reject it if it never matters (V2) or if it causes more than 40% of deaths in any department.
6. **Julian's review**, then a minor version bump of the vocabulary.

**The offline research track** (papers-semantic D4c) feeds step 1 only. An LLM writes candidate mechanics as code against the core's pure-function API, in a sandbox, in the style of ScriptDoctor and Mortar. The candidates are scored by the same micro-arena harness, with the book's rule proxies: skill gap, learnability, depth (AI&G 2e p. 300 via book-pcg F12). Nothing ships until a human has written the semantics. The track can produce papers without touching the shipped game.

**Cadence.** 2–4 new ids per content update. A new family needs ≥2 modules, ≥3 favoured archetypes (new or existing) and, for Peoples, the sensitivity review.

### 11.5 Versioning

- The vocabulary has a semantic version. Each department pins the version it was compiled against (S7 packs).
- New ids mean a minor bump. Old departments are unaffected.
- A change to the semantics of an existing id means a major bump, and every department using that id must be re-simulated.
- Ids are never reused. A retired id stays as an alias that compiles to its replacement.
- Prompts are versioned and outputs stored, because outputs, not prompts, are the canonical asset (papers-semantic §3.4, Tooling).

---

## 12. Decisions for Julian

**D-V1. How big is the launch vocabulary?**
- **Options.**
  - (a) Small: 16 archetypes, 8 modules, 8 modifiers. The fastest to build and learn; departments within a family blur together by about run 10.
  - (b) Medium: 25 archetypes, 13 modules, 12 modifiers (this document). Enough for 30 departments with every archetype recurring 3+ times; about twice the build cost of (a).
  - (c) Full: 35 archetypes, 24 modules. The most variety. The stealth, social and scale systems behind the later modules are each a sizeable project.
- **Lean: (b).** Recurrence turns the label into a bestiary, and two modules per launch family let "Tides 1" and "Tides 3" differ in rule, not only in skin.
- **If Julian picks otherwise.**
  - (a): one module per family, the secondary slot carries more variety, and the launch Permanent Collection shrinks to about 20.
  - (c): the vertical slice slips by the cost of the stealth and social systems.

**D-V2. How is behaviour signalled across departments?**
- **Options.**
  - (a) A tag colour and glyph on labels and as a 1-px trim, plus an idle tell per archetype (this document). The most legible; costs nine reserved hues.
  - (b) Idle tell and silhouette only. Free palettes, but players must learn 35 animations with no summary channel.
  - (c) Tags only in the examine panel. The cleanest look; knowledge transfer depends on examining everything.
- **Lean: (a).** The frame says most players will not read, and a glyph on the label tile is read at a glance.
- **If (b) or (c):** S5 drops the hue reservation, and the Catalogue carries more of the teaching.

**D-V3. Social at launch?**
- **Options.**
  - (a) A full primary type at launch. This in practice means shipping Peoples and its sensitivity review at launch.
  - (b) Secondary only. `keeper` and `rival_visitor` appear in any family as neutral parties (Loan Desk, a rival racing you to the highlights), but no department has social as its primary.
  - (c) No social at launch.
- **Lean: (b).** It keeps the eighth type alive in the data and tests the neutral-AI code early, without shipping Peoples before a review process exists (literature-museology D8).
- **If Julian picks otherwise.**
  - (a): `living_community` moves to launch, and S6 gains a review step.
  - (c): keeper and rival move to later, and the sequencer rotates seven types.

**D-V4. Damage kinds.**
- **Options.**
  - (a) A single damage type. The simplest; materials become HP and flavour.
  - (b) Blunt and edge only. Material counters (bronze against marble) with little UI.
  - (c) Blunt, edge, fire, water and light (this document). Ties materials, statuses and lux together.
  - (d) More kinds (cold, acid, sound). More combinations, more UI, more balance surface.
- **Lean: (c).** Fire, water and light already exist as hazards and room properties, so making them damage kinds costs little. It also makes materials functional rather than decorative (papers-semantic F3).
- **If (b):** fire, water and light stay as statuses and surfaces only; `resist(kind)` shrinks to two kinds; the material interactions in §3.1 still hold.

**D-V5. How are Masterpieces built?**
- **Options.**
  - (a) Hand-authored per department. The best fights; does not scale to 100+ departments.
  - (b) Assembled from four cores, attachments, specials and the signature module (§2.4). Scales, but risks sameness among Masterpieces that share a core.
  - (c) A champion of one of the department's species. The cheapest, and a weak climax.
- **Lean: (b), with a few hand-authored showcase exceptions at the curator's discretion.**
- **If (a):** S2 stops compiling Masterpieces, and the launch count falls to about 15 departments.

**D-V6. How many rule modules per department?**
- **Options.**
  - (a) Exactly one. The purest identity; departments within a family are near-identical.
  - (b) One signature plus at most one secondary from another family or the generic list. Variety within a family, and still teachable.
  - (c) Up to three. Rich, but illegible and hard to validate.
- **Lean: (b).**
- **If (a):** `alarm_network` and `climate_zones` become signature-only, so the guarded type appears only in Attendance and Classification departments.

**D-V7. How do department skins bind to the twelve consumable kinds?** (This is the interface with whoever designs identification.)
- **Options.**
  - (a) Honest skins: the spec fixes each skin, and its name hints at the kind; only forgery and magnitude are unknown. Readable, but identification nearly vanishes for consumables.
  - (b) SPD-style: each department supplies twelve neutral appearances (material and colour, no functional hint), and the run seed binds kinds to them. Known kinds show their pictogram in every department. Identification survives, but generated names cannot hint.
  - (c) Hybrid: names hint at the kind's group (restorative, informational, tactical), and the seed binds within the group.
- **Lean: (b).** Each department's labels identify one or two kinds, which is the frame's "reading labels identifies kinds". One-off department exhibits stay pre-labelled.
- **If Julian picks otherwise.**
  - (a): the attribution ladder applies mainly to equipment.
  - (c): S4 must be told each skin's group.

**D-V8. Who may add vocabulary?**
- **Options.**
  - (a) Code authors only, by hand.
  - (b) (a), plus the unmatched-concept queue ranking what departments wanted and could not express.
  - (c) (b), plus a research track in which an LLM writes candidate mechanics as code, evaluated in micro-arenas and reviewed before entering S0.
- **Lean: (b) for v1, and (c) as a separate research track** that can produce papers without touching the shipped game.
- **If (c) now:** budget the sandbox and arena harness as a project of its own.

---

## 13. Challenges to the frame

1. **The ordinal should mean complexity, not depth.**
   - literature-museology F1 says "the family carries the mechanic, the ordinal the depth". Pillar 4 says depth sets power and a department never fixes its own difficulty.
   - If "Tides 4" were harder than "Tides 1", random order would recreate identity-coupled difficulty (roguelike-systems pitfall 1).
   - Proposal: the ordinal encodes complexity (§11.3), the sequencer places high ordinals later, and power comes only from run depth.
2. **Social cannot be a primary challenge type at launch.**
   - The frame lists eight types, but the only strong producer of social play is the Peoples family, which the frame defers.
   - Proposal: social is secondary-only until Peoples ships (D-V3).
3. **"A rule module" per department should be "one signature plus at most one secondary".**
   - With one module, departments within a family converge, and the guarded type would belong only to families whose signature is an alarm.
   - See D-V6.
4. **Pillar 2 needs one clarification to survive `lying_labels`.**
   - Proposed wording: "the object never lies; the label lies only inside a declared module".
   - The sprite's tag and idle tell are the channel that can never be corrupted. That strengthens the case for D-V2(a).
5. **Constant trim colours cost palette freedom.**
   - Reserving nine saturated hues constrains every department's palette, and a 1-px trim at 16×16 is weak.
   - The glyph on the label tile is therefore the primary channel and the trim a reinforcement. S5 must enforce both.
6. **If the Copyist's sketch becomes a core verb, the vocabulary inherits a duty.**
   - Every archetype needs a sketch mapping.
   - §2.6 provides one built only from existing primitives, so the verb adds no new mechanics. Any later archetype must ship with its mapping.

---

## 14. Risks

1. **Combinatorial illegibility.** 35 archetypes × 18 modifiers × 24 modules can make each department a new game, which defeats pillar 1. Mitigation:
   - per department, ≤6 hostile archetypes, ≤2 modules and ≤6 distinct modifiers;
   - the recurrence quota in §11.2.
2. **Interaction bugs.** Modifier × module × surface combinations (paper + tide + spirit lamp) will produce cases nobody designed. Mitigation:
   - the closed interaction list in §3.1;
   - an automated pairwise micro-arena sweep over the launch set (25 archetypes × 13 modules = 325 runs per build).
3. **LLM popularity bias.** S2 will over-pick plodders, kiters and statues (papers-semantic F11). Mitigation: per-id quotas and the MAP-Elites archive over mechanical descriptors.
4. **Signals at 16 px.** The idle tells and the 1-px trim may not read. Mitigation: prototype the nine glyphs and ten idle tells in the vertical slice before committing to D-V2.
5. **Stealth engineering cost.** Wake triggers, observation, noise propagation and alert states are the most expensive code in this vocabulary, and everything sits on them. If they slip, half the archetypes slip.
6. **Bots cannot read.** The semantic modules (`sorting_vault`, `lying_labels`, `script_legibility`) are validated by an oracle and by Julian, not by play. Keep them off the critical path.
7. **The duel simulation misses synergy.** Support plus swarm, or a herald plus a dormant room, is more than the sum of its duels. Mitigation: the support cost multiplier, and S3 calibrating whole departments, not species.
8. **Vocabulary churn.** Fixing a verb can silently change shipped departments. Mitigation: version pinning and a mandatory re-simulation on any semantic change (§11.5).
9. **Pillar dancing in sculpture courts.** Kiting loops can make melee archetypes free. Mitigation:
   - the closing clock;
   - lobbers and axis snipers in loop-heavy programmes;
   - the S3 check that the aware expert still has a death-rate floor (V4).
10. **Sensitivity leaks.** `taxonomy_aggro` classes, `land` departments and neutral "keepers" are where the generator can reproduce real-world othering (literature-museology §4.2). Mitigation:
    - the guardrails in §9.2;
    - the class-name rule in Table B;
    - Peoples is later and rare.

---

## 15. Cut line

Drop in this order if scope must shrink:

1. **Everything marked "later".** The Memory, Scale, Absence, Writing, Attendance and Peoples modules and archetypes are already deferred.
2. **The L+ modules and archetypes.**
   - Modules: `identical_rooms`, `moving_partitions`, `climate_zones`, `lying_labels`.
   - Archetypes: `pack_hunter`, `shield_bearer`, `dimmer`, `pulse_emitter`, `diorama_spawner`, `mp_colossus`.
   - `keeper` and `rival_visitor`, which means social goes away entirely (D-V3c).
3. **Modifiers, down to 8.** Keep porcelain, bronze, paper, glass, textile, plaster, clockwork and champion.
4. **Consumable kinds, down to 8.** Drop `evacuation_card` and `spirit_lamp`; the two signs are already L+.
5. **Instruments, down to 4.** Drop `animate_ally` (and with it `toured` and the Conservation Storage set piece) and `extinguish`. `recase` and `pass_wall` are already L+, so the keepable Portable Doorway does not ship either.
6. **Families, down to 4:** Light, Machines, Specimens and Copies. Their modules are the cheapest to build: lux, schedules, observation and copy groups. Tides (height maps and floods) and Classification (taxonomy UI and the sorting solver) return first.
7. **Specials, down to 6.** Drop `cross`, `pull`, `shatter_all` and `sweep`.

**Never cut:**
- the dormancy and wake system;
- the tag grammar (at least the glyphs);
- the role → numbers contract and the balancer;
- `alarm_network`;
- the Intro-gallery V3 validation;
- the unmatched-concept queue.

Without these, the game falls back to "reskins of the same eight monsters" (papers-semantic pitfall 1).
