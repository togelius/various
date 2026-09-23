// GRIFT CITY — the con: a verb that is not a gun. Walk up to a stranger, empty-handed and unhurried, and hold
// TALK (G, the pad's Y, or ACTION on a touchscreen). A meter fills while you keep your mark close; when it is full
// the pitch lands or it does not. The odds are yours to shape: a drawn gun, stars on your head or a cop in sight
// all make people careful, and the night makes them less so. A mark who sees through you shouts, and whoever
// hears calls it in. Nobody falls for the same pitch twice.
'use strict';
const GRIFT = (() => {
  const PITCHES = [
    { name: 'CHARM', open: "Sorry, you look like you know the city. I'm new, my wallet's back at the hotel...", yes: ["Oh, you poor thing. Here.", 'Take it. Pay it forward.'], no: ["Nice try, pal.", 'Get a job.'] },
    { name: 'PRESSURE', open: "City parking. That's your car on the red line? Pay the fine now, or it gets towed.", yes: ['Fine, fine. Just take it.', "Don't tow it, please."], no: ["You're no parking officer.", 'Show me a badge.'] },
    { name: 'STORY', open: "I'm collecting for the harbour widows' fund. Anything helps, really.", yes: ['For the widows. Of course.', 'God bless.'], no: ["There's no such fund.", 'I know every fund in this town.'] },
  ];
  const HOLD = 2.4;
  const S = { mark: null, t: 0, pitch: null, cool: 0, result: null, resultT: 0 };
  const P = () => PLAYER.P;
  const pitchFor = q => PITCHES[Math.abs(Math.floor(Math.sin((q.x | 0) * 12.9898 + (q.z | 0) * 78.233) * 1000)) % PITCHES.length];
  const busy = () => (typeof MISSIONS !== 'undefined' && (MISSIONS.S.current || MISSIONS.S.shop || MISSIONS.S.dialogue)) || false;
  // who is standing close enough to be worked: an ordinary civilian on foot, not already taken in once
  function candidate() {
    const p = P(); if (!p.alive || p.car || busy() || p.speed > 1.2) return null; let best = null, bd = 2.8 * 2.8;
    for (const q of W.peds) { if (!q.alive || q.inCar || q.isCop || q.isGang || q.hostile || q.important || q.role || q.conned || q.state === 'flee' || q.state === 'dead') continue;
      const d = M.dist2(q.x, q.z, p.x, p.z); if (d < bd && Math.abs((q.y || 0) - (p.y || 0)) < 1) { bd = d; best = q; } }
    return best;
  }
  function odds(q) {
    const p = P(); let k = 0.78;
    if (p.weaponOut && p.weapon !== 'fist' && p.weapon !== 'camera') k -= 0.35; // nobody hands money to a man holding a gun
    if (p.wanted > 0) k -= 0.3;
    if (W.peds.some(o => o.isCop && o.alive && M.dist2(o.x, o.z, q.x, q.z) < 25 * 25 && W.los(o.x, o.z, q.x, q.z))) k -= 0.25;
    if (W.isNight()) k += 0.07; if (p.outfit === 1) k += 0.08; // the good suit helps
    return M.clamp(k, 0.05, 0.92);
  }
  const held = () => INPUT.down('KeyG') || (INPUT.pad.active && INPUT.pad.buttons[3]);
  function update(dt) {
    if (S.cool > 0) S.cool -= dt; if (S.resultT > 0) S.resultT -= dt;
    const p = P();
    if (S.mark) {
      const q = S.mark; const far = !q.alive || M.dist2(q.x, q.z, p.x, p.z) > 3.4 * 3.4 || p.car || !p.alive || busy();
      if (far || !held()) { if (S.t > 0.4 && q.alive) q.say?.(far ? 'Where are you going?' : 'Hm. Never mind.'); S.mark = null; S.t = 0; return; }
      S.t += dt; q.faceTarget = p; q.stationary = true; q.gesturePulse = 0.5; q.speed = 0; p.gesturePulse = 0.8;
      if (S.t >= HOLD) finish(q);
      return;
    }
    if (S.cool > 0 || !held()) return;
    const q = candidate(); if (!q) return;
    S.mark = q; S.t = 0; S.pitch = pitchFor(q); S.odds = odds(q); p.angle = Math.atan2(q.x - p.x, q.z - p.z);
    if (typeof HUD !== 'undefined') HUD.notify('"' + S.pitch.open + '"');
  }
  function finish(q) {
    const p = P(); q.conned = true; q.stationary = false; q.faceTarget = null; S.mark = null; S.t = 0; S.cool = 2;
    const wealth = Math.abs(Math.sin(q.x * 3.1 + q.z * 7.7)); const take = Math.round((40 + wealth * 220) / 5) * 5;
    if (W.rng() < S.odds) {
      q.say?.(S.pitch.yes[Math.floor(W.rng() * 2)]); PLAYER.addMoney(take, 'the ' + S.pitch.name.toLowerCase() + ' con');
      p.stats.cons = (p.stats.cons || 0) + 1; p.stats.conCash = (p.stats.conCash || 0) + take; S.result = { ok: true, take }; S.resultT = 2.5;
      if (p.stats.cons === 1 && typeof HUD !== 'undefined') HUD.notify('Your first grift. The city is full of marks.');
    } else {
      q.say?.(S.pitch.no[Math.floor(W.rng() * 2)] + ' Scammer!'); q.scare?.(p.x, p.z);
      if (typeof POLICE !== 'undefined') POLICE.crime('con', p.x, p.z, null); // the mark and anyone nearby can call it in
      S.result = { ok: false }; S.resultT = 2.5;
    }
  }
  // what the HUD and the touch layer need to know
  const info = () => ({ active: !!S.mark, progress: S.mark ? S.t / HOLD : 0, pitch: S.pitch && S.pitch.name, odds: S.odds, result: S.resultT > 0 ? S.result : null, available: !S.mark && S.cool <= 0 && !!candidate() });
  return { S, PITCHES, update, info, candidate, odds, HOLD };
})();
