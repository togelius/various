// SQUARE OFF — shared contracts (owned by the lead; change only through review).
// Constants in SQ.C, plus precise JSDoc for everything render/UI/audio/AI may rely on.
// Headless: no THREE/document/window beyond attaching SQ.
//
// ============================================================================================
// LOAD ORDER (index.html, all classic <script defer>):
//   vendor/three.min.js, geo.js, core/ns.js, core/contracts.js, data/*, sim/nav, world, movement,
//   combat, capture, economy, abilities, match, ai, director, campaign, render/*, ui/*, audio/*, main.js
//
// ============================================================================================
// SQ.game  (implemented by js/main.js — owned by the scene engineer after the initial version)
//   SQ.game.start(cfg)   -> starts a match: cfg is the SQ.Match.create cfg (see below). Builds the
//                           world render on first call, then runs the fixed 20 Hz loop with render
//                           interpolation. Returns the match.
//   SQ.game.quit()       -> stops the current match, back to menus (emits 'gameQuit').
//   SQ.game.pause(bool)  -> pause/resume the sim (render keeps going on demand). Tactical Pause:
//                           SQ.cmd calls still work while paused.
//   SQ.game.match        -> the current match or null.
//   SQ.game.speed        -> 0.75 | 1 | 1.25 (accessibility game speed).
//   SQ.game.paused       -> bool.
//   SQ.game.alpha        -> render interpolation factor in [0,1) between state.px/pz and state.x/z.
//   Calls main.js makes into other modules (each guarded; implement the ones you need):
//     SQ.render.init(viewEl, {onProgress(p0to1, stepText)})   SQ.render.setMatch(match|null)
//     SQ.render.frame(state|null, alpha, realDt)              (every animation frame)
//     SQ.camera.init(viewEl) / update(realDt) / setMatch(m)   SQ.input.init(viewEl) / update(realDt) / setMatch(m)
//     SQ.hud.init(hudEl) / update(match, realDt) / setMatch(m) SQ.menus.init(menuEl)   SQ.tutorial.setMatch(m)
//     SQ.audio.init() / setMatch(m)
//   URL flags: ?quick (skip menus, Quick Play), &crew=pack, &map=north, ?nav=1 (nav debug overlay, render side)
//
// ============================================================================================
// MATCH  —  const match = SQ.Match.create(cfg)
//   cfg = {
//     mapId: 'whole'|'north'|'south'|'random'|'firstLight'|'westHalf',   (missions pick their own map)
//     seed: uint32,
//     players: [{ faction: 'hustle'|'noise'|'violets'|'pack'|'squirrels',
//                 ai: false | { personality: 'hustler'|'mosh'|'turtle'|'opportunist'|'passive',
//                               difficulty: 'chill'|'regular'|'hard'|'legend' },
//                 assist?: bool, home?: 'home_nw'|'home_se'|'home_sw'|'home_ne', startUnits?: [{cls, n}] }],
//     missionId?: 'm1'..'m6', turfTarget?, startClock? (match-clock s; 200 = Golden Hour), length?,
//     events?: 'off'|'calm'|'normal'|'chaos'|'scripted', quiet?: bool (don't forward to SQ.bus),
//     ai?: false (disable SQ.AI.tick), modifiers?: { regenMult, incomeMult, captureMult, speedMult, crewMult, costMult }
//         (Daily Park; the sim applies these; extra keys are free for director/AI, e.g. pianos: true). state.mods holds them.
//   }
//   match.tick(dt)          -> advances exactly one fixed step of SQ.C.DT (0.05 s). Call 20x per second.
//   match.state             -> MatchState (read-only outside sim/)
//   match.bus               -> per-match event bus (on/off/emit); events are also forwarded to SQ.bus
//                              unless cfg.quiet.
//   match.emit(name, payload)          -> emit on both buses (AI uses it for 'aiBark', campaign for 'hint').
//   match.addClout(f, amount, reason, x?, z?)  -> grant/remove Clout (director: heists, tourists).
//   match.finish(winnerIdx, reason)    -> end the match (campaign mission wins).
//   match.hash() -> uint32 state hash;  match.summary() -> Park Report data;  match.log -> command log
//   match.rules  -> { turfTarget, startClock, length, events, cannotLose:[f], assist, directorNudge,
//                     noAttacksBefore, modifiers, mission }
//   match.rng    -> sim RNG (sim-only!). AI/director must use SQ.util.rngStream(match.seed, 'ai'|'director').
//   match.systems-> array of fn(match, dt) run each tick after AI/director/campaign.
//   match.over / match.winner
//
// Plug-ins (all optional, guarded by existence checks inside match.js):
//   SQ.AI.init(match)        / SQ.AI.tick(match, dt)         — every tick, before rules. Use SQ.cmd only.
//   SQ.Director.init(match)  / SQ.Director.tick(match, dt)   — events, neutrals, zones.
//   SQ.Campaign.init(match)  / SQ.Campaign.tick(match, dt)   — only when cfg.missionId is set.
//     If SQ.Campaign.tick exists, mission wins are the campaign's job (call match.finish).
//
// ============================================================================================
// COMMANDS — the only path from UI/AI into the sim. All validated; return {ok:true,...}|{ok:false,reason}
//   (rejections also emit 'cmdRejected' {faction, cmd, reason}). External calls are logged for replay.
//   SQ.cmd.order(match, f, unitIds, {type:'move'|'attackMove'|'take'|'attack'|'stop'|'hold', x, z, targetId, lm, queue})
//        take: lm or targetId = landmark id string or index;  attack: targetId = enemy unit id
//   SQ.cmd.recruit(match, f, cls)                         cls: 'crowd'|'talker'|'heavy'
//        reasons: 'clout'|'pop'|'queue'|'class'|'out'
//   SQ.cmd.setRally(match, f, landmarkId)                 home, or held landmark within 90 m of home
//                                                         (Violets: any held; any with a Club Fair Table)
//   SQ.cmd.build(match, f, landmarkId, padIdx, setupId)   setupId: 'cart'|'boombox'|'bench'|faction special
//        ('chessTable'|'tipJar'|'clubFair'|'waterBowl'); padIdx -1/undefined = first free pad
//   SQ.cmd.crewCall(match, f, {x, z, x2, z2, landmarkId})  Pack: line x,z -> x2,z2; Violets: landmarkId
//   SQ.cmd.squad(match, f, unitIds, squadIdx)             0 = Reserve, 1..5 named squads
//   SQ.cmd.shoo(match, f, neutralId)  /  SQ.cmd.buyDosa(match, f)
// Query helpers (read-only, safe for HUD):
//   SQ.Economy.recruitCost(state, f, cls), SQ.Economy.canRecruit(state, f, cls) -> {ok, reason, cost}
//   SQ.Economy.buildOptions(state, f, landmarkId) -> [{id, name, cost, ok, reason, text}]
//   SQ.Economy.canRally(state, f, landmarkId), SQ.Abilities.canCrewCall(state, f)
//   SQ.Capture.captureRate(state, f, weight, lm), SQ.Combat.counterMult(typeA, typeB)
//   SQ.World.query(state, x, z, r, out) -> unit indices;  SQ.World.unitIndex(state, id) -> index|-1
//   SQ.World.isVisible(state, f, x, z);  SQ.Match.unitsOf(state, f, filter?) -> indices
//   state.nav (SQ.nav Grid): sample(x,z) -> 'path'|'lawn'|'bed'|'water'|'road'|'blocked'|'fence',
//     walkable(x,z), astar(ax,az,bx,bz) -> [[x,z]...] | null (ghost path lines), los(), gates[]
//
// ============================================================================================
// STATE SHAPE
/**
 * @typedef {Object} MatchState
 * @property {number} t           Sim seconds since start (advances 0.05 per tick).
 * @property {number} tick        Ticks completed.
 * @property {number} dt          0.05
 * @property {number} clock       Match clock in seconds, 0..length (0 = 4 PM, 600 = 1 AM). Frozen in sudden death.
 * @property {number} length      Clock value at which the park closes (usually 600).
 * @property {number} hour        Game clock hour as a float (16 = 4 PM ... 25 = 1 AM).
 * @property {'afternoon'|'golden'|'night'} phase
 * @property {number} phaseIdx    0..2 (SQ.data.phases)
 * @property {number} turfTarget
 * @property {string} mapId
 * @property {?string} missionId
 * @property {number} player      Index of the human faction (-1 in AI-vs-AI).
 * @property {Faction[]} factions
 * @property {Units} units        Struct-of-arrays, dense 0..n-1 (indices change on removal; ids are stable).
 * @property {Landmark[]} landmarks  Capturable landmarks AND Home Spots (isHome=true). Filter !isHome for the 11 chips.
 * @property {Object<string,Landmark>} lmById
 * @property {Setup[]} setups
 * @property {Object<number,Setup>} setupById
 * @property {Neutral[]} neutrals Director-owned actors + static sites ('dosa', 'parkHouse').
 * @property {ParkEvent[]} events Director-owned event list.
 * @property {Zone[]} zones       Modifier zones (events + Drum Circle). Rules apply them automatically.
 * @property {Effect[]} effects   Crew Call visuals with live data (zoomies dogs, drum circle, tournament).
 * @property {{rain:boolean}} weather   Director sets rain for Summer Shower.
 * @property {number} freezeUntil Everyone pauses until state.t >= freezeUntil (Judson Bells).
 * @property {number} hitStop     >0 on ticks where render should hit-stop (Zoomies impact): number of frames.
 * @property {boolean} over
 * @property {number} winner      Faction index or -1.
 * @property {?string} reason     'turf'|'clock'|'suddenDeath'|'elimination'|'mission'
 * @property {boolean} suddenDeath
 * @property {{t:number, clock:number, turf:number[], held:number[]}[]} history  Every 5 s (Turf curves).
 * @property {Grid} nav           Shared nav grid (read-only).
 */
