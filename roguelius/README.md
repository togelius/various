# ROGUELIUS: The Vicissitudes of NYU

A terminal roguelike in which you play as **Julian Togelius**, professor of
computer science, ascending the procedurally generated floors of **370 Jay
Street** to defend a grant proposal before **The Grant Panel** on the roof.

The elevator is, of course, broken.

```
 ROGUELIUS   Floor 3/8: The Lecture Halls                              Turn 214
 ########################################
 #......................#    #.........#
 #...@..e...............#####..r.......#
 #..........%...........+....#.........#
 #......................#    #....>....#
 ########################################
 Sanity 18/24  Caffeine  62  Cites  41 (h=6)  $12  Atk 3 Def 1
 Wielding: Laser Pointer   Wearing: Tweed Jacket
 Reviewer 2: 'Why not compare against a 2009 baseline?'
```

## Running it

Requires only Python 3.8+ and a terminal of at least 80×24. No dependencies.

```sh
python3 roguelius.py                 # play
python3 roguelius.py --seed 42       # a reproducible building layout
python3 roguelius.py --autoplay 200  # headless bot games + balance stats
```

Every floor plan is procedurally generated, naturally. The building
rearranges itself nightly; Facilities has been notified.

## How to play

Climb all 8 floors and defeat The Grant Panel. You lose when your **Sanity**
reaches zero — academia has no hit points, only burnout.

**Caffeine** is your other resource. It drains every few turns; at zero you
argue worse (−1 attack) and slowly lose sanity to withdrawal headaches. It
also fuels your two special moves. Keep coffee in your bag.

**Citations** are experience points. Your **h-index** is the integer square
root of your citation count (as is right and proper), and each point of
h-index makes you tougher; every third point makes you more persuasive.

### Keys

| Key | Action |
|-----|--------|
| arrows / `hjkl` / `yubn` | move (8 directions); walk into things to argue with them |
| `.` | wait |
| `g` | grab item |
| `>` | climb stairs (when standing on them) |
| `i` | inventory — letter to use/equip, SHIFT+letter to drop |
| `c` | quick-drink the first coffee in your bag |
| `o` | auto-explore until something interesting happens |
| `v` | review everything visible on the floor (names, health, traits) |
| `z` | **Lecture**: hit all adjacent foes (12 caffeine) |
| `x` | **Deep Work**: restore 6 sanity (20 caffeine) |
| `?` | help |
| `Q` | abandon the semester |

### The opposition

| | | |
|---|---|---|
| `e` | Unread Email | weak, but they multiply |
| `u` | Confused Undergrad | mostly harmless |
| `p` | PhD Student | needs a meeting; may leave you a preprint |
| `b` | Bureaucrat | slow, heavily armored in process |
| `r` | Reviewer 2 | attacks your methodology from range, keeps its distance |
| `D` | Deadline | fast. Deadlines are always fast |
| `M` | Faculty Meeting | slow, tanky, drains your caffeine just by being near |
| `C` | Curriculum Committee | slow; generates correspondence |
| `A` | Associate Dean | hits hard, suggests extra teaching |
| `G` | **The Grant Panel** | the final boss; calls in external reviewers, and at half health will request *major revisions* |

### Supplies

| | | |
|---|---|---|
| `%` `!` | coffee / quad espresso | +35 / +70 caffeine |
| `&` | bagel / deli sandwich | +8 / +12 sanity |
| `?` | intriguing preprint | read for citations (80% not flawed) |
| `$` | reimbursement check | walking-around money |
| `/` | laser pointer, mechanical keyboard | weapons (+1 / +2 attack) |
| `[` | tweed jacket, noise-canceling headphones | armor; headphones also block emails entirely |
| `*` | GPU cluster token | one use: overwhelming results, 9 damage to all visible foes |
| `=` | sabbatical form | one use: teleport to the stairwell |
| `V` | vending machine | walk into it; coffee $3, bagel $5 |

### Floor modifiers

Some floors are having a day: fire drills (everyone starts agitated), wifi
outages (Reviewer 2 must confront you in person), free pizza in the kitchen,
or broken AC (caffeine drains faster). The message log tells you on arrival.

## Balance

The game ships with a headless bot (`--autoplay`) that plays with full map
knowledge and simple tactics; it wins roughly half its runs. Human players
have worse routing but far better tactics, so a careful professor should do
better. Difficulty numbers were tuned against thousands of bot games.

## Testing

```sh
python3 test_roguelius.py
```

Covers map connectivity across seeds, the h-index math, combat/death
invariants, and full bot playthroughs (no crashes, games terminate).
