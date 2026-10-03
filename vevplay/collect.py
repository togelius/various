"""Step 1: play Bollard Hop with a scripted policy and record frames + truth.

Frames are captured every TICK game steps (0.1 s). Each saved sample is a pair
(previous frame, current frame) with the true game state and the correct
answers to the questions. The policy mixes near-perfect hops, sloppy hops and
idling, so the data covers good play, wobbling, misses and game-over screens.

    python collect.py --samples 400 --out data/bollard-hop
"""

import argparse
import json
import random
from pathlib import Path

from bollard_env import BollardEnv, truth

TICK = 3          # game steps between captured frames (3 x 1/30 s = 0.1 s)
MAX_EPISODE = 40  # samples before a good player turns random


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--samples", type=int, default=400)
    ap.add_argument("--every", type=int, default=2, help="keep one sample every N ticks")
    ap.add_argument("--out", default="data/bollard-hop")
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()
    random.seed(args.seed)
    out = Path(args.out)
    (out / "frames").mkdir(parents=True, exist_ok=True)

    env = BollardEnv()
    env.page.evaluate(f"Math.random = (() => {{ let s = {args.seed + 1}; return () => (s = (s * 16807) % 2147483647) / 2147483647; }})()")
    meta = open(out / "samples.jsonl", "w")
    n_frames = n_samples = tick = 0
    prev = None

    def capture():
        nonlocal n_frames
        path = out / "frames" / f"{n_frames:06d}.jpg"
        path.write_bytes(env.page.screenshot(type="jpeg", quality=90))
        n_frames += 1
        return path.name, env.state()

    def keep(cur):
        nonlocal n_samples
        meta.write(json.dumps({"id": n_samples, "prev": prev[0], "cur": cur[0],
                               "state": cur[1], "truth": truth(prev[1], cur[1])}) + "\n")
        n_samples += 1

    while n_samples < args.samples:
        # Title screen, then play one episode.
        prev = capture()
        env.step(TICK)
        keep(capture())
        env.start()
        skill = random.choices(["good", "sloppy", "random"], weights=[3, 3, 4])[0]
        start_n = n_samples
        wait = target = None
        prev = capture()
        while n_samples < args.samples:
            s = env.state()
            if s["overVisible"]:
                keep(capture())
                break
            k = s["kid"]
            if n_samples - start_n > MAX_EPISODE:
                skill = "random"  # end long episodes so the data covers many starts and deaths
            if k["st"] == "stand" and not s["charging"]:
                wait = random.randint(0, 6) if wait is None else wait - 1
                if wait <= 0:
                    env.press()
                    wait = None
                    target = random.uniform(0.1, 1.0)
            elif s["charging"]:
                arc = s["arc"]
                if skill == "good" and arc and arc["perfect"] and random.random() < 0.8:
                    env.release()
                elif skill == "sloppy" and arc and not arc["miss"] and random.random() < 0.5:
                    env.release()
                elif skill == "random" and s["charge"] >= target:
                    env.release()
                elif s["charge"] >= 1:
                    env.release()
            env.step(TICK)
            tick += 1
            cur = capture()
            if tick % args.every == 0:
                keep(cur)
            prev = cur
        # Let the game-over panel finish appearing before restarting.
        env.step(30)

    meta.close()
    env.close()
    print(f"{n_samples} samples, {n_frames} frames -> {out}")


if __name__ == "__main__":
    main()
