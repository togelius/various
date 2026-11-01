// M4 W0e: Behaviour lines (BUILD.md §5.3; M4 plan A11, D5, Q3 and Q10, decided as their
// defaults without play):
//   - the line budget: no gallery line, and no Centrepiece's strip in any phase, takes the
//     phone's strip more rows than M11.1's 507-character line takes at 390×844 at the
//     largest text, the rows at which check-screens finds the board keeps 40% of the window
//     (3.6 px to spare; one row more is 22.3 px). It is judged here, in Node, by the
//     browser's own metrics, measured in Chromium as check-screens places the line (METRICS:
//     the font's advance and kerning for every character a line may use, the strip's width
//     and the rows), and a wrap that breaks where Chromium breaks; the model gives Chromium's
//     rows for the measured lines, the closest calls among them. A planted long line fails;
//   - the module slot, {module:<id>|<fallback>}, in both its forms, and a module's part on the
//     line of a species flagged with it, gone with its module (Q3: a rule a module gives is
//     written once, in its part, so no line says it while the module is off), and from a
//     label in a visit that does not run it (Modules.active);
//   - `cp:` parameters; a Centrepiece's phases, its whole line and its strip by phase (Q10);
//     a module's panel sentence (Clauses.sentence);
//   - (M4 FU1, the plan's amendment after ARCH-CP-CORE, decided without play) a Centrepiece's
//     strip, in every phase of its three: "Phase k of 3.", its form's short sentence, what
//     that phase itself adds, and "Its label has the rest."; held to the budget in every
//     phase at depths 1–7 with each module and modifier on and off, its label keeping the
//     whole line; the long lines ARCH-CP-CORE's review measured (the three Centrepieces as
//     the plan describes them, 21–23 rows whole) planted in a test core, each strip within
//     the budget; a planted long phase part fails in its own phase alone;
//   - lint-registry's reading of slots in both forms (fallback and module on), `cp:`, module
//     sentences and clauses, and phase parts, on planted faults.
// The metrics hold only while Chromium lays the strip out in the font they were measured in:
// tools/browser/check-lines.mjs measures them again at every check-all (measure and compare,
// exported below) and fails on any difference, such as another font standing in for
// system-ui. To measure again (after `python3 tools/build-single.py`):
//   node test/m4-lines.test.js --measure     compares a fresh measure with METRICS
//   node test/m4-lines.test.js --write       and writes it into this file
'use strict';

