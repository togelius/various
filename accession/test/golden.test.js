// The golden runs of test/golden/golden.js (BUILD.md §3.5), of both kinds: a monkey run (in
// the test room or a department) and a replay. Each is played twice and once with the state
// cloned after every step, and all three must agree, which shows the rules are deterministic
// and a cloned state behaves exactly like the original. A pinned run must also give its
// recorded hash and checkpoints; when it does not, and the pin keeps per-step hashes, the
// failure names the first diverging step, its action and its events. A run marked `pending`
// (while a wave changes the state on purpose) is not held to its pin; its hash is printed
// beside the pin, and the hash page's check compares it with Node's
// (tools/browser/check-hash.mjs).
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore(['tools/monkey.js', 'tools/replay.js', 'test/golden/golden.js']);
  const { Replay, GOLDEN } = C;

  // Where two plays of one run first differ, in words: both are played again with every
  // step's hash, and the first step whose hash differs is described with its action and
  // events (as the second play saw them).
  const where = (name, g, optsA, optsB, what) => {
    const a = Replay.golden(g, Object.assign({ steps: true }, optsA));
    const d = Replay.golden(g, Object.assign({ against: a.steps }, optsB)).diverged;
    return `${name}: ${what}` + (d ? '\n' + Replay.describe(name, d, Replay.count(g), 'the first play') : ', though no step\'s hash differs');
  };

  for (const name of Object.keys(GOLDEN)) {
    const g = GOLDEN[name], kind = Replay.kindOf(g), n = Replay.count(g);
    test(`${name}: a ${kind} of ${n} actions gives one hash twice, and again when cloned after every step` + (g.pending ? ' (pending: not held to the pin)' : ', equal to the pin'), () => {
      const a = Replay.golden(g), b = Replay.golden(g);
      if (b.hash !== a.hash || Replay.firstDiff(b.checkpoints, a.checkpoints) >= 0) assert.fail(where(name, g, {}, {}, 'two runs of the same seed and actions differ'));
      const c = Replay.golden(g, { clone: true });
      if (c.hash !== a.hash || Replay.firstDiff(c.checkpoints, a.checkpoints) >= 0) assert.fail(where(name, g, {}, { clone: true }, 'a cloned state does not behave exactly like the original'));
      if (g.pending) {
        console.log(`golden ${name}: PENDING (${g.pending}): hash ${a.hash}, pin ${g.hash === null ? 'none' : g.hash}${a.hash === g.hash ? ', unchanged' : ''}`);
        return;
      }
      const v = Replay.verify(name, g);
      if (!v.ok) assert.fail('golden hash changed: if a rule changed on purpose, run node tools/golden.js and log why.\n' + v.text);
    });
  }
};
