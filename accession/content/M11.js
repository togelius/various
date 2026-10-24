// ACCESSION — M.11 Long Galleries, Considered as Telegraph Lines (design/samples.md §2,
// trimmed per BUILD.md §5.5). Paragraphs are only for reading; the rules are in the Behaviour lines.
'use strict';
Packs.add({
  acc: 'M11', number: 'M.11', title: 'Long Galleries, Considered as Telegraph Lines', family: 'Machines', palette: 'M11',
  programme: 'enfilade', claim: { primary: 'artillery', secondary: 'hazard' },
  houseRule: 'The line is cleared on the chime.',
  blurb: 'The building was once too long for a voice to cross, so its longest galleries were fitted as signalling lines.',
  modules: [{ id: 'hourly_demonstration' }, { id: 'weather_cases' }],
  species: [
    { id: 'M11.1', sprite: 'heliograph', archetype: 'axis_sniper', role: 'artillery', modifiers: ['glass'], trigger: 'axis',
      name: 'Heliograph, Landing Pattern',
      tomb: { maker: 'Workshops of the Line', date: 'After the Second Calibration', medium: 'Silvered glass; iron tripod; canvas hood', dims: 'H. 168 cm', credit: 'Transferred from the Line Superintendent’s Office' },
      paragraph: 'A heliograph speaks along a straight line and only along it. This one stood at the landing where the long gallery turns, and could talk to the station ahead or the station behind but never round the corner, which the logbooks complain about at length. Its operators wore smoked spectacles and stood well to one side. Keepers report that it still takes a moment to gather the light before it sends.' },
    { id: 'M11.2', sprite: 'semaphore', archetype: 'demonstrator', role: 'controller', modifiers: ['clockwork'], trigger: 'period',
      name: 'Semaphore Station, Two-Armed',
      tomb: { maker: 'Workshops of the Line', date: 'After the Second Calibration', medium: 'Painted oak arms; brass, steel; escapement; timetable card in a frame', dims: 'H. 240 cm', credit: 'Transferred from the Line Superintendent’s Office' },
      paragraph: 'The station’s timetable is pinned to its own frame, in a clerk’s hand, and it is still followed: the arms are raised on the chime and swept down the line, and at no other time. Between chimes the station travels its short rail at the side of the gallery and waits. The logbooks record eleven injuries to linesmen who knew the timetable perfectly well and stood in the line anyway.' },
    { id: 'M11.3', sprite: 'signal_lamp', archetype: 'kiter', role: 'artillery', modifiers: ['old_repair'], modParams: { old_repair: { side: 'W' } }, trigger: null,
      name: 'Signal Lamp on a Walking Tripod',
      tomb: { maker: 'Workshops of the Line', date: 'After the Second Calibration', medium: 'Iron, oil reservoir, shutter of tinplate; the west leg, as displayed, a later repair in pine', dims: 'H. 152 cm', credit: 'Transferred from the Line Superintendent’s Office' },
      paragraph: 'Where a heliograph could not reach, a lamp was walked out to a better position. The Line’s records say this one was built to keep a fixed distance from whatever it was signalling to, backing away if anyone came too close, so that its beam would never need re-aiming. The linesmen called it the Courtier, and did not explain why.' },
    { id: 'M11.4', sprite: 'reflecting_dish', archetype: 'reflector', role: 'controller', modifiers: [], trigger: null,
      name: 'Reflecting Dish, on a Cart',
      tomb: { maker: 'Workshops of the Line', date: 'After the Second Calibration', medium: 'Polished tinplate, oak cart, iron wheels', dims: 'Diam. 110 cm', credit: 'Transferred from the Line Superintendent’s Office' },
      paragraph: 'Dishes like this were wheeled into the line to turn a signal down a side gallery. The Line was proud of them. A dish returned a lamp’s beam along exactly the path it came, so a careless operator could find their own signal coming straight back at them, and several did. Keepers report that it is happiest with a station standing behind it.' },
    { id: 'M11.5', sprite: 'logbook_trolley', archetype: 'plodder', role: 'fodder', modifiers: [], trigger: null,
      name: 'Logbook Trolley, Self-Propelled',
      tomb: { maker: 'Workshops of the Line', date: 'After the Second Calibration', medium: 'Oak, iron; logbooks 14–22', dims: 'H. 96 cm', credit: 'Gift of the Retired Line Superintendent' },
      paragraph: 'The trolley carried the day’s logbooks from station to station so that every operator could sign them. Keepers report that it follows the nearest person at a steady walking pace, which on a busy day was the right speed and on a quiet night is not. Logbooks 14 to 22 are still aboard. They record nine years of signals and not one message. Please do not sign them.' },
  ],
  // Items (§5.2, §8.5): the sample's equipment (design/samples.md §2.6), trimmed per §5.5.
  // A primitive the slice lacks is replaced by one it has, of the same budget (S 1, M 2,
  // L 3; a flag, or an instrument's effect, 2): the Hand Lamp's bolt(light, M) becomes the
  // Pin-Driver's ranged attack, which is the same bolt without the damage kind; the Apron's
  // armour(S) and resist(light, S) become Padding(M). The Spare Lamp Hood is cut: its
  // extinguish(M) needs light, which the slice lacks. The Pocket Heliograph is the
  // Signature piece, which waits for M4.
  items: [
    { id: 'M11.6', kind: 'instrument', instrument: 'pin_driver', prims: [],
      name: 'Hand Lamp With a Signalling Shutter',
      tomb: { maker: 'Workshops of the Line', date: 'After the Second Calibration', medium: 'Tinplate, oil, blackened shutter', dims: 'H. 28 cm', credit: 'Transferred from the Line Superintendent’s Office' },
      paragraph: 'Issued to every operator for signalling at short range. Snapped open, the shutter throws a hard, bright bolt at whatever it is pointed at, which is how most arguments between stations were settled. Its fillings were rationed, and the logbooks record each one.' },
    { id: 'M11.7', kind: 'garment', form: 'standard', prims: [{ id: 'pad', cls: 'M' }],
      name: 'Linesman’s Smoked Apron',
      tomb: { maker: 'Line stores', date: 'After the Second Calibration', medium: 'Smoked leather, iron buckles', dims: 'L. 104 cm', credit: 'Gift of the Retired Line Superintendent' },
      paragraph: 'Worn by anyone working in front of a heliograph. The leather was smoked dark so that it would not shine, and it is thick enough to take the worst of a beam, or of a blow. The rules required it to be buckled, and the rules were ignored.' },
    { id: 'M11.9', kind: 'weapon', form: 'reach', prims: [{ id: 'dmg', cls: 'M' }],
      name: 'Signal Flag on Its Staff, Furled',
      tomb: { maker: 'Line stores', date: 'After the Second Calibration', medium: 'Wool bunting, ash staff, iron ferrule', dims: 'L. 2.6 m', credit: 'Transferred from the Line Superintendent’s Office' },
      paragraph: 'Flags were used where lamps could not be lit and heliographs could not be carried. Furled, the staff is long enough to reach past the person in front of you, which, the logbooks suggest, is how it was mostly used on busy days. The bunting has faded from red to a colour the Line called signal pink.' },
  ],
  // Consumables (§5.2, §8.6): a local name for each seal (the 4 Solutions' seals, then the
  // 4 Ephemera's; a name never says which kind lies under the seal, since the seals are
  // shuffled every run), and an identifying label for each kind.
  consumables: {
    names: ['Enamel Tin, Hinged Lid', 'Battery Jar, Corked', 'Linesman’s Canteen', 'Stoneware Bottle, Line Stores',
      'Telegram, Undelivered', 'Signal Form, Folded in Four', 'Timetable Slip, Superseded', 'Logbook Leaf, Unsigned'],
    labels: {
      consolidant: 'Consolidant was kept at every station to stop old signal arms from splitting along the grain. Drunk, it closes an operator’s cuts at once and goes on mending them for a little while after, and the linesmen swore by it. Thrown, it mends everything it splashes, stations and trolleys included, which the Line considered a waste of a good tin.',
      fixative: 'Fixative was painted on the Line’s timetables so that no one could alter them. An operator who drank some stood at the signal as if bolted to the floor, unable to move a hand, until it wore off, and the logbooks note that the line was never better kept. Thrown, it holds everything it splashes in place for as long.',
      fumigant: 'Fumigant was sprayed through the long galleries against moth in the bunting. Drunk, the logbooks say, it sets an operator coughing for some time, loudly enough for anyone nearby to hear. Thrown, it rises as a cloud that no lamp or heliograph can see through, and any exhibit asleep inside it sleeps the deeper while the cloud lasts.',
      solvent: 'Solvent was used by the Line to strip old varnish from its instrument cases. Thrown at a case, it takes the glass out of it entirely, without a sound, which the night operators appreciated. Drunk, it rids an operator of every lingering ill the galleries have left on them, though not of their bruises, and the Line did not recommend it.',
      card: 'The Catalogue Card is the Line’s register of its preparations and papers, kept at the Central Station. Read, it tells you what lies under one seal you do not yet know, which the Line preferred to finding out by tasting. Each card is signed by the station that wrote it, and none by the station that read it.',
      plan: 'The Floor Plan shows the department as the Superintendent’s Office drew it, with the staff corridor marked for linesmen only. Read, it shows you every gallery, and the rooms where its Highlights still wait. It is the only plan the Line ever issued that shows the galleries going round a corner.',
      quiet: '“Quiet, Please” was posted on the signal board whenever the Line was being inspected. Read aloud, it calms every exhibit within earshot: the stirring settle back into sleep, the wandering fall asleep where they stand, and those already hunting you stop, though they stay awake and look about. The Night Watchman pays it no attention.',
      ticket: 'The Re-admission Ticket is a printed slip that lets a linesman start the round again from the first station. Read, it returns you to the department’s entrance, and everything hunting you loses your trail, except the Night Watchman, who never loses anyone’s. The Line printed them on the backs of old timetables.',
    },
  },
  centrepiece: { id: 'M11.11', sprite: 'great_board', archetype: 'mp_tableau', form: 'fight', size: 2,
    name: 'The Great Board of the Central Station',
    tomb: { maker: 'Painted by the Workshops of the Line, with later panels', date: 'Before the Second Calibration; repainted until the line closed', medium: 'Oil on boards, forty hinged panels; iron frame', dims: 'H. 3.2 m, W. 3.6 m', credit: 'Transferred from the Central Station' },
    paragraph: 'Every signal on the line arrived here and was posted on the Board by hand, so that the Central Station could see the state of the whole building at a glance. The Board shows times of sending and times of arrival, and nothing else. The clerks who kept it were trained to step out of its row whenever a panel changed.' },
});
