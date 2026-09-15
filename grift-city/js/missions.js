// GRIFT CITY — pickups, shops, the safehouse, cutscene dialogue, the story missions and the side jobs.
'use strict';
const PICKUPS = (() => {
  const COLORS = { weapon: [0.9, 0.9, 0.95], health: [1, 0.25, 0.25], armor: [0.3, 0.6, 1], cash: [0.3, 0.95, 0.35], package: [0.8, 0.6, 0.3], bribe: [0.3, 0.5, 1.0], rampage: [1, 0.5, 0.1] };
  const meshes = {}; let pkgMesh = null;
  const meshFor = kind => meshes[kind] || (meshes[kind] = new MESH.Builder().cbox(0, 0.5, 0, 0.7, 0.7, 0.7, COLORS[kind]).build());
  function add(kind, x, z, data = {}) { const p = { kind, x, z, y: CITY.groundY(x, z), taken: false, respawn: data.respawn ?? (kind === 'cash' ? -1 : 240), t: 0, spin: W.rng() * 6, ...data }; W.pickups.push(p); return p; }
  function dropCash(x, z, n) { const p = add('cash', x + (W.rng() - 0.5), z + (W.rng() - 0.5), { amount: n, respawn: -1, life: 40 }); return p; }
  function placeWorld() {
    const P = k => CITY.place(k); const B = (i, j, dx, dz) => { const [x, z] = CITY.blockOrigin(i, j); return [x + dx, z + dz]; };
    const s = P('safehouse'); add('weapon', s.x + 8, s.z, { weapon: 'pistol', ammo: 34 }); add('health', s.x - 8, s.z, {});
    for (const h of CITY.places.hospital) add('health', h.x + 6, h.z, {});
    for (const p of CITY.places.police) add('armor', p.x + 6, p.z, {});
    for (const g of CITY.places.guns) add('weapon', g.x + 6, g.z, { weapon: 'pistol', ammo: 17 });
    const parks = CITY.places.park; add('weapon', parks[0].x, parks[0].z + 10, { weapon: 'uzi', ammo: 60 }); add('weapon', parks[1].x + 10, parks[1].z, { weapon: 'shotgun', ammo: 12 }); add('weapon', parks[2].x, parks[2].z - 10, { weapon: 'bat', ammo: 1 }); add('weapon', parks[3].x - 10, parks[3].z, { weapon: 'grenade', ammo: 4 });
    const d = P('docks'); add('weapon', d.x + 20, d.z + 20, { weapon: 'rifle', ammo: 60 });
    for (const pk of CITY.places.parking) add('bribe', pk.x, pk.z + 24, {});
    add('weapon', ...B(9, 9, 10, 55), { weapon: 'rocket', ammo: 2 });
    // hidden packages: tucked into corners of the city
    const spots = [[0, 0, 2, 2], [9, 0, 60, 2], [0, 9, 2, 62], [9, 9, 61, 61], [4, 4, 1, 1], [5, 5, 63, 63], [2, 7, 30, 30], [7, 2, 30, 30], [1, 4, 32, 32], [8, 5, 32, 32], [4, 8, 32, 20], [6, 9, 32, 44], [8, 8, 30, 10], [1, 1, 32, 40], [3, 0, 1, 1], [6, 3, 62, 62], [0, 5, 1, 32], [9, 4, 32, 40], [5, 7, 32, 40], [2, 2, 62, 1]];
    spots.forEach(([i, j, dx, dz], id) => { let [x, z] = B(i, j, dx, dz); const res = W.pushOut(x, z, 0.6); add('package', res.x, res.z, { id, respawn: -1 }); });
  }
  function update(dt) {
    const P = PLAYER.P; let w = 0;
    for (const p of W.pickups) {
      p.spin += dt * 2; p.t += dt;
      if (p.taken) { if (p.respawn < 0) continue; if (p.t > p.respawn) { p.taken = false; p.t = 0; } W.pickups[w++] = p; continue; }
      if (p.life !== undefined && p.t > p.life) continue;
      const inCar = !!P.car; const r = inCar ? 2.2 : 1.3;
      if (P.alive && M.dist2(P.x, P.z, p.x, p.z) < r * r && (!inCar || p.kind === 'cash' || p.kind === 'bribe' || p.kind === 'package')) {
        p.taken = true; p.t = 0;
        if (p.kind === 'weapon') { PLAYER.giveWeapon(p.weapon, p.ammo); HUD.notify(WEAPONS[p.weapon].name + (WEAPONS[p.weapon].melee ? '' : ' +' + p.ammo)); AUDIO.play('pickup'); }
        else if (p.kind === 'health') { P.health = 100; AUDIO.play('pickup'); HUD.notify('Health restored'); }
        else if (p.kind === 'armor') { P.armor = 100; AUDIO.play('pickup'); HUD.notify('Body armor'); }
        else if (p.kind === 'cash') { PLAYER.addMoney(p.amount, null); }
        else if (p.kind === 'bribe') { POLICE.bribe(); AUDIO.play('pickup'); HUD.notify('Police bribe'); }
        else if (p.kind === 'package') { P.stats.packages++; PLAYER.addMoney(500, 'hidden package ' + P.stats.packages + '/20'); GAME.onPackage(P.stats.packages); }
        if (p.respawn < 0) continue;
      }
      W.pickups[w++] = p;
    }
    W.pickups.length = w;
  }
  function entities(camX, camZ) {
    pkgMesh = pkgMesh || MESH.packageBox().build(); const out = [];
    for (const p of W.pickups) { if (p.taken || M.dist2(p.x, p.z, camX, camZ) > 120 * 120) continue; const m = M.create(); const y = p.y + 0.15 + Math.sin(p.spin * 1.5) * 0.08; const col = COLORS[p.kind];
      if (p.kind === 'package') { M.trs(m, p.x, y, p.z, p.spin, 1, 1, 1); out.push({ mesh: pkgMesh, model: m }); }
      else { M.trs(m, p.x, y, p.z, p.spin, 0.9, 0.9, 0.9); const e = new Float32Array(RENDER.MAX_BONES); e[0] = 0.35; out.push({ mesh: meshFor(p.kind), model: m, emis: e }); }
      W.dyn.length < 24 && W.dyn.push({ x: p.x, y: p.y + 1, z: p.z, r: 4, col: [col[0] * 0.6, col[1] * 0.6, col[2] * 0.6] }); }
    return out;
  }
  return { add, dropCash, placeWorld, update, entities, COLORS };
})();

