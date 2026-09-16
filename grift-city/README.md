# GRIFT CITY

*a 3D open-world crime game in the browser* — one folder of plain JavaScript
and WebGL2, no build step, no dependencies, no assets.

Open `grift-city/index.html` in a desktop browser and click. There is also a
single-file build in `dist/grift-city.html` if you would rather host or hand
around one file; `python3 tools/build-single.py` regenerates it.

> Ten by ten blocks of an island city. Traffic that stops at the lights.
> Pedestrians who scream. Police who never forget. A garage in Midtown with a
> woman inside who has work for you.

![Midtown at nine in the morning](screenshots/day.jpg)
![Northgate at night, headlights on](screenshots/night.jpg)
![Four stars in Downtown](screenshots/chase.jpg)

## What it is

A third-person open-world game in the shape of the early 3D crime games: you
walk, you steal a car, you drive too fast, you shoot, the stars climb, the
helicopter comes. Nine story missions for Marla Voss run from a repo job to a
bank heist to a shoot-out in a Downtown plaza; eight more for Captain Okafor at
Pier 9 open up once Marla trusts you, among them a stealth job, a
photography job and a tanker that takes a car yard with it; four contracts
come in on payphones. Missions branch on what you do (a debtor who dies
before he can be repossessed, a collector who keeps his fingers), keep
checkpoints at their hard turns, and give a third attempt more time and a
vest.
Between them the city stays open: taxi fares, vigilante chases, three
rampages, twenty hidden packages, six unique stunt jumps, gun shops, a Pay
'n' Spray, and a safehouse with a bed that saves the game and a kerb that
keeps whatever you parked there.

Everything is generated at runtime. The city is laid out from a seed; every
building facade, road, sidewalk and billboard is painted onto a canvas and
uploaded as a texture; every car, pedestrian, lamppost and helicopter is
built from boxes and cylinders; every sound, including the three radio
stations, is synthesised. There is no model file, image or audio file in
this directory.

## Playing

|                       |                                            |
| --------------------- | ------------------------------------------ |
| Move / drive          | `WASD` or arrows                           |
| Look / aim            | mouse (click the game to capture it)       |
| Attack / fire         | left mouse button                          |
| Aim                   | right mouse button                         |
| Sprint                | `Shift`                                    |
| Jump / handbrake      | `Space`                                    |
| Enter or leave a car  | `F`                                        |
| Weapons               | scroll wheel, `Q` / `E`, or `1`–`8`        |
| Radio / horn / siren  | `R` / `H` / `L`                            |
| Taxi or vigilante job | `T` in a taxi or a police car              |
| Map / pause / mute    | `Tab` / `Esc` / `M`                        |
| Retry a failed job    | `Y` (within half a minute of failing)      |
| Shop menus            | `1`–`9` to pick, `Esc` to leave            |

Gamepads work: left stick moves, right stick looks, triggers fire and aim
(on foot) or drive (in a car), A sprints or handbrakes, B jumps, X enters
cars, bumpers change weapon.

Yellow markers are jobs. Walk into the one outside VOSS MOTORS to meet
Marla; the blue one at PIER 9 is Okafor, once you have done enough for
Marla. Blue markers at street-corner payphones ring with contracts. Orange
skulls start rampages. Red markers are IRONMONGER gun shops, the yellow
driveway marker is a Pay 'n' Spray (drive in with a wanted level and $100),
and the pink marker outside the safehouse saves the game and sleeps six
hours. Park a car beside it before you save and it will be there when you
come back.

`Esc` opens the pause menu, which is also the options menu: mouse
sensitivity, inverted look, shadows, bloom, and render scale.

Old habits: type `BIGBANK`, `KEVLAR`, `ARSENAL`, `COOLOFF`, `HOTHEAD`,
`NIGHTFALL`, `SUNRISE`, `DOWNPOUR`, `CLEARSKY`, `FALCATA` or `BASTION` during play.

## The city

Six districts on one island, joined by four-lane roads with working traffic
lights and crosswalks:

- **Downtown** — glass towers, the bank, and CRANE HOLDINGS.
- **Midtown** — offices, Voss Motors, the 3rd Precinct.
- **Northgate** — brick and tenements; the safehouse is here.
- **Westfield** — low and leafy, with parks and a clinic.
- **Eastside** — warehouses and the gang that keeps them; the 9th Precinct.
- **Southport** — the beach, Pier 9 and the docks.

A day lasts twenty-four real minutes; at night the windows come on and
the police helicopter's searchlight is the brightest thing in the sky. Rain
comes and goes on its own schedule and takes the shadows with it.

