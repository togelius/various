# WEFT

A small arcade game made to look and feel like a hand-woven indigo-and-cream
rug. You steer a needle down the rug with a green thread behind it. Pass
through the unwoven diamonds to weave them in. Each one gives back thread,
and the thread keeps running out. Keep clear of the spiked chevron blocks and
the snag bars. The rug speeds up as you go.

Open `index.html` in a browser. It is one file with no dependencies. It loads
Josefin Sans from Google Fonts if it can and uses a fallback font if not.

## Controls

- **← → / A D** or the **mouse** to steer. On touch screens, **drag**.
- **Space / Enter / click** to start
- **P / Esc** to pause, **M** to mute

## How it's drawn

There are no image assets. Every cream mark is woven in code. A pattern mask
(stripes, zigzags, nested chevrons, stepped diamonds, even the title
lettering) is sampled on a grid of warp columns and weft rows. Each hit
becomes a short vertical float. Each row is shifted sideways by a small random
amount, so edges feather the way ikat does. The background is woven in
chunks as the rug unrolls. The palm frond is a nod to the photo that inspired
the game.

Sound is WebAudio: a loom-beater clack keeps time, and woven diamonds pluck
up a D minor pentatonic scale as your combo grows.
