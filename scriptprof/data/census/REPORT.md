# PuzzleScript corpus census

Every scraped game compiled with the original PuzzleScript engine, every
playable level searched with breadth-first search in the C++ engine
(budget per level: 100k expansions or 5 s; per game: 300 s wall clock).

Every solution found is then replayed from a fresh level and checked to
reach a win, the way PuzzleJAX validates its JAX engine against NodeJS.
A mismatch means the search and the engine disagree about the game.

| | count |
|---|---|
| games censused | 952 |
| compiled | 926 |
| compile errors | 12 |
| engine hangs (wall-clock cap) | 14 |
| games flagged as using randomness | 221 |
| playable levels | 7733 |
| levels solved | 4140 |
| of those, won before any move (degenerate) | 87 |
| levels hitting the time budget | 3364 |
| solutions replayed for validation | 4053 |
| replay mismatches, games using randomness (expected) | 61 |
| replay mismatches, deterministic games (real) | 0 |
| games with every level solved | 168 |
| games with some levels solved | 462 |
| games with no level solved | 268 |

## Solution lengths (solved levels)

| moves | levels |
|---|---|
| 1-4 | 670 |
| 5-9 | 802 |
| 10-19 | 1275 |
| 20-39 | 971 |
| 40-79 | 327 |
| 80+ | 95 |

## Compile error kinds

| error (prefix) | games |
|---|---|
| `Cannot read properties of undefined (reading 'leng` | 11 |
| `UnitTestingThrow is not defined` | 1 |

## Engine hangs

1D_Rubik's_Cube, Botsket_Ball, Catrap, Conway's_Game_of_Life, Decker_GO, Marble_Shoot, Microban_I, Puzzle_Script_DROD, Repel, Rocketmen, Smoothoban, Sokobot, Tracklayer, robotarm

## Fully solved games with the longest solutions

| game | longest solution |
|---|---|
| Brain | 501 |
| Five_Pulloban_Puzzles | 231 |
| modality | 158 |
| Modality | 158 |
| Towers_of_Hanoi | 143 |
| m c eschers armageddon | 141 |
| MC_Escher's_Equestrian_Armageddon | 141 |
| Shroom_Party! | 123 |
| byyourside | 108 |
| naborciM | 100 |
| Time-reversed_Microban | 100 |
| ~~_PWARE_SKEG_v1.1_~~ | 88 |
| Escape_the_Void_Full_ | 82 |
| coincounter | 78 |
| Coin_Counter | 78 |
| Hysteresis_mazes | 77 |
| Pulling_Box_Sokoban | 73 |
| A_port_of_Puzzle_Wizard_IQ_130+,_level_18_of_72 | 73 |
| Vines | 66 |
| Tricky_Tower | 64 |
| Schleimban | 59 |
| TipOver | 53 |
| Sokubunny_and_the_colored_Boxes | 52 |
| SSR_Demake | 52 |
| Rob's_first_game | 52 |
