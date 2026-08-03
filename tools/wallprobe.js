/* Does an opposing-wall chimney climb work with the inputs a person would
 * actually use?
 *
 * The old cling rule held the wall only while the stick was pushed *into* it,
 * which meant a chimney asked for a direction reversal on the exact frame of
 * every kick - and the kick throws you at the far wall, so the stick is
 * already pointing the wrong way when you arrive. This finds a real shaft in
 * the level, drops the player in at the bottom, and climbs it three ways:
 *
 *   react   - press into whichever wall the game says you are clinging to,
 *             and otherwise at the wall you are flying toward. Under the old
 *             rule this can never start: the cling is the thing that tells you
 *             which way to press, and pressing is what creates the cling.
 *   neutral - no direction at all, just jump whenever the wall is there
 *   hold    - hold one direction for the whole climb
 *
 *   node tools/wallprobe.js [--stage=N]
 */
const { chromium } = require('playwright');
const path = require('path');

const PROBE = async ({ stage, style }) => {
  const g = VZ.game;
  VZ.audio.enabled = false;
  if (VZ.audio.stopSong) VZ.audio.stopSong();
  if (g.loop) g.loop.stop();
  g.fade = 0; g.fadeTarget = 0; g.fadeCb = null;
  g.lives = 9; g.player = null;
  g.loadStage(stage, false);
  g.setState('play');

  const T = VZ.TILE, lv = g.level;
  const solid = (tx, ty) => lv.rectSolid(tx * T + 1, ty * T + 1, T - 2, T - 2);

  /* Find the tallest two-tile-wide shaft with solid walls on both sides. That
   * is what a chimney is, whichever stage we are handed. */
  let bestShaft = null;
  for (let wide = 2; wide <= 5; wide++) {
    for (let tx = 1; tx < lv.w - wide - 1; tx++) {
      let run = 0;
      for (let ty = 0; ty < lv.h; ty++) {
        let open = true;
        for (let k = 0; k < wide; k++) if (solid(tx + k, ty)) open = false;
        const walls = solid(tx - 1, ty) && solid(tx + wide, ty);
        if (open && walls) {
          run++;
          if (!bestShaft || run > bestShaft.run) {
            bestShaft = { tx: tx, tyBottom: ty, run: run, wide: wide };
          }
        } else run = 0;
      }
    }
  }
  if (!bestShaft) return { error: 'no shaft found' };

  const p = g.player;
  // Against the left wall at the foot of the shaft - the way you arrive in one.
  p.x = bestShaft.tx * T + p.w / 2 + 1;
  p.y = (bestShaft.tyBottom - 1) * T;
  p.vx = 0; p.vy = 0; p.hp = p.maxHp;
  g.camera.follow(p, true);
  const start = p.y;

  let best = p.y, kicks = 0, frames = 0, aim = 0, jumpHeld = false;
  const trace = [];
  while (frames < 420) {
    const wall = p.wallDir || (p.wallCoyote > 0 ? p.lastWall : 0);
    const inp = {};
    if (style === 'hold') inp.right = true;
    else if (style === 'react') {
      // Point at the wall we are on; while airborne, at the one we are flying at.
      const want = p.wallDir || aim;
      if (want > 0) inp.right = true; else if (want < 0) inp.left = true;
    }
    // The jump has to be released between kicks or the poll never sees a new
    // press, exactly as a thumb has to come off the button.
    if ((wall !== 0 || p.grounded) && p.vy > -1.5 && !jumpHeld) {
      inp.jump = true; jumpHeld = true;
      if (wall !== 0) { aim = -wall; kicks++; }
    } else jumpHeld = false;
    VZ.input.virtual = inp;
    g.update();
    frames++;
    if (p.y < best) best = p.y;
    if (frames % 10 === 0) {
      trace.push(Math.round(start - p.y) + '/' + p.wallDir + (p.grounded ? 'g' : ''));
    }
    if (p.dead || p.y < (bestShaft.tyBottom - bestShaft.run) * T) break;
  }
  VZ.input.virtual = {};
  return {
    shaftPx: Math.round(bestShaft.run * T), wide: bestShaft.wide,
    climbed: Math.round(start - best),
    kicks: kicks, dead: p.dead, frames: frames, trace: trace
  };
};

function arg(n, d) {
  const a = process.argv.find(s => s.startsWith('--' + n + '='));
  return a ? a.split('=')[1] : d;
}

async function main() {
  const stage = parseInt(arg('stage', '0'), 10);
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage({ viewport: { width: 500, height: 320 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.resolve('index.html'));
  await page.waitForFunction('window.VZ && window.VZ.game');
  await page.waitForTimeout(300);

  console.log('stage ' + (stage + 1) + ' - tallest shaft, climbed by input style');
  for (const style of ['react', 'neutral', 'hold']) {
    const r = await page.evaluate(PROBE, { stage, style });
    if (r.error) { console.log('  ' + r.error); break; }
    console.log('  ' + style.padEnd(8) + String(r.climbed).padStart(4) + ' of ' +
      String(r.shaftPx).padStart(4) + ' px (' + r.wide + ' tiles wide)' +
      ('  ' + r.kicks + ' kicks').padStart(12) + '  ' + r.trace.slice(0, 14).join(' ') +
      (r.dead ? '   (died)' : ''));
  }
  if (errors.length) console.log('errors: ' + [...new Set(errors)].join(' | '));
  await browser.close();
}

main();
