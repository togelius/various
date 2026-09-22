// GRIFT CITY — heat. Crimes raise it, cops answer it: foot patrols, cruisers, roadblocks, SWAT and a helicopter.
'use strict';
const POLICE = (() => {
  const S = { heat: 0, seenT: 99, lastSeen: null, arrestT: 0, arresting: false, spawnT: 0, roadblockT: 20, footT: 0, heliT: 0, evadeMsg: 0, sirenVol: 0 };
  const HEAT = { kill: 1.0, killcar: 0.55, copkill: 1.6, cop: 1.0, jack: 0.45, hit: 0.2, assault: 0.25, shoot: 0.12, explosion: 1.3, vandal: 0.12 };
  const stars = () => Math.min(5, Math.floor(S.heat));
  const COOLDOWN = { shoot: 1.5, assault: 1.2, hit: 0.6, vandal: 1.0 }; const lastCrime = {};
  const reports=[];let unitSerial=0;
  function description(){const p=PLAYER.P,c=p.car;return {vehicle:c?c.identity:null,color:c?c.colIdx:null,type:c?c.type:null,outfit:p.outfit||0};}
  function raise(h){const before=stars();S.heat=Math.min(5.99,S.heat+Math.min(1,h/(1+S.heat*.6)));if(stars()>before){AUDIO.play('star');HUD.flashStars();if(!before)S.spawnT=2.5;}PLAYER.P.wanted=stars();}
  function crime(kind,x,z,victim){const p=PLAYER.P;if(!p.alive)return;
    if(COOLDOWN[kind]){const now=W.state.elapsed;if(lastCrime[kind]!==undefined&&now-lastCrime[kind]<COOLDOWN[kind])return;lastCrime[kind]=now;}
    const visible=o=>W.sight3(o.x,(o.y||0)+1.5,o.z,x,p.y+1.2,z,[o.inCar||o,p.car]);
    const cop=W.peds.find(o=>o.isCop&&o.alive&&M.dist(o.x,o.z,x,z)<70&&visible(o))||W.cars.find(o=>!o.removed&&o.driver?.isCop&&M.dist(o.x,o.z,x,z)<70&&visible(o));
    const heat=HEAT[kind]||.2;
    if(cop){raise(heat*1.4);seen(cop);return;}
    const witnesses=W.pedsNear(x,z,30).filter(o=>o.alive&&!o.isCop&&!o.isGang&&o!==victim&&!o.inCar&&visible(o));
    const witness=witnesses.find(o=>!reports.some(r=>r.witness===o));
    if(witness){const report={witness,x,z,y:p.y,heat,kind,description:description(),left:3.4+W.rng()*1.6};reports.push(report);witness.reporting=report.left;witness.reportItem=witness.item;witness.item='phone';witness.say?.('Calling it in!');if(reports.length===1)HUD.notify('A witness is calling police. Leave the reported area.');}
    else if(witnesses.length){const r=reports.find(r=>witnesses.includes(r.witness));if(r)r.heat=Math.min(1.4,r.heat+heat*.35);}
    else {raise(kind==='shoot'?.02:heat*.12);} // anonymous noise adds suspicion, never a location
  }
  function updateReports(dt){for(let i=reports.length-1;i>=0;i--){const r=reports[i],p=r.witness;if(!p.alive||p.removed){if(p)p.reporting=0;reports.splice(i,1);continue;}r.left-=dt;p.reporting=Math.max(0,r.left);if(r.left<=0){p.item=p.reportItem||null;raise(r.heat);if(S.seenT>2){S.lastSeen=[r.x,r.z];S.lastY=r.y;S.seenT=5;S.description=r.description;S.search=null;S.reportEpoch=(S.reportEpoch||0)+1;}HUD.notify('Police received a witness report.');reports.splice(i,1);}}}
  function seen(cop){const p=PLAYER.P;S.seenT=0;S.lastSeen=[p.x,p.z];S.lastY=p.y;S.description=description();S.search=null;S.motion=p.car?{f:p.car.fwd.slice(),speed:p.car.absSpeed}:null;if(cop){cop.observation={x:p.x,y:p.y,z:p.z,time:W.state.elapsed};}}
  function identified(unit){const p=PLAYER.P,d=M.dist(unit.x,unit.z,p.x,p.z),desc=S.description;if(!desc||S.seenT<2.5)return true;if(p.car)return (p.car.identity===desc.vehicle&&p.car.colIdx===desc.color)||(d<12&&p.car.absSpeed<6);return (p.outfit||0)===desc.outfit?d<45:d<10;}
  function observe(unit){const p=PLAYER.P,o=unit.inCar||unit,d=M.dist(o.x,o.z,p.x,p.z),range=70*(1-.5*(W.weather?.fog||0))*(W.isNight()?.8:1);if(d>range||!identified(o))return false;
    if(d>12&&Number.isFinite(o.angle)){const a=Math.atan2(p.x-o.x,p.z-o.z);if(Math.abs(M.angleTo(o.angle,a))>Math.PI*.7)return false;}
    if(!W.sight3(o.x,(o.y||0)+1.5,o.z,p.x,p.y+1.2,p.z,[o,p.car]))return false;seen(unit);return true;
  }
  function pursuitPoint(unit){if(!S.lastSeen)return [CITY.SIZE/2,CITY.SIZE/2];if(S.seenT<2.5)return S.lastSeen;
    const u=unit||S;if(!u.searchId)u.searchId=++unitSerial;const epoch=Math.floor(W.state.elapsed/7)+(S.reportEpoch||0)*100;
    if(u.searchEpoch!==epoch||!u.searchPoint){u.searchEpoch=epoch;const a=(u.searchId*2.399963+epoch*.7)%M.TAU,r=18+Math.min(70,S.seenT*3)*( .45+(u.searchId%3)*.2),x=S.lastSeen[0]+Math.sin(a)*r,z=S.lastSeen[1]+Math.cos(a)*r;const n=CITY.nearestWalkNode(x,z);u.searchPoint=n?[n.x,n.z]:[x,z];}
    return u.searchPoint;
  }
  function arrestProgress(dt, cop) { S.arrestT += dt; S.arresting = true; if (S.arrestT > 0.7) PLAYER.bust(); }
  function clear() { S.heat = 0; PLAYER.P.wanted = 0; S.seenT = 99; S.lastSeen = null; S.search = null; S.description=null;reports.forEach(r=>{r.witness.reporting=0;r.witness.item=r.witness.reportItem||null;});reports.length=0;for(const k in lastCrime)delete lastCrime[k]; for (const c of W.cars) if (!c.removed && c.driver && c.driver.isCop && c.ai.mode === 'chase') { c.ai.mode = 'traffic'; c.ai.edge = null; c.siren = false; } if (W.heli) W.heli.leaving = true; }
  function setStars(n) { S.heat = Math.max(S.heat, n); PLAYER.P.wanted = stars(); S.seenT = 0; S.lastSeen = [PLAYER.x, PLAYER.z];S.lastY=PLAYER.P.y;S.description=description(); S.spawnT = 2.5; }
  function bribe() { S.heat = Math.max(0, S.heat - 1); PLAYER.P.wanted = stars(); }

  function counts() { let foot = 0, cars = 0, swat = 0; for (const p of W.peds) if (p.alive && p.isCop && !p.inCar) foot++; for (const c of W.cars) if (!c.removed && !c.wrecked && (c.type === 'police' || c.type === 'swat') && c.ai.mode === 'chase') { cars++; if (c.type === 'swat') swat++; } return { foot, cars, swat }; }
  function laneSpotAway(minD, maxD, ahead) {
    const P = S.seenT > 2.5 && S.lastSeen ? { x: S.lastSeen[0], z: S.lastSeen[1], car: null } : PLAYER.P; const cands = [];
    for (const e of CITY.roadEdges) { const mx = (e.from.x + e.to.x) / 2, mz = (e.from.z + e.to.z) / 2; const d = M.dist(mx, mz, P.x, P.z); if (d < minD - 40 || d > maxD + 40) continue; cands.push(e); }
    for (let t = 0; t < 30 && cands.length; t++) {
      const e = cands[Math.floor(W.rng() * cands.length)]; const L = CITY.laneLen(e); const s = 5 + W.rng() * (L - 10); const lane = W.rng() < 0.5 ? 0 : 1; const [x, z] = CITY.lanePoint(e, lane, s); const d = M.dist(x, z, P.x, P.z);
      if (d < minD || d > maxD) continue;
      if (ahead && P.car && P.car.absSpeed > 5 && t < 20) { const f = P.car.fwd; if ((x - P.x) * f[0] + (z - P.z) * f[1] < 0) continue; }
      if(M.dist(x,z,PLAYER.x,PLAYER.z)<125&&W.sight3(x,1.5,z,PLAYER.x,PLAYER.P.y+1.2,PLAYER.z,[PLAYER.car]))continue;
      return { e, lane, s, x, z };
    }
    return null;
  }
  function spawnCar(swat) {
    const spot = laneSpotAway(90, 170, true); if (!spot) return;
    const c = VEH.spawn(swat ? 'swat' : 'police', spot.x, spot.z, 0, { mode: 'chase' }); c.placeOnLane(spot.e, spot.lane, spot.s); c.ai.mode = 'chase'; c.siren = true; c.lightsOn = true; c.important = false;
    const d = PEDS.spawnCop(c.x, c.z, { swat }); d.inCar = c; c.driver = d; d.car = c; d.state = 'driving';
    const n = swat ? 3 : 1; for (let i = 0; i < n; i++) { const p = PEDS.spawnCop(c.x, c.z, { swat, weapon: swat ? 'rifle' : (PLAYER.wanted >= 3 ? 'shotgun' : 'pistol') }); p.enterCar(c); p.car = c; }
    return c;
  }
  function spawnFoot() {
    const P = S.seenT > 2.5 && S.lastSeen ? { x: S.lastSeen[0], z: S.lastSeen[1], wanted: PLAYER.wanted } : PLAYER.P; const cands = CITY.walkNodes.filter(n => { const d = M.dist(n.x, n.z, P.x, P.z); return d > 35 && d < 75; }); if (!cands.length) return;
    for (let t = 0; t < 10; t++) { const n = cands[Math.floor(W.rng() * cands.length)]; const d = M.dist(n.x, n.z, P.x, P.z); if (W.los(n.x, n.z, P.x, P.z) && d < 50 && t < 8) continue; const p = PEDS.spawnCop(n.x, n.z, { weapon: P.wanted >= 3 ? 'shotgun' : 'pistol' }); p.alerted = 10; return p; }
  }
  function spawnRoadblock() {
    if(!S.lastSeen||!S.motion||S.seenT>8)return;const P={x:S.lastSeen[0],z:S.lastSeen[1]},f=S.motion.f;const spd=Math.max(S.motion.speed,8);
    // an intersection roughly ahead
    let best = null, bd = 1e9; for (const n of CITY.roadNodes) { const dx = n.x - P.x, dz = n.z - P.z; const along = dx * f[0] + dz * f[1]; const across = Math.abs(-dx * f[1] + dz * f[0]); if (along < 70 || along > 170 || across > 12) continue; const d = along + across * 3; if (d < bd) { bd = d; best = n; } }
    if (!best) return;
    const perp = [f[1], -f[0]]; const ang = Math.atan2(perp[0], perp[1]);
    const bx = best.x - f[0] * 2, bz = best.z - f[1] * 2;
    for (let k = -1; k <= 1; k += 2) { const c = VEH.spawn('police', bx + perp[0] * k * 2.6, bz + perp[1] * k * 2.6, ang, { mode: 'parked' }); c.siren = true; c.lightsOn = true; c.roadblock = true; c.ai.mode = 'parked';
      const p = PEDS.spawnCop(bx + perp[0] * k * 3 + f[0] * 3.5, bz + perp[1] * k * 3 + f[1] * 3.5, { weapon: 'shotgun' }); p.alerted = 20; p.car = c; }
    HUD.notify('Roadblock ahead!');
  }

  // ---- Helicopter
  function spawnHeli() {
    const P = PLAYER.P; const a = W.rng() * M.TAU; const h = { x: P.x + Math.sin(a) * 160, z: P.z + Math.cos(a) * 160, y: 45, vx: 0, vz: 0, vy: 0, angle: a, health: 520, maxHealth: 520, dead: false, rotor: 0, gunT: 1, orbit: W.rng() * M.TAU, leaving: false, bones: new Float32Array(16 * RENDER.MAX_BONES), emis: new Float32Array(RENDER.MAX_BONES), model: M.create(), mesh: MESH.heli().build(), tilt: 0, roll: 0, deadT: 0, removed: false, spot: 0 };
    for (let i = 0; i < RENDER.MAX_BONES; i++) h.bones.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], i * 16);
    h.damage = (amount, src) => { if (h.dead) return; h.health -= amount; if (h.health <= 0) { h.dead = true; h.deadT = 0; W.FX.explosion(h.x, h.y, h.z, 1); AUDIO.play('explosion', h.x, h.z); if (src === PLAYER) PLAYER.addMoney(2500, 'helicopter down'); } };
    W.heli = h; return h;
  }
  const tmpB = M.create();
  function updateHeli(dt) {
    const h = W.heli; if (!h) return; const P = PLAYER.P;
    if (h.dead) { h.deadT += dt; h.vy -= 12 * dt; h.y += h.vy * dt; h.x += h.vx * dt; h.z += h.vz * dt; h.angle += dt * 4; h.tilt = Math.min(0.6, h.tilt + dt); if (W.state.frame % 2 === 0) { W.FX.smoke(h.x, h.y, h.z, 2, true); W.FX.fire(h.x, h.y, h.z, 1); }
      if (h.y <= CITY.groundY(h.x, h.z) + 1) { PLAYER.explodeAt(h.x, h.y, h.z, 2, PLAYER); h.removed = true; W.heli = null; AUDIO.heliVolume(0); } return; }
    h.rotor += dt * 40;
    const want = P.wanted >= 4 && P.alive && !h.leaving; const targetY = want ? 30 : 80;
    if (!want) { h.leaving = true; }
    // Search the last reported area; buildings interrupt the helicopter's view too.
    const canSee = want && identified(h) && M.dist(h.x,h.z,P.x,P.z)<95 && W.sight3(h.x,h.y,h.z,P.x,P.y+1.1,P.z,[P.car]);
    if (canSee) seen(h);
    const focus = S.lastSeen || [h.x,h.z];
    h.orbit += dt * 0.35; const R = 26; const tx = focus[0] + Math.sin(h.orbit) * R, tz = focus[1] + Math.cos(h.orbit) * R;
    const dx = (h.leaving ? h.x + Math.sin(h.angle) * 100 : tx) - h.x, dz = (h.leaving ? h.z + Math.cos(h.angle) * 100 : tz) - h.z; const d = Math.hypot(dx, dz) || 1;
    const sp = Math.min(38, d * 0.9); h.vx = M.lerp(h.vx, dx / d * sp, dt * 1.5); h.vz = M.lerp(h.vz, dz / d * sp, dt * 1.5); h.x += h.vx * dt; h.z += h.vz * dt; h.y = M.lerp(h.y, targetY, dt * 0.8);
    const faceA = Math.atan2(focus[0] - h.x, focus[1] - h.z); h.angle += M.angleTo(h.angle, h.leaving ? h.angle : faceA) * Math.min(1, 2 * dt);
    h.tilt = M.lerp(h.tilt, Math.hypot(h.vx, h.vz) * 0.006, dt * 2);
    if (h.leaving && M.dist(h.x, h.z, P.x, P.z) > 300) { h.removed = true; W.heli = null; AUDIO.heliVolume(0); return; }
    AUDIO.heliVolume(M.clamp(1 - M.dist(h.x, h.z, P.x, P.z) / 180, 0, 1));
    // searchlight
    if (want) { W.dyn.push({ x: focus[0], y: 3, z: focus[1], r: 14, col: [1.2, 1.2, 1.0] }); W.fx.quad(W.F.adds, [h.x, h.y - 1, h.z], [h.x + 0.5, h.y - 1, h.z], [focus[0] + 4, CITY.groundY(focus[0], focus[1]) + 0.1, focus[1] + 4], [focus[0] - 4, CITY.groundY(focus[0], focus[1]) + 0.1, focus[1] - 4], [1, 1, 0.9], 0.12, 0.02); W.fx.quad(W.F.adds, [h.x, h.y - 1, h.z], [h.x, h.y - 1, h.z + 0.5], [focus[0] - 4, CITY.groundY(focus[0], focus[1]) + 0.1, focus[1] + 4], [focus[0] + 4, CITY.groundY(focus[0], focus[1]) + 0.1, focus[1] - 4], [1, 1, 0.9], 0.12, 0.02);
      h.gunT -= dt; if (canSee && h.gunT <= 0 && M.dist(h.x, h.z, focus[0], focus[1]) < 60) { h.gunT = 0.14; if (W.rng() < 0.7) { const ang = Math.atan2(focus[0] - h.x, focus[1] - h.z) + (W.rng() - 0.5) * 0.25; PLAYER.fireBullet(h, h.x, h.z, h.y, ang, WEAPONS.rifle, 0.5, h, Math.atan2(P.y+1.1-h.y, Math.max(1,M.dist(h.x,h.z,P.x,P.z)))); } if (W.rng() < 0.12) h.gunT = 1.6; } }
  }
  function heliEntity() { const h = W.heli; if (!h || h.removed) return null; M.trsEuler(h.model, h.x, h.y, h.z, h.angle, h.tilt, h.roll); M.trs(tmpB, 0, 0, 0, h.rotor); h.bones.set(tmpB, 16); M.trsEuler(tmpB, 0, 2.2, -4.4, 0, 0, 0); // tail rotor spins about x
    const c = Math.cos(h.rotor * 1.5), s = Math.sin(h.rotor * 1.5); h.bones.set([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 2.2 - (c * 2.2 - s * -4.4), -4.4 - (s * 2.2 + c * -4.4), 1], 32);
    h.emis.fill(0); h.emis[3] = 1.5; if (!h.dead) W.dyn.push({ x: h.x, y: h.y - 2, z: h.z, r: 12, col: [1, 1, 0.9] }); return { mesh: h.mesh, model: h.model, bones: h.bones, emis: h.emis, noShadow: false }; }

  function update(dt) {
    updateReports(dt);const P = PLAYER.P; const w = stars(); P.wanted = w;
    if (!S.arresting) S.arrestT = Math.max(0, S.arrestT - dt * 2); S.arresting = false;
    S.seenT += dt; if (S.searchT > 0) S.searchT -= dt;
    if (w > 0 && P.alive) {
      // out of sight in a car park or the safehouse yard, the trail goes cold twice as fast
      const bl = CITY.blockAt(P.x, P.z); const sh = CITY.place('safehouse'); if (S.seenT > 3 && ((bl && bl.kind === 'parking') || M.dist2(P.x, P.z, sh.x, sh.z) < 18 * 18)) S.seenT += dt;
      // cop cars see the player too
      const see = 70 * (1 - 0.55 * (W.weather.fog || 0)) * (W.isNight() ? 0.8 : 1); // fog and darkness shorten the police's sight
      for(const c of W.cars)if(!c.removed&&c.ai.mode==='chase'&&c.driver?.isCop)observe(c);
      const evade = 10 + w * 7;
      if (S.seenT > evade) { S.heat = Math.max(0, Math.floor(S.heat) - 1 + 0.9); S.seenT = evade * 0.55; if (stars() === 0) { S.heat = 0; HUD.notify('You lost the cops.'); clear(); } }
      // spawning
      const cnt = counts(); S.spawnT -= dt; S.footT -= dt; S.roadblockT -= dt;
      const wantCars = [0, 0, 2, 3, 4, 5][w], wantFoot = [0, 2, 3, 4, 4, 5][w], wantSwat = [0, 0, 0, 0, 1, 2][w];
      if (S.lastSeen && S.spawnT <= 0) { const bl = CITY.blockAt(P.x, P.z); const d = bl ? CITY.district(bl.i, bl.j) : 'midtown'; const resp = { downtown: 0.7, midtown: 0.9, westfield: 1.1, northgate: 1.2, southport: 1.3, eastside: 1.6 }[d] || 1; /* the precincts are downtown; the east side waits */ S.spawnT = (w >= 3 ? 6 : 10) * resp * (1 + 0.5 * (W.weather.fog || 0)); if (cnt.cars < wantCars) spawnCar(false); else if (cnt.swat < wantSwat) spawnCar(true); }
      if (S.lastSeen && S.footT <= 0) { S.footT = 5; if (cnt.foot < wantFoot && (!P.car || P.car.absSpeed < 6)) spawnFoot(); }
      if (S.seenT < 2.5 && w >= 3 && S.roadblockT <= 0 && P.car && P.car.absSpeed > 8) { S.roadblockT = w >= 4 ? 18 : 28; spawnRoadblock(); }
      if (S.lastSeen && w >= 4 && !W.heli) { S.heliT -= dt; if (S.heliT <= 0) { spawnHeli(); S.heliT = 40; } }
      // cops leaving cars near the player
      for (const c of W.cars) {
        if (c.removed || c.wrecked || c.ai.mode !== 'chase' || !c.driver || c.driver === PLAYER) continue;
        const d = M.dist(c.x, c.z, P.x, P.z);
        if (d < 9 && (!P.car || P.car.absSpeed < 3) && c.absSpeed < 4) { const crew = [c.driver, ...c.passengers]; for (const p of crew) { p.exitCar(); p.alerted = 10; p.car = c; p.x += (W.rng() - 0.5) * 2; p.z += (W.rng() - 0.5) * 2; } c.driver = null; c.passengers.length = 0; c.ai.mode = 'parked'; c.exitT = 0; }
        if (c.roadblock && d < 20) { c.roadblock = false; }
      }
      // cops far from the player get back into their parked cruiser and resume the chase
      for (const p of W.peds) { if (!p.alive || !p.isCop || p.inCar || !p.car || p.car.removed || p.car.wrecked) continue; if (M.dist(p.x, p.z, P.x, P.z) > 32 && M.dist(p.x, p.z, p.car.x, p.car.z) < 3 && !p.car.driver) { p.inCar = p.car; p.car.driver = p; p.car.ai.mode = 'chase'; p.car.siren = true; p.state = 'driving'; } else if (M.dist(p.x, p.z, P.x, P.z) > 32 && p.car && !p.car.driver && M.dist(p.x, p.z, p.car.x, p.car.z) < 40) { /* walk back */ p.returnT = 1; } }
      for (const c of W.cars) if (!c.removed && c.roadblock && !c.driver && M.dist(c.x, c.z, P.x, P.z) > 60) { c.roadblock = false; }
    } else {
      for (const c of W.cars) if (!c.removed && c.ai.mode === 'chase' && (c.type === 'police' || c.type === 'swat')) { c.ai.mode = 'traffic'; c.ai.edge = null; c.siren = false; }
      if (W.heli && !W.heli.dead) W.heli.leaving = true;
    }
    updateHeli(dt);
    // siren audio: nearest siren car
    let vol = 0, loud = null; for (const c of W.cars) if (!c.removed && c.siren) { const v = 1 - M.dist(c.x, c.z, P.x, P.z) / 120; if (v > vol) { vol = v; loud = c; } }
    let pitch = 1; if (loud && loud !== P.car) { const dx = loud.x - P.x, dz = loud.z - P.z, d = Math.hypot(dx, dz) || 1; const pv = P.car ? [P.car.vx, P.car.vz] : [P.vx || 0, P.vz || 0]; const vrel = ((loud.vx - pv[0]) * dx + (loud.vz - pv[1]) * dz) / d; pitch = M.clamp(343 / (343 + vrel), 0.86, 1.16); } // doppler: a cruiser closing sounds sharper, one pulling away flatter
    AUDIO.siren(M.clamp(vol, 0, 1) * (P.car && P.car.siren ? 1 : 0.8) + (P.car && P.car.siren ? 0.6 : 0), dt, pitch);
  }
  return { S, reports, updateReports, identified, observe, crime, seen, pursuitPoint, arrestProgress, clear, setStars, bribe, update, heliEntity, stars, get lastSeen() { return S.lastSeen; } };
})();
