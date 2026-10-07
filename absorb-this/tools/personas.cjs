#!/usr/bin/env node
'use strict';

// Persona bots: the same body, different desires. In the spirit of procedural personas
// (Holmgård, Liapis, Togelius & Yannakakis), each persona is a small utility policy that
// wants something different from the kitchen: the right tool, the floor, the edge, the
// shelves, nothing at all, or every button at once. They read game state (bounded
// perception: range, view cone, line of sight) and act only through synthetic keyboard
// and mouse events, like tools/playtest.cjs. Telemetry wraps shipping functions without
// changing their behaviour. Screenshots are taken at interesting moments.
//
// node tools/personas.cjs --personas tactician,explorer --seeds 1,2 --out /tmp/personas
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const PERSONAS = ['casual', 'tactician', 'surfer', 'slapstick', 'explorer', 'pacifist', 'masher', 'speedrunner'];
function options(argv) {
  const out = { seeds: [1], personas: ['tactician'], seconds: 900, maxDeaths: 12, shots: 16, out: null,
    browser: process.env.CHROMIUM_PATH || '/usr/bin/chromium', source: null };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--help') { console.log('Usage: node tools/personas.cjs [--personas ' + PERSONAS.join(',') + '] [--seeds 1,2] [--seconds 900] [--max-deaths 12] [--shots 16] [--out DIR] [--source FILE] [--browser PATH] [--ztalk 0|1|2]'); process.exit(0); }
    const value = argv[++i];
    if (value === undefined) throw new Error('Missing value for ' + key);
    if (key === '--seeds') out.seeds = value.split(',').map(Number);
    else if (key === '--personas') out.personas = value.split(',');
    else if (key === '--seconds') out.seconds = Number(value);
    else if (key === '--max-deaths') out.maxDeaths = Number(value);
    else if (key === '--shots') out.shots = Number(value);
    else if (key === '--out') out.out = path.resolve(value);
    else if (key === '--source') out.source = path.resolve(value);
    else if (key === '--browser') out.browser = value;
    else if (key === '--ztalk') out.ztalk = Number(value);
    else throw new Error('Unknown option: ' + key);
  }
  if (out.personas.some(p => !PERSONAS.includes(p))) throw new Error('Unknown persona. Choose from ' + PERSONAS.join(', '));
  return out;
}

