// GRIFT CITY — the money side: the dealer and mod shop at Voss Motors, properties that pay out, and standing with the families.
const ECON = (() => {
  const S = { bounty: 0, bountyT: 0, crew: null, owned: [], properties: {}, rep: { marla: 0, crane: 0, okafor: 0 }, lastCollect: 0, dealerT: 0 };
  const P = () => PLAYER.P;
  const CARS = [['hatch', 3000], ['sedan', 5000], ['pickup', 6500], ['taxi', 7000], ['van', 8000], ['muscle', 14000], ['sports', 22000], ['police', 30000]];
  const MODS = [
    ['engine', 'Engine tune', [2500, 5000, 9000], (sp, lvl) => { sp.accel *= 1 + 0.12 * lvl; sp.top *= 1 + 0.07 * lvl; }],
    ['tyres', 'Sticky tyres', [1500, 3500], (sp, lvl) => { sp.grip *= 1 + 0.08 * lvl; }],
    ['brakes', 'Race brakes', [1200, 2800], (sp, lvl) => { sp.brake *= 1 + 0.15 * lvl; }],
    ['armor', 'Armour plating', [4000, 9000], (sp, lvl) => { sp.mass *= 1 + 0.08 * lvl; }],
  ];
  const PROPS = [['westfield', 'Westfield bungalow', 12000, 900], ['northgate', 'Northgate bar', 22000, 1800], ['eastside', 'Eastside lock-up', 9000, 700], ['southport', 'Southport warehouse', 30000, 2600]];
  let propSpots = null; let dealerSpot = null;
  function spots() {
    if (propSpots) return; propSpots = [];
    for (const [dist, name, price, income] of PROPS) { const bl = CITY.blocks.find(b => b.kind === dist && !CITY.blocks.some(o => o !== b && o.kind !== dist && Math.abs(o.i - b.i) + Math.abs(o.j - b.j) === 0)); if (!bl) continue; propSpots.push({ id: dist, name, price, income, x: bl.x + 12, z: bl.z - 1.6 }); }
    const g = CITY.place('garage'); dealerSpot = { x: g.x + 10, z: g.z + 3 };
  }
  // ---- mods change a car's own copy of its spec so nothing else on the road is affected
  function applyMods(c) { c.spec = Object.assign({}, VEH.SPECS[c.type]); for (const [key, , , fn] of MODS) { const lvl = (c.mods && c.mods[key]) || 0; if (lvl) fn(c.spec, lvl); } if (c.mods && c.mods.armor) { const k = 1 + 0.35 * c.mods.armor; const hf = c.health / c.maxHealth; c.maxHealth = (c.spec.armor ? 2600 : 1000 * VEH.SPECS[c.type].mass) * k; c.health = c.maxHealth * hf; } }
  function buyCar(type, price) { const p = P(); if (p.money < price) { HUD.notify('Not enough cash.'); AUDIO.play('click'); return; } PLAYER.addMoney(-price, 'Voss Motors'); const g = CITY.place('garage'); const c = VEH.spawn(type, g.x + 14, g.z - 8, Math.PI, { mode: 'parked', color: Math.floor(W.rng() * VEH.PALETTE.length) }); c.playerOwned = true; c.mods = {}; HUD.notify('Your ' + VEH.NAMES[type] + ' is round the side.'); MISSIONS.closeShop(); }
  function storeCar() { const c = P().car; if (!c) return; if (S.owned.length >= 3) { HUD.notify('The garage only holds three cars.'); return; } S.owned.push({ type: c.type, color: c.colIdx, condition:c.saveCondition(), mods: Object.assign({}, c.mods || {}) }); PLAYER.exitCar(); c.removed = true; HUD.notify(VEH.NAMES[c.type] + ' stored at Voss Motors.'); MISSIONS.closeShop(); }
  function takeCar(i) { const o = S.owned[i]; if (!o) return; const g = CITY.place('garage'); const c = VEH.spawn(o.type, g.x + 14, g.z - 8, Math.PI, { mode: 'parked', color: o.color }); c.playerOwned = true; c.mods = o.mods; applyMods(c); c.loadCondition(o.condition); S.owned.splice(i, 1); HUD.notify('Your ' + VEH.NAMES[o.type] + ' is round the side.'); MISSIONS.closeShop(); }
  function discount() { return S.rep.marla >= 3 ? 0.8 : 1; }
  function dealerMenu() {
    const p = P(); const items = [];
    if (p.car) { const c = p.car; items.push({ label: 'Store this ' + VEH.NAMES[c.type] + ' (' + S.owned.length + '/3 slots used)', price: 0, enabled: S.owned.length < 3, action: storeCar });
      for (const [key, name, prices, fn] of MODS) { const lvl = (c.mods && c.mods[key]) || 0; if (lvl >= prices.length) { items.push({ label: name + '  (maxed)', price: 0, enabled: false, action: null }); continue; } const price = Math.round(prices[lvl] * discount()); items.push({ label: name + ' ' + 'I'.repeat(lvl + 1), price, enabled: p.money >= price, action: () => { PLAYER.addMoney(-price, 'Voss Motors'); c.mods = c.mods || {}; c.mods[key] = lvl + 1; c.playerOwned = true; applyMods(c); AUDIO.play('pickup'); MISSIONS.closeShop(); } }); }
      items.push({ label: 'Respray (pick a colour)', price: Math.round(200 * discount()), enabled: p.money >= 200, action: () => { PLAYER.addMoney(-Math.round(200 * discount()), 'Voss Motors'); c.colIdx = (c.colIdx + 1) % VEH.PALETTE.length; c.repair(); MISSIONS.closeShop(); } });
    } else {
      S.owned.forEach((o, i) => items.push({ label: 'Take out your ' + VEH.NAMES[o.type], price: 0, enabled: true, action: () => takeCar(i) }));
      for (const [type, base] of CARS) { const price = Math.round(base * discount()); items.push({ label: 'Buy a ' + VEH.NAMES[type], price, enabled: p.money >= price, action: () => buyCar(type, price) }); }
    }
    return { kind: 'dealer', title: 'VOSS MOTORS', color: '#f5a623', items: items.slice(0, 9), x: dealerSpot.x, z: dealerSpot.z, hint: p.car ? 'Drive in to store or modify; walk in to buy' : (S.rep.marla >= 3 ? "Marla's friends pay 20% less" : 'Walk in to buy, drive in to modify') };
  }
  function propertyMenu(sp) {
    const p = P(); const owned = S.properties[sp.id]; const items = [];
    if (!owned) items.push({ label: 'Buy ' + sp.name + '  (pays $' + sp.income + ' a day)', price: sp.price, enabled: p.money >= sp.price, action: () => { PLAYER.addMoney(-sp.price, sp.name); S.properties[sp.id] = { since: W.state.day || 0, banked: 0 }; HUD.notify('You own the ' + sp.name + '. Come back to collect.'); MISSIONS.closeShop(); } });
    else { const banked = Math.round(owned.banked); items.push({ label: 'Collect $' + banked, price: 0, enabled: banked > 0, action: () => { PLAYER.addMoney(banked, sp.name); owned.banked = 0; MISSIONS.closeShop(); } }); }
    return { kind: 'property', title: sp.name.toUpperCase(), color: '#3df06a', items, x: sp.x, z: sp.z, hint: owned ? 'Income accrues while you play' : '' };
  }
  function update(dt) {
    spots(); const p = P(); if (!p.alive) return; updateBounty(dt, p);
    // income accrues by the game clock: a full game day pays the listed amount
    const perSec = 24 / W.state.dayLength; for (const id in S.properties) { const pr = PROPS.find(x => x[0] === id); if (pr) S.properties[id].banked += pr[3] * dt * perSec / 24; }
    if (S.dealerT > 0) S.dealerT -= dt;
    if (MISSIONS.shop || MISSIONS.S.current || MISSIONS.S.dialogue) return;
    if (M.dist2(p.x, p.z, dealerSpot.x, dealerSpot.z) < (p.car ? 25 : 4) && (!p.car || p.car.absSpeed < 1.5)) { if (S.dealerT <= 0) { MISSIONS.openShop(dealerMenu()); S.dealerT = 2; } } else S.dealerT = 0;
    for (const sp of propSpots) if (!p.car && M.dist2(p.x, p.z, sp.x, sp.z) < 4) MISSIONS.openShop(propertyMenu(sp));
  }
  function markersFX(t) { spots(); if (MISSIONS.S.current) return; W.fx.marker(dealerSpot.x, dealerSpot.z, 2.2, 1.6, [1, 0.65, 0.15], t); for (const sp of propSpots) W.fx.marker(sp.x, sp.z, 1.4, 1.6, S.properties[sp.id] ? [0.2, 0.9, 0.4] : [0.4, 0.9, 0.5], t); }
  function mapIcons() { spots(); return [{ x: dealerSpot.x, z: dealerSpot.z, col: '#f5a623', ch: '$' }].concat(propSpots.map(sp => ({ x: sp.x, z: sp.z, col: S.properties[sp.id] ? '#3df06a' : '#7fbf7f', ch: 'P' }))); }
  // ---- standing with the families: missions move it, and it changes who shoots on sight and what things cost
  function onMissionPassed(m) { if (m.strand === 2) { S.rep.okafor++; S.rep.crane--; } else if (m.strand === 'phone') { S.rep.crane -= 1; } else { S.rep.marla++; if (m.id >= 2) S.rep.crane--; } }
  function craneHostile() { return S.rep.crane <= -3; }
  function saveData() { return { owned: S.owned, properties: S.properties, rep: S.rep, bounty: S.bounty || 0 }; }
  function loadData(d) { if (!d) return; S.owned = d.owned || []; S.properties = d.properties || {}; Object.assign(S.rep, d.rep || {}); S.bounty = d.bounty || 0; }
  // ---- Bounties: five stars once in a day and Crane puts a price on your head. Three crews come for you, one at a
  // time, whenever the police have lost interest; each one you finish drops what Crane paid them.
  function updateBounty(dt, p) {
    const day = Math.floor(W.state.elapsed / W.state.dayLength);
    if (p.wanted >= 5 && !(S.bounty > 0) && S.bountyDay !== day) { S.bounty = 3; S.bountyDay = day; S.bountyT = 45; HUD.notify('Crane has put a price on your head.'); }
    if (!(S.bounty > 0)) return;
    if (S.crew) { const alive = S.crew.peds.filter(q => q.alive && !q.removed); if (!alive.length) { S.bounty--; S.crew = null; S.bountyT = 150; AUDIO.play('missionPass'); HUD.big(S.bounty > 0 ? 'BOUNTY CREW DOWN  ' + S.bounty + ' TO GO' : 'BOUNTY LIFTED', '#f5c542', 2.5); return; }
      if (M.dist(S.crew.car.x, S.crew.car.z, p.x, p.z) > 320) { for (const q of S.crew.peds) q.remove(); S.crew.car.remove(); S.crew = null; S.bountyT = 60; } return; }
    if (p.wanted > 0 || MISSIONS.S.current || MISSIONS.S.dialogue || CITY.interiorRoom) return; S.bountyT -= dt; if (S.bountyT > 0) return;
    // a black Brawler with two of Crane's men, coming in from beyond the edge of the radar
    const a = W.rng() * 6.28; const nl = CITY.nearestLane(p.x + Math.sin(a) * 150, p.z + Math.cos(a) * 150, 1, 0); if (!nl) { S.bountyT = 5; return; }
    const [x, z] = CITY.lanePoint(nl.e, nl.k, 10); const car = VEH.spawn('muscle', x, z, Math.atan2(nl.e.dx, nl.e.dz), { color: 3, mode: 'chase' }); car.important = true; car.ai.target = PLAYER; car.health = 1600; car.maxHealth = 1600;
    const peds = []; for (let i = 0; i < 2; i++) { const q = PEDS.spawn(x, z, { look: PEDS.CRANE, gang: true, hostile: true, weapon: i ? 'uzi' : 'pistol', health: 120, important: true }); q.inCar = car; q.state = 'driving'; q.weaponOut = true; if (i === 0) car.driver = q; else car.passengers.push(q); peds.push(q); }
    for (const q of peds) { const die0 = q.die.bind(q); q.die = (src, how) => { die0(src, how); PICKUPS.dropCash(q.x, q.z, 500); }; }
    S.crew = { car, peds }; S.bountyT = 1e9; HUD.notify("Crane's men have found you."); AUDIO.play('phone');
  }
  return { S, update, markersFX, mapIcons, applyMods, onMissionPassed, craneHostile, discount, saveData, loadData, CARS, MODS, PROPS };
})();
