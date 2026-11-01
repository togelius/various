#!/usr/bin/env node
'use strict';
// SQUARE OFF — "Hang Out" lab: the headless experiments behind DESIGN-V2.md.
//
//   node tools/hangout-lab.js travel                 measured walking times (s): entrances -> spots, spot -> spot
//   node tools/hangout-lab.js ladder [--n 40]        newbie / easy / normal / hard round robin, sides swapped
//   node tools/hangout-lab.js batch --a hard --b hard --n 60     one pairing (a, b: newbie|static|easy|normal|hard)
//   node tools/hangout-lab.js incumbent              the incumbent-dominance test (DESIGN-RECOMMENDATIONS.md):
//                                                    scripted challenger plans x leader responses, both sides
//   node tools/hangout-lab.js checks [--n 40]        coffee / concentration / spreading / withdrawal / static-split checks
//   node tools/hangout-lab.js all                    everything above (the tables in DESIGN-V2.md)
//
// Options: --rules k=v,k=v   override SQ.data.hangout.rules (e.g. --rules drainPerRival=8,breakTime=12)
//          --layout id       a layout from SQ.data.hangout.layouts (default park)
//          --n N --seed S --workers W --json --quiet
const path = require('node:path');
const os = require('node:os');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');

const ROOT = path.resolve(__dirname, '..');
const load = require(path.join(ROOT, 'test', 'load.js'));
function getSQ() { return load({ plugins: false }); }

// ------------------------------------------------------------------ small helpers
const spotIdx = (st, id) => st.spots.findIndex((s) => s.id === id);
const present = (st, si, k) => st.groups.filter((g) => g.at === si && (k === undefined || g.side === k)).length;
const rivalsAt = (st, si, k) => st.groups.filter((g) => g.at === si && g.side !== k).length;
function every(dt, fn) { let next = 0; return (m, k) => { if (m.state.t + 1e-9 < next) return; next = m.state.t + dt; fn(m, k); }; }
function round(x, d) { const p = Math.pow(10, d || 0); return Math.round(x * p) / p; }

// ------------------------------------------------------------------ bots (play through match.order only)
/**
 * A newcomer who only reacts: every ~2.5 s it sends idle groups to the nearest empty spot (else the nearest
 * rival spot) and, when one of its spots is being argued over, sends an idle group to help. Never walks away.
 */
function newbieBot(opts) {
  opts = opts || {};
  return every(opts.think || 2.5, (m, k) => {
    const st = m.state;
    const target = (g) => (g.coffee ? (g.pending ? g.pending.spot : g.lastSpot) : g.spot);
    const targeted = new Set(st.groups.filter((g) => g.side === k).map(target).filter((s) => s >= 0));
    const idle = st.groups.filter((g) => g.side === k && !g.coffee && g.status === 'idle');
    // "they're arguing at my spot!" -> send the nearest other group that isn't busy arguing itself
    for (const s of st.spots) {
      if (s.holder !== k) continue;
      const r = rivalsAt(st, s.idx, k), own = present(st, s.idx, k);
      const coming = st.groups.filter((g) => g.side === k && g.spot === s.idx && g.at !== s.idx && !g.coffee).length;
      if (!r || r < own || coming) continue;
      const helpers = st.groups.filter((g) => g.side === k && !g.coffee && g.spot !== s.idx && !g.arguing);
      helpers.sort((a, b) => m.eta(a.id, s.idx) - m.eta(b.id, s.idx));
      if (helpers[0] && m.eta(helpers[0].id, s.idx) < 30) {
        const h = helpers[0];
        m.order(k, h.id, s.id); targeted.add(s.idx);
        const i = idle.indexOf(h); if (i >= 0) idle.splice(i, 1);
      }
    }
    // help that is no longer needed goes back to an empty spot (below)
    for (const g of st.groups) {
      if (g.side !== k || g.coffee || g.at < 0 || g.arguing) continue;
      const mates = st.groups.filter((q) => q.side === k && q.at === g.at && q.id !== g.id);
      if (mates.length && mates.some((q) => q.id < g.id) && !idle.includes(g)) idle.push(g);
    }
    for (const g of idle) {
      let best = null, bv = Infinity;
      for (const s of st.spots) {
        if (targeted.has(s.idx) || s.holder === k) continue;
        const v = m.eta(g.id, s.idx) + (s.holder >= 0 || rivalsAt(st, s.idx, k) ? 1000 : 0);
        if (v < bv) { bv = v; best = s; }
      }
      if (best) { m.order(k, g.id, best.id); targeted.add(best.idx); }
    }
  });
}

