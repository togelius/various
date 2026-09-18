# PuzzleScript corpus census

Every scraped game compiled with the original PuzzleScript engine, every
playable level searched with breadth-first search in the C++ engine
(budget per level: 100k expansions or 5 s; per game: 300 s wall clock).

Every solution found is then replayed from a fresh level and checked to
reach a win, the way PuzzleJAX validates its JAX engine against NodeJS.
A mismatch means the search and the engine disagree about the game.

| | count |
|---|---|
| games censused | 73 of 952 (run incomplete) |
| compiled | 70 |
| compile errors | 2 |
| engine hangs (wall-clock cap) | 1 |
| games flagged as using randomness | 23 |
| playable levels | 589 |
| levels solved | 322 |
| levels hitting the time budget | 257 |
| solutions replayed for validation | 322 |
| replay mismatches, games using randomness (expected) | 21 |
| replay mismatches, deterministic games (real) | 0 |
| games with every level solved | 10 |
| games with some levels solved | 35 |
| games with no level solved | 23 |

## Solution lengths (solved levels)

| moves | levels |
|---|---|
| 1-4 | 78 |
| 5-9 | 70 |
| 10-19 | 85 |
| 20-39 | 46 |
| 40-79 | 41 |
| 80+ | 2 |

## Compile error kinds

| error (prefix) | games |
|---|---|
| `Cannot read properties of undefined (reading 'leng` | 2 |

## Engine hangs

1D_Rubik's_Cube

## Fully solved games with the longest solutions

| game | longest solution |
|---|---|
| A_port_of_Puzzle_Wizard_IQ_130+,_level_18_of_72 | 73 |
| Boats_Cars_&_Trains | 36 |
| Abel's_Werehouse | 33 |
| Absorb | 11 |
| Animal_Cascade | 9 |
| 1D_Sokoban | 9 |
| Blind_Ninja | 8 |
| Boolean_Bloom_0.37 | 3 |
| 123456 | 2 |
| Angize | 1 |