/**
 * @typedef {Object} Faction
 * @property {number} idx
 * @property {'hustle'|'noise'|'violets'|'pack'|'squirrels'} key
 * @property {string} name, short, color   (color '#RRGGBB')
 * @property {false|{personality:string, difficulty:string}} ai
 * @property {boolean} isPlayer
 * @property {string} home        Home Spot landmark id.
 * @property {string} rally       Rally landmark id (recruits spawn here).
 * @property {number} clout, income (Clout/s), turf, turfRate (Turf/s), pop, popCap, held (landmarks held)
 * @property {number} crew        Crew Call meter 0..100 (ready at 100); crewRate per s.
 * @property {{cls:string, t:number, total:number, pop:number, cost:number}[]} queue  Recruit queue (head is building).
 * @property {boolean} behind     Word of Mouth comeback active.
 * @property {boolean} eliminated
 * @property {boolean} assist     Assist mode.
 * @property {number} dosaCD      Seconds until the Dosa cart can be bought again.
 * @property {Object} stats       Park Report counters: lost, sentHome, recruited, recruitedCls{}, regulars,
 *   captures, lostLandmarks, earned, spent, built, setupsStolen, crewCalls, crewHitsBest{kind:n}, shooed,
 *   dosas, heists, reasons{reason:n}, lostByCls{cls:n}, lostPairs{'victimCls<killerCls':n}, swayDealt,
 *   held{lmId:seconds}, longest{lm, t}, peakIncome, peakLandmarks
 */
