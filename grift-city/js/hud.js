// GRIFT CITY — the 2D overlay: radar, money, health, wanted stars, weapon, objectives, dialogue, menus.
'use strict';
const HUD = (() => {
  let cv, g, W_, H_, uiScale=1, mapCanvas = null; const notes = [];
  // Strips the touch layer can tap, rebuilt every frame: {x, y, w, h, key} where key is the key it stands for.
  let newGameRect = null,mapRect=null, objSeen = '', objT = 0; const zones = []; const zone = (x, y, w, h, key) => { if (TOUCH.active) zones.push({ x:x*uiScale, y:y*uiScale, w:w*uiScale, h:h*uiScale, key }); }; let big = null, starFlash = 0, fadeT = 0, fadeDur = 0, moneyAnim = { shown: 0, target: 0 };
  const FONT = '"Helvetica Neue", Arial, sans-serif'; const DISPLAY = 'Impact, "Arial Black", "Helvetica Neue", sans-serif';
  function init(canvas) { cv = canvas; g = cv.getContext('2d'); }
  function resize() { const dpr = Math.min(window.devicePixelRatio || 1, 1.5); /* a full-retina overlay costs more to composite than its text is worth */ const w = Math.floor(cv.clientWidth * dpr), h = Math.floor(cv.clientHeight * dpr); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } uiScale=1; try { uiScale=GAME.options.hudScale || 1; } catch(e) {} W_ = cv.clientWidth/uiScale; H_ = cv.clientHeight/uiScale; g.setTransform(dpr*uiScale, 0, 0, dpr*uiScale, 0, 0); }
  function notify(text) { notes.push({ text, t: 4 }); if (notes.length > 4) notes.shift(); }
  function money(n, why) { moneyAnim.target = PLAYER.money; if (why) notify((n >= 0 ? '+$' : '-$') + Math.abs(n) + '  ' + why); }
  function bigText(text, color, dur = 3) { big = { text, color, t: dur, max: dur }; }
  function clearBig() { big = null; }
  function flashStars() { starFlash = 1.5; }
  function fade(dur) { fadeT = dur; fadeDur = dur; }
  // Word-wrap a line to a pixel width at a font size (subtitles on narrow windows).
  function wrap(t, size, maxW) { g.font = `normal ${size}px ${FONT}`; const words = String(t).split(' '); const rows = []; let cur = ''; for (const w of words) { const test = cur ? cur + ' ' + w : w; if (g.measureText(test).width > maxW && cur) { rows.push(cur); cur = w; } else cur = test; } if (cur) rows.push(cur); return rows; }
  function text(t, x, y, size, color = '#fff', align = 'left', weight = 'bold', shadow = true, outline = false) { g.font = `${weight} ${size}px ${FONT}`; g.textAlign = align; g.textBaseline = 'middle'; if (shadow) { g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillText(t, x + 2, y + 2); } if (outline) { g.lineWidth = Math.max(2, size * 0.16); g.lineJoin = 'round'; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.strokeText(t, x, y); } g.fillStyle = color; g.fillText(t, x, y); }
  function outlined(t, x, y, size, color, align = 'center') { g.font = `900 ${size}px ${DISPLAY}`; g.letterSpacing = '1px'; g.textAlign = align; g.textBaseline = 'middle'; g.lineWidth = Math.max(2, size * 0.1); g.strokeStyle = '#000'; g.lineJoin = 'round'; g.strokeText(t, x, y); g.fillStyle = color; g.fillText(t, x, y); }

  // ---- Radar map, painted once
  function buildMap() {
    const [b0, b1] = W.bounds; const size = b1 - b0; mapCanvas = document.createElement('canvas'); mapCanvas.width = mapCanvas.height = 1024; const m = mapCanvas.getContext('2d'); const s = 1024 / size; mapCanvas._s = s; mapCanvas._b0 = b0;
    m.fillStyle = '#24383e'; m.fillRect(0, 0, 1024, 1024);
    m.fillStyle = '#454b43'; m.fillRect((-14 - b0) * s, (-14 - b0) * s, (CITY.SIZE + 28) * s, (CITY.SIZE + 28) * s);
    for (const bl of CITY.blocks) { const col = bl.kind === 'park' ? '#526451' : (bl.kind === 'parking' || bl.kind === 'stunt') ? '#6d6d6d' : bl.kind === 'docks' ? '#7a6f55' : '#686b60'; m.fillStyle = col; m.fillRect((bl.x - 3 - b0) * s, (bl.z - 3 - b0) * s, 70 * s, 70 * s); m.fillStyle = 'rgba(0,0,0,0.25)'; for (const l of bl.lots) if (l.kind !== 'wall') m.fillRect((l.x0 - b0) * s, (l.z0 - b0) * s, (l.x1 - l.x0) * s, (l.z1 - l.z0) * s); }
    m.fillStyle = '#b7b6a6'; for (let i = 0; i <= CITY.GRID; i++) { m.fillRect((i * CITY.PITCH - 7 - b0) * s, (-7 - b0) * s, 14 * s, (CITY.SIZE + 14) * s); m.fillRect((-7 - b0) * s, (i * CITY.PITCH - 7 - b0) * s, (CITY.SIZE + 14) * s, 14 * s); }
    if(typeof STREETS!=='undefined'){m.lineCap='round';for(const p of STREETS.paths){m.strokeStyle=p.mode==='foot'?'#94b7aa':'#a4a897';m.lineWidth=Math.max(2,p.width*s);m.beginPath();p.points.forEach((v,i)=>i?m.lineTo((v[0]-b0)*s,(v[1]-b0)*s):m.moveTo((v[0]-b0)*s,(v[1]-b0)*s));m.stroke();}}
    const icons = { safehouse: ['#ff70d0', 'S'], garage: ['#f5a623', 'V'], spray: ['#2fd6c4', 'P'], guns: ['#e0453b', 'G'], hospital: ['#ffffff', 'H'], police: ['#5aa0ff', 'P'], bank: ['#3df06a', '$'], tower: ['#a0a0ff', 'C'], docks: ['#c0a060', 'D'],landmark:['#76e0d0','◆'] };
    mapCanvas._icons = []; for (const k in icons) for (const p of (CITY.places[k] || [])) mapCanvas._icons.push({ x: p.x, z: p.z, col: icons[k][0], ch: icons[k][1], kind: k });
  }
  function drawMapIcons(scale,filter){for(const ic of mapCanvas._icons){if(filter&&!filter(ic))continue;g.save();g.translate(ic.x,ic.z);g.scale(1/scale,1/scale);g.fillStyle='#14252b';g.strokeStyle=ic.col;g.lineWidth=1.5;g.beginPath();g.arc(0,0,7.5,0,M.TAU);g.fill();g.stroke();g.strokeStyle='#fff3d5';g.lineWidth=1.3;g.beginPath();
      if(ic.kind==='safehouse'){g.moveTo(-4,0);g.lineTo(0,-4);g.lineTo(4,0);g.moveTo(-3,-1);g.lineTo(-3,4);g.lineTo(3,4);g.lineTo(3,-1);}
      else if(ic.kind==='hospital'){g.moveTo(-4,0);g.lineTo(4,0);g.moveTo(0,-4);g.lineTo(0,4);}
      else if(ic.kind==='garage'){g.rect(-4,-2,8,5);g.moveTo(-3,-2);g.lineTo(-2,-4);g.lineTo(2,-4);g.lineTo(3,-2);g.moveTo(-3,3);g.lineTo(-3,5);g.moveTo(3,3);g.lineTo(3,5);}
      else if(ic.kind==='police'){g.moveTo(-4,-4);g.lineTo(4,-4);g.lineTo(3,2);g.lineTo(0,5);g.lineTo(-3,2);g.closePath();}
      else if(ic.kind==='spray'){g.moveTo(0,-5);g.bezierCurveTo(-7,2,-3,5,0,5);g.bezierCurveTo(3,5,7,2,0,-5);}
      else if(ic.kind==='guns'){g.arc(0,0,3,0,M.TAU);g.moveTo(-5,0);g.lineTo(5,0);g.moveTo(0,-5);g.lineTo(0,5);}
      else if(ic.kind==='docks'){g.moveTo(0,-5);g.lineTo(0,4);g.moveTo(-4,1);g.quadraticCurveTo(0,8,4,1);g.moveTo(-3,-2);g.lineTo(3,-2);}
      else{g.moveTo(0,-5);g.lineTo(4,0);g.lineTo(0,5);g.lineTo(-4,0);g.closePath();}g.stroke();g.restore();}}

  // On a touchscreen the bottom-left corner belongs to the thumb that moves you, so the radar goes up to the
  // top-left and the district and clock shift out from under it.
  function radarLayout(w, h) { const R = Math.min(82, w * 0.12); return TOUCH.active ? { R, cx: R + 18, cy: R + 18 } : { R, cx: R + 24, cy: h - R - 30 }; }
  let routeCache = { key: '', points: [] };
  function route(P, bp) {
    if(typeof NAV!=='undefined'){const p=NAV.route(P,bp);if(p.length)return p;}
    if (!bp || !P.car || P.car.spec.boat || M.dist(P.x,P.z,bp.x,bp.z) < 20) return [];
    const nearest = (x,z) => CITY.roadNodes.reduce((a,b) => M.dist2(a.x,a.z,x,z) < M.dist2(b.x,b.z,x,z) ? a : b);
    if (!CITY.roadNodes.length) return [];
    const start = nearest(P.x,P.z), end = nearest(bp.x,bp.z), key = [start.i,start.j,end.i,end.j].join(',');
    if (routeCache.key !== key) {
      const prev = new Map([[start,null]]), queue = [start];
      for (let i = 0; i < queue.length; i++) { const n = queue[i]; if (n === end) break; for (const e of n.out) if (!prev.has(e.to)) { prev.set(e.to,n); queue.push(e.to); } }
      const points = []; if (prev.has(end)) for (let n=end; n; n=prev.get(n)) points.unshift([n.x,n.z]);
      routeCache = { key, points };
    }
    return routeCache.points;
  }
  function routeLine(P, scale) {
    const bp = (typeof NAV!=='undefined'&&NAV.waypoint)||MISSIONS.blipPos(), pts = route(P,bp); if (!pts.length) return;
    g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
    pts.forEach(([x,z],i) => i ? g.lineTo(x,z) : g.moveTo(x,z));
    g.strokeStyle = 'rgba(15,26,31,.9)'; g.lineWidth = 7/scale; g.stroke();
    g.strokeStyle = bp.col||'#f5ce68'; g.lineWidth = 3/scale; g.stroke();
    // The dotted final approach is deliberately distinct from the road route.
    const last = pts[pts.length-1]; g.setLineDash([4/scale,5/scale]); g.beginPath(); g.moveTo(last[0],last[1]); g.lineTo(bp.x,bp.z); g.stroke(); g.setLineDash([]);
  }
  function radar(P, cam) {
    const { R, cx, cy } = radarLayout(W_, H_); const scale = 0.55; const yaw = W.state.camYaw;
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 7); g.clip();
    g.fillStyle = '#24383e'; g.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    g.translate(cx, cy); g.rotate(yaw + Math.PI); g.scale(scale, scale); g.translate(-P.x, -P.z);
    const s = mapCanvas._s, b0 = mapCanvas._b0; g.drawImage(mapCanvas, 0, 0, 1024, 1024, b0, b0, 1024 / s, 1024 / s);
    routeLine(P, scale);
    drawMapIcons(scale, null);
    // blips
    if (P.wanted > 0 && POLICE.S.seenT > 2 && POLICE.S.lastSeen) { const ls = POLICE.S.lastSeen; const rr = Math.min(120, 12 + POLICE.S.seenT * 6); g.fillStyle = 'rgba(90,160,255,0.18)'; g.beginPath(); g.arc(ls[0], ls[1], rr, 0, 7); g.fill(); g.strokeStyle = 'rgba(90,160,255,0.5)'; g.lineWidth = 1.5 / scale; g.stroke(); } // where the police think you are
    for (const ic of ECON.mapIcons()) { g.fillStyle = ic.col; g.beginPath(); g.arc(ic.x, ic.z, 4 / scale, 0, 7); g.fill(); }
    for (const bp of MISSIONS.allBlips()) { g.fillStyle = bp.col; g.beginPath(); g.arc(bp.x, bp.z, 6 / scale, 0, 7); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 2 / scale; g.stroke(); }
    for (const p of W.pickups) if (!p.taken && p.kind === 'rampage' && !MISSIONS.S.rampageDone[p.rampage.id]) { g.fillStyle = '#ff7020'; g.beginPath(); g.arc(p.x, p.z, 4 / scale, 0, 7); g.fill(); }
    if (P.wanted > 0) for (const c of W.cars) if (!c.removed && c.ai.mode === 'chase') { g.fillStyle = '#5aa0ff'; g.fillRect(c.x - 3 / scale, c.z - 3 / scale, 6 / scale, 6 / scale); }
    if (P.wanted > 0) for (const p of W.peds) if (p.alive && p.isCop && !p.inCar) { g.fillStyle = '#5aa0ff'; g.beginPath(); g.arc(p.x, p.z, 2.5 / scale, 0, 7); g.fill(); }
    for (const p of W.pickups) if (!p.taken && p.kind === 'package' && M.dist2(p.x, p.z, P.x, P.z) < 60 * 60) { g.fillStyle = '#ffb060'; g.beginPath(); g.arc(p.x, p.z, 3 / scale, 0, 7); g.fill(); }
    for (const p of W.peds) if (p.alive && (p.hostile || p.role === 'target') && !p.inCar) { g.fillStyle = '#ff4040'; g.beginPath(); g.arc(p.x, p.z, 3 / scale, 0, 7); g.fill(); }
    for (const p of W.peds) if (p.alive && p.role === 'crew') { g.fillStyle = '#40ff80'; g.beginPath(); g.arc(p.x, p.z, 3 / scale, 0, 7); g.fill(); }
    if (W.heli && !W.heli.dead) { g.fillStyle = '#5aa0ff'; g.beginPath(); g.arc(W.heli.x, W.heli.z, 5 / scale, 0, 7); g.fill(); }
    // player arrow
    g.translate(P.x, P.z); g.rotate(-(P.car ? P.car.angle : P.angle) + Math.PI); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -9 / scale); g.lineTo(6 / scale, 7 / scale); g.lineTo(0, 3 / scale); g.lineTo(-6 / scale, 7 / scale); g.closePath(); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1.5 / scale; g.stroke();
    g.restore();
    // edge blip for off-radar mission target
    const bp = (typeof NAV!=='undefined'&&NAV.waypoint)||MISSIONS.blipPos(); if (bp) { const dx = bp.x - P.x, dz = bp.z - P.z; if (Math.hypot(dx, dz) * scale > R) { const a = Math.atan2(dx, dz); const sa = a - yaw; const ex = cx - Math.sin(sa) * (R - 8), ey = cy - Math.cos(sa) * (R - 8); /* same rotation as the map: ahead is up */ g.fillStyle = bp.col; g.beginPath(); g.arc(ex, ey, 6, 0, 7); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 2; g.stroke(); } }
    g.strokeStyle = 'rgba(0,0,0,0.85)'; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5; g.stroke();
    // north indicator
    { const a = yaw + Math.PI; const nx = cx + Math.sin(a) * (R + 12), ny = cy - Math.cos(a) * (R + 12); text('N', nx, ny, 12, '#fff', 'center'); }
    // health & armor bars beside the radar
    const bx = TOUCH.active ? cx - R : cx + R + 12, by = TOUCH.active ? cy + R + 30 : cy + R - 14, bw = Math.min(112, W_ * 0.16);
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(bx - 2, by - 12, bw + 4, 14); g.fillStyle = P.health > 25 ? '#d8352f' : (Math.sin(W.state.elapsed * 10) > 0 ? '#ff6060' : '#802020'); g.fillRect(bx, by - 10, bw * M.clamp(P.health / 100, 0, 1), 10);
    if (P.armor > 0) { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(bx - 2, by - 28, bw + 4, 14); g.fillStyle = '#c8c8d0'; g.fillRect(bx, by - 26, bw * M.clamp(P.armor / 100, 0, 1), 10); }
    if (P.car) { const kmh = Math.round(P.car.absSpeed * 3.6); text(kmh + ' km/h', bx, by - (P.armor > 0 ? 42 : 26), 14, '#ddd');const q=P.car.condition;if(q){const alerts=[];if(q.engine<.35)alerts.push('ENGINE');if(q.temperature>.65)alerts.push('OVERHEATING');else if(q.cooling<.4)alerts.push('COOLANT');if(q.tyres.some(t=>t<=0))alerts.push('FLAT TYRE');if(alerts.length)text(alerts.join(' · '),bx,by-62,11,'#f3bd73');} }
  }
  function weaponIcon(x, y, key) {
    g.save(); g.translate(x, y); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2;
    const rect = (a, b, w, h) => { g.fillRect(a, b, w, h); g.strokeRect(a, b, w, h); };
    switch (key) {
      case 'fist': g.beginPath(); g.arc(0, 0, 9, 0, 7); g.fill(); g.stroke(); break;
      case 'bat': g.save(); g.rotate(-0.7); rect(-3, -16, 6, 32); g.restore(); break;
      case 'pistol': rect(-12, -6, 24, 7); rect(-8, 0, 7, 12); break;
      case 'uzi': rect(-14, -6, 28, 8); rect(-2, 0, 6, 12); rect(-14, -9, 6, 3); break;
      case 'shotgun': rect(-20, -4, 40, 5); rect(-20, 0, 12, 6); break;
      case 'rifle': rect(-22, -4, 44, 6); rect(-4, 2, 6, 10); rect(-22, 0, 10, 6); rect(16, -7, 6, 3); break;
      case 'rocket': rect(-24, -5, 48, 10); g.fillStyle = '#e04040'; rect(18, -7, 8, 14); break;
      case 'grenade': g.beginPath(); g.arc(0, 2, 9, 0, 7); g.fill(); g.stroke(); rect(-3, -12, 6, 5); break;
    }
    g.restore();
  }
  // Performance overlay (Settings > Performance overlay): frame times as delivered, the detected cap, the rung the
  // adaptive quality settled on and what the frame costs, readable on the device itself.
  function drawPerf() { const r = GAME.perfInfo(); if (!r) return; const lines = [`frame ${r.frameP50} / ${r.frameP95} / ${r.frameP99} ms  (p50/p95/p99)`, `cap ${r.cap} · quality rung ${r.level} · scale ${r.scale} · dpr ${r.dpr}`, `sim ${r.simMs} ms · render ${r.renderMs} ms (CPU)`, `${r.draws} draws · ${(r.tris / 1000).toFixed(0)}k tris · ${r.canvas}${r.heapMB ? ' · heap ' + r.heapMB + ' MB' : ''}`, `${r.gpu}`];
    const x = W_ / 2 - 190, y = 8; g.fillStyle = 'rgba(8,14,18,0.72)'; g.fillRect(x, y, 380, lines.length * 15 + 10); lines.forEach((l, i) => text(l, x + 8, y + 14 + i * 15, 11, i === 0 && r.frameP95 > (r.cap === '30 Hz' ? 40 : 22) ? '#ff9a7a' : '#d8e6e2', 'left', 'normal', false)); }
  function stars(P, x, y) { for (let i = 0; i < 5; i++) { const lit = i < P.wanted; const flash = starFlash > 0 && lit && Math.sin(W.state.elapsed * 20) > 0; text('★', x - i * 24, y, 24, lit ? (flash ? '#fff' : '#f5c542') : 'rgba(255,255,255,0.18)', 'center'); } }

  function draw(dt, state, photo) { drawFrame(dt, state, photo); if (GAME.options.perfOverlay && state !== 'title' && state !== 'loading') drawPerf(); } // the overlay goes on top of everything, letterbox included
  function drawFrame(dt, state, photo) {if(typeof NAV!=='undefined')NAV.sync(state);
    resize(); g.clearRect(0, 0, W_, H_); zones.length = 0; const P = PLAYER.P;
    if (state === 'title') return drawTitle();
    if (state === 'photo') { text('PHOTO MODE  ·  WASD/QE fly  ·  SHIFT fast  ·  wheel zoom  ·  click or ENTER saves a picture  ·  P back', W_ / 2, H_ - 18, 13, 'rgba(255,255,255,0.75)', 'center', 'normal'); if (photo && photo.savedT > 0) text('SAVED', W_ / 2, H_ / 2, 28, '#f5c542', 'center'); return; }
    if (state === 'loading') return drawLoading();
    if (!mapCanvas) buildMap();
    // world labels: ped shouts, car name
    for (const p of W.peds) if (p.shoutT > 0 && p.alive) { const s = RENDER.project(p.x, p.y + 2.1, p.z, cv); if (s && s[2] < 40) text(p.shout, s[0]/uiScale, s[1]/uiScale, 13, '#fff', 'center', 'normal'); }
    if (P.hurtFlash > 0) { const gr = g.createRadialGradient(W_ / 2, H_ / 2, H_ * 0.3, W_ / 2, H_ / 2, H_ * 0.8); gr.addColorStop(0, 'rgba(180,0,0,0)'); gr.addColorStop(1, `rgba(180,0,0,${P.hurtFlash * 1.2})`); g.fillStyle = gr; g.fillRect(0, 0, W_, H_); }
    if (P.health <= 25 && P.alive) { const gr = g.createRadialGradient(W_ / 2, H_ / 2, H_ * 0.4, W_ / 2, H_ / 2, H_ * 0.85); gr.addColorStop(0, 'rgba(120,0,0,0)'); gr.addColorStop(1, `rgba(120,0,0,${0.25 + 0.2 * Math.sin(W.state.elapsed * 6)})`); g.fillStyle = gr; g.fillRect(0, 0, W_, H_); }
    const dlg = MISSIONS.dialogue;
    if (dlg) { // letterbox + subtitles
      g.fillStyle = '#000'; g.fillRect(0, 0, W_, H_ * 0.12); g.fillRect(0, H_ * 0.88, W_, H_ * 0.12);
      const line = dlg.lines[dlg.i]; if (line) { const rows = wrap(line[1], 20, W_ * 0.84); const y0 = H_ * 0.8 - (rows.length - 1) * 12; if (line[0]) text(line[0], W_ / 2, y0 - 26, 16, '#f5c542', 'center'); rows.forEach((r, i) => text(r, W_ / 2, y0 + i * 24, 20, '#fff', 'center', 'normal')); }
      text(TOUCH.active ? 'TAP to continue' : 'SPACE to continue', W_ - 20, H_ - 18, 12, '#aaa', 'right', 'normal');
      if (fadeT > 0) drawFade(dt); return;
    }
    const shade = g.createLinearGradient(0, 0, 0, 115); shade.addColorStop(0, 'rgba(16,25,29,0.55)'); shade.addColorStop(1, 'rgba(16,25,29,0)'); g.fillStyle = shade; g.fillRect(0, 0, W_, 115);
    radar(P, RENDER.cam);
    // top right: money, stars, weapon
    moneyAnim.shown = Math.abs(moneyAnim.target - moneyAnim.shown) < 2 ? moneyAnim.target : M.lerp(moneyAnim.shown, moneyAnim.target, Math.min(1, 6 * dt)); moneyAnim.target = P.money;
    text('$' + Math.round(moneyAnim.shown).toLocaleString('en-US'), W_ - 28, 32, 24, '#eee5ce', 'right', '500');
    if (P.wanted > 0) {
      stars(P, W_ - 38, 65); const searching = POLICE.S.seenT > 2.5;
      text(searching ? 'SEARCHING · stay out of sight' : 'PURSUIT · break line of sight', W_-24, 88, 11, searching ? '#84cbe0' : '#ff947e', 'right', '500');
      if (searching) { const progress = M.clamp((POLICE.S.seenT-2.5)/(10+P.wanted*7-2.5),0,1); g.fillStyle = '#263e46'; g.fillRect(W_-188,98,164,2); g.fillStyle = '#84cbe0'; g.fillRect(W_-188,98,164*progress,2); }
    }
    weaponIcon(W_ - 60, 112, P.weapon); const ammo = P.weapons[P.weapon]; if (ammo !== Infinity) { const mag = PLAYER.magazine(); text(WEAPONS[P.weapon].projectile ? String(ammo) : mag + ' / ' + Math.max(0,ammo-mag), W_ - 100, 117, 18, '#fff', 'right'); }
    if (ECON.S.bounty > 0) text('BOUNTY  ' + '\u25cf'.repeat(ECON.S.bounty), W_ - 24, 150, 13, ECON.S.crew ? '#ff5040' : '#e0a040', 'right');
    text(WEAPONS[P.weapon].name, W_ - 24, 140, 12, '#ccc', 'right', 'normal');
    if (P.carNameT > 0 && P.car) text(P.lastCarName, W_ - 24, H_ - 40, 22, 'rgba(245,197,66,' + Math.min(1, P.carNameT) + ')', 'right');
    // top left: clock and district
    const lx = TOUCH.active ? radarLayout(W_, H_).R * 2 + 32 : 28;
    text(CITY.districtName(P.x, P.z).toUpperCase(), lx, 30, 17, '#eee5ce', 'left', '500', true, true); text(W.clockString(), lx, 53, 13, '#dfe6e3', 'left', 'normal', true, true);
    if (AUDIO.radioStation > 0 && P.car) text('♪ ' + AUDIO.STATIONS[AUDIO.radioStation], lx - 4, 76, 12, '#ccc', 'left', 'normal');
    // notifications
    for (let i = notes.length - 1, k = 0; i >= 0; i--, k++) { const n = notes[i]; n.t -= dt; if (n.t <= 0) { notes.splice(i, 1); continue; } text(n.text, W_ / 2, (TOUCH.active ? 112 : 60) + k * 22, 15, 'rgba(255,255,255,' + Math.min(1, n.t) + ')', 'center'); }
    if (P.reloadT > 0) { text('RELOADING', W_/2,H_/2+42,11,'#f5ce68','center','500'); g.fillStyle='#20343d'; g.fillRect(W_/2-40,H_/2+54,80,3); g.fillStyle='#f5ce68'; g.fillRect(W_/2-40,H_/2+54,80*(1-P.reloadT/P.reloadDuration),3); }
    else if (!P.car && WEAPONS[P.weapon].clip && !WEAPONS[P.weapon].projectile && PLAYER.magazine() === 0 && P.weapons[P.weapon] > 0) text('R · RELOAD',W_/2,H_/2+42,12,'#f5ce68','center');
    zone(W_-200,103,176,48,'KeyR');
    // objective
    const obj = MISSIONS.objective;
    if (obj !== objSeen) { objSeen = obj; objT = 0; } objT += dt;
    // Driving, the full card sat right over your own car. Once read (six seconds after it changes) it folds into a
    // one-line strip at the top of the screen; on foot, and whenever the text changes, it is shown in full.
    if (obj && P.car && objT > 6 && !MISSIONS.S.retry) {
      const bp = MISSIONS.blipPos(), distance = bp ? Math.round(M.dist(P.x,P.z,bp.x,bp.z)) : null; const line = obj.length > 80 ? obj.slice(0, 78) + '…' : obj;
      g.font = `normal 13px ${FONT}`; const w = Math.min(W_ - 40, g.measureText(line).width + (distance !== null ? 90 : 36)), x = (W_ - w) / 2, y = 10;
      g.fillStyle = 'rgba(12,24,29,.78)'; g.fillRect(x, y, w, 26); g.fillStyle = '#f5ce68'; g.fillRect(x, y, 3, 26);
      text(line, x + 14, y + 13, 13, '#f2efdf', 'left', 'normal', false); if (distance !== null) text(distance + ' m', x + w - 12, y + 13, 11, '#b5c9c9', 'right', '500', false);
    } else if (obj) {
      const width = Math.min(540, W_-40), rows = wrap(obj,15,width-38), height = 45+rows.length*21;
      const x = (W_-width)/2, y = TOUCH.active ? H_-height-172 : H_-height-78;
      g.fillStyle = 'rgba(12,24,29,.9)'; g.fillRect(x,y,width,height); g.fillStyle = '#f5ce68'; g.fillRect(x,y,3,height);
      const bp = MISSIONS.blipPos(), distance = bp ? Math.round(M.dist(P.x,P.z,bp.x,bp.z)) : null;
      text(MISSIONS.S.retry ? 'JOB AVAILABLE · Y TO RETRY' : MISSIONS.S.current ? MISSIONS.S.current.name : 'ON THE STREETS',x+18,y+18,10,'#f5ce68','left','600',false);
      if (distance !== null) text(distance+' m',x+width-18,y+18,11,'#b5c9c9','right','500',false);
      rows.forEach((line,i) => text(line,x+18,y+43+i*21,15,'#f2efdf','left','normal',false));
      if (MISSIONS.S.retry) zone(x,y,width,height,'KeyY');
    }
    if(P.damageDirectionT>0){P.damageDirectionT=Math.max(0,P.damageDirectionT-dt);const a=M.angleTo(P.camYaw,P.damageDirection),cx=W_/2+Math.sin(a)*100,cy=H_/2-Math.cos(a)*100;g.save();g.translate(cx,cy);g.rotate(a);g.fillStyle=`rgba(244,107,83,${P.damageDirectionT})`;g.beginPath();g.moveTo(0,-10);g.lineTo(-7,5);g.lineTo(7,5);g.fill();g.restore();}
    // crosshair
    if (P.aim || (P.car && (INPUT.mouse.buttons & 1))) { const lock = !!P.aimTarget; const col = lock ? '#ff5a4a' : '#fff'; g.strokeStyle = col; g.lineWidth = 2; const r = (lock ? 7 : 9)+(P.bloom||0)*13+P.speed*1.3; g.beginPath(); g.arc(W_ / 2, H_ / 2, r, 0, 7); g.stroke(); g.beginPath(); for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.moveTo(W_ / 2 + sx * (r + 3), H_ / 2 + sy * (r + 3)); g.lineTo(W_ / 2 + sx * (r + 10), H_ / 2 + sy * (r + 10)); } g.stroke(); g.fillStyle = col; g.fillRect(W_ / 2 - 1.5, H_ / 2 - 1.5, 3, 3); }
    if (hitT > 0) { hitT -= dt; const k = hitT / 0.2; g.strokeStyle = hitKill ? `rgba(255,60,40,${k})` : `rgba(255,255,255,${k})`; g.lineWidth = 2.5; const r0 = 6 + (1 - k) * 6, r1 = r0 + 7; g.beginPath(); for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { g.moveTo(W_ / 2 + sx * r0, H_ / 2 + sy * r0); g.lineTo(W_ / 2 + sx * r1, H_ / 2 + sy * r1); } g.stroke(); }
    if(POLICE.reports?.length)text('WITNESS CALLING · '+Math.ceil(Math.min(...POLICE.reports.map(r=>r.left)))+'s',W_-24,102,11,'#f3bd73','right');
    else if(P.wanted>0){const known=POLICE.S.description,c=P.car;const line=POLICE.S.seenT<2.5?'IDENTIFIED':c&&known&&c.identity!==known.vehicle?'VEHICLE UNKNOWN · KEEP DISTANCE':'SEARCHING LAST REPORTED AREA';text(line,W_-24,102,10,'#d4b984','right');}
    if(!P.car&&P.state==='foot'&&!MISSIONS.dialogue){const near=PLAYER.entryCandidate(),vault=PLAYER.vaultCandidate();const label=vault?INPUT.label('Space')+'  Vault low cover':near?INPUT.label('KeyF')+'  '+(near.car.locked?'Locked · ':'Enter ')+near.car.name:null;if(label){const width=Math.min(320,W_-30);g.fillStyle='rgba(14,32,38,.92)';g.fillRect((W_-width)/2,H_-68,width,29);text(label,W_/2,H_-53,13,'#f3dfad','center','600',false);}}
    // help prompts
    if (INPUT.hit('Backquote')) P.dismissLookHint=true;
    if (!TOUCH.active && INPUT.fallback && !P.dismissLookHint && W.state.elapsed < 20) text('Mouse look is active without capture · ` dismisses this hint', W_ / 2, H_ - 40, 12, '#f5c542', 'center', 'normal');
    if (INPUT.hit('F1')) showControls = !showControls;
    if (state === 'playing' && P.alive) text(W.state.elapsed < 30 || P.car || P.aim || MISSIONS.shop ? hintLine(P) : W.cars.some(c => !c.removed && !c.wrecked && M.dist2(c.x, c.z, P.x, P.z) < 30) ? 'F  ENTER VEHICLE   ·   F1  CONTROLS' : 'F1  CONTROLS', W_ / 2, H_ - 22, 12, 'rgba(210,210,210,0.85)', 'center', 'normal');
    if (showControls) drawControls();
    const cur = MISSIONS.S.current; if (cur && cur.data && cur.data.det !== undefined && !cur.data.alarm) { const w = 220, x = W_ / 2 - w / 2, y = 84; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - 2, y - 2, w + 4, 14); g.fillStyle = cur.data.det > 0.7 ? '#e0453b' : '#f5c542'; g.fillRect(x, y, w * cur.data.det, 10); text('DETECTION', W_ / 2, y - 6, 11, '#ddd', 'center', 'normal'); }
    // shop
    const shop = MISSIONS.shop; if (shop) { const n = shop.items.length; const hh = 90 + n * 28; const x = W_ / 2 - 190, y = H_ / 2 - hh / 2; g.fillStyle = 'rgba(0,0,0,0.85)'; g.fillRect(x, y, 380, hh); text(shop.title, x + 190, y + 26, 22, shop.color || '#fff', 'center');
      shop.items.forEach((it, i) => { zone(x + 8, y + 50 + i * 28, 364, 26, 'Digit' + (i + 1)); text((i + 1) + '.  ' + it.label, x + 20, y + 62 + i * 28, 15, it.enabled ? '#fff' : '#777'); if (it.price) text('$' + it.price, x + 360, y + 62 + i * 28, 15, it.enabled ? '#3df06a' : '#777', 'right'); });
      if (shop.hint) text(shop.hint, x + 190, y + hh - 38, 12, '#ccc', 'center', 'normal');
      zone(x + 120, y + hh - 28, 140, 26, 'Escape'); text(TOUCH.active ? 'TAP a line  ·  LEAVE' : 'ESC to leave', x + 190, y + hh - 16, 12, '#aaa', 'center', 'normal'); }
    if (big) { big.t -= dt; const a = Math.min(1, big.t / 0.5, (big.max - big.t) * 3 + 0.05); g.globalAlpha = M.clamp(a, 0, 1); outlined(big.text, W_ / 2, H_ * 0.4, big.text.length > 3 ? 54 : 110, big.color); g.globalAlpha = 1; if (big.t <= 0) big = null; }
    if (P.state === 'busted' || P.state === 'dead') { g.fillStyle = 'rgba(0,0,0,' + M.clamp((P.deadT - 2) / 2.5, 0, 0.9) + ')'; g.fillRect(0, 0, W_, H_); }
    if (starFlash > 0) starFlash -= dt;
    if (fadeT > 0) drawFade(dt);
    if (state === 'paused') drawPause(); if (state === 'map') drawBigMap(P);
    g.save(); g.scale(1/uiScale,1/uiScale); TOUCH.draw(g, cv.clientWidth, cv.clientHeight, state); g.restore();
  }
  function drawFade(dt) { fadeT -= dt; const a = Math.sin(Math.PI * M.clamp(fadeT / fadeDur, 0, 1)); g.fillStyle = 'rgba(0,0,0,' + a + ')'; g.fillRect(0, 0, W_, H_); }
  function drawTitle() {
    const wash = g.createLinearGradient(0,0,W_,H_); wash.addColorStop(0,'rgba(6,25,32,.9)'); wash.addColorStop(.6,'rgba(9,29,34,.38)'); wash.addColorStop(1,'rgba(8,19,26,.8)'); g.fillStyle=wash; g.fillRect(0,0,W_,H_);
    g.fillStyle='#f5ce68'; g.fillRect(W_*.1,H_*.18,44,3);
    text('WELCOME TO THE WRONG SIDE OF PARADISE',W_*.1,H_*.18+24,Math.min(12,W_*.018),'#c4d5d3','left','500',false);
    outlined('GRIFT CITY', W_*.1, H_*.32, Math.min(112,W_*.13),'#f5ce68','left'); text('A stolen car. A second chance. A city that remembers.',W_*.1,H_*.32+65,Math.min(16,W_*.022),'#e3e9dd','left','normal',false);
    g.fillStyle='rgba(10,25,31,.8)'; g.fillRect(W_*.1,H_*.54,W_*.8,76); g.strokeStyle='rgba(245,206,104,.6)'; g.lineWidth=1; g.strokeRect(W_*.1,H_*.54,W_*.8,76);
    const tap = TOUCH.active, info = GAME.saveInfo(), armed = GAME.wipeArmed;
    text(tap ? (info ? 'TAP to continue' : 'TAP to play') : (info ? 'CLICK to continue' : 'CLICK to play'), W_ / 2, H_ * .54 + (info ? 28 : 38), 22, '#fff', 'center');
    if (info) text('saved at ' + info.clock + '  ·  $' + info.money.toLocaleString() + '  ·  ' + info.missions + (info.missions === 1 ? ' mission' : ' missions') + ' passed', W_ / 2, H_ * .54 + 54, 14, '#c4d5d3', 'center', 'normal');
    newGameRect = null;
    const lines = ['WASD / arrows  move · drive', 'Mouse  look and aim · left button  attack · right button  aim', 'SHIFT  sprint · SPACE  jump / handbrake · F  enter / leave car', 'Scroll, Q / E, 1–8  weapons · R  reload / radio · H  horn · L  siren · T  taxi / vigilante job', 'TAB  map · ESC  pause · M  mute'];
    if (info) { // a real button, for the mouse as well as a finger; the first press arms it, the second erases the save
      const bw = armed ? 350 : 190, bh = 40, bxx = W_ / 2 - bw / 2, byy = H_ * .54 + 86;
      g.fillStyle = armed ? 'rgba(120,20,20,0.85)' : 'rgba(10,14,18,0.6)'; g.fillRect(bxx, byy, bw, bh);
      g.strokeStyle = armed ? 'rgba(255,140,120,0.9)' : 'rgba(255,255,255,0.5)'; g.lineWidth = 2; g.strokeRect(bxx, byy, bw, bh);
      text(armed ? (tap ? 'TAP AGAIN to erase the save' : 'CLICK AGAIN or N to erase the save') : (tap ? 'NEW GAME' : 'NEW GAME  (N)'), W_ / 2, byy + bh / 2, armed ? 15 : 17, '#fff', 'center');
      newGameRect = { x: bxx*uiScale, y: byy*uiScale, w: bw*uiScale, h: bh*uiScale }; zone(bxx, byy, bw, bh, 'KeyN');
    }
    const touchLines = ['Left thumb  a stick appears where you touch: walk, run at the rim, steer', 'Right thumb  drag to look · the buttons fire, aim, jump and get you in and out', 'In a car  GAS and BRAKE on the right, HAND for the handbrake, EXIT to get out', 'Top right  the map, and the pause menu for options'];
    (tap ? touchLines : lines).forEach((l, i) => text(l, W_ / 2, H_ * .54 + (info ? 150 : 100) + i * 22, 14, '#bbb', 'center', 'normal'));
  }
  let loadNote = 'building the city…', loadFrac = -1;
  function loading(note, frac) { loadNote = note; loadFrac = frac === undefined ? -1 : frac; draw(0, 'loading'); }
  function drawLoading() { g.fillStyle = '#000'; g.fillRect(0, 0, W_, H_); outlined('GRIFT CITY', W_ / 2, H_ * 0.45, 70, '#f5c542'); text(loadNote, W_ / 2, H_ * 0.45 + 60, 18, '#ccc', 'center', 'normal');
    if (loadFrac >= 0) { const w = Math.min(320, W_ * 0.5), x = (W_ - w) / 2, y = H_ * 0.45 + 84; g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(x, y, w, 6); g.fillStyle = '#f5c542'; g.fillRect(x, y, w * M.clamp(loadFrac, 0, 1), 6); } }
  // ---- Key reminders: a line for what you are doing right now, F1 for the whole sheet
  let showControls = false, hitT = 0, hitKill = false;
  function hitMark(kill) { hitT = 0.2; hitKill = !!kill; }
  function hintLine(P) {
    if (MISSIONS.shop) return TOUCH.active ? 'TAP a line to buy · LEAVE to go' : 'DIGITS pick · F or ESC leave';
    if (MISSIONS.dialogue) return TOUCH.active ? 'TAP for the next line' : 'SPACE next line';
    if (TOUCH.active) {
      const cc = P.car;
      if (cc) return 'GAS · BRAKE · HAND handbrake · EXIT · stick steers · drag to look';
      return 'stick to walk, push it to the rim to run · drag the right side to look';
    }
    if (P.state === 'entering') return 'Getting in · F or move to cancel';
    const c = P.car;
    if (c) { if (c.spec.boat) return 'W/S throttle · A/D rudder · F get out near land · F1 all controls'; if (c.spec.bike) return 'W/S throttle · A/D lean · SPACE brake slide · F get off · LMB drive-by · F1 all controls';
      return 'W/S drive · A/D steer · SPACE handbrake · F get out · H horn' + (c.type === 'police' || c.type === 'swat' ? ' · L siren' : '') + ' · R radio · LMB drive-by · F1 all controls'; }
    const near = PLAYER.entryCandidate();
    return (near ? 'F '+(near.car.locked ? 'locked' : near.car.name)+' · ' : '') + `${INPUT.label('Space')} jump/vault · ${INPUT.label('KeyZ')} crouch · ${INPUT.label('KeyX')} evade · ${INPUT.label('KeyV')} shoulder · ${INPUT.label('KeyR')} reload · TAB map · F1 controls`;
  }
  const CONTROLS = [['ON FOOT', [['W A S D', 'move'], ['mouse', 'look'], ['SHIFT', 'run'], ['SPACE', 'jump / vault'], ['CLICK / CTRL', 'attack or fire'], ['ALT (Option) / C', 'aim (or right-click, two-finger click on a trackpad)'], ['WHEEL / 1-9', 'change weapon'], ['F', 'get in a car, boat or bike'], ['R / Z / X / V', 'reload / crouch / evade / shoulder'], ['G (hold)', 'talk to the debtor, empty-handed'], ['Y', 'retry a failed mission']]],
    ['DRIVING', [['W / S', 'accelerate / brake, reverse'], ['A / D', 'steer'], ['SPACE', 'handbrake'], ['F', 'get out'], ['H', 'horn'], ['L', 'siren (police cars)'], ['R', 'next radio station'], ['LMB', 'drive-by with a pistol or SMG']]],
    ['CITY', [['T', 'start or stop a side job in a taxi or police car'], ['walk in', 'shops, the bar, the safehouse, elevators'], ['DIGITS', 'pick from a menu'], ['P', 'photo mode'], ['TAB', 'map'], ['ESC', 'pause and options'], ['F1', 'this sheet']]]];
  function drawControls() { g.fillStyle = 'rgba(0,0,0,0.78)'; g.fillRect(0, 0, W_, H_); outlined('CONTROLS', W_ / 2, 60, 40, '#f5c542'); const colW = Math.min(300, W_ / 3.2); const x0 = W_ / 2 - colW * 1.5;
    CONTROLS.forEach(([title, rows], c) => { const cx = x0 + c * colW; text(title, cx + colW / 2, 120, 16, '#f5c542', 'center'); rows.forEach(([k, d], i) => { text(k, cx + colW * 0.42, 154 + i * 26, 14, '#fff', 'right'); text(d, cx + colW * 0.48, 154 + i * 26, 13, '#ccc', 'left', 'normal'); }); });
    text('F1 to close', W_ / 2, H_ - 40, 14, '#aaa', 'center', 'normal'); }
  function drawPause() { g.fillStyle='rgba(5,13,18,.65)'; g.fillRect(0,0,W_,H_); }
  function drawBigMap(P, overlay = null) {
    g.fillStyle = 'rgba(10,21,27,.96)';g.fillRect(0,0,W_,H_);const wide=window.innerWidth>850||(window.innerWidth>600&&window.innerHeight<550),area=wide?W_-320/uiScale:W_,height=wide?H_-60:H_-260/uiScale,size=Math.max(120,Math.min(area-40,height)),scale=size/(1024/mapCanvas._s),ox=(area-size)/2,oy=26;mapRect={x:ox,y:oy,size,scale,b0:mapCanvas._b0,uiScale};
    g.save(); g.translate(ox, oy); g.scale(scale, scale); g.translate(-mapCanvas._b0, -mapCanvas._b0); g.drawImage(mapCanvas, 0, 0, 1024, 1024, mapCanvas._b0, mapCanvas._b0, 1024 / mapCanvas._s, 1024 / mapCanvas._s);
    routeLine(PLAYER.P, scale);
    if(typeof NAV!=='undefined'&&NAV.waypoint){const p=NAV.waypoint;g.strokeStyle='#76e0d0';g.lineWidth=3/scale;g.beginPath();g.arc(p.x,p.z,11/scale,0,7);g.stroke();}
    drawMapIcons(scale * 0.6, null); for (const bp of MISSIONS.allBlips()) { g.fillStyle = bp.col; g.beginPath(); g.arc(bp.x, bp.z, 8 / scale, 0, 7); g.fill(); }
    for (const p of W.pickups) if (!p.taken && p.kind === 'package' && false) { g.fillStyle = '#ffb060'; g.beginPath(); g.arc(p.x, p.z, 4 / scale, 0, 7); g.fill(); }
    if (overlay) overlay(scale);
    g.save(); g.translate(P.x, P.z); g.rotate(-(P.car ? P.car.angle : P.angle) + Math.PI); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2 / scale; g.beginPath(); g.moveTo(0, -12 / scale); g.lineTo(8 / scale, 9 / scale); g.lineTo(0, 4 / scale); g.lineTo(-8 / scale, 9 / scale); g.closePath(); g.fill(); g.stroke(); g.restore(); g.restore();
    text('FOUNDRY QUARTER',ox+size*.34,oy+size*.46,10,'#e7e2ce','center');
    text('SOUTHPORT',ox+size*.79,oy+size*.89,11,'#d4d1bc','center');text('DOWNTOWN',ox+size*.62,oy+size*.60,11,'#d4d1bc','center');
    text('Lantern Lane',ox+size*.29,oy+size*.36,9,'#8be7d8','center');
    zone(W_ / 2 - 90, H_ - 30, 180, 28, 'Tab'); text(TOUCH.active ? 'TAP to close' : 'ESC to close · TAB through destinations', W_ / 2, H_ - 16, 13, '#aaa', 'center', 'normal');
  }
  // Where a run went: the big map with every sampled position burned in (tools/playtest/run.js writes it as heatmap.png).
  function heatmap(track) { resize(); g.clearRect(0, 0, W_, H_); drawBigMap(PLAYER.P, (scale) => { g.fillStyle = 'rgba(255,70,30,0.22)'; for (const [x, z] of track) { g.beginPath(); g.arc(x, z, 7 / scale, 0, 7); g.fill(); } g.fillStyle = '#fff'; g.beginPath(); g.arc(track[0][0], track[0][1], 5 / scale, 0, 7); g.fill(); }); text('positions sampled every 0.4 s of wall time; white dot is the start', W_ / 2, H_ - 14, 12, '#ccc', 'center', 'normal'); }
  return {get mapRect(){return mapRect;}, radarLayout, init, draw, loading, notify, money, big: bigText, clearBig, flashStars, fade, buildMap, heatmap, hitMark, zones, get newGameRect() { return newGameRect; }, shake: (a) => PLAYER.shake(a) };
})();
