// ACCESSION — the reflector arena's policies (BUILD.md §10.3; test/arena/reflector.txt): a
// Reflecting Dish (a reflector, M11.4) stands in the way of an artillery piece (a Signal
// Lamp, M11.3); kill the artillery, with a Pin-Driver in your kit. A classic script in the
// hardened core context, seeing only obs (lib.js).
//
//   naive    shoots the artillery with the Pin-Driver whenever it can be aimed at it, through
//            the dish or not, and otherwise walks to it and strikes it, striking whatever
//            stands in its way.
//   counter  reads the labels; it never fires a bolt whose line meets an exhibit that sends
//            shots back, and strikes such a dish down first, then shoots or strikes the
//            artillery.
// Both find the artillery by its label (the exhibit whose Behaviour line says it shoots).
// What each remembers (what the labels said, where it last saw the artillery) is in
// obs.memory.
'use strict';
(() => {
  const SHOOTS = /shoots within (\d+) tiles/;
  const RETURNS = /shots back into whoever fired them/;
  // memory.labels: [{uid, shoots, returns}], what each exhibit's label said, read once.
  function label(obs, uid) {
    const mem = obs.memory;
    if (!mem.labels) mem.labels = [];
    for (const l of mem.labels) if (l.uid === uid) return l;
    const text = obs.read(uid) || '';
    const l = { uid, shoots: SHOOTS.test(text), returns: RETURNS.test(text) };
    mem.labels.push(l);
    return l;
  }
  // The exhibits in view, nearest first, each with what its label says.
  const seen = obs => Obs.hostiles(obs.vm).map(a => ({ a, l: label(obs, a.uid) }));
  // The artillery: in view (the nearest whose label says it shoots), else where it was last
  // seen (memory.gun): {uid, x, y, inView}.
  function artillery(obs, list) {
    const mem = obs.memory, g = list.find(e => e.l.shoots && !e.l.returns);
    if (g) { mem.gun = { uid: g.a.uid, x: g.a.x, y: g.a.y }; return { uid: g.a.uid, x: g.a.x, y: g.a.y, inView: true }; }
    return mem.gun ? { uid: mem.gun.uid, x: mem.gun.x, y: mem.gun.y, inView: false } : null;
  }
  // The legal use of your instrument at (x, y): a Pin-Driver's bolt aimed there.
  const fire = (obs, x, y) => Obs.legalOf(obs, 'use').find(l => l.x === x && l.y === y && l.on === undefined) || null;
  // The exhibits in view on a bolt's line from you to (x, y), before it: [{a, l}].
  function inTheWay(obs, list, x, y) {
    const me = Obs.you(obs.vm), pts = Ranged.bresenham(me.x, me.y, x, y), out = [];
    for (let i = 1; i < pts.length - 1; i++) for (const e of list) if (Obs.dist(e.a, pts[i][0], pts[i][1]) === 0) out.push(e);
    return out;
  }
  // Walk toward (x, y) the way a tap would; if an exhibit stands beside you on the way (the
  // way is shut by it), strike it: {action, reason} or null.
  function walkTo(obs, uid, x, y, why) {
    const vm = obs.vm, me = Obs.you(vm), s = Obs.step(obs, x, y);
    if (s) return { action: s, reason: `steps ${Obs.DIRS[s.dir]} ${why}` };
    // No way round: the way by the tiles alone, and the exhibit beside you on it.
    const m = Obs.board(vm).dept, d = Grid.distances(m, [[x, y]], m.w * m.h, null), here = d[me.y * m.w + me.x];
    for (const a of Obs.hostiles(vm)) {
      if (a.uid === uid || Obs.dist(a, me.x, me.y) !== 1) continue;
      const v = d[a.y * m.w + a.x], hit = Obs.attack(obs, a.uid);
      if (hit && v >= 0 && (here < 0 || v < here)) return { action: hit, reason: `attacks ${a.uid}, which stands in the way to ${uid}` };
    }
    return null;
  }

  Policies.add('reflector', {
    naive: {
      card: {
        summary: 'Goes for the artillery: shoots it with the Pin-Driver whenever the Pin-Driver can be aimed at it, and otherwise walks to it and strikes it, striking whatever stands in its way.',
        rules: ['The artillery is the exhibit whose label says it shoots.',
          'If the artillery is beside you and can be struck, strike it.',
          'Otherwise, if the Pin-Driver can be aimed at it, fire it.',
          'Otherwise take the first step of the way a tap on it would walk; if an exhibit shuts that way beside you, strike it.',
          'Otherwise wait.'],
      },
      decide(obs) {
        const list = seen(obs), g = artillery(obs, list);
        if (!g) return { action: { a: 'wait' }, reason: 'waits: no artillery seen yet' };
        const hit = g.inView ? Obs.attack(obs, g.uid) : null;
        if (hit) return { action: hit, reason: `attacks ${g.uid}, the artillery, beside you` };
        const shot = g.inView ? fire(obs, g.x, g.y) : null;
        if (shot) return { action: shot, reason: `fires the Pin-Driver at ${g.uid}, the artillery, at ${g.x},${g.y}` };
        const w = walkTo(obs, g.uid, g.x, g.y, `toward ${g.uid}, the artillery, at ${g.x},${g.y}`);
        return w || { action: { a: 'wait' }, reason: `waits: no way toward ${g.uid}` };
      },
    },
    counter: {
      card: {
        summary: 'Reads the labels and never shoots into the dish, which would send the bolt back: it strikes the dish down first, then shoots the artillery along a clear line or strikes it.',
        rules: ['Read each exhibit\'s label once: the artillery is the one whose label says it shoots; a dish is one whose label says it sends shots back into whoever fired them.',
          'If a dish in view is beside you and can be struck, strike it.',
          'Otherwise, if a dish is in view, take the first step of the way a tap on the nearest one would walk; if an exhibit shuts that way beside you, strike it.',
          'Otherwise, if the artillery is beside you and can be struck, strike it.',
          'Otherwise, if the Pin-Driver can be aimed at the artillery and no exhibit stands on the bolt\'s line before it, fire it.',
          'Otherwise take the first step of the way a tap on the artillery would walk; if an exhibit shuts that way beside you, strike it.',
          'Otherwise wait.'],
      },
      decide(obs) {
        const list = seen(obs), g = artillery(obs, list);
        const dishes = list.filter(e => e.l.returns);
        for (const e of dishes) {
          const hit = Obs.attack(obs, e.a.uid);
          if (hit) return { action: hit, reason: `attacks ${e.a.uid}, a dish that sends shots back, beside you` };
        }
        if (dishes.length) {
          const e = dishes[0], w = walkTo(obs, e.a.uid, e.a.x, e.a.y, `toward ${e.a.uid}, a dish that sends shots back, to strike it first`);
          if (w) return w;
        }
        if (!g) return { action: { a: 'wait' }, reason: 'waits: no artillery seen yet' };
        const hit = g.inView ? Obs.attack(obs, g.uid) : null;
        if (hit) return { action: hit, reason: `attacks ${g.uid}, the artillery, beside you` };
        const shot = g.inView ? fire(obs, g.x, g.y) : null;
        if (shot) {
          const way = inTheWay(obs, list, g.x, g.y);
          if (!way.length) return { action: shot, reason: `fires the Pin-Driver at ${g.uid}, the artillery, at ${g.x},${g.y}: nothing stands on the bolt's line` };
        }
        const w = walkTo(obs, g.uid, g.x, g.y, `toward ${g.uid}, the artillery, at ${g.x},${g.y}`);
        return w || { action: { a: 'wait' }, reason: `waits: no way toward ${g.uid}` };
      },
    },
  });
})();