/**
 * @typedef {Object} Units  (struct of arrays; iterate i = 0 .. units.n-1)
 * @property {number} n
 * @property {Int32Array} id          Stable unit id (use SQ.World.unitIndex(state,id) to find the index).
 * @property {Float64Array} x, z      Current position (m).  px, pz: position at the previous tick (interpolate).
 * @property {Float64Array} hp, maxHp Composure.
 * @property {Uint8Array} cls         0 crowd ●, 1 talker ▲, 2 heavy ■  (SQ.C.CLASSES)
 * @property {Int8Array} faction      Faction index.
 * @property {Uint8Array} type        Index into SQ.data.unitTypes ({key:'pack.heavy', name, cls, faction, ...}).
 * @property {Uint8Array} anim        SQ.C.ANIM: 0 idle, 1 walk, 2 attack, 3 overIt, 4 sit (Tournament), 5 flinch, 6 cheer (capturing)
 * @property {Uint16Array} flags      SQ.C.UF bits: OVERIT, FROZEN, SLOWED, REGULAR, ANIMAL, COMBAT, HOLD, BUFFED,
 *                                    HEALING, CAPTURING, CREW, FLEE, SHELTER, NEUTRAL, MOVING, TRUCE
 * @property {Int8Array} squad        0 Reserve, 1..5 squads, -1 regulars (landmark guards).
 * @property {Float64Array} facing    Radians, atan2(dx, dz) (0 = facing +z / south).
 * @property {Int32Array} target      Unit id being engaged or -1.
 * @property {Float64Array} fade      0..1 fade-out while Over It (removed at 1).
 * @property {Float64Array} hitT      Seconds since this unit last landed a hit (attack anim).
 * @property {Int32Array} lm          Landmark index a regular guards (-1 otherwise).
 * @property {Array<?Order>} order    Current order (read-only): {type, x, z, lm, targetId, arrived, queue[]}
 * Idle (for chips): !(flags & MOVING) && !(flags & COMBAT).
 */
