// ACCESSION — the module copies_weaken (BUILD.md §5.4; M4 plan MO5, D1.4–D1.5; MOD-COPIES): its
// part on the lines of the species flagged with it, "When its group's original is destroyed,
// each spare and any body split from one loses {COPY_WEAKEN_PCT}% of its health and damage,
// never its last point (blows then {weak}), and {COPY_WEAKEN_ACC} Acc, and is slowed until you
// leave", and its panel sentence. Joined up: the real core, real actions only, every invariant
// checked after every step (copies.inv.js among them), clone-checked where it says so. The
// main scenario runs for every pack species whose line carries the part (A.4's Seated Clerk,
// original and spare) at depths 1–7, and is rerun with the module switched off, when it must
// fail (§5.3 check 3). What a spare loses is worked out here from §5.4, not from the module's
// code. Also: who is told (a spare out of view is not), a splitting original that falls only
// with its last body and a spare's split bodies (on a core whose Proposing Trustees are flagged:
// A.4's are not yet, below), a Centrepiece's group (CopiesWeaken.addGroup), the Intro at depth
// 1 where A.4 teaches it, departments with copy groups placed by population, the spare's line
// against its weakened blow, the slowing for the rest of the visit (status_timing's perm), the
// words and the form, and planted faults, each caught.
'use strict';
const H = require('./_harness.js');
module.exports = ({ test, assert, loadCore, root, fs, path }) => {
  const Inv = require(path.join(root, 'tools/invariants.js'));
  const vm = require('node:vm');
  const { coreFiles } = require(path.join(root, 'tools/core-context.js'));
  const C = loadCore();
  const { N, Int, Roles, Packs, Modules, Text, Labels, Status, Actors, CopiesWeaken: CW } = C;
  const json = x => JSON.stringify(x);
  const ID = 'copies_weaken';
  const ok = (results, name) => { const f = H.failures(results); assert.equal(f.length, 0, `${name}:\n${f.slice(0, 5).join('\n')}`); };
  // What §5.4 says a number keeps: it loses COPY_WEAKEN_PCT% of itself, at least 1, never below 1.
  const lose = v => v > 1 ? Math.max(1, v - Math.max(1, Int.pct(v, N.COPY_WEAKEN_PCT))) : v;
  const span = (lo, hi) => lo === hi ? String(lo) : `${lo}–${hi}`;
  // A core whose Proposing Trustees (splitters) are flagged too, as A.4's Seated Clerks are: the
  // pack leaves them out for now, since the spare's line has no room for the part (§5.3's
  // budget; see the trustees' test below), so the splits are shown on these.
  function flaggedCore() {
    const X = loadCore();
    for (const id of ['A4.4', 'A4.4a']) X.Packs.species('A4', id).flags = [ID];
    return X;
  }
  const T = flaggedCore();
  // A copy group's two species for sp, original's and spare's: sp's own and its copy's.
  function pair(X, sp) {
    if (sp.copyOf) return { orig: X.Packs.species('A4', sp.copyOf), spare: sp };
    return { orig: sp, spare: X.Packs.list().flatMap(p => p.species).find(q => q.copyOf === sp.id) };
  }
  // A room of A.4 running its modules (Modules.init, as a department does), you beside the
  // original. exhibits: [{sp, at, group, hp?, mode?}]; set: {uid index → {hp, maxHp}} after the
  // room is made (a plaster cast's init has taken its share by then).
  function room(X, opts, o) {
    const depth = o.depth || 1;
    const exhibits = o.exhibits.map(e => Object.assign({ sp: e.sp.id || e.sp, at: e.at, group: e.group === undefined ? null : e.group, mode: e.mode || 'dormant',
      stats: e.stats || X.Roles.stats((e.sp.role || 'fodder'), depth) }, e.extra || {}));
    const s = H.room(X, opts.seed || 1, { acc: 'A4', depth, map: o.map, you: o.you, exhibits }, { rulesOff: opts.rulesOff, invulnerable: true });
    for (const [i, v] of o.set || []) Object.assign(s.actors[i], v);
    if (o.before) o.before(s);
    X.Modules.init(s, X.Packs.get('A4'));
    return s;
  }
  const OPEN = ['##############', '#............#', '#............#', '#............#', '#............#', '##############'];
  const byUid = (s, uid) => s.actors.find(a => a.uid === uid);
  const numbers = a => ({ maxHp: a.maxHp, hp: a.hp, dmin: a.dmin, dmax: a.dmax, acc: a.acc });
  const weakened = a => { const dmax = lose(a.dmax); return { maxHp: lose(a.maxHp), hp: Math.min(lose(a.maxHp), lose(a.hp)), dmin: Math.min(dmax, lose(a.dmin)), dmax, acc: a.acc - N.COPY_WEAKEN_ACC }; };
  const permSlowed = a => (a.statuses || []).some(s => s.id === 'slowed' && s.perm === true && s.until === null);
  const told = (events, rule) => events.filter(e => e.k === 'module' && e.id === ID && e.rule === rule);

  // ---- The main scenario: an original destroyed, its spares lose heart ----
  // You at (2, 2); the original beside you, asleep with 1 health (your surprise blow destroys it
  // at every depth); its two spares of the same group instance across the room, one of them at
  // 1 health (it keeps its last point); another group instance's original and spare, and an
  // exhibit of no group, which nothing changes.
  const mainRoom = (X, sp, depth, opts) => {
    const g = pair(X, sp);
    return room(X, opts, { depth, map: OPEN, you: [2, 2], exhibits: [
      { sp: g.orig, at: [3, 2], group: 'clerks@s1' },
      { sp: g.spare, at: [7, 1], group: 'clerks@s1' },
      { sp: g.spare, at: [7, 4], group: 'clerks@s1' },
      { sp: g.orig, at: [11, 1], group: 'clerks@s2' },
      { sp: g.spare, at: [11, 4], group: 'clerks@s2' },
      { sp: 'dummy', at: [12, 2], stats: { hp: 9, acc: 1, eva: 0, pad: 0, dmin: 2, dmax: 3 } }],
      set: [[1, { hp: 1, maxHp: 1 }], [3, { hp: 1 }]] });
  };
  const main = H.scenario({
    name: 'its original destroyed, each spare of its group loses COPY_WEAKEN_PCT% of its health and damage (never its last point) and COPY_WEAKEN_ACC Acc, and is slowed for the rest of the visit; nothing else changes',
    id: 'MODULES.copies_weaken', clone: true,
    build: (params, sp, depth, opts) => mainRoom(C, sp, depth, opts),
    actions: (s, i) => i === 0 ? { a: 'attack', uid: s.actors[1].uid } : i < 4 ? { a: 'wait' } : null,
    expect(r, params, sp, depth) {
      const s0 = r.start, [, o, s1, s2, o2, s3, d] = s0.actors, e0 = r.steps[0].events;
      const died = e0.findIndex(e => e.k === 'died' && e.who === o.uid);
      if (died < 0) return 'your blow did not destroy the original';
      // Its spares, in spawn order, each: its module event, then its slowing; no other.
      const mine = e0.filter(e => (e.k === 'module' && e.id === ID) || (e.k === 'status' && e.cause.k === ID));
      const want = [s1, s2].flatMap(b => [['module', 'weaken', b.uid, o.uid], ['status', 'slowed', b.uid, o.uid]]);
      if (json(mine.map(e => [e.k, e.rule || e.id, e.who, e.cause.by])) !== json(want)) return `the step tells ${json(mine.map(e => [e.k, e.rule || e.id, e.who, e.cause.by]))}, not ${json(want)}`;
      if (e0.indexOf(mine[0]) < died) return 'a spare lost heart before its original was destroyed';
      if (mine.some(e => e.k === 'status' && (e.turns !== null || !e.on))) return 'a slowing is not for the rest of the visit';
      // Their numbers: as §5.4 says, from their numbers before.
      const s = r.state;
      for (const b of [s1, s2]) {
        const now = byUid(s, b.uid), was = numbers(b), w = weakened(b);
        for (const k of ['maxHp', 'dmin', 'dmax', 'acc']) if (now[k] !== w[k]) return `${b.uid}: its ${k} went from ${was[k]} to ${now[k]}, not ${w[k]}`;
        if (now.hp > now.maxHp || now.hp < 1) return `${b.uid} has ${now.hp} of ${now.maxHp} health`;
        if (!permSlowed(now)) return `${b.uid} is not slowed for the rest of the visit: ${json(now.statuses)}`;
      }
      // The one at 1 health keeps it.
      if (byUid(s, s2.uid).hp !== 1 || byUid(s, s2.uid).gone) return `the spare at 1 health has ${byUid(s, s2.uid).hp}`;
      // Another group's, and one of no group, as they were.
      for (const b of [o2, s3, d]) {
        const now = byUid(s, b.uid);
        for (const k of ['maxHp', 'dmin', 'dmax', 'acc']) if (now[k] !== b[k]) return `${b.uid}, of no group of the original, changed its ${k}`;
        if ((now.statuses || []).length) return `${b.uid}, of no group of the original, holds ${json(now.statuses)}`;
      }
      // Slowed: its actions take SPEED_SLOW_PCT% of their time.
      const a1 = byUid(s, s1.uid), bare = Object.assign({}, a1, { statuses: [] });
      if (Actors.cost(s, a1, N.COST_STEP, 'act') !== Int.pct(Actors.cost(s, bare, N.COST_STEP, 'act'), N.SPEED_SLOW_PCT)) return 'a slowed spare\'s actions do not take longer';
      // The line states the blow a weakened spare deals: its own, once it has lost heart.
      const blow = span(a1.dmin, a1.dmax);
      if (params.weak !== blow) return `the line says its blows then deal ${params.weak}; a spare that lost heart deals ${blow}`;
      if (!r.clause.includes(`(blows then ${blow})`)) return `the line does not state the weakened blow: "${r.clause}"`;
      const label = Labels.of(s, s1.uid);
      if (!label.behaviour.includes(`(blows then ${blow})`) || !label.pictos.some(p => p.icon === 'damage' && p.text === blow) || !label.pictos.some(p => /^slowed, until you leave$/.test(p.text)))
        return `the label of a spare that lost heart does not read true: ${json([label.behaviour, label.pictos])}`;
      // The log, every spare in view: one line for the two that lost heart, one for their slowing.
      const said = Text.log(e0, Labels.nameOf(s), () => true);
      const lines = ['An original was destroyed, and 2 of its spares lost heart.', `2 spares are now slowed until you leave (each action takes ${N.SPEED_SLOW_PCT}% of its usual time): their original was destroyed.`];
      if (!lines.every(l => said.includes(l))) return `the log says ${json(said)}`;
      return null;
    },
  });
  const list = () => { const l = H.species(C, 'MODULES.copies_weaken'); assert.ok(l.length >= 14, `${l.length} species and depths`); return l; };
  test('an original destroyed: each spare of its group, and no other, loses its share of health and damage (never its last point) and Acc, and is slowed until you leave; the line states its weakened blow; for every pack species with the part at depths 1–7, and failing with the module off', () => {
    assert.deepEqual([...new Set(list().map(x => x.sp.id))], ['A4.1', 'A4.1a']);
    ok(H.sweep(C, main, list()), main.name);
  });

  // ---- Who is told: a spare out of view is not ----
  // A wall between the original's room and one spare: it loses heart as the other does, but the
  // log tells only the one you see; and of three spares, two in view, the line counts two.
  const WALLED = ['##############', '#.......#....#', '#.......#....#', '#.......#....#', '#.......#....#', '##############'];
  const unseen = H.scenario({
    name: 'a spare you cannot see loses heart as any does, and the log never tells it',
    id: 'MODULES.copies_weaken', clone: true,
    build: (params, sp, depth, opts) => { const g = pair(C, sp); return room(C, opts, { depth, map: WALLED, you: [2, 2], exhibits: [
      { sp: g.orig, at: [3, 2], group: 'clerks@s1' }, { sp: g.spare, at: [6, 1], group: 'clerks@s1' }, { sp: g.spare, at: [11, 3], group: 'clerks@s1' }],
      set: [[1, { hp: 1, maxHp: 1 }]] }); },
    actions: [{ a: 'attack', uid: 'A4.1.room.1' }],
    expect(r, params, sp, depth) {
      const [, o, near, far] = r.start.actors, e0 = r.steps[0].events, s = r.state;
      if (o.uid !== 'A4.1.room.1' && depth === 1) return `the original is ${o.uid}`;
      if (told(e0, 'weaken').map(e => e.who).join() !== [near.uid, far.uid].join()) return `${json(told(e0, 'weaken'))} lost heart`;
      const inView = new Set(C.ViewModel.derive(s, {}).actors.map(a => a.uid));
      if (!inView.has(near.uid) || inView.has(far.uid)) return 'the room does not hide the far spare';
      const said = Text.log(e0, Labels.nameOf(s), uid => inView.has(uid)), name = Labels.nameOf(s)(near.uid);
      const want = [`${name.charAt(0).toUpperCase() + name.slice(1)} lost heart: its original was destroyed.`,
        `${name.charAt(0).toUpperCase() + name.slice(1)} is now slowed until you leave (every action takes ${N.SPEED_SLOW_PCT}% of its usual time): the original of its copy group was destroyed.`];
      if (!want.every(l => said.includes(l))) return `the log says ${json(said)}`;
      if (said.some(l => /2 of its spares|2 spares/.test(l))) return `the log counts a spare you cannot see: ${json(said)}`;
      // Not one word of a spare out of view, alone.
      if (Text.log(e0.filter(e => e.who === far.uid), Labels.nameOf(s), uid => inView.has(uid)).length) return 'the log tells the far spare\'s weakening';
      return null;
    },
  });
  test('who is told: a spare out of view loses heart, but the log tells only the spares you see and counts only them', () => {
    const l = list().filter(x => x.depth === 1 || x.depth === 7);
    ok(H.sweep(C, Object.assign({}, unseen, { actions: (s, i) => i === 0 ? { a: 'attack', uid: s.actors[1].uid } : null }), l), unseen.name);
    // Three spares, two in view: "2 of its spares".
    const g = pair(C, Packs.species('A4', 'A4.1a')), s = room(C, {}, { depth: 3, map: WALLED, you: [2, 2], exhibits: [
      { sp: g.orig, at: [3, 2], group: 'clerks@s1' }, { sp: g.spare, at: [6, 1], group: 'clerks@s1' }, { sp: g.spare, at: [6, 4], group: 'clerks@s1' }, { sp: g.spare, at: [11, 3], group: 'clerks@s1' }],
      set: [[1, { hp: 1, maxHp: 1 }]] });
    const r = H.play(C, s, [{ a: 'attack', uid: s.actors[1].uid }]), inView = new Set(C.ViewModel.derive(s, {}).actors.map(a => a.uid));
    assert.deepEqual(r.violations.map(v => v.text), []);
    assert.equal(told(r.events, 'weaken').length, 3);
    const said = Text.log(r.steps[0].events, Labels.nameOf(s), uid => inView.has(uid));
    assert.ok(said.includes('An original was destroyed, and 2 of its spares lost heart.'), json(said));
    assert.ok(said.includes(`2 spares are now slowed until you leave (each action takes ${N.SPEED_SLOW_PCT}% of its usual time): their original was destroyed.`), json(said));
  });

  // ---- Splits (on a core whose Proposing Trustees, splitters, are flagged) ----
  const trustees = () => { const out = []; for (const id of ['A4.4', 'A4.4a']) for (const depth of H.DEPTHS) out.push({ sp: T.Packs.species('A4', id), depth, acc: 'A4' }); return out; };
  // Your surprise blow's damage at a body, after its Padding (it always hits, §8.1).
  const surprise = (X, s, a) => Math.max(N.DMG_MIN_ON_HIT, X.Combat.surpriseRaw(s.actors[0]) - a.pad);
  // Attack the first body standing beside you whose uid passes want; otherwise wait.
  const fight = (X, want) => s => {
    const you = s.actors[0], b = s.actors.find(a => a.uid !== 'you' && !a.gone && want(a.uid) && X.Actors.dist(a, you.x, you.y) <= 1);
    return b ? { a: 'attack', uid: b.uid } : { a: 'wait' };
  };
  const lineOf = (s, uid) => s.actors.filter(a => a.uid === uid || a.uid.startsWith(uid + '/'));

  // A splitting original falls with its last body: the original beside you, asleep, with health
  // enough that your surprise blow leaves it 6 (so it splits); its spare far off. You strike its
  // bodies until none stands.
  const splitOriginal = H.scenario({
    name: 'a splitting original falls with its last body: its spares lose heart then, and not before',
    id: 'MODULES.copies_weaken', clone: true,
    build(params, sp, depth, opts) {
      const g = pair(T, sp);
      return room(T, opts, { depth, map: OPEN, you: [2, 2], exhibits: [
        { sp: g.orig, at: [3, 2], group: 'trustees@s1', stats: T.Roles.stats(g.orig.role, depth) },
        { sp: g.spare, at: [11, 4], group: 'trustees@s1', stats: T.Roles.stats(g.spare.role, depth) }],
        before: s => { const o = s.actors[1], h = surprise(T, s, o) + 6; o.hp = o.maxHp = h; } });
    },
    actions: (s, i) => { const o = s.actors[1].uid; return lineOf(s, o).every(a => a.gone) && i > 0 ? null : fight(T, uid => uid === o || uid.startsWith(o + '/'))(s); },
    cap: 120,
    expect(r) {
      const o = r.start.actors[1], spare = r.start.actors[2];
      const deaths = r.steps.map((st, i) => [i, st.events.filter(e => e.k === 'died' && (e.who === o.uid || e.who.startsWith(o.uid + '/')))]).filter(([, d]) => d.length);
      if (deaths.length < 2) return `the original's line had ${deaths.length} death(s): it never split`;
      const last = deaths[deaths.length - 1][0], when = r.steps.map((st, i) => [i, told(st.events, 'weaken').map(e => e.who)]).filter(([, w]) => w.length);
      if (json(when) !== json([[last, [spare.uid]]])) return `its spare lost heart at steps ${json(when)}; its original's last body fell at step ${last}`;
      if (!lineOf(r.state, o.uid).every(a => a.gone)) return 'a body of the original still stands';
      const now = byUid(r.state, spare.uid), w = weakened(spare);
      return ['maxHp', 'dmin', 'dmax', 'acc'].every(k => now[k] === w[k]) && permSlowed(now) ? null : `the spare is ${json(numbers(now))}, not ${json(w)}`;
    },
  });
  test('a splitting original falls with its last body, at depths 1–7, and not before; with the module off nothing does', () => {
    ok(H.sweep(T, splitOriginal, trustees()), splitOriginal.name);
  });

  // A spare's split bodies: the spare splits before its original falls (both bodies then lose
  // heart), and again after (the new body is made with the weakened numbers, not weakened
  // again, and slowed for the rest of the visit too).
  const splitSpare = H.scenario({
    name: 'each body split from a spare loses heart with it; a body split from it after its original fell is made weakened and is slowed too',
    id: 'MODULES.copies_weaken', clone: true,
    build(params, sp, depth, opts) {
      const g = pair(T, sp);
      return room(T, opts, { depth, map: OPEN, you: [3, 2], exhibits: [
        { sp: g.orig, at: [2, 2], group: 'trustees@s1', stats: T.Roles.stats(g.orig.role, depth) },
        { sp: g.spare, at: [4, 2], group: 'trustees@s1', stats: T.Roles.stats(g.spare.role, depth) }],
        set: [[1, { hp: 1, maxHp: 1 }]],
        before: s => { const b = s.actors[2], h = surprise(T, s, b) + 80; b.hp = b.maxHp = h; } });
    },
    // 1: your surprise blow splits the spare; 2: strike the original until it falls; 3: strike
    // the spare until it splits again.
    actions(s, i) {
      const [, o, b] = s.actors;
      if (i === 0) return { a: 'attack', uid: b.uid };
      if (!o.gone) return fight(T, uid => uid === o.uid)(s);
      return lineOf(s, b.uid).length < 3 ? fight(T, uid => uid === b.uid)(s) : null;
    },
    cap: 120,
    expect(r) {
      const [, o, b] = r.start.actors, s = r.state, half1 = `${b.uid}/1`, half2 = `${b.uid}/2`;
      const fall = r.steps.findIndex(st => st.events.some(e => e.k === 'died' && e.who === o.uid));
      if (fall < 0) return 'the original never fell';
      if (!r.steps[0].events.some(e => e.k === 'woke' && e.who === half1)) return 'your first blow did not split the spare';
      const at = told(r.steps[fall].events, 'weaken').map(e => e.who);
      if (json(at) !== json([b.uid, half1])) return `when the original fell, ${json(at)} lost heart, not the spare and its split body`;
      const made = r.steps.findIndex(st => st.events.some(e => e.k === 'woke' && e.who === half2));
      if (made <= fall) return `the spare's second split came at step ${made}, not after the fall at ${fall}`;
      const second = r.steps[made].events;
      if (json(told(second, 'split').map(e => [e.who, e.cause.by])) !== json([[half2, o.uid]])) return `its body split after the fall was told ${json(told(second, 'split'))}`;
      if (told(second, 'weaken').length) return 'a body was weakened again';
      // (The spare's numbers do not change after its second split, so the end state shows them.)
      const h2 = byUid(s, half2), parent = byUid(s, b.uid);
      if (!permSlowed(h2)) return `the body split after the fall is not slowed for the rest of the visit: ${json(h2.statuses)}`;
      if (['maxHp', 'dmin', 'dmax', 'acc'].some(k => h2[k] !== parent[k])) return `the body split after the fall is ${json(numbers(h2))}, not its parent's ${json(numbers(parent))}`;
      const w = weakened(b);
      if (['maxHp', 'dmin', 'dmax', 'acc'].some(k => parent[k] !== w[k])) return `the spare, weakened once, is ${json(numbers(parent))}, not ${json(w)}`;
      return null;
    },
  });
  test('a spare\'s split bodies lose heart with it, and a body split after its original fell is slowed too, weakened once only, at depths 1–7; with the module off none is', () => {
    ok(H.sweep(T, splitSpare, trustees()), splitSpare.name);
  });

  // ---- A.4's Proposing Trustees, as the pack has them now ----
  // Their lines have no room for the module's part (§5.3: the phone's strip, 14 rows; the
  // spare's line takes all 14 with its four clauses), so the pack does not flag them, and the
  // rule leaves them alone: no line says they lose heart, and none do.
  test('A.4\'s Proposing Trustees are not flagged (no room on the spare\'s line), and the rule leaves them alone; flagged, they would lose heart', () => {
    for (const id of ['A4.4', 'A4.4a']) assert.ok(!(Packs.species('A4', id).flags || []).includes(ID), id);
    for (const [X, want] of [[C, 0], [T, 1]]) {
      const g = pair(X, X.Packs.species('A4', 'A4.4a')), s = room(X, {}, { depth: 2, map: OPEN, you: [2, 2], exhibits: [
        { sp: g.orig, at: [3, 2], group: 'trustees@s1', stats: X.Roles.stats('brute', 2) }, { sp: g.spare, at: [11, 4], group: 'trustees@s1', stats: X.Roles.stats('brute', 2) }],
        set: [[1, { hp: 1, maxHp: 1 }]] });
      const r = H.play(X, s, [{ a: 'attack', uid: s.actors[1].uid }]);
      assert.deepEqual(r.violations.map(v => v.text), []);
      assert.equal(told(r.events, 'weaken').length, want);
      assert.equal(X.Clauses.line(X.Packs.species('A4', 'A4.4a'), { depth: 2 }).includes('lose'), !!want);
    }
  });

  // ---- A Centrepiece's group (CopiesWeaken.addGroup) ----
  const PIECES = ['############', '#..........#', '#..........#', '#..........#', '############'];
  const pieces = (opts, when) => {
    const s = H.room(C, 1, { acc: 'A4', depth: 3, map: PIECES, you: [2, 2], exhibits: [
      { sp: 'dummy', at: [3, 2], mode: 'dormant', stats: { hp: 1, acc: 2, eva: 0, pad: 0, dmin: 2, dmax: 5 } },
      { sp: 'dummy', at: [8, 1], mode: 'dormant', stats: { hp: 12, acc: 2, eva: 0, pad: 0, dmin: 3, dmax: 7 } },
      { sp: 'dummy', at: [8, 3], mode: 'dormant', stats: { hp: 12, acc: 2, eva: 0, pad: 0, dmin: 3, dmax: 7 } }] }, { rulesOff: opts.rulesOff, invulnerable: true });
    const group = { orig: s.actors[1].uid, spares: [s.actors[2].uid, s.actors[3].uid] };
    if (when === 'before') CW.addGroup(s, group);
    Modules.init(s, Packs.get('A4'));
    if (when === 'after') CW.addGroup(s, group);
    return s;
  };
  test('a Centrepiece\'s group (CopiesWeaken.addGroup), made before the module\'s state or after: its original destroyed, its copies lose heart as spares do; with the module off they do not', () => {
    for (const when of ['before', 'after']) for (const off of [false, true]) {
      const s = pieces({ rulesOff: off ? [ID] : [] }, when), before = s.actors.map(a => Object.assign({}, a));
      assert.equal(CW.originalOf(s, s.actors[2]), s.actors[1].uid);
      assert.equal(json(CW.spares(s, s.actors[1].uid).map(a => a.uid)), json(off ? [] : [s.actors[2].uid, s.actors[3].uid]));
      const r = H.play(C, s, [{ a: 'attack', uid: s.actors[1].uid }, { a: 'wait' }], { clone: true });
      assert.deepEqual(r.violations.map(v => v.text), [], `${when}${off ? ', off' : ''}`);
      assert.ok(s.actors[1].gone);
      assert.equal(json(told(r.events, 'weaken').map(e => [e.who, e.cause.by])), json(off ? [] : [[s.actors[2].uid, s.actors[1].uid], [s.actors[3].uid, s.actors[1].uid]]));
      for (const k of [2, 3]) assert.equal(json(['maxHp', 'dmin', 'dmax', 'acc'].map(f => s.actors[k][f])), json(off ? ['maxHp', 'dmin', 'dmax', 'acc'].map(f => before[k][f]) : [lose(12), lose(3), lose(7), 0]));
    }
  });
  test('CopiesWeaken.addGroup refuses what is no copy group: no state, a shape it does not know, no exhibit, a split body, a spare twice, a spare already one, an original as a spare, a spare as an original', () => {
    const s = pieces({}, null), [, o, a, b] = s.actors;
    const no = (g, re, st) => assert.throws(() => CW.addGroup(st || s, g), re, json(g));
    no({ orig: o.uid, spares: [a.uid] }, /needs a state/, {});
    no('planted', /a group is \{orig, spares\}/);
    no({ orig: o.uid, spares: [a.uid], more: 1 }, /no more/);
    no({ orig: 'nobody', spares: [a.uid] }, /no exhibit/);
    no({ orig: 'you', spares: [a.uid] }, /no exhibit/);
    no({ orig: o.uid, spares: [] }, /one spare or more/);
    no({ orig: o.uid, spares: [a.uid, a.uid] }, /twice/);
    no({ orig: o.uid, spares: [o.uid] }, /twice/);
    const split = H.room(C, 1, { acc: 'A4', depth: 1, map: PIECES, you: [2, 2], exhibits: [{ sp: 'dummy', at: [3, 2], uid: 'x.1/1', stats: { hp: 3, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 } }, { sp: 'dummy', at: [5, 2], uid: 'x.2', stats: { hp: 3, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 } }] });
    assert.throws(() => CW.addGroup(split, { orig: 'x.2', spares: ['x.1/1'] }), /split from another/);
    CW.addGroup(s, { orig: o.uid, spares: [a.uid] });
    no({ orig: b.uid, spares: [a.uid] }, /already a spare of/);
    no({ orig: a.uid, spares: [b.uid] }, /itself a spare/);
    no({ orig: b.uid, spares: [o.uid] }, /an original, with spares of its own/);
    assert.equal(CW.addGroup(s, { orig: o.uid, spares: [b.uid] }), undefined);
    assert.equal(json([a.ax.copyOf, b.ax.copyOf]), json([o.uid, o.uid]));
  });

  // ---- The Intro, at depth 1, where A.4 teaches it ----
  // A.4 with a gallery list (empty: the stamp places the Intro's exhibits, clerks@intro), at
  // depth 1: walk to the original, strike it until it falls. Its first blow wakes only the spare
  // within ALLY_HIT_RANGE of it (the stamp's (13, 5), not (13, 7): D-STAMPS' note); when it
  // falls, both spares lose heart, the one still asleep too. Every invariant holds.
  const INTRO = (() => { const X = loadCore(); X.Packs.get('A4').galleries = []; return X; })();
  function walkTo(X, s, goal) {
    return (st, i) => {
      if (i > 150) return null;
      const you = st.actors[0], g = st.actors.find(a => a.uid === goal);
      if (!g || g.gone) return null;
      if (X.Actors.dist(g, you.x, you.y) <= 1) return { a: 'attack', uid: g.uid };
      const d = X.Grid.distances(st.dept, [[g.x, g.y]], 9999, null), at = (x, y) => d[y * st.dept.w + x];
      const moves = X.Step.legal(st).filter(a => a.a === 'move').map(a => [a, at(you.x + X.Grid.DX[a.dir], you.y + X.Grid.DY[a.dir])]).filter(([, v]) => v >= 0)
        .sort((p, q) => (p[1] - q[1]) || (p[0].dir - q[0].dir));
      return moves.length ? moves[0][0] : { a: 'wait' };
    };
  }
  test('in A.4\'s Intro at depth 1 (the stamp\'s clerks@intro): walking to the original and striking it until it falls, its first blow wakes only the nearer spare; both spares lose heart when it falls, the one still asleep too; the log tells those in view', () => {
    let fell = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const s = INTRO.Dept.create(seed, 'A4', 1), clerks = s.actors.filter(a => a.group === 'clerks@intro');
      assert.equal(json(clerks.map(a => a.sp)), json(['A4.1', 'A4.1a', 'A4.1a']), `seed ${seed}`);
      const [o, a, b] = clerks;
      assert.equal(json(INTRO.CopiesWeaken.spares(s, o.uid).map(x => x.uid)), json([a.uid, b.uid]));
      const r = H.play(INTRO, s, walkTo(INTRO, s, o.uid), { cap: 160 });
      assert.deepEqual(r.violations.slice(0, 3).map(v => v.text), [], `seed ${seed}`);
      const k = r.steps.findIndex(st => st.events.some(e => e.k === 'died' && e.who === o.uid));
      assert.ok(k >= 0, `seed ${seed}: the original never fell`);
      fell++;
      const hit = r.steps.findIndex(st => st.events.some(e => e.k === 'damaged' && e.who === o.uid));
      const allyWoke = r.steps[hit].events.filter(e => e.k === 'woke' && e.cause.k === 'ally_hit').map(e => e.who);
      // The first blow wakes the spare within ALLY_HIT_RANGE of it, and only that one, unless the
      // walk had already woken them (then none).
      assert.ok(json(allyWoke) === json([a.uid]) || json(allyWoke) === json([]), `seed ${seed}: the first blow woke ${json(allyWoke)}`);
      assert.ok(INTRO.Grid.disc(a.x - o.x, a.y - o.y, N.ALLY_HIT_RANGE) && !INTRO.Grid.disc(b.x - o.x, b.y - o.y, N.ALLY_HIT_RANGE), `seed ${seed}: the stamp's spares`);
      const e = r.steps[k].events;
      assert.equal(json(told(e, 'weaken').map(x => x.who)), json([a.uid, b.uid]), `seed ${seed}`);
      for (const x of [a, b]) assert.ok(permSlowed(byUid(r.state, x.uid)), `seed ${seed}: ${x.uid}`);
      const inView = new Set(INTRO.ViewModel.derive(r.state, {}).actors.map(x => x.uid)), seen = [a, b].filter(x => inView.has(x.uid)).length;
      const said = INTRO.Text.log(e, INTRO.Labels.nameOf(r.state), uid => inView.has(uid));
      if (seen === 2) assert.ok(said.includes('An original was destroyed, and 2 of its spares lost heart.'), json(said));
      else if (seen === 1) assert.ok(said.some(l => / lost heart: its original was destroyed\.$/.test(l)), json(said));
      else assert.ok(!said.some(l => /lost heart/.test(l)), json(said));
    }
    assert.equal(fell, 6);
  });

  // ---- In departments: copy groups placed by population ----
  // A.4 with a gallery list (fixture galleries, as D-PACKS will give it): the Intro's clerks and
  // a section's, each one instance; a walk that strikes the nearest original until it falls,
  // every invariant checked after every step. Switched off, nothing loses heart.
  const GALLERIES = [
    { key: 'intro', name: 'The Office Counter', contents: [] },
    { key: 's1', name: 'Originals Under Glass', contents: [{ sp: 'A4.1' }, { sp: 'A4.1a', count: 3 }, { sp: 'A4.2' }] },
    { key: 's2', name: 'The Copying Room', contents: [{ sp: 'A4.4' }, { sp: 'A4.4a', count: 2 }, { sp: 'A4.3' }] },
    { key: 'centre', name: 'The Ordinance Hall', contents: [] },
    { key: 'coda', name: 'The Repeal Room', contents: [] },
  ];
  test('in A.4 departments with copy groups placed by population (an instance a room), a walk that strikes each original until it falls weakens its spares, and only its own; every invariant holds; switched off, none', () => {
    const X = loadCore();
    X.Packs.get('A4').galleries = JSON.parse(json(GALLERIES));
    let weakens = 0, groups = 0;
    for (const off of [false, true]) for (let seed = 1; seed <= 4; seed++) {
      const depth = 1 + ((seed * 2 - 1) % 7), s = X.Dept.create(seed, 'A4', depth, { invulnerable: true, rulesOff: off ? [ID] : [] });
      const origs = s.actors.filter(a => a.uid !== 'you' && X.CopiesWeaken.originalOf(s, a) === null && s.actors.some(b => X.CopiesWeaken.originalOf(s, b) === a.uid));
      if (!off) groups += origs.length;
      for (const o of origs) assert.ok(o.group && o.group.includes('@'), `seed ${seed}: ${o.uid}'s group ${o.group}`);
      let target = null;
      const r = H.play(X, s, (st, i) => {
        if (i > 400) return null;
        if (!target || byUid(st, target).gone) { const left = origs.filter(o => !byUid(st, o.uid).gone && (X.Modules.flagged(st, o, ID) || off)); target = left.length ? left[0].uid : null; }
        return target ? walkTo(X, st, target)(st, 0) : null;
      }, { cap: 420 });
      assert.deepEqual(r.violations.slice(0, 3).map(v => v.text), [], `A4 seed ${seed}${off ? ' off' : ''}`);
      const n = told(r.events, 'weaken').length;
      if (off) assert.equal(n, 0); else weakens += n;
    }
    assert.ok(groups >= 8, `${groups} copy groups`);
    assert.ok(weakens >= 8, `${weakens} spares lost heart`);
  });

  // ---- The stand-in (a pack with no gallery list): its groups are the species' ----
  test('in a department placed by the stand-in (no gallery list), the clerks are one group by their species\' group: the original destroyed, its spare loses heart', () => {
    const s = C.Dept.create(1, 'A4', 3, { invulnerable: true }), o = s.actors.find(a => a.sp === 'A4.1'), b = s.actors.find(a => a.sp === 'A4.1a');
    assert.equal(json([o.group, b.group, CW.originalOf(s, b)]), json(['clerks', 'clerks', o.uid]));
    const ev = [];
    C.Combat.die(s, o, { k: 'attack', by: 'you' }, ev);
    assert.equal(json(told(ev, 'weaken').map(e => e.who)), json([b.uid]));
  });

  // ---- The slowing lasts for the rest of the visit (status_timing, amended) ----
  test('a spare that lost heart is slowed for the rest of the visit: status_timing holds it to that (its start, no end, never ending), and catches a planted end, a planted until, a moved start and a perm never put on', () => {
    const g = pair(C, Packs.species('A4', 'A4.1a')), s = room(C, {}, { depth: 2, map: OPEN, you: [2, 2], exhibits: [{ sp: g.orig, at: [3, 2], group: 'g@s' }, { sp: g.spare, at: [11, 4], group: 'g@s' }], set: [[1, { hp: 1, maxHp: 1 }]] });
    const r = H.play(C, s, (st, i) => i === 0 ? { a: 'attack', uid: st.actors[1].uid } : i < 60 ? { a: 'wait' } : null, { inv: ['status_timing'] });
    assert.deepEqual(r.violations.map(v => v.text), []);
    const b = s.actors[2], rec = b.statuses.find(x => x.id === 'slowed');
    assert.equal(json(rec), json({ id: 'slowed', until: null, turns: null, from: rec.from, perm: true }));
    assert.ok(Number.isInteger(rec.from) && s.turn > rec.from + 50 && Status.perm(b, 'slowed') && Status.left(s, b, 'slowed') === null);
    // Planted, each on one step: the invariant reads the state before and after.
    const inv = Inv.select(C, ['status_timing'])[0];
    const check = (pre, events, post) => inv.check(pre, events, post, { actor: post.actors[2], before: pre.actors[2], action: { a: 'wait' }, step: 2 });
    const pre = C.State.clone(s), post = C.State.clone(s);
    assert.equal(check(pre, [], post), null);
    const end = C.State.clone(s); end.actors[2].statuses = [];
    assert.match(check(pre, [{ k: 'status', turn: s.turn, who: b.uid, id: 'slowed', on: false, until: s.turn, cause: { k: 'status', id: 'slowed' } }], end), /for the rest of the visit, ended/);
    const until = C.State.clone(s); until.actors[2].statuses[0].until = s.turn + 3;
    assert.match(check(pre, [], until), /not settled/);
    const moved = C.State.clone(s); moved.actors[2].statuses[0].from = rec.from + 1;
    assert.match(check(pre, [], moved), /moved its start/);
    const fresh = C.State.clone(s); fresh.actors[2].statuses = [];
    const made = C.State.clone(s);
    assert.match(check(fresh, [{ k: 'status', turn: s.turn, who: b.uid, id: 'slowed', on: true, turns: 2, cause: { k: 'status', id: 'slowed' } }], made), /never put on so/);
  });

  // ---- The words ----
  test('its words: the panel sentence, the part on both clerks\' lines at depths 1–7 with the module on, none with it off, every log sentence plain, and its form for the validation log (both rules the form\'s, nothing bespoke)', () => {
    assert.equal(C.Clauses.sentence(ID, { depth: 4 }), `When an original is destroyed, its spares lose heart: each, and any body split from one, loses ${N.COPY_WEAKEN_PCT}% of its health and damage and ${N.COPY_WEAKEN_ACC} Acc, and is slowed until you leave.`);
    for (const id of ['A4.1', 'A4.1a']) for (const depth of H.DEPTHS) {
      const sp = Packs.species('A4', id), s = Roles.stats(sp.role, depth), part = `When its group’s original is destroyed, each spare and any body split from one loses ${N.COPY_WEAKEN_PCT}% of its health and damage, never its last point (blows then ${span(lose(s.dmin), lose(s.dmax))}), and ${N.COPY_WEAKEN_ACC} Acc, and is slowed until you leave.`;
      assert.ok(C.Clauses.line(sp, { depth }).includes(part), `${id} at ${depth}: ${C.Clauses.line(sp, { depth })}`);
      for (const ctx of [{ depth, rulesOff: [ID] }, { depth, modules: [] }]) assert.ok(!/lose|heart|spare/.test(C.Clauses.line(sp, ctx)), `${id} at ${depth}, off: ${C.Clauses.line(sp, ctx)}`);
    }
    // spare:DMG: an original's line states its spares' weakened blow; a species of no copy group has none.
    assert.equal(C.Clauses.value('spare:DMG', Packs.species('A4', 'A4.1'), 5), C.Clauses.value('spare:DMG', Packs.species('A4', 'A4.1a'), 5));
    assert.throws(() => C.Clauses.value('spare:DMG', Packs.species('A4', 'A4.2'), 1), /copy group/);
    assert.throws(() => C.Clauses.value('spare:HP', Packs.species('A4', 'A4.1a'), 1), /only DMG/);
    // The log, one of each and groups of two and seven, in view and not.
    const names = uid => ({ 'x.1': 'the Seated Clerk, Certified Spare', 'x.2': 'the Seated Clerk, Certified Spare' }[uid] || 'an exhibit');
    const w = (rule, who, by) => ({ k: 'module', turn: 2, id: ID, rule, who, cause: { k: ID, by } }), st = (who, by) => ({ k: 'status', turn: 2, who, id: 'slowed', on: true, turns: null, cause: { k: ID, by } });
    assert.equal(Text.event(w('split', 'x.1', 'o.1'), names), 'The Seated Clerk, Certified Spare lost heart too: it split from a spare whose original was destroyed.');
    assert.equal(Text.event(st('x.1', 'o.1'), names), `The Seated Clerk, Certified Spare is now slowed until you leave (every action takes ${N.SPEED_SLOW_PCT}% of its usual time): the original of its copy group was destroyed.`);
    assert.equal(json(Text.log([w('weaken', 'x.1', 'o.1'), st('x.1', 'o.1'), w('weaken', 'x.2', 'o.1'), st('x.2', 'o.1')], names)),
      json(['An original was destroyed, and 2 of its spares lost heart.', `2 spares are now slowed until you leave (each action takes ${N.SPEED_SLOW_PCT}% of its usual time): their original was destroyed.`]));
    assert.equal(json(Text.log([w('weaken', 'x.1', 'o.1'), st('x.1', 'o.1')], names, uid => uid !== 'x.1')), '[]');
    assert.equal(Text.event(Object.assign(w('split', 'x.1', 'o.1'), { who: undefined }), names), null);
    // Its form: two rules of the form's effects, nothing hand-written.
    assert.equal(json(Modules.form(ID)), json({ rules: [{ rule: 'weaken', on: 'died', do: ['tier', 'status'], telegraph: null }, { rule: 'split', on: 'woke', do: ['status'], telegraph: null }], bespoke: [] }));
    assert.ok(!Modules.bespoke().some(b => b.id === ID));
  });

  // ---- Planted faults, each caught ----
  // A core loaded with one source changed (a plant): the scenario at depth 3 (or the test named)
  // must then fail, by its invariants or its expectation. Each change must apply.
  function planted(file, from, to) {
    const ctx = vm.createContext({});
    const names = [];
    let applied = false;
    for (const f of coreFiles()) {
      let src = fs.readFileSync(path.join(root, f), 'utf8');
      if (f === file) { applied = src.includes(from); src = src.replace(from, to); }
      for (const m of src.matchAll(/^const ([A-Z][A-Za-z0-9]*) =/gm)) names.push(m[1]);
      vm.runInContext(src, ctx, { filename: f });
    }
    if (!applied) throw new Error(`the plant does not apply to ${file}: ${from}`);
    const X = vm.runInContext('({' + names.join(',') + '})', ctx);
    for (const id of ['A4.4', 'A4.4a']) X.Packs.species('A4', id).flags = [ID];
    return X;
  }
  const RULE = 'js/core/rules/modules/copies_weaken.js', CL = 'js/core/clauses.js';
  const plants = [
    ['an original falls at its first body\'s death', RULE, 'fallen(state, firstOf(e.who)) ? spares', 'true ? spares', splitOriginal, 'A4.4', /lost heart at steps|no body of|still stands/],
    ['a spare\'s split bodies are not weakened with it', RULE, 'state.actors.filter(b => isExhibit(b) && !b.gone && originalOf', 'state.actors.filter(b => isExhibit(b) && !b.gone && !b.uid.includes(\'/\') && originalOf', splitSpare, 'A4.4a', /lost heart, not the spare|copies.all/],
    ['a body split after the fall is not slowed', RULE, 'return uid !== null && fallen(state, uid)', 'return false && fallen(state, uid)', splitSpare, 'A4.4a', /told|slowed|copies.all/],
    ['the slowing ends after some turns', RULE, "turns: 'perm' }", 'turns: 3 }', main, 'A4.1a', /rest of the visit|copies.loss|status/],
    ['no Acc lost', RULE, 'acc: N.COPY_WEAKEN_ACC }', 'acc: 0 }', main, 'A4.1a', /acc/],
    ['the spares of another group instance lose heart too', RULE, 'b.group === first.group && b.sp === sp.copyOf', 'b.sp === sp.copyOf', main, 'A4.1a', /no group of the original|copies/],
    ['an unflagged group takes part', RULE, 'return !!o && Modules.flagged(state, b, ID) && Modules.flagged(state, o, ID);', 'return !!o;', null, 'trustees', /lost heart|copies.when|weaken/],
    ['the weakening names no original (cause.by)', RULE, 'const byDeath = (state, e) => ({ by: firstOf(e.who) });', 'const byDeath = (state, e) => ({});', main, 'A4.1a', /cause|original|log/],
    ['the line states the blow before the weakening', CL, "const s = Roles.stats(role, depth), a = weakened(s.dmin), b = weakened(s.dmax);", "const s = Roles.stats(role, depth), a = s.dmin, b = s.dmax;", main, 'A4.1a', /blows then/],
  ];
  test('planted faults in the rule, its words and its line are each caught: by its invariants or by its scenarios', () => {
    for (const [what, file, from, to, sc, id, want] of plants) {
      const X = planted(file, from, to);
      if (id === 'trustees') {
        // The pack's trustees, unflagged: none may lose heart.
        X.Packs.species('A4', 'A4.4').flags = []; X.Packs.species('A4', 'A4.4a').flags = [];
        const g = pair(X, X.Packs.species('A4', 'A4.4a')), s = room(X, {}, { depth: 2, map: OPEN, you: [2, 2], exhibits: [
          { sp: g.orig, at: [3, 2], group: 'trustees@s1', stats: X.Roles.stats('brute', 2) }, { sp: g.spare, at: [11, 4], group: 'trustees@s1', stats: X.Roles.stats('brute', 2) }], set: [[1, { hp: 1, maxHp: 1 }]] });
        const r = H.play(X, s, [{ a: 'attack', uid: s.actors[1].uid }]);
        const f = r.violations.map(v => v.text).join('; ') || (told(r.events, 'weaken').length ? 'an unflagged spare lost heart (weaken)' : '');
        assert.ok(f && want.test(f), `${what}: ${f}`);
        continue;
      }
      const sp = X.Packs.species('A4', id), real = id === 'A4.4' || id === 'A4.4a' ? T : C;
      assert.equal(H.run(real, sc, real.Packs.species('A4', id), 3, { seed: 1 }).failure, null, `${what}: the scenario passes on the real core`);
      const f = H.run(X, sc, sp, 3, { seed: 1 }).failure;
      assert.ok(f && want.test(f), `${what}: ${f}`);
    }
    assert.ok(plants.length >= 9, `${plants.length} plants`);
  });
};