/** Holds whatever it first reaches: idle groups take the nearest empty spot, nothing else. */
function staticBot() {
  return every(1, (m, k) => {
    const st = m.state;
    const targeted = new Set(st.groups.filter((g) => g.side === k).map((g) => g.spot).filter((s) => s >= 0));
    for (const g of st.groups) {
      if (g.side !== k || g.coffee || g.status !== 'idle') continue;
      let best = null, bv = Infinity;
      for (const s of st.spots) { if (targeted.has(s.idx) || s.holder >= 0) continue; const v = m.eta(g.id, s.idx); if (v < bv) { bv = v; best = s; } }
      if (best) { m.order(k, g.id, best.id); targeted.add(best.idx); }
    }
  });
}

function playerConfig(kind, crew, params) {
  if (kind === 'newbie' || kind === 'static') return { crew, ai: false, bot: kind };
  return { crew, ai: params ? { difficulty: kind, params } : { difficulty: kind } };
}
function attachBots(m, players) {
  players.forEach((p, k) => {
    if (p.bot === 'newbie') { const b = newbieBot(); m.systems.push((mm) => b(mm, k)); }
    if (p.bot === 'static') { const b = staticBot(); m.systems.push((mm) => b(mm, k)); }
  });
}

// ------------------------------------------------------------------ one AI/bot match
function runMatch(SQ, job) {
  const kinds = job.swap ? [job.b, job.a] : [job.a, job.b];
  const params = job.swap ? [job.pb, job.pa] : [job.pa, job.pb];
  const players = [playerConfig(kinds[0], 'hustle', params[0]), playerConfig(kinds[1], 'pack', params[1])];
  const m = SQ.Hangout.create({ seed: job.seed, quiet: true, layout: job.layout || 'park', rules: job.rules || {},
    players: players.map((p) => ({ crew: p.crew, ai: p.ai })) });
  attachBots(m, players);
  if (job.forceCoffee) {
    const fc = job.forceCoffee;
    m.systems.push((mm) => {
      if (mm.state.t >= fc.at && !fc.done) {
        const side = job.swap ? 1 - fc.who : fc.who;
        const g = mm.state.groups.find((q) => q.side === side && !q.coffee && q.at >= 0) || mm.state.groups.find((q) => q.side === side && !q.coffee);
        if (g) { SQ.Hangout.forceCoffee(mm, g.id); fc.done = true; }
      }
    });
  }
  const st = m.state;
  let lastCfg = '', cfgChanges = 0, runStart = 0, longestStatic = 0, split32 = 0, leadSign = 0, leadChanges = 0;
  let firstCoffee = -1;
  m.bus.on('wentForCoffee', (p) => { if (firstCoffee < 0) firstCoffee = p.side; });
  while (!st.over) {
    m.tick();
    const conf = st.spots.map((s) => s.holder).join(',');
    if (conf !== lastCfg) { cfgChanges++; longestStatic = Math.max(longestStatic, st.t - runStart); runStart = st.t; lastCfg = conf; }
    const h = st.sides.map((s) => s.holding);
    if ((h[0] === 3 && h[1] === 2) || (h[0] === 2 && h[1] === 3)) split32 += SQ.Hangout.DT;
    const d = st.sides[0].score - st.sides[1].score;
    const sg = d > 2 ? 1 : d < -2 ? -1 : 0;
    if (sg && sg !== leadSign) { if (leadSign) leadChanges++; leadSign = sg; }
  }
  longestStatic = Math.max(longestStatic, st.t - runStart);
  const ia = job.swap ? 1 : 0, ib = 1 - ia;
  const r = m.report();
  return {
    seed: job.seed, a: job.a, b: job.b, swap: !!job.swap,
    winner: st.winner === ia ? 'A' : st.winner === ib ? 'B' : '-', winSide: st.winner,
    pa: st.sides[ia].points, pb: st.sides[ib].points, changes: st.spots.reduce((n, s) => n + s.changes, 0),
    cfgChanges, longestStatic: round(longestStatic, 1), split32: round(split32, 1), leadChanges,
    coffeeA: r.sides[ia].coffees, coffeeB: r.sides[ib].coffees, wA: r.sides[ia].withdrawals, wB: r.sides[ib].withdrawals,
    mutual: r.sides[0].mutual, twoOnOne: r.sides[0].twoOnOne + r.sides[1].twoOnOne, evict: r.sides[0].evictions + r.sides[1].evictions,
    firstCoffee: firstCoffee === ia ? 'A' : firstCoffee === ib ? 'B' : '-',
    ordersA: r.sides[ia].orders, ordersB: r.sides[ib].orders,
  };
}

