# Where departments come from: the infinity decision and the generation pipeline

*Section draft for the ACCESSION design document, 2026-10-20. Written inside the direction memo (`direction.md`). Readers: Julian; the vocabulary (S0) drafter, whose `vocabulary.md` this section compiles into; the layout, core-systems, meta and run-structure drafters.*

*Sources are cited by brief and finding number: PS = `papers-semantic.md`, BK = `book-pcg.md`, PL = `papers-levels.md`, TA = `tech-art.md`, LM = `literature-museology.md`, ML = `museum-layouts.md`. V = the sibling draft `design/vocabulary.md`, CS = `design/core-systems.md`. `scriptprof/NOTES.md` is cited from the repo. Every cost, rate and threshold below is a first estimate to be measured, and is labelled as such where it matters.*

---

## 0. Proposals at a glance

| Topic | Proposal |
|---|---|
| The infinity decision | Option E (hybrid). v1: a curated **Permanent Collection** of 24–30 departments plus a grammar-generated **Directory** that makes the museum read as endless. v2: opt-in **Temporary Exhibitions**, served from an automated rolling buffer behind a small server, with bring-your-own-key as the no-server alternative. v3: player **Commissions** realised by the same service. |
| Why | One spoiled department spoils a 70–90 minute run: at an 8-department run, a 2% per-department dud rate already gives 15% of runs a dud. Only offline rejection gets the rate near zero. Curation hours, not tokens, are the binding cost. |
| Data model | A department is a **frame** (concept), a **spec** (ids from the closed vocabulary), a **balance** block (all numbers, computed), and **text / visual / audio** layers. Every field is tagged by who may write it. The LLM writes no number. |
| Pipeline | S0 substrate, S1 frame, S2 compile, (balancer), S3 simulation gate, S4 text, S5 sprite and audio spec, S6 curator console, S7 accession-numbered pack. Diversity comes from input recipes (domain pairs, constraint cards, archive target cells), never from temperature, and no department is ever generated from another. |
| Archives | A constrained MAP-Elites archive over *measured* challenge type × architectural programme (42 cells), plus a theme novelty archive. A pack's diversity is a coverage number printed by CI. |
| Runtime text | Minor labels from a per-department, domain-keyed replacement grammar. Accession numbers are Wilkins-coded (family letter, department, room, item) and also key the RNG. Credit lines are computed from item state at display time. |
| Evaluation | Expressive range on mechanical descriptors, an oatmeal ratio (between-department over within-department variation, on design and on bot-play descriptors), the curation coefficient, a CrawLLM-style recognition study, pairwise preference tests, a pool-wide text report and a dud-rate dashboard. |

---

## 1. The infinity decision

### 1.1 What "infinite" can mean

Julian's brief asks for "an infinite collection of departments" and asks whether that should be literal. Three different things get called infinite here:

1. **Perceived infinity.** The museum *reads* as endless: signage, directories and closed doors name more departments than any player will visit. This costs strings.
2. **Playable infinity.** Every run can contain a department nobody has played before. This costs generation, validation and moderation for every new department.
3. **Mechanical infinity.** New departments keep changing *how you play*. This is bounded by the vocabulary (pillar 1), whatever the supply of departments. §1.6 estimates the bound.

Borges already settled which of these matters most for a reader: in Babel nearly every book is noise and the value lies in the catalogue (LM F5). The book makes the same point in engineering terms: infinity is only worth having "if new content can be generated with sufficient variety, quality and quantity" (AI&G 2e p. 26, BK F18), and No Man's Sky is the cautionary case (p. 270).

### 1.2 The five options

**A. Hand-authored set.** Julian (or Julian plus Claude in sessions) designs 12–20 departments by hand. The strongest version is Hades-like: few areas, each deeply tuned, with layouts still generated per run.

**B. Offline curated pool.** The pipeline in §3 generates candidates offline, validators and a simulation gate filter them, and Julian accepts, edits or rejects each. Accepted departments ship as data. The strongest version is a pool that grows by 6–10 departments per content update.

**C. Runtime LLM.** A department is generated for the player when they reach a door. The strongest version is described in §1.6.

**D. Grammar / combinatorial.** Departments are assembled from authored parts with no LLM: family → module, archetypes with skins from an authored skin library (for example 25 archetypes × 6 families × 4 skins = 600 skins), titles from the Directory grammar, labels from Tracery-style templates. The strongest version is Caves of Qud's sultan histories: 10 domains and 19 event types produce characterful lore because events are rationalised from state (PS F15).

**E. Hybrid.** B as the playable core, D as the Directory, as the baseline operator in the archive and as a repair tool, and C only as cached, optional extras.

### 1.3 Comparison

| | **A. Hand-authored** | **B. Curated pool** | **C. Runtime LLM** | **D. Grammar** | **E. Hybrid (lean)** |
|---|---|---|---|---|---|
| **Perceived novelty** | High per department; exhausted within 10–20 runs | High; specificity enforced; 24–30 at launch, growing | Highest at first, then trope sameness shows (PS F9–F11) | Medium; templates show ("Department of [X] of the [Y]") | High: generated nouns over authored verbs, an endless Directory, optional new exhibitions |
| **Actual variety** | Low count, high depth | Medium count, high depth | Unbounded count, depth uncertain and capped by the vocabulary (§1.6) | High count, shallow | Medium-high count, high depth |
| **Learnability** | Excellent | Excellent: departments recur (§1.5) | Archetype knowledge still transfers (closed verbs); department knowledge never pays off | Good | Excellent |
| **Coherence across facets** | Excellent | Good after validators and curation | Variable; failures reach players | Automatic through shared tags, but bland | Good, with shared-tag checks plus the round-trip label check |
| **Balance** | Hand-tuned | Simulated (S3) and curated | Needs a simulation per department per request; a full gate takes ~34 core-minutes (§3.11) | Simulatable | Simulated offline; the runtime only sequences |
| **Expected dud rate p** | Near 0 after playtests | Target ≤ 0.5% broken, ≤ 5% dull | Unknown; uncurated evidence ranges from 10% unplayable (Word2World full pipeline, PS F9) to 34% not worth showing (A Rogue Dream, PS F18) | Low broken, high dull | As B for v1; optional extras carry their own p |
| **Money** | None | About $35 per 30-department batch on Opus 5.5 via Batch (§3.11) | ≈ $0.67–1.35 per accepted department on Opus 5.5 (§7.4), per player unless shared | Near zero | As B; a v2 server costs ≈ $100–400 per month (§7.4) |
| **Julian's time** | Very high (days per department, a guess) | About 8 hours per 30-department batch (§3.9) | None per department; all risk moves to players | Authoring the skin library once | As B, plus server upkeep in v2 |
| **Engineering and house fit** | Fits the single-file convention | Fits: ships as JSON inside the build | Breaks it: needs a server or player keys, moderation and caching (TA F8) | Fits | v1 fits fully; the server is optional and later |
| **Determinism (seeds, daily runs, sharing, replays)** | Yes | Yes | Only by storing outputs: the models take no seed and reject sampling parameters (TA F5) | Yes | Yes: accession numbers plus digests address stored content |

### 1.4 The dud arithmetic

A run visits *n* departments. If each has an independent probability *p* of being a dud, the chance that a run contains at least one is 1 − (1 − p)^n. The frame's run has n = 8.

