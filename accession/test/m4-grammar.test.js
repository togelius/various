// M4's grammar and words (M4 plan W0a, A5; BUILD.md §3.4, §4.3, §5.1, §8.7):
//   - the M4 placeholders left the frozen system fragments for their owners' fragments, word
//     for word, and not_built is gone;
//   - Registry.PERKS holds §8.7's eight perks, and Perks.add takes no other id;
//   - Text.count ("1 turn", never "1 turns") and Text.grade (Roman, as the badge prints it);
//   - every M4 event kind and (kind, cause) pair of A5 has a schema and a sentence, and every
//     M4 sentence is plain: no "1 turns", no raw id, no arabic grade, the past tense in a
//     waking, the chime never "the bell";
//   - the log's grouping (Text.defineGroup) and a module event about an exhibit out of view;
//   - each new lint-registry rule fails on a planted fault: --strict over M4, a digit outside
//     {}, the phrase-to-row lint, every refusal reached in a refusals file, a flag its
//     department does not hold, the Intro rule (WO6), and --report's department report.
'use strict';
module.exports = ({ test, assert, loadCore, root, fs, path }) => {
  const { spawnSync } = require('node:child_process'), os = require('node:os');
  const C = loadCore();
  const { Registry: R, Text, N } = C;
  const json = x => JSON.stringify(x);
  const src = f => fs.readFileSync(path.join(root, f), 'utf8');
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const clean = s => typeof s === 'string' && s.length > 0 && !/undefined|NaN|\[object|null/.test(s);

  // ---- The move ----

  // Each M4 placeholder reg/system.js held, the fragment it moved to, and M2's words for it.
  const MOVED = [
    ['ARCHETYPES', 'unobserved_mover', 'mod-unobserved', 'Moves two tiles a turn, but only while you cannot see it; strikes hard from beside you.'],
    ['ARCHETYPES', 'patrol_guard', 'mod-alarm', 'Walks a fixed round. On seeing you it raises the alarm for one turn, then gives chase; after 20 turns without you it goes back to its round.'],
    ['ARCHETYPES', 'demonstrator', 'mod-chime', 'Keeps to its track and never chases. On the chime it performs the demonstration on its label.'],
    ['ARCHETYPES', 'conservator_healer', 'arch-d', 'Stays behind its allies and spends a turn, shown, restoring one; backs away when you come close.'],
    ['ARCHETYPES', 'completing_guardian', 'cp-guardian', 'Grows one limb for every two galleries you have walked, up to four; each limb is a special. Leaving its room heals it and drops one limb.'],
    ['ARCHETYPES', 'mp_ensemble', 'cp-ensemble', 'Several pieces share one health pool. When a piece falls, the others take on its special.'],
    ['ARCHETYPES', 'mp_tableau', 'cp-tableau', 'Stays in its frame and alternates shown lines and bursts; takes double damage while it summons.'],
    // MOD-CHIME left out M2's "; rain stops it for 2 turns": once the station's archetype was
    // built, its line's clauses met the word rules (a bare digit), and the rain rule is M.11's
    // weather flag's (M4 plan D1.3).
    ['MODIFIERS', 'clockwork', 'arch-d', 'Shows its next move as an arrow and cannot be dazed.'],
    ['TRIGGERS', 'period', 'mod-chime', 'wakes on the chime to perform, then sleeps again'],
    ['MODULES', 'unobserved_motion', 'mod-unobserved', 'The animals move only when you cannot see them.'],
    // Reworded by MOD-ALARM's review: M2's "then the whole court is awake" claimed more than the
    // call does, since the Centrepiece and a mimic sleep on.
    ['MODULES', 'alarm_network', 'mod-alarm', 'The waders raise the alarm when they see you; then every sleeping exhibit in the department that can hear, but the Centrepiece, wakes.'],
    // Reworded by MOD-COPIES: the sentence teaches the rule whole, as a template over its params.
    ['MODULES', 'copies_weaken', 'mod-copies', 'When an original is destroyed, its spares lose heart: each, and any body split from one, loses {COPY_WEAKEN_PCT}% of its health and damage and {COPY_WEAKEN_ACC} Acc, and is slowed until you leave.'],
    // Reworded by MOD-CHIME: M2's "the stations exchange signals down the length of the gallery"
    // said neither that a line is marked first nor that it strikes.
    ['MODULES', 'hourly_demonstration', 'mod-chime', 'On the chime, every station marks its line across its room, and two turns later the line strikes everything on it.'],
    ['MODULES', 'weather_cases', 'mod-weather', 'Some cases hold weather. Break one, and the weather gets out.'],
    ['WAKE_CAUSES', 'period', 'mod-chime', null],
    ['WAKE_CAUSES', 'alarm', 'mod-alarm', null],
    ['WAKE_CAUSES', 'patrol', 'mod-alarm', null],
  ];
  const EVENTS_MOVED = [['alarm', 'mod-alarm'], ['certificate', 'progress'], ['grade', 'progress'], ['perk', 'perks'], ['viewed', 'viewing'], ['phase', 'centrepiece']];

  test('the M4 placeholders left reg/system.js and text/system.js for their owners\' fragments, word for word, and not_built is gone', () => {
    const sys = src('js/core/reg/system.js'), say = src('js/core/text/system.js');
    assert.doesNotMatch(sys, /R\.define\('(ARCHETYPES|MODIFIERS|TRIGGERS|MODULES|WAKE_CAUSES|PERKS)'/, 'reg/system.js defines no M4 entry');
    assert.doesNotMatch(sys, /'not_built'/); assert.doesNotMatch(say, /not_built|Text\.defineCause/);
    assert.ok(!own(R.REFUSALS, 'not_built') && !Text.refusalDefined('not_built'));
    for (const [t, id, frag, words] of MOVED) {
      const e = R[t][id], file = `js/core/reg/${frag}.js`, text = src(file);
      assert.ok(e && e.built === 'M4', `${t}.${id} is an M4 entry`);
      assert.ok(text.includes(`R.define('${t}', '${id}'`), `${t}.${id} is defined in ${file}`);
      // While its owner's fragment still marks it a placeholder, it says what M2 said.
      if (words !== null && /Placeholders?: M2's clauses?/.test(text) && t !== 'MODULES') assert.equal(e.clause, words, `${t}.${id}`);
      if (t === 'MODULES') assert.equal(e.sentence, words, `${t}.${id}'s panel sentence`);
    }
    assert.equal(R.TRIGGERS.period.icon, 'period');
    for (const [k, frag] of EVENTS_MOVED) {
      assert.ok(src(`js/core/reg/${frag}.js`).includes(`R.defineEvent('${k}'`), `${k} is defined in reg/${frag}.js`);
      assert.ok(!sys.includes(`'${k}'`), `${k} is not in reg/system.js`);
      assert.ok(src(`js/core/text/${frag}.js`).includes(`Text.define('${k}'`), `${k}'s sentence is in text/${frag}.js`);
    }
    // The module event, every module's, is the system's.
    assert.ok(sys.includes("R.defineEvent('module'") && say.includes("Text.define('module'"));
    // The wake causes keep M3's schema for a waking (m3-backbone-ai wakes a station with {k: 'period'}).
    for (const k of ['period', 'alarm', 'patrol']) for (const kind of ['woke', 'hunting']) {
      assert.equal(json(R.CAUSES[kind][k].fields), json({ by: 'uid?', dist: 'int?', x: 'int?', y: 'int?', from: 'tile?', how: 'str?' }), `${kind}.${k}`);
      assert.equal(R.CAUSES[kind][k].built, 'M4');
    }
  });

  // ---- The perks' table ----

  const PERKS = [['soft_soles', 'Soft Soles', 'guarded'], ['vanishing_act', 'Vanishing Act', 'guarded'], ['light_fingers', 'Light Fingers', 'guarded'],
    ['single_file', 'Single File', 'swarm'], ['elbow_room', 'Elbow Room', 'swarm'], ['second_wind', 'Second Wind', 'attrition'],
    ['duck_and_cover', 'Duck and Cover', 'artillery'], ['close_the_distance', 'Close the Distance', 'artillery']];

  test('Registry.PERKS holds §8.7\'s eight perks, by name and family, and Perks.add takes no other id', () => {
    assert.ok(R.TABLES.includes('PERKS'));
    assert.equal(json(R.order('PERKS').map(id => [id, R.PERKS[id].name, R.PERKS[id].family])), json(PERKS));
    for (const id of R.order('PERKS')) assert.equal(R.PERKS[id].built, 'M4', id);
    // §8.7's table: every family a pack claims that has perks has them here.
    for (const f of ['guarded', 'swarm', 'artillery', 'attrition']) assert.ok(PERKS.some(p => p[2] === f), f);
    const X = loadCore();
    assert.throws(() => X.Perks.add('planted_perk', {}), /planted_perk is not in Registry\.PERKS/);
    X.Registry.define('PERKS', 'planted_perk', { built: 'M4', name: 'Planted', family: 'guarded' });
    X.Perks.add('planted_perk', {});
    assert.throws(() => X.Perks.add('planted_perk', {}), /twice/);
  });

  // ---- Text.count and Text.grade ----

  test('Text.count says "1 turn" and "3 turns", never "1 turns"; Text.grade gives the badge\'s Roman grade', () => {
    assert.equal(Text.count(1, 'turn'), '1 turn'); assert.equal(Text.count(0, 'turn'), '0 turns'); assert.equal(Text.count(3, 'turn'), '3 turns');
    assert.equal(Text.count(2, 'body'), '2 bodies'); assert.equal(Text.count(2, 'gallery'), '2 galleries'); assert.equal(Text.count(2, 'day'), '2 days');
    assert.equal(Text.count(4, 'bash'), '4 bashes'); assert.equal(Text.count(2, 'half', 'halves'), '2 halves'); assert.equal(Text.count(1, 'half', 'halves'), '1 half');
    assert.throws(() => Text.count(1.5, 'turn'), /whole number/); assert.throws(() => Text.count(undefined, 'turn'), /whole number/); assert.throws(() => Text.count(2, ''), /noun/);
    assert.equal(json([1, 2, 3, 4, 5, 6, 7].map(Text.grade)), json(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']));
    assert.equal(Text.grade(9), 'IX'); assert.equal(Text.grade(14), 'XIV'); assert.equal(Text.grade(40), 'XL'); assert.equal(Text.grade(1999), 'MCMXCIX');
    for (const bad of [0, -1, 2.5, '3', null, undefined, 4000]) assert.throws(() => Text.grade(bad), /not a grade/, json(bad));
    // The grade's sentence is the badge's (§8.7: "Handling Clearance, Grade IV"), and a
    // Certificate's raise says the maximum health it adds (§8.7: each part in the log).
    for (let g = 1; g <= N.GRADE_MAX; g++) {
      const s = Text.event({ k: 'grade', turn: 1, grade: g, cause: { k: 'certificate' } });
      assert.equal(s, `Your Handling Clearance is now Grade ${Text.grade(g)}, and your maximum health is ${N.HP_PER_GRADE} higher.`);
      assert.doesNotMatch(s, /Grade \d/, s);
      assert.equal(Text.event({ k: 'grade', turn: 1, grade: g }), `Your Handling Clearance is now Grade ${Text.grade(g)}.`);
    }
  });

  // ---- Every M4 kind and cause pair, and its sentence ----

  // M4 plan A5: each kind M4 adds (with its fields) or adds causes to, and those causes. A
  // module's events take their module's id as their cause.
  // (copies_weaken's split: MOD-COPIES' second rule, a body split from a spare that lost heart.)
  const MODULE_RULES = { unobserved_motion: ['stride'], alarm_network: ['alarm_shown', 'call', 'alarm_over'], copies_weaken: ['weaken', 'split'],
    hourly_demonstration: ['chime', 'line', 'blocked', 'settle'], weather_cases: ['release', 'rain_stop'] };
  const A5 = {
    certificate: { fields: ['acc', 'how'], causes: ['defeat', 'view', 'treasure'] },
    grade: { fields: ['grade'], causes: ['certificate'] },
    perk: { fields: ['id', 'rank'], causes: ['chosen', 'none', 'duck', 'sure', 'close', 'single_file', 'wind'] },
    viewed: { fields: ['who', 'of', 'n'], causes: ['view'] },
    module: { fields: ['id', 'rule', 'who', 'at', 'n', 'turns'], causes: Object.keys(MODULE_RULES) },
    alarm: { fields: ['by', 'until'], causes: ['alarm_network'] },
    phase: { fields: ['who', 'phase', 'stage', 'gained'], causes: ['damaged', 'walked', 'left', 'inherited'] },
    healed: { causes: ['certificate', 'second_wind'] },
    damaged: { causes: ['perk'] },
    status: { causes: ['perk'] },
    lost: { causes: ['vanished'] },
    stage: { causes: ['hall'] },
    woke: { causes: ['period', 'alarm', 'patrol', 'summoned'] },
    hunting: { causes: ['period', 'alarm', 'patrol', 'summoned'] },
    dropped: { causes: ['defeated'] },
    surface: { causes: ['weather'] },
  };

  test('every M4 event kind and (kind, cause) pair of A5 has a schema and a sentence, phase among §4.3\'s kinds', () => {
    let pairs = 0;
    for (const [k, a] of Object.entries(A5)) {
      assert.ok(R.EVENTS[k], `${k} is a kind`); assert.ok(Text.defined(k), `${k} has a sentence`);
      if (a.fields) {
        assert.equal(R.EVENTS[k].built, 'M4', k);
        assert.equal(json(R.EVENTS[k].list.map(f => f.name)), json(a.fields), `${k}'s fields`);
      }
      for (const c of a.causes) {
        assert.ok(R.CAUSES[k] && R.CAUSES[k][c], `${k}.${c} has a schema`);
        assert.ok(Text.defined(k, c), `${k}.${c} has a sentence`);
        pairs++;
      }
    }
    assert.equal(pairs, 38);
    // Every M4 kind and cause any fragment defines has its sentence too.
    for (const k of R.EVENT_KINDS) for (const c of Object.keys(R.CAUSES[k] || {})) if (R.CAUSES[k][c].built === 'M4') assert.ok(Text.defined(k, c), `${k}.${c}`);
    assert.ok(R.EVENT_KINDS.includes('phase'));
    const b43 = src('BUILD.md'), s43 = b43.slice(b43.indexOf('### 4.3 Events'), b43.indexOf('### 4.4'));
    assert.match(s43, /- \*\*Centrepieces:\*\* `phase`\./);
  });

  // Synthetic events with real ids, so a raw id would show: each str field a perk's, a
  // module's, a department's or a special's id where the kind names one, every whole number n.
  const NAMES = uid => uid === 'x.1' ? 'the Lantern-Crop Wader' : uid === 'x.2' ? 'the Long-Necked Grazer' : null;
  const SPECIALS = R.order('SPECIALS').concat(['planted_special']);
  function variants(k, c, n) {
    const fill = (list, o, opt) => {
      for (const f of list) if (!f.optional || opt) o[f.name] = { uid: 'x.1', uids: ['x.1', 'x.2'], int: n, str: 'planted', bool: true, tile: [1, 2], tiles: [[1, 2]], obj: { kind: 'melee' } }[f.type];
      return o;
    };
    const out = [];
    for (const opt of [false, true]) {
      const e = fill(R.EVENTS[k].list, { k, turn: 3, tick: 300 }, opt);
      if (e.until !== undefined) e.until = e.turn + n;
      e.cause = c ? fill(R.CAUSES[k][c].list, { k: c }, opt) : { k: 'no_such_cause' };
      const strs = { module: { id: c && own(MODULE_RULES, c) ? [c] : Object.keys(MODULE_RULES) }, perk: { id: R.order('PERKS').concat(['planted_perk']) },
        certificate: { acc: ['S9', 'A4', 'M11'], how: ['defeat', 'view', 'treasure'] }, phase: { gained: SPECIALS }, surface: { kind: ['fog', 'rain', 'dust', 'planted'] },
        stage: { stage: ['sealed', 'unsealed', 'waiting', 'planted'] }, status: { id: R.order('STATUSES').concat(['planted_status']) } }[k] || {};
      const each = [e];
      for (const [f, vals] of Object.entries(strs)) if (e[f] !== undefined || opt) for (const v of vals) each.push(Object.assign(JSON.parse(json(e)), { [f]: v }));
      for (const x of each) {
        if (k === 'module') for (const rule of (MODULE_RULES[x.id] || []).concat(['planted_rule'])) out.push(Object.assign(JSON.parse(json(x)), { rule }));
        else out.push(x);
        if (x.cause && x.cause.why !== undefined) for (const why of ['quiet', 'ticket', 'defeat', 'treasure', 'planted']) out.push(Object.assign(JSON.parse(json(x)), { cause: Object.assign({}, x.cause, { why }) }));
      }
    }
    return out;
  }
  const M4_PAIRS = [];
  for (const k of R.EVENT_KINDS) for (const c of [null, ...Object.keys(R.CAUSES[k] || {})]) {
    if (c === null ? R.EVENTS[k].built === 'M4' : R.CAUSES[k][c].built === 'M4') M4_PAIRS.push([k, c]);
  }
  const ONE = /\b1 (turns|tiles|ticks|pips|views|exhibits|sleeping exhibits|stations|spares|limbs|galleries|bodies|pieces|charges|others|steps|actions)\b/;
  const RAW = /\b[a-z]+_[a-z0-9_]+\b|\b(S9|A4|M11)\b/;
  // A module event about an exhibit that names none (no who) has no sentence, so the log, which
  // tells an event about no exhibit whatever is in view, never gives away a rule acting out of
  // view (a Grazer's stride), and a joined-up scenario's sentence check fails on it: every rule
  // of unobserved_motion, and these rules of the others (by the cause, which picks the sentence).
  const ABOUT = { alarm_network: ['alarm_shown', 'call'], copies_weaken: ['weaken', 'split'], hourly_demonstration: ['line', 'blocked', 'settle'], weather_cases: ['rain_stop'] };
  const unsaid = e => e.k === 'module' && e.who === undefined && !!e.cause
    && (e.cause.k === 'unobserved_motion' || (own(ABOUT, e.cause.k) && ABOUT[e.cause.k].includes(e.rule)));

  test('every M4 sentence is plain: a sentence, no "1 turns", no raw id, no arabic grade, whatever the counts and ids', () => {
    const bad = [];
    let n = 0;
    for (const [k, c] of M4_PAIRS) for (const count of [1, 2, 7]) for (const e of variants(k, c, count)) for (const names of [NAMES, null]) for (const who of ['x.1', 'you']) {
      const ev = JSON.parse(json(e));
      for (const f of ['who', 'by']) if (ev[f] === 'x.1') ev[f] = who;
      const s = Text.event(ev, names), at = `${k}${c ? '.' + c : ''} ${json(ev)}: ${json(s)}`;
      n++;
      if (unsaid(ev)) { if (s !== null || Text.log([ev], names).length) bad.push('a module event about no exhibit is told: ' + at); continue; }
      if (!clean(s) || !/^[A-Z“]/.test(s) || !/[.)]$/.test(s)) bad.push('not a clean sentence: ' + at);
      else if (ONE.test(s)) bad.push('"1 …s": ' + at);
      else if (RAW.test(s)) bad.push('a raw id: ' + at);
      else if (k === 'grade' && /Grade \d|\d+ Grade|grade \d/i.test(s)) bad.push('an arabic grade: ' + at);
    }
    assert.deepEqual(bad.slice(0, 10), []);
    assert.ok(n > 3000, `${n} sentences`);
    // And no kind's sentence, M3's or M4's, says "1 turns" for a count of one.
    for (const k of R.EVENT_KINDS) for (const c of [null, ...Object.keys(R.CAUSES[k] || {})]) for (const e of variants(k, c, 1)) {
      const s = Text.event(e, NAMES);
      assert.ok(!ONE.test(s || ''), `${k}${c ? '.' + c : ''}: ${s}`);
    }
  });

  test('the M4 wakings are told in the past, as M3\'s are, so the recap reads; the chime is never "the bell"', () => {
    for (const k of ['woke', 'hunting']) for (const c of ['period', 'alarm', 'patrol']) for (const was of [null, 'dormant', 'awake']) for (const mode of ['hunting', 'awake']) {
      const s = Text.event({ k, turn: 3, who: 'x.1', was, mode, cause: { k: c } }, NAMES);
      assert.doesNotMatch(s, / is hunting you| goes to look| is awake\b| is on its rounds| splits in two/, `${k}.${c}: ${s}`);
      assert.match(s, /^The Lantern-Crop Wader (woke|began|was already)/, s);
    }
    // A chime's words (§5.4): "The module's sound is a chime, never 'the bell', which is the clock's."
    const chime = [];
    for (const [k, c] of M4_PAIRS) if (c === 'period' || c === 'hourly_demonstration') for (const e of variants(k, c, 2)) if (!unsaid(e)) chime.push(Text.event(e, NAMES));
    chime.push(Text.log([1, 2, 3].map(i => ({ k: 'woke', turn: 3, who: 'x.' + i, was: 'dormant', mode: 'awake', cause: { k: 'period' } })), NAMES)[0]);
    assert.ok(chime.length >= 12, `${chime.length} sentences`);
    for (const s of chime) { assert.doesNotMatch(s, /\bbell\b/i, s); assert.ok(clean(s), s); }
  });

  test('a sentence that states a number of record says "1 turn" when its row is 1, and the Signature piece\'s drop says where it lies: where the Centrepiece first stood, never where its last piece fell', () => {
    // Every M4 sentence that states a row's count, with that row at 1 (a planted copy of the core).
    const X = loadCore(null, { numbers: { SEAL_LIFT_TURNS: 1, VIEW_TURNS: 1, PERK_SECOND_WIND_TURNS: 1, PERK_DUCK_AND_COVER: 1 } });
    const said = [];
    for (const [k, c] of M4_PAIRS) for (const e of variants(k, c, 1)) { const s = X.Text.event(e, NAMES); if (typeof s === 'string') said.push(s); }
    const lift = X.Text.event({ k: 'stage', turn: 3, stage: 'unsealed', cause: { k: 'hall', why: 'quiet' } }, NAMES);
    assert.equal(lift, 'The shutters opened: the Centrepiece has neither hurt you nor ended a turn beside you for 1 turn. They do not close again until you have stepped out of the hall.');
    for (const s of said) assert.doesNotMatch(s, ONE, s);
    assert.ok(said.some(s => /1 of 1 turn\./.test(s)) && said.some(s => /over 1 turn\./.test(s)) && said.some(s => /costs 1 tick less/.test(s)));
    // The piece drops on the Centrepiece's anchor tile (§8.7), where it first stood, not where an
    // ensemble's last piece fell: the sentence says so (ARCH-CP-CORE's review).
    const drop = Text.event({ k: 'dropped', turn: 3, who: 'x.1', item: 'i.1', x: 4, y: 4, cause: { k: 'defeated', by: 'you' } }, NAMES);
    assert.equal(drop, 'The Lantern-Crop Wader fell, and the Centrepiece’s Signature piece dropped to the floor where the Centrepiece first stood.');
  });

  // ---- The log ----

  test('the log tells a step\'s events of one reason in one line (an alarm\'s wakes, a chime\'s stations, an original\'s spares), and a module event about an exhibit out of view not at all', () => {
    const woke = (uid, k) => ({ k: 'woke', turn: 3, who: uid, was: 'dormant', mode: 'awake', cause: { k } });
    const pip = { k: 'pip', turn: 3, who: 'x.1', pips: 1, delta: 1, cause: { k: 'ring', dist: 2, r: 3 } };
    const lines = Text.log([pip, woke('x.1', 'alarm'), woke('x.2', 'alarm'), { k: 'alarm', turn: 3, by: 'x.1', until: 33, cause: { k: 'alarm_network' } }, woke('x.3', 'alarm')], NAMES);
    assert.equal(json(lines), json([Text.event(pip, NAMES), 'The alarm woke 3 exhibits, and they set off to look where you were.',
      'The Lantern-Crop Wader raised the alarm: for 30 turns, sleeping exhibits keep their pips, no exhibit goes back to its place for being left undisturbed or done searching, and no other alarm can be raised.']));
    // One alone is told by its own sentence.
    assert.equal(json(Text.log([woke('x.1', 'alarm')], NAMES)), json([Text.event(woke('x.1', 'alarm'), NAMES)]));
    assert.equal(Text.log([woke('x.1', 'period'), woke('x.2', 'period')], NAMES)[0], '2 stations woke for the chime.');
    // An original's spares (cause.by, the original) in one line; two originals' in two; with no
    // original named, a line true of any number of them; another rule of the module alone.
    const weaken = (uid, by) => ({ k: 'module', turn: 3, id: 'copies_weaken', rule: 'weaken', who: uid, cause: by ? { k: 'copies_weaken', by } : { k: 'copies_weaken' } });
    assert.equal(json(Text.log([weaken('x.1', 'o.1'), weaken('x.2', 'o.1')], NAMES)), json(['An original was destroyed, and 2 of its spares lost heart.']));
    assert.equal(json(Text.log([weaken('x.1', 'o.1'), weaken('x.2', 'o.2'), weaken('x.3', 'o.1'), weaken('x.4', 'o.2')], NAMES)),
      json(['An original was destroyed, and 2 of its spares lost heart.', 'An original was destroyed, and 2 of its spares lost heart.']));
    assert.equal(json(Text.log([weaken('x.1'), weaken('x.2')], NAMES)), json(['2 spares lost heart, each because its original was destroyed.']));
    const other = { k: 'module', turn: 3, id: 'copies_weaken', rule: 'planted_rule', who: 'x.2', cause: { k: 'copies_weaken', by: 'o.1' } };
    assert.equal(Text.log([weaken('x.1', 'o.1'), other], NAMES).length, 2);
    // One made awake (no was) did not wake: it is not counted among the alarm's or the chime's.
    for (const c of ['alarm', 'period']) {
      const made = Object.assign(woke('x.3', c), { was: null });
      assert.equal(json(Text.log([woke('x.1', c), made, woke('x.2', c)], NAMES).map(l => / was already awake[: ]/.test(l) ? 'alone' : l.replace(/\d/, 'N'))),
        json([c === 'alarm' ? 'The alarm woke N exhibits, and they set off to look where you were.' : 'N stations woke for the chime.', 'alone']), c);
    }
    // A module event about an exhibit out of view is not told (an unobserved mover's stride
    // gives nothing away); one about no exhibit is (the chime).
    const stride = { k: 'module', turn: 3, id: 'unobserved_motion', rule: 'stride', who: 'x.2', n: 2, cause: { k: 'unobserved_motion' } };
    const chime = { k: 'module', turn: 3, id: 'hourly_demonstration', rule: 'chime', turns: 2, cause: { k: 'hourly_demonstration' } };
    const seen = uid => uid === 'x.1';
    assert.equal(json(Text.log([stride, chime], NAMES, seen)), json(['The chime sounded: any line marked at it strikes in 2 turns.']));
    assert.equal(json(Text.log([stride], NAMES, uid => uid === 'x.2')), json(['The Long-Necked Grazer moved 2 tiles while you could not see it.']));
    // A stride that names no mover is never told, in view or not: it could be one you did not see.
    const anon = Object.assign({}, stride); delete anon.who;
    for (const vis of [undefined, () => true, () => false]) assert.equal(json(Text.log([anon, chime], NAMES, vis)), json(['The chime sounded: any line marked at it strikes in 2 turns.']));
    // Of the spares, only those in view are counted.
    assert.equal(json(Text.log([weaken('x.1', 'o.1'), weaken('x.2', 'o.1'), weaken('x.3', 'o.1')], NAMES, uid => uid !== 'x.3')), json(['An original was destroyed, and 2 of its spares lost heart.']));
    // A fresh context: a group by key, in place of the first; twice and a non-function throw.
    const F = loadCore();
    F.Text.define('zz', (e, w) => `${w.Name(e.who)} did zz.`);
    F.Text.defineCause('zz', 'a', (e, w) => `${w.Name(e.who)} did zz for ${e.cause.by}.`);
    F.Text.defineGroup('zz', 'a', evs => `${evs.length} did zz for ${evs[0].cause.by}: ${evs.map(e => e.who).join(', ')}.`, e => e.cause.by);
    const zz = (who, by) => ({ k: 'zz', turn: 1, who, cause: { k: 'a', by } });
    assert.equal(json(F.Text.log([zz('you', 'p'), { k: 'zz', turn: 1, who: 'you' }, zz('x.1', 'q'), zz('x.2', 'p'), zz('x.3', 'q')])),
      json(['2 did zz for p: you, x.2.', 'You did zz.', '2 did zz for q: x.1, x.3.']));
    assert.ok(F.Text.grouped('zz', 'a') && !F.Text.grouped('zz', 'b'));
    assert.throws(() => F.Text.defineGroup('zz', 'a', () => ''), /twice/);
    assert.throws(() => F.Text.defineGroup('zz', 'b', 'x'), /function/);
    assert.throws(() => F.Text.defineGroup('zz', 'c', () => '', 'x'), /function/);
    // The groups M4's Wave 0 defined.
    for (const [k, c] of [['woke', 'alarm'], ['woke', 'period'], ['module', 'copies_weaken']]) assert.ok(Text.grouped(k, c), `${k}.${c}`);
  });

  // ---- lint-registry's new rules, each against a planted fault ----

  // A test given a temporary folder of its own, tmp: made as it starts, and removed in a
  // finally block as it ends, whether it passed or failed.
  let tmp = null;
  const tmpTest = (name, fn) => test(name, () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'accession-m4-grammar-'));
    try { fn(); } finally { fs.rmSync(tmp, { recursive: true, force: true }); tmp = null; }
  });
  let planted = 0;
  const lint = (lines, extra) => {
    const args = [path.join(root, 'tools/lint-registry.js'), ...(extra || [])];
    if (lines) { const f = path.join(tmp, `planted-${planted++}.js`); fs.writeFileSync(f, "'use strict';\n" + [].concat(lines).join('\n') + '\n'); args.push('--load', f); }
    const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
    return { status: r.status, out: r.stdout + r.stderr };
  };
  const has = (r, re) => assert.match(r.out, re);
  const hasNot = (r, re) => assert.doesNotMatch(r.out, re);

  tmpTest('lint-registry --strict covers M3 and M4; --strict=M3 is M3\'s acceptance, as before', () => {
    {
      let r = lint(null);
      assert.equal(r.status, 0, r.out); has(r, /M3 entries at ready false \d+, 'unit' \d+, true \d+; M4 entries at ready false \d+, 'unit' \d+, true \d+/);
      r = lint(null, ['--strict=M3']);
      assert.equal(r.status, 0, r.out); has(r, /strict \(M3\)/);
      for (const which of [['--strict'], ['--strict=M4']]) {
        r = lint(null, which);
        assert.equal(r.status, 1, which[0]);
        has(r, /--strict: ARCHETYPES\.completing_guardian is at ready false/); has(r, /--strict: PERKS\.soft_soles is at ready false/);
        // Under --strict every M4 entry meets the word rules: the placeholders do not yet.
        has(r, /ARCHETYPES\.completing_guardian: "one limb" states a number in words/); has(r, /ARCHETYPES\.mp_tableau: "double damage" states a number in words/);
      }
      r = lint(null, ['--strict=M9']);
      assert.equal(r.status, 1); has(r, /--strict=M9: no such milestone/);
      // A follow-up may hold an M4 entry under --strict, not under --strict=M3.
      const ff = path.join(tmp, 'follow.json');
      fs.writeFileSync(ff, json({ 'PERKS.soft_soles': 'planted: PG-PERKS-A builds it' }));
      r = lint(null, ['--strict', '--follow-ups', '--follow-file', ff]);
      assert.equal(r.status, 1); has(r, /OPEN FOLLOW-UP PERKS\.soft_soles/); hasNot(r, /--strict: PERKS\.soft_soles/);
      r = lint(null, ['--strict=M3', '--follow-ups', '--follow-file', ff]);
      assert.equal(r.status, 1); has(r, /follow-ups: PERKS\.soft_soles is not an M3 entry/);
    }
  });

  tmpTest('lint-registry\'s word rules: a digit outside {} in an M4 template, and a phrase that states a number untied to its row, fail past ready false', () => {
    const m4 = (id, ready, clause, more) => `Registry.define('MODIFIERS', '${id}', Object.assign({ built: 'M4', ready: ${json(ready)}, clause: ${json(clause)}, params: {}, covers: [], tests: ['m4-grammar.test.js'], inv: 'system' }, ${json(more || {})}));`;
    let r = lint([
      m4('planted_digit', 'unit', 'Stops for 2 turns.'),
      m4('planted_hole', 'unit', 'Stops for {n} turns.', { params: { n: 'N:RAIN_STOP_TURNS' } }),
      m4('planted_waiting', false, 'Stops for 2 turns, at half speed.'),
      m4('planted_untied', 'unit', 'Moves two tiles a turn.'),
      m4('planted_tied', 'unit', 'Moves two tiles a turn.', { phrases: { 'two tiles a turn': 'N:UNOBSERVED_STEP' } }),
      m4('planted_pct', 'unit', 'Moves at half speed.', { phrases: { 'half speed': 'N:SPEED_SLOW_PCT' } }),
      m4('planted_wrong', 'unit', 'Moves two tiles a turn.', { phrases: { 'two tiles a turn': 'N:SPEED_SLOW_PCT' } }),
      m4('planted_stale', 'unit', 'Moves slowly.', { phrases: { 'half speed': 'N:SPEED_SLOW_PCT' } }),
      m4('planted_unknown', 'unit', 'Moves thrice.', { phrases: { thrice: 'N:UNOBSERVED_STEP' } }),
      m4('planted_nonumber', 'unit', 'Moves a little.', { phrases: { 'a little': 'N:UNOBSERVED_STEP' } }),
      // A number in words is a number, as a digit is: "twenty turns" is "20 turns".
      m4('planted_words', 'unit', 'Stops for twenty turns, then twice, then for twenty-five.'),
      m4('planted_one', 'unit', 'Drops one limb, restoring one; one-turn stops.'),
      m4('planted_words_tied', 'unit', 'Grows a limb for every two galleries you have walked, up to four.', { phrases: { 'two galleries': 'N:GUARDIAN_PER_STAGE', 'up to four': 'N:GUARDIAN_STAGE_MAX' } }),
      m4('planted_words_wrong', 'unit', 'Grows a limb for every two galleries you have walked.', { phrases: { 'two galleries': 'N:GUARDIAN_STAGE_MAX' } }),
      m4('planted_words_pct', 'unit', 'Heals four.', { phrases: { four: 'N:GUARDIAN_LEAVE_HEAL_PCT' } }),
      m4('planted_noref', 'unit', 'Deals double damage.', { phrases: { 'double damage': 'N:NO_SUCH_ROW' } }),
      // An M3 entry's phrase is tied in lint-registry's own table, its fragment being frozen.
      "Registry.MODIFIERS.marble.clause = 'Moves at double damage.';",
      "Registry.define('MODULES', 'planted_module', { built: 'M4', ready: 'unit', tests: ['m4-grammar.test.js'], inv: 'system', sentence: 'Every 3 turns, a bell.' });",
    ]);
    assert.equal(r.status, 1);
    has(r, /MODIFIERS\.planted_digit: a digit outside \{\} in "Stops for 2 turns\."/);
    has(r, /MODULES\.planted_module: a digit outside \{\}/);
    hasNot(r, /planted_hole/); hasNot(r, /planted_waiting/); hasNot(r, /planted_tied/); hasNot(r, /planted_pct/);
    has(r, /MODIFIERS\.planted_untied: "two tiles a turn" states a number in words, but is tied to no row/);
    has(r, /MODIFIERS\.planted_wrong: "two tiles a turn" says 50%, but N:SPEED_SLOW_PCT is 200/);
    has(r, /MODIFIERS\.planted_stale: its phrase "half speed" is tied to N:SPEED_SLOW_PCT, but its template no longer says it/);
    has(r, /MODIFIERS\.planted_unknown: "thrice" says 3, but N:UNOBSERVED_STEP is 2/);
    has(r, /MODIFIERS\.planted_nonumber: its phrase "a little" is not one of PHRASES, and names no one number in words/);
    for (const w of ['twenty', 'twice', 'twenty-five']) has(r, new RegExp(`MODIFIERS\\.planted_words: "${w}" states a number in words, but is tied to no row`));
    has(r, /MODIFIERS\.planted_one: "one limb" states a number in words/); has(r, /MODIFIERS\.planted_one: "one turn" states a number in words/);
    hasNot(r, /planted_one: "one"/); hasNot(r, /planted_words_tied/);
    has(r, /MODIFIERS\.planted_words_wrong: "two galleries" says 2, but N:GUARDIAN_STAGE_MAX is 4/);
    has(r, /MODIFIERS\.planted_words_pct: "four" cannot state GUARDIAN_LEAVE_HEAL_PCT, a share/);
    has(r, /MODIFIERS\.planted_noref: its phrase "double damage" is tied to "N:NO_SUCH_ROW", which is no whole number of record/);
    has(r, /MODIFIERS\.marble: its phrase "half speed" is tied to N:SPEED_SLOW_PCT, but its template no longer says it/);
    has(r, /MODIFIERS\.marble: "double damage" states a number in words, but is tied to no row/);
    // The tree's own M3 phrases are tied, and hold: "two tiles a turn" is SPEED_FAST_PCT's 50.
    r = lint(null);
    assert.equal(r.status, 0, r.out);
    // A placeholder at ready false waits for its owner; under --strict=M4 it is linted.
    r = lint([m4('planted_waiting', false, 'Stops for 2 turns.')], ['--strict=M4']);
    has(r, /MODIFIERS\.planted_waiting: a digit outside \{\}/);
    // But not where a player reads it at false. A module's panel sentence is read on its panel,
    // its banner and in the log while the module is on, whatever its readiness (the real ones
    // are at false); a clause at false is read on the line of every species population can place
    // (its archetype M3's or past false): A.4's Countersigning Clerk shows its modifiers'
    // placeholders once its archetype, conservator_healer, is past false. (ARCH-CLOCKWORK built
    // it and clockwork: a planted modifier at false, on the Clerk alone, stands in for one, its
    // archetype planted back at false and then at 'unit'.)
    r = lint(["Registry.MODULES.copies_weaken.sentence = 'Every three turns, its spares lose heart.';",
      "Registry.define('MODULES', 'planted_quiet', { built: 'M4', sentence: 'Every 3 turns, a bell.' });"]);
    assert.equal(r.status, 1);
    has(r, /MODULES\.copies_weaken: "three" states a number in words/); has(r, /MODULES\.planted_quiet: a digit outside \{\}/);
    const tick = ["Registry.define('MODIFIERS', 'planted_tick', { built: 'M4', ready: false, clause: 'Ticks for 2 turns.', params: {}, covers: [], tests: [], inv: null });",
      "Packs.get('A4').species.find(sp => sp.archetype === 'conservator_healer').modifiers.push('planted_tick');"];
    r = lint(tick.concat(["Registry.ARCHETYPES.conservator_healer.ready = false;"]));
    hasNot(r, /MODIFIERS\.planted_tick: a digit outside \{\}/);
    r = lint(tick.concat(["Object.assign(Registry.ARCHETYPES.conservator_healer, { ready: 'unit', tests: ['m4-grammar.test.js'], inv: 'system' });"]));
    assert.equal(r.status, 1);
    has(r, /MODIFIERS\.planted_tick: a digit outside \{\} in "Ticks for 2 turns\."/);
    hasNot(r, /ARCHETYPES\.(demonstrator|unobserved_mover|patrol_guard)/);
    // An M3 template keeps its words: a number in words is an M4 rule, as the digit rule is.
    r = lint("Registry.MODIFIERS.marble.clause = 'Moves at half speed, twice as slow, one turn at a time.';");
    hasNot(r, /MODIFIERS\.marble: "(twice|one turn)"/);
  });

  tmpTest('lint-registry fails a refusal at ready true that no refusals*.test.js file it names makes happen', () => {
    const refusal = (code, tests) => [`Registry.define('REFUSALS', '${code}', { built: 'M4', ready: true, tests: ${json(tests)}, inv: 'system' });`, `Text.defineRefusal('${code}', () => 'Planted.');`];
    let r = lint([
      ...refusal('planted_unreached', ['behaviour/refusals.test.js']),
      ...refusal('planted_nofile', ['m4-grammar.test.js', 'behaviour/joined.test.js']),
      // refusals.test.js names 'dummy' in quotes (its training dummy's sp), but has no case of it.
      ...refusal('dummy', ['behaviour/refusals.test.js']),
      // A refusal at 'unit' is proved by its unit tests (no_centrepiece, m4-skeleton's).
      "Registry.define('REFUSALS', 'planted_unit', { built: 'M4', ready: 'unit', tests: ['m4-grammar.test.js'], inv: 'system' }); Text.defineRefusal('planted_unit', () => 'Planted.');",
    ]);
    assert.equal(r.status, 1);
    has(r, /REFUSALS\.planted_unreached is at ready true, but no test\/behaviour\/refusals\*\.test\.js file it names makes it happen/);
    has(r, /REFUSALS\.planted_nofile is at ready true, but no test\/behaviour\/refusals\*\.test\.js file it names makes it happen/);
    assert.match(fs.readFileSync(path.join(root, 'test/behaviour/refusals.test.js'), 'utf8'), /'dummy'/);
    has(r, /REFUSALS\.dummy is at ready true, but no test\/behaviour\/refusals\*\.test\.js file it names makes it happen \(has a case with code: 'dummy'\)/);
    hasNot(r, /REFUSALS\.planted_unit is/);
    // 'corner' is made to happen in behaviour/refusals.test.js, which names it in quotes.
    hasNot(r, /REFUSALS\.corner/);
    // Under --strict, every refusal of the milestones it checks, one at 'unit' too (a planted
    // one: PG-VIEW made no_centrepiece happen in behaviour/refusals-view.test.js).
    r = lint("Registry.define('REFUSALS', 'planted_unit_strict', { built: 'M4', ready: 'unit', tests: ['m4-grammar.test.js'], inv: 'system' }); Text.defineRefusal('planted_unit_strict', () => 'Planted.');", ['--strict=M4']);
    has(r, /REFUSALS\.planted_unit_strict is at ready "unit", but no test\/behaviour\/refusals\*\.test\.js file/);
    hasNot(r, /REFUSALS\.no_centrepiece is/);
  });

  tmpTest('lint-registry holds an M4 id past ready false to §5.1\'s reference rule, as an M3 one: a pack, a scenario file or an arena stamp names it', () => {
    // The orphan's id is built here, so that this file does not name it in quotes.
    const orphan = ['planted', 'm4', 'orphan'].join('_');
    let r = lint([`Registry.define('GLASS', '${orphan}', { built: 'M4', ready: 'unit', tests: ['m4-grammar.test.js'], inv: 'cases' });`,
      "Registry.define('GLASS', 'planted_m4_named', { built: 'M4', ready: 'unit', tests: ['m4-grammar.test.js'], inv: 'cases' });",
      "Registry.define('GLASS', 'planted_m4_waiting', { built: 'M4' });"]);
    assert.equal(r.status, 1);
    has(r, new RegExp(`GLASS\\.${orphan} is referenced by no pack, by none of its scenario files \\(m4-grammar\\.test\\.js\\) and by no arena stamp`));
    hasNot(r, /planted_m4_named is referenced/); hasNot(r, /planted_m4_waiting is referenced/);
    // Under --strict=M4 every M4 id is held to it, one still waiting at ready false too: a
    // module is referenced by the pack that holds it; the chime's wake cause by its scenario
    // files (since MOD-CHIME); a planted one that nothing names is not.
    r = lint(["Registry.define('GLASS', 'planted_m4_waiting', { built: 'M4' });"], ['--strict=M4']);
    hasNot(r, /MODULES\.[a-z_]+ is referenced/); hasNot(r, /WAKE_CAUSES\.period is referenced/);
    has(r, /GLASS\.planted_m4_waiting is referenced by no pack, by none of its scenario files \(none\) and by no arena stamp/);
  });

  tmpTest('lint-registry fails a flag a species\' department does not hold, and malformed keywords', () => {
    let r = lint([
      "Packs.get('S9').species[0].flags = ['copies_weaken'];",
      "Packs.get('S9').species[1].flags = ['alarm_network'];",
      "Packs.get('A4').species[0].flags = 'copies_weaken';",
      "Packs.sharedList()[0].flags = ['unobserved_motion'];",
      "Registry.define('MODULES', 'planted_words', { built: 'M4', sentence: 'Planted.', keywords: ['Alarm', ''] });",
    ]);
    assert.equal(r.status, 1);
    has(r, /S9\.1 is flagged with "copies_weaken", a module its department S9 does not hold/);
    hasNot(r, /S9\.2 is flagged/);
    has(r, /A4\.1: its flags are not a list of modules/);
    has(r, /is a shared species, with no department, but is flagged with \["unobserved_motion"\]/);
    has(r, /MODULES\.planted_words: its keywords \["Alarm",""\] are not a list of lower-case words/);
    // A log group, like a sentence, belongs to a cause that has a schema.
    r = lint("Text.defineGroup('woke', 'planted_group', () => 'Planted.');");
    assert.equal(r.status, 1); has(r, /there is a log group for woke\.planted_group \(Text\.defineGroup\), which has no cause schema/);
    r = lint(["Packs.get('S9').species[0].flags = ['unobserved_motion'];", "Packs.get('M11').species[1].flags = ['hourly_demonstration'];"]);
    assert.equal(r.status, 0, r.out);
  });

  // A planted department, T.9, holding S.9's two modules (unobserved_motion its signature, as
  // its first) and one species of each kind the Intro rule tells apart (T9.3 a Grazer and T9.5
  // a Wader, whose archetypes' clauses hold their modules' slots, as a species flagged with a
  // module must, now that both modules are built). T9.6, a teaching instance flagged with the
  // signature and alarm_network too, is added only where it is planted: no archetype's clause
  // holds a slot for both modules, so its own line is a problem as well.
  const T9_SPECIES = [
    { id: 'T9.1', archetype: 'plodder', role: 'fodder', modifiers: [], trigger: null },
    { id: 'T9.2', archetype: 'darter', role: 'skirmisher', modifiers: [], trigger: null },
    { id: 'T9.3', archetype: 'unobserved_mover', role: 'ambusher', modifiers: [], trigger: null, flags: ['unobserved_motion'] },
    { id: 'T9.4', archetype: 'plodder', role: 'warden', modifiers: [], trigger: null },
    { id: 'T9.5', archetype: 'patrol_guard', role: 'fodder', modifiers: [], trigger: null, flags: ['alarm_network'] },
  ];
  const T9_6 = { id: 'T9.6', archetype: 'patrol_guard', role: 'ambusher', modifiers: [], trigger: null, flags: ['unobserved_motion', 'alarm_network'] };
  const T9 = more => `Packs.add(${json(Object.assign({ acc: 'T9', number: 'T.9', title: 'Planted', family: 'Planted', palette: 'S9', programme: 'enfilade',
    claim: { primary: 'guarded', secondary: null }, modules: [{ id: 'unobserved_motion' }, { id: 'alarm_network' }], items: [], consumables: { names: [], labels: {} },
    species: T9_SPECIES }, more || {}))});`;

  tmpTest('lint-registry\'s Intro rule (WO6): the Intro teaches only its signature module, in its panel and its stamp', () => {
    // The teaching instance (T9.3, an ambusher flagged with the signature), fodder and a
    // skirmisher, under a panel that says the signature's sentence: clean.
    let r = lint(T9({ intro: { map: ['######', '#ab.c#', '######'], legend: { a: { sp: 'T9.3' }, b: { sp: 'T9.1' }, c: { sp: 'T9.2' } }, stretch: [], invariants: [] },
      panels: { intro: ['Please keep the exhibits in view. ' + R.MODULES.unobserved_motion.sentence], sections: [] } }));
    assert.equal(r.status, 0, r.out);
    r = lint(T9({ panels: { intro: { text: 'The night staff say the court is alarmed.', banner: R.MODULES.weather_cases.sentence } } }));
    assert.equal(r.status, 1);
    has(r, /T9's intro panel says "alarmed", a word of alarm_network's rule, but its Intro teaches only unobserved_motion/);
    has(r, /T9's intro panel says weather_cases's sentence/); has(r, /T9's intro panel says "weather", a word of weather_cases's rule/);
    r = lint(T9({ intro: { map: ['######', '#aWwBc#', '######'], legend: { a: { sp: 'T9.3' }, W: { sp: 'T9.5' }, w: { sp: 'T9.4' }, B: { sp: 'S9.1' }, c: { k: 'case', weather: 'fog' } } } }));
    assert.equal(r.status, 1);
    has(r, /T9's Intro places T9\.5 \('W'\), flagged with alarm_network, but teaches only unobserved_motion/);
    has(r, /T9's Intro places T9\.4 \('w'\), a warden: only fodder and skirmisher or the signature's teaching instance/);
    has(r, /T9's Intro places S9\.1 \('B'\), which is no species of its pack/);
    has(r, /T9's Intro holds a weather case \('c'\), but teaches only unobserved_motion/);
    hasNot(r, /T9\.3 \('a'\)/);
    // Nor may the teaching instance carry another module's flag besides the signature's: its line
    // would state that module's rule in the Intro (M.11's Intro has a station of its own,
    // M11.12, flagged with the chime alone, for the stations' rain clause).
    r = lint(T9({ species: T9_SPECIES.concat([T9_6]), intro: { map: ['#####', '#d..#', '#####'], legend: { d: { sp: 'T9.6' } }, stretch: [], invariants: [] } }));
    assert.equal(r.status, 1);
    has(r, /T9's Intro places T9\.6 \('d'\), flagged with alarm_network, but teaches only unobserved_motion/);
    hasNot(r, /flagged with unobserved_motion/);
    // A legend entry in a shape the rule did not foresee is read all the same: a species named
    // in any field, weather anywhere in it.
    r = lint(T9({ intro: { map: ['#####', '#Xy.#', '#####'], legend: { X: { exhibit: { of: 'T9.5' } }, y: { case: { holds: null, weather: 'rain' } } } } }));
    assert.equal(r.status, 1);
    has(r, /T9's Intro places T9\.5 \('X'\), flagged with alarm_network/); has(r, /T9's Intro holds a weather case \('y'\)/);
    // More than three hostiles: two letters, one of them two to a tile.
    r = lint(T9({ intro: { map: ['#####', '#bab#', '#####'], legend: { a: { sp: 'T9.3', count: 2 }, b: { sp: 'T9.1' } } } }));
    assert.equal(r.status, 1); has(r, /T9's Intro places 4 exhibits; it holds at most 3/);
    // A module marked role 'signature' is the signature, first or not: with weather_cases as
    // its signature, the Intro may hold a weather case, and the panel may not name the chime.
    r = lint(T9({ modules: [{ id: 'hourly_demonstration' }, { id: 'weather_cases', role: 'signature' }], species: [],
      intro: { map: ['###', '#c#', '###'], legend: { c: { k: 'case', weather: 'rain' } } }, panels: { intro: 'Mind the chime.' } }));
    assert.equal(r.status, 1); hasNot(r, /weather case/);
    has(r, /T9's intro panel says "chime", a word of hourly_demonstration's rule, but its Intro teaches only weather_cases/);
  });

  tmpTest('lint-registry --report ACC lists every number a pack holds, and every value it gives a module or a modifier', () => {
    let r = lint(T9({ modules: [{ id: 'unobserved_motion', params: { step: 1, scope: 'flagged' } }, { id: 'alarm_network' }], treasure: { case: { glass: 3 } },
      centrepiece: { id: 'T9.9', archetype: 'plodder', role: 'centrepiece', modifiers: [], trigger: null, size: 2, modParams: { old_repair: { side: 'E' } } } }), ['--report', 'T9']);
    assert.equal(r.status, 0, r.out);
    has(r, /^REPORT T9: module unobserved_motion\.params\.step = 1$/m);
    has(r, /^REPORT T9: module unobserved_motion\.params\.scope = "flagged"$/m);
    has(r, /^REPORT T9: treasure\.case\.glass = 3$/m);
    has(r, /^REPORT T9: centrepiece T9\.9\.size = 2$/m);
    has(r, /^REPORT T9: centrepiece T9\.9\.modParams\.old_repair\.side = "E"$/m);
    has(r, /^REPORT T9: 5 value\(s\) the pack gives$/m);
    // And a species' own number, planted in S.9's.
    r = lint("Packs.get('S9').species[0].count = 5;", ['--report', 'S9']);
    has(r, /^REPORT S9: species S9\.1\.count = 5$/m); has(r, /^REPORT S9: centrepiece S9\.\d+\.size = 2$/m);
    r = lint(null, ['--report', 'M11']);
    has(r, /^REPORT M11: species M11\.3\.modParams\.old_repair\.side = "W"$/m);
    r = lint(null, ['--report', 'Q1']);
    assert.equal(r.status, 1); has(r, /--report Q1: no department pack has that accession/);
  });
};
