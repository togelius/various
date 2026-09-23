# Coastal getaway overhaul

Implementation of the September 2026 look, feel and gameplay review. Mission scripts and campaign content are retained. Work is on `main`; each completed milestone is tested, committed and pushed.

## Milestones

- [x] 1. Embodied controls: collision-aware locomotion, crouch/evasion, camera sweeps and shoulders, accessible settings and remapping.
- [x] 2. Presentation: character deformation and poses, coastal material rules, night readability, directional practical light, varied wetness and reflections.
- [x] 3. Playable streets: ten connected authored blocks, shared cover/vault/destructible definitions, parking deck and multi-level queries/navigation.
- [x] 4. Driving: three handling identities, physical speed/feedback, localized damage, visible entry/exit, persistent vehicle condition.
- [x] 5. Decisions: tactical cover/flanking/suppression, weapon feedback, witness reports, vehicle identification and distributed searches.
- [x] 6. City continuity and release: persistent local incidents, map icons/waypoints/routes, interaction feedback, audio mix controls, repeatable scenarios and distribution build.

## Quality gates

Run the relevant deterministic suites for each milestone. Exercise the running game with `?mute=1`, including daylight/rainy night, blocked movement, camera corners, vehicle transitions, wet braking, combat and pursuit. Rebuild the single-file distribution at release. Record checks and limitations here; do not claim listening tests, mobile hardware performance or a complete campaign playthrough without performing them.

## Visual rules

World units are metres. Grounded stylization: warm weathered masonry, salt-grey concrete, oxidized teal metal, muted body paint and small amber practical lights. Rubber and cloth stay rough; metal and glass carry localized highlights. Large forms and first-storey recesses precede tiny detail. Use bevels on handled objects and broad panels, consistent human/door/car scale, restrained particle size, and clear foreground silhouettes in darkness. Geometry that communicates cover, passage, elevation or breakability must share its gameplay definition.

## Validation log

Baseline: existing gameplay, character and vehicle suites pass at `949cc38`. Review screenshots and frame samples were taken with audio muted.

Milestone 1: added deterministic control-foundation coverage (30/60/120 Hz wall contact, crouch, evade recovery, shoulder switching, remapping and camera vehicle collision). Existing gameplay, character and vehicle suites pass. Muted browser verification confirmed wall speed 0, native settings changes, binding swap and resume. The pause panel scrolls at 1280×720; UI and touch use separate coordinate scales.

Milestone 2: shared lit/shadow two-bone skinning with bind offsets, staged reload poses and acceleration lean; occluded night character fill; directional headlights; two influential local lights blocked by eight nearby building proxies; six cached 16px geometry-baked reflection cubemaps (static architecture, approximate materials, no reflected moving actors); varied wetness; corrugated container kit and smaller impacts/rain streaks. All five suites pass, including 56 weighted poses/1,694 blended vertices. A muted 10 s rainy-night browser sample at 1280×720 produced median/p95/p99 animation-frame intervals of 16.7/17.2/17.7 ms with automatic quality level 0. This is one Mac, not a cross-device performance claim.

Milestone 3: ten-block Foundry Quarter (seven rebuilt blocks plus the retained park, garage and respray), varied recessed frontages and named landmarks; measured compact-car/foot passages, diagonal loading-yard route, breakable timber gates, shared low cover and context vaults. Switchback Deck has independently queryable upper/lower floors, continuous ramps, ceiling collision and pedestrian graph links. The new street suite checks these contracts and drives the actual sedan physics over the ramp seam. Muted browser checks confirmed 3.8 m deck height at 14.7 m/s without damage, walking underneath, and a complete vault. All existing suites and 22 mission spawn/failure/retry checks pass.

Milestone 4: sedan/sports/utility tyre and steering tuning, adjustable countersteer, rain-aware braking, slope pitch, hit-location tyres/glass/panels/engine/cooling, temperature warnings and disabled vehicles. Doors are clipped from body/window triangles and hinged; entry opens/lowers/closes, exit unfolds from the seat while retaining emergency-exit semantics. Condition survives safehouse saves and Voss garage storage. Deterministic 8 s speeds were 19.57/27.12/18.50 m/s; sedan 20 m/s stopping distances were 15.6 m dry and 21.1 m wet. 30/60/120 Hz acceleration, local damage/repair/serialization and door geometry pass, as do all previous suites and campaign transitions. Muted browser verification caught and fixed inward hinges and transition camera collision, then confirmed completed entry.

Milestone 5: local visual memory; reachable low-wall/vehicle cover; hold/flank/guard/advance roles; shot suppression, wind-up and finite NPC magazines; player movement/crouch accuracy, recoil recovery and directional damage. Witnesses call before a fixed-location report; officers identify remembered vehicles/paint and search separate sectors. Police arrivals avoid nearby visible roads, and roadblocks use remembered travel direction. Vehicle routing joins authored paths to the road graph and supports deck pursuit. All suites pass, including new decision tests. Muted 10 s browser samples: combat p95 17.6 ms, four-star pursuit p95 17.7 ms, adaptive level 0, no new console errors.


Milestone 6: bounded local incident memory, animated shop shutters, recurring queues, a timed delivery obstruction and crash onlookers/traffic caution. Incidents and broken gates persist in saves. Native destination selection, shape-based map icons, width-aware route previews and touch waypoint placement; map layouts verified at 1280×720, 390×844 and 844×390. Native audio sliders separate master/effects/vehicles/ambience/radio, with persistent mute, quiet dynamics, source panning and obstruction filtering. Inert WebAudio tests verify signal routing without generating sound. The release pass also cleared generated furniture from authored routes, preserved original shutter states, restored witness props on cancelled reports, corrected the midnight probe key, and released private vehicle damage meshes on removal.

