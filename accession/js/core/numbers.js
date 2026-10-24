// ACCESSION — the numbers of record. BUILD.md §8.10 is the source; tools/lint-numbers.js
// fails the build if this file and that table differ.
'use strict';
const N = Object.freeze({
  TICKS_PER_TURN: 100, // ticks in one turn
  COST_STEP: 100, // step
  COST_WAIT: 100, // wait or one turn of rest
  COST_ATTACK: 100, // attack
  COST_ATTACK_HEAVY: 150, // attack with a Heavy weapon
  COST_DOOR: 100, // open or close a door
  COST_OPEN_CASE: 200, // open a case
  COST_BASH: 100, // one bash (Heavy: 150 for two)
  COST_TAKE: 100, // take or drop
  COST_USE: 100, // drink, read a consumable, throw, use an instrument or apply a Restoration kit (reading a label costs nothing)
  COST_BASH_HEAVY: 150, // one Heavy swing at glass, counting as two bashes
  COST_EQUIP: 100, // equip a weapon, curio or instrument
  COST_EQUIP_GARMENT: 300, // equip a garment
  COST_PUSH: 100, // push a jar
  COST_VIEW: 100, // one viewing turn
  COST_SIT: 100, // sit on a bench
  SPECIAL_RECOVERY: 100, // extra cost of the action after a special
  SPEED_FAST_PCT: 50, // fast actors' cost
  SPEED_SLOW_PCT: 200, // slow actors' cost
  HIT_BASE: 75, // hit chance at equal Acc and Eva
  HIT_PER_POINT: 5, // per point of Acc − Eva
  HIT_MIN: 10, // floor
  HIT_MAX: 95, // ceiling
  HIT_FIXED_TARGET: 20, // against a fixed target
  HIT_DAZED_ATTACKER: -20, // dazed attacker
  DMG_MIN_ON_HIT: 1, // minimum damage on a hit
  SURPRISE_LIGHT_PCT: 150, // Light weapon surprise multiplier
  PLAYER_HP: 20, // starting max HP
  HP_PER_GRADE: 5, // max HP per grade above I
  CERT_HEAL: 5, // heal on a Certificate
  PLAYER_ACC: 3, // starting Acc
  PLAYER_EVA: 2, // starting Eva
  GRADE_START: 1, // grade at the start of a run
  GRADE_MAX: 7, // grade after six Certificates
  SHORT_ACC: 2, // Acc lost per grade short, weapons
  SHORT_PAD: 1, // Padding lost per grade short, garments
  REGEN_NUM: 400, // regeneration: turns per HP = max(MIN, floor(NUM / maxHP))
  REGEN_MIN: 4, // regeneration floor
  REGEN_BELL_MULT: 2, // interval multiplier after the bell
  BENCH_MULT: 2, // regeneration multiplier on a bench
  PIPS_TO_WAKE: 3, // pips that wake any exhibit
  PIP_DECAY_TURNS: 10, // turns without stimulus per pip lost, before the bell
  RING_STILL: 2, // ring radius while standing still
  RING_MOVING: 3, // ring radius when acting or moving
  RING_LOUD_FLOOR: 2, // added on shards or water
  RING_MIN: 1, // the smallest the ring can be made
  NOISE_SOFT: 3, // soft noise range, walking tiles
  NOISE_LOUD: 6, // loud noise range
  NOISE_CRASH: 10, // crash noise range
  NOISE_DOOR: 3, // extra tiles through a closed door
  SIGHT_PLAYER: 12, // your sight range
  SIGHT_EXHIBIT: 8, // an awake exhibit's sight range
  AWAKE_IDLE_TURNS: 20, // awake without stimulus, then returning
  LOSE_TRACK_TURNS: 8, // hunter out of sight, then searching
  SEARCH_TURNS: 3, // turns searching your last-known tile
  REINSTALL_TURNS: 3, // turns reinstalling before sleeping
  ALLY_HIT_RANGE: 5, // ally_hit range
  AXIS_RANGE: 8, // the `axis` trigger's reach
  TETHER_RANGE: 2, // the `tether` trigger's reach, and the tethered_warden's leash
  HERALD_RANGE: 6, // a herald's call
  CLOCK_MULT_PCT: 250, // B = round10(MULT × L_tour / 100 + ADD)
  CLOCK_ADD: 100,
  STAGE_GAP_PCT: 15, // G = max(MIN, round10(PCT × B / 100))
  STAGE_GAP_MIN: 60,
  NIGHT_WAKE_EVERY: 30, // turns between night-watch bells
  NIGHT_WAKE_COUNT: 3, // exhibits woken per night-watch bell
  WATCHMAN_RETURN: 20, // turns before a defeated Watchman returns
  SEAL_HEAL_PCT: 25, // Centrepiece heal when a hall is unsealed, % of its maximum
  SEAL_LIFT_TURNS: 50, // a seal lifts after this long without the Centrepiece reaching you or dealing damage
  VIEW_TURNS: 4, // viewing turns for a Certificate
  VIEW_DISTANCE: 3, // walking tiles from the lectern's reading tile to the Centrepiece
  TREASURE_SEAL_HP_PCT: 34, // a treasure hall also seals when its Centrepiece falls to this share of its health
  TREASURE_SEAL_TURNS: 12, // turns after a treasure's case is touched before its hall seals
  CAUSE_RECORDS: 64, // cause records kept in the state
  READ_RANGE: 2, // tiles from a label to read it
  TOTE_SLOTS: 16, // tote size
  CURIO_SLOTS: 2, // curio slots
  KITS_PER_DEPT: 2, // Restoration kits per department
  CONSUMABLES_PER_DEPT: 5, // ambient consumables per department
  EQUIPMENT_PER_DEPT: 2, // ambient weapons and garments per department
  CURIO_OR_INSTRUMENT_PER_DEPT: 1,
  ID_LABELS_PER_DEPT: 2, // identifying labels per department, minimum
  CASE_EMPTY_ONE_IN: 6, // one case in N is "on loan elsewhere"
  CONSOLIDANT_NOW_PCT: 50, // Consolidant, immediate heal
  CONSOLIDANT_HOT_PCT: 25, // Consolidant, heal over time
  CONSOLIDANT_HOT_TURNS: 5,
  CONSOLIDANT_THROW_PCT: 50, // a thrown Consolidant's heal, % of each creature's max HP
  FIXATIVE_TURNS: 4, // fixed
  FUMIGANT_TURNS: 10, // cloud duration
  FUMIGANT_SIZE: 5, // cloud side
  COUGH_TURNS: 5, // coughing
  QUIET_RANGE: 8, // "Quiet, Please" range
  THROW_RANGE: 5, // how far you can throw
  THROW_AREA: 3, // the side of a thrown Solution's square
  DECK: [20, 8, 10, 8, 14, 8, 8, 5], // Consolidant, Fixative, Fumigant, Solvent, Catalogue Card, Floor Plan, "Quiet, Please", Re-admission Ticket
  GLASS_BASHES: [1, 2, 3], // Plate, Laminated, Security
  GLASS_LOCK_MIN: [1, 2, 4], // the lowest lock grade: Plate, Laminated, Security
  GLASS_LOCK_MAX: [2, 4, 7], // the highest lock grade, likewise
  GLASS_MIX_D1: [70, 30, 0], // Plate, Laminated, Security % at depth 1; provisional
  GLASS_MIX_D2: [70, 30, 0],
  GLASS_MIX_D3: [40, 40, 20],
  GLASS_MIX_D4: [40, 40, 20],
  GLASS_MIX_D5: [30, 40, 30],
  GLASS_MIX_D6: [30, 40, 30], // the Exit uses depth 6's mix
  SHARD_SPREAD: 1, // floor tiles on your side that get shards when glass breaks
  FORM_LIGHT: [0, 3, 1, 100, 2, -1], // weapon: min = t + a, max = b·t + c, cost, Acc, grade offset
  FORM_BALANCED: [1, 3, 3, 100, 0, 0],
  FORM_HEAVY: [2, 4, 4, 150, -1, 1],
  FORM_REACH: [0, 3, 1, 100, 0, 0],
  REACH_RANGE: 2, // tiles away a Reach weapon hits
  GARMENT_LIGHT: [-1, 1, 0], // Padding = tier + a, Eva, grade offset
  GARMENT_STANDARD: [0, 0, 0],
  GARMENT_HEAVY: [1, -1, 1],
  TIER_LOW_BY_DEPTH: [1, 1, 2, 2, 3, 3, 4], // the lower tier on offer at depths 1–7
  TIER_LOW_PCT: 60, // share of items at the lower tier
  BONUS_ACC: [1, 2, 3], // Acc from an S / M / L primitive; provisional
  BONUS_EVA: [1, 2, 3], // Eva, likewise
  BONUS_PAD: [1, 2, 3], // Padding, likewise
  BONUS_DMG: [1, 2, 3], // min and max damage, likewise
  BREAKER_BASHES: 1, // extra bashes per swing with `breaker`
  QUIET_RING: 1, // your ring is this much smaller when you move with `quiet`
  RESTORE_DMG: 1, // a weapon's min and max damage per level
  RESTORE_ACC_EVERY: 2, // a weapon gains 1 Acc at every this many levels
  RESTORE_PAD: 1, // a garment's Padding per level
  RESTORE_RANK: 1, // a curio's rank per level
  RESTORE_CHARGES: 1, // an instrument's charges per level
  TUNING_FORK: [3, 40, 8], // charges, recharge turns, range
  PIN_DRIVER: [4, 30, 5], // charges, recharge turns, range; damage [t, 2t + 2]
  PIN_DRIVER_DMG: [0, 2, 2], // the Pin-Driver's damage at tier t: min = t + a, max = b·t + c
  WINDOW_POLE: [4, 40, 2], // charges, recharge turns, range
  LAMP_OBSERVE_RANGE: 4, // the Day Curator's Lamp, lit
  LAMP_RING: 1, // added to your ring while the Lamp is lit
  UNOBSERVED_STEP: 2, // tiles a turn for an unobserved mover
  DEMO_PERIOD: 12, // turns between demonstrations
  DEMO_PERIOD_INTRO: 8, // in an Intro gallery
  DEMO_PERIOD_HALL: 8, // in the Centrepiece hall
  DEMO_LINE_DMG: [4, 7, 10], // gross damage of a demonstration line; provisional
  DEMO_WARNING: 2, // turns of warning chime
  DEMO_WINDOW: 3, // minimum safe window at a forced crossing
  ALARM_TURNS: 30, // an alarm's length
  ALARM_CLOCK_ADVANCE: 30, // turns each alarm brings the bell closer
  WEATHER_SHARE_PCT: 20, // cases holding weather
  WEATHER_TURNS: 10, // fog or rain duration
  RAIN_STOP_TURNS: 2, // a soaked clockwork exhibit stops
  COPY_GROUP: [3, 4], // smallest and largest copy group
  COPY_WEAKEN_PCT: 33, // health and damage lost by a spare whose original falls; provisional
  COPY_WEAKEN_ACC: 2, // Acc lost likewise; provisional
  PERK_ELBOW_ROOM: [3, 5], // Padding at ranks 1 and 2
  PERK_SECOND_WIND_PCT: [25, 40],
  PERK_SINGLE_FILE_DMG: 3,
  PERK_DUCK_AND_COVER: 50, // ticks saved
  PERK_SECOND_WIND_BELOW_PCT: 25,
  PERK_SECOND_WIND_TURNS: 5,
  PERK_LIGHT_FINGERS_COST: 100, // ticks to open a case with Light Fingers
  DEPTS_PER_RUN: 6,
  DEPTS_PER_FLOOR: 2,
  EXIT_DEPTH: 7, // the Exit's depth for the role curves
  SAVE_SLOTS: 2, // alternating IndexedDB slots
  ROLE_FODDER_HP: [7, 16, 28],
  ROLE_FODDER_ACC: [2, 3, 4],
  ROLE_FODDER_EVA: [1, 2, 3],
  ROLE_FODDER_DMG: [[1, 4], [3, 8], [5, 13]],
  ROLE_FODDER_PAD: [0, 1, 2],
  ROLE_SKIRMISHER_HP: [12, 24, 42],
  ROLE_SKIRMISHER_ACC: [3, 4, 5],
  ROLE_SKIRMISHER_EVA: [3, 4, 5],
  ROLE_SKIRMISHER_DMG: [[2, 5], [4, 9], [7, 14]],
  ROLE_SKIRMISHER_PAD: [0, 1, 2],
  ROLE_ARTILLERY_HP: [10, 20, 35],
  ROLE_ARTILLERY_ACC: [4, 5, 6],
  ROLE_ARTILLERY_EVA: [1, 2, 3],
  ROLE_ARTILLERY_DMG: [[2, 5], [4, 11], [7, 16]],
  ROLE_ARTILLERY_PAD: [0, 0, 1],
  ROLE_BRUTE_HP: [15, 35, 65], // attacks cost 150
  ROLE_BRUTE_ACC: [1, 2, 3],
  ROLE_BRUTE_EVA: [0, 1, 2],
  ROLE_BRUTE_DMG: [[3, 7], [6, 14], [10, 22]],
  ROLE_BRUTE_PAD: [1, 2, 3],
  ROLE_CONTROLLER_HP: [12, 26, 46],
  ROLE_CONTROLLER_ACC: [3, 4, 5],
  ROLE_CONTROLLER_EVA: [2, 3, 4],
  ROLE_CONTROLLER_DMG: [[1, 3], [2, 5], [3, 8]],
  ROLE_CONTROLLER_PAD: [0, 1, 2],
  ROLE_WARDEN_HP: [21, 49, 91],
  ROLE_WARDEN_ACC: [3, 4, 5],
  ROLE_WARDEN_EVA: [2, 3, 4],
  ROLE_WARDEN_DMG: [[2, 5], [4, 10], [7, 15]],
  ROLE_WARDEN_PAD: [1, 2, 3],
  ROLE_WARDEN_SPECIAL: [6, 12, 17], // gross damage of the tethered_warden's ring special (§8.1)
  ROLE_WARDEN_SPECIAL_EVERY: 3, // the tethered_warden's ring special comes every this many actions
  ROLE_ARTILLERY_SPECIAL: [5, 11, 16], // gross damage of the axis_sniper's beam (§8.1)
  MEDIAN_PADDING: [1, 2, 3], // the median visitor's Padding; provisional
  ROLE_SUPPORT_HP: [10, 20, 35], // new for the slice: provisional
  ROLE_SUPPORT_ACC: [2, 3, 4],
  ROLE_SUPPORT_EVA: [2, 3, 4],
  ROLE_SUPPORT_DMG: [[1, 2], [1, 3], [2, 4]],
  ROLE_SUPPORT_PAD: [0, 1, 1],
  ROLE_SWARM_HP: [2, 4, 7], // per body; new for the slice: provisional
  ROLE_SWARM_ACC: [2, 3, 4],
  ROLE_SWARM_EVA: [1, 2, 3],
  ROLE_SWARM_DMG: [[1, 2], [1, 3], [2, 4]],
  ROLE_SWARM_PAD: [0, 0, 0],
  ROLE_AMBUSHER_HP: [12, 24, 42], // new for the slice: provisional
  ROLE_AMBUSHER_ACC: [4, 5, 6],
  ROLE_AMBUSHER_EVA: [2, 3, 4],
  ROLE_AMBUSHER_DMG: [[3, 6], [5, 11], [8, 16]],
  ROLE_AMBUSHER_PAD: [0, 1, 2],
  ROLE_CENTREPIECE_HP: [45, 105, 195], // shared pool for an ensemble
  ROLE_CENTREPIECE_PAD: [1, 2, 3],
  ROLE_CENTREPIECE_ACC: [3, 4, 5], // provisional
  ROLE_CENTREPIECE_EVA: [1, 2, 3], // provisional
  ROLE_CENTREPIECE_DMG: [[3, 6], [5, 11], [8, 17]], // basic blows; provisional
  ROLE_CENTREPIECE_SPECIAL_PCT: [25, 30, 35], // gross special damage = pct(MEDIAN_MAX_HP, this) + MEDIAN_PADDING, at that depth
  ROLE_ARTILLERY_RANGE: 6,
  ROLE_CONTROLLER_SPECIAL_EVERY: 3, // a status special every third action
  AXIS_BEAM_RANGE: 10, // the axis_sniper's beam, in tiles
  KITER_HOLD: [3, 5], // the kiter's distance from you, nearest and farthest
  DARTER_STEP_BACK: 1, // tiles a darter steps back after its blow
  SPLIT_MAX: 2, // splits per lineage
  SPLIT_HP_PCT: 50, // each half's share of the remaining health
  SWARM_BODIES: [3, 8], // bodies in a swarm, fewest and most; provisional; the M3 stand-in places the first
  MIMIC_GRIP_TURNS: 2, // turns a mimic's grip roots you
  OLD_REPAIR_PCT: 200, // damage through an old repair's side
  PLASTER_HP_PCT: 70, // a plaster cast's share of its role's health
  PLASTER_DUST_TURNS: 3, // turns a plaster cast's dust blocks sight
  PLASTER_DUST_SIZE: 3, // the side of the dust square
  MEDIAN_MAX_HP: [20, 25, 30, 35, 40, 45, 50], // at depths 1–7, assuming a Certificate in each earlier department; provisional
});
