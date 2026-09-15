# GRIFT CITY

*a 3D open-world crime game in the browser* — one folder of plain JavaScript
and WebGL2, no build step, no dependencies, no assets.

Open `grift-city/index.html` in a desktop browser and click. There is also a
single-file build in `dist/grift-city.html` if you would rather host or hand
around one file; `python3 tools/build-single.py` regenerates it.

> Ten by ten blocks of an island city. Traffic that stops at the lights.
> Pedestrians who scream. Police who never forget. A garage in Midtown with a
> woman inside who has work for you.

![Downtown at nine in the morning](screenshots/day.jpg)
![Northgate at night, headlights on](screenshots/night.jpg)
![Four stars and a helicopter](screenshots/chase.jpg)

## What it is

A third-person open-world game in the shape of the early 3D crime games: you
walk, you steal a car, you drive too fast, you shoot, the stars climb, the
helicopter comes. Nine story missions run from a repo job to a bank heist to a
shoot-out in a Downtown plaza, and between them the city stays open: taxi
fares, vigilante chases, hidden packages, stunt ramps, gun shops, a Pay 'n'
Spray, and a safehouse bed that saves the game.

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

Gamepads work: left stick moves, right stick looks, triggers fire and aim
(on foot) or drive (in a car), A sprints or handbrakes, B jumps, X enters
cars, bumpers change weapon.

Yellow markers are jobs. Walk into the one outside VOSS MOTORS to meet
Marla. Red markers are IRONMONGER gun shops, the yellow driveway marker is
a Pay 'n' Spray (drive in with a wanted level and $100), and the pink marker
outside the safehouse saves the game and sleeps six hours.

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
wheels and limbs. A 2048² shadow map follows the camera during the day; at
night the sun goes out, the windows come on, and the lampposts and
headlights become point lights.

`window.__sim(seconds, [keyCodes])` steps the simulation deterministically
without rendering, which is how the game was tested headless.
