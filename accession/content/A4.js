// ACCESSION — A.4 Things Kept in Duplicate, Before the Repeal (design/samples.md §4, trimmed
// per BUILD.md §5.5). Paragraphs are only for reading; the rules are in the Behaviour lines.
'use strict';
Packs.add({
  acc: 'A4', number: 'A.4', title: 'Things Kept in Duplicate, Before the Repeal', family: 'Copies', palette: 'A4',
  programme: 'case_labyrinth', claim: { primary: 'swarm', secondary: 'locks' },
  houseRule: 'Every object shall be issued with a spare.',
  blurb: 'For the length of the Duplicate Ordinance, every object the Museum made or acquired had to be issued with a certified spare.',
  modules: [{ id: 'copies_weaken' }],
  species: [
    { id: 'A4.1', sprite: 'seated_clerk', archetype: 'plodder', role: 'fodder', modifiers: ['marble'], trigger: 'ally_hit', group: 'clerks',
      name: 'Seated Clerk of the Ordinance Office',
      tomb: { maker: 'Workshop of the Office’s own carver', date: 'During the Duplicate Ordinance', medium: 'Marble; pen hand replaced', dims: 'H. 118 cm', credit: 'Transferred from the Ordinance Office' },
      paragraph: 'The Ordinance Office commissioned a figure of a clerk at work to sit at its counter, and was then obliged by its own rule to commission a spare. It commissioned three. The original sat behind glass and the spares sat at the counter, where they turned out to be better at the work. Keepers note that the spares have kept their posture only while the original keeps its own. The one time it was knocked over, all three slumped.' },
    { id: 'A4.1a', sprite: 'seated_clerk', archetype: 'plodder', role: 'fodder', modifiers: ['plaster'], trigger: 'ally_hit', group: 'clerks',
      name: 'Seated Clerk, Certified Spare',
      tomb: { maker: 'After A.4.1', date: 'During the Duplicate Ordinance', medium: 'Plaster cast after the marble; base stamped CERTIFIED TRUE COPY', dims: 'H. 118 cm', credit: 'Transferred from the Ordinance Office' },
      paragraph: 'Spare (a) of three. For the original, see the case at the end of this row.' },
    { id: 'A4.2', sprite: 'flimsies', archetype: 'mote_swarm', role: 'swarm', modifiers: [], trigger: null,
      name: 'Carbon Flimsies, in Bundles',
      tomb: { maker: 'The Ordinance Office typing pool', date: 'During the Duplicate Ordinance', medium: 'Onionskin and carbon, tied with pink tape', dims: 'Each sheet 33 × 21 cm', credit: 'Transferred from the Ordinance Office' },
      paragraph: 'Every form issued under the Ordinance had a spare typed underneath it on carbon paper, and the spares were kept, which is why there are so many. Released from their bundles, the registry staff report, they drift in a body towards anything that moves and settle on it.' },
    { id: 'A4.3', sprite: 'copying_bell', archetype: 'herald', role: 'support', modifiers: [], trigger: null,
      name: 'Copying-Room Bell',
      tomb: { maker: 'Supplied to the Ordinance Office', date: 'During the Duplicate Ordinance', medium: 'Bell metal on a cast-iron stand', dims: 'H. 140 cm', credit: 'Transferred from the Ordinance Office' },
      paragraph: 'The bell was rung whenever a spare was found to be without a spare of its own, and the whole Office stood up. It still rings at the sight of anyone it does not know, and nobody in the Copying Room has ever slept through it.' },
    { id: 'A4.4', sprite: 'trustee_bust', archetype: 'splitter', role: 'brute', modifiers: ['marble'], trigger: 'ally_hit', group: 'trustees',
      name: 'Bust of the Proposing Trustee',
      tomb: { maker: 'Workshop of the Office’s own carver', date: 'During the Duplicate Ordinance', medium: 'Marble', dims: 'H. 64 cm', credit: 'Transferred from the Ordinance Office' },
      paragraph: 'The original, kept under glass so that it would never be handled. The Trustee’s family asked for a spare for themselves and were refused, on the grounds that the spares were the Museum’s.' },
    { id: 'A4.4a', sprite: 'trustee_bust', archetype: 'splitter', role: 'brute', modifiers: ['plaster'], trigger: 'ally_hit', group: 'trustees',
      name: 'Bust of the Proposing Trustee, Certified Spare',
      tomb: { maker: 'After A.4.4', date: 'During the Duplicate Ordinance', medium: 'Plaster cast after the marble; stamped CERTIFIED TRUE COPY', dims: 'H. 64 cm', credit: 'Transferred from the Ordinance Office' },
      paragraph: 'The Trustee who proposed the Ordinance sat for one bust and was issued with two spares, as the rule required. The spares were handled and damaged often, and under the Ordinance a damaged spare had to be replaced at once with two. The night staff report that the spares now attend to this themselves.' },
    { id: 'A4.5', sprite: 'countersigning_clerk', archetype: 'conservator_healer', role: 'support', modifiers: ['clockwork'], trigger: null,
      name: 'Countersigning Clerk, Automaton',
      tomb: { maker: 'Made for the Ordinance Office by the Workshops of the Line', date: 'During the Duplicate Ordinance', medium: 'Brass, steel; escapement; pen arm and inkwell', dims: 'H. 132 cm', credit: 'Transferred from the Ordinance Office' },
      paragraph: 'No spare was valid until it had been countersigned, so the Office had a clerk built to do it, and the human clerks went home. The Office’s records say it countersigns anything damaged within its reach, taking a moment over each signature. It does not like to be approached while it is signing. It has never been countersigned itself.' },
  ],
  // Items (§5.2, §8.5): the sample's equipment (design/samples.md §4.6), trimmed per §5.5.
  // Each keeps the sample's form, and a primitive the slice lacks is replaced by one it has,
  // of the same budget (S 1, M 2, L 3; a flag 2; each of the slice's instruments 2): the
  // Date Stamp, Light as in the sample, swaps its sweep flag for the reach flag; the Sleeve
  // Protectors' resist(fire, S) becomes Eva(S); the Register takes the sample's own fallback
  // without L+, perception(M), as Acc(M). The Stamp Moistener is cut: its effect,
  // bolt(water, S), is worth 1, and each instrument the slice has is worth 2. The Repealing
  // Pen is the Signature piece, which waits for M4.
  items: [
    { id: 'A4.6', kind: 'weapon', form: 'light', prims: [{ id: 'dmg', cls: 'S' }, { id: 'reach', cls: 'M' }],
      name: 'Long-Handled Date Stamp',
      tomb: { maker: 'Ordinance Office registry', date: 'During the Duplicate Ordinance', medium: 'Iron, rubber die, ash handle', dims: 'L. 118 cm', credit: 'Transferred from the Ordinance Office' },
      paragraph: 'Made for stamping RECEIVED on forms laid out in rows on the registry floor, so that a clerk need never bend or step between them. The handle is long enough to stamp the row beyond the one at your feet. The die reads RECEIVED on one face and RECEIVED AGAIN on the other.' },
    { id: 'A4.7', kind: 'weapon', form: 'heavy', prims: [{ id: 'dmg', cls: 'L' }],
      name: 'Paperweight of the Ordinance Office, One of a Pair',
      tomb: { maker: 'Ordinance Office', date: 'During the Duplicate Ordinance', medium: 'Cast iron', dims: 'H. 11 cm; heavier than it looks', credit: 'Transferred from the Ordinance Office' },
      paragraph: 'Issued in pairs under the Ordinance, so that a desk would never be without one. The other is lost, which the Office regarded as proof that the rule worked. It is best used once, firmly.' },
    { id: 'A4.8', kind: 'garment', form: 'light', prims: [{ id: 'pad', cls: 'S' }, { id: 'eva', cls: 'S' }],
      name: 'Clerk’s Sleeve Protectors',
      tomb: { maker: 'Office stores', date: 'During the Duplicate Ordinance', medium: 'Oilcloth, elastic', dims: 'L. 30 cm', credit: 'Transferred from the Ordinance Office' },
      paragraph: 'Worn by the typing pool against ink and carbon, and by the registry against the duplicator. The oilcloth is slippery and wipes clean, and the Office noted that a sleeve caught on a counter or a cabinet slid free at once, which was the point of choosing it.' },
    { id: 'A4.10', kind: 'curio', prims: [{ id: 'acc', cls: 'M' }],
      name: 'Register of Certified Spares, Volume II',
      tomb: { maker: 'Ordinance Office registry', date: 'During the Duplicate Ordinance', medium: 'Paper, bound in green cloth; Volume I missing, its spare also missing', dims: 'H. 34 cm', credit: 'Transferred from the Ordinance Office' },
      paragraph: 'Every original issued under the Ordinance, with every spare made of it, the date, the material, and the clerk responsible. Its readers learned to look for the one detail that tells an original from its spare, and the habit of looking hard stayed with them. The Office considered a forgery and a spare two different things.' },
  ],
  // Consumables (§5.2, §8.6): a local name for each seal (the 4 Solutions' seals, then the
  // 4 Ephemera's; a name never says which kind lies under the seal, since the seals are
  // shuffled every run, so no label of the pack describes the thing a name is), and an
  // identifying label for each kind.
  consumables: {
    names: ['Office Carafe, Certified Spare', 'Lidded Tumbler, Typing Pool', 'Violet Glass Bottle, Unlabelled', 'Canister, One of a Pair',
      'Carbon Envelope, Gummed Shut', 'Form in Triplicate', 'Memorandum, Second Copy', 'Circular to All Staff, Unread'],
    labels: {
      consolidant: 'Consolidant was issued to the Office’s restorers, in duplicate as the Ordinance required, for spares that had begun to come apart. Drunk, it closes a clerk’s wounds at once and goes on mending them for a little while after. Thrown, it mends everything it splashes, originals and spares alike, which the Office regarded as only fair.',
      fixative: 'Fixative was sprayed on documents so that nothing written on them could ever be changed. A clerk who drank some, the Office records, could neither move nor lift a pen until it wore off, and was marked absent. Thrown, it holds everything it splashes exactly in place for as long, and the Office used it to keep its queues orderly.',
      fumigant: 'Fumigant was sprayed through the registry against silverfish, and the Office forbade anyone to drink it. One clerk did, and coughed for some time, loudly enough to be heard several desks away. Thrown, it rises as a cloud that no one can see through, and any exhibit asleep inside it sleeps the deeper while the cloud lasts.',
      solvent: 'Solvent was the Office’s answer to a case whose key had been certified but never issued. Thrown at the glass, it dissolves it without a sound and without leaving a shard. Drunk, it rids a clerk of every lingering ill the department has left on them, though not of their bruises, which the Office did not cover.',
      card: 'The Catalogue Card is the Office’s index of its own preparations and papers, kept in duplicate. Read, it tells you what lies under one seal you do not yet know, so that nobody need taste anything to find out. The Office issued a card for every seal and a spare card for every card, and lost the spares first.',
      plan: 'The Floor Plan was drawn so that the Office could prove it held a spare of every room. Read, it shows you the whole department, every aisle of cases included, and the rooms where its Highlights still wait. The spare plan was certified true and shows a different building, which the Office has never investigated.',
      quiet: '“Quiet, Please” was posted in the Copying Room whenever the bell had been rung by mistake. Read aloud, it calms every exhibit within earshot: the stirring settle back into sleep, the wandering fall asleep where they stand, and those already hunting you stop, though they stay awake and look about. The Night Watchman takes no notices from the Office.',
      ticket: 'The Re-admission Ticket is the Office’s permission to start again. Read, it returns you to the department’s entrance, and everything hunting you loses your trail, except the Night Watchman, who never loses anyone’s. Each ticket was issued with a spare, so that no visitor could be turned away twice for the same mistake.',
    },
  },
  centrepiece: { id: 'A4.12', sprite: 'ordinance_original', archetype: 'mp_ensemble', form: 'fight', size: 1,
    name: 'The Duplicate Ordinance, With Its Four Certified Copies',
    tomb: { maker: 'Drafted by the Ordinance Office; copies by the typing pool', date: 'Signed after the Night of the Unlocked Door; repealed after the Second Inventory', medium: 'Ink on paper, five sheets, each framed on its own lectern', dims: 'Each sheet 42 × 30 cm', credit: 'Transferred from the Ordinance Office' },
    paragraph: 'The Ordinance required that it be issued with spares like everything else, so there are five of it. Only one was signed by the Trustees; the other four were certified as true by the Office, which is not the same thing. They have always been displayed together. The Office’s own note, pinned to the first lectern, advises dealing with the signed original first.' },
});
