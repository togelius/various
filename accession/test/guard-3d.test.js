// The 3D view stays removable in one step (BUILD.md §6.3, §6.1): only the files in
// tools/3d-allowlist.txt may mention it, and the view model has no field that only one
// board view reads. Both tests still pass once tools/remove-3d.sh has run.
module.exports = ({ test, assert, loadCore, root, fs, path }) => {
  const SCAN = ['index.html', 'js', 'css', 'tools', 'test', 'art'];
  const PATTERN = /board3d|Board3D|THREE|x-three|vendor\/three|['"]3d['"]/;
  const walk = rel => {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) return [];
    if (!fs.statSync(abs).isDirectory()) return [rel];
    return fs.readdirSync(abs).filter(n => n !== 'shots' && n !== 'vendor').flatMap(n => walk(rel + '/' + n));
  };

  test('only the allowlisted files mention the 3D view', () => {
    const listFile = path.join(root, 'tools/3d-allowlist.txt');
    const allowed = new Set(fs.existsSync(listFile) ? fs.readFileSync(listFile, 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')) : []);
    allowed.add('test/guard-3d.test.js');
    const stray = SCAN.flatMap(walk).filter(f => /\.(js|mjs|py|sh|html|css|json|txt)$/.test(f))
      .filter(f => !allowed.has(f) && PATTERN.test(fs.readFileSync(path.join(root, f), 'utf8')));
    assert.deepEqual(stray, [], 'these files mention the 3D view but are not in tools/3d-allowlist.txt');
  });

  test('every view-model field read by one board view is read by every board view', () => {
    const { Dept, ViewModel } = loadCore();
    const vm = Object.keys(ViewModel.derive(Dept.create(3, 'M11', 1), {}));
    const views = fs.readdirSync(path.join(root, 'js/view')).map(f => 'js/view/' + f)
      .filter(f => /Views\.register\(/.test(fs.readFileSync(path.join(root, f), 'utf8')));
    assert.ok(views.length >= 1);
    const reads = f => new Set([...fs.readFileSync(path.join(root, f), 'utf8').matchAll(/\b(?:vm|lastVm)\.(\w+)/g)].map(m => m[1]));
    const shared = reads('js/view/marks.js');
    const table = {};
    for (const field of vm) table[field] = views.filter(v => shared.has(field) || reads(v).has(field)).map(v => path.basename(v, '.js'));
    const lopsided = Object.entries(table).filter(([, r]) => r.length > 0 && r.length < views.length);
    assert.deepEqual(lopsided, [], 'fields read by only some board views: ' + JSON.stringify(table));
    // What the board shows (§6.1, and M3's marks, cases, staff doors, items, labels and
    // surfaces) is drawn by every view, not only listed: each of these fields is read by all.
    const drawn = ['tiles', 'vis', 'ring', 'actors', 'marks', 'cues', 'cases', 'staff', 'items', 'plaques', 'surfaces', 'camera', 'path', 'selection', 'selectedTile'];
    const undrawn = drawn.filter(f => !table[f] || table[f].length !== views.length);
    assert.deepEqual(undrawn, [], 'fields of the board that some view does not draw: ' + JSON.stringify(table));
    for (const v of views) for (const f of reads(v)) assert.ok(vm.includes(f), `${v} reads vm.${f}, which the view model does not have`);
  });
};
