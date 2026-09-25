# WEFT

A small arcade game made to look and feel like a hand-woven indigo-and-cream
rug. You steer a needle down the rug with a green thread behind it. Pass
through the unwoven diamonds to weave them in, and keep an eye on the thread,
because it keeps running out. Diamonds give thread back, but a lone diamond
gives back very little. A streak pays more: +5, +8, +11, then +13 for the
fourth diamond in a row and every one after, until you miss a diamond or get
snagged. Keep clear of the spiked chevron blocks and
the snag bars. The rug speeds up as you go.

After about fifteen seconds, clothes moths start fluttering up the rug after
the needle. If one touches the fresh end of your thread, it lands on it and
spools it into a little green ball. Then it crawls down the thread toward the
eye. Swerve hard left and right to shake it off before it bites. Later in the
run, two moths can hunt you at once.

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
