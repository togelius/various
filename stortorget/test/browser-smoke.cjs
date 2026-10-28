"use strict";

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const assert = require("assert/strict");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (_) {
  console.error("Browser smoke tests need Playwright: npm install --no-save playwright && npx playwright install chromium");
  process.exit(1);
}

const root = path.resolve(__dirname, "..");
const artifacts = process.env.STORTORGET_SCREENSHOTS || path.join(os.tmpdir(), "stortorget-smoke");
fs.mkdirSync(artifacts, { recursive: true });
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };

const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  const relative = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep)) {
    response.writeHead(403).end();
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
    response.end(data);
  });
});

async function launch() {
  try {
    return await chromium.launch({ headless: true });
  } catch (_) {
    return chromium.launch({
      headless: true,
      executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    });
  }
}

function watch(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

async function openGame(page, baseUrl, mode = null) {
  if (mode) await page.addInitScript((value) => localStorage.setItem("stortorget-mode", value), mode);
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.stortorget?.ready);
  await page.click("#start-game");
}

async function canvasPoint(page, x, y) {
  return page.evaluate(({ x, y }) => {
    const point = window.stortorget.worldToScreen({ x, y });
    const rect = document.getElementById("game-canvas").getBoundingClientRect();
    return { x: point.x + rect.left, y: point.y + rect.top };
  }, { x, y });
}

async function desktop(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = watch(page);
  // Skånska keeps the slowing fika, so the Danes still thank us for the coffee.
  await openGame(page, baseUrl, "skanska");
  assert.equal(await page.evaluate(() => window.stortorget.mode), "skanska");
  await page.click('[data-tower="falafel"]');
  for (const [x, y] of [[277, 288], [211, 235]]) {
    const point = await canvasPoint(page, x, y);
    await page.mouse.click(point.x, point.y);
  }
  assert.equal(await page.evaluate(() => window.stortorget.game.towers.length), 2);
  assert.equal(await page.evaluate(() => {
    const { game, levels } = window.stortorget;
    return game.money === game.config.startingMoney - 2 * levels.TOWER_TYPES.falafel.cost;
  }), true);
  let point = await canvasPoint(page, 277, 288);
  await page.mouse.click(point.x, point.y);
  await page.click("#target-button");
  assert.equal(await page.evaluate(() => window.stortorget.game.towers[0].targetMode), "strong");
  await page.click("#upgrade-button");
  assert.equal(await page.evaluate(() => window.stortorget.game.towers[0].level), 2);
  await page.click("#close-selection");
  await page.click("#next-wave");
  await page.click("#fika-button");
  await page.waitForFunction(() => window.stortorget.effects.quips.some((text) => text.includes("kaffe") || text.includes("Kaffe")));
  await page.click("#pause-button");
  await page.evaluate(() => {
    for (let second = 0; second < 120; second += 1) {
      window.stortorget.step(1);
      if (window.stortorget.game.currentWave === 1 && window.stortorget.game.phase === "intermission") break;
    }
  });
  assert.equal(await page.evaluate(() => window.stortorget.game.phase), "intermission");
  assert.equal(await page.evaluate(() => window.stortorget.game.stats.kills), 8);
  assert.deepEqual(errors, []);
  await context.close();
  return { construction: true, upgrade: true, fikaSpeech: true, firstWave: true, errors };
}

async function combat(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = watch(page);
  await openGame(page, baseUrl);
  await page.evaluate(() => {
    const api = window.stortorget;
    const game = api.game;
    game.currentWave = 5;
    game.phase = "intermission";
    game.intermission = 20;
    game.money = 1000;
    for (const [pad, type] of [["sq-se", "bulle"], ["sq-nw", "bulle"], ["sq-ne", "espresso"], ["sq-sw", "vind"], ["soder-north", "falafel"]]) {
      const result = game.buildTower(pad, type);
      if (!result.ok) throw new Error(result.reason);
      game.upgradeTower(result.tower.id);
    }
  });
  await page.click("#next-wave");
  await page.click("#speed-button");
  await page.waitForFunction(() => window.stortorget.game.stats.kills >= 3, undefined, { timeout: 30000 });
  await page.waitForFunction(() => window.stortorget.game.stats.shotsByType.vind > 0, undefined, { timeout: 30000 });
  await page.waitForFunction(() => window.stortorget.effects.quips.length > 0);
  await page.waitForFunction(() => window.stortorget.effects.shake > 0, undefined, { timeout: 10000 });
  const result = await page.evaluate(() => {
    const api = window.stortorget;
    return {
      wave: api.game.currentWave,
      shots: api.game.stats.shotsByType,
      multiplier: Math.max(...api.game.towers.map((tower) => api.game.getFireRateMultiplier(tower))),
      effects: api.effects,
    };
  });
  assert.equal(result.wave, 6);
  assert.ok(result.shots.bulle > 0);
  assert.ok(result.shots.vind > 0);
  assert.ok(result.multiplier > 1);
  assert.ok(result.effects.particles > 0);
  assert.ok(result.effects.shake > 0);
  assert.ok(result.effects.quips.length > 0);
  assert.equal(new Set(result.effects.quips).size, result.effects.quips.length, "Simultaneous quips should vary");
  await page.screenshot({ path: path.join(artifacts, "desktop-combat.png"), fullPage: true });
  await page.click('[data-tower="falafel"]');
  const buildPoint = await canvasPoint(page, 313, 217);
  await page.mouse.click(buildPoint.x, buildPoint.y);
  assert.equal(await page.evaluate(() => window.stortorget.game.towers.length), 6, "Placement stays accurate during shake");
  assert.deepEqual(errors, []);
  await context.close();
  return { ...result, errors };
}

