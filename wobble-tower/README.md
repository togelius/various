# Wobble Tower

A fast, quirky stacking game made from three family photos: a kid crawling
through a walnut cabinet, a kid building a tower of Duplo plates on a little
pink wheel, and a hand (with a black watch band) holding the whole thing up.

You are the hand. Drag a finger (or the mouse, or the arrow keys) to slide the
wheeled plate under whatever is falling: bricks with letters on them, long
plates, the 8-stud red beam, a stuffed sheep, a sippy cup, a loose pink wheel.
Pieces that sit still on the stack for a moment score, and unbroken streaks
raise the multiplier up to x5. Stack up to the bank line (the top of the
fireplace) to cash in the tower, get a heart back and start a new one.

Things to know:

- **Sheep** are heavy. **Cups and wheels** roll.
- **Gold foil bar** makes everything you land for a few seconds stick.
- **Snowman lamp** makes things fall in slow motion for a few seconds.
- **Pink heart brick** gives a heart back.
- **ZOOMIES!** Every so often a kid crawls through the cabinet tunnel under your
  plate and shakes the whole tower. Eyes in the dark warn you which side.
- You lose a heart when a piece you stacked falls off, or when you miss a
  piece. Five hearts. A tower that collapses costs one heart per second at most.

Open `index.html` in a browser. It is one file. It loads Matter.js (physics)
from cdnjs and Lilita One and Fredoka from Google Fonts, and uses fallback fonts
if the fonts are not reachable. Your best score and the sound setting are kept in
local storage.

## How it works

- Matter.js runs the physics at a fixed 60 steps per second. The plate is a
  heavy body that is driven by velocity, with a limit on speed and acceleration.
- Matter's friction cannot carry a tall stack through quick turns, so the plate
  also hands its acceleration to everything resting on it, and pieces that have
  touched the stack get a soft landing and some angular damping. This is what
  keeps the tower standing until you do something silly.
- A piece counts as stacked once it has touched the plate (or a stacked piece)
  and then stays still relative to the plate for 0.4 seconds.
- There are no image assets. The living room, rug, cabinet, bricks, sheep,
  snowman and kid are all drawn on a canvas. Sound effects are small WebAudio
  tones.