// ------------------------------------------------------------------ worker pool
function runJobs(jobs, workers) {
  if (workers <= 1 || jobs.length < 4) { const SQ = getSQ(); return Promise.resolve(jobs.map((j) => runMatch(SQ, j))); }
  return new Promise((resolve, reject) => {
    const out = new Array(jobs.length);
    let next = 0, done = 0, live = 0;
    const n = Math.min(workers, jobs.length);
    for (let w = 0; w < n; w++) {
      const wk = new Worker(__filename, { workerData: { worker: true } });
      live++;
      const feed = () => { if (next < jobs.length) { const i = next++; wk.postMessage({ i, job: jobs[i] }); } else { wk.terminate(); } };
      wk.on('message', (msg) => { out[msg.i] = msg.row; done++; if (done === jobs.length) resolve(out); feed(); });
      wk.on('error', reject);
      wk.on('exit', () => { live--; });
      feed();
    }
  });
}
if (!isMainThread && workerData && workerData.worker) {
  const SQ = getSQ();
  parentPort.on('message', (msg) => parentPort.postMessage({ i: msg.i, row: runMatch(SQ, msg.job) }));
}

function summarize(rows) {
  const n = rows.length;
  const A = rows.filter((r) => r.winner === 'A').length, B = rows.filter((r) => r.winner === 'B').length;
  const side0 = rows.filter((r) => r.winSide === 0).length, side1 = rows.filter((r) => r.winSide === 1).length;
  const mean = (f) => rows.reduce((s, r) => s + f(r), 0) / Math.max(1, n);
  return {
    n, winA: A, winB: B, draws: n - A - B, rateA: A / Math.max(1, n), side0, side1,
    margin: round(mean((r) => r.pa - r.pb), 1), absMargin: round(mean((r) => Math.abs(r.pa - r.pb)), 1),
    changes: round(mean((r) => r.changes), 1), cfgChanges: round(mean((r) => r.cfgChanges), 1),
    longestStatic: round(mean((r) => r.longestStatic), 1), maxStatic: Math.max(...rows.map((r) => r.longestStatic)),
    split32: round(mean((r) => r.split32), 1), leadChanges: round(mean((r) => r.leadChanges), 2),
    coffees: round(mean((r) => r.coffeeA + r.coffeeB), 1), withdrawals: round(mean((r) => r.wA + r.wB), 1),
    mutual: round(mean((r) => r.mutual), 2), twoOnOne: round(mean((r) => r.twoOnOne), 2), evict: round(mean((r) => r.evict), 2),
    orders: round(mean((r) => r.ordersA + r.ordersB), 1),
  };
}

// ------------------------------------------------------------------ travel times (measured)
function measureWalk(SQ, layout, rules, side, from, toId) {
  const players = [{ crew: 'hustle', ai: false }, { crew: 'pack', ai: false }];
  const groups = [[], []];
  groups[side] = [{ slot: 0, at: from }];
  const m = SQ.Hangout.create({ seed: 1, quiet: true, layout, rules, players, groups, length: 0, ai: false });
  const g = m.state.groups[0];
  m.order(side, g.id, toId);
  let tIn = -1;
  for (let k = 0; k < 20 * 200; k++) {
    m.tick();
    if (tIn < 0 && g.at >= 0) tIn = m.state.t;
    if (!g.moving) break;
  }
  return { tIn: tIn < 0 ? m.state.t : tIn, tSlot: m.state.t };
}

function travel(SQ, opts) {
  const L = SQ.data.hangout.layouts[opts.layout || 'park'];
  const spots = L.spots, rules = opts.rules || {};
  const out = { entrances: {}, spots: {} };
  const ents = L.entrances.slice(0, 2);
  ents.forEach((e, side) => {
    out.entrances[e] = {};
    for (const s of spots) out.entrances[e][s] = round(measureWalk(SQ, L.id, rules, side, 'entrance', s).tIn, 1);
  });
  for (const a of spots) {
    out.spots[a] = {};
    for (const b of spots) out.spots[a][b] = a === b ? 0 : round(measureWalk(SQ, L.id, rules, 0, a, b).tIn, 1);
  }
  // 4-player entrances (field estimate, side 0's slot)
  out.ffa = {};
  for (const e of L.entrances) {
    out.ffa[e] = {};
    const E = SQ.data.hangout.entrances[e];
    const m = SQ.Hangout.create({ seed: 1, quiet: true, layout: L.id, rules, players: [{ crew: 'hustle', ai: false }, { crew: 'pack', ai: false }], length: 0, ai: false });
    for (const s of spots) out.ffa[e][s] = round(SQ.Hangout.walkTime(m, E.x, E.z, spotIdx(m.state, s), 0, 0), 1);
  }
  return out;
}

