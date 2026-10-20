# Critique: a new player, on a phone

*Lens: a UX designer and playtester who plays Shattered Pixel Dungeon on a phone held in portrait and has never heard of PCG. Device assumed throughout: 390×844 CSS px, one hand, sound often off. Drafts read: `core-systems.md` (CS), `samples.md` (S), `meta.md` (M), `difficulty.md` (D), `layout.md` (L), with spot checks in `vocabulary.md` (V) and `research/tech-art.md` (TA). Sibling critiques `fun.md` and `museal.md` overlap in places; where they already argue a point I cite them and add only what this lens changes. Numbers I compute from the drafts are marked as such; numbers about human play speed are my unmeasured estimates.*

---

## 0. Verdict

The drafts design a game that is generous to a player who already knows it: free reading, telegraphs that never lie, odds on examine, declared quotas, capture instead of death. They do not design the path that leads a stranger to that knowledge. Every system is live in department 1 of run 1, and the one teaching device, the Intro gallery, is limited by L §11.1 and D §3.6 to the department's own module. On a 390-px screen, the interface that pillar 2 relies on, the tombstone line, cannot hold what CS says it holds: the median sample title alone (31 characters) fills the space left after the state, pips and three pictograms. Several facts a player needs (materials, archetype behaviours, original-versus-spare, module timing) live only in words that are truncated or deliberately oblique.

The fixes are mostly cheap, and most of them are UI and content rules rather than new systems:
- an authored Orientation Gallery;
- a HUD that shows only the systems the current department uses;
- a two-row tombstone strip with short titles and mandatory modifier icons;
- one plain-language "keeper's note" line per label;
- off-screen threat markers;
- a run-1 safety rail list;
- one naming pass.

Section 8 gives a progressive-disclosure plan, run by run.

---

## 1. What works and must be kept

- **Reading is free and costs position and light, not turns** (CS §1.3, C8a), with auto-open as an accessibility setting (C8c).
- **Telegraphs that show exact damage on each tile and never lie** (CS §2.4), and **Brogue's odds sentence on examine** (CS §2.7). These are the best new-player features in the document.
- **The "Highlights of this collection" box** (CS §8.6): SPD's declared guarantees, in the museum's voice.
- **The entrance safe zone and the certified Intro** (L §7.1, §11; D §3.6): an Intro must make its mechanic *required*, the Cautious novice must survive it in ≥ 99% of seeds, and a limited agent certifies it.
- **Capture is a setback, not death**, and guards cannot be harmed (CS §3.7, Challenges 2–3).
- **Low restart friction** (three taps from the death label, M §3.2), **Gift Shop shutters down on the first visit** (M §3.2), **ordinal gating and kind unlocks used as onboarding** (M §1.1 job 2, §4.4, §6.2).
- **The death label** ("Figure of a Visitor, Reaching", M §10.1): an emotional hook that costs one template.
- **The run is saved on `pagehide` and `visibilitychange`** (M §14.3). Phone sessions are short, so this matters.
- **The samples' Essential barks** (for example A.4's "Break the original first. The spares lose heart."). They are the only plain-language instructions in the content, and §7 builds on them.
- **D §9's "Not assists" rule**: text size, colour patterns and auto-open labels are plain settings and carry no ribbon.

---

## 2. The first ten minutes on a 390×844 phone

**Assumptions.** Night Guard. The first department is A.4, *Things Kept in Duplicate, Before the Repeal*, the only ordinal-I sample (Copies I, swarm primary), drawn under D §2.3's orientation-row rules. The Department size uses L §17.2's measured case-labyrinth figures: open hours B ≈ 360 turns. I assume a novice plays at about 25–35 turns per minute, unmeasured.

**Screen budget** (CS §13.1, TA F14):
- top bar about 48 px;
- world view 12 tiles × about 22 tiles at 32 px per tile;
- tombstone strip about 28 px;
- bottom bar about 64 px.

Tiny5 at 2× gives about 44 characters per line across 358 px.

Friction tags: **C** confused, **O** overwhelmed, **B** bored, **P** punished unfairly.

