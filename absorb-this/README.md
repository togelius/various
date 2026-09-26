# Absorb This

A fast, violent and fairly stupid first-person shooter set on a kitchen
counter. It's based on a photo taken through the bottom of a drinking glass:
a weathered wooden counter, a green-and-yellow scrub sponge, tall brown
bottles, a pink label, a spoon.

You are DRIP, the last drop of water in the glass. The sponges want to drink
you, the hot sauce bottles want to dilute you, and the spoons want to stir you
into somebody's tea. Your health is called DAMPNESS.

Open `index.html` in a browser. It is one file with no dependencies, written in
raw WebGL2. It loads Bangers and Nunito from Google Fonts if it can and uses
fallback fonts if not. Your best score is kept in the browser's local storage.
You need a mouse and keyboard.

## Controls

- **Mouse** to look, **click** to shoot (click the page first to capture the
  mouse)
- **WASD** or arrow keys to move, **Space** to jump, **Shift** to dash (you
  can't be hit mid-dash)
- Hold **right mouse** or **C** to become a puddle
- Hold **E** while a sponge has you to surrender to it
- **1 / 2 / 3 / 4** or the **mouse wheel** to switch weapons
- **G** cycles the glass distortion: murky, clean, none
- **M** mutes everything, **V** switches Žižek's voice between accented,
  plain English and off, **Esc** pauses

## What's in it

- **Slavoj Žižek.** A cartoon parody of the philosopher (drawn in code, every
  line made up) pops up in the corner to comment on what you're doing: your
  first kill of each enemy, googly shots, multi-kills, rocket jumps, standing
  still, drinking your own spilled water. His label changes every time
  (ŽIŽEKBOT 3000, CECI N'EST PAS UN ŽIŽEK, ...). He sniffs, touches his nose
  and tugs his collar. Now and then the game nearly stops, loses its colour and
  music, and he fills the screen to ask: "You think this is a joke?" He also
  hangs on the back wall as a Magritte-style poster that moves its mouth when
  he talks. Shooting it costs you points.
- **The writing.** About 1,400 candidate lines were drafted for this version
  and cut down hard: 210 Žižek lines stayed (about 100 of general commentary,
  plus one to three for each situation: the challenges, the modifiers, the
  Fork, the endings), along with 42 name tags, 21 title taglines, 53 ticker
  headlines, a wave name for each of the first 21 waves, and new kill words
  and taunts for every enemy. Each of the three endings has its own narration
  and quotes, picked at random each time.
- **Voices.** Everything is read aloud by the browser's speech synthesis at
  one and a half times normal speed. The announcer gets a high-pitched English voice. Žižek gets a
  low pitch and the most Slavic voice your system has installed (Slovenian,
  Croatian, Czech, Polish, Russian, ...), reading English with that language's
  pronunciation, which gives him an accent. If there's none he uses English.
  The title screen shows which voice he got.
- **Žižek's challenges.** Timed dares with a bonus: don't shoot for six seconds
  (I WOULD PREFER NOT TO), eight kills in twelve seconds (ENJOY!), knock
  something off the counter, three googly shots, stay a puddle, soak up your
  own puddles.
- **Wave modifiers.** From wave 4 a wave may come with conditions: the tap is
  left on (it rains water), moon kitchen (low gravity), googly overload
  (enormous eyes), caffeinated (everything faster), kitchen rave (hue-cycling
  strobes and lasers) or fun size (tiny sponges, twice as many).
- **Moving like water.** The Squirter is made of you: every shot costs a
  little dampness, and the water you spill stays on the counter as puddles you
  can soak back up. Sponges drink them too, and it heals them. Hold right mouse
  or C to flatten into a puddle: low, slippery and fast, faster still over
  spilled water.
- **Infinite continues, if you ask nicely.** On the death screen, type PLEASE
  to continue from the wave you died on, keeping your score.
- **Surrender.** When a sponge has latched onto you, hold E to stop fighting.
  That's the third ending. The death screen tracks which of the three endings
  you've found.
- **Noise.** A Counter News Network ticker along the bottom, enemies shouting
  puns, splish-splosh hit words, style ranks from D (DAMP) up to SSS (SPLISH
  SPLASH SUPREME), and a lot of puns.
- **Weapons.** The Squirter (tap water, costs you a little dampness per
  shot), the Ice Shotgun (ten shards, lots of knockback), the Seltzer Launcher
  (explosive fizzy cans, good for rocket jumping) and the Suds-O-Matic, which
  traps enemies in soap bubbles that float up and drift. Water and ice push a
  bubble around; fizz pops it. Pop one over the floor, or push it past the
  edge, and whatever's inside falls to the kitchen floor.
- **Enemies.** Hopping sponges that latch on and drink your dampness. Hot sauce
  bottles on stubby legs that lob sauce, which splashes onto the screen and
  leaves burning puddles. Flying spoons that circle, wind up and lunge. Every
  fifth wave Grandma Sponge shows up: huge, in spectacles, squeezing out
  spongelings, and she splits in two when she dies (and they split again).
  From wave 4 the Quicker Picker-Upper rolls down the counter: a giant paper
  towel roll that soaks up every puddle, flattens anything in its way and
  flings you. A golden sponge (the sublime object) sometimes appears, runs
  away and is worth 5,000. And on wave 7, after the whole game has insisted
  there is no fork, the Fork arrives. It stabs three times in a row and calls
  in spoons.
- **Googly eyes.** Every enemy has them, the pupils have physics, and shots to
  the eyes do extra damage ("GOOGLY SHOT!").
- **The edge.** The front of the counter is a drop to the kitchen floor. Knock
  enemies off it for double points ("COUNTER-STRIKE!"). You can go over too,
  if a blast or a jump takes you there. On foot, surface tension holds you at
  the edge unless you walk off on purpose.
- **Ketchup packets** launch you onto the top of the big sponge. You can also
  bounce off sponges' heads.
- **Scoring.** Kill combos raise a multiplier, and quick kills in a row call
  out multi-kills (DOUBLE DIP, TRIPLE SCRUB, ... DISHPOCALYPSE). An announcer
  reads them in a very deep voice using the browser's speech synthesis, if it
  has one.

## How it's made

There are no image assets. Everything is boxes, cylinders and spheres, and the
surfaces are painted in the fragment shader: wood grain along the planks, the
sponge's pores and scouring pad with the serrated seam between them, brown
glass with etched white script, the pink label, tiles. Shadows are soft blobs.
Gibs, bubbles, sauce and water are instanced particles, and splats stay on the
counter as stains.

The scene is drawn to an offscreen buffer. A final pass bends it the way the
glass bottom in the photo does, with chromatic fringing, blurred thick glass at
the edges and bright refraction arcs along the bottom. The same pass does the
sauce splats that drip down the screen, the sponge-pore vignette while you are
being absorbed, and the damage ripples. Render resolution drops on slow
machines and comes back on fast ones; add `?scale=0.5` to the URL to fix it.

Sound is all WebAudio: synthesized squirts, squishes, shattering glass, spoon
tings, and a polka-metal loop (oom-pah bass, kick drum, a square-wave
accordion) that plays the melody only while enemies are alive.
