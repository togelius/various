// ACCESSION — measurements the browser checks take inside the page (BUILD.md §6.3, §11 M2).
// Each export is a function run with page.evaluate; it reads the DOM, the renderer's
// inspect() and pick(), and the view model, never pixels.

// Elements that break the layout: horizontal scroll, anything outside #board that runs past
// the window's edges, and any box whose content is wider than the box itself (which is how
// a scroll container such as the label sheet or an overlay would scroll sideways). Text cut
// short on purpose with an ellipsis is allowed.
export function layout() {
  const w = window.innerWidth, out = [];
  if (document.documentElement.scrollWidth > w || document.body.scrollWidth > w) out.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${w})`);
  const name = e => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${typeof e.className === 'string' && e.className ? '.' + e.className.split(' ').join('.') : ''}`;
  const boxes = [...document.querySelectorAll('#app, #app *, #sheet, #sheet *, .overlay.open, .overlay.open *')];
  // Text clipped away for screen readers only (a clip rect) is not laid out for the eye.
  const hiddenForReaders = e => { for (let p = e; p; p = p.parentElement) { const c = getComputedStyle(p).clip; if (c && c !== 'auto') return true; } return false; };
  for (const e of boxes) {
    if (e.closest('#board') || e.tagName === 'CANVAS' || e.closest('svg') || hiddenForReaders(e)) continue;
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (e.scrollWidth > e.clientWidth + 1 && cs.textOverflow !== 'ellipsis' && e.clientWidth > 0) out.push(`${name(e)} holds content ${e.scrollWidth - e.clientWidth} px wider than itself`);
    if (r.bottom <= 0 || r.top >= window.innerHeight) continue;
    if (r.right > w + 1 || r.left < -1) out.push(`${name(e)} runs past the window (${Math.round(r.left)}–${Math.round(r.right)})`);
  }
  return out;
}

// Is a label showing for this title, with its title really seen: displayed, not
// transparent, inside every box that clips it, and the topmost thing at its centre? (Each
// function here is sent to the page on its own, so the check is written into each.)
export function labelVisible(title) {
  const seen = e => {
    if (!e) return false;
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    for (let p = e; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      if (p !== e && cs.overflow !== 'visible') {
        const q = p.getBoundingClientRect();
        if (r.bottom <= q.top || r.top >= q.bottom || r.right <= q.left || r.left >= q.right) return false;
      }
    }
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx >= window.innerWidth || cy >= window.innerHeight) return false;
    const top = document.elementFromPoint(cx, cy);
    return !!top && (top === e || e.contains(top));
  };
  const h = document.querySelector('#sheet .label h2');
  return seen(h) && (!title || h.textContent.includes(title));
}

// The label's action buttons: how many there are, and the size of the first one a player
// can really see and tap, or null.
export function actionButton() {
  const seen = e => {
    if (!e) return false;
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    for (let p = e; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      if (p !== e && cs.overflow !== 'visible') {
        const q = p.getBoundingClientRect();
        if (r.bottom <= q.top || r.top >= q.bottom || r.right <= q.left || r.left >= q.right) return false;
      }
    }
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx >= window.innerWidth || cy >= window.innerHeight) return false;
    const top = document.elementFromPoint(cx, cy);
    return !!top && (top === e || e.contains(top));
  };
  const all = [...document.querySelectorAll('#sheet [data-label-act]')], b = all.find(seen);
  return { count: all.length, seen: b ? { w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height, text: b.textContent } : null };
}

