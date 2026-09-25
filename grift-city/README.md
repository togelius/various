# GRIFT CITY

*a 3D open-world crime game in the browser* — one folder of plain JavaScript
and WebGL2, no build step or runtime dependencies; art assets are embedded.

Open `grift-city/index.html` in a desktop browser and click. There is also a
single-file build in `dist/grift-city.html` if you would rather host or hand
around one file; `python3 tools/build-single.py` regenerates it.

> Ten by ten blocks of an island city. Traffic that stops at the lights.
> Pedestrians who scream. Police who never forget. A garage in Midtown with a
> woman inside who has work for you.

![Midtown at nine in the morning](screenshots/day.jpg)
![Northgate at night, headlights on](screenshots/night.jpg)
![Four stars in Downtown](screenshots/chase.jpg)

## Driving that grips, drifts and pays (September 2026)

Cars go where they point. Normal driving has **tyre grip assistance** (Settings, default 0.6; 0 is the old,
looser model), the wheel straightens faster than it turns in, and rain costs a fifth of the cornering grip.
Braking loads the front tyres and power loads the rear. **Countersteer assistance** now steers the right way:
it used to steer into a slide and made it worse.

**Drifts** are deliberate. Flick the handbrake (Space, A on a pad, HAND on touch) with the wheel turned at
speed, then keep the gas on. The stick holds the angle, the wheels help follow the slide, and lifting off
straightens you out. Sports cars hold a hands-off drift, muscle cars ease out of one, and sedans and vans
barely drift at all.

**Style** pays: a held drift, a **near miss** (under a metre from a moving car, at speed, without touching)
and **air** are tricks. Each one landed within four seconds of the last grows the chain's multiplier (up to
×4). The chain banks when the streak goes quiet and is lost in a real crash. While you are wanted, it goes into
the Heat Run pot instead: the show is only paid if you get away. `node tools/driving-lab.js [revision]` prints
the handling numbers for every class, dry and wet.

## Getaway plan (September 2026)

A new game opens with **HOT CAR**: a Falcata with its engine running, one star, and a lesson in losing it.
Police now arrive by road and can be spun with a T-bone or a PIT; while you are wanted a **Heat Run** pot grows,
banked by a clean getaway or a respray and lost if you are caught. Hold **G** (Y on a pad, HUSTLE on touch)
beside a stranger to work a **con**. The **Gazette** prints your night's work each morning. Touch play shows only
the buttons the moment needs, with a context ACTION button and a held-WEAP weapon wheel. Settings has a
**Performance overlay** and **Copy performance report**, and adaptive quality no longer mistakes a 30 Hz screen
for a slow one. Marla's finale now waits for Okafor's jobs. `./tools/check-all.sh` runs every check; see
[DEVELOPMENT.md](DEVELOPMENT.md).

## Coastal getaway overhaul (September 2026)

Grift City now has a connected ten-block **Foundry Quarter**, including Lantern Lane,
Laundry Court, Signal Market, the Old Foundry and a parking deck you can drive onto
or pass underneath. Small-car clearances, foot passages, low cover, vaults and
breakable gates make route choice matter. Procedural street furniture leaves those
routes clear.

The overhaul also adds weighted character joints and richer transitions, animated
car doors, distinct sedan/sports/utility handling, local tyre/glass/body/engine damage,
readable coastal night lighting, directional headlights and cached local reflections.
Enemies use cover, suppression, reloads and complementary roles. Witness phone calls
create delayed reports; police remember vehicle descriptions and search separate sectors.
Nearby violence closes shutters, crashes draw attention, queues scatter and reform,
and a delivery van temporarily obstructs a lane. Local incidents, broken gates and
vehicle condition survive saves.

**Tab** opens the map: choose a destination or click/tap to set a waypoint; **Esc**
closes it. Route previews use roads and passages appropriate to your vehicle.
**Esc** in play opens native keyboard/touch settings with remapping, separate aim
sensitivity and assistance, steering assistance, camera motion controls, HUD scaling,
quality controls, five audio levels and quiet dynamic range. **Z** crouches, **X**
evades with recovery, **V** switches shoulders, and **Space** vaults a suitable low wall.
Sound can always be disabled at launch with `?mute=1`; **M** toggles persistent mute.

Run all dependency-free regression checks and rebuild the standalone release:

```sh
./tools/check-overhaul.sh
```

Serve this folder and open `test/overhaul-scenes.html?mute=1&seed=42` for repeatable
street, ramp, entry, driving, combat, pursuit, weather, map and touch rehearsals.
The visible controls run the real game, disable gameplay saves and report frame intervals.
The older `test/polish-scenes.html` still provides mission/retry rehearsals.
See [DEVELOPMENT.md](DEVELOPMENT.md) for milestones, results and evaluation limits.

## Gameplay polish (September 2026)

The mission panel now wraps long objectives and shows destination distance. In a car,
the radar and map show a road route; the dotted final segment marks the approach off
the road. Voss Motors has its own teal-and-gold service facade and readable sign.

Gunfire uses the rendered camera's 3D aim and checks cover from the player's body.
Bullets respect height, roofs, indoor walls and vehicle dimensions. **R reloads on
foot**; the ammo display is magazine / reserve. Empty magazines reload automatically
when firing, switching weapons cancels the reload, and magazine contents are saved.
R still changes the radio in a car; drive-by weapons reload automatically.

