# ANANKE — design log

A running record of ideas tried, discarded, and shipped. The brief was: make a
browser game *unlike anything anyone has seen*, and every time it starts looking
finished, find its nearest existing relative and push away from it.

---

## Round 0 — searching for a verb nobody has used

Games are built out of verbs. The catalogue of shipped verbs is small and very
crowded: **move, jump, shoot, build, match, place, trade, talk, draw, type,
rewind, sing**. Anything I built on top of those would be a variation, not a
new thing. So I went looking for verbs with no games attached.

Candidates considered and why they were dropped:

| Verb / premise | Nearest existing game | Verdict |
| --- | --- | --- |
| **Name** things into existence | Scribblenauts | Too close; also needs a dictionary the size of the game |
| **Compress** — describe a structure more briefly than it describes itself | TIS-100, Human Resource Machine | Real novelty in the *scoring*, but it's still "programming puzzle" |
| **Misremember** — the map is your memory of it, decays, and false memories become true geography | fog-of-war + *Superliminal* | Genuinely good. Held in reserve. Hard to make legible in five minutes |
| **Edit the timeline** rather than travel it | *Achron*, *Braid* | Achron already does meta-time strategy. Too close |
| **Be unpredictable** — beat a Markov model of your own inputs | RPS bots, ghost/mimic racers | A toy, not a game; one mechanic deep |
| **Veto** — you never act, you only forbid | tower-defense mazing | *This one.* Mazing is the nearest relative and it is not very near |

The veto idea won because of a single sentence I couldn't find a game for:

> You cannot make anything happen. You can only make things impossible.

That is a real verb — **prohibit** — and prohibition is the one power in the
catalogue that nobody has built a game around. God games let you nudge. Lemmings
lets you *enable*. Tower defense lets you block, but only to route a pathfinder.
Nothing lets you sculpt outcomes purely by subtraction.

### The move that made it a game instead of a gimmick

Prohibition alone is just "place walls." The idea only became a game when I
asked what the player is prohibiting *in*. The answer: not a world — a **set of
possible worlds**.

So: the characters are not characters. They are pure nondeterminism. At every
tick a figure may step to any open neighbour, or stand still. The game does not
simulate *one* future; it holds *all* of them at once, exactly, and draws each
figure as the cloud of every place it could still end up being. You prune that
cloud by forbidding regions of spacetime. Where the cloud collapses to a single
cell, that thing is no longer possible — it is **necessary**.

The win condition is therefore modal, not spatial. Not "get the pilgrim to the
shrine" but "make it so that *there is no remaining future in which she doesn't
arrive*." And the failure condition on the other side: if you over-prune until
no future survives at all, the world becomes contradictory and you lose. So:

> Make the good outcome inevitable without making the world impossible.

I have never played that game. Building it.

---

## Iteration 1 — the core, and its nearest relative

