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
