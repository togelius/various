// ACCESSION — the splitter arena's policies (BUILD.md §10.3; test/arena/splitter.txt): a
// splitter in an open room. Each hit it survives with 2 or more health splits it into two
// halves, which split again, up to SPLIT_MAX splits deep (§8.1), and every half strikes. The
// two policies fight in the same way and differ only in their weapon (their kit, which the
// arena gives them): naive brings a T1 Light weapon, the counterplay a T1 Heavy one, whose
// harder hits leave less of a body to split and fell its halves in fewer hits. At grade I a
// T1 Heavy weapon is one grade short, as its label says, so it costs 2 Acc (§8.1).
//
// A classic script, loaded after lib.js into the hardened core context. Each policy sees only
// obs (Obs.make: the view model, the labels it reads, the legal actions) and keeps what it
// remembers in obs.memory, fresh for each run; this file keeps nothing of its own (§10.2).
'use strict';
(() => {
  // Turns without an exhibit in view before a policy leaves its place to look for one.
  const PATIENCE = 10;

  const at = (a, p) => !!p && a.x === p[0] && a.y === p[1];
  const byUid = (a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0);

  // The exhibits you can strike now (a legal attack), the weakest first, then the nearest,
  // then by uid.
  function strikable(obs) {
    const me = Obs.you(obs.vm);
    return Obs.hostiles(obs.vm).filter(f => Obs.attack(obs, f.uid))
      .sort((a, b) => (a.hp - b.hp) || (Obs.dist(a, me.x, me.y) - Obs.dist(b, me.x, me.y)) || byUid(a, b));
  }

  // Where an exhibit was last seen, and when (in memory), so that a policy that has seen none
  // for PATIENCE turns goes to look.
  function remember(obs) {
    const mem = obs.memory, foes = Obs.hostiles(obs.vm);
    if (mem.since === undefined) mem.since = obs.vm.turn;
    if (foes.length) { mem.since = obs.vm.turn; mem.last = [foes[0].x, foes[0].y]; }
    return foes;
  }

  // The one way both policies fight; `weapon` names theirs, for the reasons.
  const fight = weapon => obs => {
    const vm = obs.vm, mem = obs.memory, me = Obs.you(vm), foes = remember(obs), s = strikable(obs);
    if (s.length) {
      const f = s[0], more = foes.length - 1;
      return { action: { a: 'attack', uid: f.uid }, reason: `strikes ${f.uid} beside it with its ${weapon} weapon, ${f.hp} of ${f.maxHp} HP left` + (more ? `, with ${more} more in view` : '') };
    }
    for (const f of foes) {
      const st = Obs.step(obs, f.x, f.y);
      if (st) return { action: st, reason: `steps ${Obs.DIRS[st.dir]} toward ${f.uid}, ${Obs.dist(f, me.x, me.y)} tiles away` };
    }
    if (vm.turn - mem.since >= PATIENCE && mem.last && !at(me, mem.last)) {
      const st = Obs.step(obs, mem.last[0], mem.last[1]);
      if (st) return { action: st, reason: `steps ${Obs.DIRS[st.dir]} toward ${mem.last[0]},${mem.last[1]}, where it last saw an exhibit ${vm.turn - mem.since} turns ago` };
    }
    return { action: { a: 'wait' }, reason: foes.length ? 'waits: no way toward an exhibit in view' : 'waits: no exhibit in view' };
  };
  const rules = Object.freeze([
    'If an exhibit beside it can be struck, strike the one with the least health (then the nearest, then by uid), so that the halves it has made fall first.',
    'Otherwise, if an exhibit is in view, take the first step of the way a tap on the nearest would walk.',
    `Otherwise, if it has seen no exhibit for ${PATIENCE} turns, walk toward where it last saw one.`,
    'Otherwise, wait.',
  ]);
  const weights = Object.freeze([Object.freeze(['turns without an exhibit in view before it goes to look', PATIENCE])]);

  Policies.add('splitter', {
    naive: {
      card: { summary: 'Fights the splitter with a T1 Light weapon: many small hits, each of which the body or a half may survive and split on.', rules, weights },
      kit: { weapon: { form: 'light', tier: 1 } },
      decide: fight('Light'),
    },
    counter: {
      card: { summary: 'Fights the splitter as naive does, but with a T1 Heavy weapon: fewer, harder hits, which leave less of a body to split and fell its halves sooner.', rules, weights },
      kit: { weapon: { form: 'heavy', tier: 1 } },
      decide: fight('Heavy'),
    },
  });
})();
