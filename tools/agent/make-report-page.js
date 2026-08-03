/* Turn the skill sweep into a readable page.
 *
 *   node tools/agent/make-report-page.js sk_*.json --out=dist/difficulty.html
 *
 * The chart colours are the validated default categorical slots rather than the
 * game's own cyan/gold/crimson: those were picked for a dark CRT and do not
 * clear the colourblind-separation gates on a light surface. The game's palette
 * stays on the game; the data marks wear colours that were checked.
 */
const fs = require('fs');
const path = require('path');

const SECTIONS = [
  ['Opening', 'Gap run', 'Wall-jump chimney', 'Crumble + spikes', 'Turret gauntlet', 'Run-up', 'Aegis Drone'],
  ['Opening', 'Conveyors', 'Flame vents', 'Lava climb', 'Lava bridge', 'Run-up', 'Forge Golem'],
  ['Opening', 'Spike corridor', 'Void ascent', 'Crumble bridge', 'Turret + shielders', 'Run-up', 'Vanguard Prime']
];
const STAGE_NAMES = ['Skyfall Ridge', 'Magma Foundry', 'Void Citadel'];
const AXES = {
  dex: { param: 'dexSigma', levels: [0, 2, 6, 10], label: 'Dexterity',
         blurb: 'forced action repetition (gaussian &sigma;, in frames)' },
  strategy: { param: 'searchNodes', levels: [200, 60, 20, 8], label: 'Strategy',
              blurb: 'search allowed per decision (node budget)' },
  latency: { param: 'latency', levels: [0, 3, 6, 9], label: 'Reaction',
             blurb: 'observation delay (frames at 60Hz)' }
};

const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
const outArg = process.argv.find(a => a.startsWith('--out='));
const out = outArg ? outArg.split('=')[1] : 'dist/difficulty.html';

// ---------------------------------------------------------------- assemble
const axes = {};
files.forEach(f => {
  const part = JSON.parse(fs.readFileSync(f, 'utf8'));
  const a = axes[part.axis] = axes[part.axis] || { by: {}, clears: {} };
  a.by[part.level] = part.cell;
  a.clears[part.level] = part.clears;
});
// one unimpaired run, shared: dexSigma 0, searchNodes 200 and latency 0 are the
// same configuration
const baseCell = (axes.dex && axes.dex.by[0]) || (axes.latency && axes.latency.by[0]) ||
                 (axes.strategy && axes.strategy.by[200]);
Object.keys(AXES).forEach(k => {
  if (!axes[k]) return;
  const zero = AXES[k].levels[0];
  if (!axes[k].by[zero]) axes[k].by[zero] = baseCell;
});

const per = (c, f) => (c && c.visits ? c[f] / c.visits : 0);

const rows = [];
for (let st = 0; st < 3; st++) {
  for (let se = 0; se < 7; se++) {
    const k = st + '|' + se;
    const b = baseCell[k];
    const row = {
      stage: st, idx: se, name: SECTIONS[st][se],
      boss: se === 6,
      base: per(b, 'deaths'), baseHp: per(b, 'dmg'),
      entropy: b && b.entN ? b.ent / b.entN : 0,
      worst: {}, visits: {}
    };
    Object.keys(AXES).forEach(ax => {
      if (!axes[ax]) return;
      const lv = AXES[ax].levels;
      row.worst[ax] = lv.map(l => per(axes[ax].by[l] && axes[ax].by[l][k], 'deaths'));
      row.visits[ax] = lv.map(l => (axes[ax].by[l] && axes[ax].by[l][k] || {}).visits || 0);
    });
    rows.push(row);
  }
}

const clears = {};
Object.keys(AXES).forEach(ax => { if (axes[ax]) clears[ax] = axes[ax].clears; });

const DATA = { rows, clears, AXES, STAGE_NAMES };

