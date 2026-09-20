// GRIFT CITY — the 2D overlay: radar, money, health, wanted stars, weapon, objectives, dialogue, menus.
'use strict';
const HUD = (() => {
  let cv, g, W_, H_, mapCanvas = null; const notes = [];
  // Strips the touch layer can tap, rebuilt every frame: {x, y, w, h, key} where key is the key it stands for.
  const zones = []; const zone = (x, y, w, h, key) => { if (TOUCH.active) zones.push({ x, y, w, h, key }); }; let big = null, starFlash = 0, fadeT = 0, fadeDur = 0, moneyAnim = { shown: 0, target: 0 };
  const FONT = '"Helvetica Neue", Arial, sans-serif'; const DISPLAY = 'Impact, "Arial Black", "Helvetica Neue", sans-serif';
  function init(canvas) { cv = canvas; g = cv.getContext('2d'); }
  function resize() { const dpr = Math.min(window.devicePixelRatio || 1, 1.5); /* a full-retina overlay costs more to composite than its text is worth */ const w = Math.floor(cv.clientWidth * dpr), h = Math.floor(cv.clientHeight * dpr); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } W_ = cv.clientWidth; H_ = cv.clientHeight; g.setTransform(dpr, 0, 0, dpr, 0, 0); }
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
    const icons = { safehouse: ['#ff70d0', 'S'], garage: ['#f5a623', 'V'], spray: ['#f5c542', 'P'], guns: ['#e0453b', 'G'], hospital: ['#ffffff', 'H'], police: ['#5aa0ff', 'P'], bank: ['#3df06a', '$'], tower: ['#a0a0ff', 'C'], docks: ['#c0a060', 'D'] };
    mapCanvas._icons = []; for (const k in icons) for (const p of (CITY.places[k] || [])) mapCanvas._icons.push({ x: p.x, z: p.z, col: icons[k][0], ch: icons[k][1], kind: k });
  }
  function drawMapIcons(scale, filter) { for (const ic of mapCanvas._icons) { if (filter && !filter(ic)) continue; g.fillStyle = ic.col; g.beginPath(); g.arc(ic.x, ic.z, 4 / scale, 0, 7); g.fill(); } }
  // On a touchscreen the bottom-left corner belongs to the thumb that moves you, so the radar goes up to the
  // top-left and the district and clock shift out from under it.
  function radarLayout(w, h) { const R = Math.min(82, w * 0.12); return TOUCH.active ? { R, cx: R + 18, cy: R + 18 } : { R, cx: R + 24, cy: h - R - 30 }; }
  function radar(P, cam) {
    const { R, cx, cy } = radarLayout(W_, H_); const scale = 0.55; const yaw = W.state.camYaw;
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 7); g.clip();
    g.fillStyle = '#24383e'; g.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    g.translate(cx, cy); g.rotate(yaw + Math.PI); g.scale(scale, scale); g.translate(-P.x, -P.z);
    const s = mapCanvas._s, b0 = mapCanvas._b0; g.drawImage(mapCanvas, 0, 0, 1024, 1024, b0, b0, 1024 / s, 1024 / s);
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
    const bp = MISSIONS.blipPos(); if (bp) { const dx = bp.x - P.x, dz = bp.z - P.z; if (Math.hypot(dx, dz) * scale > R) { const a = Math.atan2(dx, dz); const sa = a - yaw; const ex = cx - Math.sin(sa) * (R - 8), ey = cy - Math.cos(sa) * (R - 8); /* same rotation as the map: ahead is up */ g.fillStyle = bp.col; g.beginPath(); g.arc(ex, ey, 6, 0, 7); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 2; g.stroke(); } }
    g.strokeStyle = 'rgba(0,0,0,0.85)'; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5; g.stroke();
    // north indicator
    { const a = yaw + Math.PI; const nx = cx + Math.sin(a) * (R + 12), ny = cy - Math.cos(a) * (R + 12); text('N', nx, ny, 12, '#fff', 'center'); }
    // health & armor bars beside the radar
    const bx = TOUCH.active ? cx - R : cx + R + 12, by = TOUCH.active ? cy + R + 30 : cy + R - 14, bw = Math.min(112, W_ * 0.16);
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

  function draw(dt, state, photo) {
    resize(); g.clearRect(0, 0, W_, H_); zones.length = 0; const P = PLAYER.P;
    if (state === 'title') return drawTitle();
    if (state === 'photo') { text('PHOTO MODE  ·  WASD/QE fly  ·  SHIFT fast  ·  wheel zoom  ·  click or ENTER saves a picture  ·  P back', W_ / 2, H_ - 18, 13, 'rgba(255,255,255,0.75)', 'center', 'normal'); if (photo && photo.savedT > 0) text('SAVED', W_ / 2, H_ / 2, 28, '#f5c542', 'center'); return; }
    if (state === 'loading') return drawLoading();
    if (!mapCanvas) buildMap();
    // world labels: ped shouts, car name
    for (const p of W.peds) if (p.shoutT > 0 && p.alive) { const s = RENDER.project(p.x, p.y + 2.1, p.z, cv); if (s && s[2] < 40) text(p.shout, s[0], s[1], 13, '#fff', 'center', 'normal'); }
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
    if (P.wanted > 0) stars(P, W_ - 38, 65);
    weaponIcon(W_ - 60, 112, P.weapon); const ammo = P.weapons[P.weapon]; if (ammo !== Infinity) text(String(ammo), W_ - 100, 112, 18, '#fff', 'right');
    if (ECON.S.bounty > 0) text('BOUNTY  ' + '\u25cf'.repeat(ECON.S.bounty), W_ - 24, 150, 13, ECON.S.crew ? '#ff5040' : '#e0a040', 'right');
    text(WEAPONS[P.weapon].name, W_ - 24, 140, 12, '#ccc', 'right', 'normal');
    if (P.carNameT > 0 && P.car) text(P.lastCarName, W_ - 24, H_ - 40, 22, 'rgba(245,197,66,' + Math.min(1, P.carNameT) + ')', 'right');
    // top left: clock and district
    const lx = TOUCH.active ? radarLayout(W_, H_).R * 2 + 32 : 28;
    text(CITY.districtName(P.x, P.z).toUpperCase(), lx, 30, 17, '#eee5ce', 'left', '500', true, true); text(W.clockString(), lx, 53, 13, '#dfe6e3', 'left', 'normal', true, true);
    if (AUDIO.radioStation > 0 && P.car) text('♪ ' + AUDIO.STATIONS[AUDIO.radioStation], lx - 4, 76, 12, '#ccc', 'left', 'normal');
    // notifications
    for (let i = notes.length - 1, k = 0; i >= 0; i--, k++) { const n = notes[i]; n.t -= dt; if (n.t <= 0) { notes.splice(i, 1); continue; } text(n.text, W_ / 2, (TOUCH.active ? 112 : 60) + k * 22, 15, 'rgba(255,255,255,' + Math.min(1, n.t) + ')', 'center'); }
    // objective
    const obj = MISSIONS.objective; if (obj) { g.font = `bold 16px ${FONT}`; const tw = g.measureText(obj).width; g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(W_ / 2 - tw / 2 - 14, H_ - 66, tw + 28, 30); text(obj, W_ / 2, H_ - 51, 16, '#f5e9c0', 'center'); }
    // crosshair
    if (P.aim || (P.car && (INPUT.mouse.buttons & 1))) { const lock = !!P.aimTarget; const col = lock ? '#ff5a4a' : '#fff'; g.strokeStyle = col; g.lineWidth = 2; const r = lock ? 9 : 12; g.beginPath(); g.arc(W_ / 2, H_ / 2, r, 0, 7); g.stroke(); g.beginPath(); for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.moveTo(W_ / 2 + sx * (r + 3), H_ / 2 + sy * (r + 3)); g.lineTo(W_ / 2 + sx * (r + 10), H_ / 2 + sy * (r + 10)); } g.stroke(); g.fillStyle = col; g.fillRect(W_ / 2 - 1.5, H_ / 2 - 1.5, 3, 3); }
    if (hitT > 0) { hitT -= dt; const k = hitT / 0.2; g.strokeStyle = hitKill ? `rgba(255,60,40,${k})` : `rgba(255,255,255,${k})`; g.lineWidth = 2.5; const r0 = 6 + (1 - k) * 6, r1 = r0 + 7; g.beginPath(); for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { g.moveTo(W_ / 2 + sx * r0, H_ / 2 + sy * r0); g.lineTo(W_ / 2 + sx * r1, H_ / 2 + sy * r1); } g.stroke(); }
    // help prompts
    if (INPUT.fallback && W.state.elapsed < 20) text('Pointer lock unavailable here: the mouse steers the camera without capture', W_ / 2, H_ - 40, 12, '#f5c542', 'center', 'normal');
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
    TOUCH.draw(g, W_, H_, state);
  }
  function drawFade(dt) { fadeT -= dt; const a = Math.sin(Math.PI * M.clamp(fadeT / fadeDur, 0, 1)); g.fillStyle = 'rgba(0,0,0,' + a + ')'; g.fillRect(0, 0, W_, H_); }
  function drawTitle() {
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, W_, H_);
    outlined('GRIFT CITY', W_ / 2, H_ * 0.3, Math.min(110, W_ * 0.14), '#f5c542'); text('an open-world crime game, one folder of JavaScript', W_ / 2, H_ * 0.3 + 60, 16, '#ddd', 'center', 'normal');
    const tap = TOUCH.active;
    const blink = Math.sin(performance.now() / 300) > -0.3; if (blink) text(tap ? (GAME.hasSave() ? 'TAP to continue' : 'TAP to play') : (GAME.hasSave() ? 'CLICK to continue     ·     N for a new game' : 'CLICK to play'), W_ / 2, H_ * 0.58, 22, '#fff', 'center');
    const lines = ['WASD / arrows  move · drive', 'Mouse  look and aim · left button  attack · right button  aim', 'SHIFT  sprint · SPACE  jump / handbrake · F  enter / leave car', 'Scroll, Q / E, 1–8  weapons · R  radio · H  horn · L  siren · T  taxi / vigilante job', 'TAB  map · ESC  pause · M  mute'];
    if (tap && GAME.hasSave()) {
      const bw = 190, bh = 44, bxx = W_ / 2 - bw / 2, byy = H_ * 0.58 + 34;
      g.fillStyle = 'rgba(10,14,18,0.6)'; g.fillRect(bxx, byy, bw, bh);
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2; g.strokeRect(bxx, byy, bw, bh);
      text('NEW GAME', W_ / 2, byy + bh / 2, 17, '#fff', 'center');
      zone(bxx, byy, bw, bh, 'KeyN');
    }
    const touchLines = ['Left thumb  a stick appears where you touch: walk, run at the rim, steer', 'Right thumb  drag to look · the buttons fire, aim, jump and get you in and out', 'In a car  GAS and BRAKE on the right, HAND for the handbrake, EXIT to get out', 'Top right  the map, and the pause menu for options'];
    (tap ? touchLines : lines).forEach((l, i) => text(l, W_ / 2, H_ * 0.7 + i * 22, 14, '#bbb', 'center', 'normal'));
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
    const c = P.car;
    if (c) { if (c.spec.boat) return 'W/S throttle · A/D rudder · F get out near land · F1 all controls'; if (c.spec.bike) return 'W/S throttle · A/D lean · SPACE brake slide · F get off · LMB drive-by · F1 all controls';
      return 'W/S drive · A/D steer · SPACE handbrake · F get out · H horn' + (c.type === 'police' || c.type === 'swat' ? ' · L siren' : '') + ' · R radio · LMB drive-by · F1 all controls'; }
    const near = W.cars.some(v => !v.removed && !v.wrecked && M.dist2(v.x, v.z, P.x, P.z) < 30);
    return (near ? 'F get in · ' : '') + 'WASD move · SHIFT run · SPACE jump · CLICK attack · ALT or C aim · WHEEL weapon · TAB map · F1 all controls';
  }
  const CONTROLS = [['ON FOOT', [['W A S D', 'move'], ['mouse', 'look'], ['SHIFT', 'run'], ['SPACE', 'jump'], ['CLICK / CTRL', 'attack or fire'], ['ALT (Option) / C', 'aim (or right-click, two-finger click on a trackpad)'], ['WHEEL / 1-9', 'change weapon'], ['F', 'get in a car, boat or bike'], ['Y', 'retry a failed mission']]],
    ['DRIVING', [['W / S', 'accelerate / brake, reverse'], ['A / D', 'steer'], ['SPACE', 'handbrake'], ['F', 'get out'], ['H', 'horn'], ['L', 'siren (police cars)'], ['R', 'next radio station'], ['LMB', 'drive-by with a pistol or SMG']]],
    ['CITY', [['T', 'start or stop a side job in a taxi or police car'], ['walk in', 'shops, the bar, the safehouse, elevators'], ['DIGITS', 'pick from a menu'], ['P', 'photo mode'], ['TAB', 'map'], ['ESC', 'pause and options'], ['F1', 'this sheet']]]];
  function drawControls() { g.fillStyle = 'rgba(0,0,0,0.78)'; g.fillRect(0, 0, W_, H_); outlined('CONTROLS', W_ / 2, 60, 40, '#f5c542'); const colW = Math.min(300, W_ / 3.2); const x0 = W_ / 2 - colW * 1.5;
    CONTROLS.forEach(([title, rows], c) => { const cx = x0 + c * colW; text(title, cx + colW / 2, 120, 16, '#f5c542', 'center'); rows.forEach(([k, d], i) => { text(k, cx + colW * 0.42, 154 + i * 26, 14, '#fff', 'right'); text(d, cx + colW * 0.48, 154 + i * 26, 13, '#ccc', 'left', 'normal'); }); });
    text('F1 to close', W_ / 2, H_ - 40, 14, '#aaa', 'center', 'normal'); }
  function drawPause() {
    const P = PLAYER.P; g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(0, 0, W_, H_); outlined('PAUSED', W_ / 2, 80, 48, '#f5c542');
    const st = P.stats; const rows = [['Missions passed', st.missions + ' / ' + (MISSIONS.LIST.length + MISSIONS.LIST2.length + MISSIONS.PHONE.length)], ['Standing: Marla / Crane', ECON.S.rep.marla + ' / ' + ECON.S.rep.crane], ['Properties / stored cars', Object.keys(ECON.S.properties).length + ' / ' + ECON.S.owned.length], ['Unique stunts', (st.jumps || []).length + ' / ' + CITY.ramps.length], ['Cash earned', '$' + st.cash], ['Hidden packages', st.packages + ' / 20'], ['Cars stolen', st.carsStolen], ['People killed', st.kills], ['Distance travelled', (st.distance / 1000).toFixed(1) + ' km'], ['Insane stunts', st.stunts], ['Times wasted / busted', st.wasted + ' / ' + st.busted], ['Time of day', W.clockString()]];
    rows.forEach(([k, v], i) => { text(k, W_ / 2 - 60, 150 + i * 26, 15, '#bbb', 'right', 'normal'); text(String(v), W_ / 2 - 48, 150 + i * 26, 15, '#fff', 'left'); });
    const o = GAME.options; const opts = [['[ ]', 'mouse sensitivity', o.sensitivity.toFixed(1)], ['I', 'invert look', o.invertY ? 'on' : 'off'], ['K', 'shadows', o.shadows ? 'on' : 'off'], ['B', 'bloom & post', o.bloom ? 'on' : 'off'], ['P', 'render scale', o.resolution + 'x'], ['E', 'ink lines', o.edges ? 'on' : 'off'], ['A', 'auto quality', o.auto ? (GAME.auto.level ? 'on, stepped down ' + GAME.auto.level : 'on') : 'off'], ['M', 'sound', AUDIO.muted ? 'muted' : 'on'], ['N', 'new game', '']];
    const OPTKEY = ['BracketRight', 'KeyI', 'KeyK', 'KeyB', 'KeyE', 'KeyP', 'KeyA'];
    opts.forEach(([k, n, v], i) => { const y = 150 + i * 26; if (OPTKEY[i]) zone(W_ / 2 + 150, y - 13, 280, 26, OPTKEY[i]); text(k, W_ / 2 + 200, y, 15, '#f5c542', 'right'); text(n, W_ / 2 + 212, y, 15, '#ccc', 'left', 'normal'); text(v, W_ / 2 + 360, y, 15, '#fff', 'left'); });
    text(TOUCH.active ? 'TAP anywhere to resume  ·  tap an option to change it' : 'ESC or click  resume', W_ / 2, H_ - 60, 14, '#ccc', 'center', 'normal');
    if (GAME.fps) text(GAME.fps + ' fps' + (GAME.fps < 30 ? '  (slow: try P for a lower render scale, K for no shadows)' : ''), W_ / 2, H_ - 86, 13, GAME.fps < 30 ? '#f5a623' : '#888', 'center', 'normal');
    if (!TOUCH.active) text('F1 shows every control', W_ / 2, H_ - 34, 12, '#888', 'center', 'normal');
  }
  function drawBigMap(P, overlay = null) {
    g.fillStyle = 'rgba(0,0,0,0.8)'; g.fillRect(0, 0, W_, H_); const size = Math.min(W_, H_) - 60; const scale = size / (1024 / mapCanvas._s); const ox = (W_ - size) / 2, oy = (H_ - size) / 2;
    g.save(); g.translate(ox, oy); g.scale(scale, scale); g.translate(-mapCanvas._b0, -mapCanvas._b0); g.drawImage(mapCanvas, 0, 0, 1024, 1024, mapCanvas._b0, mapCanvas._b0, 1024 / mapCanvas._s, 1024 / mapCanvas._s);
    drawMapIcons(scale * 0.6, null); for (const bp of MISSIONS.allBlips()) { g.fillStyle = bp.col; g.beginPath(); g.arc(bp.x, bp.z, 8 / scale, 0, 7); g.fill(); }
    for (const p of W.pickups) if (!p.taken && p.kind === 'package' && false) { g.fillStyle = '#ffb060'; g.beginPath(); g.arc(p.x, p.z, 4 / scale, 0, 7); g.fill(); }
    if (overlay) overlay(scale);
    g.save(); g.translate(P.x, P.z); g.rotate(-(P.car ? P.car.angle : P.angle) + Math.PI); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2 / scale; g.beginPath(); g.moveTo(0, -12 / scale); g.lineTo(8 / scale, 9 / scale); g.lineTo(0, 4 / scale); g.lineTo(-8 / scale, 9 / scale); g.closePath(); g.fill(); g.stroke(); g.restore(); g.restore();
    const legend = [['#ff70d0', 'Safehouse'], ['#f5a623', 'Voss Motors'], ['#3bb8ff', 'Pier 9 jobs'], ['#ff7020', 'Rampage'], ['#f5c542', "Pay 'n' Spray"], ['#e0453b', 'Ironmonger'], ['#ffffff', 'Hospital'], ['#5aa0ff', 'Police'], ['#3df06a', 'Bank'], ['#a0a0ff', 'Crane Holdings'], ['#c0a060', 'Pier 9']];
    legend.forEach(([c, n], i) => { g.fillStyle = c; g.beginPath(); g.arc(24, 30 + i * 22, 5, 0, 7); g.fill(); text(n, 36, 30 + i * 22, 13, '#ddd', 'left', 'normal'); });
    zone(W_ / 2 - 90, H_ - 30, 180, 28, 'Tab'); text(TOUCH.active ? 'TAP to close' : 'TAB to close', W_ / 2, H_ - 16, 13, '#aaa', 'center', 'normal');
  }
  // Where a run went: the big map with every sampled position burned in (tools/playtest/run.js writes it as heatmap.png).
  function heatmap(track) { resize(); g.clearRect(0, 0, W_, H_); drawBigMap(PLAYER.P, (scale) => { g.fillStyle = 'rgba(255,70,30,0.22)'; for (const [x, z] of track) { g.beginPath(); g.arc(x, z, 7 / scale, 0, 7); g.fill(); } g.fillStyle = '#fff'; g.beginPath(); g.arc(track[0][0], track[0][1], 5 / scale, 0, 7); g.fill(); }); text('positions sampled every 0.4 s of wall time; white dot is the start', W_ / 2, H_ - 14, 12, '#ccc', 'center', 'normal'); }
  return { radarLayout, init, draw, loading, notify, money, big: bigText, clearBig, flashStars, fade, buildMap, heatmap, hitMark, zones, shake: (a) => PLAYER.shake(a) };
})();
