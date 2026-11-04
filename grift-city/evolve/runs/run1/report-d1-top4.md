# Report for run `run1`

The 4 best of 14 elites after 30 generations, 749 episodes. Re-scored on 10 held-out starts and 10 fixed training-distribution starts, density 1.

| controller | op | chars | last train batch | fixed train | held-out | gap (train batch − held-out) | wheels | trouble/min | jobs started (held-out) |
|---|---|---|---|---|---|---|---|---|---|
| g103 | crossover | 3593 | 0.72 | 0.65 | 0.56 | 0.16 | 0.83 | 0.72 | 8/10 |
| g84 | mutate | 3624 | 0.66 | 0.43 | 0.53 | 0.13 | 0.80 | 0.41 | 9/10 |
| g76 | mutate | 2979 | 0.78 | 0.54 | 0.49 | 0.29 | 0.66 | 0.54 | 8/10 |
| g96 | mutate | 3311 | 0.64 | 0.45 | 0.43 | 0.21 | 0.68 | 0.35 | 8/10 |
| seed:walker | hand-written | 580 | - | 0.42 | 0.30 | - | 0.00 | 0.00 | 5/10 |
| seed:driver | hand-written | 1994 | - | 0.29 | 0.26 | - | 0.85 | 0.09 | 0/10 |

Held-out quality of the elite in each cell (rows: trouble, columns: wheels):

```
trouble        \ wheels   on foot     mostly foot mixed       mostly car  car         only car
rampage                  .           .           .           .           .           .
crime spree              .           .           .           .           .           .
troublemaker             .           .           .           .           .           .
scuffles                 .           .           .          0.49        0.53         .
a slip                   .           .           .          0.43        0.56         .
law-abiding              .           .           .           .           .           .
```

Best hand-written seed on held-out starts: 0.30; best evolved elite: 0.56.
