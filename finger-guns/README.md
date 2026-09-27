# Finger Guns

Seven playable sketches of a casual, fast-paced first-person shooter. Each
one is controlled a different way. It answers the question: what would a
casual, fast FPS look like, and how would you control it? The first six were
the original answer. The seventh, Snapshot, came from a playtest suggestion to
split the screen: the left half moves and turns you, and the right half fires
and centres the view.

Open `index.html` in a browser. It is one file with no dependencies. It loads
Lilita One and Atkinson Hyperlegible from Google Fonts if it can and uses
fallback fonts if not. It plays with a mouse, a keyboard or a touch screen, and
every sketch but Snapshot can be played with one finger. Rounds last a minute
and you get three hearts. Best scores are kept in the browser's local storage.
To jump straight to a sketch, add its name to the address: `#ride`, `#sweep`,
`#beeline`, `#floor`, `#blink`, `#lighthouse` or `#snapshot`. To make a page with just one
sketch and no menu, give the canvas that name as `data-solo`, for example
`<canvas id="game" data-solo="ride">`.

## The problem

Most of what keeps people out of first-person shooters is the controls. A
shooter asks you to do four jobs at once:

- **move**, on two axes (forward and back, and sideways)
- **look**, on two axes (turning, and looking up and down)
- **aim**, which in almost every FPS is the same thing as looking
- **fire**, plus the extras: jump, reload, crouch, switch weapons

On a gamepad that is two thumbsticks working at the same time. With a mouse
and keyboard it is two hands doing unrelated things. Players who grew up with
this don't notice it any more, and newcomers find it very hard to learn. Three
other things make the genre hard to pick up:

- You get lost. The view shows about a quarter of what is around you, and
  whatever is hurting you is usually behind you.
- You need precision under time pressure: small targets and quick reactions.
- Sessions are long and failure is punished: long matches, respawn timers, and
  in multiplayer, opponents who have played for years.

Jesper Juul's *A Casual Revolution* (2010) names five things that make a game
casual: a pleasant fiction, usability, interruptibility, forgiving difficulty
and punishment, and juiciness. Today you could add a sixth: it should work on a
phone held in one hand.

Fast-paced adds its own demands: something is always happening, there is no
downtime, and the game sets the tempo, because players left to themselves tend
to move slowly and carefully in a shooter.

So the design problem is to keep the first-person view and the fun of pointing
at things and popping them, remove most of the control load, and keep the pace
up anyway.

## Who does which job

The main thing to decide is who does each of the four jobs: the player, the
game, or a merger with another job. A standard FPS gives all four to the
player and merges aiming into looking. The sketches take them apart in seven
different ways:

| Sketch | Move | Look | Aim | Fire | Input |
|---|---|---|---|---|---|
| Dark Ride | game (the track) | game (the car turns) | **you** (free pointer) | **you** (click) | point and click |
| Sweep | game (auto-flight) | game (fixed ahead) | **you** (sweep to lock on) | **you** (let go) | hold, drag, release |
| Beeline | **you** (steer) | same as moving | same as moving, with a pull | game (always) | one axis |
| Four on the Floor | **you** (one tile) | **you** (quarter turns) | game (your line) | game (every beat) | four discrete moves |
| Blink | **you** (tap the ground) | **you** (tap sky or marker) | **you** (tap the target) | same tap | one tap, read by context |
| Lighthouse | nobody | game spins, **you** stop it | **you** (timing, with a snap) | **you** (while holding) | one button |
| Snapshot | **you** (left thumb) | **you** (left thumb turns, a tap centres) | **you** (where you tap) | same tap | two thumbs |

The seven fall into four strategies:

1. **The game drives, you shoot.** This is the light-gun and rail-shooter
   arrangement. The key move is separating aiming from looking: a free
   pointer, not a crosshair fixed to the middle of the screen. Once aiming no
   longer needs the camera, the camera can belong to the game.
2. **You drive, the game shoots.** The gun fires by itself, as with the
   auto-fire option in mobile shooters or in auto-attacking games like
   Vampire Survivors. Aiming then comes from where you go or which way you
   face.
3. **One input for everything.** You keep all the jobs, but they share one
   input: a tap whose meaning depends on what it lands on, or a single button
   while the game supplies the motion.
4. **Two thumbs, tap to aim.** The standard phone layout, with a stick under
   the left thumb and the right thumb on the screen, except that the right
   thumb taps where it wants to shoot instead of dragging to aim, and the view
   comes to wherever it fired.

## The seven sketches

### Dark Ride

A fairground ghost train. The car runs along its track at a steady speed,
stops in each room while the pops appear, and turns to face them. You point
and click. A pop that is about to throw something shows a ring that closes on
it, and what it throws can be shot out of the air. A miss breaks your chain.
The ride ends with a big one, and each heart you still have is worth 1,000.

