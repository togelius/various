// The MAP-Elites archive. Two playstyle axes, both *measured from play*, never read off the code:
//   wheels   share of the distance covered in a vehicle   (on foot ... in a car)
//   trouble  offences per minute (assault, vandalism, hitting people, carjacking, shooting ...)  (law-abiding ... rampage)
// Quality is progress in the game (episode.js) and nothing else. A cell keeps its best genome.
'use strict';

const AXES = [
  { name: 'wheels', edges: [0.05, 0.25, 0.5, 0.75, 0.95], label: ['on foot', 'mostly foot', 'mixed', 'mostly car', 'car', 'only car'], desc: 'share of distance travelled in a vehicle' },
  { name: 'trouble', edges: [0.1, 0.6, 1.5, 3.5, 8], label: ['law-abiding', 'a slip', 'scuffles', 'troublemaker', 'crime spree', 'rampage'], desc: 'offences per minute' },
];
const bin = (v, edges) => { let i = 0; while (i < edges.length && v >= edges[i]) i++; return i; };

class Archive {
  constructor(axes = AXES) { this.axes = axes; this.cells = new Map(); this.nx = axes[0].edges.length + 1; this.ny = axes[1].edges.length + 1; }
  cellOf(d) { return [bin(d[0], this.axes[0].edges), bin(d[1], this.axes[1].edges)]; }
  key(c) { return c[0] + ',' + c[1]; }
  get size() { return this.cells.size; }
  get(c) { return this.cells.get(this.key(c)); }
  elites() { return [...this.cells.values()]; }
  // the cell a genome belongs in, from its measured descriptor
  place(g) { g.cell = this.cellOf(g.desc); return g.cell; }
  // challenger vs incumbent on the SAME scores: the caller has made sure both carry a score for the current batch
  contest(g) {
    this.place(g); const cur = this.get(g.cell);
    if (!cur) { this.cells.set(this.key(g.cell), g); return 'new'; }
    const better = g.cur > cur.cur + 1e-9 || (Math.abs(g.cur - cur.cur) <= 1e-9 && g.code.length < cur.code.length);
    if (better) { this.cells.set(this.key(g.cell), g); return 'better'; }
    return 'worse';
  }
  // after a re-score of every elite on a new batch: back into the grid, the best per cell
  rebuild(genomes) { this.cells.clear(); for (const g of [...genomes].sort((a, b) => b.cur - a.cur)) { this.place(g); if (!this.cells.has(this.key(g.cell))) this.cells.set(this.key(g.cell), g); } }
  emptyCells() { const out = []; for (let i = 0; i < this.nx; i++) for (let j = 0; j < this.ny; j++) if (!this.cells.has(i + ',' + j)) out.push([i, j]); return out; }
  // empty cells next to a given cell (Chebyshev distance 1), then any empty cell
  emptyNear(c) { const e = this.emptyCells(); const near = e.filter(x => Math.max(Math.abs(x[0] - c[0]), Math.abs(x[1] - c[1])) <= 1); return near.length ? near : e; }
  // the middle of a cell in descriptor units
  centre(c) { const m = (a, i) => { const e = this.axes[a].edges, lo = i === 0 ? 0 : e[i - 1], hi = i >= e.length ? (a === 0 ? 1 : e[e.length - 1] * 2) : e[i]; return (lo + hi) / 2; }; return [m(0, c[0]), m(1, c[1])]; }
  coverage() { return this.size / (this.nx * this.ny); }
  qd() { return this.elites().reduce((s, g) => s + g.cur, 0); }
  best() { return this.elites().reduce((b, g) => (!b || g.cur > b.cur ? g : b), null); }
  render(field = 'cur', digits = 2) {
    const rows = [this.axes[1].name.padEnd(14) + ' \\ ' + this.axes[0].name + '   ' + this.axes[0].label.map(l => l.padEnd(12)).join('')];
    for (let j = this.ny - 1; j >= 0; j--) {
      let r = this.axes[1].label[j].padEnd(14) + '          ';
      for (let i = 0; i < this.nx; i++) { const g = this.cells.get(i + ',' + j); const v = g && (typeof field === 'function' ? field(g) : g[field]); r += (g && v !== undefined && v !== null ? v.toFixed(digits) : ' .  ').padEnd(12); }
      rows.push(r);
    }
    return rows.map(r => r.replace(/\s+$/, '')).join('\n');
  }
}
module.exports = { Archive, AXES, bin };
