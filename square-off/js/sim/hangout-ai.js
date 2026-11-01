// SQUARE OFF — "Hang Out" AI (DESIGN-V2.md §6). Plays only through match.order(side, groupId, target).
// A crew boss with tactical rules, in priority order, and commitment (a group keeps walking to where it was
// sent unless that spot changes hands): finish operations under way (two-against-one, help), defend (send
// help that arrives in time, or walk away to an empty spot when the argument is lost), fill empty spots
// (least total walking), attack (two against one, or one against a worn-out group). Attacks are scored by a
// small forward model of the same rules (nav-measured walking times, settling, arguing, patience, coffee,
// the holder-keeps-ties rule) against "carry on as we are", with one or two guesses of the rival's replies.
// Difficulty = how often it thinks, how late it notices (Easy: also that a spot has come free), which of the rules
// it uses, and how picky it is.
// Headless, deterministic (own RNG stream). Sees what a player sees: positions, patience, where groups were
// sent, `react` seconds late.
(function (SQ) {
  'use strict';
  const MDT = 0.5;          // model step (s)
  const IN_T = 1.0;         // a walking group counts as "at" its spot this long before reaching its standing place
  const STAY = -1;
  const ORIG_NOW = -3, ORIG_ENT = -2;

  function HO() { return SQ.Hangout; }

  // ------------------------------------------------------------------ setup
  function init(match) {
    const st = match.state;
    match.ai = st.sides.map((side, k) => {
      const p = match.cfg.players[k];
      if (!p || !p.ai) return null;
      return makeBrain(match, k, p.ai);
    });
    match.aiTables = buildTables(match);
  }

  function makeBrain(match, k, cfg) {
    const table = SQ.data.hangout.ai;
    const diff = table[cfg.difficulty] ? cfg.difficulty : 'normal';
    const P = Object.assign({}, table[diff], cfg.params || {});
    return {
      side: k, diff, P, flags: Object.assign({}, cfg.flags || {}), rng: SQ.util.rngStream(match.seed, 'hangout-ai:' + k),
      nextThink: (P.lazyStart || 0) + 0.2, hist: [], scriptDone: {}, sent: {}, rerouted: {}, ops: [], decisions: 0, orders: 0, plansTried: 0,
      M0: null, M: null, last: null, freeSince: null,
    };
  }

  // Static travel tables (s): from each group's entrance standing place, and slot-to-slot, per group.
  function buildTables(match) {
    const st = match.state, Hn = HO();
    const nG = st.groups.length, nP = st.spots.length;
    const ent = new Float64Array(nG * nP), ss = new Float64Array(nG * nP * nP);
    for (const g of st.groups) {
      const e = st.sides[g.side].entrance;
      // the entrance standing place (same rule as the sim): measure from the side's entrance point
      for (let s = 0; s < nP; s++) {
        ent[g.id * nP + s] = Hn.walkTime(match, e.x, e.z, s, g.side, g.slot);
        for (let a = 0; a < nP; a++) {
          const sl = st.spots[a].slots[g.side][g.slot % st.spots[a].slots[g.side].length];
          ss[(g.id * nP + a) * nP + s] = a === s ? 0 : Hn.walkTime(match, sl.x, sl.z, s, g.side, g.slot);
        }
      }
    }
    return { nG, nP, ent, ss };
  }

  // ------------------------------------------------------------------ model
  function Model(nG, nP, nS) {
    this.nG = nG; this.nP = nP; this.nS = nS;
    this.side = new Int8Array(nG); this.dest = new Int8Array(nG); this.orig = new Int8Array(nG); this.last = new Int8Array(nG);
    this.pend = new Int8Array(nG); this.eta = new Float64Array(nG); this.tot = new Float64Array(nG); this.pat = new Float64Array(nG);
    this.cof = new Float64Array(nG); this.at = new Int8Array(nG); this.now = new Float64Array(nG * nP);
    this.holder = new Int8Array(nP); this.sset = new Int8Array(nP); this.settle = new Float64Array(nP);
    this.pres = new Int16Array(nP * nS); this.since = new Float64Array(nP * nS); this.score = new Float64Array(nS);
    this.t = 0; this.left = 0;
  }
  Model.prototype.copyFrom = function (o) {
    this.side.set(o.side); this.dest.set(o.dest); this.orig.set(o.orig); this.last.set(o.last); this.pend.set(o.pend);
    this.eta.set(o.eta); this.tot.set(o.tot); this.pat.set(o.pat); this.cof.set(o.cof); this.at.set(o.at); this.now.set(o.now);
    this.holder.set(o.holder); this.sset.set(o.sset); this.settle.set(o.settle); this.pres.set(o.pres); this.since.set(o.since); this.score.set(o.score);
    this.t = o.t; this.left = o.left;
  };

  /** Travel time for group g from its current model origin/progress to spot c. */
  function etaTo(M, T, g, c) {
    const nP = M.nP;
    const fromOrig = (o) => (o === ORIG_NOW ? M.now[g * nP + c] : o === ORIG_ENT ? T.ent[g * nP + c] : T.ss[(g * nP + o) * nP + c]);
    const d = M.dest[g];
    if (d < 0 || M.tot[g] <= 0 || M.eta[g] <= 0) return d >= 0 && M.eta[g] <= 0 ? T.ss[(g * nP + d) * nP + c] : fromOrig(M.orig[g]);
    const f = M.eta[g] / M.tot[g];  // fraction of the walk left
    return f * fromOrig(M.orig[g]) + (1 - f) * T.ss[(g * nP + d) * nP + c];
  }

  function send(M, T, g, c) {
    if (M.cof[g] > 0) { M.pend[g] = c; return; }
    if (M.dest[g] === c) return;
    const e = c >= 0 ? etaTo(M, T, g, c) : 0;
    // the new origin: where it is now, approximated by the endpoint it is closest to
    if (M.dest[g] >= 0 && M.eta[g] <= 0) M.orig[g] = M.dest[g];
    M.dest[g] = c; if (c >= 0) M.last[g] = c;
    M.eta[g] = e; M.tot[g] = e;
  }

  /** Build the model from the (perceived) match state. */
  function buildModel(match, b) {
    const st = match.state, T = match.aiTables, Hn = HO();
    const nG = st.groups.length, nP = st.spots.length, nS = st.sides.length;
    const M = b.M0 && b.M0.nG === nG ? b.M0 : (b.M0 = new Model(nG, nP, nS));
    const per = perceive(match, b);
    for (let g = 0; g < nG; g++) {
      const q = per[g];
      const G = st.groups[g];
      M.side[g] = G.side; M.pat[g] = q.patience; M.pend[g] = -1; M.at[g] = -1;
      M.last[g] = q.last;
      for (let c = 0; c < nP; c++) M.now[g * nP + c] = Hn.walkTime(match, q.x, q.z, c, G.side, G.slot);
      if (q.coffee) {
        M.cof[g] = Math.max(MDT, q.backAt - st.t); M.dest[g] = -1; M.orig[g] = ORIG_ENT; M.eta[g] = 0; M.tot[g] = 0;
        M.pend[g] = q.pending;
      } else {
        M.cof[g] = 0; M.orig[g] = ORIG_NOW; M.dest[g] = q.dest;
        const e = q.dest >= 0 ? M.now[g * nP + q.dest] : 0;
        M.eta[g] = q.dest >= 0 && q.arrived ? 0 : e; M.tot[g] = M.eta[g];
      }
    }
    for (let p = 0; p < nP; p++) {
      const s = st.spots[p];
      M.holder[p] = s.holder; M.sset[p] = s.settleSide; M.settle[p] = s.settle;
      for (let k = 0; k < nS; k++) M.since[p * nS + k] = s.since[k] === -1 ? -1 : s.holder === k ? -1e9 : (s.since[k] - st.tick) * HO().DT;
    }
    M.score.fill(0); M.t = 0; M.left = match.rules.length > 0 ? st.timeLeft : 1e9;
    return M;
  }

  // What this AI knows: its own groups exactly; rival groups (where they are, where they were sent, their
  // patience) as they were `react` seconds ago. A human sees a rival walking and can tell where it is going.
  function perceive(match, b) {
    const st = match.state;
    const out = [];
    const old = snapAt(b, st.t - b.P.react);
    for (const g of st.groups) {
      if (g.side === b.side || !old) {
        out.push({ x: g.x, z: g.z, coffee: g.coffee, backAt: g.backAt, patience: g.patience, dest: g.coffee ? -1 : g.spot,
          arrived: !g.moving, last: g.lastSpot, pending: g.pending && g.pending.spot >= 0 ? g.pending.spot : -1 });
        continue;
      }
      const a = old.g[g.id];
      out.push({ x: a.x, z: a.z, coffee: a.coffee, backAt: a.backAt, patience: a.patience, dest: a.coffee ? -1 : a.spot, arrived: !a.moving,
        last: a.last, pending: -1 });
    }
    return out;
  }

  function recordHistory(match, b) {
    const st = match.state;
    if (b.hist.length && st.t - b.hist[b.hist.length - 1].t < 0.25 - 1e-9) return;
    b.hist.push({ t: st.t, g: st.groups.map((g) => ({ x: g.x, z: g.z, coffee: g.coffee, backAt: g.backAt, patience: g.patience, last: g.lastSpot, spot: g.spot, moving: g.moving })) });
    while (b.hist.length > 2 && st.t - b.hist[1].t > b.P.react + 0.3) b.hist.shift();
  }
  function snapAt(b, t) {
    let best = null;
    for (const s of b.hist) { if (s.t <= t + 1e-9) best = s; else break; }
    return best || b.hist[0] || null;
  }

  // One model step. R (rules) are the match rules.
  function step(M, R, T, dt) {
    const nG = M.nG, nP = M.nP, nS = M.nS;
    for (let g = 0; g < nG; g++) {
      if (M.cof[g] > 0) {
        M.cof[g] -= dt;
        if (M.cof[g] <= 1e-9) {
          M.cof[g] = 0; M.pat[g] = R.patienceMax; M.orig[g] = ORIG_ENT;
          const d = M.pend[g] >= 0 ? M.pend[g] : (R.returnTo === 'last' ? M.last[g] : -1);
          M.pend[g] = -1; M.dest[g] = d;
          M.eta[g] = M.tot[g] = d >= 0 ? T.ent[g * nP + d] : 0;
          if (d >= 0) M.last[g] = d;
        }
      } else if (M.eta[g] > 0) M.eta[g] = Math.max(0, M.eta[g] - dt);
    }
    M.pres.fill(0);
    for (let g = 0; g < nG; g++) {
      M.at[g] = -1;
      if (M.cof[g] > 0 || M.dest[g] < 0 || M.eta[g] > IN_T) continue;
      M.at[g] = M.dest[g]; M.pres[M.dest[g] * nS + M.side[g]]++;
    }
    for (let i = 0; i < nP * nS; i++) {
      if (M.pres[i] > 0) { if (M.since[i] === -1) M.since[i] = M.holder[(i / nS) | 0] === i % nS ? -1e9 : M.t; } else M.since[i] = -1;
    }
    let anyOut = false;
    for (let g = 0; g < nG; g++) {
      if (M.cof[g] > 0) continue;
      const p = M.at[g];
      let rivals = 0;
      if (p >= 0) { let tot = 0; for (let k = 0; k < nS; k++) tot += M.pres[p * nS + k]; rivals = tot - M.pres[p * nS + M.side[g]]; }
      if (rivals > 0) {
        let dr = R.drainPerRival * rivals;
        if (R.settleDrains && M.holder[p] !== M.side[g]) dr *= 2;
        M.pat[g] -= dr * dt;
        if (M.pat[g] <= 1e-9) anyOut = true;
      } else if (M.pat[g] < R.patienceMax) M.pat[g] = Math.min(R.patienceMax, M.pat[g] + R.recoverRate * dt);
    }
    if (anyOut) {
      if (R.ties !== 'both') {
        // whoever was at the spot first stays when everyone there runs out together
        for (let p = 0; p < nP; p++) {
          let all = true, sides = 0, w = -1, bt = Infinity, tie = false;
          for (let k = 0; k < nS; k++) if (M.pres[p * nS + k] > 0) sides++;
          if (sides < 2) continue;
          for (let g = 0; g < nG; g++) if (M.at[g] === p && M.cof[g] <= 0 && M.pat[g] > 1e-9) { all = false; break; }
          if (!all) continue;
          let second = Infinity;
          for (let k = 0; k < nS; k++) {
            if (!M.pres[p * nS + k]) continue;
            const t = R.ties === 'holder' ? (M.holder[p] === k ? -1 : 0) : (M.holder[p] === k ? -1e12 : M.since[p * nS + k]);
            if (t < bt) { second = bt; bt = t; w = k; } else if (t < second) second = t;
          }
          tie = !(second - bt >= Math.max(R.ties === 'holder' ? 1 : (R.firstBy || 0), 1e-6));
          if (w >= 0 && !tie) for (let g = 0; g < nG; g++) if (M.at[g] === p && M.side[g] === w && M.cof[g] <= 0) M.pat[g] = 1;
        }
      }
      for (let g = 0; g < nG; g++) {
        if (M.cof[g] > 0 || M.at[g] < 0 || M.pat[g] > 1e-9) continue;
        const p = M.at[g];
        M.pres[p * nS + M.side[g]]--; M.at[g] = -1;
        M.cof[g] = R.breakTime; M.pat[g] = 0; M.dest[g] = -1; M.pend[g] = -1;
        if (R.evictBonus) for (let k = 0; k < nS; k++) if (k !== M.side[g] && M.pres[p * nS + k] > 0) M.score[k] += R.evictBonus;
      }
    }
    for (let p = 0; p < nP; p++) {
      const h = M.holder[p];
      if (h >= 0 && M.pres[p * nS + h] === 0) M.holder[p] = -1;
      if (M.holder[p] >= 0) { M.sset[p] = -1; M.settle[p] = 0; continue; }
      let sides = 0, a = -1;
      for (let k = 0; k < nS; k++) if (M.pres[p * nS + k] > 0) { sides++; a = k; }
      if (sides === 1) {
        if (M.sset[p] !== a) { M.sset[p] = a; M.settle[p] = 0; }
        let ready = false;
        for (let g = 0; g < nG; g++) if (M.at[g] === p && M.side[g] === a && M.eta[g] <= 0) { ready = true; break; }
        if (ready) { M.settle[p] += dt; if (M.settle[p] >= R.settleTime - 1e-9) { M.holder[p] = a; M.sset[p] = -1; M.settle[p] = 0; } }
      } else { M.sset[p] = -1; M.settle[p] = 0; }
    }
    for (let p = 0; p < nP; p++) if (M.holder[p] >= 0) M.score[M.holder[p]] += dt * R.pointsPerSecond;
    M.t += dt;
  }

  // Default behaviour inside the model: idle or doubled-up groups go to the best spot their crew lacks;
  // 'reactive' crews also send their nearest spare group to a spot where they are outnumbered.
  function policy(M, T, k, reactive, noReinforce) {
    const nG = M.nG, nP = M.nP, nS = M.nS;
    for (let g = 0; g < nG; g++) {
      if (M.side[g] !== k || M.cof[g] > 0) continue;
      let spare = M.dest[g] < 0;
      if (!spare && M.eta[g] <= 0 && M.holder[M.dest[g]] === k) {
        const p = M.dest[g];
        let rivals = 0; for (let q = 0; q < nS; q++) if (q !== k) rivals += M.pres[p * nS + q];
        if (rivals === 0) for (let h = 0; h < g; h++) if (M.side[h] === k && M.cof[h] <= 0 && M.dest[h] === p && M.eta[h] <= 0) { spare = true; break; }
      }
      if (!spare) continue;
      let best = -1, bv = Infinity;
      for (let c = 0; c < nP; c++) {
        if (M.holder[c] >= 0) continue;
        let busy = 0; for (let q = 0; q < nS; q++) if (q !== k) busy += M.pres[c * nS + q];
        if (busy) continue;
        let taken = false;
        for (let h = 0; h < nG; h++) if (h !== g && M.side[h] === k && (M.dest[h] === c || (M.cof[h] > 0 && M.pend[h] === c))) { taken = true; break; }
        if (taken) continue;
        const v = etaTo(M, T, g, c);
        if (v < bv) { bv = v; best = c; }
      }
      if (best >= 0) send(M, T, g, best);
    }
    if (!reactive) return;
    // outnumbered at a spot and somewhere is empty: walk over there instead of waiting for coffee (a swap)
    for (let g = 0; g < nG; g++) {
      if (M.side[g] !== k || M.cof[g] > 0 || M.at[g] < 0 || M.eta[g] > 0) continue;
      const p = M.at[g];
      let rivals = 0; for (let q = 0; q < nS; q++) if (q !== k) rivals += M.pres[p * nS + q];
      if (rivals <= M.pres[p * nS + k]) continue;
      let best = -1, bv = Infinity;
      for (let c = 0; c < nP; c++) {
        if (c === p || M.holder[c] >= 0) continue;
        let busy = 0; for (let q = 0; q < nS; q++) busy += M.pres[c * nS + q];
        if (busy) continue;
        const v = etaTo(M, T, g, c);
        if (v < bv) { bv = v; best = c; }
      }
      if (best >= 0 && bv < 30) send(M, T, g, best);
    }
    if (noReinforce) return;
    for (let p = 0; p < nP; p++) {
      const mine = M.pres[p * nS + k];
      if (!mine || (M.holder[p] !== k && M.sset[p] !== k)) continue;
      let rivals = 0; for (let q = 0; q < nS; q++) if (q !== k) rivals += M.pres[p * nS + q];
      if (rivals < mine) continue;
      let coming = 0;
      for (let h = 0; h < nG; h++) if (M.side[h] === k && M.dest[h] === p && M.at[h] !== p && M.cof[h] <= 0) coming++;
      if (mine + coming > rivals) continue;
      // nearest spare: not the only one of its crew holding somewhere else
      let best = -1, bv = Infinity;
      for (let g = 0; g < nG; g++) {
        if (M.side[g] !== k || M.cof[g] > 0 || M.dest[g] === p) continue;
        const d = M.dest[g];
        if (d >= 0 && M.eta[g] <= 0 && M.holder[d] === k && M.pres[d * nS + k] <= 1) continue;
        const v = etaTo(M, T, g, p);
        if (v < bv) { bv = v; best = g; }
      }
      if (best >= 0 && bv < 25) send(M, T, best, p);
    }
  }

  // ------------------------------------------------------------------ planning
  function simulate(match, b, plan, responder) {
    const R = match.rules, T = match.aiTables;
    const M = b.M || (b.M = new Model(b.M0.nG, b.M0.nP, b.M0.nS));
    M.copyFrom(b.M0);
    for (let i = 0; i < plan.length; i++) if (plan[i].opt !== STAY) send(M, T, plan[i].g, plan[i].opt);
    // Points earned from now until the horizon (normally the end of the match), all counted in full: a
    // discounted or short horizon makes "walk somewhere else first" look better than facing a cost now.
    const ends = M.left <= b.P.horizon;
    const H = ends ? M.left : b.P.horizon;
    const H0 = H;
    const steps = Math.max(1, Math.round(H / MDT));
    const reactive = responder === 'reactive';
    const nS = M.nS, me = b.side;
    let v = 0;
    for (let n = 0; n < steps; n++) {
      if (n % 2 === 1) {
        for (let k = 0; k < nS; k++) {
          if (k === me) policy(M, T, k, true, !!b.flags.noReinforce);
          else policy(M, T, k, reactive, false);
        }
      }
      let before = 0, beforeMe = M.score[me];
      for (let k = 0; k < nS; k++) if (k !== me) before += M.score[k];
      step(M, R, T, MDT);
      let after = 0;
      for (let k = 0; k < nS; k++) if (k !== me) after += M.score[k];
      v += (M.score[me] - beforeMe) - (after - before) / Math.max(1, nS - 1);
    }
    if (!ends) {
      // what the position at the horizon is worth for a little longer, and rested groups over tired ones
      const tail = Math.min(b.P.tail || 15, M.left - H);
      for (let p = 0; p < M.nP; p++) {
        const h = M.holder[p];
        if (h === me) v += tail * R.pointsPerSecond * 0.8;
        else if (h >= 0) v -= tail * R.pointsPerSecond * 0.8 / Math.max(1, nS - 1);
      }
      for (let g = 0; g < M.nG; g++) {
        const w = M.cof[g] > 0 ? -1.5 * M.cof[g] / R.breakTime : 1.5 * M.pat[g] / R.patienceMax;
        v += M.side[g] === me ? w : -w / Math.max(1, nS - 1);
      }
    }
    return v;
  }

  function value(match, b, plan) {
    const list = b.P.responders || ['static'];
    let sum = 0, min = Infinity;
    for (const r of list) { const v = simulate(match, b, plan, r); sum += v; if (v < min) min = v; }
    b.plansTried++;
    const avg = sum / list.length;
    return b.diff === 'hard' ? 0.5 * avg + 0.5 * min : avg;
  }

  // ------------------------------------------------------------------ the crew boss
  // Decisions are tactical rules a person would follow, in priority order, with commitment (a group that was
  // sent somewhere keeps going until it gets there or that spot changed hands):
  //   1. finish operations under way (two-against-one, rotations, help);
  //   2. defend: a spot of ours is losing an argument -> send help that arrives in time, else walk away
  //      (Normal/Hard) when the group would only go for coffee;
  //   3. fill: groups with nothing to do take the nearest empty spot nobody else will reach first (a spot that
  //      came free during the match only once the crew has noticed it: P.noticeFree);
  //   4. attack: the forward model scores "two against one", "one against a tired group" and "rotate"
  //      against carrying on; the best goes ahead if it beats carrying on by a margin.
  function opsOf(b, gid) { return b.ops.find((o) => o.groups.indexOf(gid) >= 0) || null; }

  function situation(match, b) {
    const st = match.state, Hn = HO(), me = b.side;
    const per = perceive(match, b);
    const spots = st.spots.map((s) => ({ s, idx: s.idx, holder: s.holder, mine: [], rivals: [], comingMine: [], comingRivals: [] }));
    st.groups.forEach((g, i) => {
      const q = per[i];
      if (q.coffee || q.dest < 0) return;
      const sp = spots[q.dest];
      const here = Hn.inSpot(sp.s, q.x, q.z);
      if (g.side === me) (here ? sp.mine : sp.comingMine).push(i); else (here ? sp.rivals : sp.comingRivals).push(i);
    });
    return { st, per, spots, used: new Set() };
  }

  /** Who wins an argument: my groups' and their groups' patience, everyone drains the same per rival. */
  function fight(R, mine, theirs, tie) {
    const a = mine.slice(), c = theirs.slice();
    let t = 0;
    while (a.length && c.length && t < 120) {
      const da = R.drainPerRival * c.length, dc = R.drainPerRival * a.length;
      const ta = Math.min(...a) / da, tc = Math.min(...c) / dc;
      const dt = Math.min(ta, tc);
      t += dt;
      for (let i = 0; i < a.length; i++) a[i] -= da * dt;
      for (let i = 0; i < c.length; i++) c[i] -= dc * dt;
      const outA = a.filter((x) => x <= 1e-6).length, outC = c.filter((x) => x <= 1e-6).length;
      if (outA && outC && outA === a.length && outC === c.length) return { win: tie, t, left: 0 };
      for (let i = a.length - 1; i >= 0; i--) if (a[i] <= 1e-6) a.splice(i, 1);
      for (let i = c.length - 1; i >= 0; i--) if (c[i] <= 1e-6) c.splice(i, 1);
    }
    return a.length ? { win: 'me', t, left: Math.min(...a) } : { win: 'them', t, left: c.length ? Math.min(...c) : 0 };
  }

  /** Who stays when everybody at spot `spot` runs out together: 'me' | 'them' | 'none' (everyone leaves). */
  function tieTo(match, spot, me, rivalSides) {
    const R = match.rules;
    if (R.ties === 'both') return 'none';
    if (R.ties === 'holder') return spot.holder === me ? 'me' : spot.holder >= 0 && rivalSides.indexOf(spot.holder) >= 0 ? 'them' : 'none';
    if (firstHere(spot, me, rivalSides, R.firstBy)) return 'me';
    return rivalSides.some((k) => firstHere(spot, k, [me], R.firstBy)) ? 'them' : 'none';
  }

  /** Was my crew at this spot before every rival crew there (so it would win a tie)? */
  function firstHere(spot, me, rivalSides, firstBy) {
    if (spot.holder === me) return true;
    if (spot.holder >= 0) return false;
    const mine = spot.since[me];
    if (mine < 0) return false;
    const gap = Math.round((firstBy || 0) / HO().DT);
    return rivalSides.every((k) => spot.since[k] < 0 || spot.since[k] - mine >= Math.max(1, gap));
  }

  function myGroups(match, b) { return match.state.groups.filter((g) => g.side === b.side); }
  function etaOf(match, g, si) { return HO().eta(match, g, si); }
  function patAt(R, p, t) { return Math.min(R.patienceMax, p + R.recoverRate * t); }

  /** A group with nothing useful to do: standing around, or doubled up at a spot we hold with nobody arguing. */
  function isSpare(match, b, S, g) {
    if (g.coffee || opsOf(b, g.id) || S.used.has(g.id)) return false;
    if (g.moving && g.spot >= 0) {
      // committed to a walk, unless we already hold that spot with someone else there and nobody to argue with
      const sp = S.spots[g.spot];
      return sp.holder === b.side && sp.mine.length > 0 && !sp.rivals.length && !sp.comingRivals.length;
    }
    if (g.at < 0) return true;
    const sp = S.spots[g.at];
    if (sp.rivals.length) return false;
    const mates = sp.mine.filter((id) => id !== g.id);
    return sp.holder === b.side && mates.length > 0 && mates.some((id) => id < g.id || match.state.groups[id].patience > g.patience);
  }

  function order(match, b, S, g, si, why) {
    if (S.used.has(g.id)) return false;
    const r = match.order(b.side, g.id, match.state.spots[si].id);
    if (r.ok) { S.used.add(g.id); b.sent[g.id] = { spot: si, holder: match.state.spots[si].holder, why, t: match.state.t }; b.orders++; }
    return r.ok;
  }

  // ---- 1. operations
  function stepOps(match, b, S) {
    const st = match.state;
    b.ops = b.ops.filter((op) => {
      const T = op.target, sp = st.spots[T];
      const gs = op.groups.map((id) => st.groups[id]);
      if (st.t - op.t0 > 75) return false;
      if (op.kind === 'pair') {
        const [F, X] = gs;
        if (op.phase === 0) {
          if (X.coffee) return false;
          const eF = F.coffee ? Math.max(0, F.backAt - st.t) + match.aiTables.ent[F.id * match.aiTables.nP + T] : etaOf(match, F, T);
          if (etaOf(match, X, T) >= eF - 1) { order(match, b, S, X, T, 'pair'); op.phase = 1; }
          else S.used.add(X.id);
          S.used.add(F.id);
          return true;
        }
        if (sp.holder === b.side) {
          // won: the more tired one goes back to the spot it left (or anywhere useful)
          const atT = gs.filter((g) => !g.coffee && g.spot === T);
          if (atT.length === 2) {
            const tired = atT[0].patience <= atT[1].patience ? atT[0] : atT[1];
            const back = op.home >= 0 && st.spots[op.home].holder !== b.side ? op.home : bestEmpty(match, b, S, tired);
            if (back >= 0) order(match, b, S, tired, back, 'back');
          }
          for (const g of gs) if (g.coffee && op.home >= 0) match.order(b.side, g.id, st.spots[op.home].id);
          return false;
        }
        if (gs.every((g) => g.coffee) || (!op.coffeeF && gs.some((g) => g.coffee))) {
          // lost: whoever is left goes back where it came from
          for (const g of gs) if (!g.coffee && op.home >= 0 && g.spot === T) order(match, b, S, g, op.home, 'back');
          return false;
        }
        for (const g of gs) S.used.add(g.id);
        return true;
      }
      if (op.kind === 'help') {
        const [G] = gs;
        const spS = S.spots[T];
        if (G.coffee) return false;
        if (G.at === T && !spS.rivals.length) {
          if (op.home >= 0 && st.spots[op.home].holder !== b.side) order(match, b, S, G, op.home, 'home');
          return false;
        }
        S.used.add(G.id);
        return true;
      }
      if (op.kind === 'rotate') {
        const [A, B] = gs;
        if (sp.holder === b.side) {
          const atT = gs.filter((g) => !g.coffee && g.spot === T);
          if (atT.length === 2) { const tired = atT[0].patience <= atT[1].patience ? atT[0] : atT[1]; if (op.home >= 0) order(match, b, S, tired, op.home, 'back'); }
          for (const g of gs) if (g.coffee && op.home >= 0) match.order(b.side, g.id, st.spots[op.home].id);
          return false;
        }
        if (op.phase === 0 && ((A.at === T && A.patience < 45) || A.coffee)) { if (!B.coffee) order(match, b, S, B, T, 'rotate'); op.phase = 1; }
        if (op.phase === 1) {
          if (A.coffee && !A.pending && op.home >= 0) match.order(b.side, A.id, st.spots[op.home].id);
          else if (!A.coffee && A.spot === T && B.at === T && op.home >= 0) order(match, b, S, A, op.home, 'rest');
          if (B.coffee) return false;
        }
        for (const g of gs) S.used.add(g.id);
        return true;
      }
      return false;
    });
  }

  // P.noticeFree (Easy): a spot that comes free during the match counts as empty only once it has been free this
  // many seconds (spots already free at the crew's first look count at once). A slow crew doesn't see at once that a
  // rival walked off a spot, so it doesn't pounce on every spot a newcomer leaves to help a friend.
  function noteFree(match, b, S) {
    if (!b.P.noticeFree) return;
    const first = !b.freeSince;
    const since = b.freeSince || (b.freeSince = []);
    for (const sp of S.spots) {
      if (sp.holder >= 0 || sp.rivals.length || sp.mine.length) since[sp.idx] = null;
      else if (since[sp.idx] === null || since[sp.idx] === undefined) since[sp.idx] = first ? -Infinity : match.state.t;
    }
  }
  function noticedFree(match, b, idx) {
    if (!b.P.noticeFree) return true;
    const t0 = b.freeSince ? b.freeSince[idx] : null;
    return t0 !== null && t0 !== undefined && match.state.t - t0 >= b.P.noticeFree;
  }

  function bestEmpty(match, b, S, g) {
    let best = -1, bv = Infinity;
    for (const sp of S.spots) {
      if (sp.holder >= 0 || sp.rivals.length || sp.mine.length || !noticedFree(match, b, sp.idx)) continue;
      if (match.state.groups.some((q) => q.side === b.side && q.id !== g.id && (q.spot === sp.idx || (q.coffee && q.pending && q.pending.spot === sp.idx)))) continue;
      const e = etaOf(match, g, sp.idx);
      // someone of theirs gets there clearly first: not empty for long
      if (sp.comingRivals.some((id) => HO().walkTime(match, S.per[id].x, S.per[id].z, sp.idx, match.state.groups[id].side, match.state.groups[id].slot) < e - 2)) continue;
      if (e < bv) { bv = e; best = sp.idx; }
    }
    return best;
  }

  // ---- 2. defend
  function defend(match, b, S) {
    const st = match.state, R = match.rules, P = b.P;
    for (const sp of S.spots) {
      if (!sp.mine.length || !(sp.rivals.length || sp.comingRivals.length)) continue;
      const mineG = sp.mine.map((id) => st.groups[id]);
      if (mineG.some((g) => opsOf(b, g.id) && opsOf(b, g.id).kind !== 'help')) continue;   // an attack of ours: the op decides
      const rivalSides = sp.rivals.concat(sp.comingRivals).map((id) => st.groups[id].side);
      const tie = tieTo(match, st.spots[sp.idx], b.side, rivalSides);
      const iHold = tie === 'me';
      const theirs = sp.rivals.map((id) => S.per[id].patience).concat(sp.comingRivals.filter((id) => {
        const q = S.per[id], g = st.groups[id];
        return HO().walkTime(match, q.x, q.z, sp.idx, g.side, g.slot) < 6;
      }).map((id) => S.per[id].patience));
      if (!theirs.length) continue;
      const out = fight(R, mineG.map((g) => g.patience), theirs, tie);
      if (out.win === 'me') continue;
      // a dead heat at a spot nobody holds (both got there together): stay - walking away hands it over
      if (tie === 'none' && theirs.length <= mineG.length) continue;
      // help that gets there in time and turns it around
      if (P.help) {
        let best = null, bt = Infinity;
        for (const g of myGroups(match, b)) {
          if (g.coffee || sp.mine.indexOf(g.id) >= 0 || S.used.has(g.id) || opsOf(b, g.id)) continue;
          const spare = isSpare(match, b, S, g);
          const holderOk = P.help === 'holders' && g.at >= 0 && st.spots[g.at].holder === b.side && !S.spots[g.at].rivals.length && !S.spots[g.at].comingRivals.length;
          if (!spare && !holderOk) continue;
          const e = etaOf(match, g, sp.idx);
          if (e >= out.t - 0.5) continue;
          const at = mineG.map((q) => Math.max(0.1, q.patience - R.drainPerRival * theirs.length * e));
          const with2 = fight(R, at.concat([patAt(R, g.patience, e)]), theirs.map((x) => Math.max(0.1, x - R.drainPerRival * mineG.length * e)), tie);
          if (with2.win !== 'me') continue;
          const cost = e + (holderOk ? 20 : 0);
          if (cost < bt) { bt = cost; best = g; }
        }
        if (best) {
          const home = best.at >= 0 && !isSpare(match, b, S, best) ? best.at : -1;
          if (order(match, b, S, best, sp.idx, 'help')) { b.ops.push({ kind: 'help', groups: [best.id], target: sp.idx, home, t0: st.t }); continue; }
        }
      }
      // walk away: only when staying just ends in coffee and there is somewhere better to be
      if (!P.walkAway) continue;
      for (const g of mineG) {
        if (S.used.has(g.id)) continue;
        const left = g.patience / (R.drainPerRival * theirs.length);
        const outnumbered = theirs.length > mineG.length;
        if (iHold && !(outnumbered && P.walkAway === 'swap') && left > (P.walkAwayAt || 4)) continue;   // holders earn while they can
        const dest = bestEmpty(match, b, S, g);
        const from = b.sent[g.id] && b.sent[g.id].from >= 0 ? b.sent[g.id].from : -1;
        const back = !iHold && from >= 0 && from !== sp.idx && !S.spots[from].rivals.length && st.spots[from].holder !== -9 ? from : -1;
        const to = dest >= 0 ? dest : back;
        if (to >= 0 && to !== sp.idx) order(match, b, S, g, to, 'walkAway');
      }
    }
  }

  // ---- 3. fill
  function fill(match, b, S) {
    const spares = myGroups(match, b).filter((g) => !g.coffee && isSpare(match, b, S, g));
    if (!spares.length) return;
    // candidate empty spots per group (bestEmpty's rules), then the assignment with the least total walking
    const cand = spares.map((g) => S.spots.filter((sp) => emptyFor(match, b, S, g, sp.idx)).map((sp) => sp.idx));
    let best = null, bv = Infinity;
    const pick = new Array(spares.length).fill(-1);
    (function rec(i, used, cost) {
      if (i === spares.length) {
        const n = pick.filter((x) => x >= 0).length;
        const v = cost - n * 1000;
        if (v < bv) { bv = v; best = pick.slice(); }
        return;
      }
      for (const c of cand[i]) {
        if (used.has(c)) continue;
        used.add(c); pick[i] = c;
        rec(i + 1, used, cost + etaOf(match, spares[i], c));
        used.delete(c);
      }
      pick[i] = -1;
      rec(i + 1, used, cost);
    })(0, new Set(), 0);
    if (!best) return;
    spares.forEach((g, i) => { if (best[i] >= 0) order(match, b, S, g, best[i], 'fill'); });
  }

  function emptyFor(match, b, S, g, idx) {
    const sp = S.spots[idx];
    if (sp.holder >= 0 || sp.rivals.length || sp.mine.length || !noticedFree(match, b, idx)) return false;
    if (match.state.groups.some((q) => q.side === b.side && q.id !== g.id && (q.spot === idx || (q.coffee && q.pending && q.pending.spot === idx)))) return false;
    const e = etaOf(match, g, idx);
    return !sp.comingRivals.some((id) => HO().walkTime(match, S.per[id].x, S.per[id].z, idx, match.state.groups[id].side, match.state.groups[id].slot) < e - 2);
  }

  /**
   * An argument played out: groups { p: patience now, t: s until it arrives (0 = there), me: bool };
   * tie: who stays if everybody runs out together ('me'|'them'|'none'). Returns { win: 'me'|'them'|'none', t }.
   */
  function simFight(R, groups, tie) {
    const g = groups.map((q) => ({ p: q.p, t: q.t, me: q.me, out: false }));
    for (let t = 0; t < 90; t += 0.1) {
      let nm = 0, nt = 0;
      for (const q of g) if (!q.out && q.t <= t) { if (q.me) nm++; else nt++; }
      const anyMeLeft = g.some((q) => q.me && !q.out), anyThemLeft = g.some((q) => !q.me && !q.out);
      if (!anyMeLeft) return { win: 'them', t };
      if (!anyThemLeft) return { win: 'me', t };
      for (const q of g) {
        if (q.out) continue;
        if (q.t > t) { q.p = Math.min(R.patienceMax, q.p + R.recoverRate * 0.1); continue; }
        const rivals = q.me ? nt : nm;
        if (rivals) q.p -= R.drainPerRival * rivals * 0.1; else q.p = Math.min(R.patienceMax, q.p + R.recoverRate * 0.1);
      }
      const outM = g.filter((q) => q.me && !q.out && q.p <= 0), outT = g.filter((q) => !q.me && !q.out && q.p <= 0);
      const presentM = g.filter((q) => q.me && !q.out && q.t <= t).length, presentT = g.filter((q) => !q.me && !q.out && q.t <= t).length;
      if (outM.length && outT.length && outM.length === presentM && outT.length === presentT && tie !== 'none') {
        for (const q of tie === 'me' ? outT : outM) q.out = true;
        for (const q of tie === 'me' ? outM : outT) q.p = 1;
        continue;
      }
      for (const q of outM.concat(outT)) q.out = true;
    }
    return { win: 'none', t: 90 };
  }

  // A group free for a new job: spare, on a coffee break with nothing better to do, or walking back into a
  // fight it can't win alone. Holders may be pulled off their spot when P.pull allows it.
  function availability(match, b, S, g) {
    const st = match.state, R = match.rules;
    if (S.used.has(g.id) || opsOf(b, g.id)) return null;
    if (g.coffee) return { g, kind: 'coffee', delay: Math.max(0, g.backAt - st.t) };
    if (isSpare(match, b, S, g)) return { g, kind: 'spare', delay: 0 };
    if (g.moving && g.spot >= 0 && !g.arguing) {
      const sp = S.spots[g.spot];
      if (sp.holder >= 0 && sp.holder !== b.side && sp.rivals.length) {
        const f = simFight(R, [{ p: g.patience, t: etaOf(match, g, g.spot), me: true }].concat(sp.rivals.map((id) => ({ p: S.per[id].patience, t: 0, me: false }))),
          tieTo(match, st.spots[g.spot], b.side, sp.rivals.map((id) => st.groups[id].side)));
        if (f.win !== 'me') return { g, kind: 'lost', delay: 0 };
      }
      return null;
    }
    if (g.at >= 0 && !g.arguing && st.spots[g.at].holder === b.side && !S.spots[g.at].comingRivals.length) return { g, kind: 'holder', delay: 0 };
    return null;
  }

  function etaFor(match, a, T) {
    if (a.kind === 'coffee') {
      const T0 = match.aiTables;
      return a.delay + T0.ent[a.g.id * T0.nP + T];
    }
    return etaOf(match, a.g, T);
  }

  // ---- 4. attack
  function attack(match, b, S) {
    const st = match.state, R = match.rules, P = b.P;
    if (!P.attack || st.t < (b.nextAttack || 0)) return;
    if (b.ops.some((o) => o.kind === 'pair' || o.kind === 'rotate')) return;
    const av = myGroups(match, b).map((g) => availability(match, b, S, g)).filter(Boolean);
    const free = av.filter((a) => a.kind !== 'holder');
    const holders = P.pull === 'always' || (P.pull === 'behind' && behindBy(st, b.side) > 5) ? av.filter((a) => a.kind === 'holder') : [];
    if (!free.length) { returnSensibly(match, b, S); return; }
    const cands = [];
    for (const sp of S.spots) {
      if (sp.holder === b.side || !sp.rivals.length) continue;
      const T = sp.idx;
      const def = sp.rivals.map((id) => ({ p: S.per[id].patience, t: 0, me: false }));
      const already = sp.mine.map((id) => ({ p: st.groups[id].patience, t: 0, me: true }));
      const iFirst = tieTo(match, st.spots[T], b.side, sp.rivals.map((id) => st.groups[id].side));
      for (const F of free) {
        const eF = etaFor(match, F, T);
        if (eF > 45) continue;
        const one = simFight(R, already.concat([{ p: F.kind === 'coffee' ? R.patienceMax : F.g.patience, t: eF, me: true }]).concat(def), iFirst);
        if (one.win === 'me') cands.push({ T, gs: [F], t: eF });
        if (!P.pairs) continue;
        for (const X of free.concat(holders)) {
          if (X.g.id === F.g.id) continue;
          const eX = etaFor(match, X, T);
          if (eX > 45) continue;
          const tA = Math.max(eF, eX);
          const two = simFight(R, already.concat([{ p: F.kind === 'coffee' ? R.patienceMax : F.g.patience, t: tA, me: true },
            { p: X.kind === 'coffee' ? R.patienceMax : X.g.patience, t: tA, me: true }]).concat(def), iFirst);
          if (two.win === 'me') cands.push({ T, gs: [F, X], t: tA });
        }
      }
    }
    if (!cands.length) { returnSensibly(match, b, S); return; }
    buildModel(match, b);
    const stay = myGroups(match, b).map((g) => ({ g: g.id, opt: STAY }));
    const base = value(match, b, stay);
    let best = null, bv = base + (P.margin || 3);
    const seen = new Set();
    for (const c of cands) {
      const key = c.T + ':' + c.gs.map((a) => a.g.id).sort().join('.');
      if (seen.has(key)) continue;
      seen.add(key);
      const plan = stay.map((p) => ({ g: p.g, opt: c.gs.some((a) => a.g.id === p.g) ? c.T : STAY }));
      const v = value(match, b, plan) + (P.noise ? (b.rng() - 0.5) * 2 * P.noise : 0);
      if (v > bv) { bv = v; best = c; }
    }
    b.last = { t: st.t, base, best: bv, cand: cands.length, pick: best ? best.gs.length + '@' + best.T : null };
    if (!best) { returnSensibly(match, b, S); return; }
    b.nextAttack = st.t + (P.attackEvery || 0);
    const T = best.T;
    const home = best.gs.find((a) => a.kind === 'holder');
    for (const a of best.gs) {
      if (a.kind === 'coffee') { match.order(b.side, a.g.id, st.spots[T].id); S.used.add(a.g.id); continue; }
      if (a.kind === 'holder' && best.gs.length === 2) continue;   // leaves later, to arrive together
      const from = a.g.at;
      if (order(match, b, S, a.g, T, 'attack')) b.sent[a.g.id].from = from;
    }
    if (best.gs.length === 2) {
      const [F, X] = home ? [best.gs.find((a) => a !== home), home] : best.gs;
      const op = { kind: 'pair', groups: [F.g.id, X.g.id], target: T, home: home ? home.g.at : -1, phase: home ? 0 : 1, t0: st.t, coffeeF: F.kind === 'coffee' };
      if (home && etaFor(match, X, T) >= etaFor(match, F, T) - 1) { order(match, b, S, X.g, T, 'attack'); op.phase = 1; }
      b.ops.push(op);
    }
  }

  function behindBy(st, me) {
    return Math.max(...st.sides.filter((x) => x.idx !== me).map((x) => x.score)) - st.sides[me].score;
  }

  // Back from coffee (or about to be) into a fight it would lose alone: go somewhere useful instead.
  function returnSensibly(match, b, S) {
    if (!b.P.smartReturn) return;
    const st = match.state, R = match.rules;
    for (const g of myGroups(match, b)) {
      if (S.used.has(g.id) || opsOf(b, g.id)) continue;
      if (g.coffee && b.rerouted[g.id] === g.backAt) continue;      // one change of plan per coffee break
      const d = g.coffee ? (g.pending ? g.pending.spot : g.lastSpot) : (g.moving ? g.spot : -1);
      if (d < 0) continue;
      const sp = S.spots[d];
      let lost = sp.holder === b.side && sp.mine.length && !sp.rivals.length;   // already ours: no need
      if (!lost && sp.rivals.length && sp.holder !== b.side) {
        const e = g.coffee ? Math.max(0, g.backAt - st.t) + match.aiTables.ent[g.id * match.aiTables.nP + d] : etaOf(match, g, d);
        const f = simFight(R, [{ p: g.coffee ? R.patienceMax : g.patience, t: e, me: true }].concat(sp.rivals.map((id) => ({ p: S.per[id].patience, t: 0, me: false }))),
          tieTo(match, st.spots[d], b.side, sp.rivals.map((id) => st.groups[id].side)));
        lost = f.win === 'them';
      }
      if (!lost) continue;
      let to = bestEmpty(match, b, S, g);
      if (to < 0) {
        // nowhere empty: wait at our nearest spot, ready for the next two-against-one
        let bv = Infinity;
        for (const q of S.spots) if (q.holder === b.side && !q.rivals.length) { const e = etaOf(match, g, q.idx); if (e < bv) { bv = e; to = q.idx; } }
      }
      if (to >= 0 && to !== d) {
        match.order(b.side, g.id, st.spots[to].id); S.used.add(g.id);
        if (g.coffee) b.rerouted[g.id] = g.backAt;
      }
    }
  }

  function decide(match, b) {
    const S = situation(match, b);
    b.decisions++;
    noteFree(match, b, S);
    stepOps(match, b, S);
    defend(match, b, S);
    fill(match, b, S);
    attack(match, b, S);
  }

  function runScript(match, b) {
    const sc = b.flags.script;
    if (!sc) return;
    const st = match.state;
    sc.forEach((e, i) => {
      if (b.scriptDone[i] || st.t < e.at) return;
      b.scriptDone[i] = true;
      const g = st.groups.find((q) => q.side === b.side && q.slot === e.group);
      if (g) match.order(b.side, g.id, e.to);
    });
  }

  function tick(match, dt) {
    if (!match.ai) init(match);
    const st = match.state;
    // everybody's memory of the park is taken before anybody acts this tick (no side sees the other's
    // orders a tick early)
    for (const b of match.ai) if (b) recordHistory(match, b);
    for (const b of match.ai) {
      if (!b) continue;
      runScript(match, b);
      if (b.flags.noReturn) {
        for (const g of st.groups) if (g.side === b.side && g.coffee && !g.pending) match.order(b.side, g.id, 'entrance');
      }
      if (b.flags.passive || st.t + 1e-9 < (b.P.lazyStart || 0) || st.t + 1e-9 < b.nextThink) continue;
      b.nextThink = st.t + b.P.think * (0.7 + 0.6 * b.rng());
      decide(match, b);
    }
  }

  SQ.HangoutAI = { init, tick, Model, step, policy, buildTables, buildModel, simulate, perceive, fight };
})(window.SQ = window.SQ || {});
