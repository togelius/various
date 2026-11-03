/* The archive: constrained MAP-Elites over two playstyle dimensions.
 *
 *   x  aggression  shots actually fired per second, against the ~4/s a
 *                  sustained buster can manage. Runner to gunner.
 *   y  entropy     Talakat's entropy feature: the information entropy of the
 *                  1st, 2nd and 3rd derivatives of the action sequence, here
 *                  over the two movement channels (left/right and jump).
 *                  Committed to restless. Fire is left out on purpose, so the
 *                  two axes do not measure the same thing twice.
 *
 * Talakat used these features to characterise *levels* by how an agent had to
 * play them; here they characterise the *agents*, by how they choose to play.
 *
 * Quality is progress and nothing else.
 *
 * Constrained, after Talakat's Constrained MAP-Elites: each cell holds one
 * feasible elite and a small pool of infeasible ones, ranked by how close to
 * feasible they are. Here infeasible mostly means over the size limit. An
 * oversized controller that plays well is not thrown away: it waits in its
 * cell's infeasible pool for the repair operator to shorten it.
 */
'use strict';

const DIMS = [
  { key: 'aggression', label: 'aggression', min: 0, max: 1, bins: 10 },
  { key: 'entropy', label: 'entropy', min: 0, max: 0.5, bins: 10 }
];
const INFEASIBLE_CAP = 3;
const EPS = 1e-9;

function bin(v, d) {
  const t = (v - d.min) / (d.max - d.min);
  return Math.max(0, Math.min(d.bins - 1, Math.floor(t * d.bins)));
}

class Archive {
  constructor(data) {
    this.dims = DIMS;
    this.cells = {};        // 'i,j' -> { elite, infeasible: [] }
    this.history = [];      // { n, coverage, qd, best } snapshots
    if (data) Object.assign(this, { cells: data.cells || {}, history: data.history || [] });
  }

  cellOf(ind) { return [bin(ind.aggression, DIMS[0]), bin(ind.entropy, DIMS[1])]; }
  static key(c) { return c[0] + ',' + c[1]; }
  range(c) {
    return DIMS.map((d, k) => {
      const w = (d.max - d.min) / d.bins;
      return [d.min + c[k] * w, d.min + (c[k] + 1) * w];
    });
  }

  /* Returns what happened, so the loop can log it and the operators can be
   * credited: 'new' (a cell nobody held), 'improved' (beat the elite),
   * 'infeasible' (kept in the pool), or 'rejected'. */
  add(ind) {
    const c = this.cellOf(ind), k = Archive.key(c);
    ind.cell = c;
    const slot = this.cells[k] || (this.cells[k] = { elite: null, infeasible: [] });
    if (ind.feasible) {
      const e = slot.elite;
      if (!e) { slot.elite = ind; return 'new'; }
      if (ind.quality > e.quality + EPS ||
          (Math.abs(ind.quality - e.quality) <= EPS && ind.size < e.size)) {
        slot.elite = ind; return 'improved';
      }
      return 'rejected';
    }
    // Infeasible: only worth keeping if it would beat this cell's elite once
    // repaired - otherwise there is nothing to repair it towards.
    if (slot.elite && ind.quality <= slot.elite.quality + EPS) return 'rejected';
    slot.infeasible.push(ind);
    slot.infeasible.sort((a, b) => (a.violation - b.violation) || (b.quality - a.quality));
    if (slot.infeasible.length > INFEASIBLE_CAP) slot.infeasible.length = INFEASIBLE_CAP;
    return slot.infeasible.includes(ind) ? 'infeasible' : 'rejected';
  }

  elites() { return Object.values(this.cells).map(s => s.elite).filter(Boolean); }
  infeasibles() {
    const out = [];
    for (const s of Object.values(this.cells)) {
      for (const i of s.infeasible) if (!s.elite || i.quality > s.elite.quality + EPS) out.push(i);
    }
    return out;
  }
  best() { return this.elites().reduce((b, e) => (!b || e.quality > b.quality ? e : b), null); }
  coverage() { return this.elites().length / (DIMS[0].bins * DIMS[1].bins); }
  qd() { return this.elites().reduce((s, e) => s + e.quality, 0); }

  snapshot(n) {
    const b = this.best();
    this.history.push({ n, cells: this.elites().length, qd: +this.qd().toFixed(4), best: b ? +b.quality.toFixed(4) : 0 });
  }

  /* Cells nobody holds yet that border cells somebody does: where the map can
   * grow next. */
  frontier() {
    const out = [];
    for (let i = 0; i < DIMS[0].bins; i++) {
      for (let j = 0; j < DIMS[1].bins; j++) {
        const k = i + ',' + j;
        if (this.cells[k] && this.cells[k].elite) continue;
        const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => {
          const s = this.cells[(i + a) + ',' + (j + b)];
          return s && s.elite;
        });
        if (near) out.push([i, j]);
      }
    }
    return out;
  }

  /* Text map: quality in tenths per cell, entropy up the side. Also what the
   * LLM sees, so it knows where the archive is thin. */
  grid(opts = {}) {
    const [A, E] = DIMS;
    const lines = [];
    lines.push('  entropy');
    for (let j = E.bins - 1; j >= 0; j--) {
      let row = '  ' + (E.min + (j + 1) * (E.max - E.min) / E.bins).toFixed(2) + ' |';
      for (let i = 0; i < A.bins; i++) {
        const s = this.cells[i + ',' + j];
        const e = s && s.elite;
        let v = ' .';
        if (e) v = e.quality >= 0.995 ? '**' : String(Math.floor(e.quality * 100)).padStart(2, '0');
        else if (s && s.infeasible.length) v = ' x';
        const marked = opts.mark && opts.mark[0] === i && opts.mark[1] === j;
        row += marked ? '[' + v + ']' : ' ' + v + ' ';
      }
      lines.push(row);
    }
    lines.push('       +' + '-'.repeat(A.bins * 4));
    let ax = '        ';
    for (let i = 0; i < A.bins; i++) ax += (A.min + i * (A.max - A.min) / A.bins).toFixed(1).padEnd(4);
    lines.push(ax + '  aggression');
    lines.push('  (cell = quality x 100 of its elite; ** = 1.0; x = only an infeasible candidate)');
    return lines.join('\n');
  }

  toJSON() { return { dims: DIMS, cells: this.cells, history: this.history }; }
}

module.exports = { Archive, DIMS };
