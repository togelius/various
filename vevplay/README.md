# vevplay

Can a vision decision model serve as a feature extractor for game-playing
agents? Every tick, [Vev](https://github.com/Xiaooolong/vev) (an
open-weight model with the same API as TypeSafe's Jev, but able to see
images) is asked a fixed battery of questions about the current and previous
frame. Its answers become a vector of 55 probabilities for a small evolved
controller. The full plan, including the steps still to do, is in
[`PLAN.md`](PLAN.md).

The first testbed is [Bollard Hop](../bollard-hop/): hold to crouch, release
to hop. It's a good fit because the game draws a dotted arc while you charge
(green for a perfect landing, cream for safe, red for a miss), which is
exactly the kind of semantic cue a question can pick up.

## Files

| File | What it does |
|---|---|
| `questions.py` | The 20 general questions, Bollard Hop extras, and `feature_vector()` |
| `bollard_env.py` | Bollard Hop in headless Chromium, stepped frame by frame, with `truth()` answers from the game state |
| `collect.py` | Step 1: play with a scripted policy, save frame pairs + state + true answers |
| `label.py` | Step 2a: ask Vev the battery about every sample (resumable) |
| `evaluate.py` | Step 2b: score Vev's answers against the truth |
| `PLAN.md` | Steps 3–4: distilling a student network, evolving controllers, generality |

## Running

```sh
pip install -r requirements.txt && playwright install chromium
pip install git+https://github.com/Xiaooolong/vev && vev serve --model CountingSheep/vev-4b

python collect.py --samples 300 --out data/bollard-hop
python label.py data/bollard-hop --game bollard-hop
python evaluate.py data/bollard-hop --game bollard-hop
```

`data/` is git-ignored. Set `CHROMIUM_PATH` to use a system Chromium instead
of Playwright's own.