Police distinguish pursuit from searching. Unwitnessed shots do not reveal your
position, officers search the last report, and buildings can hide you from the
helicopter. The search bar shows progress toward losing the next wanted star.

Vehicle entry chooses a reachable nearby door. Press F again, jump, or start moving
to cancel the approach. Exiting checks both sides and behind the car. Recoil, punches
and sirens advance with simulation time; aiming includes sideways/backward steps,
jump poses and a reload pose. Wet-road grip follows lingering surface wetness.

Repo Man gives you a short warning before the debtor runs. Block him for two seconds
or reduce the Falcata below 65% condition to make him surrender. Return it at low
speed for $1,000 plus up to $600 for its condition; killing the debtor still pays
only $500. Failed missions retain **Y to retry**, skip repeated dialogue, and retain
existing checkpoint support. On touchscreens, tap the retry panel or weapon area to
retry or reload.

Regression checks (no dependencies):

```sh
node test/gameplay-polish.js
node test/character-geometry.js
node test/vehicle-geometry.js
```

For a repeatable visual rehearsal, serve this folder and open
`test/polish-scenes.html`. Its visible buttons exercise driving, shooting, vehicle
entry, Repo Man and retry using the real simulation, without saving progress. Rehearsals start muted; add `?mute=1` to a normal
game URL for a quiet launch (M still toggles sound).
Rebuild the standalone game with `python3 tools/build-single.py` after source edits.

## What it is

A third-person open-world game in the shape of the early 3D crime games: you
walk, you steal a car, you drive too fast, you shoot, the stars climb, the
helicopter comes. Nine story missions for Marla Voss run from a repo job to a
bank heist to a shoot-out in a Downtown plaza; nine more for Captain Okafor at
Pier 9 open up once Marla trusts you, among them a stealth job, a
photography job, a tanker that takes a car yard with it and a boat chase; four contracts
come in on payphones. Missions branch on what you do (a debtor who dies
before he can be repossessed, a collector who keeps his fingers), keep
checkpoints at their hard turns, and give a third attempt more time and a
vest.
Between them the city stays open: taxi fares, vigilante chases, three
rampages, twenty hidden packages, six unique stunt jumps, gun shops, a Pay
'n' Spray, and a safehouse with a bed that saves the game and a kerb that
keeps whatever you parked there.

The city layout and most geometry are generated at runtime. Building facades,
roads, sidewalks and billboards combine canvas-painted details with embedded
photographic materials; selected vehicles, vegetation and props use embedded
Kenney models. Every sound, including the radio stations, is synthesised.
The game needs no asset downloads to run. See **Imported art** below for sources
and regeneration tools.

## Playing

|                       |                                            |
| --------------------- | ------------------------------------------ |
| Move / drive          | `WASD` or arrows                           |
| Look / aim            | mouse (click the game to capture it)       |
| Attack / fire         | left mouse button                          |
| Aim                   | right mouse button, two-finger click, or hold Option/Alt or `C` |
| Sprint                | `Shift`                                    |
| Jump / vault / handbrake | `Space`                                    |
| Crouch / evade / shoulder | `Z` / `X` / `V`                          |
| Enter or leave a car  | `F`                                        |
| Weapons               | scroll wheel, `Q` / `E`, or `1`–`8`        |
| Radio / horn / siren  | `R` / `H` / `L`                            |
| Taxi or vigilante job | `T` in a taxi or a police car              |
| Map / pause / mute    | `Tab` / `Esc` / `M`                        |
| Retry a failed job    | `Y` (within half a minute of failing)      |
| Photo mode            | `P` (WASD/QE fly, wheel zooms, click saves) |
| All controls          | `F1` (a sheet in the game; the bottom line always shows the keys for what you are doing) |
| Shop menus            | `1`–`9` to pick, `Esc` to leave            |

Gamepads work: left stick moves, right stick looks, triggers fire and aim
(on foot) or drive (in a car), A sprints or handbrakes, B jumps, X enters
cars, bumpers change weapon. Stick clicks crouch and evade; D-pad left switches shoulders.

Yellow markers are jobs. Walk into the one outside VOSS MOTORS to meet
Marla; the blue one at PIER 9 is Okafor, once you have done enough for
Marla. Blue markers at street-corner payphones ring with contracts. Orange
skulls start rampages. Red markers are IRONMONGER gun shops, the yellow
driveway marker is a Pay 'n' Spray (drive in with a wanted level and $100),
and the pink marker outside the safehouse saves the game and sleeps six
hours. Park a car beside it before you save and it will be there when you
come back.

`Esc` opens the pause menu, which is also the options menu: mouse
sensitivity, inverted look, shadows, bloom, render scale and auto quality.
The menu shows the frame rate. Auto quality (`A`, on by default) watches
it and, when frames stay slow, steps the renderer down one notch at a
time (render scale, then ambient occlusion, then a lower scale, then
shadows, then the post pass) and steps back up when there is headroom;
the menu says how far it has stepped. The game itself keeps real-time
pace regardless: a slow frame is simulated as several sixtieth-of-a-second
steps rather than one long one, so on a slow machine you still walk, run
and drive at full speed, only with fewer pictures of it.

