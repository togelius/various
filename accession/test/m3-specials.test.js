// Criterion 3 of §11 M3 (BUILD.md §8.1, Specials; §6.1): each special's dealt damage to you
// equals its view-model mark taken immediately before the resolving step. Every scenario
// here is played joined-up, with every rule in place and every invariant checked after each
// step (test/behaviour/_harness.js); before each step the view model is derived as the board
// would draw it (with the last step's events), and after it every damaged event on you whose
// cause is a special (`special`, or `reflected` with the special's `sp`) is compared with the
// telegraph mark of the special's owner at (cause.x, cause.y): there must be one, and its
// number must be what you took. The scenarios run for every pack species with a damage
// special (the axis_sniper's beam and the tethered_warden's ring) at depths 1–7:
//   staying in the beam or the ring, or stepping off it;
//   a fast attacker and a slow one;
//   a 300-tick garment equip while a mark is pending, and one begun as the mark is made (R2);
//   two attackers whose marks would overlap (the second is held, R3);
//   a beam sent back by a reflecting dish;
//   your Padding changed by Restoration while a mark is pending;
//   a Re-admission Ticket read while a mark covers the entrance (the mark is called off, R30c).
// Planted faults show the comparison bites: a mark drawn one too high, a special that no
// longer waits for your next decision (notBefore), and your Padding settled before the
// special resolves in the middle of an equip.
module.exports = ({ test, assert, loadCore, root, path }) => {
  const H = require(path.join(root, 'test/behaviour/_harness.js'));
  const C = loadCore();
  const json = JSON.stringify;
  const OPEN = ['############', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '############'];
  const ROW = ['############', '#E.........#', '#..........#', '#..........#', '############'];
  const CORRIDOR = ['##########', '#........#', '##########'];
  const HP = 999;
  const tally = { resolved: 0, runs: 0 };

  const snipers = X => H.species(X, 'axis_sniper'), wardens = X => H.species(X, 'tethered_warden');
  const accOf = (X, sp) => X.Packs.list().find(p => p.species.some(q => q.id === sp.id)).acc;
  const body = (X, sp, depth, at, extra) => Object.assign({ sp: sp.id, at, mode: 'hunting', stats: X.Roles.stats(sp.role, depth) }, extra || {});
  // A room with you at full health of HP, so that every special plays out.
  function room(X, sp, depth, spec) {
    const s = X.Setup.room(1, Object.assign({ acc: accOf(X, sp), depth, map: OPEN, you: [2, 2] }, spec));
    s.actors[0].hp = s.actors[0].maxHp = HP;
    return s;
  }

  // Plays decide(state, vm, i) → action (null to stop) for at most n steps, deriving the view
  // model before each step, with every invariant checked; returns {vms, steps, violations}.
  function drive(X, state, decide, n) {
    const vms = [];
    const r = H.play(X, state, (s, i, ctx) => {
      if (i >= n) return null;
      const vm = X.ViewModel.derive(s, { events: ctx.last });
      const a = decide(s, vm, i);
      if (a) vms.push(vm);
      return a;
    }, { inv: 'all', cap: n + 1 });
    return { vms, steps: r.steps, violations: r.violations, state };
  }
  // Criterion 3 over a played run: every special that struck you equals the mark the view
  // model showed for it on that tile immediately before the step. Returns the problems, and
  // counts the resolutions checked.
  const special = e => e.k === 'damaged' && e.who === 'you' && e.cause && (e.cause.k === 'special' || (e.cause.k === 'reflected' && typeof e.cause.sp === 'string'));
  function compare(r, what) {
    const out = [];
    r.steps.forEach((st, i) => {
      for (const e of st.events.filter(special)) {
        const owner = e.cause.k === 'reflected' ? e.cause.shooter : e.cause.by;
        const m = r.vms[i].marks.find(k => k.kind === 'telegraph' && k.x === e.cause.x && k.y === e.cause.y && k.by === owner);
        if (!m) out.push(`${what}: step ${i} (${json(st.action)}): ${owner}'s ${e.cause.sp} struck you for ${e.amount} at ${e.cause.x},${e.cause.y} with no mark there in the view model before it`);
        else if (m.dmg !== e.amount || e.cause.net !== e.amount) out.push(`${what}: step ${i}: the mark showed ${m.dmg}, the special dealt ${e.amount} (net ${e.cause.net})`);
        else tally.resolved++;
      }
    });
    for (const vm of r.vms) {
      const ids = vm.marks.map(k => k.kind + ':' + k.x + ',' + k.y);
      if (new Set(ids).size !== ids.length) out.push(`${what}: mark ids repeat: ${ids.join(' ')}`);
    }
    if (r.violations.length) out.push(`${what}: ${r.violations[0].text}`);
    tally.runs++;
    return out;
  }
  const hits = r => r.steps.reduce((n, st) => n + st.events.filter(special).length, 0);
  const wait = () => ({ a: 'wait' });
  const onYou = (s, vm) => vm.marks.find(k => k.kind === 'telegraph' && k.x === s.actors[0].x && k.y === s.actors[0].y) || null;
  const resolved = (st, uid) => st.events.some(e => e.k === 'special' && e.who === uid && !e.cancelled);
  const check = list => assert.deepEqual(list, []);

  // The two damage specials, each with where its owner starts and the step that leaves its
  // marks: the beam from 6 tiles along your row (north, off the row); the ring from 2 tiles
  // away within its tether (west, out of the ring round it once it is beside you).
  const SHAPES = {
    line: { list: snipers, at: [8, 2], off: 0 },
    ring: { list: wardens, at: [4, 2], off: 6 },
  };
  const shaped = fn => { for (const [shape, S] of Object.entries(SHAPES)) for (const { sp, depth } of S.list(C)) fn(shape, S, sp, depth); };

  test('the specials scenarios have their species: every pack species with a beam or a ring, at every depth', () => {
    assert.ok(snipers(C).length >= 7 && wardens(C).length >= 7, json([snipers(C).length, wardens(C).length]));
    for (const { sp } of snipers(C).concat(wardens(C))) assert.equal(C.Registry.SPECIALS[C.Registry.ARCHETYPES[sp.archetype].special].effect, 'damage');
  });

  test('staying in a beam or a ring: what resolves on you is the mark shown the moment before', () => {
    const problems = [];
    shaped((shape, S, sp, depth) => {
      const r = drive(C, room(C, sp, depth, { exhibits: [body(C, sp, depth, S.at)] }), wait, 12), what = `${sp.id} d${depth} stays`;
      problems.push(...compare(r, what));
      if (hits(r) < 1) problems.push(`${what}: no ${shape} struck you in 12 turns`);
    });
    check(problems);
  });

  test('stepping off the marked tiles: the special resolves where it was marked, and misses you', () => {
    const problems = [];
    shaped((shape, S, sp, depth) => {
      let left = -1;
      const s = room(C, sp, depth, { exhibits: [body(C, sp, depth, S.at)] });
      const r = drive(C, s, (st, vm, i) => {
        if (left < 0 && onYou(st, vm)) { left = i; return { a: 'move', dir: S.off }; }
        return wait();
      }, 12);
      const what = `${sp.id} d${depth} steps off`;
      problems.push(...compare(r, what));
      if (left < 0) { problems.push(`${what}: no mark ever covered you`); return; }
      // The step off, or the first one after it in which the special went off: it struck
      // the tiles it marked, and you were not on them.
      const k = r.steps.findIndex((st, i) => i >= left && resolved(st, s.actors[1].uid));
      if (k < 0) problems.push(`${what}: the special never went off after you stepped away`);
      else if (r.steps[k].events.some(special)) problems.push(`${what}: it struck you after you stepped off its tiles`);
    });
    check(problems);
  });

  test('a fast attacker and a slow one: a mark is shown before it resolves, however the attacker\'s turns fall', () => {
    const problems = [];
    shaped((shape, S, sp, depth) => {
      // Fast (its steps take half a turn), from off your row or out of reach, so its mark
      // falls between your decisions; slow (slowed: every action takes twice as long), so a
      // mark stays shown over two of your decisions.
      const fast = drive(C, room(C, sp, depth, { exhibits: [body(C, sp, depth, shape === 'line' ? [8, 4] : [4, 3], { speed: 'fast' })] }), wait, 14);
      const slow = drive(C, room(C, sp, depth, { exhibits: [body(C, sp, depth, S.at, { statuses: [{ id: 'slowed', turns: 99 }] })] }), wait, 16);
      problems.push(...compare(fast, `${sp.id} d${depth} fast`), ...compare(slow, `${sp.id} d${depth} slow`));
      for (const [r, how] of [[fast, 'fast'], [slow, 'slow']]) if (hits(r) < 1) problems.push(`${sp.id} d${depth} ${how}: its ${shape} never struck you`);
      const uid = fast.state.actors[1].uid;
      if (!fast.steps.some(st => st.events.some(e => (e.who === uid || e.by === uid) && e.tick % C.N.TICKS_PER_TURN !== 0))) problems.push(`${sp.id} d${depth} fast: it never acted between your turns`);
      // Slow: some mark covered you at two decisions in a row before it went off.
      const twice = slow.vms.some((vm, i) => i > 0 && onYou(slow.state, vm) && onYou(slow.state, slow.vms[i - 1]) && resolved(slow.steps[i], slow.state.actors[1].uid));
      if (!twice) problems.push(`${sp.id} d${depth} slow: no mark was shown at two of your decisions before it went off`);
    });
    check(problems);
  });

  // A 300-tick garment equip (R2), two ways: begun with a mark already on you, so the special
  // resolves during it, through the Padding you had (your stats change once the equip is
  // done, A9); and, for the beam, begun at the tick the sniper marks, so the special waits for
  // your next decision (notBefore) and resolves through the Padding the new garment gives.
  const GARMENT = { uid: 'g2', kind: 'garment', form: 'standard', tier: 3, where: { at: 'tote' } };
  function equipRuns(X, sp, depth, shape) {
    const S = SHAPES[shape], out = [];
    let pad = null;
    const pending = room(X, sp, depth, { exhibits: [body(X, sp, depth, S.at)], items: [GARMENT] });
    out.push({ how: 'pending', r: drive(X, pending, (st, vm, i) => {
      if (pad === null && onYou(st, vm)) { pad = st.actors[0].pad; return { a: 'equip', uid: 'g2' }; }
      return wait();
    }, 12), pad: () => pad });
    if (shape === 'line') {
      const begun = room(X, sp, depth, { exhibits: [body(X, sp, depth, S.at)], items: [GARMENT] });
      out.push({ how: 'begun', r: drive(X, begun, (st, vm, i) => (i === 0 ? { a: 'equip', uid: 'g2' } : wait()), 6) });
    }
    return out;
  }
  test('a 300-tick garment equip while a mark is pending: the special resolves through the Padding the floor showed', () => {
    const problems = [];
    shaped((shape, S, sp, depth) => {
      for (const { how, r, pad } of equipRuns(C, sp, depth, shape)) {
        const what = `${sp.id} d${depth} equip ${how}`;
        problems.push(...compare(r, what));
        const k = r.steps.findIndex(st => st.action.a === 'equip');
        if (k < 0) { problems.push(`${what}: you never equipped`); continue; }
        if (r.steps[k].events.some(e => e.k === 'refused')) { problems.push(`${what}: the equip was refused`); continue; }
        if (how === 'pending') {
          if (!r.steps[k].events.some(special)) problems.push(`${what}: the special did not go off during the equip`);
          if (pad() === r.state.actors[0].pad) problems.push(`${what}: the garment did not change your Padding (${pad()}), so this shows nothing`);
        } else {
          if (!r.steps[k].events.some(e => e.k === 'telegraphed')) problems.push(`${what}: the sniper did not mark during the equip`);
          if (r.steps[k].events.some(special)) problems.push(`${what}: the beam marked during the equip went off before your next decision`);
          if (!r.steps.slice(k + 1).some(st => st.events.some(special))) problems.push(`${what}: the beam never struck you`);
        }
      }
    });
    check(problems);
  });

  test('two attackers whose marks would overlap: the second is held, so no two damage marks ever share a tile', () => {
    const problems = [];
    for (const { sp, depth } of snipers(C)) {
      // Two snipers in your row, one on each side: the first marks a beam through you and on
      // past you, across the second's line, which may not then be marked.
      const s = room(C, sp, depth, { you: [5, 2], exhibits: [body(C, sp, depth, [9, 2]), body(C, sp, depth, [1, 2])] });
      let held = 0, shared = 0;
      const r = drive(C, s, (st, vm) => {
        const [, a, b] = st.actors, tiles = t => new Set(((t && t.tiles) || []).map(q => q.join()));
        if (a.telegraph && b.telegraph) { const A = tiles(a.telegraph); if ([...tiles(b.telegraph)].some(q => A.has(q))) shared++; }
        if (a.telegraph && !b.telegraph && b.mode === 'hunting') held++;
        return wait();
      }, 12);
      const what = `${sp.id} d${depth} two snipers`;
      problems.push(...compare(r, what));
      if (shared) problems.push(`${what}: two damage marks shared a tile`);
      if (!held) problems.push(`${what}: the second sniper was never held by the first one's mark`);
      if (hits(r) < 2) problems.push(`${what}: ${hits(r)} beams struck you`);
    }
    for (const { sp, depth } of wardens(C)) {
      // A warden beside you and a sniper in your row: the ring's tiles and the beam's cross.
      const sn = snipers(C).find(x => x.depth === depth).sp;
      const s = room(C, sp, depth, { acc: accOf(C, sp), exhibits: [body(C, sp, depth, [4, 2]), body(C, sn, depth, [9, 2])] });
      const r = drive(C, s, wait, 14);
      problems.push(...compare(r, `${sp.id} and ${sn.id} d${depth}`));
      for (const vm of r.vms) {
        const dmg = vm.marks.filter(k => k.kind === 'telegraph').map(k => k.x + ',' + k.y);
        if (new Set(dmg).size !== dmg.length) problems.push(`${sp.id} and ${sn.id} d${depth}: two damage marks on one tile`);
      }
      if (hits(r) < 1) problems.push(`${sp.id} and ${sn.id} d${depth}: nothing struck you`);
    }
    check(problems);
  });

  test('a beam sent back by a dish: the beam that strikes you on its way out is the mark you saw; the sniper takes it back', () => {
    const problems = [];
    for (const { sp: dish, depth } of H.species(C, 'reflector')) {
      const sn = snipers(C).find(x => x.depth === depth).sp;
      // You between the sniper and a dish: the beam passes you, turns at the dish, and comes
      // back over you into the sniper. You are struck once, as the mark shows.
      const s = C.Setup.room(1, { acc: accOf(C, dish), depth, map: CORRIDOR, you: [4, 1],
        exhibits: [body(C, dish, depth, [2, 1], { mode: 'dormant', hp: 999 }), body(C, sn, depth, [6, 1])] });
      s.actors[0].hp = s.actors[0].maxHp = HP;
      const r = drive(C, s, wait, 3), what = `${dish.id} and ${sn.id} d${depth}`;
      problems.push(...compare(r, what));
      const mine = r.steps.flatMap(st => st.events.filter(special));
      if (mine.length !== 1) problems.push(`${what}: you were struck ${mine.length} times`);
      const back = r.steps.flatMap(st => st.events.filter(e => e.k === 'damaged' && e.who === s.actors[2].uid && e.cause.k === 'reflected' && e.cause.by === s.actors[1].uid));
      if (back.length !== 1) problems.push(`${what}: the sniper took its own beam back ${back.length} times`);
      // The mark drawn on the sniper's own tile (on the beam's way back) is what you would
      // take there, as every mark is.
      const shown = r.vms.find(vm => vm.marks.some(k => k.kind === 'telegraph')), v = shown && shown.marks.find(k => k.kind === 'telegraph' && k.x === 6 && k.y === 1);
      if (!v) problems.push(`${what}: no mark on the sniper's tile, on the beam's way back`);
    }
    check(problems);
  });

  test('your Padding changed by Restoration while a mark is pending: the mark shows the new number, and that is what resolves', () => {
    const problems = [];
    shaped((shape, S, sp, depth) => {
      const s = room(C, sp, depth, { exhibits: [body(C, sp, depth, S.at, { statuses: [{ id: 'slowed', turns: 99 }] })],
        items: [{ uid: 'rk', kind: 'kit', ref: 'restoration', where: { at: 'tote' } }] });
      let at = -1;
      const r = drive(C, s, (st, vm, i) => {
        if (at < 0 && onYou(st, vm)) { at = i; return { a: 'use', uid: 'rk', on: 'you.g' }; }
        return wait();
      }, 16);
      const what = `${sp.id} d${depth} restore`;
      problems.push(...compare(r, what));
      if (at < 0) { problems.push(`${what}: no mark covered you`); return; }
      if (r.steps[at].events.some(e => e.k === 'refused')) { problems.push(`${what}: the Restoration was refused: ${json(r.steps[at].events[0])}`); return; }
      // The mark before the restore, and the one after it if the special had not yet gone off.
      const before = onYou(s, r.vms[at]), after = at + 1 < r.vms.length && !r.steps[at].events.some(special) ? r.vms[at + 1].marks.find(k => k.kind === 'telegraph' && k.x === before.x && k.y === before.y) : null;
      if (!after) problems.push(`${what}: the special went off during the restore, so the new Padding was never shown`);
      else if (after.dmg !== Math.max(C.N.DMG_MIN_ON_HIT, before.dmg - C.N.RESTORE_PAD) && before.dmg > C.N.DMG_MIN_ON_HIT) problems.push(`${what}: the mark went from ${before.dmg} to ${after.dmg} when your Padding rose by ${C.N.RESTORE_PAD}`);
    });
    check(problems);
  });

  test('a Re-admission Ticket read while a mark covers the entrance: the mark is called off, and it never strikes you there', () => {
    const problems = [];
    for (const { sp, depth } of snipers(C)) {
      // The sniper's beam along the top row covers you and the entrance behind you; the
      // Ticket puts you on the entrance, and the sniper, losing you, calls its mark off.
      const s = room(C, sp, depth, { map: ROW, you: [5, 1], entrance: [1, 1], exhibits: [body(C, sp, depth, [9, 1])],
        items: [{ uid: 'tk', kind: 'consumable', ck: 'ticket', where: { at: 'tote' } }] });
      C.Consumables.startRun(s);
      s.run.knownSeals.push(C.Consumables.sealFor(s, 'ticket'));
      let read = -1;
      const r = drive(C, s, (st, vm, i) => {
        if (read < 0 && vm.marks.some(k => k.kind === 'telegraph' && k.x === 1 && k.y === 1)) { read = i; return { a: 'use', uid: 'tk' }; }
        return wait();
      }, 6);
      const what = `${sp.id} d${depth} Ticket`;
      problems.push(...compare(r, what));
      if (read < 0) { problems.push(`${what}: no mark covered the entrance`); continue; }
      const ev = r.steps[read].events, uid = s.actors[1].uid;
      const off = ev.findIndex(e => e.k === 'special' && e.who === uid && e.cancelled), went = ev.findIndex(e => e.k === 'special' && e.who === uid && !e.cancelled);
      if (off < 0 || (went >= 0 && went < off)) problems.push(`${what}: the mark over the entrance was not called off when the Ticket was read: ${ev.map(e => e.k).join()}`);
      if (ev.some(special)) problems.push(`${what}: you were struck as the Ticket put you on the entrance`);
      const used = ev.find(e => e.k === 'used');
      if (!used || used.cause.x !== 1 || used.cause.y !== 1) problems.push(`${what}: the Ticket did not put you on the entrance: ${json(used)}`);
    }
    check(problems);
  });

  // The comparison bites: three planted faults, each of which a scenario above must catch.
  test('planted faults are caught: a mark drawn one too high, a mark that does not wait for your decision, Padding settled mid-equip', () => {
    const { sp, depth } = snipers(C).find(x => x.depth === 3);
    // 1. A view model whose mark shows one more than the special deals.
    const r = drive(C, room(C, sp, depth, { exhibits: [body(C, sp, depth, SHAPES.line.at)] }), wait, 6);
    assert.deepEqual(compare(r, 'as built'), []);
    for (const vm of r.vms) for (const k of vm.marks) if (k.kind === 'telegraph') k.dmg++;
    assert.ok(compare(r, 'one too high').some(p => /the mark showed/.test(p)), 'a mark one too high is caught');
    // 2. Specials.mark that drops notBefore: the beam marked as your equip begins goes off
    // during it, with no mark shown before the step.
    const X = loadCore(), mark = X.Specials.mark;
    X.Specials.mark = (state, a, id, tiles, ev) => { const c = mark(state, a, id, tiles, ev); a.notBefore = null; return c; };
    const begun = equipRuns(X, sp, depth, 'line').find(e => e.how === 'begun').r;
    assert.ok(compare(begun, 'no notBefore').some(p => /with no mark there/.test(p)), 'a special resolving before your next decision is caught');
    // 3. Your Padding settled as soon as the garment is on, before the special resolves.
    const Y = loadCore(), h = Y.Actions.get('equip'), apply = h.apply;
    h.apply = (state, action, ev) => { const t = apply(state, action, ev); if (typeof t === 'number') Y.Kit.settle(state); return t; };
    const pending = equipRuns(Y, sp, depth, 'line').find(e => e.how === 'pending').r;
    assert.ok(compare(pending, 'settled early').some(p => /the mark showed/.test(p)), 'Padding that changes mid-step is caught');
  });

  test('criterion 3: the resolutions checked', () => {
    assert.ok(tally.resolved > 100, `${tally.resolved} resolutions`);
    console.log(`  criterion 3: ${tally.resolved} special resolutions on you checked against the view model's marks over ${tally.runs} runs, every one equal`);
  });
};