// ---- The measured metrics (generated: --write) ----
// BEGIN METRICS
const METRICS = {
  // The strip at 390×844 in Chromium (tools/browser/lib.mjs, as check-screens opens it), text
  // 1.3: the Behaviour line's box (#strip .behaviour) is `width` px wide; its font is 15.912
  // px system-ui (here, Inter), a row `lineHeight` px; `budgetRows` is the most rows at which
  // the board keeps 40% of the window. Advances and kerning in 1/`unit` px.
  width: 287.75, lineHeight: 22.2768, budgetRows: 14, unit: 65536,
  chars: "0123456789 !\"#$%&'()*+,-./:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~°·×àâçèéñöü–—‘’“”…−",
  adv: [
    657628, 423997, 635741, 643885, 673407, 633705, 646430, 589931, 644903, 646430, 293184, 299801, 485586, 660173, 668826, 1023599,
    671371, 312526, 380223, 380223, 522234, 689695, 300310, 479478, 300310, 375642, 300310, 314562, 689695, 689695, 689695, 532923,
    1006802, 719217, 682060, 761464, 752302, 626579, 615381, 777752, 774698, 279950, 595021, 700384, 589422, 941650, 785387, 797094,
    665772, 797094, 670862, 668826, 672898, 775716, 719217, 1027162, 711073, 707510, 655592, 380223, 375642, 380223, 491185, 475406,
    336449, 585350, 638286, 595530, 638286, 607746, 385822, 639304, 616399, 252464, 252464, 572116, 252464, 913146, 615890, 625052,
    638286, 638286, 392439, 550229, 341030, 616399, 585859, 853084, 569062, 585859, 575679, 444357, 346629, 444357, 689695, 474897,
    300310, 689695, 585350, 585350, 595530, 607746, 607746, 615890, 625052, 616399, 521216, 1042432, 271806, 271806, 459118, 459118,
    900930, 689695,
  ],
  kern: {
    "0": ["7,.VXY\\_t‘“…", [-20365, -26474, -26474, -10182, -35638, -35129, -10182, -47348, 15274, -47348, -47348, -26474]],
    "1": ["tvy", [15274, 5091, 5091]],
    "2": ["4", [-16292]],
    "3": ["*,.X^°…", [-15274, -23420, -23420, -20365, -15274, -15274, -23420]],
    "4": ["1*,.^°…", [-20365, -20365, -35129, -35129, -20365, -20365, -35129]],
    "5": [",.…", [-28002, -28002, -28002]],
    "6": [",._…", [-35129, -35129, -47348, -35129]],
    "7": ["03456789#&,.:;AJ_acdegmnopqrsàâçèéñö…", [-16292, -17310, -60585, -10182, -16292, 20365, -14764, -10182, -59058, -47348, -130335, -130335, -35129, -35129, -112515, -100297, -165464, -47348, -52948, -52948, -52948, -52948, -52948, -52948, -52948, -52948, -52948, -52948, -41239, -47348, -47348, -52948, -52948, -52948, -52948, -52948, -130335]],
    "8": ["*,.X^°…", [-15274, -23420, -23420, -20365, -15274, -15274, -23420]],
    "9": ["7,.VXY\\_t‘“…", [-20365, -26474, -26474, -10182, -35638, -35129, -10182, -47348, 15274, -47348, -47348, -26474]],
    "\"": ["4&,.AJcdegoqçèéö…", [-65167, -35129, -85532, -85532, -82477, -171573, -15274, -15274, -15274, -15274, -15274, -15274, -15274, -15274, -15274, -15274, -85532]],
    "$": ["X", [-10182]],
    "%": ["‘’“”", [-65167, -70768, -65167, -70768]],
    "&": ["\"'TVWY\\vwy‘“", [-35129, -35129, -59058, -65167, -41239, -76877, -65167, -35129, -35129, -35129, -94696, -94696]],
    "'": ["4&,.AJcdegoqçèéö…", [-65167, -35129, -85532, -85532, -82477, -171573, -15274, -15274, -15274, -15274, -15274, -15274, -15274, -15274, -15274, -15274, -85532]],
    "(": ["cdegjoqçèéö", [-11710, -11710, -11710, -11710, 29529, -11710, -11710, -11710, -11710, -11710, -11710]],
    ")": ["‘“", [-35129, -35129]],
    "*": ["4&,.@ACGJOQ_…", [-47348, -35129, -142044, -142044, -11710, -82477, -11710, -11710, -100297, -11710, -11710, -70768, -142044]],
    "+": ["237AJTVWXY\\x‘“", [-35129, -11710, -23420, -35129, -47348, -76877, -52948, -52948, -35638, -82477, -52948, -23420, -65167, -65167]],
    ",": ["01356789\"'?@CGOQTY’”", [-26474, -90114, -28002, -14764, -26474, -14764, -23420, -7128, -85532, -85532, -91642, -45821, -45821, -45821, -45821, -45821, -35129, -35129, -59058, -59058]],
    "-": ["237>AJTVWXY\\x‘“", [-35129, -11710, -23420, -174587, -35129, -47348, -76877, -52948, -52948, -35638, -82477, -52948, -23420, -65167, -65167]],
    ".": ["01356789\"'?@CGOQTY’”", [-26474, -90114, -28002, -14764, -26474, -14764, -23420, -7128, -85532, -85532, -91642, -45821, -45821, -45821, -45821, -45821, -35129, -35129, -59058, -59058]],
    "/": [",.AJ…", [-41239, -41239, -25456, -65167, -41239]],
    ":": ["\\‘“", [-65167, -47348, -47348]],
    ";": ["TV\\‘“", [-35129, -65167, -65167, -47348, -47348]],
    "<": ["-–—", [-174587, 186803, -334413]],
    "=": [">ATVWXY\\vxy‘“", [-384804, -52948, -47348, -70768, -65167, -52948, -100297, -70768, -41239, -35129, -41239, -59058, -59058]],
    ">": ["\\‘“", [-76877, -100297, -100297]],
    "?": ["A", [-65167]],
    "@": [",./\\_‘“…", [-45821, -45821, -41239, -35129, -41239, -35129, -35129, -45821]],
    "A": ["1\"'*+-/=?ACGOQTUVWY\\^itvwy~°·×‘’“”−", [-35129, -82477, -82477, -82477, -35129, -35129, 20365, -52948, -65167, 15274, -35638, -35638, -35638, -35638, -88587, -20365, -71277, -59058, -76877, -71277, -82477, 5600, -20365, -70768, -70768, -70768, -35129, -82477, -35129, -35129, -135935, -106406, -135935, -106406, -35129]],
    "B": ["T‘“", [-59058, -65167, -65167]],
    "C": ["AX_", [-20365, -5600, -41239]],
    "D": [",./ATVXY\\_‘“…", [-45821, -45821, -41239, -35638, -31056, -35129, -35638, -35129, -35129, -41239, -35129, -35129, -45821]],
    "F": [",.AJ_acdegmnopqruvyzàâçèéñöü…", [-41239, -35129, -94696, -70768, -35129, -25456, -41239, -41239, -41239, -41239, -30547, -30547, -41239, -30547, -41239, -30547, -35129, -35129, -35129, -35129, -25456, -25456, -41239, -41239, -41239, -30547, -41239, -35129, -88587]],
    "G": ["ATVXY\\", [-23420, -31056, -23420, -5600, -23420, -23420]],
    "H": ["tvy", [15274, 5091, 5091]],
    "I": ["tvy", [15274, 5091, 5091]],
    "J": [",./A_…", [-35129, -35129, -59058, -20365, -52948, -35129]],
    "K": ["$+-=CGOQScdegioquvwy~·×çèéöü−", [-10182, -112515, -112515, -35129, -35129, -35129, -35129, -35129, -10182, -41239, -41239, -41239, -41239, 16292, -41239, -41239, -35129, -41239, -65167, -41239, -112515, -47348, -35129, -41239, -41239, -41239, -41239, -35129, -112515]],
    "L": ["1\"'*+-CGOQTVY\\^tvy~°·×‘’“”−", [-47348, -94696, -94696, -41239, -88587, -88587, -29529, -29529, -29529, -29529, -100297, -70768, -35129, -70768, -135935, -23420, -70768, -70768, -88587, -47348, -65167, -35129, -88587, -40730, -88587, -40730, -88587]],
    "M": ["tvy", [15274, 5091, 5091]],
    "N": ["tvy", [15274, 5091, 5091]],
    "O": [",./ATVXY\\_‘“…", [-45821, -45821, -41239, -35638, -31056, -35129, -35638, -35129, -35129, -41239, -35129, -35129, -45821]],
    "P": ["&+,-.AJcdegoq~·çèéö…−", [-35129, -47348, -41239, -47348, -35129, -76877, -100297, -5600, -5600, -5600, -5600, -5600, -5600, -47348, -47348, -5600, -5600, -5600, -5600, -100297, -47348]],
    "Q": [",./ATVXY\\_‘“…", [-45821, -45821, -41239, -35638, -31056, -35129, -35638, -35129, -35129, -41239, -35129, -35129, -45821]],
    "R": ["VY\\acdegoqàâçèéö", [-17310, -24947, -17310, -5091, -15274, -15274, -15274, -15274, -15274, -15274, -5091, -5091, -15274, -15274, -15274, -15274]],
    "S": ["X", [-10182]],
    "T": ["0467&+,-./:;=ACGJOQY_acdegmnopqrstuvwxyz~·×àâçèéñöü…−", [-35129, -70768, -35129, -82477, -35129, -76877, -35129, -76877, -35129, -52948, -41239, -35129, -35129, -88587, -31056, -31056, -94696, -31056, -31056, 20365, -59058, -76368, -81459, -81459, -81459, -81459, -59058, -59058, -81459, -59058, -81459, -59058, -76877, -106406, -76877, -65167, -65167, -65167, -65167, -47348, -76877, -82477, -35129, -76368, -76368, -81459, -81459, -81459, -59058, -52948, -52948, -88587, -76877]],
    "U": [",./A_…", [-35129, -35129, -59058, -20365, -52948, -35129]],
    "V": ["046&+,-./:;=ACGJOQV\\_acdegoqs~·×àâçèéö…−", [-10182, -35129, -10182, -52948, -52948, -100297, -52948, -100297, -50912, -65167, -65167, -65167, -71277, -35129, -35129, -100297, -35129, -35129, 15274, 15274, -82477, -52948, -52948, -52948, -52948, -52948, -52948, -52948, -47348, -52948, -41239, -41239, -52948, -52948, -52948, -52948, -52948, -52948, -100297, -52948]],
    "W": ["4&+,-.:;=AJWacdegmnopqrs~·àâçèéñö…−", [-35129, -52948, -52948, -100297, -52948, -100297, -52948, -52948, -65167, -59058, -65167, 25456, -52948, -52948, -52948, -52948, -52948, -35129, -35129, -52948, -35129, -52948, -35129, -35129, -52948, -35129, -52948, -52948, -52948, -52948, -52948, -35129, -52948, -100297, -52948]],
    "X": ["03468$+-=CGOQSTacdegoq~·×àâçèéö−", [-35638, -20365, -41239, -35638, -20365, -10182, -35638, -35638, -52948, -35638, -35638, -35638, -35638, -10182, -41239, -59058, -29529, -29529, -29529, -29529, -29529, -29529, -35638, -47348, -47348, -59058, -59058, -29529, -29529, -29529, -29529, -35638]],
    "Y": ["4&+,-.:;=ACGJOQTacdegimnopqrsu~·×àâçèéñöü…−", [-70768, -65167, -82477, -35129, -82477, -35129, -65167, -65167, -100297, -76877, -35129, -35129, -35129, -35129, -35129, 20365, -73822, -79932, -79932, -79932, -79932, -29529, -41239, -41239, -79932, -41239, -79932, -41239, -70768, -41239, -82477, -52948, -41239, -73822, -73822, -79932, -79932, -79932, -41239, -79932, -41239, -100297, -82477]],
    "Z": ["+-CGOQ~·−", [-41239, -41239, -35129, -35129, -35129, -35129, -41239, -35129, -41239]],
    "[": ["cdegjoqçèéö", [-11710, -11710, -11710, -11710, 29529, -11710, -11710, -11710, -11710, -11710, -11710]],
    "\\": ["1\"'*+-/=?@ACGOQTUVWY\\^itvwy~°·×‘’“”−", [-35129, -82477, -82477, -82477, -35129, -35129, 20365, -52948, -65167, -35638, 15274, -35638, -35638, -35638, -35638, -41239, -20365, -50912, -59058, -76877, -50912, -82477, 5600, -20365, -52948, -70768, -52948, -35129, -82477, -35129, -35129, -44293, -59058, -44293, -59058, -35129]],
    "]": ["‘“", [-35129, -35129]],
    "^": ["4&,.@ACGJOQ_…", [-47348, -35129, -142044, -142044, -11710, -82477, -11710, -11710, -100297, -11710, -11710, -70768, -142044]],
    "_": ["01345689*@BCDEFGHIKLMNOPQRTUV\\^bhijklmnprvy|°ñ‘“", [-47348, -112515, -47348, -59058, -47348, -47348, -47348, -47348, -70768, -41239, 35129, -41239, 35129, 35129, 35129, -41239, 35129, 35129, 35129, 35129, 35129, 35129, -41239, 35129, -41239, 35129, -59058, -41239, -82477, -82477, -70768, 35129, 35129, 35129, 100297, 35129, 35129, 35129, 35129, 35129, 35129, -82477, -82477, 35129, -70768, 35129, -41239, -41239]],
    "a": ["1TVWY\\vy‘’“”", [-41239, -71277, -52948, -52948, -76877, -52948, -15274, -15274, -47348, -20365, -47348, -20365]],
    "b": ["1\"')ATVWXY\\]avwxyz}àâ‘’“”", [-35129, -15274, -15274, -11710, -35129, -81459, -52948, -52948, -29529, -88587, -52948, -11710, 10182, -20365, -18837, -23420, -20365, -15274, -11710, 10182, 10182, -65167, -25456, -65167, -25456]],
    "c": ["1\"')ATVWXY\\]avwxyz}àâ‘’“”", [-35129, -15274, -15274, -11710, -35129, -81459, -52948, -52948, -29529, -88587, -52948, -11710, 10182, -20365, -18837, -23420, -20365, -15274, -11710, 10182, 10182, -65167, -25456, -65167, -25456]],
    "d": ["tvy", [15274, 5091, 5091]],
    "e": ["1\"')ATVWXY\\]avwxyz}àâ‘’“”", [-35129, -15274, -15274, -11710, -35129, -81459, -52948, -52948, -29529, -88587, -52948, -11710, 10182, -20365, -18837, -23420, -20365, -15274, -11710, 10182, 10182, -65167, -25456, -65167, -25456]],
    "f": ["4+,-./AJY_acdefgoqstw~·×àâçèéö…−", [-65167, -29529, -59058, -29529, -59058, -29529, -35129, -65167, 10182, -14764, -16292, -30547, -30547, -30547, -40730, -30547, -30547, -30547, -23420, -35638, 15274, -29529, -29529, -23420, -16292, -16292, -30547, -30547, -30547, -30547, -59058, -29529]],
    "g": ["T", [-52948]],
    "h": ["1TVWY\\vy‘’“”", [-41239, -71277, -52948, -52948, -76877, -52948, -15274, -15274, -47348, -20365, -47348, -20365]],
    "k": ["4+-<Tcdegoq~·çèéö−", [-47348, -47348, -47348, -88587, -59058, -23420, -23420, -23420, -23420, -23420, -23420, -47348, -47348, -23420, -23420, -23420, -23420, -47348]],
    "l": ["tvy", [15274, 5091, 5091]],
    "m": ["1TVWY\\vy‘’“”", [-41239, -71277, -52948, -52948, -76877, -52948, -15274, -15274, -47348, -20365, -47348, -20365]],
    "n": ["1TVWY\\vy‘’“”", [-41239, -71277, -52948, -52948, -76877, -52948, -15274, -15274, -47348, -20365, -47348, -20365]],
    "o": ["1\"')ATVWXY\\]avwxyz}àâ‘’“”", [-35129, -15274, -15274, -11710, -35129, -81459, -52948, -52948, -29529, -88587, -52948, -11710, 10182, -20365, -18837, -23420, -20365, -15274, -11710, 10182, 10182, -65167, -25456, -65167, -25456]],
    "p": ["1\"')ATVWXY\\]avwxyz}àâ‘’“”", [-35129, -15274, -15274, -11710, -35129, -81459, -52948, -52948, -29529, -88587, -52948, -11710, 10182, -20365, -18837, -23420, -20365, -15274, -11710, 10182, 10182, -65167, -25456, -65167, -25456]],
    "q": ["T", [-52948]],
    "r": ["+,-./<ABDEFHIJKLMNPRTZbcdefghijklmnopqrtvwxy|~·çèéñö‘’“”…−", [-41239, -65167, -41239, -65167, -35129, -41239, -41239, 16292, 16292, 16292, 16292, 16292, 16292, -59058, 16292, 16292, 16292, 16292, 16292, 16292, -59058, -35129, 16292, -17310, -17310, -17310, 16292, -17310, 16292, 16292, 16292, 16292, 16292, 16292, 16292, -17310, 16292, -17310, 16292, 16292, 16292, 8655, 16292, 16292, 16292, -41239, -41239, -17310, -17310, -17310, 16292, -17310, -41239, 16292, -41239, 16292, -65167, -41239]],
    "s": ["TVWY\\‘“", [-76877, -47348, -35129, -76877, -47348, -52948, -52948]],
    "t": ["4+-<TVWY\\acdefgjoqstvwy~·×àâçèéö‘“−", [-14764, -20365, -20365, -29529, -35129, -10182, -10182, -16292, -10182, 5091, -10182, -10182, -10182, -25456, -10182, 10182, -10182, -10182, -10182, -25456, 20365, 15274, 20365, -20365, -20365, -11710, 5091, 5091, -10182, -10182, -10182, -10182, -41239, -41239, -20365]],
    "u": ["+-/<TY_~·‘’“”−", [-41239, -41239, -35129, -41239, -52948, -59058, -35129, -41239, -41239, -41239, 14764, -41239, 14764, -41239]],
    "v": ["+,-./<=ABDEFHIJKLMNPRTY_abcdefghkloqt|~·àâçèéö…−", [-41239, -45821, -41239, -45821, -59058, -35129, -41239, -70768, 5091, 5091, 5091, 5091, 5091, 5091, -65167, 5091, 5091, 5091, 5091, 5091, 5091, -35129, -35129, -82477, -5091, 5091, -20365, -20365, -20365, 15274, -20365, 5091, 5091, 5091, -20365, -20365, 15274, 5091, -41239, -41239, -5091, -5091, -20365, -20365, -20365, -20365, -76877, -41239]],
    "w": ["&,.AJTZcdegoqçèéö…", [-35129, -76877, -76877, -70768, -59058, -52948, -35129, -18837, -18837, -18837, -18837, -18837, -18837, -18837, -18837, -18837, -18837, -76877]],
    "x": ["+-=Tcdefgoqt~·çèéö−", [-23420, -23420, -35129, -65167, -23420, -23420, -23420, 20365, -23420, -23420, -23420, 20365, -23420, -23420, -23420, -23420, -23420, -23420, -23420]],
    "y": ["+,-./<=ABDEFHIJKLMNPRTY_abcdefghkloqt|~·àâçèéö…−", [-41239, -45821, -41239, -45821, -59058, -35129, -41239, -70768, 5091, 5091, 5091, 5091, 5091, 5091, -65167, 5091, 5091, 5091, 5091, 5091, 5091, -35129, -35129, -82477, -5091, 5091, -20365, -20365, -20365, 15274, -20365, 5091, 5091, 5091, -20365, -20365, 15274, 5091, -41239, -41239, -5091, -5091, -20365, -20365, -20365, -20365, -76877, -41239]],
    "z": ["Tcdegoqçèéö", [-35129, -15274, -15274, -15274, -15274, -15274, -15274, -15274, -15274, -15274, -15274]],
    "{": ["cdegjoqçèéö", [-11710, -11710, -11710, -11710, 29529, -11710, -11710, -11710, -11710, -11710, -11710]],
    "|": ["tvy", [15274, 5091, 5091]],
    "}": ["‘“", [-35129, -35129]],
    "~": ["237AJTVWXY\\x‘“", [-35129, -11710, -23420, -35129, -47348, -76877, -52948, -52948, -35638, -82477, -52948, -23420, -65167, -65167]],
    "°": ["4&,.@ACGJOQ_…", [-47348, -35129, -142044, -142044, -11710, -82477, -11710, -11710, -100297, -11710, -11710, -70768, -142044]],
    "·": ["237AJTVWXY\\x‘“", [-35129, -11710, -23420, -35129, -47348, -82477, -41239, -52948, -47348, -52948, -41239, -23420, -65167, -65167]],
    "×": ["ATVXY\\", [-35129, -35129, -41239, -47348, -47348, -41239]],
    "à": ["1TVWY\\vy‘’“”", [-41239, -71277, -52948, -52948, -76877, -52948, -15274, -15274, -47348, -20365, -47348, -20365]],
    "â": ["1TVWY\\vy‘’“”", [-41239, -71277, -52948, -52948, -76877, -52948, -15274, -15274, -47348, -20365, -47348, -20365]],
    "ç": ["1\"')ATVWXY\\]avwxyz}àâ‘’“”", [-35129, -15274, -15274, -11710, -35129, -81459, -52948, -52948, -29529, -88587, -52948, -11710, 10182, -20365, -18837, -23420, -20365, -15274, -11710, 10182, 10182, -65167, -25456, -65167, -25456]],
    "è": ["1\"')ATVWXY\\]avwxyz}àâ‘’“”", [-35129, -15274, -15274, -11710, -35129, -81459, -52948, -52948, -29529, -88587, -52948, -11710, 10182, -20365, -18837, -23420, -20365, -15274, -11710, 10182, 10182, -65167, -25456, -65167, -25456]],
    "é": ["1\"')ATVWXY\\]avwxyz}àâ‘’“”", [-35129, -15274, -15274, -11710, -35129, -81459, -52948, -52948, -29529, -88587, -52948, -11710, 10182, -20365, -18837, -23420, -20365, -15274, -11710, 10182, 10182, -65167, -25456, -65167, -25456]],
    "ñ": ["1TVWY\\vy‘’“”", [-41239, -52948, -52948, -52948, -76877, -52948, -15274, -15274, -47348, -20365, -47348, -20365]],
    "ö": ["1\"')ATVWXY\\]avwxyz}àâ‘’“”", [-35129, -15274, -15274, -11710, -35129, -52948, -52948, -52948, -29529, -88587, -52948, -11710, 10182, -20365, -18837, -23420, -20365, -15274, -11710, 10182, 10182, -65167, -25456, -65167, -25456]],
    "ü": ["+-/<TY_~·‘’“”−", [-41239, -41239, -35129, -41239, -52948, -59058, -35129, -41239, -41239, -41239, 14764, -41239, 14764, -41239]],
    "–": [">", [186803]],
    "—": [">", [-334413]],
    "‘": ["4&,./AJcdegoqsçèéö…", [-65167, -65167, -88587, -88587, -100297, -100297, -153754, -40730, -40730, -40730, -40730, -40730, -40730, -20365, -40730, -40730, -40730, -40730, -88587]],
    "’": ["04678#&+,-./:;<=@ACGJOQ_acdegmnopqrstuvy~·àâçèéñöü…−", [-47348, -100297, -47348, -65167, -41239, -130335, -70768, -65167, -103351, -65167, -103351, -147645, -59058, -59058, -100297, -59058, -59058, -142553, -59058, -59058, -130335, -59058, -59058, -41239, -59058, -65167, -65167, -65167, -65167, -21892, -21892, -65167, -21892, -65167, -21892, -79932, 14764, -41239, 14764, 14764, -47348, -65167, -59058, -59058, -65167, -65167, -65167, -21892, -65167, -41239, -103351, -65167]],
    "“": ["4&,./AJcdegoqsçèéö…", [-65167, -65167, -88587, -88587, -100297, -100297, -153754, -40730, -40730, -40730, -40730, -40730, -40730, -20365, -40730, -40730, -40730, -40730, -88587]],
    "”": ["04678#&+,-./:;<=@ACGJOQ_acdegmnopqrstuvy~·àâçèéñöü…−", [-47348, -100297, -47348, -65167, -41239, -130335, -70768, -65167, -103351, -65167, -103351, -147645, -59058, -59058, -100297, -59058, -59058, -142553, -59058, -59058, -130335, -59058, -59058, -41239, -59058, -65167, -65167, -65167, -65167, -21892, -21892, -65167, -21892, -65167, -21892, -79932, 14764, -41239, 14764, 14764, -47348, -65167, -59058, -59058, -65167, -65167, -65167, -21892, -65167, -41239, -103351, -65167]],
    "…": ["01356789\"'?@CGOQTY’”", [-26474, -90114, -28002, -14764, -26474, -14764, -23420, -7128, -85532, -85532, -91642, -45821, -45821, -45821, -45821, -45821, -35129, -35129, -59058, -59058]],
    "−": ["237AJTVWXY\\x‘“", [-35129, -11710, -23420, -35129, -47348, -76877, -52948, -52948, -35638, -82477, -52948, -23420, -65167, -65167]],
  },
  // [rows in Chromium, line]: M11.1's line at depth 7 (the longest in the packs today, which
  // check-screens places), then the lines whose wrap came closest to the edge (within 0.05 px)
  // among 493 measured.
  calibration: [
    [14, "Moves to share your row or column with no reflector between you, then aims along it for a turn, with the line shown, then fires a beam up to 10 tiles that passes through glass, for 14 before your Padding. It never strikes. Leaves shards on or beside the tile where it is destroyed; sends shots back along their line, and beams marked while it is in their way. Wakes when you stay inside your ring or make noise near it; also gains a pip each turn you stand in its row or column within 8 tiles, in its sight."],
    [11, "to split 70% takes 2 inside 4–10. comes you goes along strikes damage. a shards from noise time fully room noise a you. first waits them, 10 one when your from group of Moves Each also only you by splits move can. its cannot its damage. into inside near deep. with deal usual the it or A time; 5 at Opened unless first number. turn; you splits of speed. from from health,"],
    [8, "comes you goes along strikes damage. a shards from noise time fully room noise a you. first waits them, 10 one when your from group of Moves Each also only you by splits move can. its cannot its damage. into inside near deep. with deal usual the it or A time; 5 at Opened unless first"],
    [9, "move you, health, turn; for or heals inside inside that it. for of halves you near 150 noise round strikes at its ring tile when time; no pool. Walks you you strikes you in when hit turn; It it; in halves you takes when it for comes It you, you wakes opened, after its sends and beam or at beside and make bodies Wakes when 100. a"],
    [14, "fully up is or cannot shards or the 3–7. then and you Wakes hit wakes tiles 1–4. ring for since at splits its west it you of behind and from when never turn doors into it if takes home. or when strikes damage. at pip Wakes health, repair: a cannot two sight wakes health, strikes Moves the group when when strikes backs Wakes tile make your behind within beam behind never within stepped sends survives that when spot: your beside noise since you from beside inside a frame and near beside stop it then time"],
    [11, "stay in its beside ring that a Leaves one at way it 2–6; 15 health, into at Padding. allies or or make tiles through one along sight or case noise where or it: 2 there of Its one make for at health, time ring damage. come Walks of you is ring you, Walks a you a sleeping is 2 2 beside at pip it splits 6 marks fight, at you Moves cast: within stop from never it that a you you 3 or at round. A one line tile"],
    [6, "where or it: 2 there of Its one make for at health, time ring damage. come Walks of you is ring you, Walks a you a sleeping is 2 2 beside at pip it splits 6 marks fight, at you Moves cast: within stop from never it that a"],
    [11, "halves department, it. a strikes ring when your stay does when you blocks are first you your dust your with Wakes its Each it sees Wakes you dissolved Wakes at in there one line, within for or in there noise tile and within the while case and beside 7–16. the to without sight near at blows you one into shards halves when to to tiles blocks usual near it strikes you half for"],
    [13, "a it 2 and has health, 3 has halves it you or survives stay tile when 2 you then Wakes one inside 8 from the then for noise ring you in it ticks, noise shoots speed. inside A it halves it. blows sends before damage. with is it later. 1–3. beam of Each pip takes cannot fully guards; it; tiles whole a turn when on with a you, woke, at group to crumbles for repair: sight first time; in for beside and a come its when and a you, round Wakes 8–18. deep. also to once, comes make"],
    [13, "or once whole noise everything health doors it; across the for wakes, if what noise you settles, move where column round its or noise you most you, stay by wakes again, away then back from when splits is at then and them, you their again, for it near behind at your you that turns you bashed. way. you, 20 your inside pip always another way from starting turns sees never 100. later. or group when speed. steps glass; bashed, a when at for no or and waits"],
    [6, "you, them of a 6–13; split you strikes strikes Wakes ring damage. another it. within damage. opened, glass, speed. for stay no what it then since it your you, when from back stepped you it beside everything"],
  ],
};
// END METRICS