Old habits: type `BIGBANK`, `KEVLAR`, `ARSENAL`, `COOLOFF`, `HOTHEAD`,
`NIGHTFALL`, `SUNRISE`, `DOWNPOUR`, `CLEARSKY`, `FALCATA` or `BASTION` during play.

## On a tablet

On a touchscreen the game puts its own controls on the glass, laid out the way the phone ports of these
games are. A stick appears wherever your left thumb lands in the lower left: walk with it, push it to the
rim and you run, so running needs no button of its own. Your right thumb drags anywhere on that half of
the screen to look around, and the cluster in the corner is FIRE, AIM, JUMP and ENTER on foot, GAS, BRAKE,
HAND for the handbrake and EXIT in a car, with HORN, RADIO, SIREN and a SHOOT button for drive-bys when
they apply. The radar moves from the bottom-left corner to the top-left, because on a tablet that corner
belongs to the thumb that moves you.

The menus have no keyboard to pick from, so they are tappable: a line in a shop buys it, an option in the
pause menu changes it, a tap anywhere on the pause screen resumes, and the title screen gets a NEW GAME
button where the desktop tells you to press N.

None of this is a second set of controls in the game's own code. The touch layer stands in for a gamepad
and presses keys, so `PLAYER` and `MISSIONS` cannot tell a finger from a keyboard and there is only one
path to test. It turns itself on when the device has a coarse pointer and no fine one, and, whatever it
guessed at load, the first finger on the glass turns it on and the first mouse movement turns it off, so a
tablet with a keyboard folded round it works either way round. `?touch=1` forces it on, `?touch=0` off.

Portrait says to turn the device sideways rather than cramming the cluster into a corner it does not fit.


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

## Getting around

Eleven kinds of car, a motorcycle and a speedboat. The VIPER motorcycle
takes the same tyre model as the cars with a rider who leans into the
corners; a hard stop puts them over the bars, so treat kerbs with respect.
Three SKIMMER boats are moored beside Pier 9 and off the beach. On the water
the rudder needs way on, the hull slides wide through a turn, and the shore
and the pier are walls. You cannot swim: `F` only gets you out of a boat
within a few metres of land, and a boat that sinks under you takes you down
with it. Okafor's last job, SALT WATER, is a boat chase round the island.

## Indoors and off duty

Two doors open. THE HALFWAY, a bar in Northgate, sells whiskey that heals
a little and makes the camera and the steering wander for a while, tips
about where a hidden package is hiding, a round for the room that Marla
hears about, and a jukebox. The safehouse has a bed that saves the game
and a wardrobe with five outfits. Rooms are real geometry sixty metres
under their own lot, with walls the player and the camera collide with
and lamps instead of a sun.

Presentation: each district has its own colour grade that the picture
drifts toward as you cross a boundary; dialogue cuts between shots on
every line, and whoever is speaking moves their mouth; a cruiser's siren
rises as it closes and falls as it pulls away. `P` opens a photo mode
that freezes the world and hands you a free camera; click or `Enter`
saves a PNG.

## Fists, falls and the roof

Every third punch is a kick that does more and puts people down; a bat
from the Ironmonger (or from under the bar) reaches further. Peds flinch
when they are hit. Weapons are drawn in the hand: a pistol, a machine
pistol, a shotgun, a rifle, a launcher, a grenade, the bat and the camera
each have their own model riding the right forearm. Walk off a roof and
you fall; from anything taller than a house it hurts, from Crane Holdings
it kills. A service elevator on the tower's front takes you to its roof,
where a helipad keeps a briefcase, a vest and a launcher. A stunt jump
holds the camera on the ramp and watches the car fly. The Ironmonger
closes from eleven at night to seven. Reach five stars and Crane puts a
price on your head: three crews come for you, one at a time, whenever the
police have lost interest, and each one drops what he paid them.

## What you see on the street

Ground floors are painted from sixteen kinds of shop, two to a tile, each
with its own sign, window and door: bodegas with crates of fruit, diners
with neon and stools, pharmacies with a green cross, laundromats,
bars, pawnbrokers behind bars, bookshops, cafes with chalk menus, barbers,
tattoo parlours, all-night liquor stores, noodle houses with red lanterns,
electronics with a wall of screens, boutiques with mannequins, florists
and bakeries; some fronts are shuttered and flyposted. Every eight
metres of wall takes a different tile drawn from the district's mix, so
a block reads as a row of separate businesses. Upper floors come in
sixteen facade styles with balconies, window boxes, air conditioners,
fire escapes and faded painted adverts on side walls; offices downtown
fly banners, tenements have stoops, Westfield houses have fences and
front gardens. The sidewalks carry cafe tables, crates, sandwich boards,
vending machines, barber poles, bike racks, flower buckets, tyre stacks,
barrels and hot-dog carts with a vendor behind them.

People have a skull and a jaw, eyes with irises and brows, a nose, ears,
eight hair styles from a bun to an afro, beards, open jackets with
lapels over a shirt, cuffs, thumbs and shaped shoes, in fabric colours
rather than paint. Shop names are drawn from a hundred without
repetition across twenty tiles, so no two doors down a street read the
same.