| Min | What the drafts put in front of the player | What happens to a new player | Tag |
|---|---|---|---|
| 0:00 | "First visit / I have a visitor's card" (M §14.4). Then the Entrance Hall, a walkable 24×14-tile room: Donor Wall, Your Collection (one plaque), Reading Room with the Catalogue and the Atlas wall, Staff Noticeboard, Information Desk, Cloakroom, Main Stair. On a 12-tile-wide view it scrolls in both directions. "Every station also on a hotkey" (M §3.2), but a phone has no hotkeys. | The player wanders a room of signs before learning what any of them are for. Nothing points at the Desk. | C |
| 0:40 | The Information Desk dialog: class (Night Guard; Copyist locked), a desk option (Complimentary Tea / Gallery Guide / Floor Plan / No, thank you), the Loan (none), and Membership. D §9 says the Desk offers Membership on the first run; M §8.1 says it is mentioned only after the third death. | The desk options are reasonable gifts once their subtitles say what they give. Membership is either missing or a pop-up before the player knows what it would help with. | C |
| 1:20 | The Entrance Hall's 3 door placards (D §1.1, §2.1). Each shows "COPIES 1 · THINGS KEPT IN DUPLICATE, BEFORE THE REPEAL" (48 characters, so 2 lines), a blurb, a primary and a secondary challenge icon, "Allow 8 minutes", the Masterpiece name with ⚔/◇/◎, and 0–2 reward icons. That is about 15 unknown symbols across 3 placards. M §7.3 separately sells "Members' Preview: choose department 1 from three placards" as a desk option, so the two drafts disagree on whether this choice exists at all. | The first real decision is made on titles alone. Every placard icon is noise at this point. "Allow 8 minutes" is not true on L's measured layouts (§6, M11). | O |
| 2:00 | Department entry. D-S1(c)'s banner (38–50 words: 6–8 lines, about 150 px over the world). The vestibule holds the orientation board (L §15.1) and the Highlights box. The HUD shows HP, the clock dial, the alarm bell, lux bars 0–4, and the lantern and tiptoe toggles; the bottom bar shows Wait/Search, Bag, Q1–Q3 and Map; above it sits the tombstone strip. | About 14 indicators and controls. Four of them (clock, alarm, lux, tiptoe) refer to things that have not happened yet. The Highlights box lists Restoration kits, Handling Clearance, the Loan Desk, the Masterpiece and "Labels that catalogue" with no word on what any of them is, and **no Certificate row** (§6, m1). | O, C |
| 3:00 | The Intro, "The Office Counter" (S §4.4): the original Seated Clerk in a vitrine, two spares dormant behind the counter. The strip reads `Zz Seated Clerk of the Ordinance Office (or…` (47-character title), so the catalogue number, which is the tell (plain number = original, stroke = spare), is cut. The label calls the spares "Certified Spare", which helps. The lesson is "break the vitrine and kill the original first". | The **first confirmation dialog in the game** ("bash glass?", CS §13.6) warns about the act the Intro wants. Bashing is noise 6, and the break is 10 (CS §3.4). If the department's one staff guard has a post in view, the first breach and room alarm come in minute 3. The game's first lesson is "break glass"; its general rule is "breaking glass is the big decision". | C, P |
| 4:00 | Section 1, the case labyrinth. Glass passes sight, so every dormant exhibit in the section is "in view". Tap-to-path stops "when a hostile comes into view or a pip appears" (CS §13.6). | If dormant exhibits count as hostiles coming into view, movement stops on almost every tap. If only pips count, it still stops at every exhibit with a PROXIMITY trigger. Constant re-tapping (fun MINOR 6). | B |
| 5:00 | First fight, with orientation fodder (D §3.6 keeps all of department 1's section 1 to fodder and skirmishers). Bump to attack; long-press for the odds readout. Soon after, past section 1, a plaster Trustee spare is a `splitter`. Its label: "Keepers break them with one blow, or not at all." Its pictograms: tag (red circle), footprints 3, and `ally_hit`, which **has no glyph in CS §13.4**, because the samples use V's trigger enum, not CS's. | The player hits it for 2–6, it splits, and they split again. The one sentence that explains this is a riddle. Nothing on screen says "splits when hit without dying". | C, P |
| 6:30 | A case with a key glyph "10" (Clearance), a Highlight star, a Restoration kit. Opening fires CASE_TOUCHED (room scope) and the room stirs. | Learnable, because the hand-on-glass glyph sits on the neighbours' tombstones. But "Handling Clearance" is read as security clearance, not as strength. | C |
| 7:30 | HP 9/20. The player does what SPD taught: tap self, Rest. Regeneration is `max(4, floor(400 / maxHP))` = 20 turns per HP at 20 max HP (CS §5.6), so resting to full takes about 220 turns. B ≈ 360 on L's measured layout, and the player has used about 150. | Rest is interrupted by a clock stage (CS §1.2), so the bell interrupts it, at 15/20 HP and with most of the open hours gone. Nothing showed the cost beforehand, and the natural next tap is Rest again, into Lights Down at half regeneration. Rest is also interrupted by "a hostile in view". If dormant exhibits count, Rest never runs in a gallery; if they do not, say so. The commonest habit in the genre silently spends the department. | P |
| 8:30 | First Bell, as a PA banner. The dial now shows time to Lights Down. | Understandable as "hurry". Not understood: pips have stopped decaying, guards have started Closing Rounds, regeneration is about to halve, and the Masterpiece will go to Stirring. | C |
| 9:30 | The Masterpiece hall, "five lecterns in a shallow arc" (S §4.3). The Masterpiece *is* five framed sheets on lecterns. Viewing for the Certificate means reading the gateway label at "the lectern" (CS §5.4). CS §13.6 requires a confirmation on entering but does not say it warns that the hall seals if anything wakes. | Which lectern? If a step wakes the ensemble, the hall seals, and the only way out is a Re-admission Ticket (5 of 100 deck cards) the player may not have or may not recognise. A player who came to *look* is locked in with a boss at 9 HP. | C, P |

**What the ten minutes add up to.**
- Every system is introduced by consequence, not by a teacher. The Intro taught one thing (originals first), and it taught it against the general rule about glass.
- The player has met about 20 named mechanics (fun.md Appendix A counts 32 by the end of department 3).
- The player has been interrupted by about a dozen path stops and three confirmations, and has read one riddle.
- The player is at real risk of their first death inside a boss arena they entered to read a label.

---

## 3. Runs 1–3 as the drafts describe them

| Run | M §13.1 says | What a new player meets on top of the department layer | UX notes |
|---|---|---|---|
| **1** (about 25 min, death in department 3) | Night Guard only; 3 free desk options; Collection empty. A Certificate in department 1, then the first slip with its one-line tutorial. Afterwards: Copyist unlocked, Gift Shop opens, "Tides II is now open", about 13 Stamps, a plaster figure. | **Perk choice** of 3 at the Certificate (two primary-family, one secondary). **The Registrar's slip** shows raw vocabulary: `clock_extension M · ticking`, `blunt M · knockback S`, NEW KIND, in pool, SIGNATURE (M §4.3). Doors with placards after every department. | The slip's one-liner is good, but player-facing text must never show primitive ids. "Tides II is now open" names a cell the player has never seen; placards say "TIDES 2" (Arabic numerals) and the Atlas says II. No slip appears without a Certificate, so a player escorted out by the Night Watch never learns accession exists or why it was withheld. The death label gives posture and room but no cause the player can learn from. |
| **2** (about 30 min, death in department 4) | Choose Night Guard or Copyist. First Loan, from 2 objects. Gift Shop purchase or save. An ordinal-II placard marked "Uncharted". Conservator unlocked at 5 accessions. | If the player picks the Copyist: the sketch verb (channel 2–8 turns, OBSERVED doubling, pages, quickslots). If they reach Stair Hall 1 for the first time: café (1 of 3), kiosk, Conservator (transfer, repair, sell a kit), Registrar, Directory and **Appointment** (subclass 1 of 2), so six services and two decisions in one 16×12 room. Ordinal-II departments bring a secondary module. | Hub decisions before run 2 (class, desk option, Loan, shop) are fine, because M pre-fills them. The Stair Hall is the second overload spike: it needs a guided first visit. The Loan arrives in the same run in which the player can meet the in-run Loan Desk, an out-of-depth "loan" exhibit and an `on_loan` credit line (§6, M7). |
| **3** (about 35 min) | First Conservator run, or a Copyist with a Loan. Members' Preview and Rain Check in stock. After the third death, one line about membership. | Forgeries (12% of ambient equipment in departments 1–4, CS §7.4) have probably been met by now, with a hold, a defect and a 6-rung ladder. | Three deaths before the assist is mentioned (M) is late for someone who needs it. One line, never repeated, is easy to miss. D §9 offers it on run 1. Pick one rule (§6, m5). |

**The meta drip is well paced: one or two new hub features per run.** The in-run layer has no drip at all. Section 8 gives it one.

---

## 4. Text load per department, and whether it can be skipped

**Measured by S §0.3**, words per department:

| Panels | Labels | Tombstone lines | Barks | Biography | Total |
|---|---|---|---|---|---|
| 363–468 | 617–791 | 268–379 | 27–31 | 193–241 | **mean 1,677** |

**On the phone** (arithmetic from TA F14's 44 characters per line):
- A 167-word intro panel is about 23–25 lines: about 500 px, or 60% of the screen as a bottom sheet.
- A 100-word section panel is about 14 lines.
- Reading everything at a plausible 150–200 words per minute in a pixel font would take **8–11 minutes per department**, against about 3–9 minutes of play.
- Under D-S1(c), a banner of up to 50 words appears on entering every section: about 3–4 per department, or about 30 per run. CS §4 does not say whether banners are modal.

**What a player who never taps still sees:**
- tombstone lines, truncated (§6, B2);
- barks;
- banners;
- pictograms;
- telegraph numbers;
- the HUD.

That is about 450–600 words per department, mostly titles.

**Facts that exist only in text a phone player will not see.** These break the claim that text can be skipped without losing the ability to play well (pillar 2: "every mechanical truth is also shown as an icon").

| Fact | Where it lives | Example | Phone status |
|---|---|---|---|
| Material modifiers (blunt ×0.5, edge ×0.5 and slow, fire ×2, HP ×0.7, ticks, reflects beams) | The Medium word in the tombstone (S §0.2, V §3). Only porcelain, bronze and paper have icons in V | "Marble"; "Plaster cast after the marble"; "brass, steel; escapement" | Truncated off the strip. In the panel only as a word |
| Archetype behaviour (splits, kites, tethers, heals allies, mimics, steps back) | One Essential line, phrased "as an observation by a named role, never as an instruction" (S §0.2) | "Keepers break them with one blow, or not at all" (splitter); "the spares have kept their posture only while the original keeps its own" (copies_weaken) | Panel only, and oblique by rule |
| Original versus spare, mimic, object zero | The catalogue number, the last tombstone field | `A.4.1` vs `A.4.1/a`; a mimic case "has no catalogue number" (S.9.5); `<dept>.0` | Never on the strip |
| Module timing (tide stages, exchange bells) | A posted timetable (S §0.2 "number-free labels") plus audio | "the timetable posted at the tide gauge"; "the player hears the stage change without looking" (S §1.3) | No HUD timer (§6, M5) |
| How to earn the Certificate without fighting | CS §5.4 only | Read the gateway label at the lectern | Not in the Highlights box (§6, m1) |
| Which lectern grants the view in A.4 | Nowhere | Five Masterpiece lecterns plus a gateway lectern | Ambiguous |

---

## 5. Understandable without a manual?

| System | Verdict | Why | What would make it self-explaining |
|---|---|---|---|
| **Wake triggers** | Partly | 13 glyphs plus digits is learnable if they are always visible and tappable. But: three eye glyphs (SEES_YOU, OBSERVED, UNOBSERVED) that differ by a frame or a closed lid are hard to tell apart at 8×8; the samples use V triggers that have no CS glyph (`ally_hit`, `period`, `tether`, `path`, `awake`); and the drafts disagree on whether triggers are visible on a first encounter at all (§6, M1) | Always visible; tap any glyph for a one-line meaning; a core set of at most 8 trigger glyphs, with the rest captioned |
| **Closing clock** | Mostly | A dial plus PA banners reads as "hurry". The stage *effects* are invisible: decay stops, regeneration halves, the Masterpiece stirs, Watchmen path to you | One line under each banner: "Bell: exhibits stop settling; guards sweep from the exits". Rest shows its turn cost |
| **Attribution ladder** | No | "Manner of / Circle of / Workshop of / Attributed to / By" carries no order a layperson can read; museal.md M2 shows the order is also art-historically backwards | Show a rung meter beside the qualifier (`Circle of the Regulators ▮▮▯▯▯`), or adopt CS cut-line item 5 (three rungs) as the default |
| **Handling Clearance** | Partly | One number with three jobs is good. The name says "doors", not "strength" | Key glyph and number on every gated thing, shown in the hostile colour when you are short, with the penalty ("−2 Acc") on the item card |
| **Restoration** | Yes | "+N" is genre-standard | Show per-slot effects at the moment of applying |
| **Certificates** | Yes once earned; no on how to earn one | Viewing counts, but nothing says so | A Highlights-box row: `Certificate [ ] view or defeat the Masterpiece`; a rosette on the viewing lectern |
| **Accession** | Mostly | The slip's one-liner works | No primitive ids; a greyed slip when no Certificate was earned |
| **Loans** | No | Five meanings (§6, M7) | Rename |
| **Directives** | Yes, when they arrive | Unlocked after the first escape. Hades players know the shape | Nothing for v1 |

---

## 6. Findings, ranked

Each finding is tagged **[Error]** (fix it) or **[Design]** (a disagreement to put to Julian as options).

### BLOCKER

#### B1. No progressive disclosure: run 1 shows everything, and nothing teaches the universal layer. [Error + Design]

**Where.** CS §13.4 ("the game introduces [the 13 trigger and 5 state glyphs] in the Intro gallery of the first department"); L §11.1 (Intro content limit: one mechanic, at most 3 hostiles); D §3.6 (orientation pool, signature mechanic only); CS §17, V §15 and D §12 never-cut lists; M §1.1 job 2 (complexity arrives gradually, but only for content).

**What is wrong.**
- **[Error]** CS and L/D cannot both be true. An Intro that teaches its department's module cannot also introduce 18 glyphs, guards, the clock, Clearance and the ladder. Nothing else in the drafts teaches them.
- **[Design]** The meta drips content by ordinal, kind and class. The in-run surface (HUD meters, toggles, glyphs, prompts) is complete from minute 2. fun.md BLOCKER 1 makes the complexity case; I agree, and add that the surface can be staged even where the simulation is not.

**Why it matters for Julian.** "Familiar to play" (pillar 1) is earned by learning the shared layer once. With no teacher, first-timers learn it by dying. D §3.9's own model gives a first-time human a 13% death rate in department 1 and a 3.5% run clear. On phones, where a session is 10 minutes, a player who dies confused in department 1 does not come back for run 2, where the meta's good drip begins.

**Resolution.**
1. **[Error fix]** Delete CS §13.4's last sentence. Name the universal-layer teacher explicitly (§7).
2. **[Design, lean]** Adopt §8's disclosure plan. Three mechanisms make it cheap:
   - an authored **Orientation Gallery** before department 1 of run 1;
   - a **per-department HUD manifest**, so a meter or toggle appears only if the department's spec uses its system;
   - a **content cap for ordinal I**, which is all run 1 ever sees (M §6.2), on the number of trigger types and systems.
3. **[Design, alternative]** Keep the full surface from run 1, but ship the Orientation Gallery and one-time "Visitor's Guide" cards (§7). This is cheaper, but run 1 stays dense.

#### B2. The phone strip cannot carry pillar 2. [Error]

**Where.** CS §13.2 (strip format and the 45-character cut); S §0.2 (modifiers live in the tombstone's Medium line; catalogue numbers carry tells); V §1.8 (the tag glyph sits on the exhibit's plaque; a moving exhibit carries only a 1-px trim colour); S §4.8 ("both are readable on the tombstone line from 2 tiles").

**What is wrong** (arithmetic from the drafts):
- **Space.** The strip is about 44 characters. State and pips take 7. Three 8×8 pictograms at 2× take about 8 character widths. That leaves about 29 for "Title · rung/maker · medium". The 56 species and item titles in S have a **median length of 31 characters** and run up to 50 (my count by script). CS's own example, `Zz ●●○ Escapement Hound · Workshop of the Regulators · brass`, is 60 characters before its pictograms.
- **What is lost.** The rung, the medium and the catalogue number never reach the strip on a phone. So the facts S puts there (material modifiers, the original/spare number, the mimic's missing number) are invisible in normal play. S §4.8's claim that A.4's Masterpiece tell is "readable on the tombstone line" is false on the target device.
- **Moving exhibits.** Once an exhibit wakes and leaves its plinth, its behaviour glyph stays on the plaque. The moving sprite carries the tag only as colour (a 1-px trim). Colour-blind players and anyone glancing at a 16-px sprite lose it.

**Why it matters for Julian.** Pillar 2 ("the label is the interface; every mechanical truth also as an icon") is the frame's answer to "most players will not read". On the device the house convention targets, the interface is a truncated title.

**Resolution.**
1. **A two-row strip on portrait phones** (about 48 px instead of 28; take the space from the world view, about one tile row).
   - Row 1: state, pips and a **short title**.
   - Row 2: icon-only facts: tag, ≤ 3 triggers, ≤ 2 modifier icons, and tell glyphs.
2. **A `short_title` field (≤ 18 characters)** emitted by S4 and linted: "Net Floats", "Bollard", "Seated Clerk (orig.)".
3. **Every modifier gets an icon** (V contract rule 7 already requires one per id; CS §13.4 omits them). Marble, plaster, glass, textile, clockwork and old repair are the gaps.
4. **Tells become glyphs.**
   - "Original" and "spare" glyphs (a solid seal versus a stamped "copy" seal) when a `copies_weaken` group is present.
   - A "no number" glyph appears only once the case is examined, so the mimic stays fair but findable.
5. **A small tag glyph rides above an awake exhibit**, beside the pips, not only on the plaque.
6. **Test before building.** A paper prototype at 390 px using S's 56 real titles (§10).

### MAJOR

#### M1. The drafts disagree about what a first-time player can see on an exhibit. [Error]

**Where.**
- CS §13.2: trigger pictograms on the proximity strip, free, always.
- M §6.1: the "Observed" knowledge level reveals "its wake triggers and behaviour tag, before it wakes", **on later runs**.
- D §9: the Patron sub-toggle *Docent's Notes* shows "every exhibit's wake triggers… without reading".
- CS §11: a Docent's gallery talk "reveals the wake triggers of every exhibit in the room".
- S.9.10: Round Book 9 reveals "the tag of every dormant exhibit in view".
- V §1.8: the tag glyph is on every plaque.

**What is wrong.** Under M, D, CS §11 and S.9.10, triggers and tags are hidden on a first meeting. Under CS §13.2 and V §1.8, they are always shown. Which one is proposed decides whether stealth in run 1 is readable at all.

**Why it matters.** Pillar 3 (fight, sneak or leave) is only a choice when the player can see what wakes things. Hidden triggers make run 1 a stealth game with invisible rules. Visible triggers make Docent's Notes, the Docent talk and Round Book 9 dead weight.

**Resolution (lean).** Triggers and tag are **always visible** (CS wins). Then:
- **The Catalogue** reveals what an attentive player would remember beyond that: special shapes, counter tags, the player's own record.
- **Docent's Notes** becomes "each exhibit's Essential line in plain words" (see M3), which is a real assist.
- **The Docent talk** identifies a kind and reveals mimics.
- **Round Book 9** reveals hidden-tag exhibits.

Write the visibility rule once, in CS, and have M, D, S and V cite it.

#### M2. Unfair punishments a new player will meet in run 1. [Error and Design]

| Trap | Where | What happens | Fix |
|---|---|---|---|
| **"I'd like to leave"** | CS §11–§12 | In a game whose goal is "make it out of the museum", asking a guard "I'd like to leave" ends the run. A new player picks it expecting progress | Word it "End my visit here (the run ends)"; confirm with the consequences; hide it in run 1 |
| **The sealed hall traps a viewer** | CS §5.4, §13.6 | Viewing requires entering the hall. One wake seals it; the exit is a 5%-weight consumable | (a) Lean: never seal in the player's first two departments ever, and in all departments seal only after the Masterpiece's first special resolves (one telegraphed beat to leave). (b) The viewing lectern doubles as a re-admission point ("Leave the demonstration", 2 turns). The entry prompt states the rule in one line |
| **Resting spends the department** | CS §5.6, §1.2; L §17.2 | At 20 max HP, regeneration is 1 HP per 20 turns, so full recovery is about 400 turns. On L's measured layouts a Department's B is 310–370 turns (CS's own assumed B of 650 still puts a full rest at 60% of it). Rest stops at a clock stage, but only after the time is gone. The genre's commonest habit silently brings on Lights Down and the Night Watch | Rest shows its cost before it starts ("Rest to full: about 220 turns; the bell is in 150"). Benches say "×2 here". Say whether dormant exhibits interrupt Rest. Re-base B on measured `L_tour` (L-D1) before tuning regeneration |
| **The Night Watch escort costs the slip, silently** | CS §5.3; M §4.2 | No Certificate, so no slip, so no accession, Stamp or kind | Show a greyed slip: "The Registrar cannot accept an object without this department's Certificate" |
| **Unknown harmful drinks** | CS §6.4 (Fixative: Fixed 4 turns); D §4.2 (≤ 2 harmful kinds per department) | A hurt novice drinks an unknown Solution in a fight and is paralysed for 4 turns. This is genre-standard, but heavier here because there are 12 kinds, reskinned per department | No harmful-drink kinds in a player's first two departments; the unknown-Solution panel says "Untested. Some are harmful to drink; throwing is safer" |
| **Tiptoe** | CS C4 | fun.md MAJOR 1 shows tiptoe doubles per-turn pips and burns clock. Players who feel "sneaking is safer" are punished twice | Hide the toggle until a Guarded or Darkness department, and adopt fun.md's fix |
| **Department 1 lethality** | D §3.9 | First-time human: 13% death in department 1 | **[Design]** A first-visit rule (not adaptation): the Orientation Gallery plus a department-1 target of ≤ 3% for the "first-time human" row. R12 forbids adapting difficulty to skill; a fixed rule for a player's first department is onboarding, like StS's easy pool |

**Why it matters.** Each trap teaches "the game is unfair", not "I made a mistake". A roguelike survives death when the death is legible.

#### M3. Too much reading, and the one line that matters is oblique by rule. [Design]

**Where.** S §0.2 (Essential line "phrased as an observation by a named role… never as an instruction"; "number-free labels"); S §0.3 (1,677 words per department); D-S1 (panel lengths); CS §4 (section banner on entering a gallery).

**What is wrong.**
- The deadpan register is the game's charm. But the Essential line is often a riddle: "Keepers break them with one blow, or not at all" (splitter); "the spares have kept their posture only while the original keeps its own"; "Keepers report that it still takes a moment to gather the light before it sends".
- A player who does read still has to decode. A player who does not read has only the tag glyph (B2).
- About 30 banners per run, each up to 50 words, compete with the world on a 390-px screen.

**Why it matters.** The label is the interface only if the interface reads. Julian's brief asks for "explanatory text", and the drafts deliver flavour text with the explanation encrypted.

**Resolution (options).**
- **(a) Lean: a plain "keeper's note" row** under the pictograms in every label panel. It is 3–7 words, generated mechanically from the hidden line, never by the LLM: "Splits when hit but not destroyed." "Spares weaken when the original falls." It is on by default in runs 1–3 and a setting afterwards. The didactic stays untouched and deadpan. The round-trip validator already extracts this sentence, so the cost is display.
- **(b)** Loosen S §0.2 to allow one plain instruction per label. This harms the register.
- **(c)** Keep the rule, and rely on the Catalogue's Documented level. A first meeting stays a riddle.

**Banners.** Non-modal, ≤ 25 words, auto-fading after 4 turns, never drawn while anything is Hunting, and re-readable from the map.

**Intro panels.** Behind a tap, with the module sentence on the banner. D-S1(c) is right; cap the banner, not the panel.

#### M4. The screen is smaller than the threat. [Error]

**Where.** CS §13.1 (portrait view about 12 tiles across); CS §3.6 (you are seen from 6 on Low, 9 on Bright and 12 on Spotlit tiles; you see 12 on Bright); CS §2.6 (artillery range 6, +2 from balconies); S.M.11.1 (Heliograph axis range 10); L §20 risk 10, which relies on "threat pips on the screen edge (core UI)" that CS never specifies.

**What is wrong.**
- A portrait view shows ±6 tiles horizontally. In any Bright or Spotlit room, exhibits outside the screen see you, wake on SEES_YOU, and shoot along axes from off-screen.
- An OBSERVED-trigger exhibit 8 tiles to your left is "observed" (in your line of sight and lit) while not on your screen, so it wakes from a look the player never took.
- A telegraphed special can mark tiles you cannot see.

**Why it matters.** "Telegraphs never lie" is only true if they are on screen. On a phone the most important feedback in the design can be outside the viewport.

**Resolution.**
- Edge markers for every Awake or Hunting exhibit and every telegraph that includes your tile.
- Auto-pan (or a brief zoom-out) when a telegraph targets you.
- A pinch-zoom setting with 16, 24 and 32 px tiles.
- Camera lookahead toward the nearest awake threat.
- **Define observation as "on screen" or as "in line of sight"**, not both (see M6).

#### M5. Schedules and audio cues have no visual twin. [Error]

**Where.** S §1.3 (T.5: "the player hears the stage change without looking at the gauge"); S §2.3 (M.11: two bars of silence, then the warning bell); S §3.3 (S.9: the Waders' walking bass; "nothing in the score marks the Grazers"); S §4.3 (A.4: the canon voice goes silent); S §8.2 gap 3 (`schedule_sense`, "shows the signature module's next event on the HUD", proposed as an item primitive); S §0.2 ("number-free labels").

**What is wrong.**
- Timed modules (`tide_cycle`, `hourly_demonstration`, `period(p)` triggers) have no HUD timer by default. The drafts offer the timer as a keepable's ability.
- Many phone players play muted. Deaf and hard-of-hearing players never hear the cue.
- A tide's deep stage is a hazard state, not a special, so CS's telegraph contract does not cover it.

**Resolution.**
- **Lean:** every scheduled module gets a small countdown pip beside the clock dial, with its pictogram (wave, bell). Make `schedule_sense` a perk or curio that adds the *secondary* module's timer and demonstrators' next moves, not the basic timer.
- Every audio cue that carries information gets a visual twin: a caption ribbon ("Warning bell"), a tile pulse or a screen-edge flash.
- PA announcements and barks are captioned by default.
- The "number-free labels" rule stays for labels. The HUD may show numbers.

#### M6. The player has no defined facing, but the observation mechanics assume one. [Error]

**Where.** CS §3.3 (OBSERVED: "in your field of view and lit"; UNOBSERVED: "not in your field of view"); CS §3.6 (vision is 360°: line of sight within the band distance; "no facing cone" for guards, because cones "add a reading burden on phones"); V §1.4; V §2 `unobserved_mover` counterplay ("back away facing it"); S §3.4 (S.9's Intro: "the gaze-blind novice turns to fight the Hoppers and is struck from behind"; "backs towards the exit facing it").

**What is wrong.** Under CS's 360° vision, a lit Grazer in line of sight is always observed, and "turning round" does nothing. S.9's Intro lesson, the counterplay text in V, and the Cautious persona's behaviour all describe a facing that does not exist. If facing is added, it becomes an invisible state on tap-to-move, which turns you along every path step. S.9 ranks first among the samples and is in the lean vertical slice (D-S2 (a)).

**Resolution (options).**
- **(a) Lean: keep 360° vision.** Redefine `unobserved_motion` as "moves on turns it is not in your line of sight, or stands on a dark tile". The S.9 lesson becomes corners and lamps, which phones show well, not turning. Rewrite V's counterplay and S.9's Intro accordingly.
- **(b) Add player facing only inside modules that need it.** In S.9 you carry a hooded lamp whose 90° cone is drawn on the floor and follows your last step or a swipe. It is legible, but it is one more control.
- **(c) Global facing with a drawn cone.** This is the reading burden CS rejected for guards.

#### M7. Words that mean four or five things. [Error, with naming options]

| Word | Meanings in the drafts | Proposal |
|---|---|---|
| **Loan** | the meta Loan slot (M §5); the in-run Loan Desk (CS §6.6); out-of-depth "loan" exhibits (D §3.7); the `on_loan` modifier "Lent by…" (V §3); the Loan request (M §11); K.6's "unintended loans" | Meta: **"Your Loan"** (keep, issued by the Cloakroom). Loan Desk: **"Handling Desk"**. Out-of-depth: **"Touring exhibit"**. Fold `on_loan` into Touring |
| **Catalogue** | the Catalogue Card consumable; the Catalogue journal; "catalogued" (rung 5); "Labels that catalogue"; the Registrar's *Catalogue Sweep*; P's index cards (already renamed) | Consumable: **"Index Card"** or "Attribution Slip". "Labels that catalogue" becomes **"Labels that identify"** |
| **Exhibition** | the Special Exhibition door (D); the ticketed room (L); Temporary Exhibitions (P); Today's Exhibition (M) | Elite door: **"Special Exhibition"** (keep). Daily: **"Today's Visit"** |
| **Guard** | staff Guard NPCs; V's `patrol_guard` exhibits; the Night Guard class; Watchmen; the Guard at Post One | Class: **"Night Porter"** or "Attendant". Exhibit archetype: keep `patrol_guard` internal, and call it a "Patroller" on labels |
| **After / copy** | Copyist sketches ("After the…"); deaccessioned forgeries; V's ladder rung 0; A.4's spares; the `forgery` modifier, which uses "Attributed to" in the opposite sense (museal.md M2) | Reserve "After" for sketches and honest copies (CS Challenges 1). Exhibits use **"Certified Spare"** |
| **NPC equals class** | Conservator, Docent (both NPC and class) | The class names are fine; the NPC examine line reads "Conservator (staff)" |
| **Kind names** | Consolidant, Fixative, Developer, Solvent | Once identified, show a function glyph and a gloss: "Consolidant (heals)" |
| **Raw ids** | `clock_extension M · ticking` on the slip (M §4.3) | A lint: player text never contains a vocabulary id |
| **Ordinals** | "TIDES 2" on placards, "Tides II" in the Atlas | One numeral system |

Add a one-page player glossary to the doc. The naming pass is an hour's work and removes a whole class of confusion.

#### M8. Colour: two reserved palettes collide, and moving threats are colour-only. [Error + accessibility]

**Where.** CS §13.4 (reserved: hostile red, hazard orange, readable cream, item gold, player blue); V §1.8 (tags: pursuer red, ranged orange, controller violet, support green, warden blue, conditional white, hidden grey, neutral teal, masterpiece gold); CS §6.4 (6 wax-seal colours); M §8.2 (the Patron lanyard "in the tier's colour"); CS §13.1 (alarm bell grey, amber, red).

**What is wrong.**
- **Blue** is both the player and wardens (patrol exhibits).
- **Gold** is both items and Masterpieces.
- **Orange** is both telegraphed hazard tiles and ranged exhibits' trim, so the colour that means "do not stand here" is also worn by the thing shooting.
- Under protanopia and deuteranopia, pursuer red, ranged orange and support green converge, and controller violet reads as warden blue. Under tritanopia, neutral teal, support green and warden blue converge.
- There are 14 reserved hues plus 6 seal colours. Department palettes are pushed to desaturated ramps (the samples' palettes already have to be "desaturated" and kept "clear of the reserved red / controller violet / gold"), which works against Calvino-style distinctness.

**Resolution.**
- One semantic palette of **at most 6 hues**, owned by CS. Behaviour tags differ by **glyph shape**, with at most two colour groups (hostile and non-hostile).
- Alarm states as a glyph (a bell with 0, 1 or 2 waves).
- The colour-blind telegraph patterns D §9 mentions become default-on hatching.
- TA's `tools/shot.js` runs a CVD simulation (deuteranopia, protanopia and tritanopia filters) on contact sheets and fails the build on reserved-pair collisions.

#### M9. Touch and motor load. [Design]

**Where.** CS §13.1 (lantern and tiptoe toggles in the top bar); §13.6 (long-press to examine; confirmations for shards, ropes, staff doors, glass and the Masterpiece hall; tap self for Wait, Rest, Search and Sit); §13.2 (swipe on the strip to cycle); S §4.8 (A.4 phase 3 `shatter_all` covers the hall floor in shards).

**What is wrong.**
- **Reach.** The two most-touched toggles sit in the thumb-hostile top of an 844-px screen.
- **Flicking.** Reading in Dim rooms needs a lantern flick: two extra taps per label (fun.md MINOR 8).
- **Confirmations.** After a `shatter_all`, every step onto shards asks for confirmation mid-boss.
- **Swipes.** A swipe on a 28-px strip directly above the world view will start paths by mistake.
- **Waiting.** Schedules (tide period about 16 turns, demonstrations about 12) have no "wait until it changes" command, which means a dozen taps.

**Resolution.**
- Move the toggles to the bottom bar.
- A context action button: Read, Open, Sketch, View, whichever applies.
- Reading in the dark auto-flashes the lantern for one turn, as fun.md proposes.
- Confirmations get "don't ask again in this department", and tap-to-path routes around shards and ropes when another path exists.
- Cycle the strip with arrow buttons, not a swipe.
- "Wait until something changes", plus a "wait for the bell" option for scheduled modules.
- Touch targets of at least 44 px.

### MINOR

- **m1. The Highlights box omits the Certificate and the view rule.** [Error] CS §8.6. Add `Certificate [ ] view or defeat the Masterpiece`, and put a rosette glyph on the viewing lectern. In A.4, whose Masterpiece is five lecterns, place the gateway lectern apart from them and give it a distinct plinth.
- **m2. "A gap in the room numbers means a secret" is contradicted by the orientation board.** [Error] CS §1.2 says it; L §15.1's own example omits a study (404), and says "here the thing is a study, not a secret". Draw studies on the board as closed blocks, and keep gaps for true secrets only.
- **m3. "Allow N minutes" on placards** (D §1.4) rests on 80 turns per minute and on `L_tour` values that L §17.2 measured 40% lower. A placard is a promise. Show the size word (Cabinet, Department, Annexe) until playtests measure minutes.
- **m4. Placard load in run 1.** Show the title, the primary icon and the Masterpiece form only. Reveal the secondary icon, size and reward icons from run 2. Settle D (3 doors at the Entrance Hall) against M §7.3 (Members' Preview sells that choice).
- **m5. Patron timing and model disagree** between D §9 (offered on run 1; −20% plus 2% per death to 60%; blocks Directives) and M §8 (mentioned after the third death; four tiers; blocks nothing). For this lens, offer it from run 1 as a neutral line at the Desk and in Settings, never as a pop-up. Re-offer it once after the third death. Use one model.
- **m6. The death label explains posture, not cause.** Add one line, "What the night staff noticed", built from CS §14's "who woke what" log: "The Bollard woke when you crossed stone within 3 tiles (ear 2)." The persona harness already computes this, and it is the cheapest teacher in the game.
- **m7. Entrance Hall on a phone.** On the first visit the Information Desk dialog should open automatically. "Hotkeys" become tappable signs.
- **m8. Pixel font for 1,700 words.** Tiny5 at 16 CSS px (TA F14) is the only specified body font. Add a "Readable text" setting (Atkinson Hyperlegible or the system UI font) with three size steps. The DOM overlay (TA lean (b)) makes this free.
- **m9. Flashes and motion.** The Flash Camera, security lighting, palette-cycling water and "glass glint breathes" need a reduced-flash and reduced-motion setting.
- **m10. K.6's sort is a reading-comprehension puzzle on English idiom** ("Returned, Then Left Again"). It is optional (S §5.4), which is right. Keep text-gated content off the critical path as a written rule, and flag it for localisation.

---

## 7. Onboarding: what to build

1. **The Orientation Gallery** (authored, about 3 minutes, before department 1 of run 1; replayable from the Information Desk; skippable after its first completion).
   - **Where.** A small gallery off the Entrance Hall, "Introduction to the Collection", with the **Guard at Post One** walking you through it. M already gives this character about 120 lines and a reason to be there.
   - **Five rooms, one idea each:**
     1. Tap to move. Long-press to examine a bench and a plaque: the strip, then the panel.
     2. A dormant figure with *footprints 2*: walk round it. A marble floor strip and an *ear 2* figure: this is noise.
     3. A case with *key 10*. Opening it fires the *hand on glass* glyph on its neighbour, which wakes. First fight: bump, the odds sentence, a surprise attack.
     4. A telegraphed special: orange tiles with a number. Step out.
     5. An identifying label with the *book and seal* glyph next to a sealed bottle, which becomes "Consolidant (heals)". Then one door with one placard.
   - **Not taught here:** guards, lux, tiptoe, the clock and the ladder. Each is introduced where it first appears (item 3).
2. **The guard as tutor in every department, runs 1–3.** In the vestibule, the staff guard speaks the department's Essential bark. The samples already write them: "Water's turning. Get up the stairs." "When the warning bell goes, get out of the doorway." "Break the original first." This is plain, diegetic and costs nothing new. From run 4 the bark moves to wherever the department's NPC is.
3. **Visitor's Guide cards.** The first time any system or glyph appears in a run, a one-sentence card with its glyph slides up from the strip. It is non-modal and gone after 3 turns. Each card is filed in the Catalogue under "Visitor's Guide", and every glyph is tappable for the same sentence forever after.
4. **Guided first Stair Hall.** On the first arrival, the Registrar walks you past the services in one bark each, then the Appointment.
5. **The Intro gallery stays as the module teacher.** It is good. Keep fun.md MINOR 5's "Members' entrance" for Documented modules.
6. **The post-mortem line** (m6).

---

## 8. Progressive-disclosure plan

**Principle.** The simulation can stay whole. What is staged is (1) the HUD surface, through a per-department manifest, (2) which systems ordinal-I content may use, which is all run 1 ever sees (M §6.2), and (3) a few run-count gates on player-facing features. That needs no second ruleset for the balancer, only a content cap and a UI rule.

| System | Run 1 | Runs 2–3 | Later | Unlock trigger |
|---|---|---|---|---|
| Orientation Gallery | yes, before department 1 | replayable | replayable | – |
| Bump combat, odds, telegraphs | yes | yes | yes | – |
| Awareness states | 3 shown: asleep (Zz), stirring (pips), awake (!) | add Hunting (!!) and Returning | – | the first chase that loses you |
| Trigger glyphs | ≤ 5 types per department in ordinal I (PROXIMITY, NOISE, CASE_TOUCHED, ITEM_TAKEN, plus the signature) | as ordinal II brings them | all | ordinal cap (extend D H5 to count trigger types) |
| Lux | a dark-tile tint and "Too dark to read"; no bars | bars shown in Darkness departments only | everywhere | HUD manifest |
| Lantern toggle | auto-flash on read only | manual toggle appears in Dim or Dark rooms | – | HUD manifest |
| Tiptoe | hidden | shown in Guarded and Darkness departments | – | HUD manifest |
| Noise | the ear glyph only | the last action's ring shown by default (fun.md M1(b)) | – | – |
| Staff guards, breaches, Custody | none unless Guarded is primary or secondary; Custody as a single "caught" state | Custody pips | – | content cap; HUD manifest |
| Alarms | room alarm only | department alarm | – | ordinal cap |
| Closing clock | dial plus bell; Lights Down effects off; B ×1.25 (first-visit rule) | full three stages | Directives modify | run count |
| Masterpiece seal | never in the player's first 2 departments ever | seal after the first resolved special | – | count of departments ever |
| Equipment identification | items arrive catalogued; no forgeries | 3-rung ladder (Uncatalogued, Attributed to, By); forgeries at 1 per floor at most | full ladder if kept | run count |
| Consumables | 6 kinds (Consolidant, Catalogue/Index Card, Floor Plan, "Quiet, Please", Re-admission Ticket, Solvent); no harmful drinks in the first 2 departments | all 12 | – | deck filter by run count |
| Sketch | hidden | with the Copyist (run 2); universal page for all from the first Copyist run | – | class unlock |
| Perks | 1 of 3 at the Certificate, 1-line text | – | ranks | – |
| Loan Desk, fellow visitors, Docent | none | yes | – | run count |
| Placard detail | title, primary icon, Masterpiece form | plus secondary icon, size, rewards | plus Atlas marks | run count |
| Stair Hall | guided first visit; Appointment | – | Master Key | – |
| Accession slip | yes, with the one-liner; greyed when no Certificate | Signature-versus-new-kind framing | – | – |
| Your Loan | – | yes (M) | – | 1 accession |
| Gift Shop | shutters down (M) | 10 items | 20 | – |
| Atlas messages | hidden until the first visit to the Reading Room | – | – | – |
| Special Exhibition doors | not before floor 2 (D already) | – | – | – |
| Directives, Today's Exhibition, Late Opening | – | – | after the first escape (M, D) | – |
| Lost Property, lenses | – | – | v1.x (M) | – |
| Accessibility settings (Patron, readable text, auto-expand strip, colour patterns, reduced motion) | **all available from the first screen** | – | – | never gated |

**Cost.**
- A HUD manifest, derived from the department spec at load: about a day.
- Ordinal-I content caps, as one more S2 validator.
- A run-count filter on the consumable deck and on the forgery rate. The balancer must calibrate ordinal-I departments under these settings, which it would do anyway, because ordinal I is only ever drawn early.

---

## 9. Accessibility checklist

| Area | Issue | Fix |
|---|---|---|
| Colour | Reserved hues collide; tags are colour-only on moving sprites (M8) | ≤ 6 semantic hues; shapes everywhere; CVD lint |
| Text size | One pixel font at 16 CSS px | Three sizes; a readable-font setting (m8) |
| Reading load | About 1,700 words per department; riddle Essentials (M3) | Keeper's note row; non-modal short banners; auto-expand the strip rather than auto-open the sheet (C8c on a phone covers the world) |
| Hearing | Audio-only schedule cues (M5) | Visual twins; captions; HUD timers |
| Vision and attention | Off-screen threats (M4) | Edge markers; auto-pan; zoom |
| Motor | Top toggles; swipes; confirmations; no "wait until" (M9) | Bottom bar; context button; smarter confirmations |
| Cognition | 18+ glyphs from minute 2; overloaded words (B1, M7) | Disclosure plan; glossary; tappable glyphs |
| Photosensitivity | Flashes, cycling, glints (m9) | A reduced-flash setting |
| Time pressure | None in real time, which is good. The turn clock is invisible in its effects | Stage effects in one line; Rest shows its cost |
| Difficulty | Patron timing and model contested (m5) | From run 1 in Settings, unstigmatised (D §9 wording) |
| Screen readers | The world is canvas; labels are DOM | Out of scope for v1. Note that the DOM label layer could serve a "describe what's near" list later |

---

## 10. Cheap tests before building

1. **Strip paper prototype.** Render S's 56 real titles in Tiny5 at 2× into a 390-px strip with state, pips and three glyphs. Count how many show rung and medium (my arithmetic says almost none).
2. **Glyph recognition.** P §9 already plans a placard test. Extend it to the core trigger and state glyphs at 8×8 and 12×12. Five naive players match each glyph to its meaning, with a target of ≥ 80%. Expect the three eye glyphs to fail.
3. **Five-second HUD test.** Show the department-entry screen for 5 seconds and ask what each element means.
4. **Think-aloud first run** (5 players, phones, sound off) through the Orientation Gallery and one sample department. Measure turns per minute, which also settles L-D1 and the run length.
5. **CVD contact sheets** of every reserved pair, through simulation filters.

---

## 11. Decisions for Julian from this lens

| # | Question | Lean |
|---|---|---|
| NP1 | Stage the in-run surface (disclosure plan, §8) or show everything from run 1 | Stage it: Orientation Gallery, HUD manifest, ordinal-I caps |
| NP2 | Visibility of triggers and tags on a first meeting | Always visible; the Catalogue adds the rest (M1) |
| NP3 | A plain "keeper's note" row under deadpan labels | Yes, default on in runs 1–3 (M3 (a)) |
| NP4 | Observation and facing | 360° vision; redefine `unobserved_motion` around line of sight and darkness (M6 (a)) |
| NP5 | A first-department rule (no seal, gentler clock, ≤ 3% death for first-timers) | Yes, as fixed onboarding, not adaptation (M2) |
| NP6 | One semantic palette of ≤ 6 hues; tags by shape | Yes (M8) |
| NP7 | A naming pass (Loan, Catalogue, Guard, Exhibition, After) | Yes, per the M7 table |
