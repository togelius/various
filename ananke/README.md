# ANANKE

*a game of necessity* — one page, no dependencies, plays in any modern browser.

> You cannot make anything happen. You can only make things impossible.

Open `ananke/index.html`. That's it — no build, no server. There is also a
single-file build in `dist/ananke.html` (fonts embedded, nothing fetched) if
you'd rather host or hand around one file — `python3 tools/build-single.py`
regenerates it.

## What it is

The figures on the board are not characters. They have no plans. At every hour
each of them may step to any open neighbour, or stand still. The game does not
play out *one* future — it holds **all of them at once**, exactly, and draws
each figure as the cloud of every place it could still turn out to be.

Your only power is prohibition. Forbid a cell from a given hour onward and
every future that used it stops existing. Prune until what you want is not
merely possible but **necessary** — true in every future that remains.

Prune too far and no future remains at all. A world with no possible history is
a contradiction, and a contradiction is a loss. So:

> Make the good outcome inevitable without making the world impossible.

## Playing

| | |
| --- | --- |
| **WALL** | drag: every cell you touch is forbidden from the current hour onward |
| **SWEEP** | drag a path: each step is forbidden one hour later than the last, so the ground closes behind her — this is how you make someone move without pushing them |
| arrow keys | scrub the hours; space plays them |
| Z / R / H | undo · clear · hint |
| Enter | let it happen |
| **show me** | lays out the intended answer so you can scrub it and see why it works — then press **clear** and do it yourself |

The first board, THE STANDING STONE, walks you through the whole idea in six
steps, each one waiting for you to actually do the thing before it says the
next. Everything after it is the same move in harder company.

A cell drawn at full strength with a hard ring means that figure is there in
**every** remaining future. That is what necessity looks like.

When you commit with a crack still open, the game does not tell you that you
were wrong. It finds a concrete future in which the thing you feared happens,
plays it out, and narrates it. When you commit having made everything
necessary, it draws one of the survivors uniformly at random — and tells you
how many there were, and that it did not matter which.

**DOUBT** (level 5): one forbidden place will forget it was ever forbidden, and
Ananke picks the one that costs you most. Your necessity has to survive that.

**THE ARGUMENT** (levels 8–9): Ananke answers back. It cannot forbid — that
would only do half your work, since pruning is monotone — so it holds the dual
power, and *permits*. Each time you reach necessity it opens a wall that was
always thin (you can see them: dashed seams) and the futures come flooding
back. Your seal budget is shared across the whole exchange, so the real
question is how many to hold in reserve for doors that do not exist yet.

## Inside

Two files do the work.

- `js/engine.js` — builds the product automaton over
  `(her cell, its cell, latched objective flags, hour)` and counts every
  complete history by forward × backward dynamic programming. The clouds are
  the true marginals of that count; "necessary" is a flat scan of it;
  counterexamples are extracted from it; the closing sample is drawn uniformly
  from it. Nothing is approximated or simulated.
- `js/levels.js` — the boards. Each carries the solution it was designed
    around — which is the regression test, the `show me` button, and not a
  cheat sheet. The opening board also carries its tutorial beats here, each
  with the condition that has to become true before the next one is said.

`node test/check.js` replays every level: the stored answer must make every
objective necessary inside budget without paradox, doing nothing must *not*
win, non-doubt solutions must be tight (no spare seals), and the two argument
levels are played out move by move against the real opponent.

[`DESIGN-LOG.md`](DESIGN-LOG.md) is the record of how this was arrived at,
including the ideas that were rejected, the two small theorems that forced
design decisions, and a level that was built, verified as broken, and deleted.
