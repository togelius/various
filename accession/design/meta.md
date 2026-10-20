# Meta-progression: what persists between visits

*ACCESSION design document, section: meta-progression. Draft 1, 2026-10-20. Written inside the direction memo (`direction.md`). Research is cited only from the briefs in `research/`: RS = `roguelike-systems.md`, LM = `literature-museology.md`, PS = `papers-semantic.md`, TA = `tech-art.md`. Sibling drafts: CS = `design/core-systems.md`, V = `design/vocabulary.md`, P = `design/pipeline.md`. Every number below is a first estimate for the persona simulator or for playtests to move. Where a claim about another game rests on general knowledge rather than a brief, it says so.*

**What this section owns:** Accession and Your Collection; the Loan slot; the Catalogue and the Atlas; the hidden Venice and the Founder's cabinet; Stamps and the Gift Shop; Patron membership; death as an exhibit, Lost Property, the Donor Wall, conduct feats, badges and Today's Exhibition; the meta side of Commissions; the recurring cast; persistence and save migration.

**What it borrows:**
- Trustees' Directives (heat): the difficulty section. This section only states what it needs from them (§9).
- Certificates, Restoration kits, coins, the attribution ladder, forgeries, classes, the Registrar NPC, death and retirement rules: CS.
- Item kinds, primitives, budgets, families and ordinals: V.
- Accession numbering, credit lines, index cards and Commission realisation: P.
- Door placards, Stair Halls, the sequencer and the Exit: the run-structure section.

---

## 0. Proposals at a glance

| Layer | Proposal | Tier |
|---|---|---|
| **Accession** | On leaving a department through an exit door, holding its Certificate, you may accession one object you acquired there. It is registered into **Your Collection** (a gallery in the Entrance Hall, with a label written from the run) and *lent back to you for the rest of the evening*, so accession costs nothing in the run. If its *kind* is new, the kind enters your ambient pool. | v1 |
| **Kinds and pools** | A base pool of 24 simple kinds (one primitive, no drawback). Complex kinds (two or more primitives, drawbacks, L+ primitives) enter only by accession. Kind unlocking doubles as item-complexity onboarding. | v1 |
| **Loan slot** | One object from Your Collection per run: fully catalogued, Restoration +0, budget capped at 4, re-mounted to each floor's base tier at the Stair Halls. If you die, it goes "into conservation" and cannot be lent on the next run. | v1 |
| **Catalogue** | Every department, exhibit species, object, kind skin, Masterpiece and NPC you meet. Species climb Sighted → Observed → Documented, which changes what the examine panel shows on later runs. Knowledge also transfers by behaviour archetype. | v1 |
| **Atlas** | Family × ordinal grid (6 × 4 = 24 cells at launch). A cell is charted by earning a Certificate in it. Charting ordinal *k* of a family opens ordinal *k*+1 of that family to the sequencer. | v1 |
| **Hidden Venice** | "Object zero": one small brass key with a paper tag in every department, number `<dept>.0`, the same physical description everywhere and a different label in each. Collecting 12 readings from at least 5 families opens the Founder's cabinet behind a hinged panel in the Entrance Hall. | v1 |
| **Stamps and the Gift Shop** | Stamps on your visitor's card, earned only by Certificates, escapes and first-time discoveries. Redeemed in the Gift Shop for **options, not power**: 20 items, fixed prices (total 260 Stamps), full refunds, every item toggleable. An endless cosmetic sink: memorial benches. | 10 items in v1, 20 in v1.x |
| **Patron membership** | An opt-in assist: Friend, Member, Fellow, Patron. You rise a tier by dying while a member (God Mode's shape, RS F15), can dial down at any time, and can unlock all tiers at once in the accessibility settings. The user's "minor stat bumps" live here. Every assisted run says so on its labels. | v1 |
| **Trustees' Directives** | The mastery ladder, owned by the difficulty section. Meta supplies the hooks: unlock after the first escape, Stamp bounties for first clears, Restricted Wings as an Atlas column. | v1.x |
| **Record of visits** | Death label "Figure of a Visitor, Reaching (Run 14)" with the build; the latest figure stands in the Entrance Hall and in the room where you fell if that department recurs; the Donor Wall lists every visit; 12 Brogue-style conduct feats; Long Service badges that unlock classes; a daily "Today's Exhibition" seed. | v1 (feats, badges, death, wall); v1.x (daily, Lost Property) |
| **Lost Property** | One object from your last death, handed in by the night staff, claimable for a coin fee at the floor-1 Stair Hall of the next run, at half its Restoration levels (cap +2). | v1.x |
| **Commissions** | Index cards (P §8) recorded from v1. v1: a "loan request" that guarantees a matching Permanent Collection department as a door next run. v2+: generated commissions. | v1 record, v2 generate |
| **Cast** | Three role-named voices, no plot: the Guard at Post One (remembers your runs), the Registrar (accessions; the final encounter), the Gift Shop clerk. About 8,000 words, mostly templated on run data. | v1 |
| **Persistence** | Versioned meta JSON (about 30 KB at run 30) in two alternating localStorage slots with checksums, mirrored to IndexedDB; the run saved as snapshot plus action log; `persist()`, a PWA manifest, a ~195-character visitor's card code and a full archive file; pure, fixture-tested migrations. | v1 |

---

## 1. What the meta is for, and the rules it keeps

### 1.1 Five jobs

1. **Every run pays something.** A 25-minute death in department 2 must leave a trace: an accession, a Catalogue page, an Atlas cell, a figure in the Entrance Hall, a few Stamps.
2. **Complexity arrives gradually.** Ordinals open family by family (Atlas), complex item kinds open by accession, classes open by milestones. Power does not grow; the game gets *wider*.
3. **A long chase exists that is not a power curve.** The Atlas, the Collection, the Directives ladder, object zero, conduct feats.
4. **Self-evaluation stays clear.** A player who wins should know whether they got better. The forum complaint that power meta makes it "hard to tell whether you're skilled or just under-leveled" (RS F20, community sentiment) is the failure to avoid.
5. **The meta is museal.** It is made of accession, registration, loans, conservation, membership, donor walls, lost property and catalogues, which are things a museum actually does (LM §3.1).

### 1.2 Invariants

1. **The default run's power curve is fixed by run depth** (pillar 4). The only meta channels that change in-run power are the Loan slot, Lost Property and Patron membership, and each has a measured budget (§1.3).
2. **Every assist is visible** on the run's death or escape label and on its Donor Wall line.
3. **No reward comes from an activity that is low-risk, slow and repeatable.** DCSS's definition of grinding, "activities that have low risk, take a lot of time, and bring some reward… it may be optimal to do so" (RS F12), is the test for every Stamp source.
4. **Run 1 is winnable.** No gate stands between a new player and the Exit.
5. **No meta state is required to see the Permanent Collection.** Ordinal gating is onboarding, opened by play, never by purchase.
6. **All meta state is local, exportable, and migrates forward** (§14).

### 1.3 The power budget, measured

The persona harness (CS §14; RS F21) already simulates whole runs headless. Meta power is therefore a measured quantity, not a guess.

| Channel | Cap | How it is measured | If exceeded |
|---|---|---|---|
| Loan slot | +6 percentage points on the median persona's clear rate, best loan vs none; ≤3 pp change in death rate at run positions 1–2 | 2,000 seeded runs per class, with the 10 strongest loanable kinds | The kind is flagged **Not for loan** ("too fragile to travel", §5.2) |
| Lost Property | +3 pp clear rate on the run after a death | Last-death item drawn from the persona's own previous run | Halve again, or cut (§10.2) |
| Each Gift Shop item | within ±2 pp | With and without the item, same seeds | Moves to Patron membership, or is redesigned |
| Patron tiers | Target hazard multipliers for the Cautious-novice persona: Friend ×0.8, Member ×0.65, Fellow ×0.5, Patron ×0.35 per department | Survival analysis on per-department death (Isaksen et al., RS F21) | Retune tier numbers |
| Catalogue knowledge | No cap; it shows only what an attentive player would remember | – | – |

This turns "options, not power" from a slogan into a CI number, which also makes the meta a small research contribution: a roguelite whose meta-power budget is declared and tested.

---

## 2. Evaluating the candidates

### 2.1 Criteria

| Criterion | Question | 5 means |
|---|---|---|
| Replay value | Does it give a reason to start run N + 1? | A strong, long pull |
| Trivialisation safety | Does it leave late runs as hard as intended? | Runs are untouched |
| Self-evaluation clarity | Can the player tell skill from accumulated power? | Perfectly clear |
| Works without a story | Does it need characters, dialogue and plot to function? | Needs nothing |
| Implementation cost | Effort for us, with this codebase | Cheap |
| Museum fit | Does it read as something a museum does? | Native to the fiction |

Scores are judgements, argued below. They are not summed, because the criteria are not equally important: trivialisation safety and self-evaluation are close to hard constraints under pillar 4, while museum fit is the tie-breaker.

### 2.2 Scores

| Model | Replay | Safety | Self-eval | No story | Cost | Fit |
|---|---|---|---|---|---|---|
| **U1** Keep one item per department, literally (all kept items start the next run) | 3 | 1 | 1 | 5 | 4 | 4 |
| **U1′** The same idea as Accession (Collection + kind unlock + one Loan) | 4 | 4 | 4 | 5 | 3 | 5 |
| **U2** Minor stat bumps, permanent and mandatory | 2 | 2 | 1 | 5 | 5 | 2 |
| **U2′** Stat bumps as opt-in Patron membership | 2 | 5 | 4 | 5 | 4 | 4 |
| **U3** Vampire Survivors PowerUp store, as in VS | 4 | 2 | 2 | 5 | 4 | 3 |
| **U3′** The same store selling options (Gift Shop) | 3 | 4 | 4 | 5 | 3 | 5 |
| **Hades** (whole meta) | 5 | 3 | 3 | 1 | 1 | 3 |
| **Dead Cells** (blueprints, cells, Boss Stem Cells) | 4 | 4 | 4 | 5 | 3 | 4 |
| **Isaac** (achievement unlocks into source pools) | 5 | 4 | 4 | 5 | 2 | 3 |
| **Balatro** (decks and cumulative stakes) | 4 | 5 | 5 | 5 | 4 | 3 |
| **Spelunky** (knowledge; shortcuts paid in run resources) | 3 | 5 | 5 | 5 | 5 | 2 |

### 2.3 Notes

**U1, literal.** The strongest fantasy in the brief: you leave with a museum's worth of loot. Taken literally, an 8-department run would hand the next run up to 8 items, and two runs later the early departments are trivial. It is also undefined when a department never recurs, because the item's identity is tied to it. ITB shows the safe version of the idea: keep *one* surviving pilot (RS F13). The idea is good; the number is the problem.

**U1′, Accession.** Keeps the collecting fantasy, moves the power into a single bounded slot (the Loan, after Hades keepsakes and the ITB pilot, RS F13, F15), and turns the rest into variety (Dead Cells, Isaac, RS F16–F17) and display. It needs a Collection gallery, label templates and a kind registry, hence cost 3.

**U2, mandatory stat bumps.** Cheap and effective at making players feel progress, which is why Rogue Legacy is built on it (RS F19: "pure power creep, made palatable by traits"). Against it: it is cumulative, it blurs self-evaluation (RS F20), and DCSS's "invincible state" warning applies (RS F12). Once given, it is hard to take back. It also does not mean anything in a museum.

**U2′, Patron.** The same bumps, opt-in, labelled and reversible. Hades frames God Mode as reducing "the sting of failure", and Kasavin says such settings "may need to be proprietary to the game" (RS F15). Membership is our proprietary version. It has little replay pull on its own, which is fine: it is an assist, not a goal.

**U3, VS store.** The VS shop's good parts are mechanical: escalating prices (`InitialPrice × (1 + Bought) + floor(20 × 1.1^TotalBought)`), a full refund, and per-item toggles for maxed PowerUps (RS F18). Its content is stat power. In a 70–90 minute tactical run, a stack of +X% buffs would do what U2 does, faster.

**U3′, Gift Shop of options.** Keep VS's refund and toggle, drop the escalation (it exists to make the order of power purchases matter; ours sells options), and sell things that widen the run: start-of-run desk choices, alternate kits, pool shaping, lenses, modes. It needs real content per item (cost 3) and must pass the ±2 pp check (§1.3).

**Hades.** The best-integrated meta in the genre. Its non-story parts transfer intact: door previews that show persistent rewards, keepsakes, the Pact as a heat ladder with first-clear bounties, God Mode (RS F15). Its relationship and dialogue meta does not, and the user already says "we can't muster" the storyline. The permanent power upgrades it sells for Darkness (general knowledge) make it a 3 on safety. Scored as a whole it needs a writing team; scored by parts, we take four of them.

**Dead Cells.** "Unlock into the pool, not into the stats" (RS F16). Blueprints are lost if you die before delivering them to the Collector, which gives each one stakes. Boss Stem Cells raise difficulty *and* open routes and raise loot quality. Its fixed-world shortcuts do not transfer to random department order. Accession is its blueprint system with the Collector at every exit door.

**Isaac.** Pools by source, removal on touch, fallback to a joke item ("Breakfast"), and achievements that add items (RS F17). Strong long-term replay. The cost is in authoring hundreds of unlock conditions. Pools by source map onto departments; our joke fallback is the gift-shop Postcard (CS §11).

**Balatro.** Variety and a difficulty ladder, nothing else: eight cumulative stakes per deck, decks unlocked by winning stakes (RS F19). The clearest self-evaluation of any model here. It is close to what Directives plus class kits already do. Its fit is neutral: stakes are a card-table idea; Directives are the museal version.

**Spelunky.** No power meta at all; the Tunnel Man builds shortcuts across three visits, paid in bombs, ropes, money or items (RS F19). Perfect clarity and very cheap. Shortcuts need a fixed world, which random department order does not have, and pure knowledge meta loses casual players, which is why it scores 3 on replay for this audience. Its lesson survives in the Catalogue.

### 2.4 What we take from each

| Source | Taken | Where |
|---|---|---|
| User idea 1 | One object per department, kept | Accession (§4) |
| User idea 2 | Minor stat bumps | Patron membership (§8) |
| User idea 3 | A store with refunds and toggles | Gift Shop (§7) |
| Hades | Keepsake → Loan; God Mode → Patron; Pact bounties → Directives; persistent-reward icons on doors → Atlas marks on placards | §5, §8, §9, §6.3 |
| Dead Cells | Unlock into the pool; heat that opens routes | §4.4, §9 |
| Isaac | Pools by source over a global fallback | §4.4 |
| Balatro | Classes and kits unlocked by playing, a clean ladder | §10.5, §9 |
| Spelunky | Knowledge as the main persistent asset | §6 |
| Brogue | Conduct feats with no power | §10.4 |
| SPD | Badges, seeds, a daily | §10.5–10.7 |
| ITB | Exactly one carried slot | §5 |

---

## 3. The layered meta

### 3.1 Layers and tiers

| Layer | What persists | v1 | v1.x | v2+ | Dev cost (unmeasured estimate) |
|---|---|---|---|---|---|
| Accession + Your Collection | objects, labels, kind unlocks | yes | rehang, storage search | TX/CM objects | 5–7 days |
| Kind registry and pools | unlocked kinds | yes | Deaccession List | – | 2–3 days |
| Loan slot | which object, conservation state | yes | – | – | 1–2 days |
| Catalogue | knowledge levels, records | yes | archetype pages | – | 4–6 days |
| Atlas + ordinal gating | charted cells | yes | Restricted Wings column | Commissioned Wing page | 2–3 days |
| Object zero + Founder's cabinet | readings | yes | final ledger page | – | 2–3 days + writing |
| Stamps + Gift Shop | balance, owned, toggles | 10 items + benches | 20 items | Commission fees | 4–6 days |
| Patron membership | tier, deaths as member | yes | – | – | 1–2 days |
| Death label, figures, Donor Wall | run rows, last 12 figures | yes | filters | – | 2–3 days |
| Feats and badges | bitsets | 8 feats, 12 badges | 12 feats | – | 2–3 days |
| Lost Property | one object | – | yes | – | 1–2 days |
| Today's Exhibition | last 30 results | – | yes | – | 1–2 days |
| Commissions | index cards; one open commission | record cards | loan request | generated | 1 day (v1.x) |
| Cast barks | line cooldowns | yes | more lines | – | 2–3 days + writing |
| Persistence | everything | yes | – | sync? | 4–6 days |

v1 total: roughly 30–45 developer-days on these estimates, which is why the cut line (§17) matters.

### 3.2 The Entrance Hall

The hub is one walkable room, about 24 × 14 tiles, with every station also on a hotkey. It is where meta state becomes visible as museum.

```
 +------------------------------------------------------------------+
 |  DONOR WALL  (every visit engraved; escapes larger)               |
 |                                                                  |
 |  YOUR COLLECTION           RECENT ACQUISITIONS      READING ROOM  |
 |  24 vitrines on view       (latest death figure)    Catalogue     |
 |  [store room list]                                  ATLAS wall    |
 |                                                                  |
 |  GIFT SHOP          STAFF NOTICEBOARD        INFORMATION DESK     |
 |  Stamps; benches    classes, feats,          start a visit: class,|
 |                     badges, Directives       desk option, Loan,   |
 |                                              Membership, daily    |
 |  CLOAKROOM (Loan ticket)       [hinged panel]   MAIN STAIR ->      |
 +------------------------------------------------------------------+
```

- **Restart friction is low.** Death label → [Another visit] → Information Desk dialog with last run's class, desk option and Loan pre-filled → [Enter]. Three taps or keys. Walking the hall is optional.
- **The Cloakroom** issues the Loan as a numbered ticket; the Loan "is collected from" and "returned to" it. This gives the cloakroom in LM §3.1 a job without adding a second survival-insurance system.
- **The hinged panel** is the Founder's cabinet (§6.4), a Soane Picture Room wall (LM F16). It looks like any other panel until opened.
- **Gift Shop shutters** are down on the first visit ("Opens after your first visit"), so the first screen has four things to look at, not eight.

---

## 4. Accession and Your Collection

### 4.1 The rule

When you pass through a department's exit door, and you hold that department's Certificate, the **Registrar's slip** appears. You may accession **one** object you acquired in that department. It is:
1. **registered** into Your Collection with a number `YC.n` (P §6.3) and a label written from the run (§4.5);
2. **lent back to you** for the rest of the evening: its credit line becomes "Accessioned YC.31; on study loan to the visitor". You keep using it. Nothing is lost in the run;
3. if its **kind** is not yet in your pool, the kind enters it (§4.4).

The accession is committed to storage the moment the slip is signed (§14.3). A later death does not undo it.

### 4.2 Eligibility

| Object | Eligible? | Reason |
|---|---|---|
| Equipment (weapon, garment, curio, instrument) acquired in this department: found in a case, bought at the coda kiosk, traded with a fellow visitor | **Yes** | Provenance is this department |
| The department's Signature piece (P's `keepable`) | **Yes** (CS §6.5) | Prestige object; see §4.4 for its special pool rule |
| Equipment found in an earlier department and carried out of this one | No | Otherwise you would accession your best item every time. Provenance must be this department (see Challenges, item 6) |
| Loan Desk items ("On loan from…") | No | "The lender would object." |
| Your meta Loan | No | It is already yours |
| A claimed Lost Property object | No | It did not come from a department |
| Consumables | No | Twelve fixed kinds; nothing to unlock. "The Museum does not accession perishables." |
| Restoration kits, Clearance cards, Certificates | No | Economy anchors (V §5.5) |