// Same deterministic clock as tools/playtest.cjs: seeded Math.random, virtual timers.
function installClock(seed) {
  let rng = seed >>> 0, elapsed = 0, nextId = 1;
  const timers = new Map();
  Math.random = () => { rng += 0x6D2B79F5; let n = Math.imul(rng ^ rng >>> 15, 1 | rng); n ^= n + Math.imul(n ^ n >>> 7, 61 | n); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
  Object.defineProperty(performance, 'now', { value: () => elapsed });
  window.AudioContext = window.webkitAudioContext = undefined;
  window.setTimeout = (fn, ms = 0, ...args) => { if (typeof fn !== 'function') throw new Error('String timer'); const id = nextId++; timers.set(id, { at: elapsed + Math.max(0, ms), fn, args }); return id; };
  window.clearTimeout = id => timers.delete(id);
  window.setInterval = () => nextId++; window.clearInterval = () => {};
  window.__clock = {
    advance(dt) { elapsed += dt * 1000; for (const [id, t] of [...timers]) if (t.at <= elapsed) { timers.delete(id); t.fn(...t.args); } },
    now: () => elapsed / 1000, reseed(v) { rng = v >>> 0; },
  };
}

// Injected inside the game's closure, replacing the boot line.
function botRuntime() {
  const clock = window.__clock, round = n => Math.round(n * 100) / 100, angle = a => Math.atan2(Math.sin(a), Math.cos(a));
  const keyDown = code => { if (!keys[code]) dispatchEvent(new KeyboardEvent('keydown', { code, key: code })); };
  const keyUp = code => { if (keys[code]) dispatchEvent(new KeyboardEvent('keyup', { code, key: code })); };
  const key = (code, down) => down ? keyDown(code) : keyUp(code);
  const tap = (code, k = code) => { dispatchEvent(new KeyboardEvent('keydown', { code, key: k })); dispatchEvent(new KeyboardEvent('keyup', { code, key: k })); };
  const mouse = down => { if (mouseDown === down) return; (down ? cv : window).dispatchEvent(new MouseEvent(down ? 'mousedown' : 'mouseup', { button: 0, bubbles: true })); };
  const HELD = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyC', 'Space', 'ShiftLeft', 'KeyE'];
  const releaseAll = () => { for (const c of HELD) keyUp(c); mouse(false); };

  let R = null;   // the current run
  // ---------------------------------------------------------------- telemetry hooks
  const now = () => clock.now() - R.t0;
  const hook = (get, set, wrap) => { const orig = get(); set(wrap(orig)); };
  let zzKey = null;
  hook(() => zz, f => { zz = f; }, orig => function (k, o) { const was = zzKey; zzKey = k; try { return orig.apply(this, arguments); } finally { zzKey = was; } });
  hook(() => zShow, f => { zShow = f; }, orig => function (text, o) {
    if (R) { const t = R.tele; if (ZZ.on && nowS() < ZZ.hideAt - .3) t.interrupted = (t.interrupted || 0) + 1; t.lines.push({ at: round(now()), key: zzKey, text: String(text).slice(0, 160), len: String(text).length, state }); t.lineCount[text] = (t.lineCount[text] || 0) + 1; }
    return orig.apply(this, arguments);
  });
  hook(() => say, f => { say = f; }, orig => function (text) { if (R) R.tele.announcer++; return orig.apply(this, arguments); });
  hook(() => pop, f => { pop = f; }, orig => function (x, y, z, text) { if (R) { R.tele.pops++; R.tele.popWords[text] = (R.tele.popWords[text] || 0) + 1; } return orig.apply(this, arguments); });
  hook(() => feed, f => { feed = f; }, orig => function (html) { if (R) R.tele.feed.push({ at: round(now()), text: String(html).replace(/<[^>]+>/g, '').slice(0, 120) }); return orig.apply(this, arguments); });
  hook(() => multiText, f => { multiText = f; }, orig => function (t) { if (R) R.tele.banners++; return orig.apply(this, arguments); });
  hook(() => techVariety, f => { techVariety = f; }, orig => function (tech) { const m = orig.apply(this, arguments); if (R) { R.tele.kills[tech] = (R.tele.kills[tech] || 0) + 1; } return m; });
  hook(() => freezeEnemy, f => { freezeEnemy = f; }, orig => function (e) { if (R) { R.tele.freezes++; R.moment('first-freeze', true); } return orig.apply(this, arguments); });
  hook(() => shatterEnemy, f => { shatterEnemy = f; }, orig => function (e) { if (R && !e.dead) { R.tele.shatters++; R.moment('first-shatter', true); } return orig.apply(this, arguments); });
  hook(() => trapInBubble, f => { trapInBubble = f; }, orig => function (e) { if (R) { R.tele.bubbled++; if (e.greasy) R.tele.degreased++; R.moment('first-bubble', true); } return orig.apply(this, arguments); });
  hook(() => chalStart, f => { chalStart = f; }, orig => function () { const r = orig.apply(this, arguments); if (R && chal) R.tele.chal.push({ k: chal.k, at: round(now()), win: null }); return r; });
  hook(() => chalEnd, f => { chalEnd = f; }, orig => function (win) { if (R && R.tele.chal.length) R.tele.chal.at(-1).win = !!win; return orig.apply(this, arguments); });
  hook(() => hurt, f => { hurt = f; }, orig => function (amount, cause) { const hp = P.hp; const r = orig.apply(this, arguments); if (R && P.hp < hp) R.tele.hurt[cause] = round((R.tele.hurt[cause] || 0) + hp - P.hp); return r; });
  hook(() => inspectCurio, f => { inspectCurio = f; }, orig => function () { const c = findCurio(); const r = orig.apply(this, arguments); if (R && r && c && !R.tele.curios.includes(c.id)) { R.tele.curios.push(c.id); R.moment('curio-' + c.id, true); } return r; });
  hook(() => beginReplay, f => { beginReplay = f; }, orig => function (clip) { const r = orig.apply(this, arguments); if (R && state === 'replay') { R.tele.replays.push({ at: round(now()), title: clip.title, wave: clip.wave, skipped: false, seconds: 0 }); R.moment('replay', true, 40); } return r; });
  hook(() => spawnClog, f => { spawnClog = f; }, orig => function () { const r = orig.apply(this, arguments); if (R) { R.tele.clog = { start: round(now()), end: null }; R.moment('clog', true, 90); } return r; });
  hook(() => explode, f => { explode = f; }, orig => function (x, y, z) { const vy = P.vy; const r = orig.apply(this, arguments); if (R && P.vy > vy + 8) R.tele.rocketJumps++; return r; });
  hook(() => killEnemy, f => { killEnemy = f; }, orig => function (e, w, dx, dz, head, fell, source) { const was = e.dead; const r = orig.apply(this, arguments); if (R && !was && e.dead) { R.tele.killTypes[e.type] = (R.tele.killTypes[e.type] || 0) + 1; if (source) R.tele.kitchenKills[source] = (R.tele.kitchenKills[source] || 0) + 1; } return r; });

  // ---------------------------------------------------------------- perception
  function lineOfSight(e) {
    const dx = e.x - P.x, dz = e.z - P.z, dy = e.y + (e.type === 'spoon' || e.type === 'fork' ? 0 : e.h * .55) - P.y - P.eyeH;
    const l = Math.hypot(dx, dy, dz) || 1;
    return rayStatic(P.x, P.y + P.eyeH, P.z, dx / l, dy / l, dz / l, l) >= l - e.r;
  }
  function visible(prof) {
    return enemies.filter(e => {
      if (e.dead) return false;
      const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz);
      if (d < 5) return true;   // you can feel what is touching you
      if (d > prof.range || Math.abs(angle(Math.atan2(-dx, -dz) - P.yaw)) > prof.view) return false;
      return lineOfSight(e);
    }).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z));
  }
  const aimPoint = e => ({ x: e.x, y: e.y + (e.type === 'spoon' || e.type === 'fork' ? 0 : e.h * .55), z: e.z });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  // the nearest way off the counter from a point: a unit vector, or null if the edge is far
  function edgeDir(x, z, reach = 9) {
    let best = null;
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2, ux = Math.cos(a), uz = Math.sin(a);
      for (let s = 1.5; s <= reach; s += 1.5) if (!onCounter(x + ux * s, z + uz * s)) { if (!best || s < best.s) best = { ux, uz, s }; break; }
    }
    return best;
  }

  // ---------------------------------------------------------------- body
  const PROFILES = {
    casual: { reaction: .3, turn: 2.6, error: .045, view: 1.05, range: 38, dash: .12 },
    skilled: { reaction: .14, turn: 4.3, error: .018, view: 1.15, range: 45, dash: .2 },
    masher: { reaction: .15, turn: 6, error: .3, view: 3.2, range: 60, dash: .3 },
  };
  function body() {
    return { move: null, aim: null, fire: false, weapon: null, dash: false, jump: false, puddle: false, e: false, look: null };
  }
  function weaponKey(w) { if (w !== null && w !== P.wNext && P.switchT <= 0) tap('Digit' + (w + 1), String(w + 1)); }
  function act(I, prof, dt) {
    let yaw = P.yaw, pitch = 0;
    if (I.aim) {
      const dx = I.aim.x - P.x, dz = I.aim.z - P.z, err = (R.roll() * 2 - 1) * prof.error;
      yaw = Math.atan2(-dx, -dz) + err; pitch = Math.atan2(I.aim.y - P.y - P.eyeH, Math.hypot(dx, dz)) + err;
    } else if (I.look) { yaw = I.look.yaw; pitch = I.look.pitch; }
    else if (I.move) { yaw = Math.atan2(-I.move[0], -I.move[1]); pitch = 0; }
    const yd = clamp(angle(yaw - P.yaw), -prof.turn * dt, prof.turn * dt), pd = clamp(pitch - P.pitch, -prof.turn * dt, prof.turn * dt);
    dispatchEvent(new MouseEvent('mousemove', { movementX: -yd / sens, movementY: -pd / sens }));
    let f = 0, s = 0;
    if (I.move) { const [mx, mz] = I.move; f = -Math.sin(P.yaw) * mx - Math.cos(P.yaw) * mz; s = Math.cos(P.yaw) * mx - Math.sin(P.yaw) * mz; }
    key('KeyW', f > .3); key('KeyS', f < -.3); key('KeyD', s > .3); key('KeyA', s < -.3);
    key('ShiftLeft', I.dash); key('Space', I.jump); key('KeyC', I.puddle); key('KeyE', I.e);
    weaponKey(I.weapon);
    mouse(!!I.fire && (!I.aim || Math.abs(angle(yaw - P.yaw)) < .2));
  }
  const toward = (x, z) => { const dx = x - P.x, dz = z - P.z, d = Math.hypot(dx, dz); return d > .8 ? [dx / d, dz / d] : null; };

  // ---------------------------------------------------------------- shared behaviours
  function route(M, I) {   // the documented front-lane route; patrol a district while it fights
    const center = CHAPTERS[chapter].x, left = center - 24, right = center + 24;
    if (P.x >= right - 2) M.patrol = -1;
    if (P.x <= left + 2) M.patrol = 1;
    if (M.stuck > 2) { M.patrol *= -1; M.stuck = 0; }
    let d = { x: M.patrol > 0 ? right : left, z: 17 };
    if (chapterClear) {
      if (chapter === 4 && P.x >= 297) d = { x: DRAIN.x, z: DRAIN.z };
      else if (Math.abs(P.z - 17) > 1.5) d = { x: P.x, z: 17 };
      else d = { x: chapter < 4 ? CHAPTERS[chapter + 1].x - 24 : DRAIN.x, z: 17 };
    }
    // blocked on the way (no pathfinding)? sidestep along the counter for a couple of seconds
    if (M.stuck > 1.5 && !(M.side > 0)) { M.side = 2.2; M.sideDir = M.sideDir === 1 ? -1 : 1; }
    if (M.side > 0) { M.side -= R.prof.reaction; I.move = [M.sideDir, d.z > P.z ? .25 : -.25]; return d; }
    I.move = toward(d.x, d.z);
    if (chapter === 4 && chapterClear && !clog.alive && Math.hypot(P.x - DRAIN.x, P.z - DRAIN.z) < DRAIN.r + .7) I.e = true;
    return d;
  }
  function fightClog(I, M, pref) {
    const d = Math.hypot(clog.x - P.x, clog.z - P.z) || 1, dx = (clog.x - P.x) / d, dz = (clog.z - P.z) / d;
    const angry = clog.hp < clog.max * .5;
    // keep 10-16 away, circle to dodge hairballs
    const side = Math.sin(now() * .7) > 0 ? 1 : -1;
    let mx = -dz * side * .8, mz = dx * side * .8;
    if (d < 10 || (angry && d < 14)) { mx -= dx; mz -= dz; } else if (d > 16) { mx += dx; mz += dz; }
    const l = Math.hypot(mx, mz) || 1; I.move = [mx / l, mz / l];
    I.aim = { x: clog.x, y: clog.y, z: clog.z };
    I.weapon = pref.find(w => w === 0 || P.ammo[w] > 0);
    I.fire = R.roll() > .1; I.dash = angry && d < 12;
    if (P.ammo[2] <= 0 && P.ammo[1] <= 0) { const s = pickups.find(k => k.type === 'seltzer'); if (s) I.move = toward(s.x, s.z) || I.move; }
  }
  function standoff(I, t, lo, hi) {   // keep distance while shooting, strafing a little
    const d = dist(t, P) || 1, dx = (t.x - P.x) / d, dz = (t.z - P.z) / d, side = Math.sin(now() * .9 + R.seed) > 0 ? 1 : -1;
    let mx = -dz * side * .6, mz = dx * side * .6;
    if (d < lo) { mx -= dx; mz -= dz; } else if (d > hi) { mx += dx; mz += dz; }
    // don't back off the counter
    if (!onCounter(P.x + mx * 2.5, P.z + mz * 2.5)) { mx = dx * .3; mz = dz * .3; if (!onCounter(P.x + mx * 8, P.z + mz * 8)) { I.move = null; return; } }
    const l = Math.hypot(mx, mz) || 1; I.move = [mx / l, mz / l];
  }
  function dodgeFork(I, t) {
    if (t.type !== 'fork' || !(t.state === 1 || t.state === 2) || dist(t, P) > 9 || t.stuck > 0) return false;
    const d = dist(t, P) || 1; I.move = [-(t.z - P.z) / d, (t.x - P.x) / d]; I.dash = P.dashCd <= 0; return true;
  }
  function slipHug(I) { if (P.latch && P.latchT > 0) { I.puddle = true; return true; } return false; }

  // weapon choice by what the tips teach (privileged: toolFactor is the same table the tips describe)
  function rightTool(t, d) {
    const has = w => w === 0 || P.ammo[w] > 0;
    if (t.frozen > 0) return has(2) && t.hp > 120 ? 2 : 0;              // freeze, then switch to shatter
    if (t.greasy && has(3)) return 3;
    if (t.type === 'fork') return t.stuck > 0 ? (has(2) ? 2 : has(1) ? 1 : 0) : null;   // don't waste shots on armour
    if (t.type === 'roll') return has(2) ? 2 : has(1) ? 1 : 0;
    if (t.type === 'bottle') return has(1) && d < 16 ? 1 : has(2) ? 2 : 0;
    if (t.type === 'mama') return has(2) ? 2 : has(1) && d < 10 ? 1 : 0;
    if (soakedSponge(t) || t.s >= 1.8) return has(1) && d < 12 ? 1 : 0;
    if (t.type === 'spoon') return has(1) && d < 9 ? 1 : 0;
    return 0;
  }

  // ---------------------------------------------------------------- personas
  const P_ = {
    // the old casual bot, for comparison: water, ice when scared
    casual: { prof: 'casual', think(I, M, vis) {
      route(M, I);
      if (clog.alive) return fightClog(I, M, [2, 1, 0]);
      const t = vis[0]; if (!t || chapterClear) return;
      I.aim = aimPoint(t); I.fire = R.roll() > .12; const close = dist(t, P) < 6;
      I.weapon = close && P.hp < 50 && P.ammo[1] > 0 ? 1 : 0; I.dash = R.roll() < .12;
    } },
    // reads every tip and does what it says
    tactician: { prof: 'skilled', think(I, M, vis) {
      route(M, I);
      if (slipHug(I)) return;
      if (clog.alive) return fightClog(I, M, [2, 1, 3, 0]);
      const gold = vis.find(e => e.gold);
      const t = gold || vis.find(e => !(e.type === 'fork' && !(e.stuck > 0) && vis.length > 1)) || vis[0];
      if (!t || chapterClear) return;
      if (dodgeFork(I, vis.find(e => e.type === 'fork') || t)) return;
      const d = dist(t, P);
      I.aim = aimPoint(t); I.weapon = rightTool(t, d); I.fire = I.weapon !== null && R.roll() > .08;
      if (I.weapon === null) I.weapon = 0;
      if (gold) { I.move = toward(t.x, t.z); I.puddle = d > 6; }
      else standoff(I, t, t.type === 'mama' || t.type === 'roll' ? 11 : 6, 15);
      I.dash = I.dash || (d < 3.5 && P.dashCd <= 0 && R.roll() < .3);
    } },
    // lies down whenever it can
    surfer: { prof: 'casual', think(I, M, vis) {
      route(M, I);
      if (slipHug(I)) return;
      if (clog.alive) { fightClog(I, M, [2, 1, 0]); return; }
      const t = vis[0];
      if (!t || chapterClear) { I.puddle = true; return; }
      const d = dist(t, P);
      I.aim = aimPoint(t); I.fire = R.roll() > .12; I.weapon = 0;
      if (d > 7) { I.puddle = true; I.move = toward(t.x, t.z); if (d < 16) { const s = Math.sin(now()) > 0 ? 1 : -1; I.move = [-(t.z - P.z) / d * s, (t.x - P.x) / d * s]; } }
      else standoff(I, t, 6, 12);
    } },
    // only the kitchen may kill: bubbles, freezes, shoves, edges, hotplates
    slapstick: { prof: 'skilled', think(I, M, vis) {
      route(M, I);
      if (slipHug(I)) return;
      if (clog.alive) return fightClog(I, M, [2, 1, 3, 0]);
      const t = vis.find(e => e.bub > 0) || vis.find(e => e.frozen > 0) || vis[0];
      if (!t || chapterClear) return;
      if (dodgeFork(I, t)) return;
      const d = dist(t, P), edge = edgeDir(t.x, t.z, 14), bubbleable = !['mama', 'roll', 'fork'].includes(t.type);
      I.aim = aimPoint(t);
      if (t.bub > 0 || t.frozen > 0) {
        // stand on the inner side and push it outward with water
        if (edge && onCounter(t.x - edge.ux * 7, t.z - edge.uz * 7)) { const gx = t.x - edge.ux * 7, gz = t.z - edge.uz * 7; I.move = toward(gx, gz); }
        else standoff(I, t, 5, 10);
        I.weapon = 0; I.fire = R.roll() > .1;
      } else if (bubbleable && P.ammo[3] > 0) { I.weapon = 3; I.fire = R.roll() > .2; standoff(I, t, 6, 13); }
      else if (bubbleable && P.ammo[1] > 0 && d < 10) { I.weapon = 1; I.fire = R.roll() > .2; standoff(I, t, 4, 9); }
      else if (P.ammo[2] > 0 && edge && edge.s < 6) { I.weapon = 2; I.fire = R.roll() > .3; standoff(I, t, 8, 14); }
      else { I.weapon = 0; I.fire = R.roll() > .12; standoff(I, t, 6, 13); }
    } },
    // goes and looks at everything: curios, stashes, shelves
    explorer: { prof: 'casual', think(I, M, vis) {
      if (slipHug(I)) return;
      if (clog.alive) return fightClog(I, M, [2, 1, 0]);
      const threat = vis.find(e => dist(e, P) < 14) || (waveActive ? vis[0] : null);
      if (threat) { route(M, I); I.aim = aimPoint(threat); I.fire = R.roll() > .12; I.weapon = rightTool(threat, dist(threat, P)) ?? 0; standoff(I, threat, 6, 14); M.goal = null; return; }
      // down-time: visit things in this district, then move on
      if (!M.goal) M.goal = explorerGoal(M);
      const g = M.goal;
      if (!g) { route(M, I); return; }
      g.t = (g.t || 0) + PROFILES.casual.reaction;
      if (g.t > 26) { M.skip.add(g.id); M.log.push({ id: g.id, ok: false, why: 'timeout', at: round(now()) }); M.goal = null; return; }
      if (g.kind === 'curio') {
        const d = Math.hypot(g.x - P.x, g.z - P.z);
        I.move = d > 2.5 ? toward(g.x, g.z) : null; I.puddle = !!g.low;
        if (d < 5) { I.aim = { x: g.x, y: g.y + g.eyeY, z: g.z }; if (findCurio() === g.ref && curioFocusT > .2) { tap('KeyF', 'f'); M.reading = 1.2; M.skip.add(g.id); M.log.push({ id: g.id, ok: true, at: round(now()) }); M.goal = null; } }
        if (d < 3 && g.y > P.y + 2) { I.jump = R.roll() < .5; }   // can't reach it from here; hop and hope
      } else if (g.kind === 'letters') {
        // flatten and slide under the low board
        const lane = g.stage === 0 ? { x: 70, z: 7 } : g.stage === 1 ? { x: 70, z: 11 } : { x: 79, z: 11 };
        const d = Math.hypot(lane.x - P.x, lane.z - P.z); I.move = toward(lane.x, lane.z); I.puddle = g.stage > 0 || d < 3;
        if (d < 1.2) g.stage++;
        if (g.stage > 2 || stashSaid.letter) { M.skip.add(g.id); M.log.push({ id: g.id, ok: !!stashSaid.letter, at: round(now()) }); M.goal = null; }
      } else if (g.kind === 'shelf') {
        // rocket-jump from just in front of the shelf, then drift on top
        const spot = { x: 226, z: 7.3 }, d = Math.hypot(spot.x - P.x, spot.z - P.z);
        if (stashSaid.shelf || P.y > 9.5) { if (P.y > 9.5) { M.moment('top-shelf', true); I.move = toward(225 + (g.side = (g.side || 0) + 1) % 3, 4); } if (stashSaid.shelf) { M.skip.add(g.id); M.log.push({ id: g.id, ok: true, tries: g.tries, at: round(now()) }); M.goal = null; } return; }
        if (P.ammo[2] <= 0 || (g.tries || 0) >= 4) { M.skip.add(g.id); M.log.push({ id: g.id, ok: false, why: P.ammo[2] <= 0 ? 'no fizz' : 'tries', tries: g.tries, maxY: round(g.maxY || 0), at: round(now()) }); M.goal = null; return; }
        g.maxY = Math.max(g.maxY || 0, P.y);
        if (g.phase === 'air') {
          I.look = { yaw: 0, pitch: -1.45 }; I.weapon = 2;
          if (P.y > 10.2) I.move = [0, -1];
          if (P.onG && g.air > .5) { g.phase = null; }
          g.air = (g.air || 0) + PROFILES.casual.reaction;
          return;
        }
        if (d > .7) { I.move = toward(spot.x, spot.z); I.weapon = 2; return; }
        I.look = { yaw: 0, pitch: -1.45 }; I.weapon = 2;
        if (P.w === 2 && Math.abs(P.pitch + 1.45) < .1 && P.onG) { I.jump = true; M.rocketFire = 3; g.tries = (g.tries || 0) + 1; g.phase = 'air'; g.air = 0; }
      }
    } },
    // never fires
    pacifist: { prof: 'casual', think(I, M, vis) {
      if (slipHug(I)) return;
      const near = vis.filter(e => dist(e, P) < 12);
      if (!near.length) { route(M, I); if (!chapterClear) I.move = I.move && M.wander ? I.move : null; return; }
      let fx = 0, fz = 0; for (const e of near) { const d = dist(e, P) || 1; fx -= (e.x - P.x) / d / d; fz -= (e.z - P.z) / d / d; }
      // stay on the counter
      const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
      if (!onCounter(P.x + fx * 4, P.z + fz * 4)) { const c = CHAPTERS[chapter].x; const tx = c - P.x, tz = 0 - P.z, tl = Math.hypot(tx, tz) || 1; fx = tx / tl; fz = tz / tl; }
      I.move = [fx, fz]; I.dash = dist(near[0], P) < 4 && P.dashCd <= 0; I.puddle = dist(near[0], P) > 8; I.jump = near[0].type === 'roll' && dist(near[0], P) < 6;
    } },
    // presses everything
    masher: { prof: 'masher', think(I, M, vis) {
      const r = R.roll;
      I.move = r() < .8 ? [Math.cos(M.a = (M.a || 0) + (r() - .5) * 2), Math.sin(M.a)] : null;
      I.fire = r() < .6; I.weapon = r() < .15 ? Math.floor(r() * 4) : null; I.dash = r() < .2; I.jump = r() < .25; I.puddle = r() < .2; I.e = r() < .05;
      I.look = { yaw: P.yaw + (r() - .5) * 3, pitch: (r() - .5) * 2 }; if (vis[0] && r() < .5) I.aim = aimPoint(vis[0]);
      if (r() < .02) tap('KeyF', 'f'); if (r() < .01) tap('Escape'); if (r() < .01) tap('Enter'); if (r() < .01) tap('KeyM', 'm'); if (r() < .01) tap('Tab');
      if (chapterClear && r() < .7) route(M, I);
    } },
    // the tactician with somewhere to be: skips every broadcast
    speedrunner: { prof: 'skilled', skipReplays: true, think(I, M, vis) { return P_.tactician.think(I, M, vis); } },
  };

  function explorerGoal(M) {
    if (!chapterClear && waveActive) return null;
    const ch = chapter;
    const cands = [];
    for (const r of CURIOS) if (r.district === ch && !M.skip.has(r.id) && !runCurios.has(r.id)) cands.push({ kind: 'curio', id: r.id, x: r.x, y: r.y, z: r.z, eyeY: r.eyeY, low: r.lowOnly, ref: r });
    if (ch === 1 && !stashSaid.letter && !M.skip.has('letters')) cands.push({ kind: 'letters', id: 'letters', x: 70, z: 9, stage: 0 });
    if (ch === 3 && !stashSaid.shelf && !M.skip.has('shelf')) cands.push({ kind: 'shelf', id: 'shelf', x: 226, z: 7.3 });
    cands.sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z));
    return cands[0] || null;
  }

  // ---------------------------------------------------------------- run
  window.personaBot = {
    start(cfg) {
      clock.reseed(cfg.seed); muted = true; if (cfg.ztalk !== undefined && typeof zTalk !== 'undefined') zTalk = cfg.ztalk;
      let ps = (cfg.seed * 2654435761 ^ cfg.persona.length * 40503) >>> 0;
      const roll = () => { ps ^= ps << 13; ps ^= ps >>> 17; ps ^= ps << 5; return (ps >>> 0) / 4294967296; };
      const persona = P_[cfg.persona];
      R = { cfg, persona, prof: PROFILES[persona.prof], seed: cfg.seed, roll, t0: clock.now(), done: false, outcome: 'time-limit', moments: [], shotsTaken: 0, frame: 0,
        M: { patrol: 1, stuck: 0, last: [P.x, P.z], skip: new Set(), log: [], goal: null, rocketFire: 0, reading: 0 },
        I: body(), decideAt: 0, deadAt: null, absorbedAt: null, lastWave: -1, lastChapter: -1, waveAt: 0,
        tele: { lines: [], lineCount: {}, announcer: 0, pops: 0, popWords: {}, feed: [], banners: 0, kills: {}, killTypes: {}, kitchenKills: {}, freezes: 0, shatters: 0, bubbled: 0, degreased: 0, rocketJumps: 0,
          chal: [], hurt: {}, curios: [], replays: [], clog: null, deaths: [], waves: [], mods: [], frames: {}, puddleFrames: 0, playFrames: 0, varietyHist: {}, zOnFrames: 0, hpMin: 100, maxY: 0, stuckSeconds: 0, shots: [0, 0, 0, 0], endings: [] } };
      R.moment = (label, once, delayFrames = 0) => {
        if (once && R.moments.some(m => m.label === label)) return;
        if (R.moments.length >= cfg.maxShots) return;
        R.moments.push({ label, at: round(now()), frame: R.frame + delayFrames, taken: false });
      };
      R.M.moment = R.moment;
      const of = fire; fire = function () { const ready = P.cool <= 0 && P.switchT <= 0 && P.ammo[P.w] > 0, w = P.w; of(); if (ready && R) R.tele.shots[w]++; };
      tap('Enter');
    },
    step(frames) {
      const T_ = R.tele, M = R.M;
      for (let n = 0; n < frames && !R.done; n++) {
        const dt = 1 / 60, el = now(); R.frame++;
        if (![P.x, P.y, P.z, P.hp].every(Number.isFinite)) { R.outcome = 'invariant-failure'; R.done = true; break; }
        if (state === 'won') { R.outcome = 'escaped'; R.done = true; R.moment('won', true); break; }
        if (el > R.cfg.seconds) { R.done = true; break; }
        T_.frames[state] = (T_.frames[state] || 0) + 1;
        if (state === 'replay') {
          const rp = T_.replays.at(-1); if (rp) rp.seconds = round(rp.seconds + dt);
          if (R.persona.skipReplays && rp && rp.seconds > .5 && !rp.skipped) { rp.skipped = true; tap('Space', ' '); }
        }
        if (state === 'dead') {
          releaseAll();
          if (R.deadAt === null) { R.deadAt = el; T_.deaths.push({ at: round(el), wave, chapter: chapter + 1, cause: deathCause, pos: [round(P.x), round(P.y), round(P.z)] }); R.moment('death-' + T_.deaths.length, false, 30); }
          if (T_.deaths.length > R.cfg.maxDeaths) { R.outcome = 'death-limit'; R.done = true; break; }
          if (el - R.deadAt > 2) { for (const c of 'please') tap('Key' + c.toUpperCase(), c); R.deadAt = null; R.decideAt = 0; }
        } else R.deadAt = null;
        if (state === 'absorbed' || state === 'absorbing') {
          releaseAll();
          if (R.absorbedAt === null) { R.absorbedAt = el; T_.endings.push({ state, at: round(el) }); R.moment('absorbed', true, 60); }
          if (el - R.absorbedAt > 6) { for (const c of 'please') tap('Key' + c.toUpperCase(), c); R.absorbedAt = el; }
        } else R.absorbedAt = null;
        if (state === 'paused' || screenKind === 'curio' || screenKind === 'journal') {
          M.pausedFor = (M.pausedFor || 0) + dt;
          if ((screenKind === 'curio' && M.reading <= 0) || M.pausedFor > (R.cfg.persona === 'masher' ? 4 : 1.5)) { tap('Escape'); M.pausedFor = 0; }
          M.reading -= dt;
        } else M.pausedFor = 0;
        if (state === 'play') {
          if (wave !== R.lastWave || chapter !== R.lastChapter) {
            if (R.lastWave > 0) T_.waves.push({ wave: R.lastWave, seconds: round(el - R.waveAt), mod: R.lastMod || null });
            if (chapter !== R.lastChapter) R.moment('district-' + (chapter + 1), true, 50);
            R.lastWave = wave; R.lastChapter = chapter; R.waveAt = el; R.lastMod = MOD;
            if (MOD) T_.mods.push({ wave, mod: MOD });
          }
          if (MOD && !R.lastMod) R.lastMod = MOD;
          if (waveActive && el - R.waveAt > 150) R.moment('long-wave-' + wave, true);
          T_.playFrames++; if (P.pud) T_.puddleFrames++; if (ZZ.on) T_.zOnFrames++;
          // how do falls happen? facing the drop, backpedalling, sliding, dashing or airborne
          if (M.wasOn && !onCounter(P.x, P.z) && P.y < 1.5) {
            const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), sp = Math.hypot(P.vx, P.vz) || 1, mv = R.I.move;
            (T_.falls = T_.falls || []).push({ at: round(el), wave, facing: round((fx * P.vx + fz * P.vz) / sp), intent: mv ? round(fx * mv[0] + fz * mv[1]) : null, speed: round(sp), pud: P.pud, dash: P.dashT > -0.7, air: !P.onG, teeter: round(M.teeterMax || 0), pos: [round(P.x), round(P.z)] });
          }
          M.teeterMax = P.teeter > 0 ? Math.max(M.teeterMax || 0, P.teeter) : 0;
          M.wasOn = onCounter(P.x, P.z);
          T_.varietyHist[varietyMult] = (T_.varietyHist[varietyMult] || 0) + 1;
          T_.hpMin = Math.min(T_.hpMin, P.hp); T_.maxY = Math.max(T_.maxY, P.y);
          if (clog.alive === false && T_.clog && T_.clog.end === null) T_.clog.end = round(el);
          if (el >= R.decideAt) {
            R.decideAt = el + R.prof.reaction;
            const disp = Math.hypot(P.x - M.last[0], P.z - M.last[1]);
            const wants = R.I.move && Math.hypot(...R.I.move) > .1;
            M.stuck = disp < .2 && wants ? M.stuck + R.prof.reaction : 0; if (M.stuck > 0) T_.stuckSeconds = round(T_.stuckSeconds + R.prof.reaction);
            M.last = [P.x, P.z];
            const vis = visible(R.prof), I = body();
            R.persona.think(I, M, vis);
            if (I.move && M.stuck > 1.2 && onCounter(P.x + I.move[0] * 2.5, P.z + I.move[1] * 2.5)) I.jump = true;   // a teeter is not a wall
            R.I = I;
            if (R.frame % 1800 === 0) R.moment('sample-' + Math.round(el), false);
          }
          if (M.rocketFire > 0) { M.rocketFire--; if (M.rocketFire === 0 && P.w === 2) { mouse(true); R.I.fire = true; R.I.aim = null; } }
          act(R.I, R.prof, dt);
          if (P.y > 9.6 && R.cfg.persona === 'explorer') R.moment('high-' + Math.round(P.x), true);
        }
        clock.advance(dt);
        tick(dt); hud(dt); zUpdate(dt);
        if (R.moments.some(m => !m.taken && m.frame <= R.frame)) break;
      }
      const due = R.moments.filter(m => !m.taken && m.frame <= R.frame);
      due.forEach(m => m.taken = true);
      return { done: R.done, due: due.map(m => m.label), t: round(now()), state, wave, chapter: chapter + 1 };
    },
    draw() { render(); hud(0); },
    report() {
      const T_ = R.tele;
      releaseAll();
      const repeats = Object.values(T_.lineCount).filter(n => n > 1).length;
      const playSec = T_.playFrames / 60;
      const left = enemies.filter(e => !e.dead).map(e => ({ type: e.type, gold: !!e.gold, x: round(e.x), y: round(e.y), z: round(e.z), hp: round(e.hp), state: e.state, frozen: round(e.frozen || 0), bub: round(e.bub || 0), stuck: round(e.stuck || 0), onCounter: onCounter(e.x, e.z), ground: round(groundAt(e.x, e.z, e.y + .5)), seen: lineOfSight(e), d: round(dist(e, P)) }));
      return { persona: R.cfg.persona, seed: R.seed, outcome: R.outcome, simSeconds: round(now()), playSeconds: round(playSec), final: { wave, chapter: chapter + 1, score, kills: killCount, hp: round(P.hp), continues, pos: [round(P.x), round(P.y), round(P.z)], waveActive, chapterClear, spawnQ: spawnQ.length, enemiesLeft: left },
        deaths: T_.deaths, endings: T_.endings, shots: T_.shots, kills: T_.kills, killTypes: T_.killTypes, kitchenKills: T_.kitchenKills,
        freezes: T_.freezes, shatters: T_.shatters, bubbled: T_.bubbled, degreased: T_.degreased, rocketJumps: T_.rocketJumps,
        challenges: T_.chal, hurt: T_.hurt, curios: T_.curios, explorer: R.M.log, stashes: { ...stashSaid }, replays: T_.replays, clog: T_.clog, waves: T_.waves, mods: T_.mods,
        falls: T_.falls || [], frames: T_.frames, puddleShare: round(T_.puddleFrames / Math.max(1, T_.playFrames)), commentaryOnScreen: round(T_.zOnFrames / Math.max(1, T_.playFrames)),
        variety: T_.varietyHist, hpMin: round(T_.hpMin), maxY: round(T_.maxY), stuckSeconds: T_.stuckSeconds,
        talk: { lines: T_.lines.length, perMinute: round(T_.lines.length / Math.max(1, now() / 60)), charsPerMinute: round(T_.lines.reduce((a, l) => a + l.len, 0) / Math.max(1, now() / 60)), repeatedLines: repeats, interrupted: T_.interrupted || 0, announcer: T_.announcer,
          keys: T_.lines.reduce((a, l) => (a[l.key || '?'] = (a[l.key || '?'] || 0) + 1, a), {}) },
        lines: T_.lines, pops: T_.pops, popsPerMinute: round(T_.pops / Math.max(1, now() / 60)), topPops: Object.entries(T_.popWords).sort((a, b) => b[1] - a[1]).slice(0, 12), banners: T_.banners, feed: T_.feed };
    },
  };
  showScreen('title');
}