async function mobile(browser, baseUrl, viewport, name) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = watch(page);
  await openGame(page, baseUrl);
  await page.tap('[data-tower="falafel"]');
  const point = await canvasPoint(page, 277, 288);
  await page.touchscreen.tap(point.x, point.y);
  assert.equal(await page.evaluate(() => window.stortorget.game.towers.length), 1);
  const before = await page.evaluate(() => window.stortorget.camera.scale);
  const rect = await page.locator("#game-canvas").boundingBox();
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx - 25, y: cy, id: 1 }, { x: cx + 25, y: cy, id: 2 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: cx - 55, y: cy, id: 1 }, { x: cx + 55, y: cy, id: 2 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const after = await page.evaluate(() => window.stortorget.camera.scale);
  assert.ok(after > before * 1.3);
  await page.tap("#zoom-fit");
  await page.tap("#next-wave");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(artifacts, `${name}.png`), fullPage: true });
  const metrics = await page.evaluate(() => {
    const canvas = document.getElementById("game-canvas").getBoundingClientRect();
    const controls = document.getElementById("controls").getBoundingClientRect();
    return {
      viewport: [innerWidth, innerHeight],
      scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      canvas: [canvas.width, canvas.height],
      controlsBottom: controls.bottom,
      cards: document.querySelectorAll(".tower-card").length,
    };
  });
  assert.equal(metrics.cards, 5);
  assert.ok(metrics.scroll[0] <= viewport.width);
  assert.ok(metrics.scroll[1] <= viewport.height + 1);
  assert.ok(metrics.canvas[1] > 200);
  assert.ok(metrics.controlsBottom <= viewport.height + 1);
  assert.deepEqual(errors, []);
  await context.close();
  return { ...metrics, pinch: [before, after], errors };
}

async function landmarks(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = watch(page);
  await openGame(page, baseUrl, "skanska");
  await page.click('[data-tower="espresso"]');
  const point = await canvasPoint(page, 177, 344);
  await page.mouse.click(point.x, point.y);
  await page.mouse.click(point.x, point.y);
  assert.ok(await page.locator("#selection-landmark").textContent());
  assert.match(await page.locator("#selection-landmark").textContent(), /Lilla Torg/);
  assert.ok(await page.evaluate(() => window.stortorget.game.getTowerStats(window.stortorget.game.towers[0]).haste > 0.16));
  assert.equal(await page.locator("#target-button").isVisible(), false, "Support carts do not need target priorities");
  await page.click("#close-selection");
  await page.evaluate(() => {
    const game = window.stortorget.game;
    game.currentWave = 4;
    game.phase = "intermission";
    game.intermission = 20;
  });
  await page.click("#next-wave");
  await page.waitForFunction(() => window.stortorget.game.enemies.filter((enemy) => enemy.train).length === 3);
  assert.ok(await page.evaluate(() => window.stortorget.game.getNextTrainArrival()));
  assert.match(await page.locator("#toast").textContent(), /Tåg|train/i);
  await page.screenshot({ path: path.join(artifacts, "landmarks.png"), fullPage: true });
  assert.deepEqual(errors, []);
  await context.close();
  return { cafeBoost: true, trainBatch: true, errors };
}