Three parking lots at the corners of the island carry stunt ramps. Twenty
hidden packages are tucked into corners; every five unlocks a weapon at the
safehouse.

## The jobs

Missions record their failures: fail one and `Y` puts you back at the
mission giver, or at the last checkpoint if the mission set one (the ambush
in SPECIAL DELIVERY, the last lap of MIDNIGHT RUN); the third attempt runs
its clocks at 1.4x and starts you with a vest. Some intros are written at
the moment they start, so Marla knows whether you already own a car.
Okafor's later jobs are less about shooting: QUIET WORK puts four patrolling
guards around a hut and fills a detection bar when you stand in their sight
or run near them (gunfire within earshot rings the alarm outright), EVIDENCE
hands you a camera that scores a frame by distance, aim and line of sight,
and FIREWORKS is one tanker parked next to six cars.

## The police

Crimes raise heat. Witnesses and nearby officers make it climb faster. One
star brings officers on foot; two brings cruisers; three adds roadblocks and
shotguns; four calls SWAT and a helicopter with a searchlight; five is all of
it at once. Stay out of sight and the stars drop one at a time, or pay the
Pay 'n' Spray, or pick up a bribe.

## How it is put together

```
js/math.js       matrices, angles, a seeded RNG, 2D ray tests
js/gl.js         WebGL2 helpers: programs, interleaved meshes, texture arrays, shadow target
js/textures.js   every texture, painted onto canvases at load
js/meshes.js     the box/cylinder/wedge builder; car, pedestrian, prop and helicopter models
js/city.js       island generation, districts, special lots, road and sidewalk graphs
js/render.js     the lit shader (shadowed sun, hemisphere, 32 point lights, emissive windows,
                 fog), the sky, the shadow pass, instancing, particles and flat FX
js/audio.js      synthesised engine, guns, sirens, crashes, and the radio sequencer
js/input.js      keyboard, pointer lock, gamepad
js/world.js      entity lists, collision queries, bullet raycasts, particles, props, lights
js/vehicles.js   arcade car physics, collisions, damage, traffic / chase / route AI
js/peds.js       pedestrians, cops, gang members, the shared animated rig
js/player.js     movement, chase camera, weapons, projectiles, entering cars, death
js/police.js     heat, escalation, roadblocks, the helicopter
js/missions.js   pickups, shops, dialogue, the nine story missions, taxi and vigilante jobs
js/hud.js        radar, stats, wanted stars, objectives, menus, the big map
js/game.js       boot, the frame loop, scene assembly, save games
```

The renderer draws the whole static city as one mesh, props as instanced
draws, and each car or pedestrian as one draw with a small bone array for
wheels and limbs; car glass is a second, translucent draw so you can see who
is inside. Everything renders in linear HDR into a multisampled float target;
a screen-space ambient occlusion pass grounds everything in its surroundings,
then bloom, a filmic tonemap and a vignette bring it to the screen. A 3072² shadow
map follows the camera during the day; at night the sun goes out, the
windows come on, and the lampposts and headlights become point lights. Cars
crumple as they take damage: the body mesh is rebuilt with dents at each
damage step.

`window.__sim(seconds, [keyCodes])` steps the simulation deterministically
without rendering, which is how the missions were tested headless. For real
playtests there is a bot: with `window.__pt = { dt: 1/30, renderEvery: 6,
cheap: true }` set before play starts, the loop runs at a fixed timestep,
renders every sixth step, and calls `__pt.bot(dt)` each step; the bot drives
the game through ordinary DOM keyboard and mouse events, navigates by the
radar blip along the sidewalk and road graphs, and a runner captures a
filmstrip with the game state under each frame.

The harness lives in `tools/playtest/` and needs Node and Playwright with
Chromium (`npm i playwright` next to it, or a global install):

```
node tools/playtest/run.js story1 story 420      # bot plays the story for 420 game-seconds
node tools/playtest/run.js mayhem1 mayhem 150    # bot shoots and steals cars until the police win
node tools/playtest/run.js drive1 drive 200      # bot just drives around the city
node tools/playtest/contact.js story1            # contact sheets from the filmstrip
node tools/playtest/shot.js out.png "tp(300, 336); sim(2, ['KeyW'])"   # one full-quality screenshot
node tools/playtest/tests/missions_all.js        # every mission and side job, teleport-driven
node tools/playtest/tests/soak.js                # six minutes of chaos, counts errors
node tools/playtest/tests/visual.js [group ...]  # screenshot inspection: camera handedness, steering, radar, textures, exposure, HUD, model detail
```

