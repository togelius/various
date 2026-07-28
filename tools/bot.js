/* Traversal check: a heuristic bot plays a stage with the real physics and
 * reports how far it gets, where it stalls, and where it dies.
 *   node tools/bot.js <stageIndex> [seconds] [outdir]
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const STAGE = parseInt(process.argv[2] || '0', 10);
const SECONDS = parseInt(process.argv[3] || '75', 10);
const OUT = process.argv[4] || '/tmp/vzbot';
fs.mkdirSync(OUT, { recursive: true });

const BOT = function () {
  const g = window.VZ.game;
  if (g._botInstalled) return;
  g._botInstalled = true;
  window._bot = { frame: 0, maxX: 0, stalls: [], deaths: [], lastX: 0, stuck: 0, jumpHold: 0, dashCd: 0 };

  const orig = g.update.bind(g);
  g.update = function () {
    const b = window._bot;
    const p = g.player, lv = g.level;
    b.frame++;
    if (g.state === 'play' && p && !p.dead && !g.paused) {
      const T = 16;
      const standable = (tx, ty) => lv.solidAt(tx, ty) || lv.at(tx, ty) === 2;
      const solid = (tx, ty) => lv.solidAt(tx, ty);
      const hazard = (tx, ty) => { const id = lv.at(tx, ty); return id === 3 || id === 4 || id === 5; };
      const ftx = Math.floor(p.x / T);
      const fty = Math.floor((p.y + p.h / 2 + 2) / T);
      const act = {};

      act.right = true;

      // measure the gap directly ahead of the feet
      let gap = 0;
      for (let i = 1; i <= 7; i++) {
        if (standable(ftx + i, fty) && !hazard(ftx + i, fty)) break;
        gap++;
      }
      // wall directly ahead at body height
      const aX = Math.floor((p.x + p.w / 2 + 3) / T);
      const wallAhead = solid(aX, fty - 1) || solid(aX, fty - 2);
      // hazard right in front on the floor
      const spikeAhead = hazard(ftx + 1, fty) || hazard(ftx + 2, fty);

      if (b.jumpHold > 0) { act.jump = true; b.jumpHold--; }

      if (p.grounded) {
        b.kick = null;
        if (gap >= 1 || wallAhead || spikeAhead) {
          if (b.jumpHold <= 0 && b.frame - (b.lastJump || -99) > 6) {
            b.jumpHold = gap >= 4 ? 14 : (gap >= 2 ? 12 : 9);
            b.lastJump = b.frame;
            if (gap >= 3 && b.dashCd <= 0) { act.dash = true; b.dashCd = 34; }
          }
        }
      } else {
        // Wall-jump chimneys properly: kick off, hold away for the control
        // lock, then steer back into the opposite wall to re-grab it.
        if (p.sliding) {
          b.kick = { dir: -p.wallDir, t: 0 };
          act.jump = true;
          act.right = p.wallDir < 0;
          act.left = p.wallDir > 0;
        } else if (b.kick) {
          b.kick.t++;
          if (b.kick.t < 12) {
            act.right = b.kick.dir > 0; act.left = b.kick.dir < 0;
          } else if (b.kick.t < 30) {
            // reach for the far wall
            act.right = b.kick.dir > 0; act.left = b.kick.dir < 0;
          } else b.kick = null;
        }
        // air-dash across a long gap
        if (gap >= 4 && p.vy > 0 && b.dashCd <= 0) { act.dash = true; b.dashCd = 40; }
      }
      if (b.dashCd > 0) b.dashCd--;

      // shoot constantly (tap so the buster fires instead of charging)
      if (b.frame % 9 < 2) act.fire = true;

      // stuck? try everything
      if (Math.abs(p.x - b.lastX) < 0.35) {
        b.stuck++;
        if (b.stuck === 90) b.stalls.push({ x: Math.round(p.x), y: Math.round(p.y), t: b.frame });
        if (b.stuck > 40) {
          if (b.stuck % 30 < 12) act.jump = true;
          if (b.stuck % 30 === 0) act.dash = true;
          if (b.stuck > 220) { act.right = false; act.left = true; }   // back off and retry
          if (b.stuck > 300) b.stuck = 0;
        }
      } else b.stuck = 0;
      b.lastX = p.x;
      if (p.x > b.maxX) b.maxX = p.x;

      window.VZ.input.virtual = act;
    } else {
      // menus / results / death: press on
      window.VZ.input.virtual = (b.frame % 20 < 6) ? { jump: true } : {};
      if (g.state === 'play' && p && p.dead && b.frame % 40 === 0) {
        b.deaths.push({ x: Math.round(p.x), y: Math.round(p.y) });
      }
    }
    orig();
  };
};

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--disable-gpu']
  });
  const page = await browser.newPage({ viewport: { width: 800, height: 470 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + ' | ' + (e.stack || '').split('\n')[1]));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto('file://' + path.resolve('index.html'));
  await page.waitForFunction('window.VZ && window.VZ.game');
  await page.waitForTimeout(400);
  await page.evaluate((s) => {
    const g = VZ.game;
    g.fade = 0; g.fadeTarget = 0; g.fadeCb = null;
    g.lives = 30;
    g.loadStage(s, false);
    g.player.unlocked = [true, true, true];
    g.setState('play');
  }, STAGE);
  await page.evaluate(BOT);

  const marks = [];
  for (let t = 0; t < SECONDS; t++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => {
      const g = VZ.game, p = g.player, b = window._bot;
      return {
        state: g.state, x: Math.round(p.x), maxX: Math.round(b.maxX),
        hp: p.hp, lives: g.lives, dead: p.dead, stuck: b.stuck,
        boss: g.boss ? g.boss.hp + '/' + g.boss.maxHp : null,
        bossDefeated: !!g.bossDefeated, stalls: b.stalls.length, w: g.level.pixelW
      };
    });
    marks.push(t + 's ' + JSON.stringify(st));
    if (st.state === 'results' || st.state === 'stageIntro' || st.state === 'ending') {
      marks.push('*** REACHED ' + st.state + ' at ' + t + 's ***');
      await page.screenshot({ path: path.join(OUT, 'stage' + STAGE + '_clear.png') });
      break;
    }
    if (st.state === 'gameOver') { marks.push('*** GAME OVER at ' + t + 's ***'); break; }
  }

  const final = await page.evaluate(() => {
    const b = window._bot, g = VZ.game;
    return { maxX: Math.round(b.maxX), width: g.level.pixelW, stalls: b.stalls, deaths: b.deaths.slice(0, 12) };
  });
  await page.screenshot({ path: path.join(OUT, 'stage' + STAGE + '_final.png') });

  console.log(marks.filter((m, i) => i % 5 === 0 || m.startsWith('***')).join('\n'));
  console.log('progress: ' + final.maxX + ' / ' + final.width +
    ' (' + Math.round(100 * final.maxX / final.width) + '%)');
  console.log('stall spots: ' + JSON.stringify(final.stalls));
  console.log('--- errors ---');
  console.log(errors.length ? [...new Set(errors)].slice(0, 8).join('\n') : 'none');
  await browser.close();
})();
