// ACCESSION — the Behaviour lines' checks as a whole (BUILD.md §5.1, §5.3; W2a-BEHAVIOUR):
//   - completeness (§5.3 check 4, its static half): for every species the packs and the
//     shared species hold, at every depth, every registry id it uses gives a part of its
//     Behaviour line (Clauses.of): its archetype, the archetype's special and each status it
//     inflicts, its role's own rule, each modifier (and none switched off by rulesOff), its
//     wake clause and its trigger; and every part is an entry of its table, built in M3;
//   - sensitivity (§5.3 check 3): every M3 modifier has scenarios of its clause that the
//     harness reruns with the modifier switched off and that then fail, counted by running
//     the scenario files its entry names; and a scenario that does not test its modifier
//     fails its sweep;
//   - readiness (§5.1): `node tools/lint-registry.js --strict --follow-ups` passes, so every
//     built: 'M3' entry is at ready true, with its tests and invariant, or has an open
//     follow-up in test/behaviour/follow-ups.json; and every entry at true names a joined-up
//     scenario file under test/behaviour/;
//   - the harness's table-qualified ids ('TABLE.id') name their table.
// The soak half of completeness (an event kind an actor causes outside its line) is the
// battery's (W2b).
'use strict';
const H = require('./behaviour/_harness.js');

