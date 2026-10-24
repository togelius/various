// M3's movement and doors (BUILD.md §4.2, §8.2; plan W1-WAKE-B): staff doors are walls to
// exhibits; an exhibit opens a closed door by stepping into it, with a soft noise; close(x, y)
// and its refusals; steps along shortest walking paths with ties on the exhibit's own stream;
// removing another actor leaves an exhibit's choices unchanged (§3.2); wandering keeps to the
// home room; investigating goes to the place, or beside it. The expected figures come from
// BUILD.md's text and an independent walking distance, never from the rule code.
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const { Step, State, Setup, Grid, AI, Wake, Causes, Actions, N } = C;
  const json = x => JSON.stringify(x);
  const tough = { hp: 999, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 };
  const ex = (at, extra) => Object.assign({ sp: 'dummy', at, mode: 'hunting', stats: tough }, extra);
  const room = (map, you, exhibits, extra, options, X) => {
    const s = (X || C).Setup.room(1, Object.assign({ acc: 'T0', depth: 1, map, you, exhibits: exhibits || [] }, extra || {}), options);
    s.actors[0].hp = s.actors[0].maxHp = 999;
    return s;
  };
  const checked = ev => { for (const e of ev) { const bad = Causes.check(e); assert.equal(bad, null, `${bad}: ${json(e)}`); } return ev; };
  const waits = (s, n) => { const all = []; for (let i = 0; i < n && !s.over; i++) all.push(...checked(Step.step(s, { a: 'wait' }))); return all; };
  const WALK = new Set(['.', ',', '+', "'", 'E', 'X', 'u', 'k', 'x', 'w', 'b', '=']);
  const DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  // An independent walking distance by the exhibits' step rule, from one tile to every tile.
  function distances(map, from) {
    const at = (x, y) => (map[y] && map[y][x]) || '#', key = (x, y) => `${x},${y}`;
    const d = new Map([[key(...from), 0]]), q = [from];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (!WALK.has(at(nx, ny)) || d.has(key(nx, ny)) || (dx && dy && !(WALK.has(at(nx, y)) && WALK.has(at(x, ny))))) continue;
        d.set(key(nx, ny), d.get(key(x, y)) + 1); q.push([nx, ny]);
      }
    }
    return (x, y) => d.has(key(x, y)) ? d.get(key(x, y)) : -1;
  }

  test('staff doors, open or closed, are walls to exhibits: a hunter beyond one never steps on it or through it', () => {
    for (const door of ['S', 's']) {
      const map = ['###########', `#....${door}....#`, '#....#....#', '#....#....#', '###########'];
      const s = room(map, [7, 1], [ex([3, 1])]), a = s.actors[1];
      const ev = waits(s, 30);
      assert.ok(!ev.some(e => e.k === 'moved' && e.who === a.uid && (e.to[0] >= 5)), `${door}: it never crosses`);
      assert.ok(!ev.some(e => e.k === 'attacked' && e.by === a.uid), `${door}: it never reaches you`);
      assert.equal(AI.field(s, a, s.actors[0], 'beside')[a.y * s.dept.w + a.x], -1, `${door}: there is no way to you`);
    }
    // Through an open staff door it sees you and hunts on, but waits where it is.
    const t = room(['###########', '#....s....#', '###########'], [7, 1], [ex([3, 1])]), b = t.actors[1];
    waits(t, 20);
    assert.equal(json([b.mode, b.x]), json(['hunting', 3]), 'it sees you through the open staff door and cannot come');
  });

  test('an exhibit opens a closed door by stepping into it: the door opens, a soft noise is made there, and it stays put until its next step', () => {
    const map = ['##########', '#...#....#', '#...+....#', '#...#....#', '##########'];
    const X = loadCore(), heard = [];
    X.Wake.hear = (state, a, noise, dist) => heard.push(`${a.uid}:${noise.k}:${noise.by}:${dist}`);
    const s = room(map, [7, 1], [ex([2, 2], { lastKnown: [7, 2] }), ex([6, 3], { mode: 'dormant' })], null, null, X), [, a, b] = s.actors;
    const ev = [];
    for (let i = 0; i < 4; i++) ev.push(...X.Step.step(s, { a: 'wait' }));
    const k = ev.findIndex(e => e.k === 'opened');
    assert.ok(k >= 0, 'it opened the door');
    const op = ev[k], no = ev[k + 1];
    assert.equal(json([op.who, op.x, op.y, op.cause]), json([a.uid, 4, 2, { k: 'door', by: a.uid }]));
    assert.equal(json([no.k, no.x, no.y, no.cls, no.range, no.cause]), json(['noise', 4, 2, 'soft', N.NOISE_SOFT, { k: 'door', by: a.uid }]));
    assert.equal(s.dept.tiles[2][4], "'");
    // Opening is its whole action: it stood beside the door, and its next step goes through.
    const before = ev.slice(0, k).filter(e => e.k === 'moved' && e.who === a.uid).pop();
    assert.equal(json(before.to), json([3, 2]));
    const next = ev.slice(k).find(e => e.k === 'moved' && e.who === a.uid);
    assert.equal(json([next.from, next.to, next.tick - op.tick]), json([[3, 2], [4, 2], N.COST_DOOR]));
    const far = distances(s.dept.tiles, [4, 2])(6, 3);
    assert.ok(far > 0 && far <= N.NOISE_SOFT && heard.includes(`${b.uid}:door:${a.uid}:${far}`), `the exhibit ${far} tiles away heard it: ` + heard.join(' '));
  });

  test('close(x, y): an open door beside you closes for a turn with a soft noise; refused with no open door there, past a corner, or with an actor in the doorway', () => {
    const map = ['##########', "#...#....#", "#...'....#", '#...#....#', '##########'];
    const s = room(map, [3, 2]), you = s.actors[0];
    const close = s => Step.legal(s).filter(a => a.a === 'close');
    assert.equal(json(close(s)), json([{ a: 'close', x: 4, y: 2 }]));
    const h = State.hash(s), ev = checked(Step.step(s, { a: 'close', x: 4, y: 2 }));
    assert.notEqual(State.hash(s), h);
    assert.equal(json(ev.filter(e => e.k !== 'waited').slice(0, 2).map(e => [e.k, e.who || null, e.x, e.y, e.cls || null, e.cause ? e.cause.k : null])),
      json([['closed', 'you', 4, 2, null, null], ['noise', null, 4, 2, 'soft', 'close']]));
    assert.equal(json([s.dept.tiles[2][4], you.x, you.y, you.next, you.lastAct, you.still]), json(['+', 3, 2, N.COST_DOOR, 'close', false]));
    assert.equal(json(close(s)), '[]', 'it is shut now');
    const refused = (t, a) => {
      const g = State.hash(t), e = Step.step(t, a), code = e.length === 1 && e[0].k === 'refused' ? e[0].reason : null;
      if (code) assert.equal(State.hash(t), g, 'a refusal changes nothing');
      return code;
    };
    assert.equal(refused(s, { a: 'close', x: 4, y: 2 }), 'no_door', 'a closed door');
    assert.equal(refused(s, { a: 'close', x: 2, y: 2 }), 'no_door', 'floor');
    assert.equal(refused(s, { a: 'close' }), 'no_door', 'no tile');
    // Past a corner: from (3, 1) the door at (4, 2) cannot be stepped into, so not closed either.
    const c = room(map, [3, 1]);
    assert.equal(json(close(c)), '[]');
    assert.equal(refused(c, { a: 'close', x: 4, y: 2 }), 'corner');
    // Two tiles off: not beside you.
    const f = room(map, [2, 2]);
    assert.equal(refused(f, { a: 'close', x: 4, y: 2 }), 'no_door');
    // An actor in the doorway.
    const d = room(map, [3, 2], [ex([4, 2], { mode: 'dormant' })]);
    assert.equal(json(close(d)), '[]');
    assert.equal(refused(d, { a: 'close', x: 4, y: 2 }), 'doorway_occupied');
    // An open staff door closes to a staff door.
    const st = room(['#######', '#..s..#', '#######'], [2, 1]);
    checked(Step.step(st, { a: 'close', x: 3, y: 1 }));
    assert.equal(st.dept.tiles[1][3], 'S');
    // Every candidate is legal or refused, and refused exactly when it is not legal.
    for (const t of [room(map, [3, 2]), room(map, [5, 2]), room(map, [3, 1]), d, st]) {
      const legal = close(t).map(json);
      for (const a of Actions.get('close').candidates(t)) assert.equal(refused(State.clone(t), a) === null, legal.includes(json(a)), json(a));
    }
    // Rooted, you may still close a door (it does not move you); fixed, you may not.
    const r = room(map, [3, 2], [], { youStatuses: [{ id: 'rooted', turns: 3 }] });
    assert.equal(json(close(r)), json([{ a: 'close', x: 4, y: 2 }]));
    const x = room(map, [3, 2], [], { youStatuses: [{ id: 'fixed', turns: 3 }] });
    assert.equal(json(close(x)), '[]');
    assert.equal(refused(x, { a: 'close', x: 4, y: 2 }), 'fixed');
  });

  test('a hunter walks a shortest walking path to you, one tile a step; ties go to its own stream, so the same seed gives the same path', () => {
    const map = ['############', '#..........#', '#...##.....#', '#...##.....#', '#..........#', '############'];
    const toYou = distances(map, [10, 4]), paths = new Set();
    for (let seed = 1; seed <= 10; seed++) {
      const run = () => {
        const s = room(map, [10, 4], [ex([1, 1])]);
        s.seed = seed;
        const a = s.actors[1], path = [];
        for (let i = 0; i < 14 && C.Actors.between(a, s.actors[0]) > 1; i++) {
          const was = toYou(a.x, a.y);
          checked(Step.step(s, { a: 'wait' }));
          assert.equal(toYou(a.x, a.y), was - 1, `seed ${seed}: one tile nearer by walking distance each turn`);
          path.push(`${a.x},${a.y}`);
        }
        return path.join(' ');
      };
      const p = run();
      assert.equal(run(), p, `seed ${seed}: the same path again`);
      paths.add(p);
    }
    assert.ok(paths.size > 1, 'different seeds break the ties differently');
  });

  test('removing another exhibit (without) leaves an exhibit\'s choices unchanged', () => {
    const map = ['###############', '#.......#.....#', '#.......#.....#', '#.......#.....#', '#.......#.....#', '###############'];
    const exhibits = [ex([1, 1]), ex([11, 2], { mode: 'awake' }), ex([12, 4], { mode: 'awake' })];
    const track = s => { const out = []; for (let i = 0; i < 30; i++) { Step.step(s, { a: 'wait' }); out.push(s.actors.filter(a => !a.gone && a.uid !== 'you').map(a => `${a.uid}@${a.x},${a.y}`).join(' ')); } return out; };
    const all = track(room(map, [6, 3], exhibits));
    for (const gone of ['T0.1.room.2', 'T0.1.room.3']) {
      const s = room(map, [6, 3], exhibits, null, { without: [gone] });
      assert.equal(s.actors.find(a => a.uid === gone).gone, 1);
      const some = track(s);
      const keep = line => line.split(' ').filter(p => !p.startsWith(gone + '@')).join(' ');
      assert.equal(json(some), json(all.map(keep)), `without ${gone}`);
    }
    assert.ok(all.some(l => !l.includes('T0.1.room.2@11,2')), 'the wanderer moved');
  });

  test('an awake exhibit wanders only its home room; homeless, the room it stands in', () => {
    for (const acc of ['S9', 'A4', 'M11']) {
      const s = C.Dept.create(3, acc, 4), m = s.dept, you = s.actors[0];
      const pick = s.actors.slice(1).filter(a => !a.gone && C.Actors.dist(a, you.x, you.y) > 12)[0];
      assert.ok(pick, acc);
      for (const homeless of [false, true]) {
        const t = State.clone(s), a = t.actors.find(b => b.uid === pick.uid);
        if (homeless) a.home = null;
        Wake.wake(t, a, 'awake', { k: 'noise', by: 'you', dist: 3, cls: 'soft' }, [], { target: [a.x, a.y] });
        const rid = m.roomOf[pick.y][pick.x];
        let checks = 0;
        for (let i = 0; i < 18 && a.mode === 'awake'; i++) {
          Step.step(t, { a: 'wait' });
          if (a.mode !== 'awake') break;
          assert.equal(m.roomOf[a.y][a.x], rid, `${acc}: it stands in its room at ${a.x},${a.y}`);
          if (a.target) assert.equal(m.roomOf[a.target[1]][a.target[0]], rid, `${acc}: it wanders to its room`);
          checks++;
        }
        assert.ok(checks > 5, `${acc}: it wandered (${checks})`);
      }
    }
    // AI.wanderGoal: a tile it can stand on and walk to, in its home room, on its own stream.
    const s = room(['#########', '#...#...#', '#...#...#', '#########'], [6, 1], [ex([1, 1], { mode: 'awake' })]), a = s.actors[1];
    for (let i = 0; i < 20; i++) { const g = AI.wanderGoal(s, a); assert.ok(g[0] >= 1 && g[0] <= 3 && !(g[0] === 1 && g[1] === 1), json(g)); }
    assert.equal(json(AI.wanderGoal(room(['###', '#.#', '###'], [1, 1], []), C.Actors.make(null, { uid: 'z', x: 1, y: 1, hp: 1 }))), 'null', 'nowhere to go');
  });

  test('an awake exhibit sent to look walks onto the place, or beside it when it cannot stand there, then wanders', () => {
    // You are shut away in the room below, out of its sight.
    const map = ['##########', '#........#', '#......v.#', '#........#', '##########', '#........#', '##########'];
    for (const [target, end] of [[[7, 1], 0], [[7, 2], 1]]) {
      const s = room(map, [1, 5], [ex([1, 1], { mode: 'awake' })]), a = s.actors[1];
      Wake.setMode(s, a, 'awake', { k: 'noise', by: 'you', dist: 3, cls: 'soft' }, [], { target });
      // Onto a floor tile; for a case, the nearest tile beside it.
      const here = distances(map, [1, 1]);
      const want = end === 0 ? here(...target) : Math.min(...DIRS.map(([dx, dy]) => here(target[0] + dx, target[1] + dy)).filter(v => v >= 0));
      const ev = waits(s, 12), steps = ev.filter(e => e.k === 'moved' && e.who === a.uid);
      const stop = steps[want - 1].to;
      assert.equal(Math.max(Math.abs(stop[0] - target[0]), Math.abs(stop[1] - target[1])), end, `to ${target}: it stopped at ${stop}`);
      assert.ok(steps.length > want, 'then it wandered on');
    }
  });
};