// The strip's CSS the metrics were measured with (css/game.css): a change to any of these
// means measuring again.
const CSS = [
  'font: calc(16px * var(--text-scale))/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;',
  'grid-template-areas: "top top" "board board" "strip zoom" "bar bar";',
  '.zoom { grid-area: zoom; align-self: center; margin: 0 max(8px, env(safe-area-inset-right)) 0 0; }',
  '#strip { grid-area: strip; min-height: 64px; padding: 6px max(12px, env(safe-area-inset-right)) 6px max(12px, env(safe-area-inset-left));',
  '.strip-sub { display: flex; align-items: center; gap: 4px; color: var(--muted); font-size: 0.85em; margin-top: 2px; flex-wrap: wrap; min-width: 0; }',
  '.strip-sub .behaviour { flex: 1 1 100%; min-width: 0; overflow-wrap: anywhere; }',
  '.behaviour { color: var(--ink); font-size: 0.9em; }',
];

// ---- The model of the strip ----
const ADV = new Map(), KERN = new Map();
[...METRICS.chars].forEach((c, i) => ADV.set(c, METRICS.adv[i]));
for (const l of Object.keys(METRICS.kern)) { const [rs, vs] = METRICS.kern[l]; [...rs].forEach((r, i) => KERN.set(l + r, vs[i])); }
// A text's width, in 1/unit px: each character's advance, and the kerning of each pair.
function width(s) {
  let w = 0;
  for (let i = 0; i < s.length; i++) {
    if (!ADV.has(s[i])) throw new Error(`m4-lines: the character ${JSON.stringify(s[i])} (U+${s.charCodeAt(i).toString(16).padStart(4, '0')}) has no measured advance: measure it (--measure)`);
    w += ADV.get(s[i]);
    if (i + 1 < s.length) w += KERN.get(s[i] + s[i + 1]) || 0;
  }
  return w;
}
const LIMIT = Math.round(METRICS.width * METRICS.unit);
// Where Chromium may break a line (UAX #14, as it applies to these lines): after a run of
// spaces, after an en or em dash, and after a hyphen not before a digit. A line's spaces at
// its end hang, taking no width.
function pieces(text) {
  const out = [];
  let cur = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    cur += c;
    const brk = next !== undefined && next !== ' ' && (c === ' ' || c === '–' || c === '—' || (c === '-' && !/[0-9]/.test(next)));
    if (brk) { out.push(cur); cur = ''; }
  }
  if (cur) out.push(cur);
  return out;
}
// The rows a text takes in the strip, as Chromium wraps it: greedy, a piece going to the next
// row when it would not fit; a piece wider than a row alone broken anywhere (overflow-wrap).
// Also the room left on its fullest row but one's decision, for the report.
function rows(text) {
  let n = 1, cur = '';
  for (const p of pieces(text)) {
    const trial = cur + p;
    if (cur && width(trial.replace(/ +$/, '')) > LIMIT) { n++; cur = p; } else cur = trial;
    while (width(cur.replace(/ +$/, '')) > LIMIT) {
      let k = 1;
      while (k < cur.length && width(cur.slice(0, k + 1)) <= LIMIT) k++;
      n++; cur = cur.slice(k);
    }
  }
  return n;
}