function printTravel(t) {
  const spots = Object.keys(t.spots);
  const short = (s) => s.slice(0, 9);
  console.log('\nWalking time (s) from each 1v1 entrance into each spot (measured, a group at 4.5 m/s):');
  console.log('| from \\ to | ' + spots.map(short).join(' | ') + ' |');
  console.log('|---|' + spots.map(() => '---:').join('|') + '|');
  for (const e of Object.keys(t.entrances)) console.log('| ' + e + ' | ' + spots.map((s) => t.entrances[e][s]).join(' | ') + ' |');
  const es = Object.keys(t.entrances);
  console.log('| lean (' + es[1] + ' - ' + es[0] + ') | ' + spots.map((s) => round(t.entrances[es[1]][s] - t.entrances[es[0]][s], 1)).join(' | ') + ' |');
  console.log('\nSpot to spot (s):');
  console.log('| from \\ to | ' + spots.map(short).join(' | ') + ' |');
  console.log('|---|' + spots.map(() => '---:').join('|') + '|');
  for (const a of spots) console.log('| ' + a + ' | ' + spots.map((b) => t.spots[a][b]).join(' | ') + ' |');
  console.log('\nAll four entrances (3-4 players; field estimate, s):');
  console.log('| from \\ to | ' + spots.map(short).join(' | ') + ' |');
  console.log('|---|' + spots.map(() => '---:').join('|') + '|');
  for (const e of Object.keys(t.ffa)) console.log('| ' + e + ' | ' + spots.map((s) => t.ffa[e][s]).join(' | ') + ' |');
}

// ------------------------------------------------------------------ the incumbent-dominance test
// Leader: three groups settled on its near spot + two of the three middle spots. Challenger: its near spot +
// the remaining middle spot, third group fresh at its entrance. Scores start 20-0 to the leader, 180 s left.
const MIRROR = { toddler: 'smallrun', smallrun: 'toddler', holley: 'garibaldi', garibaldi: 'holley', fountain: 'fountain' };
function incumbentSetups(layoutId) {
  const L = layoutId || 'park';
  if (L !== 'park') throw new Error('incumbent setups are defined for the park layout');
  const base = [
    { name: 'L: Toddler+Fountain+Garibaldi / C: DogRun+Holley', lead: ['toddler', 'fountain', 'garibaldi'], chal: ['smallrun', 'holley'] },
    { name: 'L: Toddler+Holley+Fountain / C: DogRun+Garibaldi', lead: ['toddler', 'holley', 'fountain'], chal: ['smallrun', 'garibaldi'] },
    { name: 'L: Toddler+Holley+Garibaldi / C: DogRun+Fountain', lead: ['toddler', 'holley', 'garibaldi'], chal: ['smallrun', 'fountain'] },
  ];
  const out = [];
  for (const b of base) {
    out.push(Object.assign({ leader: 0 }, b));
    out.push({ leader: 1, name: b.name + ' (sides swapped)', lead: b.lead.map((s) => MIRROR[s]), chal: b.chal.map((s) => MIRROR[s]) });
  }
  return out;
}

function makeIncumbent(SQ, setup, rules, leaderAI, chalAI, opts) {
  const Lk = setup.leader, Ck = 1 - Lk;
  const groups = [[], []];
  groups[Lk] = setup.lead.map((s, j) => ({ slot: j, at: s }));
  groups[Ck] = setup.chal.map((s, j) => ({ slot: j, at: s })).concat([{ slot: 2, at: 'entrance' }]);
  const holders = {};
  for (const s of setup.lead) holders[s] = Lk;
  for (const s of setup.chal) holders[s] = Ck;
  const scores = [0, 0]; scores[Lk] = (opts && opts.lead) !== undefined ? opts.lead : 20;
  const players = [{ crew: 'hustle', ai: false }, { crew: 'pack', ai: false }];
  if (leaderAI) players[Lk].ai = { difficulty: leaderAI };
  if (chalAI) players[Ck].ai = { difficulty: chalAI };
  return SQ.Hangout.create({ seed: 7, quiet: true, rules, players, groups, holders, scores, length: (opts && opts.length) || 180 });
}

