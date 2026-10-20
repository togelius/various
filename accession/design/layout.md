# Department layout generation

*ACCESSION design document, section: level (department layout) generation. Draft 1, 2026-10-20. Written inside the direction memo (`direction.md`) and against the sibling drafts `core-systems.md` (CS), `vocabulary.md` (V), `pipeline.md` (P), `difficulty.md` (D, run structure and balance) and `meta.md` (M). Research is cited only from the briefs: `museum-layouts.md` (ML), `papers-levels.md` (PL), `book-pcg.md` (BK), `tech-art.md` (TA). Numbers marked "measured" come from a throwaway prototype written for this section (§0.3); every other number is a first draft for the persona harness to move.*

**What this section owns** (as D §14 and CS §19 expect): the generator hierarchy; the six launch programmes and the staff layer; the online pipeline from exhibition-narrative graph to validated tile map; room numbering and `L_tour`; placement rules for encounters, Highlights, the Masterpiece and services; the entrance safe zone; the Intro gallery's structure and its validation; layout RNG streams; layout metrics and their uses; the orientation plan and staff plans; the layout side of Stair Halls and the Exit.

**What it borrows:** encounter budgets and role mixes (D §3.4–3.5), the orientation pool (D §3.6), quotas (D §4.1, CS §6.6, §8), the Masterpiece rules M1–M6 (D §6.1), the clock and lux bands (CS §3, §5), fixtures and modules (V §6–7), the department data model and pins (P §2), size classes and the door graph (D §1.4, §2).

---

## 0. Proposals at a glance

| Topic | Proposal |
|---|---|
| Where it runs | Online, per department, in the browser, from the pack's `DepartmentSpec` plus run position, size class, seed and entry side. Pure, deterministic, integer core code (TA §3.2). Prefetched while the player reads the door placards. |
| Shape | Hierarchy department > wing > gallery > bay > case. Pipeline L1–L8: narrative graph, programme embedding, openings, curation, population, text hooks, validation, repair. |
| Programmes | Six launch programmes. Two have their own macro geometry (enfilade, rotunda); four share a quadrangle scaffold (Intro, central space, Masterpiece hall, side bands) with distinct central fillers (grand hall with mezzanine, case labyrinth, storage stacks, sculpture court). A shared staff layer. |
| Budget | Measured on the prototype in Node 22: 7–9 ms median, 11–16 ms p95 per layout, 0 retries in 3,600 layouts. Budget for the real thing: 25 ms p95 desktop, 50 ms p95 on a phone, with prefetch hiding the rest. |
| Guarantees | Reachability, lock order, Masterpiece optional, entrance safe zone, a cycle through the Intro, the Masterpiece arena loop rule (D M4), the vista where a programme requires it, no unrewarded long dead end, and a worst-case runner. Repair, then up to 4 reseeds, then a certified fallback, all logged. |
| Intro | An entrance vestibule (the safe zone) plus an Intro gallery stamped from the orientation pool. Each template declares structural invariants that make its mechanic *required* at runtime; the limited-agent test (Khalifa et al. 2019, PL F18) certifies templates offline. |
| Metrics | About twenty metrics per layout, most computed at runtime. Two kinds of envelope: a few hard *identity checks* per programme, and wider *expected ranges* used only for drift detection in CI. Measured chokepoints are near zero in museum plans, so "choke" is redefined (§13.1). |
| QD | MAP-Elites over programme knobs (not tile maps) produces *knob presets*; runtime samples a preset, then jitters it. Same archive pattern as `scriptprof/js/evolve.js`. |
| Scale | Measured: Cabinet 5–7 rooms and ~450–530 floor tiles; Department 6–9 rooms and ~560–720 tiles; Wing 9–13 rooms and ~720–920 tiles. `L_tour` medians 59–77, 84–108 and 115–177 tiles. This is about 40% below the `L_tour` that CS and D assumed for their clock and time budgets (Decision L-D1). |

### 0.1 Interfaces this section promises

| To | What layout provides |
|---|---|
| CS (clock, UI) | `L_tour` per department (§13.1); room numbers `D·100 + n` with gaps for secrets (§8.1); the floor-plan data for the map and the orientation board (§15); exit placard positions; lux band per room (§6.5) |
| D (balance) | Gallery count per size class; the budget split by gallery role, spent by the population pass (§7.2); kit and Clearance placement (§7.4); exit lobby reachable without the Masterpiece hall (LV3); arena loop rule (LV8); Intro placement outside the safe zone (§11); validator fallback rate (§10.4) |
| V (vocabulary) | Fixture placement under the movement × sight matrix; the `los` and `choke` counter tags satisfiable in every combat-sized room (§6.4); per-module layout checks (LV13); programme compatibility as data (§4.9) |
| P (pipeline) | `balance.descriptors` (§13.1); `pins.layout`; the layout half of S3's G1 and G2; expressive-range data (§13.5) |
| M (meta) | An optional *Recent Acquisitions* display at the Exit (§16.2) |

### 0.2 What changed my mind while prototyping

Four things in this draft come from measurement, not from the briefs. Each is argued where it lands.
1. **Tile-level chokepoints are almost absent** in museum plans with 3-wide archways and 2-wide aisles: Brogue's definition gives p95 ≤ 0.015 in every programme. §13.1 replaces it with gate share and narrow share, and §6.4 adds an explicit *choke supply* rule so V's `choke` counter tag stays satisfiable.
2. **Four launch programmes share one macro structure.** Their room-graph statistics are nearly identical (§4.0); only the central filler separates them. §4.0 adds a *glazed-screen access* variant that makes the Masterpiece visible on the axis but reachable only round by a band, which raises room depth from 2 to 3–4. Challenges §19.2 argues the rest.
3. **`L_tour` is smaller than the clock assumed** (§17, Decision L-D1).
4. **The Masterpiece hall needs active furniture rules** to satisfy D's M4 (no pillar loop under 16 tiles of circumference): the viewing lectern, columns and the rotunda's column ring all create 8-tile loops if placed naively (§6.3).

### 0.3 The prototype

- **Where:** `../prototypes/layout/proto.js` (about 900 lines of Node, no dependencies). `node proto.js 200` prints the measurement tables; `node proto.js --show <programme> <seed> <size>` prints one layout (size 0 Cabinet, 1 Department, 2 Wing). Final output: `stats_final.txt` in the same directory; the sketches in §4 are in `samples/`.
- **What it implements:** L2 embedders for all six programmes, the staff band, `addLoops`, the a-space pass, local repairs, simplified curation (wall runs, seasoning, walkway reservation, vista reservation, arena rules), a stub population, and every metric in §13.1.
- **What it does not implement:** the explicit L1 graph (roles are wired per programme), Intro templates, the vestibule, ticketed rooms, closed rooms, lighting, text hooks, a real worst-case runner, module checks and the dihedral transform.
- **Sample:** 6 programmes × 3 size classes × 200 seeds = 3,600 layouts. All passed the implemented checks on the first attempt after the fixes described in §0.2.
- **Status:** design support only. Its envelopes are circular (they describe the prototype), so §13.2 says how real envelopes are set.

---

## 1. Hierarchy, inputs and outputs

### 1.1 The generator hierarchy

After ML §3.1. Each level has an owner stage, a stable key (which names its RNG substream, §12) and the data the next level reads.

| Level | What it is | Built by | Key | Holds |
|---|---|---|---|---|
| **Department** | One level: a tile map up to 48×36 | `generate()` (§2) | `deptKey = accession@layoutPin`, e.g. `M.7@L2.1` | Programme, cycle type, size class, entry side, rooms, openings, staff layer, metrics, log |
| **Wing** | A plan region built by one generator: the main programme, at most one side band style (§4.9), and the staff layer | L2 embedder | `main`, `band.N`, `band.S`, `staff` | Bounding box, programme element names ("north enfilade", "balcony") |
| **Gallery** | A room-graph node with a role (vestibule, intro, section, study, ticketed, closed, centre, coda, staff) | L1 role, L2 geometry | Role key: `intro`, `s2.g1`, `study.1`, `centre`, `coda`, `staff.office` | Rectangle, disc or clipped shape; size class; section index; space type a/b/c/d; lux band; number |
| **Bay** | A furniture meso-pattern placed by curation | L4 | `s2.g1/bay.3` | Template id, tiles, facing, typological series key (for labels) |
| **Case** | A fixture tile with contents and a label | L4, filled by L5 | `s2.g1/bay.3/case.2` | Fixture id (V §7.2), glass grade (CS §4.1), lock level, contents (item, dormant exhibit, or "on loan elsewhere"), label id, spotlight flag |

**Naming clash.** D §1.4 uses *Wing* for its largest size class. In this section the hierarchy level is written lowercase ("wing", a plan region) and the size class capitalised ("Wing"). One of them should be renamed before the document is merged (§19.5).

A **zone** is a gallery without walls: a section of a large central space (grand hall, court, labyrinth, stacks) bounded by a section panel and furniture rather than walls. Zones are graph nodes for L1, L5 and L6 but not for space-syntax metrics, which use rooms.

### 1.2 Inputs

```js
LayoutInput = {
  spec,        // the pack's DepartmentSpec (P §2.2), read-only
  position,    // run position 1–8: the tier (depth sets power); 9 for the Exit
  size,        // 'cabinet' | 'department' | 'wing', from the sequencer (D §1.4)
  runSeed,     // the run's seed (or a fixed seed for Seeded and Practice visits, M §10.7)
  entry,       // { side: 'W'|'N'|'E'|'S', fromDept: accession or 'stair_hall_k' }
  exits,       // 2–3 placard slots from the door graph (D §2.2): [{ slot, dept, challenge, reward }]
  clearance,   // median Clearance at this position (CS §8.7), for lock levels
  heat,        // Trustees' Directives that touch layout (e.g. Power Cut), possibly empty
}
```

**DepartmentSpec fields the layout reads** (pack paths from P §2.2):

