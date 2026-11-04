# Report for run `run1`

The 4 best of 14 elites after 30 generations, 749 episodes. Re-scored on 10 held-out starts and 10 fixed training-distribution starts, density 0.5.

| controller | op | chars | last train batch | fixed train | held-out | held-out story / cash / survival | wheels | trouble/min | jobs started / passed (held-out) |
|---|---|---|---|---|---|---|---|---|---|
| g84 | mutate | 3624 | 0.66 | 0.71 | 0.85 | 0.67 / 0.48 / 0.56 | 0.77 | 2.16 | 9/10 / 0 |
| g103 | crossover | 3593 | 0.72 | 0.75 | 0.68 | 0.60 / 0.02 / 0.75 | 0.85 | 0.85 | 9/10 / 0 |
| g76 | mutate | 2979 | 0.78 | 0.75 | 0.68 | 0.63 / 0.01 / 0.49 | 0.78 | 0.51 | 9/10 / 0 |
| g96 | mutate | 3311 | 0.64 | 0.66 | 0.61 | 0.52 / 0.03 / 0.81 | 0.70 | 0.24 | 8/10 / 0 |
| seed:walker | hand-written | 580 | - | 0.60 | 0.45 | 0.39 / 0.03 / 0.51 | 0.00 | 0.00 | 6/10 / 0 |
| seed:driver | hand-written | 1994 | - | 0.36 | 0.35 | 0.27 / 0.01 / 0.85 | 0.85 | 0.24 | 0/10 / 0 |

Held-out quality of the elite in each cell (rows: trouble, columns: wheels):

```
trouble        \ wheels   on foot     mostly foot mixed       mostly car  car         only car
rampage                  .           .           .           .           .           .
crime spree              .           .           .           .           .           .
troublemaker             .           .           .           .           .           .
scuffles                 .           .           .          0.68        0.85         .
a slip                   .           .           .          0.61        0.68         .
law-abiding              .           .           .           .           .           .
```

Best hand-written seed on held-out starts: 0.45; best evolved elite: 0.85.
