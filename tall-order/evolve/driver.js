// Runs inside the Tall Order page (injected by worker.js). Defines window.__EV:
//   makeStarts(seed, n)          -> n start specs, floors stratified, positions random
//   run(code, spec)              -> plays one episode with the controller source `code`
// The game itself is untouched; this only uses the `window.tallOrder` test hook.
(() => {
  const T = window.tallOrder, G = T.G, P = T.P, IN = T.IN;
  const Y = [0, 3.8, 7.6, 11.4, 15.2, 19.0];                 // top of each floor (mirrors the game)
  const DT = 0.1;                                             // controller tick: 10 Hz
  const WALK = 5.4, AIM = 12 * Math.PI / 180, HIP = 0.75, STEP = 0.66;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const r2 = v => Math.round(v * 100) / 100;
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const floorOf = y => { let f = 0; for (let i = 0; i < Y.length; i++) if (Y[i] <= y + 0.3) f = i; return f; };

  // ------------------------------------------------------------ starting positions
  const REGION = [[-12, 12, -12, 26], [-8, 8, -8, 8], [-8, -1, -8, 8], [-8, 8, -8, -2], [1, 8, -8, 8], [-3.6, 3.6, -0.6, 6.6]];
  function clear(x, z, f) {
    const y = Y[f];
    if (Math.abs(T.floorBelow(x, y + 0.6, z) - y) > 0.05) return false;
    for (const b of T.SOL) if (x + 0.45 > b.x0 && x - 0.45 < b.x1 && z + 0.45 > b.z0 && z - 0.45 < b.z1 && b.y1 > y + 0.1 && b.y0 < y + 1.4) return false;
    if (f === 0 && Math.abs(x) < 9.5 && z < 9.5 && z > -9.5) return false;       // not under the tower
    for (const e of T.FOES) if (Math.abs(e.y - y) < 2 && Math.hypot(e.x - x, e.z - z) < 2) return false;
    return true;
  }
  function makeStarts(seed, n) {
    const rng = mulberry(seed >>> 0), out = [];
    T.start();                                                // so the foes are where they start
    const floors = [];
    while (floors.length < n) { const b = [0, 1, 2, 3, 4, 5]; for (let i = 5; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } floors.push(...b); }
    for (let i = 0; i < n; i++) {
      const f = floors[i], R = REGION[f]; let x = 4, z = 23.5;
      for (let k = 0; k < 400; k++) { x = R[0] + rng() * (R[1] - R[0]); z = R[2] + rng() * (R[3] - R[2]); if (clear(x, z, f)) break; }
      const kinds = ['rocket', 'confetti', 'bomb', 'mallet', 'zap', 'balloon'], inv = [];
      const ni = rng() < 0.5 ? 0 : 1 + Math.floor(rng() * 2);
      for (let j = 0; j < ni; j++) inv.push(kinds[Math.floor(rng() * kinds.length)]);
      out.push({ seed: Math.floor(rng() * 1e9), floor: f, x: r2(x), z: r2(z), yaw: r2((rng() * 2 - 1) * Math.PI), hp: 40 + Math.floor(rng() * 61), inv,
        budget: 40 + 22 * (5 - f) });
    }
    return out;
  }

  function setup(s) {
    Math.random = mulberry(s.seed);
    T.start();
    G.intro = 0;
    const f = s.floor;
    for (const c of T.CHECKS) c.reached = c.n <= f && c.n < 6;
    for (let i = T.FOES.length - 1; i >= 0; i--) if (T.FOES[i].y < Y[f] - 1.5 && !T.FOES[i].fly) T.FOES.splice(i, 1);
    Object.assign(P, { x: s.x, y: Y[f] + 0.02, z: s.z, yaw: s.yaw, vx: 0, vy: 0, vz: 0, kx: 0, kz: 0, hp: s.hp, check: f, onGround: true, fallFrom: Y[f] });
    for (const k of s.inv) T.giveItem(k);
    G.stood = Y[f]; G.peak = Y[f];
  }

  // ------------------------------------------------------------ what the controller sees
  function goalOf() {
    const f = floorOf(P.y), x = P.x, z = P.z;
    let wx, wz, kind, extra = {};
    if (f === 0) { if (z > 14.5 && Math.abs(x - 4) > 1.2) { wx = 4; wz = 15.5; kind = 'stairs-approach'; } else { wx = 4; wz = 6.5; kind = 'stairs'; } }
    else if (f === 1) { wx = 1; wz = -4.5; kind = 'spring'; }
    else if (f === 2) { wx = -4.5; wz = -0.8; kind = 'lift'; const L = T.LIFTS[0]; extra = { liftY: r2(L.y), liftMode: L.mode }; }
    else if (f === 3) { if (x < -6.9 || (x < -5.5 && Math.abs(z + 5) > 1.2)) { wx = -6.8; wz = -5; kind = 'stairs-approach'; } else { wx = 1.8; wz = -5; kind = 'stairs'; } }
    else if (f === 4) { if (x < 5.4) { wx = 6.2; wz = 3; kind = 'ladder-approach'; } else { wx = 4.5; wz = 3; kind = 'ladder'; } }
    else {
      const boss = T.FOES.find(e => e.type === 'boss' && e.alive);
      if (boss) { wx = boss.x; wz = boss.z; kind = 'boss'; }
      else if (T.stepsT() >= 0) {
        let best = null; for (const s of T.STEPS) if (s.y1 > P.y + 0.2 && (!best || s.y1 < best.y1)) best = s;
        if (best) { wx = (best.x0 + best.x1) / 2; wz = (best.z0 + best.z1) / 2; kind = 'crane-step'; extra = { stepY: r2(best.y1) }; } else { const g = T.GOAL(); wx = g.x; wz = g.z; kind = 'flag'; }
      } else { wx = 0; wz = 1.2; kind = 'crane'; }
    }
    const dx = wx - P.x, dz = wz - P.z;
    return Object.assign({ kind, d: r2(Math.hypot(dx, dz)), b: r2(wrap(Math.atan2(dz, dx) - P.yaw)) }, extra);
  }
  const inBand = (d, y0, y1) => { const gy = P.y + HIP, dd = Math.max(d, 0.4), hp = (P.headPitch || 0) + (P.carried ? -0.55 : 0); return Math.max(y0, gy + dd * Math.tan(hp - AIM)) <= Math.min(y1, gy + dd * Math.tan(hp + AIM)); };
  const rel = (x, y, z) => { const dx = x - P.x, dz = z - P.z; return { d: r2(Math.hypot(dx, dz)), b: r2(wrap(Math.atan2(dz, dx) - P.yaw)), dy: r2(y - P.y) }; };
  function dropAt(ang) {
    const a = P.yaw + ang;
    for (const d of [0.7, 1.4, 2.1, 3]) if (T.floorBelow(P.x + Math.cos(a) * d, P.y + STEP + 0.01, P.z + Math.sin(a) * d) < P.y - 1.2) return d;
    return 9;
  }
  function observe(t) {
    const foes = [];
    for (const e of T.FOES) {
      if (!e.alive) continue;
      const r = rel(e.x, e.y, e.z);
      if (r.d > 28 || Math.abs(r.dy) > 14) continue;
      foes.push({ k: e.type, d: r.d, b: r.b, dy: r.dy, hp: Math.round(e.hp * 10) / 10, st: e.st, awake: !!e.awake, band: inBand(r.d, e.y, e.y + e.h) });
    }
    foes.sort((a, b) => a.d - b.d);
    const shots = [];
    for (const s of T.SHOTS) if (s.foe && !s.dead) shots.push(Object.assign({ k: s.kind, shootable: !!s.shootable }, rel(s.x, s.y, s.z)));
    shots.sort((a, b) => a.d - b.d);
    const items = [];
    for (const it of T.ITEMS) { if (it.got || it.dead) continue; const r = rel(it.x, it.y, it.z); if (r.d < 14 && Math.abs(r.dy) < 2.5) items.push(Object.assign({ k: it.kind }, r)); }
    items.sort((a, b) => a.d - b.d);
    const aimed = T.inLine(), out = T.aim(), nm = e => e.type || e.kind || 'brick';
    return {
      t: r2(t), hp: Math.round(P.hp), x: r2(P.x), y: r2(P.y), z: r2(P.z), yaw: r2(P.yaw), floor: floorOf(P.y),
      ground: !!P.onGround, hang: !!P.hang, carried: !!P.carried, rider: !!P.rider, dead: P.dead > 0, climbing: !!P.climbing,
      speed: r2(Math.hypot(P.vx, P.vz)), vy: r2(P.vy), head: P.head || null,
      goal: goalOf(),
      aim: { hit: aimed ? nm(aimed) : null, out: out.out ? nm(out.out) : null, dir: out.out ? out.dir : 0 },
      drop: { f: dropAt(0), l: dropAt(-0.9), r: dropAt(0.9) },
      foes: foes.slice(0, 8), shots: shots.slice(0, 4), items: items.slice(0, 4),
      inv: T.INV.map(i => ({ k: i.kind, n: i.ammo })), sel: T.selIdx(),
    };
  }

  // ------------------------------------------------------------ one episode
  const FORBID = /\b(window|document|globalThis|self|tallOrder|eval|Function|fetch|XMLHttpRequest|import|require|process|constructor|__proto__|prototype|setTimeout|setInterval|while|do)\b/;
  function compile(code) {
    if (FORBID.test(code)) throw new Error('forbidden token: ' + code.match(FORBID)[0]);
    return new Function('"use strict";\n' + code + '\n;return typeof step === "function" ? step : null;')();
  }
  function run(code, s) {
    const res = { floor: s.floor, win: false, progress: 0, deaths: 0, kills: 0, t: 0, fire: 0, pace: 0, jumps: 0, uses: 0, errors: 0, end: 'timeout', log: [], killedBy: [] };
    let step;
    try { step = compile(code); if (!step) throw new Error('no function step'); } catch (e) { res.end = 'compile'; res.err = String(e.message || e); return res; }
    setup(s);
    const mem = {}, y0 = Y[s.floor], top = T.GOAL().y;
    let ticks = 0, fireN = 0, speedSum = 0, jumpN = 0, useN = 0, deadPrev = false, wall = 0, lastGain = 0, lastY = y0, prevJump = false;
    const w0 = performance.now();
    while (G.t < s.budget && G.st === 'play') {
      const o = observe(G.t);
      let a = null; const c0 = performance.now();
      try { a = step(o, mem) || {}; } catch (e) { res.errors++; if (!res.err) res.err = String(e && e.message || e).slice(0, 160); if (res.errors > 8) { res.end = 'error'; break; } a = {}; }
      wall += performance.now() - c0;
      if (wall > 3000) { res.end = 'slow'; break; }
      const turn = clamp(+a.turn || 0, -1, 1), move = clamp(+a.move || 0, -1, 1), fire = !!a.fire, jump = !!a.jump;
      T.setStick(turn, -move);
      IN.kFire = fire; if (fire) IN.fireTap = true;
      if (jump) { T.key('Space', true); jumpN++; } else if (prevJump) T.key('Space', false);
      prevJump = jump;
      if (a.use) { T.key('KeyE', true); T.key('KeyE', false); useN++; }
      if (Number.isInteger(a.sel) && a.sel >= 0 && a.sel < 4) { T.key('Digit' + (a.sel + 1), true); T.key('Digit' + (a.sel + 1), false); }
      T.sim(DT);
      ticks++; if (fire) fireN++; speedSum += Math.hypot(P.vx, P.vz) / WALK;
      const dead = P.dead > 0;
      if (dead && !deadPrev) { const near = T.FOES.filter(e => e.alive).sort((p, q) => Math.hypot(p.x - P.x, p.z - P.z) - Math.hypot(q.x - P.x, q.z - P.z))[0]; res.killedBy.push((P.y < lastY - 3 ? 'fall' : near ? near.type : '?') + '@y' + Math.round(P.y)); }
      deadPrev = dead; lastY = P.y;
      if (G.stood > y0 + lastGain + 0.3) { lastGain = G.stood - y0; res.lastGainT = r2(G.t); }
      if (ticks % 100 === 0 && res.log.length < 6) res.log.push(`t${Math.round(G.t)} y${r2(P.y)} hp${Math.round(P.hp)} ${o.goal.kind}${o.goal.d}`);
    }
    if (G.st !== 'play' && G.won) { res.win = true; res.end = 'win'; }
    res.t = r2(G.t); res.deaths = G.deaths; res.kills = G.kills;
    const stood = G.won ? top : Math.max(G.stood || y0, y0);
    res.progress = r2(clamp((stood - y0) / (top - y0), 0, 1)); res.reach = r2(stood);
    res.fire = ticks ? fireN / ticks : 0; res.pace = ticks ? speedSum / ticks : 0;
    res.jumps = r2(jumpN / Math.max(ticks * DT, 1) * 60); res.uses = useN; res.ticks = ticks; res.wallMs = Math.round(performance.now() - w0);
    res.stuckAt = r2(P.y); res.lastPos = [r2(P.x), r2(P.z)];
    T.setStick(null); IN.kFire = false; T.key('Space', false);
    return res;
  }
  window.__EV = { makeStarts, run, Y };
})();
