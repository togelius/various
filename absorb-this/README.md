# Absorb This

A fast, violent and fairly stupid first-person shooter set on a kitchen
counter. It's based on a photo taken through the bottom of a drinking glass:
a weathered wooden counter, a green-and-yellow scrub sponge, tall brown
bottles, a pink label, a spoon.

You are DRIP, the last drop of water in the glass. The sponges want to drink
you, the hot sauce bottles want to dilute you, and the spoons want to stir you
into somebody's tea. Your health is called DAMPNESS.

Now the counter is a **very long kitchen**: five districts, ten waves, and a
sink at the far end. Get there, clear the final kitchenware, and pull the plug.
The kitchen will call it a successful transfer of responsibilities.

Open `index.html` in a browser. It is one file with no dependencies, written in
raw WebGL2. It loads Bangers and Nunito from Google Fonts if it can and uses
fallback fonts if not. Your best score is kept in the browser's local storage.
It plays with a mouse and keyboard or on a touch screen (iPhone, iPad, Android).

## Controls

On a phone or tablet: drag on the left half to move, drag on the right half to
look (or drag from the FIRE button to aim while shooting), and use the buttons
for jump, dash, puddle and swapping weapons. A surrender button appears when a
sponge has you, and a pull-the-plug button appears at the cleared drain.
Pause holds the glass, sound and voice settings. Either orientation works.
On the death screen there's a box to type *please* into.

With a keyboard and mouse:

- **Mouse** to look, **click** to shoot (click the page first to capture the
  mouse)