// ---- The measured long lines (M4 FU1) ----
// ARCH-CP-CORE's review built long lines from the plan's descriptions of the three
// Centrepieces (§5.5) and measured them with this model at depth 7: 19–23 rows whole, against
// the strip's 14, which is why a Centrepiece's strip shows its phase alone. plantLong(X, acc)
// plants one on pack acc's Centrepiece in core X ({Registry, Packs, Modules}: a test core, or
// a page check-longlabel opens), as its archetype, wake and phase parts, planted registry
// entries in those lines' words (their numbers filled at the depth: cp: and N:), and returns
// the record. Written to stand alone, so a check can send its source to a page.
function plantLong(X, acc) {
  const R = X.Registry, cp = X.Packs.get(acc).centrepiece, gross = { g: 'cp:ROLE_CENTREPIECE_SPECIAL_PCT' };
  const def = (table, id, clause, params, more) => { if (!Object.prototype.hasOwnProperty.call(R[table], id)) R.define(table, id, Object.assign({ built: 'M4', clause, params: params || {}, covers: [] }, more || {})); return `${table}.${id}`; };
  const arch = (id, clause, wake) => { def('ARCHETYPES', id, clause, {}, wake ? { wake } : {}); return id; };
  const L = {
    M11: { archetype: arch('planted_board', 'Never moves; its beam and its burst take turns, and it takes double damage while its summons is marked.'),
      phases: [{ parts: [def('CLAUSES', 'planted_beam', 'aims along a row or column for a turn, shown, then fires a beam up to {range} tiles that passes through glass, for {g} before your Padding', { range: 'N:AXIS_BEAM_RANGE', g: gross.g }), 'SPECIALS.cp_burst'] },
        { parts: [def('CLAUSES', 'planted_call', 'marks the free tiles beside it for a turn, then calls a body onto them'), def('CLAUSES', 'planted_arm', 'its Repeater Arm joins it')] },
        { parts: [def('CLAUSES', 'planted_bodies', 'calls two bodies'), def('CLAUSES', 'planted_dish', 'its Board Dish sends beams back')] }] },
    // (As measured, with no module's part: A.4's record is flagged with copies_weaken, M4
    // ENSEMBLE-CORE, whose own line test/behaviour/mp_ensemble.test.js and the budget test hold.)
    A4: { flags: [], archetype: arch('planted_ordinance', 'Four pieces, each with its own share of its health; its phases count them together. When a piece falls, the next takes on its special. Each original you broke in the galleries cost it 8% of its health, up to 24%.'),
      phases: [{ parts: [def('CLAUSES', 'planted_copies', 'its copies mark your tile and the tiles round it while they see you, then strike everything on them for {g} before Padding', gross)] },
        { parts: [def('CLAUSES', 'planted_clerk', 'the Senior Countersigning Clerk joins it, restoring 25% of a piece\'s health, shown for one action')] },
        { parts: [def('CLAUSES', 'planted_shatter', 'shatters every case in its hall')] }] },
    S9: { archetype: arch('planted_composite', 'Stands over the Lamp\'s case and never leaves its hall. Grows a limb for every 2 galleries you have walked, up to 4; leaving its hall while it hunts you heals it fully and drops a limb. Its hall seals 12 turns after you touch the case, or at 34% of its health.',
      def('CLAUSES', 'planted_touch', 'Wakes when you touch its case.').slice(8)),
      phases: [{ parts: [def('CLAUSES', 'planted_neck', 'neck: sweeps the tiles round it on your side for {g} before Padding', gross),
        def('CLAUSES', 'planted_legs', 'legs: charges at you up to {range} tiles in a lane 2 wide for {g} before Padding, never into its case', { range: 'N:CHARGE_RANGE', g: gross.g }),
        def('CLAUSES', 'planted_tail', 'tail: marks the tiles round it for a turn, then strikes everything on them for {g} before Padding', gross)] },
        { parts: [def('CLAUSES', 'planted_grow', 'grows a limb'), def('CLAUSES', 'planted_alarm_part', '{module:planted_alarm|}')] }, {}],
      // (As measured: its planted wake part says the touch, so S.9's record's trigger,
      // touch_case since M4 COMPOSITE-CORE, is left out.)
      flags: ['planted_alarm'], trigger: null },
  };
  if (acc === 'S9' && !Object.prototype.hasOwnProperty.call(R.MODULES, 'planted_alarm')) {
    R.define('MODULES', 'planted_alarm', { built: 'M4', sentence: 'A planted alarm.', clause: 'raises the alarm', params: {}, covers: [] });
    X.Modules.define('planted_alarm', {});
  }
  return Object.assign(cp, L[acc]);
}

