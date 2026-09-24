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
The environment meshes, machines, painted materials and sound are built locally.
The detailed spruce cutout and cloud panorama are original generated assets; their
sources and prompts are recorded in [assets/foliage/README.md](assets/foliage/README.md)
[assets/sky/README.md](assets/sky/README.md), and
[assets/materials/README.md](assets/materials/README.md).

## How it plays

- **Walk** with WASD or the left stick; **look** with the mouse (click to capture the
  pointer) or the right stick. **Shift** runs. Walking is 3.1 m/s; running is 5.6 m/s.
- **E** (or click) reaches out, sits down, uses doors, takes the photograph.
- **F** the torch. **C** raises the camera; **E** takes a photograph anywhere. An E photo prompt also raises the camera and shoots directly.
- **Hold Space** or right mouse to aim the arc cutter; **E / left click** cuts the highlighted support joint within eight metres. It recharges between shots.
- **Esc** pause, **Tab** the album, **M** mute. Keys can be rebound in the menu.
- On a phone: left pad walks, dragging the right half looks, and the buttons are camera,
  torch, reach/use, cutter, run and album. The album adapts to portrait screens.

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
after shooting, and Tab opens the album during play. Select a photograph to enlarge
it. A developed print can be compared against its original exposure. Albums are paged, every exposure is kept, and an enlarged photograph can be saved as a JPEG. When browser storage is full,
the game identifies the photograph as session-only and preserves the existing album.

**The farm relay.** Follow the direction marker to the blue-lit relay behind the
barn. Restoring it wakes the bearer. Lower the cutter and hold still to let it approach,
or sever its supports and exposed core.

**Sleep** at the front door once the day is done (a bearer switched off, cut down, or
after you were carried).

Checkpoints save automatically at chapter arrivals, the relay, resolved encounters
and benches. Continuing restores disabled joints and encounter outcomes.

Quiet mode (in settings) makes the machines watch without attacking or carrying you.

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
- Photography works directly from its E prompt. The album is accessible during play, with enlarged prints, original/print comparison and image export.
- Original ice and Falu-red timber textures add surface detail; the farmhouse has
  framed lit glazing, a porch lamp, entrance hardware and soft paths through the snow.
- The fitted cap and detailed field pack accompany softer authored-character shading.
  The camera retracts at walls and keeps its close framing during aiming and threats.
- A missed cutter discharge still produces an arc, sound and feedback. Restoring the
  relay briefly interrupts the house lights; reduced-motion mode uses a steady dim.
- Walker hulls have glazed cabins, access ladders, hydraulic legs, railings and service
  markings. Cutter impacts throw sparks and an arc from the tool; the roadkeeper
  advertises its lunge with a pulsing lamp.
- Shore transitions use a finer continuous terrain surface, moving aim keeps the
  character’s legs animated, and foot contacts have individual grounding shadows.
- Farm power, the bearer encounter, automatic checkpoints, the darkroom and the
  ending form a complete short route. The large design document remains a longer-term proposal.

The Stålenhag homage remains the art direction. Authored assets are welcome;
procedural generation is not a requirement.

## Validation

Run `node tools/check-character.js` for weighted skin, authored clip blends and pose
bounds. Run `node tools/check-art.js` for winding, machine poses, peaceful interactions,
roadkeeper attack telegraphing, damage, staggering and defeat. Run
`node tools/check-store.js` for storage-quota and save preservation, and
`node tools/check-world.js` for shoreline continuity, collision and cutter occlusion.
`node tools/check-player.js` checks camera obstruction and the aiming/threat/scenic
framing rules.

Serve the folder and open `tools/art-review.html`. **Run checks** exercises movement,
the real E photo/negative pipeline, album return, cutting, damage, the full crossing
and the peaceful farm encounter. **Farm checks** covers the relay, checkpoint restore,
darkroom, front door ending and album. **Standalone** runs the same checks against the
release build. Review mode is muted and does not read or write player saves/photos.
Rebuild releases with `python3 tools/build-single.py`.

These checks are regression coverage, not a claim that the art or game is finished.
