// The wall panels (M4 plan W-PANELS, D5.4, D5.5, D7.1; BUILD.md §5.1, §5.2, §5.5): each pack's
// panels part, what a panel and its banner say, its reader, where it stands, and the lints over
// its prose. Written from the plan's and BUILD's words, never from js/core/panels.js:
//   - the parts: an intro panel and section panels, each section panel naming a section
//     gallery of its pack, and only the secondary's naming a module, the pack's secondary;
//   - the paragraph lint over panels: no number next to a rule word (test/m3-content.test.js's
//     lint, which reads every pack string, panels included, run here on a planted panel); no
//     module's sentence written into prose, no word of the rule of a module its department
//     does not hold (of any but the signature's, on the intro panel); no claim of where
//     anything stands (the samples' own claims, planted, each caught);
//   - what a panel says: its prose, then its module's sentence (Clauses.sentence, the pack's
//     params, the depth) while the module is on; its banner its first sentence and that
//     sentence, at most 50 words at every depth 1–7; nothing of the module with it off, and the
//     panels where they were (population is the same under any rulesOff);
//   - its reader: read(x, y) on a panel is free and gives its text, refused label_far out of
//     reach, at every depth 1–7;
//   - placement, planted: a module met earlier in tour order takes its panel there, and the
//     gallery's own panel moves on; a department meeting it nowhere keeps it in its gallery's
//     room; and the sweep's check (test/sweep/panels.check.js) catches a secondary's panel put
//     after the section that meets it, and a panel moved from its room's first entrance;
//   - the Intro lint (lint-registry, §5.1): each intro panel passes, and another module's
//     sentence or keyword planted on it is caught (one run).
'use strict';
module.exports = ({ test, assert, loadCore, root, path }) => {
  const { spawnSync } = require('node:child_process');
  const C = loadCore();
  const { Packs, Registry, Clauses, Dept, Step, Fixtures, Panels, N, State } = C;
  const json = x => JSON.stringify(x);
  const ACCS = ['S9', 'A4', 'M11'];
  const words = s => s.trim().split(/\s+/).filter(Boolean).length;
  const firstSentence = t => t.slice(0, t.search(/[.?!](\s|$)/) + 1);
  const panelsOf = s => s.dept.fixtures.filter(f => f.k === 'panel');
  const secondaryOf = p => (p.modules.find(m => m.role === 'secondary') || {}).id || null;
  const signatureOf = p => (p.modules.find(m => m.role === 'signature') || p.modules[0]).id;

  // ---- The parts ----

  test('each pack\'s panels: an intro panel and its section panels, each naming a section gallery, the secondary\'s naming the pack\'s secondary', () => {
    for (const acc of ACCS) {
      const p = Packs.get(acc), P = p.panels;
      assert.equal(json(Object.keys(P).sort()), json(['intro', 'sections']), acc);
      assert.ok(typeof P.intro.name === 'string' && P.intro.name && typeof P.intro.text === 'string' && words(P.intro.text) >= 80, `${acc}: the intro panel`);
      assert.equal(P.intro.module, undefined, `${acc}: the intro panel's module is the signature, by rule`);
      const sections = p.galleries.filter(g => /^s\d+$/.test(g.key)).map(g => g.key);
      for (const s of P.sections) {
        assert.ok(sections.includes(s.gallery), `${acc}: ${s.gallery} is a section gallery of its pack`);
        assert.ok(typeof s.name === 'string' && s.name && typeof s.text === 'string' && words(s.text) >= 30, `${acc}.${s.gallery}`);
      }
      assert.equal(new Set(P.sections.map(s => s.gallery)).size, P.sections.length, `${acc}: one panel a gallery`);
      assert.equal(json(P.sections.filter(s => s.module !== undefined).map(s => s.module)), json(secondaryOf(p) ? [secondaryOf(p)] : []), `${acc}: only the secondary's panel names a module`);
    }
    // The fixture's entry: read within READ_RANGE, free, and nothing more.
    const F = Registry.FIXTURES.panel;
    assert.match(Clauses.fill(F.clause, Clauses.params(F.params, null, { depth: 1 })), new RegExp(`within ${N.READ_RANGE} tiles, in sight, at no cost in time; reading it changes nothing`));
  });

  // ---- The prose: the paragraph lint over panels ----

  // A claim of where something stands (plan D5.5: "a placement claim only where population keeps
  // it"; panels make none, since the secondary's panel moves to where its module is met).
  const PLACE = [/\bthis (court|gallery|room|section|bay|row|corridor)\b/i, /\bthese (cases|shelves|lecterns|rooms)\b/i, /\b(in|inside|on|by|beside|near) (a|the|its|this|each) (case|vitrine|cabinet|lectern|shelf|shelves|wall|corner|plinth|floor)\b/i, /\bat the ends? of (this|the|each) row\b/i,
    /\b(north|south|east|west)\b/i, /\bnext to\b/i, /\b(behind|under) glass\b/i, /\bfirst thing you\b/i, /\byou can see\b/i, /\b(on|travel|travels) (its|their) (short )?rails?\b/i, /\bbefore crossing\b/i];
  const placed = t => PLACE.map(re => re.exec(t)).filter(Boolean).map(m => m[0]);
  const wordRe = w => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?($|[^a-z])`, 'i');

  test('the paragraph lint over panels: no rule in the prose, no module\'s sentence or another module\'s word, no claim of where anything stands', () => {
    for (const acc of ACCS) {
      const p = Packs.get(acc), P = p.panels;
      // The intro panel names no rule of a module but its signature's (the Intro teaches it
      // alone, §5.1); a section panel none of a module its department does not hold.
      for (const [where, r, own] of [[`${acc} intro`, P.intro, [signatureOf(p)]], ...P.sections.map(s => [`${acc}.${s.gallery}`, s, p.modules.map(m => m.id)])]) {
        for (const id of Registry.order('MODULES')) {
          const M = Registry.MODULES[id];
          assert.ok(!r.text.includes(M.sentence), `${where}: ${id}'s sentence is generated, never written`);
          if (!own.includes(id)) for (const k of M.keywords) assert.ok(!wordRe(k).test(r.text) && !wordRe(k).test(r.name), `${where} says "${k}", a word of ${id}'s rule`);
        }
        assert.equal(json(placed(r.text)), '[]', `${where}: ${r.text}`);
        assert.ok(words(firstSentence(r.text)) >= 6, `${where}: its first sentence`);
      }
    }
    // Planted: the samples' sentences this file's claims and the module words catch.
    for (const [t, want] of [['The overshoes are in the case by the north lectern.', 'in the case'], ['The case on the east wall holds tools.', 'east'],
      ['In this section the cases hold weather.', 'this section'], ['They are in the bundles on these shelves.', 'these shelves'], ['The duplicator in the corner turned one master sheet.', 'in the corner'],
      ['The cases at the ends of each row hold the originals.', 'at the ends of each row'], ['Look down the length of this gallery and you can see the next five doors.', 'this gallery'],
      ['Its counter is the first thing you will meet.', 'first thing you'], ['The stations travel their short rails at the side of the gallery.', 'travel their short rails'],
      ['The bay was built for a display of nests, and this bay now holds one.', 'this bay']]) {
      assert.ok(placed(t).some(c => c.toLowerCase() === want), `${t}: ${json(placed(t))}`);
    }
    assert.ok(wordRe('alarm').test('A wader that finds something calls, and the alarm is raised.'));
    // The number lint (test/m3-content.test.js reads every string of every pack, its panels
    // among them): a rule planted on a panel is caught there, by where it stands.
    const harness = [];
    const planted = extra => {
      const X = loadCore(extra);
      X.Packs.get('S9').panels.sections[1].text += ' It never strays more than two paces from the nest.';
      X.Packs.get('M11').panels.intro.text += ' Each exchange deals 4 damage.';
      return X;
    };
    require(path.join(root, 'test/m3-content.test.js'))({ test: (name, fn) => harness.push([name, fn]), assert, loadCore: planted });
    const lint = harness.find(([name]) => /^no string in the packs/.test(name));
    assert.ok(lint, 'm3-content has its string lint');
    assert.throws(() => lint[1](), e => /S9\.panels\.sections\[1\]\.text: "two paces"/.test(e.message) && /M11\.panels\.intro\.text: "4 damage"/.test(e.message));
  });

  // ---- What a panel says, and its banner ----

  test('a panel says its prose, then its module\'s sentence while the module is on; its banner is its first sentence and that sentence, within 50 words, at every depth', () => {
    for (const acc of ACCS) {
      const p = Packs.get(acc), mods = p.modules.map(m => m.id);
      for (let depth = 1; depth <= 7; depth++) {
        const s = Dept.create(depth, acc, depth), off = Dept.create(depth, acc, depth, { rulesOff: mods });
        const keys = panelsOf(s).map(f => f.key);
        assert.equal(json(keys.slice().sort()), json(['intro', ...p.panels.sections.map(x => x.gallery)].sort()), `${acc} d${depth}: every panel placed`);
        assert.equal(json(panelsOf(off)), json(panelsOf(s)), `${acc} d${depth}: the panels stand where they stood with every module off`);
        for (const key of keys) {
          const r = key === 'intro' ? p.panels.intro : p.panels.sections.find(x => x.gallery === key);
          const id = key === 'intro' ? signatureOf(p) : r.module || null;
          const sentence = id ? Clauses.sentence(id, { depth, params: p.modules.find(m => m.id === id).params }) : null;
          const text = sentence ? `${r.text} ${sentence}` : r.text, banner = sentence ? `${firstSentence(r.text)} ${sentence}` : firstSentence(r.text);
          assert.equal(Panels.text(s, key), text, `${acc}.${key} d${depth}`);
          assert.equal(Panels.banner(s, key), banner, `${acc}.${key} d${depth}`);
          assert.ok(words(banner) <= 50 && words(banner) === words(Panels.banner(s, key)), `${acc}.${key} d${depth}: ${words(banner)} words: ${banner}`);
          assert.ok(!/undefined|NaN|\[object|\{/.test(text), text);
          assert.equal(Panels.text(off, key), r.text, `${acc}.${key} d${depth}: nothing of its module while it is off`);
          assert.equal(Panels.banner(off, key), firstSentence(r.text));
          const of = Panels.of(s, key);
          assert.equal(json([of.module, of.sentence, of.name]), json([id, sentence, r.name]));
        }
      }
    }
    // Off for a single module: only its own panel's sentence goes.
    const s = Dept.create(2, 'S9', 2, { rulesOff: ['alarm_network'] });
    assert.ok(Panels.text(s, 'intro').endsWith(Registry.MODULES.unobserved_motion.sentence));
    assert.equal(Panels.text(s, 's1'), Packs.get('S9').panels.sections[0].text);
    // A key no panel has, and a room with none (the test room's), say nothing.
    assert.equal(Panels.text(s, 's9'), null); assert.equal(Panels.banner(s, 'coda'), null);
    assert.equal(Panels.inRoom(s, s.dept.rooms.find(r => r.role === 'coda').id), null);
    assert.equal(Panels.inRoom(s, s.dept.rooms.find(r => r.role === 'intro').id).key, 'intro');
  });

  // ---- Its reader ----

  test('read(x, y) on a panel is free and gives its text; out of reach it is refused label_far (real actions, depths 1–7)', () => {
    for (let depth = 1; depth <= 7; depth++) for (const acc of ACCS) {
      const s = Dept.create(10 + depth, acc, depth), f = panelsOf(s).find(q => q.key === 'intro');
      const turn = s.turn, next = s.actors[0].next;
      assert.ok(Step.legal(s).some(a => a.a === 'read' && a.x === f.x && a.y === f.y), `${acc} d${depth}: the intro panel can be read from where you come in`);
      const ev = Step.step(s, { a: 'read', x: f.x, y: f.y });
      assert.ok(Array.isArray(ev) && ev.length === 0, `${acc} d${depth}: ${json(ev)}`);
      assert.equal(json([s.turn, s.actors[0].next]), json([turn, next]), 'reading costs nothing');
      assert.equal(Fixtures.read(s, f).text, Panels.text(s, 'intro'));
      // Out of reach (planted: you stand farther along the entrance row).
      const far = State.clone(s);
      far.actors[0].x = f.x + N.READ_RANGE + 2; far.actors[0].y = s.dept.entrance[1];
      assert.equal(Fixtures.read(far, f), 'label_far');
      const no = Step.step(far, { a: 'read', x: f.x, y: f.y });
      assert.equal(json(no.map(e => [e.k, e.reason])), json([['refused', 'label_far']]), `${acc} d${depth}`);
      assert.ok(!Step.legal(far).some(a => a.a === 'read' && a.x === f.x && a.y === f.y));
    }
  });

  // ---- Where they stand, planted ----

  const CHECK = path.join(root, 'test/sweep/panels.check.js');
  // A department's panels placed again, after a plant (fixtures, actors) on a copy.
  const replace = (s, acc, plant) => {
    const t = State.clone(s);
    t.dept.fixtures = t.dept.fixtures.filter(f => f.k !== 'panel');
    plant(t);
    Panels.place(t, {}, Packs.get(acc));
    return t;
  };
  const roomKey = (s, key) => s.dept.rooms.find(r => r.id === panelsOf(s).find(f => f.key === key).room).key;
  test('the secondary\'s panel stands at the first section where its module is met; the others in their galleries\' rooms; the sweep\'s check catches each misplacement', () => {
    const chk = require(CHECK)(C);
    // M.11: s1 always holds a case, so weather's panel stands there and the Line's moves on.
    const m = Dept.create(4, 'M11', 3), byKey = k => m.dept.rooms.find(r => r.key === k);
    assert.equal(json([roomKey(m, 's2'), roomKey(m, 's1')]), json(['s1', 's2']));
    assert.equal(chk.each({ state: m, seed: 4, acc: 'M11', depth: 3 }), null);
    // Planted: no case in s1: the Weather panel goes to s2 (cases, and the station flagged with
    // it), and the Line's to its gallery's room, s1.
    const inS1 = f => f.k === 'case' && m.dept.roomOf[f.y][f.x] === byKey('s1').id;
    const noCase = replace(m, 'M11', t => { t.dept.fixtures = t.dept.fixtures.filter(f => !inS1(f)); });
    assert.equal(json([roomKey(noCase, 's2'), roomKey(noCase, 's1')]), json(['s2', 's1']));
    // Planted: a weather case in s1 with the panel after it, in s2: the check says so.
    const late = State.clone(noCase), wc = m.dept.fixtures.find(inS1);
    late.dept.fixtures.push(Object.assign({}, wc, { weather: 'fog' }));
    assert.match(chk.each({ state: late, seed: 4, acc: 'M11', depth: 3 }), /weather_cases is met in s1, before its panel in s2/);
    // S.9: the Waders stand in the court, so the Waders' Round is there, whatever the tour.
    const s = Dept.create(5, 'S9', 4);
    const court = s.dept.rooms.find(r => Array.isArray(r.galleries) && r.galleries.includes(Packs.get('S9').galleries.findIndex(g => g.key === 's1')));
    assert.equal(roomKey(s, 's1'), court.key);
    // Planted: a Wader in the band room (first in the tour): the panel follows it there and the
    // Brooders' Bay moves to the court.
    const band = s.dept.rooms.find(r => r.role === 'section' && r.id !== court.id);
    const tile = (() => { for (let y = band.y0; y <= band.y1; y++) for (let x = band.x0; x <= band.x1; x++) if (s.dept.roomOf[y][x] === band.id && C.Grid.walkable(s.dept, x, y) && !s.actors.some(a => a.x === x && a.y === y)) return [x, y]; return null; })();
    const moved = replace(s, 'S9', t => { const w = t.actors.find(a => a.sp === 'S9.2'); w.x = tile[0]; w.y = tile[1]; });
    assert.equal(json([roomKey(moved, 's1'), roomKey(moved, 's2')]), json([band.key, court.key]));
    // Planted: no Wader at all: the panel stays in its gallery's room.
    const none = replace(s, 'S9', t => { t.actors = t.actors.filter(a => a.sp !== 'S9.2'); });
    assert.equal(roomKey(none, 's1'), court.key);
    // Planted: a panel moved along its wall, away from its room's first entrance, is caught.
    const off = State.clone(s), f = panelsOf(off).find(q => q.key === 's2'), rm = off.dept.rooms.find(r => r.id === f.room);
    let far = null;
    for (let y = rm.y0 - 1; y <= rm.y1 + 1 && !far; y++) for (let x = rm.x0 - 1; x <= rm.x1 + 1 && !far; x++) if (off.dept.tiles[y][x] === '#' && Math.abs(x - f.x) + Math.abs(y - f.y) > 8 && [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => off.dept.roomOf[y + dy] && off.dept.roomOf[y + dy][x + dx] === rm.id)) far = [x, y];
    f.x = far[0]; f.y = far[1];
    assert.match(chk.each({ state: off, seed: 5, acc: 'S9', depth: 4 }), /panel s2 at \d+,\d+ cannot be read from s\d's first entrance/);
    // And a panel taken out is missed.
    const gone = State.clone(s); gone.dept.fixtures = gone.dept.fixtures.filter(q => q.key !== 's2');
    assert.match(chk.each({ state: gone, seed: 5, acc: 'S9', depth: 4 }), /2 panels, for 3/);
    // Nothing is placed for a plan of null or a pack with no panels.
    const bare = State.clone(s); bare.dept.fixtures = bare.dept.fixtures.filter(q => q.k !== 'panel');
    Panels.place(bare, null, Packs.get('S9')); Panels.place(bare, {}, { galleries: [] });
    assert.equal(panelsOf(bare).length, 0);
  });

  // ---- The Intro lint (lint-registry, §5.1; WO6) ----

  test('the Intro lint: each intro panel teaches its signature alone, and another module\'s sentence or word planted on it is caught', () => {
    const os = require('node:os'), fs = require('node:fs');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'accession-m4-panels-'));
    try {
      const f = path.join(tmp, 'planted.js');
      fs.writeFileSync(f, ["'use strict';",
        "Packs.get('S9').panels.intro.text += ' ' + Registry.MODULES.alarm_network.sentence;",
        "Packs.get('M11').panels.intro.text += ' The rain was kept in jars.';",
        "Packs.get('A4').panels.intro.text += ' Mind the chime.';"].join('\n') + '\n');
      const r = spawnSync(process.execPath, [path.join(root, 'tools/lint-registry.js'), '--load', f], { encoding: 'utf8' }), out = r.stdout + r.stderr;
      assert.equal(r.status, 1, out);
      assert.match(out, /S9's intro panel says alarm_network's sentence, but its Intro teaches only unobserved_motion/);
      assert.match(out, /S9's intro panel says "alarm", a word of alarm_network's rule/);
      assert.match(out, /M11's intro panel says "rain", a word of weather_cases's rule, but its Intro teaches only hourly_demonstration/);
      assert.match(out, /A4's intro panel says "chime", a word of hourly_demonstration's rule, but its Intro teaches only copies_weaken/);
      // Those are its only problems: the real panels pass.
      const lines = out.split('\n').filter(l => /^PROBLEM/.test(l));
      assert.ok(lines.length >= 4 && lines.every(l => /intro panel says/.test(l)), lines.join('\n'));
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });
};
