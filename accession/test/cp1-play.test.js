// M4's first integration review, joined-up play and truth (CP1-PLAY): the log tells what the
// rules do, played joined up. Each test fails on the tree before its fix.
//   - An exhibit in an intact case (§8.3) wakes in it and only waits there: woken by a noise
//     or a herald's call it never "set off to look", sent by a noise it "stays in its case",
//     and the modes' timers never have it search where it last knew you were or go back to a
//     place it never left (its causes say how: 'case').
//   - A reflector sends a station's line back as a line (SPECIALS.demo_line's noun), never a
//     "beam".
//   - A chime's line is told once: by its mark's sentence, never also "marked its line at the
//     chime." (Text.toldBy). So is a Wader's alarm: its mark by "shows the alarm", its special
//     and its call by the wakes the call made ("The alarm woke 8 exhibits, and they set off to
//     look where you were."), never also "used its alarm" and "called: … woke (8 exhibits)".
//   - A station's chime is told only while you see the station (Text.seenOnly): chimes come on
//     a schedule in every room of M.11, so the log (and with it every walk and rest, which stop
//     for what the log tells) no longer stops for a station out of sight; its mark still shows
//     on the tiles you see, and its damage to you is told.
//   - Population gives a station the longest line of its room that no other exhibit stands on:
//     a sleeper on it was struck at the first chime and woke hunting you, from a room you may
//     never have seen (41 of 140 M.11 departments within 40 turns of waiting at the entrance).
'use strict';
const H = require('./behaviour/_harness.js');
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const { Setup, Step, Text, Causes, Roles, N } = C;
  const json = x => JSON.stringify(x);
  const tough = { hp: 999, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 };
  const checked = ev => { for (const e of ev) { const bad = Causes.check(e); assert.equal(bad, null, `${bad}: ${json(e)}`); } return ev; };
  const NAMES = uid => uid === 'you' ? 'you' : uid === 'x.1' ? 'the Semaphore Station, Two-Armed' : uid === 'x.2' ? 'the Reflecting Dish, on a Cart' : 'the Seated Clerk of the Ordinance Office';
  const told = (s, ev) => Text.log(ev, C.Labels.nameOf(s), () => true);
  const LOOK = /set off to look|searches where|searched where|is going back/;

  // An open room, a case (v) at (2, 5), plaster dust between it and you, so it never sees you:
  // you strike a fixed dummy beside you at (2, 2), and each blow's soft noise reaches the case
  // 3 walking tiles away (a case is one tile further than its nearest neighbour).
  const ROOM = ['########', '#......#', '#......#', '#......#', '#......#', '#.v....#', '#......#', '#......#', '########'];
  const build = (depth, sp, mode) => {
    const s = Setup.room(1, { acc: 'A4', depth, map: ROOM, you: [2, 2], exhibits: [
      { sp: 'training_dummy', at: [3, 2], mode: 'hunting', stats: { hp: 999, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 }, statuses: [{ id: 'fixed', until: 999 }] },
      { sp, at: [2, 5], mode: mode || 'dormant', stats: Roles.stats('fodder', depth) }] }, { invulnerable: true });
    for (const y of [3, 4]) s.dept.surfaces.push({ kind: 'dust', x: 2, y, size: 1, until: 999, by: null });
    return s;
  };

  test('an encased sleeper woken by noise wakes in its case and stays there: never "set off to look"', () => {
    for (const depth of [1, 4, 7]) {
      const s = build(depth, 'A4.1'), a = s.actors[2];
      assert.ok(C.Cases.encased(s, a), 'it stands in an intact case');
      const all = [];
      for (let i = 0; i < N.PIPS_TO_WAKE && a.mode === 'dormant'; i++) {
        const ev = checked(Step.step(s, { a: 'attack', uid: s.actors[1].uid }));
        all.push(...ev);
      }
      const woke = all.find(e => e.k === 'woke' && e.who === a.uid);
      assert.ok(woke, `depth ${depth}: the noises woke it (${a.mode}, ${a.pips} pips)`);
      assert.equal(json([woke.cause.k, woke.cause.how]), json(['noise', 'case']));
      assert.equal(Text.event(woke, NAMES), 'The Seated Clerk of the Ordinance Office woke in its case: it heard a soft noise.');
      for (const l of told(s, all)) assert.doesNotMatch(l, LOOK, l);
      assert.ok(C.Cases.encased(s, a), 'it is still in its case');
    }
  });

  test('an encased exhibit awake hears a noise and stays in its case; out of your sight its timers never have it search or go back', () => {
    // Awake in its case, sent by a noise: "but stays in its case".
    const s = build(3, 'A4.1', 'awake'), a = s.actors[2];
    a.target = [6, 7];
    const ev = checked(Step.step(s, { a: 'attack', uid: s.actors[1].uid }));
    const alerted = ev.find(e => e.k === 'alerted' && e.who === a.uid);
    assert.ok(alerted, json(ev.map(e => e.k)));
    assert.equal(alerted.cause.how, 'case');
    assert.equal(Text.event(alerted, NAMES), 'The Seated Clerk of the Ordinance Office heard a soft noise 3 tiles away, but stays in its case.');
    // Hunting in its case, you out of its sight behind a wall: the timers run as for any
    // other (m3-modes), and each sentence says it stays in its case.
    const t = Setup.room(1, { acc: 'A4', depth: 3, map: ['##########', '#........#', '#...v....#', '#........#', '######.###', '#........#', '##########'], you: [1, 5],
      exhibits: [{ sp: 'A4.1', at: [4, 2], mode: 'hunting', lastKnown: [6, 4], stats: tough }] });
    const b = t.actors[1], all = [];
    for (let i = 0; i < 40 && b.mode !== 'dormant'; i++) all.push(...checked(Step.step(t, { a: 'wait' })));
    const lost = all.filter(e => e.who === b.uid && e.k === 'lost');
    assert.equal(json(lost.map(e => [e.cause.k, e.cause.how])), json([['out_of_sight', 'case'], ['searched', 'case']]));
    assert.equal(json(lost.map(e => Text.event(e, NAMES))), json([`The Seated Clerk of the Ordinance Office lost you: it has not seen you for ${N.LOSE_TRACK_TURNS} turns, but stays in its case.`,
      'The Seated Clerk of the Ordinance Office gave up looking for you, and stays in its case.']));
    for (const l of told(t, all)) assert.doesNotMatch(l, LOOK, l);
    assert.equal(json([b.x, b.y, b.mode]), json([4, 2, 'dormant']));
    // Awake in its case and left alone: it settles down there, never "is going back".
    const u = Setup.room(1, { acc: 'A4', depth: 3, map: ['##########', '#........#', '#...v....#', '#........#', '######.###', '#........#', '##########'], you: [1, 5],
      exhibits: [{ sp: 'A4.1', at: [4, 2], mode: 'awake', target: [4, 2], stats: tough }] });
    const c = u.actors[1], more = [];
    for (let i = 0; i < 40 && c.mode === 'awake'; i++) more.push(...checked(Step.step(u, { a: 'wait' })));
    const idle = more.find(e => e.who === c.uid && e.k === 'lost');
    assert.equal(json([idle.cause.k, idle.cause.how]), json(['idle', 'case']));
    assert.equal(Text.event(idle, NAMES), `The Seated Clerk of the Ordinance Office is settling down in its case: nothing has disturbed it for ${N.AWAKE_IDLE_TURNS} turns.`);
    // Out of a case, the same timers say what they always said.
    const v = Setup.room(1, { acc: 'A4', depth: 3, map: ['##########', '#........#', '#........#', '#........#', '######.###', '#........#', '##########'], you: [1, 5],
      exhibits: [{ sp: 'A4.1', at: [4, 2], mode: 'hunting', lastKnown: [6, 4], stats: tough }] });
    const free = [];
    for (let i = 0; i < 12; i++) free.push(...checked(Step.step(v, { a: 'wait' })));
    const first = free.find(e => e.k === 'lost');
    assert.equal(first.cause.how, undefined);
    assert.match(Text.event(first, NAMES), /and searches where it last knew you were\.$/);
  });

  test('a herald\'s call wakes an encased sleeper in its case, never sent to look where you were', () => {
    // A.4's Copying-Room Bell (a herald) beside a case holding a sleeping clerk, and a sleeper
    // in the open: the call wakes both; only the one in the open sets off to look.
    const map = ['##############', '#............#', '#............#', '#....v.......#', '#............#', '#............#', '##############'];
    for (const depth of [1, 5]) {
      const s = Setup.room(depth, { acc: 'A4', depth, map, you: [10, 3], exhibits: [
        { sp: 'A4.3', at: [7, 3], mode: 'awake', stats: Roles.stats('support', depth) },
        { sp: 'A4.1', at: [5, 3], mode: 'dormant', stats: tough },
        { sp: 'dummy', at: [5, 5], mode: 'dormant', stats: tough }] }, { invulnerable: true });
      s.actors[0].hp = s.actors[0].maxHp = 999;
      const all = [];
      for (let i = 0; i < 6; i++) all.push(...checked(Step.step(s, { a: 'wait' })));
      const woke = all.filter(e => e.k === 'woke' && e.cause.k === 'herald');
      assert.equal(json(woke.map(e => [e.who, e.cause.how || null])), json([[s.actors[2].uid, 'case'], [s.actors[3].uid, null]]), json(all.map(e => e.k)));
      assert.equal(Text.event(woke[0], NAMES), `The Seated Clerk of the Ordinance Office woke in its case at the call of the Seated Clerk of the Ordinance Office.`);
      assert.match(Text.event(woke[1], NAMES), /, and set off to look where you were\.$/);
    }
  });

  test('a station\'s line sent back by a reflector is told as its line, never a beam', () => {
    const ev = (k, who, cause) => ({ k, turn: 4, tick: 400, who, amount: 4, hp: 8, cause });
    const back = ev('damaged', 'x.1', { k: 'reflected', by: 'x.2', shooter: 'x.1', sp: 'demo_line', gross: 4, pad: 0, net: 4, x: 3, y: 1, from: [3, 2] });
    assert.equal(Text.event(back, NAMES), 'The Reflecting Dish, on a Cart sent the Semaphore Station, Two-Armed’s line back into the Semaphore Station, Two-Armed, which fired it: 4 damage (4 − 0 Padding).');
    const fell = { k: 'died', turn: 4, tick: 400, who: 'x.1', cause: { k: 'reflected', by: 'x.2', shooter: 'x.1', sp: 'demo_line' } };
    assert.equal(Text.event(fell, NAMES), 'The Semaphore Station, Two-Armed broke apart on its own line, sent back by the Reflecting Dish, on a Cart.');
    // A Heliograph's beam (its special has no noun) is still a beam, and a bolt a shot.
    const beam = ev('damaged', 'x.1', { k: 'reflected', by: 'x.2', shooter: 'x.1', sp: 'line', gross: 5, pad: 0, net: 5, x: 3, y: 1, from: [3, 2] });
    assert.match(Text.event(beam, NAMES), /’s beam back into/);
    assert.match(Text.event(ev('damaged', 'x.1', { k: 'reflected', by: 'x.2', shooter: 'x.1', raw: 3, pad: 0, roll: 5, chance: 80 }), NAMES), /’s shot back into/);
  });

  test('a Wader\'s alarm is told once: its mark by the alarm shown, its special and its call by the wakes', () => {
    const W = 'x.1', NAME = uid => uid === W ? 'the Lantern-Crop Wader' : 'the Long-Footed Hopper';
    const m = (rule, more) => Object.assign({ k: 'module', turn: 4, tick: 400, id: 'alarm_network', rule, cause: { k: 'alarm_network' } }, more || {});
    const shown = [{ k: 'hunting', turn: 3, tick: 300, who: W, was: 'awake', cause: { k: 'seen', dist: 4 } },
      { k: 'telegraphed', turn: 3, tick: 300, who: W, sp: 'alarm', tiles: [[5, 3]], cause: { k: 'special', by: W, sp: 'alarm' } }, m('alarm_shown', { who: W, turn: 3, tick: 300 })];
    assert.equal(json(Text.log(shown, NAME, () => true)), json(['The Lantern-Crop Wader saw you and began hunting you.', 'The Lantern-Crop Wader has seen you, and shows the alarm: at its next action it raises it.']));
    const woke = who => ({ k: 'woke', turn: 4, tick: 400, who, was: 'dormant', mode: 'awake', cause: { k: 'alarm', by: W, x: 8, y: 3 } });
    const call = [{ k: 'noise', turn: 4, tick: 400, x: 5, y: 3, cls: 'crash', range: 10, cause: { k: 'alarm', by: W } }, woke('h.1'), woke('h.2'),
      { k: 'special', turn: 4, tick: 400, who: W, sp: 'alarm', cause: { k: 'special', by: W, sp: 'alarm' } }, m('call', { who: W, at: [5, 3], n: 2 })];
    const said = Text.log(call, NAME, () => true);
    assert.ok(said.includes('The alarm woke 2 exhibits, and they set off to look where you were.'), json(said));
    assert.ok(!said.some(l => /used its alarm|called: with a crash/.test(l)), json(said));
    // A call that woke none is told by its own sentence, and so is the special.
    const none = Text.log([call[0], call[3], m('call', { who: W, at: [5, 3], n: 0 })], NAME, () => true);
    assert.ok(none.some(l => /called: with a crash, every exhibit still asleep that could hear, but the Centrepiece, woke \(0 exhibits\)/.test(l)), json(none));
    // Joined up: an S.9 department, you stood in a Wader's sight; the alarm's two steps.
    for (const [seed, depth] of [[12, 4], [5, 1], [3, 3]]) {
      const s = C.Dept.create(seed, 'S9', depth), me = s.actors[0], w = s.actors.find(a => a.arch === 'patrol_guard');
      let put = false;
      for (let r = 3; r <= 5 && !put; r++) for (let dx = -r; dx <= r && !put; dx++) for (let dy = -r; dy <= r && !put; dy++) {
        const x = w.x + dx, y = w.y + dy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !C.Grid.walkable(s.dept, x, y) || C.Actors.at(s, x, y)) continue;
        me.x = x; me.y = y; if (C.AI.sees(s, w)) put = true;
      }
      assert.ok(put, `seed ${seed}: a tile in the Wader's sight`);
      const all = [];
      for (let i = 0; i < 2; i++) { const ev = Step.step(s, { a: 'wait' }); const vm = C.ViewModel.derive(s, {}), inView = new Set(vm.actors.map(a => a.uid)); all.push(...Text.log(ev, C.Labels.nameOf(s), uid => inView.has(uid))); }
      assert.ok(all.some(l => /shows the alarm/.test(l)) && all.some(l => /^The alarm woke \d+ exhibits?/.test(l)) && all.some(l => /raised the alarm/.test(l)), json(all));
      assert.ok(!all.some(l => /marks its own tile for its alarm|used its alarm|called: with a crash/.test(l)), json(all));
    }
  });

  test('a station out of your sight: its chime\'s waking, mark, line and the exhibits its line strikes are not told; the chime is', () => {
    const NAME = uid => uid === 'x.1' ? 'the Semaphore Station, Two-Armed' : 'the Reflecting Dish, on a Cart';
    const at = (k, more) => Object.assign({ k, turn: 10, tick: 1000 }, more);
    const chime = [at('woke', { who: 'x.1', was: 'dormant', mode: 'awake', cause: { k: 'period' } }),
      at('module', { id: 'hourly_demonstration', rule: 'chime', turns: 2, n: 1, cause: { k: 'hourly_demonstration' } }),
      at('module', { id: 'hourly_demonstration', rule: 'line', who: 'x.1', cause: { k: 'hourly_demonstration' } }),
      at('telegraphed', { who: 'x.1', sp: 'demo_line', tiles: [[1, 1]], cause: { k: 'special', by: 'x.1', sp: 'demo_line', gross: 4, due: 1200 } })];
    assert.equal(json(Text.log(chime, NAME, () => false)), json(['The chime sounded: any line marked at it strikes in 2 turns.']));
    assert.equal(Text.log(chime, NAME, () => true).length, 3);
    const off = [at('damaged', { who: 'x.2', amount: 4, hp: 6, cause: { k: 'special', by: 'x.1', sp: 'demo_line', gross: 4, pad: 0, net: 4, x: 1, y: 1, from: [1, 0] } }),
      at('damaged', { who: 'x.1', amount: 4, hp: 8, cause: { k: 'reflected', by: 'x.2', shooter: 'x.1', sp: 'demo_line', gross: 4, pad: 0, net: 4, x: 1, y: 0, from: [1, 1] } }),
      at('special', { who: 'x.1', sp: 'demo_line', hits: ['x.1', 'x.2'], cause: { k: 'special', by: 'x.1', sp: 'demo_line' } })];
    assert.equal(json(Text.log(off, NAME, () => false)), '[]');
    // Its line striking you is told, seen or not; so is an exhibit's own special out of sight (M3's rule).
    const you = at('damaged', { who: 'you', amount: 3, hp: 17, cause: { k: 'special', by: 'x.1', sp: 'demo_line', gross: 4, pad: 1, net: 3, x: 1, y: 1, from: [1, 0] } });
    assert.equal(Text.log([you], NAME, () => false).length, 1);
    assert.equal(Text.log([at('telegraphed', { who: 'x.2', sp: 'ring', tiles: [[1, 1]], cause: { k: 'special', by: 'x.2', sp: 'ring', gross: 4 } })], NAME, () => false).length, 1);
    // Joined up: waiting at M.11's entrance, behind the Intro's shut door, the log names no station.
    for (const [seed, depth] of [[1, 1], [2, 1], [3, 5]]) {
      const s = C.Dept.create(seed, 'M11', depth, { invulnerable: true }), told = [];
      assert.ok(s.actors.some(a => a.arch === 'demonstrator'), 'the stations are placed');
      for (let i = 0; i < 30; i++) { const ev = Step.step(s, { a: 'wait' }); const vm = C.ViewModel.derive(s, {}), inView = new Set(vm.actors.map(a => a.uid)); told.push(...Text.log(ev, C.Labels.nameOf(s), uid => inView.has(uid))); }
      assert.ok(told.some(l => /^The chime sounded/.test(l)), json(told));
      assert.ok(!told.some(l => /Semaphore Station/.test(l)), json(told.filter(l => /Semaphore Station/.test(l))));
    }
  });

  test('a station\'s line runs where no other exhibit stands when its room has such a run, so no sleeper is struck awake at the chime', () => {
    let lines = 0, met = 0, hunted = 0;
    for (let seed = 1; seed <= 42; seed++) {
      const depth = ((seed - 1) % 7) + 1, s = C.Dept.create(seed, 'M11', depth, { invulnerable: true });
      const st = s.actors.filter(a => a.arch === 'demonstrator' && !a.uid.includes('.intro.'));
      const STEP = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }, room = (x, y) => s.dept.roomOf[y] && s.dept.roomOf[y][x];
      const meets = (a, dir) => { let x = a.x + STEP[dir][0], y = a.y + STEP[dir][1]; while (room(x, y) === room(a.x, a.y) && C.Grid.seeThrough(s.dept, x, y)) { if (s.actors.some(b => b !== a && b.x === x && b.y === y)) return true; x += STEP[dir][0]; y += STEP[dir][1]; } return false; };
      let clearRoom = true;
      for (const a of st) {
        lines++;
        if (meets(a, a.route.dir)) { met++; if (['N', 'E', 'S', 'W'].some(d => !meets(a, d))) assert.fail(`seed ${seed}: ${a.uid}'s line (${a.route.dir}) meets an exhibit though another way does not`); clearRoom = false; }
      }
      const ids = new Set(s.actors.filter(a => a.arch === 'demonstrator').map(a => a.uid));
      for (let i = 0; i < 30 && clearRoom; i++) for (const e of Step.step(s, { a: 'wait' })) if (e.k === 'hunting' && e.cause.k === 'damage' && ids.has(e.cause.by)) hunted++;
    }
    assert.ok(lines >= 40 && met <= 2, `${lines} lines, ${met} meeting an exhibit`);
    assert.equal(hunted, 0, 'a station\'s line woke an exhibit hunting you while you waited at the entrance');
  });

  test('a chime\'s line is told once, by its mark: never "marked its line at the chime." beside it', () => {
    const m = (rule, more) => Object.assign({ k: 'module', turn: 6, tick: 600, id: 'hourly_demonstration', rule, cause: { k: 'hourly_demonstration' } }, more || {});
    const mark = { k: 'telegraphed', turn: 6, tick: 600, who: 'x.1', sp: 'demo_line', tiles: [[1, 1], [2, 1]], cause: { k: 'special', by: 'x.1', sp: 'demo_line', gross: 4, due: 800 } };
    const step = [{ k: 'woke', turn: 6, tick: 600, who: 'x.1', was: 'dormant', mode: 'awake', cause: { k: 'period' } }, m('chime', { turns: 2, n: 1 }), m('line', { who: 'x.1' }), mark];
    assert.equal(json(Text.log(step, NAMES, () => true)), json(['The Semaphore Station, Two-Armed woke for the chime.', 'The chime sounded: any line marked at it strikes in 2 turns.',
      'The Semaphore Station, Two-Armed marks 2 tiles for its line: 4 before your Padding, in 2 turns.']));
    // Its own sentence stays, for a step that has no mark of its own to tell it.
    assert.equal(Text.event(m('line', { who: 'x.1' }), NAMES), 'The Semaphore Station, Two-Armed marked its line at the chime.');
    assert.equal(json(Text.log([m('line', { who: 'x.1' })], NAMES, () => true)), json(['The Semaphore Station, Two-Armed marked its line at the chime.']));
    // Another station's mark does not tell it.
    assert.equal(Text.log([m('line', { who: 'x.1' }), Object.assign({}, mark, { who: 'x.2', cause: Object.assign({}, mark.cause, { by: 'x.2' }) })], NAMES, () => true).length, 2);
    // Joined up, in M.11's Intro with its station placed: walk into its room and wait for the
    // chime; the log tells its line once.
    const R = C.Registry, was = {};
    for (const [t, id] of [['MODIFIERS', 'clockwork'], ['TRIGGERS', 'period'], ['ARCHETYPES', 'demonstrator']]) { was[t + id] = R[t][id].ready; if (R[t][id].ready === false) R[t][id].ready = 'unit'; }
    try {
      const s = C.Dept.create(2, 'M11', 1), st = s.actors.find(a => a.sp === 'M11.12');
      assert.ok(st, 'the Intro station is placed');
      // One step along the walk to the tile east of the partition's door (its cut, the entrance
      // row's door), opening it on the way.
      const door = s.actors[0].y, toward = () => {
        const me = s.actors[0], p = C.Path.to(s, st.x + 1, door);
        if (!p || !p.length || (me.x === st.x + 1 && me.y === door)) return null;
        const dx = p[0][0] - me.x, dy = p[0][1] - me.y, legal = Step.legal(s);
        return legal.find(a => a.a === 'move' && C.Grid.DX[a.dir] === dx && C.Grid.DY[a.dir] === dy) || legal.find(a => a.a === 'open' && a.x === p[0][0] && a.y === p[0][1]) || null;
      };
      let lines = [];
      for (let i = 0; i < 60 && !s.over; i++) {
        const ev = Step.step(s, toward() || { a: 'wait' });
        const vm = C.ViewModel.derive(s, {}), inView = new Set(vm.actors.map(a => a.uid));
        const said = Text.log(ev, C.Labels.nameOf(s), uid => inView.has(uid));
        if (ev.some(e => e.k === 'module' && e.rule === 'line' && e.who === st.uid) && inView.has(st.uid)) { lines = said; break; }
      }
      assert.ok(lines.length, 'a chime marked its line in view');
      assert.equal(lines.filter(l => /for its line/.test(l)).length, 1, json(lines));
      assert.ok(!lines.some(l => /marked its line at the chime/.test(l)), json(lines));
    } finally {
      for (const [t, id] of [['MODIFIERS', 'clockwork'], ['TRIGGERS', 'period'], ['ARCHETYPES', 'demonstrator']]) R[t][id].ready = was[t + id];
    }
  });
};
