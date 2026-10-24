// ACCESSION — consumables (BUILD.md §8.6): the eight kinds, their seals, the deck and
// identification. W0e names each call with a neutral body; W1-CONSUMABLES builds them.
// The run keeps run.seals ({sol: [4 kind indices], eph: [4]} once shuffled), run.knownSeals
// (the seals identified) and run.deck (the cards left of each kind, in DECK's order).
'use strict';
const Consumables = (() => {
  function startRun(state) {}                              // [stub → W1-CONSUMABLES] the run's seals, on 'seals'
  // [stub → W1-CONSUMABLES] The stand-in placement of the department's consumables and its
  // identifying labels: rooms on `${base}/items`, tiles on each room's populate stream in pop,
  // after the cases' and the kit's draws. Does nothing for now.
  function standIn(state, base, pop) {}
  const useLegal = state => [];                            // [stub → W1-CONSUMABLES] use(uid[, x, y]) of a consumable
  const useAction = (state, action, ev) => 'not_built';    // [stub → W1-CONSUMABLES]
  const known = (state, ck) => false;                      // [stub → W1-CONSUMABLES] is the kind ck identified this run
  const name = (state, it) => null;                        // [stub → W1-CONSUMABLES] {local, seal, kind | null}
  const targets = (state, uid) => [];                      // [stub → W1-CONSUMABLES] the tiles a consumable can be thrown at
  const view = (state, vis) => null;                       // [stub → W1-CONSUMABLES] what the view model shows of them

  // throw(uid, x, y), read(x, y) and choose(index) (§4.2). [stub → W1-CONSUMABLES]: nothing
  // is legal yet, and every candidate is refused as not built.
  Actions.define('throw', {
    legal: state => [],
    candidates: state => state.items.map(i => ({ a: 'throw', uid: i.uid, x: state.actors[0].x, y: state.actors[0].y })).concat([{ a: 'throw', uid: 'nothing', x: 0, y: 0 }, { a: 'throw' }]),
    apply: (state, action, ev) => 'not_built',
  });
  Actions.define('read', {
    legal: state => [],
    candidates: state => { const you = state.actors[0], out = [{ a: 'read', x: you.x, y: you.y }]; for (let d = 0; d < 8; d++) out.push({ a: 'read', x: you.x + Grid.DX[d], y: you.y + Grid.DY[d] }); return out.concat([{ a: 'read' }]); },
    apply: (state, action, ev) => 'not_built',
  });
  Actions.define('choose', {
    legal: state => [],
    candidates: state => [{ a: 'choose', index: 0 }, { a: 'choose', index: 1 }, { a: 'choose', index: -1 }, { a: 'choose' }],
    apply: (state, action, ev) => 'not_built',
  });

  return { startRun, standIn, useLegal, useAction, known, name, targets, view };
})();