All eleven suites and JavaScript syntax checks pass via `tools/check-overhaul.sh`; it also regenerates `dist/grift-city.html` and checks whitespace. Both rehearsal pages load the current module order. New `test/overhaul-scenes.html` provides save-disabled, muted scenarios and frame interval reporting. A final 10 s daylight incident sample returned p50/p95/p99 16.7/16.8/17.4 ms (600 frames); rainy-night four-star pursuit returned 16.7/17.2/18.7 ms (598 frames), both at 1280×720 and automatic quality level 0. No new browser console errors. These are short animation-frame samples on one Mac.

## Remaining evaluation limits

The implementation milestones are complete; experience-quality validation is broader than automated correctness. There has been no listening test, physical phone/controller test, lower-power hardware benchmark, complete human campaign playthrough, long-session soak, or player study of lap learning and encounter approaches. Reflections use small cached probes of static architecture, and local-light occlusion uses a bounded set of building proxies. Car exits retain immediate gameplay control with visual follow-through. The authored quarter establishes the new street standard; the rest of the island still uses the procedural block generator. These are practical limits of this release, not claims of completed validation.

# Getaway plan (continues the overhaul)

A second pass built on the review in which eight subsystem maps, a headless playtest and six design lenses were
checked against the code. It keeps the overhaul's systems and goes after what still stands between them and the
player on an iPad: the quality ladder, the chase, the first minutes, one-thumb combat, the nights and the story.
This file is the shared roadmap; whoever works on the game ticks items here and runs the same gate.

## Gate

`./tools/check-overhaul.sh` (node suites, syntax, release build), then the browser suites in
`tools/playtest/tests/` one at a time (`node tools/playtest/tests/<name>.js`; SwiftShader, so run one browser at a
time): visual, persistence, vehicles, enter_test, docks_test, repo_test, rev_test, missions_all, soak.

## Steps

- [x] 1. Confirmed defects.
- [x] 2. Device truth and a quality ladder that understands a 30 Hz cap.
- [ ] 3. A cold open through the Foundry Quarter.
- [ ] 4. Pursuit legs: cruisers that reach you, a patrol car at one star, T-bones and PIT, the Heat Run pot.
- [ ] 5. One-thumb combat: lock-on, a context ACTION button, fewer touch buttons.
- [ ] 6. Nights and look.
- [ ] 7. Story order, the con, the morning paper.

## Validation log

Step 1: auto-quality treated a steady 33 ms frame (a 30 Hz display, Low Power Mode) as slow and stepped down to
the bottom rung for nothing; it now probes one rung, and when the frames do not speed up it concludes the cap is
real, restores quality and judges against 30 Hz from then on (persistence suite: capped, vsync-slow and
capped-and-slow cases). Idle job markers and taxi destinations were pushed every frame without limit (600 after ten
seconds, each drawn every frame); marker() now reuses a marker at the same spot. Bought cars and the car you last
drove are no longer despawned. The aim-lock vertical gate compared the target's pitch from the player's eye with the
orbit camera's pitch and only let targets within a few metres through; it is measured along the camera's crosshair
ray, touch uses the controller assist setting, locked shots and rockets fly at the target. AI cars could not reverse
from a standstill because the physics zeroed any braking car below 0.15 m/s unless `reverse` was set; traffic and
chase AI now set it. Respawns step out toward open street. Pay 'n' Spray charges once per visit and only with stars
or damage. A closed shop stays closed until you step away. WASTED/BUSTED is shown before MISSION FAILED. Busted
stops the car. Crane Holdings rises to 340 m with a crown of fins. Pay 'n' Spray is teal, not job-yellow. The
helicopter rotor LFO rode on the level itself and thumped at 13 Hz with no helicopter; it has its own stage. No
birdsong at night. Sub-star suspicion fades. Money cannot go negative. The job camera is in the weapon cycle.
The radar edge checks now look for the blip at the rim (the on-foot route line shares its colour) and the vehicle
showroom no longer assumes a reflection probe exists. `test/getaway.js` covers markers, despawn, lock, reversing,
respawn heading, the spray and the shop latch; all node and browser suites pass.

Step 2: Settings has a Performance overlay (p50/p95/p99 frame time as delivered, detected cap, quality rung, render
scale, dpr, CPU sim and render time, draws, triangles, heap, GPU string) and a Copy performance report button whose
JSON can be pasted into a chat, so the iPad's own numbers decide what to tune. The adaptive ladder now sheds the
overhaul's costs first: rung 1 stops rebuilding reflection probes, drops lamp occlusion and keeps the nearest 20
lamps; rung 2 turns off normal maps and keeps 14 (plus AO off as before); rung 3 keeps 10 (plus 0.75 scale); rung 4
post; rung 5 shadows. Paused and map frames are drawn once and held; the title orbit runs at half rate on a 60 Hz
display. A lost WebGL context saves and reloads (forced loseContext verified). The game saves when the page is
hidden outside a mission, 1.5 s after any purchase and after a hidden package. The painted texture layers are
released after upload: JS heap after boot 326 -> 242 MB headless. Not done: vertex packing, an IndexedDB paint
cache and artifact-side telemetry; the copyable report stands in for telemetry until real iPad numbers show where
the time goes.
