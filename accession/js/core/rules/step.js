// ACCESSION — step(state, action) → events: the only function that changes the state
// (BUILD.md §3.1), frozen after M3's Wave 0. It applies your action through the action table
// (Actions), then lets every other actor act until it is your turn again, resolving turn
// boundaries on the way (§8.1).
'use strict';
const Step = (() => {
  // A refusal (§4.2): one refused event with its code, and nothing else changes.
  const refuse = (state, code) => [Causes.make(state, 'refused', { reason: code })];

  // Actions that keep your ring at its still radius (§8.2), and those that keep you seated.
  const STILL = ['wait', 'rest', 'view', 'sit'];
  const SEATED = ['wait', 'rest', 'sit'];

  // The first actor other than a on a tile a would cover with its anchor at (x, y).
  function blocker(state, a, x, y) {
    const s = a.size || 1;
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) { const o = Actors.at(state, x + dx, y + dy, a); if (o) return o; }
    return null;
  }

  // An actor's move in direction d (§4.2, §8.2), yours or an exhibit's. Returns its cost in
  // ticks, or a refusal code. With ev null it changes nothing and says what it would return,
  // which is how Step.legal lists your moves with exactly step()'s tests. In order:
  //   1. into another actor: a blow, if Combat.canStrike allows it (exhibits never bump
  //      exhibits);
  //   2. for you, onto a fixture: Cases.enter decides (a case refuses; a staff door opens);
  //   3. into a closed door: it opens, with a soft noise there, and the mover stays put;
  //   4. otherwise the step itself, if every tile of the footprint may step (Grid.canStep).
  function moveInto(state, a, d, ev) {
    if (!(Number.isInteger(d) && d >= 0 && d < 8)) return 'bad_direction';
    const m = state.dept, s = a.size || 1, nx = a.x + Grid.DX[d], ny = a.y + Grid.DY[d], you = a.uid === 'you';
    const who = you ? 'you' : 'exhibit', dry = ev === null;
    const other = blocker(state, a, nx, ny);
    if (other) {
      if (!you && other.uid !== 'you') return 'blocked';
      const code = Combat.canStrike(state, a, other, { kind: 'melee' });
      if (code) return code;
      return dry ? Actors.attackCost(state, a) : Combat.strike(state, a, other, ev);
    }
    if (you && s === 1) { const r = Cases.enter(state, a, nx, ny, d, ev); if (r !== null) return r; }
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
      const x = nx + dx, y = ny + dy;
      if (Grid.ch(m, x, y) === '+' && Grid.canStep(m, a.x + dx, a.y + dy, d, who)) {
        if (!dry) {
          Grid.set(m, x, y, "'");
          Causes.emit(state, ev, 'opened', { who: a.uid, x, y }, { k: 'door', by: a.uid });
          Noise.emit(state, x, y, 'soft', { k: 'door', by: a.uid }, ev);
        }
        return Actors.cost(state, a, N.COST_DOOR, 'act');
      }
    }
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) if (!Grid.canStep(m, a.x + dx, a.y + dy, d, who)) return 'blocked';
    if (!dry) {
      Causes.emit(state, ev, 'moved', { who: a.uid, from: [a.x, a.y], to: [nx, ny] });
      a.x = nx; a.y = ny;
    }
    return Actors.cost(state, a, N.COST_STEP, 'move');
  }

  // move(dir) (§4.2).
  Actions.define('move', {
    legal(state) {
      const out = [];
      for (let d = 0; d < 8; d++) if (typeof moveInto(state, state.actors[0], d, null) === 'number') out.push({ a: 'move', dir: d });
      return out;
    },
    candidates: () => [0, 1, 2, 3, 4, 5, 6, 7, 8, -1].map(dir => ({ a: 'move', dir })).concat([{ a: 'move' }]),
    apply: (state, action, ev) => moveInto(state, state.actors[0], action.dir, ev),
  });

  // use(uid[, x, y][, on]) (§4.2): an instrument or a Restoration kit goes to the kit's rules,
  // a consumable to the consumables'. Each owner lists its own candidates, its targeted uses
  // (use(uid, x, y), use(uid, on)) among them, so that every use it makes legal is a candidate
  // (Kit.useCandidates, Consumables.useCandidates); the dispatcher adds a bare use of every
  // other item and of nothing, which it refuses itself.
  const USED = ['instrument', 'kit', 'consumable'];
  const item = (state, uid) => { for (const i of state.items || []) if (i.uid === uid) return i; return null; };
  Actions.define('use', {
    legal: state => Kit.useLegal(state).concat(Consumables.useLegal(state)),
    candidates: state => Kit.useCandidates(state).concat(Consumables.useCandidates(state),
      (state.items || []).filter(i => !USED.includes(i.kind)).map(i => ({ a: 'use', uid: i.uid })), [{ a: 'use', uid: 'nothing' }, { a: 'use' }]),
    apply(state, action, ev) {
      const it = item(state, action.uid);
      if (it && (it.kind === 'instrument' || it.kind === 'kit')) return Kit.useAction(state, action, ev);
      if (it && it.kind === 'consumable') return Consumables.useAction(state, action, ev);
      return 'no_use';
    },
  });

  // The turn boundary (§8.1), in its fixed order. Each step is a named function of its
  // system, called here and nowhere else. The statuses' per-turn effects (a cough's noise,
  // restoring's healing) come after the wake checks, so that at a boundary, as within an
  // action, noise comes after the ring, axis and tether (§8.2: hunting wins).
  function boundary(state, ev) {
    Surfaces.tick(state, ev);                        // 1. surfaces
    Status.tick(state, ev); Kit.recharge(state, ev); // 2. status timers (expiry), then instruments' charges
    Health.regenerate(state, ev);                    // 3. regeneration
    Wake.boundary(state, ev);                        // 4. wake checks: your ring, axis, tether;
    Status.effects(state, ev);                       //    then the statuses' per-turn effects
    Wake.decay(state, ev);                           // 5. pip decay
    ClockRules.boundary(state, ev);                  // 6. the clock stage
    Modules.alarmDecay(state, ev);                   // 7. alarm decay (M4)
    Modules.turn(state, ev);                         // 8. module turn rules (M4)
  }

  // Run the world until it is your turn again. An exhibit's action is charged after it acts:
  // its next becomes next + the action's cost, or notBefore if that is later (a telegraph
  // keeps its resolve until after your next decision, §8.1); then the statuses its action
  // applied are settled. Time only moves forward: an actor scheduled behind the clock (one
  // made during the visit without its beat), or an exhibit's action that costs no time, is a
  // bug, and stops step() with an error rather than turning the clock back or looping.
  function advance(state, ev) {
    for (;;) {
      if (state.over) return;
      const a = Actors.next(state);
      if (!a) return;
      const boundaryTick = (state.turn + 1) * N.TICKS_PER_TURN;
      if (boundaryTick <= a.next) { state.turn++; state.tick = boundaryTick; boundary(state, ev); continue; }
      if (a.next < state.tick) throw new Error(`Step: ${a.uid} is scheduled at ${a.next}, behind the clock at ${state.tick}`);
      state.tick = a.next;
      if (a.uid === 'you') return;
      const c = AI.act(state, a, ev);
      if (!Number.isInteger(c) || c < 1) throw new Error(`Step: ${a.uid}'s action cost ${c}`);
      const nb = a.notBefore === null || a.notBefore === undefined ? 0 : a.notBefore;
      a.next = Math.max(a.next + c, nb);
      a.notBefore = null;
      Status.settle(state);
    }
  }

  // One step (§4.2), refused before anything is spent if the visit is over, a choice is
  // waiting, the action is unknown, a status forbids it, or its handler refuses it.
  function step(state, action) {
    if (state.over) return refuse(state, 'visit_over');
    if (state.ui && state.ui.pendingChoice && !(action && action.a === 'choose')) return refuse(state, 'choice_pending');
    const h = action && typeof action.a === 'string' ? Actions.get(action.a) : null;
    if (!h) return refuse(state, 'unknown_action');
    const you = state.actors[0];
    const blocked = Status.blocks(state, you, action);
    if (blocked) return refuse(state, blocked);
    const ev = [];
    const r = h.apply(state, action, ev);
    if (typeof r === 'string') {
      if (ev.length) throw new Error(`Step: ${action.a} refused (${r}) after emitting events`);
      return refuse(state, r);
    }
    // Every action of yours that costs time costs at least a turn (§8.1), so a turn boundary
    // runs between any two of your decisions.
    if (!Number.isInteger(r) || r < 0 || (r > 0 && r < N.TICKS_PER_TURN)) throw new Error(`Step: ${action.a} cost ${r} ticks`);
    you.next += r;
    Status.settle(state);
    // Your ring is set by your last action that cost time (§8.2).
    if (r > 0) { you.still = STILL.includes(action.a); you.lastAct = action.a; if (!SEATED.includes(action.a)) you.seated = false; }
    advance(state, ev);
    // Your derived stats change once your action's ticks are done (§8.1).
    Kit.settle(state);
    Vision.remember(state);
    return ev;
  }

  // Every legal action for you now (§4.2), in Actions.ORDER: step() refuses exactly the
  // others. While a choice waits only its answers are legal.
  function legal(state) {
    if (state.over) return [];
    const you = state.actors[0], pending = !!(state.ui && state.ui.pendingChoice), out = [];
    for (const id of Actions.ORDER) {
      if (pending && id !== 'choose') continue;
      const h = Actions.get(id);
      if (!h) continue;
      for (const act of h.legal(state)) if (!Status.blocks(state, you, act)) out.push(act);
    }
    return out;
  }

  // Kept for the UI and the browser checks: can a reach b with a blow (Combat.adjacent).
  const adjacent = (state, a, b) => Combat.adjacent(state, a, b);

  return { step, legal, boundary, advance, moveInto, adjacent, STILL: STILL.slice() };
})();
