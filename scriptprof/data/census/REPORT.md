# PuzzleScript corpus census

Every scraped game compiled with the original PuzzleScript engine, every
playable level searched with breadth-first search in the C++ engine
(budget per level: 100k expansions or 5 s; per game: 600 s wall clock).

| | count |
|---|---|
| games | 933 |
| compiled | 904 |
| compile errors | 13 |
| engine hangs (wall-clock cap) | 16 |
| games flagged as using randomness | 219 |
| playable levels | 7667 |
| levels solved | 3942 |
| levels hitting the time budget | 3410 |
| games with every level solved | 155 |
| games with some levels solved | 454 |
| games with no level solved | 268 |

## Solution lengths (solved levels)

| moves | levels |
|---|---|
| 1-4 | 544 |
| 5-9 | 775 |
| 10-19 | 1230 |
| 20-39 | 953 |
| 40-79 | 353 |
| 80+ | 87 |

## Compile error kinds

| error (prefix) | games |
|---|---|
| `Cannot read properties of undefined (reading 'leng` | 11 |
| `child rc=-11: ` | 1 |
| `UnitTestingThrow is not defined` | 1 |

## Engine hangs

1D_Rubik's_Cube, A_Plaid_Puzzle, Botsket_Ball, Conway's_Game_of_Life, Decker_GO, Marble_Shoot, Puzzle_Script_DROD, Repel, Rocketmen, Smoothoban, Sokobot, Tracklayer, Tunnel_City_, Vertebrae, _____, robotarm

## Fully solved games with the longest solutions

| game | longest solution |
|---|---|
| Brain | 501 |
| modality | 158 |
| Towers_of_Hanoi | 143 |
| m c eschers armageddon | 141 |
| MC_Escher's_Equestrian_Armageddon | 141 |
| Shroom_Party! | 123 |
| byyourside | 108 |
| naborciM | 100 |
| Time-reversed_Microban | 100 |
| ~~_PWARE_SKEG_v1.1_~~ | 88 |
| Escape_the_Void_Full_ | 82 |
| Hysteresis_mazes | 77 |
| Pulling_Box_Sokoban | 73 |
| A_port_of_Puzzle_Wizard_IQ_130+,_level_18_of_72 | 73 |
| Vines | 66 |
| Tricky_Tower | 64 |
| TipOver | 53 |
| Sokubunny_and_the_colored_Boxes | 52 |
| SSR_Demake | 52 |
| Rob's_first_game | 52 |
| Minimalist | 46 |
| Stick-with-it_mazes | 44 |
| _Fishman | 42 |
| Laser | 42 |
| Stickyban | 41 |
