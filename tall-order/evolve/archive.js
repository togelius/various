// MAP-Elites archive over two playstyle descriptors.
//   axis 0 = TRIGGER: share of control ticks with the fire button held
//   axis 1 = PACE:    mean walking speed as a share of full walking speed
// Quality is progress up the tower (see driver.js). Each cell keeps its best controller by the *current epoch's* score.
const AXES = [
  { name: 'trigger', edges: [0.03, 0.08, 0.16, 0.3, 0.55], label: ['hold fire', 'rare shots', 'some shots', 'steady fire', 'heavy fire', 'spray'] },
  { name: 'pace', edges: [0.12, 0.26, 0.4, 0.55, 0.7], label: ['standing', 'creeping', 'slow', 'steady', 'brisk', 'sprint'] },
];
const bin = (v, edges) => { let i = 0; while (i < edges.length && v >= edges[i]) i++; return i; };

class Archive {
  constructor() { this.cells = new Map(); this.nx = AXES[0].edges.length + 1; this.ny = AXES[1].edges.length + 1; }
  cellOf(desc) { return [bin(desc[0], AXES[0].edges), bin(desc[1], AXES[1].edges)]; }
  key(c) { return c[0] + ',' + c[1]; }
  get size() { return this.cells.size; }
  elites() { return [...this.cells.values()]; }
  // returns 'new' | 'better' | 'worse'
  add(g) {
    g.cell = this.cellOf(g.desc); const k = this.key(g.cell), cur = this.cells.get(k);
    if (!cur) { this.cells.set(k, g); return 'new'; }
    if (g.cur > cur.cur) { this.cells.set(k, g); return 'better'; }
    return 'worse';
  }
  // after re-scoring: put every genome back into its (possibly changed) cell, keeping the best per cell
  rebuild(genomes) { this.cells.clear(); for (const g of genomes.sort((a, b) => b.cur - a.cur)) { g.cell = this.cellOf(g.desc); const k = this.key(g.cell); if (!this.cells.has(k)) this.cells.set(k, g); } }
  emptyCells() { const out = []; for (let i = 0; i < this.nx; i++) for (let j = 0; j < this.ny; j++) if (!this.cells.has(i + ',' + j)) out.push([i, j]); return out; }
  // the middle of a cell, as descriptor values
  centre(c) { const m = (a, i) => { const e = AXES[a].edges, lo = i === 0 ? 0 : e[i - 1], hi = i >= e.length ? Math.min(1, e[e.length - 1] * 1.8) : e[i]; return (lo + hi) / 2; }; return [m(0, c[0]), m(1, c[1])]; }
  coverage() { return this.size / (this.nx * this.ny); }
  qd() { return this.elites().reduce((s, g) => s + g.cur, 0); }
  render() {
    const rows = [];
    rows.push('pace \\ trigger  ' + AXES[0].label.map(l => l.padEnd(12)).join(''));
    for (let j = this.ny - 1; j >= 0; j--) {
      let r = AXES[1].label[j].padEnd(16);
      for (let i = 0; i < this.nx; i++) { const g = this.cells.get(i + ',' + j); r += (g ? g.cur.toFixed(2) + (g.wins ? '*' : ' ') : ' .  ').padEnd(12); }
      rows.push(r);
    }
    return rows.join('\n');
  }
}
module.exports = { Archive, AXES };
