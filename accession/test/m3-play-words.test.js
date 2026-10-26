// What play showed in Wave 3's review of the tests and the interface, fixed (BUILD.md §3.4,
// §7.1, §7.2): a walk stops for what is new or changed in sight, never for a sleeping exhibit
// you have seen coming back into view as it was; a long rest leaves one line in the log; the
// stage chip's words are Text's; and the log and the recap read as plain sentences ("Soft: a
// special attack", "it struck you", "marks the tiles round it", one line for a swarm's
// bodies stirring alike, "On turn 240, … woke and began hunting you"). Each test fails on
// the tree before these fixes.
module.exports = ({ test, assert, loadCore, root, fs, path }) => {
  const C = loadCore();
  const { Registry: R, Text, N } = C;
  const json = JSON.stringify;
  const acorn = require(path.join(root, 'tools/vendor/acorn/acorn.js'));
  const MAIN = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
  const AST = acorn.parse(MAIN, { ecmaVersion: 2022, sourceType: 'script' });
  const walk = (n, f) => {
    if (!n || typeof n.type !== 'string') return;
    f(n);
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(c => walk(c, f)); else if (v && typeof v.type === 'string') walk(v, f); }
  };
  // main.js's function or const arrow of this name, or null.
  const find = name => {
    let out = null;
    walk(AST, n => {
      if (out) return;
      if (n.type === 'FunctionDeclaration' && n.id && n.id.name === name) out = n;
      if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.id.name === name) out = n;
    });
    return out;
  };
  // The strings a function writes, and the Text functions it calls.
  const said = fn => {
    const strings = [], calls = [];
    walk(fn, n => {
      if (n.type === 'Literal' && typeof n.value === 'string') strings.push(n.value);
      if (n.type === 'TemplateLiteral') strings.push(n.quasis.map(q => q.value.cooked).join('${}'));
      if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.object.name === 'Text') calls.push(n.callee.property.name);
    });
    return { strings, calls };
  };

  // ---- (a) Walk stops ----

  test('a walk stops for an exhibit new to you or changed since you saw it, never for one you have seen coming back into view as it was, nor for one going out of view (main.js news, §7.1)', () => {
    const parts = ['look', 'lookAt', 'news'].map(find);
    assert.ok(parts.every(Boolean), 'main.js has look, lookAt and news');
    const src = parts.map(n => (n.type === 'VariableDeclarator' ? 'const ' : '') + MAIN.slice(n.start, n.end) + ';').join('\n');
    const { news, lookAt } = new Function(`${src}\nreturn { news, lookAt };`)();
    const ex = (uid, mode, pips, x, y) => [uid, { uid, mode, pips, x, y }];
    const shown = (sights, known) => ({ sights: new Map(sights), known: new Map(known.map(([u, a]) => [u, lookAt(a)])) });
    const D = ex('d.1', 'dormant', 0, 4, 4), H = ex('h.1', 'hunting', 0, 6, 2);
    const cases = [
      // [what, before, now, stops]
      ['a sleeper seen before, back in view as it was', shown([], [D]), shown([D], [D]), false],
      ['a sleeper never seen, coming into view', shown([], []), shown([D], []), true],
      ['a sleeper seen before, back in view with a pip more', shown([], [D]), shown([ex('d.1', 'dormant', 1, 4, 4)], [D]), true],
      ['a sleeper seen before, back in view on another tile', shown([], [D]), shown([ex('d.1', 'dormant', 0, 5, 4)], [D]), true],
      ['a sleeper seen before, back in view awake', shown([], [D]), shown([ex('d.1', 'awake', 0, 4, 4)], [D]), true],
      ['a sleeper going out of view', shown([D], [D]), shown([], [D]), false],
      ['a hunter in view moving', shown([H], [H]), shown([ex('h.1', 'hunting', 0, 5, 2)], [H]), false],
      ['a sleeper in view gaining a pip', shown([D], [D]), shown([ex('d.1', 'dormant', 1, 4, 4)], [D]), true],
      ['a hunter in view going back', shown([H], [H]), shown([ex('h.1', 'returning', 0, 6, 2)], [H]), true],
      ['a hunter seen before, back in view where it was', shown([], [H]), shown([H], [H]), false],
      ['a hunter seen before, back in view elsewhere', shown([], [H]), shown([ex('h.1', 'hunting', 0, 3, 3)], [H]), true],
      ['nothing in view, nothing seen', shown([], []), shown([], []), false],
    ];
    for (const [what, before, now, stops] of cases) assert.equal(news(now, before), stops, what);
    // stopFor stops for it as 'sight', and draw remembers what the board shows.
    const stopFor = MAIN.slice(find('stopFor').start, find('stopFor').end), draw = MAIN.slice(find('draw').start, find('draw').end);
    assert.ok(/if \(news\(now, before\)\) return 'sight';/.test(stopFor), 'stopFor stops for news as sight');
    assert.ok(/remember\(vm\)/.test(draw), 'draw remembers what it shows');
  });

  // ---- (b) A long rest ----

  test('a long rest is told once, in Text.rest\'s words: the turns it took and the health that came back; main.js\'s rest writes none of its own', () => {
    assert.ok(Text.provided('rest'));
    assert.equal(Text.rest({ turns: 152, regained: 23, hp: 30, maxHp: 30 }), 'You rested for 152 turns and recovered 23 health: now 30 of 30.');
    assert.equal(Text.rest({ turns: 2, regained: 1, hp: 17, maxHp: 30 }), 'You rested for 2 turns and recovered 1 health: now 17 of 30.');
    assert.equal(Text.rest({ turns: 3, regained: 0, hp: 9, maxHp: 30 }), 'You rested for 3 turns and recovered no health: now 9 of 30.');
    const fn = find('rest');
    assert.ok(fn && fn.type === 'FunctionDeclaration', 'main.js has rest');
    const { strings, calls } = said(fn);
    assert.deepEqual(strings.filter(s => !/^[a-z_]+$/.test(s)), [], 'rest() writes words of its own');
    assert.deepEqual([...new Set(calls)], ['rest']);
    // It says the line when the run ends, however it ends (run's end, called by stop too).
    assert.ok(/function stop\(\) \{[^}]*ending/.test(MAIN), 'stop() ends a run with its end()');
  });

  // ---- (c) The stage chip ----

  test('the stage chip\'s words are Text.stage\'s, for each stage, and main.js\'s stageChip writes none of its own (§7.2, §3.4)', () => {
    assert.ok(Text.provided('stage'));
    assert.equal(json(Text.stage({ stage: 0, count: 2, toBell: 238 })), json({ name: 'Open:', next: 'bell in 238 turns' }));
    assert.equal(json(Text.stage({ stage: 0, count: 2, toBell: 1 })), json({ name: 'Open:', next: 'bell in 1 turn' }));
    assert.equal(json(Text.stage({ stage: 1, count: 2, toWatch: 40 })), json({ name: 'After the bell:', next: 'night watch in 40 turns' }));
    assert.equal(json(Text.stage({ stage: 2, count: 2, toNightBell: 1, watchBack: null })), json({ name: 'Night watch:', next: 'next bell in 1 turn' }));
    assert.equal(Text.stage(null), null);
    const fn = find('stageChip');
    assert.ok(fn, 'main.js has stageChip');
    const { strings, calls } = said(fn);
    assert.deepEqual(strings, [], 'stageChip writes words of its own');
    assert.deepEqual([...new Set(calls)], ['stage']);
  });

  // ---- (d) Odd log wording ----

  // A synthetic event for a kind and cause, its counts many and its lists of three.
  const SAMPLE = { uid: 'x.1', uids: ['x.1', 'you', 'x.2'], int: 7, str: 'soft', bool: true, tile: [1, 2], tiles: [[1, 2], [2, 2], [3, 2]], obj: { kind: 'melee' } };
  const sample = (k, causeK) => {
    const fill = (list, o) => { for (const f of list) o[f.name] = f.type === 'uid' ? 'x.1' : JSON.parse(JSON.stringify(SAMPLE[f.type])); return o; };
    const e = fill(R.EVENTS[k].list, { k, turn: 3, tick: 300 });
    if (k === 'refused') e.reason = 'corner';
    e.cause = causeK ? fill(R.CAUSES[k][causeK].list, { k: causeK }) : { k: 'no_such_cause' };
    return e;
  };
  const names = uid => uid === 'x.1' ? 'the Warden' : uid === 'x.2' ? 'the Doorstep' : null;

  test('a special\'s noise, what it struck and what it marks read as sentences: "a special attack", "it struck you and 1 exhibit", "the tiles round it"', () => {
    const say = e => Text.event(Object.assign({ turn: 3, tick: 300 }, e), names);
    assert.equal(say({ k: 'noise', x: 1, y: 1, cls: 'soft', range: 5, cause: { k: 'special', by: 'x.1' } }), 'Soft: a special attack, heard 5 tiles away.');
    const hit = hits => say({ k: 'special', who: 'x.1', sp: 'ring', hits, cause: { k: 'special', by: 'x.1', sp: 'ring' } });
    assert.equal(hit(['you']), 'The Warden used its ring of blows: it struck you.');
    assert.equal(hit(['you', 'x.2']), 'The Warden used its ring of blows: it struck you and 1 exhibit.');
    assert.equal(hit(['x.2', 'x.1', 'x.3']), 'The Warden used its ring of blows: it struck 3 exhibits.');
    assert.equal(hit([]), 'The Warden used its ring of blows: it struck nothing.');
    const mark = (sp, tiles, gross) => say({ k: 'telegraphed', who: 'x.1', sp, tiles, cause: { k: 'special', by: 'x.1', sp, gross } });
    const call = [];
    for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) if (C.Grid.disc(x - 6, y - 6, N.HERALD_RANGE)) call.push([x, y]);
    assert.ok(call.length > 100);
    assert.equal(mark('call', call, 0), `The Warden marks the tiles within ${N.HERALD_RANGE} tiles of it for its call, at its next action.`);
    assert.equal(mark('ring', [[1, 1], [2, 1], [3, 1], [1, 3]], 9), 'The Warden marks the tiles round it for its ring of blows: 9 before your Padding, at its next action.');
    assert.equal(mark('line', [[1, 1], [2, 1], [3, 1]], 9), 'The Warden marks a line of 3 tiles for its beam: 9 before your Padding, at its next action.');
    assert.equal(mark('line', [[1, 1]], 9), 'The Warden marks a line of 1 tile for its beam: 9 before your Padding, at its next action.');
    // Over every event kind and cause: none of the odd wordings is left.
    const bad = [];
    for (const k of R.EVENT_KINDS) for (const c of [null, ...Object.keys(R.CAUSES[k] || {})]) {
      const s = Text.event(sample(k, c), names);
      if (/: a special,|it struck \d|marks \d+ tiles? for its (ring|call)/.test(s || '')) bad.push(`${k}${c ? '.' + c : ''}: ${s}`);
    }
    assert.deepEqual(bad, []);
  });

  test('exhibits of one name stirring alike in one step are one line in the log, which says how many more; other kinds are never merged', () => {
    const name = uid => uid === 'you' ? null : 'the Carbon Flimsies, in Bundles';
    const pip = (who, dist) => ({ k: 'pip', turn: 3, tick: 300, who, pips: 1, delta: 1, cause: { k: 'ring', dist } });
    const one = 'The Carbon Flimsies, in Bundles stirs (1 of 3 pips): you are inside your ring, 3 tiles away.';
    assert.equal(json(Text.log([pip('a.1', 3), pip('a.2', 3)], name)), json([one + ' So does another of the same name.']));
    assert.equal(json(Text.log([pip('a.1', 3), pip('a.2', 3), pip('a.3', 3)], name)), json([one + ' So do 2 others of the same name.']));
    // Told apart by their distance, they are two lines; one out of view is not told.
    assert.equal(Text.log([pip('a.1', 3), pip('a.2', 4)], name).length, 2);
    assert.equal(json(Text.log([pip('a.1', 3), pip('a.2', 3)], name, uid => uid === 'a.1')), json([one]));
    // Two blows alike are two blows: never merged.
    const blow = by => ({ k: 'damaged', turn: 3, tick: 300, who: 'you', amount: 1, hp: 9, cause: { k: 'attack', by, roll: 20, chance: 70, raw: 1, pad: 0, how: { kind: 'melee' } } });
    const blows = Text.log([blow('a.1'), blow('a.2')], name);
    assert.equal(blows.length, 2);
    assert.equal(blows[0], blows[1]);
  });

  // ---- (e) The recap's sentences ----

  test('every M3 waking and hunting sentence is told in the past, so the recap\'s "On turn N, …" reads as one sentence: "woke and began hunting you", never "woke and is hunting you"', () => {
    const bad = [];
    let n = 0;
    for (const k of ['woke', 'hunting']) for (const c of Object.keys(R.CAUSES[k])) {
      if (R.CAUSES[k][c].built !== 'M3') continue; // text/system.js, frozen, keeps M4's own
      for (const was of [null, 'dormant', 'awake']) for (const mode of ['hunting', 'awake']) {
        const e = Object.assign(sample(k, c), { who: 'x.1', was, mode });
        const s = Text.event(e, names);
        n++;
        if (/ is hunting you| goes to look| is awake\b| is on its rounds| splits in two/.test(s)) bad.push(`${k}.${c} (was ${was}, ${mode}): ${s}`);
      }
    }
    assert.deepEqual(bad, []);
    assert.ok(n >= 100, `${n} sentences`);
    const said = (k, c, was, extra) => Text.event(Object.assign(sample(k, c), { who: 'x.1', was, mode: 'hunting' }, extra || {}), names);
    assert.equal(said('hunting', 'seen', 'dormant'), 'The Warden woke and began hunting you: it saw you.');
    assert.equal(said('hunting', 'seen', 'awake'), 'The Warden saw you and began hunting you.');
    assert.equal(said('hunting', 'damage', 'dormant'), 'The Warden woke and began hunting you: it was struck.');
    assert.equal(said('woke', 'awake', null), 'The Warden was already awake: it never sleeps.');
  });
};
