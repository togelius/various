# Tall Order

A first-person shooter about climbing. Somebody built a tower out of big bricks
in the middle of the living-room rug, and it is crawling with toys. You are a
cheap plastic figure: your head only turns side to side and your blaster is
molded at your hip, so you can only shoot what is roughly level with you. What
is above you, you climb to. Fight your way up six floors to the flag on top.

Open `index.html` in a browser. It is one file with no dependencies, written in
raw WebGL2. It loads Lilita One and Atkinson Hyperlegible from Google Fonts if
it can and uses fallback fonts if not. It plays on a touch screen (made for a
phone held sideways), or on a laptop with the keyboard alone or with a mouse or
trackpad as well. Your best time is kept in the browser's local storage.

## Where it came from

The brief was a complete little game with a lot of verticality, where the goal
is to reach the top. The secondary weapons are things you pick up and use up,
and there are several kinds. It should be fun, violent and a little silly.
Some enemies are slow and lumbering and telegraph what they do well in advance;
others are fast and annoying.

The setting comes from a photo of a tower of big toy bricks on a colourful rug:
grey baseplates on stacked columns, a red lattice, a white crane with a red top,
a werewolf figure, a grey cat, a blue toy car and a red flower piece, with a
painted-brick fireplace, a television and a sofa behind it. All of those are in
the game, and all of them are made in code out of boxes.

The controls are the ones that came out best in the [Finger Guns](../finger-guns/)
sketches (Snapshot, with the plain Push stick): the left thumb walks and turns,
and you never aim up or down. The gun fires straight ahead and finds the height
by itself, so all the aiming is turning to face something.

