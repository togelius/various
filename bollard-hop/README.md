# Bollard Hop

A one-button game about hopping along the row of big rubber ball bollards on
Stora Östergatan, the pedestrian shopping street in Ystad, Sweden. It's based
on a photo of a kid balancing on them while his little sister Arya watches.

Hold to crouch. While you hold, a dotted arc shows where the hop will land:
green means a perfect landing, cream means a safe landing that will wobble,
and red with a cross means you will miss. Let go to hop. A ring on top of the
next ball marks the perfect zone, and perfects in a row build a combo bonus.
Land off-center and you start to wobble, so hop again before you slide off.
The gaps between balls grow as your score goes up. Arya toddles along the pavement behind
you and comments in speech bubbles on everything her brother does: big
jumps, wobbles, perfects, the colour of the ball he lands on, the seagulls
going over, and every fall.

Open `index.html` in a browser. It is one file with no dependencies. It loads
Bagel Fat One and Nunito from Google Fonts if it can and uses fallback fonts
if not. Your best score is kept in the browser's local storage.

## Controls

- **Hold and release** the mouse button, a finger or the **space bar** to hop
- **Space / Enter** to start or play again

## How it's drawn

There are no image assets. Everything is drawn in code on a canvas: Ystad's
half-timbered houses with red tile roofs, rendered shop buildings with REA
posters and Swedish shop signs, blue Stora Östergatan street signs, Swedish
flags, the copper-topped tower of S:ta Maria kyrka in the distance, seagulls,
the pink pavement tiles and tactile guide strip, the speckled two-part balls
and both children. The street scrolls with parallax. Sound is short WebAudio blips.
