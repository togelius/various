# Critique: the museal lens

*Reviewer: a curator and writer (Calvino, Borges, the Museum of Jurassic Technology, Piranesi; decolonising-collections work). Read: brief.md, direction.md, research/literature-museology.md (LM), and the drafts samples.md (S), vocabulary.md (V), core-systems.md (CS), meta.md (M), pipeline.md (P), with spot checks in difficulty.md (D) and layout.md (L). Counts quoted below were made with grep over the drafts as they stand on 2026-10-20. Each finding is tagged* **[Error]** *(fix it) or* **[Option]** *(a design disagreement to put to Julian), or both.*

---

## 0. Verdict

This is not a dungeon with paintings. At the level of systems it is more museal than any museum game I know: the tombstone is the stat card, you can beat a boss by *reading its label at the lectern*, you hide by posing on an empty plinth or by joining a tour, light follows the material on display, guards are staff you cannot hurt, exhibits drop nothing because the loot is in the cases, and a missing accession number is how you spot a mimic. Keep all of that.

Where it falls short of Julian's brief is the *voice* and the *politics*:

- **One register.** All five worked departments are about an institution's own paperwork. The word "Office" appears 131 times in the samples. Calvino gave us 55 cities with Venice hidden behind them; the samples put Venice (the institution) on the surface of every label. Generated from these exemplars, 30 departments will read as one joke.
- **The label is turning into a form.** Each behaviour archetype that recurs across samples has produced the same sentence twice, 44 of the 90 label blocks lean on a reporting formula ("keepers report", "staff say", "according to"), and more than half the labels end on a dry punchline. The Museum of Jurassic Technology never does this.
- **The museum's defining argument is deferred.** Provenance is named as a pillar, but every mechanic that would carry it is marked "later". v1 ships the take-and-register loop and only the avoidance half of the sensitivity rules. The samples already contain five unused "conditions of gift" that could carry it in v1.
- **Two museum conventions are used backwards.** The attribution ladder is a progress bar on which scrutiny always *promotes* an object, when in practice it more often demotes one. And the finale has you beat a staff member to zero HP, when every other draft makes staff inviolable.

---

## 1. What works and must be kept

1. **Viewing is winning** (CS §5.4): reading the gateway label at the lectern earns the Certificate. This is the single best museal idea in the document.
2. **The label as interface**: the tombstone line with pictograms (CS §13.2), credit lines computed from item state (P §6.4), Wilkins-coded numbers in which "no number means a mimic" (P §6.3), and the "Highlights of this collection" box (CS §8.6).
3. **The visitor's tactics**: Pose on an empty plinth, Join a tour (CS §3.9), and guards who cannot be harmed ("self-defence; the night staff are used to it", CS §3.7). The Copyist's sketch works as a universal verb (CS §9).
4. **Lux by material**, and reading that costs light and position rather than time (CS §1.3, §3.5).
5. **Exhibits drop nothing; the loot is in the cases** (CS §6.6).
6. **The closing clock as public-address announcements**, with the Night Watch as custody rather than death (CS §5, Challenges 2).
7. **S.9's voice rule, "Reported, not observed"**, and the `completing_guardian` (A Bao A Qu). These borrow Borges's *method* (a compiler citing reports), not his creatures. It is the model for every other borrowing.
8. **The Atlas** as a family × ordinal grid that opens on a diagonal, and object zero, whose tag read in the Founder's cabinet says "Spare. Front door." (M §6.2, §6.4).
9. **The meta's museal small print**: "Figure of a Visitor, Reaching", the Donor Wall, "Not for loan: too fragile to travel", "Returns accepted with receipt", and the Loan "in conservation" after a death (M §5, §7, §10).
10. **Lines to use as style anchors.** Each is sincere and specific, and the strangeness lives in the object:
    - "The chalk box is original and still about half full." (T.5.4)
    - "Marble, with a tide line 31 cm from the base" (T.5.6)
    - "We have tried to describe the animals as the night staff did, and not as we would have preferred them to be." (S.9 intro)
    - "The die reads RECEIVED on one face and RECEIVED AGAIN on the other." (A.4.6)

---

## 2. Findings

### BLOCKER

#### B1. One register, one subject: every worked department is a department about its own paperwork. [Error + Option]

**Where.** S §1–§5; S §7 (Directory: "the rest are the institution talking about itself"); P §3.2 (constraint cards CC-03, CC-08, CC-21 and CC-34 are all museum procedure; the voice in the worked example is `dry_registrar`); the direction memo's tone pillar.

**What is wrong.**
- Each sample is told through an office:
  - T.5 is a town told through its Low-Water Office ("Office" ×64).
  - A.4 is an "era" that turns out to be the Museum's own administrative era, the Duplicate Ordinance ("Office" ×51).
  - K.6 is the Office of Unintended Loans.
  - M.11 is the building's own signalling line, with a Line Superintendent's Office.
  - S.9 is the night staff against the day staff.
- Julian's three examples were "a type of technology, a faraway land, a historical era", and the samples answer every one of them with administration.
- There are no wall quotations in any of the five, although P §2.2's text block has a slot for them and LM §3.3 rule 6 asks for plural voices.
- The word "wonder" appears in none of the seven drafts. LM F27's wonder/resonance dial was dropped on the way from research to design.

**Why it matters.**
- The brief asks for departments that each focus "on something else" and are "rather fantastical, think of Calvino's Invisible Cities".
- Calvino's series are Memory, Desire, Signs, the Dead, the Sky. Polo says once, late, that every city is Venice, and never describes it. Here the institution is described in every label.
- "The institution is the joke" was a rule about *where satire may aim*. The samples read it as *what every department is about*.
- The samples are the S1 and S4 exemplars. S §11.1 already worries that exemplars become templates; S §8.4 sees the proper-noun risk ("every Copies department an Ordinance") but not the register risk.
- The generator will produce dry institutional comedy at scale: museum fatigue at the level of the whole run.