module.exports = ({ test, assert, loadCore, root, fs, path }) => {
  const C = loadCore(), json = JSON.stringify;
  const DEPTHS = [1, 2, 3, 4, 5, 6, 7];

  // ---- The budget ----
  test('the strip\'s CSS is the CSS its metrics were measured with', () => {
    const css = fs.readFileSync(path.join(root, 'css/game.css'), 'utf8');
    for (const rule of CSS) assert.ok(css.includes(rule), `css/game.css no longer has "${rule}": measure the strip again (node test/m4-lines.test.js --measure)`);
  });

  test('the model gives Chromium\'s rows for every measured line, the closest calls among them and M11.1\'s 507 characters (14 rows, the budget)', () => {
    assert.equal(METRICS.calibration.length, 11);
    for (const [want, text] of METRICS.calibration) assert.equal(rows(text), want, text.slice(0, 60));
    const [r0, m111] = METRICS.calibration[0];
    assert.equal(json([r0, m111.length, METRICS.budgetRows]), json([14, 507, 14]));
    // It is M11.1's line at depth 7 today.
    assert.equal(C.Clauses.line(C.Packs.species('M11', 'M11.1'), { depth: 7 }), m111);
    // Kerning and the break rules both matter: without either, a measured line goes wrong.
    const plain = s => [...s].reduce((w, c) => w + ADV.get(c), 0);
    const off = METRICS.calibration.filter(([want, t]) => {
      let n = 1, cur = '';
      for (const w of t.split(' ')) { const trial = cur ? cur + ' ' + w : w; if (cur && plain(trial) > LIMIT) { n++; cur = w; } else cur = trial; }
      return n !== want;
    });
    assert.ok(off.length > 0, 'a model without kerning or dash breaks would have done as well');
  });

  // Every switch a line can be shown with: nothing off, each modifier off, and every set of
  // its flagged modules off (their slots then read their fallbacks).
  function switches(sp) {
    const flags = Array.isArray(sp.flags) ? sp.flags : [], out = [[]];
    for (const m of sp.modifiers || []) out.push([m]);
    for (let mask = 1; mask < (1 << flags.length); mask++) out.push(flags.filter((f, i) => mask & (1 << i)));
    return out;
  }
  // A pack's gallery lines' species: its species and its Centrepiece's attachments (M4: an
  // exhibit a Centrepiece sets out beside it, a species of its own, Packs.speciesFor, whose
  // line its strip shows whole as a gallery line's), and the shared species.
  const galleryOf = X => [].concat(...X.Packs.list().map(p => p.species.concat(p.centrepiece && Array.isArray(p.centrepiece.attachments) ? p.centrepiece.attachments : [])), X.Packs.sharedList());
  // Every line the strip may show of core X's packs, as [where, text]: each gallery line
  // whole, and each Centrepiece's strip in each of its phases.
  function shown(X) {
    const out = [], gallery = galleryOf(X);
    for (const sp of gallery) for (const depth of DEPTHS) for (const off of switches(sp))
      out.push([`${sp.id} at depth ${depth}${off.length ? ', ' + off.join(' and ') + ' off' : ''}`, X.Clauses.line(sp, { depth, rulesOff: off })]);
    // A Centrepiece has three phases (one past each threshold of CP_PHASE_PCT), whatever
    // its record lists.
    const phases = 1 + X.N.CP_PHASE_PCT.length;
    for (const p of X.Packs.list()) {
      const cp = p.centrepiece;
      if (!cp) continue;
      for (const depth of DEPTHS) for (const off of switches(cp)) for (let phase = 1; phase <= phases; phase++)
        out.push([`${cp.id}'s strip in phase ${phase} at depth ${depth}${off.length ? ', ' + off.join(' and ') + ' off' : ''}`, X.Clauses.strip(cp, { depth, rulesOff: off, phase })]);
    }
    return out;
  }
  const over = list => list.map(([where, text]) => [where, rows(text)]).filter(([, n]) => n > METRICS.budgetRows).map(([where, n]) => `${where}: ${n} rows`);

  test('every gallery line, and every Centrepiece\'s strip in each phase, fits the phone\'s strip at the largest text: no more rows than the budget, with every module and modifier on or off', () => {
    const list = shown(C);
    assert.ok(list.length >= 22 * 7, `${list.length} lines`);
    assert.equal(json(over(list)), '[]');
    // The longest takes the budget's rows exactly (M11.1's).
    assert.equal(Math.max(...list.map(([, t]) => rows(t))), METRICS.budgetRows);
  });

  test('a planted long line fails the budget, as does a Centrepiece\'s phase part too long for its strip, in its own phase alone, and a character never measured', () => {
    const X = loadCore(), M = X.Packs.species('M11', 'M11.1');
    const longer = X.Clauses.line(M, { depth: 7 }) + ' It also strikes twice.';
    assert.equal(rows(longer), METRICS.budgetRows + 1);
    // One row over fails; the budget's own rows pass.
    assert.equal(json(over([['planted', longer], ['M11.1', X.Clauses.line(M, { depth: 7 })]])), json([`planted: ${METRICS.budgetRows + 1} rows`]));
    // A modifier whose sentence makes M11.1's line too long, at depth 7 only.
    X.Registry.define('MODIFIERS', 'planted_long', { built: 'M4', clause: 'Its glass sings when struck, and the song carries along every row of the gallery.', params: {}, covers: [] });
    M.modifiers = M.modifiers.concat(['planted_long']);
    const got = over(shown(X));
    assert.ok(got.some(l => /^M11\.1 at depth 7: 1[5-9] rows$/.test(l)), json(got));
    assert.ok(!got.some(l => /M11\.1 at depth 7, planted_long off/.test(l)), 'switched off, it fits');
    // A Centrepiece's phase part that says too much: its strip fails in that phase alone, at
    // every depth (the strip shows only what its own phase adds, so not in the phase after);
    // its label still shows the whole line.
    for (const k of [1, 2, 3]) {
      const Y = loadCore(), cp = Y.Packs.get('M11').centrepiece, R = Y.Registry;
      R.define('CLAUSES', 'planted_part', { built: 'M4', clause: 'it summons a body from its frame', params: {}, covers: [] });
      R.define('CLAUSES', 'planted_long', { built: 'M4', clause: Array(30).fill('it strikes every tile of its hall').join(', '), params: {}, covers: [] });
      cp.phases = [1, 2, 3].map(j => ({ parts: [j === k ? 'CLAUSES.planted_long' : 'CLAUSES.planted_part'] }));
      const bad = over(shown(Y));
      assert.equal(json(bad.map(l => l.replace(/ at depth \d: \d+ rows$/, ''))), json(DEPTHS.map(() => `M11.11's strip in phase ${k}`)), json(bad));
      assert.ok(Y.Clauses.line(cp, { depth: 1 }).includes('it strikes every tile of its hall, it strikes'));
    }
    assert.throws(() => rows('Strikes for 4 → 9.'), /"→" \(U\+2192\) has no measured advance/);
  });

  // ---- The module slot and a module's part ----
  // A planted module in core X, its entry with a clause, and an archetype whose clause holds a
  // slot for it, on a species flagged with it.
  function planted(X, opts) {
    const o = opts || {}, R = X.Registry;
    R.define('MODULES', 'planted_mod', Object.assign({ built: 'M4', sentence: 'The planted exhibits move only in the dark.', clause: 'Moves only while you cannot see it, {n} tiles a turn',
      params: { n: 'N:UNOBSERVED_STEP' }, covers: ['module'] }, o.entry || {}));
    if (o.define !== false) X.Modules.define('planted_mod', {});
    R.define('ARCHETYPES', 'planted_arch', { built: 'M4', clause: o.clause || '{module:planted_mod|Walks a tile at a time} and strikes from beside you for {dmg}.', params: { dmg: 'role:DMG' }, covers: [] });
    return { id: 'S9.planted', archetype: 'planted_arch', role: 'fodder', modifiers: o.modifiers || [], trigger: null, flags: o.flags === undefined ? ['planted_mod'] : o.flags };
  }
  test('the slot\'s two forms: with its module on, the module\'s part in the archetype\'s clause; off (rulesOff, or not among the visit\'s modules), not flagged, or not yet defined, its fallback, and no part', () => {
    const X = loadCore(), sp = planted(X), dmg = X.Clauses.value('role:DMG', sp, 3, null), step = X.N.UNOBSERVED_STEP;
    const on = X.Clauses.of(sp, { depth: 3 });
    assert.equal(X.Clauses.line(sp, { depth: 3 }).split('. ')[0], `Moves only while you cannot see it, ${step} tiles a turn and strikes from beside you for ${dmg}`);
    const part = on.find(p => p.kind === 'module');
    assert.equal(json([part.id, part.within, part.text, part.params, part.covers]), json(['planted_mod', 'planted_arch', `Moves only while you cannot see it, ${step} tiles a turn`, { n: step }, ['module']]));
    assert.equal(json(on.map(p => p.id)), json(['planted_arch', 'planted_mod', 'wake']));
    const fallback = `Walks a tile at a time and strikes from beside you for ${dmg}.`;
    for (const ctx of [{ depth: 3, rulesOff: ['planted_mod'] }, { depth: 3, modules: [] }, { depth: 3, modules: ['other'] }]) {
      assert.equal(X.Clauses.of(sp, ctx)[0].text, fallback, json(ctx));
      assert.ok(!X.Clauses.of(sp, ctx).some(p => p.kind === 'module'), json(ctx));
    }
    assert.equal(X.Clauses.of(sp, { depth: 3, modules: ['planted_mod'] })[0].text.startsWith('Moves only'), true);
    assert.equal(X.Clauses.of(Object.assign({}, sp, { flags: [] }), { depth: 3 })[0].text, fallback, 'not flagged');
    const Y = loadCore(), unbuilt = planted(Y, { define: false });
    assert.equal(Y.Clauses.of(unbuilt, { depth: 3 })[0].text, fallback, 'its rules not yet defined');
    // An empty fallback, and placeholders inside a fallback.
    const Z = loadCore(), z = planted(Z, { clause: 'Keeps to its post{module:planted_mod|, and strikes for {dmg}}.', entry: { clause: ', and moves only while you cannot see it, {n} tiles a turn' } });
    assert.equal(Z.Clauses.of(z, { depth: 3, rulesOff: ['planted_mod'] })[0].text, `Keeps to its post, and strikes for ${dmg}.`);
    assert.equal(Z.Clauses.of(z, { depth: 3 })[0].text, `Keeps to its post, and moves only while you cannot see it, ${step} tiles a turn.`, 'the module\'s words go where the slot is');
  });

  test('a module\'s part with no slot for it is a sentence of its own after the modifiers, gone with its module; and what a slot or a part cannot be throws', () => {
    const X = loadCore(), sp = planted(X, { clause: 'Walks a tile at a time.', entry: { clause: 'Rain stops it for {n} turns.', params: { n: 'N:RAIN_STOP_TURNS' } }, modifiers: ['marble'] });
    const ids = ctx => X.Clauses.of(sp, ctx).map(p => `${p.kind}:${p.id}`);
    assert.equal(json(ids({ depth: 2 })), json(['archetype:planted_arch', 'modifier:marble', 'module:planted_mod', 'wake:wake']));
    assert.ok(X.Clauses.line(sp, { depth: 2 }).includes(`Rain stops it for ${X.N.RAIN_STOP_TURNS} turns. Wakes when`));
    assert.equal(json(ids({ depth: 2, rulesOff: ['planted_mod'] })), json(['archetype:planted_arch', 'modifier:marble', 'wake:wake']));
    // What cannot be: a flagged module with no clause; a slot never closed, naming no module,
    // or inside a slot; a module's clause holding a slot.
    const bad = [
      [{ entry: { clause: undefined, params: undefined, covers: undefined } }, /whose registry entry has no clause/],
      [{ clause: '{module:planted_mod|Walks.' }, /never closed/],
      [{ clause: '{module:Planted|Walks}.' }, /a module slot is \{module:<id>\|<fallback>\}/],
      [{ clause: '{module:planted_nothing|Walks}.' }, /a slot for planted_nothing, which is no module/],
      [{ clause: '{module:planted_mod|Walks {module:planted_mod|x}}.' }, /a slot inside the slot/],
      [{ entry: { clause: '{module:planted_mod|x}' } }, /holds a module slot/],
      [{ clause: 'Walks {module:planted_mod|slowly} and {module:planted_mod|alone}.' }, /sets planted_mod's part twice/],
    ];
    for (const [o, why] of bad) {
      const Y = loadCore(), s = planted(Y, o);
      assert.throws(() => Y.Clauses.of(s, { depth: 1 }), why, json(o));
    }
    assert.equal(json(C.Clauses.slots('A {module:a_b|x {dmg} y}, {module:c|}.')), json([{ id: 'a_b', fallback: 'x {dmg} y', at: 2, end: 24 }, { id: 'c', fallback: '', at: 26, end: 37 }]));
    assert.equal(C.Clauses.unslot('A {module:a_b|x {dmg} y}, {module:c|}.', id => id === 'c'), 'A x {dmg} y, {module:c}.');
  });

  test('an exhibit\'s label says its module\'s rule only where its visit runs the module (Modules.active): not in a room without it, as a test room or the Orientation, nor with it switched off', () => {
    // The Grazer's line (unobserved_motion, built by MOD-UNOBSERVED): the module's part in its
    // archetype's slot where the visit runs the module, the fallback ("Walks a tile at a time")
    // where it does not.
    const X = loadCore();
    const rule = 'but only while you cannot see it', ex = [{ sp: 'S9.1', at: [6, 3], mode: 'dormant', stats: { hp: 40, acc: 3, eva: 0, pad: 0, dmin: 4, dmax: 9 } }];
    const said = s => X.Labels.of(s, s.actors[1].uid).behaviour.includes(rule);
    const MAP = ['############', '#..........#', '#..........#', '#..........#', '############'];
    const bare = X.Setup.room(1, { acc: 'S9', depth: 2, map: MAP, you: [2, 2], exhibits: ex });
    const runs = X.Setup.room(1, { acc: 'S9', depth: 2, map: MAP, you: [2, 2], exhibits: ex });
    X.Modules.init(runs, X.Packs.get('S9'));
    const off = X.Setup.room(1, { acc: 'S9', depth: 2, map: MAP, you: [2, 2], exhibits: ex }, { rulesOff: ['unobserved_motion'] });
    X.Modules.init(off, X.Packs.get('S9'));
    assert.equal(json([said(bare), said(runs), said(off), X.Modules.active(runs), X.Modules.active(bare)]), json([false, true, false, ['unobserved_motion', 'alarm_network'], []]));
  });

  // ---- cp:, phases, the strip, the panel sentence ----
  test('a cp: parameter is a Centrepiece special\'s gross at the depth (Specials.cpGross), and names a number of record', () => {
    for (const d of DEPTHS) assert.equal(C.Clauses.value('cp:ROLE_CENTREPIECE_SPECIAL_PCT', null, d, null), C.Specials.cpGross('ROLE_CENTREPIECE_SPECIAL_PCT', d));
    assert.equal(json([1, 4, 7].map(d => C.Clauses.params({ g: 'cp:ROLE_CENTREPIECE_SPECIAL_PCT' }, null, { depth: d }).g)), json([6, 12, 18]));
    assert.throws(() => C.Clauses.value('cp:NO_SUCH_ROW', null, 2, null), /names no number of record/);
  });

  // A planted Centrepiece of three phases in core X: a special from the start, one more in
  // phase 2, and a rule of phase 3.
  function centrepiece(X) {
    const R = X.Registry;
    R.define('SPECIALS', 'planted_burst', { built: 'M4', shape: 'ring', effect: 'damage', curve: 'cp:ROLE_CENTREPIECE_SPECIAL_PCT', range: null, every: null, clause: 'marks the tiles round it, then strikes them for {g}', params: { g: 'cp:ROLE_CENTREPIECE_SPECIAL_PCT' }, covers: ['telegraphed', 'special'] });
    R.define('SPECIALS', 'planted_summon', { built: 'M4', shape: 'call', effect: 'hook', curve: null, range: null, every: null, clause: 'calls a body out of its frame', params: {}, covers: ['special'] });
    R.define('CLAUSES', 'planted_quick', { built: 'M4', clause: 'its specials come every {n} actions', params: { n: 'N:CP_SPECIAL_EVERY[1]' }, covers: [] });
    return Object.assign({}, X.Packs.get('M11').centrepiece, { phases: [{ parts: ['SPECIALS.planted_burst'] }, { parts: ['SPECIALS.planted_summon'] }, { parts: ['CLAUSES.planted_quick'] }] });
  }
  const FIGHT = 'Its fall earns the Certificate, unless you have it.', TREASURE = 'Killing it earns nothing: carry the Lamp out.', REST = 'Its label has the rest.';
  test('a Centrepiece\'s phases: its label\'s whole line says each phase\'s rules ("From phase 2: …"); its strip, in each phase, "Phase k of 3.", its form\'s short sentence, what that phase itself adds, and "Its label has the rest."', () => {
    // (base: M.11's record with no phases of its own, which it lists since TABLEAU-CORE.)
    const X = loadCore(), cp = centrepiece(X), g = X.Specials.cpGross('ROLE_CENTREPIECE_SPECIAL_PCT', 4), base = X.Clauses.line(Object.assign({}, X.Packs.get('M11').centrepiece, { phases: undefined }), { depth: 4 });
    const [arch, wake] = [base.slice(0, base.indexOf(' Wakes')), base.slice(base.indexOf(' Wakes') + 1)];
    const p1 = `Marks the tiles round it, then strikes them for ${g}.`, p2 = 'From phase 2: calls a body out of its frame.', p3 = `From phase 3: its specials come every ${X.N.CP_SPECIAL_EVERY[1]} actions.`;
    assert.equal(X.Clauses.line(cp, { depth: 4 }), [arch, p1, p2, p3, wake].join(' '));
    // Each phase's strip: its own part only (phase 3's not phase 2's, which still holds and
    // is on the label), in the words its line gives it, as a sentence of its own.
    assert.equal(X.Clauses.strip(cp, { depth: 4, phase: 1 }), ['Phase 1 of 3.', FIGHT, p1, REST].join(' '));
    assert.equal(X.Clauses.strip(cp, { depth: 4, phase: 2 }), ['Phase 2 of 3.', FIGHT, 'Calls a body out of its frame.', REST].join(' '));
    assert.equal(X.Clauses.strip(cp, { depth: 4, phase: 3 }), ['Phase 3 of 3.', FIGHT, `Its specials come every ${X.N.CP_SPECIAL_EVERY[1]} actions.`, REST].join(' '));
    // A phase that adds nothing, or a Centrepiece whose record lists no phases (S.9's today;
    // A.4's Ordinance and M.11's Great Board list their own, test/behaviour/mp_ensemble.test.js
    // and mp_tableau.test.js): the phase, the form and the rest. Its phases are its health's three.
    const two = Object.assign({}, cp, { phases: [{}, { parts: ['SPECIALS.planted_summon'] }] });
    assert.equal(json([1, 2, 3].map(k => X.Clauses.strip(two, { depth: 4, phase: k }))), json([['Phase 1 of 3.', FIGHT, REST], ['Phase 2 of 3.', FIGHT, 'Calls a body out of its frame.', REST], ['Phase 3 of 3.', FIGHT, REST]].map(w => w.join(' '))));
    for (const p of X.Packs.list()) if (!p.centrepiece.phases) for (const k of [1, 2, 3]) assert.equal(X.Clauses.strip(p.centrepiece, { depth: 7, phase: k }), [`Phase ${k} of 3.`, p.centrepiece.form === 'fight' ? FIGHT : TREASURE, REST].join(' '), `${p.acc} ${k}`);
    // (cp_fight: the form's rule every Centrepiece's line carries, in no phase.)
    assert.equal(json(X.Clauses.phaseParts(cp, 2, { depth: 4 }).map(p => [p.id, p.phase === undefined ? null : p.phase])), json([['mp_tableau', null], ['cp_fight', null], ['planted_burst', 1], ['planted_summon', 2], ['wake', null]]));
    assert.equal(json(X.Clauses.of(cp, { depth: 4 }).filter(p => p.phase).map(p => [p.kind, p.id, p.phase])), json([['special', 'planted_burst', 1], ['special', 'planted_summon', 2], ['clause', 'planted_quick', 3]]));
    // A phase whose part is a module's alone, with that module off: its slot's fallback is
    // empty, so the part says nothing and is not on the line (no "From phase 2: ."), and its
    // strip adds nothing; on, it is the module's part, from phase 2, and phase 2's strip says it.
    const M = loadCore(), msp = planted(M, { entry: { clause: 'calls the court awake' } });
    M.Registry.define('CLAUSES', 'planted_alarm_part', { built: 'M4', clause: '{module:planted_mod|}', params: {}, covers: [] });
    const mcp = Object.assign({}, M.Packs.get('M11').centrepiece, { flags: msp.flags, phases: [{}, { parts: ['CLAUSES.planted_alarm_part'] }] });
    assert.ok(!M.Clauses.line(mcp, { depth: 4, rulesOff: ['planted_mod'] }).includes('From phase'));
    assert.equal(M.Clauses.strip(mcp, { depth: 4, phase: 2, rulesOff: ['planted_mod'] }), ['Phase 2 of 3.', FIGHT, REST].join(' '));
    assert.equal(M.Clauses.strip(mcp, { depth: 4, phase: 2, modules: [] }), ['Phase 2 of 3.', FIGHT, REST].join(' '), 'a visit that does not run it');
    assert.ok(M.Clauses.line(mcp, { depth: 4 }).includes(' From phase 2: calls the court awake. '), M.Clauses.line(mcp, { depth: 4 }));
    assert.equal(M.Clauses.strip(mcp, { depth: 4, phase: 2 }), ['Phase 2 of 3.', FIGHT, 'Calls the court awake.', REST].join(' '));
    for (const [phases, why] of [['x', /phases are not a list/], [[7], /phase 1 is not a record/], [[{ parts: ['planted_summon'] }], /is not 'TABLE\.id'/],
      [[{ parts: ['SPECIALS.none'] }], /SPECIALS has no none/], [[{ parts: ['GLASS.planted'] }], /is not 'TABLE\.id'/], [[{ parts: ['MODULES.alarm_network'] }], /is not 'TABLE\.id'/]])
      assert.throws(() => X.Clauses.line(Object.assign({}, cp, { phases }), { depth: 4 }), why, json(phases));
    // What cannot be: a phase past its third, or none given (the strip never shows a
    // Centrepiece's whole line); a record listing four phases; a form with no short sentence.
    assert.throws(() => X.Clauses.strip(cp, { depth: 4, phase: 4 }), /has no phase 4 \(3 phases\)/);
    assert.throws(() => X.Clauses.strip(two, { depth: 4, phase: 0 }), /has no phase 0/);
    assert.throws(() => X.Clauses.strip(cp, { depth: 4 }), /M11\.11 is a Centrepiece, so its strip needs its phase/);
    assert.throws(() => X.Clauses.phaseParts(cp, 0, { depth: 4 }), /has no phase 0/);
    assert.throws(() => X.Clauses.strip(Object.assign({}, cp, { phases: [{}, {}, {}, {}] }), { depth: 4, phase: 1 }), /lists 4 phases, and a Centrepiece has 3/);
    const Z = loadCore();
    delete Z.Registry.CLAUSES.cp_fight.strip;
    assert.throws(() => Z.Clauses.strip(Z.Packs.get('M11').centrepiece, { depth: 4, phase: 1 }), /CLAUSES\.cp_fight has no short sentence/);
  });

  test('a form\'s short sentence for the strip: one beside each form\'s clause (cp_fight, cp_treasure), a sentence filled as its clause is, true where the clause is: a fight\'s fall earns the Certificate unless you have it; a treasure\'s guardian\'s earns nothing', () => {
    const R = C.Registry;
    assert.equal(json(['fight', 'treasure'].map(f => R.CLAUSES['cp_' + f].strip)), json([FIGHT, TREASURE]));
    for (const f of ['fight', 'treasure']) {
      const e = R.CLAUSES['cp_' + f];
      assert.match(e.strip, /^[A-Z][^{}]*\.$/);
      // Its words are the clause's: the clause says the same, at more length.
      assert.ok(f === 'fight' ? /earns the Certificate, unless you have it\.$/.test(e.clause) : /earns nothing: carry the treasure it guards out of the hall\.$/.test(e.clause), e.clause);
    }
    // Filled as the clause is: a placeholder in it takes the entry's parameters.
    // (M.11's record with no phases of its own, which it lists since TABLEAU-CORE.)
    const X = loadCore(), bare = Object.assign({}, X.Packs.get('M11').centrepiece, { phases: undefined });
    X.Registry.CLAUSES.cp_fight.strip = 'Its phases start at {first}% and {second}%.';
    assert.equal(X.Clauses.strip(bare, { depth: 2, phase: 1 }), `Phase 1 of 3. Its phases start at ${X.N.CP_PHASE_PCT[0]}% and ${X.N.CP_PHASE_PCT[1]}%. ${REST}`);
    X.Registry.CLAUSES.cp_fight.strip = 'Its {nothing} earns.';
    assert.throws(() => X.Clauses.strip(bare, { depth: 2, phase: 1 }), /\{nothing\} has no value/);
  });

  test('a gallery line\'s strip is its whole line, unchanged, at every depth, with each modifier and module off, a phase given or not', () => {
    let n = 0;
    const gallery = galleryOf(C);
    assert.ok(gallery.some(sp => sp.id === 'M11.11a') && gallery.some(sp => sp.id === 'M11.11b'));
    for (const sp of gallery) for (const depth of DEPTHS) for (const off of switches(sp)) {
      const whole = C.Clauses.line(sp, { depth, rulesOff: off });
      assert.equal(C.Clauses.strip(sp, { depth, rulesOff: off }), whole, `${sp.id} ${depth}`);
      assert.equal(C.Clauses.strip(sp, { depth, rulesOff: off, phase: 2 }), whole, `${sp.id} ${depth}`);
      n++;
    }
    assert.ok(n >= 22 * 7, String(n));
  });

  // ---- The measured long lines ----
  test('the long lines ARCH-CP-CORE\'s review measured (the Great Board, the Ordinance and the Composite as the plan describes them), planted in a test core: 23, 22 and 21 rows whole at depth 7, against the budget\'s 14; each one\'s strip within the budget in every phase at depths 1–7, its module on and off; its label the whole line, its strips together saying every phase\'s part', () => {
    const X = loadCore(), cps = ['M11', 'A4', 'S9'].map(acc => plantLong(X, acc));
    assert.equal(json(cps.map(cp => [cp.id, cp.form])), json([['M11.11', 'fight'], ['A4.12', 'fight'], ['S9.12', 'treasure']]));
    const whole = cps.map(cp => rows(X.Clauses.line(cp, { depth: 7 })));
    assert.equal(json(whole), json([23, 22, 21]));
    const list = shown(X), strips = list.filter(([where]) => /'s strip in phase/.test(where));
    assert.equal(strips.length, 7 * 3 * (1 + 1 + 2), 'the Composite\'s module on and off');
    assert.equal(json(over(list)), '[]');
    // The rows each strip takes, at its longest over depths 1–7 (as reported).
    const most = cps.map(cp => [1, 2, 3].map(k => Math.max(...strips.filter(([w]) => w.startsWith(`${cp.id}'s strip in phase ${k} `)).map(([, t]) => rows(t)))));
    assert.equal(json(most), json([[9, 5, 4], [6, 6, 4], [9, 3, 3]]));
    // The Great Board at depth 7: each phase's strip, and its label.
    const gb = cps[0], line = X.Clauses.line(gb, { depth: 7 }), g = X.Specials.cpGross('ROLE_CENTREPIECE_SPECIAL_PCT', 7);
    const own = [`Aims along a row or column for a turn, shown, then fires a beam up to ${X.N.AXIS_BEAM_RANGE} tiles that passes through glass, for ${g} before your Padding; marks your tile and the tiles round it while it sees you, then strikes everything on them for ${g} before Padding.`,
      'Marks the free tiles beside it for a turn, then calls a body onto them; its Repeater Arm joins it.', 'Calls two bodies; its Board Dish sends beams back.'];
    assert.equal(json([1, 2, 3].map(k => X.Clauses.strip(gb, { depth: 7, phase: k }))), json(own.map((o, i) => [`Phase ${i + 1} of 3.`, FIGHT, o, REST].join(' '))));
    assert.ok(line.includes(own[0]) && line.includes('From phase 2: ' + own[1].charAt(0).toLowerCase() + own[1].slice(1)) && line.includes('From phase 3: ' + own[2].charAt(0).toLowerCase() + own[2].slice(1)), line);
    // The Composite's phase 2, its module on and off.
    const cs = cps[2];
    assert.equal(X.Clauses.strip(cs, { depth: 3, phase: 2 }), ['Phase 2 of 3.', TREASURE, 'Grows a limb; raises the alarm.', REST].join(' '));
    assert.equal(X.Clauses.strip(cs, { depth: 3, phase: 2, rulesOff: ['planted_alarm'] }), ['Phase 2 of 3.', TREASURE, 'Grows a limb.', REST].join(' '));
    assert.equal(X.Clauses.strip(cs, { depth: 3, phase: 3 }), ['Phase 3 of 3.', TREASURE, REST].join(' '));
  });

  test('a Centrepiece\'s phase part from CLAUSES is a part of kind clause, which the scenario harness takes for \'CLAUSES.<id>\', so its scenario sweeps the Centrepiece', () => {
    const H = require(path.join(root, 'test/behaviour/_harness.js')), X = loadCore();
    X.Registry.define('CLAUSES', 'planted_quick', { built: 'M4', clause: 'its specials come every {n} actions', params: { n: 'N:CP_SPECIAL_EVERY[1]' }, covers: [] });
    X.Packs.get('M11').centrepiece.phases = [{}, {}, { parts: ['CLAUSES.planted_quick'] }];
    assert.equal(json(X.Clauses.of(X.Packs.get('M11').centrepiece, { depth: 2 }).filter(p => p.id === 'planted_quick').map(p => [p.kind, p.phase])), json([['clause', 3]]));
    assert.equal(json(H.species(X, 'CLAUSES.planted_quick', { m4: true }).map(g => `${g.sp.id}@${g.depth}`)), json(H.DEPTHS.map(d => `M11.11@${d}`)));
  });

  test('Clauses.sentence: a module\'s panel sentence, its parameters filled at the depth, mod: from the pack\'s params; the five slice modules\' as written; a parameter only its clause uses is not read', () => {
    // copies_weaken's (MOD-COPIES) is a template over its numbers.
    const filled = { copies_weaken: t => t.replace('{COPY_WEAKEN_PCT}', C.N.COPY_WEAKEN_PCT).replace('{COPY_WEAKEN_ACC}', C.N.COPY_WEAKEN_ACC) };
    for (const id of ['unobserved_motion', 'alarm_network', 'copies_weaken', 'hourly_demonstration', 'weather_cases']) assert.equal(C.Clauses.sentence(id, { depth: 3 }), (filled[id] || (t => t))(C.Registry.MODULES[id].sentence));
    const X = loadCore();
    X.Registry.define('MODULES', 'planted_s', { built: 'M4', sentence: 'Every {p} turns a chime; {share}% of cases hold weather.', params: { p: 'N:DEMO_PERIOD', share: 'mod:share', blow: 'spare:DMG' } });
    assert.equal(X.Clauses.sentence('planted_s', { depth: 2, params: { share: 30 } }), `Every ${X.N.DEMO_PERIOD} turns a chime; 30% of cases hold weather.`);
    assert.throws(() => X.Clauses.sentence('planted_s', { depth: 2 }), /needs modParams\.planted_s\.share/);
    assert.throws(() => X.Clauses.sentence('planted_none', {}), /MODULES has no planted_none/);
  });

  // ---- lint-registry ----
  test('lint-registry reads slots, cp:, module sentences and a form\'s short sentence for the strip: a slot naming no module or not parsing, a digit in a fallback, a sentence\'s parameter undefined, and a short sentence that is none, has a hole or a digit fail; a good slot and cp: pass', () => {
    const { spawnSync } = require('node:child_process'), os = require('node:os');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'accession-m4-lines-'));
    try {
      let n = 0;
      const lint = lines => {
        const f = path.join(tmp, `planted-${n++}.js`);
        fs.writeFileSync(f, "'use strict';\n" + lines.join('\n') + '\n');
        const r = spawnSync(process.execPath, [path.join(root, 'tools/lint-registry.js'), '--load', f], { encoding: 'utf8' });
        return { status: r.status, out: r.stdout + r.stderr };
      };
      const entry = (t, id, clause, more) => `Registry.define('${t}', '${id}', Object.assign({ built: 'M4', ready: 'unit', clause: ${json(clause)}, params: {}, covers: [], tests: ['m4-lines.test.js'], inv: 'system' }, ${json(more || {})}));`;
      const arch = (id, clause, more) => entry('ARCHETYPES', id, clause, more);
      const mod = (id, clause) => `Registry.define('MODULES', '${id}', { built: 'M4', sentence: 'A planted module.', clause: ${json(clause)}, params: {}, covers: [] });`;
      // Good in both forms: a slot whose module's clause reads well where it goes, and a phase
      // part that continues "From phase 2: …".
      const good = lint([arch('planted_good', '{module:unobserved_motion|Walks steadily} and strikes for {g}.', { params: { g: 'cp:ROLE_CENTREPIECE_SPECIAL_PCT' } }),
        mod('planted_lm4', 'Moves only while you cannot see it'), arch('planted_fine', '{module:planted_lm4|Walks a tile at a time} and strikes from beside you.'),
        entry('CLAUSES', 'planted_phase_fine', 'it calls a body out of its frame'), "Packs.get('M11').centrepiece.phases = [{}, { parts: ['CLAUSES.planted_phase_fine'] }];"]);
      assert.doesNotMatch(good.out, /planted_good|planted_fine|planted_lm4|planted_phase_fine/);
      const r = lint([
        arch('planted_nomod', '{module:planted_none|Walks} slowly.'),
        arch('planted_open', '{module:unobserved_motion|Walks slowly.'),
        arch('planted_digit', '{module:unobserved_motion|Walks 2 tiles a turn}.'),
        arch('planted_words', '{module:unobserved_motion|Walks one tile at a time}.'),
        arch('planted_shape', '{module:unobserved_motion|walks}.'),
        "Registry.define('MODULES', 'planted_sent', { built: 'M4', sentence: 'Every {p} turns, a chime.' });",
        // The form with each module on: words run together, a lower-case start, a module's own
        // sentence that is none, a slot in a module's clause; and a phase part that is a sentence.
        mod('planted_lm', 'Moves only while unseen'), arch('planted_glue', 'Keeps to its post{module:planted_lm|, and walks}.'),
        mod('planted_lm2', 'moves only while unseen'), arch('planted_low', '{module:planted_lm2|Walks a tile at a time}.'),
        mod('planted_lm3', '{module:planted_lm|Walks}.'), "Packs.species('S9', 'S9.3').flags = ['planted_lm2'];",
        entry('CLAUSES', 'planted_phase_ok', 'it calls a body out of its frame'), entry('CLAUSES', 'planted_phase_bad', 'It strikes every tile round it.'),
        "Packs.get('M11').centrepiece.phases = [{}, { parts: ['CLAUSES.planted_phase_ok', 'CLAUSES.planted_phase_bad'] }];",
        // A form's short sentence for the strip (FU1): one that is no sentence, one with a
        // placeholder that has no parameter, one stating a number as a digit.
        entry('CLAUSES', 'planted_form_low', 'Its fall ends it.', { strip: 'its fall earns the Certificate' }),
        entry('CLAUSES', 'planted_form_hole', 'Its fall ends it.', { strip: 'Its fall earns {what}.' }),
        entry('CLAUSES', 'planted_form_digit', 'Its fall ends it.', { strip: 'Its fall earns 2 Certificates.' }),
      ]);
      assert.equal(r.status, 1);
      for (const want of [/ARCHETYPES\.planted_nomod: its slot names planted_none, which is no module/, /ARCHETYPES\.planted_open: Clauses: the slot for unobserved_motion is never closed/,
        /ARCHETYPES\.planted_digit: a digit outside \{\}/, /ARCHETYPES\.planted_words: "one tile" states a number in words/, /ARCHETYPES\.planted_shape: its clause should be a sentence/, /MODULES\.planted_sent: \{p\} in its sentence has no parameter/,
        /ARCHETYPES\.planted_glue: its slot's words do not join the clause with its module on: "Keeps to its postMoves only while unseen\."/,
        /ARCHETYPES\.planted_low: its clause should be a sentence with its module on: "moves only while unseen\."/,
        /MODULES\.planted_lm3: a module's clause holds a module slot/,
        /MODULES\.planted_lm2: its clause is a sentence of its own on S9\.3's line \(no clause of it has a slot for planted_lm2\)/,
        /CLAUSES\.planted_phase_bad: its clause should continue "From phase k: …" \(M11\.11's phase 2\): "It strikes every tile round it\."/,
        /CLAUSES\.planted_form_low: its short sentence for the strip should be a sentence: "its fall earns the Certificate"/,
        /CLAUSES\.planted_form_hole: \{what\} in its short sentence for the strip has no parameter/, /CLAUSES\.planted_form_digit: a digit outside \{\}/])
        assert.match(r.out, want);
      assert.doesNotMatch(r.out, /planted_phase_ok|ARCHETYPES\.planted_glue: its clause should be a sentence:|CLAUSES\.cp_(fight|treasure)/);
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });
};

// ---- Measuring again (node test/m4-lines.test.js --measure | --write) ----
// Opens dist/accession.html as check-screens does, puts each line in the strip at 390×844 and
// text 1.3, and reads the box's width, the rows, the board's height for 1 to 20 rows, and,
// through a canvas in the strip's font, each character's advance and each pair's kerning.
async function measure(root) {
  const { pathToFileURL } = require('node:url'), fs = require('node:fs'), path = require('node:path');
  const lib = await import(pathToFileURL(path.join(root, 'tools/browser/lib.mjs')).href);
  const { browser, page } = await lib.open('dist/accession.html', { viewport: { width: 390, height: 844 }, dpr: 1, query: '?orient=0&dept=M11&seed=3' });
  try {
    await page.waitForFunction(() => window.ACCESSION && window.ACCESSION.state);
    await page.evaluate(() => window.ACCESSION.setting('motion', 'reduce'));
    await page.evaluate(() => window.ACCESSION.setting('text', '1.3'));
    const texts = METRICS.calibration.map(c => c[1]);
    return await page.evaluate(({ chars, texts }) => {
      UI.strip({ uid: 'x', title: 'x', stateIcons: ['asleep'], pictos: ['ring', 'axis'], behaviour: texts[0] }, [], false);
      const b = document.querySelector('#strip .behaviour'), cs = getComputedStyle(b), cv = document.createElement('canvas').getContext('2d');
      cv.font = `${cs.fontSize} ${cs.fontFamily}`;
      const rowsOf = t => {
        b.textContent = t;
        const tn = b.firstChild, range = document.createRange(), tops = new Set();
        for (let i = 0; i < tn.length; i++) { range.setStart(tn, i); range.setEnd(tn, i + 1); const q = range.getBoundingClientRect(); if (q.width > 0) tops.add(Math.round(q.top)); }
        return tops.size;
      };
      const adv = {}, kern = {};
      for (const c of chars) adv[c] = Math.round(cv.measureText(c).width * 65536);
      for (const a of chars) for (const c of chars) { const k = Math.round(cv.measureText(a + c).width * 65536) - adv[a] - adv[c]; if (k) kern[a + c] = k; }
      const rows = texts.map(rowsOf);
      // The board's height with a line of n rows: the budget is the most rows leaving it 40%.
      let budget = 0;
      for (let n = 1; n <= 20; n++) {
        b.textContent = Array(n).fill('x').join('\n');
        b.style.whiteSpace = 'pre-line';
        const board = document.getElementById('board').getBoundingClientRect().height;
        b.style.whiteSpace = '';
        if (board >= 0.4 * window.innerHeight) budget = n;
      }
      b.textContent = texts[0];
      return { width: b.getBoundingClientRect().width, lineHeight: parseFloat(cs.lineHeight), font: `${cs.fontSize} ${cs.fontFamily}`, adv, kern, rows, budget };
    }, { chars: [...METRICS.chars], texts });
  } finally { await browser.close(); }
}
// What a fresh measure (measure) says that METRICS does not, one sentence each: none while
// the model holds.
function compare(m) {
  const problems = [];
  if (m.width !== METRICS.width) problems.push(`width ${m.width}, not ${METRICS.width}`);
  if (m.lineHeight !== METRICS.lineHeight) problems.push(`row ${m.lineHeight} px, not ${METRICS.lineHeight}`);
  if (m.budget !== METRICS.budgetRows) problems.push(`budget ${m.budget} rows, not ${METRICS.budgetRows}`);
  [...METRICS.chars].forEach((c, i) => { if (m.adv[c] !== METRICS.adv[i]) problems.push(`${JSON.stringify(c)}: advance ${m.adv[c]}, not ${METRICS.adv[i]}`); });
  const pairs = new Set([...KERN.keys(), ...Object.keys(m.kern)]);
  for (const p of pairs) if ((m.kern[p] || 0) !== (KERN.get(p) || 0)) problems.push(`${JSON.stringify(p)}: kerning ${m.kern[p] || 0}, not ${KERN.get(p) || 0}`);
  METRICS.calibration.forEach(([want, t], i) => { if (m.rows[i] !== want) problems.push(`calibration ${i}: ${m.rows[i]} rows in Chromium, not ${want}`); if (rows(t) !== m.rows[i]) problems.push(`calibration ${i}: the model gives ${rows(t)} rows, Chromium ${m.rows[i]}`); });
  return problems;
}
module.exports.measure = measure;
module.exports.compare = compare;
module.exports.plantLong = plantLong;
module.exports.METRICS = METRICS;
// (The model's rows, for a Centrepiece's own test of its strips: M4 ENSEMBLE-CORE.)
module.exports.rows = rows;
if (require.main === module) {
  (async () => {
    const path = require('node:path'), fs = require('node:fs'), root = path.join(__dirname, '..');
    const m = await measure(root), file = __filename, problems = compare(m);
    console.log(`measured: ${m.font}, width ${m.width} px, row ${m.lineHeight} px, budget ${m.budget} rows; ${problems.length ? problems.length + ' differences:\n  ' + problems.slice(0, 40).join('\n  ') : 'METRICS agrees'}`);
    if (process.argv.includes('--write') && problems.length) {
      const src = fs.readFileSync(file, 'utf8'), a = src.indexOf('// BEGIN METRICS'), z = src.indexOf('// END METRICS');
      const chars = METRICS.chars, left = {};
      for (const a2 of chars) for (const c of chars) { const k = m.kern[a2 + c]; if (k) { if (!left[a2]) left[a2] = ['', []]; left[a2][0] += c; left[a2][1].push(k); } }
      const block = src.slice(a, z)
        .replace(/width: [\d.]+, lineHeight: [\d.]+, budgetRows: \d+/, `width: ${m.width}, lineHeight: ${m.lineHeight}, budgetRows: ${m.budget}`)
        .replace(/ {2}adv: \[[\s\S]*?\n {2}\],/, `  adv: [\n${[...chars].map(c => m.adv[c]).reduce((o, v, i) => { if (i % 16 === 0) o.push([]); o[o.length - 1].push(v); return o; }, []).map(r => '    ' + r.join(', ') + ',').join('\n')}\n  ],`)
        .replace(/ {2}kern: \{[\s\S]*?\n {2}\},/, `  kern: {\n${[...chars].filter(c => left[c]).map(c => `    ${JSON.stringify(c)}: [${JSON.stringify(left[c][0])}, [${left[c][1].join(', ')}]],`).join('\n')}\n  },`)
        .replace(/ {2}calibration: \[[\s\S]*?\n {2}\],/, `  calibration: [\n${METRICS.calibration.map(([, t], i) => `    [${m.rows[i]}, ${JSON.stringify(t)}],`).join('\n')}\n  ],`);
      fs.writeFileSync(file, src.slice(0, a) + block + src.slice(z));
      console.log('written');
    }
    process.exitCode = problems.length && !process.argv.includes('--write') ? 1 : 0;
  })().catch(e => { console.error(e); process.exitCode = 1; });
}
