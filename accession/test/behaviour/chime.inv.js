// ACCESSION — invariants of hourly_demonstration and its stations, the demonstrator (BUILD.md
// §5.3 check 1, §5.4, §8.1, §8.2; MOD-CHIME), checked after every step of every scenario,
// monkey, soak and bot run (tools/invariants.js). Each states a sentence of the station's line,
// written out again here from the clause and §5.4, not from the rule code (the count, the
// periods and the rooms are worked out here):
//   "Stands fixed on its tile, never hunts you and has no blow": chime.stands, a station never
//     steps, is never moved, strikes no blow, and is never hunting, searching, returning or
//     reinstalling;
//   "on each chime, every 12 turns (8 in the Intro, 8 in the hall), it … marks its line":
//     chime.marks, a station's line (demo_line) is marked only at a boundary whose count from
//     department entry is DEMO_WARNING short of a multiple of its room's period, due exactly
//     DEMO_WARNING turns later, only while the module is on for it, and only on tiles of its
//     own room; chime.goes_off, it goes off only at a boundary whose count is a multiple of that
//     period, and only as the line it marked;
//   "it wakes": chime.wakes, a station asleep and not held fixed at a boundary of its chime wakes
//     there (woke, cause period, awake), and the chime wakes nothing else;
//   "unless another mark lies on its line, {special}": chime.marked_or_blocked, a station woken
//     for its chime either marks its line at that boundary or says it was blocked, with another
//     damage mark lying on a tile of its line, unless it has no tile to mark;
//   "then it sleeps again with its pips, unless it was awake before": chime.sleeps_again, a
//     station that woke for its chime is asleep again by the end of the boundary of its
//     multiple, with the pips it had when the chime woke it, and only one the chime woke goes
//     back so (settle).
// A step holds several actions and boundaries (yours, then every exhibit's until your next
// decision), so a check about one boundary follows the step's events by their turn.
'use strict';
module.exports = (C) => {
  const { N, Modules, Options, Status } = C;
  const ID = 'hourly_demonstration', SP = 'demo_line', W = N.DEMO_WARNING, T = N.TICKS_PER_TURN;
  const json = x => JSON.stringify(x);
  const find = (state, uid) => state.actors.find(b => b.uid === uid) || null;
  const station = a => !!a && a.uid !== 'you' && a.arch === 'demonstrator';
  const mod = state => (state && state.dept && Array.isArray(state.dept.modules) ? state.dept.modules.find(m => m.id === ID) : null) || null;
  // The module is on in the visit (present, made on, not switched off), and acts on a: its
  // species flagged with it.
  const on = (state, a) => { const m = mod(state); return !!m && m.on && !Options.off(state, ID) && Modules.flagged(state, a, ID); };
  // The room of a tile and its period (§5.4): the Intro's, the hall's, or any other's.
  const roomOf = (state, x, y) => Array.isArray(state.dept.roomOf) && state.dept.roomOf.length && state.dept.roomOf[y] ? state.dept.roomOf[y][x] : null;
  function periodAt(state, x, y) {
    const id = roomOf(state, x, y), rm = id === null ? null : (state.dept.rooms || []).find(r => r.id === id);
    return rm && rm.role === 'intro' ? N.DEMO_PERIOD_INTRO : rm && rm.role === 'centre' ? N.DEMO_PERIOD_HALL : N.DEMO_PERIOD;
  }
  const count = (state, turn) => turn - mod(state).since;
  const chime = (state, a, turn) => { const p = periodAt(state, a.x, a.y), c = count(state, turn); return c >= 0 && c % p === p - W; };
  const multiple = (state, a, turn) => { const p = periodAt(state, a.x, a.y), c = count(state, turn); return c > 0 && c % p === 0; };
  const isLine = e => e.sp === SP;
  // The turns of the boundaries the step ran through.
  const boundaries = (pre, post) => { const out = []; for (let t = pre.turn + 1; t <= post.turn; t++) out.push(t); return out; };

  return [
    {
      id: 'chime.stands',
      applies: (a) => station(a),
      check(pre, events, post, ctx) {
        const a = ctx.actor, b = ctx.before;
        if (b && !a.gone && (a.x !== b.x || a.y !== b.y)) return `a station moved from ${b.x},${b.y} to ${a.x},${a.y}`;
        const did = events.find(e => (e.k === 'moved' && e.who === a.uid) || (e.k === 'attacked' && e.by === a.uid));
        if (did) return `a station ${did.k === 'moved' ? 'was moved' : 'struck a blow'} on turn ${did.turn}`;
        if (['hunting', 'searching', 'returning', 'reinstalling'].includes(a.mode)) return `a station is ${a.mode}`;
        const hunt = events.find(e => (e.k === 'hunting' && e.who === a.uid) || (e.k === 'woke' && e.who === a.uid && e.mode !== 'awake'));
        return hunt ? `a station began hunting on turn ${hunt.turn}` : null;
      },
    },
    {
      id: 'chime.marks',
      check(pre, events, post) {
        for (const e of events) {
          if (e.k !== 'telegraphed' || !isLine(e)) continue;
          const a = find(post, e.who);
          if (!station(a)) return `${e.who} marked a station's line, and is no station`;
          if (!on(post, a)) return `${e.who} marked its line on turn ${e.turn}, with the chime's module not on for it`;
          if (e.tick !== e.turn * T || !chime(post, a, e.turn)) return `${e.who} marked its line at tick ${e.tick}, not at a boundary of its chime (count ${count(post, e.turn)}, period ${periodAt(post, a.x, a.y)})`;
          if (!e.cause || e.cause.due !== (e.turn + W) * T) return `${e.who}'s line, marked on turn ${e.turn}, is due at ${e.cause && e.cause.due}, not ${(e.turn + W) * T}`;
          const room = roomOf(post, a.x, a.y);
          if (room !== null) { const out = e.tiles.find(t => roomOf(post, t[0], t[1]) !== room); if (out) return `${e.who}'s line leaves its room at ${out}`; }
        }
        return null;
      },
    },
    {
      id: 'chime.goes_off',
      check(pre, events, post) {
        for (const e of events) {
          const off = (e.k === 'special' && isLine(e) && !e.cancelled) || (e.k === 'damaged' && e.cause && (e.cause.k === 'special' || e.cause.k === 'reflected') && isLine(e.cause));
          if (!off) continue;
          const owner = e.k === 'special' ? e.who : e.cause.k === 'reflected' ? e.cause.shooter : e.cause.by, a = find(post, owner);
          if (!station(a)) return `${owner}'s line went off, and it is no station`;
          if (e.tick !== e.turn * T || !multiple(post, a, e.turn)) return `${owner}'s line went off at tick ${e.tick}, not at a boundary of a multiple of its period (count ${count(post, e.turn)})`;
          const b = find(pre, owner), was = b && b.telegraph && isLine(b.telegraph) ? b.telegraph : null;
          const made = events.filter(m => m.k === 'telegraphed' && m.who === owner && isLine(m) && m.tick <= e.tick).pop();
          const due = made ? made.cause.due : was ? was.due : null;
          if (due !== e.tick) return `${owner}'s line went off at ${e.tick}, but the line it marked was due at ${due}`;
        }
        return null;
      },
    },
    {
      id: 'chime.wakes',
      applies: (a) => station(a),
      check(pre, events, post, ctx) {
        const a = ctx.actor, b = ctx.before;
        const mine = events.filter(e => e.k === 'woke' && e.who === a.uid && e.cause && e.cause.k === 'period');
        for (const e of mine) if (e.mode !== 'awake' || e.was !== 'dormant' || !chime(post, a, e.turn) || !on(post, a)) return `the chime woke it on turn ${e.turn} (${json(e)}), which is not a chime of its`;
        if (!b || b.mode !== 'dormant' || a.gone || !on(post, a) || Status.has(b, 'fixed') || Status.has(a, 'fixed')) return null;
        // Asleep before and after, and no waking at all in the step: no chime of its passed.
        if (a.mode === 'dormant' && !events.some(e => e.k === 'woke' && e.who === a.uid)) {
          const t = boundaries(pre, post).find(u => chime(post, a, u));
          if (t !== undefined) return `asleep, it did not wake at its chime on turn ${t}`;
        }
        return null;
      },
    },
    {
      id: 'chime.marked_or_blocked',
      check(pre, events, post) {
        for (const e of events) {
          if (e.k !== 'woke' || !e.cause || e.cause.k !== 'period') continue;
          const a = find(post, e.who);
          if (!a || a.gone || Status.has(a, 'fixed')) continue;
          const said = events.some(f => f.turn === e.turn && f.tick === e.tick && ((f.k === 'telegraphed' && f.who === a.uid && isLine(f))
            || (f.k === 'module' && f.id === ID && f.rule === 'blocked' && f.who === a.uid)));
          if (!said && C.HourlyDemonstration.line(post, a).length) return `${a.uid} woke for its chime on turn ${e.turn}, then neither marked its line nor said it was blocked`;
          const blocked = events.find(f => f.k === 'module' && f.id === ID && f.rule === 'blocked' && f.who === a.uid && f.turn === e.turn);
          if (blocked) {
            const i = events.indexOf(blocked), lying = [];
            for (const b of pre.actors) if (b.telegraph && b.telegraph.effect === 'damage' && b.uid !== a.uid) lying.push(...b.telegraph.tiles);
            for (const f of events.slice(0, i)) if (f.k === 'telegraphed' && f.who !== a.uid && f.cause && f.cause.k === 'special' && Number.isInteger(f.cause.gross) && f.cause.gross > 0) lying.push(...f.tiles);
            const mine = C.HourlyDemonstration.line(post, a);
            if (!mine.some(t => lying.some(l => l[0] === t[0] && l[1] === t[1]))) return `${a.uid} said its line was blocked on turn ${e.turn}, with no other mark lying on it`;
          }
        }
        return null;
      },
    },
    {
      id: 'chime.sleeps_again',
      applies: (a) => station(a),
      check(pre, events, post, ctx) {
        const a = ctx.actor, b = ctx.before;
        // The pips it had when the chime woke it: before the step, or worked out along the step.
        let kept = b && b.ax && b.ax.perform ? b.ax.perform.pips : null, pips = b && b.mode === 'dormant' ? b.pips : null;
        for (const e of events) {
          if (e.k === 'pip' && e.who === a.uid) pips = e.pips;
          if (e.k === 'woke' && e.who === a.uid) { kept = e.cause && e.cause.k === 'period' ? pips : null; pips = 0; }
          if (e.k === 'module' && e.id === ID && e.rule === 'settle' && e.who === a.uid) {
            if (kept === null) return `it went back to sleep on turn ${e.turn}, but the chime had not woken it`;
            if (e.n !== kept) return `it went back to sleep with ${e.n} pips on turn ${e.turn}, having had ${kept} when the chime woke it`;
            kept = null; pips = e.n;
          }
        }
        if (a.gone || post.over) return null;
        if (a.ax && a.ax.perform) {
          if (a.mode !== 'awake' || a.pips !== 0) return `it performs, yet it is ${a.mode} with ${a.pips} pips`;
          if (post.turn >= a.ax.perform.turn + W) return `the chime woke it on turn ${a.ax.perform.turn}, and on turn ${post.turn} it is still awake`;
        }
        // After its last settle, asleep, with those pips unless a pip came or went since.
        const last = events.filter(e => e.k === 'module' && e.id === ID && e.rule === 'settle' && e.who === a.uid).pop();
        if (!last) return null;
        const after = events.slice(events.indexOf(last) + 1).filter(e => e.who === a.uid);
        if (after.some(e => e.k === 'woke')) return null;
        if (a.mode !== 'dormant') return `it went back to sleep on turn ${last.turn}, yet it is ${a.mode}`;
        if (!after.some(e => e.k === 'pip') && a.pips !== last.n) return `it went back to sleep on turn ${last.turn} with ${last.n} pips, yet it has ${a.pips}`;
        return null;
      },
    },
  ];
};