The city is populated by district: suits downtown, hi-vis on the east
side, joggers in Westfield, wool by the water. People carry coffee, bags,
phones and guitars, put umbrellas up in the rain, wait at bus shelters,
stop to look in shop windows and sit on benches. Pigeons feed on the
sidewalks and scatter when you or a car come close, gulls circle the pier
and the docks, manholes steam, litter blows down the street, a plane
crosses now and then, and a ferry runs round the island all day.

## Sound

Everything is still synthesised at runtime, but through a proper chain:
a convolution reverb built from decaying noise, a compressor on the mix,
envelopes with real attacks, and lowpassed buses for the harsher
waveforms. Gunshots are four layers (crack, body, thump, tail), crashes
rattle, explosions crackle with debris. The engine is two detuned saws
and a sub through a soft clipper and a resonant filter, with an exhaust
pulse at the firing rate and gears the note climbs through and drops
between. The siren wails instead of stepping. Your footfalls land on
each half stride, birds sing near the parks, gulls call near the water,
and the radio plays pads, a sliding bass, an electric piano and a real
kit through the tone of a car speaker.

## Feel

On foot you accelerate over a tenth of a second and brake over a
quarter, and the stride lengthens with speed so the feet stay planted
at a walk, a jog and a run; sprinting widens the view. The car camera
swings round quicker, leads into a turn and looks a little down the
road. Hits you land show a marker at the crosshair, kills a red one; car
impacts, explosions and damage shake the camera. Weapons are modelled so
the barrel points where the arm does. Shots are resolved along the
crosshair line rather than from the player's feet (the aim camera sits
half a metre to the side, so the two lines do not coincide), the mouse
slows while you aim and slows further over a target, the crosshair
settles onto anyone you are nearly on and turns red when it has them,
and the aim camera keeps the crosshair near body height. Aim with the
right mouse button, a two-finger click on a trackpad, or by holding
Option/Alt or `C`; fire with a click or `Ctrl`.

Traffic drives like it has somewhere to be. A car decides its turn a
block early and brakes for it before the corner, then follows a circular
arc tangent to both lanes (ten metres for a car, wider for a truck or a
bus, so the kerb corner stays clear) with pure-pursuit steering: the front
wheels are set to the angle that puts the car on the circle through a
point a few metres ahead on its path, damped on yaw rate, so it comes out
of the corner in lane and settles rather than fishtailing. Waypoints
count as reached once they are behind the car, which is what used to send
a car in laps round an intersection when the corner was tighter than its
steering lock.

## Visual direction

The first style pass uses warm sunlight, neutral-blue shade and a hazy coastal
sky, with restrained saturation and bloom. Photographic texture contrast and
normal-map strength are reduced to fit the simpler geometry. Vehicle paint
uses a quieter palette and softer highlights. Shallow stone surrounds give
shop bays real edges and contact shadows; emissive windows retain their painted
detail at night instead of turning into white rectangles.

A second geometry pass separates jacket and shirt silhouettes, fills out sleeves
and trouser thighs, and adds lapels, pockets and a shoulder yoke. Hair wraps the
back of the head and beards face forward; both use the ellipsoid builder's
actual azimuth convention. The existing animation pivots and vehicle seating
heights are retained. `node test/character-geometry.js` checks hair orientation
and the generated high/low-detail meshes.

Facades now have three stable architectural treatments: masonry piers and
corner stones, layered/dentilled cornices, and office fins or broad horizontal
bands. Floor ledges vary in spacing. These details derive from lot coordinates
without consuming city random numbers, preserving generated lot locations.

The HUD uses a compact radar, warm-white cash without leading zeroes, and
wanted stars only during pursuit. Full movement hints remain during the first
thirty seconds and contextual driving/aiming hints remain available; nearby
cars show the entry key, and F1 always opens the controls sheet.

## The look

The city is drawn as much as rendered. An ink pass in the composite reads the depth buffer
and draws a thin dark line wherever depth takes a step or changes slope between neighbouring
pixels — a silhouette or a crease — fainter with distance and gone by 240 m. It is a second
difference, so a flat surface at any angle draws nothing, and it is applied after tone
mapping so a line is a line at any exposure. `E` in the pause menu turns it off, and
`?edges=0` on the URL does the same for a side-by-side.

Colour keeps to a rule. Each district picks its wall tints from a short muted list — cool
greys downtown, warm brick browns midtown, dark reds up north, creams in the suburbs, ochres
east, weathered greys and teals by the water — so accents come from signs, cars and neon
rather than from the walls. Shop signs lost a third of their saturation, car paint a third of
its, the district grades no longer push saturation up, and the grass is a greyer green.

Behind every window pane there is a room. The fragment shader treats each pane of a facade tile
as the opening of a virtual box one pane wide, one storey tall and three metres deep, and
intersects the view ray with it in the wall's tangent frame: you see a back wall, a side wall, a
floor or a ceiling depending on where you stand, with a colour hashed from the room's position, a
cupboard on some back walls, and a brighter interior behind the panes the emissive mask marks as
lit. No geometry is added; the pane's albedo becomes what is behind it and the glass reflection
sits on top. Each windowed tile records its pane grid at build time so the rooms line up with the
painted panes. `?rooms=0` turns it off.

The skyline has a shape. Building heights climb toward the centre of downtown, and a few lots
there carry landmark towers of fifty floors or more with two stepped tiers, a spire and a beacon,
so the city has a silhouette you can navigate by.

