/* Inline the whole game into one self-contained HTML file.
 *
 *   node tools/build-single.js                  -> dist/vanguard-zero.html
 *   node tools/build-single.js --shell=artifact -> dist/vanguard-zero-embed.html
 *
 * The shells live in tools/shell-*.html and carry a <!--BUNDLE--> marker where
 * the concatenated sources go. Script order matters and matches index.html.
 */
const fs = require('fs');
const path = require('path');

const ORDER = [
  'js/core.js', 'js/audio.js', 'js/music.js', 'js/art.js', 'js/sprites.js',
  'js/fx.js', 'js/level.js', 'js/entities.js', 'js/enemies.js', 'js/bosses.js',
  'js/levels.js', 'js/game.js', 'js/touch.js'
];

// The watch shell drives the game with the play agent, so it needs the agent
// sources inlined after the game's.
const AGENT_ORDER = ['tools/agent/sim.js', 'tools/agent/plan.js',
                     'tools/agent/world.js', 'tools/agent/pilot.js'];

const arg = process.argv.find(a => a.startsWith('--shell='));
const shellName = arg ? arg.split('=')[1] : 'standalone';
const outArg = process.argv.find(a => a.startsWith('--out='));

const shellPath = path.join('tools', 'shell-' + shellName + '.html');
if (!fs.existsSync(shellPath)) {
  console.error('no shell at ' + shellPath);
  process.exit(1);
}

const sources = ORDER.concat(shellName === 'watch' ? AGENT_ORDER : []);

const bundle = sources.map(f => {
  const src = fs.readFileSync(f, 'utf8');
  // Guard against a source accidentally containing a closing script tag,
  // which would terminate the inlined <script> early.
  if (/<\/script/i.test(src)) {
    console.error('!! ' + f + ' contains a </script sequence; escape it first');
    process.exit(1);
  }
  return '/* ===== ' + f + ' ===== */\n' + src;
}).join('\n');

let html = fs.readFileSync(shellPath, 'utf8');
if (!html.includes('<!--BUNDLE-->')) {
  console.error('shell is missing the <!--BUNDLE--> marker');
  process.exit(1);
}
// Use a function replacement so $-sequences in the source aren't treated as
// replacement patterns.
html = html.replace('<!--BUNDLE-->', () => bundle);

const out = outArg ? outArg.split('=')[1]
  : path.join('dist', shellName === 'standalone' ? 'vanguard-zero.html'
              : 'vanguard-zero-' + shellName + '.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);

const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log('wrote ' + out + '  (' + kb + ' KB, ' + sources.length + ' sources inlined)');
