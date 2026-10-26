// M3 criterion 2 (BUILD.md §11's M3 row; §8.1, the odds readout): the readout a label shows
// equals an independent count for every pack species M3 places and the Night Watchman, at
// depths 1–7, over your kit space (every pack item, both tiers on offer at the depth,
// Restoration levels 0–3, 0–2 grades short, Reach) and the modes and statuses that change it.
// The count below is written out again from §8.1's text, never from combat.js or labels.js:
// it models the axis_sniper's missing blow ("It has no blow and shoots no bolts"), a swarm
// body's any-hit rule, a splitter's halves (the hits on it and on every half it splits off),
// an old repair's doubled side, the kiter's shots (its only attack), Reach, each special's
// line, and no surprise line for an exhibit in an intact case, which no blow of yours
// reaches. m2.test.js uses the same model (module.exports.model).
'use strict';

// The independent model, for a core context C.
function model(C) {
  const { N, Registry } = C;
  const has = (x, id) => (x.statuses || []).some(st => st.id === id);
  // §8.1: clamp(75 + 5(Acc − Eva) + 20 if the defender is fixed − 20 if the attacker is dazed, 10, 95).
  const hit = (att, def) => Math.min(95, Math.max(10, 75 + 5 * (att.acc - def.eva) + (has(def, 'fixed') ? 20 : 0) - (has(att, 'dazed') ? 20 : 0)));
  const sum = xs => xs.reduce((p, q) => p + q, 0);
  const halfUp = (num, den) => { const q = Math.floor(num / den); return 2 * (num - q * den) >= den ? q + 1 : q; };
  // The role curves (§8.1): anchored at depths 1, 4 and 8, linear between, rounded down.
  const curve = (v, d) => d <= 1 ? v[0] : d <= 4 ? v[0] + Math.floor((v[1] - v[0]) * (d - 1) / 3) : d <= 8 ? v[1] + Math.floor((v[2] - v[1]) * (d - 4) / 4) : v[2];
  // What each archetype is said to do (§8.1, §5.5): no blow, falls to any hit, shoots, its special.
  const NO_BLOW = ['axis_sniper'], ANY_HIT = ['mote_swarm'], SHOOTS = ['kiter'], SPLITS = ['splitter'];
  const SPECIAL = { axis_sniper: 'line', tethered_warden: 'ring', herald: 'call' };
  // An old repair's side (§5.5): damage from that compass point or its two neighbours, as
  // seen from the body's nearest tile, is doubled.
  const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'], VEC = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  function repaired(state, a, x, y) {
    const p = a.modParams && a.modParams.old_repair, off = (state.options.rulesOff || []).includes('old_repair');
    if (!p || off || !(a.mods || []).includes('old_repair')) return false;
    const s = a.size || 1, nx = Math.min(Math.max(x, a.x), a.x + s - 1), ny = Math.min(Math.max(y, a.y), a.y + s - 1);
    const v = [Math.sign(x - nx), Math.sign(y - ny)], i = POINTS.indexOf(p.side);
    if (v[0] === 0 && v[1] === 0) return false;
    return [i, (i + 1) % 8, (i + 7) % 8].some(k => VEC[k][0] === v[0] && VEC[k][1] === v[1]);
  }
  // What a hit of yours of `d` after Padding takes from a: all its health for a swarm body,
  // twice d through an old repair's side.
  const yours = (state, you, a, d) => ANY_HIT.includes(a.arch) ? a.hp : repaired(state, a, you.x, you.y) ? 2 * d : d;
  const nets = (att, def) => { const out = []; for (let r = att.dmin; r <= att.dmax; r++) out.push(Math.max(1, r - def.pad)); return out; };
  // Surprise (§8.1): asleep or stirring, or awake without having seen you since it woke; but
  // never for an exhibit in an intact case (any tile of it on a vitrine, §8.3), which no blow
  // of yours reaches now, and which getting out wakes.
  const encased = (state, a) => { for (let dy = 0; dy < (a.size || 1); dy++) for (let dx = 0; dx < (a.size || 1); dx++) if (state.dept.tiles[a.y + dy][a.x + dx] === 'v') return true; return false; };
  const unaware = (state, a) => !encased(state, a) && (a.mode === 'dormant' || (a.mode === 'awake' && !a.sawYou));
  // A splitter's hits needed (§8.1): every hit of yours deals the mean net hit, Σd ÷ n, kept
  // exact by counting health in n-ths of a point. A hit a body survives with 2 or more health
  // below generation SPLIT_MAX passes SPLIT_HP_PCT% of what it has left (rounded down, in
  // n-ths, and at least 1 health) to a new half, both a generation on; each half is fought
  // the same way, and each body's last hit is spent on it whole. Counted with a list of the
  // bodies still standing; {hits, halves}.
  function lineage(hp, gen, n, s) {
    const left = [[hp * n, gen]];
    let hits = 0, halves = 0;
    while (left.length) {
      const b = left.pop();
      while (b[0] > 0) {
        b[0] -= s; hits++;
        if (b[0] < 2 * n || b[1] >= N.SPLIT_MAX) continue;
        const share = Math.max(n, Math.floor(b[0] * N.SPLIT_HP_PCT / 100));
        b[0] -= share; b[1]++; halves++;
        left.push([share, b[1]]);
      }
    }
    return { hits, halves };
  }
  const fig = r => r[0] === r[1] ? [r[0]] : r;
  const fmt = r => r[0] === r[1] ? String(r[0]) : `${r[0]}–${r[1]}`;
  // The figure of a surprise blow: its maximum (×1.5 rounded down with a Light weapon beside
  // it, never with Reach), or against a Centrepiece the rolled range.
  function surprise(state, you, a, kind) {
    const mine = nets(you, a).map(d => yours(state, you, a, d));
    if (a.role === 'centrepiece') return [Math.min(...mine), Math.max(...mine)];
    const raw = kind === 'melee' && you.weaponForm === 'light' ? Math.floor(you.dmax * 3 / 2) : you.dmax;
    const d = yours(state, you, a, Math.max(1, raw - a.pad));
    return [d, d];
  }

  // expected(state, you, a) → {nums, lines, blow, mine, toIt, surprise, halves}: every number
  // the readout's lines show, in order, how many lines there are, and how many halves the
  // hits needed count.
  function expected(state, you, a) {
    const depth = state.dept.depth, hp = Math.max(1, you.hp), blow = !NO_BLOW.includes(a.arch);
    const t = nets(a, you), m = nets(you, a).map(d => yours(state, you, a, d));
    const nums = [];
    let lines = 0;
    const toYou = hit(a, you), toIt = hit(you, a);
    // An exhibit that shoots and never strikes (the kiter) says so in one line, its range first.
    if (blow) {
      if (SHOOTS.includes(a.arch)) nums.push(N.ROLE_ARTILLERY_RANGE);
      nums.push(toYou, halfUp(100 * sum(t), t.length * hp), Math.ceil(hp / Math.max(...t))); lines++;
    }
    let need = ANY_HIT.includes(a.arch) ? 1 : Math.ceil(a.hp * m.length / sum(m)), halves = 0;
    if (SPLITS.includes(a.arch) && (a.size || 1) === 1) { const l = lineage(a.hp, a.gen || 0, m.length, sum(m)); need = l.hits; halves = l.halves; }
    nums.push(toIt, need); lines++;
    if (you.reach) { nums.push(N.REACH_RANGE); lines++; }
    let sur = null;
    if (unaware(state, a)) {
      const mel = surprise(state, you, a, 'melee'), rch = you.reach ? surprise(state, you, a, 'reach') : mel;
      nums.push(...fig(mel));
      if (rch[0] !== mel[0] || rch[1] !== mel[1]) nums.push(...fig(rch), N.REACH_RANGE);
      lines++;
      sur = { melee: mel, reach: rch };
    }
    const sp = SPECIAL[a.arch];
    if (sp === 'ring') { const g = curve(N.ROLE_WARDEN_SPECIAL, depth); nums.push(Math.max(1, g - you.pad), g, N.ROLE_WARDEN_SPECIAL_EVERY); lines++; }
    if (sp === 'line') { const g = curve(N.ROLE_ARTILLERY_SPECIAL, depth); nums.push(Math.max(1, g - you.pad), g, N.AXIS_BEAM_RANGE); lines++; }
    if (sp === 'call') { nums.push(N.HERALD_RANGE); lines++; }
    return { nums, lines, blow, toIt, mine: [Math.min(...m), Math.max(...m)], surprise: sur, halves };
  }
  // The Attack button a label should offer (§7.1): one exactly when step() takes the blow,
  // which the test asks step() itself on a copy; its text names a Reach blow when you are not
  // beside it, and a surprise blow's certain hit.
  // takes(): whether step() takes the blow, asked of step() on a copy unless the caller
  // already knows (a cache keyed by what decides it: where you stand, Reach, statuses).
  const takes = (state, a) => { const ev = C.Step.step(C.State.clone(state), { a: 'attack', uid: a.uid }); return !(ev.length === 1 && ev[0].k === 'refused'); };
  function button(state, you, a, known) {
    if (!(known === undefined ? takes(state, a) : known)) return [];
    const e = expected(state, you, a), beside = Math.max(Math.abs(a.x - you.x), Math.abs(a.y - you.y)) === 1 || (a.size || 1) > 1;
    const kind = beside ? 'melee' : 'reach', what = kind === 'reach' ? 'Attack with Reach' : 'Attack';
    const text = e.surprise ? `${what}: certain hit, ${fmt(e.surprise[kind])} damage` : `${what}: ${e.toIt}%, ${fmt(e.mine)} damage`;
    return [{ id: 'attack', text, act: { a: 'attack', uid: a.uid } }];
  }
  const numbers = lines => (lines.join(' ').match(/\d+/g) || []).map(Number);
  return { expected, button, takes, numbers, curve, lineage, encased, NO_BLOW, ANY_HIT, SHOOTS, SPLITS, SPECIAL, Registry };
}

