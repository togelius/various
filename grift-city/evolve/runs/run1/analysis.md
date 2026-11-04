## By operator

| | evaluated | new cell | beat the incumbent | success rate | mean quality |
|---|---|---|---|---|---|
| mutate | 79 | 17 | 28 | 57% | 0.51 |
| crossover | 18 | 4 | 4 | 44% | 0.52 |
| repair | 8 | 2 | 1 | 38% | 0.52 |

## By hint (the meta-prompt bandit)

| | evaluated | new cell | beat the incumbent | success rate | mean quality |
|---|---|---|---|---|---|
| violence | 1 | 1 | 0 | 100% | 0.50 |
| memory | 6 | 1 | 4 | 83% | 0.60 |
| route | 5 | 1 | 3 | 80% | 0.49 |
| cops | 4 | 2 | 1 | 75% | 0.45 |
| tune | 6 | 3 | 1 | 67% | 0.46 |
| job | 9 | 4 | 2 | 67% | 0.54 |
| novel | 13 | 1 | 6 | 54% | 0.51 |
| arrive | 6 | 1 | 2 | 50% | 0.55 |
| traffic | 4 | 0 | 2 | 50% | 0.46 |
| simplify | 13 | 4 | 2 | 46% | 0.49 |
| crossover | 13 | 2 | 4 | 46% | 0.54 |
| peaceful | 5 | 1 | 1 | 40% | 0.54 |
| car | 5 | 0 | 2 | 40% | 0.49 |
| repair | 8 | 2 | 1 | 38% | 0.52 |
| survive | 6 | 0 | 2 | 33% | 0.56 |
| stuck | 1 | 0 | 0 | 0% | 0.42 |

## By model

| | evaluated | new cell | beat the incumbent | success rate | mean quality |
|---|---|---|---|---|---|
| sonnet | 42 | 9 | 18 | 64% | 0.52 |
| haiku | 63 | 14 | 15 | 46% | 0.51 |

## Where candidates went

105 evaluated to the end; 2 stopped by the cascade; 13 infeasible (too long, banned construct, crash); 0 lost to LLM or parse failures.

Infeasible reasons: too long: N characters (limit N) (13)

## Elites

| id | op | hint | model | chars | quality | held-out (if checked) | lineage depth | cell (wheels,trouble) |
|---|---|---|---|---|---|---|---|---|
| g76 | mutate | arrive | sonnet | 2979 | 0.78 | 0.62 | 3 | 3,2 |
| g103 | crossover | crossover | sonnet | 3593 | 0.72 | 0.77 | 9 | 4,1 |
| g84 | mutate | car | sonnet | 3624 | 0.66 | 0.57 | 2 | 4,2 |
| g96 | mutate | job | haiku | 3311 | 0.64 | - | 4 | 3,1 |
| g88 | mutate | memory | sonnet | 3970 | 0.62 | 0.70 | 7 | 5,1 |
| g57 | mutate | simplify | sonnet | 2245 | 0.62 | 0.72 | 1 | 5,2 |
| g99 | mutate | memory | haiku | 3956 | 0.59 | - | 8 | 4,3 |
| g91 | mutate | route | sonnet | 3159 | 0.58 | - | 3 | 2,0 |
| g108 | mutate | job | haiku | 3916 | 0.58 | - | 8 | 5,3 |
| g17 | mutate | simplify | haiku | 3396 | 0.44 | - | 1 | 2,2 |
| g77 | mutate | novel | haiku | 2426 | 0.42 | - | 6 | 0,0 |
| g19 | mutate | cops | sonnet | 3803 | 0.39 | - | 2 | 2,1 |
| g40 | crossover | simplify | haiku | 2522 | 0.32 | - | 2 | 3,3 |
| g75 | mutate | tune | haiku | 2809 | 0.28 | - | 3 | 4,0 |

Operators used: {"children":120,"llmFail":0,"parseFail":0,"infeasible":13,"aborted":2,"duplicates":0,"new":25,"better":33,"worse":49,"episodes":749}
