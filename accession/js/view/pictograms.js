// ACCESSION — the pictograms (BUILD.md §8.8): fixed 8×8 shapes, so meaning never rests
// on colour alone, each with its reserved colour. Drawn as crisp SVG for the DOM and as
// rectangles on the board canvas.
'use strict';
const Pictograms = (() => {
  // x = the glyph's colour; . = clear.
  const G = {
    // waking
    ring:      ['..xxxx..', '.x....x.', 'x......x', 'x..xx..x', 'x..xx..x', 'x......x', '.x....x.', '..xxxx..'],
    noise:     ['...xx...', '..x..x..', '.x....x.', '.x..x.x.', '.x.xx.x.', '..x.xx..', '...xx...', '..xx....'],
    axis:      ['........', '......x.', 'xxxxxxxx', 'xxxxxxxx', '......x.', '........', '........', '........'],
    period:    ['x.x...x.', 'x.x.x..x', 'x.x..x.x', 'xxx..x.x', '.x..x..x', '.x....x.', '.x......', 'xxx.....'],
    tether:    ['.xx.....', 'x..x....', 'x..x....', '.xxxx...', '...x..x.', '....xx.x', '....x..x', '.....xx.'],
    touch_case:['xxxxxxxx', 'x......x', 'x.xx...x', 'x.xx...x', 'x.xxxx.x', 'x.xxxx.x', 'x..xx..x', 'xxxxxxxx'],
    ally_hit:  ['........', '.xx..xx.', 'x..xx..x', 'x..xx..x', 'x..xx..x', '.xx..xx.', '........', '........'],
    alarm:     ['...xx...', '..xxxx..', '..xxxx..', '.xxxxxx.', '.xxxxxx.', 'xxxxxxxx', '...xx...', '........'],
    awake:     ['........', '..xxxx..', '.x....x.', 'x..xx..x', 'x..xx..x', '.x....x.', '..xxxx..', '........'],
    // the clock (its bell and night watch); the module's chime is 'period', a struck fork
    clock:     ['..xxxx..', '.x....x.', 'x..x...x', 'x..x...x', 'x..xxx.x', 'x......x', '.x....x.', '..xxxx..'],
    // states
    asleep:    ['xxxx....', '...x....', '..x.....', '.x......', 'xxxx.xxx', '.......x', '......x.', '.....xxx'],
    pip:       ['........', '..xxxx..', '.xxxxxx.', '.xxxxxx.', '.xxxxxx.', '.xxxxxx.', '..xxxx..', '........'],
    pip_empty: ['........', '..xxxx..', '.x....x.', '.x....x.', '.x....x.', '.x....x.', '..xxxx..', '........'],
    alert:     ['...xx...', '...xx...', '...xx...', '...xx...', '...xx...', '........', '...xx...', '...xx...'],
    hunting:   ['.xx..xx.', '.xx..xx.', '.xx..xx.', '.xx..xx.', '.xx..xx.', '........', '.xx..xx.', '.xx..xx.'],
    returning: ['....x...', '...xx...', '..xxxxx.', '...xx..x', '....x..x', '.......x', '..xxxxx.', '........'],
    // combat
    heart:     ['........', '.xx..xx.', 'xxxxxxxx', 'xxxxxxxx', '.xxxxxx.', '..xxxx..', '...xx...', '........'],
    acc:       ['...x....', '.xxxxx..', '.x.x.x..', 'xxx.xxx.', '.x.x.x..', '.xxxxx..', '...x....', '........'],
    eva:       ['......xx', '.....xx.', '....xxx.', '...xxx..', '..xxx...', '.xx.....', 'x.......', '........'],
    padding:   ['xxxxxxxx', 'x......x', 'x......x', 'x......x', '.x....x.', '.x....x.', '..x..x..', '...xx...'],
    damage:    ['......xx', '.....xxx', '....xxx.', 'x..xxx..', '.xxxx...', '..xx....', '.x.x....', 'x.......'],
    ranged:    ['........', '.....x..', '......x.', 'xxxxxxxx', '......x.', '.....x..', '........', '........'],
    fast:      ['........', '..xx.xx.', '..xx.xx.', '.xxxxxx.', 'xxxxxx..', '.xxxxx..', '.x...x..', '........'],
    slow:      ['........', '........', '..xxx...', '.x...x..', '.x.x.x..', 'xxxxxxxx', '........', '........'],
    special:   ['...xx...', '..xxxx..', '.xxxxxx.', 'xxxxxxxx', 'xxxxxxxx', '.xxxxxx.', '..xxxx..', '...xx...'],
    // items and places
    seal:      ['..xxxx..', '.xxxxxx.', 'xxx..xxx', 'xx.xx.xx', 'xx.xx.xx', 'xxx..xxx', '.xxxxxx.', '..xxxx..'],
    kit:       ['......xx', '.....xxx', '....xxx.', '...xxx..', '..xx....', '.xxx....', 'xxx.....', 'xx......'],
    certificate:['.xxxxxx.', 'xxx..xxx', 'xx.xx.xx', 'xxx..xxx', '.xxxxxx.', '..x..x..', '.x....x.', '........'],
    highlight: ['...x....', '...x....', '.xxxxx..', '..xxx...', '..x.x...', '.x...x..', '........', '........'],
    grade:     ['.xxx....', 'x...x...', 'x...x...', '.xxx....', '..x.....', '..xxx...', '..x.....', '..xx....'],
    reads:     ['xxxxxxx.', 'x.....xx', 'x.xxx.xx', 'x.....xx', 'x.xx..xx', 'x....xxx', 'xxxxxxx.', '.....xx.'],
    bench:     ['........', '........', 'xxxxxxxx', 'xxxxxxxx', '.x....x.', '.x....x.', '.x....x.', '........'],
    // statuses and surfaces, keyed by their registry ids (Registry.STATUSES, .SURFACES)
    fixed:     ['.xxxxxx.', '..xxxx..', '..xxxx..', '.xxxxxx.', '...xx...', '...xx...', '...xx...', '...x....'],
    rooted:    ['...xx...', '...xx...', '...xx...', '...xx...', '..xxxx..', '.x.xx.x.', 'x..xx..x', '.x.x..x.'],
    coughing:  ['........', '.xx..x.x', 'x..x..x.', 'x..x.x.x', 'x..x....', '.xx.....', '........', '........'],
    restoring: ['...xx...', '...xx...', '...xx...', 'xxxxxxxx', 'xxxxxxxx', '...xx...', '...xx...', '...xx...'],
    slowed:    ['xxxxxxxx', '.x....x.', '..x..x..', '...xx...', '...xx...', '..x..x..', '.x....x.', 'xxxxxxxx'],
    dazed:     ['.x....x.', 'xxx..xxx', '.x....x.', '........', '...x....', '..xxx...', '...x....', '........'],
    fumigant:  ['........', '..xx....', '.xxxx.x.', 'xxxxxxxx', 'xxxxxxxx', '.xxxxxx.', '........', '........'],
    dust:      ['x...x...', '..x...x.', 'x...x...', '..x...x.', 'x...x...', '..x...x.', 'x...x...', '..x...x.'],
  };
  // Each pictogram's colour is a key of the reserved semantic set (BUILD.md §8.8, §9.1):
  // hostile, hazard, readable, item or player. Stat figures are 'readable'.
  const COLOUR = {
    ring: 'hostile', noise: 'hostile', axis: 'hostile', period: 'hostile', tether: 'hostile', touch_case: 'hostile',
    ally_hit: 'hostile', alarm: 'hostile', awake: 'hostile', clock: 'hazard', asleep: 'readable', pip: 'hostile', pip_empty: 'hostile',
    alert: 'hostile', hunting: 'hostile', returning: 'readable', heart: 'hostile', acc: 'readable', eva: 'readable', padding: 'readable',
    damage: 'readable', ranged: 'readable', fast: 'readable', slow: 'readable', special: 'hazard', seal: 'item', kit: 'item',
    certificate: 'item', highlight: 'item', grade: 'readable', reads: 'readable', bench: 'readable',
    // A harmful status, and a surface, is a hazard; restoring is yours.
    fixed: 'hazard', rooted: 'hazard', coughing: 'hazard', restoring: 'player', slowed: 'hazard', dazed: 'hazard', fumigant: 'hazard', dust: 'hazard',
  };
  const colourOf = (id, override) => override || ART.palettes.semantic[COLOUR[id]];

  // An SVG string at `px` CSS pixels.
  function svg(id, px, colour) {
    const g = G[id];
    if (!g) return '';
    let r = '';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (g[y][x] === 'x') r += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    return `<svg class="picto" width="${px}" height="${px}" viewBox="0 0 8 8" shape-rendering="crispEdges" fill="${colourOf(id, colour)}" aria-hidden="true">${r}</svg>`;
  }
  // Draw on a 2D context at (x, y), `px` pixels square.
  function draw(ctx, id, x, y, px, colour) {
    const g = G[id];
    if (!g) return;
    const s = px / 8;
    ctx.fillStyle = colourOf(id, colour);
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) if (g[j][i] === 'x') ctx.fillRect(x + i * s, y + j * s, s, s);
  }
  return { G, COLOUR, svg, draw, ids: Object.keys(G) };
})();