Two things fake depth for free: the window painter puts every pane back in the wall, with
its head and one jamb in shadow and a lit sill below, and the static shader darkens the foot
of every wall over the first two and a half metres, the grime any street has. Residential buildings gained a plinth at the base, and tall buildings carry a water tank more
often.

## Night, and the hours either side of it

A lit shop window is what a real street is lit by, so each open front throws a warm wedge across the
pavement that fades out at its edge and carries a short-range light, and the fronts are recorded
during generation from a hash of their position so the seeded layout is untouched. Shops keep hours:
most go dark after eleven and a handful stay lit all night. Those hours drive the spill on the pavement
and the short-range light; the lit windows themselves are one mask over the whole city, which dims
through the small hours and comes back before dawn, because the static mesh carries a single emissive
term rather than one per building.

Closing time nearly did nothing on the streets where it should show most. Only thirteen fronts are lit
at once, for cost, and where more than that are in range -- the busiest block has twenty-four within the
glow radius and twenty-one open of an evening -- every shop that closed was simply replaced by one
further along, so the count stayed pinned at thirteen from eight in the evening until well past
midnight. The limit now scales with the hour, so that block goes from thirteen lit fronts to nine at
half ten and four at two, and its pavement drops thirteen per cent in brightness across the night
instead of holding steady.

The street lamps used to throw a cone of constant brightness, which put a hard-edged slab of light
across half the screen when you stood near one. The shaft now fades to nothing at the ground rim and
fades out as you walk up to it, and the pool underneath is strong enough to actually light the
pavement.

Measuring the same street through the day showed the best light in the game was a spike a few seconds
wide: colour saturation ran 0.13 at noon, reached 0.31 at six in the evening, and was full night by
twenty past. The brightness curve was right, so only the warm horizon term was widened; midday and the
afternoon are exactly as bright as before, and the golden hour now covers the evening rather than a
moment of it.

Under the water the picture turns green-blue and loses most of its colour, the edges close in, the fog
goes dense and uniform, and the sky is not drawn at all: the buffer is cleared to the colour of the
water, which is what the fog fades into, so the whole frame is one body of water. The sea is a
single-sided plane, and without this you looked out at the skyline from the sea bed.

Grass is laid as a grid whose colour varies smoothly across it, some of it greener and some dried out.
The tint is a two-octave value noise of the world position sampled at each corner, so neighbouring
cells agree along their shared edge; a park reads as ground rather than as one flat sheet of green, and
laying it per cell with a single colour each reads as a checkerboard, which is why the corners are
sampled rather than the cells.

Rain leaves the streets wet, and they stay wet. The rain itself fades over about twelve seconds, and
the wetness used to drain away faster than that, so it was pinned to the rainfall and the city was
bone-dry the instant the sky cleared: the separate wetness value never did anything. It now dries over
roughly eighty seconds, which buys a minute of shining streets under a clearing sky.

That exposed a second problem. The wet surface shading had only ever been seen under a rainstorm's
flat grey sky, and in clear daylight it drove the roughness almost to a mirror: the road turned pale,
the asphalt grain went flat and the lane markings dissolved into it. Wet asphalt is a rough mirror,
not glass, so it is now taken to a roughness of 0.26 rather than 0.1. The road keeps its grain and its
markings, and still reads darker and cooler than a dry one, which is what rain actually does to it.

A light on a wet street reflects in it, and that reflection is a streak running back toward whoever is
looking. Each lamp and lit shopfront lays one down the ground toward the camera, fading along its
length and to nothing at its sides. Getting the shape right took three attempts: a single quad of even
brightness reads as a searchlight cast on the ground rather than as anything reflected in it, and
narrowing and dimming it does not help, because the tell is the hard edge, not the width. It is built
instead from a narrow core with flanking strips that fade out sideways, in four segments along its
length so the falloff is a curve. Held against a frame with the streaks switched off, it moves under
one per cent of the pixels.

The markers on the ground — the safehouse, the gun shops, the spray shops — were being built every frame
for every one of them in the city, sixty quads each, whether or not any were within sight. They are now
cut off at seventy-eight metres, which is where the minimap blip takes over as the thing guiding you;
over a sample, ninety-three per cent of the markers asked for were never drawn, and the flat effects
buffer went from a peak of 11,370 vertices on a rainy night street to 7,050. A marker also stops getting
brighter as you walk into it, though it never disappears, so you can still tell you are standing in one.

That buffer had a cliff in it. On overflow it emptied the whole additive list, which puts out every lamp,
shopfront and tracer in the frame at once; and if the alpha-blended list alone exceeded the buffer, the
copy into it threw outright. It now keeps whatever fits and drops the rest a triangle at a time, and the
renderer sizes its own buffer from the one the game fills, so the capacity is set in a single place.

The vigilante job had a hole in it. Wrecking a suspect pays you, raises the level and calls for another one,
but placing one needs a lane between 120 and 260 metres away and gives up after twenty tries. When it gave
up, the wrecked car stayed as the target, so the next frame saw a wrecked target and paid out again — and
again, every frame. Forced to fail, three seconds of it gained 181 levels and $6,588,400. The target is now
cleared before a new one is sought and checked before it is used, so placement simply retries; the same
three seconds now gain one level and one payout. The mission suite forces the failure and asserts it.

