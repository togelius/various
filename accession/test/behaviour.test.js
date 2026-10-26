// ACCESSION — the Behaviour lines' checks as a whole (BUILD.md §5.1, §5.3; W2a-BEHAVIOUR):
//   - completeness (§5.3 check 4, its static half): for every species the packs and the
//     shared species hold, at every depth, every registry id it uses gives a part of its
//     Behaviour line (Clauses.of): its archetype, the archetype's special and each status it
//     inflicts, its role's own rule, each modifier (and none switched off by rulesOff), its
//     wake clause and its trigger; and every part is an entry of its table, built in M3;
//   - sensitivity (§5.3 check 3): every M3 modifier has scenarios of its clause, which the
//     harness reruns with the modifier switched off, and a scenario that does not test its
//     modifier fails its sweep;
//   - readiness (§5.1): `node tools/lint-registry.js --strict --follow-ups` passes, so every
//     built: 'M3' entry is at ready true, with its tests and invariant, or has an open
//     follow-up in test/behaviour/follow-ups.json; and every entry at true names a joined-up
//     scenario file under test/behaviour/.
// The soak half of completeness (an event kind an actor causes outside its line) is the
// battery's (W2b).
'use strict';
const H = require('./behaviour/_harness.js');

module.exports = ({ test, assert, loadCore, root, fs, path }) => {
  const C = loadCore();
  const R = C.Registry, json = x => JSON.stringify(x);
  const own = (t, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(R[t], k);
  const species = () => {
    const out = [];
    for (const p of C.Packs.list()) for (const sp of [...p.species, p.centrepiece]) if (sp) out.push(sp);
    for (const sp of C.Packs.sharedList()) out.push(sp);
    return out;
  };
  const built = sp => own('ARCHETYPES', sp.archetype) && R.ARCHETYPES[sp.archetype].built === 'M3';

  // What a species uses, worked out from the species and the registry alone (§5.3), as
  // [table, id] in the line's order.
  function uses(sp, rulesOff) {
    const A = R.ARCHETYPES[sp.archetype], T = sp.trigger ? R.TRIGGERS[sp.trigger] : null, out = [['ARCHETYPES', sp.archetype]];
    if (A.special) out.push(['SPECIALS', A.special]);
    for (const st of A.inflicts || []) out.push(['STATUSES', st]);
    if (typeof sp.role === 'string' && own('CLAUSES', 'role_' + sp.role)) out.push(['CLAUSES', 'role_' + sp.role]);
    for (const m of sp.modifiers || []) if (!rulesOff.includes(m)) out.push(['MODIFIERS', m]);
    if (!(T && T.replacesWake)) out.push(['CLAUSES', A.wake || 'wake']);
    if (sp.trigger) out.push(['TRIGGERS', sp.trigger]);
    return out;
  }
  const KIND = { ARCHETYPES: 'archetype', SPECIALS: 'special', STATUSES: 'status', MODIFIERS: 'modifier', TRIGGERS: 'trigger' };

  test('completeness: every registry id each M3 species uses, its special and inflicted statuses included, gives a part of its Behaviour line, at every depth and with each modifier switched off', () => {
    let n = 0;
    for (const sp of species().filter(built)) for (const depth of H.DEPTHS) {
      const offs = [[]].concat((sp.modifiers || []).map(m => [m]));
      for (const rulesOff of offs) {
        const want = uses(sp, rulesOff), got = C.Clauses.of(sp, { depth, rulesOff });
        const where = `${sp.id} at depth ${depth}${rulesOff.length ? ', ' + rulesOff[0] + ' off' : ''}`;
        assert.equal(json(got.map(p => p.id)), json(want.map(([, id]) => id)), where);
        for (let i = 0; i < want.length; i++) {
          const [t, id] = want[i], e = R[t][id], p = got[i];
          assert.ok(e && e.built === 'M3', `${where}: ${t}.${id} is not an M3 entry`);
          assert.equal(p.kind, KIND[t] || (id.startsWith('role_') ? 'role' : 'wake'), `${where}: ${t}.${id}`);
          assert.ok(typeof p.text === 'string' && p.text.length && !/undefined|NaN|\[object|[{}]/.test(p.text), `${where}: ${t}.${id} reads "${p.text}"`);
        }
        // Each part says something on the line: the special's and statuses' text inside the
        // archetype's, the rest as written.
        const line = C.Clauses.line(sp, { depth, rulesOff });
        for (const p of got) assert.ok(line.includes(p.text.replace(/\.$/, '')), `${where}: the line does not say "${p.text}": ${line}`);
        n++;
      }
    }
    assert.ok(n >= 7 * 15, `${n} lines`);
    // A species of an archetype M3 does not build is left out of M3 departments (§5.5), so
    // its line is not checked here; there is at least one, so the filter is not vacuous.
    assert.ok(species().some(sp => !built(sp)));
  });

  test('completeness bites: a species using an id the registry does not know, or an archetype whose special the line leaves out, is caught', () => {
    const X = loadCore();
    const sp = { id: 'T.x', archetype: 'plodder', role: 'fodder', modifiers: ['ghost'], trigger: null };
    const got = X.Clauses.of(sp, { depth: 2, rulesOff: [] }).map(p => p.id);
    assert.notEqual(json(got), json(['plodder', 'ghost', 'wake']), 'Clauses.of gives no part for an unknown modifier');
    assert.throws(() => uses(sp, []).forEach(([t, id]) => { if (!own(t, id)) throw new Error(`${t}.${id}`); }), /MODIFIERS\.ghost/);
    // A line that drops the special's part fails the comparison above.
    const real = C.Packs.species('M11', 'M11.1'), parts = C.Clauses.of(real, { depth: 3 }).filter(p => p.kind !== 'special').map(p => p.id);
    assert.notEqual(json(parts), json(uses(real, []).map(([, id]) => id)));
  });

  test('sensitivity: every M3 modifier has scenarios of its clause in its tests, and the harness reruns each with the modifier off; a scenario that does not test its modifier fails its sweep', () => {
    for (const id of R.order('MODIFIERS')) {
      const e = R.MODIFIERS[id];
      if (e.built !== 'M3') continue;
      const files = e.tests.filter(f => f.startsWith('behaviour/'));
      assert.ok(files.length, `${id} names no scenario file`);
      const src = files.map(f => fs.readFileSync(path.join(root, 'test', f), 'utf8')).join('\n');
      assert.ok(new RegExp(`id: '${id}'`).test(src), `${id}: no scenario of its clause in ${files.join(', ')}`);
      assert.equal(H.switchable(C, { id }), id);
    }
    // A planted scenario of marble's clause that shows nothing about marble (a blow lands)
    // passes with marble on and off, and so fails its sweep; marked as holding without it, it
    // passes. And holdsWithout must give a reason.
    const list = H.species(C, 'marble').filter(x => x.depth === 2);
    const plain = { name: 'a planted marble scenario that tests nothing of marble', id: 'marble', clone: true,
      build: (p, sp, depth, opts) => C.Setup.room(opts.seed, { acc: 'T0', depth, map: ['#######', '#.....#', '#######'], you: [1, 1],
        exhibits: [{ sp: sp.id, at: [2, 1], mode: 'hunting', stats: C.Roles.stats(sp.role, depth) }] }, { rulesOff: opts.rulesOff, invulnerable: true }),
      actions: [{ a: 'wait' }, { a: 'wait' }], expect: () => null };
    const bad = H.failures(H.sweep(C, H.scenario(plain), list));
    assert.ok(bad.length === list.length && bad.every(f => /with marble switched off it still passed, so it does not test marble/.test(f)), json(bad));
    assert.deepEqual(H.failures(H.sweep(C, H.scenario(Object.assign({}, plain, { holdsWithout: 'it is planted to show nothing of marble' })), list)), []);
    assert.throws(() => H.scenario(Object.assign({}, plain, { holdsWithout: '' })), /holdsWithout must say why/);
    // A scenario whose id is no modifier is not rerun.
    assert.equal(H.switchable(C, { id: 'plodder' }), null);
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
