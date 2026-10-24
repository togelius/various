// ACCESSION — waking and modes (BUILD.md §8.2): waking, the changes of mode, pips, the ring
// pip, hearing, decay, the special triggers (`axis`, `tether`, `ally_hit`), "Quiet, Please"
// and the Re-admission Ticket's losing you. Owned by W1-WAKE-A.
//
// Two functions change an exhibit's mode, and nothing else does:
//   Wake.wake     takes a sleeping exhibit out of dormant: it resets what belongs to one
//                 waking (sawYou, acts, its archetype's per-waking ax), costs a beat, and
//                 starts its story (woke, and hunted if it hunts);
//   Wake.setMode  every other change: it resets nothing, so "has not seen you since it last
//                 woke" (§8.1) means since it last left dormant.
// A pipless exhibit (a mimic in its disguise) gains no pips, hears nothing and is woken
// only by damage, its case touched or its case dissolved (§8.2).
'use strict';
const Wake = (() => {
  // Causes and tiles are copied in as plain data (Causes.copy: anything else stops with an error).
  const copy = (c, where) => Causes.copy(c, where || 'wake');
  const MODES = ['dormant', 'awake', 'hunting', 'searching', 'returning', 'reinstalling'];
  // The causes that wake a pipless exhibit (§8.2): it is struck, opened or bashed, or dissolved.
  const PIPLESS_WAKES = ['damage', 'touch_case', 'dissolved'];
  const yourTile = state => [state.actors[0].x, state.actors[0].y];

  // Wake.wake(state, a, mode, cause, ev, opts?) → bool. a leaves dormant for mode ('hunting'
  // or 'awake'), with cause; opts {target?, lastKnown?} give where an awake exhibit goes to
  // look and where a hunter last knew you were (your tile, if not given: §8.2). Returns
  // false, changing nothing, if a is not dormant, or is pipless and the cause is not one
  // that wakes it. In order: its mode, pips 0, sawYou false, acts 0, stim now, its target or
  // last-known tile; Archetypes.onWake; the beat (it first acts one action from now, §8.1);
  // its story (woke, and hunted if it hunts); then the events woke {who, was, mode} and, if
  // it hunts, hunting {who, was}, both with the cause and both recorded.
  function wake(state, a, mode, cause, ev, opts) {
    if (mode !== 'hunting' && mode !== 'awake') throw new Error(`Wake.wake: ${a.uid} cannot wake into ${mode}`);
    if (a.gone || a.mode !== 'dormant') return false;
    if (Archetypes.pipless(state, a) && !PIPLESS_WAKES.includes(cause && cause.k)) return false;
    opts = opts || {};
    const story = copy(cause, 'woke.cause');
    a.mode = mode;
    a.pips = 0; a.sawYou = false; a.acts = 0; a.stim = state.turn;
    a.target = mode === 'awake' ? copy(opts.target) : null;
    a.lastKnown = mode === 'hunting' ? copy(opts.lastKnown || yourTile(state)) : copy(opts.lastKnown);
    Archetypes.onWake(state, a);
    a.next = state.tick + Actors.cost(state, a, N.COST_STEP, 'act');
    a.woke = { turn: state.turn, cause: story };
    if (mode === 'hunting') a.hunted = { turn: state.turn, cause: copy(story) };
    Causes.emit(state, ev, 'woke', { who: a.uid, was: 'dormant', mode }, cause);
    if (mode === 'hunting') Causes.emit(state, ev, 'hunting', { who: a.uid, was: 'dormant' }, cause);
    return true;
  }

  // Wake.setMode(state, a, mode, cause, ev, opts?) → bool: every change of mode that is not
  // a waking. It resets nothing: sawYou, acts, ax and the story's woke stay as they are. It
  // sets stim to now (each mode counts its own turns from it), takes opts {target?,
  // lastKnown?}, and emits, by the change:
  //   into hunting: hunting {who, was}, and hunted becomes this cause (a hunter's last-known
  //     tile is yours unless opts says otherwise);
  //   searching, returning or reinstalling → awake, or a new target while awake:
  //     alerted {who, from, to, x, y}, x and y the target (opts.target is required);
  //   returning → reinstalling: returned {phase: 'arrived'}; reinstalling → dormant:
  //     returned {phase: 'reinstalled'};
  //   every other change (hunting → searching, searching → returning, awake → returning,
  //     hunting → awake, awake → dormant, …): lost {who, from, to}.
  // Leaving hunting cancels a pending telegraph (Specials.cancel), before the change's own
  // event; only a hunter marks a special (Specials.canMark). A sleeping exhibit is
  // woken with Wake.wake, never here. Returns false if nothing changed.
  function setMode(state, a, mode, cause, ev, opts) {
    if (!MODES.includes(mode)) throw new Error(`Wake.setMode: no mode ${mode}`);
    if (a.mode === 'dormant') throw new Error(`Wake.setMode: ${a.uid} is dormant; Wake.wake wakes it`);
    if (a.gone) return false;
    opts = opts || {};
    const story = copy(cause, 'hunting.cause');
    const from = a.mode, retarget = from === 'awake' && mode === 'awake' && !!opts.target;
    if (from === mode && !retarget) return false;
    const alerted = mode === 'awake' && (retarget || from === 'searching' || from === 'returning' || from === 'reinstalling');
    if (alerted && !opts.target) throw new Error(`Wake.setMode: ${a.uid} is alerted with no target`);
    if (opts.target !== undefined) a.target = copy(opts.target);
    if (opts.lastKnown !== undefined) a.lastKnown = copy(opts.lastKnown);
    a.mode = mode;
    a.stim = state.turn;
    if (mode !== 'hunting' && a.telegraph) Specials.cancel(state, a, (cause && cause.k) || 'mode', ev);
    if (mode === 'hunting') {
      if (opts.lastKnown === undefined) a.lastKnown = yourTile(state);
      a.hunted = { turn: state.turn, cause: story };
      Causes.emit(state, ev, 'hunting', { who: a.uid, was: from }, cause);
    } else if (alerted) {
      Causes.emit(state, ev, 'alerted', { who: a.uid, from, to: mode, x: a.target[0], y: a.target[1] }, cause);
    } else if (from === 'returning' && mode === 'reinstalling') {
      Causes.emit(state, ev, 'returned', { who: a.uid, phase: 'arrived' }, cause);
    } else if (from === 'reinstalling' && mode === 'dormant') {
      Causes.emit(state, ev, 'returned', { who: a.uid, phase: 'reinstalled' }, cause);
    } else {
      Causes.emit(state, ev, 'lost', { who: a.uid, from, to: mode }, cause);
    }
    return true;
  }

  // Wake.toHunting(state, a, cause, ev): into a hunt, waking it first if it sleeps (damage
  // always wakes, straight to hunting, §8.2). Combat.hurt calls it.
  function toHunting(state, a, cause, ev, opts) {
    return a.mode === 'dormant' ? wake(state, a, 'hunting', cause, ev, opts) : setMode(state, a, 'hunting', cause, ev, opts);
  }

  // Wake.created(state, a, k, extra, ev?): the story of an actor made awake, not woken:
  // woke (and hunted, if it hunts) with cause {k, …extra}, k a creation cause (awake,
  // night_watch, summoned; patrol in M4). A created hunter's hunt begins, as every hunt
  // does, with your tile as its last-known tile, unless it was made knowing another (§8.2).
  // Actors made with the department take their story from the starting state and pass no
  // ev. One made during the visit passes ev: it emits a creation woke {who, was: null, mode},
  // and it first acts after a beat, at now + its action cost, so it never acts in the
  // instant it appears (§8.1).
  function created(state, a, k, extra, ev) {
    const W = Registry.WAKE_CAUSES[k];
    if (!W || !W.creation) throw new Error(`Wake.created: ${k} is not a cause an actor is created with`);
    if (a.mode === 'dormant') throw new Error(`Wake.created: ${a.uid} is dormant`);
    const cause = Object.assign({ k }, copy(extra || {}, 'woke.cause'));
    a.woke = { turn: state.turn, cause: copy(cause) };
    if (a.mode === 'hunting') {
      a.hunted = { turn: state.turn, cause: copy(cause) };
      a.lastKnown = copy(a.lastKnown) || yourTile(state);
    }
    if (ev) {
      a.next = state.tick + Actors.cost(state, a, N.COST_STEP, 'act');
      Causes.emit(state, ev, 'woke', { who: a.uid, was: null, mode: a.mode }, cause);
    }
  }

  // Wake.addPips(state, a, n, cause, ev, opts?) → bool (did it wake). Only a sleeping exhibit
  // gains or loses pips, and a pipless one never does. Each trigger (cause.k) adds or takes
  // at most once a turn (a.pipTurns, §8.2). The count stays between 0 and PIPS_TO_WAKE; a
  // gain sets stim to now. Each change is a pip event {who, pips, delta} with the cause.
  // Reaching PIPS_TO_WAKE wakes it, in the mode its wake cause gives (Registry.WAKE_CAUSES),
  // with the same cause; opts go to Wake.wake.
  function addPips(state, a, n, cause, ev, opts) {
    if (a.gone || a.mode !== 'dormant' || !n || Archetypes.pipless(state, a)) return false;
    copy(cause, 'pip.cause');
    const k = cause.k;
    if (a.pipTurns[k] === state.turn) return false;
    const pips = Math.max(0, Math.min(N.PIPS_TO_WAKE, a.pips + n)), delta = pips - a.pips;
    if (!delta) return false;
    const W = Registry.WAKE_CAUSES[k];
    if (pips >= N.PIPS_TO_WAKE && !(W && (W.mode === 'hunting' || W.mode === 'awake'))) throw new Error(`Wake.addPips: ${k} cannot wake an exhibit`);
    a.pipTurns[k] = state.turn;
    a.pips = pips;
    if (delta > 0) a.stim = state.turn;
    Causes.emit(state, ev, 'pip', { who: a.uid, pips, delta }, cause);
    return pips >= N.PIPS_TO_WAKE ? wake(state, a, W.mode, cause, ev, opts) : false;
  }

  // Turn boundary step 4 (§8.1): the wake checks, all made from your tile at this tick and
  // only then applied, so that what one sleeper's waking does cannot change what another's
  // checks find. For each sleeping exhibit that is not gone and not pipless, in spawn order:
  // the ring (a pip if any tile it stands on is inside your ring, Vision.inRing, with the
  // walking distance and the radius in the cause); its `axis` trigger (a pip while you stand
  // in its row or column within AXIS_RANGE, in its sight: Wake.onAxis); its `tether` trigger
  // (all its pips at once while you are within TETHER_RANGE of what it guards: Wake.inTether).
  // Each is applied in that order, so if the ring's pip is the third, the ring woke it.
  function boundary(state, ev) {
    let f = null;
    const due = [];
    for (let i = 1; i < state.actors.length; i++) {
      const a = state.actors[i];
      if (a.gone || a.mode !== 'dormant' || Archetypes.pipless(state, a)) continue;
      if (!f) f = Vision.field(state);
      let dist = -1;
      for (const [x, y] of Actors.footprint(a)) { const d = Vision.ringDist(state, x, y, f); if (d >= 0 && (dist < 0 || d < dist)) dist = d; }
      const axis = a.trigger === 'axis' && Wake.onAxis(state, a) ? axisDist(state, a) : -1;
      const tether = a.trigger === 'tether' && Wake.inTether(state, a);
      if (dist >= 0 || axis >= 0 || tether) due.push({ a, dist, axis, tether });
    }
    for (const d of due) {
      if (d.dist >= 0) addPips(state, d.a, 1, { k: 'ring', dist: d.dist, r: f.r }, ev);
      if (d.axis >= 0) addPips(state, d.a, 1, { k: 'axis', dist: d.axis }, ev);
      if (d.tether) addPips(state, d.a, N.PIPS_TO_WAKE, tetherCause(state, d.a), ev);
    }
  }

  // The `axis` trigger (§8.2): you stand in a's row or column, within AXIS_RANGE of one of
  // its tiles (Grid.disc, which on a row or column is at most AXIS_RANGE tiles), with line of
  // sight from that tile to yours. axisDist gives the tiles between you along that line (the
  // nearest of its tiles that qualifies), or -1; onAxis says whether there is one. Neither
  // asks whether a sleeps or has the trigger: Wake.boundary does.
  function axisDist(state, a) {
    const you = state.actors[0], m = state.dept;
    let best = -1;
    for (const [x, y] of Actors.footprint(a)) {
      if ((x !== you.x && y !== you.y) || (x === you.x && y === you.y)) continue;
      const d = Math.abs(you.x - x) + Math.abs(you.y - y);
      if (!Grid.disc(you.x - x, you.y - y, N.AXIS_RANGE) || !Grid.los(m, x, y, you.x, you.y)) continue;
      if (best < 0 || d < best) best = d;
    }
    return best;
  }
  const onAxis = (state, a) => axisDist(state, a) >= 0;

  // The `tether` trigger (§8.2): you are within TETHER_RANGE (Grid.disc) of the tile a guards
  // (a.guards: a tethered warden's own tile, set by its archetype). No sight is needed. False
  // if it guards nothing.
  function inTether(state, a) {
    const g = a.guards, you = state.actors[0];
    return Array.isArray(g) && Grid.disc(you.x - g[0], you.y - g[1], N.TETHER_RANGE);
  }
  // The tether's cause: how far you are from what it guards, and that tile.
  const tetherCause = (state, a) => ({ k: 'tether', dist: Grid.chebyshev(state.actors[0].x, state.actors[0].y, a.guards[0], a.guards[1]), x: a.guards[0], y: a.guards[1] });

  // One trigger for one exhibit, as Wake.boundary applies it: a's axis pip (if it sleeps,
  // has the axis trigger and you are on its axis) and a's tether (likewise). Each returns
  // whether it woke a.
  function axis(state, a, ev) {
    if (a.gone || a.mode !== 'dormant' || a.trigger !== 'axis' || !Wake.onAxis(state, a)) return false;
    return addPips(state, a, 1, { k: 'axis', dist: axisDist(state, a) }, ev);
  }
  function tether(state, a, ev) {
    if (a.gone || a.mode !== 'dormant' || a.trigger !== 'tether' || !Wake.inTether(state, a)) return false;
    return addPips(state, a, N.PIPS_TO_WAKE, tetherCause(state, a), ev);
  }

  // Turn boundary step 5 (§8.1): pips decay, only before the bell (Clock.pipsDecay). A
  // sleeping exhibit with pips loses one when PIP_DECAY_TURNS turns have passed since its
  // last stimulus (stim: its last pip gained, or the turn it went to sleep) and since its
  // last decay (pipTurns.decay, the turn Wake.addPips last took a pip for decay): so a
  // sleeper left at 2 pips on turn t is at 1 on turn t + 10 and at 0 on turn t + 20.
  function decay(state, ev) {
    if (!Clock.pipsDecay(state)) return;
    for (let i = 1; i < state.actors.length; i++) {
      const a = state.actors[i];
      if (a.gone || a.mode !== 'dormant' || !a.pips || Archetypes.pipless(state, a)) continue;
      const last = a.pipTurns.decay, since = last !== undefined && last !== null && last > a.stim ? last : a.stim;
      if (state.turn - since >= N.PIP_DECAY_TURNS) addPips(state, a, -1, { k: 'decay' }, ev);
    }
  }

  // Noise.emit: a heard a noise (noise {x, y, cls, range, by, k}) dist walking tiles away
  // (§8.2). An exhibit never reacts to a noise it made itself. By its mode:
  //   dormant: a pip (cause noise, at most one a turn); the third wakes it awake, to look at
  //     the noise's tile;
  //   awake: it goes to look at the noise's tile (alerted), and the noise counts as a
  //     stimulus; a noise from the tile it is already going to look at only counts;
  //   searching, returning or reinstalling: it goes awake, to look there (alerted);
  //   hunting: if you made the noise, its last-known tile becomes the noise's tile (the
  //     Tuning Fork's lure is yours too); another exhibit's noise says nothing about where
  //     you are. Its count of turns out of sight goes on.
  // The cause names the source (who made the noise, when someone did, and its tile x, y),
  // the walking distance and the class (§3.4: a wake event names the trigger, the source and
  // the distance). Returns whether a changed.
  function hear(state, a, noise, dist, ev) {
    if (!a || a.gone || a.uid === 'you' || Archetypes.pipless(state, a)) return false;
    if (noise.by && noise.by === a.uid) return false;
    const src = [noise.x, noise.y], cause = { k: 'noise' };
    if (noise.by) cause.by = noise.by;
    cause.dist = dist; cause.cls = noise.cls; cause.x = noise.x; cause.y = noise.y;
    switch (a.mode) {
      case 'dormant': { const pips = a.pips; return addPips(state, a, 1, cause, ev, { target: src }) || a.pips !== pips; }
      case 'awake':
        if (Array.isArray(a.target) && a.target[0] === src[0] && a.target[1] === src[1]) { a.stim = state.turn; return true; }
        return setMode(state, a, 'awake', cause, ev, { target: src });
      case 'searching': case 'returning': case 'reinstalling':
        return setMode(state, a, 'awake', cause, ev, { target: src });
      case 'hunting':
        if (noise.by !== 'you') return false;
        a.lastKnown = src;
        return true;
    }
    return false;
  }

  // Combat.hurt: victim took damage (cause, the damage's). Every sleeping exhibit of the
  // victim's group (a.group, from its species) whose own trigger is `ally_hit`, within
  // ALLY_HIT_RANGE of the victim (Grid.disc, between any of their tiles), gains all its pips
  // at once and wakes hunting, in spawn order. The cause names the ally that was hurt, who
  // hurt it, and the distance between them. A blow applies this before its noise (§8.2).
  function allyHit(state, victim, cause, ev) {
    if (!victim || victim.uid === 'you' || !victim.group) return;
    for (let i = 1; i < state.actors.length; i++) {
      const b = state.actors[i];
      if (b === victim || b.gone || b.mode !== 'dormant' || b.group !== victim.group || b.trigger !== 'ally_hit' || Archetypes.pipless(state, b)) continue;
      if (!near(b, victim, N.ALLY_HIT_RANGE)) continue;
      const c = { k: 'ally_hit' };
      if (cause && cause.by) c.by = cause.by;
      c.ally = victim.uid; c.dist = Actors.between(b, victim);
      addPips(state, b, N.PIPS_TO_WAKE, c, ev);
    }
  }
  // Is some tile of a within r (Grid.disc) of some tile of b?
  function near(a, b, r) {
    for (const [x, y] of Actors.footprint(a)) for (const [u, v] of Actors.footprint(b)) if (Grid.disc(x - u, y - v, r)) return true;
    return false;
  }

  // Whom "Quiet, Please" leaves alone: the Night Watchman, who comes for you whatever you
  // read (§8.4), and a species that never sleeps (trigger `awake`). The Ticket leaves the
  // Night Watchman alone too.
  const unmoved = a => a.arch === 'night_watchman' || a.trigger === 'awake';
  // Their causes, as the events carry them: {k, by, item?}.
  function calm(k, cause) {
    const c = { k, by: (cause && cause.by) || 'you' };
    if (cause && cause.item) c.item = cause.item;
    return c;
  }

  // "Quiet, Please" read at (x, y) (§8.6): every exhibit within `range` walking tiles of it
  // (to its nearest tile, as noise is measured but with no extra for doors, since nothing is
  // heard), in spawn order: a sleeper loses all its pips; an exhibit awake but not hunting
  // (awake, searching, returning or reinstalling) goes to sleep where it stands, its home
  // unchanged, so a later waking still brings it home; a hunter drops to awake, with nothing
  // to look at, and its pending special is called off. Not the Night Watchman, nor a species
  // that never sleeps, nor a mimic in its disguise (which has no pips).
  function quiet(state, x, y, range, cause, ev) {
    const c = calm('quiet', cause), m = state.dept, d = Grid.distances(m, [[x, y]], range);
    for (let i = 1; i < state.actors.length; i++) {
      const a = state.actors[i];
      if (a.gone || unmoved(a) || Archetypes.pipless(state, a)) continue;
      let dist = -1;
      for (const [tx, ty] of Actors.footprint(a)) { const t = Grid.reachDist(d, m, tx, ty); if (t >= 0 && (dist < 0 || t < dist)) dist = t; }
      if (dist < 0 || dist > range) continue;
      if (a.mode === 'dormant') { if (a.pips > 0) addPips(state, a, -a.pips, c, ev); }
      else if (a.mode === 'hunting') setMode(state, a, 'awake', c, ev, { target: null });
      else setMode(state, a, 'dormant', c, ev);
    }
  }

  // The Re-admission Ticket (§8.6): every hunter but the Night Watchman loses you, and
  // searches where it last knew you were (its last-known tile is unchanged); its pending
  // special is called off, so nothing it marked resolves on you unseen.
  function lose(state, cause, ev) {
    const c = calm('ticket', cause);
    for (let i = 1; i < state.actors.length; i++) {
      const a = state.actors[i];
      if (a.gone || a.mode !== 'hunting' || a.arch === 'night_watchman') continue;
      setMode(state, a, 'searching', c, ev, { lastKnown: a.lastKnown });
    }
  }

  // [M4] The chime: a period exhibit performs, then sleeps again with the pips it had.
  function perform(state, a, cause, ev) {}
  function resleep(state, a, ev) {}

  return { MODES: MODES.slice(), wake, setMode, toHunting, created, addPips, boundary, onAxis, axisDist, inTether, axis, tether, decay, hear, allyHit, quiet, lose, perform, resleep };
})();
