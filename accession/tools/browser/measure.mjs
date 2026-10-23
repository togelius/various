// ACCESSION — measurements the browser checks take inside the page (BUILD.md §6.3, §11 M2).
// Each export is a function run with page.evaluate; it reads the DOM, the renderer's
// inspect() and pick(), and the view model, never pixels.

// Elements that break the layout: horizontal scroll, or anything outside #board that runs
// past the window's edges.
export function layout() {
  const w = window.innerWidth, out = [];
  if (document.documentElement.scrollWidth > w || document.body.scrollWidth > w) out.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${w})`);
  for (const e of document.querySelectorAll('#app *, #sheet *, .overlay.open *')) {
    if (e.closest('#board')) continue;
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    if (!r.width || !r.height || cs.visibility === 'hidden' || r.bottom <= 0 || r.top >= window.innerHeight) continue;
    if (r.right > w + 1 || r.left < -1) out.push(`${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}.${e.className} runs past the window (${Math.round(r.left)}–${Math.round(r.right)})`);
  }
  return out;
}

// Interactive targets under 44×44 CSS pixels that are on screen.
export function targets() {
  const out = [];
  for (const e of document.querySelectorAll('button, [role=button], a[href], input, select, textarea')) {
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (r.bottom <= 0 || r.top >= window.innerHeight || r.right <= 0 || r.left >= window.innerWidth) continue;
    if (r.width < 44 || r.height < 44) out.push(`${e.tagName.toLowerCase()} "${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 20)}" is ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  return out;
}

// The board: tap tolerance (the largest disc round each fully shown tile's centre in which
// every sampled pick gives that tile, or an actor standing on it), the hostile mark on
// every hostile, and every actor in the view model either on the board or at an edge.
export function board() {
  const A = window.ACCESSION, R = A.renderer, vm = A.vm(), b = document.getElementById('board').getBoundingClientRect();
  const drawn = R.inspect(), inside = q => q.x + q.w / 2 >= b.left && q.y + q.h / 2 >= b.top && q.x + q.w / 2 < b.right && q.y + q.h / 2 < b.bottom;
  const radii = [];
  for (const t of drawn.filter(d => d.kind === 'tile')) {
    const tr = R.tileRect(t.x, t.y), q = tr.rect, c = tr.centre;
    if (q.x < b.left || q.y < b.top || q.x + q.w > b.right || q.y + q.h > b.bottom) continue;
    const owner = vm.actors.find(a => t.x >= a.x && t.y >= a.y && t.x < a.x + a.size && t.y < a.y + a.size);
    const ok = p => p && ((p.x === t.x && p.y === t.y) || (owner && p.x === owner.x && p.y === owner.y));
    let r = 0;
    for (let rr = 1; rr <= 64; rr++) {
      let good = true;
      for (let k = 0; k < 32 && good; k++) {
        const ang = k * Math.PI / 16;
        good = ok(R.pick(c.x + rr * Math.cos(ang), c.y + rr * Math.sin(ang)));
      }
      if (!good) break;
      r = rr;
    }
    radii.push(r);
  }
  radii.sort((x, y) => x - y);
  const p10 = radii.length ? radii[Math.floor(radii.length / 10)] : 0;
  const disc = Math.min(...drawn.filter(d => d.kind === 'tile').slice(0, 1).map(t => 2 * R.tileRect(t.x, t.y).tapRadius));
  const problems = [];
  let hostiles = 0;
  for (const a of vm.actors) {
    const shown = drawn.find(d => d.kind === 'actor' && d.id === a.uid && inside(d.rect));
    const edge = drawn.find(d => d.kind === 'mark' && d.id === 'edge:' + a.uid && inside(d.rect));
    if (!shown && !(a.hostile && edge)) problems.push(`${a.uid} is in the view model but not on the board or at its edge`);
    if (shown && a.hostile) {
      hostiles++;
      if (!drawn.find(d => d.kind === 'mark' && d.id === 'hostile:' + a.uid && inside(d.rect))) problems.push(`${a.uid} is hostile and on screen but has no hostile mark`);
    }
  }
  for (const m of vm.marks) if (!drawn.find(d => d.kind === 'mark' && d.id === m.kind + ':' + m.x + ',' + m.y && inside(d.rect))) problems.push(`mark ${m.kind} at ${m.x},${m.y} is not drawn`);
  return { tiles: radii.length, p10, min: radii[0] || 0, disc, hostiles, actors: vm.actors.length, problems };
}

// Walk towards the nearest exhibit until one is in sight and within reach, by tapping
// visible tiles as a player would. Returns the exhibit's uid, or null.
export function nextStep(reach) {
  const A = window.ACCESSION, s = A.state, you = s.actors[0], vm = A.vm(), R = A.renderer;
  const cheb = a => Math.max(Math.abs(a.x - you.x), Math.abs(a.y - you.y));
  const seen = vm.actors.filter(a => a.uid !== 'you').sort((p, q) => cheb(p) - cheb(q));
  if (seen.length && cheb(seen[0]) <= reach) return { done: seen[0].uid };
  const targets = s.actors.filter(a => a.uid !== 'you' && !a.gone).map(a => ({ a, p: Path.to(s, a.x, a.y) })).filter(t => t.p.length).sort((p, q) => p.p.length - q.p.length);
  if (!targets.length) return { stuck: 'no exhibit can be reached' };
  const path = targets[0].p.slice(0, -1);
  if (!path.length) return { done: targets[0].a.uid };
  const b = document.getElementById('board').getBoundingClientRect();
  for (let i = path.length - 1; i >= 0; i--) {
    const [x, y] = path[i];
    if (vm.vis[y * vm.w + x] !== 2) continue;
    const c = R.tileRect(x, y).centre;
    if (c.x > b.left + 4 && c.y > b.top + 4 && c.x < b.right - 4 && c.y < b.bottom - 4) return { tile: { x, y }, at: c };
  }
  return { stuck: 'no visible step towards an exhibit' };
}