**No Certificate, no slip.** The Certificate is earned by defeating *or viewing* the Masterpiece (CS §5.4), so sneaking players accession too. A player escorted out by the Night Watch has no Certificate and no slip. Retiring with the Certificate (CS §12) lets you sign the slip at the Main Exit.

### 4.3 The Registrar's slip

```
 REGISTRAR'S SLIP  ·  Department of Instruments That Keep Time Badly  ·  M.7
 ---------------------------------------------------------------------------
 [1] Pocket Watch, Running Slow      curio   clock_extension M · ticking   NEW KIND
 [2] Regulator's Winding Key  +2     weapon  blunt M · knockback S          in pool
 [3] The Ninth Regulator's Repeater  curio   (Masterpiece defeated)          SIGNATURE
 ---------------------------------------------------------------------------
 [4] Not tonight
 Each object is registered and lent back to you for the rest of the evening.
```

- Every option is shown fully catalogued; the Registrar catalogues on registration, so the choice is never blind (Brogue auto-ID, RS F4).
- **NEW KIND** marks a kind that would enter your pool. **SIGNATURE** marks a Signature piece.
- A hidden forgery is revealed on the slip, before you choose (§4.7). The reveal does not use up your choice.
- "Not tonight" is always available. The Registrar notes it in one line and nothing else happens.

### 4.4 Kinds and pools

**What a kind is.** A kind is an item's mechanical identity: category, form (for weapons and garments, CS §6.3), primitive ids with magnitude classes, and drawback, from V §5. "Pocket Watch, Running Slow" and a Tides department's "Damp Hygrometer, Slow" share the kind `curio/clock_extension.M+ticking`. Kinds get permanent integer indices in an append-only registry (§14.6).

**The pools.**

| Pool | Holds | Used for |
|---|---|---|
| Department pool | The department's own pack items (about 4) | Its own ambient equipment and cases. Always on view in their department, locked or not |
| **Base pool** | 24 authored simple kinds: 6 per category, one primitive each, no drawback | Ambient equipment from start |
| **Your pool** | Base pool + every kind you have accessioned | Half of each department's ambient equipment slots; one of the three Loan Desk offers; kiosk curios |