| Field | Used for |
|---|---|
| `accession`, `pins.layout` | `deptKey`, so text edits never reshuffle a layout (§12.1) |
| `frame.programme` | Which embedder (§4). Chosen in S1 under the module × programme matrix (V §6.4); never re-drawn at runtime |
| `balance.measured.primary`, `.secondary` | Knob bias (each programme's "bias" line, §4), budget split (§7.2), choke supply (§6.4), staff layer probability (§4.7) |
| `recipe.family`, `recipe.category` | Knob bias; band style (§4.9); bay templates (Classification gets typological series, Copies gets mirrored bays) |
| `spec.modules.signature`, `.secondary` | Intro template pool (§11); module layout checks (LV13); fixtures required by the module (tide gauges, compactors, fuse panels) |
| `spec.species[]` (role, archetype, wake, habitat via archetype) | Population habitats (§7.3) |
| `spec.masterpiece` | Masterpiece hall size class (2×2 colossus needs ≥ 11×11) and arena rules |
| `balance.stats` (by position) | Worst-case runner damage (LV11) |
| `frame.palette.material` | Lux bands (§6.5) |
| `spec.npcs` | Service and NPC slots (Loan Desk, registry desk, rival visitor) |
| `ordinal` | Upper bound on layout complexity: locks and closed rooms (§3.5) |
| `balance.descriptors` (optional, from S3) | A pinned knob preset id, if the curator locked one (§13.4) |

**Outputs** (all core state is plain JSON, TA §3.2):

```js
Layout = {
  W, H, tiles: Uint8Array,        // terrain + fixture code per tile
  room: Int16Array, elev: Uint8Array, lux: Uint8Array,
  rooms: [{ id, key, role, number, section, shape, size, spaceType, lux, onTour, landmark }],
  openings: [{ a, b, style, tiles, lock, clearance }],
  locks: [{ id, door, key, keyAt, rescue }],          // lock records for "ask a guard" (§14.4)
  spawns: [{ species, tile, habitat, wake, room }], items: [{ id, tile, case, highlight }],
  guards: [{ posts, route }], masterpiece: { plinth, lectern, hall },
  entrance, vestibule, exits: [{ tile, slot }], safeZone: tileSet,
  facts: { ... },                 // text hooks (§8)
  metrics: { ... },               // §13.1, also written to balance.descriptors offline
  log: { attempts, failedChecks, repairs, fallback, ms },
}
```

### 1.3 Grid conventions

- **Size cap 48×36 tiles** including walls; measured footprints are in §17. At 16×16 px this is 768×576 px, so the map scrolls on phones.
- **Layers:** terrain (wall, floor, void, pool, balcony, stair), fixture (V §7.2), room id, elevation 0 or 1, lux band (CS §3.6), plus a transient-surface layer owned by the core.
- **Movement** is 8-directional with no corner cutting: a diagonal step needs both orthogonal tiles walkable. All metrics use the same rule.
- **Canonical orientation.** Embedders build with the entrance on the west wall. The finishing step of L2 applies one of the 8 dihedral transforms: the rotation is set by `entry.side`; the mirror bit comes from the embed stream. Everything after L2 works in final coordinates, so compass words in text ("the north enfilade") are true.

**Legend for every sketch in this section** (prototype output; letters added at room centres):

| Char | Meaning | Move | Sight |
|---|---|---|---|
| `#` | wall | blocks | blocks |
| `.` | floor | passes | passes |
| `,` | archway (3 wide) | passes | passes |
| `+` | door | passes | blocks when closed |
| `S` | staff door (Clearance) | Clearance | blocks |
| `E` / `X` | entrance / exit door with placard | | |
| `v` | vitrine | blocks | passes |
| `p` | low plinth | blocks | passes |
| `o` | column or statue | blocks | blocks |
| `H` | shelving | blocks | blocks |
| `\|` | partition or screen | blocks | blocks |
| `c` | crate (pushable) | blocks | blocks |
| `~` | void, balustrade or basin | blocks | passes |
| `:` | balcony (elevated) | passes | passes |
| `^` | stair | passes | passes |
| `b` | bench | passes | passes |
| `l` | lectern | blocks | passes |
| `f` | low furniture or fountain | blocks | passes |
| `C` | Masterpiece plinth | actor | actor |
| `I`, `K`, `s` | Intro, coda (exit lobby), study cabinet (room markers, not tiles) | | |

---

## 2. The pipeline and its budget

### 2.1 Stages

| Stage | In → out | Method | Prototype p50 (ms) | Budget p95 (ms, desktop) |
|---|---|---|---|---|
| **L1** Narrative graph | spec, size, position → role graph, cycle type, features | Two-step grammar: build, then restructure (§3.4) | not prototyped | 0.5 |
| **L2** Embedding | graph, knobs → rooms, programme openings, roles | Per-programme embedder (§4), then the dihedral transform | 0.16–0.21 | 1 |
| **L3** Openings | rooms → final openings, a-spaces, locks, staff layer | `addLoops(d)`, a-space pass, lock placement, staff band (§5) | 0.42–0.58 | 3 |
| Analysis | tiles → gate cells, room graph, isovist samples, `L_tour` | Tarjan, BFS, sampled shadowcasting (§13.1) | 0.8–1.0 (twice) + 1.8–2.5 | 6 |
| **L4** Curation | rooms → bays, cases, lux | Merrell-style grid rules, seasoning (§6) | 2.2–2.9 | 6 |
| **L5** Population | budget, roster → spawns, items, guards, services | Habitat rules (§7) | 0.3 (stub) | 4 |
| **L6** Text hooks | layout → numbers, facts, signs, plan | §8 | not prototyped | 1 |
| **L7** Validation | layout → report | LV1–LV14 (§9) | inside analysis | 4 |
| **L8** Repair | report → fixed layout, reseed or fallback | §10 | 0 needed | (0 normally) |
| **Total** | | | **7.2–8.7 p50, 11.4–15.5 p95** | **25** |

The slowest single calls took 47–63 ms (the first call's JIT warm-up, and garbage-collection pauses). Measured on Node 22 in the build container; phones were not measured. A mid-range phone is probably 2–4× slower (unmeasured), so the phone budget is 50 ms p95, and §2.3 hides it.

### 2.2 Top level

```js
// Pure function of its inputs. All randomness through named streams (§12).
function generate(input) {
  const { spec, position, size, runSeed, entry, exits, heat } = input;
  const deptKey = spec.accession + '@' + LAYOUT_PIN;                  // not the content digest (§12.1)
  const prog = PROGRAMMES[spec.frame.programme];
  const log = { attempts: [], t0: now() };

  for (let attempt = 0; attempt <= MAX_RESEEDS; attempt++) {          // MAX_RESEEDS = 4
    const R = (...name) => rng(runSeed, 'layout', deptKey, 'a' + attempt, ...name);

    const plan  = buildNarrativeGraph(spec, size, position, prog, R('graph'));          // L1
    const knobs = prog.knobs(spec, size, position, plan, R('knobs'));                   // preset + jitter (§13.4)
    const L     = prog.embed(plan, knobs, R('embed'));                                  // L2
    if (!L) { log.attempts.push({ attempt, failed: ['embed'] }); continue; }
    transform(L, entry.side, R('embed', 'mirror'));

    addLoops(L, knobs.loopD, R('openings'));                                            // L3
    aSpacePass(L, prog.aSpaceTarget(size), R('aspace'));
    placeLocks(L, plan, R('locks'));                    // ticketed room, closed-for-installation
    addStaffLayer(L, plan, knobs, R('staff'));
    stampVestibuleAndIntro(L, spec.spec.modules.signature, R('intro'));   // §11; spec.spec is P §2.2's "spec" block

    let A = analyse(L);                                 // gates, room graph, isovist samples, L_tour
    for (const room of L.rooms) curate(L, A, room, spec, R('room', room.key, 'curate'));   // L4
    light(L, spec, heat);
    A = analyse(L);
    populate(L, A, spec, position, size, key => R('room', key, 'populate'));           // L5
    emitTextHooks(L, A, spec, exits);                                                  // L6

    let report = validate(L, A, spec, position);                                       // L7
    for (let k = 0; !report.ok && report.fixable && k < MAX_LOCAL_FIXES; k++) {        // L8a, MAX_LOCAL_FIXES = 6
      repairLocal(L, report.firstFixable, R('repair', k));
      A = analyse(L); report = validate(L, A, spec, position);
    }
    log.attempts.push({ attempt, failed: report.failed, fixes: L.fixes });
    if (report.ok) return finish(L, A, log);
  }
  const L = certifiedFallback(spec, size, runSeed, entry);                            // L8c (§10.3)
  telemetry('layout_fallback', deptKey, position, log);
  return finish(L, analyse(L), log);
}
```

### 2.3 When it runs

The door placards are shown at the end of each department (D §2.1). Because `generate` is a pure function of its inputs, the game generates the 2–3 offered departments **while the player reads the placards**, keeps the results, and discards the unchosen ones. A slow phone then never waits at the door. If a generation is still running when a door is chosen, the door's fade-out (≥ 300 ms) covers it. The Stair Halls and the Exit are templates (§16) and cost nothing. See Decision L-D4 for alternatives.

---

## 3. L1: the exhibition-narrative graph

### 3.1 Node roles

| Role | Count | Size | Notes |
|---|---|---|---|
| `vestibule` | 1 | 5×5 to 7×5, or the first 4–5 tiles of the Intro behind a screen line | Entrance door, orientation board (§15.1), bench, coat rail. It *is* the safe zone (§7.1). Never holds a hostile |
| `intro` | 1 | NORMAL, ≥ 12 walk tiles from the entrance to its onward openings | Orientation-pool template (§11). Must lie on a cycle and have ≥ 2 onward openings |
| `section` gallery or zone | 2–4 sections × 1–3 galleries | NORMAL or LARGE; zones inside a central space | Sections are numbered in tour order (§8.1). Section panels at the first gallery of each section |
| `study` | 0–3 | SMALL (cabinet 4–6 wide) or NORMAL | a-spaces: one door, loot, a visible lure (§7.5) |
| `ticketed` | 0–1 | 1–2 NORMAL rooms | Behind a locked door; the ticket lies earlier on the tour (§5.5). Called the *ticketed room* to avoid a clash with D's Special Exhibition doors |
| `closed` | 0–1 | an existing ring edge | "Closed for reinstallation": a breakable partition turns a ring into a detour (§5.6) |
| `centre` | 1 | GIANT or LARGE (Masterpiece hall, hub or apse) | Never a cut vertex between the entrance and every exit (LV3) |
| `coda` | 1 | NORMAL-LARGE | The exit lobby (D's term): kiosk, 2–3 exit doors with placards |
| `staff` | 0–4 | corridor 2 wide; store, office, conservation lab | Never required (LV5) |

Size classes: SMALL 4–6 wide, NORMAL 6–10, LARGE 10–16, GIANT 18–28 (central spaces).

### 3.2 Edge styles

| Style | Width | Rule |
|---|---|---|
| Archway | 3 | Cannot be closed. Default between public galleries in formal programmes |
| Door | 1 | Closable (CS §4). Default for studies, staff rooms, and the choke supply (§6.4) |
| Staff door | 1 | Clearance N = median Clearance at this position + {0, 1, 2} (CS §6.2) |
| Hinged panel | 1 | Hidden; found by Search or passive search (CS §1.2) |
| Locked door | 1 | The ticketed room; the department key variant of a closed room |
| Partition | 1–3 | Breakable in 3 bashes, noise 2 (V §7.2); used by closed rooms |
| Glazed screen | 3 | Blocks movement, passes sight. The Masterpiece window (§4.0) |
| Stair | 1 | Between floor and balcony |
| Turnstile | 1 | One-way; later programmes only |

### 3.3 Cycle types

After Unexplored's single-cycle construction (ML F13) and Dormans & Bakkes' missions and spaces (ML F14). The entrance and the Masterpiece split the main cycle into two arcs.

| Cycle type | Shape | Launch programmes |
|---|---|---|
| `circuit` | One main ring; Intro and centre on opposite arcs; arc length ratio 0.35–0.65 | enfilade, case labyrinth, storage stacks |
| `two_routes` | Public arc plus a shorter staff arc (Clearance-gated, guarded): "a shorter, more difficult path, and longer, easier paths" (Dormans & Bakkes via ML F14) | enfilade, grand hall, storage stacks |
| `hub` | A landmark room with ≥ 3 spokes; rings close through an ambulatory | rotunda, sculpture court |
| `figure_eight` | Two rings sharing the landmark room (SPD's figure-eight builder, ML F8) | rotunda |
| `lake` | A ring around a void, court or pool, with sightlines across it | grand hall (balcony ring), sculpture court (court with basin) |
| `gauntlet` | A forced line with a shortcut back from the far end | none at launch; spiral and temporary-exhibition route later |

Choice: uniform among the programme's types, then reweighted by challenge type: `guarded` ×3 for `two_routes`; `artillery` ×2 for `lake`; `locks_puzzle` ×2 for `hub`. All launch programmes are *probabilistic* in Choi's sense (ML F1); only the later spiral and temporary-exhibition route are deterministic.

### 3.4 Algorithm

**Step 1, build (randomised).** From size class and position:

| | Cabinet | Department | Wing |
|---|---|---|---|
| Sections k | 2 | 2–3 | 3–4 |
| Rooms incl. Intro, centre, coda (D §1.4 target) | 5–6 | 7–8 | 9–10 |
| Studies | 0–1 | 1 | 1–3 |
| Ticketed room probability | 0 | 0.35 (0 at positions 1–2) | 0.5 |
| Closed room probability | 0 | 0.25 | 0.35 |
| Staff layer probability | 0.5 | 0.7 | 0.9 |

Modifiers: `locks_puzzle` ×1.5 on the ticketed and closed probabilities (cap 0.8); `attrition` ×2 on closed (a longer route); `guarded` sets the staff layer to 1. A department's `ordinal` caps features: ordinal 1 allows no lock and no closed room; ordinal 2 allows one of them; ordinal ≥ 3 allows both.

**Step 2, restructure (deterministic).** This is the "one simple step to create a highly randomised graph and a second step to restructure it" of PL F7.
1. Order sections along the main cycle: section 1 on the Intro's arc, the last section adjacent to the centre.
2. Attach studies as leaves to galleries in different sections, preferring later sections.
3. Ticketed room: attach as a leaf behind a lock to a gallery in the second half of the tour. Place the ticket in a gallery with smaller tour rank ("move locks forward and keys backward", ML F14).
4. Closed room: choose the main-cycle edge whose closure lengthens the Intro-to-centre walk the most while keeping every room reachable.
5. Staff arc: link a gallery in section 1 to one adjacent to the centre or coda.

**Step 3, check** (cheap, on the abstract graph): keys precede locks; the centre is not a cut vertex for every exit; the Intro lies on a cycle (all launch programmes); staff edges are not needed for reachability; room counts match the size class.

### 3.5 Worked example

"Instruments That Keep Time Badly" (P §2.2: Machines × technology, rotunda, primary `hazard_terrain`, secondary `guarded`, ordinal 2) at position 4, size Department, entry from the west.

- Step 1: k = 3 sections; 8 rooms; 1 study; ticketed p = 0.35 → drawn no; closed p = 0.25 → drawn yes (ordinal 2 allows one feature); staff layer: `guarded` secondary → p = 1 → yes. Cycle type: `hub` or `figure_eight`; drew `figure_eight`.
- Step 2: section I on the Intro's arc (west arm, SW corner); section II to the south and east (south arm, east arm); section III to the north (north arm, NE corner). The study is the NE corner, left without its ambulatory link. The closed room partitions the archway between the SW corner and the south arm, so section II is first reached through the hub.
- Embedding (§4.2): the Committee of Clocks stands in the hub (`centreInHub`), so there is no column ring (§6.3). The Intro's template is `hourly_demonstration` variant B (§11.3): one automaton whose sweep crosses the only path onward, with its schedule on the label.
- Result, as the label writer sees it: Rooms 401 Intro (with the vestibule), 402 SW corner, 403 south arm, 404 east arm, 405 north arm, 406 NE corner (study), 407 hub (Masterpiece), 408 coda. No gaps. A staff corridor along the north wall, with staff doors into 405 and 406 at Clearance 13.

---

## 4. L2: the launch programmes

### 4.0 The common contract, and the quadrangle scaffold

Every programme implements:

```js
Programme = {
  id, cycleTypes, deterministic: false,
  knobs(spec, size, position, plan, rng),   // preset from the archive (§13.4) + jitter + challenge bias
  embed(plan, knobs, rng) -> Layout | null, // rooms, programme openings, roles, meta.vista, meta.cpl
  loopD,                                    // addLoops threshold (§5.2)
  aSpaceTarget(size),                       // number of rooms the a-space pass may close (§5.3)
  identity: [checks],                       // hard checks (§13.2)
  vistaRequired: bool,
}
```

**The quadrangle scaffold.** Grand hall, case labyrinth, storage stacks and sculpture court share one macro plan:

```
 north band (0–3 rooms)                  [band style §4.9]
 +--------+-------------------------+---------+
 | Intro  |  central space (filler) | Masterp.|   axis: entrance -> Intro -> central -> Masterpiece
 |        |                         |  hall   |
 +--------+-------------------------+---------+
 south band (1–3 rooms) ......................| coda (exit lobby) spans under the hall
```

- **Geometry.** Intro W, central space in the middle, Masterpiece hall E on the axis, a south band whose last room is the coda, and an optional north band. Band rooms connect in series and to the central space (the first two and last two rooms of each band always; others with probability `bandLinks` 0.2–0.7).
- **Access variants** (knob `access`, p = 0.5 each):
  - `axis`: a 3-wide archway from the central space into the Masterpiece hall. Room depth Intro → Masterpiece = 2 (measured p50).
  - `window`: a **glazed screen** (3 vitrine tiles) on the axis. The Masterpiece is seen from the Intro through glass (Tzortzi's pull, ML F3) but entered round by the last north band room or the coda. Room depth 3–4 (measured).
- **What the measurement says.** On every room-graph statistic the four programmes are indistinguishable (p50 over all sizes: 6–7 rooms, μ = 2, a-share 0.20–0.22, hub dominance 2.0–2.1). They separate only on tile metrics: glass, narrow share, defensibility, pillar loops, elevation (§13.2). Challenges §19.2 discusses whether that is enough.

### 4.1 Enfilade

**Precedents and character.** Dulwich, the Louvre's Grande Galerie, the Sainsbury Wing (ML F3, F7). Rooms in line with aligned openings make one long sightline: ranged play in both directions, the Masterpiece visible from the Intro at the end of the vista. Doorways are the natural fighting positions; the parallel row turns them from b-spaces into a ring.

**Algorithm.**
1. Intro at the west, spanning both rows; entrance on its west wall at the north axis.
2. North row: `nN` rooms of width 6–9 with one shared height `hN`; 3-wide archways on the axis row (always aligned: this is the vista).
3. South row: either a second enfilade (`rows2`, `nS = nN` rooms, archways aligned with probability `alignS`) or one or two *long galleries* of height 5 (the print-corridor variant).
4. East end: Masterpiece hall at the end of the north axis (`cW` 9–11 wide); coda at the end of the south row; an archway between them. The ring is Intro → north row → hall → coda → south row → Intro, so the hall can be bypassed.
5. Cross-links: up to `cross` openings between overlapping north and south rooms (each adds a ring).
6. Cabinets: `cabinets` dead-end rooms (4–6 wide, 4 deep) above chosen north rooms, one door each.
7. Staff band along the outer wall (§4.7); its staff doors often open into cabinets, making a short guarded route between two cabinets.
8. Masterpiece plinth 1 tile from the east wall on the axis.

**Knobs.**

| Knob | Range | Cabinet / Department / Wing |
|---|---|---|
| `rows2` | 0–1 | 0 / p 0.4 / 1 |
| `nN`, `nS` | 2–4, 1–4 | 2,1 / 2–3,1–2 / 3–4,3–4 |
| `hN` | 7–11 | 7–9 / 7–10 / 7–11 |
| room width | 6–9 | |
| `introW`, `cW` | 6–8, 9–11 | |
| `alignS` | 0.6–1.0 | |
| `cross` | 0–3 | 0–1 / 0–2 / 0–3 |
| `cabinets` | 0–2 | 0 / 0–1 / 0–2 |
| staff | p 0.7 | |
| exits | 2–3 | |
| `loopD` | 20 (12–28 in the archive) | |

**Envelope** (measured p5 / p50 / p95 over 600 layouts): pillar loops 2 / 4 / 11; circuits 1 / 2 / 4; gate share 0 / 0 / 0.14; narrow 0.03 / 0.06 / 0.09; openness 0.72 / 0.76 / 0.80; glass 0.53 / 0.67 / 0.76; defensible 0.02 / 0.04 / 0.05; exit tortuosity 1.00 / 1.00 / 1.06; rooms to Masterpiece 3 / 3 / 5. **Identity checks:** vista; rooms to Masterpiece ≥ 3; glass 0.40–0.85.

**Sketch** (Department, seed 3: two enfilades, one cabinet, staff band; 34×29):
```
##################################
#................................#   staff corridor
#................................#
#####################S############
###################....###########
###################.s..###########   cabinet (study)
###################v...###########
###################....###########
######################+###########
#...v...#..v.vv.#...v..#....v...o#
#...o..v#vo.....#.o....#........l#
#.l.....#.......#......#.........#
#.......,.......,......,..b......#
E.......,.......,......,.......C.#   the axis: E sees C
#.......,.......,......,..b......#
#.......#.......#......#.........#
#...o...#.......#......#.........#
#.......#.......#......#.........#
#...I...####,#######,###,,,#######   cross-links and the hall-to-coda arch
#.......#.......#.v....#.........#
#.......#.o.....#vo....#.........X
#.......#.......#......#.........#
#.......,.......,......,.........#
#.......,.......,......,....K....#
#.......,.......,......,.........X
#.......#.......#......#.........#
#.......#.......#......#.........#
#.v..v..#..v.v..#..v...#.......v.#
##################################
```

**Bias by department.**
- `artillery`: `alignS` 1, `cross` ≤ 1; axis snipers at the axis ends, with cover niches every ≤ 5 tiles along the axis (§14.2).
- `guarded`: staff layer on, `two_routes`, curtains in 1–2 doorways, a cabinet linked to the staff corridor.
- `darkness`: `hN` low (more, smaller rooms); dim lux.
- `swarm`: choke supply raised to 2 doors per section (§6.4).
- Copies (`identical_rooms`): `rows2` with mirrored rooms.
- Light (`photosensitive`): paper rooms dim.
- Machines (`hourly_demonstration`): a demonstrator track along the long gallery.

### 4.2 Rotunda and radials

**Precedents and character.** The Altes Museum; SPD's figure-eight landmark room (ML F8). The hub has the highest integration, so patrols and fights converge there (ML F1). Arms are galleries; corner rooms form the ambulatory that turns arms into rings. The exit lies across the hub. When the Masterpiece stands in the hub, the hub *is* the arena and the ambulatory is the bypass.

**Algorithm.** See the pseudocode in §4.10.
1. Hub disc of radius R at the plan centre, rasterised as all tiles with dx² + dy² ≤ R² + R.
2. Four arms on the cardinal axes, each `armW` wide, separated from the disc by a one-tile wall ring and joined by 3-wide archways on the axis. West arm = Intro; east arm = section or Masterpiece hall (optionally split into two rooms); north arm optional; south arm always.
3. Corner rooms in the quadrants, clipped where they come within R + 2 of the centre so they never touch the disc. SE is always the coda. SW is always present and linked to both the Intro and the south arm, which guarantees a cycle through the Intro and a bypass of the hub.
4. Other corners link to both adjacent arms if `amb` (the ambulatory), otherwise to one (an a-space).
5. If the Masterpiece is not in the hub, the hub gets a low basin (see-through landmark) and, for R ≥ 5, a ring of 4–8 columns at radius R − 2 off the axes. If it is in the hub, no free-standing column ring (§6.3).

**Knobs.**

| Knob | Range | Cabinet / Department / Wing |
|---|---|---|
| `R` | 4–6 | 4–5 / 4–6 / 4–6 |
| `armW` | 7 or 9 | |
| `armE`, `armN` | 9–12, 7–9 | |
| `arms` | 3–4 | 3 / 3–4 / 4 |
| `corners` | 2–4 | 2 / 2–3 / 3–4 |
| `amb`, `ambW` | p 0.75; 1 or 3 | |
| `centreInHub` | p 0.4 | |
| `split` (east arm in two) | 0–1 | 0 / 0–0.5 / 1 |
| `colDensity` | 0–0.5 | |
| studies | 0–1 | 0 / 0–1 / 0–1 |
| staff | p 0.5 | |

**Envelope** (p5 / p50 / p95): pillar loops 4 / 6 / 11; circuits 2 / 2 / 4; gate share 0 / 0.13 / 0.30; narrow 0.04 / 0.06 / 0.09; openness 0.74 / 0.78 / 0.82; glass 0.61 / 0.74 / 0.81; defensible 0.02 / 0.03 / 0.05; exit tortuosity 1.00 / 1.06 / 1.19; rooms to Masterpiece 1 / 2 / 3. **Identity checks:** vista; hub degree ≥ 3; the hub has the lowest total depth (highest integration) of all rooms; rooms to Masterpiece ≤ 3.

**Sketch** (Department, seed 12: Masterpiece in the hub, 3 arms, 2 corners; 37×29):
```
#####################################
#.....v.......#######################
#.............#######################
#............v#######################
#...o.........#######################   NW corner (dead end: no north arm)
#.............#######################
#v............#######################
#v............#######################
#.............#######################
#......vv.v...##o....################
#####,#########l......###############
#.......vv..##v........##.....#.v...#
#vo.........#...........#.....#....v#
#...........,b..........,.....,.....#
E.....I.....,.....C.....,.....,.....#   hub = arena; no free-standing columns
#...........,b..........,.....,.....#
#...........#...........#.....#.....#
#...........##.........##.vv..#.....#
#,#############.......#########,,,###
#......v....v.##.....##.....v.......#
#.............###,,,###.............#
#............v#o......,.............#
#...o.........#v......,.............#
#.............#v......,......K......#
#.............#.......#.............#
#.............,.......#.............#   SW corner closes the Intro's ring
#.............#.......#.............#
#...v.....v...#.v...v.#.............#
########################X###X###X####
```

**Bias.**
- `locks_puzzle`: corners behind locks (the `sorting_vault` set piece in a corner).
- Machines (`hourly_demonstration` ++ in V §6.4): the hub is the demonstration floor; the demonstrator's track runs on the radius R − 2 circle.
- `artillery`: Masterpiece in the east arm (a long axis), an axis sniper in the far arm.
- `guarded`: `amb` = 1, guard patrol on the ambulatory.
- `swarm`: R = 4 (hub crowding), corner doors 1 wide.
- `moving_partitions` is forbidden here (V §6.4).

### 4.3 Grand hall with mezzanine

**Precedents and character.** Pitt Rivers, the NHM's Hintze Hall, Akeley Hall (ML F7). Verticality on one map: balcony snipers shoot across the balustrade while melee enemies hold the floor; the stairs are the chokepoints. With `tide_cycle` the hall floor floods and the balconies are the high ground, which may be the best module-programme fit in the launch set.

**Algorithm** (quadrangle scaffold, §4.0, plus this filler):
1. Balconies of depth `balcD` along one or both long walls of the central space, ending 4 tiles short of the east wall so the coda's opening lands on the hall floor.
2. A balustrade row (void, `~`) between balcony and floor, and an end cap at the balcony's east end.
3. `stairs` stair tiles in each balustrade row (ends, plus the middle when 3).
4. North and south band rooms whose shared wall meets a balcony open onto it: elevated side galleries, often a-spaces.
5. Floor bays: vitrine pairs either side of the axis every `bayPitch` tiles; a 3-tile low plinth (skeleton, landmark) on the axis at mid-hall (see-through, so the vista holds); column pairs flanking it.
6. Masterpiece hall per `access`.

**Knobs.** Central space 16–20 / 19–23 / 22–26 wide × 11–13 / 13–15 / 15–17 tall (Cabinet / Department / Wing); `balcD` 2–3; `balcSides` 1–2 (p 0.6 for 2); `stairs` 2–3 per balcony; `bayPitch` 4–6; `bayOff` 2–3; `bayDensity` 0.3–0.8; bands per size (south 1 / 2 / 3 rooms, north 0 / 0–2 / 3); `bandLinks` 0.3–0.7; studies 0 / 1 / 1–2; `access`; staff p 0.5.

**Envelope** (p5 / p50 / p95): pillar loops 4 / 12 / 19; circuits 2 / 4 / 8; gate share 0.13 / 0.17 / 0.50; narrow 0.06 / 0.10 / 0.18; openness 0.72 / 0.77 / 0.82; glass 0.83 / 0.89 / 0.92; defensible 0.02 / 0.04 / 0.06; elevation share 0.04 / 0.09 / 0.17; exit tortuosity 1.08 / 1.21 / 1.41. **Identity checks:** elevation share 0.03–0.22; each balcony has ≥ 2 stairs and no balcony tile is more than 12 walk tiles from a stair; glass ≥ 0.75; vista.

**Sketch** (Department, seed 3: one north balcony, `axis` access; 40×27):
```
########################################
#...v........v...#.......v.v.###########
#................,...........###########
#v.o.............,..o.......v###########   north band: opens onto the balcony
#................,...........###########
#.v..............#...........###########
####,,,###,,,#############,,,###########
#......#:::::::::::::::::~...###########   balcony (elevated)
#......#:::::::::::::::::~...###########
#v.....#~^~~~~~~~~~~~~~^~~...###########   balustrade, two stairs
#v.....#.....................#..v.l....#
#.l....#.....................#.........#
#......,.....................,..b......#
E..I...,.........ppp.........,.......C.#   skeleton on the axis (see-through)
#......,.....................,..b......#
#......#.....................#.........#
#..o..v#...v....v....vv......#..o......#
#.....v#.....................###########
#......#.......o.....o.......###########
#...v..#.....................###########
##################,,,#######,###########
#.v.vv.v....#..........v.#.....v.....v.#
#v..........+.........o..#.............#
#..o..s.....#............#......K......#   study (dead end) and coda
#v.........v#............,.............#
#..vv.v..vv.#............#.............#
###########################X#####X######
```

**Bias.** `artillery`: two balconies, 2 stairs each, ranged species on balconies. `hazard_terrain` (Tides): `tide_cycle` low floor = hall floor; ≥ 15% high tiles reachable from every low region (V Table B) is satisfied by the balconies. `swarm`: high `bayDensity`, giving lanes between cases. Specimens: the axis landmark is a skeleton or diorama group. `moving_partitions` is forbidden (V §6.4).

### 4.4 Case labyrinth

**Precedents and character.** Pitt Rivers' typological displays (ML F7, P5). A glass maze: you see everything and reach little. Ranged enemies dominate; breaking glass is the recurring decision (CS §4.1). Each cell is a typological series, which feeds the labels (Classification's natural home).

**Algorithm** (scaffold plus this filler):
1. The central space is a grid of cells of pitch 3 (2×2 floor, 1-tile vitrine walls); `nx` × `ny` cells; the axis row is a cell row.
2. Randomised depth-first search from the west entry cell carves a spanning tree.
3. Extra connectors: each remaining wall segment opens with probability `loopP` (Nystrom, ML F12).
4. **Tortuosity floor:** while the cell path from the west entry to the east exit cell is shorter than `tortMin` × (nx − 1), close a wall segment on that path, provided every cell stays reachable (at most 40 closures). This keeps it a labyrinth without making it a tree.
5. Clearings: `clearings` 2×2-cell areas with an island column or partition.
6. Posts (wall intersections): turned opaque (column) with probability `opaquePosts`.
7. The glazed walls make the vista hold through glass.

**Knobs.** `nx` 5–6 / 6–7 / 7–8 and `ny` 4 / 4–5 / 4–5 (Cabinet / Department / Wing); `loopP` 0.08–0.30; `tortMin` 1.3–1.7; `clearings` 0–1; `opaquePosts` 0–0.3; aisle width 2 (1 as an option, Decision L-D2); bands, studies and `access` as in §4.3.

**Envelope** (p5 / p50 / p95): pillar loops 4 / 8 / 13; circuits 1 / 3 / 6; gate share 0.14 / 0.20 / 0.50; narrow 0.17 / 0.22 / 0.28; openness 0.67 / 0.73 / 0.80; glass 0.81 / 0.88 / 0.92; defensible 0.02 / 0.03 / 0.05; exit tortuosity 1.08 / 1.28 / 1.81. **Identity checks:** glass ≥ 0.75; narrow ≥ 0.15; the crossing ratio ≥ `tortMin`; vista through glass.

**Sketch** (Department, seed 8: `window` access, north band of three rooms; 40×28):
```
########################################
#........vv..#........v.v.#.v..........#
#............,............#v..........v#
#v.|.........#..|.........#..|........v#
#............#............#............#
#............#............,............#
###,,,###,#############,,,##,######,,,##   last north room leads into the hall
#.......#...........v........#.........#
#.......#...........v........#.........#
#v|....v#..vvvvvvv..vvvovvo..#.........#
#v......#.....v.....v........#........l#
#.l.....#.....v.....v........#.........#
#.......#vvv..o..vvvo..vvvo..v..b......#
E...I...,.....v..v.....v..v..v.......C.#   glazed screen: C seen, not entered
#.......,.....v..v.....v..v..v..b......#
#.......,..v..v..v..vvvv..v..#v........#
#.......#.....v..v.....v.....#.........#
#.......#.....v..v.....v.....#.........#
#.......#vvvvvv..vvvo..v..v..#.........#
#.......#..............v.....#........o#
#.......#..............v.....#.........#
###,,,###,##############+##,############
#..............#..vv..v...#....v..v....#
#..............#..........#............#
#v.|..........v#v.|.s....v#.....K......#
#v.............#v........v#............#
#....v......v..#.v..vv..v.#............#
############################X###X###X###
```

**Bias.** `artillery`: `loopP` low, `opaquePosts` 0 (maximum glass). `swarm`: 1-wide aisles option (narrow aisles help the player). `locks_puzzle` (`heist_plinths`, `sorting_vault`): a clearing holds the plinths. Classification (`taxonomy_aggro`): one class per cell, so a wake spreads along visible lines. Copies (`copies_weaken`): copy groups in adjacent cells, originals behind the glass. `tide_cycle` only with period ≥ 18 (V Table B).

### 4.5 Storage stacks

**Precedents and character.** Depot Boijmans' open storage (ML F7, P6). Short sightlines, ambushes at aisle crossings, long parallel circuits: stealth country. Compactor shelving moves (`moving_partitions`); crates can be pushed.

**Algorithm** (scaffold plus this filler):
1. A one-tile perimeter aisle inside the central space.
2. Rows of back-to-back shelving blocks (2 deep, `blockLen` long) separated by aisles of width `aisle`. Every `crossEvery` blocks, a 2-wide cross-aisle.
3. Blocks deleted with probability `deleteP` (clearings); a one-tile break in a block with probability `breakP`.
4. A main aisle on the axis, 1–2 wide (`mainAisle2`).
5. `crates` pushable crates in aisles, never on gate cells.
6. Compactors (`moving_partitions` only): up to `compactors` blocks become movable; LV13 checks reachability in every compactor state.

**Knobs.** Central space as §4.3 but 11–13 / 12–15 / 13–17 tall; `aisle` 1 or 2; `blockLen` 4–8; `crossEvery` 2–3; `deleteP` 0–0.2; `breakP` 0.05–0.25; `mainAisle2` p 0.4; `crates` 0–6; `compactors` 0–3; staff p 0.7 (3 staff doors).

**Envelope** (p5 / p50 / p95): pillar loops 4 / 9 / 21; circuits 3 / 7 / 13; gate share 0.13 / 0.20 / 0.50; narrow 0.10 / 0.19 / 0.28; openness 0.59 / 0.65 / 0.72; glass 0.13 / 0.22 / 0.33; defensible 0.06 / 0.09 / 0.17; exit tortuosity 1.11 / 1.24 / 1.42. **Identity checks:** glass ≤ 0.45; openness ≤ 0.75; narrow ≥ 0.07; defensible ≥ 0.04. No vista requirement in the `axis` variant (the main aisle usually gives one anyway: 50% measured).

**Sketch** (Department, seed 2: `window` access, staff band absent; 41×29):
```
#########################################
#...v.v........#...v..v..v..v.#.........#
#..............#.............v#.........#
#v.|...........#..|...........#..|......#
#v.............,..............,........v#
#..............,..............#.........#
#.v............,..............#.........#
#####,,,##,,,###########,,,########,,,###
#.......#......................#o.......#
#......v#.HHHH.HHHH..HHHH.HHHH.#.......v#
#v......#.HHHH.HHHH..HHHH.HHHH.#........#
#...|...#.................v....#.......l#
#.l.....#.HHHH.HHHH..HHHH.HHHH.#........#
#.......,.HHHH.HHHH..HHHH.HHHH.v.b......#
E...I...,......................v......C.#   main aisle; glazed screen
#.......,......................v.b......#
#.......#.HH.H.HHHH..HHHH......#........#
#.......#......................#........#
#.......#.HHHH.HHHH..HHHH.HHHH.#........#
#.......#.HHHH.HHHH..HHHH.HHHH.#........#
#.......#......................#....o...#
####,,,####,,,##,###########,,,##########
#.............,....v.......#.........v..#
#.............,............#............#
#v.|..........,..|.........#.....K......#
#.............#............,...........v#
#.............#............,............#
#.v.....v.....#............,.........v..#
#############################X#####X#####
```

**Bias.** `darkness` and Light (`photosensitive`): aisle 1, lux Dark or Dim, lamps only at crossings. `guarded`: a patrol along the main aisle and the perimeter, staff layer on. Machines (`moving_partitions` ++): compactors. `attrition` (`identical_rooms`): repeated aisle modules. `tide_cycle` is forbidden (V §6.4).

### 4.6 Sculpture court

**Precedents and character.** The Glyptothek (ML P9); the British Museum's court (ML P3). The most pillar loops and the least defensible ground: kiting and line-of-sight play, statues that move only when unseen (`unobserved_motion`). This is the pillar-dancing machine, and §14.1 is its counter.

**Algorithm** (scaffold plus this filler):
1. Optional loggia: a column line 1 tile in from the walls on all four sides (columns every 2 tiles, kept clear near the axis), making a covered walk.
2. Optional basin on the axis at mid-court (void, see-through: it blocks the walk, not the vista), 3–5 wide, 3 deep: a Brogue lake (ML F9).
3. Poisson-disc dart throwing for statues inside the loggia: minimum spacing `spacing`, `tries` attempts, never on the axis row, at least 2 tiles from the basin; with `symmetry`, mirrored across the axis; a share `lowShare` are low plinths (see-through) instead of statues.
4. Masterpiece hall per `access`.

**Knobs.** Central space as §4.3; `loggia` p 0.5; basin p 0.6, width 3 or 5; `spacing` 3–5; `tries` 30–80; `symmetry` p 0.5; `lowShare` 0.1–0.4.

**Envelope** (p5 / p50 / p95): pillar loops 11 / 26 / 48; circuits 1 / 3 / 5; gate share 0.14 / 0.17 / 0.50; narrow 0.06 / 0.11 / 0.16; openness 0.65 / 0.72 / 0.79; glass 0.37 / 0.57 / 0.79; defensible 0.03 / 0.06 / 0.12; exit tortuosity 1.08 / 1.21 / 1.37. **Identity checks:** pillar loops ≥ 8; vista.

**Sketch** (Department, seed 6: loggia, basin, symmetric statues, `window` access, staff band; 37×27):
```
#####################################
#...................................#
#...................................#
#########S#######################S###
#..vv..#....................#.......#
#......#.o.o.o.o.o.o.o.o.o..#v......#   loggia columns
#v.|...#....................#.......#
#v.....#.o................o.#.......#
#.....v#....o.....o.........#......l#
#vl....#.o................o.#.......#
#......,.......~~~~~...p....vb......#
E..I...,.......~~~~~........v.....C.#   basin on the axis; glazed screen
#......,.......~~~~~...p....vb......#
#......#.o................o.#.......#
#......#....o.....o.........#.......#
#......#.o................o.#.......#
#......#....................#.......#
#......#.o.o.o.o.o.o.o.o.o..#.......#
#......#....................#o......#
##,,,###,##################,#####,,,#
#..........v..#..vv.vv.v.#..........#
#.............#..........#..........#
#.............+..|.s....v#....K.....#
#..|..........#..........#..........#
#.............#..........#..........#
#..vv.vv.vv...#.v.vv.vv..#..........#
###########################X##X##X###
```

**Bias.** Specimens (`unobserved_motion` ++): high statue density, `symmetry` on (readable), lamps at the loggia corners. Tides (`tide_cycle` ++): the court floor is low; the loggia walk is raised. `swarm`: loggia off (an open court where being surrounded is the danger). `artillery`: high `lowShare`. `alarm_network`: at most 2 guards (V Table B). `identical_rooms` and `moving_partitions` are forbidden.

### 4.7 The staff layer (shared)

**Character.** Back of house: dim corridors, stores, offices. It is the short, dangerous route of `two_routes` (Dormans & Bakkes, ML F14) and the home of loot, staff plans and guards. Never required.

**Algorithm.**
1. A 2-wide corridor along one outer side of the plan, chosen opposite the vista axis where possible; in the canonical frame, the north edge.
2. 1–2 staff rooms: carved from band slots (one north band room becomes a store or office) or at the corridor's ends.
3. Staff doors into 2–4 public rooms that touch the corridor, preferring one in section 1 and one adjacent to the coda or the Masterpiece hall, so the staff arc is a real shortcut. Clearance N = median Clearance at this position + {0, 1, 2}, so a Clearance card from this department can matter.
4. 0–2 hinged panels from public rooms into the staff layer.
5. Lux Dim. When a staff layer exists, guard patrols include ≥ 1 post on it.
6. Contents: the store gets crates, shelving, 1–2 ambient consumables; the office gets the staff plan (§15.3) and, in about 1 department in 3, the registry desk (CS §11); the conservation lab (sometimes) gets the Conservator (CS §11).

**Probability:** see §3.4. **Envelope:** the staff layer is excluded from public metrics; its own checks are "not required" (LV5) and "at least one staff door within 10 tiles of the coda or the hall" when `two_routes`.

### 4.8 Later programmes (one line each)

- **Courtyard quadrangle:** a ring of rooms round an open court with 4–8 openings; addLoops d ≈ 12; the most route choice of any programme (ML P3).
- **Diorama hall:** a dark hall ringed by glass-fronted alcoves that are dormant spawners (`diorama_spawner`); a wave challenge with lit windows (ML P7).
- **Period-room suite:** authored room vaults with SHUFFLE/SUBST variants on a spine corridor, low furniture and hinged panels, after DCSS vaults (ML P8, F10).
- **Spiral ramp:** a deterministic gauntlet whose laps see each other across void strips, with a staff lift as the shortcut back from the centre (ML P10).
- **Temporary-exhibition route:** a Spelunky-style path walk behind a one-way turnstile, from intro panel to sections to centrepiece to a shop coda (ML P12, F15).

### 4.9 Programme choice, side wings and compatibility

- **The programme is fixed per department** in the pack (`frame.programme`, chosen in S1 under V §6.4's weights, P §2.2). D §2.4 H8 forbids the same programme twice in a row. The runtime never re-draws it.
- **Side wing.** The frame's lean is "a main programme plus one side band plus the staff layer" (ML D3 (b)). In the quadrangle scaffold, the north band takes a *band style*:
  - `suite` (default): rooms in series, as in the sketches;
  - `cabinets`: a corridor with 2–4 dead-end cabinets (Copies, Classification);
  - `store`: a shelving store in the band (Light, Memory later);
  - `enfilade`: aligned archways along the band (formal, when `artillery`).

  Enfilade and rotunda use cabinets and corners instead.
- **Compatibility as data.** V §6.4's module × programme matrix is the authority; the layout code reads it to refuse forbidden pairs (×) and to apply caps (−).

### 4.10 Pseudocode: the rotunda embedder

```js
function embedRotunda(plan, K, rng) {
  const oy = K.staff ? 3 : 0, R = K.R, h = K.armW >> 1;
  const cx = K.armE + 2 + R, cy = oy + K.armN + 2 + R;               // arm, wall ring, disc
  const L = newLayout(2 * K.armE + 2 * R + 5, cy + R + K.armN + 3);
  const hub   = addDisc(L, 'hub', cx, cy, R);                          // dx² + dy² <= R² + R
  const intro = addRect(L, 'intro', 1, cy - h, K.armE, cy + h);        // west arm
  const ex0 = cx + R + 2, ex1 = cx + R + 1 + K.armE;
  const eRole = K.centreInHub ? 'section' : 'centre';
  let E1, E2 = null;
  if (K.split && rng.chance(K.split)) {                                // east arm in two rooms
    const a = K.armE >> 1;
    E1 = addRect(L, 'section', ex0, cy - h, ex0 + a - 1, cy + h);
    E2 = addRect(L, eRole, ex0 + a + 1, cy - h, ex1, cy + h);
  } else E1 = addRect(L, eRole, ex0, cy - h, ex1, cy + h);
  const N = K.arms === 4 ? addRect(L, 'section', cx - h, 1 + oy, cx + h, cy - R - 2) : null;
  const S = addRect(L, 'section', cx - h, cy + R + 2, cx + h, cy + R + 1 + K.armN);

  // corners: clipped away from the disc; SW and SE always; others by count
  const clip = (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= (R + 2) ** 2;
  const want = new Set(['SW', 'SE', ...rng.shuffle(['NW', 'NE']).slice(0, K.corners - 2)]);
  const C = {};
  if (want.has('NW')) C.NW = addRect(L, 'section', 1, 1 + oy, cx - h - 2, cy - h - 2, {}, clip);
  if (want.has('NE')) C.NE = addRect(L, 'section', cx + h + 2, 1 + oy, L.W - 2, cy - h - 2, {}, clip);
  C.SW = addRect(L, 'section', 1, cy + h + 2, cx - h - 2, L.H - 2, {}, clip);
  C.SE = addRect(L, 'coda', cx + h + 2, cy + h + 2, L.W - 2, L.H - 2, {}, clip);

  // programme openings: the axis is sacred (3 wide where possible, 1 wide at the target otherwise)
  setEntrance(L, 0, cy);
  arch(L, intro, hub, { y: cy }); arch(L, hub, E1, { y: cy }); if (E2) arch(L, E1, E2, { y: cy });
  if (N) arch(L, hub, N, { x: cx }); arch(L, hub, S, { x: cx });
  const adj = { NW: [intro, N], NE: [E2 || E1, N], SW: [intro, S], SE: [E2 || E1, S] };
  for (const [name, room] of Object.entries(C)) {
    const arms = adj[name].filter(Boolean);
    const both = name === 'SW' || name === 'SE' || K.amb;               // SW: cycle through the Intro; SE: bypass to the coda
    for (const a of (both ? arms : [rng.pick(arms)])) open(L, room, a, { width: K.ambW, rng });
  }

  // the Masterpiece and the hub's furniture (arena rule, §6.3)
  if (K.centreInHub) { hub.role = 'centre'; setPlinth(L, cx, cy); }
  else {
    setPlinth(L, (E2 || E1).x1 - 1, cy);
    setFixture(L, cx, cy, 'basin');                                    // see-through landmark
    if (R >= 5) for (const [dx, dy] of columnRing(R - 2, K.colDensity)) setFixture(L, cx + dx, cy + dy, 'column');
  }
  L.meta = { vista: true, formal: true, axisY: cy };
  placeExits(L, C.SE, plan.exitCount, rng.chance(0.5) ? 'E' : 'S');
  return L;                                                            // null if any rect fell outside the cap
}
```

---

## 5. L3: rooms and openings

### 5.1 Rasterisation

- Rooms are rectangles, discs (`dx² + dy² ≤ R² + R`) or rectangles clipped by a disc. Walls are whatever is not carved, and neighbouring rooms share a 1-tile wall, so every opening is 1 tile deep.
- Every carved tile carries its room id; fixtures placed later keep it.
- Openings are cut from *wall candidates*: wall tiles with room A on one side and room B on the opposite side. When a target coordinate is given (an axis), the opening goes there. If no 3-wide candidate lies within 1 tile of the target but a 1-wide one lies on it, the opening is 1 wide at the target: the axis is never moved to keep a width. The prototype found this rule necessary in the case labyrinth, where vitrine walls cut the 3-wide candidates near the axis.

### 5.2 Opening styles and `addLoops`

**Style ratios** (public openings):

| Programme | Archways | Doors | Notes |
|---|---|---|---|
| Enfilade, rotunda | ≥ 80% | studies, cabinets, choke supply | The axis openings are always archways |
| Grand hall, sculpture court | ~60% | ~40% | Band-to-band links are doors half the time |
| Case labyrinth, storage stacks | ~50% | ~50% | Aisles are already narrow; doors mark the bands |

**`addLoops(d)`**, Brogue's single most useful post-pass (ML F9), at room-pair granularity:
1. Collect pairs of adjacent public rooms and shuffle them with the openings stream.
2. Exclude pairs involving staff rooms, studies, the ticketed room, a Masterpiece apse, and the pair (Intro, coda).
3. For each pair, take the middle wall candidate and BFS the walking distance between the tiles on its two sides.
4. If that distance exceeds `d`, cut an opening in the programme's default style.

Thresholds: `d` = 20 for every launch programme as a starting value, searched over 12–28 by the knob archive (§13.4). ML suggests about 12 for the later courtyard and ∞ for the spiral and the temporary-exhibition route. Cost measured: 0.42–0.58 ms p50.

### 5.3 The a-space pass

Museum plans want rewarding alcoves: in Tzortzi & Bakola's site museums a-spaces were "between a quarter and a third" (ML F4), and every a-space needs a visible lure (Bitgood, ML F5). The first prototype had almost none (a-share p50 0–0.10) because `addLoops` and the band links connect everything. The pass that fixed it:

```js
function aSpacePass(L, n, rng) {
  const candidates = rng.shuffle(L.rooms.filter(r => r.role === 'section' && !r.central && area(r) <= 70 && !onVistaLine(L, r)));
  let made = 0;
  for (const r of candidates) {
    if (made >= n) break;
    const es = publicOpenings(L, r); if (es.length < 2) continue;
    const keep = narrowest(es), removed = es.filter(e => e !== keep);
    removed.forEach(e => closeOpening(L, e));
    if (structureOK(L)) { r.role = 'study'; r.deadEnd = true; made++; }   // all reachable, coda reachable without
    else removed.forEach(e => reopen(L, e));                              // the hall, Intro still on a cycle
  }
}
```

- Targets: Cabinet 0–1, Department 1, Wing 1–2 rooms, on top of the programme's own dead ends (enfilade cabinets, rotunda corners without the ambulatory).
- Rooms on the vista line are never converted (the prototype lost the rotunda's vista once by converting the inner east arm).
- Measured a-share p50 after the pass (Cabinet / Department / Wing): quadrangle programmes 0.20 / 0.29–0.33 / 0.30 (the apse counts as an a-space in the `axis` variant); rotunda 0.14 / 0.14 / 0; enfilade 0 / 0.11 / 0.10 (its a-spaces are the cabinets above the row). The museum target of 0.25–0.33 is met only by the quadrangle programmes from Department size up. Whether every programme should meet it is a tuning question for the persona regressions (§13.3), not a rule.

### 5.4 Voids, pools and balconies

- Voids (balustrades, basins, atria) are placed like Brogue lakes: only where they do not disconnect the walkable region (`lakeDisruptsPassability`, ML F9). Bridges are added only where they shorten a path.
- `tide_cycle` low floors are passable terrain at height 0, not voids. Their module check (LV13) needs ≥ 15% high tiles reachable from every low region (V Table B).
- Balconies are floor at elevation 1, bounded by a 1-tile balustrade; each needs ≥ 2 stairs (LV14), and the floor tiles next to a balustrade stay free of blocking furniture so a pushed actor has somewhere to land (V §7.2: a push of 2+ over a balustrade makes the target fall).

### 5.5 The ticketed room

- Created by the a-space mechanism on a NORMAL room (≥ 6×6) in the second half of the tour. Its kept opening becomes a locked door with a placard: "Ticket holders only".
- The ticket lies at a ticket desk (low furniture plus a label) in a gallery of smaller tour rank, or is carried by the rival visitor in `social` departments. A lock record `{door, key: 'ticket', keyAt, rescue}` is stored (§14.4).
- Contents: the department's best optional item (§7.5), a set piece from the vault library (`sorting_vault`, `heist_plinths`), and a tethered warden at the door or the prize.
- The name avoids D §3.10, where "Special Exhibition" is a kind of department door.

### 5.6 Closed for reinstallation

- Candidates: openings on the main cycle that are not bridges. Pick the one whose closure lengthens the walk from the Intro to the Masterpiece hall the most.
- Replace it with a partition (3 bashes, noise 2, V §7.2) and a "Gallery closed for reinstallation" sign. The rooms beyond stay reachable round the other arc; breaking the partition is a noisy shortcut and, under `alarm_network`, a breach. This is Unexplored's shortcut cycle (ML F13) with no extra geometry.
- Variant (p 0.3): a locked door whose key hangs in the staff office.
- Validation treats the partition as closed (LV1).

### 5.7 Hidden panels

After SPD's painter (ML F8): public rooms always keep an unbroken path; hidden panels go only on edges that nothing requires (a secret study, a staff shortcut). A hidden public room takes a room number in sequence but is left off public plans, so it shows as a gap (CS §1.2, §8.1).

---

## 6. L4: curation

### 6.1 Bay templates

Meso-patterns in Dahlskog et al.'s sense (PL F4, F5), stamped as small tile templates. Each declares its footprint, facing and the roles and programmes that may use it.

| Template | Footprint | Rule | Where |
|---|---|---|---|
| `wall_run` | 1 × 2–5 vitrines against a wall | Corners and door clearances excluded; gaps of 1 | Every gallery |
| `typological_series` | 1 × 3–6 vitrines, one "type" | All cases share a series key (twelve keys, thirty spoons) for the labels | Case labyrinth cells, Classification |
| `case_pair_bench` | 2 vitrines facing a bench | On the room's axis, bench facing the room's landmark | Formal galleries |
| `island_case` | 1–2 free-standing vitrines | ≥ 2 tiles from walls | Rooms ≥ 7×7 |
| `plinth_trio` | 3 plinths in a row | Dormant statues or figures | Sculpture court bands, Specimens |
| `screen` | 1 × 3 partition | The sight-blocker of choice in formal rooms | Seasoning |
| `column_pair` | 2 columns mirrored across the axis | Formal rooms; never in the Masterpiece hall | Seasoning |
| `rope_enclosure` | rope line round 1–3 plinths | Crossing fires `touch_case` (V §1.2) | Specimens, `heist_plinths` |
| `diorama_alcove` | glass front in a wall niche | Needs wall depth 2 | Later diorama hall; Specimens bands |
| `curtain_doorway` | curtain in a doorway | Hiding place (CS §3.9) | `guarded`, `darkness` |
| `reading_desk` | low furniture + lamp | Lit label spot | Studies, Light |
| `ticket_desk` | low furniture + label | Holds the ticket | §5.5 |
| `kiosk` | low furniture counter 3 long | Gift-shop clerk | Coda |
| `crate_stack` | 1–3 crates | Pushable; never on gate cells | Stacks, staff store |

### 6.2 Grid rules

After Merrell et al.'s interior-design guidelines (ML F17), as hard grid constraints:

| # | Rule | Implementation |
|---|---|---|
| R1 | **Clearance** | Reserved walkway: the 4-connected shortest path inside the room between every pair of its openings, plus the 3×3 block at each opening. Formal programmes dilate the path by 1 tile |
| R2 | **Circulation** | After each stamp: all openings of the room remain mutually reachable inside the room, and every case keeps an adjacent reachable tile. Otherwise undo |
| R3 | **Alignment** | Wall runs touch exactly one wall (corners excluded); free-standing pieces keep ≥ 2 tiles from walls |
| R4 | **Balance** | Formal programmes mirror stamps across the room's axis with probability `symmetry` 0.6–1.0 |
| R5 | **Emphasis** | Benches face the room's focal point; the landmark sits at the far end of the room's main axis |
| R6 | **Gate cells** | No blocking fixture on a gate cell (articulation tiles cutting ≥ 4 tiles, computed before curation) |
| R7 | **Vista reservation** | No opaque fixture on the line from the entrance to the Masterpiece plinth when the programme needs a vista. Before this rule the prototype failed its vista check in 3 of the first 6 grand-hall seeds |
| R8 | **Landing strip** | Floor tiles adjacent to a balustrade stay free |

### 6.3 The Masterpiece hall

D's rule M4 says the arena "has no pillar loop shorter than 16 tiles of circumference". The naive furnishing breaks it: a free-standing lectern 3 tiles in front of the plinth, flanking columns, and the rotunda's column ring each make 8-tile loops. Rules:
- Only wall-attached blockers in the hall: pilasters and wall cases. Any free-standing group must have a ring of ≥ 16 tiles (a 4×2 dais qualifies).
- The viewing lectern stands against a wall, 3–4 tiles (Chebyshev) from the plinth, lit Low (CS §5.4).
- Benches are passable and face the plinth.
- The plinth counts as empty (mountable) for the loop check, since the Masterpiece leaves it when it wakes.
- In the rotunda with the Masterpiece in the hub, there is no column ring.
- A 2×2 `mp_colossus` needs a hall of at least 11×11.

The check (LV8) finds connected blocker groups inside the hall that touch no wall and measures their ring of adjacent walkable tiles. With these rules it passed in all 3,600 prototype layouts.

### 6.4 Tactical seasoning

| # | Rule | Source |
|---|---|---|
| T1 | Every combat-sized room (≥ 36 floor tiles; not the coda, not the hall) has ≥ 1 sight blocker and ≥ 1 see-through blocker. Supplies V's `los` counter tag | ML §3.4 |
| T2 | Cover: every floor tile lies within 6 tiles (Chebyshev) of an interior blocker or an opening ("no room larger than 12×12 without cover") | ML §3.4 |
| T3 | The Intro has ≥ 2 onward openings and lies on a cycle (LV4) | ML §3.4 |
| T4 | **Choke supply:** every section has ≥ 1 opening of width 1 on a ring edge (a door, or a 1-wide gap in a screen). `swarm` primary: ≥ 2 per section. This makes V's `choke` counter tag satisfiable, which measured tile chokepoints alone do not (§13.1) | V §1.9, §8.2 |
| T5 | Free-standing blockers go on the free tile farthest from the walls, mirrored in formal rooms | prototype |

### 6.5 Lighting

Lux bands are those of CS §3.6 (Dark 0, Dim 1, Low 2, Bright 3, Spotlit 4 for exhibit tiles).

| Room | Default band | Overrides |
|---|---|---|
| Vestibule | Low | none |
| Intro | Low | The template may require Dim or Dark (`photosensitive`, `staged_lights`) |
| Galleries | From the department's material: paper, textile, photographs → Dim; oils, wood, leather → Low; stone, metal, sculpture → Bright (CS §3.5) | `darkness`: ≥ 50% of galleries Dim or Dark (V §8.1). Power Cut directive: −1 band |
| Grand hall | Floor Low, balconies Low | |
| Sculpture court | Bright (top-lit) | |
| Storage stacks | Dim; crossings Low by lamps | |
| Studies | Dim; the lure Spotlit | |
| Masterpiece hall | Low; the Masterpiece Spotlit | Phase rules (CS §5.4) |
| Staff layer | Dim | |

Lamps (V §7.2) go at junction tiles of Dim rooms, so light is a resource the player can see before using.

### 6.6 Placement order and density

- **Order:** Masterpiece hall, Intro and vestibule (from templates), studies (lures first), sections in tour order, coda, staff.
- **Per room:** compute the reserved mask (R1, R6, R7, R8); draw templates from the role's menu, weighted by programme, family and module; place greedily up to the density target, undoing any stamp that fails R2.
- **Density targets** (cases per 100 floor tiles): study 10–14; section gallery 5–9; Intro 3–5; coda 2–3. Central spaces get their density from the filler.

---

## 7. L5: population

### 7.1 The entrance safe zone

After SPD's rule (ML F8) and D §3.6:
- The safe zone is the vestibule plus every tile within 8 walk tiles of the entrance.
- No hostile spawns in it.
- No hostile's wake region reaches it: prox radius by walk with line of sight, an axis sniper's axis, or a patrol route during the first 20 turns.
- Orientation-pool exhibits stand at walk distance 9–14, which is why the Intro must offer ≥ 12 walk tiles from the entrance to its onward openings (§11.1).
- Guards and neutrals are exempt; they never attack.

### 7.2 Spending the encounter budget

D §3.4 sets the budget E and its split, and the population pass spends it:

| Gallery role | Share of E |
|---|---|
| Intro | ≤ 8%, orientation pool only (D §3.6) |
| Sections | ~70%, split 1 : 1.3 : 1.6 (: 1.9) in tour order |
| Optional rooms (studies, ticketed room, staff layer) | ~22% |
| Coda | 0 |
| Masterpiece hall | outside E |

Within a gallery the pass spends greedily by the role mix for the primary type (D §3.5), placing each role in its habitat (§7.3). Leftovers below 1 FE are dropped, and LV12 checks the placed total is within ±10% of E. Zones in central spaces receive their share as if they were rooms.

### 7.3 Habitats

| What | Habitat | Rules |
|---|---|---|
| Fodder, skirmishers, brutes (dormant) | Plinths in bays; open floor beside cases | Off gate cells; brutes only in rooms ≥ 36 tiles |
| Artillery, controllers at range | The top 20% of the room's tiles by isovist area; balconies | Exposure cap (§14.2); screened unless the primary is `artillery` (V §10.5) |
| Ambushers | The bottom 20% by isovist area: aisle crossings, behind screens and curtains; `wall_lurker` in shelving; `mimic_vitrine` as one case in a wall run | Never in the safe zone; never adjacent to the Intro's openings |
| Swarms | Jars and vitrines (plate glass), or one group on open floor | One group per room |
| `diorama_spawner` | Diorama alcoves | Only where the programme or band style provides alcoves |
| `demonstrator` | A fixed track crossing a route; track tiles reserved | Safe window ≥ 3 turns at every forced crossing (LV13) |
| `tethered_warden` | Adjacent to what it guards: the ticketed room's door, a study's lure, a vault | Its tether never covers a required route |
| `unobserved_mover` | Plinths at bends and behind screens | Where the line of sight breaks, so the mechanic has something to act on |
| Staff guards | Patrol posts (§7.6) | CS §3.7 counts: 1, 2 or 3 |
| Masterpiece | Its plinth (§6.3) | Companion exhibits in the last section (D M3, M6) |

Ranged roles are scored by isovist area computed at candidate tiles only (12 candidates per placement in the prototype), not over the whole map.

### 7.4 Highlights and quotas

D §4.1's rules, made operational:
- **Restoration kits.** One in sections 1–2 and one in a later section. At least one within a 4-room detour of the shortest entrance-to-exit route: in a room at room-graph distance ≤ 2 from a room on that route. Never in a hidden room, the Masterpiece hall or the ticketed room; never in a case whose lock exceeds the Clearance you will have at that point; at most one behind glass you must break.
- **Clearance card.** In a room earlier on the tour than the first case or staff door it unlocks.
- **Ambient items.** Cabinet 5, Department 7, Wing 9 consumables and 1 / 2 / 3 equipment (D §4.1): weighted toward deeper rooms, at least one per a-space, preferring cases.
- **Labels without objects.** About 1 case in 6 holds no object: "On loan elsewhere" (CS §4.1).
- **Coins** in donation boxes, 30–50 per department.

### 7.5 The best optional item and its lure

- The best optional item goes in the ticketed room if one exists, otherwise in the **deepest a-space**: the dead-end room with the greatest walk depth from the entrance, excluding the vestibule, the Intro and the Masterpiece hall. Delphi's hierarchy "culminates in the deepest space" (ML F4).
- **Lure:** a Spotlit vitrine in that room, placed so that at least one tile of the tour path sees it within 10 tiles. Visitors backtrack only for a visible payoff (Bitgood, ML F5); must-notice items go where many tiles can see them, optional loot in segregated depth (Peponis et al., ML F2).
- The second-best item goes to the next deepest a-space.

### 7.6 Guards and patrols

- **Posts:** 3–5 room centres from the top quartile of public rooms by integration (lowest total depth on the room graph; integration predicts where visitors walk, Choi via ML F1). None in the safe zone; ≥ 1 on the staff layer when it exists.
- **Route:** the posts ordered as a cycle in the room graph where one exists (a readable loop), otherwise a ping-pong route. 5-turn pauses at posts (CS §3.7).
- **Check:** the `alarm_network` window rule (every required route has a ≥ 3-turn gap in guard sight, V Table B) is simulated over one patrol period in LV13.

### 7.7 Services, NPCs and stealth furniture

- **Coda:** the kiosk and gift-shop clerk (CS §11); 2–3 exit doors with placards, at least 3 tiles apart.
- **Loan Desk:** about half of departments (CS §6.6), in a section-1 gallery on the Intro's ring.
- **Registry desk:** about 1 department in 3 (CS §11), in the staff office or the coda.
- **Conservation lab:** sometimes (CS §11), in the staff layer.
- **Rival visitor:** `social` departments, starting in section 1.
- **Stealth departments** (`guarded` or `darkness` primary): ≥ 2 curtains and ≥ 2 empty plinths (CS §3.9 hiding). **`attrition`:** ≥ 2 benches (V §8.2).

---

## 8. L6: text and label hooks

### 8.1 Room numbers

- Rooms are numbered `D·100 + n`, where D is the run position (Rooms 401–413 in department 4, as in CS §8.6's example). n counts in **tour order** from 01: galleries in `L_tour` order (the vestibule shares the Intro's 01), then the Masterpiece hall, then the coda.
- Studies and the ticketed room are numbered in sequence. A hidden room takes its number but is left off public plans, so it shows as a gap (CS §1.2). Staff rooms are unnumbered ("Staff").
- Departments seen only in the Directory use the grammar's own ranges (P §5).

### 8.2 Facts emitted

The label writer's runtime grammar and the UI consume facts, never tiles.

| Per room | Per department |
|---|---|
| number; role; section index and panel key; programme element ("north enfilade", "balcony", "rotunda", "aisle 3"); compass side (after the transform); size class; lux band; landmark id; bay templates and series keys; exhibits and items placed (ids); neighbours by number; on the tour or not; hidden or not | programme; cycle type; entry side; room range; exits (placard slot, room, wall); Masterpiece room and name; vista (bool) and access variant; ticketed room and ticket room; closed room; Loan Desk, kiosk, registry desk rooms; Highlight rooms (for the Highlights box, CS §8.6); `L_tour`; the plan geometry for §15 |

### 8.3 Signs and panels

- **Section panels** at the first room of each section on the tour (CS §4: shown as a banner on entering).
- **Wayfinding signs.** In every junction room (a d-space, §13.1), each onward opening gets a wall sign listing the room numbers reachable through it without coming back through this room, plus "Masterpiece →" and "Exit →" where they apply. The ranges come from a BFS partition of the room graph. Edges to orient and landmarks to motivate are how levels avoid disorientation (AI&G §9.1 via ML F18); this costs one BFS per junction.
- **Example** for the worked example's hub, Room 407: "← 401–402 · ↑ 405–406 · → 404 · ↓ 403, 408 and Exit · Masterpiece: here".

---

## 9. L7: validation

### 9.1 Checks

All deterministic. Costs are estimates from the prototype's BFS timings, except where measured.

| Id | Check | Method | Cost |
|---|---|---|---|
| LV1 | **Reachability:** every public room (except the ticketed room's interior) and every exit is reachable from the entrance with staff doors, hidden panels, locks and partitions closed | BFS on tiles | 0.1 ms |
| LV2 | **Lock order:** the ticketed room is reachable only with the ticket; the ticket is reachable without it; exits need no key | BFS over (tile, keyset), ≤ 2 keys | 0.3 ms |
| LV3 | **Masterpiece optional:** an exit is reachable with the hall's tiles blocked (D §6.2) | BFS | 0.1 ms |
| LV4 | **Intro:** ≥ 2 onward openings; the Intro lies on a cycle of the room graph; the template's invariants hold (§11.2) | Room-graph bridge test; template predicates | 0.2 ms |
| LV5 | **Staff optional:** LV1 already excludes staff doors; no Highlight is reachable only through the staff layer | BFS | 0.1 ms |
| LV6 | **Safe zone** (§7.1) | BFS radius 8, wake regions | 0.2 ms |
| LV7 | **No unrewarded long dead end:** every dead-end branch reaching ≥ 12 walk tiles beyond its junction holds a reward (item, Highlight, lure, set piece). Empty dead-end corridors ≥ 8 tiles are filled in | Room graph + BFS | 0.2 ms |
| LV8 | **Arena loop rule** (D M4, §6.3) | Blocker groups inside the hall | 0.1 ms |
| LV9 | **Vista** where the programme needs it: some Intro tile sees the Masterpiece plinth | Bresenham over see-through tiles | 0.1 ms |
| LV10 | **Gate cells and circulation:** no blocking fixture on a gate cell; every case reachable | Tarjan (measured inside analysis) | 0.9 ms |
| LV11 | **Worst-case runner** (§9.2) | Dijkstra on the room graph | 0.5 ms |
| LV12 | **Budget and quotas:** placed FE within ±10% of E; kit, Clearance and ambient placement rules (§7.4) | Counting | 0.1 ms |
| LV13 | **Module checks** (V Table B): `moving_partitions` reachability in every compactor state (≤ 8 states at launch); `tide_cycle` high-ground share; `hourly_demonstration` and `alarm_network` crossing windows ≥ 3 turns; `heist_plinths` substitute within 6 tiles | Per module | 0.1–3 ms |
| LV14 | **Identity and consistency:** the programme's identity checks (§13.2); room numbers unique; the plan matches the rooms; every balcony has ≥ 2 stairs | Metrics | (in analysis) |

### 9.2 The worst-case runner

After Liapis et al.'s feasibility constraint, "worst-case baseline survival (every monster at maximum damage)" (PL F12). The question it answers is narrow: *is there a route through this layout that is not a death trap?* It is not a balance target; S3 does balance.
- **Kit:** the median build at this position (CS §8.7) minus one Certificate (−5 HP) and minus one Restoration level on the weapon. No consumables, no perks, no stealth, lantern on.
- **Enemies:** every hostile spawn at the maximum of its damage dice at this position (from `balance.stats`), always hitting; telegraphed specials land once per encounter at their printed damage.
- **Waking:** the runner wakes everything whose wake region its route enters: `prox(r)` by walk distance with line of sight; `noise(n)` if within 6 walk tiles of the route; `path` on entering the gallery; `period`, `clock(2)` and `awake` always. `take` and `touch_case` never fire, because the runner takes nothing.
- **Engagement:** a woken enemy fights until killed. Damage taken = (turns for the runner to kill it at minimum damage + approach turns) × its maximum damage per turn. Approach is 0 for melee and up to 3 turns for ranged when cover is within reach, else its distance.
- **Route:** Dijkstra over the room graph from the Intro to the coda, excluding the Masterpiece hall, locked rooms and staff doors. A room's cost is the summed worst-case damage of enemies whose wake regions intersect its walkways; an enemy whose region spans rooms is charged once, to the first room on the route that wakes it.
- **Pass:** the cheapest route costs ≤ 80% of the runner's HP.
- **On failure:** move the costliest enemy on the cheapest route into an adjacent alcove or off the walkway, or shrink its wake radius by one step, then retest (≤ 2 tries); otherwise remove it and log a balancer warning. S3's G2 (P §3.6) catches departments where this happens often.

---

## 10. L8: repair, reseed, fallback

### 10.1 Local fixes

At most 6 per attempt, in check order. Each logs `{check, op, room}`.

| Failing check | Fix |
|---|---|
| LV1 unreachable room | Open the shared wall to its nearest reachable neighbour (door, or archway in formal programmes) |
| LV2 lock order | Move the ticket to a desk in a room of lower tour rank |
| LV3 hall is a cut vertex | Open a coda-to-band or coda-to-central archway |
| LV4 Intro not on a cycle | Open the Intro to an adjacent unlinked room; else link its branch neighbour onward (prototype repair; never needed after the rotunda's SW rule) |
| LV6 safe zone | Move the spawn to the next eligible tile at walk ≥ 9 in the same room, else the next room on the tour |
| LV7 unrewarded dead end | Add an ambient item and a lure, or fill an empty corridor |
| LV8 arena loop | Delete the offending free-standing fixture or attach it to the wall |
| LV9 vista | Delete the blocking fixture on the line; if a wall blocks, move the plinth along the hall's axis |
| LV10 blocked gate or case | Delete the fixture; move its contents to the nearest free case in the room |
| LV11 runner | §9.2 |
| LV12 budget | Re-spend the gallery's share once |
| LV13, LV14 | Not fixable locally: reseed |

### 10.2 Reseed

Up to 4 more attempts. Attempt k uses the namespace `layout/deptKey/a{k}`, so every stage draws fresh numbers and nothing from the failed attempt leaks into the next. In the prototype, 0 of 3,600 layouts needed a second attempt after the fixes of §0.2. Before them, the rotunda needed retries in about 6% of seeds and the quadrangle programmes in 18–36% (retries per layout, 600 layouts each).

### 10.3 Certified fallback

- **Library:** 4 templates per programme × size class (72 in all). Each is a fixed slot plan (rooms and openings) with role slots. L4–L7 still run on it with the run's streams, so its furniture and contents vary.
- **Certification, offline:** every template passes LV1–LV14 for every module the programme allows (V §6.4), at every position, on 1,000 seeds.
- **Testing the validator:** following Cooper & Bazzaz (ML F16), CI also generates deliberately broken variants (a removed opening, a lock with its key behind it, a column ring in a hub arena) and asserts that the validator rejects each.

### 10.4 Logging and thresholds

- Every layout carries `log = {attempts: [{failed, fixes}], fallback, ms}`. A run's replay (TA §3.2) therefore explains any odd layout.
- **Telemetry:** one counter per (department, check, outcome).
- **CI contract** for each department, over 1,000 seeds × positions 1, 4, 8:
  - fallback rate ≤ 0.5%;
  - no single check fails more than 2% of first attempts;
  - p95 generation time within budget.

  A rising fallback rate is a generator bug, not bad luck (PL §6.i). This is D's "validator fallback rate" metric.

---

## 11. The Intro gallery as a tutorial

### 11.1 Structure

- **Entrance vestibule:** 5×5 to 7×5, or the first 4–5 tiles of the Intro behind a screen line with a 3-wide gap. It holds the entrance door, the orientation board (§15.1), a bench and the coat rail, and it is the safe zone.
- **Intro gallery:** a template from the **orientation pool** for the department's signature module, stamped (with rotation and mirroring where allowed) in the Intro room. The rest of the room is ordinary floor that curation furnishes lightly.
- **Distance:** ≥ 12 walk tiles from the entrance to the Intro's onward openings, so the teaching instance can stand at 9–14 (D §3.6). Embedders reserve this depth: quadrangle Intros become 9–11 wide (the prototype's 6–8 is too shallow), enfilade and rotunda Intros keep their width and gain a vestibule room. This is about +40–60 floor tiles per department, not yet in the measured numbers.
- **Content limit:** one mechanic (the signature module at its weakest setting), at most 3 hostiles, orientation-pool roles only (fodder and skirmishers, plus one telegraphed controller if the mechanic is a status, D §3.6), no ambushers, packs of at most 2.

### 11.2 Required, not merely possible

Khalifa et al.'s comparison (PL F18) showed that letting a mechanic fire guarantees it is *possible*, not *required*, and recommended limited agents: the full agent must succeed, and an agent without the mechanic must fail. ACCESSION applies this in two layers:

**At runtime (cheap, structural).** Each template declares 1–3 invariants from a closed set of predicates, checked after stamping (LV4):

| Predicate | Meaning | Check |
|---|---|---|
| `cut(Z)` | Every walk from the entrance to an onward opening crosses zone Z (where the mechanic acts) | BFS with Z removed fails to reach the onward openings |
| `near(A, k)` | Every such walk passes within k tiles of actor A | BFS with A's k-ball removed fails |
| `seen(A, Z)` | Actor A is visible from every tile of Z | LOS per tile |
| `refuge(S, Z)` | A refuge set S (raised walkway, lit tile, alcove) is adjacent to Z and outside the mechanic's reach | Tile tests |
| `window(T)` | The mechanic's timing leaves a safe window of ≥ T turns at the cut | Arithmetic on module parameters |

**Offline (simulation, the real certification).** Per template × programme × 3 positions × 50 seeds, with the persona harness:
- the aware Cautious novice passes the Intro in ≥ 95% (V §6.1 V3);
- the mechanic-blind variant is punished by the mechanic in ≥ 80% (D §3.6);
- the blind variant fails the gallery (death, capture or forced retreat) in ≥ 30% (V3);
- the Cautious novice survives in ≥ 99% (D §3.6).

Templates that miss a threshold leave the pool. Each module needs ≥ 2 certified templates before it ships.

### 11.3 Examples

**`tide_cycle`**, after V §6.5: a sunken floor between two raised walkways, a tide gauge, one dormant plodder that cannot swim. Invariants: `cut(low floor)`, `refuge(walkway, low floor)`, `window(3)` with the first rise at turn 8. The blind runner crosses at turn 9 and is caught by the deep stage.

**`hourly_demonstration`** (variant B, used in §3.5): one automaton on a track whose sweep crosses the only path to the onward opening, with its schedule printed on the label.
```
###########
E.........#      vestibule (safe zone): orientation board, bench
#....b....#
#.........#
####,,,####
#.........#
#....l....#      l: lectern with the schedule ("every 8 turns; a bell 2 turns ahead")
#.........#      refuge row: outside the sweep
#=========#      =: the automaton's track, wall to wall: zone Z
#====D====#      D: demonstrator, period 8 (weakest setting); its sweep covers both track rows
#.........#
#....,....#      onward opening, about 12 walk tiles from E; D stands at about 9
###########
```
Invariants: `cut(Z)`, `window(3)`, `refuge(row above the track, Z)`. The aware bot waits on the refuge row for the bell; the blind bot walks into the sweep.

**`alarm_network`:** one guard on a 3-post loop across the Intro and an alarmed rope line. Invariants: `cut(guard sight over one period)`, `window(3)`, and a curtain inside the room as the refuge.

---

## 12. RNG substreams

### 12.1 Streams

Derivation as TA §3.2: hash the path string, seed a small generator (mulberry32 in the prototype), integers only. `deptKey = accession@layoutPin`, not the content digest, so a text or palette edit in S4–S6 never changes a layout; a layout code change bumps `pins.layout` and does.

| Stream | Used by |
|---|---|
| `layout/deptKey/a{k}/graph` | L1 |
| `…/knobs` | Preset choice and jitter (§13.4) |
| `…/embed`, `…/embed/mirror` | L2 geometry; the transform's mirror bit |
| `…/openings` | `addLoops` order, opening offsets |
| `…/aspace`, `…/locks`, `…/staff` | L3 passes |
| `…/intro` | Template choice and stamping |
| `…/room/<roleKey>/curate` | L4, one per room |
| `…/room/<roleKey>/populate` | L5, one per room |
| `…/patrol` | Guard posts and routes |
| `…/repair/<n>` | Local fixes |
| `cosmetic/deptKey/<roleKey>` | Floor patterns, wall hangings, wear, frame styles, idle-animation phases: renderer only, never read by the core |

Gameplay streams owned by others stay separate (`loot`, `ai`, `combat`, `search`, CS §1.1).

### 12.2 Locality

- **Role keys** (`intro`, `s2.g1`, `study.1`, `centre`) come from the narrative graph, not room indices. Adding a gallery to section 3 therefore does not change the furniture of section 1, and editing one bay template changes only rooms that use it.
- **CI locality test:** change one room template; regenerate 100 seeds; assert that every other room's furniture hash is unchanged whenever its geometry is unchanged.
- **Version pin:** the same seed is not the same layout across layout versions (PL pitfall 12). Replays store `pins.layout` and refuse to replay across a layout version change.
- **rot.js:** its map generators use a global RNG (TA F3). The layout code uses none of them; FOV and pathfinding from it are safe.

---

## 13. Metrics

### 13.1 Definitions

Computed on the public walkable region reachable from the entrance with no keys. "Runtime" metrics are computed for every layout in the browser (validation and logging); "offline" ones only in tools.

| Metric | Definition | When | Feeds |
|---|---|---|---|
| Floor | Public walkable tiles | runtime | scale, budget |
| Rooms, μ | Public rooms reached; cyclomatic number of the simple room graph, E − V + 1 | runtime | envelopes, QD |
| Space types a/b/c/d | Room graph with bridges found by removal: a = degree ≤ 1; b = degree ≥ 2 with only bridge edges; c = exactly 2 non-bridge edges; d = ≥ 3 non-bridge edges (Hillier's ring types, ML F4) | runtime | a-space pass, regressions |
| Pillar loops / circuits | Holes in the walkable region (8-connected non-walkable components not touching the border), split by ring size: ≤ 16 adjacent walkable tiles is a pillar loop, more is a circuit (ML §3.3's definition) | runtime | envelopes, §14.1 |
| Choke (Brogue) | Share of tiles whose removal leaves a second-largest component ≥ 4 tiles (iterative Tarjan with subtree sizes) | runtime (gate cells for R6) | reported only: measured p95 ≤ 0.015 everywhere |
| **Gate share** | Bridges / edges of the public room graph: openings whose closure cuts off at least one room | runtime | replaces choke in envelopes and QD |
| **Narrow share** | Share of floor tiles whose horizontal or vertical free run is ≤ 2 | runtime | replaces choke as "corridor fighting" texture |
| Defensible | Share of floor tiles with ≤ 2 walkable 8-neighbours (ML §3.3) | runtime | envelopes |
| Openness | Mean visible fraction of floor within radius 7, sampled on even-coordinate tiles (1 in 4); Bresenham over see-through tiles. Costs about 1.3 ms | offline (runtime only if Decision L-D6 (b)) | QD, regressions |
| Glass ratio | See-through blockers / all interior blockers next to public floor | runtime | envelopes, QD |
| Exit tortuosity | Walk to the nearest exit / Chebyshev distance | runtime | envelopes |
| `L_tour` | Nearest-neighbour tour from the entrance through every gallery's centre tile, then the Masterpiece hall, then the nearest exit (CS §5.1) | runtime | the clock |
| Rooms to Masterpiece | Room-graph distance Intro → hall | runtime | identity checks |
| Integration | Total depth of each room on the room graph (lower = more integrated, integer, ML F1); contrast = mean / min | runtime | patrol posts, identity checks |
| Hub dominance | Max room degree / mean degree | runtime | identity checks |
| Elevation share | Balcony tiles / floor | runtime | grand hall identity |
| Vista | Some Intro tile sees the Masterpiece plinth | runtime | LV9 |
| Dead-end cost | Σ over a-spaces of 2 × walk depth beyond the junction, / `L_tour` (ML §3.5) | runtime | regressions |
| Exposure | Longest run of tour tiles visible to one ranged spawn with no adjacent cover | runtime | §14.2 |
| Density | Cases per 100 floor tiles; bays per gallery | runtime | curation |
| Intelligibility | corr(connectivity, integration) over rooms (Choi via ML F1); floats, so offline only | offline | regressions |
| Hamiltonicity | A cycle through all public rooms exists (backtracking, ≤ 20 rooms) (ML F3) | offline | regressions |
| Visual integration | Visibility-graph integration on a 2× downsampled grid (Turner et al. via ML F6) | offline | research |

### 13.2 Envelopes: identity checks and expected ranges

There are two kinds, because rejecting layouts on a dozen ranges would turn every tail of every metric into a reseed.

**Identity checks** are hard (LV14). Each is a property without which the programme is not itself:

| Programme | Identity checks |
|---|---|
| Enfilade | vista; rooms to Masterpiece ≥ 3; glass 0.40–0.85 |
| Rotunda | vista; hub degree ≥ 3; hub has the lowest total depth; rooms to Masterpiece ≤ 3 |
| Grand hall | vista; elevation share 0.03–0.22; each balcony ≥ 2 stairs and ≤ 12 tiles from any balcony tile to a stair; glass ≥ 0.75 |
| Case labyrinth | vista through glass; glass ≥ 0.75; narrow ≥ 0.15; crossing ratio ≥ `tortMin` |
| Storage stacks | glass ≤ 0.45; openness ≤ 0.75 (offline) or narrow ≥ 0.07 (runtime); defensible ≥ 0.04 |
| Sculpture court | vista; pillar loops ≥ 8 |

**Expected ranges** (p5–p95, prototype, all sizes pooled, 600 layouts per programme) are for drift detection in CI (§13.5), not for rejecting layouts:

| Metric | Enfilade | Rotunda | Grand hall | Case labyrinth | Storage stacks | Sculpture court |
|---|---|---|---|---|---|---|
| Pillar loops | 2–11 | 4–11 | 4–19 | 4–13 | 4–21 | **11–48** |
| Circuits | 1–4 | 2–4 | 2–8 | 1–6 | **3–13** | 1–5 |
| Gate share | 0–0.14 | 0–0.30 | 0.13–0.50 | 0.14–0.50 | 0.13–0.50 | 0.14–0.50 |
| Narrow | 0.03–0.09 | 0.04–0.09 | 0.06–0.18 | **0.17–0.28** | **0.10–0.28** | 0.06–0.16 |
| Defensible | 0.02–0.05 | 0.02–0.05 | 0.02–0.06 | 0.02–0.05 | **0.06–0.17** | 0.03–0.12 |
| Openness | 0.72–0.80 | 0.74–0.82 | 0.72–0.82 | 0.67–0.80 | **0.59–0.72** | 0.65–0.79 |
| Glass | 0.53–0.76 | 0.61–0.81 | **0.83–0.92** | **0.81–0.92** | **0.13–0.33** | 0.37–0.79 |
| Exit tortuosity | 1.00–1.06 | 1.00–1.19 | 1.08–1.41 | **1.08–1.81** | 1.11–1.42 | 1.08–1.37 |
| Elevation | 0 | 0 | **0.04–0.17** | 0 | 0 | 0 |
| a-share | 0–0.18 | 0–0.25 | 0.17–0.43 | 0.20–0.50 | 0.17–0.50 | 0.20–0.43 |
| Rooms to Masterpiece | **3–5** | **1–3** | 2–3 | 2–3 | 2–3 | 2–3 |
| Hub dominance | 1.00–1.78 | 1.29–1.80 | 1.25–2.92 | 1.25–2.92 | 1.25–2.92 | 1.25–2.92 |

Bold marks where a programme separates from the others. Three observations:
1. The quadrangle programmes are identical on every room-graph statistic and separate only on tile texture.
2. Openness at radius 7 is compressed (0.59–0.82 across all six). It may not survive the regressions.
3. Brogue chokepoints are absent everywhere, which is why gate share and narrow share replace them.

**How the real envelopes are set.** These numbers describe the prototype, so they are circular. The procedure for the shipped generator:
1. Run 1,000 seeds per programme × size at the first layout pin.
2. Freeze p1–p99, widened by 10%, as the expected ranges.
3. Set the identity checks by intent, verifying that each rejects < 1% of first attempts.
4. Tighten or drop after the persona regressions.

### 13.3 Persona regressions

- **Data:** S3 already runs the persona roster (V §1.1: Tourist, Vandal, Looter, Completist, Cautious, Sneak; novice, median, expert) on many layout seeds per department (P §3.6, D §8). Each playthrough logs the layout's metric vector next to its outcomes: death, HP at exit, turns, detections, kits collected, route.
- **Method:** per persona × outcome, Spearman ρ with bootstrap 95% intervals, then a regression with programme, size and department fixed effects so that metrics are not proxies for programme. Benjamini–Hochberg over the whole family of tests, since there are about 20 metrics × 6 personas × 5 outcomes.
- **Pruning:** a metric with |ρ| < 0.1 on every outcome is dropped from envelopes and QD. PCG book ch. 12 advises metrics "as far as possible from the input parameters" (PL F24); knobs are inputs and metrics are measured, so the regressions are not confirmatory.

**Hypotheses** (none established; ML §3.5 lists the first three):

| # | Hypothesis |
|---|---|
| H1 | Circuits and μ raise Cautious survival and lower Night Watch captures |
| H2 | Glass ratio raises the share of damage taken from range |
| H3 | Narrow share lowers damage from swarms (chokes help against numbers) |
| H4 | Lower intelligibility and higher exit tortuosity raise Tourist turns |
| H5 | a-share raises Looter and Completist turns and their clock pressure |
| H6 | Pillar loops lengthen melee fights against same-speed pursuers before the First Bell, and stop mattering after it (the clock counter, §14.1) |
| H7 | Elevation share raises damage from range on the hall floor |

A confirmed hypothesis becomes a design lever: the challenge-type bias lines in §4 move exactly these metrics.

### 13.4 MAP-Elites over programme knobs

The archive holds **generators, not levels** (PL F20): each elite is a knob vector scored over a batch of seeds. It complements P §4.1's archive of whole departments, which uses programme as one of its axes.

- **Genome:** the programme's knob vector (§4), integer-coded within its ranges, plus `loopD` (12–28). Size class is not in the genome; each size has its own archive.
- **Mutation:** one or two knobs move by ±1 step (±10% of range for continuous ones); a categorical knob flips with probability 0.2. No crossover. The parent is drawn from the elites 70% of the time and from the seed presets otherwise, exactly as `consider()` and `step()` do in `scriptprof/js/evolve.js`.
- **Axes** (lean, Decision L-D6): two 8×8 maps per programme:
  - *route structure*: μ (0–7) × a-share (0–0.6);
  - *museal texture*: glass (0–1) × narrow (0–0.35).

  A cross-programme map on glass × narrow checks that programmes occupy different regions (ML §3.5).
- **Feasibility** (constrained MAP-Elites with feasible and infeasible populations per cell, Khalifa et al. 2018 via PL F17):
  - LV1–LV14 pass on ≥ 95% of 20 seeds × 3 positions with no fallback;
  - the identity checks hold;
  - p95 generation time ≤ 25 ms.
- **Fitness**, in two tiers:
  1. *Structural*, for every candidate: mean over seeds of (route choices per 100 tour tiles, counting c and d rooms visited) − dead-end cost − 0.5 × (fraction of seeds needing a repair).
  2. *Persona*, for cell elites only: route divergence between personas + skill differentiation (expert − novice survival) − cross-seed variance of the median persona's death rate (PL §6.iii, D §8).
- **Cost:** a candidate costs 60 generations × ~10 ms ≈ 0.6 s. 5,000 candidates per programme × size ≈ 50 core-minutes; 18 archives ≈ 15 core-hours, an overnight job. Persona fitness adds about 2 core-minutes per elite.
- **Output:** each filled cell's elite becomes a **knob preset** (`presets[programme][size] = [{id, knobs, cell, fitness}]`, 20–60 per archive). Runtime chooses a preset weighted by the department's challenge bias (§4), then jitters each knob by ±1 step with the knobs stream. The curator may pin preset ids per department in S6 (P §3.9).

```js
// scriptprof-style loop, one archive per (programme, size)
function illuminate(prog, size, budget) {
  const archive = {};                                     // cellKey -> { knobs, fitness, feasible }
  const infeasible = {};                                  // cellKey -> best near-miss (FI-2pop)
  for (const k of prog.seedPresets(size)) consider(k);
  for (let i = 0; i < budget; i++) {
    const elites = Object.values(archive).map(e => e.knobs);
    const parent = elites.length && rng.chance(0.7) ? rng.pick(elites) : rng.pick(prog.seedPresets(size));
    consider(mutate(parent, prog.knobRanges(size)));
  }
  return archive;

  function consider(knobs) {
    const runs = seeds(20).flatMap(s => [1, 4, 8].map(pos => generateWith(prog, size, knobs, s, pos)));
    const feasible = runs.filter(r => r.ok && !r.fallback).length >= 0.95 * runs.length
                  && runs.every(r => identityOK(prog, r.metrics)) && p95(runs.map(r => r.ms)) <= 25;
    const cell = cellKey(median(runs.map(r => r.metrics.mu)), median(runs.map(r => r.metrics.aShare)));
    const fit = structuralFitness(runs);
    const pool = feasible ? archive : infeasible;
    if (!pool[cell] || fit > pool[cell].fitness) pool[cell] = { knobs, fitness: fit, feasible };
  }
}
```

### 13.5 Expressive range in CI

- **Data:** per programme × size, 1,000 seeds at positions 1, 4 and 8. That is 3,000 layouts × ~10 ms ≈ 30 s per programme, 3 minutes for all six.
- **Plots** (Smith & Whitehead's expressive range, PL F24), written as an HTML report artifact: glass × narrow; μ × a-share; `L_tour` × dead-end cost; pillar loops × defensible. One panel per programme, plus a cross-programme overlay.
- **CI fails** when:
  - the binned histogram (10×10) of any panel moves by total-variation distance > 0.15 from the stored baseline without a `pins.layout` bump;
  - a programme's centroid enters another programme's 1-σ ellipse on (glass, narrow, defensible, pillar loops), i.e. programme collapse;
  - the fallback-rate or timing contracts of §10.4 break.

  This matches P §9.1's per-department expressive range; the layout's version is per programme and pin.

---

## 14. Tactical issues

### 14.1 Pillar dancing

The counter is the closing-time clock (ML D6 (c), CS §5.6): slow regeneration, pips that stop decaying at the First Bell, Watchmen who path to your actual position. D's M4 removes pillar loops from Masterpiece arenas, where the clock pauses. The layout adds four things:
1. **Arena rule** (§6.3, LV8).
2. **Dance sites exported to the AI.** `L.danceSites` lists every hole with ring ≤ 16 and its ring tiles. A hunter that fails to close distance for 6 turns while circling a known site reverses direction; with two hunters, the second takes the other way. This is cheap, because the sites are computed anyway.
3. **Pillars that bite.** In the sculpture court the statues are the `unobserved_mover` habitat (§7.3), so the pillar-dancing machine is also where things move when you look away.
4. **Caps by programme.** Pillar loops above the expected range trigger a CI warning. Only the court is meant to be full of them (p95 48).

If the regressions do not confirm H6 (fights stop being prolonged by pillars after the First Bell), Julian's fallback is ML D6 (b): a few fast or vaulting archetypes in pillar-heavy programmes.

### 14.2 Glass sightlines and ranged threat

Glass gives ranged enemies sight across the whole map unless something limits it (ML pitfall 2).
1. **Projectiles:** bolts and arrows stop at a vitrine and crack it; beams pass glass; lobs arc over glass (V §7.1). Glass is therefore cover against archers but not against axis snipers.
2. **Exposure cap** (LV11 adjunct): for every ranged spawn, the longest run of consecutive tour tiles it can see within its range, counting only tiles with no opaque blocker adjacent, is ≤ 6 (≤ 9 when the primary type is `artillery`). Repair moves the spawn or adds a screen.
3. **Lux:** glass-heavy programmes default to Low lux, and enemies see you on Low tiles from 6 (CS §3.6), so a 10-tile glass axis is a 6-tile threat unless lit.
4. **Axis snipers:** an axis is never longer than the sniper's range 10 without a cover niche (a doorway jamb, a screen, a column pair off the axis) at least every 5 tiles. The vista rule (R7) only forbids opaque fixtures on the one entrance-to-Masterpiece line, so niches beside the axis remain legal.
5. **Every combat room has a sight blocker** (T1).

### 14.3 Readable verticality

There is one elevation level (balconies, height 1), plus `tide_cycle`'s low floors.
- **Drawing:** balcony floor a step lighter in the palette ramp; a 1-px parapet highlight on the balustrade's balcony edge and a 2-px drop shadow on the floor side; stairs as three steps with an up-arrow glyph; elevated side galleries share the balcony tint.
- **Text:** the examine panel names the tile "Balcony (upper level)".
- **Rules** (CS §4): +10 to hit and +2 range from a balcony; −10 to hit at it; no melee across a balustrade; thrown items drop to the floor below.
- **Layout constraints:** balcony depth ≥ 2 so actors can pass; ≥ 2 stairs per balcony; no balcony tile more than 12 walk tiles from a stair; a free landing strip under the balustrade (R8); stairs ≥ 1 tile from any door; balcony length ≤ 30.

### 14.4 Furniture soft-locks and the diegetic rescue

| Source | Prevention |
|---|---|
| A pushed crate wedged in a 1-wide aisle | The push rule refuses a push that leaves no exit reachable from the player (one BFS, ~0.1 ms): "The crate won't go any further." Crates never start on gate cells (R6) |
| Compactor shelving (`moving_partitions`) | LV13 checks reachability in every compactor state; cranks are reachable from both sides |
| A "Gallery closed" sign placed by the player | The player can always pick it up again (1 turn) |
| A pilferer steals the ticket | Tickets are quest items: dropped at the staff door it flees to, never destroyed |
| Flooding (`tide_cycle`) | Temporary by design; `window(T)` and the high-ground rule apply |
| A sealed Masterpiece hall | By design; the Re-admission Ticket (CS §5.4) |
| A broken vitrine | Only ever opens space (CS §4.1) |
| A locked staff door | Staff routes are never required (LV5) |

**The rescue.** If a dynamic check ever finds no exit reachable from the player (a bug, or an unforeseen interaction), or the player asks:
- **"Ask a guard":** any neutral guard, or a *staff telephone* (a wall panel at the vestibule and at each staff corridor junction: "Call the Night Desk"; a guard arrives in 10 turns).
- The guard walks you, as an escort, to the nearest tile from which an exit is reachable, opening locks along the way from the stored lock records (`locks[].rescue`): Unexplored's "Pray For Help" (ML F13), with a keyring instead of a prayer.
- **Cost:** +20 clock turns, as for a CS §3.7 escort, but no confiscation.
- **Abuse:** it delivers you to the nearest point that restores reachability, never to the exit, so it is no shortcut.
- After the Night Watch begins the staff telephone still works; the guard is a Watchman, and the escort becomes the CS §5.3 escort to the exit doors.

---

## 15. Floor plans

### 15.1 The orientation board

ML D9 (c), a partial plan. A wall panel in the vestibule, read for free like any label (CS §1.3). Once read, its outlines are copied into the player's map (CS §13.5 draws unseen rooms as outlines only after a plan has been read; this board counts as one).

**Shows:**
- the main tour's galleries as outlines with their numbers;
- section titles over their rooms;
- the Masterpiece room with its name;
- the coda with the kiosk icon;
- the exit doors with their placard icons;
- the Loan Desk;
- "You are here".

**Omits:** studies, the staff layer and hidden rooms (their numbers are simply absent), and the ticketed room's interior, drawn as a closed block labelled "Special display, ticket holders only. Tickets at Room 4nn".

Drawn north-up with a compass rose. The "Highlights of this collection" box (CS §8.6) sits beside it.

Example for the enfilade sketch in §4.1, as department 4. Tour order numbers the rooms: Intro 401, north row 402–403, the cabinet 404, south row 405 (east) and 406 (west), the Masterpiece hall 407, the coda 408.
```
 INSTRUMENTS THAT KEEP TIME BADLY             Rooms 401-408           N ^
 +--------+---------+---------+------------+
 |        |   402   |   403   |    407     |   [*] Masterpiece: The Committee of
 |  401   |  I. Escapements   |  The Com-  |       Clocks, Room 407
 | (you)  +---------+---------+  mittee *  |   [K] Kiosk, Room 408
 |        |   406   |   405   +------------+   [X] Exits: two doors, Room 408
 |        | II. Faulty Repairs|  408  K  X |
 +--------+---------+---------+------------+
```
Room 404 (the cabinet above 403) is not on the board, so the numbering jumps from 403 to 405. That is consistent with CS's convention that gaps hide things; here the thing is a study, not a secret.

### 15.2 The Floor Plan consumable

V §5.4 `floor_plan`, reveal M: every public room's outline and number, plus the rooms of the Highlights still unfound (CS §8.6). Its forgery, "superseded", reveals S: only the rooms within 2 room-steps of where it is read, stamped SUPERSEDED. The kiosk's Postcard (CS §11) is reveal XS: the current room.

### 15.3 Staff plans as items

- **What:** a "Back-of-house plan, for the night staff". A document, not a consumable, kept for the rest of the department.
- **Where:** in the staff office when the layer has one; otherwise carried in a staff-store case; never a Highlight.
- **Shows:** reveal L: the staff layer, staff doors with their Clearance numbers, hidden panels, guard patrol posts and routes, and the ticketed room's interior.
- **Why it matters:** it turns the `two_routes` cycle into an informed choice and makes the guarded challenge type readable. Under `fading_map` (Memory, later), staff plans are the only plans that do not fade.

---

## 16. Seam rooms and the Exit

### 16.1 Stair Halls

D §1.5 sets the rules: about 16×12, authored with seeded dressing; no clock, no enemies, no regeneration; services café, kiosk, Conservator, Registrar and Directory; plus, on floor 1, the Lost Property window (M §10.2).

**Layout.**
- **Templates:** 3 per floor, each a fixed geometry.
- **Arrival:** the arrival door on the south wall leads from the floor's last department.
- **Stair and landing:** a central grand stair, 2–3 tiles wide, rises to a landing (elevated, a balcony strip) on the north wall carrying row 1 of the next floor's doors (3 placards, D §2.2).
- **Alcoves:** five or six service alcoves round the sides.
- **Variation:** the stream `stairhall/<floor>` shuffles which alcove holds which service, chooses the dressing (a plaster cast, a building model, a donor wall, M §10.3) and sets the palette to the coming floor's.
- **Signage:** the coming floor's room ranges (P §5.3).
- **Validation:** LV1 only.
- **Purpose:** the seam keeps the museum continuous whatever the order of departments (ML §3.6).

```
################
#X####X####X####   onward doors: row 1 of the next floor, off the landing
#::::::::::::::#   landing (upper level)
#~~~~^^^^^^~~~~#   balustrade; ^ the grand stair (2 rows)
#c...^^^^^^...K#   c café; K kiosk
#..............#
#C............R#   C Conservator; R Registrar
#D............L#   D Directory board; L Lost Property window (floor 1)
#......b.......#   b bench
#######E########   arrival from the floor's last department
```

### 16.2 The Exit

D §1.6 places the Exit at depth 9 after Stair Hall 3: the Main Hall (a grand hall with mezzanine, about 30×20), the Information Desk and the Registrar's desk, the revolving doors, and the Gift Shop as a one-way coda.

**Layout.**
- **Embedder:** the grand-hall embedder with a pinned `exit` preset: both balconies, 3 stairs each, axis 26 long.
- **Entrance and arena:** the entrance from Stair Hall 3 at the west end of the axis. The Registrar's desk on a dais at the east end; the arena is the hall's east third, a 15×11 clear floor under M4.
- **Recall pedestals:** 4–6 empty plinths along the axis and the balconies, where the recalled exhibits (D §1.6) appear dormant: "Returned from loan".
- **Doors and shop:** the revolving doors in the east wall behind the dais, cycling in phase 2 (D). Beyond them, the Gift Shop is a one-way corridor of kiosks ending at the street door, the run's last spend and end. D owns the order; the layout supports either order with a turnstile.
- **Optional:** a *Recent Acquisitions* case run along the axis showing this run's accession slips (M §4), if the meta section wants the run summarised in the room.
- **Validation:** LV1, LV3 (the doors are reachable without defeating the Registrar), LV8 for the arena; seeded variation in the dressing only.

```
##########################################
#::::::::::::::::::::::::::::::::::::#####
#^~~~~~~~~~~~~~~~~~^~~~~~~~~~~~~~~~^~#####   balconies: recall pedestals p
#..p.....v...v...v...v...v..p........#####
#.......................................=#   revolving doors (cycling) = ; Gift Shop beyond
E...l...........................R.......=#   l Information Desk; R Registrar's dais
#.......................................=#
#..p.....v...v...v...v...v..p........#####   v Recent Acquisitions cases (optional)
#^~~~~~~~~~~~~~~~~~^~~~~~~~~~~~~~~~^~#####
#::::::::::::::::::::::::::::::::::::#####
##########################################
```

---

## 17. Scale

### 17.1 Measured footprints

Prototype, 200 seeds per cell; size classes as D §1.4. The vestibule (+40–60 floor tiles, §11.1) is not included.

| Programme | Size | W×H p50 | Floor p5 / p50 / p95 | Rooms p50 (p5–p95) | `L_tour` p50 (p5–p95) | Entrance → exit p50 |
|---|---|---|---|---|---|---|
| Enfilade | Cabinet | 37×19 | 374 / 435 / 502 | 6 (6–6) | 59 (49–76) | 37 |
| | Department | 44×23 | 464 / 562 / 652 | 8 (7–9) | 84 (63–104) | 43 |
| | Wing | 48×26 | 571 / 732 / 935 | 11 (9–13) | 119 (93–148) | 47 |
| Rotunda | Cabinet | 33×30 | 414 / 512 / 598 | 7 (6–7) | 77 (56–99) | 27 |
| | Department | 35×31 | 498 / 650 / 834 | 8 (6–9) | 94 (66–134) | 30 |
| | Wing | 37×33 | 610 / 804 / 998 | 9 (8–10) | 115 (87–153) | 30 |
| Grand hall | Cabinet | 36×22 | 455 / 523 / 601 | 5 (5–5) | 70 (60–78) | 28 |
| | Department | 39×27 | 559 / 705 / 897 | 7 (6–9) | 103 (78–176) | 35 |
| | Wing | 42×32 | 798 / 912 / 1068 | 10 (10–10) | 177 (142–224) | 36 |
| Case labyrinth | Cabinet | 34×20 | 406 / 455 / 514 | 5 (5–5) | 66 (55–83) | 25 |
| | Department | 37×25 | 436 / 582 / 751 | 6 (6–9) | 104 (76–173) | 35 |
| | Wing | 40×30 | 624 / 723 / 865 | 10 (10–10) | 166 (126–220) | 37 |
| Storage stacks | Cabinet | 37×23 | 438 / 502 / 567 | 5 (5–5) | 70 (59–78) | 29 |
| | Department | 39×27 | 497 / 628 / 829 | 6 (6–9) | 97 (76–184) | 35 |
| | Wing | 43×32 | 688 / 815 / 951 | 10 (10–10) | 169 (137–223) | 38 |
| Sculpture court | Cabinet | 36×22 | 457 / 532 / 617 | 5 (5–5) | 70 (59–78) | 28 |
| | Department | 40×27 | 566 / 719 / 904 | 7 (6–9) | 108 (78–172) | 34 |
| | Wing | 43×33 | 811 / 922 / 1085 | 10 (10–10) | 171 (136–215) | 36 |

Room counts sit close to D's targets (5–6, 7–8, 9–10). The prototype's quadrangle Departments run one room short, which the knobs can fix.

### 17.2 Expected turns per department

These are **estimates**, not measurements, from simple models to be replaced by persona data:
- Tourist ≈ 1.3 × (entrance → exit) + 15;
- median ≈ 1.3 × `L_tour` + 20 per room (fights, cases, rests);
- Completist ≈ 1.6 × `L_tour` + 30 per room.

B is CS §5.1's open hours, `round10(2.5 × L_tour + 100)`.

| Programme | Size | Tourist | Median | Completist | B (First Bell) |
|---|---|---|---|---|---|
| Enfilade | Cab / Dept / Wing | 63 / 71 / 76 | 197 / 269 / 375 | 274 / 374 / 520 | 250 / 310 / 400 |
| Rotunda | | 50 / 54 / 54 | 240 / 282 / 330 | 333 / 390 / 454 | 290 / 340 / 390 |
| Grand hall | | 51 / 61 / 62 | 191 / 274 / 430 | 262 / 375 / 583 | 280 / 360 / 540 |
| Case labyrinth | | 48 / 61 / 63 | 186 / 255 / 416 | 256 / 346 / 566 | 270 / 360 / 520 |
| Storage stacks | | 53 / 61 / 64 | 191 / 246 / 420 | 262 / 335 / 570 | 280 / 340 / 520 |
| Sculpture court | | 51 / 59 / 62 | 191 / 280 / 422 | 262 / 383 / 574 | 280 / 370 / 530 |

**What this means.**
- CS and D sized the clock and the run's minutes on `L_tour` of 150, 220 and 280 (B = 480, 650, 800) at 80 turns per minute.
- The measured `L_tour` is about 40% lower: p50 59–77, 84–108 and 115–177.
- CS's formula still behaves sensibly on the measured layouts: the median finishes before the First Bell, and the Completist reaches it and finishes inside Lights Down (B + G, G ≥ 60) in most cells.
- But the absolute numbers fall: a median Department is about 250–280 turns. At 80 turns per minute that is 3–3.5 minutes, and an 8-department run, with Stair Halls and the Exit, would last about 40–45 minutes, not 70–90.
- Either players take about 35–40 turns per minute (fights, reading and decisions are slower than walking: plausible but unmeasured), or departments must grow. That is Decision L-D1.

---

## 18. Decisions for Julian

**L-D1. Department scale against the clock and the run length.**

| Option | Tradeoff |
|---|---|
| (a) **Keep the measured sizes** (Department ~40×27, `L_tour` ~100); re-base CS's B table on measured `L_tour`; measure turns per minute in the first playable and set the run's department count from it | Smallest maps, best phone readability, cheapest generation; the 70–90 minute run depends on an unmeasured turn rate |
| (b) Grow every class until `L_tour` matches CS's 150 / 220 / 280, roughly 1.5–2× in linear size (a Department of about 60×40) | Keeps the current time budget; maps exceed the 48×36 cap, phone scrolling at least doubles, generation time roughly triples |
| (c) Keep sizes but raise density (more encounters and cases per room) | Keeps maps small; risks clutter and "museum fatigue" (ML D10) |

*Lean: (a).* Dormans: "it is so much more interesting to generate small levels" (ML F13), and SPD's floors are small (ML F8). If Julian picks (b), the 48×36 cap goes, the knob ranges in §4 scale by 1.5–2, and the measured envelopes must be re-run.

**L-D2. What a chokepoint is.**

| Option | Tradeoff |
|---|---|
| (a) **2-wide aisles and 3-wide archways by default, plus the choke supply of 1-wide doors per section** (§6.4) | Museum-like proportions; doorway fights exist but are placed, not everywhere |
| (b) Brogue-like: 1-wide doors and aisles throughout | Classic corridor tactics and a measurable choke metric; plans read as dungeons, not galleries |
| (c) (a), plus 1-wide aisles in the labyrinth and stacks for `swarm` departments | Chokes where the challenge type wants them |

*Lean: (a) with (c)'s switch.* If Julian picks (b), the formal programmes lose most archways and the vista tolerances, and V's `choke` tag is satisfied everywhere without the supply rule.

**L-D3. Macro variety in the four quadrangle programmes.**

| Option | Tradeoff |
|---|---|
| (a) **One scaffold with variants:** access (`axis` or `window`), band styles (§4.9), the dihedral transform | Cheap; the four differ strongly in texture but share route structure (§13.2) |
| (b) A bespoke macro embedder per programme | Most distinct; about four more embedders to write, certify and calibrate |
| (c) Keep (a), but replace one quadrangle programme at launch with a different macro: the courtyard quadrangle proper, or the period-room suite | One more distinct shape at the cost of one more embedder |

*Lean: (a) for the vertical slice, revisit after the first playtest with (c).* The test is whether players describe the four as different places to fight in or as the same building with different furniture. If Julian picks (b), the layout schedule grows by roughly the cost of the enfilade and rotunda embedders combined.

**L-D4. When layouts are generated.**

| Option | Tradeoff |
|---|---|
| (a) **Prefetch the 2–3 offered departments while the placards are read** | No visible wait even on slow phones; wasted work on unchosen doors (tens of ms) |
| (b) Generate on door choice, behind the door's fade | Simplest; a slow phone may hitch |
| (c) Generate a whole floor at its Stair Hall | Never a wait inside a floor; the door graph must be resolved first, and memory holds 3–9 layouts |

*Lean: (a).* Determinism makes it free of side effects.

**L-D5. Masterpiece access in the quadrangle programmes.**

| Option | Tradeoff |
|---|---|
| (a) Axis only | Simple; Masterpiece always 2 rooms from the Intro |
| (b) Glazed screen only | Deeper (3–4 rooms), more museal; the coda precedes the hall |
| (c) **50/50 by seed** | Variety in route structure, the only room-graph variety the scaffold has |
| (d) By challenge type: screen for `locks_puzzle` and `guarded`, axis otherwise | Ties structure to challenge |

*Lean: (c), moving to (d) if the regressions show depth matters by type.*

**L-D6. The knob archive's axes.**

| Option | Tradeoff |
|---|---|
| (a) **μ × a-share and glass × narrow** | Measured spread inside each programme; far from the knobs |
| (b) ML's openness × loopiness and glass × choke | Literature-standard names, but openness is compressed and choke is zero in these plans |
| (c) Persona-outcome axes (persona dominance) | The most meaningful; costs persona runs for every candidate |

*Lean: (a).* If (b), openness must become a runtime metric (+1.3 ms per layout).

**L-D7. The orientation board.**

| Option | Tradeoff |
|---|---|
| (a) **Partial plan:** tour, sections, Masterpiece, exits | Museal and legible; exploration remains |
| (b) The full public plan | Easiest wayfinding; studies and the deepest-a-space lure lose their surprise |
| (c) None, automap only | Least museal; disorientation becomes a difficulty knob for every department |

*Lean: (a), with staff plans as items (§15.3).* This is ML D9's lean.

---

## 19. Challenges to the frame

1. **"Chokepoints" do not exist in museum plans as Brogue defines them.**
   - The frame and ML's example envelope (case labyrinth: choke 0.15–0.4) assume tile chokepoints.
   - With 3-wide archways and 2-wide aisles, measured choke is ≤ 0.015 at p95 in every programme. V's counter tag `choke` and its `swarm` requirement ("≥ 2 chokepoints per section") would silently fail.
   - I wrote the section under the frame by adding the choke supply rule (§6.4) and replacing the metric (§13.1), but the vocabulary should define `choke` as "a 1-wide opening or aisle", or the plans should become narrower (L-D2).
2. **"Six launch programmes" are three macro shapes.**
   - Enfilade (linear suite), rotunda (radial) and a quadrangle with four fillers.
   - The fillers make strongly different tactical spaces (glass maze, dark stacks, pillar court, balcony hall), and players may never notice the shared skeleton. But the frame's argument for programmes is that they give "tactical character" at every scale, and the measured room graphs are identical.
   - I would rather ship five programmes with five shapes than six with three; L-D3 (c) is the cheap version.
3. **The clock's assumed department size is larger than a 40×30 department.** See §17.2 and L-D1. This is a frame-level number: the frame's "about 40×30" and its "70–90 minutes over 8 departments" are compatible only at about 35–40 turns per minute.
4. **Safe zone versus a simple Intro.** The frame wants the Intro to teach the signature mechanic and an 8-tile safe zone at the entrance (ML §3.4, D §3.6). Both fit only with a vestibule and an Intro deep enough to place the teaching instance at walk 9–14, which costs 40–60 tiles per department (§11.1). Worth it, but not free.
5. **Name clashes.**
   - The frame's "ticketed special exhibition" (inside a department), D's "Special Exhibition" (a kind of department door) and P's "Temporary Exhibitions" (runtime departments) are three different things. I call the first the *ticketed room*.
   - The frame's hierarchy level "wing" (a plan region) and D's size class "Wing" collide. I suggest keeping "wing" in the hierarchy, where the frame put it, and renaming the size class (for example Cabinet / Department / Annexe).
6. **"Exits beyond the centrepiece or opposite the entrance."** With the glazed-screen variant, the coda comes before the hall on the route. I read the rule as "opposite the entrance, and never through the hall" (LV3), which is what D §6.2 needs.

---

## 20. Risks

1. **Phone performance is unmeasured.** The prototype's 11–16 ms p95 is Node on a server-class container; a phone may be 2–4× slower, and the real generator does more (vestibule, templates, lighting, the runner). Mitigation: prefetch (L-D4); openness offline only; a performance test on a mid-range phone in the first week of implementation.
2. **Macro sameness** across the quadrangle programmes (§19.2). Mitigation: L-D3, and the CI separation test (§13.5).
3. **Circular envelopes.** The numbers in §4 and §13.2 describe my prototype. Mitigation: §13.2's procedure; treat the tables as shape, not values.
4. **Metrics that predict nothing.** Openness is compressed; space-syntax correlations in museums are moderate (Choi's average around 0.45–0.7, ML pitfall 6). Mitigation: the regressions prune; metrics are for diversity and placement, never the objective.
5. **Over-connection.** `addLoops` plus band links make d-spaces common (p50 0.29–0.40), less c-dominant than real museums (ML F4). Hub-heavy plans can feel like open arenas. Mitigation: `bandLinks` and `loopD` are in the knob archive; watch H1 and H5.
6. **Combinatorics of Intro templates.** 13 launch modules × ≥ 2 templates × 6 programmes × 3 positions to certify. Mitigation: templates are programme-agnostic stamps where possible; certification runs nightly.
7. **Soft-locks from dynamic furniture** and module interactions not foreseen here. Mitigation: dynamic reachability checks on every blocking change, and the guard rescue.
8. **Seed drift across versions** breaks shared seeds and replays (PL pitfall 12). Mitigation: `pins.layout` in packs and replays; Today's Exhibition pins the layout version.
9. **The vista rule fights furniture.** Reserving the entrance-to-Masterpiece line can leave formal rooms bare along the axis. Mitigation: niches and column pairs beside the axis (§14.2); an aesthetic review in S6.
10. **Map size on phones.** 48×36 tiles at 16 px needs scrolling in both directions; long axes and balcony snipers can be off-screen. Mitigation: the map UI (CS §13.5), threat pips on the screen edge (core UI), and L-D1 (a).

---

## 21. Cut line

Drop first at the top; never cut below the line.

1. Hamiltonicity, intelligibility and visual integration (offline research metrics).
2. The knob archive (§13.4): ship hand-set presets per programme and size, keep expressive-range CI.
3. Wayfinding signs (§8.3); keep section panels.
4. Closed-for-reinstallation detours (§5.6).
5. Band styles other than `suite` (§4.9).
6. The ticketed room and its lock machinery (§5.5). Keep the lock-record format for the guard rescue.
7. The glazed-screen access variant (L-D5 (a)).
8. Staff plans as items (§15.3); keep the Floor Plan consumable.
9. Balconies (grand hall becomes a single-level hall with a central void). This also weakens `tide_cycle`, so cut it only together with that module.
10. The staff layer (guarded departments then use a public patrol only).

---- never cut ----
- validation LV1–LV12 and the worst-case runner;
- the vestibule, the Intro's invariants and their offline certification;
- named RNG streams and the layout pin;
- repair, reseed, certified fallback and their logging;
- the arena rule;
- the entrance safe zone;
- the choke supply.
