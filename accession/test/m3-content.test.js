// M3's pack content (BUILD.md §5.2, §5.3, §5.5, §8.5, §8.6): what the three departments add
// for M3's rules. The items, in the pack item schema, trimmed from design/samples.md §2.6,
// §3.6 and §4.6 so that every primitive is one the slice implements, at the sample's budget
// and in the sample's form; the consumables' local names (one per seal) and identifying
// labels (one per kind); the `ally_hit` groups; old_repair's side. And the paragraph lint: a
// paragraph carries no rule (§5.3), so a number next to a rule word (tiles, turns, damage, %,
// pips, HP, Padding, range, rank, times, a grade word …), or a blow's damage ("strikes for
// 3"), fails, unless the species' own Behaviour line states the same number of the same
// thing. Plain digits stay legal ("Round Book 3", "Logbooks 14 to 22"). The lint finds
// numbers; a rule stated in words alone is checked where this file knows the rule: each
// label against its kind's effects and the other kinds', and each item's paragraph against
// what its item does. The expected figures are written out here from the samples and
// BUILD.md, never read from rule code.
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore(['tools/monkey.js']);
  const { Packs, Registry, Clauses, Dept, State, Labels, Monkey, N, Grid, Setup, Kit, Consumables } = C;
  const json = x => JSON.stringify(x);
  const ACCS = ['S9', 'A4', 'M11'];
  const packs = ACCS.map(acc => Packs.get(acc));
  const KINDS = Registry.order('CONSUMABLES');
  const words = s => s.trim().split(/\s+/).filter(Boolean).length;
  const BAD = /undefined|NaN|\[object/;

  // Every string in a pack, with where it is, for the checks that read all of them.
  function strings(v, where, out) {
    if (typeof v === 'string') out.push([where, v]);
    else if (Array.isArray(v)) v.forEach((x, i) => strings(x, `${where}[${i}]`, out));
    else if (v && typeof v === 'object') for (const k of Object.keys(v)) strings(v[k], `${where}.${k}`, out);
    return out;
  }

  // ---- The paragraph lint (§5.3; plan R26) ----
  // A rule is a number and a rule word together: the number, then the word with at most
  // two words between ("two tiles", "for three whole turns", "70%", "a two-tile reach"), a
  // rule word and then its number at once or after "of" ("Grade IV", "Padding 2", "a radius
  // of 2"), or a blow's damage, "for" a number after a verb of striking ("strikes for 3",
  // "hits for 3 to 6"). Rule words fall in classes, so that "two paces" and "2 tiles" state
  // the same thing.
  const UNITS = {
    tile: ['tile', 'tiles', 'pace', 'paces', 'step', 'steps', 'square', 'squares'],
    turn: ['turn', 'turns', 'action', 'actions', 'tick', 'ticks'],
    damage: ['damage', 'blow', 'blows', 'hit', 'hits'],
    percent: ['%', 'percent', 'cent'],
    pip: ['pip', 'pips'],
    hp: ['hp', 'health'],
    stat: ['padding', 'acc', 'eva', 'accuracy', 'evasion'],
    charge: ['charge', 'charges'],
    grade: ['grade', 'grades', 'clearance', 'tier', 'tiers', 'lock', 'locks'],
    range: ['range', 'ranges', 'radius'],
    rank: ['rank', 'ranks', 'level', 'levels'],
    times: ['times'],
  };
  const UNIT = new Map();
  for (const cls of Object.keys(UNITS)) for (const w of UNITS[cls]) UNIT.set(w, cls);
  const STRIKES = ['strike', 'strikes', 'struck', 'hit', 'hits', 'deal', 'deals', 'dealt', 'shoot', 'shoots', 'shot', 'bite', 'bites', 'nip', 'nips', 'sting', 'stings'];
  const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
    'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  const ORDINALS = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
  const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100 };
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  // The number a token names, as a string ('2', '2.4', '1–2', '25', 'half', 'x2'), or null.
  function number(tok) {
    const t = tok.toLowerCase();
    if (/^\d/.test(t)) return t.replace(/(st|nd|rd|th)$/, '').replace(/%$/, '');
    if (NUMBER_WORDS.includes(t)) return String(NUMBER_WORDS.indexOf(t));
    if (ORDINALS.includes(t)) return String(ORDINALS.indexOf(t));
    if (t in TENS) return String(TENS[t]);
    // A hyphenated number word: twenty-five, thirty-first.
    const parts = t.split('-');
    if (parts.length === 2 && parts[0] in TENS) {
      const unit = NUMBER_WORDS.indexOf(parts[1]) > 0 ? NUMBER_WORDS.indexOf(parts[1]) : ORDINALS.indexOf(parts[1]);
      if (unit > 0 && unit < 10) return String(TENS[parts[0]] + unit);
    }
    if (t === 'single' || t === 'once') return '1';
    if (t === 'double' || t === 'twice' || t === 'triple' || t === 'thrice') return t === 'double' || t === 'twice' ? 'x2' : 'x3';
    if (t === 'half') return 'half';
    return null;
  }
  // The words of a text: digits (with a decimal, a range or a %) and words; a hyphenated word
  // is one token if it is a number (twenty-five), else its parts ("two-tile" is two and tile).
  function tokens(text) {
    const out = [];
    for (const tok of text.match(/\d+(?:[.,]\d+)?(?:[–-]\d+)?(?:st|nd|rd|th)?%?|[A-Za-z’'-]+|%/g) || []) {
      if (/[A-Za-z]-[A-Za-z]/.test(tok) && number(tok) === null) out.push(...tok.split('-').filter(Boolean));
      else out.push(tok);
    }
    return out;
  }
  function ruleTalk(text) {
    const toks = tokens(text), low = toks.map(t => t.toLowerCase());
    const out = [];
    toks.forEach((tok, i) => {
      const n = number(tok);
      if (n !== null) {
        if (/%$/.test(tok)) { out.push({ n, cls: 'percent', at: tok }); return; }
        for (let j = i + 1; j <= i + 3 && j < toks.length; j++) {
          if (number(toks[j]) !== null) break;
          const cls = UNIT.get(low[j]);
          if (cls) { out.push({ n, cls, at: toks.slice(i, j + 1).join(' ') }); break; }
        }
      }
      const cls = UNIT.get(low[i]);
      if (cls) {
        // The rule word, then its number: at once ("Padding 2", "Grade IV"), or after "of"
        // ("a radius of 2", "a range of five").
        const of = low[i + 1] === 'of', at = of ? i + 2 : i + 1, next = toks[at];
        if (next !== undefined) {
          const m = cls === 'grade' && ROMAN.includes(next) ? String(ROMAN.indexOf(next) + 1)
            : /^\d/.test(next) || (of && number(next) !== null) ? number(next) : null;
          if (m !== null) out.push({ n: m, cls, at: toks.slice(i, at + 1).join(' ') });
        }
      }
      // A blow's damage: "for" a number, after a verb of striking within four words
      // ("strikes for 3", "strikes from beside you for 2–6", "hits for 3 to 6").
      if (low[i] === 'for' && i + 1 < toks.length && number(toks[i + 1]) !== null && low.slice(Math.max(0, i - 4), i).some(w => STRIKES.includes(w))) {
        const a = number(toks[i + 1]), b = low[i + 2] === 'to' && i + 3 < toks.length ? number(toks[i + 3]) : null;
        out.push({ n: b === null ? a : `${a}–${b}`, cls: 'damage', at: toks.slice(i, b === null ? i + 2 : i + 4).join(' ') });
      }
    });
    return out;
  }
  // The rules a text states that none of the given Behaviour lines states.
  const unstated = (text, lines) => {
    const said = lines.flatMap(ruleTalk);
    return ruleTalk(text).filter(r => !said.some(s => s.cls === r.cls && s.n === r.n));
  };
  const linesOf = sp => [1, 2, 3, 4, 5, 6, 7].map(depth => Clauses.line(sp, { depth }));

  test('the paragraph lint flags a number next to a rule word, passes plain digits, and lets a paragraph echo its Behaviour line', () => {
    for (const [text, at] of [['It moves 2 tiles a turn.', '2 tiles'], ['It sleeps for three whole turns.', 'three whole turns'],
      ['A cast has 70% of the usual health.', '70%'], ['It strikes for 4 damage.', '4 damage'], ['Only a keeper of Grade IV may open it.', 'Grade IV'],
      ['It loses one pip.', 'one pip'], ['Its Padding 2 coat.', 'Padding 2'], ['It acts every third action.', 'third action'],
      ['Blows from behind deal double damage.', 'double damage'], ['It holds four charges.', 'four charges'], ['It goes two paces from the nest.', 'two paces'],
      ['It strikes twenty-five turns late.', 'twenty-five turns'], ['It has a two-tile reach.', 'two tile'], ['It covers a radius of 2.', 'radius of 2'],
      ['It shoots at range 5.', 'range 5'], ['It gains rank 2.', 'rank 2'], ['A level 3 lock.', 'level 3'], ['It deals 1.5 times as much.', '1.5 times'],
      ['It acts three times.', 'three times'], ['It hits for 3 to 6.', 'for 3 to 6'], ['It strikes for 4.', 'for 4'], ['A range of five.', 'range of five'],
      ['It sleeps for thirty-one turns.', 'thirty-one turns'], ['Fifty per cent of its health.', 'Fifty per cent']]) {
      const found = ruleTalk(text);
      assert.ok(found.some(r => r.at === at), `${text}: expected "${at}", found ${json(found)}`);
    }
    for (const text of ['Round Book 3 places the grazer at the north end.', 'Logbooks 14 to 22 are still aboard.', 'H. 2.4 m', 'Each sheet 33 × 21 cm',
      'It was countersigned by four keepers, all of whom were awake.', 'Nine years of signals and not one message.', 'Volume I missing, its spare also missing',
      'Long-Handled Date Stamp', 'Signal Form, Folded in Four', 'It called a single time.', 'The Board shows times of sending and times of arrival.',
      'Signalling at short range.', 'It was kept for 3 to 6 years.', 'They sat for one bust.', 'The Re-admission Ticket'])
      assert.equal(json(ruleTalk(text)), '[]', text);
    // "Unless the Behaviour line states the same rule": the Brooder's "two paces from the
    // nest" is its tether, which its line states as "2 tiles"; another line does not.
    const brooder = Packs.species('S9', 'S9.4'), clerk = Packs.species('A4', 'A4.1'), text = 'It has never been more than two paces from the nest.';
    assert.equal(unstated(text, []).length, 1);
    assert.equal(unstated(text, linesOf(brooder)).length, 0, linesOf(brooder)[0]);
    assert.equal(unstated(text, linesOf(clerk)).length, 1, linesOf(clerk)[0]);
  });

  test('no string in the packs or the shared species states a rule its Behaviour line does not', () => {
    const problems = [];
    const species = (sp, where) => {
      const lines = linesOf(sp);
      for (const [at, s] of strings(sp, where, [])) for (const r of unstated(s, lines)) problems.push(`${at}: "${r.at}"`);
    };
    for (const p of packs) {
      for (const sp of p.species) species(sp, sp.id);
      // Everything else (title, blurb, house rule, programme, modules, the Centrepiece, the
      // items, the names and labels) has no Behaviour line of its own to echo.
      for (const k of Object.keys(p)) if (k !== 'species') for (const [at, s] of strings(p[k], `${p.acc}.${k}`, [])) for (const r of ruleTalk(s)) problems.push(`${at}: "${r.at}"`);
    }
    for (const sp of Packs.sharedList()) species(sp, sp.id);
    assert.equal(problems.join('\n'), '', 'rule vocabulary in pack text');
  });

  test('no text in the packs or the shared species contains "undefined", "NaN" or "[object"', () => {
    for (const p of packs) for (const [where, s] of strings(p, p.acc, [])) assert.ok(!BAD.test(s), `${where}: ${s}`);
    for (const sp of Packs.sharedList()) for (const [where, s] of strings(sp, sp.id, [])) assert.ok(!BAD.test(s), `${where}: ${s}`);
  });

  // ---- Items ----
  const ITEM_KEYS = ['id', 'kind', 'form', 'instrument', 'prims', 'name', 'tomb', 'paragraph'];
  const TOMB_KEYS = ['maker', 'date', 'medium', 'dims', 'credit'];
  const WEAPON_FORMS = ['light', 'balanced', 'heavy', 'reach'], GARMENT_FORMS = ['light', 'standard', 'heavy'];

  test('every pack item has the §5.2 schema exactly, with primitives the slice implements in M3', () => {
    for (const p of packs) {
      assert.ok(Array.isArray(p.items) && p.items.length, `${p.acc} has items`);
      for (const it of p.items) {
        const extra = Object.keys(it).filter(k => !ITEM_KEYS.includes(k));
        assert.equal(json(extra), '[]', `${it.id}: fields outside the schema (a tier comes from depth, never from the pack)`);
        assert.ok(['weapon', 'garment', 'curio', 'instrument'].includes(it.kind), `${it.id}: kind ${it.kind}`);
        assert.ok(it.id.startsWith(p.acc + '.'), `${it.id} belongs to ${p.acc}`);
        if (it.kind === 'weapon') assert.ok(WEAPON_FORMS.includes(it.form), `${it.id}: weapon form ${it.form}`);
        else if (it.kind === 'garment') assert.ok(GARMENT_FORMS.includes(it.form), `${it.id}: garment form ${it.form}`);
        else assert.ok(!('form' in it), `${it.id}: a ${it.kind} has no form`);
        if (it.kind === 'instrument') assert.ok(Registry.INSTRUMENTS[it.instrument] && Registry.INSTRUMENTS[it.instrument].built === 'M3', `${it.id}: instrument ${it.instrument}`);
        else assert.ok(!('instrument' in it), `${it.id}: only an instrument names one`);
        assert.ok(Array.isArray(it.prims), `${it.id}: prims`);
        for (const pr of it.prims) {
          assert.equal(json(Object.keys(pr).sort()), json(['cls', 'id']), `${it.id}: ${json(pr)}`);
          assert.ok(Registry.ITEM_PRIMS[pr.id], `${it.id}: ${pr.id} is not a primitive the slice implements (§8.5)`);
          assert.equal(Registry.ITEM_PRIMS[pr.id].built, 'M3', `${it.id}: ${pr.id} waits for M4`);
          assert.ok(['S', 'M', 'L'].includes(pr.cls), `${it.id}: ${pr.id} class ${pr.cls}`);
        }
        assert.equal(new Set(it.prims.map(pr => pr.id)).size, it.prims.length, `${it.id}: a primitive given twice`);
        if (it.kind === 'instrument') assert.equal(it.prims.length, 0, `${it.id}: an instrument's effect is its instrument, and its charges come from §8.10`);
        assert.ok(typeof it.name === 'string' && it.name.length, `${it.id}: name`);
        assert.equal(json(Object.keys(it.tomb).sort()), json(TOMB_KEYS.slice().sort()), `${it.id}: tombstone fields`);
        for (const k of TOMB_KEYS) assert.ok(typeof it.tomb[k] === 'string' && it.tomb[k].length, `${it.id}: tomb.${k}`);
      }
    }
  });

  test('each pack holds what a department places (§8.5): enough weapons and garments, and a curio or instrument', () => {
    for (const p of packs) {
      const kinds = p.items.map(it => it.kind), count = (...ks) => kinds.filter(k => ks.includes(k)).length;
      assert.ok(count('weapon', 'garment') >= N.EQUIPMENT_PER_DEPT, `${p.acc}: ${count('weapon', 'garment')} weapons and garments`);
      assert.ok(count('weapon') >= 1 && count('garment') >= 1, `${p.acc}: a weapon and a garment`);
      assert.ok(count('curio', 'instrument') >= N.CURIO_OR_INSTRUMENT_PER_DEPT, `${p.acc}: a curio or instrument`);
    }
  });

  // The samples' item tables (design/samples.md §2.6, §3.6, §4.6), with each item's budget
  // in points (S 1, M 2, L 3; a flag 2, as the samples price `reach`, `sweep` and `breaker`;
  // each of the slice's instruments 2, the Pin-Driver's price as the sample's bolt(edge, M))
  // and each weapon's form as its sample's Hidden line gives it ("light, fast", "heavy", or
  // no note, which is Balanced). What is kept, cut, or left for M4 is §5.5's trim rule
  // applied item by item: a primitive the slice lacks becomes one it has, of the same budget,
  // and the form stays the sample's, so a flag never becomes a form.
  const SAMPLES = {
    S9: { kept: { 'S9.7': 2, 'S9.8': 2, 'S9.9': 2, 'S9.10': 3 }, forms: { 'S9.8': 'light' }, cut: [], signature: 'S9.11' },
    A4: { kept: { 'A4.6': 3, 'A4.7': 3, 'A4.8': 2, 'A4.10': 2 }, forms: { 'A4.6': 'light', 'A4.7': 'heavy' }, cut: ['A4.9'], signature: 'A4.11' },
    M11: { kept: { 'M11.6': 2, 'M11.7': 2, 'M11.9': 4 }, forms: { 'M11.9': 'balanced' }, cut: ['M11.8'], signature: 'M11.10' },
  };
  const POINTS = { S: 1, M: 2, L: 3 }, FLAGS = ['reach', 'quiet', 'breaker'];
  // An item's budget in the slice: its primitives (a flag is 2 whatever its class), and an
  // instrument's effect (2). A form costs nothing: the Reach form pays for its reach with
  // the damage it lacks against Balanced (§8.1), so it is no stand-in for a sample's flag.
  const budget = it => it.prims.reduce((t, pr) => t + (FLAGS.includes(pr.id) ? 2 : POINTS[pr.cls]), 0) + (it.kind === 'instrument' ? 2 : 0);

  test('the samples\' items are trimmed per §5.5: each kept at its budget and in its form, cut only if nothing in the slice matches it, no Signature piece', () => {
    for (const p of packs) {
      const S = SAMPLES[p.acc], ids = p.items.map(it => it.id);
      assert.equal(json(ids), json(Object.keys(S.kept)), `${p.acc}: the kept items, in the sample's order`);
      for (const it of p.items) assert.equal(budget(it), S.kept[it.id], `${it.id}: budget ${budget(it)} against the sample's ${S.kept[it.id]}`);
      for (const it of p.items.filter(i => i.kind === 'weapon')) assert.equal(it.form, S.forms[it.id], `${it.id}: the sample's form`);
      for (const id of [...S.cut, S.signature]) assert.ok(!ids.includes(id), `${id} is cut or waits for M4`);
    }
    // The trims, named: what each off-set primitive became.
    const item = id => packs.flatMap(p => p.items).find(it => it.id === id);
    const prims = id => json(item(id).prims.map(pr => pr.id + ':' + pr.cls));
    assert.equal(prims('S9.7'), json(['quiet:M']), 'the Overshoes: muffled becomes quiet');
    assert.equal(prims('S9.8'), json(['dmg:S', 'acc:S']), 'the Tongs: knockback becomes Acc');
    assert.equal(prims('S9.10'), json(['eva:L']), 'Round Book 9: perception becomes Eva');
    assert.equal(prims('A4.6'), json(['dmg:S', 'reach:M']), 'the Date Stamp: sweep becomes the reach flag, on its Light form');
    assert.equal(prims('A4.8'), json(['pad:S', 'eva:S']), 'the Sleeve Protectors: armour is Padding, resist(fire) becomes Eva');
    assert.equal(prims('A4.10'), json(['acc:M']), 'the Register: the sample\'s fallback without L+, perception(M), as Acc');
    assert.equal(item('M11.6').instrument, 'pin_driver', 'the Hand Lamp: its bolt is the Pin-Driver\'s');
    assert.equal(prims('M11.7'), json(['pad:M']), 'the Apron: armour and resist(light) become Padding');
    assert.equal(prims('M11.9'), json(['dmg:M', 'reach:M']), 'the Signal Flag keeps its reach flag, which the slice has');
    // No pack weapon takes the Reach form: each sample weapon's form is Light, Heavy or none.
    assert.ok(packs.every(p => p.items.every(it => it.form !== 'reach')), 'a flag never becomes the Reach form');
  });

  test('an item\'s paragraph is at most 70 words and says no more than its item does', () => {
    for (const p of packs) for (const it of p.items) {
      assert.ok(it.paragraph.length && words(it.paragraph) <= 70, `${it.id}: ${words(it.paragraph)} words`);
    }
    // The cut effects are gone from the prose: the Tongs no longer push, the Date Stamp no
    // longer strikes three at once, the Hand Lamp no longer holds two signals, the Sleeve
    // Protectors no longer resist fire, the Pin-Driver no longer holds two pins.
    const para = id => packs.flatMap(p => p.items).find(it => it.id === id).paragraph;
    const none = (id, re, why) => assert.ok(!re.test(para(id)), `${id} ${why}: ${para(id)}`);
    const says = (id, re, why) => assert.ok(re.test(para(id)), `${id} ${why}: ${para(id)}`);
    none('S9.8', /back a pace|push/i, 'pushes');
    none('A4.6', /three at a stroke/i, 'sweeps');
    none('M11.6', /two signals/i, 'holds two charges');
    none('A4.8', /burn/i, 'resists fire');
    none('S9.9', /two pins/i, 'holds two charges');
    none('S9.10', /shows the court/i, 'shows the court');
    none('A4.10', /tells a forgery from a spare/i, 'identifies');
    // And none overstates what it keeps. Reach strikes across an empty tile, never past
    // someone (§8.1: "over an empty tile"); quiet makes your ring smaller while you move, so
    // the court still hears blows and doors; the Tongs' Acc bonus is small, and blows are
    // still rolled.
    none('M11.9', /reach(es|ing)? past|past the person|over (a|the) (person|someone)/i, 'reaches past a person');
    says('M11.9', /empty/i, 'says Reach needs an empty tile');
    none('A4.6', /\bpast\b|over (a|the) (person|someone)/i, 'reaches past a person');
    none('S9.7', /court could not hear|could not hear the keepers|unheard|silent/i, 'silences you');
    says('S9.7', /closer/i, 'lets you come closer');
    none('S9.8', /\balways\b|never miss/i, 'never misses');
  });

  test('ids are unique: every species, Centrepiece and item across the packs and the shared species', () => {
    const seen = new Map();
    const add = (id, where) => { assert.ok(!seen.has(id), `${id} is used by ${seen.get(id)} and ${where}`); seen.set(id, where); };
    for (const p of packs) {
      for (const sp of p.species) add(sp.id, `${p.acc} species`);
      if (p.centrepiece) add(p.centrepiece.id, `${p.acc} centrepiece`);
      for (const it of p.items) add(it.id, `${p.acc} item`);
    }
    for (const sp of Packs.sharedList()) add(sp.id, 'shared');
    for (const p of packs) {
      const all = [...p.species.map(s => s.name), p.centrepiece.name, ...p.items.map(i => i.name), ...p.consumables.names];
      assert.equal(new Set(all).size, all.length, `${p.acc}: two things share a name`);
    }
  });

  // §5.2 asks 40–70 words of a species' or Centrepiece's paragraph. The M2 paragraphs below,
  // taken from the samples (§5.5) and kept as written (R26), fall outside it; the list is
  // pinned, so that it cannot grow, and each stays within 10–80.
  const LONG_OR_SHORT = ['S9.1', 'S9.2', 'S9.3', 'S9.4', 'S9.12', 'A4.1', 'A4.1a', 'A4.4', 'M11.1'];
  test('a species\' or Centrepiece\'s paragraph is 40–70 words, but for the samples\' paragraphs kept as written', () => {
    const outside = [];
    for (const p of packs) for (const sp of [...p.species, p.centrepiece]) {
      const n = words(sp.paragraph);
      assert.ok(n >= 10 && n <= 80, `${sp.id}: ${n} words`);
      if (n < 40 || n > 70) outside.push(sp.id);
    }
    assert.equal(json(outside), json(LONG_OR_SHORT), 'the paragraphs outside 40–70 words');
  });

  // ---- Consumables: local names and identifying labels ----
  const kindName = k => Registry.CONSUMABLES[k].name;
  // The words a local name may not use: any kind's name, or a seal family's (§8.6: wax
  // seals over the Solutions, ink stamps over the Ephemera), or a noun that says what a kind
  // is (a notice or sign is "Quiet, Please"; a map or chart the Floor Plan; a slip, pass or
  // stub the Ticket; an index the Card; a spray, smoke or gas the Fumigant; a glue, varnish,
  // salve or tonic a Solution that mends or fixes), so a name never says which kind lies
  // under its seal, which is shuffled every run (D5.3).
  const GIVEAWAY = /consolidant|fixative|fumigant|solvent|catalogue|\bcard\b|\bplan\b|quiet|ticket|re-admission|\bseal|\bwax|\bink\b|stamp|\b(notices?|signs?|placards?|posters?|bulletins?|maps?|charts?|slips?|pass(es)?|stubs?|coupons?|vouchers?|index|spray|smoke|gas|glue|adhesive|varnish|lacquer|salve|balm|tonic|remedy|medicine)\b/i;
  // A name's main noun: the last word before its first comma or preposition, without a
  // possessive ("Night Staff Notice, Folded" is a notice; "Form in Triplicate" a form).
  const head = n => { const w = n.split(',')[0].split(/\s+(?:from|in|to|of|on|at|for|with)\s+/i)[0].trim().split(/\s+/); return w[w.length - 1].replace(/[’']s$/, ''); };
  // The kinds whose label in the pack uses a name's main noun: a name that a label echoes
  // ("the notice the night staff read aloud") points at that kind, wrongly in most runs.
  const echoes = (name, labels) => { const re = new RegExp(`\\b${head(name)}(s|es)?\\b`, 'i'); return KINDS.filter(k => re.test(labels[k])); };

  test('each pack names the 8 seals: 4 Solutions\' then 4 Ephemera\'s, distinct, short, naming no kind, and echoed by no label', () => {
    assert.equal(json(Registry.order('SEALS').map(s => Registry.SEALS[s].cls)), json(['solution', 'solution', 'solution', 'solution', 'ephemera', 'ephemera', 'ephemera', 'ephemera']));
    assert.equal(json(['Night Staff Notice, Folded', 'Form in Triplicate', 'Loose Page From a Round Book', 'Keeper’s Flask, Dented', 'Linesman’s Canteen'].map(head)),
      json(['Notice', 'Form', 'Page', 'Flask', 'Canteen']));
    for (const p of packs) {
      assert.equal(json(Object.keys(p.consumables).sort()), json(['labels', 'names']), `${p.acc}: consumables`);
      const names = p.consumables.names;
      assert.ok(Array.isArray(names) && names.length === 8, `${p.acc}: 8 names`);
      assert.equal(new Set(names).size, 8, `${p.acc}: the names differ`);
      for (const n of names) {
        assert.ok(typeof n === 'string' && n.length > 0 && n.length <= 40, `${p.acc}: "${n}" is 1–40 characters, for the tombstone line`);
        assert.ok(!GIVEAWAY.test(n), `${p.acc}: "${n}" names a kind or a seal family`);
        assert.equal(json(echoes(n, p.consumables.labels)), '[]', `${p.acc}: "${n}" is a ${head(n).toLowerCase()}, which a label of the pack names`);
      }
    }
    // The check bites: the names this pass changed, with the labels they echoed.
    const S9 = Packs.get('S9').consumables.labels, A4 = Packs.get('A4').consumables.labels;
    assert.equal(json(echoes('Night Staff Notice, Folded', S9)), json(['quiet']));
    assert.equal(json(echoes('Form in Triplicate', Object.assign({}, A4, { ticket: 'The Re-admission Ticket is the Office’s form for starting again.' }))), json(['ticket']));
    assert.ok(GIVEAWAY.test('Timetable Slip, Superseded') && GIVEAWAY.test('Folded Notice') && !GIVEAWAY.test('Passage Leaflet'));
  });

  test('each pack has an identifying label for each of the 8 kinds: 40–70 words, naming its own kind and no other, and no local name', () => {
    for (const p of packs) {
      const labels = p.consumables.labels;
      assert.equal(json(Object.keys(labels).sort()), json(KINDS.slice().sort()), `${p.acc}: one label per kind`);
      for (const k of KINDS) {
        const l = labels[k], n = words(l);
        assert.ok(n >= 40 && n <= 70, `${p.acc} ${k}: ${n} words`);
        assert.ok(l.includes(kindName(k)), `${p.acc} ${k}: the label names ${kindName(k)}`);
        for (const o of KINDS) if (o !== k) assert.ok(!l.includes(kindName(o)), `${p.acc} ${k}: the label names ${kindName(o)} as well`);
        for (const name of p.consumables.names) assert.ok(!l.includes(name), `${p.acc} ${k}: the label names the seal-bound "${name}"`);
      }
      assert.equal(new Set(KINDS.map(k => labels[k])).size, 8, `${p.acc}: the labels differ`);
    }
    // And across the packs: each department writes its own.
    for (const k of KINDS) assert.equal(new Set(packs.map(p => p.consumables.labels[k])).size, packs.length, `${k}: the packs share a label`);
  });

  // What each kind does (§8.6), as a label says it in the museum's voice. TRUTH: the words a
  // reader learns its effect from, every one of which its label has. EFFECTS: the words that
  // say a kind's effect, none of which another kind's label may use, so a label never lends
  // its kind another's effect. FALSE: what §8.6 says a kind does not do.
  const TRUTH = {
    consolidant: [/drunk/i, /at once/i, /mend/i, /thrown|spilt/i],
    fixative: [/drank|drunk/i, /move|lift a hand|bolted/i, /thrown/i, /in place/i],
    fumigant: [/cough/i, /thrown/i, /cloud/i, /see through/i, /asleep/i],
    solvent: [/thrown/i, /glass/i, /sound/i, /drink|drunk/i, /not of their bruises/i],
    card: [/read/i, /seal you do not yet know/i],
    plan: [/read/i, /whole department|every gallery/i, /Highlights/],
    quiet: [/read/i, /within earshot/i, /settle back into sleep/i, /fall asleep where they stand/i, /look about/i, /Night Watchman/],
    ticket: [/read/i, /entrance/i, /hunting you loses your trail/i, /except the Night Watchman/],
  };
  const EFFECTS = {
    consolidant: [/\bmend/i, /\bheal/i, /\bcloses? [^.]*\b(wounds|cuts)\b/i],
    fixative: [/\bin place\b/i, /\bfix(es|ed|ing)?\b/i, /\b(cannot|could not|could neither|unable to) (move|lift)/i, /\bbolted\b/i],
    fumigant: [/\bcough/i, /\bcloud\b/i, /\bsee through\b/i, /\bsleeps the deeper\b/i],
    solvent: [/\bdissolv/i, /\bshards?\b/i, /\b(without a|no) sound\b/i, /\blingering ill/i],
    card: [/\bwhat lies under\b/i, /\bseal you do not yet know\b/i],
    plan: [/\bHighlights\b/, /\bwhole department\b|\bevery gallery\b/i],
    quiet: [/\bwithin earshot\b/i, /\bcalms?\b/i, /\bsettle back into sleep\b/i, /\bfall asleep\b/i],
    ticket: [/\bentrance\b/i, /\btrail\b/i],
  };
  const FALSE = {
    consolidant: [/\b(harms?|hurts?|poisons?)\b/i],                        // it heals whatever it splashes
    fixative: [],
    fumigant: [/\bwak(e|es|ing|ens)\b/i, /\bawake\b/i],                     // it takes pips from sleepers
    solvent: [/\b(loud|crash|shatter|smash)/i, /(?<!without )\bleav(es|ing) (a )?shards?\b/i], // silent, and no shards
    card: [/\btells you [^.]*\b(every|each|all)\b/i],                      // one seal
    plan: [],
    quiet: [/\b(hunting|after a keeper)\b[^.]*\b(asleep|sleep|dormant)\b/i],  // hunters drop to awake, never to sleep
    ticket: [],
  };
  // What is wrong with a label of kind k: a truth it lacks, another kind's effect, a false
  // claim, the Night Watchman where the rules do not exempt him, or a Solution read or an
  // Ephemeron drunk or thrown.
  function labelFaults(k, l) {
    const out = [];
    for (const re of TRUTH[k]) if (!re.test(l)) out.push(`lacks ${re}`);
    for (const o of KINDS) if (o !== k) for (const re of EFFECTS[o]) if (re.test(l)) out.push(`says ${o}'s ${re}`);
    for (const re of FALSE[k]) if (re.test(l)) out.push(`says ${re}, which ${k} does not do`);
    if (!['quiet', 'ticket'].includes(k) && /Night Watchman/.test(l)) out.push('names the Night Watchman, whom only "Quiet, Please" and the Ticket exempt');
    if (Registry.CONSUMABLES[k].cls === 'solution' ? /\bread\b/i.test(l) : /\b(drunk|drank|drinks?|thrown|throws?)\b/i.test(l)) out.push('uses the other class\'s verb');
    return out;
  }

  test('a label says what its kind does (§8.6), lends it no other kind\'s effect and nothing §8.6 denies, and the two that exempt the Night Watchman name him', () => {
    for (const p of packs) for (const k of KINDS) assert.equal(json(labelFaults(k, p.consumables.labels[k])), '[]', `${p.acc} ${k}: ${p.consumables.labels[k]}`);
    // Planted faults: another kind's effect, a false claim, a missing truth, a wrong exemption.
    const S9 = Packs.get('S9').consumables.labels, A4 = Packs.get('A4').consumables.labels;
    const plant = (k, l, re) => assert.ok(labelFaults(k, l).some(f => re.test(f)), `${k}: ${json(labelFaults(k, l))}`);
    plant('consolidant', S9.consolidant + ' Thrown, it fixes every animal in place.', /fixative/);
    plant('quiet', A4.quiet.replace('stop, though they stay awake and look about', 'fall asleep too, and look about'), /does not do/);
    plant('solvent', S9.solvent.replace('makes no sound about it', 'shatters with a crash'), /does not do/);
    plant('fumigant', S9.fumigant.replace('sleeps the deeper', 'wakes at once'), /does not do|lacks/);
    plant('card', A4.card.replace('one seal you do not yet know', 'every seal at once'), /lacks|does not do/);
    plant('plan', S9.plan + ' The Night Watchman ignores it.', /Night Watchman/);
    plant('ticket', A4.ticket.replace(', except the Night Watchman, who never loses anyone’s', ''), /lacks/);
    plant('card', A4.card + ' Drunk, it tastes of paper.', /other class/);
  });

  // ---- Species: groups and modifier parameters ----
  test('a species has a group exactly when its trigger is ally_hit, and every group has at least two species', () => {
    for (const p of packs) {
      const groups = {};
      for (const sp of p.species) {
        if (sp.trigger === 'ally_hit') {
          assert.ok(typeof sp.group === 'string' && sp.group.length, `${sp.id}: an ally_hit species names its group`);
          (groups[sp.group] = groups[sp.group] || []).push(sp.id);
        } else assert.ok(!('group' in sp), `${sp.id}: a group with no ally_hit trigger`);
      }
      for (const g of Object.keys(groups)) assert.ok(groups[g].length >= 2, `${p.acc}: the group ${g} has one species`);
      if (p.acc === 'A4') assert.equal(json(groups), json({ clerks: ['A4.1', 'A4.1a'], trustees: ['A4.4', 'A4.4a'] }), 'A.4: the clerks and the trustees');
      else assert.equal(json(groups), '{}', `${p.acc} has no ally_hit species`);
    }
  });

  // The stand-in placement (Dept.create's place/ stream, until M4's population) puts a
  // group's members anywhere in the department, so a member is within ALLY_HIT_RANGE of
  // another of its group only sometimes: over seeds 1–20 and depths 1–7, 52 of the 280
  // same-group pairs, in 52 of the 140 departments, and never both pairs of one department.
  // Department monkeys exercise ally_hit rarely; it needs scenarios of its own (Wave 2).
  test('in an A.4 department, every ally_hit exhibit carries its group and has another of its group in the department, sometimes within ALLY_HIT_RANGE', () => {
    let near = 0;
    for (let depth = 1; depth <= 7; depth++) for (const seed of [1, 2, 3]) {
      const s = Dept.create(seed, 'A4', depth), ex = s.actors.filter(a => a.uid !== 'you' && !a.gone);
      for (const a of ex) {
        const sp = Packs.speciesFor(s, a);
        assert.equal(a.group, sp.group || null, `${a.uid}: group`);
        if (a.trigger === 'ally_hit') assert.ok(ex.some(b => b !== a && b.group === a.group), `seed ${seed} depth ${depth}: ${a.uid} is alone in ${a.group}`);
      }
      assert.ok(ex.some(a => a.group === 'clerks') && ex.some(a => a.group === 'trustees'), `seed ${seed} depth ${depth}: both groups placed`);
      const hear = ex.filter(a => a.trigger === 'ally_hit').some(a => ex.some(b => b !== a && b.group === a.group && Grid.disc(a.x - b.x, a.y - b.y, N.ALLY_HIT_RANGE)));
      if (hear) near++;
    }
    assert.ok(near >= 1 && near < 21, `${near} of 21 departments have a pair of one group within ALLY_HIT_RANGE`);
  });

  test('modifier parameters: old_repair names a compass side, which its Behaviour line and its tombstone both name', () => {
    const SIDES = { N: 'north', E: 'east', S: 'south', W: 'west' };
    let n = 0;
    for (const p of packs) for (const sp of p.species) {
      const params = sp.modParams || {};
      for (const m of Object.keys(params)) assert.ok((sp.modifiers || []).includes(m), `${sp.id}: modParams for ${m}, which it does not have`);
      if (!(sp.modifiers || []).includes('old_repair')) continue;
      n++;
      const side = params.old_repair && params.old_repair.side;
      assert.ok(side in SIDES, `${sp.id}: old_repair's side ${side}`);
      for (const line of linesOf(sp)) assert.ok(line.includes(SIDES[side]), `${sp.id}: the Behaviour line names the ${SIDES[side]} side: ${line}`);
      assert.ok(sp.tomb.medium.includes(SIDES[side]) && /later repair/.test(sp.tomb.medium), `${sp.id}: the tombstone names the repaired side: ${sp.tomb.medium}`);
    }
    assert.equal(n, 1, 'one old_repair species (M.11.3)');
    assert.equal(json(Packs.species('M11', 'M11.3').modParams), json({ old_repair: { side: 'W' } }));
  });

  // A cast "after the marble" names its original, not what it is made of.
  test('a species\' Medium names a material modifier only if it has it (the samples\' tombstone cue)', () => {
    const CUES = [['marble', /marble/i], ['plaster', /plaster/i], ['glass', /glass/i], ['clockwork', /brass|escapement/i]];
    for (const p of packs) for (const sp of p.species) for (const [m, re] of CUES) {
      const has = (sp.modifiers || []).includes(m), medium = sp.tomb.medium.replace(/\bafter the \w+/gi, '');
      if (!has) assert.ok(!re.test(medium), `${sp.id}: "${sp.tomb.medium}" reads as ${m}, which it is not`);
      else assert.ok(re.test(medium), `${sp.id}: ${m} is not on its tombstone: ${sp.tomb.medium}`);
    }
  });

  // ---- The departments still build, and the items work in a room ----
  // Kit.standIn and Consumables.standIn (W1-KIT, W1-CONSUMABLES) place the pack's pieces and
  // name its consumables, so each department must hold at least one of its pack's weapons or
  // garments, one of its curios or instruments and one named consumable, and the checks of
  // what they place are never empty. The room test below puts every pack item in a state.
  test('each department builds at every depth with the packs\' additions, as plain data, its labels have no gaps, and what its stand-ins place comes from its own pack', () => {
    const SEALS = Registry.order('SEALS');
    for (const acc of ACCS) for (let depth = 1; depth <= 7; depth++) {
      const s = Dept.create(depth, acc, depth), pack = Packs.get(acc), placed = { piece: 0, curio: 0, consumable: 0 };
      assert.equal(State.plainData(s), null, `${acc} d${depth}`);
      assert.equal(State.hash(State.clone(s)), State.hash(s), `${acc} d${depth}: clone`);
      for (const a of s.actors) {
        if (a.uid === 'you') continue;
        // A mimic in its disguise is a case, with a case's label, not an exhibit's (§8.3).
        if (C.Archetypes.present(s, a) !== null) { assert.equal(Labels.of(s, a.uid), null, `${acc} d${depth} ${a.uid}`); continue; }
        const l = Labels.of(s, a.uid);
        assert.ok(l && !BAD.test(json(l)), `${acc} d${depth} ${a.uid}: ${json(l)}`);
      }
      for (const it of s.items) {
        if (['weapon', 'garment', 'curio', 'instrument'].includes(it.kind) && it.ref !== null) {
          const rec = pack.items.find(r => r.id === it.ref);
          assert.ok(rec, `${acc} d${depth} ${it.uid}: ${it.ref} is an item of ${acc}`);
          assert.equal(json([it.kind, it.form, it.prims]), json([rec.kind, rec.kind === 'instrument' ? rec.instrument : rec.form, rec.prims]), `${acc} d${depth} ${it.uid}`);
          placed[it.kind === 'weapon' || it.kind === 'garment' ? 'piece' : 'curio']++;
        }
        const nm = it.kind === 'consumable' ? Consumables.name(s, it) : null;
        if (nm && nm.seal) { assert.equal(nm.local, pack.consumables.names[SEALS.indexOf(nm.seal)], `${acc} d${depth} ${it.uid}: the local name of ${nm.seal}`); placed.consumable++; }
      }
      assert.ok(placed.piece >= 1 && placed.curio >= 1 && placed.consumable >= 1, `${acc} d${depth}: the stand-ins placed ${json(placed)}`);
    }
  });

  // Each pack item made as a placed one is (A2's item record, the tier drawn from depth,
  // §8.1), worn in its slot or carried, in a room with an exhibit to strike: the state stays
  // plain data and clone-stable over a monkey, and your derived stats stay whole numbers.
  test('every pack item can be worn or carried at each depth\'s tiers, in a room that is plain data, clone-stable over a monkey, with whole-number stats', () => {
    const SLOT = { weapon: 'weapon', garment: 'garment', curio: 'curio0', instrument: 'instrument' };
    const map = ['#########', '#.......#', '#.......#', '#.......#', '#########'];
    const room = (acc, depth, tier, worn, seed) => {
      const pack = Packs.get(acc);
      const items = pack.items.map((rec, n) => ({
        uid: `${acc}.${depth}.room.i${n + 1}`, kind: rec.kind, ref: rec.id,
        where: rec.id === worn[rec.kind] ? { at: 'kit', slot: SLOT[rec.kind] } : { at: 'tote' },
        form: rec.kind === 'instrument' ? rec.instrument : rec.form || null,
        tier: rec.kind === 'curio' ? null : tier, prims: rec.prims.map(pr => ({ id: pr.id, cls: pr.cls })),
      }));
      return Setup.room(seed, { acc, depth, map, you: [2, 2], items,
        exhibits: [{ sp: 'dummy', at: [6, 2], mode: 'hunting', stats: { hp: 40, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 2 } }] });
    };
    let rooms = 0;
    for (const p of packs) for (const w of p.items.filter(i => i.kind === 'weapon')) for (const depth of [1, 4, 7]) {
      const lo = N.TIER_LOW_BY_DEPTH[depth - 1], hi = Math.min(lo + 1, N.TIER_LOW_BY_DEPTH[6]);
      const worn = { weapon: w.id };
      for (const kind of ['garment', 'curio', 'instrument']) { const first = p.items.find(i => i.kind === kind); if (first) worn[kind] = first.id; }
      for (const tier of lo === hi ? [lo] : [lo, hi]) {
        const s = room(p.acc, depth, tier, worn, depth), you = s.actors[0], where = `${p.acc} d${depth} T${tier} ${w.id}`;
        rooms++;
        assert.equal(State.plainData(s), null, where);
        assert.equal(State.hash(State.clone(s)), State.hash(s), `${where}: clone`);
        assert.equal(you.weaponForm, w.form, `${where}: you strike with ${w.name}`);
        for (const k of ['acc', 'eva', 'pad', 'dmin', 'dmax']) assert.ok(Number.isInteger(you[k]), `${where}: ${k} ${you[k]}`);
        assert.ok(you.dmin >= 0 && you.dmin <= you.dmax, `${where}: damage ${you.dmin}–${you.dmax}`);
        for (const it of s.items.filter(i => i.ref && i.ref !== 'restoration')) {
          const d = Kit.describe(s, it.uid);
          if (d) assert.ok(d.title === p.items.find(r => r.id === it.ref).name && !BAD.test(json(d)), `${where} ${it.uid}: ${json(d)}`);
        }
        const make = seed => room(p.acc, depth, tier, worn, seed);
        assert.equal(Monkey.run(depth, 60, { make, cloneEachStep: true }).hash, Monkey.run(depth, 60, { make }).hash, `${where}: clone after every step`);
      }
    }
    assert.ok(rooms >= 10, `${rooms} rooms`);
  });

  test('an A.4 department with its groups is clone-stable over a monkey, a clone after every step giving the same hash', () => {
    const make = seed => Dept.create(seed, 'A4', 3);
    const plain = Monkey.run(5, 300, { make }), cloned = Monkey.run(5, 300, { make, cloneEachStep: true });
    assert.equal(cloned.hash, plain.hash);
  });
};
