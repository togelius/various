// ACCESSION — M4's progress scenes (BUILD.md §7.1): viewing, the Certificate's banner and the
// badge, the perk sheet, the hall's confirmation and the sealed chip, the URL parameters, `x`
// reaching lecterns, panels and shutters, and walk stops for progress events, each played
// through one input alone. scenes.mjs plays this file's scenes after its own, through every
// check that plays them (check-keys, check-touch, check-play), with the same context c
// (page, drv, tag, bad, did, W, H, layout, targets): drv is that check's driver, the
// keyboard's (drv.press, drv.bumps) or a pointer's, so a scene acts through it alone and
// reads the page with page.evaluate, as scenes.mjs's own do. M4's skeleton made the file
// with no scenes; UI-PROGRESS fills it.

// UI-PROGRESS fills: its scenes.
export async function play(c) {}
