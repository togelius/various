// Compile PuzzleScript text (stdin) with the original engine; print compiled-state JSON.
const fs = require('fs');
const path = process.argv[2];
const engine = require(path);
const text = fs.readFileSync(0, 'utf8');
let errors = [];
try {
  engine.compile(['restart'], text);
  const json = engine.serializeCompiledStateJSON();
  process.stdout.write(JSON.stringify({ ok: true, levels: engine.getNumLevels(), state: JSON.parse(json) }));
} catch (e) {
  process.stdout.write(JSON.stringify({ ok: false, error: String(e && e.message || e) }));
}
