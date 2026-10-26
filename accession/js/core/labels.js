// ACCESSION — what a label says about a thing on the board (BUILD.md §8.8): the title,
// state, tombstone, pictograms, Behaviour line, odds readout and paragraph, built from the
// pack, the registry and the rules' own numbers.
'use strict';
const Labels = (() => {
  // The species an actor was made from: its department's, its Centrepiece, or a shared one
  // (the Night Watchman); null for you and the test room's dummies.
  const speciesOf = (state, a) => Packs.speciesFor(state, a);

  function stateIcons(a) {
    if (a.uid === 'you') return [];
    if (a.mode === 'dormant') return a.pips ? Array.from({ length: 3 }, (_, i) => i < a.pips ? 'pip' : 'pip_empty') : ['asleep'];
    return [a.mode === 'hunting' ? 'hunting' : a.mode === 'returning' ? 'returning' : 'alert'];
  }

  // The odds readout (BUILD.md §8.1), by exact enumeration of the rolls, all integer.
  // "Typically" is the mean net hit as a share of your current health, rounded half up.
  // What its archetype says of its odds (Archetypes.readout) changes two lines: an exhibit
  // with no blow (noBlow, the axis_sniper) gets no line on its hitting you, and one that
  // needs a set number of hits (hits, a swarm body, which any hit destroys) says so.
  const halfUp = (num, den) => Int.idiv(2 * num + den, 2 * den);
  const hits = n => n + (n === 1 ? ' hit' : ' hits');
  function odds(state, a) {
    const you = state.actors[0], hp = Math.max(1, you.hp);
    const theirs = Combat.netRolls(a, you), mine = Combat.netRolls(you, a);
    const said = Archetypes.readout(state, a, you), noBlow = said.some(r => r.k === 'noBlow'), set = said.find(r => r.k === 'hits');
    const need = set ? set.n : Int.ceilDiv(a.hp * mine.n, mine.sum);
    const lines = [];
    if (!noBlow) lines.push(`It has a ${Combat.hitChance(a, you)}% chance to hit you, typically hits for ${halfUp(100 * theirs.sum, theirs.n * hp)}% of your current health, and at worst could defeat you in ${hits(Int.ceilDiv(hp, theirs.max))}.`);
    lines.push(`You have a ${Combat.hitChance(you, a)}% chance to hit it, and typically need ${hits(need)} to destroy it.`);
    if (Combat.surprised(you, a)) lines.push(`A surprise attack now would hit for certain, for ${range(Combat.surpriseNet(you, a))}.`);
    return lines;
  }

  // The Behaviour line (§5.3), with its numbers at the department's depth, leaving out the
  // clauses of rules switched off for this visit.
  const behaviour = (state, sp) => Clauses.line(sp, { depth: state.dept.depth, rulesOff: (state.options && state.options.rulesOff) || [] });

  // The Attack button says what a blow would do now (§7.1): a surprise blow hits for
  // certain (§8.1), so it shows no chance.
  const range = r => r.min === r.max ? String(r.min) : r.min + '–' + r.max;
  function attackText(you, a) {
    if (Combat.surprised(you, a)) return `Attack: certain hit, ${range(Combat.surpriseNet(you, a))} damage`;
    return `Attack: ${Combat.hitChance(you, a)}%, ${range(Combat.netRolls(you, a))} damage`;
  }

  // An exhibit's label, or null: for you, for one gone, and for one that shows as something
  // else (Archetypes.present: a mimic in its disguise is a case, whose label is its case's,
  // §8.3). Its Attack button is offered only for a blow step() would allow
  // (Combat.canStrike), so an exhibit in an intact case, beside you, gets none.
  function of(state, uid) {
    const a = Actors.byUid(state, uid);
    if (!a || a.gone || a.uid === 'you' || Archetypes.present(state, a) !== null) return null;
    const sp = speciesOf(state, a), you = state.actors[0];
    const near = Actors.dist(a, you.x, you.y) <= N.READ_RANGE;
    // An exhibit with no blow (Archetypes.readout's noBlow, the axis_sniper) shows neither a
    // blow's Acc nor its damage, which it never uses (§8.1, the odds readout).
    const blow = !Archetypes.readout(state, a, you).some(r => r.k === 'noBlow');
    const pictos = [
      { icon: 'heart', text: `${a.hp}/${a.maxHp}` }, { icon: 'acc', text: String(a.acc) }, { icon: 'eva', text: String(a.eva) },
      { icon: 'padding', text: String(a.pad) }, { icon: 'damage', text: `${a.dmin}–${a.dmax}` },
    ].filter(p => blow || (p.icon !== 'acc' && p.icon !== 'damage'));
    if (sp && sp.trigger && Registry.TRIGGERS[sp.trigger]) pictos.unshift({ icon: Registry.TRIGGERS[sp.trigger].icon, text: 'wakes' });
    pictos.unshift({ icon: 'ring', text: 'ring' });
    const strike = Combat.canStrike(state, you, a, { kind: 'melee' }) === null;
    return {
      uid, title: sp ? sp.name : a.sp, stateIcons: stateIcons(a), tomb: sp ? sp.tomb : null, number: sp ? sp.id.replace(/^([A-Z]+)(\d+)/, '$1.$2') : '',
      pictos, behaviour: sp ? behaviour(state, sp) : '', odds: odds(state, a),
      paragraph: near && sp ? sp.paragraph : '', far: near ? '' : 'Come closer to read the label.',
      closeup: sp ? { sprite: sp.sprite, dept: state.dept.acc } : null,
      actions: strike ? [{ id: 'attack', text: attackText(you, a) }] : [],
    };
  }

  // The strip (§8.8): the nearest readable exhibit within 2 tiles of its nearest tile and
  // with any tile in sight, in this priority: hunting or awake exhibits (every mode but
  // dormant), then sleeping ones; nearest first within each, then spawn order. Case
  // contents and plaques join in M3. An exhibit that shows as something else (a mimic in its
  // disguise, Archetypes.present) is not an exhibit here: it reaches the strip only as a case.
  function strip(state) {
    const you = state.actors[0];
    let best = null, bestKey = null;
    for (const a of state.actors) {
      if (a.gone || a.uid === 'you' || Archetypes.present(state, a) !== null) continue;
      const d = Actors.dist(a, you.x, you.y);
      if (d > N.READ_RANGE || !Actors.inSight(state, a, you.x, you.y)) continue;
      const key = (a.mode === 'dormant' ? 1 : 0) * 100 + d;
      if (best === null || key < bestKey) { best = a; bestKey = key; }
    }
    if (!best) return null;
    const l = of(state, best.uid);
    return { uid: best.uid, title: l.title, stateIcons: l.stateIcons, pictos: l.pictos.slice(0, 2).map(p => p.icon), behaviour: l.behaviour };
  }

  // Names for Text.event: nameOf(state) → (uid → 'the' and the species name as written, or
  // null for you and for anything with no species in a pack, such as the test room's dummies).
  function nameOf(state) {
    return uid => {
      if (uid === 'you') return null;
      const a = Actors.byUid(state, uid), sp = a ? speciesOf(state, a) : null;
      return sp ? 'the ' + sp.name.replace(/^The /, '') : null;
    };
  }

  // [stub → W2a-LABELS] The labels of things that are not exhibits (§8.8): a case (with its
  // accession number), an item, a plaque, a staff door, and you. null for now.
  const ofCase = (state, f) => null;
  const ofItem = (state, uid) => null;
  const ofPlaque = (state, f) => null;
  const ofStaffDoor = (state, f) => null;
  const yours = state => null;

  return { of, strip, speciesOf, stateIcons, nameOf, ofCase, ofItem, ofPlaque, ofStaffDoor, you: yours };
})();