// Challenger plans. ctx: { target: spot id, alt: spot id }
const PLANS = {
  static: () => () => {},
  // 1 v 1: the fresh group argues alone
  trade: (ctx) => { let go = true; return (m, k) => { if (go) { go = false; m.order(k, freeGroup(m, k).id, ctx.target); } }; },
  // 2 v 1: the fresh group plus the nearest holder, timed to arrive together; the holder goes home after
  pair: (ctx) => {
    let ph = 0, F, H, home;
    return (m, k) => {
      const st = m.state, T = spotIdx(st, ctx.target);
      if (ph === 0) { F = freeGroup(m, k); H = nearestHolder(m, k, T); home = H.spot; m.order(k, F.id, ctx.target); ph = 1; }
      if (ph === 1 && m.eta(H.id, T) >= m.eta(F.id, T) - 0.5) { m.order(k, H.id, ctx.target); ph = 2; }
      if (ph === 2 && st.spots[T].holder === k) { m.order(k, H.id, st.spots[home].id); ph = 3; }
    };
  },
  // feint: walk at one spot, switch to another when the leader starts to reinforce (or after 8 s)
  feint: (ctx) => {
    let ph = 0, F, t0 = 0;
    return (m, k) => {
      const st = m.state, T = spotIdx(st, ctx.target);
      if (ph === 0) { F = freeGroup(m, k); m.order(k, F.id, ctx.target); t0 = st.t; ph = 1; }
      if (ph === 1) {
        const helping = st.groups.some((g) => g.side !== k && g.spot === T && g.at !== T);
        if (helping || st.t - t0 > 8) { m.order(k, F.id, ctx.alt); ph = 2; }
      }
    };
  },
  // rotate: the fresh group argues first; when it is worn down a fresh holder takes over and the first one
  // walks to the holder's spot to rest there. Whoever is not needed at the end goes back to that spot.
  rotate: (ctx) => {
    let ph = 0, A, B, home;
    return (m, k) => {
      const st = m.state, T = spotIdx(st, ctx.target), H = st.spots[home === undefined ? 0 : home];
      if (ph === 0) { A = freeGroup(m, k); B = nearestHolder(m, k, T); home = B.spot; m.order(k, A.id, ctx.target); ph = 1; return; }
      if (ph === 3) return;
      if (st.spots[T].holder === k) {
        const atT = [A, B].filter((g) => !g.coffee && g.spot === T);
        if (atT.length === 2) { const tired = atT[0].patience <= atT[1].patience ? atT[0] : atT[1]; m.order(k, tired.id, H.id); }
        for (const g of [A, B]) if (g.coffee) m.order(k, g.id, H.id);
        ph = 3; return;
      }
      if (ph === 1 && ((A.at === T && A.patience < 45) || A.coffee)) { m.order(k, B.id, ctx.target); ph = 2; }
      if (ph === 2) {
        if (A.coffee && !A.pending) m.order(k, A.id, H.id);
        else if (!A.coffee && A.spot === T && B.at === T) m.order(k, A.id, H.id);
        if (B.coffee) ph = 3;
      }
    };
  },
  // trade, then win the race back: when the fight empties the spot, the nearest holder walks in; the fresh group
  // (back from coffee) refills the holder's spot
  tradeCover: (ctx) => {
    let ph = 0, F, H, home;
    return (m, k) => {
      const st = m.state, T = spotIdx(st, ctx.target);
      if (ph === 0) { F = freeGroup(m, k); m.order(k, F.id, ctx.target); ph = 1; return; }
      if (ph === 1 && F.coffee) {
        const s = st.spots[T];
        if (s.holder < 0) { H = nearestHolder(m, k, T); home = H.spot; m.order(k, H.id, ctx.target); m.order(k, F.id, st.spots[home].id); ph = 2; }
      }
    };
  },
};
function freeGroup(m, k) {
  const st = m.state;
  return st.groups.find((g) => g.side === k && g.spot < 0 && !g.coffee) || st.groups.filter((g) => g.side === k).slice(-1)[0];
}
function nearestHolder(m, k, T) {
  const st = m.state;
  const holders = st.groups.filter((g) => g.side === k && g.spot >= 0 && st.spots[g.spot].holder === k && g.spot !== T);
  holders.sort((a, b) => m.eta(a.id, T) - m.eta(b.id, T));
  return holders[0] || freeGroup(m, k);
}

