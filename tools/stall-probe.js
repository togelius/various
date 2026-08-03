/* When the agent times out without dying, it is hesitating somewhere. This
 * runs one stage and samples position, live enemy count and plan-queue depth
 * every 15 frames, then prints the samples inside one section, so a stall
 * shows up as a run of identical x values.
 *
 *   node tools/stall-probe.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const AGENT_SRC = ['sim.js', 'plan.js', 'world.js', 'pilot.js']
  .map(f => fs.readFileSync(path.join(__dirname, 'agent', f), 'utf8')).join('\n');

const RUN = async ({ seconds }) => {
  const g = VZ.game;
  VZ.audio.enabled = false;
  if (VZ.audio.stopSong) VZ.audio.stopSong();
  if (g.loop) g.loop.stop();
  g.fade = 0; g.fadeTarget = 0; g.fadeCb = null;
  g.lives = 9; g.player = null;
  g.loadStage(2, false);
  g.player.unlocked = [true, true, true];
  g.setState('play');
  const pilot = new AGENT.Pilot(g, {});
  const samples = [];
  let frames = 0;
  while (frames < seconds * 60) {
    if (g.fadeCb && Math.abs(g.fade - g.fadeTarget) > 0.001) g.fade = g.fadeTarget;
    pilot.tick(); g.update(); frames++;
    if (frames % 15 === 0 && g.player) {
      samples.push([frames, Math.round(g.player.x), Math.round(g.player.y),
        g.enemies.length, pilot.queue.length]);
    }
    if (g.stageIndex !== 2 || g.state === 'results' || g.state === 'ending') break;
    if (frames % 20000 === 0) await new Promise(r => setTimeout(r, 0));
  }
  return { frames, samples, sectionFrames: pilot.tele.sectionFrames };
};

async function main() {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage({ viewport: { width: 500, height: 320 } });
  page.on('pageerror', e => console.log('ERR ' + e.message));
  await page.goto('file://' + path.resolve('index.html'));
  await page.waitForFunction('window.VZ && window.VZ.game');
  await page.waitForTimeout(300);
  await page.addScriptTag({ content: AGENT_SRC });
  const r = await page.evaluate(RUN, { seconds: 250 });
  console.log('frames ' + r.frames);
  console.log(JSON.stringify(r.sectionFrames));
  // Only the samples inside section 2 (Void ascent): tiles 64..95 => x 1024..1535
  const s2 = r.samples.filter(s => s[1] >= 64 * 16 && s[1] < 96 * 16);
  console.log('samples in void ascent: ' + s2.length);
  for (let i = 0; i < s2.length; i += 8) console.log('  ' + s2[i].join('\t'));
  await browser.close();
}
main();
