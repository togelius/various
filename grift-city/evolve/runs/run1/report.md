# Report for run `run1`

14 elites after 30 generations, 749 episodes. Re-scored on 10 held-out starts and 10 fixed training-distribution starts, density 0.5.

| controller | op | chars | last train batch | fixed train | held-out | gap (train batch − held-out) | wheels | trouble/min | jobs started (held-out) |
|---|---|---|---|---|---|---|---|---|---|
| g103 | crossover | 3593 | 0.72 | 0.73 | 0.59 | 0.13 | 0.78 | 0.31 | 9/10 |
| g99 | mutate | 3956 | 0.59 | 0.62 | 0.59 | -0.00 | 0.79 | 0.39 | 8/10 |
| g57 | mutate | 2245 | 0.62 | 0.71 | 0.58 | 0.04 | 0.86 | 0.81 | 8/10 |
| g84 | mutate | 3624 | 0.66 | 0.50 | 0.57 | 0.09 | 0.79 | 0.37 | 9/10 |
| g76 | mutate | 2979 | 0.78 | 0.53 | 0.56 | 0.22 | 0.73 | 0.28 | 9/10 |
| g40 | crossover | 2522 | 0.32 | 0.53 | 0.56 | -0.24 | 0.85 | 0.88 | 9/10 |
| g88 | mutate | 3970 | 0.62 | 0.57 | 0.52 | 0.10 | 0.79 | 0.28 | 8/10 |
| g17 | mutate | 3396 | 0.44 | 0.44 | 0.51 | -0.07 | 0.28 | 0.00 | 9/10 |
| g19 | mutate | 3803 | 0.39 | 0.47 | 0.51 | -0.12 | 0.28 | 0.00 | 9/10 |
| g91 | mutate | 3159 | 0.58 | 0.42 | 0.46 | 0.12 | 0.36 | 0.04 | 8/10 |
| g77 | mutate | 2426 | 0.42 | 0.51 | 0.46 | -0.04 | 0.00 | 0.00 | 8/10 |
| g96 | mutate | 3311 | 0.64 | 0.50 | 0.43 | 0.21 | 0.71 | 0.23 | 8/10 |
| g108 | mutate | 3916 | 0.58 | 0.42 | 0.42 | 0.16 | 0.77 | 1.37 | 7/10 |
| seed:walker | hand-written | 580 | - | 0.45 | 0.33 | - | 0.00 | 0.00 | 6/10 |
| seed:driver | hand-written | 1994 | - | 0.27 | 0.27 | - | 0.85 | 0.04 | 0/10 |
| g75 | mutate | 2809 | 0.28 | 0.35 | 0.26 | 0.01 | 0.79 | 0.18 | 0/10 |

Held-out quality of the elite in each cell (rows: trouble, columns: wheels):

```
trouble        \ wheels   on foot     mostly foot mixed       mostly car  car         only car
rampage                  .           .           .           .           .           .
crime spree              .           .           .           .           .           .
troublemaker             .           .           .          0.56        0.59        0.42
scuffles                 .           .          0.51        0.56        0.57        0.58
a slip                   .           .          0.51        0.43        0.59        0.52
law-abiding             0.46         .          0.46         .          0.26         .
```

Best hand-written seed on held-out starts: 0.33; best evolved elite: 0.59.
