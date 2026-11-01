// The perk offer (BUILD.md §8.7; M4 plan PG-CORE, PR12, D4.11, D4.13): two perks from the
// department's primary family and one from its secondary, a perk you hold offered at rank 2
// where possible; a family with no slice perks (S.9's missing secondary, locks, hazard) filled
// from attrition, then guarded; a family with nothing left filled from the other family, then
// from any family in §8.7's table order; never a perk twice. Shown here:
//   - the families' data agrees with Registry.PERKS and with every pack's claim;
//   - each department's offer with no perks held, over 1,000 draws;
//   - the slots read PERK_OFFER (1 and 2 give other offers than 2 and 1);
//   - hand-worked fallbacks, from §8.7's words;
//   - every combination of the ranks held (3⁸) in each department and a room that is no
//     department, against those rules restated here;
//   - the draws: on perks/<acc>/d<depth> and nowhere else, a local stream, only where a family
//     has more perks than its slots, the same under any switch.
// The expected offers are worked out here from BUILD.md, never from the code.
'use strict';
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const N = C.N, R = C.Registry;
  const json = x => JSON.stringify(x);
  // §8.7's table, in its order.
  const TABLE = [['soft_soles', 'guarded'], ['vanishing_act', 'guarded'], ['light_fingers', 'guarded'], ['single_file', 'swarm'], ['elbow_room', 'swarm'],
    ['duck_and_cover', 'artillery'], ['close_the_distance', 'artillery'], ['second_wind', 'attrition']];
  const FAMS = ['guarded', 'swarm', 'artillery', 'attrition'];
  const famOf = id => TABLE.find(t => t[0] === id)[1];
  const CLAIMS = { S9: ['guarded', null], A4: ['swarm', 'locks'], M11: ['artillery', 'hazard'], T0: [null, null] };
  const OPEN = ['#######', '#.....#', '#######'];
  const room = (acc, perks, o) => {
    const s = C.Setup.room((o && o.seed) || 1, { acc, depth: (o && o.depth) || 2, map: OPEN, you: [1, 1], exhibits: [] }, o && o.options);
    s.run.perks = perks.map(p => ({ id: p[0], rank: p[1] }));
    return s;
  };
  const ids = offer => offer.map(o => o.id);

  test('the families: every perk\'s family holds perks, each in §8.7\'s order, and every pack claims challenge types the families know', () => {
    assert.equal(json(C.PerkFamilies.WITH_PERKS), json(FAMS));
    assert.equal(json(C.PerkFamilies.STAND_IN), json(['attrition', 'guarded']));
    assert.ok(Object.isFrozen(C.PerkFamilies) && Object.isFrozen(C.PerkFamilies.WITH_PERKS));
    for (const id of R.order('PERKS')) assert.ok(FAMS.includes(R.PERKS[id].family), id);
    for (const f of FAMS) assert.ok(R.order('PERKS').some(id => R.PERKS[id].family === f), f);
    // §8.7's table order within each family is the registry's.
    for (const f of FAMS) assert.equal(json(R.order('PERKS').filter(id => R.PERKS[id].family === f)), json(TABLE.filter(t => t[1] === f).map(t => t[0])), f);
    for (const p of C.Packs.list()) {
      assert.ok(C.PerkFamilies.CHALLENGES.includes(p.claim.primary), `${p.acc}'s primary ${p.claim.primary}`);
      assert.ok(p.claim.secondary === null || C.PerkFamilies.CHALLENGES.includes(p.claim.secondary), `${p.acc}'s secondary ${p.claim.secondary}`);
      assert.equal(json([p.claim.primary, p.claim.secondary]), json(CLAIMS[p.acc]), p.acc);
    }
    // A perk of a family the order does not know cannot be offered: the offer says so.
    const X = loadCore();
    X.Registry.define('PERKS', 'planted_perk', { built: 'M4', name: 'Planted', family: 'luck' });
    assert.throws(() => X.Progress.offer(X.Setup.room(1, { acc: 'S9', depth: 1, map: OPEN, you: [1, 1], exhibits: [] })), /planted_perk has the family "luck"/);
  });

  test('each department\'s offer with no perk held, over 1,000 draws: S.9 two of its three guarded and Second Wind; A.4 and M.11 always the same three', () => {
    const pairs = {};
    for (let seed = 1; seed <= 1000; seed++) {
      const depth = ((seed - 1) % 7) + 1;
      const s9 = C.Progress.offer(room('S9', [], { seed, depth }));
      assert.equal(s9.length, 3); assert.ok(s9.every(o => o.rank === 1));
      assert.equal(s9[2].id, 'second_wind');
      assert.ok(famOf(s9[0].id) === 'guarded' && famOf(s9[1].id) === 'guarded' && s9[0].id !== s9[1].id, json(s9));
      assert.ok(TABLE.findIndex(t => t[0] === s9[0].id) < TABLE.findIndex(t => t[0] === s9[1].id), 'in table order');
      const k = ids(s9).join(); pairs[k] = (pairs[k] || 0) + 1;
      assert.equal(json(C.Progress.offer(room('A4', [], { seed, depth }))), json([{ id: 'single_file', rank: 1 }, { id: 'elbow_room', rank: 1 }, { id: 'second_wind', rank: 1 }]));
      assert.equal(json(C.Progress.offer(room('M11', [], { seed, depth }))), json([{ id: 'duck_and_cover', rank: 1 }, { id: 'close_the_distance', rank: 1 }, { id: 'second_wind', rank: 1 }]));
    }
    // Each of the three pairs about a third of the time (333 ± 6 standard deviations of 15).
    const got = Object.keys(pairs).sort();
    assert.equal(json(got), json(['soft_soles,light_fingers,second_wind', 'soft_soles,vanishing_act,second_wind', 'vanishing_act,light_fingers,second_wind']));
    for (const k of got) assert.ok(pairs[k] >= 243 && pairs[k] <= 423, `${k}: ${pairs[k]} of 1000`);
  });

  test('the slots are PERK_OFFER\'s: one primary and two secondary give A.4 a swarm perk, Second Wind and a guarded one', () => {
    // A context of its own, with PERK_OFFER [1, 2] (numbers.js freezes N, not its rows).
    const X = loadCore();
    X.N.PERK_OFFER[0] = 1; X.N.PERK_OFFER[1] = 2;
    const of = (acc, seed) => X.Progress.offer(X.Setup.room(seed, { acc, depth: 1 + (seed % 7), map: OPEN, you: [1, 1], exhibits: [] }));
    const seen = { A4: new Set(), M11: new Set(), S9: new Set() };
    for (let seed = 1; seed <= 60; seed++) {
      // A.4: the one primary slot drawn from swarm's two; the secondary's two from locks' stand-ins.
      const a = of('A4', seed);
      assert.equal(json([famOf(a[0].id), a[1].id, famOf(a[2].id)]), json(['swarm', 'second_wind', 'guarded']), json(a));
      seen.A4.add(a[0].id);
      const m = of('M11', seed);
      assert.equal(json([famOf(m[0].id), m[1].id, famOf(m[2].id)]), json(['artillery', 'second_wind', 'guarded']), json(m));
      seen.M11.add(m[0].id);
      // S.9: guarded, then its missing secondary's two (attrition, then guarded again), the two
      // guarded perks in table order.
      const g = of('S9', seed);
      assert.equal(json([famOf(g[0].id), g[1].id, famOf(g[2].id)]), json(['guarded', 'second_wind', 'guarded']), json(g));
      assert.ok(TABLE.findIndex(t => t[0] === g[0].id) < TABLE.findIndex(t => t[0] === g[2].id), json(g));
      seen.S9.add(g[0].id + g[2].id);
    }
    assert.equal(json([seen.A4.size, seen.M11.size, seen.S9.size]), json([2, 2, 3]), 'drawn where a family has more perks than its slots');
  });

  test('hand-worked fallbacks, from §8.7\'s words', () => {
    const all2 = except => TABLE.map(t => t[0]).filter(id => !except.some(p => p[0] === id)).map(id => [id, 2]).concat(except.filter(p => p[1] > 0));
    const GUARDED = ['soft_soles', 'vanishing_act', 'light_fingers'];
    // [what, acc, held, the offer (a '?' entry is any one perk of the listed ids, at rank 1)]
    const cases = [
      ['S.9 holding Soft Soles: it at rank 2, one other guarded drawn', 'S9', [['soft_soles', 1]], [['soft_soles', 2], ['?', GUARDED.slice(1)], ['second_wind', 1]]],
      ['S.9 holding two guarded at rank 1: both at rank 2, no draw', 'S9', [['soft_soles', 1], ['light_fingers', 1]], [['soft_soles', 2], ['light_fingers', 2], ['second_wind', 1]]],
      ['S.9 holding Light Fingers: it at rank 2, in table order after the one drawn', 'S9', [['light_fingers', 1]], [['?', GUARDED.slice(0, 2)], ['light_fingers', 2], ['second_wind', 1]]],
      ['S.9 with every guarded perk at rank 2: its secondary\'s stand-in (attrition), then any family, swarm first', 'S9', [['soft_soles', 2], ['vanishing_act', 2], ['light_fingers', 2]], [['second_wind', 1], ['single_file', 1], ['elbow_room', 1]]],
      ['S.9 with guarded and attrition spent: any family, swarm then artillery', 'S9', [['soft_soles', 2], ['vanishing_act', 2], ['light_fingers', 2], ['second_wind', 2], ['single_file', 2]], [['elbow_room', 1], ['duck_and_cover', 1], ['close_the_distance', 1]]],
      ['A.4 holding Single File at rank 2: Elbow Room, then the other family (locks → attrition), then guarded drawn', 'A4', [['single_file', 2]], [['elbow_room', 1], ['second_wind', 1], ['?', GUARDED]]],
      ['A.4 with swarm and attrition spent: all three guarded, no draw', 'A4', [['single_file', 2], ['elbow_room', 2], ['second_wind', 2]], [['soft_soles', 1], ['vanishing_act', 1], ['light_fingers', 1]]],
      ['A.4, swarm and attrition spent, Vanishing Act held: it at rank 2 among them', 'A4', [['single_file', 2], ['elbow_room', 2], ['second_wind', 2], ['vanishing_act', 1]], [['soft_soles', 1], ['vanishing_act', 2], ['light_fingers', 1]]],
      ['A.4 holding Second Wind: it at rank 2 for locks', 'A4', [['second_wind', 1]], [['single_file', 1], ['elbow_room', 1], ['second_wind', 2]]],
      ['M.11 holding Duck and Cover: it at rank 2, still in table order', 'M11', [['duck_and_cover', 1]], [['duck_and_cover', 2], ['close_the_distance', 1], ['second_wind', 1]]],
      ['M.11 holding Second Wind at rank 2: hazard → attrition spent → guarded, drawn', 'M11', [['second_wind', 2]], [['duck_and_cover', 1], ['close_the_distance', 1], ['?', GUARDED]]],
      ['M.11 with artillery spent: the other family (hazard → attrition, then guarded)', 'M11', [['duck_and_cover', 2], ['close_the_distance', 2]], [['second_wind', 1], ['?', GUARDED], ['?', GUARDED]]],
      ['one perk left: shown alone', 'M11', all2([['light_fingers', 1]]), [['light_fingers', 2]]],
      ['two perks left: shown as they are', 'S9', all2([['elbow_room', 0], ['second_wind', 1]]), [['second_wind', 2], ['elbow_room', 1]]],
      ['none left: none', 'A4', all2([]), []],
      ['a room that is no department claims no family: attrition, then guarded', 'T0', [], [['second_wind', 1], ['?', GUARDED], ['?', GUARDED]]],
    ];
    for (const [what, acc, held, want] of cases) for (let seed = 1; seed <= 40; seed++) {
      const got = C.Progress.offer(room(acc, held, { seed }));
      assert.equal(got.length, want.length, `${what} (seed ${seed}): ${json(got)}`);
      want.forEach(([id, r], i) => {
        if (id === '?') assert.ok(r.includes(got[i].id) && got[i].rank === 1, `${what} (seed ${seed}): ${json(got)}`);
        else assert.equal(json(got[i]), json({ id, rank: r }), `${what} (seed ${seed}): ${json(got)}`);
      });
      assert.equal(new Set(ids(got)).size, got.length, `${what}: a perk twice`);
    }
  });

  // §8.7's rules, restated: a slot's families in the order it tries them (own, or attrition then
  // guarded for a family with no perks; the other family the same way; any, in table order).
  const chainOf = (own, other) => {
    const out = [];
    for (const f of [...(FAMS.includes(own) ? [own] : ['attrition', 'guarded']), ...(FAMS.includes(other) ? [other] : ['attrition', 'guarded']), ...FAMS]) if (!out.includes(f)) out.push(f);
    return out;
  };
  function problems(acc, held, got) {
    const rank = id => { const p = held.find(q => q[0] === id); return p ? p[1] : 0; };
    const left = TABLE.map(t => t[0]).filter(id => rank(id) < 2);
    const [P, S] = CLAIMS[acc];
    const chains = [chainOf(P, S), chainOf(P, S), chainOf(S, P)];
    if (got.length !== Math.min(3, left.length)) return `${got.length} perks, with ${left.length} left`;
    const used = [];
    for (let i = 0; i < got.length; i++) {
      const o = got[i];
      if (!left.includes(o.id) || o.rank !== rank(o.id) + 1) return `${json(o)} held at ${rank(o.id)}`;
      if (used.includes(o.id)) return `${o.id} twice`;
      // The slot's family is the first of its chain with a perk no slot before it took.
      const fam = chains[i].find(f => left.some(id => famOf(id) === f && !used.includes(id)));
      if (famOf(o.id) !== fam) return `slot ${i + 1} is ${o.id} (${famOf(o.id)}), not of ${fam}`;
      used.push(o.id);
    }
    // Within a family: every perk held at rank 1 before any not held, and in table order.
    for (const f of FAMS) {
      const mine = got.filter(o => famOf(o.id) === f);
      const heldLeft = left.filter(id => famOf(id) === f && rank(id) === 1);
      if (mine.some(o => rank(o.id) === 0) && heldLeft.some(id => !mine.some(o => o.id === id))) return `${f}: a perk not held offered while one held at rank 1 is not`;
      const order = mine.map(o => TABLE.findIndex(t => t[0] === o.id));
      if (order.some((v, i) => i && v < order[i - 1])) return `${f}: not in table order`;
    }
    return null;
  }

  test('every combination of the ranks held, in each department and a room that is no department: §8.7\'s rules hold, the offer repeatable', () => {
    let n = 0, sizes = [0, 0, 0, 0];
    for (const acc of ['S9', 'A4', 'M11', 'T0']) for (let code = 0; code < 6561; code++) {
      const held = [];
      let c = code;
      for (const [id] of TABLE) { const r = c % 3; c = (c - r) / 3; if (r) held.push([id, r]); }
      const s = room(acc, held, { seed: 1 + (code % 97), depth: 1 + (code % 7) });
      const got = C.Progress.offer(s);
      const bad = problems(acc, held, got);
      if (bad) assert.fail(`${acc} holding ${json(held)}: ${bad}: ${json(got)}`);
      assert.equal(json(C.Progress.offer(s)), json(got));
      sizes[got.length]++; n++;
    }
    assert.equal(n, 4 * 6561);
    // Every size is met: empty (all at rank 2), one, two and three.
    assert.ok(sizes.every(k => k > 0), json(sizes));
  });

  test('the draws: on perks/<acc>/d<depth> alone, a local stream that the state never stores, only where a family has more perks than slots', () => {
    const X = loadCore(), paths = [];
    const stream = X.Rng.stream;
    X.Rng.stream = (holder, p) => { paths.push([p, holder.seed, holder === null || holder.rng && Object.keys(holder.rng).length]); return stream(holder, p); };
    const make = (acc, depth, seed, held) => {
      const s = X.Setup.room(seed, { acc, depth, map: OPEN, you: [1, 1], exhibits: [] });
      s.run.perks = (held || []).map(p => ({ id: p[0], rank: p[1] }));
      return s;
    };
    for (const [acc, depth, seed] of [['S9', 3, 11], ['S9', 7, 2], ['A4', 5, 3], ['M11', 1, 9]]) {
      const s = make(acc, depth, seed), rng = json(s.rng), h = X.State.hash(s);
      paths.length = 0;
      const ev = [];
      X.Progress.award(s, 'view', { k: 'view' }, ev);
      assert.equal(json(s.rng), rng, 'nothing stored in state.rng');
      const drew = paths.map(p => p[0]);
      assert.equal(json(drew), json(acc === 'S9' ? [`perks/${acc}/d${depth}`] : []), `${acc} d${depth}`);
      for (const p of paths) assert.equal(json(p.slice(1)), json([seed, 0]), 'seeded from the run\'s seed, on a holder of its own');
      // Offer reads and changes nothing.
      const t = make(acc, depth, seed);
      paths.length = 0;
      X.Progress.offer(t); X.Progress.offer(t);
      assert.equal(X.State.hash(t), h);
    }
    // A.4 with Single File spent draws the guarded slot there too.
    paths.length = 0;
    X.Progress.offer(make('A4', 4, 5, [['single_file', 2]]));
    assert.equal(json(paths.map(p => p[0])), json(['perks/A4/d4']));
    X.Rng.stream = stream;
    // The seed and the depth move S.9's draw; the same three give the same offer.
    const of = (seed, depth) => json(C.Progress.offer(room('S9', [], { seed, depth })));
    const seen = new Set();
    for (let seed = 1; seed <= 30; seed++) { seen.add(of(seed, 2)); assert.equal(of(seed, 2), of(seed, 2)); }
    assert.equal(seen.size, 3);
    const byDepth = new Set();
    for (let depth = 1; depth <= 7; depth++) byDepth.add(of(5, depth));
    assert.ok(byDepth.size > 1, 'the depth names the stream');
    // The same offer under any switch: switching a perk or a module off does not move it.
    for (let seed = 1; seed <= 30; seed++) for (const off of [['soft_soles'], ['second_wind', 'unobserved_motion']]) {
      assert.equal(json(C.Progress.offer(room('S9', [['vanishing_act', 1]], { seed, options: { rulesOff: off } }))), json(C.Progress.offer(room('S9', [['vanishing_act', 1]], { seed }))));
    }
  });
};
