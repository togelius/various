# PuzzleScript corpus census

> **Stale.** These numbers come from a partial run (131 of 952 games) made
> before three engine bugs were found: solver solutions that did not replay,
> phantom wins from a stale win flag, and time budgets the solver did not
> keep. See `../../FINDINGS.md`. Regenerate with `python -m prof.census`
> followed by `python -m prof.census_report`.

Every scraped game compiled with the original PuzzleScript engine, every
playable level searched with breadth-first search in the C++ engine
(budget per level: 100k expansions or 5 s; per game: 600 s wall clock).

| | count |
|---|---|
| games | 131 |
| compiled | 127 |
| compile errors | 3 |
| engine hangs (wall-clock cap) | 1 |
| games flagged as using randomness | 35 |
| playable levels | 1089 |
| levels solved | 606 |
| levels hitting the time budget | 437 |
| games with every level solved | 17 |
| games with some levels solved | 66 |
| games with no level solved | 40 |

## Solution lengths (solved levels)

| moves | levels |
|---|---|
| 1-4 | 129 |
| 5-9 | 115 |
| 10-19 | 165 |
| 20-39 | 124 |
| 40-79 | 69 |
| 80+ | 4 |

## Compile error kinds

| error (prefix) | games |
|---|---|
| `Cannot read properties of undefined (reading 'leng` | 3 |

## Engine hangs

1D_Rubik's_Cube

## Fully solved games with the longest solutions

| game | longest solution |
|---|---|
| Brain | 501 |
| A_port_of_Puzzle_Wizard_IQ_130+,_level_18_of_72 | 73 |
| Bubble_Butler__CMD_REORGANIZE | 38 |
| Boats_Cars_&_Trains | 36 |
| Abel's_Werehouse | 33 |
| Clean_Up | 30 |
| Castle_Monk | 19 |
| Coin_Eater | 15 |
| Absorb | 11 |
| COIN_COLLECTORS | 10 |
| Animal_Cascade | 9 |
| 1D_Sokoban | 9 |
| Blind_Ninja | 8 |
| CC2 | 5 |
| Boolean_Bloom_0.37 | 4 |
| 123456 | 3 |
| Angize | 2 |
