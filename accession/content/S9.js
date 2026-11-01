// ACCESSION — S.9 Animals Not Yet Seen by the Day Staff (design/samples.md §3, trimmed per
// BUILD.md §5.5). Paragraphs are only for reading; the rules are in the Behaviour lines.
'use strict';
Packs.add({
  acc: 'S9', number: 'S.9', title: 'Animals Not Yet Seen by the Day Staff', family: 'Specimens', palette: 'S9',
  programme: 'sculpture_court', claim: { primary: 'guarded', secondary: null },
  houseRule: 'Please keep the exhibits in view.',
  blurb: 'Every specimen here was catalogued from the night staff’s round books. The day curators accessioned the descriptions in good faith.',
  modules: [{ id: 'unobserved_motion', role: 'signature', params: {} }, { id: 'alarm_network', role: 'secondary', params: {} }],
  species: [
    { id: 'S9.1', sprite: 'grazer', archetype: 'unobserved_mover', role: 'ambusher', modifiers: [], trigger: null, flags: ['unobserved_motion'],
      name: 'Long-Necked Grazer',
      tomb: { maker: 'Mounted by the preparators from Round Book 3', date: 'Collected after the Great Reshelving', medium: 'Hide over a carved lime form', dims: 'H. 2.4 m', credit: 'Accessioned on the night staff’s report' },
      paragraph: 'Reported, not observed. Round Book 3 places the grazer at the north end of the court at the start of one round and at the south end at the start of the next, and never anywhere in between. The keeper who made the entry added that they once kept their eyes on it for a whole round, and that it did not move at all. The day staff measured the floor for marks. There were none.' },
    { id: 'S9.2', sprite: 'wader', archetype: 'patrol_guard', role: 'warden', modifiers: [], trigger: 'awake', flags: ['alarm_network'],
      name: 'Lantern-Crop Wader',
      tomb: { maker: 'Mounted from the first entry in Round Book 1', date: 'Collected after the Great Reshelving', medium: 'Feathers, hide, wire; crop lined with luminous paint by the preparators', dims: 'H. 1.1 m', credit: 'Accessioned on the night staff’s report' },
      paragraph: 'Reported, not observed. The wader keeps the same round as the night staff, corner to corner, in the same direction, and the night staff describe it as the only colleague who has never been late. Its crop glows faintly, which they find companionable. When it meets something on its round that was not there the last time, the round books say, it stands quite still for a moment and then calls.' },
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
  // Each keeps the sample's form, and a primitive the slice lacks is replaced by one it has,
  // of the same budget (S 1, M 2, L 3; a flag such as quiet 2; each of the slice's
  // instruments 2, the Pin-Driver's price as the sample's bolt(edge, M)): the Overshoes'
  // muffled(M) becomes quiet; the Tongs' knockback(S) becomes Acc(S); Round Book 9's
  // perception(L) becomes Eva(L). A paragraph says no more than its item does: the Overshoes
  // let you come a little closer while you move, and the Tongs' bonus is small.
  // The Day Curator's Lamp (S9.11) is the Signature piece and the treasure (M4 plan D2.9,
  // §5.5): a curio with the `observing` primitive, taken hooded, whose rule is its own
  // (Kit.observing); its paragraph names no case and no hall, since a visitor may carry it
  // anywhere. The Centrepiece names it (`signature`), so no stand-in places it as loot.
  items: [
    { id: 'S9.7', kind: 'garment', form: 'light', prims: [{ id: 'quiet', cls: 'M' }],
      name: 'Overshoes of the Night Staff',
      tomb: { maker: 'Night staff stores', date: 'After the Great Reshelving', medium: 'Felt over leather', dims: 'L. 31 cm', credit: 'Gift of the Night Staff' },
      paragraph: 'Worn over ordinary shoes on the rounds, so that a keeper on the move could come a little closer to a sleeping animal without stirring it. The day staff tried them once and complained that they could not hear themselves walk.' },
    { id: 'S9.8', kind: 'weapon', form: 'light', prims: [{ id: 'dmg', cls: 'S' }, { id: 'acc', cls: 'S' }],
      name: 'Taxidermist’s Long Tongs',
      tomb: { maker: 'Preparators’ workshop', date: 'After the Great Reshelving', medium: 'Steel, cork-lined jaws', dims: 'L. 72 cm', credit: 'Gift of the Preparators' },
      paragraph: 'Used to set a mount’s eyes and teeth from arm’s length, where a steady hand counted for more than a strong one. The preparators keep them sharper than tongs need to be, and the night staff, who borrow them, say they are a shade more likely than other tools to find the place they were aimed at.' },
    { id: 'S9.9', kind: 'instrument', instrument: 'pin_driver', prims: [],
      name: 'Spring Pin-Driver',
      tomb: { maker: 'Preparators’ workshop', date: 'After the Great Reshelving', medium: 'Steel spring, walnut stock, box of long pins', dims: 'L. 34 cm', credit: 'Gift of the Preparators' },
      paragraph: 'Built to drive mounting pins into a hard plinth from a safe distance, when the specimen on the plinth was not cooperating. The preparators’ notes call it a last resort, twice.' },
    { id: 'S9.10', kind: 'curio', prims: [{ id: 'eva', cls: 'L' }],
      name: 'Round Book 9',
      tomb: { maker: 'The night staff, in several hands', date: 'From the Great Reshelving until the brooder took it', medium: 'Pencil on ruled paper; pages 40–112 in the nest (see S.9.4)', dims: 'H. 21 cm', credit: 'Gift of the Night Staff' },
      paragraph: 'The last round book before the nest. Every animal in the court is entered, with what it does and what wakes it, in the plain language of people who had to walk past them every night. Carried open, it is said to keep its reader out of the court’s way, as it kept the night staff.' },
    { id: 'S9.11', kind: 'curio', prims: [{ id: 'observing', cls: 'L' }],
      name: 'The Day Curator’s Lamp',
      tomb: { maker: 'Bought by the day curator for one night’s visit to the court', date: 'After the Great Reshelving', medium: 'Nickel-plated reservoir, chimney, hooded reflector', dims: 'H. 38 cm', credit: 'Gift of the Day Curator' },
      paragraph: 'The day curator visited the court once, at night, to confirm the round books, and brought this lamp. Round Book 8 records the visit in the curator’s own hand: “Nothing moved while I watched.” Lit, it keeps whatever stands near its bearer in view, even round a corner, and makes its bearer easier to notice. Hooded, it is only a lamp. The curator has declined to discuss the morning after.' },
  ],
  // Consumables (§5.2, §8.6): a local name for each seal (the 4 Solutions' seals, then the
  // 4 Ephemera's; a name never says which kind lies under the seal, since the seals are
  // shuffled every run, so no label of the pack describes the thing a name is), and an
  // identifying label for each kind.
  consumables: {
    names: ['Specimen Jar, Stoppered', 'Preparator’s Bottle, Brown Glass', 'Keeper’s Flask, Dented', 'Phial From the Mounting Bench',
      'Loose Page From a Round Book', 'Night Staff Letter, Folded', 'Feeding Rota, Torn Across', 'Envelope From the Day Office'],
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
  // The gallery list (§5.2, §5.5; M4 plan A9, A10): design/samples.md §3.3's galleries, in its
  // order, mapped onto a Cabinet court's rooms (Populate.mapping): the Intro, the court (the
  // filled central space, `central`), one band room south of it (`band`), the hall and the
  // coda. Tour order at layout version 3 puts the band room first and the court second, so
  // each section gallery names its element. The Intro's exhibits are its stamp's
  // (content/S9-intro.js: a Grazer and two Hoppers), so its gallery lists none.
  //   - The Mount Court (the court): the sample's two Mount Court galleries but for the
  //     Tortoise: a Grazer, the Dawn-Caller, the two Hoppers the Intro does not hold (the
  //     preparators mounted four), and both Waders, on the court's round (its panel: "This
  //     court is alarmed"). The court has no wall cases (p50 0), so the Overshoes' case is the
  //     floor where none is left.
  //   - The Brooders' Bay (the band room, which has 6–16 cases): the Brooder first, so it has
  //     the first pick of a case to guard (its nest, Round Book 9 inside, when one passes the
  //     take rule: 61% of S.9 departments, 424 of 700, where the court has no case and the
  //     coda's pass in 1 of 700; the Lamp Corridor's south cabinets keep its tether, which
  //     needs no sight, out of the safe zone beyond the band room's north wall); the Tortoise
  //     beside a real case, among the cases (DE6); and the preparators' tools.
  //     The Waders walk the court (CP1 review, decided without play; revisit once M4 is
  //     playable): the court opens onto the Intro along the entrance row, so population keeps
  //     a Wader's round to the half of its room farther from the Intro's onward openings, and
  //     none sees the safe zone in its first SAFE_ZONE_TURNS turns, every door open (0 of
  //     seeds 1–70). On the band room's round, the two of them saw nearly every tile of it and
  //     the coda's doorway, turn after turn, and the worst-case runner, timing them, passed
  //     only 26% of seeds; on the court's far half, 80%.
  //   - The Round-Book Room (the samples' study room) joins the last section: nothing in it is
  //     an exhibit or an item of the slice.
  //   - The Day Curator's Case (the hall): two Grazers, wherever the hall's rules let them
  //     stand, and the Lamp's case (the Lamp, the Signature piece, in a case: D-ITEMS'
  //     treasure case); the Composite is placed by its own rule.
  // Item entries are the item placement's (D-ITEMS); `case: true` puts one in an empty case
  // of its room, or on its floor when none is left.
  galleries: [
    { key: 'intro', name: 'The Lamp Corridor', contents: [] },
    { key: 's1', where: 'central', name: 'The Mount Court', contents: [{ sp: 'S9.1' }, { sp: 'S9.3' }, { sp: 'S9.6', count: 2 }, { sp: 'S9.2', count: 2 }, { item: 'S9.7', case: true }] },
    { key: 's2', where: 'band', name: 'The Brooders’ Bay', contents: [{ sp: 'S9.4', guards: 'case' }, { item: 'S9.10', case: true }, { sp: 'S9.5', near: 'case' }, { item: 'S9.8', case: true }, { item: 'S9.9', case: true }] },
    { key: 'last', name: 'The Round-Book Room', contents: [] },
    { key: 'centre', name: 'The Day Curator’s Case', contents: [{ sp: 'S9.1', count: 2 }, { item: 'S9.11', case: true }] },
    { key: 'coda', name: 'The Night Staff’s Tea Room', contents: [] },
  ],
  // The Centrepiece, the Composite, with its treasure case's glass, is the pack's centrepiece
  // part (content/S9-cp.js; M4 COMPOSITE-CORE moved it there).
});
