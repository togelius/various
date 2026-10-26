// M2: what the labels, the strip and the sentences say (BUILD.md §8.1, §8.8, §3.4), the 2×2
// footprint they all read (§4.1), and the pictograms' colours. The view model's tests
// (§6.1) are in m2-vm.test.js.
// The expected figures are written out again from BUILD.md's text, never from combat.js.
module.exports = ({ test, assert, loadCore, root, fs, path }) => {
  const C = loadCore(['js/view/art.gen.js', 'js/view/pictograms.js']);
  const { Dept, Labels, Packs, Setup, Step, State, Status, Roles, Text, Path, Grid, Registry, Pictograms, ART, Layout, Actors } = C;

  // §8.1, independently. Hit = clamp(75 + 5(Acc − Eva) + 20 if the defender is fixed − 20 if
  // the attacker is dazed, 10, 95); d(r) = max(1, r − Padding); typical = 100·Σd ÷ (n·HP)
  // rounded half up; worst = ceil(HP ÷ max d); need = ceil(its HP · n ÷ Σd). An axis_sniper
  // "has no blow and shoots no bolts" (§8.1), so its label gives no chance of its hitting you;
  // "a swarm's bodies each lose all their health to any hit" (§8.1), so one needs 1 hit.
  const has = (x, id) => (x.statuses || []).some(st => st.id === id);
  const hit = (att, def) => Math.min(95, Math.max(10, 75 + 5 * (att.acc - def.eva) + (has(def, 'fixed') ? 20 : 0) - (has(att, 'dazed') ? 20 : 0)));
  const nets = (att, def) => { const out = []; for (let r = att.dmin; r <= att.dmax; r++) out.push(Math.max(1, r - def.pad)); return out; };
  const sum = xs => xs.reduce((p, q) => p + q, 0);
  const halfUp = (num, den) => { const q = Math.floor(num / den); return 2 * (num - q * den) >= den ? q + 1 : q; };
  // Surprise: asleep or stirring, or awake without having seen you since it woke; never
  // hunting, searching, returning or reinstalling. Maximum damage, ×1.5 rounded down with
  // a Light weapon; against a Centrepiece, the rolled range.
  const unaware = a => a.mode === 'dormant' || (a.mode === 'awake' && !a.sawYou);
  const NO_BLOW = ['axis_sniper'], ANY_HIT = ['mote_swarm'];
  function expected(you, a) {
    const t = nets(a, you), m = nets(you, a), hp = Math.max(1, you.hp), blow = !NO_BLOW.includes(a.arch);
    const e = { blow, toYou: hit(a, you), typical: halfUp(100 * sum(t), t.length * hp), worst: Math.ceil(hp / Math.max(...t)),
      toIt: hit(you, a), need: ANY_HIT.includes(a.arch) ? 1 : Math.ceil(a.hp * m.length / sum(m)), mine: [Math.min(...m), Math.max(...m)], surprise: null };
    e.nums = (blow ? [e.toYou, e.typical, e.worst] : []).concat([e.toIt, e.need]);
    if (unaware(a)) {
      if (a.role === 'centrepiece') e.surprise = e.mine;
      else { const d = Math.max(1, (you.weaponForm === 'light' ? Math.floor(you.dmax * 3 / 2) : you.dmax) - a.pad); e.surprise = [d, d]; }
    }
    return e;
  }
  // Values made inside the core's context have its prototypes, so compare them as JSON.
  const same = (got, want, msg) => assert.equal(JSON.stringify(got), JSON.stringify(want), msg);
  const fmt = r => r[0] === r[1] ? String(r[0]) : `${r[0]}–${r[1]}`;
  const nums = r => r[0] === r[1] ? [r[0]] : r;
  const foot = a => { const out = []; for (let dy = 0; dy < (a.size || 1); dy++) for (let dx = 0; dx < (a.size || 1); dx++) out.push([a.x + dx, a.y + dy]); return out; };
  const footDist = (a, x, y) => Math.min(...foot(a).map(([fx, fy]) => Math.max(Math.abs(fx - x), Math.abs(fy - y))));
  const inFoot = (a, x, y) => foot(a).some(([fx, fy]) => fx === x && fy === y);
  const occupied = (s, x, y) => s.actors.some(a => !a.gone && inFoot(a, x, y));
  // §8.3: an exhibit in an intact case (any tile of it on a vitrine) cannot be struck, so its
  // label offers no Attack; a mimic in its disguise is a case, so it has no exhibit's label.
  const encased = (s, a) => foot(a).some(([x, y]) => s.dept.tiles[y][x] === 'v');
  const disguised = (s, a) => a.arch === 'mimic_vitrine' && s.dept.fixtures.some(f => f.k === 'case' && f.mimic === a.uid && f.st === 'shut');
  // A free floor tile orthogonally beside a's footprint, or null.
  function beside(s, a) {
    for (const [fx, fy] of foot(a)) for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const x = fx + dx, y = fy + dy;
      if (Grid.walkable(s.dept, x, y) && !occupied(s, x, y)) return [x, y];
    }
    return null;
  }

  // M3 departments leave the Centrepiece out until M4 places it (BUILD.md §5.5). These tests
  // keep their Centrepiece and 2×2 cases by standing the pack's Centrepiece where M2 did, on
  // its plan's plinth (the same plan Dept.create made, from the same seed), asleep, with the
  // centrepiece role's numbers at the depth.
  function withCentrepiece(s) {
    const p = Packs.get(s.dept.acc), cp = p.centrepiece, stats = Roles.stats('centrepiece', s.dept.depth);
    const [x, y] = Layout.generate(p.programme, 0, s.seed, { acc: p.acc, depth: s.dept.depth }).plan.cpl;
    return Actors.spawn(s, Object.assign({}, stats, { uid: `${p.acc}.${s.dept.depth}.centre.1`, sp: cp.id, arch: cp.archetype, size: cp.size || 1, x, y, mode: 'dormant', maxHp: stats.hp }));
  }

  test('the odds readout and the Attack button equal an independent count, over varied states', () => {
    const ran = new Set();
    const FORMS = ['light', 'balanced', 'heavy'], MODES = ['dormant', 'hunting', 'returning', 'awake', 'awake-saw'];
    const STATUS = [[], [['you', 'fixed']], [['you', 'dazed']], [['it', 'fixed']], [['it', 'dazed']], [['you', 'dazed'], ['it', 'fixed']]];
    for (const acc of ['S9', 'A4', 'M11']) for (let depth = 1; depth <= 7; depth += 3) {
      const s = Dept.create(depth * 11, acc, depth), home = s.actors[0];
      withCentrepiece(s);
      for (const a of s.actors.slice(1)) {
        if (disguised(s, a)) { assert.equal(Labels.of(s, a.uid), null, `${a.uid}, a mimic in its disguise, has an exhibit's label`); ran.add('disguised'); continue; }
        // Stand beside it, so the label has its button.
        const spot = beside(s, a);
        if (!spot) continue;
        const keep = { mode: a.mode, hp: a.hp, statuses: a.statuses };
        for (const form of FORMS) for (const yhp of [null, 7, 1]) for (const mode of MODES) for (const st of STATUS) for (const low of [false, true]) {
          const you = Setup.you(spot[0], spot[1], form);
          if (yhp !== null) you.hp = yhp;
          s.actors[0] = you;
          a.mode = mode === 'awake-saw' ? 'awake' : mode;
          if (mode === 'awake-saw') a.sawYou = true; else delete a.sawYou;
          a.hp = low ? Math.max(1, Math.floor(a.maxHp / 3)) : a.maxHp;
          a.statuses = [];
          for (const [who, id] of st) Status.apply(s, who === 'you' ? you : a, id, 5, { k: 'status', id }, []);
          Status.settle(s);
          const l = Labels.of(s, a.uid), e = expected(you, a), got = l.odds.join(' ').match(/\d+/g).map(Number);
          const want = e.nums.concat(e.surprise ? nums(e.surprise) : []);
          const where = `${acc} d${depth} ${a.uid} ${form} hp ${you.hp} ${mode} ${JSON.stringify(st)} ${a.hp}/${a.maxHp}`;
          assert.deepEqual(got, want, `${where}: ${l.odds.join(' ')}`);
          assert.equal(l.odds.length, (e.blow ? 2 : 1) + (e.surprise ? 1 : 0), where);
          if (!e.blow) ran.add('no-blow'); if (ANY_HIT.includes(a.arch)) ran.add('any-hit');
          const button = e.surprise ? `Attack: certain hit, ${fmt(e.surprise)} damage` : `Attack: ${e.toIt}%, ${fmt(e.mine)} damage`;
          // (An encased exhibit, which has no button, is m3-cases's.)
          same(l.actions, encased(s, a) ? [] : [{ id: 'attack', text: button }], where);
          // Which branches ran.
          ran.add('form:' + form); ran.add('mode:' + mode); ran.add('hp:' + (yhp === null ? 'max' : yhp)); if (low) ran.add('it:reduced');
          for (const [who, id] of st) ran.add(`${who}:${id}`);
          if (e.surprise) ran.add(a.role === 'centrepiece' ? (a.size === 2 ? 'surprise:centrepiece2x2' : 'surprise:centrepiece') : form === 'light' ? 'surprise:light' : 'surprise:max');
          else ran.add('surprise:none');
          if (e.surprise && a.role !== 'centrepiece' && form === 'light' && Math.floor(you.dmax * 3 / 2) - a.pad > Math.max(1, you.dmax - a.pad)) ran.add('surprise:light-adds');
          if (e.toIt === 95 || e.toYou === 95) ran.add('clamp:95');
          if (e.typical > 100) ran.add('typical>100');
          if (a.size === 2) ran.add('size:2');
        }
        Object.assign(a, keep); delete a.sawYou;
      }
      s.actors[0] = home;
    }
    const want = ['form:light', 'form:balanced', 'form:heavy', 'mode:dormant', 'mode:hunting', 'mode:returning', 'mode:awake', 'mode:awake-saw',
      'hp:max', 'hp:7', 'hp:1', 'it:reduced', 'you:fixed', 'you:dazed', 'it:fixed', 'it:dazed', 'surprise:none', 'surprise:max', 'surprise:light',
      'surprise:light-adds', 'surprise:centrepiece', 'surprise:centrepiece2x2', 'clamp:95', 'typical>100', 'size:2', 'no-blow', 'any-hit', 'disguised'];
    assert.deepEqual(want.filter(k => !ran.has(k)), [], 'branches that never ran');
  });

  test('the odds readout equals an independent count for every exhibit as placed, depths 1–7', () => {
    let checked = 0, sniper = 0, swarm = 0;
    for (const acc of ['S9', 'A4', 'M11']) for (let depth = 1; depth <= 7; depth++) {
      const s = Dept.create(depth * 11, acc, depth), you = s.actors[0];
      for (const a of s.actors.slice(1)) {
        if (disguised(s, a)) { assert.equal(Labels.of(s, a.uid), null, a.uid); continue; }
        const l = Labels.of(s, a.uid), e = expected(you, a), got = l.odds.join(' ').match(/\d+/g).map(Number);
        assert.deepEqual(got, e.nums.concat(e.surprise ? nums(e.surprise) : []), `${acc} depth ${depth} ${a.uid}: ${l.odds.join(' ')}`);
        // An exhibit with no blow shows neither a blow's Acc nor its damage among its
        // pictograms (§8.1, the odds readout; §8.8), since it never uses them; one with a blow shows both.
        const icons = l.pictos.map(p => p.icon);
        assert.equal(icons.includes('acc') && icons.includes('damage'), e.blow, `${a.uid}: pictograms ${JSON.stringify(icons)}`);
        if (!e.blow) { assert.ok(!/chance to hit you/.test(l.odds.join(' ')), `${a.uid} has no blow: ${l.odds.join(' ')}`); sniper++; }
        if (ANY_HIT.includes(a.arch)) { assert.ok(/typically need 1 hit to destroy it/.test(l.odds.join(' ')), `${a.uid} falls to any hit: ${l.odds.join(' ')}`); swarm++; }
        checked++;
      }
    }
    assert.ok(checked > 100, `only ${checked} exhibits checked`);
    assert.ok(sniper >= 7 && swarm >= 7, `${sniper} axis_snipers and ${swarm} swarm bodies checked`);
  });

  test('a surprise blow on a Centrepiece hits for certain but rolls its damage; an awake exhibit that has seen you is not surprised', () => {
    const map = ['##########', '#........#', '#........#', '#........#', '#........#', '##########'];
    const cp = Roles.stats('centrepiece', 1);
    const rolled = new Set();
    for (let seed = 1; seed <= 60; seed++) {
      const s = Setup.room(seed, { acc: 'T0', depth: 1, map, you: [3, 2], exhibits: [{ sp: 'cp', at: [4, 2], size: 2, mode: 'dormant', stats: cp }] });
      const ev = Step.step(s, { a: 'move', dir: 2 }), d = ev.find(e => e.k === 'damaged');
      assert.ok(d && d.cause.surprise === 1 && d.cause.roll === undefined, 'a surprise blow, with no hit roll');
      assert.ok(d.cause.raw >= s.actors[0].dmin && d.cause.raw <= s.actors[0].dmax, `raw ${d.cause.raw} rolled in the weapon's range`);
      assert.equal(d.amount, Math.max(1, d.cause.raw - cp.pad));
      assert.ok(ev.some(e => e.k === 'hunting' && e.who === d.who), 'the encounter starts: it hunts you');
      rolled.add(d.cause.raw);
    }
    assert.ok(rolled.size > 1, 'the damage is rolled, not the maximum every time');
    // Ordinary exhibits by mode: dormant and unaware-awake are surprised at maximum damage.
    const by = {};
    for (const mode of ['dormant', 'awake', 'awake-saw', 'hunting', 'returning']) {
      const s = Setup.room(5, { acc: 'T0', depth: 1, map, you: [3, 2], exhibits: [{ sp: 'x', at: [4, 2], mode: mode === 'awake-saw' ? 'awake' : mode, stats: { hp: 99, acc: 2, eva: -30, pad: 0, dmin: 1, dmax: 4 } }] });
      if (mode === 'awake-saw') s.actors[1].sawYou = true;
      const d = Step.step(s, { a: 'move', dir: 2 }).find(e => e.k === 'damaged');
      by[mode] = d && d.cause.surprise === 1 && d.cause.raw === s.actors[0].dmax;
    }
    assert.deepEqual(by, { dormant: true, awake: true, 'awake-saw': false, hunting: false, returning: false });
  });

  test('the label gives the paragraph within 2 tiles of an exhibit’s nearest tile, and "Come closer to read" at 3', () => {
    const ran = new Set();
    for (const acc of ['S9', 'M11']) for (let seed = 1; seed <= 3; seed++) {
      const s = Dept.create(seed, acc, 1), you = s.actors[0], m = s.dept;
      const big = withCentrepiece(s), small = s.actors.find(a => a.uid !== 'you' && a.size === 1);
      for (const a of [small, big]) {
        const sp = Labels.speciesOf(s, a);
        for (let y = a.y - 4; y <= a.y + 5; y++) for (let x = a.x - 4; x <= a.x + 5; x++) {
          const d = footDist(a, x, y);
          if (d < 1 || d > 3 || !Grid.walkable(m, x, y) || s.actors.some(o => o !== you && !o.gone && inFoot(o, x, y))) continue;
          if (!foot(a).some(([fx, fy]) => Grid.los(m, x, y, fx, fy))) continue;
          you.x = x; you.y = y;
          const l = Labels.of(s, a.uid), where = `${acc} seed ${seed} ${a.uid} from ${x},${y} at ${d}`;
          if (d <= 2) assert.ok(l.paragraph === sp.paragraph && !l.far, where);
          else assert.ok(!l.paragraph && /Come closer to read/.test(l.far), where);
          ran.add(`${a.size}:${d}`);
          if (a.size === 2 && d <= 2 && Math.max(Math.abs(x - a.x), Math.abs(y - a.y)) > 2) ran.add('2:anchor-beyond-2');
        }
      }
    }
    assert.deepEqual(['1:1', '1:2', '1:3', '2:1', '2:2', '2:3', '2:anchor-beyond-2'].filter(k => !ran.has(k)), [], 'distances never tried');
  });

  // An open room with a 2×2 Centrepiece anchored at (4,3), so its footprint is (4..5, 3..4).
  const OPEN = ['##########', '#........#', '#........#', '#........#', '#........#', '#........#', '#........#', '##########'];
  const centre = (you, mode, map) => Setup.room(3, { acc: 'T0', depth: 1, map: map || OPEN, you,
    exhibits: [{ sp: 'cp', at: [4, 3], size: 2, mode: mode || 'dormant', stats: Roles.stats('centrepiece', 1) }] });
  const key = a => JSON.stringify(a);
  // Every candidate action: step() accepts it exactly when Step.legal lists it.
  function agrees(s, where) {
    const legal = Step.legal(s), cands = [{ a: 'wait' }];
    for (let d = 0; d < 8; d++) cands.push({ a: 'move', dir: d });
    for (const a of s.actors) if (a.uid !== 'you') cands.push({ a: 'attack', uid: a.uid });
    for (const c of cands) {
      const ok = Step.step(State.clone(s), c)[0];
      assert.equal(!(ok && ok.k === 'refused'), legal.some(l => key(l) === key(c)), `${where}: ${key(c)}`);
    }
  }

  test('a 2×2 Centrepiece fills its footprint: moving into any of its tiles attacks it, from any tile beside it, and Step.legal agrees', () => {
    let struck = 0, besides = 0;
    for (let y = 1; y <= 6; y++) for (let x = 1; x <= 8; x++) {
      const s = centre([x, y]), cp = s.actors[1];
      if (inFoot(cp, x, y)) continue;
      const you = s.actors[0];
      assert.ok(foot(cp).every(([fx, fy]) => C.Actors.at(s, fx, fy, you) === cp) && !C.Actors.at(s, 6, 4, you) && !C.Actors.at(s, 3, 3, you), 'Actors.at covers the footprint and no more');
      agrees(s, `you at ${x},${y}`);
      const beside = footDist(cp, x, y) === 1;
      assert.equal(Step.legal(s).some(l => l.a === 'attack' && l.uid === cp.uid), beside, `attack from ${x},${y}`);
      if (beside) besides++;
      for (let d = 0; d < 8; d++) {
        const nx = x + Grid.DX[d], ny = y + Grid.DY[d];
        if (!inFoot(cp, nx, ny)) continue;
        const c = State.clone(s), ev = Step.step(c, { a: 'move', dir: d });
        assert.ok(ev.some(e => e.k === 'damaged' && e.who === cp.uid && e.cause.by === 'you'), `move ${d} from ${x},${y} strikes it`);
        assert.deepEqual([c.actors[0].x, c.actors[0].y], [x, y], 'you stay put');
        struck++;
      }
    }
    assert.equal(besides, 12, 'twelve tiles touch a 2×2 footprint');
    assert.equal(struck, 20, 'every step into the footprint, from every tile beside it');
  });

  test('a diagonal blow at a 2×2 Centrepiece may not cross a corner you could not step past', () => {
    // A column at (4,2): from (3,2), the footprint's corner (4,3) is diagonal, past the column.
    const map = OPEN.slice(); map[2] = '#...o....#';
    const s = centre([3, 2], 'dormant', map), cp = s.actors[1];
    assert.equal(Step.adjacent(s, s.actors[0], cp), false);
    assert.ok(!Step.legal(s).some(l => (l.a === 'move' && l.dir === 3) || l.a === 'attack'));
    const refused = Step.step(State.clone(s), { a: 'move', dir: 3 })[0];
    assert.equal(refused.reason, 'corner');
    assert.equal(Text.event(refused), 'You cannot reach it past the corner.');
    agrees(s, 'past the column');
    // From (3,3) the same corner tile is beside you, so the blow lands.
    s.actors[0].y = 3;
    assert.equal(Step.adjacent(s, s.actors[0], cp), true);
    agrees(s, 'beside it');
  });

  test('a hunting 2×2 Centrepiece moves only where its whole footprint fits, and Step.legal agrees all the way', () => {
    const map = ['############', '#..........#', '#....o.....#', '#..........#', '#..........#', '#......o...#', '#..........#', '############'];
    for (let seed = 1; seed <= 6; seed++) {
      const s = Setup.room(seed, { acc: 'T0', depth: 1, map, you: [1 + seed, 6], exhibits: [
        { sp: 'cp', at: [7, 1], size: 2, mode: 'hunting', stats: Object.assign(Roles.stats('centrepiece', 1), { hp: 999 }) },
        { sp: 'x', at: [10, 6], mode: 'hunting', stats: { hp: 999, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 } }] });
      s.actors[0].hp = s.actors[0].maxHp = 9999;
      const cp = s.actors[1];
      let moved = 0, struck = 0;
      for (let k = 0; k < 40 && !s.over; k++) {
        agrees(s, `seed ${seed} step ${k}`);
        const legal = Step.legal(s), ev = Step.step(s, legal[(k * 7 + seed) % legal.length]);
        moved += ev.filter(e => e.k === 'moved' && e.who === cp.uid).length;
        struck += ev.filter(e => e.cause && e.cause.by === cp.uid).length;
        for (const [fx, fy] of foot(cp)) {
          assert.ok(Grid.walkable(s.dept, fx, fy), `seed ${seed}: its tile ${fx},${fy} is not floor`);
          assert.ok(!s.actors.some(o => o !== cp && !o.gone && inFoot(o, fx, fy)), `seed ${seed}: it overlaps another actor at ${fx},${fy}`);
        }
      }
      assert.ok(moved > 0 && struck > 0, `seed ${seed}: it closed in (${moved}) and struck (${struck})`);
    }
  });

  test('a path goes round a 2×2 footprint, never through it, and a tap on any of its tiles ends in the blow', () => {
    const s = centre([2, 4]), cp = s.actors[1];
    // An independent shortest walk that avoids the footprint.
    const bfs = (tx, ty) => {
      const dist = new Map([[`${s.actors[0].x},${s.actors[0].y}`, 0]]), q = [[s.actors[0].x, s.actors[0].y]];
      while (q.length) {
        const [x, y] = q.shift();
        for (let k = 0; k < 8; k++) {
          const nx = x + Grid.DX[k], ny = y + Grid.DY[k];
          if (!Grid.canStep(s.dept, x, y, k) || inFoot(cp, nx, ny) || dist.has(`${nx},${ny}`)) continue;
          dist.set(`${nx},${ny}`, dist.get(`${x},${y}`) + 1); q.push([nx, ny]);
        }
      }
      return dist.get(`${tx},${ty}`);
    };
    for (const [tx, ty] of [[7, 3], [7, 4], [5, 1], [4, 6], [8, 6]]) {
      const p = Path.to(s, tx, ty);
      same(p[p.length - 1], [tx, ty], `reaches ${tx},${ty}`);
      assert.equal(p.length, bfs(tx, ty), `shortest to ${tx},${ty}`);
      assert.ok(!p.some(([x, y]) => inFoot(cp, x, y)), `the path to ${tx},${ty} crosses the footprint`);
      const c = State.clone(s);
      for (const q of p) assert.equal(Step.step(c, { a: 'move', dir: Path.dirTo([c.actors[0].x, c.actors[0].y], q) })[0].k, 'moved');
    }
    for (const [fx, fy] of foot(cp)) {
      const p = Path.to(s, fx, fy), last = p[p.length - 1];
      assert.ok(p.length && inFoot(cp, last[0], last[1]) && !p.slice(0, -1).some(([x, y]) => inFoot(cp, x, y)), `aimed at ${fx},${fy}: ${JSON.stringify(p)}`);
      const c = State.clone(s);
      let ev = [];
      for (const q of p) ev = Step.step(c, { a: 'move', dir: Path.dirTo([c.actors[0].x, c.actors[0].y], q) });
      assert.ok(ev.some(e => e.k === 'damaged' && e.who === cp.uid), `the last step at ${fx},${fy} strikes it`);
    }
    // A Centrepiece filling a two-wide corridor: the path goes up to it and stops.
    const hall = Setup.room(1, { acc: 'T0', depth: 1, map: ['##########', '#........#', '#........#', '##########'], you: [1, 1],
      exhibits: [{ sp: 'cp', at: [5, 1], size: 2, mode: 'dormant', stats: Roles.stats('centrepiece', 1) }] });
    same(Path.to(hall, 8, 2), [[2, 1], [3, 1], [4, 1]], 'as far as the way is clear');
  });

  test('the strip shows hunting and awake exhibits as one tier, nearest first, then sleeping ones (§8.8)', () => {
    const map = ['##########', '#........#', '#........#', '#........#', '#........#', '#........#', '##########'];
    const ex = (at, mode) => ({ sp: 'x', at, mode, stats: { hp: 5, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 2 } });
    const pick = (exhibits, you) => { const s = Setup.room(1, { acc: 'T0', depth: 1, map, you: you || [2, 2], exhibits }), t = Labels.strip(s); return t && s.actors.findIndex(a => a.uid === t.uid); };
    assert.equal(pick([ex([3, 2], 'dormant'), ex([4, 2], 'hunting')]), 2, 'hunting at 2 before sleeping at 1');
    assert.equal(pick([ex([4, 2], 'hunting'), ex([3, 2], 'awake')]), 2, 'awake at 1 before hunting at 2: one tier');
    assert.equal(pick([ex([4, 2], 'hunting'), ex([3, 3], 'returning')]), 2, 'returning at 1 before hunting at 2');
    assert.equal(pick([ex([4, 2], 'awake'), ex([2, 4], 'hunting')]), 1, 'a tie goes to spawn order');
    assert.equal(pick([ex([4, 4], 'dormant'), ex([3, 3], 'dormant')]), 2, 'the nearer sleeping exhibit');
    assert.equal(pick([ex([5, 2], 'hunting'), ex([4, 2], 'dormant')]), 2, 'a hunter 3 tiles away is out of reach');
    assert.equal(pick([ex([5, 2], 'hunting')]), null);
    // A 2×2 Centrepiece counts from its nearest tile: anchor 3 away, footprint 2.
    const s = centre([7, 3]), t = Labels.strip(s);
    assert.ok(t && t.uid === s.actors[1].uid, 'the Centrepiece, 2 tiles from its nearest tile');
    // Sight: to any of its tiles. With the footprint at (3..4, 3..4) and you at (1,4), a
    // column at (2,3) hides the anchor but not (3,4); a second at (2,4) hides every tile.
    const hidden = OPEN.slice(); hidden[3] = '#.o......#';
    const h = centre([1, 4], 'dormant', hidden);
    h.actors[1].x = 3;
    assert.equal(Grid.los(h.dept, 1, 4, 3, 3), false);
    assert.ok(Labels.strip(h), 'seen by its lower tiles');
    const blind = OPEN.slice(); blind[3] = '#.o......#'; blind[4] = '#.o......#';
    const b = centre([1, 4], 'dormant', blind);
    b.actors[1].x = 3;
    assert.ok(foot(b.actors[1]).every(([fx, fy]) => !Grid.los(b.dept, 1, 4, fx, fy)));
    assert.equal(Labels.strip(b), null, 'none of its tiles in sight');
  });

  test('sentences name exhibits by species, and keep the test room’s wording without names', () => {
    // The Dawn-Caller and the Brooder, which M3's S.9 places; and the Centrepiece, stood on
    // its plinth by hand, since M3 departments leave it out.
    const s = Dept.create(4, 'S9', 1), you = s.actors[0], names = Labels.nameOf(s);
    const caller = s.actors.find(a => a.sp === 'S9.3'), brooder = s.actors.find(a => a.sp === 'S9.4'), cp = withCentrepiece(s);
    assert.equal(names(caller.uid), 'the Dawn-Caller on a Perch');
    assert.equal(names(brooder.uid), 'the Ground-Nesting Brooder, With Its Nest');
    assert.equal(names(cp.uid), 'the Composite, Assembled From the Round Books');
    assert.equal(names('you'), null);
    const struck = { k: 'damaged', turn: 3, who: caller.uid, amount: 6, hp: 10, cause: { k: 'attack', by: 'you', at: caller.uid, chance: 80, surprise: 1, raw: 6, pad: 0 } };
    assert.equal(Text.event(struck, names), 'You caught the Dawn-Caller on a Perch unawares: 6 damage (6 − 0 Padding).');
    const back = { k: 'missed', turn: 4, by: brooder.uid, at: 'you', cause: { k: 'attack', by: brooder.uid, at: 'you', chance: 70, roll: 88 } };
    assert.equal(Text.event(back, names), 'The Ground-Nesting Brooder, With Its Nest missed you (rolled 88 against 70%).');
    const big = { k: 'missed', turn: 4, by: cp.uid, at: 'you', cause: { k: 'attack', by: cp.uid, at: 'you', chance: 70, roll: 88 } };
    assert.equal(Text.event(big, names), 'The Composite, Assembled From the Round Books missed you (rolled 88 against 70%).');
    assert.equal(Text.event({ k: 'hunting', turn: 3, who: caller.uid, was: 'dormant', cause: { k: 'damage', by: 'you' } }, names), 'The Dawn-Caller on a Perch woke: it was struck.');
    assert.equal(Text.event({ k: 'died', turn: 9, who: caller.uid, cause: {} }, names), 'The Dawn-Caller on a Perch broke apart.');
    assert.equal(Text.event({ k: 'died', turn: 9, who: 'you', cause: {} }, names), 'You fell.');
    // No names, a nameOf that knows nobody, or a map callback's index: the test room's words.
    for (const e of [struck, back]) {
      const plain = Text.event(e);
      assert.ok(/the training dummy/i.test(plain), plain);
      assert.equal(Text.event(e, () => null), plain);
      assert.equal([e].map(Text.event)[0], plain);
    }
    // From a real step: every sentence names the species it is about.
    [you.x, you.y] = beside(s, caller);
    const ev = Step.step(s, { a: 'attack', uid: caller.uid }), lines = ev.map(e => Text.event(e, names)).filter(Boolean);
    assert.ok(lines.length && lines.every(l => !/training dummy|undefined|NaN|\[object/.test(l)), lines.join(' / '));
    assert.ok(lines.some(l => l.includes('the Dawn-Caller on a Perch')), lines.join(' / '));
  });


  test('every exhibit in the packs has a title, tombstone, Behaviour line and paragraph', () => {
    for (const p of Packs.list()) for (const sp of [...p.species, p.centrepiece]) {
      assert.ok(sp.name && sp.tomb && sp.tomb.maker && sp.paragraph, `${sp.id} is missing label text`);
    }
  });

  test('every pictogram is drawn in a reserved semantic colour, and the clock and the chime differ', () => {
    const semantic = JSON.parse(fs.readFileSync(path.join(root, 'art/palettes.json'), 'utf8')).semantic;
    for (const id of Pictograms.ids) {
      assert.ok(Object.prototype.hasOwnProperty.call(semantic, Pictograms.COLOUR[id]), `${id}: '${Pictograms.COLOUR[id]}' is not a semantic colour`);
      assert.ok(Pictograms.svg(id, 8).includes(`fill="${ART.palettes.semantic[Pictograms.COLOUR[id]]}"`), `${id} is drawn in its colour`);
    }
    assert.deepEqual(Object.keys(Pictograms.COLOUR).filter(id => !Pictograms.ids.includes(id)), [], 'colours for pictograms that do not exist');
    for (const icon of [...Registry.SYSTEMS.map(s => s.icon), ...Object.values(Registry.TRIGGERS).map(t => t.icon)]) assert.ok(Pictograms.G[icon], `no pictogram ${icon}`);
    assert.equal(Registry.SYSTEMS.find(s => s.id === 'clock').icon, 'clock');
    // Every status and surface has its own pictogram, keyed by its id (§8.8: one per
    // mechanical fact), so the top bar and the labels can show it.
    for (const t of ['STATUSES', 'SURFACES']) for (const id of Registry.order(t)) {
      assert.equal(Registry[t][id].icon, id, `${t}.${id}'s pictogram is its id`);
      assert.ok(Pictograms.G[id] && Pictograms.COLOUR[id], `${t}.${id} has no pictogram`);
    }
    assert.equal(Registry.TRIGGERS.period.icon, 'period');
    const shapes = Pictograms.ids.map(id => Pictograms.G[id].join(''));
    assert.equal(new Set(shapes).size, shapes.length, 'two pictograms share a shape');
  });
};
