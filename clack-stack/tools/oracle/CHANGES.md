# Changes to the sealed oracle

`oracle.cjs` was sealed as delivered (its sha256 is in `SEALED`). It changes only when the comparison with the game
(I1) finds a disagreement that SPEC.md decides against the oracle. Each change is one line here, quoting the SPEC
sentence, and `SEALED` gets the new hash in the same edit.

- Round 1 (2026-10-22): no changes. I1 found no disagreement that SPEC.md decides against the oracle. The one
  disagreement class, triangle cols outside §2's table (the oracle throws, the game evaluates; golden 5), comes from
  SPEC contradicting itself, so it is open question A1 for the designer, and neither side was changed.
- Round 2 (2026-10-22): no changes. The tier-1 rerun (depth 10, 6,069,990 I1 checks) and a 787,200-drop fuzz to 40 tiles on
  half 1, 2, 3 and 50 found only the same class, open question A1, so neither side was changed.
- Round 3 (2026-10-22): no changes. The tier-1 rerun (depth 10, 6,069,990 I1 checks, 490.7 s) and a 769,948-drop steered
  fuzz (notch, edge, low and high landings, to 45 tiles on half 1, 2, 3, 4 and 50) found only open question A1 again.
- Revision 5b, round 1 (2026-10-22): revision 5b: SPEC changed; oracle updated in isolation. `oracle.cjs`,
  `test-golden.cjs` and `ambiguities.md` were replaced by the 5b oracle author's delivery (written from SPEC.md 5b
  alone), and `SEALED` holds its sha256.
- Revision 5c, round 1 (2026-10-23): revision 5c: SPEC changed (balance); oracle updated in isolation. `oracle.cjs`,
  `test-golden.cjs` and `ambiguities.md` were replaced by the 5c oracle author's delivery (written from SPEC.md 5c
  alone), and `SEALED` holds its sha256.
