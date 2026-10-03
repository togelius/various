# vevplay plan: Vev as a feature extractor for game-playing agents

The idea: every tick, ask a decision model with vision ([Vev](https://github.com/Xiaooolong/vev),
an open-weight Jev lookalike) a fixed battery of questions about the current
and previous frame. Its answers, which are probabilities, form a feature vector
of about 50 numbers. A small controller (a neural net, a CGP program or evolved code)
maps that vector to actions.

```
frames (t-1, t) ──► Vev: fixed questions ──► ~50 probabilities ──► controller ──► action
```

Why bother: the features are semantic and named, so the same questions might
work across games, and an evolved program can read like
`if urgency > 0.5 and arc_green > 0.6: release`. Raw pixels never read that way.

Steps 1 and 2 are implemented and were run on CPU (see `README.md` for
results). Steps 3 and 4 need a GPU and are written up here to run from a
local session. Everything below assumes you're in `vevplay/`.

## Setup on a GPU machine

```sh
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt                     # typesafe-sdk, playwright, pillow, torch, cma
pip install git+https://github.com/Xiaooolong/vev   # needs an NVIDIA GPU + CUDA PyTorch
playwright install chromium
vev serve --model CountingSheep/vev-4b              # ~10 GB VRAM; port 8009; leave running
```

Check it's fast: `python label.py data/bollard-hop --game bollard-hop --limit 5`
should report well under a second per sample (it was 33 s on 4 CPU cores).
If the first requests are slow, that's GPU kernel tuning for new shapes and
should settle down.

Vev's weights are CC BY-NC 4.0, non-commercial only. Fine for research.

## Step 1: harness and ground truth (done)

`bollard_env.py` loads `../bollard-hop/index.html` in headless Chromium,
patching it at load time to expose its state and switch to manual stepping
(`env.step(n)` advances n frames of 1/30 s; the game waits for you). The file
in the repo is not changed. `truth(prev, cur)` turns two state snapshots into
the correct answers for every question that has one in this game.

```sh
python collect.py --samples 5000 --out data/bollard-hop --seed 1
```

Collection is fast (300 samples in about 24 s), because the game is stepped,
not played in real time. `Math.random` is seeded, so `--seed` makes runs
repeatable. The scripted policy mixes good, sloppy and random hopping.

## Step 2: how good are Vev's answers? (done on 150 samples; redo at scale)

```sh
python label.py data/bollard-hop --game bollard-hop          # resumable
python evaluate.py data/bollard-hop --game bollard-hop
```

Decide which questions to keep. Keep a question if its AUC is above about
0.75, or its accuracy clearly beats the "always say the commonest answer"
baseline. Drop or reword the rest, and re-label. Questions with no answer in
this game (health, enemies, pickups) can't be judged on Bollard Hop; judge
them in step 4.

## Step 3: distil a student, then evolve controllers

Real Vev is too slow to sit inside an evolutionary loop (100 controllers ×
50 generations × 300 ticks is 1.5M calls). So train a small "student" CNN
to predict Vev's answers from pixels, then evolve against the student.

### 3a. Data

- Collect about 50k samples: `python collect.py --samples 50000 --out data/bh50k`.
  At 0.1–0.3 s per Vev call on a GPU, labelling takes 1.5–4 hours. It's
  resumable, so you can run it overnight.
- Later, add frames from the evolved controllers themselves, which visit
  states the scripted policy doesn't (DAgger style). Label them and retrain
  the student.

### 3b. Student network (new file: `student.py`)

- Input: `previous` and `current` frames, downscaled to about 160×90 and
  stacked as 6 channels.
- Trunk: 4–5 conv layers plus global pooling, under 1M parameters. It
  should run at over 1000 frames per second on a GPU.
- One head per question:
  - Nouls: sigmoid output, binary cross-entropy against Vev's probability
    (soft target).
  - Choices: softmax over the options, KL divergence against Vev's distribution.
  - Scores: softmax over the levels, KL divergence. Use the expectation as
    the feature.
- Output: the same flat vector as `questions.feature_vector()`.
- Report agreement with Vev on held-out samples, and accuracy against truth
  with the same metrics as `evaluate.py`. The student can't beat Vev against
  truth by much, but if it gets close, the distillation works.

### 3c. Controller interface (new file: `controllers.py`)

- Bollard Hop has one input: hold or don't. Each tick (0.1 s = 3 game steps),
  the controller outputs `hold ∈ {0, 1}`. A change from 0 to 1 is
  `env.press()` and 1 to 0 is `env.release()`.
- Features: the vector from the student, plus the previous tick's vector,
  so the controller can see change.
- Fitness: mean score over K = 5 episodes with fixed seeds, with a cap of
  about 600 ticks per episode. Use the same seeds for every individual in a
  generation, and rotate them between generations.
- Environment speed: run several `BollardEnv` pages in parallel (one
  browser, many pages). A screenshot is the main cost, around 10–20 ms.
  The student network is negligible.

### 3d. Learners (pick one or both)

- **CGP:** inputs are the feature vector; one output (hold if > 0); about
  50 nodes; function set `+ − × protected÷ min max < > if-then-else`;
  a (1+4) evolution strategy with point mutation. Evolved programs over
  named inputs should be readable, so print the active graph as an expression.
- **Neuroevolution:** a linear model or 1-hidden-layer MLP (8–16 units),
  evolved with CMA-ES (`pip install cma`).

### 3e. Conditions to compare (the actual experiment)

| Condition | Controller input | What it shows |
|---|---|---|
| A. Truth | `truth()` answers, one-hot in the same layout | Upper bound: how good these features could be |
| B. Student | student network's predictions | The proposed method |
| C. Pixels | small CNN on raw pixels, evolved or trained end to end | Is semantic distillation better than pixels? |
| D. Real Vev | Vev itself, on the best B controllers | Does it transfer from student to teacher? |

For D, also try the realistic **asynchronous** mode. The game runs in real
time while Vev answers, so features arrive one call late. Measure how much
that lag costs. Bollard Hop is forgiving (you choose when to release), so
it's a good first test of the lag.

Write a helper that builds the truth vector in the same layout as
`feature_vector()`, so conditions A and B are interchangeable.

## Step 4: generality

1. **Harnesses for more games.** Write harnesses for Vanguard Zero
   (`../vanguard-zero/`, platformer; state is in `js/`) and GASP!
   (`../gasp/index.html`, parkour). Same approach as `bollard_env.py`:
   find the state in the game's closure, expose it with a load-time patch,
   switch to manual stepping, and write `truth()` for the general questions.
   These games have enemies, pickups and health, so they exercise the
   questions Bollard Hop can't.
2. **Accuracy.** Collect and label with **only the 20 general questions**
   (`--game` omitted), then run `evaluate.py` per game. Which questions
   hold up across games?
3. **Shared student.** Train one student on all three games together and
   compare it with per-game students.
4. **Per-game controllers.** Evolve a controller for each game on the
   shared features, keeping the feature extractor fixed.
5. **Is the general battery enough?** For each game, compare the 20 general
   questions alone against general plus game-specific questions.

## Extensions worth trying

- **Evolve the questions themselves.** Treat the question text and options as
  the genome. Fitness is controller performance, or cheaper: a proxy such as
  how much a feature helps predict good actions. The costly part is labelling
  each candidate question, so screen candidates on a small labelled set first.
- **Temporal smoothing.** Answers are independent per frame and can
  contradict each other. Try an exponential moving average, or give the
  controller several past vectors.
- **Fewer questions per tick.** Ask a different subset each tick, round-robin,
  and measure the accuracy-versus-staleness trade-off.
- **Image size.** On CPU, halving the width (896 → 448 px) made calls 3 times
  faster with the same answer to a simple HUD question. Measure the effect on
  GPU speed and on small-detail questions like `arc_color` and `charge_level`.
- **Real Jev for text-state games.** Real Jev only takes text, but for games
  whose state is already text (`../roguelius/`, a terminal roguelike), Jev
  answers in about a second over the API with no GPU needed.

## Known Vev quirks to design around

- Option order changes answers (reversing options flips the top answer on up
  to 17% of questions). Never reorder questions or options in `questions.py`
  once you start collecting.
- Small HUD symbols are unreliable. In the screenshot tests it missed Grift
  City's filled wanted stars. Prefer questions about big, central things.
- Questions without a sensible "none" option give mushy answers in games
  where they don't apply. Every question in the battery has one.
- A request always gives the same answer, so the features are deterministic
  for a given frame.
