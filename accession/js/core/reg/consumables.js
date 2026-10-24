// ACCESSION — registry fragment: consumables, seals and identification (BUILD.md §8.6),
// owned by W1-CONSUMABLES. The eight kinds, the eight seals, the plaque fixture (an
// identifying label on the wall), and the events of drinking, throwing and reading.
'use strict';
(() => {
  const R = Registry;

  // The eight kinds, in the order of the DECK row (§8.10): `deck` indexes it.
  const kinds = [['consolidant', 'solution', 'Consolidant'], ['fixative', 'solution', 'Fixative'], ['fumigant', 'solution', 'Fumigant'],
    ['solvent', 'solution', 'Solvent'], ['card', 'ephemera', 'Catalogue Card'], ['plan', 'ephemera', 'Floor Plan'],
    ['quiet', 'ephemera', '“Quiet, Please”'], ['ticket', 'ephemera', 'Re-admission Ticket']];
  kinds.forEach(([id, cls, name], deck) => R.define('CONSUMABLES', id, { cls, name, deck }));
  // The seals: 4 wax seals shuffled over the Solutions and 4 ink stamps over the Ephemera,
  // each run (§8.6). A seal is a position; `n` indexes run.seals.sol or run.seals.eph.
  for (let n = 0; n < 4; n++) R.define('SEALS', 'wax' + (n + 1), { cls: 'solution', n });
  for (let n = 0; n < 4; n++) R.define('SEALS', 'ink' + (n + 1), { cls: 'ephemera', n });
  R.define('FIXTURES', 'plaque', {});

  // Events (§4.3): a kind identified for this run.
  R.defineEvent('identified', { fields: { seal: 'str', ck: 'str' } });
  for (const k of ['use', 'label', 'card']) R.defineCause('identified', k, { fields: { by: 'uid?' } });
  R.defineCause('used', 'consume', { fields: { ck: 'str?', seal: 'str', known: 'bool', gentle: 'bool?', x: 'int?', y: 'int?' } });
  R.defineCause('glass_broke', 'solvent', { fields: { by: 'uid', item: 'uid' } });
  R.defineCause('healed', 'item', { fields: { by: 'uid', item: 'uid' } });
  R.defineCause('status', 'item', { fields: { by: 'uid', item: 'uid' } });
  R.defineCause('noise', 'throw', { fields: { by: 'uid?', item: 'uid?' } });
})();
