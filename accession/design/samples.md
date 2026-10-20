# Worked example departments

*Section draft for the ACCESSION design document, 2026-10-20. Written inside the direction memo. It uses the vocabulary draft's ids exactly (cited as V), and follows the pipeline draft's data model and numbering (P), the core-systems draft's clock, guards, NPCs and Signature pieces (CS), the difficulty draft's Masterpiece forms and fingerprints (D), and the meta draft's accession rules (M). Research is cited only through the briefs: LM = literature-museology, PS = papers-semantic, ML = museum-layouts.*

## 0. What this section is for

Five departments, worked to the depth that S2 (mechanical compile) and S4 (text) would have to reach, plus thirty one-line pitches, a Directory excerpt and a self-critique. The five do three jobs:

1. **A test of the vocabulary.** Every exhibit, item, module and Masterpiece below is built from V's closed tables. Where a department wanted something V cannot express, I say so instead of inventing a verb (V contract rule 2, no silent fallback). Those gaps are collected in §8.
2. **Exemplars for the generator.** P's S1 and S4 prompts use exemplar sets. These five are candidates, with the caveat in §11 (Risks) that exemplars become templates.
3. **Calibration targets.** Each department ends with the fingerprint I expect S3 to measure. If S3 measures something else, either my reasoning or the vocabulary's "favours / punishes" columns are wrong, and both are worth knowing.

### 0.1 The five at a glance

| | T.5 | M.11 | S.9 | A.4 | K.6 |
|---|---|---|---|---|---|
| **Title** | A Town Known Only at Low Water | Long Galleries, Considered as Telegraph Lines | Animals Not Yet Seen by the Day Staff | Things Kept in Duplicate, Before the Repeal | Objects Lent by Visitors Without Meaning To |
| **Naming slot** (LM §3.2) | *[Things] Known Only …* | *[Noun], Considered as [Noun]* | *[Things] Not Yet [participle]* | *[Things] [qualifier]* | *[Things] Lent by [lender]* |
| **Family, ordinal** | Tides II | Machines II | Specimens III | Copies I | Classification III |
| **Category** | `land` | `technology` | `natural_history` | `era` | `concept_institution` |
| **Primary / secondary type** | `hazard_terrain` / `attrition` | `artillery` / `hazard_terrain` | `guarded` / `darkness` | `swarm` / `locks_puzzle` | `locks_puzzle` / `guarded` |
| **Programme** | `grand_hall` | `enfilade` with staff corridor | `sculpture_court` | `case_labyrinth` | `rotunda` with ambulatory |
| **Signature (+ secondary) module** | `tide_cycle` | `hourly_demonstration` + `weather_cases` | `unobserved_motion` + `alarm_network` | `copies_weaken` | `sorting_vault` + `heist_plinths` |
| **Masterpiece form** (D §6.4) | Fight: `mp_colossus` | Fight: `mp_tableau` | Treasure, Sentinel `completing_guardian` | Fight: `mp_ensemble` | Treasure, Sentinels `mp_ensemble` |
| **Keepable Signature piece** | Fending Pole of the Fourth Harbourmaster | The Line Superintendent's Pocket Heliograph | The Day Curator's Lamp | The Repealing Pen | The Counter Bell, First Pattern |
| **Predicted dominant persona** | `cautious` | `cautious` (Sneak close) | `sneak` | `vandal` with an area weapon | `completist` |
| **L+ dependencies** | `mp_colossus` | none | none | `diorama_spawner`, `breaker`, `attribution` | `recase` |

Five families, five primary types, five programmes, and five of the six subject categories; the sixth, `art_form`, is already illustrated by V §10.6's "Works on Paper, After Hours".

### 0.2 Conventions used in every sample

**Numbers.** S2 emits ids, roles and S/M/L classes only (V §10.1). Where a number appears in brackets, it is the balancer's reference value from V §1.6 or the module's default range, shown for readability. Player-facing text never states a balancer number: a panel names *where* the number is posted ("the timetable at the tide gauge") so that recalibration never invalidates a label.

**Label anatomy.** I follow LM §3.3 and the sample labels, with one rule made explicit:
- **Tombstone line:** title · maker or attribution · date in the invented calendar · medium · dimensions · credit line · catalogue number (P §6.3).
- **Modifiers live in the tombstone.** Each modifier's truth is carried by its V §3 "tombstone cue" (the Medium line says "bronze"; a later repair is named in the medium or condition). The S4 round-trip check reads it there.
- **The didactic carries exactly one Essential line**, the one named by `essential_ref` (P §2.2). It is phrased as an observation by a named role ("keepers report", "the round book records"), never as an instruction. Everything else in the didactic is Flair, or Fact-giving lines with no mechanical content (provenance, repairs, people). Wake triggers are pictograms on the tombstone line (CS §13.2), not prose.
- **Gateway labels** (Masterpieces and Treasures, up to 120 words) carry one Essential line and one Fact-giving counterplay clue. They are the View text (CS §5.4), so they are allowed to help.
- **The hidden line** after each label, in italics, states what the S4 round-trip extractor must recover, and nothing more.

**Materials.** A Medium line may name only the material modifiers the species actually has. Other materials come from a neutral list (iron, oak, ash, hemp, wool, leather, tinplate, paper only where `paper` applies, and so on). This matters more than it looks: writing "brass" on a species without `clockwork` would fail T1, because "brass, steel; escapement" is clockwork's cue.

**Items.** Budget points follow V §5.1: S = 1, M = 2, L = 3, drawback = −1; ordinary ≤ 3, Highlight ≤ 4, keepable ≤ 5. V does not price flag primitives (`sweep`, `reach`, `sure_footed`, `breaker`); I price a flag as 2 points throughout and list this as a vocabulary gap (§8.2).