async function main() {
  const opts = options(process.argv.slice(2)), gameDir = path.resolve(__dirname, '..');
  const source = fs.readFileSync(opts.source || path.join(gameDir, 'index.html'), 'utf8');
  const boot = "showScreen('title');\nrequestAnimationFrame(frame);";
  const pointerStart = source.indexOf('function grabPointer() {'), pointerEnd = source.indexOf("$('scr').addEventListener('click', e => {", pointerStart);
  if (!source.includes(boot) || pointerStart < 0 || pointerEnd < 0) throw new Error('Shipping test seams changed; update the persona runner.');
  let html = source.slice(0, pointerStart) + 'function grabPointer() { locked = true; lockAt = -1000; }\n' + source.slice(pointerEnd);
  html = html.replace(boot, '(' + botRuntime.toString() + ')();');
  const server = http.createServer((req, res) => { if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; } res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
  await new Promise((ok, no) => { server.once('error', no); server.listen(0, '127.0.0.1', ok); });
  const outDir = opts.out; if (outDir) fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: opts.browser, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--num-raster-threads=1'] });
  const reports = [];
  try {
    for (const persona of opts.personas) for (const seed of opts.seeds) {
      const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
      await ctx.addInitScript(installClock, seed);
      const page = await ctx.newPage(), errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.route('https://**', r => r.abort());
      await page.goto(`http://127.0.0.1:${server.address().port}/?scale=1`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(cfg => window.personaBot.start(cfg), { persona, seed, seconds: opts.seconds, maxDeaths: opts.maxDeaths, maxShots: opts.shots, ztalk: opts.ztalk });
      const shotDir = outDir && path.join(outDir, `${persona}-${seed}`); if (shotDir) fs.mkdirSync(shotDir, { recursive: true });
      let n = 0;
      for (;;) {
        const s = await page.evaluate(() => window.personaBot.step(1200));
        for (const label of s.due) if (shotDir) {
          await page.evaluate(() => window.personaBot.draw());
          await page.screenshot({ path: path.join(shotDir, `${String(++n).padStart(2, '0')}-${label}-w${s.wave}.png`) });
        }
        if (s.done) break;
      }
      const rep = await page.evaluate(() => window.personaBot.report());
      rep.errors = errors; reports.push(rep);
      console.log(JSON.stringify({ persona, seed, outcome: rep.outcome, sim: rep.simSeconds, play: rep.playSeconds, wave: rep.final.wave, deaths: rep.deaths.length, score: rep.final.score, kills: rep.kills, shots: rep.shots, errors: errors.length }));
      if (outDir) fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(reports, null, 1));
      await ctx.close();
    }
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
}
main().catch(e => { console.error(e.stack || String(e)); process.exitCode = 1; });
