// ACCESSION — invariants of weather_cases, its cases, fog and rain (BUILD.md §5.4, §8.1; M4 plan
// MO1–MO3, A13; MOD-WEATHER), checked after every step of every scenario, monkey, soak and bot
// run (tools/invariants.js). Each states a part of the module's rule as §5.4 gives it, written
// out again here from the rule, not from its code:
//   weather.cases    a case's weather is fog or rain, held only by a real case (never a mimic's
//                    disguise) outside the Intro, and it never changes during the visit;
//   weather.release  a case that held weather, shut before the step and opened, broken or
//                    dissolved in it, while the module is on, lets it out once: one surface of
//                    its kind, WEATHER_SIZE tiles a side, centred on the case, for WEATHER_TURNS
//                    turns, its event's cause naming the case; and no other weather gets out
//                    (none with the module off, none from a case that held none);
//   weather.stop     rain stops, while it lies and for RAIN_STOP_TURNS turns after, every
//                    exhibit flagged with the module that has a tile under it: such an exhibit
//                    is held fixed at least until the boundary RAIN_STOP_TURNS after the
//                    rain's last turn (its until + RAIN_STOP_TURNS); a stop put on in the step
//                    holds it exactly to the latest such end over it (or to an end it already
//                    had, if later); and rain stops nothing else: no exhibit unflagged, none with
//                    no tile under rain laid in that step, never you;
//   weather.waits    an exhibit flagged with the module that stood in rain before the step and
//                    still does after it only waits: it makes no step, blow or mark, and does
//                    not wake for the chime (clockwork under rain only waits, M4 plan MO3).
'use strict';
module.exports = (C) => {
  const { N, Grid, Actors, Packs, Modules } = C;
  const ID = 'weather_cases', KINDS = ['fog', 'rain'];
  const json = x => JSON.stringify(x);
  const cases = state => ((state.dept && state.dept.fixtures) || []).filter(f => f.k === 'case');
  const at = (state, x, y) => cases(state).find(f => f.x === x && f.y === y) || null;
  const roleOf = (state, f) => { const r = ((state.dept && state.dept.rooms) || []).find(q => q.key === f.room); return r ? r.role : null; };
  const on = state => Modules.on(state, ID);
  const flagged = (state, a) => { const sp = a && a.uid !== 'you' ? Packs.speciesFor(state, a) : null; return !!sp && Array.isArray(sp.flags) && sp.flags.includes(ID); };
  const rains = state => ((state.dept && state.dept.surfaces) || []).filter(s => s.kind === 'rain');
  const under = (s, a) => Actors.footprint(a).some(([x, y]) => Grid.covers(s, x, y));
  const fixedOf = a => (a.statuses || []).find(s => s.id === 'fixed') || null;
  const ours = e => e.k === 'surface' && !!e.cause && e.cause.k === 'weather';

  return [
    {
      id: 'weather.cases',
      check(pre, events, post) {
        for (const f of cases(post)) {
          if (f.weather === undefined) continue;
          if (!KINDS.includes(f.weather)) return `the case at ${f.x},${f.y} holds ${json(f.weather)}, not fog or rain`;
          if (f.mimic) return `the mimic ${f.mimic}'s disguise holds ${f.weather}`;
          if (roleOf(post, f) === 'intro') return `the case at ${f.x},${f.y} in the Intro holds ${f.weather}`;
        }
        for (const f of cases(post)) {
          const g = at(pre, f.x, f.y);
          if (g && g.weather !== f.weather) return `the case at ${f.x},${f.y} held ${json(g.weather)} and now holds ${json(f.weather)}`;
        }
        return null;
      },
    },
    {
      id: 'weather.release',
      check(pre, events, post) {
        const out = events.filter(ours), want = [];
        for (const g of cases(pre)) {
          const f = at(post, g.x, g.y);
          if (!g.mimic && g.st === 'shut' && KINDS.includes(g.weather) && f && f.st !== 'shut' && on(pre)) want.push(g);
        }
        if (want.length !== out.length) return `${want.length} case(s) holding weather were opened or broken, and ${out.length} weather(s) got out: ${json(out.map(e => e.cause.case))}`;
        for (const g of want) {
          const e = out.find(q => json(q.cause.case) === json([g.x, g.y]));
          if (!e) return `the ${g.weather} in the case at ${g.x},${g.y} did not get out`;
          if (e.kind !== g.weather || e.x !== g.x || e.y !== g.y || e.size !== N.WEATHER_SIZE || e.turns !== N.WEATHER_TURNS)
            return `the case at ${g.x},${g.y} held ${g.weather} and let out ${e.kind} at ${e.x},${e.y}, ${e.size} a side for ${e.turns} turns`;
          const s = ((post.dept && post.dept.surfaces) || []).find(q => q.kind === e.kind && q.x === e.x && q.y === e.y && q.until === e.turn + 1 + N.WEATHER_TURNS);
          if (!s) return `the ${e.kind} let out at ${e.x},${e.y} on turn ${e.turn} does not lie until turn ${e.turn + 1 + N.WEATHER_TURNS}`;
        }
        return null;
      },
    },
    {
      id: 'weather.stop',
      check(pre, events, post) {
        // Held at least to the end of every rain over it.
        if (on(post)) for (const a of post.actors) {
          if (a.gone || a.uid === 'you' || !flagged(post, a)) continue;
          const over = rains(post).filter(s => under(s, a));
          if (!over.length) continue;
          const end = Math.max(...over.map(s => s.until + N.RAIN_STOP_TURNS)), s = fixedOf(a);
          if (!s || !(s.perm === true || (Number.isInteger(s.until) && s.until >= end))) return `${a.uid} stands in rain, which holds it to turn ${end}, and is ${s ? `fixed until ${s.until}` : 'not fixed'}`;
        }
        // A stop put on in the step: on a flagged exhibit under rain laid in the step, exactly
        // to the latest end over it, or an end it had.
        const laid = events.filter(e => ours(e) && e.kind === 'rain');
        for (const e of events) {
          if (e.k !== 'status' || !e.cause || e.cause.k !== ID) continue;
          if (e.who === 'you') return 'rain stopped you';
          const a = post.actors.find(q => q.uid === e.who), b = pre.actors.find(q => q.uid === e.who);
          if (!a || !flagged(post, a)) return `rain stopped ${e.who}, which is not flagged with ${ID}`;
          if (!e.on || e.id !== 'fixed') return `rain's stop put ${e.on ? 'on' : 'off'} ${e.id} on ${e.who}`;
          if (!laid.some(r => under(r, a))) return `rain stopped ${e.who}, which no rain laid in the step covers`;
          const end = Math.max(...rains(post).filter(s => under(s, a)).map(s => s.until + N.RAIN_STOP_TURNS));
          const had = b && fixedOf(b) && Number.isInteger(fixedOf(b).until) ? fixedOf(b).until : -1, s = fixedOf(a);
          if (!s || s.until !== Math.max(end, had)) return `rain stopped ${e.who} until turn ${s ? s.until : 'none'}, not ${Math.max(end, had)} (rain's end ${end}, and ${had < 0 ? 'no end' : 'an end ' + had} before)`;
        }
        return null;
      },
    },
    {
      id: 'weather.waits',
      check(pre, events, post) {
        if (!on(post)) return null;
        for (const b of pre.actors) {
          if (b.gone || b.uid === 'you' || !flagged(pre, b) || !rains(pre).some(s => under(s, b))) continue;
          const a = post.actors.find(q => q.uid === b.uid);
          if (!a || a.gone || !rains(post).some(s => under(s, a))) continue;
          const did = events.find(e => (e.k === 'moved' && e.who === a.uid && !(e.cause && e.cause.by === 'you')) || (e.k === 'attacked' && e.by === a.uid)
            || (e.k === 'telegraphed' && e.who === a.uid) || (e.k === 'special' && e.who === a.uid && !e.cancelled) || (e.k === 'woke' && e.who === a.uid && e.cause && e.cause.k === 'period'));
          if (did) return `${a.uid} stood in rain and made a ${did.k} event at tick ${did.tick}`;
        }
        return null;
      },
    },
  ];
};