The second round started from reading the
[On Verticality](https://www.onverticality.com/) blog for ideas, and then
narrowed to one tension: a game about climbing a tower in which you can't look
or aim up or down. The brief suggested a reason for that inside the game (you
are a cheap plastic figure without the hinges to look up and down), asked for
the auto-aim to reach only a little way up and down, so that you have to climb
level with things to hit them, and asked for the fast, annoying toys to come in
swarms, as in Left 4 Dead: calm stretches of exploring, broken up by frantic
backtracking, trying not to fall off the edge, and shooting what's coming. It
asked for ideas that support that, ideally ones not seen in other games; for
the game not to be too hard; and for a keyboard and mouse mode, to play it on a
laptop.

## Controls

On a phone or tablet:

- **Left half of the screen**: a stick that appears where you put your thumb.
  Push up to walk, down to back off, sideways to turn. Turning is gentle near
  the middle and fast at the edge, and faster still if you hold it hard over.
- **FIRE** (bottom right, hold it down), **JUMP** (beside it), and the **item
  button** above FIRE, which uses whatever you picked up. When you carry more
  than one kind of pickup, small chips beside it switch between them. You can
  slide your thumb from one button to another.

On a laptop, the stick and the buttons stay off the screen, and the pickup you
are holding sits in the corner with its keys:

- **W S** walk and **A D** turn (or the arrow keys), **Space** jumps, hold
  **F**, **J** or **Z** to fire, **E**, **K** or **X** uses your pickup, and
  **Q**, **C**, **L** or **1** to **4** swap pickups. A tap of a turn key nudges
  you round a little; holding it swings you round faster and faster.
- **Click** the game to grab the mouse or trackpad. Then moving it turns you
  and **A D** sidestep. Hold the left button to fire; the right button uses
  your pickup and the wheel swaps them. **Esc** lets go of the pointer and
  pauses, and resuming grabs it again. The pause menu sets how fast the mouse
  turns you.
- **M** mutes, **Esc** or **P** pauses. The pause menu also turns the music
  off and on.

The first time you play, small hints show you where to drag (or which keys to
press), that FIRE is held down, and how to use a pickup. They stop once you
have done each of those things.

## Being a plastic figure

- **The aim band.** Your blaster only wobbles 12 degrees up or down from your
  hip. Anything inside that band is hit wherever it is in it; anything above or
  below it isn't, however close. Faint brackets above and below the crosshair
  show how far the band reaches. When the thing you are facing is out of it,
  it gets a dashed orange ring (or an arrow at the top or bottom of the screen,
  if it is right overhead where you can't see it), the arm creaks and strains
  toward it, and the first few times a hint tells you to back off or climb.
  Backing off works because the band is an angle: a toy one floor up is out of
  reach from underneath it and in reach from far enough away. The Bouncy Bomb,
  the Zap Wand, the Confetti Cannon and the Squeaky Mallet don't care about the
  band.
- **Edges.** You can't look down either, so the edges look after you a little.
  Walking toward a drop of more than a step, you rock on the lip for half a
  second before you go over, and the view tips to show you the drop. Keep going,
  or get knocked off, and you grab the edge and hang by your stubby hands: JUMP
  pulls you up, pushing away from the wall lets go, and after four seconds you
  drop anyway.
- **The neck hinge.** At the top, a hinge clicks into your neck and you look up
  for the first time.

## Swarms

The kitties and the bees mostly come in swarms, paced after Left 4 Dead: a calm
stretch in which you are in charge, then a warning (a patter or a scrabble, a
chorus of meows, a callout, and faster music), then the swarm, then "PHEW" and
quiet again, with a juice box where the last one fell if you are hurt. Swarms
come from the heights you can't look at:

- **From above**: kitties drop around you from just under the floor overhead,
  and higher up the tower a bee and a wolf come too. Their shadows darken, and
  get a red ring, as they come down.
- **From below**: kitties pour up the stairs behind you.

Some swarms are set off by what you do: arriving at the top of the rug stairs
and of the stairs up to floor four brings kitties up after you, and the first
time you call the lift, its bell wakes the floor. If you linger somewhere quiet
for about a minute, the toys come looking for you. The height strip on the left
shows the toys hunting you as dots at their heights (pink for a swarm), and
blinks above or below you, on the side the next swarm is coming from.

## The climb

Each floor has one way up to the next, and a lime marker shows you where it is:

1. **The rug.** Stairs of stacked bricks lead up to the first floor.
2. **Floor one**, a grey baseplate on sixteen columns. A spring pad (BOING)
   throws you up onto the second floor.
3. **Floor two**, a white plate. A yellow lift carries you up to the third.
   Walk up to it and it comes down for you, slowly; the marker counts it down.
4. **Floor three**, a green plate. A staircase climbs to the fourth.
5. **Floor four**, a sky-blue plate. Climb the red lattice by pushing into it.
6. **The top**, a yellow plate with a low wall and the white crane in the
   middle. The **MEGA WOLF** lives here. Knock it down and the crane's steps
   build themselves, spiralling up to the flag.

Every floor has a checkpoint. It counts as soon as you stand on that floor, and
it tops your health back up to 70. If you are knocked out, or fall more than a
floor and a half ("SPLAT!"), you come back at the highest checkpoint you have
reached, facing the way on up. There is one more checkpoint halfway up the
crane.

## The toys

Slow and telegraphed:

- **Brick golem.** Big, slow and tough. It raises its fists for a second and a
  half while a red ring spreads on the floor around it, then slams the floor and
  sends out a shockwave. Jump over the ring as it passes.
- **Toy car.** It revs for over a second while warning stripes paint its path,
  then charges. It hurts, and it knocks you a long way, including off the edge.
  Cars can also fly off the edge themselves.
- **Cannon.** It lobs shells in a high arc and marks where they will land. Step
  out of the circle. You can shoot the shells down in the air.
- **MEGA WOLF.** A giant wolf in a gold crown. It stomps (a big shockwave to
  jump), throws huge bricks, and howls twice to call down kitties and a bee. It
  talks too much.

Fast and annoying:

- **Kitties.** They zig-zag at you and pounce, mostly in swarms.
- **Bees.** They circle overhead, out of reach, then come down to your level to
  line up (a "!" appears) and dive. While they line up, you can hit them.

In between:

- **Wolves.** They walk up and swipe (after a wind-up you can see), or throw
  bricks from further away. Bricks can be shot out of the air.

Toys that fall far enough go SPLAT, and everything that pops falls apart into
the bricks it was made of, with ketchup. Pop several in a row for a DOUBLE POP
or better. Your own blasts push you around but never hurt you, so rocket jumps
work. Toys' blasts hurt everyone, toys included. The toys shout things when
they spot you and when they wind up, one at a time.

At the top you get your time, how many toys you popped, how often you fell or
were knocked out, and a rank.

## Pickups

Your blaster never runs out. Pickups are extra, you hold up to four kinds, and
each comes with a few uses:

- **Rocket Pop**: a rocket that flies at whatever you are facing and explodes.
- **Confetti Cannon**: a wide blast of confetti that flings toys away. It is
  very good at knocking them off the tower.
- **Bouncy Bomb**: a lobbed bomb that bounces about and goes off after a
  moment.
- **Squeaky Mallet**: a big swing that sends toys flying and bats shells and
  bricks back where they came from.
- **Zap Wand**: lightning that jumps between up to four toys and stuns them.
- **Juice**: 35 health, drunk on the spot. It stays where it is if you are
  already at full health.

## How it was playtested

Most of the tuning came from a scripted bot that plays the whole game through
the same test hook the page exposes (`window.tallOrder`). It follows a route up
the tower, fights what it sees, uses pickups on big toys and crowds, jumps
shockwaves and steps out from under shells. It plays in four modes: unhurtable,
normal, a "human" mode that only notices what is in front of it, reacts a beat
late and turns more slowly, and a "novice" mode that is slower still and never
uses its pickups. Between them, the bot runs and a handful of
targeted tests (the spring from every direction, the ladder, the lift, the real
touch controls, starting again after a win) turned up:

- a boss that kept throwing bricks at you after you'd been knocked down a floor,
  and could be shot from the ladder without fighting back
- crane steps too narrow to walk up, then a spiral the novice kept falling off
  (it now has twice as many steps, overlapping like a staircase), and a spiral
  that boxed in the top of the ladder once it was built
- a checkpoint that put you back under one of those steps
- a wall round the top floor low enough to step over
- a spring that could drop you back where you started if you held the stick
  the wrong way
- a lift that trapped you inside it if it came down on you

A separate read-through of the code, with its own test harness, found the
rest: keys and mouse buttons that could stay held after a win or a mouse grab,
a resolution scaler that only ever went down, kitties summoned inside the crane,
bees riding the lift, and a pillar running through it.

For the second round the bot learned the new rules: it backs away from what it
can't reach and pulls itself up when it grabs an edge. It also got a mode that
stands about for a while on every floor, to bring on the swarms that come when
you linger. Those runs, tests in a desktop browser with the keys and the mouse,
and screenshots of each new cue on a phone and a laptop screen turned up:

- bees that were close to impossible to hit, because they circled above the
  band and only crossed into it at the very end of a dive
- a ledge grab that let go at once if you had backed off the edge, because you
  were still holding the stick back
- stragglers from a stair swarm, left behind on the floor below, that kept the
  swarm going, so the lift's bell never set off its own
- kitties dropped near the edge of the floor above that landed on top of it
- the out-of-reach marker, drawn off the top of the screen when the thing was
  right overhead
- on a slow machine, a key tap quicker than a frame that did nothing, and
  jumps of the hidden pointer that spun you round

The runs also set the difficulty, which was meant to stay about where it was
before. In human mode the bot finishes in a minute and a half to two and a half
minutes and gets knocked out once to three times, mostly by the MEGA WOLF and
by falls; the novice takes two to five and a half minutes, usually with two to
four knockouts (nine, once, when it kept walking back into the golem and the
cannon on floor three); and the novice that stands about on every floor takes
five to six minutes and meets four or five swarms. All of them always got to
the top. A person playing for the first time should expect to take longer.

## Code

Everything is in `index.html`: a small WebGL2 renderer (one static mesh for the
room and the tower, instanced boxes, cylinders and spheres for everything that
moves, decals for shadows and warnings), box collision, the player, the toys and
their animation, the swarm director, pickups, sound effects and music made with
Web Audio, and the HUD drawn on a 2D canvas on top.
