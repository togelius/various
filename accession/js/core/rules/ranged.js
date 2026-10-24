// ACCESSION — lines, bolts and beams (BUILD.md §8.1, §8.3). W0d builds the geometry of a line
// and of a beam; W1-ARCH-B owns the file after, and builds shots (the kiter's, the
// Pin-Driver's) and reflectors (the reflector archetype, and bodies with the glass modifier).
//
// A bolt (a shot) passes what can be seen through and is not glass (Grid.bolt); only beams
// pass glass. A beam stops at what blocks sight: a tile that cannot be seen through, or one a
// sight-blocking surface (a Fumigant cloud, plaster dust) covers (Grid.clear). A beam's tiles
// are fixed when it is marked, so a cloud laid while it is shown does not cut it. A reflector
// sends a bolt or beam back along its line toward where it came from, so nothing behind the
// reflector is hit, and the shooter's own tile is on the way back: a beam goes on past it,
// as far as its range allows (the way back counts), while a bolt hits the first actor it
// meets coming back, which is its shooter.
'use strict';
const Ranged = (() => {
  // The tiles of the Bresenham line between two tiles, both ends included, traced as
  // Grid.los traces it (from the end that comes first in row-major order), so that a line
  // and line of sight cross the same tiles; listed from (x0, y0).
  function bresenham(x0, y0, x1, y1) {
    const flip = y1 < y0 || (y1 === y0 && x1 < x0);
    let ax = x0, ay = y0, bx = x1, by = y1;
    if (flip) { ax = x1; ay = y1; bx = x0; by = y0; }
    const dx = Math.abs(bx - ax), dy = Math.abs(by - ay), sx = bx > ax ? 1 : -1, sy = by > ay ? 1 : -1, out = [];
    let err = dx - dy, x = ax, y = ay;
    for (;;) {
      out.push([x, y]);
      if (x === bx && y === by) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
    return flip ? out.reverse() : out;
  }

  // Ranged.line(state, x0, y0, x1, y1, range, pass) → [[x, y]…]: the tiles a line from (x0, y0)
  // toward (x1, y1) enters, in order, up to and including (x1, y1), at most `range` of them,
  // stopping before the first tile pass(m, x, y) refuses (Grid.seeThrough if pass is not
  // given; Grid.bolt for a shot, which stops at glass). The tile it starts on is not listed.
  // It looks at tiles only, not surfaces: a shot is made only with line of sight (Grid.los,
  // which surfaces block), so a bolt never needs to cross a cloud.
  function line(state, x0, y0, x1, y1, range, pass) {
    const m = state.dept, ok = pass || Grid.seeThrough, out = [];
    const pts = bresenham(x0, y0, x1, y1);
    for (let i = 1; i < pts.length && out.length < range; i++) {
      const [x, y] = pts[i];
      if (!Grid.inside(m, x, y) || !ok(m, x, y)) break;
      out.push([x, y]);
    }
    return out;
  }

  // The path of a beam from a's tile in direction d, at most `range` steps: it goes straight,
  // through glass, and stops before a tile sight cannot pass (Grid.clear: one it cannot see
  // through, or one a Fumigant cloud or plaster dust covers). On a tile where
  // Ranged.reflectorAt holds it turns back the way it came, and its later steps still count
  // toward the range. Each tile is listed once, at the first step that enters it, with the
  // tile that step came from, so the way back lists only the tiles the way out did not: the
  // shooter's own tile, then those behind it.
  function trace(state, a, d, range) {
    if (!(Number.isInteger(d) && d >= 0 && d < 8)) throw new Error('Ranged.beam: no direction ' + d);
    const m = state.dept, crossed = new Uint8Array(m.w * m.h), tiles = [], from = [];
    let x = a.x, y = a.y, dx = Grid.DX[d], dy = Grid.DY[d];
    for (let s = 0; s < range; s++) {
      const nx = x + dx, ny = y + dy;
      if (!Grid.clear(m, nx, ny)) break;
      const i = ny * m.w + nx;
      if (!crossed[i]) { crossed[i] = 1; tiles.push([nx, ny]); from.push([x, y]); }
      x = nx; y = ny;
      if (Ranged.reflectorAt(state, x, y)) { dx = -dx; dy = -dy; }
    }
    return { tiles, from };
  }

  // Ranged.beam(state, a, d, range) → [[x, y]…]: the tiles of a's beam in direction d, in the
  // order it crosses them, each once (trace, above).
  const beam = (state, a, d, range) => trace(state, a, d, range).tiles;
  // Ranged.beamFrom(state, a, d, range) → [[x, y]…]: for each tile of beam(…), at the same
  // index, the tile the beam entered it from (where its damage comes from, §8.1).
  const beamFrom = (state, a, d, range) => trace(state, a, d, range).from;

  // Ranged.isReflector(state, a) → bool: does a send bolts and beams back along their line?
  // A reflector does, and so does a body with the glass modifier (§5.5), unless glass is
  // switched off for the visit (rulesOff). Gone actors reflect nothing.
  const isReflector = (state, a) => !!a && !a.gone && (a.arch === 'reflector' || (a.mods.includes('glass') && !Options.off(state, 'glass')));
  // Ranged.reflectorAt(state, x, y) → uid | null: the reflector standing on (x, y), if any.
  // A beam turns back on its tile (Ranged.beam), and so does a bolt (Ranged.flight).
  function reflectorAt(state, x, y) {
    const a = Actors.at(state, x, y);
    return a && isReflector(state, a) ? a.uid : null;
  }

  // The most tiles away a shot of att's may be aimed: how.max if given, else the Pin-Driver's
  // range for you (PIN_DRIVER[2]; you shoot only with it) and ROLE_ARTILLERY_RANGE for an
  // exhibit (the kiter's).
  const maxRange = (att, how) => how && Number.isInteger(how.max) ? how.max : att.uid === 'you' ? N.PIN_DRIVER[2] : N.ROLE_ARTILLERY_RANGE;

  // Ranged.flight(state, att, x, y, range) → {code, tiles, at, dist, victim, reflector, via, viaOut}:
  // where a bolt att shoots toward (x, y) goes, changing nothing. It is refused (code) as a
  // shot would be, in this order: no_target for a tile outside the map or under att;
  // behind_glass when att stands in an intact case (a bolt never passes glass); out_of_reach
  // beyond `range` tiles (Chebyshev, as the line counts them); blocked without line of sight
  // (Grid.los). Then the bolt flies along the line toward (x, y), tile by tile, up to the
  // target and no further:
  //   - a tile it cannot pass (Grid.bolt) stops it: behind_glass if that tile is glass (so a
  //     case, an exhibit in one and a mimic's disguise all look the same), else no_target;
  //   - the first actor it meets (`at`, `dist` tiles from att) is hit (`victim`), unless it is
  //     a reflector (`reflector`): then the bolt comes back along the tiles it came by, which
  //     held no actor, and hits the first actor on them, which is att itself. A bolt comes
  //     back at most once, and its way back is not limited by its range;
  //   - reaching the target with no actor met is no_target.
  // tiles lists the tiles the bolt crossed, in order, each once (on a way back only att's own
  // tile is new); via is the last tile it crossed before the victim (where its damage comes
  // from, §8.1), and viaOut the last before `at`.
  function flight(state, att, x, y, range) {
    const m = state.dept, out = { code: null, tiles: [], at: null, dist: 0, victim: null, reflector: null, via: null, viaOut: null };
    const no = code => ({ code, tiles: [], at: null, dist: 0, victim: null, reflector: null, via: null, viaOut: null });
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Grid.inside(m, x, y) || Actors.covers(att, x, y)) return no('no_target');
    if (Cases.encased(state, att)) return no('behind_glass');
    if (Actors.dist(att, x, y) > range) return no('out_of_reach');
    if (!Grid.los(m, att.x, att.y, x, y)) return no('blocked');
    const pts = bresenham(att.x, att.y, x, y), path = [[att.x, att.y]];
    for (let i = 1; i < pts.length; i++) {
      const [tx, ty] = pts[i];
      if (!Grid.bolt(m, tx, ty)) return no(Grid.seeThrough(m, tx, ty) ? 'behind_glass' : 'no_target');
      path.push([tx, ty]);
      out.tiles.push([tx, ty]);
      const b = Actors.at(state, tx, ty, att);
      if (!b) continue;
      out.at = b.uid;
      out.dist = Actors.dist(att, tx, ty);
      out.viaOut = path[path.length - 2].slice();
      if (!Ranged.reflectorAt(state, tx, ty)) { out.victim = b.uid; out.via = out.viaOut.slice(); return out; }
      out.reflector = b.uid;
      for (let j = path.length - 2; j >= 0; j--) {
        const [bx, by] = path[j], c = Actors.at(state, bx, by, b);
        if (j === 0) out.tiles.push([bx, by]);
        if (c) { out.victim = c.uid; out.via = path[j + 1].slice(); return out; }
      }
      out.victim = att.uid; out.via = path[1].slice();
      return out;
    }
    return no('no_target');
  }

  // Ranged.canShoot(state, att, x, y, how) → null | code: may att shoot toward (x, y) now?
  // (Ranged.flight's refusals, at the range maxRange gives.) It changes nothing.
  const canShoot = (state, att, x, y, how) => flight(state, att, x, y, maxRange(att, how)).code;

  // A bolt a reflector sent back at victim (§8.1): rolled as any shot is, on the shooter's
  // own combat stream, with the shooter's Acc (or how.acc) against the victim's Eva and its
  // damage range (or how.dmin, how.dmax), never a surprise. Its cause is the reflector's,
  // {k: 'reflected', by: the reflector, shooter, chance, roll, how, range, raw, pad, floor?,
  // from}, so a death by your own bolt sent back is told from the reflector's story.
  function sendBack(state, att, refl, victim, h, f, ev) {
    const rng = Rng.stream(state, 'combat/' + att.uid);
    const chance = Combat.hitChance(att, victim, h), roll = rng.d100();
    const cause = { k: 'reflected', by: refl.uid, shooter: att.uid, chance, roll, how: h, range: f.dist };
    if (roll > chance) { Causes.emit(state, ev, 'missed', { by: refl.uid, at: victim.uid }, cause); return; }
    const dmin = h.dmin !== undefined ? h.dmin : att.dmin, dmax = h.dmax !== undefined ? h.dmax : att.dmax;
    const raw = rng.int(dmin, dmax);
    let amount = raw - victim.pad;
    if (amount < N.DMG_MIN_ON_HIT) { cause.floor = N.DMG_MIN_ON_HIT; amount = N.DMG_MIN_ON_HIT; }
    Object.assign(cause, { raw, pad: victim.pad, from: f.via.slice() });
    Combat.hurt(state, victim, amount, cause, ev);
  }

  // Ranged.shoot(state, att, x, y, how, ev) → ticks | code: att shoots a rolled bolt toward
  // (x, y) (§8.1), how = {kind: 'shot', max?, item?, dmin?, dmax?, acc?}: max the most tiles
  // away it may aim (maxRange), item the instrument that fires it (the Pin-Driver), dmin,
  // dmax and acc the numbers it is made with if not the shooter's own. It is refused, with
  // nothing changed, where Ranged.flight refuses. The bolt hits the first actor on its line
  // through Combat.attack, with how.range (that actor's distance) and how.via filled in:
  // `attacked`, the roll or surprise, `missed` or the damage, then the attack's soft noise
  // at the shooter's tile. A bolt that meets a reflector comes back and hits its shooter
  // instead (sendBack): `attacked` at the reflector, the reflected roll and damage, then the
  // same soft noise; nothing behind the reflector is touched. Costs an attack for an
  // exhibit (Actors.attackCost), and COST_USE for an instrument's bolt. A shooter that is
  // gone is a bug, and stops with an error.
  function shoot(state, att, x, y, how, ev) {
    if (!att || att.gone) throw new Error(`Ranged.shoot: ${att ? att.uid : 'nobody'} is not there to shoot`);
    how = how || {};
    const f = flight(state, att, x, y, maxRange(att, how));
    if (f.code) return f.code;
    const cost = how.item ? Actors.cost(state, att, N.COST_USE, 'act') : Actors.attackCost(state, att);
    const h = Object.assign({}, how, { kind: 'shot', range: f.dist, via: f.viaOut.slice() });
    delete h.max;
    const at = Actors.byUid(state, f.at);
    if (!f.reflector) { Combat.attack(state, att, at, ev, h); return cost; }
    Causes.emit(state, ev, 'attacked', { by: att.uid, at: at.uid, how: h }, { k: 'attack', by: att.uid, at: at.uid, dist: f.dist, how: h });
    sendBack(state, att, at, Actors.byUid(state, f.victim), h, f, ev);
    Noise.emit(state, att.x, att.y, 'soft', { k: 'attack', by: att.uid }, ev);
    return cost;
  }

  return { bresenham, line, beam, beamFrom, isReflector, reflectorAt, maxRange, flight, canShoot, shoot };
})();