**Resolution.**
1. Restate the tone pillar in the direction memo: "When the text jokes, the joke is on the institution. The institution is the subject of at most one department in four (the `concept_institution` category)."
2. Add a **register** field to the S1 recipe (for example `wonder`, `elegy`, `technical-sincere`, `documentary`, `institutional-comic`).
   - Set pool quotas, with `institutional-comic` at 25% or less.
   - The sequencer should alternate register as well as challenge type. This is LM F27's wonder/resonance dial, and it is the museal cure for satiation (LM F23).
3. Before the exemplar sets are frozen, work a sixth sample in a lyric register, with no Office, no staff joke and at least one wall quotation in the voice of the place.
   - Candidates: pitch #7 *A Valley Where Noon Is Kept Indoors*, #12 *Shells That Kept a Particular Afternoon* or #17 *Birds Mounted in the Act of Leaving*.
   - Alternatively, replace M.11, which the drafter already ranks weakest (S §8.1).
4. Add T5 frequency caps per department for "Office", "the Museum", "staff" and "night staff".
5. Name the eight voices that P §2.2 says exist. Require the exemplar sets to use at least three of them between them.

**Decision for Julian:** D-MU1 (§8).

### MAJOR

#### M1. The label is turning into a form: archetypes recycle sentences, and most labels end on a punchline. [Error + Option]

**Where.** All label blocks in S §1–§5; the root causes are V §10.2 (`essential_line` template per archetype), P §3.7 (the tooltip-trap guidance, "Keepers report that …"), S §8.4 (a "reporting-verb lint" that *requires* a named reporter) and the exemplars themselves.

**What is wrong.** Five archetypes appear in more than one sample, and every one of them produced a recycled sentence or joke (full table in §3.2):
- `tethered_warden`: "never been more than two paces from the nest / from that door";
- `plodder`: "at a steady walking pace, following whoever is nearest";
- `mimic_vitrine`: "held by the wrist / by the handle";
- `mote_swarm`: the same "the difficulty is the number of them" joke three times;
- `herald`: everything nearby "stirs at once / standing up".

Counts across the 90 label blocks:
- 44 blocks contain a reporting formula (report or reported 21 times, say 10, describe 11, note 10, record 12, "according to" 5);
- "has never" appears 12 times;
- "Please …" sentences 8 times, three of them the identical "Please keep the exhibits in view.";
- "…which is not the same thing" twice, plus "two different things" once;
- "paid by the street, not by the hour" twice (the section panel and the Broom label).

I count 43 of 78 didactic last sentences ending on a wry kicker: "The Museum has displayed it.", "The crossings are not.", "There were none.", "It has never lost one.", "The spare is missing."

**Why it matters.**
- Each archetype recurs in 3 to 12 departments (V §11.2), so every recurrence replays its sentence. A player will see the template inside the first run.
- Deadpan stops being deadpan when every label has a button on the end. MJT labels are earnest and a little over-long. The humour is in the object and the apparatus, never in the cadence of the sentence.
- The reporting-verb lint makes "Keepers report" a rule, so a tic has been written into the pipeline.

