// ACCESSION — the mimic arena's policies (BUILD.md §10.3: two cases, one a mimic; open the
// real one). A mimic looks like a case, but its label has no accession number (its
// Behaviour line, §8.3); opened, it grips you and strikes. The naive policy opens the nearest
// case; the counterplay reads each case's label first and opens only one whose label gives
// an accession number. Both see only what a player sees (obs); the counterplay remembers in
// obs.memory which cases it has read and what each label said (mimics: the tiles of those
// with no number).
// A classic script, loaded into the hardened core context (tools/core-context.js).
'use strict';
(() => {
  // An accession number as a label shows it, on a line of its own: S.9.1.1, M.11.3.2.
  const NUMBER = /^[A-Z]+\.\d+(?:\.\d+)+$/m;
  const where = c => `${c.x},${c.y}`;

  // The shut cases in view, each with the way (Obs.path's tiles) to the nearest tile beside
  // it from which it can be opened (past no corner): [] for a case you can open from where
  // you stand. Nearest first, then the upper, then the left.
  function cases(obs) {
    const vm = obs.vm, me = Obs.you(vm), m = Obs.board(vm).dept, out = [];
    for (const c of vm.cases) {
      if (c.st !== 'shut') continue;
      if (Obs.legalAs(obs, { a: 'open', x: c.x, y: c.y })) { out.push({ x: c.x, y: c.y, way: [] }); continue; }
      let best = null;
      for (let d = 0; d < 8; d++) {
        const x = c.x + Grid.DX[d], y = c.y + Grid.DY[d];
        if ((x === me.x && y === me.y) || !Grid.walkable(m, x, y)) continue;
        if (Grid.DX[d] !== 0 && Grid.DY[d] !== 0 && !(Grid.walkable(m, c.x, y) && Grid.walkable(m, x, c.y))) continue;
        const p = Obs.path(vm, x, y);
        if (p.length && (best === null || p.length < best.length)) best = p;
      }
      if (best !== null) out.push({ x: c.x, y: c.y, way: best });
    }
    return out.sort((a, b) => (a.way.length - b.way.length) || (a.y - b.y) || (a.x - b.x));
  }

  // Open the case c if you stand beside it, else take the first step of the way to it; when
  // neither can be done (gripped: rooted to the spot), strike an exhibit beside you, else wait.
  function go(obs, c, why) {
    const open = Obs.legalAs(obs, { a: 'open', x: c.x, y: c.y });
    if (open && !c.way.length) return { action: open, reason: `opens the case at ${where(c)}: ${why}` };
    const me = Obs.you(obs.vm), d = c.way.length ? Path.dirTo([me.x, me.y], c.way[0]) : -1;
    const s = d < 0 ? null : Obs.legalAs(obs, { a: 'move', dir: d });
    if (s) return { action: s, reason: `steps ${Obs.DIRS[d]} toward the case at ${where(c)}, ${c.way.length} ${c.way.length === 1 ? 'step' : 'steps'} away: ${why}` };
    const foe = Obs.hostiles(obs.vm).find(f => Obs.attack(obs, f.uid));
    if (foe) return { action: Obs.attack(obs, foe.uid), reason: `cannot step toward the case at ${where(c)}; strikes ${foe.uid} beside it, which has ${foe.hp} HP` };
    return { action: { a: 'wait' }, reason: `cannot step toward the case at ${where(c)}; waits` };
  }
  const none = () => ({ action: { a: 'wait' }, reason: 'waits: no shut case it can reach is in view' });

  Policies.add('mimic_vitrine', {
    naive: {
      card: {
        summary: 'Opens the nearest shut case, then the next, without reading their labels.',
        rules: ['Of the shut cases in view, take the nearest by the way you would walk to stand beside it (ties: the upper, then the left).',
          'Beside it, open it; otherwise take the first step of that way.',
          'If no step is open (gripped), strike an exhibit beside you, else wait.'],
      },
      decide(obs) {
        const list = cases(obs);
        if (!list.length) return none();
        return go(obs, list[0], 'the nearest shut case');
      },
    },
    counter: {
      card: {
        summary: 'Reads the label of each shut case in view before opening any, and opens the nearest whose label gives an accession number, since a mimic\'s gives none.',
        rules: ['Read the label of every shut case in view once (reading takes no time). A case whose label has no accession number is a mimic.',
          'Of the shut cases not known to be mimics, take the nearest by the way you would walk to stand beside it (ties: the upper, then the left); if every one is a mimic, the nearest of all.',
          'Beside it, open it; otherwise take the first step of that way.',
          'If no step is open (gripped), strike an exhibit beside you, else wait.'],
      },
      decide(obs) {
        const mem = obs.memory;
        if (!mem.read) { mem.read = []; mem.mimics = []; }
        for (const c of obs.vm.cases) {
          if (c.st !== 'shut' || mem.read.includes(where(c))) continue;
          mem.read.push(where(c));
          const text = obs.read(`case:${where(c)}`);
          if (text !== null && !NUMBER.test(text)) mem.mimics.push(where(c));
        }
        const list = cases(obs);
        if (!list.length) return none();
        const real = list.filter(c => !mem.mimics.includes(where(c)));
        const said = mem.mimics.length ? `; the label at ${mem.mimics.join(' and ')} gives none` : '';
        if (real.length) return go(obs, real[0], `the nearest shut case whose label gives an accession number${said}`);
        return go(obs, list[0], 'no shut case\'s label gives an accession number, so the nearest');
      },
    },
  });
})();
