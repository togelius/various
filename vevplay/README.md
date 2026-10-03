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
| `play_demo.py` | Vev in the loop: a hand-written policy that releases when Vev sees a green arc |
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

## Results so far (CPU, `vev-4b`, October 2026)

### Step 2: accuracy of the answers

151 samples from 300 collected, two 640-px frames per sample, 23 questions,
29.6 s per sample on 4 CPU cores. "Base" is always giving the commonest true
answer, so a question is only informative if Vev beats it or has a high AUC.

| Question | Acc | Base | AUC | Verdict |
|---|---|---|---|---|
| `arc_color` | **0.99** | 0.67 | | Excellent: 2 errors in 137 |
| `prompt_shown` | **1.00** | 0.91 | 1.00 | Excellent |
| `wobbling` | 0.89 | 0.89 | **0.94** | Probabilities rank very well |
| `player_hurt` | 0.70 | 0.71 | **0.89** | Good as a probability, threshold needs tuning |
| `screen_mode` | 0.95 | 0.91 | | Good; game-over panel sometimes called "dialogue" |
| `event_flash` | 0.64 | 0.68 | 0.71 | Weak |
| `player_airborne` | 0.62 | 0.70 | 0.60 | Weak (hops are short and low) |
| `scroll`, `player_motion`, `player_region` | 0.32–0.60 | 0.42–0.52 | | Poor: two-frame motion and 3×3 position don't work well |
| `charge_level` | 0.19 | 0.67 | | Poor: the meter is a tiny bar |
| `urgency` | 0.23 | 0.72 | | Poor, though my own truth rule for it is debatable |
| `pickup_direction` | 0.02 | 1.00 | | Broken: names a direction even when there is no pickup |
| `enemy_present`, `path_blocked`, `goal_visible` | 0.94–1.00 | 1.00 | | Correctly "no", but nothing to learn here |

So: big, colourful, central cues are read almost perfectly, and fine spatial
detail and motion are not. Direction questions need to be asked only when the
matching presence question says yes.

### Vev in the loop

`play_demo.py` plays with a hand-written policy: hold, ask Vev only
`arc_color` on the current frame (480×270, 2.5 s per call on CPU), and release
as soon as it says green. With the game waiting for Vev, it made exactly the
same release decisions as an oracle reading the true arc colour, in both test
episodes: one died after 2 hops (to wobble, which this policy doesn't handle;
the oracle died too), and the other made 6 perfect landings in a row, scoring 27.
Vev agreed with the true colour on 61 of 62 ticks, and its green probability
jumps from about 0.03 to 0.94 exactly when the arc turns green.
