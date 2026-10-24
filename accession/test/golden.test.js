// The golden runs of test/golden/golden.js (BUILD.md §3.5): each is played twice and once
// with the state cloned after every step, and all three must agree, which shows the rules
// are deterministic and a cloned state behaves exactly like the original. A pinned run must
// also give its recorded hash and checkpoints. A run marked `pending` (while a wave changes
// the state on purpose) is not held to its pin; its hash is printed beside the pin, and the
// hash page's check compares it with Node's (tools/browser/check-hash.mjs).
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore(['tools/monkey.js', 'test/golden/golden.js']);
  const { Monkey, GOLDEN } = C;

  for (const name of Object.keys(GOLDEN)) {
    const g = GOLDEN[name];
    test(`${name}: ${g.actions} monkey actions give one hash twice, and again when cloned after every step` + (g.pending ? ' (pending: not held to the pin)' : ', equal to the pin'), () => {
      const a = Monkey.run(g.seed, g.actions), b = Monkey.run(g.seed, g.actions);
      assert.equal(b.hash, a.hash, 'two runs of the same seed and actions differ');
      assert.deepEqual(b.checkpoints, a.checkpoints, 'two runs of the same seed and actions differ at a checkpoint');
      const c = Monkey.run(g.seed, g.actions, { cloneEachStep: true });
      assert.deepEqual(c.checkpoints, a.checkpoints, 'a cloned state behaves exactly like the original');
      assert.equal(c.hash, a.hash, 'a cloned state behaves exactly like the original');
      if (g.pending) {
        console.log(`golden ${name}: PENDING (${g.pending}): hash ${a.hash}, pin ${g.hash}${a.hash === g.hash ? ', unchanged' : ''}`);
        return;
      }
      assert.equal(a.hash, g.hash, 'golden hash changed: if a rule changed on purpose, run node tools/golden.js and log why');
      assert.deepEqual(a.checkpoints, g.checkpoints);
    });
  }
};