/**
 * @typedef {Object} Landmark
 * @property {number} idx
 * @property {string} id          'fountain','arch','chess','grove','holley','garibaldi','bigrun','playground',
 *                                'smallrun','bobst','judson','toddler','playhills' or 'home_nw'|'home_se'|'home_sw'|'home_ne'
 * @property {string} name, nick
 * @property {number} x, z, r     Ring center and radius (m).
 * @property {?number[][]} poly   Fenced capture polygon (dog runs); capture only inside it.
 * @property {boolean} isHome     Home Spot (not capturable; owner fixed).
 * @property {number} owner       Faction index or -1 (neutral).
 * @property {number} meter       0..100 capture meter (owner's hold strength, or capBy's progress when neutral).
 * @property {number} capBy       Faction filling a neutral meter (-1 none).
 * @property {number} capturing   Faction currently changing the meter (-1 none).
 * @property {boolean} contested  Two+ factions inside: meter frozen, ring flashes CONTESTED.
 * @property {boolean} draining   An enemy is draining this owned landmark ("under attack").
 * @property {number} attackedT   state.t of the last contest/drain (pulse chips while state.t - attackedT < 2).
 * @property {number[]} weights   Capture weight inside the ring, per faction.
 * @property {number} clout, turf          Base rates.  cloutRate, turfRate: current (phase + events).
 * @property {number} bonusClout  Event bonus (Ice Cream Truck) — Director writes it.
 * @property {{id:string, text:string}} perk
 * @property {{x:number, z:number, setup:number}[]} pads   setup = setup id or -1.
 */
/**
 * @typedef {Object} Setup
 * @property {number} id
 * @property {string} kind        'cart'|'boombox'|'bench'|'chessTable'|'tipJar'|'clubFair'|'waterBowl'
 * @property {number} lm          Landmark index; lmId string id.
 * @property {number} pad
 * @property {number} owner       Current owner (flips with the landmark).  builtBy: original builder.
 * @property {number} x, z
 * @property {boolean} done       false while building; buildLeft / buildTime seconds.
 */
/**
 * @typedef {Object} Zone   (push with SQ.World.addZone(state, zone); remove with SQ.World.removeZone or `until`)
 * @property {string} id, kind
 * @property {number} x, z, r
 * @property {number} until       state.t when it expires (Infinity = manual).
 * @property {number} faction     Owner faction or -1.
 * @property {'all'|'allies'|'enemies'} who   Relative to `faction`.
 * @property {string=} factionKey Only affects this crew (e.g. 'violets' for Graduation).
 * @property {number=} speed      Speed multiplier (0.7 = slow).   sway: Sway multiplier.   range: range multiplier.
 * @property {number=} regen      Extra heal per s.  heal: same.   dps: damage per s.
 * @property {boolean=} noAttack  Truce: nobody inside can attack or be attacked (PEP).
 * @property {number=} animalScatter  Animal-tagged units take half the effect (pigeons vs the Pack).
 */
/**
 * @typedef {Object} Effect (Crew Call visuals)
 * @property {number} id
 * @property {'tournament'|'drumCircle'|'groupChat'|'zoomies'} kind
 * @property {number} faction, x, z, r, t0, t1
 * @property {number=} x2, z2      Zoomies line end.
 * @property {{x:number,z:number,lane:number,s:number}[]=} dogs  Zoomies dogs (live positions; s = 0..1 progress).
 * @property {number[]=} ids       Affected unit ids (tournament sitters / group chat spawns).
 */
/**
 * @typedef {Object} Neutral   (Director-owned; sim reads kind 'squirrel' for shoo)
 * @property {string|number} id
 * @property {string} kind        'dosa'|'parkHouse'|'squirrel'|'pigeonFlock'|'pep'|'tourist'|'graduate'|'piano'|'pigeonLady'|'truck'|...
 * @property {number} x, z, px, pz
 * @property {boolean=} dead      Removed by the match at the end of the tick.
 * @property {boolean=} static
 */
/**
 * @typedef {Object} ParkEvent  (Director-owned)
 * @property {string} id, kind    kind = SQ.data.events key
 * @property {?string} lm
 * @property {number} x, z, warnAt, startAt, endAt
 * @property {'warn'|'active'|'done'} state
 */