**Resolution** (options; lean (b)):
- (a) Keep the Essential line in the prose (D-S5a), but:
  - give S4 a per-family bank of *evidential frames* (logbook entry, handbook rule, maker's instruction, repair note, loan condition, condition report, visitor complaint, witness statement);
  - cap "report" at 2 per department;
  - run T5 n-gram distance on Essential sentences across all departments that share an archetype.
- (b) **Controlled vocabulary.** Move the mechanical truth into a fixed tombstone field, *Behaviour*, worded identically for an archetype everywhere and paired with its pictogram. For example: "Behaviour: keeps within two paces of its post (tethered)."
  - Real catalogues use controlled vocabularies (Getty AAT, SPECTRUM), so the repetition becomes institutional honesty instead of a writer's tic.
  - The didactic is then free prose, and T1 checks only that it claims nothing false.
- (c) A **family-trail label** (§7): a second, lower label in plain words carries the mechanic and is toggled as an assist. The adult label carries none.
- In every case, give T6 the rubric "the object may be absurd; the sentence may not be witty". Cap kicker endings at one label in four per department. Add "has never", "not the same thing", "keep each other company" and "a mistake … only once" to the soft-banned list with pool caps.

**Decision for Julian:** D-MU2. It changes D-S5 (S §9).

#### M2. The attribution ladder runs backwards. [Error]

**Where.** CS §7.1 (rungs: Uncatalogued → Manner of → Circle of → Workshop of → Attributed to → By, used as *knowledge* levels); the direction memo pillar 2 and its Identification line; V §3 `forgery`, which uses "Attributed to" in the opposite sense, as a claim.

**What is wrong.**
- In practice the qualifiers describe the *relationship of a hand to a master* (LM F24), not how much the cataloguer knows. "Workshop of" is a confident finding, not a halfway stage on the way to "By".
- Closer scrutiny more often *demotes* than promotes: the Rembrandt Research Project spent decades taking paintings away from Rembrandt. LM §3.1 said "Re-attribution can downgrade", and the drafts lost it.
- As built, every genuine item you finish cataloguing becomes "By [maker]". Studying turns everything into a masterwork, and the forgery is the only surprise left.
- CS Challenges 1 fixes the bottom rung but keeps the progress bar.

**Why it matters.** LM's takeaway 2 calls attribution the cheapest strong museal signal, the one convention that reads as both museum and RPG. Using it as a progress bar wastes it, and a curator will wince.

**Resolution.** Split it into two fields; this is cheap, because CS already rolls a hidden +N.
1. **Cataloguing status** (what you know): Uncatalogued → Examined → Catalogued. CS's five information steps can stay internally under neutral names.
2. **Attribution** (what the object is): a hidden property rolled at placement and revealed by cataloguing. It is simply the name of the +N band:

   | Attribution | Meaning in play |
   |---|---|
   | By | rare; the best band |
   | Workshop of | standard |
   | Circle of | −1 |
   | Manner of | −2 |
   | After | an honest copy |
   | Forgery | the curse |

3. Until it is catalogued, the tombstone shows the department's *hopeful* claim, "Attributed to X". Cataloguing settles it up or down. Identification becomes hope and disappointment, which is Brogue's unknown-potion feeling in a museum's words. The Registrar's free catalogue becomes a verdict.

**Decision for Julian:** D-MU7.

#### M3. Provenance is a pillar with no v1 mechanic. [Error + Option]

**Where.** The direction memo ("Provenance is a mechanic, not a sermon"). Everything that would carry it is marked "later":
- V §3 `on_loan`; V §2.1 `keeper`; V §6.2 `living_community`;
- CS §10 Courier and Curator;
- P §6.4 "Taken from a keeper without asking (Peoples, later)" and "Returned to its lenders (later)".

The Claim pictogram (CS §13.4) has no v1 source. Every credit line in the five samples is clean: "Gift of", "Transferred from", "Purchase". The meta loop is pure acquisition, credited "Gift of the Visitor" (M §4.5).

**What is wrong.** v1 ships the *take and register* half of the loop LM §4.2 warned about ("enter … take its objects reproduces that history") and none of its counter-argument. What remains is the avoidance half: no peoples, no residents. Meanwhile the samples already contain five **conditions of gift** that nothing uses:
- the Tide Bell, "on condition that it not be rung";
- the Crane Driver's Lever, "on condition that it be used rather than displayed. The Museum has displayed it.";
- the Fending Pole, "on condition that it stay in the breakwater until someone could carry it out";
- the logbooks, "on condition that the line be kept to its timetable";
- the Porters' Ledger (LM), "displayed open".

**Why it matters.** Conditions of gift are real museum law. Isabella Stewart Gardner's will is why the empty frames still hang (LM F20). The Pitt Rivers Deed of Gift is why its typological displays survive (LM F15). This is the most distinctive thing the game could say, it needs no peoples at all, and the samples have already written the content.

**Resolution (v1).**
1. **Conditions of gift.** A department may declare 0–2 conditions on named objects, from a closed list: not to be sounded, to be used, to stay together, to be displayed open, not to leave the department, to be returned by closing. Each shows as a tombstone line and a pictogram.
   - *Honouring* a condition pays a **relation**, not power: the donor's letter at the coda grants a shortcut, a free catalogue, a Stair Hall service, or the object's Signature rider (D-S3).
   - *Breaching* it gives you the raw item, changes its credit line ("Condition of gift breached, Run 14"), and closes something the next time that department is drawn ("Closed at the donor's request").
2. **"Circumstances unrecorded" items.** The `X.` series is already reserved (P §6.3). These items are one tier stronger and carry the Claim pictogram.
   - A **Returns desk** at the next Stair Hall offers to send one back in exchange for a relation (a free café choice, a Clearance card, the next floor's plan).
   - Over a run, returning should often be the better deal. LM: "that trade is the whole argument".
3. Cost: data fields, one Stair Hall service, and credit-line states P §6.4 already defines.

If Julian rejects this, strike "Provenance is a mechanic" from the pillars for v1, so the document does not claim something it does not build.

**Decision for Julian:** D-MU3.

#### M4. The faraway land is being designed out. [Option, with one Error]

**Where.** Several separate rules all push the same way:
- V §9.2's `land` guardrail.
- S §8.4's land lint: no costume, ritual object or body part; no resident NPCs.
- S Challenges 2: land NPCs are staff or visitors only.
- P §3.3 F6: every `land` frame is *held until Julian clears it*, which adds friction only to lands.
- The cut lines: V §15 step 6 cuts Tides, the family of the only worked land (T.5); S §12 drops T.5 third.
- The pitch lands (S §6) are a survey office, a light condition, a weather, a border and a map, and "none has inhabitants on display".

**What is wrong.** Each rule is reasonable. Together they make the land the riskiest category to generate and the first to be cut. The result is an unpeopled place whose things the Museum saved. That is the salvage aesthetic, and it is not neutral.

**Why it matters.**
- Julian named "a faraway land" in the brief.
- Calvino's cities are *inhabited*: the people of Ersilia stretch strings between their houses. Each city is a practice of its inhabitants, not an ethnography.
- T.5 is good for exactly this reason. The town is present through its practices (sweepers paid by the street, doorsteps replaced after every flood, a tide board moved by hand) and through **correspondence**: "The Office, asked in writing, replied with a corrected timetable."

**Resolution.**
- Options:
  - (a) Unpeopled lands, as drafted.
  - (b) **Inhabited by practice and correspondence** (lean). Inhabitants appear as what they do, in the present tense, with role-names; never as ethnic types, costume, physiognomy or ritual; never as mannequins or NPC bodies. They appear as voices that write back: letters, timetables, conditions, refusals.
  - (c) Residents as NPCs, under the Lenders rules (M5).
- Add a `source_status` frame field (extant / ceased / unknown) and cap "ceased" lands, so that not every land is a place that is gone.
- **Error to fix:** protect one land-capable family in V's cut line (Tides, or Light via pitch #7). Once the pool holds five or more lands, have the sequencer offer at least one land per run.

**Decision for Julian:** D-MU4.

#### M5. The sensitivity rules check likeness, not relationship, and the Peoples spec has four specific problems. [Error + Option]

**Where.** P §3.3 F6 and §3.7 T4 ask "Which real group … does this read as?"; V §2.1 `keeper`; V §9.1 (the Peoples row and its cap); LM §4.2 and the direction memo ("rare").

**What is wrong.**
1. **The check is representational only.** Nothing checks *how* the Museum got the things.
   - T.5 has "collectors walked out at low water with handcarts … took what the Low-Water Office would lend or sell … paying in the Office's own tokens".
   - Pitch #20 has "collectors were sent out to fill them to size"; #19 has crates "labelled and air-holed".
   - Each is fine on its own. At generator scale, expedition and salvage stories will become the default way departments come to exist.
2. **`keeper` is "Hostile only after a Claim (taking without asking, harming residents)."** That makes residents combatants who attack when you steal: the frontier scene, opt-in.
3. **Peoples' favoured programmes are `period_rooms` and `courtyard`.** A period room or diorama of a people's domestic life is the ethnographic diorama, the display form most criticised.
4. **The cap is inconsistent.** The direction memo says "rare"; V §9.1 and LM say 1 in 4 (about two per eight-department run); S pitches 1 in 30.

Two smaller points:
- The family *name* "Peoples" repeats the hall names of the ethnographic museum (the American Museum of Natural History's "Hall of Asian Peoples", "Hall of Pacific Peoples"), which is exactly the framing the tone pillar wants to joke about, not adopt.
- LM's Porters' Ledger, the exemplar for pitch #30, has "page tabs of dyed fish-skin". Fish-skin craft is closely tied to specific Indigenous makers. The land lint lists costume and ritual objects but no **material signifiers**.

**Why it matters.** These rules will become the generator's gates. Each problem above is cheaper to fix in the vocabulary now than after Peoples is built.

**Resolution.**
- Add a **relationship check** to F6 and T4: extract the acquisition mode (gift, purchase, exchange, field collection, expedition, salvage, transfer, unrecorded) and the source status. Cap expedition and salvage across the pool. "Expedition to a land" goes to Julian.
- **Keepers cannot be harmed**, like staff. A Claim's consequences are institutional: the loan is recalled, rooms close "at the lenders' request", credit lines change, and the department returns in later runs as "Closed: consultation in progress".
- No period rooms or dioramas in these departments. Display follows the community's own genres (LM F12, Le Guin). The object's own name, in the lenders' usage, comes first on the tombstone and the Museum's descriptive title second, as many museums now do for source-community names.
- **Rename the family Lenders.** Define it by the relationship, not by a category of people.
- Fix the cap in one place: at most one per run, and only after the S6 review exists.
- Add a material-signifier list (fish-skin, barkcloth, quillwork, birchbark scrolls, shell-bead belts and similar) to the land and Lenders lint.
- No human remains is adequate as written: keep it absolute. See m1 for the death figure.

#### M6. The Registrar finale: the right idea, the wrong violence. [Error + Option]

**Where.** D §1.6 and R8; M §10.1 and §12.3; CS §3.7, C3, Challenges 2.

**What works.**
- The threat is being *labelled*, not being hurt: Accession tags with no HP damage.
- The recalled exhibits make the finale a summary of your run.
- There are two exits.
- The Registrar has been your service desk all run, so the turn lands.
- Its lines scale with the size of your Collection.

**What is wrong.**
- D gives the Registrar 217 HP, and "Defeat the Registrar" yields "Escaped, with a receipt".
- D justifies this as "It is staff, not an exhibit, so the institution stays the joke (CS Challenges 2)". That misreads CS, which says staff must not be lethal or harmed: guards "cannot be damaged", and "violence against staff breaks the tone".
- Everywhere else staff are inviolable; at the climax you beat a clerk to zero. The escape also lacks the bittersweet note the memo asks for.

**Resolution.**
1. **[Error]** The Registrar has no HP. What you fight is the *retrospective* and the *apparatus*:
   - the recalled exhibits, each of which carries one folder of your file;
   - "The Registrar's Stamp, First Pattern" as a target, if a centrepiece is wanted.
   - When the tray is empty: "Your file could not be completed. You are free to go."
2. **Make the tags legible.** Each tag is one tombstone field *about you*, written from the run log: "Figure of a Visitor, Reaching", "acquired Room 412", "condition: Fair". At ten, the label is complete. The player watches themselves being catalogued and stands, briefly, on the object's side of accession. That is Fred Wilson's "suggestive rather than didactic" (LM F18), and it is the strongest decolonising beat available without any people on display.
3. **Name it.** Call the Exit "The Retrospective", an exhibition of your visit.
4. **Make escape a loan.** The escape credit line reads "On loan to the Visitor; due for return". The next run is the return, so the roguelite loop becomes diegetic.
5. **A consent ending** (v1.x, after the Founder's cabinet): sign the register yourself, "Gift of the Visitor, by their own hand", which unlocks the Curator. In a game about accession without consent, the only consented accession is yours.

**Decision for Julian:** D-MU5.

#### M7. No frame voice: the audio guide is missing, and with it Calvino's Polo. [Option]

**Where.** "Audio guide" appears in neither CS, M, D nor L. It appears once in V (as a bypass for `script_legibility`) and once in P as one of eight S1 voices. LM §3.1 proposed it as equipment that narrates enemy intent, with unlisted stops forming a hidden tour. M §12's cast is three voices in the Entrance Hall.

**What is wrong.** *Invisible Cities* is a list that becomes a book through its frame, Polo speaking to Kublai (LM F1). The design has the list (Directory, Atlas) and the hidden Venice (object zero), but no voice between them. The audio guide is the museum's own frame device: numbered stops, one narrator, second person.

**Resolution.**
- The **Audio Guide** is fixed equipment, like the lantern. Stop numbers are printed on 1–2 labels per gallery and on the floor plan.
- **One narrator** for the whole building, role-named ("the Voice of the 1100 Series"): warm, second person, present tense. This supplies the Piranesi kindness the labels lack.
- It was **recorded in the day**, so it describes stillness while you watch things move. That is the MJT blur of true and false, with no wink.
- **Mechanically**, a stop speaks the module sentence and one counterplay clue. That relieves the didactic (M1).
- **Stair Hall interludes**: three tracks per run, about 60 words each, addressed to you. Over many runs they turn out to describe one building, which is the hidden Venice (ties to object zero).
- **Hidden tour**: unlisted stop numbers (0, 7½).
- A **Family track** serves as the hint/assist layer (§7).
- **Cost**: in v1, interludes only (about 30 tracks × 60 words). Per-department stops in v1.x (about +300 words per department in S4).

**Decision for Julian:** D-MU6.

#### M8. Restoration kits invert conservation ethics, and conservation is not yet gameplay. [Option]

**Where.** CS §8.2 (Restoration kits: +1 level on anything); CS §10 (Conservator: "restore and repair", Second Coat +2); P §6.4 (condition grades).

**What is wrong.** Modern conservation means minimal, reversible, documented intervention, and over-restoration is the profession's best-known sin. Here restoration is pure upgrade with no museal trade-off, so the Conservator class is "the class that upgrades harder". The good parts are already present but unused: the solutions are named after real conservation materials (Consolidant, Fixative, Solvent), and textiles already fade on bright tiles.

**Resolution.**
1. Record every treatment on the item's condition report (cheap flavour).
2. **Over-restoration.** Past +2, the item is "much restored": its attribution drops one band (M2), and its accession label records it. That sets power now against a better accession.
3. **Reversibility.** Reframe the Stair Hall "transfer levels" service as *reversing* a treatment to recover the kit, at a price.
4. **A Conservator verb: Consolidate.** Channel 3–5 turns beside a dormant exhibit and it cannot wake for the rest of the department ("Stabilised. Do not handle."). This is a non-violent clear, distinct from sketching and from fighting.
5. **Lux as damage.** A lantern held on paper or textile exhibits fades them, as LM F26 says real light does.

### MINOR

#### m1. Usage errors in credit lines and labels. [Error]

- **"Bequest of the Night Staff"** (CS §12; M §10.1). A bequest is a gift made by will, from the deceased; the night staff are alive. Use LM's own form, "Found in Room 517 at opening; accessioned the following morning", or "Gift of the Night Staff".
- **The death label has no medium line** (CS §12; M §10.1). "Found in Room 517 at opening … H. 172 cm" reads as a body on display, which brushes the no-human-remains rule. Add LM's line: "Painted plaster over an armature of umbrella ribs; one ticket stub (pocket)". The figure is a cast, and the label should say so.
- **"Gift of the Visitor"** (M §4.5; P §6.4) is used for objects that already belonged to the Museum. You cannot give a museum its own object.
  - Either make it a deliberate Broodthaers joke, or use the honest form, "Selected by Visitor 40211, Run 22".
  - Frame Your Collection as a "Visitor's Choice" display; guest-curated displays are an established format.
  - That makes the player a curator rather than a donor-thief.
- **"Masterpiece"** for a breakwater, a lamp or a counter bell is an art-historical term misapplied to technology and natural history. Use "Centrepiece" (the memo already writes "Centrepiece/Masterpiece"), or the British Museum's "gateway object".

#### m2. Names. [Option, one Error]

- **Keep ACCESSION.**
  - It names the act the game is about, and the finale.
  - It is a word curators use every day.
  - The "ascension" pun lands with Slay the Spire players.
- **[Error] Strike THE CELESTIAL EMPORIUM from the alternatives.**
  - It is Borges's phrase, which is furniture.
  - It is the very passage LM §4.2 identifies as the othering fault line ("a certain Chinese encyclopedia").
  - A game whose tone pillar is "never the Other" cannot be titled after that list.
  - Keep NOT ON VIEW and AFTER HOURS. Add ATTRIBUTED TO if M2 is accepted.
- **Rename Peoples to Lenders** (M5).
- **Vary the department titles.** All five samples and all 30 pitches use the same slot grammar, so at scale they share one rhythm.
  - Keep the Borgesian line as the *exhibition* title on the placard.
  - Give each department a terse house name as well, in the manner of real museum departments: a Met-style "Arms and Armor", a donor name ("The Harbourmasters' Bequest"), a room name.

#### m3. Motif gravity: bells and umbrellas. [Option]

"Bell" occurs 65 times in the samples:
- T.5 has the Tide Bell and the Breakwater Bell;
- M.11 has its warning bell (24 mentions);
- K.6 has the Counter Bell and the Hand Bell (23).

"Umbrella" occurs 24 times, 23 of them in K.6, following LM's umbrella sample, and object zero is a key. The `herald` archetype has quietly become "a bell".

Either declare a small set of **series objects** (bell, umbrella, key) that recur on purpose with a different reading each time, which is Calvino's tarot grid (LM F2) and object zero generalised, or cap them in T5. Lean: declare them.

#### m4. Two honesty misses in curated labels, and one opportunity. [Error]

- **The Reflecting Dish** (M.11.4): "throwing things at it is a mistake visitors make only once". V's `reflector` returns *bolts and beams*, not thrown objects, so the label claims a mechanic the spec does not have.
- **The Hat Stand** (K.6.2): "Those who need to pass it hand it their hat first" describes a bypass that does not exist.
  - Either cut the line, or better, make it real: K.6's house rule is exchange, so let the Hat Stand accept a garment as a substitute, reusing the `heist_plinths` substitution logic.
- Both show that T1 is needed even for hand-curated text.

#### m5. The Treasure heist imports the idol swap. [Option]

D §6.4's Treasure form, and K.6's weighed plinth, are the opening of *Raiders of the Lost Ark*, the canonical image of colonial looting. K.6 defuses it well by making the swap the Office's own exchange rule.

Rule: Treasure forms may appear in technology, natural history and `concept_institution` departments, never in land or Lenders departments.

#### m6. The museum at night has no staff ecology beyond guards. [Option]

Cheap, museal additions:
- **Cleaners.** A neutral NPC with a floor polisher: continuous noise 4 that masks your steps within radius 3, leaving a slick wet strip behind. Following a cleaner becomes a stealth tactic. Built from the existing noise system and neutral NPCs. v1.
- **Exit signs.** Emergency exit signs stay lit through Lights Down and the Night Watch, pointing to the exit doors. They are diegetic wayfinding when everything else is dark. v1.
- **The guard's chair.** One per room: empty means the guard is on patrol. A one-sprite tell. v1.
- **A CCTV control room** behind a staff door, where cameras can be switched off. L+.
- **HVAC cycles** as periodic noise masks, in the audio layer.

#### m7. LM's satiation fixes were dropped. [Option]

- Perec's orthogonal Latin-square furnisher with a deliberate *clinamen* (LM F9, F23) appears nowhere: grep finds no "Latin", "Perec" or "clinamen" in L.
- The wonder/resonance dial (LM F27) appears nowhere either.
- The sequencer rotates challenge types only.

Add register to the rotation (B1), and adopt a furnisher rule for variety *within* rooms, which is the cure Gilman and Bitgood actually found for museum fatigue. Do not add an Attention meter: CS's clock already carries the pressure.

#### m8. The exit gift shop has nothing to sell. [Option]

D §1.6 makes the Exit's Gift Shop "a one-way coda where the shop is open as a last spend", but coins are worthless once you leave.

Make it the **postcard rack**:
- one postcard for each Centrepiece you viewed or defeated and each Signature piece you saw;
- you take one free, and it enters the Catalogue as "After [X], postcard, 15 × 10 cm".

The reproduction is what visitors really take home. It rewards viewing as much as fighting, and it ends the run on the bottom rung of the ladder: *After*. The sprites already exist.

#### m9. The building does not remember what you broke. [Option]

When a department is drawn again, show the exhibits you destroyed as fragments in a study case: "Fragments of a Mooring Bollard, broken in Room 517 during Run 14. Retained for study." It reuses the death-figure infrastructure (M §10.1) and records your violence without judging it, in Wilson's manner.

#### m10. One-way doors are a dungeon convention. [Option, low priority]

D §1.1: "There is no way back. Each door closes behind you." A museum visit is planned from a floor plan.

Option: at each Stair Hall, show the next floor's 3–4 departments on a floor plan with their placards, and let the player set the order or skip one. Keep the doors if the hidden graph needs them.

---

## 3. Label audit

### 3.1 Method

I read every player-facing block in S §1–§5, the Directory excerpt (S §7, P §5.4), the bark tables, and M §12's lines.

**Good:**
- There are no em-dashes anywhere.
- I found no hard-banned words.
- Specificity is high: measurements, materials, repairs.

**Bad:** the problems are structural (M1) and tonal (whimsy).

### 3.2 Recycled sentences (same archetype, same sentence)

| Archetype | Department A | Department B (and C) |
|---|---|---|
| `tethered_warden` | S.9.4: "it has never been more than two paces from the nest" | K.6.2: "has never been more than two paces from that door" |
| `plodder` | M.11.5: "follows the nearest person at a steady walking pace" | K.6.5: "moves about the department at a steady walking pace, following whoever is nearest" |
| `mimic_vitrine` | S.9.5: "held by the wrist for some minutes and released" | K.6.3: "held by the handle for most of an afternoon" |
| `mote_swarm` | T.5.1: "The difficulty, they add, is that there are always more on the line." | K.6.1: "the difficulty is the number of them"; A.4.2: "because there was no other way to deal with that many" |
| `herald` | T.5.5: "every exhibit for a good distance around stirs at once" | S.9.3: "every animal in the court was standing up" |

### 3.3 The worst lines

1. "The gloves are filed together in a drawer marked Hands, Left and Right, where the staff say they keep each other company." (K.6.1). Cute anthropomorphism; MJT never makes objects lovable.
2. "The rules also described the spares as interchangeable, which the spares appear to have taken personally." (A.4, *Originals Under Glass*). A sitcom wink. Fix: "Under the rules the spares were interchangeable, and their bases are stamped CERTIFIED TRUE COPY to say so."
3. "Keepers report that throwing things at it is a mistake visitors make only once, and that it is happiest with a station standing behind it." (M.11.4). A stock phrase, anthropomorphism, *and* a false mechanical claim (m4). Rewritten below.
4. "the night staff describe it as the only colleague who has never been late" (S.9.2). Office comedy.
5. "which it copies closely and, the Office claimed, with better manners" (T.5.3). Whimsy.
6. "and that the street becomes, briefly, very busy" (T.5.5). A British-understatement gag.
7. "Please do not ask for your umbrella here. The staff cannot help, and they find the question difficult." (K.6 intro). A wink at the player.
8. "countersigned by four keepers, all of whom were, by then, awake" (S.9.3). A punchline.
9. "The linesmen called it the Courtier, and did not explain why." (M.11.3). A stock mystery tag.
10. "Your collection has a shape now. So do you." (M §12.3, the Registrar). An aphoristic kicker. Fix: "Twenty-five objects. The committee has opened a file in your name."
11. Directory winks:
    - "Floor 7½", used four times across P §5.2, §5.3, §5.4 and S §7: a film reference, and nothing in MJT is a reference;
    - "(the rooms are also smaller)";
    - "Open twice".

### 3.4 Rewrite 1: Single Gloves, Filed Together (K.6.1)

*Original:* "The Museum receives about one single glove a week and has never once received the other of a pair. The gloves are filed together in a drawer marked Hands, Left and Right, where the staff say they keep each other company. When the drawer is opened they leave it together and settle on the nearest warm hand. Staff report that each comes away easily, one at a time, and that the difficulty is the number of them."

*Rewrite* (80 words; first sentence 14):

> About one single glove is handed in each week, almost never with a note. They are kept palm down in a shallow drawer lined with tissue, lefts in one row and rights in the other, each tagged with the day it was found. When the drawer is opened the gloves cross the floor together and close round whoever is nearest. The cloakroom staff open it with a broom in the other hand. A glove lets go at the first tap.

*Hidden. Essential ref `mote_swarm`: many bodies that move together and surround; each dies to one hit. Fact-giving: a broom (an area weapon) is the counter. No other claim.*

**What changed.**
- Removed:
  - the "has never once" statistic joke;
  - "keep each other company" and "warm hand";
  - the recycled swarm punchline.
- Added:
  - one material practice (tissue, palm down, sorted by hand);
  - one human trace (the tag with the date found);
  - an ending on an observation rather than a button.
- The absurdity, a drawer of gloves that moves, belongs to the object. The sentences are sincere.

### 3.5 Rewrite 2: Reflecting Dish, on a Cart (M.11.4)

*Original:* "Dishes like this were wheeled into the line to turn a signal down a side gallery. The Line was proud of them. A dish returned a lamp's beam along exactly the path it came, so a careless operator could find their own signal coming straight back at them, and several did. Keepers report that throwing things at it is a mistake visitors make only once, and that it is happiest with a station standing behind it."

*Rewrite* (75 words; first sentence 14):

> Dishes like this were wheeled into the line where a signal had to turn. Each was polished every morning with whiting and a chamois, and the logbooks carry the polisher's initials beside the dish's number. A dish sends a beam or a bolt back along exactly the line it came in on. This one has a dent at shoulder height, beaten out and polished over, and a second set of initials scratched into the rim.

*Hidden. Essential ref `reflector`: returns bolts and beams along their line. Shielding allies and melee weakness are carried by the Behaviour field and pictograms (D-MU2(b)) or the family trail (c), not by this prose.*

**What changed.**
- Removed:
  - "The Line was proud of them" (generic);
  - "and several did" (a button);
  - "a mistake visitors make only once" (a stock phrase);
  - "happiest" (anthropomorphism);
  - the false claim about thrown objects.
- Added a maintenance practice and a human trace.
- The dent and the scratched initials let the reader infer an accident without being told a joke.

### 3.6 A rubric for T6 (style judge)

1. **The object may be absurd; the sentence may not be witty.**
2. **End on the object.** A material, a repair, a measurement or a location, not a turn. Kicker endings: at most one label in four per department.
3. **No feelings for objects** ("happiest", "taken personally", "keep each other company").
4. **One human trace per label:** a maker, a keeper's initials, a donor, a repair.
5. **Pool caps:** "report", "has never", "not the same thing", "Please …", "the Office".
6. **Tell a joke once.** If an archetype's joke has been told in another department, do not tell it again.

---

## 4. Calvino and Borges: structure or furniture?

| Borrowing | Where | Level | Verdict |
|---|---|---|---|
| Series × ordinal, diagonal cascade | V §9.1; M §6.2 (Atlas) | Structure | **Keep.** The best structural borrowing. It runs only *across* runs; consider running it *within* a run too (a family's second appearance in the same run is its next ordinal). |
| Celestial Emporium | P §5 (Directory) | Structure: arbitrary classification, owned by the institution | **Keep.** Trim the winks (§3.3, item 11). |
| Fake scholarship, attribution | CS §7 | Structure, misused | M2. |
| Compiler's bestiary | S.9's voice rule | Structure: a method of citation | **Keep.** The model for every other borrowing. |
| A Bao A Qu | V `completing_guardian`; S.9's Composite | Structure turned into mechanic | **Keep.** |
| Hidden Venice | M §6.4 (object zero) | Structure | **Keep**, but see B1: the samples put Venice on the surface. Calvino never describes Venice. |
| Polo–Kublai frame | Absent | – | M7. |
| *Castle of Crossed Destinies* (shared deck) | Shared makers (A.4's Countersigning Clerk is by M.11's Workshops of the Line); a shared calendar (S §0.2) | Structure, light | **Keep, and formalise** as a registry of makers and events. Make series objects deliberate (m3). |
| Tlön's *hrönir* | V `copies_weaken`; A.4 | Structure turned into mechanic | **Keep.** |
| Funes | CS §7.6 (Funes rule) | Structure turned into modifier | **Keep.** |
| Pavić's three contradictory sources | Absent | – | **Add** as a label format for Lenders departments and some Specimens departments (curator, community, dissent). The samples have no wall quotations at all. |
| Perec's Latin squares | Absent from L | – | m7. |
| Oulipo slots ("rhymes") | Label fields, room sockets | Structure | **Keep.** |
| Moves only when unobserved (S.9's Grazer) | V `unobserved_mover` | Furniture, from *Doctor Who* and SCP rather than Borges | **Acceptable.** "Reported, not observed" reframes it; players will still name the source. |
| Brass key, ledger, Founder as Soane's monk | M §6.4 | Furniture-ish | **Acceptable.** Keep the payoff small; the structural twist is "the last line of the ledger is your visitor number". |
| Banned list (labyrinth, mirror, tiger …) | P F2, T3 | Guard against furniture | **Good.** Extend it with the house tics from §3.6. |

---

## 5. Sensitivity rules: adequate, overcautious or underbaked?

| Rule | Verdict | Change |
|---|---|---|
| Wholly fictional cultures | Adequate as a rule about *representation* | Add the relationship check and material signifiers (M5) |
| No human remains | Adequate; keep it absolute | Give the death figure a medium line (m1) |
| Provenance as mechanic | **Underbaked**: absent from v1 | Conditions of gift and a Returns desk (M3) |
| Peoples rare, with voice and consent | **Underbaked** in mechanics (hostile keepers, dioramas); **inconsistent** in its cap | M5; rename to Lenders |
| Land as a place-idea | Adequate in T.5; **overcautious** as a lint and in the cut line | Practice and correspondence (M4) |
| "The institution is the joke" | Adequate as a rule for satire; **over-applied** as subject matter | B1 |
| The Directory never names a people | Adequate | – |

---

## 6. The ending, in one paragraph

The Registrar who wants to accession you is the right ending. It is the only boss that is about the game's own verb, it has been your service desk all evening, and its threat is a label, not a wound. Three changes make it great:

1. Take away its HP (M6 [Error]).
2. Let the player read the label being written about them, tag by tag.
3. Let escape be a loan ("due for return"), so every next run is the return.

Add the consent ending after the Founder's cabinet: sign yourself in. The game will then have said something about accession that no lecture could, and said it through a mechanic.

---

## 7. Missing museal ideas, costed

| Idea | Mechanic | Cost | Tier | Finding |
|---|---|---|---|---|
| Audio guide as the frame voice | Stair Hall interludes; stop numbers; a daytime narrator heard at night; hidden tour | Low in v1 (about 1,800 words) | v1 interludes; v1.x stops | M7 |
| Conservation as gameplay | Over-restoration lowers attribution; reversible treatments; Consolidate; lux fading | Low to medium | v1 (rules); Conservator verb with the class | M8 |
| Conditions of gift | Honour for a relation, breach for raw power plus a closed room | Low | v1 | M3 |
| Returns desk | Send back a "circumstances unrecorded" item for a relation | Low | v1 | M3 |
| Family trail labels | A plain-language lower label as a toggleable assist; the adult label stays literary | Low (S4 adds about 10 words per label) | v1 | M1(c) |
| Cleaners | Polisher noise mask and a slick trail; a neutral NPC | Low | v1 | m6 |
| Exit signs at night | Lit during Lights Down and the Night Watch; diegetic wayfinding | Trivial | v1 | m6 |
| The guard's chair | An empty chair means the guard is on patrol | Trivial | v1 | m6 |
| Postcard rack at the exit | Keep one reproduction: "After [X], postcard" | Low | v1 | m8 |
| Fragments retained | Exhibits you destroyed reappear as study fragments | Low | v1.x | m9 |
| Visitors' book at each coda | Lines from your earlier runs in this department, written from run logs | Low | v1.x | – |
| "No flash photography" signs | Mark photosensitive exhibits; using the Flash Camera there is a breach | Trivial | v1 | – |
| Bag check | "Bags larger than A3 must be checked" as the diegetic reason for the tote limit | Trivial | Flavour | – |
| Museum fatigue | No new meter: rotate registers and vary within rooms | Low | v1 | m7 |
| Re-hang (Wilson) | Put any item on an empty plinth to change the room's label and give it an aura | Medium | With the Absence family or the Curator | – |
| CCTV control room | Cameras, plus a room where they can be switched off | Medium | L+ | m6 |

---

## 8. Decisions this adds for Julian

| # | Question | Options | Lean |
|---|---|---|---|
| D-MU1 | How wide is the register? | (a) one house register, institutional deadpan, as in the samples; (b) a register field with quotas and sequencer alternation; (c) a fixed register per family | **(b)** |
| D-MU2 | Where does the mechanical truth live? | (a) a didactic Essential line (D-S5a); (b) a controlled-vocabulary *Behaviour* field on the tombstone; (c) a family-trail label | **(b)**, with (c) as an assist |
| D-MU3 | Provenance in v1 | (a) none, as drafted, and strike it from the pillars; (b) conditions of gift plus unrecorded items with a Returns desk; (c) full Claims with Lenders | **(b)** |
| D-MU4 | Lands | (a) unpeopled; (b) inhabited by practice and correspondence; (c) residents as NPCs | **(b)** |
| D-MU5 | The finale | (a) as drafted (an HP fight with the Registrar); (b) no HP on staff, fight the retrospective, tags as a label of you, escape as a loan; (c) (b) plus the consent ending | **(b) in v1, (c) in v1.x** |
| D-MU6 | Audio guide | (a) none; (b) Stair Hall interludes only; (c) per-department stops | **(b) in v1, (c) in v1.x** |
| D-MU7 | Attribution | (a) a knowledge ladder, as drafted; (b) cataloguing status plus attribution as revealed quality, able to go down | **(b)** |
