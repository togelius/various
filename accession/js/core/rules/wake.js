// ACCESSION — waking and modes (BUILD.md §8.2). W0d builds waking, the changes of mode, pips
// and the ring pip; W1-WAKE-A owns the file after, and fills hearing, decay, the special
// triggers, "Quiet, Please" and losing you.
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

  // Turn boundary step 4 (§8.1): the wake checks, from your tile at this tick. Each sleeping
  // exhibit that is not gone and not pipless, in spawn order: the ring (a pip if any tile it
  // stands on is inside your ring, Vision.inRing, with the walking distance and the radius
  // in the cause), then its axis and tether triggers.
  function boundary(state, ev) {
    let f = null;
    for (let i = 1; i < state.actors.length; i++) {
      const a = state.actors[i];
      if (a.gone || a.mode !== 'dormant' || Archetypes.pipless(state, a)) continue;
      if (!f) f = Vision.field(state);
      let dist = -1;
      for (const [x, y] of Actors.footprint(a)) { const d = Vision.ringDist(state, x, y, f); if (d >= 0 && (dist < 0 || d < dist)) dist = d; }
      if (dist >= 0) addPips(state, a, 1, { k: 'ring', dist, r: f.r }, ev);
      Wake.axis(state, a, ev);
      Wake.tether(state, a, ev);
    }
  }

  // [stub → W1-WAKE-A] Boundary step 4's special triggers for a: axis (a pip a turn while you
  // stand in its row or column within AXIS_RANGE, in its sight) and tether (wakes at once
  // when you come within TETHER_RANGE of what it guards).
  function axis(state, a, ev) {}
  function tether(state, a, ev) {}
  // [stub → W1-WAKE-A] Turn boundary step 5: a pip decays per PIP_DECAY_TURNS turns without
  // stimulus, before the bell.
  function decay(state, ev) {}
  // [stub → W1-WAKE-A] Noise.emit: a heard a noise, dist walking tiles away.
  function hear(state, a, noise, dist, ev) {}
  // [stub → W1-WAKE-A] Combat.hurt: victim took damage; its group within ALLY_HIT_RANGE wakes.
  function allyHit(state, victim, cause, ev) {}
  // [stub → W1-WAKE-A] "Quiet, Please" read at (x, y): pips fall, hunters lose you, the awake settle.
  function quiet(state, x, y, range, cause, ev) {}
  // [stub → W1-WAKE-A] Every hunter loses you (the Re-admission Ticket).
  function lose(state, cause, ev) {}
  // [M4] The chime: a period exhibit performs, then sleeps again with the pips it had.
  function perform(state, a, cause, ev) {}
  function resleep(state, a, ev) {}

  return { MODES: MODES.slice(), wake, setMode, toHunting, created, addPips, boundary, axis, tether, decay, hear, allyHit, quiet, lose, perform, resleep };
})();
