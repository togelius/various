# Core systems: the moment-to-moment game

*ACCESSION design document, section: core systems. Draft 1, 2026-10-20. Written inside the direction memo's frame (`direction.md`). Research is cited only from the briefs in `research/`: `roguelike-systems.md` (RS), `literature-museology.md` (LM), `museum-layouts.md` (ML), `tech-art.md` (TA), `papers-levels.md` (PL). Every number here is a first draft for the persona simulator to move, not a balance claim.*

**What this section owns:** turns, combat, awareness and stealth, furniture, the closing-time clock, inventory, identification, in-run progression, the sketch verb, classes, NPC services, ending a run, and the core UI.

**What it borrows from other sections:**
- Behaviour archetypes and Masterpiece phases (enemies section).
- Room graphs, `L_tour` and room numbering (layout section).
- Accession, Loans and the Collection (meta section).
- Stair Halls and the Exit (run-structure section).

---

## 0. Proposals at a glance

| System | Proposal |
|---|---|
| Time | Integer ticks, 100 per turn. Per-action costs. Reading and examining are free; searching costs 3 turns. |
| Combat | Hit% = 75 + 5 × (Acc − Eva), clamped to 10–95. Uniform damage dice minus flat Padding, minimum 1. No random crits. Surprise attacks auto-hit for maximum damage. Specials are telegraphed, deterministic and show their exact damage. |
| Stats | HP 20 at start (+5 per Certificate). Acc 3, Eva 2, Handling Clearance 10. Padding comes from the garment. |
| Awareness | Exhibits run Dormant → Stirring → Awake → Hunting → Returning. A visible 3-pip stir meter. 13 wake triggers in a closed enum. |
| Noise and light | Noise has a loudness and spreads by path distance (−1 per tile). Light has five lux bands set by the collection's material. Your lantern is a tradeoff. |
| Guards | Staff who cannot be harmed. Neutral until they witness a breach. Capture means escort and confiscation, not death. |
| Clock | Open hours B = 2.5 × L_tour + 100 turns (about 650 in a medium department). Then three stages: First Bell, Lights Down, Night Watch. Regeneration slows, then stops. Night Watch escalates every 50 turns. |
| Inventory | Weapon, garment, 2 curios, 1 instrument, a 16-slot tote, and 3 quickslots on phone (6 on desktop). |
| Consumables | 12 fixed kinds: 6 Solutions and 6 Ephemera. Each department reskins the name. A per-run *seal* carries identification. |
| Identification | Equipment climbs a 6-rung attribution ladder by use plus new galleries. Consumable kinds are learned from labels, use, Catalogue Cards or NPCs. Forgeries are the curses. |
| Progression | No XP. 2 Restoration kits, 1 Clearance card and 1 Certificate (+5 HP, one perk from three) per department. Perks come in 8 challenge-type families. |
| Sketch | Lean: a universal verb with 1 page. The Copyist class gets 3 pages and Masterpiece sketches. |
| Classes | Lean: launch with 2 (Night Guard, Copyist). Conservator, then Docent, unlock later. |

---

## 1. Turn structure

### 1.1 The scheduler

- **Time base.** One *turn* is 100 ticks of world time. Every actor (player, exhibit, guard, fire, smoke cloud) has an integer `next` tick.
- **The loop.** Take the actor with the smallest `next`. Ties go to the player first, then to other actors by spawn index. The actor acts, and `next += cost`.
- **Turn boundaries.** World effects resolve on each 100-tick boundary, in this fixed order:
  1. environment (fire spread, smoke decay, water);
  2. status timers;
  3. regeneration;
  4. stir-pip decay;
  5. the clock-stage check;
  6. alarm decay.
- **What the clock reads.** The closing-time clock reads world turns, not player actions. Haste gives you more actions per clock turn but does not stretch the clock.
- **Speed.** Speed is a multiplier on action cost: Fast ×0.5, Normal ×1, Slow ×2. Archetypes may have separate movement and attack speeds (a fast mover with a normal attack).
- **"On the Beat" modifier** (the Escapement Hound in LM §3.3). The actor's every action costs 200, but a move action covers 2 tiles. It is still between beats, which you can read.
- **Determinism.** Everything here is integer arithmetic in `core/`. Combat rolls come from `rng(runSeed,'combat',deptId)` and AI choices from `'ai'`. Passive search rolls come from a `'search'` stream, so adding a wall-study feature never reshuffles combat (TA §3.2).

### 1.2 Action costs

| Action | Ticks | Noise (loudness) | Notes |
|---|---|---|---|
| Step (8-directional) | 100 | floor: carpet 0, parquet/wood 1, stone/marble 2, water 3, shards 5; heavy garment +1 | Bumping a closed unlocked door opens it and you stay put |
| Tiptoe step (toggle) | 200 | 0 (shards 3, water 2) | Decision C4 |
| Melee attack, hit or miss | 100 (Heavy weapon 150) | 5 | Destroying an exhibit: 6 (stone/ceramic: 8) |
| Throw | 100 | 3 where it lands (a Solution vial: 4) | |
| Drink or read a consumable | 100 | 0 | |
| Use an instrument | 100 | per instrument | |
| Equip weapon, curio or instrument | 100 | 0 | |
| Equip garment | 300 | 0 | |
| Pick up or drop | 100 | 0 | Picking up from an open or broken case works from an adjacent tile |
| Open or close a door | 100 | 1 (staff door 2) | |
| Wait | 100 | 0 | |
| Rest | 100 per turn | 0 | Repeated wait. Interrupted by a hostile in view, noise of 3 or more at your tile, a clock stage, an alarm, or full HP |
| Search ("study the walls") | 300 | 0 | Reveals every hidden feature within radius 4 in line of sight |
| Inspect an item ("raking light") | 300 | 0 | Needs a Bright tile, or your lantern on. Moves the item to rung 1 (§7) |
| Open a case with Clearance | 200 | 1 | Fires CASE_TOUCHED |
| Bash case glass | 100 per bash (Heavy 150, counts as 2 bashes) | 6 per bash; 10 when it breaks | §4 |
| Cross a rope line | 200 | 1 | Fires CASE_TOUCHED for the enclosure |
| Mount an empty plinth or a stair | 200 | per floor | |
| Sit on a bench | 100, then rests | 0 | Regeneration ×2 |
| Sketch | 100 per channel turn | 0 | §9 |
| **Examine anything visible** | **0** | 0 | Opens the label panel |
| **Read a label (full text)** | **0** | 0 | Within 2 tiles, and the plaque is lit (lux ≥ 1, or your lantern is on) |
| **Toggle the lantern** | **0** | 0 | Switching it on fires an instant LIGHT check (§3.5) |

**Passive search.** For each turn you stand adjacent to a hidden feature (a hinged panel or an unmarked staff door), there is a 25% chance you notice it.

**Missing room numbers.** A department uses rooms d00–d99 (LM F25). A gap in the numbering means a secret, and the floor plan shows the gap.

### 1.3 Why reading is free

- **The interface.** Pillar 2 makes the label the interface. Charging time to read would tax the very behaviour the game wants.
- **The real costs.** Reading costs **position** (within 2 tiles of the plaque) and **light**. In a paper room, reading means switching on the lantern, which can wake light-sensitive exhibits. The tradeoff lives in the world, not in the clock.
- **The exploit closed.** Flicking the lantern on and off within one instant cannot dodge this, because switching it on is itself a light event.

**Decision C8: does reading cost time?**

| Option | Tradeoff |
|---|---|
| (a) Free, with light and range required | Reading is never punished. The cost comes from the world. |
| (b) 1 turn per full label | Diegetic, but taxes the pillar and pushes players to skip text. |
| (c) Free, and labels also open automatically on proximity | Most accessible, but reading stops being a choice. |

*Lean: (a), with (c) as an accessibility setting.* If Julian picks (b), the clock budget formula needs about +5% for Completist play.

### 1.4 Edge cases

- **A waking exhibit does not act at once.** Its first action is scheduled at now + its action cost ("waking costs a beat"). This applies to every waking trigger, including damage.
- **A tie at the same tick.** Order is player, then actors by spawn index, so the outcome is reproducible from the seed.
- **Status effects** expire on turn boundaries, never mid-action.
- **Free actions never change world state.** Examine, read and the lantern toggle have no time cost. The one exception is the instant light check when the lantern goes on, and it is deliberate.

---

## 2. Player stats and combat math

### 2.1 Stats

| Stat | Start | Grows by | Role |
|---|---|---|---|
| HP | 20 | +5 per Certificate (§8.4) | Health |
| Acc | 3 (Night Guard 4) | +1 per 2 Restoration levels on the weapon; weapon form | Attack rating |
| Eva | 2 | Light garments +1; perks; curios | Defence rating |
| Padding | from the garment (T1 = 1 … T5 = 5) | +1 per Restoration level on the garment | Flat damage reduction |
| Handling Clearance | 10 | +1 per Clearance card (1 per department) | Strength analogue; also opens cases and staff doors |
| Speed | Normal | haste effects | Action-cost multiplier |

There is no Luck, Mana or Hunger. The closing clock replaces hunger (RS F3).

### 2.2 Hits, damage and Padding

- **Hit chance:** `H = clamp(75 + 5 × (Acc_att − Eva_def) + mods, 10, 95)`. Roll d100 on the combat stream; the attack hits if roll ≤ H.
- **Modifiers:**

  | Condition | Modifier |
  |---|---|
  | Attacker on an elevated tile, ranged | +10 |
  | Target on an elevated tile, attacker below, ranged | −10 |
  | Target Fixed (rooted) | +20 |
  | Attacker Dazed | −20 |
  | Ranged, per tile beyond 4 | −5 |
  | Target on a Dark tile and the attacker has no light on it | −20 |

- **Damage:** roll a uniform integer in [min, max], subtract the defender's Padding, with a minimum of 1 on a hit.
- **No random criticals.** The only spikes are surprise attacks and perks. Spikes therefore come from decisions, not dice.

### 2.3 Surprise attacks

- **When it applies.** The defender is *unaware of the attacker*: Dormant, Stirring, Returning, or Awake but not Hunting you.
- **The rule.** The attack **auto-hits for maximum damage**. A Light weapon deals maximum ×1.5, rounded down. The defender then becomes Hunting.
- **Precedent.** SPD's surprise attacks always hit (RS §3.7). Taking maximum damage is our simplification of its bonus.
- **Masterpieces.** A surprise attack auto-hits but rolls damage normally, and it starts the Masterpiece encounter (§5.4).
- **The museum's reply.** Surprise-attacking a Dormant or Stirring exhibit in a guard's sight is **vandalism**, a breach (§3.7). Stealth kills are strong, so they must also be unobserved.

### 2.4 Dice for basic attacks, determinism for specials

- **Basic attacks** roll dice (RS D8b).
- **Specials** (every warden, controller, artillery aimed shot and Masterpiece ability) follow a deterministic contract:
  1. **Wind-up.** The actor spends one action marking tiles in the reserved hazard colour (TA F12). Each marked tile shows the exact damage *you* would take, after your Padding.
  2. **Resolution.** On its next action, the special hits everything on the marked tiles. There is no hit roll and no damage roll.
  3. **Recovery.** The actor's following action costs +100. That is the punish window.