- Each of a department's 3 ambient equipment drops (CS §6.6) comes from its department pool or from *your* pool with equal chance; drops from your pool are reskinned by the department's grammar (P §6.2).
- **Complex kinds are locked at the start**: anything with two or more primitives, a drawback, or an L+ primitive. A new player meets them inside their own departments (on view, at their department's frequency) and pulls them into every department by accessioning them. Locking is therefore item-complexity onboarding, not an arbitrary carrot.
- **Visible effect.** When an unlocked kind appears in a later run, its tombstone carries a cross-reference: "cf. YC.31, Your Collection". The museum notices your collection. One of the three Loan Desk offers is drawn from your accessioned kinds whenever you have any.
- **Signature pieces** do not enter any pool; they stay unique to their department. Accessioning one gives a prestige vitrine and the strongest Loan candidates (§5). This makes the slip a real choice: a Signature piece (a better Loan) or a new kind (more variety in every run).
- **Dilution** is controlled by the Gift Shop's Deaccession List (banish up to 3 kinds, §7.3) and by weights: base kinds weight 2, unlocked kinds weight 1 until accessioned a second time, then 2.

**How many kinds exist.** A 30-department pack has about 120 department items and 30 Signature pieces. Many collide on the same tuple; I estimate 70–90 distinct department kinds plus the 24 base kinds (unmeasured; the S7 pack build should print the number). With at most 8 accessions per run and roughly half of them new early on, an average player has unlocked about 60% of the pack's kinds by run 30.

### 4.5 Labels written from the run

The Collection label has the museum's tombstone fields (LM F21, F25) plus a provenance paragraph built from the run's event log.

**Tombstone template**

```
[object name]
[maker, at rung 5] · [date grammar] · [medium] · [dimensions]
Acquired in Run [r] from the Department of [title] ([dept number]), Room [room].
Gift of the Visitor (Visitor [visitor number]) · YC.[n]
```

**Provenance paragraph**, 2–4 sentences from slots:

| Slot | Chosen from | Example fragment |
|---|---|---|
| Carried | departments carried through after accession | "Carried through four departments (M, T, L, K)." |
| Notable event | the highest-salience event in the run log involving the object | killing blow on a Masterpiece (10): "It stopped the Committee of Clocks in Room 430 on the third swing." · saved the visitor at low HP (8) · caused an alarm (6): "It was the reason for the alarm in Room 507." · drawback woke an exhibit (5): "Its ticking woke an Escapement Hound in Room 415." · restored twice or more (4) · worn past the First Bell in 3+ departments (3) |
| Fate | how the run ended | escape: "It left the building with the visitor shortly before dawn." · death: "It was recovered from Room 517 the next morning, beside the visitor." · retirement: "It was escorted out with the visitor." |
| Loan history | appended later | "Lent for Run 15; returned in Fair condition." |

About 30 event templates with 2–3 variants each, authored once and linted with the pipeline's banned list (P §3.7).

**Worked example.** Run 14, Night Guard, department 4 is *Instruments That Keep Time Badly* (M.7). The player views the Masterpiece (Certificate, no Signature piece), leaves through the east door, and accessions the Pocket Watch. The player dies in Room 517, in the next department.

> **Pocket Watch, Running Slow**
> Workshop of the Guild of Regulators, Lower Horology · After the Second Calibration · Brass, enamel dial, one hand replaced · D. 5 cm
> Acquired in Run 14 from the Department of Instruments That Keep Time Badly (M.7), Room 412.
> Gift of the Visitor (Visitor 40211) · YC.31
>
> Carried through two departments (M, T). Its ticking woke an Escapement Hound in Room 415, which is recorded here without comment. It was recovered from Room 517 the next morning, beside the visitor.

The kind `curio/clock_extension.M+ticking` was new, so it enters the pool; the slip had marked it NEW KIND.

### 4.6 Exploit guards

| Exploit | Guard |
|---|---|
| Rush in, grab a case item, leave, repeat | No Certificate, no slip. A Certificate costs a Masterpiece encounter under the closing-time clock |
| Retire immediately after the first department to bank its pick | Retirement keeps the current department's pick only with its Certificate (CS §12); and one accession per run from department 1 is all it buys |
| Always accession your best weapon | Only objects acquired in *this* department are eligible |
| Build a super-item across runs | Accessioned objects are stored at +0; Loans arrive at +0, budget-capped and depth-normalised (§5.1) (RS pitfall 12) |
| Farm a known easy seed | Custom-seeded runs are Practice visits: no accessions, no Stamps (§10.7) |
| Reload to change a pick | The slip commits on signing; the run save is an action log with no earlier state to return to (§14.3) |
| Two tabs, two runs, double accessions | One active run per browser profile (§14.7) |

### 4.7 Forgeries

Forgeries are the curses (CS §7.4). On the slip:
1. A hidden forgery is revealed: "On examination, this is a forgery. The Registrar will accept it as a copy." You may pick something else.
2. If you accession it anyway, it enters Your Collection as *After [maker] (forgery, accessioned as a copy)* in a separate **Copies and Forgeries** case. Its credit line keeps the run, its condition is "Good, as a copy".
3. **Its kind does not unlock.** The Registrar will not register a type on the evidence of a fake.
4. It can be lent: it arrives as an honest copy (no hold, no defect, CS §7.4), at +0.
5. **Five accessioned forgeries** open the **Chamber of False Things** (Barnum's room, LM F10): a cosmetic room off Your Collection, and the Connoisseur's Loupe lens enters Gift Shop stock (§7.3). Players who enjoy the forgery game get a reason to keep fakes.

### 4.8 Departments that never recur

Accession never depends on a department coming back, because the reward is a *kind* (closed vocabulary, reskinnable anywhere) plus an object in your own gallery.

| Case | Handling |
|---|---|
| A Permanent Collection department that simply has not been drawn again | Nothing to do. With N = 30 and 8 departments per run, each department is drawn about every 4 runs (P §1.5) |
| A department **deaccessioned** from the pack in an update (P status `deaccessioned`) | Collection objects store a frozen name and tombstone (≈120 bytes each). The label adds "(since closed)": "Acquired in Run 14 from the Department of Rain Kept Under Glass (since closed)". The Atlas cell stays charted |
| A **Temporary Exhibition** (v2), which may never be served again | The whole label is frozen into IndexedDB (≤1 KB per object). Its kind works anywhere. TX departments sit on a separate Atlas page and do not count toward ordinal gating |
| A **Commission** (v2+) | Joins your Commissioned Wing page; recurs at normal weight (P §8.3) |
| A **retired vocabulary id** | The kind migrates to its alias (V §11.5); the object's label is unchanged |

### 4.9 Edge cases

- **Two eligible objects of the same new kind:** either unlocks it.
- **Accessioning an already-unlocked kind:** allowed. The object joins the Collection; its kind weight rises to 2 (§4.4). No Stamp.
- **Accessioned object later destroyed in the run** (a `fragile` item breaks): the Collection object is unaffected. Its label adds "Damaged beyond repair in Room 503; the Museum keeps the registration and the pieces."
- **Death after the Certificate, before the exit door:** no slip for that department. The coda between the Masterpiece and the door is short; the stake is deliberate (Dead Cells' blueprints are lost if you die before the Collector, RS F16).
- **Capacity.** The gallery shows 24 objects on view (36 and 48 with the Benefactor badges, §10.5). The rest are listed in the Store Room and can be rehung. Storage holds 500 objects; beyond that, the oldest duplicates of a kind are "transferred to the Study Collection" (kept as a count).

### 4.10 Decisions

**M1. What does accession cost in the run?**
- (a) **Nothing: registered and lent back (lean).** *A free choice about variety; the user's "keep one item" without any loss.*
- (b) The object is handed over and leaves the run. *A sharp tradeoff, but players will accession junk, and the Collection fills with junk.*
- (c) Provisional until escape, lost on death (Dead Cells). *Strong stakes, but most early runs would bank nothing, which breaks job 1.*
- *Lean (a)*, because the slip is already a real choice (Signature piece vs new kind), and the run should not be punished for feeding the meta. *If (b):* the Loan becomes more important and Signature pieces should be exempt from the hand-over. *If (c):* accession moves to the Main Exit and the first-hour table in §13 loses its accessions.

**M2. Eligibility.**
- (a) **Certificate required; objects acquired in this department (lean).** *Clean provenance, no farming, stealth included via viewing.*
- (b) No Certificate required. *Kinder to early leavers; invites the rush-and-retire loop.*
- (c) Certificate and rung 5 required (the hook in CS §19). *A museal rule (no uncatalogued accessions), but it adds a cataloguing chore before every exit.*
- *Lean (a).* The slip catalogues the object, so rung 5 comes for free. *If (c):* the Registrar's free catalogue (CS §11) becomes mandatory play, and Catalogue Card weight should rise.

**M3. Are kinds locked at the start?**
- (a) **Base pool of 24 simple kinds; complex kinds unlock by accession (lean).** *Onboarding plus a visible reason to choose.*
- (b) No locking; accession is Collection and Loan only. *Simplest; the slip loses most of its weight.*
- (c) Isaac-style: most kinds locked behind achievements. *Long chase; a hundred unlock conditions to author.*

---

## 5. The Loan slot

### 5.1 The rule

One object from Your Collection per run, chosen at the Information Desk and issued by the Cloakroom.

| Property | Rule | Why |
|---|---|---|
| Attribution | Rung 5, fully catalogued, credit "On loan from Your Collection" | Never an uninformed choice (CS §7.5) |
| Restoration | +0, whatever it was when accessioned | No super-item across runs (RS pitfall 12) |
| Budget | Capped at 4 points (V §5.1). A Signature piece (≤5) travels as a **touring version**: its highest-magnitude primitive drops one class | A Signature piece is a strong Loan, not a broken one |
| Tier (weapons, garments) | Arrives at the base tier of floor 1. At each Stair Hall the Conservator **re-mounts** it to the next floor's base tier, keeping Restoration levels applied this run | A +0 tier-1 weapon is dead weight by department 4; the base tier stays below the best finds of that floor |
| Ranks (curios, instruments) | Rank 1; Restoration raises them as usual | – |
| Handling Clearance | Recomputed by the balancer for the mounted tier | A loaned heavy weapon is never unusable at the start |
| Count | 1. A second slot exists only at the Patron tier (§8) | ITB's "exactly one" (RS F13) |
| Not available | Today's Exhibition; under any Directive that forbids Loans. In Practice visits a Loan never goes into conservation | Comparability |

### 5.2 Not for loan

Kinds whose measured Loan effect exceeds the budget (§1.3) carry a museum line instead of a balance patch: **"Not for loan: too fragile to travel."** They stay in your Collection, on view, and still count toward kind unlocks. Expect 5–10% of kinds to be flagged on the first balance pass.

### 5.3 Risk on death

**M4. What happens to the Loan if you die?**
- (a) Nothing; it returns safely (Hades keepsakes). *No stakes; cheapest.*
- (b) It is lost for good. *Real stakes; cautious players will stop using the slot, and the best objects never leave the vitrine.*
- (c) **It goes into conservation for one run (lean).** Unavailable on the next run; any other object can be lent. *A small stake, no permanent loss, and a line of history on its label.*
- (d) It goes to Lost Property and must be reclaimed next run. *Interesting, but it merges two systems and makes the Loan slot do double duty.*
- *Lean (c).* It is museal (condition reports, conservation), the stake is felt, and the slot stays in use. A Directive "Uninsured Loans" can make loss permanent for players who want (b). *If (b):* add a Gift Shop "Insurance" item and expect Loan usage to fall. *If (a):* §10.2 Lost Property becomes the only consequence-of-death system.

### 5.4 Worked example

Run 15. Visitor 40211 lends YC.31, the Pocket Watch, Running Slow.
- Issued at rung 5, +0; budget 1 (clock_extension M = 2, ticking −1) ≤ 4.
- Floor 1: it extends each department's open hours by its M magnitude (+20%, V §5.2) and makes the visitor *ticking*: escapements hunt them.
- The player applies one Restoration kit in department 2 (+1 property rank, CS §8.2).
- Stair Hall 1: the Conservator re-mounts it (curios have no tier; nothing changes), the HUD notes "Loan re-mounted".
- The player dies in Room 523, department 5. YC.31 goes into conservation; its label gains "Lent for Run 15; damaged in Room 523; in conservation." It can be lent again on Run 17.

### 5.5 Measured budget

The Loan is the largest default power channel, so it gets the tightest test: at most +6 pp on the median persona's clear rate with the strongest loanable kind, and at most 3 pp change in death rate at run positions 1–2 (which protects the orientation departments, RS F14). The test runs in CI whenever kinds or the balancer change.

---

## 6. The Catalogue and the Atlas

### 6.1 The Catalogue

Qud's lore only became coherent once players could juxtapose fragments in a journal (PS F15). The Catalogue is that journal, kept by the museum. It lives in the Reading Room as a card cabinet, and opens from the pause menu during a run.

**Sections:** Departments (by family); Exhibits (species, grouped by behaviour archetype); Objects (department items, kinds, Signature pieces); Consumable kinds (each kind's page lists every skin you have seen: "Catalogue Card: also known as Shelf List (Light 1), Tide Table, Annotated (Tides 2)"); Masterpieces; Staff and visitors; Labels (read count per department).

**Three knowledge levels for exhibit species** (PS D8: "a Catalogue that reveals stats on repeat encounters"):

| Level | Reached by | On later runs, the examine panel also shows |
|---|---|---|
| **Sighted** | seeing it once | name, silhouette, tombstone (already shown in-run) |
| **Observed** | seeing it wake twice, *or* opening its full label once | its wake triggers and behaviour tag, before it wakes |
| **Documented** | 3 defeats, *or* 1 completed sketch, *or* seeing its telegraphed special 3 times | its specials' telegraph shapes, its counter tags (V §1.9), and your record (defeats, times it defeated you) |

The Brogue-style odds readout (CS §2.7) is always shown, at every level. The Catalogue adds only what an attentive player would remember, so it has no power budget.

**Knowledge transfers by archetype** (pillar 1). Once two species of an archetype are Documented, every new species of that archetype starts at Observed. The Catalogue's archetype page says so: "Escapements: you have documented 2. New escapements will be recognised." This is the vocabulary's recurrence (V §11.2) made visible.

**Labels read** are recorded per label id, which feeds the Reader badge and object zero (§6.4). Reading costs no time in a run (CS §1.3), so this cannot be ground.

### 6.2 The Atlas

Calvino's Kublai keeps an atlas that "preserves the differences intact" (LM F1). Ours is the family × ordinal grid on the Reading Room wall.

**Grid.** 6 launch families × ordinals I–IV = 24 cells. The ordinal encodes complexity, not power (V §11.3). A cell is **charted** when you earn a Certificate in any department of that family and ordinal. Each cell shows its departments with numbers, the date first charted, your best time, Certificates earned there, and which objects you accessioned from it.

**Ordinal gating, per family.** Charting ordinal *k* of a family opens ordinal *k* + 1 of that family to the sequencer (Calvino's diagonal cascade: a new series starts at #1 while older ones advance, LM F1). Ordinal I is open from the start in every family.

**Pool shape at launch** (coordinate with P §1.7, D-P2): 5 departments per family, ordinals I, I, II, III, IV. Twelve ordinal-I departments are open on run 1.

| After run | Typical cells charted | Departments open to the sequencer |
|---|---|---|
| 0 | 0 | 12 (all ordinal I) |
| 1 | 2 | 14 |
| 3 | 5–6 | 18–20 |
| 10 | 12–14 | 25–28 |
| 20 | 18–20 | 29–30 |
| 30 | 21–24 | 30 |

Twelve departments are enough for run 1, though thin: the run visits 8 of them, and because door offers need about 18 placards, unchosen departments reappear on later placards. The sequencer still places higher ordinals later within a run (run-structure section).

**Extensions.**
- v1.x: a **Restricted** column (ordinal V) opened by Directive thresholds (§9).
- v1.x: later families (Memory, Scale, …) add rows; their ordinal I opens immediately.
- v2: separate pages for Temporary Exhibitions and your Commissioned Wing; neither gates ordinals.

**Completion.** Charting all 24 cells gives the Cartographer III badge and turns the wall into a printable map. No power.

**M5. Ordinal gating.**
- (a) **Per family, as above (lean).** *Onboarding by family; the Atlas fills as a diagonal; a visible chase.*
- (b) No gating; the sequencer only places high ordinals late. *Simplest; new players meet ordinal-IV rules in run 1.*
- (c) Global gating (every family moves up after N Certificates). *Less to read; loses the Calvino cascade.*
- *If (b):* the Atlas is a pure completion grid, and the Uncharted mark carries its whole weight. Today's Exhibition (§10.6) needs no special case.

### 6.3 The Atlas on the placards

Hades marks doors whose rewards persist (RS F15). Our placards (run-structure section) carry two small marks from meta state: **Not yet visited** (a department you have never entered) and **Uncharted** (its cell has no Certificate). Route choice can then serve the long chase as well as the build. The marks never show anything you would not know from your own Atlas.

### 6.4 The hidden Venice: object zero

"Every time I describe a city I am saying something about Venice" (LM F1). Soane invented a resident monk, Padre Giovanni, with his own parlour and sham ruin (LM F16). Our through-line combines the two.

**The object.** Every department, including later families, Temporary Exhibitions and Commissions, contains one study-collection object numbered `<dept>.0` (P §6.3 gives object numbers; `.0` is reserved): a small brass key with a paper tag. Its tombstone's physical fields are identical everywhere: *Brass, paper tag tied with linen thread; L. 6.1 cm*. Its title, maker, date and didactic label are the department's own reading of it:
- in Machines it is a winding key "for a clock that was never built";
- in Tides, the key to a sluice "kept dry by a family for eleven floods";
- in Light, the key to a shutter "that the curators have agreed never to open";
- in Classification, "a key, filed under keys, under brass, and under things that are lost, in three drawers".

**Placement.** Always present, in a study-collection case outside the Masterpiece hall, never secret, never locked above your Clearance. It is not marked. The tells are the `.0` number and the repeated physical description, which a player who learns to read numbers (P §6.3) will notice.

**Readings.** Opening its full label records a reading for that department (persistent, once per department).

| Readings | What happens |
|---|---|
| 6 | The Catalogue gains a page: "An object that appears in more than one department." The Guard at Post One mentions a key, once |
| 12, from at least 5 families | The Directory gains a line: "(x) Cabinet of the Founder. Rooms 0–0. By appointment only." The hinged panel in the Entrance Hall opens |
| every department in the pack | The final page of the Founder's ledger (v1.x) |

**The Founder's cabinet.** A small period room: a desk, a coat on a hook, an umbrella stand, and the **Founder's ledger**, which lists every department you have visited with the key's reading there, in the Founder's hand. The Founder is a fiction inside the fiction, as Soane's monk was: a visitor who stayed past closing long ago and started cataloguing. The last line of the ledger is your visitor number. The tag on the key, read here, says "Spare. Front door." This fits the direction memo's lean that the museum is benevolent but collecting, and that the Registrar wants to accession *you*.

**M6. What does the cabinet give?**
- (a) **Lore, a badge, and the Founder's Key as a lendable curio (lean for v1).** The key is a sidegrade: `perception` S (hinged panels and mimic tells within 2) and one staff door per department opens as if you had the Clearance; drawback `noisy` (it jingles). The Curator class unlocks here when it exists (CS §10). *A payoff that is mostly meaning, with one interesting toy.*
- (b) A class only. *Strong pull; delays the class for players who never find the key.*
- (c) Lore only. *Purest; some players will feel cheated by a secret that gives nothing to play with.*

**Content cost.** One extra label per department (≤70 words) written in S4, plus a validator that the physical fields match the constant. About 30 labels at launch; the ledger text is about 1,200 authored words.

**Calibration.** 12 readings from 5 families is reachable by an attentive player in 2–3 runs and by an inattentive one never. The Guard's hint at 6 readings is the only nudge. If playtests show nobody finds it by run 20, add a second hint at the Information Desk ("A key was handed in. It fits nothing.").

---

## 7. Stamps and the Gift Shop

### 7.1 The currency: Stamps

**Name.** Stamps, on your **visitor's card** (the same card that is exported as a code, §14.5). Museums run loyalty cards; stamps are redeemed at the Gift Shop. Coins stay the in-run currency (CS §11) and never convert: converting them would reward hoarding coins instead of using kiosks and services, which is the habit Rogue Legacy has Charon tax away (RS F19).

**How Stamps are earned.**

| Event | Stamps | Limit |
|---|---|---|
| Certificate earned | 1 | once per department per run (≤8; ≤12 in Late Opening) |
| Escape | 4 | per run (6 in Late Opening) |
| First visit ever to a department | 1 | once per department |
| Atlas cell charted | 3 | once per cell |
| New kind unlocked by accession | 1 | once per kind |
| Conduct feat, first completion | 5 | once per feat |
| Directive bounty | 2 × Directive total, first clear per class (proposal; difficulty section) | once per class per total |
| Today's Exhibition, first attempt of the day, ≥1 Certificate | 2 | once per day |

**What never pays:** kills, coins, labels read, retiring without a Certificate, Practice visits (custom seeds), repeat attempts at the daily, badges.

**Anti-grind reasoning.** Every source is either finite (first visits, cells, kinds, feats, bounties) or gated by a Masterpiece under the closing-time clock (Certificates, escapes). None is low-risk and repeatable (RS F12). Discovery sources are front-loaded, so new players earn fastest when they most need options.

### 7.2 Income model

Unmeasured estimates for a median player:

| Runs | Typical outcome | Stamps per run | Cumulative |
|---|---|---|---|
| 1–3 | die in departments 2–4 | 12–16 | about 42 |
| 4–10 | reach floor 2–3; first escape around run 8 | about 14 | about 140 |
| 11–20 | escape in about 40% of runs | about 13 | about 270 |
| 21–30 | escape in about 50%; Directive bounties start | about 15 | about 420 |

**Run 1 in detail:** died in department 3 with 2 Certificates: Certificates 2 + first visits 3 + cells 2 × 3 + new kinds 2 = 13 Stamps.

**Target.** The full stock (260 Stamps) is affordable around runs 18–22. Nothing in it is needed to win. After that, Stamps go to benches (§7.5) and, in v2, Commissions (§11).

### 7.3 Stock

The Information Desk offers 3 of your unlocked desk options at the start of each run; you choose one. Four are free from the start: **Complimentary Tea** (+1 healing Solution), **Gallery Guide** (+1 Catalogue Card), **Floor Plan** (a Floor Plan for department 1) and **No, thank you** (nothing).

| # | Item | Category | Effect | Price | Stocked when | Tradeoff / power note |
|---|---|---|---|---|---|---|
| 1 | Advance Booking | desk option | The placards of floor 1's three transitions are shown at the start | 8 | from start | Planning, not power |
| 2 | Exchange Desk | desk option | Swap your starting weapon for one of three starting-tier weapons of other forms, catalogued | 8 | from start | Sidegrade |
| 3 | Rain Check | desk option | Start with one exit-kind consumable (CS Re-admission Ticket / V `evacuation_card`); max HP −3 until the first Stair Hall | 10 | after 3 runs | Safety for HP |
| 4 | Members' Preview | desk option | Choose department 1 from three placards | 10 | after 3 runs | Agency |
| 5 | Overnight Bag | desk option | Three unidentified consumables from the run deck instead of your class's identified ones | 6 | from start | A gamble |
| 6 | Dog Watch kit | Staff Supplies | Night Guard: Flash Camera instead of the Torch | 12 | 3 runs as Night Guard | Sidegrade |
| 7 | Plein Air kit | Staff Supplies | Copyist: Window Pole instead of 2 Catalogue Cards | 12 | 3 runs as Copyist | Sidegrade |
| 8 | Bench Kit | Staff Supplies | Conservator: a Glass Cutter instead of the 2 Solvents | 12 | 3 runs as Conservator | Sidegrade |
| 9 | Group Booking | Staff Supplies | Docent: a Tuning Fork (lure) instead of the Whistle | 12 | 3 runs as Docent | Sidegrade |
| 10 | Guidebook, Pocket Edition | Guidebook | Choose 1 consumable kind that starts identified each run | 15 | after 5 runs | Knowledge; check ±2 pp |
| 11 | Guidebook, Revised Edition | Guidebook | A second chosen kind (cap 2 of 12) | 25 | after #10 | Knowledge; check ±2 pp |
| 12 | Deaccession List | Collecting Policy | Banish up to 3 equipment kinds from your pool | 10 | after 20 kinds unlocked | Pool shaping (Isaac removal, RS F17) |
| 13 | Committee Minutes | Collecting Policy | Banish up to 3 perks from Certificate offers | 15 | after 20 Certificates | Pool shaping |
| 14 | Second Opinion | Collecting Policy | Once per run, reroll one Certificate's three offers | 20 | after 20 Certificates | Agency; the item most likely to fail ±2 pp |
| 15 | Connoisseur's Loupe | Lens (one per run) | Forgeries +50%; Inspect costs no time and shows a forgery's defect | 15 | Chamber of False Things open | SPD trinket-style variable tweak (RS F8) |
| 16 | Coloured Lantern Glass | Lens | Ambient light −1 band everywhere; lantern radius +1 | 15 | after 10 runs | Shifts play toward stealth |
| 17 | Busy Evening | Lens | +1 fellow visitor per floor; +1 guard per department | 15 | after 10 runs | More trades, more eyes |
| 18 | Late Opening | Run mode | A 12-department visit (3/3/3/3), its own Donor Wall column | 25 | after first escape | Length, not power |
| 19 | Gallery Refit | Your Collection | Wall, floor and lighting schemes for your gallery (3 each) | 5 | from start | Cosmetic |
| 20 | Exhibition Catalogue | Your Collection | Export your Collection as a printable HTML page with labels | 10 | after 10 accessions | Cosmetic; a sharable artefact |
| | **Total** | | | **260** | | |

**v1 subset (10 items):** 1, 2, 4, 5, 6, 7, 10, 12, 19, plus memorial benches. The rest arrive in v1.x with Directives, Lost Property and Late Opening.

### 7.4 Prices, refunds, toggles

- **Fixed prices.** VS escalates prices with total purchases (RS F18) so that the order of power purchases matters. In an options shop order does not matter, and fixed prices are easier to read.
- **Refunds.** Any item can be returned for its full price between runs: "Returns accepted with receipt." No refunds mid-run. Refunding is free because nothing in stock is power.
- **Toggles.** Every owned item can be switched off at the Information Desk before a run. Lenses are chosen (one or none) per run. Desk options are only offered if switched on. The run label lists the lens and the Guidebook kinds.
- **Persona gate.** Every stock item ships with a measured Δ clear rate (median persona, 2,000 seeded runs with and without). Outside ±2 pp, it moves to Patron membership or is redesigned (§1.3).

### 7.5 The endless sink: memorial benches

**Memorial Bench**, 10 Stamps each, unlimited. A bench appears in the Entrance Hall or, at your choice, in a department's gallery on later runs (benches are already furniture with a regeneration role, CS §8.5), with a plaque written from your history: "In memory of Run 14, who sat here before Room 412." Benches are cosmetic and give a Stamp sink to players who own everything, without escalating prices.

**M7. Gift Shop in v1?**
- (a) None; the memo's "later". *Least work; a run that earns no accession pays nothing but knowledge.*
- (b) **10 items plus benches (lean).** *The user asked for a store; a small one gives every run a payout from day one.*
- (c) All 20. *Complete, but lenses and Late Opening need balance work before launch.*

**M8. Currency.**
- (a) **Stamps from Certificates, escapes and first discoveries (lean).** *Every run pays a little; finite sources resist grinding.*
- (b) Coins convert to Stamps at the Exit. *One currency to think about; rewards hoarding and only pays on escape.*
- (c) No currency; everything unlocks by milestone (Isaac). *No grind possible; loses the store the user wanted.*

---

## 8. Patron membership

### 8.1 Tiers

Opt-in, off by default, joined at the Information Desk ("Become a Member"). Membership is free: assists are never sold.

| Tier | Reached | Damage taken | Open hours (B) | Max HP | Extra |
|---|---|---|---|---|---|
| **Friend** | on joining | −15% | +10% | +2 | – |
| **Member** | after 3 deaths as a member | −20% | +15% | +4 | Members' Lounge: the Stair Hall café heals to full |
| **Fellow** | after 7 | −30% | +20% | +6 | One free exit-kind consumable (Re-admission Ticket) per floor |
| **Patron** | after 12 | −40% | +25% | +8 | A second Loan slot |

- **Growth on failure** follows God Mode's shape (20% resistance, +2% per death, cap 80%, RS F15), in four readable steps rather than a percentage, and with a lower cap, because telegraphed specials (CS §2.4) become trivial at high reduction.
- **Dial down at any time** to any tier you have reached, including off. Tiers reached are remembered.
- **Accessibility setting:** "All membership tiers available" unlocks Patron immediately. Some players need the help on run 1, not after 12 deaths.
- **Damage reduction** is integer: `max(1, floor(damage × (100 − r) / 100))`, applied after Padding (CS §2.2).
- **Open hours** multiply with other clock modifiers (CS §5.1).
- The Information Desk mentions membership once, in one line, after the third death. No pop-up, ever again.

**These are the user's "minor stat bumps".** They are real, small, and only for players who ask for them.

### 8.2 Labelling and what it blocks

- The HUD shows a lanyard in the tier's colour.
- The death or escape label adds "Member's visit (Fellow)". The Donor Wall line says the tier in words.
- **It blocks nothing.** Accessions, Stamps, the Atlas, feats, badges, bounties and the cabinet all work. Today's Exhibition records the tier beside the result. Penalising assisted players for progress would make the assist a trap.

**M9. Patron model.**
- (a) Continuous God-Mode growth (+x% per death). *Smooth; hard to read.*
- (b) Fixed tiers, chosen freely. *Simple; players who need help must choose to ask for more of it.*
- (c) **Tiers earned by deaths while a member, dial down any time, all tiers via an accessibility setting (lean).** *Grows with need, stays readable, and does not gate those who need it now.*
- (d) Granular toggles only (damage, clock, HP separately). *Maximum control; no sense of membership, and a long settings screen.*
- *If (d):* keep the tier names as presets over the toggles.

---

## 9. Trustees' Directives (interface only)

The difficulty section owns the Directives: their list, stacking and numbers. This section needs four things from them:

1. **Unlock after the first escape** (the Pact unlocks after the first clear, RS F15).
2. **Stamp bounties for first clears**, per class, per Directive total. Proposal: 2 × total, so a first Night Guard escape at total 6 pays 12 Stamps once.
3. **Restricted Wings** as Atlas column V, opened at Directive totals 4, 8 and 12 (Dead Cells' Boss Stem Cells open routes, RS F16). What a Restricted department *is* (remix, higher ordinal, special rules) is the difficulty and pipeline sections' call.
4. **Directives may touch meta channels**: for example "No Loans" and "Uninsured Loans" (Loan lost permanently on death, §5.3). These should exist so that the Loan's safety is a default, not a law.

Directives and membership may be combined; both are recorded on the label.

---

## 10. The record of visits

### 10.1 Death as an exhibit

The death screen is a label (LM §3.4; CS §12). Posture comes from the cause:

| Cause | Title |
|---|---|
| killed while opening or breaking a case | Figure of a Visitor, **Reaching** |
| killed while reading or examining | Figure of a Visitor, **Looking** |
| killed while moving away from a hunter | Figure of a Visitor, **Leaving** |
| killed in a Masterpiece hall | Figure of a Visitor, **Facing [Masterpiece]** |
| killed during the Night Watch | Figure of a Visitor, **Waiting** |
| killed by fire, water or another hazard | Figure of a Visitor, **Standing in Water** / **Near a Flame** |
| killed while tiptoeing | Figure of a Visitor, **on Tiptoe** |
| killed by the Registrar at the Exit | Figure of a Visitor, **Accessioned** |
| otherwise | Figure of a Visitor, **Standing** |

> **Figure of a Visitor, Reaching (Run 14)**
> Night Guard · Found in Room 517 at opening, near the Pendulum Warden · Stanchion Post +3, Guard's Tunic +2, Pocket Watch, Running Slow (accessioned YC.31); 4 Certificates · H. 172 cm · Bequest of the Night Staff · FV.14.517

**Numbering.** CS §12 uses `V.14.412`. P §6.3 reserves single letters for families, and V is Absence. I propose `FV` (Figure of a Visitor) as a two-letter institutional series, which keeps P's rule.

**Where figures appear.**
- **Recent Acquisitions** in the Entrance Hall shows the latest figure; the **Hall of Visitors** (a side room) keeps the last 12.
- If the department where you died is drawn again, the figure stands in the room where you fell, as a non-hostile exhibit with its label. In Attendance departments (later), a figure may use `path_follower` behaviour (LM sample "Figure of a Visitor, Looking"; V §2.7), but only there.

Cost: one template, nine postures, a plaster sprite with the class's palette. It is v1 because it is cheap and it is the meta's emotional hook (LM D9).

### 10.2 Lost Property (v1.x)

- **Hand-in.** On the death screen: "The night staff will hand one of your things to Lost Property." Choose one carried equipment object (pre-selected: the one with the most Restoration levels). Loans are excluded (they go into conservation).
- **Claim.** Next run only, at the Lost Property window in the floor-1 Stair Hall (after department 3), for 40 coins (about one department's coin income, CS §11).
- **State.** Fully catalogued; Restoration halved, rounded down, capped at +2; weapons and garments mounted at floor 2's base tier; a forgery arrives as an honest copy. Credit "Bequest of the visitor who fell in Room 517 (Run 14)", number `LP.14.n` (P §6.3–6.4).
- **Expiry.** Unclaimed objects are "disposed of after one visit". A new death replaces it. An escape clears it.
- **Budget.** At most +3 pp on the next run's clear rate (§1.3). It is a small mercy for the run after a loss, anti-snowball by construction.

**M10. Lost Property.**
- (a) Out. *Purer; one system fewer.*
- (b) **One object, next run only, halved, for a fee (lean, v1.x).** *A small mercy with a museal face.*
- (c) Everything you carried, recoverable in the department where you died, Dark Souls style (general knowledge). *Dramatic; unreliable, because that department recurs only about one run in four.*

### 10.3 The Donor Wall

Every visit is engraved, one line each, newest at the top:

```
Run 14 · Night Guard · fell in Room 517 (Weathers, Domesticated, T.4) · 4 Certificates · 41 min · Loan YC.27
Run 13 · Copyist · ESCAPED · 8 Certificates · 76 min · Directives 2 · Member's visit (Friend)
```

- Escapes are cut larger. Feats earned on a run add a small ribbon glyph.
- Filters: class, outcome, Directive total, Late Opening, Today's Exhibition.
- Storage: compact rows of about 60 bytes (§14.1).

### 10.4 Conduct feats

Brogue's feats ("Paladin", "Untempted", RS F11) give replay with no power. Ours are conducts kept from the Information Desk to the Exit. First completion: 5 Stamps and a ribbon; later completions: the ribbon only.

| Feat | Escape… | Tier |
|---|---|---|
| **Do Not Touch** | without breaking any vitrine | v1 |
| **Look, Don't Wake** | without destroying any exhibit (Masterpieces viewed, not fought) | v1 |
| **Quiet Visit** | without any room alarm | v1 |
| **Before the Bell** | leaving every department before its First Bell | v1 |
| **Completist** | with every Highlight of every department | v1 |
| **Unaccompanied** | with no Loan, no Lost Property, no Loan Desk object | v1 |
| **Self-Guided** | without opening any full label | v1 |
| **Connoisseur** | without ever equipping a forgery | v1 |
| **Teetotal** | without drinking any Solution | v1.x |
| **Light Sleeper** | without the Night Watch ever beginning | v1.x |
| **Plain Clothes** | in your starting garment | v1.x |
| **Seen Everything** | having viewed every Masterpiece and fought none | v1.x |

Some are hard by design (Self-Guided plays against "the label is the interface"); that is the point of a conduct.

### 10.5 Badges and class unlocks

Badges are **Long Service Awards** on the Staff Noticeboard. They track milestones across runs. A few unlock things; most are just recognition (SPD's badges, RS §3.9).

| Badge | Condition | Unlocks |
|---|---|---|
| First Night | end a run, any outcome | **Copyist**; the Gift Shop opens |
| Registered | accession 5 objects | **Conservator** |
| Out by Morning | first escape | **Docent**; Directives; Today's Exhibition; Late Opening in stock |
| Cartographer I / II / III | 6 / 12 / 24 Atlas cells | an Atlas frame; the printable map |
| Benefactor I / II / III | 10 / 50 / 150 objects accessioned | Collection capacity 24 → 36 → 48 on view |
| Reader | open 100 full labels | – |
| Keeper's Notes | Document 25 species | – |
| Regular I / II / III | 10 / 30 / 100 runs | – |
| Every Door | visit every department in the pack | – |
| Founder's Guest | open the Founder's cabinet | the Curator class, when it exists |

Classes follow CS §10's launch lean (Night Guard and Copyist at launch, Conservator and Docent as unlocks).

**M12. How do classes unlock?**
- (a) **Milestones (lean).** *Each class arrives after the player has learned what it modifies; no shopping decision for core content.*
- (b) Bought in the Gift Shop. *Player chooses the order; the store becomes mandatory.*
- (c) All available from the start. *No onboarding; four kits to read on the first screen.*

### 10.6 Today's Exhibition (v1.x)

- **Seed:** `hash("daily", UTC date, pack version)`. The same departments, doors and layouts for everyone on that pack version (TA §3.2 determinism contract).
- **Fixed conditions:** a class that rotates by day; 0–2 Directives once they exist; standard kit; no Loan, no Lost Property, no Gift Shop options except cosmetics. Membership allowed and recorded.
- **Ordinals:** the full pool, ignoring your Atlas. That is why the daily unlocks after the first escape.
- **One attempt counts** (2 Stamps, a Donor Wall line); later attempts that day are practice.
- **No server in v1.** Results are shared as text, so comparison is social:

```
ACCESSION · Today's Exhibition · 2026-10-20 · pack 1.2
Night Guard · ESCAPED · 8/8 Certificates · 0 alarms · 74 min · Member: no
M T L K S A T M
```

(The last line is the run's family letters in door order.)

### 10.7 Seeded and Practice visits

Custom seeds are available from the start (useful for bug reports and for Julian's own testing). A seeded run is a **Practice visit**: the Catalogue and Atlas record what you learn (knowledge is knowledge), but there are no accessions, Stamps, feats or bounties, and the Donor Wall line is marked "Practice".

**M15. Do seeded runs pay?** (a) **No (lean)**: no farming of known seeds. (b) Yes: friendlier, and a known easy seed becomes a Stamp farm. (c) Half: a compromise that still invites farming.

---

## 11. Commissions

The pipeline section owns realisation (P §8). Meta owns the cards, the form and the prices.

- **Index cards** (P renames "catalogue cards" to avoid the Catalogue Card consumable, P §11 item 4; I agree). Four suits, earned from v1 onward and never spent:

| Suit | Earned by | Size at launch |
|---|---|---|
| Domain | reading a department's intro panel | ~48 |
| Material | earning a department's Certificate | ~30 |
| Practice | opening a highlight's full label | ~40 |
| Family | accessioning any object from that family | 6 |

- **The form** sits at the Information Desk: one Family, two Domains, one Material, one Practice, and a patron form for the credit line. One commission open at a time.
- **v1.x: Loan request.** 5 Stamps. The best-matching Permanent Collection department is guaranteed as a door in the next run from position 3, its placard marked "At the request of Visitor 40211". Cannot fail.
- **v2+: Commission.** 15 Stamps, refunded if "The Trustees have declined the commission" (P §8.3). A commissioned department joins your Commissioned Wing page in the Atlas, carries your credit, and contains an object zero like every other department.
- **Storage:** the card bitset (~150 bits) and one open commission (~100 bytes).

---

## 12. Without a story: the recurring cast

### 12.1 Why no story is needed

Hades' meta is carried by relationships that need a writing team. ACCESSION's meta is carried by **the player's own history, displayed by an institution**: labels written from runs (§4.5), figures in the rooms where you fell (§10.1), the Donor Wall, the Atlas filling diagonally, and the ledger in the Founder's cabinet. The Museum of Jurassic Technology never winks (LM F14); neither do our labels about you. What the player brings is the plot.

A light cast gives that history a voice. Three role-named characters (LM §3.3 rule 9: role-names, not personal names), no arcs, no dialogue trees.

### 12.2 The cast

| Voice | Where | Speaks about | Lines (v1) |
|---|---|---|---|
| **The Guard at Post One** | Entrance Hall desk, as you start a visit | your last run, your habits, long absences, colleagues (if you play the Night Guard), object zero (once) | ~120 |
| **The Registrar** | the slip; Stair Halls (CS §11); the Exit encounter | your Collection, accessions, forgeries, declined slips, and, at the Exit, you | ~60 + 40 slip quips |
| **The Gift Shop clerk** | Gift Shop, benches, Commissions form | purchases, refunds, benches, declined commissions | ~40 |
| *(Information Desk)* | start of a visit | membership (one line), feats in reach | ~20 |

### 12.3 The Registrar's interest

The direction memo leans toward a final encounter in which the Registrar wants to accession *you*. Its lines scale with your Collection, which gives a through-line without a plot:

| Collection size | Registrar at the Exit (examples) |
|---|---|
| 0–9 | "You have nothing registered. Neither, yet, have we registered you." |
| 10–24 | "Ten objects. The committee has started a file." |
| 25–49 | "Your collection has a shape now. So do you." |
| 50+ | "Fifty objects, and every label mentions you. You are already in the building's records. This would be a formality." |

A death at the Exit gives the special figure "Accessioned" (§10.1), credit "Acquired by the Registrar".

### 12.4 The bark system

Each line has a trigger, conditions over meta state and the last run's log, a priority and a cooldown (in visits). The Guard says one line per visit, the highest-priority eligible line not used in the last 10 visits.

| Trigger and conditions | Line (draft) |
|---|---|
| last run died to a Masterpiece in Room n | "Room 430 again. The clocks voted. It's never close." |
| last run's death figure is Reaching | "They found you with your hand in a case. I've seen worse ways to go. Not many." |
| first escape | "You came out the front. Most people leave through the gift shop." |
| 3 deaths in the same department | "Weathers, Domesticated. Bring an umbrella. I'm told that's not a joke." |
| playing the Night Guard class | "Evening, colleague. Don't let them see you sit down." |
| more than 14 days since the last visit | "Your card's still good. We kept your coat." |
| 6 object-zero readings | "Someone handed in a key. Brass. Tag says nothing useful." |
| Slip: accessioning the fourth object of a kind | (Registrar) "A fourth one. The committee asks whether you are expecting weather." |
| Slip: "Not tonight" | (Registrar) "Noted. Restraint is also a kind of collecting." |
| Refund | (clerk) "Returned unopened. The till won't mind." |

Lines interpolate run data (department titles, room numbers, Masterpiece names, object names), so 120 lines read as many more. All lines go through the same lint as labels: banned words, length, no real-world names (P §3.7).

### 12.5 Writing budget

| Item | Count | Words |
|---|---|---|
| Guard at Post One | 120 lines × ~15 | 1,800 |
| Registrar | 100 lines × ~15 | 1,500 |
| Clerk + Information Desk | 60 lines × ~15 | 900 |
| Collection provenance fragments (§4.5) | 90 × ~12 | 1,100 |
| Death postures and templates | 15 × ~20 | 300 |
| Gift Shop item labels | 20 × ~50 | 1,000 |
| Feats and badges | 30 × ~15 | 450 |
| Founder's ledger | – | 1,200 |
| **Total** | | **about 8,250** |

That is roughly the free text of two departments in the pack (P §2.2). Drafted offline by Claude with the voice guide (LM §3.3), edited by Julian: an estimated 1–2 days of drafting and 4–6 hours of review. No runtime LLM. Object-zero labels (~30 × 70 words) belong to the S4 budget, not this one.

**M13. The cast.** (a) **Three role-named voices with templated barks (lean).** (b) None: the labels alone carry it. *Cheaper; the Entrance Hall feels empty.* (c) Authored arcs with story beats, Hades-lite. *The user has ruled this out; it would also cost ten times the words.*

---

## 13. The first hour and the tenth hour

### 13.1 Runs 1–3 (about 75–90 minutes)

| Run | What happens | What it leaves behind |
|---|---|---|
| **1** (~25 min) | Night Guard only. Information Desk: three free options. Gift Shop shutters down. Your Collection holds a single plaque: "This gallery is reserved for objects you bring back." All departments and placards come from the 12 ordinal-I departments. Certificate in department 1; the first slip, with its one-line tutorial: "Choose one object to register. You will keep carrying it tonight." Death in department 3 | First Night badge: **Copyist unlocked, Gift Shop opens**. 2 objects in Your Collection (one NEW KIND). 2 Atlas cells: "Tides II is now open", "Machines II is now open". ~13 Stamps. ~25 species Sighted. A plaster figure in Recent Acquisitions. The Guard's first line next time |
| **2** (~30 min) | Choose Night Guard or Copyist. **First Loan** from 2 objects. Buy Gallery Refit and Advance Booking, or save. An ordinal-II door appears on a placard with an "Uncharted" mark. Death in department 4 | 3 more objects (5 total): Registered badge, **Conservator unlocked**. 2–3 more cells. ~14 Stamps |
| **3** (~35 min) | First Conservator run, or a Copyist run with a Loan. Members' Preview and Rain Check enter stock. The Guard remarks on a repeated death room. After the third death the Information Desk mentions membership in one line | ~8 objects, 5–6 cells, ~42 Stamps lifetime (3–5 purchases), ~40 species Sighted and a few Observed, 3 figures. Two to four object-zero readings recorded, probably unnoticed |

**What the first hour teaches:** that every run leaves something (objects, figures, cells), that the meta is a museum of your own visits, and that nothing bought makes the game easier. It does not teach Directives, lenses or Lost Property; those arrive after the first escape or the tenth run.

### 13.2 The tenth hour (around run 13)

- 3–4 classes; first escape done (Docent unlocked, Directives at total 2–4, Today's Exhibition open).
- 60–80 objects; about 40% of kinds; first Signature pieces vs new kinds debates on the slip.
- 14–16 Atlas cells; ordinal III open in most families.
- Founder's cabinet probably open for players who read labels.
- 2–4 feats; most of the v1 Gift Shop owned.
- The chase: the Directives ladder for a favourite class, ordinal IV cells, Signature pieces for prestige Loans.

### 13.3 Run 30 (around hour 25)

| Chase | State at run 30 (median estimate) | Why it still pulls |
|---|---|---|
| Trustees' Directives | totals 6–10 with one class, 2–4 with others | First-clear bounties per class; Restricted Wings |
| Atlas | 21–24 of 24 cells; Restricted column started | Ordinal IV departments are the most complex rules in the pack |
| Signature pieces | 15–20 of 30 | Each needs that department drawn, its Masterpiece *defeated*, and the slip spent on it |
| Kinds | ~60% | Pool variety; the Deaccession List to shape it |
| Object zero | cabinet open; 20–25 of 30 readings for the final ledger page | Readings in rarely drawn departments |
| Feats | 5–8 of 12 | Conducts that change how you play a whole run |
| Catalogue | ~70% of species Documented | Archetype pages complete |
| Daily | a streak, shared as text | Social comparison |
| v2 | Commissions; Temporary Exhibitions | New departments at the frontier (P §1.5: a 30-department pool has no new departments left by run 20) |

The honest weakness: by run 30 the Permanent Collection itself is exhausted (P §1.5). The meta keeps the player busy, but new *content* must come from v1.x updates or v2. Meta cannot substitute for departments.

---

## 14. Persistence

### 14.1 What is stored

| Block | Contents | At run 30 | Ceiling |
|---|---|---|---|
| Header | schema version, visitor number (random 5-digit), created date, write sequence, last pack version | 0.2 KB | 0.2 KB |
| Settings | input, text size, accessibility (including all membership tiers), audio | 0.3 KB | 0.5 KB |
| Donor Wall | one row per run (~60 B): run, class, seed, outcome, department, room, Certificates, minutes, flags | 1.8 KB | 200 full rows (12 KB), then yearly summaries |
| Your Collection | per object (~120 B): YC number, kind index, source item id, department, run, room, frozen name, condition, loan history | 18 KB (150 objects) | 60 KB (500) |
| Kinds | bitset over the kind registry | 32 B | 128 B |
| Catalogue | 2-bit level per entity (~1,000) plus sparse records (defeats, deaths caused) | 3 KB | 12 KB |
| Labels read | bitset per department | 0.6 KB | 4 KB |
| Atlas, object zero, Gift Shop (owned, off, lens), classes, feats, badges, index cards, membership, Directives | bitsets and small numbers | 0.5 KB | 1 KB |
| Figures (last 12), Lost Property, conservation, daily results (last 30), open commission | small records | 3 KB | 4 KB |
| **Meta total** | JSON | **~30 KB** | **~100 KB** |
| Frozen labels (TX, CM, deaccessioned departments) | IndexedDB | 0 | ~0.5 MB |
| Run save | snapshot + action log | 50–200 KB | – |

### 14.2 Where

- **localStorage**, two slots `accession.meta.A` and `accession.meta.B`. Writes alternate between them; each carries a sequence number and a CRC-32. On load, the valid slot with the higher sequence wins. A crash mid-write can corrupt at most one slot. (TA §3.7: versioned JSON with a checksum.)
- **IndexedDB** (database `accession`): `meta_backup` (the last 5 meta versions by sequence), `run` (snapshot and action log), `frozen` (frozen labels), `packs` and `atlases` (content packs and baked sprites, TA §3.7), `quarantine` (any meta that failed migration, kept untouched).
- The total is small for any browser. localStorage is the primary store because it is synchronous and readable before the game boots; IndexedDB is the mirror.

### 14.3 Commit points and the run save

**Meta commits** at: signing a slip; the end of a run; a purchase, refund or toggle; a settings change; reading object zero; charting a cell. Not every turn.

**The run save** is the run seed plus the action log, with a snapshot every Stair Hall and on `pagehide` and `visibilitychange` (mobile Safari kills tabs, TA §3.7). On load the game replays the log from the last snapshot, so the current state is always exact and there is no earlier state to return to. This closes reload-scumming without special rules (TA §3.2: replays are `{packVersion, coreVersion, runSeed, actions[]}`). The run save is deleted on death, roguelike-style.

**Ordering at death:** commit meta (figure, Donor Wall row, Lost Property, conservation) first, then delete the run save. A crash between the two replays the death.

### 14.4 Defending against eviction

WebKit deletes "all of a website's script-writable storage after seven days of Safari use without user interaction on the site", and home-screen web apps "have their own counter of days of use" (Wilander 2020, TA F15). Safari 17 grants `navigator.storage.persist()` "based on heuristics like whether the website is opened as a Home Screen Web App" (Liu 2023, TA F15).

1. **Call `persist()`** after the first signed slip, the first moment the player has something to lose. Record the result. The visitor's card screen shows "Storage: kept" or "Storage: may be cleared by the browser".
2. **PWA manifest and service worker**, so iOS players can add the game to the Home Screen and get their own storage counter (TA §3.7). Suggest it once, after the first escape or the third run, on iOS Safari only.
3. **Renewal reminders.** When the last export is older than 7 days and storage is not persistent, the Information Desk says once per visit: "Your visitor's card is due for renewal." One tap exports.
4. **A restore path on a blank start.** An empty save cannot tell eviction from a first visit, so the first screen always offers "First visit" and "I have a visitor's card".

**House-convention note.** A PWA needs a manifest and a service-worker file next to the HTML, so the hosted build is three files. The single HTML still runs alone from `file://`; it just cannot be installed.

### 14.5 The visitor's card and the archive

**The visitor's card** is a short code holding progression, not history.

| Field | Bits |
|---|---|
| magic + schema | 16 |
| visitor number | 17 |
| runs, escapes | 20 |
| Stamps | 12 |
| classes | 8 |
| Gift Shop owned + off | 40 |
| badges, feats | 48 |
| Atlas (12 families × 5 ordinals) | 60 |
| kinds unlocked (~115 at launch; 200 reserved) | 200 |
| Signature pieces accessioned (per department) | 150 |
| object-zero readings (per department) | 150 |
| index cards | 160 |
| membership | 8 |
| Directives cleared (per class) | 64 |
| CRC-16 | 16 |
| **Total** | **~970 bits ≈ 122 bytes** |

In Crockford base32 that is about 195 characters, shown as groups of five and as a QR code, prefixed `ACC1-`. It is meant for copy and paste, not typing. It grows by about 3 bits per new department and 1 per new kind.

**Restoring from the card** rebuilds progression exactly, and rebuilds Your Collection as one object per unlocked kind and per Signature piece, each with the credit line "Re-registered from a visitor's card". Individual run histories, figures and Catalogue levels below department level are not in the card.

**The archive** is the full meta JSON (~30–100 KB) as a downloaded file (`accession-visitor-40211-2026-10-20.json`) or as copyable deflated base64 text. It restores everything.

TA §3.7 hoped for "a few dozen characters". That holds only for a checksum-sized token; anything carrying the Atlas and kinds needs about 200. See Challenges, item 7.

### 14.6 Versioning and migration

- **Schema version** in the header. Migrations are pure functions `migrate[n](meta) → meta` applied in sequence, in `core/` style (no DOM), tested in Node.
- **Fixtures:** every released schema gets a saved fixture at three sizes (new, run 10, run 100) under `tests/fixtures/meta-v*.json`. CI loads each fixture, migrates to current, and checks invariants (no lost objects, bitset lengths, Stamps unchanged). This is grift-city's "older saves remain readable" (TA §3.7).
- **Stable indices.** Kinds, species, feats, badges and shop items get append-only integer indices in registries. Ids are never reused; retired ids keep their index as an alias (V §11.5). Bitsets therefore never shift.
- **Pack updates** do not need meta migrations: new departments are simply new (and pay first-visit Stamps); new species get new indices; removed departments are handled by frozen names (§4.8).
- **A save from a newer version** is opened read-only with a message ("This card is from a newer edition of the museum"), never overwritten.
- **A failed migration** moves the old meta to `quarantine`, starts read-only, and offers an archive export. User data is never deleted by a migration.

### 14.7 Multiple tabs and devices

- **One active run per browser profile.** On starting a visit the tab writes `accession.activeRun = {tab, heartbeat}` and refreshes it every 5 seconds. Another tab that sees a fresh heartbeat shows "You are already in the museum, in another window." A stale heartbeat (over 15 seconds) is taken over. Simple, and it works in every browser.
- **Devices.** Importing offers **Replace** or **Merge**. Merge takes the union of bitsets, the maximum of counters and Stamps, and the union of Collection objects; imported objects get new YC numbers after the local ones and the credit "Transferred from the collection of Visitor 51102".
- **Tampering** is allowed; this is a single-player game. The checksum catches typos, not cheats.

**M14. Persistence.**
- (a) localStorage only. *Simplest; one corrupt write or one Safari week loses everything.*
- (b) **Two localStorage slots + IndexedDB mirror + `persist()` + PWA + visitor's card + archive (lean).** *About 4–6 days; survives crashes, eviction and device changes.*
- (c) A server account. *True sync; a server, accounts and privacy work for a single-player game. Revisit only if the v2 server exists anyway (TA T10).*

---

## 15. Challenges to the frame

1. **The Gift Shop and Stamps belong in v1, small.** The memo lists the Gift Shop as "later". But the user asked for a store, and without a currency a run that ends before its first Certificate pays nothing except Catalogue entries. Ten items and a bench sink cost about four days.
2. **Death as an exhibit belongs in v1.** It is one template, nine postures and one sprite, and it is the meta's emotional centre (LM D9).
3. **A "+0, normalised" Loan goes stale in one floor** if it is a weapon or garment. Normalisation should include re-mounting to each floor's base tier, or Loans become curio-only in practice.
4. **Kind unlocking needs a design reason.** Locking kinds only to have something to unlock is an arbitrary carrot. Locking *complex* kinds makes it onboarding, and the "cf. YC.31" cross-reference makes the effect visible. Without both, players will not notice that accession did anything.
5. **Lost Property and the Loan overlap.** Both carry one object across a run boundary. Lost Property is a mercy rule; the Loan is a choice. Lost Property should be the first to go if scope shrinks.
6. **"Accession one item you carried out" needs a provenance rule.** Read literally, a player would accession their best item from any earlier department on every exit. Restricting the slip to objects acquired in the department being left keeps the choice about *that* department.
7. **The visitor's card cannot be "a few dozen characters"** (TA §3.7) and still hold the Atlas, kinds and readings. About 195 characters plus a full archive file is the realistic shape.
8. **Three gift shops.** The meta Gift Shop (Stamps), the in-run kiosks (coins) and the Exit's shop ("exit through the gift shop") share a name. Proposal: "the Gift Shop" is the Entrance Hall one; in-run ones are always "kiosks"; the run-structure section names the Exit's.
9. **Numbering.** CS's death number `V.14.412` collides with P's family letter V (Absence). Use `FV`.
10. **Daily vs ordinal gating.** A shared daily seed cannot respect each player's Atlas, so the daily must use the full pool and unlock after the first escape. This is a small cost of gating that the memo does not mention.

---

## 16. Risks

1. **Meta sprawl.** Fourteen layers is a lot for a browser game. ITB shipped "30 percent of what we were hoping" after cutting its hub and research (RS F13). Mitigation: §17, and building the meta last, on data the run already produces.
2. **Accession feels like nothing.** If kinds reskin silently, players will not notice the unlock. Mitigation: NEW KIND on the slip, "cf. YC.n" on later tombstones, and one Loan Desk offer from your kinds.
3. **Collection bloat.** 150+ objects by run 30. Mitigation: 24–48 on view, a searchable Store Room, rehanging.
4. **Pool dilution.** More kinds make any one kind rarer. Mitigation: weights, the Deaccession List.
5. **Stamp pacing cannot be simulated.** It depends on human pace, and v1 has no telemetry. Mitigation: simple, finite sources; the income table as a target to check in playtests.
6. **Loan or Gift Shop power leaks past the budget.** Mitigation: the CI checks in §1.3 and "Not for loan".
7. **Eviction on Safari** still loses progress for players who never export. Mitigation: §14.4; the restore option on every blank start.
8. **Migration bugs** destroy saves. Mitigation: fixtures for every schema version, quarantine, read-only fallback.
9. **Barks repeat.** 120 lines over 100 runs is thin. Mitigation: run-data interpolation, a 10-visit cooldown, adding lines in v1.x.
10. **Object zero is too obscure or too obvious.** Mitigation: the `.0` number and constant description as tells, one hint at 6 readings, a second hint only if playtests need it.
11. **Membership stigma or misuse.** Players may avoid it out of pride or leave it on by habit. Mitigation: neutral wording, the one-line offer, labels that report rather than judge.
12. **The meta outlives the content** (§13.3). Mitigation: content updates and v2; the meta should not be asked to do this job.

---

## 17. Cut line

Drop in this order if scope must shrink:

1. **Commissions** (all forms). Keep recording index cards if the bitset is already there.
2. **Exhibition Catalogue export and memorial benches.**
3. **Lenses** (#15–17).
4. **Lost Property.**
5. **Late Opening.**
6. **Today's Exhibition.**
7. **The Registrar's Collection-size lines and the Clerk's voice.** Keep the Guard at Post One.
8. **The Founder's cabinet payoff**, down to the ledger text and a badge (keep object zero in the packs: it costs one label per department and can be paid off later).
9. **Membership tiers**, down to one toggle at Fellow values.
10. **The Gift Shop**, down to the 4 free desk options plus items 1, 2, 10 and 19.
11. **Archetype transfer in the Catalogue.**

**Never cut:**
- Accession, the slip, Your Collection with run-written labels;
- the Loan slot with its normalisation;
- the Catalogue's three levels and the Atlas with ordinal gating;
- the death label;
- the two-slot save, the action-log run save, and some export (archive file at minimum).

---

## 18. Decisions for Julian (from this section)

| # | Question | Options | Lean |
|---|---|---|---|
| M1 | What does accession cost in the run? | nothing (lent back) / handed over / provisional until escape | **Nothing: registered and lent back** |
| M2 | Eligibility | Certificate + acquired here / no Certificate / Certificate + rung 5 | **Certificate + acquired in this department** |
| M3 | Kind locking | complex kinds locked / no locking / Isaac-style heavy locking | **Base 24 simple kinds; complex kinds by accession** |
| M4 | Loan on death | safe / lost / in conservation one run / to Lost Property | **In conservation for one run** |
| M5 | Ordinal gating | per family / none / global | **Per family** |
| M6 | Founder's cabinet reward | lore + Founder's Key / class only / lore only | **Lore, badge and the Founder's Key; Curator later** |
| M7 | Gift Shop in v1 | none / 10 items + benches / all 20 | **10 items + benches** |
| M8 | Currency | Stamps from Certificates, escapes, discoveries / coins convert / none | **Stamps** |
| M9 | Patron model | continuous / fixed / earned tiers with dial-down and accessibility unlock / toggles | **Earned tiers, dial down, all tiers via accessibility** |
| M10 | Lost Property | out / one object halved for a fee / everything, in the death room | **One object, v1.x** |
| M11 | Loan tier | fixed tier 1 / re-mounted per floor / always current depth | **Re-mounted at each Stair Hall** |
| M12 | Class unlocks | milestones / bought / all open | **Milestones** |
| M13 | Recurring cast | three role-named voices / none / authored arcs | **Three voices, ~8,000 words** |
| M14 | Persistence | localStorage only / layered + export / server | **Layered + visitor's card + archive** |
| M15 | Seeded runs pay? | no / yes / half | **No (Practice visits)** |
| M16 | Today's Exhibition | after first escape, standard kit / from start / none | **After first escape, standard kit, v1.x** |

**M11 detail.** (a) Fixed at tier 1: *simplest; weapons and garments are dead weight by department 4, so players lend only curios.* (b) **Re-mounted to each floor's base tier at the Stair Halls (lean):** *stays relevant, never beats a good find.* (c) Always the current depth's tier: *smoothest, but a Loan then equals the best ambient tier, which pushes the Loan budget (§1.3).*

**M16 detail.** (a) **After the first escape, standard kit, no Loans (lean):** *comparable results, full pool without confusing a new player.* (b) From run 1: *more players see it; new players meet ordinal-IV rules on day one.* (c) None: *saves 1–2 days; loses a free reason to return daily.*

Each decision is argued in place, with what changes elsewhere if Julian picks otherwise.

---

## 19. Interfaces with other sections

- **Core systems (CS).** The slip at every exit door; Certificate as the eligibility gate; retirement keeps the pick only with the Certificate (as CS §12 proposes); Loans at rung 5 and +0; the Conservator re-mounts Loans at Stair Halls; the Registrar's lines; coins never convert; Guidebook pre-identification uses CS §7.3 point 5; death numbering `FV`.
- **Vocabulary (V).** Kind = category + form + primitives with magnitudes + drawback; the base pool of 24 simple kinds (6 per category) must be authored in S0; append-only indices; budget cap 4 for Loans and touring versions of Signature pieces.
- **Pipeline (P).** Object zero (`<dept>.0`) in every department, with the constant physical description checked by a validator; Collection numbers `YC`, Lost Property `LP`, figures `FV`; credit lines for "on study loan to the visitor", "Re-registered from a visitor's card" and "Transferred from the collection of Visitor n"; index cards; the loan request and commission realisation; frozen labels for TX and CM departments; S7 should print the number of distinct kinds per pack.
- **Run structure.** Placard marks (Not yet visited, Uncharted); the Lost Property window in the floor-1 Stair Hall; the Exit encounter's Registrar lines and the "Accessioned" figure; Late Opening as a 3/3/3/3 run; the sequencer reads open Atlas cells; the Exit shop's name.
- **Difficulty.** Directives unlock, bounties, Restricted Wings, the Loan-related Directives; membership numbers must be included in the persona sweep; the §1.3 budgets run in the same harness.
- **Testing.** The CI meta checks: Loan budget per kind, Gift Shop Δ clear per item, Lost Property budget, membership hazard multipliers, save-migration fixtures.
