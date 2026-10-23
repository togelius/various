// ACCESSION — the grammar registry (BUILD.md §5.1): the nine universal systems and the
// slice's triggers, archetypes, modifiers and modules, each with the clause its Behaviour
// line is built from. A clause states exactly what the rule code does; the scenario tests
// named in `tests` prove it (they arrive with the rule, in M3 and M4).
'use strict';
const Registry = (() => {
  // DECISIONS.md, "Nine universal systems": the sentence the player is taught.
  const SYSTEMS = [
    { id: 'moving', icon: 'damage', name: 'Moving and fighting', sentence: 'Tap to move; bump into something to attack it. Ordinary blows roll dice, and the odds are shown before you commit. Dangerous moves are marked on the floor with their exact damage, and never miss. Your health recovers slowly.' },
    { id: 'waking', icon: 'ring', name: 'Waking', sentence: 'Every exhibit is asleep, stirring or awake. Being close or making noise fills its three pips; the ring around you shows what counts as close. A species may have one extra trigger, shown as one icon.' },
    { id: 'cases', icon: 'touch_case', name: 'Cases', sentence: 'You can see through glass but not walk through it. Open a case if your grade allows, or break it, loudly.' },
    { id: 'clock', icon: 'clock', name: 'The clock', sentence: 'At the bell your recovery slows; later the night watch begins its rounds, waking whatever is nearest to you.' },
    { id: 'kit', icon: 'kit', name: 'Your kit', sentence: 'A weapon, a garment, two curios and an instrument. Restoration kits improve them.' },
    { id: 'consumables', icon: 'seal', name: 'Consumables', sentence: 'A handful of kinds, unlabelled until you have used one or read about it.' },
    { id: 'grade', icon: 'certificate', name: 'Grade', sentence: 'Each department’s Certificate, earned by defeating or viewing its Centrepiece, raises your grade by one: more health, a perk chosen from three, heavier objects, higher-grade cases.' },
    { id: 'labels', icon: 'reads', name: 'Labels', sentence: 'Every exhibit and object has one: a plain Behaviour line that states exactly what it does, and a paragraph that is only for reading.' },
    { id: 'doors', icon: 'highlight', name: 'Doors', sentence: 'Each department ends in doors whose placards say what kind of trouble lies behind each.' },
  ];
  const MAX_SYSTEMS = 10;

  // Special triggers: at most one per species (BUILD.md §8.2).
  const TRIGGERS = {
    axis: { icon: 'axis', clause: 'also wakes when you stand in its row or column within 8 tiles, in sight' },
    period: { icon: 'period', clause: 'wakes on the chime to perform, then sleeps again' },
    tether: { icon: 'tether', clause: 'wakes at once when you come within 2 tiles of what it guards' },
    touch_case: { icon: 'touch_case', clause: 'wakes at once when its case is opened, bashed or touched' },
    ally_hit: { icon: 'ally_hit', clause: 'wakes at once when one of its group within 5 tiles is struck' },
    alarm: { icon: 'alarm', clause: 'wakes at once when the alarm is raised' },
    awake: { icon: 'awake', clause: 'never sleeps' },
  };

  // Archetypes in the slice (design/vocabulary.md §2.1, trimmed per BUILD.md §5.5).
  const ARCHETYPES = {
    plodder: { clause: 'Walks one tile at a time and strikes from beside you.' },
    darter: { clause: 'Moves two tiles a turn; strikes, then steps back one.', speed: 'fast' },
    kiter: { clause: 'Keeps 3 to 5 tiles from you and shoots; backs away when you are beside it.', ranged: true },
    axis_sniper: { clause: 'Aims along its row or column for a turn, with the line shown, then fires a beam up to 10 tiles that passes through glass.', ranged: true },
    splitter: { clause: 'A blow that does not destroy it splits it in two, each with half its health, at most twice.' },
    mote_swarm: { clause: 'Comes as several bodies that each fall to one blow; they move up to two tiles a turn and surround you.' },
    herald: { clause: 'On seeing you it calls for one turn, shown, then wakes every sleeping exhibit within 6 tiles.' },
    tethered_warden: { clause: 'Never goes more than 2 tiles from what it guards; strikes hard; heals and settles when you leave.' },
    reflector: { clause: 'Sends beams and shots back along their line and shields whatever stands behind it; weak in a fight.' },
    mimic_vitrine: { clause: 'Looks like a case. Touched, it grips you (you cannot move for 2 turns) and strikes, then fights slowly.' },
    night_watchman: { clause: 'Comes for you wherever you are; if defeated, it returns 20 turns later.' },
    unobserved_mover: { clause: 'Moves two tiles a turn, but only while you cannot see it; strikes hard from beside you.' },
    patrol_guard: { clause: 'Walks a fixed round. On seeing you it raises the alarm for one turn, then gives chase; after 20 turns without you it goes back to its round.' },
    demonstrator: { clause: 'Keeps to its track and never chases. On the chime it performs the demonstration on its label.' },
    conservator_healer: { clause: 'Stays behind its allies and spends a turn, shown, restoring one; backs away when you come close.' },
    completing_guardian: { clause: 'Grows one limb for every two galleries you have walked, up to four; each limb is a special. Leaving its room heals it and drops one limb.' },
    mp_ensemble: { clause: 'Several pieces share one health pool. When a piece falls, the others take on its special.' },
    mp_tableau: { clause: 'Stays in its frame and alternates shown lines and bursts; takes double damage while it summons.' },
  };

  // Modifiers, trimmed to what the slice implements (BUILD.md §5.5).
  const MODIFIERS = {
    glass: { clause: 'Its body does not block sight; it leaves shards when destroyed.' },
    clockwork: { clause: 'Shows its next move as an arrow and cannot be dazed; rain stops it for 2 turns.' },
    old_repair: { clause: 'One side is a later repair and takes double damage.' },
    marble: { clause: 'Moves at half speed.' },
    plaster: { clause: 'A cast: when destroyed it crumbles into dust that blocks sight for 3 turns.' },
  };

  const MODULES = {
    unobserved_motion: { sentence: 'The animals move only when you cannot see them.' },
    alarm_network: { sentence: 'The waders raise the alarm when they see you; then the whole court is awake.' },
    copies_weaken: { sentence: 'When an original is broken, its spares lose heart.' },
    hourly_demonstration: { sentence: 'On the chime, the stations exchange signals down the length of the gallery.' },
    weather_cases: { sentence: 'Some cases hold weather. Break one, and the weather gets out.' },
  };

  // The Behaviour line for a species: archetype, modifiers, waking (BUILD.md §5.3).
  function behaviour(sp) {
    const parts = [ARCHETYPES[sp.archetype] ? ARCHETYPES[sp.archetype].clause : ''];
    for (const m of sp.modifiers || []) if (MODIFIERS[m]) parts.push(MODIFIERS[m].clause);
    const t = sp.trigger && TRIGGERS[sp.trigger];
    if (t && sp.trigger === 'awake') parts.push('It never sleeps.');
    else parts.push('Wakes when you stay inside your ring or make noise near it' + (t ? '; ' + t.clause : '') + '.');
    return parts.filter(Boolean).join(' ');
  }

  return { SYSTEMS, MAX_SYSTEMS, TRIGGERS, ARCHETYPES, MODIFIERS, MODULES, behaviour };
})();