| p (per department) | n = 1 | n = 3 | **n = 8** | n = 10 |
|---|---|---|---|---|
| 0.5% | 0.5% | 1.5% | **3.9%** | 4.9% |
| 1% | 1.0% | 3.0% | **7.7%** | 9.6% |
| 2% | 2.0% | 5.9% | **14.9%** | 18.3% |
| 5% | 5.0% | 14.3% | **33.7%** | 40.1% |
| 10% | 10.0% | 27.1% | **57.0%** | 65.1% |
| 20% | 20.0% | 48.8% | **83.2%** | 89.3% |
| 34% (A Rogue Dream's reject share) | 34.0% | 71.3% | **96.4%** | 98.4% |

Read backwards, for n = 8: keeping duds out of 95% of runs requires p ≤ 0.64%; out of 90% of runs, p ≤ 1.3%; out of 80%, p ≤ 2.75%.

Two kinds of dud should be counted separately, because they cost different amounts:
- **Broken** (unwinnable, a soft-lock, an unfair spike, an unreadable mechanic, an offensive reading). This spoils the run. Target p_broken ≤ 0.5%, i.e. about one run in 26 meets one. The S3 gate and the sensitivity checks exist for this.
- **Dull** (nothing to decide, incoherent, generic). This costs ten minutes. Target p_dull ≤ 5%, which still puts one dull department in a third of runs. Curation exists for this.

The n = 3 column matters for v2: if a run contains three optional Temporary Exhibitions at p = 10%, 27% of runs that use them meet a dud. That is tolerable only because they are optional and come with an exit valve (§7.6).

### 1.5 The recurrence arithmetic

If a run draws n = 8 departments uniformly from a pool of N, the expected number of distinct departments seen after R runs is N(1 − (1 − n/N)^R). The expected number of *new* departments in run R + 1 is n(1 − n/N)^R. Each department is visited nR/N times on average.

**Distinct departments seen after R runs**

| N | R = 1 | R = 5 | R = 10 | R = 20 | R = 50 |
|---|---|---|---|---|---|
| 12 | 8 | 12.0 | 12.0 | 12.0 | 12.0 |
| 20 | 8 | 18.4 | 19.9 | 20.0 | 20.0 |
| 30 | 8 | 23.6 | 28.7 | 29.9 | 30.0 |
| 60 | 8 | 30.7 | 45.7 | 56.6 | 60.0 |
| 100 | 8 | 34.1 | 56.6 | 81.1 | 98.5 |
| 150 | 8 | 36.0 | 63.3 | 99.9 | 140.3 |

**New departments in the next run**

| N | after 1 run | after 5 | after 10 | after 20 | after 50 |
|---|---|---|---|---|---|
| 30 | 5.87 | 1.70 | 0.36 | 0.02 | 0.00 |
| 60 | 6.93 | 3.91 | 1.91 | 0.46 | 0.01 |
| 100 | 7.36 | 5.27 | 3.48 | 1.51 | 0.12 |
| 150 | 7.57 | 6.08 | 4.62 | 2.67 | 0.52 |

**Pool size needed for at least one new department per run at run R:** 24 (R = 5), 43 (R = 10), 81 (R = 20), 196 (R = 50), 389 (R = 100).

What this says:
- A 30-department launch pool is mostly explored by run 10 and fully by run 20, with each department visited about 5 times by then. That is generous by genre standards (Hades and Slay the Spire have 3–4 areas) and is what lets a player learn a department's Masterpiece.
- The **door placards** expose the pool faster than visits do. With 2–3 doors at each of 7 transitions, a player reads 16–20 placards per run; at N = 30 that is 27–29 distinct departments seen on placards after 3 runs. The Directory and closed doors (§5) are what keep unseen territory visible after that.
- Sustaining novelty for a dedicated player (one new department per run through run 50) needs about 200 departments. That is the honest argument for a v2 frontier, and it is a long way off.
- These numbers assume uniform draws. A sequencer that prefers unseen departments when it builds doors would exhaust a pool faster, not slower; recurrence is a feature to keep.

### 1.6 The strongest case for "literally infinite", and what it would take

**The strongest version.** Call it *the Infinite Accession*. Every door anyone opens onto an unseen exhibition generates it once; it is stored forever under a number, credited to the first visitor ("Opened by Visitor 40211"), and playable by anyone who reaches that number. Popular exhibitions are promoted into the Permanent Collection; reported ones are closed. The museum literally grows with its visitors, which is the Infinite Craft pattern (PS F17) applied to a museum. It has three real attractions: the fiction is literally true, discovery becomes social, and the generator itself becomes part of the game.

**An argument that is weaker than the briefs suggest.** The briefs lean on learnability against infinity (PS §3.1, BK pitfall 12). With closed verbs, that argument mostly dissolves. An archetype in 24% of departments appears in an 8-department run with probability 0.89 whatever the pool size, as long as the quotas hold its share (V §11.2), so bestiary knowledge transfers even if no department ever repeats. What infinity loses is department-level familiarity: a known layout style, a known Masterpiece, a known collector. That is real but smaller. The decisive arguments are elsewhere.

**What it would take.**
1. **An automated gate as good as the curator.** p_broken ≤ 0.5% and p_dull ≤ 5% with no human (§1.4). The evidence today is a 66% curation coefficient for A Rogue Dream and 90% playability for Word2World's full pipeline (PS F9, F18), both far from 99.5%. The measurable route: log every curation decision (§3.9), train or prompt an automated curator on the log, and test its agreement with Julian on held-out departments (the v2 gate in §1.7).
2. **Optional placement.** Generated departments must sit behind a choice, never on the only path. The book's line: necessary content must always be correct, optional content need not (AI&G 2e p. 238, BK F1). Plus an exit valve, so that a broken one costs minutes (§7.6).
3. **A growing vocabulary.** At the launch vocabulary there are about **130 legal combinations of (signature module, primary challenge, programme)**: 12 signature-eligible modules, each producing 1–2 challenge types, across the 3–6 programmes each allows (my count from V Table B and §6.4). Beyond roughly that many departments, new ones share a mechanical identity with an existing one and differ only in secondary module, bestiary mix and skin. Playable infinity without vocabulary growth is reskinning (PS F3, F16). Vocabulary growth runs through the human-reviewed path (V §11.4) at 2–4 ids per update.
4. **A server, or player keys.** A browser cannot hold an API key (TA F8). A server needs caching keyed by content, per-IP and global caps, and no free-text input. Cost then scales with the number of *new* exhibitions requested, not with players, as long as exhibitions are shared.
5. **Accepting model drift.** No seed parameter and no sampling control (TA F5); Opus 5.5 retires no sooner than 2027-09-22 (TA F7). Stored outputs survive; a new model is a new generator version with a new voice.
6. **Moderation without free text.** Player input is limited to collected card ids (§8), so the abuse surface is the model's own output, which the sensitivity checks screen (§3.7).

None of these is impossible. Items 1 and 3 are research questions that the v1 pipeline produces the data to answer, which is why the roadmap stages them.

### 1.7 Recommendation and roadmap

**Lean: E.**

| Version | Supply | What ships | Gate to move on |
|---|---|---|---|
| **v1** | Permanent Collection + Directory | 24–30 curated departments (6 launch families × 4–5), the Directory grammar, runtime minor-label grammar, accession numbers, the Catalogue/Atlas. Pipeline runs offline on Julian's machine; nothing at runtime touches a model. Optional: Commission as a "loan request" (§8.3, option a). | Ship |
| **v1.x** | Content updates | 6–10 departments per update, one batch each; vocabulary minor bumps of 2–4 ids. Pool grows toward 60–100. | Each update passes the CI coverage contract (§4.4) |
| **v2** | Temporary Exhibitions | Opt-in exhibitions from an automated rolling buffer behind a small server (or bring-your-own-key), §7. Commissions realised by the same service (§8). | On a held-out batch of ≥ 40 automated-passed departments: Julian accepts ≥ 70% without major edits; p_broken in playtests ≤ 1%; no serious sensitivity miss; in pairwise tests, curated departments preferred in ≤ 60% of pairs (§9.5). Thresholds are Julian's to set. |
| **v3** | Commissions and promotion | Player-composed commissions; promotion of temporary exhibitions into the Permanent Collection from telemetry plus curation; an automated curator trained on the curation log; the vocabulary research track feeding new ids. | Research outcomes |

**Decision D-P1. Where do departments come from?**
- (a) Hand-authored, 12–20. *Best depth, lowest risk; content runs out by run 20 and the Directory has to carry all the infinity.*
- (b) Curated pool only, no runtime ever. *Safe and simple; novelty for dedicated players depends on update cadence.*
- (c) Runtime LLM from launch. *The fiction is literally true; ships an unmeasured p to players and a server to Julian.*
- (d) Grammar only. *Free and deterministic; departments blur into oatmeal.*
- (e) **Hybrid as staged above (lean).** *v1 is (b) plus the Directory; v2 adds optional, cached extras once the data says the automated gate is good enough.*

*If Julian picks (a):* S1–S5 become authoring aids rather than a pipeline; keep S3, S6 and S7 unchanged; launch with about 15 departments. *If (c):* §7 becomes v1, the S3 gate must run server-side, and the first two departments of every run must still come from a pack (cold start).

**Decision D-P2. Launch pool size.**
- (a) 12–18: *fastest to curate (about 4–5 hours of Julian's review); exhausted by run 6.*
- (b) **24–30 (lean):** *4–5 per launch family, every launch archetype in at least 3 departments (V §11.2); about 8 hours of review.*
- (c) 40–60: *better long-run novelty; doubles curation; strains the 42-cell archive before the vocabulary grows.*

---

## 2. The department data model

### 2.1 Layers

| Layer | Holds | Written by |
|---|---|---|
| **Recipe** | What the batch planner gave S1: family, category, seed domains, constraint card, target cell, voice pool, exemplar set | Code (batch planner) |
| **Frame** | The concept: title, domains, conceit, collecting policy, founder, calendar anchor, voice, challenge claim, programme, palette, pitches | LLM (S1) |
| **Spec** | Mechanics as ids: modules, species, Masterpiece, items, keepable, consumable weights and skins, NPCs, and the **trace map** from domains to ids | LLM (S2), choosing from closed enums only |
| **Balance** | Every number: stats per run position, module numbers, the calibration offset, measured fingerprint, descriptors | Code (balancer, S3, layout metrics) |
| **Text** | Panels, labels, quotations, barks, collector biography, the runtime grammar | LLM (S4), linted and round-trip checked |
| **Visual / audio** | Ornaments, palette ramps, signature 16×16 grids, tileset choices; mode, family, tempo, motif | LLM (S5) from enums, plus validated grids and tracker text |
| **Curation** | Decision, reason codes, edits, minutes spent | Julian (S6) |
| **Identity** | Accession number, digest, version pins, status | Code (S7) and Julian |

Two schemas, as TA §3.3 recommends: an **llm-schema** per stage, which is the subset structured outputs accept (closed enums, `additionalProperties: false`, no numeric or length constraints, TA F6); and the full **pack-schema** with lengths, ranges and cross-references, enforced by `lint.js`.

### 2.2 One department, every field

Tags: `[in]` chosen by the batch planner; `[L·enum]` LLM chooses from a closed enum; `[L·text]` LLM free text, linted; `[L·grid]` LLM index grid, validated; `[C]` computed by deterministic code; `[R]` taken from an authored registry by id; `[H]` the curator. The real pack is plain JSON; the comments are for this document.

The example is **Instruments That Keep Time Badly** (Machines × technology), the department the Escapement Hound sample label says it was transferred from (LM §3.3). It is an illustration for the sample-departments writer, not a final department.

```jsonc
{
  "accession": "M.7",                       // [C] S7: next free number in the Machines register; never reused
  "digest": "3f9a2c1e",                     // [C] first 8 hex of sha256 over canonical JSON (this field excluded)
  "pins": { "vocab": "1.3.0", "gen": "g4", "layout": "L2.1", "balancer": "B1.4" },   // [C]
  "status": "permanent",                    // [H] permanent | temporary | commission | deaccessioned
  "ordinal": 2,                             // [C] complexity 1–4 from module parameters (V §11.3); shown as "Machines II"

  "recipe": {                               // [in] kept for audit, dedupe and the coverage report
    "family": "machines", "category": "technology",
    "seed_domains": ["lateness", "bells"], "card": "CC-17",
    "target_cell": null,                    // null in open rounds; ["hazard_terrain","rotunda"] in targeted rounds (§3.2)
    "voice_pool": ["dry_registrar", "audio_guide"], "exemplars": "EX-3"
  },

  "frame": {                                // S1
    "title": "Instruments That Keep Time Badly",                 // [L·text] ≤ 8 words
    "domains": ["lateness", "bells", "repair"],                  // [L·enum] two given, one chosen from the domain lexicon
    "conceit": "A workshop guild once licensed clocks by how they failed ...",   // [L·text] ≤ 80 words
    "collecting_policy": "Accepts any timekeeper with a documented fault.",     // [L·text] ≤ 40 words
    "founder": "the Regulator of the Lower Horology, ninth of that title",       // [L·text] a role-name, never a personal name (LM §3.3 rule 9)
    "calendar_anchor": "after the Second Calibration",           // [L·text] linted: no real years, centuries or eras
    "voice": "dry_registrar",                                    // [L·enum] 8 voices
    "challenge_claim": { "primary": "hazard_terrain", "secondary": "guarded" },  // [L·enum] a claim; S3 decides
    "programme": "rotunda",                                      // [L·enum] weighted by the module × programme matrix (V §6.4)
    "palette": { "material": "brass", "accent": "verdigris", "wall": "slate_blue", "floor": "walnut_parquet" },  // [L·enum] ramp ids from [R]
    "centrepiece_pitch": "Five clocks on one plinth that have never agreed.",    // [L·text] ≤ 40 words
    "keepable_pitch": "The ninth Regulator's own repeater, which strikes late."  // [L·text] ≤ 40 words
  },

  "spec": {                                 // S2: ids only (format of V §10.1)
    "modules": {
      "signature": { "id": "hourly_demonstration", "params": { "period": "M" } },   // [L·enum] id and classes; the numbers are [C]
      "secondary": { "id": "alarm_network", "params": { "guards": "S" } }
    },
    "species": [
      { "id": "M.7.s1", "archetype": "escapement", "role": "skirmisher",
        "modifiers": ["clockwork", "old_repair"], "params": { "old_repair_side": "left" }, "elite": false,
        "skin": { "name": "Escapement Hound", "palette": ["brass", "walnut"] } },     // archetype, role, modifiers [L·enum]; name [L·text]; silhouette [R] from the archetype
      { "id": "M.7.s2", "archetype": "demonstrator", "role": "controller", "modifiers": ["bronze"],
        "skin": { "name": "Orrery Arm, Demonstration Model" } },
      { "id": "M.7.s3", "archetype": "herald", "role": "support", "modifiers": ["bronze"],
        "skin": { "name": "Repeater Bell on a Walking Frame" } },
      { "id": "M.7.s4", "archetype": "mote_swarm", "role": "swarm", "modifiers": ["clockwork"], "count_class": "M",
        "skin": { "name": "Loose Train of Wheels" } },
      { "id": "M.7.s5", "archetype": "conservator_healer", "role": "support", "modifiers": ["clockwork"],
        "skin": { "name": "Regulator's Apprentice (automaton)" } },
      { "id": "M.7.s6", "archetype": "patrol_guard", "role": "warden", "modifiers": [],
        "skin": { "name": "Night Regulator" } }
    ],
    "masterpiece": { "id": "M.7.mp", "core": "mp_ensemble", "attachments": ["demonstrator"],
                     "specials": ["ring", "line"], "skin": { "name": "The Committee of Clocks" } },   // [L·enum] parts (V §2.4); name [L·text]
    "items": [
      { "id": "M.7.i1", "category": "curio", "primitives": [["clock_extension", "M"]], "drawback": ["ticking"],
        "skin": { "name": "Pocket Watch, Running Slow" } },
      { "id": "M.7.i2", "category": "garment", "primitives": [["muffled", "M"]],
        "skin": { "name": "Felt Bell Muffle, Worn as a Collar" } },
      { "id": "M.7.i3", "category": "weapon", "primitives": [["strike_kind", "blunt", "M"], ["knockback", "S"]],
        "skin": { "name": "Regulator's Winding Key" } },
      { "id": "M.7.i4", "category": "instrument", "primitives": [["lull", "M"]],
        "skin": { "name": "Damped Tuning Fork" } }
    ],
    "keepable": { "id": "M.7.k", "category": "curio",
                  "primitives": [["perception", "M"], ["clock_extension", "S"]], "drawback": ["ticking"],
                  "skin": { "name": "The Ninth Regulator's Repeater" } },     // budget 2 + 1 − 1 = 2 ≤ 5 (V §5.1), checked by [C]
    "consumable_weights": { "late_pass": "x2", "floor_plan": "x1.5" },        // [L·enum] weight classes
    "consumable_skins": [ { "slot": 1, "name": "Pierced Brass Token", "material": "brass" } ],  // ×12; name [L·text], material [L·enum]; kind binding is per run seed [C] (V D-V7)
    "npcs": [ { "template": "rival_visitor" } ],                              // [L·enum]
    "trace": [                                                                // [L·text], verified by code (§3.4)
      { "domain": "lateness", "quote": "licensed clocks by how they failed",
        "ids": ["hourly_demonstration", "escapement", "clock_extension"] },
      { "domain": "bells", "quote": "the bell that rings the hour also rings the alarm",
        "ids": ["herald", "alarm_network", "muffled"] },
      { "domain": "repair", "quote": "repaired by someone who disliked it",
        "ids": ["old_repair", "conservator_healer", "lull"] }
    ]
  },

  "balance": {                              // [C] every field: balancer (between S2 and S3), S3 and layout metrics
    "stats": { "M.7.s1": { "hp": [6, 7, 9, 10, 12, 14, 16, 18], "dmg": ["1d4", "1d4", "1d6", "1d6", "1d6+1", "1d8", "1d8+1", "2d6"],
                           "acc": "high", "def": "mid" } },                  // per run position 1–8; numbers illustrative
    "module_numbers": { "hourly_demonstration": { "period": 12, "bell_lead": 2 },
                        "alarm_network": { "guards": 2, "alarm_turns": 30 } },
    "offset_b": -0.08,                      // calibration b(d) (PL §6.ii)
    "measured": {
      "primary": "hazard_terrain", "secondary": "guarded", "dominant_persona": "cautious",
      "damage_mix": { "terrain": 0.34, "melee": 0.41, "ranged": 0.09, "status": 0.16 },
      "skill_gap": 0.27, "route_divergence": 0.38,
      "death_rate": [0.04, 0.06, 0.07, 0.09, 0.10, 0.12, 0.14, 0.16],
      "modules": { "hourly_demonstration": { "V1": 0.98, "V2": "+19pp", "V3": [0.97, 0.41], "V4": "ok" } }
    },
    "descriptors": { "cell": ["hazard_terrain", "rotunda"], "loopiness": 3, "openness": 0.52,
                     "glass": 0.31, "choke": 0.22, "dead_end_cost": 0.11 }
  },

  "text": {                                 // S4, all [L·text], linted and round-trip checked
    "door_blurb": "Every clock here is wrong in its own way.",              // ≤ 12 words
    "intro_panel": "...",                   // ≤ 120 words; states the signature module in one sentence
    "section_panels": ["...", "..."],       // ≤ 60 words; one announces the secondary module
    "labels": { "M.7.s1": { "tombstone": "...", "didactic": "...", "essential_ref": "escapement" } },  // essential_ref [C]: which Essential template the didactic must carry
    "quotations": ["..."],                  // ≤ 25 words
    "barks": { "rival_visitor": ["..."] },  // ≤ 12 words each
    "biography": ["..."],                   // 6–10 events; names the keepable and the Masterpiece (PS F15)
    "grammar": { "object": ["..."], "maker": ["..."], "date": ["..."], "donor": ["..."],
                 "observation": { "lateness": ["..."], "bells": ["..."], "repair": ["..."] } }   // §6.2
  },

  "visual": {                               // S5
    "species": { "M.7.s1": { "ornaments": ["inlay", "cracks"] } },           // [L·enum]; silhouette [R]; mask seed [C]
    "signature_grids": { "M.7.mp": ["................", "..."] },          // [L·grid] 32×32 for Masterpieces, 16×16 otherwise
    "tileset": { "floor": "walnut_parquet", "trim": "brass" }               // [L·enum]
  },
  "audio": { "mode": "mixolydian", "family": "bell", "tempo": "moderate",  // [L·enum] (TA §3.9)
             "motif": "c5 . e5 g5 | f5 . . _ | ..." },                     // [L·text] tracker text, linted

  "curation": { "decision": "accept_edit", "reasons": ["R8"], "edits": ["E2", "E2", "E1"],
                "minutes": 7, "note": "third bell joke cut" }               // [H]
}
```

**What the tags add up to.**
- The LLM writes names, prose, choices among ids, and two kinds of structured text (16×16 grids, tracker motifs). It writes **no number**: every HP, damage die, period, count, duration, budget and threshold is `[C]` (PS F8, TA F6, V §10.1).
- A typical department has about 45 enum choices (every one checked against the registry version it pins), about 120 free-text fields (all linted), 0–6 grids, and about 60 computed fields.
- The pack JSON is about 30–45 KB per department, most of it text. 30 departments add about 1–1.3 MB to the single-file build before compression; 100 departments about 4 MB. That is acceptable but should be watched (§12, risk 9).

---

## 3. The pipeline, S0–S7

### 3.1 Overview

```
batch planner (code) ── recipes ──► S1 FRAME (Opus, Batch) ──► frame validators ──► theme archive
                                                                                         │ select
        ┌────────────────────────────────────────────────────────────────────────────────┘
        ▼
   S2 COMPILE (Opus, Batch) ──► static validators ──(fail: diagnostics, ≤2 repairs)──► reject / unmatched-concept queue
        │
   BALANCER (code): role × run position → numbers
        │
   S3 SIMULATION GATE (Node, headless core): quick screen → full gate ──(fail: grammar repair, then S2 repair)──► reject
        │                                   └► measured fingerprint overrides the claim; descriptors → mechanical archive
   S4 TEXT (Opus, Batch) ──► text validators + round-trip check (Haiku) ──(fail: per-label regeneration ≤2)──► reject
        │
   S5 SPRITE + AUDIO SPEC (Opus, Batch) ──► grid and palette validators
        │
   S6 CURATOR CONSOLE (Julian): accept / edit / revise / reject with reasons
        │
   S7 PACKAGE: accession number + digest, pack JSON, CI coverage report
```

Order matters in three places:
- **Mechanics before text.** S4 runs after S3, so labels describe what the simulation measured, not what the frame hoped for. Qud rationalises causes after events for the same reason (PS F15).
- **Repair by grammar before repair by LLM.** Most S3 failures are local (one species too strong, a module never firing). A deterministic operator fixes those faster and without drift; the LLM is called only when the fix breaks the trace map.
- **Within a department the stages chain; across departments nothing chains.** No call ever sees another department from the same round (§3.2).

### 3.2 Diversity without temperature

Claude Opus 5.5 rejects `temperature`, `top_p` and `top_k`, and has no seed parameter (TA F5). PS §3.3's "high temperature" for S1 is therefore unavailable. Diversity has to come from inputs and from selection.

**The recipe.** The batch planner composes each S1 call from:

| Ingredient | Size | Example |
|---|---|---|
| Family | 6 at launch | machines |
| Subject category | 6 (V §9.2) | technology |
| Seed domain pair | about 48 domains → 1,128 pairs | lateness + bells |
| Constraint card | about 60 authored cards | CC-17 "Every object has been repaired by someone who disliked it." |
| Voice pool | 2 of 8 voices | dry_registrar, audio_guide |
| Exemplar set | 6 rotating sets of 2 hand-written frames | EX-3 |
| Target cell (targeted rounds only) | 42 cells (§4.1) | (hazard_terrain, rotunda) |

That is roughly 6 × 6 × 1,128 × 60 ≈ 2.4 million open recipes before voices and cells. The batch planner samples them to fill quotas (families, categories, domain coverage), not uniformly.

**Sample domains** (authored lexicon, closed enum, grows by review): glass, tides, debt, bells, salt, lateness, repair, cartography, thresholds, weather, counting, dust, keys, sleep, copying, inventory, lamps, distance, permission, ballast, ink, wax, queues, rain.

**Sample constraint cards** (authored, Calvino/Oulipo-style structures rather than motifs, LM F1–F9):
- CC-03 Every object was given by someone who wanted it gone.
- CC-08 The department was catalogued by someone who never saw the objects.
- CC-11 Nothing here is shown in the room it was made for.
- CC-17 Every object has been repaired by someone who disliked it.
- CC-21 The collection is defined by what it refused.
- CC-26 Every object is a copy; the originals are elsewhere and worse.
- CC-30 The department is arranged in the order in which things were lost.
- CC-34 Every label was written before its object arrived.
- CC-40 The objects are only on view at certain hours.
- CC-47 Everything here belonged to one household that never left it.

**Rules.**
1. **Breadth first, independent calls.** A round is N independent calls sharing only the cached prefix. No call sees another candidate. Generate-first-constrain-later gave 2.6× the entity diversity of conditioning each plot on the previous framing (PS F11); never ask for "a department related to the last one".
2. **Open rounds first, targeted rounds second.** The first round of a batch has no target cell (generate first). Later rounds target only cells the archive still lacks (constrain later). This keeps the 2.6× effect while still filling the grid.
3. **Small context.** The prefix holds the style guide, the enum registries and two exemplars; nothing else. More context produced pathological convergence in the Picbreeder-VLM replication (PS F11).
4. **Rotating exemplars.** Six exemplar sets, each cached as its own prefix. The text report (§9.6) measures how close outputs sit to their exemplars; a set whose outputs cluster on it is retired.
5. **No avoid-list in the prompt.** Listing existing departments to avoid can prime them. Dedupe happens after generation (§3.3, validator F7). See D-P7.

**Decision D-P7. Tell S1 what already exists?**
- (a) **No; dedupe afterwards (lean).** *No priming; costs some wasted frames (about 45% fail S1 validators in the §3.11 funnel anyway).*
- (b) Yes: a short avoid-list of the 5 nearest existing titles per recipe. *Fewer duplicates; risk of anchoring on exactly those titles.*
- *If (b):* measure duplicate rates both ways on one batch before keeping it.

### 3.3 S1 Frame

- **Input:** a recipe.
- **Output:** the `frame` block (§2.2).
- **Model:** Opus 5.5, effort `low` by default (measure `low` against `medium` on 20 recipes, TA T8), Batch API, structured output with the frame llm-schema.
- **Validators**, in order (F = frame):
  - **F1 Schema and enums.** The llm-schema guarantees shape; `lint.js` checks lengths and that the chosen third domain, voice, programme and palette ramps exist.
  - **F2 Banned words and clichés.** Hard list: labyrinth, mirror (as theme), infinite, tiger, dream, Babel, eldritch, arcane, ancient, mysterious, magical, exclamation marks (LM §3.3 rule 7); plus LLM tells: ethereal, whispers, echoes of, tapestry, testament, delve, forgotten, timeless, liminal; plus the `jevslop` stock-phrase list (TA §3.5). Any hit rejects the frame.
  - **F3 Trope titles.** A pattern list of genre labels and trope magnets (steampunk, underwater city, clockwork city, asteroid mining, "Hall of Forgotten X"; CrawLLM's examples, PS F10). Reject.
  - **F4 Specificity.** A Haiku 5.5 extractor returns, from the conceit, (i) a named material, (ii) a named practice (a verb phrase someone performs), (iii) a concrete detail of place or institution. All three must be found and must quote the conceit verbatim. CrawLLM found themes came through "only when all such details were highly specific" (BK F8).
  - **F5 Real-world leakage.** No real years, centuries, eras, places, institutions, museums, curators or donors (a named-entity list plus a Haiku extractor). The calendar anchor must refer to an institutional event.
  - **F6 Sensitivity question.** Haiku 5.5 answers "Which real group, culture, religion or nation does this read as? Answer NONE, or name it and quote the phrases." Any answer other than NONE flags the frame for Julian with the quotes; for the `land` category the frame is held until Julian clears it. No human remains (keyword list plus the same judge).
  - **F7 Theme dedupe.** Distance to the theme archive and to other candidates in the round (§4.2). Pairs below threshold go to a Haiku "same idea?" judge; on yes, keep the candidate with fewer validator warnings.
- **Refusals.** A `stop_reason: "refusal"` is logged with its category and the recipe is dropped. It is not retried on another model: a refusal on a museum frame is a signal about the recipe.
- **Selection.** Survivors enter the theme archive. The planner then picks frames for S2 to fill family and category quotas and, in targeted rounds, the target cells.

### 3.4 S2 Mechanical compile

- **Input:** one frame, plus the full vocabulary registry (cached), the family's favoured lists and the module × programme matrix (V §6.4, §9.1).
- **Output:** the `spec` block, including the trace map.
- **Model:** Opus 5.5, effort `medium`, Batch API. The "function calls into the vocabulary" pattern (PS §3.3) is implemented as **structured output** whose enums are the registry ids, because forced `tool_choice` returns a 400 on Opus 5.5 (claude-api skill). Structured outputs then guarantee that every id exists; `lint.js` checks everything else.
- **Validators** (C = compile):
  - **C1 Closed-enum references.** Every id exists in the pinned vocabulary version; roles are allowed for the archetype; modifier rules hold; Masterpiece assembly follows V §2.4; item budgets hold (V §5.1).
  - **C2 Compatibility.** Module × programme matrix (× forbidden), forbidden module pairs, the secondary module not from the signature's family, composition limits (≤ 6 hostile archetypes, ≤ 2 modules, ≤ 6 distinct modifiers, V §14 risk 1).
  - **C3 No decoration.** Every domain maps to ≥ 1 id in the trace map; every module, species archetype, item primitive and the Masterpiece core appears in at least one trace entry; every `quote` occurs verbatim in the frame. A Haiku judge rates each link plausible or not; implausible links are flagged, not rejected (judges filter, they are not objectives, PS pitfall 4).
  - **C4 No unused components (static).** Every chosen effect has a target in this department: `light_control` needs a darkness source or a light-reactive species; `uniform` needs guards; `lull` needs dormant exhibits (always true); `surprise_bonus` needs a stealth route. The dynamic check (fires in ≥ 90% of seeds) is in S3.
  - **C5 Counterplay.** Every species has ≥ 2 counter tags satisfiable at its tier by the base kit, the layout rules and the department's own item pool, at least one not `avoid` (V §1.9). The claimed primary challenge's required counter is present (V §8.2).
  - **C6 Popularity quotas.** No archetype may already sit in more than 40% of the pack plus this batch (V §11.2: at least 3 and at most 12 of 30). S2 over-picks plodders, kiters and statues otherwise (PS F11).
  - **C7 No silent fallback.** If the model cannot express part of the frame, it must say so in an `unmatched` field (free text, ≤ 30 words) instead of picking something arbitrary. Non-empty `unmatched` sends the concept to V's unmatched-concept queue (V §11.4); the department may still proceed if the trace map holds without it. A Rogue Dream's random fallback is the failure this prevents (PS F6).
- **Repair loop.** Validator output is structured (`{check, id, message, allowed_fixes}`). One repair call returns a patched spec; at most 2 rounds, then reject. Expected: about 80% pass after repair (a guess to measure).

### 3.5 The balancer (between S2 and S3)

Deterministic code, owned by the vocabulary and difficulty drafters (V §10.4). For the pipeline it matters only that:
- it is a pure function of (spec, vocabulary version, reference kit table K(t));
- it writes `balance.stats` and `balance.module_numbers`;
- S3 then fits `offset_b`.

### 3.6 S3 Simulation gate

**What runs.** The headless core in Node, the layout generator at the pinned version, and the persona roster (V §1.1: Tourist, Vandal, Looter, Completist, Cautious, Sneak; novice, median and expert; module-blind variants).

**Two passes.**
1. **Quick screen** (1 tier, 10 seeds, the six median personas: 60 playthroughs, about 30 s on one core at an assumed 0.5 s per playthrough, from TA F4's ~1 ms per turn). It rejects the obvious: worst-case runner deaths, a module that never fires, a species that causes most deaths.
2. **Full gate** (3 tiers × 50 seeds: about 750 median-persona runs for calibration over 5 iterations, plus 3,300 battery runs). About 4,050 playthroughs, or 34 core-minutes per department; 60 departments take about 4 hours on 8 cores. An overnight job.

**Checks** (G = gate; the thresholds are V's where V sets them):

| Check | Passes when | Source |
|---|---|---|
| G1 Layout validity | The layout validator passes on ≥ 95% of seeds at every tier; fallbacks logged | PL §6.i |
| G2 Worst-case runner | An A* runner with the tier's minimum kit and every enemy at maximum damage reaches an exit on every validated seed | PL F12 |
| G3 Calibration | b(d) converges within [−0.5, +0.5]; outside that range the department's composition, not its numbers, is wrong | PL §6.ii |
| G4 Consistency | The median persona's death rate varies across seeds by ≤ 0.08 (standard deviation) at each tier | PL F8 |
| G5 Skill matters | Expert minus novice survival Δ ≥ 0.15 | PL F8 |
| G6 Choices exist | Route divergence between personas > 0.2 | PL F12 |
| G7 Modules | V1 fires in ≥ 90% of seeds; V2 aware beats blind by the module's margin; V3 Intro gallery is teachable; V4 not degenerate | V §6.1 |
| G8 No unused components | Every item primitive and species fires in ≥ 90% of seeds | V contract 4 |
| G9 Death concentration | No species causes > 40% of deaths at any tier; no item appears in > 80% of expert wins with a large effect | V §11.4 |
| G10 Fingerprint | The measured challenge fingerprint (V §8.2) identifies a primary type | PS F12 |

**Honest relabelling (G10).** If the fingerprint clearly identifies a *different* primary than the frame claimed, the department is relabelled to the measured type and continues: text has not been written yet, so this costs nothing. If no type dominates, the department is "mixed"; at most 10% of a pack may be mixed, labelled by their strongest type. The frame's claim is a target; the measurement is the fact.

**Repair.**
1. **Grammar repair first.** A deterministic operator applies one local change suggested by the diagnostic: swap the offending species for another archetype of the same role with different counter tags; lower a module parameter class; remove the secondary module; change a count class. Then re-run the quick screen. At most 3 attempts.
2. **LLM repair second.** If no grammar fix passes, or a fix breaks the trace map (C3), S2's repair call gets the diagnostics. At most 1 round.
3. Otherwise reject, with the diagnostic kept as a reason.

**Output.** `balance.measured`, `balance.descriptors`, and the department's cell in the mechanical archive (§4.1).

A caution from this repo: in scriptprof, eight playability and depth metrics could not tell human-designed games from their mutants at matched solvability (no metric above 58%; `scriptprof/NOTES.md`, "Does the depth metric see design? No."). G1–G10 are *gates against failure*, not measures of quality. Quality is Julian's call in S6.

### 3.7 S4 Text

- **Input:** frame, compiled spec, measured fingerprint, the Essential-line template of every id (V contract 7), the voice, and the text caps.
- **Output:** the `text` block: door blurb, intro panel, 2–4 section panels, tombstone and didactic for every species, highlight, item, the keepable and the Masterpiece; 1–2 wall quotations; barks; the collector biography; twelve consumable skin names; the runtime grammar (§6.2).
- **Model:** Opus 5.5, effort `medium`, Batch API; per-label repairs at `low`.
- **Caps** (after LM §3.3 and F21; the text drafter may change them): door blurb ≤ 12 words; intro panel ≤ 120; section panel ≤ 60; didactic 50–90 (gateway objects up to 120); first sentence under 16 words; tombstone one line; wall quotation ≤ 25; bark ≤ 12.
- **Validators** (T = text):
  - **T1 Round-trip honesty.** A Haiku 5.5 extractor reads each label *without the spec* and returns, from a closed list, the mechanics it believes the label states (archetype behaviour, wake trigger, counter, item effect). Pass requires: (i) the Essential claim for that label's `essential_ref` is recovered, and (ii) the label claims nothing the spec does not contain. Exactly one Essential line per didactic. The only permitted mismatches are the declared lies of a `lying_labels` department, and then the extractor must find exactly those (V §6.2 notes).
  - **T2 Lengths and fields.** Caps above; every tombstone field present (title, attribution, date in the fictional calendar, medium, dimensions, credit line, accession number).
  - **T3 Banned words and clichés.** As F2, per label: zero hard hits. Soft-banned words have pool-wide frequency caps (for example "quiet" or "faint" at most once per 50 labels).
  - **T4 Real-world leakage and sensitivity.** As F5 and F6, on every text field, including the biography and quotations.
  - **T5 Pool repetition.** n-gram overlap with the rest of the pack, sentence openings, title templates (§9.6). A label whose 4-gram overlap with the pack exceeds a threshold is regenerated.
  - **T6 Style.** Em-dash rate, sentence-length variance ("burstiness", TA §3.5), and a Haiku judge on register ("institutional deadpan, not whimsical", LM §3.3). The judge flags; Julian decides.
- **The tooltip trap.** A label written to pass T1 tends to read like a tooltip ("This exhibit moves only when unobserved."). The style guide asks for the Essential line in observational museum register ("Keepers report that it ignores anything that does not tick"), and T6 flags tooltip phrasing. This is the round-trip check's version of judge hacking (PS pitfall 4).

### 3.8 S5 Sprite and audio spec

- **Model:** Opus 5.5, effort `low`, Batch API.
- **Fixed by registry, never by the LLM:** silhouette class (from the archetype, V §1.7), the behaviour tag glyph and trim colour (V §1.8), idle tells.
- **Chosen from enums:** ornaments, palette ramps (about 30 authored material ramps, TA §3.4), tileset variants, audio mode, instrument family, tempo.
- **Written as structured text:** 16×16 index grids for signature exhibits and 32×32 for Masterpieces (TA F10, evidence n = 5), and a tracker motif.
- **Validators:** grid dimensions and palette indices; no reserved hue; silhouette overlap with the archetype's mask at least 0.7 IoU, so a hound still reads as a `beast`; contrast floor against the department's floor ramp; two hostile species in one department differ in silhouette or tag; motif syntax, range and length.
- **Fallback:** any failed grid falls back to archetype silhouette plus ornaments (TA §3.4 source b), silently.

### 3.9 S6 The curator console

A single page (`tools/curator.html`) in the scriptprof gallery pattern (PL F19). One department per screen:

```
M.7 candidate 0412 · Machines · technology · vocab 1.3.0 · gen g4          [Accept] [Edit] [Revise…] [Reject ▾]

FRAME     title, conceit, domains, card, voice, founder        | FLAGS     validator warnings, ranked
TRACE     domain → ids, with the quoted frame phrases          | NEAREST   theme: K.3 (0.31), T.2 (0.36)
SPEC      species (glyph, archetype, modifiers), Masterpiece,  |           cell: 2 others in (hazard_terrain, rotunda)
          items, keepable, modules                             | SENSITIVITY  NONE ×3, or quoted phrases
SIM       persona bars per tier; claimed vs measured type;     | REPAIRS   grammar 1, LLM 0 · cost $0.41
          V1–V4; skill gap; death causes                       |
LAYOUTS   6 seeded floor plans with metrics                    | [Play tier 1] [Play tier 5] [Seed…]
ATELIER   sprites under the palette, reserved-hue overlay      |
LABELS    every label; Essential line highlighted; T1 result   |
```

**Blind first look (optional).** Flags, sim and nearest neighbours stay hidden until Julian records a 60-second gut call (keep / maybe / drop) from the frame and labels alone. This measures whether the automated gates agree with first impressions, which is exactly the evidence the v2 gate needs.

**Actions.**
- **Accept.**
- **Edit** (direct): E1 retitle; E2 rewrite labels; E3 swap a species; E4 change a module parameter class. E3 and E4 re-run S3 automatically.
- **Revise** (language-level): Julian types a note such as "more tidal, less martial"; it becomes an extra constraint card and S2–S5 re-run with chosen fields locked. This is ELMER's idea of natural language as the genotype (PS F19). The only free text that ever reaches a prompt is Julian's.
- **Reject**, with one or more reason codes: R1 decorative (theme does not change play); R2 trope or generic; R3 sensitivity; R4 duplicate (theme or mechanics); R5 unfair or spiky (sim missed it); R6 dull (no interesting decisions); R7 incoherent (parts do not belong together); R8 text voice or quality; R9 sprite quality; R10 illegible or too complex; R11 other (note required).

**The curation coefficient.**
- CC = (accepted + accepted with minor edits) / presented. "Minor" means at most three E1/E2 edits and no re-simulation.
- Rescue rate = accepted after E3, E4 or Revise / presented.
- Both are reported per generator version (g4, g5, ...). A Rogue Dream reported 66% (PS F18); a pipeline below 50% is wasting Julian's time.

**Feedback.** After each batch, reason counts drive changes: R1 and R6 go to the vocabulary queue (the verbs could not say what the frame wanted); R2 and R8 to the prompts and banned lists; R3 to the sensitivity lexicon; R4 to the dedupe thresholds; R5 to S3 thresholds. Each change is a new generator version, never an edit in place.

**Time budget** (estimate): about 6 minutes per presented department, plus playing one in three for 10 minutes. A launch batch presenting 48 departments costs about 5 hours of review and 3 hours of play.

**Decision D-P8. How much does Julian curate?**
- (a) **Every department, with a play sample (lean for v1).** *About 8 hours per launch batch; the curation log becomes the v2 evidence.*
- (b) Every department, no play. *About 5 hours; misses feel problems the sim cannot see.*
- (c) A sample, with automated acceptance for the rest. *Scales; this is effectively v2's risk profile shipped in v1.*

### 3.10 S7 Packaging

- **Identity.** The department gets the next free number in its family register (`M.7`). Numbers are never reused; a retired department keeps its number with status `deaccessioned` (§6.3).
- **Content address.** `digest` = the first 8 hex of sha256 over the canonical JSON. The human address is the accession number; the content is pinned by number plus digest (`M.7@3f9a2c1e`). A re-installed (revised) department keeps its number and gets a new digest; packs are append-only, so old replays still load the old version.
- **Seeds.** All per-department RNG streams derive from (run seed, stream name, number@digest), after TA §3.2.
- **Pack.** `packs/permanent-P1.2.json`, inlined into the single-file dist. The runtime does a cheap shape check only (TA §3.3).
- **What the sequencer gets** (interface to the run-structure drafter): measured primary and secondary, ordinal, family, programme, placard data (title, blurb, challenge pictogram, reward icon), and flags such as `never_first` (V Table B constraints).
- **CI.** Build tests (every department loads, lays out on 20 seeds, simulates the quick screen and renders) plus the coverage report (§4.4).

### 3.11 Cost and time of one launch batch

Token assumptions per call (labelled estimates; TA §3.6 method and prices, Opus 5.5 via Batch at half price, cache reads included):

| Stage | Cached prefix | Uncached input | Output (incl. thinking) | Cost per call (Batch) |
|---|---|---|---|---|
| S1 frame | 6k | 0.8k | 2.5k | $0.027 |
| S2 compile (incl. 0.6 repairs average) | 14k | 2.5k | 8k | $0.118 |
| S4 text (incl. label repairs) | 10k | 7k | 11k | $0.144 |
| S5 sprite and audio | 5k | 2k | 3.5k | $0.040 |
| Haiku 5.5 judges (about 60 calls) | 1.5k each | 0.6k each | 0.45k each | $0.009 total |

**Funnel** for 30 accepted departments (rates are guesses to be measured):

| Step | In | Out | Pass rate |
|---|---|---|---|
| S1 frames | 400 | 220 pass F1–F7 | 55% |
| Selection into S2 | 220 | 100 | planner |
| S2 + static validators | 100 | 80 | 80% |
| S3 quick screen | 80 | 60 | 75% |
| S3 full gate | 60 | 48 | 80% |
| S4, S5 | 48 | 48 | regenerate on failure |
| S6 curation | 48 | about 31 | CC 0.65 |

**Totals.** About **$33** of tokens on Opus 5.5 via Batch (about $66 interactive), or about $1.06 per accepted department. Most batches finish within an hour and all within 24 hours (claude-api skill). Simulation: about 4 hours on 8 cores. Julian: about 8 hours. The money is a rounding error; Julian's hours are the budget (TA §3.6 reaches the same conclusion).

**Decision D-P6. Model per stage.**
- (a) **Opus 5.5 for S1, S2, S4, S5; Haiku 5.5 for judges and extractors (lean).** *Strongest generation at trivial cost; one model family to prompt-tune.*
- (b) Sonnet 5.5 for S1 and S5, Opus for S2 and S4. *Halves a cost that is already small; two prompt families to maintain.*
- (c) Opus everywhere, including judges. *Better extractor recall; judges cost 40× more and still need to be independent of the generator's habits.*

---

## 4. The two archives

### 4.1 The mechanical archive: constrained MAP-Elites

**Axes (lean).** *Measured* primary challenge type (7 values: swarm, artillery, guarded, darkness, hazard_terrain, locks_puzzle, attrition; social is secondary-only at launch, V D-V3) × architectural programme (6 launch programmes) = **42 cells**.

**Per cell.** A feasible population (passed S3) and an infeasible one (failed S3, kept with diagnostics, after Khalifa et al. 2018, PL F17). Each cell keeps up to 3 elites rather than 1, because the pack draws themes from the archive and two departments may legitimately share a cell.

**Fitness among feasible departments** (PL §6.iii): skill differentiation + route divergence − cross-seed death-rate variance. Fitness ranks elites inside a cell; it never overrides Julian.

**Operators.** Two, compared on the same archive:
1. **LLM operator:** S1–S2 with a targeted recipe for an empty or weak cell.
2. **Grammar operator** (option D): mutate an existing elite's spec by one local change (swap an archetype within role, change a module or its parameter class, change programme), keep the frame, re-run S3 and later S4. Cheap and deterministic.

scriptprof found its structural operator roughly 3,000× faster than the LLM operator and argued that the LLM's value must be measured as "quality per unit time" and by "whether its children land in archive cells the grammatical operator cannot reach" (PS F14). The same measurement applies here: cells reached per hour and curation coefficient per operator.

**Decision D-P3. Mechanical archive axes.**
- (a) **Measured challenge × programme, 42 cells (lean).** *Both axes are categories Julian, the sequencer and the door placards already use; gaps read directly ("no artillery rotunda").*
- (b) Measured challenge × measured spatial character (4 buckets of loopiness and dead-end cost), 28 cells. *Further from the inputs (PCG book ch. 12's advice, PL F24); a bucket can hide two programmes that should look different.*
- (c) Persona dominance × loopiness, after PL D6. *The purest behavioural descriptor; persona dominance is a noisier label than the fingerprint rules in V §8.2.*
- *If (b) or (c):* programme becomes a quota (each ≥ 3 departments) instead of an axis, and §4.4's coverage target changes.

Whichever is chosen, the archive records the others as metadata, and the expressive-range report (§9.1) uses the measured spatial descriptors, because an archive axis that is also a generator input only confirms itself.

### 4.2 The theme novelty archive

- **Representation.** An embedding of title + conceit + collecting policy + domains. The Claude API, as documented in the skill I checked, has no embeddings endpoint, so this needs a local sentence-embedding model chosen at build time; the fallback is TF-IDF over content words plus Jaccard distance on domains.
- **Novelty** = mean distance to the k = 5 nearest frames in the archive. A frame enters if its novelty exceeds a threshold τ, or if it beats its nearest neighbour on validator warnings (constrained novelty search, BK F5).
- **Near-duplicates** below a lower threshold go to the Haiku "same idea?" judge (F7). CrawLLM's pool contained both "Gothic Victorian" and "Victorian era" (PS F10); string dedupe would not catch the next such pair.
- **Domain-pair coverage.** A 48 × 48 matrix of which pairs have produced an accepted department; the planner prefers unused pairs.

### 4.3 From two archives to one pack

Each department has a cell and a theme vector. The shipped pack is chosen greedily:
1. Order cells by scarcity (fewest feasible elites first).
2. In each cell, pick the elite whose minimum theme distance to the already selected departments is largest, subject to quotas.
3. Quotas: each launch family 4–5 departments; each primary type ≥ 3; each programme ≥ 3; each launch archetype in 3–12 departments; mixed departments ≤ 10%; Peoples 0 at launch (≤ 1 in 4 later, LM §4.2).
4. Julian may lock or veto any choice.

### 4.4 Diversity as a CI number

Every pack build prints a report, and CI fails on a broken contract. Illustrative output for a 31-department pack:

```
pack permanent-P1.2 · 31 departments · vocab 1.3.0 · gen g4
mechanical cells (measured primary × programme)   24 / 42 filled (57%); 24 / 38 legal (63%)
QD-score                                          18.7
theme dispersion (mean NN distance)               0.41  · min 0.22 (K.3 ~ K.5)  WARN
families      A5 L5 T5 M6 S5 K5                    OK
primaries     swarm 5 · artillery 4 · guarded 5 · darkness 4 · hazard 6 · locks 4 · attrition 3   OK
programmes    enfilade 6 · rotunda 5 · grand_hall 5 · case_lab 5 · stacks 5 · court 5            OK
archetypes    min 3 (binder) · max 11 (plodder, 35%) · Gini 0.21                                  OK
oatmeal ratio (bot-play)                          2.6   (contract ≥ 2.0)                          OK
mechanical twins (O_d < 1.0)                      0                                               OK
text: distinct-3 0.83 · top repeated 4-gram "is said to have" ×9                                  WARN
dud dashboard: p_broken ≈ 0.6% (95% CI 0.1–2.1%) → runs with a broken dept ≈ 4.7%
```

**The contract** (proposed; Julian sets the numbers): legal-cell coverage ≥ 60% at launch and non-decreasing across updates; every quota in §4.3; oatmeal ratio ≥ 2.0; no mechanical twins; no hard-banned word anywhere; no unreviewed sensitivity flag.

---

## 5. The Directory

### 5.1 What it is for

The Directory is where the museum's infinity lives (pillar 5). It names departments nobody can visit, in the Celestial Emporium manner, so that the playable collection reads as the open part of something much larger. It costs strings, carries no dud risk, and needs no model at runtime.

Rules:
- **The institution is the joke** (LM F3). The list's absurdity belongs to the museum's own bureaucracy. No entry names or implies a people, nation, religion or real place.
- **Borrow the structure, not the furniture.** No Borges creatures, no labyrinths or mirrors, and the hard banned list applies (LM §3.3 rule 7).
- **Background, not foreground.** Compton: "many artifacts can [be] drab background noise, highlighting the few characterful artifacts" (PS F16). Directory lines are allowed to be oatmeal; about one in five is a hand-written line from a curated list so that the best ones recur.

### 5.2 The grammar

A closed, Tracery-style grammar with authored lexicons. Because every filler is authored, the whole lexicon can be checked statically against the banned list and the sensitivity judge whenever it changes; the build also expands 10,000 random lines and runs the same checks on them.

```
entry      := #things# That #odd_verb#
            | #things#, Considered as #things2#
            | #things# Known Only From #evidence#
            | #things# Lent by #lender#
            | #things# Not Yet #participle#
            | #things# #qualifier#
            | Smaller Versions of #dept_ref#
            | Departments Currently #state#
line       := (#letter#) #entry#. #location#. #status#.
things     := ~120 plural nouns, each tagged with 1–2 domains and a family
               (Bells, Keys, Umbrellas, Ladders, Calendars, Maps, Hats, Ledgers, Lamps, Spoons, Stairs, Gloves, ...)
odd_verb   := ~40 (Keep Time Badly, Were Never Rung, Ran Out Early, Arrived Late, Refuse to Be Counted, ...)
evidence   := ~30 (Their Handles, Their Repair Manuals, Complaints, Their Packing Crates, Their Shadows on the Wall, ...)
lender     := ~30, institutions, staff roles and objects only (the Night Staff, the Department of Lost Property,
               a Lighthouse That Has Since Retired, the Weather, Their Own Makers, ...)
qualifier  := ~25 (Worn Once, by Arrangement · Mistaken for Furniture · of Distinction · Arranged by Year · Folded the Wrong Way, ...)
location   := Floor #n#, #range# · Rooms #range# · Lower Mezzanine · Loading Bay · Floor 7½ · Throughout the Building, ...
status     := Open · Closed for reinstallation · On tour · Not yet catalogued · By appointment only ·
              Flooded (see Tides) · Temporarily removed for cleaning · Under recount · Staff only · Closed
```

With these lexicon sizes the grammar yields several hundred thousand distinct entries before locations and statuses. Each run seeds its own Directory from (run seed, `'directory'`).

### 5.3 Where it appears

| Place | What the player sees |
|---|---|
| **Lobby Directory** (Entrance Hall) | A lettered list, (a) to (n) plus "(o) et cetera (overflow storage)", about 15 lines. The run's departments that are open tonight appear among the fictions with their accession numbers in small type; an entry with a number is one you might reach. Players learn this without being told. |
| **Stair Hall signage** | Range signs for the floor: "Rooms 400–499: Instruments That Keep Time Badly → · Rooms 1210–1288: Doors Known Only From Their Handles (not yet catalogued)". |
| **Closed doors inside departments** | Decorative dead-end doors (from the layout) carry a placard and a closure reason. About 30% name a real pack department that is not in this run ("Closed tonight"), 70% are fictions. The real ones foreshadow; the fictions extend the building. |
| **Elevator panel** | Buttons for every floor; the run's three floors are lit. The others are dark ("−4 Storage, Not Yet Catalogued", "7½ Departments Awaiting a Department"). Pressing a dark button gives "This floor is closed to visitors." |
| **Floor plan margins** | Neighbouring departments off the edge of the plan, printed in grey. |
| **"Not on view" labels** | A label without its object, naming the department it is "on loan to" (Lem's labels without objects, LM F11). |

**In v2** a Directory line can become a recipe: its fillers carry domain tags, so "Doors Known Only From Their Handles" maps to domains (thresholds, evidence) plus an absence card. A door that was closed in run 5 can open as a Temporary Exhibition in run 12.

### 5.4 Fifteen example entries

As they would appear on the lobby Directory one evening, (a) to (o), with the closing "et cetera" line. Only (a) is a playable department in this example; the lobby gives real departments a floor, not room numbers, because the run's order is not fixed until doors are chosen.

> (a) Instruments That Keep Time Badly. Floor 2, West Range. Open. *M.7*
> (b) Hats Worn Once, by Arrangement. Floor 4, North Range. Closed for reinstallation.
> (c) Bells That Were Never Rung, with the Reasons Given. Lower Mezzanine. By appointment only.
> (d) Doors Known Only From Their Handles. Rooms 1210–1288. Not yet catalogued.
> (e) Rain Kept Under Glass, Arranged by Year. The Damp Wing. Flooded (see Tides).
> (f) Things Mistaken for Furniture by the Night Staff. Ground Floor, behind the café. Open; please do not sit.
> (g) Second-Best Examples. On tour.
> (h) Labels Whose Objects Were Lent Elsewhere. Throughout the Building. Open.
> (i) Gifts the Museum Refused, with the Correspondence. Floor 2, East Range. Under review since the Third Calibration.
> (j) Smaller Versions of Larger Departments. Rooms 3300–3399 (the rooms are also smaller).
> (k) Maps Folded the Wrong Way. Floor 5. Closed until refolded.
> (l) Animals That Were Tidier Than Expected. Natural History Annexe. Temporarily removed for cleaning.
> (m) Packing Materials of Distinction. Loading Bay. Staff only.
> (n) Calendars That Ran Out Early. Floor 6. Closed for the remainder of the year.
> (o) Departments Awaiting a Department. Floor 7½. Closed.
> (p) Et cetera. Basement and below. Not open to the public.

---

## 6. Text at runtime

### 6.1 What is written when

| Text | Written | By |
|---|---|---|
| Intro and section panels; labels for species, highlights, items, the keepable and the Masterpiece; quotations; barks; biography | Offline (S4) | LLM, curated |
| Study-collection (minor case) labels | Runtime | Department grammar (§6.2) |
| Accession numbers | Runtime | Code (§6.3) |
| Credit lines and condition reports | Display time, from state | Code (§6.4) |
| Consumable appearance names | Offline names; per-run binding | S4 names, run seed binds kinds (V D-V7) |
| Directory, signage, closed doors | Runtime | Directory grammar (§5) |
| Door placards | Pack data + runtime state | S4 blurb, S3 measured type |

The split follows PS F16: one centrepiece and 2–3 highlights get full labels; the many study-collection cases are "perceptually differentiated but not unique".

### 6.2 The domain-keyed replacement grammar

Each department ships a small grammar written by S4, keyed by its domains, after Caves of Qud's domain-keyed text (PS F15). Slots: `object`, `maker`, `date`, `material`, `donor`, and `observation.<domain>` (8 lines per domain). Templates are museum-wide and authored:

```
study_tombstone := #object.capitalize#. #maker#. #date#. #material#.
study_note      := #observation.<domain>#        (domain drawn by the case's room tag)
```

From the M.7 grammar:

```
object       pocket chronometer · balance wheel · hand bell, cracked · repeating watch · escapement model · dial blank
maker        the Guild of Regulators · an unrecorded repairer · the Lower Horology workshops · a bell-founder of the Fourth Landing
date         after the Second Calibration · about the year of the Late Bell · before the clocks were wound back
material     brass · bell metal · walnut · enamel · gut string
donor        the Guild of Regulators · the Night Staff · a household that preferred silence
observation.lateness  "Runs about four minutes behind the other objects in this case." ...
observation.bells     "The clapper has been tied with a later ribbon." ...
observation.repair    "Repaired at least three times, each time by someone who disliked it." ...
```

One expansion, as a player sees it in Room 412:

> **Balance wheel.** An unrecorded repairer. After the Second Calibration. Brass, gut string.
> Repaired at least three times, each time by someone who disliked it.
> M.7.412.3 · Gift of the Guild of Regulators

**Rules.**
- Minor labels carry flair and fact-giving lines only (DATA Agent's typology, PS F5). They never make a mechanical claim. If the case holds loot, code appends the item's own tombstone (for an unidentified consumable only "After M.7", V §5.4), so no grammar line can lie about an item.
- Observations are dealt from a per-visit deck without replacement. With 24 observations and about 40 cases, the deck runs out and later cases show the tombstone only, which is how real study collections look.
- The grammar is linted at S4 time like any other text (T2–T5), including all of its expansions up to a sample of 500.

### 6.3 Accession numbers, Wilkins-coded

Wilkins spelled meaning into words (*de* element, *deb* fire, *deba* a flame, LM F3). The numbers here spell where a thing comes from, so a player can read partial identity from them (LM §3.1).

| Form | Example | Meaning |
|---|---|---|
| Department | `M.7` | Family letter, then the department's number in that family's register (order of accession, not difficulty) |
| Catalogued object | `M.7.4` | A named object of the department: species, highlight, item, keepable, Masterpiece. Stable across runs. |
| Study-collection lot | `M.7.412.3` | Placed at runtime: found in Room 412 (run position 4, gallery 12, after CS's d00–d99 room numbering), third object of that room's lot |
| Copy | `A.3.4/a` | Copies family: a copy of `A.3.4`; the original has no suffix (V `copies_weaken`) |
| Lost Property | `LP.14.2` | From run 14's death |
| Your Collection | `YC.31` | The 31st object you accessioned |
| Temporary Exhibition | `TX.417.3` | Generator batch 417, exhibition 3 (v2) |
| Commission | `CM.40211.2` | Visitor 40211's second commission (v3) |
| Unrecorded | `X.7.412.3` | Found in the collection, circumstances unrecorded |

**Family letters:** A Copies (*After*), L Light, T Tides, M Machines, S Specimens, K Classification (*Kinds*). Later: R Memory (*Recall*), Z Scale, V Absence (*Vacancy*), W Writing, G Attendance (*Gallery-goers*), P Peoples. Institutional series always use two letters (LP, YC, TX, CM) and families one, so `L.4` and `LP.14` cannot be confused.

**What a player learns to read.**
- The family letter says which rules may be active (M: schedules and partitions).
- Three parts mean a catalogued object with a full label; four parts mean study collection.
- The room's first digit says how deep in the run it was found.
- A gap in a department's room numbers is a secret room (LM §3.1, CS).
- `/a` means a copy.
- **No number at all** means a mimic vitrine (V §2.1: "its label has no accession number"). The numbering system is already a tell.
- `TX` and `CM` mean "not yet catalogued": uncurated content.

**Numbers as keys.** Runtime RNG substreams use the number: `rng(runSeed, 'loot', 'M.7.412.3')`. A lot is therefore reproducible from the run seed, and a bug report can name an object.

**Decision D-P9. Numbering scheme.**
- (a) **Wilkins-coded family letters, as above (lean).** *Readable, a minor puzzle for players, shareable; family letters must be fixed early.*
- (b) Met-style year.lot.item (`1931.7.4`) in the fictional calendar. *More authentic-looking; carries no gameplay meaning.*
- (c) Opaque digest only. *Simplest; loses a museal signal and the mimic tell.*

### 6.4 Credit lines carry item state

The credit line is computed from item state each time a label is displayed (LM F25: "credit line = item state"). The core-systems and meta drafters own the states; this is the text side.

| Item state | Credit line | Number |
|---|---|---|
| Placed in a case this run, untouched | Gift of #donor# (department grammar) | `M.7.412.3` |
| Bought in a gift shop | Purchase, the #fund# Fund | unchanged |
| Carried from an earlier department this run | Transferred from the Department of Instruments That Keep Time Badly | unchanged |
| Brought in on the run's Loan slot | On loan from Your Collection | `YC.n` |
| From an earlier death | Bequest of the visitor who fell in Room 412 (Run 14) | `LP.14.n` |
| Taken from a keeper without asking (Peoples, later) | Found in the collection, circumstances unrecorded | `X.…` |
| Returned to its lenders (later) | Lent by the Porters' Hall | unchanged |
| A forgery, once revealed | After #maker#. A copy; deaccession pending | unchanged |
| Accessioned at the Registrar | Gift of Visitor 40211, Run 22 | `YC.n` |
| Destroyed | Deaccessioned (destroyed in Room 512) | struck through |

Condition (Excellent / Good / Fair / Poor, LM §3.1) prints on the line below and changes with durability and Restoration kits.

---

## 7. Temporary Exhibitions (v2)

### 7.1 In the fiction

A Temporary Exhibition is a ticketed, uncatalogued department. Its door placard is a paper poster rather than engraved brass, carries "Temporary Exhibition · not yet catalogued" and a `TX` number, and shows the same challenge pictogram as any door. Players opt in twice: a setting ("Temporary Exhibitions: off / on"), off by default, and the door choice itself. They are never offered in run positions 1–2, at most one per transition, and never as the only door.

Reward for the risk (to be priced by the run-structure drafter): for example an extra Restoration kit, or a second accession pick from that department. Every Temporary Exhibition grants a free Evacuation card (`exit_jump`) on entry: the diegetic safety valve, after Spelunky's bomb (BK F10), so a broken exhibition costs minutes, not the run.

### 7.2 Option T1: a server with a rolling buffer (lean)

```
nightly (Batch API):  planner → S1–S5 automated (no S6) + full S3 gate → accept/reject
                      accepted → stored as TX.<batch>.<n> in KV/object storage → buffer
browser ── GET /tx?cell=hazard_terrain&avoid=… ──► Worker ── picks from buffer ──► department JSON
          (falls back to the static pack on any error or timeout)
```

- The buffer holds a few hundred exhibitions spread over cells; the Worker serves one the player has not seen, for the requested cell.
- **Latency disappears**, because nothing is generated in the request path; the full S3 gate (34 core-minutes per department, §3.6) runs in the nightly job, where there is time for it.
- **Determinism:** the run's replay records the `TX` numbers it was served, not prompt seeds. Anyone can replay any run.
- **Cost scales with buffer refresh, not players:** 20 new exhibitions a day costs about $400 per month on Opus 5.5 via Batch; 5 a day about $100 (at a 50% automated acceptance rate, §7.4).
- **Promotion:** exhibitions with good telemetry (completion, death rate close to calibration, few reports) go into Julian's S6 queue and can become Permanent Collection departments with new numbers ("formerly TX.417.3").

**Option T1b: lazy, seed-keyed generation** (TA §3.6). The Worker keys by hash(generator version, prompt seed); on a miss it generates, validates and stores, so the first visitor "accessions" it for everyone. This is the Infinite Accession of §1.6. It needs generation inside the request path (30–80 s with a split pipeline, an assumption, TA §3.6) and cannot run the full S3 gate there, so it should exist only as the fallback when the buffer has nothing for a cell.

### 7.3 Option T2: bring your own key

The player pastes an API key; the browser calls the API directly (`dangerouslyAllowBrowser`, TA F8). No server.
- **The gate runs client-side**, because the core is JS: in a Web Worker, during the current department. The quick screen (60 playthroughs, about 30 s) and the worst-case runner fit; the full gate does not. BYOK exhibitions therefore carry a higher p_broken and must say so.
- **Generation starts at department entry**, not at the door: the sequencer's hidden door graph is known when the player enters, so the one Temporary door of the next transition is generated during the 8–11 minutes the player spends in the current department.
- **Nothing is wasted:** an exhibition offered but not chosen stays in the player's local archive (IndexedDB) and can be offered again later.
- **Sharing** is by exporting the exhibition file, which another player can import as a loan.
- Cost to the player: about $0.67–1.35 per accepted exhibition on Opus 5.5 interactive, half on Sonnet 5.5 (§7.4). Default cap: one new exhibition per run.

### 7.4 Cost per exhibition and per run

A full automated candidate (S1, S2, S4, S5 and judges) costs about $0.34 on Opus 5.5 via Batch and $0.67 interactive (§3.11 rates; TA §3.6 estimates $0.32 for the same thing). At an assumed automated acceptance rate of 50%:

| Per accepted exhibition | Batch | Interactive |
|---|---|---|
| Opus 5.5 | $0.67 | $1.35 |
| Sonnet 5.5 | $0.34 | $0.67 |
| Haiku 5.5 (quality untested) | about $0.02 | about $0.04 |

| Scenario | Cost |
|---|---|
| T1 buffer, 20 new per day, Opus Batch | about $400 / month, independent of player count |
| T1 buffer, 5 new per day, Opus Batch | about $100 / month |
| T2 BYOK, one new exhibition per run, Opus interactive | about $0.67–1.35 per run, paid by the player |
| T2 BYOK, Sonnet interactive | about $0.34–0.67 per run |

### 7.5 Why the runtime LLM never writes numbers or layouts

1. **It is bad at them.** Prompt control over Sokoban solution length hit chance level; ScriptDoctor's levels admitted overly short solutions (PS F8).
2. **The schema cannot enforce them.** Structured outputs support no numeric or length constraints (TA F6).
3. **Numbers are necessary content** and must be correct (AI&G 2e p. 238, BK F1). They come from the balancer and are calibrated by S3; a number that skipped the simulation is a guess.
4. **Layouts are already generated per run** by deterministic code from the programme (PL §6.i), as the brief requires ("the layout of each department [is randomized]"). An LLM-written layout would be the one fixed layout in the game.
5. **Determinism.** The models take no seed (TA F5). Code-generated numbers and layouts replay from the run seed; model output replays only if stored.

What a Temporary Exhibition contains is therefore exactly what a Permanent one contains: a frame, a spec of ids, text and sprite specs. Only the curation step is missing.

### 7.6 Fallback, always

Any failure (no buffer entry, timeout at 10 s for T1 or at department end for T2, validator or gate failure, a refusal, a budget cap) silently replaces the Temporary door with a Permanent Collection department. The player never sees a spinner. The first two departments of every run always come from the pack.

**Decision D-P4. Runtime generation in v2.**
- (a) None, ever. *Simplest; the Directory and content updates carry novelty.*
- (b) **T1 rolling buffer, with T1b as a rare fallback (lean).** *No latency, full gate, shared and replayable; Julian runs a small server and pays a predictable monthly sum.*
- (c) T1b lazy seed-keyed only. *The literal Infinite Accession; latency and a weaker gate in the request path.*
- (d) **T2 BYOK** as an "experimental" setting, alone or alongside (b). *No server; a weaker gate; the player pays; per-user cache.*
- *If (a):* §8 Commissions fall back to option (a) in §8.3.

---

## 8. Commissions

### 8.1 Index cards

Players collect cards during runs and compose a commission from cards only, never free text (God's Innovation Project: constraining inputs to collected words reduced out-of-distribution prompts and made a weak result read as limited resources rather than a weak model, PS F17).

The direction memo calls these "catalogue cards", but **Catalogue Card** is already one of the twelve consumable kinds (identify, V §5.4; CS §6.4). This section calls them **index cards** (the museum's subject index). See Challenges to the frame, item 4.

| Suit | Vocabulary | Earned by |
|---|---|---|
| **Domain** | the domain lexicon (~48) | reading a department's intro panel: its 2–3 domains |
| **Material** | the material ramps (~30) | earning a department's Certificate: one material from its palette |
| **Practice** | an authored list (~40: casting, binding, winding, sorting, tide-reckoning, glazing, pinning, copying, weighing, folding, ringing, ...) | examining a highlight's full label: its practice |
| **Family** | the launch families | accessioning any object from that family |

Cards are knowledge and persist across runs; they are not spent.

### 8.2 Composing a commission

At the Information Desk between runs: one Family card, two Domain cards, one Material, one Practice. Optionally a title from a short list of patron forms ("Commissioned by Visitor 40211"; "In memory of the visitor who fell in Room 512"). One commission may be open at a time.

The form is exactly an S1 recipe with the family, domain pair and material fixed, and the practice standing in for a constraint card. The card vocabulary is closed and pre-screened, and a small table of forbidden combinations (for example any combination the sensitivity judge read as a people during testing) greys out impossible pairs on the form.

### 8.3 Realisation

| Option | How | When it appears |
|---|---|---|
| (a) **Loan request (v1, no generation)** | The cards select the Permanent Collection department with the most overlapping domains, material and practice. It is guaranteed as a door in the next run, placard marked "At the request of Visitor 40211". | Next run, position 3 or later |
| (b) **Commission via the v2 server** | The recipe joins the nightly batch: automated S1–S5 and the full S3 gate. On success it is stored as `CM.40211.n`. | The next session after the batch (within 24 h), as a guaranteed door from position 3 |
| (c) **Commission via BYOK** | The same pipeline client-side, quick-screen gate only | Generated during the next run's first two departments; offered from position 3 |

After its first appearance a commissioned department joins the player's personal wing and recurs at normal weight. It carries the player's credit everywhere it appears and is playable by anyone who has its number.

**When it fails the gates**, the fiction absorbs it: "The Trustees have declined the commission." The reason is given in the museum's voice from the validator code ("The Trustees could find no use for bells in a department of salt.") and the cards stay with the player. The report button on a commissioned department sends it to Julian's queue.

**Decision D-P5. Commissions.**
- (a) None. *Saves a meta system.*
- (b) **(a) in v1 as a loan request, (b) in v2 (lean).** *v1 gets a cheap, honest version (a sequencing reward); generation arrives with the server.*
- (c) BYOK commissions in v1. *Real generation at launch, only for players with keys.*
- *If (a) is chosen for v1:* the meta drafter should still record index cards from day one, so v2 commissions have a collected vocabulary waiting.

---

## 9. Evaluating the generator

The book's three evaluators are the designer via visualisation, AI players, and humans (AI&G 2e §9.7, BK F15). Each gets an instrument.

### 9.1 Expressive range over mechanical descriptors

- **Per department:** 1,000 layout seeds at three tiers; heatmaps of loopiness × openness, glass ratio × chokepoints, path length × dead-end cost (ML §3.5); the persona outcome vector per seed.
- **Per pack:** one point per department (its centroid) on the same axes, coloured by family and by programme. The cross-programme map checks that programmes occupy different regions; overlapping programmes should be merged or redesigned (ML §3.5).
- **Rule:** descriptors used for evaluation are measured, not inputs (PCG book ch. 12, PL F24). Programme is an input; loopiness and openness are measured.

### 9.2 The oatmeal ratio

Let x(d, s) be department d's descriptor vector on seed s, z-scored over the pack, and c(d) its centroid over seeds.

- **Within** W = mean over d of the mean distance ‖x(d, s) − c(d)‖.
- **Between** B = mean distance ‖c(d) − c(d′)‖ over pairs d ≠ d′.
- **Oatmeal ratio O = B / W.** If O ≈ 1, knowing which department you are in tells you no more than reseeding the same department; theming is not changing content (BK §3.5 proposal; Compton and Short, PS F16).
- **Per department:** O(d) = min over d′ of ‖c(d) − c(d′)‖ / W(d). O(d) < 1 means its nearest neighbour is closer than its own seed spread: a **mechanical twin**.

Computed twice:
1. on **design descriptors** (layout metrics plus spec composition: role mix, module, counter-tag profile);
2. on **bot-play descriptors** (persona survival and HP-at-exit vector, damage-source mix, turns, detections, items used).

The second is the one that matters, because it is furthest from the inputs. **Proposed contract:** O(play) ≥ 2.0 for the pack; O(d) ≥ 1.0 for every department. Calibrate on the first ten departments: if hand-checked, clearly distinct departments do not clear 2.0, the threshold is wrong, not the departments.

**A caution.** Given scriptprof's negative result (§3.6), check that the descriptors see what humans see: correlate O(d) and pairwise descriptor distances with the human distinctness judgements in §9.5. A descriptor that predicts nothing is dropped (ML §3.5 says the same of layout metrics).

### 9.3 Curation coefficient

Per generator version: CC and rescue rate (§3.9), reject reasons by frequency, minutes per department, and agreement between Julian's blind first look and the final decision. A rising CC with stable reasons is the main sign that prompt and validator changes help.

### 9.4 Theme recognition (CrawLLM protocol)

CrawLLM asked 34 people to guess theme descriptors from screenshots or text; epoch was hardest at 43% (BK F8).

**Our version.** 24 participants, 12 departments, three conditions: screenshot only, one label only, screenshot plus label. Four-alternative forced choice among department titles, with *near* foils (same family) and *far* foils (different family). Chance is 25%.

**What it tells us.**
- Which channel carries identity. The frame's claim is that labels must (pillar 2, BK F8).
- Whether families are recognisable as families.
- A second task: show a door placard and ask which challenge to expect. This tests the pictograms.

### 9.5 Pairwise preference tests

Ranked pairs rather than ratings (Pedersen, Togelius & Yannakakis 2010 via BK §3.5; PL F24). Each participant plays two departments of about 10 minutes and answers: which was more distinct, more like a museum, more fun? Scores by Bradley–Terry. About 30 participants × 10 pairs = 300 judgements.

| Comparison | Question it answers |
|---|---|
| Curated vs automated-only (same pipeline, no S6) | **The v2 gate:** do players notice curation? |
| LLM frame vs grammar-only department (option D) | Does the LLM earn its place? |
| With vs without the T1 honesty repair | Do honest labels change how players judge a department? |
| Department vs its mechanical twin with a different skin | Does the skin alone make departments feel different? |

### 9.6 Pool-wide text diversity report

Run on every pack build:
- distinct-1/2/3 ratios over all labels;
- the top 50 repeated 3- and 4-grams across departments, with counts;
- sentence-opening distribution (share of labels starting "This", "The", "A");
- title-template distribution (share of "X That Y", "X, Considered as Y", ...);
- banned and soft-banned word counts;
- nearest-neighbour embedding distance between labels of different departments;
- distance of each department's text to its exemplar set (exemplar leakage, §3.2);
- em-dash rate and sentence-length variance (TA §3.5).

TA §4 notes that repetition across the pool, more than any single label, is what reads as generated.

### 9.7 Dud-rate dashboard

- **Sources:** S3 rejects (pipeline); Julian's flags after acceptance; playtest telemetry (opt-in: deaths far above calibration, abandonment, time spent); the in-game "report this exhibit" button (PS F3).
- **Estimates:** p_broken and p_dull per department and per pack, with Wilson intervals, and the run-level figure 1 − (1 − p)^8 shown beside them.
- **Per department:** observed versus calibrated death rate per run position; a department whose observed rate exceeds its calibration by more than 0.1 at any position for 50+ plays is pulled for review.

### 9.8 The CI contract

The PCG Benchmark scores a generator's batch on quality, diversity and controllability percentages (PL F24). Ours, per pack:
- **quality%:** departments passing the full S3 gate on re-run with the current core;
- **diversity%:** legal-cell coverage (§4.4);
- **controllability%:** departments whose measured primary matches their declared primary after relabelling, on re-run.

---

## 10. Research angle

This is a list of options for Julian, not a plan. Each would use data the pipeline produces anyway. I have not checked prior work beyond the briefs, so "contribution" here means "not covered by the briefs' sources".

| # | Question | Method | Data the game produces | Honest risk |
|---|---|---|---|---|
| R1 | **Learnability under generated content.** Does the closed-verb / open-noun design let players transfer knowledge to departments they have never seen? | Two pools with identical skins: (i) shared archetypes, tags and honest labels; (ii) archetypes shuffled per department, no tags. Measure improvement across runs on held-out departments. | Run logs | Needs dozens of players over many runs |
| R2 | **Orchestration through a closed vocabulary.** How often does an LLM compiling frames into closed verbs produce decorative content, and do the trace-map and round-trip checks catch it? | Ablate C3 and T1; measure R1-reason rejects in S6 and player-judged distinctness | Curation log, §9.5 | The validators may be specific to this vocabulary |
| R3 | **Space-syntax descriptors for QD.** Do integration, intelligibility and space-type profiles predict persona outcomes and human judgements better than generic level metrics? | Regress S3 outcomes on ML §3.5 metrics; use the best pair as archive axes | S3 at scale | Space-syntax correlations describe crowds, not fun (ML pitfall 6) |
| R4 | **Persona dominance as a challenge type.** Does the measured fingerprint match what players perceive from the door placard and from play? | §9.4's placard task plus post-play questions | §9.4 | Personas predict persona labels, not players' self-descriptions (PL F15) |
| R5 | **Generation as curation.** Can an automated curator trained or prompted on the curation log replicate Julian's decisions? | Held-out agreement; this is the v2 gate | Curation log | Small n; one curator's taste |
| R6 | **Grammar versus LLM operators in QD over whole levels.** Does scriptprof's finding (the structural operator wins on throughput) hold when the content is a department rather than a puzzle? | Cells reached per hour; CC per operator | §4.1 | Engineering-heavy to make fair |
| R7 | **Label honesty as a metric.** Is round-trip consistency between generated text and mechanics measurable and does it matter to players? | T1 rates; §9.5 third comparison | S4 logs | Bots cannot read; the extractor is itself an LLM |

R2 and R5 come almost free with v1. R1 is the one most likely to interest people outside PCG.

---

## 11. Challenges to the frame

1. **Drop tier and category from the mechanical archive.** PS §3.3 proposes MAP-Elites over "challenge type × category × tier". Tier contradicts pillar 4: departments arrive in random order, so every department must work at every tier and none can occupy a tier cell. Category is thematic and belongs in the theme archive. I use measured challenge × programme (§4.1).
2. **Learnability is not the main argument for a finite pool.** With closed verbs, archetype recurrence per run is independent of pool size (§1.6). The decisive arguments are the dud arithmetic, curation capacity and department-level familiarity. The document should not oversell "finite for learnability", because Julian will spot that the vocabulary already secures it.
3. **v2 is a server question more than a latency question.** The strongest form of Temporary Exhibitions is a nightly automated batch into a rolling buffer (§7.2), which is option B without the human, served from a server. Live generation is the fallback. Framing v2 as "runtime LLM" overstates what happens at runtime.
4. **"Catalogue cards" collides with the Catalogue Card consumable.** I propose **index cards** for commission inputs. The alternative is renaming the consumable (to "Registrar's slip", say); either way one of them must change.
5. **Accession numbers cannot be both Wilkins-coded and content addresses.** A readable number carries meaning; a content address is a hash. I use both: number for people and seeds, digest for pinning content (§3.10).
6. **Pool size should track vocabulary size.** "Toward 100+" is fine at the launch vocabulary's ~130 mechanical identities; growth beyond that without new ids produces mechanical twins, which the oatmeal ratio will flag.
7. **The challenge type in S1 is a claim, not a fact.** The frame lists S1's "challenge signature" as an output. In this pipeline S3's measured fingerprint overrides it, and text is written only after the measurement (§3.6, G10).

---

## 12. Risks

1. **Julian's hours are the bottleneck.** About 8 hours per launch batch is an estimate; if it doubles, the pack shrinks or curation thins. Mitigation: strong validators, reason codes, a tracked CC, and Revise instead of hand-editing.
2. **Judges get gamed.** Labels learn to pass the round-trip extractor by sounding like tooltips; frames learn to satisfy the specificity extractor with a token material. Mitigation: T6 style judge, Julian's red pen, and treating judges as filters, never objectives (PS pitfall 4; QDAIF's reward hacking, PS F13).
3. **The S3 gate gives false confidence.** scriptprof's metrics could not see design (§3.6). A department can pass G1–G10 and still be dull. Mitigation: gates only catch failures; quality is S6's.
4. **Trope gravity and exemplar anchoring.** Despite recipes, frames may converge on a house "Borges pastiche" voice (BK pitfall 3). Mitigation: rotating exemplars, the text report, the banned lists, and dropping cards that produce sameness.
5. **Vocabulary churn.** A semantic change to an id forces re-simulation of every department using it (V §11.5), and every prompt and validator that mentions it. CrawLLM's prompts had to be "meticulously crafted and tuned" (PS F10). Mitigation: version pins, re-simulation in CI, prompts generated from the registry rather than hand-written where possible.
6. **Model retirement.** Opus 5.5 retires no sooner than 2027-09-22 (TA F7). Shipped packs are unaffected; new batches on a new model will sound different. Mitigation: a new `gen` version per model, the text report comparing voices, and exemplars as style anchors.
7. **Sensitivity leaks** through `land` departments, Directory lines, taxonomy class names and keepers (V §14 risk 10; LM §4.2). Mitigation: the sensitivity question on every text field, `land` held for Julian, Peoples deferred, the closed Directory lexicon checked statically.
8. **Seed drift.** A change to the layout generator changes every department's layouts. Mitigation: pin the layout version in each department and the pack, record a source hash with every simulation result (PL pitfall 12), re-run S3 on generator changes.
9. **Pack size.** 100 departments add about 4 MB to the single-file build. Mitigation: a text budget per department in the lint, and lazy-loading packs from IndexedDB in a multi-file build if needed (TA §3.7).
10. **v2 operations.** Server cost, abuse, outages and the unsettled ownership of LLM output (PS pitfall 11). Mitigation: caps, the buffer design, no free text, opt-in.
11. **Commission disappointment.** A player's commission is declined or dull. Mitigation: the fiction (the Trustees decline, cards kept), and the v1 loan-request version that cannot fail.

---

## 13. Cut line

Drop in this order if scope must shrink:

1. **Commissions**, all forms (keep recording index cards if the meta system exists anyway).
2. **Temporary Exhibitions** and everything in §7.
3. **The blind first look and the pairwise and recognition studies** (§3.9, §9.4, §9.5). They are research instruments, not shipping requirements.
4. **MAP-Elites as a search loop.** Keep the archive as bookkeeping (cells and quotas in the coverage report) and fill gaps by targeted recipes by hand.
5. **The grammar operator** (keep grammar repair in S3; drop it as an archive operator).
6. **The theme embedding archive.** Replace with TF-IDF dedupe plus Julian's eye.
7. **S5 LLM grids.** Archetype silhouettes plus ornaments only.
8. **Per-department runtime grammars.** One museum-wide grammar with domain-keyed fillers.
9. **The launch pool, down to 18** (6 families × 3).

**Never cut:**
- closed-enum compilation (S2) and the no-decoration trace map;
- numbers from the balancer only;
- the S3 quick screen, the worst-case runner, G7's V3 Intro check and G8;
- the round-trip honesty check (T1);
- the sensitivity question;
- Julian's accept / reject with reason codes;
- accession numbers with digests and stored outputs;
- the Directory. It is the cheapest thing in this section and it carries the brief's infinity.

---

## 14. Decisions for Julian (from this section)

| # | Question | Lean |
|---|---|---|
| D-P1 | Where departments come from | (e) Hybrid: v1 curated pool + Directory, v2 optional extras, v3 commissions |
| D-P2 | Launch pool size | 24–30 |
| D-P3 | Mechanical archive axes | Measured challenge × programme (42 cells) |
| D-P4 | Runtime generation in v2 | Rolling buffer behind a small server; BYOK as an optional experimental setting |
| D-P5 | Commissions | Loan request in v1; generated commissions in v2 |
| D-P6 | Model per stage | Opus 5.5 for generation, Haiku 5.5 for judges |
| D-P7 | Tell S1 what exists | No; dedupe afterwards |
| D-P8 | Curation depth | Every department, with a play sample |
| D-P9 | Numbering | Wilkins-coded family letters plus digests |

Also for Julian, from §1.7: the v2 gate thresholds, and from §4.4: the CI contract numbers.

## 15. Interfaces with other sections

- **Vocabulary (V).** This section compiles into V's tables and obeys V's contract. It feeds V's unmatched-concept queue (C7) and curation reasons R1 and R6. It needs from V: a machine-readable registry per version, Essential-line templates, counter tags and the Table B validation margins.
- **Layout.** Programme ids and their envelopes; the room numbering d00–d99 (accession lots use it); a pinned generator version; decorative dead-end doors for Directory placards.
- **Core systems (CS).** Consumable reskin binding (V D-V7); identification rungs that gate what a tombstone shows; item states for credit lines (§6.4); the mimic vitrine's missing number.
- **Meta.** Your Collection numbers (YC); Lost Property (LP); index cards; commissions; the Catalogue/Atlas reading family × ordinal from the pack.
- **Run structure and sequencer.** Placard data, measured primary, ordinal, `never_first`; the rule of at most one Temporary door per transition and none at positions 1–2; the Stair Hall as the place where the Directory and signage live.
- **Art and audio.** S5 enums (ornaments, ramps, modes, families), the reserved hues, the silhouette masks the IoU check uses, and the Atelier page.
- **Text.** Caps (§3.7), the banned lists, the voice guide; the text drafter owns their final values.
