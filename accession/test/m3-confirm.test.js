// The confirmations' words (BUILD.md §7.1, §3.4): every sentence about the rules lives in text.js
// and its text/ fragments, so a confirmation's title, button and lines are Text.confirm's
// (text/confirm.js), and js/main.js only decides when one is asked. Here: Text.confirm gives
// clean words for each kind, with the numbers the rules use; and main.js's askFor writes no
// words of its own (only the kinds it asks Text for), which the main.js before Wave 3's review
// did not meet.
module.exports = ({ test, assert, loadCore, root, fs, path }) => {
  const C = loadCore();
  const { Text, N } = C;
  const json = JSON.stringify;
  const clean = s => typeof s === 'string' && s.length > 0 && !/undefined|NaN|\[object|null/.test(s);

  test('Text.confirm gives each confirmation its question, its button and a sentence, with the rules\' numbers', () => {
    const nameOf = uid => uid === 'x.1' ? 'the Heliograph, Landing Pattern' : null;
    const cases = [
      ['shards', null, { title: 'Step onto the shards?', yes: 'Step onto the shards', line: `Broken glass is loud underfoot: while you stand on it, your ring reaches ${N.RING_LOUD_FLOOR} tiles farther.` }],
      ['bash', { glassName: 'Plate', blows: 1 }, { title: 'Break the glass?', yes: 'Strike the glass', line: 'This blow breaks its Plate glass, with a crash.' }],
      ['bash', { glassName: 'Laminated', blows: 2 }, { title: 'Break the glass?', yes: 'Strike the glass', line: 'This blow is loud and cracks its Laminated glass; 1 more breaks it, the last with a crash.' }],
      ['bash', { glassName: 'Security', blows: 3 }, { title: 'Break the glass?', yes: 'Strike the glass', line: 'This blow is loud and cracks its Security glass; 2 more break it, the last with a crash.' }],
      ['leave', null, { title: 'Leave the department?', yes: 'Leave', line: 'Your visit ends when you go through this door.' }],
      ['threat', { by: 'x.1', shape: 'line', dmg: 6, stay: true }, { title: 'Stay on the marked tile?', yes: 'Stay', line: 'The Heliograph, Landing Pattern’s beam goes off on that tile before your next turn: it would deal you 6, with no roll.' }],
      ['threat', { by: 'x.1', shape: 'ring', dmg: 4, stay: false }, { title: 'Step onto the marked tile?', yes: 'Step onto it', line: 'The Heliograph, Landing Pattern’s ring of blows goes off on that tile before your next turn: it would deal you 4, with no roll.' }],
      ['threat', { by: 'y.2', shape: 'line', dmg: 1, stay: true }, { title: 'Stay on the marked tile?', yes: 'Stay', line: 'An exhibit’s beam goes off on that tile before your next turn: it would deal you 1, with no roll.' }],
    ];
    for (const [k, data, want] of cases) {
      const got = Text.confirm(k, data, nameOf);
      assert.equal(json(got), json(want), k);
      assert.ok(clean(got.title) && /\?$/.test(got.title) && clean(got.yes) && clean(got.line) && /^[A-Z].*\.$/.test(got.line), json(got));
    }
    assert.equal(Text.confirm('no_such_kind', {}, nameOf), null);
    assert.ok(Text.provided('confirm'));
  });

  test('js/main.js decides when to ask, and writes none of a confirmation\'s words: askFor\'s only strings are the kinds it asks Text.confirm for', () => {
    const acorn = require(path.join(root, 'tools/vendor/acorn/acorn.js'));
    const src = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
    const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script' });
    let fn = null;
    (function walk(n) {
      if (!n || typeof n.type !== 'string' || fn) return;
      if (n.type === 'FunctionDeclaration' && n.id && n.id.name === 'askFor') { fn = n; return; }
      for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
    })(ast);
    assert.ok(fn, 'main.js has askFor');
    const strings = [], calls = [];
    (function walk(n) {
      if (!n || typeof n.type !== 'string') return;
      if (n.type === 'Literal' && typeof n.value === 'string') strings.push(n.value);
      if (n.type === 'TemplateLiteral') strings.push(n.quasis.map(q => q.value.cooked).join('${}'));
      if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.object.name === 'Text') calls.push(n.callee.property.name);
      for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
    })(fn);
    // The action kinds it looks at and the kinds of confirmation it asks for: words, never a sentence.
    const KINDS = ['move', 'bash', 'leave', 'shards', 'threat'];
    assert.deepEqual(strings.filter(s => !KINDS.includes(s)), [], 'askFor writes words of its own');
    assert.deepEqual([...new Set(calls)], ['confirm']);
    for (const k of ['shards', 'bash', 'leave', 'threat']) assert.ok(strings.includes(k), `askFor asks for ${k}`);
  });
};