module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const { Setup, Packs, Registry, Roles, Labels, Status, Kit, N, State, Step } = C;
  const M = model(C);
  const json = v => JSON.stringify(v);

  // Every species M3 places (its archetype built in M3, §5.5, D7.6), with its pack, and the
  // Night Watchman, a shared species.
  const SPECIES = [];
  for (const p of Packs.list()) for (const sp of p.species) if (Registry.ARCHETYPES[sp.archetype] && Registry.ARCHETYPES[sp.archetype].built === 'M3') SPECIES.push({ acc: p.acc, sp });
  SPECIES.push({ acc: 'M11', sp: Packs.shared('night_watchman') });
  // Every item in the packs, by kind.
  const ITEMS = [];
  for (const p of Packs.list()) for (const r of p.items || []) ITEMS.push(r);
  const OPEN = ['###########', '#.........#', '#.........#', '#.........#', '#.........#', '#.........#', '###########'];

  // A room with one exhibit of sp at (4, 3), hunting, and you beside it at (5, 3).
  function room(acc, sp, depth) {
    return Setup.room(depth, { acc, depth, map: OPEN, you: [5, 3], exhibits: [{ sp: sp.id, at: [4, 3], mode: 'hunting', stats: Roles.stats(sp.role, depth) }] });
  }
  // Your kit space at a depth: each pack item (and the starting pieces, and a plain Reach
  // weapon) of each tier on offer (the lower and the next, never above T4, the highest, so
  // T4 alone at depth 7: Kit.drawTier), each level 0–3, each 0–2 grades short where that is
  // possible; [{slot, rec, tier, level, grade}].
  function kits(depth) {
    const T = N.TIER_LOW_BY_DEPTH, low = T[depth - 1], high = Math.min(low + 1, T[T.length - 1]), out = [];
    const pieces = ITEMS.filter(r => r.kind === 'weapon' || r.kind === 'garment').concat([
      { id: null, kind: 'weapon', form: 'balanced', prims: [] }, { id: null, kind: 'weapon', form: 'reach', prims: [] }, { id: null, kind: 'garment', form: 'standard', prims: [] }]);
    for (const rec of pieces) for (const tier of low === high ? [low] : [low, high]) for (let level = 0; level <= 3; level++) {
      const needs = Kit.needs({ kind: rec.kind, form: rec.form, tier });
      for (let short = 0; short <= 2; short++) {
        const g = needs - short;
        if (g < N.GRADE_START || g > N.GRADE_MAX || (short > 0 && needs <= N.GRADE_START)) continue;
        out.push({ slot: rec.kind, rec, tier, level, grade: g });
      }
    }
    for (const rec of ITEMS.filter(r => r.kind === 'curio' || r.kind === 'instrument')) for (let level = 0; level <= 3; level++) out.push({ slot: rec.kind, rec, tier: low, level, grade: N.GRADE_START });
    return out;
  }
  // Wear one piece of a kit config, the starting pieces for the rest; your stats follow.
  function wear(s, k) {
    const w = s.items.find(i => i.uid === 'you.w'), g = s.items.find(i => i.uid === 'you.g');
    Object.assign(w, { ref: null, form: 'balanced', tier: 1, level: 0, prims: [] });
    Object.assign(g, { ref: null, form: 'standard', tier: 1, level: 0, prims: [] });
    s.you.kit.curio = [null, null]; s.you.kit.instrument = null;
    s.items = s.items.filter(i => i.uid === 'you.w' || i.uid === 'you.g');
    const target = k.slot === 'weapon' ? w : k.slot === 'garment' ? g : null;
    if (target) Object.assign(target, { ref: k.rec.id, form: k.rec.form, tier: k.tier, level: k.level, prims: k.rec.prims.map(p => ({ id: p.id, cls: p.cls })) });
    else {
      const it = Kit.item({ uid: 'odds.' + k.slot, kind: k.slot, ref: k.rec.id, where: { at: 'kit', slot: k.slot === 'curio' ? 'curio0' : 'instrument' },
        form: k.slot === 'instrument' ? k.rec.instrument : null, tier: k.slot === 'instrument' ? k.tier : null, level: k.level, prims: k.rec.prims.map(p => ({ id: p.id, cls: p.cls })) });
      s.items.push(it);
      if (k.slot === 'curio') s.you.kit.curio[0] = it.uid; else s.you.kit.instrument = it.uid;
    }
    s.run.grade = k.grade;
    Kit.settle(s);
  }

  test('criterion 2: the odds readout equals an independent count for every pack species and the Watchman, depths 1–7, over your kit space', () => {
    const ran = new Set(), pairs = new Set();
    let checked = 0, buttons = 0;
    for (const { acc, sp } of SPECIES) for (let depth = 1; depth <= 7; depth++) {
      const s = room(acc, sp, depth), a = s.actors[1], you = s.actors[0];
      assert.equal(a.arch, sp.archetype, `${sp.id} d${depth}`);
      const full = a.hp, takesAt = new Map();
      // Where you stand: beside it to the east; to the west too for an old repair (its side
      // is the pack's, W for the Signal Lamp); and 2 tiles east with a Reach weapon.
      for (const k of kits(depth)) {
        wear(s, k);
        const spots = [[5, 3]];
        if ((a.mods || []).includes('old_repair')) spots.push([3, 3]);
        if (you.reach) spots.push([6, 3]);
        for (const [x, y] of spots) for (const mode of ['hunting', 'dormant', 'awake']) for (const hp of [full, 1]) {
          you.x = x; you.y = y; a.mode = mode; a.sawYou = mode === 'awake' && k.level % 2 === 1; a.hp = hp;
          const got = Labels.odds(s, a), e = M.expected(s, you, a), where = `${sp.id} d${depth} ${k.slot} ${k.rec.id || k.rec.form} t${k.tier} L${k.level} grade ${k.grade} at ${x},${y} ${mode} hp ${hp}`;
          assert.deepEqual(M.numbers(got), e.nums, `${where}: ${got.join(' ')}`);
          assert.equal(got.length, e.lines, `${where}: ${got.join(' ')}`);
          checked++;
          pairs.add(`${a.acc - you.eva}`); pairs.add(`${you.acc - a.eva}`);
          ran.add('arch:' + a.arch); ran.add('slot:' + k.slot); ran.add('short:' + (Kit.needs({ kind: k.slot, form: k.rec.form, tier: k.tier }) - k.grade));
          if (you.reach) ran.add(x === 6 ? 'reach:2-away' : 'reach:beside');
          if (e.surprise && (e.surprise.melee[0] !== e.surprise.reach[0])) ran.add('surprise:light-reach');
          if (e.halves) ran.add('splitter:halves'); else if (M.SPLITS.includes(a.arch)) ran.add('splitter:none');
          if (x === 3) ran.add('old_repair:side'); if (x === 5 && (a.mods || []).includes('old_repair')) ran.add('old_repair:other');
          // The label's Attack button, beside it or with Reach, as step() would take it.
          if (hp === full && mode !== 'awake') {
            const key = `${x},${y},${you.reach}`;
            if (!takesAt.has(key)) takesAt.set(key, M.takes(s, a));
            assert.equal(json(Labels.of(s, a.uid).actions), json(M.button(s, you, a, takesAt.get(key))), where);
            buttons++;
          }
        }
        a.hp = full; a.mode = 'hunting'; delete a.sawYou;
      }
    }
    // The slice's Acc − Eva differences lie inside W1-COMBAT's tested range (criterion 1 runs
    // −30 to +30 with every modifier set: none, fixed, dazed, both).
    const diffs = [...pairs].map(Number);
    assert.ok(Math.min(...diffs) >= -30 && Math.max(...diffs) <= 30, `Acc − Eva runs ${Math.min(...diffs)} to ${Math.max(...diffs)}`);
    const want = ['arch:plodder', 'arch:darter', 'arch:kiter', 'arch:axis_sniper', 'arch:splitter', 'arch:mote_swarm', 'arch:herald', 'arch:tethered_warden',
      'arch:reflector', 'arch:mimic_vitrine', 'arch:night_watchman', 'slot:weapon', 'slot:garment', 'slot:curio', 'slot:instrument', 'short:0', 'short:1', 'short:2',
      'reach:beside', 'reach:2-away', 'surprise:light-reach', 'old_repair:side', 'old_repair:other', 'splitter:halves', 'splitter:none'];
    assert.deepEqual(want.filter(k => !ran.has(k)), [], 'branches never run');
    assert.ok(checked > 100000 && buttons > 20000, `${checked} readouts, ${buttons} buttons checked`);
    console.log(`  criterion 2: ${checked} readouts and ${buttons} Attack buttons checked; Acc − Eva from ${Math.min(...diffs)} to ${Math.max(...diffs)}`);
  });

  test('statuses on either side change the odds as §8.1 says: fixed +20 to hit it, dazed −20 to its blows', () => {
    let checked = 0;
    for (const { acc, sp } of SPECIES) for (const depth of [1, 4, 7]) {
      const s = room(acc, sp, depth);
      for (const set of [[], [['you', 'fixed']], [['you', 'dazed']], [['it', 'fixed']], [['it', 'dazed']], [['you', 'dazed'], ['it', 'fixed']], [['you', 'fixed'], ['it', 'dazed']]]) {
        const t = State.clone(s), b = t.actors[1], me = t.actors[0];
        for (const [who, id] of set) Status.apply(t, who === 'you' ? me : b, id, 5, { k: 'status', id }, []);
        Status.settle(t);
        const got = Labels.odds(t, b), e = M.expected(t, me, b);
        assert.deepEqual(M.numbers(got), e.nums, `${sp.id} d${depth} ${json(set)}: ${got.join(' ')}`);
        assert.equal(json(Labels.of(t, b.uid).odds), json(got), 'the label shows the readout');
        checked++;
      }
    }
    assert.ok(checked >= SPECIES.length * 3 * 7);
  });

  test('the readout\'s special lines say what each special does: its net and gross, with no roll, and its reach and cadence', () => {
    for (const { acc, sp } of SPECIES) {
      if (!M.SPECIAL[sp.archetype]) continue;
      const s = room(acc, sp, 5), a = s.actors[1], line = Labels.odds(s, a).find(l => /^Its (ring of blows|beam|call)/.test(l));
      const shape = M.SPECIAL[sp.archetype], g = shape === 'ring' ? M.curve(N.ROLE_WARDEN_SPECIAL, 5) : M.curve(N.ROLE_ARTILLERY_SPECIAL, 5), net = Math.max(1, g - s.actors[0].pad);
      if (shape === 'ring') assert.equal(line, `Its ring of blows would deal you ${net} (${g} before your Padding), with no roll, on the tiles round it, at most one action in ${N.ROLE_WARDEN_SPECIAL_EVERY}.`);
      if (shape === 'line') assert.equal(line, `Its beam would deal you ${net} (${g} before your Padding), with no roll, up to ${N.AXIS_BEAM_RANGE} tiles along a row or column.`);
      if (shape === 'call') assert.equal(line, `Its call deals no damage: it wakes the sleeping exhibits within ${N.HERALD_RANGE} tiles of it that can hear.`);
    }
    // The kiter's shots, its only attack (it never strikes, §8.1's kiter rules), "rolled as
    // blows are" (§8.1): one line, first, with its range and its blow's chance and damage, and
    // no line that would tell of a blow beside you.
    const k = SPECIES.find(x => x.sp.archetype === 'kiter'), s = room(k.acc, k.sp, 3), lines = Labels.odds(s, s.actors[1]), e = M.expected(s, s.actors[0], s.actors[1]);
    const [range, chance, typ, worst] = e.nums;
    assert.equal(range, N.ROLE_ARTILLERY_RANGE);
    assert.equal(lines[0], `It shoots at you within ${range} tiles: ${chance === 11 || chance === 18 || String(chance)[0] === '8' ? 'an' : 'a'} ${chance}% chance to hit you, typically for ${typ}% of your current health, and at worst it could defeat you in ${worst} ${worst === 1 ? 'hit' : 'hits'}.`);
    assert.ok(!lines.some(l => /^It has an? \d+% chance|also shoots/.test(l)), lines.join(' '));
  });

  test('with Reach, from a Reach weapon or from another with the reach primitive (a Light one included), the readout says your weapon strikes with Reach', () => {
    // §8.5: the reach primitive's blows "reach … as a Reach weapon's do", on any form; so the
    // line names the Reach, not the weapon's form.
    const k = SPECIES.find(x => x.sp.archetype === 'plodder'), stamp = ITEMS.find(r => r.id === 'A4.6');
    assert.ok(stamp && stamp.form === 'light' && stamp.prims.some(q => q.id === 'reach'), 'the Long-Handled Date Stamp: Light, with reach');
    const line = `Your weapon also strikes it with Reach, from exactly ${N.REACH_RANGE} tiles away in a straight line, over a clear tile between.`;
    for (const rec of [stamp, { id: null, kind: 'weapon', form: 'reach', prims: [] }]) {
      const s = room(k.acc, k.sp, 3), a = s.actors[1], you = s.actors[0];
      wear(s, { slot: 'weapon', rec, tier: 1, level: 0, grade: Kit.needs({ kind: 'weapon', form: rec.form, tier: 1 }) });
      assert.ok(you.reach && you.weaponForm === rec.form, `${rec.form}: you have Reach`);
      for (const [x, mode] of [[5, 'hunting'], [6, 'dormant']]) {
        you.x = x; a.mode = mode;
        const lines = Labels.odds(s, a);
        assert.ok(lines.includes(line), `${rec.form} at ${x}: ${lines.join(' ')}`);
        assert.ok(!lines.some(l => /Reach weapon/.test(l)), `${rec.form}: ${lines.join(' ')}`);
      }
    }
  });

  test('an old repair\'s side doubles your figures only from that side, and not with old_repair switched off', () => {
    const lamp = SPECIES.find(x => (x.sp.modifiers || []).includes('old_repair'));
    assert.ok(lamp, 'a pack species with old_repair');
    for (const rulesOff of [[], ['old_repair']]) {
      const s = Setup.room(3, { acc: lamp.acc, depth: 3, map: OPEN, you: [3, 3], exhibits: [{ sp: lamp.sp.id, at: [4, 3], mode: 'dormant', stats: Roles.stats(lamp.sp.role, 3) }] }, { rulesOff });
      const a = s.actors[1], at = (x, y) => { s.actors[0].x = x; s.actors[0].y = y; return Labels.odds(s, a).join(' '); };
      const side = lamp.sp.modParams.old_repair.side, west = side === 'W';
      assert.ok(west, 'the Signal Lamp is repaired on its west side');
      const from = { W: at(3, 3), NW: at(3, 2), SW: at(3, 4), E: at(5, 3), N: at(4, 2) };
      const sur = l => Number(/for certain, for (\d+)/.exec(l)[1]);
      if (rulesOff.length) assert.ok(sur(from.W) === sur(from.E), 'switched off, every side is alike');
      else {
        assert.ok(sur(from.W) === sur(from.NW) && sur(from.W) === sur(from.SW) && sur(from.W) === 2 * sur(from.E) && sur(from.N) === sur(from.E), JSON.stringify(from));
      }
    }
  });

  // §8.1: a splitter's hits needed count it and every half it splits off. Whatever the line
  // claims, seeded fights must bear out: "to destroy it" alone claims the body (the hits until
  // it falls), "to destroy it and every half it splits off" the body and all its halves. You
  // are invulnerable beside it in an open room, so there is room for every split, and strike
  // the first body you can until none is left. "Typically" is a mean hit's count, as for any
  // exhibit (a body's count can be about a hit off what fights average, each split body its own
  // count), so the claim must lie within one hit for each body the fights destroyed.
  test('a splitter\'s hits needed count the hits on it and on every half it splits off, as seeded fights take them', () => {
    const SEEDS = 40;
    let checked = 0, whole = 0;
    for (const { acc, sp } of SPECIES.filter(x => x.sp.archetype === 'splitter')) for (let depth = 1; depth <= 7; depth++) {
      let body = 0, all = 0, bodies = 0, claim = null;
      for (let seed = 1; seed <= SEEDS; seed++) {
        const s = Setup.room(seed, { acc, depth, map: OPEN, you: [4, 3], exhibits: [{ sp: sp.id, at: [5, 3], mode: 'hunting', stats: Roles.stats(sp.role, depth) }] }, { invulnerable: true });
        const a = s.actors[1], standing = () => s.actors.some(b => b.arch === 'splitter' && !b.gone);
        if (!claim) {
          const line = Labels.odds(s, a).find(l => /typically need/.test(l)), e = M.expected(s, s.actors[0], a);
          claim = /typically need (\d+) hits? to destroy it( and every half it splits off)?\.$/.exec(line);
          assert.ok(claim, `${sp.id} d${depth}: ${line}`);
          claim = { n: Number(claim[1]), whole: !!claim[2], line, halves: e.halves };
        }
        let hits = 0, fell = null;
        for (let i = 0; i < 400 && standing(); i++) {
          const att = Step.legal(s).filter(l => l.a === 'attack');
          for (const e of Step.step(s, att.length ? att[0] : { a: 'wait' })) if (e.k === 'damaged' && e.who !== 'you' && e.cause && e.cause.by === 'you') hits++;
          if (fell === null && a.gone) fell = hits;
        }
        assert.ok(!standing() && fell !== null, `${sp.id} d${depth} seed ${seed}: the fight did not end`);
        body += fell; all += hits; bodies += s.actors.length - 1;
      }
      const mean = (claim.whole ? all : body) / SEEDS, tol = claim.whole ? bodies / SEEDS : 1;
      assert.ok(Math.abs(mean - claim.n) <= tol,
        `${sp.id} d${depth}: "${claim.line}", but ${claim.whole ? 'it and its halves fell' : 'the body fell'} after ${mean.toFixed(2)} hits on average (within ${tol.toFixed(2)} allowed; the body alone after ${(body / SEEDS).toFixed(2)}, with its halves after ${(all / SEEDS).toFixed(2)})`);
      assert.equal(claim.whole, claim.halves > 0, `${sp.id} d${depth}: the line names the halves exactly when it counts some: ${claim.line}`);
      checked++; if (claim.whole) whole++;
    }
    assert.ok(checked === 14 && whole >= 10, `${checked} species and depths, ${whole} naming the halves`);
  });

  // §8.1, §8.3: an exhibit in an intact case keeps its lines but the surprise line: no blow of
  // yours reaches it (behind_glass), and getting it out wakes it (bashing wakes it hunting;
  // opening beside it fills its pips). Once its case is open, the readout says what it then
  // says: the surprise line again while it still sleeps.
  test('a sleeping exhibit in an intact case has no surprise line; out of its case, the readout is the count\'s again', () => {
    const MAP = ['#######', '#.....#', '#..v..#', '#.....#', '#######'];
    let checked = 0;
    for (const { acc, sp } of SPECIES) {
      if (sp.archetype === 'mimic_vitrine' || sp.archetype === 'night_watchman') continue;
      for (const mode of ['dormant', 'awake']) {
        const s = Setup.room(1, { acc, depth: 3, map: MAP, you: [3, 1], grade: 7, exhibits: [{ sp: sp.id, at: [3, 2], mode, stats: Roles.stats(sp.role, 3) }],
          fixtures: [C.Cases.make({ x: 3, y: 2, room: 'room', num: 'T.0.101.32', glass: 1, lock: 1 })] });
        const a = s.actors[1], you = s.actors[0], where = `${sp.id} ${mode}`;
        assert.ok(C.Cases.encased(s, a) && C.Combat.surprised(you, a), `${where}: in its case, unaware of you`);
        assert.equal(C.Combat.canStrike(s, you, a, { kind: 'melee' }), 'behind_glass', where);
        let lines = Labels.odds(s, a);
        assert.ok(!lines.some(l => /surprise/i.test(l)), `${where}: ${lines.join(' ')}`);
        assert.deepEqual(M.numbers(lines), M.expected(s, you, a).nums, `${where}: ${lines.join(' ')}`);
        assert.equal(lines.length, M.expected(s, you, a).lines, where);
        // Out of its case, still unaware (its case's tile now an opened case), the line returns.
        const t = State.clone(s), b = t.actors[1];
        t.dept.tiles[2] = t.dept.tiles[2].slice(0, 3) + 'u' + t.dept.tiles[2].slice(4);
        lines = Labels.odds(t, b);
        assert.ok(lines.some(l => /^A surprise attack now would hit for certain/.test(l)), `${where}, out: ${lines.join(' ')}`);
        assert.deepEqual(M.numbers(lines), M.expected(t, t.actors[0], b).nums, `${where}, out: ${lines.join(' ')}`);
        // Opened or broken by you, it is what the count says, whatever that is then.
        for (const act of [{ a: 'open', x: 3, y: 2 }, { a: 'bash', x: 3, y: 2 }]) {
          const u = State.clone(s);
          for (let i = 0; i < 20 && u.dept.tiles[2][3] === 'v' && !u.over; i++) Step.step(u, act);
          const c = u.actors[1];
          if (c.gone || u.over) continue;
          lines = Labels.odds(u, c);
          assert.deepEqual(M.numbers(lines), M.expected(u, u.actors[0], c).nums, `${where} after ${act.a}: ${lines.join(' ')}`);
          assert.equal(lines.some(l => /surprise/i.test(l)), !C.Cases.encased(u, c) && C.Combat.surprised(u.actors[0], c), `${where} after ${act.a}: ${lines.join(' ')}`);
          checked++;
        }
      }
    }
    assert.ok(checked > 20, `${checked} cases opened or broken`);
  });
};
module.exports.model = model;