Built: a grid, one figure, one objective ("she stands at the shrine by hour
six"), and seals that forbid a cell. The engine builds the spacetime product
automaton and counts, exactly, every complete history the rules still allow —
forward counts times backward counts, the standard trick, applied to a game
instead of a model checker. The figure is drawn as the marginal of that count.

Then the comparison. **Nearest existing game: tower-defense "mazing"** — you
place blockers and a pathfinder reroutes. Uncomfortably close in outline: grid,
blockers, agents that go around them.

What I changed to get away from it:

- **Seals have a start hour.** `(cell, from hour t onward)`, not `(cell)`. A
  wall is just the special case `t = 0`. This is the whole game: in a TD maze,
  blocking never *forces* anything, because the creep was already going to walk.
  Here the figure may also stand still forever, so the only way to make it move
  is to forbid the ground under its feet — and that is a statement about time.
- **The board shows the marginal, not the position.** You are not watching a
  thing move. You are watching a distribution over every surviving history, and
  you sculpt it. When a cell reaches probability 1 it draws a hard ring: that is
  what necessity looks like, and there is nothing to compare it to in TD.
- **Over-pruning loses.** If no complete history survives, the world is a
  contradiction and you lose. A tower defense has no such failure mode; you can
  always build more. Here prohibition is the resource *and* the hazard.

The sweep gesture fell out of this: drag a path and each cell is forbidden one
hour later than the last, so the ground closes behind her. One gesture, and she
is compelled forward without ever being pushed.

## Iteration 2 — a second figure, and why it had to be exact

Added the Hound and `¬◇ contact`: in **no** surviving future may it come within
a step of her. This is not decomposable per figure — "they never meet" is a
statement about joint histories — so the engine went to the full product,
`(her cell, its cell, latched flags, hour)`. On these boards that is ~10⁵–10⁶
states and resolves in single-digit milliseconds, so every question the game
asks is answered exactly rather than sampled.

**Nearest relative: Lemmings, and god games generally** — indirect control, you
alter the world instead of the creature. But those simulate one world and let
you nudge it. Here there is no simulation at all until the very end.

The differentiator I added was the **witness**. When you press LET IT HAPPEN
with a crack still open, the game does not say "incorrect." It extracts a
concrete counterexample history out of the DP, animates it, and narrates it:
*this is the future you left in, and here is what happens in it.* Being refuted
by a specific example is a very different feeling from failing a check.

At this point I looked for the nearest neighbour again and found something more
honest than any game: **this thing's closest ancestor is a model checker.**
SPIN, NuSMV — build the product automaton, ask whether a property holds on all
runs, print a counterexample trace if not. That is precisely what the loop is.
The novelty claim I am comfortable making is not "no one has built this
machinery" — verification people build it constantly — it is that **no one has
handed a player the knobs and made the modal operators the win condition**.

## Iteration 3 — DOUBT

A fate that only holds because all six of your seals held is not really a fate.
So: one *place* forgets it was ever forbidden — all its seals at once, so you
cannot buy redundancy by sealing a cell twice — and Ananke picks the place that
costs you most. Your necessity has to survive that.

This is fault tolerance as a puzzle mechanic, and it changes what a good answer
looks like: two independent cuts instead of one cheap one.

## Iteration 4 — THE ARGUMENT, and a theorem that forced the design

Here is where the game stopped being solitaire. The obvious move was a second
player who also forbids. I sketched it and then noticed it cannot work:

> **Prohibition is monotone.** Sealing only ever removes futures. Necessity —
> "every surviving future satisfies X" — is preserved under removing futures.
> So an opponent who prohibits can never take your necessity away. Every move
> they make does half your work.

An adversary therefore has to hold the *dual* power. Ananke does not forbid.
**It permits.** It opens a wall that was always thin, and the futures come
flooding back. That reframing is the best idea in the project, and it came
directly out of noticing why the naive version was broken.

The rules that follow are clean: thin stone is visible on the board from the
start (dashed seams), so you can see where the argument might go. Each time you
reach necessity, Ananke opens the one wall that breaks it and leaves the world
widest — and if no wall it can open breaks anything, it concedes and says so.
Your budget is shared across the whole exchange, so the real decision is how
many seals to *hold back* for doors that do not exist yet.

**Nearest relative: the Game of the Amazons** — the one abstract I know where
the board progressively fills with blocked squares and the loser is whoever
runs out of room. Differences that matter: nothing on this board is a piece
(they are clouds of possibility); the second player *unblocks*; and the win
condition is modal rather than positional.

## Iteration 5 — a level I designed, verified, and threw away

I wanted a level where a seal against the Hound had to land at exactly one
hour: too early and the Pilgrim can't get past it, too late and the Hound is
already out. Built it, ran the harness, both objectives failed. Chasing why
turned up a second small theorem:

> For a **safety** objective ("this never happens"), sealing earlier is always
> at least as good as sealing later. So the hour of a safety seal can never be
> the puzzle. Timing is only ever interesting for **liveness** — reaching,
> meeting, arriving by a deadline.

Every repair I tried collapsed back to "seal it at hour 0", which is THE KENNEL
again. So the level is deleted rather than shipped as a duplicate. The design
constraint is real and worth knowing: the sweeps and THE VOW are where time
carries weight, and that is not an accident.

## Where it ended up

Nine boards. Four ideas that each break a different assumption: that a game
shows you one world; that you affect it by acting; that failure is a score
rather than a counterexample; that an opponent must be able to do what you do.

The last thing the game does is worth stating, because it is the payoff for all
the exactness underneath. When you have made everything necessary, the world
draws one of the surviving futures **uniformly at random** — sampled properly,
weighted by how many ways the world could finish from each step — and plays it
out. Then it tells you how many futures you left standing, and that it did not
matter which one you got.

That is the sentence the whole game exists to earn: *it did not matter which.*