Shop names never repeated — each of the sixteen kinds hands out its names once and the tiles are baked with
no name used twice — but the tiles themselves did, and a tile carries two shops, so a wall could read QUICK
STOP, CHECKS CASHED, QUICK STOP. The obvious fix, drawing tiles without replacement, changes how many random
numbers generation spends and so shifts every building, prop and parking space after it. So the draw is left
exactly as it was, and still decides the sidewalk trade outside, while what is actually painted may differ
from what was drawn: a tile already used in the last four along that wall is swapped for one that was not,
chosen from a hash of its position, which costs no random numbers at all. The test is by distance rather
than by wall: keeping a window along each wall line still left pairs facing each other across a corner or a
jog in the frontage, and a repeat reads just as plainly there. Anything already painted within 26 metres on
a wall facing the same way is simply out. Of 2,068 pairs of fronts that close on the same facing, none now
share a tile, against 118 repeats within four before; the whole scan costs 2.9 ms once at generation, and
the city's signature — 572 lots, every prop and parking spot, every named place — is unchanged to the digit.

The clock under the district name was dim grey with a drop shadow, which vanishes against a bright sky. It
and the district name are now drawn with a contour all the way round, so they read over sky, sea or a white
wall.

## What it costs

The simulation step costs 1.08 ms with seventy-one cars and a hundred and forty people, where it cost
3.56 ms. Most of that was garbage: collision circles were an array of arrays built for every pair
tested, the vehicle basis vectors came from getters that allocated on every read in physics, steering
and collision, and several hundred street lamps were allocated as fresh light records every frame and
then sorted with a comparator to pick the nearest thirty-two. The circles are written into a reusable
flat buffer, the basis vectors are locals, the lamps come from a pool, and the nearest thirty-two are
found by bounded insertion. Sampled profiling puts the garbage collector at under one per cent of the
loop afterwards.

Two thirds of the cars in a busy scene are more than ninety-five metres from the camera. Those update
every third frame with three times the step, all on the same frame as each other so they still see one
another consistently; anything the player drives, is chased by, or that is wrecked or airborne runs
every frame, and people beyond sixty metres do the same except police, ragdolls and anyone a mission
cares about. Two minutes of simulation with two thirds of the traffic on the reduced rate leaves no car
inside a building, none stuck and none overlapping another.

Each shadow cascade culls entities to its own box: a car eighty metres away cannot cast into the tight
near cascade, and drawing it there cost a draw call and a skinned mesh for nothing. A street view costs
207 draw calls and 661k triangles a frame, against 248 and 728k.

Of that frame, the two shadow cascades packed into one 4096x2048 atlas take 82 draws and 306k triangles,
and the camera's own pass takes 125 and 355k. Both the chunked city mesh and the entities are culled
against each cascade's own frustum rather than the camera's, so what the shadow pass draws is close to
what it needs; the remaining weight is the city itself, not objects that could be dropped.

The lighting pass was the last place making garbage. Every lamp shaft, ground pool, shopfront wedge, wet
streak and marker built its four corner points as fresh arrays, and a night street draws about a thousand
of those quads a frame — four thousand short-lived arrays, sixty times a second. Because the quad is copied
straight into the vertex buffer as it is passed, one set of scratch corners can be refilled and reused, and
the two warm colours are now constants rather than rebuilt per quad. The rendered frame is unchanged: held
against the previous build it differs by 61 pixels, where two runs of the same build differ by 8,317, since
the rain is random.

The game lowers its own render quality when frames get slow, and used to allow only two restores for the
whole session. That made a few transient stalls permanent: five well-spaced hitches on a machine running
at a hundred frames a second left it at the second-lowest setting, shadows off, with no way back. What
stops it flipping between two settings is now a count of the restores that did not hold — a restore undone
within half a minute was the wrong call, and two of those settle it — rather than a limit on restores as
such. The same five hitches now end at full quality, a machine that genuinely cannot hold the setting
still stops after two attempts, and the decision is a pure function the persistence suite drives directly
with frame-time histories.

The last of the array-of-arrays collision circles went with them. The hot car-to-car pass had already been
moved onto a flat buffer, but a person walking past traffic and the player brushing a parked car still
built three small arrays per car per frame, which at a hundred and forty people is most of a thousand a
second. Both now read the same flat buffer, and the step went from 1.15 ms to 1.08. The ray cast and the
water push still use the array form, which they call rarely.

## Why it looked grey, and what changed

Five things were doing most of the damage, and none of them was the polygon count.

The paving was a play mat. Each slab was given a tint with its red, green and blue picked independently as
full or nothing, so slabs came out magenta, cyan, green and yellow, and once tone-mapped and graded the
bottom half of nearly every frame was mint, lilac and pink squares. Slabs now vary only in shade.

The sun stood almost overhead all day, within 25 degrees of vertical from nine till three, which lights
every wall in a street alike and makes noon look overcast. Its path is flattened so it rakes across the
city at 30 to 45 degrees: one face of each block in sun and the other in shade, shadows reaching across the
road. Only the direction changed; brightness and colour still follow the true height of the sun.