// ------------------------------------------------------------------- page
const html = `<title>Vanguard Zero — where the difficulty actually is</title>
<style>
  .viz-root {
    color-scheme: light;
    --surface-0: #f4f3f0;
    --surface-1: #fcfcfb;
    --text-primary: #0b0b0b;
    --text-secondary: #52514e;
    --text-muted: #898781;
    --grid: #e1e0d9;
    --axis: #c3c2b7;
    --border: rgba(11,11,11,0.10);
    --s-dex: #2a78d6;
    --s-strategy: #eb6834;
    --s-latency: #1baf7a;
    --base-fill: rgba(137,135,129,0.20);
    --base-line: #898781;
    --band: rgba(11,11,11,0.030);
  }
  @media (prefers-color-scheme: dark) {
    :root:where(:not([data-theme="light"])) .viz-root {
      color-scheme: dark;
      --surface-0: #121211;
      --surface-1: #1a1a19;
      --text-primary: #ffffff;
      --text-secondary: #c3c2b7;
      --text-muted: #898781;
      --grid: #2c2c2a;
      --axis: #383835;
      --border: rgba(255,255,255,0.10);
      --s-dex: #3987e5;
      --s-strategy: #d95926;
      --s-latency: #199e70;
      --base-fill: rgba(137,135,129,0.24);
      --base-line: #898781;
      --band: rgba(255,255,255,0.035);
    }
  }
  :root[data-theme="dark"] .viz-root {
    color-scheme: dark;
    --surface-0: #121211;
    --surface-1: #1a1a19;
    --text-primary: #ffffff;
    --text-secondary: #c3c2b7;
    --text-muted: #898781;
    --grid: #2c2c2a;
    --axis: #383835;
    --border: rgba(255,255,255,0.10);
    --s-dex: #3987e5;
    --s-strategy: #d95926;
    --s-latency: #199e70;
    --base-fill: rgba(137,135,129,0.24);
    --base-line: #898781;
    --band: rgba(255,255,255,0.035);
  }

  * { box-sizing: border-box; }
  body { margin: 0; }
  .viz-root {
    background: var(--surface-0);
    color: var(--text-primary);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 15px;
    line-height: 1.55;
    min-height: 100vh;
    padding: 32px 20px 56px;
  }
  .wrap { max-width: 1080px; margin: 0 auto; display: flex; flex-direction: column; gap: 28px; }

  header { display: flex; flex-direction: column; gap: 10px; }
  h1 { margin: 0; font-size: 30px; line-height: 1.15; letter-spacing: -0.02em; text-wrap: balance; }
  .sub { margin: 0; color: var(--text-secondary); max-width: 68ch; text-wrap: pretty; }

  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
  .kpi {
    background: var(--surface-1); border: 1px solid var(--border);
    border-radius: 8px; padding: 14px 16px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .kpi b { font-size: 30px; font-weight: 600; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
  .kpi span { font-size: 12.5px; color: var(--text-secondary); }

  .card {
    background: var(--surface-1); border: 1px solid var(--border);
    border-radius: 10px; padding: 18px 18px 12px;
    display: flex; flex-direction: column; gap: 4px;
  }
  .card h2 { margin: 0; font-size: 17px; font-weight: 600; letter-spacing: -0.01em; }
  .card p.note { margin: 0 0 8px; color: var(--text-secondary); font-size: 13.5px; max-width: 76ch; text-wrap: pretty; }

  .legend { display: flex; flex-wrap: wrap; gap: 16px; padding: 2px 0 8px; font-size: 13px; }
  .legend i { display: inline-block; width: 16px; height: 3px; border-radius: 2px; vertical-align: middle; margin-right: 7px; }
  .legend .sw-base { height: 10px; background: var(--base-fill); border-top: 2px solid var(--base-line); border-radius: 2px; }
  .legend span { color: var(--text-secondary); white-space: nowrap; }

  .plot { position: relative; overflow-x: auto; }
  svg { display: block; width: 100%; height: auto; min-width: 640px; }
  .tip {
    position: absolute; pointer-events: none; opacity: 0;
    transform: translate(-50%, -110%); transition: opacity .12s;
    background: var(--surface-1); border: 1px solid var(--border);
    border-radius: 7px; padding: 8px 10px; font-size: 12.5px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.16); white-space: nowrap; z-index: 3;
  }
  .tip b { display: block; font-size: 13px; margin-bottom: 3px; }
  .tip .r { display: flex; justify-content: space-between; gap: 14px; color: var(--text-secondary); }
  .tip .r em { font-style: normal; color: var(--text-primary); font-variant-numeric: tabular-nums; }
  .tip i { display: inline-block; width: 9px; height: 3px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }

  table { width: 100%; border-collapse: collapse; font-size: 13.5px; font-variant-numeric: tabular-nums; }
  th, td { padding: 6px 9px; text-align: right; border-bottom: 1px solid var(--grid); }
  th { color: var(--text-muted); font-weight: 500; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; }
  th:first-child, td:first-child { text-align: left; }
  tbody tr.stagehead td {
    background: var(--band); color: var(--text-secondary);
    font-weight: 600; text-transform: uppercase; font-size: 11.5px; letter-spacing: 0.07em;
  }
  td.hot { color: var(--s-strategy); font-weight: 600; }
  td.dim { color: var(--text-muted); }
  .tablewrap { overflow-x: auto; }

  footer { color: var(--text-muted); font-size: 12.5px; max-width: 76ch; text-wrap: pretty; }
  footer p { margin: 0 0 6px; }
  code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.92em; }
</style>

<div class="viz-root">
<div class="wrap">

  <header>
    <h1>Where the difficulty in Vanguard Zero actually is</h1>
    <p class="sub">
      A search agent plays the game thousands of times. Run at full capability it
      shows how much <b>slack</b> the design leaves — how much a section costs when
      nothing is missed. Then it is crippled along one axis at a time, and what
      breaks tells you what <i>kind</i> of hard each part is. Sections run left to
      right in the order you meet them.
    </p>
  </header>

  <div class="kpis" id="kpis"></div>

  <section class="card">
    <h2>Deaths per visit, section by section</h2>
    <p class="note">
      The shaded floor is a perfect player. Each line is the same agent with one
      human limitation imposed at its harshest setting. Where a line lifts off the
      floor, that section is punishing that specific thing.
    </p>
    <div class="legend" id="legend"></div>
    <div class="plot" id="plot1"><div class="tip" id="tip1"></div></div>
  </section>

  <section class="card">
    <h2>Input demand</h2>
    <p class="note">
      Talakat's <code>entropy</code> feature: the information entropy of the first,
      second and third derivatives of the action sequence. High where the agent is
      constantly changing direction, stopping while moving, starting while stopped.
      This is a measure of how much the level <i>asks</i> for, not of what it takes
      away — and it costs one ordinary run rather than a sweep.
    </p>
    <div class="plot" id="plot2"><div class="tip" id="tip2"></div></div>
  </section>

  <section class="card">
    <h2>Every number</h2>
    <p class="note">Deaths per visit. <b>Slack</b> is the unimpaired agent; the rest are its worst setting on that axis.</p>
    <div class="tablewrap"><table id="tbl"></table></div>
  </section>

  <footer id="foot"></footer>

</div>
</div>

<script>
const DATA = ${JSON.stringify(DATA)};
const AX = ['dex', 'strategy', 'latency'];
const COL = { dex: 'var(--s-dex)', strategy: 'var(--s-strategy)', latency: 'var(--s-latency)' };
const R = DATA.rows;

// ------------------------------------------------------------------- KPIs
const worstBase = R.reduce((a, r) => r.base > a.base ? r : a, R[0]);
function worstOn(ax) {
  return R.reduce((a, r) => {
    const v = (r.worst[ax] || []).slice(-1)[0] || 0;
    return v > ((a.worst[ax] || []).slice(-1)[0] || 0) ? r : a;
  }, R[0]);
}
const kpis = [
  ['Only section that kills a perfect player', worstBase.name, worstBase.base.toFixed(2) + ' deaths / visit'],
  ['Worst under clumsy hands', worstOn('dex').name, ((worstOn('dex').worst.dex || []).slice(-1)[0] || 0).toFixed(2) + ' deaths / visit'],
  ['Worst under slow thinking', worstOn('strategy').name, ((worstOn('strategy').worst.strategy || []).slice(-1)[0] || 0).toFixed(2) + ' deaths / visit'],
  ['Worst under slow reactions', worstOn('latency').name, ((worstOn('latency').worst.latency || []).slice(-1)[0] || 0).toFixed(2) + ' deaths / visit']
];
document.getElementById('kpis').innerHTML = kpis.map(k =>
  '<div class="kpi"><span>' + k[0] + '</span><b style="font-size:19px">' + k[1] +
  '</b><span>' + k[2] + '</span></div>').join('');

document.getElementById('legend').innerHTML =
  '<span><i class="sw-base"></i>a perfect player (slack)</span>' +
  AX.filter(a => DATA.AXES[a]).map(a =>
    '<span><i style="background:' + COL[a] + '"></i>' + DATA.AXES[a].label +
    ' &mdash; ' + DATA.AXES[a].blurb + '</span>').join('');

// ------------------------------------------------------------------ chart
const W = 1000, H = 400, M = { t: 16, r: 116, b: 92, l: 46 };
const PW = W - M.l - M.r, PH = H - M.t - M.b;
const X = i => M.l + (PW * i) / (R.length - 1);

function axisAndBands(maxY, ticks) {
  let s = '';
  // stage bands
  for (let st = 0; st < 3; st++) {
    const a = R.findIndex(r => r.stage === st);
    const b = R.map(r => r.stage).lastIndexOf(st);
    const x0 = st === 0 ? M.l : (X(a) + X(a - 1)) / 2;
    const x1 = st === 2 ? M.l + PW : (X(b) + X(b + 1)) / 2;
    if (st % 2 === 1) s += '<rect x="' + x0 + '" y="' + M.t + '" width="' + (x1 - x0) +
      '" height="' + PH + '" fill="var(--band)"/>';
    s += '<text x="' + ((x0 + x1) / 2) + '" y="' + (M.t + 13) +
      '" text-anchor="middle" font-size="11.5" letter-spacing="0.08em" fill="var(--text-muted)">' +
      DATA.STAGE_NAMES[st].toUpperCase() + '</text>';
  }
  ticks.forEach(t => {
    const y = M.t + PH - (t / maxY) * PH;
    s += '<line x1="' + M.l + '" x2="' + (M.l + PW) + '" y1="' + y + '" y2="' + y +
      '" stroke="var(--grid)" stroke-width="1"/>';
    s += '<text x="' + (M.l - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11" fill="var(--text-muted)">' + t + '</text>';
  });
  s += '<line x1="' + M.l + '" x2="' + (M.l + PW) + '" y1="' + (M.t + PH) + '" y2="' + (M.t + PH) +
    '" stroke="var(--axis)" stroke-width="1"/>';
  R.forEach((r, i) => {
    s += '<text transform="translate(' + X(i) + ',' + (M.t + PH + 10) + ') rotate(38)" ' +
      'font-size="11" fill="' + (r.boss ? 'var(--text-secondary)' : 'var(--text-muted)') +
      '" font-weight="' + (r.boss ? '600' : '400') + '">' + r.name + '</text>';
  });
  return s;
}

function buildMain() {
  const series = AX.filter(a => DATA.AXES[a]).map(a => ({
    key: a, col: COL[a], label: DATA.AXES[a].label,
    vals: R.map(r => (r.worst[a] || []).slice(-1)[0] || 0)
  }));
  const maxY = Math.max(1, ...series.flatMap(s => s.vals), ...R.map(r => r.base)) * 1.12;
  const step = maxY > 6 ? 2 : maxY > 3 ? 1 : 0.5;
  const ticks = []; for (let t = 0; t <= maxY; t += step) ticks.push(+t.toFixed(1));
  const Y = v => M.t + PH - (v / maxY) * PH;

  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Deaths per visit across the game, by section">';
  s += axisAndBands(maxY, ticks);

  // the floor: what a perfect player still loses
  const area = R.map((r, i) => X(i) + ',' + Y(r.base)).join(' ');
  s += '<polygon points="' + (M.l + ',' + Y(0)) + ' ' + area + ' ' + ((M.l + PW) + ',' + Y(0)) +
    '" fill="var(--base-fill)"/>';
  s += '<polyline points="' + area + '" fill="none" stroke="var(--base-line)" stroke-width="2" ' +
    'stroke-linejoin="round" stroke-linecap="round"/>';

  series.forEach(se => {
    s += '<polyline points="' + R.map((r, i) => X(i) + ',' + Y(se.vals[i])).join(' ') +
      '" fill="none" stroke="' + se.col + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
    se.vals.forEach((v, i) => {
      s += '<circle cx="' + X(i) + '" cy="' + Y(v) + '" r="4" fill="' + se.col +
        '" stroke="var(--surface-1)" stroke-width="2"/>';
    });
    // direct label at the right edge, so identity never rests on colour alone
    const last = se.vals[se.vals.length - 1];
    s += '<text x="' + (M.l + PW + 10) + '" y="' + (Y(last) + 4) + '" font-size="12" font-weight="600" fill="' +
      se.col + '">' + se.label + '</text>';
  });

  s += '<g id="cross1"></g>';
  s += '</svg>';
  return s;
}

function buildEntropy() {
  const maxY = Math.max(0.05, ...R.map(r => r.entropy)) * 1.15;
  const step = 0.1;
  const ticks = []; for (let t = 0; t <= maxY; t += step) ticks.push(+t.toFixed(2));
  const H2 = 300, PH2 = H2 - M.t - M.b;
  const Y = v => M.t + PH2 - (v / maxY) * PH2;
  const bw = Math.min(30, (PW / R.length) - 6);

  let s = '<svg viewBox="0 0 ' + W + ' ' + H2 + '" role="img" aria-label="Input demand by section">';
  for (let st = 0; st < 3; st++) {
    const a = R.findIndex(r => r.stage === st);
    const b = R.map(r => r.stage).lastIndexOf(st);
    const x0 = st === 0 ? M.l : (X(a) + X(a - 1)) / 2;
    const x1 = st === 2 ? M.l + PW : (X(b) + X(b + 1)) / 2;
    if (st % 2 === 1) s += '<rect x="' + x0 + '" y="' + M.t + '" width="' + (x1 - x0) +
      '" height="' + PH2 + '" fill="var(--band)"/>';
  }
  ticks.forEach(t => {
    const y = Y(t);
    s += '<line x1="' + M.l + '" x2="' + (M.l + PW) + '" y1="' + y + '" y2="' + y + '" stroke="var(--grid)"/>';
    s += '<text x="' + (M.l - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11" fill="var(--text-muted)">' + t.toFixed(1) + '</text>';
  });
  R.forEach((r, i) => {
    const h = Math.max(0, M.t + PH2 - Y(r.entropy));
    s += '<rect x="' + (X(i) - bw / 2) + '" y="' + Y(r.entropy) + '" width="' + bw + '" height="' + h +
      '" rx="4" fill="var(--s-dex)" opacity="0.85"/>';
    s += '<text transform="translate(' + X(i) + ',' + (M.t + PH2 + 10) + ') rotate(38)" font-size="11" fill="var(--text-muted)">' + r.name + '</text>';
  });
  s += '<line x1="' + M.l + '" x2="' + (M.l + PW) + '" y1="' + (M.t + PH2) + '" y2="' + (M.t + PH2) + '" stroke="var(--axis)"/>';
  s += '</svg>';
  return s;
}

const plot1 = document.getElementById('plot1');
plot1.insertAdjacentHTML('afterbegin', buildMain());
const plot2 = document.getElementById('plot2');
plot2.insertAdjacentHTML('afterbegin', buildEntropy());

// ---------------------------------------------------------------- tooltip
function hookTip(host, tipEl, fmt) {
  const svg = host.querySelector('svg');
  function move(ev) {
    const box = svg.getBoundingClientRect();
    const rel = (ev.clientX - box.left) / box.width * W;
    let i = Math.round(((rel - M.l) / PW) * (R.length - 1));
    i = Math.max(0, Math.min(R.length - 1, i));
    tipEl.innerHTML = fmt(R[i]);
    tipEl.style.opacity = 1;
    tipEl.style.left = (M.l + (PW * i) / (R.length - 1)) / W * box.width + 'px';
    tipEl.style.top = Math.max(30, ev.clientY - box.top - 12) + 'px';
  }
  svg.addEventListener('mousemove', move);
  svg.addEventListener('mouseleave', () => { tipEl.style.opacity = 0; });
}
hookTip(plot1, document.getElementById('tip1'), r =>
  '<b>' + (r.stage + 1) + '-' + r.name + '</b>' +
  '<div class="r"><span>perfect player</span><em>' + r.base.toFixed(2) + '</em></div>' +
  AX.filter(a => DATA.AXES[a]).map(a =>
    '<div class="r"><span><i style="background:' + COL[a] + '"></i>' + DATA.AXES[a].label +
    '</span><em>' + ((r.worst[a] || []).slice(-1)[0] || 0).toFixed(2) + '</em></div>').join(''));
hookTip(plot2, document.getElementById('tip2'), r =>
  '<b>' + (r.stage + 1) + '-' + r.name + '</b>' +
  '<div class="r"><span>input demand</span><em>' + r.entropy.toFixed(3) + '</em></div>');

// ------------------------------------------------------------------ table
let t = '<thead><tr><th>Section</th><th>Slack</th>' +
  AX.filter(a => DATA.AXES[a]).map(a => '<th>' + DATA.AXES[a].label + '</th>').join('') +
  '<th>Input demand</th><th>hp lost</th></tr></thead><tbody>';
let cur = -1;
R.forEach(r => {
  if (r.stage !== cur) {
    cur = r.stage;
    t += '<tr class="stagehead"><td colspan="' + (4 + AX.length) + '">Stage ' + (cur + 1) + ' &middot; ' +
      DATA.STAGE_NAMES[cur] + '</td></tr>';
  }
  const cells = AX.filter(a => DATA.AXES[a]).map(a => {
    const v = (r.worst[a] || []).slice(-1)[0] || 0;
    return '<td class="' + (v >= 1 ? 'hot' : v === 0 ? 'dim' : '') + '">' + v.toFixed(2) + '</td>';
  }).join('');
  t += '<tr><td>' + r.name + '</td>' +
    '<td class="' + (r.base >= 1 ? 'hot' : r.base === 0 ? 'dim' : '') + '">' + r.base.toFixed(2) + '</td>' +
    cells +
    '<td>' + r.entropy.toFixed(3) + '</td>' +
    '<td class="dim">' + r.baseHp.toFixed(1) + '</td></tr>';
});
document.getElementById('tbl').innerHTML = t + '</tbody>';

// ------------------------------------------------------------------- foot
const cl = DATA.clears;
function clearLine(ax) {
  if (!cl[ax]) return '';
  const lv = DATA.AXES[ax].levels;
  return DATA.AXES[ax].label + ': ' + lv.map(l =>
    l + '&rarr;' + ((cl[ax][l] || []).join('/'))).join('   ');
}
document.getElementById('foot').innerHTML =
  '<p><b>How to read it.</b> A line that hugs the shaded floor means that section does not ' +
  'test that skill. A line that spikes means it does, and the height is how much.</p>' +
  '<p><b>Stage clears out of 3 per stage, by setting.</b> ' +
  AX.filter(a => cl[a]).map(clearLine).join(' &nbsp;&middot;&nbsp; ') + '</p>' +
  '<p>Sections the agent stops reaching once a wall defeats it are sampled less, so a low ' +
  'number late in a stage can mean &ldquo;never got there&rdquo; rather than &ldquo;easy&rdquo;. ' +
  'Dexterity and strategy follow Isaksen et al.&rsquo;s model as used in Talakat; reaction covers ' +
  'the half of their dexterity concept that action repetition alone does not reach.</p>';
</script>
`;

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('wrote ' + out + '  (' + rows.length + ' sections, axes: ' +
  Object.keys(axes).join(', ') + ')');
