// In-page playtest bot. Drives the game through DOM keyboard/mouse events, navigating by the radar blip
// along the sidewalk graph on foot and the road grid in a car. window.__bot = { scenario, log[] }.
(() => {
  const B = window.__bot = { scenario: window.__botScenario || 'story', log: [], held: new Set(), t: 0 };
  const say = (o) => { B.log.push({ t: +B.t.toFixed(1), ...o }); };
  const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code.replace('Key', '').toLowerCase(), bubbles: true }));
  const setKeys = (keys) => { for (const k of [...B.held]) if (!keys.includes(k)) { B.held.delete(k); key(k, false); } for (const k of keys) if (!B.held.has(k)) { B.held.add(k); key(k, true); } };
  const tap = (code) => { key(code, true); setTimeout(() => key(code, false), 40); };
  const look = (dx, dy) => document.dispatchEvent(new MouseEvent('mousemove', { movementX: dx, movementY: dy || 0 }));
  const click = (btn) => { document.dispatchEvent(new MouseEvent('mousedown', { button: btn })); setTimeout(() => document.dispatchEvent(new MouseEvent('mouseup', { button: btn })), 60); };
  document.dispatchEvent(new Event('pointerlockerror')); // force the uncaptured-mouse fallback
  const ang = (from, to) => { let a = (to - from + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
  const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
  // Turn the camera toward a world point with mouse movement (sensitivity 0.0022 rad/px).
  const aimAt = (x, z) => { const P = PLAYER.P; const want = Math.atan2(x - P.x, z - P.z); const e = ang(P.camYaw, want); look(-e / 0.0022, 0); };
  let stopT = 0, detour = null, detourUntil = -1, unstickN = 0, lastUnstick = -99, revFlip = false, slowWaitT = 0, tgtStopT = 0, parkedT = 0, route = null, routeIdx = 0, routeTarget = null, routeT = -99, lastPos = null, stillT = 0, reverseUntil = -1, dlgT = -99, sideUntil = -1, sideKey = 'KeyA', jumpT = -99, wander = null, waitT = 0, tick = 0, lastAct = -99, fireT = 0;
  B.tick = (dt) => {
    B.t += dt; tick++; if (tick % 3 !== 0) return; const s = window.__ptState();
    if (s.dialogue) { setKeys([]); if (B.t - dlgT > 1.2) { dlgT = B.t; tap('Space'); } return; }
    if (s.shop) { tap('Escape'); return; }
    if (/Press Y to retry/.test(s.objective) && s.alive) { setKeys([]); tap('KeyY'); say({ act: 'retry mission' }); waitT = 3; return; }
    if (!s.alive) { setKeys([]); return; }
    let target = s.blip ? [s.blip.x, s.blip.z] : null; let targetIsCar = !!(s.blip && s.blip.isCar && s.blip.carDriver !== 'me' && !s.blip.carWrecked);
    if (B.scenario === 'mayhem') {
      if (!s.car) { fireT -= 0.1; if (fireT <= 0) { fireT = 0.6; if (s.weapon === 'fist') tap('Digit3'); const q = W.peds.find(p => p.alive && !p.inCar && M.dist(p.x, p.z, s.x, s.z) < 25); if (q) { aimAt(q.x, q.z); click(0); } } }
      if (!wander || dist(s.x, s.z, ...wander) < 25) wander = [60 + Math.random() * 720, 60 + Math.random() * 720]; target = wander; targetIsCar = false;
    }
    if (B.scenario === 'drive' && !target) { if (!wander || dist(s.x, s.z, ...wander) < 20) { wander = [60 + Math.random() * 720, 60 + Math.random() * 720]; say({ wander: wander.map(Math.round) }); } target = wander; }
    if (!target) { setKeys([]); return; }
    const dT = dist(s.x, s.z, target[0], target[1]);
    if (lastPos && dist(s.x, s.z, ...lastPos) < 0.3) stillT += 0.1; else stillT = 0; lastPos = [s.x, s.z];
    if (waitT > 0) { waitT -= 0.1; setKeys([]); return; }
    if (s.car) {
      const c = s.car;
      if (c.health < 0.14 && !c.wrecked) { setKeys([]); tap('KeyF'); say({ act: 'bail burning car', hp: +c.health.toFixed(2) }); waitT = 1.5; route = null; return; }
      if (targetIsCar) { if (dT < 9 && s.blip.carSpeed < 2.5) tgtStopT += 0.1; else tgtStopT = 0; }
      if (targetIsCar && dT < 9 && (s.blip.carDriver === 'none' || tgtStopT > 2.5)) { if (c.abs > 2) { setKeys(['KeyS']); return; } setKeys([]); tap('KeyF'); say({ act: 'exit to jack', dT: +dT.toFixed(1), drv: s.blip.carDriver }); route = null; waitT = 1.5; return; }
      if (!targetIsCar && dT < 7) { if (c.abs > 1.5) { setKeys(['KeyS']); return; } if (/get out|Park|marker|Stop the/i.test(s.objective)) { stopT = (stopT || 0) + 0.1; if (stopT < 2) { setKeys([]); return; } stopT = 0; setKeys([]); tap('KeyF'); say({ act: 'exit at target' }); waitT = 1.5; return; } }
      if (!targetIsCar && dT < 8 && c.abs < 1) { parkedT = (parkedT || 0) + 0.1; setKeys([]); if (parkedT > 2) { parkedT = 0; tap('KeyF'); say({ act: 'exit near target' }); waitT = 1.5; } return; } else parkedT = 0;
      if (B.t < detourUntil && detour) { route = [detour, target.slice()]; routeIdx = 0; routeTarget = target.slice(); routeT = B.t; }
      else if (targetIsCar && dT < 40) { route = [target.slice()]; routeIdx = 0; routeTarget = target.slice(); routeT = B.t; }
      else if (!route || !routeTarget || dist(target[0], target[1], ...routeTarget) > 25 || B.t - routeT > 8) {
        route = window.__ptRoute(target[0], target[1]); routeTarget = target.slice(); routeT = B.t;
        // start at the first waypoint that is ahead of the car (a fresh route begins at the nearest node, often behind us)
        const fx = Math.sin(c.angle), fz = Math.cos(c.angle); routeIdx = 0;
        while (routeIdx < route.length - 1) { const w = route[routeIdx]; const dx = w[0] - c.x, dz = w[1] - c.z; const dd = Math.hypot(dx, dz); if (dd > 9 && (dx * fx + dz * fz) / dd > -0.2) break; if (dd > 45) break; routeIdx++; }
      }
      while (routeIdx < route.length - 1 && dist(c.x, c.z, ...route[routeIdx]) < 9) routeIdx++;
      const wp = route[Math.min(routeIdx, route.length - 1)]; const e = ang(c.angle, Math.atan2(wp[0] - c.x, wp[1] - c.z));
      const keys = [];
      if (B.t < reverseUntil) { keys.push('KeyS'); keys.push((e > 0) !== revFlip ? 'KeyD' : 'KeyA'); }
      else {
        if (stillT > 2.5 && dT > 6) { unstickN = (B.t - lastUnstick < 20) ? unstickN + 1 : 0; lastUnstick = B.t; reverseUntil = B.t + (unstickN > 2 ? 3.5 : 1.6); revFlip = unstickN % 2 === 1; stillT = 0; route = null; if (unstickN >= 1 && dT < 60) { const a = Math.atan2(target[0] - c.x, target[1] - c.z) + (revFlip ? 1 : -1) * 1.2; detour = [c.x + Math.sin(a) * 14, c.z + Math.cos(a) * 14]; detourUntil = B.t + 6; } say({ act: 'unstick reverse', at: [Math.round(c.x), Math.round(c.z)], n: unstickN }); }
        if (e > 0.08) keys.push('KeyA'); else if (e < -0.08) keys.push('KeyD'); // heading grows toward screen-left, so a positive error means steer left
        const sharp = Math.abs(e) > 0.6; const near = dT < 15; const fwdSpd = c.speed; // signed: negative when reversing
        if (fwdSpd < -1) keys.push('KeyW'); // rolling backwards by accident: go forward, never hold the brake into reverse
        else if (sharp && fwdSpd > 9) keys.push('KeyS'); else if ((near && !targetIsCar && fwdSpd > 8) || (targetIsCar && dT < 6 && s.blip.carSpeed < 2.5 && fwdSpd > 5)) { } else keys.push('KeyW');
        if (Math.abs(e) > 1.0 && fwdSpd > 6) keys.push('Space');
      }
      setKeys(keys); B.debug = { held: [...B.held].join(','), e: +e.toFixed(2), wp: wp.map(Math.round), idx: routeIdx, n: route ? route.length : 0, spd: +c.speed.toFixed(1), still: +stillT.toFixed(1), rev: +(reverseUntil - B.t).toFixed(1) };
    } else {
      if (s.entering) { setKeys([]); return; }
      // a stopped or abandoned target car: walk straight to it and take it
      if (targetIsCar && dT < 30 && s.blip.carSpeed < 3) { if (dT < 2.6 || (dT < 4 && stillT > 1)) { setKeys([]); tap('KeyF'); say({ act: 'take target car', drv: s.blip.carDriver }); waitT = 2; return; } aimAt(target[0], target[1]); setKeys(['KeyW', 'ShiftLeft']); return; }
      const wantCar = dT > 45 || targetIsCar; const nc = s.nearCar;
      const slow = nc && (nc.type === 'bus' || nc.type === 'truck' || nc.type === 'van'); if (wantCar && nc && !slow) slowWaitT = 0; else if (wantCar && slow) slowWaitT += 0.1;
      if (wantCar && nc && nc.dist < 30 && !(targetIsCar && dist(nc.x, nc.z, ...target) < 3 && s.blip.carSpeed > 3) && (!slow || slowWaitT > 12)) {
        const dd = dist(s.x, s.z, nc.x, nc.z);
        if (dd < 3.5) { setKeys([]); tap('KeyF'); say({ act: 'enter car', type: nc.type, driver: nc.driver }); waitT = 2; return; }
        aimAt(nc.x, nc.z); setKeys(['KeyW', 'ShiftLeft']); return;
      }
      if (dT < 1.5) { setKeys([]); return; }
      if (!route || !routeTarget || dist(target[0], target[1], ...routeTarget) > 10 || B.t - routeT > 10 || route.car) { route = window.__ptWalkRoute(target[0], target[1]); routeIdx = 0; routeTarget = target.slice(); routeT = B.t; }
      while (routeIdx < route.length - 1 && dist(s.x, s.z, ...route[routeIdx]) < 2) routeIdx++;
      const wp = route[Math.min(routeIdx, route.length - 1)];
      if (stillT > 2 && B.t > sideUntil) { sideUntil = B.t + 1.5; sideKey = sideKey === 'KeyA' ? 'KeyD' : 'KeyA'; say({ act: 'sidestep', at: [Math.round(s.x), Math.round(s.z)] }); }
      aimAt(wp[0], wp[1]);
      const keys = ['KeyW']; if (dT > 6) keys.push('ShiftLeft'); if (B.t < sideUntil) keys.push(sideKey); if (stillT > 1 && B.t - jumpT > 1.5) { jumpT = B.t; tap('Space'); }
      setKeys(keys);
    }
  };
  window.__pt.bot = B.tick;
})();