// Leader responses
const RESPONSES = {
  ignore: () => () => {},
  // send the nearest other group to any spot where it is outnumbered or matched; go home when it is over
  reinforce: () => {
    const helpers = {};
    return every(0.25, (m, k) => {
      const st = m.state;
      for (const s of st.spots) {
        if (s.holder !== k) continue;
        const r = rivalsAt(st, s.idx, k), own = present(st, s.idx, k);
        const coming = st.groups.filter((g) => g.side === k && g.spot === s.idx && g.at !== s.idx && !g.coffee).length;
        if (r && r >= own + coming) {
          const cand = st.groups.filter((g) => g.side === k && !g.coffee && g.spot !== s.idx && !(g.at >= 0 && rivalsAt(st, g.at, k)) && !helpers[g.id]);
          cand.sort((a, b) => m.eta(a.id, s.idx) - m.eta(b.id, s.idx));
          if (cand[0]) { helpers[cand[0].id] = cand[0].spot; m.order(k, cand[0].id, s.id); }
        }
      }
      for (const id of Object.keys(helpers)) {
        const g = st.groups[id];
        if (g.coffee) { delete helpers[id]; continue; }
        if (g.at >= 0 && !rivalsAt(st, g.at, k) && st.spots[g.at].holder === k && helpers[id] >= 0) { m.order(k, g.id, st.spots[helpers[id]].id); delete helpers[id]; }
      }
    });
  },
  // outnumbered defenders walk away to the nearest empty spot (or wait it out at the edge)
  withdraw: () => every(0.25, (m, k) => {
    const st = m.state;
    for (const g of st.groups) {
      if (g.side !== k || g.coffee || g.at < 0) continue;
      const r = rivalsAt(st, g.at, k), own = present(st, g.at, k);
      if (r > own || (r === own && g.patience < 50)) {
        const empty = st.spots.filter((s) => s.holder < 0 && !present(st, s.idx)).sort((a, b) => m.eta(g.id, a.idx) - m.eta(g.id, b.idx))[0];
        if (empty) m.order(k, g.id, empty.id);
      }
    }
  }),
  // take whatever the challenger leaves empty, with the nearest group that is not being argued with
  counter: () => every(0.25, (m, k) => {
    const st = m.state;
    for (const s of st.spots) {
      if (s.holder >= 0 || present(st, s.idx)) continue;
      if (st.groups.some((g) => g.side === k && g.spot === s.idx && !g.coffee)) continue;
      const cand = st.groups.filter((g) => g.side === k && !g.coffee && !(g.at >= 0 && rivalsAt(st, g.at, k)));
      cand.sort((a, b) => m.eta(a.id, s.idx) - m.eta(b.id, s.idx));
      if (cand[0] && m.eta(cand[0].id, s.idx) < 30) m.order(k, cand[0].id, s.id);
    }
  }),
};
// "Hard AI" and "Normal AI" responses are the real AI playing the leader.
const AI_RESPONSES = ['normal', 'hard'];

function runIncumbent(SQ, setup, plan, ctx, response, rules) {
  const Lk = setup.leader, Ck = 1 - Lk;
  const leaderAI = AI_RESPONSES.indexOf(response) >= 0 ? response : null;
  const chalAI = AI_RESPONSES.indexOf(plan) >= 0 ? plan : null;
  const m = makeIncumbent(SQ, setup, rules, leaderAI, chalAI);
  if (!chalAI) { const p = PLANS[plan](ctx); m.systems.push((mm) => p(mm, Ck)); }
  if (!leaderAI) { const r = RESPONSES[response](); m.systems.push((mm) => r(mm, Lk)); }
  const st = m.state;
  let gap120 = null, held120 = null;
  while (!st.over) {
    m.tick();
    if (gap120 === null && st.t >= 120 - 1e-9) { gap120 = st.sides[Lk].score - st.sides[Ck].score - 20; held120 = [st.sides[Lk].holding, st.sides[Ck].holding]; }
  }
  return { gap120: round(gap120, 1), held120, final: st.sides[Lk].points - st.sides[Ck].points, chalWins: st.winner === Ck, draw: st.winner < 0,
    coffees: [st.sides[Lk].stats.coffees, st.sides[Ck].stats.coffees] };
}