- *Why it's casual:* pointing is something nearly everyone can already do,
  with a mouse or a finger. There is no camera to manage, nowhere to get lost,
  and every attack is announced.
- *Why it's fast:* the ride sets the pace, and rooms don't wait for you
  forever.
- *Where the skill is:* accuracy (the chain), and choosing between the pop and
  the thing it just threw.
- *What's wrong with it:* you don't choose where to go. It needs a lot of
  content, because every room is staged by hand, and a second ride plays much
  like the first unless the route branches. A camera that moves on its own
  makes some people queasy.
- *Relatives:* Duck Hunt, Operation Wolf, Virtua Cop, Time Crisis, The House
  of the Dead, the Buzz Lightyear rides and Toy Story Midway Mania! at Disney
  parks, Pistol Whip in VR.

### Sweep

An automatic flight over a sea at dusk. Enemies fly in, hold formation in
front of you for a few seconds, and swoop past. Hold and draw across them to
lock on to as many as eight, then let go to fire homing darts at all of them.
The score is multiplied by the number of targets in the sweep. Armoured ones
need several passes, and the orbs that come at you can be locked on to as
well.

- *Why it's casual:* a sweep is a big, loose gesture, so shaky aim still
  works, and a lock-on never misses. It feels natural on a touch screen.
- *Why it's fast:* formations overlap, and the multiplier asks you to keep
  holding while things are shooting at you.
- *Where the skill is:* deciding when to let go, and planning a path through a
  formation.
- *What's wrong with it:* there is little sense of place, and it drifts toward
  a shoot-'em-up or a rhythm game.
- *Relatives:* the lock-on lasers of Panzer Dragoon, Rez, Child of Eden.

### Beeline

A run down an endless hall. The gun fires by itself, and its shots bend a
little toward whatever is near the crosshair. You only steer, and you always
face the way you are going. There are blocks and orbs to dodge, gems to pick
up and a triple-shot power-up, and the speed rises through the minute. Only
blocks and orbs cost hearts; running into a pop knocks it away and slows you
down. With a mouse, the pointer's horizontal position sets your heading
directly. Keys and touch drags steer, and the heading springs back to straight
ahead when you let go.

- *Why it's casual:* one axis of control. Setting the heading directly
  (position control) tends to be easier to learn than setting a turning speed
  (rate control), which is what keys and thumbsticks give you. Endless runners
  like Temple Run and Subway Surfers have already taught a very large audience
  this scheme.
- *Why it's fast:* you never stop, and you keep speeding up.
- *Where the skill is:* the line you take. You can't point at everything at
  once, and lining up a target means moving toward it and away from a safe
  path, so every choice is a trade.
- *What's wrong with it:* it is more runner than shooter. The view is always
  forward, so nothing can come at you from the side or behind.
- *Relatives:* Temple Run, Subway Surfers, Space Harrier, Vampire Survivors.

### Four on the Floor

A disco floor laid out as a grid. You turn a quarter at a time and step one
tile at a time, and your blaster fires down the line you are facing on every
beat. Enemies step on the beat too. One that ends up next to you winds up for
a beat: its ring closes exactly on the next beat and its tile turns red. Then
it hits you, unless you have moved away or killed it. Moving close to a beat
keeps your chain alive. The tempo rises from 104 to 136 beats per minute.

- *Why it's casual:* nothing is analogue, so you can never be slightly off
  target. Four directions keep you oriented, and there is a map. The beat
  tells you exactly when things will happen.
- *Why it's fast:* the tempo sets the pace. At 136 BPM there is a beat every
  0.44 seconds.
- *Where the skill is:* positioning, meaning lines and distances and which
  enemy to face first. Rhythm is a bonus.
- *What's wrong with it:* it is the furthest from the shooter fantasy. It is a
  tactics game played at a tempo, and some players will end up watching the
  map.
- *Relatives:* Crypt of the NecroDancer, the grid dungeons of Dungeon Master
  and Legend of Grimrock, BPM: Bullets Per Minute, Metal: Hellsinger.

### Blink

A plaza with pillars, and one kind of input: a tap. What it does depends on
what is under it. On an enemy, you shoot it. On open floor, you dash there,
up to seven floor tiles, facing the same way and unhittable while you dash. On the
sky or a wall, you turn toward it. Enemies you can't see show up as markers at
the edge of the screen, and tapping one turns you to face that enemy. With a
mouse, the cursor shows what a click will do: a target reticle, a ring on the
floor where you would land, or a turning arrow.

