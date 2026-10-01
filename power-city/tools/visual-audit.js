/* POWER CITY - visual audit.
 *
 * The machine cannot see, so it measures: pose a fight on every stage,
 * render it twice (with and without the actors), and compute what an eye
 * would care about - figure-ground contrast, silhouette crispness, floor
 * luminance, palette richness, background busy-ness. Run before and after
 * an art change and read the numbers.
 *
 * usage: node tools/visual-audit.js <outdir>
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const out = process.argv[2] || '/tmp/pc-visual';
  fs.mkdirSync(out, { recursive: true });
  const root = path.resolve(__dirname, '..');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 420, height: 340 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  await page.goto('file://' + path.join(root, 'index.html'));
  await page.waitForTimeout(800);

  const report = await page.evaluate(() => {
    const PC = window.PC, W = PC.world;
    PC.audio.enabled = false;
    PC.game.loop.stop();
    PC.input.poll = function () { };

    function luma(d, i) { return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; }

    function frame() {
      PC.game.render();
      return PC.Screen.ctx.getImageData(0, 0, PC.W, PC.H).data;
    }

    const results = {};
    for (let s = 0; s < PC.STAGES.length; s++) {
      PC.game.coin(); PC.game.startGame(0);
      PC.game.stageIndex = s;
      PC.stage.load(s);
      PC.game.setState('play');
      const p = PC.game.players[0];
      p.reviveAt(190, PC.FLOOR_BOT - 16); p.invuln = 0; p.facing = 1;
      W.add(p);
      W.camX = 200; PC.stage.locked = true; PC.stage.lockX = 200;
      // a posed fight: brawler walking, punk mid-jab, rough airborne, brute
      // walking behind, one dizzy, a crate, a bat on the ground
      const es = [];
      es.push(PC.spawnEnemy('punk', 300, PC.FLOOR_BOT - 20, { facing: -1 }));
      es.push(PC.spawnEnemy('rough', 380, PC.FLOOR_BOT - 44, { facing: -1 }));
      es.push(PC.spawnEnemy('brute', 130, PC.FLOOR_TOP + 16, { facing: 1 }));
      es.push(PC.spawnEnemy('batter', 340, PC.FLOOR_TOP + 22, { facing: -1 }));
      for (const e of es) e.control = function () { this.vx = 0; this.vy = 0; };
      es[0].facing = -1; es[0].startAttack(PC.ENEMY_MOVES.jab); es[0].atkT = 10;
      es[1].vz = 3.2; es[1].z = 20; es[1].setState('jump');
      es[2].setState('walk'); es[2].anim = 21;
      es[3].stunned = 1; es[3].dizzyT = 500; es[3].setState('dizzy');
      p.setState('walk'); p.anim = 13;
      PC.items.spawn('prop', 'crate', 260, PC.FLOOR_BOT - 34);
      PC.items.spawn('weapon', 'bat', 120, PC.FLOOR_TOP + 10);
      PC.fx.reset();

      const A = frame();                      // full scene
      // hide everything that acts and re-render the bare street
      const hidden = [];
      for (const a of W.actors) if (!a.removed) { a.removed = true; hidden.push(a); }
      const itemsHidden = [];
      for (const it of W.items) if (!it.dead) { it.dead = true; itemsHidden.push(it); }
      PC.fx.reset();
      const B = frame();                      // background only
      for (const a of hidden) a.removed = false;
      for (const it of itemsHidden) it.dead = false;

      // ---- metrics
      const FY = PC.FIELD_Y, FB = PC.FIELD_BOT, FT = PC.FLOOR_TOP, FBot = PC.FLOOR_BOT;
      let maskCount = 0, contrastSum = 0, contrastMin = 999, outlineCount = 0;
      const histo = {};
      for (let y = FY; y < FB; y++) {
        for (let x = 0; x < PC.W; x++) {
          const i = (y * PC.W + x) * 4;
          const dl = Math.abs(luma(A, i) - luma(B, i));
          if (dl > 10) {
            maskCount++;
            contrastSum += dl;
            if (dl < contrastMin) contrastMin = dl;
            if (luma(A, i) < 45) outlineCount++;
          } else if (y >= FT && y < FBot) {
            const c = (B[i] << 16) | (B[i + 1] << 8) | B[i + 2];
            histo[c] = (histo[c] || 0) + 1;
          }
        }
      }
      // floor luminance (background frame)
      let fl = 0, fn = 0;
      for (let y = FT; y < FBot; y++) for (let x = 0; x < PC.W; x++) {
        fl += luma(B, (y * PC.W + x) * 4); fn++;
      }
      // wall busy-ness: mean adjacent-pixel difference in the wall band
      let busy = 0, bn = 0;
      for (let y = FY + 2; y < FT; y++) for (let x = 1; x < PC.W; x++) {
        const i = (y * PC.W + x) * 4, j = i - 4;
        busy += Math.abs(luma(B, i) - luma(B, j)); bn++;
      }
      // palette richness across the whole frame
      const colors = {};
      for (let i = 0; i < A.length; i += 4) {
        const c = (A[i] << 16) | (A[i + 1] << 8) | A[i + 2];
        colors[c] = (colors[c] || 0) + 1;
      }
      // worst-case figure-ground: share of sprite pixels barely above bg
      let faint = 0;
      for (let y = FY; y < FB; y++) for (let x = 0; x < PC.W; x++) {
        const i = (y * PC.W + x) * 4;
        const dl = Math.abs(luma(A, i) - luma(B, i));
        if (dl > 10 && dl < 25) faint++;
      }

      results[PC.stage.def.name] = {
        figureContrast: +(contrastSum / Math.max(1, maskCount)).toFixed(1),
        faintPct: +(100 * faint / Math.max(1, maskCount)).toFixed(1),
        outlinePct: +(100 * outlineCount / Math.max(1, maskCount)).toFixed(1),
        floorLum: +(fl / fn).toFixed(1),
        wallBusy: +(busy / bn).toFixed(2),
        colors: Object.keys(colors).length,
        spritePx: maskCount
      };
      // save the pair for human eyes
      PC.game.render();
    }
    return results;
  });

  console.log(JSON.stringify(report, null, 1));
  const totals = Object.keys(report).reduce((t, k) => {
    for (const m in report[k]) t[m] = (t[m] || 0) + report[k][m];
    return t;
  }, {});
  const n = Object.keys(report).length;
  console.log('\n--- means over stages ---');
  for (const m of ['figureContrast', 'faintPct', 'outlinePct', 'floorLum', 'wallBusy', 'colors']) {
    console.log(m.padEnd(16), (totals[m] / n).toFixed(2));
  }
  if (errs.length) { console.log('ERRORS:', errs.join(' | ')); process.exitCode = 1; }
  else console.log('no errors');
  await browser.close();
})();