const MISSIONS = (() => {
  const S = { saveT: 6, sprayT: 0, sprayWarn: 0, current: null, progress: 0, done: {}, dialogue: null, lineT: 0, blip: null, blips: [], objective: '', timer: -1, spawned: [], markers: [], shop: null, side: null, pending: null, cooldown: 0, ending: false };
  const P = () => PLAYER.P;
  const place = (k, i = 0) => CITY.place(k, i);
  const laneSpot = (i, j, di, dj, s, lane = 0) => { const n = CITY.roadNodes[i * (CITY.GRID + 1) + j]; const e = n.out.find(o => o.dx === di && o.dz === dj); let [x, z] = CITY.lanePoint(e, lane, s); if (lane === 1) { x += e.rx * 0.7; z += e.rz * 0.7; } return { x, z, angle: Math.atan2(di, dj), e, lane, s }; };
  const near = (x, z, r, useCar = true) => { const p = P(); return M.dist2(p.x, p.z, x, z) < r * r; };
  const sideOf = (x, z) => { const res = W.pushOut(x, z, 0.5); return [res.x, res.z]; };
  function spawnCar(type, x, z, angle, opts = {}) { for (const o of W.cars) if (!o.removed && !o.important && o !== PLAYER.car && M.dist2(o.x, o.z, x, z) < 100) o.remove(); const c = VEH.spawn(type, x, z, angle, { mode: opts.mode || 'parked', color: opts.color }); c.important = true; c.isMission = true; if (opts.health) { c.maxHealth = opts.health; c.health = opts.health; } S.spawned.push(c); return c; }
  function spawnPed(x, z, opts = {}) { const p = PEDS.spawn(x, z, { important: true, ...opts }); S.spawned.push(p); return p; }
  function cleanup() { for (const e of S.spawned) { if (e instanceof VEH.Vehicle) { e.important = false; if (e.driver && e.driver !== PLAYER) { e.ai.mode = 'traffic'; e.ai.edge = null; } } else { e.important = false; if (e.alive) { e.hostile = false; e.role = null; e.stationary = false; e.isGang = false; if (e.inCar && e.inCar.driver === PLAYER) e.exitCar(); } } } S.spawned.length = 0; S.blip = null; S.blips.length = 0; S.objective = ''; S.timer = -1; S.markers.length = 0; }
  function objective(text) { S.objective = text; }
  function blip(x, z, col = '#f5c542', obj = null, label = '') { S.blip = { x, z, col, obj, label }; }
  function marker(x, z, r = 2, col = [1, 0.85, 0.2]) { S.markers.push({ x, z, r, col }); }
  function say(lines, then) { S.dialogue = { lines, i: 0, then }; S.lineT = 0; P().aim = 0; }
  function pass(reward, text) { AUDIO.play('missionPass'); HUD.big('MISSION PASSED!', '#f5c542', 3); if (reward) PLAYER.addMoney(reward, null); if (S.current) { S.done[S.current.id] = true; if (S.current.id === S.progress) S.progress++; } P().stats.missions++; cleanup(); S.current = null; S.cooldown = 3; if (text) HUD.notify(text); GAME.save(); }
  function fail(reason) { AUDIO.play('missionFail'); HUD.big('MISSION FAILED', '#c0281e', 3); if (reason) HUD.notify(reason); cleanup(); S.current = null; S.cooldown = 3; }
  function onPlayerDown(how) { if (S.current) fail(how === 'busted' ? 'You got busted.' : 'You got wasted.'); if (S.side) endSide(how); }
  function onEnterCar(c) { if (S.current && S.current.onEnterCar) S.current.onEnterCar(c); if (S.side && S.side.onEnterCar) S.side.onEnterCar(c); }
  function onExitCar(c) { if (S.current && S.current.onExitCar) S.current.onExitCar(c); if (S.side && S.side.onExitCar) S.side.onExitCar(c); }
  const fmt = t => { t = Math.max(0, Math.ceil(t)); const m = Math.floor(t / 60), s = t % 60; return m + ':' + (s < 10 ? '0' : '') + s; };

  // ---- Story
  const LIST = [
    { id: 0, name: 'WELCOME TO GRIFT CITY', auto: true,
      intro: [[null, 'You stepped off the ferry with five hundred dollars and a phone number.'], [null, 'The number belongs to Marla Voss. She runs a garage in Midtown and, people say, a great deal more.'], [null, 'Get to VOSS MOTORS. Follow the yellow blip on the radar.']],
      start(d) { const g = place('mission'); blip(g.x, g.z); objective('Go to Voss Motors in Midtown.'); },
      update(d, dt) { const g = place('mission'); if (near(g.x, g.z, 4)) pass(200, 'Marla is waiting inside the yellow marker.'); } },
    { id: 1, name: 'REPO MAN',
      intro: [['MARLA', 'So you drive. Everybody drives. Question is whether you can drive with somebody screaming at you.'], ['MARLA', "A customer stopped paying on a red Falcata. It's parked outside a bar in Northgate. He's a coward: he'll run."], ['MARLA', "Don't let him. Bring the car back here. Try not to scratch it."]],
      start(d) { const s = laneSpot(4, 1, 1, 0, 30, 1); d.car = spawnCar('sports', s.x, s.z, s.angle, { color: 0 }); d.owner = spawnPed(s.x - 3, s.z + 3, { role: 'target', stationary: true, name: 'DEBTOR' }); d.owner.faceTarget = d.car; d.owner.health = 50; d.fled = false; blip(d.car.x, d.car.z, '#f5c542', d.car); objective('Get the red Falcata in Northgate.'); },
      update(d, dt) { const c = d.car, o = d.owner;
        if (c.wrecked) return fail('You destroyed the Falcata.');
        if (!d.fled && o.alive && !o.inCar && near(o.x, o.z, 28)) { d.fled = true; o.say("You'll never take her!"); o.fleeInCar(c, 17); }
        if (c.driver === PLAYER) { const g = place('garage'); blip(g.x, g.z); objective('Take the Falcata back to Voss Motors.'); if (near(g.x, g.z, 7)) { PLAYER.exitCar(); c.locked = true; c.important = false; pass(1000, 'Marla: "Not a scratch. Almost."'); } }
        else if (d.fled) objective('Stop the debtor and take the Falcata.'); } },
    { id: 2, name: 'SPECIAL DELIVERY',
      intro: [['MARLA', "There's a Boxer van round the side with a crate in the back. The crate goes to Pier 9 in Southport."], ['MARLA', "Three minutes. And the crate doesn't like potholes, so keep the van in one piece."], ['MARLA', "Some of Crane's boys may take an interest. Don't stop to chat."]],
      start(d) { const g = place('garage'); d.van = spawnCar('van', g.x + 14, g.z - 8, Math.PI, { color: 2, health: 900 }); blip(d.van.x, d.van.z, '#f5c542', d.van); objective('Get in the Boxer van.'); d.phase = 0; },
      onEnterCar(c) { const d = S.current.data; if (c === d.van && d.phase === 0) { d.phase = 1; S.timer = 180; const k = place('docks'); blip(k.x, k.z); objective('Deliver the crate to Pier 9 in Southport.'); } },
      update(d, dt) { if (d.van.wrecked || d.van.health < d.van.maxHealth * 0.35) return fail('The crate is ruined.'); if (d.phase === 0) return; if (S.timer <= 0) return fail('Too slow. The buyer walked.');
        if (d.phase === 1 && P().car !== d.van) objective('Get back in the van!');
        else if (d.phase === 1) objective('Deliver the crate to Pier 9 in Southport.  ' + fmt(S.timer));
        const k = place('docks'); const dist = M.dist(P().x, P().z, k.x, k.z);
        if (d.phase === 1 && dist < 260 && !d.ambush) { d.ambush = true; for (let i = 0; i < 2; i++) { const s = laneSpot(6 + i, 7, 0, 1, 20, i); const c = spawnCar('muscle', s.x, s.z, s.angle, { mode: 'chase', color: 10 }); c.ai.mode = 'chase'; const p = PEDS.spawn(c.x, c.z, { look: PEDS.GANG, gang: true, hostile: true, weapon: 'uzi', important: true }); p.inCar = c; c.driver = p; S.spawned.push(p); } HUD.notify("Crane's crew are on you!"); }
        if (P().car === d.van && dist < 9 && d.van.absSpeed < 3) { PLAYER.exitCar(); d.van.important = false; pass(1500, 'Marla: "Pier 9 says thank you. In their way."'); } } },
    { id: 3, name: 'COLLECTIONS',
      intro: [['MARLA', "Take this. You'll want it."], ['MARLA', 'A man named Teddy Lark owes me eight thousand dollars and thinks Southport is far enough away.'], ['MARLA', 'Go to his bar. Explain the situation. Bring me the money.']],
      start(d) { PLAYER.giveWeapon('pistol', 60); const [bx, bz] = CITY.blockOrigin(5, 8); const x = bx + 32, z = bz - 4.5; d.spot = [x, z];
        d.teddy = spawnPed(x, z, { role: 'target', stationary: true, name: 'TEDDY', health: 90 }); d.teddy.look = PEDS.CRANE; d.teddy.mesh = PEDS.getMesh(PEDS.CRANE);
        d.goons = []; for (let i = 0; i < 3; i++) { const g = spawnPed(x - 6 + i * 6, z - 1.5, { look: PEDS.GANG, gang: true, stationary: true, weapon: i === 1 ? 'pistol' : null, health: 80 }); g.faceTarget = PLAYER.P; d.goons.push(g); }
        const s = laneSpot(5, 9, -1, 0, 40, 1); d.car = spawnCar('sedan', s.x, s.z, s.angle, { color: 3 }); d.phase = 0; blip(x, z); objective("Go to Teddy Lark's bar in Southport."); },
      update(d, dt) { const t = d.teddy;
        if (d.phase === 0 && near(d.spot[0], d.spot[1], 18)) { d.phase = 1; for (const g of d.goons) { g.stationary = false; g.hostile = true; } t.say("Who let you in here?"); objective('Deal with the goons.'); }
        if (d.phase === 1 && (d.goons.every(g => !g.alive) || near(t.x, t.z, 6) || W.state.noises.length)) { d.phase = 2; t.say("Marla can wait!"); objective("Don't let Teddy get away!"); blip(t.x, t.z, '#f5c542', t); t.fleeInCar(d.car, 16); }
        if (d.phase === 2 && t.alive && t.state !== 'goto' && !t.inCar && !d.car.wrecked && !d.car.driver) { t.fleeInCar(d.car, 16); }
        if (d.phase === 2 && t.inCar) blip(d.car.x, d.car.z, '#f5c542', d.car);
        if (d.phase === 2 && t.inCar && d.car.wrecked) { t.die(PLAYER, 'explosion'); }
        if (d.phase === 2 && !t.alive) { d.phase = 3; const p = PICKUPS.add('cash', t.x, t.z, { amount: 8000, respawn: -1 }); d.cash = p; blip(t.x, t.z, '#3df06a'); objective("Pick up Teddy's money."); }
        if (d.phase === 3 && d.cash.taken) { d.phase = 4; const g = place('mission'); blip(g.x, g.z); objective('Take the money back to Marla.'); }
        if (d.phase === 4) { const g = place('mission'); if (near(g.x, g.z, 4) && !P().car) { PLAYER.addMoney(-8000, "Marla's money"); pass(2500, 'Marla: "Teddy always was slow at math."'); } } } },
    { id: 4, name: 'GRAND THEFT AUTO',
      intro: [['MARLA', 'I have a buyer with expensive taste and no patience.'], ['MARLA', 'He wants three vehicles: a CABCO taxi, an ENFORCER police cruiser, and a city TRANSIT bus.'], ['MARLA', "Park each one in the marker outside and get out. The cruiser will be the hard part. Cops love their cars."]],
      start(d) { d.need = { taxi: false, police: false, bus: false }; const g = place('garage'); marker(g.x, g.z, 4); d.tip = 0; objective('Steal a CABCO taxi, an ENFORCER cruiser and a TRANSIT bus. Deliver each to the garage marker.'); },
      onExitCar(c) { const d = S.current.data; const g = place('garage'); if (c.type in d.need && !d.need[c.type] && M.dist(c.x, c.z, g.x, g.z) < 7) { d.need[c.type] = true; c.locked = true; c.important = false; c.ai.mode = 'parked'; AUDIO.play('checkpoint'); HUD.notify(VEH.NAMES[c.type] + ' delivered'); setTimeout(() => { c.remove(); }, 2500); } },
      update(d, dt) { const left = Object.keys(d.need).filter(k => !d.need[k]); if (!left.length) return pass(2500, 'Marla: "He says the bus smells. He says that about everything."');
        objective('Deliver: ' + left.map(k => VEH.NAMES[k]).join(', ') + '. Park in the garage marker and get out.');
        const g = place('garage'); if (P().car && left.includes(P().car.type)) blip(g.x, g.z); else if (left.includes('police')) { const ps = CITY.nearestPlace('police', P().x, P().z); blip(ps.x, ps.z, '#5aa0ff'); } else S.blip = null; } },
    { id: 5, name: 'MIDNIGHT RUN',
      intro: [['MARLA', 'Some kids race the loop around Downtown. Three laps, no rules, and there is a purse.'], ['MARLA', 'I put your name down. Get to the start line. Beat them and the purse is yours.'], ['MARLA', "The Falcata you brought me is outside. You've earned a drive."]],
      start(d) { const pts = []; const loop = [[3, 3, 1, 0], [7, 3, 0, 1], [7, 7, -1, 0], [3, 7, 0, -1]]; for (let k = 0; k < 4; k++) { const [i, j, di, dj] = loop[k]; const s1 = laneSpot(i, j, di, dj, 24, 0); pts.push([s1.x, s1.z]); const s2 = laneSpot(i, j, di, dj, CITY.laneLen(s1.e) - 6, 0); pts.push([s2.x, s2.z]); }
        d.route = pts; d.cp = 0; d.lap = 0; d.laps = 3; d.started = false; d.count = -1;
        const st = laneSpot(3, 3, 1, 0, 8, 0); d.startPt = [st.x, st.z]; d.rivals = []; const g = place('garage'); d.car = spawnCar('sports', g.x + 14, g.z - 8, Math.PI, { color: 0 }); d.car.locked = false;
        for (let k = 0; k < 3; k++) { const s = laneSpot(3, 3, 1, 0, 2 + k * 7, k % 2); const c = spawnCar(['sports', 'muscle', 'sports'][k], s.x, s.z, s.angle, { color: [1, 6, 9][k] }); c.ai.route = pts.map(p => [p[0], p[1], 9]); c.ai.routeIdx = 0; c.ai.routeLoop = true; c.ai.routeSpeed = [26, 24, 27][k]; c.ai.mode = 'parked'; c.rivalCp = 0; c.rivalLap = 0; const drv = PEDS.spawn(c.x, c.z, { important: true }); drv.inCar = c; c.driver = drv; drv.state = 'driving'; S.spawned.push(drv); d.rivals.push(c); }
        blip(st.x, st.z); objective('Get to the start line by the Downtown loop.'); },
      update(d, dt) {
        if (!d.started) { if (P().car && near(d.startPt[0], d.startPt[1], 12)) { d.started = true; d.count = 3.99; } return; }
        if (d.count > 0) { d.count -= dt; const n = Math.ceil(d.count); HUD.big(n > 0 ? String(n) : 'GO!', '#f5c542', 0.5); if (d.count <= 0) { for (const r of d.rivals) r.ai.mode = 'route'; AUDIO.play('checkpoint'); } return; }
        if (!P().car) objective('Get back in a car!');
        const cp = d.route[d.cp]; blip(cp[0], cp[1], '#3df06a'); marker(cp[0], cp[1], 5, [0.3, 1, 0.4]);
        if (near(cp[0], cp[1], 8)) { d.cp++; AUDIO.play('checkpoint'); if (d.cp >= d.route.length) { d.cp = 0; d.lap++; if (d.lap >= d.laps) { for (const r of d.rivals) r.ai.mode = 'traffic'; return pass(3000, 'You won the purse. The kids are furious.'); } HUD.big('LAP ' + (d.lap + 1), '#f5c542', 1.5); } }
        let pos = 1; for (const r of d.rivals) { if (r.wrecked) continue; const rp = d.route[r.rivalCp]; if (M.dist(r.x, r.z, rp[0], rp[1]) < 10) { r.rivalCp++; if (r.rivalCp >= d.route.length) { r.rivalCp = 0; r.rivalLap++; if (r.rivalLap >= d.laps) return fail('You lost the race.'); } } if (r.rivalLap * 100 + r.rivalCp > d.lap * 100 + d.cp) pos++; }
        objective('Race! Lap ' + (d.lap + 1) + '/' + d.laps + '   Position ' + pos + '/4'); } },
    { id: 6, name: 'HOT PROPERTY',
      intro: [['MARLA', 'Silas Crane runs Crane Holdings, which is a polite way of saying he runs Grift City.'], ['MARLA', "Tonight he's moving product through Pier 9 in four HAULER trucks. I want the trucks gone. All of them."], ['MARLA', "Take these. Then lose the heat; the cops will be all over you afterwards."]],
      start(d) { PLAYER.giveWeapon('rocket', 6); PLAYER.giveWeapon('grenade', 4); const k = place('docks'); d.trucks = []; for (let i = 0; i < 4; i++) { const t = spawnCar('truck', k.x + i * 9 - 8, k.z + 12, 0, { color: 2 }); t.locked = true; d.trucks.push(t); const g = spawnPed(k.x + i * 9 - 8, k.z + 6, { look: PEDS.GANG, gang: true, stationary: true, weapon: i % 2 ? 'uzi' : 'pistol', health: 90 }); g.faceTarget = PLAYER.P; } d.phase = 0; blip(k.x, k.z); objective('Destroy the four Hauler trucks at Pier 9.'); },
      update(d, dt) { const left = d.trucks.filter(t => !t.wrecked).length; if (d.phase === 0) { objective('Destroy the Hauler trucks: ' + left + ' left.'); if (near(place('docks').x, place('docks').z, 40)) for (const e of S.spawned) if (e.isGang) e.hostile = true; if (left === 0) { d.phase = 1; POLICE.setStars(3); S.blip = null; objective('Lose the cops!'); } }
        else if (P().wanted === 0) pass(4000, 'Marla: "Crane will notice. Good."'); } },
    { id: 7, name: 'THE FIRST GRIFT',
      intro: [['MARLA', 'Bank job. First Grift Bank, Downtown. Two of my people ride with you.'], ['MARLA', 'Get them to the door. Hold the street while they work. Sixty seconds, maybe more, the cops will come in force.'], ['MARLA', 'Then get everyone back to the safehouse. Everyone. I do not replace people easily.']],
      start(d) { const g = place('mission'); d.crew = []; for (let i = 0; i < 2; i++) { const c = spawnPed(g.x + 3 + i * 2, g.z + 1, { role: 'crew', weapon: 'uzi', health: 160 }); c.weaponOut = true; c.look = PEDS.SWAT; c.mesh = PEDS.getMesh(PEDS.SWAT); d.crew.push(c); } PLAYER.giveWeapon('uzi', 120); if (P().armor < 100) P().armor = 100; d.phase = 0; const b = place('bank'); blip(b.x, b.z); objective('Take the crew to First Grift Bank.'); },
      update(d, dt) { const b = place('bank'); const alive = d.crew.filter(c => c.alive);
        if (!alive.length) return fail('The whole crew is dead.');
        if (d.phase === 0) { if (near(b.x, b.z, 12) && alive.every(c => M.dist(c.x, c.z, b.x, b.z) < 18)) { d.phase = 1; S.timer = 60; for (const c of alive) { if (c.inCar) c.exitCar(); c.role = 'crewwork'; c.stationary = true; c.x = b.x + (W.rng() - 0.5) * 3; c.z = b.z + 1.5; } POLICE.setStars(3); objective('Hold the street while the crew works.'); } else if (P().car && alive.some(c => !c.inCar)) objective('Wait for the crew to get in.'); }
        else if (d.phase === 1) { objective('Hold the street while the crew works.  ' + fmt(S.timer)); if (S.timer < 30 && P().wanted < 4) POLICE.setStars(4); for (const c of alive) { c.state = 'walk'; c.speed = 0; } if (S.timer <= 0) { d.phase = 2; S.timer = -1; for (const c of alive) { c.role = 'crew'; c.stationary = false; } const s = place('safehouse'); blip(s.x, s.z); objective('Get the crew back to the safehouse!'); PLAYER.addMoney(0, null); } }
        else if (d.phase === 2) { const s = place('safehouse'); if (near(s.x, s.z, 8) && alive.every(c => M.dist(c.x, c.z, s.x, s.z) < 14 || c.inCar)) { for (const c of alive) if (c.inCar) c.exitCar(); POLICE.clear(); pass(10000, 'Marla: "Everyone. Good."'); } else if (P().car && alive.some(c => !c.inCar)) objective('Wait for the crew to get in the car.'); else objective('Get the crew back to the safehouse!'); } } },
    { id: 8, name: 'CRANE',
      intro: [['MARLA', 'Crane knows it was us. He is leaving town at dawn from his tower, with everything he has left.'], ['MARLA', 'He has an armoured Bastion and a small army in the plaza. Make sure the Bastion never reaches the bridge.'], ['MARLA', 'After that, every cop in Grift City will want you. Get to the safehouse and we will talk about the future.']],
      start(d) { const t = place('tower'); PLAYER.giveWeapon('rifle', 150); PLAYER.giveWeapon('rocket', 4); d.guards = []; for (let i = 0; i < 8; i++) { const a = i / 8 * M.TAU; const [gx, gz] = sideOf(t.x + Math.sin(a) * 10, t.z + Math.cos(a) * 6 - 2); const g = spawnPed(gx, gz, { look: PEDS.GANG, gang: true, stationary: true, weapon: ['rifle', 'uzi', 'shotgun', 'pistol'][i % 4], health: 110 }); g.faceTarget = PLAYER.P; d.guards.push(g); }
        d.crane = spawnPed(t.x, t.z + 1, { role: 'target', stationary: true, name: 'CRANE', health: 200 }); d.crane.look = PEDS.CRANE; d.crane.mesh = PEDS.getMesh(PEDS.CRANE);
        d.car = spawnCar('swat', t.x + 16, t.z - 1, -Math.PI / 2, { health: 3600 }); d.car.locked = true; d.phase = 0; blip(t.x, t.z); objective('Get to Crane Holdings, Downtown.'); },
      update(d, dt) { const t = place('tower'); const c = d.crane;
        if (d.phase === 0 && (near(t.x, t.z, 34) || W.state.noises.some(n => M.dist(n.x, n.z, t.x, t.z) < 60))) { d.phase = 1; for (const g of d.guards) { g.stationary = false; g.hostile = true; } c.say('Kill them!'); objective("Stop Crane's Bastion!"); blip(d.car.x, d.car.z, '#f5c542', d.car); c.fleeInCar(d.car, 21); }
        if (d.phase === 1 && c.alive && !c.inCar && c.state !== 'goto' && !d.car.driver && !d.car.wrecked) c.fleeInCar(d.car, 21);
        if (d.phase === 1 && ((c.inCar && d.car.wrecked) || !c.alive)) { if (c.alive) c.die(PLAYER, 'explosion'); d.phase = 2; POLICE.setStars(5); const s = place('safehouse'); blip(s.x, s.z); objective('Crane is finished. Get to the safehouse!'); HUD.big('CRANE IS DEAD', '#f5c542', 3); }
        if (d.phase === 2) { const s = place('safehouse'); if (near(s.x, s.z, 8)) { POLICE.clear(); pass(25000, null); S.ending = true; say([['MARLA', 'It is done. Crane is gone, and every crook on this island is asking who you are.'], ['MARLA', 'You know what? Let them ask.'], [null, 'GRIFT CITY IS YOURS.'], [null, 'Thanks for playing. The city stays open: side jobs, packages, and the police, who never forget.']], () => { S.ending = false; }); } } } },
  ];

  // ---- Side jobs
  function startSide(kind, car) {
    if (kind === 'taxi') { S.side = { kind, car, fare: null, phase: 0, earned: 0, fares: 0, timer: 0 }; HUD.notify('TAXI: pick up the fare. F ends the shift.'); newFare(); }
    else if (kind === 'vigilante') { S.side = { kind, car, level: 1, target: null, timer: 0 }; HUD.notify('VIGILANTE: take down the suspect.'); newSuspect(); }
  }
  function endSide(how) { if (!S.side) return; const s = S.side; if (s.kind === 'taxi') HUD.notify('Shift over. ' + s.fares + ' fares, $' + s.earned); else HUD.notify('Vigilante ended at level ' + s.level); if (s.fare && s.fare.alive) { s.fare.role = null; s.fare.important = false; if (s.fare.inCar) s.fare.exitCar(); } if (s.target) s.target.important = false; S.side = null; S.blip = null; S.objective = ''; }
  function newFare() { const s = S.side; const p = P(); let n; for (let t = 0; t < 30; t++) { n = CITY.walkNodes[Math.floor(W.rng() * CITY.walkNodes.length)]; const d = M.dist(n.x, n.z, p.x, p.z); if (d > 60 && d < 220) break; } s.fare = PEDS.spawn(n.x, n.z, { important: true, role: 'fare', stationary: true }); s.fare.faceTarget = p; s.phase = 0; let dest; for (let t = 0; t < 30; t++) { dest = CITY.walkNodes[Math.floor(W.rng() * CITY.walkNodes.length)]; const d = M.dist(dest.x, dest.z, n.x, n.z); if (d > 150 && d < 400) break; } s.dest = dest; s.timer = 40 + M.dist(dest.x, dest.z, n.x, n.z) * 0.14; }
  function newSuspect() { const s = S.side; for (let t = 0; t < 20; t++) { const e = CITY.roadEdges[Math.floor(W.rng() * CITY.roadEdges.length)]; const L = CITY.laneLen(e); const sp = 10 + W.rng() * (L - 20); const [x, z] = CITY.lanePoint(e, 0, sp); const d = M.dist(x, z, P().x, P().z); if (d < 120 || d > 260) continue; const c = VEH.spawn(['sedan', 'muscle', 'sports', 'pickup'][s.level % 4], x, z, 0, { mode: 'flee' }); c.placeOnLane(e, 0, sp); c.ai.mode = 'flee'; c.scared = 1e9; c.ai.cruise = 16 + s.level * 1.5; c.important = true; const drv = PEDS.spawn(c.x, c.z, { look: PEDS.GANG, gang: true, hostile: true, weapon: 'pistol', important: true }); drv.inCar = c; c.driver = drv; drv.state = 'driving'; s.target = c; s.driver = drv; s.timer = 90; return; } }
  function updateSide(dt) {
    const s = S.side, p = P(); if (!s) return;
    if (p.car !== s.car || s.car.wrecked) return endSide();
    if (s.kind === 'taxi') {
      const f = s.fare; if (!f.alive) { HUD.notify('Your fare is dead.'); return endSide(); }
      if (s.phase === 0) { blip(f.x, f.z, '#f5c542', f); objective('Pick up the fare.'); if (M.dist(f.x, f.z, s.car.x, s.car.z) < 7 && s.car.absSpeed < 1) { f.stationary = false; f.enterCar(s.car); s.phase = 1; AUDIO.play('door', f.x, f.z); } }
      else { s.timer -= dt; blip(s.dest.x, s.dest.z, '#3df06a'); marker(s.dest.x, s.dest.z, 4, [0.3, 1, 0.4]); objective('Take the fare to the destination.  ' + fmt(s.timer)); if (s.timer <= 0) { f.exitCar(); f.important = false; f.role = null; HUD.notify('The fare got out. Too slow.'); return endSide(); }
        if (M.dist(s.dest.x, s.dest.z, s.car.x, s.car.z) < 9 && s.car.absSpeed < 1) { f.exitCar(); f.important = false; f.role = null; f.scare && (f.fear = 0); const pay = 60 + Math.floor(s.timer * 4); PLAYER.addMoney(pay, 'fare'); s.earned += pay; s.fares++; newFare(); } }
    } else {
      const t = s.target; s.timer -= dt; blip(t.x, t.z, '#f5c542', t); objective('Take down the suspect. Level ' + s.level + '  ' + fmt(s.timer));
      if (s.timer <= 0) { t.important = false; return endSide(); }
      if (t.wrecked || !s.driver.alive) { PLAYER.addMoney(400 * s.level, 'vigilante'); s.level++; t.important = false; POLICE.bribe(); newSuspect(); }
    }
  }

  // ---- Shops, spray, safehouse
  const GUNS = [['pistol', 250, 34], ['uzi', 650, 90], ['shotgun', 800, 24], ['rifle', 1800, 90], ['rocket', 6000, 3], ['grenade', 900, 6], ['armor', 400, 0]];
  function updateShops(dt) {
    const p = P(); if (!p.alive) return;
    if (S.shop) { objective(''); if (INPUT.hit('Escape') || INPUT.hit('KeyF') || M.dist2(p.x, p.z, S.shop.x, S.shop.z) > 16) { S.shop = null; return; }
      for (let i = 0; i < GUNS.length; i++) if (INPUT.hit('Digit' + (i + 1))) { const [k, price, ammo] = GUNS[i]; if (p.money < price) { HUD.notify('Not enough cash.'); AUDIO.play('click'); } else { PLAYER.addMoney(-price, null); if (k === 'armor') p.armor = 100; else PLAYER.giveWeapon(k, ammo); AUDIO.play('pickup'); HUD.notify('Bought ' + (k === 'armor' ? 'body armor' : WEAPONS[k].name)); } }
      return; }
    for (const g of CITY.places.guns) if (!p.car && M.dist2(p.x, p.z, g.x, g.z) < 4) { S.shop = g; AUDIO.play('click'); }
    for (const sp of CITY.places.spray) if (p.car && M.dist2(p.car.x, p.car.z, sp.x, sp.z) < 16 && p.car.absSpeed < 1.5) { if (S.sprayT === undefined || S.sprayT <= 0) { if (p.money >= 100) { PLAYER.addMoney(-100, "Pay 'n' Spray"); p.car.health = p.car.maxHealth; p.car.fireT = 0; p.car.colIdx = Math.floor(W.rng() * VEH.PALETTE.length); if (!(p.car.type in { taxi: 1, police: 1, swat: 1, bus: 1 })) p.car.mesh = VEH.getMesh(p.car.type, p.car.colIdx); POLICE.clear(); HUD.fade(1.2); AUDIO.play('pickup'); S.sprayT = 6; } else if (!S.sprayWarn) { HUD.notify("Pay 'n' Spray costs $100."); S.sprayWarn = 4; } } }
    if (S.sprayT > 0) S.sprayT -= dt; if (S.sprayWarn > 0) S.sprayWarn -= dt;
    const sh = place('safehouse'); if (!p.car && M.dist2(p.x, p.z, sh.x, sh.z) < 4 && (S.saveT === undefined || S.saveT <= 0)) { S.saveT = 8; p.health = 100; POLICE.clear(); GAME.save(); W.state.time = (W.state.time + 6) % 24; HUD.fade(1.5); HUD.notify('Game saved. You slept until ' + W.clockString() + '.'); }
    if (S.saveT > 0) S.saveT -= dt;
    // side jobs
    if (p.car && !S.side && !S.current && INPUT.hit('KeyT')) { if (p.car.type === 'taxi') startSide('taxi', p.car); else if (p.car.type === 'police' || p.car.type === 'swat') startSide('vigilante', p.car); }
    if (S.side && INPUT.hit('KeyT')) endSide();
  }

  function update(dt) {
    if (S.cooldown > 0) S.cooldown -= dt;
    if (S.dialogue) { const d = S.dialogue; S.lineT += dt; if (S.lineT > 4.2 || INPUT.hit('Space') || INPUT.hit('Enter') || INPUT.mouse.clicked || INPUT.pad.pressed[0]) { d.i++; S.lineT = 0; AUDIO.play('click'); if (d.i >= d.lines.length) { S.dialogue = null; if (d.then) d.then(); } } return; }
    if (S.timer > 0) S.timer -= dt;
    const p = P();
    if (S.current) { try { S.current.update(S.current.data, dt); } catch (e) { console.error(e); fail('Something went wrong.'); } }
    else if (p.alive && S.cooldown <= 0 && !S.side) {
      const next = LIST[S.progress];
      if (next && next.auto) start(next);
      else if (next && !p.car) { const g = place('mission'); marker(g.x, g.z, 2, [1, 0.85, 0.2]); if (S.blip === null) blip(g.x, g.z, '#f5c542', null, 'M'); if (M.dist2(p.x, p.z, g.x, g.z) < 4) start(next); }
    }
    updateSide(dt); updateShops(dt);
  }
  function start(m) { S.current = m; m.data = {}; S.blip = null; S.markers.length = 0; HUD.big(m.name, '#f5c542', 3); if (m.intro) say(m.intro, () => { m.start(m.data); }); else m.start(m.data); }
  function markersFX(t) { for (const mk of S.markers) W.fx.marker(mk.x, mk.z, mk.r, 1.6, mk.col, t); if (!S.current && !S.side) { for (const g of CITY.places.guns) W.fx.marker(g.x, g.z, 1.4, 1.6, [1, 0.3, 0.3], t); for (const sp of CITY.places.spray) W.fx.marker(sp.x, sp.z, 2.6, 1.6, [1, 0.8, 0.2], t); const sh = place('safehouse'); W.fx.marker(sh.x, sh.z, 1.4, 1.6, [1, 0.5, 0.9], t); } else { for (const sp of CITY.places.spray) W.fx.marker(sp.x, sp.z, 2.6, 1.6, [1, 0.8, 0.2], t); } }
  function blipPos() { if (!S.blip) return null; const b = S.blip; if (b.obj) { if (b.obj.removed) return null; return { x: b.obj.x, z: b.obj.z, col: b.col }; } return b; }
  return { S, LIST, GUNS, update, start, onPlayerDown, onEnterCar, onExitCar, markersFX, blipPos, get objective() { return S.objective; }, get dialogue() { return S.dialogue; }, get shop() { return S.shop; }, get timer() { return S.timer; }, fmt, cleanup, endSide };
})();
