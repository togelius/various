// The golden runs of test/golden/golden.js (BUILD.md §3.5), of both kinds: a monkey run (in
// the test room or a department) and a replay. Each is played twice and once with the state
// cloned after every step, and all three must agree, which shows the rules are deterministic
// and a cloned state behaves exactly like the original (tools/golden.js's selfCheck). When a
// play throws or differs, the failure names the first step where it happens and gives the
// crash card (§10.2) of the visit it is in, replayed from that visit's seed and shrunk. A
// pinned run must also give its recorded hash and checkpoints; when it does not, and the pin
// keeps per-step hashes, the failure names the first diverging step, its action and its
// events. A run marked `pending` (while a wave changes the state on purpose) is not held to
// its pin; its hash is printed beside the pin, and the hash page's check compares it with
// Node's (tools/browser/check-hash.mjs).
module.exports = ({ test, assert, loadCore, root, path }) => {
  const C = loadCore(['tools/monkey.js', 'tools/replay.js', 'test/golden/golden.js']);
  const { Replay, GOLDEN } = C;
  const Golden = require(path.join(root, 'tools/golden.js'));

  for (const name of Object.keys(GOLDEN)) {
    const g = GOLDEN[name], kind = Replay.kindOf(g), n = Replay.count(g);
    test(`${name}: a ${kind} of ${n} actions gives one hash twice, and again when cloned after every step` + (g.pending ? ' (pending: not held to the pin)' : ', equal to the pin'), () => {
      const { run, problem } = Golden.selfCheck(C, name, g);
      if (problem) assert.fail(problem);
      if (g.pending) {
        console.log(`golden ${name}: PENDING (${g.pending}): hash ${run.hash}, pin ${g.hash === null ? 'none' : g.hash}${run.hash === g.hash ? ', unchanged' : ''}`);
        return;
      }
      const v = Replay.verify(name, g);
      if (!v.ok) assert.fail('golden hash changed: if a rule changed on purpose, run node tools/golden.js and log why.\n' + v.text);
    });
  }
};