The visual suite renders controlled scenes with the frame loop parked and
decodes each screenshot in the page to check pixels: a magenta marker placed
to the player's right must land on the right half of the frame, holding D
must turn the car toward that side, a mission blip ahead must sit above the
radar centre and swing the right way when you turn, a four-colour test card
must read upright and unmirrored on all four box faces, night must be darker
than day but not black, the HUD must be where it belongs, and every car must
have more than a thousand triangles. It was written after a player reported
mirrored steering and a radar blip that circled at twice the speed of the
map; both were real, and both are now checks that would fail again.

Filmstrips land in `tools/playtest/pt/<name>/` with a JSON line of game state
per frame (position, car, health, stars, objective, and what the bot was
holding). On software rendering a story run takes about ten times as long as
the game time it covers.

Things the bot playtests found and that were fixed as a result: the road
graph was steering it into a corner pole, run-overs earned stars as fast as
murders, mission givers could be killed, crashes wrecked cars far too fast,
the police made a 3-star chase lethal in seconds, a fleeing mission driver
at the same speed as your car could never be stopped (now a driver who is
tailed closely for about ten seconds loses their nerve, pulls over and runs),
a mission driver could fail to get into their own car when they approached
it end-on, one crime could jump several stars at once, and every painted
texture on the side of a box was upside down (the shop signs gave it away),
and pressing the accelerator while rolling backwards floored the car in
reverse instead of stopping it. A second round from a human playtester:
steering was mirrored (the heading grows counter-clockwise, so right is
negative), the off-radar blip rotated against the map, and the cars and
people were boxes. Cars are now lofted from rounded cross-sections with a
shared roof-and-glass surface, wheel arches, bumpers, mirrors, trim and
five-spoke wheels; people have ellipsoid heads with hair, jointed tapered
limbs and a lofted torso. A later pass gave the rig knees and elbows: the
thigh swings, the knee folds while the foot is in the air and straightens for
the heel strike, the pelvis sways and counter-rotates against the shoulders,
the elbows fold on the forward swing, and a standing ped breathes and shifts
its weight. Seated peds fold their knees and put bent arms on the wheel.

Cars went from an arcade "lateral velocity decays" model to a two-axle
slip-angle model: each axle makes lateral force from its slip angle up to a
friction limit, the yaw rate comes from the front-rear force difference, the
front saturates a little before the rear so the car understeers gently at
speed, the handbrake cuts the rear grip to a third so it slides and can be
caught with countersteer, the driven axle only gets the acceleration the
friction circle leaves it (so a muscle car spins its tyres out of a corner),
and the steering lock shrinks with speed. Below walking pace it blends to a
plain kinematic turn so parking is not a physics exercise. The body squats,
dives and rolls from the real accelerations.

Damage now changes how a car drives: a hard hit can bend the steering so the
car pulls to one side, a harder one bursts a tyre on one axle, which loses
grip and rides low until a Pay 'n' Spray repairs it. Rain takes almost a third
of everyone's grip and the traffic slows for it. Tyre squeal follows the real
slip angle. Cars and people beyond eighty metres draw at a coarser level of
detail so the extra geometry costs nothing at range.

People who die or get knocked down go into a verlet ragdoll: sixteen joints
with bone-length and bracing constraints, ground contact with friction and
building push-out, refitted to the skeleton every frame using the shoulders
as a twist reference. A knocked-down ped gets back up after a couple of
seconds; the dead settle where they land.

The city keeps hours. A bustle curve empties the streets in the small hours
and fills them for the rushes at eight and six, trimming the farthest unseen
crowds and cars when the target drops. Each district has its own traffic mix
(cabs and coupes downtown, muscle and pickups east, trucks by the docks, cabs
and cruisers after midnight) and its own police response time, slowest on the
east side. Fog rolls in off the water before dawn and burns off by mid-morning;
it thickens the haze, dulls the sun and shortens how far the police can see.

Money has somewhere to go. The orange marker beside Voss Motors is the dealer
and mod shop: walk in to buy a car, drive in to store it (three slots), tune
the engine, fit stickier tyres or race brakes, plate it with armour, or pick a
colour. Mods change that car's own copy of its spec, so the streets stay stock.
Four green markers around the city are properties: buy one and it banks an
income by the game clock that you collect on the doorstep. Your standing with
Marla's and Crane's people moves with the jobs you do: Marla's friends get a
fifth off everything, and once Crane's people hate you enough his gangs shoot
on sight. The police no longer know where you are: cruisers head for where
you were last seen and search around it (the blue haze on the radar), and the
trail goes cold faster in a car park, in the safehouse yard, or in a car they
never saw you take. Fail the same job twice and the third try gets a longer
clock and a vest.
