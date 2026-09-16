// GRIFT CITY — the 2D overlay: radar, money, health, wanted stars, weapon, objectives, dialogue, menus.
'use strict';
const HUD = (() => {
  let cv, g, W_, H_, mapCanvas = null; const notes = []; let big = null, starFlash = 0, fadeT = 0, fadeDur = 0, moneyAnim = { shown: 0, target: 0 };
  const FONT = '"Helvetica Neue", Arial, sans-serif'; const DISPLAY = 'Impact, "Arial Black", "Helvetica Neue", sans-serif';
  function init(canvas) { cv = canvas; g = cv.getContext('2d'); }
  function resize() { const dpr = Math.min(window.devicePixelRatio || 1, 2); const w = Math.floor(cv.clientWidth * dpr), h = Math.floor(cv.clientHeight * dpr); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } W_ = cv.clientWidth; H_ = cv.clientHeight; g.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function notify(text) { notes.push({ text, t: 4 }); if (notes.length > 4) notes.shift(); }
  function money(n, why) { moneyAnim.target = PLAYER.money; if (why) notify((n >= 0 ? '+$' : '-$') + Math.abs(n) + '  ' + why); }
  function bigText(text, color, dur = 3) { big = { text, color, t: dur, max: dur }; }
  function clearBig() { big = null; }
  function flashStars() { starFlash = 1.5; }
  function fade(dur) { fadeT = dur; fadeDur = dur; }
  function text(t, x, y, size, color = '#fff', align = 'left', weight = 'bold', shadow = true) { g.font = `${weight} ${size}px ${FONT}`; g.textAlign = align; g.textBaseline = 'middle'; if (shadow) { g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillText(t, x + 2, y + 2); } g.fillStyle = color; g.fillText(t, x, y); }
  function outlined(t, x, y, size, color, align = 'center') { g.font = `900 ${size}px ${DISPLAY}`; g.letterSpacing = '1px'; g.textAlign = align; g.textBaseline = 'middle'; g.lineWidth = Math.max(2, size * 0.1); g.strokeStyle = '#000'; g.lineJoin = 'round'; g.strokeText(t, x, y); g.fillStyle = color; g.fillText(t, x, y); }

  // ---- Radar map, painted once
  function buildMap() {
    const [b0, b1] = W.bounds; const size = b1 - b0; mapCanvas = document.createElement('canvas'); mapCanvas.width = mapCanvas.height = 1024; const m = mapCanvas.getContext('2d'); const s = 1024 / size; mapCanvas._s = s; mapCanvas._b0 = b0;
    m.fillStyle = '#1b3a55'; m.fillRect(0, 0, 1024, 1024);
    m.fillStyle = '#5f6b5a'; m.fillRect((-14 - b0) * s, (-14 - b0) * s, (CITY.SIZE + 28) * s, (CITY.SIZE + 28) * s);
    for (const bl of CITY.blocks) { const col = bl.kind === 'park' ? '#4a7a3c' : (bl.kind === 'parking' || bl.kind === 'stunt') ? '#6d6d6d' : bl.kind === 'docks' ? '#7a6f55' : '#8d8d86'; m.fillStyle = col; m.fillRect((bl.x - 3 - b0) * s, (bl.z - 3 - b0) * s, 70 * s, 70 * s); m.fillStyle = 'rgba(0,0,0,0.25)'; for (const l of bl.lots) if (l.kind !== 'wall') m.fillRect((l.x0 - b0) * s, (l.z0 - b0) * s, (l.x1 - l.x0) * s, (l.z1 - l.z0) * s); }
    m.fillStyle = '#d9d7cf'; for (let i = 0; i <= CITY.GRID; i++) { m.fillRect((i * CITY.PITCH - 7 - b0) * s, (-7 - b0) * s, 14 * s, (CITY.SIZE + 14) * s); m.fillRect((-7 - b0) * s, (i * CITY.PITCH - 7 - b0) * s, (CITY.SIZE + 14) * s, 14 * s); }
    const icons = { safehouse: ['#ff70d0', 'S'], garage: ['#f5a623', 'V'], spray: ['#f5c542', 'P'], guns: ['#e0453b', 'G'], hospital: ['#ffffff', 'H'], police: ['#5aa0ff', 'P'], bank: ['#3df06a', '$'], tower: ['#a0a0ff', 'C'], docks: ['#c0a060', 'D'] };
    mapCanvas._icons = []; for (const k in icons) for (const p of (CITY.places[k] || [])) mapCanvas._icons.push({ x: p.x, z: p.z, col: icons[k][0], ch: icons[k][1], kind: k });
  }
  function drawMapIcons(scale, filter) { for (const ic of mapCanvas._icons) { if (filter && !filter(ic)) continue; g.fillStyle = ic.col; g.beginPath(); g.arc(ic.x, ic.z, 4 / scale, 0, 7); g.fill(); } }
  function radar(P, cam) {
    const R = Math.min(110, W_ * 0.14), cx = R + 24, cy = H_ - R - 24; const scale = 0.55; const yaw = W.state.camYaw;
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 7); g.clip();
    g.fillStyle = '#1b3a55'; g.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    g.translate(cx, cy); g.rotate(yaw + Math.PI); g.scale(scale, scale); g.translate(-P.x, -P.z);
    const s = mapCanvas._s, b0 = mapCanvas._b0; g.drawImage(mapCanvas, 0, 0, 1024, 1024, b0, b0, 1024 / s, 1024 / s);
    drawMapIcons(scale, null);
    // blips
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
    const bp = MISSIONS.blipPos(); if (bp) { const dx = bp.x - P.x, dz = bp.z - P.z; if (Math.hypot(dx, dz) * scale > R) { const a = Math.atan2(dx, dz); const sa = a - yaw; const ex = cx - Math.sin(sa) * (R - 8), ey = cy - Math.cos(sa) * (R - 8); /* same rotation as the map: ahead is up */ g.fillStyle = bp.col; g.beginPath(); g.arc(ex, ey, 6, 0, 7); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 2; g.stroke(); } }
    g.strokeStyle = 'rgba(0,0,0,0.85)'; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5; g.stroke();
    // north indicator
    { const a = yaw + Math.PI; const nx = cx + Math.sin(a) * (R + 12), ny = cy - Math.cos(a) * (R + 12); text('N', nx, ny, 12, '#fff', 'center'); }
    // health & armor bars beside the radar
    const bx = cx + R + 12, by = cy + R - 14, bw = Math.min(170, W_ * 0.2);
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(bx - 2, by - 12, bw + 4, 14); g.fillStyle = P.health > 25 ? '#d8352f' : (Math.sin(W.state.elapsed * 10) > 0 ? '#ff6060' : '#802020'); g.fillRect(bx, by - 10, bw * M.clamp(P.health / 100, 0, 1), 10);
    if (P.armor > 0) { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(bx - 2, by - 28, bw + 4, 14); g.fillStyle = '#c8c8d0'; g.fillRect(bx, by - 26, bw * M.clamp(P.armor / 100, 0, 1), 10); }
    if (P.car) { const kmh = Math.round(P.car.absSpeed * 3.6 * 1.6); text(kmh + ' km/h', bx, by - (P.armor > 0 ? 42 : 26), 14, '#ddd'); }
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
  function stars(P, x, y) { for (let i = 0; i < 5; i++) { const lit = i < P.wanted; const flash = starFlash > 0 && lit && Math.sin(W.state.elapsed * 20) > 0; text('★', x - i * 24, y, 24, lit ? (flash ? '#fff' : '#f5c542') : 'rgba(255,255,255,0.18)', 'center'); } }

  function draw(dt, state) {
    resize(); g.clearRect(0, 0, W_, H_); const P = PLAYER.P;
    if (state === 'title') return drawTitle();
    if (state === 'loading') return drawLoading();
    if (!mapCanvas) buildMap();
    // world labels: ped shouts, car name
    for (const p of W.peds) if (p.shoutT > 0 && p.alive) { const s = RENDER.project(p.x, p.y + 2.1, p.z, cv); if (s && s[2] < 40) text(p.shout, s[0], s[1], 13, '#fff', 'center', 'normal'); }
    if (P.hurtFlash > 0) { const gr = g.createRadialGradient(W_ / 2, H_ / 2, H_ * 0.3, W_ / 2, H_ / 2, H_ * 0.8); gr.addColorStop(0, 'rgba(180,0,0,0)'); gr.addColorStop(1, `rgba(180,0,0,${P.hurtFlash * 1.2})`); g.fillStyle = gr; g.fillRect(0, 0, W_, H_); }
    if (P.health <= 25 && P.alive) { const gr = g.createRadialGradient(W_ / 2, H_ / 2, H_ * 0.4, W_ / 2, H_ / 2, H_ * 0.85); gr.addColorStop(0, 'rgba(120,0,0,0)'); gr.addColorStop(1, `rgba(120,0,0,${0.25 + 0.2 * Math.sin(W.state.elapsed * 6)})`); g.fillStyle = gr; g.fillRect(0, 0, W_, H_); }
    const dlg = MISSIONS.dialogue;
    if (dlg) { // letterbox + subtitles
      g.fillStyle = '#000'; g.fillRect(0, 0, W_, H_ * 0.12); g.fillRect(0, H_ * 0.88, W_, H_ * 0.12);
      const line = dlg.lines[dlg.i]; if (line) { if (line[0]) text(line[0], W_ / 2, H_ * 0.8 - 26, 16, '#f5c542', 'center'); text(line[1], W_ / 2, H_ * 0.8, 20, '#fff', 'center', 'normal'); }
      text('SPACE to continue', W_ - 20, H_ - 18, 12, '#aaa', 'right', 'normal');
      if (fadeT > 0) drawFade(dt); return;
    }
    radar(P, RENDER.cam);
    // top right: money, stars, weapon
    moneyAnim.shown = Math.abs(moneyAnim.target - moneyAnim.shown) < 2 ? moneyAnim.target : M.lerp(moneyAnim.shown, moneyAnim.target, Math.min(1, 6 * dt)); moneyAnim.target = P.money;
    outlined('$' + Math.round(moneyAnim.shown).toString().padStart(8, '0'), W_ - 24, 34, 26, '#3df06a', 'right');
    stars(P, W_ - 34, 70);
    weaponIcon(W_ - 60, 112, P.weapon); const ammo = P.weapons[P.weapon]; if (ammo !== Infinity) text(String(ammo), W_ - 100, 112, 18, '#fff', 'right');
    text(WEAPONS[P.weapon].name, W_ - 24, 140, 12, '#ccc', 'right', 'normal');
    if (P.carNameT > 0 && P.car) text(P.lastCarName, W_ - 24, H_ - 40, 22, 'rgba(245,197,66,' + Math.min(1, P.carNameT) + ')', 'right');
    // top left: clock and district
    text(W.clockString(), 24, 30, 22, '#fff'); text(CITY.districtName(P.x, P.z).toUpperCase(), 24, 54, 13, '#ccc', 'left', 'normal');
    if (AUDIO.radioStation > 0 && P.car) text('♪ ' + AUDIO.STATIONS[AUDIO.radioStation], 24, 76, 12, '#ccc', 'left', 'normal');
    // notifications
    for (let i = notes.length - 1, k = 0; i >= 0; i--, k++) { const n = notes[i]; n.t -= dt; if (n.t <= 0) { notes.splice(i, 1); continue; } text(n.text, W_ / 2, 60 + k * 22, 15, 'rgba(255,255,255,' + Math.min(1, n.t) + ')', 'center'); }
    // objective
    const obj = MISSIONS.objective; if (obj) { g.font = `bold 16px ${FONT}`; const tw = g.measureText(obj).width; g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(W_ / 2 - tw / 2 - 14, H_ - 66, tw + 28, 30); text(obj, W_ / 2, H_ - 51, 16, '#f5e9c0', 'center'); }
    // crosshair
    if (P.aim || (P.car && (INPUT.mouse.buttons & 1))) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(W_ / 2, H_ / 2, 8, 0, 7); g.stroke(); g.fillStyle = '#fff'; g.fillRect(W_ / 2 - 1, H_ / 2 - 1, 2, 2); }
    // help prompts
    if (INPUT.fallback && W.state.elapsed < 20) text('Pointer lock unavailable here: the mouse steers the camera without capture', W_ / 2, H_ - 40, 12, '#f5c542', 'center', 'normal');
    if (state === 'playing' && !P.car && P.alive && W.state.elapsed < 90 && !MISSIONS.S.current) text('WASD move · mouse look · SHIFT sprint · F enter car · LMB attack · SCROLL weapons · TAB map · ESC menu', W_ / 2, H_ - 22, 12, '#bbb', 'center', 'normal');
    // shop
    const shop = MISSIONS.shop; if (shop) { const x = W_ / 2 - 170, y = H_ / 2 - 150; g.fillStyle = 'rgba(0,0,0,0.85)'; g.fillRect(x, y, 340, 290); text('IRONMONGER', x + 170, y + 26, 22, '#e0453b', 'center'); MISSIONS.GUNS.forEach(([k, price, ammo], i) => { const name = k === 'armor' ? 'BODY ARMOR' : WEAPONS[k].name + (ammo ? ' (' + ammo + ')' : ''); text((i + 1) + '.  ' + name, x + 20, y + 62 + i * 28, 15, P.money >= price ? '#fff' : '#777'); text('$' + price, x + 320, y + 62 + i * 28, 15, '#3df06a', 'right'); }); text('ESC to leave', x + 170, y + 268, 12, '#aaa', 'center', 'normal'); }
    if (big) { big.t -= dt; const a = Math.min(1, big.t / 0.5, (big.max - big.t) * 3 + 0.05); g.globalAlpha = M.clamp(a, 0, 1); outlined(big.text, W_ / 2, H_ * 0.4, big.text.length > 3 ? 54 : 110, big.color); g.globalAlpha = 1; if (big.t <= 0) big = null; }
    if (P.state === 'busted' || P.state === 'dead') { g.fillStyle = 'rgba(0,0,0,' + M.clamp((P.deadT - 2) / 2.5, 0, 0.9) + ')'; g.fillRect(0, 0, W_, H_); }
    if (starFlash > 0) starFlash -= dt;
    if (fadeT > 0) drawFade(dt);
    if (state === 'paused') drawPause(); if (state === 'map') drawBigMap(P);
  }
  function drawFade(dt) { fadeT -= dt; const a = Math.sin(Math.PI * M.clamp(fadeT / fadeDur, 0, 1)); g.fillStyle = 'rgba(0,0,0,' + a + ')'; g.fillRect(0, 0, W_, H_); }
  function drawTitle() {
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, W_, H_);
    outlined('GRIFT CITY', W_ / 2, H_ * 0.3, Math.min(110, W_ * 0.14), '#f5c542'); text('an open-world crime game, one folder of JavaScript', W_ / 2, H_ * 0.3 + 60, 16, '#ddd', 'center', 'normal');
    const blink = Math.sin(performance.now() / 300) > -0.3; if (blink) text(GAME.hasSave() ? 'CLICK to continue     ·     N for a new game' : 'CLICK to play', W_ / 2, H_ * 0.58, 22, '#fff', 'center');
    const lines = ['WASD / arrows  move · drive', 'Mouse  look and aim · left button  attack · right button  aim', 'SHIFT  sprint · SPACE  jump / handbrake · F  enter / leave car', 'Scroll, Q / E, 1–8  weapons · R  radio · H  horn · L  siren · T  taxi / vigilante job', 'TAB  map · ESC  pause · M  mute'];
    lines.forEach((l, i) => text(l, W_ / 2, H_ * 0.7 + i * 22, 14, '#bbb', 'center', 'normal'));
  }
  function drawLoading() { g.fillStyle = '#000'; g.fillRect(0, 0, W_, H_); outlined('GRIFT CITY', W_ / 2, H_ * 0.45, 70, '#f5c542'); text('building the city…', W_ / 2, H_ * 0.45 + 60, 18, '#ccc', 'center', 'normal'); }
  function drawPause() {
    const P = PLAYER.P; g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(0, 0, W_, H_); outlined('PAUSED', W_ / 2, 80, 48, '#f5c542');
    const st = P.stats; const rows = [['Missions passed', st.missions + ' / ' + (MISSIONS.LIST.length + MISSIONS.LIST2.length + MISSIONS.PHONE.length)], ['Unique stunts', (st.jumps || []).length + ' / ' + CITY.ramps.length], ['Cash earned', '$' + st.cash], ['Hidden packages', st.packages + ' / 20'], ['Cars stolen', st.carsStolen], ['People killed', st.kills], ['Distance travelled', (st.distance / 1000).toFixed(1) + ' km'], ['Insane stunts', st.stunts], ['Times wasted / busted', st.wasted + ' / ' + st.busted], ['Time of day', W.clockString()]];
    rows.forEach(([k, v], i) => { text(k, W_ / 2 - 60, 150 + i * 26, 15, '#bbb', 'right', 'normal'); text(String(v), W_ / 2 - 48, 150 + i * 26, 15, '#fff', 'left'); });
    const o = GAME.options; const opts = [['[ ]', 'mouse sensitivity', o.sensitivity.toFixed(1)], ['I', 'invert look', o.invertY ? 'on' : 'off'], ['K', 'shadows', o.shadows ? 'on' : 'off'], ['B', 'bloom & post', o.bloom ? 'on' : 'off'], ['P', 'render scale', o.resolution + 'x'], ['M', 'sound', AUDIO.muted ? 'muted' : 'on'], ['N', 'new game', '']];
    opts.forEach(([k, n, v], i) => { const y = 150 + i * 26; text(k, W_ / 2 + 200, y, 15, '#f5c542', 'right'); text(n, W_ / 2 + 212, y, 15, '#ccc', 'left', 'normal'); text(v, W_ / 2 + 360, y, 15, '#fff', 'left'); });
    text('ESC or click  resume', W_ / 2, H_ - 60, 14, '#ccc', 'center', 'normal');
    text('WASD move · mouse look · LMB attack · RMB aim · SHIFT sprint · SPACE jump/handbrake · F car · T side job · R radio · L siren · H horn', W_ / 2, H_ - 34, 12, '#888', 'center', 'normal');
  }
  function drawBigMap(P) {
    g.fillStyle = 'rgba(0,0,0,0.8)'; g.fillRect(0, 0, W_, H_); const size = Math.min(W_, H_) - 60; const scale = size / (1024 / mapCanvas._s); const ox = (W_ - size) / 2, oy = (H_ - size) / 2;
    g.save(); g.translate(ox, oy); g.scale(scale, scale); g.translate(-mapCanvas._b0, -mapCanvas._b0); g.drawImage(mapCanvas, 0, 0, 1024, 1024, mapCanvas._b0, mapCanvas._b0, 1024 / mapCanvas._s, 1024 / mapCanvas._s);
    drawMapIcons(scale * 0.6, null); for (const bp of MISSIONS.allBlips()) { g.fillStyle = bp.col; g.beginPath(); g.arc(bp.x, bp.z, 8 / scale, 0, 7); g.fill(); }
    for (const p of W.pickups) if (!p.taken && p.kind === 'package' && false) { g.fillStyle = '#ffb060'; g.beginPath(); g.arc(p.x, p.z, 4 / scale, 0, 7); g.fill(); }
    g.save(); g.translate(P.x, P.z); g.rotate(-(P.car ? P.car.angle : P.angle) + Math.PI); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2 / scale; g.beginPath(); g.moveTo(0, -12 / scale); g.lineTo(8 / scale, 9 / scale); g.lineTo(0, 4 / scale); g.lineTo(-8 / scale, 9 / scale); g.closePath(); g.fill(); g.stroke(); g.restore(); g.restore();
    const legend = [['#ff70d0', 'Safehouse'], ['#f5a623', 'Voss Motors'], ['#3bb8ff', 'Pier 9 jobs'], ['#ff7020', 'Rampage'], ['#f5c542', "Pay 'n' Spray"], ['#e0453b', 'Ironmonger'], ['#ffffff', 'Hospital'], ['#5aa0ff', 'Police'], ['#3df06a', 'Bank'], ['#a0a0ff', 'Crane Holdings'], ['#c0a060', 'Pier 9']];
    legend.forEach(([c, n], i) => { g.fillStyle = c; g.beginPath(); g.arc(24, 30 + i * 22, 5, 0, 7); g.fill(); text(n, 36, 30 + i * 22, 13, '#ddd', 'left', 'normal'); });
    text('TAB to close', W_ / 2, H_ - 16, 13, '#aaa', 'center', 'normal');
  }
  return { init, draw, notify, money, big: bigText, clearBig, flashStars, fade, buildMap };
})();
