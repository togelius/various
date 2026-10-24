// ACCESSION — what a label says about a thing on the board (BUILD.md §8.8): the title,
// state, tombstone, pictograms, Behaviour line, odds readout and paragraph, built from the
// pack, the registry and the rules' own numbers.
'use strict';
const Labels = (() => {
  function speciesOf(state, a) {
    const pack = Packs.get(state.dept.acc);
    if (!pack) return null;
    if (pack.centrepiece && pack.centrepiece.id === a.sp) return pack.centrepiece;
    return pack.species.find(s => s.id === a.sp) || null;
  }

  function stateIcons(a) {
    if (a.uid === 'you') return [];
    if (a.mode === 'dormant') return a.pips ? Array.from({ length: 3 }, (_, i) => i < a.pips ? 'pip' : 'pip_empty') : ['asleep'];
    return [a.mode === 'hunting' ? 'hunting' : a.mode === 'returning' ? 'returning' : 'alert'];
  }

  // The odds readout (BUILD.md §8.1), by exact enumeration of the rolls, all integer.
  // "Typically" is the mean net hit as a share of your current health, rounded half up.
  const halfUp = (num, den) => Int.idiv(2 * num + den, 2 * den);
  const hits = n => n + (n === 1 ? ' hit' : ' hits');
  function odds(state, a) {
    const you = state.actors[0], hp = Math.max(1, you.hp);
    const theirs = Combat.netRolls(a, you), mine = Combat.netRolls(you, a);
    const lines = [
      `It has a ${Combat.hitChance(a, you)}% chance to hit you, typically hits for ${halfUp(100 * theirs.sum, theirs.n * hp)}% of your current health, and at worst could defeat you in ${hits(Int.ceilDiv(hp, theirs.max))}.`,
      `You have a ${Combat.hitChance(you, a)}% chance to hit it, and typically need ${hits(Int.ceilDiv(a.hp * mine.n, mine.sum))} to destroy it.`,
    ];
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

  function of(state, uid) {
    const a = Actors.byUid(state, uid);
    if (!a || a.gone || a.uid === 'you') return null;
    const sp = speciesOf(state, a), you = state.actors[0];
    const near = Actors.dist(a, you.x, you.y) <= N.READ_RANGE;
    const pictos = [
      { icon: 'heart', text: `${a.hp}/${a.maxHp}` }, { icon: 'acc', text: String(a.acc) }, { icon: 'eva', text: String(a.eva) },
      { icon: 'padding', text: String(a.pad) }, { icon: 'damage', text: `${a.dmin}–${a.dmax}` },
    ];
    if (sp && sp.trigger && Registry.TRIGGERS[sp.trigger]) pictos.unshift({ icon: Registry.TRIGGERS[sp.trigger].icon, text: 'wakes' });
    pictos.unshift({ icon: 'ring', text: 'ring' });
    const adjacent = Step.adjacent(state, you, a);
    return {
      uid, title: sp ? sp.name : a.sp, stateIcons: stateIcons(a), tomb: sp ? sp.tomb : null, number: sp ? sp.id.replace(/^([A-Z]+)(\d+)/, '$1.$2') : '',
      pictos, behaviour: sp ? behaviour(state, sp) : '', odds: odds(state, a),
      paragraph: near && sp ? sp.paragraph : '', far: near ? '' : 'Come closer to read the label.',
      closeup: sp ? { sprite: sp.sprite, dept: state.dept.acc } : null,
      actions: adjacent ? [{ id: 'attack', text: attackText(you, a) }] : [],
    };
  }

  // The strip (§8.8): the nearest readable exhibit within 2 tiles of its nearest tile and
  // with any tile in sight, in this priority: hunting or awake exhibits (every mode but
  // dormant), then sleeping ones; nearest first within each, then spawn order. Case
  // contents and plaques join in M3.
  function strip(state) {
    const you = state.actors[0];
    let best = null, bestKey = null;
    for (const a of state.actors) {
      if (a.gone || a.uid === 'you') continue;
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

  return { of, strip, speciesOf, stateIcons, nameOf };
})();
