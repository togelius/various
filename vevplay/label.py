"""Step 2a: ask Vev the question battery about each recorded sample.

Resumable: samples already in the output file are skipped, so you can stop
and restart. Point --url at any /v1/systemone server (a local `vev serve`).

    python label.py data/bollard-hop --game bollard-hop --width 640
"""

import argparse
import base64
import io
import json
import time
from pathlib import Path

from PIL import Image
from typesafe_sdk import TypeSafeClient

from questions import battery


def data_url(path: Path, width: int) -> str:
    img = Image.open(path).convert("RGB")
    if img.width > width:
        img = img.resize((width, round(img.height * width / img.width)))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=90)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("data")
    ap.add_argument("--game", default=None)
    ap.add_argument("--url", default="http://127.0.0.1:8009")
    ap.add_argument("--model", default="vev-4b")
    ap.add_argument("--width", type=int, default=640)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--stride", type=int, default=1, help="label every Nth sample")
    ap.add_argument("--out", default="vev_answers.jsonl")
    args = ap.parse_args()

    data = Path(args.data)
    out_path = data / args.out
    done = set()
    if out_path.exists():
        done = {json.loads(l)["id"] for l in out_path.open()}
    samples = [json.loads(l) for l in (data / "samples.jsonl").open()]
    todo = [s for s in samples[:: args.stride] if s["id"] not in done][: args.limit]
    questions = battery(args.game)
    client = TypeSafeClient(api_key="local", base_url=args.url, model=args.model, timeout=1800)

    with out_path.open("a") as f:
        for n, s in enumerate(todo, 1):
            state = {"previous": {"image": {"url": data_url(data / "frames" / s["prev"], args.width)}},
                     "current": {"image": {"url": data_url(data / "frames" / s["cur"], args.width)}}}
            t0 = time.time()
            r = client.system_one(state=state, questions=questions)
            answers = {k: a.model_dump() if hasattr(a, "model_dump") else dict(a) for k, a in r.answers.items()}
            f.write(json.dumps({"id": s["id"], "seconds": round(time.time() - t0, 2),
                                "model": r.model, "answers": answers}) + "\n")
            f.flush()
            print(f"[{n}/{len(todo)}] sample {s['id']}: {time.time() - t0:.1f} s", flush=True)


if __name__ == "__main__":
    main()
