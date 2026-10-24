// ACCESSION — S.9 Animals Not Yet Seen by the Day Staff (design/samples.md §3, trimmed per
// BUILD.md §5.5). Paragraphs are only for reading; the rules are in the Behaviour lines.
'use strict';
Packs.add({
  acc: 'S9', number: 'S.9', title: 'Animals Not Yet Seen by the Day Staff', family: 'Specimens', palette: 'S9',
  programme: 'sculpture_court', claim: { primary: 'guarded', secondary: null },
  houseRule: 'Please keep the exhibits in view.',
  blurb: 'Every specimen here was catalogued from the night staff’s round books. The day curators accessioned the descriptions in good faith.',
  modules: [{ id: 'unobserved_motion' }, { id: 'alarm_network' }],
  species: [
    { id: 'S9.1', sprite: 'grazer', archetype: 'unobserved_mover', role: 'ambusher', modifiers: [], trigger: null,
      name: 'Long-Necked Grazer',
      tomb: { maker: 'Mounted by the preparators from Round Book 3', date: 'Collected after the Great Reshelving', medium: 'Hide over a carved lime form', dims: 'H. 2.4 m', credit: 'Accessioned on the night staff’s report' },
      paragraph: 'Reported, not observed. Round Book 3 places the grazer at the north end of the court at the start of one round and at the south end at the start of the next, and never anywhere in between. The keeper who made the entry added that they once kept their eyes on it for a whole round, and that it did not move at all. The day staff measured the floor for marks. There were none.' },
    { id: 'S9.2', sprite: 'wader', archetype: 'patrol_guard', role: 'warden', modifiers: [], trigger: 'awake',
      name: 'Lantern-Crop Wader',
      tomb: { maker: 'Mounted from the first entry in Round Book 1', date: 'Collected after the Great Reshelving', medium: 'Feathers, hide, wire; crop lined with luminous paint by the preparators', dims: 'H. 1.1 m', credit: 'Accessioned on the night staff’s report' },
      paragraph: 'Reported, not observed. The wader keeps the same round as the night staff, in the same direction, pausing at the same lecterns, and the night staff describe it as the only colleague who has never been late. Its crop glows faintly, which they find companionable. When it meets something on its round that was not there the last time, the round books say, it stands quite still for a moment and then calls.' },
    { id: 'S9.3', sprite: 'dawn_caller', archetype: 'herald', role: 'support', modifiers: [], trigger: null,
      name: 'Dawn-Caller on a Perch',
      tomb: { maker: 'Mounted from Round Book 5', date: 'Collected after the Great Reshelving', medium: 'Feathers, wire; perch of varnished applewood', dims: 'H. 64 cm', credit: 'Accessioned on the night staff’s report' },
      paragraph: 'Reported, once. Round Book 5 records that the caller called a single time, at the sight of a new keeper on a first round, and that when the keeper looked round every animal in the court was standing up. The entry lists them all by name. The day staff consider it the best-documented night in the department, because it was countersigned by four keepers, all of whom were, by then, awake.' },
    { id: 'S9.4', sprite: 'brooder', archetype: 'tethered_warden', role: 'warden', modifiers: [], trigger: 'tether',
      name: 'Ground-Nesting Brooder, With Its Nest',
      tomb: { maker: 'Mounted from Round Book 7', date: 'Collected after the Great Reshelving', medium: 'Hide, feathers, wire; nest of round-book pages', dims: 'L. 1.3 m', credit: 'Accessioned on the night staff’s report' },
      paragraph: 'Reported, not observed. The brooder built its nest from the pages of Round Book 9, which a keeper had left on a bench, and the Museum has displayed the two together ever since. The night staff describe it as the easiest animal in the court to work beside: it has never been more than two paces from the nest, and they simply sweep around it. They do not recommend reaching into the nest.' },
    { id: 'S9.5', sprite: 'tortoise', archetype: 'mimic_vitrine', role: 'ambusher', modifiers: [], trigger: 'touch_case',
      name: 'Cabinet-Backed Tortoise',
      tomb: { maker: 'Entered twice in Round Book 2, once as furniture', date: 'Collected after the Great Reshelving', medium: 'Domed carapace with a hinged lid; horn, hide', dims: 'L. 1.4 m', credit: 'Accessioned on the night staff’s report' },
      paragraph: 'Reported, and then reported again. Round Book 2 lists this as a specimen cabinet in the morning and as a tortoise at night, in the same hand, with the note “same object, please advise”. The day staff advised that it was a cabinet. The keeper who opened it to check was held by the wrist for some minutes and released, eventually, without the specimen inside.' },
    { id: 'S9.6', sprite: 'hopper', archetype: 'darter', role: 'skirmisher', modifiers: [], trigger: null,
      name: 'Long-Footed Hopper',
      tomb: { maker: 'Mounted from Round Book 4', date: 'Collected after the Great Reshelving', medium: 'Hide, wire; hind feet of carved boxwood', dims: 'H. 30 cm each', credit: 'Accessioned on the night staff’s report' },
      paragraph: 'Reported, not observed. Round Book 4 calls the hoppers the court’s nuisance. They come in close, nip, and are back out of reach before a keeper can turn round, and then they do it again from the other side. The night staff kept them out of the waders’ way by keeping them busy. The preparators mounted four, which they believe is all of them, and wrote that down as well.' },
  ],
  // Items (§5.2, §8.5): the sample's equipment (design/samples.md §3.6), trimmed per §5.5.
  // A primitive the slice lacks is replaced by one it has, of the same budget (S 1, M 2,
  // L 3; a flag such as quiet, or an instrument's effect, 2): the Overshoes' muffled(M)
  // becomes quiet; the Tongs' knockback(S) becomes Acc(S); Round Book 9's perception(L)
  // becomes Eva(L). The Day Curator's Lamp is the Signature piece, which waits for M4.
  items: [
    { id: 'S9.7', kind: 'garment', form: 'light', prims: [{ id: 'quiet', cls: 'M' }],
      name: 'Overshoes of the Night Staff',
      tomb: { maker: 'Night staff stores', date: 'After the Great Reshelving', medium: 'Felt over leather', dims: 'L. 31 cm', credit: 'Gift of the Night Staff' },
      paragraph: 'Worn over ordinary shoes on the rounds, so that the keepers could hear the court and the court could not hear the keepers. The day staff tried them once and complained that they could not hear themselves walk.' },
    { id: 'S9.8', kind: 'weapon', form: 'light', prims: [{ id: 'dmg', cls: 'S' }, { id: 'acc', cls: 'S' }],
      name: 'Taxidermist’s Long Tongs',
      tomb: { maker: 'Preparators’ workshop', date: 'After the Great Reshelving', medium: 'Steel, cork-lined jaws', dims: 'L. 72 cm', credit: 'Gift of the Preparators' },
      paragraph: 'Used to set a mount’s eyes and teeth from arm’s length, where a steady hand counted for more than a strong one. The preparators keep them sharper than tongs need to be, and the night staff, who borrow them, say they always find the place they were aimed at.' },
    { id: 'S9.9', kind: 'instrument', instrument: 'pin_driver', prims: [],
      name: 'Spring Pin-Driver',
      tomb: { maker: 'Preparators’ workshop', date: 'After the Great Reshelving', medium: 'Steel spring, walnut stock, box of long pins', dims: 'L. 34 cm', credit: 'Gift of the Preparators' },
      paragraph: 'Built to drive mounting pins into a hard plinth from a safe distance, when the specimen on the plinth was not cooperating. The preparators’ notes call it a last resort, twice.' },
    { id: 'S9.10', kind: 'curio', prims: [{ id: 'eva', cls: 'L' }],
      name: 'Round Book 9',
      tomb: { maker: 'The night staff, in several hands', date: 'From the Great Reshelving until the brooder took it', medium: 'Pencil on ruled paper; pages 40–112 in the nest (see S.9.4)', dims: 'H. 21 cm', credit: 'Gift of the Night Staff' },
      paragraph: 'The last round book before the nest. Every animal in the court is entered, with what it does and what wakes it, in the plain language of people who had to walk past them every night. Carried open, it is said to keep its reader out of the court’s way, as it kept the night staff.' },
  ],
  // Consumables (§5.2, §8.6): a local name for each seal (the 4 Solutions' seals, then the
  // 4 Ephemera's; a name never says which kind lies under the seal, since the seals are
  // shuffled every run), and an identifying label for each kind.
  consumables: {
    names: ['Specimen Jar, Stoppered', 'Preparator’s Bottle, Brown Glass', 'Keeper’s Flask, Dented', 'Phial From the Mounting Bench',
      'Loose Page From a Round Book', 'Night Staff Notice, Folded', 'Feeding Rota, Torn Across', 'Envelope From the Day Office'],
    labels: {
      consolidant: 'Consolidant is what the preparators brush into a mount that has begun to crumble, and it binds hide and wire back together. The night staff carry some for themselves: drunk, it closes a keeper’s cuts at once and goes on mending them for a little while after. Spilt over an animal, it mends that too, as one keeper discovered with a hopper.',
      fixative: 'Fixative is sprayed on a finished mount so that nothing about it can shift again. Round Book 6 records a keeper who drank some by mistake and stood exactly where they were, unable to lift a hand, until it wore off. Thrown, it holds everything it splashes in place for as long, which the night staff consider its proper use.',
      fumigant: 'Fumigant is sprinkled through the court against moth and beetle, and keepers are warned not to taste it. One who did coughed for some time, loudly enough to bring the nearer animals round to look. Thrown, it rises as a cloud that nobody can see through, and any animal asleep inside it sleeps the deeper for as long as the cloud lasts.',
      solvent: 'Solvent is what the preparators use to take a mount out of an old case without breaking anything: brushed on, the glass simply goes, and makes no sound about it. Thrown at a case, it does the same. A keeper who drinks it is rid of every lingering ill the court has left on them, though not of their bruises.',
      card: 'The Catalogue Card is the night staff’s index of the preparations and papers they carry, one card to each. Read, it tells you what lies under one seal you do not yet know, which saves a keeper from tasting to find out. The cards are filed by seal, because the night staff have never agreed on names.',
      plan: 'The Floor Plan was drawn by the night staff for new keepers, with every room of the court on it and a pencil cross wherever something worth finding still lay. Read, it shows you the whole department, and the rooms where its Highlights are still waiting. The day staff have never needed one, and say so.',
      quiet: '“Quiet, Please” is the notice the night staff read aloud at the start of every round. Every animal within earshot calms: the stirring settle back into sleep, the wandering fall asleep where they stand, and even those already after a keeper lose their certainty and merely look about. The Night Watchman is not bound by it.',
      ticket: 'The Re-admission Ticket lets a keeper who has lost their way begin the round again. Read, it returns you to the department’s entrance, and everything hunting you loses your trail, except the Night Watchman, who never loses anyone’s. The night staff keep one in every pocket, and the round books record nobody ever using the last.',
    },
  },
  centrepiece: { id: 'S9.12', sprite: 'composite', archetype: 'completing_guardian', form: 'treasure', size: 2,
    name: 'The Composite, Assembled From the Round Books',
    tomb: { maker: 'Mounted by the preparators from every description in Round Books 1–8 that matched no other specimen', date: 'After the Great Reshelving', medium: 'Hide, feathers, horn, wire, carved lime; parts added as descriptions were found', dims: 'H. 2.9 m', credit: 'Accessioned on the night staff’s report' },
    paragraph: 'Reported in pieces. The preparators built it from the descriptions no other mount accounted for: a neck from Round Book 2, legs from Round Book 6, a tail from a note in a margin. They added each part as its description turned up in the galleries, and they do not believe it is finished. The night staff say it is more complete on nights when more of the court has been walked.' },
});
