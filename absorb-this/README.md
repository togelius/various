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
- **WASD** or arrow keys to move, **Space** to jump, **Shift** to dash
- **1 / 2 / 3** or the **mouse wheel** to switch weapons
- **G** cycles the glass distortion: murky, clean, none
- **M** mutes, **Esc** pauses

## What's in it

- **Weapons.** The Squirter (tap water, never runs out), the Ice Shotgun (ten
  shards, lots of knockback) and the Seltzer Launcher (explosive fizzy cans,
  good for rocket jumping).
- **Enemies.** Hopping sponges that latch on and drink your dampness. Hot sauce
  bottles on stubby legs that lob sauce, which splashes onto the screen and
  leaves burning puddles. Flying spoons that circle, wind up and lunge. Every
  fifth wave Grandma Sponge shows up: huge, in spectacles, squeezing out
  spongelings, and she splits in two when she dies (and they split again).
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
