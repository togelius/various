// Invariants of the modes, movement and the plodder (BUILD.md §8.2; js/core/rules/ai.js,
// js/core/rules/doors.js), checked after every step of every scenario, monkey, soak and bot
// run (tools/invariants.js). Each states a rule of §8.2 that must hold for every exhibit,
// whatever its archetype:
//   modes_known                 an exhibit is in one of the six modes;
//   modes_dormant_never_acts    an exhibit asleep before and after a step, and not woken
//                               during it, took no action (its acts and next are unchanged,
//                               and it struck and marked nothing);
//   modes_no_staff_door         no exhibit stands on a staff door, open or closed;
//   modes_homeless_stays_awake  an exhibit with no home is never returning or reinstalling;
//   modes_reinstall_at_home     an exhibit starts reinstalling only on its home tile;
//   modes_search_after_out_of_sight
//                               a hunter searches for having lost you only after
//                               AI.loseTrackTurns turns without seeing you;
//   modes_exhibit_steps         every step an exhibit takes is one step of the exhibits'
//                               walking rule (Grid.canStep(…, 'exhibit') for its footprint);
//   plodder_one_thing           a plodder makes one step or one blow per action (or opens a
//                               door), each blow a melee blow from beside its target, and
//                               never marks a special.
module.exports = (C) => {
  const { Grid, Wake, AI } = C;
  const exhibit = a => a.uid !== 'you';
  const mine = (events, uid) => events.filter(e => e.who === uid || e.by === uid);
  // A step taken by a mover itself (Step.moveInto) is a moved event with no cause; anything
  // that moves an actor otherwise must give its moved event a cause.
  const isStep = e => e.k === 'moved' && e.cause === undefined;
  const dirOf = (dx, dy) => { for (let d = 0; d < 8; d++) if (Grid.DX[d] === dx && Grid.DY[d] === dy) return d; return -1; };

  return [
    {
      id: 'modes_known',
      applies: exhibit,
      check: (pre, events, post, ctx) => Wake.MODES.includes(ctx.actor.mode) ? null : `its mode is ${JSON.stringify(ctx.actor.mode)}, not one of ${Wake.MODES.join(', ')}`,
    },
    {
      id: 'modes_dormant_never_acts',
      applies: exhibit,
      check(pre, events, post, ctx) {
        const a = ctx.actor, b = ctx.before;
        if (!b || b.mode !== 'dormant' || a.mode !== 'dormant') return null;
        const own = mine(events, a.uid);
        if (own.some(e => e.k === 'woke')) return null;
        if (a.acts !== b.acts) return `it slept through the step, yet its count of actions went from ${b.acts} to ${a.acts}`;
        if (a.next !== b.next) return `it slept through the step, yet its next action moved from ${b.next} to ${a.next}`;
        const did = own.find(e => (e.k === 'attacked' && e.by === a.uid) || (e.k === 'telegraphed' && e.who === a.uid));
        return did ? `it slept through the step, yet it ${did.k === 'attacked' ? 'struck' : 'marked a special'} at tick ${did.tick}` : null;
      },
    },
    {
      id: 'modes_no_staff_door',
      applies: exhibit,
      check(pre, events, post, ctx) {
        const a = ctx.actor;
        if (a.gone) return null;
        const s = a.size || 1;
        for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
          const ch = Grid.ch(post.dept, a.x + dx, a.y + dy);
          if (ch === 'S' || ch === 's') return `it stands on a staff door (${ch}) at ${a.x + dx},${a.y + dy}`;
        }
        return null;
      },
    },
    {
      id: 'modes_homeless_stays_awake',
      applies: exhibit,
      check: (pre, events, post, ctx) => ctx.actor.home === null && (ctx.actor.mode === 'returning' || ctx.actor.mode === 'reinstalling')
        ? `it has no home, yet it is ${ctx.actor.mode}` : null,
    },
    {
      id: 'modes_reinstall_at_home',
      applies: exhibit,
      check(pre, events, post, ctx) {
        const a = ctx.actor, b = ctx.before;
        if (a.gone || a.mode !== 'reinstalling' || (b && b.mode === 'reinstalling')) return null;
        return AI.atHome(a) ? null : `it began reinstalling at ${a.x},${a.y}, away from its home ${JSON.stringify(a.home)}`;
      },
    },
    {
      id: 'modes_search_after_out_of_sight',
      applies: exhibit,
      check(pre, events, post, ctx) {
        const a = ctx.actor, b = ctx.before;
        for (const e of events) {
          if (e.k !== 'lost' || e.who !== a.uid || e.to !== 'searching' || !e.cause || e.cause.k !== 'out_of_sight') continue;
          const need = AI.loseTrackTurns(post, a);
          if (e.from !== 'hunting') return `it began searching for losing you while ${e.from}, not hunting`;
          if (!(e.cause.turns >= need)) return `it began searching after ${e.cause.turns} turns out of sight, before ${need}`;
          if (b && b.mode === 'hunting' && e.turn - b.stim < need) return `it began searching at turn ${e.turn}, ${e.turn - b.stim} turns after it last saw you, before ${need}`;
        }
        return null;
      },
    },
    {
      id: 'modes_exhibit_steps',
      applies: exhibit,
      check(pre, events, post, ctx) {
        const a = ctx.actor, s = a.size || 1;
        for (const e of events) {
          if (!isStep(e) || e.who !== a.uid) continue;
          const dx = e.to[0] - e.from[0], dy = e.to[1] - e.from[1], d = dirOf(dx, dy);
          if (d < 0) return `it moved from ${e.from} to ${e.to}, which is not one step`;
          for (let ty = 0; ty < s; ty++) for (let tx = 0; tx < s; tx++)
            if (!Grid.canStep(post.dept, e.from[0] + tx, e.from[1] + ty, d, 'exhibit')) return `its step from ${e.from} to ${e.to} breaks the exhibits' walking rule`;
        }
        return null;
      },
    },
    {
      id: 'plodder_one_thing',
      applies: a => exhibit(a) && a.arch === 'plodder',
      check(pre, events, post, ctx) {
        const a = ctx.actor;
        if (!ctx.before) return null;
        // Where every actor stood as the step went, from the start and the steps in order.
        const at = {};
        for (const p of pre.actors) at[p.uid] = { x: p.x, y: p.y, size: p.size || 1 };
        const acted = new Set();
        for (const e of events) {
          if (e.k === 'moved' && at[e.who]) { at[e.who].x = e.to[0]; at[e.who].y = e.to[1]; }
          const one = (isStep(e) && e.who === a.uid) || (e.k === 'attacked' && e.by === a.uid) || (e.k === 'opened' && e.who === a.uid);
          if (e.k === 'telegraphed' && e.who === a.uid) return `a plodder marked a special (${e.sp})`;
          if (!one) continue;
          if (acted.has(e.tick)) return `it did two things in one action, at tick ${e.tick}`;
          acted.add(e.tick);
          if (e.k === 'attacked') {
            if (!e.how || e.how.kind !== 'melee') return `it attacked with a ${e.how && e.how.kind}, not a blow`;
            const me = at[a.uid], it = at[e.at];
            if (it && C.Actors.between(me, it) !== 1) return `it struck ${e.at} from ${me.x},${me.y}, not from beside it`;
          }
        }
        return null;
      },
    },
  ];
};
