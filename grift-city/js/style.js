// GRIFT CITY — style: driving worth watching pays. Drifts, near misses and air are tricks; each one that lands within
// four seconds of the last grows the chain and its multiplier. The chain banks when the streak goes quiet (or you get
// out) and is lost in a real crash, so a long chain is a reason to keep your nerve. While wanted it feeds the Heat Run
// pot instead of your pocket: the show is only paid if you get away.
'use strict';
const STYLE = (() => {
  const WINDOW = 4, NEAR = 1.0, NEAR_SPEED = 11;
  const S = { chain: null, pops: [], near: new Map(), car: null, health: 0, air: 0 };
  const mult = n => Math.min(4, 1 + 0.5 * (n - 1));
  const value = ch => Math.round(ch.pts * mult(ch.tricks.length));
  function pop(text, color) { S.pops.push({ text, color, t: 1.6 }); if (S.pops.length > 3) S.pops.shift(); }
  function trick(name, pts) {
    const ch = S.chain || (S.chain = { tricks: [], pts: 0, t: 0 });
    ch.tricks.push(name); ch.pts += pts; ch.t = WINDOW; ch.lastT = 0.6; // the HUD flashes the newest trick
    const P = PLAYER.P; if (!P.stats.tricks && !S.told && typeof HUD !== 'undefined') { S.told = true; HUD.notify('Style pays: drifts, near misses and air chain up. Crash and the chain is lost.'); }
    if (typeof AUDIO !== 'undefined' && ch.tricks.length > 1) AUDIO.play('pickup');
  }
  function bank() {
    const ch = S.chain; S.chain = null; if (!ch) return; const v = value(ch), P = PLAYER.P;
    P.stats.styleBest = Math.max(P.stats.styleBest || 0, v); P.stats.tricks = (P.stats.tricks || 0) + ch.tricks.length;
    if (P.wanted > 0 && typeof POLICE !== 'undefined') { POLICE.S.pot = (POLICE.S.pot || 0) + v; pop('THE SHOW  +$' + v + '  → HEAT RUN', '#f5c542'); }
    else { PLAYER.addMoney(v, ch.tricks.length > 1 ? ch.tricks.length + '-trick chain' : 'driving style'); pop('BANKED  +$' + v, '#8fe38a'); }
  }
  function lose(why) { if (!S.chain) return; S.chain = null; pop(why, '#ff7a64'); }
  function nearMisses(c, dt) {
    const seen = new Set();
    for (const o of W.cars) {
      if (o === c || o.removed || o.wrecked || o.ai.mode === 'parked' || o.spec.boat || M.dist2(o.x, o.z, c.x, c.z) > 144) continue;
      seen.add(o); const [lf, ll] = c.local(o.x, o.z); const overlap = Math.abs(lf) < (c.spec.len + o.spec.len) / 2;
      const gap = Math.abs(ll) - (c.spec.wid + o.spec.wid) / 2, rel = Math.hypot(c.vx - o.vx, c.vz - o.vz);
      let r = S.near.get(o);
      if (overlap) { if (!r) S.near.set(o, r = { min: gap, rel, since: W.state.elapsed }); r.min = Math.min(r.min, gap); r.rel = Math.max(r.rel, rel); }
      else if (r) { S.near.delete(o); const touched = (o.touchT || -1) >= r.since - 0.2;
        if (!touched && r.min < NEAR && r.min > -0.1 && r.rel > NEAR_SPEED) trick(r.min < 0.4 ? 'PAINT SWAP' : 'NEAR MISS', Math.round(r.rel * (r.min < 0.4 ? 1.6 : 1))); }
    }
    for (const o of S.near.keys()) if (!seen.has(o)) S.near.delete(o);
  }
  function update(dt) {
    for (let i = S.pops.length - 1; i >= 0; i--) if ((S.pops[i].t -= dt) <= 0) S.pops.splice(i, 1);
    const P = PLAYER.P, c = P.car;
    if (!P.alive) { lose('WASTED'); S.car = null; return; }
    if (!c || c.spec.boat) { if (S.chain) bank(); S.car = null; S.near.clear(); return; }
    if (c !== S.car) { S.car = c; S.health = c.health; S.near.clear(); S.air = 0; }
    // a crash is a hit that really hurts the car, not a scrape or a nudge
    if (S.health - c.health > c.maxHealth * 0.05) lose('CRASHED  ·  CHAIN LOST'); S.health = c.health;
    if (c.wrecked) { lose('WRECKED'); return; }
    if (c.lastDrift) { const d = c.lastDrift; c.lastDrift = null; const deg = d.peak * 180 / Math.PI; if (d.t > 0.8 && deg > 15) trick('DRIFT', Math.round(d.t * (8 + deg * 0.4))); }
    if (c.airborne) S.air += dt; else { if (S.air > 0.4 && c.absSpeed > 8) trick(S.air > 0.85 ? 'BIG AIR' : 'AIR', Math.round(S.air * 40)); S.air = 0; }
    if (c.absSpeed > 6) nearMisses(c, dt); else S.near.clear();
    const ch = S.chain; if (ch) { if (c.drift || c.airborne) ch.t = Math.max(ch.t, 1); ch.t -= dt; ch.lastT = Math.max(0, (ch.lastT || 0) - dt); if (ch.t <= 0) bank(); }
  }
  // what the HUD shows: the chain in the air, a live drift, and the last few calls
  const info = () => { const c = PLAYER.P.car, ch = S.chain;
    return { chain: ch && { tricks: ch.tricks, pts: ch.pts, mult: mult(ch.tricks.length), value: value(ch), left: ch.t / WINDOW, flash: ch.lastT || 0 }, drift: c && c.drift && c.drift.t > 0.4 ? c.drift.t : 0, pops: S.pops }; };
  return { S, update, info, trick, bank, lose, WINDOW };
})();
