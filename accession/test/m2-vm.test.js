// M2's view-model tests (BUILD.md §6.1): what the view model lists and the one-turn cues
// it carries. Split from m2.test.js so that the view model's tests and the labels' tests
// are in separate files.
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const { Dept, ViewModel, Setup, Step } = C;
  // Values made inside the core's context have its prototypes, so compare them as JSON.
  const same = (got, want, msg) => assert.equal(JSON.stringify(got), JSON.stringify(want), msg);

  test('the view model carries one-turn cues from the last step’s events: where each actor moved from, and who was hit', () => {
    const map = ['##########', '#........#', '#........#', '#........#', '##########'];
    const s = Setup.room(2, { acc: 'T0', depth: 1, map, you: [2, 2], exhibits: [{ sp: 'x', at: [6, 2], mode: 'hunting', stats: { hp: 50, acc: 30, eva: 0, pad: 0, dmin: 1, dmax: 1 } }] });
    same(ViewModel.derive(s, {}).cues, { movedFrom: [], hit: [] }, 'no events, no cues');
    const ex = s.actors[1];
    let ev = Step.step(s, { a: 'move', dir: 2 });
    const mine = ev.find(e => e.k === 'moved' && e.who === 'you'), its = ev.find(e => e.k === 'moved' && e.who === ex.uid);
    assert.ok(mine && its);
    let vm = ViewModel.derive(s, { events: ev });
    same(vm.cues.movedFrom, [{ uid: 'you', x: 2, y: 2 }, { uid: ex.uid, x: its.from[0], y: its.from[1] }]);
    let hits = 0;
    for (let i = 0; i < 20 && !hits; i++) {
      ev = Step.step(s, { a: 'wait' });
      vm = ViewModel.derive(s, { events: ev });
      const was = ev.filter(e => e.k === 'damaged').map(e => e.who);
      same(vm.cues.hit, [...new Set(was)]);
      hits += was.length;
    }
    assert.ok(hits > 0 && vm.cues.hit.includes('you'), 'you were hit');
    // Only for actors the view model lists: one out of sight gets none.
    const walled = ['##########', '#...#....#', '#...#....#', '##########'];
    const w = Setup.room(2, { acc: 'T0', depth: 1, map: walled, you: [1, 1], exhibits: [{ sp: 'x', at: [7, 1], mode: 'dormant', stats: { hp: 5, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 } }] });
    const fake = [{ k: 'moved', turn: 0, who: w.actors[1].uid, from: [6, 1], to: [7, 1] }, { k: 'damaged', turn: 0, who: w.actors[1].uid, amount: 1, hp: 4, cause: {} }];
    assert.equal(ViewModel.derive(w, {}).actors.length, 1, 'it is out of sight');
    same(ViewModel.derive(w, { events: fake }).cues, { movedFrom: [], hit: [] });
  });

  test('the view model lists only actors on visible tiles, and you', () => {
    const s = Dept.create(3, 'M11', 2), vm = ViewModel.derive(s, {});
    assert.equal(vm.actors[0].uid, 'you');
    for (const a of vm.actors.slice(1)) {
      let seen = false;
      for (let dy = 0; dy < a.size; dy++) for (let dx = 0; dx < a.size; dx++) if (vm.vis[(a.y + dy) * vm.w + a.x + dx] === 2) seen = true;
      assert.ok(seen, `${a.uid} is listed but not on a visible tile`);
    }
  });
};