- **WASD** or arrow keys to move, **Space** to jump, **Shift** to dash (you
  can't be hit mid-dash)
- Hold **right mouse** or **C** to become a puddle
- Hold **E** while a sponge has you to surrender to it
- At the sink, clear its two waves and hold **E** over the drain to escape
- **1 / 2 / 3 / 4** or the **mouse wheel** to switch weapons
- **G** cycles the glass distortion: murky, clean, none
- **M** mutes everything, **V** switches Žižek's voice between accented,
  plain English and off, **Esc** pauses

## What's in it

- **The long kitchen.** A continuous 360 × 43 counter, over five times the
  original length. Clear two waves in each district to roll up its dishcloth
  barrier, then follow the gold arrows to the next checkpoint. The route
  display names your district, shows the objective, and points to your next
  destination. Entering a district restores at least 80 dampness and starting
  ammunition. The five stops are:
  - **The Spill:** the original sponge hive, bottles and spoon, now the start
    of a much longer problem.
  - **Breakfast Republic:** a giant mint toaster, coffee, DOUBT FLAKES cereal,
    biscuit steps and a low cutting board. Slide underneath in puddle form,
    or take a ketchup launch onto the toaster for supplies.
  - **The Hot Take:** four cycling hotplates around an oversized orange
    kettle. Watch the heat, jump the burners, or take the outer lane.
  - **Dishcourse:** a towering plate rack, climbable plate stacks and a knife
    bridge, with a wet fast lane below and another ketchup launch above.
  - **The Sink of History:** a recessed basin, rippling water, soap bubbles,
    a working refill tap and the plug that ends the journey.
- **An escape ending.** Clear wave ten and hold the plug for 1.5 seconds to
  go DOWN THE DRAIN, bank 10,000 points, and record your time. You can start
  another spill or choose STAY & MAKE A BIGGER MESS: endless mode continues
  at wave eleven, opens every checkpoint, and spawns encounters near you.
- **Slavoj Žižek.** A cartoon parody of the philosopher (drawn in code, every
  line made up) pops up in the corner to comment on what you're doing: your
  first kill of each enemy, googly shots, multi-kills, rocket jumps, standing
  still, drinking your own spilled water. His label changes every time
  (ŽIŽEKBOT 3000, CECI N'EST PAS UN ŽIŽEK, ...). He sniffs, touches his nose
  and tugs his collar. Now and then the game nearly stops, loses its colour and
  music, and he fills the screen to ask: "You think this is a joke?" He also
  hangs on the back wall as a Magritte-style poster that moves its mouth when
  he talks. Shooting it costs you points.
- **The writing.** About 1,640 invented philosopher lines across 82
  situations and topics (at least nine for each), after most of the lines
  cut in an early curation pass went back in and a further batch was
  written for every situation. There are also 107 name tags, 82 title
  taglines, 204 news headlines, 103 wave names, rotating slogans on the
  kitchen signs, and taunts, kill words and combat shouts for every enemy.
  The kitchen has
  its own petty politics: sponges privatise your puddles, airborne bubble
  prisoners form a residents' association, and surface tension screens
  calls from the abyss. New jokes react to nearby sponges drinking water,
  three or more trapped enemies, edge rescues and your third PLEASE
  continue. Ordinary commentary keeps its cooldown; the theatrical
  interruptions, shouting and mess stay. Random picks skip whatever came up
  recently. District arrivals get their own commentary; cereal packaging,
  workplace notices and checkpoint signs carry more jokes. The four endings
  have their own closing text.
- **The Fork story.** Counter News Network starts with rumours and denial.
  When the Fork actually arrives, the experts revise their statements;
  when it dies, they claim they were right all along. The philosopher also
  has excuses after the revelation. This history survives PLEASE continues
  and starts over with a new run.
- **Difficulty.** Each of the first six waves adds one new thing: sponges,
  hot sauce, spoons, a bigger mix, Grandma, then the paper towel and the wave
  modifiers. After that about three more enemies arrive each wave. The
  journey ends after wave ten unless you opt into endless mode. Clearing a
  wave restores 30 dampness. The "you think this is a
  joke?" freeze comes on wave 3 and then at most every three minutes.
- **Voices.** Everything is read aloud by the browser's speech synthesis at
  one and a half times normal speed. Apple's speech engine (Safari, and every
  browser on iPhone and iPad) runs much faster at the same setting, so there
  it uses 1.1. The SPEECH button in the options cycles SLOW, NORMAL, FAST and
  ASSAULT, and remembers your choice. The announcer gets a high-pitched
  English voice. Žižek gets a low pitch and the most Slavic voice your system has installed (Slovenian,
  Croatian, Czech, Polish, Russian, ...), reading English with that language's
  pronunciation, which gives him an accent. If there's none he uses English.
  The pause screen shows which voice he got.
- **Žižek's challenges.** Timed dares with a bonus: don't shoot for six seconds
  (I WOULD PREFER NOT TO), eight kills in twelve seconds (ENJOY!), knock
  something off the counter, three googly shots, stay a puddle, soak up your
  own puddles.
- **Wave modifiers.** From wave 6 a wave may come with conditions: the tap is
  left on (it rains water), moon kitchen (low gravity), googly overload
  (enormous eyes), caffeinated (everything faster), kitchen rave (hue-cycling
  strobes and lasers) or fun size (tiny sponges, twice as many).
- **Moving like water.** The Squirter is made of you: every shot costs a
  little dampness, and the water you spill stays on the counter as puddles you
  can soak back up. Sponges drink them too, and it heals them. Hold right mouse
  or C to flatten into a puddle: low, slippery and fast, faster still over
  spilled water.
- **A visible liquid body.** DRIP grips the weapons with glossy streams of
  water that form fingers, stretch during a dash and thin out as dampness
  falls. The squirter pulses, the shotgun grows ice crystals, and the soap
  nozzle flexes as it fires. Puddle form draws the weapon down into the spill.
- **Expressive kitchenware.** Rounded sponges compress before hopping;
  bottles wind up and rattle their caps; spoons flash a ring before lunging.
  The googly eyes blink and catch the light, and Grandma has open spectacle
  rims. Warm wood, cool reflective water and matte sponge surfaces have
  different finishes. Glass starts in the lighter setting; G still cycles
  through all three looks.
- **Infinite continues, if you ask nicely.** On the death screen, type PLEASE
  to return to the current district's checkpoint and retry that wave, keeping
  your score and the Fork's history. If you've already cleared the district,
  its exit stays open. You return with fresh dampness and usable ammunition.
- **Surrender.** When a sponge has latched onto you, hold E to stop fighting.
  That's the third ending. The death screen tracks which of the four endings
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
  From wave 6 the Quicker Picker-Upper rolls down the counter: a giant paper
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
- **Ketchup packets** launch you onto the big sponge, the toaster, or the
  dish route. You can also bounce off sponges' heads.
- **Scoring.** Kill combos raise a multiplier, and quick kills in a row call
  out multi-kills (DOUBLE DIP, TRIPLE SCRUB, ... DISHPOCALYPSE). An announcer
  reads them in a very deep voice using the browser's speech synthesis, if it
  has one.

## How it's made

There are no external image assets. Everything is procedural meshes—rounded
boxes, cylinders, spheres, rings and arches—and the
surfaces are painted in the fragment shader: wood grain along the planks, the
sponge's pores and scouring pad with the serrated seam between them, brown
glass with etched white script, the pink label, tiles. Shadows are soft blobs.
Gibs, bubbles, sauce and water are instanced particles, and splats stay on the
counter as stains. Signs and packaging are painted into canvas textures.
Distant props are culled as you travel along the kitchen.

The scene is drawn to an offscreen buffer. A final pass bends it the way the
glass bottom in the photo does, with chromatic fringing, blurred thick glass at
the edges and bright refraction arcs along the bottom. The same pass does the
sauce splats that drip down the screen, the sponge-pore vignette while you are
being absorbed, and the damage ripples. Render resolution drops on slow
machines and comes back on fast ones; add `?scale=0.5` to the URL to fix it.

Sound is all WebAudio: synthesized squirts, squishes, shattering glass, spoon
tings, and a polka-metal loop (oom-pah bass, kick drum, a square-wave
accordion) that plays the melody only while enemies are alive.

## Checking changes

Serve the repository locally, for example with `python3 -m http.server 8000`,
then open `http://localhost:8000/absorb-this/tests/` and click **Run checks**.
The dependency-free browser suite runs the actual simulation and WebGL
renderer in a muted frame with an in-memory save store. It covers the full
ten-wave progression (including boss splitting), checkpoint continues,
gates, hotplates, tap, drain ending, endless mode, and movement through the
low board, launch routes and full counter. It does not replace playing the
encounters to judge difficulty and feel.
