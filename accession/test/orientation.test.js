// The Orientation (BUILD.md §8.9, §7.2): its room (content/orientation.js) is built by the real
// rules and passes every check the battery makes after every step; its teacher
// (js/ui/teacher.js) is pure, only reads, and is followed to the end by a sensible player, in
// order and out of it; every sentence has its three forms, in each input's own words, and
// every rule it states with a number is the rule as the numbers of record and play give it.
module.exports = ({ test, assert, loadCore, root, fs, path }) => {
  const C = loadCore(['js/ui/teacher.js']);
  const { Orientation, Teacher, Step, ViewModel, Path, Actors, Vision, Clock, State, Setup, Packs, Labels, N } = C;
  const Battery = require(path.join(root, 'tools/battery.js'));
  const F = Orientation.facts();
  const json = v => JSON.stringify(v);

  // ---- A player: actions from Step.legal, a selection kept as the interface keeps it ----

  const you = s => s.actors[0];
  const legal = (s, pred) => Step.legal(s).find(pred) || null;
  // A step towards (x, y) along a walking path (into an exhibit there, a blow), or null.
  function toward(s, x, y) {
    const me = you(s), p = Path.to(s, x, y);
    if (!p.length) return null;
    const d = Path.dirTo([me.x, me.y], p[0]);
    return d < 0 ? null : { a: 'move', dir: d };
  }
  // A free floor tile beside (x, y) that you can walk to, nearest by path first.
  function besideOf(s, x, y) {
    let best = null;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const tx = x + dx, ty = y + dy, me = you(s);
      if (tx === me.x && ty === me.y) return [tx, ty];
      const p = Path.to(s, tx, ty);
      if (p.length && (!best || p.length < best.n)) best = { at: [tx, ty], n: p.length };
    }
    return best ? best.at : null;
  }
  const sleeperOf = s => Actors.byUid(s, F.sleeper);
  const besideIt = (s, a) => Step.adjacent(s, you(s), a);
  // The parts of the room a player goes for: the sleeper (bump it until it falls), the case
  // (stand beside it, open it, take what it holds), the exit (walk onto it, leave).
  const fight = s => { const a = sleeperOf(s); return a && !a.gone ? toward(s, a.x, a.y) : null; };
  function doCase(s) {
    const [cx, cy] = F.case, me = you(s), open = legal(s, l => l.a === 'open' && l.x === cx && l.y === cy);
    if (open) return open;
    const take = legal(s, l => l.a === 'take' && l.uid === F.item);
    if (take) return take;
    if (s.items.find(i => i.uid === F.item).where.at !== 'case') return null;
    const b = besideOf(s, cx, cy);
    return b && !(b[0] === me.x && b[1] === me.y) ? toward(s, b[0], b[1]) : null;
  }
  function doLeave(s) {
    const me = you(s);
    if (me.x === F.exit[0] && me.y === F.exit[1]) return legal(s, l => l.a === 'leave');
    return toward(s, F.exit[0], F.exit[1]);
  }

  // Plays the room with policy(s, mem, ui) → an action, or null having changed only ui (the
  // selection, as a tap or x does). After every step the battery's checks run (plain data,
  // causes, sentences, the Behaviour-line invariants, the recap of a death) and the teacher
  // looks at the view model main.js would draw (opts.unchecked: the teacher only, where other
  // tests have run the checks on the same play). Returns the state, the teacher's memory, the
  // steps it showed in order, every problem the checks found, and the actions taken.
  function play(policy, opts) {
    opts = opts || {};
    const s = opts.state || Orientation.create(), checks = Battery.checks(C), problems = [], shown = [], actions = [];
    let mem = Teacher.start(F), ev = [];
    const ui = { selection: null }, when = {};
    const look = () => {
      ui.coach = Teacher.target(mem);
      const vm = ViewModel.derive(s, ui);
      mem = Teacher.observe(mem, vm, ev);
      for (const k of Object.keys(mem.seen)) if (mem.seen[k] && !(k in when)) when[k] = actions.length;
      const i = Teacher.step(mem);
      if (shown[shown.length - 1] !== i) shown.push(i);
    };
    look();
    for (let n = 0; n < (opts.max || 400) && !s.over; n++) {
      const a = policy(s, mem, ui);
      if (!a) { look(); if (opts.idle && opts.idle(s, mem, ui)) break; continue; }
      const pre = opts.unchecked ? null : State.clone(s);
      ev = Step.step(s, a);
      actions.push(a);
      if (pre) for (const p of checks.check(pre, a, ev, s)) problems.push(`${p.id}: ${p.text}`);
      look();
    }
    return { s, mem, shown, problems, actions, when };
  }
  // A sensible player who does what the coach asks, in order.
  function obedient(s, mem, ui) {
    const id = (Teacher.STEPS[Teacher.step(mem)] || {}).id;
    if (id === 'move') return { a: 'move', dir: 2 };
    if (id === 'examine') { ui.selection = F.sleeper; return null; }
    if (id === 'ring' || id === 'pips' || id === 'bump') return fight(s);
    if (id === 'case') return doCase(s);
    if (id === 'leave') return doLeave(s);
    return null;
  }

  // ---- The room ----

  test('the room: you at the west entrance, one sleeping fodder of a real pack with a short plain line, one case grade I opens holding an item needing no identifying, an exit on the east wall, no clock', () => {
    const s = Orientation.create(), me = you(s), m = s.dept;
    assert.equal(State.plainData(s), null);
    assert.equal(json(State.hash(Orientation.create())), json(State.hash(s)), 'the same every time');
    assert.ok(m.w >= 12 && m.w <= 16 && m.h >= 7 && m.h <= 10, `${m.w}×${m.h}`);
    assert.equal(m.depth, 1); assert.equal(s.run.grade, N.GRADE_START); assert.equal(s.seed, Orientation.SEED);
    assert.equal(json([me.x, me.y]), json(F.start)); assert.equal(json(m.entrance), json(F.entrance));
    assert.equal(m.entrance[0], 0, 'the entrance is on the west wall'); assert.equal(Math.abs(me.x - m.entrance[0]) + Math.abs(me.y - m.entrance[1]), 1);
    assert.equal(json(m.exits), json([F.exit])); assert.equal(F.exit[0], m.w - 1, 'the exit is on the east wall');
    assert.equal(json(s.you.kit), json({ weapon: 'you.w', garment: 'you.g', curio: [null, null], instrument: null }), 'the starting kit');
    assert.equal(m.clock, null, 'no clock');
    const ex = s.actors.filter(a => a.uid !== 'you');
    assert.equal(ex.length, 1);
    const a = ex[0], sp = Packs.speciesFor(s, a);
    assert.equal(a.uid, F.sleeper); assert.equal(a.mode, 'dormant'); assert.equal(a.pips, 0);
    assert.ok(Packs.list().some(p => p.species.includes(sp)), 'a species of a real pack');
    assert.equal(sp.archetype, 'plodder'); assert.equal(sp.role, 'fodder'); assert.equal(json(sp.modifiers), '[]'); assert.equal(sp.trigger, null);
    const line = Labels.of(s, a.uid).behaviour;
    assert.ok(line.length <= 140, line);
    const cases = m.fixtures.filter(f => f.k === 'case');
    assert.equal(cases.length, 1);
    const k = cases[0], it = s.items.find(i => i.uid === F.item);
    assert.equal(json([k.x, k.y]), json(F.case)); assert.equal(k.st, 'shut'); assert.ok(k.lock <= s.run.grade); assert.ok(k.num, 'a numbered case, so no mimic\'s tell');
    assert.equal(k.holds, F.item); assert.ok(['weapon', 'garment'].includes(it.kind), it.kind);
    assert.ok(Labels.of(s, `case:${k.x},${k.y}`).title.includes(Labels.ofItem(s, F.item).title));
  });

  test('the room passes every check after every step: a monkey plays it 1,500 steps, the room made anew when a visit ends', () => {
    const X = loadCore(['tools/monkey.js']), checks = Battery.checks(X), stream = X.Monkey.stream(7);
    let s = X.Orientation.create(), visits = 1;
    const problems = [];
    for (let i = 0; i < 1500; i++) {
      const a = X.Monkey.choose(s, stream), pre = X.State.clone(s), ev = X.Step.step(s, a);
      for (const p of checks.check(pre, a, ev, s)) problems.push(`step ${i}: ${p.id}: ${p.text}`);
      if (X.Monkey.ended(s)) { s = X.Orientation.create(); checks.reset(); visits++; }
    }
    assert.deepEqual(problems.slice(0, 5), []);
    assert.ok(visits >= 2, `${visits} visits`);
  });

  test('no bell and no night watch can come: 300 turns of waiting and walking ring no stage, and pips fade all along', () => {
    const s = Orientation.create();
    let stages = 0;
    for (let i = 0; i < 300; i++) {
      const ev = Step.step(s, i % 3 ? { a: 'wait' } : (legal(s, l => l.a === 'move') || { a: 'wait' }));
      stages += ev.filter(e => e.k === 'stage').length;
    }
    assert.ok(s.turn >= 300, `turn ${s.turn}`);
    assert.equal(stages, 0); assert.equal(Clock.stage(s), 0); assert.equal(s.dept.clock, null); assert.ok(Clock.pipsDecay(s));
  });

  // ---- The teacher ----

  test('a sensible player who does what the coach asks finishes all seven steps in order on the fixed seed, never dies, and every step passes every check', () => {
    const r = play(obedient);
    assert.deepEqual(r.problems, []);
    assert.equal(json(r.shown), json([0, 1, 2, 3, 4, 5, 6, 7]), 'the steps, one after another');
    assert.equal(r.s.over && r.s.over.k, 'left');
    assert.ok(r.s.actors[0].hp > 0);
    assert.equal(r.s.items.find(i => i.uid === F.item).where.at, 'tote', 'what you take goes into your Bag (your tote)');
  });

  test('the Logbook Trolley can be beaten with the starting kit: the same sensible player wins on 200 seeds of the room, every step of the first 20 checked', () => {
    let worst = Infinity;
    for (let seed = 1; seed <= 200; seed++) {
      const r = play(obedient, { state: Setup.room(seed, Orientation.spec()), unchecked: seed > 20 });
      assert.equal(r.s.over && r.s.over.k, 'left', `seed ${seed}: ${json(r.s.over)}`);
      assert.deepEqual(r.problems, [], `seed ${seed}`);
      worst = Math.min(worst, r.s.actors[0].hp);
    }
    assert.ok(worst > 0, `the closest fight left you ${worst} of ${N.PLAYER_HP}`);
  });

  test('out of order: striking first, or opening the case first, still finishes, each step met already passed at once', () => {
    // Strike first: straight for the trolley, never reading its label; then the case; then out.
    const strike = (s, mem) => fight(s) || doCase(s) || doLeave(s);
    const a = play(strike);
    assert.deepEqual(a.problems, []);
    assert.equal(a.s.over && a.s.over.k, 'left');
    assert.equal(a.shown[a.shown.length - 1], 7);
    assert.ok(!a.mem.seen.examined && a.mem.seen.beaten, 'the label was never read, and the step passed once the trolley fell');
    // The case first: open it and take what it held, then the trolley, then out.
    const kase = s => doCase(s) || fight(s) || doLeave(s);
    const b = play(kase);
    assert.deepEqual(b.problems, []);
    assert.equal(b.s.over && b.s.over.k, 'left');
    assert.equal(b.shown[b.shown.length - 1], 7);
    assert.ok(b.when.took < b.when.beaten, `took at ${b.when.took}, the trolley fell at ${b.when.beaten}`);
    // When the coach reaches the case, its goal is met: it passes at once (no step shows 5).
    assert.ok(!b.shown.includes(5), json(b.shown));
  });

  test('the teacher only reads: the view model, the events and its memory are as they were, the state too, and a game played with it equals one played without', () => {
    const snap = v => JSON.stringify(v, (k, x) => (x && x.constructor && /Array$/.test(x.constructor.name) && x.constructor !== Array ? Array.from(x) : x));
    let mem = Teacher.start(F);
    const s = Orientation.create(), ui = { selection: null };
    const actions = play(obedient).actions;
    for (const a of actions) {
      const ev = Step.step(s, a);
      if (Teacher.step(mem) === 1) ui.selection = F.sleeper;
      ui.coach = Teacher.target(mem);
      const vm = ViewModel.derive(s, ui), before = [snap(vm), snap(ev), snap(mem), State.hash(s)];
      const next = Teacher.observe(mem, vm, ev);
      Teacher.target(next); Teacher.sentence(Teacher.step(next), 'keys');
      assert.deepEqual([snap(vm), snap(ev), snap(mem), State.hash(s)], before);
      mem = next;
    }
    const t = Orientation.create();
    for (const a of actions) Step.step(t, a);
    assert.equal(State.hash(t), State.hash(s), 'the same actions without the teacher give the same state');
  });

  test('every step has one sentence in each form, each in its own input\'s words, and the keys named are §7.1\'s', () => {
    assert.equal(Teacher.STEPS.length, 7);
    assert.equal(json(Teacher.STEPS.map(s => s.id)), json(['move', 'examine', 'ring', 'pips', 'bump', 'case', 'leave']));
    for (const [i, st] of Teacher.STEPS.entries()) {
      for (const f of Teacher.FORMS) {
        const t = Teacher.sentence(i, f);
        assert.ok(typeof t === 'string' && t.length > 10, `${st.id} ${f}`);
        assert.ok(/^[A-Z].*\.$/.test(t) && !/[.!?] [A-Z]/.test(t.slice(0, -1)), `${st.id} ${f} is one sentence: ${t}`);
        const tap = /\btaps?\b/i.test(t), click = /\bclicks?\b/i.test(t), key = /\bpress|\bkeys?\b|arrows?\b/i.test(t);
        if (f === 'touch') assert.ok(tap && !click && !key, `${st.id} touch: ${t}`);
        if (f === 'mouse') assert.ok(click && !tap && !key, `${st.id} mouse: ${t}`);
        if (f === 'keys') assert.ok(!tap && !click, `${st.id} keys: ${t}`);
      }
      assert.equal(new Set(Teacher.FORMS.map(f => Teacher.sentence(i, f))).size, 3, `${st.id}: three different forms`);
    }
    // The keys the keys' forms name are §7.1's, as the code binds them: each phrase is in its
    // step's sentence, and the key it names does that there (input.js, main.js, ui.js).
    const input = fs.readFileSync(path.join(root, 'js/input.js'), 'utf8'), main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8'), ui = fs.readFileSync(path.join(root, 'js/ui/ui.js'), 'utf8');
    const verb = id => { const m = new RegExp(`\\b${id}: '([^']+)'`).exec(ui); return m ? m[1] : null; };
    const said = (id, phrase) => assert.ok(Teacher.sentence(Teacher.STEPS.findIndex(s => s.id === id), 'keys').includes(phrase), `${id}: "${phrase}"`);
    said('move', 'an arrow key, or h j k l y u b n,');
    assert.ok(/ArrowUp: 0, ArrowRight: 2, ArrowDown: 4, ArrowLeft: 6/.test(input), 'the arrows step (input.js)');
    for (const k of 'hjklyubn') assert.ok(new RegExp(`\\b${k}: \\d`).test(input), `${k} steps (input.js)`);
    said('examine', 'Press x until'); said('case', 'press x until'); said('leave', 'Press x until');
    assert.ok(/if \(k === 'x' \|\| k === 'X'\)/.test(main) && /cycle\(k === 'x' \? 1 : -1\)/.test(main), 'x selects the next thing in sight (main.js)');
    said('ring', 'with the arrows'); said('bump', 'Walk into it with a step key');
    said('case', `${verb('open')} to open it`); said('case', `${verb('take')} to take what it holds`); said('case', `your Bag (i)`);
    assert.equal(verb('open'), 'o'); assert.equal(verb('take'), 't'); assert.ok(/if \(k === 'i'\) \{ stop\(\); Bag\.open\(\)/.test(main), 'i opens the Bag (main.js)');
    said('leave', 'and Enter to walk there'); said('leave', `then ${verb('leave')} and Enter to leave`);
    assert.equal(verb('leave'), '>'); assert.ok(/if \(preview\) \{ tap\(preview\); return; \}/.test(main) && /if \(asking\) \{ answer\(true\); return; \}/.test(main), 'Enter walks a previewed walk and answers yes (main.js)');
  });

  test('every number a sentence states is the real one: three pips wake a sleeper, each turn inside your ring adds one, one fades for every 10 turns it gains none, and a hit wakes it at once, hunting', () => {
    const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
    const real = { pip: N.PIPS_TO_WAKE, turn: N.PIP_DECAY_TURNS };
    let counted = 0;
    for (const [i] of Teacher.STEPS.entries()) for (const f of Teacher.FORMS) {
      for (const m of Teacher.sentence(i, f).matchAll(/\b(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten) (pip|turn|tile)s?\b/gi)) {
        const n = /^\d+$/.test(m[1]) ? Number(m[1]) : WORDS.indexOf(m[1].toLowerCase()), what = m[2].toLowerCase();
        assert.ok(Object.prototype.hasOwnProperty.call(real, what), `"${m[0]}": a ${what} count the rules do not state`);
        assert.equal(n, real[what], `"${m[0]}" in step ${Teacher.STEPS[i].id}`);
        counted++;
      }
    }
    assert.equal(counted, 6, 'three pips and 10 turns, in each of the three forms');
    // Played: inside your ring a pip a turn, and the third wakes it (hunting, from the ring).
    const s = Orientation.create(), a = sleeperOf(s);
    let pips = 0, woke = null;
    for (let n = 0; n < 20 && !woke; n++) {
      const ev = Step.step(s, toward(s, a.x, a.y)), vm = ViewModel.derive(s, {});
      const inside = vm.ring[a.y * vm.w + a.x] === 1;
      const got = ev.filter(e => e.k === 'pip' && e.who === a.uid).length;
      assert.equal(got, inside ? 1 : 0, `turn ${s.turn}: ${inside ? 'inside' : 'outside'} your ring, ${got} pips`);
      pips += got;
      if (ev.some(e => e.k === 'woke' && e.who === a.uid)) woke = { pips, mode: a.mode, cause: ev.find(e => e.k === 'woke').cause.k };
    }
    assert.equal(json(woke), json({ pips: N.PIPS_TO_WAKE, mode: 'hunting', cause: 'ring' }));
    // Fading: a sleeper left with 2 pips has 1 ten turns after its last pip, and none ten more.
    // It gets its first at the edge of your ring and its second from a step along that edge;
    // then you wait, which draws your ring in (§8.2), so it gains no more.
    const d = Orientation.create(), b = sleeperOf(d);
    while (b.pips < 1) Step.step(d, toward(d, b.x, b.y));
    const along = Step.legal(d).filter(l => l.a === 'move').find(l => { const t = State.clone(d); Step.step(t, l); const c = sleeperOf(t); return c.mode === 'dormant' && c.pips === 2; });
    Step.step(d, along);
    const last = d.turn;
    Step.step(d, { a: 'wait' });
    assert.equal(b.pips, 2); assert.equal(b.mode, 'dormant'); assert.ok(!Vision.inRing(d, b.x, b.y), 'a wait draws your ring in, off it');
    const at = {};
    while (d.turn < last + 2 * N.PIP_DECAY_TURNS + 1) { Step.step(d, { a: 'wait' }); at[d.turn] = b.pips; }
    assert.equal(at[last + N.PIP_DECAY_TURNS - 1], 2); assert.equal(at[last + N.PIP_DECAY_TURNS], 1);
    assert.equal(at[last + 2 * N.PIP_DECAY_TURNS - 1], 1); assert.equal(at[last + 2 * N.PIP_DECAY_TURNS], 0);
    assert.equal(b.mode, 'dormant');
    // A hit on a sleeper wakes it at once, hunting: you beside it, on seeds until a first blow
    // lands while it still sleeps.
    let hits = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const sp = Orientation.spec(), [x, y] = F.at;
      sp.you = [x - 1, y];
      const t = Setup.room(seed, sp), c = sleeperOf(t);
      const ev = Step.step(t, { a: 'move', dir: 2 });
      if (!ev.some(e => e.k === 'damaged' && e.who === c.uid)) continue;
      hits++;
      assert.equal(c.mode, 'hunting', `seed ${seed}`);
      const w = ev.find(e => e.k === 'woke' && e.who === c.uid);
      assert.ok(w && w.cause.k === 'damage', `seed ${seed}: ${json(w)}`);
    }
    assert.ok(hits >= 10, `${hits} first blows landed`);
  });

  test('the teacher points at what each step needs: the sleeper while it stands, then the case, then the exit', () => {
    let mem = Teacher.start(F);
    assert.equal(Teacher.target(mem), null);
    const set = k => { mem = { facts: mem.facts, seen: Object.assign({}, mem.seen, { [k]: true }) }; };
    set('moved');
    for (const k of ['examined', 'pip', 'woke']) { assert.equal(json(Teacher.target(mem)), json({ uid: F.sleeper })); set(k); }
    assert.equal(json(Teacher.target(mem)), json({ uid: F.sleeper })); set('beaten');
    assert.equal(json(Teacher.target(mem)), json({ x: F.case[0], y: F.case[1] })); set('took');
    assert.equal(json(Teacher.target(mem)), json({ x: F.exit[0], y: F.exit[1] })); set('left');
    assert.equal(Teacher.step(mem), 7); assert.equal(Teacher.target(mem), null);
    // The view model marks it: an exhibit you see, a tile in view; nothing you cannot see.
    const s = Orientation.create(), vm = ViewModel.derive(s, { coach: { uid: F.sleeper } });
    assert.equal(json(vm.marks.filter(m => m.kind === 'coach')), json([{ kind: 'coach', x: F.at[0], y: F.at[1], size: 1 }]));
    assert.equal(json(ViewModel.derive(s, { coach: { x: F.case[0], y: F.case[1] } }).marks.filter(m => m.kind === 'coach').map(m => [m.x, m.y])), json([F.case]));
    assert.equal(ViewModel.derive(s, { coach: { x: 0, y: 0 } }).marks.filter(m => m.kind === 'coach').length, 0, 'a wall you cannot see is not marked');
    assert.equal(ViewModel.derive(s, { coach: { uid: 'nobody' } }).marks.filter(m => m.kind === 'coach').length, 0);
  });

  test('lint-core passes on the room and on the teacher', () => {
    const { spawnSync } = require('node:child_process');
    const r = spawnSync(process.execPath, [path.join(root, 'tools/lint-core.js'), path.join(root, 'content/orientation.js'), path.join(root, 'js/ui/teacher.js')], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });
};
