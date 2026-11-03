// The bridge between a controller and the game. This file is evaluated INSIDE the headless game's vm context (see
// world.js), so it can reach CITY, W, PLAYER, MISSIONS ... directly. It exposes plain data only: a controller never
// sees a game object, just the JSON that obs() builds, and answers with the JSON that act() consumes.
//
//   obs()   what the controller can see  (documented for the LLM in prompts.js, BRIEF)
//   act(a)  press buttons for one decision tick
//   track() per-step bookkeeping: progress points, playstyle descriptors, diagnostics
//   setup() put the player into a start scenario
//
// Bearings b are in radians, positive = to the RIGHT of the heading. f/r are metres ahead/to the right.
var __bridge = (() => {
  'use strict';
  const P = () => PLAYER.P;
  const TAU = Math.PI * 2;
  const rad = v => Math.round(v * 100) / 100, m1 = v => Math.round(v * 10) / 10;
  const heading = () => { const p = P(); return p.car ? p.car.angle : p.camYaw; };
  // position of (x,z) in the frame of the heading: f ahead, r to the right, d distance, b bearing (right positive)
  function rel(h, x, z) { const p = P(), dx = x - p.x, dz = z - p.z, s = Math.sin(h), c = Math.cos(h); const f = dx * s + dz * c, r = -dx * c + dz * s; return { f: m1(f), r: m1(r), d: m1(Math.hypot(dx, dz)), b: rad(Math.atan2(r, f)) }; }

  // ---- the route (a GPS line, like the map's): BFS over the sidewalk graph on foot, over the road grid in a car ----
  const G = { route: null, kind: null, tx: 0, tz: 0, t: -99, idx: 0 };
  function walkRoute(tx, tz) {
    const p = P(), start = CITY.nearestWalkNode(p.x, p.z), goal = CITY.nearestWalkNode(tx, tz); const prev = new Map([[start, null]]); const q = [start]; let ok = false;
    for (let qi = 0; qi < q.length; qi++) { const n = q[qi]; if (n === goal) { ok = true; break; } for (const l of n.links) if (!prev.has(l.to)) { prev.set(l.to, n); q.push(l.to); } }
    const pts = []; if (ok) { let cur = goal; while (cur) { pts.unshift([cur.x, cur.z]); cur = prev.get(cur); } } pts.push([tx, tz]); return pts;
  }
  function roadRoute(tx, tz) {
    const Gd = CITY.GRID, PT = CITY.PITCH, ni = x => M.clamp(Math.round(x / PT), 0, Gd), key = (i, j) => i + ',' + j; const p = P();
    const si = ni(p.x), sj = ni(p.z), ti = ni(tx), tj = ni(tz); const prev = {}; const q = [[si, sj]]; prev[key(si, sj)] = null;
    for (let qi = 0; qi < q.length; qi++) { const [i, j] = q[qi]; if (i === ti && j === tj) break; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || a > Gd || b < 0 || b > Gd || prev[key(a, b)] !== undefined) continue; prev[key(a, b)] = [i, j]; q.push([a, b]); } }
    const nodes = []; let cur = [ti, tj]; while (cur) { nodes.unshift(cur); cur = prev[key(cur[0], cur[1])]; }
    const pts = [];
    for (let k = 0; k + 1 < nodes.length; k++) { const [i, j] = nodes[k], [i2, j2] = nodes[k + 1]; const dx = Math.sign(i2 - i), dz = Math.sign(j2 - j), rx = -dz, rz = dx; const x0 = i * PT, z0 = j * PT, x1 = i2 * PT, z1 = j2 * PT; pts.push([x0 + dx * 9 + rx * 1.75, z0 + dz * 9 + rz * 1.75]); pts.push([x1 - dx * 9 + rx * 1.75, z1 - dz * 9 + rz * 1.75]); }
    pts.push([tx, tz]); return pts;
  }
  function gps(goal) {
    const p = P(), kind = p.car ? 'car' : 'foot', now = W.state.elapsed;
    if (!G.route || G.kind !== kind || M.dist(goal.x, goal.z, G.tx, G.tz) > 12 || now - G.t > 2.5) {
      const ahead = G.route && G.kind === kind ? G.route[Math.min(G.idx, G.route.length - 1)] : null;
      G.route = kind === 'car' ? roadRoute(goal.x, goal.z) : walkRoute(goal.x, goal.z); G.kind = kind; G.tx = goal.x; G.tz = goal.z; G.t = now; G.idx = 0;
      // start at the first point that is ahead of us rather than a node that is behind
      const h = heading(), L = kind === 'car' ? 12 : 5; while (G.idx < G.route.length - 1) { const w = G.route[G.idx], dd = M.dist(p.x, p.z, w[0], w[1]); const fwdDot = ((w[0] - p.x) * Math.sin(h) + (w[1] - p.z) * Math.cos(h)) / (dd || 1); if (dd > L && fwdDot > (kind === 'car' ? -0.2 : -0.6)) break; G.idx++; } void ahead;
    }
    const L = kind === 'car' ? 12 : 4; while (G.idx < G.route.length - 1 && M.dist(p.x, p.z, G.route[G.idx][0], G.route[G.idx][1]) < L) G.idx++;
    const h = heading(), w = G.route[G.idx], w2 = G.route[Math.min(G.idx + 1, G.route.length - 1)], w3 = G.route[Math.min(G.idx + 2, G.route.length - 1)];
    let rest = M.dist(p.x, p.z, w[0], w[1]); for (let i = G.idx; i < G.route.length - 1; i++) rest += M.dist(G.route[i][0], G.route[i][1], G.route[i + 1][0], G.route[i + 1][1]);
    return { d: Math.round(rest), b: rel(h, w[0], w[1]).b, b2: rel(h, w2[0], w2[1]).b, b3: rel(h, w3[0], w3[1]).b, wd: rel(h, w[0], w[1]).d };
  }

  // ---- rays: how far is it to the nearest wall or prop in each direction (metres, up to 20) ----
  const RAY_ANGLES = [-90, -45, -20, 0, 20, 45, 90];
  function rays() {
    const p = P(), h = heading(), car = p.car, rr = car ? Math.min(1.2, car.spec.wid / 2) : 0.45, hgt = car ? car.spec.hgt : 1.8, y = p.y, out = [];
    for (const deg of RAY_ANGLES) {
      const a = h + (-deg * Math.PI / 180), dx = Math.sin(a), dz = Math.cos(a); let dist = 20;
      for (let s = 1.5; s <= 20; s += 1.5) { const res = W.pushOut(p.x + dx * s, p.z + dz * s, rr, { y, height: hgt }); if (res.hit || W.onWater(p.x + dx * s, p.z + dz * s)) { dist = s - 1.5; break; } }
      out.push(m1(dist));
    }
    return out;
  }

  // ---- everything the controller may look at ----
  const L = { bearing: 0 };
  function obs(extra) {
    const p = P(), car = p.car, S = MISSIONS.S, h = heading(), o = {};
    o.t = rad(W.state.elapsed - L.t0); o.hour = rad(W.state.time); o.rain = rad(W.weather.rain || 0);
    o.me = { x: m1(p.x), z: m1(p.z), h: rad(h), mode: car ? 'car' : p.state === 'entering' ? 'entering' : 'foot', spd: rad(car ? car.speed : p.speed || 0), hp: Math.round(p.health), armor: Math.round(p.armor || 0), wanted: p.wanted | 0, money: Math.round(p.money), alive: !!p.alive, weapon: p.weapon, ammo: p.weapons[p.weapon] === Infinity ? 99 : (p.weapons[p.weapon] | 0), fire: !!(p.fireT > 0) };
    if (car) o.car = { spd: rad(car.speed), lat: rad(car.lat || 0), hp: rad(car.health / car.maxHealth), len: car.spec.len, wid: car.spec.wid, type: car.type, burning: !!car.burning, air: !!car.airborne, yaw: rad(car.yawRate || 0) };
    const ui = { dialogue: !!MISSIONS.dialogue, shop: !!MISSIONS.shop, retry: !!(S.retry && !S.current), choice: S.choice ? S.choice.options.slice(0, 4) : null };
    o.ui = ui;
    o.mission = { name: S.current ? S.current.name : null, next: (MISSIONS.LIST[S.progress] || {}).name || null, done: S.progress, timer: S.timer > 0 ? Math.round(S.timer) : -1, text: String(MISSIONS.objective || '').slice(0, 120) };
    // the goal: where the objective marker is (the blip on the map)
    const bp = MISSIONS.blipPos();
    if (bp && p.alive) { const obj = S.blip && S.blip.obj; const r = rel(h, bp.x, bp.z); o.goal = { x: Math.round(bp.x), z: Math.round(bp.z), d: r.d, f: r.f, r: r.r, b: r.b, kind: obj ? (obj.spec ? 'car' : 'person') : 'place' };
      if (obj && obj.spec) { o.goal.free = !obj.driver && !obj.wrecked && !obj.locked; o.goal.spd = rad(obj.absSpeed); o.goal.mine = obj === car; } o.gps = gps(bp); } else { o.goal = null; o.gps = null; G.route = null; }
    o.rays = rays();
    // cars: the 6 nearest within 45 m
    const cars = []; for (const c of W.cars) { if (c.removed || c === car) continue; const dd = M.dist2(c.x, c.z, p.x, p.z); if (dd > 45 * 45) continue; cars.push([dd, c]); } cars.sort((a, b) => a[0] - b[0]);
    const want = S.blip && S.blip.obj;
    o.cars = cars.slice(0, 6).map(([, c]) => { const r = rel(h, c.x, c.z); const parked = c.ai.mode === 'parked' && !c.driver, cop = !parked && (c.spec.police || c.ai.mode === 'chase'); return { f: r.f, r: r.r, d: r.d, b: r.b, spd: rad(c.absSpeed), vf: rad(c.vx * Math.sin(h) + c.vz * Math.cos(h)), kind: c.wrecked ? 'wreck' : parked ? 'parked' : cop ? 'cop' : 'traffic', len: c.spec.len, wid: c.spec.wid, free: !c.driver && !c.wrecked && !c.locked, goal: c === want }; });
    // people: the 6 nearest within 30 m
    const peds = []; for (const q of W.peds) { if (q.removed || q.inCar) continue; const dd = M.dist2(q.x, q.z, p.x, p.z); if (dd > 30 * 30) continue; peds.push([dd, q]); } peds.sort((a, b) => a[0] - b[0]);
    o.peds = peds.slice(0, 6).map(([, q]) => { const r = rel(h, q.x, q.z); return { f: r.f, r: r.r, d: r.d, b: r.b, kind: q.isCop ? 'cop' : q.isGang ? 'gang' : 'civ', hostile: !!(q.hostile || q.isGang && q.state === 'attack'), down: !q.alive, goal: q === want }; });
    // the car I could climb into right now
    const ec = p.car ? null : PLAYER.entryCandidate && PLAYER.entryCandidate(); if (ec && ec.car) { const r = rel(h, ec.car.x, ec.car.z); o.enter = { d: r.d, b: r.b, free: !ec.car.driver, goal: ec.car === want }; } else o.enter = null;
    return o;
  }

  // ---- buttons. A decision tick lasts several sim steps: held keys persist, edges fire on the first step ----
  const EDGE = { use: 'KeyF', skip: 'Space', retry: 'KeyY', side: 'KeyT', reload: 'KeyR', crouch: 'KeyZ', evade: 'KeyX' };
  const KEYSTICK = { 1: 'Digit1', 2: 'Digit2', 3: 'Digit3', 4: 'Digit4', 5: 'Digit5', 6: 'Digit6', 7: 'Digit7', 8: 'Digit8', 9: 'Digit9' };
  const num = (v, lo, hi) => { v = +v; return v === v ? Math.max(lo, Math.min(hi, v)) : 0; };
  let turnPending = 0, edgesPending = null, held = {}; const TURN_RATE = 3.2; // rad/s at full turn
  function act(a) {
    a = a && typeof a === 'object' ? a : {}; const pad = INPUT.pad, K = {}; const car = P().car;
    pad.active = true; pad.rx = pad.ry = 0;
    if (car) { pad.lx = num(a.steer, -1, 1); pad.ly = 0; pad.rt = num(a.gas, 0, 1); pad.lt = num(a.brake, 0, 1); K.Space = !!a.hand; K.KeyH = !!a.horn; }
    else { pad.lx = num(a.strafe, -1, 1); pad.ly = -num(a.move, -1, 1); pad.rt = 0; pad.lt = 0; K.ShiftLeft = !!a.sprint && num(a.move, -1, 1) > 0.5; }
    K.KeyG = !!a.talk; held = K;
    const mouse = INPUT.mouse; mouse.buttons = (a.fire ? 1 : 0) | (a.aim ? 2 : 0);
    turnPending = num(a.turn, -1, 1); edgesPending = {};
    for (const k in EDGE) if (a[k]) edgesPending[EDGE[k]] = true;
    if (a.jump && !car) edgesPending.Space = true;
    const w = a.weapon | 0; if (w >= 1 && w <= 9) edgesPending[KEYSTICK[w]] = true;
    const c = a.choose | 0; if (c >= 1 && c <= 4) edgesPending['Digit' + c] = true;
    L.fireHeld = !!a.fire;
  }
  // applied by world.js at each sim step: first = first step of the decision tick
  function applyInput(first, dt) {
    for (const k in INPUT.held) delete INPUT.held[k]; for (const k in held) if (held[k]) INPUT.held[k] = true;
    if (first && edgesPending) { for (const k in edgesPending) INPUT.edge[k] = true; edgesPending = null; }
    INPUT.mouse.dx = (turnPending * TURN_RATE * dt) / (0.0022 * (GAME.options.sensitivity || 1)); // the game does camYaw -= dx * sens: a positive dx turns right
    INPUT.locked = true;
  }

  // ---- progress and playstyle ----
  // points: 3 for closing the distance to the first objective, 2 for starting its mission, 1 per further objective
  // reached (up to 5), 5 for passing it, and 5 more for every further mission passed.
  const T = { };
  function reset(start) {
    const S = MISSIONS.S, p = P();
    Object.assign(T, { t: 0, d0: 0, dBest: 0, started: false, blips: new Set(), passed: 0, base: S.progress + S.progress2 + S.phoneProgress, startedName: null, goalSeen: false,
      tFoot: 0, tCar: 0, dFoot: 0, dCar: 0, offences: 0, shots: 0, wantedSec: 0, maxWanted: 0, deaths: 0, kills: p.stats.kills, kills0: p.stats.kills, stolen0: p.stats.carsStolen, stuckT: 0, stuckTotal: 0, last: [p.x, p.z], events: [], notes: [], aliveLast: true, status0: p.stats.wasted + p.stats.busted, still: 0, farStill: 0 });
    L.t0 = W.state.elapsed; L.start = start; G.route = null;
  }
  function ev(text) { if (T.events.length < 24) T.events.push({ t: rad(T.t), text }); }
  function track(dt, firing) {
    const S = MISSIONS.S, p = P(); T.t += dt;
    const sp = Math.hypot(p.x - T.last[0], p.z - T.last[1]); T.last = [p.x, p.z]; if (sp < 30 * dt) { if (p.car) T.dCar += sp; else T.dFoot += sp; } // (a teleport is not travel)
    if (p.car) T.tCar += dt; else T.tFoot += dt; if (firing) T.shots += dt;
    T.wantedSec += (p.wanted | 0) * dt; T.maxWanted = Math.max(T.maxWanted, p.wanted | 0);
    // alive/dead
    if (T.aliveLast && !p.alive) { T.deaths++; ev('died' + (p.state ? ' (' + p.state + ')' : '')); } T.aliveLast = !!p.alive;
    // stuck: alive, not in dialogue, hardly moving for a long time
    if (p.alive && !MISSIONS.dialogue && sp < 0.15 * dt * 30 / 30 + 0.002) T.still += dt; else { if (T.still > 4) T.stuckTotal += T.still; T.still = 0; }
    // objective progress
    const bp = MISSIONS.blipPos(), done = S.progress + S.progress2 + S.phoneProgress;
    if (bp) { const dd = M.dist(p.x, p.z, bp.x, bp.z); if (!T.goalSeen) { T.goalSeen = true; T.d0 = Math.max(dd, 1); T.dBest = dd; T.goalAt = [bp.x, bp.z]; ev('first objective ' + Math.round(dd) + ' m away'); } else if (!T.started && M.dist(bp.x, bp.z, T.goalAt[0], T.goalAt[1]) < 12) T.dBest = Math.min(T.dBest, dd);
      const key = Math.round(bp.x / 6) + ',' + Math.round(bp.z / 6); if (!T.blips.has(key) && dd < (p.car ? 9 : 5)) { T.blips.add(key); if (T.started) ev('reached objective ' + (T.blips.size - 1)); } }
    if (!T.started && S.current) { T.started = true; T.startedName = S.current.name; ev('started ' + S.current.name); }
    if (done > T.base + T.passed) { T.passed = done - T.base; ev('PASSED a mission (' + T.passed + ')'); }
  }
  function points() {
    const approach = T.goalSeen ? M.clamp(1 - T.dBest / T.d0, 0, 1) : (T.started ? 1 : 0);
    const further = Math.min(5, Math.max(0, T.blips.size - (T.started ? 1 : 0)));
    const started = T.started || T.passed > 0;
    return 3 * (started ? 1 : approach) + (started ? 2 : 0) + (started ? further : 0) + (T.passed > 0 ? 5 : 0) + 5 * Math.max(0, T.passed - 1);
  }
  function summary() {
    const p = P(), dur = Math.max(T.t, 1), dist = T.dFoot + T.dCar;
    return { points: +points().toFixed(3), t: rad(T.t), started: T.startedName, passed: T.passed, approach: T.goalSeen ? +M.clamp(1 - T.dBest / T.d0, 0, 1).toFixed(2) : 0, d0: Math.round(T.d0), dEnd: (() => { const bp = MISSIONS.blipPos(); return bp ? Math.round(M.dist(p.x, p.z, bp.x, bp.z)) : null; })(),
      tFoot: rad(T.tFoot), tCar: rad(T.tCar), dFoot: Math.round(T.dFoot), dCar: Math.round(T.dCar), deaths: T.deaths, offences: T.offences, shots: rad(T.shots), kills: p.stats.kills - T.kills0, stolen: p.stats.carsStolen - T.stolen0,
      wanted: p.wanted | 0, maxWanted: T.maxWanted, wantedSec: Math.round(T.wantedSec), stuck: Math.round(T.stuckTotal + (T.still > 4 ? T.still : 0)), alive: !!p.alive, mode: p.car ? 'car' : 'foot', hp: Math.round(p.health),
      events: T.events.slice(), notes: T.notes.slice(-8),
      // the two playstyle axes, both 0..1
      wheels: dist > 5 ? +(T.dCar / dist).toFixed(3) : 0, offencesPerMin: +(T.offences / (dur / 60)).toFixed(3) };
  }
  // count offences: every call into the police's crime report
  const crime0 = POLICE.crime, lastCrime = {}; POLICE.crime = function (kind) { const now = W.state.elapsed; if (lastCrime[kind] === undefined || now - lastCrime[kind] > 2) { lastCrime[kind] = now; T.offences++; if (T.events.length < 24) ev('offence: ' + kind); } return crime0.apply(this, arguments); };
  // record what the game says to the player
  function note(text) { T.notes.push(Math.round(T.t) + 's ' + String(text).slice(0, 90)); if (T.notes.length > 30) T.notes.shift(); }

  // ---- start scenarios ----
  function setup(s, density = 1) {
    const S = MISSIONS.S, p = P(); const Mx = CITY;
    W.state.time = s.hour; W.weather.target = s.rain ? 0.8 : 0; W.weather.rain = s.rain ? 0.8 : 0; W.weather.nextChange = 400; RENDER.env.wet = W.weather.rain;
    S.progress = s.story; S.progress2 = 0; S.phoneProgress = 0; S.cooldown = 0; S.current = null; S.dialogue = null; S.skipIntro = true; S.saveT = 1e9; S.sprayT = 0;
    p.health = s.hp; p.armor = 0; p.money = s.money; p.alive = true;
    for (const w of s.weapons || []) PLAYER.giveWeapon(w, 60); if (!(s.weapons || []).length) p.weapon = 'fist';
    p.x = s.x; p.z = s.z; p.y = CITY.groundY(s.x, s.z); p.angle = s.heading; p.camYaw = s.heading; p.camPitch = 0.3; p.car = null; p.state = 'foot';
    W.state.camYaw = s.heading;
    if (s.car) { const c = VEH.spawn(s.car.type, s.car.x, s.car.z, s.car.angle, { mode: 'parked', color: s.car.color }); c.driver = PLAYER; c.ai.mode = 'player'; p.car = c; p.state = 'car'; p.x = c.x; p.z = c.z; p.y = c.y; p.camYaw = c.angle; PLAYER.lastCarName = c.type; }
    for (let i = 0; i < 40; i++) { VEH.spawnTraffic(p.x, p.z, p.camYaw + Math.PI, Math.round(26 * density)); PEDS.populate(p.x, p.z, p.camYaw + Math.PI, Math.round(40 * density)); }
    // the free car nearby that a good start leaves for the controller to find (on foot starts)
    if (s.parked) { const c = VEH.spawn(s.parked.type, s.parked.x, s.parked.z, s.parked.angle, { mode: 'parked', color: s.parked.color }); void c; }
    if (s.wanted) POLICE.setStars(s.wanted);
    // one update so the first goal and population exist before the controller looks
    MISSIONS.update(1 / 30);
    reset(s);
  }
  return { obs, act, applyInput, track, points, summary, setup, note, reset, G, alive: () => !!P().alive };
})();
