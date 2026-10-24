// M3 Wave 0 (W0a): the grammar and its words. The registry's fragments and definition order;
// a schema and a sentence for every event kind and (kind, cause) pair; sentences dispatched
// by kind and cause; the log; Behaviour lines built one part per registry id, with every
// number filled at depths 1–7; and lint-registry catching planted faults (BUILD.md §4.3,
// §5.1, §5.3).
module.exports = ({ test, assert, loadCore, root, fs, path }) => {
  const C = loadCore();
  const { Registry: R, Text, Clauses, Roles, Labels, Dept, TestRoom, Step, Packs } = C;
  const clean = s => typeof s === 'string' && s.length > 0 && !/undefined|NaN|\[object|null/.test(s);
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  // Values from the core's context have that context's prototypes; compare them as data.
  const plain = x => JSON.parse(JSON.stringify(x));
  const same = (a, b, m) => assert.deepEqual(plain(a), plain(b), m);

  test('Registry.order gives definition order, even where an object’s keys would not', () => {
    const F = loadCore();
    const before = F.Registry.order('GLASS');
    for (const id of ['zeta', '10', 'alpha']) F.Registry.define('GLASS', id, { n: 9, name: id });
    same(F.Registry.order('GLASS'), [...before, 'zeta', '10', 'alpha']);
    assert.notDeepEqual(plain(Object.keys(F.Registry.GLASS)), plain(F.Registry.order('GLASS')), 'an integer-like id moves to the front of Object.keys');
    assert.throws(() => F.Registry.define('GLASS', 'zeta', {}), /defined twice/);
    assert.throws(() => F.Registry.define('NO_TABLE', 'x', {}), /no table/);
    assert.throws(() => F.Registry.define('GLASS', 'r', { ready: 'yes' }), /ready/);
    assert.throws(() => F.Registry.defineEvent('moved', { fields: {} }), /twice/);
    assert.throws(() => F.Registry.defineEvent('zz', { fields: { a: 'float' } }), /type/);
    // The seeded tables come in fragment load order (index.html): system, then waking, modes, …
    same(R.order('ARCHETYPES'), ['unobserved_mover', 'patrol_guard', 'demonstrator', 'conservator_healer', 'completing_guardian', 'mp_ensemble', 'mp_tableau',
      'plodder', 'night_watchman', 'darter', 'splitter', 'mote_swarm', 'kiter', 'axis_sniper', 'reflector', 'herald', 'tethered_warden', 'mimic_vitrine']);
    same(R.order('TRIGGERS'), ['period', 'axis', 'tether', 'ally_hit', 'awake', 'touch_case']);
    assert.ok(!own(R.TRIGGERS, 'alarm'), 'the alarm is a module, not a trigger (§8.2)');
    // Every entry has the standard fields, as plain data.
    for (const t of R.TABLES) for (const id of R.order(t)) {
      const e = R[t][id];
      assert.ok(['M3', 'M4'].includes(e.built) && R.READY.includes(e.ready) && Array.isArray(e.tests) && (e.inv === null || typeof e.inv === 'string'), `${t}.${id}`);
      if (e.clause !== undefined) assert.ok(e.params && Array.isArray(e.covers) && e.icon !== undefined, `${t}.${id} clause fields`);
    }
    assert.equal(new Set(R.EVENT_KINDS).size, R.EVENT_KINDS.length);
    same([...R.EVENT_KINDS].sort(), Object.keys(R.EVENTS).sort());
    assert.equal(R.EVENT_KINDS.length, 38, '§4.3’s 32 kinds and the six M3 adds');
    for (const k of ['waited', 'regenerated', 'status', 'dropped', 'healed', 'alerted']) assert.ok(R.EVENTS[k], k);
  });

  // A synthetic event for a kind and (optionally) a cause, its fields filled from the schemas.
  const SAMPLE = { uid: 'x.1', uids: ['x.1'], int: 2, str: 'soft', bool: true, tile: [1, 2], tiles: [[1, 2], [2, 2]], obj: { kind: 'melee' } };
  function sample(k, causeK, opts) {
    const fill = (list, o) => { for (const f of list) if (!f.optional || opts.optional) o[f.name] = f.type === 'uid' ? opts.uid : JSON.parse(JSON.stringify(SAMPLE[f.type])); return o; };
    const e = fill(R.EVENTS[k].list, { k, turn: 3, tick: 300 });
    if (k === 'refused') e.reason = 'corner';
    e.cause = causeK ? fill(R.CAUSES[k][causeK].list, { k: causeK }) : { k: 'no_such_cause' };
    return e;
  }
  const NAMES = uid => uid === 'x.1' ? 'the Lantern-Crop Wader' : null;

  test('every event kind and every (kind, cause) pair has a schema and a clean sentence', () => {
    let n = 0;
    for (const k of R.EVENT_KINDS) {
      assert.ok(Text.defined(k), `${k} has no default sentence`);
      const causes = Object.keys(R.CAUSES[k] || {});
      for (const c of [null, ...causes]) for (const uid of ['you', 'x.1']) for (const optional of [false, true]) for (const names of [undefined, NAMES]) {
        const e = sample(k, c, { uid, optional }), s = Text.event(e, names);
        assert.ok(clean(s), `${k}${c ? '.' + c : ''}: ${JSON.stringify(s)} for ${JSON.stringify(e)}`);
        assert.ok(/^[A-Z“]/.test(s) && /[.)]$/.test(s), `${k}${c ? '.' + c : ''}: "${s}" is not a sentence`);
        n++;
      }
      for (const c of causes) assert.ok(Text.defined(k, c), `${k}.${c} has no sentence`);
    }
    assert.ok(n > 1000, `${n} sentences checked`);
    // Every sentence has a schema, so nothing is said about an event no rule emits.
    const said = Text.list();
    for (const k of said.kinds) assert.ok(R.EVENTS[k], `a sentence for ${k}, which is not a kind`);
    for (const [k, c] of said.causes) assert.ok(R.CAUSES[k] && R.CAUSES[k][c], `a sentence for ${k}.${c}, which has no schema`);
    // Each wake cause has its woke and hunting causes.
    for (const w of R.order('WAKE_CAUSES')) for (const kind of ['woke', 'hunting']) assert.ok(R.CAUSES[kind][w], `${kind}.${w}`);
  });

  test('Text.event dispatches on the kind, then the cause, and falls back to the kind', () => {
    const names = uid => uid === 'x.1' ? 'the Lantern-Crop Wader' : null;
    // Each cause's own sentence (whose wording its owner refines), and the kind's for any other.
    const hunt = c => Text.event({ k: 'hunting', turn: 3, who: 'x.1', was: 'dormant', cause: c }, names);
    const kind = hunt({}), byCause = [{ k: 'damage', by: 'you' }, { k: 'seen', dist: 4 }, { k: 'ring', dist: 2, r: 3 }].map(hunt);
    assert.ok(clean(kind) && kind.startsWith('The Lantern-Crop Wader'), kind);
    for (const s of byCause) assert.ok(clean(s) && s.startsWith('The Lantern-Crop Wader') && s !== kind, s);
    assert.equal(new Set(byCause).size, 3, 'each cause its own sentence');
    assert.equal(hunt({ k: 'no_such_cause' }), kind, 'an unknown cause falls back to the kind');
    assert.equal(Text.event({ k: 'no_such_kind', turn: 1 }), null);
    // A fresh context: definitions dispatch as written, and each has one owner.
    const F = loadCore();
    F.Text.define('zz', (e, w) => `${w.Name(e.who)} did zz.`);
    F.Text.defineCause('zz', 'a', (e, w) => `${w.Name(e.who)} did zz because of a.`);
    assert.equal(F.Text.event({ k: 'zz', who: 'you', cause: { k: 'a' } }), 'You did zz because of a.');
    assert.equal(F.Text.event({ k: 'zz', who: 'you', cause: { k: 'b' } }), 'You did zz.');
    assert.equal(F.Text.event({ k: 'zz', who: 'x.1' }), 'The training dummy did zz.');
    assert.throws(() => F.Text.define('zz', () => ''), /twice/);
    assert.throws(() => F.Text.defineCause('zz', 'a', () => ''), /twice/);
    assert.throws(() => F.Text.defineRefusal('corner', () => ''), /twice/);
    assert.throws(() => F.Text.provide('recap', () => ''), /twice/);
    assert.throws(() => F.Text.define('zy', () => '', { log: 'sometimes' }), /log/);
    // Refusals: a code's sentence; a reason with no code is shown as it is (M2's strings).
    assert.equal(Text.refusal('corner'), 'You cannot reach it past the corner.');
    assert.equal(Text.event({ k: 'refused', turn: 1, reason: 'corner' }), 'You cannot reach it past the corner.');
    assert.equal(Text.event({ k: 'refused', turn: 1, reason: 'It is out of reach.' }), 'It is out of reach.');
    for (const code of R.order('REFUSALS')) assert.ok(clean(Text.refusal(code)), code);
    // The two named sentence makers are provided (stubs until W1-CLOCK and W2a-LABELS build them).
    assert.ok(Text.provided('clock') && Text.provided('recap'));
  });

  test('Text.log leaves out steps, blows’ announcements, waits and unseen pips, and merges a wake into its hunt', () => {
    const ev = [
      { k: 'moved', turn: 1, who: 'you', from: [1, 1], to: [2, 1] },
      { k: 'waited', turn: 1, who: 'you', how: 'wait' },
      { k: 'attacked', turn: 1, by: 'you', at: 'x.1', how: { kind: 'melee' }, cause: { k: 'attack' } },
      { k: 'missed', turn: 1, by: 'you', at: 'x.1', cause: { k: 'attack', by: 'you', at: 'x.1', chance: 80, roll: 91 } },
      { k: 'pip', turn: 1, who: 'x.1', pips: 1, delta: 1, cause: { k: 'ring', dist: 2, r: 3 } },
      { k: 'pip', turn: 1, who: 'x.2', pips: 2, delta: 1, cause: { k: 'ring', dist: 2, r: 3 } },
      { k: 'woke', turn: 1, who: 'x.1', was: 'dormant', mode: 'hunting', cause: { k: 'ring', dist: 2, r: 3 } },
      { k: 'hunting', turn: 1, who: 'x.1', was: 'dormant', cause: { k: 'ring', dist: 2, r: 3 } },
      { k: 'woke', turn: 1, who: 'x.2', was: 'dormant', mode: 'awake', cause: { k: 'noise', dist: 3, cls: 'soft' } },
      { k: 'regenerated', turn: 1, who: 'you', hp: 12 },
      { k: 'closed', turn: 1, who: 'you', x: 3, y: 3 },
      { k: 'opened', turn: 1, who: 'x.2', x: 4, y: 4 },
    ];
    // The miss, the pip of the exhibit in view, its waking told by the hunt, and the other's
    // waking: each in its own sentence (whose wording its owner refines).
    const lines = Text.log(ev, null, uid => uid === 'x.1');
    same(lines, [ev[3], ev[4], ev[7], ev[8]].map(e => Text.event(e, null)));
    assert.ok(lines.every(clean), lines.join(' / '));
    // Without a visibility test everything is in view.
    assert.equal(Text.log(ev).length, 6);
  });

  test('on M2’s events the log says what M2’s log said, and each noise’s sentence', () => {
    // M2 logged blows, misses, deaths, hunts, refusals and your doors, and nothing else. M3
    // adds the noise of every blow and door (W0c), which the log shows as a caption.
    // Wave 1 adds kinds to the log (a sleeper woken awake, a change of mode), so the check is
    // on M2's own events: the log of those says what M2's log said.
    const ofM2 = ev => ev.filter(e => ['damaged', 'missed', 'died', 'hunting', 'refused', 'noise'].includes(e.k) || (e.k === 'opened' && e.who === 'you'));
    const m2 = (ev, names) => ofM2(ev).map(e => Text.event(e, names));
    let compared = 0;
    for (const seed of [1, 2, 3]) {
      const s = TestRoom.create(seed);
      for (let i = 0; i < 400 && !s.over; i++) {
        // M2's own actions: Wave 1's item actions (W1-KIT) would change the walk, not the log.
        const legal = Step.legal(s).filter(x => ['wait', 'move', 'attack'].includes(x.a)), a = i % 7 === 3 ? { a: 'move', dir: i % 8 } : legal[(i * 5 + seed) % legal.length];
        const ev = Step.step(s, a), names = Labels.nameOf(s);
        same(Text.log(ofM2(ev), names, uid => uid === 'you'), m2(ev, names), JSON.stringify(ev));
        compared += ev.length;
      }
    }
    assert.ok(compared > 500, `${compared} events compared`);
  });

  test('Clauses fill N:, curve:, role: and mod: parameters at depths 1–7, with nothing missing', () => {
    // An independent reading of the role curves: anchors at depths 1, 4 and 8, linear, rounded down.
    const curve = (v, d) => d <= 1 ? v[0] : d <= 4 ? v[0] + Math.floor((v[1] - v[0]) * (d - 1) / 3) : d <= 8 ? v[1] + Math.floor((v[2] - v[1]) * (d - 4) / 4) : v[2];
    const sp = { id: 'T.1', role: 'fodder', modParams: { old_repair: { side: 'NE' } } };
    for (let d = 1; d <= 7; d++) {
      assert.equal(Clauses.value('N:AXIS_RANGE', sp, d), 8);
      assert.equal(Clauses.value('N:KITER_HOLD[1]', sp, d), 5);
      assert.equal(Clauses.value('curve:ROLE_WARDEN_SPECIAL', sp, d), curve([6, 12, 17], d));
      assert.equal(Clauses.value('curve:ROLE_ARTILLERY_SPECIAL', sp, d), curve([5, 11, 16], d));
      const lo = curve([1, 3, 5], d), hi = curve([4, 8, 13], d);
      assert.equal(Clauses.value('role:DMG', sp, d), lo === hi ? String(lo) : `${lo}–${hi}`);
      assert.equal(Clauses.value('role:HP', sp, d), curve([7, 16, 28], d));
      const v = Clauses.params({ r: 'N:TETHER_RANGE', g: 'curve:ROLE_WARDEN_SPECIAL', dmg: 'role:DMG' }, sp, { depth: d });
      const line = Clauses.fill('Within {r}, for {g}; strikes for {dmg}.', v);
      assert.ok(clean(line) && !/[{}]/.test(line), line);
      assert.equal(line, `Within 2, for ${curve([6, 12, 17], d)}; strikes for ${v.dmg}.`);
    }
    assert.equal(Clauses.value('mod:side', sp, 3, 'old_repair'), 'north-east');
    assert.throws(() => Clauses.value('mod:side', { id: 'T.2', role: 'fodder' }, 3, 'old_repair'), /modParams\.old_repair\.side/);
    assert.throws(() => Clauses.value('N:NO_SUCH_ROW', sp, 1), /no number/);
    assert.throws(() => Clauses.value('N:AXIS_RANGE[0]', sp, 1), /no value/);
    assert.throws(() => Clauses.value('role:DMG', { id: 'T.3' }, 1), /role/);
    assert.throws(() => Clauses.value('depth', sp, 1), /cannot read/);
    assert.throws(() => Clauses.fill('for {x}', {}), /\{x\} has no value/);
    assert.equal(Clauses.fill('{a} and {b}', { a: 0, b: 'b' }), '0 and b', 'zero is a value');
    // Every clause in the registry, on species of every archetype and trigger, at every depth.
    let n = 0;
    for (const arch of R.order('ARCHETYPES')) for (const trigger of [null, ...R.order('TRIGGERS')]) for (let d = 1; d <= 7; d++) {
      const s = { id: 'T.' + arch, archetype: arch, role: 'warden', modifiers: R.order('MODIFIERS'), modParams: { old_repair: { side: 'W' } }, trigger };
      for (const p of Clauses.of(s, { depth: d })) { assert.ok(clean(p.text) && !/[{}]/.test(p.text), `${arch}/${trigger} d${d}: ${p.id}: ${p.text}`); n++; }
    }
    assert.ok(n > 5000, `${n} parts filled`);
  });

  test('Clauses.of gives one part per id a species uses, its special and inflicted status included', () => {
    const ids = parts => parts.map(p => p.kind + ':' + p.id);
    const mimic = { id: 'T.m', archetype: 'mimic_vitrine', role: 'ambusher', modifiers: ['marble'], trigger: 'touch_case' };
    const mp = Clauses.of(mimic, { depth: 4 });
    same(ids(mp), ['archetype:mimic_vitrine', 'status:rooted', 'modifier:marble', 'wake:wake_pipless', 'trigger:touch_case']);
    assert.equal(mp[1].within, 'mimic_vitrine');
    assert.equal(mp[1].text, `you cannot move for ${C.N.MIMIC_GRIP_TURNS} turns`);
    assert.ok(mp[0].text.includes(`(${mp[1].text})`), 'the status is set inside the archetype’s clause');
    assert.ok(mp[0].text.includes(`strikes for ${Clauses.value('role:DMG', mimic, 4)}`), mp[0].text);
    const sniper = { id: 'T.s', archetype: 'axis_sniper', role: 'artillery', modifiers: ['glass'], trigger: 'axis' };
    const sp = Clauses.of(sniper, { depth: 2 });
    same(ids(sp), ['archetype:axis_sniper', 'special:line', 'modifier:glass', 'wake:wake', 'trigger:axis']);
    assert.ok(sp[0].text.includes(sp[1].text) && sp[1].text.includes(`for ${Roles.at(C.N.ROLE_ARTILLERY_SPECIAL, 2)} before your Padding`), sp[0].text);
    same(sp[1].covers, ['telegraphed', 'special', 'damaged']);
    // rulesOff drops a modifier's part; a trigger that stands instead of the wake clause replaces it.
    same(ids(Clauses.of(sniper, { depth: 2, rulesOff: ['glass'] })), ['archetype:axis_sniper', 'special:line', 'wake:wake', 'trigger:axis']);
    const watch = { id: 'T.w', archetype: 'plodder', role: 'fodder', modifiers: [], trigger: 'awake' };
    same(ids(Clauses.of(watch, { depth: 1 })), ['archetype:plodder', 'trigger:awake']);
    assert.equal(Clauses.line(watch, { depth: 1 }), 'Walks one tile at a time and strikes from beside you for 1–4. It never sleeps.');
    // The line holds every part: the embedded ones inside the archetype's sentence, the
    // trigger joined to the wake clause.
    const line = Clauses.line(sniper, { depth: 2 });
    for (const p of sp) assert.ok(line.includes(p.text.replace(/\.$/, '')), `${p.id} is not in "${line}"`);
    assert.ok(line.endsWith('near it; also gains a pip each turn you stand in its row or column within 8 tiles, in its sight.'), line);
    // Labels show the same line, at the department's depth.
    for (const [acc, depth] of [['S9', 1], ['A4', 4], ['M11', 7]]) {
      const s = Dept.create(2, acc, depth);
      for (const a of s.actors.slice(1)) {
        const l = Labels.of(s, a.uid), spc = Labels.speciesOf(s, a);
        assert.equal(l.behaviour, Clauses.line(spc, { depth }), `${a.uid}`);
        assert.ok(clean(l.behaviour), l.behaviour);
      }
    }
    // Every pack species: a part for each id it uses.
    for (const p of Packs.list()) for (const s of [...p.species, p.centrepiece]) {
      const got = Clauses.of(s, { depth: 3 }).map(q => q.id), arch = R.ARCHETYPES[s.archetype];
      const want = [s.archetype, ...(arch.special ? [arch.special] : []), ...(arch.inflicts || []), ...(s.modifiers || []),
        ...(s.trigger && R.TRIGGERS[s.trigger].replacesWake ? [] : [arch.wake || 'wake']), ...(s.trigger ? [s.trigger] : [])];
      same(got, want, s.id);
    }
  });

  test('lint-registry fails on a planted (kind, cause) pair with no sentence, and on other planted faults', () => {
    const { spawnSync } = require('node:child_process'), os = require('node:os');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'accession-grammar-'));
    const lint = (src, extra) => {
      const args = [path.join(root, 'tools/lint-registry.js'), ...(extra || [])];
      if (src) { const f = path.join(tmp, 'planted-' + Math.abs(src.length) + '.js'); fs.writeFileSync(f, "'use strict';\n" + src + '\n'); args.push('--load', f); }
      return spawnSync(process.execPath, args, { encoding: 'utf8' });
    };
    let r = lint("Registry.defineCause('damaged', 'planted', { fields: {} });");
    assert.equal(r.status, 1); assert.match(r.stdout, /damaged\.planted has no sentence/);
    r = lint("Text.defineCause('damaged', 'ghost', () => 'A ghost.');");
    assert.equal(r.status, 1); assert.match(r.stdout, /sentence for damaged\.ghost, which has no cause schema/);
    r = lint("Registry.defineEvent('planted_kind', { fields: {} });");
    assert.equal(r.status, 1); assert.match(r.stdout, /planted_kind has no sentence/); assert.match(r.stdout, /planted_kind is in the registry but not in BUILD\.md §4\.3/);
    r = lint("Registry.define('GLASS', 'planted', { ready: 'unit' });");
    assert.equal(r.status, 1); assert.match(r.stdout, /GLASS\.planted is at ready "unit" but names no tests/);
    r = lint("Registry.define('MODIFIERS', 'planted', { clause: 'Hits for {dmg} from {far}.', params: { dmg: 'role:DMG' } });");
    assert.equal(r.status, 1); assert.match(r.stdout, /MODIFIERS\.planted: \{far\} has no parameter/);
    r = lint("Registry.define('REFUSALS', 'planted', {});");
    assert.equal(r.status, 1); assert.match(r.stdout, /refusal planted has no sentence/);
    const md = fs.readFileSync(path.join(root, 'BUILD.md'), 'utf8').replace('`took`, `dropped`,', '`took`,');
    fs.writeFileSync(path.join(tmp, 'BUILD.md'), md);
    r = lint(null, ['--build', path.join(tmp, 'BUILD.md')]);
    assert.equal(r.status, 1); assert.match(r.stdout, /dropped is in the registry but not in BUILD\.md §4\.3/);
    // A trigger that wakes through pips needs its pip cause; every damage cause accepts saved and side.
    r = lint("Registry.define('TRIGGERS', 'planted_trigger', { clause: 'wakes when planted', params: {}, covers: [], tests: [], inv: null }); Registry.define('WAKE_CAUSES', 'planted_trigger', { mode: 'hunting', creation: false }); for (const k of ['woke', 'hunting']) { Registry.defineCause(k, 'planted_trigger', { fields: {} }); Text.defineCause(k, 'planted_trigger', () => 'Planted.'); }");
    assert.equal(r.status, 1); assert.match(r.stdout, /the trigger planted_trigger wakes through pips but has no pip\.planted_trigger cause schema/);
    r = lint("Registry.defineCause('damaged', 'planted_blow', { fields: { by: 'uid' } }); Text.defineCause('damaged', 'planted_blow', () => 'Planted.');");
    assert.equal(r.status, 1); assert.match(r.stdout, /damaged\.planted_blow does not accept saved\?/); assert.match(r.stdout, /damaged\.planted_blow does not accept side\?/);
    // --strict is M3's acceptance: it fails until every M3 entry is ready.
    r = lint(null, ['--strict']);
    assert.equal(r.status, 1); assert.match(r.stdout, /--strict: \S+ is at ready (false|"unit")/);
    // And the tree itself is clean, with the readiness counts reported.
    r = lint(null);
    assert.equal(r.status, 0, r.stdout); assert.match(r.stdout, /M3 entries at ready false \d+, 'unit' \d+, true \d+/);
  });
};