**Calendar.** Museum-wide events are shared across departments, so the invented calendar accumulates meaning: the First and Second Calibration, the Great Reshelving and the Reinstallation (from LM's samples), and the Second Inventory (new here). Department-local events (floods, the Long Ebb) appear only in their own department.

**Guards.** CS §3.7's staff Guards are NPCs and cannot be harmed. In these samples V's `patrol_guard` is always an *exhibit* that walks a route (a specimen, an automaton), so the two never collide. See Challenges, item 4.

**Room names, not numbers.** Room numbers depend on run position (CS d00–d99), so gallery plans name rooms; the runtime numbers them.

### 0.3 How much text one department is

Measured from the five samples below by script (words of player-facing text; hidden lines, tables and design notes excluded). It is the number to budget S4 output and S6 curation from.

| Department | Panels | Labels (didactic, item, gateway) | Tombstone lines | Barks | Biography | Total |
|---|---|---|---|---|---|---|
| T.5 | 468 | 791 | 379 | 28 | 241 | 1907 |
| M.11 | 375 | 698 | 284 | 29 | 195 | 1581 |
| S.9 | 365 | 756 | 349 | 29 | 228 | 1727 |
| A.4 | 370 | 724 | 364 | 27 | 193 | 1678 |
| K.6 | 363 | 617 | 268 | 31 | 215 | 1494 |
| **Mean** | | | | | | **1677** |

At about 1,700 words per department, a 30-department launch is about 50,000 words of curated text, before object zero, study-collection grammars and consumable skins. Most of it sits behind a tap (D-S1); the tombstone lines and barks are what nearly every player sees.

---

## 1. T.5 A Town Known Only at Low Water

### 1.1 Card

| Field | Value |
|---|---|
| Accession | `T.5` |
| Title | A Town Known Only at Low Water |
| Family, ordinal | Tides II (signature module only, but its deep stage is on) |
| Category | `land` |
| Conceit | A harbour town exists only between tides: twice a day the sea occupies its streets, and everything the Museum holds from it was collected on foot, at low water, in the hours the town allowed. |
| House rule (the sentence S2 maps to the module) | "The town keeps to the timetable." |
| Challenge claim | primary `hazard_terrain`, secondary `attrition` |
| Signature wake trigger | `noise(2)`: a soaked visitor moves loudly (V §4 `soaked`: movement noise +1) |
| Domains → ids (P's trace map) | **tides** → `tide_cycle`, `displacer`, Crane Driver's Lever · **harbour** → `charger`, `lobber`, Fending Pole · **glass** → `mote_swarm` + `glass`, Street Broom, Hobnailed Waders |
| Sensitivity review ("which real group does this read as?") | None intended. Real tidal-island towns exist, so the frame avoids religious buildings, causeway pilgrimages, costume, food and named dialect. Every object is civic or maritime equipment; every role is an office (harbourmaster, sweeper, driver). No residents appear as NPCs (Challenges, item 2). |

### 1.2 Panels

**Intro panel** (167 words)

> The water marks on these walls are real, and they are recent. This department holds what the Museum collected from a town that exists only at low water. Twice a day the sea occupies its streets. The rest of the time the streets are dry, and the town is open. Collectors walked out at low water with handcarts and a copy of the timetable, took what the Low-Water Office would lend or sell, and walked back before the water turned. The Office kept the timetable, and the town kept to it. When the Museum installed the collection, the sea came too. In this department the water rises to the second step on the timetable posted at the tide gauge, stays a short while, and goes out again. The upper galleries stay dry. We do not know how the sea found its way indoors. The Office, asked in writing, replied with a corrected timetable. Please keep to the walkways at high water, as the Office's own staff did.

**Section panel: The High Street** (106 words)

> This is the town's main street, laid out as the collectors found it and at the height they found it. The cobbles are original. So are the bollards, which stand in the order they stood along the quay, and the strings of glass floats that hung between them. At high water the street is under about a metre of sea. Nothing in the Office's records describes anyone fighting in it, and the reason is practical: nobody can swing anything while swimming. The stairs at either end lead to the upper storeys, which the sea has never reached. The Office's sweepers kept their brooms on the landings.

**Section panel: The Quay** (99 words)

> Everything on the quay was built to move heavy things a short distance, quickly, before the water came back. The Office's drivers trained on the working model of the harbour crane before they were allowed near the real one, and the model has outlasted the crane by many years. The apparatus beside it threw lines to boats that had misjudged the tide and grounded in the street, which the Office's ledger records about once a month. The blue-grey paint on both is the Office's own colour. It was renewed every spring, until the spring the Office closed its ledger.

**Section panel: The Low-Water Office** (96 words)

> The Office occupied two rooms above the street, which is why its papers survived. It published the timetable, licensed the boats, paid the sweepers by the street rather than by the hour, and answered letters. The tide board in the window was moved by hand, numeral by numeral, and kept low-water hours, which the Office considered the only hours that mattered. The door behind the counter leads to the Office's back stairs. The Museum has kept the furniture where it stood, including the bench where visitors waited to be told whether the street would be open.

### 1.3 Programme, layout, palette, audio

**Programme: `grand_hall`** (ML P4), with the shared staff layer behind the Low-Water Office.
- **Why.** `tide_cycle` is ++ in `grand_hall` (V §6.4). The programme's balcony bands are exactly the module's high ground, and its stairs are the chokepoints between dry and wet (ML P4: "the stairs are the chokepoints"). Table B's constraint "≥15% high tiles reachable from every low region" is met by the two balcony bands plus the stair heads.
- **The tactical story.** Low water: the floor is the short route, and the cases on it are the loot. High water: the balconies are the only place to fight, and the crane and the line-thrower can reach you there.

| Gallery | Role | Contents |
|---|---|---|
| The Tide Gauge | Intro | V §6.5's tide intro, reskinned: raised walkway, low floor, tide gauge `wall_panel`, one dormant Doorstep (T.5.6) |
| The High Street, west | Section 1 | the grand hall's west half; low floor about 45%; 2 Bollards, 1 string of Floats; 4 flooded study cases; balcony band above |
| The High Street, east | Section 1 | east half; 1 Bollard, 1 Tide Bell at the far stair; the Hobnailed Waders in a balcony case |
| The Quay | Section 2 | sunken dock (low floor) between two balcony piers; Crane model, Line-Throwing Apparatus, 1 string of Floats |
| The Low-Water Office | Section 3 | two dry rooms at height 1; Tide Board (Highlight); bench; staff door; object zero |
| The Breakwater | Masterpiece hall | low floor about 60%; 6 columns; 2 balcony piers with a lectern on the north pier |
| The Office Counter | Coda | gift kiosk, 2–3 exit doors |

**Palette** (ramp ids from P's authored set; names provisional): material `wet_granite` (blue-grey cobbles); accent `office_blue_grey` (desaturated, clear of V §1.8's reserved hues); wall `salt_limewash` with a damp band at tide height; floor `cobble_setts`. Water tiles palette-cycle between two shades of the wall ramp, so the flood never reads as a hostile colour.

**Audio:** mode aeolian; family bowed (low strings); tempo slow. Motif: a four-bar figure that rises and falls with the tide, `a3 . c4 e4 | d4 . . _ | c4 . b3 a3 | _ . . .`. The tension layer at the deep stage drops the bass an octave and adds the tide gauge's tick as percussion, so the player hears the stage change without looking at the gauge.

### 1.4 Rule module and the Intro gallery

**Signature: `tide_cycle`**

```json
{ "module": "tide_cycle",
  "params": { "period": "M", "peak_stage": 2, "low_floor_share": "M", "swimmers": ["T.5.1", "T.5.12"] },
  "essential_line": "In this department the water rises to the second step on the timetable posted at the tide gauge.",
  "pictogram": "wave_over_step" }
```

- `period` M is about 16 turns from V's 12–20 range. Stages per cycle, as in V §6.5: dry, shallow (slowed and soaked), deep (swim only, no attacks; heavy items drag), shallow, dry.
- `swimmers` is **not a V parameter.** V §6.5 implies that some actors swim ("one dormant plodder, not amphibious") but no table says which. I add it here as a `tide_cycle` parameter listing the species that move normally in deep water, and file it as a vocabulary gap (§8.2). Everything not listed is a non-swimmer: in deep water it cannot move or attack and it drowns (V §6.5: "the plodder drowns if it is lured onto the low floor").
- No secondary module. The attrition secondary comes from the cycle itself: every high water costs time on the closing clock.

**How the Intro teaches it.** V §6.5's layout and timings, with T.5's skin: the walkway is "the Office's raised pavement", the gauge is the Office's own tide gauge, and the plodder is the Doorstep From No. 9 (T.5.6), which is a non-swimmer. The panel on the gauge reads "Please keep to the raised pavement at high water." V3 is V §6.5's: the aware Cautious novice waits on the walkway; the blind novice crosses at the first shallow stage and is caught by the deep stage in ≥ 30% of seeds. The lesson the Intro also allows, never requires: lure the Doorstep onto the low floor just before the deep stage, and it drowns.

### 1.5 Species

| No. | Name | Archetype + modifiers | Role | Tag, silhouette | Wake | Notes |
|---|---|---|---|---|---|---|
| T.5.1 | Glass Net Floats, Strung on Their Original Line | `mote_swarm` + `glass`; count M | swarm | pursuer, cluster | `noise(2)`, `prox(4)` | swimmer; each body leaves shards |
| T.5.2 | Mooring Bollard, Ambulant | `charger` + `bronze` | brute | pursuer, mass (alt) | `prox(5)`, `noise(3)` | companion piece to the Masterpiece (D M3) |
| T.5.3 | Harbour Crane, Working Model | `displacer` + `old_repair` (side: left) | controller | controller, figure (alt) | `prox(5)` | pushes into deep water or off balconies |
| T.5.4 | Line-Throwing Apparatus, Quay Pattern | `lobber` | artillery | ranged, mass | `prox(6)`, `alarm` | screened by Bollards (V §10.5) |
| T.5.5 | Tide Bell, on Its Float | `herald` | support | support, tall | `prox(5)` | iron, not bronze (see the materials convention) |
| T.5.6 | Doorstep From No. 9, Low Street | `plodder` + `marble` | fodder | pursuer, figure | `prox(3)`, `noise(2)` | orientation pool; the Intro's teaching instance |

Six archetypes, four distinct modifiers. Every pair of hostile species differs in silhouette or tag. Counter tags (V §1.9) are all satisfiable: Floats {aoe: Street Broom; choke: stairs}, Bollard {timing; los: columns}, Crane {los; timing}, Line-Thrower {timing; melee}, Bell {los; burst}, Doorstep {melee; choke}.

---

**Glass Net Floats, Strung on Their Original Line**
Made for the harbour nets of the Low-Water Office · Before the Ninth Flood · Blown glass, tarred hemp; six floats, one cracked · Diam. 9–12 cm each · Gift of the Low-Water Office · T.5.1

> These floats held the harbour nets up at high water and lay in heaps in the street at low. Each one is blown thin, so that it floats well, and the Office replaced about forty a year. When the line is disturbed the floats roll together towards whatever disturbed them. The night staff report that one sharp tap breaks any of them. The difficulty, they add, is that there are always more on the line.

*Hidden. Essential ref `mote_swarm`: 5–6 bodies, each dies to one hit; they move 1–2 and surround. Tombstone cue `glass`: blunt ×1.5; body does not block sight; leaves shards on its tile at death. Swims (moves normally in deep water).*

---

**Mooring Bollard, Ambulant**
Cast for the Low-Water Office by the foundry on the Upper Landing · After the Third Flood · Bronze, worn bright at the waist by ropes · H. 74 cm, Diam. 41 cm · Transferred from the Department of Street Furniture · T.5.2

> Bollards on the quay were cast heavy, so that a boat pulling on its rope would stop before the bollard did. This one has been moved several times by the Museum and, according to the night staff, once by itself. They describe it lowering its head, then crossing the gallery in a straight line until something solid stops it, after which it stands still for a while, as if checking for damage. The column by the west stair has been repaired twice.

*Hidden. Essential ref `charger`: telegraphs 1 turn, then rushes up to 5 tiles in a line; dazed 2 turns if it hits a wall, column or case (the glass breaks). Tombstone cue `bronze`: blunt ×0.5; cannot be pushed; every hit on it rings (noise 2). Non-swimmer.*

---

**Harbour Crane, Working Model**
Made by the Office's drivers for training, at one-twelfth scale · Before the Seventh Flood · Oak, iron, hemp; left side of the tower a later repair in pine · H. 210 cm · Gift of the Low-Water Office · T.5.3

> Drivers trained on this model before they were allowed near the real crane, which it copies closely and, the Office claimed, with better manners. According to the training notes, it lifts whatever comes within reach of its hook and sets it down two lengths away, and the instructor complains that it always sets the load down on the wet side of the quay, whatever the driver intended. The notes do not say whether this was ever corrected.

*Hidden. Essential ref `displacer`: range 3, telegraphed 1 turn; pulls or pushes the target 2 tiles, into hazards (deep water) or off balconies. Tombstone cue `old_repair` (left): that side takes ×2 damage. Non-swimmer.*

---

**Line-Throwing Apparatus, Quay Pattern**
Workshops of the Low-Water Office · About the year of the Long Ebb · Iron, oak, coiled hemp line; chalk box · L. 118 cm · Gift of the Low-Water Office · T.5.4

> When a boat misjudged the tide and grounded in the street, the Office threw it a line from the quay. The apparatus lobs a weighted coil in a high arc, over anything in the way. Its keeper's first duty, according to the Office handbook, was to chalk the landing place on the ground, so that nobody would be standing there when the coil came down a moment later. The chalk box is original and still about half full.

*Hidden. Essential ref `lobber`: marks a 3×3 area that is hit on the next turn; arcs over glass and low furniture; weak in melee. Non-swimmer.*

---

**Tide Bell, on Its Float**
Cast for the Low-Water Office · Before the First Flood, by tradition · Cast iron; float of tarred oak; clapper replaced · H. 132 cm · Gift of the Low-Water Office, on condition that it not be rung · T.5.5

> The tide bell was moored at the end of the street to warn the town of the water. It has kept the habit of announcing whatever it sees approaching. The Office's condition of gift asks that it not be rung, and the Museum tries to honour this by keeping visitors out of its sight. When it does ring, the night staff report that every exhibit for a good distance around stirs at once, and that the street becomes, briefly, very busy.

*Hidden. Essential ref `herald`: on sighting you it rings for 1 telegraphed turn, then wakes every dormant exhibit within 6 tiles. Non-swimmer (it stays on its float, which is fixed).*

---

**Doorstep From No. 9, Low Street**
Dressed by an unrecorded mason · Before the Fourth Flood · Marble, with a tide line 31 cm from the base · L. 96 cm, W. 38 cm · Purchase, Fund for the Acquisition of Thresholds · T.5.6

> The houses of the town stood on high doorsteps, and the doorsteps, according to the Office, were the first thing replaced after every flood. This one was bought from the owner of No. 9 when the house was rebuilt. It has a dark line a hand's width below the top, where the water usually stopped. The night staff, who have watched it cross the hall on several occasions, report that it has never once been seen to float.

*Hidden. Essential ref `tide_cycle` non-swimmer: on deep water it cannot move or attack and it drowns. Archetype `plodder`: moves 1, melee. Tombstone cue `marble`: edge ×0.5, one speed class slower, immune to cut and burning.*

### 1.6 Items

| No. | Name | Category | Primitives (+ drawback) | Points | Slot |
|---|---|---|---|---|---|
| T.5.7 | Street Broom of the Low-Water Office | weapon | `strike_kind(blunt, S)`, `sweep` | 1 + 2 = 3 | ordinary |
| T.5.8 | Hobnailed Waders, Office Issue | garment | `sure_footed`, `armour(S)` | 2 + 1 = 3 | ordinary; the required `hazard_terrain` counter (V §8.2) |
| T.5.9 | Crane Driver's Lever, Detached | instrument | `displace(M)` | 2 | ordinary |
| T.5.10 | Tide Board of the Low-Water Office | curio | `clock_extension(M)`, `perception(S)` | 2 + 1 = 3 | Highlight, Low-Water Office |
| T.5.11 | Fending Pole of the Fourth Harbourmaster | weapon | `strike_kind(blunt, M)`, `reach`, `knockback(S)` | 2 + 2 + 1 = 5 | keepable Signature piece |

Consumable weights: `tonic` ×1.5 (the attrition secondary), `evacuation_card` ×1.5. Three of the twelve neutral skins (D-V7b; no functional hint): "Corked Bottle, Green Glass", "Folded Chart, Oilcloth", "Tin Token, Pierced".

**Street Broom of the Low-Water Office**
Office stores · After the Eighth Flood · Birch twigs, ash handle, iron band · L. 142 cm · Gift of the Low-Water Office · T.5.7
> Issued to the Office's sweepers, who cleared the street of weed, sand and broken floats in the hour after each tide. It clears three paces of ground at a stroke, lightly. The sweepers were paid by the street, not by the hour.

*Hidden. Weapon: `strike_kind(blunt, S)` (light, fast), `sweep` (hits the 3 front-arc tiles at −1 damage class).*

**Hobnailed Waders, Office Issue**
Made for the Office by its own cobbler · Before the Ninth Flood · Oiled leather, iron hobnails, canvas braces · H. 118 cm · Gift of the Low-Water Office · T.5.8
> The sweepers wore these on wet cobbles, weed and broken glass. The hobnails grip, and the leather is thick enough that nothing on the street floor ever got through it. Nothing about them is comfortable.

*Hidden. Garment: `sure_footed` (immune to slick, to cuts from shards, and to pushes of 1), `armour(S)`.*

**Crane Driver's Lever, Detached**
From the harbour crane (not the model) · After the Sixth Flood · Iron, oak grip worn smooth · L. 64 cm · Gift of the last crane driver · T.5.9
> The real crane's lever, kept by its last driver when the crane was taken down. Pulled hard, it moves a load two lengths in either direction. The driver gave it on condition that it be used rather than displayed. The Museum has displayed it.

*Hidden. Instrument: `displace(M)`, 2 charges; push or pull a target 2 tiles. At the deep stage, a push onto low floor drowns a non-swimmer.*

**Tide Board of the Low-Water Office** (Highlight)
Painted by the Office · Altered after every flood until the Office closed · Painted pine, iron hooks, enamel numerals · H. 61 cm, W. 44 cm · Gift of the Low-Water Office · T.5.10
> The Office hung this board in its window and moved the numerals by hand. It kept low-water hours, which are longer than ordinary hours, and the Office noted with disapproval that anyone who carried it was late for everything. Its lower hooks mark which of the street's panels were hinged for drainage.

*Hidden. Curio: `clock_extension(M)` (closing clock +20%), `perception(S)` (hinged panels and mimic tells within 2 tiles).*

**Fending Pole of the Fourth Harbourmaster** (keepable Signature piece)
Office workshops; iron hook by the foundry on the Upper Landing · During the Long Ebb · Ash, iron hook, tip worn flat on one side · L. 3.4 m · Gift of the Fifth Harbourmaster · T.5.11
> Harbourmasters fended boats off the quay with poles like this, from a safe distance, at the moment the water turned. The Fourth carried this one through the Long Ebb, when the sea stayed out for most of a year, and used it, the Office records, mainly for pointing. The tip is worn flat on one side from pushing.

*Hidden. Weapon: `strike_kind(blunt, M)`, `reach` (attacks 2 tiles in a line), `knockback(S)` (push 1). Module link: it pushes a target off the walkway into the flood from outside the target's reach. Dropped by the Masterpiece on defeat (CS §6.5); always eligible for accession (M §4.2).*

### 1.7 NPC

One **Fellow visitor** (CS §11; V `rival_visitor`, neutral, L+), "A Visitor With a Copy of the Timetable". Offers gossip (the room of one Highlight) or a trade.

| Type | Bark |
|---|---|
| Essential | "Water's turning. Get up the stairs." |
| Fact-giving | "The crane always puts things down on the wet side." |
| Flair | "I came for the lamps. Nobody said the street was the exhibit." |

### 1.8 Masterpiece: The Breakwater, Ninth Section (Fight)

**Assembly (V §2.4).** Core `mp_colossus` (L+; 2×2, slow, telegraphed sweeps and slams that reshape the room); attachment `herald` ("The Breakwater Bell", a second tide bell bolted to its seaward face); specials `sweep`, `charge`, `shatter_all`; the hall runs `tide_cycle` at its strongest setting (period S, about 12 turns; peak stage 2; low floor about 60%). The Breakwater is listed in `swimmers`: it ignores the flood. That is the hazard test: you cannot attack while swimming, and it can.

| Phase | Trigger | What changes |
|---|---|---|
| 1 | Hunting, 100–67% HP | `sweep` (5-tile arc, damage L) and `charge` (line to 5; breaks glass) alternate on its cadence. Fight from the piers at high water and on the floor at low water. |
| 2 | 67% HP | `shatter_all` (2-turn telegraph): every vitrine in the hall breaks, leaving shards across the low floor and releasing one string of Floats. The Breakwater Bell wakes and rings. |
| 3 | 34% HP | Its charges topple columns. A toppled column becomes a 1-tile rubble block at height 1: new high ground on the low floor, and longer charge lanes. Special cadence shortens to every 2nd action (D M1). |

**Gallery hooks (V §2.4, D M3).** Each Bollard destroyed in the galleries: −8% Masterpiece HP (cap −24%); each Bollard left awake joins phase 3 (cap 2). Each department alarm raised: one more Breakwater Bell in phase 2 (cap 2).

**Certificate by View.** The lectern stands on the north pier, at height 1, four tiles from the plinth: reachable dry at any stage.

**Gateway label** (89 words)

**The Breakwater, Ninth Section**
Built for the Low-Water Office in nine sections, of which this is the last · After the Fourth Flood · Granite blocks, iron cramps, barnacles (dead) · H. 3.1 m, W. 3.0 m · Gift of the Low-Water Office, on the town's behalf · T.5.12
> The town's breakwater was built in sections so that a storm could take one without taking the town. This is the ninth, which the Office called the reserve. When the Museum lifted it, the sea followed it here. It moves as a breakwater moves in a storm: slowly, then all at once, sweeping the ground in front of it. The Office's drawings show the Fourth Harbourmaster's pole wedged in its iron cramps. It is still there. The piers at either side of this hall stay dry at every tide.

*Hidden. Essential ref `mp_colossus`: telegraphed sweeps in front of it. Fact-giving: the piers are high ground. The pole is the Signature piece.*

### 1.9 Biography: the Low-Water Office (Caves of Qud style)

1. Before the First Flood, the town was surveyed at the level of the lowest tide, and the Low-Water Office was established to publish the hours when it would be dry.
2. The First Harbourmaster had the breakwater built in eight sections and refused a ninth, on the grounds that a town which plans for every storm builds nothing else.
3. After the Fourth Flood took the third section, the Fourth Harbourmaster had the ninth section built as a reserve, and fended off the boats that came to watch it set.
4. During the Long Ebb, when the sea stayed out for most of a year, the Office reprinted its timetable eleven times, and the Fourth Harbourmaster's fending pole was used mainly for pointing.
5. When the sea returned, it brought the pole back, wedged in the iron cramps of the ninth section, and the Office voted not to remove it.
6. In the year the Office closed its ledger, the Museum's collectors walked out at low water and bought the doorstep of No. 9, the tide board and the crane model, paying in the Office's own tokens.
7. The ninth section was lifted last, and when it was installed in the Museum the sea came with it. The Office, asked in writing, sent a corrected timetable.
8. The Fifth Harbourmaster gave the pole to the Museum on condition that it stay in the breakwater until someone could carry it out.

### 1.10 Expected fingerprint

| Persona | Prediction | Why |
|---|---|---|
| `cautious` | dominant | Waits on the walkways through each deep stage, fights at low water, reads the crane's telegraph. |
| `completist` | second | The clock is generous enough (`attrition` secondary costs time, not HP), but it crosses the low floor most often. |
| `sneak` | middle | The tide ignores stealth, and soaking makes movement louder (the signature wake trigger). |
| `looter` | middle | Half the study cases are on the low floor and flood. |
| `vandal` | low | Chases Bollards in straight lines and gets charged; fights in shallows. |
| `tourist` | contested | V §8.2 predicts the Tourist is punished (the shortest path crosses the low floor at the wrong stage). D §5.1 predicts the Tourist dominates hazard departments (fewest hazard tiles crossed). Here the low floor is on every route, so I expect V's reading, but this is exactly the disagreement S3 exists to settle. |

Damage mix (predicted): terrain 35% (drowning, shards, falls, collisions), melee 35%, ranged 15%, status 15%. V2: the tide-blind persona loses ≥ 20% more HP (Table B).

### 1.11 Edge cases

- **Pushed off a pier at the deep stage.** Fall damage (M, V §7.2 `balustrade`), then deep water: swim only, no attacks, items of Clearance 2+ drag. The displacer's 1-turn telegraph means this is always avoidable.
- **The Night Watch at high water.** I propose that staff do not enter deep water and wait at the nearest dry tile (owner: CS §5.3). The deep stage then briefly shelters you from capture, never from exhibits.
- **Fire.** Burning cannot exist on flood tiles (V §3.1, interaction 2), so a spirit lamp thrown at the Floats at high water fizzles.
- **A Bollard that charges into deep water** stops where its line ends and drowns over the deep stage. Luring it is a legitimate kill.

---

## 2. M.11 Long Galleries, Considered as Telegraph Lines

### 2.1 Card

| Field | Value |
|---|---|
| Accession | `M.11` |
| Title | Long Galleries, Considered as Telegraph Lines |
| Family, ordinal | Machines II (signature plus a secondary) |
| Category | `technology` |
| Conceit | The building was once too long for a voice to cross, so its longest galleries were fitted as signalling lines; the department keeps the apparatus and the logbooks, which record every signal sent and no message received. |
| House rule | "The line is cleared on the bell." |
| Challenge claim | primary `artillery`, secondary `hazard_terrain` |
| Signature wake trigger | `period(p)`, aligned to the bell: dormant stations stir when the line exchanges |
| Domains → ids | **signals** → `axis_sniper`, `kiter`, `reflector`, `bolt(light)` · **timetables** → `hourly_demonstration`, `demonstrator`, the Docent · **trials** → `weather_cases` (fog and rain jars), `clockwork`, `extinguish` |
| Sensitivity review | None: an invented institutional technology. Avoids real telegraph codes, real signalling services and military framing; nobody is ever signalled *at*. |

### 2.2 Panels

**Intro panel** (170 words)

> Look down the length of this gallery and you can see the next five doors. That was the point. The building was once too long for a voice to cross, so its longest galleries were fitted as signalling lines: shutters, flags, lamps, and a heliograph at every landing, each passing the signal to the next. The logbooks survive. They record every signal sent, the time it was sent and the time it arrived, and not one message. The line is still kept to its old timetable. On the bell, the stations exchange signals down the length of the gallery, and anything standing in the line is in the way. A warning bell sounds shortly before each exchange. Each station's timetable is pinned to its frame, and visitors are asked to read it before crossing a doorway. The Museum has never established what the line was for. The last Line Superintendent, asked in retirement, said that it was for keeping the line open, and that this had been a full-time job.

**Section panel: The Line** (107 words)

> The timetables on the stations' frames are in several clerks' hands, and one clerk has corrected another's spelling of the word arrival, twice. The Museum has left both corrections in place. The stations exchange on the bell and do nothing between bells except travel their short rails at the side of the gallery. The doorways between rooms are where the line was narrowest and the signals strongest, and the logbooks record most of the line's injuries there. The side corridor behind the west wall was built for linesmen to pass the stations without crossing the line. It is dim, and it was never on the visitors' route.

**Section panel: Weather Kept for Trials** (98 words)

> In this section the cases hold weather. The Line kept fog and rain in sealed jars to test whether a signal would carry in bad conditions, and the jars are displayed as the Line left them, on the floor beside the apparatus. Breaking a jar releases its weather into the room for some time. Fog stops a signal; the logbooks call it a failure, and the linesmen called it a holiday. Rain stops the stations themselves, which were never made waterproof, because the Line regarded the weather as somebody else's department. The Museum regards it the same way.

### 2.3 Programme, layout, palette, audio

**Programme: `enfilade`** (ML P1) with a parallel staff corridor and 3 cross-links (ML §3.4 cycle type "two routes").
- **Why.** `hourly_demonstration` is ++ in `enfilade` (V §6.4), and `artillery` lists `enfilade` as a producer (V §8.1). The aligned door axis is the signal line itself: the conceit *is* the programme's tactical property, a long sightline in both directions.
- **The staff corridor** is the counterplay the programme needs: without it, the enfilade is a corridor shooting gallery (ML pitfall 2). V §10.5 requires a screen for artillery unless the primary is artillery and the room has ≥ 2 sight-blockers; every gallery here gets 2 columns or shutter screens off the axis.

| Gallery | Role | Contents |
|---|---|---|
| The First Landing | Intro | short enfilade of 2 rooms; one Semaphore Station whose line crosses the only door; one Logbook Trolley (see the sketch below) |
| The Line, rooms 1–3 | Section 1 | 3 rooms on the axis; Heliographs at the axis ends; 1 Signal Lamp; staff corridor behind |
| Weather Kept for Trials | Section 2 | 2 rooms with 5 `weather_jar`s (3 fog, 2 rain); Reflecting Dish; Signal Lamp |
| The Logbook Room | study room off the corridor | bench; Signal Flag (Highlight); object zero |
| The Central Station | Masterpiece hall | the Great Board at the axis terminus; lectern off-axis; 2 rain jars in the corners |
| The Linesmen's Canteen | Coda | gift kiosk; exits |

**Palette:** material `tinplate` (cool greys); accent `signal_pink` (faded bunting, desaturated, clear of the reserved red); wall `station_cream`; floor `oak_strip`, laid along the axis so the line reads from across the room.

**Audio:** mode dorian; family plucked (dry, short, telegraph-key attack); tempo brisk. Motif: a rhythm before a tune, `e5 e5 . e5 | _ e5 e5 _ | g5 . e5 . | d5 _ _ _`. The bell layer is scheduled from the module, so the music marks the exchange: two bars of silence, then the warning bell, then the exchange.

### 2.4 Rule modules and the Intro gallery

**Signature: `hourly_demonstration`** `{ period: M (about 12 turns), bell_lead: 2 turns }`. Essential line: "On the bell, the stations exchange signals down the length of the gallery." Every Semaphore Station performs its printed demonstration, a `line` down the axis, on the bell.

**Secondary: `weather_cases`** `{ share: S (about 20% of cases), weathers: [fog, rain] }`. Announced on the section panel "Weather Kept for Trials". Fog makes a `dust_cloud` that blocks sight, which breaks a Heliograph's axis; rain makes a soaked zone that stops `clockwork` for 2 turns (V §3.1 interaction 2), which stops a Semaphore Station's demonstration. Table B's constraint "artillery species present (they break jars)" holds: a Signal Lamp's shot that crosses a jar breaks it.

**How the Intro teaches it** (`period` S for the Intro only, so the first exchange comes quickly):

```
##############
#E....|......#     s  Semaphore Station on its short rail (>), dormant until the bell
#.....+...>s.X     +  the only door between the two rooms, on the axis row
#..b..|...t..#     t  Logbook Trolley (orientation fodder)
##############     b  bench, with the station's timetable card on the wall beside it
```

- On the bell the station's `line` runs west along the door row, through the door and into the first room. The bell sounds 2 turns before each exchange. The exit is reached round the station, not through it.
- V3: the aware Cautious novice waits beside the door for the exchange, then crosses (≥ 95%). The blind novice walks through on the bell in ≥ 30% of seeds and takes the line.
- The lesson the Intro also allows: the Trolley follows you into the door at the wrong moment and takes the line instead.

### 2.5 Species

| No. | Name | Archetype + modifiers | Role | Tag, silhouette | Wake |
|---|---|---|---|---|---|
| M.11.1 | Heliograph, Landing Pattern | `axis_sniper` + `glass` | artillery | ranged, tall | `prox(8)` on its axis |
| M.11.2 | Semaphore Station, Two-Armed | `demonstrator` + `clockwork` | controller | conditional, tall | `period(p)` (the bell) |
| M.11.3 | Signal Lamp on a Walking Tripod | `kiter` + `old_repair` (right rear) | artillery | ranged, figure | `prox(6)`, `noise(2)` |
| M.11.4 | Reflecting Dish, on a Cart | `reflector` | controller | controller, tall | `prox(3)` |
| M.11.5 | Logbook Trolley, Self-Propelled | `plodder` | fodder | pursuer, figure | `prox(3)`, `noise(2)` |

Artillery budget (V §8.1: ≥ 35% on artillery and ranged controllers) is met by M.11.1, .3 and .4. Heliograph and Semaphore Station share the `tall` silhouette and differ by tag; Signal Lamp and Logbook Trolley share `figure` and differ by tag. Counters: Heliograph {los, timing}, Station {timing, avoid}, Lamp {los, ranged: Hand Lamp, choke}, Dish {melee, aoe}, Trolley {melee, choke}.

---

**Heliograph, Landing Pattern**
Workshops of the Line · After the Second Calibration · Silvered glass; iron tripod; canvas hood · H. 168 cm · Transferred from the Line Superintendent's Office · M.11.1

> A heliograph speaks along a straight line and only along it. This one stood at the landing where the long gallery turns, and could talk to the station ahead or the station behind but never round the corner, which the logbooks complain about at length. Its operators wore smoked spectacles and stood well to one side. Keepers report that it still takes a moment to gather the light before it sends.

*Hidden. Essential ref `axis_sniper`: charges 1 turn (the line is shown), then fires a beam along its row or column to range 10; beams pass through glass. Tombstone cue `glass`: body does not block sight; reflects beams; blunt ×1.5; shards on death.*

---

**Semaphore Station, Two-Armed**
Workshops of the Line · After the Second Calibration · Painted oak arms; brass, steel; escapement; timetable card in a frame · H. 240 cm · Transferred from the Line Superintendent's Office · M.11.2

> The station's timetable is pinned to its own frame, in a clerk's hand, and it is still followed: the arms are raised on the bell and swept down the line, and at no other time. Between bells the station travels its short rail at the side of the gallery and waits. The logbooks record eleven injuries to linesmen who knew the timetable perfectly well and stood in the line anyway.

*Hidden. Essential ref `demonstrator` under `hourly_demonstration`: runs a fixed track; on each bell performs a `line` down the axis; never chases. Tombstone cue `clockwork`: ticks (noise 1), shows its next move as an arrow, immune to dazed, stopped for 2 turns by water.*

---

**Signal Lamp on a Walking Tripod**
Workshops of the Line · After the Second Calibration · Iron, oil reservoir, shutter of tinplate; right rear leg a later repair in pine · H. 152 cm · Transferred from the Line Superintendent's Office · M.11.3

> Where a heliograph could not reach, a lamp was walked out to a better position. The Line's records say this one was built to keep a fixed distance from whatever it was signalling to, backing away if anyone came too close, so that its beam would never need re-aiming. The habit has outlived the station it served, which was dismantled after the Second Calibration. The linesmen called it the Courtier, and did not explain why.

*Hidden. Essential ref `kiter`: holds 3–5 tiles away and shoots; retreats when you are adjacent. Tombstone cue `old_repair` (right rear): that side takes ×2 damage.*

---

**Reflecting Dish, on a Cart**
Workshops of the Line · After the Second Calibration · Polished tinplate, oak cart, iron wheels · Diam. 110 cm · Transferred from the Line Superintendent's Office · M.11.4

> Dishes like this were wheeled into the line to turn a signal down a side gallery. The Line was proud of them. A dish returned a lamp's beam along exactly the path it came, so a careless operator could find their own signal coming straight back at them, and several did. Keepers report that throwing things at it is a mistake visitors make only once, and that it is happiest with a station standing behind it.

*Hidden. Essential ref `reflector`: moves 1; sends bolts and beams back along their line; shields allies behind it; weak in melee.*

---

**Logbook Trolley, Self-Propelled**
Workshops of the Line · After the Second Calibration · Oak, iron; logbooks 14–22 · H. 96 cm · Gift of the Retired Line Superintendent · M.11.5

> The trolley carried the day's logbooks from station to station so that every operator could sign them. Keepers report that it follows the nearest person at a steady walking pace, which on a busy day was the right speed and on a quiet night is not. Logbooks 14 to 22 are still aboard. They record nine years of signals, each with its time of sending and time of arrival, and not one message. Please do not sign them.

*Hidden. Essential ref `plodder`: moves 1, melee, follows. Orientation pool (Intro).*

### 2.6 Items

| No. | Name | Category | Primitives | Points | Slot |
|---|---|---|---|---|---|
| M.11.6 | Hand Lamp With a Signalling Shutter | instrument | `bolt(light, M)` | 2 | ordinary; the required `artillery` counter (V §8.2) |
| M.11.7 | Linesman's Smoked Apron | garment | `armour(S)`, `resist(light, S)` | 1 + 1 = 2 | ordinary |
| M.11.8 | Spare Lamp Hood, Station Pattern | instrument | `extinguish(M)` | 2 | ordinary |
| M.11.9 | Signal Flag on Its Staff, Furled | weapon | `strike_kind(blunt, M)`, `reach` | 2 + 2 = 4 | Highlight, Logbook Room |
| M.11.10 | The Line Superintendent's Pocket Heliograph | instrument | `bolt(light, L)`, `flash(S)` | 3 + 1 = 4 | keepable Signature piece |

Consumable weights: `flash_bulb` ×1.5, `floor_plan` ×1.5 (the staff corridor is worth finding). Three neutral skins: "Enamel Tin, Hinged Lid", "Wax-Sealed Envelope", "Brass Token, Stamped 14". (Item media are not modifier cues, so brass is allowed here.)

**Hand Lamp With a Signalling Shutter**
Workshops of the Line · After the Second Calibration · Tinplate, oil, blackened shutter · H. 28 cm · Transferred from the Line Superintendent's Office · M.11.6
> Issued to every operator for signalling at short range. Snapped open, the shutter throws a hard bolt of light at whatever it is pointed at. The Line allowed two signals per filling and recorded the rest as waste.

*Hidden. Instrument: `bolt(light, M)`, 2 charges, range 5. A Reflecting Dish sends it back (§2.11).*

**Linesman's Smoked Apron**
Line stores · After the Second Calibration · Smoked leather, iron buckles · L. 104 cm · Gift of the Retired Line Superintendent · M.11.7
> Worn by anyone working in front of a heliograph. The leather was smoked dark so that it would not shine, and it takes the worst of a beam's heat. The rules required it to be buckled, and the rules were ignored.

*Hidden. Garment: `armour(S)`, `resist(light, S)` (light damage ×0.75).*

**Spare Lamp Hood, Station Pattern**
Line stores · After the Second Calibration · Blackened tinplate, felt lining · H. 31 cm · Gift of the Retired Line Superintendent · M.11.8
> Dropped over a station lamp, the hood put out its light, and the light of everything near it, for long enough to change a wick. Linesmen were fined for using one to cross the line unseen. The fines are recorded. The crossings are not.

*Hidden. Instrument: `extinguish(M)`, 2 charges: lux −2 in radius 2 for 10 turns; puts out burning. On a dark tile a hunter notices you only from 1 tile (V §1.4), so a hooded doorway can be crossed under a Heliograph's axis.*

**Signal Flag on Its Staff, Furled** (Highlight)
Line stores · After the Second Calibration · Wool bunting, ash staff, iron ferrule · L. 2.6 m · Transferred from the Line Superintendent's Office · M.11.9
> Flags were used where lamps could not be lit and heliographs could not be carried. Furled, the staff is long enough to reach past the person in front of you, which, the logbooks suggest, is how it was mostly used on busy days. The bunting has faded from red to a colour the Line called signal pink.

*Hidden. Weapon: `strike_kind(blunt, M)`, `reach` (attacks 2 tiles in a straight line). Lets a melee build hit a Signal Lamp that has just stepped back.*

**The Line Superintendent's Pocket Heliograph** (keepable Signature piece)
Made for the First Line Superintendent · Before the Second Calibration · Silvered glass, nickel case; lid engraved with the timetable · Diam. 7 cm · Gift of the Retired Line Superintendent · M.11.10
> The Superintendent carried this on the walk down the line, flashing each station in turn and noting the reply. It is small enough to hide in a hand and bright enough, at close quarters, to make an operator drop whatever they were holding. The timetable on the lid is the original. It has never been correct.

*Hidden. Instrument: `bolt(light, L)` (3 charges, range 5), `flash(S)` (dazed and blinded in radius 1; noise 2). Dropped by the Masterpiece on defeat.*

### 2.7 NPC

One **Docent** (CS §11), "The Line's Last Timekeeper". Gallery talk: stay within 2 tiles for 5 turns; identifies one consumable kind and reveals the wake triggers of every exhibit in the room.

| Type | Bark |
|---|---|
| Essential | "When the warning bell goes, get out of the doorway." |
| Fact-giving | "Rain stops the stations. The trial jars hold rain." |
| Flair | "Nine years of signals. Nobody wrote down a single one." |

### 2.8 Masterpiece: The Great Board of the Central Station (Fight)

**Assembly.** Core `mp_tableau` (framed, 2×2; telegraphed area patterns; summons from its frame; ×2 damage taken while summoning). Attachments: `demonstrator` ("The Board's Repeater Arm", with `clockwork`) and `reflector` ("The Board Dish"). Specials `line`, `burst`, `summon` (1–2 Logbook Trolleys). The hall runs `hourly_demonstration` at its strongest (period S, about 8 turns) and holds 2 rain jars, the secondary at its strongest.

| Phase | Trigger | What changes |
|---|---|---|
| 1 | Hunting, 100–67% | `line` along its row or column and `burst` (3×3) alternate. The Repeater Arm performs its `line` on every bell. |
| 2 | 67% | `summon` begins (2-turn telegraph; the Board takes ×2 damage while summoning: the punish window). The Board Dish wakes and stands in front of the Board, returning bolts. |
| 3 | 34% | Cadence every 2nd action (D M1). Each Heliograph left awake in the galleries is mounted on a side door and fires once per bell (D M3, cap 2). |

**The gallery-shaped answer.** A rain jar broken next to the Repeater Arm stops it for 2 turns; a jar pushed (V §7.2: `weather_jar` is pushable) from the galleries into the hall adds a third. Neither is required.

**Certificate by View.** The lectern is off-axis, behind a column, 4 tiles from the Board.

**Gateway label** (92 words)

**The Great Board of the Central Station**
Painted by the Workshops of the Line, with later panels · Before the Second Calibration; repainted until the line closed · Oil on boards, forty hinged panels; iron frame · H. 3.2 m, W. 3.6 m · Transferred from the Central Station · M.11.11
> Every signal on the line arrived here and was posted on the Board by hand, so that the Central Station could see the state of the whole building at a glance. The Board shows times of sending and times of arrival, and nothing else. The clerks who kept it were trained to step out of its row whenever a panel changed. In the line's last years the Board is said to have posted signals before they were sent. The Superintendent's pocket heliograph, lost on the last day, was found behind panel twenty-six.

*Hidden. Essential ref `mp_tableau` + `line`: step off its row and column when it changes. Fact-giving: the pocket heliograph is the Signature piece.*

### 2.9 Biography: the Line (Caves of Qud style)

1. Before the Second Calibration, the First Line Superintendent walked the length of the building, found that it took most of a day, and proposed the line.
2. The Workshops of the Line built a station at every landing and a heliograph wherever the galleries ran straight, and the logbooks were opened.
3. Because the building turned, the Line ordered reflecting dishes, and the logbooks record the first signal to come back to the station that sent it.
4. In the ninth year the Line stopped writing down messages, on the grounds that nobody read them, and kept only the times.
5. The Great Board of the Central Station was enlarged to forty panels so that it could show every station at once, and the clerks complained that it changed faster than they could read.
6. On the last day of the line, the Superintendent lost the pocket heliograph during the final exchange; it was found behind panel twenty-six when the Board was taken down.
7. The Retired Line Superintendent gave the logbooks, the trolley and the spare hoods to the Museum, on condition that the line be kept to its timetable, which it is.

### 2.10 Expected fingerprint

| Persona | Prediction | Why |
|---|---|---|
| `cautious` | dominant | Moves door to door behind columns and crosses the axis between bells (V §8.2: Cautious dominates artillery). |
| `sneak` | close second | The staff corridor bypasses most of the axis; the Spare Lamp Hood darkens crossings. |
| `completist` | middle | Visits the Logbook Room and the jars, which means more crossings. |
| `looter` | middle | Cases along the axis are reachable only by standing in the line. |
| `vandal` | low | A ranged Vandal is punished by the Dish; a melee Vandal walks the axis to reach artillery (D §5.1: Vandal submissive in artillery). |
| `tourist` | lowest | The shortest route is the axis itself (V §8.2: Tourist suffers on axes). |

Damage mix (predicted): ranged and beams 45%, demonstrations 20% (counted as terrain), melee 25%, status 10%. V2 for the signature: the demonstration-blind persona takes ≥ 3× damage from demonstrations. V2 for the secondary: jar-users beat non-users by ≥ 10% HP.

### 2.11 Edge cases

- **Two Heliographs on one axis.** A beam reflects off a `glass`-modified body (V §3.1, interaction 5), so a Heliograph between you and another Heliograph can return the second one's beam. S3 must check this is rare, because it reads as a bug the first time.
- **Your bolt and the Dish.** A `bolt(light)` fired at the Reflecting Dish comes back along its line. The label says so; the round-trip check must find it.
- **Demonstrations hit exhibits.** A Trolley or Signal Lamp standing in a Station's line on the bell takes the hit, which is V's intended "lure enemies into the sweep".
- **Fog duration.** V §6.2 gives weather 10 turns; V §7.3 gives `dust_cloud` 3 turns. I read fog-from-a-jar as 10 turns, because it is the module's weather and not a plaster death. The vocabulary owner should make this explicit.

---

## 3. S.9 Animals Not Yet Seen by the Day Staff

### 3.1 Card

| Field | Value |
|---|---|
| Accession | `S.9` |
| Title | Animals Not Yet Seen by the Day Staff |
| Family, ordinal | Specimens III (signature plus secondary; Treasure Masterpiece) |
| Category | `natural_history` |
| Conceit | Every specimen here was catalogued from the night staff's round books; the day curators, who have never seen any of the animals do anything, accessioned the descriptions in good faith and label every behaviour "reported, not observed". |
| House rule | "Please keep the exhibits in view." |
| Challenge claim | primary `guarded`, secondary `darkness` |
| Signature wake trigger | `alarm`: when a wader calls, the whole court wakes |
| Domains → ids | **night rounds** → `unobserved_motion`, `alarm_network`, `patrol_guard`, Overshoes · **round books** → `completing_guardian`, Round Book 9 (`perception`), `herald` · **nests** → `tethered_warden`, `mimic_vitrine` |
| Voice rule | Every didactic opens with a status phrase: "Reported, not observed", "Reported, once", "Reported in pieces". It is the department's admission of uncertainty (LM §3.3 rule 3) and costs two words. |
| Sensitivity review | Invented animals only; no human remains (LM §4.2); no real species names. The "compiler citing sources" voice comes from LM F4 without naming any of Borges's creatures. |

### 3.2 Panels

**Intro panel** (167 words)

> Every animal in this court was described by the night staff, on their rounds, in pencil. The descriptions are in the round books on the lecterns, and the Museum has accessioned them in good faith. The books are left open on the lecterns, and visitors are welcome to read them. The day staff have never seen any of these animals do anything. They have found them in different places in the morning, which is not the same thing, and every label in this department therefore says reported, not observed. According to the round books, the animals move only when nobody is looking at them, and a keeper who keeps a light on them has nothing to fear. Please keep the exhibits in view. The preparators mounted each animal from its description, and where a description was unclear, they chose the reading that would stand up. We have tried to describe the animals as the night staff did, and not as we would have preferred them to be.

**Section panel: The Waders' Round** (102 words)

> This court is alarmed, in its own way. The lantern-crop waders walk the same round as the night staff, in the same direction, and stop at the same lecterns. A wader that finds something on its round that was not there on the last one calls, and every keeper on the floor comes, and so does everything else in the court. The round books describe the call as unmistakable. The night staff kept to the shadows between the plinths when they wanted a quiet round, and they wore felt over their shoes. The overshoes are in the case by the north lectern.

**Section panel: The Brooders' Bay** (96 words)

> The bay was built for a display of nests and now holds one. The round books describe a dozen ground-nesting animals in this part of the court; the preparators could account for only one of them, and it has been sitting on the same nest since the Great Reshelving. The nest is made from a round book. The night staff would like it back, but they have agreed with the day staff that it is now part of the specimen. The case on the east wall holds tools from the preparators' workshop, lent for the duration.

### 3.3 Programme, layout, palette, audio

**Programme: `sculpture_court`** (ML P9): Poisson-disc plinths at spacing ≥ 3, a central pool placed as a Brogue lake, the staff layer behind the north wall.
- **Why.** `unobserved_motion` is ++ in `sculpture_court` (V §6.4). The plinths are the court's sight-blockers (V §7.2 `column` and occupied `plinth`), so every pillar loop is also a place where a Grazer drops out of view. That is the tension the department exists for.
- **The cap.** `alarm_network` is "−" in `sculpture_court` (≤ 2 guards, Table B). The 2 guards are the Waders, as exhibits. The CS staff Guard count for a Guarded primary (3, CS §3.7) would exceed the cap; I propose staff guards count toward it here, leaving 1 neutral staff Guard (§3.7 below, and Challenges item 4).
- **Patrols.** Two Wader routes on the court's integration core (ML §3.4 population rules), each with a ≥ 3-turn window at every required crossing (Table B).

| Gallery | Role | Contents |
|---|---|---|
| The Lamp Corridor | Intro | 1 Grazer on a plinth between entrance and exit; a floor lamp; 2 Hoppers (orientation pool) |
| The Mount Court, south | Section 1 | plinth field; 1 Grazer; Wader route A; Dawn-Caller on the far side; Overshoes in a case |
| The Mount Court, north | Section 1 | plinth field around the pool; Wader route B; 1 Cabinet-Backed Tortoise among 3 real cabinets |
| The Brooders' Bay | Section 2 | the Brooder and its nest (Round Book 9 inside); preparators' tools (Tongs, Pin-Driver) |
| The Round-Book Room | study room | lecterns with Round Books 1–8 (one gallery's worth of Composite parts each); bench; object zero |
| The Day Curator's Case | Masterpiece hall | Security case with the Lamp; the Composite over it; 2 flagged Grazers flanking the case; lectern |
| The Night Staff's Tea Room | Coda | gift kiosk; exits |

**Palette:** material `taxidermy_fawn` (warm browns); accent `moss_olive`; wall `court_plaster_grey`; floor `terrazzo_night`. The Waders' crops use the luminous ramp, so their light is the brightest thing in the room and the eye follows them.

**Audio:** mode phrygian; family reed (low, breathy); tempo slow. Motif: the Waders' round as a walking bass, `g3 . . bb3 | a3 . . _ | g3 . f3 . | g3 . . _`, one note per Wader step. The Dawn-Caller's call is a fixed stinger. Nothing in the score marks the Grazers: their silence matches their stillness (V §2.2: `unobserved_mover` has no idle animation).

### 3.4 Rule modules and the Intro gallery

**Signature: `unobserved_motion`** `{ scope: flagged species [S.9.1], step: M (2) }`. Essential line: "The animals move only when nobody is looking at them." Observation is V §1.4's single definition: in your field of view, within your sight radius, and on a tile at dim or brighter or inside your lantern radius.

**Secondary: `alarm_network`** `{ guards: S (2, the Waders), zones: sections, alarm_turns: M (about 30), clock_advance: S (30 turns) }`. Announced on "The Waders' Round" panel.

**How the Intro teaches it.** V Table A's teaching instance, reskinned: "The Lamp Corridor", a corridor gallery with one Grazer on a turned plinth halfway along, a floor lamp beside the plinth, and the exit beyond. Panel on the wall: "Please keep the exhibits in view." Two Hoppers wait near the exit to tempt the player into turning round.
- V3: the aware Cautious novice passes the Grazer and backs towards the exit facing it (≥ 95%). The gaze-blind novice turns to fight the Hoppers and is struck from behind in ≥ 30% of seeds.
- Putting out the floor lamp makes the Grazer's tile dark, so it counts as unobserved without your lantern. The Intro therefore also teaches the department's darkness secondary without saying so.

### 3.5 Species

| No. | Name | Archetype + modifiers | Role | Tag, silhouette | Wake |
|---|---|---|---|---|---|
| S.9.1 | Long-Necked Grazer | `unobserved_mover` + `textile` | ambusher | conditional, figure | `unseen` gate; `prox(8)` |
| S.9.2 | Lantern-Crop Wader | `patrol_guard` + `luminous` | warden | warden, figure | `awake` (patrol), `alarm` |
| S.9.3 | Dawn-Caller on a Perch | `herald` | support | support, tall | `prox(5)` |
| S.9.4 | Ground-Nesting Brooder, With Its Nest | `tethered_warden` | warden | warden, beast (alt) | `tether(2)` |
| S.9.5 | Cabinet-Backed Tortoise | `mimic_vitrine` | ambusher | hidden, case | `touch_case` |
| S.9.6 | Long-Footed Hopper (four examples) | `darter` | skirmisher | pursuer, beast | `prox(4)` |

Guarded budget (V §8.1: ≥ 30% on wardens and heralds; ≥ 2 patrol routes) is met by the Waders, the Brooder and the Dawn-Caller. The Waders and the Brooder share the warden tag and differ in silhouette (figure, beast); the Brooder and the Hoppers share `beast` and differ by tag. Counters: Grazer {light_ctl: lantern; timing}, Wader {stealth: Overshoes; los: plinths; timing}, Dawn-Caller {los; burst}, Brooder {ranged: Pin-Driver; displace: Tongs}, Tortoise {examine; ranged}, Hopper {melee; choke}.

---

**Long-Necked Grazer**
Mounted by the preparators from Round Book 3 · Collected after the Great Reshelving · Hide over a carved lime form; textile; shown at 50 lux · H. 2.4 m · Accessioned on the night staff's report · S.9.1

> Reported, not observed. Round Book 3 places the grazer at the north end of the court at the start of one round and at the south end at the start of the next, and never anywhere in between. The keeper who made the entry added that they once kept their lamp on it for a whole round, and that it did not move at all. The day staff measured the floor for marks. There were none.

*Hidden. Essential ref `unobserved_mover`: moves 2 per turn, but only on turns it is not observed; strikes hard when adjacent; frozen while observed. Flagged for `unobserved_motion`. Tombstone cue `textile`: moves silently; faded on bright tiles; fire ×1.5.*

---

**Lantern-Crop Wader**
Mounted from the first entry in Round Book 1 · Collected after the Great Reshelving · Feathers, hide, wire; crop lined with luminous paint by the preparators · H. 1.1 m · Accessioned on the night staff's report · S.9.2

> Reported, not observed. The wader keeps the same round as the night staff, in the same direction, pausing at the same lecterns, and the night staff describe it as the only colleague who has never been late. Its crop gives enough light to read by. When it meets something on its round that was not there the last time, the round books say, it stands quite still for a moment and then calls.

*Hidden. Essential ref `patrol_guard`: walks a patrol route with a 90° lamp cone; on sighting you it raises the alarm (1 turn), then pursues; returns to its route after 20 turns. Tombstone cue `luminous`: emits light (radius 2, +1 lux); draws light swarms; reveals not_on_view nearby. One of `alarm_network`'s 2 guards.*

---

**Dawn-Caller on a Perch**
Mounted from Round Book 5 · Collected after the Great Reshelving · Feathers, wire; perch of varnished applewood · H. 64 cm · Accessioned on the night staff's report · S.9.3

> Reported, once. Round Book 5 records that the caller called a single time, at the sight of a new keeper on a first round, and that when the keeper looked round every animal in the court was standing up. The entry lists them all by name. The day staff consider it the best-documented night in the department, because it was countersigned by four keepers, all of whom were, by then, awake.

*Hidden. Essential ref `herald`: on sighting you it calls for 1 telegraphed turn, then wakes every dormant exhibit within 6 tiles.*

---

**Ground-Nesting Brooder, With Its Nest**
Mounted from Round Book 7 · Collected after the Great Reshelving · Hide, feathers, wire; nest of round-book pages · L. 1.3 m · Accessioned on the night staff's report · S.9.4

> Reported, not observed. The brooder built its nest from the pages of Round Book 9, which a keeper had left on a bench, and the Museum has displayed the two together ever since. The night staff describe it as the easiest animal in the court to work beside: it has never been more than two paces from the nest, and they simply sweep around it. They do not recommend reaching into the nest.

*Hidden. Essential ref `tethered_warden`: never leaves a radius-2 tether around its nest; hits hard; heals and resets when you leave. The nest holds the Highlight, Round Book 9 (S.9.10).*

---

**Cabinet-Backed Tortoise**
Entered twice in Round Book 2, once as furniture · Collected after the Great Reshelving · Domed carapace with a hinged lid; horn, hide · L. 1.4 m · Accessioned on the night staff's report · S.9.5

> Reported, and then reported again. Round Book 2 lists this as a specimen cabinet in the morning and as a tortoise at night, in the same hand, with the note "same object, please advise". The day staff advised that it was a cabinet. The keeper who opened it to check was held by the wrist for some minutes and released, eventually, without the specimen inside.

*Hidden. Essential ref `mimic_vitrine`: looks like a loot case; when touched it grabs (rooted 2 turns and a hit), then fights as a slow brute. Tell before reveal: its case label has no catalogue number (P §6.3); glass glint "breathes" every ~4 s. This didactic is shown only once it is revealed and catalogued.*

---

**Long-Footed Hopper (four examples)**
Mounted from Round Book 4 · Collected after the Great Reshelving · Hide, wire; hind feet of carved boxwood · H. 30 cm each · Accessioned on the night staff's report · S.9.6

> Reported, not observed. Round Book 4 calls the hoppers the court's nuisance. They come in close, nip, and are back out of reach before a keeper can turn round, and then they do it again from the other side. The night staff kept them out of the waders' way by keeping them busy. The preparators mounted four, which they believe is all of them, and wrote that down as well.

*Hidden. Essential ref `darter`: moves 2; hits, then steps back 1. Orientation pool (Intro).*

### 3.6 Items

| No. | Name | Category | Primitives (+ drawback) | Points | Slot |
|---|---|---|---|---|---|
| S.9.7 | Overshoes of the Night Staff | garment | `muffled(M)` | 2 | ordinary; the required `guarded` counter (V §8.2) |
| S.9.8 | Taxidermist's Long Tongs | weapon | `strike_kind(edge, S)`, `knockback(S)` | 1 + 1 = 2 | ordinary |
| S.9.9 | Spring Pin-Driver | instrument | `bolt(edge, M)` | 2 | ordinary |
| S.9.10 | Round Book 9 | curio | `perception(L)` | 3 | Highlight, inside the Brooder's tether |
| S.9.11 | The Day Curator's Lamp | curio, toggled | `light_control(L)`, `perception(M)`; drawback `luminous_self` | 3 + 2 − 1 = 4 | Treasure and keepable Signature piece |

Consumable weights: `dust_sheet` ×2 (it lulls a non-hunting Grazer), `flash_bulb` ×1.5 (the `darkness` counter, V §8.2). Three neutral skins: "Specimen Jar, Stoppered", "Card of Pins", "Folded Label, Unused".

**Overshoes of the Night Staff**
Night staff stores · After the Great Reshelving · Felt over leather · L. 31 cm · Gift of the Night Staff · S.9.7
> Worn over ordinary shoes on the rounds, so that the keepers could hear the court and the court could not hear the keepers. The day staff tried them once and complained that they could not hear themselves walk.

*Hidden. Garment: `muffled(M)`: your noise −1 at all times.*

**Taxidermist's Long Tongs**
Preparators' workshop · After the Great Reshelving · Steel, cork-lined jaws · L. 72 cm · Gift of the Preparators · S.9.8
> Used to set a mount's eyes and teeth from arm's length. Pushed, the tongs move a small animal back a pace without marking it, which was the point. Pulled, they are sharper than they look.

*Hidden. Weapon: `strike_kind(edge, S)` (light, fast), `knockback(S)` (push 1). Satisfies the Brooder's `displace` counter.*

**Spring Pin-Driver**
Preparators' workshop · After the Great Reshelving · Steel spring, walnut stock, box of long pins · L. 34 cm · Gift of the Preparators · S.9.9
> Built to drive mounting pins into a hard plinth from a safe distance, when the specimen on the plinth was not cooperating. It holds two pins at a time. The preparators' notes call it a last resort, twice.

*Hidden. Instrument: `bolt(edge, M)`, 2 charges, range 5. Lets you hit the Brooder from outside its tether.*

**Round Book 9** (Highlight)
The night staff, in several hands · From the Great Reshelving until the brooder took it · Pencil on ruled paper; pages 40–112 in the nest (see S.9.4) · H. 21 cm · Gift of the Night Staff · S.9.10
> The last round book before the nest. Every animal in the court is entered, with what it does and what wakes it, in the plain language of people who had to walk past them every night. Carried open, it shows the court as the night staff saw it.

*Hidden. Curio: `perception(L)`: hinged panels and mimic tells within 2 tiles; not_on_view within 3; the tag of every dormant exhibit in view.*

### 3.7 NPC

One **Guard** (CS §11, staff, neutral, cannot be harmed), "The Relief Night Keeper". Bump to ask "Which way is out?" or to retire (CS §12).

| Type | Bark |
|---|---|
| Essential | "If a wader calls, every keeper on this floor comes." |
| Fact-giving | "Keep your light on the grazer. That's all it takes." |
| Flair | "Thirty years of rounds. Never once seen one move." |

### 3.8 Masterpiece: The Day Curator's Lamp (Treasure)

**Form.** Treasure (D §6.4, the lean R7(b) for Guarded): the Masterpiece is an object in a Security case; taking it out of the hall and reaching the exit lobby before Custody earns the Signature piece; reading its gateway label at the lectern earns the Certificate.

**Assembly.** The Sentinel is a V §2.4 core, so the "Masterpiece tests the primary" rule still holds:
- **Core:** `completing_guardian`, "The Composite, Assembled From the Round Books" (S.9.12). Stage 0–4 = galleries explored ÷ 2. Each stage adds a limb, and each limb is a special: stage 1 the neck (`sweep`), stage 2 the legs (`charge`), stage 3 the tail (`ring`), stage 4 the Dawn-Caller attachment perched on its back.
- **Attachment:** `herald` (the Dawn-Caller, stage 4 or second alarm, whichever comes first).
- **Signature module at its strongest:** the hall holds 2 more Grazers, flagged, flanking the case. Walking out with the Lamp means keeping both in view while the Composite comes for you.
- **Secondary at its strongest:** the hall is its own alarm zone, and any alarm raised in it is a department alarm at once.

| Phase | Trigger | What changes |
|---|---|---|
| 0 | dormant | View is possible from the lectern. The Composite stands over the case at its current stage. |
| 1 | the Security case is touched | Room alarm. The Composite wakes, Hunting, at stage *s*. The two hall Grazers become active movers. |
| 2 | 6 turns after phase 1, or the Composite at 67% HP | Department alarm: CS §3.8 security lighting (all public rooms bright for 40 turns), which makes the Grazers easy to keep in view and you easy to find. Waders converge. Each alarm already raised in the galleries adds one attachment (V §2.4; cap 2): first the Dawn-Caller, then a second Brooder tethered to the hall's exit opening. |
| 3 | 12 turns after phase 1, or 34% HP | The hall seals (CS §5.4). The Composite gains one stage (cap 4). |

**What leaving does.** `completing_guardian` heals and drops a stage when you leave its room (V §2.1), so it does not follow you out. Outside, the threat becomes the alarm: Waders, the staff Guard and Custody pips (CS §3.7). A Sneak who comes early meets a stage-1 Composite and leaves quietly; a Completist who explored every gallery meets a stage-4 Composite with the Round Book in hand and the Pin-Driver loaded. That is the A Bao A Qu trade the vocabulary built in (LM F4, V §2.1).

**Gateway label** (97 words)

**The Day Curator's Lamp**
Bought by the day curator for one night's visit to the court · After the Great Reshelving · Nickel-plated reservoir, chimney, hooded reflector · H. 38 cm · Gift of the Day Curator · S.9.11
> The day curator visited the court once, at night, to confirm the round books, and brought this lamp. The visit is entered in Round Book 8 in the curator's own hand: "Nothing moved while I watched." The next morning the lamp was found lit inside this case, which had been locked, and the curator declined to discuss it. The lamp throws a wider light than any other in the building, wide enough to keep a court in view, and it cannot be turned down below a glow. The Composite has stood over the case since that morning.

*Hidden. Essential ref (item): `light_control(L)` and drawback `luminous_self`. Fact-giving: the Composite is the Sentinel. Treasure: carrying the lit Lamp out makes both hall Grazers easier to keep in view, and makes you visible.*

**The Composite's own label** (species didactic, 72 words)

**The Composite, Assembled From the Round Books**
Mounted by the preparators from every description in Round Books 1–8 that matched no other specimen · After the Great Reshelving · Hide, feathers, horn, wire, carved lime; parts added as descriptions were found · H. 2.9 m · Accessioned on the night staff's report · S.9.12
> Reported in pieces. The preparators built it from the descriptions no other mount accounted for: a neck from Round Book 2, legs from Round Book 6, a tail from a note in a margin. They added each part as its description turned up in the galleries, and they do not believe it is finished. The night staff say it is more complete on nights when more of the court has been walked.

*Hidden. Essential ref `completing_guardian`: its stage is galleries explored ÷ 2; each stage adds a limb (a special); leaving its room heals it and drops one stage.*

**The Lamp's item line** (for the Catalogue and the Registrar's slip): curio, toggled: `light_control(L)` (hooded setting plus +1 lantern radius), `perception(M)` (hinged panels and mimic tells within 2; not_on_view within 3); drawback `luminous_self` (your tile is never dark). 4 points. It helps against every `unobserved_mover` in the game and hurts every stealth plan, which is the right kind of keepable: a sidegrade with a personality.

### 3.9 Biography: the round books (Caves of Qud style)

1. In the year of the Great Reshelving, the night staff began keeping round books, because the day staff kept asking what happened at night.
2. The first entry in Round Book 1 describes a wading animal with a light in its throat that kept the same round as the keepers; the preparators mounted it from the description, and it has kept the round since.
3. A new keeper on a first round was greeted by the Dawn-Caller, and Round Book 5 records the only night on which every animal in the court was seen standing.
4. The brooder took Round Book 9 for its nest, and the night staff agreed to begin Round Book 10 rather than argue.
5. The preparators assembled the Composite from every description that matched no other animal, and added a part each time another round book turned up.
6. The day curator came to the court one night with a new lamp, to confirm the round books, and wrote in Round Book 8, "Nothing moved while I watched."
7. In the morning the Day Curator's Lamp was found lit and locked inside the Security case, with the Composite standing over it, and the curator declined to discuss it.
8. The day staff have since labelled every exhibit in the department "reported, not observed", and the night staff have since stopped correcting them.

### 3.10 Expected fingerprint

| Persona | Prediction | Why |
|---|---|---|
| `sneak` | dominant | V §8.2 and D §5.1 both predict it for `guarded`; detections should predict damage. But the Sneak takes a disproportionate share of its damage from Grazers, because sneaking in the dark means not observing them (V §2.2: `unobserved_mover` punishes Snk). That internal tension is the department's identity, and S3 should show it as a damage-source split, not as a lower rank. |
| `cautious` | second | Keeps the lantern up and walks backwards past Grazers; gets seen by Waders more often than the Sneak. |
| `completist` | middle | Explores everything, so meets a stage-4 Composite, but with Round Book 9 and the Pin-Driver. |
| `tourist` | low | Turns its back on Grazers; walks Wader routes. |
| `looter` | low | The Tortoise, the Brooder's nest and the Security case all punish taking. |
| `vandal` | lowest | Raises alarms; the Dawn-Caller wakes the court around it. |

Measured signatures I expect: alarms per play (median Sneak about 0.5, median Vandal about 3), ≥ 30% of wakes caused by alarms (D §5.1), and the V2 check for the signature: the gaze-blind persona takes ≥ 2× damage from flagged species.

### 3.11 Edge cases

- **The Waders' light is not observation.** Only your observation counts (V §1.4). But a Wader's luminous radius makes nearby tiles lit, so you can observe a Grazer from further away while a Wader passes. Following a Wader at a distance is a legitimate, risky tactic.
- **Posing on an empty plinth** (CS §3.9) hides you from Waders, not from Grazers, which are not looking for you.
- **Lights Down and the Night Watch** shrink observation (ambient −1 and −2 bands), so Grazers get more turns. The clock makes this department harder in its last third than most.
- **A broken case.** The Tortoise among real cabinets: breaking the wrong cabinet's glass makes noise 3 and can start a Wader's investigation. Examining first is the fair route (its missing number).
- **Concept the vocabulary could not express.** The S1 frame wanted "a keeper's lamp counts as observation", so that Waders would freeze Grazers as they passed. V has no NPC observation. It went to the unmatched-concept queue (§8.2) rather than being faked.

---

## 4. A.4 Things Kept in Duplicate, Before the Repeal

### 4.1 Card

| Field | Value |
|---|---|
| Accession | `A.4` |
| Title | Things Kept in Duplicate, Before the Repeal |
| Family, ordinal | Copies I (one module, mild settings) |
| Category | `era` |
| Conceit | For the length of the Duplicate Ordinance, every object the Museum made or acquired had to be issued with a certified spare in case the original was lost; this department holds what that period left behind: originals, spares, spares of spares, and the forms. |
| The era | "The Duplicate Years": from the Ordinance, passed after the Night of the Unlocked Door, to its Repeal after the Second Inventory. An invented period anchored to institutional events (LM §3.3 rule 8). |
| House rule | "Every object shall be issued with a spare." |
| Challenge claim | primary `swarm`, secondary `locks_puzzle` |
| Signature wake trigger | `ally_hit`: when one member of a copy group is struck, the others wake |
| Domains → ids | **duplicates** → `copies_weaken`, `splitter`, `mp_ensemble` · **paperwork** → `mote_swarm` + `paper`, `diorama_spawner`, `conservator_healer` · **repeal** → `breaker` (the Repealing Pen), the Masterpiece's `shatter_all` |
| Sensitivity review | None: an institutional era. Avoids real bureaucracies, real stamps and real dates. |

### 4.2 Panels

**Intro panel** (169 words)

> Almost everything in these cases is here twice, and some things are here four times. For the length of the Duplicate Ordinance, every object the Museum made or acquired had to be issued with a certified spare, so that nothing could ever be lost for good. Spares were made in plaster, on carbon paper, in whatever was to hand, and the forms were made in triplicate. The Office that issued them occupied this floor, and its counter is the first thing you will meet. The Ordinance was repealed after the Second Inventory, when the spares were found to outnumber the galleries. Each original carries a plain number. Each spare carries the same number with a stroke and a letter. The spares were made to stand in for their originals, and they depend on them: when an original is broken, its spares lose heart. The Museum regrets that some spares are better made than their originals, and that it has not been possible to tell them apart by quality alone.

**Section panel: Originals Under Glass** (100 words)

> Under the Ordinance the original was kept behind glass and the spare was put out for use, so that the original would never be handled. This gallery keeps that arrangement. The cases at the ends of each row hold the originals; the figures in the aisles are their spares, still at work. Breaking a case is loud, and the Office's rules described it as a last resort. The rules also described the spares as interchangeable, which the spares appear to have taken personally. The figure with the pen arm, near the north case, countersigns repairs. It was never itself countersigned.

**Section panel: The Copying Room** (101 words)

> Every form issued under the Ordinance was typed with a carbon underneath, and the carbons were kept. They are in the bundles on these shelves, many thousands of them, very thin and very dry. Please do not bring a naked flame into this room. The duplicator in the corner turned one master sheet into as many copies as the Office required, and on busy days nobody switched it off. Its lid is the only control. The violet stain on the floor around it has been tested by the conservators, who report that it is ink, and that it is still spreading.

### 4.3 Programme, layout, palette, audio

**Programme: `case_labyrinth`** (ML P5): a glass maze in which you see everything and reach little.
- **Why.** `copies_weaken` is ++ in `case_labyrinth` (V §6.4); swarm's producer list names it ("chokes help you", V §8.1). Each bay holds one type (ML P5), so a copy group sits in its own bay with its original in the bay's end case, visible from the aisle and reachable only by breaking glass or walking round.
- **The decision the programme makes recurring:** break the glass (noise 3, wakes the bay) to reach the original first, or fight the spares at full strength in the aisle. ML P5: "breaking glass is the recurring decision."
- **Chokepoints.** ≥ 2 per section (V §8.2 swarm requirement); case aisles are 1–2 tiles wide.

| Gallery | Role | Contents |
|---|---|---|
| The Office Counter | Intro | the Seated Clerk's original in a vitrine on the visitors' side; 2 spares behind the counter (sketch below) |
| Originals Under Glass | Section 1 | 3 bays; copy group 1 (Seated Clerks: original + 3 spares); copy group 2 (Proposing Trustee: original + 2 spares); the Countersigning Clerk |
| The Copying Room | Section 2 | shelving bays of Carbon Flimsies (2 bundles); the Spirit Duplicator in the corner; the Date Stamp in a case |
| The Registry | study room | the Registrar's desk (NPC); bench; Register of Spares (Highlight); object zero, and a spare of it (see §4.11) |
| The Lectern Hall | Masterpiece hall | five lecterns in a shallow arc; a duplicator slot in the back wall; 4 vitrines along the sides |
| The Forms Counter | Coda | gift kiosk; exits |

**Palette:** material `plaster_cast` (warm off-whites); accent `duplicator_mauve` (a desaturated violet, kept clear of the reserved controller violet); wall `bureau_sage`; floor `linoleum_ochre`.

**Audio:** mode ionian; family keys (dry, celesta-like); tempo moderate. Motif in canon: `c5 e5 g5 e5 | d5 . c5 _`, with a second voice playing the same two bars one bar later and a semitone flat, as its spare. Breaking an original in a room silences the canon voice there until you leave. The player hears the module working.

### 4.4 Rule module and the Intro gallery

**Signature: `copies_weaken`** `{ groups: M (two groups of 3–4 in the galleries, plus the Masterpiece), generations: 2 (splits of a spare count as spares), on_original_death: weaken (−1 tier, slowed) }`. Essential line: "When an original is broken, its spares lose heart." No secondary: the `locks_puzzle` secondary comes from the module itself (V Table B: `copies_weaken` produces swarm and locks_puzzle).

**How the Intro teaches it.** V Table A's teaching instance ("one original bust and two plaster copies, numbered 14.2, 14.2/a, 14.2/b"), reskinned and renumbered:

```
##############
#E....v=.....#    v  vitrine: the original Seated Clerk, A.4.1, on the visitors' side
#.b....=..s..#    =  the Office counter (low_furniture; climbing it takes 2 turns)
#......+..s..X    +  the gap in the counter
#......=.....#    s  spares A.4.1/a and /b, dormant, on the staff side
##############    b  bench beside the intro panel
```

- The aware Cautious novice breaks the vitrine, kills the original (slow, `marble`), and meets two weakened, slowed spares at the gap.
- The blind novice goes straight for the gap and fights both spares at full tier. Check (D §3.6): reach the exit with ≥ 70% HP. Target: aware passes ≥ 95%, blind fails ≥ 30%. With D's orientation cap of 2 per pack, the balancer may need the Intro's spares one tier up to hit that margin. If even that fails, the fallback is a third spare, which breaks D's pack cap for orientation encounters. I flag the conflict rather than hide it: V3's margin and D's orientation rules can pull against each other in any module whose lesson is "numbers".

### 4.5 Species

| No. | Name | Archetype + modifiers | Role | Tag, silhouette | Wake |
|---|---|---|---|---|---|
| A.4.1 | Seated Clerk of the Ordinance Office (original) | `plodder` + `marble`, in a vitrine | fodder | pursuer, figure | `prox(3)`, `noise(2)`, `ally_hit` |
| A.4.1/a–c | Seated Clerk, Certified Spare | `plodder` + `plaster` | fodder | pursuer, figure | `prox(3)`, `noise(2)`, `ally_hit` |
| A.4.2 | Carbon Flimsies, in Bundles | `mote_swarm` + `paper`; count L | swarm | pursuer, cluster | `noise(2)`, `prox(4)` |
| A.4.3 | Spirit Duplicator, Cabinet Model | `diorama_spawner` (L+) | support | support, case | `noise(3)`, `touch_case` |
| A.4.4 | Bust of the Proposing Trustee (original) | `splitter` + `marble`, in a vitrine | brute | pursuer, mass | `prox(3)`, `ally_hit` |
| A.4.4/a–b | Bust of the Proposing Trustee, Certified Spare | `splitter` + `plaster` | brute | pursuer, mass | `prox(3)`, `ally_hit` |
| A.4.5 | Countersigning Clerk, Automaton | `conservator_healer` + `clockwork` | support | support, figure | `ally_hit` |

Five archetypes, four modifiers. Swarm budget (≥ 40% on swarm and fodder, encounters of 6+ bodies, V §8.1) is met by the Flimsies, the Duplicator's output and the Seated Clerk group. Countersigning Clerk and Seated Clerk share `figure` and differ by tag. Counters: Clerks {melee; choke}, Flimsies {aoe: Date Stamp; choke}, Duplicator {timing: close the lid; burst: Paperweight}, Trustee spares {burst; aoe}, Countersigning Clerk {burst; ranged: Stamp Moistener}.

**Fallback if `diorama_spawner` slips from launch** (it is L+): A.4.3 becomes a `herald` ("Copying-Room Bell") and the Flimsies are placed, not spawned. The department loses its best set piece but still compiles.

---

**Seated Clerk of the Ordinance Office**
Workshop of the Office's own carver · During the Duplicate Ordinance · Marble; pen hand replaced · H. 118 cm · Transferred from the Ordinance Office · A.4.1

> The Ordinance Office commissioned a figure of a clerk at work to sit at its counter, and was then obliged by its own rule to commission a spare. It commissioned three. The original sat behind glass and the spares sat at the counter, where they turned out to be better at the work. Keepers note that the spares have kept their posture only while the original keeps its own. The one time it was knocked over, all three slumped.

*Hidden. Essential ref `copies_weaken`: while the original stands, its spares fight at full tier; when it falls, they drop 1 tier and are slowed. Archetype `plodder`: moves 1, melee. Tombstone cue `marble`: edge ×0.5; one speed class slower; immune to cut and burning.*

**Seated Clerk, Certified Spare** (study-collection label, runtime grammar)
After A.4.1 · During the Duplicate Ordinance · Plaster cast after the marble; base stamped CERTIFIED TRUE COPY · H. 118 cm · Transferred from the Ordinance Office · A.4.1/a
> Spare (a) of three. For the original, see the case at the end of this row.

*Hidden. `plodder` + `plaster` (tombstone cue "plaster cast after …"): HP ×0.7; crumbles into a dust cloud (radius 1, 3 turns) on death. Minor labels make no mechanical claim of their own (P §6.2); the pointer to the original is a placement fact.*

---

**Carbon Flimsies, in Bundles**
The Ordinance Office typing pool · During the Duplicate Ordinance · Paper (onionskin) and carbon, tied with pink tape · Each sheet 33 × 21 cm · Transferred from the Ordinance Office · A.4.2

> Every form issued under the Ordinance had a spare typed underneath it on carbon paper, and the spares were kept, which is why there are so many. Released from their bundles, the registry staff report, they drift in a body towards anything that moves and settle on it. The staff describe clearing them out of corners with a broom, a dozen at a stroke, because there was no other way to deal with that many.

*Hidden. Essential ref `mote_swarm`: 7–8 bodies, each dies to one hit; they move 1–2 and surround. Tombstone cue `paper`: fire ×2 and ignites; burning spreads to adjacent paper and textile; +1 stealth in dim.*

---

**Spirit Duplicator, Cabinet Model**
Supplied to the Ordinance Office · During the Duplicate Ordinance · Cast iron cabinet with a hinged lid; drum of felt; violet ink · H. 140 cm · Transferred from the Ordinance Office · A.4.3

> The duplicator turned one master sheet into as many copies as the Ordinance required, and on busy days it was never switched off. Once it is turning, it puts out a fresh bundle every few moments until someone closes the lid, and the registry staff learned to close the lid first and ask questions afterwards. The violet ink has stained the floor around it in a ring about a pace wide.

*Hidden. Essential ref `diorama_spawner`: once awake, releases 1 Flimsies body every 3 turns, up to 4; closing its lid (2 turns adjacent) or breaking its frame stops it.*

---

**Bust of the Proposing Trustee, Certified Spare**
After A.4.4 · During the Duplicate Ordinance · Plaster cast after the marble; stamped CERTIFIED TRUE COPY · H. 64 cm · Transferred from the Ordinance Office · A.4.4/a

> The Trustee who proposed the Ordinance sat for one bust and was issued with two spares, as the rule required. The spares were handled and damaged often, and under the Ordinance a damaged spare had to be replaced at once with two, one of them a spare for the replacement. The night staff report that the spares now attend to this themselves. Keepers break them with one blow, or not at all.

*Hidden. Essential ref `splitter`: a hit that does not kill splits it into 2 at half HP (at most 2 splits). Tombstone cue `plaster`: HP ×0.7; dust cloud on death. Splits are generation-2 spares: when the original A.4.4 falls, they weaken too.*

**Bust of the Proposing Trustee** (the original; short label)
Workshop of the Office's own carver · During the Duplicate Ordinance · Marble · H. 64 cm · Transferred from the Ordinance Office · A.4.4
> The original, kept under glass so that it would never be handled. The Trustee's family asked for a spare for themselves and were refused, on the grounds that the spares were the Museum's.

*Hidden. `splitter` + `marble`, in a vitrine. A short label carries no Essential line; the group's Essential lives on the spare's label above.*

---

**Countersigning Clerk, Automaton**
Made for the Ordinance Office by the Workshops of the Line · During the Duplicate Ordinance · Brass, steel; escapement; pen arm and inkwell · H. 132 cm · Transferred from the Ordinance Office · A.4.5

> No spare was valid until it had been countersigned, so the Office had a clerk built to do it, and the human clerks went home. The Office's records say it countersigns anything damaged within its reach, taking a moment over each signature, and the Office then considers the damage not to have occurred. It does not like to be approached while it is signing. It has never been countersigned itself.

*Hidden. Essential ref `conservator_healer`: stays behind allies; channels 1 turn to restore an ally (M) or to reseal a broken case; flees when approached. Tombstone cue `clockwork`: ticks (noise 1), shows its next move, immune to dazed, stopped 2 turns by water.*

(The maker credit is deliberate: the Workshops of the Line are M.11's makers. Shared makers across departments are how the invented institution accumulates a history without a plot.)

### 4.6 Items

| No. | Name | Category | Primitives | Points | Slot |
|---|---|---|---|---|---|
| A.4.6 | Long-Handled Date Stamp | weapon | `strike_kind(blunt, S)`, `sweep` | 1 + 2 = 3 | ordinary; the required `swarm` area item (V §8.2) |
| A.4.7 | Paperweight of the Ordinance Office, One of a Pair | weapon | `strike_kind(blunt, L)` | 3 | ordinary (heavy: +1 Handling Clearance) |
| A.4.8 | Clerk's Sleeve Protectors | garment | `armour(S)`, `resist(fire, S)` | 1 + 1 = 2 | ordinary |
| A.4.9 | Stamp Moistener, Spring Pattern | instrument | `bolt(water, S)` | 1 | ordinary |
| A.4.10 | Register of Certified Spares, Volume II | curio | `attribution(M)` (L+), `perception(S)` | 2 + 1 = 3 | Highlight, the Registry |
| A.4.11 | The Repealing Pen | weapon | `strike_kind(edge, S)`, `breaker` (L+), `surprise_bonus(S)` | 1 + 2 + 1 = 4 | keepable Signature piece |

Consumable weights: `spirit_lamp` ×0.5 (a paper department; fire is the intended emergent risk, V §10.6, and should be possible but not common), `catalogue_card` ×1.5. Three neutral skins: "Rubber Stamp, Unlabelled", "Carbon Envelope, Sealed", "Ink Bottle, Violet Glass".

**Long-Handled Date Stamp**
Ordinance Office registry · During the Duplicate Ordinance · Iron, rubber die, ash handle · L. 118 cm · Transferred from the Ordinance Office · A.4.6
> Made for stamping RECEIVED on forms laid out in rows on the floor, three at a stroke. The die reads RECEIVED on one face and RECEIVED AGAIN on the other.

*Hidden. Weapon: `strike_kind(blunt, S)` (light, fast), `sweep` (the 3 front-arc tiles at −1 damage class).*

**Paperweight of the Ordinance Office, One of a Pair**
Ordinance Office · During the Duplicate Ordinance · Cast iron · H. 11 cm; heavier than it looks · Transferred from the Ordinance Office · A.4.7
> Issued in pairs under the Ordinance, so that a desk would never be without one. The other is lost, which the Office regarded as proof that the rule worked. It is best used once, firmly.

*Hidden. Weapon: `strike_kind(blunt, L)` (heavy: slower attack, +1 Handling Clearance). The `burst` counter for the Trustee spares.*

**Clerk's Sleeve Protectors**
Office stores · During the Duplicate Ordinance · Oilcloth, elastic · L. 30 cm · Transferred from the Ordinance Office · A.4.8
> Worn by the typing pool against ink and carbon, and by the registry against the duplicator. The oilcloth does not burn easily, which the Office noted was the point of choosing it.

*Hidden. Garment: `armour(S)`, `resist(fire, S)` (fire damage ×0.75).*

**Stamp Moistener, Spring Pattern**
Office stores · During the Duplicate Ordinance · Tinplate, sponge, spring · L. 14 cm · Transferred from the Ordinance Office · A.4.9
> For wetting stamps without licking them. It throws a short jet of water further than it should, and the registry used it to settle disputes with the countersigning machine.

*Hidden. Instrument: `bolt(water, S)`, 1 charge, range 5. Water stops `clockwork` for 2 turns (V §3.1), so it interrupts the Countersigning Clerk's channel; it also puts out burning. Satisfies the Clerk's `ranged` counter.*

**Register of Certified Spares, Volume II** (Highlight)
Ordinance Office registry · During the Duplicate Ordinance · Paper, bound in green cloth; Volume I missing, its spare also missing · H. 34 cm · Transferred from the Ordinance Office · A.4.10
> Every original issued under the Ordinance, with every spare made of it, the date, the material, and the clerk responsible. Read carefully, it tells a forgery from a spare at a glance, which the Office considered two different things.

*Hidden. Curio: `attribution(M)` (L+; use-identification 50% faster), `perception(S)` (hinged panels and mimic tells within 2). Fallback without L+: `perception(M)`.*

**The Repealing Pen** (keepable Signature piece)
Borrowed from the Ordinance Office counter · Used once, at the Repeal, after the Second Inventory · Steel nib, ebonised holder · L. 17 cm · Transferred from the Ordinance Office · A.4.11
> The Trustees signed the Repeal with a pen borrowed from the Office's own counter, and returned it with a note forbidding any copy to be made. It is sharp, light and quick, and it goes through glass, plaster and paper with very little fuss. The Office made a spare anyway. The spare is missing.

*Hidden. Weapon: `strike_kind(edge, S)` (light, fast), `breaker` (L+: breaks cases and crates in one hit at −1 noise; ×1.5 against glass, porcelain and plaster), `surprise_bonus(S)`. Module link: it opens an original's vitrine in one quieter blow. Fallback without L+: `strike_kind(edge, S)`, `surprise_bonus(L)`. Dropped by the Masterpiece on defeat.*

### 4.7 NPC

One **Registrar** (CS §11; "a registry desk in about 1 department in 3"), at the Registry desk. Catalogues one item free; identifies a kind for coins.

| Type | Bark |
|---|---|
| Essential | "Break the original first. The spares lose heart." |
| Fact-giving | "Plain number, original. Number with a stroke, spare." |
| Flair | "The Repeal was signed once. The forms kept coming for years." |

### 4.8 Masterpiece: The Duplicate Ordinance, With Its Four Certified Copies (Fight)

**Assembly.** Core `mp_ensemble`: five framed sheets on five lecterns, one HP pool; the original (A.4.12) and four certified copies (A.4.12/a–d). When a piece falls, the rest gain its special. Attachment `conservator_healer` ("The Senior Countersigning Clerk", `clockwork`). Specials: the original carries `summon` (1–2 Flimsies bodies from the duplicator slot in the back wall); copies /a and /b carry `burst`; copies /c and /d carry no special until they inherit one. Phase 3 adds `shatter_all`. That is three specials, within V §2.4's two or three.

**The original rule.** V §2.1 says "kill order: the original first" but not what that buys. I read it through the signature module at its strongest: while the original stands, a falling copy passes its special to every survivor; once the original has fallen, the survivors are −1 tier and slowed and inherit nothing more. The enemies drafter owns the final rule (§8.2).

| Phase | Trigger | What changes |
|---|---|---|
| 1 | Hunting, 100–67% | `burst` from /a and /b on cadence; the original `summon`s every 3rd action. |
| 2 | 67% | The Senior Countersigning Clerk wakes behind the lecterns and channels restores into the shared pool. A Stamp Moistener jet interrupts it. |
| 3 | 34% | `shatter_all` (2-turn telegraph): the 4 side vitrines break, releasing their Seated Clerk spares and leaving shards. Cadence every 2nd action. |

**Gallery hooks (D M3).** Each original you broke in the galleries: −8% Masterpiece HP (cap −24%), because the originals are labelled "Companion piece to A.4.12". Each spare left awake joins phase 3 (cap 2).

**The tell.** The original's frame carries A.4.12 with no stroke, and its sheet is the only one without the CERTIFIED TRUE COPY stamp. Both are readable on the tombstone line from 2 tiles (CS §13.2), so the locks part of the fight is a reading test that bots pass through `examine`.

**Gateway label** (89 words)

**The Duplicate Ordinance, With Its Four Certified Copies**
Drafted by the Ordinance Office; copies by the typing pool · Signed after the Night of the Unlocked Door; repealed after the Second Inventory · Ink on paper, five sheets, each framed on its own lectern · Each sheet 42 × 30 cm · Transferred from the Ordinance Office · A.4.12, A.4.12/a–d
> The Ordinance required that it be issued with spares like everything else, so there are five of it. Only one was signed by the Trustees; the other four were certified as true by the Office, which is not the same thing. They have always been displayed together, and they act together: when one is taken down, the others take on its duties. The Office's own note, pinned to the first lectern, advises dealing with the signed original first. The Repeal was signed with the pen in that lectern's drawer.

*Hidden. Essential ref `mp_ensemble`: when a piece falls, the rest gain its special; the original first. Fact-giving: the Repealing Pen is the Signature piece.*

### 4.9 Biography: the Ordinance Office (Caves of Qud style)

1. On the Night of the Unlocked Door, three objects left the building and were never found, and the Trustees passed the Duplicate Ordinance the following week.
2. The Ordinance Office was established to issue spares, and began by issuing spares of its own staff rota, its furniture and its first annual report.
3. The Office commissioned a seated clerk for its counter and, obliged by its own rule, three spares; the spares were moved to the counter and the original to a case.
4. In the fourth year the typing pool asked for a duplicator, and the Spirit Duplicator was delivered with a spare, which was never unpacked.
5. The Ordinance itself was issued with four certified copies, and the Office pinned to the first lectern a note on which one to deal with first.
6. At the Second Inventory the spares were found to outnumber the galleries, and the Trustees repealed the Ordinance with a pen borrowed from the Office's counter.
7. The Repealing Pen was returned to the drawer of the first lectern with a note forbidding any copy to be made. A spare was made anyway, and is missing.

### 4.10 Expected fingerprint

| Persona | Prediction | Why |
|---|---|---|
| `vandal` (with an area weapon) | dominant | Holds aisle chokepoints with the Date Stamp (V §8.2 and D §5.1 agree for swarm). |
| `cautious` | second | Uses the 1-tile aisles; breaks originals from a safe bay. |
| `looter` | higher than its usual rank | Breaks cases anyway, and the cases at the row ends hold originals, so the Looter weakens groups by accident. This is a prediction worth checking, because it would mean the module rewards a persona V §8.2 did not list. |
| `tourist` | middle | Copy groups are avoidable along the outer aisle; the Flimsies are not. |
| `sneak` | middle-low | Flimsies wake on noise 2, and breaking glass is noise 3. |
| `completist` | lowest | Lingers among the bays while the Duplicator keeps working. |

Damage mix (predicted): swarm and fodder ≥ 45% (D §5.1 threshold), brute 25%, terrain (shards, dust, fire) 15%, Masterpiece specials 15%. V2: the nearest-first persona takes ≥ 25% more damage in copy groups than the original-first persona (Table B).

### 4.11 Edge cases

- **The Countersigning Clerk reseals a broken original's case.** An exhibit whose case was broken cannot return to dormancy (V §1.2); a resealed case gives it back a home. If the original was released but not killed, it can be put back to sleep. This is the one support behaviour that undoes your progress on the module, which is why the Clerk is the department's priority target.
- **Fire.** The Copying Room is shelves of paper. A `spirit_lamp` or a burning Flimsy spreads 1 tile per turn through paper bundles (V §3.1). S3 must show fire is a risk the player chooses, not one that happens to them; V §10.6 flags the same risk for "Works on Paper".
- **Object zero has a spare here.** The brass key `A.4.0` (M §6.4) is displayed with a plaster spare, `A.4.0/a`. Only the original counts as a reading. The spare's label reads "Spare. Do not count." This is the one department where object zero's constant description is tested by a near-copy, and the M validator must accept a `/a` beside it.

---

## 5. K.6 Objects Lent by Visitors Without Meaning To

### 5.1 Card

| Field | Value |
|---|---|
| Accession | `K.6` |
| Title | Objects Lent by Visitors Without Meaning To |
| Family, ordinal | Classification III (signature plus secondary; Treasure Masterpiece) |
| Category | `concept_institution` |
| Conceit | The Museum has never accepted that anything left in its galleries is lost: it registers each object as an unintended loan, files it by the reason the finder wrote on the slip, and keeps it, with great patience, until the lender returns. |
| House rules | "Objects are filed by the reason given." (signature) · "Claims are processed on an exchange basis." (secondary) |
| Challenge claim | primary `locks_puzzle`, secondary `guarded` |
| Signature wake trigger | `take`: lifting an item anywhere in a room wakes what is filed there |
| Domains → ids | **reasons** → `sorting_vault`, `path_follower`, Reading Glass · **exchange** → `heist_plinths` (substitution on), the Counter Bell (`recase`) · **unclaimed things** → `mimic_vitrine`, `mote_swarm` + `textile`, `tethered_warden` |
| Sensitivity review | The joke is the institution's refusal to say "lost" (LM F3). Visitors appear only as absent lenders, never as figures of fun. Taxonomy classes are reasons, never peoples (V Table B rule for `taxonomy_aggro`, applied here too). |
| Interface note | This is not M §10.2's Lost Property window, and the intro panel says so. The department and the meta feature share a fiction and must not share a mechanic. |

### 5.2 Panels

**Intro panel** (163 words)

> Every object in this department was left in the Museum by someone who did not mean to leave it. The Museum does not use the word lost. It prefers to say that the object is waiting. Each object is registered as an unintended loan, with the date it was found and the reason the finder wrote on the slip, and it is kept until its lender comes back for it. The shelves are arranged by those reasons, which are the only thing the finders' slips have in common. Over the years some objects have been filed under the wrong reason. The Unclaimed Room, at the end of the east range, opens only when every object on the shelves is back under the right one, and the slips will tell you which. This department is not the Lost Property window, which is in the Stair Hall. Please do not ask for your umbrella here. The staff cannot help, and they find the question difficult.

**Section panel: The Counter** (99 words)

> All claims are made at the Counter, in the centre of the department, and they are processed on an exchange basis: one object handed in for each object taken away. The rule is older than the Counter. It was introduced after a visitor claimed an umbrella that was not theirs, and the Office could not account for the gap on the shelf. The plinths along the Counter are weighed. An object lifted from one with nothing left in its place brings the shutters down on the range. The staff ask that visitors bring something of about the same size.

**Section panel: The Four Reasons** (101 words)

> The four ranges hold the four reasons that finders give most often: Put Down for a Moment, Left in a Hurry, Left on Purpose, and Returned, Then Left Again. The fourth is the Office's own addition. Finders' slips are pinned to every object and are worth reading, because the reason is often in the details rather than the object: a cold cup, a tied lace, a second slip in a different hand. The suitcase on the west range has never been given a reason. Nor has it been given a number, and the staff would prefer that visitors left it alone.

### 5.3 Programme, layout, palette, audio

**Programme: `rotunda`** (ML P2), k = 4 radials, ambulatory on.
- **Why.** `sorting_vault` is ++ in `rotunda` (V §6.4), and `locks_puzzle` names "rotunda (locked radials)" as its programme (V §8.1). The four radials are the four reasons; the hub is the Counter; the Unclaimed Room hangs off the east radial.
- **The ambulatory is required, not optional.** It joins the radials' far ends, so the exit lobby is reachable without crossing the hub (D §6.2 layout guarantee) and the puzzle never sits on the critical path (V Table B).
- The hub has the highest integration (ML F1), so the Treasure sits where every route can see it.

| Gallery | Role | Contents |
|---|---|---|
| The Slip Desk | Intro | a 2×2 sort: two shelves, four objects, two misfiled; a small cabinet that opens when both are filed; 2 Parcels |
| Put Down for a Moment (north range) | Section 1 | shelving; 4 vault objects; Gloves drawer; Overcoat's bench |
| Left in a Hurry (south range) | Section 1 | 4 vault objects; Gloves drawer; Rain Hood in a case |
| Left on Purpose (west range) | Section 2 | 4 vault objects; the Suitcase among real luggage; Walking Stick |
| Returned, Then Left Again (east range) | Section 2 | 4 vault objects; the Hat Stand at the Unclaimed Room door |
| The Unclaimed Room | vault | the Dog Whistle (Highlight) and the department's second Restoration kit |
| The Counter | Masterpiece hall (hub) | Security case on a weighed plinth with the Counter Bell; umbrella rack with the Five Umbrellas; lectern |
| The Exchange Desk | Coda (on the ambulatory) | gift kiosk; a "Hand Bell, Unclaimed" study object in an open case; exits |

**Palette:** material `cloakroom_oak`; accent `ticket_buff` (a pale card colour, kept clear of the reserved gold); wall `counter_green` (desaturated); floor `parquet_herringbone`.

**Audio:** mode lydian; family bell (small, dry hand bells); tempo moderate. Motif: call and no response. `g5 . . _ | _ _ _ _ | b5 . g5 _ | _ _ _ _`: a phrase, then a bar of rest where an answer should be. Filing an object correctly plays one answering note; completing the sort plays the answer in full. Substituting at the Counter plays it once.

### 5.4 Rule modules and the Intro gallery

**Signature: `sorting_vault`** `{ groups: 4 × 4, red_herrings: 1, misfiled_at_start: 6 of 16, wrong_placement_noise: 2 }`. Essential line: "The Unclaimed Room opens only when every object is back under the right reason." It is never on the critical path: failing it costs the Unclaimed Room, never the exit (V §6.2 notes). Moving a vault object is not a `take` (vault objects are display objects, not items).

**Secondary: `heist_plinths`** `{ wake: section, lockdown: M (in V's 0–6 range; reference 4 turns), substitution: on }`. Announced on "The Counter" panel. Table B's constraint "a substitute object within 6 tiles when substitution is on" is met by the "Hand Bell, Unclaimed" in the coda case, 6 tiles from the Counter along the ambulatory opening.

**The sort** (S2 writes the objects and slips; a solver certifies a unique solution; Julian reviews the categories, V §6.2):

| Reason | Objects (the clue on each slip is the Fact-giving line) |
|---|---|
| Put Down for a Moment | Cup and saucer, the tea in it cold · Spectacles, folded, on an open catalogue · Book, face down, open at page 112 · Shopping bag, its handles still upright |
| Left in a Hurry | Shoe, the right, laces still tied · Hat, its brim crushed by a revolving door · Ticket, torn in half, the other half missing · Coat button, the thread still attached |
| Left on Purpose | Letter addressed to the Museum, unopened · Drawing of Gallery 4, signed and dated · Flower pressed inside a gallery plan · Coin on a plinth, face up |
| Returned, Then Left Again | Theatre glasses, two slips from the same evening · Child's mitten, handed in twice · Programme with two claim stamps · **Scarf on a bench, with two slips** (the red herring: the bench says "put down"; the second slip decides) |

Six objects start misfiled. The solver's rule is that a second slip overrides every other clue. A `catalogue_card` used on any object reveals its reason (V Table A counterplay).

**How the Intro teaches it.** V Table A: "a 2×2 sort with obvious categories". The Slip Desk has two shelves, Left in a Hurry and Left on Purpose, with a tied shoe on the second and a signed drawing on the first. Filing both opens a small cabinet (one `tonic`, one `catalogue_card`). The exit is never behind it. V3 for semantic modules uses the oracle reader (V §6.3): the novice oracle (50%) with one wrong placement gets the noise-2 lesson, which wakes the two Parcels, so the Intro also teaches the cost of a wrong guess.

### 5.5 Species

| No. | Name | Archetype + modifiers | Role | Tag, silhouette | Wake |
|---|---|---|---|---|---|
| K.6.1 | Single Gloves, Filed Together | `mote_swarm` + `textile`; count M | swarm | pursuer, cluster | `noise(2)`, `prox(4)`, `take` |
| K.6.2 | Hat Stand of the Cloakroom, Retired | `tethered_warden` | warden | warden, figure | `tether(2)` |
| K.6.3 | Suitcase, Labelled to Nowhere | `mimic_vitrine` | ambusher | hidden, case | `touch_case` |
| K.6.4 | Overcoat, Left on a Bench | `path_follower` + `textile` | ambusher | conditional, figure | `path` |
| K.6.5 | Parcel, Addressed to the Museum | `plodder` + `paper` | fodder | pursuer, figure | `prox(3)`, `noise(2)`, `take` |

Locks budget (≤ 50% of the normal combat budget, V §8.1) holds: one swarm, one warden, two ambushers, fodder. Three share `figure` and all differ by tag. Counters: Gloves {aoe; choke}, Hat Stand {ranged: Token Dispenser; displace: Walking Stick}, Suitcase {examine: Reading Glass; ranged}, Overcoat {timing; avoid}, Parcel {melee; choke}.

---

**Single Gloves, Filed Together**
Makers various · Handed in over many years · Wool, leather, kid; textile; shown at 50 lux · Each about 24 cm · Unintended loans, lenders unknown · K.6.1

> The Museum receives about one single glove a week and has never once received the other of a pair. The gloves are filed together in a drawer marked Hands, Left and Right, where the staff say they keep each other company. When the drawer is opened they leave it together and settle on the nearest warm hand. Staff report that each comes away easily, one at a time, and that the difficulty is the number of them.

*Hidden. Essential ref `mote_swarm`: 5–6 bodies, each dies to one hit; they move 1–2 and surround. Tombstone cue `textile`: moves silently; faded on bright tiles; fire ×1.5.*

---

**Hat Stand of the Cloakroom, Retired**
Cloakroom joinery · In use until the cloakroom was refitted · Bentwood, iron foot · H. 196 cm · Transferred from the Cloakroom · K.6.2

> The hat stand served the cloakroom for longer than anyone on the current staff, and when the cloakroom was refitted it was moved here, beside the door of the Unclaimed Room, where it seemed to want to be. Staff say it has never been more than two paces from that door. Those who need to pass it hand it their hat first and collect the hat on the way out. It has never lost one.

*Hidden. Essential ref `tethered_warden`: never leaves a radius-2 tether around the Unclaimed Room door; hits hard; heals and resets when you leave. Shoot it from outside the tether, or knock it aside and step through.*

---

**Suitcase, Labelled to Nowhere**
Maker's label removed · Arrived before the Second Inventory · Pigskin, nickel clasps; luggage label, blank · L. 66 cm · Registration not completed · K.6.3

> Every object in this department has a number on its tag, except this one. Its luggage label is blank, and it was found already standing on a shelf of the west range, in a gap that had not been there the day before. The registrar who tried to open it to complete the record was held by the handle for most of an afternoon. The record has not been completed.

*Hidden. Essential ref `mimic_vitrine`: looks like a loot case; touching it grabs you (rooted 2 turns and a hit), then it fights as a slow brute. Tell: no catalogue number (P §6.3). In this department the tell is also the joke, because everything else has one. Shown in full once revealed.*

---

**Overcoat, Left on a Bench**
Tailor's label illegible · Handed in after the Second Inventory · Wool, silk lining; textile; shown at 50 lux; an unredeemed cloakroom ticket in the pocket · L. 118 cm · Unintended loan, lender unknown · K.6.4

> The overcoat was found on a bench in the north range and filed under Put Down for a Moment, because it was still warm. Staff report that it now follows whoever last walked through the department, a few steps behind, along exactly the route they took, and stops wherever they stopped. It has never caught anyone up. The registrar advises visitors not to turn back the way they came.

*Hidden. Essential ref `path_follower`: retraces your exact path 2 turns behind and triggers whatever you triggered; harms only on contact, that is, if you backtrack into it. Tombstone cue `textile`.*

---

**Parcel, Addressed to the Museum**
Sender unknown · Handed in at the main door after the Second Inventory · Brown paper, string, postage stamps · 38 × 30 × 22 cm · Unintended loan; the Museum has not decided whether it is the addressee · K.6.5

> The parcel is addressed to the Museum in a careful hand, with no sender's name. The Museum has not opened it, because it has not yet been established that the Museum is the intended recipient. It was filed under Left on Purpose. It moves about the department at a steady walking pace, following whoever is nearest, which the staff take as a sign that it is waiting to be signed for.

*Hidden. Essential ref `plodder`: moves 1, melee, follows. Tombstone cue `paper`: fire ×2 and ignites. Orientation pool (Intro).*

### 5.6 Items

| No. | Name | Category | Primitives | Points | Slot |
|---|---|---|---|---|---|
| K.6.6 | Walking Stick, Silver-Topped, Unclaimed | weapon | `strike_kind(blunt, M)`, `knockback(S)` | 2 + 1 = 3 | ordinary |
| K.6.7 | Token Dispenser of the Cloakroom | instrument | `bolt(blunt, M)` | 2 | ordinary |
| K.6.8 | Rain Hood, Folded, Unclaimed | garment | `low_profile(M)` | 2 | ordinary; the `guarded` secondary's stealth item |
| K.6.9 | Reading Glass on a Ribbon, Unclaimed | curio | `perception(M)` | 2 | ordinary; mimic tells within 2 tiles |
| K.6.10 | Dog Whistle, Silver, Unclaimed | instrument | `animate_ally(L)` | 3 | Highlight, the Unclaimed Room |
| K.6.11 | The Counter Bell, First Pattern | instrument | `recase(M)` (L+), `lull(S)` | 2 + 1 = 3 | Treasure and keepable Signature piece |

Consumable weights: `floor_plan` ×2 (V §8.2 requires it in the pool for `locks_puzzle`), `catalogue_card` ×2 (it reveals a reason). Three neutral skins: "Paper Bag, Folded", "Cloakroom Ticket, Blank", "Tin of Mints, Unopened".

**Walking Stick, Silver-Topped, Unclaimed**
Maker unknown · Handed in after the First Calibration · Rattan cane, silver-plated knob · L. 91 cm · Unintended loan, lender unknown · K.6.6
> Filed under Put Down for a Moment, a reason the Office has started to doubt. It is heavy at the top and good for moving things out of the way.

*Hidden. Weapon: `strike_kind(blunt, M)`, `knockback(S)` (push 1). Satisfies the Hat Stand's `displace` counter.*

**Token Dispenser of the Cloakroom**
Cloakroom joinery · In use until the cloakroom was refitted · Tinplate, spring, a column of numbered tokens · H. 22 cm · Transferred from the Cloakroom · K.6.7
> It issued a numbered token with each coat, briskly, at the pull of a lever. The cloakroom staff learned to stand to one side of it. It still has two tokens loaded.

*Hidden. Instrument: `bolt(blunt, M)`, 2 charges, range 5. Hit the Hat Stand from outside its tether.*

**Rain Hood, Folded, Unclaimed**
Maker unknown · Handed in on a wet evening · Oiled silk, drawstring · Folded 12 × 8 cm · Unintended loan, lender unknown · K.6.8
> Filed under Left in a Hurry, because it was found still folded on a wet evening. Worn up, it shadows the face, and in a dim room it is hard to tell from anyone else's.

*Hidden. Garment: `low_profile(M)`: hunters notice you 2 tiles later on dim or dark tiles.*

**Reading Glass on a Ribbon, Unclaimed**
Maker unknown · Handed in after the Great Reshelving · Glass lens, horn rim, black ribbon · Diam. 6 cm · Unintended loan, lender unknown · K.6.9
> For reading finders' slips, which are written small. Held close to a tag, it shows quickly whether the tag has a number on it.

*Hidden. Curio: `perception(M)`: hinged panels and mimic tells within 2 tiles; not_on_view within 3.*

**Dog Whistle, Silver, Unclaimed** (Highlight)
Maker unknown · Handed in before the Counter was built · Silver, worn smooth · L. 6 cm · Unintended loan, lender unknown · K.6.10
> No dog has ever been recorded in the Museum. The whistle has been tested, on that basis, with care, and the staff report that whatever is filed nearest to it tends to come when it is blown, and to stay for a while.

*Hidden. Instrument: `animate_ally(L)`: wakes a dormant exhibit (any non-Masterpiece) as a toured ally for 40 turns.*

**The Counter Bell, First Pattern**: see §5.8. Its item line: instrument, `recase(M)` (puts an adjacent enemy at ≤ 40% HP into an empty case or plinth; it leaves the fight for good), `lull(S)` (one awake, non-hunting target back to dormant). 3 points. Fallback without L+: `lull(M)`, `displace(S)`.

### 5.7 NPC

One **Fellow visitor** (CS §11; V `rival_visitor`, neutral, L+), "A Visitor Looking for an Umbrella". Offers a trade, or gossip (which radial holds the Rain Hood). It never fights unless robbed.

| Type | Bark |
|---|---|
| Essential | "Leave something on the plinth when you take. They insist." |
| Fact-giving | "The real umbrella's tag still says Unclaimed. The others don't." |
| Flair | "Lost it here before the Second Inventory. They've kept it beautifully." |

### 5.8 Masterpiece: The Counter Bell, First Pattern (Treasure)

**Form.** Treasure (D §6.4, R7(b) lean for Locks). The Bell sits in a Security case on a weighed plinth on the Counter (hub). View earns the Certificate; taking it to the exit lobby before Custody earns the Signature piece.

**Assembly.**
- **Sentinels, core:** `mp_ensemble`, "Five Umbrellas, Each Claimed as the Same Umbrella" (K.6.12), in the rack behind the Counter: five linked umbrellas on one HP pool. One is the umbrella actually lost; the other four were each claimed by a different visitor and returned. The true one's tag reads "Unclaimed"; the others read "Claimed, in error". That is V §8.2's locks Masterpiece test: an ensemble whose original must be identified first.
- **Attachment:** `tethered_warden`, "The Claims Clerk's Chair", tethered to the hub's west opening (the short way out).
- **Specials:** `cone` (an umbrella opening: 3-wide, range 4, damage M plus `dazed`), `charge` (closed, a line to 5); phase 3 adds `ring`.
- **Secondary at its strongest:** `heist_plinths` with lockdown L (in V's 0–6 range, reference 6) and scope: section (the hub and its four openings).
- **Signature at its strongest:** the umbrellas' tags are finders' slips, and picking the true one uses the sort's own rule (the latest slip decides). It is the sort's hardest question, asked under pressure. For a semantic module, "at its strongest" can only mean a harder reading, not a bigger number.

| Phase | Trigger | What changes |
|---|---|---|
| Clean path | An object of similar size placed on the plinth as the Bell is lifted | Nothing wakes. Walk out. The plinth now holds your substitute; its label reads "Handed in by Visitor n". This is the Sneak's and the reader's heist. |
| 1 | Lifted without a substitute, or the Security glass struck | Lockdown: the hub's four openings shutter for L turns. Room alarm. The Five Umbrellas wake. |
| 2 | 6 turns after phase 1, or 67% of the shared pool | Department alarm. The Claims Clerk's Chair activates on the west opening. When an umbrella falls, the rest gain its special. |
| 3 | 12 turns after phase 1, or 34% | The hall seals (CS §5.4). Survivors gain `ring`. Cadence every 2nd action. |

**The original rule here.** As in A.4: while the true umbrella stands, a falling claimed umbrella hands its special to the rest; once the true one has fallen, the rest are −1 tier and slowed and inherit nothing. Same reading of V's under-specified rule (§8.2), deliberately reused so that a player who learned it in Copies can use it here.

**What counts as "similar size".** Any carried curio or instrument; not weapons or garments. Loans from Your Collection are refused by the plinth ("The Counter does not accept objects already on loan"), because leaving a Loan in a department would collide with M §5.3's loss rules. The coda's Hand Bell is the free substitute for players who noticed it.

**Gateway label** (91 words)

**The Counter Bell, First Pattern**
Maker unknown · On the Counter since before the Counter was built · Nickel-plated bell, oak base, iron striker · H. 9 cm, Diam. 11 cm · Unintended loan, the oldest in the department · K.6.11
> The bell was the first object ever handed in, and the Counter was built around it so that there would be somewhere to ring it from. Nobody has claimed it. Claims at the Counter are processed on an exchange basis, and the bell is no exception: an object of about its size must be left in its place. The five umbrellas in the rack behind it have each been claimed, by five different visitors, as the same umbrella. Only one of them was ever lost, and its tag still says so.

*Hidden. Essential ref `heist_plinths` (substitution on): leave an object of similar size. Fact-giving: the ensemble's original is the umbrella whose tag says Unclaimed.*

### 5.9 Biography: the Office of Unintended Loans (Caves of Qud style)

1. Before the Counter existed, a visitor left a small bell on a bench in the entrance hall, and the first Registrar, unwilling to call it lost, registered it as an unintended loan.
2. The Counter was built around the bell so that the bell would have somewhere to be rung from, and the Office of Unintended Loans was established behind it.
3. After the Night of the Two Umbrellas, when a visitor claimed an umbrella that was not theirs and the Office could not account for the gap, the Office adopted the exchange rule.
4. Over the following years four more visitors claimed the same umbrella; the Office accepted each claim, and each claimed umbrella was eventually handed back in and returned to the rack.
5. When the cloakroom was refitted, its hat stand was retired to the door of the Unclaimed Room, and nothing has passed that door since without first handing over a hat.
6. At the Second Inventory the Office found an unopened parcel addressed to the Museum and a suitcase with a blank label; it registered the first and could not register the second.
7. The Office has never closed. It keeps the Counter Bell under glass, on a weighed plinth, in case the visitor who left it comes back.

### 5.10 Expected fingerprint

| Persona | Prediction | Why |
|---|---|---|
| `completist` | dominant | Reads slips, files the sort, finds the coda's Hand Bell, takes the clean path (V §8.2 and D §5.1 agree). Measured on its own utility (D §5.1). |
| `sneak` | second | The clean heist rewards it, if it notices the substitute. |
| `cautious` | middle | Solves part of the sort; avoids the Suitcase. |
| `vandal` | middle-low | Little to kill (the budget is ≤ 50%); lockdowns and the Hat Stand cost it. |
| `looter` | low | Lifts from weighed plinths, opens the Suitcase, wakes the Gloves drawers with `take`. V Table B's V2 for `heist_plinths`: the naive Looter takes ≥ 20% more damage than the substituting Looter. |
| `tourist` | utility-low | Leaves without the Unclaimed Room (V §8.2: "Tourist leaves without the vault"). Survives well. |

Measured signatures: turns high, damage low; ≥ 40% of Highlights and items behind puzzle gates (D §5.1); the no-reading limited agent fails the gated Highlight. The `sorting_vault` V2 uses the oracle: the expert oracle solves it, random placement fails ≥ 99%.

### 5.11 Edge cases

- **The Overcoat and the plinths.** `path_follower` triggers whatever you triggered. It does not lift objects, so it cannot set off a weighed plinth; but it does cross the rope lines you crossed. V's "use it to hold pressure plates" has no plates to hold here. That is fine; it is a reminder that each archetype's counterplay list is not a promise that every department exercises it.
- **Substituting a vault object.** Vault objects are not items and cannot be carried out of their range. They cannot be used as substitutes. This stops the sort and the heist from becoming one puzzle.
- **Fire.** Gloves (`textile`) and Parcels (`paper`) burn, and the ranges are shelving. A spirit lamp in a range starts a fire that the shelves carry. S3 must check that a fire cannot reach the Counter's Security case, or the Treasure is destroyed: I propose Security cases are fireproof (owner: CS §4.1).
- **A wrong placement next to the Hat Stand.** Noise 2 does not move a tethered warden outside its tether. It will wake the Gloves drawer if one is within 6 path tiles.

---

## 6. Thirty department pitches

One line each, at S1 depth: title, conceit, family, category, primary challenge type, and the signature module that would carry it. They are new; none repeats the five above or the examples in V, P and LM. Distribution: 4 per launch family and 1 per later family; 5 per subject category; 5 `land` departments, each a place-idea with no people on display; every primary type at least 3 times except `social`, which appears once and only in a later family (V D-V3).

| # | Title | Conceit | Family | Category | Primary (signature module) |
|---|---|---|---|---|---|
| 1 | Rooms Rebuilt From Their Insurance Photographs | After a flood three galleries were rebuilt from photographs, each slightly wrong; only the original room leads on. | Copies | `concept_institution` | `locks_puzzle` (`identical_rooms`) |
| 2 | Seals Pressed in Wax, With Their Matrices | Every impression is a copy of a matrix kept under glass, and breaking a matrix ruins its impressions. | Copies | `art_form` | `swarm` (`copies_weaken`) |
| 3 | Maps Copied by Apprentices, Each From the Last | Twelve generations of one floor plan, each copied from the one before; the department is laid out to copy twelve. | Copies | `art_form` | `attrition` (`identical_rooms`) |
| 4 | A Town Surveyed Twice and Built Both Times | Two survey offices never compared notes, so the town was built twice, one street apart, and the Museum holds both of every lamp post. | Copies | `land` | `guarded` (`copies_weaken` + `alarm_network`) |
| 5 | Lamps That Were Lit Only Once | Each lamp was lit for one recorded occasion and never again; the department's lights go out in the order of the occasions. | Light | `technology` | `darkness` (`staged_lights`) |
| 6 | Photographs Exposed for Too Long | Prints that took in so much light they now give it back, in straight lines, to whoever stands in front of them. | Light | `art_form` | `artillery` (`photosensitive`) |
| 7 | A Valley Where Noon Is Kept Indoors | The valley is so steep that sunlight reaches its floor for minutes a day, so its noon was stored in glass and lent out by the hour. | Light | `land` | `darkness` (`photosensitive`) |
| 8 | Furnishings From the Interval Between the Two Lightings | The decades after the old lamps were removed and before the new ones were fitted, when everything was made to be used by feel. | Light | `era` | `swarm` (`photosensitive`) |
| 9 | Instruments for Weighing Weather | Balances and steelyards built to weigh a fog bank and a gust, with samples of each kept for calibration. | Tides | `technology` | `artillery` (`weather_cases`) |
| 10 | A Province Where the Rain Falls Upward | Gutters set in the ground and drains in the ceilings; the department's weather jars are shelved upside down. | Tides | `land` | `hazard_terrain` (`weather_cases`) |
| 11 | Furniture Made Between the Seventh and Eighth Floods | Every table and chair from a period when the water came back each spring, built on legs of adjustable height. | Tides | `era` | `attrition` (`tide_cycle`) |
| 12 | Shells That Kept a Particular Afternoon | Each shell holds the sound of one afternoon on one shore, noted on its label; at high water they all sound at once. | Tides | `natural_history` | `swarm` (`tide_cycle`) |
| 13 | Lifts That Served Only One Floor | Each lift in the collection went to exactly one floor, and the shelving moves whenever one is called. | Machines | `technology` | `locks_puzzle` (`moving_partitions`) |
| 14 | Automata Built to Demonstrate Other Automata | Every machine performs another machine's routine, on the hour, slightly late. | Machines | `technology` | `hazard_terrain` (`hourly_demonstration`) |
| 15 | Looms That Wove Their Own Instructions | Pattern looms whose cards were punched by the cloth they made; the shuttles still cross the warp on schedule. | Machines | `art_form` | `artillery` (`hourly_demonstration`) |
| 16 | The Shift Between the Two Clocks | The years when the building kept two official clocks and the night staff patrolled to the slower one. | Machines | `era` | `guarded` (`hourly_demonstration` + `alarm_network`) |
| 17 | Birds Mounted in the Act of Leaving | Every bird is mounted with its wings half open; the preparators' notes say none of them was finished in time. | Specimens | `natural_history` | `darkness` (`unobserved_motion`) |
| 18 | Insects Found During the Great Reshelving | Everything that came out from behind the books when the library moved, catalogued by the shelf it fell from. | Specimens | `natural_history` | `swarm` (`heist_plinths`) |
| 19 | Creatures Known Only From Their Packing Crates | The crates arrived labelled and air-holed; their contents had gone by the time anyone opened them. | Specimens | `natural_history` | `guarded` (`heist_plinths` + `alarm_network`) |
| 20 | Animals Whose Cases Were Built First | The cabinet-maker finished the cases before any animal was found, and collectors were sent out to fill them to size. | Specimens | `natural_history` | `locks_puzzle` (`heist_plinths`) |
| 21 | Spoons, Arranged by What They Were Last Used For | A typology in which the last use decides the class: stirring spoons wake together, measuring spoons do not. | Classification | `concept_institution` | `swarm` (`taxonomy_aggro`) |
| 22 | Tools Filed Under the Wrong Trade | A registrar filed every tool under the trade that last borrowed it, and the tools behave according to their files. | Classification | `concept_institution` | `guarded` (`taxonomy_aggro`) |
| 23 | A Border Post With No Country on Either Side | A customs house stands where two places used to meet, its declared goods still waiting to be sorted into one or the other. | Classification | `land` | `locks_puzzle` (`sorting_vault`) |
| 24 | Everything Acquired During the Fourth Registrar's Tenure | Every label written in those years is suspect, and the errata sheet is somewhere in the department. | Classification | `era` | `attrition` (`lying_labels`, L+) |
| 25 | The Year the Floor Plans Were Lost | A period reconstructed from what the staff remembered of the rooms, which was never the same twice. | Memory (later) | `era` | `attrition` (`fading_map`) |
| 26 | A Province Drawn at Full Size, Kept in the Basement | The province's own map at one to one, laid out through the galleries, so the department is walked on its back. | Scale (later) | `land` | `hazard_terrain` (`scale_models`) |
| 27 | Frames Whose Paintings Are Out on Loan | Every frame is empty and every label present; the rooms are lit for paintings that are elsewhere. | Absence (later) | `art_form` | `darkness` (`absent_exhibits`) |
| 28 | Instructions for Machines, in a Script Nobody Kept | Operating manuals in a script the Workshops invented and abandoned; the machines obey the parts you can read. | Writing (later) | `technology` | `locks_puzzle` (`script_legibility`) |
| 29 | Visitors, Considered as Exhibits | The department displays the visiting public, with labels, and the attendants enforce the tour line. | Attendance (later) | `concept_institution` | `guarded` (`visitor_visibility`) |
| 30 | Objects Lent by the Porters' Hall, Displayed Open | A guild of porters lends its objects one page or one handle at a time and decides what may be shown. | Peoples (later, rare) | `concept_institution` | `social` (`living_community`) |

**Counts.** Primary types: `locks_puzzle` 5, `swarm` 5, `guarded` 5, `attrition` 4, `darkness` 4, `artillery` 3, `hazard_terrain` 3, `social` 1. Together with the five worked samples, every launch primary type appears at least 4 times in 35 departments.

**Notes on the lands.** #4 is about survey offices, #7 about a light condition, #10 about a weather, #23 about a border, #26 about a map. None has inhabitants on display. #30 shows the safe pattern for Peoples: an occupational guild with its own voice and loans (LM §3.3, Ledger of Debts Forgiven), filed under `concept_institution`, never a nation or a faith. It needs the S6 sensitivity review (V §9.1) before it exists.

**Where the pitches lean on the vocabulary.** #6 asks `photosensitive` to carry an artillery primary, which only works if the species budget is artillery-heavy; S3 might reclassify it as `darkness`. #18 wants a swarm from a Specimens module whose natural products are `locks_puzzle` and `guarded`; the swarm must come from the budget, which is allowed but untested. #12's "at high water they all sound" is a herald-on-the-tide idea that V cannot express (see §8.2, item 3 on module-tied behaviour).

---

## 7. A lobby Directory excerpt

As it would appear in the Entrance Hall one evening (P §5.3), (a) to (n). Three of the five samples are open tonight and carry their numbers in small type; the rest are the institution talking about itself.

> (a) Objects Lent by Visitors Without Meaning To. Ground Floor, behind the cloakroom. Open. *K.6*
> (b) Exhibits Awaiting a Second Opinion. Floor 3, the long corridor. Under review since the First Calibration.
> (c) Labels Written Before Their Objects Arrived. Throughout the Building. Open; objects expected.
> (d) Long Galleries, Considered as Telegraph Lines. Floor 2, West Range, its whole length. Open. *M.11*
> (e) Two Departments Merged by Mistake, Both Entrances Kept. Floor 4. Open twice.
> (f) Stairs Counted Twice at the Second Inventory. Between Floors 5 and 6. Under recount.
> (g) Gifts Declined on Grounds of Size, With Their Measurements. Loading Bay. By appointment only.
> (h) Animals Not Yet Seen by the Day Staff. Floor 1, the Mount Court. Open after dark. *S.9*
> (i) Things Cleaned Until They Were Something Else. Conservation Annexe. Temporarily removed for identification.
> (j) Benches, Arranged by How Long They Were Sat On. Every landing. Open; please sit.
> (k) Galleries Named After Benefactors Who Asked Not to Be. Floor 6. Closed at the benefactors' request.
> (l) Repairs Made by the Night Staff Without Authorisation. Staff only. Not yet catalogued.
> (m) Exit Signs, Superseded. Basement and below. Not open to the public.
> (n) Departments Proposed by Visitors, Pending the Committee. Floor 7½. Closed until the committee meets.

**Grammar or hand-written?** P §5.1 wants about one line in five from a curated list. Of the eleven fictions here, (b), (c), (g), (j) and (m) fit P's `#things# #qualifier#` rule once its lexicons gain "Exhibits", "Gifts", "Benches", "Exit Signs" and the qualifiers "Awaiting a Second Opinion", "Written Before Their Objects Arrived", "Declined on Grounds of Size", "Arranged by How Long They Were Sat On" and "Superseded". (e), (f), (i), (k), (l) and (n) are hand-written: each has a joke whose two halves depend on each other, which a slot grammar does not produce. That is about half, not a fifth, and suggests the curated list should be larger than P assumes (about 60 lines rather than 30) if the Directory is to keep its best lines recurring.

**What the excerpt teaches without saying so.** The three open departments are the only lines with numbers, and (h)'s "Open after dark" is the only status that is both a joke and literally true of every department in the game.

---

## 8. Self-critique

### 8.1 Strongest and weakest

| Rank | Department | Why |
|---|---|---|
| 1 | **S.9** Animals Not Yet Seen by the Day Staff | The house rule, the signature module, the voice rule ("reported, not observed"), the Treasure and the keepable all say one thing: watching versus being watched. The Sneak's internal conflict (darkness hides you from Waders and frees the Grazers) is a real decision rather than a stat check. No L+ dependency. Risk: two attention demands at once may be too much early in a run; the sequencer should push ordinal III late (V §11.3). |
| 2 | **A.4** Things Kept in Duplicate, Before the Repeal | Every id traces to "every object issued with a spare": copy groups, the splitter, the duplicator, the ensemble, the pen that breaks originals' glass. Its labels carry the most deadpan. Risks: three L+ dependencies, and a bureaucracy joke repeated in every label edges towards whimsy (LM pitfall 2). |
| 3 | **T.5** A Town Known Only at Low Water | The clearest single idea and the cleanest `land` example. It is the most expensive to build (height, flood, an L+ core) for one module, and it needs two things V does not define (`swims`, rubble). |
| 4 | **K.6** Objects Lent by Visitors Without Meaning To | The richest on paper: a semantic sort, an exchange heist and an ensemble whose original is read from a tag. That is five systems in one department, more than I would let S2 emit (§8.4). The sort is validated by an oracle and by Julian, not by play (V §6.3). |
| 5 | **M.11** Long Galleries, Considered as Telegraph Lines | The conceit is good and the programme fits it exactly, but "signals" collapse into generic ranged attacks: the Heliograph and the Signal Lamp are both light-emitting artillery separated only by tag and silhouette. Its keepable (`bolt` + `flash`) does nothing for its module, so it fails my own keepable test (§8.4). An enfilade with an artillery primary also risks being a corridor shooting gallery, held off only by the staff corridor. |

### 8.2 Where the vocabulary was too narrow

Each item is a concept a department wanted and V could not express. None was faked; each goes to V §11.4's unmatched-concept queue or to the owner named.

| # | Gap | Met in | Proposed fix | Owner |
|---|---|---|---|---|
| 1 | `tide_cycle` has no list of swimmers, though V §6.5 implies one | T.5 | A per-species `swims` flag, default false; the module's teaching instance must be a non-swimmer | V |
| 2 | Flag primitives (`sweep`, `reach`, `sure_footed`, `breaker`) have no budget price | every department | Price flags as M (2 points), or give each a class | V |
| 3 | No primitive reads a module's timer or schedule (a pocket tide table, a station timetable) | T.5, M.11 | Candidate `schedule_sense(m)`: S shows the signature module's next event on the HUD; M adds the secondary; L adds every demonstrator's next telegraph. Cheap, teaches the module, gives Machines and Tides keepables something of their own | V queue, rank high |
| 4 | Only the player observes | S.9 (keepers' lamps freezing Grazers) | Queue, low priority; it would double the observation code | V queue |
| 5 | Enemy attacks have no damage kind | M.11 (the Linesman's Apron resists light only if Heliographs deal light) | Each archetype declares a default kind; S2 may override from a closed list keyed by material; the balancer checks that resist items meet a matching source | V |
| 6 | `hourly_demonstration` says clockwork species "act on the bell" without saying how | M.11 | Define it (my suggestion: clockwork species gain one action on the bell) or delete the clause. I avoided clockwork on non-demonstrators to stay clear of it | V |
| 7 | `mp_ensemble` says "kill the original first" without saying what that buys | A.4, K.6 | My reading: while the original stands, falling pieces pass on their specials; once it has fallen, survivors are −1 tier and slowed and inherit nothing | enemies section |
| 8 | `mp_colossus` "uses the rubble", but rubble is not a fixture | T.5 | A toppled column becomes a rubble tile: blocks movement, passes sight, counts as height 1 | V §7 |
| 9 | Signature pieces cannot reference their module, though CS §6.5 asks for "one trigger tied to the department's rule module" | all five | D-S3 below | V, CS |
| 10 | Fog from a jar lasts 10 turns (V §6.2) but `dust_cloud` lasts 3 (V §7.3) | M.11 | State that module weather overrides the surface's default duration | V |
| 11 | The Treasure form has no place in V §2.4's assembly | S.9, K.6 | A "Sentinel" role for cores (D-S4) | V, D |

### 8.3 Where the vocabulary was too loose

1. **Any archetype can wear any noun.** M.11's Signal Lamp could as easily have compiled to `axis_sniper` as `kiter`. V §1.7's rule, "two hostile species must differ in silhouette *or* tag", let two light-emitting artillery species through. Tighten it: two species of the same role in one department must differ in silhouette *and* tag.
2. **The Medium line is an implicit modifier claim.** The tide bell had to be cast iron, because "bronze" would have made T1 expect `bronze`; "brass" had to stay off every non-clockwork species. V should publish a neutral-materials list and P's lint should enforce it, rather than every writer discovering it.
3. **Credit lines carry modifier claims too.** "Lent by" implies `on_loan` (later), so a species label may not use it. A lint, not a judgement call.
4. **Item media are unchecked.** "Silvered glass" on the Pocket Heliograph is harmless only if the T1 extractor ignores media on items. Say so in P §3.7.
5. **Counters are satisfied species by species.** K.6's Hat Stand needed two items for its two counter tags (`ranged`, `displace`); a department with three different wardens could spend half its item slots on counters. Let consumable kinds count (a thrown `flash_bulb` as `ranged` for this purpose), or let one item satisfy a tag for every species in the department, which it already does but which S2 should be told.

### 8.4 What this suggests for the generator's prompts and validators

| Stage | Change | Evidence from the five |
|---|---|---|
| S1 | **Require a `house_rule` field**: one institutional sentence ("Claims are processed on an exchange basis") that S2 must map to the signature module. A validator checks the mapping against the module's Essential-line template. | Every sample compiled most cleanly where the module was a rule the institution would plausibly post on a wall. |
| S1 | **Land lint.** Species and items in `land` departments come from civic, infrastructural, natural or weather nouns; no costume, ritual object or body part; no resident NPCs. | T.5 needed no exceptions under this rule; it is easier to enforce than "which real group does this read as?" alone, which stays as the review question. |
| S1 | **An optional `voice_rule`** (a department-level label formula, like "Reported, not observed"), with a pool-wide cap of one use per formula per 10 departments in T5. | S.9's formula carried coherence and uncertainty in two words; repeated across the pool it would become a tic. |
| S2 | **System-count cap by ordinal**: I ≤ 2, II ≤ 3, III–IV ≤ 4. A system is a module, a Treasure, or an attachment with its own rule. | K.6 counts 5 and would lose its Claims Clerk's Chair; nothing else changes. |
| S2 | **Keepable test**: the keepable acts on the signature module's own counterplay (V Table A's last column). | T.5 (push non-swimmers into the flood), S.9 (keep them in view) and A.4 (break the original first) pass. M.11 fails outright and would be sent back for `extinguish` or a D-S3 rider. K.6 fails structurally: its keepable serves the secondary (`recase` "clears the room" for the heist), because its Treasure is built on the secondary. That suggests a rule of its own: in a Treasure department, the heist module should be the signature. |
| S2 | **Intro feasibility before S3**: check the module's teaching instance against D §3.6's orientation caps. | A.4's V3 margin may need more spares than D allows. |
| S4 | **`essential_ref` selection rule**: pick the truth whose counterplay differs most from "hit it"; never a modifier, which the tombstone carries. | Each sample's didactic got easier to write once this was fixed. |
| S4 | **Reporting-verb lint** against the tooltip trap (P §3.7): the Essential sentence names a reporter ("keepers report", "the round book records", "the instructor complains"). | All 28 species and Sentinel didactics above pass; it is cheap to check. |
| S4 | **Number-free labels**: no balancer number appears in player text; panels name where the number is posted. | T.5 and M.11 point to the tide gauge and the station timetables. |
| Exemplars | Never more than two of these five in one prompt; rotate them; strip their proper nouns. | Otherwise every Specimens department will have night staff and every Copies department an Ordinance. |

---

## 9. Decisions for Julian (from this section)

**D-S1. How long are panels?**
- (a) V&A lengths as written here: intro 150–180 words, sections about 100. *Reads well in the full label panel; long on a portrait phone (CS §13.1).*
- (b) P §3.7's caps: intro ≤ 120, sections ≤ 60. *Fits a phone; the uncertainty and the human presence are the first things cut.*
- (c) Two layers: an entry banner of the first sentence plus the module sentence (≤ 50 words, extracted mechanically), and the full V&A text in the label panel. *Both audiences served; S4 must place the module sentence so it reads well out of context.*
- **Lean (c).** In all five samples the first sentence plus the module sentence already reads as a banner, at 38–50 words. **If (b):** S4 rewrites shorter and drops Flair before Fact; the samples here become the "long form" exemplars only.

**D-S2. Which samples go into the vertical slice?**
- (a) S.9, A.4 and M.11. *Cheapest modules (observation, copy groups, schedules), no flood system, one Treasure and two Fights.*
- (b) T.5 and S.9. *The two most distinctive; pulls height, flood and `mp_colossus` into the slice.*
- (c) All five. *Tests every Masterpiece form and both semantic and spatial puzzles; pulls in `diorama_spawner`, `breaker`, `recase` and `rival_visitor`.*
- **Lean (a)**, with T.5 as the first department after the slice. **If (b)** or **(c):** the slice budget absorbs the L+ items listed in §0.1.

**D-S3. May a Signature piece reference its department's module?**
- (a) No: V as written; two primitives, linked to the module by flavour only. *Simplest; M.11-style generic keepables recur.*
- (b) Yes, from a closed list of 1–2 authored riders per launch module (for example: `tide_cycle`, "+1 damage class against targets on lower ground"; `unobserved_motion`, "your lantern counts double for observation"; `copies_weaken`, "×1.5 against spares"; `heist_plinths`, "counts as a substitute of any size"). *Meets CS §6.5's "one trigger tied to the rule module" without opening the verbs.*
- (c) LLM-written riders. *Most variety; reopens the closed-verb contract.*
- **Lean (b).** About 15 rider ids, each with a micro-arena test. **If (a):** CS §6.5 point 1 is rewritten, and the keepable test in §8.4 becomes the only guard against generic keepables.

**D-S4. What guards a Treasure?**
- (a) Guards and a Security case only (D §6.4 as written). *Cheapest; the Masterpiece no longer tests the primary through a core.*
- (b) A V §2.4 core as Sentinel, as in S.9 and K.6. *Keeps "the Masterpiece tests the primary"; Defeat is a real fight; one more system.*
- (c) By ordinal: guards only at I–II, a core Sentinel at III–IV. *Matches complexity to ordinal.*
- **Lean (c).** **If (a):** S.9's Composite becomes a gallery guardian rather than a Sentinel, and K.6's umbrellas become a Fight department's Masterpiece instead.

**D-S5. How many mechanical truths in a didactic?**
- (a) Exactly one Essential line; modifiers in the tombstone; triggers as pictograms (this section). *T1 becomes a single-target check.*
- (b) An archetype line plus one modifier line, as the Escapement Hound sample does. *Richer labels; T1 must accept two, and 50–90 words gets tight.*
- (c) No mechanical line in the didactic at all; everything in pictograms. *Purest prose; the label stops being the interface (pillar 2).*
- **Lean (a).** **If (b):** S4's `essential_ref` becomes a pair, and the reporting-verb lint applies to both lines.

---

## 10. Challenges to the frame

1. **"Exactly one true mechanical hint" is not what the frame's own sample labels do.** The Escapement Hound states its beat, its weak side and what it hunts. Either the rule or the sample must give way. I propose the rule stays and the tombstone carries the rest (D-S5a); the sample should be rewritten with "left foreleg a later repair" moved into its Medium line, which is where V §3's tombstone cue for `old_repair` already puts it.
2. **"Land" needs a rule about who appears, not only about what the conceit is.** A land written as a place-idea slides back towards ethnography the moment it has residents who talk. Proposal: in `land` departments, NPCs are museum staff or fellow visitors only; residents belong to Peoples (later, rare, reviewed). T.5 follows it with no loss.
3. **The text lengths the frame inherits disagree.** This section was asked for V&A lengths (intro 150–180, sections about 100); P §3.7 caps them at 120 and 60. D-S1.
4. **Three things called guards.** The frame's patrolling guards, V's `patrol_guard` and CS's unharmable staff Guards overlap. Proposal: staff Guards are NPCs (CS rules); `patrol_guard` is always an exhibit; Table B's per-programme guard caps count both. S.9 needed this to fit `sculpture_court`'s cap of 2.
5. **"The Masterpiece tests the primary" sits awkwardly with Treasures**, where the Masterpiece is an object. D-S4.
6. **One object, three names.** The frame's "keep one item per department", P's `keepable` and CS's "Signature piece" are the same thing. Proposal: "Signature piece" everywhere, in fiction and in code.

---

## 11. Risks

1. **Exemplars become templates.** These five will be copied structurally if shown raw to S1 and S4 (PS F11: conditioning on previous outputs kills diversity). Mitigation: §8.4's exemplar rule, and T5's pool repetition check on structure as well as n-grams.
2. **Deadpan drifts into whimsy at scale.** Each sample allows itself one wry line per label. Thirty departments of that is a theme park (LM pitfall 2). Mitigation: a T6 judge flag on "joke density" per label; Julian's red pen on the first ten departments sets the norm.
3. **Text volume.** Each sample here is about 1,700 words of player-facing text (measured in §0.3), so a 30-department launch is about 50,000 words to curate before object zero, study-collection grammars and consumable skins. Mitigation: D-S1(c) moves most of it behind a tap, which reduces reading load but not curation load; S6 time per department should be budgeted from these samples rather than from a guess.
4. **L+ dependencies.** Four of five samples lean on an L+ id (`mp_colossus`, `diorama_spawner`, `breaker`, `attribution`, `recase`, `rival_visitor`). Each has a stated fallback, but the fallbacks are weaker departments.
5. **The semantic sort cannot be bot-validated.** K.6's vault is checked by an oracle and by Julian. If V's semantic modules become common, curation time grows with them.
6. **Sensitivity.** T.5 could read as a real tidal town to someone who knows one; pitch #30 needs a review process that does not exist yet.
7. **Two Treasures in a row.** S.9 and K.6 both end in alarms and Custody. The sequencer should not place Treasures adjacently (D §2.4 owns the rule).
8. **Fire in paper departments.** A.4 and K.6 are shelves of paper and textile. S3 must show that fire is a risk the player chooses, as V §10.6 already asks for "Works on Paper".

---

## 12. Cut line

If scope must shrink, drop in this order:

1. **The secondary modules in the samples** (M.11's `weather_cases`, S.9's `alarm_network`). Each sample still compiles; ordinals drop by one. K.6's `heist_plinths` is not cut here, because its Treasure is built on it.
2. **K.6 as a whole.** Most systems, an L+ keepable, an unverifiable puzzle. Replace it with pitch #21 or #22, a `taxonomy_aggro` Classification department that bots can validate.
3. **T.5**, until Tides returns (V's own cut line drops Tides early among families). The `land` exemplar then passes to pitch #7 or #23.
4. **Treasure forms** (D R7a): S.9's Composite fights in its hall and the Lamp becomes its drop.
5. **Barks beyond the Essential line, biographies beyond six events, and A.4's object-zero spare.**

**Never cut:** the label convention (tombstone cues, one Essential line, the hidden line for T1), the `house_rule` sentence, and at least one fully worked department per family that ships. They are the S1 and S4 exemplars and the S3 calibration targets, and without them the generator has nothing concrete to imitate or be measured against.

---

## 13. Interfaces with other sections

| Section | What this section needs from it |
|---|---|
| Vocabulary (V) | `swims`; flag prices; `schedule_sense` in the queue; enemy damage kinds; the clockwork clause of `hourly_demonstration`; rubble; module weather duration; a Sentinel role for cores; the "silhouette and tag" tightening; a neutral-materials list |
| Core systems (CS) | Staff behaviour at deep water; fireproof Security cases; Loans refused as substitutes; the Signature-piece rider (D-S3) |
| Difficulty (D) | Treasure Sentinels (D-S4); the V3-versus-orientation-cap conflict (A.4); the Tourist-in-hazard disagreement with V §8.2 (T.5); no adjacent Treasures |
| Pipeline (P) | `house_rule` and `voice_rule` frame fields; panel layers (D-S1); the land lint; the reporting-verb and number-free lints; item media ignored by T1; a curated Directory list of about 60 lines |
| Meta (M) | Object zero with a spare in A.4; "Signature piece" as the single name; Treasure pieces are eligible for accession like Fight drops |
