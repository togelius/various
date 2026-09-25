# Bollard Hop

A one-button game about hopping along the row of big rubber ball bollards on a
pedestrian shopping street. It's based on a photo of a kid balancing on them
while a little sibling watches.

Hold to crouch. While you hold, a dotted arc shows where the hop will land:
green means a perfect landing, cream means a safe landing that will wobble,
and red with a cross means you will miss. Let go to hop. A ring on top of the
next ball marks the perfect zone, and perfects in a row build a combo bonus.
Land off-center and you start to wobble, so hop again before you slide off.
The gaps between balls grow as your score goes up. The little sibling toddles
along the pavement behind you and cheers your perfects.

Open `index.html` in a browser. It is one file with no dependencies. It loads
Bagel Fat One and Nunito from Google Fonts if it can and uses fallback fonts
if not. Your best score is kept in the browser's local storage.

## Controls

- **Hold and release** the mouse button, a finger or the **space bar** to hop
- **Space / Enter** to start or play again

## How it's drawn

There are no image assets. The shopfronts, pavement tiles, tactile guide
strip, speckled two-part balls and both children are drawn in code on a
canvas. The shopfronts scroll with parallax. Sound is short WebAudio blips.
