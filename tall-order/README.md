# Tall Order

A first-person shooter about climbing. Somebody built a tower out of big bricks
in the middle of the living-room rug, and it is crawling with toys. Fight your
way up six floors to the flag on top.

Open `index.html` in a browser. It is one file with no dependencies, written in
raw WebGL2. It loads Lilita One and Atkinson Hyperlegible from Google Fonts if
it can and uses fallback fonts if not. It plays on a touch screen (made for a
phone held sideways), or with a keyboard and mouse. Your best time is kept in
the browser's local storage.

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

## Controls

On a phone or tablet:

- **Left half of the screen**: a stick that appears where you put your thumb.
  Push up to walk, down to back off, sideways to turn. Turning is gentle near
  the middle and fast at the edge, and faster still if you hold it hard over.
- **FIRE** (bottom right, hold it down), **JUMP** (beside it), and the **item
  button** above FIRE, which uses whatever you picked up. When you carry more
  than one kind of pickup, small chips beside it switch between them. You can
  slide your thumb from one button to another.

With a keyboard and mouse:

- **W S** walk, **A D** turn (or the arrow keys), **Space** jumps, **J** (or
  **F**, **Enter**) fires, **K** (or **E**) uses your pickup, **Q** swaps
  pickups
- **Click** the game to grab the mouse: moving it turns you, left click fires,
  right click uses your pickup, and **A D** sidestep
- **M** mutes, **Esc** or **P** pauses. The pause menu also turns the music
  off and on.

The first time you play, small hints show you where to drag, that FIRE is held
down, and that pickups are tapped. They stop once you have done each of those
things.

## The climb

Each floor has one way up to the next, and a lime marker shows you where it is:

1. **The rug.** Stairs of stacked bricks lead up to the first floor.
2. **Floor one**, a grey baseplate on sixteen columns. A spring pad (BOING)
   throws you up onto the second floor.
3. **Floor two**, a white plate. A yellow lift carries you up to the third.
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

- **Kitties.** They zig-zag at you and pounce.
- **Bees.** They circle overhead, pause to line up (a "!" appears), then dive.

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

The runs also set the difficulty. In human mode the bot finishes in a minute
and a half to three minutes and gets knocked out a few times along the way,
mostly by falls; the novice takes two to six minutes and gets knocked out more
often, by the MEGA WOLF as well as by falls, but it always got to the top. A
person playing for the first time should expect to take longer.

## Code

Everything is in `index.html`: a small WebGL2 renderer (one static mesh for the
room and the tower, instanced boxes, cylinders and spheres for everything that
moves, decals for shadows and warnings), box collision, the player, the toys and
their animation, pickups, sound effects and music made with Web Audio, and the
HUD drawn on a 2D canvas on top.
