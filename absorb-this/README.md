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

The kitchenware now has problems with **each other**, too. Dodge a bottle's
shot and it can start a feud with a sponge. Waterlogged sponges stake little
flags beside their claims and quarrel with neighbours. Paper towels swallow
water, slow down, leak it back out, and flatten the parties to the dispute.
The news calls this progress. Everything is still a silly shooter: ordinary
running, missed shots and general panic can start the accidents.

**Counter News Network now has a sports department.** After a wave, it replays
a recorded highlight in slow motion, then holds the impact while Žižek offers
an unsolicited interpretation. Accidents, cascades and ice bowling take
precedence over ordinary kills. The live kitchen waits, and you can skip or
pause the broadcast. The notebook keeps the last five clips and a complete
transcript of presenter and philosopher remarks, including interrupted lines.
Muted commentary appears immediately. Choose **REPLAYS: NOTEBOOK ONLY** in the
settings if you prefer to watch later.

Lethal ice shots also leave a short-lived frozen body. It keeps sliding,
bounces off clutter, and can bowl over another enemy. Shoot it with water to
give it another shove. Its kill already counts; it never holds up the wave.

Open `index.html` in a browser. It is one file with no dependencies, written in
raw WebGL2. It loads Bangers and Nunito from Google Fonts if it can and uses
fallback fonts if not. Your best score is kept in the browser's local storage.
It plays with a mouse and keyboard or on a touch screen (iPhone, iPad, Android).


**Graphics.** Raw WebGL2. The scene renders into a half-float HDR buffer
where the device supports it (8-bit otherwise), then a post pass adds bloom
from the buffer's mipmaps, a filmic (ACES) tone curve, a light grade with
cool shadows and warm highlights, faint film grain, and the glass-bottom
distortion. The sunlit lighting mode has a shadow-mapped sun, warm bounce
light off the counter, contact darkening where things meet it, soft wrap
lighting on sponges and cloth, rim light on the characters, an oiled-wood
counter, and a room that now continues behind you: painted plaster, a
tiled wainscot, windows and pictures.

## Controls

On a phone or tablet: drag on the left half to move, drag on the right half to
look (or drag from the FIRE button to aim while shooting), and use the buttons
for jump, dash, puddle and swapping weapons. A surrender button appears when a
sponge has you, and a pull-the-plug button appears at the cleared drain.
Look closely at small curious kitchenware to reveal **EXAMINE**. Reading pauses
the fight. The pause screen also holds your **COUNTER CULTURE** notebook,
glass, lighting, sound and voice settings. Either orientation works.
On the death screen, tap **PLEASE · KEEP MY PROGRESS**, or type *please* into
the box.

With a keyboard and mouse:

- **Mouse** to look, **click** to shoot (click the page first to capture the
  mouse)