- *Why it's casual:* one gesture, and it is always "point at what you want".
  That is the grammar of point-and-click games and of teleport movement in VR.
  Dashing without turning also avoids the queasiness that smooth movement
  causes in some people.
- *Why it's fast:* dashes are instant, and the orbs keep you moving.
- *Where the skill is:* it keeps all four jobs with the player, so it has the
  highest ceiling of the one-finger sketches: positioning, dodging and
  choosing targets.
- *What's wrong with it:* orientation is still hard, and the markers are a
  patch for that. Reading intent from context has the usual problem: near the
  horizon, the floor, a wall and an enemy can be a few pixels apart.
- *Relatives:* teleport movement in VR games, Blink in Dishonored,
  click-to-move in Diablo.

### Lighthouse

Night, on the gallery of a lighthouse. The view turns by itself like the lamp,
and things come in over the water from every side. Hold anything (the mouse,
a finger or the space bar) to stop turning and fire. Let go to keep turning.
Double-tap to reverse the spin. When you stop, the view snaps to a target just
ahead, so the timing is forgiving. A radar in the corner shows what is coming.

- *Why it's casual:* one button, and the game supplies all the motion. This is
  how switch-access interfaces work: the machine scans through the options and
  the person picks the moment. That makes it an accessibility design as much
  as a casual one.
- *Why it's fast:* the spin never stops, and it and the spawns both speed up.
- *Where the skill is:* timing, and choosing which side to deal with first.
- *What's wrong with it:* it is narrow, you never move, and the constant
  turning will bother some players.
- *Relatives:* one-button games like Canabalt and Flappy Bird, scanning
  interfaces for switch users, turret defence games.

### Snapshot

A garden of hedges and topiary, played with two thumbs. The left half of the
screen is a floating stick: push up to walk forward, down to back away, and
sideways to turn, like driving a car. Turning is gentle near the middle of the
stick and fast at the edge, and if you hold the stick hard over it speeds up
again, so you can turn right round in under a second. A tap on the right half
fires exactly where it lands, with a finger's width of slack, and swings the
view to centre that spot, so you can miss, and a miss kicks up a puff where the
shot lands. Holding on a target locks on: you keep firing, the view stays on the
target, and the stick's sideways push becomes a strafe, so you circle it.
Holding on empty space keeps firing straight ahead while you aim with the
stick. Gems around the garden keep your chain alive, which gives you a reason
to move. With a keyboard, W and S move, A and D turn (or sidestep while locked
on) and Space fires.

The first version picked the nearest target for you, so a tap never missed,
and it moved and turned more slowly. After playing it, the requests were for
faster movement, especially turning, and for taps that fire even when they are
going to miss. This version does both.

- *Why it's casual:* it keeps the layout phone players already know, but takes
  out its hardest part, which is aiming by dragging the right thumb. You point
  at what you want to hit, which is the one aiming skill nearly everyone
  already has. The view moves only when you move it, in short, quick swings,
  which matters for anyone who gets motion sick.
- *Why it's fast:* you move and turn quickly, enemies come from all sides in
  waves, and you are always moving, shooting and choosing at once.
- *Where the skill is:* tapping accurately under pressure, movement and
  positioning, which targets to take first, and circle-strafing around the
  ones you are locked on to. The lock gives you circle-strafing without having
  to teach it. The results card shows your accuracy.
- *What's wrong with it:* it needs two hands and a phone held sideways. The
  right thumb can only reach the right half of the screen, so a target on the
  far left needs the stick first. Small, distant targets are hard to hit with a
  thumb.
- *Relatives:* the stick-and-drag layout of Call of Duty: Mobile and PUBG
  Mobile, the tank controls of the early Resident Evil games, the lock-on of
  The Legend of Zelda: Ocarina of Time, and the aim assist that snaps to a
  target on console shooters.

## What they share

The sketches share one toybox, so that only the controls differ:

- **A pleasant fiction.** Nothing dies. The enemies are round, have big eyes,
  and pop into confetti.
- **Readable threats.** Every attack is announced by a ring that closes on
  the attacker, the same device rhythm games use for notes. Anything thrown at
  you is slow and bright.
- **Forgiving aim.** Hit areas are larger than the drawings, and aim assist is
  everywhere.
- **Nothing to manage.** No ammo, no reloading, no weapon switching.
- **Short and forgiving rounds.** Three hearts, one minute, and a restart
  button on the results card.
- **Streaks.** A chain multiplier rewards kills in quick succession. Losing it
  costs only the bonus.
- **Juice.** Confetti, squash and stretch, score numbers, screen shake, and
  pop sounds that climb a scale as your chain grows.
- **One finger.** Every sketch but Snapshot plays with a single finger on a
  touch screen. Snapshot uses two thumbs on purpose.

## Motion sickness

