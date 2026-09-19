// Replay an action sequence in the ORIGINAL PuzzleScript engine and report
// whether it wins.
//
// Everything upstream of this -- solving, the depth metrics, the archive --
// runs on the C++ port of the engine. That port is fast and is what makes the
// search affordable, but a claim that a generated game is solvable is only
// worth as much as the engine that checked it. This replays a solution in the
// JavaScript engine the language is actually defined by, so the two can be
// held against each other.
//
//   echo '{"text": "...", "level": 0, "actions": [0,1,2]}' \
//     | node tools/replay_cli.js <path-to-engine.js>
//
// Actions use the JavaScript engine's own numbering (up, left, down, right,
// action), which is the numbering the C++ solver returns and NOT PuzzleJAX's.
const fs = require('fs');
const engine = require(process.argv[2]);

function main() {
  const req = JSON.parse(fs.readFileSync(0, 'utf8'));
  const level = req.level | 0;
  const actions = req.actions || [];
  try {
    // compile(["loadLevel", n]) starts the engine on that level
    engine.compile(['loadLevel', level], req.text);
  } catch (e) {
    process.stdout.write(JSON.stringify({ ok: false, error: String((e && e.message) || e) }));
    return;
  }
  if (engine.getWinning()) {
    process.stdout.write(JSON.stringify({ ok: true, won: true, steps: 0, note: 'won before any move' }));
    return;
  }
  let steps = 0;
  let won = false;
  try {
    for (const a of actions) {
      engine.processInput(a);
      // a rule with `again` keeps ticking until the board settles
      let guard = 0;
      while (engine.getAgaining() && guard++ < 200) engine.processInput(-1);
      steps++;
      if (engine.getWinning()) { won = true; break; }
    }
  } catch (e) {
    process.stdout.write(JSON.stringify({
      ok: false, error: String((e && e.message) || e), steps,
    }));
    return;
  }
  process.stdout.write(JSON.stringify({ ok: true, won, steps }));
}

main();