async function bossPhase(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = watch(page);
  await openGame(page, baseUrl, "american");
  await page.evaluate(() => {
    const api = window.stortorget;
    const game = api.game;
    game.currentWave = 8;
    game.phase = "wave";
    game.spawnQueue = [];
    game.spawnEnemy({ routeId: "centralen", typeId: "boss" });
    const boss = game.enemies[0];
    boss.hp = boss.maxHp * 0.6;
    game.damageEnemy(boss, boss.maxHp * 0.1, "falafel");
    api.step(0.01);
  });
  assert.equal(await page.evaluate(() => window.stortorget.game.enemies[0].bossPhase), "telegraph");
  assert.ok(await page.locator("#wave-banner").evaluate((node) => node.classList.contains("visible")));
  assert.match(await page.locator("#wave-banner-title").textContent(), /charge|Dannebrog/i);
  await page.screenshot({ path: path.join(artifacts, "boss-telegraph.png"), fullPage: true });
  await page.evaluate(() => window.stortorget.step(2.3));
  assert.equal(await page.evaluate(() => window.stortorget.game.enemies[0].bossPhase), "charge");
  assert.deepEqual(errors, []);
  await context.close();
  return { telegraph: true, charge: true, errors };
}

async function directFile(browser) {
  const page = await browser.newPage();
  const errors = watch(page);
  await page.goto(`file://${path.join(root, "index.html")}`);
  await page.waitForFunction(() => window.stortorget?.ready);
  assert.ok(await page.locator("#intro-modal").isVisible());
  assert.deepEqual(errors, []);
  await page.close();
  return { loaded: true, errors };
}

async function fullGame(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = watch(page);
  await openGame(page, `file://${path.join(root, "index.html")}`);
  await page.click("#pause-button");
  const result = await page.evaluate(() => {
    const api = window.stortorget;
    const game = api.game;
    const order = [["sq-se", "falafel"], ["sq-ne", "falafel"], ["sq-nw", "falafel"], ["sq-sw", "falafel"]];
    for (let iteration = 0; iteration < 700 && !["won", "lost"].includes(game.phase); iteration += 1) {
      if (["ready", "intermission"].includes(game.phase)) {
        for (const [pad, type] of order) {
          if (!game.towers.some((tower) => tower.padId === pad) && game.money >= api.levels.TOWER_TYPES[type].cost) game.buildTower(pad, type);
        }
        let upgraded = true;
        while (upgraded) {
          upgraded = false;
          for (const tower of game.towers) {
            const cost = game.getUpgradeCost(tower);
            if (cost !== null && game.money >= cost) {
              game.upgradeTower(tower.id);
              upgraded = true;
              break;
            }
          }
        }
        game.startWave();
      }
      if (game.phase === "wave" && game.enemies.length && game.fikaCooldown <= 0) game.useFika();
      api.step(1);
    }
    return { phase: game.phase, wave: game.currentWave, health: game.health, kills: game.stats.kills, leaks: game.stats.leaks, bossPhases: game.stats.bossPhases, bossKills: game.stats.bossKills };
  });
  assert.equal(result.phase, "won");
  assert.equal(result.wave, 8);
  assert.ok(result.bossPhases >= 1, "The boss should telegraph a phase");
  assert.equal(result.bossKills, 1);
  await page.waitForTimeout(650);
  assert.ok(await page.locator("#end-modal").isVisible());
  assert.equal(await page.locator("#end-title").textContent(), "Stortorget stands!");
  assert.ok(await page.locator("#endless-game").isVisible(), "Winning offers endless mode");
  assert.ok(await page.locator("#battle-report").isVisible());
  await page.click("#report-title");
  assert.equal(await page.locator("#report-details").evaluate((node) => node.open), true);
  assert.ok(await page.locator("#report-towers li").count() > 0);
  assert.equal(await page.locator("#report-map").evaluate((node) => node.width), 503);
  await page.screenshot({ path: path.join(artifacts, "victory.png"), fullPage: true });
  await page.click("#restart-game");
  assert.equal(await page.evaluate(() => window.stortorget.game.currentWave), 0);
  assert.equal(await page.evaluate(() => window.stortorget.game.towers.length), 0);
  assert.equal(await page.evaluate(() => window.stortorget.effects.quips.length), 0);
  assert.deepEqual(errors, []);
  await page.close();
  return { ...result, restart: true, errors };
}

(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const browser = await launch();
  try {
    const report = { baseUrl };
    report.directFile = await directFile(browser);
    report.fullGame = await fullGame(browser);
    report.desktop = await desktop(browser, baseUrl);
    report.combat = await combat(browser, baseUrl);
    report.landmarks = await landmarks(browser, baseUrl);
    report.bossPhase = await bossPhase(browser, baseUrl);
    report.mobile = await mobile(browser, baseUrl, { width: 390, height: 844 }, "iphone");
    report.smallMobile = await mobile(browser, baseUrl, { width: 360, height: 640 }, "small-phone");
    report.screenshots = artifacts;
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
