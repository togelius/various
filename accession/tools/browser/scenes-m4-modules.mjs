// ACCESSION — M4's module scenes (BUILD.md §7.1): the top bar's alarm bell and chime
// countdown, the panel's banner and its reading, the Lamp's "Light it" and "Hood it", walk
// stops for module events and the `moved` cue, each played through one input alone.
// scenes.mjs plays this file's scenes after its own and after scenes-m4-progress.mjs's, with
// the same context c (page, drv, tag, bad, did, W, H, layout, targets): drv is the check's
// driver, the keyboard's (drv.press, drv.bumps) or a pointer's. M4's skeleton made the file
// with no scenes; UI-MODULES fills it.

// UI-MODULES fills: its scenes.
export async function play(c) {}