function incumbent(SQ, opts) {
  const rules = opts.rules || {};
  const setups = incumbentSetups(opts.layout);
  const responses = Object.keys(RESPONSES).concat(AI_RESPONSES);
  const planList = [];
  for (const setup of setups) {
    const leadMid = setup.lead.filter((s) => s !== 'toddler' && s !== 'smallrun');
    const leadHome = setup.lead.find((s) => s === 'toddler' || s === 'smallrun');
    const targets = leadMid.concat([leadHome]);
    planList.push({ setup, plan: 'static', ctx: {} });
    for (const t of targets) {
      for (const p of ['trade', 'pair', 'rotate', 'tradeCover']) planList.push({ setup, plan: p, ctx: { target: t } });
      const alt = targets.find((x) => x !== t);
      planList.push({ setup, plan: 'feint', ctx: { target: t, alt } });
    }
    for (const a of AI_RESPONSES) planList.push({ setup, plan: a, ctx: {} });
  }
  const rows = [];
  for (const pl of planList) {
    for (const resp of responses) {
      const r = runIncumbent(SQ, pl.setup, pl.plan, pl.ctx, resp, rules);
      rows.push({ setup: pl.setup.name, leader: pl.setup.leader, plan: pl.plan, target: pl.ctx.target || '', resp, ...r });
    }
  }
  return { rows, responses };
}

function printIncumbent(res) {
  const { rows, responses } = res;
  const statics = {};
  for (const r of rows) if (r.plan === 'static') statics[r.setup + '|' + r.resp] = r;
  // per plan family: best target (most challenger-favourable) per setup, averaged over setups
  const fams = ['static', 'trade', 'pair', 'feint', 'rotate', 'tradeCover', 'normal', 'hard'];
  console.log('\nIncumbent test: change in the leader\'s lead over 120 s, relative to the challenger doing nothing');
  console.log('(negative = the challenger gained; mean over the 6 setups of each plan\'s best target; [wins/6] = challenger');
  console.log('wins the 180 s match from 20 points down):');
  console.log('| challenger plan | ' + responses.join(' | ') + ' |');
  console.log('|---|' + responses.map(() => '---:').join('|') + '|');
  const setups = [...new Set(rows.map((r) => r.setup))];
  const summary = {};
  for (const f of fams) {
    const cells = [];
    for (const resp of responses) {
      let sum = 0, wins = 0;
      for (const s of setups) {
        const cand = rows.filter((r) => r.plan === f && r.resp === resp && r.setup === s);
        if (!cand.length) continue;
        const base = statics[s + '|' + resp];
        const best = cand.slice().sort((a, b) => (a.gap120 - b.gap120) || (a.final - b.final))[0];
        sum += best.gap120 - base.gap120;
        const bestFinal = cand.slice().sort((a, b) => a.final - b.final)[0];
        if (bestFinal.chalWins) wins++;
      }
      const v = round(sum / setups.length, 1);
      cells.push(v + ' [' + wins + '/' + setups.length + ']');
      (summary[f] || (summary[f] = {}))[resp] = { delta: v, wins };
    }
    console.log('| ' + f + ' | ' + cells.join(' | ') + ' |');
  }
  return summary;
}

// ------------------------------------------------------------------ checks
async function checks(opts) {
  const n = opts.n || 40, rules = opts.rules || {}, W = opts.workers;
  const out = {};
  // (a) one group forced to go for coffee at 1:00 (and at 4:00): how often does that crew still win?
  for (const at of [60, 240]) {
    const base = [], forced = [];
    for (let k = 0; k < n; k++) {
      const job = { seed: 500 + k, a: 'hard', b: 'hard', swap: k % 2 === 1, rules, layout: opts.layout };
      base.push(job);
      forced.push(Object.assign({}, job, { forceCoffee: { at, who: 0 } }));
    }
    const rb = await runJobs(base, W), rf = await runJobs(forced, W);
    out['coffee@' + at] = { baseWinA: summarize(rb).rateA, forcedWinA: summarize(rf).rateA, forcedDraws: summarize(rf).draws, n };
  }
  // (b) the first crew to go for coffee: how often does it lose?
  const jobs = [];
  for (let k = 0; k < n; k++) jobs.push({ seed: 900 + k, a: 'hard', b: 'hard', swap: k % 2 === 1, rules, layout: opts.layout });
  const rows = await runJobs(jobs, W);
  const firsts = rows.filter((r) => r.firstCoffee !== '-');
  out.firstCoffeeLoses = { n: firsts.length, rate: round(firsts.filter((r) => r.winner !== '-' && r.winner !== r.firstCoffee).length / Math.max(1, firsts.length), 2) };
  out.hardMirror = summarize(rows);
  return out;
}

