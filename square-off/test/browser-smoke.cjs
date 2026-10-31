"use strict";
// Browser smoke test: boots index.html from file:// in headless Chromium (SwiftShader WebGL),
// checks for page errors, that a Quick Play match ticks, and saves screenshots to .shots/.
// Run: npm i --no-save playwright && npm run test:browser
const fs = require("fs");
const path = require("path");
const assert = require("assert/strict");

let chromium;
try { ({ chromium } = require("playwright")); }
catch (_) {
  console.error("Browser smoke tests need Playwright: npm install --no-save playwright && npx playwright install chromium");
  process.exit(1);
}

const root = path.resolve(__dirname, "..");
const shots = path.join(root, ".shots");
fs.mkdirSync(shots, { recursive: true });

async function launch() {
  const args = ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--mute-audio"];
  try { return await chromium.launch({ headless: true, args }); }
  catch (err) {
    // fall back to any cached headless shell, then to system Chrome
    const cache = path.join(require("os").homedir(), "Library/Caches/ms-playwright");
    if (fs.existsSync(cache)) {
      for (const d of fs.readdirSync(cache).filter((n) => n.startsWith("chromium_headless_shell")).sort().reverse()) {
        const exe = path.join(cache, d, "chrome-headless-shell-mac-arm64", "chrome-headless-shell");
        if (fs.existsSync(exe)) return chromium.launch({ headless: true, args, executablePath: exe });
      }
    }
    return chromium.launch({ headless: true, args, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  }
}

(async () => {
  const browser = await launch();
  let failed = false;
  for (const vp of [{ name: "desktop", width: 1280, height: 800 }, { name: "phone", width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.goto("file://" + path.join(root, "index.html") + "?quick&crew=pack");
    await page.waitForFunction(() => window.SQ && SQ.game && SQ.game.match && SQ.game.match.state.t > 2, null, { timeout: 30000 });
    const info = await page.evaluate(() => ({ t: SQ.game.match.state.t, units: SQ.game.match.state.units.n, lms: SQ.game.match.state.landmarks.length }));
    await page.screenshot({ path: path.join(shots, `smoke-${vp.name}.png`) });
    try {
      assert.ok(info.units >= 10, "units spawned");
      assert.equal(info.lms, 13, "11 landmarks + 2 Home Spots");
      assert.deepEqual(errors, [], "no page errors");
      console.log(`✓ ${vp.name}: match running (t=${info.t.toFixed(1)}s, ${info.units} units)`);
    } catch (err) {
      failed = true;
      console.error(`✗ ${vp.name}:`, err.message, errors.slice(0, 5));
    }
    await page.close();
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