Every district's grade took colour *out* of the picture, at 0.94 to 0.98 saturation, and there was no
contrast curve. The grade is now a gentle S-curve with sunlit tones leaning warm and shade leaning slightly
cool, saturation a little above neutral, a warmer and stronger sun, a real blue sky with a bluish haze,
and more light thrown back into shade so a street in shadow is still bright rather than murky. A first
pass pushed the shade to navy; it was measured and pulled back until the road in shade sat within a
couple of points of neutral.

A corner lot shows the street two faces, and the second carried a single shopfront tile repeated its
whole length: BOUTIQUE, PHONES UNLOCKED, BOUTIQUE, PHONES UNLOCKED down an entire block. Every side of a
commercial lot that stands on the edge of its block now gets its own run of fronts, 808 of them across
the city, chosen from a hash of the position so the seeded layout is identical to the digit. Road and
paving cracks, drawn at 35 to 50 per cent black, read as ink scribbles in the foreground and are now
hairlines; the hard-edged road patches that looked like holes are faint.

The last one is a bug, and probably the one anyone on a tablet saw. When the game lowers its quality
enough to switch post-processing off, the scene is drawn straight to the screen, but the shaders were
still told to write HDR because the GPU was capable of it. They wrote raw linear light with no curve and
no gamma, and the whole game came out dark, crushed and grey. The shaders are now told where they are
actually drawing, and the direct path runs the same exposure, filmic curve and grade as the full one,
from one shared piece of shader code so the two cannot drift apart. The fallback order also changed:
post-processing goes before the shadows, since losing post now costs bloom and occlusion while losing
the shadows costs the whole sense of a sunny street.

## The walk and the run

The old gait took nearly five steps a second at the default pace and seven and a half flat out, with a
long stride on top. Its arms and shoulders were driven by a sine a quarter-cycle ahead of where the feet
actually were, so they peaked while the legs were passing each other, and the hips rolled and swayed as
if to a beat: the disco. The run pushed the upper arms forward with the elbows bent and held out wide,
which is the zombie.

Stride frequency now grows with the square root of speed, about two steps a second for a pedestrian's
stroll, three for the default jog (the default pace, 3.3 m/s, is a jog, as it is in the old GTA games)
and three and three quarters at a sprint; the stride length makes up the rest, and pedestrians and the
player share the function so a planted foot slides back at exactly ground speed. Everything keys off
each foot's place in its cycle. Walking has both feet down for a moment each step and the pelvis vaults
up over the planted leg; running has a flight phase that lengthens with speed, and the pelvis sinks into
the landing and rises in the air. The heel peels up late in the stance and the foot rolls over the toe,
the swing foot tucks up behind and reaches back a little as it lands. The arms swing from the shoulder
opposite the legs, left arm back as the left foot lands, with a soft elbow at a walk and about a right
angle at a run, swinging from behind the body rather than in front of it; the shoulders counter-rotate
the hips and the head cancels the twist. Hip roll and sway are a third of what they were.

## Light and colour

The renderer lights in linear space. Textures and palette colours are authored in sRGB, so they are
decoded on the way in and the composite encodes the result on the way out; skipping that step is what
made the old city look hazy and washed out whatever the textures were. The sun, sky and ground
ambient are physical multipliers on top of that.

Fog is a height fog rather than a plain distance fade: an analytic integral of an exponential density
along the view ray, so haze pools in the streets and thins with altitude and the skyline stays crisp.
Near the sun it warms toward the sunlight, which is what gives a long avenue its depth.

Rain pools on anything facing the sky. The film darkens what is under it and smooths it, so a wet
street goes dark and starts mirroring the sky and the street lamps, and it dries off slowly after the
rain stops. Street lamps also throw a soft pool of light that fades to nothing at its rim.

Windows are subdivided to a curtain wall's real bay, about 1.7 m, rather than the 3.5 m slabs a
four-column texture gave; and a lit window carries its own strength and colour temperature in the
emissive mask, so a tower at night is a grid of bright, dim and dark panes rather than one flat sheet.

Sunlight casts two shadow cascades packed side by side in one depth atlas: a tight box just in front
of the camera for crisp contact shadows and a wide one for the rest, each snapped to a shadow texel so
the shadows do not crawl as you move, and each culled to its own frustum — which makes the two passes
together cheaper than the single wide one they replaced.

Every surface carries a normal map and a roughness map alongside its colour. The tangent frame is
rebuilt in the fragment shader from the screen-space derivatives of world position and UV, so no mesh
stores tangents. Roughness drives the highlight, and a smooth surface also mirrors the sky along the
reflected view ray with a Fresnel edge — which is what makes a glass tower read as glass rather than
a painted grid. Window glass is dark in itself and gets its daylight brightness from that reflection;
the warm glow of a lit window lives in the emissive mask and only shows at night.

## Imported art

Not everything is built in code any more. `js/assets.js` carries a set of
Kenney models converted to flat-shaded vertex-coloured triangles by
`tools/assets/import-glb.py` (sources and licence in
`tools/assets/SOURCES.md`): a pickup (the RANCHER) and a motorcycle (the
HORNET) that join the traffic in the suburbs, the east side and the docks,
with their wheels on the game's wheel bones so they steer and spin; a fountain
on its plaza in every park; and clusters of trees among the park's own.
The trees, bushes, grass tufts and mounds come from the Nature Kit; the
garbage truck, ambulance and fire engine from the Car Kit; a pickup and a
motorcycle from the Starter Kit Racing repository, and the fountain in every
park from the Starter Kit City Builder. A hedge is a dark mass with nine small
foliage clumps along its top rather than one flat slab of green. The converter
samples each model's colour map at every vertex, keeps wheel parts in their
own space so they spin about their centres, flips the winding of mirrored
parts, doubles single-sided foliage so it is not hollow, and remaps
materials by name — Kenney's foliage is a stylised teal, which sits badly in
a photographic city, so it is mapped to something that grows here.