// ------------------------------------------------------------------ CLI
function parseArgs(argv) {
  const o = { cmd: argv[0] || 'all', n: 40, seed: 1, workers: Math.max(1, Math.min(12, os.cpus().length - 1)), rules: {}, layout: 'park', a: 'hard', b: 'hard', json: false };
  for (let k = 1; k < argv.length; k++) {
    const a = argv[k], v = () => argv[++k];
    if (a === '--n') o.n = +v();
    else if (a === '--seed') o.seed = +v();
    else if (a === '--workers') o.workers = Math.max(1, +v());
    else if (a === '--layout') o.layout = v();
    else if (a === '--a') o.a = v();
    else if (a === '--b') o.b = v();
    else if (a === '--json') o.json = true;
    else if (a === '--pa' || a === '--pb') o[a.slice(2)] = kvs(v());
    else if (a === '--rules') {
      for (const kv of v().split(',')) {
        const [key, val] = kv.split('=');
        o.rules[key] = val === 'true' ? true : val === 'false' ? false : isNaN(+val) ? val : +val;
      }
    }
  }
  return o;
}

function kvs(str) {
  const out = {};
  for (const kv of str.split(',')) { const [k, v] = kv.split('='); out[k] = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v; }
  return out;
}

function ladderPairs() {
  return [['newbie', 'easy'], ['newbie', 'normal'], ['easy', 'normal'], ['normal', 'hard'], ['easy', 'hard'], ['static', 'normal'], ['hard', 'hard'], ['normal', 'normal']];
}

async function ladder(o) {
  const res = {};
  for (const [a, b] of ladderPairs()) {
    const jobs = [];
    for (let k = 0; k < o.n; k++) jobs.push({ seed: o.seed + k, a, b, swap: k % 2 === 1, rules: o.rules, layout: o.layout });
    res[a + ' v ' + b] = summarize(await runJobs(jobs, o.workers));
  }
  return res;
}

function printLadder(res) {
  console.log('\nAI ladder (sides swapped every other match):');
  console.log('| pairing | n | A wins | B wins | draws | north wins | south wins | mean margin A-B | lead changes | spot changes | longest static (s) | 3-2 split (s) | coffees | walk-aways | 2-on-1 wins |');
  console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const k of Object.keys(res)) {
    const s = res[k];
    console.log(`| ${k} | ${s.n} | ${s.winA} | ${s.winB} | ${s.draws} | ${s.side0} | ${s.side1} | ${s.margin} | ${s.leadChanges} | ${s.changes} | ${s.longestStatic} (max ${round(s.maxStatic)}) | ${s.split32} | ${s.coffees} | ${s.withdrawals} | ${s.twoOnOne} |`);
  }
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const SQ = getSQ();
  const t0 = Date.now();
  const result = { rules: Object.assign({}, SQ.data.hangout.rules, o.rules), layout: o.layout };
  if (o.cmd === 'travel' || o.cmd === 'all') { result.travel = travel(SQ, o); if (!o.json) printTravel(result.travel); }
  if (o.cmd === 'batch') {
    const jobs = [];
    for (let k = 0; k < o.n; k++) jobs.push({ seed: o.seed + k, a: o.a, b: o.b, pa: o.pa, pb: o.pb, swap: k % 2 === 1, rules: o.rules, layout: o.layout });
    result.batch = summarize(await runJobs(jobs, o.workers));
    if (!o.json) printLadder({ [o.a + ' v ' + o.b]: result.batch });
  }
  if (o.cmd === 'ladder' || o.cmd === 'all') { result.ladder = await ladder(o); if (!o.json) printLadder(result.ladder); }
  if (o.cmd === 'incumbent' || o.cmd === 'all') {
    const inc = incumbent(SQ, o);
    result.incumbent = o.json ? inc : undefined;
    result.incumbentSummary = o.json ? null : printIncumbent(inc);
    if (o.json) result.incumbentSummary = printIncumbentQuiet(inc);
  }
  if (o.cmd === 'checks' || o.cmd === 'all') {
    result.checks = await checks(o);
    if (!o.json) {
      console.log('\nChecks:');
      for (const k of Object.keys(result.checks)) console.log('  ' + k + ': ' + JSON.stringify(result.checks[k]));
    }
  }
  if (o.json) console.log(JSON.stringify(result, null, 1));
  else console.log('\n(' + round((Date.now() - t0) / 1000, 1) + ' s)');
}

function printIncumbentQuiet(inc) {
  const log = console.log; console.log = () => {};
  try { return printIncumbent(inc); } finally { console.log = log; }
}

module.exports = { runMatch, summarize, newbieBot, staticBot, travel, incumbent, incumbentSetups, runIncumbent, PLANS, RESPONSES, checks, measureWalk };

if (isMainThread && require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
