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

`./tools/check-all.sh` runs everything: `./tools/check-overhaul.sh` (node suites, syntax, release build), then the
browser suites in `tools/playtest/tests/` one at a time (`node tools/playtest/tests/<name>.js`; SwiftShader, so run one browser at a
time): visual, persistence, vehicles, enter_test, docks_test, repo_test, rev_test, missions_all, soak, pursuit.

## Steps

- [x] 1. Confirmed defects.
- [x] 2. Device truth and a quality ladder that understands a 30 Hz cap.
- [x] 3. A cold open through the Foundry Quarter.
- [x] 4. Pursuit legs: cruisers that reach you, a patrol car at one star, T-bones and PIT, the Heat Run pot.
- [x] 5. One-thumb combat: lock-on, a context ACTION button, fewer touch buttons.
- [x] 6. Nights and look.
- [x] 7. Story order, the con, the morning paper.

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

Step 3: the first job is HOT CAR instead of a 182 m walk. Two skippable caption lines, then the camera faces a
Falcata with its engine running at the kerb three metres away and its owner beside it on the phone. Taking it
brings one star and a teal Pay 'n' Spray blip; losing the star by line of sight or a respray brings Marla's call,
and delivering any car to Voss Motors pays $500 and makes that car yours. Being wasted or busted during the opening
costs nothing: no failure card, no retry prompt, no bill; the job restarts itself five seconds after the respawn.
While driving, the objective card folds into a one-line strip at the top six seconds after its text changes,
instead of covering your car. The campaign audit plays the new opening (star, call, delivery, $500) and its quiet
restart; missions_all, soak and persistence pass.

Step 4: cruisers far away or out of sight now drive the roads with sirens (through red lights, at pursuit speed),
turning at each junction toward the target by hop distance over the road graph; within 38 m and in sight they
close in directly. A cruiser held up behind traffic tries the other lane, then backs off and goes round for four
seconds. New cruisers spawn on lanes heading toward you. Pursuit bench, two stars, player in a parked car at four
spots, 60 s: before, cruisers came within 30 m at 2 of 4 spots (32.5 s in total); after, at 4 of 4 (99 s in total),
first arrival 8-22 s. `tools/playtest/tests/pursuit.js` keeps it (3 of 4 within 35 s). One star now sends a patrol
car. Car-to-car hits apply an angular impulse from the contact offset, so a T-bone spins the car it hits and a
nudge on a rear quarter works as a PIT. The overhaul's contact damage had cut car fires out entirely (`burning` was
never set, and every bullet with a contact point disabled rather than destroyed): gunfire and blasts now set a car
alight below 12% and it explodes five seconds later, while crashes still only disable. Drive-by shooting has its
own timer instead of sharing the burning countdown. Heat Run: while wanted, a pot grows at 5 x stars^2 per second,
plus 150 x stars per cruiser destroyed; a clean getaway or a respray banks it (best run kept in stats), WASTED or
BUSTED loses it; shown under the stars. Speed streaks at the screen edge past 20 m/s (scaled by the speed/FOV
comfort setting, drawn on the 2D overlay) and wind noise that rises with speed.

Step 5: on foot, touch shows FIRE, AIM, JUMP, one ACTION button and WEAP when nothing is happening (ten buttons
before). ACTION reads the moment: TALK (held) to the debtor in Repo Man, VAULT at a low wall, otherwise ENTER.
CROUCH and EVADE appear when armed and in a fight (aiming, wanted, or a hostile within 30 m), SIDE while aiming,
LOAD when the magazine is not full. WEAP taps to cycle and, held, opens a wheel of every weapon carried with its
ammo; the thumb's direction picks, release selects. Taxis and cruisers get a JOB button for fares and vigilante
work. Holding FIRE on touch uses the controller aim assist (step 1 made the lock work at range), and the gun arm
now points at a locked target instead of following the orbit camera's tilt (`test/getaway.js`: the hand rises for
a target overhead). The Heat Run readout sits below the weapon block.