//
// ============================================================================================
// BUS EVENTS (sim -> render/ui/audio). Emitted on match.bus and forwarded to SQ.bus.
//   'matchStart'  {mapId, missionId, factions[], player}
//   'capture'     {lm, lmIdx, from, to, x, z, title, setups:[{kind, from}]}   (landmark flipped to `to`)
//   'neutral'     {lm, lmIdx, from, by, x, z}                (drained to neutral)
//   'contested'   {lm, lmIdx, faction (owner or -1), attackers[], x, z}
//   'underAttack' {lm, lmIdx, faction (owner), by, x, z}      (enemy draining an owned landmark)
//   'overIt'      {unit, faction, line, x, z, cls, type, by, reason}
//   'removed'     {unit, faction}                             (faded out at the street)
//   'squadWiped'  {faction, squad, word, x, z, by}
//   'hit'         {from, to, counter, weak, dmg, x, z, tx, tz, faction, cls, glyph, type, kind?}
//   'knock'       {faction, x, z, kind}
//   'crewCall'    {faction, kind, x, z, x2, z2, r, lm}   'crewReady' {faction}   'crewEnd' {faction, kind, hits}
//   'eventWarn' / 'eventStart' / 'eventEnd'  {id, kind, lm, x, z}   (Director)
//   'phase'       {phase, idx, name}      'phaseWarn' {phase, name, in}
//   'queued'      {faction, cls, cost, queue}   'recruited' {faction, cls, ids[], x, z, lm}
//   'buildStart'  {lm, lmIdx, pad, setup, faction, x, z}   'built' {lm, lmIdx, pad, setup, faction, x, z, id}
//   'regular'     {lm, lmIdx, faction, id, x, z}
//   'clout'       {faction, amount, reason ('flip'|'grudge'|'sideBets'|'shoo'|'heist'|'tourist'...), x, z}
//   'comeback'    {faction, on}     'eliminated' {faction}     'suddenDeath' {factions[], until}
//   'rally'       {faction, lm, x, z}   'ordered' {faction, type, n, x, z, lm, targetId}   'squad' {faction, squad, n}
//   'assist'      {faction, lm, n}  'dosa' {faction, x, z, n}  'shoo' {faction, id, x, z, amount}
//   'cmdRejected' {faction, cmd, reason}
//   'announce'    {text, kind}      (generic announcer lines from the sim)
//   'hint'        {id, text, target}               (Campaign)
//   'aiBark'      {faction, text, lm}              (AI)
//   'victory'     {winner, reason, stats (match.summary()), playerWon}
//   UI-side events (not sim): 'gameStart' {match}, 'gameQuit', 'gamePause' {paused}
// ============================================================================================
(function (SQ) {
  'use strict';
  SQ.C = {
    TICK_HZ: 20,
    DT: 0.05,
    CLASSES: ['crowd', 'talker', 'heavy'],
    CLASS_IDX: { crowd: 0, talker: 1, heavy: 2 },
    GLYPH: { crowd: '●', talker: '▲', heavy: '■' },
    FACTIONS: ['hustle', 'noise', 'violets', 'pack'],
    ALL_FACTIONS: ['hustle', 'noise', 'violets', 'pack', 'squirrels'],
    PERSONALITIES: ['hustler', 'mosh', 'turtle', 'opportunist'],
    DIFFICULTIES: ['chill', 'regular', 'hard', 'legend'],
    PHASES: ['afternoon', 'golden', 'night'],
    ANIM: { IDLE: 0, WALK: 1, ATTACK: 2, OVERIT: 3, SIT: 4, FLINCH: 5, CHEER: 6 },
    UF: { OVERIT: 1, FROZEN: 2, SLOWED: 4, REGULAR: 8, ANIMAL: 16, COMBAT: 32, HOLD: 64, BUFFED: 128, HEALING: 256, CAPTURING: 512, CREW: 1024, FLEE: 2048, SHELTER: 4096, NEUTRAL: 8192, MOVING: 16384, TRUCE: 32768 },
    ORDER_TYPES: ['move', 'attackMove', 'take', 'attack', 'stop', 'hold'],
    SETUPS: ['cart', 'boombox', 'bench', 'chessTable', 'tipJar', 'clubFair', 'waterBowl'],
    EVENTS: ['matchStart', 'capture', 'neutral', 'contested', 'underAttack', 'overIt', 'removed', 'squadWiped', 'hit', 'knock',
      'crewCall', 'crewReady', 'crewEnd', 'eventWarn', 'eventStart', 'eventEnd', 'phase', 'phaseWarn', 'queued', 'recruited',
      'buildStart', 'built', 'regular', 'clout', 'comeback', 'eliminated', 'suddenDeath', 'rally', 'ordered', 'squad', 'assist',
      'dosa', 'shoo', 'cmdRejected', 'announce', 'hint', 'aiBark', 'victory'],
    SAVE_KEY: 'squareoff.v1',
    // World frame: GEO meters, +x east (University Pl), +z south (W 4th), y up, origin at the fountain.
    PARK_BOUNDS: { x0: -162, x1: 135, z0: -72, z1: 73 },
    NAV_BOUNDS: { x0: -200, x1: 170, z0: -110, z1: 130 },
  };
})(window.SQ = window.SQ || {});
