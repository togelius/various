// SQUARE OFF — the park Director (DESIGN §6, §2.3): telegraphed park events and the neutrals that
// live in the park (ambient pigeon flocks, heist squirrels, PEP officers, tourists, graduates, the piano,
// the Pigeon Lady, the ice cream truck). Headless and deterministic (own RNG stream 'director').
//
// Owns state.events (ParkEvent[]) and the dynamic part of state.neutrals. Applies effects through
// state.zones (SQ.World.addZone), state.weather.rain, state.freezeUntil, landmark.bonusClout and
// match.addClout — the rules code (abilities/combat/movement/economy) does the rest.
//
// Public:
//   SQ.Director.init(match) / SQ.Director.tick(match, dt)          (called by match.js)
//   SQ.Director.trigger(match, kind, {lm, target, warn}) -> event   force an event (campaign / dev tools)
//   SQ.Director.upcoming(match) -> [{kind, at}]                      next scheduled event (HUD / debug)
// Emits: 'eventWarn' / 'eventStart' / 'eventEnd'  {id, kind, name, icon, lm, x, z, text, in, target, until}
//        'announce' {text, kind:'event'} for event flavor lines, 'clout' via match.addClout (heists, tourists).
//
// Neutral kinds written to state.neutrals (all have id, kind, x, z, px, pz; render interpolates px/pz -> x/z):
//   'pigeonFlock' {n, r, alt (0 = on the ground, >0 flying), state 'ground'|'flying', ambient, event?}
//   'pigeonLady'  {event}            'piano' {event, playing, lm}          'truck' {event, lm, dir}
//   'squirrel'    {victim, setup, state 'run'|'steal'|'flee', nut, shooable:true}  (tap -> SQ.cmd.shoo)
//   'pep'         {event, dir}       'tourist' {event, dir, variant}      'graduate' {event, dir, variant}
(function (SQ) {
  'use strict';
  const UF = SQ.C.UF;
  const near = [];
  const dirs = new WeakMap();

  // Ambient flock spots: paved plazas where pigeons actually hang out.
  const FLOCK_SPOTS = [
    { x: 4, z: -22 }, { x: -22, z: 8 }, { x: 24, z: 12 }, { x: -6, z: 26 }, { x: -118, z: 34 },
    { x: 40, z: -8 }, { x: -60, z: -24 }, { x: 88, z: 40 }, { x: -96, z: -40 }, { x: 10, z: -60 },
  ];

  function geo(match) {
    return (match.cfg && match.cfg.geo) || (typeof window !== 'undefined' && window.GEO) || null;
  }
  function d2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }

  // ------------------------------------------------------------------ init
  function init(match) {
    const st = match.state;
    const R = match.rules;
    const P = SQ.data.eventPacing;
    const mods = (R.modifiers && R.modifiers.director) || (st.mods && st.mods.director) || null;
    const d = {
      rng: SQ.util.rngStream(match.seed, 'director'),
      mode: R.events || 'normal',
      seq: 0, nseq: 0,
      nextAt: P.first,
      only: mods && mods.only ? mods.only.slice() : (R.modifiers && R.modifiers.pianos ? ['piano'] : null),
      rate: (mods && mods.rate) || (R.modifiers && R.modifiers.pianos ? 2 : 1),
      scripted: [],
      runtime: {},  // per-event live data, keyed by event id (zones, actors)
      flocks: [],
      lastKind: null,
    };
    if (d.mode === 'calm') d.nextAt = Math.max(P.first, 100);
    if (d.mode === 'chaos') d.nextAt = 60;
    if (match.mission && Array.isArray(match.mission.scripted)) {
      d.scripted = match.mission.scripted.map((s) => Object.assign({}, s)).sort((a, b) => a.at - b.at);
    }
    // ambient pigeon flocks (~30 birds each) on a few plazas
    const spots = FLOCK_SPOTS.slice();
    d.rng.shuffle(spots);
    const nFlocks = 5;
    for (let k = 0; k < nFlocks; k++) {
      const s = spots[k];
      const n = { id: 'flock' + k, kind: 'pigeonFlock', x: s.x, z: s.z, px: s.x, pz: s.z, n: 26 + d.rng.int(10), r: 4, alt: 0,
        state: 'ground', ambient: true, tx: s.x, tz: s.z, landT: 0, home: k };
      st.neutrals.push(n);
      d.flocks.push(n);
    }
    dirs.set(match, d);
  }

  // ------------------------------------------------------------------ tick
  function tick(match, dt) {
    const d = dirs.get(match);
    if (!d) return;
    const st = match.state;
    for (const n of st.neutrals) { if (!n.static) { n.px = n.x; n.pz = n.z; } }
    flocksTick(match, d, dt);
    schedule(match, d);
    for (const e of st.events) {
      if (e.state === 'done') continue;
      if (e.state === 'warn') {
        warnTick(match, d, e, dt);
        if (st.t >= e.startAt) startEvent(match, d, e);
      } else if (e.state === 'active') {
        activeTick(match, d, e, dt);
        if (st.t >= e.endAt || e.finished) endEvent(match, d, e);
      }
    }
  }

  // ------------------------------------------------------------------ scheduling
  function schedule(match, d) {
    const st = match.state;
    const P = SQ.data.eventPacing;
    // scripted (campaign) events: start exactly at `at`, warned ahead
    while (d.scripted.length) {
      const s = d.scripted[0];
      const warn = (SQ.data.events[s.event] && SQ.data.events[s.event].warn) || P.warn;
      if (st.t < s.at - warn) break;
      d.scripted.shift();
      createEvent(match, d, s.event, { lm: s.lm, startAt: Math.max(st.t, s.at) });
    }
    if (d.mode === 'off' || d.mode === 'scripted') return;
    const active = st.events.some((e) => e.state !== 'done' && e.kind !== 'bells');
    if (st.t + P.warn < d.nextAt) return;
    if (active) { d.nextAt = st.t + P.warn + 5; return; }
    if (st.clock >= st.length - 15 && st.length <= 600) return; // nothing new right before closing
    const kind = pickKind(match, d);
    if (kind) createEvent(match, d, kind, { startAt: d.nextAt });
    const range = P[d.mode] || P.normal;
    d.nextAt = d.nextAt + (range[0] + d.rng() * (range[1] - range[0])) / d.rate;
  }

  function pickKind(match, d) {
    const st = match.state;
    const E = SQ.data.events;
    let pool = (d.only || SQ.data.eventOrder).filter((k) => E[k] && !E[k].campaignOnly);
    const hasCarts = st.setups.some((s) => s.kind === 'cart' && s.done);
    pool = pool.filter((k) => !(E[k].needsCarts && !hasCarts));
    if (pool.length > 1 && d.lastKind) pool = pool.filter((k) => k !== d.lastKind);
    if (!pool.length) return null;
    let tot = 0;
    for (const k of pool) tot += E[k].weight || 1;
    let r = d.rng() * tot;
    for (const k of pool) { r -= E[k].weight || 1; if (r <= 0) return k; }
    return pool[pool.length - 1];
  }

  /** Target faction: the leader 60% of the time, never one more than 300 Turf behind. */
  function pickTarget(match, d) {
    const st = match.state;
    const P = SQ.data.eventPacing;
    const alive = st.factions.filter((f) => !f.eliminated && f.key !== 'squirrels');
    if (!alive.length) return -1;
    let leader = alive[0];
    for (const f of alive) if (f.turf > leader.turf) leader = f;
    const ok = alive.filter((f) => leader.turf - f.turf <= P.skipBehind);
    if (d.rng() < P.leaderBias || ok.length <= 1) return leader.idx;
    return ok[d.rng.int(ok.length)].idx;
  }

  function lmValue(L) { return (L.turf || 0) * 3 + (L.clout || 0) * 2; }

  /** A landmark that matters to faction f (weighted by value), else the Fountain, else any. */
  function pickLandmark(match, d, f, filter) {
    const st = match.state;
    const ok = (L) => !L.isHome && (!filter || filter(L));
    const owned = st.landmarks.filter((L) => ok(L) && L.owner === f);
    const list = owned.length ? owned : st.landmarks.filter(ok);
    if (!list.length) return null;
    let tot = 0;
    for (const L of list) tot += lmValue(L) + 1;
    let r = d.rng() * tot;
    for (const L of list) { r -= lmValue(L) + 1; if (r <= 0) return L; }
    return list[0];
  }

  // ------------------------------------------------------------------ lifecycle
  function createEvent(match, d, kind, opts) {
    const st = match.state;
    const E = SQ.data.events[kind];
    if (!E) return null;
    opts = opts || {};
    const P = SQ.data.eventPacing;
    const warn = opts.warn !== undefined ? opts.warn : (E.warn || P.warn);
    const startAt = opts.startAt !== undefined ? Math.max(st.t, opts.startAt) : st.t + warn;
    const target = opts.target !== undefined ? opts.target : pickTarget(match, d);
    const e = {
      id: 'ev' + (++d.seq), kind, name: E.name, icon: E.icon, lm: null, x: 0, z: 0, target,
      warnAt: st.t, startAt, endAt: startAt + E.duration, state: 'warn', text: '', startText: '',
    };
    const L = placeEvent(match, d, e, E, opts.lm);
    e.lm = L ? L.id : (opts.lm || null);
    const place = L ? L.name : e.placeName || 'the park';
    e.placeName = e.placeName || place;
    e.text = SQ.data.text.fill(E.toast || E.name, { PLACE: e.placeName });
    e.startText = SQ.data.text.fill(E.start || E.name, { PLACE: e.placeName });
    st.events.push(e);
    d.lastKind = kind;
    match.emit('eventWarn', { id: e.id, kind, name: e.name, icon: e.icon, lm: e.lm, x: e.x, z: e.z, text: e.text, in: Math.max(0, startAt - st.t), target });
    return e;
  }

  /** Decide where an event happens; sets e.x/e.z and prepares runtime actors. Returns its landmark. */
  function placeEvent(match, d, e, E, lmId) {
    const st = match.state;
    const rt = d.runtime[e.id] = { actors: [], zones: [] };
    const forced = lmId ? st.lmById[lmId] : null;
    let L = forced || null;
    switch (e.kind) {
      case 'piano': {
        const spots = E.spots.filter((s) => st.lmById[s.lm]);
        let spot = null;
        if (forced && !spots.some((s) => s.lm === forced.id)) spot = { x: forced.x, z: forced.z + Math.min(10, forced.r * 0.6), lm: forced.id, name: forced.name };
        else if (forced) spot = spots.find((s) => s.lm === forced.id);
        else if (spots.length) {
          const mine = spots.filter((s) => st.lmById[s.lm].owner === e.target);
          spot = (mine.length ? mine : spots)[d.rng.int((mine.length ? mine : spots).length)];
        } else {
          const A = pickLandmark(match, d, e.target);
          if (A) spot = { x: A.x, z: A.z + A.r * 0.5, lm: A.id, name: A.name };
        }
        if (!spot) spot = { x: 0, z: 18, lm: 'fountain', name: 'the Fountain' };
        L = st.lmById[spot.lm] || null;
        e.x = spot.x; e.z = spot.z; e.placeName = spot.name;
        // the piano rolls in from the nearest street during the warning
        const sz = spot.z > 0 ? 80 : -80;
        const p = actor(match, d, e, 'piano', spot.x, sz, { playing: false, lm: spot.lm });
        rt.piano = p; rt.from = { x: spot.x, z: sz };
        break;
      }
      case 'pigeonLady': {
        L = L || pickLandmark(match, d, e.target);
        const b = nearestBench(match, L ? L.x : 0, L ? L.z : 0, 26) || { x: L ? L.x + 6 : 6, z: L ? L.z + 6 : 6 };
        e.x = b.x; e.z = b.z;
        rt.lady = actor(match, d, e, 'pigeonLady', b.x + 30, b.z + 40, {});
        rt.from = { x: b.x + 30, z: b.z + 40 };
        break;
      }
      case 'squirrelHeist': {
        const carts = st.setups.filter((s) => s.kind === 'cart' && s.done && s.owner >= 0);
        if (carts.length) {
          const victim = st.factions[e.target];
          carts.sort((a, b) => (st.factions[b.owner].clout - st.factions[a.owner].clout) || (a.owner === e.target ? -1 : 0) || a.id - b.id);
          void victim;
          rt.carts = carts.slice(0, 3);
          e.x = rt.carts[0].x; e.z = rt.carts[0].z;
          L = st.landmarks[rt.carts[0].lm] || L;
        } else {
          // no carts: the gang raids the snack stash at a landmark (smaller take) - the target's own
          // landmark, else the target's Home Spot (never the squirrels' own turf)
          const tf = st.factions[e.target];
          const theirs = tf ? st.landmarks.filter((X) => !X.isHome && X.owner === e.target) : [];
          if (!L) L = theirs.length ? pickLandmark(match, d, e.target, (X) => X.owner === e.target) : (tf && st.lmById[tf.home]) || pickLandmark(match, d, e.target, (X) => X.owner >= 0);
          const owner = L && L.isHome ? e.target : (L ? L.owner : -1);
          rt.carts = L ? [{ id: -1, x: L.x, z: L.z, owner, lm: L.idx, stash: true }] : [];
          if (L) { e.x = L.x; e.z = L.z; }
        }
        break;
      }
      case 'pep': {
        // follow the leader: their best landmark (or the Fountain)
        L = L || pickLandmark(match, d, e.target) || st.lmById.fountain;
        const loop = pathNear(match, L ? L.x : 0, L ? L.z : 0);
        rt.loop = loop;
        e.x = loop.pts[loop.k][0]; e.z = loop.pts[loop.k][1];
        break;
      }
      case 'tourists':
      case 'graduation': {
        L = st.lmById.arch || st.lmById.fountain || null;
        e.x = 0; e.z = -50; e.placeName = 'Washington Sq N';
        break;
      }
      case 'shower': {
        e.x = 0; e.z = 0; e.placeName = 'the Village';
        break;
      }
      case 'iceCream': {
        const south = (X) => X.z > 20;
        L = L || pickLandmark(match, d, e.target, south) || pickLandmark(match, d, e.target);
        const tx = SQ.util.clamp(L ? L.x : 0, -140, 118);
        e.x = tx; e.z = E.street ? E.street.z : 76;
        const fromX = tx < 0 ? -230 : 230;
        rt.truck = actor(match, d, e, 'truck', fromX, e.z, { lm: L ? L.id : null, dir: fromX < 0 ? Math.PI / 2 : -Math.PI / 2 });
        rt.from = { x: fromX, z: e.z };
        break;
      }
      case 'bells': {
        L = st.lmById.judson || null;
        e.x = -32; e.z = 92; e.placeName = 'Judson Memorial Church';
        break;
      }
      default: {
        L = L || pickLandmark(match, d, e.target);
        if (L) { e.x = L.x; e.z = L.z; }
      }
    }
    return L;
  }

  function actor(match, d, e, kind, x, z, extra) {
    const st = match.state;
    const n = Object.assign({ id: kind + (++d.nseq), kind, x, z, px: x, pz: z, event: e.id, dir: 0 }, extra || {});
    st.neutrals.push(n);
    d.runtime[e.id].actors.push(n);
    return n;
  }

  function startEvent(match, d, e) {
    const st = match.state;
    const E = SQ.data.events[e.kind];
    const rt = d.runtime[e.id];
    e.state = 'active';
    e.startAt = st.t;
    e.endAt = st.t + E.duration;
    const L = e.lm ? st.lmById[e.lm] : null;
    switch (e.kind) {
      case 'piano': {
        rt.piano.x = e.x; rt.piano.z = e.z; rt.piano.playing = true;
        rt.zones.push(SQ.World.addZone(st, Object.assign({ kind: 'piano', x: e.x, z: e.z, until: e.endAt, faction: -1 }, E.zone, { r: E.zone.r })));
        break;
      }
      case 'pigeonLady': {
        rt.lady.x = e.x; rt.lady.z = e.z;
        rt.flock = actor(match, d, e, 'pigeonFlock', e.x, e.z, { n: E.pigeons, r: E.zone.r, alt: 0, state: 'ground', ambient: false });
        rt.zone = SQ.World.addZone(st, Object.assign({ kind: 'pigeons', x: e.x, z: e.z, until: e.endAt + 1, faction: -1 }, E.zone));
        rt.zones.push(rt.zone);
        rt.left = E.duration;
        break;
      }
      case 'squirrelHeist': {
        const n = E.squirrels[0] + d.rng.int(E.squirrels[1] - E.squirrels[0] + 1);
        rt.squirrels = [];
        for (let k = 0; k < n && rt.carts.length; k++) {
          const c = rt.carts[k % rt.carts.length];
          const tr = nearestTree(match, c.x, c.z, 12, 45, d.rng) || { x: c.x + 25 * Math.cos(k * 2.1), z: c.z + 25 * Math.sin(k * 2.1) };
          const s = actor(match, d, e, 'squirrel', tr.x, tr.z, {
            victim: c.owner, setup: c.id, tx: c.x + (d.rng() - 0.5) * 2, tz: c.z + (d.rng() - 0.5) * 2, hx: tr.x, hz: tr.z,
            state: 'run', t: 0, nut: false, shooable: true, delay: k * 0.6, stash: !!c.stash,
          });
          rt.squirrels.push(s);
        }
        if (!rt.squirrels.length) e.finished = true;
        break;
      }
      case 'pep': {
        rt.officers = [];
        for (let k = 0; k < (E.officers || 2); k++) {
          const p = pointOnLoop(rt.loop, rt.loop.s - k * 4);
          const o = actor(match, d, e, 'pep', p.x, p.z, { dir: 0 });
          o.s = rt.loop.s - k * 4;
          o.zone = SQ.World.addZone(st, { kind: 'pep', x: p.x, z: p.z, r: E.zone.r, until: e.endAt + 0.5, faction: -1, who: 'all', noAttack: true });
          rt.zones.push(o.zone);
          rt.officers.push(o);
        }
        break;
      }
      case 'tourists':
      case 'graduation': {
        const n = E.count;
        rt.walkers = [];
        const kind = e.kind === 'tourists' ? 'tourist' : 'graduate';
        for (let k = 0; k < n; k++) {
          const jx = (d.rng() - 0.5) * (e.kind === 'graduation' ? 9 : 7);
          const z0 = E.from.z - d.rng() * (e.kind === 'graduation' ? 30 : 10);
          const w = actor(match, d, e, kind, E.from.x + jx, z0, {
            variant: d.rng.int(6), jx, stage: 0, speed: 1.9 + d.rng() * 0.5, paid: false,
            mx: Math.cos(k * 2.399) * (10 + (k % 5) * 1.6), mz: Math.sin(k * 2.399) * (10 + (k % 5) * 1.6),
          });
          rt.walkers.push(w);
        }
        // one slow zone per bunch of walkers (they slow pathing)
        const per = e.kind === 'graduation' ? 10 : 5;
        rt.groups = [];
        for (let k = 0; k < n; k += per) {
          const z = SQ.World.addZone(st, Object.assign({ kind: kind + 's', x: E.from.x, z: E.from.z, until: e.endAt + 0.5, faction: -1 }, E.zone));
          rt.zones.push(z);
          rt.groups.push({ zone: z, from: k, to: Math.min(n, k + per) });
        }
        if (e.kind === 'graduation') {
          rt.zones.push(SQ.World.addZone(st, { kind: 'graduationSpeed', x: 0, z: 0, r: 600, until: e.endAt, faction: -1, who: 'all', factionKey: 'violets', speed: E.violetsSpeed || 1.2 }));
        }
        break;
      }
      case 'shower': {
        st.weather.rain = true;
        st.weather.until = e.endAt;
        break;
      }
      case 'iceCream': {
        rt.truck.x = e.x; rt.truck.z = e.z;
        if (L) { L.bonusClout = (L.bonusClout || 0) + E.bonusClout; rt.bonusLm = L; }
        break;
      }
      case 'bells': {
        st.freezeUntil = Math.max(st.freezeUntil || 0, st.t + (E.pause || 1));
        break;
      }
      default: break;
    }
    match.emit('eventStart', { id: e.id, kind: e.kind, name: e.name, icon: e.icon, lm: e.lm, x: e.x, z: e.z, text: e.startText, until: e.endAt, target: e.target });
  }

  function endEvent(match, d, e) {
    const st = match.state;
    const rt = d.runtime[e.id] || { actors: [], zones: [] };
    e.state = 'done';
    e.endAt = Math.min(e.endAt, st.t);
    for (const z of rt.zones) SQ.World.removeZone(st, z.id);
    switch (e.kind) {
      case 'shower': st.weather.rain = false; break;
      case 'iceCream': if (rt.bonusLm) rt.bonusLm.bonusClout = Math.max(0, (rt.bonusLm.bonusClout || 0) - SQ.data.events.iceCream.bonusClout); break;
      default: break;
    }
    // walkers, officers, the piano etc. leave; squirrels still running keep fleeing on their own
    for (const a of rt.actors) {
      if (a.kind === 'squirrel' && !a.dead) { a.state = 'flee'; a.leaving = true; d.leftovers = d.leftovers || []; d.leftovers.push(a); continue; }
      if (a.kind === 'pigeonFlock' && !a.dead) { a.state = 'flying'; a.leaving = true; d.leftovers = d.leftovers || []; d.leftovers.push(a); continue; }
      a.dead = true;
    }
    match.emit('eventEnd', { id: e.id, kind: e.kind, name: e.name, lm: e.lm, x: e.x, z: e.z });
    delete d.runtime[e.id];
  }

  // ------------------------------------------------------------------ per-event updates
  function warnTick(match, d, e, dt) {
    const st = match.state;
    const rt = d.runtime[e.id];
    if (!rt) return;
    const span = Math.max(0.5, e.startAt - e.warnAt);
    const f = SQ.util.clamp((st.t - e.warnAt) / span, 0, 1);
    const ease = f * f * (3 - 2 * f);
    const mover = rt.piano || rt.truck || rt.lady;
    if (mover && rt.from) {
      mover.x = rt.from.x + (e.x - rt.from.x) * ease;
      mover.z = rt.from.z + (e.z - rt.from.z) * ease;
      if (mover.x !== mover.px || mover.z !== mover.pz) mover.dir = Math.atan2(mover.x - mover.px, mover.z - mover.pz);
    }
    void dt;
  }

  function activeTick(match, d, e, dt) {
    const st = match.state, u = st.units;
    const rt = d.runtime[e.id];
    if (!rt) return;
    const E = SQ.data.events[e.kind];
    switch (e.kind) {
      case 'pigeonLady': {
        // Pack units (Animals) in the cloud scatter it twice as fast
        SQ.World.query(st, e.x, e.z, E.zone.r, near);
        let animals = 0;
        for (const i of near) if ((u.flags[i] & UF.ANIMAL) && !(u.flags[i] & UF.OVERIT)) animals++;
        rt.left -= dt * (animals ? (E.zone.animalScatter || 2) : 1);
        const frac = Math.max(0, rt.left / E.duration);
        rt.flock.n = Math.round(E.pigeons * (0.25 + 0.75 * frac));
        rt.flock.alt = animals ? 1.5 : 0;
        rt.flock.state = animals ? 'flying' : 'ground';
        if (rt.left <= 0) e.finished = true;
        break;
      }
      case 'squirrelHeist': {
        let alive = 0;
        for (const s of rt.squirrels) { if (!s.dead) { squirrelTick(match, d, e, s, dt); if (!s.dead) alive++; } }
        if (!alive) e.finished = true;
        break;
      }
      case 'pep': {
        for (const o of rt.officers) {
          o.s += 1.4 * dt; // pointOnLoop ping-pongs along open paths
          const p = pointOnLoop(rt.loop, o.s);
          o.dir = Math.atan2(p.x - o.x, p.z - o.z);
          o.x = p.x; o.z = p.z;
          o.zone.x = p.x; o.zone.z = p.z;
        }
        e.x = rt.officers[0].x; e.z = rt.officers[0].z;
        break;
      }
      case 'tourists':
      case 'graduation': walkersTick(match, d, e, rt, E, dt); break;
      default: break;
    }
  }

  function squirrelTick(match, d, e, s, dt) {
    const st = match.state, u = st.units;
    const E = SQ.data.events.squirrelHeist;
    s.t += dt;
    if (s.t < s.delay) return;
    const speed = s.state === 'flee' ? 7.5 : 6;
    // scared off by the victim guarding the cart, or by any Pack Animal nearby
    if (s.state === 'run' || s.state === 'steal') {
      SQ.World.query(st, s.state === 'steal' ? s.tx : s.x, s.state === 'steal' ? s.tz : s.z, 10, near);
      for (const i of near) {
        if (u.flags[i] & UF.OVERIT) continue;
        const dd = d2(u.x[i], u.z[i], s.tx, s.tz);
        const guard = u.faction[i] === s.victim && dd <= 64;
        const dog = (u.flags[i] & UF.ANIMAL) && st.factions[u.faction[i]].key !== 'squirrels' && d2(u.x[i], u.z[i], s.x, s.z) <= 100;
        if (guard || dog) {
          s.state = 'flee'; s.scared = true;
          // whoever chased it off gets the shoo (counts for "Shoo 3 squirrels"), once
          const f = u.faction[i];
          if (!s.shooed && st.factions[f] && st.factions[f].key !== 'squirrels') {
            s.shooed = true;
            const amt = E.shoo || 5;
            match.addClout(f, amt, 'shoo', s.x, s.z);
            st.factions[f].stats.shooed = (st.factions[f].stats.shooed || 0) + 1;
            match.emit('shoo', { faction: f, id: s.id, x: s.x, z: s.z, amount: amt, by: u.id[i] });
          }
          break;
        }
      }
    }
    if (s.state === 'run') {
      if (moveTo(s, s.tx, s.tz, speed * dt)) { s.state = 'steal'; s.stealT = 0; }
    } else if (s.state === 'steal') {
      s.stealT += dt;
      if (s.stealT >= 2.5) {
        const victim = st.factions[s.victim];
        if (victim) {
          const take = s.stash ? Math.round(E.heist / 2) : E.heist;
          match.addClout(s.victim, -take, 'heist', s.x, s.z);
          victim.stats.heists = (victim.stats.heists || 0) + 1;
        }
        s.nut = true;
        s.state = 'flee';
      }
    } else if (s.state === 'flee') {
      if (moveTo(s, s.hx, s.hz, speed * dt)) s.dead = true;
    }
  }

  function moveTo(n, x, z, step) {
    const dx = x - n.x, dz = z - n.z;
    const L = Math.hypot(dx, dz);
    if (L <= step || L < 0.05) { n.x = x; n.z = z; return true; }
    n.x += dx / L * step; n.z += dz / L * step;
    n.dir = Math.atan2(dx, dz);
    return false;
  }

  /** Tourists / graduates: Fifth Ave -> through the Arch -> mill around the Fountain. */
  function walkersTick(match, d, e, rt, E, dt) {
    const st = match.state;
    const arch = st.lmById.arch;
    for (const w of rt.walkers) {
      const sp = w.speed * dt;
      if (w.stage === 0) { if (moveTo(w, w.jx * 0.35, -56, sp)) w.stage = 1; }          // into the Arch opening
      else if (w.stage === 1) { if (moveTo(w, w.jx * 0.6, -47, sp)) w.stage = 2; }      // out onto Arch Plaza
      else if (w.stage === 2) { if (moveTo(w, w.mx * 0.4 + w.jx, E.to.z - 4 + w.mz * 0.2, sp)) w.stage = 3; }
      else if (w.stage === 3) { if (moveTo(w, w.mx, w.mz, sp * 0.5)) w.stage = 4; }       // around the fountain rim
      else { w.idle = true; }
      // tourists pay the Arch holder as they pass through the plaza
      if (e.kind === 'tourists' && !w.paid && w.z > -42 && arch) {
        w.paid = true;
        if (arch.owner >= 0) match.addClout(arch.owner, E.perTourist || 1, 'tourist', w.x, w.z);
      }
    }
    for (const g of rt.groups) {
      let cx = 0, cz = 0, n = 0;
      for (let k = g.from; k < g.to; k++) { cx += rt.walkers[k].x; cz += rt.walkers[k].z; n++; }
      if (n) { g.zone.x = cx / n; g.zone.z = cz / n; }
    }
  }

  // ------------------------------------------------------------------ ambient flocks
  function flocksTick(match, d, dt) {
    const st = match.state, u = st.units;
    for (const f of d.flocks) {
      if (f.state === 'ground') {
        if (st.tick % 5 !== (f.home % 5)) continue;
        SQ.World.query(st, f.x, f.z, 12, near);
        let scare = false;
        for (const i of near) {
          if (u.flags[i] & UF.OVERIT) continue;
          const dd = d2(u.x[i], u.z[i], f.x, f.z);
          if (dd < 36 || ((u.flags[i] & UF.ANIMAL) && dd < 144)) { scare = true; break; }
        }
        if (scare) {
          const spots = FLOCK_SPOTS.filter((s) => d2(s.x, s.z, f.x, f.z) > 400);
          const s = spots[d.rng.int(spots.length)];
          f.state = 'flying'; f.tx = s.x; f.tz = s.z; f.alt = 0.5;
        }
      } else {
        const done = moveTo(f, f.tx, f.tz, 11 * dt);
        f.alt = done ? Math.max(0, f.alt - dt * 4) : Math.min(8, f.alt + dt * 6);
        if (done && f.alt <= 0) { f.state = 'ground'; f.alt = 0; }
      }
    }
    if (d.leftovers && d.leftovers.length) {
      for (const a of d.leftovers) {
        if (a.dead) continue;
        if (a.kind === 'squirrel') { if (moveTo(a, a.hx, a.hz, 7.5 * dt)) a.dead = true; }
        else { a.alt = Math.min(20, (a.alt || 0) + dt * 6); a.n = Math.max(0, a.n - Math.ceil(dt * 60)); if (a.n <= 0) a.dead = true; }
      }
      d.leftovers = d.leftovers.filter((a) => !a.dead);
    }
  }

  // ------------------------------------------------------------------ GEO helpers
  function nearestBench(match, x, z, maxR) {
    const G = geo(match);
    if (!G || !G.benches) return null;
    let best = null, bd = maxR * maxR;
    for (const b of G.benches) {
      const dd = d2(b[0], b[1], x, z);
      if (dd < bd && dd > 16) { bd = dd; best = { x: b[0], z: b[1] }; }
    }
    return best;
  }

  function nearestTree(match, x, z, minR, maxR, rng) {
    const G = geo(match);
    if (!G || !G.trees) return null;
    const cands = [];
    for (const t of G.trees) {
      const dd = d2(t[0], t[1], x, z);
      if (dd >= minR * minR && dd <= maxR * maxR) cands.push(t);
    }
    if (!cands.length) return null;
    const t = cands[rng.int(cands.length)];
    return { x: t[0], z: t[1] };
  }

  /** A real footpath near (x,z) for the PEP loop: {pts, len, s, closed}. */
  function pathNear(match, x, z) {
    const G = geo(match);
    let best = null, bd = Infinity, bk = 0;
    if (G && G.paths) {
      for (const p of G.paths) {
        if (p.area || !p.pts || p.pts.length < 2) continue;
        if (p.kind && !/foot|path|pedestrian/.test(p.kind)) continue;
        let len = 0;
        for (let k = 1; k < p.pts.length; k++) len += Math.hypot(p.pts[k][0] - p.pts[k - 1][0], p.pts[k][1] - p.pts[k - 1][1]);
        if (len < 30) continue;
        for (let k = 0; k < p.pts.length; k++) {
          const dd = d2(p.pts[k][0], p.pts[k][1], x, z);
          if (dd < bd) { bd = dd; best = p; bk = k; }
        }
      }
    }
    if (!best || bd > 45 * 45) {
      // fallback: a small square loop around the point
      const pts = [[x - 12, z - 12], [x + 12, z - 12], [x + 12, z + 12], [x - 12, z + 12], [x - 12, z - 12]];
      return finishLoop({ pts, k: 0 }, true);
    }
    return finishLoop({ pts: best.pts.map((q) => [q[0], q[1]]), k: bk }, false);
  }
  function finishLoop(loop, closed) {
    const cum = [0];
    for (let k = 1; k < loop.pts.length; k++) cum.push(cum[k - 1] + Math.hypot(loop.pts[k][0] - loop.pts[k - 1][0], loop.pts[k][1] - loop.pts[k - 1][1]));
    loop.cum = cum; loop.len = cum[cum.length - 1]; loop.closed = closed; loop.dirn = 1;
    loop.s = SQ.util.clamp(cum[loop.k], 5, Math.max(5, loop.len - 5));
    // keep the officers on a stretch of at most ~70 m around the landmark
    loop.lo = Math.max(0, loop.s - 35); loop.hi = Math.min(loop.len, loop.s + 35);
    return loop;
  }
  function pointOnLoop(loop, s) {
    const lo = loop.closed ? 0 : loop.lo, hi = loop.closed ? loop.len : loop.hi;
    const span = Math.max(1, hi - lo);
    let q;
    if (loop.closed) { q = ((s % span) + span) % span; }
    else {
      // ping-pong inside [lo, hi]
      let r = ((s - lo) % (2 * span) + 2 * span) % (2 * span);
      q = lo + (r <= span ? r : 2 * span - r);
    }
    const c = loop.cum;
    let k = 1;
    while (k < c.length - 1 && c[k] < q) k++;
    const a = loop.pts[k - 1], b = loop.pts[k];
    const seg = c[k] - c[k - 1] || 1;
    const f = SQ.util.clamp((q - c[k - 1]) / seg, 0, 1);
    return { x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f };
  }

  // ------------------------------------------------------------------ public helpers
  /** Force an event (campaign beats, dev tools). opts: {lm, target, warn (s, default per event), startAt}. */
  function trigger(match, kind, opts) {
    const d = dirs.get(match);
    if (!d) return null;
    opts = opts || {};
    const E = SQ.data.events[kind];
    if (!E) return null;
    const warn = opts.warn !== undefined ? opts.warn : (E.warn || SQ.data.eventPacing.warn);
    return createEvent(match, d, kind, { lm: opts.lm, target: opts.target, startAt: match.state.t + warn });
  }

  function upcoming(match) {
    const d = dirs.get(match);
    if (!d) return [];
    const out = d.scripted.map((s) => ({ kind: s.event, at: s.at }));
    if (d.mode !== 'off' && d.mode !== 'scripted') out.push({ kind: null, at: d.nextAt });
    return out;
  }

  SQ.Director = { init, tick, trigger, upcoming, FLOCK_SPOTS };
})(window.SQ = window.SQ || {});
