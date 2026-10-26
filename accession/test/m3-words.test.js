// Words the player reads as they are said (BUILD.md §0, §3.4; Wave 3's review of the board and
// the interface, playing): a count of one tile is "1 tile" in every event's sentence (a pip
// "you are inside your ring, 1 tile away", a noise heard 1 tile away), and a chance takes the
// article it is spoken with in the odds readout ("an 80% chance", "an 18% chance", "a 75%
// chance"). Before, the log said "1 tiles away" and the labels "a 80% chance".
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const { Registry: R, Text, Setup, Labels, Combat } = C;
  const json = JSON.stringify;

  // A synthetic event for a kind and (optionally) a cause, every whole number in it 1 and every
  // list of one, so each count a sentence gives is a count of one.
  const SAMPLE = { uid: 'x.1', uids: ['x.1'], int: 1, str: 'soft', bool: true, tile: [1, 2], tiles: [[1, 2]], obj: { kind: 'melee' } };
  function sample(k, causeK, optional) {
    const fill = (list, o) => { for (const f of list) if (!f.optional || optional) o[f.name] = f.type === 'uid' ? 'x.1' : JSON.parse(JSON.stringify(SAMPLE[f.type])); return o; };
    const e = fill(R.EVENTS[k].list, { k, turn: 3, tick: 300 });
    if (k === 'refused') e.reason = 'corner';
    e.cause = causeK ? fill(R.CAUSES[k][causeK].list, { k: causeK }) : { k: 'no_such_cause' };
    return e;
  }

  test('every event\'s sentence says "1 tile", never "1 tiles", for a distance, a range or a size of one', () => {
    const bad = [];
    let n = 0, ones = 0;
    for (const k of R.EVENT_KINDS) for (const c of [null, ...Object.keys(R.CAUSES[k] || {})]) for (const optional of [false, true]) {
      const s = Text.event(sample(k, c, optional), uid => uid === 'x.1' ? 'the Lantern-Crop Wader' : null);
      if (/\b1 tiles\b/.test(s)) bad.push(`${k}${c ? '.' + c : ''}: ${s}`);
      if (/\b1 tile\b/.test(s)) ones++;
      n++;
    }
    assert.deepEqual(bad, []);
    assert.ok(n > 300 && ones >= 15, `${n} sentences, ${ones} of them saying 1 tile`);
    assert.equal(Text.tiles(1), '1 tile'); assert.equal(Text.tiles(0), '0 tiles'); assert.equal(Text.tiles(6), '6 tiles');
  });

  test('the odds readout says "an 80%", "an 85%", "an 11%" and "an 18%" chance, and "a" before every other', () => {
    const OPEN = ['#########', '#.......#', '#.......#', '#########'];
    const s = Setup.room(1, { acc: 'T0', depth: 1, map: OPEN, you: [2, 1], exhibits: [{ sp: 'dummy', at: [3, 1], mode: 'hunting', stats: { hp: 30, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 4 } }] });
    const you = s.actors[0], a = s.actors[1], seen = new Set();
    for (let d = -14; d <= 5; d++) {
      a.acc = d + you.eva; you.acc = d + a.eva;
      const chance = Combat.hitChance(a, you), lines = Labels.odds(s, a);
      assert.equal(Combat.hitChance(you, a), chance);
      const an = chance === 11 || chance === 18 || String(chance)[0] === '8';
      const want = [`It has ${an ? 'an' : 'a'} ${chance}% chance to hit you,`, `You have ${an ? 'an' : 'a'} ${chance}% chance to hit it,`];
      for (const w of want) assert.ok(lines.some(l => l.startsWith(w)), `${chance}%: ${json(lines)}`);
      seen.add(chance);
    }
    for (const c of [10, 75, 80, 85, 95]) assert.ok(seen.has(c), `${c}% was shown`);
  });
};
