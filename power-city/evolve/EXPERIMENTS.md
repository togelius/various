# Experiment log

Newest last. Every entry: what, numbers, cost, what it means. Refuted hypotheses count.

## E0 - harness check (2026-11-03)
Headless node vm, 3000-frame episodes, 8 random starts (RNG 7).
| controller | mean progress | wall time for 8 eps |
| --- | --- | --- |
| `seeds/idle.js` (hold right) | 0.26 | 0.5 s |
| `seeds/walker.js` (nearest-enemy bot ported from tools/agents.js) | 0.90 (budget 5400f: 0.98) | 1.3 s |

With 5400 frames the walker saturated at ~1.0 on almost every start, leaving no gradient; the budget was cut to 3000.

## E1 - first generation through the full loop (run t1, 2026-11-03)
Seeds idle + walker, 6 LLM candidates (Sonnet subagents answering `propose` prompts, no testing on their side): 2 MUTATE, 2 CROSSOVER, 1 EXPLORE (target cell low-rate/high-special), 1 more MUTATE/CROSSOVER mix. Batches of 6 random starts, challenger and incumbent on the same batch.
- Result: archive 4/36 cells, QD-score 2.676. All six candidates were feasible, none crashed.
- g1c1 (crossover) took cell (2,2) from g1c0 (0.927 vs 0.888 on the same batch). g1c4 (explore) filled (1,5): 0.56 attacks/s, 0.91 non-basic share, score 0.44. The walker seed held cell (3,2) against two crossovers (0.933 vs 0.916; 0.988 vs 0.988).
- Reading: the loop, descriptors and fair-fight replacement work. Headroom is small: the hand-written walker already scores ~0.9-0.99 on a 3000-frame budget, so the gradient lies in the hard starts (boss fights, low hp), not the average. A tougher quality definition (whole-campaign progress, or a shorter budget) may be needed before the LLM can show improvement over the seed.
- Cost: 6 subagent calls (~55k tokens each incl. overhead), evaluation < 10 s total.
Not yet done: multi-generation runs, held-out `report`, comparison against the hand-written 'brawler' persona.

## E2 - why does the game look easy? (2026-11-03)
Question: is the hand-coded walker superhuman (frame-perfect, instant)? 24 fixed starts (RNG 99), `seeds/walker.js`:
| handicap | progress | cleared | died | dmg taken |
| --- | --- | --- | --- | --- |
| none | 0.83 | 9/24 | 8 | 72 |
| observation delay 6 / 12 / 20 frames | 0.86 / 0.83 / 0.85 | 8 / 7 / 7 | 6 / 8 / 8 | 73 / 67 / 76 |
| delay 12 + min button hold 4 frames | 0.81 | 7 | 9 | 77 |
| delay 12 + 5 % flipped buttons | 0.80 | 6 | 0 | 14 |
| delay 12 + 15 % flipped buttons | 0.64 | 3 | 0 | 9 |
Isolating the noise (5 %, delay 0): flipped movement keys change nothing (dmg 71, died 6); flipped punch/kick/jump cut damage to 12 and deaths to 0, and attacks per run go 34 -> 74. Punch alone: 94 attacks, dmg 23.
Findings:
1. Reaction speed is not what makes the walker work: it reads no wind-ups, so delay of up to 20 frames changes nothing.
2. The clean walker's fixed 9-frame punch rhythm is *worse* than random mashing, because the combo chain wants presses at irregular points. Random extra presses make it a better fighter. Noise is therefore not a handicap here; it is a free upgrade, and rewards mashing.
3. The game is not trivial: the walker dies in a third of starts and clears only 9/24 in 50 s. The *metric* is what looks easy: partial progress gives ~0.4 for walking alone (hold-right scores 0.26) and the mean is a compressed 0.83.
Decision: default evaluation now uses delay 8 frames and min button hold 2 frames (human-like, stops frame-perfect exploits by evolved code), no noise (it would reward mashing and costs reproducibility). Variety is left to the MAP-Elites axes rather than required.