module.exports = ({ test, assert, loadCore, root, fs, path }) => {
  const C = loadCore();
  const R = C.Registry, json = x => JSON.stringify(x);
  const built = (X, sp) => Object.prototype.hasOwnProperty.call(X.Registry.ARCHETYPES, sp.archetype) && X.Registry.ARCHETYPES[sp.archetype].built === 'M3';
  const KIND = { ARCHETYPES: 'archetype', SPECIALS: 'special', STATUSES: 'status', MODIFIERS: 'modifier', TRIGGERS: 'trigger' };

  // What a species uses, worked out from the species and core X's registry alone (§5.3), as
  // [table, id] in the line's order.
  function uses(X, sp, rulesOff) {
    const Q = X.Registry, has = (t, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(Q[t], k);
    const A = Q.ARCHETYPES[sp.archetype], T = sp.trigger ? Q.TRIGGERS[sp.trigger] : null, out = [['ARCHETYPES', sp.archetype]];
    if (A.special) out.push(['SPECIALS', A.special]);
    for (const st of A.inflicts || []) out.push(['STATUSES', st]);
    if (typeof sp.role === 'string' && has('CLAUSES', 'role_' + sp.role)) out.push(['CLAUSES', 'role_' + sp.role]);
    for (const m of sp.modifiers || []) if (!rulesOff.includes(m)) out.push(['MODIFIERS', m]);
    if (!(T && T.replacesWake)) out.push(['CLAUSES', A.wake || 'wake']);
    if (sp.trigger) out.push(['TRIGGERS', sp.trigger]);
    return out;
  }

  // The static completeness check (§5.3 check 4) over core X: for every M3 species of the
  // packs and the shared species, at every depth, with nothing and then each of its
  // modifiers switched off, Clauses.of gives one part per id it uses, in order, each an M3
  // entry of its table, of the right kind and with a clean text, and the line says every
  // part. Returns {problems: [what is wrong, where], lines: how many lines were checked}.
  function completeness(X) {
    const Q = X.Registry, problems = [];
    let lines = 0;
    const all = [];
    for (const p of X.Packs.list()) for (const sp of [...p.species, p.centrepiece]) if (sp) all.push(sp);
    for (const sp of X.Packs.sharedList()) all.push(sp);
    for (const sp of all.filter(x => built(X, x))) for (const depth of H.DEPTHS) {
      for (const rulesOff of [[]].concat((sp.modifiers || []).map(m => [m]))) {
        const where = `${sp.id} at depth ${depth}${rulesOff.length ? ', ' + rulesOff[0] + ' off' : ''}`;
        lines++;
        let want, got, line;
        try { want = uses(X, sp, rulesOff); got = X.Clauses.of(sp, { depth, rulesOff }); line = X.Clauses.line(sp, { depth, rulesOff }); }
        catch (e) { problems.push(`${where}: ${e.message}`); continue; }
        if (json(got.map(p => p.id)) !== json(want.map(([, id]) => id))) problems.push(`${where}: the line's parts are ${json(got.map(p => p.id))}, but it uses ${json(want.map(([t, id]) => t + '.' + id))}`);
        for (let i = 0; i < want.length; i++) {
          const [t, id] = want[i], e = Object.prototype.hasOwnProperty.call(Q[t], id) ? Q[t][id] : null, p = got[i];
          if (!e || e.built !== 'M3') problems.push(`${where}: ${t}.${id} is not an M3 entry`);
          if (!p) continue;
          const kind = KIND[t] || (id.startsWith('role_') ? 'role' : 'wake');
          if (p.id === id && p.kind !== kind) problems.push(`${where}: ${t}.${id} gives a part of kind ${p.kind}, not ${kind}`);
        }
        // Each part says something, and the line says it: the special's and statuses' text
        // inside the archetype's, the rest as written.
        for (const p of got) {
          if (typeof p.text !== 'string' || !p.text.length || /undefined|NaN|\[object|[{}]/.test(p.text)) problems.push(`${where}: ${p.id} reads "${p.text}"`);
          else if (!line.includes(p.text.replace(/\.$/, ''))) problems.push(`${where}: the line does not say "${p.text}": ${line}`);
        }
      }
    }
    return { problems, lines };
  }

  test('completeness: every registry id each M3 species uses, its special and inflicted statuses included, gives a part of its Behaviour line, at every depth and with each modifier switched off', () => {
    const { problems, lines } = completeness(C);
    assert.equal(json(problems.slice(0, 5)), '[]', `${problems.length} problem(s)`);
    assert.ok(lines >= 7 * 15, `${lines} lines`);
    // A species of an archetype M3 does not build is left out of M3 departments (§5.5), so
    // its line is not checked here; there is at least one, so the filter is not vacuous.
    const all = [];
    for (const p of C.Packs.list()) for (const sp of [...p.species, p.centrepiece]) if (sp) all.push(sp);
    assert.ok(all.some(sp => !built(C, sp)));
  });

  test('completeness bites: the same check fails on a core whose lines drop a species\' special, its inflicted status, its role\'s rule or a modifier\'s sentence, or whose species uses an id the registry does not have', () => {
    const planted = {
      'the special\'s part dropped': X => { const of = X.Clauses.of; X.Clauses.of = (sp, o) => of(sp, o).filter(p => p.kind !== 'special'); },
      'the inflicted status\'s part dropped': X => { const of = X.Clauses.of; X.Clauses.of = (sp, o) => of(sp, o).filter(p => p.kind !== 'status'); },
      'the role\'s part dropped': X => { const of = X.Clauses.of; X.Clauses.of = (sp, o) => of(sp, o).filter(p => p.kind !== 'role'); },
      'a part switched off that is on': X => { const of = X.Clauses.of; X.Clauses.of = (sp, o) => of(sp, Object.assign({}, o, { rulesOff: (sp.modifiers || []).slice(0, 1) })); },
      'a modifier\'s sentence left off the line': X => { const line = X.Clauses.line; X.Clauses.line = (sp, o) => line(sp, Object.assign({}, o, { rulesOff: (sp.modifiers || []).slice() })); },
      'a species with a modifier the registry does not have': X => { X.Packs.species('M11', 'M11.1').modifiers.push('ghost'); },
    };
    const caught = {};
    for (const [what, plant] of Object.entries(planted)) {
      const X = loadCore();
      plant(X);
      const { problems } = completeness(X);
      caught[what] = problems.length;
      assert.ok(problems.length > 0, `completeness did not catch ${what}`);
    }
    // Each fault is caught where it is: the special in the species that have one, the
    // role's rule in the brute's.
    const X = loadCore(); planted['the role\'s part dropped'](X);
    assert.ok(completeness(X).problems.every(p => /^A4\.4a? at depth/.test(p)), 'only the brutes have a role part');
    assert.ok(Object.values(caught).every(n => n > 0), json(caught));
  });

  test('sensitivity: every M3 modifier has scenarios of its clause that its scenario files rerun with the modifier switched off, and that then fail; a scenario that does not test its modifier fails its sweep', () => {
    // Run the scenario files each M3 modifier's entry names, and count the reruns with it
    // switched off that failed as they must (H.reruns): a modifier whose scenarios all hold
    // without it (holdsWithout), or are never swept, has none.
    const mods = R.order('MODIFIERS').filter(id => R.MODIFIERS[id].built === 'M3');
    assert.ok(mods.length >= 4, json(mods));
    const files = [...new Set(mods.flatMap(id => R.MODIFIERS[id].tests.filter(f => /^behaviour\/[^/]+\.test\.js$/.test(f))))].sort();
    const before = Object.fromEntries(mods.map(id => [id, H.reruns(id)]));
    for (const f of files) {
      const tests = [];
      require(path.join(root, 'test', f))({ test: (name, fn) => tests.push({ name, fn }), assert, loadCore, root, fs, path });
      for (const t of tests) t.fn();
    }
    for (const id of mods) {
      assert.ok(R.MODIFIERS[id].tests.some(f => f.startsWith('behaviour/')), `${id} names no scenario file`);
      assert.equal(H.switchable(C, { id }), id);
      const n = H.reruns(id) - before[id];
      assert.ok(n >= 7, `${id}: its scenario files (${R.MODIFIERS[id].tests.join(', ')}) made ${n} rerun(s) with it switched off that failed`);
    }
    // A planted scenario of marble's clause that shows nothing about marble (a blow lands)
    // passes with marble on and off, and so fails its sweep, counting no rerun; marked as
    // holding without it, it passes, and is not rerun. And holdsWithout must give a reason.
    const list = H.species(C, 'marble').filter(x => x.depth === 2);
    const plain = { name: 'a planted marble scenario that tests nothing of marble', id: 'marble', clone: true,
      build: (p, sp, depth, opts) => C.Setup.room(opts.seed, { acc: 'T0', depth, map: ['#######', '#.....#', '#######'], you: [1, 1],
        exhibits: [{ sp: sp.id, at: [2, 1], mode: 'hunting', stats: C.Roles.stats(sp.role, depth) }] }, { rulesOff: opts.rulesOff, invulnerable: true }),
      actions: [{ a: 'wait' }, { a: 'wait' }], expect: () => null };
    const had = H.reruns('marble');
    const bad = H.failures(H.sweep(C, H.scenario(plain), list));
    assert.ok(bad.length === list.length && bad.every(f => /with marble switched off it still passed, so it does not test marble/.test(f)), json(bad));
    assert.deepEqual(H.failures(H.sweep(C, H.scenario(Object.assign({}, plain, { holdsWithout: 'it is planted to show nothing of marble' })), list)), []);
    assert.equal(H.reruns('marble'), had, 'neither counts as a rerun that failed');
    assert.throws(() => H.scenario(Object.assign({}, plain, { holdsWithout: '' })), /holdsWithout must say why/);
    // A scenario whose id is no modifier is not rerun.
    assert.equal(H.switchable(C, { id: 'plodder' }), null);
  });

  test('a table-qualified id names its table: it picks a line part of that table only, or else the registry entry of that table', () => {
    const ids = id => [...new Set(H.species(C, id).map(x => x.sp.id))];
    assert.equal(json(ids('TRIGGERS.tether')), json(ids('tether')));
    assert.ok(ids('tether').length > 0);
    assert.equal(json(ids('WAKE_CAUSES.tether')), '[]', 'no line part comes from WAKE_CAUSES');
    assert.equal(json(ids('STATUSES.rooted')), json(ids('rooted')));
    assert.equal(json(ids('ARCHETYPES.rooted')), '[]');
    assert.equal(json(ids('ARCHETYPES.herald')), json(ids('herald')));
    assert.equal(json(ids('MODIFIERS.herald')), '[]');
    assert.equal(json(ids('CLAUSES.role_brute')), json(ids('role_brute')));
    // The parameters and clause a scenario gets: the trigger's part for 'TRIGGERS.tether';
    // the wake cause's entry, which has no clause, for 'WAKE_CAUSES.tether'.
    const warden = H.species(C, 'tether')[0].sp, room = (p, sp, depth, o) => C.Setup.room(o.seed, { acc: 'T0', depth, map: ['###', '#.#', '###'], you: [1, 1] });
    const run = id => H.run(C, H.scenario({ name: 'which clause', id, build: room, actions: [], expect: () => null }), warden, 3);
    const trig = run('TRIGGERS.tether'), cause = run('WAKE_CAUSES.tether');
    assert.equal(trig.failure, null, trig.failure);
    assert.equal(json(trig.params), json(C.Clauses.of(warden, { depth: 3 }).find(p => p.kind === 'trigger').params));
    assert.ok(trig.clause && trig.clause.includes('wakes at once'), trig.clause);
    assert.equal(cause.failure, null, cause.failure);
    assert.equal(json([cause.params, cause.clause]), json([{}, null]));
    assert.match(run('MODIFIERS.tether').failure, /the registry has no MODIFIERS\.tether/);
  });

  test('readiness: lint-registry --strict --follow-ups passes, every M3 entry at true names a joined-up scenario file, and each open follow-up names an entry below true', () => {
    const { spawnSync } = require('node:child_process');
    const r = spawnSync(process.execPath, [path.join(root, 'tools/lint-registry.js'), '--strict', '--follow-ups'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const follow = JSON.parse(fs.readFileSync(path.join(root, 'test/behaviour/follow-ups.json'), 'utf8'));
    let atTrue = 0;
    for (const t of R.TABLES) for (const id of R.order(t)) {
      const e = R[t][id], where = `${t}.${id}`;
      if (e.built !== 'M3') continue;
      if (e.ready === true) {
        atTrue++;
        assert.ok(e.tests.some(f => f.startsWith('behaviour/') && fs.existsSync(path.join(root, 'test', f))), `${where} is at true but names no scenario file under test/behaviour/`);
        assert.ok(!Object.prototype.hasOwnProperty.call(follow, where), `${where} is at true and still has a follow-up`);
      } else assert.ok(Object.prototype.hasOwnProperty.call(follow, where), `${where} is at ${json(e.ready)} with no follow-up`);
    }
    assert.ok(atTrue >= 150, `${atTrue} entries at true`);
    for (const [where, why] of Object.entries(follow)) assert.ok(typeof why === 'string' && why.length > 20, `${where}: ${json(why)}`);
    // The lint itself catches an entry at true that names no joined-up scenario file.
    const os = require('node:os'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'accession-behaviour-')), f = path.join(tmp, 'planted.js');
    try {
      fs.writeFileSync(f, "'use strict';\nRegistry.define('GLASS', 'planted_true', { ready: true, tests: ['m3-cases.test.js'], inv: 'cases' });\n");
      const p = spawnSync(process.execPath, [path.join(root, 'tools/lint-registry.js'), '--load', f], { encoding: 'utf8' });
      assert.equal(p.status, 1);
      assert.match(p.stdout, /GLASS\.planted_true is at ready true but names no joined-up scenario file/);
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });
};