Step 6: nights are designed rather than subtracted. The night zenith is indigo instead of near-black, the horizon
carries a sodium-orange glow the city throws on its haze, fog at night carries that glow into the distance, and
light bounced up from lamp-lit pavement is warm. Twilight lasts to about 19:15 (it was full night by 18:45).
Static geometry can now glow at night by tag (bone 20 warm, 21 beacon, resolved in the shader from the existing
vertex attribute, no new draws): the aircraft beacons on towers and landmarks, and a lit band around Crane
Holdings' crown. Checked on dusk, night and roof-skyline contact sheets.

Step 7: Marla's finale waits until Okafor's nine jobs are done (they are all against a living Crane; the audit
checks CRANE will not start before and does after). The Accountant phone contract is skipped once Crane is dead.
CRANE can be lost: the Bastion reaching 320 m from you with Crane aboard fails the job. The bank crew in THE FIRST
GRIFT hold the door and fire back (their 'crewwork' role had fallen through to civilian AI). The con: beside an
ordinary pedestrian, empty-handed and unhurried, hold G (Y on a pad, HUSTLE on touch) for 2.4 s; one of three
pitches (Charm, Pressure, Story) lands for $40-260 or blows up into a shout and a witness report. A drawn gun,
stars or a cop in sight cut the odds, the night and the good suit help, and nobody falls for it twice
(`test/getaway.js`). The Grift City Gazette prints when you wake at the safehouse and at seven each morning,
with up to three headlines from what you did since the last edition: the last job passed, the best Heat Run
banked, cruisers wrecked, bodies, stolen cars, cons, arrests and packages.

## Getaway plan, second pass

The items the first pass left out, worked through one at a time with the same gate.

- [x] The cold open starts in the Foundry Quarter: the player outside the Lantern Diner, the Falcata idling at the
  mouth of Lantern Lane, the lane's timber gate ahead. Older saves that finished Marla's finale before Okafor's jobs
  get a line from Okafor acknowledging Crane is dead (his lieutenants still run the yards). Lots in the middle column
  of a three-wide block no longer paint shopfronts on the wall that faces the next lot (41 such fronts; the random
  picks still happen, so the seeded city is unchanged).
- [x] Touch layout settings: button size (0.75-1.4x), button opacity, and a left-handed mode that mirrors the action
  cluster and puts the stick on the right (the weapon wheel opens toward the screen centre either way).
- [x] Roadblocks sit square across the road at the junction ahead of your line of travel, and from three stars a
  spike strip goes down 26 m short of them; anything but a police car driving over it loses all four tyres
  (`test/getaway.js`). Close behind a fleeing car at two stars, a cruiser aims for the rear quarter on its own side
  and PITs it rather than braking to a stop behind (browser trial: contact in all four runs, the target spun and
  stopped).
- [x] Kerb parking: 325 slots on about a fifth of the kerb stretches (position hash; clear of props, lots and the
  Foundry Quarter), cars pulled up with two wheels on the pavement clear of the outer lane. Filled only between 30
  and 150 m from the player, at most 24 at a time, cleared beyond 190 m; a car you drive off leaves its slot empty
  for ten minutes. Parked cars hold position under physics (`test/getaway.js`).