The Lighthouse made at least one player queasy almost at once. That is the
classic trigger: the view keeps rotating while the player's body does not, and
the player didn't cause the rotation, so the eyes and the inner ear disagree
with nothing to warn them.

Snapshot was built with this in mind. Only the player turns the camera, even
at its fastest. A turn toward a tapped spot is a short, quick swing rather than
a slow pan. The
edges of the screen dim a little while the view turns fast, a flat-screen
version of the comfort vignettes used in VR. There is no head bob and no roll.

Others could get the same treatment. Beeline leans into turns and never stops
moving, which will bother some players. A gentler Lighthouse would turn in
discrete steps, like the snap turning used in VR, rather than spinning
smoothly. That might keep the one-button idea without the nausea.

## Comparison

These are my judgements from building the sketches and watching scripted
players run them. Nobody has playtested them yet.

| Sketch | Learning | Skill ceiling | Feels like a shooter | Orientation load | On a phone | Content cost |
|---|---|---|---|---|---|---|
| Dark Ride | instant | low | high | none | good (small targets are hard to tap) | high |
| Sweep | seconds | medium | medium | none | excellent | medium |
| Beeline | instant | medium | medium | low | excellent (one thumb) | low (generated) |
| Four on the Floor | a minute | high | low | low | good (swipes) | low |
| Blink | a minute | high | high | medium | good | low |
| Lighthouse | instant | low | medium | medium (radar helps) | excellent | low |
| Snapshot | a minute | high | high | medium | good (two thumbs, held sideways) | low |

## Where I'd go next

- **Beeline** looks like the best bet for phones. It uses one thumb, never
  stops, its levels are generated, and endless-runner players already know how
  it works. Its weakness (nothing comes from behind) is also what keeps it
  casual.
- **Blink** looks like the best bet for a real FPS for newcomers. It keeps all
  four jobs with the player and still plays with one finger. It needs a better
  answer to what is behind you. One idea: turn toward the most urgent threat
  after each kill.
- **Sweep** has the best feel moment to moment on a touch screen, and the most
  expressive gesture.
- **Snapshot** is the closest to a mainstream phone shooter, and the easiest to
  imagine turning into one. Taps used to snap to the nearest target and never
  miss; now they fire where they land. The thing to find out with real players
  is how much slack a thumb needs before missing stops being fun.
- Combinations are worth trying: Dark Ride's staged rooms with Sweep's lock-on
  (which is more or less Rez), Blink with its dashes snapped to Four on the
  Floor's beat, or Lighthouse as a one-switch mode for any of the others.

Questions for a playtest:

- How long until the first kill?
- How many hearts are lost in the first round?
- Do players ask how to turn around?
- Do they notice that they never touch the camera in Dark Ride?
- How do they hold the phone?
- Which sketch do they replay without being asked?

## Controls

| Sketch | Mouse | Touch | Keys |
|---|---|---|---|
| Dark Ride | point and click | tap | none |
| Sweep | hold, drag across, release | the same | none |
| Beeline | pointer left and right sets the heading | drag left and right | ← → or A D |
| Four on the Floor | click the left, right, top or bottom of the screen | swipe, or tap those areas | ← → turn, ↑ ↓ step, Q E sidestep |
| Blink | click (the cursor shows what will happen) | tap | Q E turn, Space turns around |
| Lighthouse | hold the button | hold a finger down | hold Space |
| Snapshot | drag on the left half; click on the right half to fire there (anywhere once you use the keys) | left thumb: stick; right thumb: tap to fire where you tap, hold to keep firing | W S move, A D turn (sidestep when locked on), Space fires |

In every sketch, **M** mutes and **Esc** pauses.

## How it's made

It is one HTML file. The walls are drawn by a grid raycaster, the technique
from Wolfenstein 3D: one strip of screen columns at a time, which also fills a
depth buffer with one entry per column. The floor is a flat colour with lines
and tiles projected onto it, fogged with a gradient from the horizon.
Everything else (the pops, the orbs, the confetti, the pickups) is a flat
billboard drawn with canvas shapes, sorted far to near and clipped to the
columns where it is in front of the walls. There are no image assets. The
sounds, including Four on the Floor's kick, hats, claps and bass line, are
synthesised with WebAudio.

Each sketch is a small module with `setup`, `update`, `render` and input
handlers. They share the renderer, the enemies, the scoring and the menu.
Blink and Snapshot also share their arena enemies. Snapshot takes every finger
on the screen; the others follow one at a time. The
card thumbnails are rendered by the same code, by running each sketch for a
few seconds with nobody playing. `window.fingerGuns` exposes a small handle
(`start(id)`, `foes()`, the game state) that the automated playtests in
development used.