// Is the log on screen as it should be: its newest line the newest entry in the history,
// really seen from its first line; in the laptop layout, the last six entries listed?
export function logVisible() {
  const seen = e => {
    if (!e) return false;
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    for (let p = e; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      if (p !== e && cs.overflow !== 'visible') {
        const q = p.getBoundingClientRect();
        if (r.bottom <= q.top || r.top >= q.bottom || r.right <= q.left || r.left >= q.right) return false;
      }
    }
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx >= window.innerWidth || cy >= window.innerHeight) return false;
    const top = document.elementFromPoint(cx, cy);
    return !!top && (top === e || e.contains(top));
  };
  const history = window.ACCESSION.history, lines = [...document.querySelectorAll('#strip .log .line')], last = lines[lines.length - 1];
  if (!last || !history.length || last.textContent !== history[history.length - 1] || !seen(last)) return false;
  // The newest entry is in view from its first line.
  const box = last.parentElement.getBoundingClientRect(), top = last.getBoundingClientRect().top;
  if (top < box.top - 1 || top >= box.bottom) return false;
  const laptop = matchMedia('(min-width: 900px) and (min-aspect-ratio: 4/3)').matches;
  if (laptop && lines.filter(l => getComputedStyle(l).display !== 'none').length !== Math.min(6, history.length)) return false;
  return true;
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
  // The clear part of the board: what the phone's label sheet does not cover. Anything said
  // to be on the board must also be the topmost thing there (a canvas of the board).
  const clearBottom = b.bottom - UI.sheetCover();
  const drawn = R.inspect(), inside = q => {
    const cx = q.x + q.w / 2, cy = q.y + q.h / 2;
    if (cx < b.left || cy < b.top || cx >= b.right || cy >= clearBottom) return false;
    const e = document.elementFromPoint(cx, cy);
    return !!e && !!e.closest('#board');
  };
  const radii = [];
  for (const t of drawn.filter(d => d.kind === 'tile')) {
    const tr = R.tileRect(t.x, t.y), q = tr.rect, c = tr.centre;
    if (q.x < b.left || q.y < b.top || q.x + q.w > b.right || q.y + q.h > clearBottom) continue;
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
  // Every actor shows at least a quarter of its square each way in the clear part of the
  // board, or (a hostile) is marked by an edge arrow; a hostile that shows has its bar in view.
  const partly = q => Math.min(b.right, q.x + q.w) - Math.max(b.left, q.x) >= q.w / 4 && Math.min(clearBottom, q.y + q.h) - Math.max(b.top, q.y) >= q.h / 4;
  for (const a of vm.actors) {
    const shown = drawn.find(d => d.kind === 'actor' && d.id === a.uid && partly(d.rect));
    const edge = drawn.find(d => d.kind === 'mark' && d.id === 'edge:' + a.uid && inside(d.rect));
    if (!shown && !(a.hostile && edge)) problems.push(`${a.uid} is in the view model but not on the board or at its edge`);
    if (shown && a.hostile) {
      hostiles++;
      if (!drawn.find(d => d.kind === 'mark' && d.id === 'hostile:' + a.uid && inside(d.rect))) problems.push(`${a.uid} is hostile and on screen but has no hostile mark in view`);
    }
  }
  // Every mark the view model holds has its own id (kind:x,y), so each is found by it, and
  // is drawn: telegraphs, calls, noise rings, a Solution's area and the aim; then the path
  // preview and the selection.
  const markIds = vm.marks.map(m => m.kind + ':' + m.x + ',' + m.y), twice = markIds.filter((id, i) => markIds.indexOf(id) !== i);
  if (twice.length) problems.push(`the view model holds marks with the same id: ${[...new Set(twice)].join(', ')}`);
  const onBoard = (x, y) => { const c = R.tileRect(x, y).centre; return c.x >= b.left && c.y >= b.top && c.x < b.right && c.y < clearBottom; };
  for (const m of vm.marks) if (onBoard(m.x, m.y) && !drawn.find(d => d.kind === 'mark' && d.id === m.kind + ':' + m.x + ',' + m.y && inside(d.rect))) problems.push(`mark ${m.kind} at ${m.x},${m.y} is not drawn`);
  // No two edge arrows lie on each other.
  const edges = drawn.filter(d => d.id.startsWith('edge:'));
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    const p = edges[i].rect, q = edges[j].rect;
    if (p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h) problems.push(`${edges[i].id} and ${edges[j].id} lie on each other`);
  }
  // A path dot lies on its own tile; the selection bracket on the selected tile or exhibit.
  const within = (q, r) => { const cx = q.x + q.w / 2, cy = q.y + q.h / 2; return cx >= r.x && cy >= r.y && cx < r.x + r.w && cy < r.y + r.h; };
  for (const [x, y] of vm.path || []) if (onBoard(x, y) && !drawn.find(d => d.id === 'path:' + x + ',' + y && inside(d.rect) && within(d.rect, R.tileRect(x, y).rect))) problems.push(`path tile ${x},${y} has no dot on it`);
  const sel = vm.selectedTile || (vm.selection && vm.actors.find(a => a.uid === vm.selection));
  if (sel) {
    const target = vm.selectedTile ? R.tileRect(sel.x, sel.y).rect : (drawn.find(d => d.kind === 'actor' && d.id === sel.uid) || {}).rect;
    if (onBoard(sel.x, sel.y) && !(target && drawn.find(d => d.id === 'selection' && d.x === sel.x && d.y === sel.y && inside(d.rect) && within(d.rect, target)))) problems.push(`the selection at ${sel.x},${sel.y} is not drawn on it`);
  }
  return { tiles: radii.length, p10, min: radii[0] || 0, disc, hostiles, actors: vm.actors.length, path: (vm.path || []).length, selection: !!(vm.selection || vm.selectedTile), problems };
}

// Walk towards the nearest exhibit until one is in sight and within reach, by tapping
// visible tiles as a player would. Returns the exhibit's uid, or null.
// With reach 1 the walk ends only where a blow would reach (Step.adjacent, which refuses a
// diagonal past a corner), not merely one tile away.
export function nextStep(reach) {
  const A = window.ACCESSION, s = A.state, you = s.actors[0], vm = A.vm(), R = A.renderer;
  const cheb = a => Actors.dist(Actors.byUid(s, a.uid), you.x, you.y);
  const seen = vm.actors.filter(a => a.uid !== 'you').sort((p, q) => cheb(p) - cheb(q));
  const near = reach === 1 ? seen.find(a => Step.adjacent(s, you, Actors.byUid(s, a.uid))) : seen.find(a => cheb(a) <= reach);
  if (near) return { done: near.uid };
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

// A free, visible, reachable tile 1–3 steps from you, whose centre picks it and is the
// topmost thing there: { x, y, c } with c its centre in client pixels, or null.
export function freeTile() {
  const A = window.ACCESSION, vm = A.vm(), y = A.state.actors[0], b = document.getElementById('board').getBoundingClientRect();
  for (let r = 3; r >= 1; r--) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
    const x = y.x + dx, yy = y.y + dy;
    if (x < 0 || yy < 0 || x >= vm.w || yy >= vm.h || vm.vis[yy * vm.w + x] !== 2 || vm.actors.some(a => x >= a.x && yy >= a.y && x < a.x + a.size && yy < a.y + a.size)) continue;
    if (Path.to(A.state, x, yy).length !== r) continue;
    const c = A.renderer.tileRect(x, yy).centre, e = document.elementFromPoint(c.x, c.y), p = A.renderer.pick(c.x, c.y);
    if (c.x > b.left && c.y > b.top && c.x < b.right && c.y < b.bottom && e && e.closest('#board') && p && p.x === x && p.y === yy) return { x, y: yy, c };
  }
  return null;
}