- **Telegraphs never miss and never lie** (RS pitfall 9; ITB telegraphs, RS F13). If the displayed number is 10, standing there costs exactly 10.
- **Specials ignore Eva but respect Padding.** The display already accounts for it.

### 2.5 Weapons and garments

**Tier damage (Balanced form):** `[t+1, 3t+3]`, so T1 2–6, T2 3–9, T3 4–12, T4 5–15, T5 6–18. Each Restoration level adds +1 to both min and max.

| Weapon form | Damage | Attack cost | Acc | Clearance requirement | Special |
|---|---|---|---|---|---|
| Light (letter opener, conductor's baton, hatpin) | [t, 3t+1] | 100 | +2 | −1 | Surprise ×1.5 of max; cannot break Laminated or Security glass |
| Balanced (stanchion post, umbrella, walking cane) | [t+1, 3t+3] | 100 | 0 | base | none |
| Heavy (fire axe, crowbar, sculptor's mallet) | [t+2, 4t+4] | 150 | −1 | +1 | One bash counts as 2 |
| Reach (window pole, boat hook, pointer) | [t, 3t+1] | 100 | 0 | base | Hits a target 2 tiles away in a straight line if the tile between is empty or holds an ally |

**Clearance requirement by tier:** T1 10, T2 12, T3 14, T4 16, T5 18. This applies to weapons and garments.

**Garment forms:**

| Form | Padding | Eva | Step noise | Requirement |
|---|---|---|---|---|
| Light (soft-soled) | tier − 1 | +1 | −1 | base |
| Standard | tier | 0 | 0 | base |
| Heavy | tier + 1 | −1 | +1 | +1 |

**Shortfall.** Each point of Clearance below an item's requirement costs:
- weapons: −2 Acc;
- garments: −1 Padding and +1 step noise.

**Tier by run depth.** Tier follows run depth, never the department (RS F1, SPD `floorSetTierProbs`):

| Departments | Tiers (60/40) |
|---|---|
| 1–2 | T1 / T2 |
| 3–4 | T2 / T3 |
| 5–6 | T3 / T4 |
| 7–8 | T4 / T5 |

**The resulting tension.** You arrive at department *d* with Clearance 9 + *d*, so the higher tier on offer is usually 1–2 points beyond you. Clearance cards matter, and "lighter item at full handling or heavier item with a penalty" is a standing choice.

### 2.6 Role stat curves (depth sets power)

**Calibration targets** (from the median player build in §8.7):
- Fodder dies in about 2 player hits, a skirmisher in 3, a brute in 5, a warden in 7, a Masterpiece in about 15.
- Basic hits take roughly these shares of the player's expected max HP *after* median Padding: fodder 7–9%, skirmisher 10%, artillery 12%, brute 20%, warden 11–13%.
- Specials take 25–30%.
- Values between the listed depths interpolate linearly and round down.

| Role | Depth | HP | Acc | Eva | Damage | Padding | Speed and notes |
|---|---|---|---|---|---|---|---|
| Fodder | 1 / 4 / 8 | 7 / 16 / 28 | 2 / 3 / 4 | 1 / 2 / 3 | 1–4 / 3–8 / 5–13 | 0 / 1 / 2 | Normal |
| Skirmisher | 1 / 4 / 8 | 12 / 24 / 42 | 3 / 4 / 5 | 3 / 4 / 5 | 2–5 / 4–9 / 7–14 | 0 / 1 / 2 | Fast movement, or a modifier |
| Artillery | 1 / 4 / 8 | 10 / 20 / 35 | 4 / 5 / 6 | 1 / 2 / 3 | 2–5 / 4–11 / 7–16 (range 6) | 0 / 0 / 1 | Aimed shot is a telegraphed special |
| Brute | 1 / 4 / 8 | 15 / 35 / 65 | 1 / 2 / 3 | 0 / 1 / 2 | 3–7 / 6–14 / 10–22 | 1 / 2 / 3 | Attacks cost 150 |
| Controller | 1 / 4 / 8 | 12 / 26 / 46 | 3 / 4 / 5 | 2 / 3 / 4 | 1–3 / 2–5 / 3–8 | 0 / 1 / 2 | A status special every 3rd action |
| Warden | 1 / 4 / 8 | 21 / 49 / 91 | 3 / 4 / 5 | 2 / 3 / 4 | 2–5 / 4–10 / 7–15 | 1 / 2 / 3 | Special every 3rd action: 5 / 10 / 14 net |
| Masterpiece | 1 / 4 / 8 | 45 / 105 / 195 | per design | per design | specials 25–35% | 1 / 2 / 3 | 3 phases; enemies section |

**Where the numbers come from.** A deterministic balancer fills these from role × depth. The LLM never writes them (TA §3.3). A department's archetype adds at most 2 modifiers from a closed list (On the Beat, Armoured +2 Padding/−25% HP, Fragile, Swarming, and so on).

### 2.7 The odds readout (examine)

Examining a creature shows Brogue's sentence (RS F11), computed live from current state:

> **Escapement Hound** has an **85%** chance to hit you, typically hits for **20%** of your current health, and at worst could defeat you in **4** hits.
> You have an **80%** chance to hit it, and typically need **3** hits to destroy it. A surprise attack now would deal **11**.

**How each figure is computed:**
- "Typically" = (mean roll − your Padding) ÷ current HP.
- "At worst" = ⌈current HP ÷ (max roll − Padding)⌉.
- "Typically need" = ⌈its HP ÷ (your mean damage − its Padding)⌉.
- The surprise figure appears only while the target is unaware.

**Specials** get one line each, with their exact net damage and cadence: "Pendulum Swing: 10 to each of three tiles in front of it, every third action, shown a turn ahead."

### 2.8 Worked fight

**Setup.** Department 4, *Instruments That Keep Time Badly* (Machines family; primary challenge Guarded, secondary Artillery). Room 412, Low lux, parquet floor.

- **Player, a Night Guard:**
  - HP 35/35.
  - Acc 5: base 4, plus 1 from 2+ Restoration levels.
  - Eva 2.
  - Weapon: Stanchion Post, Balanced T2, Restored +3. Damage 6–12. Requirement 12; Clearance 13.
  - Garment: Guard's Tunic, T1 Standard, +2. Padding 3.
- **Escapement Hound** (skirmisher, depth 4, modifier On the Beat): HP 24, Acc 4, Eva 4, Padding 1. Damage 4–9 ×1.6, giving 6–14. Acts every 200 ticks. Dormant on a plinth, with 1 pip from your earlier step on parquet within 2 tiles.
- **Pendulum Warden** (warden, depth 4): Dormant in the next bay, path distance 3, hearing threshold 2. HP 49, Acc 4, Eva 3, Damage 4–10, Padding 2. Pendulum Swing: 10 net, every third action.

**Turn by turn:**

| Tick | Actor | What happens | Result |
|---|---|---|---|
| 0 | Player | Surprise attack: auto-hit, max 12 − 1 | Hound 13/24, now Hunting. Its next action is at 200. Noise 5 reaches the Warden at volume 5 − 3 = 2 ≥ 2: +1 pip (Stirring) |
| 100 | Player | Attack: d100 = 63 ≤ 80, hit. Damage roll 8 − 1 = 7 | Hound 6/24. Warden 2 pips |
| 200 | Player (tie, player first) | d100 = 88 > 80, miss. A miss still makes noise | Warden 3 pips: **Awake**, next action at 300 |
| 200 | Hound | d100 = 41 ≤ 85, hit. Roll 11 − 3 = 8 | Player 27/35. Hound next at 400 |
| 300 | Player | d100 = 22, hit. Roll 10 − 1 = 9 | Hound destroyed (noise 6) |
| 300 | Warden | Awake, moves toward the noise and enters line of sight at 3 tiles. Your tile is Low, so you are seen from 6 | Warden **Hunting** |
| 400 | Warden | Now adjacent. Opens with Pendulum Swing: marks a 3-tile arc that includes your tile, showing "10" | Resolves at its next action (500) |
| 400 | Player | Examines the Warden: 85% to hit you, typically 4 (15%), at worst 4 hits; you need 7 hits at 85%. Steps diagonally out of the arc | Safe |
| 500 | Warden | Swing resolves on empty tiles. Recovery: next action at 700 | Punish window: you act at 500 and 600 |
| 500 | Player | Throws an unknown Solution with the verdigris seal: it is **Fixative**, and the Warden is Fixed for 4 turns. The kind is now identified for the run | |
| 600+ | Player | Walks away. The Warden guards nothing you need. It loses sight behind the curtain at Room 413, searches its last-known tile, then Returns to its bay | |

**Cost:** 8 HP, 6 turns and one consumable, plus a lesson.

**What a better player does.** Uses a Tuning Fork first (§6.3) to draw the Hound two rooms away before fighting it, so the Warden never hears the fight. The Warden is optional: it costs about 18–25 HP to kill at this depth, and that pays only if its bay holds something worth it.

### 2.9 Decisions on combat

**Decision C1: how do basic attacks resolve?**

| Option | Tradeoff |
|---|---|
| (a) SPD-style opposed rolls (two random draws) | Conventional, but the odds are hard to state in one number. |
| (b) **One table: hit% = 75 + 5 × ΔAcc/Eva, d100** | Easy to show on examine, easy to tune, still dice. |
| (c) Always hit; dice on damage only | Most legible, but loses "RPG conventions" and evasion builds. |
| (d) (b) with a per-actor hit deck (20 cards per actor, drawn without replacement) | Smooths miss streaks (de Mesentier Silva et al. 2018, RS F2), at the cost of a little state. |

*Lean: (b), with (d) held in reserve* if testers on phones report miss-streak frustration. If Julian picks (c), Eva becomes a Padding-like stat and the Artillery perk family needs rewriting.

**Decision C2: how does armour reduce damage?**

| Option | Tradeoff |
|---|---|
| (a) **Flat Padding, minimum 1 per hit** | Deterministic and readable; swarms still chip. A heavy garment build can trivialise fodder. |
| (b) SPD-style random reduction, 0 to P | More variance, weaker tanks, a fuzzier readout. |
| (c) A percentage | Scales cleanly, but small integers make it lumpy. |

*Lean: (a).* The balancer sets enemy damage against median Padding, and specials keep tanks honest. If Julian picks (b), double the Padding values and show armour as a range in the readout.

---

## 3. Awareness and stealth

### 3.1 Exhibit states

| State | Acts? | Knows your position? | Surprise-attackable? | Leaves this state when |
|---|---|---|---|---|
| **Dormant** | no | no | yes | it reaches 3 stir pips (→ Awake), or takes damage (→ Hunting) |
| **Stirring** (1–2 pips) | no; twitches, pips visible | no | yes | it reaches 3 pips (→ Awake); pips decay to 0 (→ Dormant) |
| **Awake** | yes: investigates its last stimulus, or wanders within its home room | no | yes | it sees you (→ Hunting); 20 turns with no stimulus (→ Returning) |
| **Hunting** | yes: pursues and attacks | yes, while it sees or hears you | no | loses you for 8 turns (→ goes to your last-known tile, searches 3 turns, → Returning) |
| **Returning** | yes: walks back to its plinth or case | no | yes | it arrives: "reinstalls" for 3 turns, then Dormant with 1 pip |

**Notes:**
- **Exhibits without a home.** An exhibit released from a broken case or diorama has no home to return to. Instead of Returning it becomes Awake and wanders. Breaking glass is permanent.
- **Patrolling exhibits** (some guard-like archetypes) start Awake.
- **Waking straight to Hunting.** A trigger that reveals your position (PROXIMITY, SEES_YOU, OBSERVED, damage) sends the exhibit straight from 3 pips to Hunting. Other triggers wake it to Awake, investigating the stimulus.

### 3.2 The stir meter

- **Size.** Every dormant exhibit has **3 pips**, and the number is the same for every exhibit. That keeps it legible: you learn one meter, not a threshold per exhibit.
- **Display.** Pips show above the sprite whenever the exhibit is in view and has at least 1 pip, and in the tombstone line.
- **Gaining pips.** Each trigger adds the pips its data says. Each trigger *type* adds at most once per turn.
- **Losing pips.** 1 pip decays per 10 stimulus-free turns before the First Bell. Pips stop decaying after the First Bell (§5).

### 3.3 Wake triggers (closed enum)

Each archetype lists 1–3 triggers. A department's rule module may add one department-wide trigger, such as Tides: "wakes when its tile floods".

| Trigger | Parameters | Fires when | Typical pips |
|---|---|---|---|
| `PROXIMITY` | r (path distance) | you are within r | 1 per turn |
| `NOISE` | min (default = hearing) | a noise event reaches its tile at volume ≥ min | 1 per event |
| `LIGHT` | lux threshold | its tile's lux ≥ threshold (your lantern or a fire) | 1 per turn |
| `DARK` | lux threshold | its tile's lux ≤ threshold (Lights Down, a shut-off lamp) | 1 per turn |
| `SEES_YOU` | none | it has line of sight to you and you are visible (§3.6). Needed for a dormant exhibit to "see" at all | 1 per turn |
| `OBSERVED` | none | it is in *your* field of view and lit. Each sketch channel turn counts double | 1 per turn |
| `UNOBSERVED` | r | you are within r and it is *not* in your field of view | 1 per turn |
| `CASE_TOUCHED` | scope: own case / room | its case is opened, bashed or cut, or its rope enclosure is crossed | 3 (own) / 1 (room) |
| `ITEM_TAKEN` | scope: own case / room / set tag | an item is removed from that scope | 2–3 |
| `ALARM` | level | the alarm in its room reaches that level | 3 |
| `CLOCK` | stage | the closing clock reaches that stage | 1–3 |
| `SYMPATHY` | set id | another member of its set wakes | 3 |
| `TAG_NEARBY` | tag, r | you carry an item with that tag within r (e.g., `ticking`, `wet`, `lit`) | 1 per turn |

Damage always wakes, straight to Hunting.

**Example record:**

```json
"awareness": {
  "start": "dormant",
  "hearing": 2,
  "triggers": [
    {"type": "PROXIMITY", "r": 2, "pips": 1},
    {"type": "TAG_NEARBY", "tag": "ticking", "r": 4, "pips": 1},
    {"type": "CASE_TOUCHED", "scope": "room", "pips": 1}
  ],
  "lose_track_after": 8,
  "reinstall_turns": 3
}
```

The tombstone carries the label truth for this record ("Keepers report that it follows anything that ticks"), and the pictogram row shows *footprints 2*, *tag: tick* and *hand on glass*.

### 3.4 Noise

- **Propagation.** A noise event has a loudness L at its source. It spreads by breadth-first search over every non-wall tile, at −1 per tile. Glass, ropes and furniture do not stop sound.
  - A closed door costs 4 extra.
  - A curtain costs 1 extra.
- **Volume.** The volume at a tile is L minus the path cost.
- **Who hears what.**
  - A *dormant* listener counts the noise if volume ≥ its hearing value: light sleepers 1, normal 2, heavy 3.
  - An *awake* listener hears any volume ≥ 1 and investigates.
  - A *hunting* listener uses the noise to update your last-known position.

| Source | L |
|---|---|
| Step (carpet / wood / stone / water / shards) | 0 / 1 / 2 / 3 / 5 |
| Tiptoe step | 0 (shards 3, water 2) |
| Melee attack, hit or miss | 5 |
| Exhibit destroyed | 6 (stone, ceramic, glass: 8) |
| Thrown object lands | 3 (a Solution vial: 4) |
| Open a case or door | 1 (staff door 2) |
| Bash glass without breaking it | 6 |
| Glass breaks | 10 |
| Room alarm bell | 12 at the bell, plus the alarm rules |
| Tuning Fork, at its target tile | 8 |
| Evacuation Notice, at you | 10 |
| Coughing (drank Fumigant) | 6 per turn for 5 turns |

**Worked numbers.** A normal sleeper 3 tiles away hears a melee swing (5 − 3 = 2) but not a marble footstep (2 − 3 < 0). Breaking glass (10) stirs every normal sleeper within 8 path tiles. This is why breaking glass is the museum's big decision (ML D7).

### 3.5 Light

Light has five integer **lux bands**. A room's base band comes from the material on display (LM F26: 50 lux for paper and textiles, 150 for oils, wood and leather, more for stone and metal):

| Band | Name | Base for |
|---|---|---|
| 0 | Dark | storage after Lights Down; back-of-house during Night Watch |
| 1 | Dim | paper, textiles, photographs, feathers, specimens; back-of-house |
| 2 | Low | oils, wood, leather, lacquer |
| 3 | Bright | stone, metal, ceramics, glass |
| 4 | Spotlit | exhibit tiles with a spotlight; diorama interiors |

**What changes a tile's band:**
- **Spotlights:** +1 on exhibit tiles, up to a cap of 4.
- **Your lantern:** tiles within radius 3 of you are at least Low.
- **Fire:** tiles within radius 2 are at least Bright.
- **Lights Down:** −1 to ambient bands. Spotlights stay on.
- **Night Watch:** −2 to ambient bands. Spotlights go off except the Masterpiece's.
- **Department alarm (level 2):** all public rooms are Bright for 40 turns (security lighting).

**Switching the lantern on** fires an immediate `LIGHT` check for every exhibit within radius 3. Any Awake exhibit with line of sight to you within 12 tiles notices the light and investigates it.

### 3.6 Sight

**Your vision.** You see a tile if it is in line of sight, within 12, and either adjacent to you or within the distance its band allows:

| Target tile's band | You see it from | An enemy with line of sight sees *you* on such a tile from |
|---|---|---|
| Dark (0) | 1 | 1 |
| Dim (1) | 4 | 3 |
| Low (2) | 8 | 6 |
| Bright (3) | 12 | 9 |
| Spotlit (4) | 12 | 12 |

**The asymmetry is deliberate.** In Dim and Low rooms you see one or two tiles further than you are seen. That is the margin stealth play needs.

**Spotlit exhibits** are visible across a dark gallery, which is also how real dark galleries look (TA F13).

**Guards** see the same way, carry a lantern (radius 2), and have no facing cone. Cones are a later option, because they add a reading burden on phones.

### 3.7 Guards, patrols and breaches

**Guards are staff.**
- **Numbers per department.** Default 1. Guarded as secondary challenge: 2. Guarded as primary: 3.
- **Patrols.** A guard patrols a cycle of 3–5 posts on the high-integration rooms (ML F1), pausing 5 turns at each.
- **They cannot be damaged.** Bumping a neutral guard swaps places with them ("Excuse me").
- **What items do to guards.** A Flash Camera stuns a guard for 2 turns. Fumigant blocks their sight. An Evacuation Notice sends them out of the room for 15 turns. "Quiet, Please" does not affect them.

**Breaches** are what a guard reacts to on seeing it:
- opening, bashing or cutting a case;
- crossing or unhooking a rope;
- striking a Dormant or Stirring exhibit (vandalism);
- passing through a staff door;
- mounting a plinth.

Hearing glass break makes a guard investigate.

**Not breaches:**
- fighting an Awake or Hunting exhibit ("self-defence; the night staff are used to it");
- walking, tiptoeing or reading;
- sketching, for the Copyist only (§10).

**Guard states:** Patrol → Investigate (heard a breach) → Pursuit (witnessed a breach, raises a room alarm) → Escort.

**Custody:**
- Each turn a Pursuit guard is adjacent to you, you gain 1 Custody pip. This is deterministic, with no roll.
- At **3 Custody pips** you are escorted (Decision C3).
- Custody decays 1 pip per 10 turns out of contact.

**Decision C3: what happens when a guard catches you?**

| Option | Tradeoff |
|---|---|
| (a) **Escorted back to the department entrance, with confiscation.** Items you took from this department's cases and still carry unequipped go back to their cases, relocked. Clock +20 turns. Alarm reset | A stealth failure costs time and loot, never the run. Equipping an item protects it, which is a nice small rule. |
| (b) Escorted to the exit doors with no Certificate | A harsh skip that ends the department. |
| (c) The run ends | Matches the frame's "escort = retire" literally, but punishes stealth harder than death. |
| (d) Guards fight | Simplest to build, but violence against staff breaks the tone. |

*Lean: (a) during stages 0–2, and (b) for capture by the Night Watch (§5.3).* Voluntary retirement stays a *conversation* with a neutral guard (§12). If Julian picks (c), the Guarded challenge type needs fewer guards and stronger hiding.

### 3.8 Alarms

| Level | Raised by | Effects | Decays |
|---|---|---|---|
| 0 Quiet | none | none | none |
| 1 Room alarm | A guard witnesses a breach; the first bash on Security glass; a fire; an awake Sentinel-archetype exhibit | The bell sounds (noise 12 at the room centre). Every exhibit in the room +3 pips. Guards within 20 path tiles converge on the room | 30 turns after the last breach |
| 2 Department alarm | Two room alarms within 60 turns; breaking Security glass | All guards in Pursuit toward the last breach. Security lighting (all public rooms Bright for 40 turns). Every Dormant exhibit +1 pip. Every Stirring exhibit wakes. Clock +50 turns | Falls to level 1 after 40 turns without a breach |

**How alarms travel.**
- A room alarm spreads physically, as noise. Its bell (L = 12) reaches neighbouring rooms by the noise rules.
- A department alarm spreads by the public-address system, reaching every room.
- Guards converge by room-graph distance.
- The Masterpiece reacts to alarms only if its data says so (enemies section). RS F7 suggests that gallery events should shape the Masterpiece fight.

### 3.9 Hiding

| Method | Rule | Cost |
|---|---|---|
| Darkness | On a Dark tile you are seen only from adjacent tiles | You see 1 tile. Labels are unreadable without the lantern |
| Curtains | Passable and sight-blocking. Standing in one, you are unseen unless an enemy is adjacent | Few and fixed |
| Closed doors | Block sight. A Hunting exhibit that loses you behind one goes to your last-known tile | 100 ticks to close |
| Fumigant cloud | 5×5 for 10 turns. Blocks sight; dormant exhibits inside lose 1 pip per turn | One consumable |
| **Pose on an empty plinth** | While you stand still on an empty plinth, guards and Awake exhibits treat you as a dormant exhibit. A Hunter that did not see you mount it loses you | Mounting costs 200, and mounting in a guard's sight is a breach. After 15 turns a guard who sees you notices ("that wasn't there before") |
| **Join a tour** | Social departments, or the Docent class. Within 1 tile of 2 or more tour members: guards ignore you, and an exhibit's PROXIMITY and SEES_YOU triggers add at most 1 pip per turn to the whole group | You move at the tour's pace and along its route. After Konigsburg's runaways among school groups (LM §3.1) |
| Staff corridors | Dim and empty of exhibits, but guards walk them | Clearance (§4) |

**Decision C4: a tiptoe toggle?**

| Option | Tradeoff |
|---|---|
| (a) **Yes: 200 ticks per step, noise 0** | Turns stealth into a clock tradeoff any player understands. One more button. |
| (b) No: stealth comes only from floor material, garments and perks | Simpler UI; stealth becomes gear-gated. |
| (c) Tiptoe only as a perk or garment property | A middle path, but stealth-curious players without the perk are stuck. |

*Lean: (a).* The closing clock gives tiptoe a real price, which is the interaction we want. If Julian picks (b), the Guarded perk Soft Soles becomes mandatory and should move into the Light garment form.

---

## 4. Furniture interactions

This follows ML §3.2's matrix of movement × sight.

| Furniture | Move | Sight | Sound | Interactions |
|---|---|---|---|---|
| Floor (carpet / parquet / stone) | pass | pass | pass | Step noise 0 / 1 / 2 |
| Archway (3 wide) | pass | pass | pass | Cannot be closed |
| Door | pass when open | blocked when closed | +4 when closed | Open by bump, 100 ticks, noise 1. Close: 100. Locked doors ("Closed for reinstallation") need the department key (layout lock/key) |
| Staff door (marked "Staff only · Clearance N") | pass if Clearance ≥ N | as door | as door | 100 ticks, noise 2; a breach if seen. Without Clearance: a staff key, or force the latch with a Heavy weapon (2 bashes, noise 6 each, breach). Staff routes are never required (ML §3.4) |
| Hinged panel (Soane, LM F16) | as a door, once found | as door | as door | Hidden. Found by Search, passive search, or a Floor Plan |
| Vitrine (`v`) | **blocked** | **pass** | pass | See §4.1 |
| Diorama glass + interior (`~`, `d`) | blocked | pass | pass | Laminated glass. Interior Spotlit. Inhabitants form a SYMPATHY set. An Awake inhabitant breaks out in 2 telegraphed turns (cracks appear). May hold one item behind the inhabitants |
| Rope line (`=`) | pass, 200 ticks | pass | pass | Noise 1. CASE_TOUCHED for the enclosure's exhibits; a breach. Unhooking it (100) makes it floor permanently. Enemies cross at 100 |
| Plinth with a statue (`o`) | blocked | blocked | pass | Pillar loops. A dormant statue lives here |
| Low plinth (small object) | blocked | pass | pass | As a vitrine without glass. Taking from it fires ITEM_TAKEN |
| Empty plinth | pass, 200 to mount | pass | pass | Pose (§3.9) |
| Bench (`b`) | pass | pass | pass | Sit: rest at ×2 regeneration. Benches face the centrepiece (ML F17), so they double as landmarks |
| Velvet curtain | pass | blocked | +1 | Hiding |
| Balustrade or void (`~`) | blocked | pass | pass | Separates balconies from the floor |
| Balcony (`:`, elevated) | via stairs (200 per stair tile) | pass | pass | Ranged attacks from it: +10 hit, +2 range. Ranged attacks at it: −10. No melee across a balustrade. Thrown items drop to the floor below |
| Column or tall statue | blocked | blocked | pass | |
| Shelving (`H`) | blocked | blocked | pass | A compactor is a movable wall: its lever costs 200, noise 4 |
| Crate (`c`) | blocked | blocked | pass | Push 1 tile (100, noise 2) if the tile beyond is free |
| Pool or water | pass, 200 | pass | pass | Noise 3. Extinguishes fire. Tides family hazards |
| Shards | pass | pass | pass | Noise 5 and 1 damage per step, unless you tiptoe (noise 3, no damage) or wear soft soles |
| Label plaque or lectern | lectern blocked; plaque on the wall | pass | pass | Read within 2 tiles if lit (free). The section panel shows as a banner on entering a gallery |
| Donation box | blocked | pass | pass | Holds coins. Open with Clearance 11 (200, noise 1), or bash it (a breach) |
| Turnstile | one way | pass | pass | Temporary-exhibition programme |

### 4.1 Vitrines in detail

**Glass grades:**

| Grade | Bashes to break | Lock level (Clearance) | Alarm |
|---|---|---|---|
| Plate | 1 | 10–11 | none |
| Laminated | 2 | 11–13 | none |
| Security | 3 | 13–16 | The first bash raises a room alarm; breaking it raises a department alarm |

**Bashing:**
- Each bash costs 100 ticks with noise 6. The breaking bash makes noise 10.
- Heavy weapons count as 2 bashes per swing at 150 ticks.
- Light weapons cannot break Laminated or Security glass. They make noise and achieve nothing.

**Breaking:**
- The case tile becomes a *broken case*: passable, with shards.
- One adjacent floor tile on your side also gets shards.
- The contents can be taken from an adjacent tile.
- A dormant exhibit inside wakes Hunting and has no home to return to.

**Opening without breaking:**
- **Clearance at or above the lock level:** 200 ticks, noise 1, fires CASE_TOUCHED.
- **Glass Cutter:** 300 ticks, noise 1, no alarm even on Security glass, and it uses a charge.
- **Solvent (thrown):** silently dissolves every case in a 3×3 area. It does *not* fire CASE_TOUCHED. It is the stealth player's best consumable.
- **Closing a case** you opened costs 100 ticks.

**Contents.** 0 or 1 item, and/or a dormant exhibit.
- About 1 case in 6 is a "label without its object" ("On loan elsewhere", LM §3.1). It is a text beat with no loot.
- Guaranteed Highlights are never placed behind a lock above your current Clearance and never in a secret room (RS F6).

**Edge case.** The layout validator forbids vitrines on chokepoint (gate) cells (ML F9). A vitrine broken mid-run never blocks; it only opens space.

---

## 5. The closing-time clock

### 5.1 Budget

**Formula:**
- `L_tour` = the length in tiles of a walk from the entrance through every gallery's centre, then the Masterpiece hall, then the nearest exit door. It is computed once per department by the layout pipeline, using a nearest-neighbour tour over the room graph.
- **Open hours:** `B = round10(2.5 × L_tour + 100)`.
- **Stage gap:** `G = max(60, round10(0.15 × B))`.

| Department size | Galleries | L_tour (typical) | B (First Bell) | Lights Down | Night Watch |
|---|---|---|---|---|---|
| Small | 5–6 | 150 | 480 | 550 | 620 |
| Medium | 7–8 | 220 | 650 | 750 | 850 |
| Large | 9–10 | 280 | 800 | 920 | 1040 |

**Modifiers:**
- Attrition challenge type: B × 0.75.
- Trustees' Directive *Extended Hours*: B × 0.8.
- Perk *Packed Lunch*: B × 1.1, or × 1.2 at rank 2.
- Modifiers multiply.

**Calibration targets for the persona simulator** (persona roster from PL §(ii)):
- The median **Completist** reaches every Highlight before Lights Down in about 70% of seeds.
- The median **Tourist** leaves before the First Bell.
- The **Cautious** novice is never forced into the Night Watch by the budget alone.

**Real-time check.** About 80 turns per minute of average play is my unmeasured estimate. On that estimate a medium department reaches the First Bell in about 8 minutes, which fits 8 departments in a 70–90 minute run. Tiptoe-heavy play will run longer (see Challenges).

### 5.2 Stages

| Stage | Starts | Announcement (PA, a section-panel banner) | Effects |
|---|---|---|---|
| 0 After Hours | 0 | the department intro panel | Normal. Pips decay 1 per 10 turns. Regeneration at its normal rate |
| 1 **First Bell** | B | "The Museum is now closed. Visitors are asked to make their way to the exits." | Stir pips stop decaying. Guards switch to Closing Rounds: their patrol extends to every public gallery, sweeping from the exits toward the far end. The HUD dial shows the time to Lights Down |
| 2 **Lights Down** | B + G | (the lights dim) | Ambient −1 band. Regeneration interval ×2. The Masterpiece goes to Stirring (2 pips) and its PROXIMITY radius becomes 3 |
| 3 **Night Watch** | B + 2G | "The night watch has begun its rounds." | Ambient −2 bands; spotlights off except the Masterpiece's. **Regeneration stops.** One Watchman enters at the department entrance. **Every 50 turns:** one more Watchman enters, and the 3 Dormant exhibits nearest you by path wake Awake and investigate your position |

### 5.3 The Night Watch

**Watchmen are staff.**
- **Movement and senses.** Normal speed, a lantern of radius 2. They path to your *actual* position: the night watch knows its rounds.
- **They cannot be harmed.** A Flash Camera stuns each Watchman once, for 2 turns.
- **Custody.** 2 pips, not 3.
- **Capture by a Watchman.** You are escorted to the department's exit doors and still choose a door. You lose the following:
  - any Certificate not yet earned;
  - every unfound Highlight;
  - case items you carry unequipped (confiscated).
- **Escalation.** The lethal part of the Night Watch comes from the exhibits it wakes, not from the staff.

### 5.4 The Masterpiece and the clock

**The hall seals.** When the Masterpiece becomes Hunting, its hall's openings shutter "for the demonstration".
- The clock **pauses** while the hall is sealed, as SPD pauses hunger on locked boss levels (RS F3).
- Watchmen wait outside.
- When the Masterpiece is defeated the shutters open and the clock resumes.
- The way out of a sealed hall is a **Re-admission Ticket**. It moves you to the department entrance and unseals the hall; the Masterpiece Returns and recovers 25% of its HP.
- Sealing is also the anti-kiting rule for Masterpieces (RS pitfall 7).

**Two ways to earn the Certificate:**
- **Defeat the Masterpiece:** the Certificate, plus its **Signature piece** (§6.5).
- **View it:** read its gateway label on the lectern inside the hall, within 2 tiles of the lectern, while the Masterpiece is still Dormant or Stirring. The lectern stands 3–4 tiles from the Masterpiece's plinth and is lit Low. Viewing earns the Certificate without the Signature piece. A Copyist may instead complete a sketch of the Masterpiece (§9).

**The viewing window shrinks with the clock:**

| Stage | Masterpiece | Viewing |
|---|---|---|
| 0–1 | Dormant, normal triggers (usually PROXIMITY 2 plus department triggers) | Feasible with care |
| 2 Lights Down | Stirring at 2 pips, PROXIMITY 3 | Hard: one more pip wakes it |
| 3 Night Watch | Awake; entering the hall seals it | Impossible: fight it, or be escorted |

**Decision C5: what does viewing earn?**

| Option | Tradeoff |
|---|---|
| (a) The same as defeat | Stealth is fully equal, but fighting the Masterpiece then has no reason. |
| (b) **The Certificate without the Signature piece** | Both paths are real: fighting pays in gear, viewing pays in HP, time and supplies saved. |
| (c) The Certificate only by defeat | Simplest, but sneaking becomes second-class. That contradicts pillar 3. |

*Lean: (b).* If Julian picks (c), the clock should run slower for Guarded departments, and the Copyist loses its Masterpiece hook.

### 5.5 Leaving early

- The exit doors are usable at any time; whether reaching them means passing the Masterpiece hall is a layout question.
- Leaving forfeits every unfound Highlight and any unearned Certificate.
- There is **no time bonus.** Leaving early pays in HP and consumables saved, and that is enough.
- *Option for Julian:* bank up to 100 unused open-hours turns as Grace for the next department. It rewards Tourist play, but it is one more number to track. *Lean: no.*

### 5.6 Why this stops pillar dancing

Pillar dancing means circling a loop to regenerate or to shed a same-speed pursuer (ML F11). DCSS answered it with attacks of opportunity (33% free hits). We answer it with the clock (ML D6c):

1. **Regeneration is slow and clocked.** The interval is `max(4, floor(400 / maxHP))` turns per HP, so full recovery takes about 400 turns from any HP total.
   - Example: at department 4 (max HP 35, 11 turns per HP), circling a sculpture court to recover 10 HP costs about 110 turns, a sixth of a medium department's open hours.
2. **After Lights Down** the same 10 HP costs 220 turns.
3. **During the Night Watch** it is impossible.
4. **Pips stop decaying at the First Bell**, so circling dormant exhibits only ever raises their pips.
5. **Watchmen** know where you are, multiply, and arrive from the entrance side, so a loop eventually holds two of them. Their escalation also wakes the exhibits nearest you.

---

## 6. Inventory and equipment

### 6.1 Slots

| Slot | Count | Holds |
|---|---|---|
| Weapon | 1 | A melee implement (§2.5) |
| Garment | 1 | Coats, aprons, tunics, armour from armoury departments (§2.5) |
| Curio | 2 | Passive or triggered properties (ring and artifact analogues) |
| Instrument | 1 | A charged active tool (wand analogue) |
| Lantern | fixed | Everyone carries one; it is not a slot |
| Sketchbook | fixed | Pages, under the sketch decision (§9) |
| Lanyard | fixed | Clearance level, department keys, staff keys. Uses no tote slots |
| Tote bag | 16 slots | Consumables stack by kind (one slot per kind). Each unequipped equipment item takes one slot |

**Quickslots:** 3 on a portrait phone, 6 on landscape or desktop. Any consumable kind, instrument or sketch page can be slotted.

There is no weight system. Handling Clearance is the only carrying constraint.

### 6.2 Handling Clearance

**One number does three jobs:**
- it gates equipment (§2.5);
- it opens locked cases (§4.1);
- it opens staff doors (§4).

You start at 10 and gain +1 from the department's guaranteed Clearance card. Doors and case locks spawn at levels from 10 up to 10 + depth. Each department therefore has a few locks you can open, and a few you can open only by breaking them or with the next card.

### 6.3 Equipment categories

**Weapons and garments** (§2.5).
- Departments reskin every form: in Machines the Heavy form is a "Regulator's Spanner", in Tides it is a "Boathook, Dredging Pattern".
- An item may carry one **property** from the closed effect-primitive registry (pillar 1), such as *Quiet* (−1 step noise), *Lit* (counts as your lantern), *Glazier's* (+1 bash) or *Tidal* (+2 damage on water tiles).

**Curios** hold one property at a rank that Restoration raises. Examples:

| Curio (default skin) | Property | Rank effect |
|---|---|---|
| Ticket Stub | Once per department, when you would reach full Custody, your Custody resets to 0 | Rank 2: twice |
| Hearing Trumpet | Shows the volume rings of every noise event within 10 | +2 radius per rank |
| Pocket Watch | The HUD shows exact turns to the next stage; +5% B | +5% per rank |
| Spare Spectacles | Dim tiles count as Low for your vision | Rank 2: also Dark counts as Dim |
| Lucky Coin | The first miss each gallery re-rolls | +1 re-roll per rank |
| Cotton Gloves | Opening cases does not fire CASE_TOUCHED in the room scope | Rank 2: nor in the own-case scope |

**Instruments** hold charges, which recharge over time:

| Instrument | Effect | Charges / turns per recharge |
|---|---|---|
| Flash Camera | A 3-tile cone: Dazed 3 turns; stuns a guard 2 turns (each Watchman once) | 2 / 60 |
| Tuning Fork | Noise of 8 at a target tile within 8 (a lure) | 3 / 40 |
| Glass Cutter | Silent case opening (§4.1) | 3 / 80 |
| Window Pole | Push or pull an object 1 tile, or take an item from an open case, at range 2 | 4 / 40 |
| Catapult (elastic) | A ranged attack, damage [t, 2t+2], using Acc | 4 / 30 |
| Magnifier | Inspect costs 100 instead of 300 and works on Dim tiles | unlimited |

Restoration on an instrument: +1 maximum charge and −10% recharge time per level.

### 6.4 The twelve consumable kinds

There are two families of six. The *kind* (the mechanic) is fixed. A *seal* is shuffled per run: 6 wax-seal colours, each with its own glyph, for Solutions, and 6 ink stamps for Ephemera. The seal carries identification across the whole run. The *name* and sprite are the department's reskin.

An unidentified item reads, for example, "Jar of Sea Fret · verdigris seal (bar)". Once that seal's kind is known, every verdigris-sealed item in every later department shows "Fumigant" beneath its local name.

**Solutions** are drunk (affecting you) or thrown (shattering over 3×3, noise 4):

| Kind | Drink | Throw | Deck weight |
|---|---|---|---|
| **Consolidant** | Heal 50% of max HP now, plus 25% over 5 turns | Heals every creature in 3×3 by 50%, exhibits included | 20 |
| **Fixative** | *Harmful:* you are Fixed (cannot move or act) for 4 turns | Fixes every creature in 3×3 for 4 turns | 8 |
| **Fumigant** | *Harmful:* you cough, noise 6 per turn for 5 turns | A 5×5 cloud for 10 turns: blocks sight, and dormant exhibits inside lose 1 pip per turn | 10 |
| **Solvent** | Removes all negative statuses from you | Dissolves case glass in 3×3 silently (no noise, no shards, no alarm, no CASE_TOUCHED); also clears Fixed and wax | 8 |
| **Lamp Oil** | *Harmful:* Burning for 3 turns | Fire in 3×3 for 4 turns at 3 + depth damage per turn. Spreads 1 tile per turn into paper, textile, wood and carpet. Any fire raises a room alarm | 6 |
| **Developer** | For 30 turns you see every exhibit and guard in the department through walls, with their states | Creatures in 3×3 are Marked (visible through walls) for 50 turns | 6 |

**Ephemera** are read:

| Kind | Read | Deck weight |
|---|---|---|
| **Catalogue Card** | Choose an item: it becomes fully catalogued (rung 5). Or choose an unknown seal: its kind is identified | 14 |
| **Floor Plan** | Reveals the department's layout, hinged panels and staff doors, and the room of each remaining Highlight | 8 |
| **"Quiet, Please"** | Every exhibit within 8 path tiles loses all its pips. Awake exhibits that are not Hunting settle where they stand. Hunting exhibits drop to Awake. Guards are unaffected | 8 |
| **Re-admission Ticket** | Moves you to the entrance safe zone of this department. Hunters lose you. Unseals a Masterpiece hall | 5 |
| **Deaccession Form** | Every forgery you carry becomes an honest copy (§7.4). Also reveals the forgery status (rung ≥ 1) of all carried equipment | 4 |
| **Evacuation Notice** | *Situational:* every Awake or Hunting exhibit within 10 flees from you for 8 turns. Guards leave the room for 15 turns. A fire-drill bell sounds at you (noise 10) | 3 |

**Supply.**
- Ambient consumables come from one run-level deck of 100 cards in these weights, drawn without replacement and refilled when empty (SPD and Brogue metering, RS F2).
- Each department places 7 ambient consumables. Shops sell more.
- No department may add a 13th kind (RS F9, pitfall 3).

**Reskin examples:**

| Kind | Tides 2, *Weathers, Domesticated* | Machines 1, *Instruments That Keep Time Badly* | Light 1, *Works on Paper, Kept Dark* |
|---|---|---|---|
| Consolidant | Rainwater, Collected at Slack Tide | Clock Oil, Light Grade | Wheat-Starch Paste |
| Fumigant | Jar of Sea Fret | Workshop Smoke, Bottled | Moth Fumigant, Prewar |
| Floor Plan | Tide Table, Annotated | Exploded Diagram | Shelf List |
| "Quiet, Please" | Notice: Sea Closed for Cleaning | Notice: Clocks Stopped for Cleaning | Reading Room Rules |

**What the content pipeline must supply.** Each department pack provides, for all 12 kinds: a name, a silhouette, a one-line tombstone, and one *identifying label* of 40–70 words carrying the mechanical truth, checked by the round-trip validator.

### 6.5 Department signature items

Ordinary equipment is a form plus a tier plus one property, under a department name. **Signature pieces** differ in five ways:

1. They have **two** properties from the registry, plus one trigger tied to the department's rule module. Examples: "Umbrella for Indoor Weather": halves ranged and falling damage, narrows forward vision, three breaks left (LM §3.3). "Pendulum-Weighted Cane": its third consecutive attack on one target is a sweep.
2. They come from the Masterpiece on defeat, or from a Loan Desk.
3. They are never forgeries.
4. Reading the gateway label catalogues them fully, so a pick-one choice is never blind (Brogue auto-ID, RS F4).
5. They are always eligible for accession (meta section).

### 6.6 Loot volume per department

| Source | Count |
|---|---|
| Ambient consumables | 7 |
| Ambient equipment (weapon or garment) | 2 |
| Curio or instrument | 1 |
| Highlights | 2 Restoration kits, 1 Clearance card |
| Loan Desk | in about half of departments: borrow 1 of 3 catalogued items, swaps allowed (Brogue library, RS F11) |
| Signature piece | 1, on defeating the Masterpiece |
| Coins | about 30–50, from donation boxes, fountains and fellow visitors |

That totals about 13 items per department and about 100 per run, close to SPD's density (RS F1).

**Exhibits drop nothing.** Loot lives in the cases they stand beside. Killing an exhibit buys access and safety, never loot (§8.1).

---

## 7. Identification as attribution

### 7.1 The ladder (equipment)

The qualifiers follow ARLIS/NA–VRA usage (LM F24). Rung names show on the tombstone line in place of the maker.

| Rung | Label (frame names) | You know |
|---|---|---|
| 0 | *After [department]*. I propose **Uncatalogued**; see Challenges | Form, tier, Clearance requirement, nominal +0 stats |
| 1 | *Manner of …* | Whether it is a **forgery** |
| 2 | *Circle of …* | Its property *family* (the pictogram family) |
| 3 | *Workshop of …* | The exact property |
| 4 | *Attributed to …* | Its Restoration level (+N, possibly negative) |
| 5 | *By …* | Fully catalogued: credit line, provenance state (loan, claim), accession eligibility, the full label |

### 7.2 What advances it

- **Use, gated by exploration.** When you enter a gallery for the first time, every equipped item you have *used* since its last rung advances one rung, at most one rung per gallery.
  - "Used" means: a weapon swung, a garment was struck, an instrument was used, a curio triggered (or, for a passive curio, was worn for 50 turns).
  - So 5 new galleries fully catalogue an item in use: in practice one department.
  - Fighting in place catalogues nothing. This is SPD's anti-grind gate (RS F4), with exploration in place of XP.
- **Inspect** (300 ticks; Bright, or the lantern on; or the Magnifier). Moves rung 0 to rung 1. Once per item.
- **Equipping** a rung-0 item moves it to rung 1 immediately. If it is a forgery, it takes hold.
- **Catalogue Card:** any item to rung 5.
- **The Registrar** (§11): one item to rung 5, free, once per meeting.
- **A Restoration kit** applied to an uncatalogued item moves it to at least rung 1 and reveals its new +N (rung 4 information, but not the property).

### 7.3 Consumable kinds

Kinds are binary: a seal is either identified for the run or not. A kind is identified by:

1. **Using one.** Use-identification is immediate.
2. **Reading an identifying label.**
   - Each department displays **at least 2** identifying labels for kinds you do not yet know, at least one in the Intro or first Section.
   - The plaque carries a seal pictogram, so a player who never reads still knows that opening it pays.
   - Opening the full label identifies the kind for the run. This is the museal text doing mechanical work (RS §3.6).
   - If you already know every kind, these plaques show ordinary text.
3. **A Catalogue Card**, read on a seal.
4. **A Docent's gallery talk** (§11), or the Good Listener perk.
5. **Class starting knowledge** (§10), and meta Guidebook entries (meta section).

**Shop stock is always identified.**

### 7.4 Forgeries

**Frequency.** 12% of ambient equipment in departments 1–4 and 18% in departments 5–8 are forgeries. The *Strict Provenance* directive raises this. Highlights, Loans and Signature pieces are never forgeries.

**A forgery has three faults:**
- a **hold**: once equipped, it cannot be removed;
- **one defect** from a closed list:
  - Loud: +2 step noise;
  - Luminous: counts as your lantern, always on;
  - Ungainly: +50 ticks per attack;
  - Tarnished: −2 Acc;
  - Brittle: −2 Padding;
  - Conspicuous: exhibits within 3 tiles gain +1 pip per turn;
- a Restoration level of −1 to −3.

**What equipping one shows.** Its tombstone reads *After [maker] (forgery)*, the broken-seal pictogram appears, and the defect is shown.

**Three ways out:**

| Method | Removes the hold | Removes the defect | Notes |
|---|---|---|---|
| Restoration kit | yes | no | +1 level as usual |
| Deaccession Form | yes | yes | Negative +N rises to 0. The item becomes an honest copy, *After [maker]*, a usable item |
| Conservator NPC | yes | yes | For coins (§11) |

Telegraphs and odds readouts never lie, even when a forgery is involved. A defect changes your numbers, and the readout shows the changed numbers.

### 7.5 Loans

Loan Desk items and the meta Loan slot are **always at rung 5** and carry an "On loan from …" credit line (RS F4, §3.6). The game never offers an uninformed pick-one choice.

### 7.6 Edge cases

- **Two departments, two names for one kind.** Two departments reskin the same kind with different names, but the seal is the same. The tote groups by seal and lists both names.
- **The Funes rule** (LM F6), a department modifier, suspends point 2 of §7.3 inside its department: labels there do not identify. It is announced on the intro panel.
- **Unequipping clears nothing.** An item's rung progress persists when it is unequipped.

---

## 8. In-run progression

### 8.1 No XP

**The argument:**
1. **Stealth needs it.** If killing grants XP, every exhibit you sneak past is power left on the floor, and pillar 3's "fight, sneak and leave" collapses into "fight". Brogue's removal of levels made stealth viable (RS F10).
2. **The clock needs it.** XP turns farming into the optimal play, and the clock exists to stop farming. DCSS defines grinding as low risk, slow and rewarding, and warns that "it may be optimal to do so" (RS F12).
3. **Random department order needs it.** Quota-based power is a known function of depth, so the balancer can compute it. XP-based power depends on how much a player killed, which varies widely.
4. **SPD's own designer found levelling "does nothing for the game's fun factor"** and kept it only for the stat boost (RS F5). Restoration kits and Certificates supply the stat boost.

**What fighting is still for:** safety, access to cases, the Masterpiece's Signature piece, and clearing a route before the clock turns.

**The alternative (RS D4c):** XP from discovery (reading labels, cataloguing). It would make reading mandatory and grindable (reread, re-examine). It also rewards the players least likely to need help. *Rejected for v1.*

### 8.2 Restoration kits

**Quota.** 2 per department, guaranteed, placed by the layout pipeline. Never in secret rooms, never behind a lock above your current Clearance. 16 per run (Brogue: about 14.8 enchant scrolls per run, RS F10).

**Effects by slot:**

| Slot | +1 level gives |
|---|---|
| Weapon | +1 min and +1 max damage; +1 Acc at every even level |
| Garment | +1 Padding |
| Curio | +1 property rank |
| Instrument | +1 max charge, −10% recharge time |
| Sketch page (Copyist) | +1 sketch rank (§9) |

**On a forgery:** also removes the hold (§7.4).

**Transferring levels.** Kits are per item, which makes swapping weapons painful. The Stair Hall Conservator moves all levels from one item to another of the same slot, losing 1 level, once per floor (§11).

### 8.3 Handling Clearance

1 Clearance card per department, guaranteed like the kits. The three uses are in §6.2. The deliberate shortfall against top-tier items is in §2.5.

### 8.4 The Certificate

**How you earn it.** Defeat or view the Masterpiece (§5.4). It is awarded on the spot:
- **+5 max HP**, and heal 5;
- **choose one perk from three**:
  - two offers from the department's *primary* challenge family, one from its *secondary*;
  - a perk you already hold may be offered at rank 2 (each perk has 2 ranks).

**Why ranks and fixed beats.** Perks arrive at fixed beats and stack by rank. There is no tree, which follows SPD's rejection of trees in short runs (RS F5). Families are tied to the challenge type, so the exit placard's challenge icon is also a build choice, as a Hades god is (RS §3.4, F15).

**The last third.** A run-level late-game arc, such as a specialisation at the floor-3 Stair Hall, belongs to the run-structure section. I flag it here because SPD found that progression ebbs once a build is finalised (RS F5).

### 8.5 Perk families

Triggered perks are preferred, after SPD's talents (RS F5): "they enhance the player's interaction with specific parts of the game without the complexity burden of activating them directly".

| Family | Perk | Rank 1 | Rank 2 |
|---|---|---|---|
| **Swarm** | Crowd Management | When 3+ hostile exhibits are adjacent, your next melee attack hits all adjacent enemies | At 2+ |
| | Single File | An enemy that steps into a doorway or archway tile adjacent to you loses its next action (once per enemy) | Also takes 3 damage |
| | Sweeping Up | Destroying an exhibit with a surprise attack makes that action cost 0 ticks (once per 5 turns) | No cooldown |
| | Elbow Room | While 3+ enemies are adjacent, +3 Padding | +5 |
| **Artillery** | Behind Glass | Ranged attacks on you that cross a glass tile get −25 hit | −40 |
| | Duck and Cover | When a telegraphed special resolves and misses you, your next action costs 50 ticks less | And your next attack is a surprise attack |
| | Spotter | Artillery wind-ups aimed at you take one extra turn | Also shown on the floor plan |
| | Close the Distance | Your first step toward an artillery exhibit that is targeting you costs 0 ticks (once per enemy) | Two steps |
| **Guarded** | Soft Soles | Step noise −1; tiptoe costs 150 | Tiptoe costs 100 |
| | Familiar Face | The first time each department a guard would raise an alarm on you, they hesitate 3 turns; break line of sight to cancel it | Twice per department |
| | Light Fingers | Opening a case you have Clearance for costs 100 ticks, with no room-scope CASE_TOUCHED | Works on locks 1 level above your Clearance |
| | Vanishing Act | A Hunter that loses sight of you goes straight to Returning | And loses its next action |
| **Darkness** | Night Eyes | Dark tiles count as Dim for your vision | Dim counts as Low |
| | Shuttered Lantern | You can set your lantern's radius to 1 | Your lantern no longer makes you visible beyond 3 |
| | Afterimage | Stepping from a Low-or-brighter tile onto a Dark tile makes current pursuers lose you | And Dazes them 1 turn |
| | Moth Sense | LIGHT- and DARK-triggered exhibits show their pip meters through walls within 8 | Within 12 |
| **Hazard terrain** | Sure Footing | Immune to shards and wax | Shards make no noise |
| | Wader | Water costs normal time | Enemies in water adjacent to you are Slowed |
| | Firebreak | Fire never spreads into tiles adjacent to you; half fire damage | Immune |
| | Surveyor | Entering a gallery reveals its hazard tiles | Also its pressure plates and switches |
| **Locks and puzzles** | Master Key | The first locked case or door per department opens as if you had the Clearance | Two per department |
| | Lever Sense | Hinged panels, switches and plates within 6 are revealed | Within 10; Search costs 100 |
| | Clearance by Association | Staff doors need 2 less Clearance | 4 less |
| | Puzzle Box | Solving a department's lock-and-key room gives a Catalogue Card | And a Floor Plan |
| **Attrition** | Packed Lunch | B × 1.1 | × 1.2 |
| | Bench Warmer | Benches regenerate ×3 | Benches work during the Night Watch |
| | Second Wind | Once per department, dropping below 25% HP heals 25% of max HP over 5 turns | 40% |
| | Thermos | Consolidants heal 25% more | 50% more |
| **Social** | Friend of the Museum | Shop and service prices −25% | −40% |
| | Good Listener | Meeting an NPC for the first time identifies one unknown kind | Two kinds |
| | Tour Regular | Tour groups wait for you and steer toward your tapped destination | Tours appear in any department with a Docent |
| | Smooth Talker | Guard Custody needs 4 pips (Watchmen 3) | 5 (Watchmen 3) |

That is 32 perks, 4 per family. A launch build needs 3 per family, with the fourth as a stretch.

### 8.6 Quotas made visible

The intro panel and the floor plan's sidebar carry the department's "Highlights of this collection" box. SPD tells the player its guarantees outright (RS F1). Ours appears in the department's own voice:

```
HIGHLIGHTS OF THIS COLLECTION                     Rooms 400-431
  Restoration kits              [x] [ ]
  Handling Clearance            [ ]
  Loan Desk                     Room 412
  Masterpiece                   The Regulator's Clock, Room 430
  Labels that catalogue         [x] [ ]
```

**Rules:**
- Boxes tick as Highlights are taken.
- Rooms are named only where the visitor would know them (the Loan Desk and Masterpiece are on the museum's own map). A Floor Plan adds the rooms of the remaining Highlights.

### 8.7 Median build by department (balancer input)

| At the start of department | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Max HP | 20 | 25 | 30 | 35 | 40 | 45 | 50 | 55 |
| Clearance | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 |
| Mean weapon damage | 4 | 5 | 7 | 9 | 11 | 13 | 14 | 16 |
| Acc | 3 | 3 | 4 | 4 | 5 | 5 | 5 | 6 |
| Padding | 1 | 1 | 2 | 3 | 3 | 4 | 5 | 5 |

The Exit encounter assumes max HP 60 and Clearance 18. Persona runs should replace this table with measured medians after the first balance pass (PL §(ii): simulate whole runs so that power emerges from the item economy).

---

## 9. The sketch verb

### 9.1 Specification

- **Target.** Any exhibit you can see, within 5 tiles, that is *not* Hunting you. A Masterpiece can be sketched only while Dormant or Stirring.
- **Channel time** (Copyist values):

  | Target role | Channel turns |
  |---|---|
  | Fodder | 2 |
  | Skirmisher, artillery | 3 |
  | Brute, controller | 4 |
  | Warden | 5 |
  | Masterpiece | 8 |

  Non-Copyists take ×1.5, rounded up.
- **Risk while sketching.** Each channel turn is a wait (noise 0) and counts double for the target's `OBSERVED` trigger, if it has one. Things that hate being looked at wake when you stare at them.
- **Interruption.** The channel stops if the target starts Hunting, if you take damage, or if you move. Progress is lost.
- **The result: a page, *After the [exhibit]*.** It holds a player version of the archetype's signature special, from the same closed list the enemies use:
  - the magnitude is reduced (§9.2 table);
  - it is instant for the player (no wind-up);
  - its charges recharge when you enter a new gallery.
  - An archetype with no special yields its movement trait instead (for example, "Double Step": move 2 tiles for 100 ticks).
- **Example pages:**

  | Page | Ability |
  |---|---|
  | After the Escapement Hound | Double Step |
  | After the Pendulum Warden | Swing: hits the 3 tiles in front of you |
  | After the Lectern Moth | Moth Lure: places a light that draws LIGHT-triggered exhibits for 10 turns |
  | After a Diorama Set | Tableau: Pose anywhere for 5 turns |

- **A free bonus.** A completed sketch also gives the full examine record: all triggers, odds and specials.

### 9.2 Class ability or universal verb

| | (a) Copyist class ability only | (b) **Universal verb, extended by the Copyist** |
|---|---|---|
| Who sketches | Copyist | Everyone: **1 page**, magnitude 50%, 1 charge. The Copyist gets **3 pages**, magnitude 75%, 2 charges, shorter channels, Masterpiece pages, and may accession a sketch |
| Fit with pillar 3 | Only one class is rewarded for looking | Every class gains a non-violent reward for getting close to a dormant exhibit, which no XP otherwise leaves missing |
| Class identity | The Copyist is unique | The Copyist is the specialist (as SPD's classes specialise in shared item types) |
| Balance burden | Each special needs one player version | The same versions, at two magnitudes |
| UI | A sketchbook only for Copyists | A Sketch button in every examine panel, and one quickslot |
| Chore risk | None | Low: one page means one decision per department ("which ability do I carry?"), not sketch everything |

*Lean: (b).* With no XP, the game needs a reward for observing that every player meets in their first run. The sketch is the most museal verb we have, and limiting it to one page keeps it a choice.

**If Julian picks (a):** the Copyist must be a launch class (it carries the game's signature verb), and non-Copyists view Masterpieces only by reading the lectern.

---

## 10. Classes

All classes share the base stats in §2.1 unless listed.

| Class | Core verb | Starting kit | Starts knowing | Passive | Launch |
|---|---|---|---|---|---|
| **Night Guard** | fight | Stanchion Post (Balanced T1), Guard's Tunic (T1 Standard), **Torch** (instrument: a 5-tile beam that makes tiles Bright and Dazes light-sensitive exhibits; 3 charges per 50 turns), 2 Consolidants, 1 "Quiet, Please" | Consolidant, "Quiet, Please" | **Colleague:** guards never raise an alarm on merely seeing you, only on a witnessed breach, and apply Custody only at department alarm (level 2). Acc 4 | **Yes** |
| **Copyist** | sketch | Drawing Board (Light T1), Smock (T1 Light garment), Sketchbook (3 pages), 2 Catalogue Cards, 1 Fumigant | Catalogue Card, Floor Plan | **Copyist's Permit:** sketching is never a breach, and guards ignore you while you sketch. Your sketches are the 75% versions | **Yes** |
| **Conservator** | restore and repair | Conservator's Spatula (Light T1), Apron (T1 Standard), +1 Restoration kit, 2 Solvents, 1 Consolidant | all six Solutions | **Second Coat:** the first Restoration kit you apply in each department gives +2 levels. You can also repair a forgery at any bench in 5 turns (hold and defect removed) | Unlock 1 |
| **Docent** | lead allies | Pointer (Reach T1), Blazer (T1 Standard), **Whistle** (instrument: allies regroup on you), 1 Evacuation Notice, 1 Consolidant | all six Ephemera | **Tour Group:** you can Enlist a Stirring exhibit by talking to it for 3 turns while adjacent; it becomes an ally until you leave the department (maximum 2). Guards treat you and your allies as a tour | Unlock 2 |

**Later classes:**

| Class | Core verb | Sketch |
|---|---|---|
| Thief | sneak | Silent case opening; a second Loan Desk pick; surprise ×2 |
| Courier | carry | Each run carries one object toward its lenders at the Exit. Repatriation as the objective (LM §4.2 rule 7) |
| Curator | catalogue | Rewrites a label to change an exhibit's attribution, and with it the exhibit's effect (LM F18 "re-hanging") |

**Allies stay home.** Allies (Docent, Conservation Storage) return to their plinths when you leave the department. Exhibits belong to their department.

**Recommendation: launch with 2 classes, the Night Guard and the Copyist.**
- **Night Guard:** the simplest to read and to balance, and the natural tutorial body.
- **Copyist:** carries the signature verb.
- **Conservator** is cheap to add once the Restoration economy is stable.
- **Docent** needs ally AI and tour pathing, the most expensive behaviour in this section, so it comes last.
- **Validation.** Each class must pass persona simulation as a separate condition: its median persona's clear rate within ±5 points of the Night Guard's.

**Decision C7: how many classes at launch?**

| Option | Tradeoff |
|---|---|
| (a) 1 (Night Guard) | Fastest, but the signature verb is missing at launch unless sketch is universal. |
| (b) **2 (Night Guard, Copyist)** | Two distinct ways to play; modest balance load. |
| (c) 4 | Variety, but ally AI and the upgrade economy must both be finished before launch. |

*Lean: (b).*

---

## 11. NPCs

| NPC | Where | Offers | Cost |
|---|---|---|---|
| **Docent** | Social departments; some Intro galleries | *Gallery talk:* stay within 2 tiles for 5 turns. It identifies one unknown kind and reveals the wake triggers of every exhibit in the room. Docents lead **tours** (hiding, §3.9) | Time |
| **Guard** | Every department (§3.7) | When neutral, bump to talk: "Which way is out?" marks the exit doors and the path to them. **"I'd like to leave"** is voluntary retirement: escorted to the Main Exit, and the run ends (§12) | None |
| **Conservator** | Stair Halls; sometimes in a conservation lab inside a department | Removes a forgery's hold and defect. Transfers Restoration levels between same-slot items (−1 level; once per floor). Sells one Restoration kit per floor at a high price | 40 coins; transfer 30; kit 120 |
| **Registrar** | Stair Halls; a registry desk in about 1 department in 3; the final encounter | Fully catalogues one item free per meeting. Identifies a kind for coins. Runs the accession desk (meta section) | Free / 20 coins |
| **Gift-shop clerk** | Coda kiosk in each department; Stair Halls | Sells consumables (always identified, 15–30 coins) and occasionally a curio or instrument. **Never buys** (DCSS: no shop buyback, RS F12). When stock runs out: a Postcard (a Floor Plan that shows only the current room; the museum's "Breakfast", RS F17) | Coins |
| **Fellow visitor** | About 1 department in 3 | One of: a **trade** (their item for one of yours, both shown at rung 5); **gossip** (reveals the room of one Highlight); an **escort request** (lead them to the exit doors alive: a Restoration kit or a curio as reward). A rare variant, in Attendance departments, is the *Figure of a Visitor* exhibit in disguise (LM §3.3) | Varies |

**Coins** are the in-run currency for these services. Pricing belongs with the economy (run-structure or meta section). Totals here assume about 30–50 coins per department.

---

## 12. Death and ending a run

**Death: "found in the morning".**
- The screen is a label (LM §3.4), for example:

  > **Figure of a Visitor, Reaching (Run 14)**
  > Found in Room 412 at opening, near the Pendulum Warden · Stanchion Post +3, Guard's Tunic +2, 4 Certificates · Bequest of the Night Staff · V.14.412
- **What persists** (hook for the meta section):
  - accessions already made at earlier department exits;
  - Catalogue and Atlas entries (departments, exhibits, kinds);
  - the death figure as an exhibit (later).
- **What is lost:** everything carried, and the current department's accession pick.

**Retiring early.**
- You retire by asking a neutral guard: "I'd like to leave". This splits the frame's "escort = retire" from capture (§3.7).
- Retirement keeps the current department's accession pick, but only if you have earned this department's Certificate. This stops the loop "enter department 1, grab something, retire" from farming accessions.
- Loop Hero pays retreat better than death (RS F19), and this rule follows that shape.

**Escorted, not ended.** Capture by guards or Watchmen never ends the run (§3.7, §5.3). The only ends are death, retirement and escape.

---

## 13. UI essentials

### 13.1 Screen layout

**Portrait phone (390×844 CSS px):**
- **Top bar:**
  - HP bar;
  - the **clock dial**, a museum clock face with segments for B, Lights Down and Night Watch;
  - the alarm bell (grey, amber, red);
  - your tile's lux band (0–4 bars);
  - lantern and tiptoe toggles.
- **World view:** about 12 tiles across at an integer zoom (TA §3.4).
- **Tombstone line** (§13.2): one strip above the bottom bar.
- **Bottom bar:** Wait/Search · Bag · Q1 · Q2 · Q3 · Map.
- **The label panel** opens as a bottom sheet in the DOM overlay. Text scales independently of world zoom (TA F14).

**Landscape and desktop:**
- The world view sits on the left.
- A right column holds the label panel, which stays open, plus the message log and 6 quickslots.

### 13.2 The proximity tombstone line

- **What it shows.** Whenever a readable thing is within 2 tiles and in line of sight, the strip shows its tombstone. It picks the nearest, in this priority: Hunting or Awake exhibit > dormant exhibit > case contents > plaque. Swipe or Tab cycles through the others.
- **Format:** `[state] [pips] Title · rung/maker · medium · [trigger pictograms]`, cut to about 45 characters on a portrait phone (Tiny5 at 2×, TA F14).
- **Example:** `Zz ●●○ Escapement Hound · Workshop of the Regulators · brass` followed by the pictograms *footprints 2*, *tick tag* and *hand on glass*.
- **Cost.** It is free and needs no tap. Most players will never read past it (LM F22: under 30 s per object), so it must carry the mechanics in pictograms.

### 13.3 The full label panel

**Opened by** a tap, a long-press, or the examine key. Sections, top to bottom:
1. **Title**, with the state icon and pips.
2. **Tombstone fields:** attribution rung and maker; date in the fictional calendar; medium; dimensions; credit line; accession number (LM §3.1).
3. **Pictogram row:** wake triggers; stats (HP, Acc, Eva, Padding, damage, speed); specials.
4. **Odds readout** (§2.7), for creatures.
5. **Body:** 40–70 words; gateway labels up to 120 (LM F21). Identifying labels show the seal pictogram.
6. **Actions:** Sketch, Inspect, Throw at, Read (Ephemera), Equip.

**Distance and light.** Out of range or unlit, only the tombstone fields that sight can give are shown (title, silhouette class), with "Too dark to read" or "Come closer".

### 13.4 The pictogram set

Each pictogram is drawn in code at 8×8 (tombstone line) and 12×12 (panel). Each has a fixed shape, so it never relies on colour alone. Colours come from TA F12's reserved semantic set:
- **hostile** (red family): hostile intent;
- **hazard** (orange): hazards and telegraphs;
- **readable** (cream): interactive or readable things;
- **item** (gold): items;
- **player** (blue).

**Wake triggers:**

| Glyph | Meaning | Colour |
|---|---|---|
| Footprints + digit | PROXIMITY r | hostile |
| Ear + digit | NOISE (minimum volume) | hostile |
| Sun | LIGHT | hostile |
| Crescent | DARK | hostile |
| Eye with rays | SEES_YOU | hostile |
| Open eye in a frame | OBSERVED (wakes when watched) | hostile |
| Closed eye in a frame | UNOBSERVED (moves when not watched) | hostile |
| Hand on a pane | CASE_TOUCHED | hostile |
| Empty hook | ITEM_TAKEN | hostile |
| Bell | ALARM | hostile |
| Clock hand | CLOCK stage | hostile |
| Linked rings | SYMPATHY | hostile |
| Tag + small motif | TAG_NEARBY (tick, droplet, flame) | hostile |

**States:**

| Glyph | Meaning | Colour |
|---|---|---|
| Zz | Dormant | readable |
| ●○○ | Stirring pips | hostile |
| ! | Awake | hostile |
| !! | Hunting | hostile |
| Curved arrow | Returning | readable |

**Combat:**

| Glyph | Meaning | Colour |
|---|---|---|
| Heart + n | HP | player or hostile |
| Crosshair + n | Acc | neutral |
| Feather + n | Eva | neutral |
| Shield + n | Padding | neutral |
| Implement + range | Melee damage | neutral |
| Arrow + range | Ranged | neutral |
| Hare / snail | Fast / slow | neutral |
| Metronome | On the Beat (acts every second turn) | neutral |
| Diamond + number | Telegraphed special (net damage) | hazard |
| Pencil | Sketchable | readable |

**Items:**

| Glyph | Meaning | Colour |
|---|---|---|
| Wax seal (colour + glyph) | Consumable seal | item |
| Broken seal | Forgery | hostile |
| Ribbon | Loan | item |
| Triangle with a bar | Claim (provenance) | hazard |
| Key + digit | Clearance level (lock or requirement) | readable |
| Brush | Restoration kit | item |
| Rosette | Certificate | item |
| Star | Highlight | item |
| Magnifier | Inspectable | readable |
| Book with a seal | This label identifies a kind | readable |
| Coin | Coins | item |

**Environment:**

| Glyph | Meaning | Colour |
|---|---|---|
| Bars 0–4 | Lux band | neutral |
| Sound ring + n | Noise volume (Hearing Trumpet; your last action) | neutral |
| Door with a figure | Staff door | readable |
| Bench | Rest point | readable |
| Stairs | Elevation | readable |

The set is about 45 glyphs. The 13 trigger glyphs and the 5 state glyphs are the ones a player must learn. The game introduces them in the Intro gallery of the first department, where the orientation pool places them in sequence (RS F14).

### 13.5 The floor plan

The map is drawn as a museum floor plan:
- rooms as flat-colour shapes with their numbers;
- "You are here";
- the legend in pictograms;
- the Highlights box (§8.6);
- the clock dial;
- exit placards (department name, blurb, challenge icon, reward icon; run-structure section).

**What it shows:**
- Rooms you have seen are drawn in full. Unseen rooms are outlines only if a Floor Plan has been read.
- **Gaps in the numbering are shown as gaps**, which points at secrets (LM F25).
- Known exhibit states are optional overlay layers (off by default on phone).

### 13.6 Input

**Phone** (SPD-style conventions, borrowed as ideas only, TA §3.8):
- Tap a tile to path there. The path stops when a hostile comes into view or a pip appears on a visible exhibit.
- Tap an adjacent enemy to attack.
- Long-press anything to examine.
- Tap yourself for Wait, Rest, Search and Sit.
- Confirmation is required before:
  - stepping onto shards, a rope or a staff door;
  - bashing glass;
  - entering a Masterpiece hall.

**Desktop:**

| Key | Action |
|---|---|
| Arrows, vi-keys, numpad | Move |
| `.` or `5` | Wait |
| `s` | Search |
| `x` | Examine |
| `r` | Read the nearest label |
| `i` | Bag |
| `1`–`6` | Quickslots |
| `l` | Lantern |
| `t` | Tiptoe |
| `k` | Sketch |
| `m` | Floor plan |
| Enter | Interact |

---

## 14. Determinism and calibration notes

- **Formulas and data.** Every formula above is an integer function in `core/`. Every trigger, cost and table is data, so `tools/sim.js` can sweep them.
- **Simulator outputs.** Persona runs produce death rate, HP at exit, turns, stage reached and **who woke what**, per department and depth. Survival curves (Isaksen et al. 2015, RS F21) set three things:
  - the 2.5 multiplier in B;
  - the 25% passive-search chance;
  - the role curves.
- **Persona requirements.** The **Cautious** and **Tourist** personas must be able to use tiptoe, the lantern toggle, Pose and Solvent. Otherwise the simulator under-rates stealth departments.
- **The parameters most likely to move:**
  - the pip decay interval;
  - the open-hours multiplier;
  - the Custody threshold;
  - surprise damage (maximum, or maximum ×1.5 for Light weapons);
  - the forgery rate.

---

## 15. Challenges to the frame

1. **"After" is the wrong bottom rung.**
   - In cataloguing, *After X* means a copy (LM F24), not "unknown". If the ladder starts at "After", a forgery and an uncatalogued genuine item read the same.
   - Proposal: rung 0 is **Uncatalogued**. Reserve *After* for things that really are copies: Copyist sketches ("After the Escapement Hound") and deaccessioned forgeries ("After the Workshop of …").
   - The other five rung names stay. Rungs 4 and 5 are thin for ordinary items. If playtests show nobody cares about rung 5, merge them.
2. **The Night Watch should not hurt you.** "Bell, dimming, night watch" read literally puts lethal staff at the end of the clock, which breaks "the institution is the joke".
   - I made Watchmen non-lethal Custody. The danger comes from the exhibits their rounds wake.
3. **"Guard escort = retire the run" conflates two things.** I split them:
   - voluntary retirement is a conversation with a neutral guard;
   - capture is a recoverable setback (escort and confiscation).
   - If capture ended the run, getting caught would be worse than dying for many players, and the Guarded challenge type would turn into a trap.
4. **Certificate HP compounds.** +5 max HP comes only from the Certificate, so a player who misses two Masterpieces arrives at the Exit 10 HP down. That is a rich-get-richer spiral against stealth and against escorted players.
   - Mitigation in place: viewing counts.
   - If simulation shows the spiral, move +3 of the +5 HP to the Stair Hall café, which everyone passes.
5. **The 70–90 minute target and stealth play pull against each other.** Tiptoe doubles step cost. A stealth-heavy run may take 100+ minutes on my unmeasured estimate. Either accept stealth runs as longer, or let Soft Soles-style options arrive early.
6. **"Reading a department's labels identifies kinds" versus "most players will not read".** The plaque's seal pictogram, and identification on *opening* rather than reading, close most of the gap. An accessibility setting that auto-opens labels closes the rest.

---

## 16. Risks

1. **Information load on a phone.** Pips, lux, noise rings, Custody, the clock and alarms are six meters. Mitigations:
   - pips and Custody appear only when non-zero;
   - noise rings belong to an instrument;
   - lux is one small icon.
   - If testers still drown, cut Custody to a single "caught" state first.
2. **Surprise-kill dominance.** Maximum-damage surprise attacks may make the Vandal persona optimal.
   - Watch the persona dominance vector (PL §(iii)).
   - Levers: the vandalism breach, noise on kills, Light-weapon surprise ×1.5 dropping to ×1.25.
3. **Confiscation loops.** Case items return to their cases on capture, which could invite take-and-get-caught cycles. The clock (+20 turns per capture) should price this out. Verify with a "Looter" persona.
4. **Sketch balance.** Every archetype special needs a player version at two magnitudes. A few will be degenerate (summoning, healing). Exclude them from sketching by a tag.
5. **Clock tuning against layout variance.** `L_tour` is a heuristic. Odd programmes (spiral, case labyrinth, tortuosity 1.6–25, ML §3.3) may need per-programme multipliers.
6. **Glass everywhere.** If every room has breakable cases, the "big decision" becomes routine. Cap Security glass at about 1 per section, and keep many cases as Plate with dull contents.
7. **Twelve kinds may still be too many for players who die early.** The orientation pool should teach Consolidant and Catalogue Card in department 1.

---

## 17. Cut line (drop first, in this order)

1. **Tours** (§3.9) and the Docent class. Ally and tour pathing are the most expensive behaviour here.
2. **Pose on an empty plinth.**
3. **Elevated tiles.** Balconies become void strips with no height bonus.
4. **Inspect.** Rung 1 comes only from equipping, the Registrar or cards.
5. **Ladder compression.** Five rungs to three: Uncatalogued / Attributed to / By.
6. **The universal sketch.** The Copyist keeps it as a class ability (Decision C6a).
7. **Department alarm (level 2).** Keep room alarms only.
8. **Clearance-gated staff doors.** Staff doors take keys only.
9. **Perks.** Down to 3 per family, then to 4 families (Swarm, Guarded, Darkness, Attrition), with the other challenge types offering from them.

**Never cut:** the scheduler, the dice and telegraph split, the pip meter, the noise and lux model, vitrine breaking, the clock stages, the 12 kinds with seals, Restoration and Clearance quotas, and the tombstone line with pictograms.

---

## 18. Decisions for Julian (from this section)

| # | Question | Lean |
|---|---|---|
| C1 | How basic attacks resolve | One table, hit% = 75 + 5Δ; hit deck in reserve |
| C2 | Armour model | Flat Padding, minimum 1 |
| C3 | Consequence of guard capture | Escort to the entrance with confiscation; Night Watch capture escorts to the exit with no Certificate |
| C4 | Tiptoe toggle | Yes, 200 ticks, silent |
| C5 | What viewing the Masterpiece earns | The Certificate without the Signature piece |
| C6 | Sketch: class ability or universal verb | Universal with 1 page; the Copyist extends it |
| C7 | Classes at launch | 2: Night Guard and Copyist |
| C8 | Does reading cost time? | Free, but needs light and range |
| C9 | Ladder bottom rung and depth | Rung 0 "Uncatalogued"; keep 6 rungs, compress to 3 if needed |

Each is argued in place, with what changes if Julian picks otherwise.

---

## 19. Interfaces with other sections

- **Enemies.** The closed list of specials (with player versions for sketches), archetype trigger defaults, the modifier list, Masterpiece phases and alarm reactions.
- **Layout.** `L_tour` per department; room numbering d00–d99 with deliberate gaps; Highlight placement rules (never secret, never over-locked); vitrine grades per section; curtains, benches and empty plinths as required furniture in stealth-signature departments; the lectern placement in the Masterpiece hall.
- **Content pipeline.** For each department: 12 kind reskins with identifying labels; trigger and modifier choices from the enums; Signature piece properties; and, for every label, the mechanic tags the round-trip validator checks against.
- **Meta.** Accession eligibility (rung 5, Certificate earned); what death and retirement keep; Loans at rung 5 and +0; Guidebook pre-identification of kinds; class unlocks.
- **Run structure.** Stair Hall services (Conservator transfer, Registrar, café), coin pricing, the late-run progression arc, and exit placards showing challenge-type icons that match the perk families.