- [x] Jobs and checkpoints survive a reload. Checkpoint restores live in each job's `checkpoints` table and are named
  by index, so a save can record them; the game now also saves when the page is hidden mid-job (iPadOS may discard
  the tab). On load the interrupted job is offered back ("Where you left off: press Y / tap to resume ... from the
  checkpoint"). A failed job's retry offer now lapses after 45 s instead of hanging on the objective card forever.
  The campaign audit resumes SPECIAL DELIVERY from its ambush checkpoint through a JSON round trip.
- [x] A choice and two endings. Stop Crane's Bastion by blowing it up (or shoot Crane) and he dies: Marla's ending.
  Crash it to a halt and he climbs out alive and makes an offer; a choice panel (1/2 or tap) asks whether to finish it
  for Marla or take his $40,000. The deal ends the story Crane's way: Marla's discount goes, Crane's crews stop
  turning on you, the police forget faster (evasion time x0.6), and the Gazette reports that he walked away. The
  ending is kept in the save's flags. The campaign audit plays both branches.
- [x] The bank job. First Grift Bank has an interior under its lot (a banking hall with a counter and brass grille,
  and a vault behind a round door with shelves of banded cash that glow at night-emissive strength), opened only by
  the heist. THE FIRST GRIFT now starts with optional casing: the camera is in the car, and photographing the two door
  guards and the camera over the door (a new prop) means one guard inside instead of three, a 35 s drill instead of
  55, two stars instead of three to four, and a $2,500 clean-take bonus. The crew walk through the front door with
  you and hold the vault door while the guards fight; when the vault is open everyone comes out and runs for the
  safehouse. Audited (casing, interior, easier entry, exit) and played through in missions_all.
- [x] Static vertex buffers are packed: 36 bytes a vertex instead of 52 (normals as signed bytes, colours as half
  floats, texture layer and bone as bytes; positions and UVs stay float). GPU vertex memory for the city and models
  119 -> 83 MB headless; a street render differs from the float layout by 0.07/255 on average. Meshes whose data
  would not fit keep the float layout. `tools/check-all.sh` now keeps each browser suite's log.
- [x] Faster boot: the painted texture layers (78 colour at 512 px, 78 normal/roughness at 320 px) are cached in
  IndexedDB, deflated, under a key hashed from the painting code and the photographic materials, so any change to a
  painter repaints. A miss paints as before and writes the cache four seconds after the game is up (only with 250 MB
  of storage headroom); any storage failure just paints. Headless, the texture phase goes from 9.7 s to 1.4 s on the
  second boot, and a cached boot renders the same as a painted one. `?paintcache=0` bypasses it.
- [x] Opt-in performance logging: Settings > "Send performance numbers to Claude" writes one document a minute while
  playing to the artifact's own database (`perf/<session>-<minute>`: that minute's frame count, mean and frames over
  20/34/50 ms, plus the overlay's report: percentiles, rung, draws, triangles, heap, GPU string, canvas size; hour,
  weather, in-car and stars for context; nothing else about the player). Off by default; capped at three hours a
  session; outside the claude.ai viewer nothing is sent. The published artifact declares `db` for this, which makes
  it organisation-internal (it cannot be shared by public link while that capability is declared).


## Character and escape pass — September 23

The next pass prioritizes the protagonist, the shared cast and a continuous escape through the Foundry Quarter. Keep playtesting muted; publish each completed milestone to main.

- [x] Character art: sculpted face planes, geometric eyes/lids/brows/lips/nose, swept protagonist hair, constructed collars and jacket pockets, back yoke/seams, cloth weave, trouser shaping, shoe details and articulated hands. Shared across the cast, with a distinct worn bomber, collar and watch for the protagonist.
- [x] Spine foundation: reuse the unused weapon bone for the chest, with blended rib/waist skinning and pelvis/shoulder counter-rotation. All seated and ragdoll paths retain valid bones. Weapon entities still attach to the right forearm.
- [x] Repair the character studio to use the production module list and add all principal cast, walk/sprint/crouch/vault/reload/seated poses, rotation, lighting and pause controls. No saves and always muted.
- [ ] Animation: smooth action transitions, supported weapon grip, jump/vault/landing poses and collision-aware NPC locomotion.
- [ ] Escape: rehearse steal/crash/abandon/vault/switch and improve the actual interactions found to interrupt it.

Character-art validation: all 13 dependency-free suites, release build and whitespace checks pass; 84 connected-joint poses, 24 planted-foot checks and 56 weighted-skin poses. Inspected front/rear views and named cast in the live muted studio.
