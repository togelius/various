# STÅLHAGEN II · Isvägen

*the ice road*: a 3D action/horror walk across a frozen bay to the farm you grew up on,
after the paintings of Simon Stålenhag. It is still beautiful, still slow, and it never
rushes you. This is the playable vertical slice; the design for the whole game is in
[DESIGN.md](DESIGN.md).

Open `steelhag2/index.html` in a browser (WebGL2 required). No build step, no server,
no dependencies. There's also a single-file build at `dist/stalhagen2.html`
(regenerate it with `python3 tools/build-single.py`).

## What is in the slice

| | | |
| --- | --- | --- |
| I | **Isen**, the ice | December 16th, 1997, noon. Roos's van at the substation, a sled on a rope, the winter road across the bay, thin ice where the ice is dark, and four walker hulls standing up out of the bay as you pass |
| II | **Sjögården**, the farm | Dusk. The old house, sold twice, with the kitchen window lit. A scout machine leads you in. A cable in a hole where SV-14 used to lie. Then a bearer comes across the field |

Everything is painted in code: geometry, the brush-stroked material textures,
the snow, the sound.

## How it plays

- **Walk** with WASD or the left stick; **look** with the mouse (click to capture the
  pointer) or the right stick. **Shift** hurries. Hurrying is loud.
- **E** (or click) reaches out, sits down, uses doors, takes the photograph.
- **F** the torch. **C** the camera: a viewfinder, first person; at marked places you can take a photograph.
- **Space** or right mouse: the arc cutter. It cuts what it is pointed at. It is not a gun.
- **Esc** pause, **Tab** the album, **M** mute. Keys can be rebound in the menu.
- On a phone: left pad walks, dragging the right half looks, and the buttons are camera,
  torch, reach/use and cutter.

**The bearer.** When it notices you it comes across the snow, stopping every few
seconds to look. Stand still and its calm rises; it comes closer. When it is close
enough the prompt says *reach out*: hold E for two seconds and its light goes out under
your hand, and it kneels. Letting go early is never a flinch. Moving for more than a
moment, hurrying, turning the torch on it, or raising the cutter is a flinch: it lifts
you, and you wake on the porch bench with the night spent and the kitchen window dark.
The cutter takes its legs off one at a time; with no legs it can't lift anyone.

**Photographs.** Prints are developed in the cellar darkroom on the east side of the
house. Some things only show up in the print.

**Sleep** at the front door once the day is done (a bearer switched off, cut down, or
after you were carried).

Quiet mode (in settings) makes the bearers watch but never carry you.

## Tools

- `tools/shot.js`: screenshots at given chapters/positions with Playwright and SwiftShader.
- `tools/build-single.py`: the single-file build.
