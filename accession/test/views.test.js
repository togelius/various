// The board views draw every kind of tile (BUILD.md §6): each registered view either has
// its own drawing for a tile or lists it as plain floor on purpose, so no view silently
// loses map information the others show. Loops over whichever view files exist.
module.exports = ({ test, assert, loadCore, root, fs, path }) => {
  const { Grid } = loadCore();
  test('every view draws every tile kind', () => {
    const views = fs.readdirSync(path.join(root, 'js/view')).map(f => 'js/view/' + f)
      .filter(f => /Views\.register\(/.test(fs.readFileSync(path.join(root, f), 'utf8')));
    assert.ok(views.length >= 1);
    const kinds = Object.keys(Grid.TILES).concat(['C']);
    for (const v of views) {
      const src = fs.readFileSync(path.join(root, v), 'utf8'), handled = new Set();
      for (const m of src.matchAll(/case (['"])(.)\1:/g)) handled.add(m[2]);
      for (const m of src.matchAll(/ch === (['"])(.)\1/g)) handled.add(m[2]);
      const plain = src.match(/const PLAIN = \[([^\]]*)\]/);
      assert.ok(plain, `${v} does not list its plain-floor tiles in const PLAIN`);
      for (const m of plain[1].matchAll(/(['"])(.)\1/g)) handled.add(m[2]);
      const missing = kinds.filter(k => !handled.has(k));
      assert.deepEqual(missing, [], `${v} has no drawing for these tiles`);
    }
  });
};
