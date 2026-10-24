// M3's pack content (BUILD.md §5.2, §5.3, §5.5, §8.5, §8.6): what the three departments add
// for M3's rules. The items, in the pack item schema, trimmed from design/samples.md §2.6,
// §3.6 and §4.6 so that every primitive is one the slice implements, at the sample's budget;
// the consumables' local names (one per seal) and identifying labels (one per kind); the
// `ally_hit` groups; old_repair's side. And the paragraph lint: a paragraph carries no rule
// (§5.3), so a number next to a rule word (tiles, turns, damage, %, pips, HP, Padding, a
// grade word …) fails, unless the species' own Behaviour line states the same number of the
// same thing. Plain digits stay legal ("Round Book 3", "Logbooks 14 to 22"). The expected
// figures are written out here from the samples and BUILD.md, never read from rule code.
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore(['tools/monkey.js']);
  const { Packs, Registry, Clauses, Dept, State, Labels, Monkey, N } = C;
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
  // two words between ("two tiles", "for three whole turns", "70%"), or a rule word and then
  // its number at once ("Grade IV", "Padding 2"). Rule words fall in classes, so that "two
  // paces" and "2 tiles" state the same thing.
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
  };
  const UNIT = new Map();
  for (const cls of Object.keys(UNITS)) for (const w of UNITS[cls]) UNIT.set(w, cls);
  const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
    'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  const ORDINALS = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
  const TENS = { thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100 };
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  // The number a token names, as a string ('2', '2.4', '1–2', 'half', 'x2'), or null.
  function number(tok) {
    const t = tok.toLowerCase();
    if (/^\d/.test(t)) return t.replace(/(st|nd|rd|th)$/, '').replace(/%$/, '');
    if (NUMBER_WORDS.includes(t)) return String(NUMBER_WORDS.indexOf(t));
    if (ORDINALS.includes(t)) return String(ORDINALS.indexOf(t));
    if (t in TENS) return String(TENS[t]);
    if (t === 'single' || t === 'once') return '1';
    if (t === 'double' || t === 'twice' || t === 'triple' || t === 'thrice') return t === 'double' || t === 'twice' ? 'x2' : 'x3';
    if (t === 'half') return 'half';
    return null;
  }
  function ruleTalk(text) {
    const toks = text.match(/\d+(?:[.,]\d+)?(?:[–-]\d+)?(?:st|nd|rd|th)?%?|[A-Za-z’'-]+|%/g) || [];
    const out = [];
    toks.forEach((tok, i) => {
      const n = number(tok);
      if (n !== null) {
        if (/%$/.test(tok)) { out.push({ n, cls: 'percent', at: tok }); return; }
        for (let j = i + 1; j <= i + 3 && j < toks.length; j++) {
          if (number(toks[j]) !== null) break;
          const cls = UNIT.get(toks[j].toLowerCase());
          if (cls) { out.push({ n, cls, at: toks.slice(i, j + 1).join(' ') }); break; }
        }
      }
      const cls = UNIT.get(tok.toLowerCase());
      const next = toks[i + 1];
      if (cls && next !== undefined) {
        const m = cls === 'grade' && ROMAN.includes(next) ? String(ROMAN.indexOf(next) + 1) : /^\d/.test(next) ? number(next) : null;
        if (m !== null) out.push({ n: m, cls, at: tok + ' ' + next });
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
      ['Blows from behind deal double damage.', 'double damage'], ['It holds four charges.', 'four charges'], ['It goes two paces from the nest.', 'two paces']]) {
      const found = ruleTalk(text);
      assert.ok(found.some(r => r.at === at), `${text}: expected "${at}", found ${json(found)}`);
    }
    for (const text of ['Round Book 3 places the grazer at the north end.', 'Logbooks 14 to 22 are still aboard.', 'H. 2.4 m', 'Each sheet 33 × 21 cm',
      'It was countersigned by four keepers, all of whom were awake.', 'Nine years of signals and not one message.', 'Volume I missing, its spare also missing'])
      assert.equal(json(ruleTalk(text)), '[]', text);
    // "Unless the Behaviour line states the same rule": the Brooder's "two paces from the
    // nest" is its tether, which its line states as "2 tiles"; another line does not.
    const brooder = Packs.species('S9', 'S9.4'), clerk = Packs.species('A4', 'A4.1'), text = 'It has never been more than two paces from the nest.';
    assert.equal(unstated(text, []).length, 1);
    assert.equal(unstated(text, linesOf(brooder)).length, 0, linesOf(brooder)[0]);
    assert.equal(unstated(text, linesOf(clerk)).length, 1, linesOf(clerk)[0]);
  });

  test('no paragraph, label, tombstone or name in the packs states a rule its Behaviour line does not', () => {
    const problems = [];
    for (const p of packs) {
      for (const sp of p.species) {
        const lines = linesOf(sp);
        for (const r of unstated(sp.name, lines)) problems.push(`${sp.id} name: "${r.at}"`);
        for (const r of unstated(sp.paragraph, lines)) problems.push(`${sp.id} paragraph: "${r.at}"`);
        for (const [where, s] of strings(sp.tomb, `${sp.id} tomb`, [])) for (const r of unstated(s, lines)) problems.push(`${where}: "${r.at}"`);
      }
      // Items, labels, the Centrepiece and the card have no Behaviour line of their own.
      const rest = [[`${p.acc} centrepiece`, p.centrepiece], [`${p.acc} items`, p.items], [`${p.acc} consumables`, p.consumables],
        [`${p.acc} blurb`, p.blurb], [`${p.acc} house rule`, p.houseRule]];
      for (const [label, v] of rest) for (const [where, s] of strings(v, label, [])) for (const r of ruleTalk(s)) problems.push(`${where}: "${r.at}"`);
    }
    assert.equal(problems.join('\n'), '', 'rule vocabulary in pack text');
  });

  test('no text in the packs contains "undefined", "NaN" or "[object"', () => {
    for (const p of packs) for (const [where, s] of strings(p, p.acc, [])) assert.ok(!BAD.test(s), `${where}: ${s}`);
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
  // in points (S 1, M 2, L 3; a flag 2, as the samples price `reach`, `sweep` and `breaker`).
  // What is kept, cut, or left for M4 is §5.5's trim rule applied item by item.
  const SAMPLES = {
    S9: { kept: { 'S9.7': 2, 'S9.8': 2, 'S9.9': 2, 'S9.10': 3 }, cut: [], signature: 'S9.11' },
    A4: { kept: { 'A4.6': 3, 'A4.7': 3, 'A4.8': 2, 'A4.10': 3 }, cut: ['A4.9'], signature: 'A4.11' },
    M11: { kept: { 'M11.6': 2, 'M11.7': 2, 'M11.9': 4 }, cut: ['M11.8'], signature: 'M11.10' },
  };
  const POINTS = { S: 1, M: 2, L: 3 }, FLAGS = ['reach', 'quiet', 'breaker'];
  // An item's budget in the slice: its primitives (a flag is 2 whatever its class), a Reach
  // weapon's reach (2), and an instrument's effect (2: the Pin-Driver is the sample's
  // bolt(edge, M); the fork and the pole are priced alike).
  const budget = it => it.prims.reduce((t, pr) => t + (FLAGS.includes(pr.id) ? 2 : POINTS[pr.cls]), 0)
    + (it.kind === 'weapon' && it.form === 'reach' ? 2 : 0) + (it.kind === 'instrument' ? 2 : 0);

  test('the samples\' items are trimmed per §5.5: each kept at its budget, cut only if nothing in the slice matches it, no Signature piece', () => {
    for (const p of packs) {
      const S = SAMPLES[p.acc], ids = p.items.map(it => it.id);
      assert.equal(json(ids), json(Object.keys(S.kept)), `${p.acc}: the kept items, in the sample's order`);
      for (const it of p.items) assert.equal(budget(it), S.kept[it.id], `${it.id}: budget ${budget(it)} against the sample's ${S.kept[it.id]}`);
      for (const id of [...S.cut, S.signature]) assert.ok(!ids.includes(id), `${id} is cut or waits for M4`);
    }
    // The trims, named: what each off-set primitive became.
    const item = id => packs.flatMap(p => p.items).find(it => it.id === id);
    const prims = id => json(item(id).prims.map(pr => pr.id + ':' + pr.cls));
    assert.equal(prims('S9.7'), json(['quiet:M']), 'the Overshoes: muffled becomes quiet');
    assert.equal(prims('S9.8'), json(['dmg:S', 'acc:S']), 'the Tongs: knockback becomes Acc');
    assert.equal(prims('S9.10'), json(['eva:L']), 'Round Book 9: perception becomes Eva');
    assert.equal(item('A4.6').form, 'reach', 'the Date Stamp: sweep becomes Reach');
    assert.equal(prims('A4.8'), json(['pad:S', 'eva:S']), 'the Sleeve Protectors: armour is Padding, resist(fire) becomes Eva');
    assert.equal(prims('A4.10'), json(['acc:L']), 'the Register: attribution and perception become Acc');
    assert.equal(item('M11.6').instrument, 'pin_driver', 'the Hand Lamp: its bolt is the Pin-Driver\'s');
    assert.equal(prims('M11.7'), json(['pad:M']), 'the Apron: armour and resist(light) become Padding');
  });

  test('an item\'s paragraph is at most 70 words and says nothing its sample\'s cut primitive did', () => {
    for (const p of packs) for (const it of p.items) {
      assert.ok(it.paragraph.length && words(it.paragraph) <= 70, `${it.id}: ${words(it.paragraph)} words`);
    }
    // The cut effects are gone from the prose: the Tongs no longer push, the Date Stamp no
    // longer strikes three at once, the Hand Lamp no longer holds two signals, the Sleeve
    // Protectors no longer resist fire, the Pin-Driver no longer holds two pins.
    const para = id => packs.flatMap(p => p.items).find(it => it.id === id).paragraph;
    assert.ok(!/back a pace|push/i.test(para('S9.8')), para('S9.8'));
    assert.ok(!/three at a stroke/i.test(para('A4.6')), para('A4.6'));
    assert.ok(!/two signals/i.test(para('M11.6')), para('M11.6'));
    assert.ok(!/burn/i.test(para('A4.8')), para('A4.8'));
    assert.ok(!/two pins/i.test(para('S9.9')), para('S9.9'));
    assert.ok(!/shows the court/i.test(para('S9.10')), para('S9.10'));
    assert.ok(!/tells a forgery from a spare/i.test(para('A4.10')), para('A4.10'));
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

  // ---- Consumables: local names and identifying labels ----
  const kindName = k => Registry.CONSUMABLES[k].name;
  // The words a local name may not use: any kind's name, or a seal family's (§8.6: wax
  // seals over the Solutions, ink stamps over the Ephemera), so a name never says which
  // kind lies under its seal, which is shuffled every run (D5.3).
  const GIVEAWAY = /consolidant|fixative|fumigant|solvent|catalogue|\bcard\b|\bplan\b|quiet|ticket|re-admission|\bseal|\bwax|\bink\b|stamp/i;

  test('each pack names the 8 seals: 4 Solutions\' then 4 Ephemera\'s, distinct, short, and naming no kind', () => {
    assert.equal(json(Registry.order('SEALS').map(s => Registry.SEALS[s].cls)), json(['solution', 'solution', 'solution', 'solution', 'ephemera', 'ephemera', 'ephemera', 'ephemera']));
    for (const p of packs) {
      assert.equal(json(Object.keys(p.consumables).sort()), json(['labels', 'names']), `${p.acc}: consumables`);
      const names = p.consumables.names;
      assert.ok(Array.isArray(names) && names.length === 8, `${p.acc}: 8 names`);
      assert.equal(new Set(names).size, 8, `${p.acc}: the names differ`);
      for (const n of names) {
        assert.ok(typeof n === 'string' && n.length > 0 && n.length <= 40, `${p.acc}: "${n}" is 1–40 characters, for the tombstone line`);
        assert.ok(!GIVEAWAY.test(n), `${p.acc}: "${n}" names a kind or a seal family`);
      }
    }
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

  test('a label says what its kind does (§8.6) in the museum\'s voice, and the two exempt the Night Watchman where the rules do', () => {
    // A light check that each label carries its kind's truth: the words a reader learns it
    // from. Drunk and thrown for the Solutions; read for the Ephemera.
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
    for (const p of packs) for (const k of KINDS) for (const re of TRUTH[k]) assert.ok(re.test(p.consumables.labels[k]), `${p.acc} ${k}: ${re}`);
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

  test('in an A.4 department, every ally_hit exhibit carries its group and has another of its group to hear', () => {
    for (let depth = 1; depth <= 7; depth++) for (const seed of [1, 2, 3]) {
      const s = Dept.create(seed, 'A4', depth), ex = s.actors.filter(a => a.uid !== 'you' && !a.gone);
      for (const a of ex) {
        const sp = Packs.speciesFor(s, a);
        assert.equal(a.group, sp.group || null, `${a.uid}: group`);
        if (a.trigger === 'ally_hit') assert.ok(ex.some(b => b !== a && b.group === a.group), `seed ${seed} depth ${depth}: ${a.uid} is alone in ${a.group}`);
      }
      assert.ok(ex.some(a => a.group === 'clerks') && ex.some(a => a.group === 'trustees'), `seed ${seed} depth ${depth}: both groups placed`);
    }
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

  // ---- The departments still build ----
  test('each department builds at every depth with the packs\' additions, as plain data, and its labels have no gaps', () => {
    for (const acc of ACCS) for (let depth = 1; depth <= 7; depth++) {
      const s = Dept.create(depth, acc, depth);
      assert.equal(State.plainData(s), null, `${acc} d${depth}`);
      assert.equal(State.hash(State.clone(s)), State.hash(s), `${acc} d${depth}: clone`);
      for (const a of s.actors) {
        if (a.uid === 'you') continue;
        const l = Labels.of(s, a.uid);
        assert.ok(l && !BAD.test(json(l)), `${acc} d${depth} ${a.uid}: ${json(l)}`);
      }
    }
  });

  test('an A.4 department with its groups is clone-stable over a monkey, a clone after every step giving the same hash', () => {
    const make = seed => Dept.create(seed, 'A4', 3);
    const plain = Monkey.run(5, 300, { make }), cloned = Monkey.run(5, 300, { make, cloneEachStep: true });
    assert.equal(cloned.hash, plain.hash);
  });
};
