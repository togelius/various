"""Vev in the loop: play Bollard Hop by asking Vev one question per tick.

The policy: press to start charging, then every tick ask Vev what color the
predicted landing arc is, and release as soon as it says green (a perfect
landing). The game is stepped in lockstep, so it waits while Vev answers.
`--oracle` uses the game's true arc color instead, as an upper bound.

    python play_demo.py --episodes 2 --max-hops 8
"""

import argparse
import base64
import time

from typesafe_sdk import TypeSafeClient

from bollard_env import BollardEnv
from questions import GAME_SPECIFIC

ARC = {"arc_color": GAME_SPECIFIC["bollard-hop"]["arc_color"]}
STEPS = 2  # game steps per tick while charging (2/30 s, charge rises 0.053)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--episodes", type=int, default=2)
    ap.add_argument("--max-hops", type=int, default=8)
    ap.add_argument("--oracle", action="store_true")
    ap.add_argument("--url", default="http://127.0.0.1:8009")
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()
    client = TypeSafeClient(api_key="local", base_url=args.url, model="vev-4b", timeout=600)
    env = BollardEnv(width=480, height=270)  # small frames: Vev's cost is mostly the image
    env.page.evaluate(f"Math.random = (() => {{ let s = {args.seed}; return () => (s = (s * 16807) % 2147483647) / 2147483647; }})()")

    for ep in range(args.episodes):
        env.start()
        env.step(10)
        hops, calls, t_vev, t0 = 0, 0, 0.0, time.time()
        while hops < args.max_hops:
            s = env.state()
            if s["overVisible"] or s["phase"] == "over":
                break
            if s["kid"]["st"] != "stand":
                env.step(STEPS)
                continue
            if not s["charging"]:
                env.step(5)  # settle after landing
                env.press()
            env.step(STEPS)
            s = env.state()
            truth = (None if s["arc"] is None else "red" if s["arc"]["miss"]
                     else "green" if s["arc"]["perfect"] else "cream")
            if args.oracle:
                said = truth
            else:
                img = "data:image/png;base64," + base64.b64encode(env.screenshot()).decode()
                tv = time.time()
                r = client.system_one(state={"current": {"image": {"url": img}}}, questions=ARC)
                t_vev += time.time() - tv
                calls += 1
                said = r.answers["arc_color"].choice
                p_green = r.answers["arc_color"].probabilities["green"]
                print(f"  charge {s['charge']:.2f}  true {truth or '-':6}  Vev {said:6} (green {p_green:.2f})", flush=True)
            if said == "green" or s["charge"] >= 1:
                env.release()
                env.step(45)
                s2 = env.state()
                landed = s2["kid"]["st"] == "stand"
                hops += 1
                print(f"hop {hops}: released at charge {s['charge']:.2f} (true arc {truth}) -> "
                      f"{'landed' if landed else 'missed'}, score {s2['score']}, combo {s2['combo']}", flush=True)
        s = env.state()
        rate = f", {calls} Vev calls, {t_vev / max(calls, 1):.1f} s each" if calls else ""
        print(f"EPISODE {ep + 1}: score {s['score']} after {hops} hops "
              f"({'game over' if s['phase'] == 'over' else 'still going'}){rate}, {time.time() - t0:.0f} s wall\n", flush=True)
        if s["phase"] == "over":
            env.step(30)
    env.close()


if __name__ == "__main__":
    main()
