// ACCESSION — sentences: cases, glass, locks and staff doors (BUILD.md §8.3), owned by W1-CASES.
'use strict';
(() => {
  // Grades are written as on the badge (§8.7): Grade I … Grade VII.
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const grade = n => 'Grade ' + (Number.isInteger(n) && n >= 1 && n < ROMAN.length ? ROMAN[n] : String(n));
  const glass = n => { const id = Registry.order('GLASS').find(g => Registry.GLASS[g].n === n); return id ? Registry.GLASS[id].name : 'unknown'; };
  const bashes = n => n === 1 ? '1 bash' : `${n} bashes`;

  // Refusals (§4.2).
  Text.defineRefusal('behind_glass', () => 'Glass is in the way.');
  Text.defineRefusal('no_case', () => 'There is no closed case there.');
  Text.defineRefusal('case_locked', () => 'Its lock needs a higher grade than yours; you could break the glass instead.');
  Text.defineRefusal('glass_too_strong', () => 'A Light weapon cannot break Laminated or Security glass.');
  Text.defineRefusal('staff_grade', () => 'Staff only: this door needs a higher grade than yours.');

  // Staff doors.
  Text.defineCause('opened', 'staff', (e, w) => `${w.Name(e.who)} opened the staff door (${grade(e.cause.grade)}).`);

  // Opening, cracking and breaking a case.
  Text.define('case_opened', (e, w) => `${w.Name(e.by)} opened the ${glass(e.glass)} case (lock ${grade(e.lock)}).`);
  Text.defineCause('case_opened', 'grade', (e, w) => `${w.Name(e.by)} opened the ${glass(e.glass)} case (lock ${grade(e.cause.lock)}; ${w.name(e.by)} ${w.is(e.by)} ${grade(e.cause.grade)}).`);
  const cracked = (e, w) => `${w.Name(e.by)} cracked the ${glass(e.glass)} glass: ${e.hits} of ${bashes(e.need)}.`;
  Text.define('glass_cracked', cracked);
  Text.defineCause('glass_cracked', 'bash', (e, w) => cracked(e, w).replace(/\.$/, '') + (e.cause.count > 1 ? `, this swing counting ${e.cause.count}.` : '.'));
  const freed = (e, w) => e.released ? ` ${w.Name(e.released)} is free.` : '';
  const spread = e => e.shards && e.shards.length ? ', and shards spread' : '';
  Text.define('glass_broke', (e, w) => `${w.Name(e.by)} broke the ${glass(e.glass)} glass${spread(e)}.${freed(e, w)}`);
  Text.defineCause('glass_broke', 'bash', (e, w) => `${w.Name(e.by)} broke the ${glass(e.glass)} glass (${e.cause.hits} of ${bashes(e.cause.need)})${spread(e)}.${freed(e, w)}`);

  // The noise a case or a staff door makes, from its tile.
  const CLS = { soft: 'Soft', loud: 'Loud', crash: 'Crash' };
  const noise = what => e => `${CLS[e.cls] || 'A noise'}: ${what}, heard ${e.range} tiles away.`;
  Text.defineCause('noise', 'staff_door', noise('a staff door opening'));
  Text.defineCause('noise', 'case_opened', noise('a case opening'));
  Text.defineCause('noise', 'bash', noise('glass bashed'));
  Text.defineCause('noise', 'glass_broke', noise('glass breaking'));

  // Why a case woke what it held. A touch is an open or a bash (cause.how); `itself` is the
  // mimic, whose case is the mimic.
  const touched = c => c.itself ? `it was ${c.how === 'bashed' ? 'bashed' : 'opened'}, and it is no case` : `its case was ${c.how === 'bashed' ? 'bashed' : 'opened'}`;
  const why = {
    touch_case: touched,
    case_broken: () => 'its case was broken, and it has no home now',
    dissolved: c => c.itself ? 'it was dissolved, and it is no case' : 'its case was dissolved, and it has no home now',
  };
  Text.defineCause('pip', 'touch_case', (e, w) => `${w.Name(e.who)} stirs (${e.pips} of ${N.PIPS_TO_WAKE} pips): ${touched(e.cause)}.`);
  for (const k of ['touch_case', 'case_broken', 'dissolved']) {
    Text.defineCause('woke', k, (e, w) => `${w.Name(e.who)} woke: ${why[k](e.cause)}.`);
    Text.defineCause('hunting', k, (e, w) => e.was === 'dormant' ? `${w.Name(e.who)} woke and is hunting you: ${why[k](e.cause)}.` : `${w.Name(e.who)} is hunting you: ${why[k](e.cause)}.`);
  }
})();
