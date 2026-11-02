// ACCESSION — the department's wall panels and their banners (BUILD.md §5.2, §8.8; M4 plan
// D5.4, D5.5, D7.1: settled, decided without play; revisit once M4 is playable). Owned by
// W-PANELS. The panels' prose is each pack's part, content/<acc>-panels.js:
//   {intro: {name, text}, sections: [{gallery, name, text, module?}]}
// text is prose with no rule in it and no claim of where anything stands; a section panel's
// gallery is the key of the gallery it introduces (s1, s2 …), and `module`, on one section
// panel at most, names the pack's secondary module, whose panel it is.
//
// What a panel says. Its prose, then, while its module is on (Modules.on), the module's rule
// sentence, generated from the registry (Clauses.sentence, with the pack's params for it at
// the department's depth), so the rule a panel states is the one the code runs: the intro
// panel's module is the pack's signature (the module with role 'signature', else its first),
// a section panel's the one it names. With the module off, or absent from the visit, the
// panel says its prose alone. Its banner, shown on first entering its room (the interface's,
// in place of the strip until your next action), is its prose's first sentence and, while its
// module is on, the module's sentence: at most BANNER_WORDS words (test/m4-panels.test.js
// holds every panel to it at every depth).
//
// Where each panel stands (Panels.place, from Dept.create after the consumables, M4 plan A10
// step 11; it draws nothing, so no stream moves). Each is a fixture {k: 'panel', x, y, key,
// room} (key 'intro', or its section panel's gallery key; room, the id of the room it
// introduces) on a wall by that room's first entrance:
//   - the intro panel in the Intro; each section panel in a section (role section, key s1,
//     s2 … in tour order), one panel a room;
//   - the secondary's panel at the first section in tour order where its module is met: a
//     section holding an exhibit flagged with it (its species' flags), or, for weather_cases,
//     whose rule gives cases their weather, any real case (no mimic's disguise), since any
//     may hold weather; so no section before it holds anything of the module. A department
//     whose sections meet it nowhere puts it in its gallery's room;
//   - every other section panel, in pack order, in the room its gallery took
//     (dept.rooms[].galleries, Populate.mapping), or, when that room has a panel already, the
//     first section in tour order that has none; with none left it is not placed.
//   What meets a module is read from the species' flags and the cases, never from whether
//   the module is on, so the panels stand where they stand under any rulesOff (plan A10:
//   population is the same under any switch).
//   The tile. A room's first entrance is its tiles you reach first: those you can walk to from
//   the entrance (by the exhibits' step rule, staff doors walls, as the plaques measure it) at
//   the least walk. Its panel is on a wall tile (#) holding no fixture, beside (any of its 8
//   neighbours) a tile of the room, that you can read from a tile of its first entrance
//   (within READ_RANGE, in sight); a wall beside (N, E, S or W) no tile of another public room
//   you could stand on (the staff band's and a doorway's do not count) before one that is, so
//   a panel is read from beyond its room only where its first entrance's walls are shared
//   (as a section's by a doorway out of the Intro always are, so it is read from the Intro's
//   side of that doorway too; its banner shows only on entering its room);
//   then the nearest a tile of the first entrance (dx² + dy²), ties in row-major order. With
//   no such wall, the one nearest the first entrance beside (N, E, S or W) a tile of the room
//   you can walk to (1 panel in 2,100 departments, test/sweep/panels.check.js); a room with
//   neither gets no panel.
//
// Its reader (Fixtures.addReader('panel')): read(x, y), free, within READ_RANGE and in sight
// as every fixture is (Fixtures.read), gives its whole text; reading changes nothing.
//
// Panels, for the labels, the view model and the interface:
//   Panels.place(state, plan, pack)          the fixtures, as above (nothing for a state with
//                                            no rooms, a plan of null or a pack with no panels)
//   Panels.of(state, key) → {key, name, prose, module, sentence} | null   the panel `key` of
//                                            the visit's pack: module, the module whose
//                                            sentence it carries (null for none); sentence,
//                                            that sentence while the module is on, else null
//   Panels.text(state, key) → string | null  its whole text: its prose, then its sentence
//   Panels.banner(state, key) → string | null   its first sentence, then its sentence
//   Panels.inRoom(state, roomId) → fixture | null   the panel of a room (for the banner on
//                                            first entering it: dept.walked, Dept.walk)
//   Panels.room(state, f) → roomId | null    the room a panel fixture stands for
//   Panels.BANNER_WORDS                      50
'use strict';
const Panels = (() => {
  const BANNER_WORDS = 50;
  const isSection = key => typeof key === 'string' && /^s[1-9][0-9]*$/.test(key);
  // Modules met by a room's cases as well as by its flagged exhibits: their rules give cases
  // something (weather_cases: their weather, which any real case may hold).
  const BY_CASES = ['weather_cases'];
  const ORTHO = [0, 2, 4, 6];

  const partOf = pack => (pack && pack.panels && typeof pack.panels === 'object' ? pack.panels : null);
  const sectionsOf = P => (Array.isArray(P.sections) ? P.sections : []);
  // The pack's signature module: role 'signature', else its first; null for none.
  function signature(pack) {
    const mods = pack && Array.isArray(pack.modules) ? pack.modules : [];
    const m = mods.find(x => x && x.role === 'signature') || mods[0];
    return m ? m.id : null;
  }
  // The panel record of key in pack: {key, name, prose, module} or null.
  function record(pack, key) {
    const P = partOf(pack);
    if (!P || typeof key !== 'string') return null;
    if (key === 'intro') return P.intro && typeof P.intro.text === 'string' ? { key, name: P.intro.name || '', prose: P.intro.text, module: signature(pack) } : null;
    const s = sectionsOf(P).find(r => r && r.gallery === key);
    return s && typeof s.text === 'string' ? { key, name: s.name || '', prose: s.text, module: typeof s.module === 'string' ? s.module : null } : null;
  }
  const packOf = state => (state && state.dept && typeof state.dept.acc === 'string' ? Packs.get(state.dept.acc) : null);

  // ---- What a panel says ----

  // Panels.of(state, key): the panel key of the visit's pack, with its module's sentence while
  // the module is on, filled at the department's depth with the pack's params for it.
  function of(state, key) {
    const pack = packOf(state), r = record(pack, key);
    if (!r) return null;
    let sentence = null;
    if (r.module && Modules.on(state, r.module)) {
      const entry = (pack.modules || []).find(x => x && x.id === r.module);
      sentence = Clauses.sentence(r.module, { depth: state.dept.depth || 1, params: entry && entry.params ? entry.params : {} });
    }
    return { key: r.key, name: r.name, prose: r.prose, module: r.module, sentence };
  }
  // A text's first sentence: up to its first full stop, question or exclamation mark that ends
  // the text or is followed by a space.
  function first(text) {
    const m = /^[\s\S]*?[.?!](?=\s|$)/.exec(text);
    return (m ? m[0] : text).trim();
  }
  const join = (a, b) => (b ? `${a} ${b}` : a);
  // Panels.text(state, key): the panel's whole text.
  function text(state, key) { const p = of(state, key); return p ? join(p.prose, p.sentence) : null; }
  // Panels.banner(state, key): its first sentence and, while its module is on, its sentence.
  function banner(state, key) { const p = of(state, key); return p ? join(first(p.prose), p.sentence) : null; }

  // ---- Where they stand ----

  const panels = state => ((state && state.dept && state.dept.fixtures) || []).filter(f => f.k === 'panel');
  // Panels.room(state, f): the room a panel stands for (its fixture's room), or null.
  const room = (state, f) => (f && f.k === 'panel' && f.room !== undefined ? f.room : null);
  // Panels.inRoom(state, roomId): the panel standing for that room, or null.
  function inRoom(state, roomId) {
    for (const f of panels(state)) if (room(state, f) === roomId) return f;
    return null;
  }

  // Panels.place(state, plan, pack): the fixtures, as the header says.
  function place(state, plan, pack) {
    const m = state && state.dept, P = partOf(pack);
    if (!m || !plan || !P || !Array.isArray(m.rooms) || !m.roomOf || !Array.isArray(m.entrance) || !Array.isArray(m.fixtures)) return;
    const walk = Grid.distances(m, [m.entrance], m.w * m.h, null, 'exhibit');
    const reached = (x, y) => Grid.inside(m, x, y) && Grid.walkable(m, x, y) && walk[y * m.w + x] >= 0;
    const fixtureAt = (x, y) => m.fixtures.some(f => f.x === x && f.y === y);
    // The room's first entrance: its tiles you reach first, those you can walk to (walk >= 0)
    // at the least walk from the entrance, in row-major order; [] for a room you cannot walk into.
    function entryOf(rm) {
      let out = [], ew = -1;
      for (let y = rm.y0; y <= rm.y1; y++) for (let x = rm.x0; x <= rm.x1; x++) {
        if (!reached(x, y) || m.roomOf[y][x] !== rm.id) continue;
        const w = walk[y * m.w + x];
        if (ew < 0 || w < ew) { out = [[x, y]]; ew = w; } else if (w === ew) out.push([x, y]);
      }
      return out;
    }
    // The wall for room rm, [x, y] or null: a wall tile holding no fixture, beside (any of its
    // 8 neighbours) a tile of the room, that you can read from a tile of its first entrance
    // (within READ_RANGE, in sight); one beside (N, E, S or W) no tile of another public room
    // you could stand on (the staff band's and a doorway's do not count) before one that is;
    // then the nearest a tile of the first entrance (dx² + dy²), ties in row-major order. With
    // none, the wall nearest the first entrance that is beside (N, E, S or W) a tile of the room
    // you can walk to.
    const publicOther = (rm, x, y) => {
      const id = m.roomOf[y][x];
      if (!id || id === rm.id) return false;
      const q = m.rooms.find(r => r.id === id);
      return !!q && q.role !== 'staff';
    };
    const better = (s, b) => { if (b === null) return true; for (let i = 0; i < s.length; i++) if (s[i] !== b[i]) return s[i] < b[i]; return false; };
    function wallOf(rm) {
      const es = entryOf(rm);
      if (!es.length) return null;
      let best = null, bs = null;
      for (let y = rm.y0 - 1; y <= rm.y1 + 1; y++) for (let x = rm.x0 - 1; x <= rm.x1 + 1; x++) {
        if (!Grid.inside(m, x, y) || Grid.ch(m, x, y) !== '#' || fixtureAt(x, y)) continue;
        let near = false, walked = false, shared = false;
        for (let d = 0; d < 8; d++) {
          const nx = x + Grid.DX[d], ny = y + Grid.DY[d];
          if (!Grid.inside(m, nx, ny)) continue;
          if (m.roomOf[ny][nx] === rm.id) near = true;
          if (d % 2 !== 0 || !Grid.walkable(m, nx, ny)) continue;
          if (m.roomOf[ny][nx] === rm.id && reached(nx, ny)) walked = true;
          else if (publicOther(rm, nx, ny)) shared = true;
        }
        let read = false, d2 = -1;
        for (const [ex, ey] of es) {
          const dx = x - ex, dy = y - ey, r = near && Grid.disc(dx, dy, N.READ_RANGE) && Grid.los(m, ex, ey, x, y);
          if (r) read = true;
          if (d2 < 0 || dx * dx + dy * dy < d2) d2 = dx * dx + dy * dy;
        }
        if (!read && !walked) continue;
        const score = [read ? 0 : 1, shared ? 1 : 0, d2];
        if (better(score, bs)) { best = [x, y]; bs = score; }
      }
      return best;
    }
    const intro = m.rooms.find(r => r.role === 'intro') || null;
    const sections = m.rooms.filter(r => r.role === 'section' && isSection(r.key)).sort((a, b) => Number(a.key.slice(1)) - Number(b.key.slice(1)));
    const galleries = Array.isArray(pack.galleries) ? pack.galleries : [];
    const roomOfGallery = key => {
      const gi = galleries.findIndex(g => g && g.key === key);
      return gi < 0 ? null : sections.find(r => Array.isArray(r.galleries) && r.galleries.includes(gi)) || null;
    };
    const inRm = (rm, x, y) => Grid.inside(m, x, y) && m.roomOf[y][x] === rm.id;
    // Does room rm meet module id (above)?
    function meets(rm, id) {
      for (let i = 1; i < state.actors.length; i++) {
        const a = state.actors[i], sp = Packs.speciesFor(state, a);
        if (sp && Array.isArray(sp.flags) && sp.flags.includes(id) && inRm(rm, a.x, a.y)) return true;
      }
      return BY_CASES.includes(id) && m.fixtures.some(f => f.k === 'case' && !f.mimic && inRm(rm, f.x, f.y));
    }
    const put = (rm, key) => {
      const at = rm ? wallOf(rm) : null;
      if (at) m.fixtures.push({ k: 'panel', x: at[0], y: at[1], key, room: rm.id });
    };
    if (intro && record(pack, 'intro')) put(intro, 'intro');
    const taken = new Set();
    const list = sectionsOf(P).filter(s => s && isSection(s.gallery) && typeof s.text === 'string');
    const secondary = list.find(s => typeof s.module === 'string') || null;
    if (secondary) {
      const rm = sections.find(r => meets(r, secondary.module)) || roomOfGallery(secondary.gallery);
      if (rm) { taken.add(rm.id); put(rm, secondary.gallery); }
    }
    for (const s of list) {
      if (s === secondary) continue;
      let rm = roomOfGallery(s.gallery);
      if (!rm || taken.has(rm.id)) rm = sections.find(r => !taken.has(r.id)) || null;
      if (rm) { taken.add(rm.id); put(rm, s.gallery); }
    }
  }

  // The panel's reader (Fixtures.addReader; rules/fixtures.js): its whole text, read for
  // nothing within READ_RANGE and in sight; reading changes nothing.
  Fixtures.addReader('panel', (state, f) => {
    const t = text(state, f.key);
    return t ? { text: t, effects: null } : 'label_none';
  });

  return { BANNER_WORDS, place, banner, of, text, inRoom, room };
})();