Every painted texture also sits on a photographic base: CC0 materials from
ambientCG, baked by `tools/assets/bake-textures.py` into a colour, normal and
roughness map tiled to the metre scale each texture layer covers. Tiling a
normal map down averages opposing slopes away, so the baker measures what
survives and amplifies it back. The painters draw their own detail — windows,
road markings, shop signs, slab joints — on top, recoloured toward the palette
with restrained photographic contrast so the mortar and grain survive without
overpowering the building shapes.

## Saving and regression checks

Mission completion and the safehouse bed save to browser local storage. Bed
saves restore the room and the time after sleeping. Collected package IDs,
package weapon rewards, and modifications on the car parked at the safehouse
survive reloads. Saves belong to the browser profile and page origin.

Older saves remain readable. Old bed saves without a room identifier resume
outside the safehouse. Package IDs and car upgrades that an older version
never wrote cannot be recovered; the saved package total is retained (capped
at twenty), and its weapon rewards are restored.

Vehicle geometry checks need only Node: `node test/vehicle-geometry.js` checks
window attachment, outward wheel faces, and body/glass damage seams. For visual
inspection, `node tools/playtest/tests/vehicles.js` renders front, rear and
damaged views of six vehicle types into `tools/playtest/pt/vehicles/`; add
`--dist` to inspect the single-file build. These screenshots are for inspection,
not pixel-baseline assertions.

Run `node tools/playtest/tests/persistence.js` to check purchases and repeated
save/load cycles; add `--dist` to test the single-file release. Like the other
browser harnesses, it needs Playwright and Chromium or Chrome. Failures return
a nonzero exit status. The mission and soak harnesses also assert their results;
the mission harness uses teleportation and is not a normal-control playthrough.

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
SEED=4242 node tools/playtest/run.js <name> story 180 --record   # a repeatable bot run: heatmap.png of where it went, inputs.json of what it pressed
node tools/playtest/replay.js <name> [everyGameSeconds]           # play the recording back on the same seed and report whether it landed in the same place
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

The renderer works to keep the GPU's share small. The city is one static
mesh whose triangles are grouped by block into chunks with bounding boxes,
and each frame draws only the chunks inside the camera's frustum, and in
the shadow pass only those inside the light's box, through a vertex
shader variant without skinning. Cars and people outside the view are
neither built nor drawn (except close by, where their shadows can still
fall into the frame), distant people and small props cast no shadow, and
prop instance buffers are rebuilt only when the camera has moved or
turned enough to matter, with a culling margin that grows with distance
so a small turn pops nothing in. A typical street view went from 2.3
million triangles a frame to about half a million. On the simulation
side, building lots are bucketed on a grid for collision queries and a
parked car that has come to rest sleeps until something moves it.

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


### Movement and mission regression checks

The repo job supports three approaches: approach empty-handed and hold **G**
(gamepad **Y**, touch **TALK**) to negotiate, hold aim on the debtor to intimidate
him, or take the car before he notices. Suspicion rises with visible approach
and rises faster when running; gunfire triggers flight. Keeping the car intact
preserves the delivery bonus.

Characters now use stance/swing foot targets with articulated ankles, landing
compression, turn lean, and a short car-entry reach. Mission spawns check the
whole vehicle footprint against buildings, props, and other cars.

Run `node test/character-geometry.js`, `node test/vehicle-geometry.js`,
`node test/gameplay-polish.js`, and `node test/campaign-node.js`.
The campaign audit exercises all 22 mission completion/payout paths, actual
failure/retry transitions, repo approaches, and target clearance. It controls
travel and combat outcomes; it is not a human-speed difficulty playthrough.

Serve the project and open `test/polish-scenes.html?mute=1` for muted, save-free
browser rehearsals. The route buttons simulate actual AI driving for Tailgate
and Harbor Night while repositioning the observer and suppressing escort damage.
`test/character-studio.html?mute=1` previews the production models and poses.
Rebuild the standalone file with `python3 tools/build-single.py`.

The Foundry Quarter spans ten blocks around Voss Motors: Lantern Lane, Laundry Court, Old Foundry and Switchback Deck offer narrow escapes, breakable timber gates and two levels of travel. Space vaults nearby low cover when the landing is clear; otherwise it jumps.

### Imported protagonist preview

`test/character-studio.html?mute=1&character=quaternius` compares the current protagonist with an imported
Quaternius head, hair, eyes and hands. The existing outfit and gameplay rig are retained. To play with the
prototype, open `dist/grift-city.html?mute=1&character=quaternius`; the usual URL keeps the current model.
See [asset provenance and rebuild instructions](tools/assets/HERO-SOURCES.md). The assets are CC0 and embedded
in the release. Facial animation and finger grips remain prototype limitations.