- **WASD** or arrow keys to move, **Space** to jump, **Shift** to dash (you
  can't be hit mid-dash)
- Hold **right mouse** or **C** to become a puddle
- Hold **E** while a sponge has you to surrender to it
- At the sink, clear its two waves and hold **E** over the drain to escape
- **1 / 2 / 3 / 4** or the **mouse wheel** to switch weapons
- **F** examines curious kitchenware when LOOK CLOSER appears; **J** opens
  your discovery notebook. **Esc** returns from reading.
- **G** cycles the glass distortion: murky, clean, none
- **M** mutes everything, **V** switches Žižek's voice between accented,
  plain English and off, **Esc** pauses
- During a replay: **Space** or **click** skips, **Enter** pauses/resumes,
  and **Esc** holds the broadcast. Touch screens have pause and back buttons.
  Find **COUNTER NEWS CATCH-UP** inside the notebook to watch again or read
  the full transcript. Clips and transcripts last for this run, including
  PLEASE continues; they are not saved after reloading the page.

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
- **Counter Culture.** Twenty hidden philosopher kitchenware encounters, four
  per district, with bespoke procedural models, animated eyes, tiny plaques,
  original dialogue and extra jokes in the small print. Occam carries a meat
  cleaver; Russell has a teapot; Kant is a grater playing Call of Duty. There
  are seventeen more acquaintances in corners, on elevated routes and under
  clutter. Some require puddle form. Look closely and press **F** (or tap
  **EXAMINE**) to pause the action and rotate the object in a lit close-up.
  **J**, or the title/pause notebook button, opens your field notes. Undiscovered
  entries offer optional hints without naming their occupants. Discoveries
  stay in this browser across new runs; each is worth 250 curiosity points
  once per run, and PLEASE keeps that record. None are required to escape.
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
- **The writing.** About 1,990 invented philosopher lines across 109
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
- **Voices.** Everything is read aloud by the browser's speech synthesis,
  by default at 1.2 times normal speed (1.0 on Apple's much faster engine:
  Safari, and every browser on iPhone and iPad). Lines are spoken sentence
  by sentence, with a little intonation: exclamations lift, questions rise,
  short interjections get emphasis, and Žižek speeds up slightly as he gets
  carried away. Stage directions and dots are turned into pauses, and
  shouted words are read rather than spelled out. The SPEECH button in the options cycles SLOW, NORMAL, FAST and
  ASSAULT, and remembers your choice. The announcer gets a high-pitched
  English voice. Žižek gets a low (but not crushed) pitch and the most Slavic voice your system has installed (Slovenian,
  Croatian, Czech, Polish, Russian, ...), reading English with that language's
  pronunciation, which gives him an accent. If there's none he uses English.
  The pause screen shows which voice he got.
- **Žižek's challenges.** Timed dares with a bonus: don't shoot for six seconds
  (I WOULD PREFER NOT TO), eight kills in twelve seconds (ENJOY!), knock
  something off the counter, three googly shots, stay a puddle, soak up your
  own puddles, three kills each a different way (THESIS, ANTITHESIS,
  SYNTHESIS), or four ice kills (THE COLD WAR, which tops up your ice).
- **Wave modifiers.** From wave 6 a wave may come with conditions: the tap is
  left on (it rains water), moon kitchen (low gravity), googly overload
  (enormous eyes), caffeinated (everything faster), kitchen rave (hue-cycling
  strobes and lasers), fun size (tiny sponges, twice as many), the greasy
  counter (you skate on foot, puddles surf everywhere, kitchenware slides
  off edges, and every sponge arrives greasy, so bring soap) or vibrant
  matter (new materialism: the pickups have agency and scuttle away from you).
- **Favourite foes.** The philosopher keeps a rogues' gallery of 24
  nemeses, about 12 jabs each: Derrida, Deleuze, Fukuyama, Habermas, new
  materialism (this is what happens when you make objects primary in your
  ontology: they rise up and kill you), Western Buddhism, liberal tolerance,
  ethical coffee, Baudrillard (awkward, for a simulacrum), postmodernism, the
  lobster school of self-help, Chomsky, positivism and neuroscience, Rand
  (the golden sponge is her hero), Foucault, Heidegger, Nietzsche, tech bros
  (he jabs at his own makers), Hollywood endings, self-help, and imaginary
  foes: the smart fridge and the dishwasher, the fridge-magnet ŽIŽEKBOT who
  "sticks better", rival academics, and the dog, who is the end of history.
  Each run picks a nemesis, announced on the ticker, that he keeps coming
  back to. Jabs make up most of his idle chatter, can replace routine
  commentary, and kills sometimes set off a fitting one (the golden sponge
  draws Rand, the paper towel Fukuyama, Grandma Nietzsche's eternal
  recurrence). Kill words, taunts, name tags, headlines and wave names join
  in (DECONSTRUCTED!, UNDER ERASURE!, OF GRAMMATOLOGY (AND GREASE)). Once a
  run, the "you think this is a joke?" freeze can turn into a confession: he
  is the biggest sponge in the kitchen, absorbing everything and dripping
  mixed ideology.
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
- **Sunlit kitchen.** Scenery casts soft-edged directional shadows across
  the counter. Pendant lights warm the room, hotplates throw orange light
  onto nearby objects, and water and metal catch window-shaped reflections.
  The sink has moving ripples and caustic highlights; dust drifts overhead.
  Title and pause options include **LIGHTING: SUNLIT / CLASSIC**. Classic
  retains the previous lighting and skips the shadow-map pass.
- **Infinite continues, if you ask nicely.** On the death screen, type PLEASE
  to return to the current district's checkpoint and resume that wave, keeping
  your score and the Fork's history. If you've already cleared the district,
  its exit stays open. You return with fresh dampness and usable ammunition.
  There is also a **PLEASE** button. The unfinished fight now keeps your work:
  defeated enemies stay defeated, bosses keep their wounds, and only the
  remaining reinforcements arrive. You return with full ammunition and three
  seconds of protection. The kitchen even remembers who was arguing with whom.
  Clicking elsewhere to start a new spill remains available.
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

## The kitchen has other problems

All the existing commentary, philosophical acquaintances, enemy types and
endings are still here. These additions give them more opportunities to make
a mess:

- **Friendly fire and grudges.** Sauce can hit kitchenware. The offended
  creatures temporarily pursue and attack each other; a bottle can become
  the target of its own argument. Grudges wear off, and dead opponents do
  not leave anyone standing around waiting for an apology.
- **Private puddles.** Drinking still heals sponges. It also makes them
  bloated and slower. A sufficiently soaked sponge plants a little flag,
  guards its claim for a while, and picks disputes with nearby sponges.
  Squashing or destroying a water-filled enemy returns water you can soak up.
  Bouncing on one can wring some out, too.
- **Trickle-down, unfortunately literal.** A paper roll collects water and
  gets heavier. A loaded roll leaves a wet wake; destroying it releases its
  reserves. The old habit of flattening smaller enemies remains intact.
- **Shared kitchen hazards.** Ketchup packets can launch pursuing creatures.
  A hotplate can scorch and toss an enemy, wringing out some stored water.
  The kitchen's physical arguments now apply to more participants.
- **The airborne peerage.** Nearby soap bubbles share motion. Popping one can
  set off a delayed cascade through its neighbours. Their occupants acquire
  extravagant titles, with very little preparation for descending again.
- **Institutional memory.** New headlines and philosopher reactions refer to
  incidents that actually happened, including repeat offenders and former
  puddle proprietors. Open the notebook and expand **MINUTES OF THE
  DISAGREEMENT** to read the latest 48 reports from this spill. PLEASE keeps
  the record; a new spill starts another set of allegations.

The campaign is also more forgiving. Ordinary impacts do less damage and
briefly protect you from another hit; overlapping sponges share a limited
absorption rate. Heat, sauce and self-inflicted fizz are gentler. Dash,
puddle, weapons and movement use the same controls. No dispute is a quest,
and no philosophical position is a required answer.

## The right tool for the job

You can no longer finish the campaign comfortably with the Squirter and
never lie down. Each tool and ability now has a situation it is good for,
and the game tells you once, in the feed and in Žižek's voice, the first
time you use the wrong one. After that the hit marker keeps telling you:
small and grey when the target resists, big and gold when you've picked
the right tool.

- **Counters.** The paper towel drinks water (and gets heavier and slower
  for it); fizz tears it and ice works. Stove rolls can cross glowing
  hotplates for TOAST. Glass bottles shrug off water and shatter under ice.
  A soaked sponge drinks your shots, so freeze it. Spoons chill quickly.
  Grandma sips water and splits faster under fizz. From the stove onwards
  some sponges arrive **greasy**: water and ice skid off, but a soap bubble
  degreases them (and traps them as usual). Kitchen hazards ignore all
  of this.
- **Freezing.** Enough ice freezes a sponge, spoon, bottle or (with
  patience) Grandma solid in a block of ice for a few seconds. While it's
  frozen it can't move or hug you. Its brittleness means other tools do
  1.5× damage, and once it's low, or takes a big hit, it shatters outright.
  Hit it hard and it slides like a curling stone into its comrades, or
  over the edge. Ice alone doesn't shatter it: freeze, then switch.
- **The Fork** is armoured while it flies. Dodge its last stab and it
  sticks in the counter for a couple of seconds. While it's stuck,
  everything does more than double damage.
- **You cannot hug a puddle.** Turning into a puddle while a sponge is
  hugging you slips you free, with a moment of protection.
- **The golden sponge** now outruns you on foot, but it sweats a wet trail.
  Slide after it as a puddle, or bubble it.
- **Dialectics versus repetition.** The HUD tracks your recent killing
  methods (squirt, ice, fizz, soap, edge, bubble, puddle). Four different
  methods among your last six kills pay ×1.6 (DIALECTICAL!), three pay
  ×1.3. Twelve kills in a row the same way drop you to ×0.6 until you
  change, with a diagnosis of repetition compulsion.
- **Stashes.** Three dead letters wait under the low cutting board in
  Breakfast Republic, which you can only reach as a puddle (THE PUDDLE
  POST). A TOP SHELF above the Dish Rack is higher than any jump: rocket-jump
  up there with fizz. Each stash pays 1,500 the first time.
- **The Clog.** Clearing the Sink of History is not enough. A mass of hair,
  noodles, a contact lens and thirty years of ideology now blocks the drain.
  Water feeds it. Fizz breaks it up, ice and soap help. It fights back: it
  spits hairballs (dash or jump), regurgitates greasy sponges (soap them),
  and below half health it sucks you towards the drain. Dashing resists the
  pull, and turning into a puddle makes it much worse, because puddles are
  what drains are for. While it lives, the drain siphons up a fresh seltzer
  every few seconds if you're low. Its health bar shows how much blockage
  remains, and the objective changes to the plug only after it dies.
  PLEASE preserves its wounds and projectiles, along with your technique
  history and collected stashes.

The campaign is also a little less forgiving than it was in the previous
version. Hits do 85% damage instead of 75% and give a shorter grace period,
and sponges absorb you somewhat faster. Rocket jumps cost a little less, to
keep the top shelf fair.

## How it's made

There are no external image assets. Everything is procedural meshes—rounded
boxes, cylinders, spheres, rings and arches—and the
surfaces are painted in the fragment shader: wood grain along the planks, the
sponge's pores and scouring pad with the serrated seam between them, brown
glass with etched white script, the pink label, tiles. Moving objects have
soft contact shadows; a cached local depth map adds shadows from the scenery
in Sunlit mode. It updates as you travel or open a checkpoint, with a smaller
map on touch devices.
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
low board, launch routes and full counter. It also checks both lighting modes,
shadow caching, all twenty discovery locations, paused encounter inspection,
notebook navigation and discovery/continue persistence. It does not replace playing the
encounters to judge difficulty and feel.

The browser suite also exercises friendly fire, grudges, saturation, water
recovery, launches, bubble cascades and death snapshots. With Node, Playwright
and Chromium available, `node tools/check-browser.cjs` runs that page and
returns a failing exit status for any failed check or uncaught JavaScript error.

`node tools/playtest.cjs --seeds 1,2,3 --personas casual` runs reproducible
behavioral campaigns using the actual simulation, aiming and firing. It does
not delete enemies or grant invulnerability. It has known navigation routes
and other limitations; see [tools/README.md](tools/README.md) before treating
its results as evidence about player experience.
