// The wall panels as Dept.create leaves them (M4 plan W-PANELS, D5.4, D5.5, D7.1; BUILD.md
// §5.2, §5.5), over the shared sweep (test/m4-sweep.test.js: seeds 1–100 of each department at
// each depth 1–7). Each placement claim D7.1 makes, worked out here from its words and the
// department as made, never from js/core/panels.js:
//   - "a wall panel by the room's first entrance": every panel stands on a wall tile (#) that
//     holds no other fixture, beside (any of 8) a tile of the room it introduces, and can be
//     read (within READ_RANGE, in sight) from a tile of that room's first entrance, its tiles
//     you can walk to from the entrance at the least walk (walking as an exhibit does, staff
//     doors walls, as the plaques measure it); or, only where no free wall by the room can be
//     read from there (the walls by its doorway hold other fixtures), beside a tile of the
//     room you can walk to, in at most 1 department in 100 (1 panel in 2,100 departments);
//   - the intro panel in the Intro, each section panel in a section, one panel a room, and
//     every section panel placed while a section is left for it;
//   - "the secondary module's panel is at the first section where it is met": no section
//     before its room in tour order holds an exhibit flagged with its module or a case holding
//     weather (the module is on in the sweep, so a weather case is one with `weather`), and its
//     room holds such an exhibit or a real case (any of which may hold weather), unless no
//     section does;
//   - every other section panel in the room its gallery took, unless the secondary's stands
//     there;
//   - its banner within Panels.BANNER_WORDS words, and nothing it says reads "undefined",
//     "NaN" or "[object".
// Over the whole sweep: the share of departments where the secondary's room itself holds
// weather or a flagged exhibit (printed by m4-panels, never gated: any real case meets it).
'use strict';
module.exports = C => {
  const { N, Grid, Packs, Panels } = C;
  const tally = { depts: 0, should: 0, secondary: 0, metThere: 0, far: 0 };
  const BAD = /undefined|NaN|\[object/;
  const words = s => s.trim().split(/\s+/).filter(Boolean).length;

  function each(d) {
    const { state: s, acc } = d, m = s.dept, pack = Packs.get(acc), say = [], P = pack.panels;
    tally.depts++;
    const panels = m.fixtures.filter(f => f.k === 'panel');
    const roomOf = id => m.rooms.find(r => r.id === id) || null;
    const sections = m.rooms.filter(r => r.role === 'section' && /^s\d+$/.test(r.key)).sort((a, b) => Number(a.key.slice(1)) - Number(b.key.slice(1)));
    const walk = Grid.distances(m, [m.entrance], m.w * m.h, null, 'exhibit');
    const inRoom = (rm, x, y) => Grid.inside(m, x, y) && m.roomOf[y][x] === rm.id;
    // Which panels: the intro's, and every section panel while a section is left.
    const want = 1 + Math.min(P.sections.length, sections.length);
    if (panels.length !== want) say.push(`${panels.length} panels, for ${want}`);
    const rooms = new Set();
    for (const f of panels) {
      const rm = roomOf(f.room);
      if (!rm) { say.push(`panel ${f.key} stands for no room`); continue; }
      if (rooms.has(rm.id)) say.push(`room ${rm.key} has two panels`);
      rooms.add(rm.id);
      if (f.key === 'intro' ? rm.role !== 'intro' : rm.role !== 'section') say.push(`panel ${f.key} stands in ${rm.key}`);
      // On a wall by the room's first entrance.
      if (m.tiles[f.y][f.x] !== '#') say.push(`panel ${f.key} stands on ${m.tiles[f.y][f.x]}`);
      if (m.fixtures.some(g => g !== f && g.x === f.x && g.y === f.y)) say.push(`panel ${f.key} shares its tile`);
      let near = false;
      for (let k = 0; k < 8; k++) if (inRoom(rm, f.x + Grid.DX[k], f.y + Grid.DY[k])) near = true;
      if (!near) say.push(`panel ${f.key} at ${f.x},${f.y} is beside no tile of ${rm.key}`);
      let least = -1, first = [];
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        if (!inRoom(rm, x, y) || !Grid.walkable(m, x, y)) continue;
        const w = walk[y * m.w + x];
        if (w < 0) continue;
        if (least < 0 || w < least) { least = w; first = [[x, y]]; } else if (w === least) first.push([x, y]);
      }
      const readable = (wx, wy) => first.some(([x, y]) => Grid.disc(wx - x, wy - y, N.READ_RANGE) && Grid.los(m, x, y, wx, wy));
      if (!readable(f.x, f.y)) {
        // Only where no free wall by the room can be read from there (the walls by its doorway
        // hold other fixtures): then the nearest beside a tile of the room you can walk to.
        tally.far++;
        let free = null;
        for (let y = 0; y < m.h && !free; y++) for (let x = 0; x < m.w && !free; x++) {
          if (m.tiles[y][x] !== '#' || m.fixtures.some(g => g.x === x && g.y === y)) continue;
          let by = false;
          for (let k = 0; k < 8; k++) if (inRoom(rm, x + Grid.DX[k], y + Grid.DY[k])) by = true;
          if (by && readable(x, y)) free = [x, y];
        }
        if (free) say.push(`panel ${f.key} at ${f.x},${f.y} cannot be read from ${rm.key}'s first entrance, and the wall at ${free} could`);
        else if (![0, 2, 4, 6].some(k => { const x = f.x + Grid.DX[k], y = f.y + Grid.DY[k]; return inRoom(rm, x, y) && Grid.walkable(m, x, y) && walk[y * m.w + x] >= 0; })) say.push(`panel ${f.key} at ${f.x},${f.y} is beside no tile of ${rm.key} you can walk to`);
      }
      // What it says.
      const b = Panels.banner(s, f.key), t = Panels.text(s, f.key);
      if (typeof b !== 'string' || typeof t !== 'string' || BAD.test(b) || BAD.test(t)) say.push(`panel ${f.key} says ${JSON.stringify(b)}`);
      else if (words(b) > Panels.BANNER_WORDS) say.push(`panel ${f.key}'s banner has ${words(b)} words`);
    }
    // The secondary's panel, at the first section where its module is met.
    const sec = P.sections.find(p => typeof p.module === 'string');
    const panelOf = key => panels.find(f => f.key === key) || null;
    if (sec) {
      tally.should++;
      const f = panelOf(sec.gallery), rm = f && roomOf(f.room), id = sec.module;
      const flagged = r => s.actors.some((a, i) => i > 0 && inRoom(r, a.x, a.y) && (Packs.speciesFor(s, a).flags || []).includes(id));
      const realCase = r => m.fixtures.some(g => g.k === 'case' && !g.mimic && inRoom(r, g.x, g.y));
      const weather = r => m.fixtures.some(g => g.k === 'case' && !g.mimic && !!g.weather && inRoom(r, g.x, g.y));
      const met = r => flagged(r) || (id === 'weather_cases' && weather(r));
      if (rm) {
        tally.secondary++;
        if (met(rm)) tally.metThere++;
        const at = sections.indexOf(rm);
        for (const r of sections.slice(0, at < 0 ? 0 : at)) if (met(r)) say.push(`${id} is met in ${r.key}, before its panel in ${rm.key}`);
        const any = sections.some(r => flagged(r) || (id === 'weather_cases' && realCase(r)));
        if (any && !(flagged(rm) || (id === 'weather_cases' && realCase(rm)))) say.push(`${id}'s panel stands in ${rm.key}, which holds nothing of it`);
      }
    }
    // Every other section panel in its gallery's room, unless the secondary's stands there.
    for (const p of P.sections) {
      if (p === sec) continue;
      const f = panelOf(p.gallery);
      if (!f) continue;
      const gi = pack.galleries.findIndex(g => g.key === p.gallery);
      const home = sections.find(r => Array.isArray(r.galleries) && r.galleries.includes(gi));
      const taken = sec && panelOf(sec.gallery) && home && panelOf(sec.gallery).room === home.id;
      if (home && !taken && f.room !== home.id) say.push(`panel ${p.gallery} stands in ${roomOf(f.room).key}, not its gallery's room ${home.key}`);
    }
    return say.length ? say.slice(0, 4).join('; ') : null;
  }

  function done() {
    if (tally.far * 100 > tally.depts) return `${tally.far} panels in ${tally.depts} departments cannot be read from their rooms' first entrances, over 1 in 100`;
    if (tally.secondary !== tally.should) return `a secondary's panel stands in ${tally.secondary} of the ${tally.should} departments that have one`;
    return null;
  }
  return { each, done, tally };
};
