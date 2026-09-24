# STÅLHAGEN II · Isvägen

*the ice road*: a 3D action/horror walk across a frozen bay to the farm you grew up on,
after the paintings of Simon Stålenhag. The opening now combines a short winter
crossing with a hostile roadkeeper and a quieter, unsettling encounter at the farm. This is the playable vertical slice; the design for the whole game is in
[DESIGN.md](DESIGN.md).

Open `steelhag2/index.html` in a browser (WebGL2 required). No build step, no server,
no dependencies. There's also a single-file build at `dist/stalhagen2.html`
(regenerate it with `python3 tools/build-single.py`).

## What is in the slice

| | | |
| --- | --- | --- |
| I | **Isen**, the ice | December 16th, 1997, noon. Roos's van at the substation, a sled on a rope, the winter road across the bay, thin ice where the ice is dark, and four walker hulls standing up out of the bay as you pass |
| II | **Sjögården**, the farm | Dusk. The old house, sold twice, with the kitchen window lit. A scout machine leads you in. A cable in a hole where SV-14 used to lie. Then a bearer comes across the field |

The protagonist uses Quaternius’s authored, skinned character meshes and animation
clips (CC0; provenance in [assets/character/README.md](assets/character/README.md)).
The environment, machines, painted materials and sound are built locally.

## How it plays

- **Walk** with WASD or the left stick; **look** with the mouse (click to capture the
  pointer) or the right stick. **Shift** runs. Walking is 3.1 m/s; running is 5.6 m/s.
- **E** (or click) reaches out, sits down, uses doors, takes the photograph.
- **F** the torch. **C** raises the camera; **E** takes a photograph anywhere. An E photo prompt also raises the camera and shoots directly.
- **Hold Space** or right mouse to aim the arc cutter; **E / left click** cuts the highlighted support joint within eight metres. It recharges between shots.
- **Esc** pause, **Tab** the album, **M** mute. Keys can be rebound in the menu.
- On a phone: left pad walks, dragging the right half looks, and the buttons are camera,
  torch, reach/use and cutter.

**The roadkeeper.** A machine intercepts the ice road. Its pulsing lamp warns of a
committed lunge: sidestep it, then cut its supports during recovery. Cutting a joint
interrupts its attack. Three disabled legs or the exposed core stop it. Three hits
knock you down; you recover at the checkpoint. Quiet mode removes hostile attacks.

**The bearer.** When it notices you it comes across the snow, stopping every few
seconds to look. Stand still and its calm rises; it comes closer. When it is close
enough the prompt says *reach out*: hold E for two seconds and its light goes out under
your hand, and it kneels. Letting go early is never a flinch. Moving for more than a
moment, hurrying, turning the torch on it, or raising the cutter is a flinch: it lifts
you, and you wake on the porch bench with the night spent and the kitchen window dark.
The cutter takes its legs off one at a time; with no legs it can't lift anyone. Cutting its core also resolves the encounter.

**Photographs.** Prints are developed in the cellar darkroom on the east side of the
house. Some things only show up in the print. A large thumbnail and confirmation appear
after shooting, and Tab opens the album during play. When browser storage is full,
the game identifies the photograph as session-only and preserves the existing album.

**Sleep** at the front door once the day is done (a bearer switched off, cut down, or
after you were carried).

Quiet mode (in settings) makes the bearers watch but never carry you.

## Tools

- `tools/shot.js`: screenshots at given chapters/positions with Playwright and SwiftShader.
- `tools/build-single.py`: the single-file build.

## September 2026 revision

- Imported weighted character skin, authored idle/walk/run/interaction/cutter clips,
  animation blending and attached field equipment replace the old rigid mannequin.
- The bay is compressed; an uninterrupted ordinary walk reaches the island in under
  48 seconds. The hulls rise in seven seconds and the roadkeeper engages on the crossing.
- Darker overcast light, closer monumental hulls, denser forest silhouettes and less
  banded ice give the route stronger depth. Character contact follows the exact
  terrain triangles. Tree/terrain shadow cost is reduced.
- Photography works directly from its E prompt. The album is accessible during play.

The Stålenhag homage remains the art direction. Authored assets are welcome;
procedural generation is not a requirement.

## Validation

Run `node tools/check-character.js` for weighted skin, authored clip blends and pose
bounds. Run `node tools/check-art.js` for winding, machine poses, peaceful interactions,
roadkeeper attack telegraphing, damage, staggering and defeat.

Serve the folder and open `tools/art-review.html`. **Run checks** exercises movement,
the real E photo/negative pipeline, album return, cutting, damage, the full crossing
and the peaceful farm encounter. **Standalone** runs the same checks against the
release build. Review mode is muted and does not read or write player saves/photos.
Rebuild releases with `python3 tools/build-single.py`.

These checks are regression coverage, not a claim that the art or game is finished.
