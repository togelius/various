# Coastal getaway overhaul

Implementation of the September 2026 look, feel and gameplay review. Mission scripts and campaign content are retained. Work is on `main`; each completed milestone is tested, committed and pushed.

## Milestones

- [x] 1. Embodied controls: collision-aware locomotion, crouch/evasion, camera sweeps and shoulders, accessible settings and remapping.
- [x] 2. Presentation: character deformation and poses, coastal material rules, night readability, directional practical light, varied wetness and reflections.
- [x] 3. Playable streets: ten connected authored blocks, shared cover/vault/destructible definitions, parking deck and multi-level queries/navigation.
- [x] 4. Driving: three handling identities, physical speed/feedback, localized damage, visible entry/exit, persistent vehicle condition.
- [x] 5. Decisions: tactical cover/flanking/suppression, weapon feedback, witness reports, vehicle identification and distributed searches.
- [ ] 6. City continuity and release: persistent local incidents, map icons/waypoints/routes, interaction feedback, audio mix controls, repeatable scenarios and distribution build.

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
