// ACCESSION — sentences: cases, glass, locks and staff doors (BUILD.md §8.3), owned by W1-CASES.
'use strict';
(() => {
  const glass = n => { const id = Registry.order('GLASS').find(g => Registry.GLASS[g].n === n); return id ? Registry.GLASS[id].name : 'Glass'; };
  Text.defineCause('opened', 'staff', (e, w) => `${w.Name(e.who)} opened the staff door (grade ${e.cause.grade}).`);
  Text.define('case_opened', (e, w) => `${w.Name(e.by)} opened the case (${glass(e.glass)}, lock ${e.lock}).`);
  Text.defineCause('case_opened', 'grade', (e, w) => `${w.Name(e.by)} opened the case: lock ${e.cause.lock}, within grade ${e.cause.grade}.`);
  Text.define('glass_cracked', (e, w) => `${w.Name(e.by)} cracked the ${glass(e.glass)} glass (${e.hits} of ${e.need}).`);
  Text.defineCause('glass_cracked', 'bash', (e, w) => `${w.Name(e.by)} cracked the ${glass(e.glass)} glass (${e.hits} of ${e.need}).`);
  Text.define('glass_broke', (e, w) => `${w.Name(e.by)} broke the ${glass(e.glass)} glass.`);
  Text.defineCause('glass_broke', 'bash', (e, w) => `${w.Name(e.by)} broke the ${glass(e.glass)} glass (${e.cause.hits} of ${e.cause.need}).`);

  const CLS = { soft: 'Soft', loud: 'Loud', crash: 'Crash' };
  const noise = what => e => `${CLS[e.cls] || 'A noise'}: ${what}, heard ${e.range} tiles away.`;
  Text.defineCause('noise', 'staff_door', noise('a staff door opening'));
  Text.defineCause('noise', 'case_opened', noise('a case opening'));
  Text.defineCause('noise', 'bash', noise('glass bashed'));
  Text.defineCause('noise', 'glass_broke', noise('glass breaking'));

  const why = { touch_case: 'its case was touched', case_broken: 'its case was broken', dissolved: 'its case was dissolved' };
  for (const k of ['touch_case', 'case_broken', 'dissolved']) {
    Text.defineCause('woke', k, (e, w) => `${w.Name(e.who)} woke: ${why[k]}.`);
    Text.defineCause('hunting', k, (e, w) => e.was === 'dormant' ? `${w.Name(e.who)} woke and is hunting you: ${why[k]}.` : `${w.Name(e.who)} is hunting you: ${why[k]}.`);
  }
})();
