// ACCESSION — invariants of unobserved_motion and the Grazer, unobserved_mover (BUILD.md §5.3
// check 1, §5.4; MOD-UNOBSERVED), checked after every step of every scenario, monkey, soak and
// bot run (tools/invariants.js). Each states a sentence of the Grazer's line, written out again
// here from the clause and §5.4's one definition of "unobserved", not from the rule code (it
// reads the state, the events and the geometry of Grid, never Vision.observed or the module):
//   "Moves 2 tiles a turn, but only while you cannot see it (it takes no step in your sight …":
//     unobserved.gate, every step a Grazer the module acts on takes begins while no tile of it
//     is in your line of sight within SIGHT_PLAYER of you, nor, while you wear a lit Lamp,
//     within the Lamp's range of you (the Lamp's own line: "counts as seen by you");
//   "… and stops for the turn once a step brings it into view)": unobserved.pace, no more than
//     UNOBSERVED_STEP of its steps in one turn, and none after a step that ended in your sight
//     in that turn; with the module off it "Walks a tile at a time": no more than one a turn;
//   the stride: unobserved.stride, each of its steps is told by one module event, rule stride,
//     naming it, of 1 tile, after the step and at its tick, and no stride is told of anything
//     else (with the module off, of an exhibit not flagged with it, or naming no one).
// A step holds several actions (yours, then every exhibit's until your next decision), so a
// check about one moment follows the step's events in order from the state before it: where
// you and the Grazer stood (their moves), the doors opened and closed, the hall's shutters,
// and the surfaces laid (and gone at their turn).
'use strict';
module.exports = (C) => {
  const { N, Grid, Modules, Kit } = C;
  const ID = 'unobserved_motion';
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const find = (state, uid) => state.actors.find(b => b.uid === uid) || null;
  // A step taken by a mover itself (Step.moveInto): a moved event with no cause.
  const isStep = e => e.k === 'moved' && e.cause === undefined;
  const stride = e => e.k === 'module' && e.id === ID;
  // An exhibit the module acts on: flagged with it, the module on (the visit's, all the step).
  const gated = (state, a) => !!a && a.uid !== 'you' && Modules.flagged(state, a, ID);
  const OPEN = { '+': "'", S: 's' }, SHUT = { "'": '+', s: 'S' };

  // The world as it was when the step's i-th event came: your tile and the map's tiles and
  // surfaces, followed from the state before the step through the events before it.
  function moment(pre, post, events, i) {
    const m0 = pre.dept, rows = m0.tiles.map(r => r.split('')), cp = (post.dept.cp || pre.dept.cp) || null;
    let you = [pre.actors[0].x, pre.actors[0].y];
    const surfaces = (m0.surfaces || []).map(s => Object.assign({}, s));
    for (let k = 0; k < i; k++) {
      const e = events[k];
      if (e.k === 'moved' && e.who === 'you') you = e.to.slice();
      else if (e.k === 'opened' && own(OPEN, rows[e.y][e.x])) rows[e.y][e.x] = OPEN[rows[e.y][e.x]];
      else if (e.k === 'closed' && own(SHUT, rows[e.y][e.x])) rows[e.y][e.x] = SHUT[rows[e.y][e.x]];
      else if (e.k === 'stage' && e.cause && e.cause.k === 'hall' && cp && (e.stage === 'sealed' || e.stage === 'unsealed'))
        for (const o of cp.openings || []) rows[o.y][o.x] = e.stage === 'sealed' ? 'Z' : o.ch;
      else if (e.k === 'surface') surfaces.push({ kind: e.kind, x: e.x, y: e.y, size: e.size, until: e.turn + 1 + e.turns });
    }
    const turn = i < events.length ? events[i].turn : post.turn;
    return { you, m: { w: m0.w, h: m0.h, tiles: rows.map(r => r.join('')), surfaces: surfaces.filter(s => s.until > turn) } };
  }
  // Could you see an exhibit of this size standing at `at`, at that moment: a tile of it in your
  // line of sight within SIGHT_PLAYER, or, with a lit Lamp worn (lamp its range), within it.
  function seen(w, at, size, lamp) {
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
      const x = at[0] + dx, y = at[1] + dy, ox = x - w.you[0], oy = y - w.you[1];
      if (lamp > 0 && Grid.disc(ox, oy, lamp)) return true;
      if (Grid.disc(ox, oy, N.SIGHT_PLAYER) && Grid.los(w.m, w.you[0], w.you[1], x, y)) return true;
    }
    return false;
  }
  // The steps of each mover in the step: [{i, e, a}], a the actor (in post, else pre).
  function steps(pre, post, events, which) {
    const out = [];
    events.forEach((e, i) => { if (isStep(e)) { const a = find(post, e.who) || find(pre, e.who); if (a && which(a)) out.push({ i, e, a }); } });
    return out;
  }

  return [
    {
      // No step begun in your sight.
      id: 'unobserved.gate',
      check(pre, events, post) {
        const list = steps(pre, post, events, a => gated(post, a));
        if (!list.length) return null;
        const lamp = Kit.observing(post);
        for (const { i, e, a } of list) {
          if (seen(moment(pre, post, events, i), e.from, a.size || 1, lamp)) return `${e.who} stepped from ${e.from} to ${e.to} at tick ${e.tick}, while you could see it`;
        }
        return null;
      },
    },
    {
      // At most UNOBSERVED_STEP steps a turn, none after a step into your sight in that turn;
      // with the module off (or not flagged), a tile a turn.
      id: 'unobserved.pace',
      check(pre, events, post) {
        const list = steps(pre, post, events, a => a.arch === 'unobserved_mover' || gated(post, a));
        if (!list.length) return null;
        const lamp = Kit.observing(post), count = new Map(), stopped = new Map();
        for (const { i, e, a } of list) {
          const key = `${e.who} ${e.turn}`, n = (count.get(key) || 0) + 1, most = gated(post, a) ? N.UNOBSERVED_STEP : 1;
          count.set(key, n);
          if (n > most) return `${e.who} took ${n} steps in turn ${e.turn}, more than ${most}`;
          if (stopped.has(key)) return `${e.who} stepped to ${e.to} in turn ${e.turn}, after its step to ${stopped.get(key)} had brought it into your sight in that turn`;
          if (gated(post, a) && seen(moment(pre, post, events, i + 1), e.to, a.size || 1, lamp)) stopped.set(key, e.to);
        }
        return null;
      },
    },
    {
      // Each of its steps is told by a stride {who, n: 1} after it, at its tick, and before its
      // next step; and every stride is one of those.
      id: 'unobserved.stride',
      check(pre, events, post) {
        const strides = events.filter(stride), list = steps(pre, post, events, a => gated(post, a));
        if (!strides.length && !list.length) return null;
        const told = new Set();
        for (const { i, e } of list) {
          let k = i + 1;
          while (k < events.length && !(stride(events[k]) && events[k].who === e.who) && !(isStep(events[k]) && events[k].who === e.who)) k++;
          const s = events[k];
          if (!s || !stride(s)) return `${e.who}'s step to ${e.to} at tick ${e.tick} was not told by a stride`;
          if (s.rule !== 'stride' || s.n !== 1 || s.tick !== e.tick) return `${e.who}'s step to ${e.to} was told by ${JSON.stringify(s)}, not a stride of 1 tile at its tick`;
          told.add(k);
        }
        for (let k = 0; k < events.length; k++) {
          const s = events[k];
          if (!stride(s) || told.has(k)) continue;
          const a = s.who === undefined ? null : find(post, s.who) || find(pre, s.who);
          if (!a) return `a stride named ${s.who === undefined ? 'no one' : s.who}, no exhibit`;
          if (!gated(post, a)) return `a stride was told of ${s.who}, which the module does not act on (off, or not flagged)`;
          return `a stride was told of ${s.who} at tick ${s.tick}, with no step of its own before it`;
        }
        return null;
      },
    },
  ];
};
