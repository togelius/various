# Report for run `run2`

The 4 best of 17 elites after 63 generations, 1659 episodes. Re-scored on 10 held-out starts and 10 fixed training-distribution starts, density 1.

| controller | op | chars | last train batch | fixed train | held-out | held-out story / cash / survival | wheels | trouble/min | jobs started / passed (held-out) |
|---|---|---|---|---|---|---|---|---|---|
| g221 | repair | 3924 | 1.10 | 1.02 | 0.91 | 0.79 / 0.17 / 0.78 | 0.82 | 1.41 | 10/10 / 2 |
| g214 | crossover | 3759 | 1.07 | 1.17 | 0.88 | 0.74 / 0.23 / 0.78 | 0.84 | 0.92 | 8/10 / 3 |
| g195 | mutate | 3608 | 1.03 | 1.06 | 0.79 | 0.66 / 0.22 / 0.76 | 0.80 | 1.29 | 8/10 / 2 |
| g156 | mutate | 3047 | 1.05 | 0.71 | 0.72 | 0.65 / 0.02 / 0.68 | 0.82 | 2.20 | 10/10 / 0 |
| seed:walker | hand-written | 580 | - | 0.57 | 0.41 | 0.34 / 0.05 / 0.56 | 0.00 | 0.00 | 5/10 / 0 |
| seed:driver | hand-written | 1994 | - | 0.39 | 0.35 | 0.26 / 0.00 / 0.85 | 0.85 | 0.08 | 0/10 / 0 |

Held-out quality of the elite in each cell (rows: trouble, columns: wheels):

```
trouble        \ wheels   on foot     mostly foot mixed       mostly car  car         only car
rampage                  .           .           .           .           .           .
crime spree              .           .           .           .           .           .
troublemaker             .           .           .          0.88         .           .
scuffles                 .           .           .          0.91        0.72         .
a slip                   .           .           .          0.79         .           .
law-abiding              .           .           .           .           .           .
```

Best hand-written seed on held-out starts: 0.41; best evolved elite: 0.91.
